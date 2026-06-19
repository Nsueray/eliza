const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const EXPIRY_MINUTES = 10;

// --- Templates ---

const TEMPLATES = {
  agent_activation: {
    tr: ({ recipientName, expoName, progress, soldM2, targetM2 }) =>
      `Merhaba ${recipientName},\n\n` +
      `${expoName} şu an %${progress} ilerleme ile geride. ` +
      `${soldM2} m² satıldı, hedef ${targetM2} m². ` +
      `Bu hafta bu fuarı önceliklendirelim.\n\n` +
      `Teşekkürler.`,

    en: ({ recipientName, expoName, progress, soldM2, targetM2 }) =>
      `Hi ${recipientName},\n\n` +
      `${expoName} is currently at ${progress}% progress, behind target. ` +
      `${soldM2} m² sold out of ${targetM2} m² target. ` +
      `Please prioritize this expo this week.\n\n` +
      `Thank you.`,

    fr: ({ recipientName, expoName, progress, soldM2, targetM2 }) =>
      `Bonjour ${recipientName},\n\n` +
      `${expoName} est actuellement à ${progress}% de progression, en retard. ` +
      `${soldM2} m² vendus sur un objectif de ${targetM2} m². ` +
      `Merci de prioriser cette expo cette semaine.\n\n` +
      `Merci.`,
  },

  rebooking_request: {
    tr: ({ recipientName, companyName, expoName, previousEdition }) =>
      `Merhaba ${recipientName},\n\n` +
      `${companyName} ${previousEdition || 'geçen edisyonda'} katılmıştı ama ` +
      `${expoName} için henüz kontrat yok. ` +
      `Rebooking için takip eder misin?\n\n` +
      `Teşekkürler.`,

    en: ({ recipientName, companyName, expoName, previousEdition }) =>
      `Hi ${recipientName},\n\n` +
      `${companyName} participated ${previousEdition ? 'in ' + previousEdition : 'in the previous edition'} but ` +
      `has no contract yet for ${expoName}. ` +
      `Could you follow up on rebooking?\n\n` +
      `Thank you.`,

    fr: ({ recipientName, companyName, expoName, previousEdition }) =>
      `Bonjour ${recipientName},\n\n` +
      `${companyName} a participé ${previousEdition ? 'à ' + previousEdition : "à l'édition précédente"} mais ` +
      `n'a pas encore de contrat pour ${expoName}. ` +
      `Pouvez-vous relancer pour le rebooking ?\n\n` +
      `Merci.`,
  },

  payment_reminder: {
    tr: ({ recipientName, companyName, expoName, amount, daysLeft }) =>
      `Merhaba ${recipientName},\n\n` +
      `${companyName} — ${expoName} kontratı için ` +
      `€${amount} ödenmemiş bakiye var. ` +
      `Etkinliğe ${daysLeft} gün kaldı. ` +
      `Ödeme takibini yapabilir misin?\n\n` +
      `Teşekkürler.`,

    en: ({ recipientName, companyName, expoName, amount, daysLeft }) =>
      `Hi ${recipientName},\n\n` +
      `${companyName} has an outstanding balance of €${amount} ` +
      `for ${expoName}. The event is in ${daysLeft} days. ` +
      `Could you follow up on payment?\n\n` +
      `Thank you.`,

    fr: ({ recipientName, companyName, expoName, amount, daysLeft }) =>
      `Bonjour ${recipientName},\n\n` +
      `${companyName} a un solde impayé de ${amount} € ` +
      `pour ${expoName}. L'événement est dans ${daysLeft} jours. ` +
      `Pouvez-vous relancer le paiement ?\n\n` +
      `Merci.`,
  },

  meeting_prep: {
    tr: ({ recipientName, expoName, contractCount, soldM2, revenue, topCompanies }) =>
      `Toplantı Özeti — ${expoName}\n\n` +
      `Durum: ${contractCount} kontrat, ${soldM2} m², €${revenue}\n` +
      (topCompanies ? `Başlıca firmalar: ${topCompanies}\n` : '') +
      `\nHazırlayan: ELIZA`,

    en: ({ recipientName, expoName, contractCount, soldM2, revenue, topCompanies }) =>
      `Meeting Brief — ${expoName}\n\n` +
      `Status: ${contractCount} contracts, ${soldM2} m², €${revenue}\n` +
      (topCompanies ? `Key companies: ${topCompanies}\n` : '') +
      `\nPrepared by: ELIZA`,

    fr: ({ recipientName, expoName, contractCount, soldM2, revenue, topCompanies }) =>
      `Résumé de réunion — ${expoName}\n\n` +
      `Statut: ${contractCount} contrats, ${soldM2} m², ${revenue} €\n` +
      (topCompanies ? `Entreprises clés: ${topCompanies}\n` : '') +
      `\nPréparé par: ELIZA`,
  },
};

// --- Recipient Resolution ---

/**
 * Find a sales agent by name (fuzzy match).
 * Returns { name, phone_number, preferred_language, office } or null.
 */
async function resolveRecipient(name) {
  // Reads sales_agents_legacy (the renamed table holding the 109 Zoho-string agents).
  // The new `sales_agents` (migration 026) is the Convert target and stays empty until the
  // Slice 3 backfill — so .msg recipient resolution must keep reading the legacy table.
  const result = await query(`
    SELECT name, phone_number, preferred_language, office
    FROM sales_agents_legacy
    WHERE name ILIKE $1
    ORDER BY name
    LIMIT 1
  `, [`%${name}%`]);
  return result.rows[0] || null;
}

// --- Context Fetching ---

/**
 * Fetch expo context data for message generation.
 */
async function getExpoContext(expoName) {
  const result = await query(`
    SELECT
      e.name AS expo_name,
      e.country,
      e.start_date,
      em.sold_m2,
      em.target_m2,
      em.progress_percent,
      em.velocity_m2_per_month,
      em.required_velocity,
      em.risk_level,
      em.months_to_event,
      (SELECT COUNT(*) FROM edition_contracts c WHERE c.expo_id = e.id) AS contract_count,
      (SELECT COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0)
       FROM edition_contracts c WHERE c.expo_id = e.id) AS revenue_eur
    FROM expos e
    LEFT JOIN expo_metrics em ON em.expo_id = e.id
    WHERE e.name ILIKE $1
    ORDER BY e.start_date DESC
    LIMIT 1
  `, [`%${expoName}%`]);
  return result.rows[0] || null;
}

/**
 * Fetch top companies for an expo (for meeting prep).
 */
async function getTopCompanies(expoName, limit = 5) {
  const result = await query(`
    SELECT c.company_name, c.m2, c.revenue_eur
    FROM edition_contracts c
    JOIN expos e ON e.id = c.expo_id
    WHERE e.name ILIKE $1
    ORDER BY c.revenue_eur DESC
    LIMIT $2
  `, [`%${expoName}%`, limit]);
  return result.rows;
}

// --- Template Detection ---

/**
 * Detect which template to use from a subject/topic keyword.
 */
function detectTemplate(subject) {
  if (!subject) return 'agent_activation';
  const s = subject.toLowerCase();

  if (s.includes('rebook') || s.includes('rebooking') || s.includes('davet') || s.includes('invitation')) {
    return 'rebooking_request';
  }
  if (s.includes('ödeme') || s.includes('payment') || s.includes('paiement') || s.includes('bakiye') || s.includes('balance')) {
    return 'payment_reminder';
  }
  if (s.includes('toplantı') || s.includes('meeting') || s.includes('réunion') || s.includes('prep') || s.includes('özet')) {
    return 'meeting_prep';
  }
  return 'agent_activation';
}

// --- Message Generation ---

/**
 * Generate a message draft.
 * @param {string} recipientName - Agent name to send to
 * @param {string} subject - Topic or expo name
 * @param {string} templateType - Optional override (agent_activation, rebooking_request, payment_reminder, meeting_prep)
 * @returns {{ draft, recipient, context }}
 */
async function generateMessage(recipientName, subject, templateType) {
  const recipient = await resolveRecipient(recipientName);
  if (!recipient) {
    throw new Error(`Alıcı bulunamadı: ${recipientName}`);
  }

  const lang = recipient.preferred_language || 'en';
  const type = templateType || detectTemplate(subject);
  const template = TEMPLATES[type];
  if (!template || !template[lang]) {
    throw new Error(`Şablon bulunamadı: ${type}/${lang}`);
  }

  // Extract expo name from subject (strip template keywords)
  const expoSearch = subject
    ? subject.replace(/\b(rebooking|rebook|ödeme|payment|paiement|toplantı|meeting|réunion|prep|davet|invitation)\b/gi, '').trim()
    : '';

  // Fetch context data
  const expoContext = expoSearch ? await getExpoContext(expoSearch) : null;
  const topCompanies = type === 'meeting_prep' && expoSearch
    ? await getTopCompanies(expoSearch)
    : [];

  const params = {
    recipientName: recipient.name,
    expoName: expoContext?.expo_name || expoSearch || subject || '—',
    progress: expoContext?.progress_percent || 0,
    soldM2: expoContext?.sold_m2 || 0,
    targetM2: expoContext?.target_m2 || 0,
    contractCount: expoContext?.contract_count || 0,
    revenue: expoContext?.revenue_eur ? Number(expoContext.revenue_eur).toLocaleString('de-DE') : '0',
    daysLeft: expoContext?.months_to_event ? Math.round(expoContext.months_to_event * 30) : '?',
    companyName: expoSearch || subject || '—',
    previousEdition: null,
    amount: '0',
    topCompanies: topCompanies.length > 0
      ? topCompanies.map(c => c.company_name).join(', ')
      : null,
  };

  const body = template[lang](params);

  // Save draft to DB
  const result = await query(`
    INSERT INTO message_drafts (recipient_name, recipient_phone, template_type, language, subject, body, context_data, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    RETURNING *
  `, [
    recipient.name,
    recipient.phone_number,
    type,
    lang,
    subject,
    body,
    JSON.stringify({ expo: expoContext, params }),
  ]);

  return {
    draft: result.rows[0],
    recipient,
    context: expoContext,
  };
}

// --- Draft Management ---

/**
 * Get pending draft for CEO approval.
 */
async function getPendingDraft() {
  const result = await query(`
    SELECT * FROM message_drafts
    WHERE status = 'pending'
      AND created_at > NOW() - INTERVAL '${EXPIRY_MINUTES} minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return result.rows[0] || null;
}

/**
 * Approve and send a draft message via Twilio WhatsApp.
 */
async function approveDraft(draftId) {
  const result = await query(`
    SELECT * FROM message_drafts WHERE id = $1 AND status = 'pending'
  `, [draftId]);

  if (result.rows.length === 0) {
    throw new Error('Taslak bulunamadı veya süresi dolmuş.');
  }

  const draft = result.rows[0];

  // Check expiry
  const age = (Date.now() - new Date(draft.created_at).getTime()) / 1000 / 60;
  if (age > EXPIRY_MINUTES) {
    await query(`UPDATE message_drafts SET status = 'expired', expired_at = NOW() WHERE id = $1`, [draftId]);
    throw new Error('Taslak süresi doldu (10 dakika).');
  }

  // Send via Twilio
  const sent = await sendWhatsApp(draft.recipient_phone, draft.body);

  const newStatus = sent ? 'sent' : 'send_failed';
  await query(`
    UPDATE message_drafts
    SET status = $1, approved_at = NOW(), sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE NULL END
    WHERE id = $2
  `, [newStatus, draftId]);

  return { sent, draft };
}

/**
 * Cancel a pending draft.
 */
async function cancelDraft(draftId) {
  await query(`
    UPDATE message_drafts SET status = 'cancelled' WHERE id = $1 AND status = 'pending'
  `, [draftId]);
}

/**
 * Expire old pending drafts.
 */
async function expireOldDrafts() {
  await query(`
    UPDATE message_drafts
    SET status = 'expired', expired_at = NOW()
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '${EXPIRY_MINUTES} minutes'
  `);
}

// --- WhatsApp Sending ---

async function sendWhatsApp(toPhone, body) {
  if (!toPhone) {
    console.log('[messages] No phone number for recipient, logging only.');
    console.log('[messages] Body:', body);
    return false;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[messages] Twilio credentials not configured. Message logged:');
    console.log('[messages]', body);
    return false;
  }

  try {
    const twilio = require('twilio')(accountSid, authToken);
    await twilio.messages.create({
      body,
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${toPhone}`,
    });
    return true;
  } catch (err) {
    console.error('[messages] WhatsApp send failed:', err.message);
    return false;
  }
}

// --- Template List ---

function getTemplates() {
  return Object.keys(TEMPLATES).map(key => ({
    type: key,
    languages: Object.keys(TEMPLATES[key]),
  }));
}

module.exports = {
  generateMessage,
  getPendingDraft,
  approveDraft,
  cancelDraft,
  expireOldDrafts,
  resolveRecipient,
  getExpoContext,
  detectTemplate,
  getTemplates,
  TEMPLATES,
};
