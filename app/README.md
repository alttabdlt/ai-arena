# Frontend (app)

React + Vite + Three.js frontend for AI Arena.

## Product Mode

Default mode is now readability-first AI Turf Wars HUD:
- clear agent intent (`doing`, `why`, `to`, `eta`)
- crew objective visibility
- readable event feed

Advanced controls remain available via Pro Mode.

## Local Development

```bash
cd app
npm install
npx vite --port 8080 --host 0.0.0.0
```

Backend expected at `http://localhost:4000` via Vite `/api` proxy.

## Key UI Integration Points

- `src/pages/Town3D.tsx`
- `src/components/town/*`
- `src/components/game/*` (default runtime HUD components)

## Notes

- Keep default UI minimal and high-signal.
- Put verbose diagnostics in Pro Mode.
