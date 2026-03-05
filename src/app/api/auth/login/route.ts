import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = (await request.json()) as { password: string };

    const accessPassword = process.env.ACCESS_PASSWORD;
    if (!accessPassword) {
      // No password configured — allow access (dev mode)
      const res = NextResponse.json({ success: true });
      const { name, value, options } = await getSessionCookie();
      res.cookies.set(name, value, options);
      return res;
    }

    if (password !== accessPassword) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true });
    const { name, value, options } = await getSessionCookie();
    res.cookies.set(name, value, options);
    return res;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
