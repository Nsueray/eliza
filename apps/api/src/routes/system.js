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

// GET /api/system/sync-status — Recent sync logs + summary
router.get('/sync-status', async (req, res) => {
  try {
    const syncsResult = await query(`
      SELECT id, sync_type, module, started_at, completed_at,
             records_synced, records_updated, status, error_message
      FROM sync_log
      ORDER BY started_at DESC
      LIMIT 20
    `);

    // Last successful sync
    const lastSuccessResult = await query(`
      SELECT completed_at FROM sync_log
      WHERE status = 'success'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    // Records synced today
    const todayResult = await query(`
      SELECT
        COALESCE(SUM(records_synced), 0) + COALESCE(SUM(records_updated), 0) AS records_today,
        COUNT(*) AS total_syncs_today
      FROM sync_log
      WHERE started_at >= CURRENT_DATE
    `);

    // Active: any sync in last 20 minutes
    const activeResult = await query(`
      SELECT COUNT(*) AS recent
      FROM sync_log
      WHERE started_at >= NOW() - INTERVAL '20 minutes'
    `);

    const lastSyncAt = lastSuccessResult.rows[0]?.completed_at || null;
    let lastSyncAgo = null;
    if (lastSyncAt) {
      const diffMs = Date.now() - new Date(lastSyncAt).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) lastSyncAgo = 'just now';
      else if (diffMin < 60) lastSyncAgo = `${diffMin} min ago`;
      else if (diffMin < 1440) lastSyncAgo = `${Math.floor(diffMin / 60)} hour${Math.floor(diffMin / 60) > 1 ? 's' : ''} ago`;
      else lastSyncAgo = `${Math.floor(diffMin / 1440)} day${Math.floor(diffMin / 1440) > 1 ? 's' : ''} ago`;
    }

    res.json({
      summary: {
        last_sync_at: lastSyncAt,
        last_sync_ago: lastSyncAgo,
        records_today: parseInt(todayResult.rows[0]?.records_today) || 0,
        is_active: parseInt(activeResult.rows[0]?.recent) > 0,
        total_syncs_today: parseInt(todayResult.rows[0]?.total_syncs_today) || 0,
      },
      syncs: syncsResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system/sync-now — Trigger manual sync
router.post('/sync-now', async (req, res) => {
  try {
    const { runSync } = require('../../../../packages/zoho-sync/scheduler');
    const syncType = req.query.type === 'full' ? 'full' : 'incremental';
    // Run async — don't block the response
    runSync(syncType).catch((err) => {
      console.error(`Manual ${syncType} sync failed:`, err.message);
    });
    res.json({ success: true, type: syncType, message: `${syncType.charAt(0).toUpperCase() + syncType.slice(1)} sync triggered. Check /api/system/sync-status for results.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/test-push — Test push message generation (and optionally send)
router.get('/test-push', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const pushType = req.query.type || 'morning_brief';
    const send = req.query.send === 'true';

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter required' });
    }

    const { testPush } = require('../../../../packages/push/index.js');
    const result = await testPush(parseInt(userId), pushType, send);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/push-status — Push message log summary
router.get('/push-status', async (req, res) => {
  try {
    // Recent push logs
    const logsResult = await query(`
      SELECT pl.id, pl.push_type, pl.sent_via, pl.status, pl.error_message, pl.created_at,
             pl.twilio_sid, pl.window_status,
             u.name AS user_name
      FROM push_log pl
      JOIN users u ON u.id = pl.user_id
      ORDER BY pl.created_at DESC
      LIMIT 50
    `);

    // Today's summary
    const todayResult = await query(`
      SELECT push_type, COUNT(*) AS count,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'error') AS errors
      FROM push_log
      WHERE created_at >= CURRENT_DATE
      GROUP BY push_type
    `);

    // Users with push enabled
    const usersResult = await query(`
      SELECT u.id, u.name, u.push_settings
      FROM users u
      WHERE u.is_active = true
        AND u.push_settings IS NOT NULL
        AND u.push_settings != '{}'::jsonb
    `);

    res.json({
      logs: logsResult.rows,
      today: todayResult.rows,
      users: usersResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
