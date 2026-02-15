/**
 * Generate street light positions along road segments, every ~20 units.
 */
export function generateLightPositions(
  roadSegments: Array<{ kind: 'V' | 'H'; x: number; z: number; len: number }>,
  spacing = 20,
): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  const seen = new Set<string>();

  for (const seg of roadSegments) {
    const count = Math.max(1, Math.floor(seg.len / spacing));
    for (let i = 0; i <= count; i++) {
      const t = count > 0 ? i / count : 0.5;
      let x: number;
      let z: number;
      if (seg.kind === 'H') {
        x = seg.x - seg.len / 2 + seg.len * t;
        z = seg.z;
      } else {
        x = seg.x;
        z = seg.z - seg.len / 2 + seg.len * t;
      }

      const sideOffset = 3.0;
      const px = seg.kind === 'H' ? x : x + sideOffset;
      const pz = seg.kind === 'V' ? z : z + sideOffset;
      const key = `${Math.round(px)}:${Math.round(pz)}`;
      if (!seen.has(key)) {
        seen.add(key);
        positions.push([px, pz]);
      }
    }
  }

  return positions;
}
