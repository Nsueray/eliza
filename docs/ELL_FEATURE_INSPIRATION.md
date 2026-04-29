# ELL Feature Inspiration

> Ideas collected from competitor analysis, internal discussions, and user feedback.
> Not committed to roadmap — this is a "someday maybe" pool.
> Items move to active roadmap only when prioritized in an ELL architecture session.
> Last updated: 2026-04-29

---

## Source: FairMaster Pro (competitor, April 2026)

### High Value — Adapt for ELL

| Idea | ELL System | Notes | Priority Estimate |
|------|-----------|-------|-------------------|
| WhatsApp + SMS bulk outreach | LİFFY | Campaign engine already has email. Add WhatsApp channel (Blueprint Phase 2) + SMS via Netgsm or Twilio. ELIZA already has WhatsApp bot — share infra. | Medium-term |
| B2B matchmaking (visitor interests ↔ exhibitor products) | LEENA | Match visitor registration data with exhibitor profiles. Auto-suggest "visit these stands." Requires exhibitor catalog + visitor interest tags. | Medium-term |
| Push notifications to attendees | LEENA (mobile) | Requires mobile app or PWA. "Seminar starts in 10 min", "VIP lounge open." Could sell notification slots to exhibitors as sponsorship. | Long-term |
| Decorator drawings + ISG (safety) approvals | LEENA | Floorplan natural extension. Exhibitor uploads custom stand design → project team reviews → safety approval workflow. Document upload + approval status tracking. | Medium-term |
| Pre-accounting (gelir-gider) | ELIZA | Basic income-expense tracking per expo. Every m² sold = revenue entry, every expense logged. Financial reports per expo. ELIZA already has expense sync from Zoho. | Medium-term |
| Credit card payment collection | LEENA | Online payment for exhibitor invoices or visitor tickets. Stripe/iyzico integration. | Long-term |
| Exhibitor catalog (digital product showcase) | LEENA | Exhibitors upload products/services. Visitors search/browse. Digital version of printed catalog. | Medium-term |
| B2B appointment system | LEENA | Visitors book meetings with exhibitors before the fair. Calendar integration per exhibitor stand. | Long-term |
| Personalized visitor panels (favorites, gift bag, event calendar) | LEENA | Visitor self-service portal. "My favorites", "My schedule", "Companies I want to visit." | Long-term |

### Low Priority — Note but Don't Plan

| Idea | Why Low Priority |
|------|-----------------|
| AR navigation + gamification | Very complex, requires mobile app + AR SDK. Cool but not core business value. |
| AI crisis management | Vague concept. ELIZA's alert system covers basic risk detection. |
| AI text writing for exhibitors | Nice-to-have. Exhibitors can use ChatGPT directly. Not a platform feature. |
| Mobile app (App Store / Google Play) | Huge investment. PWA may be sufficient. Evaluate after LEENA visitor portal. |

---

## Source: Internal Discussions (April 2026)

### Mining Autonomy (Suer)

| Idea | System | Notes |
|------|--------|-------|
| Autonomous mining pipeline | LİFFY (background worker) | Mining runs 24/7 without user interaction. Input: sector + country rules. Output: new leads auto-assigned to reps by country/sector. Bengü never sees mining UI — only sees "47 new leads found overnight" in Today screen. |
| Auto-assignment rules | LİFFY | Country = Nigeria → Jude's team. Sector = HVAC → Elif. Sector = Construction → Bengü. Default → unassigned pool (owner sees). Rules configurable by admin. |
| Auto-campaign after mining | LİFFY | Mined leads automatically enter a default sequence (sector-specific template, 3 steps, 8 days). No manual campaign creation needed. |

### Email Infrastructure (Suer)

| Idea | System | Notes |
|------|--------|-------|
| SendGrid → Amazon SES migration | LİFFY + LEENA | 250K emails/month. SES = ~$25/month vs SendGrid $100-300+. Requires building own webhook handlers, event tracking, bounce management. Target: Q4 2026. |

### Shared Infrastructure (Suer)

| Idea | System | Notes |
|------|--------|-------|
| Shared file storage (S3/Cloudinary) | ELL-wide | Expo logos, exhibitor logos, catalog images, floorplan backgrounds, banner images. Currently: LEENA uses Base64→DB, LİFFY has nothing, ELIZA has nothing. |
| ell-shared repo or config | ELL-wide | Shared docs (ELL_RULES.md, Glossary), sector lists, country lists, common config. Currently copied manually across 3 repos. |
| Render service consolidation | ELL-wide | 14 active services + 3 DBs. Merge workers into main services where possible. Evaluate Railway/Fly.io as Render alternative. |

### LİFFY Reboot Features (LİFFY chat + Suer)

| Idea | Notes |
|------|-------|
| T7 trigger: Engaged + has phone → "Call now" action | Action Engine extension. Person clicked/opened + phone number exists = priority call action. |
| T8 trigger: Engaged + no phone → auto-email asking for phone | Action Engine extension. System auto-sends "Can we call you?" email. |
| Portfolio dashboard | Firm count, contact count, active campaigns, reply rate, hot leads — single screen overview. |
| Discover wizard (single input) | Sector + country → system does everything (mine, verify, campaign, follow-up). One input box, zero operational steps. |
| Data entry forms | Add Company, Add Contact — simple forms for data entry team. Replace Zoho manual entry. Inline edit on contact detail page. Bulk paste from Excel. |
| Company-level view | Click a company → see all contacts, all campaigns, all history. Not person-centric but company-centric. Phase 2 (ADR-014). |
| Cold call tracking | Called, no answer, callback requested, interested, not interested. Log per person, visible in Timeline. |
| Similar companies in Context Cards | "Companies from same sector/country that participated" — Elif's Excel killer. |

---

## How to Use This File

1. When planning a new sprint, scan this list for relevant items
2. Move item to active roadmap (ELL_ROADMAP.md or system-specific roadmap) when committed
3. Add new ideas anytime — date them
4. Review quarterly — remove items that no longer make sense
