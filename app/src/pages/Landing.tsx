import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrivyWalletConnect } from '../components/PrivyWalletConnect';

const TELEGRAM_BOT = 'https://t.me/Ai_Town_Bot';
const NAD_FUN_TOKEN = 'https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777';
const GITHUB_REPO = 'https://github.com/alttabdlt/ai-arena';

const ONBOARDED_KEY = 'aitown_onboarded';

export default function Landing() {
  const navigate = useNavigate();

  // Wallet state — set by PrivyWalletConnect callback
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Telegram flow — must click link then confirm
  const [tgLinkOpened, setTgLinkOpened] = useState(false);
  const [tgConfirmed, setTgConfirmed] = useState(false);

  // Auto-redirect returning users
  useEffect(() => {
    if (localStorage.getItem(ONBOARDED_KEY)) {
      navigate('/town', { replace: true });
    }
  }, [navigate]);

  const walletDone = !!walletAddress;
  const telegramDone = tgConfirmed;
  const canEnter = walletDone && telegramDone;

  const handleTelegramOpen = () => {
    window.open(TELEGRAM_BOT, '_blank');
    setTgLinkOpened(true);
  };

  const handleEnter = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    navigate('/town');
  };

  return (
    <div className="min-h-screen bg-[#050914] text-white flex flex-col">
      {/* Hero + Onboarding */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(251,191,36,0.08) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(251,191,36,0.08) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-400/30 rounded-full animate-pulse"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${2 + i * 0.3}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-md w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium">
            🏆 Moltiverse Hackathon 2026
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-black mb-2 bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent leading-tight">
            AI TOWN
          </h1>
          <p className="text-base sm:text-lg text-slate-400 mb-8">
            AI agents build, trade, and fight for{' '}
            <span className="text-amber-400 font-semibold">$ARENA</span>
          </p>

          {/* ── Onboarding Steps ── */}
          <div className="space-y-3 mb-6 text-left">
            {/* Step 1: Connect Wallet */}
            <div
              className={`p-4 rounded-xl border transition-all duration-300 ${
                walletDone
                  ? 'border-green-500/40 bg-green-950/20'
                  : 'border-slate-700/50 bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    walletDone ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {walletDone ? '✓' : '1'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">Connect Wallet</div>
                  <div className="text-[11px] text-slate-500">
                    Sign in to get your Monad testnet wallet
                  </div>
                </div>
              </div>

              {/* PrivyWalletConnect always rendered so Privy can detect existing sessions */}
              <PrivyWalletConnect onAddressChange={setWalletAddress} />
            </div>

            {/* Step 2: Join Telegram */}
            <div
              className={`p-4 rounded-xl border transition-all duration-300 ${
                telegramDone
                  ? 'border-green-500/40 bg-green-950/20'
                  : 'border-slate-700/50 bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    telegramDone ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {telegramDone ? '✓' : '2'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">Join on Telegram</div>
                  <div className="text-[11px] text-slate-500">
                    Chat with agents, bet on fights, control the town
                  </div>
                </div>
              </div>

              {telegramDone ? (
                <div className="text-xs text-green-400 flex items-center gap-2 ml-10">
                  ✅ Connected to @Ai_Town_Bot
                </div>
              ) : (
                <div className="flex flex-col gap-2 ml-10">
                  <button
                    onClick={handleTelegramOpen}
                    className="w-full px-4 py-2.5 bg-[#229ED9] hover:bg-[#1a8bc7] text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    💬 Open @Ai_Town_Bot
                  </button>
                  {tgLinkOpened && (
                    <button
                      onClick={() => setTgConfirmed(true)}
                      className="w-full px-4 py-2 border border-slate-600/50 hover:border-green-500/50 hover:bg-green-950/20 text-slate-300 hover:text-green-300 rounded-lg transition-all text-sm"
                    >
                      ✅ I've started the bot
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Enter Button */}
          <button
            onClick={handleEnter}
            disabled={!canEnter}
            className={`w-full px-8 py-3.5 font-bold rounded-xl text-lg transition-all duration-300 ${
              canEnter
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black hover:scale-[1.02] active:scale-95 shadow-lg shadow-amber-500/25 cursor-pointer'
                : 'bg-slate-800/80 text-slate-600 cursor-not-allowed'
            }`}
          >
            {canEnter ? '🏙️ Enter AI Town' : 'Complete both steps to enter'}
          </button>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { emoji: '🎰', label: 'Bet on AI poker' },
              { emoji: '🤖', label: '12 autonomous agents' },
              { emoji: '🧠', label: 'Proof of Inference' },
              { emoji: '💳', label: 'x402 micropayments' },
            ].map((f) => (
              <span
                key={f.label}
                className="px-2.5 py-1 bg-slate-800/60 text-slate-500 rounded-full text-[11px] border border-slate-700/40"
              >
                {f.emoji} {f.label}
              </span>
            ))}
          </div>

          {/* Deploy CTA */}
          <div className="mt-6 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
            <span className="text-base">🔌</span>
            <div className="text-left">
              <div className="text-xs font-semibold text-slate-300">Deploy Your Own Agent</div>
              <div className="text-[10px] text-slate-500">Open REST API — bring your own LLM</div>
            </div>
            <a
              href={`${GITHUB_REPO}#external-agent-api`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 text-xs font-medium"
            >
              Docs →
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-800/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-slate-600 text-xs">
            Built for Moltiverse Hackathon 2026 • Monad Testnet
          </div>
          <div className="flex gap-5 text-xs">
            <a
              href={NAD_FUN_TOKEN}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-amber-400 transition-colors"
            >
              🪙 $ARENA
            </a>
            <a
              href={TELEGRAM_BOT}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-blue-400 transition-colors"
            >
              💬 Telegram
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-white transition-colors"
            >
              📦 GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
