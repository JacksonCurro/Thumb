import { NextRequest, NextResponse } from "next/server";
import { editImage } from "@/lib/services/gemini-image";

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, editInstruction } = (await request.json()) as {
      imageDataUrl: string;
      editInstruction: string;
    };

    if (!imageDataUrl || !editInstruction) {
      return NextResponse.json(
        { error: "imageDataUrl and editInstruction are required" },
        { status: 400 }
      );
    }

    const editedImageUrl = await editImage({ imageDataUrl, editInstruction });

    return NextResponse.json({ editedImageUrl });
  } catch (error) {
    console.error("Edit error:", error);
    const message = error instanceof Error ? error.message : "Edit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
