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
import Dashboard from "./pages/Dashboard";
import Bots from "@bot/pages/Bots";
import BotDetail from "@bot/pages/BotDetail";
import Tournaments from "@tournament/pages/Tournaments";
import CreateTournament from "@tournament/pages/CreateTournament";
import WaitingRoom from "@tournament/pages/WaitingRoom";
import TournamentView from "@tournament/pages/TournamentView";
import PokerView from "@game/poker/pages/PokerView";
import ReverseHangmanView from "@game/reverse-hangman/pages/ReverseHangmanView";
import ReverseHangmanServerView from "@game/reverse-hangman/pages/ReverseHangmanServerView";
import Connect4View from "@game/connect4/pages/Connect4View";
import Settings from "./pages/Settings";
import Deploy from "@bot/pages/Deploy";
import Learn from "./pages/Learn";
import Legal from "./pages/Legal";
import DeveloperDocs from "./pages/DeveloperDocs";
import Queue from "@queue/pages/Queue";
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
            <Route path="/tournament/:id" element={<GameErrorBoundary><TournamentView /></GameErrorBoundary>} />
            <Route path="/tournament/:id/poker" element={<GameErrorBoundary><PokerView /></GameErrorBoundary>} />
            <Route path="/tournament/:id/hangman" element={<GameErrorBoundary><ReverseHangmanView /></GameErrorBoundary>} />
            <Route path="/tournament/:id/hangman-server" element={<GameErrorBoundary><ReverseHangmanServerView /></GameErrorBoundary>} />
            <Route path="/tournament/:id/connect4" element={<GameErrorBoundary><Connect4View /></GameErrorBoundary>} />
            
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
