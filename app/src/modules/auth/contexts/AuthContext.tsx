import * as React from 'react'; // Updated for Solana auth fix
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMutation } from '@apollo/client';
import { REQUEST_NONCE, CONNECT_WALLET, REFRESH_TOKEN, LOGOUT } from '@/graphql/mutations/auth';
import { useToast } from '@shared/hooks/use-toast';
import { apolloClient } from '@/lib/apollo-client';
import bs58 from 'bs58';

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
  
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  
  const [requestNonce] = useMutation(REQUEST_NONCE);
  const [connectWallet] = useMutation(CONNECT_WALLET);
  const [refreshToken] = useMutation(REFRESH_TOKEN);
  const [logoutMutation] = useMutation(LOGOUT);

  const handleLogout = useCallback(async () => {
    try {
      const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshTokenValue) {
        await logoutMutation({
          variables: { refreshToken: refreshTokenValue }
        });
      }
    } catch (error) {
      console.error('Logout mutation failed:', error);
    }
    
    // Clear local storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Clear Apollo cache
    await apolloClient.clearStore();
    
    // Reset state
    setUser(null);
    setIsAuthReady(false);
    
    // Disconnect wallet
    if (connected) {
      await disconnect();
    }
  }, [connected, disconnect, logoutMutation]);

  // Load stored auth data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthReady(true);
        
        // Validate token is still valid by checking address
        if (publicKey && parsedUser.address !== publicKey.toString()) {
          // Address mismatch, clear auth
          handleLogout();
        }
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    
    setIsLoading(false);
  }, [publicKey, handleLogout]);

  const login = useCallback(async () => {
    // Prevent rapid login attempts
    const now = Date.now();
    if (now - lastLoginAttempt < 3000) {
      return;
    }
    setLastLoginAttempt(now);
    
    if (!connected || !publicKey || !signMessage) {
      toast({
        title: 'No wallet connected',
        description: 'Please connect your Solana wallet first',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoggingIn(true);
    
    try {
      const address = publicKey.toString();
      
      // 1. Request nonce from server
      const { data: nonceData } = await requestNonce({
        variables: { address }
      });
      
      if (!nonceData?.requestNonce) {
        throw new Error('Failed to get nonce from server');
      }
      
      const nonce = nonceData.requestNonce.nonce;
      const message = `Welcome to AI Arena!\n\nClick to sign in and accept the Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nNonce: ${nonce}`;
      
      // 2. Sign message with Solana wallet
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);
      
      // 3. Send signature to server with input wrapper
      console.log('Sending auth request with:', { address, nonce, signature: signatureBase58 });
      const { data: authData } = await connectWallet({
        variables: {
          input: {
            address,
            signature: signatureBase58,
            nonce,
          }
        }
      });
      
      if (!authData?.connectWallet) {
        throw new Error('Authentication failed');
      }
      
      const { accessToken, refreshToken: refreshTokenValue, user: authUser } = authData.connectWallet;
      
      // Store auth data with original case-sensitive address
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenValue);
      
      // Store user with both lowercase (from server) and original address
      const userWithOriginalAddress = {
        ...authUser,
        originalAddress: address // Preserve the original case-sensitive address
      };
      localStorage.setItem(USER_KEY, JSON.stringify(userWithOriginalAddress));
      
      setUser(authUser);
      setIsAuthReady(true);
      
      toast({
        title: 'Connected successfully',
        description: `Welcome ${authUser.username || authUser.address.slice(0, 6)}...${authUser.address.slice(-4)}`,
      });
      
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to authenticate with wallet',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, [connected, publicKey, signMessage, requestNonce, connectWallet, toast, lastLoginAttempt]);

  const refreshAuth = useCallback(async () => {
    const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshTokenValue) {
      return;
    }
    
    try {
      const { data } = await refreshToken({
        variables: { refreshToken: refreshTokenValue }
      });
      
      if (!data?.refreshToken) {
        throw new Error('Failed to refresh token');
      }
      
      const { accessToken, refreshToken: newRefreshToken } = data.refreshToken;
      
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      
    } catch (error) {
      console.error('Token refresh failed:', error);
      await handleLogout();
    }
  }, [refreshToken, handleLogout]);

  // Auto-logout when wallet disconnects
  useEffect(() => {
    if (!connected && user) {
      handleLogout();
    }
  }, [connected, user, handleLogout]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isLoggingIn,
    isAuthReady,
    login,
    logout: handleLogout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
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
