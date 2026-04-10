# ADR-007: Floorplan Owned by LEENA, Consumed by LİFFY

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Architecture

---

## Context

Floorplans serve a dual purpose at Elan Expo:
1. **Before the sale** — show available stands to help agents prepare quotes (sales-facing)
2. **After the contract** — assign stands and manage operational logistics (ops-facing)

The question: who owns the floorplan? LİFFY (sales tool) or LEENA (ops tool)?

## Decision

**LEENA owns the floorplan.** LİFFY has read access to display availability during quoting.

The floorplan is fundamentally an operational asset — it defines the physical layout of the expo. Sales uses it as a reference, but operations creates it, maintains it, and makes the final stand assignments.

## Data Flow

```
LEENA creates/edits floorplan → ops.floorplans, ops.stands
LİFFY reads stand availability → displays in quote form
Agent creates quote with stand preference → sales.quotes
Yaprak approves contract in ELIZA → core.contracts
LEENA assigns stand to exhibitor → ops.stands.contract_id = X
```

## Why LEENA Not LİFFY

- Floorplan creation is an operational task (Yaprak's domain)
- Stand assignment happens after contract, not during quoting
- LİFFY only needs "what's available" — not the full floor plan editor
- Keeps LİFFY generic (SaaS compatible)

## Consequences

- LİFFY needs a read API for stand availability from LEENA's schema
- Quote form can show "preferred stand" but final assignment is in LEENA
- Floorplan changes in LEENA are immediately visible to LİFFY (shared DB)

## Related Decisions

- ADR-002 (SaaS preservation)
- ADR-010 (Floorplan integration depth — OPEN)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
