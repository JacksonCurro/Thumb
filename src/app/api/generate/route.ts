import { NextRequest, NextResponse } from "next/server";
import { buildGenerationPrompt, mergeProfiles } from "@/lib/services/prompt-builder";
import { generateThumbnails } from "@/lib/services/gemini-image";
import type { StyleProfile, CreativeBrief, ThumbnailJob } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      profile,
      profiles,
      brief,
      referenceImageUrl,
      referenceImageUrls,
      characterImageBase64,
    } = body as {
      profile?: StyleProfile;
      profiles?: StyleProfile[];
      brief: CreativeBrief;
      referenceImageUrl?: string;
      referenceImageUrls?: string[];
      characterImageBase64?: string;
    };

    // Support both single and multi-profile (backward compatible)
    const allProfiles = profiles ?? (profile ? [profile] : []);
    const allRefUrls = referenceImageUrls ?? (referenceImageUrl ? [referenceImageUrl] : []);

    if (allProfiles.length === 0 || !brief) {
      return NextResponse.json(
        { error: "At least one profile and a brief are required" },
        { status: 400 }
      );
    }

    // Merge profiles if multiple
    const mergedProfile = mergeProfiles(allProfiles);
    const generatedPrompt = buildGenerationPrompt(mergedProfile, brief);

    // Fetch all reference thumbnails server-side
    const referenceImageBuffers: Buffer[] = [];
    for (const url of allRefUrls) {
      try {
        if (url.startsWith("data:")) {
          const base64Data = url.split(",")[1];
          if (base64Data) {
            referenceImageBuffers.push(Buffer.from(base64Data, "base64"));
          }
        } else {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            referenceImageBuffers.push(Buffer.from(await imgRes.arrayBuffer()));
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    // Convert character reference image from base64
    let characterImageBuffer: Buffer | undefined;
    if (characterImageBase64) {
      characterImageBuffer = Buffer.from(characterImageBase64, "base64");
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      const job: ThumbnailJob = {
        id: crypto.randomUUID(),
        userId: "demo-user",
        styleProfileId: mergedProfile.id,
        brief: brief.videoTitle,
        generatedPrompt,
        status: "complete",
        outputs: [],
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        job,
        prompt: generatedPrompt,
        note: "GEMINI_API_KEY not configured — showing prompt only",
      });
    }

    // Generate with Gemini
    const result = await generateThumbnails({
      profile: mergedProfile,
      brief,
      referenceImageBuffers:
        referenceImageBuffers.length > 0 ? referenceImageBuffers : undefined,
      characterImageBuffer,
      numImages: 3,
    });

    const job: ThumbnailJob = {
      id: crypto.randomUUID(),
      userId: "demo-user",
      styleProfileId: mergedProfile.id,
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
        styleProfileId: mergedProfile.id,
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
