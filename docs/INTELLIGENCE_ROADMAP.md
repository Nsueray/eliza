# ELIZA Intelligence Upgrade Roadmap v4
## Complete Implementation Specification
## From Template Bot → CEO Operating System

Final version. 3 rounds of AI consultation (Claude, ChatGPT, Gemini, Grok).
Every file, function, SQL schema, prompt, edge case, and test scenario documented.

---

## CORE PRINCIPLE

**Ask when it matters, answer when it doesn't.**

Does the missing information change the SQL or the business answer?
- YES → ask one clarification question (material ambiguity)
- NO → answer directly, even if technically ambiguous
- DATA NOT AVAILABLE → say so honestly

Advanced: **Speculative Disambiguation**
Run 2-3 interpretations cheaply in parallel. If same result → answer without asking.
Example: "SIEMA'ya en çok kim satmış?" → check 2025 AND 2026 → if Elif tops both → answer directly.

---

# PHASE 0: EVAL + SECURITY (Day 0 — before any feature)

## 0a. Hybrid SQL Scope Fix (IMMEDIATE — 30 minutes)

### Problem
`generateSQL()` output is NOT passed through `applyScope()`.
Any non-CEO user whose question falls to hybrid SQL sees ALL data.

### Current Code (queryEngine.js lines 945-964)
```javascript
if (isUnknownIntent) {
  const sqlResult = await generateSQL(question, lang, user);
  if (sqlResult.sql) {
    const validatedSQL = validateSQL(sqlResult.sql);
    await query('SET statement_timeout = 3000');
    const result = await query(validatedSQL); // ← NO SCOPE!
    data = result.rows;
  }
}
```

### Fix
```javascript
if (isUnknownIntent) {
  const sqlResult = await generateSQL(question, lang, user);
  if (sqlResult.sql) {
    const validatedSQL = validateSQL(sqlResult.sql);
    // Apply user scope BEFORE execution
    const scoped = applyScope(validatedSQL, [], 'hybrid_sql', user);
    await query('SET statement_timeout = 3000');
    try {
      const result = await query(scoped.sql, scoped.params);
      data = result.rows;
      finalIntent = 'hybrid_sql';
    } finally {
      await query('SET statement_timeout = 0');
    }
  }
}
```

### Also Required
Add 'hybrid_sql' to the appropriate scope category. In `applyScope`:
- hybrid_sql should get FULL scope enforcement (agent + year filters)
- Add to neither NO_SCOPE_INTENTS nor NO_AGENT_FILTER_INTENTS

### File: packages/ai/queryEngine.js
### Test: Elif (data_scope=team) sends an unknown question → hybrid SQL fires → result should be filtered to International group only

---

## 0b. Add 7 Missing Router Rules (2 hours)

### Problem
The most common CEO questions always require Haiku API call because router doesn't have rules for them.

### Current Router: 12 rules (router.js)
Missing: expo_progress, agent_performance, expo_agent_breakdown, expo_company_list, cluster_performance, company_search, compound

### File: packages/ai/router.js → RULES array

Add these rules (insert at correct priority position):

```javascript
// Add BEFORE existing rules, after days_to_event:

// expo_progress — "SIEMA nasıl gidiyor?", "SIEMA 2026 kaç m²?"
{
  intent: 'expo_progress',
  keywords: [
    ['nasil gidiyor'],
    ['nasil', 'fuar'],
    ['progress'],
    ['ilerleme'],
    ['durum', 'fuar'],
    ['kac m2 satilmis'],
    ['kac m2', 'satildi'],
    ['how is', 'doing'],
    ['how is', 'expo'],
    ['how much', 'sold', 'expo'],
  ],
},

// agent_performance — "Elif kaç satmış?", "Elif performansı"
{
  intent: 'agent_performance',
  keywords: [
    ['kac satmis'],
    ['ne kadar satmis'],
    ['kac m2 satmis'],
    ['performans'],
    ['performance'],
    ['how much', 'sold'],
    ['combien', 'vendu'],
  ],
},

// expo_agent_breakdown — "SIEMA'da kim satmış?"
{
  intent: 'expo_agent_breakdown',
  keywords: [
    ['kim satmis'],
    ['who sold'],
    ['qui a vendu'],
    ['hangi agent', 'satmis'],
    ['which agent', 'sold'],
  ],
},

// expo_company_list — "SIEMA'daki firmalar"
{
  intent: 'expo_company_list',
  keywords: [
    ['firma listesi'],
    ['firmalar'],
    ['company list'],
    ['companies in'],
    ['exhibitor list'],
    ['katilimci listesi'],
    ['les entreprises'],
  ],
},

// cluster_performance — "Nigeria cluster", "Casablanca cluster"
{
  intent: 'cluster_performance',
  keywords: [
    ['cluster'],
    ['kume'],
  ],
},

// company_search — "Bosch firması", "Samsung hakkında"
{
  intent: 'company_search',
  keywords: [
    ['firma hakkinda'],
    ['firmasi'],
    ['company info'],
    ['about company'],
    ['sirket'],
  ],
},
```

### Priority Order (full list after changes)
1. days_to_event
2. payment_status
3. rebooking_rate
4. price_per_m2
5. expo_progress (NEW)
6. agent_performance (NEW)
7. expo_agent_breakdown (NEW)
8. expo_company_list (NEW)
9. monthly_trend
10. top_agents
11. agent_country_breakdown
12. agent_expo_breakdown
13. exhibitors_by_country
14. country_count
15. revenue_summary
16. cluster_performance (NEW)
17. company_search (NEW)
18. expo_list (keep near last — catch-all for fuar queries)

### Test: "SIEMA 2026 kaç m²?" should now match router (not Haiku). Check message_logs → model_intent should show 'router' not 'claude-haiku-4-5-20251001'.

---

## 0c. Success Metrics Definition

### File: NEW — docs/EVAL_METRICS.md

Define these metrics (measured from message_logs):

| Metric | Target | SQL to Measure |
|--------|--------|----------------|
| Wrong answer rate | < 5% | Manual review sample |
| Unnecessary clarification rate | < 10% | Clarification asked but answer was obvious |
| Missed clarification rate | < 5% | Wrong answer that should have asked first |
| Unanswerable honesty rate | > 95% | "Data not available" when truly unavailable |
| Scope leak rate | 0% | Non-CEO user sees unfiltered data |
| P95 latency | < 5s | SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) FROM message_logs |
| Token cost per message | < $0.03 | AVG(total_tokens) * price_per_token |
| Router hit rate | > 70% | COUNT(model_intent='router') / COUNT(*) |
| Clarification completion rate | > 80% | Clarifications that led to successful answer vs abandoned |

### Also: Add these columns to message_logs for observability

```sql
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS rewritten_question TEXT;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS generated_sql TEXT;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS scope_applied VARCHAR(20);
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS clarification_asked BOOLEAN DEFAULT FALSE;
```

Update logMessage() in handler.js to populate these fields.

---

# PHASE A: SEMANTIC FRAME + AMBIGUITY DETECTION

## A1. Semantic Frame Extraction

### What Changes
Replace current `extractIntent()` Haiku prompt with a semantic frame prompt.
Router fast path stays unchanged — semantic frame only runs when router doesn't match.

### File: packages/ai/queryEngine.js

### Current Flow
```
Router match? → YES → {intent, entities}
             → NO → Haiku extractIntent() → {intent, entities}
```

### New Flow
```
Router match? → YES → {intent, entities, confidence: 1.0}
             → NO → Haiku extractSemanticFrame() → {frame with ambiguity_flags}
                     → frame.task maps to intent
                     → frame.ambiguity_flags checked
```

### New Function: extractSemanticFrame(question)

Replace `INTENT_PROMPT` with `FRAME_PROMPT`:

```javascript
const FRAME_PROMPT = `You are ELIZA's semantic frame extractor for Elan Expo (exhibition organizer).

Given a business question, extract a structured JSON frame.

DATABASE CONTEXT:
- Expos: SIEMA, Mega Clima, Madesign, Foodexpo, Buildexpo, Plastexpo, Elect Expo, HVAC
- Expos have editions by year (e.g., SIEMA 2024, SIEMA 2025, SIEMA 2026)
- Agents: Elif AY, Meriem, Emircan, Joanna, Amaka, Damilola, Sinerji, Anka, Bengu
- Countries: Turkey, Nigeria, Morocco, Kenya, Algeria, Ghana, China
- Metrics: m² (area sold), revenue (€), contracts (count), progress (%), risk level, velocity
- Data available: 2014-2026 (main focus 2024-2026)
- Data NOT available: payment balance (only contract revenue), salaries, personal info, currency conversion

TASK TYPES:
- aggregate: SUM/COUNT/AVG (e.g., "total revenue", "how many contracts")
- rank_top: ranking by metric (e.g., "top agents", "who sold most")
- compare: side-by-side (e.g., "2025 vs 2026", "SIEMA vs Madesign")
- trend: over time (e.g., "monthly sales", "weekly trend")
- list: filtered items (e.g., "expo list", "company list")
- detail: single entity deep dive (e.g., "SIEMA 2026 details")
- exception: outliers/risks (e.g., "at risk expos", "inactive agents")
- explain: why analysis (e.g., "why is SIEMA at risk?")

AMBIGUITY RULES:
- If expo name given but year not specified AND multiple editions exist → flag expo_year as critical
- If ranking/comparison asked but metric not specified → flag metric as critical
- If time period could mean different things → flag time_scope as warning
- If question is about data that ELIZA doesn't have → set answerability to "unavailable" with reason

Output ONLY valid JSON, nothing else:
{
  "language": "tr|en|fr",
  "task": "aggregate|rank_top|compare|trend|list|detail|exception|explain",
  "subject": "sales_agent|expo|company|country|office|general",
  "expo_name": "string or null",
  "expo_year": "number or null",
  "agent_name": "string or null",
  "country": "string or null",
  "metric": "m2|revenue|contracts|progress|risk|velocity|null",
  "time_scope": {"type": "year|month|week|day|range|null", "value": "..."},
  "group_by": "string or null",
  "ambiguity_flags": [
    {"slot": "field_name", "severity": "critical|warning", "options": ["opt1","opt2"], "options_from_db": false}
  ],
  "answerability": "answerable|unavailable|partial",
  "unavailable_reason": "string or null",
  "confidence": 0-100,
  "maps_to_intent": "one of the 19 existing intent names or null"
}

FEW-SHOT EXAMPLES:

Q: "SIEMA'ya en çok kim satmış?"
{
  "language": "tr",
  "task": "rank_top",
  "subject": "sales_agent",
  "expo_name": "SIEMA",
  "expo_year": null,
  "metric": null,
  "time_scope": null,
  "ambiguity_flags": [
    {"slot": "expo_year", "severity": "critical", "options": ["2026","2025","2024"], "options_from_db": true},
    {"slot": "metric", "severity": "critical", "options": ["m²","revenue (€)","contracts"], "options_from_db": false}
  ],
  "answerability": "answerable",
  "confidence": 35,
  "maps_to_intent": "expo_agent_breakdown"
}

Q: "SIEMA 2026 kaç m²?"
{
  "language": "tr",
  "task": "detail",
  "subject": "expo",
  "expo_name": "SIEMA",
  "expo_year": 2026,
  "metric": "m2",
  "time_scope": {"type": "year", "value": 2026},
  "ambiguity_flags": [],
  "answerability": "answerable",
  "confidence": 98,
  "maps_to_intent": "expo_progress"
}

Q: "elif bu ay kaç m2 satmış?"
{
  "language": "tr",
  "task": "aggregate",
  "subject": "sales_agent",
  "agent_name": "Elif",
  "metric": "m2",
  "time_scope": {"type": "month", "value": "current"},
  "ambiguity_flags": [],
  "answerability": "answerable",
  "confidence": 95,
  "maps_to_intent": "agent_performance"
}

Q: "kalan ödemeler ne kadar?"
{
  "language": "tr",
  "task": "aggregate",
  "subject": "general",
  "metric": "payment_balance",
  "ambiguity_flags": [],
  "answerability": "partial",
  "unavailable_reason": "Actual payment balance (Balance1) is not synced from Zoho. Only contract revenue (Grand_Total) is available. For real payment status, check Zoho CRM directly.",
  "confidence": 80,
  "maps_to_intent": "payment_status"
}

Q: "Türkiye'nin nüfusu kaç?"
{
  "language": "tr",
  "task": null,
  "subject": null,
  "ambiguity_flags": [],
  "answerability": "unavailable",
  "unavailable_reason": "This question is outside ELIZA's scope. ELIZA only has Elan Expo business data: expos, contracts, agents, revenue.",
  "confidence": 99,
  "maps_to_intent": null
}

Q: "2025 ile 2026 satışlarını karşılaştır"
{
  "language": "tr",
  "task": "compare",
  "subject": "general",
  "metric": null,
  "time_scope": {"type": "range", "value": [2025, 2026]},
  "ambiguity_flags": [
    {"slot": "metric", "severity": "warning", "options": ["m²","revenue (€)","contracts"], "options_from_db": false}
  ],
  "answerability": "answerable",
  "confidence": 70,
  "maps_to_intent": "compound"
}

Q: "en çok gelir getiren 3 ülke hangileri?"
{
  "language": "tr",
  "task": "rank_top",
  "subject": "country",
  "metric": "revenue",
  "time_scope": null,
  "group_by": "country",
  "ambiguity_flags": [
    {"slot": "expo_year", "severity": "warning", "options": ["2026","all_time"], "options_from_db": false}
  ],
  "answerability": "answerable",
  "confidence": 75,
  "maps_to_intent": null
}

Q: "1 euro kaç TL?"
{
  "language": "tr",
  "task": null,
  "ambiguity_flags": [],
  "answerability": "unavailable",
  "unavailable_reason": "ELIZA does not have live exchange rate data.",
  "confidence": 99,
  "maps_to_intent": null
}`;
```

### Function Signature
```javascript
async function extractSemanticFrame(question) {
  // Try router first (0 API cost)
  const routed = route(question);
  if (routed) {
    return {
      frame: null,
      intent: routed.intent,
      entities: routed.entities,
      confidence: 1.0,
      ambiguity_flags: [],
      answerability: 'answerable',
      source: 'router',
      _usage: { input_tokens: 0, output_tokens: 0, model: 'router' },
    };
  }

  // LLM semantic frame extraction
  const response = await client.messages.create({
    model: INTENT_MODEL, // Haiku — fast, cheap
    max_tokens: 600,
    system: FRAME_PROMPT,
    messages: [{ role: 'user', content: `Question: ${question}` }],
  });

  const text = response.content[0].text.trim();
  const usage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    model: INTENT_MODEL,
  };

  // Parse JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      frame: null,
      intent: 'general_stats',
      entities: {},
      confidence: 0,
      ambiguity_flags: [],
      answerability: 'answerable',
      source: 'haiku_parse_fail',
      _usage: usage,
    };
  }

  let frame;
  try {
    frame = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      frame: null,
      intent: 'general_stats',
      entities: {},
      confidence: 0,
      ambiguity_flags: [],
      answerability: 'answerable',
      source: 'haiku_json_fail',
      _usage: usage,
    };
  }

  // Map frame to existing intent + entities for backward compatibility
  const intent = frame.maps_to_intent || 'general_stats';
  const entities = {
    expo_name: frame.expo_name || null,
    agent_name: frame.agent_name || null,
    country: frame.country || null,
    year: frame.expo_year || (frame.time_scope?.type === 'year' ? frame.time_scope.value : null),
    month: frame.time_scope?.type === 'month' ? (frame.time_scope.value === 'current' ? new Date().getMonth() + 1 : frame.time_scope.value) : null,
    metric: frame.metric || null,
  };

  // Resolve "current" year/month
  if (entities.year === 'current') entities.year = new Date().getFullYear();
  if (entities.month === 'current') entities.month = new Date().getMonth() + 1;

  return {
    frame,
    intent,
    entities,
    confidence: frame.confidence || 0,
    ambiguity_flags: frame.ambiguity_flags || [],
    answerability: frame.answerability || 'answerable',
    unavailable_reason: frame.unavailable_reason || null,
    source: 'haiku_frame',
    _usage: usage,
  };
}
```

---

## A2. Material Ambiguity Gate

### File: NEW — packages/ai/ambiguityGate.js

```javascript
/**
 * Ambiguity Gate — decides whether to answer, clarify, or refuse.
 *
 * Decision tree:
 * 1. Pending clarification? → resolve (handled in handler.js before this)
 * 2. Unanswerable? → honest failure message
 * 3. Critical slot missing? → speculative disambiguation first
 *    3a. If same result across interpretations → answer directly
 *    3b. If different results → ask clarification
 * 4. Warning slot missing + user has default? → use default
 * 5. All clear → execute
 *
 * Returns:
 * { action: 'execute' } — proceed to query
 * { action: 'clarify', slot, question, options, language } — ask user
 * { action: 'refuse', message, language } — can't answer
 * { action: 'partial', message, language } — partial answer with caveat
 */

const { query } = require('../db/index.js');

// Which slots are required for which task types
const REQUIRED_SLOTS = {
  rank_top: ['metric'],      // must know what to rank by
  compare: ['metric'],       // must know what to compare
  trend: [],                 // time is usually implied
  aggregate: [],             // can default to all
  list: [],                  // can return full list
  detail: [],                // expo_name usually provided
  exception: [],             // risk queries self-contained
  explain: [],               // analysis queries self-contained
};

// Slot clarification templates
const CLARIFICATION_TEMPLATES = {
  expo_year: {
    tr: (options) => `Hangi edisyonu soruyorsun?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    en: (options) => `Which edition?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    fr: (options) => `Quelle édition ?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
  },
  metric: {
    tr: (options) => `Neye göre sıralayayım?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    en: (options) => `Sort by what?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    fr: (options) => `Trier par quoi ?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
  },
  time_scope: {
    tr: (options) => `Hangi dönem?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    en: (options) => `Which period?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    fr: (options) => `Quelle période ?\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
  },
};

// Unanswerable response templates
const UNAVAILABLE_TEMPLATES = {
  tr: (reason) => `Bu bilgi ELIZA'da mevcut değil. ${reason || 'Fuar, satış, agent veya finans hakkında soru sorabilirsiniz.'}`,
  en: (reason) => `This data is not available in ELIZA. ${reason || 'You can ask about expos, sales, agents, or financials.'}`,
  fr: (reason) => `Cette information n'est pas disponible dans ELIZA. ${reason || 'Vous pouvez poser des questions sur les expos, ventes, agents ou finances.'}`,
};

async function evaluateAmbiguity(frameResult, user) {
  const { frame, intent, entities, confidence, ambiguity_flags, answerability, unavailable_reason } = frameResult;
  const lang = frame?.language || 'tr';

  // 1. Unanswerable
  if (answerability === 'unavailable') {
    return {
      action: 'refuse',
      message: (UNAVAILABLE_TEMPLATES[lang] || UNAVAILABLE_TEMPLATES.tr)(unavailable_reason),
      language: lang,
    };
  }

  // 2. Partial (e.g., payment_status — data exists but incomplete)
  if (answerability === 'partial') {
    return {
      action: 'partial',
      message: unavailable_reason || null,
      language: lang,
    };
  }

  // 3. No ambiguity flags → execute
  if (!ambiguity_flags || ambiguity_flags.length === 0) {
    return { action: 'execute' };
  }

  // 4. Check critical flags
  const criticalFlags = ambiguity_flags.filter(f => f.severity === 'critical');

  if (criticalFlags.length === 0) {
    // Only warnings → execute with defaults
    return { action: 'execute' };
  }

  // 5. For each critical flag, try speculative disambiguation
  for (const flag of criticalFlags) {
    // If options need to come from DB, fetch them
    let options = flag.options || [];
    if (flag.options_from_db && flag.slot === 'expo_year' && entities.expo_name) {
      try {
        const result = await query(
          `SELECT DISTINCT EXTRACT(YEAR FROM e.start_date)::int AS year
           FROM expos e WHERE e.name ILIKE $1 AND e.start_date IS NOT NULL
           ORDER BY year DESC LIMIT 5`,
          [`%${entities.expo_name}%`]
        );
        options = result.rows.map(r => String(r.year));
      } catch { /* use existing options */ }
    }

    if (options.length === 0) {
      // Can't determine options → ask generic clarification
      const template = CLARIFICATION_TEMPLATES[flag.slot];
      if (template) {
        return {
          action: 'clarify',
          slot: flag.slot,
          question: (template[lang] || template.tr)(['(please specify)']),
          options: [],
          language: lang,
        };
      }
      continue;
    }

    // TODO: Phase A2 v2 — Speculative disambiguation
    // For now, just ask the clarification question
    // Future: run query for each option, compare results, skip if same winner

    const template = CLARIFICATION_TEMPLATES[flag.slot];
    if (template) {
      return {
        action: 'clarify',
        slot: flag.slot,
        question: (template[lang] || template.tr)(options),
        options,
        language: lang,
      };
    }
  }

  // If we get here, no template for the critical slot → execute anyway
  return { action: 'execute' };
}

module.exports = { evaluateAmbiguity };
```

---

## A3. Answerability Registry

### File: NEW — packages/db/migrations/008_answerability.sql

```sql
CREATE TABLE IF NOT EXISTS metric_registry (
  metric_key TEXT PRIMARY KEY,
  available BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  reason TEXT,
  freshness_ts TIMESTAMP,
  unit TEXT,
  synonyms_tr TEXT[],
  synonyms_en TEXT[],
  synonyms_fr TEXT[]
);

-- Seed data
INSERT INTO metric_registry VALUES
  ('expo_progress', true, 'edition_contracts + expo_metrics', null, null, 'm² / %', ARRAY['ilerleme','durum','nasil gidiyor'], ARRAY['progress','status','how is'], ARRAY['progrès','état']),
  ('revenue', true, 'edition_contracts.revenue_eur / fiscal_contracts.revenue_eur', null, null, '€', ARRAY['gelir','ciro','kazanc'], ARRAY['revenue','income','earnings'], ARRAY['revenu','chiffre']),
  ('contracts', true, 'edition_contracts / fiscal_contracts', null, null, 'count', ARRAY['sozlesme','kontrat','anlasma'], ARRAY['contracts','deals','agreements'], ARRAY['contrats','accords']),
  ('m2', true, 'edition_contracts.m2', null, null, 'm²', ARRAY['metrekare','alan','m2'], ARRAY['square meters','area','m2'], ARRAY['mètres carrés','surface']),
  ('payment_status', false, null, 'Balance/received/remaining payment fields not synced from Zoho (Balance1, Received_Payment, Remaining_Payment). Only contract revenue (Grand_Total) available.', null, '€', ARRAY['odeme','kalan odeme','bakiye','borc'], ARRAY['payment','balance','remaining','owed'], ARRAY['paiement','solde','restant']),
  ('risk', true, 'expo_metrics.risk_level + risk_score', null, null, 'score', ARRAY['risk','tehlike','tehdit'], ARRAY['risk','danger','threat'], ARRAY['risque','danger']),
  ('velocity', true, 'expo_metrics.velocity + velocity_ratio', null, null, 'm²/month', ARRAY['hiz','satis hizi','tempo'], ARRAY['velocity','speed','pace'], ARRAY['vitesse','rythme']),
  ('currency_conversion', false, null, 'ELIZA does not have live exchange rate data. All values in EUR.', null, null, ARRAY['kur','doviz','tl','lira','dolar'], ARRAY['exchange','rate','currency','convert'], ARRAY['taux','devise','convertir']),
  ('salary', false, null, 'Salary and personal financial data is not in ELIZA scope.', null, null, ARRAY['maas','ucret'], ARRAY['salary','wage','compensation'], ARRAY['salaire','rémunération']),
  ('general_knowledge', false, null, 'ELIZA only has Elan Expo business data. For general knowledge, use a search engine.', null, null, ARRAY['nufus','baskent','hava durumu'], ARRAY['population','capital','weather'], ARRAY['population','capitale','météo'])
ON CONFLICT (metric_key) DO NOTHING;
```

### Run on production DB
This migration must be run on Render PostgreSQL.

---

# PHASE B: CLARIFICATION STATE MACHINE

## B1. State Table

### File: NEW — packages/db/migrations/009_clarification_state.sql

```sql
CREATE TABLE IF NOT EXISTS clarification_state (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(30) NOT NULL UNIQUE,
  original_question TEXT NOT NULL,
  semantic_frame JSONB,
  resolved_slots JSONB DEFAULT '{}',
  pending_slot VARCHAR(50),
  pending_options JSONB,
  status VARCHAR(20) DEFAULT 'waiting',
  language VARCHAR(5) DEFAULT 'tr',
  intent VARCHAR(50),
  scope_hash VARCHAR(64),
  state_version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 minutes'
);

CREATE INDEX IF NOT EXISTS idx_cs_phone ON clarification_state(user_phone);
CREATE INDEX IF NOT EXISTS idx_cs_expires ON clarification_state(expires_at);
```

## B2. Clarification Manager

### File: NEW — packages/ai/clarificationManager.js

```javascript
/**
 * Clarification State Manager
 *
 * Handles pending clarification states:
 * - Check if user has pending state
 * - Resolve user's reply into slot value
 * - Update state (fill slot, ask next, or complete)
 * - Expire old states
 */

const { query } = require('../db/index.js');

/**
 * Check if user has a pending clarification.
 * Returns state object or null.
 */
async function getPendingState(userPhone) {
  if (!userPhone) return null;

  try {
    // Expire old states first
    await query(`DELETE FROM clarification_state WHERE expires_at < NOW()`);

    const result = await query(
      `SELECT * FROM clarification_state WHERE user_phone = $1 AND status = 'waiting' LIMIT 1`,
      [userPhone]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('getPendingState error:', err.message);
    return null;
  }
}

/**
 * Save a new clarification state.
 */
async function saveState(userPhone, data) {
  try {
    await query(
      `INSERT INTO clarification_state
        (user_phone, original_question, semantic_frame, resolved_slots, pending_slot, pending_options, status, language, intent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_phone) DO UPDATE SET
        original_question = $2, semantic_frame = $3, resolved_slots = $4,
        pending_slot = $5, pending_options = $6, status = $7, language = $8, intent = $9,
        state_version = clarification_state.state_version + 1,
        expires_at = NOW() + INTERVAL '30 minutes'`,
      [
        userPhone,
        data.original_question,
        JSON.stringify(data.semantic_frame || {}),
        JSON.stringify(data.resolved_slots || {}),
        data.pending_slot,
        JSON.stringify(data.pending_options || []),
        data.status || 'waiting',
        data.language || 'tr',
        data.intent || null,
      ]
    );
  } catch (err) {
    console.error('saveState error:', err.message);
  }
}

/**
 * Resolve user's reply to a pending clarification.
 * Handles: "1", "2", "3" (numbered), "2026" (direct value), "gelir" (fuzzy match)
 *
 * Returns: { resolved: true, value: 'matched_value' } or { resolved: false }
 */
function resolveReply(reply, pendingOptions) {
  const trimmed = reply.trim();
  const options = pendingOptions || [];

  // 1. Numbered reply: "1", "2", "3"
  const num = parseInt(trimmed);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return { resolved: true, value: options[num - 1] };
  }

  // 2. Exact match (case-insensitive)
  const lower = trimmed.toLowerCase();
  const exactMatch = options.find(o => o.toLowerCase() === lower);
  if (exactMatch) return { resolved: true, value: exactMatch };

  // 3. Partial/fuzzy match
  const partialMatch = options.find(o => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase()));
  if (partialMatch) return { resolved: true, value: partialMatch };

  // 4. Year detection (if reply is a 4-digit year)
  if (/^\d{4}$/.test(trimmed)) {
    const yearMatch = options.find(o => o.includes(trimmed));
    if (yearMatch) return { resolved: true, value: yearMatch };
    // If the options contain years, match directly
    if (options.includes(trimmed)) return { resolved: true, value: trimmed };
  }

  // 5. Metric keyword mapping
  const metricMap = {
    'm2': 'm²', 'metrekare': 'm²', 'alan': 'm²', 'area': 'm²', 'square': 'm²',
    'gelir': 'revenue (€)', 'revenue': 'revenue (€)', 'para': 'revenue (€)', 'euro': 'revenue (€)', 'ciro': 'revenue (€)',
    'kontrat': 'contracts', 'sozlesme': 'contracts', 'contract': 'contracts', 'deal': 'contracts',
  };
  const mapped = metricMap[lower];
  if (mapped) {
    const metricMatch = options.find(o => o.toLowerCase().includes(mapped.toLowerCase()));
    if (metricMatch) return { resolved: true, value: metricMatch };
  }

  return { resolved: false };
}

/**
 * Clear/complete a user's clarification state.
 */
async function clearState(userPhone) {
  try {
    await query(`DELETE FROM clarification_state WHERE user_phone = $1`, [userPhone]);
  } catch (err) {
    console.error('clearState error:', err.message);
  }
}

module.exports = { getPendingState, saveState, resolveReply, clearState };
```

## B3. Handler Integration

### File: apps/whatsapp-bot/src/handler.js

Add to handleMessage(), BEFORE the rewrite/queryEngine call:

```javascript
const { getPendingState, saveState, resolveReply, clearState } = require('../../../packages/ai/clarificationManager.js');
const { evaluateAmbiguity } = require('../../../packages/ai/ambiguityGate.js');

async function handleMessage(text, user) {
  const trimmed = text.trim();
  const lang = detectLang(trimmed);
  const userPhone = user?.phone || user?.whatsapp_phone || null;

  // === STEP 0: Check for pending clarification state ===
  const pendingState = await getPendingState(userPhone);
  if (pendingState && !trimmed.startsWith('.')) {
    const { resolved, value } = resolveReply(trimmed, pendingState.pending_options);

    if (resolved) {
      // Fill the slot
      const resolvedSlots = { ...pendingState.resolved_slots, [pendingState.pending_slot]: value };
      // Rebuild question with resolved slots
      let rebuiltQuestion = pendingState.original_question;
      // Simple approach: append resolved info
      // E.g., original: "SIEMA'ya en çok kim satmış?"
      // resolved: {expo_year: "2026", metric: "revenue (€)"}
      // rebuilt: "SIEMA 2026 en çok gelir getiren agent kim?"
      // For now, re-run with resolved entities injected
      await clearState(userPhone);

      // Re-run query with resolved slots applied to entities
      // This bypasses the ambiguity gate since slots are now filled
      // ... (integrate with queryEngine, passing resolved slots as entities override)
    } else {
      // User reply didn't match any option
      const retryMsg = {
        tr: 'Anlayamadım. Lütfen bir numara seç veya seçeneklerden birini yaz.',
        en: "I didn't understand. Please pick a number or type one of the options.",
        fr: "Je n'ai pas compris. Veuillez choisir un numéro ou taper une des options.",
      };
      return retryMsg[lang] || retryMsg.tr;
    }
  }

  // === STEP 1: Commands (.brief, .help etc.) — skip all AI ===
  if (trimmed.startsWith('.')) {
    // ... existing command handling ...
  }

  // === STEP 2: Self-reference replace ===
  // ... existing "ben" → agent name ...

  // === STEP 3: Conversation memory + rewrite ===
  // ... existing getHistory + rewriteQuestion ...

  // === STEP 4: Semantic frame extraction ===
  const frameResult = await extractSemanticFrame(questionForEngine);

  // === STEP 5: Ambiguity gate ===
  const decision = await evaluateAmbiguity(frameResult, user);

  if (decision.action === 'refuse') {
    // Unanswerable — honest failure
    const response = decision.message;
    logMessage({ ...logParams, response_text: response, intent: 'unanswerable' });
    return wrapWithPersonality(response, user, lang, false, lastMessageTime);
  }

  if (decision.action === 'clarify') {
    // Save state and ask clarification
    await saveState(userPhone, {
      original_question: trimmed,
      semantic_frame: frameResult.frame,
      resolved_slots: {},
      pending_slot: decision.slot,
      pending_options: decision.options,
      language: lang,
      intent: frameResult.intent,
    });
    logMessage({ ...logParams, response_text: decision.question, intent: 'clarification', clarification_asked: true });
    return wrapWithPersonality(decision.question, user, lang, false, lastMessageTime);
  }

  if (decision.action === 'partial') {
    // Answer but with caveat about incomplete data
    // Proceed to normal query but append caveat to answer
  }

  // === STEP 6: Normal query execution ===
  // Use frameResult.intent and frameResult.entities
  // ... existing queryEngine.run() ...
}
```

---

# PHASE C: DATABASE-LEVEL SECURITY

## C1. Immediate Fix (Day 0 — in Phase 0a above)

## C2. PostgreSQL Row-Level Security

### File: NEW — packages/db/migrations/010_row_level_security.sql

```sql
-- Enable RLS on data tables
ALTER TABLE edition_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Policy: CEO sees all, others filtered by sales_group
CREATE POLICY scope_edition ON edition_contracts
  USING (
    current_setting('app.user_scope', true) = 'all'
    OR current_setting('app.user_scope', true) IS NULL
    OR sales_agent IN (
      SELECT sales_agent_name FROM users
      WHERE sales_group = current_setting('app.user_group', true)
      AND is_active = true
    )
  );

CREATE POLICY scope_fiscal ON fiscal_contracts
  USING (
    current_setting('app.user_scope', true) = 'all'
    OR current_setting('app.user_scope', true) IS NULL
    OR sales_agent IN (
      SELECT sales_agent_name FROM users
      WHERE sales_group = current_setting('app.user_group', true)
      AND is_active = true
    )
  );

CREATE POLICY scope_contracts ON contracts
  USING (
    current_setting('app.user_scope', true) = 'all'
    OR current_setting('app.user_scope', true) IS NULL
    OR sales_agent IN (
      SELECT sales_agent_name FROM users
      WHERE sales_group = current_setting('app.user_group', true)
      AND is_active = true
    )
  );

-- IMPORTANT: Force RLS even for table owner
ALTER TABLE edition_contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE fiscal_contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
```

### Backend Integration: packages/db/index.js

Add scoped query function:

```javascript
async function scopedQuery(text, params, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Set session variables for RLS
    const scope = user?.permissions?.data_scope || 'all';
    const group = user?.sales_group || '';
    const years = user?.permissions?.visible_years ? `{${user.permissions.visible_years.join(',')}}` : '{}';
    await client.query(`SELECT set_config('app.user_scope', $1, true)`, [scope]);
    await client.query(`SELECT set_config('app.user_group', $1, true)`, [group]);
    await client.query(`SELECT set_config('app.user_years', $1, true)`, [years]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, pool, scopedQuery };
```

---

# PHASE D: QUERY PLAN COMPILER (DSL-based)

## D1. DSL Schema

### File: NEW — packages/ai/dsl.js

```javascript
/**
 * ELIZA Query DSL
 *
 * LLM generates this JSON structure, deterministic compiler converts to SQL.
 * No raw SQL from LLM ever reaches the database.
 */

const VALID_OPERATIONS = ['aggregate', 'rank_top', 'compare', 'trend', 'list', 'detail', 'exception', 'explain'];
const VALID_METRICS = ['m2', 'revenue_eur', 'contracts', 'progress_percent', 'risk_score', 'velocity', 'velocity_ratio'];
const VALID_ENTITIES = ['sales_agent', 'expo', 'company', 'country', 'office'];
const VALID_SOURCES = ['edition_contracts', 'fiscal_contracts', 'expos', 'expo_metrics'];

/**
 * Validate a DSL object.
 * Returns { valid: true } or { valid: false, error: 'reason' }
 */
function validateDSL(dsl) {
  if (!dsl || typeof dsl !== 'object') return { valid: false, error: 'DSL must be a JSON object' };
  if (!VALID_OPERATIONS.includes(dsl.operation)) return { valid: false, error: `Invalid operation: ${dsl.operation}` };
  if (dsl.metric && !VALID_METRICS.includes(dsl.metric)) return { valid: false, error: `Invalid metric: ${dsl.metric}` };
  if (dsl.entity && !VALID_ENTITIES.includes(dsl.entity)) return { valid: false, error: `Invalid entity: ${dsl.entity}` };
  if (dsl.data_source && !VALID_SOURCES.includes(dsl.data_source)) return { valid: false, error: `Invalid data_source: ${dsl.data_source}` };
  return { valid: true };
}

/**
 * Compile DSL to parameterized SQL.
 * Returns { sql: string, params: array }
 */
function compileDSL(dsl) {
  const validation = validateDSL(dsl);
  if (!validation.valid) throw new Error(validation.error);

  const source = dsl.data_source || 'edition_contracts';
  const filters = dsl.filters || {};
  const excludeInternal = dsl.exclude_internal !== false; // default true
  const limit = Math.min(dsl.limit || 50, 200);

  let params = [];
  let whereConditions = [];

  // Build WHERE from filters
  if (filters.expo_name) {
    params.push(`%${filters.expo_name}%`);
    whereConditions.push(`e.name ILIKE $${params.length}`);
  }
  if (filters.expo_year) {
    params.push(filters.expo_year);
    whereConditions.push(`EXTRACT(YEAR FROM e.start_date) = $${params.length}`);
  }
  if (filters.agent_name) {
    params.push(`%${filters.agent_name}%`);
    whereConditions.push(`c.sales_agent ILIKE $${params.length}`);
  }
  if (filters.country) {
    params.push(`%${filters.country}%`);
    whereConditions.push(`c.country ILIKE $${params.length}`);
  }
  if (excludeInternal) {
    whereConditions.push(`c.sales_agent != 'ELAN EXPO'`);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  // Metric to SQL column
  const metricCol = {
    m2: 'c.m2',
    revenue_eur: 'c.revenue_eur',
    contracts: 'c.id',
  };

  // Generate SQL based on operation
  switch (dsl.operation) {
    case 'aggregate': {
      const metric = metricCol[dsl.metric] || 'c.revenue_eur';
      const agg = dsl.metric === 'contracts' ? 'COUNT' : 'SUM';
      return {
        sql: `SELECT ${agg}(${metric}) AS value FROM ${source} c JOIN expos e ON c.expo_id = e.id ${whereClause}`,
        params,
      };
    }

    case 'rank_top': {
      const metric = metricCol[dsl.metric] || 'c.revenue_eur';
      const agg = dsl.metric === 'contracts' ? 'COUNT(c.id)' : `COALESCE(SUM(${metric}), 0)`;
      const groupCol = dsl.entity === 'sales_agent' ? 'c.sales_agent'
        : dsl.entity === 'country' ? 'c.country'
        : dsl.entity === 'expo' ? 'e.name'
        : 'c.sales_agent';
      return {
        sql: `SELECT ${groupCol} AS name, ${agg} AS value, COUNT(c.id) AS contracts
              FROM ${source} c JOIN expos e ON c.expo_id = e.id
              ${whereClause}
              GROUP BY ${groupCol}
              ORDER BY value DESC
              LIMIT ${limit}`,
        params,
      };
    }

    case 'list': {
      const selectCol = dsl.entity === 'expo' ? 'e.name, e.country, e.start_date'
        : dsl.entity === 'company' ? 'DISTINCT c.company_name, c.country, c.sales_agent'
        : dsl.entity === 'sales_agent' ? 'DISTINCT c.sales_agent'
        : 'e.name, e.country';
      return {
        sql: `SELECT ${selectCol}
              FROM ${source} c JOIN expos e ON c.expo_id = e.id
              ${whereClause}
              LIMIT ${limit}`,
        params,
      };
    }

    case 'detail': {
      return {
        sql: `SELECT e.name, e.country, e.start_date, e.target_m2,
                COALESCE(SUM(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN c.m2 ELSE 0 END), 0) AS sold_m2,
                COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 2), 0) AS revenue_eur,
                COUNT(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN c.id END) AS contracts,
                CASE WHEN e.target_m2 > 0 THEN ROUND((COALESCE(SUM(CASE WHEN c.sales_agent != 'ELAN EXPO' THEN c.m2 ELSE 0 END), 0) / e.target_m2 * 100)::numeric, 1) ELSE NULL END AS progress_pct
              FROM expos e
              LEFT JOIN ${source} c ON c.expo_id = e.id
              ${whereClause}
              GROUP BY e.id
              ORDER BY e.start_date DESC
              LIMIT ${limit}`,
        params,
      };
    }

    case 'trend': {
      const metric = metricCol[dsl.metric] || 'c.revenue_eur';
      const agg = dsl.metric === 'contracts' ? 'COUNT(c.id)' : `COALESCE(SUM(${metric}), 0)`;
      return {
        sql: `SELECT EXTRACT(MONTH FROM c.contract_date)::int AS month,
                EXTRACT(YEAR FROM c.contract_date)::int AS year,
                ${agg} AS value
              FROM ${source} c JOIN expos e ON c.expo_id = e.id
              ${whereClause}
              GROUP BY year, month
              ORDER BY year DESC, month DESC
              LIMIT ${limit}`,
        params,
      };
    }

    case 'compare': {
      // Compare is handled as multiple aggregate/detail queries by the caller
      // Return a generic detail query
      return compileDSL({ ...dsl, operation: 'detail' });
    }

    case 'exception': {
      return {
        sql: `SELECT e.name, em.risk_level, em.risk_score, em.velocity_ratio,
                em.progress_percent, em.sold_m2, em.target_m2
              FROM expo_metrics em
              JOIN expos e ON em.expo_id = e.id
              WHERE em.risk_level IN ('HIGH', 'WATCH')
              ORDER BY em.risk_score DESC
              LIMIT ${limit}`,
        params: [],
      };
    }

    default:
      throw new Error(`Unsupported operation: ${dsl.operation}`);
  }
}

module.exports = { validateDSL, compileDSL, VALID_OPERATIONS, VALID_METRICS, VALID_ENTITIES };
```

---

# PHASE E: DETERMINISTIC ANSWER RENDERER

## E1. Structured Result Renderer

### File: NEW — packages/ai/answerRenderer.js

```javascript
/**
 * Deterministic answer renderer.
 * For structured results (aggregate, rank, list), render without LLM.
 * For insight-heavy results (exception, explain, compare), use Sonnet.
 */

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

function fmtEur(n) {
  if (n == null) return '—';
  return '€' + fmtNum(n);
}

/**
 * Try to render answer deterministically.
 * Returns { rendered: true, text: string } or { rendered: false }
 */
function tryRender(operation, data, frame, lang) {
  if (!data || data.length === 0) {
    const noData = {
      tr: 'Bu sorgu için veri bulunamadı.',
      en: 'No data found for this query.',
      fr: 'Aucune donnée trouvée pour cette requête.',
    };
    return { rendered: true, text: noData[lang] || noData.tr };
  }

  switch (operation) {
    case 'aggregate': {
      const row = data[0];
      const value = row.value;
      const metric = frame?.metric || 'revenue_eur';
      const formatted = metric.includes('revenue') || metric.includes('eur') ? fmtEur(value) : fmtNum(value);
      const unit = metric === 'm2' ? ' m²' : metric === 'contracts' ? '' : '';
      const label = frame?.expo_name || frame?.agent_name || '';
      return {
        rendered: true,
        text: `${label ? label + ': ' : ''}Toplam ${formatted}${unit}`,
      };
    }

    case 'rank_top': {
      const lines = data.slice(0, 5).map((row, i) => {
        const name = row.name || '—';
        const value = row.value;
        const metric = frame?.metric || 'revenue_eur';
        const formatted = metric.includes('revenue') || metric.includes('eur') ? fmtEur(value) : fmtNum(value);
        const unit = metric === 'm2' ? ' m²' : '';
        const contracts = row.contracts ? `, ${fmtNum(row.contracts)} kontrat` : '';
        return `${i + 1}. ${name} — ${formatted}${unit}${contracts}`;
      });
      const total = data.length > 5 ? `\n(toplam ${data.length} kayıt)` : '';
      return { rendered: true, text: lines.join('\n') + total };
    }

    case 'list': {
      const lines = data.slice(0, 5).map(row => {
        const parts = Object.values(row).filter(v => v != null).map(String);
        return parts.join(' — ');
      });
      const total = data.length > 5 ? `\n(toplam ${data.length} kayıt)` : '';
      return { rendered: true, text: lines.join('\n') + total };
    }

    default:
      // For detail, exception, explain, compare → use Sonnet
      return { rendered: false };
  }
}

module.exports = { tryRender };
```

---

# SUMMARY: ALL NEW/MODIFIED FILES

## New Files
| File | Purpose |
|------|---------|
| packages/ai/ambiguityGate.js | Material ambiguity decision engine |
| packages/ai/clarificationManager.js | Pending state CRUD + reply resolution |
| packages/ai/dsl.js | Query DSL schema + deterministic SQL compiler |
| packages/ai/answerRenderer.js | Deterministic answer rendering (no LLM) |
| packages/db/migrations/008_answerability.sql | metric_registry table |
| packages/db/migrations/009_clarification_state.sql | clarification_state table |
| packages/db/migrations/010_row_level_security.sql | RLS policies |
| docs/EVAL_METRICS.md | Success metrics definition |

## Modified Files
| File | Changes |
|------|---------|
| packages/ai/queryEngine.js | extractSemanticFrame(), hybrid SQL scope fix, DSL integration |
| packages/ai/router.js | 7 new intent rules |
| packages/db/index.js | scopedQuery() function |
| apps/whatsapp-bot/src/handler.js | Clarification flow, ambiguity gate, renderer integration |
| message_logs table | 4 new columns (rewritten_question, generated_sql, scope_applied, clarification_asked) |

## Migration Order (Production DB)
1. ALTER TABLE message_logs (new columns)
2. 008_answerability.sql (metric_registry)
3. 009_clarification_state.sql (clarification_state)
4. 010_row_level_security.sql (RLS — do LAST, test carefully)

---

# TEST SCENARIOS

## Ambiguity Detection Tests
| Input | Expected Behavior |
|-------|-------------------|
| "SIEMA 2026 kaç m²?" | Direct answer (all slots filled) |
| "SIEMA'ya en çok kim satmış?" | Clarify: which year? which metric? |
| "toplam ne kadar?" | Clarify: total of what? (revenue/m²/contracts) |
| "Türkiye'nin nüfusu kaç?" | Refuse: "ELIZA'da bu veri yok" |
| "kalan ödemeler?" | Partial: "Ödeme bakiyesi sync edilmemiş, sadece kontrat geliri var" |
| "1 euro kaç TL?" | Refuse: "Döviz kuru verisi yok" |

## Clarification Flow Tests
| Step | Input | Expected |
|------|-------|----------|
| 1 | "SIEMA'ya en çok kim satmış?" | "Hangi edisyon?\n1. 2026\n2. 2025\n3. 2024" |
| 2 | "1" | "Neye göre?\n1. m²\n2. Gelir (€)\n3. Sözleşme" |
| 3 | "gelir" | "SIEMA 2026 en çok gelir: Elif AY — €122.076" |

## Scope Tests
| User | Query | Expected |
|------|-------|----------|
| CEO (all) | "top agents" | All agents listed |
| Elif (team) | "top agents" | Only International group agents |
| Elif (team) | "SIEMA kaç m²?" | Full expo data (no agent filter on expo queries) |

## Deterministic Renderer Tests
| Query Type | Expected Rendering | LLM Used? |
|------------|-------------------|-----------|
| "SIEMA 2026 kaç m²?" (detail) | Sonnet insight | YES |
| "toplam gelir 2026" (aggregate) | "Toplam: €425.358" | NO |
| "top agents" (rank_top) | "1. Elif — €122.076\n2. ..." | NO |
| "fuar listesi" (list) | "SIEMA — Morocco — 22 Sep 2026\n..." | NO |
| "Madesign neden riskli?" (explain) | Sonnet analysis | YES |

---

# BÖLÜM 2: IMMEDIATE EXECUTION PLAN ✅ COMPLETED

Claude Code analizi + 4 AI konsültasyonu sonucu belirlenen minimal plan.
Kural: Mevcut sistemi bozmadan, minimum risk, maximum etki.

## Prensip

"Assume transparently, clarify selectively, fail honestly."

- Güçlü default varsa → varsayımı AÇIKÇA söyleyerek cevap ver
- Varsayım sonucu değiştirebiliyorsa → sor (ileride, şimdi değil)
- Veri yoksa → dürüstçe "yok" de

## Şimdi Yapılacaklar ✅ ALL COMPLETED

| # | Ne | Nasıl | Status |
|---|-----|-------|--------|
| 1 | Hybrid SQL scope fix | CEO-only kısıtlama — ISSUE-019 | ✅ DONE |
| 2 | 3 yeni router rule | expo_progress, agent_performance, expo_agent_breakdown (router: 12→15 rules) | ✅ DONE |
| 3 | "Bilmiyorum" özelliği | METRIC_AVAILABILITY code object + keyword check (payment_balance, currency, salary, general_knowledge) | ✅ DONE |
| 4 | Varsayımı açıkla | Sonnet prompt rules 13-14: "mention your assumption" | ✅ DONE |
| 5 | Log zenginleştirme | rewritten_question kolonu (migration 008) | ✅ DONE |

Benchmark: 96% PASS (48/50)

## Sonraki Adımlar ✅ COMPLETED

| # | Ne | Status |
|---|-----|--------|
| 1 | Selective clarification | ✅ DONE — Mini Clarification System (missing_year, missing_expo flags, pending state) |
| 2 | Mini pending state | ✅ DONE — users.pending_clarification JSONB, 10min expire, migration 009 |
| 3 | Year filter default | ✅ DONE — ISSUE-020, expo/agent queries default to current year |

Remaining (not yet started):
- Frame Lite (extractIntent'e missing_slots + answerability ekle)
- Morning brief (08:00 cron)
- Eval harness (gerçek loglardan altın set)

## İleride (kullanıcı 5+ olunca)
- Full clarification state machine (Phase B)
- PostgreSQL RLS (Phase C)
- DSL query compiler (Phase D)
- Deterministic renderer (Phase E)
- Proactive alerts (Phase F)
