import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { db, schema } = await import("@/lib/db");
    const profiles = await db()
      .select()
      .from(schema.styleProfiles)
      .where(eq(schema.styleProfiles.userId, "demo-user")) // TODO: auth
      .orderBy(schema.styleProfiles.createdAt);

    return NextResponse.json({ profiles });
  } catch {
    return NextResponse.json({ profiles: [], dbUnavailable: true });
  }
}
