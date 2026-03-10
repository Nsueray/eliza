const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const MAX_DAILY_PUSH = 5;

/**
 * Check if an alert with the same key was already created in the last 24 hours.
 */
async function isDuplicate(alertKey) {
  const result = await query(`
    SELECT 1 FROM alerts
    WHERE alert_key = $1
      AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  `, [alertKey]);
  return result.rows.length > 0;
}

/**
 * Create an alert if not duplicate. Returns the alert or null.
 */
async function createAlert({ type, key, severity, title, description, entityType, entityName, expoId }) {
  if (await isDuplicate(key)) return null;

  const result = await query(`
    INSERT INTO alerts (alert_type, alert_key, severity, title, description, entity_type, entity_name, expo_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [type, key, severity, title, description, entityType || null, entityName || null, expoId || null]);

  return result.rows[0];
}

/**
 * Get today's unsent alerts, respecting fatigue limit.
 */
async function getUnsentAlerts() {
  const result = await query(`
    SELECT * FROM alerts
    WHERE sent = FALSE
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
      END,
      created_at ASC
    LIMIT $1
  `, [MAX_DAILY_PUSH]);
  return result.rows;
}

/**
 * Mark alerts as sent.
 */
async function markSent(alertIds) {
  if (!alertIds.length) return;
  await query(`
    UPDATE alerts SET sent = TRUE, sent_at = NOW()
    WHERE id = ANY($1)
  `, [alertIds]);
}

/**
 * Run all alert generators — collects alerts from all sources.
 */
async function generateAlerts() {
  const created = [];

  // 1. Risk Engine → HIGH risk expos
  const highRisk = await generateRiskAlerts();
  created.push(...highRisk);

  // 2. Payment Watch → upcoming expo deadlines
  const payments = await generatePaymentAlerts();
  created.push(...payments);

  // 3. Attention Engine → stale entities
  const attention = await generateAttentionAlerts();
  created.push(...attention);

  // 4. Sales velocity drops
  const velocity = await generateVelocityAlerts();
  created.push(...velocity);

  // 5. Rebooking gaps
  const rebooking = await generateRebookingAlerts();
  created.push(...rebooking);

  return created.filter(Boolean);
}

// --- Alert Sources ---

async function generateRiskAlerts() {
  const result = await query(`
    SELECT expo_name, risk_score, risk_level, progress_percent,
      velocity_m2_per_month, required_velocity, months_to_event
    FROM expo_metrics
    WHERE risk_level = 'HIGH'
    ORDER BY risk_score DESC
  `);
  const alerts = [];
  for (const r of result.rows) {
    const a = await createAlert({
      type: 'risk_high',
      key: `risk_high:${r.expo_name}`,
      severity: 'critical',
      title: `${r.expo_name} — HIGH RISK`,
      description: `Risk skoru ${r.risk_score}. İlerleme %${r.progress_percent || 0}, ` +
        `hız ${r.velocity_m2_per_month} m²/ay vs gerekli ${r.required_velocity} m²/ay. ` +
        `Etkinliğe ${r.months_to_event} ay kaldı.`,
      entityType: 'expo',
      entityName: r.expo_name,
    });
    alerts.push(a);
  }
  return alerts;
}

async function generatePaymentAlerts() {
  // Payment Watch: expos approaching with unpaid contracts
  // -60 days → warning, -42 days → warning, -21 days → critical
  const thresholds = [
    { days: 21, severity: 'critical', label: '21 gün' },
    { days: 42, severity: 'warning', label: '42 gün' },
    { days: 60, severity: 'warning', label: '60 gün' },
  ];

  const alerts = [];
  for (const t of thresholds) {
    const result = await query(`
      SELECT e.name AS expo_name, e.start_date,
        COUNT(c.id) AS contract_count,
        COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS total_revenue
      FROM expos e
      JOIN edition_contracts c ON c.expo_id = e.id
      WHERE e.start_date >= CURRENT_DATE
        AND e.start_date <= CURRENT_DATE + INTERVAL '${t.days} days'
        AND e.start_date > CURRENT_DATE + INTERVAL '${t.days - 15} days'
      GROUP BY e.id
      HAVING COUNT(c.id) > 0
    `);

    for (const r of result.rows) {
      const daysLeft = Math.ceil((new Date(r.start_date) - new Date()) / (1000 * 60 * 60 * 24));
      const a = await createAlert({
        type: 'payment_watch',
        key: `payment_watch:${r.expo_name}:${t.days}`,
        severity: t.severity,
        title: `${r.expo_name} — ${daysLeft} gün kaldı`,
        description: `Etkinliğe ${daysLeft} gün. ${r.contract_count} kontrat, toplam €${Number(r.total_revenue).toLocaleString('de-DE')}.`,
        entityType: 'expo',
        entityName: r.expo_name,
      });
      alerts.push(a);
    }
  }
  return alerts;
}

async function generateAttentionAlerts() {
  const result = await query(`
    SELECT entity_type, entity_name, flag_reason, flag_level,
      EXTRACT(DAY FROM NOW() - last_reviewed_at)::int AS days_ago
    FROM attention_log
    WHERE flagged = TRUE
      AND flag_level IN ('critical', 'warning')
      AND entity_type IN ('expo', 'office')
    ORDER BY
      CASE flag_level WHEN 'critical' THEN 1 ELSE 2 END
    LIMIT 5
  `);

  const alerts = [];
  for (const r of result.rows) {
    const a = await createAlert({
      type: 'attention_gap',
      key: `attention:${r.entity_type}:${r.entity_name}`,
      severity: r.flag_level === 'critical' ? 'warning' : 'info',
      title: `${r.entity_name} — dikkat gerekiyor`,
      description: r.flag_reason,
      entityType: r.entity_type,
      entityName: r.entity_name,
    });
    alerts.push(a);
  }
  return alerts;
}

async function generateVelocityAlerts() {
  // Expos where velocity dropped below 50% of required
  const result = await query(`
    SELECT expo_name, velocity_m2_per_month, required_velocity,
      velocity_ratio, months_to_event
    FROM expo_metrics
    WHERE velocity_ratio IS NOT NULL
      AND velocity_ratio < 0.5
      AND velocity_ratio > 0
      AND months_to_event < 6
  `);

  const alerts = [];
  for (const r of result.rows) {
    const a = await createAlert({
      type: 'velocity_drop',
      key: `velocity:${r.expo_name}`,
      severity: 'warning',
      title: `${r.expo_name} — satış hızı düşük`,
      description: `Mevcut hız ${r.velocity_m2_per_month} m²/ay, gerekli ${r.required_velocity} m²/ay ` +
        `(oran: ${r.velocity_ratio}). Etkinliğe ${r.months_to_event} ay.`,
      entityType: 'expo',
      entityName: r.expo_name,
    });
    alerts.push(a);
  }
  return alerts;
}

async function generateRebookingAlerts() {
  // Top rebooking gaps — companies that were in previous edition but haven't rebooked
  const result = await query(`
    SELECT entity_name, flag_reason
    FROM attention_log
    WHERE entity_type = 'rebooking'
      AND flagged = TRUE
    ORDER BY updated_at DESC
    LIMIT 10
  `);

  const alerts = [];
  for (const r of result.rows) {
    const a = await createAlert({
      type: 'rebooking_gap',
      key: `rebooking:${r.entity_name}`,
      severity: 'info',
      title: `Rebooking — ${r.entity_name}`,
      description: r.flag_reason,
      entityType: 'rebooking',
      entityName: r.entity_name,
    });
    alerts.push(a);
  }
  return alerts;
}

module.exports = { generateAlerts, getUnsentAlerts, markSent, createAlert, isDuplicate };
