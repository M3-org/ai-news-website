import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface LaidOutWord {
  /** Index into the original words array. */
  wordIdx: number;
  /** Left edge relative to the line's left edge, in px. */
  x: number;
  width: number;
}

export interface CaptionLine {
  text: string;
  width: number;
  words: LaidOutWord[];
}

export interface CaptionLayout {
  lines: CaptionLine[];
  /** wordToLine[wordIdx] -> line index. */
  wordToLine: number[];
}

let measureCtx: OffscreenCanvasRenderingContext2D | null = null;
function getMeasureCtx(): OffscreenCanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = new OffscreenCanvas(1, 1).getContext("2d")!;
  }
  return measureCtx;
}

/**
 * Break caption words into measured lines that fit maxWidth, with per-word
 * x-offsets for karaoke highlighting. Pure arithmetic after pretext's one-time
 * prepare — safe to call from a useMemo that must stay identical across
 * Remotion's per-frame re-renders.
 *
 * Returns null when the words can't be mapped onto pretext's lines (e.g. a
 * single word broken across lines); callers fall back to unmeasured rendering.
 */
export function layoutCaptionWords(
  words: WordTiming[],
  font: string,
  maxWidth: number,
): CaptionLayout | null {
  if (!words.length || maxWidth <= 0) return null;

  const tokens = words.map((w) => w.word.trim()).filter((w) => w.length > 0);
  if (tokens.length !== words.length) return null;
  const text = tokens.join(" ");

  const prepared = prepareWithSegments(text, font);
  // lineHeight only affects the returned height, not the breaks — pass the
  // font size as a stand-in.
  const fontSize = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "84");
  const { lines } = layoutWithLines(prepared, maxWidth, fontSize);
  if (!lines.length) return null;

  const ctx = getMeasureCtx();
  ctx.font = font;
  const spaceWidth = ctx.measureText(" ").width;

  const out: CaptionLine[] = [];
  const wordToLine: number[] = [];
  let wordIdx = 0;

  for (const line of lines) {
    const lineWords: LaidOutWord[] = [];
    let x = 0;
    // Lines are the joined text split at measured break points, so each
    // space-separated token corresponds to one original word, in order.
    for (const token of line.text.split(" ")) {
      if (token === "") continue;
      if (wordIdx >= words.length || token !== tokens[wordIdx]) {
        return null; // a word was hyphenated/split — bail to fallback
      }
      const width = ctx.measureText(token).width;
      lineWords.push({ wordIdx, x, width });
      wordToLine[wordIdx] = out.length;
      x += width + spaceWidth;
      wordIdx++;
    }
    out.push({
      text: line.text,
      width: ctx.measureText(line.text).width,
      words: lineWords,
    });
  }
  if (wordIdx !== words.length) return null;

  return { lines: out, wordToLine };
}
