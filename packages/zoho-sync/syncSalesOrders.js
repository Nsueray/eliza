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
    first_payment_eur: toEur(record.st_Payment),
    second_payment_eur: toEur(record.nd_Payment),
    // Subform and schedule fields (raw, processed later)
    _received_payments: record.Received_Payment || null,
    _date_amount_types: [
      record.Date_Amount_Type || null,
      record.Date_Amount_Type1 || null,
      record.Date_Amount_Type2 || null,
      record.Date_Amount_Type3 || null,
      record.Date_Amount_Type4 || null,
    ],
  };
}

// Turkish and French month names → month number
const MONTH_NAMES = {
  // Turkish
  ocak: '01', subat: '02', mart: '03', nisan: '04', mayis: '05', haziran: '06',
  temmuz: '07', agustos: '08', eylul: '09', ekim: '10', kasim: '11', aralik: '12',
  // Turkish with accents (for completeness)
  'şubat': '02', 'mayıs': '05', 'ağustos': '08', 'eylül': '09', 'kasım': '11', 'aralık': '12',
  // French
  janvier: '01', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12',
  'février': '02', 'août': '08', 'décembre': '12',
  // English
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

/**
 * Parse Date_Amount_Type fields into payment schedule entries.
 * Zoho format varies:
 * - "15.04.2026 / 2.000 EUR / Deposit"
 * - "DD/MM/YYYY 2000 EUR Deposit"
 * - "9 mart 1750 euro" (Turkish month name)
 * - "Ocak 2026 - 1000 Euro"
 * We attempt multiple patterns and skip unparseable entries.
 */
function parseDateAmountType(value, fieldName) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) return null;

  const str = value.trim();

  // Pre-check: Try Turkish/French month name pattern first
  // "9 mart 1750 euro", "Ocak 2026 - 1000 Euro", "28 Mart 2022 / 1782.10 Euro"
  const monthNamePattern = /(\d{1,2})?\s*(\w+)\s+(\d{4})?\s*[/\-]?\s*([\d.,]+)\s*(?:EUR|Euro|€)?/i;
  const monthMatch = str.match(monthNamePattern);
  if (monthMatch) {
    const day = monthMatch[1] || '1';
    const monthWord = monthMatch[2].toLowerCase()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o')
      .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
      .replace(/é/g, 'e').replace(/û/g, 'u').replace(/â/g, 'a');
    const month = MONTH_NAMES[monthWord];
    if (month) {
      const year = monthMatch[3] || String(new Date().getFullYear());
      let amountStr = monthMatch[4].replace(/\s/g, '');
      // Parse amount with European format handling
      if (amountStr.includes(',') && amountStr.includes('.')) {
        if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
          amountStr = amountStr.replace(/\./g, '').replace(',', '.');
        } else {
          amountStr = amountStr.replace(/,/g, '');
        }
      } else if (amountStr.includes(',')) {
        const afterComma = amountStr.split(',')[1];
        amountStr = (afterComma && afterComma.length <= 2)
          ? amountStr.replace(',', '.')
          : amountStr.replace(/,/g, '');
      }
      const amount = parseFloat(amountStr);
      if (amount > 0) {
        const dateStr = `${year}-${month}-${day.padStart(2, '0')}`;
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return {
            due_date: dateStr,
            planned_amount_eur: amount,
            payment_type: 'installment',
            note: null,
            source_field: fieldName,
          };
        }
      }
    }
  }

  // Also try: "Month YYYY - AMOUNT" without day (e.g., "Ocak 2026 - 1000 Euro")
  const monthYearFirst = /(\w+)\s+(\d{4})\s*[/\-]\s*([\d.,]+)\s*(?:EUR|Euro|€)?/i;
  const myMatch = str.match(monthYearFirst);
  if (myMatch) {
    const monthWord = myMatch[1].toLowerCase()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o')
      .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
      .replace(/é/g, 'e').replace(/û/g, 'u').replace(/â/g, 'a');
    const month = MONTH_NAMES[monthWord];
    if (month) {
      const year = myMatch[2];
      let amountStr = myMatch[3].replace(/\s/g, '');
      if (amountStr.includes(',') && amountStr.includes('.')) {
        amountStr = (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.'))
          ? amountStr.replace(/\./g, '').replace(',', '.')
          : amountStr.replace(/,/g, '');
      } else if (amountStr.includes(',')) {
        const afterComma = amountStr.split(',')[1];
        amountStr = (afterComma && afterComma.length <= 2)
          ? amountStr.replace(',', '.')
          : amountStr.replace(/,/g, '');
      }
      const amount = parseFloat(amountStr);
      if (amount > 0) {
        return {
          due_date: `${year}-${month}-15`, // Mid-month default when no day
          planned_amount_eur: amount,
          payment_type: 'installment',
          note: null,
          source_field: fieldName,
        };
      }
    }
  }

  // Try pattern: "DD.MM.YYYY / AMOUNT [EUR] / NOTE" or "DD/MM/YYYY / AMOUNT / NOTE"
  // Also handle: "DD.MM.YYYY AMOUNT EUR NOTE"
  const patterns = [
    // Pattern 1: slash-separated "15.04.2026 / 2.000 EUR / Deposit"
    /(\d{1,2}[./]\d{1,2}[./]\d{4})\s*[/\-]\s*([\d.,]+)\s*(?:EUR|€)?\s*[/\-]?\s*(.*)/i,
    // Pattern 2: space-separated "15.04.2026 2000 EUR Deposit"
    /(\d{1,2}[./]\d{1,2}[./]\d{4})\s+([\d.,]+)\s*(?:EUR|€)?\s*(.*)/i,
    // Pattern 3: just amount and date "2000 EUR 15.04.2026"
    /([\d.,]+)\s*(?:EUR|€)\s*(\d{1,2}[./]\d{1,2}[./]\d{4})\s*(.*)/i,
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      let dateStr, amountStr, note;

      if (pattern === patterns[2]) {
        // Pattern 3: amount first, then date
        amountStr = match[1];
        dateStr = match[2];
        note = match[3] || '';
      } else {
        dateStr = match[1];
        amountStr = match[2];
        note = match[3] || '';
      }

      // Parse date (DD.MM.YYYY or DD/MM/YYYY)
      const dateParts = dateStr.split(/[./]/);
      if (dateParts.length !== 3) continue;
      const [day, month, year] = dateParts;
      const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (isNaN(parsedDate.getTime())) continue;

      // Parse amount (handle European format: 2.000,50 or 2,000.50)
      let amount = amountStr.replace(/\s/g, '');
      // European: "2.000,50" → "2000.50"
      if (amount.includes(',') && amount.includes('.')) {
        if (amount.lastIndexOf(',') > amount.lastIndexOf('.')) {
          // European: 2.000,50
          amount = amount.replace(/\./g, '').replace(',', '.');
        } else {
          // US: 2,000.50
          amount = amount.replace(/,/g, '');
        }
      } else if (amount.includes(',')) {
        // Could be European decimal "2000,50" or thousand sep "2,000"
        const afterComma = amount.split(',')[1];
        if (afterComma && afterComma.length <= 2) {
          amount = amount.replace(',', '.'); // decimal
        } else {
          amount = amount.replace(/,/g, ''); // thousand
        }
      } else {
        amount = amount.replace(/\./g, function(m, offset, s) {
          // If last dot and has exactly 2 digits after → decimal
          const afterDot = s.substring(offset + 1);
          if (!afterDot.includes('.') && afterDot.length <= 2) return '.';
          return ''; // thousand separator
        });
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

      // Detect payment type from note
      const noteLower = (note || '').toLowerCase();
      let paymentType = 'installment';
      if (noteLower.includes('deposit') || noteLower.includes('kapora') || noteLower.includes('acompte')) {
        paymentType = 'deposit';
      } else if (noteLower.includes('final') || noteLower.includes('kalan') || noteLower.includes('solde')) {
        paymentType = 'final';
      }

      return {
        due_date: parsedDate.toISOString().split('T')[0],
        planned_amount_eur: parsedAmount,
        payment_type: paymentType,
        note: note.trim() || null,
        source_field: fieldName,
      };
    }
  }

  return null; // Couldn't parse
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
    const amount = payment.Payment ?? payment.payment ?? null;
    const date = payment.Date ?? payment.date ?? null;
    const note = payment.Note ?? payment.note ?? null;

    if (amount == null || amount <= 0) continue;

    await query(
      `INSERT INTO contract_payments (contract_id, af_number, payment_date, amount_eur, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [contractId, afNumber, date || null, amount, note || null]
    );
    count++;
  }
  return count;
}

/**
 * Sync payment schedule from Date_Amount_Type fields + synthetic fallback.
 */
async function syncPaymentSchedule(contractId, afNumber, dateAmountTypes, contract) {
  // Delete existing non-synthetic schedule entries
  await query(
    'DELETE FROM contract_payment_schedule WHERE contract_id = $1 AND is_synthetic = false',
    [contractId]
  );
  // Also delete synthetic entries — they'll be regenerated if needed
  await query(
    'DELETE FROM contract_payment_schedule WHERE contract_id = $1 AND is_synthetic = true',
    [contractId]
  );

  const fieldNames = [
    'Date_Amount_Type', 'Date_Amount_Type1', 'Date_Amount_Type2',
    'Date_Amount_Type3', 'Date_Amount_Type4',
  ];

  let installmentNo = 0;
  let parsedAny = false;

  for (let i = 0; i < dateAmountTypes.length; i++) {
    const value = dateAmountTypes[i];
    if (!value) continue;

    const parsed = parseDateAmountType(value, fieldNames[i]);
    if (!parsed) {
      console.log(`  [schedule] Could not parse ${fieldNames[i]}: "${value}" for ${afNumber}`);
      continue;
    }

    installmentNo++;
    parsedAny = true;

    await query(
      `INSERT INTO contract_payment_schedule
       (contract_id, af_number, installment_no, due_date, planned_amount_eur, payment_type, note, source_field, is_synthetic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
      [
        contractId, afNumber, installmentNo,
        parsed.due_date, parsed.planned_amount_eur, parsed.payment_type,
        parsed.note, parsed.source_field,
      ]
    );
  }

  // Synthetic schedule fallback: if no real schedule parsed
  if (!parsedAny && contract.revenue_eur && contract.revenue_eur > 0) {
    const depositAmount = Math.round(contract.revenue_eur * 0.30 * 100) / 100;
    const finalAmount = Math.round(contract.revenue_eur * 0.70 * 100) / 100;

    // Deposit: contract_date + 30 days
    let depositDue = null;
    if (contract.contract_date) {
      const d = new Date(contract.contract_date);
      d.setDate(d.getDate() + 30);
      depositDue = d.toISOString().split('T')[0];
    }

    // Final: expo start_date - 30 days
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
      `INSERT INTO contracts (af_number, company_name, country, sales_agent, m2, revenue, contract_date, sales_type, expo_id, currency, exchange_rate, revenue_eur, status, balance_eur, paid_eur, remaining_payment_eur, due_date, payment_done, payment_method, validity, first_payment_eur, second_payment_eur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
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
         payment_method = EXCLUDED.payment_method, validity = EXCLUDED.validity,
         first_payment_eur = EXCLUDED.first_payment_eur, second_payment_eur = EXCLUDED.second_payment_eur
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
        mapped.first_payment_eur,
        mapped.second_payment_eur,
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

      // Sync payment schedule (Date_Amount_Type fields + synthetic fallback)
      try {
        await syncPaymentSchedule(
          contractId, mapped.af_number, mapped._date_amount_types,
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
