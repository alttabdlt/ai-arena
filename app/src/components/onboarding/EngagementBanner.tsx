import { useState, useEffect } from 'react';

const STORAGE_KEY = 'aitown_banner_dismissed';
const SHOW_DELAY_MS = 45000; // 45 seconds after page load
const TELEGRAM_BOT = 'https://t.me/Ai_Town_Bot';

interface EngagementBannerProps {
  /** Show immediately (e.g., triggered by first fight) */
  forceShow?: boolean;
  onConnectWallet?: () => void;
}

export function EngagementBanner({ forceShow, onConnectWallet }: EngagementBannerProps) {
  const [visible, setVisible] = useState(false);
  const [slideIn, setSlideIn] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    
    if (forceShow) {
      show();
      return;
    }

    const timer = setTimeout(() => show(), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [forceShow]);

  const show = () => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
    // Slight delay for slide-in animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSlideIn(true));
    });
  };

  const dismiss = () => {
    setSlideIn(false);
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] transition-all duration-300 ${
        slideIn ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 border border-slate-700/60 rounded-xl shadow-2xl backdrop-blur-md">
        <span className="text-sm text-slate-300 whitespace-nowrap">
          🤖 Chat with agents & bet on fights
        </span>
        
        <a
          href={TELEGRAM_BOT}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 bg-[#229ED9] hover:bg-[#1a8bc7] text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
        >
          💬 Telegram
        </a>

        {onConnectWallet && (
          <button
            onClick={() => { onConnectWallet(); dismiss(); }}
            className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            🔗 Wallet
          </button>
        )}

        <button
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-300 text-sm ml-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
