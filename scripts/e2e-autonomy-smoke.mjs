#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:4000/api/v1';
const APP_BASE = process.env.E2E_APP_BASE || 'http://127.0.0.1:8080';
const HEALTH_URL = process.env.E2E_HEALTH_URL || 'http://127.0.0.1:4000/health';
const STARTUP_TIMEOUT_MS = Number(process.env.E2E_STARTUP_TIMEOUT_MS || 120_000);
const ACTION_TIMEOUT_MS = Number(process.env.E2E_ACTION_TIMEOUT_MS || 45_000);
const UI_TIMEOUT_MS = Number(process.env.E2E_UI_TIMEOUT_MS || 45_000);
const POLL_MS = Number(process.env.E2E_POLL_MS || 900);
const AUTONOMY_MAX_ATTEMPTS = Number(process.env.E2E_AUTONOMY_MAX_ATTEMPTS || 16);
const HEADLESS = process.env.E2E_HEADLESS !== 'false';
const ARTIFACT_DIR = process.env.E2E_ARTIFACT_DIR || path.resolve('artifacts/e2e-autonomy-smoke');
const USE_RESET_ENDPOINT = process.env.E2E_USE_RESET_ENDPOINT !== 'false';
const REQUIRE_RESET_ENDPOINT = process.env.E2E_REQUIRE_RESET_ENDPOINT === '1';
const TEST_UTILS_KEY = String(process.env.E2E_TEST_UTILS_KEY || '').trim();

function authHeaders(walletAddress) {
  return {
    'x-player-authenticated': '1',
    'x-player-wallet': String(walletAddress || '').toLowerCase(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(label, check, timeoutMs, pollMs = POLL_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
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

  const res = await fetch(url, {
    ...options,
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!res.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`${method} ${url} failed (${res.status}): ${detail.slice(0, 400)}`);
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
        label: 'e2e-autonomy-smoke',
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
      if (!res.ok) return false;
      return true;
    },
    STARTUP_TIMEOUT_MS,
  );
}

async function waitForFrontend() {
  await waitForCondition(
    'frontend /town endpoint',
    async () => {
      const res = await fetch(`${APP_BASE}/town`);
      if (!res.ok) return false;
      return true;
    },
    STARTUP_TIMEOUT_MS,
  );
}

async function listAvailablePlots(townId) {
  const res = await api(`/town/${townId}/plots?available=true`);
  return Array.isArray(res?.plots) ? res.plots : [];
}

async function createFreshTown() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 3)}`.slice(-6);
  const name = `E2E_${suffix}`;
  const created = await api('/town', {
    method: 'POST',
    body: {
      name,
      theme: 'e2e validation town',
      totalPlots: 80,
      level: 1,
    },
  });
  if (!created?.town?.id) {
    throw new Error('Failed to create dedicated e2e town');
  }
  const available = await listAvailablePlots(created.town.id);
  if (available.length === 0) {
    throw new Error(`Dedicated e2e town ${created.town.id} has no claimable plots`);
  }
  return created.town;
}

function generateWalletAddress() {
  const chars = 'abcdef0123456789';
  let hex = '';
  for (let i = 0; i < 40; i += 1) {
    hex += chars[Math.floor(Math.random() * chars.length)];
  }
  return `0x${hex}`;
}

async function spawnAgent(name, archetype) {
  const walletAddress = generateWalletAddress();
  const payload = await api('/agents/spawn', {
    method: 'POST',
    body: {
      name,
      personality: archetype,
      walletAddress,
    },
  });
  if (!payload?.agent?.id) {
    throw new Error(`Failed to spawn agent ${name}`);
  }
  return payload.agent;
}

async function getAgent(agentId) {
  const agents = await api('/agents');
  const found = Array.isArray(agents) ? agents.find((agent) => agent.id === agentId) : null;
  if (!found) {
    throw new Error(`Agent ${agentId} not found in /agents`);
  }
  return found;
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

async function isAgentInWheelFight(agentId) {
  try {
    const status = await api('/wheel/status');
    const phase = String(status?.phase || '').toUpperCase();
    if (!['ANNOUNCING', 'FIGHTING'].includes(phase)) return false;
    const agentA = String(status?.currentMatch?.agent1?.id || '');
    const agentB = String(status?.currentMatch?.agent2?.id || '');
    return agentA === agentId || agentB === agentId;
  } catch {
    return false;
  }
}

async function waitForWheelClear(agentId) {
  await waitForCondition(
    `wheel match clear for ${agentId}`,
    async () => !(await isAgentInWheelFight(agentId)),
    ACTION_TIMEOUT_MS,
    900,
  );
}

async function runAction(agentId, action, walletAddress) {
  return api(`/agent-loop/action/${agentId}`, {
    method: 'POST',
    headers: authHeaders(walletAddress),
    body: { action, source: 'e2e-autonomy-smoke' },
  });
}

async function tickAgent(agentId) {
  return api(`/agent-loop/tick/${agentId}`, {
    method: 'POST',
    body: {},
  });
}

async function queueInstruction(agentId, message) {
  return api(`/agent-loop/tell/${agentId}`, {
    method: 'POST',
    body: {
      message,
      from: 'e2e-autonomy-smoke',
    },
  });
}

async function waitForAgentTick(agentId, previousTickAtMs) {
  return waitForCondition(
    `agent ${agentId} tick update`,
    async () => {
      const agent = await getAgent(agentId);
      const tickAtMs = agent.lastTickAt ? Date.parse(agent.lastTickAt) : Number.NaN;
      if (!Number.isFinite(tickAtMs)) return false;
      if (tickAtMs <= previousTickAtMs) return false;
      if (!String(agent.lastReasoning || '').trim()) return false;
      return agent;
    },
    ACTION_TIMEOUT_MS,
  );
}

function compact(text, max = 220) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
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
  if (['play_arena'].includes(normalized)) return 'fight';
  if (['buy_arena', 'sell_arena'].includes(normalized)) return 'trade';
  if (normalized === 'rest') return 'rest';
  return 'unknown';
}

function isIgnorableConsoleError(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return true;
  if (text.includes('error creating webgl context')) return true;
  if (text.includes('webgl context could not be created')) return true;
  if (text.includes('failed to load resource: the server responded with a status of 404')) return true;
  return false;
}

async function main() {
  await ensureDir(ARTIFACT_DIR);

  console.log('[e2e] waiting for backend + frontend...');
  await Promise.all([waitForBackend(), waitForFrontend()]);

  const resetResult = await maybeResetWorld();
  if (resetResult.attempted && resetResult.ok) {
    console.log('[e2e] reset-world endpoint succeeded.');
  } else if (resetResult.attempted) {
    console.log(`[e2e] reset-world endpoint unavailable; continuing with fallback. (${resetResult.error || 'unknown'})`);
  }

  console.log('[e2e] ensuring active town...');
  const town = await createFreshTown();

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 3)}`.slice(-4);
  const primaryName = `E2P${suffix}`;
  const opponentName = `E2O${suffix}`;

  console.log('[e2e] spawning wallet-owned agents...');
  const [primaryAgent, opponentAgent] = await Promise.all([
    spawnAgent(primaryName, 'DEGEN'),
    spawnAgent(opponentName, 'SHARK'),
  ]);

  await setLoopMode(primaryAgent.id, 'DEGEN_LOOP', primaryAgent.walletAddress);
  await setLoopMode(opponentAgent.id, 'DEGEN_LOOP', opponentAgent.walletAddress);

  const actionSnapshots = [];
  const autonomousSnapshots = [];
  const initialAgentState = await getAgent(primaryAgent.id);
  let previousTickAtMs = initialAgentState.lastTickAt ? Date.parse(initialAgentState.lastTickAt) : 0;

  const captureAction = async (action, phase = action) => {
    await waitForWheelClear(primaryAgent.id);
    const run = await runAction(primaryAgent.id, action, primaryAgent.walletAddress);
    const updatedAgent = await waitForAgentTick(primaryAgent.id, previousTickAtMs);
    previousTickAtMs = Date.parse(updatedAgent.lastTickAt);
    const actionFromApi = typeof run?.result?.action === 'string'
      ? run.result.action
      : run?.result?.action?.type;
    const executed = compact(actionFromApi || updatedAgent.lastActionType || '');

    actionSnapshots.push({
      requested: phase,
      executed,
      reasonSample: compact(updatedAgent.lastReasoning || ''),
      tickAt: updatedAgent.lastTickAt,
      narrative: compact(run?.result?.narrative || ''),
    });

    // tiny pause so event order is stable in UI pollers
    await sleep(350);
    return { executed, updatedAgent, run };
  };

  const captureAutonomousTick = async (phase, nudgeText) => {
    await waitForWheelClear(primaryAgent.id);
    await queueInstruction(primaryAgent.id, nudgeText);
    await tickAgent(primaryAgent.id);
    const updatedAgent = await waitForAgentTick(primaryAgent.id, previousTickAtMs);
    previousTickAtMs = Date.parse(updatedAgent.lastTickAt);
    const executed = normalizeActionType(updatedAgent.lastActionType || '');
    const snapshot = {
      phase,
      nudgeText,
      executed,
      family: actionFamily(executed),
      reasonSample: compact(updatedAgent.lastReasoning || '', 260),
      tickAt: updatedAgent.lastTickAt,
    };
    autonomousSnapshots.push(snapshot);
    console.log(`[e2e][autonomy] ${phase}: ${snapshot.executed || 'none'} (${snapshot.family})`);
    await sleep(320);
    return snapshot;
  };

  const pickFirstOkAction = (plans, candidates) => {
    const planMap = plans?.plans || {};
    for (const candidate of candidates) {
      if (candidate === 'rest') return 'rest';
      if (planMap?.[candidate]?.ok) return candidate;
    }
    return 'rest';
  };

  const executeUntil = async (phaseName, chooseAction, isSuccess, maxAttempts = 6) => {
    for (let i = 0; i < maxAttempts; i += 1) {
      const plans = await getPlans(primaryAgent.id);
      const selectedAction = chooseAction(plans, i);
      const stepLabel = i === 0 ? phaseName : `${phaseName}_retry_${i}_${selectedAction}`;
      const result = await captureAction(selectedAction, stepLabel);
      if (isSuccess(String(result.executed || '').toLowerCase(), result, plans)) {
        return result;
      }
    }
    throw new Error(`${phaseName} flow not observed after ${maxAttempts} attempts`);
  };

  const executeAutonomousPhase = async (phaseName, expectedFamilies, nudgeText) => {
    for (let i = 0; i < AUTONOMY_MAX_ATTEMPTS; i += 1) {
      const snapshot = await captureAutonomousTick(
        i === 0 ? phaseName : `${phaseName}_retry_${i}`,
        nudgeText,
      );
      if (expectedFamilies.includes(snapshot.family)) {
        return snapshot;
      }
    }
    throw new Error(`autonomous ${phaseName} flow not observed after ${AUTONOMY_MAX_ATTEMPTS} attempts`);
  };

  const ensureWorkPlanReady = async () => {
    await waitForCondition(
      'work plan readiness',
      async () => {
        const plansBefore = await getPlans(primaryAgent.id);
        if (plansBefore?.plans?.work?.ok) return true;

        const selectedAction = pickFirstOkAction(plansBefore, ['build', 'trade', 'work', 'fight', 'rest']);
        await captureAction(selectedAction, `autonomy_work_precondition_${selectedAction}`);

        const plansAfter = await getPlans(primaryAgent.id);
        return Boolean(plansAfter?.plans?.work?.ok);
      },
      ACTION_TIMEOUT_MS * 2,
      600,
    );
  };

  const assertReasoningQuality = (entries, label) => {
    const bad = entries.filter((entry) => String(entry.reasonSample || '').trim().length < 12);
    if (bad.length > 0) {
      throw new Error(`${label} reasoning quality check failed: ${bad.length} entries were too short`);
    }
  };

  console.log('[e2e] driving autonomous tell+tick sequence...');
  await executeAutonomousPhase('trade', ['trade'], 'PRIORITY: TRADE');
  const buildPhase = await executeAutonomousPhase('build', ['build', 'work', 'trade'], 'PRIORITY: BUILD');

  // Precondition: ensure there is active construction so WORK nudges can execute do_work.
  await ensureWorkPlanReady();

  await executeAutonomousPhase('work', ['work'], 'PRIORITY: WORK');
  await executeAutonomousPhase('fight', ['fight'], 'PRIORITY: FIGHT');

  const autonomousFamilies = new Set(autonomousSnapshots.map((entry) => entry.family));
  const requiredFamilies = ['work', 'trade', 'fight'];
  const missingFamilies = requiredFamilies.filter((family) => !autonomousFamilies.has(family));
  if (missingFamilies.length > 0) {
    throw new Error(`autonomy coverage missing core families: ${missingFamilies.join(', ')}`);
  }
  if (!['build', 'work', 'trade'].includes(buildPhase.family)) {
    throw new Error(`build-priority autonomy path did not execute expected family (got ${buildPhase.family})`);
  }
  assertReasoningQuality(autonomousSnapshots, 'autonomous');

  console.log('[e2e] running planner-guided manual sequence for endpoint coverage...');
  await executeUntil(
    'manual_build',
    (plans) => pickFirstOkAction(plans, ['build', 'trade', 'work', 'fight', 'rest']),
    (executed) => ['claim_plot', 'start_build', 'do_work'].includes(executed),
    10,
  );
  await executeUntil(
    'manual_trade',
    (plans) => pickFirstOkAction(plans, ['trade', 'work', 'build', 'fight', 'rest']),
    (executed) => executed === 'buy_arena' || executed === 'sell_arena',
    10,
  );

  const consoleErrors = [];
  const pageErrors = [];
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1720, height: 1000 } });
  const walletForUi = String(primaryAgent.walletAddress || '').toLowerCase();

  await context.addInitScript(
    ({ agentId, wallet }) => {
      localStorage.setItem('aitown_onboarded', '1');
      localStorage.setItem('aitown_my_agent_id', agentId);
      localStorage.setItem('aitown_my_wallet', wallet);
    },
    { agentId: primaryAgent.id, wallet: walletForUi },
  );

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err.message || err));
  });

  console.log('[e2e] opening /town and validating right panel...');
  await page.goto(`${APP_BASE}/town`, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('[data-testid="town-right-panel"]', { timeout: UI_TIMEOUT_MS });
  await page.waitForSelector('[data-testid="agent-hud-panel"]', { timeout: UI_TIMEOUT_MS });
  await page.waitForSelector('[data-testid="activity-panel"]', { timeout: UI_TIMEOUT_MS });
  await page.waitForSelector('[data-testid="decision-trace-panel"]', { timeout: UI_TIMEOUT_MS });

  const decisionItem = page.locator('[data-testid^="decision-trace-item-"]').first();
  await decisionItem.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });
  const baselineDecisionText = compact(await decisionItem.innerText(), 1200);
  if (!baselineDecisionText.toLowerCase().includes(primaryName.toLowerCase())) {
    throw new Error(`Decision trace item did not include focused agent name (${primaryName})`);
  }

  const breakdown = page.locator('[data-testid="agent-log-breakdown"]').first();
  await breakdown.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });
  await breakdown.locator('summary').click();
  await breakdown.getByText('Executed reasoning').waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  console.log('[e2e] forcing one more action and checking live UI refresh...');
  const currentAgent = await getAgent(primaryAgent.id);
  const currentTickMs = currentAgent.lastTickAt ? Date.parse(currentAgent.lastTickAt) : 0;
  const livePlans = await getPlans(primaryAgent.id);
  const liveAction = pickFirstOkAction(livePlans, ['trade', 'work', 'build', 'fight', 'rest']);
  await runAction(primaryAgent.id, liveAction, primaryAgent.walletAddress);
  const refreshedAgent = await waitForAgentTick(primaryAgent.id, currentTickMs);

  const updatedDecisionText = await waitForCondition(
    'decision trace refresh in browser',
    async () => {
      const value = compact(await decisionItem.innerText(), 1200);
      return value !== baselineDecisionText ? value : false;
    },
    UI_TIMEOUT_MS,
  );

  const screenshotPath = path.join(ARTIFACT_DIR, 'right-panel.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const report = {
    ok: true,
    townId: town.id,
    reset: resetResult,
    focusedAgent: {
      id: primaryAgent.id,
      name: primaryName,
      latestAction: refreshedAgent.lastActionType,
      latestTickAt: refreshedAgent.lastTickAt,
      latestReasoning: compact(refreshedAgent.lastReasoning || '', 400),
    },
    autonomy: {
      maxAttemptsPerPhase: AUTONOMY_MAX_ATTEMPTS,
      snapshots: autonomousSnapshots,
      familiesObserved: Array.from(autonomousFamilies),
    },
    actions: actionSnapshots,
    baselineDecisionText: compact(baselineDecisionText, 320),
    updatedDecisionText: compact(updatedDecisionText, 320),
    consoleErrors,
    pageErrors,
    screenshotPath,
  };

  const reportPath = path.join(ARTIFACT_DIR, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  await context.close();
  await browser.close();

  const fatalConsoleErrors = consoleErrors.filter((msg) => {
    if (isIgnorableConsoleError(msg)) return false;
    return /(uncaught|typeerror|referenceerror|syntaxerror|rangeerror)/i.test(String(msg));
  });
  if (fatalConsoleErrors.length > 0) {
    throw new Error(`Browser console errors detected: ${fatalConsoleErrors.slice(0, 2).join(' | ')}`);
  }

  const fatalPageErrors = pageErrors.filter((msg) => !/error creating webgl context/i.test(String(msg)));
  if (fatalPageErrors.length > 0) {
    throw new Error(`Page runtime errors detected: ${fatalPageErrors.slice(0, 2).join(' | ')}`);
  }

  console.log(`[e2e] success. report: ${reportPath}`);
}

main().catch(async (error) => {
  const failurePath = path.join(ARTIFACT_DIR, 'failure.txt');
  try {
    await ensureDir(ARTIFACT_DIR);
    await fs.writeFile(failurePath, String(error?.stack || error?.message || error), 'utf8');
  } catch {
    // ignore write failure
  }
  console.error(`[e2e] failed: ${String(error?.message || error)}`);
  console.error(`[e2e] failure details: ${failurePath}`);
  process.exit(1);
});
