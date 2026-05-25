/*
 * ============================================================================
 *  resume.js — generates a résumé PDF on the fly from `portfolioData`.
 * ============================================================================
 *  Self-contained module. Exposes a single entry point:
 *
 *      window.PortfolioResume.generate(portfolioData)  // -> downloads a PDF
 *
 *  Design notes:
 *   - The PDF library (jsPDF) is lazy-loaded from a CDN only when the user
 *     actually requests the résumé, so it never slows the initial page load.
 *   - Layout is handled by a small `ResumeBuilder` class that wraps jsPDF with
 *     a flowing text cursor, automatic page breaks, and reusable primitives
 *     (headings, paragraphs, bullet lists, two-column rows). All content comes
 *     straight from the same data object that drives the website, so the
 *     résumé can never drift out of sync.
 *   - Nothing here touches the DOM beyond injecting the library <script>.
 * ============================================================================
 */
(function () {
  "use strict";

  const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  /* ---- Lazy library loader ------------------------------------------------ */
  let loaderPromise = null;
  function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (loaderPromise) return loaderPromise;
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSPDF_URL;
      script.async = true;
      script.onload = () =>
        window.jspdf && window.jspdf.jsPDF
          ? resolve(window.jspdf.jsPDF)
          : reject(new Error("jsPDF loaded but was not found on window."));
      script.onerror = () => {
        loaderPromise = null;
        reject(new Error("Could not load the PDF library."));
      };
      document.head.appendChild(script);
    });
    return loaderPromise;
  }

  /* ---- Theme tokens (RGB) ------------------------------------------------- */
  const COLORS = {
    ink: [26, 32, 44],
    accent: [47, 107, 255],
    muted: [110, 125, 150],
    rule: [219, 226, 236],
    chipBg: [238, 242, 250],
  };

  const FONT = "helvetica";

  /* ======================================================================== */
  /*  ResumeBuilder — a thin layout engine over jsPDF                          */
  /* ======================================================================== */
  class ResumeBuilder {
    constructor(JsPDF) {
      this.doc = new JsPDF({ unit: "pt", format: "a4", compress: true });
      this.pageW = this.doc.internal.pageSize.getWidth();
      this.pageH = this.doc.internal.pageSize.getHeight();
      this.margin = 44;
      this.x = this.margin;
      this.y = this.margin;
      this.maxW = this.pageW - this.margin * 2;
    }

    /* -- low-level helpers -------------------------------------------------- */
    font(style, size, color) {
      this.doc.setFont(FONT, style);
      this.doc.setFontSize(size);
      this.doc.setTextColor.apply(this.doc, color || COLORS.ink);
    }

    ensure(space) {
      if (this.y + space > this.pageH - this.margin) {
        this.doc.addPage();
        this.y = this.margin;
      }
    }

    gap(h) {
      this.y += h;
    }

    rule() {
      this.doc.setDrawColor.apply(this.doc, COLORS.rule);
      this.doc.setLineWidth(0.8);
      this.doc.line(this.x, this.y, this.x + this.maxW, this.y);
    }

    /* -- text primitives ---------------------------------------------------- */
    // Wrapped paragraph. Returns nothing; advances the cursor.
    paragraph(text, opts) {
      const o = Object.assign({ size: 9.5, style: "normal", color: COLORS.ink, indent: 0, gap: 4, lead: 1.35 }, opts);
      this.font(o.style, o.size, o.color);
      const width = this.maxW - o.indent;
      const lines = this.doc.splitTextToSize(text, width);
      const lh = o.size * o.lead;
      for (const line of lines) {
        this.ensure(lh);
        this.doc.text(line, this.x + o.indent, this.y);
        this.y += lh;
      }
      this.y += o.gap;
    }

    bullet(text) {
      const size = 9.5;
      const lead = 1.32;
      const indent = 13;
      this.font("normal", size, COLORS.ink);
      const lines = this.doc.splitTextToSize(text, this.maxW - indent);
      const lh = size * lead;
      this.ensure(lh);
      // marker
      this.doc.setFillColor.apply(this.doc, COLORS.accent);
      this.doc.circle(this.x + 3, this.y - size * 0.32, 1.4, "F");
      lines.forEach((line) => {
        this.ensure(lh);
        this.doc.text(line, this.x + indent, this.y);
        this.y += lh;
      });
      this.y += 1.5;
    }

    sectionTitle(title) {
      this.ensure(34);
      this.gap(8);
      this.font("bold", 10.5, COLORS.accent);
      this.doc.setCharSpace(1.3);
      this.doc.text(title.toUpperCase(), this.x, this.y);
      this.doc.setCharSpace(0);
      this.gap(7);
      this.rule();
      this.gap(13);
    }

    // Title on the left, meta (date) right-aligned on the same baseline.
    rowTitleMeta(title, meta) {
      this.ensure(20);
      this.font("bold", 11, COLORS.ink);
      this.doc.text(title, this.x, this.y);
      if (meta) {
        this.font("normal", 8.5, COLORS.muted);
        const w = this.doc.getTextWidth(meta);
        this.doc.text(meta, this.x + this.maxW - w, this.y);
      }
      this.gap(13);
    }

    // Accent subtitle with an optional muted suffix (e.g. company · location).
    subtitle(main, suffix) {
      this.font("bold", 9.5, COLORS.accent);
      this.doc.text(main, this.x, this.y);
      if (suffix) {
        const w = this.doc.getTextWidth(main);
        this.font("normal", 8.5, COLORS.muted);
        this.doc.text("   " + suffix, this.x + w, this.y);
      }
      this.gap(12);
    }

    // Inline, wrapping list of tokens; tokens with a `url` become clickable.
    tokens(items, opts) {
      const o = Object.assign({ size: 9, sep: "   |   " }, opts);
      const lh = o.size * 1.6;
      this.ensure(lh);
      let cx = this.x;
      items.forEach((it, i) => {
        this.font("normal", o.size, COLORS.muted);
        const sepW = i > 0 ? this.doc.getTextWidth(o.sep) : 0;
        const w = this.doc.getTextWidth(it.label);
        if (cx + sepW + w > this.x + this.maxW) {
          this.y += lh;
          cx = this.x;
        } else if (i > 0) {
          this.doc.text(o.sep, cx, this.y);
          cx += sepW;
        }
        if (it.url) {
          this.doc.setTextColor.apply(this.doc, COLORS.accent);
          this.doc.textWithLink(it.label, cx, this.y, { url: it.url });
        } else {
          this.doc.text(it.label, cx, this.y);
        }
        cx += w;
      });
      this.y += lh;
    }

    // Bold inline label followed by wrapped normal text on subsequent lines.
    labeled(label, text) {
      const size = 9.5;
      const lh = size * 1.32;
      this.ensure(lh * 2);
      this.font("bold", size, COLORS.ink);
      this.doc.text(label, this.x, this.y);
      this.gap(lh);
      this.paragraph(text, { size: size, color: COLORS.muted, gap: 5 });
    }

    /* -- page footer (page numbers) ---------------------------------------- */
    addFooters(name) {
      const total = this.doc.internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        this.doc.setPage(p);
        this.font("normal", 8, COLORS.muted);
        const label = `${name}`;
        this.doc.text(label, this.margin, this.pageH - 22);
        const pageStr = `${p} / ${total}`;
        const w = this.doc.getTextWidth(pageStr);
        this.doc.text(pageStr, this.pageW - this.margin - w, this.pageH - 22);
      }
    }
  }

  /* ======================================================================== */
  /*  Content composition — maps portfolioData into the builder                */
  /* ======================================================================== */
  function compose(b, data) {
    const m = data.meta || {};
    const c = data.contact || {};

    // Header
    b.font("bold", 23, COLORS.ink);
    b.doc.text(m.name || "", b.x, b.y + 8);
    b.gap(20);
    if (m.role) {
      b.font("normal", 12, COLORS.accent);
      b.doc.text(m.role, b.x, b.y);
      b.gap(15);
    }
    const contactTokens = [];
    if (m.location) contactTokens.push({ label: m.location });
    if (c.email) contactTokens.push({ label: c.email, url: "mailto:" + c.email });
    if (c.phone) contactTokens.push({ label: c.phone });
    (c.links || []).forEach((l) => {
      if (l.icon === "linkedin" || l.icon === "github") {
        contactTokens.push({ label: l.url.replace(/^https?:\/\/(www\.)?/, ""), url: l.url });
      }
    });
    b.tokens(contactTokens);
    b.gap(4);
    b.rule();
    b.gap(14);

    // Summary
    if (data.about && (data.about.paragraphs || []).length) {
      b.sectionTitle("Summary");
      data.about.paragraphs.forEach((p) => b.paragraph(p, { gap: 5 }));
    }

    // Experience
    if ((data.experience || []).length) {
      b.sectionTitle("Experience");
      data.experience.forEach((e) => {
        b.ensure(46);
        b.rowTitleMeta(e.role, [e.start, e.end].filter(Boolean).join(" – "));
        b.subtitle(e.company, [e.location, e.note].filter(Boolean).join(" · "));
        (e.bullets || []).forEach((bl) => b.bullet(bl));
        b.gap(5);
      });
    }

    // Skills
    if ((data.skills || []).length) {
      b.sectionTitle("Skills");
      data.skills.forEach((g) => b.labeled(g.group, (g.items || []).join("  ·  ")));
    }

    // Projects
    if ((data.projects || []).length) {
      b.sectionTitle("Projects");
      data.projects.forEach((p) => {
        b.ensure(40);
        b.rowTitleMeta(p.title, p.org || "");
        b.paragraph(p.description, { size: 9.5, color: COLORS.muted, gap: 3 });
        if (p.tags && p.tags.length) b.paragraph(p.tags.join("  ·  "), { size: 8.5, color: COLORS.accent, gap: 6 });
      });
    }

    // Education
    if ((data.education || []).length) {
      b.sectionTitle("Education");
      data.education.forEach((e) => {
        b.ensure(36);
        b.rowTitleMeta(e.school, e.period || "");
        b.subtitle(e.degree, e.location);
        if (e.detail) b.paragraph(e.detail, { size: 9, color: COLORS.muted, gap: 6 });
      });
    }

    // Certifications
    if ((data.certifications || []).length) {
      b.sectionTitle("Certifications");
      data.certifications.forEach((c2) => b.bullet(c2.issuer ? `${c2.name} — ${c2.issuer}` : c2.name));
    }

    // Honors & Awards
    if ((data.awards || []).length) {
      b.sectionTitle("Honors & Awards");
      data.awards.forEach((a) => {
        b.rowTitleMeta(a.name, a.date || "");
        if (a.issuer) b.subtitle(a.issuer);
        if (a.detail) b.paragraph(a.detail, { size: 9, color: COLORS.muted, gap: 6 });
      });
    }

    // Languages
    if ((data.languages || []).length) {
      b.sectionTitle("Languages");
      b.paragraph(data.languages.map((l) => `${l.name} (${l.level})`).join("    ·    "), { gap: 2 });
    }
  }

  /* ======================================================================== */
  /*  Public API                                                              */
  /* ======================================================================== */
  async function generate(data) {
    if (!data) throw new Error("No portfolio data supplied.");
    const JsPDF = await loadJsPDF();
    const builder = new ResumeBuilder(JsPDF);

    builder.doc.setProperties({
      title: `${data.meta.name} — Résumé`,
      author: data.meta.name,
      subject: data.meta.role,
      keywords: (data.skills || []).flatMap((g) => g.items).join(", "),
      creator: "givewgun.com",
    });

    compose(builder, data);
    builder.addFooters(data.meta.name);

    const filename = `${String(data.meta.name).replace(/\s+/g, "_")}_Resume.pdf`;
    builder.doc.save(filename);
    return filename;
  }

  window.PortfolioResume = { generate };
})();
