import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, thumbnailUrl, title } = body as {
      source: string;
      thumbnailUrl: string;
      title: string;
    };

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
    const { id } = await request.json();

    const { db, schema } = await import("@/lib/db");
    await db()
      .delete(schema.styleBoardItems)
      .where(eq(schema.styleBoardItems.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Style board delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete from style board" },
      { status: 500 }
    );
  }
}
