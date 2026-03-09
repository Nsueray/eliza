const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

router.get('/leaderboard', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        sales_agent,
        COUNT(*) AS contracts,
        COALESCE(SUM(m2), 0) AS total_m2,
        COALESCE(ROUND(SUM(revenue_eur)::numeric, 2), 0) AS revenue_eur
      FROM contracts
      WHERE EXTRACT(YEAR FROM contract_date) = 2026
        AND status IN ('Valid', 'Transferred Out')
        AND sales_agent IS NOT NULL
      GROUP BY sales_agent
      ORDER BY revenue_eur DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
