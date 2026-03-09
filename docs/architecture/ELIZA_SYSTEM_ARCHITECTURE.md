# ELIZA SYSTEM ARCHITECTURE

Version: v1.2
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

# 6. Analytics Layer

Metrics are calculated from contracts table.

Example query:

SELECT
e.name,
COUNT(c.id) AS contracts,
SUM(c.m2) AS total_m2,
SUM(c.revenue_eur) AS revenue_eur
FROM contracts c
JOIN expos e ON c.expo_id = e.id
GROUP BY e.name;

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
AI: OpenAI or Claude

Repository:

monorepo
repo name: eliza

---

# 11. Development Phases

Phase 1 — Data Infrastructure ✔

- PostgreSQL schema
- Zoho Sync Engine
- Contract + Expo linking
- Currency normalization

Phase 2 — Analytics

- Expo metrics
- Sales metrics
- Revenue metrics

Phase 3 — War Room

- dashboard API
- UI

Phase 4 — AI

- natural language queries

Phase 5 — Messaging

- WhatsApp bot
- expense ingestion

---

# ELIZA

Named after Eliz Ada Ay.

ELIZA is the intelligence layer for Elan Expo operations.
