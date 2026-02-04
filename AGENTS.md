# Repository Guidelines

## Project Structure & Module Organization
- `app/` — React + Vite (TypeScript) frontend, Tailwind, ESLint.
- `backend/` — Node/TypeScript GraphQL API, WebSocket server, Prisma.
- `contracts/` — Solidity contracts managed with Foundry (`forge`).
- `shared/` — Reusable TypeScript packages: `events/`, `logger/`, `types/`, `utils/`.
- Root scripts: `start-all.sh`, `stop-all.sh`. CI hooks use Husky + lint-staged.

## Build, Test, and Development Commands
- All services (macOS tabs): `./start-all.sh` (stops: `./stop-all.sh`).
- Frontend: `cd app && npm i && npm run dev` (build: `npm run build`, preview: `npm run preview`).
- Backend: `cd backend && npm i && npm run dev` (build/start: `npm run build && npm start`). Prisma: `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:studio`.
- Contracts: `cd contracts && forge build` (tests: `forge test`).
- Shared packages: `cd shared/<pkg> && npm i && npm run build`.
- Local deps: Postgres and Redis. Optionally: `cd backend && docker-compose up -d`.

## Coding Style & Naming Conventions
- TypeScript/TSX, 2-space indentation. Keep files small and cohesive.
- Formatting/linting via Prettier + ESLint; staged checks run `prettier --write`, `eslint --fix --max-warnings 0`, and `npx tsc --noEmit` (see `.lintstagedrc.json`).
- Naming: React components `PascalCase` (`Dashboard.tsx`), hooks `useX`, backend services `camelCase` files (e.g., `xpEconomyService.ts`).
- GraphQL: colocate `schema/` and `resolvers/` under `backend/src/graphql/`.

## Testing Guidelines
- Contracts: write Foundry tests in `contracts/test/*.t.sol`; run `forge test`.
- App/Backend: no unit test runner is configured. Ensure type checks and lint pass. If proposing tests, colocate under `src/**/__tests__` and discuss tool choice in the PR.

## Commit & Pull Request Guidelines
- Commits: imperative, concise, and scoped. Examples: “Fix TypeScript errors after queue removal”, “Refactor: split metaverse and arena backend”. Reference issues when applicable.
- PRs: clear description, rationale, and how to run. For UI changes, include screenshots; for schema changes, list affected queries/mutations and run `backend` schema commands (`npm run schema:validate`, `npm run schema:info`). Update docs/env samples when needed.

## Security & Configuration Tips
- Secrets: copy `backend/.env.example` to `backend/.env`; configure `app/.env` as needed. Do not commit secrets. Use `.env.solana.example` and `.env.devnet` as references.
- Dependencies: Postgres (5432) and Redis (6379) required. Start via Docker Compose or locally. Ensure Prisma migrations are applied before running the backend.

