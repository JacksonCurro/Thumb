import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildGenerationPrompt, mergeProfiles } from "@/lib/services/prompt-builder";
import { generateThumbnails } from "@/lib/services/gemini-image";
import type { StyleProfile, CreativeBrief, ThumbnailJob } from "@/types";

const generateSchema = z.object({
  profile: z.object({}).passthrough().optional(),
  profiles: z.array(z.object({}).passthrough()).optional(),
  brief: z.object({
    videoTitle: z.string().min(1).max(500),
    description: z.string().max(2000).optional(),
    textOverlay: z.string().max(200).optional(),
    targetAudience: z.string().max(200).optional(),
    noText: z.boolean().optional(),
  }).passthrough(),
  referenceImageUrl: z.string().optional(),
  referenceImageUrls: z.array(z.string()).optional(),
  characterImageBase64: z.string().optional(),
});

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const brief = data.brief as CreativeBrief;
    const referenceImageUrls = data.referenceImageUrls;
    const referenceImageUrl = data.referenceImageUrl;
    const characterImageBase64 = data.characterImageBase64;

    // Support both single and multi-profile (backward compatible)
    const allProfiles = (data.profiles ?? (data.profile ? [data.profile] : [])) as unknown as StyleProfile[];
    const allRefUrls = referenceImageUrls ?? (referenceImageUrl ? [referenceImageUrl] : []);

    if (allProfiles.length === 0) {
      return NextResponse.json(
        { error: "At least one profile is required" },
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
