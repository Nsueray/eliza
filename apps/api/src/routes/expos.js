const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

router.get('/metrics', async (req, res) => {
  try {
    const result = await query(`
      SELECT e.id, e.name, e.country, e.start_date,
        COUNT(c.id) AS contracts,
        SUM(c.m2) AS total_m2,
        ROUND(SUM(c.revenue_eur)::numeric, 2) AS revenue_eur,
        ROUND(AVG(c.m2)::numeric, 1) AS avg_stand_size
      FROM contracts c
      JOIN expos e ON c.expo_id = e.id
      GROUP BY e.id, e.name, e.country, e.start_date
      ORDER BY revenue_eur DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.company_name, c.country, c.sales_agent,
        c.m2, c.revenue_eur, c.currency, c.contract_date
      FROM contracts c
      WHERE c.expo_id = $1
      ORDER BY c.contract_date DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
