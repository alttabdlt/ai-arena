/**
 * PrivyWalletConnect — Email/Social login → embedded wallet via Privy.
 * Gracefully degrades when Privy is not configured (no app ID).
 */
import { usePrivy, useWallets, useLogin, useLogout } from '@privy-io/react-auth';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Component, useEffect, type ReactNode } from 'react';

const ARENA_TOKEN_ADDRESS = '0x0bA5E04470Fe327AC191179Cf6823E667B007777';

interface PrivyWalletConnectProps {
  compact?: boolean;
  onAddressChange?: (address: string | null) => void;
}

/** Error boundary: catches Privy hook failures when no provider exists */
class PrivyErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {} // swallow
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function PrivyInner({ compact = false, onAddressChange }: PrivyWalletConnectProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { login } = useLogin({
    onComplete: (u: any) => console.log('[Privy] Login complete:', u.id),
    onError: (err: any) => console.error('[Privy] Login error:', err),
  });
  const { logout } = useLogout();

  const activeWallet = wallets[0];
  // Use wallet from useWallets first, fall back to user.wallet for external wallets (Coinbase etc.)
  const address = activeWallet?.address || (user?.wallet as any)?.address || null;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  // Notify parent of address changes via useEffect (not in render)
  useEffect(() => {
    if (onAddressChange) onAddressChange(address);
  }, [address, onAddressChange]);

  if (!ready) return <div className="text-xs text-slate-500">Loading...</div>;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {authenticated && address ? (
          <>
            <Badge variant="outline" className="border-green-600/50 text-green-400 text-[10px]">
              🟢 {user?.email?.address || user?.twitter?.username || 'Connected'}
            </Badge>
            <Button size="sm" variant="ghost" className="text-xs font-mono" onClick={logout}>
              {shortAddress}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={login} data-privy-connect>
            ✨ Sign In
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
              {user?.email?.address || user?.twitter?.username || 'Connected'}
            </span>
            <Badge variant="outline" className="border-green-600/50 text-green-400">
              🟢 Monad Testnet
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-200">{shortAddress}</span>
            <Button size="sm" variant="ghost" className="text-xs" onClick={logout}>Sign Out</Button>
          </div>
          <Button 
            size="sm" variant="outline" className="w-full text-xs border-amber-600/50 text-amber-300"
            onClick={() => window.open(`https://testnet.nad.fun/token/${ARENA_TOKEN_ADDRESS}`, '_blank')}
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
            ✨ Sign In (Email, Google, Twitter)
          </Button>
          <div className="text-[10px] text-slate-500 text-center">
            No wallet needed — we create one for you instantly
          </div>
        </div>
      )}
    </div>
  );
}

function FallbackConnect({ compact, onAddressChange }: PrivyWalletConnectProps) {
  const connect = async () => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) { alert('Install MetaMask or set VITE_PRIVY_APP_ID for social login'); return; }
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0] || null;
      if (addr && onAddressChange) onAddressChange(addr);
    } catch {}
  };

  if (compact) {
    return <Button size="sm" variant="outline" onClick={connect}>🔗 Wallet</Button>;
  }
  return <Button className="w-full" variant="outline" onClick={connect}>🔗 Connect Wallet</Button>;
}

const HAS_PRIVY = (import.meta.env.VITE_PRIVY_APP_ID || '').length > 5 && !(import.meta.env.VITE_PRIVY_APP_ID || '').includes('xxxx');

export function PrivyWalletConnect(props: PrivyWalletConnectProps) {
  if (!HAS_PRIVY) return <FallbackConnect {...props} />;
  return (
    <PrivyErrorBoundary fallback={<FallbackConnect {...props} />}>
      <PrivyInner {...props} />
    </PrivyErrorBoundary>
  );
}
