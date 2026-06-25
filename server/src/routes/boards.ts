import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { verifyJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Extend AuthRequest to make TS comfortable with optional verification
interface MaybeAuthRequest extends AuthRequest {}

// 1. CREATE BOARD
router.post('/', verifyJWT, async (req: AuthRequest, res) => {
  const { title, description, data, visibility, allowComments, allowFork } = req.body;
  const ownerId = req.user!.id;

  try {
    const boardRes = await db.query(
      `INSERT INTO boards (owner_id, title, description, data, visibility, allow_comments, allow_fork)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        ownerId,
        title || 'Untitled Board',
        description || '',
        JSON.stringify(data || []),
        visibility || 'private',
        allowComments !== false,
        allowFork !== false
      ]
    );
    const board = boardRes.rows[0];

    // Add owner as editor member
    await db.query(
      `INSERT INTO board_members (board_id, user_id, role)
       VALUES ($1, $2, 'editor')`,
      [board.id, ownerId]
    );

    return res.status(201).json(board);
  } catch (err) {
    console.error('Create board error:', err);
    return res.status(500).json({ error: 'Failed to create board' });
  }
});

// 2. GET USER'S BOARDS (Owned or joined)
router.get('/', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    const boardsRes = await db.query(
      `SELECT DISTINCT b.*, u.email as owner_email
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE b.owner_id = $1 OR bm.user_id = $1
       ORDER BY b.updated_at DESC`,
      [userId]
    );

    return res.status(200).json(boardsRes.rows);
  } catch (err) {
    console.error('Fetch boards error:', err);
    return res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// 3. GET PUBLIC EXPLORE BOARDS
router.get('/public', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 12;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const boardsRes = await db.query(
      `SELECT b.id, b.title, b.description, b.thumbnail_url, b.view_count, b.fork_count, b.created_at, b.updated_at, u.email as owner_email
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       WHERE b.visibility = 'public'
       ORDER BY b.view_count DESC, b.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.status(200).json(boardsRes.rows);
  } catch (err) {
    console.error('Fetch public boards error:', err);
    return res.status(500).json({ error: 'Failed to fetch public boards' });
  }
});

// 4. GET SHARED BOARD BY TOKEN (Link-only sharing, no auth required)
router.get('/shared/:shareToken', async (req, res) => {
  const { shareToken } = req.params;

  try {
    const boardRes = await db.query(
      `SELECT b.*, u.email as owner_email
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       WHERE b.share_token = $1 AND b.visibility = 'link-only'`,
      [shareToken]
    );

    if (boardRes.rowCount === 0) {
      // Also try to see if it matches UUID id (if public)
      const boardResById = await db.query(
        `SELECT b.*, u.email as owner_email
         FROM boards b
         JOIN users u ON b.owner_id = u.id
         WHERE b.id = $1 AND b.visibility = 'public'`,
        [shareToken]
      );
      
      if (boardResById.rowCount === 0) {
        return res.status(404).json({ error: 'Board not found or access denied' });
      }
      
      // Increment view count
      await db.query('UPDATE boards SET view_count = view_count + 1 WHERE id = $1', [boardResById.rows[0].id]);
      return res.status(200).json(boardResById.rows[0]);
    }

    // Increment view count
    await db.query('UPDATE boards SET view_count = view_count + 1 WHERE share_token = $1', [shareToken]);
    return res.status(200).json(boardRes.rows[0]);
  } catch (err) {
    console.error('Fetch shared board error:', err);
    return res.status(500).json({ error: 'Failed to load shared board' });
  }
});

// 5. GET BOARD BY ID (Requires check permissions)
// We use a custom parser to extract authorization headers if they exist, but don't force them if the board is public/link-only
router.get('/:id', async (req: MaybeAuthRequest, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  let userId: number | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token) as any;
      if (decoded) userId = decoded.id;
    } catch (_) {}
  }

  try {
    const boardRes = await db.query(
      `SELECT b.*, u.email as owner_email
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       WHERE b.id = $1`,
      [id]
    );

    if (boardRes.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const board = boardRes.rows[0];

    // Access authorization check
    if (board.visibility === 'private') {
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required for private board' });
      }
      // Check if user is owner or collaborator
      const memberRes = await db.query(
        'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
        [id, userId]
      );
      if (board.owner_id !== userId && memberRes.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Increment view count
    await db.query('UPDATE boards SET view_count = view_count + 1 WHERE id = $1', [id]);
    board.view_count += 1;

    return res.status(200).json(board);
  } catch (err) {
    console.error('Fetch board by ID error:', err);
    return res.status(500).json({ error: 'Failed to load board' });
  }
});

// 6. UPDATE BOARD (Title, Data, etc.)
router.patch('/:id', verifyJWT, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { title, description, data, thumbnail_url, allowComments, allowFork } = req.body;
  const userId = req.user!.id;

  try {
    // Verify editing privileges (Owner or editor collaborator)
    const boardCheck = await db.query(
      'SELECT owner_id FROM boards WHERE id = $1',
      [id]
    );

    if (boardCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const board = boardCheck.rows[0];
    const memberCheck = await db.query(
      "SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2 AND role = 'editor'",
      [id, userId]
    );

    if (board.owner_id !== userId && memberCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Permission denied: Editor role required' });
    }

    // Dynamic fields updates
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (data !== undefined) {
      updates.push(`data = $${paramIndex++}`);
      values.push(JSON.stringify(data));
    }
    if (thumbnail_url !== undefined) {
      updates.push(`thumbnail_url = $${paramIndex++}`);
      values.push(thumbnail_url);
    }
    if (allowComments !== undefined) {
      updates.push(`allow_comments = $${paramIndex++}`);
      values.push(allowComments);
    }
    if (allowFork !== undefined) {
      updates.push(`allow_fork = $${paramIndex++}`);
      values.push(allowFork);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id); // Target parameter

    const updateQuery = `
      UPDATE boards 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;

    const updatedRes = await db.query(updateQuery, values);
    return res.status(200).json(updatedRes.rows[0]);

  } catch (err) {
    console.error('Update board error:', err);
    return res.status(500).json({ error: 'Failed to update board' });
  }
});

// 7. PATCH VISIBILITY
router.patch('/:id/visibility', verifyJWT, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { visibility } = req.body;
  const userId = req.user!.id;

  if (!['private', 'public', 'link-only'].includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility value' });
  }

  try {
    const boardCheck = await db.query('SELECT owner_id FROM boards WHERE id = $1', [id]);
    if (boardCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (boardCheck.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Permission denied: Only board owner can change visibility' });
    }

    // Regenerate share token if visibility changes
    const updatedRes = await db.query(
      `UPDATE boards 
       SET visibility = $1, share_token = gen_random_uuid(), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [visibility, id]
    );

    return res.status(200).json(updatedRes.rows[0]);
  } catch (err) {
    console.error('Update visibility error:', err);
    return res.status(500).json({ error: 'Failed to update board visibility' });
  }
});

// 8. FORK BOARD (Clones layout to user's canvas collection)
router.post('/:id/fork', verifyJWT, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const boardRes = await db.query('SELECT * FROM boards WHERE id = $1', [id]);
    if (boardRes.rowCount === 0) {
      return res.status(404).json({ error: 'Source board not found' });
    }

    const srcBoard = boardRes.rows[0];

    // Confirm fork permission
    if (!srcBoard.allow_fork && srcBoard.owner_id !== userId) {
      return res.status(403).json({ error: 'Forking is disabled by owner for this board' });
    }

    // Check read access
    if (srcBoard.visibility === 'private') {
      const memberRes = await db.query(
        'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
        [id, userId]
      );
      if (srcBoard.owner_id !== userId && memberRes.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied: Private board' });
      }
    }

    // Create cloned board
    const forkRes = await db.query(
      `INSERT INTO boards (owner_id, title, data, visibility, allow_comments, allow_fork)
       VALUES ($1, $2, $3, 'private', true, true)
       RETURNING *`,
      [
        userId,
        `Clone of ${srcBoard.title}`,
        srcBoard.data, // Copy JSONB
      ]
    );
    const forkedBoard = forkRes.rows[0];

    // Add owner member entry
    await db.query(
      `INSERT INTO board_members (board_id, user_id, role)
       VALUES ($1, $2, 'editor')`,
      [forkedBoard.id, userId]
    );

    // Increment original board fork count
    await db.query('UPDATE boards SET fork_count = fork_count + 1 WHERE id = $1', [id]);

    return res.status(201).json(forkedBoard);

  } catch (err) {
    console.error('Fork board error:', err);
    return res.status(500).json({ error: 'Failed to fork board' });
  }
});

// 9. DELETE BOARD
router.delete('/:id', verifyJWT, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const boardCheck = await db.query('SELECT owner_id FROM boards WHERE id = $1', [id]);
    if (boardCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (boardCheck.rows[0].owner_id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied: Only board owner or admin can delete' });
    }

    await db.query('DELETE FROM boards WHERE id = $1', [id]);
    return res.status(200).json({ message: 'Board deleted successfully' });
  } catch (err) {
    console.error('Delete board error:', err);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
});

export default router;
