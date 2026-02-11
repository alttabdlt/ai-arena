import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import Landing from "./pages/Landing";
import Town3D from "./pages/Town3D";
import Arena from "./pages/Arena";
import { type ReactNode } from "react";

// Privy app ID — set via VITE_PRIVY_APP_ID env var
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';
// Privy embedded wallets REQUIRE HTTPS (localhost gets a special exception)
const IS_SECURE = typeof window !== 'undefined' && (
  window.location.protocol === 'https:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);
const HAS_PRIVY = PRIVY_APP_ID.length > 5 && !PRIVY_APP_ID.includes('xxxx') && IS_SECURE;

/** Exported so other components can check if Privy is available */
export { HAS_PRIVY };

const MONAD_CHAIN = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
    public: { http: ['https://testnet-rpc.monad.xyz'] },
  },
} as any;

/** Wrap children in PrivyProvider only when a valid app ID is configured */
function MaybePrivy({ children }: { children: ReactNode }) {
  if (!HAS_PRIVY) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#F59E0B',
          logo: undefined,
        },
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: MONAD_CHAIN,
        supportedChains: [MONAD_CHAIN],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

const App = () => {
  return (
    <MaybePrivy>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/town" element={<Town3D />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </MaybePrivy>
  );
};

export default App;
