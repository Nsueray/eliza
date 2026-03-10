const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sendBriefing } = require('./index.js');

// Schedule: 08:00 Turkey time (Europe/Istanbul = UTC+3)
const CRON_HOUR_UTC = 5; // 08:00 TR = 05:00 UTC
const CRON_MINUTE = 0;

function msUntilNext() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(CRON_HOUR_UTC, CRON_MINUTE, 0, 0);

  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next - now;
}

function formatMs(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

async function tick() {
  console.log(`[${new Date().toISOString()}] Morning briefing triggered`);
  try {
    const result = await sendBriefing();
    if (result.sent) {
      console.log(`Briefing sent via ${result.via}`);
    } else {
      console.log(`Briefing skipped: ${result.reason}`);
    }
  } catch (err) {
    console.error('Briefing error:', err.message);
  }

  // Schedule next
  const delay = msUntilNext();
  console.log(`Next briefing in ${formatMs(delay)}`);
  setTimeout(tick, delay);
}

// Start
console.log('ELIZA Morning Brief Scheduler started');
console.log(`Schedule: 08:00 TR (05:00 UTC) daily`);

const delay = msUntilNext();
console.log(`Next briefing in ${formatMs(delay)}`);
setTimeout(tick, delay);

// Also expose manual trigger
if (process.argv.includes('--now')) {
  console.log('Manual trigger: --now flag detected');
  sendBriefing().then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
