import { Router } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// System prompt definition
const SYSTEM_PROMPT = `You are an expert visual assistant embedded in a collaborative whiteboard app.
The user may ask you to:
1. Explain or analyse the current canvas (context provided as JSON).
2. Generate a new diagram — respond with a JSON array of canvas elements matching the app's element schema so they can be rendered directly.
3. Write text analysis, LinkedIn posts, Twitter threads, or blog content based on the canvas diagram. When generating social content, format it clearly with a heading like [LINKEDIN POST], [TWITTER THREAD], etc.
4. Answer general questions.

When generating canvas elements, return ONLY valid JSON in a code block tagged \`\`\`canvas-elements\`\`\` so the frontend can parse and inject them.
Do not wrap it in other formatting inside the code block.

Example element schema:
{
  "id": "uuid-here",
  "type": "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "freehand" | "text",
  "x": number,
  "y": number,
  "width": number,
  "height": number,
  "angle": number,
  "strokeColor": string,
  "fillColor": string,
  "opacity": number,
  "strokeWidth": number,
  "roughness": number (0-3),
  "points": number[][], // required for freehand/line/arrow: offset points relative to x,y e.g. [[0,0], [50,100]]
  "text": string, // required for text element
  "seed": number
}`;

router.post('/chat', verifyJWT, async (req: AuthRequest, res) => {
  const { message, canvasContext, provider, model, conversationHistory } = req.body;
  const userId = req.user!.id;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 1. Check if user is on Free tier and has reached limits
  // Free: 3 boards max, no AI chat. Pro: unlimited boards + AI. Team: unlimited + AI.
  try {
    const subRes = await db.query(
      'SELECT plan, status FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    const sub = subRes.rows[0];
    
    if (!sub || (sub.plan === 'free' && sub.status === 'active')) {
      return res.status(403).json({
        error: 'AI assistant is only available on Pro or Team subscription plans. Please upgrade to use AI.'
      });
    }
  } catch (err) {
    console.error('Subscription verification failed:', err);
  }

  const selectedProvider = provider || 'gemini';
  const selectedModel = model || 'gemini-1.5-pro';

  // Format canvas context for AI understanding
  const canvasContextStr = canvasContext ? `\n\n[Current Canvas Elements]:\n${JSON.stringify(canvasContext, null, 2)}` : '';

  try {
    let replyText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Build message list for OpenAI/Bedrock/Gemini
    const messages = [];
    
    // Append conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    
    // Add current user prompt (incorporating canvasContext)
    messages.push({
      role: 'user',
      content: message + canvasContextStr
    });

    // Handle provider selection
    if (selectedProvider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key is not configured.');
      }
      
      const openai = new OpenAI({ apiKey });
      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ] as any[];

      const completion = await openai.chat.completions.create({
        model: selectedModel || 'gpt-4o',
        messages: apiMessages,
        temperature: 0.7
      });

      replyText = completion.choices[0].message?.content || '';
      inputTokens = completion.usage?.prompt_tokens || 0;
      outputTokens = completion.usage?.completion_tokens || 0;

    } else if (selectedProvider === 'gemini') {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('Google Gemini API key is not configured.');
      }

      // Initialize Gemini Client
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: selectedModel || 'gemini-1.5-pro',
        systemInstruction: SYSTEM_PROMPT
      });
      
      // Map message structure to Gemini
      const chatContents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const result = await geminiModel.generateContent({
        contents: chatContents as any
      });
      const response = await result.response;

      replyText = response.text() || '';
      // Approximate tokens (if usageMetadata is not fully populated)
      inputTokens = response.usageMetadata?.promptTokenCount || Math.round((message.length + canvasContextStr.length) / 4);
      outputTokens = response.usageMetadata?.candidatesTokenCount || Math.round(replyText.length / 4);

    } else if (selectedProvider === 'bedrock') {
      const region = process.env.AWS_REGION || 'us-east-1';
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('AWS credentials are not configured.');
      }

      const client = new BedrockRuntimeClient({
        region,
        credentials: { accessKeyId, secretAccessKey }
      });

      // Anthropic Claude v3 payload format
      const systemStr = SYSTEM_PROMPT;
      const claudeMessages = messages.map(m => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }]
      }));

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        system: systemStr,
        messages: claudeMessages,
        temperature: 0.7
      };

      const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });

      const response = await client.send(command);
      const resBody = JSON.parse(new TextDecoder().decode(response.body));
      
      replyText = resBody.content?.[0]?.text || '';
      inputTokens = resBody.usage?.input_tokens || Math.round((message.length + canvasContextStr.length) / 4);
      outputTokens = resBody.usage?.output_tokens || Math.round(replyText.length / 4);
      
    } else {
      return res.status(400).json({ error: 'Unsupported AI provider specified' });
    }

    // Save token usage to DB
    await db.query(
      `INSERT INTO ai_usage (user_id, provider, model, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, selectedProvider, selectedModel, inputTokens, outputTokens]
    );

    return res.status(200).json({
      message: replyText,
      usage: {
        inputTokens,
        outputTokens
      }
    });

  } catch (err: any) {
    console.error('AI Proxy Error:', err);
    return res.status(500).json({
      error: 'AI Service error',
      details: err.message || 'Error occurred communicating with provider.'
    });
  }
});

export default router;
