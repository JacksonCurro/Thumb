import Anthropic from "@anthropic-ai/sdk";
import type { ExtractionResult } from "@/types";

const PROMPT_VERSION = "v2.0";

/**
 * The extraction prompt is the single most important piece of this system.
 * It must produce consistent, structured output that maps precisely to
 * the StyleProfile schema. Every descriptor here drives downstream
 * generation quality.
 *
 * v2.0: Added lighting, backgroundType, textEffect, energyLevel, contrastLevel
 */
const EXTRACTION_PROMPT = `You are an expert visual analyst specialising in YouTube thumbnail design. Analyse this thumbnail image with extreme precision.

Return ONLY a valid JSON object with this exact structure — no markdown fencing, no explanation, no other text:

{
  "palette": {
    "dominant": ["#hex1", "#hex2"],
    "accent": ["#hex1", "#hex2"]
  },
  "layout": {
    "subjectPosition": "left" | "right" | "center" | "full",
    "textZone": "top" | "bottom" | "overlay" | "separate"
  },
  "typography": {
    "weightStyle": "bold" | "medium" | "mixed",
    "caseStyle": "uppercase" | "title" | "mixed",
    "sizeHierarchy": "single" | "dual" | "complex"
  },
  "lighting": "natural" | "studio" | "dramatic" | "neon-glow" | "flat" | "backlit" | "mixed",
  "backgroundType": "solid" | "gradient" | "photo" | "blurred-photo" | "pattern" | "split" | "transparent",
  "textEffect": "plain" | "outline" | "shadow" | "glow" | "3d" | "gradient-fill" | "none",
  "energyLevel": "calm" | "moderate" | "high" | "explosive",
  "contrastLevel": "high" | "medium" | "low",
  "moodTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "rawDescriptors": "A detailed 3-4 sentence visual description..."
}

Rules:
- "dominant" = the 2-4 most prominent background/fill colours as precise hex values
- "accent" = 1-3 highlight or contrast colours used for emphasis (text, borders, graphics)
- "subjectPosition": where the primary subject (person/object) is placed in frame
- "textZone": where text overlays are positioned relative to the subject
- "lighting": the dominant lighting approach — "natural" (daylight/window), "studio" (controlled even lighting), "dramatic" (hard shadows, directional), "neon-glow" (coloured light sources, LED), "flat" (even, no shadows), "backlit" (silhouette/rim light), "mixed" (multiple techniques)
- "backgroundType": what fills the space behind the subject — "solid" (single colour), "gradient" (colour transition), "photo" (real photograph), "blurred-photo" (bokeh/out-of-focus photo), "pattern" (repeating graphics), "split" (divided into distinct zones), "transparent" (cutout/no background)
- "textEffect": how text is styled beyond basic rendering — "plain" (flat fill only), "outline" (stroke around letters), "shadow" (drop shadow), "glow" (luminous halo), "3d" (extruded/dimensional), "gradient-fill" (gradient within letters), "none" (no text present)
- "energyLevel": the overall visual intensity — "calm" (muted, minimal), "moderate" (balanced), "high" (bold, saturated, active), "explosive" (maximum contrast, chaos, urgency)
- "contrastLevel": contrast between subject/foreground and background — "high" (subject pops dramatically), "medium" (clear separation), "low" (subject blends somewhat)
- "moodTags": exactly 5 descriptors from this vocabulary: cinematic, high-contrast, flat-design, gradient, neon, minimalist, maximalist, retro, modern, corporate, playful, dramatic, warm, cool, desaturated, vibrant, dark-mode, light-mode, editorial, collage, split-screen, vignette, bokeh, sharp, textured, clean, grunge, outlined, 3d-effect, hand-drawn
- "rawDescriptors": must be specific enough that another designer could recreate the visual style without seeing the original. Include exact colour relationships, lighting direction and quality, depth of field, text treatment details (font style, colour, effects, placement), and figure-ground relationship.

Analyse the image now.`;

const anthropic = new Anthropic();

export async function extractStyleFromImage(
  imageData: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg"
): Promise<ExtractionResult & { promptVersion: string }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageData,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from vision model");
  }

  const parsed = JSON.parse(textBlock.text) as ExtractionResult;

  // Validate structure
  if (
    !parsed.palette?.dominant?.length ||
    !parsed.layout?.subjectPosition ||
    !parsed.moodTags?.length ||
    !parsed.lighting ||
    !parsed.backgroundType ||
    !parsed.energyLevel
  ) {
    throw new Error("Extraction result missing required fields");
  }

  return { ...parsed, promptVersion: PROMPT_VERSION };
}

export { PROMPT_VERSION };
