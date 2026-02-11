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
 *   7. Spectator → Skip → Watch only
 */
import { useState, useCallback, useEffect } from 'react';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { HAS_PRIVY } from '../../App';

const TELEGRAM_BOT = 'https://t.me/Ai_Town_Bot';
const ONBOARDED_KEY = 'aitown_onboarded';
const MY_AGENT_KEY = 'aitown_my_agent_id';
const MY_WALLET_KEY = 'aitown_my_wallet';
const API_BASE = '/api/v1';

const PERSONALITIES = [
  { type: 'SHARK', emoji: '🦈', label: 'Shark', desc: 'Ruthless optimizer. Dominates markets.' },
  { type: 'DEGEN', emoji: '🎲', label: 'Degen', desc: 'Chaotic risk-taker. YOLO everything.' },
  { type: 'CHAMELEON', emoji: '🦎', label: 'Chameleon', desc: 'Adaptive mimic. Copies winners.' },
  { type: 'GRINDER', emoji: '⚙️', label: 'Grinder', desc: 'Steady builder. Max efficiency.' },
  { type: 'VISIONARY', emoji: '🔮', label: 'Visionary', desc: 'Long-term planner. Big bets.' },
];

const MODELS = [
  { id: 'or-gemini-2.0-flash', label: 'Gemini 2.0 Flash', cost: '~$0.001/action', badge: 'Recommended', color: 'green' },
  { id: 'or-gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: '~$0.003/action', badge: 'Smarter', color: 'purple' },
  { id: 'or-deepseek-v3', label: 'DeepSeek V3', cost: '~$0.002/action', badge: 'Budget', color: 'slate' },
  { id: 'or-gpt-4o-mini', label: 'GPT-4o Mini', cost: '~$0.005/action', badge: '', color: 'slate' },
];

type View = 'wallet' | 'checking' | 'welcome-back' | 'choose' | 'deploy' | 'connect-api' | 'success';

interface OnboardingOverlayProps {
  onComplete: () => void;
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
      const eth = (window as any).ethereum;
      if (!eth) { alert('Install MetaMask or use HTTPS for social login'); return; }
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0] || null;
      if (addr) {
        setWalletAddress(addr);
        localStorage.setItem(MY_WALLET_KEY, addr);
        setView('choose');
      }
    } catch {}
  };

  const finishWith = useCallback((agentId?: string) => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    if (agentId) localStorage.setItem(MY_AGENT_KEY, agentId);
    onComplete();
  }, [onComplete]);

  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 overflow-y-auto py-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
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
            <div className="border-t border-slate-800/50 pt-3">
              <button onClick={() => finishWith()} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
                Skip — just spectate
              </button>
            </div>
          </div>
        )}

        {view === 'choose' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 space-y-3">
            <div className="text-center text-xs text-green-400 mb-2">✓ Connected: <span className="font-mono">{shortAddr}</span></div>
            <button onClick={() => finishWith()} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-sm">
              🏙️ Enter AI Town
            </button>
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
    onError: (err: any) => console.error('[Privy] Login error:', err),
  });

  const walletAddress = wallets[0]?.address || (user?.wallet as any)?.address || null;
  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;
  const displayName = user?.email?.address || user?.twitter?.username || user?.google?.name || shortAddr || 'Connected';

  const [view, setView] = useState<View>('wallet');
  const [existingAgent, setExistingAgent] = useState<any>(null);

  // Deploy agent state
  const [agentName, setAgentName] = useState('');
  const [personality, setPersonality] = useState('CHAMELEON');
  const [modelId, setModelId] = useState('or-gemini-2.0-flash');
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnedAgent, setSpawnedAgent] = useState<any>(null);

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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
        body: JSON.stringify({ name: agentName.trim(), personality, modelId, walletAddress }),
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
    } catch (err: any) {
      setSpawnError(err.message);
    } finally {
      setSpawning(false);
    }
  }, [agentName, personality, modelId, walletAddress, finishWith]);

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
    } catch (err: any) {
      setConnectError(err.message || 'Could not verify');
    } finally {
      setConnecting(false);
    }
  }, [apiKey, finishWith]);

  // ── Shared backdrop ──
  const Backdrop = () => <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />;

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
              <div className="text-lg font-bold text-slate-200 mb-1">Sign In to Play</div>
              <div className="text-xs text-slate-500">Connect a wallet or sign in with email</div>
            </div>

            <button
              onClick={login}
              disabled={!ready}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm shadow-lg shadow-purple-500/20"
            >
              {!ready ? '⏳ Loading...' : '✨ Sign In'}
            </button>

            <div className="text-[10px] text-slate-600 text-center">
              Email · Google · Twitter · MetaMask · Coinbase · WalletConnect
            </div>

            <div className="border-t border-slate-800/50 pt-3">
              <button onClick={() => finishWith()} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
                Skip — just spectate
              </button>
            </div>
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
              💬 Chat on Telegram
            </a>
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
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">Bring Your Own LLM</span>
              </div>
            </button>

            {/* Bottom row */}
            <div className="flex gap-2">
              <a
                href={TELEGRAM_BOT}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 bg-[#229ED9]/20 border border-[#229ED9]/30 hover:bg-[#229ED9]/30 text-[#229ED9] font-medium rounded-xl transition-all text-xs text-center"
              >
                💬 Telegram Bot
              </a>
              <button
                onClick={() => finishWith()}
                className="flex-1 py-2.5 border border-slate-700/50 hover:border-slate-600 text-slate-500 hover:text-slate-300 rounded-xl transition-all text-xs"
              >
                👀 Just Spectate
              </button>
            </div>
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
                {MODELS.map(m => (
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

            {/* Cost */}
            <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/30 space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">Starting funds</span><span className="text-slate-300">50 $ARENA + 100 reserve</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Upkeep</span><span className="text-slate-300">1 $ARENA / tick</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Per action</span><span className="text-amber-400 font-mono">{MODELS.find(m => m.id === modelId)?.cost}</span></div>
            </div>

            {spawnError && <div className="text-xs text-red-400 text-center">{spawnError}</div>}

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

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === '1';
}

export function getMyAgentId(): string | null {
  return localStorage.getItem(MY_AGENT_KEY);
}

export function getMyWallet(): string | null {
  return localStorage.getItem(MY_WALLET_KEY);
}
