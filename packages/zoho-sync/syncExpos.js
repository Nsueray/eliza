require('dotenv').config({ path: '../../.env' });
const { getAccessToken } = require('./zohoAuth');
const { query } = require('../db/index.js');

const VENDORS_URL = 'https://www.zohoapis.com/crm/v2/Vendors';

async function fetchAllVendors(token) {
  const allRecords = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${VENDORS_URL}?page=${page}&per_page=200`, {
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

function mapRecord(record) {
  const startDate = record.Baslangic_Tarihi || null;
  const endDate = record.Bitis_Tarihi || null;
  const editionYear = startDate ? parseInt(startDate.substring(0, 4)) : null;

  return {
    name: record.Vendor_Name || null,
    country: record.Country1 || null,
    city: record.City || null,
    start_date: startDate,
    end_date: endDate,
    edition_year: editionYear,
  };
}

async function syncExpos() {
  const token = await getAccessToken();
  const records = await fetchAllVendors(token);

  console.log(`\nTotal records fetched: ${records.length}`);
  console.log('\nFirst raw Zoho record:');
  console.log(JSON.stringify(records[0], null, 2));

  // Add unique constraint if not exists
  await query(`
    ALTER TABLE expos
    ADD CONSTRAINT expos_name_year_unique UNIQUE (name, edition_year)
  `).catch((err) => {
    if (err.code === '42710' || err.message.includes('already exists')) {
      console.log('\nUnique constraint already exists');
    } else {
      throw err;
    }
  });

  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const mapped = mapRecord(record);

    if (!mapped.name) {
      skipped++;
      continue;
    }

    const result = await query(
      `INSERT INTO expos (name, country, city, start_date, end_date, edition_year)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (name, edition_year) DO NOTHING`,
      [mapped.name, mapped.country, mapped.city, mapped.start_date, mapped.end_date, mapped.edition_year]
    );

    if (result.rowCount > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`\nSync complete: ${inserted} inserted, ${skipped} skipped`);

  const countResult = await query('SELECT COUNT(*) FROM expos');
  console.log(`Total expos in database: ${countResult.rows[0].count}`);
}

syncExpos().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
