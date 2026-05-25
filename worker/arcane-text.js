/*
 * /api/arcane-text — generates RPG-flavored *wording* for the Arcane theme
 * using Google Gemini (free text model). It only rewrites labels/flavor copy,
 * never the real portfolio content.
 *
 *   ?kind=labels  → JSON map of section id → { nav, kicker, title }
 *   ?kind=parley  → JSON { title, text } — a fresh "call to parley" for the
 *                   contact section (regenerated on every summon)
 *   ?seed=N       → variation seed so each summon differs
 *
 * Uses the same secret as the image route (`GEMINI_API_KEY`). Optionally set
 * `GEMINI_TEXT_MODEL` to override the model. On any error it returns a non-2xx
 * JSON response so the browser keeps the static labels from data.js.
 */

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

const SECTIONS = {
  about: "introduction / who I am",
  experience: "professional work history and jobs",
  skills: "technical skills and tools",
  projects: "personal and portfolio projects",
  repos: "open-source GitHub repositories",
  certifications: "professional certifications",
  education: "universities and degrees",
  awards: "awards, recognition, and spoken languages",
  contact: "contact / get in touch",
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function buildPrompt(kind, seed) {
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

export async function handleArcaneText(request, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY not configured" }, 503);

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "parley" ? "parley" : "labels";
  const seed = (url.searchParams.get("seed") || String(Math.floor(Math.random() * 1e6))).slice(0, 12);
  const model = env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" + encodeURIComponent(key);

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(kind, seed) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: kind === "parley" ? 1.15 : 0.9,
    },
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "upstream request failed", detail: String(e) }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    return json({ error: "gemini error", status: res.status, detail }, 502);
  }

  const data = await res.json();
  const parts =
    (data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || [];
  const text = parts.map((p) => p.text || "").join("").trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Be forgiving if the model wraps JSON in prose or code fences.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "no JSON in response", raw: text.slice(0, 200) }, 502);
    try {
      parsed = JSON.parse(match[0]);
    } catch (e2) {
      return json({ error: "invalid JSON in response", raw: text.slice(0, 200) }, 502);
    }
  }

  return json(parsed);
}
