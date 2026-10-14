import React from "react";
import { continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

// pretext measures with the browser font engine, so the font string passed to
// prepare() must byte-for-byte match the CSS of the text it lays out — same
// family, weight, and px size — and the family must be loaded before measuring.
const inter = loadFont("normal", {
  weights: ["600", "800"],
  subsets: ["latin"],
});

export const INTER_FAMILY = inter.fontFamily; // "Inter"

export const captionFont = (px: number): string =>
  `800 ${px}px ${INTER_FAMILY}`;

export const headlineFont = (px: number): string =>
  `600 ${px}px ${INTER_FAMILY}`;

/**
 * True once Inter is loaded. Layout memos should depend on this so Studio
 * re-measures after the font arrives; the delayRender handle guarantees
 * headless renders never capture a frame measured with a fallback font.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const [handle] = React.useState(() =>
    delayRender("Loading Inter for pretext measurement"),
  );
  React.useEffect(() => {
    let alive = true;
    inter
      .waitUntilDone()
      .then(() => {
        if (alive) setReady(true);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
    return () => {
      alive = false;
    };
  }, [handle]);
  return ready;
}
