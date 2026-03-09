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
  };
}

async function syncSalesOrders() {
  const token = await getAccessToken();
  const records = await fetchAllSalesOrders(token);

  console.log(`Total records fetched: ${records.length}`);

  // Load expos into a lookup map
  const expoResult = await query('SELECT id, name FROM expos');
  const expoMap = {};
  for (const row of expoResult.rows) {
    expoMap[row.name] = row.id;
  }
  console.log(`Loaded ${Object.keys(expoMap).length} expos into lookup map`);

  let inserted = 0;
  let skipped = 0;
  let matched = 0;
  let unmatched = 0;

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
      `INSERT INTO contracts (af_number, company_name, country, sales_agent, m2, revenue, contract_date, sales_type, expo_id, currency, exchange_rate, revenue_eur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (af_number) DO UPDATE SET expo_id = EXCLUDED.expo_id, currency = EXCLUDED.currency, exchange_rate = EXCLUDED.exchange_rate, revenue_eur = EXCLUDED.revenue_eur`,
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
      ]
    );

    if (result.rowCount > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`Sync complete: ${inserted} inserted/updated, ${skipped} skipped`);
  console.log(`Expo matching: ${matched} matched, ${unmatched} no match`);
}

syncSalesOrders().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
