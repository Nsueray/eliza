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
