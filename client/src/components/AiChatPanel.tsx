import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  ChevronRight, 
  ChevronLeft,
  Sparkles, 
  HelpCircle,
  Linkedin,
  Twitter,
  LineChart,
  Grid,
  Undo,
  Play
} from 'lucide-react';
import { useCanvasStore, CanvasElement } from '../store/useCanvasStore';
import { useAuthStore } from '../store/useAuthStore';

// Simple unique ID generator
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AiChatPanel: React.FC = () => {
  const { elements, setElements, undo } = useCanvasStore();
  const { accessToken } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I am your AI visual design assistant. Ask me to explain your canvas drawing, generate custom shapes, or write draft copy!' }
  ]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'bedrock'>('gemini');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [loading, setLoading] = useState(false);
  
  // Toast notification state
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll chat to bottom when messages update
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Sync model dropdown options when provider changes
  useEffect(() => {
    if (provider === 'openai') {
      setModel('gpt-4o');
    } else if (provider === 'gemini') {
      setModel('gemini-1.5-pro');
    } else if (provider === 'bedrock') {
      setModel('anthropic.claude-3-5-sonnet-20240620-v1:0');
    }
  }, [provider]);

  // TRIGGER ASSISTANT TO DISPATCH PROMPT
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Serialize current elements context (lightweight snapshot)
      const canvasContext = elements.map(el => ({
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        text: el.text || undefined,
        strokeColor: el.strokeColor
      }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: textToSend,
          canvasContext,
          provider,
          model,
          conversationHistory: messages
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠️ Error occurred: ${err.message}. If you are on a free account, please click upgrade first!` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // CANVAS INJECTION PARSING FLOW
  const handleInjectToCanvas = (content: string) => {
    try {
      // Regex to match code blocks wrapped in ```canvas-elements ... ```
      const match = content.match(/```canvas-elements\n([\s\S]*?)```/);
      if (!match || !match[1]) {
        alert('Could not find shape elements block in this response.');
        return;
      }

      const rawJson = match[1].trim();
      const newElements: CanvasElement[] = JSON.parse(rawJson);

      if (!Array.isArray(newElements)) {
        alert('Format error: AI response was not a valid shapes list array.');
        return;
      }

      // Calculate the center point of the incoming diagram elements
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      newElements.forEach(el => {
        minX = Math.min(minX, el.x);
        maxX = Math.max(maxX, el.x + el.width);
        minY = Math.min(minY, el.y);
        maxY = Math.max(maxY, el.y + el.height);
      });

      const diagramWidth = maxX - minX;
      const diagramHeight = maxY - minY;
      const diagramCenterX = minX + diagramWidth / 2;
      const diagramCenterY = minY + diagramHeight / 2;

      // Align diagram center with the user's viewport screen center
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      
      const offsetX = screenCenterX - diagramCenterX;
      const offsetY = screenCenterY - diagramCenterY;

      // Assign new UUIDs and apply center translation offset
      const processedElements = newElements.map(el => ({
        ...el,
        id: generateId(),
        x: el.x + offsetX,
        y: el.y + offsetY,
        angle: el.angle || 0,
        strokeColor: el.strokeColor || '#8b5cf6',
        fillColor: el.fillColor || 'transparent',
        opacity: el.opacity || 1,
        strokeWidth: el.strokeWidth || 2,
        dashStyle: el.dashStyle || 'solid',
        roughness: el.roughness ?? 1,
        seed: el.seed || Math.floor(Math.random() * 100000)
      }));

      // Append to canvas elements store
      setElements([...elements, ...processedElements]);

      // Show toast alert with Undo command
      setToastMsg(`Successfully injected ${processedElements.length} elements!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);

    } catch (err: any) {
      console.error(err);
      alert(`Parsing failed: ${err.message}`);
    }
  };

  return (
    <>
      {/* 1. COLLAPSIBLE TOGGLE BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-24 right-6 p-3 rounded-2xl glass-panel text-brand-500 hover:text-white hover-scale shadow-2xl z-30 flex items-center justify-center border border-brand-500/20"
        title="Toggle AI Panel"
      >
        {isOpen ? <ChevronRight className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>

      {/* 2. CHAT PANEL LAYOUT */}
      <div 
        className={`absolute top-24 right-6 bottom-24 w-96 glass-panel rounded-3xl p-5 shadow-2xl z-30 flex flex-col gap-4 transition-all duration-300 transform ${
          isOpen ? 'translate-x-0' : 'translate-x-[420px] pointer-events-none'
        }`}
      >
        {/* Header Options */}
        <div className="flex items-center justify-between border-b border-dark-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-white">AI Visual Copilot</h3>
          </div>
          
          {/* Provider Dropdown */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="bg-dark-900 border border-white/5 rounded-xl px-2 py-1 text-[11px] font-semibold text-dark-200 outline-none cursor-pointer focus:border-brand-500/30"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="bedrock">Bedrock</option>
          </select>
        </div>

        {/* 3. CHAT MESSAGE THREAD */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 max-h-[calc(100vh-340px)]">
          {messages.map((msg, index) => {
            const isAI = msg.role === 'assistant';
            const hasCanvasCode = msg.content.includes('```canvas-elements');

            return (
              <div 
                key={index}
                className={`flex flex-col max-w-[85%] ${isAI ? 'self-start' : 'self-end'}`}
              >
                <div 
                  className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    isAI 
                      ? 'bg-dark-900 border border-white/5 text-dark-100 rounded-tl-sm' 
                      : 'bg-brand-600 text-white rounded-tr-sm shadow-md'
                  }`}
                >
                  {/* Simplistic formatting to strip elements json from text body */}
                  {msg.content.split('```canvas-elements')[0]}
                  
                  {isAI && hasCanvasCode && (
                    <div className="mt-2 text-[10px] text-brand-500 font-semibold italic">
                      [Canvas elements block generated]
                    </div>
                  )}
                </div>

                {/* Send elements button */}
                {isAI && hasCanvasCode && (
                  <button
                    onClick={() => handleInjectToCanvas(msg.content)}
                    className="mt-1.5 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500 hover:bg-brand-500 hover:text-white hover-scale transition-all"
                  >
                    <Play className="w-3 h-3" /> Draw on Canvas
                  </button>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="self-start max-w-[85%] bg-dark-900 border border-white/5 p-3 rounded-2xl rounded-tl-sm animate-pulse flex items-center gap-2 text-xs text-dark-200">
              <Bot className="w-4 h-4 animate-bounce text-brand-500" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* 4. CHAT PRESETS MACROS */}
        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-dark-800">
          <button
            onClick={() => handleSendMessage('Explain the current canvas')}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-dark-900/50 hover:bg-dark-900 border border-white/5 text-[10px] font-bold text-dark-200 hover:text-white transition-colors"
          >
            <HelpCircle className="w-3 h-3 text-brand-500" /> Explain Canvas
          </button>
          <button
            onClick={() => handleSendMessage('Generate a detailed diagram showing a basic microservices architecture')}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-dark-900/50 hover:bg-dark-900 border border-white/5 text-[10px] font-bold text-dark-200 hover:text-white transition-colors"
          >
            <Grid className="w-3 h-3 text-brand-500" /> Generate Diagram
          </button>
          <button
            onClick={() => handleSendMessage('Based on this whiteboard, draft a professional LinkedIn post summarizing key insights')}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-dark-900/50 hover:bg-dark-900 border border-white/5 text-[10px] font-bold text-dark-200 hover:text-white transition-colors"
          >
            <Linkedin className="w-3 h-3 text-brand-500" /> LinkedIn Post
          </button>
          <button
            onClick={() => handleSendMessage('Based on this diagram, write a Twitter thread explaining this workflow step-by-step')}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-dark-900/50 hover:bg-dark-900 border border-white/5 text-[10px] font-bold text-dark-200 hover:text-white transition-colors"
          >
            <Twitter className="w-3 h-3 text-brand-500" /> Twitter Thread
          </button>
        </div>

        {/* 5. PROMPT BAR */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask AI Copilot..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
            disabled={loading}
            className="flex-1 bg-dark-900 border border-white/5 rounded-2xl px-3 py-2.5 text-xs text-dark-100 placeholder-dark-200 outline-none focus:border-brand-500/30"
          />
          <button
            onClick={() => handleSendMessage(input)}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white hover-scale shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 6. TOAST NOTIFICATION CARD */}
      {showToast && (
        <div className="fixed bottom-24 right-6 glass-panel border border-brand-500/20 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-in slide-in-from-bottom-5 duration-300 z-50">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-semibold text-white">{toastMsg}</span>
          <button
            onClick={() => {
              undo();
              setShowToast(false);
            }}
            className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-dark-900 border border-white/5 text-[10px] font-bold text-dark-200 hover:text-white hover:border-brand-500/30 transition-all uppercase"
          >
            <Undo className="w-3 h-3 text-brand-500" /> Undo
          </button>
        </div>
      )}
    </>
  );
};
