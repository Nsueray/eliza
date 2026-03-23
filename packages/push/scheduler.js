/**
 * ELIZA Push Message Scheduler
 *
 * Runs every 5 minutes, checks which push types are due, and sends them.
 * Uses push_log for deduplication (one per user per type per day).
 * Per-user timezone: each user receives messages at their local time.
 *
 * Schedule (user's local time):
 *   - morning_brief:  08:00 daily
 *   - midday_pulse:   13:00 daily
 *   - daily_wrap:     16:00 daily
 *   - weekly_report:  08:00 Monday
 *   - weekly_close:   16:00 Friday
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const cron = require('node-cron');
const { PUSH_TYPES, processPushType } = require('./index.js');

/**
 * Check all push types and process them.
 * With per-user timezones, we always check all types — the time/day filtering
 * happens inside processPushType per user based on their timezone.
 */
async function checkAndSend() {
  for (const pushType of PUSH_TYPES) {
    try {
      const result = await processPushType(pushType);
      if (result.sent > 0) {
        console.log(`[push-scheduler] ${pushType}: ${result.sent} sent, ${result.skipped} skipped`);
      }
    } catch (err) {
      console.error(`[push-scheduler] Error processing ${pushType}: ${err.message}`);
    }
  }
}

/**
 * Start the push message scheduler.
 * Runs every 5 minutes.
 */
function startPushScheduler() {
  console.log('[push-scheduler] Starting push message scheduler (every 5 minutes, per-user timezone)');

  // Run immediately on start (catch up if missed)
  checkAndSend().catch(err => {
    console.error('[push-scheduler] Initial check failed:', err.message);
  });

  // Schedule: every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    checkAndSend().catch(err => {
      console.error('[push-scheduler] Scheduled check failed:', err.message);
    });
  });
}

// Allow standalone execution
if (require.main === module) {
  startPushScheduler();
  console.log('Push scheduler running. Press Ctrl+C to stop.');
}

module.exports = { startPushScheduler, checkAndSend };
