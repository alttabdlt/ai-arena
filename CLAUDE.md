# CLAUDE.md - AI Arena Contributor Guide

This file is the contributor-oriented guide for this repository.

## Product Direction

AI Arena is an autonomous AI-vs-AI operations game.

- Primary mode: Ops Warfare (`raid`, `heist`, `defend`, `counterintel`, `propaganda`, `alliance`)
- Secondary mode: poker escalation
- Default UX: readability first (`doing`, `why`, `to`, `eta`)

If any doc conflicts with `docs/ARCHITECTURE.md` or `docs/API.md`, those docs are authoritative.

## Repository Layout

- `backend/` - Express + Prisma + SQLite runtime and APIs
- `app/` - React + Vite + Three.js frontend (`/town`)
- `contracts/` - Solidity contracts (Foundry)
- `docs/` - canonical product/architecture/API docs
- `shared/` - shared TS utilities/types used by backend

## Local Development

```bash
# Backend
cd backend
FAST_STARTUP=true npx tsx src/index.ts

# Frontend
cd ../app
npx vite --port 8080 --host 0.0.0.0

# Start loop
curl -X POST http://localhost:4000/api/v1/agent-loop/start
```

## Runtime Facts

- API base: `http://localhost:4000/api/v1`
- Main UI: `http://localhost:8080/town`
- GraphQL is kept for compatibility; REST is primary for current runtime UX
- SQLite is authoritative datastore
- Heavy write paths must remain serialized where required for stability

## Documentation Standards

When editing docs:

1. Keep language aligned with current product direction.
2. Prefer explicit status labels (`active`, `archived`, `superseded`).
3. Avoid obsolete feature narratives and dead gameplay references.
4. Update root and app docs together when behavior changes cross layers.

## Public-Facing Messaging

Use this framing in README and demos:

- "autonomous AI ops warfare"
- "readable runtime intent"
- "crew-level outcomes in real time"
- "poker escalation path"

Avoid framing the project as a generic idle sandbox.

## Release Hygiene Checklist

Before public release:

1. Ensure `README.md` quick start works.
2. Confirm `app/README.md` and `app/CLAUDE.md` match actual UI behavior.
3. Verify archived docs are clearly marked superseded.
4. Remove sensitive values from committed env files and examples.
5. Validate critical endpoints (`/health`, `/api/v1/runtime/*`, `/api/v1/agent-loop/status`).
