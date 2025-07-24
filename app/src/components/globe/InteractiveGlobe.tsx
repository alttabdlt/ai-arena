import React, { useRef, useEffect, useState } from 'react';
import Globe from 'react-globe.gl';
import { Tournament } from '@/types/tournament';

interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  name: string;
  type: 'tournament' | 'bot';
  id: string;
  intensity?: number;
}

interface GlobeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  dashLength?: number;
  dashGap?: number;
  dashAnimateTime?: number;
}

interface InteractiveGlobeProps {
  tournaments?: Tournament[];
  onLocationClick?: (lat: number, lng: number) => void;
  onZoomComplete?: () => void;
}

const InteractiveGlobe: React.FC<InteractiveGlobeProps> = ({ 
  tournaments = [], 
  onLocationClick,
  onZoomComplete 
}) => {
  const globeEl = useRef<any>(null); // Globe.gl doesn't export proper types
  const [points, setPoints] = useState<GlobePoint[]>([]);
  const [arcs, setArcs] = useState<GlobeArc[]>([]);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Generate random coordinates for demo purposes
  const generateRandomCoordinates = () => {
    const lat = (Math.random() - 0.5) * 180;
    const lng = (Math.random() - 0.5) * 360;
    return { lat, lng };
  };

  // Track window dimensions
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Initialize globe data
  useEffect(() => {
    // Create points for active tournaments
    const tournamentPoints: GlobePoint[] = tournaments
      .filter(t => t.status === 'in-progress')
      .map(tournament => {
        const coords = generateRandomCoordinates();
        return {
          ...coords,
          size: 1.2,
          color: '#ffffff',
          name: tournament.name,
          type: 'tournament' as const,
          id: tournament.id,
          intensity: Math.random()
        };
      });

    // Add some random bot creation points for visual effect
    const botPoints: GlobePoint[] = Array.from({ length: 10 }, (_, i) => {
      const coords = generateRandomCoordinates();
      return {
        ...coords,
        size: 0.8,
        color: '#ffffff',
        name: `Bot ${i + 1}`,
        type: 'bot' as const,
        id: `bot-${i}`,
        intensity: Math.random() * 0.5
      };
    });

    setPoints([...tournamentPoints, ...botPoints]);

    // Create arcs between some points for visual effect
    const connectionArcs: GlobeArc[] = [];
    for (let i = 0; i < Math.min(tournamentPoints.length - 1, 5); i++) {
      connectionArcs.push({
        startLat: tournamentPoints[i].lat,
        startLng: tournamentPoints[i].lng,
        endLat: tournamentPoints[i + 1].lat,
        endLng: tournamentPoints[i + 1].lng,
        color: '#ffaa00',
        dashLength: 0.5,
        dashGap: 0.2,
        dashAnimateTime: 2000
      });
    }
    setArcs(connectionArcs);
  }, [tournaments]);

  // Configure globe on mount
  useEffect(() => {
    if (globeEl.current && globeReady) {
      // Auto-rotate
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
      
      // Set initial camera position
      globeEl.current.pointOfView({
        lat: 0,
        lng: 0,
        altitude: 2.5
      });
    }
  }, [globeReady]);

  const handlePointClick = (point: GlobePoint) => {
    if (onLocationClick) {
      // Zoom to the clicked point
      globeEl.current.pointOfView({
        lat: point.lat,
        lng: point.lng,
        altitude: 0.5
      }, 2000);

      // Call callback after zoom animation
      setTimeout(() => {
        onLocationClick(point.lat, point.lng);
        if (onZoomComplete) {
          onZoomComplete();
        }
      }, 2000);
    }
  };

  const handleGlobeReady = () => {
    setGlobeReady(true);
  };

  return (
    <div className="fixed inset-0 bg-black">
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        hexPolygonsData={points}
        hexPolygonAltitude={0.01}
        hexPolygonResolution={3}
        hexPolygonMargin={0.3}
        hexPolygonColor={(d) => d.type === 'tournament' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)'}
        hexPolygonLabel={d => `
          <div class="text-white bg-black/80 px-2 py-1 rounded">
            <div class="font-bold">${d.name}</div>
            <div class="text-xs">${d.type === 'tournament' ? 'Live Tournament' : 'Bot Created'}</div>
          </div>
        `}
        onHexPolygonClick={handlePointClick}
        arcsData={arcs}
        arcColor={d => d.color}
        arcDashLength={d => d.dashLength || 0.5}
        arcDashGap={d => d.dashGap || 0.2}
        arcDashAnimateTime={d => d.dashAnimateTime || 2000}
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.25}
        onGlobeReady={handleGlobeReady}
      />

    </div>
  );
};

export default InteractiveGlobe;