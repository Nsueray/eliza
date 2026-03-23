/**
 * ELIZA Target System
 *
 * Auto target: previous edition actual × (1 + percentage/100)
 * Clusters: same country + same month = grouped expos
 */
const { query } = require('../db/index.js');

/**
 * Known city→country mapping for expos with NULL country field.
 */
const CITY_COUNTRY = {
  lagos: 'Nigeria', abuja: 'Nigeria',
  casablanca: 'Morocco',
  alger: 'Algeria', algiers: 'Algeria',
  accra: 'Ghana',
  nairobi: 'Kenya',
};

/**
 * Country keywords found in expo names (fallback when both city and country are NULL).
 */
const NAME_COUNTRY_KEYWORDS = [
  'Nigeria', 'Morocco', 'Kenya', 'Algeria', 'Ghana', 'China',
];

/**
 * Calculate auto target from previous edition.
 * "Mega Clima Nigeria 2026" → find "Mega Clima Nigeria 2025" → apply growth %.
 */
async function calculateAutoTarget(expoId, percentage = 15) {
  const expoResult = await query(
    `SELECT id, name, start_date, city, country FROM expos WHERE id = $1`, [expoId]
  );
  const expo = expoResult.rows[0];
  if (!expo) return null;

  // Strip year from name → base pattern
  const namePattern = expo.name.replace(/\s*\d{4}\s*$/, '').trim();
  if (!namePattern) return { target_m2: 0, target_revenue: 0, source: 'no_previous', auto_base_expo_id: null };

  // Find previous edition with actuals
  const prevResult = await query(`
    SELECT e.id, e.name,
      COALESCE(SUM(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN c.m2 ELSE 0 END), 0) AS actual_m2,
      COALESCE(SUM(c.revenue_eur), 0) AS actual_revenue
    FROM expos e
    LEFT JOIN contracts c ON c.expo_id = e.id AND c.status IN ('Valid', 'Transferred In')
    WHERE e.name ILIKE $1 || ' %'
      AND EXTRACT(YEAR FROM e.start_date) < EXTRACT(YEAR FROM $2::date)
    GROUP BY e.id, e.name
    ORDER BY e.start_date DESC
    LIMIT 1
  `, [namePattern, expo.start_date]);

  if (!prevResult.rows[0] || (Number(prevResult.rows[0].actual_m2) === 0 && Number(prevResult.rows[0].actual_revenue) === 0)) {
    return { target_m2: 0, target_revenue: 0, source: 'no_previous', auto_base_expo_id: prevResult.rows[0]?.id || null };
  }

  const prev = prevResult.rows[0];
  const multiplier = 1 + (percentage / 100);

  return {
    target_m2: Math.round(Number(prev.actual_m2) * multiplier),
    target_revenue: Math.round(Number(prev.actual_revenue) * multiplier * 100) / 100,
    source: 'auto',
    auto_base_expo_id: prev.id,
    auto_percentage: percentage,
    previous_name: prev.name,
    previous_m2: Number(prev.actual_m2),
    previous_revenue: Number(prev.actual_revenue),
  };
}

/**
 * Infer country from city or expo name when country column is NULL.
 */
function inferCountry(city, country, name) {
  if (country) return country;
  if (city) {
    const match = CITY_COUNTRY[city.toLowerCase().trim()];
    if (match) return match;
  }
  if (name) {
    for (const kw of NAME_COUNTRY_KEYWORDS) {
      if (name.toLowerCase().includes(kw.toLowerCase())) return kw;
    }
  }
  return null;
}

/**
 * Detect clusters using proximity-based grouping.
 * Expos in the same country whose start_dates are within CLUSTER_PROXIMITY_DAYS
 * of each other form a cluster (connected-components via sorted merge).
 * Country is inferred from city/name when NULL.
 */
const CLUSTER_PROXIMITY_DAYS = 35; // ~1 month tolerance

async function detectClusters(year) {
  const result = await query(`
    SELECT id, name, city, country, start_date::date AS start_date,
           COALESCE(end_date, start_date)::date AS end_date
    FROM expos
    WHERE EXTRACT(YEAR FROM start_date) = $1
    ORDER BY start_date, name
  `, [year]);

  // Group by inferred country
  const byCountry = {};
  for (const e of result.rows) {
    const inferredCountry = inferCountry(e.city, e.country, e.name);
    if (!inferredCountry) continue;
    if (!byCountry[inferredCountry]) byCountry[inferredCountry] = [];
    byCountry[inferredCountry].push(e);
  }

  // Within each country, merge consecutive expos within proximity window
  const clusters = [];
  for (const [country, expos] of Object.entries(byCountry)) {
    // Sort by start_date
    expos.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    // Connected-components: chain expos within CLUSTER_PROXIMITY_DAYS
    const groups = [];
    let current = [expos[0]];
    for (let i = 1; i < expos.length; i++) {
      const prevDate = new Date(current[current.length - 1].start_date);
      const thisDate = new Date(expos[i].start_date);
      const daysDiff = (thisDate - prevDate) / (1000 * 60 * 60 * 24);
      if (daysDiff <= CLUSTER_PROXIMITY_DAYS) {
        current.push(expos[i]);
      } else {
        groups.push(current);
        current = [expos[i]];
      }
    }
    groups.push(current);

    // Only keep groups with 2+ expos
    for (const g of groups) {
      if (g.length < 2) continue;
      const starts = g.map(e => new Date(e.start_date));
      const ends = g.map(e => new Date(e.end_date));
      clusters.push({
        country,
        city: g[0].city,
        cluster_start: new Date(Math.min(...starts)).toISOString().slice(0, 10),
        cluster_end: new Date(Math.max(...ends)).toISOString().slice(0, 10),
        expo_ids: g.map(e => e.id),
        expo_names: g.map(e => e.name),
        expo_count: g.length,
      });
    }
  }

  clusters.sort((a, b) => a.cluster_start.localeCompare(b.cluster_start));
  return clusters;
}

/**
 * Create or update clusters for a year + assign expos to them.
 */
async function createOrUpdateClusters(year) {
  const clusters = await detectClusters(year);
  const created = [];

  // Clear old cluster assignments for the year first
  await query(`
    UPDATE expos SET cluster_id = NULL
    WHERE EXTRACT(YEAR FROM start_date) = $1
  `, [year]);

  for (const c of clusters) {
    const monthName = new Date(c.cluster_start).toLocaleString('en-US', { month: 'long' });
    const clusterName = `${c.country} ${monthName} ${year}`;

    // Upsert cluster
    const upsertResult = await query(`
      INSERT INTO expo_clusters (name, city, country, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date
      RETURNING id
    `, [clusterName, c.city, c.country, c.cluster_start, c.cluster_end]);

    const clusterId = upsertResult.rows[0].id;

    // Assign expos to cluster
    for (const expoId of c.expo_ids) {
      await query(`UPDATE expos SET cluster_id = $1 WHERE id = $2`, [clusterId, expoId]);
    }

    created.push({ clusterId, name: clusterName, expos: c.expo_names });
  }

  return created;
}

/**
 * Seed auto targets for all expos in a year that don't have one yet.
 */
async function seedAutoTargets(year, defaultPercentage = 15) {
  const expos = await query(`
    SELECT id FROM expos
    WHERE EXTRACT(YEAR FROM start_date) = $1
      AND id NOT IN (SELECT expo_id FROM expo_targets)
  `, [year]);

  let seeded = 0;
  for (const expo of expos.rows) {
    const target = await calculateAutoTarget(expo.id, defaultPercentage);
    if (target) {
      await query(`
        INSERT INTO expo_targets (expo_id, target_m2, target_revenue, source, auto_base_expo_id, auto_percentage)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (expo_id) DO NOTHING
      `, [expo.id, target.target_m2, target.target_revenue, target.source, target.auto_base_expo_id, target.auto_percentage]);
      seeded++;
    }
  }

  return { seeded, total: expos.rows.length };
}

/**
 * Get previous edition info for an expo (for edit modal).
 */
async function getPreviousEdition(expoId) {
  const expoResult = await query(
    `SELECT id, name, start_date FROM expos WHERE id = $1`, [expoId]
  );
  const expo = expoResult.rows[0];
  if (!expo) return null;

  const namePattern = expo.name.replace(/\s*\d{4}\s*$/, '').trim();
  if (!namePattern) return null;

  const prevResult = await query(`
    SELECT e.id, e.name,
      COALESCE(SUM(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN c.m2 ELSE 0 END), 0) AS actual_m2,
      COALESCE(SUM(c.revenue_eur), 0) AS actual_revenue,
      COUNT(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN 1 END) AS contracts
    FROM expos e
    LEFT JOIN contracts c ON c.expo_id = e.id AND c.status IN ('Valid', 'Transferred In')
    WHERE e.name ILIKE $1 || ' %'
      AND EXTRACT(YEAR FROM e.start_date) < EXTRACT(YEAR FROM $2::date)
    GROUP BY e.id, e.name
    ORDER BY e.start_date DESC
    LIMIT 1
  `, [namePattern, expo.start_date]);

  return prevResult.rows[0] || null;
}

module.exports = {
  calculateAutoTarget,
  detectClusters,
  createOrUpdateClusters,
  seedAutoTargets,
  getPreviousEdition,
};
