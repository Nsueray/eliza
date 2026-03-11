# ELIZA SYSTEM ARCHITECTURE

Version: v2.0
System Owner: Elan Expo
System Name: ELIZA (Elan Expo Intelligent Assistant)

---

# 1. Overview

ELIZA is a CEO decision support system for Elan Expo.

ELIZA consolidates operational, sales, and financial data from Zoho CRM into a centralized intelligence platform.

The system provides:

- War Room dashboard
- AI-powered analytics
- Messaging interface (WhatsApp / Telegram)
- Automated alerts
- Natural language queries

Zoho remains the operational source system.
ELIZA functions as the intelligence and analytics layer.

---

# 2. Data Ownership

Zoho CRM = operational source of truth.

ELIZA maintains a synchronized mirror database used for:

- analytics
- AI queries
- executive dashboards
- messaging integrations

Principle:

Zoho = operational system
ELIZA = intelligence layer

ELIZA does not write back to Zoho.

---

# 3. System Architecture

Zoho CRM
↓
Zoho Sync Engine
↓
ELIZA Database (PostgreSQL)
↓
API Layer
↓
Applications

Applications:

- War Room Dashboard
- AI Assistant
- WhatsApp Bot
- Telegram Bot
- Alerts Engine

---

# 4. Core Components

## 4.1 Zoho Sync Engine

Purpose: synchronize Zoho CRM data into ELIZA database.

Sync method:

- initial full sync
- incremental sync every 10–15 minutes

Modules synced:

Sales Contracts → Sales_Orders
Expos → Vendors
Expenses → Expenses

Unique contract identifier:

AF_Number

---

## 4.2 ELIZA Database

Database: PostgreSQL

Key tables:

### expos

Stores all exhibition editions.

Fields:

id
name
country
city
start_date
end_date
edition_year
cluster
target_m2

---

### contracts

Stores all exhibitor contracts.

Fields:

id
af_number
expo_id
company_name
country
sales_agent
m2
revenue
currency
exchange_rate
revenue_eur
contract_date
sales_type

Notes:

- af_number is unique
- expo_id references expos(id)

Currency normalization:

revenue_eur is calculated during sync:

EUR → revenue
Other currency → revenue / exchange_rate

---

### exhibitors

Participating companies.

Fields:

id
company_name
country
industry

---

### expenses

Expo operational costs.

Fields:

id
expo_id
category
amount
currency
source
created_at

---

### sales_agents

Salespeople and agencies.

Fields:

id
name
office
phone_number
role

---

### alerts

System generated alerts.

Fields:

id
alert_type
description
expo_id
severity
created_at

---

### whatsapp_messages

Incoming WhatsApp messages.

Fields:

id
sender_phone
message_text
parsed_data
created_at

---

### message_logs

Complete message exchange logs with token tracking.

Fields:

id
user_phone
user_name
user_role
message_text
response_text
intent
tables_used
input_tokens
output_tokens
total_tokens
model_intent
model_answer
duration_ms
is_command
error
created_at

---

# 5. War Room Dashboard

Main panels:

## Expo Radar

Displays health of each expo.

Metrics:

expo_name
country
start_date
contracts
total_m2
target_m2
total_revenue_eur
risk_level

Risk calculated using:

sales_progress = total_m2 / target_m2

---

## Sales Performance

Sales leaderboard.

Metrics:

sales_agent
contracts
total_m2
revenue_eur

---

## Financial Pulse

Financial overview.

Metrics:

revenue_eur
outstanding_balance
expenses

---

# 6. AI Query Engine

Location: packages/ai/queryEngine.js
Endpoint: POST /api/ai/query

## Architecture

0. Conversation Memory — getHistory (last 5 msgs/2hrs) → rewriteQuestion via Haiku (follow-up → self-contained)
1. Intent Extraction — Router (keyword, 0 API) → Haiku fallback → intent + entities
2. Entity Defaults — month without year → default to current year
3. Query Builder — builds parameterized SQL from intent + entities
4. Scope Enforcement — applyScope(sql, params, intent, user) → data_scope + visible_years filtering
5. SQL Validator — SELECT only, allowed tables, auto LIMIT 200
6. Data Execution — runs query via packages/db
7. Answer Generator — Sonnet produces 1-3 sentence insight
8. Personality Engine — time-aware greeting + closing with nicknames

Token tracking: extractIntent() and generateAnswer() return _usage objects.
All messages logged to message_logs table via handler.js logMessage().

## Supported Intents (19 + compound)

| Intent | Description |
|--------|-------------|
| expo_progress | Expo target progress |
| agent_performance | Agent sales totals |
| agent_country_breakdown | Agent's country distribution |
| agent_expo_breakdown | Agent's expo distribution |
| expo_agent_breakdown | Agents within an expo |
| expo_company_list | Companies at an expo |
| country_count | Country count at expo |
| exhibitors_by_country | Country's expo presence |
| top_agents | Top performing agents |
| expo_list | Expo list (risk filter) |
| monthly_trend | Month-by-month sales |
| cluster_performance | Geographic cluster stats |
| payment_status | Contract payment info |
| rebooking_rate | Repeat exhibitor rate |
| price_per_m2 | Average price per m² |
| revenue_summary | Revenue by year |
| days_to_event | Days until expo start |
| general_stats | Overall statistics |
| compound | Multiple questions (max 2) |

## Security

Allowed tables: expos, contracts, edition_contracts, fiscal_contracts
Forbidden keywords: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC

---

# 7. Currency Normalization

Contracts may use different currencies:

EUR
MAD
NGN
USD
KES

ELIZA converts all revenue to EUR.

Formula:

revenue_eur = revenue / exchange_rate

When currency = EUR:

revenue_eur = revenue

This allows cross-expo comparison.

---

# 8. Messaging Integration

ELIZA supports:

- WhatsApp
- Telegram

Use cases:

Queries:

"How many exhibitors does SIEMA have?"

Expense entry:

"Paid 5000 EUR for SIEMA venue."

---

# 9. Security

User roles:

CEO
Country Manager
Sales Agent

Access rules:

CEO → full access
Country Manager → country scope
Sales Agent → personal scope

Authentication via phone number for messaging.

---

# 10. Technology Stack

Backend: Node.js + Express
Database: PostgreSQL
Frontend: Next.js
Messaging: Twilio WhatsApp API
AI: Claude (Anthropic)

Repository:

monorepo
repo name: eliza

---

# 11. Development Phases

Phase 1 — Data Infrastructure ✔ COMPLETE

- PostgreSQL schema
- Zoho Sync Engine
- Contract + Expo linking
- Currency normalization
- Database views (edition_contracts, fiscal_contracts)

Phase 2 — War Room Dashboard ✔ COMPLETE

- Expo Radar with progress tracking
- Sales Leaderboard
- Financial KPIs (Edition/Fiscal modes)
- Ask ELIZA floating chat panel

Phase 3 — AI Query Engine ✔ COMPLETE

- Intent extraction (18 intents)
- Parameterized query builder
- SQL validation layer
- Compound question support
- Concise answer generation

Phase 3b — Risk Engine ✔ COMPLETE

- Velocity model, risk scoring, War Room panel

Phase 4 — Attention Engine ✔ COMPLETE

- CEO dikkat takibi, attention_log

Phase 5 — Alert Generator + Morning Brief ✔ COMPLETE

- Payment watch, dedup, scheduler, Twilio

Phase 6 — Message Generator ✔ COMPLETE

- 4 şablon, 3 dil, .msg komutu, human-in-the-loop

Phase 8a — WhatsApp Bot ✔ COMPLETE

- Twilio webhook, auth, AI query, CEO kişiliği

Multi-user System ✔ COMPLETE

- users + user_permissions, roller: ceo/manager/agent
- Admin Panel (/admin)

Message Logging System ✔ COMPLETE

- message_logs tablosu, token tracking, /admin/logs

Phase 11 — Deploy ✔ COMPLETE

- Render (3 servis + PostgreSQL cloud)
- Custom domain: eliza.elanfairs.com

Personality Engine ✔ COMPLETE

- Nicknames, time-aware greetings/closings, all users

Data Scope Enforcement ✔ COMPLETE

- applyScope() in queryEngine, user-level filtering

Language Detection Fix ✔ COMPLETE

- Accent-insensitive, word boundary matching

Phase 12a+12b — Conversation Memory ✔ COMPLETE

- getHistory, rewriteQuestion via Haiku, entity carry-forward

Phase 12c — CEO Notes (pending)
Phase 13 — Answer Quality (pending)
Phase 14 — Hybrid Text-to-SQL (pending)

---

# ELIZA

Named after Eliz Ada Ay.

ELIZA is the intelligence layer for Elan Expo operations.
