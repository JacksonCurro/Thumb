import type { StyleProfile, CreativeBrief } from "@/types";
import { buildGenerationPrompt } from "./prompt-builder";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.1-flash-image-preview";

export interface GenerationResult {
  images: {
    url: string; // base64 data URL
    seed: number;
    prompt: string;
  }[];
}

/**
 * Generates thumbnails using Gemini's native image generation.
 *
 * Reference images are passed inline — Gemini uses them to understand
 * the visual style, then generates new content matching that style.
 */
export async function generateThumbnails(options: {
  profile: StyleProfile;
  brief: CreativeBrief;
  referenceImageBuffers?: Buffer[];
  characterImageBuffer?: Buffer;
  numImages?: number;
  preview?: boolean;
  styleReferenceWeight?: number;
}): Promise<GenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { profile, brief, referenceImageBuffers = [], characterImageBuffer, numImages = 3 } = options;

  const prompt = buildGenerationPrompt(profile, brief);

  // Build parts: reference images first (primes the model), then prompt
  const parts: GeminiPart[] = [];

  if (referenceImageBuffers.length === 1) {
    parts.push({
      text: "Use this image as a style reference. Match its visual style, colour palette, composition approach, and energy — but generate completely new content based on the prompt below. Do not copy or reproduce specific elements, logos, or UI from this image.",
    });
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: referenceImageBuffers[0].toString("base64"),
      },
    });
  } else if (referenceImageBuffers.length > 1) {
    parts.push({
      text: `Here are ${referenceImageBuffers.length} images for creative inspiration only. Do NOT replicate or blend these images together. Instead, study what makes each one visually compelling — their use of colour theory, contrast, spatial tension, typography energy, and emotional tone. Then create something completely original that feels like it belongs in the same creative universe but stands on its own as a fresh, distinctive design. Do not copy any specific elements, logos, text, UI, or compositions from these images.`,
    });
    for (const buf of referenceImageBuffers) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: buf.toString("base64"),
        },
      });
    }
  }

  if (characterImageBuffer) {
    parts.push({
      text: "This person should appear as the main subject in the generated image. Preserve their facial features and appearance accurately.",
    });
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: characterImageBuffer.toString("base64"),
      },
    });
  }

  parts.push({ text: prompt });

  // Reinforce no-text at the end (recency bias — last instruction carries weight)
  if (brief.noText) {
    parts.push({ text: "CRITICAL: This image must contain absolutely NO text, letters, words, numbers, or typography of any kind. Generate a purely visual image." });
  }

  // Gemini returns 1 image per call — fire N requests in parallel
  const requests = Array.from({ length: numImages }, () =>
    callGemini(apiKey, parts)
  );

  const results = await Promise.allSettled(requests);

  const images: GenerationResult["images"] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      images.push({ url: result.value, seed: 0, prompt });
    }
  }

  if (images.length === 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason?.message || String(r.reason));
    throw new Error(
      `No images were generated. ${errors[0] || "Try adjusting your prompt."}`
    );
  }

  return { images };
}

/**
 * Edits an existing image using Gemini — sends the image back with
 * a modification instruction and returns the edited version.
 */
export async function editImage(options: {
  imageDataUrl: string;
  editInstruction: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { imageDataUrl, editInstruction } = options;

  // Extract base64 and mime from data URL
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const [, mimeType, base64Data] = match;

  const parts: GeminiPart[] = [
    { text: `Edit this image. Apply this change: ${editInstruction}. Keep everything else exactly the same — only modify what was specifically requested. Return the full edited image.` },
    { inlineData: { mimeType, data: base64Data } },
  ];

  return callGemini(apiKey, parts);
}

// ─── Gemini API types & call ──────────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function callGemini(
  apiKey: string,
  parts: GeminiPart[]
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error("Gemini returned no image in response");
}
