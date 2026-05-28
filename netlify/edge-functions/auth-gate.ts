/**
 * auth-gate.ts — Netlify Edge Function
 *
 * Checks every request for a valid signed auth cookie.
 * If absent or invalid, redirects to /login.
 *
 * Login form POST is handled by netlify/functions/login.mjs
 * (routed via /do-login redirect in netlify.toml).
 *
 * Environment variables:
 *   COOKIE_SECRET — must match the value used in login.mjs
 */

import type { Context } from "@netlify/edge-functions";

const COOKIE_NAME = "dataroom_auth";

async function verifySignature(value: string, secret: string, expected: string): Promise<boolean> {
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
  const actual = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

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
  const secret = Netlify.env.get("COOKIE_SECRET") || "change-me-please-set-in-netlify";

  // Check auth cookie
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
