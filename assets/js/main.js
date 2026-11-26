/* ==========================================================================
 *  main.js — renders `portfolioData` (from data.js) into the page.
 *  You normally won't need to edit this file; edit data.js instead.
 * ========================================================================== */
(function () {
  "use strict";

  const D = window.portfolioData || portfolioData;

  /* ---- Inline SVG icon set ------------------------------------------------ */
  const icons = {
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>',
    wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 10V8M8.5 6.5 7 5M22 6.5 20.5 5M9 22l9-9-2-2-9 9zM15 6l1.5 1.5"/><path d="M11 9 4 16"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.784 1.401 8.169L12 18.896l-7.335 3.868 1.401-8.169L.132 9.211l8.2-1.193z"/></svg>',
    fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9M12 15v0"/></svg>',
    package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    repo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  };

  /* ---- Org logo (local file or favicon providers, initials fallback) ------ */
  // Advances an <img> through its candidate sources on error; when all fail,
  // swaps the badge to an initials fallback. Exposed for inline onerror.
  // Widen the badge for wordmark-style (non-square) logos so they stay legible.
  window.__logoLoaded = function (img) {
    const span = img.parentNode;
    if (!span || !img.naturalWidth || !img.naturalHeight) return;
    if (img.naturalWidth / img.naturalHeight >= 1.6) span.classList.add("org-logo--wide");
    else span.classList.remove("org-logo--wide");
  };

  window.__logoErr = function (img) {
    try {
      const srcs = JSON.parse(img.getAttribute("data-srcs") || "[]");
      const next = parseInt(img.getAttribute("data-i") || "0", 10) + 1;
      if (next < srcs.length) {
        img.setAttribute("data-i", String(next));
        img.src = srcs[next];
        return;
      }
    } catch (e) {}
    const span = img.parentNode;
    if (span) {
      span.classList.add("org-logo--fallback");
      span.textContent = img.getAttribute("data-initials") || "";
    }
  };

  function orgLogo(logo, name) {
    const initials = String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    if (!logo) return `<span class="org-logo org-logo--fallback">${esc(initials)}</span>`;
    // A path or URL ending in an image extension is used directly; otherwise
    // treat `logo` as a domain and try favicon providers in order.
    const isImg = logo.includes("/") || /\.(png|jpe?g|svg|webp|ico|gif)$/i.test(logo);
    const srcs = isImg
      ? [logo]
      : [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(logo)}&sz=128`];
    const data = esc(JSON.stringify(srcs));
    return `<span class="org-logo"><img src="${esc(srcs[0])}" data-srcs='${data}' data-i="0" data-initials="${esc(initials)}" alt="${esc(name)} logo" loading="lazy" onload="window.__logoLoaded(this)" onerror="window.__logoErr(this)"></span>`;
  }

  /* ---- Tiny DOM helpers --------------------------------------------------- */
  const $ = (s, c = document) => c.querySelector(s);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const link = (l) => (l.url ? `<a class="btn btn--ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${icons[l.icon] || ""}${esc(l.label)}</a>` : "");

  /* ======================================================================== */
  /*  HEADER / HERO / NAV                                                     */
  /* ======================================================================== */
  function renderHeader() {
    document.title = `${D.meta.name} — ${D.meta.role}`;
    const desc = $('meta[name="description"]');
    if (desc && D.meta.seoDescription) desc.setAttribute("content", D.meta.seoDescription);

    $("[data-logo]").textContent = D.meta.initials || D.meta.name.slice(0, 2);
    $("[data-name]").textContent = D.meta.name;
    $("[data-footer-name]").textContent = `${D.meta.name} · ${D.meta.role}`;

    // Nav links from sectionOrder (sections flagged `nav: false` stay off the bar)
    $("[data-nav]").innerHTML =
      D.sectionOrder
        .filter((s) => s.nav !== false)
        .map((s) => `<a href="#${s.id}">${esc(s.label)}</a>`)
        .join("") +
      `<a class="nav__flight" href="launch.html">Flight</a>`;

    // Hero. Each word of the name gets a span so CSS can rise it in, staggered.
    $("[data-hero-location]").textContent = D.meta.location;
    const nameEl = $("[data-hero-name]");
    nameEl.innerHTML = D.meta.name
      .split(/\s+/)
      .map((w, i) => `<span class="hero__word"><span style="--i:${i}">${esc(w)}</span></span>`)
      .join(" ");
    $("[data-hero-role]").textContent = D.meta.role;
    const creds = (D.meta.creds || []).map((c) => `<span>${esc(c)}</span>`).join("");
    $("[data-hero-headline]").innerHTML =
      `${esc(D.meta.tagline || D.meta.headline)}` + (creds ? `<span class="hero__creds">${creds}</span>` : "");

    const cta = [];
    cta.push(`<a class="btn btn--primary" href="#projects">Explore the work${icons.arrow}</a>`);
    cta.push(`<a class="btn btn--flight" href="launch.html"><span class="btn__play" aria-hidden="true">▶</span>Watch Flight Profile</a>`);
    const li = D.contact.links.find((l) => l.icon === "linkedin");
    if (li) cta.push(`<a class="btn btn--ghost" href="${esc(li.url)}" target="_blank" rel="noopener">${icons.linkedin}LinkedIn</a>`);
    cta.push(`<button class="btn btn--ghost" id="resumeBtn" type="button">${icons.download}<span data-resume-label>Résumé (PDF)</span></button>`);
    $("[data-hero-cta]").innerHTML = cta.join("");

    // "New launch" pill → the tandem spotlight
    const L = D.launch;
    const pill = $("[data-hero-launch]");
    if (L && pill && D.sectionOrder.some((s) => s.id === "tandem")) {
      pill.hidden = false;
      pill.innerHTML = `<span class="hero__launch-tag">New launch</span><span class="hero__launch-text"><strong>${esc(L.name)}</strong> <span data-tandem-version>${L.version ? "v" + esc(L.version) : ""}</span> · Claude Code + Gemini as one team</span>${icons.arrow}`;
    }

    // Telemetry HUD (decorative; aria-hidden in the markup, so the ticking
    // clock never spams screen readers)
    const c = D.meta.coords;
    const hud = $("[data-hero-hud]");
    if (hud && c) {
      const lat = `${Math.abs(c.lat).toFixed(4)}° ${c.lat >= 0 ? "N" : "S"}`;
      const lon = `${Math.abs(c.lon).toFixed(4)}° ${c.lon >= 0 ? "E" : "W"}`;
      hud.innerHTML = `
        <div class="hud__row"><span>POS</span><b>${lat} · ${lon}</b></div>
        <div class="hud__row"><span>LOCAL</span><b data-hud-local>--:--:--</b><i>${esc(c.tzLabel || "")}</i></div>
        <div class="hud__row"><span>UTC</span><b data-hud-utc>--:--:--</b></div>
        <div class="hud__row hud__row--ok"><span>STATUS</span><b>ALL SYSTEMS NOMINAL</b></div>`;
    }

    // Footer social links
    $("[data-footer-links]").innerHTML = D.contact.links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="${esc(l.label)}">${icons[l.icon] || ""}</a>`)
      .join("");
  }

  function initClock() {
    const local = $("[data-hud-local]");
    const utc = $("[data-hud-utc]");
    if (!local || !utc) return;
    const opts = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
    let fmtLocal;
    try {
      fmtLocal = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: (D.meta.coords && D.meta.coords.tz) || undefined });
    } catch (e) {
      fmtLocal = new Intl.DateTimeFormat("en-GB", opts);
    }
    const fmtUtc = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" });
    const tick = () => {
      if (document.hidden) return;
      const now = new Date();
      local.textContent = fmtLocal.format(now);
      utc.textContent = fmtUtc.format(now);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ======================================================================== */
  /*  SECTION BUILDERS                                                        */
  /* ======================================================================== */
  // Telemetry index ("01", "02", …) from the section's position in
  // sectionOrder. Rendered via CSS attr() so the Arcane label swap, which
  // rewrites the kicker's textContent, never clobbers it.
  const sectionIndex = (id) => {
    const i = D.sectionOrder.findIndex((s) => s.id === id);
    return i < 0 ? "" : String(i + 1).padStart(2, "0");
  };

  function sectionShell(id, kicker, title, inner, extraClass = "") {
    return `<section class="section ${extraClass}" id="${id}">
      <div class="section__head reveal">
        <div class="section__kicker" data-index="${sectionIndex(id)}">${esc(kicker)}</div>
        <h2 class="section__title">${esc(title)}</h2>
      </div>
      ${inner}
    </section>`;
  }

  const builders = {
    about() {
      const stats = D.about.highlights
        .map((h) => `<div class="stat spot"><div class="stat__value" data-count="${esc(h.value)}">${esc(h.value)}</div><div class="stat__label">${esc(h.label)}</div></div>`)
        .join("");
      const text = D.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
      const inner = `<div class="about__grid reveal">
        <div class="about__text">${text}</div>
        <div class="about__stats">${stats}</div>
      </div>
      <p class="arcane-ai-note" hidden></p>`;
      return sectionShell("about", "Mission brief", "About", inner);
    },

    // Latest-launch spotlight (tandem). Live numbers are filled in later by
    // loadTandemStats(); the binary-star visual is drawn by tandem-orbit.js.
    tandem() {
      const L = D.launch;
      if (!L) return "";
      const points = (L.points || [])
        .map((p) => `<li class="launch__point"><b>${esc(p.value)}</b><span>${esc(p.label)}</span></li>`)
        .join("");
      const links = (L.links || [])
        .map((l, i) => `<a class="btn ${i === 0 ? "btn--primary" : "btn--ghost"}" href="${esc(l.url)}" target="_blank" rel="noopener">${icons[l.icon] || ""}${esc(l.label)}</a>`)
        .join("");
      const coverage = (L.coverage || [])
        .map((c) => (c.url
          ? `<a class="launch__chip" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}${icons.external}</a>`
          : `<span class="launch__chip">${esc(c.label)}</span>`))
        .join("");
      const inner = `<div class="launch">
        <div class="launch__grid">
          <div class="launch__copy reveal">
            <div class="launch__name">
              <span class="launch__mark" aria-hidden="true"><i></i><i></i></span>
              <span class="launch__word">${esc(L.name)}</span>
              <span class="launch__ver" data-tandem-version>${L.version ? "v" + esc(L.version) : ""}</span>
              <span class="launch__badge">Open source · MIT</span>
            </div>
            <p class="launch__pitch">${esc(L.pitch)}</p>
            <ul class="launch__points">${points}</ul>
            <div class="launch__install">
              <code><span aria-hidden="true">$</span> ${esc(L.install)}</code>
              <button class="launch__copybtn" type="button" data-copy="${esc(L.install)}" aria-label="Copy install command">${icons.copy}<span>Copy</span></button>
            </div>
            <div class="launch__links">${links}</div>
          </div>
          <div class="launch__visual reveal" aria-hidden="true">
            <div class="orbit" id="tandemOrbit">
              <canvas class="orbit__canvas"></canvas>
              <div class="orbit__legend">
                <span class="orbit__key orbit__key--claude"><i></i>Claude · leads &amp; critiques</span>
                <span class="orbit__key orbit__key--gemini"><i></i>Gemini · reads, researches, builds</span>
              </div>
              <ol class="orbit__log" data-orbit-log></ol>
            </div>
          </div>
        </div>
        <div class="launch__telemetry reveal">
          <div class="launch__metric"><b data-tandem-stars>—</b><span>GitHub stars</span></div>
          <div class="launch__metric"><b data-tandem-dl>—</b><span>npm downloads / month</span></div>
          <div class="launch__metric"><b data-tandem-forks>—</b><span>forks</span></div>
          <div class="launch__metric"><b>0</b><span>runtime dependencies</span></div>
        </div>
        ${L.image ? `<figure class="launch__shot reveal">
          <div class="launch__frame"><span></span><span></span><span></span><em>127.0.0.1:4777 — tandem dashboard</em></div>
          <a href="${esc(L.image)}" target="_blank" rel="noopener"><img src="${esc(L.image)}" alt="${esc(L.imageAlt || "")}" loading="lazy" decoding="async" width="1600" height="1000"></a>
        </figure>` : ""}
        <div class="launch__foot reveal">
          <div class="launch__coverage">${coverage}</div>
          ${L.meta ? `<p class="launch__meta">${esc(L.meta)}</p>` : ""}
        </div>
      </div>`;
      return sectionShell("tandem", `Latest launch · ${L.when || ""}`, L.title, inner, "section--launch");
    },

    experience() {
      const items = D.experience
        .map((e) => {
          const period = `${esc(e.start)} — ${esc(e.end)}`;
          const badge = e.current ? '<span class="tl-badge">Current</span>' : "";
          const note = e.note ? ` · ${esc(e.note)}` : "";
          const bullets = (e.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("");
          const tags = (e.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
          return `<div class="tl-item ${e.current ? "tl-item--current" : ""} reveal">
            <div class="tl-card spot">
              <div class="tl-top">
                <div class="tl-head">
                  ${orgLogo(e.logo, e.company)}
                  <div>
                    <span class="tl-role">${esc(e.role)}</span>${badge}
                    <div class="tl-company">${esc(e.company)}</div>
                  </div>
                </div>
                <span class="tl-period">${period}</span>
              </div>
              <div class="tl-meta">${esc(e.location || "")}${note}</div>
              <ul class="tl-bullets">${bullets}</ul>
              ${tags ? `<div class="tag-row">${tags}</div>` : ""}
            </div>
          </div>`;
        })
        .join("");
      const track = '<div class="timeline__track" aria-hidden="true"><span class="timeline__fill"></span></div>';
      return sectionShell("experience", "Flight log", "Experience", `<div class="timeline">${track}${items}</div>`);
    },

    skills() {
      const cards = D.skills
        .map((g) => {
          const chips = g.items.map((i) => `<span class="chip">${esc(i)}</span>`).join("");
          return `<div class="skill-card spot reveal"><div class="skill-card__title">${esc(g.group)}</div><div class="chip-row">${chips}</div></div>`;
        })
        .join("");
      return sectionShell("skills", "Systems & instruments", "Skills & Tooling", `<div class="skills__grid">${cards}</div>`);
    },

    projects() {
      const cards = D.projects
        .map((p) => {
          const tags = (p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
          const lnk = p.url ? `<a class="project-card__link" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open ${esc(p.title)} on GitHub">${icons.external}</a>` : "";
          const badge = p.featured ? '<span class="project-card__badge">New</span>' : "";
          return `<article class="project-card spot tilt ${p.featured ? "project-card--featured" : ""} reveal">
            <div class="project-card__head">
              <div>
                <h3 class="project-card__title">${esc(p.title)}${badge}</h3>
                ${p.org ? `<div class="project-card__org">${esc(p.org)}</div>` : ""}
              </div>${lnk}
            </div>
            <p class="project-card__desc">${esc(p.description)}</p>
            ${p.featured && D.launch ? `<a class="project-card__more" href="#tandem">See the launch spotlight${icons.arrow}</a>` : ""}
            ${tags ? `<div class="tag-row">${tags}</div>` : ""}
          </article>`;
        })
        .join("");
      return sectionShell("projects", "Missions flown", "Projects", `<div class="projects__grid">${cards}</div>`);
    },

    repos() {
      const user = D.meta.githubUser;
      const inner = `<div class="repos__grid" id="repos-grid">
          <p class="repos__status reveal">Loading repositories from GitHub…</p>
        </div>
        <div class="repos__cta reveal">
          <a class="btn btn--ghost" href="https://github.com/${esc(user)}" target="_blank" rel="noopener">${icons.github}See all repositories on GitHub</a>
        </div>`;
      return sectionShell("repos", "Live telemetry · GitHub", "Open Source & Featured Repos", inner);
    },

    certifications() {
      const items = D.certifications
        .map((c) => `<div class="cert-item spot reveal">
          <div class="cert-item__icon">${icons.badge}</div>
          <div><div class="cert-item__name">${esc(c.name)}</div>${c.issuer ? `<div class="cert-item__issuer">${esc(c.issuer)}</div>` : ""}</div>
        </div>`)
        .join("");
      return sectionShell("certifications", "Flight clearances", "Certifications", `<div class="cert-list">${items}</div>`);
    },

    education() {
      const cards = D.education
        .map((e) => `<div class="info-card spot reveal">
          <div class="info-card__head">
            ${orgLogo(e.logo, e.school)}
            <div>
              <div class="info-card__title">${esc(e.school)}</div>
              <div class="info-card__sub">${esc(e.degree)}</div>
            </div>
          </div>
          <div class="info-card__meta">${esc(e.period)}${e.location ? " · " + esc(e.location) : ""}</div>
          ${e.detail ? `<div class="info-card__detail">${esc(e.detail)}</div>` : ""}
        </div>`)
        .join("");
      return sectionShell("education", "Training", "Education", `<div class="card-grid">${cards}</div>`);
    },

    awards() {
      const cards = D.awards
        .map((a) => `<div class="info-card spot reveal">
          <div class="info-card__title">${esc(a.name)}</div>
          <div class="info-card__sub">${esc(a.issuer)}</div>
          ${a.date ? `<div class="info-card__meta">${esc(a.date)}</div>` : ""}
          ${a.detail ? `<div class="info-card__detail">${esc(a.detail)}</div>` : ""}
        </div>`)
        .join("");
      const langs = (D.languages || [])
        .map((l) => `<div class="lang-pill"><strong>${esc(l.name)}</strong> <span>· ${esc(l.level)}</span></div>`)
        .join("");
      const langBlock = langs ? `<div class="lang-row reveal">${langs}</div>` : "";
      return sectionShell("awards", "Recognition", "Honors & Languages", `<div class="card-grid">${cards}</div>${langBlock}`);
    },

    contact() {
      const links = D.contact.links.map(link).join("");
      const phone = D.contact.phone
        ? `<a class="btn btn--ghost" href="tel:${esc(D.contact.phone.replace(/\s/g, ""))}">${icons.phone}${esc(D.contact.phone)}</a>`
        : "";
      const inner = `<div class="contact__panel spot reveal">
        <div class="section__kicker contact__kicker" data-index="${sectionIndex("contact")}">Open channel</div>
        <h2 class="contact__title">Let's build something.</h2>
        <p class="contact__text">Open to architecture, engineering, and consulting conversations. The fastest way to reach me is LinkedIn or email.</p>
        <div class="contact__links">${links}${phone}</div>
        <p class="arcane-ai-note" hidden></p>
      </div>`;
      return `<section class="section contact" id="contact">${inner}</section>`;
    },
  };

  /* ---- Cached JSON fetch (sessionStorage, TTL) ----------------------------- */
  // Keeps us well under GitHub's 60 req/hr unauthenticated limit across
  // reloads, and lets one GitHub payload feed both the repos grid and the
  // tandem spotlight.
  const inflight = {};
  function cachedJSON(url, ttlMs, shape) {
    const key = "cj:" + url;
    try {
      const hit = JSON.parse(sessionStorage.getItem(key) || "null");
      if (hit && Date.now() - hit.t < ttlMs) return Promise.resolve(hit.v);
    } catch (e) {}
    if (inflight[url]) return inflight[url];
    inflight[url] = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.status + " " + url);
        return res.json();
      })
      .then((v) => {
        if (shape) v = shape(v);
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (e) {}
        return v;
      })
      .finally(() => { delete inflight[url]; });
    return inflight[url];
  }
  const REPO_FIELDS = ["name", "html_url", "description", "language", "stargazers_count", "forks_count", "fork", "archived", "pushed_at"];
  const userRepos = () =>
    cachedJSON(
      `https://api.github.com/users/${encodeURIComponent(D.meta.githubUser)}/repos?per_page=100&sort=updated`,
      15 * 60e3,
      (list) => (Array.isArray(list) ? list.map((r) => Object.fromEntries(REPO_FIELDS.map((f) => [f, r[f]]))) : list)
    );

  function repoCard(r) {
    const lang = r.language ? `<span class="repo-card__lang"><i></i>${esc(r.language)}</span>` : "";
    const stars = r.stargazers_count ? `<span>${icons.star}${r.stargazers_count}</span>` : "";
    const forks = r.forks_count ? `<span>${icons.fork}${r.forks_count}</span>` : "";
    const meta = lang + stars + forks;
    return `<a class="repo-card spot reveal is-visible" href="${esc(r.html_url)}" target="_blank" rel="noopener">
      <div class="repo-card__top">${icons.repo}<span class="repo-card__name">${esc(r.name)}</span></div>
      <p class="repo-card__desc">${esc(r.description || "No description provided.")}</p>
      ${meta ? `<div class="repo-card__meta">${meta}</div>` : ""}
    </a>`;
  }

  async function loadRepos() {
    const grid = $("#repos-grid");
    const user = D.meta.githubUser;
    if (!grid || !user) return;
    const fallback = `<p class="repos__status">Couldn't load repositories right now — <a href="https://github.com/${esc(user)}" target="_blank" rel="noopener">browse them on GitHub</a>.</p>`;
    try {
      let repos = await userRepos();
      if (!Array.isArray(repos)) throw new Error("Unexpected response");
      const patterns = (D.meta.githubExcludePatterns || []).map((p) => p.toLowerCase());
      const limit = D.meta.githubRepoLimit || 6;
      repos = repos
        .filter((r) => !r.fork && !r.archived)
        .filter((r) => !patterns.some((p) => r.name.toLowerCase().includes(p)))
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
        .slice(0, limit);
      if (!repos.length) {
        grid.innerHTML = `<p class="repos__status">No public repositories yet — <a href="https://github.com/${esc(user)}" target="_blank" rel="noopener">visit my GitHub</a>.</p>`;
        return;
      }
      grid.innerHTML = repos.map(repoCard).join("");
    } catch (e) {
      grid.innerHTML = fallback;
    }
  }

  // Live numbers for the tandem spotlight: version + downloads from npm,
  // stars/forks from the (shared, cached) GitHub payload. Each field keeps
  // its "—" placeholder if its source is unreachable.
  function loadTandemStats() {
    const L = D.launch;
    if (!L) return;
    const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : n.toLocaleString("en-US"));
    const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => { el.textContent = text; });
    if (L.npm) {
      cachedJSON(`https://registry.npmjs.org/${encodeURIComponent(L.npm)}/latest`, 30 * 60e3)
        .then((p) => p && p.version && set("[data-tandem-version]", "v" + p.version))
        .catch(() => {});
      cachedJSON(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(L.npm)}`, 60 * 60e3)
        .then((d) => d && typeof d.downloads === "number" && set("[data-tandem-dl]", fmt(d.downloads)))
        .catch(() => {});
    }
    if (L.repo) {
      const name = L.repo.split("/").pop().toLowerCase();
      userRepos()
        .then((repos) => {
          const r = Array.isArray(repos) && repos.find((x) => x.name.toLowerCase() === name);
          if (!r) return;
          set("[data-tandem-stars]", fmt(r.stargazers_count || 0));
          set("[data-tandem-forks]", fmt(r.forks_count || 0));
        })
        .catch(() => {});
    }
  }

  function renderSections() {
    const html = D.sectionOrder
      .map((s) => (builders[s.id] ? builders[s.id]() : ""))
      .join("");
    $("#sections").innerHTML = html;
  }

  /* ======================================================================== */
  /*  BEHAVIORS                                                               */
  /* ======================================================================== */
  const THEMES = [
    { id: "dark", label: "Dark", icon: "moon" },
    { id: "light", label: "Light", icon: "sun" },
    { id: "arcane", label: "Arcane", icon: "wand" },
  ];

  // RPG wording for the Arcane theme. Static labels in data.js are the instant
  // fallback; arcane.js may supply fresher Gemini-generated wording at runtime
  // (runtimeLabels) and a per-summon "Parley" flavor (lastParley). Only the
  // wording/labels change — never the real content.
  let runtimeLabels = null;
  let lastParley = null;
  let lastLore = null;       // fantasy retelling of the About paragraphs
  let aboutOrigHTML = null;  // cached real About markup, for restore
  let loreBusy = false;      // AI lore generation in flight
  let parleyBusy = false;    // AI parley generation in flight

  // Small AI note under a section: "busy" (generating), "done" (disclaimer),
  // or "off" (hidden). Doubles as the wow-factor "this is AI-generated" label.
  function setNote(sectionId, kind, state) {
    const note = document.querySelector("#" + sectionId + " .arcane-ai-note");
    if (!note) return;
    if (state === "off") { note.hidden = true; note.classList.remove("is-busy"); return; }
    note.hidden = false;
    if (state === "busy") {
      note.classList.add("is-busy");
      note.textContent = kind === "lore"
        ? "✦ Conjuring the lore… the arcane scribes are still writing (a few seconds)"
        : "✦ Summoning a fresh parley… (a few seconds)";
    } else {
      note.classList.remove("is-busy");
      note.textContent = "✦ Conjured by AI for the Arcane theme — switch to Dark/Light for the real version";
    }
  }

  // Swap nav + section labels to their Arcane (RPG) variants when active,
  // restoring the originals otherwise. Originals are cached on first run.
  function applyThemeLabels(theme) {
    const arcane = theme === "arcane";
    const base = D.arcaneLabels || {};
    const dyn = runtimeLabels || {};
    const pick = (id, key) => {
      if (!arcane) return null;
      return (dyn[id] && dyn[id][key]) || (base[id] && base[id][key]) || null;
    };
    const swap = (el, key, id) => {
      if (!el) return;
      if (el.dataset.orig === undefined) el.dataset.orig = el.textContent;
      el.textContent = pick(id, key) || el.dataset.orig;
    };
    document.querySelectorAll('[data-nav] a[href^="#"]').forEach((a) => {
      swap(a, "nav", a.getAttribute("href").slice(1));
    });
    document.querySelectorAll("#sections section[id]").forEach((sec) => {
      swap(sec.querySelector(".section__kicker"), "kicker", sec.id);
      swap(sec.querySelector(".section__title") || sec.querySelector(".contact__title"), "title", sec.id);
    });
    applyParleyFlavor(arcane);
    applyLore(arcane);
  }

  // The About ("Lore") section is retold in fantasy style from the real bio,
  // regenerated each summon. The real content is restored when leaving Arcane.
  function applyLore(arcane) {
    const box = document.querySelector(".about__text");
    if (box && aboutOrigHTML === null) aboutOrigHTML = box.innerHTML;
    if (!arcane) {
      if (box) box.innerHTML = aboutOrigHTML;
      setNote("about", "lore", "off");
      return;
    }
    const haveLore = lastLore && lastLore.length;
    if (box) box.innerHTML = haveLore ? lastLore.map((p) => `<p>${esc(p)}</p>`).join("") : aboutOrigHTML;
    setNote("about", "lore", loreBusy ? "busy" : haveLore ? "done" : "off");
  }

  // The contact ("Parley") section gets a fresh RPG invitation each summon.
  function applyParleyFlavor(arcane) {
    const titleEl = document.querySelector(".contact__title");
    const textEl = document.querySelector(".contact__text");
    if (textEl && textEl.dataset.orig === undefined) textEl.dataset.orig = textEl.textContent;
    if (arcane && lastParley) {
      if (titleEl && lastParley.title) titleEl.textContent = lastParley.title;
      if (textEl && lastParley.text) textEl.textContent = lastParley.text;
    } else if (!arcane && textEl) {
      textEl.textContent = textEl.dataset.orig;
    }
    setNote("contact", "parley", !arcane ? "off" : parleyBusy ? "busy" : lastParley ? "done" : "off");
  }

  // localStorage throws when the visitor blocks site data; never let that
  // abort boot (initReveal runs later and would leave sections invisible).
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  function initTheme() {
    const root = document.documentElement;
    const trigger = $("#themeToggle");
    const menu = $("#themeMenu");
    if (!trigger || !menu) return;

    let current = store.get("theme");
    if (!THEMES.some((t) => t.id === current)) {
      current = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }

    const pop = document.createElement("div");
    pop.className = "theme-menu__pop";
    pop.setAttribute("role", "menu");
    pop.innerHTML = THEMES.map(
      (t) => `<button class="theme-menu__item" role="menuitemradio" data-theme-id="${t.id}">${icons[t.icon]}<span>${esc(t.label)}</span></button>`
    ).join("");
    menu.appendChild(pop);

    // ── Discovery cue: nudge visitors toward the opt-in Arcane theme ──────────
    // Stops once the visitor has actually tried Arcane (persisted).
    let hint = null;
    const arcaneSeen = () => store.get("arcaneSeen") === "1";
    const hideHint = () => { if (hint) hint.classList.remove("is-visible"); };
    const clearArcaneCue = () => {
      trigger.classList.remove("theme-toggle--hint");
      const ai = pop.querySelector('[data-theme-id="arcane"]');
      if (ai) ai.classList.remove("theme-menu__item--nudge");
    };
    if (!arcaneSeen() && current !== "arcane") {
      trigger.classList.add("theme-toggle--hint");
      const arcaneItem = pop.querySelector('[data-theme-id="arcane"]');
      if (arcaneItem) arcaneItem.classList.add("theme-menu__item--nudge");
      if (store.get("arcaneHintShown") !== "1") {
        hint = document.createElement("div");
        hint.className = "theme-hint";
        hint.innerHTML =
          '<span class="theme-hint__icon">✦</span>' +
          '<span class="theme-hint__text">Psst… try <strong>Arcane</strong> mode</span>' +
          '<button class="theme-hint__close" type="button" aria-label="Dismiss">×</button>';
        menu.appendChild(hint);
        const autoHide = setTimeout(hideHint, 12000);
        setTimeout(() => { if (hint && !arcaneSeen()) hint.classList.add("is-visible"); }, 2600);
        hint.querySelector(".theme-hint__close").addEventListener("click", (e) => {
          e.stopPropagation();
          clearTimeout(autoHide);
          hideHint();
          store.set("arcaneHintShown", "1");
        });
        hint.addEventListener("click", () => { hideHint(); open(true); });
      }
    }

    const apply = (id) => {
      const theme = THEMES.find((t) => t.id === id) || THEMES[0];
      root.setAttribute("data-theme", theme.id);
      store.set("theme", theme.id);
      trigger.innerHTML = icons[theme.icon];
      pop.querySelectorAll("[data-theme-id]").forEach((b) => {
        const on = b.dataset.themeId === theme.id;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-checked", String(on));
      });
      if (theme.id === "arcane") {
        store.set("arcaneSeen", "1");
        store.set("arcaneHintShown", "1");
        clearArcaneCue();
        hideHint();
      }
      applyThemeLabels(theme.id);
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme.id } }));
    };

    const open = (state) => {
      menu.classList.toggle("is-open", state);
      trigger.setAttribute("aria-expanded", String(state));
    };

    apply(current);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      hideHint();
      store.set("arcaneHintShown", "1");
      open(!menu.classList.contains("is-open"));
    });
    pop.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-id]");
      if (!btn) return;
      apply(btn.dataset.themeId);
      open(false);
    });
    document.addEventListener("click", () => open(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") open(false);
    });
  }

  function initNav() {
    const nav = $("#nav");
    const burger = $("#burger");
    const links = $("[data-nav]");

    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });

    // Scroll-spy (section anchors only; skip external page links like launch.html)
    const navAnchors = [...links.querySelectorAll('a[href^="#"]')];
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            navAnchors.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    document.querySelectorAll("main section[id]").forEach((s) => spy.observe(s));
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-visible"));
      return;
    }
    const obs = new IntersectionObserver(
      (entries, o) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            o.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((e) => obs.observe(e));
  }

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll-linked effects, batched into one rAF per scroll: the nav
  // "altitude" bar and the experience trajectory that draws as you read.
  function initScrollFx() {
    const bar = $(".nav__progress span");
    const tl = $(".timeline");
    const fill = tl && tl.querySelector(".timeline__fill");
    const items = tl ? [...tl.querySelectorAll(".tl-item")] : [];
    let tops = [];
    let maxScroll = 0;
    const measure = () => {
      maxScroll = document.documentElement.scrollHeight - innerHeight;
      tops = items.map((it) => it.offsetTop);
    };
    let queued = false;
    const update = () => {
      queued = false;
      // reads first …
      const y = scrollY;
      const r = tl && fill ? tl.getBoundingClientRect() : null;
      // … then writes. The trajectory tip sits at 60% of the viewport height.
      if (bar) bar.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, y / maxScroll) : 0})`;
      if (r) {
        const tip = innerHeight * 0.6 - r.top;
        fill.style.transform = `scaleY(${Math.max(0, Math.min(1, tip / r.height))})`;
        items.forEach((it, i) => it.classList.toggle("is-passed", tops[i] <= tip));
      }
    };
    const onScroll = () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => { measure(); onScroll(); }, { passive: true });
    // late layout shifts (fonts, repo cards, images) change the page height
    if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); onScroll(); }).observe(document.body);
    measure();
    update();
  }

  // Count stat values ("5M+", "4.11", "6+") up from zero when they appear.
  function initCounters() {
    const els = document.querySelectorAll("[data-count]");
    if (!els.length || reducedMotion() || !("IntersectionObserver" in window)) return;
    const run = (el) => {
      const m = String(el.dataset.count).match(/^(\D*)([\d.]+)(.*)$/);
      if (!m) return;
      const [, pre, num, post] = m;
      const target = parseFloat(num);
      const decimals = (num.split(".")[1] || "").length;
      const t0 = performance.now();
      const dur = 1500;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(2, -10 * k); // easeOutExpo
        el.textContent = pre + (target * (k < 1 ? e : 1)).toFixed(decimals) + post;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { run(en.target); o.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    els.forEach((el) => obs.observe(el));
  }

  // Pointer-tracked spotlight on cards (Linear-style) + a subtle 3D tilt on
  // project cards. Fine pointers only; one delegated listener.
  function initCardFx() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const tiltOn = !reducedMotion();
    let last = null;
    let pending = null;
    let raf = 0;
    const reset = (el) => {
      if (!el) return;
      ["--rx", "--ry", "--mx", "--my"].forEach((v) => el.style.removeProperty(v));
    };
    const apply = () => {
      raf = 0;
      const { card, cx, cy } = pending;
      if (last && last !== card) reset(last);
      last = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = cx - r.left;
      const y = cy - r.top;
      card.style.setProperty("--mx", x + "px");
      card.style.setProperty("--my", y + "px");
      if (tiltOn && card.classList.contains("tilt")) {
        const max = 3.5;
        card.style.setProperty("--ry", ((x / r.width - 0.5) * 2 * max).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-(y / r.height - 0.5) * 2 * max).toFixed(2) + "deg");
      }
    };
    document.addEventListener("pointermove", (e) => {
      pending = { card: e.target.closest ? e.target.closest(".spot") : null, cx: e.clientX, cy: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      raf = 0;
      reset(last);
      last = null;
    });
  }

  // Copy-to-clipboard buttons ([data-copy]).
  function initCopy() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest && e.target.closest("[data-copy]");
      if (!btn) return;
      const label = btn.querySelector("span");
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.classList.add("is-done");
        btn.innerHTML = `${icons.check}<span>Copied</span>`;
        if (window.MissionUI && window.MissionUI.toast) window.MissionUI.toast("Copied — " + btn.dataset.copy);
      } catch (err) {
        if (label) label.textContent = "Select & copy";
      }
      setTimeout(() => {
        btn.classList.remove("is-done");
        btn.innerHTML = `${icons.copy}<span>Copy</span>`;
      }, 1800);
    });
  }

  function initResume() {
    const btn = document.getElementById("resumeBtn");
    if (!btn) return;
    const label = btn.querySelector("[data-resume-label]");
    const original = label ? label.textContent : "";
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      if (!window.PortfolioResume) return;
      btn.disabled = true;
      if (label) label.textContent = "Generating…";
      try {
        await window.PortfolioResume.generate(window.portfolioData || D);
        if (label) label.textContent = original;
      } catch (err) {
        console.error(err);
        if (label) label.textContent = "Try again";
        setTimeout(() => { if (label) label.textContent = original; }, 2500);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Bridge for arcane.js: apply Gemini-generated RPG wording at runtime.
  // Both take effect immediately only while the Arcane theme is active.
  const isArcane = () => document.documentElement.getAttribute("data-theme") === "arcane";
  window.PortfolioArcane = {
    setLabels(map) {
      if (!map || typeof map !== "object") return;
      runtimeLabels = map;
      if (isArcane()) applyThemeLabels("arcane");
    },
    setParley(p) {
      if (!p || typeof p !== "object") return;
      lastParley = p;
      if (isArcane()) applyThemeLabels("arcane");
    },
    setLore(paragraphs) {
      if (!Array.isArray(paragraphs) || !paragraphs.length) return;
      lastLore = paragraphs.map(String);
      if (isArcane()) applyThemeLabels("arcane");
    },
    setBusy(which, on) {
      if (which === "lore") loreBusy = !!on;
      else if (which === "parley") parleyBusy = !!on;
      if (isArcane()) applyThemeLabels("arcane");
    },
  };

  /* ---- Boot --------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderSections();
    initTheme();
    initNav();
    initReveal();
    initResume();
    initClock();
    initScrollFx();
    initCounters();
    initCardFx();
    initCopy();
    loadRepos();
    loadTandemStats();
  });
})();
