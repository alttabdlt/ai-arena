import React, { useRef, useEffect, useState } from 'react';
import Globe from 'react-globe.gl';
import { useQuery } from '@apollo/client';
import { Tournament } from '@shared/types/tournament';
import { GET_METAVERSE_BOTS } from '@/graphql/queries/bot';

interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  name: string;
  type: 'tournament' | 'bot' | 'metaverse-bot';
  id: string;
  intensity?: number;
  personality?: string;
  zone?: string;
  syncStatus?: string;
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
  globeRef?: React.MutableRefObject<any>;
  enableZoom?: boolean;
}

// Zone to coordinate mapping
const ZONE_COORDINATES = {
  casino: { lat: 36.1699, lng: -115.1398 }, // Las Vegas
  darkAlley: { lat: 40.7128, lng: -74.0060 }, // NYC
  suburb: { lat: 34.0522, lng: -118.2437 }, // LA
  downtown: { lat: 41.8781, lng: -87.6298 }, // Chicago
  underground: { lat: 51.5074, lng: -0.1278 } // London
};

// Personality colors
const PERSONALITY_COLORS = {
  CRIMINAL: '#ff0000',
  GAMBLER: '#ffd700',
  WORKER: '#00ff00'
};

const InteractiveGlobe: React.FC<InteractiveGlobeProps> = ({ 
  tournaments = [], 
  onLocationClick,
  onZoomComplete,
  globeRef,
  enableZoom = true
}) => {
  const internalGlobeRef = useRef<any>(null); // Globe.gl doesn't export proper types
  const globeEl = globeRef || internalGlobeRef;
  const [points, setPoints] = useState<GlobePoint[]>([]);
  const [arcs, setArcs] = useState<GlobeArc[]>([]);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Fetch metaverse bots
  const { data: metaverseData } = useQuery(GET_METAVERSE_BOTS, {
    variables: { limit: 500 },
    pollInterval: 5000 // Poll every 5 seconds
  });

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

    // Create points for metaverse bots
    const metaverseBotPoints: GlobePoint[] = [];
    if (metaverseData?.bots) {
      metaverseData.bots.forEach((bot: any) => {
        if (bot.currentZone && ZONE_COORDINATES[bot.currentZone as keyof typeof ZONE_COORDINATES]) {
          const zoneCoords = ZONE_COORDINATES[bot.currentZone as keyof typeof ZONE_COORDINATES];
          // Add slight randomization to avoid exact overlap
          const offsetLat = (Math.random() - 0.5) * 2;
          const offsetLng = (Math.random() - 0.5) * 2;
          
          metaverseBotPoints.push({
            lat: zoneCoords.lat + offsetLat,
            lng: zoneCoords.lng + offsetLng,
            size: 0.6,
            color: PERSONALITY_COLORS[bot.personality as keyof typeof PERSONALITY_COLORS] || '#ffffff',
            name: bot.name,
            type: 'metaverse-bot' as const,
            id: bot.id,
            intensity: bot.botSync?.syncStatus === 'SYNCED' ? 0.8 : 0.3,
            personality: bot.personality,
            zone: bot.currentZone,
            syncStatus: bot.botSync?.syncStatus
          });
        }
      });
    }

    setPoints([...tournamentPoints, ...metaverseBotPoints]);

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
  }, [tournaments, metaverseData]);

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

  const zoomToLocation = (lat: number, lng: number, altitude: number = 0.5) => {
    if (globeEl.current && enableZoom) {
      globeEl.current.pointOfView({
        lat,
        lng,
        altitude
      }, 2000);

      // Call callback after zoom animation
      setTimeout(() => {
        if (onZoomComplete) {
          onZoomComplete();
        }
      }, 2000);
    }
  };

  const handlePointClick = (point: GlobePoint) => {
    if (onLocationClick && enableZoom) {
      zoomToLocation(point.lat, point.lng);
      onLocationClick(point.lat, point.lng);
    }
  };

  // Expose zoom method to parent
  React.useImperativeHandle(globeRef, () => ({
    zoomToLocation,
    resetView: () => {
      if (globeEl.current) {
        globeEl.current.pointOfView({
          lat: 0,
          lng: 0,
          altitude: 2.5
        }, 1000);
      }
    }
  }), [enableZoom]);

  const handleGlobeReady = () => {
    setGlobeReady(true);
  };

  // Don't render globe until we have dimensions
  if (dimensions.width === 0 || dimensions.height === 0) {
    return <div className="fixed inset-0 bg-black" />;
  }

  return (
    <div className="fixed inset-0 bg-black">
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        pointsData={points}
        pointAltitude={0.01}
        pointRadius={(d: any) => d?.type === 'tournament' ? 0.5 : 0.3}
        pointColor={(d: any) => {
          if (d?.type === 'tournament') return '#ffaa00';
          if (d?.type === 'metaverse-bot') return d.color || '#ffffff';
          return '#ffffff';
        }}
        pointLabel={(d: any) => d ? `
          <div style="color: white; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px;">
            <div style="font-weight: bold;">${d.name || 'Unknown'}</div>
            ${d.type === 'tournament' ? 
              '<div style="font-size: 12px;">Live Tournament</div>' : 
              d.type === 'metaverse-bot' ? 
              `<div style="font-size: 12px;">Zone: ${d.zone || 'Unknown'}</div>
               <div style="font-size: 12px;">Personality: ${d.personality || 'Unknown'}</div>` :
              '<div style="font-size: 12px;">Bot Created</div>'
            }
          </div>
        ` : ''}
        onPointClick={handlePointClick}
        arcsData={arcs}
        arcColor={(d: any) => d?.color || '#ffaa00'}
        arcDashLength={(d: any) => d?.dashLength || 0.5}
        arcDashGap={(d: any) => d?.dashGap || 0.2}
        arcDashAnimateTime={(d: any) => d?.dashAnimateTime || 2000}
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.25}
        onGlobeReady={handleGlobeReady}
      />

    </div>
  );
};

export default InteractiveGlobe;