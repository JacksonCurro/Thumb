import { NextRequest, NextResponse } from "next/server";
import {
  decomposeImage,
  buildLayeredSVG,
} from "@/lib/services/layered-svg-export";
import type { StyleProfile, CreativeBrief } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageDataUrl, styleProfile, brief } = body as {
      imageDataUrl: string;
      styleProfile: StyleProfile;
      brief: CreativeBrief;
    };

    if (!imageDataUrl) {
      return NextResponse.json(
        { error: "imageDataUrl is required" },
        { status: 400 }
      );
    }

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
