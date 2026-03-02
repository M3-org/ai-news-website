/**
 * FisheyeEffect.ts — Barrel distortion post-processing effect.
 *
 * Creates a fisheye lens look by applying radial distortion.
 * Strength can be animated/modulated (e.g., by FOV or velocity).
 */
import { Effect } from "postprocessing";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
uniform float strength;
uniform float zoom;

void mainUv(inout vec2 uv) {
  // Center UV at origin
  vec2 centered = uv - 0.5;

  // Distance from center
  float r = length(centered);

  // Barrel distortion: r' = r * (1 + k * r²)
  // Negative strength = barrel (fisheye), positive = pincushion
  float distorted = r * (1.0 + strength * r * r);

  // Apply distortion and zoom
  vec2 direction = centered / max(r, 0.0001);
  uv = 0.5 + direction * distorted * zoom;
}
`;

export interface FisheyeEffectOptions {
  /** Distortion strength. Negative = barrel/fisheye, positive = pincushion. Default: -0.5 */
  strength?: number;
  /** Zoom factor to compensate for edge stretching. Default: 1.0 */
  zoom?: number;
}

export class FisheyeEffect extends Effect {
  constructor({ strength = -0.5, zoom = 1.0 }: FisheyeEffectOptions = {}) {
    super("FisheyeEffect", fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ["strength", new Uniform(strength)],
        ["zoom", new Uniform(zoom)],
      ]),
    });
  }

  get strength(): number {
    return this.uniforms.get("strength")!.value as number;
  }

  set strength(value: number) {
    this.uniforms.get("strength")!.value = value;
  }

  get zoom(): number {
    return this.uniforms.get("zoom")!.value as number;
  }

  set zoom(value: number) {
    this.uniforms.get("zoom")!.value = value;
  }
}
