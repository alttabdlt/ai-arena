import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './button';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { Shield, LogOut } from 'lucide-react';

export function WalletButton() {
  const { user, isAuthenticated, login, logout } = useAuth();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated');

        // Auto-login when wallet connects
        useEffect(() => {
          if (connected && !isAuthenticated) {
            login();
          }
        }, [connected, isAuthenticated]);

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} type="button">
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} type="button" variant="destructive">
                    Wrong network
                  </Button>
                );
              }

              return (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Auth Status */}
                  {isAuthenticated && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Authenticated</span>
                    </div>
                  )}

                  {/* Chain Switcher */}
                  <Button
                    onClick={openChainModal}
                    style={{ display: 'flex', alignItems: 'center' }}
                    type="button"
                    variant="outline"
                    size="sm"
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          overflow: 'hidden',
                          marginRight: 4,
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 16, height: 16 }}
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </Button>

                  {/* Account Button */}
                  <Button onClick={openAccountModal} type="button" variant="outline">
                    {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ''}
                  </Button>

                  {/* Logout Button */}
                  {isAuthenticated && (
                    <Button
                      onClick={logout}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}