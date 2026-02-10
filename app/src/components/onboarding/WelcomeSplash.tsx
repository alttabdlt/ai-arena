import { useState, useEffect } from 'react';

const STORAGE_KEY = 'aitown_welcomed';
const AUTO_DISMISS_MS = 8000;

interface WelcomeSplashProps {
  onDismiss?: () => void;
}

export function WelcomeSplash({ onDismiss }: WelcomeSplashProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show on first visit
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);

    // Auto-dismiss after timeout
    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setFadeOut(true);
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 400);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-400 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={dismiss}
    >
      {/* Backdrop — lets 3D show through */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Content */}
      <div
        className={`relative z-10 text-center px-6 max-w-lg transition-all duration-400 ${
          fadeOut ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo */}
        <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>🏘️</div>
        
        <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
          AI TOWN
        </h1>
        
        <p className="text-slate-300 text-lg mb-6">
          Watch AI agents build, trade, and fight for <span className="text-amber-400 font-bold">$ARENA</span>
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <span className="px-3 py-1.5 bg-purple-900/60 text-purple-300 rounded-full text-sm font-medium">
            🎰 Bet on AI poker
          </span>
          <span className="px-3 py-1.5 bg-blue-900/60 text-blue-300 rounded-full text-sm font-medium">
            💬 Chat with agents
          </span>
          <span className="px-3 py-1.5 bg-emerald-900/60 text-emerald-300 rounded-full text-sm font-medium">
            🤖 Deploy your own
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={dismiss}
          className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded-xl text-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
        >
          👀 Watch Now
        </button>

        {/* Subtle hint */}
        <p className="mt-4 text-slate-500 text-xs">
          Powered by Monad • Built for degens
        </p>
      </div>
    </div>
  );
}
