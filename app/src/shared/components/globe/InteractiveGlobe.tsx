import { GET_CHANNELS } from '@/graphql/queries/channel';
import { useQuery } from '@apollo/client';
import { Tournament } from '@shared/types/tournament';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

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

// Minimal feature type for GeoJSON polygons
interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, any>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
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

type ContinentKey = 'north-america' | 'south-america' | 'europe' | 'africa' | 'asia' | 'oceania';

// Default active region when channel data isn't available
const DEFAULT_REGION: ContinentKey = 'north-america';

// Simple geographic test to approximate continents by centroid location
function isInNorthAmerica(lat: number, lng: number): boolean {
  // Covers Greenland to Central America roughly
  return lat >= 7 && lat <= 83 && lng >= -170 && lng <= -30;
}

function computeRoughCentroid(feature: GeoFeature): { lat: number; lng: number } | null {
  try {
    const coords = feature.geometry.coordinates as any;
    const collect: Array<[number, number]> = [];
    if (feature.geometry.type === 'Polygon') {
      const ring = coords[0];
      for (const [lng, lat] of ring) collect.push([lng, lat]);
    } else if (feature.geometry.type === 'MultiPolygon') {
      const ring = coords[0]?.[0] || [];
      for (const [lng, lat] of ring) collect.push([lng, lat]);
    }
    if (collect.length === 0) return null;
    const avg = collect.reduce(
      (acc, cur) => {
        acc[0] += cur[0];
        acc[1] += cur[1];
        return acc;
      },
      [0, 0]
    );
    const lng = avg[0] / collect.length;
    const lat = avg[1] / collect.length;
    return { lat, lng };
  } catch {
    return null;
  }
}

function isInSouthAmerica(lat: number, lng: number): boolean {
  return lat >= -57 && lat <= 13 && lng >= -82 && lng <= -34;
}

function isInEurope(lat: number, lng: number): boolean {
  return lat >= 35 && lat <= 71 && lng >= -25 && lng <= 45;
}

function isInAfrica(lat: number, lng: number): boolean {
  return lat >= -35 && lat <= 37 && lng >= -20 && lng <= 52;
}

function isInAsia(lat: number, lng: number): boolean {
  return lat >= 0 && lat <= 81 && lng >= 26 && lng <= 180;
}

function isInOceania(lat: number, lng: number): boolean {
  return lat >= -50 && lat <= 0 && lng >= 110 && lng <= 180;
}

function isInContinent(continent: ContinentKey, lat: number, lng: number): boolean {
  switch (continent) {
    case 'north-america':
      return isInNorthAmerica(lat, lng);
    case 'south-america':
      return isInSouthAmerica(lat, lng);
    case 'europe':
      return isInEurope(lat, lng);
    case 'africa':
      return isInAfrica(lat, lng);
    case 'asia':
      return isInAsia(lat, lng);
    case 'oceania':
      return isInOceania(lat, lng);
    default:
      return false;
  }
}

function inferContinentFromRegion(region?: string | null): ContinentKey {
  if (!region) return DEFAULT_REGION;
  const val = region.toLowerCase();
  if (val.startsWith('us') || val.startsWith('na') || val.includes('america')) return 'north-america';
  if (val.startsWith('sa') || val.includes('south-america')) return 'south-america';
  if (val.startsWith('eu') || val.includes('europe')) return 'europe';
  if (val.startsWith('af') || val.includes('africa')) return 'africa';
  if (val.startsWith('ap') || val.startsWith('asia') || val.includes('ap-') || val.includes('asia')) return 'asia';
  if (val.startsWith('oc') || val.startsWith('au') || val.includes('oceania') || val.includes('australia')) return 'oceania';
  return DEFAULT_REGION;
}

const InteractiveGlobe: React.FC<InteractiveGlobeProps> = ({
  tournaments = [],
  onLocationClick,
  onZoomComplete,
  globeRef,
  enableZoom = true
}) => {
  const internalGlobeRef = useRef<any>(null); // Globe.gl doesn't export proper types
  const globeEl = globeRef || internalGlobeRef;
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [worldFeatures, setWorldFeatures] = useState<GeoFeature[]>([]);
  const [hoverFeature, setHoverFeature] = useState<GeoFeature | null>(null);
  const [pulse, setPulse] = useState(0);
  const [activeContinent, setActiveContinent] = useState<ContinentKey>(DEFAULT_REGION);

  // Channels determine which continents are owned and which is active
  const { data: channelsData } = useQuery(GET_CHANNELS, {
    variables: { status: 'ACTIVE' },
    fetchPolicy: 'cache-and-network',
    pollInterval: 15000,
  });

  // Map continents to channels that have worlds
  const continentToChannel = useMemo(() => {
    const mapping = new Map<ContinentKey, any>();
    const list = channelsData?.channels || [];
    for (const ch of list) {
      const cont = inferContinentFromRegion(ch.region);
      if (ch.worldId && !mapping.has(cont)) {
        mapping.set(cont, ch);
      }
    }
    return mapping;
  }, [channelsData]);

  // Compute owned continents
  const ownedContinents = useMemo(() => new Set<ContinentKey>([...continentToChannel.keys()]), [continentToChannel]);

  useEffect(() => {
    const channels = channelsData?.channels || [];
    if (channels.length > 0) {
      const preferred = channels.find((c: any) => !!c.worldId) || channels[0];
      const continent = inferContinentFromRegion(preferred.region);
      setActiveContinent(continent);
    } else {
      setActiveContinent(DEFAULT_REGION);
    }
  }, [channelsData]);

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

  // Load world geojson (countries) to approximate continent outlines
  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        // Lightweight world countries geojson (commonly used in D3 examples)
        const res = await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson', {
          cache: 'force-cache'
        });
        if (!res.ok) throw new Error('Failed to load world geojson');
        const json = await res.json();
        if (!aborted) {
          const features = (json.features || []) as GeoFeature[];
          setWorldFeatures(features);
        }
      } catch (err) {
        console.warn('Failed to fetch world geojson, using empty dataset.', err);
        if (!aborted) setWorldFeatures([]);
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, []);

  // Animation pulse for glow and subtle camera motion
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setPulse((p) => (p + 0.016) % (Math.PI * 2));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Configure globe on mount
  useEffect(() => {
    if (globeEl.current && globeReady) {
      // Auto-rotate with slightly slower cinematic speed
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.25;
      
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

  // Determine if a given feature belongs to the active region or owned regions
  const isFeatureActiveRegion = useMemo(() => {
    return (feature: GeoFeature): boolean => {
      const center = computeRoughCentroid(feature);
      if (!center) return false;
      return isInContinent(activeContinent, center.lat, center.lng);
    };
  }, [activeContinent]);

  const isFeatureOwned = useMemo(() => {
    return (feature: GeoFeature): boolean => {
      const center = computeRoughCentroid(feature);
      if (!center) return false;
      for (const cont of ownedContinents) {
        if (isInContinent(cont, center.lat, center.lng)) return true;
      }
      return false;
    };
  }, [ownedContinents]);

  const handlePolygonClick = (feat: GeoFeature) => {
    // If clicked on the active region, open the metaverse game
    if (isFeatureActiveRegion(feat)) {
      const token = localStorage.getItem('ai-arena-access-token');
      const params = new URLSearchParams();
      const address = localStorage.getItem('ai-arena-address') || '';
      const activeChannel = continentToChannel.get(activeContinent);
      const channelName = activeChannel?.name || 'main';
      if (address) params.append('address', address);
      if (token) params.append('token', token);
      if (channelName) params.append('channel', channelName);
      const metaverseUrl = params.toString()
        ? `http://localhost:5175?${params.toString()}`
        : 'http://localhost:5175';
      window.open(metaverseUrl, '_blank');
    } else {
      // Future: trigger purchase flow
      // For now just a subtle console cue
      console.log('This continent is for sale.');
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
        globeImageUrl={
          // 1x1 transparent PNG to effectively remove base textures
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGnwKQm9m6ZQAAAABJRU5ErkJggg=='
        }
        bumpImageUrl={undefined as unknown as string}
        backgroundImageUrl={undefined as unknown as string}
        backgroundColor="rgba(0,0,0,1)"
        showAtmosphere={true}
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.25}
        // Continent/country outlines
        polygonsData={worldFeatures}
        polygonGeoJsonGeometry={(d: any) => d.geometry}
        polygonCapColor={(d: GeoFeature) => {
          const active = isFeatureActiveRegion(d);
          const owned = isFeatureOwned(d);
          if (active) {
            const alpha = 0.45 + 0.3 * (0.5 + 0.5 * Math.sin(pulse * 2));
            return `rgba(255,255,255,${alpha.toFixed(3)})`;
          }
          if (owned) {
            return 'rgba(255,255,255,0.15)';
          }
          // Dark, nearly black fill for unpurchased regions
          return 'rgba(8,8,12,0.95)';
        }}
        polygonSideColor={() => 'rgba(255,255,255,0.06)'}
        polygonStrokeColor={(d: GeoFeature) => {
          if (isFeatureActiveRegion(d)) return 'rgba(255,255,255,0.9)';
          if (isFeatureOwned(d)) return 'rgba(230,230,255,0.25)';
          return 'rgba(200,200,220,0.12)';
        }}
        polygonAltitude={(d: GeoFeature) => (isFeatureActiveRegion(d) ? 0.012 : isFeatureOwned(d) ? 0.006 : 0.001)}
        polygonsTransitionDuration={400}
        polygonLabel={(d: GeoFeature) => {
          const center = computeRoughCentroid(d);
          const owned = isFeatureActiveRegion(d);
          const name = d.properties?.name || 'Unknown';
          return `
            <div style="color: white; background: rgba(0,0,0,0.85); padding: 6px 10px; border-radius: 6px;">
              <div style="font-weight: 700; letter-spacing: .3px;">${name}</div>
              <div style="font-size: 12px; opacity: .85;">${owned ? 'Owned: Enter Metaverse' : 'For Sale'}</div>
              ${center ? `<div style=\"font-size: 11px; opacity: .6;\">${center.lat.toFixed(1)}, ${center.lng.toFixed(1)}</div>` : ''}
            </div>
          `;
        }}
        onPolygonHover={(feat: GeoFeature | null) => setHoverFeature(feat)}
        onPolygonClick={handlePolygonClick}
        onGlobeReady={handleGlobeReady}
      />
    </div>
  );
};

export default InteractiveGlobe;