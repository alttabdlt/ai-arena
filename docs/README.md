# AI Arena Docs

This directory is the canonical documentation set for product, architecture, API, and economics.

## Current Documentation Mode

Status: `docs-locked / implementation-pending`

This doc set now describes the target launch economics and runtime transparency model that will be implemented next. When code and docs diverge during transition, this directory is the product/system target.

## Source of Truth Order

1. `docs/ARCHITECTURE.md`
2. `docs/ECONOMIC-DESIGN.md`
3. `docs/API.md`
4. `docs/IMPLEMENTATION-PLAN.md`
5. `docs/PRD-DEGEN-HUSTLE-LOOP-V1.md`
6. `docs/PUBLIC-RELEASE-CHECKLIST.md`

If another note conflicts with this set, this set wins.

## Product Position

AI Arena is an autonomous agent game on Monad:

- Primary gameplay: build/work/fight/trade loops with readable intent.
- Secondary gameplay: Wheel/poker escalation.
- UX requirement: behavior must be explainable in seconds.

## Economic Baseline (Target)

1. No implicit minting in runtime loops.
2. Every payout must debit an explicit budget bucket.
3. On-chain verified funding is the source for redeemable agent bankroll credits.
4. Runtime UI must show decision rationale and payout source.

## Documentation Status

- Active: `ARCHITECTURE.md`, `ECONOMIC-DESIGN.md`, `API.md`, `IMPLEMENTATION-PLAN.md`, `PRD-DEGEN-HUSTLE-LOOP-V1.md`
- Release aid: `PUBLIC-RELEASE-CHECKLIST.md`
- Archived at repo root: `HACKATHON-README.md`, `V2.md`
