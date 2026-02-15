import * as THREE from 'three';

export interface MotionSim {
  position: THREE.Vector3;
  heading: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  route: THREE.Vector3[];
  speed: number;
  stateBlend: number;
  turnVelocity: number;
}

export interface BuildingAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface MotionSimWithState extends MotionSim {
  state: string;
}

function countNearbyAgents(
  selfId: string,
  sim: MotionSimWithState,
  sims: Map<string, MotionSimWithState>,
  radius: number,
): number {
  let count = 0;
  const radiusSq = radius * radius;
  for (const [otherId, other] of sims) {
    if (otherId === selfId || other.state === 'DEAD') continue;
    const dx = other.position.x - sim.position.x;
    const dz = other.position.z - sim.position.z;
    const dSq = dx * dx + dz * dz;
    if (dSq <= radiusSq) count += 1;
  }
  return count;
}

function computeAvoidanceDirection(
  selfId: string,
  sim: MotionSimWithState,
  sims: Map<string, MotionSimWithState>,
): THREE.Vector3 {
  const avoidance = new THREE.Vector3();
  for (const [otherId, other] of sims) {
    if (otherId === selfId || other.state === 'DEAD') continue;
    const toOther = other.position.clone().sub(sim.position);
    const otherDist = toOther.length();
    if (otherDist < 1.0 && otherDist > 0.01) {
      avoidance.addScaledVector(toOther.normalize(), -0.5 * (1.0 - otherDist));
    }
  }
  return avoidance;
}

export function stepAgentAlongRoute(
  selfId: string,
  sim: MotionSimWithState,
  sims: Map<string, MotionSimWithState>,
  dt: number,
) {
  const wp = sim.route[0];
  if (!wp) {
    sim.velocity.multiplyScalar(Math.exp(-8 * dt));
    sim.acceleration.set(0, 0, 0);
    sim.turnVelocity = THREE.MathUtils.damp(sim.turnVelocity, 0, 12, dt);
    return;
  }

  const isFinalWaypoint = sim.route.length <= 1;
  const nearbyCount = countNearbyAgents(selfId, sim, sims, 1.15);
  const distToWp = sim.position.distanceTo(wp);
  const arrivalRadius = isFinalWaypoint
    ? (nearbyCount >= 2 ? 0.95 : 0.35)
    : 0.15;
  if (distToWp < arrivalRadius) {
    sim.position.copy(wp);
    sim.route.shift();
    sim.velocity.multiplyScalar(Math.exp(-10 * dt));
    sim.acceleration.set(0, 0, 0);
    sim.turnVelocity = THREE.MathUtils.damp(sim.turnVelocity, 0, 12, dt);
    return;
  }

  const nextWp = sim.route[1];
  const steerTarget = nextWp && distToWp < 1.4 ? nextWp : wp;
  const desiredDir = steerTarget.clone().sub(sim.position);
  if (desiredDir.lengthSq() < 0.0001) {
    sim.route.shift();
    return;
  }

  desiredDir.normalize();
  const avoidance = computeAvoidanceDirection(selfId, sim, sims);
  if (isFinalWaypoint) {
    const nearGoalFactor = THREE.MathUtils.clamp((distToWp - 0.2) / 1.2, 0, 1);
    avoidance.multiplyScalar(nearGoalFactor * 0.55);
  }
  const steerDir = desiredDir.clone().add(avoidance);
  if (steerDir.lengthSq() > 0.0001) {
    steerDir.normalize();
  } else {
    steerDir.copy(desiredDir);
  }

  const turnLerp = Math.min(0.7, dt * (5.6 - Math.min(2.3, sim.velocity.length() * 0.35)));
  if (sim.heading.lengthSq() < 0.0001) {
    sim.heading.copy(steerDir);
  } else {
    sim.heading.lerp(steerDir, Math.max(0.08, turnLerp)).normalize();
  }
  const headingToDesiredCrossY = sim.heading.z * steerDir.x - sim.heading.x * steerDir.z;
  const signedTurnAngle = sim.heading.angleTo(steerDir) * Math.sign(headingToDesiredCrossY || 1);
  sim.turnVelocity = THREE.MathUtils.damp(sim.turnVelocity, signedTurnAngle, 9, dt);

  let moveSpeed = sim.speed * (0.9 + sim.stateBlend * 0.35);
  if (isFinalWaypoint) {
    const approachFactor = THREE.MathUtils.clamp(distToWp / 1.8, 0.22, 1);
    moveSpeed *= approachFactor;
  }
  const desiredVelocity = sim.heading.clone().multiplyScalar(moveSpeed);
  const velocityLerp = 1 - Math.exp(-8.5 * dt);
  sim.velocity.lerp(desiredVelocity, velocityLerp);
  sim.acceleration.copy(desiredVelocity).sub(sim.velocity);
  sim.position.addScaledVector(sim.velocity, dt);

  if (isFinalWaypoint && distToWp < 1.25 && nearbyCount >= 2) {
    sim.velocity.multiplyScalar(Math.exp(-6 * dt));
    sim.turnVelocity = THREE.MathUtils.damp(sim.turnVelocity, 0, 8, dt);
  }
}

export function enforceBuildingExclusion(sim: MotionSim, buildingAABBs: BuildingAABB[]): boolean {
  for (const bb of buildingAABBs) {
    const px = sim.position.x;
    const pz = sim.position.z;
    if (px > bb.minX && px < bb.maxX && pz > bb.minZ && pz < bb.maxZ) {
      const dLeft = px - bb.minX;
      const dRight = bb.maxX - px;
      const dTop = pz - bb.minZ;
      const dBottom = bb.maxZ - pz;
      const minD = Math.min(dLeft, dRight, dTop, dBottom);
      const margin = 0.15;
      if (minD === dLeft) sim.position.x = bb.minX - margin;
      else if (minD === dRight) sim.position.x = bb.maxX + margin;
      else if (minD === dTop) sim.position.z = bb.minZ - margin;
      else sim.position.z = bb.maxZ + margin;
      sim.velocity.multiplyScalar(0.35);
      return true;
    }
  }
  return false;
}

export function resolveAgentSeparation(simList: MotionSimWithState[], minSep = 0.95) {
  const minSepSq = minSep * minSep;
  for (let i = 0; i < simList.length; i++) {
    for (let j = i + 1; j < simList.length; j++) {
      const a = simList[i];
      const b = simList[j];
      const dx = a.position.x - b.position.x;
      const dz = a.position.z - b.position.z;
      const dSq = dx * dx + dz * dz;

      if (dSq > 0.000001 && dSq < minSepSq) {
        const d = Math.sqrt(dSq);
        const push = (minSep - d) * 0.5;
        const nx = dx / d;
        const nz = dz / d;
        a.position.x += nx * push;
        a.position.z += nz * push;
        b.position.x -= nx * push;
        b.position.z -= nz * push;
      } else if (dSq <= 0.000001) {
        const ang = (i * 97 + j * 131) % 360;
        const rad = (ang * Math.PI) / 180;
        const nx = Math.cos(rad);
        const nz = Math.sin(rad);
        a.position.x += nx * (minSep * 0.25);
        a.position.z += nz * (minSep * 0.25);
        b.position.x -= nx * (minSep * 0.25);
        b.position.z -= nz * (minSep * 0.25);
      }
    }
  }
}
