const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');
const { generateAlerts, getUnsentAlerts, markSent } = require('../alerts/index.js');
const { scan: attentionScan } = require('../attention/index.js');
const { calculateMetrics } = require('../ai/riskEngine.js');

/**
 * Check if today's briefing was already sent.
 */
async function wasSentToday() {
  const result = await query(`
    SELECT 1 FROM sent_briefings
    WHERE briefing_date = CURRENT_DATE
    LIMIT 1
  `);
  return result.rows.length > 0;
}

/**
 * Generate the morning briefing content.
 * Returns { text, alertCount, stats }.
 */
async function generateBriefing() {
  // Refresh data sources
  await calculateMetrics();
  await attentionScan();
  await generateAlerts();

  const today = new Date();
  const dateStr = today.toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Get top alerts (max 5)
  const alerts = await getUnsentAlerts();

  // Yesterday's sales stats
  const statsResult = await query(`
    SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts
    WHERE contract_date = CURRENT_DATE - INTERVAL '1 day'
  `);
  const stats = statsResult.rows[0] || { contracts: 0, total_m2: 0, revenue_eur: 0 };

  // Build briefing text
  const lines = [];
  lines.push(`ELIZA Sabah Brifing — ${dateStr}`);
  lines.push('');

  if (alerts.length > 0) {
    const critCount = alerts.filter(a => a.severity === 'critical').length;
    const warnCount = alerts.filter(a => a.severity === 'warning').length;

    if (critCount > 0) {
      lines.push(`🔴 ${critCount} kritik konu dikkat gerektiriyor:`);
    } else if (warnCount > 0) {
      lines.push(`🟡 ${warnCount} konu dikkat gerektiriyor:`);
    } else {
      lines.push(`ℹ️ ${alerts.length} bilgilendirme:`);
    }

    for (const a of alerts) {
      const icon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`${icon} ${a.title}`);
      if (a.description) {
        lines.push(`   ${a.description}`);
      }
    }
  } else {
    lines.push('✅ Bugün dikkat gerektiren konu yok.');
  }

  lines.push('');

  const c = Number(stats.contracts);
  const m2 = Number(stats.total_m2);
  const rev = Number(stats.revenue_eur).toLocaleString('de-DE');
  if (c > 0) {
    lines.push(`📊 Dün: ${c} yeni kontrat / ${m2} m² / €${rev}`);
  } else {
    lines.push('📊 Dün yeni kontrat yok.');
  }

  const text = lines.join('\n');

  return { text, alertCount: alerts.length, alerts, stats };
}

/**
 * Send the morning briefing via WhatsApp (Twilio).
 * Returns { sent, text } or { sent: false, reason }.
 */
async function sendBriefing() {
  // Check dedup
  if (await wasSentToday()) {
    return { sent: false, reason: 'Briefing already sent today' };
  }

  const { text, alerts } = await generateBriefing();

  // Send via WhatsApp if credentials are configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  const toNumber = process.env.CEO_WHATSAPP_NUMBER;

  let sentVia = 'log';

  if (accountSid && authToken && fromNumber && toNumber) {
    try {
      const twilio = require('twilio')(accountSid, authToken);
      await twilio.messages.create({
        body: text,
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
      });
      sentVia = 'whatsapp';
    } catch (err) {
      console.error('WhatsApp send failed:', err.message);
      sentVia = 'log_fallback';
    }
  } else {
    console.log('WhatsApp credentials not configured. Briefing logged only.');
    console.log('---');
    console.log(text);
    console.log('---');
  }

  // Record in sent_briefings
  await query(`
    INSERT INTO sent_briefings (briefing_date, content, sent_via)
    VALUES (CURRENT_DATE, $1, $2)
  `, [text, sentVia]);

  // Mark alerts as sent
  if (alerts.length > 0) {
    await markSent(alerts.map(a => a.id));
  }

  return { sent: true, via: sentVia, text };
}

module.exports = { generateBriefing, sendBriefing, wasSentToday };
