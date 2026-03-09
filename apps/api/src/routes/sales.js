const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

router.get('/leaderboard', async (req, res) => {
  try {
    const result = await query(`
      SELECT sales_agent,
        COUNT(*) AS contracts,
        SUM(m2) AS total_m2,
        ROUND(SUM(revenue_eur)::numeric, 2) AS revenue_eur
      FROM contracts
      WHERE sales_agent IS NOT NULL
      GROUP BY sales_agent
      ORDER BY revenue_eur DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
