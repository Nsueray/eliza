# ELIZA — System Feature Map
Version: v4 | Owner: Elan Expo
Intelligence Roadmap: v4 — Immediate Execution Plan completed

## Architecture
CEO → WhatsApp → Twilio → Bot → Intent Router →
Haiku (fallback) → SQL Templates → PostgreSQL → Sonnet → Response

## Intelligence Layers
1. Data Layer — Zoho sync, PostgreSQL
2. Insight Layer — War Room Dashboard
3. Attention Layer — Attention Engine
4. Risk Layer — Risk Engine
5. Action Layer — Alerts + Message Generator
6. Memory Layer — Notes + Patterns (planned)

## WhatsApp Commands
.brief — morning brief
.risk [expo] — expo risk
.attention — attention items
.msg [kisi] [konu] — mesaj taslagi
.today [not] — gunluk not
.note [not] — kalici not
.help — komutlar

## AI Pipeline
Question → self-reference replace → conversationMemory (rewrite) → router.js (0 API) → Haiku intent (fallback) →
SQL template (or Hybrid SQL fallback) → applyScope (user filter) → PostgreSQL → Sonnet answer → Personality → WhatsApp
Logging: every message logged with tokens, duration, intent to message_logs

## Hybrid Text-to-SQL (Phase 14)
- Trigger: intent=general_stats with empty entities (unknown question)
- Sonnet generates SQL from DB schema + business rules
- Safety: validateSQL, statement_timeout 3s, max 5 JOINs, NO_QUERY handling
- Fallback: if SQL fails → normal general_stats template
- intent_model logged as 'hybrid_sql'

## Conversation Memory (Phase 12)
- Module: packages/ai/conversationMemory.js
- History: last 5 messages within 2 hours from message_logs
- Rewrite: follow-up questions → self-contained via Haiku
- Commands (.brief, .help) skip rewrite
- Original question logged, rewritten question sent to engine

## Models
Intent: claude-haiku-4-5-20251001
Answer: claude-sonnet-4-6

## Message Logging
- Table: message_logs (user, message, response, intent, tokens, duration, model, error)
- Token tracking: router (0 token) / Haiku (intent) / Sonnet (answer)
- API: GET /api/logs, GET /api/logs/summary
- Admin: /admin/logs (ozet + mesaj listesi)

## User Roles (implemented)
CEO — full access (data_scope: all)
Manager — team data (data_scope: team)
Agent — own data (data_scope: own)

## Data Scope Enforcement (implemented)
- queryEngine.js applyScope() — post-processing SQL injection
- CEO: no filter, Manager: team filter, Agent: own filter
- visible_years: restricts which years of data user can see
- Parameterized queries — no string concatenation

## Personality Engine
- Module: packages/ai/personalityEngine.js
- Nicknames: users.nicknames (comma-separated), managed via Admin Panel
- Greetings: time-aware (morning/afternoon/evening), random nickname
- Closings: different nickname than greeting, random variation
- Applied to all users (not just CEO)
- TR/EN/FR support

## Language Detection
- TR/EN/FR automatic (word-level scoring, default TR)
- Accent-insensitive: ç→c, ş→s, ü→u, ı→i, ö→o, ğ→g
- Word boundary match (not substring) — prevents false positives

## Key Business Rules
- ELAN EXPO: revenue dahil, count/m2/ranking haric
- Max 5 rows WhatsApp, dashboard link
- Tarih format: 19-Mayis-2026 (no auto-link)
- Dil: TR/EN/FR otomatik algilama
- Month without year → defaults to current year

## Intelligence Roadmap v4 (immediate plan completed)
- North star: Semantic Frame + Ambiguity Gate + DSL Compiler (future)
- Completed: hybrid SQL CEO-only, 3 router rules, unavailability response, assumption transparency, log enrichment
- Principle: "Assume transparently, clarify selectively, fail honestly"
- Router: 20+ rules (was 12→15→16→18→20+), Haiku fallback for remaining intents
- Intent redirects: revenue_summary+expo→expo_progress, revenue_summary+agent→agent_performance
- New intents: contract_list, target_progress, collection_summary, collection_no_payment, collection_expo, company_collection
- Month range: "ilk X ay"→month_end, Q1-Q4 shorthand, kiyasla/compare keywords
- Unavailability: payment_balance, currency, salary, general_knowledge → honest refusal
- Benchmark: 96% PASS (48/50)

## Mini Clarification System
- Ambiguity detection: missing_year, missing_expo flags in router + Haiku
- Year clarification: expo queries without year → DB edition list → ask user
- Expo clarification: expo-required intents without expo → upcoming expo list
- Pending state: users.pending_clarification JSONB, 10 min expire, max 1 turn
- Resolution: numbered reply, text match, keyword match
- Principle: "Ask once, then answer" — max 1 clarification per question

## Admin Dashboard
- /admin/logs: Message cards, Copy button (stateful "Copied!" feedback, 2s), filters (user/intent/status/date), Doughnut chart (router vs haiku), Bar chart (daily messages)
- /admin/intelligence: Router rules viewer, intent stats table (sortable), benchmark questions viewer, unavailable metrics, clarification stats
- /admin/system: Service health checks, DB table sizes, last Zoho sync, active users, recent errors
- Navigation: Logs | Intelligence | System | Users | War Room (shared header on all admin pages)
- War Room + Expo Directory: full admin navigation links (Expo Directory | Logs | Intelligence | System | Users)
- API: /api/intelligence/*, /api/system/status, enhanced /api/logs
- UI: plain text labels (no emoji unicode escapes), DM Mono monospace throughout

## Data Source Badge
- DataSourceBadge component: shows which data view is active (Fiscal/Edition) on all data pages
- Collapsible: click to see source table, includes/excludes, purpose, cross-reference tip
- Pages: War Room, Expo Directory, Expo Detail, Sales, Finance, Targets
- Dynamic mode on toggle pages, fixed on single-view pages

## Copy to Clipboard
- /admin/logs: per-message Copy button copies MESSAGE, REWRITE, INTENT, MODEL, RESPONSE, TOKENS, DURATION, ERROR
- Stateful CopyButton component: "Copy" → "Copied!" (green, 2s) → "Copy"
- Uses navigator.clipboard.writeText() with .then() callback
