/**
 * useEffector.ts — React hook that bridges Effector math with the R3F scene.
 *
 * Two-phase processing:
 *   Phase 1: Collect all target meshes, store base transforms, reset to base every frame.
 *   Phase 2: Apply effects in TOKEN ORDER (artist controls via effects string).
 *            All transforms are additive (position/rotation) or multiplicative (scale).
 *            Multiple groups can target the same mesh — effects compose cleanly.
 */
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getRemotionEnvironment, useCurrentFrame, interpolate } from "remotion";
import { MathUtils, Mesh, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, Box3, Vector3, Quaternion, Color, AnimationClip } from "three";
import type { Object3D } from "three";
import {
  type EffectorConfig,
  type EffectableGroup,
  type EffectMap,
  type EffectOverrides,
  type EffectorSource,
  computeWeight,
  findEffectableGroups,
  findEffectorSources,
  getCameraWorldPosition,
} from "./Effector";
import { createMaterializeMaterial } from "./MaterializeMaterial";
import { createHologramMaterial } from "./HologramMaterial";
import { createRimMaterial } from "./RimMaterial";

/** Scratch vectors / quaternions — reused every frame to avoid GC */
const _triggerPos = new Vector3();
const _lookAtPos = new Vector3();
const _baseQuat = new Quaternion();
const _lookQuat = new Quaternion();
const _srcPos = new Vector3();

/**
 * Compute weight with per-object overrides for innerRadius, outerRadius, effectStrength.
 * Falls back to global config when overrides are not set.
 */
function computeWeightWithOverrides(
  object: Object3D,
  effectorPos: Vector3,
  config: EffectorConfig,
  overrides: EffectOverrides,
): number {
  const effectiveConfig: EffectorConfig = {
    innerRadius: overrides.innerRadius ?? config.innerRadius,
    outerRadius: overrides.outerRadius ?? config.outerRadius,
    strength: config.strength,
  };
  let weight = computeWeight(object, effectorPos, effectiveConfig);
  if (overrides.invert) weight = 1 - weight;
  const multiplier = overrides.effectStrength ?? 1;
  return weight * multiplier;
}

/**
 * Smooth deterministic noise in [-1, 1].
 * Layered sines with irrational frequency ratios per channel — never sync up.
 */
const CH_FREQS: Record<string, [number, number, number]> = {
  x:  [1.0,  2.31, 4.13],
  y:  [0.73, 1.87, 3.71],
  z:  [1.17, 2.63, 4.91],
  s:  [0.61, 1.53, 3.37],
  rx: [0.89, 2.11, 3.97],
  ry: [1.07, 2.47, 4.31],
  rz: [0.67, 1.73, 4.57],
};

function smoothNoise(t: number, seed: number, channel = "y"): number {
  const f = CH_FREQS[channel] ?? CH_FREQS.y;
  return (
    Math.sin(t * f[0] + seed) * 0.5 +
    Math.sin(t * f[1] + seed * 1.7) * 0.3 +
    Math.sin(t * f[2] + seed * 2.9) * 0.2
  );
}

/** Apply contrast curve — sign-preserving power function. */
function applyContrast(value: number, contrast: number): number {
  if (contrast === 1) return value;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.pow(Math.abs(value), contrast);
}

/** Extract diffuse color from a material. */
function getBaseColor(mat: MeshStandardMaterial | MeshBasicMaterial): string {
  return mat.color ? "#" + mat.color.getHexString() : "#aaaaaa";
}

/** Extract emissive color + intensity (for prebaked scenes). */
function getEmissive(mat: MeshStandardMaterial | MeshBasicMaterial): { color: string; intensity: number } {
  if (mat instanceof MeshStandardMaterial && mat.emissive) {
    return { color: "#" + mat.emissive.getHexString(), intensity: mat.emissiveIntensity ?? 1 };
  }
  return { color: "#000000", intensity: 0 };
}

/** Extract the best texture from a material — prefers emissiveMap for prebaked scenes. */
function getBaseMap(mat: MeshStandardMaterial | MeshBasicMaterial) {
  return (mat instanceof MeshStandardMaterial ? mat.emissiveMap : null) ?? mat.map ?? null;
}

interface MaterialProfile {
  baseColor: string;
  emissiveColor: string;
  emissiveIntensity: number;
  map: ReturnType<typeof getBaseMap>;
  opacity: number;
  transparent: boolean;
  alphaTest: number;
  side: MeshStandardMaterial["side"] | MeshBasicMaterial["side"];
  unlit: boolean;
}

function getMaterialProfile(mat: MeshStandardMaterial | MeshBasicMaterial): MaterialProfile {
  const emissive = getEmissive(mat);
  const preferredMap =
    mat.map ?? (mat instanceof MeshStandardMaterial ? mat.emissiveMap ?? null : null);

  return {
    baseColor: getBaseColor(mat),
    emissiveColor: emissive.color,
    emissiveIntensity: emissive.intensity,
    map: preferredMap,
    opacity: mat.opacity ?? 1,
    transparent:
      Boolean(mat.transparent) ||
      (mat.opacity != null && mat.opacity < 1) ||
      (mat.alphaTest ?? 0) > 0,
    alphaTest: mat.alphaTest ?? 0,
    side: mat.side,
    unlit:
      mat instanceof MeshBasicMaterial ||
      (mat instanceof MeshStandardMaterial && !!mat.emissiveMap && !mat.map),
  };
}

/** Get targets for a group based on deep setting */
function getTargets(group: Object3D, deep: number | undefined): Object3D[] {
  if (deep === 0) return [group];
  if (deep === 1) {
    const t: Object3D[] = [];
    group.traverse((obj) => { if ((obj as Mesh).isMesh) t.push(obj); });
    return t;
  }
  return group.children.length > 0 ? [...group.children] : [group];
}

/** Store base transforms once, reset every frame */
interface BaseTransform {
  px: number; py: number; pz: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
}

function storeAndReset(child: Object3D) {
  if (child.userData._base === undefined) {
    child.userData._base = {
      px: child.position.x, py: child.position.y, pz: child.position.z,
      rx: child.rotation.x, ry: child.rotation.y, rz: child.rotation.z,
      sx: child.scale.x, sy: child.scale.y, sz: child.scale.z,
    } as BaseTransform;
  }
  const b = child.userData._base as BaseTransform;
  child.position.set(b.px, b.py, b.pz);
  child.rotation.set(b.rx, b.ry, b.rz);
  child.scale.set(b.sx, b.sy, b.sz);
}

/** Collect all descendant object names (for clip-to-group matching). */
function getDescendantNames(obj: Object3D): Set<string> {
  const names = new Set<string>();
  obj.traverse((child) => { if (child.name) names.add(child.name); });
  return names;
}


interface UseEffectorOptions {
  nodes: Record<string, Object3D>;
  config: EffectorConfig;
  rotationSpeed?: number;
  rotationAxis?: "x" | "y" | "z";
  noiseAxis?: string;
  noiseAmount?: number;
  noiseSpeed?: number;
  minScale?: number;
  maxScale?: number;
  popDelay?: number;
  effectMap?: EffectMap;
  /** GLTF animation clips (for custom/customLoop/customPingPong effects). */
  animations?: AnimationClip[];
  /** GLTF scene root (needed for track resolution). */
  gltfScene?: Object3D;
}

export function useEffector({
  nodes,
  config,
  rotationSpeed = 0.02,
  rotationAxis = "x",
  noiseAxis = "y",
  noiseAmount = 0.1,
  noiseSpeed = 0.05,
  minScale = 1,
  maxScale = 1.5,
  popDelay = 2,
  effectMap,
  animations,
  gltfScene,
}: UseEffectorOptions): Set<string> {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const frame = useCurrentFrame();
  const isRendering = getRemotionEnvironment().isRendering;

  const effectableGroups: EffectableGroup[] = useMemo(
    () => findEffectableGroups(nodes, effectMap),
    [nodes, effectMap],
  );

  // Discover scene effector sources (objects with _EFFECTOR in their name).
  // Must be before animBindings so effectorAnimBindings can reference it.
  const effectorSources: EffectorSource[] = useMemo(
    () => findEffectorSources(nodes),
    [nodes],
  );

  // Direct track sampling — no AnimationMixer, no action state.
  // Pre-builds interpolants per track for each group with custom effects.
  interface TrackBinding {
    target: Object3D;
    property: "position" | "quaternion" | "scale";
    interpolant: { evaluate(t: number): Float32Array; resultBuffer: Float32Array };
  }
  interface ClipBinding { duration: number; tracks: TrackBinding[] }

  const animBindings = useMemo(() => {
    if (!animations?.length || !gltfScene) return null;

    const groupMap = new Map<Object3D, ClipBinding[]>();

    for (const eg of effectableGroups) {
      const hasCustom = eg.effectTypes.some(
        (t) => t === "custom" || t === "customLoop" || t === "customLoopNoMod" || t === "customPingPong",
      );
      if (!hasCustom) continue;

      const names = getDescendantNames(eg.group);
      const clips: ClipBinding[] = [];

      for (const clip of animations) {
        const bindings: TrackBinding[] = [];

        for (const track of clip.tracks) {
          const dotIdx = track.name.lastIndexOf(".");
          const objectPath = dotIdx >= 0 ? track.name.substring(0, dotIdx) : track.name;
          const property = dotIdx >= 0 ? track.name.substring(dotIdx + 1) : "";

          // Check if track targets a descendant of this group
          const parts = objectPath.split("/");
          if (!parts.some((p) => names.has(p))) continue;

          // Resolve target object
          const finalName = parts[parts.length - 1];
          const target = gltfScene.getObjectByName(finalName);
          if (!target) continue;
          if (property !== "position" && property !== "quaternion" && property !== "scale") continue;

          bindings.push({
            target,
            property,
            interpolant: (track as any).createInterpolant() as TrackBinding["interpolant"],
          });
        }

        if (bindings.length > 0) {
          clips.push({ duration: clip.duration, tracks: bindings });
        }
      }

      if (clips.length > 0) groupMap.set(eg.group, clips);
    }

    return groupMap.size > 0 ? groupMap : null;
  }, [effectableGroups, animations, gltfScene]);

  // Auto-animate effector sources — no effect tag needed.
  // Effector objects with animations loop automatically (customLoopNoMod behavior).
  // Skips sources that already have explicit custom effects assigned.
  const effectorAnimBindings = useMemo(() => {
    if (!animations?.length || !gltfScene || effectorSources.length === 0) return null;

    // Skip effector sources that already have custom effects (handled by animBindings)
    const customGroups = new Set<Object3D>();
    for (const eg of effectableGroups) {
      if (eg.effectTypes.some((t) => t === "custom" || t === "customLoop" || t === "customLoopNoMod" || t === "customPingPong")) {
        customGroups.add(eg.group);
      }
    }

    const bindings = new Map<Object3D, ClipBinding[]>();

    for (const src of effectorSources) {
      if (customGroups.has(src.object)) continue;

      const names = getDescendantNames(src.object);
      const clips: ClipBinding[] = [];

      for (const clip of animations) {
        const trackBindings: TrackBinding[] = [];

        for (const track of clip.tracks) {
          const dotIdx = track.name.lastIndexOf(".");
          const objectPath = dotIdx >= 0 ? track.name.substring(0, dotIdx) : track.name;
          const property = dotIdx >= 0 ? track.name.substring(dotIdx + 1) : "";

          const parts = objectPath.split("/");
          if (!parts.some((p) => names.has(p))) continue;

          const finalName = parts[parts.length - 1];
          const target = gltfScene.getObjectByName(finalName);
          if (!target) continue;
          if (property !== "position" && property !== "quaternion" && property !== "scale") continue;

          trackBindings.push({
            target,
            property,
            interpolant: (track as any).createInterpolant() as TrackBinding["interpolant"],
          });
        }

        if (trackBindings.length > 0) {
          clips.push({ duration: clip.duration, tracks: trackBindings });
        }
      }

      if (clips.length > 0) bindings.set(src.object, clips);
    }

    return bindings.size > 0 ? bindings : null;
  }, [effectorSources, effectableGroups, animations, gltfScene]);

  // Precise set of object names managed by the effector (for external filtering).
  // Includes: resetSet targets, Phase 1.5 track targets, Phase 1.5b track targets, Camera.
  const managedNames = useMemo(() => {
    const names = new Set<string>();
    for (const { group, overrides, effectTypes } of effectableGroups) {
      for (const t of getTargets(group, overrides.deep)) { if (t.name) names.add(t.name); }
      if (effectTypes.includes("flock")) {
        group.traverse((obj) => { if ((obj as Mesh).isMesh && obj.name) names.add(obj.name); });
      }
    }
    for (const src of effectorSources) { if (src.object.name) names.add(src.object.name); }
    if (animBindings) {
      for (const [, clips] of animBindings) {
        for (const { tracks } of clips) { for (const { target } of tracks) { if (target.name) names.add(target.name); } }
      }
    }
    if (effectorAnimBindings) {
      for (const [, clips] of effectorAnimBindings) {
        for (const { tracks } of clips) { for (const { target } of tracks) { if (target.name) names.add(target.name); } }
      }
    }
    names.add("Camera");
    return names;
  }, [effectableGroups, effectorSources, animBindings, effectorAnimBindings]);

  scene.updateMatrixWorld(true);
  const effectorPos = getCameraWorldPosition(camera);

  // Multi-source weight: max weight across camera + all scene effector sources.
  // Any effector (camera or scene object) can activate effects on nearby objects.
  function multiWeight(object: Object3D, overrides: EffectOverrides): number {
    let w = computeWeightWithOverrides(object, effectorPos, config, overrides);
    for (const src of effectorSources) {
      src.object.getWorldPosition(_srcPos);
      const sw = computeWeightWithOverrides(object, _srcPos, src.config, overrides);
      if (sw > w) w = sw;
    }
    return w;
  }

  // ===== Phase 1: Reset all target meshes to base transforms =====
  const resetSet = new Set<Object3D>();
  for (const { group, overrides, effectTypes } of effectableGroups) {
    for (const t of getTargets(group, overrides.deep)) resetSet.add(t);
    if (effectTypes.includes("flock")) {
      group.traverse((obj) => { if ((obj as Mesh).isMesh) resetSet.add(obj); });
    }
  }
  // Also reset effector source objects (their animation is reapplied in Phase 1.5)
  for (const src of effectorSources) resetSet.add(src.object);
  for (const child of resetSet) {
    storeAndReset(child);
    // Reset materials to original — ensures shader effects don't persist across frames
    child.traverse((obj) => {
      if ((obj as Mesh).isMesh && obj.userData._originalMaterial) {
        (obj as Mesh).material = obj.userData._originalMaterial;
      }
    });
  }

  // ===== Phase 1.5: Apply keyframe animations via direct track sampling =====
  // No AnimationMixer — just evaluate interpolants and write to objects.
  if (animBindings) {
    for (const { group, effectTypes, overrides } of effectableGroups) {
      const clips = animBindings.get(group);
      if (!clips) continue;

      const speed = overrides.customSpeed ?? 1;

      for (const { duration, tracks } of clips) {
        if (!Number.isFinite(duration) || duration <= 0) continue;
        let t: number;

        if (effectTypes.includes("custom")) {
          // Weight-as-speed: effector modulates how FAST the animation advances.
          // Closer = faster progress. Starts from 0, accumulates, never rewinds.
          let maxWeight = 0;
          for (const { target } of tracks) {
            maxWeight = Math.max(maxWeight, multiWeight(target, overrides));
          }
          const weight = Math.min(Math.max(maxWeight, 0), 1);

          const latchKey = "_customLatch";
          const fKey = "_customFrame";
          const prevFrame = (group.userData[fKey] as number) ?? -1;
          // Reset on seek back or timeline restart
          if (frame < prevFrame || frame === 0) group.userData[latchKey] = 0;

          const dt = Math.max(0, frame - Math.max(prevFrame, 0)) / 60; // seconds since last frame
          group.userData[fKey] = frame;

          const prev = (group.userData[latchKey] as number) ?? 0;
          const progress = Math.min(1, prev + weight * dt * speed);
          group.userData[latchKey] = progress;

          t = progress * duration;

        } else if (effectTypes.includes("customLoop")) {
          // Weight-as-speed like custom, but loops instead of clamping at 1.
          let maxWeight = 0;
          for (const { target } of tracks) {
            maxWeight = Math.max(maxWeight, multiWeight(target, overrides));
          }
          const weight = Math.min(Math.max(maxWeight, 0), 1);

          const latchKey = "_customLoopLatch";
          const fKey = "_customLoopFrame";
          const prevFrame = (group.userData[fKey] as number) ?? -1;
          if (frame < prevFrame || frame === 0) group.userData[latchKey] = 0;

          const dt = Math.max(0, frame - Math.max(prevFrame, 0)) / 60;
          group.userData[fKey] = frame;

          const prev = (group.userData[latchKey] as number) ?? 0;
          const progress = (prev + weight * dt * speed) % 1;
          group.userData[latchKey] = progress;

          t = progress * duration;

        } else if (effectTypes.includes("customLoopNoMod")) {
          t = ((frame / 60) * speed) % duration;

        } else if (effectTypes.includes("customPingPong")) {
          const raw = ((frame / 60) * speed) % (duration * 2);
          t = raw <= duration ? raw : duration * 2 - raw;
        } else {
          continue;
        }

        // Write sampled values directly to objects
        for (const { target, property, interpolant } of tracks) {
          interpolant.evaluate(t);
          const buf = interpolant.resultBuffer;
          if (property === "position") {
            if (Number.isFinite(buf[0]) && Number.isFinite(buf[1]) && Number.isFinite(buf[2])) {
              target.position.set(buf[0], buf[1], buf[2]);
            }
          } else if (property === "quaternion") {
            if (Number.isFinite(buf[0]) && Number.isFinite(buf[1]) && Number.isFinite(buf[2]) && Number.isFinite(buf[3])) {
              target.quaternion.set(buf[0], buf[1], buf[2], buf[3]);
            }
          } else if (property === "scale") {
            if (Number.isFinite(buf[0]) && Number.isFinite(buf[1]) && Number.isFinite(buf[2])) {
              target.scale.set(buf[0], buf[1], buf[2]);
            }
          }
        }
      }
    }
  }

  // ===== Phase 1.5b: Auto-animate effector sources =====
  // Effector objects loop their animations automatically — no effect tag required.
  if (effectorAnimBindings) {
    for (const [obj, clips] of effectorAnimBindings) {
      const speed = typeof obj.userData.customSpeed === "number" ? obj.userData.customSpeed : 1;
      for (const { duration, tracks } of clips) {
        if (duration <= 0) continue;
        const t = ((frame / 60) * speed) % duration;
        for (const { target, property, interpolant } of tracks) {
          interpolant.evaluate(t);
          const buf = interpolant.resultBuffer;
          if (property === "position") target.position.set(buf[0], buf[1], buf[2]);
          else if (property === "quaternion") target.quaternion.set(buf[0], buf[1], buf[2], buf[3]);
          else if (property === "scale") target.scale.set(buf[0], buf[1], buf[2]);
        }
      }
    }
  }

  // ===== Phase 2: Apply effects in token order =====
  for (const { group, effectTypes, overrides } of effectableGroups) {
    const o = overrides;
    const rotAxes = (o.rotationAxis ?? rotationAxis).toLowerCase().split("") as ("x" | "y" | "z")[];
    const speed = o.rotationSpeed ?? rotationSpeed;
    const nAxes = (o.noiseAxis ?? noiseAxis).toLowerCase().split("") as ("x" | "y" | "z")[];
    const nAmount = o.noiseAmount ?? noiseAmount;
    const nSpeed = o.noiseSpeed ?? noiseSpeed;
    const nParam = (o.noiseParam ?? "p").toLowerCase();
    const nContrast = o.noiseContrast ?? 1;
    const sMin = o.minScale ?? minScale;
    const sMax = o.maxScale ?? maxScale;
    const delay = o.popDelay ?? popDelay;
    const constant = o.constantRotation ?? false;
    const deep = o.deep;

    const targets = getTargets(group, deep);

    // Process effects in the order they appear in the effects string.
    // Artist controls: "reveal, rotate" → reveal first, "rotate, reveal" → rotate first.
    for (const fx of effectTypes) {
      switch (fx) {

        // --- Rotate (additive from base) ---
        case "rotate":
          targets.forEach((child, index) => {
            const weight = multiWeight(child, o);
            for (const axis of rotAxes) {
              if (constant) {
                child.rotation[axis] += frame * speed * (1 + weight) + index * weight;
              } else {
                child.rotation[axis] += frame * speed * weight + index * weight;
              }
            }
          });
          break;

        // --- Noise (additive position/rotation, multiplicative scale) ---
        case "noise":
          targets.forEach((child, index) => {
            const weight = multiWeight(child, o);
            const t = frame * nSpeed;
            const seed = index * 17.3;

            if (nParam.includes("p")) {
              for (const axis of nAxes) {
                const n = applyContrast(smoothNoise(t, seed, axis), nContrast);
                child.position[axis] += n * nAmount * weight;
              }
            }
            if (nParam.includes("s")) {
              const n = applyContrast(smoothNoise(t, seed, "s"), nContrast);
              child.scale.multiplyScalar(1 + n * nAmount * weight);
            }
            if (nParam.includes("r")) {
              for (const axis of nAxes) {
                const n = applyContrast(smoothNoise(t, seed, "r" + axis), nContrast);
                child.rotation[axis] += n * nAmount * weight;
              }
            }
          });
          break;

        // --- Scale (multiplicative) ---
        case "scale":
          targets.forEach((child) => {
            const weight = multiWeight(child, o);
            child.scale.multiplyScalar(MathUtils.lerp(sMin, sMax, weight));
          });
          break;

        // --- Reveal (multiplicative scale, additive position) ---
        case "reveal":
          targets.forEach((child, index) => {
            const weight = multiWeight(child, o);
            const maxStagger = 0.35;
            const stagger = targets.length > 1
              ? (index / (targets.length - 1)) * maxStagger * delay
              : 0;
            const adjusted = Math.min(1, Math.max(0, (weight - stagger) / Math.max(0.05, 1 - stagger)));

            child.scale.multiplyScalar(adjusted);
            child.position.y += interpolate(adjusted, [0, 1], [-0.3, 0]);
          });
          break;

        // --- Glow ---
        case "glow":
          targets.forEach((child) => {
            const weight = multiWeight(child, o);
            const gIntensity = o.glowIntensity ?? 2;
            const gColor = o.glowColor ?? "#ffffff";
            child.traverse((obj) => {
              if ((obj as Mesh).isMesh) {
                const mesh = obj as Mesh;
                const mat = mesh.material;
                if (mat instanceof MeshStandardMaterial) {
                  if (mesh.userData._origEmissive === undefined) {
                    mesh.userData._origEmissive = mat.emissiveIntensity;
                    mesh.userData._origEmissiveColor = "#" + mat.emissive.getHexString();
                  }
                  mat.emissive.set(gColor);
                  mat.emissiveIntensity = (mesh.userData._origEmissive as number) + weight * gIntensity;
                }
              }
            });
          });
          break;

        // --- Burn ---
        case "burn":
          targets.forEach((child) => {
            const weight = multiWeight(child, o);
            const bIntensity = o.burnIntensity ?? 3;

            child.traverse((obj) => {
              if ((obj as Mesh).isMesh) {
                const mesh = obj as Mesh;

                if (!mesh.userData._burnMaterial) {
                  mesh.userData._originalMaterial = mesh.userData._originalMaterial ?? mesh.material;
                  const origMat = mesh.userData._originalMaterial as MeshStandardMaterial | MeshBasicMaterial;
                  const profile = getMaterialProfile(origMat);
                  mesh.userData._burnMaterial = createMaterializeMaterial({
                    burnIntensity: bIntensity,
                    map: profile.map,
                    baseColor: profile.baseColor,
                    emissiveColor: profile.emissiveColor,
                    emissiveIntensity: profile.emissiveIntensity,
                    opacity: profile.opacity,
                    transparent: profile.transparent,
                    alphaTest: profile.alphaTest,
                    side: profile.side,
                    unlit: profile.unlit,
                  });
                }
                const burnMat = mesh.userData._burnMaterial as ShaderMaterial;
                burnMat.uniforms.u_threshold.value = Math.max(0, Math.min(1, weight));
                burnMat.uniforms.u_burnIntensity.value = bIntensity;
                mesh.material = burnMat;
              }
            });
          });
          break;

        // --- Fader ---
        case "fader":
          targets.forEach((child) => {
            const weight = multiWeight(child, o);
            child.traverse((obj) => {
              if ((obj as Mesh).isMesh) {
                const mesh = obj as Mesh;
                const mat = mesh.material;
                if (mat instanceof MeshStandardMaterial || mat instanceof MeshBasicMaterial) {
                  if (mesh.userData._faderOrigColor === undefined) {
                    mesh.userData._faderOrigColor = "#" + mat.color.getHexString();
                    mesh.userData._faderOrigEmissive =
                      mat instanceof MeshStandardMaterial ? "#" + mat.emissive.getHexString() : null;
                    mesh.userData._faderOrigEmissiveIntensity =
                      mat instanceof MeshStandardMaterial ? mat.emissiveIntensity : 0;
                  }
                  mat.color.set(mesh.userData._faderOrigColor as string).multiplyScalar(weight);
                  if (mat instanceof MeshStandardMaterial && mesh.userData._faderOrigEmissive) {
                    mat.emissive.set(mesh.userData._faderOrigEmissive as string).multiplyScalar(weight);
                    mat.emissiveIntensity = (mesh.userData._faderOrigEmissiveIntensity as number) * weight;
                  }
                }
              }
            });
          });
          break;

        // rim is handled as a composite pass after the main loop (see below)

        // --- Hologram (Y-axis scan, trigger-based) ---
        case "hologram":
          applyHologram(targets, effectorPos, frame, o, config, false, multiWeight, effectorSources, isRendering);
          break;

        // --- holoReveal (absolute Z-axis scan for transitions) ---
        case "holoReveal":
          applyHologram(targets, effectorPos, frame, o, config, true, multiWeight, effectorSources, isRendering);
          break;

        // --- LookAt (slerp toward camera based on weight) ---
        case "lookAt":
          targets.forEach((child) => {
            const weight = multiWeight(child, o);
            if (weight <= 0) return;

            // Store current rotation as quaternion
            _baseQuat.copy(child.quaternion);

            // Compute lookAt quaternion — temporarily apply, capture, restore
            child.getWorldPosition(_lookAtPos);
            child.lookAt(effectorPos);
            _lookQuat.copy(child.quaternion);

            // Slerp from base to lookAt by weight
            _baseQuat.slerp(_lookQuat, weight);
            child.quaternion.copy(_baseQuat);
          });
          break;

        // custom/customLoop/customPingPong — handled in Phase 1.5 via direct track sampling
        case "custom":
        case "customLoop":
        case "customLoopNoMod":
        case "customPingPong":
          break;
      }
    }

    // --- Rim composite pass: injects rim glow into whatever shader is active ---
    if (effectTypes.includes("rim")) {
      const rIntensity = o.rimIntensity ?? 2;
      const rPower = o.rimPower ?? 2;
      const rCol = new Color(o.rimColor ?? "#ffffff");

      targets.forEach((child) => {
        const weight = multiWeight(child, o);
        child.traverse((obj) => {
          if ((obj as Mesh).isMesh) {
            const mesh = obj as Mesh;
            const mat = mesh.material;
            if (mat instanceof ShaderMaterial && mat.uniforms.u_rimGlowWeight) {
              // Composite onto existing shader material (burn / holo)
              mat.uniforms.u_rimGlowWeight.value = weight;
              mat.uniforms.u_rimGlowIntensity.value = rIntensity;
              mat.uniforms.u_rimGlowPower.value = rPower;
              (mat.uniforms.u_rimGlowColor.value as Vector3).set(rCol.r, rCol.g, rCol.b);
            } else if (mat instanceof MeshStandardMaterial || mat instanceof MeshBasicMaterial) {
              // No shader effect active — use standalone RimMaterial
              if (!mesh.userData._rimMaterial) {
                mesh.userData._originalMaterial = mesh.userData._originalMaterial ?? mesh.material;
                const origMat = mesh.userData._originalMaterial as MeshStandardMaterial | MeshBasicMaterial;
                const profile = getMaterialProfile(origMat);
                mesh.userData._rimMaterial = createRimMaterial({
                  rimColor: o.rimColor ?? "#ffffff",
                  rimIntensity: rIntensity,
                  rimPower: rPower,
                  map: profile.map,
                  baseColor: profile.baseColor,
                  emissiveColor: profile.emissiveColor,
                  emissiveIntensity: profile.emissiveIntensity,
                  opacity: profile.opacity,
                  transparent: profile.transparent,
                  alphaTest: profile.alphaTest,
                });
              }
              const rimMat = mesh.userData._rimMaterial as ShaderMaterial;
              rimMat.uniforms.u_weight.value = weight;
              mesh.material = rimMat;
            }
          }
        });
      });
    }

    // --- Flock (additive, always targets descendant meshes) ---
    if (effectTypes.includes("flock")) {
      const fDelay = o.flockDelay ?? 3;
      const flockTargets: Object3D[] = [];
      group.traverse((obj) => { if ((obj as Mesh).isMesh) flockTargets.push(obj); });

      const weight = multiWeight(group, o);

      flockTargets.forEach((child, i) => {
        const lag = i * fDelay;
        for (const axis of nAxes) {
          const noiseNow = smoothNoise(frame * nSpeed, 0, axis);
          const noiseThen = smoothNoise((frame - lag) * nSpeed, 0, axis);
          child.position[axis] += (noiseThen - noiseNow) * nAmount * weight;
        }
      });
    }
  }

  return managedNames;
}

/**
 * Shared hologram/holoReveal handler.
 * zMode=false → Y-axis scan, zMode=true → absolute Z-axis scan (for transitions).
 */
function applyHologram(
  targets: Object3D[],
  effectorPos: Vector3,
  frame: number,
  o: Record<string, any>,
  config: EffectorConfig,
  zMode: boolean,
  weightFn: (object: Object3D, overrides: EffectOverrides) => number,
  extraSources: EffectorSource[],
  isRendering: boolean,
) {
  const hIntensity = o.holoIntensity ?? 4;
  const hColor = o.holoColor ?? "#88ccff";
  const hSpeed = o.holoSpeed ?? (zMode ? 0.05 : 0.02);
  const hTrigger = o.holoTriggerDist ?? (zMode ? 8 : 5);
  const hStart = o.holoStart as number | undefined;
  const hModulated = o.holoModulated ?? false;
  const hReverse = o.holoReverse ?? false;
  // Spatial trigger latching is order-dependent, which can stutter when
  // Remotion renders frames out-of-order. For holoReveal, default to
  // a deterministic time sweep in render unless explicitly overridden.
  const effectiveHStart =
    isRendering && zMode && !hModulated && hStart === undefined ? 0 : hStart;

  // Reverse gets its own prefix so entrance and exit don't share
  // material instances or trigger keys on the same meshes.
  const base_prefix = zMode ? "_hr" : "_holo";
  const prefix = hReverse ? base_prefix + "Rev" : base_prefix;

  targets.forEach((child) => {
    // Hologram controls visibility via shader discard — override any parent reveal/scale
    const base = child.userData._base as BaseTransform | undefined;
    if (base) {
      child.position.set(base.px, base.py, base.pz);
      child.scale.set(base.sx, base.sy, base.sz);
    }

    child.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        const mesh = obj as Mesh;
        const matKey = `${prefix}Material`;
        const minKey = `${prefix}Min`;
        const maxKey = `${prefix}Max`;

        if (!mesh.userData[matKey]) {
          mesh.userData._originalMaterial = mesh.userData._originalMaterial ?? mesh.material;
          const box = new Box3().setFromObject(mesh);
          const origMat = mesh.userData._originalMaterial as MeshStandardMaterial | MeshBasicMaterial;
          const profile = getMaterialProfile(origMat);
          // Y-mode uses Y bounds, Z-mode uses Z bounds
          const lo = zMode ? box.min.z : box.min.y;
          const hi = zMode ? box.max.z : box.max.y;
          mesh.userData[matKey] = createHologramMaterial({
            minY: lo, maxY: hi,
            scanIntensity: hIntensity, scanColor: hColor,
            map: profile.map,
            baseColor: profile.baseColor,
            emissiveColor: profile.emissiveColor,
            emissiveIntensity: profile.emissiveIntensity,
            opacity: profile.opacity,
            transparent: profile.transparent,
            alphaTest: profile.alphaTest,
            side: profile.side,
            unlit: profile.unlit,
            useZ: zMode,
          });
          mesh.userData[minKey] = lo;
          mesh.userData[maxKey] = hi;
        }
        const holoMat = mesh.userData[matKey] as ShaderMaterial;
        const minVal = mesh.userData[minKey] as number;
        const maxVal = mesh.userData[maxKey] as number;

        let scanVal: number;

        if (hModulated) {
          // === MODULATED MODE: weight drives scan directly ===
          const weight = weightFn(child, o as EffectOverrides);
          const range = maxVal - minVal;
          scanVal = minVal + weight * (range * 1.2);
        } else if (effectiveHStart !== undefined) {
          // === DETERMINISTIC TIME MODE (Stateless) ===
          // Fixes out-of-order rendering stuttering in Remotion
          const hideVal = minVal - 1;
          if (frame < effectiveHStart) {
            scanVal = hideVal;
          } else {
            const elapsed = frame - effectiveHStart;
            scanVal = minVal + elapsed * hSpeed;
          }
        } else {
          // === SPATIAL TRIGGER MODE: one-shot latch ===
          const tfKey = `${prefix}TriggerFrame`;

          // Scrub guard
          if (child.userData[tfKey] !== undefined && (child.userData[tfKey] as number) > frame) {
            child.userData[tfKey] = undefined;
          }

          // Check trigger (only if not already triggered — latch)
          if (child.userData[tfKey] === undefined) {
            let triggered = false;
            child.getWorldPosition(_triggerPos);
            triggered = _triggerPos.distanceTo(effectorPos) <= hTrigger;
            if (!triggered) {
              for (const src of extraSources) {
                src.object.getWorldPosition(_srcPos);
                if (_triggerPos.distanceTo(_srcPos) <= hTrigger) {
                  triggered = true;
                  break;
                }
              }
            }
            // If we jump forward in time during rendering, this latch is technically inexact,
            // but for spatial triggers it's the only cheap way. Use hStart or hModulated for perfect sync.
            if (triggered) child.userData[tfKey] = frame;
          }

          const triggerFrame = child.userData[tfKey] as number | undefined;
          const hideVal = minVal - 1;

          if (triggerFrame === undefined) {
            scanVal = hideVal;
          } else {
            const elapsed = frame - triggerFrame;
            scanVal = minVal + elapsed * hSpeed;
          }
        }

        holoMat.uniforms.u_reverse.value = hReverse ? 1.0 : 0.0;

        if (hReverse) {
          // Exit mode — only apply once triggered
          if (scanVal <= minVal - 1) {
            // Not triggered yet — reset to original material if we previously mutated it
            // This fixes the stuttering caused by out-of-order rendering in Remotion
            if (mesh.material === holoMat && mesh.userData._originalMaterial) {
              mesh.material = mesh.userData._originalMaterial;
            }
            return;
          }
          holoMat.uniforms.u_scanY.value = scanVal;
          holoMat.uniforms.u_scanIntensity.value = hIntensity;
          holoMat.uniforms.u_fade.value = 0;
          mesh.material = holoMat;
        } else {
          // Entrance mode — fade out holo effects, then swap to original
          const revealW = (holoMat.uniforms.u_revealWidth.value as number) ?? 0.5;
          const fadeZone = revealW * 5;
          const pastReveal = scanVal - (maxVal + revealW);

          if (pastReveal > fadeZone && mesh.userData._originalMaterial) {
            mesh.material = mesh.userData._originalMaterial;
          } else {
            const fade = pastReveal > 0 ? pastReveal / fadeZone : 0;
            holoMat.uniforms.u_scanY.value = scanVal;
            holoMat.uniforms.u_scanIntensity.value = hIntensity;
            holoMat.uniforms.u_fade.value = fade;
            mesh.material = holoMat;
          }
        }
      }
    });
  });
}
