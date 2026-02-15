Original prompt: "yes, but are we able to implement build/work/fight > crypto loop for degens? and does the threejs animation motion wise able to show that too? and not ai slop?"

## 2026-02-14

- Initialized handoff log for this implementation pass.
- Plan:
  - Add deterministic `DEGEN_LOOP` mode to backend agent loop (build/work/fight/trade policy).
  - Expose API endpoints to toggle/query loop mode per agent.
  - Add frontend control bar for owned agent to toggle loop mode.
  - Split Three.js agent states so claim/build/work/trade/fight animate distinctly.
  - Run frontend validation via Playwright client and capture artifacts.

### Backend progress

- Added loop mode plumbing in `agentLoopService`:
  - New mode type: `DEFAULT | DEGEN_LOOP`.
  - Per-agent mode storage + setters/getters.
  - Deterministic degen policy function with priority order:
    `fight if selected` -> `complete/work/build/claim` -> `crypto rebalance`.
- Integrated degen policy into tick processing as a no-LLM decision path.
- Upgraded `play_arena` execution narrative to reflect real Wheel phase context.
- Added REST endpoints:
  - `POST /api/v1/agent-loop/mode/:agentId`
  - `GET /api/v1/agent-loop/mode/:agentId`

### Frontend progress

- Added `app/src/components/town/DegenControlBar.tsx`:
  - Loop mode toggle (`AUTO ON/OFF`).
  - One-shot nudges (`Build`, `Work`, `Fight`, `Trade`).
- Wired Town UI to backend mode API:
  - Read mode from `GET /agent-loop/mode/:agentId`.
  - Toggle via `POST /agent-loop/mode/:agentId`.
  - Force immediate response by posting `POST /agent-loop/tick/:agentId`.
- Added loop toggle to mobile top bar for parity.
- Extended state machine/motion vocabulary:
  - New activity states: `CLAIMING`, `WORKING`, `TRADING`, `FIGHTING`.
  - Backend action-to-state mapping now differentiates claim/work/trade/fight.
  - Added per-state movement handlers in `Town3D`.
  - Added distinct animation programs in `AgentDroid`.

### Follow-up fixes (this pass)

- Fixed a control bug where UI nudges were ignored while `DEGEN_LOOP` was enabled.
  - Added instruction parsing in backend deterministic path.
  - `DEGEN_LOOP` now consumes one-shot nudges (`build|work|fight|trade`) without falling back to LLM.
- Reduced "claim plot spam" by adding a bootstrap claim floor in `DEGEN_LOOP`.
  - New estimated claim-cost heuristic + bankroll buffer gate.
  - If bankroll is too thin, loop now prefers `buy_arena` or `rest` instead of forced `claim_plot`.
- Updated degen policy metadata:
  - Emits `DEGEN_LOOP_NUDGE` note when a nudge is consumed.

### Verification results

- `cd backend && npm run build` passed (`tsc` clean).
- `cd app && npm run build` passed (warnings only from third-party deps/chunk size).
- Runtime checks executed via Playwright browser context:
  - `Fight` nudge in `DEGEN_LOOP` produced `play_arena` with reasoning:
    `[AUTO] DEGEN loop nudge: force arena rotation this tick.`
  - `Build` nudge for a no-plot, low-bankroll degen produced `buy_arena` (bootstrap) instead of `claim_plot`.
  - Untargeted degen tick with low bankroll and no plots produced:
    `rest` + reasoning `[AUTO] DEGEN loop: skipping forced claim while bankroll is thin.`
  - `/town` reloaded with zero current console errors and API requests returning `200`.

### Notes

- The skill script `~/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js` could not run here because local `playwright` package install failed under restricted network (`ENOTFOUND registry.npmjs.org`).
- Used the built-in Playwright MCP tools as fallback for runtime validation.

### Planning follow-up (2026-02-14)

- Added product spec:
  - `docs/PRD-DEGEN-HUSTLE-LOOP-V1.md`
- Added ticket-ready week plan:
  - `docs/DEGEN-HUSTLE-WEEK1-EXECUTION.md`
- Updated docs index:
  - `docs/README.md` now lists both hustle-loop docs as canonical.

### Implementation pass (2026-02-14)

- Implemented selected-agent HUD legibility upgrades:
  - Added RESERVE stat card.
  - Added per-tick bankroll/reserve delta extraction from agent snapshots.
  - Added "Recent Outcomes" (last 3 action outcomes with deltas + reason snippets).
  - Files:
    - `app/src/pages/Town3D.tsx`
    - `app/src/components/town/DesktopAgentHudPanel.tsx`

- Implemented Degen control feedback states:
  - Added neutral/success/error status message line in control bar.
  - Wired status updates for loop toggle and one-shot nudges.
  - Files:
    - `app/src/components/town/DegenControlBar.tsx`
    - `app/src/pages/Town3D.tsx`

- Verification:
  - `cd backend && npm run build` passed.
  - `cd app && npm run build` passed (third-party warning noise unchanged).
  - Runtime checks via Playwright MCP:
    - HUD displays `RESERVE`, `Δ$A`, `ΔR`, and `RECENT OUTCOMES`.
    - Toggle click shows status line (`Switching to manual mode…`).
    - Fight nudge click shows status line (`Sending FIGHT nudge…`).
    - Console errors on `/town`: 0.

## 2026-02-15

### Frontend motion/perf hardening (Town3D)

- Reduced burst-FX texture churn:
  - `ActionBurstFx` now renders label sprites only for owned-agent bursts.
  - Non-owned bursts keep icon+ring FX but skip per-burst label texture allocation/disposal.
- Reduced rerender pressure from route/trail overlays:
  - `DestinationLine` updates throttled (~120ms cadence).
  - `AgentTrail` sample/update cadence throttled (~95ms), with reusable vector for sampling.
- Hardened canvas context-loss recovery:
  - Added explicit listener cleanup for `webglcontextlost/restored`.
  - On context loss, degrade visual settings first (`high->medium->low`, disable postFX).
  - Only remount canvas if context remains lost after a short grace window.

### Validation run notes

- `cd app && npm run build` passes.
- Cloudflare tunnel verified:
  - `https://thousand-explaining-timeline-existence.trycloudflare.com`
- Skill Playwright client (`web_game_playwright_client.js`) executed after wiring playwright resolution.
  - Output dir: `artifacts/web-game-20260215-pass2/`
  - Script canvas captures were black in this environment (known capture limitation for this page).
- Direct Playwright validation (headed Chromium) used for reliable scene/perf checks:
  - Screenshot: `artifacts/town-motion-pass2-tunnel.png`
  - Screenshot: `artifacts/town-motion-pass2-local.png`
  - Tunnel sample (120 frames): avg 8.6ms, p95 11.6ms, p99 66.7ms, ~116 FPS, context-lost logs: 1
  - Local sample (180 frames): avg 7.17ms, p95 8.4ms, p99 23.2ms, ~139 FPS, context-lost logs: 0

### LLM runtime check

- After user topped up credits, active agent ticks no longer show `AUTO-FALLBACK / 402` for current active agent states during this pass.

### Crew Wars implementation + HUD controls (2026-02-15)

- Backend Crew Wars runtime validation:
  - Applied migration to `backend/prisma/dev.db` with `npx prisma migrate deploy`.
  - Booted backend (`FAST_STARTUP=true npx tsx src/index.ts`) and confirmed routes up.
  - Smoked endpoints:
    - `POST /api/v1/crew-wars/sync` assigned active agents to crews.
    - `GET /api/v1/crew-wars/status` returned crews + mappings.
    - `POST /api/v1/crew-wars/orders` executed with `commandReceipt`.
    - `GET /api/v1/crew-wars/agent/:agentId` showed recent orders and status updates (`APPLIED` observed).

- New frontend Crew control surface and territory feedback:
  - Extended degen HUD with `Crew Orders` command deck (`Raid`, `Defend`, `Farm`, `Trade`).
  - Added `sendCrewOrder` client path to call `/api/v1/crew-wars/orders` and show status receipts inline.
  - Added crew-aware plot presentation:
    - Crew-color lot tinting.
    - Animated crew territory pulse ring/halo on owned plots.
    - Crew-color claimed marker + label tinting.
  - Added Crew Wars epoch toasts fed by `recentBattles` from `/crew-wars/status`.

- Files updated in this chunk:
  - `app/src/components/town/DegenControlBar.tsx`
  - `app/src/pages/Town3D.tsx`

- Verification:
  - `cd backend && npm run build` passed.
  - `cd app && npm run build` passed.
  - `cd backend && npm test` ran; current unrelated failures remain:
    - `src/services/__tests__/degen-staking-flow.integration.test.ts`
    - `src/services/__tests__/town-lifecycle.integration.test.ts`
  - Playwright-driven live checks:
    - Skill client artifacts:
      - `artifacts/web-game-crew-pass/`
      - `artifacts/web-game-crew-pass2/`
      - `artifacts/web-game-crew-pass3/`
    - Headless Chromium still intermittently black/limited due WebGL context constraints.
    - Headed Chromium validation (stable):
      - `artifacts/playwright-crew-live-owned/town-initial.png`
      - `artifacts/playwright-crew-live-owned/town-after-raid.png`
      - `artifacts/playwright-crew-live-owned/summary.json`
      - Confirmed visible + interactive: `DEGEN LOOP`, `Crew Orders`, `Raid`, crew badge, raid status line, and zero console errors in headed run.

### Backend test stabilization (2026-02-15)

- Fixed `town-lifecycle` integration failure by hardening small-treasury yield math in `TownService.distributeYield`:
  - Added a contributor floor for tiny payout ticks.
  - Added proportional remainder allocation to prevent full round-down to zero.
  - `recipients` now reflects actual paid recipients.
- Fixed `degen-staking` integration flake by making backer payout deterministic in `ArenaService.resolveMatch`:
  - Backer yield distribution now runs synchronously during match resolution.
  - On-chain recording remains async/best-effort.
- Validation:
  - `cd backend && npm test` → all passing (`12` files, `94` tests).

### Gameplay clarity pass (2026-02-15)

- Added deterministic action feasibility endpoint:
  - `GET /api/v1/agent-loop/plans/:agentId`
  - Returns plan status/reason for `build|work|fight|trade` to drive HUD gating.

- Upgraded DEGEN HUD guidance in `Town3D` + `DegenControlBar`:
  - Added live `NEXT MISSION` recommendation from loop telemetry + plan feasibility.
  - Added client-side blocker precheck before sending manual nudges.
  - Disabled blocked step buttons and surfaced blocker reasons in button tooltips/status.
  - Added in-HUD explainer block (`HOW THIS LOOP WORKS`) with plain-language step purpose.
  - Explicitly clarified: Telegram is optional; HUD alone can run the full loop.

- Rewrote onboarding quickstart messaging:
  - Clear action sequence: AUTO/manual controls + follow mission rail.
  - Telegram text changed to optional.
  - Added explicit 402/OpenRouter note: top up backend key credits, then restart backend.

- Verification:
  - `cd app && npx tsc --noEmit` passed.
  - `cd backend && npx tsc --noEmit` passed.
  - `cd backend && npm test` passed (`12` files, `94` tests).
  - `cd app && npm run build` passed (existing third-party bundle warnings only).
  - Playwright skill client run:
    - `artifacts/web-game-clarity-pass/shot-0.png`
    - `artifacts/web-game-clarity-pass/shot-1.png`
  - Seeded owned-agent screenshot validation (headed Chromium):
    - `artifacts/town-clarity-hud.png`
    - Confirms visible `NEXT MISSION`, `HOW THIS LOOP WORKS`, and `Telegram bot is optional` text in HUD.

- Runtime note:
  - One console error remains during automated load: a generic `404` resource miss (non-blocking; likely asset/favicon).

### OpenRouter spend guard (2026-02-15)

- Added explicit OpenRouter opt-in gate:
  - New config helper: `backend/src/config/llm.ts`
  - `OPENROUTER_ENABLED` now defaults to `false` when unset.
  - OpenRouter client initializes only when both:
    - `OPENROUTER_ENABLED=1`
    - `OPENROUTER_API_KEY` exists

- Applied guard across runtime spend paths:
  - `smartAiService` OpenRouter client init + model fallback away from OpenRouter when disabled.
  - `telegramBotService` NL router now skips OpenRouter unless enabled.
  - Startup auto-upgrade to `or-gemini-2.0-flash` now only runs when OpenRouter is actively enabled.
  - Agent spawn default model now chooses OpenRouter model only when OpenRouter is actively enabled.
  - `/api/v1/agent-loop/llm-status` now reports `OPENROUTER_DISABLED` when intentionally off.

- Validation:
  - `cd backend && npx tsc --noEmit` passed.
  - `cd backend && npm test` passed (`12` files, `94` tests).

### External agent secure onboarding + edge-case pass (2026-02-15)

- Added signed-claim onboarding/session service:
  - `backend/src/services/externalAgentAuthService.ts`
  - Ed25519 challenge/claim verification (`tweetnacl`)
  - One-time enrollment challenges with TTL
  - Access + refresh token session lifecycle with refresh rotation
  - Optional legacy API-key compatibility flags

- External API upgraded:
  - `POST /api/v1/external/join` now supports `authPubkey` and returns signed-claim onboarding metadata.
  - New `POST /api/v1/external/claim` exchanges signed challenge for access/refresh tokens.
  - New `POST /api/v1/external/session/refresh` rotates session tokens.
  - New `GET /api/v1/external/discovery` exposes machine-readable onboarding/auth contract.
  - Protected routes now accept bearer access tokens; legacy API key bearer auth remains optional via env.

- New env flags in `backend/.env.example`:
  - `EXTERNAL_REQUIRE_SIGNED_CLAIM`
  - `EXTERNAL_ALLOW_LEGACY_API_KEY_AUTH`
  - `EXTERNAL_JOIN_INCLUDE_API_KEY`
  - `EXTERNAL_ENROLLMENT_TTL_MS`
  - `EXTERNAL_ACCESS_TTL_MS`
  - `EXTERNAL_REFRESH_TTL_MS`

- Updated OpenClaw skill contract:
  - `backend/ai-town-skill/SKILL.md` now documents signed challenge onboarding (no raw API key required by default).

- Added automated edge-case tests:
  - `backend/src/services/externalAgentAuthService.test.ts`
  - Coverage includes multi-agent concurrent onboarding, invalid signature/mismatch, replay prevention, refresh rotation, and TTL expiry.

- Validation:
  - `cd backend && npx tsc --noEmit` passed.
  - `cd backend && npm test` passed (`13` files, `98` tests).
  - Live multi-agent onboarding edge-case script against running backend passed:
    - join without pubkey rejected in secure mode
    - two agents onboarded/claimed in parallel successfully
    - invalid signatures and pubkey mismatch rejected
    - replay claim rejected
    - refresh token rotation works; old refresh token rejected
    - invalid access token rejected

- OpenRouter burn control during E2E:
  - E2E backend run used `OPENROUTER_ENABLED=0`
  - Runtime logs confirmed OpenRouter was disabled throughout test and process was stopped after validation.

### External SDK helper pass (2026-02-15)

- Added Node SDK helper for external agent onboarding + auth lifecycle:
  - `backend/ai-town-skill/sdk/ai-town-external-client.mjs`
  - Supports:
    - keypair generation
    - `join -> sign challenge -> claim`
    - access token auth
    - automatic refresh-on-401 retry (single retry)
    - typed wrappers for `status/observe/events/act/pokerMove`

- Added multi-agent onboarding edge-case harness:
  - `backend/ai-town-skill/examples/multi-agent-onboarding-check.mjs`
  - Exercises:
    - discovery contract check
    - parallel onboarding for two agents
    - post-onboarding status check
    - refresh token rotation and old-token reuse rejection
    - invalid access token rejection

- Updated skill docs:
  - `backend/ai-town-skill/SKILL.md` now includes SDK helper usage and harness command.

### UX pass: spectator deploy + nav/streak clarity (2026-02-16)

- Implemented spectator-to-player recovery path:
  - Added `Sign In`/`Deploy Agent` and `Spectator → Player` CTAs in `DegenControlBar` when no owned agent.
  - Added `openDeployFlow` in `Town3D` to route unauthenticated users to onboarding and authenticated users to spawn overlay.
  - Added persistent top-bar CTA: `Sign In & Deploy` (or `Deploy Agent` when authenticated).
  - Added spectator strip under top nav with `Become a Player` button.

- Clarified momentum terminology:
  - Replaced ambiguous `HEAT/TILT xN` toast labels with `WIN STREAK/LOSS STREAK xN`.
  - Added explanatory chip/tooltips in top nav: `HEAT = loop momentum · STREAK = duel run`.
  - Updated compact heat chip text to `Heat xN`.

- Validation:
  - `cd app && npx tsc --noEmit` passed.
  - `cd app && npm run build` passed.
  - Playwright screenshot checks (`npx playwright screenshot`) captured:
    - `artifacts/town-spectator-final.png`
    - `artifacts/pw-after-restart.png`
  - DOM assertions via Playwright script after skip:
    - `Sign In & Deploy` present.
    - `Become a Player` present.
    - `Spectator → Player` present in degen control card.
    - No `TILT` string found in rendered text.

- Runtime note:
  - Vite dev server was initially serving stale transformed module for `DegenControlBar`; restarted frontend process and revalidated on fresh runtime.

### Phase 4 implementation chunk (2026-02-16)

- Added world-embedded readability indicators directly in `Town3D` scene render:
  - Agent intent stack above units (`doing -> target -> eta`).
  - Agent WHY/blocked line for owned/selected agents.
  - Destination endpoint marker + `TO <target>` label tied to route lines.
  - Building runtime badges above lots (`TASK/progress/eta` + occupant count/names).
  - Crew operation beacons in-world with active op + objective + active member count.
  - Live runtime feed banner rendered in-world near arena.
- Kept destination line visibility pinned for owned/selected agent even when crowd limit clips others.
- Validation (phase 4):
  - `cd app && npx tsc --noEmit` passed cleanly.
  - `cd app && npm run build` passed; only non-blocking Rollup warnings (`/*#__PURE__*/` annotations and chunk-size notice).
  - Scripted Playwright run completed:
    - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://localhost:8080/town --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --iterations 2 --pause-ms 300 --screenshot-dir artifacts/phase4-playwright`
    - Artifacts: `artifacts/phase4-playwright/runtime-indicators-full.png`, `artifacts/phase4-playwright/shot-0.png`, `artifacts/phase4-playwright/shot-1.png`.
  - Interactive runtime inspection confirmed all new in-game indicator groups render in live UI: `MY AGENT`, `CREW OPS`, `BUILDING OCCUPANCY`, `LIVE FEED`, `OTHER AGENTS`.
  - Runtime console note: transient `THREE.WebGLRenderer: Context Lost` observed during load, then scene recovered and rendered with indicators.
