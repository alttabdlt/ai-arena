/**
 * roadGraph.ts — Road graph builder, A* pathfinding, and Catmull-Rom smoothing.
 *
 * Builds a navigable graph from the procedural road segments in TownScene,
 * then uses A* to find shortest paths and Catmull-Rom to smooth them.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  x: number;
  z: number;
}

interface GraphEdge {
  to: string;
  dist: number;
}

export interface RoadGraph {
  nodes: Map<string, GraphNode>;
  adj: Map<string, GraphEdge[]>;
}

// Segment descriptor from Town3D's roadSegments useMemo
export interface RoadSegInput {
  id: string;
  kind: 'V' | 'H';
  x: number; // world-space center X
  z: number; // world-space center Z
  len: number; // length in world units
  tone: 'ring' | 'arterial' | 'local';
}

// ---------------------------------------------------------------------------
// Graph building
// ---------------------------------------------------------------------------

function nodeKey(x: number, z: number): string {
  return `${Math.round(x * 4) / 4}:${Math.round(z * 4) / 4}`;
}

function ensureNode(graph: RoadGraph, x: number, z: number): string {
  const k = nodeKey(x, z);
  if (!graph.nodes.has(k)) {
    graph.nodes.set(k, { id: k, x, z });
    graph.adj.set(k, []);
  }
  return k;
}

function addEdge(graph: RoadGraph, a: string, b: string) {
  const na = graph.nodes.get(a)!;
  const nb = graph.nodes.get(b)!;
  const dx = na.x - nb.x;
  const dz = na.z - nb.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.01) return;
  const adjA = graph.adj.get(a)!;
  if (!adjA.some((e) => e.to === b)) adjA.push({ to: b, dist });
  const adjB = graph.adj.get(b)!;
  if (!adjB.some((e) => e.to === a)) adjB.push({ to: a, dist });
}

/**
 * Build a navigable road graph from the procedural road segments.
 * Each segment produces two endpoint nodes connected by an edge.
 * Nearby endpoints are snapped together via quantized keys.
 */
export function buildRoadGraph(
  segments: RoadSegInput[],
  plotPositions?: Map<number, THREE.Vector3>,
): RoadGraph {
  const graph: RoadGraph = {
    nodes: new Map(),
    adj: new Map(),
  };

  for (const seg of segments) {
    let ax: number, az: number, bx: number, bz: number;
    if (seg.kind === 'H') {
      ax = seg.x - seg.len / 2;
      az = seg.z;
      bx = seg.x + seg.len / 2;
      bz = seg.z;
    } else {
      ax = seg.x;
      az = seg.z - seg.len / 2;
      bx = seg.x;
      bz = seg.z + seg.len / 2;
    }
    const ka = ensureNode(graph, ax, az);
    const kb = ensureNode(graph, bx, bz);
    addEdge(graph, ka, kb);

    // For longer segments, add intermediate nodes so paths can enter/exit mid-segment.
    const length = seg.len;
    if (length > 12) {
      const steps = Math.floor(length / 8);
      let prevKey = ka;
      for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        const mx = ax + (bx - ax) * t;
        const mz = az + (bz - az) * t;
        const mk = ensureNode(graph, mx, mz);
        addEdge(graph, prevKey, mk);
        prevKey = mk;
      }
      addEdge(graph, prevKey, kb);
    }
  }

  // Add building entrance nodes snapped to nearest road node
  if (plotPositions) {
    for (const [, pos] of plotPositions) {
      const pk = ensureNode(graph, pos.x, pos.z);
      // Connect to nearest road node within ~12 units
      let bestKey: string | null = null;
      let bestDist = 12;
      for (const [k, n] of graph.nodes) {
        if (k === pk) continue;
        const dx = n.x - pos.x;
        const dz = n.z - pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < bestDist) {
          bestDist = d;
          bestKey = k;
        }
      }
      if (bestKey) addEdge(graph, pk, bestKey);
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// A* pathfinding
// ---------------------------------------------------------------------------

/** Find closest graph node to a world position. */
export function nearestNode(graph: RoadGraph, x: number, z: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [k, n] of graph.nodes) {
    const dx = n.x - x;
    const dz = n.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}

/**
 * A* shortest path between two node keys.
 * Returns array of node keys from start to end, or empty if no path found.
 */
export function astar(graph: RoadGraph, startKey: string, endKey: string): string[] {
  if (startKey === endKey) return [startKey];

  const endNode = graph.nodes.get(endKey);
  if (!endNode) return [];

  // Heuristic: Euclidean distance
  const h = (key: string) => {
    const n = graph.nodes.get(key);
    if (!n) return 0;
    const dx = n.x - endNode.x;
    const dz = n.z - endNode.z;
    return Math.sqrt(dx * dx + dz * dz);
  };

  const gScore = new Map<string, number>();
  gScore.set(startKey, 0);

  const fScore = new Map<string, number>();
  fScore.set(startKey, h(startKey));

  const cameFrom = new Map<string, string>();

  // Simple priority queue (array-based, fine for town-sized graphs)
  const open = new Set<string>([startKey]);

  while (open.size > 0) {
    // Pick node with lowest fScore
    let current = '';
    let bestF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = k;
      }
    }

    if (current === endKey) {
      // Reconstruct path
      const path: string[] = [current];
      let c = current;
      while (cameFrom.has(c)) {
        c = cameFrom.get(c)!;
        path.unshift(c);
      }
      return path;
    }

    open.delete(current);
    const g = gScore.get(current) ?? Infinity;
    const edges = graph.adj.get(current) ?? [];

    for (const edge of edges) {
      const tentative = g + edge.dist;
      if (tentative < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, current);
        gScore.set(edge.to, tentative);
        fScore.set(edge.to, tentative + h(edge.to));
        open.add(edge.to);
      }
    }
  }

  return []; // No path found
}

// ---------------------------------------------------------------------------
// Path to world-space waypoints with Catmull-Rom smoothing
// ---------------------------------------------------------------------------

/**
 * Convert A* node-key path to smooth THREE.Vector3 waypoints.
 * Uses Catmull-Rom interpolation so agents don't make sharp 90-degree turns.
 */
export function smoothPath(
  graph: RoadGraph,
  nodeKeys: string[],
  subdivisions = 3,
): THREE.Vector3[] {
  if (nodeKeys.length === 0) return [];
  if (nodeKeys.length === 1) {
    const n = graph.nodes.get(nodeKeys[0]);
    return n ? [new THREE.Vector3(n.x, 0.02, n.z)] : [];
  }

  // Raw control points
  const pts: THREE.Vector3[] = nodeKeys.map((k) => {
    const n = graph.nodes.get(k)!;
    return new THREE.Vector3(n.x, 0.02, n.z);
  });

  if (pts.length <= 2) return pts;

  // Catmull-Rom interpolation
  const result: THREE.Vector3[] = [pts[0]];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(pts.length - 1, i + 1)];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    for (let s = 1; s <= subdivisions; s++) {
      const t = s / subdivisions;
      const tt = t * t;
      const ttt = tt * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * ttt);

      const z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * t +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * tt +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * ttt);

      result.push(new THREE.Vector3(x, 0.02, z));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convenience: full pathfind from world pos A to world pos B
// ---------------------------------------------------------------------------

/**
 * Find a smooth path on the road graph from position A to position B.
 * Falls back to a direct walk if no graph path exists.
 */
export function findPath(
  graph: RoadGraph,
  from: THREE.Vector3,
  to: THREE.Vector3,
): THREE.Vector3[] {
  const startKey = nearestNode(graph, from.x, from.z);
  const endKey = nearestNode(graph, to.x, to.z);

  if (!startKey || !endKey) {
    return [to.clone().setY(0.02)];
  }

  const nodeKeys = astar(graph, startKey, endKey);
  if (nodeKeys.length === 0) {
    return [to.clone().setY(0.02)];
  }

  const waypoints = smoothPath(graph, nodeKeys);

  // Prepend walk from current position to first road node (off-road approach)
  const firstWp = waypoints[0];
  if (firstWp && from.distanceTo(firstWp) > 0.5) {
    waypoints.unshift(from.clone().setY(0.02));
  }

  // Append walk from last road node to destination (off-road arrival)
  const lastWp = waypoints[waypoints.length - 1];
  if (lastWp && to.distanceTo(lastWp) > 0.5) {
    waypoints.push(to.clone().setY(0.02));
  }

  return waypoints;
}

// ---------------------------------------------------------------------------
// Highway path (for agents traveling between towns)
// ---------------------------------------------------------------------------

/**
 * Build a simple highway path between two town positions.
 * Follows the Z axis with gentle curves.
 */
export function buildHighwayPath(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): THREE.Vector3[] {
  const dist = Math.abs(toZ - fromZ);
  const steps = Math.max(4, Math.ceil(dist / 20));
  const pts: THREE.Vector3[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = fromX + (toX - fromX) * t;
    const z = fromZ + (toZ - fromZ) * t;
    pts.push(new THREE.Vector3(x + Math.sin(t * Math.PI * 2) * 2, 0.02, z));
  }

  return pts;
}
