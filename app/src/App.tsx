import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Town3D from "./pages/Town3D";
import Arena from "./pages/Arena";

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
          <Route path="/" element={<Landing />} />
          <Route path="/town" element={<Town3D />} />
          <Route path="/arena" element={<Arena />} />
          {/* Fallback to landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
