const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('@eliza/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'eliza-dashboard-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// POST /api/auth/migrate — run migration 011 (add auth columns + set CEO password)
router.post('/migrate', async (req, res) => {
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_permissions JSONB DEFAULT '{}'`);

    // Set CEO permissions
    await query(`UPDATE users SET dashboard_permissions = '{"war_room":true,"expo_directory":true,"expo_detail":true,"sales":true,"logs":true,"intelligence":true,"system":true,"users":true,"settings":true}'::jsonb WHERE role = 'ceo' AND (dashboard_permissions IS NULL OR dashboard_permissions = '{}'::jsonb)`);
    // Set manager permissions
    await query(`UPDATE users SET dashboard_permissions = '{"war_room":true,"expo_directory":true,"expo_detail":true,"sales":true,"logs":false,"intelligence":false,"system":false,"users":false,"settings":false}'::jsonb WHERE role = 'manager' AND (dashboard_permissions IS NULL OR dashboard_permissions = '{}'::jsonb)`);
    // Set agent permissions
    await query(`UPDATE users SET dashboard_permissions = '{"war_room":false,"expo_directory":false,"expo_detail":false,"sales":true,"logs":false,"intelligence":false,"system":false,"users":false,"settings":false}'::jsonb WHERE role = 'agent' AND (dashboard_permissions IS NULL OR dashboard_permissions = '{}'::jsonb)`);

    res.json({ success: true, message: 'Migration 011 applied' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/phone and password required' });
    }

    // Find user by email or phone
    const result = await query(
      `SELECT u.*, up.data_scope, up.visible_years,
              up.can_see_expenses, up.can_take_notes,
              up.can_use_message_generator, up.can_see_financials
       FROM users u
       LEFT JOIN user_permissions up ON up.user_id = u.id
       WHERE (LOWER(u.email) = LOWER($1) OR u.whatsapp_phone = $1)
         AND u.is_active = true`,
      [identifier.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Password not set. Contact admin.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last_login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate token (30 days for "remember me", 24h default)
    const remember = req.body.remember || false;
    const expiresIn = remember ? '30d' : '24h';
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        office: user.office,
        dashboard_permissions: user.dashboard_permissions || {},
        data_scope: user.data_scope,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.office, u.dashboard_permissions,
              up.data_scope, up.visible_years
       FROM users u
       LEFT JOIN user_permissions up ON up.user_id = u.id
       WHERE u.id = $1 AND u.is_active = true`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ error: 'Both old and new password required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, payload.userId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/set-password (admin only — set password for any user)
router.post('/set-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Only CEO can set passwords for others
    if (payload.role !== 'ceo') {
      return res.status(403).json({ error: 'Only CEO can set passwords' });
    }

    const { user_id, password } = req.body;
    if (!user_id || !password) {
      return res.status(400).json({ error: 'user_id and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user_id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/init-password (first-time password setup — only works if password_hash is NULL)
router.post('/init-password', async (req, res) => {
  try {
    const { identifier, new_password } = req.body;
    if (!identifier || !new_password) {
      return res.status(400).json({ error: 'identifier and new_password required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find user with NULL password_hash
    const result = await query(
      `SELECT id, name, email FROM users
       WHERE (LOWER(email) = LOWER($1) OR whatsapp_phone = $1)
         AND is_active = true
         AND password_hash IS NULL`,
      [identifier.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No user found or password already set' });
    }

    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, result.rows[0].id]);

    res.json({ success: true, user: result.rows[0].name });
  } catch (err) {
    console.error('Init password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
