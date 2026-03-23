/**
 * ELIZA Push Messages — scheduled WhatsApp notifications.
 *
 * 5 message types:
 *   - morning_brief  (08:00 daily)   — alerts + yesterday's stats + finance overview
 *   - midday_pulse   (13:00 daily)   — today's progress so far
 *   - daily_wrap     (16:00 daily)   — end-of-day summary + tomorrow preview
 *   - weekly_report  (08:00 Monday)  — week overview
 *   - weekly_close   (16:00 Friday)  — week close + next week preview
 *
 * Multi-language: TR/EN/FR based on users.language field.
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

const DASH = 'https://eliza.elanfairs.com';

// ═══ Language helpers ═══

function normalizeLang(raw) {
  if (!raw) return 'en';
  const l = raw.toLowerCase().substring(0, 2);
  if (l === 'tr' || l === 'tu') return 'tr'; // "Turkce" → "tu" → tr
  if (l === 'fr') return 'fr';
  return 'en'; // "English", "en", anything else → en
}

const DATE_LOCALES = { tr: 'tr-TR', en: 'en-US', fr: 'fr-FR' };

function fmtDate(date, lang, opts) {
  return date.toLocaleDateString(DATE_LOCALES[lang] || 'en-US', opts);
}

function fmtEur(val, lang) {
  if (lang === 'fr') {
    return Number(val).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  }
  return '€' + Number(val).toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

function fmtNum(val) {
  return Number(val).toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

// ═══ i18n Labels ═══

const L = {
  morning_greeting: { tr: '☀️ Günaydın', en: '☀️ Good morning', fr: '☀️ Bonjour' },
  status_report: { tr: 'Durum Raporu', en: 'Status Report', fr: 'Rapport de statut' },
  yesterday: { tr: 'Dün', en: 'Yesterday', fr: 'Hier' },
  new_contracts: { tr: 'yeni sözleşme', en: 'new contract(s)', fr: 'nouveau(x) contrat(s)' },
  no_new_contracts: { tr: 'Yeni sözleşme yok', en: 'No new contracts', fr: 'Pas de nouveaux contrats' },
  payments_received: { tr: 'ödeme geldi', en: 'payment(s) received', fr: 'paiement(s) reçu(s)' },
  attention: { tr: 'Dikkat', en: 'Attention', fr: 'Attention' },
  no_payment_firms: { tr: 'firma hiç ödeme yapmamış', en: 'firm(s) with no payment', fr: 'entreprise(s) sans paiement' },
  at_risk: { tr: 'At-risk alacak', en: 'At-risk receivable', fr: 'Créance à risque' },
  deposit_rate: { tr: 'Deposit rate', en: 'Deposit rate', fr: 'Taux de dépôt' },
  upcoming_expos: { tr: 'Yaklaşan fuarlar', en: 'Upcoming expos', fr: 'Salons à venir' },
  days: { tr: 'gün', en: 'days', fr: 'jours' },
  expected_this_week: { tr: 'Bu hafta beklenen tahsilat', en: 'Expected collections this week', fr: 'Encaissements attendus cette semaine' },
  midday_report: { tr: '🕐 Öğle Raporu', en: '🕐 Midday Report', fr: '🕐 Rapport de mi-journée' },
  today: { tr: 'Bugün', en: 'Today', fr: "Aujourd'hui" },
  contracts: { tr: 'sözleşme', en: 'contract(s)', fr: 'contrat(s)' },
  no_contracts: { tr: 'sözleşme yok', en: 'no contracts', fr: 'pas de contrats' },
  payments: { tr: 'ödeme', en: 'payment(s)', fr: 'paiement(s)' },
  this_week: { tr: 'Bu hafta', en: 'This week', fr: 'Cette semaine' },
  outstanding: { tr: 'Outstanding', en: 'Outstanding', fr: 'Encours' },
  daily_wrap_title: { tr: '🌙 Gün Sonu', en: '🌙 End of Day', fr: '🌙 Fin de journée' },
  this_week_total: { tr: 'Bu hafta toplam', en: 'This week total', fr: 'Total cette semaine' },
  tomorrow_attention: { tr: 'Yarın dikkat', en: 'Tomorrow attention', fr: 'Attention demain' },
  expected_payment: { tr: 'Beklenen ödeme', en: 'Expected payment', fr: 'Paiement attendu' },
  firms: { tr: 'firma', en: 'firm(s)', fr: 'entreprise(s)' },
  nearest_expo: { tr: 'En yakın fuar', en: 'Nearest expo', fr: 'Prochain salon' },
  weekly_report_title: { tr: '📋 ELIZA Haftalık Rapor', en: '📋 ELIZA Weekly Report', fr: '📋 ELIZA Rapport Hebdomadaire' },
  last_week: { tr: 'Geçen hafta', en: 'Last week', fr: 'Semaine dernière' },
  collection: { tr: 'Tahsilat', en: 'Collections', fr: 'Encaissements' },
  transactions: { tr: 'işlem', en: 'transaction(s)', fr: 'opération(s)' },
  top_agents: { tr: 'En iyi agentlar', en: 'Top agents', fr: 'Meilleurs agents' },
  expected_collections_week: { tr: 'Bu hafta beklenen tahsilat', en: 'Expected collections this week', fr: 'Encaissements attendus cette semaine' },
  weekly_close_title: { tr: '🏁 ELIZA Hafta Kapanışı', en: '🏁 ELIZA Week Close', fr: '🏁 ELIZA Clôture Hebdomadaire' },
  next_week: { tr: 'Gelecek hafta', en: 'Next week', fr: 'Semaine prochaine' },
  expected_collection: { tr: 'Beklenen tahsilat', en: 'Expected collections', fr: 'Encaissements attendus' },
  good_weekend: { tr: 'İyi hafta sonları!', en: 'Have a great weekend!', fr: 'Bon week-end !' },
};

function t(key, lang) {
  return L[key]?.[lang] || L[key]?.en || key;
}

// ═══ Core helpers ═══

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

const VALID_STATUSES = `('Valid', 'Transferred In', 'Transferred Out')`;

// ═══ Generators ═══

async function generateMorningBrief(user) {
  const lang = normalizeLang(user.language);
  const scope = buildScopeFilter(user);
  const today = new Date();
  const dateStr = fmtDate(today, lang, { day: 'numeric', month: 'long', year: 'numeric' });

  // Yesterday's contracts
  const yesterdayResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date = CURRENT_DATE - INTERVAL '1 day'
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const yday = yesterdayResult.rows[0];

  // Yesterday's top contracts
  const ydayDetails = await query(
    `SELECT c.company_name, e.name AS expo_name, c.revenue_eur
    FROM contracts c
    LEFT JOIN expos e ON c.expo_id = e.id
    WHERE c.contract_date::date = CURRENT_DATE - INTERVAL '1 day'
      AND c.status IN ${VALID_STATUSES}${scope.where}
    ORDER BY c.revenue_eur DESC NULLS LAST
    LIMIT 3`,
    scope.params
  );

  // Yesterday's payments
  const ydayPay = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date = CURRENT_DATE - INTERVAL '1 day'
  `);
  const yp = ydayPay.rows[0] || { count: 0, total: 0 };

  // Outstanding balances
  const outResult = await query(`
    SELECT
      COUNT(*) AS open_count,
      COALESCE(ROUND(SUM(balance_eur)::numeric, 0), 0) AS total_outstanding,
      COUNT(*) FILTER (WHERE collection_stage = 'no_payment') AS no_payment_count,
      COALESCE(ROUND(SUM(balance_eur) FILTER (WHERE (collection_risk_score + event_risk_score) >= 5)::numeric, 0), 0) AS at_risk_amount
    FROM outstanding_balances
  `);
  const out = outResult.rows[0] || {};

  // Deposit rate
  const depositResult = await query(`
    SELECT
      COUNT(*) FILTER (WHERE paid_eur > 0) AS with_payment,
      COUNT(*) AS total
    FROM outstanding_balances
  `);
  const dep = depositResult.rows[0] || { with_payment: 0, total: 1 };
  const depositRate = dep.total > 0 ? ((Number(dep.with_payment) / Number(dep.total)) * 100).toFixed(1) : '0';

  // Upcoming expos (top 3)
  const expoResult = await query(`
    SELECT name, GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE
      AND start_date <= CURRENT_DATE + INTERVAL '90 days'
    ORDER BY start_date ASC
    LIMIT 3
  `);

  // This week expected payments
  const expectedResult = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(planned_amount_eur)::numeric, 0), 0) AS total
    FROM contract_payment_schedule
    WHERE due_date >= date_trunc('week', CURRENT_DATE)
      AND due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
  `);
  const expected = expectedResult.rows[0] || { count: 0, total: 0 };

  // Build message
  const lines = [];
  lines.push(t('morning_greeting', lang));
  lines.push(`📊 ${dateStr} — ${t('status_report', lang)}`);

  // Yesterday
  lines.push('');
  lines.push(`${t('yesterday', lang)}:`);
  const yc = Number(yday.contracts);
  if (yc > 0) {
    lines.push(`  ${yc} ${t('new_contracts', lang)}: ${fmtEur(yday.revenue_eur, lang)}`);
    for (const d of ydayDetails.rows) {
      const expo = d.expo_name ? ` (${d.expo_name})` : '';
      lines.push(`  → ${d.company_name}${expo} ${fmtEur(d.revenue_eur, lang)}`);
    }
  } else {
    lines.push(`  ${t('no_new_contracts', lang)}`);
  }
  if (Number(yp.total) > 0) {
    lines.push(`  ${yp.count} ${t('payments_received', lang)}: ${fmtEur(yp.total, lang)}`);
  }

  // Finance attention
  lines.push('');
  lines.push(`${t('attention', lang)}:`);
  if (Number(out.no_payment_count) > 0) {
    lines.push(`  ${out.no_payment_count} ${t('no_payment_firms', lang)}`);
  }
  if (Number(out.at_risk_amount) > 0) {
    lines.push(`  ${t('at_risk', lang)}: ${fmtEur(out.at_risk_amount, lang)}`);
  }
  lines.push(`  ${t('deposit_rate', lang)}: %${depositRate}`);

  // Upcoming expos
  if (expoResult.rows.length > 0) {
    lines.push('');
    lines.push(`${t('upcoming_expos', lang)}:`);
    for (const expo of expoResult.rows) {
      lines.push(`  ${expo.name} — ${expo.days_left} ${t('days', lang)}`);
    }
  }

  // Expected collections this week
  if (Number(expected.total) > 0) {
    lines.push('');
    lines.push(`${t('expected_this_week', lang)}: ${fmtEur(expected.total, lang)}`);
  }

  lines.push(`📊 ${DASH}/finance`);

  return lines.join('\n');
}

async function generateMiddayPulse(user) {
  const lang = normalizeLang(user.language);
  const scope = buildScopeFilter(user);
  const today = new Date();
  const dateStr = fmtDate(today, lang, { day: 'numeric', month: 'long' });

  // Today's contracts
  const todayResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date = CURRENT_DATE
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const td = todayResult.rows[0];

  // Today's payments
  const payToday = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date = CURRENT_DATE
  `);
  const pt = payToday.rows[0] || { count: 0, total: 0 };

  // This week's contracts
  const weekResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date >= date_trunc('week', CURRENT_DATE)
      AND c.contract_date::date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const wk = weekResult.rows[0];

  // This week's payments
  const payWeek = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date >= date_trunc('week', CURRENT_DATE)
      AND payment_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
  `);
  const pw = payWeek.rows[0] || { count: 0, total: 0 };

  // Outstanding total
  const outResult = await query(`
    SELECT COALESCE(ROUND(SUM(balance_eur)::numeric, 0), 0) AS total
    FROM outstanding_balances
  `);
  const outstanding = outResult.rows[0]?.total || 0;

  const lines = [];
  lines.push(`${t('midday_report', lang)} — ${dateStr}`);

  // Today
  const tc = Number(td.contracts);
  const todayParts = [];
  todayParts.push(tc > 0 ? `${tc} ${t('contracts', lang)} (${fmtEur(td.revenue_eur, lang)})` : t('no_contracts', lang));
  if (Number(pt.total) > 0) todayParts.push(`${pt.count} ${t('payments', lang)} (${fmtEur(pt.total, lang)})`);
  lines.push(`${t('today', lang)}: ${todayParts.join(', ')}`);

  // This week
  const weekParts = [];
  weekParts.push(`${Number(wk.contracts)} ${t('contracts', lang)} (${fmtEur(wk.revenue_eur, lang)})`);
  if (Number(pw.total) > 0) weekParts.push(`${pw.count} ${t('payments', lang)} (${fmtEur(pw.total, lang)})`);
  lines.push(`${t('this_week', lang)}: ${weekParts.join(', ')}`);

  lines.push(`${t('outstanding', lang)}: ${fmtEur(outstanding, lang)}`);
  lines.push(`📊 ${DASH}/sales`);

  return lines.join('\n');
}

async function generateDailyWrap(user) {
  const lang = normalizeLang(user.language);
  const scope = buildScopeFilter(user);
  const today = new Date();
  const dateStr = fmtDate(today, lang, { day: 'numeric', month: 'long' });

  // Today's contracts
  const todayResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date = CURRENT_DATE
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const td = todayResult.rows[0];

  // Today's payments
  const payToday = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date = CURRENT_DATE
  `);
  const pt = payToday.rows[0] || { count: 0, total: 0 };

  // This week totals
  const weekResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date >= date_trunc('week', CURRENT_DATE)
      AND c.contract_date::date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const wk = weekResult.rows[0];

  // This week's payments
  const payWeek = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date >= date_trunc('week', CURRENT_DATE)
      AND payment_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
  `);
  const pw = payWeek.rows[0] || { count: 0, total: 0 };

  // Tomorrow's expected payments
  const tomorrowPay = await query(`
    SELECT
      COUNT(DISTINCT cps.contract_id) AS firms,
      COALESCE(ROUND(SUM(cps.planned_amount_eur)::numeric, 0), 0) AS total
    FROM contract_payment_schedule cps
    WHERE cps.due_date = CURRENT_DATE + INTERVAL '1 day'
  `);
  const tp = tomorrowPay.rows[0] || { firms: 0, total: 0 };

  // Nearest expo
  const nearestExpo = await query(`
    SELECT name, GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE
    ORDER BY start_date ASC
    LIMIT 1
  `);

  const lines = [];
  lines.push(`${t('daily_wrap_title', lang)} — ${dateStr}`);

  // Today
  const todayParts = [];
  const tc = Number(td.contracts);
  todayParts.push(tc > 0 ? `${tc} ${t('contracts', lang)} (${fmtEur(td.revenue_eur, lang)})` : t('no_contracts', lang));
  if (Number(pt.total) > 0) todayParts.push(`${pt.count} ${t('payments', lang)} (${fmtEur(pt.total, lang)})`);
  lines.push(`${t('today', lang)}: ${todayParts.join(', ')}`);

  // Week
  const weekParts = [];
  weekParts.push(`${Number(wk.contracts)} ${t('contracts', lang)} (${fmtEur(wk.revenue_eur, lang)})`);
  if (Number(pw.total) > 0) weekParts.push(`${pw.count} ${t('payments', lang)} (${fmtEur(pw.total, lang)})`);
  lines.push(`${t('this_week_total', lang)}: ${weekParts.join(', ')}`);

  // Tomorrow attention
  const hasAttention = Number(tp.total) > 0 || nearestExpo.rows.length > 0;
  if (hasAttention) {
    lines.push('');
    lines.push(`${t('tomorrow_attention', lang)}:`);
    if (Number(tp.total) > 0) {
      lines.push(`  ${t('expected_payment', lang)}: ${tp.firms} ${t('firms', lang)}, ${fmtEur(tp.total, lang)}`);
    }
    if (nearestExpo.rows.length > 0) {
      const ne = nearestExpo.rows[0];
      lines.push(`  ${t('nearest_expo', lang)}: ${ne.name} — ${ne.days_left} ${t('days', lang)}`);
    }
  }

  lines.push(`📊 ${DASH}/finance`);

  return lines.join('\n');
}

async function generateWeeklyReport(user) {
  const lang = normalizeLang(user.language);
  const scope = buildScopeFilter(user);

  // Last week stats
  const weekResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
      AND c.contract_date::date < date_trunc('week', CURRENT_DATE)
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const week = weekResult.rows[0];

  // Last week payments
  const payResult = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
      AND payment_date < date_trunc('week', CURRENT_DATE)
  `);
  const pt = payResult.rows[0] || { count: 0, total: 0 };

  // Top agents last week
  const agentsResult = await query(
    `SELECT c.sales_agent, COUNT(*) AS cnt,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS rev
    FROM contracts c
    WHERE c.contract_date::date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
      AND c.contract_date::date < date_trunc('week', CURRENT_DATE)
      AND c.status IN ${VALID_STATUSES}
      AND c.sales_agent IS NOT NULL
      AND c.sales_agent != 'ELAN EXPO'${scope.where}
    GROUP BY c.sales_agent
    ORDER BY rev DESC
    LIMIT 5`,
    scope.params
  );

  // Upcoming expos (next 14 days)
  const expoResult = await query(`
    SELECT name, GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE
      AND start_date <= CURRENT_DATE + INTERVAL '14 days'
    ORDER BY start_date ASC
    LIMIT 5
  `);

  // This week expected
  const expectedResult = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(planned_amount_eur)::numeric, 0), 0) AS total
    FROM contract_payment_schedule
    WHERE due_date >= date_trunc('week', CURRENT_DATE)
      AND due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
  `);
  const expected = expectedResult.rows[0] || { count: 0, total: 0 };

  const lines = [];
  lines.push(t('weekly_report_title', lang));
  lines.push('');

  lines.push(`${t('last_week', lang)}: ${fmtNum(week.contracts)} ${t('contracts', lang)} / ${fmtNum(week.total_m2)} m² / ${fmtEur(week.revenue_eur, lang)}`);
  if (Number(pt.total) > 0) {
    lines.push(`${t('collection', lang)}: ${pt.count} ${t('transactions', lang)} / ${fmtEur(pt.total, lang)}`);
  }

  if (agentsResult.rows.length > 0) {
    lines.push('');
    lines.push(`${t('top_agents', lang)}:`);
    for (const a of agentsResult.rows) {
      lines.push(`  ${a.sales_agent} — ${a.cnt} ${t('contracts', lang)} / ${fmtEur(a.rev, lang)}`);
    }
  }

  if (expoResult.rows.length > 0) {
    lines.push('');
    lines.push(`${t('upcoming_expos', lang)}:`);
    for (const expo of expoResult.rows) {
      lines.push(`  ${expo.name} — ${expo.days_left} ${t('days', lang)}`);
    }
  }

  if (Number(expected.total) > 0) {
    lines.push('');
    lines.push(`${t('expected_collections_week', lang)}: ${fmtEur(expected.total, lang)}`);
  }

  lines.push(`📊 ${DASH}/sales`);

  return lines.join('\n');
}

async function generateWeeklyClose(user) {
  const lang = normalizeLang(user.language);
  const scope = buildScopeFilter(user);

  // This week stats
  const weekResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(SUM(c.m2), 0) AS total_m2,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE c.contract_date::date >= date_trunc('week', CURRENT_DATE)
      AND c.contract_date::date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const week = weekResult.rows[0];

  // This week payments
  const payResult = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(amount_eur)::numeric, 0), 0) AS total
    FROM contract_payments
    WHERE payment_date >= date_trunc('week', CURRENT_DATE)
      AND payment_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
  `);
  const pt = payResult.rows[0] || { count: 0, total: 0 };

  // Year-to-date
  const ytdResult = await query(
    `SELECT COUNT(*) AS contracts,
      COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
    FROM contracts c
    WHERE EXTRACT(YEAR FROM c.contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND c.status IN ${VALID_STATUSES}${scope.where}`,
    scope.params
  );
  const ytd = ytdResult.rows[0];

  // Next week expos
  const nextWeekExpos = await query(`
    SELECT name, GREATEST(start_date::date - CURRENT_DATE, 0) AS days_left
    FROM expos
    WHERE start_date >= CURRENT_DATE + INTERVAL '2 days'
      AND start_date <= CURRENT_DATE + INTERVAL '9 days'
    ORDER BY start_date ASC
    LIMIT 5
  `);

  // Next week expected payments
  const nextExpected = await query(`
    SELECT COUNT(*) AS count,
      COALESCE(ROUND(SUM(planned_amount_eur)::numeric, 0), 0) AS total
    FROM contract_payment_schedule
    WHERE due_date >= date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
      AND due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '2 weeks'
  `);
  const ne = nextExpected.rows[0] || { count: 0, total: 0 };

  const lines = [];
  lines.push(t('weekly_close_title', lang));
  lines.push('');

  lines.push(`${t('this_week', lang)}: ${fmtNum(week.contracts)} ${t('contracts', lang)} / ${fmtNum(week.total_m2)} m² / ${fmtEur(week.revenue_eur, lang)}`);
  if (Number(pt.total) > 0) {
    lines.push(`${t('collection', lang)}: ${pt.count} ${t('transactions', lang)} / ${fmtEur(pt.total, lang)}`);
  }
  lines.push(`YTD: ${fmtNum(ytd.contracts)} ${t('contracts', lang)} / ${fmtEur(ytd.revenue_eur, lang)}`);

  if (nextWeekExpos.rows.length > 0 || Number(ne.total) > 0) {
    lines.push('');
    lines.push(`${t('next_week', lang)}:`);
    for (const expo of nextWeekExpos.rows) {
      lines.push(`  ${expo.name} — ${expo.days_left} ${t('days', lang)}`);
    }
    if (Number(ne.total) > 0) {
      lines.push(`  ${t('expected_collection', lang)}: ${fmtEur(ne.total, lang)}`);
    }
  }

  lines.push('');
  lines.push(t('good_weekend', lang));
  lines.push(`📊 ${DASH}/finance`);

  return lines.join('\n');
}

// ═══ Dispatch + Send + Process ═══

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

async function sendPushMessage(user, pushType, messageText) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const rawFrom = process.env.TWILIO_WHATSAPP_FROM || '';
  const rawTo = user.whatsapp_phone || '';

  // Avoid double whatsapp: prefix (env may already include it)
  const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;
  const to = rawTo.startsWith('whatsapp:') ? rawTo : `whatsapp:${rawTo}`;

  let sentVia = 'log';

  if (accountSid && authToken && rawFrom && rawTo) {
    try {
      const twilio = require('twilio')(accountSid, authToken);
      await twilio.messages.create({
        body: messageText,
        from,
        to,
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

async function processPushType(pushType) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const usersResult = await query(`
    SELECT u.id, u.name, u.whatsapp_phone, u.role, u.push_settings,
           u.sales_agent_name, u.sales_group, u.language,
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

    // Dedup
    if (await wasAlreadySent(user.id, pushType)) { skipped++; continue; }

    // Weekly checks
    const dayOfWeek = now.getDay();
    if (pushType === 'weekly_report' && dayOfWeek !== 1) { skipped++; continue; }
    if (pushType === 'weekly_close' && dayOfWeek !== 5) { skipped++; continue; }

    try {
      const messageText = await generatePushMessage(pushType, user);
      const result = await sendPushMessage(user, pushType, messageText);
      if (result.sent) sent++;
      console.log(`[push] ${pushType} → ${user.name} (${normalizeLang(user.language)}): ${result.via}`);
    } catch (err) {
      console.error(`[push] Error generating ${pushType} for ${user.name}: ${err.message}`);
    }
  }

  return { pushType, sent, skipped, total: usersResult.rows.length };
}

async function testPush(userId, pushType, send = false) {
  const userResult = await query(`
    SELECT u.id, u.name, u.whatsapp_phone, u.role, u.push_settings,
           u.sales_agent_name, u.sales_group, u.language,
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
    return { user: user.name, pushType, language: normalizeLang(user.language), messageText, ...result };
  }

  return { user: user.name, pushType, language: normalizeLang(user.language), messageText, sent: false, via: 'preview' };
}

module.exports = {
  PUSH_TYPES,
  DEFAULT_TIMES,
  generatePushMessage,
  sendPushMessage,
  processPushType,
  testPush,
  wasAlreadySent,
  normalizeLang,
};
