/**
 * Day/night tint cycle — returns a hex tint color that changes over 5 minutes.
 */
import { useState, useEffect } from 'react';

const CYCLE_MS = 5 * 60 * 1000; // 5-minute full cycle

const PALETTE = [
  { t: 0.0, r: 255, g: 220, b: 180 },  // warm sunrise
  { t: 0.2, r: 255, g: 255, b: 255 },  // full day
  { t: 0.4, r: 255, g: 230, b: 200 },  // afternoon
  { t: 0.5, r: 255, g: 180, b: 120 },  // sunset amber
  { t: 0.65, r: 80, g: 70, b: 140 },   // dusk
  { t: 0.75, r: 30, g: 30, b: 80 },    // deep night
  { t: 0.9, r: 120, g: 90, b: 150 },   // dawn pink
  { t: 1.0, r: 255, g: 220, b: 180 },  // sunrise again
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function samplePalette(phase: number): number {
  for (let i = 0; i < PALETTE.length - 1; i++) {
    const curr = PALETTE[i];
    const next = PALETTE[i + 1];
    if (phase >= curr.t && phase <= next.t) {
      const local = (phase - curr.t) / (next.t - curr.t);
      const r = Math.round(lerp(curr.r, next.r, local));
      const g = Math.round(lerp(curr.g, next.g, local));
      const b = Math.round(lerp(curr.b, next.b, local));
      return (r << 16) | (g << 8) | b;
    }
  }
  return 0xffffff;
}

export function useDayNight() {
  const [tint, setTint] = useState(0xffffff);
  const [alpha, setAlpha] = useState(0);

  useEffect(() => {
    const update = () => {
      const phase = (Date.now() % CYCLE_MS) / CYCLE_MS;
      const color = samplePalette(phase);
      setTint(color);
      // Alpha: stronger tint at night, none during day
      const isNight = phase > 0.6 && phase < 0.95;
      setAlpha(isNight ? 0.25 : phase > 0.45 && phase < 0.6 ? 0.12 : 0);
    };
    update();
    const t = setInterval(update, 2000);
    return () => clearInterval(t);
  }, []);

  return { tint, alpha };
}
