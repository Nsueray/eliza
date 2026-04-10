# ADR-013: SaaS Priority Level

**Status:** OPEN
**Date:** 2026-04-10
**Category:** Strategy
**Blocks:** Ongoing architecture decisions

---

## Question

Is the multi-tenant SaaS potential of LİFFY and LEENA a near-term revenue goal or a long-term option to preserve?

## Options

| Option | Pros | Cons |
|--------|------|------|
| **Near-term goal (2026-2027)** | Revenue diversification, validates product-market fit early | Diverts development focus from Elan Expo's own needs |
| **Long-term option (2028+)** | Full focus on Elan Expo, SaaS readiness is just clean architecture | May never happen, architecture discipline may slip without urgency |
| **Not a goal, just good practice** | Simplest — keep systems clean but don't plan for external users | Less pressure on API design, but could accumulate Elan-specific debt |

## Why This Matters

This decision affects every architectural choice:
- If SaaS is near-term: LİFFY and LEENA need tenant isolation, billing, onboarding
- If SaaS is long-term option: clean API boundaries are enough, no multi-tenant infrastructure needed
- If not a goal: we can relax some constraints and move faster on Elan-specific features

## Suer's Notes

*(to be filled during discussion)*

## Decision

*(pending)*
