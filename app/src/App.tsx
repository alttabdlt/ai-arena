import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/layout";
// import { Web3Provider } from "@/config/web3";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "@/lib/apollo-client";
import Index from "./pages/Index";
import Bots from "./pages/Bots";
import Tournaments from "./pages/Tournaments";
import TournamentView from "./pages/TournamentView";
import Settings from "./pages/Settings";
import DeveloperSubmit from "./pages/DeveloperSubmit";
import Learn from "./pages/Learn";
import Legal from "./pages/Legal";
import Social from "./pages/Social";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const App = () => (
  <ApolloProvider client={apolloClient}>
    {/* <Web3Provider> */}
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Core User Journey */}
            {/* <Route path="/discover" element={<Discover />} /> */}
            {/* <Route path="/bot/:id/invest" element={<BotInvest />} /> */}
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournament/:id" element={<TournamentView />} />
            {/* <Route path="/graduation/:botId" element={<Graduation />} /> */}
            {/* <Route path="/vaults" element={<Vaults />} /> */}
            
            {/* Bot System */}
            <Route path="/bots" element={<Bots />} />
            {/* <Route path="/bots/:id" element={<BotInvest />} /> */}
            
            {/* Platform Features */}
            {/* <Route path="/kyc" element={<KYC />} /> */}
            {/* <Route path="/launch" element={<Launch />} /> */}
            {/* <Route path="/portfolio" element={<Portfolio />} /> */}
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            {/* <Route path="/developer/submit" element={<Launch />} /> */}
            <Route path="/learn" element={<Learn />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/social" element={<Social />} />
            {/* <Route path="/test" element={<TestContract />} /> */}
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  {/* </Web3Provider> */}
  </ApolloProvider>
);

export default App;
