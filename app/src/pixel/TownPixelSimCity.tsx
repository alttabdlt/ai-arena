/**
 * TownPixelSimCity — Main page for the pixel-art AI Town.
 * Assembles PixiJS world + HTML overlay UI panels.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Application } from '@pixi/react';
import { WorldScene } from './components/PixelStage';
import { useTownData } from './hooks/useTownData';
import { usePixelCamera } from './hooks/usePixelCamera';
import { useAgentSim } from './hooks/useAgentSim';
import { useAssetLoader } from './hooks/useAssetLoader';
import { useDayNight } from './hooks/useDayNight';
import { getEconomicState } from './types';
import type { Agent, Plot, AgentGoalView, ChatMessage, ActivityItem, EconomySwapRow, AgentAction } from './types';
import {
  TILE_SIZE, PLOT_PX, ROAD_PX,
  ZONE_COLORS_CSS, ARCHETYPE_COLORS_CSS, ARCHETYPE_GLYPH,
  ECONOMIC_INDICATORS, ACTIVITY_INDICATORS,
} from './constants';
import { playSound, isSoundEnabled, setSoundEnabled } from '../utils/sounds';
import { WalletConnect } from '../components/WalletConnect';
import { useDegenState } from '../hooks/useDegenState';
import { DegenDashboard } from '../components/degen/DegenDashboard';
import { PositionTracker } from '../components/degen/PositionTracker';
import { SwapTicker } from '../components/degen/SwapTicker';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@ui/resizable';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@ui/button';

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return `${Math.floor(diff / 86400_000)}d`;
}

// ── Minimap ──
function Minimap({
  plots, agents, simsRef, selectedAgentId, onSelectAgent, onPanTo,
}: {
  plots: Plot[];
  agents: Agent[];
  simsRef: React.MutableRefObject<Map<string, import('./types').AgentSim2D>>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onPanTo: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let alive = true;
    const draw = () => {
      if (!alive) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0a0f1f';
      ctx.fillRect(0, 0, W, H);

      if (plots.length === 0) { requestAnimationFrame(draw); return; }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of plots) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      const cols = maxX - minX + 1;
      const rows = maxY - minY + 1;
      const tileW = Math.floor((W - 8) / cols);
      const tileH = Math.floor((H - 8) / rows);
      const tileSize = Math.min(tileW, tileH, 24);
      const ox = (W - cols * tileSize) / 2;
      const oy = (H - rows * tileSize) / 2;

      // Plots
      for (const p of plots) {
        const px = ox + (p.x - minX) * tileSize;
        const py = oy + (p.y - minY) * tileSize;
        const color = ZONE_COLORS_CSS[p.zone] || '#334155';
        ctx.fillStyle = p.status === 'BUILT' ? color : (p.status === 'UNDER_CONSTRUCTION' ? color : '#1e293b');
        ctx.globalAlpha = p.status === 'BUILT' ? 0.7 : 0.3;
        ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        ctx.globalAlpha = 1;
      }

      // Agent dots
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const gridSpan = PLOT_PX + ROAD_PX;

      for (const a of agents) {
        const sim = simsRef.current.get(a.id);
        if (!sim || sim.state === 'DEAD') continue;
        // Convert world coords to minimap coords
        const worldCol = sim.x / gridSpan + centerX;
        const worldRow = sim.y / gridSpan + centerY;
        const dotX = ox + (worldCol - minX) * tileSize + tileSize / 2;
        const dotY = oy + (worldRow - minY) * tileSize + tileSize / 2;
        const isSelected = a.id === selectedAgentId;
        ctx.fillStyle = ARCHETYPE_COLORS_CSS[a.archetype] || '#93c5fd';
        ctx.beginPath();
        ctx.arc(dotX, dotY, isSelected ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      requestAnimationFrame(draw);
    };
    draw();
    return () => { alive = false; };
  }, [plots, agents, simsRef, selectedAgentId]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || plots.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of plots) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const tileW = Math.floor((canvas.width - 8) / cols);
    const tileH = Math.floor((canvas.height - 8) / rows);
    const tileSize = Math.min(tileW, tileH, 24);
    const ox = (canvas.width - cols * tileSize) / 2;
    const oy = (canvas.height - rows * tileSize) / 2;

    const gridSpan = PLOT_PX + ROAD_PX;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Check agent clicks first
    for (const a of agents) {
      const sim = simsRef.current.get(a.id);
      if (!sim || sim.state === 'DEAD') continue;
      const worldCol = sim.x / gridSpan + centerX;
      const worldRow = sim.y / gridSpan + centerY;
      const dotX = ox + (worldCol - minX) * tileSize + tileSize / 2;
      const dotY = oy + (worldRow - minY) * tileSize + tileSize / 2;
      if (Math.abs(cx - dotX) < 8 && Math.abs(cy - dotY) < 8) {
        onSelectAgent(a.id);
        return;
      }
    }

    // Pan to clicked location
    const col = (cx - ox) / tileSize + minX;
    const row = (cy - oy) / tileSize + minY;
    const worldX = (col - centerX) * gridSpan;
    const worldY = (row - centerY) * gridSpan;
    onPanTo(worldX, worldY);
  };

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={140}
      className="rounded cursor-pointer"
      onClick={handleClick}
    />
  );
}

// ── Main Component ──
export default function TownPixelSimCity() {
  const data = useTownData();
  const {
    towns, town, agents, economy, swaps, events,
    agentGoalsById, chatMessages, agentActions, agentActionsLoading, activityFeed,
    loading, error,
    selectedTownId, setSelectedTownId,
    selectedPlotId, setSelectedPlotId,
    selectedAgentId, setSelectedAgentId,
    relationshipsRef, tradeByAgentId, weather, economicState,
    agentById, requestChat,
  } = data;

  const assets = useAssetLoader();
  const { tint: dayNightTint, alpha: dayNightAlpha } = useDayNight();
  const camera = usePixelCamera(0, 0, 2.5);
  const { simsRef, tick: tickSim } = useAgentSim(
    agents, town?.plots ?? [], relationshipsRef, requestChat, town?.id,
  );

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const degen = useDegenState(walletAddress ?? undefined);

  const containerRef = useRef<HTMLDivElement>(null);

  const plots = town?.plots ?? [];
  const selectedPlot = plots.find(p => p.id === selectedPlotId) ?? null;
  const selectedAgent = agents.find(a => a.id === selectedAgentId) ?? null;

  // Trade ticker items for SwapTicker
  const tradeTickerItems = useMemo(() =>
    swaps.slice(0, 20).map(s => ({
      id: s.id,
      agent: s.agent,
      side: s.side,
      amountArena: s.side === 'BUY_ARENA' ? s.amountOut : s.amountIn,
    })),
  [swaps]);

  // Swaps for selected agent
  const selectedAgentSwaps = useMemo(() => {
    if (!selectedAgentId) return [];
    return swaps.filter(s => s.agent.id === selectedAgentId).slice(0, 5);
  }, [swaps, selectedAgentId]);

  // ── Loading state ──
  if (loading && !town) {
    return (
      <div className="h-[100svh] w-full grid place-items-center bg-[#050914] text-slate-200">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">Loading pixel town...</p>
        </div>
      </div>
    );
  }

  if (error && !town) {
    return (
      <div className="h-[100svh] w-full grid place-items-center bg-[#050914] text-slate-200">
        <div className="text-center max-w-md">
          <p className="text-sm text-red-400">{error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()} variant="secondary">Reload</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!town) {
    return (
      <div className="h-[100svh] w-full grid place-items-center bg-[#050914] text-slate-200">
        <div className="text-center">
          <p className="text-sm">No town found.</p>
          <p className="mt-1 text-xs text-slate-400">Create one via POST /api/v1/town/next or restart the backend.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100svh] w-full overflow-hidden bg-[#050914]">
      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-slate-950/90 border-b border-slate-800/40 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-400">PIXEL TOWN</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-slate-700/60 bg-slate-950/40 text-[10px] text-slate-200"
            onClick={() => (window.location.href = '/town')}
          >
            3D View
          </Button>
          {economy && Number.isFinite(economy.spotPrice) && (
            <span className="text-[10px] text-slate-500 font-mono">$ARENA {economy.spotPrice.toFixed(4)}</span>
          )}
        </div>
        <PositionTracker balance={degen.balance} totalPnL={degen.totalPnL} spotPrice={economy?.spotPrice ?? null} />
        <WalletConnect compact onAddressChange={setWalletAddress} />
      </div>

      {/* ── Main content: PixiJS canvas + Degen sidebar ── */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={65} minSize={40}>
          <div className="relative h-full w-full overflow-hidden" ref={containerRef}>
            {/* PixiJS Canvas */}
            {assets.ready ? (
              <div
                className="absolute inset-0"
                onPointerDown={camera.onPointerDown}
                onPointerMove={camera.onPointerMove}
                onPointerUp={camera.onPointerUp}
                onWheel={camera.onWheel}
              >
                <Application
                  resizeTo={containerRef as any}
                  background="#050914"
                  antialias={false}
                  resolution={window.devicePixelRatio || 1}
                >
                  <WorldScene
                    plots={plots}
                    agents={agents}
                    simsRef={simsRef}
                    assets={assets}
                    camera={camera.camera}
                    selectedPlotId={selectedPlotId}
                    selectedAgentId={selectedAgentId}
                    onSelectPlot={setSelectedPlotId}
                    onSelectAgent={(id) => { setSelectedAgentId(id); setSelectedPlotId(null); }}
                    tradeByAgentId={tradeByAgentId}
                    weather={weather}
                    economicState={economicState}
                    tickSim={tickSim}
                    dayNightTint={dayNightTint}
                    dayNightAlpha={dayNightAlpha}
                    updateFollow={camera.updateFollow}
                  />
                </Application>
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-500" />
                  <p className="mt-2 text-xs text-slate-500">Loading pixel assets...</p>
                </div>
              </div>
            )}

            {/* ── Overlay UI ── */}
            <div className="pointer-events-none absolute inset-0">
              {/* HUD Panel — top left */}
              <div className="pointer-events-auto absolute left-3 top-3 w-[340px] max-w-[calc(100vw-24px)]">
                <div className="hud-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold bg-gradient-to-r from-slate-50 to-slate-300 bg-clip-text text-transparent">
                          AI Town
                        </span>
                        <span className="hud-chip">{town.status}</span>
                        {typeof town.level === 'number' && <span className="hud-chip">Lv {town.level}</span>}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        <span className="font-mono">{town.name}</span>
                        <span className="text-slate-500"> · </span>
                        <span className="text-slate-400">{town.theme || 'unthemed'}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{town.builtPlots}/{town.totalPlots} plots built</span>
                          <span className="font-mono text-slate-200">{Math.round(town.completionPct)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                            style={{ width: `${Math.max(0, Math.min(100, town.completionPct))}%` }}
                          />
                        </div>
                      </div>
                      {town.yieldPerTick != null && Number.isFinite(town.yieldPerTick) && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          yield/tick <span className="font-mono text-slate-200">{town.yieldPerTick.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="hud-kicker">Town</label>
                    <select
                      className="h-8 flex-1 min-w-[140px] rounded-md border border-slate-700/50 bg-slate-950/40 px-2 text-xs text-slate-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={selectedTownId ?? ''}
                      onChange={(e) => setSelectedTownId(e.target.value || null)}
                    >
                      {towns.map((t) => (
                        <option key={t.id} value={t.id}>
                          L{t.level} · {t.name} ({t.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 border-t border-slate-800/60 pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{weather === 'clear' ? '☀️' : weather === 'rain' ? '🌧️' : '⛈️'} {weather}</span>
                        <span>· {economicState.sentiment === 'bull' ? '📈' : economicState.sentiment === 'bear' ? '📉' : '➖'}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
                        onClick={() => {
                          const next = !soundOn;
                          setSoundOn(next);
                          setSoundEnabled(next);
                          if (next) playSound('click');
                        }}
                        title={soundOn ? 'Mute sounds' : 'Enable sounds'}
                      >
                        {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Agent HUD — top right ── */}
              <div className="pointer-events-auto absolute right-3 top-3 max-w-[320px]">
                {selectedAgent && (
                  <div className="hud-panel p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-4 w-4 rounded-full shrink-0"
                        style={{ backgroundColor: ARCHETYPE_COLORS_CSS[selectedAgent.archetype] || '#93c5fd' }}
                      />
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold text-slate-100 truncate">
                          {(ARCHETYPE_GLYPH[selectedAgent.archetype] || '●') + ' ' + selectedAgent.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {selectedAgent.archetype}
                          {' '}
                          {(() => {
                            const econ = getEconomicState(selectedAgent.bankroll + selectedAgent.reserveBalance, false);
                            const ind = ECONOMIC_INDICATORS[econ];
                            return (
                              <>
                                <span className="text-slate-600">·</span>{' '}
                                <span style={{ color: ind.color }}>{ind.emoji} {econ.toLowerCase()}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      {(() => {
                        const sim = simsRef.current.get(selectedAgent.id);
                        const state = sim?.state ?? 'WALKING';
                        const ind = ACTIVITY_INDICATORS[state];
                        return (
                          <span className="ml-auto shrink-0 hud-chip">
                            {ind?.emoji ?? ''} {state}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-300">
                      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                        <div className="text-slate-500">$ARENA</div>
                        <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
                      </div>
                      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                        <div className="text-slate-500">reserve</div>
                        <div className="font-mono text-slate-100">{Math.round(selectedAgent.reserveBalance)}</div>
                      </div>
                      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                        <div className="text-slate-500">W/L</div>
                        <div className="font-mono text-slate-100">{selectedAgent.wins}/{selectedAgent.losses}</div>
                      </div>
                      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                        <div className="text-slate-500">ELO</div>
                        <div className="font-mono text-slate-100">{selectedAgent.elo}</div>
                      </div>
                    </div>

                    {/* Health bar */}
                    {(() => {
                      const sim = simsRef.current.get(selectedAgent.id);
                      const health = sim?.health ?? 100;
                      const pct = Math.max(0, Math.min(100, health));
                      const barClass = pct < 25 ? 'bg-gradient-to-r from-red-500 to-amber-500'
                        : pct < 60 ? 'bg-gradient-to-r from-amber-500 to-sky-500'
                        : 'bg-gradient-to-r from-emerald-500 to-sky-500';
                      return (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>health</span>
                            <span className="font-mono text-slate-300">{Math.round(pct)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Goal */}
                    {(() => {
                      const g = agentGoalsById[selectedAgent.id];
                      if (!g) return null;
                      const done = !!g.progress?.done;
                      return (
                        <div className={`mt-2 rounded-md border px-2 py-1.5 ${done ? 'border-emerald-700/40 bg-emerald-950/15' : 'border-slate-800/70 bg-slate-950/30'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] text-slate-500">Goal</div>
                            <div className={`text-[10px] font-mono ${done ? 'text-emerald-300' : 'text-slate-500'}`}>
                              {safeTrim(g.progress?.label, 36)}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-200 font-semibold truncate">{safeTrim(g.goalTitle, 80)}</div>
                          <div className="text-[10px] text-slate-400 truncate">Next: {safeTrim(g.next?.detail, 120)}</div>
                        </div>
                      );
                    })()}

                    {/* Agent switcher */}
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto py-1">
                      {agents.map((a) => {
                        const color = ARCHETYPE_COLORS_CSS[a.archetype] || '#93c5fd';
                        const isActive = a.id === selectedAgentId;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            title={`${ARCHETYPE_GLYPH[a.archetype] || '●'} ${a.name}`}
                            className={`shrink-0 rounded-full border-2 transition-all ${
                              isActive ? 'border-white scale-125' : 'border-transparent hover:border-slate-500 opacity-70 hover:opacity-100'
                            }`}
                            style={{ width: 20, height: 20, backgroundColor: color }}
                            onClick={() => {
                              setSelectedAgentId(a.id);
                              setSelectedPlotId(null);
                              camera.followAgent(a.id);
                              playSound('click');
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Minimap — bottom left ── */}
              <div className="pointer-events-auto absolute left-3 bottom-3 z-10">
                <div className="hud-panel p-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <div className="hud-title text-[10px]">Tactical Map</div>
                  </div>
                  <Minimap
                    plots={plots}
                    agents={agents}
                    simsRef={simsRef}
                    selectedAgentId={selectedAgentId}
                    onSelectAgent={(id) => { setSelectedAgentId(id); setSelectedPlotId(null); camera.followAgent(id); }}
                    onPanTo={camera.panTo}
                  />
                </div>
              </div>

              {/* ── Activity Feed — bottom center ── */}
              <div className="pointer-events-auto absolute left-[200px] bottom-3 max-w-[420px]">
                {activityFeed.length > 0 && (
                  <div className="hud-panel p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="hud-title text-[10px]">Activity</div>
                        <span className="hud-chip">{activityFeed.length}</span>
                      </div>
                    </div>
                    <div className="max-h-[150px] overflow-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700/60">
                      {activityFeed.map((item) => {
                        if (item.kind === 'swap') {
                          const s = item.data;
                          const color = ARCHETYPE_COLORS_CSS[s.agent?.archetype] || '#93c5fd';
                          const glyph = ARCHETYPE_GLYPH[s.agent?.archetype] || '●';
                          const isBuy = s.side === 'BUY_ARENA';
                          const amountArena = isBuy ? s.amountOut : s.amountIn;
                          return (
                            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800/50 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300">
                              <div className="min-w-0 truncate">
                                <span className="font-mono" style={{ color }}>{glyph} {s.agent?.name || '?'}</span>
                                {' '}
                                <span className="text-slate-400">{isBuy ? 'bought' : 'sold'}</span>
                                {' '}
                                <span className="font-mono text-slate-200">{Math.round(amountArena).toLocaleString()}</span>
                                {' '}
                                <span className="text-slate-400">ARENA</span>
                              </div>
                            </div>
                          );
                        } else {
                          const e = item.data;
                          const agent = e.agentId ? agentById.get(e.agentId) : null;
                          const color = agent ? (ARCHETYPE_COLORS_CSS[agent.archetype] || '#93c5fd') : '#93c5fd';
                          const glyph = agent ? (ARCHETYPE_GLYPH[agent.archetype] || '●') : '●';
                          const emoji = e.eventType === 'PLOT_CLAIMED' ? '📍' :
                            e.eventType === 'BUILD_STARTED' ? '🏗️' :
                            e.eventType === 'BUILD_COMPLETED' ? '✅' :
                            e.eventType === 'TOWN_COMPLETED' ? '🎉' :
                            e.eventType === 'YIELD_DISTRIBUTED' ? '💎' :
                            e.eventType === 'TRADE' ? '💱' : '📝';
                          return (
                            <div key={e.id} className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 truncate">
                                  <span>{emoji}</span>{' '}
                                  {agent && (
                                    <span className="font-mono" style={{ color }}>{glyph} {agent.name}</span>
                                  )}{' '}
                                  <span className="text-slate-400">{e.title || e.eventType}</span>
                                </div>
                                <span className="shrink-0 text-slate-600">· {timeAgo(e.createdAt)}</span>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Inspector — bottom right ── */}
              {(selectedPlot || (selectedAgent && !selectedPlot)) && (
                <div className="pointer-events-auto absolute right-3 bottom-3 w-[360px] max-w-[calc(100vw-24px)]">
                  <div className="hud-panel p-3">
                    {/* Plot Inspector */}
                    {selectedPlot && (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="hud-title">Plot #{selectedPlot.plotIndex}</div>
                              <span className="hud-chip">{selectedPlot.zone}</span>
                              <span className="hud-chip">{selectedPlot.status}</span>
                            </div>
                            <div className="mt-1 text-sm text-slate-200 font-mono truncate">
                              {selectedPlot.buildingName || 'Available'}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-slate-300 hover:text-slate-100"
                            onClick={() => setSelectedPlotId(null)}
                          >
                            Close
                          </Button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                          <div className="rounded-md border border-slate-800/70 bg-slate-950/35 p-2">
                            <div className="text-slate-500">API calls</div>
                            <div className="font-mono text-slate-100">{selectedPlot.apiCallsUsed ?? 0}</div>
                          </div>
                          <div className="rounded-md border border-slate-800/70 bg-slate-950/35 p-2">
                            <div className="text-slate-500">$ARENA</div>
                            <div className="font-mono text-slate-100">{selectedPlot.buildCostArena ?? 0}</div>
                          </div>
                        </div>
                        {selectedPlot.ownerId && (
                          <div className="mt-2 text-[11px] text-slate-400">
                            Owner:{' '}
                            <span className="text-slate-200 font-mono">
                              {(() => {
                                const owner = agentById.get(selectedPlot.ownerId!);
                                if (!owner) return selectedPlot.ownerId!.slice(0, 8);
                                return `${ARCHETYPE_GLYPH[owner.archetype] || '●'} ${owner.name}`;
                              })()}
                            </span>
                          </div>
                        )}
                        {selectedPlot.buildingDesc && (
                          <div className="mt-2 text-xs text-slate-300 leading-snug">
                            {selectedPlot.buildingDesc}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agent Inspector */}
                    {selectedAgent && !selectedPlot && (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="hud-title">Agent</div>
                              <span className="hud-chip">{selectedAgent.archetype}</span>
                              <span className="hud-chip">ELO {selectedAgent.elo}</span>
                            </div>
                            <div className="mt-1 text-sm text-slate-200 font-mono truncate">
                              {(ARCHETYPE_GLYPH[selectedAgent.archetype] || '●') + ' ' + selectedAgent.name}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-slate-300 hover:text-slate-100"
                            onClick={() => setSelectedAgentId(null)}
                          >
                            Close
                          </Button>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-300">
                          <div className="rounded-md border border-slate-800/70 bg-slate-950/35 p-2 text-center">
                            <div className="text-slate-500">$ARENA</div>
                            <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
                          </div>
                          <div className="rounded-md border border-slate-800/70 bg-slate-950/35 p-2 text-center">
                            <div className="text-slate-500">reserve</div>
                            <div className="font-mono text-slate-100">{Math.round(selectedAgent.reserveBalance)}</div>
                          </div>
                          <div className="rounded-md border border-slate-800/70 bg-slate-950/35 p-2 text-center">
                            <div className="text-slate-500">W/L</div>
                            <div className="font-mono text-slate-100">{selectedAgent.wins}/{selectedAgent.losses}</div>
                          </div>
                          <div className="rounded-md border border-slate-800/70 bg-slate-950/35 p-2 text-center">
                            <div className="text-slate-500">ELO</div>
                            <div className="font-mono text-slate-100">{selectedAgent.elo}</div>
                          </div>
                        </div>

                        {/* Recent trades */}
                        {selectedAgentSwaps.length > 0 && (
                          <div className="mt-3 border-t border-slate-800/60 pt-2">
                            <div className="text-[11px] font-semibold text-slate-200">Recent Trades</div>
                            <div className="mt-1 space-y-1">
                              {selectedAgentSwaps.map((s) => {
                                const isBuy = s.side === 'BUY_ARENA';
                                const amountArena = isBuy ? s.amountOut : s.amountIn;
                                const price = isBuy ? s.amountIn / Math.max(1, s.amountOut) : s.amountOut / Math.max(1, s.amountIn);
                                return (
                                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800/50 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300">
                                    <div className="min-w-0 truncate">
                                      <span className="text-slate-400">{isBuy ? 'BUY' : 'SELL'}</span>{' '}
                                      <span className="font-mono text-slate-200">{Math.round(amountArena).toLocaleString()}</span>{' '}
                                      <span className="text-slate-400">ARENA</span>
                                    </div>
                                    <div className="shrink-0 font-mono text-slate-500">@ {price.toFixed(3)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Recent Actions */}
                        <div className="mt-3 border-t border-slate-800/60 pt-2">
                          <div className="text-[11px] font-semibold text-slate-200 mb-2">
                            Recent Actions {agentActionsLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                          </div>
                          <div className="max-h-[140px] overflow-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700/60">
                            {agentActions.length === 0 && !agentActionsLoading && (
                              <div className="text-[10px] text-slate-500">No recent actions</div>
                            )}
                            {agentActions.map((action) => {
                              const workIcon = action.workType === 'MINE' ? '⛏️' : '🔨';
                              const workLabel = action.plotIndex != null ? `Plot #${action.plotIndex}` : (action.workType || 'Work');
                              const content = typeof action.content === 'string' ? action.content.trim() : '';
                              const contentLine = content.length > 80 ? `${content.slice(0, 80)}...` : content;
                              return (
                                <div key={action.id} className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px] text-slate-300">
                                  {action.type === 'work' ? (
                                    <>
                                      <span className="text-amber-400">{workIcon}</span>{' '}
                                      <span className="text-slate-400">{workLabel}</span>
                                      {contentLine && <div className="mt-0.5 text-slate-400 truncate">{contentLine}</div>}
                                    </>
                                  ) : (
                                    <>
                                      <span>{action.eventType === 'PLOT_CLAIMED' ? '📍' : action.eventType === 'BUILD_STARTED' ? '🏗️' : action.eventType === 'BUILD_COMPLETED' ? '✅' : '📝'}</span>{' '}
                                      <span className="text-slate-200">{action.title || action.eventType}</span>
                                    </>
                                  )}
                                  <span className="text-slate-600 ml-1">· {timeAgo(action.createdAt)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-slate-800/30" />

        <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
          <DegenDashboard degen={degen} agents={agents} walletAddress={walletAddress} chatMessages={chatMessages} selectedAgentId={selectedAgentId} />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ── Bottom Ticker ── */}
      <SwapTicker trades={tradeTickerItems} />
    </div>
  );
}
