import { NextRequest, NextResponse } from "next/server";
import { buildGenerationPrompt } from "@/lib/services/prompt-builder";
import { generateThumbnails } from "@/lib/services/ideogram";
import type { StyleProfile, CreativeBrief, ThumbnailJob } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile, brief, referenceImageUrl, characterImageBase64 } = body as {
      profile: StyleProfile;
      brief: CreativeBrief;
      referenceImageUrl?: string;
      characterImageBase64?: string;
    };

    if (!profile || !brief) {
      return NextResponse.json(
        { error: "Both profile and brief are required" },
        { status: 400 }
      );
    }

    const generatedPrompt = buildGenerationPrompt(profile, brief);

    // Fetch the reference thumbnail server-side for style reference
    let referenceImageBuffer: Buffer | undefined;
    if (referenceImageUrl && !referenceImageUrl.startsWith("data:")) {
      try {
        const imgRes = await fetch(referenceImageUrl);
        if (imgRes.ok) {
          referenceImageBuffer = Buffer.from(await imgRes.arrayBuffer());
        }
      } catch {
        // Reference image fetch failed — generate without it
      }
    } else if (referenceImageUrl?.startsWith("data:")) {
      // Handle base64 uploaded images
      const base64Data = referenceImageUrl.split(",")[1];
      if (base64Data) {
        referenceImageBuffer = Buffer.from(base64Data, "base64");
      }
    }

    // Convert character reference image from base64
    let characterImageBuffer: Buffer | undefined;
    if (characterImageBase64) {
      characterImageBuffer = Buffer.from(characterImageBase64, "base64");
    }

    // Check if Ideogram API key is configured
    if (!process.env.IDEOGRAM_API_KEY) {
      // No image gen API — return prompt only
      const job: ThumbnailJob = {
        id: crypto.randomUUID(),
        userId: "demo-user",
        styleProfileId: profile.id,
        brief: brief.videoTitle,
        generatedPrompt,
        status: "complete",
        outputs: [],
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        job,
        prompt: generatedPrompt,
        note: "IDEOGRAM_API_KEY not configured — showing prompt only",
      });
    }

    // Generate with Ideogram
    const result = await generateThumbnails({
      profile,
      brief,
      referenceImageBuffer,
      characterImageBuffer,
      numImages: 3,
    });

    const job: ThumbnailJob = {
      id: crypto.randomUUID(),
      userId: "demo-user",
      styleProfileId: profile.id,
      brief: brief.videoTitle,
      generatedPrompt,
      status: "complete",
      outputs: result.images.map((img, i) => ({
        url: img.url,
        variationIndex: i,
      })),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    // Persist job to DB
    try {
      const { db, schema } = await import("@/lib/db");
      await db().insert(schema.thumbnailJobs).values({
        id: job.id,
        userId: job.userId,
        styleProfileId: profile.id,
        brief: job.brief,
        generatedPrompt: job.generatedPrompt,
        status: job.status,
        outputs: job.outputs,
        completedAt: new Date(),
      });
    } catch {
      // DB not available
    }

    return NextResponse.json({ job, prompt: generatedPrompt });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
