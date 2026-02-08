/**
 * Centralized API polling hub — all town, agent, economy, and event data.
 * Framework-agnostic (no PixiJS / THREE dependency).
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { API_BASE } from '../constants';
import type {
  Town, TownSummary, Agent, EconomyPoolSummary, EconomySwapRow,
  TownEvent, AgentGoalView, ChatMessage, AgentAction, ActivityItem,
} from '../types';
import { playSound } from '../../utils/sounds';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error (${res.status}): ${res.statusText}`);
  return res.json() as Promise<T>;
}

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export interface TownDataState {
  towns: TownSummary[];
  town: Town | null;
  agents: Agent[];
  economy: EconomyPoolSummary | null;
  swaps: EconomySwapRow[];
  events: TownEvent[];
  agentGoalsById: Record<string, AgentGoalView>;
  chatMessages: ChatMessage[];
  agentActions: AgentAction[];
  agentActionsLoading: boolean;
  activityFeed: ActivityItem[];
  loading: boolean;
  error: string | null;
  selectedTownId: string | null;
  setSelectedTownId: (id: string | null) => void;
  selectedPlotId: string | null;
  setSelectedPlotId: (id: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  relationshipsRef: React.MutableRefObject<{ agentAId: string; agentBId: string; status: string; score: number }[]>;
  tradeByAgentId: Record<string, { text: string; until: number; isBuy: boolean }>;
  weather: 'clear' | 'rain' | 'storm';
  economicState: { pollution: number; prosperity: number; sentiment: 'bull' | 'bear' | 'neutral' };
  agentById: Map<string, Agent>;
  requestChat: (townId: string, agentAId: string, agentBId: string) => Promise<void>;
}

export function useTownData(): TownDataState {
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [town, setTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [economy, setEconomy] = useState<EconomyPoolSummary | null>(null);
  const [swaps, setSwaps] = useState<EconomySwapRow[]>([]);
  const [events, setEvents] = useState<TownEvent[]>([]);
  const [agentGoalsById, setAgentGoalsById] = useState<Record<string, AgentGoalView>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [agentActionsLoading, setAgentActionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userSelectedTownIdRef = useRef<string | null>(null);
  const activeTownIdRef = useRef<string | null>(null);
  const [selectedTownId, setSelectedTownIdState] = useState<string | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const seenSwapIdsRef = useRef<Set<string>>(new Set());
  const swapsPrimedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenChatEventIdsRef = useRef<Set<string>>(new Set());
  const seenTradeEventIdsRef = useRef<Set<string>>(new Set());
  const lastChatRequestRef = useRef<Map<string, number>>(new Map());

  const relationshipsRef = useRef<{ agentAId: string; agentBId: string; status: string; score: number }[]>([]);
  const [tradeByAgentId, setTradeByAgentId] = useState<Record<string, { text: string; until: number; isBuy: boolean }>>({});
  const [weather, setWeather] = useState<'clear' | 'rain' | 'storm'>('clear');

  const setSelectedTownId = useCallback((id: string | null) => {
    userSelectedTownIdRef.current = id;
    setSelectedTownIdState(id);
    setSelectedPlotId(null);
    setSelectedAgentId(null);
  }, []);

  const agentById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const agentByIdRef = useRef<Map<string, Agent>>(new Map());
  useEffect(() => { agentByIdRef.current = agentById; }, [agentById]);
  useEffect(() => { activeTownIdRef.current = town?.id ?? null; }, [town?.id]);

  // Auto-select first agent
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  // ── Initial load ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [townsRes, activeTownRes, agentsRes, poolRes] = await Promise.all([
          apiFetch<{ towns: TownSummary[] }>('/towns'),
          apiFetch<{ town: Town | null }>('/town'),
          apiFetch<Agent[]>('/agents'),
          apiFetch<{ pool: EconomyPoolSummary | null }>('/economy/pool').catch(() => ({ pool: null })),
        ]);
        if (cancelled) return;
        setTowns(townsRes.towns);
        setAgents(agentsRes);
        if (poolRes.pool) setEconomy(poolRes.pool);
        const activeId = activeTownRes.town?.id ?? townsRes.towns[0]?.id ?? null;
        const next = userSelectedTownIdRef.current ?? activeId;
        if (next) setSelectedTownIdState(next);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Town detail polling ──
  useEffect(() => {
    if (!selectedTownId) return;
    let cancelled = false;
    const load = () => apiFetch<{ town: Town }>(`/town/${selectedTownId}`)
      .then(r => { if (!cancelled) setTown(r.town); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed'); });
    load();
    const t = setInterval(load, 2500);
    return () => { cancelled = true; clearInterval(t); };
  }, [selectedTownId]);

  // ── Agents polling ──
  useEffect(() => {
    let cancelled = false;
    const t = setInterval(() => {
      apiFetch<Agent[]>('/agents').then(r => { if (!cancelled) setAgents(r); }).catch(() => {});
    }, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // ── Economy pool polling ──
  useEffect(() => {
    let cancelled = false;
    const load = () => apiFetch<{ pool: EconomyPoolSummary }>('/economy/pool')
      .then(r => { if (!cancelled) setEconomy(r.pool); }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // ── Swaps polling ──
  useEffect(() => {
    let cancelled = false;
    const load = () => apiFetch<{ swaps: EconomySwapRow[] }>('/economy/swaps?limit=30')
      .then(res => {
        if (cancelled) return;
        if (!swapsPrimedRef.current) {
          swapsPrimedRef.current = true;
          for (const s of res.swaps) if (s?.id) seenSwapIdsRef.current.add(s.id);
          setSwaps(res.swaps);
          return;
        }
        for (const s of res.swaps) {
          if (!seenSwapIdsRef.current.has(s.id)) {
            seenSwapIdsRef.current.add(s.id);
            playSound('swap');
          }
        }
        setSwaps(res.swaps);
      }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // ── Events polling ──
  const pushTradeText = useCallback((agentId: string, isBuy: boolean, text: string) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 64);
    if (!agentId || !clean) return;
    const until = Date.now() + 2400;
    setTradeByAgentId(prev => ({ ...prev, [agentId]: { text: clean, until, isBuy } }));
    window.setTimeout(() => {
      setTradeByAgentId(prev => {
        if (prev[agentId]?.until !== until) return prev;
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }, 2700);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => apiFetch<{ events: TownEvent[] }>('/world/events?limit=50')
      .then(res => {
        if (cancelled) return;
        for (const e of res.events) {
          if (!seenEventIdsRef.current.has(e.id)) {
            seenEventIdsRef.current.add(e.id);
            if (e.eventType === 'TOWN_COMPLETED') playSound('townComplete');
            else if (e.eventType === 'BUILD_COMPLETED') playSound('buildComplete');
          }
        }

        // Derive chat messages from AGENT_CHAT events
        const activeTownId = activeTownIdRef.current;
        if (activeTownId) {
          const byId = agentByIdRef.current;
          const newChatMsgs: ChatMessage[] = [];
          for (const e of res.events) {
            if (e.townId !== activeTownId || seenChatEventIdsRef.current.has(e.id)) continue;
            let meta: any = null;
            try { meta = JSON.parse(e.metadata || '{}'); } catch { continue; }
            if (!meta || typeof meta !== 'object' || String(meta.kind || '') !== 'AGENT_CHAT') continue;
            const participants = Array.isArray(meta.participants) ? meta.participants.filter((p: any) => typeof p === 'string') : [];
            const rawLines = Array.isArray(meta.lines) ? meta.lines : [];
            const lines = rawLines.filter((l: any) => l?.agentId && l?.text);
            if (participants.length < 2 || lines.length < 1) continue;
            const outcome = (String(meta.outcome || 'NEUTRAL').toUpperCase() as ChatMessage['outcome']) || 'NEUTRAL';
            const economicIntent = typeof meta.economicIntent === 'string' ? meta.economicIntent : 'NONE';
            const ts = new Date(e.createdAt).getTime();
            for (let idx = 0; idx < lines.length; idx++) {
              const l = lines[idx];
              const ag = byId.get(l.agentId);
              newChatMsgs.push({
                id: `${e.id}:${idx}`, agentId: l.agentId,
                agentName: ag?.name || 'Unknown', archetype: ag?.archetype || 'ROCK',
                text: l.text, timestamp: ts, participants, outcome, economicIntent,
              });
            }
            seenChatEventIdsRef.current.add(e.id);
          }
          if (newChatMsgs.length > 0) {
            setChatMessages(prev => [...newChatMsgs, ...prev].slice(0, 80));
          }

          // Trade bubbles
          for (const e of res.events) {
            if (e.townId !== activeTownId || seenTradeEventIdsRef.current.has(e.id) || e.eventType !== 'TRADE' || !e.agentId) continue;
            let meta: any = null;
            try { meta = JSON.parse(e.metadata || '{}'); } catch { continue; }
            if (!meta || String(meta.kind || '') !== 'AGENT_TRADE') continue;
            const side = String(meta.side || '').toUpperCase();
            if (side !== 'BUY_ARENA' && side !== 'SELL_ARENA') continue;
            const isBuy = side === 'BUY_ARENA';
            const nextAction = safeTrim(meta.nextAction, 20);
            const purpose = safeTrim(meta.purpose, 44);
            const amountArena = Number(meta.amountArena || (isBuy ? meta.amountOut : meta.amountIn) || 0);
            const label = nextAction ? `${isBuy ? 'FUEL' : 'CASH'} \u2192 ${nextAction}` :
              purpose || (Number.isFinite(amountArena) && amountArena > 0 ? `${isBuy ? 'BUY' : 'SELL'} ${Math.round(amountArena)} ARENA` : '');
            if (label) pushTradeText(e.agentId, isBuy, label);
            seenTradeEventIdsRef.current.add(e.id);
          }
        }
        setEvents(res.events);
      }).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pushTradeText]);

  // ── Relationships ──
  useEffect(() => {
    if (!town) return;
    let cancelled = false;
    const load = () => fetch(`${API_BASE}/town/${town.id}/relationships`)
      .then(r => r.json())
      .then(data => { if (!cancelled && Array.isArray(data?.relationships)) relationshipsRef.current = data.relationships; })
      .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [town?.id]);

  // ── Goals ──
  useEffect(() => {
    if (!town) { setAgentGoalsById({}); return; }
    let cancelled = false;
    const load = () => fetch(`${API_BASE}/town/${town.id}/goals`)
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return;
        const arr: AgentGoalView[] = Array.isArray(data?.goals) ? data.goals : [];
        const next: Record<string, AgentGoalView> = {};
        for (const g of arr) if (g?.agentId) next[g.agentId] = g;
        setAgentGoalsById(next);
      }).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [town?.id]);

  // ── Agent actions (on-demand when selected) ──
  useEffect(() => {
    if (!selectedAgentId) { setAgentActions([]); return; }
    let cancelled = false;
    setAgentActionsLoading(true);
    fetch(`${API_BASE}/agent/${selectedAgentId}/actions?limit=10`)
      .then(r => r.json())
      .then(data => { if (!cancelled && data.actions) setAgentActions(data.actions); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAgentActionsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  // ── Chat on town change ──
  useEffect(() => {
    seenChatEventIdsRef.current = new Set();
    seenTradeEventIdsRef.current = new Set();
    setChatMessages([]);
    setTradeByAgentId({});
  }, [town?.id]);

  // ── Request chat ──
  const requestChat = useCallback(async (townId: string, agentAId: string, agentBId: string) => {
    const ids = [agentAId, agentBId].sort();
    const key = `${ids[0]}|${ids[1]}`;
    const now = Date.now();
    if ((now - (lastChatRequestRef.current.get(key) || 0)) < 45_000) return;
    lastChatRequestRef.current.set(key, now);
    try {
      const res = await fetch(`${API_BASE}/town/${townId}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentAId, agentBId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const lines = data?.conversation?.lines;
      const outcome = data?.conversation?.outcome as ChatMessage['outcome'];
      const chatEventId = typeof data?.chatEventId === 'string' ? data.chatEventId : '';
      if (chatEventId) seenChatEventIdsRef.current.add(chatEventId);
      if (Array.isArray(lines)) {
        const participants = [agentAId, agentBId];
        const newMsgs: ChatMessage[] = lines.filter((l: any) => l?.agentId && l?.text).map((l: any, idx: number) => ({
          id: chatEventId ? `${chatEventId}:${idx}` : `${Date.now()}-${l.agentId}-${Math.random().toString(36).slice(2, 6)}`,
          agentId: String(l.agentId), agentName: agentById.get(String(l.agentId))?.name || 'Unknown',
          archetype: agentById.get(String(l.agentId))?.archetype || 'ROCK', text: String(l.text),
          timestamp: Date.now(), participants, outcome,
        }));
        setChatMessages(prev => [...newMsgs, ...prev].slice(0, 80));
      }
    } catch {}
  }, [agentById]);

  // ── Economic state ──
  const economicState = useMemo(() => {
    if (!town) return { pollution: 0, prosperity: 0.5, sentiment: 'neutral' as const };
    const plots = town.plots;
    const industrialCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'INDUSTRIAL').length;
    const commercialCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'COMMERCIAL').length;
    const residentialCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'RESIDENTIAL').length;
    const entertainmentCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'ENTERTAINMENT').length;
    const civicCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'CIVIC').length;
    const totalBuilt = industrialCount + commercialCount + residentialCount + entertainmentCount + civicCount;
    const rawPollution = (industrialCount * 2) - (civicCount * 0.5) - (residentialCount * 0.3);
    const pollution = Math.max(0, Math.min(1, rawPollution / 10));
    const completionBonus = town.completionPct / 100;
    const commerceBonus = commercialCount / Math.max(1, totalBuilt);
    const funBonus = entertainmentCount / Math.max(1, totalBuilt) * 0.5;
    const prosperity = Math.min(1, completionBonus * 0.5 + commerceBonus * 0.3 + funBonus + 0.2);
    let sentiment: 'bull' | 'bear' | 'neutral' = 'neutral';
    if (swaps.length >= 2) {
      const recent = swaps.slice(0, 5);
      const buys = recent.filter(s => s.side === 'BUY_ARENA').length;
      const sells = recent.filter(s => s.side === 'SELL_ARENA').length;
      if (buys > sells + 1) sentiment = 'bull';
      else if (sells > buys + 1) sentiment = 'bear';
    }
    return { pollution, prosperity, sentiment };
  }, [town, swaps]);

  // ── Weather ──
  const pollution = economicState.pollution;
  useEffect(() => {
    const change = () => {
      const r = Math.random();
      const clearChance = 0.6 - pollution * 0.4;
      const rainChance = 0.25 + pollution * 0.2;
      if (r < clearChance) setWeather('clear');
      else if (r < clearChance + rainChance) setWeather('rain');
      else setWeather('storm');
    };
    change();
    const base = 45000;
    const t = setInterval(change, base * (1 - pollution * 0.5) + Math.random() * 30000);
    return () => clearInterval(t);
  }, [pollution]);

  // ── Activity feed ──
  const activityFeed = useMemo(() => {
    const tradeSwapIds = new Set<string>();
    for (const e of events) {
      if (e.eventType !== 'TRADE') continue;
      try {
        const meta = JSON.parse(e.metadata || '{}') as any;
        if (meta?.kind === 'AGENT_TRADE' && typeof meta.swapId === 'string') tradeSwapIds.add(meta.swapId);
      } catch {}
    }
    const swapItems = swaps.filter(s => !tradeSwapIds.has(s.id)).map((s): ActivityItem => ({ kind: 'swap', data: s }));
    const eventItems = events.map((e): ActivityItem => ({ kind: 'event', data: e }));
    const sortByTime = (a: ActivityItem, b: ActivityItem) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime();
    const recentEvents = eventItems.sort(sortByTime).slice(0, 8);
    const recentSwaps = swapItems.sort(sortByTime).slice(0, 15 - recentEvents.length);
    const combined = [...recentEvents, ...recentSwaps];
    combined.sort(sortByTime);
    return combined;
  }, [swaps, events]);

  return {
    towns, town, agents, economy, swaps, events, agentGoalsById,
    chatMessages, agentActions, agentActionsLoading, activityFeed,
    loading, error,
    selectedTownId, setSelectedTownId,
    selectedPlotId, setSelectedPlotId,
    selectedAgentId, setSelectedAgentId,
    relationshipsRef, tradeByAgentId, weather, economicState,
    agentById, requestChat,
  };
}
