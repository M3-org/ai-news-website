import { staticFile } from "remotion";

/**
 * Resolve an asset path for both Studio and headless rendering.
 * - Absolute paths (headless pipeline) pass through unchanged.
 * - Relative paths (Studio) are resolved via Remotion's staticFile() (public/).
 */
export const resolveAsset = (path: string): string => {
  if (path.startsWith("/") || /^[A-Z]:/i.test(path) || path.startsWith("http")) {
    return path;
  }
  return staticFile(path);
};
