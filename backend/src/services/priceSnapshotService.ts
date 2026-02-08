/**
 * PriceSnapshotService — Captures $ARENA price snapshots every 30 seconds
 * for the price chart in the Degen Dashboard.
 */

import { prisma } from '../config/database';
import { offchainAmmService } from './offchainAmmService';

const SNAPSHOT_INTERVAL_MS = 30_000; // 30 seconds

class PriceSnapshotService {
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the snapshot loop. Called once from index.ts on startup.
   */
  start() {
    if (this.timer) return;
    console.log('📸 Price snapshot service started (30s interval)');
    this.backfillFromSwaps().catch(() => {});
    this.timer = setInterval(() => this.captureSnapshot(), SNAPSHOT_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async captureSnapshot() {
    try {
      const pool = await offchainAmmService.getPoolSummary();
      const price = pool.spotPrice;
      if (!Number.isFinite(price) || price <= 0) return;

      // Count swaps in the last 30 seconds as volume proxy
      const since = new Date(Date.now() - SNAPSHOT_INTERVAL_MS);
      const recentSwaps = await prisma.economySwap.findMany({
        where: { createdAt: { gte: since } },
        select: { amountIn: true },
      });
      const volume = recentSwaps.reduce((sum, s) => sum + s.amountIn, 0);

      await prisma.priceSnapshot.create({ data: { price, volume } });
    } catch (err: any) {
      // Non-fatal — just skip this tick
      console.warn(`[PriceSnapshot] capture failed: ${err.message}`);
    }
  }

  /**
   * On startup, if no snapshots exist, seed from EconomySwap.priceAfter history.
   */
  async backfillFromSwaps() {
    const count = await prisma.priceSnapshot.count();
    if (count > 0) return;

    const swaps = await prisma.economySwap.findMany({
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { priceAfter: true, amountIn: true, createdAt: true },
    });

    if (swaps.length === 0) return;

    const records = swaps.map((s) => ({
      price: s.priceAfter,
      volume: s.amountIn,
      createdAt: s.createdAt,
    }));

    await prisma.priceSnapshot.createMany({ data: records });
    console.log(`📸 Backfilled ${records.length} price snapshots from swap history`);
  }

  /**
   * Get price history for a given period.
   */
  async getHistory(period: '1h' | '6h' | '24h' | '7d' = '1h') {
    const periodMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - (periodMs[period] || periodMs['1h']));

    const snapshots = await prisma.priceSnapshot.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { price: true, volume: true, createdAt: true },
    });

    return snapshots;
  }
}

export const priceSnapshotService = new PriceSnapshotService();
