# AI Arena Hook System Documentation

## Overview
A comprehensive hook system has been implemented to ensure code quality, enforce architecture patterns, and maintain cross-platform integration across the AI Arena platform.

## Hook Categories

### 1. **File Editing Hooks**
- **Pre-Edit**: Validates before file modifications
  - Schema protection (blocks database changes)
  - Game directory structure enforcement
  - Game plan validation
  - Forbidden pattern detection
  
- **Post-Edit**: Runs after file modifications
  - ESLint auto-fix
  - TypeScript type checking
  - Prettier formatting
  - Import organization
  - Architecture compliance validation

- **Pre-Write**: Validates before file creation
  - Naming convention enforcement
  - Location validation
  - Migration blocking
  - Test file reminders

### 2. **Cross-Platform Validation Hooks**
- Frontend-Backend game synchronization
- Bot-Game compatibility checking
- GraphQL schema consistency
- JSONB size validation

### 3. **Bot Synchronization Hooks**
- Bot profile sync validation
- Activity tracking validation
- Sprite mapping consistency
- Metaverse integration checks

### 4. **Metaverse Integration Hooks**
- Convex API validation
- Zone transition validation
- Position synchronization
- World instance tracking

### 5. **Tournament System Hooks**
- Tournament compatibility checking
- Match result validation
- Queue system integration
- Lootbox reward validation

### 6. **Economy System Hooks**
- Energy system validation
- Currency flow validation
- Lootbox mechanics validation
- Equipment synchronization

### 7. **Monitoring & Health Checks**
- Server status monitoring (Backend, Frontend, Metaverse)
- Database connection checks
- Redis connection monitoring
- TypeScript compiler health
- Memory usage tracking
- Port conflict detection
- WebSocket connection monitoring
- Error log scanning
- Build artifact validation

### 8. **Performance Monitoring**
- Bundle size monitoring
- Import cost analysis
- React component complexity checking
- Database query pattern monitoring

## Pre-Commit Hooks (Husky)

### Validation Phases
1. **TypeScript Validation**: Type checking for all projects
2. **Code Quality**: ESLint validation with warning limits
3. **Schema Protection**: Blocks database schema modifications
4. **Game Architecture**: Enforces engine patterns
5. **Integration Checks**: Cross-platform validation
6. **Bot Synchronization**: Validates bot sync
7. **Build Verification**: Tests builds for large changes
8. **Security Checks**: Scans for sensitive data

### Usage
```bash
# Hooks run automatically on git commit
git commit -m "Your message"

# To skip hooks (NOT RECOMMENDED)
git commit --no-verify -m "Your message"
```

## Validation Scripts

### 1. Integration Validator
```bash
npx ts-node scripts/validate-integration.ts
```
Checks:
- Database schema compliance
- GraphQL schema consistency
- Bot synchronization
- Metaverse integration
- Tournament system
- Game integration

### 2. Bot Sync Validator
```bash
npx ts-node scripts/validate-bot-sync.ts
```
Checks:
- Bot profile fields
- Sprite mapping
- Activity tracking
- Position synchronization
- Tournament participation
- Equipment sync
- AI decision recording

### 3. Game Backend Validator
```bash
npx ts-node scripts/validate-game-backend.ts
```
Checks:
- Frontend game structure
- Backend adapter implementation
- GraphQL integration
- AI support
- WebSocket support
- Tournament integration
- Testing coverage

## VSCode Auto-Formatting

### Features
- Format on save
- Format on paste
- Organize imports automatically
- Fix ESLint issues on save
- TypeScript auto-imports
- Tailwind CSS IntelliSense

### Configuration
Located in `.vscode/settings.json`

## Game Architecture Enforcement

### Forbidden Patterns (Automatically Blocked)
```typescript
// ❌ FORBIDDEN
setTimeout(() => {}, 1000)      // Use engine.ticker
localStorage.setItem()           // Use engine.saveState()
document.getElementById()        // Use React components
class GameRunner {}             // Use BaseGameEngine

// ✅ CORRECT
engine.ticker.add(callback)
engine.saveState(state)
<Button onClick={handler} />
class MyGame extends BaseGameEngine {}
```

### Required Patterns
- All games must extend base classes
- All games must register with GameRegistry
- All UI must use shared components from @ui/
- All game state must fit in JSONB (<1MB)

## Command Summary

### Hook Management
```bash
# View hook configuration
cat ~/.config/claude/hooks.json

# Test pre-commit hook
.husky/pre-commit

# Run validation scripts
npm run validate:integration
npm run validate:bot-sync
npm run validate:game-backend
```

### Development Workflow
```bash
# 1. Make changes
# 2. Hooks automatically validate on save
# 3. Commit triggers comprehensive validation
# 4. Fix any issues reported
# 5. Commit succeeds when all checks pass
```

## Troubleshooting

### Common Issues

1. **TypeScript errors blocking commit**
   - Run `npm run typecheck` in the affected directory
   - Fix type errors or add proper type annotations

2. **ESLint warnings exceed limit**
   - Run `npm run lint:fix` to auto-fix
   - Manually fix remaining issues

3. **Schema modification blocked**
   - Use existing JSONB fields instead
   - See `/backend/SCHEMA.md` for allowed operations

4. **Game architecture violations**
   - Review `/app/src/modules/game/engine/CLAUDE.md`
   - Use base classes and central engine

5. **Integration validation fails**
   - Run specific validator to identify issues
   - Ensure all platforms are synchronized

## Benefits

1. **Code Quality**: Automatic formatting and linting
2. **Type Safety**: Continuous TypeScript checking
3. **Architecture Compliance**: Enforced patterns
4. **Schema Protection**: Prevents breaking changes
5. **Integration Assurance**: Cross-platform validation
6. **Performance Monitoring**: Early detection of issues
7. **Security**: Sensitive data detection
8. **Developer Experience**: Immediate feedback

## Next Steps

1. Test the hook system with a sample commit
2. Review validation output and address any issues
3. Customize hook sensitivity in `hooks.json` if needed
4. Add project-specific validations as needed

---
*Last Updated: 2025-01-09 | Version: 1.0.0*