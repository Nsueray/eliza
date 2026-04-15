# ADR-014: LİFFY Person-Centric Model — Known Limitation

**Status:** DECIDED
**Date:** 2026-04-15
**Decided by:** Suer Ay
**Category:** Architecture — Technical Debt

---

## Context

LİFFY's current data model is person-centric: `persons` table is the primary entity, `affiliations` links persons to companies. This was correct when LİFFY was a "mine emails + send campaigns" tool — at that stage, the person (email address) was the natural primary key.

However, Elan Expo's business model is company-centric: contracts are signed with **companies**, not persons. A contact (Ali bey) may work at Pepsi today and Red Bull tomorrow — but Pepsi's contract stays with Pepsi, not with Ali bey.

The ELL Glossary defines the correct model:
- **Company** = legal/commercial entity (contract is with the company)
- **Contact** = person at a company (may change companies)
- Contract → Company (not Contact)
- Quote → Company + Contact (company is the party, contact is the communication point)

## Decision

**Accept the limitation for now. Fix in Phase 2 (Quote + Shared DB migration).**

LİFFY's current person-centric model works for Phase 1 (mine → campaign → action screen). Bengü doesn't need Company as a first-class entity yet — she's working with email contacts, not writing quotes.

When Phase 2 begins (Quote creation, ELIZA shared DB):
1. Create `companies` table as first-class entity (per ELL Glossary)
2. Create `contacts` table (replacing `persons`)
3. Migrate `persons` → `contacts`, `affiliations` → `contacts.company_id`
4. Quote and Opportunity reference `company_id`, not `person_id`

## Risk If Not Fixed

- Quote written to a person, person leaves company → quote orphaned
- Same company, different contacts → system treats as unrelated
- Company-level reporting (revenue per company, rebooking history) impossible without Company entity
- ELIZA's contracts table uses `company_name` — joining with LİFFY's person-based data is fragile

## Why Not Fix Now

- 26,000+ persons in production — migration is risky
- Bengü is using the system daily for campaigns — breaking changes disrupt her
- Action Screen, Contact Drawer, Sequence Engine all work with persons — refactoring all of these is weeks of work
- Phase 2 (Quote) is the natural trigger — that's when Company becomes essential

## Consequences

- All new features built on `persons` table — accept this for Phase 1
- When Phase 2 starts, first task is Company entity migration before Quote implementation
- LİFFY chat must be aware: don't build Quote features on `person_id` — wait for `company_id`

## Related Decisions

- ADR-004 (Shared database — companies will be in core schema)
- ADR-010 (Floorplan Phase 2-3 — same timeline)
- ELL Glossary (Company and Contact definitions)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
