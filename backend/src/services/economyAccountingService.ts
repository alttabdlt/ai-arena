import { EconomyLedgerType } from '@prisma/client';

type TxLike = any;

export type EconomyBudgetBucket = 'opsBudget' | 'pvpBudget' | 'rescueBudget' | 'insuranceBudget';

const ECONOMY_INIT_RESERVE = Number.parseInt(process.env.ECONOMY_INIT_RESERVE || '10000', 10);
const ECONOMY_INIT_ARENA = Number.parseInt(process.env.ECONOMY_INIT_ARENA || '10000', 10);
const ECONOMY_INIT_FEE_BPS = Number.parseInt(process.env.ECONOMY_FEE_BPS || '100', 10);

const CLAIM_TOWN_BPS = Number.parseInt(process.env.ECONOMY_CLAIM_TOWN_BPS || '5000', 10);
const CLAIM_OPS_BPS = Number.parseInt(process.env.ECONOMY_CLAIM_OPS_BPS || '2500', 10);
const CLAIM_PVP_BPS = Number.parseInt(process.env.ECONOMY_CLAIM_PVP_BPS || '1500', 10);
const CLAIM_INSURANCE_BPS = Number.parseInt(process.env.ECONOMY_CLAIM_INSURANCE_BPS || '1000', 10);

const BUILD_TOWN_BPS = Number.parseInt(process.env.ECONOMY_BUILD_TOWN_BPS || String(CLAIM_TOWN_BPS), 10);
const BUILD_OPS_BPS = Number.parseInt(process.env.ECONOMY_BUILD_OPS_BPS || String(CLAIM_OPS_BPS), 10);
const BUILD_PVP_BPS = Number.parseInt(process.env.ECONOMY_BUILD_PVP_BPS || String(CLAIM_PVP_BPS), 10);
const BUILD_INSURANCE_BPS = Number.parseInt(process.env.ECONOMY_BUILD_INSURANCE_BPS || String(CLAIM_INSURANCE_BPS), 10);

const FEE_INSURANCE_BPS = Number.parseInt(process.env.ECONOMY_FEE_INSURANCE_BPS || '7000', 10);

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeBps(raw: number): number {
  return clampInt(raw, 0, 10000);
}

function normalizeFourWayBps(
  a: number,
  b: number,
  c: number,
  d: number,
): { a: number; b: number; c: number; d: number } {
  const na = normalizeBps(a);
  const nb = normalizeBps(b);
  const nc = normalizeBps(c);
  const nd = normalizeBps(d);
  const total = na + nb + nc + nd;
  if (total === 10000) return { a: na, b: nb, c: nc, d: nd };
  if (total <= 0) return { a: 5000, b: 2500, c: 1500, d: 1000 };

  const ra = Math.floor((na * 10000) / total);
  const rb = Math.floor((nb * 10000) / total);
  const rc = Math.floor((nc * 10000) / total);
  const rd = 10000 - (ra + rb + rc);
  return { a: ra, b: rb, c: rc, d: rd };
}

const CLAIM_SPLIT_BPS = normalizeFourWayBps(
  CLAIM_TOWN_BPS,
  CLAIM_OPS_BPS,
  CLAIM_PVP_BPS,
  CLAIM_INSURANCE_BPS,
);

const BUILD_SPLIT_BPS = normalizeFourWayBps(
  BUILD_TOWN_BPS,
  BUILD_OPS_BPS,
  BUILD_PVP_BPS,
  BUILD_INSURANCE_BPS,
);

export type ContributionSplit = {
  townInvested: number;
  opsBudget: number;
  pvpBudget: number;
  insuranceBudget: number;
};

export function splitClaimContribution(amountRaw: number): ContributionSplit {
  const amount = Math.max(0, Math.floor(amountRaw));
  const townInvested = Math.floor((amount * CLAIM_SPLIT_BPS.a) / 10000);
  const opsBudget = Math.floor((amount * CLAIM_SPLIT_BPS.b) / 10000);
  const pvpBudget = Math.floor((amount * CLAIM_SPLIT_BPS.c) / 10000);
  const insuranceBudget = Math.max(0, amount - (townInvested + opsBudget + pvpBudget));
  return { townInvested, opsBudget, pvpBudget, insuranceBudget };
}

export function splitBuildContribution(amountRaw: number): ContributionSplit {
  const amount = Math.max(0, Math.floor(amountRaw));
  const townInvested = Math.floor((amount * BUILD_SPLIT_BPS.a) / 10000);
  const opsBudget = Math.floor((amount * BUILD_SPLIT_BPS.b) / 10000);
  const pvpBudget = Math.floor((amount * BUILD_SPLIT_BPS.c) / 10000);
  const insuranceBudget = Math.max(0, amount - (townInvested + opsBudget + pvpBudget));
  return { townInvested, opsBudget, pvpBudget, insuranceBudget };
}

export function splitArenaFeeToBudgets(amountArenaRaw: number): { insuranceBudget: number; opsBudget: number } {
  const amountArena = Math.max(0, Math.floor(amountArenaRaw));
  const insuranceBps = normalizeBps(FEE_INSURANCE_BPS);
  const insuranceBudget = Math.floor((amountArena * insuranceBps) / 10000);
  const opsBudget = Math.max(0, amountArena - insuranceBudget);
  return { insuranceBudget, opsBudget };
}

export async function getOrCreateEconomyPool(tx: TxLike): Promise<{
  id: string;
  reserveBalance: number;
  arenaBalance: number;
  feeBps: number;
  opsBudget: number;
  pvpBudget: number;
  rescueBudget: number;
  insuranceBudget: number;
}> {
  const existing = await tx.economyPool.findFirst({ orderBy: { createdAt: 'desc' } });
  if (existing) return existing;

  return tx.economyPool.create({
    data: {
      reserveBalance: Math.max(1000, Math.floor(ECONOMY_INIT_RESERVE) || 10000),
      arenaBalance: Math.max(1000, Math.floor(ECONOMY_INIT_ARENA) || 10000),
      feeBps: Math.max(0, Math.min(1000, Math.floor(ECONOMY_INIT_FEE_BPS) || 100)),
      opsBudget: 0,
      pvpBudget: 0,
      rescueBudget: 0,
      insuranceBudget: 0,
    },
  });
}

type LedgerContext = {
  type: EconomyLedgerType;
  agentId?: string | null;
  townId?: string | null;
  tick?: number | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

export async function appendEconomyLedger(
  tx: TxLike,
  entries: Array<{
    poolId?: string | null;
    source: string;
    destination: string;
    amount: number;
    type: EconomyLedgerType;
    agentId?: string | null;
    townId?: string | null;
    tick?: number | null;
    metadata?: Record<string, unknown>;
  }>,
): Promise<void> {
  const rows = entries
    .map((entry) => ({
      poolId: entry.poolId || null,
      source: entry.source,
      destination: entry.destination,
      amount: Math.max(0, Math.floor(entry.amount)),
      type: entry.type,
      agentId: entry.agentId || null,
      townId: entry.townId || null,
      tick: Number.isFinite(Number(entry.tick)) ? Number(entry.tick) : null,
      metadata: JSON.stringify(entry.metadata || {}),
    }))
    .filter((entry) => entry.amount > 0);

  if (rows.length === 0) return;
  if (rows.length === 1) {
    await tx.economyLedger.create({ data: rows[0] });
    return;
  }
  await tx.economyLedger.createMany({ data: rows });
}

export async function creditPoolBudgets(
  tx: TxLike,
  poolId: string,
  split: Partial<Record<EconomyBudgetBucket, number>>,
  ctx: LedgerContext,
): Promise<void> {
  const opsBudget = Math.max(0, Math.floor(split.opsBudget || 0));
  const pvpBudget = Math.max(0, Math.floor(split.pvpBudget || 0));
  const rescueBudget = Math.max(0, Math.floor(split.rescueBudget || 0));
  const insuranceBudget = Math.max(0, Math.floor(split.insuranceBudget || 0));

  if (opsBudget + pvpBudget + rescueBudget + insuranceBudget <= 0) return;

  await tx.economyPool.update({
    where: { id: poolId },
    data: {
      ...(opsBudget > 0 ? { opsBudget: { increment: opsBudget } } : {}),
      ...(pvpBudget > 0 ? { pvpBudget: { increment: pvpBudget } } : {}),
      ...(rescueBudget > 0 ? { rescueBudget: { increment: rescueBudget } } : {}),
      ...(insuranceBudget > 0 ? { insuranceBudget: { increment: insuranceBudget } } : {}),
    },
  });

  await appendEconomyLedger(tx, [
    ...(opsBudget > 0
      ? [{
          poolId,
          source: ctx.source || 'SYSTEM',
          destination: 'POOL_OPS_BUDGET',
          amount: opsBudget,
          type: ctx.type,
          agentId: ctx.agentId || null,
          townId: ctx.townId || null,
          tick: ctx.tick || null,
          metadata: ctx.metadata || {},
        }]
      : []),
    ...(pvpBudget > 0
      ? [{
          poolId,
          source: ctx.source || 'SYSTEM',
          destination: 'POOL_PVP_BUDGET',
          amount: pvpBudget,
          type: ctx.type,
          agentId: ctx.agentId || null,
          townId: ctx.townId || null,
          tick: ctx.tick || null,
          metadata: ctx.metadata || {},
        }]
      : []),
    ...(rescueBudget > 0
      ? [{
          poolId,
          source: ctx.source || 'SYSTEM',
          destination: 'POOL_RESCUE_BUDGET',
          amount: rescueBudget,
          type: ctx.type,
          agentId: ctx.agentId || null,
          townId: ctx.townId || null,
          tick: ctx.tick || null,
          metadata: ctx.metadata || {},
        }]
      : []),
    ...(insuranceBudget > 0
      ? [{
          poolId,
          source: ctx.source || 'SYSTEM',
          destination: 'POOL_INSURANCE_BUDGET',
          amount: insuranceBudget,
          type: ctx.type,
          agentId: ctx.agentId || null,
          townId: ctx.townId || null,
          tick: ctx.tick || null,
          metadata: ctx.metadata || {},
        }]
      : []),
  ]);
}

export async function debitPoolBudget(
  tx: TxLike,
  poolId: string,
  bucket: EconomyBudgetBucket,
  amountRaw: number,
  ctx: LedgerContext,
  opts?: { allowPartial?: boolean; minimumPayout?: number },
): Promise<number> {
  const amount = Math.max(0, Math.floor(amountRaw));
  if (amount <= 0) return 0;

  const pool = await tx.economyPool.findUnique({
    where: { id: poolId },
    select: { id: true, opsBudget: true, pvpBudget: true, rescueBudget: true, insuranceBudget: true },
  });
  if (!pool) return 0;

  const available = Math.max(0, Math.floor(pool[bucket] || 0));
  if (available <= 0) return 0;

  const requested = opts?.allowPartial ? Math.min(amount, available) : amount;
  const minimumPayout = Math.max(0, Math.floor(opts?.minimumPayout || 0));
  if (requested > available || requested < minimumPayout) return 0;

  const debit = requested;
  await tx.economyPool.update({
    where: { id: poolId },
    data: {
      [bucket]: { decrement: debit },
    },
  });

  await appendEconomyLedger(tx, [
    {
      poolId,
      source:
        bucket === 'opsBudget'
          ? 'POOL_OPS_BUDGET'
          : bucket === 'pvpBudget'
            ? 'POOL_PVP_BUDGET'
            : bucket === 'rescueBudget'
              ? 'POOL_RESCUE_BUDGET'
              : 'POOL_INSURANCE_BUDGET',
      destination: 'AGENT_BANKROLL',
      amount: debit,
      type: ctx.type,
      agentId: ctx.agentId || null,
      townId: ctx.townId || null,
      tick: ctx.tick || null,
      metadata: ctx.metadata || {},
    },
  ]);

  return debit;
}
