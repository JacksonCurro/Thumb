import { NextRequest, NextResponse } from "next/server";
import { extractStyleFromImage } from "@/lib/services/style-extraction";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, imageUrl, mediaType, name } = body as {
      imageBase64?: string;
      imageUrl?: string;
      mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      name?: string;
    };

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "Either imageBase64 or imageUrl is required" },
        { status: 400 }
      );
    }

    let base64Data: string;
    let resolvedMediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
      mediaType || "image/jpeg";

    if (imageBase64) {
      base64Data = imageBase64;
    } else {
      // Fetch the image server-side and convert to base64
      // (Anthropic's URL-based image support may not reach all hosts)
      const imageRes = await fetch(imageUrl!);
      if (!imageRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${imageRes.status}` },
          { status: 502 }
        );
      }

      const contentType = imageRes.headers.get("content-type") || "image/jpeg";
      if (contentType.includes("png")) resolvedMediaType = "image/png";
      else if (contentType.includes("webp")) resolvedMediaType = "image/webp";
      else resolvedMediaType = "image/jpeg";

      const buffer = await imageRes.arrayBuffer();
      base64Data = Buffer.from(buffer).toString("base64");
    }

    const result = await extractStyleFromImage(base64Data, resolvedMediaType);

    // Persist to DB if available
    let profileId: string | undefined;
    try {
      const { db, schema } = await import("@/lib/db");
      const [row] = await db()
        .insert(schema.styleProfiles)
        .values({
          userId: "demo-user",
          name: name || "Extracted Style",
          sourceType: "extracted",
          palette: result.palette,
          layout: result.layout,
          typography: result.typography,
          moodTags: result.moodTags,
          rawDescriptors: result.rawDescriptors,
          promptVersion: result.promptVersion,
        })
        .returning({ id: schema.styleProfiles.id });

      profileId = row.id;
    } catch {
      // DB not available
    }

    return NextResponse.json({ result, profileId });
  } catch (error) {
    console.error("Style extraction error:", error);
    const message =
      error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
