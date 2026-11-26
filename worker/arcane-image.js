/*
 * /api/arcane-image — generates a fantasy background image with Google Gemini.
 *
 * Hardened against open-proxy abuse:
 *   - Enforces same-origin / allowed-origin browser requests (no ACAO: *).
 *   - Per-IP rate limit (5 requests / 10 minutes).
 *   - Server-side curated scene allowlist ONLY: arbitrary `?prompt=` input is
 *     ignored so callers can never use this endpoint as a general image proxy.
 *
 * Requires secret `GEMINI_API_KEY`. Optionally set `GEMINI_IMAGE_MODEL`.
 */

import { validateOrigin, checkRateLimit, jsonResponse, securityHeaders } from "./guard.js";

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const TIMEOUT_MS = 18000;

const IMAGE_STYLE =
  "ornate Dungeons & Dragons arcane fantasy art, glowing magical runes and sigils, " +
  "deep amethyst purple and antique gold, mystical, atmospheric, highly detailed, " +
  "painterly, wide cinematic landscape, no text, no watermark, no people";

const SCENES = [
  "an ancient arcane library with floating tomes and candlelight",
  "a wizard's tower interior crackling with violet energy",
  "an enchanted moonlit forest clearing with glowing fireflies",
  "a glowing magical portal of swirling golden runes",
  "a dragon's treasure hoard in a vast underground cavern",
  "a celestial observatory under a starry void, constellations alive",
  "a rune-carved dungeon hall lit by torches and magical crystals",
  "a misty mountain temple of forgotten gods at dusk",
];

export async function handleArcaneImage(request, env, ctx) {
  const origin = validateOrigin(request);
  if (!origin.ok) {
    return jsonResponse({ error: "Forbidden" }, 403, null);
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin.corsOrigin, { allow: "GET" });
  }

  const key = env.GEMINI_API_KEY;
  if (!key) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 503, origin.corsOrigin);

  const rl = await checkRateLimit(request, ctx, { bucket: "arcane-image", limit: 5, windowSec: 600 });
  if (!rl.ok) {
    return jsonResponse(
      { error: "Rate limit exceeded. Try again shortly." },
      429,
      origin.corsOrigin,
      { "retry-after": String(rl.retryAfter) }
    );
  }

  const url = new URL(request.url);
  const rawIdx = parseInt(url.searchParams.get("scene") || "", 10);
  const idx = Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < SCENES.length
    ? rawIdx
    : Math.floor(Math.random() * SCENES.length);
  const prompt = `${SCENES[idx]}, ${IMAGE_STYLE}`;
  const model = env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent";

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    return jsonResponse({ error: "upstream request failed" }, 502, origin.corsOrigin);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return jsonResponse({ error: "upstream image error", status: res.status }, 502, origin.corsOrigin);
  }

  const data = await res.json();
  const parts =
    (data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || [];
  const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!imagePart) return jsonResponse({ error: "no image in response" }, 502, origin.corsOrigin);

  const binary = atob(imagePart.inlineData.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Response(bytes, {
    headers: securityHeaders(origin.corsOrigin, {
      "content-type": imagePart.inlineData.mimeType || "image/png",
    }),
  });
}
