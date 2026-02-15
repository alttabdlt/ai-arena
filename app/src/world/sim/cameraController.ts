import * as THREE from 'three';
import type { ResolvedVisualQuality } from '../visual/townVisualTuning';

interface SimCameraState {
  position: THREE.Vector3;
  heading: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration?: THREE.Vector3;
  turnVelocity?: number;
}

interface IntroState {
  active: boolean;
  t: number;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export interface FollowCameraArgs {
  camera: THREE.Camera;
  sim: SimCameraState;
  dt: number;
  timeSeconds: number;
  intro: IntroState;
  focusSnapTimer: number;
  visualQuality: ResolvedVisualQuality;
  cameraVelocity: THREE.Vector3;
  lookTarget: THREE.Vector3;
  shakeStrength: number;
}

export function updateFollowCamera(args: FollowCameraArgs) {
  const {
    camera,
    sim,
    dt,
    timeSeconds,
    intro,
    focusSnapTimer,
    visualQuality,
    cameraVelocity,
    lookTarget,
    shakeStrength,
  } = args;
  const safePosition = sim.position.clone();
  if (!Number.isFinite(safePosition.x) || !Number.isFinite(safePosition.y) || !Number.isFinite(safePosition.z)) {
    return;
  }

  const headingNorm = sim.heading.lengthSq() > 0.0001
    ? sim.heading.clone().normalize()
    : new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3(-headingNorm.z, 0, headingNorm.x);
  const speed = sim.velocity.length();
  const speedNorm = THREE.MathUtils.clamp(speed / 5.5, 0, 1);
  const turnSwayWeight = 0.15 + speedNorm * 0.85;
  const turnSway = THREE.MathUtils.clamp((sim.turnVelocity ?? 0) * turnSwayWeight, -0.45, 0.45);
  const idleBobAmp = (1 - speedNorm) * 0.08;
  const runBobAmp = speedNorm * 0.04;
  const bobY = Math.sin(timeSeconds * (1.4 + speedNorm * 2.6)) * (idleBobAmp + runBobAmp);
  const sway = Math.sin(timeSeconds * (1.2 + speedNorm * 3.1) + 1.3) * (0.04 + speedNorm * 0.08);
  const lookAhead = sim.position
    .clone()
    .add(new THREE.Vector3(0, 2.6 + bobY * 0.5, 0))
    .add(headingNorm.clone().multiplyScalar(6));
  let desiredLookTarget = lookAhead.clone();

  if (intro.active) {
    intro.t = Math.min(1, intro.t + dt * 0.5);
    const e = easeOutCubic(intro.t);
    const skyPos = new THREE.Vector3(50, 55, 50);
    const behind = headingNorm.clone().multiplyScalar(-14);
    const target = sim.position.clone().add(behind).add(new THREE.Vector3(0, 7, 0));
    camera.position.lerpVectors(skyPos, target, e);
    const skyLook = new THREE.Vector3(0, 0, 0);
    desiredLookTarget = skyLook.lerp(lookAhead, e);
    if (intro.t >= 1) intro.active = false;
  } else {
    const dynamicBack = THREE.MathUtils.lerp(16, 12, Math.min(1, speed / 6));
    const desired = sim.position
      .clone()
      .add(headingNorm.clone().multiplyScalar(-dynamicBack))
      .add(new THREE.Vector3(0, 7.2, 0));
    desired.addScaledVector(right, -turnSway * 0.65 + sway);
    desired.y += bobY;

    const snapBoost = focusSnapTimer > 0 ? 16 : 9;
    const spring = desired.clone().sub(camera.position);
    cameraVelocity.addScaledVector(spring, snapBoost * dt);
    cameraVelocity.multiplyScalar(Math.exp(-6.5 * dt));
    camera.position.addScaledVector(cameraVelocity, dt);

    lookTarget.lerp(lookAhead, 1 - Math.exp(-(focusSnapTimer > 0 ? 12 : 7.5) * dt));
    desiredLookTarget = lookTarget.clone();
  }

  const fallbackBehind = headingNorm.clone().multiplyScalar(-12);
  const fallbackPos = safePosition.clone().add(fallbackBehind).add(new THREE.Vector3(0, 7, 0));
  if (!Number.isFinite(camera.position.x) || !Number.isFinite(camera.position.y) || !Number.isFinite(camera.position.z)) {
    camera.position.copy(fallbackPos);
    cameraVelocity.set(0, 0, 0);
  }

  const offset = camera.position.clone().sub(safePosition);
  const horizontal = new THREE.Vector3(offset.x, 0, offset.z);
  const horizontalLen = horizontal.length();
  if (!Number.isFinite(horizontalLen) || horizontalLen < 7) {
    const dir = horizontalLen > 0.001
      ? horizontal.multiplyScalar(1 / horizontalLen)
      : headingNorm.clone().multiplyScalar(-1);
    camera.position.copy(
      safePosition
        .clone()
        .add(dir.multiplyScalar(12))
        .add(new THREE.Vector3(0, 7, 0)),
    );
    cameraVelocity.set(0, 0, 0);
  } else if (horizontalLen > 28) {
    horizontal.multiplyScalar(28 / horizontalLen);
    camera.position.set(
      safePosition.x + horizontal.x,
      camera.position.y,
      safePosition.z + horizontal.z,
    );
  }
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, 2.6, 18);

  if (!Number.isFinite(desiredLookTarget.x) || !Number.isFinite(desiredLookTarget.y) || !Number.isFinite(desiredLookTarget.z)) {
    desiredLookTarget = safePosition.clone().add(new THREE.Vector3(0, 2.6, 0)).add(headingNorm.clone().multiplyScalar(6));
    lookTarget.copy(desiredLookTarget);
  }
  if (camera.position.distanceToSquared(desiredLookTarget) < 0.5) {
    desiredLookTarget = safePosition.clone().add(new THREE.Vector3(0, 2.6, 0)).add(headingNorm.clone().multiplyScalar(6));
    lookTarget.copy(desiredLookTarget);
  }
  camera.lookAt(desiredLookTarget);
  const q = camera.quaternion;
  if (!Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z) || !Number.isFinite(q.w)) {
    camera.quaternion.identity();
    camera.lookAt(safePosition.clone().add(new THREE.Vector3(0, 2.6, 0)).add(headingNorm.clone().multiplyScalar(6)));
  }

  const perspectiveCamera = camera as THREE.PerspectiveCamera;
  if (typeof perspectiveCamera.fov === 'number') {
    const baseFov = visualQuality === 'high' ? 47 : visualQuality === 'medium' ? 46 : 45;
    const accelMag = sim.acceleration?.length() ?? 0;
    const desiredFov = baseFov + Math.min(5.5, sim.velocity.length() * 0.9) + Math.min(2.2, accelMag * 0.45);
    const nextFov = THREE.MathUtils.damp(perspectiveCamera.fov, desiredFov, 4.2, dt);
    if (Math.abs(nextFov - perspectiveCamera.fov) > 0.015) {
      perspectiveCamera.fov = nextFov;
      perspectiveCamera.updateProjectionMatrix();
    }
  }

  if (shakeStrength > 0.001) {
    const shakeT = timeSeconds * 36;
    camera.position.x += Math.sin(shakeT) * shakeStrength * 0.5;
    camera.position.y += Math.cos(shakeT * 0.8 + 1.7) * shakeStrength * 0.35;
    camera.position.z += Math.sin(shakeT * 0.65 + 0.6) * shakeStrength * 0.5;
  }
}
