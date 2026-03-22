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

// Turkish → English time mapping (applied after accent normalization)
const TIME_MAP = [
  ['bugun', 'today'],
  ['dun', 'yesterday'],
  ['bu hafta', 'this week'],
  ['bu ay', 'this month'],
  ['gecen hafta', 'last week'],
  ['gecen ay', 'last month'],
];

function normalize(text) {
  let result = text.toLowerCase();
  // Remove combining dot above (U+0307) — produced by İ → i + ̇
  result = result.replace(/\u0307/g, '');
  for (const [accented, plain] of Object.entries(ACCENT_MAP)) {
    result = result.replaceAll(accented, plain);
  }
  // Map Turkish time phrases to English equivalents
  for (const [tr, en] of TIME_MAP) {
    result = result.replaceAll(tr, en);
  }
  return result;
}

// Month name mapping (normalized) — for French, English, Turkish month extraction
const MONTH_NAMES = {
  // French
  'janvier': 1, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
  'juillet': 7, 'aout': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'decembre': 12,
  // English
  'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
  'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
  // Turkish (after accent normalization: ş→s, ü→u, ı→i)
  'ocak': 1, 'subat': 2, 'mart': 3, 'nisan': 4, 'mayis': 5, 'haziran': 6,
  'temmuz': 7, 'agustos': 8, 'eylul': 9, 'ekim': 10, 'kasim': 11, 'aralik': 12,
};

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
// Includes Turkish, French, and common aliases + demonyms
const COUNTRY_KEYWORDS = {
  'turkiye': 'Turkey', 'turkey': 'Turkey', 'turquie': 'Turkey', 'turk': 'Turkey',
  'nijerya': 'Nigeria', 'nigeria': 'Nigeria',
  'fas': 'Morocco', 'morocco': 'Morocco', 'maroc': 'Morocco',
  'kenya': 'Kenya',
  'cezayir': 'Algeria', 'algeria': 'Algeria', 'algerie': 'Algeria',
  'cin': 'China', 'china': 'China', 'chine': 'China',
  'gana': 'Ghana', 'ghana': 'Ghana',
  'italya': 'Italy', 'italy': 'Italy', 'italie': 'Italy', 'italien': 'Italy',
  'fransa': 'France', 'france': 'France', 'fransiz': 'France',
  'almanya': 'Germany', 'germany': 'Germany', 'allemagne': 'Germany',
  'ispanya': 'Spain', 'spain': 'Spain', 'espagne': 'Spain',
  'hindistan': 'India', 'india': 'India', 'inde': 'India',
  'portekiz': 'Portugal', 'portugal': 'Portugal',
  'isvec': 'Sweden', 'sweden': 'Sweden', 'suede': 'Sweden',
  'macaristan': 'Hungary', 'hungary': 'Hungary', 'hongrie': 'Hungary',
  'birlesmis arap emirlikleri': 'UAE', 'uae': 'UAE', 'emirats': 'UAE', 'bae': 'UAE',
  'misir': 'Egypt', 'egypt': 'Egypt', 'egypte': 'Egypt',
  'tunus': 'Tunisia', 'tunisia': 'Tunisia', 'tunisie': 'Tunisia',
  'suudi arabistan': 'Saudi Arabia', 'saudi arabia': 'Saudi Arabia', 'arabie saoudite': 'Saudi Arabia',
  'ingiltere': 'United Kingdom', 'united kingdom': 'United Kingdom', 'royaume-uni': 'United Kingdom', 'uk': 'United Kingdom',
  'amerika': 'United States', 'united states': 'United States', 'usa': 'United States', 'etats-unis': 'United States', 'abd': 'United States',
  'rusya': 'Russia', 'russia': 'Russia', 'russie': 'Russia',
  'polonya': 'Poland', 'poland': 'Poland', 'pologne': 'Poland',
  'yunanistan': 'Greece', 'greece': 'Greece', 'grece': 'Greece',
  'iran': 'Iran',
  'irak': 'Iraq', 'iraq': 'Iraq',
  'pakistan': 'Pakistan',
  'banglades': 'Bangladesh', 'bangladesh': 'Bangladesh',
  'endonezya': 'Indonesia', 'indonesia': 'Indonesia', 'indonesie': 'Indonesia',
  'malezya': 'Malaysia', 'malaysia': 'Malaysia', 'malaisie': 'Malaysia',
  'guney afrika': 'South Africa', 'south africa': 'South Africa', 'afrique du sud': 'South Africa',
  'senegal': 'Senegal',
  'kamerun': 'Cameroon', 'cameroon': 'Cameroon', 'cameroun': 'Cameroon',
  'fildisi sahili': 'Ivory Coast', 'ivory coast': 'Ivory Coast', "cote d'ivoire": 'Ivory Coast',
  'libya': 'Libya', 'libye': 'Libya',
  'liban': 'Lebanon', 'lebanon': 'Lebanon',
  'urdun': 'Jordan', 'jordan': 'Jordan', 'jordanie': 'Jordan',
};

// Demonym suffixes for Turkish case suffixes and demonym forms
const DEMONYM_SUFFIXES = [
  'li', 'lu', 'lular', 'lilar', 'liler', 'luler',
  'dan', 'den', 'tan', 'ten',
  'da', 'de', 'ta', 'te',
  'ya', 'ye', // dative: "İtalya'ya" → after accent norm "italyaya"
  'an', 'en', // demonym: "İtalyan", "Mısırlı" already covered by 'li'
  'ais', 'ois', // French demonyms: "français", "turquois"
];

/**
 * Try to resolve a country from text, including demonym suffix stripping.
 * Returns canonical country name or null.
 */
function resolveCountry(norm) {
  // Direct match first
  for (const [kw, country] of Object.entries(COUNTRY_KEYWORDS)) {
    // Word boundary check to avoid partial matches
    const regex = new RegExp(`\\b${kw}\\b`);
    if (regex.test(norm)) return country;
  }
  // Suffix stripping: "italyan" → "italy" (after accent norm: "italyan")
  const words = norm.split(/\s+/);
  for (const word of words) {
    for (const suffix of DEMONYM_SUFFIXES) {
      if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        for (const [kw, country] of Object.entries(COUNTRY_KEYWORDS)) {
          if (kw.startsWith(stem) || stem.startsWith(kw)) return country;
        }
      }
    }
  }
  return null;
}

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

  // 2. collection_summary — "kaç alacağımız var?", "outstanding balance"
  {
    intent: 'collection_summary',
    keywords: [
      ['alacak'],
      ['alacag'],
      ['tahsilat', 'ozet'],
      ['tahsilat', 'toplam'],
      ['tahsilat', 'genel'],
      ['outstanding'],
      ['collection', 'summary'],
      ['collection', 'status'],
      ['total', 'receivable'],
      ['recouvrement', 'total'],
    ],
  },

  // 3. collection_no_payment — "ödeme yapmayan firmalar"
  {
    intent: 'collection_no_payment',
    keywords: [
      ['odeme yapmayan'],
      ['hic odeme'],
      ['no payment', 'compan'],
      ['no payment', 'list'],
      ['zero payment'],
      ['aucun paiement'],
      ['odemesiz'],
    ],
  },

  // 4. company_collection — "pygar firmasının borcu", "ace group balance"
  {
    intent: 'company_collection',
    keywords: [
      ['firma', 'borc'],
      ['firma', 'bakiye'],
      ['firma', 'odeme'],
      ['company', 'debt'],
      ['company', 'balance'],
      ['company', 'owes'],
      ['ne kadar borc'],
      ['borcu var'],
      ['borcu ne'],
      ['borcu'],
      ['borcunu'],
    ],
  },

  // 5. collection_expo — "SIEMA tahsilat durumu"
  {
    intent: 'collection_expo',
    keywords: [
      ['tahsilat'],
      ['collection', 'expo'],
      ['collection', 'fair'],
      ['recouvrement', 'salon'],
    ],
  },

  // 5. payment_status
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

  // 5. expo_progress — "SIEMA nasıl gidiyor?", "SIEMA 2026 kaç m² satılmış?"
  // Also matches multi-metric expo questions: "kaç sözleşme, kaç m2, geliri ne kadar?"
  {
    intent: 'expo_progress',
    keywords: [
      ['kac m2', 'satilmis'],
      ['kac m2', 'satildi'],
      ['nasil gidiyor', 'fuar'],
      ['nasil gidiyor', 'expo'],
      ['how is', 'expo'],
      ['how is', 'doing'],
      ['comment va', 'expo'],
      ['kac sozlesme', 'm2'],
      ['kac sozlesme', 'gelir'],
      ['kac kontrat', 'm2'],
      ['kac kontrat', 'gelir'],
      ['contracts', 'm2', 'revenue'],
      ['contrats', 'm2', 'revenu'],
    ],
  },

  // 6. agent_performance — "Elif kaç satmış?", "Elif ne kadar satmış?"
  {
    intent: 'agent_performance',
    keywords: [
      ['ne kadar satmis'],
      ['kac satmis'],
      ['kac m2 satmis'],
      ['how much', 'sold'],
      ['combien', 'vendu'],
    ],
  },

  // 7. expo_agent_breakdown — "SIEMA'da kim satmış?"
  {
    intent: 'expo_agent_breakdown',
    keywords: [
      ['kim satmis'],
      ['en cok kim'],
      ['who sold'],
      ['qui a vendu'],
    ],
  },

  // 8. monthly_trend
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
      ['today', 'contract'],
      ['today', 'revenue'],
      ['today', 'sales'],
      ['today', 'sozlesme'],
      ['today', 'kontrat'],
      ['today', 'gelir'],
      ['today', 'satis'],
      ['yesterday', 'contract'],
      ['yesterday', 'revenue'],
      ['yesterday', 'sales'],
      ['yesterday', 'sozlesme'],
      ['yesterday', 'kontrat'],
      ['yesterday', 'gelir'],
      ['yesterday', 'satis'],
      ['this week', 'contract'],
      ['this week', 'revenue'],
      ['this week', 'sales'],
      ['this week', 'sozlesme'],
      ['this week', 'kontrat'],
      ['this week', 'gelir'],
      ['this week', 'satis'],
      ['last week', 'contract'],
      ['last week', 'revenue'],
      ['last week', 'sales'],
      ['last week', 'sozlesme'],
      ['last week', 'kontrat'],
      ['last week', 'gelir'],
      ['last week', 'satis'],
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
      ['this month', 'fuar'],
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

  // Month extraction ("bu ay" already normalized to "this month")
  if (/\bthis month\b|\bce mois\b/.test(norm)) {
    entities.month = new Date().getMonth() + 1;
  }
  // Named month extraction: "janvier", "February", "Mart", etc.
  if (!entities.month) {
    const words = norm.split(/\s+/);
    for (const w of words) {
      if (MONTH_NAMES[w]) {
        entities.month = MONTH_NAMES[w];
        break;
      }
    }
  }

  // Period: today / yesterday
  if (norm.includes('today') || norm.includes("aujourd'hui")) {
    entities.period = 'today';
  } else if (norm.includes('yesterday') || norm.includes('hier')) {
    entities.period = 'yesterday';
  }

  // Relative time extraction
  const relDaysMatch = norm.match(/son (\d+) gun/);
  if (relDaysMatch) {
    entities.relative_days = parseInt(relDaysMatch[1]);
  }
  if (norm.includes('this week') || norm.includes('cette semaine')) {
    entities.period = 'this_week';
  }
  if (norm.includes('last week') || norm.includes('semaine derniere')) {
    entities.period = 'last_week';
  }
  if (norm.includes('last month') || norm.includes('mois dernier')) {
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

  // Country extraction (with demonym suffix stripping)
  const resolvedCountry = resolveCountry(norm);
  if (resolvedCountry) {
    entities.country = resolvedCountry;
  }

  // Company name extraction — "pygar firmasının", "ace group borcu", "XYZ company"
  // Extract text before Turkish company suffixes or after "company"
  const companyPatterns = [
    /(\S+(?:\s+\S+)?)\s+firmasinin/,
    /(\S+(?:\s+\S+)?)\s+firmasi/,
    /(\S+(?:\s+\S+)?)\s+sirketi/,
    /(\S+(?:\s+\S+){0,3})\s+borcu/,
    /(\S+(?:\s+\S+){0,3})\s+borcunu/,
    /company\s+(\S+(?:\s+\S+){0,2})/,
  ];
  if (!entities.expo_name && !entities.agent_name) {
    for (const pat of companyPatterns) {
      const m = norm.match(pat);
      if (m) {
        // Clean: remove known noise words and year digits
        const raw = m[1].replace(/\b(ne kadar|kac|toplam|tum|the|20[12]\d)\b/g, '').trim();
        if (raw.length >= 2) {
          entities.company_name = original
            ? original.match(new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))?.[0] || raw
            : raw;
          break;
        }
      }
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

  // Ambiguity flags
  if (entities.expo_name && !entities.year) {
    entities.missing_year = true;
  }

  // Note: missing_metric is set here but only acted on in queryEngine.js
  // for specific intents (expo_agent_breakdown, top_agents)
  const hasMetricKeyword = /\bm2\b|\bmetrekare\b|\bgelir\b|\brevenue\b|\bkontrat\b|\bcontract\b|\bsozlesme\b/.test(norm);
  if (!hasMetricKeyword && !entities.metric) {
    entities.missing_metric = true;
  }

  return entities;
}

module.exports = { route, normalize, resolveCountry };
