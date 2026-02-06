import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@shared/components/layout/layout";
import Arena from "./pages/Arena";
import AiTownTerminal from "./pages/AiTownTerminal";
import MatchPage from "./pages/Match";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/terminal" element={<AiTownTerminal />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Arena />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/match/:matchId" element={<MatchPage />} />
            {/* Redirect legacy routes */}
            <Route path="/tournaments" element={<Navigate to="/" replace />} />
            <Route path="/bots" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/play/*" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
