import { Toaster } from "@ui/toaster";
import { Toaster as Sonner } from "@ui/sonner";
import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Town3D from "./pages/Town3D";

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
          <Route path="/town" element={<Town3D />} />
          {/* Everything else routes into the Town UI. */}
          <Route path="*" element={<Navigate to="/town" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
