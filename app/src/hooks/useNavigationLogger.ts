import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function useNavigationLogger() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    console.log('🧭 Navigation:', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
      type: navigationType,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
      // Log any state passed with navigation
      state: location.state
    });
  }, [location, navigationType]);

  // Also log when user leaves the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('👋 Page unload:', {
        from: location.pathname,
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [location.pathname]);
}