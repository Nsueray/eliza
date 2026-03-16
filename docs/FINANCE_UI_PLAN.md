# ELIZA Finance UI Plan — Collections Cockpit
## Detailed Screen Specification
Version: v1.0 | Date: 2026-03-16
Source: ChatGPT CFO/CEO analysis + Claude review

---

## IMPLEMENTATION PHASES

### V1 — Must Have (Sprint 2)
- Mode toggle (Edition/Fiscal)
- 8 KPI cards (Contract Value, Collected, Outstanding, Overdue, Due Next 30d, Collection Rate, At-Risk, No Payment Yet)
- Collection Action List (main table) with full columns
- Filter chips (All, At Risk, Overdue, Due Soon, No Payment, Deposit Missing)
- Advanced filters (expo, agent, country, stage, risk, amount)
- Search (company, AF, expo, agent)
- Sort (risk → days to expo → balance)
- Pagination (25/50/100/200)
- A/R Aging (stacked bar + table)
- Upcoming Collections table
- Outstanding by Expo table
- Outstanding by Agent table
- Per-table export (Copy/CSV/Excel)
- Page-level export (Copy Summary/Excel All/PDF)
- Company detail drawer (right panel on row click)
- 2 charts: Aging distribution + Outstanding by Expo

### V2 — Nice to Have (Later)
- Quick signal strip (4 mini secondary KPIs)
- Finance Activity Feed (event stream with icons)
- Saved views / presets (CEO View, Overdue Focus, Forecast View)
- Bulk actions (checkbox + toplu reminder/export/WhatsApp)
- Sparklines in expo table
- Cash Inflow Forecast chart (real + synthetic, 8 week outlook)
- Expected vs Collected Cash chart (weekly/monthly)
- At-Risk by Stage donut chart
- "Create Brief" button (auto-generate WhatsApp summary)
- "Prepare Reminder" per-row workflow
- Advanced chart pack (5 charts)

---

## 1. PAGE STRUCTURE

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: ELIZA. FINANCE — Collections Cockpit                │
│ Nav: War Room | Expo Directory | Sales | Finance | ...      │
├─────────────────────────────────────────────────────────────┤
│ CONTROL BAR                                                 │
│ [Edition|Fiscal] [Upcoming|Month|30d|Quarter|Year|Custom]   │
│                          [Search] [Refresh] [Copy] [Export] │
├─────────────────────────────────────────────────────────────┤
│ KPI CARDS (8)                                               │
│ [Contract Value] [Collected] [Outstanding] [Overdue]        │
│ [Due 30d] [Collection Rate] [At-Risk] [No Payment]         │
├─────────────────────────────────────────────────────────────┤
│ COLLECTION ACTION LIST                                      │
│ Filter chips: [All] [At Risk] [Overdue] [Due Soon] ...     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Company | Expo | AF | Agent | Contract | Paid | Balance │ │
│ │ Paid% | Due | Overdue | Days to Expo | Stage | Risk    │ │
│ │ Action | Last Payment | Next Due                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Showing 50 of 214 contracts    [25|50|100|200]             │
├─────────────────────────────────────────────────────────────┤
│ A/R AGING          │  UPCOMING COLLECTIONS                  │
│ [stacked bar]      │  [7d|14d|30d|60d] toggle              │
│ [bucket table]     │  [Company|Expo|Due|Amount|Risk]        │
├─────────────────────────────────────────────────────────────┤
│ OUTSTANDING BY EXPO          │  OUTSTANDING BY AGENT        │
│ [Expo|Days|Value|Collected|  │  [Agent|Contracts|Value|     │
│  Outstanding|Rate|Critical]  │   Collected|Outstanding|%]   │
├─────────────────────────────────────────────────────────────┤
│ CHARTS ROW                                                  │
│ [Aging Distribution bar]  [Outstanding by Expo bar]         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. KPI CARDS DETAIL

### Card 1 — Contract Value
- Big number: €1,245,000
- Subtitle: Active contracts in scope
- Small: 128 contracts
- Click: action list → all active

### Card 2 — Collected
- Big number: €510,000
- Subtitle: Collected to date
- Small: 41.0% of contract value
- Click: recent payments

### Card 3 — Outstanding
- Big number: €735,000
- Subtitle: Open receivable
- Small: 91 companies
- Color: neutral but attention
- Click: action list → balance > 0

### Card 4 — Overdue
- Big number: €180,000
- Subtitle: Past due
- Small: 12 contracts
- Color: orange/red
- Click: action list → overdue

### Card 5 — Due Next 30 Days
- Big number: €145,000
- Subtitle: Scheduled due in 30 days
- Small: 18 payment items
- Click: upcoming collections

### Card 6 — Collection Rate
- Big number: 78%
- Subtitle: Collected / due-to-date
- Small: Healthy if above target
- Mini progress bar
- Click: formula tooltip

### Card 7 — At-Risk Receivable
- Big number: €220,000
- Subtitle: Needs action
- Small: High + critical exposure
- Color: red emphasis
- Click: action list → high/critical

### Card 8 — No Payment Yet
- Big number: 23
- Subtitle: Contracts with zero payment
- Small: 8 expos / 6 agents
- Click: stage = no_payment + deposit_missing

---

## 3. ACTION LIST COLUMNS

| # | Column | Align | Behavior |
|---|--------|-------|----------|
| 1 | Company | left | Bold name, country/type subtitle, click→drawer |
| 2 | Expo | left | Name + date subtitle, click→expo detail |
| 3 | AF Number | left | Copyable (click icon) |
| 4 | Agent | left | Click→filter by agent |
| 5 | Contract | right | EUR formatted |
| 6 | Paid | right | EUR formatted |
| 7 | Balance | right | EUR, darker if high |
| 8 | Paid % | right | Mini progress bar + % |
| 9 | Due Date | left | Red dot if overdue |
| 10 | Days Overdue | right | Color coded: 0=gray, 1-15=yellow, 16-30=orange, 30+=red |
| 11 | Days to Expo | right | <45=yellow, <15=red |
| 12 | Stage | center | Badge (colored) |
| 13 | Risk | center | Badge + score: CRITICAL (8) |
| 14 | Action | left | Action pill button |
| 15 | Last Payment | left | Date or — |
| 16 | Next Due | left | Date + amount: "15 Apr — €4,000" |

Default sort: Risk DESC → Days to Expo ASC → Balance DESC

---

## 4. COMPANY DETAIL DRAWER

Right-side panel on row click (don't navigate away).

Content:
1. Header: Company, AF, Expo, Agent, Risk badge, Stage badge
2. 4 mini cards: Contract total, Paid, Balance, Paid %
3. Payment Timeline (visual):
   - Contract signed → Deposit due → Payment received → Final due → Reminder sent
4. Planned Schedule table: installment, due date, amount, real/synthetic
5. Actual Payments table: date, amount, note
6. Actions: Copy summary, Prepare reminder, Open expo detail

---

## 5. A/R AGING

Horizontal stacked bar chart.
Buckets: Current | 1-7 | 8-15 | 16-30 | 31-60 | 60+
Each segment shows amount on hover.
Below: table with Bucket | Amount | Contracts | % of total.
Clickable: click segment → filter action list to that bucket.

---

## 6. EXPORT SPEC

### Page-level "Copy Summary" (one-click):
```
Collections Summary — 16 Mar 2026
Outstanding: €735,000
Overdue: €180,000
Due Next 30 Days: €145,000
Collection Rate: 78%
At-Risk: €220,000

Top risks:
1. Opak Makine — SIEMA — €18,000 — 34 days to expo — no payment
2. ABC Ltd — Mega Clima — €12,500 overdue 22 days
3. DEF Group — Madesign — €9,000 pre-event open
```

### Per-table: Copy/CSV/Excel
### Page-level: Excel All (6 sheets) / PDF (all tables + charts)

---

## 7. DESIGN

Same design-system.css tokens:
- Dark/light theme support
- DM Mono numbers, DM Sans labels
- Gold accent (#C8A97A) — or user's chosen accent
- Risk colors: CRITICAL=red, HIGH=orange, WATCH=yellow, OK=green
- Stage badges: colored per FINANCE_MODULE.md definitions
