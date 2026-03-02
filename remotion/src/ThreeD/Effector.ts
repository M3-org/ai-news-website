/**
 * Effector.ts — Pure math module (no React dependency).
 *
 * Implements a MoGraph-style effector field: a spherical zone around a point
 * (typically the camera) that drives animation weights on nearby objects.
 * Objects inside innerRadius get full effect, outside outerRadius get none,
 * and the transition uses hermite smoothstep for derivative-continuous falloff.
 */
import { Box3, Object3D, Vector3 } from "three";

/** Configuration for the effector field, exposed as Remotion Studio sliders. */
export interface EffectorConfig {
  /** Distance from effector center where effect is at full strength. */
  innerRadius: number;
  /** Distance beyond which the effect is zero. Must be > innerRadius. */
  outerRadius: number;
  /** Global multiplier applied to the final weight (0 = disabled, 1 = normal). */
  strength: number;
}

// Module-level scratch vectors — reused every frame to avoid allocating
// new Vector3 objects on the heap (reduces GC pauses in render loops).
const _worldPos = new Vector3();
const _effectorPos = new Vector3();

/**
 * Hermite smoothstep falloff (aka Elendt smoothstep).
 *
 * Returns 1.0 when distance <= innerRadius (full effect zone),
 * returns 0.0 when distance >= outerRadius (no effect),
 * and interpolates via 1 - t²(3 - 2t) in between.
 *
 * The key property: zero first derivative at both endpoints,
 * so there's no visible "pop" when objects enter or leave the field.
 */
export function smoothstepFalloff(
  distance: number,
  innerRadius: number,
  outerRadius: number,
): number {
  if (outerRadius <= innerRadius) return distance <= innerRadius ? 1 : 0; // Guard against NaN
  if (distance <= innerRadius) return 1; // Inside full-effect zone
  if (distance >= outerRadius) return 0; // Outside field entirely
  // Normalize distance into [0, 1] range between the two radii
  const t = (distance - innerRadius) / (outerRadius - innerRadius);
  // Classic hermite: smooth transition with zero slope at t=0 and t=1
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Compute the effector weight for a single Object3D.
 * Returns a value in [0, strength] based on distance from effectorPos.
 */
export function computeWeight(
  object: Object3D,
  effectorPos: Vector3,
  config: EffectorConfig,
): number {
  object.getWorldPosition(_worldPos);
  const distance = _worldPos.distanceTo(effectorPos);
  if (!Number.isFinite(distance)) return 0;
  if (!Number.isFinite(config.innerRadius) || !Number.isFinite(config.outerRadius) || !Number.isFinite(config.strength)) {
    return 0;
  }
  return smoothstepFalloff(distance, config.innerRadius, config.outerRadius) * config.strength;
}

/**
 * Effect types correspond to how the effector weight drives the animation.
 * - "rotate": continuous rotation whose speed scales with weight
 * - "scale":  lerp between minScale and maxScale based on weight
 * - "both":   rotation + scale combined
 * - "pop":    spring-based reveal (scale 0→1 with overshoot + Y slide)
 */
export type EffectType = "rotate" | "scale" | "both" | "reveal" | "burn" | "noise" | "flock" | "glow" | "hologram" | "holoReveal" | "fader" | "rim" | "custom" | "customLoop" | "customLoopNoMod" | "customPingPong" | "lookAt";

/** Per-object overrides — anything not set falls back to the global useEffector defaults. */
export interface EffectOverrides {
  /** Override global innerRadius for this object. */
  innerRadius?: number;
  /** Override global outerRadius for this object. */
  outerRadius?: number;
  /** Multiplier on effector weight (0 = immune, 1 = normal, 2 = double response). */
  effectStrength?: number;
  /** Rotation axes: "x", "y", "z", "xy", "xz", "yz", "xyz" */
  rotationAxis?: string;
  rotationSpeed?: number;
  /** If true, object always rotates — effector weight modulates speed on top (default false). */
  constantRotation?: boolean;
  /** Position noise axes: "x", "y", "z", "xy", "xz", "yz", "xyz" */
  noiseAxis?: string;
  /** Max displacement in world units at full weight (default 0.1) */
  noiseAmount?: number;
  /** How fast the noise changes per frame (default 0.05) */
  noiseSpeed?: number;
  /** Which transforms to noise: "p" = position, "s" = scale, "r" = rotation, combine: "ps", "psr" (default "p"). */
  noiseParam?: string;
  /** Noise contrast — sharpens peaks and flattens valleys. 1 = linear (default), 2+ = punchy, 0.5 = soft. */
  noiseContrast?: number;
  minScale?: number;
  maxScale?: number;
  popDelay?: number;
  /** Target mode: 0 = self (animate this node), 1 = all descendant meshes, undefined = direct children. */
  deep?: number;
  /** Frames of lag between successive children for flock effect (default 3). */
  flockDelay?: number;
  /** Burn edge brightness — values above 1 trigger Bloom (default 3). */
  burnIntensity?: number;
  /** Glow emissive intensity at full weight (default 2). */
  glowIntensity?: number;
  /** Glow color hex string (default "#ffffff"). */
  glowColor?: string;
  /** Hologram scan edge brightness for Bloom (default 4). */
  holoIntensity?: number;
  /** Hologram scan color hex (default "#88ccff"). */
  holoColor?: string;
  /** Hologram scan speed — world units per frame (default 0.02). */
  holoSpeed?: number;
  /** Distance threshold that triggers hologram build (default 5). Binary switch — no modulation. */
  holoTriggerDist?: number;
  /** Start hologram at this frame regardless of trigger distance. Overrides trigger. */
  holoStart?: number;
  /** If true, scanY is driven by effector weight (0→1 sweeps bottom→top). Default false = trigger mode. */
  holoModulated?: boolean;
  /** If true, scan dissolves OUT (exit transition). Default false = entrance. */
  holoReverse?: boolean;
  /** Rim glow color hex string (default "#ffffff"). */
  rimColor?: string;
  /** Rim brightness — values > 1 trigger Bloom (default 2). */
  rimIntensity?: number;
  /** Fresnel exponent — higher = thinner rim (default 2). */
  rimPower?: number;
  /** Speed multiplier for customLoop/customPingPong (default 1 = real-time at 60fps). */
  customSpeed?: number;
  /** Custom animation remap exponent (1 = linear, >1 = ease-in, <1 = ease-out). */
  customEase?: number;
  /** If true, invert the effector weight for this object (1 - weight). Objects far from the effector get full effect. */
  invert?: boolean;
}

export interface EffectableGroup {
  group: Object3D;
  effectTypes: EffectType[];
  /** Per-group config overrides (from effectMap or Blender custom properties). */
  overrides: EffectOverrides;
}

/** Valid effect keywords */
const KEYWORD_MAP: Record<string, EffectType> = {
  ROTATE: "rotate",
  SCALE: "scale",
  BOTH: "both",
  REVEAL: "reveal",
  BURN: "burn",
  NOISE: "noise",
  FLOCK: "flock",
  GLOW: "glow",
  HOLOGRAM: "hologram",
  HOLOREVEAL: "holoReveal",
  FADER: "fader",
  RIM: "rim",
  CUSTOM: "custom",
  CUSTOMLOOP: "customLoop",
  CUSTOMLOOPNOMOD: "customLoopNoMod",
  CUSTOMPINGPONG: "customPingPong",
  LOOKAT: "lookAt",
};

/**
 * Remotion-side effect assignment + per-object config.
 * Keys are Blender object names (exact match).
 *
 * Short form (just effects):
 *   "GearAssembly": ["rotate"]
 *
 * Full form (effects + overrides):
 *   "GearAssembly": {
 *     effects: ["rotate"],
 *     rotationAxis: "xyz",
 *     rotationSpeed: 0.05,
 *   }
 *
 * Example:
 * ```ts
 * {
 *   "Chair.001":     { effects: ["reveal", "burn"], popDelay: 3 },
 *   "GearAssembly":  { effects: ["rotate"], rotationAxis: "xyz", rotationSpeed: 0.05 },
 *   "Logo":          ["burn"],
 *   "BigGear":       { effects: ["rotate"], rotationAxis: "y" },
 * }
 * ```
 */
export type EffectMapEntry = EffectType[] | (EffectOverrides & { effects: EffectType[] });
export type EffectMap = Record<string, EffectMapEntry>;

/** Parse a comma-separated or space-separated effect string into EffectType[] */
function parseEffectString(str: string): EffectType[] {
  const effects: EffectType[] = [];
  const tokens = str.toUpperCase().split(/[\s,_]+/);
  for (const token of tokens) {
    const effect = KEYWORD_MAP[token.trim()];
    if (effect !== undefined && !effects.includes(effect)) {
      effects.push(effect);
    }
  }
  return effects;
}

/** Expand the "both" shorthand into rotate + scale */
function expandBoth(types: EffectType[]): EffectType[] {
  if (!types.includes("both")) return types;
  const result = types.filter((t) => t !== "both");
  if (!result.includes("rotate")) result.push("rotate");
  if (!result.includes("scale")) result.push("scale");
  return result;
}

/** Read Blender custom properties into overrides */
function readBlenderOverrides(userData: Record<string, any>): EffectOverrides {
  const o: EffectOverrides = {};
  if (typeof userData.innerRadius === "number") o.innerRadius = userData.innerRadius;
  if (typeof userData.outerRadius === "number") o.outerRadius = userData.outerRadius;
  if (typeof userData.effectStrength === "number") o.effectStrength = userData.effectStrength;
  if (typeof userData.rotationAxis === "string") o.rotationAxis = userData.rotationAxis;
  if (typeof userData.rotationSpeed === "number") o.rotationSpeed = userData.rotationSpeed;
  if (typeof userData.constantRotation === "number") o.constantRotation = userData.constantRotation > 0.5;
  if (typeof userData.noiseAxis === "string") o.noiseAxis = userData.noiseAxis;
  if (typeof userData.noiseAmount === "number") o.noiseAmount = userData.noiseAmount;
  if (typeof userData.noiseSpeed === "number") o.noiseSpeed = userData.noiseSpeed;
  if (typeof userData.noiseParam === "string") o.noiseParam = userData.noiseParam;
  if (typeof userData.noiseContrast === "number") o.noiseContrast = userData.noiseContrast;
  if (typeof userData.minScale === "number") o.minScale = userData.minScale;
  if (typeof userData.maxScale === "number") o.maxScale = userData.maxScale;
  if (typeof userData.popDelay === "number") o.popDelay = userData.popDelay;
  if (typeof userData.deep === "number") o.deep = userData.deep;
  if (typeof userData.flockDelay === "number") o.flockDelay = userData.flockDelay;
  if (typeof userData.burnIntensity === "number") o.burnIntensity = userData.burnIntensity;
  if (typeof userData.glowIntensity === "number") o.glowIntensity = userData.glowIntensity;
  if (typeof userData.glowColor === "string") o.glowColor = userData.glowColor;
  if (typeof userData.holoIntensity === "number") o.holoIntensity = userData.holoIntensity;
  if (typeof userData.holoColor === "string") o.holoColor = userData.holoColor;
  if (typeof userData.holoSpeed === "number") o.holoSpeed = userData.holoSpeed;
  if (typeof userData.holoTriggerDist === "number") o.holoTriggerDist = userData.holoTriggerDist;
  if (typeof userData.holoStart === "number") o.holoStart = userData.holoStart;
  if (typeof userData.holoModulated === "number") o.holoModulated = userData.holoModulated > 0.5;
  if (typeof userData.holoReverse === "number") o.holoReverse = userData.holoReverse > 0.5;
  if (typeof userData.rimColor === "string") o.rimColor = userData.rimColor;
  if (typeof userData.rimIntensity === "number") o.rimIntensity = userData.rimIntensity;
  if (typeof userData.rimPower === "number") o.rimPower = userData.rimPower;
  if (typeof userData.customSpeed === "number") o.customSpeed = userData.customSpeed;
  if (typeof userData.customEase === "number") o.customEase = userData.customEase;
  if (typeof userData.invert === "number") o.invert = userData.invert > 0.5;
  return o;
}

/**
 * Discover effectable groups from GLTF nodes.
 *
 *   1. **effectMap** (Remotion-side) — explicit JS object mapping names to effects.
 *   2. **Custom property** (Blender-side) — `effects` property on the object.
 *
 * Object names are NOT parsed for keywords — naming is free-form.
 */
export function findEffectableGroups(
  nodes: Record<string, Object3D>,
  effectMap?: EffectMap,
): EffectableGroup[] {
  const groups: EffectableGroup[] = [];

  for (const [name, node] of Object.entries(nodes)) {
    let effectTypes: EffectType[] = [];
    let overrides: EffectOverrides = {};

    // Priority 1: Remotion-side effect map
    if (effectMap && effectMap[name]) {
      const entry = effectMap[name];
      if (Array.isArray(entry)) {
        effectTypes = [...entry];
      } else {
        effectTypes = [...entry.effects];
        const { effects: _, ...rest } = entry;
        overrides = rest;
      }
    }
    // Priority 2: Blender custom property "effects"
    else if (node.userData?.effects && typeof node.userData.effects === "string") {
      effectTypes = parseEffectString(node.userData.effects);
      overrides = readBlenderOverrides(node.userData);
    }

    effectTypes = expandBoth(effectTypes);

    if (effectTypes.length > 0) {
      groups.push({ group: node, effectTypes, overrides });
    }
  }

  // Sort by depth: children process first, parents last.
  // This ensures parent effects (e.g. holoReverse on a stage group)
  // override child effects (e.g. entrance holoReveal on sub-groups).
  groups.sort((a, b) => getDepth(b.group) - getDepth(a.group));

  return groups;
}

/**
 * Scene effector source — any object with `_EFFECTOR` in its name.
 * Radii derived from bounding box. Animated via Blender keyframes
 * (customLoopNoMod), acts as a secondary effector center alongside the camera.
 */
export interface EffectorSource {
  object: Object3D;
  config: EffectorConfig;
}

/**
 * Discover scene effector sources from GLTF nodes.
 * Any object whose name contains `_EFFECTOR` becomes an effector source.
 * Radii are derived from the object's bounding box:
 *   innerRadius = half the smallest dimension (inscribed sphere → full effect zone)
 *   outerRadius = half the diagonal (circumscribed sphere → fade-to-zero boundary)
 * Optional `effectStrength` custom property overrides the default strength of 1.
 */
export function findEffectorSources(nodes: Record<string, Object3D>): EffectorSource[] {
  const sources: EffectorSource[] = [];
  for (const [, node] of Object.entries(nodes)) {
    if (!node.name.includes("_EFFECTOR")) continue;

    // Derive radii from bounding box
    const box = new Box3().setFromObject(node);
    const size = box.getSize(new Vector3());
    const innerRadius = Math.min(size.x, size.y, size.z) / 2;
    const outerRadius = size.length() / 2; // half-diagonal

    sources.push({
      object: node,
      config: {
        innerRadius,
        outerRadius: Math.max(outerRadius, innerRadius + 0.01), // safety
        strength: typeof node.userData.effectStrength === "number"
          ? node.userData.effectStrength : 1,
      },
    });
  }
  return sources;
}

/** Count ancestors to determine depth in the scene hierarchy. */
function getDepth(obj: Object3D): number {
  let depth = 0;
  let current = obj.parent;
  while (current) {
    depth++;
    current = current.parent;
  }
  return depth;
}

/**
 * Get the camera world position into a reusable vector.
 * Call scene.updateMatrixWorld(true) before this for accuracy.
 */
export function getCameraWorldPosition(camera: Object3D): Vector3 {
  camera.getWorldPosition(_effectorPos);
  return _effectorPos;
}
