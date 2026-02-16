/**
 * PrivyWalletConnect — Wallet-only login via Privy.
 * Gracefully degrades when Privy is not configured (no app ID).
 */
import { usePrivy, useWallets, useLogin, useLogout } from '@privy-io/react-auth';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Component, useEffect, type ReactNode } from 'react';
import { HAS_PRIVY } from '../config/privy';

const ARENA_TOKEN_ADDRESS = '0xC9795A42b7f31D2c1a0B67E7E1b8ea6729957777';
type EthereumProvider = { request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown> };

export interface WalletSessionState {
  ready: boolean;
  authenticated: boolean;
  provider: 'privy' | 'wallet_fallback';
}

interface PrivyWalletConnectProps {
  compact?: boolean;
  onAddressChange?: (address: string | null) => void;
  onSessionChange?: (session: WalletSessionState) => void;
}

/** Error boundary: catches Privy hook failures when no provider exists */
class PrivyErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { /* swallow */ }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function PrivyInner({ compact = false, onAddressChange, onSessionChange }: PrivyWalletConnectProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { login } = useLogin({
    onComplete: (params) => console.log('[Privy] Login complete:', params.user.id),
    onError: (err: unknown) => console.error('[Privy] Login error:', err),
  });
  const { logout } = useLogout();

  const activeWallet = wallets[0];
  const userWalletAddress =
    user?.wallet && typeof user.wallet === 'object' && 'address' in user.wallet
      ? String((user.wallet as { address?: string }).address ?? '')
      : '';
  // Use wallet from useWallets first, fall back to user.wallet for external wallets (Coinbase etc.)
  const address = activeWallet?.address || userWalletAddress || null;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  // Notify parent of address changes via useEffect (not in render)
  useEffect(() => {
    if (onAddressChange) onAddressChange(address);
  }, [address, onAddressChange]);
  useEffect(() => {
    onSessionChange?.({
      ready: Boolean(ready),
      authenticated: Boolean(authenticated && address),
      provider: 'privy',
    });
  }, [authenticated, address, onSessionChange, ready]);

  if (!ready) return <div className="text-xs text-slate-500">Loading...</div>;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {authenticated && address ? (
          <>
            <Badge variant="outline" className="border-green-600/50 text-green-400 text-[10px]">
              🟢 Connected
            </Badge>
            <Button size="sm" variant="ghost" className="text-xs font-mono" onClick={logout}>
              {shortAddress}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={login} data-privy-connect>
            Connect Wallet
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {authenticated && address ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Connected
            </span>
            <Badge variant="outline" className="border-green-600/50 text-green-400">
              🟢 Monad
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-200">{shortAddress}</span>
            <Button size="sm" variant="ghost" className="text-xs" onClick={logout}>Sign Out</Button>
          </div>
          <Button 
            size="sm" variant="outline" className="w-full text-xs border-amber-600/50 text-amber-300"
            onClick={() => window.open(`https://nad.fun/tokens/${ARENA_TOKEN_ADDRESS}`, '_blank')}
          >
            Buy $ARENA on nad.fun
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            onClick={login}
            data-privy-connect
          >
            Connect Wallet
          </Button>
          <div className="text-[10px] text-slate-500 text-center">
            MetaMask · Coinbase · WalletConnect
          </div>
        </div>
      )}
    </div>
  );
}

function FallbackConnect({ compact, onAddressChange, onSessionChange }: PrivyWalletConnectProps) {
  useEffect(() => {
    onSessionChange?.({
      ready: true,
      authenticated: false,
      provider: 'wallet_fallback',
    });
  }, [onSessionChange]);

  const connect = async () => {
    try {
      const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
      if (!eth) { alert('Install MetaMask or set VITE_PRIVY_APP_ID for social login'); return; }
      const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[] | undefined;
      const addr = accounts?.[0] || null;
      if (addr && onAddressChange) onAddressChange(addr);
      onSessionChange?.({
        ready: true,
        authenticated: Boolean(addr),
        provider: 'wallet_fallback',
      });
    } catch {
      // ignore cancelled wallet prompts
    }
  };

  if (compact) {
    return <Button size="sm" variant="outline" onClick={connect}>🔗 Wallet</Button>;
  }
  return <Button className="w-full" variant="outline" onClick={connect}>🔗 Connect Wallet</Button>;
}

export function PrivyWalletConnect(props: PrivyWalletConnectProps) {
  if (!HAS_PRIVY) return <FallbackConnect {...props} />;
  return (
    <PrivyErrorBoundary fallback={<FallbackConnect {...props} />}>
      <PrivyInner {...props} />
    </PrivyErrorBoundary>
  );
}
