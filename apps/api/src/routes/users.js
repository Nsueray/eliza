const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');
const { COUNTRY_TIMEZONES } = require('../../../../packages/push/index.js');

const ALL_PERMISSIONS = {
  war_room: true, expo_directory: true, expo_detail: true, sales: true, finance: true,
  targets: true, logs: true, intelligence: true, system: true, users: true, settings: true,
};

const ROLE_DEFAULTS = {
  ceo: ALL_PERMISSIONS,
  manager: {
    war_room: true, expo_directory: true, expo_detail: true, sales: true, finance: true,
    targets: true, logs: false, intelligence: false, system: false, users: false, settings: true,
  },
  agent: {
    war_room: false, expo_directory: false, expo_detail: false, sales: true, finance: false,
    targets: false, logs: false, intelligence: false, system: false, users: false, settings: true,
  },
};

function resolvePermissions(role, incoming) {
  if (role === 'ceo') return ALL_PERMISSIONS;
  if (incoming && typeof incoming === 'object' && Object.keys(incoming).length > 0) return incoming;
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.agent;
}

// Config: dropdown values for admin panel
router.get('/config', (req, res) => {
  res.json({
    roles: ['ceo', 'manager', 'agent'],
    offices: ['International', 'Morocco Office', 'Nigeria Office', 'Kenya Office', 'China Office', 'Algeria Office'],
    sales_groups: ['International', 'Morocco Office', 'Nigeria Office', 'Kenya Office', 'China Office', 'Algeria Office'],
    years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    languages: ['tr', 'en', 'fr'],
    countries: Object.keys(COUNTRY_TIMEZONES).sort(),
  });
});

// List all users (active first)
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.*, u.push_settings, up.data_scope, up.visible_years,
             up.can_see_expenses, up.can_take_notes,
             up.can_use_message_generator, up.can_see_financials
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      ORDER BY u.is_active DESC, u.role ASC, u.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.*, u.push_settings, up.data_scope, up.visible_years,
             up.can_see_expenses, up.can_take_notes,
             up.can_use_message_generator, up.can_see_financials
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const {
      name, email, whatsapp_phone, role, office, sales_group,
      sales_agent_name, is_manager, language, nicknames,
      data_scope, visible_years,
      can_see_expenses, can_take_notes, can_use_message_generator, can_see_financials,
      dashboard_permissions, user_country,
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    // Business rule: CEO always gets 'all' scope
    const effectiveScope = role === 'ceo' ? 'all'
      : data_scope || (role === 'manager' ? 'team' : 'own');

    const perms = resolvePermissions(role, dashboard_permissions);

    // Auto-resolve timezone from country
    const country = user_country || 'Turkey';
    const timezone = COUNTRY_TIMEZONES[country] || 'Europe/Istanbul';

    const userResult = await query(`
      INSERT INTO users (name, email, whatsapp_phone, role, office, sales_group, sales_agent_name, is_manager, language, nicknames, dashboard_permissions, user_country, timezone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [name, email || null, whatsapp_phone || null, role, office || null, sales_group || null, sales_agent_name || null, is_manager || false, language || 'tr', nicknames || null, JSON.stringify(perms), country, timezone]);

    const user = userResult.rows[0];

    await query(`
      INSERT INTO user_permissions (user_id, data_scope, visible_years, can_see_expenses, can_take_notes, can_use_message_generator, can_see_financials)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      user.id,
      effectiveScope,
      visible_years || [2025, 2026],
      can_see_expenses || false,
      can_take_notes || false,
      can_use_message_generator || false,
      can_see_financials || false,
    ]);

    // Return full user with permissions
    const full = await query(`
      SELECT u.*, u.push_settings, up.data_scope, up.visible_years,
             up.can_see_expenses, up.can_take_notes,
             up.can_use_message_generator, up.can_see_financials
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = $1
    `, [user.id]);

    res.status(201).json(full.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'WhatsApp phone number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const {
      name, email, whatsapp_phone, role, office, sales_group,
      sales_agent_name, is_manager, language, is_active, nicknames,
      data_scope, visible_years,
      can_see_expenses, can_take_notes, can_use_message_generator, can_see_financials,
      password_hash, dashboard_permissions, push_settings, user_country,
    } = req.body;

    // Business rule: CEO always gets 'all' scope
    const effectiveScope = role === 'ceo' ? 'all'
      : data_scope || (role === 'manager' ? 'team' : 'own');

    const perms = resolvePermissions(role, dashboard_permissions);

    // Auto-resolve timezone from country
    const country = user_country || null;
    const timezone = country ? (COUNTRY_TIMEZONES[country] || 'Europe/Istanbul') : null;

    await query(`
      UPDATE users SET
        name = COALESCE($1, name),
        email = $2,
        whatsapp_phone = $3,
        role = COALESCE($4, role),
        office = $5,
        sales_group = $6,
        sales_agent_name = $7,
        is_manager = COALESCE($8, is_manager),
        language = COALESCE($9, language),
        is_active = COALESCE($10, is_active),
        nicknames = $11,
        password_hash = COALESCE($13, password_hash),
        dashboard_permissions = $14,
        push_settings = COALESCE($15, push_settings),
        user_country = COALESCE($16, user_country),
        timezone = COALESCE($17, timezone)
      WHERE id = $12
    `, [name, email || null, whatsapp_phone || null, role, office || null, sales_group || null, sales_agent_name || null, is_manager, language, is_active, nicknames || null, req.params.id, password_hash || null, JSON.stringify(perms), push_settings ? JSON.stringify(push_settings) : null, country, timezone]);

    await query(`
      UPDATE user_permissions SET
        data_scope = $1,
        visible_years = $2,
        can_see_expenses = $3,
        can_take_notes = $4,
        can_use_message_generator = $5,
        can_see_financials = $6
      WHERE user_id = $7
    `, [effectiveScope, visible_years || [2025, 2026], can_see_expenses || false, can_take_notes || false, can_use_message_generator || false, can_see_financials || false, req.params.id]);

    // Return updated user
    const full = await query(`
      SELECT u.*, u.push_settings, up.data_scope, up.visible_years,
             up.can_see_expenses, up.can_take_notes,
             up.can_use_message_generator, up.can_see_financials
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = $1
    `, [req.params.id]);

    if (full.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(full.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'WhatsApp phone number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Set password
router.post('/:id/set-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name',
      [hash, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: `Password set for ${result.rows[0].name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete (deactivate)
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE users SET is_active = false WHERE id = $1 RETURNING id, name
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: `User ${result.rows[0].name} deactivated`, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
