/**
 * ELIZA Push Messages — scheduled WhatsApp notifications.
 *
 * 5 message types:
 *   - morning_brief  (08:00 daily)   — alerts + yesterday's stats
 *   - midday_pulse   (13:00 daily)   — today's progress so far
 *   - daily_wrap     (16:00 daily)   — end-of-day summary
 *   - weekly_report  (08:00 Monday)  — week overview
 *   - weekly_close   (16:00 Friday)  — week close + next week preview
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const PUSH_TYPES = ['morning_brief', 'midday_pulse', 'daily_wrap', 'weekly_report', 'weekly_close'];

const DEFAULT_TIMES = {
  morning_brief: '08:00',
  midday_pulse: '13:00',
  daily_wrap: '16:00',
  weekly_report: '08:00',
  weekly_close: '16:00',
};

/**
 * Check if a push was already sent today for this user+type.
 */
async function wasAlreadySent(userId, pushType) {
  const result = await query(
    `SELECT 1 FROM push_log
     WHERE user_id = $1 AND push_type = $2
       AND created_at >= CURRENT_DATE
       AND status = 'sent'
     LIMIT 1`,
    [userId, pushType]
  );
  return result.rows.length > 0;
}

/**
 * Build scope filter SQL for a user's push_settings.scope.
 * Returns { where, params, paramOffset } for edition_contracts queries.
 */
function buildScopeFilter(user, paramOffset = 1) {
  const scope = user.push_settings?.scope || user.data_scope || 'all';
  if (scope === 'all') return { where: '', params: [], paramOffset };
  if (scope === 'own' && user.sales_agent_name) {
    return {
      where: ` AND c.sales_agent = $${paramOffset}`,
      params: [user.sales_agent_name],
      paramOffset: paramOffset + 1,
    };
  }
  if (scope === 'team' && user.sales_group) {
    return {
      where: ` AND c.sales_agent IN (SELECT sales_agent_name FROM users WHERE sales_group = $${paramOffset})`,
      params: [user.sales_group],
      paramOffset: paramOffset + 1,
    };
  }
  return { where: '', params: [], paramOffset };
}

/**
 * Generate morning brief content.
 * Alerts + yesterday's sales stats.
 */
async function generateMorningBrief(user) {
  const scope = buildScopeFilter(user);
  const today = new Date();
  const dateStr = today.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Yesterday's stats
  const statsResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts c
    WHERE c.contract_date = CURRENT_DATE - INTERVAL '1 day'${scope.where}`,
    scope.params
  );
  const stats = statsResult.rows[0] || { contracts: 0, total_m2: 0, revenue_eur: 0 };

  // Upcoming expos in next 60 days
  const expoResult = await query(`
    SELECT name, start_date,
      GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE
      AND start_date <= CURRENT_DATE + INTERVAL '60 days'
    ORDER BY start_date ASC
    LIMIT 5
  `);

  // Outstanding payments summary
  const payResult = await query(`
    SELECT
      COUNT(*) AS open_count,
      COALESCE(ROUND(SUM(balance_eur)::numeric, 0), 0) AS total_outstanding
    FROM outstanding_balances
  `);
  const pay = payResult.rows[0] || { open_count: 0, total_outstanding: 0 };

  const lines = [];
  lines.push(`ELIZA Sabah Brifing — ${dateStr}`);
  lines.push('');

  const c = Number(stats.contracts);
  const m2 = Number(stats.total_m2);
  const rev = Number(stats.revenue_eur).toLocaleString('de-DE');
  if (c > 0) {
    lines.push(`Dun: ${c} yeni kontrat / ${m2} m2 / €${rev}`);
  } else {
    lines.push('Dun yeni kontrat yok.');
  }

  if (expoResult.rows.length > 0) {
    lines.push('');
    lines.push('Yaklasan fuarlar:');
    for (const expo of expoResult.rows) {
      lines.push(`  ${expo.name} — ${expo.days_left} gun`);
    }
  }

  if (Number(pay.total_outstanding) > 0) {
    lines.push('');
    lines.push(`Acik bakiye: ${pay.open_count} kontrat / €${Number(pay.total_outstanding).toLocaleString('de-DE')}`);
  }

  return lines.join('\n');
}

/**
 * Generate midday pulse content.
 * Today's progress so far.
 */
async function generateMiddayPulse(user) {
  const scope = buildScopeFilter(user);

  // Today's contracts
  const todayResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts c
    WHERE c.contract_date = CURRENT_DATE${scope.where}`,
    scope.params
  );
  const today = todayResult.rows[0] || { contracts: 0, total_m2: 0, revenue_eur: 0 };

  // This week's contracts
  const weekResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts c
    WHERE c.contract_date >= date_trunc('week', CURRENT_DATE)${scope.where}`,
    scope.params
  );
  const week = weekResult.rows[0] || { contracts: 0, total_m2: 0, revenue_eur: 0 };

  // Payments received today
  const payToday = await query(`
    SELECT
      COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date = CURRENT_DATE
  `);
  const pt = payToday.rows[0] || { count: 0, total: 0 };

  const lines = [];
  lines.push('ELIZA Ogle Raporu');
  lines.push('');

  const c = Number(today.contracts);
  if (c > 0) {
    lines.push(`Bugun: ${c} kontrat / ${Number(today.total_m2)} m2 / €${Number(today.revenue_eur).toLocaleString('de-DE')}`);
  } else {
    lines.push('Bugun henuz yeni kontrat yok.');
  }

  lines.push(`Bu hafta: ${Number(week.contracts)} kontrat / ${Number(week.total_m2)} m2 / €${Number(week.revenue_eur).toLocaleString('de-DE')}`);

  if (Number(pt.total) > 0) {
    lines.push(`Bugun gelen odeme: ${pt.count} islem / €${Number(pt.total).toLocaleString('de-DE')}`);
  }

  return lines.join('\n');
}

/**
 * Generate daily wrap content.
 * End-of-day summary.
 */
async function generateDailyWrap(user) {
  const scope = buildScopeFilter(user);

  // Today's full stats
  const todayResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur,
      COUNT(DISTINCT c.sales_agent) AS agents_active
    FROM edition_contracts c
    WHERE c.contract_date = CURRENT_DATE${scope.where}`,
    scope.params
  );
  const today = todayResult.rows[0];

  // Top agent today
  const topAgentResult = await query(
    `SELECT c.sales_agent, COUNT(*) AS cnt,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS rev
    FROM edition_contracts c
    WHERE c.contract_date = CURRENT_DATE
      AND c.sales_agent IS NOT NULL
      AND c.sales_agent != 'ELAN EXPO'${scope.where}
    GROUP BY c.sales_agent
    ORDER BY rev DESC
    LIMIT 1`,
    scope.params
  );

  // Payments today
  const payToday = await query(`
    SELECT
      COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date = CURRENT_DATE
  `);
  const pt = payToday.rows[0] || { count: 0, total: 0 };

  const lines = [];
  lines.push('ELIZA Gun Sonu Ozeti');
  lines.push('');

  const c = Number(today.contracts);
  if (c > 0) {
    lines.push(`Bugun: ${c} kontrat / ${Number(today.total_m2)} m2 / €${Number(today.revenue_eur).toLocaleString('de-DE')}`);
    lines.push(`Aktif agent: ${today.agents_active}`);
    if (topAgentResult.rows.length > 0) {
      const top = topAgentResult.rows[0];
      lines.push(`Gunun en iyisi: ${top.sales_agent} — ${top.cnt} kontrat / €${Number(top.rev).toLocaleString('de-DE')}`);
    }
  } else {
    lines.push('Bugun yeni kontrat yok.');
  }

  if (Number(pt.total) > 0) {
    lines.push(`Tahsilat: ${pt.count} islem / €${Number(pt.total).toLocaleString('de-DE')}`);
  }

  return lines.join('\n');
}

/**
 * Generate weekly report content.
 * Monday morning — previous week overview.
 */
async function generateWeeklyReport(user) {
  const scope = buildScopeFilter(user);

  // Last week stats
  const weekResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts c
    WHERE c.contract_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
      AND c.contract_date < date_trunc('week', CURRENT_DATE)${scope.where}`,
    scope.params
  );
  const week = weekResult.rows[0];

  // Top agents last week
  const agentsResult = await query(
    `SELECT c.sales_agent, COUNT(*) AS cnt,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS rev
    FROM edition_contracts c
    WHERE c.contract_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
      AND c.contract_date < date_trunc('week', CURRENT_DATE)
      AND c.sales_agent IS NOT NULL
      AND c.sales_agent != 'ELAN EXPO'${scope.where}
    GROUP BY c.sales_agent
    ORDER BY rev DESC
    LIMIT 5`,
    scope.params
  );

  // This week's upcoming expos
  const expoResult = await query(`
    SELECT name, start_date,
      GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE
      AND start_date <= CURRENT_DATE + INTERVAL '14 days'
    ORDER BY start_date ASC
    LIMIT 5
  `);

  // Payments last week
  const payResult = await query(`
    SELECT
      COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
      AND payment_date < date_trunc('week', CURRENT_DATE)
  `);
  const pt = payResult.rows[0] || { count: 0, total: 0 };

  const lines = [];
  lines.push('ELIZA Haftalik Rapor');
  lines.push('');

  lines.push(`Gecen hafta: ${Number(week.contracts)} kontrat / ${Number(week.total_m2)} m2 / €${Number(week.revenue_eur).toLocaleString('de-DE')}`);

  if (Number(pt.total) > 0) {
    lines.push(`Tahsilat: ${pt.count} islem / €${Number(pt.total).toLocaleString('de-DE')}`);
  }

  if (agentsResult.rows.length > 0) {
    lines.push('');
    lines.push('En iyi agentlar:');
    for (const a of agentsResult.rows) {
      lines.push(`  ${a.sales_agent} — ${a.cnt} kontrat / €${Number(a.rev).toLocaleString('de-DE')}`);
    }
  }

  if (expoResult.rows.length > 0) {
    lines.push('');
    lines.push('Bu hafta/sonraki hafta:');
    for (const expo of expoResult.rows) {
      lines.push(`  ${expo.name} — ${expo.days_left} gun`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate weekly close content.
 * Friday afternoon — week close + next week preview.
 */
async function generateWeeklyClose(user) {
  const scope = buildScopeFilter(user);

  // This week stats (Mon-Fri)
  const weekResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts c
    WHERE c.contract_date >= date_trunc('week', CURRENT_DATE)${scope.where}`,
    scope.params
  );
  const week = weekResult.rows[0];

  // Year-to-date
  const ytdResult = await query(
    `SELECT
      COUNT(*) AS contracts,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM edition_contracts c
    WHERE EXTRACT(YEAR FROM c.contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)${scope.where}`,
    scope.params
  );
  const ytd = ytdResult.rows[0];

  // Payments this week
  const payResult = await query(`
    SELECT
      COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date >= date_trunc('week', CURRENT_DATE)
  `);
  const pt = payResult.rows[0] || { count: 0, total: 0 };

  // Next week expos
  const nextWeekExpos = await query(`
    SELECT name, start_date,
      GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE + INTERVAL '2 days'
      AND start_date <= CURRENT_DATE + INTERVAL '9 days'
    ORDER BY start_date ASC
    LIMIT 5
  `);

  const lines = [];
  lines.push('ELIZA Hafta Kapanisi');
  lines.push('');

  lines.push(`Bu hafta: ${Number(week.contracts)} kontrat / ${Number(week.total_m2)} m2 / €${Number(week.revenue_eur).toLocaleString('de-DE')}`);

  if (Number(pt.total) > 0) {
    lines.push(`Tahsilat: ${pt.count} islem / €${Number(pt.total).toLocaleString('de-DE')}`);
  }

  lines.push(`YTD: ${Number(ytd.contracts)} kontrat / €${Number(ytd.revenue_eur).toLocaleString('de-DE')}`);

  if (nextWeekExpos.rows.length > 0) {
    lines.push('');
    lines.push('Gelecek hafta:');
    for (const expo of nextWeekExpos.rows) {
      lines.push(`  ${expo.name} — ${expo.days_left} gun`);
    }
  }

  lines.push('');
  lines.push('Iyi hafta sonlari!');

  return lines.join('\n');
}

/**
 * Generate push message content by type.
 */
async function generatePushMessage(pushType, user) {
  switch (pushType) {
    case 'morning_brief': return generateMorningBrief(user);
    case 'midday_pulse': return generateMiddayPulse(user);
    case 'daily_wrap': return generateDailyWrap(user);
    case 'weekly_report': return generateWeeklyReport(user);
    case 'weekly_close': return generateWeeklyClose(user);
    default: throw new Error(`Unknown push type: ${pushType}`);
  }
}

/**
 * Send a push message to a user via WhatsApp (Twilio).
 */
async function sendPushMessage(user, pushType, messageText) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  const toNumber = user.whatsapp_phone;

  let sentVia = 'log';

  if (accountSid && authToken && fromNumber && toNumber) {
    try {
      const twilio = require('twilio')(accountSid, authToken);
      await twilio.messages.create({
        body: messageText,
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
      });
      sentVia = 'whatsapp';
    } catch (err) {
      console.error(`[push] WhatsApp send failed for ${user.name}: ${err.message}`);
      sentVia = 'error';
      await query(
        `INSERT INTO push_log (user_id, push_type, message_text, sent_via, status, error_message)
         VALUES ($1, $2, $3, 'error', 'error', $4)`,
        [user.id, pushType, messageText, err.message]
      );
      return { sent: false, via: sentVia, error: err.message };
    }
  } else {
    console.log(`[push] No Twilio credentials — logging only for ${user.name}`);
    console.log(`--- ${pushType} ---`);
    console.log(messageText);
    console.log('---');
  }

  // Log successful send
  await query(
    `INSERT INTO push_log (user_id, push_type, message_text, sent_via, status)
     VALUES ($1, $2, $3, $4, 'sent')`,
    [user.id, pushType, messageText, sentVia]
  );

  return { sent: true, via: sentVia };
}

/**
 * Process a single push type for all eligible users.
 * Called by the scheduler at the appropriate time.
 */
async function processPushType(pushType) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Find users who have this push type enabled and scheduled for now
  const usersResult = await query(`
    SELECT u.id, u.name, u.whatsapp_phone, u.role, u.push_settings,
           u.sales_agent_name, u.sales_group,
           up.data_scope
    FROM users u
    LEFT JOIN user_permissions up ON up.user_id = u.id
    WHERE u.is_active = true
      AND u.whatsapp_phone IS NOT NULL
      AND u.push_settings IS NOT NULL
      AND u.push_settings != '{}'::jsonb
      AND (u.push_settings -> $1 ->> 'enabled')::boolean = true
  `, [pushType]);

  let sent = 0;
  let skipped = 0;

  for (const user of usersResult.rows) {
    const settings = user.push_settings[pushType];
    if (!settings || !settings.enabled) { skipped++; continue; }

    // Check time match (within 5 minute window)
    const scheduledTime = settings.time || DEFAULT_TIMES[pushType];
    const [schedH, schedM] = scheduledTime.split(':').map(Number);
    const [curH, curM] = currentTime.split(':').map(Number);
    const schedMin = schedH * 60 + schedM;
    const curMin = curH * 60 + curM;
    if (Math.abs(curMin - schedMin) > 5) { skipped++; continue; }

    // Dedup: check if already sent today
    if (await wasAlreadySent(user.id, pushType)) { skipped++; continue; }

    // Weekly checks
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 5=Fri
    if (pushType === 'weekly_report' && dayOfWeek !== 1) { skipped++; continue; }
    if (pushType === 'weekly_close' && dayOfWeek !== 5) { skipped++; continue; }

    try {
      const messageText = await generatePushMessage(pushType, user);
      const result = await sendPushMessage(user, pushType, messageText);
      if (result.sent) sent++;
      console.log(`[push] ${pushType} → ${user.name}: ${result.via}`);
    } catch (err) {
      console.error(`[push] Error generating ${pushType} for ${user.name}: ${err.message}`);
    }
  }

  return { pushType, sent, skipped, total: usersResult.rows.length };
}

/**
 * Test: generate and optionally send a push message for a specific user.
 */
async function testPush(userId, pushType, send = false) {
  const userResult = await query(`
    SELECT u.id, u.name, u.whatsapp_phone, u.role, u.push_settings,
           u.sales_agent_name, u.sales_group,
           up.data_scope
    FROM users u
    LEFT JOIN user_permissions up ON up.user_id = u.id
    WHERE u.id = $1
  `, [userId]);

  if (userResult.rows.length === 0) throw new Error('User not found');
  const user = userResult.rows[0];

  const messageText = await generatePushMessage(pushType, user);

  if (send) {
    const result = await sendPushMessage(user, pushType, messageText);
    return { user: user.name, pushType, messageText, ...result };
  }

  return { user: user.name, pushType, messageText, sent: false, via: 'preview' };
}

module.exports = {
  PUSH_TYPES,
  DEFAULT_TIMES,
  generatePushMessage,
  sendPushMessage,
  processPushType,
  testPush,
  wasAlreadySent,
};
