const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

/**
 * Resolve period shortcuts to { from, to } date strings.
 */
function resolvePeriod(req) {
  const { period, from, to } = req.query;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (from && to) return { from, to };

  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: monday.toISOString().slice(0, 10), to: today };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: first.toISOString().slice(0, 10), to: today };
    }
    case 'year':
    default: {
      const jan1 = new Date(now.getFullYear(), 0, 1);
      return { from: jan1.toISOString().slice(0, 10), to: today };
    }
  }
}

/**
 * Calculate previous period for comparison.
 */
function previousPeriod(from, to) {
  const f = new Date(from);
  const t = new Date(to);
  const days = Math.round((t - f) / (1000 * 60 * 60 * 24));
  const prevTo = new Date(f);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevTo.getDate() - days);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = resolvePeriod(req);
    const prev = previousPeriod(from, to);

    const sql = `
      SELECT COUNT(c.id) AS contracts,
             COALESCE(SUM(c.m2), 0) AS m2,
             COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur,
             CASE WHEN SUM(c.m2) > 0 THEN ROUND((SUM(c.revenue_eur) / SUM(c.m2))::numeric, 2) ELSE 0 END AS avg_per_m2
      FROM fiscal_contracts c
      WHERE c.sales_agent != 'ELAN EXPO'
        AND c.contract_date >= $1 AND c.contract_date <= $2
    `;

    const [current, previous] = await Promise.all([
      query(sql, [from, to]),
      query(sql, [prev.from, prev.to]),
    ]);

    const cur = current.rows[0];
    const pre = previous.rows[0];

    function changePct(curVal, preVal) {
      const c = Number(curVal || 0);
      const p = Number(preVal || 0);
      if (p === 0) return c > 0 ? 100 : 0;
      return Math.round((c - p) / p * 100);
    }

    res.json({
      current: cur,
      previous: pre,
      change_pct: {
        revenue_eur: changePct(cur.revenue_eur, pre.revenue_eur),
        contracts: changePct(cur.contracts, pre.contracts),
        m2: changePct(cur.m2, pre.m2),
        avg_per_m2: changePct(cur.avg_per_m2, pre.avg_per_m2),
      },
      period: { from, to },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-agent', async (req, res) => {
  try {
    const { from, to } = resolvePeriod(req);
    const result = await query(`
      SELECT c.sales_agent AS name,
             COUNT(c.id) AS contracts,
             COALESCE(SUM(c.m2), 0) AS m2,
             COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur,
             CASE WHEN SUM(c.m2) > 0 THEN ROUND((SUM(c.revenue_eur) / SUM(c.m2))::numeric, 2) ELSE 0 END AS avg_per_m2
      FROM fiscal_contracts c
      WHERE c.sales_agent != 'ELAN EXPO'
        AND c.sales_agent IS NOT NULL
        AND c.contract_date >= $1 AND c.contract_date <= $2
      GROUP BY c.sales_agent
      ORDER BY revenue_eur DESC
    `, [from, to]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-expo', async (req, res) => {
  try {
    const { from, to } = resolvePeriod(req);
    const result = await query(`
      SELECT e.name AS expo, e.country,
             COUNT(c.id) AS contracts,
             COALESCE(SUM(c.m2), 0) AS m2,
             COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur
      FROM fiscal_contracts c
      JOIN expos e ON c.expo_id = e.id
      WHERE c.sales_agent != 'ELAN EXPO'
        AND c.contract_date >= $1 AND c.contract_date <= $2
      GROUP BY e.name, e.country
      ORDER BY revenue_eur DESC
    `, [from, to]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-country', async (req, res) => {
  try {
    const { from, to } = resolvePeriod(req);
    const result = await query(`
      SELECT c.country,
             COUNT(DISTINCT c.company_name) AS companies,
             COUNT(c.id) AS contracts,
             COALESCE(SUM(c.m2), 0) AS m2,
             COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur
      FROM fiscal_contracts c
      WHERE c.sales_agent != 'ELAN EXPO'
        AND c.contract_date >= $1 AND c.contract_date <= $2
      GROUP BY c.country
      ORDER BY revenue_eur DESC
    `, [from, to]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const { from, to } = resolvePeriod(req);
    const granularity = req.query.granularity || 'monthly';
    const trunc = granularity === 'daily' ? 'day' : 'month';
    const result = await query(`
      SELECT DATE_TRUNC('${trunc}', c.contract_date)::date AS period,
             COUNT(c.id) AS contracts,
             COALESCE(SUM(c.m2), 0) AS m2,
             COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur
      FROM fiscal_contracts c
      WHERE c.sales_agent != 'ELAN EXPO'
        AND c.contract_date >= $1 AND c.contract_date <= $2
      GROUP BY period
      ORDER BY period
    `, [from, to]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
