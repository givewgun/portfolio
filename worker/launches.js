/*
 * /api/launches — proxies and slims Launch Library 2 (v2.3.0) orbital launches
 * with Cloudflare Cache API (stale fallback on upstream failure).
 *   - default (upcoming): limit=12, 15-min freshness
 *   - ?scope=previous:    limit=8,  30-min freshness
 */

const SCOPES = {
  upcoming: {
    upstreamUrl:
      "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=12&mode=detailed&hide_recent_previous=true",
    cacheKeyUrl: "https://cache.internal/api/launches/v1",
    freshMs: 15 * 60 * 1000,
  },
  previous: {
    upstreamUrl:
      "https://ll.thespacedevs.com/2.3.0/launches/previous/?limit=8&mode=detailed",
    cacheKeyUrl: "https://cache.internal/api/launches/previous/v1",
    freshMs: 30 * 60 * 1000,
  },
};
const STALE_MAX_AGE_S = 86400; // keep in edge cache for 24h as stale fallback
const CLIENT_MAX_AGE_S = 300;
const TIMEOUT_MS = 8000;
const USER_AGENT = "givewgun-portfolio/1.0";

function safeUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
}

function isYouTubeUrl(urlStr) {
  try {
    const h = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    return h === "youtube.com" || h === "youtu.be" || h === "youtube-nocookie.com";
  } catch (_) {
    return false;
  }
}

function pickImage(image) {
  if (!image) return null;
  if (typeof image === "string") return safeUrl(image);
  if (typeof image === "object") {
    return safeUrl(image.thumbnail_url) || safeUrl(image.image_url);
  }
  return null;
}

function pickVid(vidUrls) {
  if (!Array.isArray(vidUrls) || !vidUrls.length) return null;
  let firstValid = null;
  for (const item of vidUrls) {
    const u = typeof item === "string" ? item : item && item.url;
    const valid = safeUrl(u);
    if (!valid) continue;
    if (isYouTubeUrl(valid)) return valid;
    if (!firstValid) firstValid = valid;
  }
  return firstValid;
}

function projectLaunch(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const status = r.status && typeof r.status === "object" ? r.status : {};
  const lsp = r.launch_service_provider && typeof r.launch_service_provider === "object"
    ? r.launch_service_provider
    : {};
  const cfg = r.rocket && r.rocket.configuration && typeof r.rocket.configuration === "object"
    ? r.rocket.configuration
    : {};
  const pad = r.pad && typeof r.pad === "object" ? r.pad : {};
  const loc = pad.location && typeof pad.location === "object" ? pad.location : {};
  const mission = r.mission && typeof r.mission === "object" ? r.mission : {};
  const orbit = mission.orbit && typeof mission.orbit === "object" ? mission.orbit : {};

  return {
    id: r.id != null ? String(r.id) : null,
    name: typeof r.name === "string" ? r.name : "",
    net: typeof r.net === "string" ? r.net : null,
    window_start: typeof r.window_start === "string" ? r.window_start : null,
    window_end: typeof r.window_end === "string" ? r.window_end : null,
    status: {
      abbrev: typeof status.abbrev === "string" && status.abbrev ? status.abbrev : "TBD",
      name: typeof status.name === "string" && status.name ? status.name : "To Be Determined",
    },
    provider: typeof lsp.name === "string" ? lsp.name : "",
    rocket: (typeof cfg.full_name === "string" && cfg.full_name) ||
      (typeof cfg.name === "string" && cfg.name) ||
      "",
    pad: typeof pad.name === "string" ? pad.name : "",
    location: typeof loc.name === "string" ? loc.name : "",
    mission: {
      name: typeof mission.name === "string" ? mission.name : "",
      description: typeof mission.description === "string" ? mission.description : "",
      orbit: typeof orbit.abbrev === "string" && orbit.abbrev ? orbit.abbrev : null,
    },
    image: pickImage(r.image),
    webcast_live: Boolean(r.webcast_live),
    vid: pickVid(r.vid_urls),
  };
}

function makeClientResponse(body, status, cacheState, isHead) {
  const headers = {
    "content-type": "application/json",
    "cache-control": status === 200 ? `public, max-age=${CLIENT_MAX_AGE_S}` : "no-store",
    "access-control-allow-origin": "*",
  };
  if (cacheState) headers["x-launches-cache"] = cacheState;
  return new Response(isHead ? null : body, { status, headers });
}

export async function handleLaunches(request, env, ctx) {
  const method = request.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "content-type": "application/json",
        allow: "GET, HEAD",
        "cache-control": "no-store",
      },
    });
  }
  const isHead = method === "HEAD";
  const reqUrl = new URL(request.url);
  const scopeKey = reqUrl.searchParams.get("scope") === "previous" ? "previous" : "upcoming";
  const cfg = SCOPES[scopeKey];

  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cacheKey = new Request(cfg.cacheKeyUrl, { method: "GET" });

  let cached = null;
  if (cache) {
    try {
      cached = await cache.match(cacheKey);
    } catch (_) {
      cached = null;
    }
  }

  if (cached) {
    const cachedAt = Number(cached.headers.get("x-cached-at") || 0);
    if (cachedAt > 0 && Date.now() - cachedAt < cfg.freshMs) {
      const body = await cached.text();
      return makeClientResponse(body, 200, "HIT", isHead);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(cfg.upstreamUrl, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (_) {
    upstream = null;
  } finally {
    clearTimeout(timer);
  }

  if (!upstream || !upstream.ok) {
    if (cached) {
      const staleBody = await cached.text();
      return makeClientResponse(staleBody, 200, "STALE", isHead);
    }
    return makeClientResponse(
      JSON.stringify({ error: "Launch manifest upstream unavailable" }),
      503,
      "ERROR",
      isHead
    );
  }

  let raw;
  try {
    raw = await upstream.json();
  } catch (_) {
    raw = null;
  }

  if (!raw || !Array.isArray(raw.results)) {
    if (cached) {
      const staleBody = await cached.text();
      return makeClientResponse(staleBody, 200, "STALE", isHead);
    }
    return makeClientResponse(
      JSON.stringify({ error: "Invalid upstream launch payload" }),
      503,
      "ERROR",
      isHead
    );
  }

  const payload = {
    updated: new Date().toISOString(),
    launches: raw.results.map(projectLaunch),
  };
  const body = JSON.stringify(payload);

  if (cache) {
    const cacheRes = new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": `public, max-age=${STALE_MAX_AGE_S}`,
        "x-cached-at": String(Date.now()),
      },
    });
    const putPromise = cache.put(cacheKey, cacheRes).catch(() => {});
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(putPromise);
    } else {
      await putPromise;
    }
  }

  return makeClientResponse(body, 200, "MISS", isHead);
}
