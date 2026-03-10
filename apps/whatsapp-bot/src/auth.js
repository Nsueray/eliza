const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { query } = require('../../../packages/db/index.js');

/**
 * Authenticate a phone number. Returns user info or null.
 * CEO has full access, sales_agents have limited access.
 */
async function authenticate(phoneNumber) {
  if (!phoneNumber) return null;

  // Normalize: strip "whatsapp:" prefix if present
  const normalized = phoneNumber.replace(/^whatsapp:/, '');

  // CEO check
  const ceoNumber = process.env.CEO_WHATSAPP_NUMBER;
  if (ceoNumber && normalized === ceoNumber) {
    return { name: 'CEO', role: 'ceo', phone: normalized, access: 'full' };
  }

  // Sales agent check
  const result = await query(`
    SELECT name, role, phone_number, office
    FROM sales_agents
    WHERE phone_number = $1
    LIMIT 1
  `, [normalized]);

  if (result.rows.length > 0) {
    const agent = result.rows[0];
    return {
      name: agent.name,
      role: agent.role || 'agent',
      phone: normalized,
      office: agent.office,
      access: 'limited',
    };
  }

  return null;
}

module.exports = { authenticate };
