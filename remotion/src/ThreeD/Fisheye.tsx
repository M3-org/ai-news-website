/**
 * Fisheye.tsx — React component wrapper for FisheyeEffect.
 *
 * Usage in EffectComposer:
 *   <Fisheye strength={-0.5} zoom={1.0} />
 *
 * Strength can be driven by FOV or velocity for dynamic distortion.
 */
import { forwardRef, useMemo } from "react";
import { FisheyeEffect, type FisheyeEffectOptions } from "./FisheyeEffect";

export const Fisheye = forwardRef<FisheyeEffect, FisheyeEffectOptions>(
  ({ strength = -0.5, zoom = 1.0 }, ref) => {
    const effect = useMemo(() => new FisheyeEffect({ strength, zoom }), []);

    // Update uniforms when props change
    effect.strength = strength;
    effect.zoom = zoom;

    return <primitive ref={ref} object={effect} />;
  }
);

Fisheye.displayName = "Fisheye";
