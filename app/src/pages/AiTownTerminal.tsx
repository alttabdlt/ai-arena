import { useEffect, useState, useRef, useMemo, type RefObject } from 'react';

function useElementSize<T extends HTMLElement>(): [RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = import.meta.env.VITE_API_URL || (isLocalhost
  ? 'http://localhost:4000/api/v1'
  : '');
const TOKEN = import.meta.env.VITE_TOKEN_ADDRESS || '0x0bA5E04470Fe327AC191179Cf6823E667B007777';

// ─── Types ───────────────────────────────────────────────────────────
interface Plot {
  id: string;
  plotIndex: number;
  x: number;
  y: number;
  zone: string;
  status: string;
  buildingType?: string;
  buildingName?: string;
  buildingDesc?: string;
  buildingData?: string;
  ownerId?: string;
  apiCallsUsed: number;
  arenaInvested: number;
}
interface Town {
  id: string;
  name: string;
  theme: string;
  status: string;
  totalPlots: number;
  builtPlots: number;
  completionPct: number;
  totalInvested: number;
  plots: Plot[];
}
interface Agent {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  wins: number;
  losses: number;
  elo: number;
  apiCostCents?: number;
}
interface WorldStats {
  totalTowns: number;
  completedTowns: number;
  totalAgents: number;
  totalArenaInvested: number;
  totalApiCalls: number;
  totalApiCostCents: number;
  totalYieldPaid: number;
}
interface AgentActivity {
  action: string;
  detail?: string;
  time: number;
}

// ─── Agent face art (multi-line for big card, single-line for roster) ─
const FACES: Record<string, { big: string; bigActive: string; sm: string; smActive: string; color: string }> = {
  SHARK: {
    big:       '  ╱▔▔▔╲\n ╱ ▸  ◂ ╲\n │  \\/  │\n  ╲ ▬ ╱\n   ╲▁╱',
    bigActive: '  ╱▔▔▔╲\n ╱ ▶ !◀ ╲\n │  \\/  │\n  ╲▓▬▓╱\n   ╲▁╱',
    sm: '▸◂', smActive: '▶◀',
    color: '#ef4444',
  },
  ROCK: {
    big:       ' ┌─────┐\n │ ─   ─ │\n │       │\n │ ▂▂▂ │\n └─────┘',
    bigActive: ' ┌─────┐\n │ ⊙   ⊙ │\n │       │\n │ ▂▂▂ │\n └─────┘',
    sm: '─ ─', smActive: '⊙ ⊙',
    color: '#94a3b8',
  },
  CHAMELEON: {
    big:       '  ╭~~~╮\n │ ◉  ◎ │\n │  ∿   │\n  ╰──-╯',
    bigActive: '  ╭~~~╮\n │ ◉  ◎ │\n │  ~   │\n  ╰──-╯',
    sm: '◉◎', smActive: '◉~',
    color: '#34d399',
  },
  DEGEN: {
    big:       '  ╱$$$╲\n │ ✦  ✦ │\n │  ◇   │\n  ╲▽▽▽╱',
    bigActive: '  ╱$$$╲\n │ ✦ !✦ │\n │  ◆   │\n  ╲▽▽▽╱',
    sm: '✦✦', smActive: '$!$',
    color: '#fbbf24',
  },
  GRINDER: {
    big:       ' ╔═════╗\n ║ ▪  ▪ ║\n ║  ·   ║\n ║─────║\n ╚═════╝',
    bigActive: ' ╔═════╗\n ║ ▪  ▪ ║\n ║  ◦   ║\n ║─────║\n ╚═════╝',
    sm: '▪▪', smActive: '▪◦',
    color: '#818cf8',
  },
};

const AGENT_GLYPHS: Record<string, string> = {
  SHARK: '▲',
  ROCK: '●',
  CHAMELEON: '◆',
  DEGEN: '★',
  GRINDER: '◎',
};

const ZONE_STYLE: Record<string, { color: string; icon: string }> = {
  RESIDENTIAL:   { color: '#4ade80', icon: '⌂' },
  COMMERCIAL:    { color: '#60a5fa', icon: '◆' },
  CIVIC:         { color: '#c084fc', icon: '▲' },
  INDUSTRIAL:    { color: '#fb923c', icon: '⚙' },
  ENTERTAINMENT: { color: '#f472b6', icon: '★' },
};

const ZONE_GLYPH: Record<string, string> = {
  RESIDENTIAL: '⌂',
  COMMERCIAL: '$',
  CIVIC: '♜',
  INDUSTRIAL: '⚙',
  ENTERTAINMENT: '★',
};

const ZONE_SHAPES: Record<string, string[]> = {
  RESIDENTIAL: [' /\\  ', '/__\\ ', '|[]| ', '|__| ', ' ‾‾‾ '],
  COMMERCIAL: ['╔══╗ ', '║$$║ ', '║  ║ ', '║▔▔║ ', '╚══╝ '],
  CIVIC: ['╔═▲═╗', '║║║║║', '║─┼─║', '║▒▒▒║', '╚═══╝'],
  INDUSTRIAL: ['┌┐ ┌┐', '││⚙│ ', '│└┐│ ', '│░░│ ', '└──┘ '],
  ENTERTAINMENT: ['╭───╮', '│♪ ♪│', '│ ★ │', '│   │', '╰───╯'],
};

const STATUS_SHAPES: Record<string, string[]> = {
  UNDER_CONSTRUCTION: ['╔══╗ ', '║..║ ', '║..║ ', '║..║ ', '╚══╝ '],
  CLAIMED: ['  ╷  ', '  │  ', ' ┌┴┐ ', ' └◎┘ ', '  ┴  '],
};

const DECOR_BY_ZONE: Record<string, string[]> = {
  RESIDENTIAL: ['♣', '"', '✿'],
  COMMERCIAL: ['§', '¤', '┼'],
  CIVIC: ['†', '⌘', '✶'],
  INDUSTRIAL: ['▣', '⚙', '▧'],
  ENTERTAINMENT: ['✦', '♫', '✺'],
};

// ═════════════════════════════════════════════════════════════════════
export default function TerminalDashboard() {
  const [towns, setTowns] = useState<Town[]>([]);
  const [activeTown, setActiveTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<WorldStats | null>(null);
  const [agentMap, setAgentMap] = useState<Record<string, Agent>>({});
  const [events, setEvents] = useState<any[]>([]);
  const [activeAgents, setActiveAgents] = useState<Record<string, AgentActivity>>({});
  const [logLines, setLogLines] = useState<string[]>(['[sys] AI Town Terminal v2.0']);
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null);
  const [tickRunning, setTickRunning] = useState(false);
  const [autoTick, setAutoTick] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [rightTab, setRightTab] = useState<'activity' | 'agents'>('activity');
  const logRef = useRef<HTMLDivElement>(null);
  const tickRunningRef = useRef(false);
  const userSelectedTownIdRef = useRef<string | null>(null);
  const [worldView, setWorldView] = useState<'valley' | 'atlas'>(() => {
    const saved = localStorage.getItem('ai-town-view');
    return saved === 'atlas' ? 'atlas' : 'valley';
  });

  // ─── Selected Agent ─────────────────────────────────────────────────
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => localStorage.getItem('ai-town-agent'));

  useEffect(() => {
    if (selectedAgentId) localStorage.setItem('ai-town-agent', selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    localStorage.setItem('ai-town-view', worldView);
  }, [worldView]);

  // Auto-select first agent on load
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) setSelectedAgentId(agents[0].id);
  }, [agents]);

  const selectedAgent = selectedAgentId ? agentMap[selectedAgentId] : null;

  // Switch town when selecting an agent — find a town where they have plots
  const switchToAgentTown = async (agentId: string) => {
    for (const t of towns) {
      if (t.id === activeTown?.id) {
        const hasPlots = activeTown.plots.some(p => p.ownerId === agentId);
        if (hasPlots) return; // already viewing their town
      }
    }
    // Check other towns
    for (const t of towns) {
      if (t.id === activeTown?.id) continue;
      try {
        const detail = await fetch(`${API}/town/${t.id}/plots`).then(r => r.json());
        const plots = detail.plots || [];
        if (plots.some((p: Plot) => p.ownerId === agentId)) {
          userSelectedTownIdRef.current = t.id;
          setActiveTown({ ...t, plots });
          addLog(`→ ${t.name} (${agentMap[agentId]?.name})`);
          return;
        }
      } catch {}
    }
  };

  // Blinking cursor
  useEffect(() => {
    const iv = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(iv);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  // Fade active agents after 15s
  useEffect(() => {
    const iv = setInterval(() => {
      setActiveAgents(prev => {
        const now = Date.now();
        const next: Record<string, AgentActivity> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.time < 15000) next[k] = v;
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // Auto-tick
  const triggerTickRef = useRef<() => Promise<void>>();
  useEffect(() => {
    if (!autoTick) return;
    triggerTickRef.current?.();
    const iv = setInterval(() => triggerTickRef.current?.(), 45000);
    return () => clearInterval(iv);
  }, [autoTick]);

  const addLog = (line: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogLines(prev => [...prev.slice(-80), `[${ts}] ${line}`]);
  };

  // ─── Data fetching ─────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [townsRes, agentsRes, statsRes, eventsRes] = await Promise.all([
        fetch(`${API}/towns`).then(r => r.json()),
        fetch(`${API}/agents`).then(r => r.json()),
        fetch(`${API}/world/stats`).then(r => r.json()).catch(() => null),
        fetch(`${API}/world/events?limit=30`).then(r => r.json()).catch(() => ({ events: [] })),
      ]);

      const townList = townsRes.towns || [];
      setTowns(townList);

      const building = townList.find((t: Town) => t.status === 'BUILDING');
      const latest = townList[townList.length - 1];
      const preferredId = userSelectedTownIdRef.current || activeTown?.id;
      const preferredTown = preferredId ? townList.find((t: Town) => t.id === preferredId) : null;
      const target = preferredTown || building || latest;

      if (target) {
        if (!userSelectedTownIdRef.current) {
          userSelectedTownIdRef.current = target.id;
        }
        const townDetail = await fetch(`${API}/town/${target.id}/plots`).then(r => r.json());
        setActiveTown({ ...target, plots: townDetail.plots || [] });
      }

      const agentList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.agents || []);
      setAgents(agentList);
      const map: Record<string, Agent> = {};
      agentList.forEach((a: Agent) => { map[a.id] = a; });
      setAgentMap(map);

      if (statsRes) setStats(statsRes.stats || statsRes);
      setEvents((eventsRes.events || []).slice(0, 30));

      if (!bootDone) {
        setBootDone(true);
        addLog('backend connected ✓');
        addLog(`${townList.length} towns · ${agentList.length} agents online`);
        if (target) addLog(`active: ${target.name} [${target.status}]`);
      }
    } catch (err) {
      addLog(`ERR: ${err}`);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 8000);
    return () => clearInterval(iv);
  }, []);

  // ─── Tick ──────────────────────────────────────────────────────────
  const triggerTick = async () => {
    if (tickRunningRef.current) return;
    tickRunningRef.current = true;
    setTickRunning(true);
    addLog('>>> tick initiated');
    try {
      const res = await fetch(`${API}/agent-loop/tick`, { method: 'POST' });
      const data = await res.json();
      const results = data.results || [];
      const now = Date.now();
      const newActive: Record<string, AgentActivity> = {};

      for (const r of results) {
        const action = r.action?.type?.replace(/_/g, ' ') || 'thinking';
        const detail = r.action?.buildingName || (r.action?.plotIndex != null ? `plot ${r.action.plotIndex}` : '');
        addLog(`${r.success ? '✓' : '✗'} ${r.agentName} → ${action}${detail ? ` · ${detail}` : ''}`);
        if (r.agentId) {
          newActive[r.agentId] = { action, detail, time: now };
        }
      }

      setActiveAgents(prev => ({ ...prev, ...newActive }));
      addLog(`tick done · ${results.length} agents`);
      await fetchData();
    } catch (err: any) {
      addLog(`ERR: ${err.message}`);
    } finally {
      tickRunningRef.current = false;
      setTickRunning(false);
    }
  };

  // Keep ref in sync
  triggerTickRef.current = triggerTick;

  // ─── Helpers ───────────────────────────────────────────────────────
  const getAgentBuildings = (agentId: string): number => {
    if (!activeTown) return 0;
    return activeTown.plots.filter(p => p.ownerId === agentId && p.status === 'BUILT').length;
  };

  const selectedPlotData = activeTown?.plots.find(p => p.plotIndex === selectedPlot);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className={`td ${worldView === 'valley' ? 'view-valley' : 'view-atlas'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .td {
          --bg0: #06080f;
          --bg1: #0b1220;
          --panel: rgba(15, 23, 42, 0.86);
          --panel2: rgba(2, 6, 23, 0.78);
          --border: rgba(148, 163, 184, 0.18);
          --text: #e2e8f0;
          --muted: #94a3b8;
          --muted2: #64748b;
          --accent: #38bdf8;
          --good: #22c55e;
          --warn: #f59e0b;
          --bad: #ef4444;

          background:
            radial-gradient(900px circle at 18% 12%, rgba(56, 189, 248, 0.14), transparent 45%),
            radial-gradient(800px circle at 78% 74%, rgba(34, 197, 94, 0.10), transparent 52%),
            radial-gradient(900px circle at 50% 120%, rgba(148, 163, 184, 0.05), transparent 60%),
            linear-gradient(180deg, rgba(2, 6, 23, 0.84), rgba(2, 6, 23, 0.96)),
            var(--bg0);
          color: var(--text);
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          height: 100vh;
          overflow: hidden;
          font-size: 12px;
          line-height: 1.4;
          display: flex;
          flex-direction: column;
        }

        /* ── Valley skin (cozy) ── */
        .td.view-valley {
          --accent: #34d399;
          background:
            radial-gradient(900px circle at 18% 12%, rgba(52, 211, 153, 0.16), transparent 48%),
            radial-gradient(900px circle at 82% 78%, rgba(250, 204, 21, 0.10), transparent 55%),
            radial-gradient(900px circle at 55% 120%, rgba(59, 130, 246, 0.08), transparent 60%),
            linear-gradient(180deg, rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.96)),
            var(--bg0);
        }
        .td.view-valley .td-town-name { text-shadow: 0 0 14px rgba(52,211,153,0.18); }
        .td.view-valley .td-progress-fill {
          background: linear-gradient(90deg, rgba(34,197,94,0.95), rgba(250,204,21,0.85));
          box-shadow: 0 0 12px rgba(52,211,153,0.10);
        }
        .td.view-valley .td-world-map {
          box-shadow:
            inset 0 0 26px rgba(148,163,184,0.06),
            0 0 26px rgba(52, 211, 153, 0.10);
        }

        /* ── Header ── */
        .td-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
          backdrop-filter: blur(8px);
          flex-shrink: 0;
        }
        .td-logo { font-size: 15px; font-weight: 700; letter-spacing: 3px; color: var(--text); }
        .td-tabs { display: flex; gap: 2px; }
        .td-tab {
          background: rgba(2, 6, 23, 0.45);
          border: 1px solid var(--border);
          color: var(--muted2);
          padding: 3px 10px;
          font-family: inherit;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .td-tab:hover { border-color: rgba(56, 189, 248, 0.65); color: var(--text); }
        .td-tab.active { border-color: rgba(56, 189, 248, 0.95); color: var(--text); background: rgba(56, 189, 248, 0.12); }
        .td-actions { display: flex; gap: 6px; }
        .td-btn {
          background: none;
          border: 1px solid rgba(148, 163, 184, 0.28);
          color: var(--text);
          padding: 4px 12px;
          font-family: inherit;
          font-size: 11px;
          cursor: pointer;
          letter-spacing: 1px;
          transition: all 0.2s;
        }
        .td-btn:hover { background: rgba(148, 163, 184, 0.08); border-color: rgba(148, 163, 184, 0.45); box-shadow: 0 0 10px rgba(56, 189, 248, 0.08); }
        .td-btn:disabled { border-color: rgba(148, 163, 184, 0.14); color: rgba(148, 163, 184, 0.35); cursor: default; box-shadow: none; }
        .td-btn.amber { border-color: rgba(245, 158, 11, 0.7); color: rgba(245, 158, 11, 0.95); }
        .td-btn.amber:hover { background: rgba(245, 158, 11, 0.10); }
        .td-btn.red { border-color: rgba(239, 68, 68, 0.7); color: rgba(239, 68, 68, 0.95); }
        .td-btn.red:hover { background: rgba(239, 68, 68, 0.10); }
        .td-btn.view-active {
          border-color: rgba(56, 189, 248, 0.95);
          background: rgba(56, 189, 248, 0.10);
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.10);
        }
        .td.view-valley .td-btn.view-active {
          border-color: rgba(52, 211, 153, 0.95);
          background: rgba(52, 211, 153, 0.10);
          box-shadow: 0 0 14px rgba(52, 211, 153, 0.10);
          color: rgba(52, 211, 153, 0.98);
        }

        /* ── Stats bar ── */
        .td-stats {
          display: flex;
          justify-content: center;
          gap: 48px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--panel2);
          flex-shrink: 0;
          text-align: center;
        }
        .td-stat-label { color: var(--muted2); font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; }
        .td-stat-value { font-size: 18px; font-weight: 700; color: var(--text); }
        .td-stat-amber { color: rgba(245, 158, 11, 0.95); }
        .td-stat-red { color: rgba(239, 68, 68, 0.95); }

        /* ── 2-column body ── */
        .td-body {
          display: grid;
          grid-template-columns: 1fr 300px;
          flex: 1;
          overflow: hidden;
        }

        /* ── Right panel tabs ── */
        .td-right-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .td-right-tab {
          flex: 1;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--muted2);
          padding: 7px 0;
          font-family: inherit;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .td-right-tab:hover { color: var(--text); }
        .td-right-tab.active {
          color: var(--text);
          border-bottom-color: rgba(56, 189, 248, 0.95);
        }
        .td-tab-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px;
        }

        @keyframes face-glow {
          0%, 100% { box-shadow: 0 0 8px currentColor; }
          50% { box-shadow: 0 0 18px currentColor; }
        }

        /* ── Center: World ── */
        .td-world {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .td-world-header {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          background: rgba(2, 6, 23, 0.35);
          flex-shrink: 0;
        }
        .td-town-name { font-size: 14px; font-weight: 700; color: var(--text); text-shadow: 0 0 10px rgba(56,189,248,0.10); }
        .td-town-theme { color: var(--muted2); font-size: 10px; margin-top: 1px; font-style: italic; }
        .td-town-status { font-size: 11px; color: var(--muted); }

        .td-progress { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .td-progress-bar {
          flex: 1;
          height: 6px;
          background: rgba(148, 163, 184, 0.08);
          border: 1px solid var(--border);
          overflow: hidden;
          border-radius: 1px;
        }
        .td-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, rgba(34,197,94,0.95), rgba(56,189,248,0.85));
          transition: width 1s ease;
          border-radius: 1px;
          box-shadow: 0 0 10px rgba(56,189,248,0.12);
        }
        .td-progress-text { font-size: 12px; min-width: 38px; text-align: right; }
        .td-progress-count { color: rgba(34, 197, 94, 0.95); font-size: 11px; }

        /* ── Town map ── */
        .td-map-wrap {
          flex: 1;
          overflow: auto;
          background:
            linear-gradient(180deg, rgba(2, 6, 23, 0.25), rgba(2, 6, 23, 0.55)),
            radial-gradient(1200px circle at 30% 20%, rgba(56, 189, 248, 0.08), transparent 55%),
            radial-gradient(900px circle at 80% 80%, rgba(34, 197, 94, 0.06), transparent 55%);
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .td-world-map-wrap {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 320px;
        }
        .td-world-map {
          position: relative;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          line-height: 1.05;
          white-space: pre;
          display: inline-block;
          padding: 8px;
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(2, 6, 23, 0.92)),
            radial-gradient(900px circle at 22% 18%, rgba(56, 189, 248, 0.10), transparent 50%),
            radial-gradient(900px circle at 78% 78%, rgba(34, 197, 94, 0.08), transparent 55%);
          border: 1px solid var(--border);
          box-shadow:
            inset 0 0 24px rgba(148,163,184,0.08),
            0 0 22px rgba(56,189,248,0.10);
        }
        .td-valley-map { line-height: 1.0; }
        .td-world-map-line { height: 1em; }
        .td-world-map-layer {
          position: relative;
          z-index: 1;
        }
        .td-world-map-labels {
          position: absolute;
          inset: 8px;
          z-index: 2;
          pointer-events: none;
        }
        .td-world-map-label {
          position: absolute;
          font-size: 0.9em;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.34);
          opacity: 0.9;
          text-shadow: 0 0 16px rgba(56, 189, 248, 0.10);
        }
        .td-world-map-agents {
          position: absolute;
          inset: 8px;
          z-index: 3;
          pointer-events: none;
        }
        @keyframes agent-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-1px); }
        }
        .td-world-map-agent {
          position: absolute;
          white-space: nowrap;
          line-height: 1.05;
          font-weight: 700;
          color: var(--agent-color, var(--text));
          animation: agent-bob 0.75s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(2, 6, 23, 0.6));
        }
        .td-world-map-agent.selected { animation-duration: 0.55s; }
        .td.view-valley .td-world-map-agent {
          animation: none;
          transition: left 360ms linear, top 360ms linear;
          will-change: left, top;
        }
        .td.view-valley .td-agent-sprite {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          filter: drop-shadow(0 0 10px rgba(2, 6, 23, 0.65));
        }
        .td.view-valley .td-agent-tag {
          margin-top: 1px;
          padding: 0px 6px;
          background: rgba(2, 6, 23, 0.55);
          border-color: rgba(148, 163, 184, 0.14);
          box-shadow: 0 0 12px rgba(2, 6, 23, 0.18);
        }
        .td-world-map-agent.active .td-agent-sprite {
          border-color: rgba(56, 189, 248, 0.35);
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.12), 0 0 18px currentColor;
        }
        .td-world-map-agent.active .td-agent-tag {
          border-color: rgba(56, 189, 248, 0.35);
          background: rgba(56, 189, 248, 0.10);
        }
        .td-agent-bubble {
          position: absolute;
          left: 0;
          top: -1.25em;
          padding: 1px 6px;
          font-size: 0.8em;
          letter-spacing: 1px;
          color: rgba(226, 232, 240, 0.92);
          background: rgba(2, 6, 23, 0.70);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 999px;
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.06);
          text-shadow: none;
        }
        .td-agent-sprite {
          display: inline-block;
          white-space: pre;
          padding: 1px 3px;
          background: rgba(2, 6, 23, 0.60);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 6px;
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.08);
          text-shadow: 0 0 14px currentColor;
        }
        .td-agent-tag {
          display: inline-block;
          margin-top: 2px;
          padding: 1px 6px;
          font-size: 0.85em;
          letter-spacing: 1px;
          color: var(--agent-color, var(--text));
          background: rgba(2, 6, 23, 0.68);
          border: 1px solid rgba(148, 163, 184, 0.20);
          border-radius: 999px;
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.08);
          text-shadow: 0 0 12px currentColor;
        }
        .td-world-map-hotspots {
          position: absolute;
          inset: 8px;
          z-index: 4;
        }
        .td-world-map-hit {
          position: absolute;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
        }
        .td-world-map-hit:hover {
          border-color: rgba(56, 189, 248, 0.55);
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.18);
        }
        .td-world-map-hit.selected {
          border-color: rgba(56, 189, 248, 0.95);
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.25);
        }
        .td.view-valley .td-world-map-hit:hover { border-color: rgba(52, 211, 153, 0.55); box-shadow: 0 0 14px rgba(52, 211, 153, 0.18); }
        .td.view-valley .td-world-map-hit.selected { border-color: rgba(52, 211, 153, 0.95); box-shadow: 0 0 18px rgba(52, 211, 153, 0.25); }

        .td-valley-hud {
          position: absolute;
          left: 8px;
          top: 8px;
          z-index: 5;
          pointer-events: none;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .td-valley-hud-box {
          padding: 6px 8px;
          background: rgba(2, 6, 23, 0.62);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          box-shadow: 0 0 18px rgba(2, 6, 23, 0.35);
        }
        .td-valley-hud-title {
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.85);
        }
        .td-valley-hud-line {
          margin-top: 2px;
          font-size: 11px;
          color: rgba(226, 232, 240, 0.92);
          text-shadow: 0 0 10px rgba(2, 6, 23, 0.35);
        }

        .td-legend {
          border-top: 1px solid var(--border);
          padding: 6px 12px;
          font-size: 10px;
          color: var(--muted2);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          background: var(--panel2);
        }
        .td-legend span { white-space: nowrap; }

        /* ── Building detail ── */
        .td-detail {
          border-top: 1px solid var(--border);
          padding: 10px 16px;
          flex-shrink: 0;
          max-height: 35vh;
          overflow-y: auto;
          background: rgba(2, 6, 23, 0.70);
        }
        .td-detail-title { font-size: 14px; font-weight: 700; color: var(--text); }
        .td-detail-meta { font-size: 10px; color: var(--muted2); margin-top: 3px; }
        .td-detail-content { margin-top: 8px; }
        .td-detail-step {
          border-left: 2px solid rgba(56, 189, 248, 0.22);
          padding-left: 8px;
          margin: 6px 0;
        }
        .td-detail-step-label { color: rgba(56, 189, 248, 0.95); font-size: 9px; letter-spacing: 1px; text-transform: uppercase; }
        .td-detail-step-text { color: rgba(226, 232, 240, 0.9); font-size: 11px; line-height: 1.5; }

        /* ── Right: Feed ── */
        .td-feed {
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(2, 6, 23, 0.35);
        }
        .td-section-title {
          color: var(--muted2);
          font-size: 9px;
          letter-spacing: 3px;
          text-transform: uppercase;
          padding: 8px 12px 4px;
          flex-shrink: 0;
        }
        .td-events {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px;
        }
        .td-event {
          padding: 4px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.10);
        }
        .td-event-title { font-size: 11px; color: var(--text); }
        .td-event-desc { font-size: 9px; color: var(--muted2); line-height: 1.3; }

        /* ── System log ── */
        .td-log-wrap {
          border-top: 1px solid var(--border);
          max-height: 200px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          background: rgba(2, 6, 23, 0.55);
        }
        .td-log {
          flex: 1;
          overflow-y: auto;
          padding: 4px 12px;
          font-size: 10px;
        }
        .td-log-line { color: var(--muted2); }
        .td-log-ok { color: rgba(34, 197, 94, 0.95); }
        .td-log-err { color: rgba(239, 68, 68, 0.95); }
        .td-log-cmd { color: rgba(245, 158, 11, 0.95); }
        .td-cursor {
          display: inline-block;
          width: 7px;
          height: 12px;
          background: var(--accent);
          vertical-align: text-bottom;
        }

        /* ── Scrollbar ── */
        .td ::-webkit-scrollbar { width: 4px; }
        .td ::-webkit-scrollbar-track { background: rgba(2, 6, 23, 0.35); }
        .td ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.22); border-radius: 2px; }
        .td ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.36); }

        /* ── My Agent card ── */
        .my-agent-card {
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 3px;
          background: rgba(2, 6, 23, 0.55);
          margin-bottom: 8px;
        }
        .my-agent-face-big {
          width: 72px;
          height: 68px;
          border: 2px solid rgba(148, 163, 184, 0.32);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          line-height: 1.15;
          white-space: pre;
          color: var(--text);
          background: rgba(2, 6, 23, 0.80);
          flex-shrink: 0;
          box-shadow: inset 0 0 14px rgba(148, 163, 184, 0.10), 0 0 18px rgba(56, 189, 248, 0.08);
        }
        .my-agent-face-big.active-glow {
          animation: face-glow 2s ease-in-out infinite;
        }
        .my-agent-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
        }
        .my-agent-stat {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          font-size: 10px;
        }
        .my-agent-stat-label { color: var(--muted2); }
        .my-agent-stat-value { color: var(--text); font-weight: 700; }
        .my-agent-stat-value.amber { color: #ffbb33; }

        /* ── Agent roster rows ── */
        .friend-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 6px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(2, 6, 23, 0.35);
          margin-bottom: 2px;
          border-radius: 2px;
          transition: all 0.2s;
        }
        .friend-row:hover { border-color: rgba(56, 189, 248, 0.45); }
        .friend-row.is-active {
          border-color: rgba(56, 189, 248, 0.25);
          background: rgba(56, 189, 248, 0.06);
        }
        .friend-face-sm {
          width: 24px;
          height: 24px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: rgba(148, 163, 184, 0.75);
          background: rgba(2, 6, 23, 0.65);
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .friend-row.is-active .friend-face-sm {
          color: var(--agent-color, var(--accent));
          border-color: var(--agent-color, var(--accent));
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.10);
        }
        .friend-name { font-size: 9px; color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .friend-row.is-active .friend-name { color: var(--text); }
        .friend-bal { font-size: 9px; color: var(--muted2); }
        .friend-activity {
          font-size: 8px;
          color: rgba(56, 189, 248, 0.85);
          padding-left: 30px;
          margin-top: -1px;
          margin-bottom: 2px;
          opacity: 0;
          max-height: 0;
          transition: all 0.2s;
        }
        .friend-row.is-active + .friend-activity {
          opacity: 1;
          max-height: 16px;
        }

        /* ── Utility ── */
        .dim { color: var(--muted2); }
        .bright { color: var(--text); }
        .amber { color: rgba(245, 158, 11, 0.95); }
        .white { color: var(--text); }
      `}</style>

      {/* ── Header ── */}
      <div className="td-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="td-logo">AI TOWN</span>
          <div className="td-tabs">
            {towns.map(t => (
              <button
                key={t.id}
                className={`td-tab ${activeTown?.id === t.id ? 'active' : ''}`}
                onClick={async () => {
                  const detail = await fetch(`${API}/town/${t.id}/plots`).then(r => r.json());
                  userSelectedTownIdRef.current = t.id;
                  setActiveTown({ ...t, plots: detail.plots || [] });
                  setSelectedPlot(null);
                  addLog(`→ ${t.name}`);
                }}
              >
                {t.status === 'BUILDING' ? '▶' : '■'} {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="td-actions">
          <button
            className={`td-btn ${worldView === 'valley' ? 'view-active' : ''}`}
            onClick={() => setWorldView('valley')}
          >
            ☘ VALLEY
          </button>
          <button
            className={`td-btn ${worldView === 'atlas' ? 'view-active' : ''}`}
            onClick={() => setWorldView('atlas')}
          >
            ▦ ATLAS
          </button>
          <button className="td-btn amber" onClick={() => window.open(`https://nad.fun/tokens/${TOKEN}`)}>
            $ARENA
          </button>
          <button
            className={`td-btn ${autoTick ? 'red' : ''}`}
            onClick={() => setAutoTick(v => !v)}
          >
            {autoTick ? '■ STOP' : '▶ AUTO'}
          </button>
          <button
            className="td-btn"
            onClick={triggerTick}
            disabled={tickRunning}
            style={tickRunning ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}
          >
            {tickRunning ? '⟳ ...' : '⚡ TICK'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="td-stats">
        {worldView === 'atlas' ? (
          <>
            <div>
              <div className="td-stat-label">$arena holdings</div>
              <div className="td-stat-value td-stat-amber">◆ {selectedAgent ? selectedAgent.bankroll.toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="td-stat-label">$arena price</div>
              <div className="td-stat-value td-stat-amber">$0.0021</div>
            </div>
            <div>
              <div className="td-stat-label">model</div>
              <div className="td-stat-value" style={{ fontSize: 12 }}>DeepSeek V3</div>
            </div>
            <div>
              <div className="td-stat-label">cost / hr</div>
              <div className="td-stat-value td-stat-red">${stats ? (stats.totalApiCostCents / 100 / Math.max(1, stats.totalApiCalls) * 60).toFixed(3) : '—'}</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="td-stat-label">focus</div>
              <div className="td-stat-value">{selectedAgent ? `${AGENT_GLYPHS[selectedAgent.archetype] || '@'} ${selectedAgent.name}` : '—'}</div>
            </div>
            <div>
              <div className="td-stat-label">status</div>
              <div className="td-stat-value" style={{ fontSize: 12 }}>
                {selectedAgentId && activeAgents[selectedAgentId] && Date.now() - activeAgents[selectedAgentId].time < 15000
                  ? activeAgents[selectedAgentId].action
                  : 'idle'}
              </div>
            </div>
            <div>
              <div className="td-stat-label">town</div>
              <div className="td-stat-value" style={{ fontSize: 12 }}>
                {activeTown ? `${activeTown.builtPlots}/${activeTown.totalPlots} (${activeTown.completionPct.toFixed(0)}%)` : '—'}
              </div>
            </div>
            <div>
              <div className="td-stat-label">$arena</div>
              <div className="td-stat-value td-stat-amber">◆ {selectedAgent ? selectedAgent.bankroll.toLocaleString() : '—'}</div>
            </div>
          </>
        )}
      </div>

      {/* ── 2-column body ── */}
      <div className="td-body">

        {/* ── Left: World ── */}
        <div className="td-world">
          {activeTown ? (
            <>
              {/* Town header */}
              <div className="td-world-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="td-town-name">{activeTown.name}</span>
                  <span className="td-town-status bright">{activeTown.status}</span>
                </div>
                <div className="td-town-theme">{activeTown.theme}</div>
                <div className="td-progress">
                  <div className="td-progress-bar">
                    <div className="td-progress-fill" style={{ width: `${activeTown.completionPct}%` }} />
                  </div>
                  <span className="td-progress-text">{activeTown.completionPct.toFixed(0)}%</span>
                  <span className="td-progress-count">{activeTown.builtPlots}/{activeTown.totalPlots}</span>
                </div>
              </div>

              {/* Dynamic plot grid */}
              <div className="td-map-wrap">
                {worldView === 'atlas' ? (
                  <TownWorldMap
                    town={activeTown}
                    agents={agents}
                    activeAgents={activeAgents}
                    selectedPlot={selectedPlot}
                    selectedAgentId={selectedAgentId}
                    onSelectPlot={(plotIndex) => setSelectedPlot(selectedPlot === plotIndex ? null : plotIndex)}
                  />
                ) : (
                  <TownValleyCam
                    town={activeTown}
                    agents={agents}
                    activeAgents={activeAgents}
                    selectedPlot={selectedPlot}
                    selectedAgentId={selectedAgentId}
                    onSelectPlot={(plotIndex) => setSelectedPlot(selectedPlot === plotIndex ? null : plotIndex)}
                  />
                )}
              </div>

              <div className="td-legend">
                {worldView === 'atlas' ? (
                  <>
                    <span style={{ color: ZONE_STYLE.RESIDENTIAL.color }}>⌂ RES</span>
                    <span style={{ color: ZONE_STYLE.COMMERCIAL.color }}>$ COM</span>
                    <span style={{ color: ZONE_STYLE.CIVIC.color }}>♜ CIV</span>
                    <span style={{ color: ZONE_STYLE.INDUSTRIAL.color }}>⚙ IND</span>
                    <span style={{ color: ZONE_STYLE.ENTERTAINMENT.color }}>★ ENT</span>
                    <span className="dim">│</span>
                    <span style={{ color: FACES.SHARK.color }}>▲SHRK</span>
                    <span style={{ color: FACES.ROCK.color }}>●ROCK</span>
                    <span style={{ color: FACES.CHAMELEON.color }}>◆CHAM</span>
                    <span style={{ color: FACES.DEGEN.color }}>★DEGN</span>
                    <span style={{ color: FACES.GRINDER.color }}>◎GRND</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#22c55e' }}>· GRASS</span>
                    <span style={{ color: '#a16207' }}>: PATH</span>
                    <span style={{ color: '#60a5fa' }}>≈ WATER</span>
                    <span style={{ color: '#16a34a' }}>♣ WOODS</span>
                    <span style={{ color: '#94a3b8' }}>▓ STONE</span>
                    <span className="dim">│</span>
                    <span style={{ color: FACES.SHARK.color }}>▲SHRK</span>
                    <span style={{ color: FACES.ROCK.color }}>●ROCK</span>
                    <span style={{ color: FACES.CHAMELEON.color }}>◆CHAM</span>
                    <span style={{ color: FACES.DEGEN.color }}>★DEGN</span>
                    <span style={{ color: FACES.GRINDER.color }}>◎GRND</span>
                  </>
                )}
              </div>

              {/* Building detail */}
              {selectedPlotData && selectedPlotData.status !== 'EMPTY' && (
                <div className="td-detail">
                  <div className="td-detail-title">
                    {ZONE_STYLE[selectedPlotData.zone]?.icon || '?'}{' '}
                    {selectedPlotData.buildingName || selectedPlotData.buildingType || `Plot ${selectedPlotData.plotIndex}`}
                  </div>
                  <div className="td-detail-meta">
                    {selectedPlotData.status} · {selectedPlotData.zone} · plot {selectedPlotData.plotIndex}
                    {selectedPlotData.apiCallsUsed > 0 && ` · ${selectedPlotData.apiCallsUsed} inference calls`}
                    {selectedPlotData.arenaInvested > 0 && ` · ${selectedPlotData.arenaInvested} $ARENA`}
                    {selectedPlotData.ownerId && agentMap[selectedPlotData.ownerId] && (
                      <> · <span className="white">{agentMap[selectedPlotData.ownerId].name}</span></>
                    )}
                  </div>
                  <div className="td-detail-content">
                    {(() => {
                      try {
                        const data = JSON.parse(selectedPlotData.buildingData || '{}');
                        const steps = Object.entries(data).filter(([k]) => !k.startsWith('_'));
                        if (steps.length === 0) return <div className="dim">{selectedPlotData.buildingDesc || 'no data'}</div>;
                        return steps.map(([key, val]: [string, any], i) => (
                          <div key={i} className="td-detail-step">
                            <div className="td-detail-step-label">step {i + 1} — {val.description || key}</div>
                            <div className="td-detail-step-text">
                              {(val.output || '').slice(0, 400)}
                              {(val.output || '').length > 400 ? '…' : ''}
                            </div>
                          </div>
                        ));
                      } catch {
                        return <div className="dim">{selectedPlotData.buildingDesc || 'no data'}</div>;
                      }
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 24, textAlign: 'center' }} className="dim">
              connecting to world…
            </div>
          )}
        </div>

        {/* ── Right: Tabbed Panel ── */}
        <div className="td-feed">
          {/* Tab bar */}
          <div className="td-right-tabs">
            <button className={`td-right-tab ${rightTab === 'activity' ? 'active' : ''}`} onClick={() => setRightTab('activity')}>
              activity
            </button>
            <button className={`td-right-tab ${rightTab === 'agents' ? 'active' : ''}`} onClick={() => setRightTab('agents')}>
              agents
            </button>
          </div>

          {/* Tab content */}
          <div className="td-tab-content">
            {rightTab === 'activity' ? (
              <>
                {/* Filtered activity — only selected agent's actions + agent interactions */}
                {events.length === 0 && <div className="dim" style={{ padding: '8px 0' }}>waiting for activity…</div>}
                {events
                  .filter(ev => {
                    // Show events involving selected agent, or agent-to-agent interactions
                    const desc = (ev.description || '').toLowerCase();
                    const title = (ev.title || '').toLowerCase();
                    const agentName = selectedAgent?.name?.toLowerCase() || '';
                    if (agentName && (desc.includes(agentName) || title.includes(agentName))) return true;
                    // Show completion events and interactions
                    if (ev.eventType === 'AGENT_CHAT' || ev.eventType === 'AGENT_INTERACTION') return true;
                    if (title.includes('complete') || title.includes('chat')) return true;
                    return false;
                  })
                  .slice(0, 20)
                  .map((ev, i) => (
                    <div key={i} className="td-event">
                      <div className="td-event-title">{ev.title || ev.eventType}</div>
                      {ev.description && (
                        <div className="td-event-desc">
                          {(ev.description || '').slice(0, 200)}
                        </div>
                      )}
                    </div>
                  ))
                }
                {events.length > 0 && events.filter(ev => {
                  const desc = (ev.description || '').toLowerCase();
                  const title = (ev.title || '').toLowerCase();
                  const agentName = selectedAgent?.name?.toLowerCase() || '';
                  if (agentName && (desc.includes(agentName) || title.includes(agentName))) return true;
                  if (ev.eventType === 'AGENT_CHAT' || ev.eventType === 'AGENT_INTERACTION') return true;
                  if (title.includes('complete') || title.includes('chat')) return true;
                  return false;
                }).length === 0 && (
                  <div className="dim" style={{ padding: '8px 0' }}>no activity for {selectedAgent?.name || 'agent'} yet</div>
                )}
              </>
            ) : (
              <>
                {/* Agents tab — selected agent stats + roster */}
                {selectedAgent ? (() => {
                  const face = FACES[selectedAgent.archetype] || FACES.GRINDER;
                  const isActive = !!(activeAgents[selectedAgent.id] && Date.now() - activeAgents[selectedAgent.id].time < 15000);
                  const agentBuildings = getAgentBuildings(selectedAgent.id);
                  const agentPlots = activeTown?.plots.filter(p => p.ownerId === selectedAgent.id) || [];
                  const agentInvested = agentPlots.reduce((s, p) => s + (p.arenaInvested || 0), 0);

                  return (
                    <div className="my-agent-card" style={{ margin: '8px 0' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                        <div
                          className={`my-agent-face-big ${isActive ? 'active-glow' : ''}`}
                          style={{ borderColor: face.color, color: face.color, textShadow: `0 0 8px ${face.color}` }}
                        >
                          {isActive ? face.bigActive : face.big}
                        </div>
                        <div>
                          <div className="my-agent-name">{selectedAgent.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 2 }}>{selectedAgent.archetype}</div>
                          {isActive && activeAgents[selectedAgent.id] && (
                            <div style={{ fontSize: 9, color: face.color, marginTop: 3 }}>
                              ▸ {activeAgents[selectedAgent.id].action}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="my-agent-stat">
                        <span className="my-agent-stat-label">$ARENA</span>
                        <span className="my-agent-stat-value amber">◆ {selectedAgent.bankroll.toLocaleString()}</span>
                      </div>
                      <div className="my-agent-stat">
                        <span className="my-agent-stat-label">buildings</span>
                        <span className="my-agent-stat-value">{agentBuildings}</span>
                      </div>
                      <div className="my-agent-stat">
                        <span className="my-agent-stat-label">invested</span>
                        <span className="my-agent-stat-value">{agentInvested} $A</span>
                      </div>
                      <div className="my-agent-stat">
                        <span className="my-agent-stat-label">plots</span>
                        <span className="my-agent-stat-value">{agentPlots.length}</span>
                      </div>
                    </div>
                  );
                })() : null}

                {/* Agent roster */}
                <div style={{ color: 'var(--muted2)', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase' as const, padding: '6px 0 4px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  your agents
                </div>
                {agents.map(agent => {
                  const face = FACES[agent.archetype] || FACES.GRINDER;
                  const isSelected = agent.id === selectedAgentId;
                  const isActive = !!(activeAgents[agent.id] && Date.now() - activeAgents[agent.id].time < 15000);

                  return (
                    <div key={agent.id}>
                      <div
                        className={`friend-row ${isActive ? 'is-active' : ''}`}
                        style={{
                          '--agent-color': face.color,
                          ...(isSelected ? { borderColor: face.color, background: 'rgba(56, 189, 248, 0.08)' } : {}),
                          cursor: 'pointer',
                        } as React.CSSProperties}
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setSelectedPlot(null);
                          switchToAgentTown(agent.id);
                        }}
                      >
                        <div
                          className="friend-face-sm"
                          style={isSelected ? { color: face.color, borderColor: face.color, boxShadow: `0 0 6px ${face.color}40` } : {}}
                        >
                          {isActive ? face.smActive : face.sm}
                        </div>
                        <span className="friend-name" style={isSelected ? { color: '#f0f0f0', fontWeight: 700 } : {}}>
                          {agent.name}
                        </span>
                        <span className="friend-bal">◆ {agent.bankroll.toLocaleString()}</span>
                      </div>
                      {isActive && activeAgents[agent.id] && (
                        <div className="friend-activity" style={{ opacity: 1, maxHeight: 16 }}>
                          ▸ {activeAgents[agent.id].action}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* System log — always visible at bottom */}
          <div className="td-log-wrap">
            <div className="td-section-title">system</div>
            <div className="td-log" ref={logRef}>
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className={`td-log-line ${
                    line.includes('ERR') ? 'td-log-err' :
                    line.includes('✓') || line.includes('done') ? 'td-log-ok' :
                    line.includes('>>>') ? 'td-log-cmd' : ''
                  }`}
                >
                  {line}
                </div>
              ))}
              <div className="td-log-line">
                <span className="dim">{'>'}</span>
                {cursorVisible && <span className="td-cursor" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// World Map Renderer
// ─────────────────────────────────────────────────────────────

type MapCell = { ch: string; color?: string; bg?: string; glow?: boolean; bold?: boolean };
type PlotRect = { plotIndex: number; x: number; y: number; w: number; h: number; ownerId?: string | null; zone?: string; status?: string };
type AgentPos = {
  x: number;
  y: number;
  dir?: 'n' | 's' | 'e' | 'w';
  walk?: number;
  nextStepAt?: number;
  restUntil?: number;
  movingUntil?: number;
};

function TownWorldMap({
  town,
  agents,
  activeAgents,
  selectedPlot,
  selectedAgentId,
  onSelectPlot,
}: {
  town: Town;
  agents: Agent[];
  activeAgents: Record<string, AgentActivity>;
  selectedPlot: number | null;
  selectedAgentId: string | null;
  onSelectPlot: (plotIndex: number) => void;
}) {
  const [wrapRef, { width: wrapW, height: wrapH }] = useElementSize();

  const plotW = 9;
  const plotH = 7;
  const road = 1;

  const { cols, rows } = useMemo(() => {
    let maxX = -1;
    let maxY = -1;
    for (const p of town.plots) {
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    const minCols = Math.max(1, maxX + 1);
    const minRows = Math.max(1, maxY + 1);
    const aspect = wrapW > 0 && wrapH > 0 ? (wrapW / wrapH) : 1.65;
    const clamped = Math.max(0.9, Math.min(2.4, aspect));
    const targetCols = Math.max(1, Math.ceil(Math.sqrt(town.totalPlots * clamped)));
    const outCols = Math.max(minCols, targetCols);
    const outRows = Math.max(minRows, Math.ceil(town.totalPlots / outCols));
    return { cols: outCols, rows: outRows };
  }, [town.totalPlots, town.plots, wrapW, wrapH]);

  const strideX = plotW + road;
  const strideY = plotH + road;
  const width = cols * plotW + (cols + 1) * road;
  const height = rows * plotH + (rows + 1) * road;
  const fontSize = useMemo(() => {
    const w = wrapW || 1;
    const h = wrapH || 1;
    const charW = 0.62; // approximate monospace width/height ratio
    const maxByWidth = w / (width * charW);
    const maxByHeight = h / (height * 1.05);
    return Math.max(11, Math.min(22, Math.floor(Math.min(maxByWidth, maxByHeight))));
  }, [wrapW, wrapH, width, height]);

  const agentById = useMemo(() => {
    const map: Record<string, Agent> = {};
    agents.forEach((a) => { map[a.id] = a; });
    return map;
  }, [agents]);

  const { baseCells, plotRects, roadSet } = useMemo(() => {
    const cells: MapCell[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ ch: ' ', color: '#0b1220' })),
    );

    const plotRectsLocal: PlotRect[] = [];
    const rng = mulberry32(hashString(town.id + town.name));

    // Subtle ground texture
    for (let y = 0; y < height; y++) {
      const shade = -0.12 + 0.22 * (1 - y / height);
      const groundColor = shadeColor('#0b1220', shade);
      for (let x = 0; x < width; x++) {
        const r = rng();
        const ch = r < 0.05 ? '·' : r < 0.07 ? '⋅' : ' ';
        cells[y][x] = { ch, color: groundColor };
      }
    }

    // Roads
    const majorV = new Set<number>([0, strideX * Math.floor(cols / 2), strideX * cols]);
    const majorH = new Set<number>([0, strideY * Math.floor(rows / 2), strideY * rows]);

    const roadPositions = new Set<string>();
    for (let y = 0; y < height; y++) {
      const isH = y % strideY === 0;
      for (let x = 0; x < width; x++) {
        const isV = x % strideX === 0;
        if (!isH && !isV) continue;
        const hMajor = isH && majorH.has(y);
        const vMajor = isV && majorV.has(x);
        const ch =
          isH && isV
            ? hMajor && vMajor
              ? '◉'
              : hMajor
                ? '╪'
                : vMajor
                  ? '╫'
                  : '┼'
            : isH
              ? hMajor
                ? '═'
                : '─'
              : vMajor
                ? '║'
                : '│';
        const roadShade = -0.14 + 0.22 * (1 - y / height);
        const roadBase = hMajor || vMajor ? '#94a3b8' : '#334155';
        const roadColor = shadeColor(roadBase, roadShade);
        cells[y][x] = { ch, color: roadColor };
        roadPositions.add(`${x},${y}`);
      }
    }

    // Plot interiors + buildings
    const sortedPlots = [...town.plots].sort((a, b) => a.plotIndex - b.plotIndex);
    for (const plot of sortedPlots) {
      const px = Number.isFinite(plot.x) ? plot.x : (plot.plotIndex % cols);
      const py = Number.isFinite(plot.y) ? plot.y : Math.floor(plot.plotIndex / cols);
      const ox = road + px * strideX;
      const oy = road + py * strideY;
      plotRectsLocal.push({
        plotIndex: plot.plotIndex,
        x: ox,
        y: oy,
        w: plotW,
        h: plotH,
        ownerId: plot.ownerId,
        zone: plot.zone,
        status: plot.status,
      });

      const zoneColor = ZONE_STYLE[plot.zone]?.color || '#94a3b8';
      const baseFillBg = hexToRgba(shadeColor(zoneColor, -0.35), 0.16);
      const baseFillColor = shadeColor(zoneColor, -0.25);

      for (let y = oy; y < oy + plotH; y++) {
        for (let x = ox; x < ox + plotW; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            cells[y][x] = { ch: ' ', color: baseFillColor, bg: baseFillBg };
          }
        }
      }

      // Clear label rows
      for (let x = ox; x < ox + plotW; x++) {
        if (cells[oy]?.[x]) cells[oy][x] = { ch: ' ', color: baseFillColor, bg: baseFillBg };
        if (cells[oy + 1]?.[x]) cells[oy + 1][x] = { ch: ' ', color: baseFillColor, bg: baseFillBg };
      }

      // Label
      const label = plotLabel(plot, plotW);
      const labelColor = plot.status === 'EMPTY'
        ? shadeColor(zoneColor, -0.25)
        : shadeColor(zoneColor, 0.35);
      for (let i = 0; i < label.length; i++) {
        const cx = ox + i;
        if (!cells[oy]?.[cx]) continue;
        cells[oy][cx] = { ch: label[i], color: labelColor, bg: baseFillBg, bold: true };
      }

      // Zone icon (left) + owner tag (right)
      const zoneGlyph = ZONE_GLYPH[plot.zone] || '·';
      if (cells[oy + 1]?.[ox]) {
        cells[oy + 1][ox] = { ch: zoneGlyph, color: shadeColor(zoneColor, 0.1), bg: baseFillBg, bold: true };
      }
      const owner = plot.ownerId ? agentById[plot.ownerId] : null;
      if (owner) {
        const tag = `${AGENT_GLYPHS[owner.archetype] || '@'}${shortName(owner.name, 3)}`;
        const faceColor = FACES[owner.archetype]?.color || '#e2e8f0';
        const start = ox + Math.max(0, plotW - tag.length);
        for (let i = 0; i < tag.length; i++) {
          const cx = start + i;
          if (!cells[oy + 1]?.[cx]) continue;
          cells[oy + 1][cx] = { ch: tag[i], color: shadeColor(faceColor, 0.1), bg: baseFillBg, bold: true };
        }
      }

      const bx = ox + Math.floor((plotW - 5) / 2);
      const by = oy + 2;
      const buildingColor = plot.status === 'BUILT'
        ? zoneColor
        : plot.status === 'UNDER_CONSTRUCTION'
          ? mixColor(zoneColor, '#f59e0b', 0.28)
          : plot.status === 'CLAIMED'
            ? mixColor(zoneColor, '#38bdf8', 0.18)
            : shadeColor(zoneColor, -0.25);
      const shape = plot.status === 'BUILT'
        ? (ZONE_SHAPES[plot.zone] || ZONE_SHAPES.RESIDENTIAL)
        : (STATUS_SHAPES[plot.status] || null);
      if (shape) {
        drawBuildingShape(cells, roadPositions, bx, by, shape, buildingColor);
      }

      const decor = DECOR_BY_ZONE[plot.zone] || ['✶'];
      const decorRng = mulberry32(hashString(`${town.id}-${plot.plotIndex}`));
      const decorCount = plot.status === 'EMPTY' ? 2 : 3;
      placeDecor(
        cells,
        decorRng,
        decor,
        ox,
        oy + 2,
        plotW,
        plotH - 2,
        bx,
        by,
        5,
        5,
        shadeColor(zoneColor, -0.05),
        decorCount,
      );

      if (selectedPlot === plot.plotIndex) {
        drawPlotHighlight(cells, ox, oy + 2, plotW, plotH - 2, '#38bdf8');
      } else if (selectedAgentId && plot.ownerId === selectedAgentId) {
        const a = agentById[selectedAgentId];
        const aColor = a ? (FACES[a.archetype]?.color || '#38bdf8') : '#38bdf8';
        drawPlotHighlight(cells, ox, oy + 2, plotW, plotH - 2, aColor);
      }
    }

    return { baseCells: cells, plotRects: plotRectsLocal, roadSet: roadPositions };
  }, [town, height, width, cols, rows, strideX, strideY, plotH, plotW, road, selectedPlot, selectedAgentId, agentById]);

  const [agentPositions, setAgentPositions] = useState<Record<string, AgentPos>>({});
  const trafficHeatRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    trafficHeatRef.current.clear();
  }, [town.id]);

  // Initialize or refresh positions when agents/town changes
  useEffect(() => {
    setAgentPositions((prev) => {
      const now = Date.now();
      const next: Record<string, AgentPos> = { ...prev };
      if (town.plots.length === 0) return next;
      agents.forEach((agent, i) => {
        const existing = next[agent.id];
        if (existing) {
          const key = `${existing.x},${existing.y}`;
          const inBounds = existing.x >= 0 && existing.x < width && existing.y >= 0 && existing.y < height;
          if (inBounds && roadSet.has(key)) return;
        }
        const homePlot = town.plots.find((p) => p.ownerId === agent.id) || town.plots[i % town.plots.length];
        const rect = plotRects.find((r) => r.plotIndex === homePlot.plotIndex);
        if (!rect) return;
        const start = findNearestRoad(rect, roadSet);
        next[agent.id] = {
          x: start.x,
          y: start.y,
          dir: existing?.dir || 's',
          walk: existing?.walk || 0,
          nextStepAt: now + 200 + (hashString(agent.id) % 350),
          restUntil: now + (hashString(agent.id) % 180),
          movingUntil: now,
        };
      });
      return next;
    });
  }, [agents, town.id, town.plots, plotRects, roadSet, width, height]);

  // Simulated walking loop
  useEffect(() => {
    const STEP_MS = 560;
    const MOVE_MS = 360;
    const PAUSE_CHANCE = 0.18;
    const iv = setInterval(() => {
      const now = Date.now();
      setAgentPositions((prev) => {
        const heat = trafficHeatRef.current;
        // Decay heat so roads show recent movement, not permanent paths.
        heat.forEach((v, k) => {
          const nv = v * 0.86;
          if (nv < 0.12) heat.delete(k);
          else heat.set(k, nv);
        });

        const next: Record<string, AgentPos> = { ...prev };
        for (const agent of agents) {
          const pos = next[agent.id];
          if (!pos) continue;
          if (pos.restUntil && now < pos.restUntil) continue;
          if (pos.nextStepAt && now < pos.nextStepAt) continue;

          const activity = activeAgents[agent.id];
          const busy = !!activity && (now - activity.time) < 15000;

          const pauseChance = busy ? 0.55 : PAUSE_CHANCE;
          if (Math.random() < pauseChance) {
            const pauseMs = (busy ? 900 : 520) + Math.floor(Math.random() * (busy ? 1900 : 1400));
            next[agent.id] = {
              ...pos,
              walk: 0,
              nextStepAt: now + pauseMs,
              restUntil: now + Math.floor(pauseMs * 0.55),
              movingUntil: now,
            };
            continue;
          }

          const stepped = stepAlongRoad(pos, roadSet);
          const moved = stepped.x !== pos.x || stepped.y !== pos.y;
          const jitter = Math.floor(Math.random() * 140);
          next[agent.id] = {
            ...pos,
            ...stepped,
            walk: moved ? (((pos.walk || 0) + 1) % 4) : (pos.walk || 0),
            nextStepAt: now + STEP_MS + jitter,
            movingUntil: moved ? now + MOVE_MS : now,
          };
          if (moved) {
            const k = `${stepped.x},${stepped.y}`;
            heat.set(k, (heat.get(k) || 0) + 1);
          }
        }
        return next;
      });
    }, 120);
    return () => clearInterval(iv);
  }, [agents, roadSet, activeAgents]);

  const cellsWithTraffic = useMemo(() => {
    const heat = trafficHeatRef.current;
    if (heat.size === 0) return baseCells;
    const cells = baseCells.map((row) => row.map((c) => ({ ...c })));
    for (const [key, v] of heat.entries()) {
      const comma = key.indexOf(',');
      if (comma === -1) continue;
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cell = cells[y]?.[x];
      if (!cell) continue;
      if (!'─│┼═║╪╫◉'.includes(cell.ch)) continue;
      const t = Math.min(1, v / 6);
      const base = cell.color || '#334155';
      cell.color = mixColor(base, '#38bdf8', 0.18 + 0.62 * t);
      cell.bg = hexToRgba('#38bdf8', 0.05 + 0.12 * t);
      cell.glow = t > 0.15;
      if (t > 0.55) cell.bold = true;
    }
    return cells;
  }, [baseCells, agentPositions]);

  const districtLabels = useMemo(() => {
    const boundsByZone = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
    for (const r of plotRects) {
      if (!r.zone) continue;
      const prev = boundsByZone.get(r.zone);
      const next = prev || { minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h };
      next.minX = Math.min(next.minX, r.x);
      next.minY = Math.min(next.minY, r.y);
      next.maxX = Math.max(next.maxX, r.x + r.w);
      next.maxY = Math.max(next.maxY, r.y + r.h);
      boundsByZone.set(r.zone, next);
    }

    const labels: Array<{ key: string; text: string; x: number; y: number; color: string }> = [];
    for (const [zone, b] of boundsByZone.entries()) {
      const name = districtName(zone, `${town.id}:${town.name}`);
      const glyph = ZONE_GLYPH[zone] ? `${ZONE_GLYPH[zone]} ` : '';
      const text = (glyph + name).toUpperCase();
      const x = Math.max(0, Math.min(width - text.length, Math.floor((b.minX + b.maxX) / 2) - Math.floor(text.length / 2)));
      const y = Math.max(0, b.minY - 0.85);
      const zColor = ZONE_STYLE[zone]?.color || '#94a3b8';
      labels.push({ key: zone, text, x, y, color: shadeColor(zColor, 0.08) });
    }
    return labels;
  }, [plotRects, town.id, town.name, width]);

  const agentSprites = useMemo(() => {
    const now = Date.now();
    const out: Array<{ id: string; x: number; y: number; color: string; tag: string; sprite: string; selected: boolean; active: boolean; action?: string }> = [];
    const sorted = [...agents].sort((a, b) => a.id.localeCompare(b.id));
    for (const agent of sorted) {
      const pos = agentPositions[agent.id];
      if (!pos) continue;
      const faceColor = FACES[agent.archetype]?.color || '#e2e8f0';
      const glyph = AGENT_GLYPHS[agent.archetype] || '@';
      const moving = !!pos.movingUntil && now < pos.movingUntil;
      const frame = moving ? ((Math.floor(now / 170) + (hashString(agent.id) % 2)) % 2) : 0;
      const sprite = droidSprite(agent.archetype, glyph, frame);
      const tag = `${glyph}${shortName(agent.name, 4)}`;
      const activity = activeAgents[agent.id];
      const active = !!activity && (now - activity.time) < 15000;
      out.push({
        id: agent.id,
        x: Math.max(0, Math.min(width - 5, pos.x - 2)),
        y: Math.max(0, Math.min(height - 3, pos.y - 2)),
        color: faceColor,
        tag,
        sprite,
        selected: agent.id === selectedAgentId,
        active,
        action: active ? activity?.action : undefined,
      });
    }
    return out;
  }, [agents, agentPositions, selectedAgentId, activeAgents, width, height]);

  return (
    <div className="td-world-map-wrap" ref={wrapRef}>
      <div className="td-world-map" style={{ fontSize: `${fontSize}px` }}>
        <div className="td-world-map-layer">
          {cellsWithTraffic.map((row, y) => (
            <div key={y} className="td-world-map-line">
              {segmentLine(row).map((seg, i) => (
                <span
                  key={i}
                  style={{
                    color: seg.color,
                    backgroundColor: seg.bg,
                    textShadow: seg.glow ? '0 0 8px currentColor' : undefined,
                    boxShadow: seg.bg ? `0 0 10px ${seg.bg}` : undefined,
                    fontWeight: seg.bold ? 700 : undefined,
                  }}
                >
                  {seg.text}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="td-world-map-labels">
          {districtLabels.map((l) => (
            <div
              key={l.key}
              className="td-world-map-label"
              style={{
                left: `${l.x}ch`,
                top: `${l.y}em`,
                color: l.color,
              }}
            >
              {l.text}
            </div>
          ))}
        </div>
        <div className="td-world-map-agents">
          {agentSprites.map((s) => (
            <div
              key={s.id}
              className={`td-world-map-agent ${s.selected ? 'selected' : ''} ${s.active ? 'active' : ''}`}
              style={{
                left: `${s.x}ch`,
                top: `${s.y}em`,
                '--agent-color': s.color,
              } as React.CSSProperties}
            >
              {s.active && s.action && (
                <div className="td-agent-bubble">▸ {s.action.slice(0, 16)}</div>
              )}
              <div className="td-agent-sprite">{s.sprite}</div>
              <div className="td-agent-tag">{s.tag}</div>
            </div>
          ))}
        </div>
        <div className="td-world-map-hotspots">
          {plotRects.map((r) => (
            <button
              key={r.plotIndex}
              className={`td-world-map-hit ${selectedPlot === r.plotIndex ? 'selected' : ''}`}
              style={{
                left: `${r.x}ch`,
                top: `${r.y}em`,
                width: `${r.w}ch`,
                height: `${r.h}em`,
              }}
              onClick={() => onSelectPlot(r.plotIndex)}
              aria-label={`Plot ${r.plotIndex}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Valley Follow-Cam (Stardew-ish terminal diorama)
// ─────────────────────────────────────────────────────────────

type ValleyKind =
  | 'grass'
  | 'path'
  | 'plaza'
  | 'water'
  | 'shore'
  | 'tree'
  | 'tilled'
  | 'crop'
  | 'fence'
  | 'b_roof'
  | 'b_wall'
  | 'b_window'
  | 'b_door'
  | 'b_emblem'
  | 'sign';

type ValleyTile = { kind: ValleyKind; plotIndex?: number; zone?: string };
type ValleyBuilding = {
  plotIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number;
  doorY: number;
  zone: string;
};

function TownValleyCam({
  town,
  agents,
  activeAgents,
  selectedPlot,
  selectedAgentId,
  onSelectPlot,
}: {
  town: Town;
  agents: Agent[];
  activeAgents: Record<string, AgentActivity>;
  selectedPlot: number | null;
  selectedAgentId: string | null;
  onSelectPlot: (plotIndex: number) => void;
}) {
  const [wrapRef, { width: wrapW, height: wrapH }] = useElementSize();

  const { tilesW, tilesH, charsW, charsH, fontSize } = useMemo(() => {
    const w = Math.max(1, (wrapW || 1) - 32);
    const h = Math.max(1, (wrapH || 1) - 32);
    const charW = 0.62;
    const lineH = 1.0;
    const desiredRows = 44;
    const fs = clampInt(Math.floor(h / (desiredRows * lineH)), 11, 18);
    const colsChars = Math.max(20, Math.floor(w / (fs * charW)));
    const rowsChars = Math.max(16, Math.floor(h / (fs * lineH)));
    const tw = clampInt(Math.floor(colsChars / 2), 34, 120);
    const th = clampInt(rowsChars, 18, 60);
    return { tilesW: tw, tilesH: th, charsW: tw * 2, charsH: th, fontSize: fs };
  }, [wrapW, wrapH]);

  const valleySeed = useMemo(() => hashString(`valley:${town.id}:${town.name}`), [town.id, town.name]);

  const plotLayoutKey = useMemo(() => {
    return [...town.plots]
      .sort((a, b) => a.plotIndex - b.plotIndex)
      .map((p) => `${p.plotIndex}:${Number.isFinite(p.x) ? p.x : 'x'},${Number.isFinite(p.y) ? p.y : 'y'}:${p.zone}`)
      .join('|');
  }, [town.plots]);

  const plotOwnerKey = useMemo(() => {
    return [...town.plots]
      .sort((a, b) => a.plotIndex - b.plotIndex)
      .map((p) => `${p.plotIndex}:${p.ownerId || ''}`)
      .join('|');
  }, [town.plots]);

  const plotByIndex = useMemo(() => {
    const m = new Map<number, Plot>();
    for (const p of town.plots) m.set(p.plotIndex, p);
    return m;
  }, [town.plots]);

  const { world, buildings, points } = useMemo(() => {
    const { cols, rows } = townGridDims(town);
    const rng = mulberry32(valleySeed);

    const buildingW = 10;
    const buildingH = 7;
    const spacingX = 14;
    const spacingY = 12;

    const townBlockW = cols * spacingX;
    const townBlockH = rows * spacingY;
    const worldW = Math.max(220, townBlockW + 120);
    const worldH = Math.max(150, townBlockH + 120);

    const cx = Math.floor(worldW / 2);
    const cy = Math.floor(worldH / 2) - 6;

    const tiles: ValleyTile[][] = Array.from({ length: worldH }, () =>
      Array.from({ length: worldW }, () => ({ kind: 'grass' })),
    );

    // Foresty border to frame the diorama.
    for (let y = 0; y < worldH; y++) {
      for (let x = 0; x < worldW; x++) {
        const edge = Math.min(x, y, worldW - 1 - x, worldH - 1 - y);
        if (edge > 10) continue;
        const p = 0.55 - edge * 0.045;
        if (rng() < p) tiles[y][x] = { kind: 'tree' };
      }
    }

    // River (meandering)
    let rx = clampInt(Math.floor(worldW * (0.64 + (rng() - 0.5) * 0.10)), 18, worldW - 18);
    for (let y = 0; y < worldH; y++) {
      rx += Math.floor((rng() - 0.5) * 3);
      rx = clampInt(rx, 16, worldW - 16);
      const rw = 2 + (rng() < 0.35 ? 1 : 0);
      for (let dx = -rw; dx <= rw; dx++) {
        const x = rx + dx;
        if (x < 0 || x >= worldW) continue;
        tiles[y][x] = { kind: 'water' };
      }
    }

    // Clear a "town basin" so it doesn't get eaten by trees/water.
    for (let y = cy - Math.floor(townBlockH / 2) - 16; y <= cy + Math.floor(townBlockH / 2) + 16; y++) {
      for (let x = cx - Math.floor(townBlockW / 2) - 16; x <= cx + Math.floor(townBlockW / 2) + 16; x++) {
        if (!tiles[y]?.[x]) continue;
        if (tiles[y][x].kind === 'water') tiles[y][x] = { kind: 'grass' };
        if (tiles[y][x].kind === 'tree' && rng() < 0.85) tiles[y][x] = { kind: 'grass' };
      }
    }

    // Shoreline
    for (let y = 1; y < worldH - 1; y++) {
      for (let x = 1; x < worldW - 1; x++) {
        if (tiles[y][x].kind !== 'grass') continue;
        const nearWater =
          tiles[y - 1][x].kind === 'water' ||
          tiles[y + 1][x].kind === 'water' ||
          tiles[y][x - 1].kind === 'water' ||
          tiles[y][x + 1].kind === 'water';
        if (nearWater) tiles[y][x] = { kind: 'shore' };
      }
    }

    const carve = (x: number, y: number, kind: ValleyKind) => {
      const t = tiles[y]?.[x];
      if (!t) return;
      if (t.kind === 'water' || t.kind === 'tree') return;
      tiles[y][x] = { ...t, kind };
    };

    const carvePath = (fromX: number, fromY: number, toX: number, toY: number) => {
      let x = fromX;
      let y = fromY;
      let guard = 0;
      while ((x !== toX || y !== toY) && guard < 2000) {
        guard++;
        carve(x, y, 'path');
        const dx = toX - x;
        const dy = toY - y;
        const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
        const chooseX = Math.abs(dx) > Math.abs(dy) ? rng() < 0.8 : rng() < 0.45;
        if (chooseX && stepX !== 0) x += stepX;
        else if (stepY !== 0) y += stepY;
        else if (stepX !== 0) x += stepX;
      }
      carve(toX, toY, 'path');
    };

    // Plaza + main paths
    const plazaW = 22;
    const plazaH = 10;
    for (let y = cy - Math.floor(plazaH / 2); y < cy - Math.floor(plazaH / 2) + plazaH; y++) {
      for (let x = cx - Math.floor(plazaW / 2); x < cx - Math.floor(plazaW / 2) + plazaW; x++) {
        carve(x, y, 'plaza');
      }
    }
    for (let x = cx - Math.floor(plazaW / 2) - 30; x <= cx + Math.floor(plazaW / 2) + 30; x++) carve(x, cy, 'path');
    for (let y = cy - Math.floor(plazaH / 2) - 22; y <= cy + Math.floor(plazaH / 2) + 28; y++) carve(cx, y, 'path');

    // Farm patch (bottom-left-ish)
    const farm = { x: 26, y: Math.floor(worldH * 0.64), w: 58, h: 26 };
    for (let y = farm.y; y < farm.y + farm.h; y++) {
      for (let x = farm.x; x < farm.x + farm.w; x++) {
        if (!tiles[y]?.[x]) continue;
        if (tiles[y][x].kind === 'water' || tiles[y][x].kind === 'tree') continue;
        const r = hash2d(x, y, valleySeed);
        tiles[y][x] = { kind: r < 0.65 ? 'tilled' : r < 0.80 ? 'crop' : 'grass' };
      }
    }
    // Fence + gate
    for (let x = farm.x - 1; x <= farm.x + farm.w; x++) {
      carve(x, farm.y - 1, 'fence');
      carve(x, farm.y + farm.h, 'fence');
    }
    for (let y = farm.y - 1; y <= farm.y + farm.h; y++) {
      carve(farm.x - 1, y, 'fence');
      carve(farm.x + farm.w, y, 'fence');
    }
    const gateX = farm.x + Math.floor(farm.w / 2);
    carve(gateX, farm.y + farm.h, 'path');
    carve(gateX - 1, farm.y + farm.h, 'path');
    carvePath(cx, cy + Math.floor(plazaH / 2) + 6, gateX, farm.y + farm.h + 1);

    // Buildings per plot (scaled from plot grid)
    const startX = cx - Math.floor(townBlockW / 2);
    const startY = cy - Math.floor(townBlockH / 2);
    const sortedPlots = [...town.plots].sort((a, b) => a.plotIndex - b.plotIndex);
    const buildingsLocal: ValleyBuilding[] = [];

    for (const plot of sortedPlots) {
      const px = Number.isFinite(plot.x) ? plot.x : (plot.plotIndex % cols);
      const py = Number.isFinite(plot.y) ? plot.y : Math.floor(plot.plotIndex / cols);
      const bx = startX + px * spacingX;
      const by = startY + py * spacingY;

      const b: ValleyBuilding = {
        plotIndex: plot.plotIndex,
        x: bx,
        y: by,
        w: buildingW,
        h: buildingH,
        doorX: bx + Math.floor(buildingW / 2),
        doorY: by + buildingH - 1,
        zone: plot.zone,
      };
      buildingsLocal.push(b);

      // Yard around the building
      for (let y = by - 1; y < by + buildingH + 1; y++) {
        for (let x = bx - 2; x < bx + buildingW + 2; x++) {
          if (!tiles[y]?.[x]) continue;
          if (tiles[y][x].kind === 'water' || tiles[y][x].kind === 'tree') continue;
          if (tiles[y][x].kind === 'grass') tiles[y][x] = { kind: 'shore' };
        }
      }

      // Building footprint (rendered based on plot status at draw-time)
      for (let y = by; y < by + buildingH; y++) {
        for (let x = bx; x < bx + buildingW; x++) {
          if (!tiles[y]?.[x]) continue;
          const isTop = y === by;
          const isBottom = y === by + buildingH - 1;
          const isLeft = x === bx;
          const isRight = x === bx + buildingW - 1;
          const isEdge = isTop || isBottom || isLeft || isRight;
          const kind: ValleyKind = isTop ? 'b_roof' : isEdge ? 'b_wall' : 'b_wall';
          tiles[y][x] = { kind, plotIndex: plot.plotIndex, zone: plot.zone };
        }
      }

      // Door + windows + emblem (these may be hidden until BUILT)
      tiles[b.doorY][b.doorX] = { kind: 'b_door', plotIndex: plot.plotIndex, zone: plot.zone };
      tiles[by + 2][bx + 2] = { kind: 'b_window', plotIndex: plot.plotIndex, zone: plot.zone };
      tiles[by + 2][bx + buildingW - 3] = { kind: 'b_window', plotIndex: plot.plotIndex, zone: plot.zone };
      tiles[by + 3][bx + Math.floor(buildingW / 2)] = { kind: 'b_emblem', plotIndex: plot.plotIndex, zone: plot.zone };

      // Connect building to plaza
      carvePath(b.doorX, b.doorY + 2, cx, cy);

      // Plot signpost (only visible when the plot is EMPTY; otherwise blends into the path).
      const signX = clampInt(b.doorX + 2, 0, worldW - 1);
      const signY = clampInt(b.doorY + 2, 0, worldH - 1);
      if (tiles[signY]?.[signX] && tiles[signY][signX].kind !== 'water' && tiles[signY][signX].kind !== 'tree') {
        tiles[signY][signX] = { kind: 'sign', plotIndex: plot.plotIndex, zone: plot.zone };
      }
    }

    return {
      world: tiles,
      buildings: buildingsLocal,
      points: {
        cx,
        cy,
        farmX: gateX,
        farmY: farm.y + farm.h,
      },
    };
  }, [town.id, town.name, town.totalPlots, plotLayoutKey, valleySeed]);

  const [clock, setClock] = useState(() => (hashString(`clock:${town.id}`) % (24 * 60)));
  const [weather, setWeather] = useState<'SUN' | 'RAIN'>(() => (hashString(`wx:${town.id}`) % 7 === 0 ? 'RAIN' : 'SUN'));

  useEffect(() => {
    setClock(hashString(`clock:${town.id}`) % (24 * 60));
    setWeather(hashString(`wx:${town.id}`) % 7 === 0 ? 'RAIN' : 'SUN');
  }, [town.id]);

  useEffect(() => {
    const iv = setInterval(() => {
      setClock((m) => (m + 3) % (24 * 60));
    }, 1000);
    return () => clearInterval(iv);
  }, [town.id]);

  const light = useMemo(() => {
    const t = clock / (24 * 60); // 0..1
    const day = Math.max(0, Math.sin((t - 0.25) * Math.PI * 2));
    return 0.25 + 0.85 * day;
  }, [clock]);

  const [agentPositions, setAgentPositions] = useState<Record<string, AgentPos>>({});
  const goalsRef = useRef<Record<string, { x: number; y: number; until: number }>>({});
  const trailRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setAgentPositions((prev) => {
      const now = Date.now();
      const next: Record<string, AgentPos> = { ...prev };
      const buildingByPlot = new Map<number, ValleyBuilding>();
      buildings.forEach((b) => buildingByPlot.set(b.plotIndex, b));
      if (buildings.length === 0) return next;

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const existing = next[agent.id];
        if (existing && world[existing.y]?.[existing.x] && isPassable(world[existing.y][existing.x].kind)) continue;

        const homePlot = town.plots.find((p) => p.ownerId === agent.id) || town.plots[i % town.plots.length];
        const b = homePlot ? buildingByPlot.get(homePlot.plotIndex) : buildings[i % buildings.length];
        const start = b ? { x: b.doorX, y: b.doorY + 2 } : { x: points.cx, y: points.cy };
        next[agent.id] = {
          x: start.x,
          y: start.y,
          dir: existing?.dir || 's',
          walk: existing?.walk || 0,
          nextStepAt: now + 240 + (hashString(agent.id) % 420),
          restUntil: now + (hashString(agent.id) % 220),
          movingUntil: now,
        };
      }
      return next;
    });
  }, [agents, town.id, plotOwnerKey, buildings, world, points]);

  useEffect(() => {
    goalsRef.current = {};
    trailRef.current.clear();
  }, [town.id, plotLayoutKey]);

  useEffect(() => {
    const STEP_MS = 560;
    const MOVE_MS = 380;
    const iv = setInterval(() => {
      const now = Date.now();
      const trail = trailRef.current;
      trail.forEach((v, k) => {
        const nv = v * 0.86;
        if (nv < 0.12) trail.delete(k);
        else trail.set(k, nv);
      });

      setAgentPositions((prev) => {
        const next: Record<string, AgentPos> = { ...prev };
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          const pos = next[agent.id];
          if (!pos) continue;

          if (pos.restUntil && now < pos.restUntil) continue;
          if (pos.nextStepAt && now < pos.nextStepAt) continue;

          const activity = activeAgents[agent.id];
          const busy = !!activity && (now - activity.time) < 15000;

          let g = goalsRef.current[agent.id];
          if (!g || now > g.until) {
            g = pickGoal(agent, buildings, plotByIndex, points, now, valleySeed);
            goalsRef.current[agent.id] = g;
          }

          const dist = Math.abs(g.x - pos.x) + Math.abs(g.y - pos.y);
          if (dist < 2) {
            // Arrived — linger a bit, then pick a fresh destination.
            const pauseMs = (busy ? 1600 : 900) + Math.floor(Math.random() * (busy ? 5200 : 3200));
            next[agent.id] = {
              ...pos,
              walk: 0,
              restUntil: now + pauseMs,
              nextStepAt: now + pauseMs,
              movingUntil: now,
            };
            delete goalsRef.current[agent.id];
            continue;
          }

          // Occasional micro-pause so they don't look like roombas.
          const pauseChance = busy ? 0.32 : 0.12;
          if (Math.random() < pauseChance) {
            const pauseMs = (busy ? 800 : 520) + Math.floor(Math.random() * (busy ? 1600 : 1100));
            next[agent.id] = {
              ...pos,
              walk: 0,
              restUntil: now + Math.floor(pauseMs * 0.6),
              nextStepAt: now + pauseMs,
              movingUntil: now,
            };
            continue;
          }

          const stepped = stepTowardGoal(pos, g, world, plotByIndex);
          const moved = stepped.x !== pos.x || stepped.y !== pos.y;
          const k = `${stepped.x},${stepped.y}`;
          if (moved) trail.set(k, (trail.get(k) || 0) + 1);

          const jitter = Math.floor(Math.random() * 160);
          next[agent.id] = {
            ...pos,
            ...stepped,
            walk: moved ? (((pos.walk || 0) + 1) % 4) : (pos.walk || 0),
            nextStepAt: now + (busy ? Math.floor(STEP_MS * 1.25) : STEP_MS) + jitter,
            movingUntil: moved ? now + MOVE_MS : now,
          };
        }
        return next;
      });
    }, 120);
    return () => clearInterval(iv);
  }, [agents, activeAgents, buildings, plotByIndex, world, points, valleySeed]);

  const focusId = selectedAgentId && agentPositions[selectedAgentId] ? selectedAgentId : (agents[0]?.id || null);
  const focusPos = focusId ? agentPositions[focusId] : null;
  const worldW = world[0]?.length || 1;
  const worldH = world.length || 1;
  const clampCam = (l: number, t: number) => ({
    left: clampInt(l, 0, Math.max(0, worldW - tilesW)),
    top: clampInt(t, 0, Math.max(0, worldH - tilesH)),
  });
  const [cam, setCam] = useState(() => clampCam(points.cx - Math.floor(tilesW / 2), points.cy - Math.floor(tilesH / 2)));

  // Reset camera when town or viewport changes.
  useEffect(() => {
    setCam(clampCam(points.cx - Math.floor(tilesW / 2), points.cy - Math.floor(tilesH / 2)));
  }, [town.id, tilesW, tilesH, points.cx, points.cy, worldW, worldH]);

  // Dead-zone camera: only scroll when the focus nears the edge of the viewport.
  useEffect(() => {
    if (!focusPos) return;
    setCam((prev) => {
      let l = prev.left;
      let t = prev.top;
      const marginX = clampInt(Math.floor(tilesW * 0.35), 6, Math.max(6, Math.floor(tilesW / 2)));
      const marginY = clampInt(Math.floor(tilesH * 0.35), 5, Math.max(5, Math.floor(tilesH / 2)));

      const fx = focusPos.x;
      const fy = focusPos.y;
      if (fx - l < marginX) l = fx - marginX;
      else if (fx - l > tilesW - marginX) l = fx - (tilesW - marginX);
      if (fy - t < marginY) t = fy - marginY;
      else if (fy - t > tilesH - marginY) t = fy - (tilesH - marginY);

      const next = clampCam(l, t);
      if (next.left === prev.left && next.top === prev.top) return prev;
      return next;
    });
  }, [focusPos?.x, focusPos?.y, tilesW, tilesH, worldW, worldH]);

  const left = cam.left;
  const top = cam.top;

  const frame = Math.floor(Date.now() / 260) % 3;

  const { cells, visibleBuildings } = useMemo(() => {
    const cellsLocal: MapCell[][] = Array.from({ length: charsH }, () =>
      Array.from({ length: charsW }, () => ({ ch: ' ', color: '#0b1220' })),
    );

    for (let vy = 0; vy < tilesH; vy++) {
      const wy = top + vy;
      for (let vx = 0; vx < tilesW; vx++) {
        const wx = left + vx;
        const tile = world[wy]?.[wx] || { kind: 'grass' as const };
        const heat = trailRef.current.get(`${wx},${wy}`) || 0;
        const plotStatus = tile.plotIndex != null ? (plotByIndex.get(tile.plotIndex)?.status) : undefined;
        const r = hash2d(wx, wy, valleySeed);
        const style = renderValleyTile(tile, r, frame, heat, plotStatus);
        const cx = vx * 2;
        cellsLocal[vy][cx] = { ch: style.ch0, color: style.color, bg: style.bg, glow: style.glow };
        cellsLocal[vy][cx + 1] = { ch: style.ch1, color: style.color, bg: style.bg, glow: style.glow };
      }
    }

    // Weather overlay (rain)
    if (weather === 'RAIN') {
      const rainSeed = (Math.floor(Date.now() / 140) & 0xffff) ^ valleySeed;
      for (let i = 0; i < Math.floor((tilesW * tilesH) / 28); i++) {
        const rx = Math.floor(hash2d(i, rainSeed, valleySeed) * charsW);
        const ry = Math.floor(hash2d(rainSeed, i, valleySeed) * charsH);
        const c = cellsLocal[ry]?.[rx];
        if (!c) continue;
        c.ch = (i % 3 === 0) ? '╎' : '│';
        c.color = 'rgba(96, 165, 250, 0.55)';
      }
    }

    // Building label (only: selected plot, or near focus)
    const focus = focusPos || { x: points.cx, y: points.cy };
    const visible: ValleyBuilding[] = [];
    for (const b of buildings) {
      const inView =
        b.x + b.w >= left &&
        b.x <= left + tilesW &&
        b.y + b.h >= top &&
        b.y <= top + tilesH;
      if (!inView) continue;
      visible.push(b);

      const isSelected = selectedPlot === b.plotIndex;
      const near = Math.abs(b.doorX - focus.x) + Math.abs(b.doorY - focus.y) <= 16;
      if (!isSelected && !near) continue;

      const plot = plotByIndex.get(b.plotIndex);
      const status = plot?.status || 'EMPTY';
      const rawName = status === 'EMPTY'
        ? 'Open Lot'
        : (plot?.buildingName || plot?.buildingType || plot?.zone || b.zone);
      const label = abbreviateWords(stripLeadingArticle(rawName).replace(/[^a-zA-Z0-9 ]/g, '').trim(), 16).toUpperCase();
      const lx = clampInt((b.doorX - left) * 2 - Math.floor(label.length / 2), 0, charsW - label.length);
      const ly = clampInt((b.y - top) - 1, 0, charsH - 1);
      const zColor = ZONE_STYLE[b.zone]?.color || '#e2e8f0';
      for (let i = 0; i < label.length; i++) {
        const cx = lx + i;
        if (!cellsLocal[ly]?.[cx]) continue;
        cellsLocal[ly][cx] = {
          ch: label[i],
          color: shadeColor(zColor, 0.15),
          bg: hexToRgba('#020617', 0.55),
          glow: true,
          bold: true,
        };
      }
    }

    // Plot highlight corners (selected)
    if (selectedPlot != null) {
      const b = visible.find((v) => v.plotIndex === selectedPlot) || buildings.find((v) => v.plotIndex === selectedPlot);
      if (b) {
        const x0 = (b.x - left) * 2;
        const y0 = b.y - top;
        const x1 = (b.x + b.w - 1 - left) * 2 + 1;
        const y1 = b.y + b.h - 1 - top;
        const c = '#34d399';
        const corners = [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x0, y: y1 },
          { x: x1, y: y1 },
        ];
        for (const pt of corners) {
          if (!cellsLocal[pt.y]?.[pt.x]) continue;
          cellsLocal[pt.y][pt.x] = { ch: '•', color: c, bg: hexToRgba('#34d399', 0.08), glow: true, bold: true };
        }
      }
    }

    return { cells: cellsLocal, visibleBuildings: visible };
  }, [
    agentPositions,
    buildings,
    world,
    tilesW,
    tilesH,
    charsW,
    charsH,
    left,
    top,
    frame,
    valleySeed,
    weather,
    plotByIndex,
    points,
    focusPos,
    selectedPlot,
  ]);

  const clockLabel = useMemo(() => {
    const hh = Math.floor(clock / 60);
    const mm = clock % 60;
    const am = hh < 12;
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${mm.toString().padStart(2, '0')}${am ? 'am' : 'pm'}`;
  }, [clock]);

  const valleyAgentSprites = useMemo(() => {
    const now = Date.now();
    const out: Array<{ id: string; x: number; y: number; color: string; tag: string; sprite: string; selected: boolean; active: boolean; action?: string; moving: boolean }> = [];
    const sorted = [...agents].sort((a, b) => a.id.localeCompare(b.id));
    for (const agent of sorted) {
      const pos = agentPositions[agent.id];
      if (!pos) continue;
      const centerX = (pos.x - left) * 2 + 1;
      const footY = pos.y - top;
      if (footY < -6 || footY > charsH + 6 || centerX < -12 || centerX > charsW + 12) continue;

      const faceColor = FACES[agent.archetype]?.color || '#e2e8f0';
      const glyph = AGENT_GLYPHS[agent.archetype] || '@';
      const moving = !!pos.movingUntil && now < pos.movingUntil;
      const frame = moving ? ((Math.floor(now / 170) + (hashString(agent.id) % 2)) % 2) : 0;
      const sprite = valleyDroidSprite(agent.archetype, glyph, frame, moving);
      const lines = sprite.split('\n');
      const sw = Math.max(0, ...lines.map((l) => l.length));
      const sh = lines.length;
      const sx = clampInt(centerX - Math.floor(sw / 2), 0, Math.max(0, charsW - sw));
      const sy = clampInt(footY - (sh - 1), 0, Math.max(0, charsH - sh));
      const tag = `${glyph}${shortName(agent.name, 6)}`;
      const activity = activeAgents[agent.id];
      const active = !!activity && (now - activity.time) < 15000;
      out.push({
        id: agent.id,
        x: sx,
        y: sy,
        color: faceColor,
        tag,
        sprite,
        selected: agent.id === selectedAgentId,
        active,
        action: active ? activity?.action : undefined,
        moving,
      });
    }
    return out;
  }, [agents, agentPositions, activeAgents, left, top, charsW, charsH, selectedAgentId]);

  return (
    <div className="td-world-map-wrap" ref={wrapRef}>
      <div
        className="td-world-map td-valley-map"
        style={{
          fontSize: `${fontSize}px`,
          filter: `brightness(${(0.70 + 0.55 * light).toFixed(2)}) saturate(${(0.85 + 0.35 * light).toFixed(2)})`,
        }}
      >
        <div className="td-valley-hud">
          <div className="td-valley-hud-box">
            <div className="td-valley-hud-title">Follow Cam</div>
            <div className="td-valley-hud-line">
              {clockLabel} · {weather === 'RAIN' ? 'RAIN' : 'SUN'}
            </div>
          </div>
          <div className="td-valley-hud-box">
            <div className="td-valley-hud-title">Focus</div>
            <div className="td-valley-hud-line">
              {focusId ? (agents.find((a) => a.id === focusId)?.name || '—') : '—'}
            </div>
          </div>
        </div>

        <div className="td-world-map-layer">
          {cells.map((row, y) => (
            <div key={y} className="td-world-map-line">
              {segmentLine(row).map((seg, i) => (
                <span
                  key={i}
                  style={{
                    color: seg.color,
                    backgroundColor: seg.bg,
                    textShadow: seg.glow ? '0 0 8px currentColor' : undefined,
                    boxShadow: seg.bg ? `0 0 10px ${seg.bg}` : undefined,
                    fontWeight: seg.bold ? 700 : undefined,
                  }}
                >
                  {seg.text}
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="td-world-map-agents">
          {valleyAgentSprites.map((s) => (
            <div
              key={s.id}
              className={`td-world-map-agent ${s.selected ? 'selected' : ''} ${s.active ? 'active' : ''} ${s.moving ? 'moving' : ''}`}
              style={{
                left: `${s.x}ch`,
                top: `${s.y}em`,
                '--agent-color': s.color,
              } as React.CSSProperties}
            >
              {s.active && s.action && (
                <div className="td-agent-bubble">▸ {s.action.slice(0, 18)}</div>
              )}
              <div className="td-agent-sprite">{s.sprite}</div>
              <div className="td-agent-tag">{s.tag}</div>
            </div>
          ))}
        </div>

        <div className="td-world-map-hotspots">
          {visibleBuildings.map((b) => {
            const sx = (b.x - left) * 2;
            const sy = b.y - top;
            return (
              <button
                key={b.plotIndex}
                className={`td-world-map-hit ${selectedPlot === b.plotIndex ? 'selected' : ''}`}
                style={{
                  left: `${sx}ch`,
                  top: `${sy}em`,
                  width: `${b.w * 2}ch`,
                  height: `${b.h}em`,
                }}
                onClick={() => onSelectPlot(b.plotIndex)}
                aria-label={`Plot ${b.plotIndex}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function drawBuildingShape(
  cells: MapCell[][],
  roadSet: Set<string>,
  x: number,
  y: number,
  shape: string[],
  color: string,
) {
  for (let dy = 0; dy < shape.length; dy++) {
    const row = shape[dy] || '';
    const shade = dy === 0 ? 0.2 : dy === shape.length - 1 ? -0.18 : dy === 1 ? 0.1 : -0.04;
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx];
      if (ch === ' ') continue;
      const cy = y + dy;
      const cx = x + dx;
      if (!cells[cy] || !cells[cy][cx]) continue;
      const prev = cells[cy][cx];
      cells[cy][cx] = { ch, color: shadeColor(color, shade), bg: prev.bg };
    }
  }
  drawShadow(cells, roadSet, x, y, shape[0]?.length || 5, shape.length, shadeColor(color, -0.55));
}

function drawShadow(
  cells: MapCell[][],
  roadSet: Set<string>,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const shadow = [
    { dx: w - 1, dy: h },
    { dx: w, dy: h - 1 },
    { dx: w, dy: h },
    { dx: w - 2, dy: h },
  ];
  for (const s of shadow) {
    const cx = x + s.dx;
    const cy = y + s.dy;
    if (!cells[cy] || !cells[cy][cx]) continue;
    if (roadSet.has(`${cx},${cy}`)) continue;
    const prev = cells[cy][cx];
    cells[cy][cx] = { ch: '░', color, bg: prev.bg };
  }
}

function plotLabel(plot: Plot, width: number): string {
  if (plot.status === 'EMPTY') {
    return 'open'.padEnd(width, ' ').slice(0, width);
  }
  const zoneShort: Record<string, string> = {
    RESIDENTIAL: 'res',
    COMMERCIAL: 'com',
    CIVIC: 'civ',
    INDUSTRIAL: 'ind',
    ENTERTAINMENT: 'ent',
  };
  const raw = plot.buildingName || plot.buildingType || zoneShort[plot.zone] || plot.zone;
  const cleaned = stripLeadingArticle(raw).replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const label = abbreviateWords(cleaned, Math.min(8, width));
  return label.padEnd(width, ' ').slice(0, width);
}

function stripLeadingArticle(text: string): string {
  return text.replace(/^(the|a|an)\s+/i, '');
}

function abbreviateWords(text: string, max: number): string {
  if (!text) return ''.padEnd(max, ' ');
  if (text.length <= max) return text;
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = compressWord(parts[0], Math.min(4, max));
    const second = parts[1].slice(0, Math.min(3, Math.max(0, max - first.length)));
    return (first + second).slice(0, max);
  }
  return compressWord(text, max);
}

function compressWord(word: string, max: number): string {
  if (word.length <= max) return word;
  const letters = word.split('');
  const head = letters[0];
  const consonants = letters.slice(1).filter((c) => !/[aeiou]/i.test(c));
  let out = head + consonants.join('');
  if (out.length < max) {
    const vowels = letters.slice(1).filter((c) => /[aeiou]/i.test(c));
    out += vowels.join('');
  }
  return out.slice(0, max);
}

function shortName(name: string, max: number): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return ''.padEnd(max, ' ');
  return cleaned.slice(0, max);
}

function placeDecor(
  cells: MapCell[][],
  rng: () => number,
  glyphs: string[],
  ox: number,
  oy: number,
  w: number,
  h: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  color: string,
  count: number,
) {
  const attempts = 14;
  let placed = 0;
  const max = Math.max(0, count);
  for (let i = 0; i < attempts && placed < max; i++) {
    const x = ox + Math.floor(rng() * w);
    const y = oy + Math.floor(rng() * h);
    const inBuilding = x >= bx && x < bx + bw && y >= by && y < by + bh;
    if (inBuilding) continue;
    if (!cells[y] || !cells[y][x]) continue;
    if (cells[y][x].ch.trim() !== '') continue;
    const glyph = glyphs[Math.floor(rng() * glyphs.length)];
    const prev = cells[y][x];
    cells[y][x] = { ch: glyph, color: shadeColor(color, -0.1), bg: prev.bg };
    placed++;
  }
}

function drawPlotHighlight(cells: MapCell[][], ox: number, oy: number, w: number, h: number, color: string) {
  const corners = [
    { x: ox, y: oy },
    { x: ox + w - 1, y: oy },
    { x: ox, y: oy + h - 1 },
    { x: ox + w - 1, y: oy + h - 1 },
  ];
  for (const c of corners) {
    if (!cells[c.y] || !cells[c.y][c.x]) continue;
    const prev = cells[c.y][c.x];
    cells[c.y][c.x] = { ch: '•', color, bg: prev.bg, bold: true };
  }
}

function segmentLine(row: MapCell[]): Array<{ text: string; color?: string; bg?: string; glow?: boolean; bold?: boolean }> {
  const out: Array<{ text: string; color?: string; bg?: string; glow?: boolean; bold?: boolean }> = [];
  for (const cell of row) {
    const last = out[out.length - 1];
    const key = `${cell.color || ''}|${cell.bg || ''}|${cell.glow ? 1 : 0}|${cell.bold ? 1 : 0}`;
    const lastKey = last ? `${last.color || ''}|${last.bg || ''}|${last.glow ? 1 : 0}|${last.bold ? 1 : 0}` : null;
    if (!last || key !== lastKey) {
      out.push({ text: cell.ch, color: cell.color, bg: cell.bg, glow: cell.glow, bold: cell.bold });
    } else {
      last.text += cell.ch;
    }
  }
  return out;
}

function shadeColor(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6 && raw.length !== 8) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const a = raw.length === 8 ? raw.slice(6, 8) : '';
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const rr = clamp(r + 255 * amount).toString(16).padStart(2, '0');
  const gg = clamp(g + 255 * amount).toString(16).padStart(2, '0');
  const bb = clamp(b + 255 * amount).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}${a}`;
}

function mixColor(a: string, b: string, t: number): string {
  const ta = a.replace('#', '');
  const tb = b.replace('#', '');
  if (ta.length !== 6 || tb.length !== 6) return a;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const tt = clamp01(t);
  const ar = parseInt(ta.slice(0, 2), 16);
  const ag = parseInt(ta.slice(2, 4), 16);
  const ab = parseInt(ta.slice(4, 6), 16);
  const br = parseInt(tb.slice(0, 2), 16);
  const bg = parseInt(tb.slice(2, 4), 16);
  const bb = parseInt(tb.slice(4, 6), 16);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * tt).toString(16).padStart(2, '0');
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6 && raw.length !== 8) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hash2d(x: number, y: number, seed: number): number {
  // Fast-ish 2D hash -> [0,1)
  let h = (seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function townGridDims(town: Town): { cols: number; rows: number } {
  let maxX = -1;
  let maxY = -1;
  for (const p of town.plots) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const minCols = Math.max(1, maxX + 1);
  const minRows = Math.max(1, maxY + 1);
  const baseCols = Math.max(1, Math.ceil(Math.sqrt(town.totalPlots)));
  const cols = Math.max(minCols, baseCols);
  const rows = Math.max(minRows, Math.ceil(town.totalPlots / cols));
  return { cols, rows };
}

function isPassable(kind: ValleyKind): boolean {
  return kind !== 'water' && kind !== 'tree' && kind !== 'fence' && !kind.startsWith('b_');
}

function isPassableTile(tile: ValleyTile, plotByIndex: Map<number, Plot>): boolean {
  if (tile.kind === 'water' || tile.kind === 'tree' || tile.kind === 'fence') return false;
  if (tile.kind.startsWith('b_')) {
    const status = tile.plotIndex != null ? (plotByIndex.get(tile.plotIndex)?.status || 'EMPTY') : 'EMPTY';
    return status === 'EMPTY';
  }
  return true;
}

function stepTowardGoal(
  pos: AgentPos,
  goal: { x: number; y: number },
  world: ValleyTile[][],
  plotByIndex: Map<number, Plot>,
): AgentPos {
  const dirs: Array<{ dir: AgentPos['dir']; dx: number; dy: number }> = [
    { dir: 'n', dx: 0, dy: -1 },
    { dir: 's', dx: 0, dy: 1 },
    { dir: 'e', dx: 1, dy: 0 },
    { dir: 'w', dx: -1, dy: 0 },
  ];

  const curDist = Math.abs(goal.x - pos.x) + Math.abs(goal.y - pos.y);
  const options = dirs
    .map((d) => ({ ...d, x: pos.x + d.dx, y: pos.y + d.dy }))
    .filter((d) => {
      const t = world[d.y]?.[d.x];
      return !!t && isPassableTile(t, plotByIndex);
    });

  if (options.length === 0) return pos;

  const opposite = (dir: AgentPos['dir'] | undefined) =>
    (dir === 'n' ? 's' : dir === 's' ? 'n' : dir === 'e' ? 'w' : dir === 'w' ? 'e' : undefined);

  let best = options;
  best = best.filter((o) => o.dir !== opposite(pos.dir));
  if (best.length === 0) best = options;

  const scored = best.map((o) => {
    const d = Math.abs(goal.x - o.x) + Math.abs(goal.y - o.y);
    const t = world[o.y]?.[o.x];
    const rawKind = t?.kind;
    const status = t?.plotIndex != null ? (plotByIndex.get(t.plotIndex)?.status || 'EMPTY') : 'BUILT';
    const kind = rawKind && rawKind.startsWith('b_') && status === 'EMPTY' ? 'grass' : rawKind;
    const bias = kind === 'path' || kind === 'plaza' ? -0.8 : kind === 'shore' ? 0.2 : kind === 'crop' ? 0.4 : 0;
    return { o, score: d + bias };
  });

  scored.sort((a, b) => a.score - b.score);
  const bestScore = scored[0]?.score ?? curDist;
  const top = scored.filter((s) => s.score <= bestScore + 0.01);
  const pick = top[Math.floor(Math.random() * top.length)]?.o || scored[0].o;
  return { x: pick.x, y: pick.y, dir: pick.dir };
}

function pickGoal(
  agent: Agent,
  buildings: ValleyBuilding[],
  plotByIndex: Map<number, Plot>,
  points: { cx: number; cy: number; farmX: number; farmY: number },
  now: number,
  seed: number,
): { x: number; y: number; until: number } {
  const r = hash2d(hashString(agent.id) & 0xffff, now & 0xffff, seed);
  const until = now + (3500 + Math.floor(r * 8500));

  // Bias: owners revisit their plots; otherwise wander between plaza/farm and random buildings.
  const owned = buildings.filter((b) => {
    const p = plotByIndex.get(b.plotIndex);
    return p?.ownerId === agent.id && p?.status !== 'EMPTY';
  });
  const pool = owned.length > 0
    ? owned
    : buildings.filter((b) => (plotByIndex.get(b.plotIndex)?.status || 'EMPTY') !== 'EMPTY');

  if (r < 0.18) return { x: points.farmX, y: points.farmY, until };
  if (r < 0.42) return { x: points.cx, y: points.cy, until };
  if (pool.length > 0) {
    const pick = pool[Math.floor(r * pool.length) % pool.length];
    return { x: pick.doorX, y: pick.doorY + 2, until };
  }
  return { x: points.cx, y: points.cy, until };
}

function renderValleyTile(
  tile: ValleyTile,
  r: number,
  frame: number,
  heat: number,
  plotStatus?: string,
): { ch0: string; ch1: string; color: string; bg?: string; glow?: boolean } {
  const heatT = Math.min(1, heat / 6);
  const status = plotStatus || (tile.plotIndex != null ? 'EMPTY' : 'BUILT');

  const applyHeat = (base: string) => {
    if (heatT <= 0) return { color: base, bg: undefined as string | undefined, glow: false };
    const c = mixColor(base, '#34d399', 0.12 + 0.60 * heatT);
    const bg = hexToRgba('#34d399', 0.04 + 0.10 * heatT);
    return { color: c, bg, glow: heatT > 0.18 };
  };

  const grassStyle = () => {
    const ch = r < 0.07 ? '"' : r < 0.14 ? ',' : r < 0.28 ? '·' : ' ';
    const base = shadeColor('#22c55e', -0.38 + 0.12 * r);
    return { ch0: ch, ch1: ch, color: base };
  };

  const scaffoldStyle = () => {
    const ch = r < 0.35 ? '╳' : r < 0.7 ? '┼' : '╱';
    return { ch0: ch, ch1: ch, color: shadeColor('#f59e0b', -0.05), bg: hexToRgba('#f59e0b', 0.06), glow: r > 0.92 };
  };

  const blueprintStyle = () => {
    const ch = r < 0.6 ? '░' : '▒';
    return { ch0: ch, ch1: ch, color: shadeColor('#38bdf8', -0.18), bg: hexToRgba('#38bdf8', 0.05) };
  };

  switch (tile.kind) {
    case 'water': {
      const waves = frame === 0 ? '≈' : frame === 1 ? '≋' : '~';
      return { ch0: waves, ch1: waves, color: shadeColor('#60a5fa', -0.12 + 0.12 * r), glow: r > 0.92 };
    }
    case 'shore': {
      const ch = r < 0.6 ? '░' : '▒';
      return { ch0: ch, ch1: ch, color: shadeColor('#eab308', -0.35), bg: hexToRgba('#0b1220', 0.08) };
    }
    case 'tree': {
      const top = r < 0.45 ? '♣' : r < 0.75 ? '♠' : '▲';
      return { ch0: top, ch1: top, color: shadeColor('#16a34a', -0.25 - 0.15 * r), glow: r > 0.96 };
    }
    case 'path': {
      const ch = r < 0.5 ? '·' : r < 0.82 ? ':' : '░';
      const base = shadeColor('#a16207', -0.15);
      const h = applyHeat(base);
      return { ch0: ch, ch1: ch, color: h.color, bg: h.bg, glow: h.glow };
    }
    case 'plaza': {
      const ch = r < 0.5 ? '▒' : '▓';
      const base = shadeColor('#94a3b8', -0.05);
      const h = applyHeat(base);
      return { ch0: ch, ch1: ch, color: h.color, bg: h.bg, glow: h.glow };
    }
    case 'tilled': {
      const ch = r < 0.45 ? ':' : r < 0.8 ? '·' : '░';
      return { ch0: ch, ch1: ch, color: shadeColor('#92400e', -0.05 - 0.10 * r) };
    }
    case 'crop': {
      const ch = r < 0.5 ? 'v' : r < 0.75 ? 'ψ' : '┬';
      return { ch0: ch, ch1: ch, color: shadeColor('#22c55e', -0.10 - 0.12 * r), glow: r > 0.95 };
    }
    case 'fence': {
      const ch = r < 0.5 ? '┼' : '┬';
      return { ch0: ch, ch1: ch, color: shadeColor('#cbd5e1', -0.35) };
    }
    case 'sign': {
      if (status !== 'EMPTY') {
        const ch = r < 0.5 ? '·' : r < 0.82 ? ':' : '░';
        const base = shadeColor('#a16207', -0.15);
        const h = applyHeat(base);
        return { ch0: ch, ch1: ch, color: h.color, bg: h.bg, glow: h.glow };
      }
      return { ch0: '☐', ch1: '☐', color: shadeColor('#e2e8f0', -0.10), bg: hexToRgba('#020617', 0.18) };
    }
    case 'b_roof': {
      if (status === 'EMPTY') return grassStyle();
      if (status === 'UNDER_CONSTRUCTION') return scaffoldStyle();
      if (status === 'CLAIMED') return blueprintStyle();
      const roof = r < 0.5 ? '▔' : '▔';
      const z = tile.zone ? (ZONE_STYLE[tile.zone]?.color || '#94a3b8') : '#94a3b8';
      return { ch0: roof, ch1: roof, color: shadeColor(z, -0.05), bg: hexToRgba('#020617', 0.10) };
    }
    case 'b_wall': {
      if (status === 'EMPTY') return grassStyle();
      if (status === 'UNDER_CONSTRUCTION') return scaffoldStyle();
      if (status === 'CLAIMED') return blueprintStyle();
      const z = tile.zone ? (ZONE_STYLE[tile.zone]?.color || '#94a3b8') : '#94a3b8';
      const ch = r < 0.5 ? '█' : '▓';
      return { ch0: ch, ch1: ch, color: shadeColor(z, -0.15), bg: hexToRgba('#020617', 0.12) };
    }
    case 'b_window': {
      if (status === 'EMPTY') return grassStyle();
      if (status === 'UNDER_CONSTRUCTION') return scaffoldStyle();
      if (status === 'CLAIMED') return blueprintStyle();
      return { ch0: '□', ch1: '□', color: shadeColor('#60a5fa', 0.10), bg: hexToRgba('#020617', 0.20), glow: true };
    }
    case 'b_door': {
      if (status === 'EMPTY') return grassStyle();
      if (status === 'UNDER_CONSTRUCTION') return scaffoldStyle();
      if (status === 'CLAIMED') return blueprintStyle();
      return { ch0: '▕', ch1: '▏', color: shadeColor('#a16207', -0.10), bg: hexToRgba('#020617', 0.20) };
    }
    case 'b_emblem': {
      if (status === 'EMPTY') return grassStyle();
      if (status === 'UNDER_CONSTRUCTION') return scaffoldStyle();
      if (status === 'CLAIMED') return blueprintStyle();
      const ch = tile.zone ? (ZONE_GLYPH[tile.zone] || '◆') : '◆';
      const z = tile.zone ? (ZONE_STYLE[tile.zone]?.color || '#94a3b8') : '#94a3b8';
      return { ch0: ch, ch1: ch, color: shadeColor(z, 0.10), bg: hexToRgba('#020617', 0.20), glow: true };
    }
    case 'grass':
    default: {
      return grassStyle();
    }
  }
}

function districtName(zone: string, seed: string): string {
  const tables: Record<string, { a: string[]; b: string[] }> = {
    RESIDENTIAL: {
      a: ['Willow', 'Cedar', 'Sunset', 'Brook', 'Rose', 'Stone'],
      b: ['Ward', 'Heights', 'Hollow', 'Gardens', 'Terrace', 'Row'],
    },
    COMMERCIAL: {
      a: ['Market', 'Harbor', 'Gild', 'Arcade', 'Trade', 'Ledger'],
      b: ['Quarter', 'Row', 'Plaza', 'Exchange', 'Bazaar', 'Mall'],
    },
    CIVIC: {
      a: ['Crown', 'Union', 'Charter', 'Tribune', 'Sage', 'Forum'],
      b: ['Square', 'Hall', 'Commons', 'Court', 'Steps', 'Forum'],
    },
    INDUSTRIAL: {
      a: ['Foundry', 'Iron', 'Steam', 'Cinder', 'Rivet', 'Anvil'],
      b: ['Belt', 'Yard', 'Works', 'Line', 'Stacks', 'Works'],
    },
    ENTERTAINMENT: {
      a: ['Neon', 'Star', 'Echo', 'Velvet', 'Pulse', 'Luna'],
      b: ['Mile', 'Strip', 'Stage', 'Square', 'Boulevard', 'Arcade'],
    },
  };
  const t = tables[zone] || { a: ['Outer'], b: ['Frontier'] };
  const rng = mulberry32(hashString(`${seed}:${zone}`));
  const pick = (arr: string[]) => arr[Math.floor(rng() * arr.length)] || arr[0];
  return `${pick(t.a)} ${pick(t.b)}`;
}

function droidSprite(archetype: string, glyph: string, frame: number): string {
  const eyesByType: Record<string, string> = {
    SHARK: '▸ ◂',
    ROCK: '• •',
    CHAMELEON: '◉ ◎',
    DEGEN: '✦ ✦',
    GRINDER: '▪ ▪',
  };
  const eyes = eyesByType[archetype] || '• •';
  const torso = frame % 2 === 0 ? `╱${glyph}╲` : `╲${glyph}╱`;
  const feet = frame % 2 === 0 ? '╰┬─┬╯' : '╰┴─┴╯';
  return `╭${eyes}╮\n│${torso}│\n${feet}`;
}

function valleyDroidSprite(archetype: string, glyph: string, frame: number, moving: boolean): string {
  const eyesByType: Record<string, string> = {
    SHARK: '▸ ◂',
    ROCK: '• •',
    CHAMELEON: '◉ ◎',
    DEGEN: '✦ ✦',
    GRINDER: '▪ ▪',
  };
  const eyes = eyesByType[archetype] || '• •';
  const arms = moving ? (frame % 2 === 0 ? `╱${glyph}╲` : `╲${glyph}╱`) : ` ${glyph} `;
  const legs = moving ? (frame % 2 === 0 ? '╰┬─┬╯' : '╰┴─┴╯') : '╰┬─┬╯';
  return `╭───╮\n│${eyes}│\n│${arms}│\n${legs}`;
}

function findNearestRoad(rect: PlotRect, roadSet: Set<string>) {
  const cx = rect.x + Math.floor(rect.w / 2);
  const top = { x: cx, y: rect.y - 1 };
  if (roadSet.has(`${top.x},${top.y}`)) return top;
  const bottom = { x: cx, y: rect.y + rect.h };
  if (roadSet.has(`${bottom.x},${bottom.y}`)) return bottom;
  const left = { x: rect.x - 1, y: rect.y + Math.floor(rect.h / 2) };
  if (roadSet.has(`${left.x},${left.y}`)) return left;
  const right = { x: rect.x + rect.w, y: rect.y + Math.floor(rect.h / 2) };
  if (roadSet.has(`${right.x},${right.y}`)) return right;
  return { x: cx, y: rect.y - 1 };
}

function stepAlongRoad(pos: AgentPos, roadSet: Set<string>): AgentPos {
  const dirs: Array<{ dir: AgentPos['dir']; dx: number; dy: number }> = [
    { dir: 'n', dx: 0, dy: -1 },
    { dir: 's', dx: 0, dy: 1 },
    { dir: 'e', dx: 1, dy: 0 },
    { dir: 'w', dx: -1, dy: 0 },
  ];
  const options = dirs.filter((d) => roadSet.has(`${pos.x + d.dx},${pos.y + d.dy}`));
  if (options.length === 0) return pos;
  const sameDir = options.find((d) => d.dir === pos.dir);
  if (sameDir && Math.random() < 0.7) {
    return { x: pos.x + sameDir.dx, y: pos.y + sameDir.dy, dir: sameDir.dir };
  }
  const opposite = (dir: AgentPos['dir']) =>
    (dir === 'n' ? 's' : dir === 's' ? 'n' : dir === 'e' ? 'w' : 'e');
  const filtered = options.filter((d) => d.dir !== opposite(pos.dir));
  const pick = (filtered.length > 0 ? filtered : options)[Math.floor(Math.random() * (filtered.length > 0 ? filtered.length : options.length))];
  return { x: pos.x + pick.dx, y: pos.y + pick.dy, dir: pick.dir };
}
