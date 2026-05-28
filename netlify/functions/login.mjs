/**
 * login.mjs — Netlify Serverless Function
 *
 * Handles the login form POST. Checks the submitted password against
 * DATAROOM_PASSWORD env var, sets a signed HMAC cookie on success,
 * and redirects accordingly.
 *
 * Endpoint: POST /.netlify/functions/login
 * (redirected from /do-login via netlify.toml)
 */

const COOKIE_NAME = "dataroom_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function sign(value, secret) {
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

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const password = process.env.DATAROOM_PASSWORD || "";
  const secret = process.env.COOKIE_SECRET || "change-me-please-set-in-netlify";

  // Parse form body
  let submitted = "";
  let nextPath = "/";
  try {
    const params = new URLSearchParams(event.body || "");
    submitted = params.get("password") || "";
    nextPath = params.get("next") || "/";
  } catch {
    // ignore
  }

  if (submitted && submitted === password) {
    const payload = `authenticated:${Date.now()}`;
    const sig = await sign(payload, secret);
    const cookieValue = `${encodeURIComponent(payload)}.${sig}`;

    return {
      statusCode: 303,
      headers: {
        Location: nextPath,
        "Set-Cookie": `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      },
      body: "",
    };
  }

  // Wrong password
  return {
    statusCode: 303,
    headers: {
      Location: `/login?error=1&next=${encodeURIComponent(nextPath)}`,
    },
    body: "",
  };
};
