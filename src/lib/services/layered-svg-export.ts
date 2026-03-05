import sharp from "sharp";
import { editImage } from "./gemini-image";

const WIDTH = 1280;
const HEIGHT = 720;

// ─── Green-screen keying thresholds ─────────────────────────────────────────
const GREEN_THRESHOLD = 150;
const OTHER_THRESHOLD = 100;

// ─── Pixel diff threshold for text extraction ───────────────────────────────
// If the colour distance between original and text-removed exceeds this, it's text
const DIFF_THRESHOLD = 30;

export interface DecomposedLayers {
  backgroundBase64: string; // clean background — no person, no text
  modelBase64: string; // model cutout on transparent background (PNG)
  textBase64: string | null; // text cutout on transparent background (PNG)
}

/**
 * Decomposes a generated thumbnail into background + model + text layers.
 *
 * Strategy:
 *   1. Remove person AND text → clean inpainted background
 *   2. Green-screen the person (no text) → key out green → transparent model
 *   3. Remove ONLY the person (keep text + background) → Gemini inpaints
 *      behind the model, completing the text that was hidden
 *   4. Pixel-diff step 3 vs step 1 → the difference is the COMPLETE text
 *      layer, including parts that were behind the model
 *
 * Steps 1-3 are Gemini calls run in parallel. Step 4 uses pixel differencing
 * because Gemini is much better at "remove person" than "isolate only text."
 */
export async function decomposeImage(
  imageDataUrl: string,
  hasText: boolean = true
): Promise<DecomposedLayers> {
  const calls: Promise<string>[] = [
    // 1. Clean background — remove person + text
    editImage({
      imageDataUrl,
      editInstruction:
        "Remove ALL people, human subjects, AND any text/typography/lettering from this image completely. Fill in every area where they were with a natural continuation of the background — match the lighting, colours, and textures so the background looks like a complete, uninterrupted scene with nothing overlaid on it.",
    }),
    // 2. Green-screen the person only
    editImage({
      imageDataUrl,
      editInstruction:
        "Replace the entire background AND any text/typography/lettering with a perfectly uniform solid bright green color (#00FF00). Keep ONLY the person/people and any objects they are holding — remove all text. The green must be completely flat and uniform — no gradients, shadows, or variation. The person should remain exactly as they appear.",
    }),
  ];

  if (hasText) {
    // 3. Remove person only — keep text + background, inpaint behind model
    calls.push(
      editImage({
        imageDataUrl,
        editInstruction:
          "Remove ALL people and human subjects from this image. Fill in the areas where they were with a natural continuation of the background AND complete any text/typography that was partially hidden behind them — the text should look whole and uninterrupted. Keep all text, lettering, and typography exactly as it appears. Only remove the people.",
      })
    );
  }

  const results = await Promise.all(calls);

  const [backgroundResult, modelGreenScreen] = results;
  const personRemovedTextKept = hasText ? results[2] : null;

  // Key out green from model cutout
  const modelBase64 = await keyOutGreen(modelGreenScreen);

  // Extract text via pixel differencing:
  // (person-removed with text) vs (clean background) = complete text layer
  // Pass model cutout as mask to suppress ghost remnants in the model area
  const textBase64 =
    hasText && personRemovedTextKept
      ? await extractTextByDiff(personRemovedTextKept, backgroundResult, modelBase64)
      : null;

  return {
    backgroundBase64: backgroundResult,
    modelBase64,
    textBase64,
  };
}

/**
 * Extracts the text layer by comparing a person-removed version (text kept)
 * against the clean background (no person, no text).
 * Uses the model cutout mask to apply a stricter threshold in the model area,
 * suppressing ghost remnants from imperfect Gemini inpainting.
 */
async function extractTextByDiff(
  personRemovedDataUrl: string,
  cleanBackgroundDataUrl: string,
  modelCutoutDataUrl: string
): Promise<string | null> {
  const extractBase64 = (url: string) => {
    const match = url.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL");
    return Buffer.from(match[1], "base64");
  };

  const withTextBuf = extractBase64(personRemovedDataUrl);
  const cleanBuf = extractBase64(cleanBackgroundDataUrl);
  const modelBuf = extractBase64(modelCutoutDataUrl);

  // Resize all to same dimensions and get raw RGBA
  const [withTextRaw, cleanRaw, modelRaw] = await Promise.all([
    sharp(withTextBuf).resize(WIDTH, HEIGHT).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(cleanBuf).resize(WIDTH, HEIGHT).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(modelBuf).resize(WIDTH, HEIGHT).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const textPixels = new Uint8Array(withTextRaw.data);
  const bgPixels = new Uint8Array(cleanRaw.data);
  const modelPixels = new Uint8Array(modelRaw.data);
  const outPixels = new Uint8Array(textPixels.length);

  // Where the model exists, require a much higher diff to count as text.
  // This suppresses ghost remnants while keeping bright text (e.g. yellow on dark).
  const MODEL_AREA_THRESHOLD = 120;

  let hasAnyText = false;

  for (let i = 0; i < textPixels.length; i += 4) {
    const dr = Math.abs(textPixels[i] - bgPixels[i]);
    const dg = Math.abs(textPixels[i + 1] - bgPixels[i + 1]);
    const db = Math.abs(textPixels[i + 2] - bgPixels[i + 2]);
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    // Check if this pixel is in the model area (model alpha > 0)
    const modelAlpha = modelPixels[i + 3];
    const threshold = modelAlpha > 30 ? MODEL_AREA_THRESHOLD : DIFF_THRESHOLD;

    if (dist > threshold) {
      // This pixel is text — use the colour from the person-removed version
      // (which has complete text including inpainted parts behind model)
      outPixels[i] = textPixels[i];
      outPixels[i + 1] = textPixels[i + 1];
      outPixels[i + 2] = textPixels[i + 2];
      // Scale alpha by how different the pixel is (stronger diff = more opaque)
      outPixels[i + 3] = Math.min(255, Math.round((dist / 150) * 255));
      hasAnyText = true;
    } else {
      outPixels[i + 3] = 0;
    }
  }

  if (!hasAnyText) return null;

  const outputBuffer = await sharp(Buffer.from(outPixels), {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${outputBuffer.toString("base64")}`;
}

/**
 * Converts green-screen data URL to transparent PNG data URL using sharp.
 * Replaces bright green pixels (#00FF00 ± threshold) with transparent.
 */
async function keyOutGreen(greenScreenDataUrl: string): Promise<string> {
  const match = greenScreenDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Invalid green-screen data URL");

  const inputBuffer = Buffer.from(match[1], "base64");

  const { data: rawPixels, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawPixels);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (g > GREEN_THRESHOLD && r < OTHER_THRESHOLD && b < OTHER_THRESHOLD) {
      pixels[i + 3] = 0;
    } else if (g > 120 && r < 130 && b < 130 && g > r * 1.3 && g > b * 1.3) {
      const greenness = (g - Math.max(r, b)) / g;
      pixels[i + 3] = Math.round(255 * (1 - greenness));
    }
  }

  const outputBuffer = await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${outputBuffer.toString("base64")}`;
}

/**
 * Builds a layered SVG string with embedded raster layers.
 * Each layer is a named <g> group — independently selectable in Figma/Illustrator.
 *
 * Layer order (bottom to top): Background → Text → Model
 * This means text sits between background and model, so the model
 * overlaps text just like in the original thumbnail.
 */
export function buildLayeredSVG(options: {
  backgroundBase64: string;
  modelBase64: string;
  textBase64: string | null;
}): string {
  const { backgroundBase64, modelBase64, textBase64 } = options;

  const textLayer = textBase64
    ? `  <g id="text" data-name="Text">
    <image href="${textBase64}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="none"/>
  </g>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <g id="background" data-name="Background">
    <image href="${backgroundBase64}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="none"/>
  </g>
${textLayer}  <g id="model" data-name="Model">
    <image href="${modelBase64}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="none"/>
  </g>
</svg>`;
}
