/*
 * worker/guard.js — Origin enforcement and per-IP rate limiting for Worker
 * endpoints backed by paid/metered API keys (/api/arcane-image, /api/arcane-text).
 *
 * Defense-in-depth without extra paid bindings:
 *   1. Strict same-origin / allowed-origin check (never Access-Control-Allow-Origin: *).
 *      Localhost origins are permitted ONLY when the Worker itself is served on localhost.
 *   2. Per-IP fixed-window rate limiter backed by both an in-isolate Map (fast + local dev)
 *      and Cloudflare's edge Cache API (`caches.default`, survives isolate churn on a PoP).
 */

const PROD_ORIGINS = new Set([
  "https://givewgun.com",
  "https://www.givewgun.com",
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// In-isolate fallback counter: key -> { count, expiresAt }
const memBuckets = new Map();
const MAX_MEM_ENTRIES = 1024;

function isLocalUrl(urlObj) {
  return LOCAL_HOSTS.has(urlObj.hostname.toLowerCase());
}

function isAllowedOrigin(originStr, reqUrl) {
  if (!originStr) return false;
  let parsed;
  try {
    parsed = new URL(originStr);
  } catch (_) {
    return false;
  }
  const normalized = parsed.origin.toLowerCase();
  if (PROD_ORIGINS.has(normalized)) return true;
  // Allow localhost origins ONLY during local wrangler dev, never in production.
  if (isLocalUrl(reqUrl) && isLocalUrl(parsed) && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
    return true;
  }
  return false;
}

export function validateOrigin(request) {
  const reqUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();

  if (origin) {
    if (!isAllowedOrigin(origin, reqUrl)) {
      return { ok: false, corsOrigin: null, reason: "Origin not allowed" };
    }
    return { ok: true, corsOrigin: new URL(origin).origin };
  }

  if (referer) {
    let refOrigin = "";
    try {
      refOrigin = new URL(referer).origin;
    } catch (_) {
      refOrigin = "";
    }
    if (!isAllowedOrigin(refOrigin, reqUrl)) {
      return { ok: false, corsOrigin: null, reason: "Referer not allowed" };
    }
    return { ok: true, corsOrigin: refOrigin };
  }

  // Same-origin GET requests from browsers may omit Origin/Referer, but send Sec-Fetch-Site.
  if (fetchSite === "same-origin") {
    return { ok: true, corsOrigin: null };
  }

  return { ok: false, corsOrigin: null, reason: "Missing same-origin browser headers" };
}

export function securityHeaders(corsOrigin, extra) {
  const headers = {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "vary": "Origin",
    ...(extra || {}),
  };
  if (corsOrigin) {
    headers["access-control-allow-origin"] = corsOrigin;
  }
  return headers;
}

export function jsonResponse(obj, status, corsOrigin, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: securityHeaders(corsOrigin, {
      "content-type": "application/json",
      ...(extraHeaders || {}),
    }),
  });
}

function getClientIp(request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "local";
}

function pruneMemory(now) {
  if (memBuckets.size < MAX_MEM_ENTRIES) return;
  for (const [k, v] of memBuckets) {
    if (v.expiresAt <= now) memBuckets.delete(k);
  }
  if (memBuckets.size >= MAX_MEM_ENTRIES) memBuckets.clear();
}

export async function checkRateLimit(request, ctx, opts) {
  const bucket = opts.bucket;
  const limit = opts.limit;
  const windowSec = opts.windowSec;
  const now = Date.now();
  const windowId = Math.floor(now / (windowSec * 1000));
  const retryAfter = Math.max(1, Math.ceil(((windowId + 1) * windowSec * 1000 - now) / 1000));
  const ip = getClientIp(request);
  const key = `${bucket}:${ip}:${windowId}`;

  // 1. Check in-isolate counter
  pruneMemory(now);
  const mem = memBuckets.get(key);
  let count = mem && mem.expiresAt > now ? mem.count : 0;

  // 2. Reconcile with Cloudflare edge Cache API when available
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cacheKey = cache
    ? new Request(`https://ratelimit.internal/${encodeURIComponent(key)}`, { method: "GET" })
    : null;

  if (cache && cacheKey) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const cachedCount = parseInt(await hit.text(), 10);
        if (Number.isFinite(cachedCount) && cachedCount > count) {
          count = cachedCount;
        }
      }
    } catch (_) {
      // Ignore cache read failures; in-isolate counter still applies.
    }
  }

  if (count >= limit) {
    return { ok: false, remaining: 0, retryAfter };
  }

  const nextCount = count + 1;
  memBuckets.set(key, { count: nextCount, expiresAt: (windowId + 1) * windowSec * 1000 });

  if (cache && cacheKey) {
    const putPromise = cache
      .put(
        cacheKey,
        new Response(String(nextCount), {
          headers: { "cache-control": `public, max-age=${retryAfter}` },
        })
      )
      .catch(() => {});
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(putPromise);
    else await putPromise;
  }

  return { ok: true, remaining: Math.max(0, limit - nextCount), retryAfter };
}
