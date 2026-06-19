const express = require('express');
const router = express.Router();
const { pool } = require('../../../../packages/db/index.js');

// POST /api/contracts/convert
// Create an ELIZA contract from a signed LIFFY quote payload.
//
// Payload-driven: the caller passes the quote JSON in the LIFFY GET /quotes/:id enrichQuote
// shape (quote columns + af_number + totals + line_items + expo + person + sales_owner).
// There is NO cross-system fetch here — transport is a separate slice. Revenue is READ from
// the payload totals; convert does NOT recompute them.
//
// This is ELIZA's first contract WRITE path (contracts were previously Zoho-sync-only) and
// the first app-code transaction (pool.connect + BEGIN/COMMIT).
router.post('/convert', async (req, res) => {
  // Server-side permission gate (bridge until the permission matrix lands). UI hiding alone is
  // insufficient — an unauthorized user must not be able to call this endpoint directly.
  const role = req.user && req.user.role;
  if (role !== 'ceo' && role !== 'manager') {
    return res.status(403).json({ error: 'Convert requires ceo or manager role' });
  }

  const quote = req.body && req.body.quote;
  if (!quote || typeof quote !== 'object') {
    return res.status(400).json({ error: 'quote payload required' });
  }

  // Guards (before INSERT).
  if (quote.status !== 'signed') {
    return res.status(400).json({ error: 'only signed quotes are convertible' });
  }
  if (!quote.af_number) {
    return res.status(400).json({ error: 'af_number required' });
  }
  if (!quote.id) {
    return res.status(400).json({ error: 'quote.id required' });
  }

  const client = await pool.connect();
  try {
    // Duplicate guard — friendly pre-check. The partial UNIQUE index on source_quote_id
    // (migration 027) makes the operation race-proof even if two converts run at once.
    const dup = await client.query(
      'SELECT id FROM contracts WHERE source_quote_id = $1 LIMIT 1',
      [quote.id]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'quote already converted', contract_id: dup.rows[0].id });
    }

    const totals = quote.totals || {};
    // contract_date = the quote's signed date; fall back to today if absent.
    const contractDate = quote.signed_at || new Date().toISOString().slice(0, 10);

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO contracts (
         af_number, company_name, revenue, revenue_eur, m2, currency, exchange_rate,
         status, contract_date,
         sales_owner_user_id, source_quote_id, converted_by_user_id, converted_at,
         company_id, expo_id, country, sales_agent_id, sales_agent, sales_type
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         'Valid', $8,
         $9, $10, $11, now(),
         NULL, NULL, NULL, NULL, NULL, NULL
       ) RETURNING *`,
      [
        quote.af_number,                       // $1  → contract.af_number (the signed "A...-seq")
        quote.company_name || null,            // $2  → company_name (string)
        totals.grand_total ?? null,            // $3  → revenue (READ from payload, not recomputed)
        totals.grand_total_eur ?? null,        // $4  → revenue_eur
        totals.total_m2 ?? null,               // $5  → m2
        quote.currency || null,                // $6  → currency
        quote.exchange_rate_to_eur ?? null,    // $7  → exchange_rate
        contractDate,                          // $8  → contract_date (signed_at | today)
        quote.sales_owner_user_id || null,     // $9  → sales_owner_user_id (soft-ref UUID)
        quote.id,                              // $10 → source_quote_id (soft-ref UUID)
        // $11 → converted_by_user_id (INTEGER per migration 028 — ELIZA user ids are integer
        // and contracts has no native audit column). Records the real convert actor.
        (req.user && req.user.userId) || null,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({ contract: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Unique violations — distinguish by constraint so the message is meaningful.
    if (err.code === '23505') {
      if (err.constraint === 'idx_contracts_source_quote_id_unique') {
        return res.status(409).json({ error: 'quote already converted' });
      }
      if (err.constraint === 'contracts_af_number_key') {
        return res.status(409).json({ error: `af_number already exists: ${quote.af_number}` });
      }
      return res.status(409).json({ error: 'duplicate value', constraint: err.constraint });
    }
    console.error('[contracts/convert] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
