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
Messaging: WhatsApp via Twilio  
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
---
# 8. Current Development Phase
Phase 1 — Data Infrastructure

Focus only on:
- PostgreSQL schema
- Zoho Sync Engine
- Base API

**Current task: Bootstrap monorepo structure**

Do not start:
- dashboard development
- WhatsApp bot
- AI analytics
until the API and database are stable.
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

Primary modules for ELIZA sync:
- Sales Contracts → Sales_Orders → contracts table
- Expenses → Expensess → expenses table
- Expos → Vendors → expos table
- Sales Agents → Sales_Agents → sales_agents table
