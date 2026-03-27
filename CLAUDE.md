# ELIZA — Claude Code Project Memory
Project: ELIZA  
Owner: Elan Expo  
Repository: eliza (monorepo)
---
# 1. What is ELIZA
ELIZA is a **CEO decision support system** for Elan Expo.
ELIZA is **NOT**:
- a CRM
- an ERP
- an operational management system
ELIZA is an **intelligence and oversight layer** that provides:
- executive analytics
- event risk monitoring
- sales performance visibility
- financial overview
- AI-assisted querying
- messaging-based interaction
---
# 2. Company Context
Elan Expo is an international exhibition organizer.
Offices:
- Turkey (HQ)
- Nigeria
- Morocco
- Kenya
- Algeria
- China (representative)
ELIZA helps the CEO monitor global operations.
---
# 3. Repository Structure
This repository is a **monorepo using npm workspaces**.
Structure must remain:
apps/
    api
    dashboard
    whatsapp-bot
packages/
    db
    zoho-sync
    ai
    push
    targets
    messages
docs/
    architecture
    foundation
infra/
    render
Claude must **not introduce additional root-level folders** without strong reason.
---
# 4. System Architecture
Main components:
- Backend API → apps/api
- Dashboard → apps/dashboard
- Messaging Bot → apps/whatsapp-bot
- Database Layer → packages/db
- Zoho Sync Engine → packages/zoho-sync
- AI Layer → packages/ai
- Push Messages → packages/push
- Target System → packages/targets
- Message Generator → packages/messages
Technology stack:
Backend: Node.js + Express  
Database: PostgreSQL  
Frontend: Next.js (future phase)  
Messaging: WhatsApp via Twilio (sandbox kurulu, production henuz degil)
AI: Claude or OpenAI
---
# 5. Data Ownership Rule
Zoho CRM remains the **operational source of truth**.
ELIZA operates as a **read-only intelligence layer**.
ELIZA:
- reads from Zoho
- stores synchronized data locally
- performs analytics
ELIZA must **never write back to Zoho CRM**.
---
# 6. Key Terminology
Expo  
An exhibition brand.  
Example: Mega Clima Nigeria
Edition  
A specific yearly occurrence of an expo.  
Example: Mega Clima Nigeria 2025
Cluster
Group of expos held in the same country and month (inferred from city/name when country NULL).
Contract  
Sales agreement stored in Zoho.
AF Number  
Unique contract identifier from Zoho CRM.
Exhibitor  
Participating company.  
Usually: 1 contract = 1 exhibitor.
Pavilion  
Group participation.  
1 contract may represent multiple exhibitors.
Sales Agent  
Individual or agency responsible for a sale.
Rebooking
Exhibitor commits to the next edition.
ELAN EXPO
Internal operations agent. Not a real sales agent.
Include in: revenue totals.
Exclude from: m² totals, contract counts, exhibitor counts, agent rankings, company lists.
---
# 7. Database
Primary database: PostgreSQL
Key tables:
- expos (+ cluster_id FK to expo_clusters)
- contracts (+ payment fields: balance_eur, paid_eur, due_date, payment_done, etc.)
- contract_payments (received payments from Zoho Received_Payment subform, dual currency: amount_eur + amount_local)
- contract_payment_schedule (synthetic fallback: 30% deposit + 70% pre-event)
- exhibitors
- expenses
- sales_agents
- expo_targets (target_m2, target_revenue, source auto/manual, auto_base_expo_id, auto_percentage)
- expo_clusters (name UNIQUE, city, country, dates — auto-detected by country+month)
- push_log (user_id, message_type, scope, sent_at, message_text, status)
- users (+ push_settings JSONB, user_country, timezone, pending_clarification)
- user_permissions (data_scope, visible_years, WhatsApp permissions)
- alerts
- whatsapp_messages
- message_logs (token tracking, intent, model split)
Full schema defined in:
docs/architecture/ELIZA_SYSTEM_ARCHITECTURE.md
All database access must go through:
packages/db

## Database Views

edition_contracts
- status IN ('Valid', 'Transferred In')
- Use for: Expo Radar, expo progress, exhibitor counts
- Question answered: "How is this expo performing?"

fiscal_contracts
- status IN ('Valid', 'Transferred Out')
- Use for: Sales leaderboard, revenue by period, agent performance
- Question answered: "How are we performing as a company?"

outstanding_balances
- status IN ('Valid', 'Transferred In') AND balance_eur > 0 AND payment_done IS NOT TRUE
- Columns: contract_total_eur, paid_eur, balance_eur, is_overdue, days_to_due, days_overdue, days_to_expo, paid_percent, collection_stage, collection_risk_score, event_risk_score
- Collection stages: paid_complete, deposit_missing, no_payment, overdue, pre_event_balance_open, partial_paid, ok
- Risk: collection_risk_score + event_risk_score (0-2: OK, 3-4: WATCH, 5-7: HIGH, 8+: CRITICAL)
- Use for: Finance/Collections dashboard, payment monitoring
- Blueprint: docs/FINANCE_MODULE.md
---
# 8. Current Development Phase

Completed:
- Phase 1: Data Infrastructure (PostgreSQL schema, Zoho Sync Engine, Base API)
- Phase 2: War Room Dashboard (Expo Radar, Sales Leaderboard, Financial KPIs)
- Phase 3: AI Query Engine (POST /api/ai/query — natural language to SQL)
- Phase 3b: Risk Engine (velocity model, risk scoring, War Room panel)
- Phase 4: Attention Engine (CEO dikkat takibi)
- Phase 5: Alert Generator + Morning Brief (payment watch, dedup, scheduler, Twilio)
- Phase 8a: WhatsApp Bot temel (Twilio webhook, auth, AI query, CEO kişiliği)
- Phase 6: Message Generator (4 şablon, 3 dil, .msg komutu, human-in-the-loop)
- Multi-user system (users + user_permissions, roller: ceo/manager/agent)
- Admin Panel (localhost:3000/admin)
- WhatsApp auth: users tablosundan phone lookup
- Phase 11: Deploy (Render — 3 servis + PostgreSQL cloud)
- Data Scope Enforcement (user-level access control in queryEngine)
- Personality Engine (nicknames, time-aware greetings)
- Language Detection fix (accent-insensitive + word boundary)
- Phase 12a+12b: Conversation Memory + Question Rewrite
- Phase 14: Hybrid Text-to-SQL (Sonnet SQL fallback for unknown intents)

Completed (cont.):
- Intelligence Roadmap v4 — Immediate Execution Plan
  - Hybrid SQL scope fix: CEO-only (ISSUE-019)
  - 3 new router rules: expo_progress, agent_performance, expo_agent_breakdown
  - Unavailability response: payment_balance, currency, salary, general_knowledge
  - Sonnet assumption transparency: rules 13-14 in generateAnswer prompt
  - Log enrichment: rewritten_question column (migration 008)
  - Benchmark: 96% PASS (48/50)
- Mini Clarification System
  - Ambiguity detection: missing_year, missing_metric, missing_expo flags
  - Year clarification: expo-based intents without year → DB'den edition listesi → kullanıcıya sor
  - Expo clarification: expo gerektiren intent'lerde expo belirtilmemişse → upcoming expo listesi
  - Metric clarification: infrastructure in place, not currently triggered (queries return all metrics)
  - Pending state: users.pending_clarification JSONB, 10 dakika expire
  - Max 1 clarification turn per question
  - Migration: 009_pending_clarification.sql
- Admin Dashboard Upgrade
  - /admin/logs: redesigned with message cards, filters, charts (Doughnut + Bar)
  - /admin/intelligence: router rules, intent stats, benchmark, clarification stats
  - /admin/system: service health, DB tables, sync status, errors
  - Sync Dashboard: summary cards (last sync, records today, scheduler status), manual sync button (incremental/full), sync log table with expand/collapse errors, auto-refresh 30s, export (Copy/CSV/Excel)
  - Shared navigation: Logs | Intelligence | System | Users | War Room
  - API: /api/intelligence/* (4 endpoints), /api/system/status, /api/system/sync-status (with summary), /api/system/sync-now?type=full|incremental
  - /api/logs enhanced: status/date_range filters, rewritten_question, byModelIntent

Completed (cont. 2):
- Phase A1+A2: Semantic Frame Extraction + Ambiguity Gate
  - extractSemanticFrame() replaces extractIntent() as primary extraction
  - FRAME_PROMPT: structured JSON frame with task types, ambiguity_flags, answerability
  - Router fast path unchanged (0 API cost, confidence: 1.0)
  - Haiku fallback: semantic frame extraction with 14 few-shot examples
  - Ambiguity gate: unanswerable → refuse, critical → clarification (priority: year > expo > metric), warning → defaults
  - Backward-compatible entities mapping to buildQuery/generateAnswer
  - Benchmark: 92% PASS (46/50, 0 FAIL, 4 WARN)

Completed (cont. 3):
- Dashboard Design System + Login (Phase 11b)
  - CSS design system: single source of truth (styles/design-system.css)
  - JWT auth: login, me, change-password, set-password, init-password
  - AuthProvider/AuthGuard in _app.js, login page
  - Migration 011: password_hash, last_login, dashboard_permissions
  - Nav component: unified navigation across all pages
- Dashboard Settings (Theme, Accent, Density)
  - Theme: dark/light toggle via data-theme attribute
  - Accent color: 6 color options via --accent-color CSS property
  - Table density: comfortable/compact via data-density attribute
  - Migration 012: users.settings JSONB column
  - API: PUT /api/auth/settings (debounced save)
  - Settings applied on login/load via AuthProvider

Completed (cont. 4):
- Answer Quality Batch Fix (ISSUE-025)
  - Fuzzy expo matching: fuzzyExpoPattern() normalizes compound names ("megaclima" → "%mega%clima%")
  - Country aliases: COUNTRY_KEYWORDS expanded 7→30+ countries, resolveCountry() with demonym suffix stripping
  - Unicode fix: normalize() removes U+0307 combining dot above (İ→i̇ issue)
  - Unnecessary clarification fix: skip expo clarification when time-based entities (period/relative_days/month) present
  - Language detection: 15+ Turkish words added to detectLang (sozlesme, bunlar, listele, peki, etc.)
  - Rewrite bypass: ALWAYS_INDEPENDENT regex pre-check in rewriteQuestion() skips LLM for ranking/general patterns
- Clarification Bug Fixes (ISSUE-026)
  - Tüm yıllar loop: yearAlreadyResolved + expoAlreadyResolved guards prevent re-triggering after resolve
  - Context ambiguity skip: hasTimeScope check — "bugün kaç sözleşme?" no longer triggers clarification
  - Cancel no pending: CEO "iptal" checks for actual draft first, returns friendly message if nothing pending
- Compound Expo Query Fix (ISSUE-027)
  - Multi-metric expo questions ("kaç sözleşme, kaç m2, geliri?") now map to expo_progress, not compound
  - FRAME_PROMPT + INTENT_PROMPT: explicit rule — same entity + multiple metrics = single intent
  - Router: added multi-metric patterns ['kac sozlesme', 'm2'], ['kac kontrat', 'gelir'] to expo_progress
  - Compound safety net: parent entities (expo_name, year) inherited by sub-queries
- Edition vs Fiscal Fix (ISSUE-028)
  - revenue_summary + expo_name → expo_progress redirect (edition view for expo-specific revenue queries)
- Admin Password Set
  - POST /api/users/:id/set-password endpoint (bcrypt hash, min 6 chars)
  - /admin/users/[id].js: SET PASSWORD section (input + button + feedback)
- Sync Auto-refresh Fix
  - /admin/system: ticker interval (5s) updates "Updated: X ago" display between fetches

Completed (cont. 5):
- Finance Module Sprint 1A: Payment Sync
  - Migration 013: balance_eur, paid_eur, remaining_payment_eur, due_date, payment_done, payment_method, validity on contracts
  - contract_payments tablosu: Zoho Received_Payment subform → her ödeme ayrı satır (individual record fetch required — Zoho list API doesn't return subforms)
  - Currency conversion: Payment amounts in Zoho are in contract currency. syncReceivedPayments() divides by Exchange_Rate for non-EUR contracts. Dual-format "X (€Y)" preferred when available.
  - contract_payment_schedule tablosu: synthetic only (%30 deposit + %70 pre-event)
  - outstanding_balances view: collection_stage, collection_risk_score, event_risk_score
  - Zoho sync: 2-pass — bulk for all fields, individual fetch for Received_Payment (paid_eur > 0 only)
  - Obsolete fields removed: st_Payment, nd_Payment, Date_Amount_Type1..5 (pre-2025, no longer synced)
  - first_payment_eur, second_payment_eur columns still in DB but not populated
- Finance Module Sprint 1B: API + Sprint 2: Dashboard
  - Migration 014: updated outstanding_balances view (deposit_missing now uses contract_payment_schedule subquery)
  - 8 finance API endpoints (apps/api/src/routes/finance.js):
    - GET /api/finance/summary — KPI aggregates (contract_value, collected, outstanding, overdue, due_next_30, collection_rate, at_risk, no_payment_count)
    - GET /api/finance/action-list — filterable/sortable action list with suggested_action
    - GET /api/finance/aging — 6 aging buckets (Current, 1-7d, 8-15d, 16-30d, 31-60d, 60+)
    - GET /api/finance/upcoming — scheduled payments due within N days
    - GET /api/finance/by-expo — expo-level outstanding aggregates
    - GET /api/finance/by-agent — agent-level outstanding aggregates
    - GET /api/finance/contract/:id/detail — single contract with schedule + payments
    - GET /api/finance/recent-activity — recent payment events
  - Dashboard: /finance — Collections Cockpit
    - 8 KPI cards (2 rows x 4)
    - Collection Action List: sortable table with stage/risk filter chips + search
    - Company detail drawer (480px slide-in): contract info, payment schedule, received payments
    - A/R Aging chart (Chart.js bar) + Upcoming Collections table (7d/14d/30d/60d toggle)
    - Outstanding by Expo + by Agent tables (side by side, sortable)
    - Recent Payments table
    - Edition/Fiscal mode toggle
    - Export: Copy/CSV/Excel per-table
  - Nav.js: "Finance" link added after "Sales" (permission: finance)
  - Dashboard permissions: "finance" module (CEO+Manager=true, Agent=false)

Completed (cont. 6):
- Push Messages System
  - packages/push/index.js: 5 message types (morning_brief, midday_pulse, daily_wrap, weekly_report, weekly_close)
  - packages/push/scheduler.js: node-cron every 5 minutes, per-user timezone scheduling
  - Migration 017: push_settings JSONB on users, push_log table
  - Per-user settings: enable/disable per type, custom time, data scope (all/team/own)
  - Multi-language: TR/EN/FR based on users.language (normalizeLang: "Turkce"→tr, null→en)
  - Dedup via push_log (one per user per type per day)
  - Twilio WhatsApp send with double-prefix protection
  - Admin UI: PushSettings component in /admin/users/[id] with test preview
  - API: GET /api/system/test-push, GET /api/system/push-status
- User Country + Timezone
  - Migration 018: user_country VARCHAR(50), timezone VARCHAR(50) on users
  - COUNTRY_TIMEZONES: 16 countries (Turkey, Nigeria, Morocco, Kenya, Algeria, Ghana, China, France, Germany, UK, UAE, India, Italy, Spain, Portugal, USA)
  - Country dropdown in UserForm (new + edit), timezone auto-resolved from country
  - Push scheduler uses per-user timezone: getUserLocalTime() converts to user's local time
  - Each user receives push messages at their configured local time
  - Weekend/weekday checks use user's local timezone
- Target System
  - Migration 019: expo_targets (target_m2, target_revenue, source, auto_base_expo_id, auto_percentage) + expo_clusters (name UNIQUE, city, country, dates) + expos.cluster_id FK
  - packages/targets/index.js: calculateAutoTarget (prev edition × growth%), detectClusters (proximity-based), createOrUpdateClusters, seedAutoTargets, getPreviousEdition
  - Auto target: strips year from expo name → finds previous edition → applies percentage (default +15%, supports negative)
  - Cluster detection: proximity-based connected-components (JS-based), same-country + same-city requirement
    - inferCountry(city, country, name): country field → CITY_COUNTRY map (lagos→Nigeria, algiers→Algeria, casablanca→Morocco) → NAME_COUNTRY_KEYWORDS from expo name
    - CITY_ALIASES: normalizeCity() for spelling variants (algiers→alger)
    - CLUSTER_PROXIMITY_DAYS = 45: consecutive expos in same country within 45 days → same cluster
    - Same-city check: if both expos have city, must match (normalized). NULL city = tolerant (chains). Different city = chain breaks (Abuja ≠ Lagos)
    - Connected-components: chains expos A→B→C if each pair is within proximity window AND same city
    - 2026 result: 7 clusters + 2 standalone (SIEMA — 83d gap, Coren — different city Abuja vs Lagos)
  - API: apps/api/src/routes/targets.js
    - GET /api/targets?year=2026&mode=edition|fiscal → summary + clusters (with totals) + standalone expos
    - PUT /api/targets/:expo_id → { method: "manual"|"auto", target_m2, target_revenue, percentage, notes }
    - POST /api/targets/seed?year=2026&percentage=15 → create clusters + seed auto targets
    - GET /api/targets/clusters?year=2026 → cluster list
    - GET /api/targets/previous/:expo_id → previous edition actuals
  - Dashboard: /targets — Target Tracker page
    - Edition/Fiscal mode toggle, year selector (2024/2025/2026)
    - 4 KPI cards: Target m², Actual m², Target Revenue, Actual Revenue (with progress bars)
    - ProgressRing component: compact ring (72px SVG) + side metrics layout. m² ALWAYS orange (#E67E22), revenue ALWAYS green (#2ECC71) — fixed colors regardless of percentage.
    - Cluster-grouped collapsible tables with expand/collapse chevron animation (7 clusters for 2026)
    - ClusterSummaryBar component: summary bars below tables with accent-tinted bg (rgba(200,169,122,0.06)) + left accent border. Gap indicator for remaining.
    - Individual expos (no cluster): each standalone expo rendered as mini-section (header + single-row table). No "Standalone Expos" group title. SIEMA sorted to top with accent border-left highlight.
    - Company grand total bar: accent border-left (3px) + slightly darker accent bg (rgba 0.1)
    - Edit modal: Auto (percentage + preview) or Manual (direct m²/€ input), previous edition info
    - Seed Auto Targets button (confirm modal → POST /api/targets/seed)
    - No-targets banner with generate button on first visit
    - Export: Copy Summary (text), Excel All (xlsx)
    - Progress colors: >80% green, 50-80% yellow, <50% red
    - Expo names link to /expos/detail
  - Dashboard permissions: "targets" module (CEO+Manager=true, Agent=false)
  - Nav: "Targets" after "Finance"
  - ROUTE_PERMISSIONS: /targets → targets

In Progress:

Pending:
- Phase 12c: CEO Notes with semantic recall
- Phase 13: Answer Quality (explainability)
- Phase 15: Learning & Feedback (CEO corrections, preference memory)
- Phase 16: Proactive Attention & Alerts (auto morning brief, threshold alerts)
- Phase 17: Action Layer Integration
- Phase 18: Organizational Memory
---
# 9. Coding Conventions
Use modern JavaScript.
Rules:
- Use async/await (no callbacks)
- All database queries go through packages/db
- Environment variables via dotenv
- Never hardcode credentials
- Use modular services
- Keep server.js minimal
- Business logic must be separated from routing
Package naming convention:
@eliza/api  
@eliza/db  
@eliza/zoho-sync  
@eliza/ai
---
# 10. Error Handling
Always use try/catch blocks.
Errors must include meaningful messages.
Never fail silently.
---
# 11. Security
Credentials must never be stored in code.
Use environment variables.
Access control implemented:
- CEO — full access, data_scope: all
- Manager — team data, data_scope: team
- Agent — own data, data_scope: own
- Auth: users tablosundan WhatsApp phone lookup
- Kullanıcılar: CEO (Nihat Suer AY), Elif AY (manager/team)

Dashboard Permissions (granular module access):
- Stored in: users.dashboard_permissions JSONB
- Modules: war_room, expo_directory, expo_detail, sales, finance, targets, logs, intelligence, system, users, settings
- CEO: all true (forced, cannot be changed)
- Manager default: war_room, expo_directory, expo_detail, sales, settings = true
- Agent default: sales, settings = true
- CEO can override defaults per user via /admin/users/[id]
- Enforcement:
  - Nav.js: filters nav links based on user.dashboard_permissions
  - _app.js AuthGuard: ROUTE_PERMISSIONS map, redirects to /unauthorized if permission === false
  - /unauthorized page: "Access Denied" with back link
- When adding new pages: add to ROUTE_PERMISSIONS in _app.js, NAV_ITEMS in Nav.js, DASHBOARD_MODULES in users/new.js, resolvePermissions defaults in users.js API
---
# 12. What NOT to do
Claude must not:
- write data back to Zoho
- hardcode credentials
- mix business logic into server.js
- introduce unnecessary frameworks
- build dashboard before API stability
- build WhatsApp bot before Phase 2
---
# 13. Zoho API Module Mapping

These are the real Zoho CRM API names. Always use API Name in code, never display name.

| Display Name    | API Name        | ELIZA Table   |
|-----------------|-----------------|---------------|
| Sales Contracts | Sales_Orders    | contracts     |
| Expenses        | Expensess       | expenses      |
| Expos           | Vendors         | expos         |
| Sales Agents    | Sales_Agents    | sales_agents  |
| Companies       | Accounts        | exhibitors    |
| Workqueue       | Workqueue__s    |               |
| Analytics       | Analytics       |               |
| Leads           | Leads           |               |
| Contacts        | Contacts        |               |
| Quotes          | Quotes          |               |
| SalesInbox      | SalesInbox      |               |
| Reports         | Reports         |               |
| Potentials      | Deals           |               |
| Tasks           | Tasks           |               |
| Meetings        | Events          |               |
| Calls           | Calls           |               |
| Products        | Products        |               |
| Purchase Orders | Purchase_Orders |               |
| Invoices        | Invoices        |               |
| Campaigns       | Campaigns       |               |
| Bodies/Expos    | Kurumlar        |               |
| Documents       | Documents       |               |
| Visits          | Visits          |               |
| Social          | Social          |               |
| Users           | users           |               |
| Google Ads      | Google_AdWords  |               |
| Product Groups  | Product_Groups  |               |
| Catalogues      | Catalogues      |               |
| Visitors        | Visitors        |               |
| Stand Leads     | B2Bs            |               |
| New Leads       | Leads1          |               |
| Revenues        | Payment_Audit   |               |
| My Jobs         | Approvals       |               |

Zoho region: Global
Base API URL: https://www.zohoapis.com/crm/v2
Auth URL: https://accounts.zoho.com/oauth/v2/token

Vendors (Expos) key fields:

| Field Label    | API Name          |
|----------------|-------------------|
| Vendor Name    | Vendor_Name       |
| Country        | Country1          |
| City           | City              |
| Start Date     | Baslangic_Tarihi  |
| End Date       | Bitis_Tarihi      |

Primary modules for ELIZA sync:
- Sales Contracts → Sales_Orders → contracts table
- Expenses → Expensess → expenses table
- Expos → Vendors → expos table
- Sales Agents → Sales_Agents → sales_agents table

## Sync Tracking
- contracts tablosu: created_at, updated_at (TIMESTAMP DEFAULT NOW())
- updated_at trigger: her UPDATE'de otomatik guncellenir
- sync_log tablosu: sync_type, module, started_at, completed_at, records_synced, status, error_message
- Scheduler: packages/zoho-sync/scheduler.js — node-cron ile her 15 dk incremental sync
- Baslatma: npm run sync:start (root)
- Sira: expos sync → contracts sync (contracts expo_id lookup'a bagimli)
- Migration: packages/db/migrations/004_sync_tracking.sql
---
# 14. Zoho Sales Contracts Field Mapping

Module API name: Sales_Orders

| Field Label              | API Name                  | Data Type              |
|--------------------------|---------------------------|------------------------|
| 1. Date/Amount/Type      | Date_Amount_Type          | Single Line            |
| 2. Date/Amount/Type      | Date_Amount_Type2         | Single Line            |
| 3. Date/Amount/Type      | Date_Amount_Type1         | Single Line            |
| 4. Date/Amount/Type      | Date_Amount_Type4         | Single Line            |
| 5. Date/Amount/Type      | Date_Amount_Type3         | Single Line            |
| 1st Payment              | st_Payment                | Currency               |
| 1st Payment Details      | st_Payment_Details        | Single Line            |
| 2nd Payment              | nd_Payment                | Currency               |
| 2nd Payment Details      | nd_Payment_Details        | Single Line            |
| Adjustment               | Adjustment                | Currency               |
| Advertising              | Advertising               | Pick List              |
| AF Number                | AF_Number                 | Single Line (Unique)   |
| Agent %                  | Agent                     | Percent                |
| Agent Com. Done          | Agent_Com_Done            | Boolean                |
| Agent Commission         | Agent_Comission           | Formula                |
| Agent Commission Paid    | Agent_Comission_Paid      | Currency               |
| Agent Commissions Note   | Agent_Comissions_Note     | Multi Line             |
| Agent Name               | Agent_Name                | Pick List              |
| Agent Registration Fee   | Agent_Registration_Fee    | Currency               |
| Badge                    | Badge                     | Boolean                |
| Balance                  | Balance                   | Formula                |
| Balance Details          | Balance_Details           | Single Line            |
| Balance.                 | Balance1                  | Formula                |
| Billing City             | Billing_City              | Single Line            |
| Billing Code             | Billing_Code              | Single Line            |
| Billing Country          | Billing_Country           | Single Line            |
| Billing State            | Billing_State             | Single Line            |
| Billing Street           | Billing_Street            | Single Line            |
| Boost Mail               | Boost_Mail                | Boolean                |
| BuildUp Rules Email      | BuildUp_Rules_Email       | Boolean                |
| Carrier                  | Carrier                   | Pick List              |
| Catalogue form mail      | Katalog_Formu_Maili       | Boolean                |
| Catalogue Page           | Catalogue_Page            | Lookup                 |
| Company Name             | Account_Name              | Lookup                 |
| Connected To             | Connected_To__s           | MultiModuleLookup      |
| Contact Name             | Contact_Name              | Lookup                 |
| Contract Date            | Contract_Date             | Date                   |
| Country of Company       | Country                   | Pick List              |
| Created By               | Created_By                | Single Line            |
| Currency                 | Currency                  | Pick List              |
| Customer No.             | Customer_No               | Single Line            |
| Description              | Description               | Multi Line             |
| Discount                 | Discount                  | Currency               |
| Due Date                 | Due_Date                  | Date                   |
| Exchange Rate            | Exchange_Rate             | Decimal                |
| Excise Duty              | Excise_Duty               | Currency               |
| Expo Date                | Expo_Date                 | Date                   |
| Expo Name                | Expo_Name                 | Lookup                 |
| Extra Freight Price      | Ektra_Navlun_Fiyati       | Currency               |
| Extra Service Mail       | Ek_Hizmetler_Maili        | Boolean                |
| Free M2                  | Free_M2                   | Number                 |
| Freight                  | Navlun                    | Decimal                |
| Grand Total              | Grand_Total               | Formula                |
| Internal Notification    | Announcement              | Boolean                |
| M2                       | M2                        | Number                 |
| Modified By              | Modified_By               | Single Line            |
| Navlun Hakedisi          | Navlun_Hakedisi           | Number                 |
| Net Total                | Net_Total                 | Formula                |
| Ordered Items            | Ordered_Items             | Subform                |
| Payment Done             | Payment_Done              | Boolean                |
| Payment Method           | Payment_Method            | Multiselect            |
| Payment Reminder         | Payment_Reminder          | Boolean                |
| Pending                  | Pending                   | Single Line            |
| Potential Name           | Deal_Name                 | Lookup                 |
| Purchase Order           | Purchase_Order            | Single Line            |
| Quote Name               | Quote_Name                | Lookup                 |
| Reason for Cancellation  | Reason_for_Cancellation   | Multi Line             |
| Received Payments        | Received_Payment          | Subform                |
| Registration Fee         | Registration_Fee          | Currency               |
| Remaining Payment        | Remaining_Payment         | Formula                |
| Sales Agent              | Sales_Agent               | Lookup                 |
| Sales Commission         | Sales_Commission          | Currency               |
| Sales Contract Owner     | Owner                     | Lookup                 |
| Sales Group              | Sales_Group               | Pick List              |
| Sales Type               | Sales_Type                | Pick List              |
| Scan Link                | Scan_Link                 | URL                    |
| SD %                     | SD                        | Percent                |
| SD Com. Done             | SD_Com_Done               | Boolean                |
| SD Commission            | SD_Comision               | Formula                |
| SD Commission Notes      | SD_Comision_Notes         | Multi Line             |
| SD Commission Paid       | SD_Comision_Paid          | Currency               |
| SD Commission Remaining  | SD_Remaining_Payment      | Formula                |
| Send Them All Now        | Hepsini_Hemen_Gonder      | Boolean                |
| Shipment Deadline        | Shipment_Deadline         | Boolean                |
| Shipment Volume          | Shipment_Volume           | Decimal                |
| Shipping City            | Shipping_City             | Single Line            |
| Shipping Code            | Shipping_Code             | Single Line            |
| Shipping Country         | Shipping_Country          | Single Line            |
| Shipping State           | Shipping_State            | Single Line            |
| Shipping Street          | Shipping_Street           | Single Line            |
| SO Number                | SO_Number                 | Long Integer           |
| SR %                     | SR                        | Percent                |
| SR Com. Done             | SR_Com_Done               | Boolean                |
| SR Commission            | SR_Prim_S                 | Formula                |
| SR Commission Notes      | SR_Comision_Notes         | Multi Line             |
| SR Commission Paid       | Prim                      | Currency               |
| SR Commission Remaining  | Prim_Remaining            | Formula                |
| Stand Design Link        | Stand_Design_Link         | URL                    |
| Stand Design Mail        | Stand_Cizimi_Mali         | Boolean                |
| Stand Type               | Stand_Type                | Pick List              |
| Status                   | Status                    | Pick List              |
| Sub Total                | Sub_Total                 | Formula                |
| Subject                  | Subject                   | Single Line            |
| Tag                      | Tag                       | Single Line            |
| Tax                      | Tax                       | Currency               |
| Terms and Conditions     | Terms_and_Conditions      | Multi Line             |
| Total M2                 | Total_M2                  | Formula                |
| Total Payment            | Total_Payment             | Formula                |
| Transportation           | Transportation            | Pick List              |
| Validity                 | Validity                  | Pick List              |
| Website                  | Website                   | Single Line            |
| Welcome Mail             | Hosgeldiniz_Maili         | Boolean                |

Primary fields for ELIZA sync:
- AF_Number → contracts.af_number
- Account_Name → contracts.company_name
- Country → contracts.country
- Sales_Agent → contracts.sales_agent
- Expo_Name → contracts.expo_id (lookup)
- Contract_Date → contracts.contract_date
- M2 → contracts.m2
- Grand_Total → contracts.revenue
- Status → contracts.status
- Sales_Type → contracts.sales_type
- Total_M2 → reference for pavilion calculations
---
# 15. War Room Dashboard

Location: apps/dashboard (Next.js)
Running on: http://localhost:3000

Pages:
- / → War Room main dashboard
- /expos?year=2026&expo=SIEMA&country=Morocco → Expo Directory (sortable, filterable, export: Copy/CSV/Excel/PDF)
- /expos/detail?name=SIEMA&year=2026 → Expo Detail (agents, companies, countries, monthly trend, export)
- /sales → Fiscal Sales (period filters, KPIs with change%, agent/expo/country tables, trend chart, export)
- /finance → Collections Cockpit (KPI cards, action list, aging chart, upcoming, expo/agent tables, drawer, export)
- /login → Login page (email/phone + password)
- /settings → User settings (change password, logout)

Navigation (all pages — unified via components/Nav.js):
- Order: War Room | Expo Directory | Sales | Finance | Targets | Logs | Intelligence | System | Users | Settings
- Active page highlighted with accent color
- Nav component: components/Nav.js (single source of truth)

Design System:
- CSS: styles/design-system.css (single source for all tokens, classes, responsive)
- No more per-page CSS variable declarations or duplicate styles
- Classes: .page, .page-hdr, .page-brand, .nav-link, .tbl, .summary-row, .summary-card, .btn, .btn-sm, .btn-primary, .btn-danger, .btn-success, .badge, .badge-success, .badge-danger, .input, .input-label, .section-title, .section-hdr, .loading, .export-bar, .export-feedback
- Responsive: @media (max-width: 768px) and @media (max-width: 480px) in design-system.css
- Page-specific styles: kept in <style jsx> blocks (not global)

Auth System:
- Login: /login → POST /api/auth/login → JWT token → localStorage
- Session: Bearer token in Authorization header
- AuthProvider: lib/auth.js wraps _app.js
- AuthGuard: redirects to /login if no token
- Password: bcrypt, min 6 chars
- Remember me: 30 day token vs 24h default
- CEO can set passwords via POST /api/auth/set-password
- Migration: packages/db/migrations/011_user_auth.sql (password_hash, last_login, dashboard_permissions)
- dashboard_permissions JSONB: { war_room, expo_directory, expo_detail, sales, finance, targets, logs, intelligence, system, users, settings }
- Initial CEO password: eliza2026 (change in production)

Expo Directory → Detail:
- Table rows clickable → navigates to /expos/detail?name=X&year=Y
- WhatsApp links can point to /expos/detail?name=X&year=Y

Sales → Expo Detail:
- Expo table rows clickable → navigates to /expos/detail?name=X&year=Y

API endpoints used:
- GET /api/revenue/summary → fiscal KPIs
- GET /api/revenue/edition-summary → edition KPIs (supports ?year=2026)
- GET /api/expos/metrics → upcoming expos (supports ?year=2026)
- GET /api/sales/leaderboard → top agents (always visible)
- GET /api/expos/detail?name=X&year=Y → expo summary (name, country, date, target, sold, revenue, progress, risk)
- GET /api/expos/detail/agents?name=X&year=Y → agent breakdown
- GET /api/expos/detail/companies?name=X&year=Y → company list
- GET /api/expos/detail/countries?name=X&year=Y → country distribution
- GET /api/expos/detail/monthly?name=X&year=Y → monthly sales trend
- GET /api/fiscal/summary?period=year → fiscal KPIs with change% (supports period=today/week/month/year or from+to)
- GET /api/fiscal/by-agent?period=year → agent performance for fiscal period
- GET /api/fiscal/by-expo?period=year → expo breakdown for fiscal period
- GET /api/fiscal/by-country?period=year → country breakdown for fiscal period
- GET /api/fiscal/trend?period=year&granularity=monthly → sales trend (daily/monthly)
- GET /api/finance/summary?mode=edition|fiscal → 8 finance KPIs (contract_value, collected, outstanding, overdue, due_next_30, collection_rate, at_risk, no_payment_count)
- GET /api/finance/action-list?mode&stage&risk&expo&agent&search&sort&order&limit&offset → outstanding_balances rows + suggested_action
- GET /api/finance/aging?mode=edition|fiscal → 6 aging buckets
- GET /api/finance/upcoming?days=30&mode → scheduled payments due within N days
- GET /api/finance/by-expo?mode → expo-level outstanding aggregates
- GET /api/finance/by-agent?mode → agent-level outstanding aggregates
- GET /api/finance/contract/:id/detail → single contract with payment schedule + actual payments
- GET /api/finance/recent-activity?limit=20 → recent payment events

Charts:
- Sales Leaderboard: horizontal bar chart (top 10) — always visible
- Expo Detail Monthly Sales: vertical bar chart (revenue/contracts toggle)
- Fiscal Sales Trend: vertical bar chart (revenue/contracts toggle, daily/monthly auto-select)
- Finance A/R Aging: vertical bar chart (6 color-coded buckets)

Finance Page (/finance):
- Collections Cockpit — default: Edition mode (upcoming expos)
- 8 KPI cards: Contract Value, Collected, Outstanding, Paid This Month, Due Next 30d, Deposit Rate, At-Risk, No Payment
  - KPI cards clickable: Outstanding→reset filters, At-Risk→risk:HIGH, No Payment→stage:no_payment, Due Next 30d→scroll to upcoming, Collected→scroll to recent payments, Paid This Month→scroll to recent payments
  - Paid This Month: SUM(contract_payments.amount_eur) this month, green, shows payment count + vs last month comparison
  - Deposit Rate: paid_eur > 0 contracts / total open contracts * 100, color-coded (green >70%, orange 40-70%, red <40%)
- Collection Action List: main table with stage/risk filter chips + company search
  - Split table sticky header: fixed header table + scrollable body table (540px max-height), matching colgroup widths, MutationObserver for theme-aware border color
  - Filter summary bar: "SHOWING X of Y | Balance: €X | Value: €X | Paid: €X" — updates on filter change
  - Stage filter chips: [All] [No Payment] [Pre-Event Open] [Partial Paid] — deposit_missing and overdue removed
  - Client-side filtering: stage, risk, multi-field search (company, AF, expo, agent, country)
  - Client-side sorting: all 11 columns sortable via th onClick (Number coercion for numeric cols)
  - Columns: Company, Expo, AF, Agent, Contract, Paid, Balance, Paid%, To Expo, Stage, Risk, Action — Overdue column removed (data always 0)
  - Default sort: total_risk_score DESC, default filter: All (no stage/risk pre-selected)
  - Fetches all records once (limit=500), no server-side filter re-fetch
  - Responsive: AF, Paid% columns hidden on mobile (<768px)
  - All suggested_action text in English
- Company detail drawer: 480px slide-in from right, contract info + payment schedule + received payments
- A/R Aging: shows "Aging requires due dates" placeholder when due_date not set in Zoho; chart renders when due dates available
- Upcoming Collections table (7d/14d/30d/60d toggle) — side by side with aging
- Expected Collections — Next 8 Weeks: weekly cash forecast table from contract_payment_schedule (synthetic 30% deposit + 70% pre-event)
  - Summary line: "Next 8 weeks: €X expected from Y payments"
  - Export: Copy/CSV/Excel
  - Note: "* Based on estimated payment schedule (30% deposit + 70% pre-event)"
- Outstanding by Expo + by Agent tables — side by side, sortable
- Recent Payments table (ORDER BY payment_date DESC — most recent first)
- Export: Copy/CSV/Excel per-table (exports use filtered+sorted data)
- Stage badge colors: no_payment (#C0392B), overdue (#E67E22), pre_event_balance_open (#D4A017), partial_paid (#4A9EBF)
- Risk badge colors: CRITICAL (#C0392B), HIGH (#E67E22), WATCH (#D4A017), OK (#2ECC71)
- Mode filter: edition (expo_start_date within 12 months) vs fiscal (contract_date current year)
- Currency conversion: contract_payments use Contract.Currency + Exchange_Rate to convert local payments to EUR
  - Zoho "X (€Y)" dual format → prefer EUR from parentheses
  - Plain amounts → divide by exchange_rate when currency != EUR
  - contract_payments columns: amount_eur (converted), amount_local (original), currency
  - Dashboard recent payments: dual display "€1.579 (NGN 2.625.000)" for non-EUR
  - Migration 016: amount_local + currency columns on contract_payments
- Collection stages simplified (migration 015): deposit_missing merged into no_payment, overdue kept in SQL but inactive (due_date NULL)
- Known data issue: contracts.due_date is NULL for all 244 open contracts (Zoho Due_Date field not populated)

Design:
- Design system: styles/design-system.css (single source of truth)
- Theme system: data-theme attribute on <html> — "dark" (default) or "light"
  - Dark: #080B10 bg, #0E1318 surface, #141B22 surface-2
  - Light: #F5F5F5 bg, #FFFFFF surface, #FAFAFA surface-2
- Accent color: --accent-color CSS custom property, 6 options (gold/blue/green/purple/red/teal)
- Table density: data-density attribute — "comfortable" (default) or "compact"
- Fonts: var(--font-mono) "DM Mono", var(--font-sans) "DM Sans"
- Animated KPI counters on load
- Risk Radar panel with hover tooltips
- All admin pages now responsive (mobile-friendly)

Settings Page (/settings):
- Profile: name, role, office (read-only cards)
- Appearance: theme toggle (dark/light), accent color (6 swatches), table density (comfortable/compact)
- Language & Region: language + timezone (timezone set via user_country in admin)
- Security: change password + logout
- Settings saved to users.settings JSONB column (migration 012)
- API: PUT /api/auth/settings — debounced save (500ms)
- Applied on login + page load via AuthProvider → applySettings()
- User-bound (not browser-bound) — same settings across all devices

Export:
- Per-table: Each table has own Copy/CSV/Excel buttons (export-btn-sm)
- Page-level: Copy All / CSV All / Excel All (multi-sheet) / PDF (multi-table)
- PDF only at page level (all tables in one document)
- Libraries: npm packages (jspdf, jspdf-autotable, xlsx) with dynamic import() — NO CDN loadScript

Sorting:
- Each table has independent sort state (agentSort, expoSort, countrySort)
- Numeric-safe sort: Number() coercion for PostgreSQL string-typed numbers
- Default: revenue_eur DESC (highest on top)
---
# 16. Reporting Logic

## Edition Mode
- View: edition_contracts → status IN ('Valid', 'Transferred In')
- Purpose: Expo performance — "How is this expo doing?"
- KPIs update based on Expo Radar toggle (Upcoming vs All 2026)

## Fiscal Mode
- View: fiscal_contracts → status IN ('Valid', 'Transferred Out')
- Purpose: Sales performance — "How are we performing as a company?"
- KPIs always show fiscal year 2026
---
# 17. Data Validation

- ELIZA verified against Zoho: 4,971 m² / €1,292,321.08 — exact match
- Cancelled contracts excluded from all War Room views
- Contracts without expo date in Zoho are excluded from Zoho reports but included in ELIZA — ELIZA is more accurate
---
# 18. Active Expo Definition

- Upcoming: start_date >= CURRENT_DATE AND <= CURRENT_DATE + 12 months
- All 2026: EXTRACT(YEAR FROM start_date) = 2026
---
# 19. War Room Toggles

- Edition Mode / Fiscal Mode (top level) — switches KPI source and visible sections
- Upcoming / All 2026 (Expo Radar section, edition mode only) — also updates edition KPIs
- Sales Leaderboard is always visible regardless of mode
---
# 20. Status Values (Zoho)

| Status          | Count |
|-----------------|-------|
| Valid           | 2,991 |
| Cancelled       |   462 |
| Transferred Out |    40 |
| Transferred In  |    17 |
| On Hold         |     6 |
---
# 21. AI Query Engine

Location: packages/ai/queryEngine.js
Endpoint: POST /api/ai/query
Input: { question: string }
Output: { question, intent, answer, data }

Architecture:
1. Semantic Frame Extraction → extractSemanticFrame() → { intent, entities, ambiguity_flags, answerability }
   - Router fast path (0 API cost) → keyword match → {intent, entities, confidence: 1.0}
   - Haiku fallback → FRAME_PROMPT → structured JSON frame → backward-compatible entities
2. Ambiguity Gate → unanswerable refuse, critical clarification, warning defaults
3. Query Builder → parameterized SQL
4. SQL Validator → SELECT only, whitelist tables, LIMIT 200
5. Answer Generator (Claude) → 1-3 sentence insight, no markdown

Supported intents (23):
- expo_progress: expo ilerleme durumu
- agent_performance: agent toplam satış
- agent_country_breakdown: agent ülke dağılımı
- agent_expo_breakdown: agent expo dağılımı
- expo_agent_breakdown: expodaki agent dağılımı
- expo_company_list: expodaki firma listesi
- country_count: expodaki ülke sayısı
- exhibitors_by_country: belirli ülkenin expo varlığı
- top_agents: en iyi agentlar
- expo_list: expo listesi (risk filtreli)
- monthly_trend: ay ay satış trendi
- cluster_performance: cluster bazlı performans
- payment_status: ödeme durumu (balance_eur, paid_eur aktif)
- rebooking_rate: tekrar katılım oranı
- price_per_m2: ortalama m2 fiyatı
- revenue_summary: yıllık gelir özeti
- days_to_event: etkinliğe kaç gün kaldı
- general_stats: genel istatistik
- compound: birden fazla soru (max 2)
- collection_summary: toplam alacak/tahsilat özeti (outstanding_balances view)
- collection_no_payment: hiç ödeme yapmayan firmalar listesi
- collection_expo: expo bazlı tahsilat durumu
- company_collection: firma bazlı borç/bakiye/ödeme sorgusu (company_name entity extraction)

Allowed tables: edition_contracts, fiscal_contracts, expos, contracts, expo_metrics, outstanding_balances
Forbidden: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE

Answer format rules:
- 1-3 sentences maximum
- No markdown, no headers, no ALL CAPS
- State key finding only
- Data table shown separately in UI
---
# 22. Risk Engine

Location: packages/ai/riskEngine.js
Endpoint: GET /api/expos/risk
Table: expo_metrics

Risk Model:
- progress_percent = sold_m2 / target_m2 * 100
- months_to_event = (start_date - today) / 30
- months_passed = today - sales_start_date (fallback: 12 - months_to_event)
- velocity = sold_m2 / months_passed (m²/month current pace)
- required_velocity = (target_m2 - sold_m2) / months_to_event (m²/month needed)
- velocity_ratio = velocity / required_velocity
  - > 1.2 → on track
  - 0.8–1.2 → OK
  - 0.5–0.8 → watch
  - < 0.5 → critical

Risk Scoring:
- velocity_ratio < 0.5 → +3
- velocity_ratio 0.5–0.8 → +2
- velocity_ratio 0.8–1.2 → +1
- country_count < 3 → +1
- agent_count < 2 → +1
- progress < 20% AND months_to_event < 6 → +2

Risk Levels: 0=SAFE, 1=OK, 2=WATCH, 3+=HIGH

sales_start_date = previous edition end_date (auto-calculated on sync)

# 23. Roadmap
Ana roadmap dosyası: docs/ROADMAP.md
Intelligence roadmap: docs/INTELLIGENCE_ROADMAP.md (v4 — north star + immediate plan)
Feature map: docs/ELIZA_FEATURE_MAP.md
System analysis: docs/SYSTEM_ANALYSIS.md
Current phase: All immediate plans completed, Phase 12c next
Completed: Intelligence Roadmap v4 Immediate Plan, Mini Clarification System, Admin Dashboard Upgrade, Navigation, ISSUE-019, ISSUE-020
Benchmark: 96% PASS (48/50)

# 24. Infrastructure & Environment
Repository: https://github.com/Nsueray/eliza (public, main branch)
Local: PostgreSQL localhost:5432/eliza, API port 3001
Production (Render):
  Dashboard: https://eliza.elanfairs.com (custom domain, eliza-dashboard.onrender.com)
  Domain: eliza.elanfairs.com (elanfairs.com — GoDaddy)
  API: https://eliza-api-8tkr.onrender.com
  Bot: https://eliza-bot-r1vx.onrender.com
  Database: Render PostgreSQL (eliza_73du)
Twilio: Sandbox kurulu, production number henuz alinmadi
Leena EMS: Bookmarkta mevcut, API entegrasyonu henuz yapilmadi
Liffy: Bookmarkta mevcut, API entegrasyonu henuz yapilmadi
Shadow Mode: Year 1 — sadece CEO kullaniyor, ekip haberdar degil

Render Deploy:
- Monorepo note: Render services with Root Directory (apps/api, apps/whatsapp-bot) don't auto-deploy when only packages/** files change
- Workaround: add version indicator to server.js health endpoints to force redeploy
- Include paths: apps/api/**, apps/whatsapp-bot/**, packages/** (must be configured in Render dashboard)

# 25. WhatsApp Bot
Location: apps/whatsapp-bot
Port: 3002
Status: Phase 8a tamamlandi
Baslatma: npm run dev:bot (root) veya npm run dev (whatsapp-bot icinden)
Dev mode: node --watch-path=src --watch-path=../../packages (otomatik restart)

Mimari:
- src/server.js — Express, POST /webhook (Twilio), TwiML XML response
- src/auth.js — telefon dogrulama (users tablosu, phone lookup)
- src/handler.js — mesaj routing, dil tespiti, CEO kisiligi, veri formatlama, message logging
- Dogrudan DB baglantisi: handler → queryEngine.js → packages/db → PostgreSQL
- HTTP API cagrisi YOK, fetch/axios YOK — tum sorgular dogrudan DB uzerinden

Dil Algilama:
- TR/EN/FR otomatik (kelime skorlama, default TR)
- Accent normalization: ç→c, ş→s, ü→u, ı→i, ö→o, ğ→g (input ve keyword'ler)
- Word boundary match (substring değil) — "madesign" içinde "des" artık eşleşmez
- Yanit dili sorulan dille ayni (TR soru → TR yanit, FR → FR, EN → EN)

Personality Engine:
- Location: packages/ai/personalityEngine.js
- users.nicknames: virgülle ayrılmış takma adlar (ör: "baba,babacım,babiş,patron")
- Migration: packages/db/migrations/007_nicknames.sql
- generateGreeting(user, lang) → rastgele nickname + saat bazlı selamlama
- generateClosing(user, lang, excludeNickname) → farklı nickname ile kapanış
- Greeting ve closing'de farklı nickname kullanılır
- Tüm kullanıcılar için aktif (sadece CEO değil)
- Nickname yoksa → user.name'in ilk kelimesi kullanılır
- handler.js: wrapWithPersonality() fonksiyonu (eski wrapForCeo kaldırıldı)

Komutlar:
- .brief — sabah brifingini getir
- .risk [expo] — risk raporu
- .attention — dikkat gerektiren konular
- .help — komut listesi

Veri Formatlama:
- Duz metin, tablo yok, markdown yok
- Etiketli: "SIEMA 2026 — Ülke: France — Tarih: 22-Eylül-2026 — Kontrat: 45 — m²: 1.234 — Gelir: €562.512"
- Tarihler: TR "19-Mayıs-2026", EN "May 19 2026", FR "19-mai-2026"
- Para dile gore: TR "€76.715", EN "€76,715", FR "76 715 €"
- Dashboard linki HER ZAMAN gösterilir (data sayısından bağımsız)
- data > 5 satır → "... ve X sonuç daha.\nTüm liste: URL"
- data <= 5 satır veya boş → cevabın sonuna "\n\n📊 URL" eklenir
- getDashboardLink null dönerse veya intent=clarification ise → link eklenmez
- getDashboardLink(intent, entities): expo intent'leri → /expos?year=YYYY, sales intent'leri → /sales
- Year dinamik: entities.year || currentYear (hardcoded 2026 kaldırıldı)
- Deep linking: expo_name → &expo=X, country → &country=X query params
- Expo intents (11): expo_progress, expo_list, expo_agent_breakdown, expo_company_list, cluster_performance, country_count, exhibitors_by_country, days_to_event, rebooking_rate, price_per_m2, payment_status
- Sales intents (7): top_agents, agent_performance, agent_country_breakdown, agent_expo_breakdown, monthly_trend, revenue_summary, general_stats

Expo Directory (/expos) Features:
- Query params: ?year=2026&expo=SIEMA&country=Morocco&agent=Elif → auto pre-fill search filter
- Export bar: Copy (clipboard tab-separated) | CSV | Excel | PDF
- Excel/PDF via npm packages (xlsx, jspdf, jspdf-autotable) with dynamic import()
- PDF: landscape, ELIZA branded header, date + filter info, dark header with gold text
- Satir arasi bos satir ile ayrilir
- Table rows clickable → navigates to Expo Detail page

Expo Detail (/expos/detail) Features:
- URL: /expos/detail?name=SIEMA&year=2026 (name ILIKE match)
- Summary cards: Revenue, Contracts, Sold m², Progress %
- Sub-info: Target m², Risk badge, Velocity m²/month
- Sales Agents table: sortable, revenue share % bar
- Exhibitors table: sortable, searchable (company/country/agent filter)
- Country Distribution table: sortable
- Monthly Sales chart: Chart.js bar (revenue/contracts toggle)
- Export: Copy (all 3 tables), CSV (sections), Excel (3 sheets: Agents/Exhibitors/Countries), PDF (multi-table, branded)
- Mobile responsive: 2x2 summary grid, horizontal scroll tables

# 26. Message Generator (Phase 6)
Location: packages/messages/index.js
Table: message_drafts, sales_agents.preferred_language
API: GET /api/messages/templates, POST /api/messages/generate, POST /api/messages/send

Sablonlar (4 tip, 3 dil — TR/EN/FR):
- agent_activation: Agent aktivasyon/düşük performans mesajı
- rebooking_request: Exhibitor'a yeni edisyon daveti
- payment_reminder: Ödeme hatırlatma
- meeting_prep: Toplantı öncesi expo özeti

Dil kurali:
- sales_agents.preferred_language alanından otomatik seçilir
- Elif → TR, Meriem → FR, diğerleri → EN

WhatsApp komutu:
- .msg [kişi] [konu] → taslak üret, CEO'ya göster
- CEO "gönder" → Twilio ile ilet, "iptal" → düşür
- 10 dakika içinde cevaplanmazsa otomatik expire
- Human-in-the-loop zorunlu: CEO onayı olmadan gönderilmez

Bağlam entegrasyonu:
- expo_metrics + edition_contracts verisiyle kişiselleştirilmiş mesaj
- Gerçek progress%, m², hedef verisi mesaja dahil edilir

# 26b. Message Logging System
Table: message_logs
Migration: packages/db/migrations/006_message_logs.sql
API: GET /api/logs (paginated), GET /api/logs/summary
Admin: /admin/logs

message_logs tablosu:
- user_phone, user_name, user_role
- message_text, response_text
- intent (AI sorgulari icin intent adi, komutlar icin "command:.brief" vb.)
- input_tokens, output_tokens, total_tokens
- model_intent (router/haiku), model_answer (sonnet)
- duration_ms
- is_command (boolean)
- error (hata varsa)
- created_at

Token tracking:
- queryEngine.js: extractIntent() ve generateAnswer() _usage objesi dondurur
- Router match → input/output: 0, model: 'router'
- Haiku fallback → gercek token usage
- Sonnet answer → gercek token usage
- handler.js: logMessage() her mesaj/komut icin DB'ye yazar (basarili ve hatali)
- response_text: wrapWithPersonality sonrası final response loglanır (kişilik dahil)

Admin Logs sayfasi (/admin/logs):
- Summary tab: 6 KPI cards (MSG/USR/TKN/DUR/ERR/CLR), Doughnut chart (router vs haiku), Bar chart (daily 30d), user/intent tables
- Messages tab: message cards with filters (user/intent/status/date_range), per-card Copy button ("Copied!" feedback, 2s)
- Plain text labels throughout (no emoji unicode escapes)

Intent Engine Notlari:
- "Elan Expo" = sirket adi, expo adi degil (intent prompt'a eklendi)
- expo_list intent'i year parametresini destekler
- Yetkisiz numaralar reddedilir
- WhatsApp 4000 karakter limiti korunur
- days_to_event: "kaç gün kaldı" / "how many days" / "combien de jours"
- Count sorularında metric:"count" → sadece cevap, liste yok
- rebooking_rate: edition_year bazlı + ülke desteği
- expo_company_list: GROUP BY ile duplicate firma önlenir
- price_per_m2: agent bazlı, m2>0 AND sales_agent IS NOT NULL filtresi

## AI Model Split
- Intent: Router (keyword, 0 API) → Haiku Semantic Frame fallback (fast, cheap, structured JSON)
- Answer: Sonnet (quality, CEO-friendly)
- Router: packages/ai/router.js — accent normalization, priority-ordered rules
- Semantic Frame: extractSemanticFrame() with FRAME_PROMPT — task types, ambiguity detection, answerability
- Env: AI_INTENT_MODEL, AI_ANSWER_MODEL

## Router Architecture
- 16 rules total (was 15, added: borcu/borcunu single keyword for company_collection)
- Accent normalization: è→e, ç→c, ü→u, ı→i, ş→s, ğ→g, ö→o
- Priority order: days_to_event → collection_summary → collection_no_payment → company_collection → collection_expo → payment_status → rebooking_rate → price_per_m2 → expo_progress → agent_performance → expo_agent_breakdown → monthly_trend → top_agents → agent_country_breakdown → agent_expo_breakdown → exhibitors_by_country → country_count → revenue_summary → expo_list
- Returns: { intent, entities, confidence: 1.0 }
- Entities: year, month, relative_days, expo_name, agent_name, country, metric, company_name
- Named month extraction: MONTH_NAMES map (FR: janvier..décembre, EN: january..december, TR: ocak..aralık)
- Company name extraction: Turkish suffix patterns (firması, borcu, şirketi) + year digit cleanup
- Ambiguity flags: missing_year, missing_metric, missing_expo (for clarification system)
- Relative time: "son 30 gün" → relative_days: 30, "bu hafta" → this_week
- Time+sözleşme: "bu hafta kaç sözleşme" → revenue_summary with period=this_week

## Sonnet System Prompt
"You are ELIZA, the CEO's personal business assistant for Elan Expo."
Key insight first, max 2-3 sentences, no markdown/bullets/headers, plain text only.
Out-of-scope → "I can only help with Elan Expo business data."
Empty results → "No data found for this query."
Claude must NOT generate SQL — all queries come from templates in buildQuery().
Terminology (rule 15 in prompt):
- TR: exhibitor→"katılımcı" (ASLA "sergici"), expo→"fuar" (ASLA "sergi"), revenue→"gelir" (ASLA "ciro")
- FR: exhibitor→"exposant", expo→"salon", revenue→"chiffre d'affaires"
- EN: standard terms (exhibitor, expo, revenue)

# 27. Multi-user System
Location: packages/db/migrations/005_users.sql
Tables: users, user_permissions
API: apps/api/src/routes/users.js
Admin Panel: apps/dashboard/pages/admin/

Roller: ceo / manager / agent
- ceo → data_scope: 'all' (override, değiştirilemez)
- manager → data_scope: default 'team'
- agent → data_scope: default 'own'

Eşleşme:
- users.sales_agent_name → contracts.sales_agent
- users.sales_group → Zoho Sales Group değerleri
- users.whatsapp_phone → WhatsApp auth (phone lookup)

WhatsApp Auth:
- Eski: hardcoded CEO_WHATSAPP_NUMBER .env → KALDIRILDI
- Yeni: users tablosundan phone lookup
- auth.js döndürdüğü obje: user.phone (user.whatsapp_phone DEĞİL)
- handler.js'te user.phone || user.whatsapp_phone kullanılır (logMessage + getHistory)
- Deaktive user → "Erişiminiz devre dışı bırakıldı"
- Kayıtsız numara → "Bu numara ELIZA sistemine kayıtlı değil"

Permission kontrolleri (handler.js):
- .note/.today → can_take_notes
- .msg → can_use_message_generator
- .expense → can_see_expenses

## Data Scope Enforcement (queryEngine.js)
Location: packages/ai/queryEngine.js → applyScope()
Flow: buildQuery() → applyScope(sql, params, intent, user) → validateSQL()

Scope rules:
- user null/undefined → no filter (backward compat — API route)
- data_scope=all → no filter (CEO)
- data_scope=own → sales_agent = user.sales_agent_name
- data_scope=team → sales_agent IN (SELECT sales_agent_name FROM users WHERE sales_group = $N)
- visible_years → EXTRACT(YEAR FROM date_col) = ANY(years)

Intent categories:
- NO_SCOPE: days_to_event (pure expo dates)
- NO_AGENT_FILTER: expo_progress, expo_list, expo_agent_breakdown, expo_company_list, country_count, exhibitors_by_country, cluster_performance, rebooking_rate, payment_status, company_search (year filter only)
- FULL_FILTER: agent_performance, agent_country_breakdown, agent_expo_breakdown, top_agents, monthly_trend, revenue_summary, general_stats, price_per_m2
- expo_metrics queries: no filter (no sales_agent column)

SQL injection:
- Post-processing: detects column aliases (c.sales_agent vs sales_agent)
- Injection point: before GROUP BY/ORDER BY/HAVING/LIMIT
- All values parameterized ($N placeholders)
- Compound intents: user passed to recursive calls

Handler integration: queryEngine.run(trimmed, 0, lang, user)

Admin Panel sayfaları:
- /admin → kullanıcı listesi (Users)
- /admin/logs → mesaj logları (redesigned: cards, filters, charts)
- /admin/intelligence → ELIZA Intelligence Panel (router rules, intent stats, benchmark, clarifications)
- /admin/system → System Status + Sync Dashboard (sync summary cards, manual sync, log table with export, auto-refresh 30s, services, DB tables, errors)
- /admin/users/new → yeni kullanıcı formu
- /admin/users/[id] → düzenleme formu
- /login → Login sayfası (email/phone + password, remember me)
- /settings → Kullanıcı ayarları (şifre değiştirme, logout)
- Navigation: Nav component (War Room | Expo Directory | Sales | Logs | Intelligence | System | Users | Settings)
- All admin pages now use design-system.css classes (responsive, mobile-friendly)

API endpoints (new):
- GET /api/intelligence/router-rules
- GET /api/intelligence/intent-stats?days=30
- GET /api/intelligence/benchmark
- GET /api/intelligence/clarification-stats?days=30
- GET /api/system/status
- GET /api/system/sync-status → { summary: { last_sync_at, last_sync_ago, records_today, is_active, total_syncs_today }, syncs: [...] }
- POST /api/system/sync-now?type=full|incremental → trigger manual sync
- GET /api/logs enhanced: ?status=error/clarification/success&date_range=today/yesterday/7d/30d
- POST /api/auth/login → { identifier, password, remember } → { token, user }
- GET /api/auth/me → { user } (token-based)
- POST /api/auth/change-password → { old_password, new_password }
- POST /api/auth/set-password → { user_id, password } (CEO only)

# 28. Benchmark
Dosya: docs/benchmark/questions.json (50 soru, 10 kategori)
Runner: node packages/ai/benchmark.js
Hedef: >= 90% PASS rate

Son sonuc: 46 PASS / 0 FAIL / 4 WARN — %92 (multi-turn clarification fix)

Intent synonym mapping (benchmark tolerance):
- exhibitors_by_country <-> country_count
- agent_performance <-> top_agents
- expo_progress <-> expo_list <-> days_to_event
- general_stats <-> revenue_summary, exhibitors_by_country, expo_list
- agent_country_breakdown <-> agent_performance, agent_expo_breakdown

WARN threshold: answer >= 450 chars borderline, > 600 too long

# 28. Known Issues
Dosya: docs/KNOWN_ISSUES.md
Kurallar:
- Her yeni bug bulunduğunda KNOWN_ISSUES.md'e ekle
- Fix edilince Status: FIXED + commit hash yaz
- Aynı bug 2+ kez çıkarsa Root cause mutlaka yaz
Fixed: ISSUE-001..031
ISSUE-016: applyScope team subquery sales_agents tablosunu kullanıyordu (sales_group yok) → users tablosuna düzeltildi
ISSUE-017: Dashboard link localhost:3000 → production URL (eliza.elanfairs.com)
ISSUE-018: Elif expo bazlı sorguları göremiyordu → NO_AGENT_FILTER intent listesi genişletildi
ISSUE-010: message_logs migration eksikti → 006_message_logs.sql oluşturuldu
ISSUE-011: logMessage response_text wrapForCeo öncesi raw answer kaydediyordu → final response loglanıyor
ISSUE-012: Dashboard admin sayfaları Türkçe idi → tüm UI İngilizce'ye çevrildi
ISSUE-014: "bu ay" sorgularında year filtresi eksikti → month varsa year=currentYear default
ISSUE-015: handler.js user.whatsapp_phone kullanıyordu ama auth.js user.phone döndürüyor → phone field mismatch düzeltildi
ISSUE-019: Hybrid SQL CEO-only kısıtlaması
ISSUE-020: Year filter eksik — expo/agent sorguları tüm yılların verisini döndürüyordu → run() seviyesinde year=currentYear default
ISSUE-021: Dashboard linkler hardcoded 2026, sadece 5 expo intent → getDashboardLink(intent, entities) dinamik year + 18 intent mapped
ISSUE-022: "entities is not defined" crash — handler.js'te entities destructure edilmemişti → düzeltildi
ISSUE-024: Clarification bugs (cancel→message draft, rewrite injecting context, SIEMA missing, LIMIT 15) + PDF export CDN failure → npm packages
ISSUE-025: Answer quality batch — fuzzy expo matching, country aliases (30+ countries + demonym stripping), skip expo clarification with time filters, Turkish detectLang words, rewrite bypass for general questions
ISSUE-026: Tüm yıllar loop (yearAlreadyResolved guard), bugün clarification (hasTimeScope in context ambiguity), iptal no pending (check draft first)
ISSUE-027: Compound expo queries — multi-metric questions ("kaç sözleşme, m2, geliri?") mapped to expo_progress not compound; parent entities inherited in sub-queries
ISSUE-028: Edition vs Fiscal inconsistency — revenue_summary + expo_name → expo_progress redirect (edition view for expo-specific queries)
ISSUE-029: Sticky header + WhatsApp collection intents (collection_summary, collection_no_payment, collection_expo)
ISSUE-030: SIEMA filter + summary numbers mismatch + alacag normalization
ISSUE-031: company_collection VALID_INTENTS missing (Haiku→general_stats), company_name year cleanup, FR month parse, bu hafta sozlesme, sticky header split table
ISSUE-032: price_per_m2 agent_name entity ignored — SQL had no agent WHERE filter → returned full 20-agent list instead of single agent result
ISSUE-033: Multi-year queries ("2025 ve 2026") returned only first year — extractEntities() used non-global regex, dropped second year. Phase 2 fix: buildYearFilter() helper generates SQL IN clause for multi-year, all intent handlers updated, default year logic skips when entities.years present
ISSUE-034: Router keyword gaps — agent_performance/expo_progress/price_per_m2/expo_agent_breakdown patterns missing; expo_company_list + company_search rules added; EXPO_BRANDS 11→24, AGENT_NAMES 10→14
ISSUE-035: Agent performance query triggers expo clarification — NO_EXPO_CLARIFICATION_INTENTS guard, multi-year guard, agent+year guard, conversation memory ALWAYS_INDEPENDENT agent+year pattern
ISSUE-036: Zoho sync broken — extra `}` in syncSalesOrders.js (commit 3130215) broke module loading, scheduler crashed silently. Also scheduler logged records_synced: 0 hardcoded. Fix: removed extra brace, syncSalesOrders returns stats, scheduler logs actual count. Render free tier auto-sleep risk noted.

Completed (cont. 7):
- Push Target Integration + target_progress WhatsApp Intent
  - packages/push/index.js: morning brief target progress eklendi
    - 120 gün içindeki fuarlar: actual_m2 / target_m2 (%pct) | €actual / €target
    - target_m2=0 → sadece actual_m2; targetResult boşsa plain expoResult'a fallback
  - packages/ai/router.js: target_progress rule (expo_progress'ten önce, 8 keyword pattern)
  - packages/ai/queryEngine.js: target_progress case handler
    - hasExpo: tek expo detayı (m2_progress, revenue_progress % hesaplanmış)
    - !hasExpo: year için tüm expo targets listesi (ORDER BY start_date)
    - VALID_INTENTS + validIntents + EXPO_INTENTS_NEED_YEAR + NO_AGENT_FILTER_INTENTS'e eklendi
    - INTENT_PROMPT: intent listesi + 5 örnek
  - apps/whatsapp-bot/src/handler.js: getDashboardLink target_progress → /targets

# 29. Conversation Memory (Phase 12)
Location: packages/ai/conversationMemory.js

## 12a: Conversation History
- getHistory(userPhone) → message_logs tablosundan son 5 mesaj (2 saat içinde)
- is_command=false filtresi (komutlar dahil değil)
- Chronological order (oldest first)
- Return: [{role: 'user', content}, {role: 'assistant', content}]

## 12b: Question Rewrite (Conservative)
- rewriteQuestion(currentQuestion, history) → Haiku ile follow-up soru → bağımsız soru
- History < 2 mesaj → rewrite yapılmaz (original döner)
- Hata durumunda sessizce original question kullanılır
- _usage bilgisi döndürülür (token tracking)
- Response truncation: 300 char max per history entry (prompt boyutunu küçük tut)
- Bilinen agent isimleri: Elif, Meriem, Emircan, Joanna, Amaka, Damilola, Sinerji, Anka
- History formatı: "User: soru\nAssistant: cevap" (hem soru hem cevap gider)
- Conservative rewrite: bağımsız soruları DEĞİŞTİRMEZ
  - Follow-up ipuçları (rewrite yap): "peki", "onun", "bunun", "ya", "ayrıca", "o fuar", eksik özne ("geliri?", "riski ne?")
  - Bağımsız ipuçları (rewrite YAPMA): kendi öznesi var ("Elif kaç satmış?"), genel soru ("en iyi satışçı kim?"), farklı entity
  - Örnek: History=SIEMA → "en iyi satışçı kim?" → DEĞİŞMEZ (bağımsız)
  - Örnek: History=SIEMA → "peki geliri?" → "SIEMA 2026 geliri ne kadar?" (follow-up)
  - Ranking/general questions ALWAYS independent: "en çok kim satmış?", "en iyi satışçı?", "toplam gelir?" → UNCHANGED even with history context

Handler integration (handler.js):
- Komutlar (.brief, .help vb.) rewrite'dan geçmez
- getHistory → rewriteQuestion → questionForEngine
- queryEngine.run(questionForEngine, 0, lang, user)
- logMessage'da message_text = orijinal trimmed (rewritten değil)
- Rewrite tokenları _usage.total_input/output'a eklenir
- Phone field: user.phone kullanılır (auth.js'ten), user.whatsapp_phone DEĞİL
- Self-reference: "ben/benim/bana" → user.sales_agent_name (handler.js'te regex replace)

# 30. Hybrid Text-to-SQL (Phase 14)
Location: packages/ai/queryEngine.js → generateSQL()
Trigger: intent === 'general_stats' AND entities boş (router + Haiku eşleşemedi)

Akış:
1. extractIntent → general_stats (empty entities)
2. generateSQL(question) → Sonnet SQL üretir
3. validateSQL → SELECT only, allowed tables, LIMIT
4. Safety: statement_timeout 3s, max 5 JOIN, NO_QUERY handling
5. query → data
6. generateAnswer → response

Fallback: SQL üretilemezse veya hata olursa → normal buildQuery(general_stats) akışına döner
intent_model: 'hybrid_sql' olarak loglanır
Token tracking: sqlGenUsage intent token'larına eklenir

# 31. Mini Clarification System
Location: queryEngine.js (detection + response), handler.js (pending state), auth.js (load state)
Migration: packages/db/migrations/009_pending_clarification.sql

Ambiguity flags (set by router.js extractEntities + Haiku INTENT_PROMPT):
- missing_year: expo_name present but no year → year clarification
- missing_metric: no metric keyword (m2/gelir/kontrat) → metric clarification
- missing_expo: expo-required intent but no expo name → expo clarification

Clarification slots (4 types, priority: year > expo > metric):
1. year: expo query without year, multiple editions exist → "Hangi edisyon? 1. 2026 2. 2025 ... N. Tüm yıllar"
2. expo: expo-required intent without expo → DB'den aktif fuarlar (resolved year'a göre filtrelenir) + "Genel" seçeneği (max 15+1)
3. metric: expo_agent_breakdown + expo_name + no metric → "Neye göre? 1. Gelir 2. m² 3. Sözleşme"
4. context: bağımsız soru + history'de expo var → DB'den tüm aktif fuarlar + "Genel" seçeneği (history expo en üstte)

Clarification flow:
1. extractSemanticFrame → entities with missing_* flags
2. queryEngine.run() merges resolvedEntities from handler (multi-turn slots)
3. Detects remaining missing_* flags BEFORE year defaults
4. Priority checks: year → expo → metric
5. handler.js checks context ambiguity AFTER queryEngine.run()
6. Return intent='clarification' with clarification object
7. handler.js saves pending state, next message resolves slot
8. handler passes resolvedSlots to queryEngine.run() as resolvedEntities parameter

resolvedEntities mechanism:
- queryEngine.run(question, depth, lang, user, resolvedEntities) — 5th parameter
- After extracting intent/entities, merges resolvedEntities into entities
- Resolves expo names from DB (not limited to EXPO_BRANDS) — prevents loop
- Removes corresponding missing_* flags for already-resolved slots
- year='all' → no year filter (Tüm yıllar seçimi)

Multi-turn resolve flow:
1. User picks option → resolved_slots'a ekle (expo_name, metric, year)
2. Rebuilt question = original_question + tüm resolved_slots
3. queryEngine.run(rebuilt, resolvedSlots) → entities'e resolved slots merge edilir
4. Kalan missing_* flags varsa → sıradaki clarification döner → yeni pending
5. Tüm flags çözüldüyse → cevap

Year resolve:
- Numara veya yıl → resolvedSlots.year = parseInt
- "hepsi"/"tümü"/"all"/"toplam"/"hep" → resolvedSlots.year = 'all' → no year filter
- "Tüm yıllar" seçeneği year clarification'da son seçenek olarak gösterilir
- options_en: "All years", options_fr: "Toutes les années"

Expo resolve: expo seçimi → resolvedSlots.expo_name, "Genel" → resolvedSlots.expo_general = true
Metric resolve: "1"→gelir, "2"→m2, "3"→kontrat
Active expo query: EXTRACT(YEAR FROM e.start_date) = resolved_year, GROUP BY name+year, LIMIT 30
Context expo query: EXTRACT(YEAR FROM e.start_date) = currentYear, GROUP BY name+year, LIMIT 30

Pending state:
- Stored in: users.pending_clarification JSONB
- Format: { original_question, original_intent, resolved_slots, pending_slot, options, created_at }
- resolved_slots accumulates across turns (e.g., { year: 2026, expo_name: "SIEMA 2026", metric: "gelir" })
- Expire: 10 minutes
- Clear on: successful resolution, expiry, unmatched reply (new question), or "iptal"/"cancel"
- Multi-turn: unlimited turns until all slots resolved, each turn resolves one slot
- Cancel: "iptal"/"cancel"/"annuler"/"vazgeç" clears pending → "Tamam, iptal edildi." (checked BEFORE CEO message approval)
- "Genel" selection: resolvedSlots.expo_general = true, appends "genel" keyword

YEAR_CLARIFICATION_INTENTS: expo_progress, expo_agent_breakdown, expo_company_list, country_count, price_per_m2, payment_status
Excluded from year clarification: rebooking_rate (cross-edition by nature), days_to_event, expo_list

Ambiguity flags cleaned up (deleted from entities) before buildQuery to prevent interference.

# currentDate
Today's date is 2026-03-14.
