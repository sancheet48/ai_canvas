import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { verifyJWT, requireAdmin, AuthRequest } from '../middleware/auth';
import { errorHistory } from '../utils/logger';
import { getActiveSocketConnectionsCount } from '../socket';

const router = Router();

// Apply auth + admin protections to all admin routes
router.use(verifyJWT, requireAdmin);

// 1. GET SYSTEM HEALTH & METRICS DIAGNOSTICS
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    // DB query latency
    const dbLatency = db.getAverageLatency();

    // Connected websocket client count
    const wsClientsCount = getActiveSocketConnectionsCount();

    // Tail log of last 50 errors
    const errorsTail = errorHistory;

    // Summaries
    const userCountRes = await db.query('SELECT COUNT(*) as count FROM users');
    const boardCountRes = await db.query("SELECT COUNT(*) as count FROM boards WHERE visibility = 'public'");
    const tokenUsageRes = await db.query('SELECT SUM(input_tokens) as input, SUM(output_tokens) as output FROM ai_usage');
    
    // AI provider token summary breakdown
    const providerBreakdownRes = await db.query(
      `SELECT provider, SUM(input_tokens + output_tokens) as total_tokens, COUNT(*) as calls_count
       FROM ai_usage
       GROUP BY provider`
    );

    return res.status(200).json({
      dbLatency,
      wsClientsCount,
      errorsTail,
      counts: {
        totalUsers: parseInt(userCountRes.rows[0].count),
        publicBoards: parseInt(boardCountRes.rows[0].count),
        totalTokens: {
          input: parseInt(tokenUsageRes.rows[0].input || '0'),
          output: parseInt(tokenUsageRes.rows[0].output || '0')
        }
      },
      providerBreakdown: providerBreakdownRes.rows
    });

  } catch (err) {
    console.error('Admin stats fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve health metrics' });
  }
});

// 2. GET USERS LIST (Search, filter, paginate)
router.get('/users', async (req: AuthRequest, res) => {
  const search = (req.query.search as string) || '';
  const planFilter = (req.query.plan as string) || ''; // 'free', 'pro', 'team'
  const suspendedFilter = req.query.suspended as string; // 'true', 'false'
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let queryStr = `
      SELECT u.id, u.email, u.verified, u.suspended, u.role, u.created_at, u.last_login,
             COALESCE(s.plan, 'free') as plan, COALESCE(s.status, 'active') as plan_status,
             (SELECT COUNT(*) FROM boards WHERE owner_id = u.id) as board_count
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIndex = 1;

    if (search) {
      queryStr += ` AND u.email ILIKE $${pIndex++}`;
      params.push(`%${search}%`);
    }

    if (planFilter) {
      queryStr += ` AND s.plan = $${pIndex++}`;
      params.push(planFilter);
    }

    if (suspendedFilter !== undefined && suspendedFilter !== '') {
      queryStr += ` AND u.suspended = $${pIndex++}`;
      params.push(suspendedFilter === 'true');
    }

    queryStr += ` ORDER BY u.created_at DESC LIMIT $${pIndex++} OFFSET $${pIndex++}`;
    params.push(limit, offset);

    const usersRes = await db.query(queryStr, params);
    return res.status(200).json(usersRes.rows);

  } catch (err) {
    console.error('Fetch admin users failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// 3. SUSPEND / UNSUSPEND USER
router.post('/users/:id/suspend', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { suspend } = req.body; // boolean

  try {
    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userCheck.rows[0].role === 'admin' && suspend) {
      return res.status(400).json({ error: 'Cannot suspend an administrative user account.' });
    }

    await db.query('UPDATE users SET suspended = $1 WHERE id = $2', [suspend === true, id]);
    
    // Invalidate user sessions if suspending them
    if (suspend === true) {
      await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user!.id, suspend ? 'SUSPEND_USER' : 'UNSUSPEND_USER', JSON.stringify({ targetUserId: id })]
    );

    return res.status(200).json({ message: `User account has been ${suspend ? 'suspended' : 'unsuspended'} successfully` });

  } catch (err) {
    console.error('Suspend user failed:', err);
    return res.status(500).json({ error: 'Failed to toggle user suspension' });
  }
});

// 4. FORCE PASSWORD RESET LINK GENERATOR
router.post('/users/:id/force-reset', async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const userRes = await db.query('SELECT email FROM users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [id, tokenHash, expiresAt]
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const forceResetLink = `${clientUrl}/reset-password?token=${rawToken}`;

    // Log admin action
    await db.query(
      `INSERT INTO admin_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user!.id, 'FORCE_PASSWORD_RESET', JSON.stringify({ targetUserId: id })]
    );

    return res.status(200).json({
      message: 'Generated password recovery code successfully.',
      resetLink: forceResetLink
    });

  } catch (err) {
    console.error('Force password reset generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate reset link' });
  }
});

// 5. VIEW PASSWORD RESET ATTEMPTS AUDIT LOG
router.get('/users/:id/reset-attempts', async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const resetLogs = await db.query(
      `SELECT id, expires_at, used_at, (expires_at > CURRENT_TIMESTAMP) as active
       FROM password_resets
       WHERE user_id = $1
       ORDER BY expires_at DESC
       LIMIT 5`,
      [id]
    );
    return res.status(200).json(resetLogs.rows);
  } catch (err) {
    console.error('Fetch reset audits failed:', err);
    return res.status(500).json({ error: 'Failed to load password reset logs' });
  }
});

// 6. FORCE TERMINATE ALL SESSIONS
router.post('/users/:id/invalidate-sessions', async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    
    // Log admin action
    await db.query(
      `INSERT INTO admin_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user!.id, 'INVALIDATE_SESSIONS', JSON.stringify({ targetUserId: id })]
    );

    return res.status(200).json({ message: 'All active sessions terminated successfully' });
  } catch (err) {
    console.error('Session invalidation failed:', err);
    return res.status(500).json({ error: 'Failed to invalidate active sessions' });
  }
});

// 7. SUBSCRIPTION MANAGEMENT OVERRIDES
router.patch('/subscriptions/:userId', async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { plan } = req.body; // 'free' | 'pro' | 'team'

  if (!['free', 'pro', 'team'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan choice' });
  }

  try {
    const periodEnd = plan === 'free' ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year override
    
    await db.query(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (user_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = 'active',
           current_period_end = EXCLUDED.current_period_end`,
      [userId, 'admin_override', 'admin_override', plan, periodEnd]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user!.id, 'OVERRIDE_SUBSCRIPTION', JSON.stringify({ targetUserId: userId, plan })]
    );

    return res.status(200).json({ message: `Subscription overridden to plan ${plan}` });

  } catch (err) {
    console.error('Subscription override failed:', err);
    return res.status(500).json({ error: 'Failed to modify subscription tier' });
  }
});

// 8. CONTENT MODERATION - FETCH PUBLIC BOARDS
router.get('/boards', async (req: AuthRequest, res) => {
  try {
    const boards = await db.query(
      `SELECT b.id, b.title, b.owner_id, b.view_count, b.fork_count, b.created_at, u.email as owner_email
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       WHERE b.visibility = 'public'
       ORDER BY b.created_at DESC`
    );
    return res.status(200).json(boards.rows);
  } catch (err) {
    console.error('Fetch admin boards failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve public board listings' });
  }
});

// 9. DELETE USER ACCOUNT (ADMIN ACTION)
router.delete('/users/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userCheck.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin account.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    // Log admin action
    await db.query(
      `INSERT INTO admin_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user!.id, 'DELETE_USER', JSON.stringify({ targetUserId: id })]
    );

    return res.status(200).json({ message: 'User account and all related boards deleted successfully' });

  } catch (err) {
    console.error('Admin delete user failed:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
