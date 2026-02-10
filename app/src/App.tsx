import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import Landing from "./pages/Landing";
import Town3D from "./pages/Town3D";
import Arena from "./pages/Arena";

// Privy app ID — set via VITE_PRIVY_APP_ID env var or fallback to test ID
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'clxxxxxxxxxxxxxxxxxx';

const App = () => {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#F59E0B', // amber-500
          logo: undefined,
        },
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: {
          id: 10143,
          name: 'Monad Testnet',
          network: 'monad-testnet',
          nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://testnet-rpc.monad.xyz'] },
            public: { http: ['https://testnet-rpc.monad.xyz'] },
          },
        } as any,
        supportedChains: [{
          id: 10143,
          name: 'Monad Testnet',
          network: 'monad-testnet',
          nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://testnet-rpc.monad.xyz'] },
            public: { http: ['https://testnet-rpc.monad.xyz'] },
          },
        } as any],
      }}
    >
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
    </PrivyProvider>
  );
};

export default App;
