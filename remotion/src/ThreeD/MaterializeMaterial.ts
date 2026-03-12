/**
 * MaterializeMaterial.ts — Noise-based dissolve/materialize shader.
 *
 * Objects dissolve into nothing when threshold is 0 (camera far),
 * and fully materialize when threshold is 1 (camera close).
 * A hot glowing edge appears at the dissolve boundary.
 * Samples the original material's texture so objects keep their look.
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
uniform float u_threshold;
uniform vec3 u_baseColor;
uniform vec3 u_emissiveColor;
uniform float u_emissiveIntensity;
uniform vec3 u_edgeColor;
uniform float u_edgeWidth;
uniform float u_noiseScale;
uniform float u_rimPower;
uniform float u_burnIntensity;
uniform sampler2D u_map;
uniform bool u_hasMap;
uniform float u_opacity;
uniform float u_alphaTest;
uniform float u_unlit;
// Composited rim glow (from "rim" effect token)
uniform vec3 u_rimGlowColor;
uniform float u_rimGlowIntensity;
uniform float u_rimGlowPower;
uniform float u_rimGlowWeight;

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec3 v_viewPos;
varying vec2 v_uv;

// --- 3D gradient noise ---
vec3 hash3(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
            dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
        mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
            dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
            dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
        mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
            dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
    u.z
  );
}

void main() {
  // Sample 3D noise at world position — pattern is view-independent
  float n = noise(v_worldPos * u_noiseScale) * 0.5 + 0.5;

  // Discard pixels where noise exceeds threshold (not yet materialized)
  if (n > u_threshold) discard;

  // Edge glow: how close this pixel is to the dissolve boundary
  float edgeDist = u_threshold - n;
  float edge = 1.0 - smoothstep(0.0, u_edgeWidth, edgeDist);

  vec4 texel = u_hasMap ? texture2D(u_map, v_uv) : vec4(1.0);
  float alpha = texel.a * u_opacity;
  if (alpha < u_alphaTest) discard;

  // Base color — sample original texture if available, otherwise use flat color + emissive
  vec3 base;
  if (u_hasMap) {
    if (u_unlit > 0.5) {
      base = texel.rgb * max(u_emissiveColor * u_emissiveIntensity, vec3(1.0));
    } else {
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diffuse = 0.4 + 0.6 * max(dot(v_normal, lightDir), 0.0);
      base = texel.rgb * diffuse + u_emissiveColor * u_emissiveIntensity;
    }
  } else {
    if (u_unlit > 0.5) {
      base = u_baseColor + u_emissiveColor * u_emissiveIntensity;
    } else {
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diffuse = 0.4 + 0.6 * max(dot(v_normal, lightDir), 0.0);
      vec3 viewDir = normalize(v_viewPos);
      float rimDot = 1.0 - max(dot(normalize(v_normal), viewDir), 0.0);
      float rim = pow(rimDot, u_rimPower) * 0.5;
      base = u_baseColor * diffuse + u_baseColor * rim + u_emissiveColor * u_emissiveIntensity;
    }
  }

  vec3 color = base;
  color = mix(color, u_edgeColor * u_burnIntensity, edge);
  // Extra additive brightness at the dissolve edge — pushed past 1.0 for Bloom
  color += u_edgeColor * edge * u_burnIntensity;

  // Composited rim glow
  {
    vec3 rgView = normalize(v_viewPos);
    float rgDot = 1.0 - max(dot(normalize(v_normal), rgView), 0.0);
    float rgRim = pow(rgDot, u_rimGlowPower);
    color += u_rimGlowColor * rgRim * u_rimGlowIntensity * u_rimGlowWeight;
  }

  gl_FragColor = vec4(color, alpha);
}
`;

export interface MaterializeOptions {
  baseColor?: Color | string;
  emissiveColor?: Color | string;
  emissiveIntensity?: number;
  edgeColor?: Color | string;
  edgeWidth?: number;
  noiseScale?: number;
  rimPower?: number;
  burnIntensity?: number;
  map?: Texture | null;
  opacity?: number;
  transparent?: boolean;
  alphaTest?: number;
  side?: Side;
  unlit?: boolean;
}

export function createMaterializeMaterial(opts: MaterializeOptions = {}): ShaderMaterial {
  const baseColor = new Color(opts.baseColor ?? "#aaaaaa");
  const emissiveColor = new Color(opts.emissiveColor ?? "#000000");
  const edgeColor = new Color(opts.edgeColor ?? "#ff6a00");
  const hasMap = !!opts.map;
  const edgeWidth = Math.max(1e-4, opts.edgeWidth ?? 0.08);
  const noiseScale = Math.max(1e-4, opts.noiseScale ?? 6.0);
  const rimPower = Math.max(1e-4, opts.rimPower ?? 3.0);
  const opacity = opts.opacity ?? 1.0;
  const alphaTest = opts.alphaTest ?? 0.0;
  const isTransparent = opts.transparent ?? (opacity < 1.0 || alphaTest > 0);

  return new ShaderMaterial({
    uniforms: {
      u_threshold: { value: 0.0 },
      u_baseColor: { value: new Vector3(baseColor.r, baseColor.g, baseColor.b) },
      u_emissiveColor: { value: new Vector3(emissiveColor.r, emissiveColor.g, emissiveColor.b) },
      u_emissiveIntensity: { value: opts.emissiveIntensity ?? 0.0 },
      u_edgeColor: { value: new Vector3(edgeColor.r, edgeColor.g, edgeColor.b) },
      u_edgeWidth: { value: edgeWidth },
      u_noiseScale: { value: noiseScale },
      u_rimPower: { value: rimPower },
      u_burnIntensity: { value: opts.burnIntensity ?? 3.0 },
      u_map: { value: opts.map ?? null },
      u_hasMap: { value: hasMap },
      u_opacity: { value: opacity },
      u_alphaTest: { value: alphaTest },
      u_unlit: { value: opts.unlit ? 1.0 : 0.0 },
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
