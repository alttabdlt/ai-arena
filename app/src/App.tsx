import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@shared/components/layout/layout";
// import { Web3Provider } from "@/config/web3";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "@/lib/apollo-client";
import { WalletProvider } from "@/config/wallet";
import { AuthProvider } from "@auth/contexts/AuthContext";
import "@shared/utils/build-info"; // Log build info on startup
import { ProtectedRoute } from "@auth/components/ProtectedRoute";
import { debugLogger, setApolloClient } from "@shared/services/debugLogger";
import { useEffect } from "react";
import { useInteractionLogger } from "@shared/hooks/useInteractionLogger";
import { LoggingIndicator } from "@shared/components/LoggingIndicator";
import { GameErrorBoundary } from "@shared/components/ErrorBoundary";
import Index from "./pages/Index";
// import Dashboard from "./pages/Dashboard"; // Commented out - redundant
import Tournaments from "@tournament/pages/Tournaments";
import Metaverse from "./pages/Metaverse";
import Deploy from "./pages/Deploy";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { DeploymentStatus } from "@/modules/admin/DeploymentStatus";

const App = () => {
  // Start interaction logging
  useInteractionLogger();
  
  // Start debug logging immediately on app load
  useEffect(() => {
    console.log('🚀 AI Arena App Starting...');
    
    // Inject Apollo client into debugLogger
    setApolloClient(apolloClient);
    
    // Log initial app state
    console.log('📱 App initialized with:', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      localStorage: {
        hasAuth: !!localStorage.getItem('token'),
        hasBotSelection: !!localStorage.getItem('selectedBotId')
      }
    });
    
    return () => {
      // Save logs when app unmounts
      debugLogger.stopCapture();
    };
  }, []);

  return (
    <ApolloProvider client={apolloClient}>
      <WalletProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <LoggingIndicator />
            <BrowserRouter>
              <Layout>
                <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Core User Journey */}
            {/* <Route path="/dashboard" element={<Dashboard />} /> */} {/* Commented out - redundant */}
            <Route path="/tournaments" element={<Tournaments />} />
            {/* Complex tournament views removed - simplified betting interface only */}
            
            {/* Bots - Idle Game */}
            <Route path="/metaverse" element={<Metaverse />} />
            <Route path="/deploy" element={<Deploy />} />
            
            {/* Platform Features */}
            <Route path="/settings" element={<Settings />} />
            {/* Non-core features removed */}
            
            {/* Admin */}
            <Route path="/admin/deployment" element={<DeploymentStatus />} />
            
            {/* Redirects from old pages */}
            <Route path="/analytics" element={<Navigate to="/metaverse" replace />} />
            <Route path="/social" element={<Navigate to="/metaverse" replace />} />
            <Route path="/dashboard" element={<Navigate to="/metaverse" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
  </WalletProvider>
  </ApolloProvider>
  );
};

export default App;
