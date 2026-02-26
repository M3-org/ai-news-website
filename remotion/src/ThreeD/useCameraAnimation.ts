/**
 * useCameraAnimation.ts — Direct track sampling for Blender camera animation.
 *
 * Reads camera animation tracks from GLTF clips and applies position/quaternion
 * each frame. Uses the same pattern as `custom` effects in useEffector.ts:
 * no AnimationMixer, just interpolant.evaluate(t) → write to object.
 */
import { useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationClip, PerspectiveCamera } from "three";
import { Vector3 } from "three";

/** Scratch vectors for velocity computation */
const _prevPos = new Vector3();
const _currPos = new Vector3();

interface TrackBinding {
  property: "position" | "quaternion" | "fov";
  interpolant: { evaluate(t: number): Float32Array; resultBuffer: Float32Array };
}

interface CameraAnimationConfig {
  animations: AnimationClip[];
  cameraRef: React.RefObject<PerspectiveCamera | null>;
  fps?: number; // default: use Remotion's fps
}

interface CameraAnimationResult {
  /** Camera velocity (units/frame) — use for chromatic aberration, shake, etc. */
  velocity: number;
  /** Current FOV from animation (degrees) — can be modulated by caller */
  fov: number;
  /** Whether a valid camera animation was found and applied */
  hasAnimation: boolean;
}

/**
 * Applies Blender camera animation to a PerspectiveCamera ref.
 *
 * Searches for tracks targeting "Camera" (by name) and applies position/quaternion
 * each frame via direct interpolant sampling.
 *
 * @returns velocity (for effects like chromatic aberration) and hasAnimation flag
 */
export function useCameraAnimation({
  animations,
  cameraRef,
  fps: fpsProp,
}: CameraAnimationConfig): CameraAnimationResult {
  const frame = useCurrentFrame();
  const { fps: configFps } = useVideoConfig();
  const fps = fpsProp ?? configFps;

  // Track previous position for velocity calculation
  const prevPosRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // Build interpolants for camera tracks once
  const bindings = useMemo(() => {
    if (!animations?.length) return null;

    const result: { duration: number; tracks: TrackBinding[] }[] = [];

    for (const clip of animations) {
      const tracks: TrackBinding[] = [];

      for (const track of clip.tracks) {
        // Track names are like "Camera.position" or "Camera.quaternion"
        const dotIdx = track.name.lastIndexOf(".");
        const objectPath = dotIdx >= 0 ? track.name.substring(0, dotIdx) : track.name;
        const property = dotIdx >= 0 ? track.name.substring(dotIdx + 1) : "";

        // Only process tracks targeting "Camera"
        // Handle both "Camera" and paths like "Scene/Camera"
        const parts = objectPath.split("/");
        const targetName = parts[parts.length - 1];
        if (targetName !== "Camera") continue;

        if (property !== "position" && property !== "quaternion" && property !== "fov") continue;

        tracks.push({
          property: property as "position" | "quaternion" | "fov",
          interpolant: (track as any).createInterpolant() as TrackBinding["interpolant"],
        });
      }

      if (tracks.length > 0) {
        result.push({ duration: clip.duration, tracks });
      }
    }

    if (result.length === 0) {
      console.warn("[useCameraAnimation] No camera animation found in GLTF.");
      return null;
    }

    return result;
  }, [animations]);

  // No animation found
  if (!bindings || !cameraRef.current) {
    return { velocity: 0, fov: 80, hasAnimation: false };
  }

  const camera = cameraRef.current;

  // Store previous position before applying new one
  _prevPos.copy(camera.position);

  // Track current FOV (default to camera's current FOV if no animation)
  let currentFov = camera.fov;

  // Apply camera animation
  for (const { duration, tracks } of bindings) {
    // Time in seconds, clamped to animation duration
    const t = Math.min((frame / fps), duration);

    for (const { property, interpolant } of tracks) {
      interpolant.evaluate(t);
      const buf = interpolant.resultBuffer;

      if (property === "position") {
        camera.position.set(buf[0], buf[1], buf[2]);
      } else if (property === "quaternion") {
        camera.quaternion.set(buf[0], buf[1], buf[2], buf[3]);
      } else if (property === "fov") {
        currentFov = buf[0];
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }
    }
  }

  // Compute velocity (distance moved this frame)
  _currPos.copy(camera.position);
  let velocity = 0;

  if (prevPosRef.current) {
    _prevPos.set(prevPosRef.current.x, prevPosRef.current.y, prevPosRef.current.z);
    velocity = _currPos.distanceTo(_prevPos);
  }

  // Store current position for next frame
  prevPosRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

  return { velocity, fov: currentFov, hasAnimation: true };
}
