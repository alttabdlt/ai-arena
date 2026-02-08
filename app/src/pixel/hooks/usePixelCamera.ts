/**
 * Pan / zoom / follow camera for the pixel town.
 * Returns state & event handlers for a PixiJS viewport container.
 */
import { useState, useRef, useCallback } from 'react';

export interface CameraState {
  x: number; y: number;
  zoom: number;
}

export function usePixelCamera(initialX = 0, initialY = 0, initialZoom = 2) {
  const [camera, setCameraState] = useState<CameraState>({ x: initialX, y: initialY, zoom: initialZoom });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const dragRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const followRef = useRef<string | null>(null);

  const setCamera = useCallback((next: Partial<CameraState>) => {
    setCameraState(prev => {
      const merged = { ...prev, ...next };
      merged.zoom = Math.max(0.5, Math.min(8, merged.zoom));
      cameraRef.current = merged;
      return merged;
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    followRef.current = null; // cancel follow on drag
    dragRef.current = { sx: e.clientX, sy: e.clientY, cx: cameraRef.current.x, cy: cameraRef.current.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    const z = cameraRef.current.zoom;
    setCamera({
      x: dragRef.current.cx - dx / z,
      y: dragRef.current.cy - dy / z,
    });
  }, [setCamera]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setCamera({ zoom: cameraRef.current.zoom + delta * cameraRef.current.zoom });
  }, [setCamera]);

  const panTo = useCallback((worldX: number, worldY: number) => {
    followRef.current = null;
    setCamera({ x: worldX, y: worldY });
  }, [setCamera]);

  const followAgent = useCallback((agentId: string | null) => {
    followRef.current = agentId;
  }, []);

  /** Call every frame to smoothly track followed agent position */
  const updateFollow = useCallback((agentPositions: Map<string, { x: number; y: number }>) => {
    const id = followRef.current;
    if (!id) return;
    const pos = agentPositions.get(id);
    if (!pos) return;
    const cam = cameraRef.current;
    const lerpFactor = 0.08;
    setCamera({
      x: cam.x + (pos.x - cam.x) * lerpFactor,
      y: cam.y + (pos.y - cam.y) * lerpFactor,
    });
  }, [setCamera]);

  const zoomBy = useCallback((delta: number) => {
    setCamera({ zoom: cameraRef.current.zoom * (1 + delta) });
  }, [setCamera]);

  return {
    camera, cameraRef, followRef,
    setCamera, onPointerDown, onPointerMove, onPointerUp, onWheel,
    panTo, followAgent, updateFollow, zoomBy,
  };
}
