import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { HAS_PRIVY, PRIVY_APP_ID } from "./config/privy";

const Landing = lazy(() => import("./pages/Landing"));
const Town3D = lazy(() => import("./pages/Town3D"));
const Arena = lazy(() => import("./pages/Arena"));
const PrivyAppProvider = lazy(() => import("./components/PrivyAppProvider"));
const AppUiShell = lazy(() => import("./components/AppUiShell"));

/** Wrap children in PrivyProvider only when a valid app ID is configured */
function MaybePrivy({ children }: { children: ReactNode }) {
  if (!HAS_PRIVY) return <>{children}</>;
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PrivyAppProvider appId={PRIVY_APP_ID}>
        {children}
      </PrivyAppProvider>
    </Suspense>
  );
}

const App = () => {
  return (
    <MaybePrivy>
      <TooltipProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/town" element={<Town3D />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="*" element={<Landing />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Suspense fallback={null}>
          <AppUiShell />
        </Suspense>
      </TooltipProvider>
    </MaybePrivy>
  );
};

export default App;
