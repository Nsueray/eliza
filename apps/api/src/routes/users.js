const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

// Config: dropdown values for admin panel
router.get('/config', (req, res) => {
  res.json({
    roles: ['ceo', 'manager', 'agent'],
    offices: ['International', 'Morocco Office', 'Nigeria Office', 'Kenya Office', 'China Office', 'Algeria Office'],
    sales_groups: ['International', 'Morocco Office', 'Nigeria Office', 'Kenya Office', 'China Office', 'Algeria Office'],
    years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    languages: ['tr', 'en', 'fr'],
  });
});

// List all users (active first)
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.*, up.data_scope, up.visible_years,
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
      SELECT u.*, up.data_scope, up.visible_years,
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
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    // Business rule: CEO always gets 'all' scope
    const effectiveScope = role === 'ceo' ? 'all'
      : data_scope || (role === 'manager' ? 'team' : 'own');

    const userResult = await query(`
      INSERT INTO users (name, email, whatsapp_phone, role, office, sales_group, sales_agent_name, is_manager, language, nicknames)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name, email || null, whatsapp_phone || null, role, office || null, sales_group || null, sales_agent_name || null, is_manager || false, language || 'tr', nicknames || null]);

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
      SELECT u.*, up.data_scope, up.visible_years,
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
    } = req.body;

    // Business rule: CEO always gets 'all' scope
    const effectiveScope = role === 'ceo' ? 'all'
      : data_scope || (role === 'manager' ? 'team' : 'own');

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
        nicknames = $11
      WHERE id = $12
    `, [name, email || null, whatsapp_phone || null, role, office || null, sales_group || null, sales_agent_name || null, is_manager, language, is_active, nicknames || null, req.params.id]);

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
      SELECT u.*, up.data_scope, up.visible_years,
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
