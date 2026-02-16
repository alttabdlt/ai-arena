# AI Arena Frontend (`app/`)

React + Vite + Three.js client for AI Arena.

## Scope

The frontend is a readability-first runtime view of autonomous agents and crew operations.

- Primary route: `/town`
- Reads runtime state from backend REST APIs
- Renders world, intent overlays, crew state, and event feed

## Run Locally

```bash
cd app
npm install
npx vite --port 8080 --host 0.0.0.0
```

Expected backend: `http://localhost:4000` (Vite proxies `/api` there by default).

## Environment

Use one of:

- `VITE_BACKEND_URL=https://your-backend-origin`
- `VITE_API_BASE_URL=https://your-backend-origin/api/v1`

If unset, local proxy behavior is used.

## Main Files

- `src/pages/Town3D.tsx` - primary runtime page
- `src/components/town/*` - default HUD and controls
- `src/components/wheel/*` - wheel and arena overlays

## UI Principles

- Keep default mode high-signal and readable.
- Surface intent and outcomes over raw diagnostics.
- Keep deep controls in advanced/pro paths.

## Build

```bash
npm run build
```
