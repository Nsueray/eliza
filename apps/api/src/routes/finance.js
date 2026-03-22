const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

/**
 * Mode filter: edition (upcoming expos) vs fiscal (current year contracts).
 * Returns a WHERE clause fragment and params array.
 */
function modeFilter(mode) {
  if (mode === 'fiscal') {
    return {
      where: `EXTRACT(YEAR FROM ob.contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      params: [],
    };
  }
  // Default: edition — upcoming expos (start_date within next 12 months)
  return {
    where: `ob.expo_start_date >= CURRENT_DATE AND ob.expo_start_date <= CURRENT_DATE + INTERVAL '12 months'`,
    params: [],
  };
}

// ── 1. GET /api/finance/summary ──
router.get('/summary', async (req, res) => {
  try {
    const mode = req.query.mode || 'edition';
    const { where } = modeFilter(mode);

    const result = await query(`
      SELECT
        COALESCE(SUM(ob.contract_total_eur), 0) AS contract_value,
        COALESCE(SUM(ob.paid_eur), 0) AS collected,
        COALESCE(SUM(ob.balance_eur), 0) AS outstanding,
        COALESCE(SUM(CASE WHEN ob.is_overdue THEN ob.balance_eur ELSE 0 END), 0) AS overdue,
        COALESCE(SUM(CASE WHEN ob.collection_stage IN ('overdue','pre_event_balance_open','no_payment')
          AND (ob.collection_risk_score + ob.event_risk_score) >= 5
          THEN ob.balance_eur ELSE 0 END), 0) AS at_risk,
        COUNT(*) AS total_contracts,
        COUNT(CASE WHEN ob.collection_stage = 'no_payment' THEN 1 END) AS no_payment_count,
        COUNT(CASE WHEN ob.is_overdue THEN 1 END) AS overdue_count
      FROM outstanding_balances ob
      WHERE ${where}
    `);

    const row = result.rows[0];

    // Due next 30 days from payment schedule
    const upcoming = await query(`
      SELECT COALESCE(SUM(cps.planned_amount_eur), 0) AS due_next_30
      FROM contract_payment_schedule cps
      JOIN contracts c ON cps.contract_id = c.id
      JOIN expos e ON c.expo_id = e.id
      WHERE cps.due_date >= CURRENT_DATE
        AND cps.due_date <= CURRENT_DATE + INTERVAL '30 days'
        AND c.status IN ('Valid', 'Transferred In')
        AND c.payment_done IS NOT TRUE
        ${mode === 'fiscal'
          ? `AND EXTRACT(YEAR FROM c.contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
          : `AND e.start_date >= CURRENT_DATE AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'`}
    `);

    // Deposit rate: contracts with at least one payment / total open contracts
    const depositQuery = await query(`
      SELECT
        COUNT(CASE WHEN COALESCE(ob.paid_eur, 0) > 0 THEN 1 END) AS collected_count,
        COUNT(*) AS total_count
      FROM outstanding_balances ob
      WHERE ${where}
    `);
    const depositRow = depositQuery.rows[0];
    const depositCollected = Number(depositRow.collected_count || 0);
    const depositTotal = Number(depositRow.total_count || 0);
    const depositPercentage = depositTotal > 0
      ? Math.round(depositCollected / depositTotal * 1000) / 10
      : 0;

    // Paid this month + last month for comparison
    const paidThisMonth = await query(`
      SELECT COALESCE(SUM(amount_eur), 0) AS amount, COUNT(*) AS count
      FROM contract_payments
      WHERE payment_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND payment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `);
    const paidLastMonth = await query(`
      SELECT COALESCE(SUM(amount_eur), 0) AS amount
      FROM contract_payments
      WHERE payment_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
        AND payment_date < DATE_TRUNC('month', CURRENT_DATE)
    `);

    res.json({
      contract_value: Number(row.contract_value),
      collected: Number(row.collected),
      outstanding: Number(row.outstanding),
      overdue: Number(row.overdue),
      due_next_30: Number(upcoming.rows[0].due_next_30),
      deposit_rate: {
        collected_count: depositCollected,
        total_count: depositTotal,
        percentage: depositPercentage,
      },
      paid_this_month: {
        amount: Number(paidThisMonth.rows[0].amount),
        count: Number(paidThisMonth.rows[0].count),
        last_month: Number(paidLastMonth.rows[0].amount),
      },
      at_risk: Number(row.at_risk),
      no_payment_count: Number(row.no_payment_count),
      total_contracts: Number(row.total_contracts),
      overdue_count: Number(row.overdue_count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/finance/action-list ──
router.get('/action-list', async (req, res) => {
  try {
    const mode = req.query.mode || 'edition';
    const { where } = modeFilter(mode);
    const { stage, risk, expo, agent, search, sort, order, limit, offset } = req.query;

    let filters = [where];
    const params = [];
    let paramIdx = 1;

    if (stage) {
      params.push(stage);
      filters.push(`ob.collection_stage = $${paramIdx++}`);
    }
    if (risk) {
      const riskRanges = { OK: [0, 2], WATCH: [3, 4], HIGH: [5, 7], CRITICAL: [8, 99] };
      const range = riskRanges[risk.toUpperCase()];
      if (range) {
        filters.push(`(ob.collection_risk_score + ob.event_risk_score) >= ${range[0]} AND (ob.collection_risk_score + ob.event_risk_score) <= ${range[1]}`);
      }
    }
    if (expo) {
      params.push(`%${expo}%`);
      filters.push(`ob.expo_name ILIKE $${paramIdx++}`);
    }
    if (agent) {
      params.push(`%${agent}%`);
      filters.push(`ob.sales_agent ILIKE $${paramIdx++}`);
    }
    if (search) {
      params.push(`%${search}%`);
      filters.push(`(ob.company_name ILIKE $${paramIdx} OR ob.af_number ILIKE $${paramIdx})`);
      paramIdx++;
    }

    const sortCol = ['balance_eur', 'days_overdue', 'days_to_expo', 'paid_percent', 'contract_total_eur', 'company_name'].includes(sort)
      ? sort : '(ob.collection_risk_score + ob.event_risk_score)';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const secondarySort = sortCol.includes('risk') ? ', ob.days_to_expo ASC NULLS LAST' : '';

    const lim = Math.min(Number(limit) || 500, 500);
    const off = Number(offset) || 0;

    const result = await query(`
      SELECT ob.*,
        (ob.collection_risk_score + ob.event_risk_score) AS total_risk_score
      FROM outstanding_balances ob
      WHERE ${filters.join(' AND ')}
      ORDER BY ${sortCol} ${sortDir} ${secondarySort}
      LIMIT ${lim} OFFSET ${off}
    `, params);

    // Total count for pagination
    const countResult = await query(`
      SELECT COUNT(*) AS total
      FROM outstanding_balances ob
      WHERE ${filters.join(' AND ')}
    `, params);

    // Add suggested_action to each row
    const rows = result.rows.map(r => {
      let action = 'On track';
      const daysToExpo = Number(r.days_to_expo);
      const daysOverdue = Number(r.days_overdue);

      if (r.collection_stage === 'no_payment' && daysToExpo < 60) {
        action = `URGENT — no payment, ${daysToExpo}d to expo`;
      } else if (r.collection_stage === 'no_payment') {
        action = 'Request deposit';
      } else if (r.collection_stage === 'overdue' && daysOverdue > 30) {
        action = `Escalation — ${daysOverdue}d overdue`;
      } else if (r.collection_stage === 'overdue') {
        action = `Follow up payment — ${daysOverdue}d overdue`;
      } else if (r.collection_stage === 'pre_event_balance_open') {
        action = `Pre-event balance close — ${daysToExpo}d to expo`;
      } else if (r.collection_stage === 'partial_paid' && r.days_to_due !== null && Number(r.days_to_due) < 30) {
        action = 'Installment reminder';
      }

      return { ...r, suggested_action: action };
    });

    res.json({
      data: rows,
      total: Number(countResult.rows[0].total),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. GET /api/finance/aging ──
router.get('/aging', async (req, res) => {
  try {
    const mode = req.query.mode || 'edition';
    const { where } = modeFilter(mode);

    const result = await query(`
      SELECT
        SUM(CASE WHEN NOT ob.is_overdue THEN ob.balance_eur ELSE 0 END) AS current_amount,
        COUNT(CASE WHEN NOT ob.is_overdue THEN 1 END) AS current_count,
        SUM(CASE WHEN ob.days_overdue BETWEEN 1 AND 7 THEN ob.balance_eur ELSE 0 END) AS d1_7_amount,
        COUNT(CASE WHEN ob.days_overdue BETWEEN 1 AND 7 THEN 1 END) AS d1_7_count,
        SUM(CASE WHEN ob.days_overdue BETWEEN 8 AND 15 THEN ob.balance_eur ELSE 0 END) AS d8_15_amount,
        COUNT(CASE WHEN ob.days_overdue BETWEEN 8 AND 15 THEN 1 END) AS d8_15_count,
        SUM(CASE WHEN ob.days_overdue BETWEEN 16 AND 30 THEN ob.balance_eur ELSE 0 END) AS d16_30_amount,
        COUNT(CASE WHEN ob.days_overdue BETWEEN 16 AND 30 THEN 1 END) AS d16_30_count,
        SUM(CASE WHEN ob.days_overdue BETWEEN 31 AND 60 THEN ob.balance_eur ELSE 0 END) AS d31_60_amount,
        COUNT(CASE WHEN ob.days_overdue BETWEEN 31 AND 60 THEN 1 END) AS d31_60_count,
        SUM(CASE WHEN ob.days_overdue > 60 THEN ob.balance_eur ELSE 0 END) AS d60_plus_amount,
        COUNT(CASE WHEN ob.days_overdue > 60 THEN 1 END) AS d60_plus_count
      FROM outstanding_balances ob
      WHERE ${where}
    `);

    const r = result.rows[0];
    res.json([
      { bucket: 'Current', amount: Number(r.current_amount || 0), count: Number(r.current_count || 0) },
      { bucket: '1-7 days', amount: Number(r.d1_7_amount || 0), count: Number(r.d1_7_count || 0) },
      { bucket: '8-15 days', amount: Number(r.d8_15_amount || 0), count: Number(r.d8_15_count || 0) },
      { bucket: '16-30 days', amount: Number(r.d16_30_amount || 0), count: Number(r.d16_30_count || 0) },
      { bucket: '31-60 days', amount: Number(r.d31_60_amount || 0), count: Number(r.d31_60_count || 0) },
      { bucket: '60+ days', amount: Number(r.d60_plus_amount || 0), count: Number(r.d60_plus_count || 0) },
    ]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. GET /api/finance/upcoming ──
router.get('/upcoming', async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const mode = req.query.mode || 'edition';

    const modeWhere = mode === 'fiscal'
      ? `AND EXTRACT(YEAR FROM c.contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
      : `AND e.start_date >= CURRENT_DATE AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'`;

    const result = await query(`
      SELECT
        cps.id, cps.af_number, cps.installment_no, cps.due_date,
        cps.planned_amount_eur, cps.payment_type, cps.is_synthetic,
        c.company_name, c.sales_agent,
        e.name AS expo_name,
        (cps.due_date - CURRENT_DATE) AS days_left,
        COALESCE(c.paid_eur, 0) AS paid_eur,
        COALESCE(c.balance_eur, 0) AS balance_eur
      FROM contract_payment_schedule cps
      JOIN contracts c ON cps.contract_id = c.id
      JOIN expos e ON c.expo_id = e.id
      WHERE cps.due_date >= CURRENT_DATE
        AND cps.due_date <= CURRENT_DATE + INTERVAL '${days} days'
        AND c.status IN ('Valid', 'Transferred In')
        AND c.payment_done IS NOT TRUE
        AND COALESCE(c.balance_eur, 0) > 0
        ${modeWhere}
      ORDER BY cps.due_date ASC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. GET /api/finance/by-expo ──
router.get('/by-expo', async (req, res) => {
  try {
    const mode = req.query.mode || 'edition';
    const { where } = modeFilter(mode);

    const result = await query(`
      SELECT
        ob.expo_name,
        ob.expo_country,
        MIN(ob.days_to_expo) AS days_to_expo,
        COALESCE(SUM(ob.contract_total_eur), 0) AS contract_value,
        COALESCE(SUM(ob.paid_eur), 0) AS collected,
        COALESCE(SUM(ob.balance_eur), 0) AS outstanding,
        CASE WHEN SUM(ob.contract_total_eur) > 0
          THEN ROUND((SUM(ob.paid_eur) / SUM(ob.contract_total_eur) * 100)::numeric, 1) ELSE 0 END AS collection_pct,
        COALESCE(SUM(CASE WHEN ob.collection_stage IN ('overdue','pre_event_balance_open','no_payment')
          AND (ob.collection_risk_score + ob.event_risk_score) >= 5
          THEN ob.balance_eur ELSE 0 END), 0) AS at_risk,
        COUNT(CASE WHEN ob.collection_stage = 'no_payment' THEN 1 END) AS critical_count,
        COUNT(*) AS contracts
      FROM outstanding_balances ob
      WHERE ${where}
      GROUP BY ob.expo_name, ob.expo_country
      ORDER BY outstanding DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. GET /api/finance/by-agent ──
router.get('/by-agent', async (req, res) => {
  try {
    const mode = req.query.mode || 'edition';
    const { where } = modeFilter(mode);

    const result = await query(`
      SELECT
        ob.sales_agent AS agent,
        COUNT(*) AS contracts,
        COALESCE(SUM(ob.contract_total_eur), 0) AS contract_value,
        COALESCE(SUM(ob.paid_eur), 0) AS collected,
        COALESCE(SUM(ob.balance_eur), 0) AS outstanding,
        COALESCE(SUM(CASE WHEN ob.is_overdue THEN ob.balance_eur ELSE 0 END), 0) AS overdue,
        CASE WHEN SUM(ob.contract_total_eur) > 0
          THEN ROUND((SUM(ob.paid_eur) / SUM(ob.contract_total_eur) * 100)::numeric, 1) ELSE 0 END AS collection_pct
      FROM outstanding_balances ob
      WHERE ${where}
        AND ob.sales_agent IS NOT NULL
      GROUP BY ob.sales_agent
      ORDER BY outstanding DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 7. GET /api/finance/contract/:id/detail ──
router.get('/contract/:id/detail', async (req, res) => {
  try {
    const contractId = req.params.id;

    const contract = await query(`
      SELECT c.*, e.name AS expo_name, e.country AS expo_country, e.start_date AS expo_start_date
      FROM contracts c
      LEFT JOIN expos e ON c.expo_id = e.id
      WHERE c.id = $1
    `, [contractId]);

    if (contract.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const payments = await query(`
      SELECT * FROM contract_payments
      WHERE contract_id = $1
      ORDER BY payment_date ASC
    `, [contractId]);

    const schedule = await query(`
      SELECT * FROM contract_payment_schedule
      WHERE contract_id = $1
      ORDER BY installment_no ASC
    `, [contractId]);

    res.json({
      contract: contract.rows[0],
      payments: payments.rows,
      schedule: schedule.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8. GET /api/finance/forecast ──
router.get('/forecast', async (req, res) => {
  try {
    const weeks = Math.min(Number(req.query.weeks) || 8, 12);
    const mode = req.query.mode || 'edition';

    const modeWhere = mode === 'fiscal'
      ? `AND EXTRACT(YEAR FROM c.contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
      : `AND e.start_date >= CURRENT_DATE AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'`;

    const result = await query(`
      SELECT
        DATE_TRUNC('week', cps.due_date)::date AS week_start,
        COALESCE(SUM(cps.planned_amount_eur), 0) AS expected_amount,
        COUNT(*) AS payment_count,
        COUNT(DISTINCT c.id) AS contract_count
      FROM contract_payment_schedule cps
      JOIN contracts c ON cps.contract_id = c.id
      JOIN expos e ON c.expo_id = e.id
      WHERE cps.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${weeks} weeks'
        AND c.status IN ('Valid', 'Transferred In')
        AND c.payment_done IS NOT TRUE
        AND COALESCE(c.balance_eur, 0) > 0
        ${modeWhere}
      GROUP BY DATE_TRUNC('week', cps.due_date)
      ORDER BY week_start ASC
    `);

    // Calculate totals
    const totalAmount = result.rows.reduce((s, r) => s + Number(r.expected_amount), 0);
    const totalPayments = result.rows.reduce((s, r) => s + Number(r.payment_count), 0);

    res.json({
      weeks: result.rows.map(r => ({
        week_start: r.week_start,
        expected_amount: Number(r.expected_amount),
        payment_count: Number(r.payment_count),
        contract_count: Number(r.contract_count),
      })),
      total_amount: totalAmount,
      total_payments: totalPayments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 9. GET /api/finance/recent-activity ──
router.get('/recent-activity', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const result = await query(`
      SELECT
        cp.payment_date AS event_date,
        'payment_received' AS event_type,
        cp.af_number,
        c.company_name,
        e.name AS expo_name,
        cp.amount_eur AS amount,
        cp.amount_local,
        cp.currency,
        cp.note
      FROM contract_payments cp
      JOIN contracts c ON cp.contract_id = c.id
      LEFT JOIN expos e ON c.expo_id = e.id
      WHERE cp.payment_date IS NOT NULL
      ORDER BY cp.payment_date DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
