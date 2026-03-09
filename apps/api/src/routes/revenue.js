const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

router.get('/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) AS total_contracts,
        COALESCE(ROUND(SUM(m2)::numeric, 1), 0) AS total_m2,
        COALESCE(ROUND(SUM(revenue_eur)::numeric, 2), 0) AS total_revenue_eur,
        COUNT(DISTINCT expo_id) AS total_expos,
        COUNT(DISTINCT sales_agent) AS total_agents
      FROM contracts
      WHERE status IN ('Valid', 'Transferred In')
        AND EXTRACT(YEAR FROM contract_date) = 2026
    `);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-country', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.country,
        COUNT(*) AS contracts,
        COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur
      FROM contracts c
      WHERE c.country IS NOT NULL
      GROUP BY c.country
      ORDER BY revenue_eur DESC
      LIMIT 15
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-year', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        EXTRACT(YEAR FROM contract_date)::integer AS year,
        COUNT(*) AS contracts,
        COALESCE(ROUND(SUM(revenue_eur)::numeric, 2), 0) AS revenue_eur
      FROM contracts
      WHERE contract_date IS NOT NULL
      GROUP BY year
      ORDER BY year ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
