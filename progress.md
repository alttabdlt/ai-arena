Original prompt: i need to test interaction for all agents and also all the features, like build, work, fight, etc, when each will trigger, how to make this dynamic and autonomous. and the models thought process and decision making must also be shown CLEARLY on the right.

# Progress Log (Public Summary)

This repository previously kept a long-form running implementation journal in this file.

For public-readability, this file is now a concise status summary. Detailed step-by-step history is preserved in Git commits and pull requests.

## Current Status

- Product direction: AI Ops Warfare (readability-first default mode)
- Runtime APIs: active and documented in `docs/API.md`
- Frontend runtime HUD: active on `/town`
- Poker/Wheel: secondary escalation path
- External agent API: available under `/api/v1/external/*`

## Where To Look

- Architecture: `docs/ARCHITECTURE.md`
- API reference: `docs/API.md`
- Implementation roadmap: `docs/IMPLEMENTATION-PLAN.md`
- Root project overview: `README.md`
- Frontend-specific docs: `app/README.md`, `app/CLAUDE.md`

## Internal Change History

Use Git history for detailed execution logs:

```bash
git log --oneline --decorate --graph
```
