/**
 * OnboardingOverlay — In-game onboarding that sits on top of the 3D view.
 *
 * Steps:
 *   1. Connect Wallet (Privy — email/social/wallet)
 *   2. Join Telegram Bot
 *   3. Spawn Your Agent (name + personality)
 *
 * The 3D world is visible behind (dimmed + blurred).
 * Dismissed after completion; returning users skip via localStorage.
 */
import { useState, useCallback, useEffect } from 'react';
import { PrivyWalletConnect } from '../PrivyWalletConnect';

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

interface OnboardingOverlayProps {
  walletAddress: string | null;
  onComplete: () => void;
}

export function OnboardingOverlay({ walletAddress, onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState<1 | 2 | 3>(walletAddress ? 2 : 1);
  const [tgOpened, setTgOpened] = useState(false);

  // Spawn agent state
  const [agentName, setAgentName] = useState('');
  const [personality, setPersonality] = useState('CHAMELEON');
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnSuccess, setSpawnSuccess] = useState(false);

  // Auto-advance when wallet connects
  useEffect(() => {
    if (walletAddress && step === 1) setStep(2);
  }, [walletAddress, step]);

  const handleTelegramOpen = () => {
    window.open(TELEGRAM_BOT, '_blank');
    setTgOpened(true);
  };

  const handleTelegramConfirm = () => setStep(3);

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
          walletAddress: walletAddress || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to spawn');
      setSpawnSuccess(true);
      // Mark onboarded and dismiss after a short celebration
      localStorage.setItem(ONBOARDED_KEY, '1');
      setTimeout(() => onComplete(), 2000);
    } catch (err: any) {
      setSpawnError(err.message);
    } finally {
      setSpawning(false);
    }
  }, [agentName, personality, walletAddress, onComplete]);

  const handleSkipSpawn = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    onComplete();
  };

  // Spawn success screen
  if (spawnSuccess) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative z-10 text-center animate-in fade-in zoom-in duration-500">
          <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>🎉</div>
          <h2 className="text-3xl font-black text-amber-300 mb-2">{agentName} is alive!</h2>
          <p className="text-slate-400">Your agent is entering the town...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      {/* Backdrop — lets 3D show through */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent mb-1">
            AI TOWN
          </div>
          <p className="text-sm text-slate-400">
            Set up in 30 seconds
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {/* ── Step 1: Connect Wallet ── */}
          <div className={`p-4 rounded-xl border transition-all duration-300 ${
            step > 1
              ? 'border-green-500/40 bg-green-950/20'
              : step === 1
                ? 'border-amber-500/40 bg-slate-900/80 shadow-lg shadow-amber-500/10'
                : 'border-slate-800/30 bg-slate-950/50 opacity-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > 1 ? 'bg-green-500 text-black' : 'bg-amber-500 text-black'
              }`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-200">Connect Wallet</div>
                {step > 1 && walletAddress && (
                  <div className="text-[11px] text-green-400 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                )}
              </div>
            </div>
            {step === 1 && (
              <div className="mt-3 ml-10">
                <PrivyWalletConnect onAddressChange={() => {}} />
              </div>
            )}
          </div>

          {/* ── Step 2: Join Telegram ── */}
          <div className={`p-4 rounded-xl border transition-all duration-300 ${
            step > 2
              ? 'border-green-500/40 bg-green-950/20'
              : step === 2
                ? 'border-amber-500/40 bg-slate-900/80 shadow-lg shadow-amber-500/10'
                : 'border-slate-800/30 bg-slate-950/50 opacity-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > 2 ? 'bg-green-500 text-black' : step === 2 ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400'
              }`}>
                {step > 2 ? '✓' : '2'}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-200">Join on Telegram</div>
                <div className="text-[11px] text-slate-500">Chat with agents & bet on fights</div>
              </div>
            </div>
            {step === 2 && (
              <div className="mt-3 ml-10 space-y-2">
                <button
                  onClick={handleTelegramOpen}
                  className="w-full px-4 py-2.5 bg-[#229ED9] hover:bg-[#1a8bc7] text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                >
                  💬 Open @Ai_Town_Bot
                </button>
                {tgOpened && (
                  <button
                    onClick={handleTelegramConfirm}
                    className="w-full px-4 py-2 border border-slate-600/50 hover:border-green-500/50 hover:bg-green-950/20 text-slate-300 hover:text-green-300 rounded-lg transition-all text-sm"
                  >
                    ✅ I've started the bot
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Step 3: Spawn Agent ── */}
          <div className={`p-4 rounded-xl border transition-all duration-300 ${
            step === 3
              ? 'border-amber-500/40 bg-slate-900/80 shadow-lg shadow-amber-500/10'
              : 'border-slate-800/30 bg-slate-950/50 opacity-50'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3 ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400'
              }`}>
                3
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-200">Create Your Agent</div>
                <div className="text-[11px] text-slate-500">Name it, pick a personality, let it loose</div>
              </div>
            </div>
            {step === 3 && (
              <div className="ml-10 space-y-3">
                {/* Agent name */}
                <input
                  type="text"
                  placeholder="Agent name..."
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  maxLength={20}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />

                {/* Personality grid */}
                <div className="grid grid-cols-5 gap-1.5">
                  {PERSONALITIES.map(p => (
                    <button
                      key={p.type}
                      onClick={() => setPersonality(p.type)}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-center transition-all ${
                        personality === p.type
                          ? 'border-amber-500/70 bg-amber-950/40 shadow-sm shadow-amber-500/10'
                          : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-600/50'
                      }`}
                    >
                      <span className="text-lg">{p.emoji}</span>
                      <span className="text-[9px] text-slate-400">{p.label}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                  {PERSONALITIES.find(p => p.type === personality)?.desc}
                </div>

                {spawnError && <div className="text-xs text-red-400 text-center">{spawnError}</div>}

                {/* Spawn button */}
                <button
                  onClick={handleSpawn}
                  disabled={spawning || !agentName.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                >
                  {spawning ? '⏳ Spawning...' : '🚀 Spawn Agent'}
                </button>

                {/* Skip option */}
                <button
                  onClick={handleSkipSpawn}
                  className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
                >
                  Skip — just spectate for now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Check if user has completed onboarding */
export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === '1';
}
