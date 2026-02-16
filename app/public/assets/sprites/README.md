# Sprite Assets

This directory stores optional 2D sprite assets used by fallback or utility rendering paths.

## Notes

- The main production scene uses 3D assets.
- Keep files lightweight and web-friendly (`.png`, optimized).
- Prefer consistent naming by role or archetype when adding sets.

## Suggested Naming

- `agent-<archetype>-<variant>.png`
- Example: `agent-shark-01.png`

## Recommended Source Format

If using sprite sheets:

- Keep frame dimensions consistent across a sheet.
- Document frame order in the consuming component/service.
- Include only required frames to avoid unnecessary bundle weight.

## Contribution Guideline

When adding new sprites, include a short note in the PR describing:

1. Intended usage path.
2. Dimensions/frame layout.
3. Any code path relying on the new assets.
