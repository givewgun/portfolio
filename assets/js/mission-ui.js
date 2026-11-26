/* ==========================================================================
 *  mission-ui.js — Command Palette, Toast, Easter Eggs & ISS Ground-Track Radar
 *  Classic script (IIFE, no modules, no libs). Public API: window.MissionUI
 * ========================================================================== */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const BKK_LAT = 13.7563, BKK_LON = 100.5018;
  const ISS_API = "https://api.wheretheiss.at/v1/satellites/25544";
  const ISS_CACHE_KEY = "mission_iss_telemetry_v1";
  const ISS_CACHE_TTL = 60000, ISS_POLL_MS = 10000, ISS_MAX_TRAIL = 20;
  const ISS_BACKOFFS = [30000, 60000, 120000, 240000, 300000];
  const GROUPS = ["Navigate", "Actions", "Theme", "Fun"];
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  // Simplified equirectangular continents (viewBox 0 0 360 180; x=lon+180, y=90-lat)
  const WORLD_PATH =
    "M15,24L24,19L45,21L85,22L86,30L98,37L115,30L126,41L114,46L105,52L100,64L96,61L83,62L85,68L92,69L96,75L102,82L95,80L84,74L76,71L63,58L56,42L42,31L28,30L18,34Z M110,12L135,8L162,9L158,20L136,30L126,20Z M104,80L116,79L128,85L145,97L138,113L125,125L114,138L111,145L105,136L109,108L99,96L100,89Z M175,32L180,34L181,39L174,40Z " +
    "M171,53L171,47L176,42L188,35L185,28L206,19L222,23L246,20L282,16L320,18L354,24L337,38L321,32L314,47L308,55L302,52L302,59L294,68L289,77L285,81L282,78L284,88L279,83L276,74L270,68L261,74L257,82L252,70L242,65L229,61L239,68L224,77L213,60L215,54L203,53L196,50L188,46L175,54Z M174,55L190,53L212,59L220,75L231,79L220,95L215,110L208,123L199,124L194,112L192,96L189,86L173,85L163,75L167,63Z " +
    "M229,103L226,115L224,114L226,106Z M324,47L320,55L311,58L319,51Z M276,85L286,96L284,97L274,87Z M287,96L296,98L295,99L286,98Z M289,89L298,84L299,92L291,93Z M301,72L306,82L303,83L300,74Z M312,92L328,99L325,101L311,95Z M322,101L333,118L327,128L314,123L295,124L295,111L311,102Z M353,126L357,131L349,136L347,134Z M18,167L90,164L165,163L245,162L335,166L350,174L12,174Z";

  const ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    nav: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    top: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    link: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>',
    warp: '<path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5Z"/>',
    iss: '<circle cx="12" cy="12" r="2"/><path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
  };

  const iconSvg = (name, cls) =>
    '<svg class="' + (cls || "cmdk-item__icon") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (ICON_PATHS[name] || ICON_PATHS.nav) + "</svg>";

  /* ---- Utilities ---------------------------------------------------------- */
  const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isMac = () =>
    /mac|iphone|ipad|ipod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "");

  const isEditable = (el) =>
    !!(el && el.nodeType === 1 && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));

  const getData = () => (typeof window.portfolioData === "object" && window.portfolioData) || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const scrollToTarget = (el, block) => el && el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: block || "start" });

  function copyText(text) {
    const fb = () => new Promise((res, rej) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) res(); else rej(new Error("Copy failed"));
      } catch (err) { rej(err); }
    });
    return navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text).catch(fb) : fb();
  }

  function dispatchWarp() {
    document.dispatchEvent(new CustomEvent("space:warp"));
    showToast("Hyperspace engaged ✦");
  }

  function applyTheme(id) {
    const item = document.querySelector('[data-theme-id="' + id + '"]');
    if (item) item.click();
    else {
      document.documentElement.dataset.theme = id;
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: id } }));
    }
  }

  /* ---- Toast -------------------------------------------------------------- */
  let toastEl, toastMsgEl, toastTimer;

  function showToast(msg) {
    if (!msg) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast-pill";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      toastEl.setAttribute("aria-atomic", "true");
      toastEl.innerHTML = '<span class="toast-dot" aria-hidden="true"></span><span class="toast-msg"></span>';
      toastMsgEl = toastEl.querySelector(".toast-msg");
      document.body.appendChild(toastEl);
    }
    clearTimeout(toastTimer);
    toastMsgEl.textContent = String(msg);
    toastEl.classList.remove("is-visible");
    void toastEl.offsetWidth;
    toastEl.classList.add("is-visible");
    toastTimer = setTimeout(() => { if (toastEl) toastEl.classList.remove("is-visible"); }, 2800);
  }

  /* ---- Fuzzy Matching ----------------------------------------------------- */
  function fuzzyScore(query, text) {
    const q = query.trim().toLowerCase();
    if (!q) return 1;
    const t = text.toLowerCase();
    let score = 0, qi = 0, prev = -2;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        score += 10 + (ti === 0 ? 12 : /[\s\-_/:.]/.test(t[ti - 1]) ? 8 : 0) + (ti === prev + 1 ? 6 : 0);
        prev = ti;
        qi++;
      }
    }
    if (qi < q.length) return 0;
    // Strongly prefer a word that starts with the query ("wa" → "warp"),
    // then any substring hit, over a scattered subsequence ("wa" in "awards").
    const wordStart = t.split(/[\s\-_/:.·]+/).some((w) => w.startsWith(q));
    const bonus = wordStart ? 80 : t.indexOf(q) !== -1 ? 30 : 0;
    return Math.max(1, score + bonus - Math.floor(t.length * 0.15));
  }

  /* ---- Command Palette ---------------------------------------------------- */
  let backdropEl, dialogEl, inputEl, listEl, escBtnEl, openerEl, closeTimer;
  let isOpen = false, allCommands = [], visibleCommands = [], activeIdx = 0;

  function buildCommands() {
    const D = getData(), meta = D.meta || {}, contact = D.contact || {};
    const links = Array.isArray(contact.links) ? contact.links : [];
    const sections = Array.isArray(D.sectionOrder) ? D.sectionOrder : [];
    const projects = Array.isArray(D.projects) ? D.projects : [];
    const arcane = D.arcaneLabels || {};
    const curTheme = document.documentElement.dataset.theme || "dark";
    const cmds = [];
    const add = (group, label, keywords, icon, hint, run, hintActive) =>
      cmds.push({ group, label, keywords, icon, hint, run, hintActive: !!hintActive });
    const openUrl = (url) => () => window.open(url, "_blank", "noopener,noreferrer");

    add("Navigate", "Top", "home hero start scroll", "top", "↑", () => {
      const topEl = document.getElementById("top");
      if (topEl) scrollToTarget(topEl, "start");
      else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });

    sections.forEach((s) => {
      if (!s || !s.id) return;
      const alt = arcane[s.id];
      const extra = alt ? [alt.nav, alt.title].filter(Boolean).join(" ") : "";
      add("Navigate", s.label || s.id, "goto jump section " + s.id + " " + extra, "nav", "#" + s.id, () => {
        scrollToTarget(document.getElementById(s.id), "start");
      });
    });

    add("Navigate", "Watch Flight Profile", "flight rocket launch spacex webcast career trajectory", "rocket", "launch.html", () => {
      window.location.href = "launch.html";
    });
    add("Navigate", "Open launch manifest", "launches upcoming schedule countdown spacex ll2 manifest", "rocket", "#manifest", () => {
      window.location.href = "launch.html#manifest";
    });

    if (contact.email) {
      add("Actions", "Copy email", "mail contact address " + contact.email, "copy", "Copy", () => {
        copyText(contact.email).then(
          () => showToast("Email copied — " + contact.email),
          () => showToast("Could not copy email")
        );
      });
    }

    add("Actions", "Download résumé", "resume cv pdf export", "download", "PDF", () => {
      const btn = document.getElementById("resumeBtn");
      if (btn) { btn.click(); showToast("Generating résumé PDF…"); }
      else showToast("Résumé button unavailable");
    });

    const li = links.find((l) => l && (l.icon === "linkedin" || /linkedin/i.test(l.label || "")));
    if (li && li.url) add("Actions", "Open LinkedIn", "social profile career", "link", "↗", openUrl(li.url));

    const gh = links.find((l) => l && (l.icon === "github" || /github/i.test(l.label || "")));
    const ghUrl = (gh && gh.url) || (meta.githubUser ? "https://github.com/" + meta.githubUser : "");
    if (ghUrl) add("Actions", "Open GitHub", "code repos open source", "link", "↗", openUrl(ghUrl));

    const tandem = projects.find((p) => p && /tandem/i.test(p.title || ""));
    const tandemUrl = (tandem && tandem.url) || ("https://github.com/" + (meta.githubUser || "givewgun") + "/tandem");
    add("Actions", "Open tandem on GitHub", "tandem-agents claude gemini mcp repo", "link", "↗", openUrl(tandemUrl));

    add("Actions", "npm install -g tandem-agents", "copy cli install tandem npm", "terminal", "Copy", () => {
      copyText("npm install -g tandem-agents").then(
        () => showToast("Copied: npm install -g tandem-agents"),
        () => showToast("Could not copy command")
      );
    });

    [
      ["dark", "Dark", "space night obsidian"],
      ["light", "Light", "day bright paper"],
      ["arcane", "Arcane", "bg3 dnd gold violet magic"],
    ].forEach(([id, label, kw]) => {
      const on = curTheme === id;
      add("Theme", label, "appearance mode color " + kw, "theme", on ? "Active" : "", () => {
        applyTheme(id);
        showToast("Theme: " + label);
      }, on);
    });

    add("Fun", "Engage warp drive", "hyperspace stars space speed easter egg", "warp", "✦", dispatchWarp);
    add("Fun", "Where is the ISS?", "space station orbit radar telemetry satellite horizon", "iss", "ISS", focusIssRadar);
    return cmds;
  }

  function ensurePalette() {
    if (backdropEl) return;
    backdropEl = document.createElement("div");
    backdropEl.className = "cmdk-backdrop";
    backdropEl.hidden = true;
    backdropEl.innerHTML =
      '<div class="cmdk-dialog" role="dialog" aria-modal="true" aria-labelledby="cmdk-title">' +
        '<span id="cmdk-title" class="cmdk-sr">Command Palette</span>' +
        '<div class="cmdk-head">' + iconSvg("search", "cmdk-head__icon") +
          '<input class="cmdk-input" type="text" autocomplete="off" spellcheck="false" placeholder="Type a command or search…" ' +
            'role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" aria-label="Search commands" />' +
          '<button class="cmdk-esc" type="button" aria-label="Close command palette">ESC</button>' +
        '</div>' +
        '<div class="cmdk-list" id="cmdk-list" role="listbox" aria-label="Commands"></div>' +
        '<div class="cmdk-foot">' +
          '<div class="cmdk-foot__keys"><span><kbd>↑↓</kbd>Navigate</span><span><kbd>↵</kbd>Run</span><span><kbd>Esc</kbd>Close</span></div>' +
          '<span>Mission Control</span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdropEl);
    dialogEl = backdropEl.querySelector(".cmdk-dialog");
    inputEl = backdropEl.querySelector(".cmdk-input");
    listEl = backdropEl.querySelector(".cmdk-list");
    escBtnEl = backdropEl.querySelector(".cmdk-esc");

    backdropEl.addEventListener("mousedown", (e) => { if (e.target === backdropEl) closePalette(); });
    escBtnEl.addEventListener("click", closePalette);
    inputEl.addEventListener("input", () => { activeIdx = 0; renderCommands(inputEl.value); });
    listEl.addEventListener("mousemove", (e) => {
      const item = e.target.closest(".cmdk-item");
      const idx = item ? Number(item.dataset.idx) : NaN;
      if (!Number.isNaN(idx) && idx !== activeIdx) setActive(idx, false);
    });
    listEl.addEventListener("click", (e) => {
      const item = e.target.closest(".cmdk-item");
      const idx = item ? Number(item.dataset.idx) : NaN;
      if (!Number.isNaN(idx)) executeCommand(idx);
    });
    dialogEl.addEventListener("keydown", onDialogKeyDown);
  }

  function renderCommands(query) {
    const q = (query || "").trim();
    const byGroup = Object.create(null);
    GROUPS.forEach((g) => { byGroup[g] = []; });

    allCommands.forEach((cmd) => {
      const score = fuzzyScore(q, cmd.label + " " + cmd.group + " " + (cmd.keywords || ""));
      if (score > 0 && byGroup[cmd.group]) byGroup[cmd.group].push({ cmd, score });
    });

    visibleCommands = [];
    const html = [];
    // While searching, the group holding the best match comes first, so the
    // top (pre-selected) result is the best match overall.
    const best = (g) => byGroup[g].reduce((m, e) => Math.max(m, e.score), 0);
    const order = q ? GROUPS.slice().sort((a, b) => best(b) - best(a)) : GROUPS;
    order.forEach((group) => {
      const entries = byGroup[group];
      if (!entries.length) return;
      if (q) entries.sort((a, b) => b.score - a.score);
      html.push('<div class="cmdk-group" role="presentation">' + esc(group) + "</div>");
      entries.forEach(({ cmd }) => {
        const idx = visibleCommands.length;
        visibleCommands.push(cmd);
        const hint = cmd.hint
          ? '<span class="cmdk-hint' + (cmd.hintActive ? " cmdk-hint--active" : "") + '">' + esc(cmd.hint) + "</span>"
          : "";
        html.push(
          '<div class="cmdk-item" role="option" id="cmdk-opt-' + idx + '" data-idx="' + idx + '" aria-selected="false">' +
            '<span class="cmdk-item__main">' + iconSvg(cmd.icon) + '<span class="cmdk-item__label">' + esc(cmd.label) + "</span></span>" +
            hint + "</div>"
        );
      });
    });

    if (!visibleCommands.length) {
      listEl.innerHTML = '<div class="cmdk-empty">No matching command</div>';
      inputEl.removeAttribute("aria-activedescendant");
      activeIdx = -1;
      return;
    }
    listEl.innerHTML = html.join("");
    if (activeIdx < 0 || activeIdx >= visibleCommands.length) activeIdx = 0;
    setActive(activeIdx, false);
  }

  function setActive(idx, scroll) {
    if (!visibleCommands.length) return;
    const prev = listEl.querySelector(".cmdk-item.is-active");
    if (prev) { prev.classList.remove("is-active"); prev.setAttribute("aria-selected", "false"); }
    activeIdx = ((idx % visibleCommands.length) + visibleCommands.length) % visibleCommands.length;
    const next = listEl.querySelector("#cmdk-opt-" + activeIdx);
    if (next) {
      next.classList.add("is-active");
      next.setAttribute("aria-selected", "true");
      inputEl.setAttribute("aria-activedescendant", next.id);
      if (scroll) next.scrollIntoView({ block: "nearest" });
    }
  }

  function executeCommand(idx) {
    const cmd = visibleCommands[idx];
    if (!cmd) return;
    closePalette();
    try { cmd.run(); } catch (err) { console.error("[MissionUI]", err); }
  }

  function onDialogKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePalette(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (visibleCommands.length) setActive(activeIdx + 1, true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (visibleCommands.length) setActive(activeIdx - 1, true); }
    else if (e.key === "Enter" && document.activeElement !== escBtnEl) { e.preventDefault(); if (activeIdx >= 0) executeCommand(activeIdx); }
    else if (e.key === "Tab") {
      const els = [inputEl, escBtnEl].filter(Boolean);
      const cur = els.indexOf(document.activeElement);
      e.preventDefault();
      const next = e.shiftKey ? els[(cur - 1 + els.length) % els.length] : els[(cur + 1) % els.length];
      if (next) next.focus();
    }
  }

  function openPalette() {
    ensurePalette();
    clearTimeout(closeTimer);
    if (!isOpen) openerEl = document.activeElement;
    isOpen = true;
    allCommands = buildCommands();
    activeIdx = 0;
    inputEl.value = "";
    renderCommands("");
    backdropEl.hidden = false;
    void backdropEl.offsetWidth;
    backdropEl.classList.add("is-open");
    inputEl.focus();
  }

  function closePalette() {
    if (!isOpen || !backdropEl) return;
    isOpen = false;
    backdropEl.classList.remove("is-open");
    const finish = () => { if (!isOpen && backdropEl) backdropEl.hidden = true; };
    if (prefersReducedMotion()) finish(); else closeTimer = setTimeout(finish, 145);
    const restore = openerEl;
    openerEl = null;
    if (restore && restore.isConnected && typeof restore.focus === "function") {
      try { restore.focus(); } catch (_) {}
    }
  }

  /* ---- ISS Ground-Track Mini-Radar ---------------------------------------- */
  let issCardEl, issSvgEl, issTrailGroup, issMarkerGroup, issStatusEl, issTimer, issPulseTimer;
  let issFields = {}, issTrail = [], issLastData = null, issLastTs = 0;
  let issFromCache = false, issInView = false, issFailCount = 0, issInFlight = false;

  function haversineKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const fmtCoord = (v, pos, neg) => Math.abs(v).toFixed(2) + "° " + (v >= 0 ? pos : neg);
  const fmtNum = (v, d) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const canPollIss = () => issInView && document.visibilityState !== "hidden";

  function readIssCache() {
    try {
      const p = JSON.parse(sessionStorage.getItem(ISS_CACHE_KEY) || "null");
      return p && typeof p === "object" ? p : null;
    } catch (_) { return null; }
  }

  function writeIssCache() {
    try {
      sessionStorage.setItem(ISS_CACHE_KEY, JSON.stringify({ ts: issLastTs, data: issLastData, trail: issTrail.slice(-ISS_MAX_TRAIL) }));
    } catch (_) {}
  }

  function renderIssTelemetry(d) {
    if (!issCardEl || !d) return;
    const x = d.lon + 180, y = 90 - d.lat;
    const dist = haversineKm(d.lat, d.lon, BKK_LAT, BKK_LON);

    issFields.lat.textContent = fmtCoord(d.lat, "N", "S");
    issFields.lon.textContent = fmtCoord(d.lon, "E", "W");
    issFields.alt.textContent = fmtNum(d.alt, 1) + " km";
    issFields.vel.textContent = fmtNum(Math.round(d.vel), 0) + " km/h";
    issFields.dist.textContent = fmtNum(Math.round(dist), 0) + " km";

    issMarkerGroup.setAttribute("transform", "translate(" + x.toFixed(2) + "," + y.toFixed(2) + ")");
    issMarkerGroup.removeAttribute("visibility");

    issTrailGroup.textContent = "";
    if (issTrail.length >= 2) {
      const frag = document.createDocumentFragment();
      for (let i = 1; i < issTrail.length; i++) {
        const [lat1, lon1] = issTrail[i - 1], [lat2, lon2] = issTrail[i];
        if (Math.abs(lon2 - lon1) > 180) continue;
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", (lon1 + 180).toFixed(2));
        line.setAttribute("y1", (90 - lat1).toFixed(2));
        line.setAttribute("x2", (lon2 + 180).toFixed(2));
        line.setAttribute("y2", (90 - lat2).toFixed(2));
        line.setAttribute("class", "iss-trail-seg");
        line.setAttribute("stroke-opacity", (0.12 + 0.78 * (i / (issTrail.length - 1))).toFixed(2));
        frag.appendChild(line);
      }
      issTrailGroup.appendChild(frag);
    }

    issSvgEl.setAttribute(
      "aria-label",
      "ISS ground track map: currently at " + fmtCoord(d.lat, "north", "south") + ", " +
        fmtCoord(d.lon, "east", "west") + ", altitude " + fmtNum(d.alt, 1) + " kilometers, " +
        fmtNum(Math.round(dist), 0) + " kilometers from Bangkok."
    );
  }

  function setIssOffline(offline) {
    if (!issCardEl) return;
    issCardEl.classList.toggle("is-offline", offline);
    issStatusEl.hidden = !offline;
    if (offline) issStatusEl.textContent = "Telemetry offline — retrying";
  }

  function clearIssTimer() { if (issTimer) { clearTimeout(issTimer); issTimer = null; } }

  function scheduleIssPoll(delayMs) {
    clearIssTimer();
    if (!canPollIss()) return;
    issTimer = setTimeout(() => { issTimer = null; if (canPollIss()) fetchIss(); }, Math.max(0, delayMs));
  }

  function fetchIss() {
    if (issInFlight || !canPollIss()) return;
    issInFlight = true;
    fetch(ISS_API, { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((raw) => {
        const lat = Number(raw.latitude), lon = Number(raw.longitude), alt = Number(raw.altitude), vel = Number(raw.velocity);
        if (![lat, lon, alt, vel].every(Number.isFinite)) throw new Error("Invalid telemetry");
        issFailCount = 0;
        issFromCache = false;
        issLastData = { lat, lon, alt, vel };
        issLastTs = Date.now();
        const lastPt = issTrail[issTrail.length - 1];
        if (!lastPt || Math.abs(lastPt[0] - lat) > 0.01 || Math.abs(lastPt[1] - lon) > 0.01) {
          issTrail.push([lat, lon]);
          if (issTrail.length > ISS_MAX_TRAIL) issTrail.shift();
        }
        writeIssCache();
        setIssOffline(false);
        renderIssTelemetry(issLastData);
        scheduleIssPoll(ISS_POLL_MS);
      })
      .catch(() => {
        const backoff = ISS_BACKOFFS[Math.min(issFailCount++, ISS_BACKOFFS.length - 1)];
        setIssOffline(true);
        scheduleIssPoll(backoff);
      })
      .finally(() => { issInFlight = false; });
  }

  function syncIssPolling() {
    if (!canPollIss()) { clearIssTimer(); return; }
    const age = issLastTs ? Date.now() - issLastTs : Infinity;
    if (issFromCache && issLastData && age < ISS_CACHE_TTL) scheduleIssPoll(ISS_CACHE_TTL - age);
    else if (issFailCount > 0) scheduleIssPoll(ISS_BACKOFFS[Math.min(issFailCount - 1, ISS_BACKOFFS.length - 1)]);
    else if (issLastData && age < ISS_POLL_MS) scheduleIssPoll(ISS_POLL_MS - age);
    else fetchIss();
  }

  function initIssRadar() {
    const mount = document.getElementById("issRadar");
    if (!mount) return;
    const bkkX = (BKK_LON + 180).toFixed(2), bkkY = (90 - BKK_LAT).toFixed(2);
    const statsHtml = [
      ["lat", "Lat", ""], ["lon", "Lon", ""], ["alt", "Alt", ""], ["vel", "Vel", ""], ["dist", "Dist · Bangkok", " iss-stat--wide"],
    ].map(([k, l, cls]) => '<div class="iss-stat' + cls + '"><span class="iss-label">' + l + '</span><span class="iss-val" data-iss="' + k + '">—</span></div>').join("");

    mount.innerHTML =
      '<div class="iss-card">' +
        '<div class="iss-head"><span class="iss-title"><span class="iss-dot" aria-hidden="true"></span>ISS · LIVE</span><span class="iss-meta">NORAD 25544 · LEO</span></div>' +
        '<div class="iss-body">' +
          '<div class="iss-map-wrap"><svg class="iss-svg" viewBox="0 0 360 180" role="img" aria-label="ISS ground track map — acquiring orbital telemetry"><g aria-hidden="true">' +
            '<path class="iss-grid-line" d="M0,30H360M0,60H360M0,120H360M0,150H360M90,0V180M180,0V180M270,0V180"/>' +
            '<line class="iss-equator" x1="0" y1="90" x2="360" y2="90"/>' +
            '<path class="iss-land" d="' + WORLD_PATH + '"/>' +
            '<g class="iss-trail"></g>' +
            '<g transform="translate(' + bkkX + ',' + bkkY + ')"><circle class="iss-bkk-ring" r="3.4"/><circle class="iss-bkk-dot" r="1.6"/><text class="iss-bkk-label" x="5" y="2.2">BKK</text></g>' +
            '<g class="iss-marker" visibility="hidden"><circle class="iss-marker-ring" r="4"/><circle class="iss-marker-core" r="2.6"/></g>' +
          '</g></svg></div>' +
          '<div class="iss-readout">' + statsHtml + '<div class="iss-status" hidden></div></div>' +
        '</div>' +
        '<div class="iss-foot"><a class="iss-foot__link" href="https://github.com/givewgun/horizon" target="_blank" rel="noopener noreferrer">Tracked like in <strong>Horizon</strong>, my space dashboard</a></div>' +
      '</div>';

    issCardEl = mount.querySelector(".iss-card");
    issSvgEl = mount.querySelector(".iss-svg");
    issTrailGroup = mount.querySelector(".iss-trail");
    issMarkerGroup = mount.querySelector(".iss-marker");
    issStatusEl = mount.querySelector(".iss-status");
    ["lat", "lon", "alt", "vel", "dist"].forEach((k) => { issFields[k] = mount.querySelector('[data-iss="' + k + '"]'); });

    const cached = readIssCache();
    if (cached && Array.isArray(cached.trail)) {
      issTrail = cached.trail.filter((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(-ISS_MAX_TRAIL);
    }
    if (cached && cached.data && Number.isFinite(cached.data.lat)) {
      issLastData = cached.data; issLastTs = Number(cached.ts) || 0; issFromCache = true;
      renderIssTelemetry(issLastData);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { issInView = es.some((e) => e.isIntersecting); syncIssPolling(); }, { threshold: 0.05 }).observe(mount);
    } else { issInView = true; syncIssPolling(); }
    document.addEventListener("visibilitychange", syncIssPolling);
  }

  function focusIssRadar() {
    const mount = document.getElementById("issRadar");
    if (!mount) { showToast("ISS radar unavailable"); return; }
    scrollToTarget(mount, "center");
    if (!issCardEl) return;
    clearTimeout(issPulseTimer);
    issCardEl.classList.remove("iss-card--pulse");
    void issCardEl.offsetWidth;
    issCardEl.classList.add("iss-card--pulse");
    issPulseTimer = setTimeout(() => { if (issCardEl) issCardEl.classList.remove("iss-card--pulse"); }, 1700);
  }

  /* ---- Global Keys, Easter Eggs & Console Greeting ------------------------ */
  let konamiIdx = 0, warpBuf = "", greeted = false;

  function onGlobalKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (isOpen) closePalette(); else openPalette();
      return;
    }
    if (isOpen && e.key === "Escape") { e.preventDefault(); closePalette(); return; }
    if (isOpen || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); return; }

    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KONAMI[konamiIdx]) {
      if (++konamiIdx === KONAMI.length) { konamiIdx = 0; warpBuf = ""; dispatchWarp(); return; }
    } else {
      konamiIdx = (konamiIdx === 2 && k === KONAMI[0]) ? 2 : (k === KONAMI[0] ? 1 : 0);
    }

    if (/^[a-z]$/.test(k)) {
      warpBuf = (warpBuf + k).slice(-4);
      if (warpBuf === "warp") { warpBuf = ""; dispatchWarp(); }
    }
  }

  function printConsoleGreeting() {
    if (greeted) return;
    greeted = true;
    const D = getData();
    const name = (D.meta && D.meta.name) || "Gun Kaewngarm";
    const email = (D.contact && D.contact.email) || "gun.kaewngarm@gmail.com";
    const rocket = ["      /\\", "     /  \\", "    | () |", "    |    |", "   /| /\\ |\\", "  /_| || |_\\", "      **"].join("\n");
    console.log(
      "%c" + rocket + "\n\n%c" + name + " %c— Senior Software Architect\n%cCurious engineer? Let's talk: " + email + "\n%cTry ⌘K",
      "color:#5e8bff;font-family:monospace;font-size:11px;line-height:1.15;",
      "color:#e8eef7;font-family:sans-serif;font-weight:700;font-size:14px;",
      "color:#9fb0c7;font-family:sans-serif;font-weight:400;font-size:13px;",
      "color:#9fb0c7;font-family:monospace;font-size:12px;",
      "color:#f59e0b;font-family:monospace;font-weight:600;font-size:12px;"
    );
  }

  function boot() {
    const btn = document.getElementById("cmdkBtn");
    if (btn) {
      const kbd = btn.querySelector("kbd");
      if (kbd && !isMac()) kbd.textContent = "Ctrl K";
      btn.addEventListener("click", openPalette);
    }
    initIssRadar();
    printConsoleGreeting();
    document.addEventListener("keydown", onGlobalKeyDown);
    document.addEventListener("themechange", () => {
      if (isOpen) { allCommands = buildCommands(); renderCommands(inputEl ? inputEl.value : ""); }
    });
  }

  window.MissionUI = { toast: showToast, open: openPalette, close: closePalette };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
