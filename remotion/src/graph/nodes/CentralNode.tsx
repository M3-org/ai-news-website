/**
 * CentralNode — The "ElizaOS Daily" hub at the center of the graph.
 *
 * 3D animated sphere with orbiting lines, inspired by
 * https://discourse.threejs.org/t/splines-curves-wrapped-around-sphere/61792
 */
import React, { useRef, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { NodePos } from "../layout";
import { RAMP_EASE } from "../camera";

const ORANGE = "#FF8A00";
const SIZE = 420;
const HALF = SIZE / 2;

const LINE_VERTICES = 20;
const LINE_COUNT = 200;

interface CentralNodeProps {
  pos: NodePos;
  date: string;
  focus: number;
  appearFrame: number;
  revealFrame: number;
  textVisible: boolean;
  scanOpacity: number;
}

/** Compute a point on an animated spherical path */
function spherePath(
  v: THREE.Vector3,
  buf: THREE.BufferAttribute,
  t: number,
  i: number,
  rnd: number,
  r: number,
) {
  t += 10 * rnd;
  let a = (0.1 + 3 * rnd) * Math.sin(t + 13 * rnd) + 0.2 * rnd * Math.cos(13.2 * t + 3);
  const b = (3 - 3 * rnd) * Math.cos(t) + 2 * rnd * Math.cos(4.5 * t - 17 * rnd);
  a = 0.7 * a + Math.PI / 2;
  v.setFromSphericalCoords(r, a, b);
  buf.setXYZ(i, v.x, v.y, v.z);
}

/** Three.js scene: animated sphere with orbiting lines */
const SphereScene: React.FC = () => {
  const frame = useCurrentFrame();
  const frameRef = useRef(0);
  frameRef.current = frame;

  const v = useMemo(() => new THREE.Vector3(), []);

  const { lines, lineRnds } = useMemo(() => {
    const color = new THREE.Color();
    const colors: number[] = [];
    const colors2: number[] = [];

    for (let i = 0; i < LINE_VERTICES; i++) {
      // Orange hue (0.08) with bright tips
      color.setHSL(0.08, 1, 1 - Math.abs(2 * i / (LINE_VERTICES - 1) - 1) + 0.05);
      if (i % 19 === 0) color.setHSL(0.08, 1, 1);
      colors.push(color.r, color.g, color.b);
      // Accent lines: deep red-orange
      color.setHSL(0.02, 1, 0.5);
      colors2.push(color.r, color.g, color.b);
    }

    const material = new THREE.LineBasicMaterial({ vertexColors: true });
    const rnds: number[] = [];
    const lineObjs: THREE.Line[] = [];

    for (let j = 0; j < LINE_COUNT; j++) {
      const rnd = 0.2 + 1.2 * random("sphere-line-" + j);
      rnds.push(rnd);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(LINE_VERTICES * 3), 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(
        new Float32Array(j % 15 ? colors : colors2), 3,
      ));

      lineObjs.push(new THREE.Line(geo, material));
    }

    return { lines: lineObjs, lineRnds: rnds };
  }, []);

  // Update line positions and rotations each render
  useFrame(() => {
    const t = frameRef.current / 150;

    for (let j = 0; j < LINE_COUNT; j++) {
      const line = lines[j];
      const posAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const rnd = lineRnds[j];

      for (let i = 0; i < LINE_VERTICES; i++) {
        const r = j % 15 ? 2 : 4 * Math.sin(i / 10);
        spherePath(v, posAttr, t - i / 70, i, rnd, r);
      }
      posAttr.needsUpdate = true;

      line.rotation.set(
        t / 2.6 + rnd,
        t / 2.44 - 10 * rnd,
        t / 2.34,
      );
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={30} />
      <spotLight position={[0, 0, 8]} intensity={-750} color="#ff9040" />
      <spotLight position={[0, 0, 10]} intensity={1200} color="#ffa050" />

      {/* Animated lines (no solid sphere — CSS gradient background instead) */}
      {lines.map((line, j) => (
        <primitive key={j} object={line} />
      ))}
    </>
  );
};

export const CentralNode: React.FC<CentralNodeProps> = ({
  pos, date, focus, appearFrame, revealFrame, textVisible, scanOpacity,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - appearFrame);

  const appearSpring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 20, stiffness: 80, mass: 0.95 },
    from: 0,
    to: 1,
  });
  const scaleSpring = interpolate(appearSpring, [0, 1], [0.9, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const appearLift = interpolate(appearSpring, [0, 1], [12, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const appearOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });

  const textOpacity = textVisible
    ? interpolate(localFrame, [5, 24], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: RAMP_EASE,
      })
    : 0;

  const nodeOpacity = textVisible ? appearOpacity : appearOpacity * scanOpacity;

  const framesSinceReveal = frame - revealFrame;
  const inRevealPhase = framesSinceReveal >= 0 && framesSinceReveal < 20;

  const flareScale = inRevealPhase ? interpolate(framesSinceReveal, [0, 4, 15], [1, 1.25, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  }) : 1;

  const flashOpacity = inRevealPhase ? interpolate(framesSinceReveal, [0, 2, 10], [0, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }) : 0;

  const glowPulse = 0.5 + 0.25 * Math.sin(frame * 0.04);
  const glowSize = 40 + focus * 30 + (inRevealPhase ? flashOpacity * 120 : 0);
  const ringPulse = Math.sin(frame * 0.08) * 0.5 + 0.5;

  const SPHERE_SIZE = SIZE - 48; // inset 24 each side

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - HALF,
        top: pos.y - HALF,
        width: SIZE,
        height: SIZE,
        opacity: nodeOpacity,
        transform: `scale(${scaleSpring * flareScale}) translateY(${appearLift}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          inset: -50,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}${Math.round(Math.min(1, glowPulse + flashOpacity) * 35).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          filter: `blur(${glowSize}px)`,
        }}
      />

      {/* Scan pulse ring */}
      {!textVisible && (
        <div
          style={{
            position: "absolute",
            inset: -8 - ringPulse * 14,
            borderRadius: "50%",
            border: `1.5px solid ${ORANGE}${Math.round(ringPulse * 70).toString(16).padStart(2, "0")}`,
            boxShadow: `0 0 12px ${ORANGE}${Math.round(ringPulse * 30).toString(16).padStart(2, "0")}`,
          }}
        />
      )}

      {/* 3D Splines */}
      <div
        style={{
          position: "absolute",
          inset: 24,
          borderRadius: "50%",
          overflow: "hidden",
          opacity: 0.35,
        }}
      >
        <ThreeCanvas width={SPHERE_SIZE} height={SPHERE_SIZE}>
          <SphereScene />
        </ThreeCanvas>
      </div>

      {/* Flash overlay */}
      {flashOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 24,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,255,255,${flashOpacity}) 0%, rgba(255,200,120,${flashOpacity * 0.5}) 40%, transparent 70%)`,
            zIndex: 10,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Scan dot */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: ORANGE,
          boxShadow: `0 0 14px ${ORANGE}, 0 0 30px ${ORANGE}60`,
          opacity: textVisible ? 0 : 1,
          zIndex: 5,
        }}
      />

      {/* Center text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
          zIndex: 5,
        }}
      >
        <p
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "4px",
            textAlign: "center",
            textShadow: `0 0 20px ${ORANGE}40, 0 2px 8px rgba(0,0,0,0.7)`,
          }}
        >
          ElizaOS
        </p>
        <p
          style={{
            fontSize: 16,
            color: ORANGE,
            margin: "4px 0 0",
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "6px",
            textTransform: "uppercase" as const,
            textAlign: "center",
            textShadow: `0 0 14px ${ORANGE}60`,
          }}
        >
          Daily Briefing
        </p>
        <div
          style={{
            width: 40,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${ORANGE}aa, transparent)`,
            margin: "10px auto",
          }}
        />
        <p
          style={{
            fontSize: 18,
            color: ORANGE,
            margin: 0,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "2px",
            textAlign: "center",
            textShadow: `0 0 12px ${ORANGE}40`,
            opacity: 0.8,
          }}
        >
          {date}
        </p>
      </div>
    </div>
  );
};
