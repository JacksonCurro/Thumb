import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { db, schema } = await import("@/lib/db");
    const items = await db()
      .select()
      .from(schema.styleBoardItems)
      .where(eq(schema.styleBoardItems.userId, "demo-user")) // TODO: auth
      .orderBy(schema.styleBoardItems.addedAt);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], dbUnavailable: true });
  }
}

const styleBoardPostSchema = z.object({
  source: z.string().min(1),
  thumbnailUrl: z.string().min(1),
  title: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = styleBoardPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { source, thumbnailUrl, title } = parsed.data;

    const { db, schema } = await import("@/lib/db");
    const [item] = await db()
      .insert(schema.styleBoardItems)
      .values({
        userId: "demo-user", // TODO: auth
        source,
        thumbnailUrl,
        title,
      })
      .returning();

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Style board save error:", error);
    return NextResponse.json(
      { error: "Failed to save to style board" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    try {
      const { db, schema } = await import("@/lib/db");
      await db()
        .delete(schema.styleBoardItems)
        .where(eq(schema.styleBoardItems.id, id));
    } catch {
      // DB not available — item will be removed client-side via Zustand
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Style board delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete from style board" },
      { status: 500 }
    );
  }
}
