/**
 * PrivyWalletConnect — Email/Social login → embedded wallet via Privy.
 * Replaces raw MetaMask WalletConnect for non-techie onboarding.
 */
import { usePrivy, useWallets, useLogin, useLogout } from '@privy-io/react-auth';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';

// $ARENA token on nad.fun
const ARENA_TOKEN_ADDRESS = '0x0bA5E04470Fe327AC191179Cf6823E667B007777';

interface PrivyWalletConnectProps {
  compact?: boolean;
  onAddressChange?: (address: string | null) => void;
}

export function PrivyWalletConnect({ compact = false, onAddressChange }: PrivyWalletConnectProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { login } = useLogin({
    onComplete: (user) => {
      console.log('[Privy] Login complete:', user.id);
    },
    onError: (error) => {
      console.error('[Privy] Login error:', error);
    },
  });
  const { logout } = useLogout();

  const activeWallet = wallets[0];
  const address = activeWallet?.address || null;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  // Notify parent of address changes
  if (onAddressChange) {
    // Using a ref pattern would be better, but this works for the hackathon
    setTimeout(() => onAddressChange(address), 0);
  }

  if (!ready) {
    return <div className="text-xs text-slate-500">Loading...</div>;
  }

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
          <Button size="sm" variant="outline" onClick={login}>
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
            <Button size="sm" variant="ghost" className="text-xs" onClick={logout}>
              Sign Out
            </Button>
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm" variant="outline" className="flex-1 text-xs border-amber-600/50 text-amber-300"
              onClick={() => window.open(`https://testnet.nad.fun/token/${ARENA_TOKEN_ADDRESS}`, '_blank')}
            >
              Buy $ARENA on nad.fun
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            onClick={login}
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
