#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:4000/api/v1';
const HEALTH_URL = process.env.E2E_HEALTH_URL || 'http://127.0.0.1:4000/health';

const STARTUP_TIMEOUT_MS = Number(process.env.E2E_STARTUP_TIMEOUT_MS || 120_000);
const ACTION_TIMEOUT_MS = Number(process.env.E2E_ACTION_TIMEOUT_MS || 45_000);
const POLL_MS = Number(process.env.E2E_POLL_MS || 800);

const SOAK_DURATION_MS = Number(process.env.E2E_SOAK_DURATION_MS || 300_000); // 5 minutes default
const SOAK_AGENT_COUNT = Number(process.env.E2E_SOAK_AGENT_COUNT || 6);
const ROUND_PAUSE_MS = Number(process.env.E2E_SOAK_ROUND_PAUSE_MS || 300);
const STALL_THRESHOLD_MS = Number(process.env.E2E_SOAK_STALL_THRESHOLD_MS || 70_000);
const MIN_REASONING_LEN = Number(process.env.E2E_SOAK_MIN_REASONING_LEN || 14);
const MIN_REASONING_COVERAGE = Number(process.env.E2E_SOAK_MIN_REASONING_COVERAGE || 0.85);
const MIN_UNIQUE_FAMILIES_PER_AGENT = Number(process.env.E2E_SOAK_MIN_UNIQUE_FAMILIES_PER_AGENT || 2);
const MIN_TOTAL_TICKS = Number(process.env.E2E_SOAK_MIN_TOTAL_TICKS || SOAK_AGENT_COUNT * 8);
const MIN_LEDGER_ROWS = Number(process.env.E2E_SOAK_MIN_LEDGER_ROWS || 40);
const MIN_CRITICAL_LEDGER_TYPES = Number(process.env.E2E_SOAK_MIN_CRITICAL_LEDGER_TYPES || 3);
const MAX_AUDIT_DRIFT = Number(process.env.E2E_SOAK_MAX_AUDIT_DRIFT || Number.POSITIVE_INFINITY);
const MIN_AUDIT_OK_RATIO = Number(process.env.E2E_SOAK_MIN_AUDIT_OK_RATIO || 1);
const REQUIRED_AUDIT_CHECKS = String(
  process.env.E2E_SOAK_REQUIRED_AUDIT_CHECKS || 'HAS_ECONOMY_POOL,NON_NEGATIVE_POOL_BUDGETS',
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const ARTIFACT_DIR = process.env.E2E_ARTIFACT_DIR || path.resolve('artifacts/e2e-autonomy-soak');
const USE_RESET_ENDPOINT = process.env.E2E_USE_RESET_ENDPOINT !== 'false';
const REQUIRE_RESET_ENDPOINT = process.env.E2E_REQUIRE_RESET_ENDPOINT === '1';
const TEST_UTILS_KEY = String(process.env.E2E_TEST_UTILS_KEY || '').trim();

const CORE_FAMILIES = ['build', 'work', 'trade', 'fight'];
const NUDGE_ORDER = ['build', 'work', 'trade', 'fight'];
const CRITICAL_LEDGER_TYPES = [
  'CLAIM_SPLIT',
  'BUILD_SPLIT',
  'WORK_PAYOUT',
  'FIGHT_RAKE',
  'TRADE_FEE_SPLIT',
  'WAR_RAID_COST',
  'WAR_HEIST_COST',
  'WAR_DEFEND_COST',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function normalizeActionType(value) {
  return String(value || '').trim().toLowerCase();
}

function actionFamily(actionType) {
  const normalized = normalizeActionType(actionType);
  if (!normalized) return 'unknown';
  if (['claim_plot', 'start_build'].includes(normalized)) return 'build';
  if (['do_work', 'complete_build', 'mine'].includes(normalized)) return 'work';
  if (normalized === 'play_arena') return 'fight';
  if (['buy_arena', 'sell_arena'].includes(normalized)) return 'trade';
  if (['raid', 'heist', 'defend'].includes(normalized)) return 'war';
  if (normalized === 'rest') return 'rest';
  return 'unknown';
}

function compact(text, max = 220) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function authHeaders(walletAddress) {
  return {
    'x-player-authenticated': '1',
    'x-player-wallet': String(walletAddress || '').toLowerCase(),
  };
}

async function waitForCondition(label, check, timeoutMs, pollMs = POLL_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(pollMs);
  }
  if (lastError) {
    throw new Error(`${label} timed out after ${timeoutMs}ms (${String(lastError.message || lastError)})`);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function fetchJson(url, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`${method} ${url} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return data;
}

function api(pathname, options = {}) {
  return fetchJson(`${API_BASE}${pathname}`, options);
}

async function maybeResetWorld() {
  if (!USE_RESET_ENDPOINT) return { attempted: false, ok: false };
  const headers = TEST_UTILS_KEY ? { 'x-test-utils-key': TEST_UTILS_KEY } : {};
  try {
    const result = await api('/test-utils/reset-world', {
      method: 'POST',
      headers,
      body: {
        label: 'e2e-autonomy-soak',
      },
    });
    return { attempted: true, ok: true, result };
  } catch (error) {
    if (REQUIRE_RESET_ENDPOINT) {
      throw error;
    }
    return {
      attempted: true,
      ok: false,
      error: String(error?.message || error),
    };
  }
}

async function waitForBackend() {
  await waitForCondition(
    'backend health endpoint',
    async () => {
      const res = await fetch(HEALTH_URL);
      return res.ok;
    },
    STARTUP_TIMEOUT_MS,
  );
}

function generateWalletAddress() {
  const chars = 'abcdef0123456789';
  let hex = '';
  for (let i = 0; i < 40; i += 1) {
    hex += chars[Math.floor(Math.random() * chars.length)];
  }
  return `0x${hex}`;
}

async function createFreshTown() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 3)}`.slice(-6);
  const town = await api('/town', {
    method: 'POST',
    body: {
      name: `SOAK_${suffix}`,
      theme: 'autonomy soak verification town',
      totalPlots: 120,
      level: 1,
    },
  });
  if (!town?.town?.id) throw new Error('Failed to create soak town');
  return town.town;
}

async function spawnAgent(name, personality) {
  const walletAddress = generateWalletAddress();
  const payload = await api('/agents/spawn', {
    method: 'POST',
    body: {
      name,
      personality,
      walletAddress,
    },
  });
  if (!payload?.agent?.id) {
    throw new Error(`Failed to spawn soak agent ${name}`);
  }
  return payload.agent;
}

async function setLoopMode(agentId, mode, walletAddress) {
  return api(`/agent-loop/mode/${agentId}`, {
    method: 'POST',
    headers: authHeaders(walletAddress),
    body: { mode },
  });
}

async function getPlans(agentId) {
  return api(`/agent-loop/plans/${agentId}`);
}

async function queueInstruction(agentId, text) {
  return api(`/agent-loop/tell/${agentId}`, {
    method: 'POST',
    body: {
      message: text,
      from: 'e2e-autonomy-soak',
    },
  });
}

async function tickAgent(agentId) {
  return api(`/agent-loop/tick/${agentId}`, {
    method: 'POST',
    body: {},
  });
}

async function getAllAgents() {
  return api('/agents');
}

async function getAgent(agentId) {
  const all = await getAllAgents();
  const found = Array.isArray(all) ? all.find((agent) => agent.id === agentId) : null;
  if (!found) throw new Error(`Agent not found: ${agentId}`);
  return found;
}

async function getEconomyStats() {
  const headers = TEST_UTILS_KEY ? { 'x-test-utils-key': TEST_UTILS_KEY } : {};
  return api('/test-utils/economy-stats', { headers });
}

async function getEconomyAudit() {
  return api('/agent-loop/economy-audit?ledgerLookback=500');
}

function chooseDynamicFamily(phaseState, plans, roundIndex, agentIndex) {
  const missing = CORE_FAMILIES.filter((family) => !phaseState.familiesSeen.has(family));
  const missionAction = String(plans?.mission?.recommendedAction || '').toLowerCase();
  const missionFamily = CORE_FAMILIES.includes(missionAction) ? missionAction : null;

  if (missing.length > 0) {
    const first = missing[0];
    if (plans?.plans?.[first]?.ok) return first;
    if (missionFamily && missing.includes(missionFamily)) return missionFamily;
    return first;
  }

  if (missionFamily && plans?.plans?.[missionFamily]?.ok) return missionFamily;
  return NUDGE_ORDER[(roundIndex + agentIndex) % NUDGE_ORDER.length];
}

function toPriorityNudge(family) {
  return `PRIORITY: ${String(family || 'trade').toUpperCase()}`;
}

function computeReasoningCoverage(agentStateMap) {
  const rows = [];
  for (const [agentId, state] of agentStateMap.entries()) {
    const coverage = state.totalTicks > 0 ? state.reasoningOkTicks / state.totalTicks : 0;
    rows.push({
      agentId,
      name: state.name,
      totalTicks: state.totalTicks,
      reasoningOkTicks: state.reasoningOkTicks,
      reasoningCoverage: coverage,
    });
  }
  return rows;
}

async function main() {
  await ensureDir(ARTIFACT_DIR);
  console.log('[soak] waiting for backend...');
  await waitForBackend();

  const resetResult = await maybeResetWorld();
  if (resetResult.attempted && resetResult.ok) {
    console.log('[soak] reset-world endpoint succeeded.');
  } else if (resetResult.attempted) {
    console.log(`[soak] reset-world endpoint unavailable; continuing with fallback. (${resetResult.error || 'unknown'})`);
  }

  const soakTown = await createFreshTown();
  console.log(`[soak] created town ${soakTown.id}`);

  const archetypes = ['DEGEN', 'SHARK', 'CHAMELEON', 'GRINDER', 'ROCK', 'DEGEN'];
  const suffix = Date.now().toString(36).slice(-4);
  const agents = [];
  for (let i = 0; i < SOAK_AGENT_COUNT; i += 1) {
    const name = `SOAK_${suffix}_${i}`;
    const archetype = archetypes[i % archetypes.length];
    const spawned = await spawnAgent(name, archetype);
    await setLoopMode(spawned.id, 'DEGEN_LOOP', spawned.walletAddress);
    agents.push(spawned);
  }

  const agentStateMap = new Map(
    agents.map((agent) => [
      agent.id,
      {
        id: agent.id,
        name: agent.name,
        walletAddress: agent.walletAddress,
        totalTicks: 0,
        reasoningOkTicks: 0,
        familiesSeen: new Set(),
        actionsSeen: new Map(),
        lastTickAtMs: 0,
        lastActionType: '',
        lastReasoning: '',
        lastBankroll: 0,
        lastReserve: 0,
        lastHealth: 100,
      },
    ]),
  );

  const timeline = [];
  const failures = [];
  const startedAt = Date.now();
  let round = 0;
  const economySnapshots = [];
  const economyAuditSnapshots = [];
  let auditOkCount = 0;
  let previousEconomySnapshot = null;

  while (Date.now() - startedAt < SOAK_DURATION_MS) {
    round += 1;
    for (let i = 0; i < agents.length; i += 1) {
      const agent = agents[i];
      const state = agentStateMap.get(agent.id);
      if (!state) continue;

      let plans = null;
      try {
        plans = await getPlans(agent.id);
      } catch (error) {
        failures.push({
          type: 'PLAN_FETCH_FAILED',
          agentId: agent.id,
          message: String(error?.message || error),
          round,
        });
        continue;
      }

      const family = chooseDynamicFamily(state, plans, round, i);
      const nudge = toPriorityNudge(family);
      try {
        await queueInstruction(agent.id, nudge);
        const tickResult = await tickAgent(agent.id);
        const updatedAgent = await waitForCondition(
          `tick update for ${agent.id}`,
          async () => {
            const current = await getAgent(agent.id);
            const tickAtMs = current.lastTickAt ? Date.parse(current.lastTickAt) : Number.NaN;
            if (!Number.isFinite(tickAtMs)) return false;
            if (tickAtMs <= state.lastTickAtMs) return false;
            return current;
          },
          ACTION_TIMEOUT_MS,
          450,
        );

        const actionType = normalizeActionType(updatedAgent.lastActionType || tickResult?.result?.action?.type);
        const familyObserved = actionFamily(actionType);
        const reasoning = compact(updatedAgent.lastReasoning || '');
        const tickAtMs = Date.parse(updatedAgent.lastTickAt);

        state.totalTicks += 1;
        if (reasoning.length >= MIN_REASONING_LEN) state.reasoningOkTicks += 1;
        state.familiesSeen.add(familyObserved);
        state.actionsSeen.set(actionType || 'unknown', (state.actionsSeen.get(actionType || 'unknown') || 0) + 1);
        state.lastTickAtMs = Number.isFinite(tickAtMs) ? tickAtMs : state.lastTickAtMs;
        state.lastActionType = actionType;
        state.lastReasoning = reasoning;
        state.lastBankroll = Number(updatedAgent.bankroll || 0);
        state.lastReserve = Number(updatedAgent.reserveBalance || 0);
        state.lastHealth = Number(updatedAgent.health ?? 100);

        timeline.push({
          at: new Date().toISOString(),
          round,
          agentId: agent.id,
          agentName: agent.name,
          nudge,
          actionType,
          family: familyObserved,
          reasoningSample: reasoning.slice(0, 160),
          bankroll: state.lastBankroll,
          reserve: state.lastReserve,
          health: state.lastHealth,
        });

        if (!Number.isFinite(state.lastBankroll) || !Number.isFinite(state.lastReserve) || !Number.isFinite(state.lastHealth)) {
          failures.push({
            type: 'NUMERIC_INVARIANT_FAILED',
            agentId: agent.id,
            message: 'bankroll/reserve/health must be finite numbers',
            round,
          });
        }
        if (state.lastBankroll < 0 || state.lastReserve < 0) {
          failures.push({
            type: 'NEGATIVE_BALANCE',
            agentId: agent.id,
            message: `bankroll=${state.lastBankroll}, reserve=${state.lastReserve}`,
            round,
          });
        }
        if (state.lastHealth < 0 || state.lastHealth > 100) {
          failures.push({
            type: 'HEALTH_RANGE_VIOLATION',
            agentId: agent.id,
            message: `health=${state.lastHealth}`,
            round,
          });
        }
      } catch (error) {
        failures.push({
          type: 'TICK_FAILED',
          agentId: agent.id,
          message: String(error?.message || error),
          round,
        });
      }
    }

    const now = Date.now();
    for (const [agentId, state] of agentStateMap.entries()) {
      if (!state.lastTickAtMs) continue;
      if (now - state.lastTickAtMs > STALL_THRESHOLD_MS) {
        failures.push({
          type: 'AGENT_STALLED',
          agentId,
          message: `No tick update for ${(now - state.lastTickAtMs)}ms`,
          round,
        });
      }
    }

    try {
      const economyStats = await getEconomyStats();
      const pool = economyStats?.pool || null;
      const ledgerTotal = Number(economyStats?.ledger?.total || 0);
      const ledgerByType = economyStats?.ledger?.byType && typeof economyStats.ledger.byType === 'object'
        ? economyStats.ledger.byType
        : {};
      const snapshot = {
        at: new Date().toISOString(),
        round,
        reserveBalance: Number(pool?.reserveBalance ?? NaN),
        arenaBalance: Number(pool?.arenaBalance ?? NaN),
        opsBudget: Number(pool?.opsBudget ?? NaN),
        pvpBudget: Number(pool?.pvpBudget ?? NaN),
        rescueBudget: Number(pool?.rescueBudget ?? NaN),
        insuranceBudget: Number(pool?.insuranceBudget ?? NaN),
        cumulativeFeesReserve: Number(pool?.cumulativeFeesReserve ?? NaN),
        cumulativeFeesArena: Number(pool?.cumulativeFeesArena ?? NaN),
        ledgerTotal,
        ledgerByType,
      };
      economySnapshots.push(snapshot);

      if (!pool) {
        failures.push({
          type: 'MISSING_ECONOMY_POOL',
          message: 'economy pool missing from test-utils snapshot',
          round,
        });
      } else {
        const mustBeFiniteAndNonNegative = [
          ['reserveBalance', snapshot.reserveBalance],
          ['arenaBalance', snapshot.arenaBalance],
          ['opsBudget', snapshot.opsBudget],
          ['pvpBudget', snapshot.pvpBudget],
          ['rescueBudget', snapshot.rescueBudget],
          ['insuranceBudget', snapshot.insuranceBudget],
          ['cumulativeFeesReserve', snapshot.cumulativeFeesReserve],
          ['cumulativeFeesArena', snapshot.cumulativeFeesArena],
          ['ledgerTotal', snapshot.ledgerTotal],
        ];
        for (const [field, value] of mustBeFiniteAndNonNegative) {
          if (!Number.isFinite(value) || value < 0) {
            failures.push({
              type: 'ECONOMY_NUMERIC_INVARIANT_FAILED',
              message: `${field} must be finite and >= 0 (got ${String(value)})`,
              round,
            });
          }
        }
      }

      if (previousEconomySnapshot) {
        if (snapshot.cumulativeFeesArena < previousEconomySnapshot.cumulativeFeesArena) {
          failures.push({
            type: 'CUMULATIVE_FEES_ARENA_DECREASED',
            message: `${snapshot.cumulativeFeesArena} < ${previousEconomySnapshot.cumulativeFeesArena}`,
            round,
          });
        }
        if (snapshot.cumulativeFeesReserve < previousEconomySnapshot.cumulativeFeesReserve) {
          failures.push({
            type: 'CUMULATIVE_FEES_RESERVE_DECREASED',
            message: `${snapshot.cumulativeFeesReserve} < ${previousEconomySnapshot.cumulativeFeesReserve}`,
            round,
          });
        }
        if (snapshot.ledgerTotal < previousEconomySnapshot.ledgerTotal) {
          failures.push({
            type: 'LEDGER_TOTAL_DECREASED',
            message: `${snapshot.ledgerTotal} < ${previousEconomySnapshot.ledgerTotal}`,
            round,
          });
        }
      }
      previousEconomySnapshot = snapshot;
    } catch (error) {
      failures.push({
        type: 'ECONOMY_STATS_FETCH_FAILED',
        message: String(error?.message || error),
        round,
      });
    }

    try {
      const audit = await getEconomyAudit();
      const checks = Array.isArray(audit?.checks) ? audit.checks : [];
      const failedRequiredChecks = REQUIRED_AUDIT_CHECKS.filter((requiredCode) => {
        const matching = checks.find((check) => String(check?.code || '') === requiredCode);
        return !matching || matching.ok !== true;
      });
      const failedChecks = checks
        .filter((check) => check && check.ok === false)
        .map((check) => String(check.code || 'UNKNOWN_CHECK'));
      const driftSinceBaseline = Number(audit?.baseline?.driftSinceBaseline ?? NaN);
      const requiredChecksOk = failedRequiredChecks.length === 0;
      const auditSnapshot = {
        at: new Date().toISOString(),
        round,
        ok: requiredChecksOk,
        rawOk: audit?.ok === true,
        currentTick: Number(audit?.currentTick || 0),
        driftSinceBaseline,
        trackedArenaFloat: Number(audit?.snapshot?.trackedArenaFloat ?? NaN),
        ledgerTotal: Number(audit?.ledger?.totalRows || 0),
        failedRequiredChecks,
        failedChecks,
      };
      economyAuditSnapshots.push(auditSnapshot);
      if (auditSnapshot.ok) auditOkCount += 1;

      if (!auditSnapshot.ok) {
        failures.push({
          type: 'ECONOMY_AUDIT_CHECK_FAILED',
          message: failedRequiredChecks.join(', '),
          round,
        });
      }
      if (!Number.isFinite(driftSinceBaseline)) {
        failures.push({
          type: 'ECONOMY_AUDIT_DRIFT_NAN',
          message: `driftSinceBaseline is non-finite (${String(driftSinceBaseline)})`,
          round,
        });
      } else if (Number.isFinite(MAX_AUDIT_DRIFT) && Math.abs(driftSinceBaseline) > MAX_AUDIT_DRIFT) {
        failures.push({
          type: 'ECONOMY_AUDIT_DRIFT_EXCEEDED',
          message: `|${driftSinceBaseline}| > ${MAX_AUDIT_DRIFT}`,
          round,
        });
      }
    } catch (error) {
      failures.push({
        type: 'ECONOMY_AUDIT_FETCH_FAILED',
        message: String(error?.message || error),
        round,
      });
    }

    if (round % 4 === 0) {
      const familyTotals = new Map();
      for (const entry of timeline.slice(-SOAK_AGENT_COUNT * 4)) {
        familyTotals.set(entry.family, (familyTotals.get(entry.family) || 0) + 1);
      }
      console.log(`[soak] round ${round} recent families: ${JSON.stringify(Object.fromEntries(familyTotals))}`);
    }

    await sleep(ROUND_PAUSE_MS);
  }

  const reasoningCoverageRows = computeReasoningCoverage(agentStateMap);
  const overallFamilySeen = new Set();
  let totalTicks = 0;
  for (const state of agentStateMap.values()) {
    totalTicks += state.totalTicks;
    for (const family of state.familiesSeen) overallFamilySeen.add(family);
  }

  const missingCoreFamilies = CORE_FAMILIES.filter((family) => !overallFamilySeen.has(family));
  if (missingCoreFamilies.length > 0) {
    failures.push({
      type: 'MISSING_CORE_FAMILIES',
      message: `Missing family coverage: ${missingCoreFamilies.join(', ')}`,
    });
  }

  if (totalTicks < MIN_TOTAL_TICKS) {
    failures.push({
      type: 'LOW_TICK_VOLUME',
      message: `totalTicks ${totalTicks} < ${MIN_TOTAL_TICKS}`,
    });
  }

  const latestEconomySnapshot = economySnapshots.length > 0 ? economySnapshots[economySnapshots.length - 1] : null;
  const latestEconomyAuditSnapshot =
    economyAuditSnapshots.length > 0 ? economyAuditSnapshots[economyAuditSnapshots.length - 1] : null;
  const auditOkRatio = economyAuditSnapshots.length > 0 ? (auditOkCount / economyAuditSnapshots.length) : 0;
  if (!latestEconomySnapshot) {
    failures.push({
      type: 'MISSING_ECONOMY_SNAPSHOTS',
      message: 'No economy snapshot was captured during soak run.',
    });
  } else {
    if (latestEconomySnapshot.ledgerTotal < MIN_LEDGER_ROWS) {
      failures.push({
        type: 'LOW_LEDGER_ACTIVITY',
        message: `ledgerTotal ${latestEconomySnapshot.ledgerTotal} < ${MIN_LEDGER_ROWS}`,
      });
    }
    const criticalLedgerTypesPresent = CRITICAL_LEDGER_TYPES.filter(
      (type) => Number(latestEconomySnapshot.ledgerByType?.[type] || 0) > 0,
    );
    if (criticalLedgerTypesPresent.length < MIN_CRITICAL_LEDGER_TYPES) {
      failures.push({
        type: 'LOW_CRITICAL_LEDGER_TYPE_COVERAGE',
        message: `critical types present ${criticalLedgerTypesPresent.length} < ${MIN_CRITICAL_LEDGER_TYPES} (${criticalLedgerTypesPresent.join(', ') || 'none'})`,
      });
    }
  }
  if (!latestEconomyAuditSnapshot) {
    failures.push({
      type: 'MISSING_ECONOMY_AUDIT_SNAPSHOTS',
      message: 'No economy audit snapshot was captured during soak run.',
    });
  } else if (auditOkRatio < MIN_AUDIT_OK_RATIO) {
    failures.push({
      type: 'LOW_ECONOMY_AUDIT_OK_RATIO',
      message: `audit ok ratio ${auditOkRatio.toFixed(3)} < ${MIN_AUDIT_OK_RATIO.toFixed(3)}`,
    });
  }

  for (const row of reasoningCoverageRows) {
    if (row.reasoningCoverage < MIN_REASONING_COVERAGE) {
      failures.push({
        type: 'LOW_REASONING_COVERAGE',
        agentId: row.agentId,
        message: `${row.reasoningCoverage.toFixed(3)} < ${MIN_REASONING_COVERAGE.toFixed(3)}`,
      });
    }
  }

  for (const state of agentStateMap.values()) {
    const uniqueFamilies = new Set([...state.familiesSeen].filter((family) => CORE_FAMILIES.includes(family)));
    if (uniqueFamilies.size < MIN_UNIQUE_FAMILIES_PER_AGENT) {
      failures.push({
        type: 'LOW_PER_AGENT_DIVERSITY',
        agentId: state.id,
        message: `unique core families ${uniqueFamilies.size} < ${MIN_UNIQUE_FAMILIES_PER_AGENT}`,
      });
    }
  }

  const summary = {
    ok: failures.length === 0,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    reset: resetResult,
    soakTownId: soakTown.id,
    agentCount: agents.length,
    totalTicks,
    coreFamiliesObserved: Array.from(overallFamilySeen).filter((family) => CORE_FAMILIES.includes(family)),
    missingCoreFamilies,
    thresholds: {
      SOAK_DURATION_MS,
      STALL_THRESHOLD_MS,
      MIN_REASONING_LEN,
      MIN_REASONING_COVERAGE,
      MIN_UNIQUE_FAMILIES_PER_AGENT,
      MIN_TOTAL_TICKS,
      MIN_LEDGER_ROWS,
      MIN_CRITICAL_LEDGER_TYPES,
      MIN_AUDIT_OK_RATIO,
      MAX_AUDIT_DRIFT: Number.isFinite(MAX_AUDIT_DRIFT) ? MAX_AUDIT_DRIFT : null,
      REQUIRED_AUDIT_CHECKS,
    },
    criticalLedgerTypes: CRITICAL_LEDGER_TYPES,
    reasoningCoverage: reasoningCoverageRows,
    economy: {
      latest: latestEconomySnapshot,
      snapshotTail: economySnapshots.slice(-80),
      audit: {
        latest: latestEconomyAuditSnapshot,
        okRatio: auditOkRatio,
        snapshotTail: economyAuditSnapshots.slice(-80),
      },
    },
    perAgent: Array.from(agentStateMap.values()).map((state) => ({
      id: state.id,
      name: state.name,
      totalTicks: state.totalTicks,
      familiesSeen: Array.from(state.familiesSeen),
      lastActionType: state.lastActionType,
      lastReasoning: state.lastReasoning.slice(0, 220),
      bankroll: state.lastBankroll,
      reserve: state.lastReserve,
      health: state.lastHealth,
      actionCounts: Object.fromEntries(state.actionsSeen),
    })),
    failureCount: failures.length,
    failures,
    timelineTail: timeline.slice(-120),
  };

  const reportPath = path.join(ARTIFACT_DIR, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[soak] report: ${reportPath}`);

  if (failures.length > 0) {
    const failurePath = path.join(ARTIFACT_DIR, 'failure.txt');
    await fs.writeFile(
      failurePath,
      failures.map((f, idx) => `${idx + 1}. ${f.type}${f.agentId ? ` [${f.agentId}]` : ''}: ${f.message || ''}`).join('\n'),
      'utf8',
    );
    throw new Error(`Soak invariants failed (${failures.length} issues)`);
  }

  console.log('[soak] success');
}

main().catch(async (error) => {
  const failurePath = path.join(ARTIFACT_DIR, 'failure.txt');
  try {
    await ensureDir(ARTIFACT_DIR);
    await fs.writeFile(failurePath, String(error?.stack || error?.message || error), 'utf8');
  } catch {
    // ignore write failure
  }
  console.error(`[soak] failed: ${String(error?.message || error)}`);
  console.error(`[soak] failure details: ${failurePath}`);
  process.exit(1);
});
