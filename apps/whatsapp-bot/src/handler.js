const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const queryEngine = require('../../../packages/ai/queryEngine.js');
const { generateBriefing } = require('../../../packages/briefing/index.js');
const { scan: attentionScan } = require('../../../packages/attention/index.js');

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Detect language of a message.
 */
function detectLang(text) {
  const lower = text.toLowerCase();
  const trWords = ['kaç', 'nasıl', 'nedir', 'ne', 'hangi', 'kim', 'toplam', 'satış', 'fuar', 'göster', 'bana', 'kontrat', 'yıl', 'gelir', 'ülke', 'durumu', 'risk', 'iyi', 'kötü', 'hız', 'hedef', 'gün', 'ver', 'söyle', 'mı', 'mi', 'bu', 'için', 'var', 'olan'];
  const frWords = ['combien', 'quel', 'quels', 'comment', 'est-ce', 'les', 'des', 'pour', 'dans', 'sont', 'avec', 'cette', 'exposition', 'ventes', 'contrats', 'revenu', 'montre', 'donne', 'meilleurs', 'agents'];
  const enWords = ['how', 'what', 'which', 'who', 'top', 'best', 'worst', 'total', 'show', 'give', 'list', 'agents', 'revenue', 'contracts', 'sold', 'sales', 'many', 'much', 'this', 'year', 'month', 'risk', 'performance', 'progress'];

  const trScore = trWords.filter(w => lower.includes(w)).length;
  const frScore = frWords.filter(w => lower.includes(w)).length;
  const enScore = enWords.filter(w => lower.includes(w)).length;

  if (trScore > enScore && trScore > frScore) return 'tr';
  if (frScore > enScore && frScore > trScore) return 'fr';
  if (enScore > 0) return 'en';
  if (trScore > 0) return 'tr';
  return 'tr';
}

/**
 * CEO personality wrapper.
 */
function wrapForCeo(response, lang, isCommand) {
  if (isCommand) return response;

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

  if (trimmed.startsWith('.')) {
    const response = await handleCommand(trimmed, user);
    return isCeo ? wrapForCeo(response, lang, true) : response;
  }

  try {
    const { answer, data } = await queryEngine.run(trimmed, 0, lang);

    let response = answer || 'Sonuç bulunamadı.';

    // Append clean data lines (no duplication — only data rows, no table)
    if (data && Array.isArray(data) && data.length > 0) {
      const displayRows = data.length > 5 ? data.slice(0, 5) : data;
      const lines = formatDataLines(displayRows, lang);
      if (lines) {
        if (data.length > 5) {
          const remaining = data.length - 5;
          const moreHint = {
            tr: `... ve ${remaining} sonuç daha.\nTüm liste: http://localhost:3000/expos?year=2026`,
            en: `... and ${remaining} more results.\nFull list: http://localhost:3000/expos?year=2026`,
            fr: `... et ${remaining} résultats de plus.\nListe complète: http://localhost:3000/expos?year=2026`,
          };
          response += `\n\n${lines}\n\n${moreHint[lang] || moreHint.tr}`;
        } else {
          response += '\n\n' + lines;
        }
      }
    }

    return isCeo ? wrapForCeo(response, lang, false) : response;
  } catch (err) {
    console.error('Query error:', err.message);
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
    editions: 'Edisyon', avg_price_per_m2: 'Ort. Fiyat',
    month_name: 'Ay', year: 'Yıl', agents: 'Agent', expos: 'Fuar',
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
    editions: 'Editions', avg_price_per_m2: 'Avg Price',
    month_name: 'Month', year: 'Year', agents: 'Agents', expos: 'Expos',
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
    editions: 'Éditions', avg_price_per_m2: 'Prix moyen',
    month_name: 'Mois', year: 'Année', agents: 'Agents', expos: 'Expos',
  },
};

function label(key, lang) {
  const map = LABELS[lang] || LABELS.tr;
  return map[key] || key.replace(/_/g, ' ');
}

function formatDate(val, lang) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const months = lang === 'fr' ? FR_MONTHS : lang === 'en' ? EN_MONTHS : TR_MONTHS;
  // Use dashes to prevent WhatsApp auto-linking dates
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

  // Build value parts with labels (skip the name column)
  const parts = [];
  for (const k of keys) {
    if (k === nameKey) continue;
    const v = row[k];
    if (v == null) continue;
    const formatted = formatVal(k, v, lang);
    if (formatted === '—') continue;
    const lbl = label(k, lang);
    parts.push(`${lbl}: ${formatted}`);
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
