const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');
const {
  calculateAutoTarget,
  createOrUpdateClusters,
  seedAutoTargets,
  getPreviousEdition,
} = require('../../../../packages/targets/index.js');

/**
 * GET /api/targets?year=2026&mode=edition
 * Main endpoint: summary + clusters + standalone expos with actuals.
 */
router.get('/', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const mode = req.query.mode || 'edition';

    // Get all expos for the year with targets + actuals
    const statusFilter = mode === 'fiscal'
      ? `('Valid', 'Transferred Out')`
      : `('Valid', 'Transferred In')`;

    const dateCol = mode === 'fiscal' ? 'c.contract_date' : 'e.start_date';

    const expoResult = await query(`
      SELECT
        e.id AS expo_id,
        e.name AS expo_name,
        e.city,
        e.country,
        e.start_date,
        e.end_date,
        e.cluster_id,
        ec.name AS cluster_name,
        ec.city AS cluster_city,
        ec.country AS cluster_country,
        ec.start_date AS cluster_start_date,
        et.id AS target_id,
        COALESCE(et.target_m2, 0) AS target_m2,
        COALESCE(et.target_revenue, 0) AS target_revenue,
        et.source,
        et.auto_base_expo_id,
        et.auto_percentage,
        et.notes AS target_notes,
        COALESCE(SUM(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN c.m2 ELSE 0 END), 0) AS actual_m2,
        COALESCE(SUM(c.revenue_eur), 0) AS actual_revenue,
        COUNT(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN 1 END) AS contracts,
        GREATEST(e.start_date::date - CURRENT_DATE, 0) AS days_to_expo
      FROM expos e
      LEFT JOIN expo_targets et ON et.expo_id = e.id
      LEFT JOIN expo_clusters ec ON ec.id = e.cluster_id
      LEFT JOIN contracts c ON c.expo_id = e.id AND c.status IN ${statusFilter}
      WHERE EXTRACT(YEAR FROM ${dateCol}) = $1
      GROUP BY e.id, e.name, e.city, e.country, e.start_date, e.end_date,
               e.cluster_id, ec.name, ec.city, ec.country, ec.start_date,
               et.id, et.target_m2, et.target_revenue, et.source,
               et.auto_base_expo_id, et.auto_percentage, et.notes
      ORDER BY e.start_date ASC, e.name ASC
    `, [year]);

    const expos = expoResult.rows;

    // Build summary
    let totalTargetM2 = 0, totalActualM2 = 0, totalTargetRev = 0, totalActualRev = 0;
    for (const e of expos) {
      totalTargetM2 += Number(e.target_m2);
      totalActualM2 += Number(e.actual_m2);
      totalTargetRev += Number(e.target_revenue);
      totalActualRev += Number(e.actual_revenue);
    }

    const summary = {
      total_target_m2: totalTargetM2,
      total_actual_m2: totalActualM2,
      total_target_revenue: totalTargetRev,
      total_actual_revenue: totalActualRev,
      m2_progress: totalTargetM2 > 0 ? Math.round((totalActualM2 / totalTargetM2) * 1000) / 10 : 0,
      revenue_progress: totalTargetRev > 0 ? Math.round((totalActualRev / totalTargetRev) * 1000) / 10 : 0,
      expo_count: expos.length,
      has_targets: expos.some(e => Number(e.target_m2) > 0 || Number(e.target_revenue) > 0),
    };

    // Group into clusters + standalone
    const clusterMap = {};
    const standalone = [];

    for (const e of expos) {
      const row = {
        expo_id: e.expo_id,
        expo_name: e.expo_name,
        city: e.city,
        country: e.country,
        start_date: e.start_date,
        target_m2: Number(e.target_m2),
        actual_m2: Number(e.actual_m2),
        target_revenue: Number(e.target_revenue),
        actual_revenue: Number(e.actual_revenue),
        m2_progress: Number(e.target_m2) > 0 ? Math.round((Number(e.actual_m2) / Number(e.target_m2)) * 1000) / 10 : 0,
        revenue_progress: Number(e.target_revenue) > 0 ? Math.round((Number(e.actual_revenue) / Number(e.target_revenue)) * 1000) / 10 : 0,
        contracts: Number(e.contracts),
        source: e.source || 'none',
        auto_percentage: e.auto_percentage ? Number(e.auto_percentage) : null,
        days_to_expo: Number(e.days_to_expo),
        has_target: e.target_id !== null,
      };

      if (e.cluster_id && mode !== 'fiscal') {
        if (!clusterMap[e.cluster_id]) {
          clusterMap[e.cluster_id] = {
            cluster_id: e.cluster_id,
            cluster_name: e.cluster_name,
            city: e.cluster_city,
            country: e.cluster_country,
            start_date: e.cluster_start_date,
            expos: [],
          };
        }
        clusterMap[e.cluster_id].expos.push(row);
      } else {
        standalone.push(row);
      }
    }

    // Calculate cluster totals
    const clusters = Object.values(clusterMap).map(c => {
      const totals = {
        target_m2: c.expos.reduce((s, e) => s + e.target_m2, 0),
        actual_m2: c.expos.reduce((s, e) => s + e.actual_m2, 0),
        target_revenue: c.expos.reduce((s, e) => s + e.target_revenue, 0),
        actual_revenue: c.expos.reduce((s, e) => s + e.actual_revenue, 0),
      };
      totals.m2_progress = totals.target_m2 > 0 ? Math.round((totals.actual_m2 / totals.target_m2) * 1000) / 10 : 0;
      totals.revenue_progress = totals.target_revenue > 0 ? Math.round((totals.actual_revenue / totals.target_revenue) * 1000) / 10 : 0;
      return { ...c, cluster_total: totals };
    });

    // Sort clusters by start_date
    clusters.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    res.json({ summary, clusters, standalone });
  } catch (err) {
    console.error('Targets GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/targets/:expo_id
 * Set or update target for a single expo.
 * Body: { method: "manual"|"auto", target_m2, target_revenue, percentage, notes }
 */
router.put('/:expo_id', async (req, res) => {
  try {
    const expoId = Number(req.params.expo_id);
    const { method, target_m2, target_revenue, percentage, notes } = req.body;

    let finalTarget;

    if (method === 'auto') {
      const pct = percentage !== undefined ? Number(percentage) : 15;
      const auto = await calculateAutoTarget(expoId, pct);
      if (!auto) {
        return res.status(404).json({ error: 'Expo not found' });
      }
      finalTarget = {
        target_m2: auto.target_m2,
        target_revenue: auto.target_revenue,
        source: auto.source,
        auto_base_expo_id: auto.auto_base_expo_id,
        auto_percentage: pct,
      };
    } else {
      // Manual
      finalTarget = {
        target_m2: Number(target_m2) || 0,
        target_revenue: Number(target_revenue) || 0,
        source: 'manual',
        auto_base_expo_id: null,
        auto_percentage: null,
      };
    }

    await query(`
      INSERT INTO expo_targets (expo_id, target_m2, target_revenue, source, auto_base_expo_id, auto_percentage, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (expo_id) DO UPDATE SET
        target_m2 = $2,
        target_revenue = $3,
        source = $4,
        auto_base_expo_id = $5,
        auto_percentage = $6,
        notes = COALESCE($7, expo_targets.notes),
        updated_at = NOW()
    `, [expoId, finalTarget.target_m2, finalTarget.target_revenue, finalTarget.source, finalTarget.auto_base_expo_id, finalTarget.auto_percentage, notes || null]);

    // Return updated target
    const result = await query(`
      SELECT et.*, e.name AS expo_name
      FROM expo_targets et
      JOIN expos e ON e.id = et.expo_id
      WHERE et.expo_id = $1
    `, [expoId]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Target PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/targets/seed?year=2026&percentage=15
 * Seed auto targets + detect clusters for a year.
 */
router.post('/seed', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const percentage = Number(req.query.percentage) || 15;

    // 1. Detect and create clusters
    const clusters = await createOrUpdateClusters(year);

    // 2. Seed auto targets
    const targets = await seedAutoTargets(year, percentage);

    res.json({
      success: true,
      year,
      percentage,
      clusters_created: clusters.length,
      clusters,
      targets_seeded: targets.seeded,
      targets_total: targets.total,
    });
  } catch (err) {
    console.error('Target seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/targets/clusters?year=2026
 * List clusters for a year.
 */
router.get('/clusters', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const result = await query(`
      SELECT ec.*,
        ARRAY_AGG(e.name ORDER BY e.name) AS expo_names,
        COUNT(e.id) AS expo_count
      FROM expo_clusters ec
      JOIN expos e ON e.cluster_id = ec.id
      WHERE EXTRACT(YEAR FROM ec.start_date) = $1
      GROUP BY ec.id
      ORDER BY ec.start_date ASC
    `, [year]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/targets/previous/:expo_id
 * Get previous edition info for edit modal.
 */
router.get('/previous/:expo_id', async (req, res) => {
  try {
    const prev = await getPreviousEdition(Number(req.params.expo_id));
    res.json(prev || { none: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
