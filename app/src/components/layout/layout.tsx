import { Header } from './header';
import { Footer } from './footer';
import { useNavigationLogger } from '@/hooks/useNavigationLogger';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // Log navigation changes
  useNavigationLogger();
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}