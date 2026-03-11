const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const client = new Anthropic();
const REWRITE_MODEL = process.env.AI_INTENT_MODEL || 'claude-haiku-4-5-20251001';

const REWRITE_PROMPT = `You are a question rewriter for ELIZA, a business intelligence system for Elan Expo (exhibition organizer).

Your ONLY job: rewrite follow-up questions into fully self-contained questions by carrying over entities from conversation history.

CRITICAL RULES:
1. ALWAYS carry forward the main entity (expo name, agent name, country) from the previous question
2. When user says 'peki geçen yıl?' or 'and last year?' → keep the SAME entity, change only the year
3. When user says 'peki ocak?' or 'and january?' → keep the SAME entity and agent, change only the time period
4. When user says 'peki SIEMA?' → keep the same metric/question type, change only the entity
5. If the question is already self-contained (has its own entity + metric), return it UNCHANGED
6. Output ONLY the rewritten question. No explanation, no prefix, no quotes.

ENTITY TYPES to carry forward:
- Expo names: SIEMA, Mega Clima, Madesign, Foodexpo, Buildexpo, Plastexpo, etc.
- Agent names: Elif, Meriem, Emircan, Joanna, Amaka, Damilola, Sinerji, Anka
- Countries: Turkey, Nigeria, Morocco, Kenya, Algeria
- Metrics: m², revenue, contracts, risk, progress

EXAMPLES:

History: 'SIEMA 2026 kaç m²?' → answer about SIEMA
Question: 'peki geçen yıl?'
Output: SIEMA 2025 kaç m²?

History: 'SIEMA 2026 kaç m²?' → answer about SIEMA
Question: 've Madesign?'
Output: Madesign 2026 kaç m²?

History: 'elif bu ay kaç m2 satmış?' → answer about Elif
Question: 'peki ocak 2026 ayında?'
Output: elif ocak 2026 kaç m2 satmış?

History: 'elif bu ay kaç m2 satmış?' → answer about Elif
Question: 'peki Meriem?'
Output: Meriem bu ay kaç m2 satmış?

History: 'top agents 2026' → answer with agent list
Question: 'peki Elif ne kadar sattı?'
Output: Elif 2026 toplam ne kadar sattı?

History: 'Madesign risk durumu' → answer about Madesign risk
Question: 'peki SIEMA?'
Output: SIEMA risk durumu nedir?

History: 'Nigeria kaç fuar var 2026?' → answer about Nigeria
Question: 've Morocco?'
Output: Morocco kaç fuar var 2026?

History: 'bu hafta en çok kim satmış?' → answer with agents
Question: 'peki geçen hafta?'
Output: geçen hafta en çok kim satmış?`;

/**
 * Get recent conversation history for a user.
 * Returns last 5 messages within 2 hours, in chronological order.
 */
async function getHistory(userPhone) {
  if (!userPhone) {
    console.log('[MEMORY] getHistory: no phone provided, skipping');
    return [];
  }

  try {
    const result = await query(`
      SELECT message_text, response_text
      FROM message_logs
      WHERE user_phone = $1
        AND created_at > NOW() - INTERVAL '2 hours'
        AND is_command = false
        AND message_text IS NOT NULL
        AND response_text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `, [userPhone]);

    console.log(`[MEMORY] getHistory phone: ${userPhone}, found: ${result.rows.length} messages`);

    if (result.rows.length === 0) return [];

    // Reverse to chronological order (oldest first)
    const rows = result.rows.reverse();
    const history = [];
    for (const row of rows) {
      history.push({ role: 'user', content: row.message_text });
      history.push({ role: 'assistant', content: row.response_text });
    }
    return history;
  } catch (err) {
    console.error('getHistory error:', err.message);
    return [];
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
  if (!history || history.length < 2) {
    console.log(`[REWRITE] skipped — history length: ${history?.length || 0}`);
    return noRewrite;
  }

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

    console.log(`[REWRITE] input: "${currentQuestion}" → output: "${rewritten}" (history: ${history.length} entries)`);

    // If Haiku returned empty or something weird, use original
    if (!rewritten || rewritten.length === 0) return noRewrite;

    return { question: rewritten, _usage: usage };
  } catch (err) {
    console.error('rewriteQuestion error:', err.message);
    return noRewrite;
  }
}

module.exports = { getHistory, rewriteQuestion };
