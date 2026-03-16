const express = require('express');
const router = express.Router();
const { query } = require('../../../../packages/db/index.js');

// GET /api/system/status — System status overview
router.get('/status', async (req, res) => {
  try {
    // Table row counts
    const tablesResult = await query(`
      SELECT relname, n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `);

    // Last sync
    const syncResult = await query(`
      SELECT * FROM sync_log
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    // Active users with last message
    const usersResult = await query(`
      SELECT
        u.name,
        u.role,
        u.is_active,
        (SELECT MAX(created_at) FROM message_logs WHERE user_phone = u.whatsapp_phone) AS last_message
      FROM users u
      WHERE u.is_active = true
      ORDER BY last_message DESC NULLS LAST
    `);

    // Recent errors
    const errorsResult = await query(`
      SELECT id, user_name, message_text, error, created_at
      FROM message_logs
      WHERE error IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Service URLs
    const services = {
      api: 'https://eliza-api-8tkr.onrender.com',
      bot: 'https://eliza-bot-r1vx.onrender.com',
      dashboard: 'https://eliza.elanfairs.com',
    };

    res.json({
      tables: tablesResult.rows,
      last_sync: syncResult.rows[0] || null,
      users: usersResult.rows,
      recent_errors: errorsResult.rows,
      services,
      db_connected: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      db_connected: false,
    });
  }
});

// GET /api/system/sync-status — Recent sync logs
router.get('/sync-status', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, sync_type, module, started_at, completed_at,
             records_synced, records_updated, status, error_message
      FROM sync_log
      ORDER BY started_at DESC
      LIMIT 20
    `);
    res.json({ syncs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system/sync-now — Trigger manual sync
router.post('/sync-now', async (req, res) => {
  try {
    const { runSync } = require('../../../../packages/zoho-sync/scheduler');
    // Run async — don't block the response
    runSync('manual').catch((err) => {
      console.error('Manual sync failed:', err.message);
    });
    res.json({ success: true, message: 'Sync triggered. Check /api/system/sync-status for results.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
