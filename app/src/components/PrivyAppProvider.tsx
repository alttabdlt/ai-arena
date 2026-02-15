import { PrivyProvider } from "@privy-io/react-auth";
import { type ReactNode } from "react";

type ChainConfig = {
  id: number;
  name: string;
  network: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: {
    default: { http: string[] };
    public: { http: string[] };
  };
};

const MONAD_CHAIN = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
    public: { http: ['https://testnet-rpc.monad.xyz'] },
  },
} as ChainConfig;

interface PrivyAppProviderProps {
  appId: string;
  children: ReactNode;
}

export default function PrivyAppProvider({ appId, children }: PrivyAppProviderProps) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#F59E0B',
          logo: undefined,
        },
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: MONAD_CHAIN,
        supportedChains: [MONAD_CHAIN],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
