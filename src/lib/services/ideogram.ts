import type { StyleProfile, CreativeBrief } from "@/types";
import { buildGenerationPrompt } from "./prompt-builder";

const IDEOGRAM_API_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate";

export interface GenerationResult {
  images: {
    url: string;
    seed: number;
    prompt: string;
  }[];
}

/**
 * Generates thumbnails using Ideogram v3 with style reference.
 *
 * The style reference image is passed as inspiration — Ideogram extracts
 * the visual style (palette, mood, composition approach) and applies it
 * to new content based on the prompt. It does NOT copy the image.
 */
export async function generateThumbnails(options: {
  profile: StyleProfile;
  brief: CreativeBrief;
  referenceImageBuffer?: Buffer;
  characterImageBuffer?: Buffer;
  numImages?: number;
  preview?: boolean;
  styleReferenceWeight?: number;
}): Promise<GenerationResult> {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error("IDEOGRAM_API_KEY not configured");

  const {
    profile, brief, referenceImageBuffer, characterImageBuffer,
    numImages = 3, preview = false, styleReferenceWeight = 0.7,
  } = options;

  const prompt = buildGenerationPrompt(profile, brief);

  // Determine style_type based on profile mood — DESIGN for graphic/text-heavy,
  // REALISTIC for face-centric thumbnails, AUTO when using character references
  const styleType = characterImageBuffer
    ? "AUTO"
    : inferStyleType(profile);

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("aspect_ratio", "16x9");
  formData.append("num_images", String(numImages));
  formData.append("rendering_speed", preview ? "TURBO" : "QUALITY");
  formData.append("magic_prompt", "OFF");
  formData.append("style_type", styleType);
  formData.append("negative_prompt", "blurry text, illegible text, distorted face, extra fingers, watermark, border, letterboxing, low contrast, muted colors, cluttered background, amateur, stock photo, overexposed, text errors, misspelled text, black bars, cropped");

  // AUTO style_type supports both character and style references together
  if (characterImageBuffer) {
    const uint8 = new Uint8Array(characterImageBuffer);
    const blob = new Blob([uint8], { type: "image/jpeg" });
    formData.append("character_reference_images", blob, "character.jpg");
  }
  if (referenceImageBuffer) {
    const uint8 = new Uint8Array(referenceImageBuffer);
    const blob = new Blob([uint8], { type: "image/jpeg" });
    formData.append("style_reference_images", blob, "reference.jpg");
    formData.append("style_reference_weight", String(styleReferenceWeight));
  }

  // Pass the extracted colour palette (not compatible with character reference)
  if (!characterImageBuffer) {
    const paletteColors = [
      ...profile.palette.dominant.slice(0, 3),
      ...profile.palette.accent.slice(0, 2),
    ];
    if (paletteColors.length > 0) {
      const colorPalette = {
        members: paletteColors.map((hex, i) => ({
          color_hex: hex,
          color_weight: Math.max(0.05, 1.0 - i * 0.2),
        })),
      };
      formData.append("color_palette", JSON.stringify(colorPalette));
    }
  }

  const res = await fetch(IDEOGRAM_API_URL, {
    method: "POST",
    headers: { "Api-Key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ideogram generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  const images = (data.data || [])
    .filter((item: { url: string | null; is_image_safe: boolean }) => item.url && item.is_image_safe)
    .map((item: { url: string; seed: number; prompt: string }) => ({
      url: item.url,
      seed: item.seed,
      prompt: item.prompt,
    }));

  if (images.length === 0) {
    throw new Error("No safe images were generated. Try adjusting your prompt.");
  }

  return { images };
}

/**
 * Infer the best Ideogram style_type from the profile's mood tags.
 * DESIGN = graphic/text-heavy thumbnails (bold, flat, neon, outlined, etc.)
 * REALISTIC = face-centric, photographic thumbnails (cinematic, bokeh, etc.)
 */
function inferStyleType(profile: StyleProfile): string {
  const tags = new Set(profile.moodTags);
  const designSignals = ["flat-design", "neon", "outlined", "3d-effect", "hand-drawn", "collage", "gradient", "maximalist", "grunge", "retro"];
  const realisticSignals = ["cinematic", "bokeh", "sharp", "vignette"];

  let designScore = 0;
  let realisticScore = 0;
  for (const tag of tags) {
    if (designSignals.includes(tag)) designScore++;
    if (realisticSignals.includes(tag)) realisticScore++;
  }

  if (designScore > realisticScore) return "DESIGN";
  if (realisticScore > designScore) return "REALISTIC";
  return "DESIGN"; // default — most thumbnails are graphic-heavy
}
