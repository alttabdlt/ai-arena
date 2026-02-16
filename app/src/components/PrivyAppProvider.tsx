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
  id: 143,
  name: 'Monad',
  network: 'monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-mainnet.drpc.org'] },
    public: { http: ['https://monad-mainnet.drpc.org'] },
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
        loginMethods: ['wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
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
