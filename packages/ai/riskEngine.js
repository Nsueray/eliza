const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

async function calculateMetrics() {
  const expos = await query(`
    SELECT e.id, e.name, e.edition_year, e.start_date, e.end_date,
      e.target_m2, e.sales_start_date,
      COALESCE(SUM(c.m2), 0) AS sold_m2,
      COALESCE(SUM(c.revenue_eur), 0) AS revenue_eur,
      COUNT(c.id) AS contracts,
      COUNT(DISTINCT c.country) AS country_count,
      COUNT(DISTINCT c.sales_agent) AS agent_count
    FROM expos e
    LEFT JOIN edition_contracts c ON c.expo_id = e.id
    WHERE e.start_date >= CURRENT_DATE
      AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'
    GROUP BY e.id
  `);

  for (const expo of expos.rows) {
    const today = new Date();
    const startDate = new Date(expo.start_date);
    const salesStart = expo.sales_start_date ? new Date(expo.sales_start_date) : null;

    const months_to_event = Math.max(0.5,
      (startDate - today) / (1000 * 60 * 60 * 24 * 30));

    const months_passed = salesStart
      ? Math.max(0.5, (today - salesStart) / (1000 * 60 * 60 * 24 * 30))
      : Math.max(0.5, 12 - months_to_event);

    const target_m2 = parseFloat(expo.target_m2) || 0;
    const sold_m2 = parseFloat(expo.sold_m2) || 0;

    const progress_percent = target_m2 > 0
      ? Math.round((sold_m2 / target_m2) * 1000) / 10
      : null;

    const velocity = months_passed > 0 ? sold_m2 / months_passed : 0;
    const required_velocity = (months_to_event > 0 && target_m2 > 0)
      ? Math.max(0, (target_m2 - sold_m2)) / months_to_event
      : 0;

    const velocity_ratio = required_velocity > 0
      ? Math.round((velocity / required_velocity) * 100) / 100
      : null;

    // Risk scoring
    let risk_score = 0;

    if (velocity_ratio !== null) {
      if (velocity_ratio < 0.5) risk_score += 3;
      else if (velocity_ratio < 0.8) risk_score += 2;
      else if (velocity_ratio < 1.2) risk_score += 1;
    }

    if (parseInt(expo.country_count) < 3) risk_score += 1;
    if (parseInt(expo.agent_count) < 2) risk_score += 1;
    if (progress_percent !== null && progress_percent < 20 && months_to_event < 6) risk_score += 2;

    const risk_level =
      risk_score === 0 ? 'SAFE' :
      risk_score === 1 ? 'OK' :
      risk_score === 2 ? 'WATCH' : 'HIGH';

    await query(`
      INSERT INTO expo_metrics (
        expo_id, expo_name, edition_year, start_date,
        months_to_event, months_passed, sales_start_date,
        contracts, sold_m2, revenue_eur, target_m2,
        progress_percent, velocity_m2_per_month, required_velocity, velocity_ratio,
        country_count, agent_count, risk_score, risk_level, calculated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
      ON CONFLICT (expo_id) DO UPDATE SET
        months_to_event=$5, months_passed=$6, contracts=$8,
        sold_m2=$9, revenue_eur=$10, progress_percent=$12,
        velocity_m2_per_month=$13, required_velocity=$14, velocity_ratio=$15,
        country_count=$16, agent_count=$17, risk_score=$18, risk_level=$19,
        calculated_at=NOW()
    `, [
      expo.id, expo.name, expo.edition_year, expo.start_date,
      Math.round(months_to_event * 10) / 10,
      Math.round(months_passed * 10) / 10,
      expo.sales_start_date,
      parseInt(expo.contracts), sold_m2,
      parseFloat(expo.revenue_eur),
      target_m2, progress_percent,
      Math.round(velocity * 10) / 10,
      Math.round(required_velocity * 10) / 10,
      velocity_ratio,
      parseInt(expo.country_count),
      parseInt(expo.agent_count),
      risk_score, risk_level
    ]);
  }

  return expos.rows.length;
}

module.exports = { calculateMetrics };
