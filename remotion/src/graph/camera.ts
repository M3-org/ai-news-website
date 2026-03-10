/**
 * camera.ts — Camera system for the graph view.
 *
 * The "camera" is a CSS transform (translate + scale) applied to the canvas wrapper.
 * This module builds a timeline of camera keyframes from the segment list and
 * provides frame-accurate interpolation between them.
 */

import { interpolate, Easing } from "remotion";
import type { NodePos } from "./layout";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CameraTarget {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraKeyframe {
  frame: number;
  target: CameraTarget;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Frames used for camera travel between keyframes */
export const CAMERA_TRAVEL_FRAMES = 25;

/** Aggressive ramp — shoots up fast, settles slowly. Used for all transitions. */
export const RAMP_EASE = Easing.bezier(0.0, 0.9, 0.1, 1.0);
const CAMERA_EASE = RAMP_EASE;

// ── Zoom presets ─────────────────────────────────────────────────────────────

export const ZOOM = {
  /** Full graph overview */
  overview: 0.22,
  /** Center hub, shows nearby topic labels */
  hub: 0.42,
  /** Focused on a topic node + its children visible */
  topic: 0.52,
  /** Zoomed into a specific content card */
  content: 0.72,
} as const;

// ── Camera math ──────────────────────────────────────────────────────────────

/**
 * Compute the CSS transform to center a target point in the viewport.
 */
export function cameraTransform(
  target: CameraTarget,
  viewportSize: number,
): { translateX: number; translateY: number; scale: number } {
  const translateX = viewportSize / 2 - target.x * target.zoom;
  const translateY = viewportSize / 2 - target.y * target.zoom;
  return { translateX, translateY, scale: target.zoom };
}

/**
 * Interpolate between two camera targets over a frame range.
 */
function lerpTarget(from: CameraTarget, to: CameraTarget, t: number): CameraTarget {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

/**
 * Given the current frame and a sorted keyframe timeline, return the
 * interpolated camera target for this frame.
 */
export function interpolateCamera(
  frame: number,
  keyframes: CameraKeyframe[],
): CameraTarget {
  if (keyframes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // Before first keyframe — snap to first
  if (frame <= keyframes[0].frame) {
    return keyframes[0].target;
  }

  // After last keyframe — snap to last
  if (frame >= keyframes[keyframes.length - 1].frame) {
    return keyframes[keyframes.length - 1].target;
  }

  // Find the two keyframes we're between
  for (let i = 0; i < keyframes.length - 1; i++) {
    const curr = keyframes[i];
    const next = keyframes[i + 1];

    if (frame >= curr.frame && frame <= next.frame) {
      const t = interpolate(
        frame,
        [curr.frame, next.frame],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAMERA_EASE },
      );
      return lerpTarget(curr.target, next.target, t);
    }
  }

  return keyframes[keyframes.length - 1].target;
}

/**
 * Create a camera target centered on a node position at a given zoom.
 */
export function targetNode(pos: NodePos, zoom: number): CameraTarget {
  return { x: pos.x, y: pos.y, zoom };
}
