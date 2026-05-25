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
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.784 1.401 8.169L12 18.896l-7.335 3.868 1.401-8.169L.132 9.211l8.2-1.193z"/></svg>',
    fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9M12 15v0"/></svg>',
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
      : [
          `https://icons.duckduckgo.com/ip3/${logo}.ico`,
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(logo)}&sz=128`,
        ];
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

    // Nav links from sectionOrder
    $("[data-nav]").innerHTML = D.sectionOrder
      .map((s) => `<a href="#${s.id}">${esc(s.label)}</a>`)
      .join("");

    // Hero
    $("[data-hero-location]").textContent = D.meta.location;
    $("[data-hero-name]").textContent = D.meta.name;
    $("[data-hero-role]").textContent = D.meta.role;
    $("[data-hero-headline]").textContent = D.meta.headline;

    const cta = [];
    const li = D.contact.links.find((l) => l.icon === "linkedin");
    if (li) cta.push(`<a class="btn btn--primary" href="${esc(li.url)}" target="_blank" rel="noopener">${icons.linkedin}View LinkedIn</a>`);
    cta.push(`<a class="btn btn--ghost" href="#contact">${icons.mail}Get in touch</a>`);
    if (D.meta.resumeUrl) cta.push(`<a class="btn btn--ghost" href="${esc(D.meta.resumeUrl)}" target="_blank" rel="noopener">${icons.download}Résumé</a>`);
    $("[data-hero-cta]").innerHTML = cta.join("");

    // Footer social links
    $("[data-footer-links]").innerHTML = D.contact.links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="${esc(l.label)}">${icons[l.icon] || ""}</a>`)
      .join("");
  }

  /* ======================================================================== */
  /*  SECTION BUILDERS                                                        */
  /* ======================================================================== */
  function sectionShell(id, kicker, title, inner, extraClass = "") {
    return `<section class="section ${extraClass}" id="${id}">
      <div class="section__head reveal">
        <div class="section__kicker">${esc(kicker)}</div>
        <h2 class="section__title">${esc(title)}</h2>
      </div>
      ${inner}
    </section>`;
  }

  const builders = {
    about() {
      const stats = D.about.highlights
        .map((h) => `<div class="stat"><div class="stat__value">${esc(h.value)}</div><div class="stat__label">${esc(h.label)}</div></div>`)
        .join("");
      const text = D.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
      const inner = `<div class="about__grid reveal">
        <div class="about__text">${text}</div>
        <div class="about__stats">${stats}</div>
      </div>`;
      return sectionShell("about", "Who I am", "About", inner);
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
            <div class="tl-card">
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
      return sectionShell("experience", "Where I've worked", "Experience", `<div class="timeline">${items}</div>`);
    },

    skills() {
      const cards = D.skills
        .map((g) => {
          const chips = g.items.map((i) => `<span class="chip">${esc(i)}</span>`).join("");
          return `<div class="skill-card reveal"><div class="skill-card__title">${esc(g.group)}</div><div class="chip-row">${chips}</div></div>`;
        })
        .join("");
      return sectionShell("skills", "What I work with", "Skills & Tooling", `<div class="skills__grid">${cards}</div>`);
    },

    projects() {
      const cards = D.projects
        .map((p) => {
          const tags = (p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
          const lnk = p.url ? `<a class="project-card__link" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open project">${icons.external}</a>` : "";
          return `<article class="project-card reveal">
            <div class="project-card__head">
              <div>
                <h3 class="project-card__title">${esc(p.title)}</h3>
                ${p.org ? `<div class="project-card__org">${esc(p.org)}</div>` : ""}
              </div>${lnk}
            </div>
            <p class="project-card__desc">${esc(p.description)}</p>
            ${tags ? `<div class="tag-row">${tags}</div>` : ""}
          </article>`;
        })
        .join("");
      return sectionShell("projects", "Things I've built", "Projects", `<div class="projects__grid">${cards}</div>`);
    },

    repos() {
      const user = D.meta.githubUser;
      const inner = `<div class="repos__grid" id="repos-grid">
          <p class="repos__status reveal">Loading repositories from GitHub…</p>
        </div>
        <div class="repos__cta reveal">
          <a class="btn btn--ghost" href="https://github.com/${esc(user)}" target="_blank" rel="noopener">${icons.github}See all repositories on GitHub</a>
        </div>`;
      return sectionShell("repos", "From my GitHub", "Open Source & Featured Repos", inner);
    },

    certifications() {
      const items = D.certifications
        .map((c) => `<div class="cert-item reveal">
          <div class="cert-item__icon">${icons.badge}</div>
          <div><div class="cert-item__name">${esc(c.name)}</div>${c.issuer ? `<div class="cert-item__issuer">${esc(c.issuer)}</div>` : ""}</div>
        </div>`)
        .join("");
      return sectionShell("certifications", "Credentials", "Certifications", `<div class="cert-list">${items}</div>`);
    },

    education() {
      const cards = D.education
        .map((e) => `<div class="info-card reveal">
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
      return sectionShell("education", "Where I studied", "Education", `<div class="card-grid">${cards}</div>`);
    },

    awards() {
      const cards = D.awards
        .map((a) => `<div class="info-card reveal">
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
      const inner = `<div class="reveal">
        <h2 class="contact__title">Let's build something.</h2>
        <p class="contact__text">Open to architecture, engineering, and consulting conversations. The fastest way to reach me is LinkedIn or email.</p>
        <div class="contact__links">${links}${phone}</div>
      </div>`;
      return `<section class="section contact" id="contact">${inner}</section>`;
    },
  };

  function repoCard(r) {
    const lang = r.language ? `<span class="repo-card__lang"><i></i>${esc(r.language)}</span>` : "";
    const stars = r.stargazers_count ? `<span>${icons.star}${r.stargazers_count}</span>` : "";
    const forks = r.forks_count ? `<span>${icons.fork}${r.forks_count}</span>` : "";
    const meta = lang + stars + forks;
    return `<a class="repo-card reveal is-visible" href="${esc(r.html_url)}" target="_blank" rel="noopener">
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
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`);
      if (!res.ok) throw new Error("GitHub API " + res.status);
      let repos = await res.json();
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

  function renderSections() {
    const html = D.sectionOrder
      .map((s) => (builders[s.id] ? builders[s.id]() : ""))
      .join("");
    $("#sections").innerHTML = html;
  }

  /* ======================================================================== */
  /*  BEHAVIORS                                                               */
  /* ======================================================================== */
  function initTheme() {
    const toggle = $("#themeToggle");
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved);
    else if (window.matchMedia("(prefers-color-scheme: light)").matches) root.setAttribute("data-theme", "light");

    const paint = () => (toggle.innerHTML = root.getAttribute("data-theme") === "light" ? icons.moon : icons.sun);
    paint();
    toggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      paint();
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
      if (e.target.tagName === "A") {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });

    // Scroll-spy
    const navAnchors = [...links.querySelectorAll("a")];
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

  /* ---- Boot --------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderSections();
    initTheme();
    initNav();
    initReveal();
    loadRepos();
  });
})();
