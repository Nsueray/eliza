# ADR-012: Historical Data Migration Scope

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Migration

---

## Question

How far back should Zoho data be migrated?

## Decision

**Full history — all data from 2014 to 2027 must be migrated. Historical data is used in daily operations.**

## Rationale

Suer actively uses historical data in daily work — rebooking analysis, trend comparison, agent performance over years. Cutting off at 2024 would lose critical business context.

## Migration Rules

These business rules MUST be preserved during migration:

1. **Fiscal year ≠ expo edition** — sales happen 1-2 years before the expo. Historical contracts must keep their original fiscal year assignment, not be recalculated.

2. **Contract statuses** — Valid, Transferred In, Transferred Out, Cancelled, On Hold must be migrated exactly as-is.

3. **Currency records** — local currency payments (NGN, MAD) historically stored as EUR in Zoho must be migrated with:
   - Original local currency amount (if available)
   - Zoho's exchange rate at time of entry
   - EUR equivalent

4. **Legacy fields** — `st_Payment`, `nd_Payment`, `Date_Amount_Type1-5` are cancelled pre-2025 fields. These should be migrated to the new `payment_schedules` / `payments` structure but flagged as legacy.

5. **Data validation** — every migrated record must be checksum-verified against Zoho source. Run comparison reports before declaring migration complete.

## Risk

This is the highest-risk phase (Phase 5 in migration plan). Mitigation:
- Never delete from Zoho until ELIZA data is verified
- Dual-read period: ELIZA reports compared against Zoho reports for same queries
- Tiered approach: migrate 2024-2027 first (active), then 2020-2023, then 2014-2019

## Consequences

- Large data volume — 10+ years of contracts, payments, companies
- Old records may have inconsistent formats — need data cleaning scripts
- Migration scripts must handle legacy field mappings
- Full migration may take weeks of validation, not days

## Related Decisions

- ADR-008 (Zoho exit timeline)
- ADR-001 (ELIZA as commercial core)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
