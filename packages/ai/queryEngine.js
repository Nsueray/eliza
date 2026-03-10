const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { query } = require('../db/index.js');

const client = new Anthropic();
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

const ALLOWED_TABLES = ['expos', 'contracts', 'edition_contracts', 'fiscal_contracts', 'expo_metrics'];
const FORBIDDEN_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'EXEC'];

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
  "intent": "one of [expo_progress, agent_performance, agent_country_breakdown, agent_expo_breakdown, expo_agent_breakdown, expo_company_list, monthly_trend, cluster_performance, payment_status, rebooking_rate, price_per_m2, country_count, exhibitors_by_country, top_agents, revenue_summary, expo_list, company_search, general_stats]",
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
Q: elif bu yıl ay ay ne kadar sattı → {"intent":"monthly_trend","entities":{"agent_name":"Elif","year":"current"}}
Q: Elan Expo 2026 fuarları → {"intent":"expo_list","entities":{"year":2026}}
Q: Elan Expo exhibitions 2026 → {"intent":"expo_list","entities":{"year":2026}}

If the question contains multiple distinct questions (connected by "ve", "and", "also", "ayrıca", "+"), set intent to "compound" and list sub-questions:
Q: elif ulke breakdown ve emircan expo breakdown → {"intent":"compound","entities":{"questions":["elif ulke breakdown","emircan expo breakdown"]}}
Limit to max 2 sub-questions.`;

// STEP 1 — Intent Extraction
async function extractIntent(question) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `${INTENT_PROMPT}\n\nQuestion: ${question}`,
    }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { intent: 'general_stats', entities: {} };
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { intent: 'general_stats', entities: {} };
  }

  // Resolve "current" month/year
  const now = new Date();
  if (parsed.entities) {
    if (parsed.entities.month === 'current') parsed.entities.month = now.getMonth() + 1;
    if (parsed.entities.year === 'current') parsed.entities.year = now.getFullYear();
  }

  // Normalize null/None/unknown intents to general_stats
  const validIntents = [
    'expo_progress', 'agent_performance', 'agent_country_breakdown', 'agent_expo_breakdown',
    'expo_agent_breakdown', 'expo_company_list', 'monthly_trend', 'cluster_performance',
    'payment_status', 'rebooking_rate', 'price_per_m2', 'country_count',
    'exhibitors_by_country', 'top_agents', 'revenue_summary', 'expo_list',
    'company_search', 'general_stats', 'compound',
  ];
  if (!parsed.intent || !validIntents.includes(parsed.intent)) {
    parsed.intent = 'general_stats';
  }

  return parsed;
}

// STEP 2 — Query Builder
function buildQuery(intent, entities) {
  const e = entities || {};

  switch (intent) {
    case 'expo_progress':
      return {
        sql: `SELECT e.name, e.start_date, e.target_m2,
          COALESCE(SUM(c.m2),0) AS sold_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur,
          COUNT(c.id) AS contracts,
          CASE WHEN e.target_m2 > 0 THEN ROUND((COALESCE(SUM(c.m2),0)/e.target_m2*100)::numeric,1) ELSE NULL END AS progress_pct
        FROM expos e
        LEFT JOIN edition_contracts c ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $2)
        GROUP BY e.id ORDER BY e.start_date DESC LIMIT 5`,
        params: [`%${e.expo_name || ''}%`, e.year || null],
      };

    case 'agent_performance':
      return {
        sql: `SELECT sales_agent, COUNT(*) AS contracts,
          COALESCE(SUM(m2),0) AS total_m2,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts
        WHERE sales_agent ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM contract_date) = $2)
          AND ($3::int IS NULL OR EXTRACT(MONTH FROM contract_date) = $3)
        GROUP BY sales_agent`,
        params: [`%${e.agent_name || ''}%`, e.year || null, e.month || null],
      };

    case 'agent_country_breakdown':
      return {
        sql: `SELECT c.country, COUNT(*) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2
        FROM fiscal_contracts c
        WHERE c.sales_agent ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM c.contract_date) = $2)
          AND c.country IS NOT NULL
        GROUP BY c.country
        ORDER BY contracts DESC
        LIMIT 20`,
        params: [`%${e.agent_name || ''}%`, e.year || null],
      };

    case 'agent_expo_breakdown':
      return {
        sql: `SELECT e.name AS expo, e.start_date,
          COUNT(c.id) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.sales_agent ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM c.contract_date) = $2)
        GROUP BY e.id
        ORDER BY revenue_eur DESC
        LIMIT 20`,
        params: [`%${e.agent_name || ''}%`, e.year || null],
      };

    case 'country_count':
      return {
        sql: `SELECT c.country, COUNT(*) AS exhibitors
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $2)
          AND c.country IS NOT NULL
        GROUP BY c.country ORDER BY exhibitors DESC LIMIT 50`,
        params: [`%${e.expo_name || ''}%`, e.year || null],
      };

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
          ORDER BY c.m2 DESC LIMIT 50`,
          params: [`%${e.country || ''}%`, `%${e.expo_name}%`],
        };
      }
      return {
        sql: `SELECT e.name AS expo, COUNT(*) AS exhibitors
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.country ILIKE $1
          AND e.start_date >= CURRENT_DATE
        GROUP BY e.name ORDER BY exhibitors DESC LIMIT 20`,
        params: [`%${e.country || ''}%`],
      };
    }

    case 'top_agents':
      return {
        sql: `SELECT sales_agent, COUNT(*) AS contracts,
          COALESCE(SUM(m2),0) AS total_m2,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts
        WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM contract_date) = $1)
          AND ($2::int IS NULL OR EXTRACT(MONTH FROM contract_date) = $2)
          AND sales_agent IS NOT NULL
        GROUP BY sales_agent ORDER BY revenue_eur DESC LIMIT 10`,
        params: [e.year || null, e.month || null],
      };

    case 'revenue_summary':
      return {
        sql: `SELECT
          EXTRACT(YEAR FROM contract_date)::integer AS year,
          COUNT(*) AS contracts,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM edition_contracts
        WHERE contract_date IS NOT NULL
          AND ($1::int IS NULL OR EXTRACT(YEAR FROM contract_date) = $1)
        GROUP BY year ORDER BY year`,
        params: [e.year || null],
      };

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
            COUNT(c.id) AS contracts,
            COALESCE(SUM(c.m2),0) AS sold_m2,
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
          COUNT(c.id) AS contracts,
          COALESCE(SUM(c.m2),0) AS sold_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM expos e
        LEFT JOIN edition_contracts c ON c.expo_id = e.id
        WHERE e.start_date >= CURRENT_DATE AND e.start_date <= CURRENT_DATE + INTERVAL '12 months'
        GROUP BY e.id ORDER BY e.start_date ASC`,
        params: [],
      };

    case 'expo_agent_breakdown':
      return {
        sql: `SELECT c.sales_agent, COUNT(*) AS contracts,
          COALESCE(SUM(c.m2),0) AS total_m2,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS revenue_eur
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $2)
          AND c.sales_agent IS NOT NULL
        GROUP BY c.sales_agent ORDER BY revenue_eur DESC LIMIT 20`,
        params: [`%${e.expo_name || ''}%`, e.year || null],
      };

    case 'expo_company_list':
      return {
        sql: `SELECT c.company_name, c.country, c.sales_agent,
          c.m2, ROUND(c.revenue_eur::numeric,2) AS revenue_eur
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE e.name ILIKE $1
          AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $2)
        ORDER BY c.revenue_eur DESC LIMIT 100`,
        params: [`%${e.expo_name || ''}%`, e.year || null],
      };

    case 'monthly_trend': {
      const hasAgent = e.agent_name && e.agent_name.length > 0;
      if (hasAgent) {
        return {
          sql: `SELECT EXTRACT(MONTH FROM contract_date)::int AS month,
            TO_CHAR(contract_date, 'Month') AS month_name,
            COUNT(*) AS contracts,
            COALESCE(SUM(m2),0) AS total_m2,
            COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
          FROM fiscal_contracts
          WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM contract_date) = $1)
            AND sales_agent ILIKE $2
          GROUP BY month, month_name ORDER BY month`,
          params: [e.year || null, `%${e.agent_name}%`],
        };
      }
      return {
        sql: `SELECT EXTRACT(MONTH FROM contract_date)::int AS month,
          TO_CHAR(contract_date, 'Month') AS month_name,
          COUNT(*) AS contracts,
          COALESCE(SUM(m2),0) AS total_m2,
          COALESCE(ROUND(SUM(revenue_eur)::numeric,2),0) AS revenue_eur
        FROM fiscal_contracts
        WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM contract_date) = $1)
        GROUP BY month, month_name ORDER BY month`,
        params: [e.year || null],
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

    // TODO: Add balance field from Zoho Balance1 formula field
    case 'payment_status': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        return {
          sql: `SELECT c.company_name, e.name AS expo,
            ROUND(c.revenue_eur::numeric,2) AS total,
            c.sales_agent, c.contract_date
          FROM edition_contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.revenue_eur > 0
            AND e.name ILIKE $1
            AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $2)
          ORDER BY c.revenue_eur DESC LIMIT 50`,
          params: [`%${e.expo_name}%`, e.year || null],
        };
      }
      return {
        sql: `SELECT c.company_name, e.name AS expo,
          ROUND(c.revenue_eur::numeric,2) AS total,
          c.sales_agent, c.contract_date
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.revenue_eur > 0
          AND e.start_date >= CURRENT_DATE
          AND ($1::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $1)
        ORDER BY c.revenue_eur DESC LIMIT 50`,
        params: [e.year || null],
      };
    }

    case 'rebooking_rate': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        return {
          sql: `SELECT c.company_name, COUNT(DISTINCT e.id) AS editions,
            MIN(e.start_date) AS first_expo,
            MAX(e.start_date) AS last_expo,
            COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS total_revenue
          FROM contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.status = 'Valid'
            AND e.name ILIKE $1
          GROUP BY c.company_name
          HAVING COUNT(DISTINCT e.id) > 1
          ORDER BY editions DESC, total_revenue DESC LIMIT 30`,
          params: [`%${e.expo_name}%`],
        };
      }
      return {
        sql: `SELECT c.company_name, COUNT(DISTINCT e.id) AS editions,
          MIN(e.start_date) AS first_expo,
          MAX(e.start_date) AS last_expo,
          COALESCE(ROUND(SUM(c.revenue_eur)::numeric,2),0) AS total_revenue
        FROM contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.status = 'Valid'
        GROUP BY c.company_name
        HAVING COUNT(DISTINCT e.id) > 1
        ORDER BY editions DESC, total_revenue DESC LIMIT 30`,
        params: [],
      };
    }

    case 'price_per_m2': {
      const hasExpo = e.expo_name && e.expo_name.length > 0;
      if (hasExpo) {
        return {
          sql: `SELECT
            e.name AS expo,
            ROUND(AVG(c.revenue_eur / NULLIF(c.m2, 0))::numeric, 2) AS avg_price_per_m2,
            MIN(ROUND((c.revenue_eur / NULLIF(c.m2, 0))::numeric, 2)) AS min_price,
            MAX(ROUND((c.revenue_eur / NULLIF(c.m2, 0))::numeric, 2)) AS max_price,
            COUNT(*) AS contracts
          FROM edition_contracts c
          JOIN expos e ON c.expo_id = e.id
          WHERE c.m2 > 0 AND c.revenue_eur > 0
            AND e.name ILIKE $1
            AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $2)
          GROUP BY e.id ORDER BY avg_price_per_m2 DESC LIMIT 20`,
          params: [`%${e.expo_name}%`, e.year || null],
        };
      }
      return {
        sql: `SELECT
          e.name AS expo,
          ROUND(AVG(c.revenue_eur / NULLIF(c.m2, 0))::numeric, 2) AS avg_price_per_m2,
          MIN(ROUND((c.revenue_eur / NULLIF(c.m2, 0))::numeric, 2)) AS min_price,
          MAX(ROUND((c.revenue_eur / NULLIF(c.m2, 0))::numeric, 2)) AS max_price,
          COUNT(*) AS contracts
        FROM edition_contracts c
        JOIN expos e ON c.expo_id = e.id
        WHERE c.m2 > 0 AND c.revenue_eur > 0
          AND ($1::int IS NULL OR EXTRACT(YEAR FROM e.start_date) = $1)
        GROUP BY e.id ORDER BY avg_price_per_m2 DESC LIMIT 20`,
        params: [e.year || null],
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
        sql: `SELECT COUNT(*) AS contracts,
          ROUND(SUM(revenue_eur)::numeric,2) AS total_revenue_eur,
          COUNT(DISTINCT expo_id) AS expos,
          COUNT(DISTINCT sales_agent) AS agents
        FROM edition_contracts
        WHERE EXTRACT(YEAR FROM contract_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        params: [],
      };
  }
}

// STEP 3 — SQL Validator
function validateSQL(sql) {
  const upper = sql.toUpperCase().trim();

  if (!upper.startsWith('SELECT')) {
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

// STEP 4 — Answer Generator
async function generateAnswer(question, data, lang) {
  const langInstruction = {
    tr: 'TÜRKÇE yanıt ver.',
    en: 'Answer in ENGLISH.',
    fr: 'Réponds en FRANÇAIS.',
  };

  const examples = {
    tr: [
      '"Elif\'in 2025\'teki en güçlü pazarı 23 kontratla Nijerya, ardından 22 kontratla Çin."',
      '"SIEMA 2026 hedefin %127\'sine ulaştı — 1.685 m² hedefe karşı 2.139 m² satıldı."',
    ],
    en: [
      '"Elif\'s top market in 2025 was Nigeria with 23 contracts, followed by China with 22."',
      '"SIEMA 2026 reached 127% of target — 2,139 m² sold against 1,685 m² target."',
    ],
    fr: [
      '"Le meilleur marché d\'Elif en 2025 était le Nigeria avec 23 contrats, suivi de la Chine avec 22."',
      '"SIEMA 2026 a atteint 127% de l\'objectif — 2 139 m² vendus sur un objectif de 1 685 m²."',
    ],
  };

  const l = lang || 'tr';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Sen ELIZA, Elan Expo CEO'sunun kısa ve öz AI asistanısın.
${langInstruction[l] || langInstruction.tr}
Maksimum 1-3 kısa cümle. Doğrudan sonucu söyle.
Başlık, liste, büyük harf, markdown, tablo KULLANMA.
Veri listesi ayrıca gösterilecek — verileri cümle içinde tekrarlama.
Sadece ana bulguyu ve yorumu ver.

Format: tarihler "22 Eylül 2026", para "€562.512", yüzde "%127", m² "2.139 m²"

Örnekler:
${examples[l].join('\n')}

Question: ${question}
Data: ${JSON.stringify(data)}`,
    }],
  });

  return response.content[0].text.trim();
}

// Main entry point
async function run(question, _depth = 0, lang) {
  const { intent, entities } = await extractIntent(question);

  // Handle compound questions (max depth 1 to prevent recursion)
  if (intent === 'compound' && entities?.questions && _depth === 0) {
    const subItems = entities.questions.slice(0, 2);
    const results = await Promise.all(subItems.map(async (q) => {
      // If LLM returned structured {intent, entities}, use them directly
      if (typeof q === 'object' && q.intent) {
        const { sql, params } = buildQuery(q.intent, q.entities || {});
        const validatedSQL = validateSQL(sql);
        const result = await query(validatedSQL, params);
        const ent = q.entities || {};
        const label = [ent.agent_name, ent.expo_name, q.intent.replace(/_/g, ' ')].filter(Boolean).join(' — ');
        const contextQ = `${q.intent}: ${Object.entries(ent).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(', ')}`;
        const answer = await generateAnswer(contextQ, result.rows, lang);
        return { intent: q.intent, data: result.rows, answer, label };
      }
      // If string, run recursively
      const r = await run(String(q), 1, lang);
      return { ...r, label: String(q) };
    }));
    const combinedAnswer = results.map((r, i) => `[${i + 1}] ${r.label}\n${r.answer}`).join('\n\n');
    const combinedData = results.flatMap(r => r.data || []);
    return { intent: 'compound', entities, data: combinedData, answer: combinedAnswer };
  }

  const { sql, params } = buildQuery(intent, entities);
  const validatedSQL = validateSQL(sql);
  const result = await query(validatedSQL, params);
  const data = result.rows;
  const answer = await generateAnswer(question, data, lang);

  // Track attention — mark entities as reviewed by CEO
  trackAttention(intent, entities).catch(() => {});

  return { intent, entities, data, answer };
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

module.exports = { run, extractIntent, buildQuery, validateSQL };
