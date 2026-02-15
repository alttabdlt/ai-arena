import { TooltipProvider } from "@ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { HAS_PRIVY, PRIVY_APP_ID } from "./config/privy";

const Landing = lazy(() => import("./pages/Landing"));
const Town3D = lazy(() => import("./pages/Town3D"));
const Arena = lazy(() => import("./pages/Arena"));
const PrivyAppProvider = lazy(() => import("./components/PrivyAppProvider"));
const AppUiShell = lazy(() => import("./components/AppUiShell"));

function AppLoadingScreen({ label = "Loading AI Town..." }: { label?: string }) {
  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="flex items-center gap-2 text-slate-200">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="font-mono text-sm">{label}</span>
      </div>
    </div>
  );
}

/** Wrap children in PrivyProvider only when a valid app ID is configured */
function MaybePrivy({ children }: { children: ReactNode }) {
  if (!HAS_PRIVY) return <>{children}</>;
  return (
    <Suspense fallback={<AppLoadingScreen label="Preparing sign in..." />}>
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
          <Suspense fallback={<AppLoadingScreen />}>
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
