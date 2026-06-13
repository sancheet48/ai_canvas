import { Router } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { encrypt, decrypt } from '../utils/crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// CLIENT ROOT URL for redirecting
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. GENERATE OAUTH URL OR REDIRECT
router.get('/oauth/:provider', verifyJWT, (req: AuthRequest, res) => {
  const { provider } = req.params;
  const userId = req.user!.id;

  // If environment variables are missing, redirect to the mock auth connector directly
  const useMock = 
    (provider === 'linkedin' && (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET)) ||
    (provider === 'twitter' && (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET)) ||
    req.query.mock === 'true';

  if (useMock) {
    // Generate a temporary mock auth code and redirect directly to callback
    return res.redirect(`/api/social/callback/${provider}?code=mock_code_user_${userId}`);
  }

  // Real OAuth redirect URLs (configured in developer portals)
  const redirectUri = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/social/callback/${provider}`;

  if (provider === 'linkedin') {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}&scope=w_member_social`;
    return res.redirect(authUrl);
  } else if (provider === 'twitter') {
    const clientId = process.env.TWITTER_CLIENT_ID;
    // Twitter API v2 uses PKCE or standard OAuth 2.0. We use a standard state parameter here.
    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${userId}&code_challenge=challenge&code_challenge_method=plain`;
    return res.redirect(authUrl);
  }

  return res.status(400).json({ error: 'Unsupported social provider' });
});

// 2. OAUTH CALLBACK RECEIVER
router.get('/callback/:provider', async (req, res) => {
  const { provider } = req.params;
  const code = req.query.code as string;
  const state = req.query.state as string; // Will contain userId in real OAuth flow

  // Parse userId
  let userId: number;
  if (code.startsWith('mock_code_user_')) {
    userId = parseInt(code.split('mock_code_user_')[1]);
  } else {
    userId = parseInt(state);
  }

  if (isNaN(userId)) {
    return res.status(400).send('OAuth callback failed: Invalid state parameter');
  }

  try {
    let accessToken = '';
    let refreshToken = '';
    let expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const isMock = code.startsWith('mock_code_user_');

    if (isMock) {
      accessToken = `mock_access_token_${provider}_${userId}`;
      refreshToken = `mock_refresh_token_${provider}_${userId}`;
    } else {
      // Swapping authorization code for real OAuth tokens
      const redirectUri = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/social/callback/${provider}`;
      
      if (provider === 'linkedin') {
        // Exchange code for LinkedIn token
        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: process.env.LINKEDIN_CLIENT_ID!,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!
          })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error_description || data.error);
        accessToken = data.access_token;
        expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      } else if (provider === 'twitter') {
        // Exchange code for Twitter token
        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(process.env.TWITTER_CLIENT_ID + ':' + process.env.TWITTER_CLIENT_SECRET).toString('base64')
          },
          body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code_verifier: 'challenge'
          })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error_description || data.error);
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      }
    }

    // Encrypt tokens before saving
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

    // Upsert social credentials in DB
    await db.query(
      `INSERT INTO social_tokens (user_id, provider, access_token_enc, refresh_token_enc, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider) DO UPDATE
       SET access_token_enc = EXCLUDED.access_token_enc,
           refresh_token_enc = EXCLUDED.refresh_token_enc,
           expires_at = EXCLUDED.expires_at`,
      [userId, provider, encryptedAccessToken, encryptedRefreshToken, expiresAt]
    );

    // Redirect user back to the board app settings page with success feedback
    return res.redirect(`${CLIENT_URL}/board?social_linked=${provider}`);

  } catch (err: any) {
    console.error(`OAuth callback error for ${provider}:`, err);
    return res.status(500).send(`OAuth callback swap error: ${err.message}`);
  }
});

// 3. GET CONNECTED PROVIDERS
router.get('/status', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const tokensRes = await db.query(
      'SELECT provider, expires_at FROM social_tokens WHERE user_id = $1',
      [userId]
    );
    // Maps list of active provider connections
    const connections = tokensRes.rows.map(row => ({
      provider: row.provider,
      connected: new Date(row.expires_at) > new Date()
    }));
    return res.status(200).json(connections);
  } catch (err) {
    console.error('Fetch social status failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve social status' });
  }
});

// 4. DISCONNECT PROVIDER
router.delete('/:provider', verifyJWT, async (req: AuthRequest, res) => {
  const { provider } = req.params;
  const userId = req.user!.id;
  try {
    await db.query(
      'DELETE FROM social_tokens WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );
    return res.status(200).json({ message: `Disconnected ${provider} successfully` });
  } catch (err) {
    console.error('Disconnect failed:', err);
    return res.status(500).json({ error: 'Failed to disconnect social provider' });
  }
});

// 5. POST TO LINKEDIN
router.post('/linkedin/publish', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { caption, imageUrl } = req.body;

  if (!caption) {
    return res.status(400).json({ error: 'Caption is required' });
  }

  try {
    // Get stored credentials
    const tokenRes = await db.query(
      "SELECT access_token_enc FROM social_tokens WHERE user_id = $1 AND provider = 'linkedin'",
      [userId]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(400).json({ error: 'LinkedIn is not linked. Please connect via social options first.' });
    }

    const encToken = tokenRes.rows[0].access_token_enc;
    const token = decrypt(encToken);

    const isMock = token.startsWith('mock_access_token_');

    if (isMock) {
      // Simulate API lag
      await new Promise(resolve => setTimeout(resolve, 800));
      return res.status(201).json({
        success: true,
        url: 'https://www.linkedin.com/feed/update/urn:li:share:mock-whiteboard-post'
      });
    }

    // Real LinkedIn UGC Share API invocation
    // Fetch profile ID first
    const profileRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    const urn = `urn:li:person:${profileData.id}`;

    // Post layout definition
    const postPayload = {
      author: urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'NONE' // Can map IMAGE if S3 imageUrl is valid
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const ugcPostRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postPayload)
    });

    const postData = await ugcPostRes.json();
    if (ugcPostRes.status >= 300) {
      throw new Error(postData.message || 'LinkedIn UGC API returned error status.');
    }

    return res.status(201).json({
      success: true,
      url: `https://www.linkedin.com/feed/update/${postData.id}`
    });

  } catch (err: any) {
    console.error('LinkedIn Publish Error:', err);
    return res.status(500).json({ error: `LinkedIn API error: ${err.message}` });
  }
});

// 6. POST TO TWITTER
router.post('/twitter/publish', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { tweets } = req.body; // Expects array of string texts for thread

  if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
    return res.status(400).json({ error: 'Thread tweets array is required' });
  }

  try {
    const tokenRes = await db.query(
      "SELECT access_token_enc FROM social_tokens WHERE user_id = $1 AND provider = 'twitter'",
      [userId]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(400).json({ error: 'Twitter/X is not connected. Please connect via settings first.' });
    }

    const encToken = tokenRes.rows[0].access_token_enc;
    const token = decrypt(encToken);

    const isMock = token.startsWith('mock_access_token_');

    if (isMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return res.status(201).json({
        success: true,
        urls: tweets.map((_, index) => `https://twitter.com/mockuser/status/thread-tweet-${index + 1}`)
      });
    }

    // Real Twitter/X Thread publishing loop
    let lastTweetId: string | null = null;
    const postedUrls: string[] = [];

    for (const tweetText of tweets) {
      const payload: any = { text: tweetText };
      if (lastTweetId) {
        payload.reply = { in_reply_to_tweet_id: lastTweetId };
      }

      const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const tweetData = await tweetRes.json();
      if (tweetRes.status >= 300) {
        throw new Error(tweetData.detail || 'Twitter API returned error state.');
      }

      lastTweetId = tweetData.data.id;
      postedUrls.push(`https://twitter.com/user/status/${lastTweetId}`);
    }

    return res.status(201).json({
      success: true,
      urls: postedUrls
    });

  } catch (err: any) {
    console.error('Twitter Thread Publish Error:', err);
    return res.status(500).json({ error: `Twitter API error: ${err.message}` });
  }
});

export default router;
