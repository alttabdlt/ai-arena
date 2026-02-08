import { useState, useCallback, useMemo } from 'react';
import { Button } from '@ui/button';
import { AnimatedCounter } from './AnimatedCounter';
import { AgentBackingCard } from './AgentBackingCard';
import { PriceChart } from './PriceChart';
import { BackerLeaderboard } from './BackerLeaderboard';
import { playSound } from '../../utils/sounds';
import type { useDegenState } from '../../hooks/useDegenState';

type DegenState = ReturnType<typeof useDegenState>;

interface Agent {
  id: string;
  name: string;
  archetype: string;
  elo: number;
  wins: number;
  losses: number;
  bankroll: number;
}

interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  archetype: string;
  text: string;
  timestamp: number;
  participants: string[];
  outcome?: 'NEUTRAL' | 'BOND' | 'BEEF';
  economicEffect?: { type: string; amount: number; detail: string };
  economicIntent?: string;
}

interface DegenDashboardProps {
  degen: DegenState;
  agents: Agent[];
  walletAddress: string | null;
  chatMessages?: ChatMessage[];
  selectedAgentId?: string | null;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

type Section = 'positions' | 'agents' | 'chart' | 'leaderboard' | 'chat';

// Pinned sections that don't participate in accordion
const PINNED: Section[] = ['chart'];

const ARCHETYPE_COLORS: Record<string, string> = {
  SHARK: '#ef4444',
  ROCK: '#94a3b8',
  CHAMELEON: '#34d399',
  DEGEN: '#fbbf24',
  GRINDER: '#818cf8',
};

const ARCHETYPE_GLYPH: Record<string, string> = {
  SHARK: '▲',
  ROCK: '●',
  CHAMELEON: '◆',
  DEGEN: '★',
  GRINDER: '◎',
};

export function DegenDashboard({ degen, agents, walletAddress, chatMessages, selectedAgentId }: DegenDashboardProps) {
  const [expanded, setExpanded] = useState<Set<Section>>(new Set(['chart', 'agents', 'chat']));
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissed, setDismissed] = useState(false); // onboarding dismissed

  const hasPositions = degen.positions.length > 0;

  // Filter chats to only show conversations involving the selected agent
  const agentChats = useMemo(() =>
    (chatMessages || []).filter(m => m.participants?.includes(selectedAgentId || '')),
    [chatMessages, selectedAgentId]
  );

  const toggle = useCallback((s: Section) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        // Don't allow closing pinned sections
        if (PINNED.includes(s)) return prev;
        next.delete(s);
      } else {
        // Accordion: close non-pinned sections (except the one being opened)
        for (const key of next) {
          if (!PINNED.includes(key) && key !== 'positions') {
            next.delete(key);
          }
        }
        next.add(s);
      }
      return next;
    });
  }, []);

  // Toast system
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  // Unstake handler with feedback
  const handleUnstake = useCallback(async (stakeId: string) => {
    try {
      const pos = degen.positions.find((p) => p.id === stakeId);
      await degen.unbackAgent(stakeId);
      playSound('womp');
      addToast(`Unstaked ${pos?.amount?.toLocaleString() || ''} from ${pos?.agentName || 'agent'}`, 'success');
    } catch (e: any) {
      playSound('error');
      addToast(e.message || 'Unstake failed', 'error');
    }
  }, [degen, addToast]);

  // Sort agents: backed first, then by ELO descending
  const backedAgentIds = useMemo(() => new Set(degen.positions.map((p) => p.agentId)), [degen.positions]);
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const aBacked = backedAgentIds.has(a.id) ? 1 : 0;
      const bBacked = backedAgentIds.has(b.id) ? 1 : 0;
      if (aBacked !== bBacked) return bBacked - aBacked;
      return b.elo - a.elo;
    });
  }, [agents, backedAgentIds]);

  const displayAgents = showAllAgents ? sortedAgents : sortedAgents.slice(0, 3);

  return (
    <div className="h-full flex flex-col bg-slate-950/90 text-slate-200 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none hud-backplate opacity-70" />
      {/* Header */}
      <div className="relative shrink-0 px-3 py-2.5 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wider bg-gradient-to-r from-amber-300 to-purple-300 bg-clip-text text-transparent">
              DEGEN MODE
            </span>
            <span className="hud-chip">LIVE</span>
          </div>
          {degen.balance && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Balance:</span>
              <AnimatedCounter value={degen.balance.balance} className="text-slate-100 font-semibold text-xs" />
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <div className="absolute top-12 right-3 z-50 flex flex-col gap-1.5 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-in slide-in-from-right fade-in duration-200 text-xs px-3 py-1.5 rounded-lg border shadow-lg backdrop-blur-sm ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700/50 text-emerald-200'
                : 'bg-red-950/90 border-red-700/50 text-red-200'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Scrollable sections */}
      <div className="relative flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700/70 px-3 py-3 space-y-3">

        {/* Onboarding card */}
        {!walletAddress && !dismissed && (
          <div className="hud-panel p-3 space-y-2 border-amber-700/30 bg-gradient-to-r from-amber-950/30 to-purple-950/25">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300">Welcome to Degen Mode</span>
              <button onClick={() => setDismissed(true)} className="text-[10px] text-slate-500 hover:text-slate-300">dismiss</button>
            </div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">1.</span>
                <span>Connect your wallet to get <span className="text-amber-300 font-semibold">10,000 $ARENA</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400">2.</span>
                <span>Back agents to earn when they win matches</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400">3.</span>
                <span>Predict match outcomes for huge payouts</span>
              </div>
            </div>
          </div>
        )}

        {/* First-action prompt: connected but no positions */}
        {walletAddress && !hasPositions && !dismissed && (
          <div className="hud-panel px-3 py-2 border-emerald-700/20 bg-slate-950/30">
            <div className="flex items-center justify-between">
              <div className="text-xs text-emerald-300">
                Pick your first champion to start earning
              </div>
              <button onClick={() => setDismissed(true)} className="text-[10px] text-slate-600 hover:text-slate-400">x</button>
            </div>
          </div>
        )}

        {/* Positions */}
        {hasPositions && (
          <CollapsibleSection
            title="Your Positions"
            badge={`${degen.positions.length}`}
            open={expanded.has('positions')}
            onToggle={() => toggle('positions')}
          >
            <div className="space-y-2">
              {degen.positions.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-950/25 rounded-lg px-3 py-2 border border-slate-800/40 border-l-2 border-l-emerald-500/40 transition-colors hover:bg-slate-900/25">
                  <div>
                    <div className="text-xs font-semibold">{p.agentName}</div>
                    <div className="text-[10px] text-slate-500">{p.amount.toLocaleString()} staked</div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className={`text-xs font-mono font-semibold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.pnl >= 0 ? '+' : ''}{p.pnl.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[10px] text-slate-500 hover:text-red-400 h-5 px-1.5"
                      onClick={() => handleUnstake(p.id)}
                    >
                      unstake
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
                <span className="text-slate-500">Total PnL</span>
                <AnimatedCounter value={degen.totalPnL} prefix={degen.totalPnL >= 0 ? '+' : ''} colorize className="font-semibold text-xs" />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Price Chart — always visible (pinned) */}
        <CollapsibleSection
          title="$ARENA Price"
          open={expanded.has('chart')}
          onToggle={() => toggle('chart')}
          pinned
        >
          <PriceChart data={degen.priceHistory} />
        </CollapsibleSection>

        {/* Agent Cards */}
        <CollapsibleSection
          title="Back an Agent"
          badge={`${agents.length}`}
          open={expanded.has('agents')}
          onToggle={() => toggle('agents')}
        >
          <div className="space-y-2">
            {displayAgents.map((a) => (
              <AgentBackingCard
                key={a.id}
                agent={a}
                onBack={degen.backAgent}
                getBackers={degen.getAgentBackers}
                loading={degen.loading}
                walletConnected={!!walletAddress}
                isBacked={backedAgentIds.has(a.id)}
                onToast={addToast}
                userBalance={degen.balance?.balance}
              />
            ))}
            {!showAllAgents && sortedAgents.length > 3 && (
              <button
                onClick={() => setShowAllAgents(true)}
                className="w-full text-center text-[11px] text-slate-300 hover:text-slate-100 py-2 rounded bg-slate-950/25 hover:bg-slate-900/25 border border-slate-800/40 transition-colors"
              >
                Show all {sortedAgents.length} agents
              </button>
            )}
            {showAllAgents && sortedAgents.length > 3 && (
              <button
                onClick={() => setShowAllAgents(false)}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 py-1 transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        </CollapsibleSection>

        {/* Leaderboard */}
        <CollapsibleSection title="Leaderboard" open={expanded.has('leaderboard')} onToggle={() => toggle('leaderboard')}>
          <BackerLeaderboard data={degen.leaderboard} />
        </CollapsibleSection>

        {/* Agent Chat */}
        <CollapsibleSection title="Agent Chat" badge={String(agentChats.length)} open={expanded.has('chat')} onToggle={() => toggle('chat')}>
          <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700/70">
            {agentChats.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-2">
                {selectedAgentId ? 'No conversations for this agent yet...' : 'Select an agent to see their chats'}
              </div>
            ) : agentChats.map(msg =>
              msg.economicEffect ? (
                <div
                  key={msg.id}
                  className={`text-[11px] px-2 py-1.5 rounded-md border shadow-inner ${
                    msg.economicEffect.type === 'TIP'
                      ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-300'
                      : 'bg-red-950/40 border-red-700/30 text-red-300'
                  }`}
                >
                  {msg.economicIntent && msg.economicIntent !== 'NONE'
                    ? `${msg.economicIntent === 'FLEX' ? '💪' : msg.economicIntent === 'HUSTLE' ? '🎯' : msg.economicIntent === 'COLLAB' ? '🤝' : '💰'} ${msg.text}`
                    : msg.text}
                </div>
              ) : (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 text-[11px] rounded-md border bg-slate-950/20 px-2 py-1.5 transition-colors hover:bg-slate-900/25 ${
                    msg.outcome === 'BOND' ? 'border-slate-800/40 border-l-2 border-l-emerald-500/40' :
                    msg.outcome === 'BEEF' ? 'border-slate-800/40 border-l-2 border-l-red-500/40' : 'border-slate-800/35'
                  }`}
                >
                  <span className="shrink-0 inline-flex h-2 w-2 mt-1 rounded-full" style={{ backgroundColor: ARCHETYPE_COLORS[msg.archetype] || '#93c5fd' }} />
                  <div className="min-w-0">
                    <span className="font-mono font-semibold" style={{ color: ARCHETYPE_COLORS[msg.archetype] || '#93c5fd' }}>
                      {ARCHETYPE_GLYPH[msg.archetype] || '●'} {msg.agentName}
                    </span>
                    {msg.outcome && msg.outcome !== 'NEUTRAL' && (
                      <span className={`ml-1 text-[9px] px-1 py-0.5 rounded ${
                        msg.outcome === 'BOND' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                      }`}>
                        {msg.outcome === 'BOND' ? '🤝' : '💢'} {msg.outcome}
                      </span>
                    )}
                    {msg.economicIntent && msg.economicIntent !== 'NONE' && (
                      <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-slate-900/40 text-slate-300 border border-slate-800/40">
                        {(msg.economicIntent === 'FLEX' ? '💪' : msg.economicIntent === 'HUSTLE' ? '🎯' : msg.economicIntent === 'COLLAB' ? '🤝' : msg.economicIntent === 'TIP' ? '💰' : '🧩')}{' '}
                        {msg.economicIntent}
                      </span>
                    )}
                    <div className="text-slate-200/90 mt-0.5 leading-snug">
                      {msg.text}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

// Collapsible section component
function CollapsibleSection({
  title,
  badge,
  open,
  onToggle,
  pinned,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  pinned?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`hud-panel overflow-hidden ${pinned ? 'ring-1 ring-primary/10' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/30 hover:bg-slate-900/25 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-100 truncate">{title}</span>
          {badge && (
            <span className="hud-chip font-mono">{badge}</span>
          )}
          {pinned && <span className="hud-chip text-[8px] text-primary/90 border-primary/30 bg-primary/10">PINNED</span>}
        </div>
        <span className="text-xs text-slate-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  );
}
