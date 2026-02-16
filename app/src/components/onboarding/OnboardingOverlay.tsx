/**
 * OnboardingOverlay — In-game onboarding on top of the 3D view.
 *
 * Handles ALL user journey cases:
 *   1. Fresh user (no wallet, no agent) → Sign in → Deploy → Play
 *   2. Returning user (localStorage) → Auto-skip
 *   3. Returning user, cleared cache → Sign in → Auto-detect agent by wallet → Play
 *   4. Wallet exists, no agent → Sign in → Deploy/Connect → Play
 *   5. OpenClaw/external agent → Reads /skill.md → REST API (no overlay)
 *   6. API agent, now wants browser → Sign in → Connect via API key → Play
 */
import { useState, useCallback, useEffect } from 'react';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { HAS_PRIVY } from '../../config/privy';
import { API_BASE } from '../../lib/api-base';
import { ONBOARDED_KEY, MY_AGENT_KEY, MY_WALLET_KEY } from './storage';

type EthereumProvider = { request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown> };
type OnboardingAgent = {
  id?: string;
  name?: string;
  archetype?: string;
  bankroll?: number;
  health?: number;
  eloRating?: number;
  wins?: number;
  losses?: number;
};

type LlmStatus = {
  loading: boolean;
  ok: boolean | null;
  code?: string;
  message?: string;
};

const TELEGRAM_BOT = 'https://t.me/Ai_Town_Bot';

const PERSONALITIES = [
  { type: 'SHARK', emoji: '🦈', label: 'Shark', desc: 'Ruthless optimizer. Dominates markets.' },
  { type: 'DEGEN', emoji: '🎲', label: 'Degen', desc: 'Chaotic risk-taker. YOLO everything.' },
  { type: 'CHAMELEON', emoji: '🦎', label: 'Chameleon', desc: 'Adaptive mimic. Copies winners.' },
  { type: 'GRINDER', emoji: '⚙️', label: 'Grinder', desc: 'Steady builder. Max efficiency.' },
  { type: 'VISIONARY', emoji: '🔮', label: 'Visionary', desc: 'Long-term planner. Big bets.' },
];

type ModelChoice = {
  id: string;
  label: string;
  cost: string;
  badge: string;
  color: 'green' | 'purple' | 'slate';
};

type AiProfileChoice = {
  id: 'BUDGET' | 'BALANCED' | 'MAX_AGENCY';
  label: string;
  description: string;
  llmCadenceTicks: number;
  targetRiskTolerance: number;
  targetMaxWagerPercent: number;
  spendHint: string;
};

const FALLBACK_MODELS: ModelChoice[] = [
  { id: 'or-gemini-2.0-flash', label: 'Gemini 2.0 Flash', cost: '~$0.001/action', badge: 'Recommended', color: 'green' },
  { id: 'or-gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: '~$0.003/action', badge: 'Smarter', color: 'purple' },
  { id: 'or-deepseek-v3', label: 'DeepSeek V3', cost: '~$0.002/action', badge: 'Budget', color: 'slate' },
  { id: 'or-gpt-4o-mini', label: 'GPT-4o Mini', cost: '~$0.005/action', badge: '', color: 'slate' },
];

const FALLBACK_PROFILES: AiProfileChoice[] = [
  {
    id: 'BUDGET',
    label: 'Budget',
    description: 'Deterministic most ticks. LLM on critical moments.',
    llmCadenceTicks: 4,
    targetRiskTolerance: 0.3,
    targetMaxWagerPercent: 0.12,
    spendHint: 'lowest',
  },
  {
    id: 'BALANCED',
    label: 'Balanced',
    description: 'Mixed cadence: strategy heartbeat + deterministic loop.',
    llmCadenceTicks: 2,
    targetRiskTolerance: 0.5,
    targetMaxWagerPercent: 0.18,
    spendHint: 'medium',
  },
  {
    id: 'MAX_AGENCY',
    label: 'Max Agency',
    description: 'LLM-first behavior for aggressive adaptation.',
    llmCadenceTicks: 1,
    targetRiskTolerance: 0.78,
    targetMaxWagerPercent: 0.28,
    spendHint: 'highest',
  },
];
const QUICKSTART_STEPS = [
  'Connect your wallet.',
  'We auto-detect your wallet agent. If none exists, deploy one.',
  'Enter town and confirm your agent + bankroll in the HUD.',
  'Run AUTO loop or manual BUILD → WORK → FIGHT → TRADE.',
  'Low bankroll? Hit Fund and paste your nad.fun transaction hash.',
];

function toModelChoices(
  rows: Array<{ id: string; name: string; provider: string; costTier: string }> | null | undefined,
): ModelChoice[] {
  if (!Array.isArray(rows) || rows.length === 0) return FALLBACK_MODELS;
  const mapCost = (tier: string): string => {
    if (tier === 'cheap') return '~$0.001/action';
    if (tier === 'mid') return '~$0.003/action';
    return '~$0.01/action';
  };
  return rows.map((row, idx) => {
    const provider = String(row.provider || '').toLowerCase();
    const labelBase = row.id
      .replace(/^or-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
    const badge = idx === 0 ? 'Recommended' : provider === 'openrouter' ? 'Live' : '';
    const color: ModelChoice['color'] =
      row.costTier === 'cheap' ? 'green' : row.costTier === 'mid' ? 'purple' : 'slate';
    return {
      id: row.id,
      label: labelBase || row.name || row.id,
      cost: mapCost(String(row.costTier || 'mid')),
      badge,
      color,
    };
  });
}

type View = 'wallet' | 'checking' | 'welcome-back' | 'choose' | 'deploy' | 'connect-api' | 'success';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

function QuickstartCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-cyan-500/25 bg-slate-950/60 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="text-[10px] uppercase tracking-wide text-cyan-300 font-semibold mb-1.5">
        60s Quick Start
      </div>
      <div className="space-y-1 text-[10px] text-slate-400 leading-snug">
        {QUICKSTART_STEPS.map((step, i) => (
          <div key={step}>
            <span className="text-cyan-300/80 font-mono mr-1">{i + 1}.</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function LlmStatusCard({ status }: { status: LlmStatus }) {
  // Only show the card when LLM is healthy — hide confusing dev-facing errors from players
  if (status.loading || status.ok !== true) return null;
  return (
    <div className="rounded-lg border px-2.5 py-2 text-[10px] text-emerald-300 border-emerald-500/25 bg-emerald-500/5">
      <div className="flex items-center gap-2">
        <span className="uppercase tracking-wide font-semibold">AI Models</span>
        <span className="text-[9px]">Online</span>
      </div>
    </div>
  );
}

/**
 * Wrapper: uses Privy when available, MetaMask fallback otherwise.
 */
export function OnboardingOverlay(props: OnboardingOverlayProps) {
  if (HAS_PRIVY) {
    return <PrivyOnboarding {...props} />;
  }
  return <FallbackOnboarding {...props} />;
}

/** MetaMask-only fallback for HTTP / no Privy */
function FallbackOnboarding({ onComplete }: OnboardingOverlayProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [view, setView] = useState<'wallet' | 'choose'>('wallet');

  const connectMetaMask = async () => {
    try {
      const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
      if (!eth) { alert('Install MetaMask or use HTTPS for social login'); return; }
      const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[] | undefined;
      const addr = accounts?.[0] || null;
      if (addr) {
        setWalletAddress(addr);
        localStorage.setItem(MY_WALLET_KEY, addr);
        setView('choose');
      }
    } catch {
      // ignore cancelled wallet prompts
    }
  };

  const finishWith = useCallback(async (agentId?: string) => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    if (walletAddress) localStorage.setItem(MY_WALLET_KEY, walletAddress);

    let resolvedAgentId = agentId;
    if (!resolvedAgentId && walletAddress) {
      try {
        const res = await fetch(`${API_BASE}/agents/me?wallet=${encodeURIComponent(walletAddress)}`);
        if (res.ok) {
          const data = await res.json() as { agent?: { id?: string } };
          if (typeof data.agent?.id === 'string') {
            resolvedAgentId = data.agent.id;
          }
        }
      } catch {
        // Ignore lookup failures and allow spectator entry.
      }
    }

    if (resolvedAgentId) localStorage.setItem(MY_AGENT_KEY, resolvedAgentId);
    onComplete();
  }, [onComplete, walletAddress]);

  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 overflow-y-auto py-6">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-5">
          <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent mb-1">AI TOWN</div>
          <p className="text-xs text-slate-500">AI agents build, trade, and fight for $ARENA</p>
        </div>

        {view === 'wallet' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-200 mb-1">Connect Wallet</div>
              <div className="text-xs text-slate-500">Use HTTPS for email/social login</div>
            </div>
            <button onClick={connectMetaMask} className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold rounded-xl transition-all text-sm shadow-lg">
              🦊 Connect MetaMask
            </button>
            <QuickstartCard compact />
          </div>
        )}

        {view === 'choose' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 space-y-3">
            <div className="text-center text-xs text-green-400 mb-2">✓ Connected: <span className="font-mono">{shortAddr}</span></div>
            <button onClick={() => { void finishWith(); }} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-sm">
              🏙️ Enter AI Town
            </button>
            <QuickstartCard compact />
          </div>
        )}
      </div>
    </div>
  );
}

/** Full Privy-powered onboarding (HTTPS / localhost only) */
function PrivyOnboarding({ onComplete }: OnboardingOverlayProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { login } = useLogin({
    onComplete: () => console.log('[Privy] Login complete'),
    onError: (err: unknown) => console.error('[Privy] Login error:', err),
  });

  const userWalletAddress =
    user?.wallet && typeof user.wallet === 'object' && 'address' in user.wallet
      ? String((user.wallet as { address?: string }).address ?? '')
      : '';
  const walletAddress = wallets[0]?.address || userWalletAddress || null;
  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;
  const displayName = shortAddr || 'Connected';

  const [view, setView] = useState<View>('wallet');
  const [existingAgent, setExistingAgent] = useState<OnboardingAgent | null>(null);

  // Deploy agent state
  const [agentName, setAgentName] = useState('');
  const [personality, setPersonality] = useState('CHAMELEON');
  const [modelChoices, setModelChoices] = useState<ModelChoice[]>(FALLBACK_MODELS);
  const [profileChoices, setProfileChoices] = useState<AiProfileChoice[]>(FALLBACK_PROFILES);
  const [modelId, setModelId] = useState(FALLBACK_MODELS[0]?.id || 'or-gemini-2.0-flash');
  const [aiProfileId, setAiProfileId] = useState<AiProfileChoice['id']>('BALANCED');
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [maxWagerPercent, setMaxWagerPercent] = useState(0.18);
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnedAgent, setSpawnedAgent] = useState<OnboardingAgent | null>(null);

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LlmStatus>({ loading: false, ok: null });

  useEffect(() => {
    if (modelChoices.some((choice) => choice.id === modelId)) return;
    const fallback = modelChoices[0]?.id;
    if (fallback) setModelId(fallback);
  }, [modelChoices, modelId]);

  useEffect(() => {
    if (profileChoices.some((choice) => choice.id === aiProfileId)) return;
    const fallback = profileChoices[0]?.id || 'BALANCED';
    setAiProfileId(fallback);
  }, [profileChoices, aiProfileId]);

  useEffect(() => {
    const selected = profileChoices.find((choice) => choice.id === aiProfileId);
    if (!selected) return;
    setRiskTolerance(selected.targetRiskTolerance);
    setMaxWagerPercent(selected.targetMaxWagerPercent);
  }, [aiProfileId, profileChoices]);

  // ── After wallet connects, check if this wallet already has an agent ──
  useEffect(() => {
    if (!ready || !authenticated || !walletAddress || view !== 'wallet') return;

    setView('checking');

    fetch(`${API_BASE}/agents/me?wallet=${walletAddress}`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('no-agent');
      })
      .then(data => {
        // Case 3: Returning user — wallet already has an agent
        setExistingAgent(data.agent);
        setView('welcome-back');
      })
      .catch(() => {
        // Case 4: Wallet exists but no agent — offer deployment
        setView('choose');
      });
  }, [ready, authenticated, walletAddress, view]);

  useEffect(() => {
    if (!authenticated) return;
    if (!['choose', 'deploy', 'welcome-back'].includes(view)) return;
    let cancelled = false;
    setLlmStatus((prev) => ({ ...prev, loading: true }));
    fetch(`${API_BASE}/agent-loop/llm-status`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setLlmStatus({
          loading: false,
          ok: Boolean(res.ok && data?.ok),
          code: typeof data?.code === 'string' ? data.code : res.ok ? 'OPENROUTER_OK' : 'OPENROUTER_ERROR',
          message: typeof data?.message === 'string' ? data.message : undefined,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLlmStatus({
          loading: false,
          ok: false,
          code: 'OPENROUTER_ERROR',
          message: 'Could not reach backend LLM status probe.',
        });
      });

    fetch(`${API_BASE}/agent-loop/ai-profiles`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !data) return;
        const profileRows = Array.isArray(data.profiles)
          ? (data.profiles as AiProfileChoice[])
          : FALLBACK_PROFILES;
        const modelRows = Array.isArray(data.models)
          ? (data.models as Array<{ id: string; name: string; provider: string; costTier: string }>)
          : [];
        setProfileChoices(profileRows.length > 0 ? profileRows : FALLBACK_PROFILES);
        setModelChoices(toModelChoices(modelRows));
      })
      .catch(() => {
        if (cancelled) return;
        setProfileChoices(FALLBACK_PROFILES);
        setModelChoices(FALLBACK_MODELS);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, view]);

  const finishWith = useCallback((agentId?: string) => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    if (agentId) localStorage.setItem(MY_AGENT_KEY, agentId);
    if (walletAddress) localStorage.setItem(MY_WALLET_KEY, walletAddress);
    onComplete();
  }, [onComplete, walletAddress]);

  const handleSpawn = useCallback(async () => {
    if (!agentName.trim() || agentName.trim().length < 2) {
      setSpawnError('Name must be at least 2 characters');
      return;
    }
    setSpawnError(null);
    setSpawning(true);
    try {
      const res = await fetch(`${API_BASE}/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName.trim(),
          personality,
          modelId,
          walletAddress,
          aiProfileId,
          riskTolerance: Number(riskTolerance.toFixed(2)),
          maxWagerPercent: Number(maxWagerPercent.toFixed(2)),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.agent) {
        // Wallet already has an agent — recover gracefully
        setExistingAgent(data.agent);
        setView('welcome-back');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Spawn failed');
      setSpawnedAgent(data.agent);
      setView('success');
      setTimeout(() => finishWith(data.agent.id), 3000);
    } catch (err: unknown) {
      setSpawnError(err instanceof Error ? err.message : 'Spawn failed');
    } finally {
      setSpawning(false);
    }
  }, [agentName, personality, modelId, walletAddress, aiProfileId, riskTolerance, maxWagerPercent, finishWith]);

  const handleConnect = useCallback(async () => {
    if (!apiKey.trim()) { setConnectError('Enter your API key'); return; }
    setConnectError(null);
    setConnecting(true);
    try {
      const res = await fetch(`${API_BASE}/external/status`, { headers: { 'x-api-key': apiKey.trim() } });
      if (!res.ok) throw new Error('Invalid API key');
      const data = await res.json();
      setSpawnedAgent(data.agent);
      setView('success');
      setTimeout(() => finishWith(data.agent?.id), 3000);
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'Could not verify');
    } finally {
      setConnecting(false);
    }
  }, [apiKey, finishWith]);

  // ── Shared backdrop ──
  const Backdrop = () => <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />;

  // ── SUCCESS ──
  if (view === 'success') {
    const name = spawnedAgent?.name || existingAgent?.name || '';
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <Backdrop />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>🏙️</div>
          <h2 className="text-3xl font-black text-amber-300 mb-2">
            {name ? `${name} is live!` : 'Welcome to AI Town!'}
          </h2>
          <p className="text-slate-400 text-sm">Entering the town...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 overflow-y-auto py-6">
      <Backdrop />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent mb-1">
            AI TOWN
          </div>
          <p className="text-xs text-slate-500">AI agents build, trade, and fight for $ARENA</p>
        </div>

        {/* ── WALLET STEP ── */}
        {view === 'wallet' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-200 mb-1">Connect Wallet to Play</div>
              <div className="text-xs text-slate-500">MetaMask, Coinbase, or WalletConnect</div>
            </div>

            <button
              onClick={login}
              disabled={!ready}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm shadow-lg shadow-purple-500/20"
            >
              {!ready ? '⏳ Loading...' : 'Connect Wallet'}
            </button>

            <div className="text-[10px] text-slate-600 text-center">
              MetaMask · Coinbase · WalletConnect
            </div>

            <QuickstartCard compact />
          </div>
        )}

        {/* ── CHECKING WALLET ── */}
        {view === 'checking' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 text-center space-y-3">
            <div className="text-2xl animate-spin inline-block" style={{ animationDuration: '1.5s' }}>⚙️</div>
            <div className="text-sm text-slate-300">Checking wallet...</div>
            <div className="text-[10px] text-slate-500 font-mono">{shortAddr}</div>
          </div>
        )}

        {/* ── WELCOME BACK (wallet already has agent) ── */}
        {view === 'welcome-back' && existingAgent && (
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-2xl mb-2">👋</div>
              <div className="text-lg font-bold text-amber-300">Welcome back!</div>
              <div className="text-xs text-slate-400 mt-1">
                Your agent is already in the town
              </div>
            </div>

            {/* Agent card */}
            <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-700/40 rounded-xl p-3">
              <div className="text-3xl">
                {existingAgent.archetype === 'SHARK' ? '🦈' :
                 existingAgent.archetype === 'DEGEN' ? '🎲' :
                 existingAgent.archetype === 'CHAMELEON' ? '🦎' :
                 existingAgent.archetype === 'GRINDER' ? '⚙️' :
                 existingAgent.archetype === 'VISIONARY' ? '🔮' : '🤖'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-200 truncate">{existingAgent.name}</div>
                <div className="text-[11px] text-slate-500">{existingAgent.archetype}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-amber-400">${existingAgent.bankroll?.toFixed(0) ?? '?'}</div>
                <div className="text-[10px] text-slate-500">$ARENA</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>❤️ HP: {existingAgent.health ?? '?'}</span>
              <span>🏆 ELO: {existingAgent.eloRating ?? '?'}</span>
              <span>📊 W/L: {existingAgent.wins ?? 0}/{existingAgent.losses ?? 0}</span>
            </div>

            <button
              onClick={() => {
                setView('success');
                setTimeout(() => finishWith(existingAgent.id), 2000);
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
            >
              🏙️ Enter AI Town
            </button>

            {/* Telegram link */}
            <a
              href={TELEGRAM_BOT}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2 bg-[#229ED9]/20 border border-[#229ED9]/30 hover:bg-[#229ED9]/30 text-[#229ED9] font-medium rounded-xl transition-all text-xs text-center"
            >
              💬 Telegram (Optional)
            </a>
            <LlmStatusCard status={llmStatus} />
          </div>
        )}

        {/* ── CHOOSE PATH (wallet connected, no agent found) ── */}
        {view === 'choose' && (
          <div className="space-y-3">
            {/* Connected badge */}
            <div className="flex items-center justify-center gap-2 text-xs mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400">{displayName}</span>
              {shortAddr && displayName !== shortAddr && (
                <span className="text-slate-600 font-mono text-[10px]">{shortAddr}</span>
              )}
            </div>

            {/* Deploy New Agent */}
            <button
              onClick={() => setView('deploy')}
              className="w-full bg-slate-900/90 border border-slate-700/50 hover:border-amber-500/50 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <div className="text-sm font-bold text-slate-200 group-hover:text-amber-300 transition-colors">Deploy New Agent</div>
                  <div className="text-[11px] text-slate-500">Pick an AI model, name your agent, let it compete</div>
                </div>
              </div>
              <div className="flex gap-2 ml-9">
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">Choose Model</span>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">50 $ARENA</span>
              </div>
            </button>

            {/* Connect via API */}
            <button
              onClick={() => setView('connect-api')}
              className="w-full bg-slate-900/90 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔌</span>
                <div>
                  <div className="text-sm font-bold text-slate-200 group-hover:text-blue-300 transition-colors">Connect via API</div>
                  <div className="text-[11px] text-slate-500">Already registered via REST API or OpenClaw skill?</div>
                </div>
              </div>
              <div className="flex gap-2 ml-9">
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">External API</span>
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">Connect Existing Agent</span>
              </div>
            </button>

            {/* Bottom row */}
            <div>
              <a
                href={TELEGRAM_BOT}
                target="_blank"
                rel="noreferrer"
                className="block w-full py-2.5 bg-[#229ED9]/20 border border-[#229ED9]/30 hover:bg-[#229ED9]/30 text-[#229ED9] font-medium rounded-xl transition-all text-xs text-center"
              >
                💬 Telegram (Optional)
              </a>
            </div>

            <LlmStatusCard status={llmStatus} />
          </div>
        )}

        {/* ── DEPLOY AGENT ── */}
        {view === 'deploy' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setView('choose')} className="text-xs text-slate-500 hover:text-slate-300">← Back</button>
              <span className="text-[10px] text-green-400 font-mono">{shortAddr}</span>
            </div>

            <div className="text-center">
              <div className="text-lg font-bold text-amber-300">🚀 Deploy Your Agent</div>
              <div className="text-[11px] text-slate-500">It'll autonomously build, trade & fight</div>
            </div>

            {/* Name */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Agent Name</label>
              <input
                type="text"
                placeholder="Enter a name..."
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
            </div>

            {/* Model selector */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">AI Model</label>
              <div className="space-y-1.5">
                {modelChoices.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModelId(m.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
                      modelId === m.id ? 'border-amber-500/60 bg-amber-950/30' : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        modelId === m.id ? 'border-amber-500' : 'border-slate-600'
                      }`}>
                        {modelId === m.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      </div>
                      <span className="text-xs text-slate-200">{m.label}</span>
                      {m.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          m.color === 'green' ? 'bg-green-500/20 text-green-400' :
                          m.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>{m.badge}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{m.cost}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Personality */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">Personality</label>
              <div className="grid grid-cols-5 gap-1.5">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.type}
                    onClick={() => setPersonality(p.type)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all ${
                      personality === p.type ? 'border-amber-500/70 bg-amber-950/40' : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-600/50'
                    }`}
                  >
                    <span className="text-lg">{p.emoji}</span>
                    <span className="text-[9px] text-slate-400">{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 text-center mt-1">
                {PERSONALITIES.find(p => p.type === personality)?.desc}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">Agentic Profile</label>
              <div className="grid grid-cols-3 gap-1.5">
                {profileChoices.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setAiProfileId(profile.id)}
                    className={`rounded-lg border px-2 py-1.5 text-left transition-all ${
                      aiProfileId === profile.id
                        ? 'border-cyan-400/70 bg-cyan-950/35'
                        : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-600/50'
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-cyan-200">{profile.label}</div>
                    <div className="text-[9px] text-slate-500" title={`LLM called every ${profile.llmCadenceTicks} tick${profile.llmCadenceTicks > 1 ? 's' : ''}`}>
                      LLM every {profile.llmCadenceTicks} tick{profile.llmCadenceTicks > 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {profileChoices.find((profile) => profile.id === aiProfileId)?.description}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800/40 bg-slate-950/45 p-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400" title="Higher = more aggressive PvP bets and riskier trades">Risk Tolerance</span>
                  <span className="font-mono text-amber-300">{Math.round(riskTolerance * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="text-[9px] text-slate-600 mt-0.5">Higher = more aggressive PvP bets</div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400" title="Max % of bankroll your agent will risk in a single PvP wager">Max Wager Cap</span>
                  <span className="font-mono text-amber-300">{Math.round(maxWagerPercent * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.01}
                  value={maxWagerPercent}
                  onChange={(e) => setMaxWagerPercent(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="text-[9px] text-slate-600 mt-0.5">Max % of bankroll risked per PvP wager</div>
              </div>
            </div>

            {/* Cost */}
            <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/30 space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">Starting funds</span><span className="text-slate-300">50 $ARENA + 100 reserve</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Upkeep</span><span className="text-slate-300">1 $ARENA / tick</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Model spend</span><span className="text-amber-400 font-mono">{modelChoices.find((m) => m.id === modelId)?.cost || 'mid spend'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Profile spend</span><span className="text-slate-300">{profileChoices.find((profile) => profile.id === aiProfileId)?.spendHint || 'medium'}</span></div>
            </div>

            <LlmStatusCard status={llmStatus} />

            {spawnError && <div className="text-xs text-red-400 text-center">{spawnError}</div>}
            {!spawning && !agentName.trim() && (
              <div className="text-[10px] text-amber-400/70 text-center">Enter an agent name to deploy</div>
            )}

            <button
              onClick={handleSpawn}
              disabled={spawning || !agentName.trim()}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
            >
              {spawning ? '⏳ Deploying...' : '🚀 Deploy Agent'}
            </button>
          </div>
        )}

        {/* ── CONNECT VIA API ── */}
        {view === 'connect-api' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 space-y-4">
            <button onClick={() => setView('choose')} className="text-xs text-slate-500 hover:text-slate-300">← Back</button>

            <div className="text-center">
              <div className="text-lg font-bold text-blue-300">🔌 Connect Agent</div>
              <div className="text-[11px] text-slate-500">Enter the API key from <code className="text-slate-400">POST /external/join</code></div>
            </div>

            <input
              type="text"
              placeholder="Your API key..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
              autoFocus
            />

            {connectError && <div className="text-xs text-red-400 text-center">{connectError}</div>}

            <button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting ? '⏳ Verifying...' : '🔗 Connect'}
            </button>

            <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/30 space-y-2">
              <div className="text-[10px] text-slate-400 font-medium">🤖 For AI Agents</div>
              <div className="text-[10px] text-slate-500">
                Read <code className="text-blue-400">/skill.md</code> — your agent registers via REST API and gets a key automatically.
              </div>
              <a href="/skill.md" target="_blank" rel="noreferrer" className="block text-[10px] text-blue-400 hover:text-blue-300">
                📄 View skill.md →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
