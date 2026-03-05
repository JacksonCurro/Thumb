import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

const COOKIE_NAME = "thumbnail-os-session";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

// Simple token: base64 of "authenticated:<password-hash>"
// This runs in Edge runtime, so we use Web Crypto API
async function generateToken(): Promise<string> {
  const secret = process.env.ACCESS_PASSWORD || "dev-fallback-secret";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("thumbnail-os-authenticated")
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function getSessionCookie(): Promise<{
  name: string;
  value: string;
  options: Partial<ResponseCookie>;
}> {
  const token = await generateToken();
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

export async function isValidSession(
  cookieValue: string | undefined
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await generateToken();
  return cookieValue === expected;
}

export { COOKIE_NAME };
