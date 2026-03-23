/**
 * ELIZA Push Message Scheduler
 *
 * Runs every 5 minutes, checks which push types are due, and sends them.
 * Uses push_log for deduplication (one per user per type per day).
 *
 * Schedule:
 *   - morning_brief:  08:00 daily
 *   - midday_pulse:   13:00 daily
 *   - daily_wrap:     16:00 daily
 *   - weekly_report:  08:00 Monday
 *   - weekly_close:   16:00 Friday
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const cron = require('node-cron');
const { PUSH_TYPES, DEFAULT_TIMES, processPushType } = require('./index.js');

/**
 * Check which push types should run now and process them.
 */
async function checkAndSend() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat

  // Only process on weekdays (or weekends if configured — for now weekdays only)
  // morning_brief, midday_pulse, daily_wrap: Mon-Fri
  // weekly_report: Monday only
  // weekly_close: Friday only
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend — skip daily types, but weekly_report could be Monday
    return;
  }

  // Check each push type against current time
  for (const pushType of PUSH_TYPES) {
    const defaultTime = DEFAULT_TIMES[pushType];
    const [defH, defM] = defaultTime.split(':').map(Number);

    // Only trigger if we're within the time window (±5 min of default)
    // Individual user times are checked inside processPushType
    const curMin = currentHour * 60 + currentMinute;
    const defMin = defH * 60 + defM;
    if (Math.abs(curMin - defMin) > 10) continue;

    // Day-of-week checks for weekly types
    if (pushType === 'weekly_report' && dayOfWeek !== 1) continue;
    if (pushType === 'weekly_close' && dayOfWeek !== 5) continue;

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
  console.log('[push-scheduler] Starting push message scheduler (every 5 minutes)');

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
