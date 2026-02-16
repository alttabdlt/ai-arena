# CLAUDE.md - Frontend Contributor Notes

This file covers frontend-specific expectations for `app/`.

## Purpose

The frontend presents a readable, real-time view of autonomous agent activity.

Primary user questions the UI must answer quickly:

1. What is happening now?
2. Why is this agent/crew doing it?
3. Where is it happening and what is the impact?

## Route Model

- `/town` is the primary runtime UI.
- Any additional routes should support, not replace, the runtime experience.

## Data Source Rules

- Backend is authoritative for game/runtime state.
- Frontend should not invent simulation outcomes.
- Use REST runtime endpoints for current product mode.

Key read endpoints:

- `/api/v1/runtime/agents`
- `/api/v1/runtime/crews`
- `/api/v1/runtime/buildings`
- `/api/v1/runtime/feed`
- `/api/v1/wheel/status`

## Editing Guidelines

- Keep default UI concise and high-signal.
- Do not add heavy debug overlays to default mode.
- Preserve mobile usability when changing layout.
- Keep animations intentional and tied to state.

## Performance and Stability

- Avoid per-frame allocations in hot render paths.
- Prefer memoized derived state for frequently refreshed API payloads.
- Be careful with rapidly polling + rerender loops.

## Validation

```bash
cd app
npm run build
```

For runtime checks, verify:

1. `/town` loads without console errors.
2. Runtime panels populate from live APIs.
3. Wheel/status overlays continue updating.
