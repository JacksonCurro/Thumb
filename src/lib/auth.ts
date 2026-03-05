import { createHmac } from "crypto";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

const COOKIE_NAME = "thumbnail-os-session";
const SESSION_PAYLOAD = "thumbnail-os-authenticated";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

function getSecret(): string {
  return process.env.ACCESS_PASSWORD || "dev-fallback-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function getSessionCookie(): { name: string; value: string; options: Partial<ResponseCookie> } {
  const token = sign(SESSION_PAYLOAD);
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SEVEN_DAYS,
    },
  };
}

export function isValidSession(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const expected = sign(SESSION_PAYLOAD);
  return cookieValue === expected;
}

export { COOKIE_NAME };
