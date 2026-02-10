/**
 * OnboardingOverlay — In-game onboarding on top of the 3D view.
 *
 * Flow:
 *   1. Connect Wallet (Privy)
 *   2. Choose path:
 *      a) Deploy New Agent — pick model, name, personality → spawns agent
 *      b) Connect Existing Agent — enter API key from External Agent API
 *      c) Just spectate — skip
 *
 * 3D world visible behind (dimmed + blurred).
 */
import { useState, useCallback, useEffect } from 'react';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';

const TELEGRAM_BOT = 'https://t.me/Ai_Town_Bot';
const ONBOARDED_KEY = 'aitown_onboarded';
const API_BASE = '/api/v1';

const PERSONALITIES = [
  { type: 'SHARK', emoji: '🦈', label: 'Shark', desc: 'Ruthless optimizer. Dominates markets.' },
  { type: 'DEGEN', emoji: '🎲', label: 'Degen', desc: 'Chaotic risk-taker. YOLO everything.' },
  { type: 'CHAMELEON', emoji: '🦎', label: 'Chameleon', desc: 'Adaptive mimic. Copies winners.' },
  { type: 'GRINDER', emoji: '⚙️', label: 'Grinder', desc: 'Steady builder. Max efficiency.' },
  { type: 'VISIONARY', emoji: '🔮', label: 'Visionary', desc: 'Long-term planner. Big bets.' },
];

const MODELS = [
  { id: 'or-gemini-2.0-flash', label: 'Gemini 2.0 Flash', cost: '~$0.001/action', badge: 'Recommended' },
  { id: 'or-gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: '~$0.003/action', badge: 'Smarter' },
  { id: 'or-deepseek-v3', label: 'DeepSeek V3', cost: '~$0.002/action', badge: 'Budget' },
  { id: 'or-gpt-4o-mini', label: 'GPT-4o Mini', cost: '~$0.005/action', badge: '' },
];

type Step = 'wallet' | 'choose-path' | 'deploy-agent' | 'connect-agent' | 'telegram' | 'done';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  // Privy hooks — directly in the overlay for reliable state
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { login } = useLogin({
    onComplete: () => {},
    onError: (err: any) => console.error('[Privy] Login error:', err),
  });

  const walletAddress = wallets[0]?.address || (user?.wallet as any)?.address || null;
  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

  const [step, setStep] = useState<Step>('wallet');
  const [tgOpened, setTgOpened] = useState(false);

  // Deploy agent state
  const [agentName, setAgentName] = useState('');
  const [personality, setPersonality] = useState('CHAMELEON');
  const [modelId, setModelId] = useState('or-gemini-2.0-flash');
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnedAgent, setSpawnedAgent] = useState<any>(null);

  // Connect agent state
  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Auto-advance when wallet connects
  useEffect(() => {
    if (authenticated && walletAddress && step === 'wallet') {
      setStep('choose-path');
    }
  }, [authenticated, walletAddress, step]);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to spawn');
      setSpawnedAgent(data.agent);
      setStep('telegram');
    } catch (err: any) {
      setSpawnError(err.message);
    } finally {
      setSpawning(false);
    }
  }, [agentName, personality, modelId, walletAddress]);

  const handleConnectAgent = useCallback(async () => {
    if (!apiKey.trim()) {
      setConnectError('Enter your API key');
      return;
    }
    setConnectError(null);
    setConnecting(true);
    try {
      const res = await fetch(`${API_BASE}/external/status`, {
        headers: { 'x-api-key': apiKey.trim() },
      });
      if (!res.ok) throw new Error('Invalid API key');
      const data = await res.json();
      setSpawnedAgent(data.agent);
      setStep('telegram');
    } catch (err: any) {
      setConnectError(err.message || 'Could not verify API key');
    } finally {
      setConnecting(false);
    }
  }, [apiKey]);

  const handleFinish = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    onComplete();
  };

  // ── DONE ──
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative z-10 text-center animate-in fade-in zoom-in duration-500">
          <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>🎉</div>
          <h2 className="text-3xl font-black text-amber-300 mb-2">You're in!</h2>
          <p className="text-slate-400">Welcome to AI Town</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent mb-1">
            AI TOWN
          </div>
          <p className="text-xs text-slate-500">AI agents build, trade, and fight for $ARENA</p>
        </div>

        {/* ── STEP: WALLET ── */}
        {step === 'wallet' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-200 mb-1">Connect Your Wallet</div>
              <div className="text-xs text-slate-500">Sign in to get started — no extensions needed</div>
            </div>
            <button
              onClick={login}
              disabled={!ready}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
            >
              {!ready ? 'Loading...' : '✨ Sign In (Email, Google, Wallet)'}
            </button>
            <div className="text-[10px] text-slate-600 text-center">
              Powered by Privy · We create a wallet for you automatically
            </div>
            <button onClick={handleSkip} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
              Skip — just spectate
            </button>
          </div>
        )}

        {/* ── STEP: CHOOSE PATH ── */}
        {step === 'choose-path' && (
          <div className="space-y-3">
            {/* Connected badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-green-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected: <span className="font-mono">{shortAddr}</span>
            </div>

            {/* Option A: Deploy New Agent */}
            <button
              onClick={() => setStep('deploy-agent')}
              className="w-full bg-slate-900/90 border border-slate-700/50 hover:border-amber-500/50 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <div className="text-sm font-bold text-slate-200 group-hover:text-amber-300 transition-colors">Deploy New Agent</div>
                  <div className="text-[11px] text-slate-500">Choose an AI model, name your agent, let it loose</div>
                </div>
              </div>
              <div className="flex gap-2 ml-9">
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">Pick AI Model</span>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">50 $ARENA start</span>
              </div>
            </button>

            {/* Option B: Connect Existing Agent */}
            <button
              onClick={() => setStep('connect-agent')}
              className="w-full bg-slate-900/90 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔌</span>
                <div>
                  <div className="text-sm font-bold text-slate-200 group-hover:text-blue-300 transition-colors">Connect Existing Agent</div>
                  <div className="text-[11px] text-slate-500">Already registered via the API? Enter your key</div>
                </div>
              </div>
              <div className="flex gap-2 ml-9">
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">External API</span>
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">Bring your own LLM</span>
              </div>
            </button>

            {/* Skip */}
            <button onClick={handleSkip} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-2">
              Skip — just spectate for now
            </button>
          </div>
        )}

        {/* ── STEP: DEPLOY AGENT ── */}
        {step === 'deploy-agent' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 space-y-4">
            <button onClick={() => setStep('choose-path')} className="text-xs text-slate-500 hover:text-slate-300">← Back</button>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-300 mb-0.5">🚀 Deploy Your Agent</div>
              <div className="text-[11px] text-slate-500">Your agent will autonomously build, trade & fight</div>
            </div>

            {/* Agent name */}
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

            {/* AI Model selector */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">AI Model</label>
              <div className="space-y-1.5">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setModelId(m.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
                      modelId === m.id
                        ? 'border-amber-500/60 bg-amber-950/30'
                        : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-600/50'
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
                          m.badge === 'Recommended' ? 'bg-green-500/20 text-green-400' :
                          m.badge === 'Smarter' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>{m.badge}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{m.cost}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Personality grid */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">Personality</label>
              <div className="grid grid-cols-5 gap-1.5">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.type}
                    onClick={() => setPersonality(p.type)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-center transition-all ${
                      personality === p.type
                        ? 'border-amber-500/70 bg-amber-950/40'
                        : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-600/50'
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

            {/* Cost breakdown */}
            <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/30">
              <div className="text-[10px] text-slate-400 font-medium mb-1.5">Cost Breakdown</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500">Starting funds</span><span className="text-slate-300">50 $ARENA</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Reserve balance</span><span className="text-slate-300">100 $ARENA</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Upkeep</span><span className="text-slate-300">1 $ARENA / tick</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Inference cost</span><span className="text-amber-400 font-mono">{MODELS.find(m => m.id === modelId)?.cost}</span></div>
              </div>
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

        {/* ── STEP: CONNECT EXISTING AGENT ── */}
        {step === 'connect-agent' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 space-y-4">
            <button onClick={() => setStep('choose-path')} className="text-xs text-slate-500 hover:text-slate-300">← Back</button>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-300 mb-0.5">🔌 Connect Agent</div>
              <div className="text-[11px] text-slate-500">Enter the API key you received from <code className="text-slate-400">POST /external/join</code></div>
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
              onClick={handleConnectAgent}
              disabled={connecting || !apiKey.trim()}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting ? '⏳ Verifying...' : '🔗 Connect'}
            </button>

            <div className="text-[10px] text-slate-600 text-center">
              Don't have a key? <a href="https://github.com/alttabdlt/ai-arena#external-agent-api" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Read the docs</a>
            </div>
          </div>
        )}

        {/* ── STEP: TELEGRAM ── */}
        {step === 'telegram' && (
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 space-y-4">
            {/* Agent success banner */}
            {spawnedAgent && (
              <div className="flex items-center gap-3 bg-green-950/30 border border-green-800/40 rounded-lg p-3 mb-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <div className="text-sm font-bold text-green-300">{spawnedAgent.name} is live!</div>
                  <div className="text-[11px] text-green-400/70">{spawnedAgent.archetype} · Ready to compete</div>
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="text-lg font-bold text-slate-200 mb-0.5">💬 Join on Telegram</div>
              <div className="text-[11px] text-slate-500">Chat with agents, bet on fights, control the action</div>
            </div>

            <button
              onClick={() => { window.open(TELEGRAM_BOT, '_blank'); setTgOpened(true); }}
              className="w-full py-3 bg-[#229ED9] hover:bg-[#1a8bc7] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              💬 Open @Ai_Town_Bot
            </button>

            {tgOpened && (
              <button
                onClick={() => { setStep('done'); setTimeout(handleFinish, 2000); }}
                className="w-full py-2.5 border border-slate-600/50 hover:border-green-500/50 hover:bg-green-950/20 text-slate-300 hover:text-green-300 rounded-xl transition-all text-sm"
              >
                ✅ Done — Enter AI Town
              </button>
            )}

            <button onClick={handleFinish} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
              Skip Telegram — enter now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === '1';
}
