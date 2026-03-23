const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('@eliza/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'eliza-dashboard-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// POST /api/auth/migrate — run all pending migrations
router.post('/migrate', async (req, res) => {
  try {
    // Migration 011: auth columns
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_permissions JSONB DEFAULT '{}'`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'`);

    // Set CEO permissions (all access)
    await query(`UPDATE users SET dashboard_permissions = '{"war_room":true,"expo_directory":true,"expo_detail":true,"sales":true,"finance":true,"logs":true,"intelligence":true,"system":true,"users":true,"settings":true}'::jsonb WHERE role = 'ceo' AND (dashboard_permissions IS NULL OR dashboard_permissions = '{}'::jsonb)`);
    // Set manager permissions
    await query(`UPDATE users SET dashboard_permissions = '{"war_room":true,"expo_directory":true,"expo_detail":true,"sales":true,"finance":true,"logs":false,"intelligence":false,"system":false,"users":false,"settings":true}'::jsonb WHERE role = 'manager' AND (dashboard_permissions IS NULL OR dashboard_permissions = '{}'::jsonb)`);
    // Set agent permissions
    await query(`UPDATE users SET dashboard_permissions = '{"war_room":false,"expo_directory":false,"expo_detail":false,"sales":true,"finance":false,"logs":false,"intelligence":false,"system":false,"users":false,"settings":true}'::jsonb WHERE role = 'agent' AND (dashboard_permissions IS NULL OR dashboard_permissions = '{}'::jsonb)`);

    // Migration 013: payment fields + tables + view
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS balance_eur DECIMAL(12,2)`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS paid_eur DECIMAL(12,2)`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS remaining_payment_eur DECIMAL(12,2)`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS due_date DATE`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_done BOOLEAN`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_method TEXT`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS validity TEXT`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS first_payment_eur DECIMAL(12,2)`);
    await query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS second_payment_eur DECIMAL(12,2)`);

    await query(`CREATE TABLE IF NOT EXISTS contract_payments (
      id SERIAL PRIMARY KEY,
      contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      af_number TEXT NOT NULL,
      payment_date DATE,
      amount_eur DECIMAL(12,2),
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_contract_payments_contract_id ON contract_payments(contract_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_contract_payments_af_number ON contract_payments(af_number)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_contract_payments_payment_date ON contract_payments(payment_date)`);

    await query(`CREATE TABLE IF NOT EXISTS contract_payment_schedule (
      id SERIAL PRIMARY KEY,
      contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      af_number TEXT NOT NULL,
      installment_no INT,
      due_date DATE,
      planned_amount_eur DECIMAL(12,2),
      payment_type TEXT,
      note TEXT,
      source_field TEXT,
      is_synthetic BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_contract_payment_schedule_contract_id ON contract_payment_schedule(contract_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_contract_payment_schedule_af_number ON contract_payment_schedule(af_number)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_contract_payment_schedule_due_date ON contract_payment_schedule(due_date)`);

    // outstanding_balances view
    await query(`CREATE OR REPLACE VIEW outstanding_balances AS
      SELECT
        c.id, c.af_number, c.company_name, c.country,
        c.sales_agent, c.sales_type,
        e.name AS expo_name, e.country AS expo_country,
        e.start_date AS expo_start_date,
        c.contract_date,
        c.revenue_eur AS contract_total_eur,
        COALESCE(c.paid_eur, 0) AS paid_eur,
        COALESCE(c.balance_eur, c.revenue_eur - COALESCE(c.paid_eur, 0)) AS balance_eur,
        c.due_date,
        c.payment_done,
        CASE WHEN c.due_date < CURRENT_DATE AND COALESCE(c.balance_eur, 0) > 0 THEN true ELSE false END AS is_overdue,
        CASE WHEN c.due_date IS NOT NULL THEN GREATEST(c.due_date - CURRENT_DATE, 0) ELSE NULL END AS days_to_due,
        CASE WHEN c.due_date < CURRENT_DATE THEN CURRENT_DATE - c.due_date ELSE 0 END AS days_overdue,
        CASE WHEN e.start_date IS NOT NULL THEN GREATEST(e.start_date::date - CURRENT_DATE, 0) ELSE NULL END AS days_to_expo,
        CASE WHEN c.revenue_eur > 0 THEN ROUND((COALESCE(c.paid_eur, 0) / c.revenue_eur * 100)::numeric, 1) ELSE 0 END AS paid_percent,
        (SELECT MIN(cp.payment_date) FROM contract_payments cp WHERE cp.contract_id = c.id) AS first_payment_date,
        (SELECT MAX(cp.payment_date) FROM contract_payments cp WHERE cp.contract_id = c.id) AS last_payment_date,
        CASE
          WHEN c.payment_done = true THEN 'paid_complete'
          WHEN COALESCE(c.paid_eur, 0) = 0 AND EXISTS (
            SELECT 1 FROM contract_payment_schedule cps
            WHERE cps.contract_id = c.id AND cps.payment_type = 'deposit'
              AND cps.due_date < CURRENT_DATE
          ) THEN 'deposit_missing'
          WHEN COALESCE(c.paid_eur, 0) = 0 THEN 'no_payment'
          WHEN c.due_date < CURRENT_DATE AND COALESCE(c.balance_eur, 0) > 0 THEN 'overdue'
          WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 45 AND COALESCE(c.balance_eur, 0) > 0 THEN 'pre_event_balance_open'
          WHEN COALESCE(c.paid_eur, 0) > 0 AND COALESCE(c.balance_eur, 0) > 0 THEN 'partial_paid'
          ELSE 'ok'
        END AS collection_stage,
        (
          CASE WHEN COALESCE(c.paid_eur, 0) = 0 THEN 3 ELSE 0 END +
          CASE WHEN c.due_date < CURRENT_DATE THEN LEAST((CURRENT_DATE - c.due_date) / 15, 4) ELSE 0 END +
          CASE WHEN COALESCE(c.balance_eur, 0) > 10000 THEN 2 WHEN COALESCE(c.balance_eur, 0) > 5000 THEN 1 ELSE 0 END
        ) AS collection_risk_score,
        (
          CASE WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 30 THEN 4
               WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 60 THEN 3
               WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 90 THEN 2
               ELSE 0 END +
          CASE WHEN c.revenue_eur > 20000 THEN 2 WHEN c.revenue_eur > 10000 THEN 1 ELSE 0 END
        ) AS event_risk_score
      FROM contracts c
      JOIN expos e ON c.expo_id = e.id
      WHERE c.status IN ('Valid', 'Transferred In')
        AND COALESCE(c.balance_eur, 0) > 0
        AND c.payment_done IS NOT TRUE`);

    // Ensure CEO has finance permission (added in Sprint 1B)
    await query(`UPDATE users SET dashboard_permissions = dashboard_permissions || '{"finance":true}'::jsonb WHERE role = 'ceo'`);
    await query(`UPDATE users SET dashboard_permissions = dashboard_permissions || '{"finance":true}'::jsonb WHERE role = 'manager' AND dashboard_permissions IS NOT NULL AND dashboard_permissions != '{}'::jsonb`);

    // Migration 016: payment currency columns
    await query(`ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS amount_local DECIMAL(12,2)`);
    await query(`ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EUR'`);

    // Migration 017: push messages
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_settings JSONB DEFAULT '{}'`);
    await query(`UPDATE users SET push_settings = '{"morning_brief":{"enabled":true,"time":"08:00"},"midday_pulse":{"enabled":true,"time":"13:00"},"daily_wrap":{"enabled":true,"time":"16:00"},"weekly_report":{"enabled":true,"time":"08:00"},"weekly_close":{"enabled":true,"time":"16:00"},"scope":"all"}'::jsonb WHERE role = 'ceo' AND (push_settings IS NULL OR push_settings = '{}'::jsonb)`);
    await query(`CREATE TABLE IF NOT EXISTS push_log (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      push_type TEXT NOT NULL,
      message_text TEXT,
      sent_via TEXT DEFAULT 'log',
      status TEXT DEFAULT 'sent',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_push_log_user_id ON push_log(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_push_log_type_date ON push_log(push_type, created_at)`);

    // Migration 018: user country + timezone
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_country VARCHAR(50) DEFAULT 'Turkey'`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Istanbul'`);
    await query(`UPDATE users SET user_country = 'Turkey', timezone = 'Europe/Istanbul' WHERE user_country IS NULL`);

    // Migration 019: target system
    await query(`CREATE TABLE IF NOT EXISTS expo_clusters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      city VARCHAR(100),
      country VARCHAR(100),
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await query(`ALTER TABLE expos ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES expo_clusters(id)`);
    await query(`CREATE TABLE IF NOT EXISTS expo_targets (
      id SERIAL PRIMARY KEY,
      expo_id INTEGER REFERENCES expos(id) UNIQUE,
      target_m2 DECIMAL(10,2),
      target_revenue DECIMAL(12,2),
      source VARCHAR(20) DEFAULT 'auto',
      auto_base_expo_id INTEGER,
      auto_percentage DECIMAL(5,2) DEFAULT 15.0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expo_targets_expo ON expo_targets(expo_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expos_cluster ON expos(cluster_id)`);

    // Add targets permission to CEO + manager
    await query(`UPDATE users SET dashboard_permissions = dashboard_permissions || '{"targets":true}'::jsonb WHERE role = 'ceo'`);
    await query(`UPDATE users SET dashboard_permissions = dashboard_permissions || '{"targets":true}'::jsonb WHERE role = 'manager' AND dashboard_permissions IS NOT NULL AND dashboard_permissions != '{}'::jsonb`);

    res.json({ success: true, message: 'Migrations 011-019 applied' });
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
      `SELECT u.*, u.settings, up.data_scope, up.visible_years,
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
        settings: user.settings || {},
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
      `SELECT u.id, u.name, u.email, u.role, u.office, u.dashboard_permissions, u.settings,
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

// PUT /api/auth/settings — update current user's settings
router.put('/settings', async (req, res) => {
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

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object required' });
    }

    // Whitelist allowed keys
    const allowed = ['theme', 'accent_color', 'table_density', 'language', 'timezone'];
    const clean = {};
    for (const key of allowed) {
      if (settings[key] !== undefined) clean[key] = settings[key];
    }

    // Merge with existing settings
    await query(
      `UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify(clean), payload.userId]
    );

    const result = await query('SELECT settings FROM users WHERE id = $1', [payload.userId]);
    res.json({ success: true, settings: result.rows[0]?.settings || {} });
  } catch (err) {
    console.error('Update settings error:', err);
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
