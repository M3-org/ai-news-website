/**
 * HologramMaterial.ts — Holographic scan-line build effect.
 *
 * Two modes:
 *   - Y-mode (default): horizontal scan sweeps upward through world Y.
 *   - Z-mode (holoReveal): scan sweeps along absolute world Z axis (for transitions).
 *
 * Below/behind the scan: object visible (hologram → real texture transition).
 * Above/ahead of scan: discarded. Leading edge glows for Bloom.
 */
import { ShaderMaterial, DoubleSide, Vector3, Color, Texture, type Side } from "three";

const vertexShader = /* glsl */ `
#include <skinning_pars_vertex>

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec3 v_viewPos;
varying vec2 v_uv;

void main() {
  v_uv = uv;

  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>

  vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = normalize(normalMatrix * objectNormal);
  vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
  v_viewPos = -mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
`;

const fragmentShader = /* glsl */ `
uniform float u_scanY;
uniform float u_scanWidth;
uniform float u_minY;
uniform float u_maxY;
uniform vec3 u_scanColor;
uniform float u_scanIntensity;
uniform float u_lineSpacing;
uniform float u_lineAlpha;
uniform sampler2D u_map;
uniform bool u_hasMap;
uniform vec3 u_baseColor;
uniform vec3 u_emissiveColor;
uniform float u_emissiveIntensity;
uniform float u_opacity;
uniform float u_alphaTest;
uniform float u_unlit;
uniform float u_fresnelPower;
uniform vec3 u_fresnelColor;
uniform float u_fresnelIntensity;
uniform float u_revealWidth;
// Z mode (holoReveal)
uniform float u_useZ;
// Fade holo effects toward base texture (0 = full holo, 1 = pure base)
uniform float u_fade;
// Reverse mode (exit transition): discard below scan instead of above
uniform float u_reverse;
// Composited rim glow (from "rim" effect token)
uniform vec3 u_rimGlowColor;
uniform float u_rimGlowIntensity;
uniform float u_rimGlowPower;
uniform float u_rimGlowWeight;

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec3 v_viewPos;
varying vec2 v_uv;

void main() {
  // Scan value: world Y (hologram) or world Z (holoReveal)
  float scanVal = u_useZ > 0.5 ? v_worldPos.z : v_worldPos.y;

  // Entrance: discard above scan (building in). Exit: discard below scan (dissolving out).
  if (u_reverse > 0.5) {
    if (scanVal < u_scanY) discard;
  } else {
    if (scanVal > u_scanY) discard;
  }

  // Distance from the scan edge (always positive, toward the leading edge)
  float edgeDist = u_reverse > 0.5 ? (scanVal - u_scanY) : (u_scanY - scanVal);

  // Scan edge glow — bright band at the leading edge
  float scanEdge = 1.0 - smoothstep(0.0, u_scanWidth, edgeDist);

  // Reveal blend: 0 = full hologram, 1 = real texture
  float reveal = smoothstep(0.0, u_revealWidth, edgeDist);

  // Scan lines — subtle repeating pattern (fades with reveal)
  float lineCoord = u_useZ > 0.5 ? v_worldPos.z : v_worldPos.y;
  float lines = abs(sin(lineCoord * 3.14159 / u_lineSpacing));
  lines = smoothstep(0.0, 0.05, lines);
  float lineFade = mix(u_lineAlpha, 1.0, reveal);

  vec4 texel = u_hasMap ? texture2D(u_map, v_uv) : vec4(1.0);
  float alpha = texel.a * u_opacity;
  if (alpha < u_alphaTest) discard;

  // Original texture / base color + emissive for prebaked scenes
  vec3 base;
  if (u_hasMap) {
    if (u_unlit > 0.5) {
      base = texel.rgb * max(u_emissiveColor * u_emissiveIntensity, vec3(1.0));
    } else {
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diffuse = 0.3 + 0.7 * max(dot(v_normal, lightDir), 0.0);
      base = texel.rgb * diffuse + u_emissiveColor * u_emissiveIntensity;
    }
  } else {
    if (u_unlit > 0.5) {
      base = u_baseColor + u_emissiveColor * u_emissiveIntensity;
    } else {
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diffuse = 0.3 + 0.7 * max(dot(v_normal, lightDir), 0.0);
      base = u_baseColor * diffuse + u_emissiveColor * u_emissiveIntensity;
    }
  }

  // Hologram tint — blue-shifted version of base
  vec3 holoBase = base * 0.3 + u_fresnelColor * 0.15;

  // Blend hologram → real texture based on reveal
  vec3 color = mix(holoBase, base, reveal);

  // Apply scan lines (fade out as texture reveals)
  color *= mix(lineFade, 1.0, reveal * reveal);

  // Fresnel rim (fades as real texture takes over)
  vec3 viewDir = normalize(v_viewPos);
  float rimDot = 1.0 - max(dot(normalize(v_normal), viewDir), 0.0);
  float fresnel = pow(rimDot, u_fresnelPower);
  color += u_fresnelColor * fresnel * u_fresnelIntensity * (1.0 - reveal);

  // Hot scan edge — pushed bright for Bloom
  color += u_scanColor * scanEdge * u_scanIntensity;

  // Composited rim glow
  {
    vec3 rgView = normalize(v_viewPos);
    float rgDot = 1.0 - max(dot(normalize(v_normal), rgView), 0.0);
    float rgRim = pow(rgDot, u_rimGlowPower);
    color += u_rimGlowColor * rgRim * u_rimGlowIntensity * u_rimGlowWeight;
  }

  // Fade: blend everything back to pure base texture before material swap
  color = mix(color, base, u_fade);

  gl_FragColor = vec4(color, alpha);
}
`;

export interface HologramOptions {
  baseColor?: Color | string;
  emissiveColor?: Color | string;
  emissiveIntensity?: number;
  scanColor?: Color | string;
  scanWidth?: number;
  scanIntensity?: number;
  lineSpacing?: number;
  lineAlpha?: number;
  fresnelPower?: number;
  fresnelColor?: Color | string;
  fresnelIntensity?: number;
  /** Distance below scan line for hologram→texture transition (default 0.5). */
  revealWidth?: number;
  map?: Texture | null;
  minY?: number;
  maxY?: number;
  /** If true, scan sweeps along world Z instead of world Y (for holoReveal). */
  useZ?: boolean;
  opacity?: number;
  transparent?: boolean;
  alphaTest?: number;
  side?: Side;
  unlit?: boolean;
}

export function createHologramMaterial(opts: HologramOptions = {}): ShaderMaterial {
  const baseColor = new Color(opts.baseColor ?? "#aaaaaa");
  const emissiveColor = new Color(opts.emissiveColor ?? "#000000");
  const scanColor = new Color(opts.scanColor ?? "#88ccff");
  const fresnelColor = new Color(opts.fresnelColor ?? "#4488ff");
  const hasMap = !!opts.map;
  const scanWidth = Math.max(1e-4, opts.scanWidth ?? 0.06);
  const lineSpacing = Math.max(1e-4, opts.lineSpacing ?? 0.03);
  const revealWidth = Math.max(1e-4, opts.revealWidth ?? 0.5);
  const opacity = opts.opacity ?? 1.0;
  const alphaTest = opts.alphaTest ?? 0.0;
  const isTransparent = opts.transparent ?? (opacity < 1.0 || alphaTest > 0);

  return new ShaderMaterial({
    uniforms: {
      u_scanY: { value: opts.minY ?? -1.0 },
      u_scanWidth: { value: scanWidth },
      u_minY: { value: opts.minY ?? -1.0 },
      u_maxY: { value: opts.maxY ?? 2.0 },
      u_scanColor: { value: new Vector3(scanColor.r, scanColor.g, scanColor.b) },
      u_scanIntensity: { value: opts.scanIntensity ?? 4.0 },
      u_lineSpacing: { value: lineSpacing },
      u_lineAlpha: { value: opts.lineAlpha ?? 0.3 },
      u_map: { value: opts.map ?? null },
      u_hasMap: { value: hasMap },
      u_baseColor: { value: new Vector3(baseColor.r, baseColor.g, baseColor.b) },
      u_emissiveColor: { value: new Vector3(emissiveColor.r, emissiveColor.g, emissiveColor.b) },
      u_emissiveIntensity: { value: opts.emissiveIntensity ?? 0.0 },
      u_opacity: { value: opacity },
      u_alphaTest: { value: alphaTest },
      u_unlit: { value: opts.unlit ? 1.0 : 0.0 },
      u_fresnelPower: { value: opts.fresnelPower ?? 2.0 },
      u_fresnelColor: { value: new Vector3(fresnelColor.r, fresnelColor.g, fresnelColor.b) },
      u_fresnelIntensity: { value: opts.fresnelIntensity ?? 1.5 },
      u_revealWidth: { value: revealWidth },
      u_useZ: { value: opts.useZ ? 1.0 : 0.0 },
      u_fade: { value: 0.0 },
      u_reverse: { value: 0.0 },
      u_rimGlowColor: { value: new Vector3(1, 1, 1) },
      u_rimGlowIntensity: { value: 0.0 },
      u_rimGlowPower: { value: 2.0 },
      u_rimGlowWeight: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    side: opts.side ?? DoubleSide,
    transparent: isTransparent,
  });
}
