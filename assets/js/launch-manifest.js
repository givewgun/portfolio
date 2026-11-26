/* ==========================================================================
 *  launch-manifest.js — Live Launch Manifest, Last-Launch Replay & Ticker
 *  Classic script (IIFE, no modules, no libs).
 *  Public API: window.LaunchManifest = { next, data, previous }
 * ========================================================================== */
(function () {
  "use strict";

  const API_URL = "/api/launches";
  const PREV_API_URL = "/api/launches?scope=previous";
  const LL2_FALLBACK_URL =
    "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=12&mode=normal&hide_recent_previous=true";
  const LL2_PREV_FALLBACK_URL =
    "https://ll.thespacedevs.com/2.3.0/launches/previous/?limit=8&mode=normal";
  const CACHE_KEY = "lm_launches_v1";
  const CACHE_TTL_MS = 20 * 60 * 1000;
  const PREV_CACHE_KEY = "lm_launches_prev_v1";
  const PREV_CACHE_TTL_MS = 60 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 8000;
  const CREDIT_URL = "https://thespacedevs.com";
  const YT_ID_RE = /^[\w-]{11}$/;

  /* ---- Helpers ------------------------------------------------------------ */
  function safeUrl(value) {
    return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
  }

  function extractYouTubeId(urlStr) {
    const valid = safeUrl(urlStr);
    if (!valid) return null;
    let parsed;
    try {
      parsed = new URL(valid);
    } catch (_) {
      return null;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    let id = null;
    if (host === "youtu.be") {
      id = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        id = parsed.searchParams.get("v");
      } else {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if ((parts[0] === "live" || parts[0] === "embed") && parts[1]) id = parts[1];
      }
    }
    return id && YT_ID_RE.test(id) ? id : null;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function isSpaceX(launch) {
    return /spacex/i.test(String((launch && launch.provider) || ""));
  }

  function missionShort(launch) {
    if (launch && launch.mission && launch.mission.name) return String(launch.mission.name);
    const parts = String((launch && launch.name) || "").split("|");
    return (parts.length > 1 ? parts.slice(1).join("|") : parts[0]).trim() || "Orbital Mission";
  }

  function rocketName(launch) {
    if (launch && launch.rocket) return String(launch.rocket);
    const parts = String((launch && launch.name) || "").split("|");
    return (parts[0] || "").trim() || "Launch Vehicle";
  }

  function statusTone(abbrev) {
    const a = String(abbrev || "TBD").trim().toUpperCase();
    if (a === "IN FLIGHT" || a === "INFLIGHT") return "live";
    if (a === "GO" || a === "SUCCESS") return "ok";
    if (a === "PARTIAL FAILURE") return "partial";
    if (a === "FAILURE") return "fail";
    if (a === "HOLD") return "hot";
    return "dim";
  }

  function formatElapsedSince(netIso) {
    const ms = Date.parse(netIso || "");
    if (!Number.isFinite(ms)) return "T+ —";
    const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    const d = Math.floor(diffSec / 86400);
    const h = Math.floor((diffSec % 86400) / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    if (d > 0) return "T+ " + d + "d " + h + "h ago";
    if (h > 0) return "T+ " + h + "h " + m + "m ago";
    return "T+ " + Math.max(1, m) + "m ago";
  }

  function formatCountdown(netIso, compact) {
    const ms = Date.parse(netIso || "");
    if (!Number.isFinite(ms)) return compact ? "T---:--:--:--" : "T- --:--:--:--";
    const diffSec = Math.floor((ms - Date.now()) / 1000);
    const past = diffSec < 0;
    const abs = Math.abs(diffSec);
    const d = Math.floor(abs / 86400);
    const h = Math.floor((abs % 86400) / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return (past ? "T+" : "T-") + (compact ? "" : " ") + pad(d) + ":" + pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  let dateFormatter = null;
  try {
    dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  } catch (_) {
    dateFormatter = null;
  }

  function formatLocalNet(netIso) {
    const ms = Date.parse(netIso || "");
    if (!Number.isFinite(ms)) return "NET TBD";
    const d = new Date(ms);
    try {
      return dateFormatter ? dateFormatter.format(d) : d.toLocaleString();
    } catch (_) {
      return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    }
  }

  function projectRawLaunch(raw) {
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
    const img = r.image;
    const image = img && typeof img === "object"
      ? (safeUrl(img.thumbnail_url) || safeUrl(img.image_url))
      : safeUrl(img);
    let vid = null;
    if (Array.isArray(r.vid_urls)) {
      for (let i = 0; i < r.vid_urls.length; i++) {
        const item = r.vid_urls[i];
        const candidate = safeUrl(typeof item === "string" ? item : item && item.url);
        if (!candidate) continue;
        if (extractYouTubeId(candidate)) {
          vid = candidate;
          break;
        }
        if (!vid) vid = candidate;
      }
    }

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
      image,
      webcast_live: Boolean(r.webcast_live),
      vid,
    };
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.payload || !Array.isArray(parsed.payload.launches)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeCache(key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), payload }));
    } catch (_) {}
  }

  function fetchJson(url) {
    const hasAbort = typeof AbortController === "function";
    const ctrl = hasAbort ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal, headers: { accept: "application/json" } } : { headers: { accept: "application/json" } })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  }

  function loadFeed(apiUrl, fallbackUrl, cacheKey, ttlMs) {
    const cached = readCache(cacheKey);
    if (cached && cached.savedAt && Date.now() - cached.savedAt < ttlMs && cached.payload.launches.length) {
      return Promise.resolve(cached.payload);
    }

    return fetchJson(apiUrl)
      .then((data) => {
        if (!data || !Array.isArray(data.launches)) throw new Error("Invalid launches payload");
        writeCache(cacheKey, data);
        return data;
      })
      .catch(() =>
        fetchJson(fallbackUrl).then((raw) => {
          if (!raw || !Array.isArray(raw.results)) throw new Error("Invalid LL2 payload");
          const payload = {
            updated: new Date().toISOString(),
            launches: raw.results.map(projectRawLaunch),
          };
          writeCache(cacheKey, payload);
          return payload;
        })
      )
      .catch(() => {
        if (cached && cached.payload && cached.payload.launches.length) return cached.payload;
        return null;
      });
  }

  function loadLaunches() {
    return loadFeed(API_URL, LL2_FALLBACK_URL, CACHE_KEY, CACHE_TTL_MS);
  }

  function loadPreviousLaunches() {
    return loadFeed(PREV_API_URL, LL2_PREV_FALLBACK_URL, PREV_CACHE_KEY, PREV_CACHE_TTL_MS);
  }

  /* ---- Public Promise API (lazy, memoized) -------------------------------- */
  let dataPromise = null;
  let nextPromise = null;
  let previousPromise = null;

  function getDataPromise() {
    if (!dataPromise) dataPromise = loadLaunches();
    return dataPromise;
  }

  function getNextPromise() {
    if (!nextPromise) {
      nextPromise = getDataPromise().then((d) =>
        d && Array.isArray(d.launches) && d.launches.length ? d.launches[0] : null
      );
    }
    return nextPromise;
  }

  function getPreviousPromise() {
    if (!previousPromise) previousPromise = loadPreviousLaunches();
    return previousPromise;
  }

  window.LaunchManifest = {
    get data() {
      return getDataPromise();
    },
    get next() {
      return getNextPromise();
    },
    get previous() {
      return getPreviousPromise();
    },
  };

  /* ---- Shared 1 Hz Countdown Ticker --------------------------------------- */
  let manifestTargets = [];
  let elapsedTargets = [];
  let tickerTargets = [];
  let tickInterval = null;
  let visibilityWired = false;

  function tickNow() {
    if (document.hidden) return;
    for (let i = 0; i < manifestTargets.length; i++) {
      const t = manifestTargets[i];
      if (t.el.isConnected) t.el.textContent = formatCountdown(t.net, t.compact);
    }
    for (let i = 0; i < elapsedTargets.length; i++) {
      const t = elapsedTargets[i];
      if (t.el.isConnected) t.el.textContent = formatElapsedSince(t.net);
    }
    for (let i = 0; i < tickerTargets.length; i++) {
      const t = tickerTargets[i];
      if (t.el.isConnected) t.el.textContent = formatCountdown(t.net, t.compact);
    }
  }

  function stopTicker() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function ensureTicker() {
    if (!manifestTargets.length && !elapsedTargets.length && !tickerTargets.length) {
      stopTicker();
      return;
    }
    if (!visibilityWired) {
      visibilityWired = true;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopTicker();
        } else if (manifestTargets.length || elapsedTargets.length || tickerTargets.length) {
          tickNow();
          stopTicker();
          tickInterval = setInterval(tickNow, 1000);
        }
      });
    }
    tickNow();
    if (!document.hidden && tickInterval === null) {
      tickInterval = setInterval(tickNow, 1000);
    }
  }

  /* ---- Manifest Renderer (#launchManifest) -------------------------------- */
  function buildProviderNode(launch, extraClass) {
    const sx = isSpaceX(launch);
    const span = el("span", "lm-provider" + (sx ? " lm-provider--sx" : "") + (extraClass ? " " + extraClass : ""));
    if (sx) {
      const mark = el("span", "lm-sx-mark", "▲");
      mark.setAttribute("aria-hidden", "true");
      span.appendChild(mark);
    }
    span.appendChild(document.createTextNode(launch.provider || "Unknown Provider"));
    return span;
  }

  function buildStatusPill(status) {
    const abbrev = (status && status.abbrev) || "TBD";
    const full = (status && status.name) || abbrev;
    const upper = abbrev.trim().toUpperCase();
    const label = upper === "PARTIAL FAILURE" ? "PARTIAL" : upper;
    const pill = el("span", "lm-pill lm-pill--" + statusTone(abbrev), label);
    pill.title = full;
    return pill;
  }

  function buildLastLaunchBlock(launch, activeFilter) {
    const ytId = extractYouTubeId(launch.vid);
    const vidUrl = safeUrl(launch.vid);
    const card = el(
      "article",
      "lm-replay" + (isSpaceX(launch) ? " lm-replay--sx" : "") + (ytId ? "" : " lm-replay--novid")
    );

    const top = el("div", "lm-replay__top");
    const tags = el("div", "lm-replay__tags");
    tags.appendChild(el("span", "lm-label", activeFilter === "spacex" ? "LAST SPACEX LAUNCH" : "LAST LAUNCH"));
    tags.appendChild(buildStatusPill(launch.status));
    if (launch.mission && launch.mission.orbit) {
      tags.appendChild(el("span", "lm-orbit", "ORBIT · " + launch.mission.orbit));
    }
    top.appendChild(tags);

    const elapsedEl = el("span", "lm-replay__elapsed", formatElapsedSince(launch.net));
    elapsedTargets.push({ el: elapsedEl, net: launch.net });
    top.appendChild(elapsedEl);
    card.appendChild(top);

    const body = el("div", "lm-replay__body");
    const info = el("div", "lm-replay__info");
    const mName = missionShort(launch);
    info.appendChild(el("h3", "lm-replay__mission", mName));

    const meta = el("div", "lm-replay__meta");
    meta.appendChild(el("span", "lm-featured__rocket", rocketName(launch)));
    meta.appendChild(el("span", "lm-sep", "·"));
    meta.appendChild(buildProviderNode(launch, "lm-featured__provider"));
    info.appendChild(meta);

    const padParts = [launch.pad, launch.location].filter(Boolean);
    if (padParts.length) {
      info.appendChild(el("div", "lm-replay__pad", padParts.join(" · ")));
    }

    if (!ytId && vidUrl) {
      const watch = el("a", "lm-webcast lm-replay__link", "Watch webcast ↗");
      watch.href = vidUrl;
      watch.target = "_blank";
      watch.rel = "noopener noreferrer";
      info.appendChild(watch);
    }
    body.appendChild(info);

    if (ytId) {
      const media = el("div", "lm-replay__media");
      const btn = el("button", "lm-facade");
      btn.type = "button";
      btn.setAttribute("aria-label", "Play " + mName + " webcast replay");

      const imgUrl = safeUrl(launch.image);
      if (imgUrl) {
        const img = document.createElement("img");
        img.className = "lm-facade__img";
        img.src = imgUrl;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("error", () => {
          img.hidden = true;
        });
        btn.appendChild(img);
      }

      const scrim = el("span", "lm-facade__scrim");
      scrim.setAttribute("aria-hidden", "true");
      btn.appendChild(scrim);

      const cta = el("span", "lm-facade__cta");
      cta.appendChild(el("span", "", "▶"));
      cta.appendChild(document.createTextNode("REPLAY WEBCAST"));
      btn.appendChild(cta);

      btn.addEventListener("click", () => {
        const iframe = document.createElement("iframe");
        iframe.className = "lm-replay__iframe";
        iframe.src = "https://www.youtube-nocookie.com/embed/" + ytId + "?autoplay=1&rel=0";
        iframe.allow = "autoplay; encrypted-media; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.setAttribute("allowfullscreen", "");
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.title = mName + " — launch webcast replay";
        media.textContent = "";
        media.appendChild(iframe);
      });

      media.appendChild(btn);
      body.appendChild(media);
    }

    card.appendChild(body);
    return card;
  }

  function buildCreditFooter() {
    const foot = el("div", "lm-foot");
    const credit = el("p", "lm-credit");
    credit.appendChild(document.createTextNode("Data: "));
    const a = el("a", "lm-credit__link", "The Space Devs — Launch Library 2");
    a.href = CREDIT_URL;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    credit.appendChild(a);
    foot.appendChild(credit);
    return foot;
  }

  function renderManifestOffline(mount, previousLaunches) {
    manifestTargets = [];
    elapsedTargets = [];
    mount.textContent = "";
    const root = el("div", "lm");

    const head = el("div", "lm-head");
    const titleWrap = el("div", "lm-head__title");
    titleWrap.appendChild(el("span", "lm-kicker", "LIVE LAUNCH MANIFEST"));
    head.appendChild(titleWrap);
    root.appendChild(head);

    const row = el("div", "lm-offline");
    row.setAttribute("role", "status");
    row.appendChild(el("span", "lm-offline__code", "TELEMETRY OFFLINE"));
    row.appendChild(
      el("span", "lm-offline__msg", "Unable to reach Launch Library 2 right now. Check back shortly.")
    );
    root.appendChild(row);
    const prevList = Array.isArray(previousLaunches) ? previousLaunches : [];
    if (prevList.length) {
      root.appendChild(buildLastLaunchBlock(prevList[0], "all"));
    }
    root.appendChild(buildCreditFooter());
    mount.appendChild(root);
    ensureTicker();
  }

  function renderManifest(mount, launches, previousLaunches, activeFilter, onFilterChange) {
    manifestTargets = [];
    elapsedTargets = [];
    mount.textContent = "";

    const prevList = Array.isArray(previousLaunches) ? previousLaunches : [];
    const lastLaunch = activeFilter === "spacex" ? (prevList.find(isSpaceX) || null) : (prevList[0] || null);

    const root = el("div", "lm");

    // Header + ALL / SPACEX filter chips
    const head = el("div", "lm-head");
    const titleWrap = el("div", "lm-head__title");
    titleWrap.appendChild(el("span", "lm-kicker", "LIVE LAUNCH MANIFEST"));
    titleWrap.appendChild(el("span", "lm-sub", "UPCOMING ORBITAL SCHEDULE"));
    head.appendChild(titleWrap);

    const filters = el("div", "lm-filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Filter launches by provider");

    [
      { id: "all", label: "ALL" },
      { id: "spacex", label: "SPACEX" },
    ].forEach((f) => {
      const btn = el("button", "lm-chip", f.label);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(activeFilter === f.id));
      btn.addEventListener("click", () => {
        if (activeFilter !== f.id) {
          if (typeof onFilterChange === "function") onFilterChange(f.id);
          renderManifest(mount, launches, prevList, f.id, onFilterChange);
        }
      });
      filters.appendChild(btn);
    });
    head.appendChild(filters);
    root.appendChild(head);

    const visible = activeFilter === "spacex" ? launches.filter(isSpaceX) : launches;

    if (!visible.length) {
      const empty = el("div", "lm-offline");
      empty.appendChild(el("span", "lm-offline__code", "NO MISSIONS MATCHED"));
      empty.appendChild(el("span", "lm-offline__msg", "No SpaceX launches in the current 12-launch window."));
      root.appendChild(empty);
      if (lastLaunch) {
        root.appendChild(buildLastLaunchBlock(lastLaunch, activeFilter));
      }
      root.appendChild(buildCreditFooter());
      mount.appendChild(root);
      ensureTicker();
      return;
    }

    // Featured "NEXT LAUNCH" block
    const next = visible[0];
    const feat = el("article", "lm-featured" + (isSpaceX(next) ? " lm-featured--sx" : ""));

    const featTop = el("div", "lm-featured__top");
    const tagRow = el("div", "lm-featured__tags");
    tagRow.appendChild(el("span", "lm-label", activeFilter === "spacex" ? "NEXT SPACEX LAUNCH" : "NEXT LAUNCH"));
    tagRow.appendChild(buildStatusPill(next.status));
    if (next.webcast_live) {
      const live = el("span", "lm-live");
      const dot = el("span", "lm-live__dot");
      dot.setAttribute("aria-hidden", "true");
      live.appendChild(dot);
      live.appendChild(document.createTextNode("WEBCAST LIVE"));
      tagRow.appendChild(live);
    }
    featTop.appendChild(tagRow);
    if (next.mission && next.mission.orbit) {
      featTop.appendChild(el("span", "lm-orbit", "ORBIT · " + next.mission.orbit));
    }
    feat.appendChild(featTop);

    const featBody = el("div", "lm-featured__body");

    const info = el("div", "lm-featured__info");
    info.appendChild(el("h3", "lm-featured__mission", missionShort(next)));

    const meta = el("div", "lm-featured__meta");
    meta.appendChild(el("span", "lm-featured__rocket", rocketName(next)));
    meta.appendChild(el("span", "lm-sep", "·"));
    meta.appendChild(buildProviderNode(next, "lm-featured__provider"));
    info.appendChild(meta);

    const padParts = [next.pad, next.location].filter(Boolean);
    if (padParts.length) {
      info.appendChild(el("div", "lm-featured__pad", padParts.join(" · ")));
    }

    if (next.mission && next.mission.description) {
      info.appendChild(el("p", "lm-featured__desc", next.mission.description));
    }
    featBody.appendChild(info);

    const timerBox = el("div", "lm-featured__timer");
    const cdEl = el("div", "lm-countdown", formatCountdown(next.net, false));
    manifestTargets.push({ el: cdEl, net: next.net, compact: false });
    timerBox.appendChild(cdEl);
    timerBox.appendChild(el("div", "lm-net", formatLocalNet(next.net)));

    const vidUrl = safeUrl(next.vid);
    if (vidUrl) {
      const watch = el("a", "lm-webcast", "▶ WATCH WEBCAST");
      watch.href = vidUrl;
      watch.target = "_blank";
      watch.rel = "noopener noreferrer";
      timerBox.appendChild(watch);
    }
    featBody.appendChild(timerBox);

    feat.appendChild(featBody);
    root.appendChild(feat);

    // "LAST LAUNCH" replay block (above upcoming list)
    if (lastLaunch) {
      root.appendChild(buildLastLaunchBlock(lastLaunch, activeFilter));
    }

    // Upcoming list (next ~10)
    const rest = visible.slice(1, 11);
    if (rest.length) {
      const list = el("div", "lm-list");
      list.setAttribute("role", "list");

      for (let i = 0; i < rest.length; i++) {
        const l = rest[i];
        const row = el("article", "lm-row" + (isSpaceX(l) ? " lm-row--sx" : ""));
        row.setAttribute("role", "listitem");

        const mainCol = el("div", "lm-row__main");
        const nameLine = el("div", "lm-row__mission", missionShort(l));
        mainCol.appendChild(nameLine);
        const subParts = [rocketName(l), l.location || l.pad].filter(Boolean);
        mainCol.appendChild(el("div", "lm-row__sub", subParts.join(" · ")));
        row.appendChild(mainCol);

        const provCol = el("div", "lm-row__prov");
        provCol.appendChild(buildProviderNode(l, ""));
        row.appendChild(provCol);

        const statusCol = el("div", "lm-row__status");
        statusCol.appendChild(buildStatusPill(l.status));
        row.appendChild(statusCol);

        const timeCol = el("div", "lm-row__time");
        const rowCd = el("div", "lm-row__cd", formatCountdown(l.net, false));
        manifestTargets.push({ el: rowCd, net: l.net, compact: false });
        timeCol.appendChild(rowCd);
        timeCol.appendChild(el("div", "lm-row__net", formatLocalNet(l.net)));
        row.appendChild(timeCol);

        list.appendChild(row);
      }
      root.appendChild(list);
    }

    root.appendChild(buildCreditFooter());
    mount.appendChild(root);
    ensureTicker();
  }

  /* ---- Footer Ticker Renderer (#nextLaunchTicker) ------------------------- */
  function renderTicker(mount, launch) {
    tickerTargets = [];
    mount.textContent = "";

    const link = el("a", "nlt__link");
    link.href = "launch.html#manifest";

    const dot = el("span", "nlt__dot" + (launch ? "" : " nlt__dot--off"));
    dot.setAttribute("aria-hidden", "true");
    link.appendChild(dot);

    if (!launch) {
      link.appendChild(el("span", "nlt__tag", "NEXT LAUNCH"));
      link.appendChild(el("span", "nlt__sep", "·"));
      link.appendChild(el("span", "nlt__mission", "Telemetry offline — view manifest"));
      mount.appendChild(link);
      ensureTicker();
      return;
    }

    link.appendChild(el("span", "nlt__tag", "NEXT LAUNCH"));
    link.appendChild(el("span", "nlt__sep", "·"));
    link.appendChild(el("span", "nlt__mission", missionShort(launch)));
    link.appendChild(el("span", "nlt__sep", "·"));
    link.appendChild(el("span", "nlt__rocket", rocketName(launch)));
    link.appendChild(el("span", "nlt__sep", "·"));

    const cd = el("span", "nlt__cd", formatCountdown(launch.net, true));
    tickerTargets.push({ el: cd, net: launch.net, compact: true });
    link.appendChild(cd);

    mount.appendChild(link);
    ensureTicker();
  }

  /* ---- Boot --------------------------------------------------------------- */
  function boot() {
    const manifestMount = document.getElementById("launchManifest");
    const tickerMount = document.getElementById("nextLaunchTicker");
    if (!manifestMount && !tickerMount) return;

    let activeFilter = "all";
    let upcomingLaunches = [];
    let previousLaunches = [];
    let upcomingDone = false;

    const setFilter = (nextFilter) => {
      activeFilter = nextFilter;
    };

    const paintManifest = () => {
      if (!manifestMount || !upcomingDone) return;
      if (upcomingLaunches.length) {
        renderManifest(manifestMount, upcomingLaunches, previousLaunches, activeFilter, setFilter);
      } else {
        renderManifestOffline(manifestMount, previousLaunches);
      }
    };

    if (manifestMount) {
      manifestMount.textContent = "";
      const loading = el("div", "lm");
      const row = el("div", "lm-offline");
      row.appendChild(el("span", "lm-offline__code", "ACQUIRING TELEMETRY"));
      row.appendChild(el("span", "lm-offline__msg", "Loading upcoming launch manifest…"));
      loading.appendChild(row);
      manifestMount.appendChild(loading);

      // Fetch previous launches ONLY when #launchManifest is present (never for footer ticker)
      getPreviousPromise().then((prevPayload) => {
        previousLaunches = prevPayload && Array.isArray(prevPayload.launches) ? prevPayload.launches : [];
        if (upcomingDone && previousLaunches.length) paintManifest();
      });
    }

    getDataPromise().then((payload) => {
      upcomingLaunches = payload && Array.isArray(payload.launches) ? payload.launches : [];
      upcomingDone = true;
      paintManifest();
      if (tickerMount) {
        renderTicker(tickerMount, upcomingLaunches[0] || null);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
