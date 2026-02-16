# Public Release Checklist

Use this checklist before making the repository publicly visible.

## 1. Documentation

- [ ] Root `README.md` reflects current product direction and startup commands.
- [ ] Root `CLAUDE.md` is aligned with current architecture and API behavior.
- [ ] `app/README.md` and `app/CLAUDE.md` match the actual `/town` UX.
- [ ] Canonical docs in `docs/` are consistent (`API`, `ARCHITECTURE`, `IMPLEMENTATION-PLAN`).
- [ ] Archived docs are explicitly marked superseded.

## 2. Security and Secrets

- [ ] No private keys, API keys, or signed tokens are committed.
- [ ] `.env` examples contain placeholders only.
- [ ] Wallet addresses in docs are intentional public values.
- [ ] Any generated artifacts containing sensitive payloads are removed.

## 3. Runtime Sanity

- [ ] Backend boots with `FAST_STARTUP=true`.
- [ ] Frontend boots and `/town` renders without hard errors.
- [ ] `POST /api/v1/agent-loop/start` works and tick advances.
- [ ] Runtime endpoints return valid payloads (`/runtime/agents`, `/runtime/feed`).
- [ ] Wheel status endpoint responds (`/wheel/status`).

## 4. Public API Readiness

- [ ] External agent discovery endpoint is healthy (`/external/discovery`).
- [ ] Funding flow docs match current implementation (`/agents/:id/fund`).
- [ ] Deprecated/legacy endpoints are either documented as legacy or removed from docs.

## 5. Repository Hygiene

- [ ] Remove temporary debug dumps, local recordings, and one-off scripts not meant for public.
- [ ] Confirm `git status` only contains intentional changes.
- [ ] Keep commit messages scoped and clear.

## 6. Final Review

- [ ] Run a final docs pass for consistency and typos.
- [ ] Ensure product narrative is consistent: Ops Warfare primary, poker secondary.
- [ ] Prepare a concise public project summary for the repo description.
