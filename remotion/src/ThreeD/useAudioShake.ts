/**
 * useAudioShake.ts — Audio-driven camera shake.
 *
 * Loads an audio file, analyzes frequency data per frame, and returns
 * deterministic shake offsets driven by bass energy. Pairs with CameraShake
 * in GlbScene.tsx for sound-reactive camera motion.
 */
import { useState, useEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { resolveAsset } from "../resolveAsset";
import { getAudioData, visualizeAudio } from "@remotion/media-utils";
import type { AudioData } from "@remotion/media-utils";

interface AudioShakeConfig {
  /** Audio file in public/ folder. Empty string = disabled. */
  audioFile: string;
  /** Overall shake multiplier (default 1). */
  intensity?: number;
  /** How much bass frequencies drive shake vs overall energy. 0 = all overall, 1 = all bass (default 0.7). */
  bassWeight?: number;
}

export interface AudioShakeResult {
  /** Shake X offset — apply to camera position. */
  shakeX: number;
  /** Shake Y offset — apply to camera position. */
  shakeY: number;
  /** Overall audio energy 0–1 — use for bloom, glow, or other modulation. */
  energy: number;
  /** Bass energy 0–1 — use for heavy hits, kicks, booms. */
  bass: number;
}

export function useAudioShake({
  audioFile,
  intensity = 1,
  bassWeight = 0.7,
}: AudioShakeConfig): AudioShakeResult {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const handleRef = useRef<number | null>(null);

  // Delay render until audio is loaded (only when audioFile is provided)
  useEffect(() => {
    if (!audioFile) return;

    const handle = delayRender("Loading audio for shake analysis");
    handleRef.current = handle;

    getAudioData(resolveAsset(audioFile))
      .then((data) => {
        setAudioData(data);
        continueRender(handle);
      })
      .catch((err) => {
        console.warn("[useAudioShake] Failed to load audio:", err);
        continueRender(handle);
      });
  }, [audioFile]);

  // No audio → no shake
  if (!audioData || !audioFile) {
    return { shakeX: 0, shakeY: 0, energy: 0, bass: 0 };
  }

  const visualization = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 256,
  });

  // Bass energy: first 8 bins (~0–300 Hz) — kicks, booms, sub bass
  const bassSlice = visualization.slice(0, 8);
  const bassEnergy = bassSlice.reduce((a, b) => a + b, 0) / bassSlice.length;

  // Overall RMS energy
  const rms = Math.sqrt(
    visualization.reduce((a, b) => a + b * b, 0) / visualization.length,
  );

  // Weighted combination: bass hits → shake, overall fills in
  const combined = bassEnergy * bassWeight + rms * (1 - bassWeight);

  // Deterministic directional noise (same hash as velocity shake — stays consistent)
  const nx = (Math.sin(frame * 127.1 + 311.7) * 43758.5453 % 1) * 2 - 1;
  const ny = (Math.sin(frame * 269.5 + 183.3) * 43758.5453 % 1) * 2 - 1;

  const amount = combined * intensity;

  return {
    shakeX: nx * amount,
    shakeY: ny * amount,
    energy: rms,
    bass: bassEnergy,
  };
}
