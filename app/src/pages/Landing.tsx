import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Landing page — redirects straight to /town.
 * Onboarding happens in-game as an overlay on the 3D view.
 */
export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/town', { replace: true });
  }, [navigate]);
  return null;
}
