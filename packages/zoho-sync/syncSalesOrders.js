require('dotenv').config({ path: '../../.env' });
const { getAccessToken } = require('./zohoAuth');
const { query } = require('../db/index.js');

const SALES_ORDERS_URL = 'https://www.zohoapis.com/crm/v2/Sales_Orders';

async function fetchAllSalesOrders(token) {
  const allRecords = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${SALES_ORDERS_URL}?page=${page}&per_page=200`, {
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Zoho API request failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const records = data.data || [];
    allRecords.push(...records);

    console.log(`Page ${page}: fetched ${records.length} records`);

    hasMore = data.info && data.info.more_records;
    page++;
  }

  return allRecords;
}

function getExpoName(record) {
  if (record.Expo_Name && record.Expo_Name.name) return record.Expo_Name.name;
  if (typeof record.Expo_Name === 'string') return record.Expo_Name;
  return null;
}

function mapRecord(record, expoMap) {
  const expoName = getExpoName(record);
  const revenue = record.Grand_Total ?? null;
  const currency = record.Currency || null;
  const exchangeRate = record.Exchange_Rate ?? null;

  let revenueEur = null;
  if (revenue !== null) {
    if (!currency || currency === 'EUR' || !exchangeRate || exchangeRate <= 0) {
      revenueEur = revenue;
    } else {
      revenueEur = revenue / exchangeRate;
    }
  }

  // Convert payment amounts to EUR using same exchange rate
  function toEur(val) {
    if (val == null) return null;
    if (!currency || currency === 'EUR' || !exchangeRate || exchangeRate <= 0) return val;
    return val / exchangeRate;
  }

  return {
    af_number: record.AF_Number || null,
    company_name: record.Account_Name ? record.Account_Name.name : null,
    country: record.Country || null,
    sales_agent: record.Sales_Agent ? record.Sales_Agent.name : null,
    m2: record.M2 ?? null,
    revenue: revenue,
    contract_date: record.Contract_Date || null,
    sales_type: record.Sales_Type || null,
    expo_id: expoName ? (expoMap[expoName] || null) : null,
    expo_name: expoName,
    currency: currency,
    exchange_rate: exchangeRate,
    revenue_eur: revenueEur,
    status: record.Status || null,
    // Payment fields
    balance_eur: toEur(record.Balance1),
    paid_eur: toEur(record.Total_Payment),
    remaining_payment_eur: toEur(record.Remaining_Payment),
    due_date: record.Due_Date || null,
    payment_done: record.Payment_Done ?? null,
    payment_method: record.Payment_Method || null,
    validity: record.Validity || null,
    // Subform data (raw, processed in second pass)
    _received_payments: record.Received_Payment || null,
  };
}


/**
 * Sync received payments (Zoho Received_Payment subform) for a contract.
 */
async function syncReceivedPayments(contractId, afNumber, receivedPayments) {
  if (!receivedPayments || !Array.isArray(receivedPayments) || receivedPayments.length === 0) {
    return 0;
  }

  // Delete existing payments for this contract and re-insert
  await query('DELETE FROM contract_payments WHERE contract_id = $1', [contractId]);

  let count = 0;
  for (const payment of receivedPayments) {
    const rawAmount = payment.Payment ?? payment.payment ?? null;
    const date = payment.Date ?? payment.date ?? null;
    let note = payment.Note ?? payment.note ?? null;

    if (rawAmount == null) continue;

    // Parse dual-currency format: "12,960.00 (€1,186.81)" → extract EUR value
    let amountEur = null;
    if (typeof rawAmount === 'string') {
      const eurMatch = rawAmount.match(/\(€([\d,.\s]+)\)/);
      if (eurMatch) {
        // Dual currency format — extract EUR from parentheses
        const eurStr = eurMatch[1].replace(/[\s,]/g, '').replace(',', '.');
        amountEur = parseFloat(eurStr);
        // Preserve original currency info in note
        const originalPart = rawAmount.replace(/\s*\(€[\d,.\s]+\)/, '').trim();
        if (originalPart && amountEur) {
          note = note ? `${note} | ${originalPart} → €${amountEur}` : `${originalPart} → €${amountEur}`;
        }
      } else {
        // Plain string number — parse directly
        const cleaned = rawAmount.replace(/[\s,]/g, '');
        amountEur = parseFloat(cleaned);
      }
    } else {
      amountEur = Number(rawAmount);
    }

    if (amountEur == null || isNaN(amountEur) || amountEur <= 0) continue;

    await query(
      `INSERT INTO contract_payments (contract_id, af_number, payment_date, amount_eur, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [contractId, afNumber, date || null, amountEur, note || null]
    );
    count++;
  }
  return count;
}

/**
 * Sync payment schedule — synthetic only (30% deposit + 70% pre-event).
 * Date_Amount_Type fields are obsolete (pre-2025) and no longer parsed.
 */
async function syncPaymentSchedule(contractId, afNumber, contract) {
  await query('DELETE FROM contract_payment_schedule WHERE contract_id = $1', [contractId]);

  if (!contract.revenue_eur || contract.revenue_eur <= 0) return;

  const depositAmount = Math.round(contract.revenue_eur * 0.30 * 100) / 100;
  const finalAmount = Math.round(contract.revenue_eur * 0.70 * 100) / 100;

  let depositDue = null;
  if (contract.contract_date) {
    const d = new Date(contract.contract_date);
    d.setDate(d.getDate() + 30);
    depositDue = d.toISOString().split('T')[0];
  }

  let finalDue = null;
  if (contract.expo_start_date) {
    const d = new Date(contract.expo_start_date);
    d.setDate(d.getDate() - 30);
    finalDue = d.toISOString().split('T')[0];
  }

  await query(
    `INSERT INTO contract_payment_schedule
     (contract_id, af_number, installment_no, due_date, planned_amount_eur, payment_type, note, source_field, is_synthetic)
     VALUES ($1, $2, 1, $3, $4, 'deposit', 'Synthetic: 30% deposit', 'synthetic', true)`,
    [contractId, afNumber, depositDue, depositAmount]
  );

  await query(
    `INSERT INTO contract_payment_schedule
     (contract_id, af_number, installment_no, due_date, planned_amount_eur, payment_type, note, source_field, is_synthetic)
     VALUES ($1, $2, 2, $3, $4, 'final', 'Synthetic: 70% pre-event', 'synthetic', true)`,
    [contractId, afNumber, finalDue, finalAmount]
  );
}

async function syncSalesOrders() {
  const token = await getAccessToken();
  const records = await fetchAllSalesOrders(token);

  console.log(`Total records fetched: ${records.length}`);

  // Load expos into a lookup map
  const expoResult = await query('SELECT id, name, start_date FROM expos');
  const expoMap = {};
  const expoStartDates = {};
  for (const row of expoResult.rows) {
    expoMap[row.name] = row.id;
    expoStartDates[row.id] = row.start_date;
  }
  console.log(`Loaded ${Object.keys(expoMap).length} expos into lookup map`);

  let inserted = 0;
  let skipped = 0;
  let matched = 0;
  let unmatched = 0;
  let paymentsSync = 0;
  let scheduleSync = 0;

  for (const record of records) {
    const mapped = mapRecord(record, expoMap);

    if (!mapped.af_number) {
      skipped++;
      continue;
    }

    if (mapped.expo_id) {
      matched++;
    } else {
      unmatched++;
    }

    const result = await query(
      `INSERT INTO contracts (af_number, company_name, country, sales_agent, m2, revenue, contract_date, sales_type, expo_id, currency, exchange_rate, revenue_eur, status, balance_eur, paid_eur, remaining_payment_eur, due_date, payment_done, payment_method, validity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (af_number) DO UPDATE SET
         company_name = EXCLUDED.company_name, country = EXCLUDED.country,
         sales_agent = EXCLUDED.sales_agent, m2 = EXCLUDED.m2,
         revenue = EXCLUDED.revenue, contract_date = EXCLUDED.contract_date,
         sales_type = EXCLUDED.sales_type, expo_id = EXCLUDED.expo_id,
         currency = EXCLUDED.currency, exchange_rate = EXCLUDED.exchange_rate,
         revenue_eur = EXCLUDED.revenue_eur, status = EXCLUDED.status,
         balance_eur = EXCLUDED.balance_eur, paid_eur = EXCLUDED.paid_eur,
         remaining_payment_eur = EXCLUDED.remaining_payment_eur,
         due_date = EXCLUDED.due_date, payment_done = EXCLUDED.payment_done,
         payment_method = EXCLUDED.payment_method, validity = EXCLUDED.validity
       RETURNING id`,
      [
        mapped.af_number,
        mapped.company_name,
        mapped.country,
        mapped.sales_agent,
        mapped.m2,
        mapped.revenue,
        mapped.contract_date,
        mapped.sales_type,
        mapped.expo_id,
        mapped.currency,
        mapped.exchange_rate,
        mapped.revenue_eur,
        mapped.status,
        mapped.balance_eur,
        mapped.paid_eur,
        mapped.remaining_payment_eur,
        mapped.due_date,
        mapped.payment_done,
        mapped.payment_method,
        mapped.validity,
      ]
    );

    if (result.rowCount > 0) {
      inserted++;
      const contractId = result.rows[0].id;

      // Sync received payments (subform)
      try {
        const pCount = await syncReceivedPayments(
          contractId, mapped.af_number, mapped._received_payments
        );
        paymentsSync += pCount;
      } catch (err) {
        console.error(`  [payments] Error syncing payments for ${mapped.af_number}: ${err.message}`);
      }

      // Sync payment schedule (synthetic: 30% deposit + 70% pre-event)
      try {
        await syncPaymentSchedule(
          contractId, mapped.af_number,
          {
            revenue_eur: mapped.revenue_eur,
            contract_date: mapped.contract_date,
            expo_start_date: mapped.expo_id ? expoStartDates[mapped.expo_id] : null,
          }
        );
        scheduleSync++;
      } catch (err) {
        console.error(`  [schedule] Error syncing schedule for ${mapped.af_number}: ${err.message}`);
      }
    } else {
      skipped++;
    }
  }

  console.log(`Sync complete: ${inserted} inserted/updated, ${skipped} skipped`);
  console.log(`Expo matching: ${matched} matched, ${unmatched} no match`);
  console.log(`Schedules processed: ${scheduleSync} contracts`);

  // ═══ SECOND PASS: Fetch Received_Payment subform for contracts with payments ═══
  // Zoho list API does not return subform data — individual record fetch required
  console.log('\n--- Second pass: syncing Received_Payment subform ---');
  const paidContracts = await query(
    `SELECT id, af_number FROM contracts WHERE paid_eur > 0`
  );
  console.log(`Contracts with payments: ${paidContracts.rows.length}`);

  // Build AF_Number → Zoho record ID map from the fetched records
  const zohoIdMap = {};
  for (const record of records) {
    if (record.AF_Number && record.id) {
      zohoIdMap[record.AF_Number] = record.id;
    }
  }

  let paymentsFetched = 0;
  let paymentsErrors = 0;

  for (const row of paidContracts.rows) {
    const zohoId = zohoIdMap[row.af_number];
    if (!zohoId) continue;

    try {
      const resp = await fetch(`https://www.zohoapis.com/crm/v2/Sales_Orders/${zohoId}`, {
        headers: { Authorization: 'Zoho-oauthtoken ' + token },
      });
      if (!resp.ok) {
        paymentsErrors++;
        continue;
      }
      const data = await resp.json();
      const record = data.data && data.data[0];
      if (!record || !record.Received_Payment) continue;

      const pCount = await syncReceivedPayments(
        row.id, row.af_number, record.Received_Payment
      );
      if (pCount > 0) {
        paymentsFetched += pCount;
      }
    } catch (err) {
      paymentsErrors++;
      console.error(`  [payments] Error fetching ${row.af_number}: ${err.message}`);
    }
  }

  console.log(`Received payments synced: ${paymentsFetched} records (${paymentsErrors} errors)`);
  paymentsSync = paymentsFetched;
  console.log(`\nFull sync summary: ${inserted} contracts, ${paymentsFetched} payments, ${scheduleSync} schedules`);
}

module.exports = { syncSalesOrders };

// Run directly if called as script
if (require.main === module) {
  syncSalesOrders().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
