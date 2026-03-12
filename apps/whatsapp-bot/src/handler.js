const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const queryEngine = require('../../../packages/ai/queryEngine.js');
const { generateBriefing } = require('../../../packages/briefing/index.js');
const { scan: attentionScan } = require('../../../packages/attention/index.js');
const { generateMessage, getPendingDraft, approveDraft, cancelDraft, expireOldDrafts } = require('../../../packages/messages/index.js');
const { query: dbQuery } = require('../../../packages/db/index.js');
const { generateGreeting, generateClosing } = require('../../../packages/ai/personalityEngine.js');
const { getHistory, rewriteQuestion } = require('../../../packages/ai/conversationMemory.js');

/**
 * Log a message exchange to message_logs table.
 */
async function logMessage(params) {
  try {
    await dbQuery(
      `INSERT INTO message_logs
        (user_phone, user_name, user_role, message_text, response_text,
         intent, tables_used, input_tokens, output_tokens, total_tokens,
         model_intent, model_answer, duration_ms, is_command, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        params.user_phone || null,
        params.user_name || null,
        params.user_role || null,
        params.message_text || null,
        params.response_text || null,
        params.intent || null,
        params.tables_used || null,
        params.input_tokens || 0,
        params.output_tokens || 0,
        (params.input_tokens || 0) + (params.output_tokens || 0),
        params.model_intent || null,
        params.model_answer || null,
        params.duration_ms || null,
        params.is_command || false,
        params.error || null,
      ]
    );
  } catch (err) {
    console.error('Failed to log message:', err.message);
  }
}

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Normalize accented characters for language detection.
 */
const LANG_ACCENT_MAP = {
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ç': 'c', 'ć': 'c',
  'ü': 'u', 'ù': 'u', 'û': 'u',
  'ı': 'i', 'î': 'i', 'ï': 'i',
  'ş': 's', 'ś': 's',
  'ğ': 'g',
  'ö': 'o', 'ô': 'o',
  'â': 'a', 'à': 'a',
};

function normalizeLang(text) {
  let result = text.toLowerCase();
  for (const [accented, plain] of Object.entries(LANG_ACCENT_MAP)) {
    result = result.replaceAll(accented, plain);
  }
  return result;
}

/**
 * Detect language of a message.
 * Uses accent-normalized word boundary matching to avoid false positives.
 */
function detectLang(text) {
  const normalized = normalizeLang(text);
  const words = normalized.split(/\s+/);

  // All keywords are accent-normalized (ç→c, ş→s, ü→u, ı→i, ö→o, ğ→g)
  const trWords = ['kac', 'nasil', 'nedir', 'ne', 'hangi', 'kim', 'toplam', 'satis', 'fuar', 'goster', 'bana', 'kontrat', 'yil', 'gelir', 'ulke', 'durumu', 'risk', 'iyi', 'kotu', 'hiz', 'hedef', 'gun', 'ver', 'soyle', 'mi', 'bu', 'icin', 'var', 'olan', 'kacinci', 'kadar', 'tane', 'sonuc', 'firma', 'agent'];
  const frWords = ['combien', 'quel', 'quels', 'comment', 'les', 'des', 'pour', 'dans', 'sont', 'avec', 'cette', 'exposition', 'ventes', 'contrats', 'revenu', 'montre', 'donne', 'meilleurs', 'jours', 'avant'];
  const enWords = ['how', 'what', 'which', 'who', 'top', 'best', 'worst', 'total', 'show', 'give', 'list', 'agents', 'revenue', 'contracts', 'sold', 'sales', 'many', 'much', 'this', 'year', 'month', 'risk', 'performance', 'progress'];

  // Word boundary match — each input word checked against keyword lists
  const trScore = trWords.filter(w => words.includes(w)).length;
  const frScore = frWords.filter(w => words.includes(w)).length;
  const enScore = enWords.filter(w => words.includes(w)).length;

  if (trScore > enScore && trScore > frScore) return 'tr';
  if (frScore > enScore && frScore > trScore) return 'fr';
  if (enScore > 0) return 'en';
  if (trScore > 0) return 'tr';
  return 'tr';
}

/**
 * Personality wrapper — applies to all users.
 */
function wrapWithPersonality(response, user, lang, isCommand) {
  if (isCommand) return response;

  const { text: greeting, usedNickname } = generateGreeting(user, lang);
  const closing = generateClosing(user, lang, usedNickname);
  return `${greeting}\n\n${response}\n\n${closing}`;
}

/**
 * Return dashboard link for a given intent, or null if no relevant page exists.
 */
function getDashboardLink(intent) {
  const DASHBOARD_BASE = 'https://eliza.elanfairs.com';
  const INTENT_LINKS = {
    expo_progress: `${DASHBOARD_BASE}/expos?year=2026`,
    expo_list: `${DASHBOARD_BASE}/expos?year=2026`,
    expo_agent_breakdown: `${DASHBOARD_BASE}/expos?year=2026`,
    expo_company_list: `${DASHBOARD_BASE}/expos?year=2026`,
    cluster_performance: `${DASHBOARD_BASE}/expos?year=2026`,
    // agent intents: /sales sayfası henüz yok, link eklenmeyecek
  };
  return INTENT_LINKS[intent] || null;
}

/**
 * Handle an incoming WhatsApp message.
 */
async function handleMessage(text, user) {
  const trimmed = text.trim();
  const isCeo = user && user.role === 'ceo';
  const lang = detectLang(trimmed);

  // Check for message approval/cancel keywords (CEO only)
  if (isCeo) {
    const lower = trimmed.toLowerCase();
    if (lower === 'gönder' || lower === 'send' || lower === 'envoyer') {
      const response = await handleApproval(true);
      return wrapWithPersonality(response, user, lang, true);
    }
    if (lower === 'iptal' || lower === 'cancel' || lower === 'annuler') {
      const response = await handleApproval(false);
      return wrapWithPersonality(response, user, lang, true);
    }
  }

  if (trimmed.startsWith('.')) {
    const startTime = Date.now();
    const response = await handleCommand(trimmed, user);
    const durationMs = Date.now() - startTime;
    const finalResponse = wrapWithPersonality(response, user, lang, true);
    logMessage({
      user_phone: user?.phone || user?.whatsapp_phone || null,
      user_name: user?.name || null,
      user_role: user?.role || null,
      message_text: trimmed,
      response_text: finalResponse,
      intent: 'command:' + trimmed.split(/\s+/)[0],
      is_command: true,
      duration_ms: durationMs,
    });
    return finalResponse;
  }

  try {
    const startTime = Date.now();

    // Self-reference replacement: "ben kaç m2 satmışım" → "Elif AY kaç m2 satmış"
    let questionText = trimmed;
    if (user?.sales_agent_name) {
      const agentName = user.sales_agent_name;
      questionText = questionText
        .replace(/\bben\b/gi, agentName)
        .replace(/\bbenim\b/gi, agentName)
        .replace(/\bbana\b/gi, agentName)
        .replace(/\bbeni\b/gi, agentName)
        .replace(/\bmy\b/gi, agentName)
        .replace(/satmışım\b/gi, 'satmış')
        .replace(/yapmışım\b/gi, 'yapmış')
        .replace(/bulmuşum\b/gi, 'bulmuş');
    }

    // Conversation memory: rewrite follow-up questions to be self-contained
    let rewriteUsage = { input_tokens: 0, output_tokens: 0, model: 'none' };
    let questionForEngine = questionText;
    try {
      const history = await getHistory(user?.phone || user?.whatsapp_phone);
      const rewriteResult = await rewriteQuestion(questionText, history);
      questionForEngine = rewriteResult.question;
      rewriteUsage = rewriteResult._usage;
    } catch (rewriteErr) {
      console.error('Rewrite error (using original):', rewriteErr.message);
    }

    const { intent, answer, data, _usage } = await queryEngine.run(questionForEngine, 0, lang, user);
    const durationMs = Date.now() - startTime;

    // Add rewrite tokens to usage
    if (_usage && rewriteUsage.input_tokens > 0) {
      _usage.total_input = (_usage.total_input || 0) + rewriteUsage.input_tokens;
      _usage.total_output = (_usage.total_output || 0) + rewriteUsage.output_tokens;
    }

    let response = answer || 'Sonuç bulunamadı.';

    // Sonnet already summarizes the data — don't render raw rows.
    // Only add "more results" hint if data exceeds 5 rows.
    if (data && Array.isArray(data) && data.length > 5) {
      const remaining = data.length - 5;
      const dashboardLink = getDashboardLink(intent);
      const moreHint = dashboardLink
        ? {
            tr: `... ve ${remaining} sonuç daha.\nTüm liste: ${dashboardLink}`,
            en: `... and ${remaining} more results.\nFull list: ${dashboardLink}`,
            fr: `... et ${remaining} résultats de plus.\nListe complète: ${dashboardLink}`,
          }
        : {
            tr: `... ve ${remaining} sonuç daha.`,
            en: `... and ${remaining} more results.`,
            fr: `... et ${remaining} résultats de plus.`,
          };
      response += `\n\n${moreHint[lang] || moreHint.tr}`;
    }

    const finalResponse = wrapWithPersonality(response, user, lang, false);

    // Log the final response (after personality wrap)
    logMessage({
      user_phone: user?.phone || user?.whatsapp_phone || null,
      user_name: user?.name || null,
      user_role: user?.role || null,
      message_text: trimmed,
      response_text: finalResponse,
      intent,
      input_tokens: _usage?.total_input || 0,
      output_tokens: _usage?.total_output || 0,
      model_intent: _usage?.intent_model || null,
      model_answer: _usage?.answer_model || null,
      duration_ms: durationMs,
      is_command: false,
    });

    return finalResponse;
  } catch (err) {
    console.error('Query error:', err.message);
    logMessage({
      user_phone: user?.phone || user?.whatsapp_phone || null,
      user_name: user?.name || null,
      user_role: user?.role || null,
      message_text: trimmed,
      response_text: null,
      intent: null,
      is_command: false,
      error: err.message,
    });
    return 'Sorgu işlenirken hata oluştu. Lütfen tekrar deneyin.';
  }
}

/**
 * Handle dot-commands.
 */
async function handleCommand(text, user) {
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '.brief': {
      try {
        const { text: briefText } = await generateBriefing();
        return briefText;
      } catch (err) {
        return 'Brifing oluşturulurken hata: ' + err.message;
      }
    }

    case '.risk': {
      const expoName = parts.slice(1).join(' ');
      if (expoName) {
        return handleMessage(`${expoName} risk durumu nedir?`, user);
      }
      return handleMessage('Hangi expolar risk altında?', user);
    }

    case '.attention': {
      try {
        const items = await attentionScan();
        const top = items.filter(i => i.flag_level !== 'info').slice(0, 5);
        if (top.length === 0) return '✅ Dikkat gerektiren konu yok.';
        const lines = ['⚠️ Dikkat gerektiren konular:'];
        for (const item of top) {
          const icon = item.flag_level === 'critical' ? '🔴' : '🟡';
          lines.push(`${icon} ${item.entity_name} (${item.entity_type}) — ${item.flag_reason}`);
        }
        return lines.join('\n');
      } catch (err) {
        return 'Attention scan hatası: ' + err.message;
      }
    }

    case '.note':
    case '.today': {
      if (user && user.permissions && !user.permissions.can_take_notes) {
        return 'Bu özelliğe erişiminiz yok.';
      }
      return `Not özelliği henüz aktif değil. (Phase 9)`;
    }

    case '.expense': {
      if (user && user.permissions && !user.permissions.can_see_expenses) {
        return 'Bu özelliğe erişiminiz yok.';
      }
      return `Gider kayıt özelliği henüz aktif değil.`;
    }

    case '.msg': {
      if (user && user.permissions && !user.permissions.can_use_message_generator) {
        return 'Bu özelliğe erişiminiz yok.';
      }
      // .msg [kişi] [konu]
      const recipientName = parts[1];
      const subject = parts.slice(2).join(' ') || null;
      if (!recipientName) {
        return 'Kullanım: .msg [kişi] [konu]\nÖrnek: .msg Elif Madesign';
      }
      try {
        // Expire old drafts first
        await expireOldDrafts();
        const { draft, recipient, context } = await generateMessage(recipientName, subject);
        const langLabel = { tr: 'Türkçe', en: 'English', fr: 'Français' };
        const lines = [
          `📝 Mesaj Taslağı (${langLabel[draft.language] || draft.language})`,
          `Alıcı: ${recipient.name}${recipient.phone_number ? ' (' + recipient.phone_number + ')' : ''}`,
          `Şablon: ${draft.template_type}`,
          '',
          '---',
          draft.body,
          '---',
          '',
          '✅ Onaylamak için "gönder" yazın',
          '❌ İptal etmek için "iptal" yazın',
          `⏱️ 10 dakika içinde cevaplanmazsa düşer`,
        ];
        return lines.join('\n');
      } catch (err) {
        return `Mesaj oluşturulamadı: ${err.message}`;
      }
    }

    case '.help': {
      return [
        '*ELIZA Komutları:*',
        '',
        '💬 Doğal dilde soru sor:',
        '   "SIEMA kaç m²?"',
        '   "Elif bu ay ne kadar sattı?"',
        '   "Hangi expolar risk altında?"',
        '',
        '⚡ Hızlı komutlar:',
        '   .brief — Sabah brifingini getir',
        '   .risk [expo] — Risk raporu',
        '   .attention — Dikkat gerektiren konular',
        '   .msg [kişi] [konu] — Mesaj taslağı oluştur',
        '   .help — Bu menü',
      ].join('\n');
    }

    default:
      return `Bilinmeyen komut: ${cmd}\n.help yazarak komut listesini görebilirsiniz.`;
  }
}

// --- Message Approval ---

async function handleApproval(approve) {
  try {
    await expireOldDrafts();
    const draft = await getPendingDraft();
    if (!draft) {
      return 'Bekleyen mesaj taslağı yok.';
    }

    if (approve) {
      const result = await approveDraft(draft.id);
      if (result.sent) {
        return `✅ Mesaj gönderildi → ${draft.recipient_name}`;
      }
      return `⚠️ Mesaj onaylandı ancak gönderilemedi. (Twilio hatası veya telefon numarası eksik)`;
    } else {
      await cancelDraft(draft.id);
      return `❌ Mesaj iptal edildi.`;
    }
  } catch (err) {
    return `Hata: ${err.message}`;
  }
}

// --- Formatting ---

const LABELS = {
  tr: {
    name: 'Expo', expo_name: 'Expo', expo: 'Expo', country: 'Ülke',
    start_date: 'Tarih', contracts: 'Kontrat', contract_count: 'Kontrat',
    sold_m2: 'm²', total_m2: 'm²', m2: 'm²',
    revenue_eur: 'Gelir', total_revenue_eur: 'Gelir', revenue: 'Gelir',
    target_m2: 'Hedef', progress_pct: 'İlerleme', progress_percent: 'İlerleme',
    sales_agent: 'Agent', company_name: 'Firma',
    risk_level: 'Risk', risk_score: 'Risk',
    velocity: 'Hız', velocity_ratio: 'Oran',
    months_to_event: 'Kalan Ay', exhibitors: 'Katılımcı',
    editions: 'Edisyon', avg_price_per_m2: '',
    month_name: 'Ay', year: 'Yıl', agents: 'Agent', expos: 'Fuar',
    days_remaining: 'Kalan Gün',
  },
  en: {
    name: 'Expo', expo_name: 'Expo', expo: 'Expo', country: 'Country',
    start_date: 'Date', contracts: 'Contracts', contract_count: 'Contracts',
    sold_m2: 'm²', total_m2: 'm²', m2: 'm²',
    revenue_eur: 'Revenue', total_revenue_eur: 'Revenue', revenue: 'Revenue',
    target_m2: 'Target', progress_pct: 'Progress', progress_percent: 'Progress',
    sales_agent: 'Agent', company_name: 'Company',
    risk_level: 'Risk', risk_score: 'Risk',
    velocity: 'Velocity', velocity_ratio: 'Ratio',
    months_to_event: 'Months Left', exhibitors: 'Exhibitors',
    editions: 'Editions', avg_price_per_m2: '',
    month_name: 'Month', year: 'Year', agents: 'Agents', expos: 'Expos',
    days_remaining: 'Days Left',
  },
  fr: {
    name: 'Expo', expo_name: 'Expo', expo: 'Expo', country: 'Pays',
    start_date: 'Date', contracts: 'Contrats', contract_count: 'Contrats',
    sold_m2: 'm²', total_m2: 'm²', m2: 'm²',
    revenue_eur: 'Revenu', total_revenue_eur: 'Revenu', revenue: 'Revenu',
    target_m2: 'Objectif', progress_pct: 'Progrès', progress_percent: 'Progrès',
    sales_agent: 'Agent', company_name: 'Entreprise',
    risk_level: 'Risque', risk_score: 'Risque',
    velocity: 'Vitesse', velocity_ratio: 'Ratio',
    months_to_event: 'Mois restants', exhibitors: 'Exposants',
    editions: 'Éditions', avg_price_per_m2: '',
    month_name: 'Mois', year: 'Année', agents: 'Agents', expos: 'Expos',
    days_remaining: 'Jours restants',
  },
};

function label(key, lang) {
  const map = LABELS[lang] || LABELS.tr;
  if (key in map) return map[key];
  return key.replace(/_/g, ' ');
}

function formatDate(val, lang) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const months = lang === 'fr' ? FR_MONTHS : lang === 'en' ? EN_MONTHS : TR_MONTHS;
  // English: "Sep 22 2026" (short month prevents auto-linking)
  if (lang === 'en') return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
  // TR/FR: dashes to prevent WhatsApp auto-linking
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function fmtNum(val, lang) {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (lang === 'fr') return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (lang === 'en') return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

function fmtEur(val, lang) {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (lang === 'fr') return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  if (lang === 'en') return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '€' + n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

function formatVal(key, val, lang) {
  if (val == null) return '—';
  const k = key.toLowerCase();

  if (k === 'avg_price_per_m2') return fmtEur(val, lang) + '/m²';
  if (k.includes('date') || k === 'first_expo' || k === 'last_expo') return formatDate(val, lang);
  if (k.includes('revenue') || k.includes('eur') || k === 'total' || k.includes('price') || k.includes('commission')) return fmtEur(val, lang);
  if (k.includes('percent') || k.includes('pct')) return `%${val}`;
  if (k.includes('m2') || k.includes('velocity')) return fmtNum(val, lang);
  if (k === 'contracts' || k === 'contract_count' || k === 'exhibitors' || k === 'editions') return fmtNum(val, lang);

  return String(val);
}

/**
 * Build a single-line summary for a data row.
 * Output: "Elif AY — 11 kontrat — 234 m² — €76.715"
 */
function rowToLine(row, lang) {
  const keys = Object.keys(row);

  // Find the "name" column (first text column)
  const nameKey = keys.find(k => ['name', 'expo_name', 'expo', 'sales_agent', 'company_name', 'entity_name', 'country', 'month_name'].includes(k));
  const nameVal = nameKey ? String(row[nameKey]) : null;

  // Keys that use suffix format: "2.951 m²", "€562.512 gelir", "45 kontrat"
  const SUFFIX_KEYS = new Set([
    'm2', 'total_m2', 'sold_m2',
    'revenue_eur', 'total_revenue_eur', 'revenue',
    'contracts', 'contract_count',
  ]);

  // Build value parts with labels (skip the name column)
  const parts = [];
  for (const k of keys) {
    if (k === nameKey) continue;
    const v = row[k];
    if (v == null) continue;
    const formatted = formatVal(k, v, lang);
    if (formatted === '—') continue;
    const lbl = label(k, lang);
    if (!lbl) {
      // No label — value already self-descriptive (e.g., "€347/m²")
      parts.push(formatted);
    } else if (SUFFIX_KEYS.has(k)) {
      // Numeric — suffix format: "2.951 m²", "€562.512 gelir"
      parts.push(`${formatted} ${lbl.toLowerCase()}`);
    } else {
      // Default — prefix format: "Ülke: Morocco", "Tarih: 22-Eylül-2026"
      parts.push(`${lbl}: ${formatted}`);
    }
  }

  if (nameVal) {
    return `${nameVal} — ${parts.join(' — ')}`;
  }
  return parts.join(' — ');
}

/**
 * Format data rows as clean plain text lines.
 */
function formatDataLines(rows, lang) {
  if (!rows || rows.length === 0) return null;
  return rows.map(r => rowToLine(r, lang)).join('\n\n');
}

module.exports = { handleMessage };
