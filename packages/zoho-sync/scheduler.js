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
const { syncSalesOrders, syncPaymentsPass } = require('./syncSalesOrders.js');
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
    const stats = await syncSalesOrders();
    const synced = stats ? stats.inserted : 0;
    await logSyncEnd(contractLogId, synced, 0, 'success', null);
    console.log(`[${new Date().toISOString()}] Contracts sync complete (${synced} records)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Contracts sync error:`, err.message);
    if (contractLogId) {
      await logSyncEnd(contractLogId, 0, 0, 'error', err.message).catch(() => {});
    }
  }

  console.log(`[${new Date().toISOString()}] Sync cycle finished\n`);
}

async function runPaymentSync() {
  console.log(`[${new Date().toISOString()}] Starting payment sync...`);
  let logId;
  try {
    logId = await logSyncStart('payments', 'received_payments');
    await syncPaymentsPass();
    await logSyncEnd(logId, 0, 0, 'success', null);
    console.log(`[${new Date().toISOString()}] Payment sync complete`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Payment sync error:`, err.message);
    if (logId) await logSyncEnd(logId, 0, 0, 'error', err.message).catch(() => {});
  }
}

function startSyncScheduler() {
  // Run initial sync (non-blocking — don't await)
  runSync('full').then(() => {
    console.log('Initial full sync complete. Scheduling list sync hourly + payment sync twice daily.');
  }).catch((err) => {
    console.error('Initial sync failed:', err.message);
  });

  // List sync (expos + contracts): every hour — 24×19 = ~456 API credits/day
  cron.schedule('0 * * * *', () => {
    runSync('incremental').catch((err) => {
      console.error('Scheduled sync failed:', err.message);
    });
  });

  // Payment sync (Received_Payment subform): twice daily at 06:00 and 18:00
  // 2×~980 = ~1,960 API credits/day (vs previous 96×962 = 92,352/day)
  cron.schedule('0 6,18 * * *', () => {
    runPaymentSync().catch((err) => {
      console.error('Payment sync failed:', err.message);
    });
  });
}

// Allow standalone execution: node packages/zoho-sync/scheduler.js
if (require.main === module) {
  startSyncScheduler();
  console.log('Scheduler running. Press Ctrl+C to stop.');
}

module.exports = { startSyncScheduler, runSync };
