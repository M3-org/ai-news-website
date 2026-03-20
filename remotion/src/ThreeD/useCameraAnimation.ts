/**
 * useCameraAnimation.ts — Direct track sampling for Blender camera animation.
 *
 * Reads camera animation tracks from GLTF clips and applies position/quaternion
 * each frame. Uses the same pattern as `custom` effects in useEffector.ts:
 * no AnimationMixer, just interpolant.evaluate(t) → write to object.
 */
import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationClip, PerspectiveCamera } from "three";

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
      // No camera animation in this GLB — expected for most scenes
      return null;
    }

    return result;
  }, [animations]);

  // No animation found
  if (!bindings || !cameraRef.current) {
    return { velocity: 0, fov: 80, hasAnimation: false };
  }

  const camera = cameraRef.current;

  // Track current FOV (default to camera's current FOV if no animation)
  let currentFov = camera.fov;
  let velocity = 0;

  // Apply camera animation
  for (const { duration, tracks } of bindings) {
    // Time in seconds, clamped to animation duration
    const t = Math.min(frame / fps, duration);
    const prevT = Math.max(0, Math.min((frame - 1) / fps, duration));

    for (const { property, interpolant } of tracks) {
      if (property === "position") {
        const prevBuf = interpolant.evaluate(prevT);
        const px = prevBuf[0];
        const py = prevBuf[1];
        const pz = prevBuf[2];

        const buf = interpolant.evaluate(t);
        const cx = buf[0];
        const cy = buf[1];
        const cz = buf[2];

        camera.position.set(cx, cy, cz);

        // Deterministic per-frame velocity: independent from render order/concurrency.
        const dx = cx - px;
        const dy = cy - py;
        const dz = cz - pz;
        velocity = Math.sqrt(dx * dx + dy * dy + dz * dz);
      } else if (property === "quaternion") {
        interpolant.evaluate(t);
        const buf = interpolant.resultBuffer;
        camera.quaternion.set(buf[0], buf[1], buf[2], buf[3]);
      } else if (property === "fov") {
        interpolant.evaluate(t);
        const buf = interpolant.resultBuffer;
        currentFov = buf[0];
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }
    }
  }

  return { velocity, fov: currentFov, hasAnimation: true };
}
