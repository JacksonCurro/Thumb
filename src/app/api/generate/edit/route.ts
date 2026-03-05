import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { editImage } from "@/lib/services/gemini-image";

const editSchema = z.object({
  imageDataUrl: z.string().min(1),
  editInstruction: z.string().min(1).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = editSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { imageDataUrl, editInstruction } = parsed.data;

    const editedImageUrl = await editImage({ imageDataUrl, editInstruction });

    return NextResponse.json({ editedImageUrl });
  } catch (error) {
    console.error("Edit error:", error);
    const message = error instanceof Error ? error.message : "Edit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
