/**
 * Zoho Sync Scheduler — runs incremental sync every 15 minutes.
 *
 * Usage:
 *   Standalone:  node packages/zoho-sync/scheduler.js
 *   From root:   npm run sync:start
 *   Embedded:    require('./scheduler').startSyncScheduler()
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const cron = require('node-cron');
const { query } = require('../db/index.js');
const { syncSalesOrders } = require('./syncSalesOrders.js');
const { syncExpos } = require('./syncExpos.js');

async function logSyncStart(syncType, module) {
  const result = await query(
    `INSERT INTO sync_log (sync_type, module, started_at, status)
     VALUES ($1, $2, NOW(), 'running')
     RETURNING id`,
    [syncType, module],
  );
  return result.rows[0].id;
}

async function logSyncEnd(logId, recordsSynced, recordsUpdated, status, errorMessage) {
  await query(
    `UPDATE sync_log
     SET completed_at = NOW(), records_synced = $2, records_updated = $3,
         status = $4, error_message = $5
     WHERE id = $1`,
    [logId, recordsSynced, recordsUpdated, status, errorMessage],
  );
}

async function runSync(syncType) {
  console.log(`[${new Date().toISOString()}] Starting ${syncType} sync...`);

  // Sync expos first (contracts depend on expo_id lookup)
  let expoLogId;
  try {
    expoLogId = await logSyncStart(syncType, 'expos');
    await syncExpos();
    await logSyncEnd(expoLogId, 0, 0, 'success', null);
    console.log(`[${new Date().toISOString()}] Expos sync complete`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Expos sync error:`, err.message);
    if (expoLogId) {
      await logSyncEnd(expoLogId, 0, 0, 'error', err.message).catch(() => {});
    }
  }

  // Sync contracts
  let contractLogId;
  try {
    contractLogId = await logSyncStart(syncType, 'contracts');
    await syncSalesOrders();
    await logSyncEnd(contractLogId, 0, 0, 'success', null);
    console.log(`[${new Date().toISOString()}] Contracts sync complete`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Contracts sync error:`, err.message);
    if (contractLogId) {
      await logSyncEnd(contractLogId, 0, 0, 'error', err.message).catch(() => {});
    }
  }

  console.log(`[${new Date().toISOString()}] Sync cycle finished\n`);
}

function startSyncScheduler() {
  // Run initial sync (non-blocking — don't await)
  runSync('full').then(() => {
    console.log('Initial full sync complete. Scheduling incremental every 15 minutes.');
  }).catch((err) => {
    console.error('Initial sync failed:', err.message);
  });

  // Schedule: every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runSync('incremental').catch((err) => {
      console.error('Scheduled sync failed:', err.message);
    });
  });
}

// Allow standalone execution: node packages/zoho-sync/scheduler.js
if (require.main === module) {
  startSyncScheduler();
  console.log('Scheduler running. Press Ctrl+C to stop.');
}

module.exports = { startSyncScheduler, runSync };
