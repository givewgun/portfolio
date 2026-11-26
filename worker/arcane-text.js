/*
 * /api/arcane-text — generates RPG-flavored *wording* for the Arcane theme
 * using Google Gemini. It only rewrites fixed portfolio labels/bio copy,
 * never arbitrary user input.
 *
 * Hardened against open-proxy and prompt-injection abuse:
 *   - Enforces same-origin / allowed-origin browser requests (no ACAO: *).
 *   - Per-IP rate limit (12 requests / 10 minutes).
 *   - Server-owned source bio (`LORE_BASE`) and section map (`SECTIONS`):
 *     any client-supplied `base` text is ignored.
 *
 *   ?kind=labels  → JSON map of section id → { nav, kicker, title }
 *   ?kind=parley  → JSON { title, text } — a fresh "call to parley"
 *   ?kind=lore    → JSON { paragraphs: [...] } — fantasy retelling of real bio
 *   ?seed=N       → integer variation seed (0–999999)
 */

import { validateOrigin, checkRateLimit, jsonResponse } from "./guard.js";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 12000;

const SECTIONS = {
  about: "introduction / who I am",
  tandem: "latest launch: an open-source tool that makes two AI agents work as a team",
  experience: "professional work history and jobs",
  skills: "technical skills and tools",
  projects: "personal and portfolio projects",
  repos: "open-source GitHub repositories",
  certifications: "professional certifications",
  education: "universities and degrees",
  awards: "awards, recognition, and spoken languages",
  contact: "contact / get in touch",
};

// Server-owned copy of the real portfolio bio so callers cannot inject arbitrary
// prompts via POST body.
const LORE_BASE = [
  "I'm a Software & Enterprise Architect at the Bank of Thailand, where I design and deliver enterprise-scale systems that drive innovation and reliability. My work spans identity & access management serving millions of users, DevOps transformation, cloud adoption, and architecture governance.",
  "Beyond architecture, I keep my hands on the keyboard — making sure solutions stay practical, efficient, and maintainable across both professional and personal projects. I hold a Master of Software Engineering from Carnegie Mellon University, fully funded through a Bank of Thailand scholarship.",
  "Previously, I built scalable, high-performance systems at Agoda — one of Thailand's top tech companies — and led an IoT backend redesign at Adrich (in partnership with CMU) that scaled from 20,000 to 5 million devices.",
];

function buildPrompt(kind, seed) {
  if (kind === "lore") {
    return (
      "You are a master loremaster in a high-fantasy Dungeons & Dragons world. " +
      "Retell the following real professional biography as in-world 'lore' — an " +
      "epic origin story — while PRESERVING every real fact exactly: employers, " +
      "the university, job titles, the scholarship, and all numbers/metrics. Do " +
      "not invent new facts and do not alter any number. Frame real things with " +
      "fantasy flavor (guilds, realms, arcane crafts, artifacts, scaling spells) " +
      "but keep each fact recognizable to a reader. Keep the same number of " +
      "paragraphs and a similar length to the source.\n" +
      "Base biography (one string per paragraph): " + JSON.stringify(LORE_BASE) + "\n" +
      'Return JSON: { "paragraphs": [ ... ] } with the same number of paragraphs. ' +
      "Variation seed " + seed + " — make this retelling noticeably different from others."
    );
  }
  if (kind === "parley") {
    return (
      "You are a witty Dungeons & Dragons quest-giver narrating a personal " +
      "portfolio website for an enterprise software architect. Write a fresh, " +
      "tasteful 'call to parley' inviting a visitor to get in touch, themed as " +
      "high-fantasy RPG flavor but still clearly an invitation to connect " +
      "professionally.\n" +
      "Return JSON with exactly two fields:\n" +
      '  "title": 2-4 words, epic and inviting (e.g. "Send a Raven", "Seek an Audience").\n' +
      '  "text": one or two sentences, max 240 characters, an RPG-flavored ' +
      "invitation to reach out (mention reaching out via LinkedIn or email is " +
      "fine). Do NOT invent any email address, phone number, URL, or personal " +
      "name. Keep it charming, not cringe.\n" +
      "Variation seed " + seed + " — make this noticeably different from other generations."
    );
  }
  return (
    "Rewrite these website section labels in concise high-fantasy Dungeons & " +
    "Dragons RPG style. Keep each label short and still understandable at a " +
    "glance — do not obscure the meaning. For every section key, return an " +
    'object with: "nav" (1-2 words for the navbar), "kicker" (a 2-5 word ' +
    'subtitle), and "title" (1-3 words heading).\n' +
    "Sections (key: meaning): " + JSON.stringify(SECTIONS) + "\n" +
    "Return a single JSON object mapping each section key to its " +
    "{nav, kicker, title}. Variation seed " + seed + "."
  );
}

export async function handleArcaneText(request, env, ctx) {
  const origin = validateOrigin(request);
  if (!origin.ok) {
    return jsonResponse({ error: "Forbidden" }, 403, null);
  }

  const method = request.method || "GET";
  if (method !== "GET" && method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin.corsOrigin, { allow: "GET, POST" });
  }

  const key = env.GEMINI_API_KEY;
  if (!key) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 503, origin.corsOrigin);

  const rl = await checkRateLimit(request, ctx, { bucket: "arcane-text", limit: 12, windowSec: 600 });
  if (!rl.ok) {
    return jsonResponse(
      { error: "Rate limit exceeded. Try again shortly." },
      429,
      origin.corsOrigin,
      { "retry-after": String(rl.retryAfter) }
    );
  }

  const url = new URL(request.url);
  let rawKind = url.searchParams.get("kind") || "labels";
  let rawSeed = url.searchParams.get("seed");

  // Backward-compatible with cached clients that POST { kind, seed }.
  // Client-supplied `base` is intentionally ignored.
  if (method === "POST") {
    try {
      const body = await request.json();
      if (body && typeof body === "object") {
        if (typeof body.kind === "string") rawKind = body.kind;
        if (body.seed != null) rawSeed = String(body.seed);
      }
    } catch (_) {
      /* ignore malformed body, fall back to query params */
    }
  }

  const kind = rawKind === "parley" || rawKind === "lore" ? rawKind : "labels";
  const parsedSeed = parseInt(rawSeed || "", 10);
  const seed = Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 999999
    ? parsedSeed
    : Math.floor(Math.random() * 1e6);

  const model = env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent";

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(kind, seed) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: kind === "labels" ? 0.9 : 1.1,
    },
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
  } catch (_) {
    return jsonResponse({ error: "upstream request failed" }, 502, origin.corsOrigin);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return jsonResponse({ error: "upstream text error", status: res.status }, 502, origin.corsOrigin);
  }

  const data = await res.json();
  const parts =
    (data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || [];
  const text = parts.map((p) => p.text || "").join("").trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "no JSON in response" }, 502, origin.corsOrigin);
    try {
      parsed = JSON.parse(match[0]);
    } catch (_2) {
      return jsonResponse({ error: "invalid JSON in response" }, 502, origin.corsOrigin);
    }
  }

  return jsonResponse(parsed, 200, origin.corsOrigin);
}
