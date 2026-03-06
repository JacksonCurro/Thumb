import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractStyleFromImage } from "@/lib/services/style-extraction";

const extractStyleSchema = z
  .object({
    imageBase64: z.string().optional(),
    imageUrl: z.string().url().optional(),
    mediaType: z
      .enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
      .optional(),
    name: z.string().max(200).optional(),
  })
  .refine((d) => d.imageBase64 || d.imageUrl, {
    message: "Either imageBase64 or imageUrl is required",
  });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = extractStyleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { imageBase64, imageUrl, mediaType, name } = parsed.data;

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
          lighting: result.lighting,
          backgroundType: result.backgroundType,
          textEffect: result.textEffect,
          energyLevel: result.energyLevel,
          contrastLevel: result.contrastLevel,
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
