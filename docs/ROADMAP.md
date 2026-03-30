# ELIZA — Roadmap

## Completed

### Infrastructure & Core
- Phase 1: Data Infrastructure (PostgreSQL schema, Zoho Sync Engine, Base API)
- Phase 11: Deploy (Render — 3 services + PostgreSQL cloud, custom domain eliza.elanfairs.com)
- Multi-user system (users + user_permissions, roles: ceo/manager/agent, data scope enforcement)
- Data Scope Enforcement (user-level access control: all/team/own + visible_years)

### Dashboard
- Phase 2: War Room Dashboard (Expo Radar, Sales Leaderboard, Financial KPIs, mode toggles)
- Expo Directory (/expos — sortable, filterable, export: Copy/CSV/Excel/PDF, query param deep linking)
- Expo Detail (/expos/detail — individual expo view)
- Fiscal Sales (/sales — agent leaderboard, fiscal KPIs)
- Admin Panel (/admin — user CRUD, permissions, dashboard permissions)
- Admin Logs (/admin/logs — message cards, filters, Doughnut + Bar charts, Copy button)
- Admin Intelligence (/admin/intelligence — router rules, intent stats, benchmark, clarification stats)
- Admin System (/admin/system — service health, DB tables, sync dashboard, active users, recent errors)
- Admin Users (/admin/users — new/edit user forms, password set, WhatsApp + dashboard permissions)
- Design System (dark theme, DM Mono/DM Sans, gold accent #C8A97A, shared Nav component)
- Login/Auth (JWT + bcrypt, dashboard access control, password set endpoint)
- Navigation (shared header: War Room | Expo Directory | Sales | Logs | Intelligence | System | Users)

### AI Engine
- Phase 3: AI Query Engine (19 intents, POST /api/ai/query, natural language to SQL)
- Phase 3b: Risk Engine (velocity model, risk scoring, expo_metrics table)
- Phase 14: Hybrid Text-to-SQL (Sonnet SQL fallback, CEO-only, validateSQL safety)
- Semantic Frame Extraction (extractSemanticFrame — router fast path + Haiku structured JSON fallback)
- Ambiguity Gate (unanswerable refuse, critical clarification, warning defaults)
- Router: 18+ keyword rules, accent normalization, priority-ordered, 30+ country aliases, demonym suffix stripping
- Fuzzy expo name matching (fuzzyExpoPattern — space-insensitive ILIKE)
- Edition vs Fiscal intent redirection (revenue_summary + expo_name → expo_progress)
- Unavailability registry (payment_balance, currency, salary, general_knowledge → honest refusal)
- Sonnet answer prompt (15 rules, terminology per language, assumption transparency)

### Clarification System
- Mini Clarification System (year → expo → metric priority, multi-turn, 10min expire)
- Year clarification (DB edition lookup, "Tum yillar" option)
- Expo clarification (active expos from DB, "Genel" option, year-filtered)
- Metric clarification (expo_agent_breakdown: gelir/m2/sozlesme)
- Context ambiguity (independent question + history expo → ask)
- Pending state (users.pending_clarification JSONB, unlimited turns)
- Cancel support (iptal/cancel/annuler/vazgec)

### WhatsApp Bot
- Phase 8a: WhatsApp Bot (Twilio webhook, auth, AI query, TwiML response)
- Phase 12a+12b: Conversation Memory + Question Rewrite (Haiku conservative rewrite)
- Personality Engine (nicknames, time-aware greetings, per-user)
- Language Detection (TR/EN/FR, accent-insensitive, word-boundary match)
- Commands: .brief, .risk, .attention, .help
- Self-reference resolution (ben/benim/my → sales_agent_name)
- Dashboard deep links (18 intents mapped, dynamic year, expo/country params)

### Message Generator
- Phase 6: Message Generator (4 templates, 3 languages, .msg command, human-in-the-loop)
- Phase 4: Attention Engine (CEO attention tracking)
- Phase 5: Alert Generator + Morning Brief (payment watch, dedup, scheduler, Twilio)

### Quality & Monitoring
- Message Logging (message_logs table, token tracking, duration, intent/model split)
- Log enrichment (rewritten_question column, migration 008)
- Benchmark: 92% PASS (46/50, 0 FAIL, 4 WARN)
- 31+ known issues tracked and fixed (docs/KNOWN_ISSUES.md)

### Finance Module — Collections Cockpit
- Payment Sync (Balance1, Total_Payment, Received_Payment subform, Currency + Exchange_Rate)
- Currency Conversion (NGN/MAD/USD/TRY → EUR using Zoho Exchange_Rate)
- contract_payments table (received payments with dual currency: amount_eur + amount_local)
- contract_payment_schedule table (synthetic schedule: 30% deposit + 70% pre-event)
- outstanding_balances SQL view (collection_stage, dual-axis risk score)
- Finance Dashboard (/finance — Collections Cockpit):
  - 8 KPI cards (Contract Value, Collected, Outstanding, Paid This Month, Due Next 30d, Deposit Rate, At-Risk, No Payment)
  - Collection Action List (scrollable, filterable by stage/risk, sortable, search, per-table export)
  - Company detail drawer (payment schedule + received payments)
  - A/R Aging chart + Upcoming Collections table
  - Outstanding by Expo + by Agent tables
  - Weekly Cash Forecast (8 week, synthetic schedule)
  - Recent Payments table (dual currency display)
  - Edition/Fiscal toggle
  - Split-table sticky header
- Finance API (8 endpoints: summary, action-list, aging, upcoming, by-expo, by-agent, contract detail, recent-activity)
- WhatsApp Finance Intents:
  - collection_summary ("kaç alacağımız var?")
  - collection_expo ("SIEMA tahsilat durumu?")
  - collection_no_payment ("ödeme yapmayan firmalar?")
  - company_collection ("pygar firmasının borcu?")
- Architecture docs: docs/FINANCE_MODULE.md, docs/FINANCE_UI_PLAN.md

### Quality Fixes (Session 2)
- Fuzzy expo name matching (megaclima → Mega Clima)
- Country aliases (30+ countries, TR/EN/FR, demonym suffix stripping)
- Cancel clarification fix (iptal/cancel when pending)
- Unnecessary clarification skip (time-based queries skip expo)
- Compound query fix (multi-metric → expo_progress)
- Edition vs fiscal redirection (expo_name → edition view)
- French month parsing (janvier, février, mars...)
- Turkish "bu hafta" time parsing
- Company name extraction for debt queries

### Push Messages System
- packages/push: 5 message types (morning_brief, midday_pulse, daily_wrap, weekly_report, weekly_close)
- Scheduler: node-cron every 5 minutes, per-user timezone scheduling
- Migration 017: push_settings JSONB on users, push_log table
- Per-user settings: enable/disable per type, custom time, data scope (all/team/own)
- Multi-language: TR/EN/FR based on users.language
- Dedup via push_log, Twilio WhatsApp send
- Admin UI: PushSettings component in /admin/users/[id] with test preview
- API: GET /api/system/test-push, GET /api/system/push-status

### User Country + Timezone
- Migration 018: user_country, timezone on users
- COUNTRY_TIMEZONES: 16 countries mapped
- Push scheduler uses per-user timezone: getUserLocalTime()

### Target System (Hedef Belirleme)
- Migration 019: expo_targets + expo_clusters + expos.cluster_id
- packages/targets: calculateAutoTarget, detectClusters (country+month), createOrUpdateClusters, seedAutoTargets
- Country inference: inferCountry(city, country, name) handles NULL country and inconsistent city spellings
- Dashboard /targets: KPI cards, SVG gauge charts, collapsible cluster tables, edit modal (auto/manual), seed button
- API: 5 endpoints (GET targets, PUT target, POST seed, GET clusters, GET previous)
- Dashboard permissions: "targets" module
- Nav: "Targets" after "Finance"

## Production URLs
- Dashboard: https://eliza.elanfairs.com
- API: https://eliza-api-8tkr.onrender.com
- Bot: https://eliza-bot-r1vx.onrender.com
- WhatsApp: +1 810-255-5377

## Recently Completed

### DataSourceBadge + Month Range / Quarter Comparison (2026-03-28, commit a2145f2)
- DataSourceBadge component: her sayfada veri kaynağı göstergesi (Fiscal View: Valid + Transferred Out | edition vs fiscal açıklaması, tıklanınca detay açılır)
- Sayfa bazlı mode tablosu: Sales (fiscal), Expo Directory (edition), Expo Detail (edition), War Room/Finance/Targets (toggle)
- Month range support: "Ocak-Mart arası", "Q1", "ilk çeyrek" gibi sorgular
- Quarter comparison: "Q1 vs Q2", "bu çeyrek geçen yıla göre" karşılaştırma sorguları

### Zoho API Optimization (2026-03-27, commit e2b9aba + 069ee07)
- Sync interval: 15 dakika → saatte bir
- Payment second pass: her sync'te → günde 2 kez (06:00 + 18:00 UTC)
- API kullanımı: 94,162 → ~2,380 kredi/gün (%97.5 düşüş)
- Syntax error fix: syncSalesOrders.js'teki fazla } kaldırıldı, scheduler tekrar çalışıyor

### Weekly Contract Query Fixes (2026-03-27, commit 51bf640)
- Agent filter: revenue_summary + agent_name → agent_performance redirect
- Period support: this_week/last_week/today/yesterday/this_month agent_performance'a eklendi
- Yeni intent: contract_list — bireysel sözleşme satırları, period/agent/expo filtreleri

## In Progress

(none currently)

## Next Phases

### ELL Platform — Zoho Replacement Long-term Vision
- ELL = ELIZA + LİFFY + LEENA — üç sistemin tek platformda birleşimi
- LİFFY: CRM + satış zinciri (lead → contact → quote → contract → revenue) — Zoho Sales'ın yerini alacak
- LEENA: Fuar operasyonları (kat planları, kataloglar, post-show raporlar, fuar websiteleri) — Zoho Events'in yerini alacak
- ELIZA: CEO karar destek + intelligence layer — her iki sistemden okur, yazmaz
- Geçiş stratejisi: Zoho sync → LİFFY/LEENA olgunlaştıkça Zoho modülleri tek tek devre dışı
- Detaylar: docs/ELL_ROADMAP.md (oluşturulacak)

### Phase 12c: CEO Notes with Semantic Recall
- .note command + entity matching
- Semantic recall from stored notes

### Phase 13: Answer Quality
- Explainability for risk answers (velocity comparison)
- Language validation (response language matches question language)
- Enhanced Sonnet prompt for action suggestions

### Phase 15: Learning & Feedback
- CEO corrections via WhatsApp (.correct command)
- Preference memory (default year, entity preferences)
- Popular query analytics from message_logs

### Phase 16: Proactive Attention & Alerts
- Auto morning brief at 07:00
- Threshold alerts (velocity drop, inactive agent, cancellation trends)
- Attention reminders (unreviewed offices/expos)

### Phase 17: Action Layer Integration
- Alert → suggest action → CEO approval → execute
- Connect Message Generator to Attention Engine

### Phase 18: Organizational Memory (Future)
- Exhibitor patterns, office history, CEO decisions
- Full relationship tracking

### Target V2: User/Team Operational Targets
- user_targets table: contracts/revenue/collections/sqm targets per user
- Target vs threshold distinction
- Push messages with target progress integration

### Finance V2: Enhanced Collections
- Morning brief tahsilat integration
- Automated payment reminders via WhatsApp
- Collection performance tracking per agent

## Benchmark
> node packages/ai/benchmark.js (target: >= 90% PASS)

## Known Issues
> docs/KNOWN_ISSUES.md
