import { useNavigationLogger } from '@shared/hooks/useNavigationLogger';
import { Outlet } from 'react-router-dom';
import { Footer } from './footer';
import { Header } from './header';

export function Layout() {
  // Log navigation changes
  useNavigationLogger();
  
  return (
    <div className="min-h-screen bg-background flex flex-col bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),rgba(0,0,0,0)_60%)]">
      <Header />
      <main className="flex-1 px-2 sm:px-4">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
