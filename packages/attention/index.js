const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const THRESHOLDS = {
  expo_stale_days: 14,
  office_stale_days: 30,
  agent_stale_days: 21,
};

/**
 * Seed attention_log with all trackable entities from the database.
 * Idempotent — uses ON CONFLICT to skip existing rows.
 */
async function seedEntities() {
  // Upcoming expos
  await query(`
    INSERT INTO attention_log (entity_type, entity_id, entity_name)
    SELECT 'expo', id, name FROM expos
    WHERE start_date >= CURRENT_DATE
      AND start_date <= CURRENT_DATE + INTERVAL '12 months'
    ON CONFLICT (entity_type, entity_name) DO NOTHING
  `);

  // Offices (distinct countries from expos)
  await query(`
    INSERT INTO attention_log (entity_type, entity_name)
    SELECT DISTINCT 'office', country FROM expos
    WHERE country IS NOT NULL
    ON CONFLICT (entity_type, entity_name) DO NOTHING
  `);

  // Active sales agents (sold in last 12 months)
  await query(`
    INSERT INTO attention_log (entity_type, entity_name)
    SELECT DISTINCT 'agent', sales_agent FROM contracts
    WHERE sales_agent IS NOT NULL
      AND contract_date >= CURRENT_DATE - INTERVAL '12 months'
    ON CONFLICT (entity_type, entity_name) DO NOTHING
  `);
}

/**
 * Record that the CEO reviewed an entity (called from AI query tracking).
 */
async function markReviewed(entityType, entityName) {
  await query(`
    INSERT INTO attention_log (entity_type, entity_name, last_reviewed_at, review_count)
    VALUES ($1, $2, NOW(), 1)
    ON CONFLICT (entity_type, entity_name) DO UPDATE SET
      last_reviewed_at = NOW(),
      review_count = attention_log.review_count + 1,
      updated_at = NOW()
  `, [entityType, entityName]);
}

/**
 * Run attention scan — flag entities that need CEO attention.
 * Returns flagged items sorted by priority.
 */
async function scan() {
  // Ensure all entities are tracked
  await seedEntities();

  // Reset all flags before re-scan
  await query(`UPDATE attention_log SET flagged = FALSE, flag_reason = NULL, flag_level = 'info'`);

  // 1. Expos not reviewed in 14 days
  await query(`
    UPDATE attention_log SET
      flagged = TRUE,
      flag_level = CASE
        WHEN last_reviewed_at IS NULL THEN 'critical'
        WHEN last_reviewed_at < NOW() - INTERVAL '${THRESHOLDS.expo_stale_days} days' THEN 'warning'
        ELSE 'info'
      END,
      flag_reason = CASE
        WHEN last_reviewed_at IS NULL THEN 'Never reviewed'
        ELSE 'Last reviewed ' || EXTRACT(DAY FROM NOW() - last_reviewed_at)::int || ' days ago'
      END,
      updated_at = NOW()
    WHERE entity_type = 'expo'
      AND (last_reviewed_at IS NULL OR last_reviewed_at < NOW() - INTERVAL '${THRESHOLDS.expo_stale_days} days')
  `);

  // 2. Offices not reviewed in 30 days
  await query(`
    UPDATE attention_log SET
      flagged = TRUE,
      flag_level = CASE
        WHEN last_reviewed_at IS NULL THEN 'warning'
        WHEN last_reviewed_at < NOW() - INTERVAL '${THRESHOLDS.office_stale_days} days' THEN 'warning'
        ELSE 'info'
      END,
      flag_reason = CASE
        WHEN last_reviewed_at IS NULL THEN 'Never reviewed'
        ELSE 'Last reviewed ' || EXTRACT(DAY FROM NOW() - last_reviewed_at)::int || ' days ago'
      END,
      updated_at = NOW()
    WHERE entity_type = 'office'
      AND (last_reviewed_at IS NULL OR last_reviewed_at < NOW() - INTERVAL '${THRESHOLDS.office_stale_days} days')
  `);

  // 3. Agents — no sale in 21 days AND not reviewed
  await query(`
    UPDATE attention_log a SET
      flagged = TRUE,
      flag_level = 'warning',
      flag_reason = 'No recent sales and not reviewed in ' || ${THRESHOLDS.agent_stale_days} || '+ days',
      updated_at = NOW()
    WHERE a.entity_type = 'agent'
      AND (a.last_reviewed_at IS NULL OR a.last_reviewed_at < NOW() - INTERVAL '${THRESHOLDS.agent_stale_days} days')
      AND NOT EXISTS (
        SELECT 1 FROM contracts c
        WHERE c.sales_agent = a.entity_name
          AND c.contract_date >= CURRENT_DATE - INTERVAL '${THRESHOLDS.agent_stale_days} days'
          AND c.status = 'Valid'
      )
  `);

  // 4. Rebooking gaps — previous edition exhibitor with no new contract
  const rebookingGaps = await query(`
    SELECT prev.company_name, prev.expo_base, prev.prev_expo
    FROM (
      SELECT c.company_name,
        REGEXP_REPLACE(e.name, '\\s*\\d{4}$', '') AS expo_base,
        e.name AS prev_expo
      FROM contracts c
      JOIN expos e ON c.expo_id = e.id
      WHERE c.status = 'Valid'
        AND e.start_date < CURRENT_DATE
        AND e.start_date >= CURRENT_DATE - INTERVAL '18 months'
    ) prev
    WHERE NOT EXISTS (
      SELECT 1 FROM contracts c2
      JOIN expos e2 ON c2.expo_id = e2.id
      WHERE c2.company_name = prev.company_name
        AND REGEXP_REPLACE(e2.name, '\\s*\\d{4}$', '') = prev.expo_base
        AND e2.start_date >= CURRENT_DATE
        AND c2.status = 'Valid'
    )
    GROUP BY prev.company_name, prev.expo_base, prev.prev_expo
    ORDER BY prev.company_name
    LIMIT 100
  `);

  for (const gap of rebookingGaps.rows) {
    const name = `${gap.company_name} → ${gap.expo_base}`;
    await query(`
      INSERT INTO attention_log (entity_type, entity_name, flagged, flag_level, flag_reason, updated_at)
      VALUES ('rebooking', $1, TRUE, 'info', $2, NOW())
      ON CONFLICT (entity_type, entity_name) DO UPDATE SET
        flagged = TRUE,
        flag_level = 'info',
        flag_reason = $2,
        updated_at = NOW()
    `, [name, `Was in ${gap.prev_expo}, no contract for next edition`]);
  }

  // Return all flagged items
  return getItems();
}

/**
 * Get all flagged attention items, sorted by priority.
 */
async function getItems() {
  const result = await query(`
    SELECT entity_type, entity_name, last_reviewed_at,
      review_count, flag_reason, flag_level,
      CASE
        WHEN last_reviewed_at IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - last_reviewed_at)::int
        ELSE NULL
      END AS days_since_review
    FROM attention_log
    WHERE flagged = TRUE
    ORDER BY
      CASE flag_level
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
      END,
      CASE entity_type
        WHEN 'expo' THEN 1
        WHEN 'office' THEN 2
        WHEN 'agent' THEN 3
        WHEN 'rebooking' THEN 4
      END,
      last_reviewed_at ASC NULLS FIRST
  `);
  return result.rows;
}

module.exports = { scan, getItems, markReviewed, seedEntities };
