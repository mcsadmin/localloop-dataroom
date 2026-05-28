/**
 * auth-gate.ts — Netlify Edge Function
 *
 * Protects the entire data room with a shared passphrase.
 * Path configuration (including excludedPath) is in netlify.toml.
 *
 * Environment variables (set in Netlify UI → Site settings → Environment variables):
 *   DATAROOM_PASSWORD   — the passphrase visitors must enter
 *   COOKIE_SECRET       — a random string used to sign the auth cookie (min 32 chars)
 */

import type { Context } from "@netlify/edge-functions";

const COOKIE_NAME = "dataroom_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function sign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function verifySignature(value: string, secret: string, expected: string): Promise<boolean> {
  const actual = await sign(value, secret);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    })
  );
}

export default async function authGate(request: Request, context: Context) {
  const url = new URL(request.url);
  const path = url.pathname;

  const password = Netlify.env.get("DATAROOM_PASSWORD") || "";
  const secret = Netlify.env.get("COOKIE_SECRET") || "change-me-please-set-in-netlify";

  // Handle login form POST
  if (request.method === "POST" && (path === "/login" || path === "/login.html")) {
    let submitted = "";
    try {
      const body = await request.formData();
      submitted = (body.get("password") as string) || "";
    } catch {
      // ignore parse errors
    }

    if (submitted && submitted === password) {
      const payload = `authenticated:${Date.now()}`;
      const sig = await sign(payload, secret);
      const cookieValue = `${encodeURIComponent(payload)}.${sig}`;
      const redirectTo = url.searchParams.get("next") || "/";

      return new Response(null, {
        status: 303,
        headers: {
          Location: redirectTo,
          "Set-Cookie": `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
        },
      });
    }

    // Wrong password — redirect back to login with error flag
    const nextParam = url.searchParams.get("next") || "/";
    return new Response(null, {
      status: 303,
      headers: { Location: `/login?error=1&next=${encodeURIComponent(nextParam)}` },
    });
  }

  // Check auth cookie for all other requests
  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieValue = cookies[COOKIE_NAME];

  if (cookieValue) {
    const dotIndex = cookieValue.lastIndexOf(".");
    if (dotIndex > 0) {
      const payload = decodeURIComponent(cookieValue.slice(0, dotIndex));
      const sig = cookieValue.slice(dotIndex + 1);
      const valid = await verifySignature(payload, secret, sig);
      if (valid) {
        return context.next();
      }
    }
  }

  // Not authenticated — redirect to login
  return new Response(null, {
    status: 303,
    headers: { Location: `/login?next=${encodeURIComponent(path)}` },
  });
}
