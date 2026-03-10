const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');
const { calculateMetrics } = require('../../../../packages/ai/riskEngine.js');

router.get('/risk', async (req, res) => {
  try {
    await calculateMetrics();
    const result = await query(`
      SELECT expo_name, start_date, months_to_event,
        sold_m2, target_m2, progress_percent,
        velocity_m2_per_month, required_velocity, velocity_ratio,
        country_count, agent_count, risk_score, risk_level
      FROM expo_metrics
      ORDER BY risk_score DESC, months_to_event ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const { year } = req.query;
    let whereClause;
    let params = [];

    if (year) {
      whereClause = 'WHERE EXTRACT(YEAR FROM e.start_date) = $1';
      params = [parseInt(year)];
    } else {
      whereClause = `WHERE e.start_date >= CURRENT_DATE
        AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'`;
    }

    const result = await query(`
      SELECT
        e.id, e.name, e.country, e.start_date,
        COUNT(c.id) FILTER (WHERE c.sales_agent != 'ELAN EXPO') AS contracts,
        COALESCE(SUM(c.m2) FILTER (WHERE c.sales_agent != 'ELAN EXPO'), 0) AS sold_m2,
        COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur,
        e.target_m2,
        CASE
          WHEN e.target_m2 IS NULL OR e.target_m2 = 0 THEN NULL
          ELSE ROUND((COALESCE(SUM(c.m2) FILTER (WHERE c.sales_agent != 'ELAN EXPO'), 0) / e.target_m2 * 100)::numeric, 1)
        END AS progress_percent
      FROM expos e
      LEFT JOIN edition_contracts c ON c.expo_id = e.id
      ${whereClause}
      GROUP BY e.id
      ORDER BY e.start_date ASC
    `, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/calculate-targets', async (req, res) => {
  try {
    await query(`
      UPDATE expos e
      SET target_m2 = sub.avg_m2
      FROM (
        SELECT
          REGEXP_REPLACE(e2.name, '\\s*\\d{4}$', '') AS base_name,
          ROUND(AVG(sold.total_m2)::numeric, 0) AS avg_m2
        FROM expos e2
        JOIN (
          SELECT expo_id, SUM(m2) AS total_m2
          FROM edition_contracts
          GROUP BY expo_id
        ) sold ON sold.expo_id = e2.id
        WHERE e2.start_date < CURRENT_DATE
        GROUP BY base_name
      ) sub
      WHERE REGEXP_REPLACE(e.name, '\\s*\\d{4}$', '') = sub.base_name
        AND e.start_date >= CURRENT_DATE
        AND sub.avg_m2 > 0
    `);
    const result = await query(`
      SELECT name, target_m2, start_date
      FROM expos
      WHERE start_date >= CURRENT_DATE
        AND target_m2 IS NOT NULL
      ORDER BY start_date ASC
    `);
    res.json({ updated: result.rows.length, expos: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.company_name, c.country, c.sales_agent,
        c.m2, c.revenue_eur, c.currency, c.contract_date
      FROM edition_contracts c
      WHERE c.expo_id = $1
      ORDER BY c.contract_date DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
