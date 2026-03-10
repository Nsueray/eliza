const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const queryEngine = require('../../../packages/ai/queryEngine.js');
const { generateBriefing } = require('../../../packages/briefing/index.js');
const { scan: attentionScan } = require('../../../packages/attention/index.js');

// Turkish month names for date formatting
const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/**
 * Detect language of a message (simple heuristic).
 */
function detectLang(text) {
  const lower = text.toLowerCase();
  const trWords = ['kaç', 'nasıl', 'nedir', 'ne', 'hangi', 'kim', 'toplam', 'satış', 'fuar', 'göster', 'bana', 'kontrat', 'yıl', 'gelir', 'ülke', 'durumu', 'risk', 'iyi', 'kötü', 'hız', 'hedef', 'gün', 'ver', 'söyle', 'mı', 'mi', 'bu', 'için', 'var', 'olan'];
  const frWords = ['combien', 'quel', 'quels', 'comment', 'est-ce', 'les', 'des', 'pour', 'dans', 'sont', 'avec', 'cette', 'exposition', 'ventes', 'contrats', 'revenu', 'montre', 'donne'];
  const enWords = ['how', 'what', 'which', 'who', 'top', 'best', 'worst', 'total', 'show', 'give', 'list', 'agents', 'revenue', 'contracts', 'sold', 'sales', 'many', 'much', 'this', 'year', 'month', 'risk', 'performance', 'progress'];

  const trScore = trWords.filter(w => lower.includes(w)).length;
  const frScore = frWords.filter(w => lower.includes(w)).length;
  const enScore = enWords.filter(w => lower.includes(w)).length;

  if (trScore > enScore && trScore > frScore) return 'tr';
  if (frScore > enScore && frScore > trScore) return 'fr';
  if (enScore > 0) return 'en';
  if (trScore > 0) return 'tr';
  return 'tr'; // default to Turkish
}

/**
 * Add CEO personality wrapper to response.
 */
function wrapForCeo(response, lang, isCommand) {
  if (isCommand) return response; // Don't wrap .brief, .help etc.

  if (lang === 'tr') {
    return `Selam Baba 👋\n\n${response}\n\nBaşka bir şey var mı Baba?`;
  } else if (lang === 'fr') {
    return `Bonjour Papa 👋\n\n${response}\n\nAutre chose Papa?`;
  } else {
    return `Hi Dad 👋\n\n${response}\n\nAnything else Dad?`;
  }
}

/**
 * Handle an incoming WhatsApp message.
 */
async function handleMessage(text, user) {
  const trimmed = text.trim();
  const isCeo = user && user.role === 'ceo';
  const lang = detectLang(trimmed);

  // Dot-commands
  if (trimmed.startsWith('.')) {
    const response = await handleCommand(trimmed, user);
    return isCeo ? wrapForCeo(response, lang, true) : response;
  }

  // Regular question → AI Query Engine
  try {
    const { answer, data } = await queryEngine.run(trimmed);

    let response = answer || 'Sonuç bulunamadı.';

    // Append formatted data
    if (data && Array.isArray(data) && data.length > 0 && data.length <= 5) {
      const table = formatDataForWhatsApp(data);
      if (table) response += '\n\n' + table;
    } else if (data && data.length > 5) {
      response += `\n\n📋 ${data.length} kayıt (ilk 5):`;
      const table = formatDataForWhatsApp(data.slice(0, 5));
      if (table) response += '\n' + table;
    }

    return isCeo ? wrapForCeo(response, lang, false) : response;
  } catch (err) {
    console.error('Query error:', err.message);
    return 'Sorgu işlenirken hata oluştu. Lütfen tekrar deneyin.';
  }
}

/**
 * Handle dot-commands (.brief, .risk, etc.)
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
        '   .help — Bu menü',
      ].join('\n');
    }

    default:
      return `Bilinmeyen komut: ${cmd}\n.help yazarak komut listesini görebilirsiniz.`;
  }
}

// --- Formatting helpers ---

/**
 * Format a date value as "22 Eylül 2026".
 */
function formatTrDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format a number with dot separators: 1685 → "1.685"
 */
function fmtNum(val) {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

/**
 * Format a currency value: 562512.41 → "€562.512"
 */
function fmtEur(val) {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return '€' + n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

/**
 * Pretty column label: "revenue_eur" → "Gelir"
 */
const LABEL_MAP = {
  name: 'Expo', expo_name: 'Expo', expo: 'Expo',
  country: 'Ülke', start_date: 'Tarih',
  contracts: 'Kontrat', contract_count: 'Kontrat',
  sold_m2: 'Satılan m²', total_m2: 'm²', m2: 'm²',
  revenue_eur: 'Gelir', total_revenue_eur: 'Gelir', revenue: 'Gelir',
  target_m2: 'Hedef m²',
  progress_pct: 'İlerleme', progress_percent: 'İlerleme',
  sales_agent: 'Agent', company_name: 'Firma',
  risk_level: 'Risk', risk_score: 'Risk Skoru',
  velocity: 'Hız', velocity_ratio: 'Hız Oranı',
  velocity_m2_per_month: 'Hız (m²/ay)', required_velocity: 'Gerekli Hız',
  months_to_event: 'Kalan Ay',
  exhibitors: 'Katılımcı', editions: 'Edisyon',
  avg_price_per_m2: 'Ort. m² Fiyatı',
  month_name: 'Ay', year: 'Yıl',
  agents: 'Agent', expos: 'Fuar',
};

function prettyLabel(key) {
  return LABEL_MAP[key] || key.replace(/_/g, ' ');
}

/**
 * Detect if a column contains date, currency, m2, or percentage values.
 */
function formatValue(key, val) {
  if (val == null) return '—';

  const k = key.toLowerCase();

  // Dates
  if (k.includes('date') || k === 'first_expo' || k === 'last_expo') {
    return formatTrDate(val);
  }

  // Currency
  if (k.includes('revenue') || k.includes('eur') || k === 'total' || k.includes('price') || k.includes('commission')) {
    return fmtEur(val);
  }

  // Percentage
  if (k.includes('percent') || k.includes('pct') || k === 'progress') {
    return `%${val}`;
  }

  // m2 fields
  if (k.includes('m2') || k === 'velocity' || k.includes('velocity')) {
    return fmtNum(val);
  }

  // Numeric fields
  if (k === 'contracts' || k === 'contract_count' || k === 'exhibitors' || k === 'editions' || k === 'agents' || k === 'expos' || k === 'review_count') {
    return fmtNum(val);
  }

  return String(val);
}

/**
 * Format query data as clean WhatsApp-friendly text.
 */
function formatDataForWhatsApp(rows) {
  if (!rows || rows.length === 0) return null;

  const keys = Object.keys(rows[0]);
  const lines = [];

  for (const row of rows) {
    const parts = keys.map(k => `${prettyLabel(k)}: ${formatValue(k, row[k])}`);
    lines.push(parts.join(' | '));
  }

  return lines.join('\n\n');
}

module.exports = { handleMessage };
