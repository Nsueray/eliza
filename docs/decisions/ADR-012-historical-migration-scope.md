# ADR-012: Historical Data Migration Scope

**Status:** OPEN
**Date:** 2026-04-10
**Category:** Migration
**Blocks:** Phase 5 (Zoho decommission)

---

## Question

How far back should Zoho data be migrated? All 10+ years, or only active editions?

## Options

| Option | Pros | Cons |
|--------|------|------|
| **Full history (2014-2027)** | Complete business record, trend analysis across all years | Massive data volume, old records may have inconsistent formats |
| **Active only (2024-2027)** | Clean, manageable, relevant | Lose historical comparisons, rebooking history gaps |
| **Tiered (active hot, historical cold)** | Best of both — recent data in main tables, old data in archive | More complex schema, needs archive query path |

## Considerations

- ELIZA's current Zoho sync already has data from 2014+
- Fiscal year ≠ expo edition — historical data must preserve original fiscal assignments
- Contract statuses (Valid, Transferred In/Out, Cancelled, On Hold) must be migrated exactly
- Local currency payments stored as EUR must keep original currency + exchange rate
- Old records may use legacy fields (st_Payment, nd_Payment) that are discontinued

## Suer's Notes

*(to be filled during discussion)*

## Decision

*(pending)*
