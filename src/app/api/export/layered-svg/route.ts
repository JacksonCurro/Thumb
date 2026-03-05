import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  decomposeImage,
  buildLayeredSVG,
} from "@/lib/services/layered-svg-export";

const exportSchema = z.object({
  imageDataUrl: z.string().min(1),
  styleProfile: z.object({}).passthrough(),
  brief: z.object({
    videoTitle: z.string().optional(),
    noText: z.boolean().optional(),
    textOverlay: z.string().optional(),
  }).passthrough(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { imageDataUrl, brief } = parsed.data;

    // Determine if the thumbnail has text to extract
    const hasText = !brief.noText && !!brief.textOverlay;

    // Decompose image into background + model + text layers via Gemini
    const { backgroundBase64, modelBase64, textBase64 } =
      await decomposeImage(imageDataUrl, hasText);

    // Assemble layered SVG
    const svg = buildLayeredSVG({
      backgroundBase64,
      modelBase64,
      textBase64,
    });

    const filename = `thumbnail-layered-${Date.now()}.svg`;

    return NextResponse.json({ svg, filename });
  } catch (error) {
    console.error("Layered SVG export error:", error);
    const message =
      error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
