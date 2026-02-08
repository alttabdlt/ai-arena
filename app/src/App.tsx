import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Town3D from "./pages/Town3D";
import TownPixel from "./pages/TownPixel";
import TownPixelRpg from "./pages/TownPixelRpg";
import TownPixelSimCity from "./pixel/TownPixelSimCity";
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
          <Route path="/town/pixel" element={<TownPixelSimCity />} />
          <Route path="/town/pixel-old" element={<TownPixelRpg />} />
          <Route path="/town/pixel-iso" element={<TownPixel />} />
          <Route path="/arena" element={<Arena />} />
          {/* Fallback to landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
