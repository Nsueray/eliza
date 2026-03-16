const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const client = new Anthropic();
const REWRITE_MODEL = process.env.AI_INTENT_MODEL || 'claude-haiku-4-5-20251001';

const REWRITE_PROMPT = `You are a question rewriter for a business assistant. You receive a conversation history and a new question.

RULES:
1. If the new question is a FOLLOW-UP (contains pronouns, references to previous context, or is incomplete without context), rewrite it as a self-contained question by carrying forward relevant entities (expo name, agent name, year, country) from history.
2. If the new question is INDEPENDENT (has its own subject, asks about a different topic, or is a general question), return it UNCHANGED. Do NOT inject context from history.

FOLLOW-UP signals (rewrite needed):
- Pronouns/references: "peki", "onun", "bunun", "ya", "ayrıca", "o fuar", "orada", "aynı", "onlar", "what about", "and the", "et le"
- Explicit entity swap: "peki SIEMA?", "ve Madesign?", "peki Meriem?" → carry forward the metric/question type, swap the entity
- Incomplete questions: "geliri?", "riski ne?", "kaç kontrat?" (meaningless alone — needs context)
- Time shifts: "peki geçen yıl?", "peki ocak?" → keep entity, change time

INDEPENDENT signals (do NOT rewrite):
- Question has its own expo name, agent name, or country AND its own metric/question type
- General business questions are ALWAYS independent even if previous context exists. Never inject expo names, years, or agent names into these.
- Ranking/superlative questions without explicit context reference: "en çok", "en iyi", "en az", "best", "most", "least", "top"
- Questions with new entities not in history

ALWAYS INDEPENDENT patterns (NEVER rewrite these, regardless of history):
- "en çok kim satmış?" / "who sold the most?" / "qui a le plus vendu?"
- "en iyi satışçı kim?" / "best agent?" / "meilleur agent?"
- "toplam gelir ne?" / "total revenue?" / "revenu total?"
- "kaç fuar var?" / "how many expos?" / "combien d'expos?"
- "hangi fuarlar riskli?" / "which expos at risk?"
- "bugün kaç sözleşme?" / "today how many contracts?"
- "bu ay ne kadar satıldı?" / "how much sold this month?"
- Any question starting with "en çok", "en iyi", "en az", "kaç tane", "toplam"
- Any question containing "kim satmış", "best agent", "top agent", "top sales"

ENTITY TYPES:
- Expo names: SIEMA, Mega Clima, Madesign, Foodexpo, Buildexpo, Plastexpo, etc.
- Agent names: Elif, Meriem, Emircan, Joanna, Amaka, Damilola, Sinerji, Anka
- Countries: Turkey, Nigeria, Morocco, Kenya, Algeria

EXAMPLES:

History: 'SIEMA 2026 kaç m²?' → answer
Question: 'peki geliri?'
Output: SIEMA 2026 geliri ne kadar?

History: 'SIEMA 2026 kaç m²?' → answer
Question: 'en iyi satışçı kim?'
Output: en iyi satışçı kim?

History: 'SIEMA 2026 kaç m²?' → answer
Question: 'Elif kaç satmış?'
Output: Elif kaç satmış?

History: 'SIEMA 2026 kaç m²?' → answer
Question: 'oradaki firmalar?'
Output: SIEMA 2026 firmalar hangileri?

History: 'SIEMA 2026 kaç m²?' → answer
Question: 've Madesign?'
Output: Madesign 2026 kaç m²?

History: 'elif bu ay kaç m2 satmış?' → answer
Question: 'peki Meriem?'
Output: Meriem bu ay kaç m2 satmış?

History: 'elif bu ay kaç m2 satmış?' → answer
Question: 'Madesign nasıl gidiyor?'
Output: Madesign nasıl gidiyor?

History: 'bu hafta en çok kim satmış?' → answer
Question: 'peki geçen hafta?'
Output: geçen hafta en çok kim satmış?

History: 'SIEMA 2026 kaç m²?' → answer about SIEMA
Question: 'en çok kim satmış?'
Output: en çok kim satmış?

History: 'Mega Clima 2026 geliri ne kadar?' → answer about Mega Clima
Question: 'toplam gelir ne?'
Output: toplam gelir ne?

History: 'Elif bu ay kaç m2 satmış?' → answer about Elif
Question: 'en iyi satışçı kim?'
Output: en iyi satışçı kim?

If the question is independent, return it exactly as-is with no modifications.
Return ONLY the rewritten (or unchanged) question, nothing else.`;

/**
 * Get recent conversation history for a user.
 * Returns last 5 messages within 2 hours, in chronological order.
 */
async function getHistory(userPhone) {
  if (!userPhone) return { messages: [], lastMessageTime: null };

  try {
    const result = await query(`
      SELECT message_text, response_text, created_at
      FROM message_logs
      WHERE user_phone = $1
        AND created_at > NOW() - INTERVAL '2 hours'
        AND is_command = false
        AND message_text IS NOT NULL
        AND response_text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `, [userPhone]);

    if (result.rows.length === 0) return { messages: [], lastMessageTime: null };

    // Most recent message time (first row since ORDER BY DESC)
    const lastMessageTime = result.rows[0].created_at;

    // Reverse to chronological order (oldest first)
    const rows = result.rows.reverse();
    const messages = [];
    for (const row of rows) {
      messages.push({ role: 'user', content: row.message_text });
      messages.push({ role: 'assistant', content: row.response_text });
    }
    return { messages, lastMessageTime };
  } catch (err) {
    console.error('getHistory error:', err.message);
    return { messages: [], lastMessageTime: null };
  }
}

/**
 * Rewrite a follow-up question to be self-contained using conversation history.
 * Returns { question, _usage } where question is the rewritten (or original) text.
 */
async function rewriteQuestion(currentQuestion, history) {
  const noRewrite = {
    question: currentQuestion,
    _usage: { input_tokens: 0, output_tokens: 0, model: 'none' },
  };

  // No history or too little context → no rewrite needed
  if (!history || history.length < 2) return noRewrite;

  // Pre-check: always-independent patterns skip LLM entirely
  const qLower = currentQuestion.toLowerCase();
  const ALWAYS_INDEPENDENT = [
    /^en (cok|iyi|az|basarili|aktif)\b/,
    /\ben (cok|iyi|az) kim\b/,
    /\bkim satmis\b/,
    /\btoplam gelir\b/,
    /\btotal revenue\b/,
    /\bbest agent\b/,
    /\btop (agent|sales)\b/,
    /\bwho sold the most\b/,
    /\bkac fuar\b/,
    /\bhow many expo/,
    /\bhangi fuar.*risk/,
  ];
  const normQ = qLower.replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[ğĞ]/g, 'g');
  if (ALWAYS_INDEPENDENT.some(re => re.test(normQ))) return noRewrite;

  // Format history for prompt
  const historyText = history.map(h => {
    const prefix = h.role === 'user' ? 'User' : 'ELIZA';
    // Truncate long responses to keep prompt small
    const content = h.content.length > 300 ? h.content.slice(0, 300) + '...' : h.content;
    return `${prefix}: ${content}`;
  }).join('\n');

  try {
    const response = await client.messages.create({
      model: REWRITE_MODEL,
      max_tokens: 200,
      system: REWRITE_PROMPT,
      messages: [{
        role: 'user',
        content: `Conversation history:\n${historyText}\n\nNew question: ${currentQuestion}`,
      }],
    });

    const rewritten = response.content[0].text.trim();
    const usage = {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
      model: REWRITE_MODEL,
    };

    // If Haiku returned empty or something weird, use original
    if (!rewritten || rewritten.length === 0) return noRewrite;

    return { question: rewritten, _usage: usage };
  } catch (err) {
    console.error('rewriteQuestion error:', err.message);
    return noRewrite;
  }
}

module.exports = { getHistory, rewriteQuestion };
