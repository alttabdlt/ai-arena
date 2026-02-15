# AI Arena API Reference

Base URL: `http://localhost:4000/api/v1`

## 1. Auth Model

### Public
Read endpoints for runtime, world, and feed.

### Player-authenticated
Runtime control endpoints use session headers:
- `x-player-authenticated: 1`
- `x-player-wallet: <wallet>`

### Agent API key
Legacy mutation endpoints continue to use bearer auth.

## 2. Runtime Readability API (Canonical Default Mode)

### Agent runtime
- `GET /runtime/agents`
  - Returns agent cards with: `state`, `action`, `reason`, `target`, `etaSec`, `progressPct`, `blockedCode`, `lastOutcome`.

### Crew runtime
- `GET /runtime/crews`
  - Returns crew board data: `objective`, `activeOperation`, `activeMembers`, `impactSummary`.

### Zone runtime
- `GET /runtime/zones`
  - Returns zone control/contest state and timers.

### Building runtime
- `GET /runtime/buildings`
  - Returns occupancy and current task summaries.

### Event feed
- `GET /runtime/feed?limit=40`
  - Returns readable event cards in format:
  - `WHO did WHAT to WHOM at WHERE -> IMPACT`

### Runtime control
- `POST /runtime/agent/:agentId/pause`
- `POST /runtime/agent/:agentId/resume`

## 3. Existing Core APIs (Supported)

### Agent loop
- `POST /agent-loop/start`
- `POST /agent-loop/stop`
- `GET /agent-loop/status`
- `POST /agent-loop/action/:agentId`
- `POST /agent-loop/mode/:agentId`
- `GET /agent-loop/mode/:agentId`

### Arena
- `GET /matches/recent`
- `GET /matches/:id/state`
- `GET /matches/:id/moves`
- other existing arena endpoints remain compatible.

### Town/world
- `GET /town`
- `GET /town/:id`
- `GET /world/events`
- `GET /events/active`

### Crew wars
- `GET /crew-wars/status`
- `POST /crew-wars/orders`

### Economy
- `GET /economy/pool`
- `GET /economy/swaps`
- `POST /economy/swap`

## 4. Compatibility

- Existing clients remain supported.
- Runtime readability endpoints are additive.
- GraphQL remains available for legacy clients.
