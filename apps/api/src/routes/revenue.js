const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

router.get('/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) AS total_contracts,
        ROUND(SUM(m2)::numeric, 1) AS total_m2,
        ROUND(SUM(revenue_eur)::numeric, 2) AS total_revenue_eur,
        COUNT(DISTINCT expo_id) AS total_expos,
        COUNT(DISTINCT sales_agent) AS total_agents
      FROM contracts
    `);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
