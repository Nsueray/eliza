const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { query } = require('../../../packages/db/index.js');

/**
 * Authenticate a phone number via users table.
 * Returns user + permissions or null.
 */
async function authenticate(phoneNumber) {
  if (!phoneNumber) return null;

  // Normalize: strip "whatsapp:" prefix if present
  const normalized = phoneNumber.replace(/^whatsapp:/, '');

  try {
    const result = await query(`
      SELECT u.id, u.name, u.email, u.whatsapp_phone, u.role, u.office,
             u.sales_group, u.sales_agent_name, u.is_manager, u.language,
             u.nicknames, u.is_active, u.pending_clarification,
             up.data_scope, up.visible_years,
             up.can_see_expenses, up.can_take_notes,
             up.can_use_message_generator, up.can_see_financials
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.whatsapp_phone = $1
      LIMIT 1
    `, [normalized]);

    if (result.rows.length === 0) return null;

    const user = result.rows[0];

    // Check if deactivated
    if (!user.is_active) {
      return { blocked: true, reason: 'deactivated' };
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      phone: normalized,
      office: user.office,
      sales_group: user.sales_group,
      sales_agent_name: user.sales_agent_name,
      is_manager: user.is_manager,
      language: user.language,
      nicknames: user.nicknames || null,
      pending_clarification: user.pending_clarification || null,
      access: user.role === 'ceo' ? 'full' : 'limited',
      permissions: {
        data_scope: user.data_scope || 'own',
        visible_years: user.visible_years || [2025, 2026],
        can_see_expenses: user.can_see_expenses || false,
        can_take_notes: user.can_take_notes || false,
        can_use_message_generator: user.can_use_message_generator || false,
        can_see_financials: user.can_see_financials || false,
      },
    };
  } catch (err) {
    console.error('Auth error:', err.message);
    return null;
  }
}

module.exports = { authenticate };
