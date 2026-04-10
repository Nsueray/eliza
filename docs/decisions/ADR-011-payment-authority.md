# ADR-011: Payment Authority Scope

**Status:** DECIDED
**Date:** 2026-04-10
**Decided by:** Suer Ay
**Category:** Business Rule

---

## Question

Who beyond Yaprak should have payment recording permissions?

## Decision

**Granular permission system. CEO + Yaprak have full authority. Local offices get form-based limited entry. Suer decides all permission assignments.**

### Permission Tiers

| Role | Create Payment | Edit Payment | Delete Payment | View All | View Own |
|------|---------------|-------------|---------------|----------|----------|
| CEO (Suer) | Yes | Yes | Yes | Yes | Yes |
| Project Manager (Yaprak) | Yes | Yes | Yes | Yes | Yes |
| Country Manager / Local Accountant | Yes (form only) | No | No | Country only | Country only |
| Sales Agent | No | No | No | No | No |

### How Local Offices Record Payments

Current Zoho model preserved: local offices (Nigeria, Morocco, Kenya) use a **restricted online form** that pushes payment records to ELIZA. They:
- CAN record new incoming payments (amount, date, method, currency)
- CANNOT edit or delete existing payment records
- CANNOT see other countries' payments
- CANNOT access the full ELIZA payment interface

This prevents local staff from seeing sensitive data, editing history, or deleting records — while still allowing local payment collection in NGN, MAD, KES etc.

### Key Principle

Permission assignments are NOT hardcoded — Suer decides who gets what access. The system must support flexible, granular permission configuration.

## Consequences

- Need a restricted payment entry form (similar to current Zoho form) for local offices
- Currency handling must support NGN, MAD, KES with EUR conversion
- All payment entries (regardless of source) are audit-logged
- Permission management UI needed in ELIZA for Suer to configure roles

## Related Decisions

- ADR-003 (Quote-contract separation — same authority principle)
- ADR-006 (Agent firewall)

## Implementation Notes

*(Claude Code: add entries here when implementing)*
