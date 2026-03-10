/**
 * Keyword-based intent router for ELIZA.
 * Attempts to resolve intent from keywords before falling back to LLM.
 * Returns { intent, entities, confidence } or null if no match.
 */

// Accent normalization map
const ACCENT_MAP = {
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ç': 'c', 'ć': 'c',
  'ü': 'u', 'ù': 'u', 'û': 'u',
  'ı': 'i', 'î': 'i', 'ï': 'i',
  'ş': 's', 'ś': 's',
  'ğ': 'g',
  'ö': 'o', 'ô': 'o',
  'â': 'a', 'à': 'a',
};

function normalize(text) {
  let result = text.toLowerCase();
  for (const [accented, plain] of Object.entries(ACCENT_MAP)) {
    result = result.replaceAll(accented, plain);
  }
  return result;
}

// Known expo brand keywords for entity extraction
const EXPO_BRANDS = [
  'siema', 'mega clima', 'megaclima', 'foodexpo', 'food expo',
  'buildexpo', 'build expo', 'plastexpo', 'plast expo',
  'madesign', 'hvac', 'elect expo', 'electexpo',
];

// Known agent names for entity extraction
const AGENT_NAMES = [
  'elif', 'meriem', 'emircan', 'bengu', 'bengu', 'joanna',
  'amaka', 'damilola', 'sinerji', 'anka',
];

// Country keywords (normalized form → canonical)
const COUNTRY_KEYWORDS = {
  'turkiye': 'Turkey', 'turkey': 'Turkey', 'turquie': 'Turkey',
  'nijerya': 'Nigeria', 'nigeria': 'Nigeria',
  'fas': 'Morocco', 'morocco': 'Morocco', 'maroc': 'Morocco',
  'kenya': 'Kenya',
  'cezayir': 'Algeria', 'algeria': 'Algeria', 'algerie': 'Algeria',
  'cin': 'China', 'china': 'China', 'chine': 'China',
  'gana': 'Ghana', 'ghana': 'Ghana',
};

// Intent keyword rules — checked in priority order (first match wins)
// keywords: array of arrays. Each inner array = set of phrases that ALL must match (AND).
// If multiple inner arrays exist, any one matching = match (OR).
const RULES = [
  // 1. days_to_event — must be first (before expo_list)
  {
    intent: 'days_to_event',
    keywords: [
      ['kac gun'],
      ['gun kaldi'],
      ['how many days'],
      ['days remaining'],
      ['days left'],
      ['combien de jours'],
      ['ne zaman', 'fuar'],
      ['when is', 'expo'],
      ['when is the next'],
      ['ne zaman basliyor'],
    ],
  },

  // 2. payment_status
  {
    intent: 'payment_status',
    keywords: [
      ['odeme'],
      ['payment'],
      ['paiement'],
      ['bakiye'],
      ['balance'],
      ['vadesi'],
      ['overdue'],
      ['odenmemis'],
      ['unpaid'],
      ['impaye'],
      ['geciken'],
    ],
  },

  // 3. rebooking_rate
  {
    intent: 'rebooking_rate',
    keywords: [
      ['rebook'],
      ['rebooking'],
      ['tekrar katil'],
      ['sadik'],
      ['loyal'],
      ['fidele'],
      ['her edisyon'],
      ['every edition'],
      ['chaque edition'],
      ['tekrar gelen'],
    ],
  },

  // 4. price_per_m2
  {
    intent: 'price_per_m2',
    keywords: [
      ['m2', 'fiyat'],
      ['m2', 'price'],
      ['price per m2'],
      ['prix', 'm2'],
      ['pahali', 'stand'],
      ['pahali', 'fuar'],
      ['ucuz', 'm2'],
      ['ucuz', 'fiyat'],
      ['cheapest', 'price'],
      ['expensive', 'stand'],
      ['fiyat ortalama'],
      ['average price'],
      ['prix moyen'],
    ],
  },

  // 5. monthly_trend
  {
    intent: 'monthly_trend',
    keywords: [
      ['ay ay'],
      ['aylik'],
      ['monthly'],
      ['month by month'],
      ['mensuel'],
      ['trend'],
    ],
  },

  // 6. top_agents
  {
    intent: 'top_agents',
    keywords: [
      ['en iyi satisci'],
      ['en iyi agent'],
      ['en cok satis'],
      ['en aktif satisci'],
      ['en cok kontrat'],
      ['best agent'],
      ['top sales'],
      ['top agent'],
      ['meilleur agent'],
      ['satis yapmayan'],
      ['son 30 gunde', 'agent'],
      ['son 60 gunde', 'agent'],
      ['en basarili'],
    ],
  },

  // 7. agent_country_breakdown
  {
    intent: 'agent_country_breakdown',
    keywords: [
      ['ulke', 'dagilim'],
      ['ulkeden', 'musteri'],
      ['country breakdown'],
      ['countries', 'agent'],
    ],
  },

  // 8. agent_expo_breakdown
  {
    intent: 'agent_expo_breakdown',
    keywords: [
      ['hangi fuar', 'satis'],
      ['expo breakdown'],
      ['which expos', 'sell'],
    ],
  },

  // 9. exhibitors_by_country
  {
    intent: 'exhibitors_by_country',
    keywords: [
      ['kac firma katiliyor'],
      ['gelen firma'],
      ['exhibitors from'],
      ['companies from'],
      ['firma katiliyor'],
    ],
  },

  // 10. country_count
  {
    intent: 'country_count',
    keywords: [
      ['kac ulke'],
      ['kac farkli ulke'],
      ['how many countries'],
      ['combien de pays'],
      ['en uluslararasi'],
      ['most international'],
    ],
  },

  // 11. revenue_summary
  {
    intent: 'revenue_summary',
    keywords: [
      ['toplam gelir'],
      ['toplam m2'],
      ['total revenue'],
      ['total m2'],
      ['total sales'],
      ['revenu total'],
      ['kac kontrat', 'yil'],
      ['how many contracts', 'year'],
      ['bugun', 'kontrat'],
      ['bugun', 'satis'],
      ['bugun', 'gelir'],
      ['today', 'contract'],
      ['today', 'revenue'],
      ['today', 'sales'],
      ['son 2 yil'],
      ['son iki yil'],
      ['last 2 year'],
      ['last two year'],
    ],
  },

  // 12. expo_list (general — should be near last)
  {
    intent: 'expo_list',
    keywords: [
      ['kac fuar'],
      ['kac expo'],
      ['how many expo'],
      ['how many exhibition'],
      ["combien d'expo"],
      ['fuar listesi'],
      ['expo list'],
      ['hangi fuar', 'risk'],
      ['expos at risk'],
      ['bu ay', 'fuar'],
      ['onumuzdeki', 'fuar'],
      ['en son fuar'],
      ['en hizli buyu'],
      ['en yavas sat'],
      ['en yakin fuar'],
    ],
  },
];

/**
 * Try to extract intent and entities from question using keyword rules.
 * Returns { intent, entities, confidence } or null.
 */
function route(question) {
  const norm = normalize(question);

  // Try each rule in priority order
  for (const rule of RULES) {
    for (const phraseGroup of rule.keywords) {
      const allMatch = phraseGroup.every(phrase => norm.includes(phrase));
      if (allMatch) {
        const entities = extractEntities(norm, question);
        return { intent: rule.intent, entities, confidence: 1.0 };
      }
    }
  }

  return null;
}

/**
 * Extract entities (expo_name, agent_name, country, year, month, relative_time) from question.
 */
function extractEntities(norm, original) {
  const entities = {};

  // Year extraction
  const yearMatch = norm.match(/\b(20[12]\d)\b/);
  if (yearMatch) {
    entities.year = parseInt(yearMatch[1]);
  } else if (norm.includes('bu yil') || norm.includes('this year') || norm.includes('cette annee')) {
    entities.year = new Date().getFullYear();
  }

  // Month extraction
  if (/\bbu ay\b|\bthis month\b|\bce mois\b/.test(norm)) {
    entities.month = new Date().getMonth() + 1;
  }

  // Period: today
  if (norm.includes('bugun') || norm.includes('today') || norm.includes("aujourd'hui")) {
    entities.period = 'today';
  }

  // Relative time extraction
  const relDaysMatch = norm.match(/son (\d+) gun/);
  if (relDaysMatch) {
    entities.relative_days = parseInt(relDaysMatch[1]);
  }
  if (norm.includes('bu hafta') || norm.includes('this week') || norm.includes('cette semaine')) {
    entities.relative_days = 7;
  }
  if (norm.includes('gecen ay') || norm.includes('last month') || norm.includes('mois dernier')) {
    entities.relative_month = 'last';
  }

  // Relative years extraction: "son 2 yıl" → relative_years: 2
  const relYearsMatch = norm.match(/son (\d+) yil/);
  if (relYearsMatch) {
    entities.relative_years = parseInt(relYearsMatch[1]);
  }
  if (norm.includes('last 2 year') || norm.includes('last two year')) {
    entities.relative_years = 2;
  }

  // Expo name extraction
  for (const brand of EXPO_BRANDS) {
    if (norm.includes(normalize(brand))) {
      entities.expo_name = brand.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // Agent name extraction
  for (const agent of AGENT_NAMES) {
    if (norm.includes(agent)) {
      entities.agent_name = agent[0].toUpperCase() + agent.slice(1);
      break;
    }
  }

  // Country extraction (use normalized keys)
  for (const [kw, country] of Object.entries(COUNTRY_KEYWORDS)) {
    if (norm.includes(kw)) {
      entities.country = country;
      break;
    }
  }

  // Metric: risk
  if (norm.includes('risk') || norm.includes('tehlike') || norm.includes('danger')) {
    entities.metric = 'risk';
  }

  // Metric: count
  if (/\bkac tane\b|\bhow many\b|\bcombien\b/.test(norm)) {
    entities.metric = 'count';
  }

  return entities;
}

module.exports = { route, normalize };
