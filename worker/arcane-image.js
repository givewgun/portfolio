/*
 * /api/arcane-image — generates a fantasy background image with Google Gemini.
 *
 * Requires a secret `GEMINI_API_KEY` (free key from https://aistudio.google.com).
 * Optionally set `GEMINI_IMAGE_MODEL` to override the image-capable model.
 *
 * Returns the raw image bytes on success. On any problem it returns a non-2xx
 * JSON response so the browser falls back to Pollinations.ai automatically.
 */

const DEFAULT_MODEL = "gemini-2.5-flash-image-preview";

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

export async function handleArcaneImage(request, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY not configured" }, 503);

  const url = new URL(request.url);
  const prompt = (url.searchParams.get("prompt") || "").slice(0, 800) ||
    "ornate Dungeons & Dragons arcane fantasy background, glowing runes, purple and gold";
  const model = env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" + encodeURIComponent(key);

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
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
  const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!imagePart) return json({ error: "no image in response" }, 502);

  const binary = atob(imagePart.inlineData.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      "content-type": imagePart.inlineData.mimeType || "image/png",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
