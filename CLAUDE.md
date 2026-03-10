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
Group of expos held in the same city and period.
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
---
# 7. Database
Primary database: PostgreSQL
Key tables:
- expos
- contracts
- exhibitors
- expenses
- sales_agents
- alerts
- whatsapp_messages
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

Pending:
- Phase 6: Message Generator
- Phase 7: Risk Engine Expansion + Explainable AI
- Phase 8b: WhatsApp Planner Agent + Konuşma Hafızası
- Phase 9: Memory Layer + Pattern Detection
- Phase 10: Yeni Veri Kaynakları (Leena EMS, Liffy)
- Phase 11: Deploy & Production
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
Access control will later support:
- CEO
- Country Manager
- Sales Agent
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
- /expos?year=2026 → Expo Directory (sortable, filterable, mobile-friendly)

API endpoints used:
- GET /api/revenue/summary → fiscal KPIs
- GET /api/revenue/edition-summary → edition KPIs (supports ?year=2026)
- GET /api/expos/metrics → upcoming expos (supports ?year=2026)
- GET /api/sales/leaderboard → top agents (always visible)

Charts:
- Sales Leaderboard: horizontal bar chart (top 10) — always visible

Design:
- Dark theme: #080B10 background, #0E1318 surface
- Accent: #C8A97A gold
- Fonts: DM Mono (numbers/headers), DM Sans (labels)
- Animated KPI counters on load
- Risk Radar panel with hover tooltips
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
1. Intent Extraction (Claude) → { intent, entities }
2. Query Builder → parameterized SQL
3. SQL Validator → SELECT only, whitelist tables, LIMIT 200
4. Answer Generator (Claude) → 1-3 sentence insight, no markdown

Supported intents (18):
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
- payment_status: ödeme durumu (TODO: Balance1 field)
- rebooking_rate: tekrar katılım oranı
- price_per_m2: ortalama m2 fiyatı
- revenue_summary: yıllık gelir özeti
- general_stats: genel istatistik
- compound: birden fazla soru (max 2)

Allowed tables: edition_contracts, fiscal_contracts, expos, contracts, expo_metrics
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
Active TODO: docs/ELIZA_v2_TODO.md
Current phase: Phase 6 — Message Generator

# 24. Infrastructure & Environment
Repository: https://github.com/Nsueray/eliza (public, main branch)
Local: PostgreSQL localhost:5432/eliza, API port 3001
Deploy: Once local gelistirme, sonra Render (henuz deploy edilmedi)
Twilio: Sandbox kurulu, CEO_WHATSAPP .env'de tanimli
Leena EMS: Bookmarkta mevcut, API entegrasyonu henuz yapilmadi
Liffy: Bookmarkta mevcut, API entegrasyonu henuz yapilmadi
Shadow Mode: Year 1 — sadece CEO kullaniyor, ekip haberdar degil

# 25. WhatsApp Bot
Location: apps/whatsapp-bot
Port: 3002
Status: Phase 8a tamamlandi
Baslatma: npm run dev:bot (root) veya npm run dev (whatsapp-bot icinden)
Dev mode: node --watch-path=src --watch-path=../../packages (otomatik restart)

Mimari:
- src/server.js — Express, POST /webhook (Twilio), TwiML XML response
- src/auth.js — telefon dogrulama (CEO .env, agentlar sales_agents tablosu)
- src/handler.js — mesaj routing, dil tespiti, CEO kisiligi, veri formatlama
- Dogrudan DB baglantisi: handler → queryEngine.js → packages/db → PostgreSQL
- HTTP API cagrisi YOK, fetch/axios YOK — tum sorgular dogrudan DB uzerinden

Dil Algilama:
- TR/EN/FR otomatik (kelime skorlama, default TR)
- Yanit dili sorulan dille ayni (TR soru → TR yanit, FR → FR, EN → EN)

CEO Kisiligi:
- TR: "Selam Baba 👋" ... "Başka bir şey var mı Baba?"
- EN: "Hi Dad 👋" ... "Anything else Dad?"
- FR: "Bonjour Papa 👋" ... "Autre chose Papa?"
- Sadece CEO numarasindan gelen mesajlarda aktif

Komutlar:
- .brief — sabah brifingini getir
- .risk [expo] — risk raporu
- .attention — dikkat gerektiren konular
- .help — komut listesi

Veri Formatlama:
- Duz metin, tablo yok, markdown yok
- Etiketli: "SIEMA 2026 — Ülke: France — Tarih: 22-Eylül-2026 — Kontrat: 45 — m²: 1.234 — Gelir: €562.512"
- Tarihler tire ile: "19-Mayıs-2026" (WhatsApp auto-link onleme)
- Para dile gore: TR "€76.715", EN "€76,715", FR "76 715 €"
- Max 5 satir, fazlasi: "... ve X sonuç daha" + dashboard linki (localhost:3000/expos)
- Satir arasi bos satir ile ayrilir

Intent Engine Notlari:
- "Elan Expo" = sirket adi, expo adi degil (intent prompt'a eklendi)
- expo_list intent'i year parametresini destekler
- Yetkisiz numaralar reddedilir
- WhatsApp 4000 karakter limiti korunur
