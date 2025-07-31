import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useMutation } from '@apollo/client';
import { REQUEST_NONCE, CONNECT_WALLET, REFRESH_TOKEN, LOGOUT } from '@/graphql/mutations/auth';
import { useToast } from '@/hooks/use-toast';
import { apolloClient } from '@/lib/apollo-client';

interface User {
  id: string;
  address: string;
  username?: string;
  role: string;
  kycTier: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingIn: boolean;
  isAuthReady: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'ai-arena-access-token';
const REFRESH_TOKEN_KEY = 'ai-arena-refresh-token';
const USER_KEY = 'ai-arena-user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [lastLoginAttempt, setLastLoginAttempt] = useState<number>(0);
  
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();
  
  const [requestNonce] = useMutation(REQUEST_NONCE);
  const [connectWallet] = useMutation(CONNECT_WALLET);
  const [refreshToken] = useMutation(REFRESH_TOKEN);
  const [logoutMutation] = useMutation(LOGOUT);

  // Load stored auth data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthReady(true);
        
        // Auth headers are automatically set by authLink in apollo-client.ts
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = useCallback(async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    if (!walletClient) {
      toast({
        title: 'Wallet client not available',
        description: 'Please try reconnecting your wallet',
        variant: 'destructive',
      });
      return;
    }

    // Prevent concurrent login attempts
    if (isLoggingIn) {
      console.log('Login already in progress, skipping...');
      return;
    }

    // Debounce: prevent rapid successive login attempts
    const now = Date.now();
    if (now - lastLoginAttempt < 2000) { // 2 second minimum between attempts
      console.log('Login attempt too soon after previous attempt, skipping...');
      return;
    }

    setIsLoggingIn(true);
    setLastLoginAttempt(now);

    try {
      // Request nonce
      console.log('Requesting nonce for address:', address);
      const { data: nonceData } = await requestNonce({
        variables: { address: address.toLowerCase() },
      });

      const { nonce, message } = nonceData.requestNonce;
      console.log('Received nonce:', nonce);

      // Sign message
      const signature = await walletClient.signMessage({
        account: address as `0x${string}`,
        message,
      });

      // Connect wallet
      console.log('Connecting wallet with:', { address: address.toLowerCase(), nonce, signature });
      const { data: authData } = await connectWallet({
        variables: {
          input: {
            address: address.toLowerCase(),
            signature,
            nonce,
          },
        },
      });

      const { user: authUser, accessToken, refreshToken: newRefreshToken } = authData.connectWallet;

      // Store auth data
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      
      setUser(authUser);

      // Refetch active queries without clearing auth context
      await apolloClient.refetchQueries({
        include: 'active',
      });
      
      // Increased delay to ensure auth headers are fully propagated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mark auth as ready
      setIsAuthReady(true);

      toast({
        title: 'Authentication successful',
        description: 'You are now logged in',
      });
      
      setIsLoggingIn(false);
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Authentication failed',
        description: error.message || 'Failed to authenticate',
        variant: 'destructive',
      });
      
      setIsLoggingIn(false);
    }
  }, [isConnected, address, walletClient, requestNonce, connectWallet, toast, isLoggingIn, lastLoginAttempt]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation();
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear stored data
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    setUser(null);
    setIsAuthReady(false);

    // Auth headers are automatically cleared by authLink when token is removed from localStorage

    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully',
    });
  }, [logoutMutation, toast]);

  const refreshAuth = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!storedRefreshToken) {
      return;
    }

    try {
      const { data } = await refreshToken({
        variables: { refreshToken: storedRefreshToken },
      });

      const { user: authUser, accessToken, refreshToken: newRefreshToken } = data.refreshToken;

      // Update stored data
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      
      setUser(authUser);

      // Auth headers are automatically set by authLink in apollo-client.ts
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout
      await logout();
    }
  }, [refreshToken, logout]);

  // Auto refresh token before expiry
  useEffect(() => {
    if (!user) return;

    // Refresh token 5 minutes before expiry (15min - 5min = 10min)
    const refreshInterval = setInterval(() => {
      refreshAuth();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, [user, refreshAuth]);

  // Auto logout when wallet disconnects
  useEffect(() => {
    if (!isConnected && user) {
      logout();
    }
  }, [isConnected, user, logout]);

  // Auto login when wallet connects
  useEffect(() => {
    if (isConnected && address && !user && !isLoggingIn && walletClient) {
      // Reduced delay for faster auto-login
      const loginTimer = setTimeout(() => {
        // Double-check conditions before login
        if (isConnected && !user && !isLoggingIn) {
          console.log('Auto-login triggered for address:', address);
          login();
        }
      }, 100); // Minimal delay to ensure wallet is ready
      
      return () => clearTimeout(loginTimer);
    }
  }, [isConnected, address, user, isLoggingIn, walletClient, login]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isLoggingIn,
        isAuthReady,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}