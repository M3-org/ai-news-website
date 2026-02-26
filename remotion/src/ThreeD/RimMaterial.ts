/**
 * RimMaterial.ts — Cel-shading-style rim glow effect.
 *
 * Preserves base texture/color with simple lighting, adds a view-dependent
 * fresnel rim glow. Intensity driven by effector weight via u_weight uniform.
 * Values above 1.0 trigger Bloom for that hot backlight look.
 */
import { ShaderMaterial, DoubleSide, Vector3, Color, Texture } from "three";

const vertexShader = /* glsl */ `
#include <skinning_pars_vertex>

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

  v_normal = normalize(normalMatrix * objectNormal);
  vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
  v_viewPos = -mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D u_map;
uniform bool u_hasMap;
uniform vec3 u_baseColor;
uniform vec3 u_emissiveColor;
uniform float u_emissiveIntensity;
uniform vec3 u_rimColor;
uniform float u_rimIntensity;
uniform float u_rimPower;
uniform float u_weight;

varying vec3 v_normal;
varying vec3 v_viewPos;
varying vec2 v_uv;

void main() {
  // Base color / texture + emissive for prebaked scenes
  vec3 base;
  if (u_hasMap) {
    vec3 texel = texture2D(u_map, v_uv).rgb;
    base = texel * max(u_emissiveColor * u_emissiveIntensity, vec3(1.0));
  } else {
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = 0.3 + 0.7 * max(dot(normalize(v_normal), lightDir), 0.0);
    base = u_baseColor * diffuse + u_emissiveColor * u_emissiveIntensity;
  }

  // Fresnel rim — edges glow, center stays clean
  vec3 viewDir = normalize(v_viewPos);
  float rimDot = 1.0 - max(dot(normalize(v_normal), viewDir), 0.0);
  float rim = pow(rimDot, u_rimPower);

  // Rim glow scaled by effector weight — pushes past 1.0 for Bloom
  vec3 color = base + u_rimColor * rim * u_rimIntensity * u_weight;

  gl_FragColor = vec4(color, 1.0);
}
`;

export interface RimOptions {
  baseColor?: Color | string;
  emissiveColor?: Color | string;
  emissiveIntensity?: number;
  /** Rim glow color (default "#ffffff"). */
  rimColor?: Color | string;
  /** Rim brightness — values > 1 trigger Bloom (default 2). */
  rimIntensity?: number;
  /** Fresnel exponent — higher = thinner rim (default 2). */
  rimPower?: number;
  map?: Texture | null;
}

export function createRimMaterial(opts: RimOptions = {}): ShaderMaterial {
  const baseColor = new Color(opts.baseColor ?? "#aaaaaa");
  const emissiveColor = new Color(opts.emissiveColor ?? "#000000");
  const rimColor = new Color(opts.rimColor ?? "#ffffff");
  const hasMap = !!opts.map;
  const rimPower = Math.max(1e-4, opts.rimPower ?? 2.0);

  return new ShaderMaterial({
    uniforms: {
      u_map: { value: opts.map ?? null },
      u_hasMap: { value: hasMap },
      u_baseColor: { value: new Vector3(baseColor.r, baseColor.g, baseColor.b) },
      u_emissiveColor: { value: new Vector3(emissiveColor.r, emissiveColor.g, emissiveColor.b) },
      u_emissiveIntensity: { value: opts.emissiveIntensity ?? 0.0 },
      u_rimColor: { value: new Vector3(rimColor.r, rimColor.g, rimColor.b) },
      u_rimIntensity: { value: opts.rimIntensity ?? 2.0 },
      u_rimPower: { value: rimPower },
      u_weight: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    transparent: false,
  });
}
