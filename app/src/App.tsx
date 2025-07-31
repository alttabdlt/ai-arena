import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/layout";
// import { Web3Provider } from "@/config/web3";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "@/lib/apollo-client";
import { WalletProvider } from "@/config/wallet";
import { AuthProvider } from "@/contexts/AuthContext";
import "@/utils/build-info"; // Log build info on startup
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { debugLogger, setApolloClient } from "@/services/debugLogger";
import { useEffect } from "react";
import { useInteractionLogger } from "@/hooks/useInteractionLogger";
import { LoggingIndicator } from "@/components/LoggingIndicator";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Bots from "./pages/Bots";
import BotDetail from "./pages/BotDetail";
import Tournaments from "./pages/Tournaments";
import CreateTournament from "./pages/CreateTournament";
import WaitingRoom from "./pages/WaitingRoom";
import TournamentView from "./pages/TournamentView";
import PokerView from "./pages/PokerView";
import ReverseHangmanView from "./pages/ReverseHangmanView";
import ReverseHangmanServerView from "./pages/ReverseHangmanServerView";
import Connect4View from "./pages/Connect4View";
import Settings from "./pages/Settings";
import DeveloperSubmit from "./pages/DeveloperSubmit";
import Deploy from "./pages/Deploy";
import Learn from "./pages/Learn";
import Legal from "./pages/Legal";
import DeveloperDocs from "./pages/DeveloperDocs";
import Queue from "./pages/Queue";
import NotFound from "./pages/NotFound";

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/create" element={<CreateTournament />} />
            <Route path="/tournaments/:id/waiting" element={<WaitingRoom />} />
            <Route path="/tournament/:id" element={<TournamentView />} />
            <Route path="/tournament/:id/poker" element={<PokerView />} />
            <Route path="/tournament/:id/hangman" element={<ReverseHangmanView />} />
            <Route path="/tournament/:id/hangman-server" element={<ReverseHangmanServerView />} />
            <Route path="/tournament/:id/connect4" element={<Connect4View />} />
            
            {/* Bot System */}
            <Route path="/bots" element={<Bots />} />
            <Route path="/bot/:id" element={<BotDetail />} />
            <Route path="/deploy" element={<Deploy />} />
            
            {/* Platform Features */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/docs" element={<DeveloperDocs />} />
            <Route path="/legal" element={<Legal />} />
            
            {/* Redirects from old pages */}
            <Route path="/analytics" element={<Navigate to="/dashboard?tab=performance" replace />} />
            <Route path="/social" element={<Navigate to="/dashboard?tab=community" replace />} />
            
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
