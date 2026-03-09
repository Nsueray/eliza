require('dotenv').config({ path: '../../.env' });
const { query } = require('../db/index.js');

async function getExpoMetrics() {
  const result = await query(`
    SELECT
      e.name AS expo_name,
      e.country AS expo_country,
      e.start_date,
      COUNT(c.id) AS contracts,
      SUM(c.m2) AS total_m2,
      SUM(c.revenue) AS total_revenue,
      ROUND(AVG(c.m2), 1) AS avg_stand_size,
      COUNT(DISTINCT c.country) AS country_count
    FROM contracts c
    JOIN expos e ON c.expo_id = e.id
    GROUP BY e.id, e.name, e.country, e.start_date
    ORDER BY total_revenue DESC
  `);

  const rows = result.rows;

  // Formatted table
  console.log('\n=== ELIZA Expo Metrics ===\n');
  console.log(
    'Expo'.padEnd(45),
    'Country'.padEnd(12),
    'Start Date'.padEnd(12),
    'Contracts'.padEnd(11),
    'Total M2'.padEnd(10),
    'Revenue'.padEnd(14),
    'Avg M2'.padEnd(8),
    'Countries'
  );
  console.log('-'.repeat(125));

  for (const row of rows) {
    console.log(
      (row.expo_name || '').padEnd(45),
      (row.expo_country || '-').padEnd(12),
      (row.start_date ? row.start_date.toISOString().slice(0, 10) : '-').padEnd(12),
      String(row.contracts).padEnd(11),
      String(row.total_m2 || 0).padEnd(10),
      Number(row.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }).padEnd(14),
      String(row.avg_stand_size || 0).padEnd(8),
      String(row.country_count)
    );
  }

  // Top 3 by revenue
  console.log('\n=== Top 3 Expos by Revenue ===\n');
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const row = rows[i];
    console.log(
      `${i + 1}. ${row.expo_name}`,
      `— Revenue: ${Number(row.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `| Contracts: ${row.contracts}`,
      `| M2: ${row.total_m2}`
    );
  }

  // Totals
  let totalContracts = 0;
  let totalM2 = 0;
  let totalRevenue = 0;

  for (const row of rows) {
    totalContracts += parseInt(row.contracts);
    totalM2 += parseFloat(row.total_m2 || 0);
    totalRevenue += parseFloat(row.total_revenue || 0);
  }

  console.log('\n=== Totals Across All Expos ===\n');
  console.log(`Total contracts: ${totalContracts}`);
  console.log(`Total M2:        ${totalM2.toLocaleString('en-US')}`);
  console.log(`Total revenue:   ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
}

getExpoMetrics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
