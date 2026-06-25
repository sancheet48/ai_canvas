import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { sendEmail } from '../utils/email';
import { privateKey, publicKey, getJwtAlgorithm } from '../utils/keys';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to hash tokens
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Token generation helpers
function generateAccessToken(user: { id: number; email: string; role: string; plan?: string }): string {
  const algorithm = getJwtAlgorithm();
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, plan: user.plan || 'free' },
    privateKey,
    { algorithm, expiresIn: '15m' }
  );
}

function generateRefreshToken(user: { id: number }): string {
  const algorithm = getJwtAlgorithm();
  return jwt.sign(
    { id: user.id },
    privateKey,
    { algorithm, expiresIn: '7d' }
  );
}

function generateEmailVerificationToken(email: string): string {
  const algorithm = getJwtAlgorithm();
  return jwt.sign(
    { email },
    privateKey,
    { algorithm, expiresIn: '24h' }
  );
}

// 1. REGISTER
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Check if user exists
    const userCheck = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (userCheck.rowCount && userCheck.rowCount > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Start a transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert user
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, role, verified)
         VALUES ($1, $2, 'user', false)
         RETURNING id, email, role, verified, created_at`,
        [email, passwordHash]
      );
      const user = userRes.rows[0];

      // Create subscription (default free)
      await client.query(
        `INSERT INTO subscriptions (user_id, plan, status)
         VALUES ($1, 'free', 'active')`,
        [user.id]
      );

      await client.query('COMMIT');

      // Send Verification Email
      const verifyToken = generateEmailVerificationToken(user.email);
      const host = process.env.CLIENT_URL || 'http://localhost:5173';
      const verifyLink = `${host}/verify-email?token=${verifyToken}`;
      
      await sendEmail({
        to: user.email,
        subject: 'Verify your whiteboard account email',
        text: `Please verify your email by clicking: ${verifyLink}`,
        html: `<p>Please verify your email by clicking: <a href="${verifyLink}">${verifyLink}</a></p>`
      });

      // Generate credentials
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Save refresh token to sessions
      const rfHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await db.query(
        `INSERT INTO sessions (user_id, refresh_token_hash, expires_at, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, rfHash, expiresAt, req.ip, req.headers['user-agent']]
      );

      // Set cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.status(201).json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          verified: user.verified,
          plan: 'free'
        }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRes = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.verified, u.suspended, COALESCE(s.plan, 'free') as plan
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.email = $1`,
      [email]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact administration.' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate credentials
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Save session
    const rfHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, rfHash, expiresAt, req.ip, req.headers['user-agent']]
    );

    // Set cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        verified: user.verified,
        plan: user.plan
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// 3. LOGOUT
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken) {
    try {
      const rfHash = hashToken(refreshToken);
      await db.query('DELETE FROM sessions WHERE refresh_token_hash = $1', [rfHash]);
    } catch (err) {
      console.error('Logout db query error:', err);
    }
  }

  res.clearCookie('refreshToken', {
    path: '/api/auth',
    httpOnly: true
  });
  return res.status(200).json({ message: 'Logged out successfully' });
});

// 4. REFRESH TOKEN
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const algorithm = getJwtAlgorithm();
    const decoded = jwt.verify(refreshToken, publicKey, { algorithms: [algorithm] }) as any;
    
    // Look up in database
    const rfHash = hashToken(refreshToken);
    const sessionRes = await db.query(
      `SELECT s.id, u.id as user_id, u.email, u.role, u.verified, COALESCE(sub.plan, 'free') as plan
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN subscriptions sub ON u.id = sub.user_id
       WHERE s.refresh_token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [rfHash]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const user = sessionRes.rows[0];
    const newAccessToken = generateAccessToken({
      id: user.user_id,
      email: user.email,
      role: user.role,
      plan: user.plan
    });

    return res.status(200).json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
});

// 5. FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const userRes = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      // Return 200 for security reasons (avoid enum of users)
      return res.status(200).json({ message: 'If the email exists, a reset link was sent' });
    }

    const user = userRes.rows[0];
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const host = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${host}/reset-password?token=${rawResetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your whiteboard password',
      text: `Reset your password here: ${resetLink}`,
      html: `<p>Reset your password here: <a href="${resetLink}">${resetLink}</a></p>`
    });

    return res.status(200).json({ message: 'If the email exists, a reset link was sent' });

  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 6. RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    const tHash = hashToken(token);
    const resetRes = await db.query(
      `SELECT id, user_id FROM password_resets 
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL`,
      [tHash]
    );

    if (resetRes.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const resetRequest = resetRes.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update password
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetRequest.user_id]);

      // Mark reset token as used
      await client.query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [resetRequest.id]);

      // Invalidate all active sessions for this user (force logout everywhere)
      await client.query('DELETE FROM sessions WHERE user_id = $1', [resetRequest.user_id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.status(200).json({ message: 'Password has been reset successfully' });

  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 7. VERIFY EMAIL
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const algorithm = getJwtAlgorithm();
    const decoded = jwt.verify(token, publicKey, { algorithms: [algorithm] }) as any;
    
    await db.query('UPDATE users SET verified = true WHERE email = $1', [decoded.email]);
    return res.status(200).json({ message: 'Email verified successfully!' });

  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }
});

export default router;
