# ELL Decision Journal

> Every decision, every reason, every alternative considered, every mistake made.
> This is the living memory of the ELL Platform project.

**Project:** ELL (ELIZA · LİFFY · LEENA) — Elan Expo Operating Platform
**Owner:** Suer Ay, CEO
**Started:** April 2026
**AI Partners:** Claude (architecture + strategy), Claude Code (implementation)

---

## How This Works

- Every significant decision gets an **ADR** (Architecture Decision Record)
- Each ADR is a separate file: `ADR-NNN-short-title.md`
- Status: `DECIDED` | `DEFERRED` | `REVERSED` | `SUPERSEDED` | `OPEN`
- Claude Code updates relevant ADRs when implementing changes
- When a decision is reversed, we DON'T delete — we mark as `REVERSED` with the reason

---

## Decision Registry

| # | Decision | Status | Date | Category |
|---|----------|--------|------|----------|
| 001 | [ELIZA is the commercial system of record](ADR-001-eliza-commercial-core.md) | DECIDED | 2026-04-10 | Architecture |
| 002 | [LİFFY and LEENA remain SaaS-ready](ADR-002-saas-preservation.md) | DECIDED | 2026-04-10 | Strategy |
| 003 | [Sales agents never create contracts](ADR-003-quote-contract-separation.md) | DECIDED | 2026-04-10 | Business Rule |
| 004 | [Shared database with schema-level ownership](ADR-004-shared-database.md) | DECIDED | 2026-04-10 | Architecture |
| 005 | [ELIZA writes authority data, not field data](ADR-005-eliza-write-policy.md) | DECIDED | 2026-04-10 | Architecture |
| 006 | [Transient agents access LİFFY only](ADR-006-agent-firewall.md) | DECIDED | 2026-04-10 | Security |
| 007 | [Floorplan owned by LEENA, consumed by LİFFY](ADR-007-floorplan-ownership.md) | DECIDED | 2026-04-10 | Architecture |
| 008 | [Zoho exit timeline](ADR-008-zoho-exit-timeline.md) | OPEN | 2026-04-10 | Strategy |
| 009 | [Sales team adoption strategy](ADR-009-sales-adoption.md) | OPEN | 2026-04-10 | Operations |
| 010 | [Floorplan integration depth](ADR-010-floorplan-integration-depth.md) | OPEN | 2026-04-10 | Architecture |
| 011 | [Payment authority scope](ADR-011-payment-authority.md) | OPEN | 2026-04-10 | Business Rule |
| 012 | [Historical data migration scope](ADR-012-historical-migration-scope.md) | OPEN | 2026-04-10 | Migration |
| 013 | [SaaS priority level](ADR-013-saas-priority.md) | OPEN | 2026-04-10 | Strategy |

---

## Pending Questions

Questions from ELL Architecture v2.1 that need answers before or during execution:

- [ ] **ADR-008:** Zoho exit — parallel operation vs hard cutover?
- [ ] **ADR-009:** LİFFY quote submission — replace Zoho immediately or run parallel?
- [ ] **ADR-010:** Floorplan in LİFFY — real-time availability or static list?
- [ ] **ADR-011:** Payment recording — who beyond Yaprak gets this permission?
- [ ] **ADR-012:** Zoho history — migrate all 10+ years or only 2024-2027?
- [ ] **ADR-013:** SaaS for LİFFY/LEENA — near-term revenue goal or long-term option?

---

## Mistake Log

When we make a wrong decision or discover a mistake, we record it here with what we learned.

| Date | What Happened | What We Learned | Related ADR |
|------|---------------|-----------------|-------------|
| *(none yet)* | | | |

---

## Claude Code Instructions

When you implement a change related to an existing ADR:
1. Add an entry to the `Implementation Notes` section of that ADR
2. Include: date, what was done, commit hash if available

When a decision needs to be made during implementation:
1. Create a new ADR file with status `DECIDED` or `OPEN`
2. Add it to the registry table in this INDEX.md
3. If it reverses a previous decision, mark the old one as `REVERSED`

When something goes wrong:
1. Add to the Mistake Log above
2. Update the relevant ADR with what was learned
