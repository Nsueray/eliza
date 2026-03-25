const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const { route, normalize, resolveCountry } = require('./router.js');

const client = new Anthropic();
const INTENT_MODEL = process.env.AI_INTENT_MODEL || 'claude-haiku-4-5-20251001';
const ANSWER_MODEL = process.env.AI_ANSWER_MODEL || 'claude-sonnet-4-6';

const ALLOWED_TABLES = ['expos', 'contracts', 'edition_contracts', 'fiscal_contracts', 'expo_metrics', 'outstanding_balances'];
const FORBIDDEN_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'EXEC'];

// ELAN EXPO business rule: internal operations agent
// Include in revenue totals. Exclude from: m² totals, contract counts,
// exhibitor counts, agent performance rankings, company lists.
const INTERNAL_AGENT = 'ELAN EXPO';
const EXCL_AGENT = `AND c.sales_agent != '${INTERNAL_AGENT}'`;
const EXCL_AGENT_FC = `AND sales_agent != '${INTERNAL_AGENT}'`;

/**
 * Build year filter SQL clause from entities.
 * Handles: multi-year array (IN), single year (=), or no year (NULL passthrough).
 *
 * @param {object} entities - { year, years }
 * @param {string} dateCol - SQL date column (e.g. 'c.contract_date')
 * @param {number} idx - starting $N index for parameters
 * @returns {{ clause: string, params: array, nextIndex: number }}
 */
function buildYearFilter(entities, dateCol, idx) {
  if (entities.years && entities.years.length > 1) {
    const placeholders = entities.years.map((_, i) => `$${idx + i}`);
    return {
      clause: `AND EXTRACT(YEAR FROM ${dateCol}) IN (${placeholders.join(', ')})`,
      params: [...entities.years],
      nextIndex: idx + entities.years.length,
    };
  }
  const yr = entities.year || null;
  return {
    clause: `AND ($${idx}::int IS NULL OR EXTRACT(YEAR FROM ${dateCol}) = $${idx})`,
    params: [yr],
    nextIndex: idx + 1,
  };
}

/**
 * Build a fuzzy ILIKE pattern for expo names.
 * "Megaclima" → "%m%e%g%a%c%l%i%m%a%" won't work well.
 * Instead: try splitting known brand patterns and adding % between words.
 * e.g., "Megaclima" → "%mega%clima%" (matches "Mega Clima" in DB)
 * Also handles "Mega Clima" → "%Mega Clima%" (direct match).
 */
function fuzzyExpoPattern(expoName) {
  if (!expoName) return '%%';
  // Known compound expo name patterns (space-insensitive matching)
  const COMPOUND_PATTERNS = {
    'megaclima': 'mega%clima',
    'foodexpo': 'food%expo',
    'buildexpo': 'build%expo',
    'plastexpo': 'plast%expo',
    'electexpo': 'elect%expo',
  };
  const lower = expoName.toLowerCase().replace(/\s+/g, '');
  if (COMPOUND_PATTERNS[lower]) {
    return `%${COMPOUND_PATTERNS[lower]}%`;
  }
  // Default: standard ILIKE with original name
  return `%${expoName}%`;
}

// Unavailability registry — topics ELIZA cannot answer
const METRIC_AVAILABILITY = {
  // payment_balance removed — balance_eur, paid_eur, contract_payments now synced from Zoho
  currency: {
    keywords: ['kur', 'doviz', 'euro kac', 'dolar', 'tl', 'lira', 'exchange rate', 'currency convert', 'taux de change'],
    reason: {
      tr: 'ELIZA\'da döviz kuru verisi bulunmuyor. Tüm tutarlar EUR cinsindendir.',
      en: 'ELIZA does not have exchange rate data. All amounts are in EUR.',
      fr: 'ELIZA ne dispose pas de données de taux de change. Tous les montants sont en EUR.',
    },
  },
  salary: {
    keywords: ['maas', 'ucret', 'salary', 'wage', 'compensation', 'salaire', 'remuneration'],
    reason: {
      tr: 'Maaş ve kişisel finans verileri ELIZA kapsamında değil.',
      en: 'Salary and personal financial data is not in ELIZA scope.',
      fr: 'Les données salariales et financières personnelles ne sont pas dans le périmètre d\'ELIZA.',
    },
  },
  general_knowledge: {
    keywords: ['nufus', 'population', 'baskent', 'capital', 'hava durumu', 'weather', 'meteo', 'history of', 'kim kazandi', 'who won'],
    reason: {
      tr: 'ELIZA sadece Elan Expo iş verilerini içerir: fuarlar, satışlar, agentlar ve finans. Genel bilgi soruları kapsam dışıdır.',
      en: 'ELIZA only contains Elan Expo business data: expos, sales, agents, and financials. General knowledge questions are out of scope.',
      fr: 'ELIZA ne contient que les données commerciales d\'Elan Expo : expos, ventes, agents et finances. Les questions de culture générale sont hors périmètre.',
    },
  },
};

/**
 * Check if a question is about an unavailable metric.
 * Uses word-boundary matching to avoid false positives (e.g., "currently" matching "tl").
 * Returns { unavailable: true, message: string } or { unavailable: false }
 */
function checkUnavailability(question, lang) {
  const norm = normalize(question);
  const words = norm.split(/\s+/);
  for (const [, entry] of Object.entries(METRIC_AVAILABILITY)) {
    for (const kw of entry.keywords) {
      // Multi-word keywords: check substring match
      if (kw.includes(' ')) {
        if (norm.includes(kw)) {
          return { unavailable: true, message: entry.reason[lang] || entry.reason.tr };
        }
      } else {
        // Single-word keywords: word boundary match
        if (words.includes(kw)) {
          return { unavailable: true, message: entry.reason[lang] || entry.reason.tr };
        }
      }
    }
  }
  return { unavailable: false };
}

const INTENT_PROMPT = `You are an intent extractor for ELIZA, a business intelligence system for Elan Expo (the company that organizes exhibitions).

IMPORTANT: "Elan Expo" is the COMPANY NAME, not an expo/exhibition. Never use "Elan Expo" as expo_name.
Expo names are specific event brands like: SIEMA, Mega Clima, Foodexpo, Buildexpo, Plastexpo, etc.

Database schema:
- expos: id, name, country, start_date, end_date, edition_year, target_m2
- edition_contracts: af_number, company_name, country, sales_agent, m2, revenue_eur, status, expo_id, contract_date (Valid + Transferred In)
- fiscal_contracts: same fields (Valid + Transferred Out)
- contracts: all contracts including cancelled

Extract intent and entities from the question. Return ONLY valid JSON:
{
  "intent": "one of [expo_progress, target_progress, agent_performance, agent_country_breakdown, agent_expo_breakdown, expo_agent_breakdown, expo_company_list, monthly_trend, cluster_performance, payment_status, rebooking_rate, price_per_m2, country_count, exhibitors_by_country, top_agents, revenue_summary, expo_list, company_search, company_collection, collection_summary, collection_expo, collection_no_payment, days_to_event, general_stats]",
  "entities": {
    "expo_name": "string or null",
    "agent_name": "string or null",
    "country": "string or null",
    "cluster_name": "string or null",
    "year": "number or null",
    "month": "number or null",
    "metric": "string or null"
  }
}

Examples:
Q: how many countries in SIEMA 2026 → {"intent":"country_count","entities":{"expo_name":"SIEMA","year":2026}}
Q: how much did Elif sell in February 2026 → {"intent":"agent_performance","entities":{"agent_name":"Elif","year":2026,"month":2}}
Q: which expos are at risk → {"intent":"expo_list","entities":{"metric":"risk"}}
Q: top agents this month → {"intent":"top_agents","entities":{"month":"current"}}
Q: Turkish exhibitors in Kenya expo → {"intent":"exhibitors_by_country","entities":{"expo_name":"Kenya","country":"Turkey"}}
Q: total revenue this year → {"intent":"revenue_summary","entities":{"year":"current"}}
Q: find company Bosch → {"intent":"company_search","entities":{"expo_name":null,"agent_name":null,"country":null}}
Q: pygar firmasının borcu ne kadar → {"intent":"company_collection","entities":{"company_name":"pygar"}}
Q: ace group balance → {"intent":"company_collection","entities":{"company_name":"ace group"}}
Q: SIEMA tahsilat durumu → {"intent":"collection_expo","entities":{"expo_name":"SIEMA"}}
Q: kaç alacağımız var → {"intent":"collection_summary","entities":{}}
Q: which country did Elif get most from in 2025 → {"intent":"agent_country_breakdown","entities":{"agent_name":"Elif","year":2025}}
Q: which expos did Emircan sell to → {"intent":"agent_expo_breakdown","entities":{"agent_name":"Emircan"}}
Q: elif 2025 senesinde en cok hangi ulkeden exhibitor bulmus → {"intent":"agent_country_breakdown","entities":{"agent_name":"Elif","year":2025}}
Q: emircan hangi fuarlara satis yapmis → {"intent":"agent_expo_breakdown","entities":{"agent_name":"Emircan"}}
Q: SIEMA 2026 hangi agentlar sattı → {"intent":"expo_agent_breakdown","entities":{"expo_name":"SIEMA","year":2026}}
Q: SIEMA 2026 firmalar listesi → {"intent":"expo_company_list","entities":{"expo_name":"SIEMA","year":2026}}
Q: bu yıl ay ay satışlar → {"intent":"monthly_trend","entities":{"year":"current"}}
Q: Casablanca cluster toplamı → {"intent":"cluster_performance","entities":{"cluster_name":"Casablanca"}}
Q: ödemesi geciken firmalar → {"intent":"payment_status","entities":{}}
Q: SIEMA ya tekrar katilan firmalar → {"intent":"rebooking_rate","entities":{"expo_name":"SIEMA"}}
Q: SIEMA 2026 ortalama m2 fiyatı → {"intent":"price_per_m2","entities":{"expo_name":"SIEMA","year":2026}}
Q: satış fiyatı ortalaması nedir → {"intent":"price_per_m2","entities":{}}
Q: hangi agent en yüksek m² fiyatı satıyor → {"intent":"price_per_m2","entities":{}}
Q: m² fiyat ortalaması en yüksek agent kim → {"intent":"price_per_m2","entities":{}}
Q: en pahalı stand hangi fuarda → {"intent":"price_per_m2","entities":{}}
Q: hangi expo en ucuz m² fiyatına sahip → {"intent":"price_per_m2","entities":{}}
Q: which agent sells at highest price per m² → {"intent":"price_per_m2","entities":{}}
Q: elif bu yıl ay ay ne kadar sattı → {"intent":"monthly_trend","entities":{"agent_name":"Elif","year":"current"}}
Q: Elan Expo 2026 fuarları → {"intent":"expo_list","entities":{"year":2026}}
Q: Elan Expo exhibitions 2026 → {"intent":"expo_list","entities":{"year":2026}}
Q: SIEMA'ya kaç gün kaldı → {"intent":"days_to_event","entities":{"expo_name":"SIEMA"}}
Q: how many days until Mega Clima → {"intent":"days_to_event","entities":{"expo_name":"Mega Clima"}}
Q: combien de jours avant SIEMA → {"intent":"days_to_event","entities":{"expo_name":"SIEMA"}}
Q: en yakın fuar ne zaman → {"intent":"days_to_event","entities":{}}
Q: next expo date → {"intent":"days_to_event","entities":{}}
Q: SIEMA 2026 hedefi nedir → {"intent":"target_progress","entities":{"expo_name":"SIEMA","year":2026}}
Q: hedef durumu → {"intent":"target_progress","entities":{}}
Q: Mega Clima hedefi ne kadar → {"intent":"target_progress","entities":{"expo_name":"Mega Clima"}}
Q: 2026 target progress → {"intent":"target_progress","entities":{"year":2026}}
Q: objectifs de vente → {"intent":"target_progress","entities":{}}

IMPORTANT COUNT RULE: When the question asks "how many" / "kaç tane" / "combien" and expects a NUMBER answer (not a list), set metric to "count" in entities.
Examples:
Q: kaç tane expo var → {"intent":"expo_list","entities":{"metric":"count"}}
Q: how many contracts in SIEMA → {"intent":"expo_progress","entities":{"expo_name":"SIEMA","metric":"count"}}
Q: combien d'agents → {"intent":"general_stats","entities":{"metric":"count"}}
Q: SIEMA'da kaç ülke var → {"intent":"country_count","entities":{"expo_name":"SIEMA","metric":"count"}}

COMPOUND vs SINGLE INTENT: If multiple METRICS (m², revenue, contracts) are asked about the SAME entity, use a single intent (expo_progress or agent_performance), NOT compound. These queries already return all metrics.
Only use "compound" when the question has DIFFERENT entities or DIFFERENT intent types:
Q: elif ulke breakdown ve emircan expo breakdown → {"intent":"compound","entities":{"questions":["elif ulke breakdown","emircan expo breakdown"]}}
Q: madesign 2026 kaç sözleşme, kaç m2, geliri ne kadar? → {"intent":"expo_progress","entities":{"expo_name":"Madesign","year":2026}}
Q: SIEMA 2026 toplam gelir ve kontrat sayısı? → {"intent":"expo_progress","entities":{"expo_name":"SIEMA","year":2026}}
Limit compound to max 2 sub-questions.

AMBIGUITY DETECTION RULES:
- If expo name is mentioned but NO year specified, add "missing_year": true to entities
- If question asks for ranking (en çok, en iyi, top, best) or comparison but NO metric specified (m², revenue, contracts), add "missing_metric": true to entities
- If question asks about an expo but expo name is not clear or could match multiple expos, add "missing_expo": true to entities
Examples:
Q: SIEMA'ya en çok kim satmış → {"intent":"expo_agent_breakdown","entities":{"expo_name":"SIEMA","missing_year":true,"missing_metric":true}}
Q: toplam ne kadar → {"intent":"revenue_summary","entities":{"missing_metric":true}}
Q: fuardaki katılımcı ülke sayısı → {"intent":"country_count","entities":{"missing_expo":true}}`;

// STEP 1 — Intent Extraction (Haiku — fast, cheap)
async function extractIntent(question) {
  // Try keyword router first (0 API calls)
  const routed = route(question);
  if (routed) {
    routed._usage = { input_tokens: 0, output_tokens: 0, model: 'router' };
    return routed;
  }

  // Fallback to LLM
  const response = await client.messages.create({
    model: INTENT_MODEL,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `${INTENT_PROMPT}\n\nQuestion: ${question}`,
    }],
  });

  const intentUsage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    model: INTENT_MODEL,
  };

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { intent: 'general_stats', entities: {}, _usage: intentUsage };
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { intent: 'general_stats', entities: {}, _usage: intentUsage };
  }

  // Resolve "current" month/year
  const now = new Date();
  if (parsed.entities) {
    if (parsed.entities.month === 'current') parsed.entities.month = now.getMonth() + 1;
    if (parsed.entities.year === 'current') parsed.entities.year = now.getFullYear();
  }

  // Normalize null/None/unknown intents to general_stats
  const validIntents = [
    'expo_progress', 'target_progress', 'agent_performance', 'agent_country_breakdown', 'agent_expo_breakdown',
    'expo_agent_breakdown', 'expo_company_list', 'monthly_trend', 'cluster_performance',
    'payment_status', 'rebooking_rate', 'price_per_m2', 'country_count',
    'exhibitors_by_country', 'top_agents', 'revenue_summary', 'expo_list',
    'company_search', 'days_to_event', 'general_stats', 'compound',
    'collection_summary', 'collection_no_payment', 'collection_expo', 'company_collection',
  ];
  if (!parsed.intent || !validIntents.includes(parsed.intent)) {
    parsed.intent = 'general_stats';
  }

  parsed._usage = intentUsage;
  return parsed;
}

// Semantic Frame Prompt — replaces INTENT_PROMPT for Haiku fallback
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
- "Elan Expo" is the COMPANY NAME, not an expo/exhibition. Never use "Elan Expo" as expo_name.

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
- If expo name given but year not specified AND the question is about historical data (not current status) → flag expo_year as critical
- If expo name given but year not specified AND the question is about current status (risk, progress, velocity, upcoming) → set expo_year to current year (do NOT flag as critical)
- If ranking/comparison asked but metric not specified → flag metric as critical
- If time period could mean different things → flag time_scope as warning
- If question is about data that ELIZA doesn't have → set answerability to "unavailable" with reason
- Questions about "what needs attention", "important topics", "priorities" → these are answerable as general_stats (ELIZA has risk and performance data)

INTENT MAPPING — use these exact intent names in maps_to_intent:
expo_progress, agent_performance, agent_country_breakdown, agent_expo_breakdown,
expo_agent_breakdown, expo_company_list, monthly_trend, cluster_performance,
payment_status, rebooking_rate, price_per_m2, country_count,
exhibitors_by_country, top_agents, revenue_summary, expo_list,
company_search, company_collection, collection_summary, collection_expo,
collection_no_payment, days_to_event, general_stats, compound

IMPORTANT COUNT RULE: When the question asks "how many" / "kaç tane" / "combien" and expects a NUMBER answer (not a list), set metric to "count".

COMPOUND vs SINGLE INTENT RULE:
- If the question asks for multiple METRICS (m², revenue, contracts) about the SAME entity (expo or agent), this is NOT compound. It is a single intent (expo_progress or agent_performance) because these queries already return all metrics.
- Only set maps_to_intent to "compound" when the question asks about DIFFERENT entities or DIFFERENT intent types (e.g., "elif ülke breakdown ve emircan expo breakdown").
- Example: "SIEMA 2026 kaç sözleşme, kaç m2, geliri ne kadar?" → expo_progress (NOT compound)
- Example: "elif kaç satmış ve emircan kaç satmış?" → compound (different agents)

Output ONLY valid JSON, nothing else:
{
  "language": "tr|en|fr",
  "task": "aggregate|rank_top|compare|trend|list|detail|exception|explain",
  "subject": "sales_agent|expo|company|country|office|general",
  "expo_name": "string or null",
  "expo_year": "number or null",
  "agent_name": "string or null",
  "country": "string or null",
  "metric": "m2|revenue|contracts|progress|risk|velocity|count|null",
  "time_scope": {"type": "year|month|week|day|range|relative_days|null", "value": "..."},
  "group_by": "string or null",
  "ambiguity_flags": [
    {"slot": "field_name", "severity": "critical|warning", "options": ["opt1","opt2"], "options_from_db": false}
  ],
  "answerability": "answerable|unavailable|partial",
  "unavailable_reason": "string or null",
  "confidence": 0-100,
  "maps_to_intent": "one of the intent names above or null"
}

FEW-SHOT EXAMPLES:

Q: "SIEMA'ya en çok kim satmış?"
{"language":"tr","task":"rank_top","subject":"sales_agent","expo_name":"SIEMA","expo_year":null,"agent_name":null,"country":null,"metric":null,"time_scope":null,"group_by":null,"ambiguity_flags":[{"slot":"expo_year","severity":"critical","options":["2026","2025","2024"],"options_from_db":true},{"slot":"metric","severity":"critical","options":["m²","revenue (€)","contracts"],"options_from_db":false}],"answerability":"answerable","unavailable_reason":null,"confidence":35,"maps_to_intent":"expo_agent_breakdown"}

Q: "SIEMA 2026 kaç m²?"
{"language":"tr","task":"detail","subject":"expo","expo_name":"SIEMA","expo_year":2026,"agent_name":null,"country":null,"metric":"m2","time_scope":{"type":"year","value":2026},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":98,"maps_to_intent":"expo_progress"}

Q: "elif bu ay kaç m2 satmış?"
{"language":"tr","task":"aggregate","subject":"sales_agent","expo_name":null,"expo_year":null,"agent_name":"Elif","country":null,"metric":"m2","time_scope":{"type":"month","value":"current"},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":95,"maps_to_intent":"agent_performance"}

Q: "kalan ödemeler ne kadar?"
{"language":"tr","task":"aggregate","subject":"general","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":"payment_balance","time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"partial","unavailable_reason":"Actual payment balance (Balance1) is not synced from Zoho. Only contract revenue (Grand_Total) is available.","confidence":80,"maps_to_intent":"payment_status"}

Q: "Türkiye'nin nüfusu kaç?"
{"language":"tr","task":null,"subject":null,"expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":null,"time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"unavailable","unavailable_reason":"This question is outside ELIZA's scope. ELIZA only has Elan Expo business data.","confidence":99,"maps_to_intent":null}

Q: "en çok gelir getiren 3 ülke hangileri?"
{"language":"tr","task":"rank_top","subject":"country","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":"revenue","time_scope":null,"group_by":"country","ambiguity_flags":[{"slot":"expo_year","severity":"warning","options":["2026","all_time"],"options_from_db":false}],"answerability":"answerable","unavailable_reason":null,"confidence":75,"maps_to_intent":"general_stats"}

Q: "1 euro kaç TL?"
{"language":"tr","task":null,"subject":null,"expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":null,"time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"unavailable","unavailable_reason":"ELIZA does not have live exchange rate data.","confidence":99,"maps_to_intent":null}

Q: "top agents this month"
{"language":"en","task":"rank_top","subject":"sales_agent","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":null,"time_scope":{"type":"month","value":"current"},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":85,"maps_to_intent":"top_agents"}

Q: "SIEMA risk durumu nedir?"
{"language":"tr","task":"detail","subject":"expo","expo_name":"SIEMA","expo_year":2026,"agent_name":null,"country":null,"metric":"risk","time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":90,"maps_to_intent":"expo_progress"}

Q: "Madesign hedefe ulaşacak mı?"
{"language":"tr","task":"detail","subject":"expo","expo_name":"Madesign","expo_year":2026,"agent_name":null,"country":null,"metric":"progress","time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":90,"maps_to_intent":"expo_progress"}

Q: "Bugün benim için en önemli 3 konu ne?"
{"language":"tr","task":"exception","subject":"general","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":"risk","time_scope":{"type":"day","value":"today"},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":75,"maps_to_intent":"general_stats"}

Q: "Hedefine en yakın expo hangisi?"
{"language":"tr","task":"rank_top","subject":"expo","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":"progress","time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":85,"maps_to_intent":"expo_list"}

Q: "Hedefinden en uzak expo hangisi?"
{"language":"tr","task":"rank_top","subject":"expo","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":"progress","time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":85,"maps_to_intent":"expo_list"}

Q: "Which expos are currently at risk?"
{"language":"en","task":"exception","subject":"expo","expo_name":null,"expo_year":null,"agent_name":null,"country":null,"metric":"risk","time_scope":null,"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":90,"maps_to_intent":"expo_list"}

Q: "madesign 2026 fuarına toplam kaç sözleşme, kaç m2 var ve geliri ne kadar?"
{"language":"tr","task":"detail","subject":"expo","expo_name":"Madesign","expo_year":2026,"agent_name":null,"country":null,"metric":null,"time_scope":{"type":"year","value":2026},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":95,"maps_to_intent":"expo_progress"}

Q: "SIEMA 2026 toplam gelir, m2 ve kontrat sayısı?"
{"language":"tr","task":"detail","subject":"expo","expo_name":"SIEMA","expo_year":2026,"agent_name":null,"country":null,"metric":null,"time_scope":{"type":"year","value":2026},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":95,"maps_to_intent":"expo_progress"}

Q: "Mega Clima 2026 how many contracts, m2, and revenue?"
{"language":"en","task":"detail","subject":"expo","expo_name":"Mega Clima","expo_year":2026,"agent_name":null,"country":null,"metric":null,"time_scope":{"type":"year","value":2026},"group_by":null,"ambiguity_flags":[],"answerability":"answerable","unavailable_reason":null,"confidence":95,"maps_to_intent":"expo_progress"}`;

// Valid intents for backward compatibility
const VALID_INTENTS = [
  'expo_progress', 'target_progress', 'agent_performance', 'agent_country_breakdown', 'agent_expo_breakdown',
  'expo_agent_breakdown', 'expo_company_list', 'monthly_trend', 'cluster_performance',
  'payment_status', 'rebooking_rate', 'price_per_m2', 'country_count',
  'exhibitors_by_country', 'top_agents', 'revenue_summary', 'expo_list',
  'company_search', 'days_to_event', 'general_stats', 'compound',
  'collection_summary', 'collection_no_payment', 'collection_expo', 'company_collection',
];

/**
 * Semantic Frame Extraction — replaces extractIntent() as the primary extraction method.
 * Router fast path stays unchanged (0 API cost).
 * Falls back to Haiku with FRAME_PROMPT for structured extraction.
 */
async function extractSemanticFrame(question) {
  // Try keyword router first (0 API cost)
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

  // LLM semantic frame extraction (Haiku — fast, cheap)
  const response = await client.messages.create({
    model: INTENT_MODEL,
    max_tokens: 600,
    system: FRAME_PROMPT,
    messages: [{ role: 'user', content: `Question: ${question}` }],
  });

  const usage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    model: INTENT_MODEL,
  };

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      frame: null, intent: 'general_stats', entities: {},
      confidence: 0, ambiguity_flags: [], answerability: 'answerable',
      source: 'haiku_parse_fail', _usage: usage,
    };
  }

  let frame;
  try {
    frame = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      frame: null, intent: 'general_stats', entities: {},
      confidence: 0, ambiguity_flags: [], answerability: 'answerable',
      source: 'haiku_json_fail', _usage: usage,
    };
  }

  // Map frame to existing intent + entities for backward compatibility
  let intent = frame.maps_to_intent || 'general_stats';
  if (!VALID_INTENTS.includes(intent)) intent = 'general_stats';

  const entities = {};
  if (frame.expo_name) entities.expo_name = frame.expo_name;
  if (frame.agent_name) entities.agent_name = frame.agent_name;
  if (frame.country) {
    // Normalize country name: "İtalya" → "Italy", "Fransa" → "France"
    const normalizedCountry = resolveCountry(normalize(frame.country));
    entities.country = normalizedCountry || frame.country;
  }

  // Year extraction from frame
  if (frame.expo_year) {
    entities.year = frame.expo_year;
  } else if (frame.time_scope?.type === 'year') {
    entities.year = frame.time_scope.value === 'current' ? new Date().getFullYear() : frame.time_scope.value;
  }

  // Month extraction
  if (frame.time_scope?.type === 'month') {
    entities.month = frame.time_scope.value === 'current' ? new Date().getMonth() + 1 : frame.time_scope.value;
  }

  // Week/day time scope → period
  if (frame.time_scope?.type === 'week') {
    entities.period = frame.time_scope.value === 'current' ? 'this_week' : 'last_week';
  }
  if (frame.time_scope?.type === 'day') {
    if (frame.time_scope.value === 'today') entities.period = 'today';
    else if (frame.time_scope.value === 'yesterday') entities.period = 'yesterday';
  }

  // Relative days
  if (frame.time_scope?.type === 'relative_days') {
    entities.relative_days = parseInt(frame.time_scope.value) || null;
  }

  // Metric
  if (frame.metric) entities.metric = frame.metric;

  // Resolve "current" values
  if (entities.year === 'current') entities.year = new Date().getFullYear();
  if (entities.month === 'current') entities.month = new Date().getMonth() + 1;

  // Compound sub-questions
  if (intent === 'compound' && frame.sub_questions) {
    entities.questions = frame.sub_questions;
  }

  // Map ambiguity_flags to legacy missing_* flags for existing clarification logic
  const flags = frame.ambiguity_flags || [];
  for (const flag of flags) {
    if (flag.slot === 'expo_year' && flag.severity === 'critical') entities.missing_year = true;
    if (flag.slot === 'metric' && flag.severity === 'critical') entities.missing_metric = true;
    if (flag.slot === 'expo_name' && flag.severity === 'critical') entities.missing_expo = true;
  }

  return {
    frame,
    intent,
    entities,
    confidence: frame.confidence || 0,
    ambiguity_flags: flags,
    answerability: frame.answerability || 'answerable',
    unavailable_reason: frame.unavailable_reason || null,
    source: 'haiku_frame',
    _usage: usage,
  };
}

// STEP 2 — Query Builder
function buildQuery(intent, entities) {
  const e = entities || {};

  switch (intent) {
    case 'target_progress': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        const yf = buildYearFilter(e, 'e.start_date', 2);
        return {
          sql: `SELECT e.name AS expo_name, e.start_date, e.city, e.country,
            COALESCE(et.target_m2, 0) AS target_m2,
            COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END), 0) AS actual_m2,
            COALESCE(et.target_revenue, 0) AS target_revenue,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS actual_revenue,
            COUNT(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.id END) AS contracts,
            GREATEST(e.start_date::date - CURRENT_DATE, 0) AS days_left,
            et.source AS target_source,
            CASE WHEN COALESCE(et.target_m2, 0) > 0
              THEN ROUND((COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END), 0) / et.target_m2 * 100)::numeric, 1)
              ELSE NULL END AS m2_progress,
            CASE WHEN COALESCE(et.target_revenue, 0) > 0
              THEN ROUND((COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) / et.target_revenue * 100)::numeric, 1)
              ELSE NULL END AS revenue_progress
          FROM expos e
          LEFT JOIN expo_targets et ON et.expo_id = e.id
          LEFT JOIN edition_contracts c ON c.expo_id = e.id
          WHERE e.name ILIKE $1
            ${yf.clause}
          GROUP BY e.id, e.name, e.start_date, e.city, e.country, et.target_m2, et.target_revenue, et.source
          ORDER BY e.start_date DESC LIMIT 5`,
          params: [fuzzyExpoPattern(e.expo_name), ...yf.params],
        };
      }
      // General target overview — default to current year if no year specified
      if (!e.year && !(e.years && e.years.length > 1)) e.year = new Date().getFullYear();
      const yf = buildYearFilter(e, 'e.start_date', 1);
      return {
        sql: `SELECT e.name AS expo_name, e.start_date, e.city,
          COALESCE(et.target_m2, 0) AS target_m2,
          COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END), 0) AS actual_m2,
          COALESCE(et.target_revenue, 0) AS target_revenue,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS actual_revenue,
          COUNT(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.id END) AS contracts,
          CASE WHEN COALESCE(et.target_m2, 0) > 0
            THEN ROUND((COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END), 0) / et.target_m2 * 100)::numeric, 1)
            ELSE NULL END AS m2_progress
        FROM expos e
        LEFT JOIN expo_targets et ON et.expo_id = e.id
        LEFT JOIN edition_contracts c ON c.expo_id = e.id
        WHERE COALESCE(et.target_m2, 0) > 0
          ${yf.clause}
        GROUP BY e.id, e.name, e.start_date, e.city, et.target_m2, et.target_revenue
        ORDER BY e.start_date ASC LIMIT 20`,
        params: [...yf.params],
      };
    }

    case 'expo_progress': {
      const yf = buildYearFilter(e, 'e.start_date', 2);
      return {
        sql: `SELECT e.name, e.start_date, e.target_m2,
          COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END),0) AS sold_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur,
          COUNT(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.id END) AS contracts,
          CASE WHEN e.target_m2 > 0 THEN ROUND((COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END),0)/e.target_m2*100)::numeric,1) ELSE NULL END AS progress_pct
        FROM expos e
        LEFT JOIN edition_contracts c ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          ${yf.clause}
        GROUP BY e.id ORDER BY e.start_date DESC LIMIT 5`,
        params: [fuzzyExpoPattern(e.expo_name || ''), ...yf.params],
      };
    }

    case 'agent_performance': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        const yf = buildYearFilter(e, 'c.contract_date', 3);
        const mp = yf.nextIndex;
        return {
          sql: `SELECT c.sales_agent, COUNT(*) AS contracts,
            COALESCE(SUM(c.m2),0) AS total_m2,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
          FROM fiscal_contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.sales_agent ILIKE $1
            ${EXCL_AGENT}
            AND e.name ILIKE $2
            ${yf.clause}
            AND ($${mp}::int IS NULL OR EXTRACT(MONTH FROM c.contract_date) = $${mp})
          GROUP BY c.sales_agent`,
          params: [`%${e.agent_name || ''}%`, fuzzyExpoPattern(e.expo_name), ...yf.params, e.month || null],
        };
      }
      const yf = buildYearFilter(e, 'contract_date', 2);
      const mp = yf.nextIndex;
      return {
        sql: `SELECT sales_agent, COUNT(*) AS contracts,
          COALESCE(SUM(m2),0) AS total_m2,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts
        WHERE sales_agent ILIKE $1
          ${EXCL_AGENT_FC}
          ${yf.clause}
          AND ($${mp}::int IS NULL OR EXTRACT(MONTH FROM contract_date) = $${mp})
        GROUP BY sales_agent`,
        params: [`%${e.agent_name || ''}%`, ...yf.params, e.month || null],
      };
    }

    case 'agent_country_breakdown': {
      const yf = buildYearFilter(e, 'c.contract_date', 2);
      return {
        sql: `SELECT c.country, COUNT(*) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2
        FROM fiscal_contracts c
        WHERE c.sales_agent ILIKE $1
          ${yf.clause}
          AND c.country IS NOT NULL
        GROUP BY c.country
        ORDER BY contracts DESC
        LIMIT 20`,
        params: [`%${e.agent_name || ''}%`, ...yf.params],
      };
    }

    case 'agent_expo_breakdown': {
      const yf = buildYearFilter(e, 'c.contract_date', 2);
      return {
        sql: `SELECT e.name AS expo, e.start_date,
          COUNT(c.id) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.sales_agent ILIKE $1
          ${yf.clause}
        GROUP BY e.id
        ORDER BY revenue_eur DESC
        LIMIT 20`,
        params: [`%${e.agent_name || ''}%`, ...yf.params],
      };
    }

    case 'country_count': {
      const yf = buildYearFilter(e, 'e.start_date', 2);
      return {
        sql: `SELECT c.country, COUNT(*) AS exhibitors
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          ${yf.clause}
          AND c.country IS NOT NULL
          ${EXCL_AGENT}
        GROUP BY c.country ORDER BY exhibitors DESC LIMIT 50`,
        params: [fuzzyExpoPattern(e.expo_name || ''), ...yf.params],
      };
    }

    case 'exhibitors_by_country': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        return {
          sql: `SELECT e.name AS expo, c.company_name, c.country, c.m2
          FROM edition_contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.country ILIKE $1
            AND e.name ILIKE $2
            AND e.start_date >= CURRENT_DATE
            ${EXCL_AGENT}
          ORDER BY c.m2 DESC LIMIT 50`,
          params: [`%${e.country || ''}%`, fuzzyExpoPattern(e.expo_name)],
        };
      }
      return {
        sql: `SELECT e.name AS expo, COUNT(*) AS exhibitors
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.country ILIKE $1
          AND e.start_date >= CURRENT_DATE
          ${EXCL_AGENT}
        GROUP BY e.name ORDER BY exhibitors DESC LIMIT 20`,
        params: [`%${e.country || ''}%`],
      };
    }

    case 'top_agents': {
      // Support this_week / last_week period
      if (e.period === 'this_week' || e.period === 'last_week') {
        const dateFilter = e.period === 'this_week'
          ? `contract_date >= DATE_TRUNC('week', CURRENT_DATE) AND contract_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'`
          : `contract_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days' AND contract_date < DATE_TRUNC('week', CURRENT_DATE)`;
        return {
          sql: `SELECT sales_agent, COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM fiscal_contracts
          WHERE ${dateFilter}
            AND sales_agent IS NOT NULL
            ${EXCL_AGENT_FC}
          GROUP BY sales_agent ORDER BY revenue_eur DESC LIMIT 10`,
          params: [],
        };
      }
      // Support relative_days: "son 30 günde agent" → last 30 days filter
      if (e.relative_days) {
        return {
          sql: `SELECT sales_agent, COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM fiscal_contracts
          WHERE contract_date >= CURRENT_DATE - ($1 || ' days')::interval
            AND sales_agent IS NOT NULL
            ${EXCL_AGENT_FC}
          GROUP BY sales_agent ORDER BY revenue_eur DESC LIMIT 10`,
          params: [e.relative_days],
        };
      }
      const yf = buildYearFilter(e, 'contract_date', 1);
      const mp = yf.nextIndex;
      return {
        sql: `SELECT sales_agent, COUNT(*) AS contracts,
          COALESCE(SUM(m2),0) AS total_m2,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts
        WHERE sales_agent IS NOT NULL
          ${EXCL_AGENT_FC}
          ${yf.clause}
          AND ($${mp}::int IS NULL OR EXTRACT(MONTH FROM contract_date) = $${mp})
        GROUP BY sales_agent ORDER BY revenue_eur DESC LIMIT 10`,
        params: [...yf.params, e.month || null],
      };
    }

    case 'revenue_summary': {
      // "bugün" / "today" → today only
      if (e.period === 'today') {
        return {
          sql: `SELECT
            COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM edition_contracts
          WHERE DATE(contract_date) = CURRENT_DATE`,
          params: [],
        };
      }
      // "dün" / "yesterday"
      if (e.period === 'yesterday') {
        return {
          sql: `SELECT
            COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM edition_contracts
          WHERE DATE(contract_date) = CURRENT_DATE - 1`,
          params: [],
        };
      }
      // "bu hafta" / "this week"
      if (e.period === 'this_week') {
        return {
          sql: `SELECT
            COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM edition_contracts
          WHERE contract_date >= DATE_TRUNC('week', CURRENT_DATE)
            AND contract_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'`,
          params: [],
        };
      }
      // "geçen hafta" / "last week"
      if (e.period === 'last_week') {
        return {
          sql: `SELECT
            COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM edition_contracts
          WHERE contract_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
            AND contract_date < DATE_TRUNC('week', CURRENT_DATE)`,
          params: [],
        };
      }
      // "son 2 yıl" → relative years
      if (e.relative_years) {
        return {
          sql: `SELECT
            EXTRACT(YEAR FROM contract_date)::integer AS year,
            COUNT(*) AS contracts,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM edition_contracts
          WHERE contract_date IS NOT NULL
            AND contract_date >= CURRENT_DATE - ($1 || ' years')::interval
          GROUP BY year ORDER BY year`,
          params: [e.relative_years],
        };
      }
      const yf = buildYearFilter(e, 'contract_date', 1);
      return {
        sql: `SELECT
          EXTRACT(YEAR FROM contract_date)::integer AS year,
          COUNT(*) AS contracts,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM edition_contracts
        WHERE contract_date IS NOT NULL
          ${yf.clause}
        GROUP BY year ORDER BY year`,
        params: [...yf.params],
      };
    }

    case 'expo_list':
      if (e.metric === 'risk') {
        return {
          sql: `SELECT expo_name, start_date, months_to_event,
            sold_m2, target_m2, progress_percent,
            velocity_m2_per_month AS velocity, required_velocity,
            velocity_ratio, risk_score, risk_level
          FROM expo_metrics
          ORDER BY risk_score DESC, months_to_event ASC LIMIT 20`,
          params: [],
        };
      }
      if (e.year) {
        return {
          sql: `SELECT e.name, e.country, e.start_date,
            COUNT(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.id END) AS contracts,
            COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END),0) AS sold_m2,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
          FROM expos e
          LEFT JOIN edition_contracts c ON c.expo_id = e.id
          WHERE EXTRACT(YEAR FROM e.start_date) = $1
          GROUP BY e.id ORDER BY e.start_date ASC`,
          params: [e.year],
        };
      }
      return {
        sql: `SELECT e.name, e.country, e.start_date,
          COUNT(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.id END) AS contracts,
          COALESCE(SUM(CASE WHEN c.sales_agent != '${INTERNAL_AGENT}' THEN c.m2 ELSE 0 END),0) AS sold_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM expos e
        LEFT JOIN edition_contracts c ON c.expo_id = e.id
        WHERE e.start_date >= CURRENT_DATE AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'
        GROUP BY e.id ORDER BY e.start_date ASC`,
        params: [],
      };

    case 'expo_agent_breakdown': {
      const yf = buildYearFilter(e, 'e.start_date', 2);
      return {
        sql: `SELECT c.sales_agent, COUNT(*) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          ${yf.clause}
          AND c.sales_agent IS NOT NULL
          ${EXCL_AGENT}
        GROUP BY c.sales_agent ORDER BY revenue_eur DESC LIMIT 20`,
        params: [fuzzyExpoPattern(e.expo_name || ''), ...yf.params],
      };
    }

    case 'expo_company_list': {
      const yf = buildYearFilter(e, 'e.start_date', 2);
      return {
        sql: `SELECT c.company_name, c.country,
          COUNT(*) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          ${yf.clause}
          ${EXCL_AGENT}
        GROUP BY c.company_name, c.country
        ORDER BY revenue_eur DESC LIMIT 100`,
        params: [fuzzyExpoPattern(e.expo_name || ''), ...yf.params],
      };
    }

    case 'monthly_trend': {
      const hasAgent = e.agent_name && e.agent_name.length > 0;
      if (hasAgent) {
        const yf = buildYearFilter(e, 'contract_date', 1);
        return {
          sql: `SELECT EXTRACT(MONTH FROM contract_date)::int AS month,
            TO_CHAR(contract_date, 'Month') AS month_name,
            COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM fiscal_contracts
          WHERE sales_agent ILIKE $${yf.nextIndex}
            ${yf.clause}
          GROUP BY month, month_name ORDER BY month`,
          params: [...yf.params, `%${e.agent_name}%`],
        };
      }
      const yf = buildYearFilter(e, 'contract_date', 1);
      return {
        sql: `SELECT EXTRACT(MONTH FROM contract_date)::int AS month,
          TO_CHAR(contract_date, 'Month') AS month_name,
          COUNT(*) AS contracts,
          COALESCE(SUM(m2),0) AS total_m2,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts
        WHERE 1=1
          ${yf.clause}
        GROUP BY month, month_name ORDER BY month`,
        params: [...yf.params],
      };
    }

    case 'cluster_performance': {
      const hasYear = e.year && e.year > 0;
      if (hasYear) {
        return {
          sql: `SELECT e.name, e.start_date,
            COUNT(c.id) AS contracts,
            COALESCE(SUM(c.m2),0) AS total_m2,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
          FROM expos e
          LEFT JOIN edition_contracts c ON c.expo_id = e.id
          WHERE e.country ILIKE $1
            AND e.edition_year = $2
          GROUP BY e.id ORDER BY e.start_date LIMIT 20`,
          params: [`%${e.cluster_name || ''}%`, e.year],
        };
      }
      return {
        sql: `SELECT e.name, e.start_date,
          COUNT(c.id) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM expos e
        LEFT JOIN edition_contracts c ON c.expo_id = e.id
        WHERE e.country ILIKE $1
          AND e.start_date >= CURRENT_DATE
        GROUP BY e.id ORDER BY e.start_date LIMIT 20`,
        params: [`%${e.cluster_name || ''}%`],
      };
    }

    case 'collection_summary': {
      return {
        sql: `SELECT
          COUNT(*) AS open_contracts,
          ROUND(SUM(balance_eur)::numeric, 2) AS total_outstanding_eur,
          ROUND(SUM(paid_eur)::numeric, 2) AS total_paid_eur,
          ROUND(AVG(paid_percent)::numeric, 1) AS avg_paid_percent,
          COUNT(CASE WHEN collection_stage = 'no_payment' THEN 1 END) AS no_payment_count,
          COUNT(CASE WHEN collection_stage = 'partial_paid' THEN 1 END) AS partial_paid_count,
          COUNT(CASE WHEN collection_stage = 'pre_event_balance_open' THEN 1 END) AS pre_event_count
        FROM outstanding_balances
        WHERE expo_start_date >= CURRENT_DATE`,
        params: [],
      };
    }

    case 'collection_no_payment': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        return {
          sql: `WITH matched AS (
            SELECT company_name, expo_name, contract_total_eur AS total_eur,
              sales_agent, contract_date, days_to_expo,
              collection_risk_score + event_risk_score AS risk_score
            FROM outstanding_balances
            WHERE collection_stage = 'no_payment' AND expo_name ILIKE $1
          )
          SELECT 'TOTAL: ' || COUNT(*) || ' no-payment contracts' AS company_name,
            '' AS expo_name, ROUND(SUM(total_eur)::numeric, 2) AS total_eur,
            '' AS sales_agent, NULL AS contract_date, NULL AS days_to_expo, 0 AS risk_score
          FROM matched
          UNION ALL
          (SELECT * FROM matched ORDER BY total_eur DESC LIMIT 10)`,
          params: [fuzzyExpoPattern(e.expo_name)],
        };
      }
      return {
        sql: `WITH matched AS (
          SELECT company_name, expo_name, contract_total_eur AS total_eur,
            sales_agent, contract_date, days_to_expo,
            collection_risk_score + event_risk_score AS risk_score
          FROM outstanding_balances
          WHERE collection_stage = 'no_payment' AND expo_start_date >= CURRENT_DATE
        )
        SELECT 'TOTAL: ' || COUNT(*) || ' no-payment contracts' AS company_name,
          '' AS expo_name, ROUND(SUM(total_eur)::numeric, 2) AS total_eur,
          '' AS sales_agent, NULL AS contract_date, NULL AS days_to_expo, 0 AS risk_score
        FROM matched
        UNION ALL
        (SELECT * FROM matched ORDER BY total_eur DESC LIMIT 10)`,
        params: [],
      };
    }

    case 'collection_expo': {
      const expoName = e.expo_name && e.expo_name.length > 0 ? e.expo_name : null;
      if (expoName) {
        // CTE: summary row first (always visible to Sonnet), then top 10 detail rows
        return {
          sql: `WITH matched AS (
            SELECT company_name, collection_stage,
              contract_total_eur AS total_eur, paid_eur, balance_eur,
              paid_percent, sales_agent,
              collection_risk_score + event_risk_score AS risk_score
            FROM outstanding_balances
            WHERE expo_name ILIKE $1
          )
          SELECT 'TOTAL: ' || COUNT(*) || ' contracts' AS company_name,
            COUNT(CASE WHEN COALESCE(paid_eur, 0) = 0 THEN 1 END) || ' no payment' AS collection_stage,
            ROUND(SUM(total_eur)::numeric, 2) AS total_eur,
            ROUND(SUM(paid_eur)::numeric, 2) AS paid_eur,
            ROUND(SUM(balance_eur)::numeric, 2) AS balance_eur,
            ROUND(AVG(paid_percent)::numeric, 1) AS paid_percent,
            '' AS sales_agent, 0 AS risk_score
          FROM matched
          UNION ALL
          (SELECT * FROM matched ORDER BY balance_eur DESC LIMIT 10)`,
          params: [fuzzyExpoPattern(expoName)],
        };
      }
      // No expo specified — show per-expo summary (upcoming expos only)
      return {
        sql: `SELECT expo_name,
          COUNT(*) AS contracts,
          ROUND(SUM(balance_eur)::numeric, 2) AS total_outstanding_eur,
          ROUND(SUM(paid_eur)::numeric, 2) AS total_paid_eur,
          ROUND(AVG(paid_percent)::numeric, 1) AS avg_paid_percent,
          COUNT(CASE WHEN collection_stage = 'no_payment' THEN 1 END) AS no_payment_count
        FROM outstanding_balances
        WHERE expo_start_date >= CURRENT_DATE
        GROUP BY expo_name
        ORDER BY total_outstanding_eur DESC LIMIT 30`,
        params: [],
      };
    }

    // TODO: Add balance field from Zoho Balance1 formula field
    case 'payment_status': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        const yf = buildYearFilter(e, 'e.start_date', 2);
        return {
          sql: `SELECT c.company_name, e.name AS expo,
            ROUND(c.revenue_eur::numeric,2) AS total,
            c.sales_agent, c.contract_date
          FROM edition_contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.revenue_eur > 0
            AND e.name ILIKE $1
            ${yf.clause}
          ORDER BY c.revenue_eur DESC LIMIT 50`,
          params: [fuzzyExpoPattern(e.expo_name), ...yf.params],
        };
      }
      const yf = buildYearFilter(e, 'e.start_date', 1);
      return {
        sql: `SELECT c.company_name, e.name AS expo,
          ROUND(c.revenue_eur::numeric,2) AS total,
          c.sales_agent, c.contract_date
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.revenue_eur > 0
          AND e.start_date >= CURRENT_DATE
          ${yf.clause}
        ORDER BY c.revenue_eur DESC LIMIT 50`,
        params: [...yf.params],
      };
    }

    case 'rebooking_rate': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      const hasCountry = e.country && e.country.length > 0;
      if (hasExpo) {
        return {
          sql: `SELECT c.company_name, COUNT(DISTINCT e.edition_year) AS editions,
            MIN(e.start_date) AS first_expo,
            MAX(e.start_date) AS last_expo,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS total_revenue
          FROM contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.status IN ('Valid', 'Transferred In')
            AND e.name ILIKE $1
          GROUP BY c.company_name
          HAVING COUNT(DISTINCT e.edition_year) > 1
          ORDER BY editions DESC, total_revenue DESC LIMIT 30`,
          params: [fuzzyExpoPattern(e.expo_name)],
        };
      }
      if (hasCountry) {
        return {
          sql: `SELECT c.company_name, COUNT(DISTINCT e.id) AS editions,
            MIN(e.start_date) AS first_expo,
            MAX(e.start_date) AS last_expo,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS total_revenue
          FROM contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.status IN ('Valid', 'Transferred In')
            AND e.country ILIKE $1
          GROUP BY c.company_name
          HAVING COUNT(DISTINCT e.id) > 1
          ORDER BY editions DESC, total_revenue DESC LIMIT 30`,
          params: [`%${e.country}%`],
        };
      }
      return {
        sql: `SELECT c.company_name, COUNT(DISTINCT e.id) AS editions,
          MIN(e.start_date) AS first_expo,
          MAX(e.start_date) AS last_expo,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS total_revenue
        FROM contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.status IN ('Valid', 'Transferred In')
        GROUP BY c.company_name
        HAVING COUNT(DISTINCT e.id) > 1
        ORDER BY editions DESC, total_revenue DESC LIMIT 30`,
        params: [],
      };
    }

    case 'price_per_m2': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      const hasAgent = e.agent_name && e.agent_name.length > 0;
      if (hasExpo) {
        const yf = buildYearFilter(e, 'e.start_date', 2);
        const agentClause = hasAgent ? `AND c.sales_agent ILIKE $${yf.nextIndex}` : '';
        return {
          sql: `SELECT
            c.sales_agent,
            ROUND(AVG(c.revenue_eur / NULLIF(c.m2, 0))::numeric, 0) AS avg_price_per_m2,
            COALESCE(SUM(c.m2), 0) AS total_m2,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
          FROM edition_contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.m2 > 0 AND c.revenue_eur > 0 AND c.sales_agent IS NOT NULL
            ${EXCL_AGENT}
            AND e.name ILIKE $1
            ${yf.clause}
            ${agentClause}
          GROUP BY c.sales_agent ORDER BY avg_price_per_m2 DESC LIMIT 20`,
          params: hasAgent
            ? [fuzzyExpoPattern(e.expo_name), ...yf.params, `%${e.agent_name}%`]
            : [fuzzyExpoPattern(e.expo_name), ...yf.params],
        };
      }
      const yf = buildYearFilter(e, 'e.start_date', 1);
      const agentClause = hasAgent ? `AND c.sales_agent ILIKE $${yf.nextIndex}` : '';
      return {
        sql: `SELECT
          c.sales_agent,
          ROUND(AVG(c.revenue_eur / NULLIF(c.m2, 0))::numeric, 0) AS avg_price_per_m2,
          COALESCE(SUM(c.m2), 0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric, 0), 0) AS revenue_eur
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.m2 > 0 AND c.revenue_eur > 0 AND c.sales_agent IS NOT NULL
          ${EXCL_AGENT}
          ${yf.clause}
          ${agentClause}
        GROUP BY c.sales_agent ORDER BY avg_price_per_m2 DESC LIMIT 20`,
        params: hasAgent
          ? [...yf.params, `%${e.agent_name}%`]
          : [...yf.params],
      };
    }

    case 'days_to_event': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        return {
          sql: `SELECT name, country, start_date,
            (start_date - CURRENT_DATE) AS days_remaining
          FROM expos
          WHERE name ILIKE $1
            AND start_date > CURRENT_DATE
          ORDER BY start_date ASC LIMIT 1`,
          params: [fuzzyExpoPattern(e.expo_name)],
        };
      }
      return {
        sql: `SELECT name, country, start_date,
          (start_date - CURRENT_DATE) AS days_remaining
        FROM expos
        WHERE start_date > CURRENT_DATE
        ORDER BY start_date ASC LIMIT 5`,
        params: [],
      };
    }

    case 'company_collection': {
      const companyName = e.company_name || e.expo_name || '';
      if (!companyName) {
        // No company specified — show top debtors
        return {
          sql: `WITH matched AS (
            SELECT company_name,
              ROUND(SUM(contract_total_eur)::numeric, 2) AS total_eur,
              ROUND(SUM(paid_eur)::numeric, 2) AS paid_eur,
              ROUND(SUM(balance_eur)::numeric, 2) AS balance_eur,
              COUNT(*) AS contracts
            FROM outstanding_balances
            WHERE expo_start_date >= CURRENT_DATE
            GROUP BY company_name
            ORDER BY balance_eur DESC
            LIMIT 10
          )
          SELECT 'TOTAL: ' || SUM(contracts) || ' contracts' AS company_name,
            ROUND(SUM(total_eur)::numeric, 2) AS total_eur,
            ROUND(SUM(paid_eur)::numeric, 2) AS paid_eur,
            ROUND(SUM(balance_eur)::numeric, 2) AS balance_eur,
            COUNT(*)::bigint AS contracts
          FROM matched
          UNION ALL
          SELECT * FROM matched`,
          params: [],
        };
      }
      return {
        sql: `WITH matched AS (
          SELECT company_name, expo_name, af_number, sales_agent,
            ROUND(contract_total_eur::numeric, 2) AS total_eur,
            COALESCE(ROUND(paid_eur::numeric, 2), 0) AS paid_eur,
            COALESCE(ROUND(balance_eur::numeric, 2), 0) AS balance_eur
          FROM outstanding_balances
          WHERE company_name ILIKE $1
        )
        SELECT 'TOTAL: ' || COUNT(*) || ' contracts' AS company_name,
          '' AS expo_name, '' AS af_number, '' AS sales_agent,
          ROUND(SUM(total_eur)::numeric, 2) AS total_eur,
          ROUND(SUM(paid_eur)::numeric, 2) AS paid_eur,
          ROUND(SUM(balance_eur)::numeric, 2) AS balance_eur
        FROM matched
        UNION ALL
        (SELECT * FROM matched ORDER BY balance_eur DESC LIMIT 10)`,
        params: [`%${companyName}%`],
      };
    }

    case 'company_search':
      return {
        sql: `SELECT DISTINCT company_name, country, sales_agent,
          COUNT(*) AS contracts,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM edition_contracts
        WHERE company_name ILIKE $1
        GROUP BY company_name, country, sales_agent
        ORDER BY revenue_eur DESC LIMIT 20`,
        params: [`%${e.expo_name || e.agent_name || ''}%`],
      };

    case 'general_stats':
    default:
      return {
        sql: `SELECT
          COUNT(CASE WHEN sales_agent != '${INTERNAL_AGENT}' THEN id END) AS contracts,
          ROUND(SUM(revenue_eur)::numeric,2) AS total_revenue_eur,
          COUNT(DISTINCT expo_id) AS expos,
          COUNT(DISTINCT CASE WHEN sales_agent != '${INTERNAL_AGENT}' THEN sales_agent END) AS agents
        FROM edition_contracts
        WHERE EXTRACT(YEAR FROM contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        params: [],
      };
  }
}

// STEP 2b — Scope Enforcement (post-processing)
// Injects WHERE clauses based on user's data_scope and visible_years.
// Rules:
//   - user null/undefined → no filter (backward compat)
//   - data_scope=all → no filter (CEO)
//   - data_scope=own → sales_agent = user.sales_agent_name
//   - data_scope=team → sales_agent IN (subquery by sales_group)
//   - visible_years → EXTRACT(YEAR FROM date_col) = ANY(years)

const NO_SCOPE_INTENTS = new Set(['days_to_event']);
const NO_AGENT_FILTER_INTENTS = new Set([
  'expo_progress', 'target_progress', 'expo_list', 'expo_agent_breakdown', 'expo_company_list',
  'country_count', 'exhibitors_by_country', 'cluster_performance',
  'rebooking_rate', 'payment_status', 'company_search',
  'collection_summary', 'collection_no_payment', 'collection_expo',
  'company_collection',
]);

function applyScope(sql, params, intent, user) {
  if (!user) return { sql, params };

  const scope = user.permissions?.data_scope || 'own';
  // CEO: no filter at all
  if (scope === 'all') return { sql, params };

  if (NO_SCOPE_INTENTS.has(intent)) return { sql, params };

  // expo_metrics view has no sales_agent column
  if (/expo_metrics/i.test(sql)) return { sql, params };

  let newParams = [...params];
  const conditions = [];

  // Detect SQL column alias patterns
  const hasAliasC = /\bc\.\w+/i.test(sql);
  const salesAgentCol = hasAliasC ? 'c.sales_agent' : 'sales_agent';
  const contractDateCol = hasAliasC ? 'c.contract_date' : 'contract_date';
  const hasAliasE = /\be\.\w+/i.test(sql);
  const startDateCol = hasAliasE ? 'e.start_date' : 'start_date';

  // Agent/team scope filter
  if (!NO_AGENT_FILTER_INTENTS.has(intent)) {
    const hasSalesAgentTable = /fiscal_contracts|edition_contracts|contracts\b/i.test(sql);
    if (hasSalesAgentTable) {
      if (scope === 'own' && user.sales_agent_name) {
        const idx = newParams.length + 1;
        conditions.push(`${salesAgentCol} = $${idx}`);
        newParams.push(user.sales_agent_name);
      } else if (scope === 'team' && user.sales_group) {
        const idx = newParams.length + 1;
        conditions.push(`${salesAgentCol} IN (SELECT sales_agent_name FROM users WHERE sales_group = $${idx} AND is_active = true)`);
        newParams.push(user.sales_group);
      }
    }
  }

  // Visible years filter
  const visibleYears = user.permissions?.visible_years;
  if (visibleYears && Array.isArray(visibleYears) && visibleYears.length > 0) {
    const idx = newParams.length + 1;
    if (/contract_date/i.test(sql)) {
      conditions.push(`EXTRACT(YEAR FROM ${contractDateCol})::int = ANY($${idx}::int[])`);
      newParams.push(visibleYears);
    } else if (/start_date/i.test(sql)) {
      conditions.push(`EXTRACT(YEAR FROM ${startDateCol})::int = ANY($${idx}::int[])`);
      newParams.push(visibleYears);
    }
  }

  if (conditions.length === 0) return { sql, params };

  // Inject before GROUP BY / ORDER BY / HAVING / LIMIT
  const scopeClause = ' AND ' + conditions.join(' AND ');
  const injectionMatch = sql.match(/\b(GROUP BY|ORDER BY|HAVING|LIMIT)\b/i);

  if (injectionMatch) {
    const idx = injectionMatch.index;
    return { sql: sql.slice(0, idx) + scopeClause + ' ' + sql.slice(idx), params: newParams };
  }

  return { sql: sql.replace(/;?\s*$/, scopeClause), params: newParams };
}

// STEP 3 — SQL Validator
function validateSQL(sql) {
  const upper = sql.toUpperCase().trim();

  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Only SELECT queries are allowed');
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(upper.replace(/^SELECT[\s\S]*$/, ''))) {
      throw new Error(`Forbidden SQL keyword: ${keyword}`);
    }
  }

  if (!/\bLIMIT\b/i.test(sql)) {
    sql = sql.replace(/;?\s*$/, ' LIMIT 200');
  }

  return sql;
}

// STEP 4 — Answer Generator (Sonnet — quality)
async function generateAnswer(question, data, lang) {
  const l = lang || 'tr';

  const langMap = { tr: "Turkish", en: "English", fr: "French" };
  const langName = langMap[l] || langMap.tr;

  // Limit data sent to answer generator to prevent overly long answers
  const totalRows = Array.isArray(data) ? data.length : 0;
  const trimmedData = Array.isArray(data) && data.length > 5 ? data.slice(0, 5) : data;
  const totalNote = totalRows > 5 ? `\nTotal rows: ${totalRows} (showing first 5)` : '';

  const response = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 300,
    system: `You are ELIZA, the CEO's personal business assistant for Elan Expo (exhibition organizer).

Rules:
1. Start with the KEY INSIGHT — the most important number or finding
2. Maximum 2-3 sentences, then stop
3. If data has totals, ALWAYS state the total first
4. No bullet points, no numbered lists, no markdown — plain text only
5. No headers, no bold, no special formatting
6. Numbers: use period separator (1.234), currency €1.234, percent %45
7. Dates: 22 Eylül 2026 format
8. If user asks something outside Elan Expo business data, say: 'I can only help with Elan Expo business data. Try asking about expos, sales, agents, or financials.'
9. NEVER invent data. If the query returns empty results, say 'No data found for this query.'
10. If showing a list, maximum 3 items, no bullets — use line breaks
11. Language: respond in ${langName} (match the question language)
12. When Total rows > shown rows, ALWAYS calculate and state the real total, not just shown items
13. When no year was specified, you are seeing current year data. When no metric was specified, default is revenue. ALWAYS state your assumption briefly at the start: 'SIEMA 2026 gelire göre: ...' or '2026 revenue: ...' — this helps the user know what they're looking at
14. If the question is about exchange rates, salaries, or topics outside Elan Expo business data, say clearly that this data is not available in ELIZA
16. For collection/receivables queries: collection_stage meanings — no_payment (zero payments received), partial_paid (some payment made, balance remaining), pre_event_balance_open (expo <45 days away, balance open), overdue (past due date). risk_score = collection_risk + event_risk (higher = more urgent). Always state total outstanding amount first, then breakdown by stage or risk
15. Terminology (mandatory):
  - Turkish: exhibitor → "katılımcı" (NEVER "sergici"/"sergileyici"), expo/fair → "fuar" (NEVER "sergi"), revenue → "gelir" (NEVER "ciro"/"hasılat"), sales agent → "satış temsilcisi" or "agent", contract → "sözleşme"/"kontrat", edition → "edisyon", square meters → "m²", progress → "ilerleme"/"tamamlanma", target → "hedef", cluster → "cluster"
  - French: exhibitor → "exposant", expo → "salon", contract → "contrat", revenue → "chiffre d'affaires"/"revenu"
  - English: exhibitor, contract, expo, revenue, sales agent (standard terms)`,
    messages: [{
      role: 'user',
      content: `Question: ${question}\nData: ${JSON.stringify(trimmedData)}${totalNote}`,
    }],
  });

  const answerText = response.content[0].text.trim();
  const answerUsage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    model: ANSWER_MODEL,
  };
  return { text: answerText, _usage: answerUsage };
}

// STEP 5 — Hybrid Text-to-SQL Fallback (Sonnet generates SQL for unknown intents)
const SQL_GEN_PROMPT = `You are a SQL query generator for ELIZA, a business intelligence system for Elan Expo (exhibition organizer).

DATABASE SCHEMA:
- expos: id, name, country, city, edition_year, start_date, end_date, cluster, target_m2
- edition_contracts: id, af_number, company_name, country, sales_agent, m2, revenue_eur, contract_date, status, expo_id (status IN: Valid, Transferred In)
- fiscal_contracts: same as edition_contracts (status IN: Valid, Transferred Out)
- contracts: all contracts including cancelled
- expo_metrics: expo_id, expo_name, sold_m2, target_m2, progress_percent, velocity_m2_per_month, required_velocity, velocity_ratio, risk_score, risk_level, country_count, agent_count, months_to_event, start_date
- users: id, name, role, sales_agent_name, sales_group, office

BUSINESS RULES:
- 'ELAN EXPO' is an internal agent: include in revenue, EXCLUDE from m2, contract counts, exhibitor counts, agent rankings
- progress = sold_m2 / target_m2 * 100
- active expo = start_date > CURRENT_DATE
- at risk = risk_level IN ('HIGH', 'WATCH') from expo_metrics
- edition_contracts for expo performance questions
- fiscal_contracts for company/agent performance questions
- revenue_eur is always in EUR

RULES:
- Generate ONLY a SELECT query, nothing else
- Always include LIMIT 50
- Use proper JOINs (edition_contracts or fiscal_contracts, not raw contracts unless asking about rebooking)
- When question is about expo performance → use edition_contracts
- When question is about agent/sales performance → use fiscal_contracts
- If you cannot generate a valid query, return exactly: NO_QUERY
- Output ONLY the SQL, no explanation, no markdown, no backticks`;

async function generateSQL(question, lang, user) {
  const response = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 500,
    system: SQL_GEN_PROMPT,
    messages: [{
      role: 'user',
      content: `Question: ${question}`,
    }],
  });

  const sqlText = response.content[0].text.trim();
  const usage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    model: ANSWER_MODEL,
  };

  if (sqlText === 'NO_QUERY' || !sqlText.toUpperCase().startsWith('SELECT')) {
    return { sql: null, _usage: usage };
  }

  // Safety: reject queries with too many JOINs
  const joinCount = (sqlText.match(/\bJOIN\b/gi) || []).length;
  if (joinCount > 5) {
    return { sql: null, _usage: usage };
  }

  return { sql: sqlText, _usage: usage };
}

// Main entry point
async function run(question, _depth = 0, lang, user, resolvedEntities = null) {
  // Check unavailability BEFORE any API call
  const unavail = checkUnavailability(question, lang || 'tr');
  if (unavail.unavailable) {
    return {
      intent: 'unavailable',
      entities: {},
      data: [],
      answer: unavail.message,
      _usage: { intent_input: 0, intent_output: 0, intent_model: 'unavailability_check', answer_input: 0, answer_output: 0, answer_model: 'none', total_input: 0, total_output: 0 },
    };
  }

  const frameResult = await extractSemanticFrame(question);
  const intentUsage = frameResult._usage || { input_tokens: 0, output_tokens: 0, model: 'unknown' };
  let { intent, entities } = frameResult;

  // Edition vs Fiscal fix: revenue_summary + expo_name → expo_progress
  // "SIEMA 2026 toplam gelir?" should query edition_contracts (expo view), not fiscal_contracts
  if (intent === 'revenue_summary' && entities && entities.expo_name) {
    intent = 'expo_progress';
  }

  // Collection fix: collection_summary + expo_name → collection_expo
  // "SIEMA tahsilat durumu?" should filter to SIEMA, not show all contracts
  if (intent === 'collection_summary' && entities && entities.expo_name) {
    intent = 'collection_expo';
  }

  // Ambiguity Gate — check answerability from semantic frame
  if (frameResult.answerability === 'unavailable' && frameResult.unavailable_reason) {
    return {
      intent: 'unavailable',
      entities: entities || {},
      data: [],
      answer: frameResult.unavailable_reason,
      _usage: { intent_input: intentUsage.input_tokens, intent_output: intentUsage.output_tokens, intent_model: intentUsage.model, answer_input: 0, answer_output: 0, answer_model: 'none', total_input: intentUsage.input_tokens, total_output: intentUsage.output_tokens },
    };
  }

  // Clarification check — multi-turn: ask until answer is clear
  const currentYear = new Date().getFullYear();
  const normQ = question.toLowerCase();

  // Merge resolved entities from multi-turn clarification
  // This ensures expo names from DB (not in EXPO_BRANDS) are recognized,
  // and previously resolved slots aren't lost between turns.
  if (resolvedEntities && entities) {
    if (resolvedEntities.year && resolvedEntities.year !== 'all') {
      entities.year = resolvedEntities.year;
      delete entities.missing_year;
    }
    if (resolvedEntities.year === 'all') {
      // "Tüm yıllar" — no year filter
      delete entities.missing_year;
      delete entities.year;
    }
    if (resolvedEntities.expo_name) {
      entities.expo_name = resolvedEntities.expo_name;
      delete entities.missing_expo;
    }
    if (resolvedEntities.expo_general) {
      delete entities.missing_expo;
    }
    if (resolvedEntities.metric) {
      delete entities.missing_metric;
    }
  }

  // Detect missing expo for expo-agent intents (router doesn't set this flag)
  // Skip if question already contains "genel"/"general" (resolved as general in previous turn)
  // Skip if resolvedEntities already has expo_name or expo_general
  const expoAlreadyResolved = resolvedEntities && (resolvedEntities.expo_name || resolvedEntities.expo_general);
  if (entities && !entities.expo_name && intent === 'expo_agent_breakdown' && !expoAlreadyResolved) {
    if (!/\bgenel\b|\bgeneral\b|\bgénéral\b/.test(normQ)) {
      entities.missing_expo = true;
    }
  }

  // Detect missing year for expo_agent_breakdown without year
  // Only expo_agent_breakdown triggers year clarification without expo_name
  // Other intents (country_count, price_per_m2, etc.) default to current year
  // Skip if year was already resolved (e.g., "Tüm yıllar" → year='all')
  const yearAlreadyResolved = resolvedEntities && (resolvedEntities.year != null);
  if (entities && !entities.year && !entities.missing_year && intent === 'expo_agent_breakdown' && !yearAlreadyResolved) {
    if (!entities.period && !entities.relative_days && !entities.month) {
      entities.missing_year = true;
    }
  }

  // Ambiguity Gate — critical flags trigger clarification
  // Priority: 1. year  2. expo  3. metric (multi-turn: each turn resolves one slot)
  const YEAR_CLARIFICATION_INTENTS = ['expo_progress', 'expo_agent_breakdown', 'expo_company_list', 'country_count', 'price_per_m2', 'payment_status'];
  const EXPO_CLARIFICATION_INTENTS = ['country_count', 'exhibitors_by_country', 'expo_company_list', 'expo_agent_breakdown'];

  // 1. Year clarification (highest priority — year determines which expos are active)
  if (entities && entities.missing_year && YEAR_CLARIFICATION_INTENTS.includes(intent)) {
    try {
      // If expo_name is set, get editions for that expo; otherwise get all available years
      let editions;
      if (entities.expo_name) {
        editions = await query(
          `SELECT DISTINCT EXTRACT(YEAR FROM e.start_date)::int AS year
           FROM expos e WHERE e.name ILIKE $1 AND e.start_date IS NOT NULL
           ORDER BY year DESC LIMIT 5`,
          [fuzzyExpoPattern(entities.expo_name)]
        );
      } else {
        editions = await query(
          `SELECT DISTINCT EXTRACT(YEAR FROM e.start_date)::int AS year
           FROM expos e WHERE e.start_date IS NOT NULL
           ORDER BY year DESC LIMIT 5`
        );
      }
      if (editions.rows.length > 1) {
        const options = [...editions.rows.map(r => String(r.year)), 'Tüm yıllar'];
        return {
          intent: 'clarification',
          clarification: {
            slot: 'year',
            options,
            options_en: [...editions.rows.map(r => String(r.year)), 'All years'],
            options_fr: [...editions.rows.map(r => String(r.year)), 'Toutes les années'],
            original_question: question,
            original_intent: intent,
            original_entities: entities,
          },
          answer: null, data: [], _usage: { intent_input: intentUsage.input_tokens, intent_output: intentUsage.output_tokens, intent_model: intentUsage.model, answer_input: 0, answer_output: 0, answer_model: 'none', total_input: intentUsage.input_tokens, total_output: intentUsage.output_tokens },
        };
      }
      // Single edition/year → use it directly
      if (editions.rows.length === 1) {
        entities.year = editions.rows[0].year;
        delete entities.missing_year;
      }
    } catch { /* fallback to default year */ }
  }

  // 2. Expo clarification — fetch expos from DB (filtered by resolved year)
  // Skip if time-based entities exist (period, relative_days, month) — Bug fix:
  // "bugün kaç sözleşme var?" shouldn't ask for expo, it's a time-scoped query
  const hasTimeFilter = entities && (entities.period || entities.relative_days || entities.month);
  if (entities && entities.missing_expo && EXPO_CLARIFICATION_INTENTS.includes(intent) && !hasTimeFilter) {
    try {
      const allYears = resolvedEntities && resolvedEntities.year === 'all';
      const filterYear = allYears ? null : (entities.year || currentYear);
      let upcomingExpos;
      if (allYears) {
        // "Tüm yıllar" — show expos from all years (recent first)
        upcomingExpos = await query(
          `SELECT e.name, EXTRACT(YEAR FROM e.start_date)::int AS year, MIN(e.start_date) AS sd
           FROM expos e
           WHERE e.start_date IS NOT NULL
           GROUP BY e.name, EXTRACT(YEAR FROM e.start_date)
           ORDER BY sd DESC
           LIMIT 30`
        );
      } else {
        upcomingExpos = await query(
          `SELECT e.name, EXTRACT(YEAR FROM e.start_date)::int AS year, MIN(e.start_date) AS sd
           FROM expos e
           WHERE EXTRACT(YEAR FROM e.start_date) = $1
             AND e.start_date IS NOT NULL
           GROUP BY e.name, EXTRACT(YEAR FROM e.start_date)
           ORDER BY sd ASC
           LIMIT 30`,
          [filterYear]
        );
      }
      if (upcomingExpos.rows.length > 0) {
        // Use name directly — most expo names already include year (e.g., "SIEMA 2026")
        const expoOptions = upcomingExpos.rows.map(r => {
          const yearStr = String(r.year);
          return r.name.includes(yearStr) ? r.name : `${r.name} ${r.year}`;
        });
        const generalLabel = allYears ? 'Genel (tüm fuarlar)' : `Genel (tüm fuarlar ${filterYear})`;
        return {
          intent: 'clarification',
          clarification: {
            slot: 'expo',
            options: [...expoOptions, generalLabel],
            original_question: question,
            original_intent: intent,
            original_entities: entities,
          },
          answer: null, data: [], _usage: { intent_input: intentUsage.input_tokens, intent_output: intentUsage.output_tokens, intent_model: intentUsage.model, answer_input: 0, answer_output: 0, answer_model: 'none', total_input: intentUsage.input_tokens, total_output: intentUsage.output_tokens },
        };
      }
    } catch { /* fallback */ }
  }

  // 3. Metric clarification (lowest priority) — only for expo_agent_breakdown WITH an expo_name
  if (entities && entities.missing_metric && intent === 'expo_agent_breakdown' && entities.expo_name) {
    return {
      intent: 'clarification',
      clarification: {
        slot: 'metric',
        options: ['Gelir (€)', 'Alan (m²)', 'Sözleşme sayısı'],
        options_en: ['Revenue (€)', 'Area (m²)', 'Contract count'],
        options_fr: ['Revenu (€)', 'Surface (m²)', 'Nombre de contrats'],
        original_question: question,
        original_intent: intent,
        original_entities: entities,
      },
      answer: null, data: [], _usage: { intent_input: intentUsage.input_tokens, intent_output: intentUsage.output_tokens, intent_model: intentUsage.model, answer_input: 0, answer_output: 0, answer_model: 'none', total_input: intentUsage.input_tokens, total_output: intentUsage.output_tokens },
    };
  }

  // Clean up ambiguity flags before buildQuery
  if (entities) {
    delete entities.missing_year;
    delete entities.missing_metric;
    delete entities.missing_expo;
  }

  // Default year to current when not specified
  // Prevents queries from aggregating across all years/editions
  // Skip if multi-year was explicitly requested (entities.years array)
  if (entities && !entities.year && !(entities.years && entities.years.length > 1)) {
    // Month without year → current year (ISSUE-014)
    if (entities.month) {
      entities.year = currentYear;
    }
    // Expo-based intents without year → current year
    // "SIEMA'ya en çok kim satmış?" should mean SIEMA 2026, not all editions
    const EXPO_INTENTS_NEED_YEAR = [
      'expo_progress', 'target_progress', 'expo_agent_breakdown', 'expo_company_list',
      'country_count', 'price_per_m2', 'payment_status',
    ];
    if (entities.expo_name && EXPO_INTENTS_NEED_YEAR.includes(intent)) {
      entities.year = currentYear;
    }
    // top_agents / agent_performance without year → current year
    // "en iyi satışçı kim?" should mean 2026, not all time
    const AGENT_INTENTS_NEED_YEAR = ['top_agents', 'agent_performance'];
    if (AGENT_INTENTS_NEED_YEAR.includes(intent) && !entities.period && !entities.relative_days) {
      entities.year = currentYear;
    }
  }

  // Handle compound questions (max depth 1 to prevent recursion)
  if (intent === 'compound' && entities?.questions && _depth === 0) {
    // Inherit parent entities (expo_name, year, agent_name, country) into sub-queries
    // so that "madesign 2026 kaç m2 ve geliri?" passes expo filter to sub-queries
    const parentEntities = {};
    if (entities.expo_name) parentEntities.expo_name = entities.expo_name;
    if (entities.year) parentEntities.year = entities.year;
    if (entities.agent_name) parentEntities.agent_name = entities.agent_name;
    if (entities.country) parentEntities.country = entities.country;

    const subItems = entities.questions.slice(0, 2);
    const results = await Promise.all(subItems.map(async (q) => {
      // If LLM returned structured {intent, entities}, use them directly
      if (typeof q === 'object' && q.intent) {
        // Merge parent entities into sub-query entities (sub-query values take precedence)
        const ent = { ...parentEntities, ...(q.entities || {}) };
        const built = buildQuery(q.intent, ent);
        const scoped = applyScope(built.sql, built.params, q.intent, user);
        const validatedSQL = validateSQL(scoped.sql);
        const result = await query(validatedSQL, scoped.params);
        const label = [ent.agent_name, ent.expo_name, q.intent.replace(/_/g, ' ')].filter(Boolean).join(' — ');
        const contextQ = `${q.intent}: ${Object.entries(ent).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(', ')}`;
        const answerResult = await generateAnswer(contextQ, result.rows, lang);
        return { intent: q.intent, data: result.rows, answer: answerResult.text, label };
      }
      // If string, prepend parent context so sub-query inherits expo/year
      let subQ = String(q);
      if (parentEntities.expo_name && !subQ.toLowerCase().includes(parentEntities.expo_name.toLowerCase())) {
        subQ = `${parentEntities.expo_name} ${parentEntities.year || ''} ${subQ}`.trim();
      }
      const r = await run(subQ, 1, lang, user);
      return { ...r, label: String(q) };
    }));
    const combinedAnswer = results.map((r, i) => `[${i + 1}] ${r.label}\n${r.answer}`).join('\n\n');
    const combinedData = results.flatMap(r => r.data || []);
    return { intent: 'compound', entities, data: combinedData, answer: combinedAnswer };
  }

  // Hybrid Text-to-SQL fallback: if intent is general_stats with no entities,
  // router and Haiku couldn't classify → try LLM-generated SQL
  const isUnknownIntent = intent === 'general_stats' &&
    (!entities || Object.keys(entities).filter(k => entities[k] != null).length === 0);

  let data, answerResult, finalIntent = intent;
  let sqlGenUsage = { input_tokens: 0, output_tokens: 0 };

  if (isUnknownIntent && (!user || user.permissions?.data_scope === 'all')) {
    try {
      const sqlResult = await generateSQL(question, lang, user);
      sqlGenUsage = sqlResult._usage || { input_tokens: 0, output_tokens: 0 };

      if (sqlResult.sql) {
        const validatedSQL = validateSQL(sqlResult.sql);
        // Safety: 3 second timeout
        await query('SET statement_timeout = 3000');
        try {
          const result = await query(validatedSQL);
          data = result.rows;
          finalIntent = 'hybrid_sql';
        } finally {
          await query('SET statement_timeout = 0');
        }
      }
    } catch (err) {
      console.error('Hybrid SQL fallback error:', err.message);
    }
  }

  // If hybrid SQL didn't produce data, use normal template path
  if (!data) {
    const built = buildQuery(intent, entities);
    const scoped = applyScope(built.sql, built.params, intent, user);
    const validatedSQL = validateSQL(scoped.sql);
    const result = await query(validatedSQL, scoped.params);
    data = result.rows;
  }

  const isCountQuery = entities?.metric === 'count';
  const multiYearNote = entities?.years && entities.years.length > 1
    ? `\n[Multi-year query: ${entities.years.join(' + ')}. Show breakdown by year if data allows.]`
    : '';
  answerResult = await generateAnswer(question + multiYearNote, data, lang);
  const answerUsage = answerResult._usage || { input_tokens: 0, output_tokens: 0, model: 'unknown' };

  // Track attention — mark entities as reviewed by CEO
  trackAttention(intent, entities).catch(() => {});

  // Build usage summary for logging
  const _usage = {
    intent_input: intentUsage.input_tokens + sqlGenUsage.input_tokens,
    intent_output: intentUsage.output_tokens + sqlGenUsage.output_tokens,
    intent_model: finalIntent === 'hybrid_sql' ? 'hybrid_sql' : intentUsage.model,
    answer_input: answerUsage.input_tokens,
    answer_output: answerUsage.output_tokens,
    answer_model: answerUsage.model,
    total_input: intentUsage.input_tokens + sqlGenUsage.input_tokens + answerUsage.input_tokens,
    total_output: intentUsage.output_tokens + sqlGenUsage.output_tokens + answerUsage.output_tokens,
  };

  // Count queries: return only answer text, no data list
  return { intent: finalIntent, entities, data: isCountQuery ? [] : data, answer: answerResult.text, _usage };
}

/**
 * Update attention_log when CEO queries about an entity.
 */
async function trackAttention(intent, entities) {
  const { markReviewed } = require('../attention/index.js');
  const e = entities || {};

  if (e.expo_name) {
    await markReviewed('expo', e.expo_name);
  }
  if (e.agent_name) {
    await markReviewed('agent', e.agent_name);
  }
  if (e.country) {
    await markReviewed('office', e.country);
  }
  if (intent === 'expo_list' && e.metric === 'risk') {
    // CEO checked risk overview — mark all expos as partially reviewed
    // (individual expo review is more valuable, so we don't mark all)
  }
}

module.exports = { run, extractIntent, extractSemanticFrame, buildQuery, validateSQL, applyScope, generateSQL };
