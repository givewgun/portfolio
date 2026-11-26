/* ==========================================================================
 *  tandem-orbit.js — the binary-star visual in the "Latest launch" section.
 *
 *  Two stars (Claude, amber · Gemini, blue) orbit a shared barycenter — a
 *  binary system is literally a pair working "in tandem". Packets of work
 *  fly between them in sync with a sample session log underneath, so the
 *  picture explains the tool: the lead delegates, the partner reads/builds,
 *  reviews always cross to the other model family.
 *
 *  Plain 2D canvas, no deps. Pauses off-screen / in hidden tabs; draws one
 *  static frame (and the full log) under prefers-reduced-motion.
 * ========================================================================== */
(function () {
  "use strict";

  const TAU = Math.PI * 2;

  // A representative session (illustrative, labelled as such in the UI).
  // from/to: "c" Claude, "g" Gemini, "r" the tandem router (no packet).
  const SCRIPT = [
    { from: "c", to: "g", text: "route_task → bulk-read · gemini neon" },
    { from: "g", to: "c", text: "summary of 42 files · 1.3k tokens back" },
    { from: "c", to: "g", text: "ask_gemini · critique the plan" },
    { from: "g", to: "c", text: "3 risks flagged · plan revised" },
    { from: "g", to: "c", text: "review diff · cold, fresh context" },
    { from: "c", to: "g", text: "2 findings · 1 real bug · fixed" },
    { from: "r", to: "g", text: "claude 5h window at 80% → route to gemini" },
    { from: "g", to: "c", text: "tests green · handing back the lead" },
  ];

  function boot() {
    const root = document.getElementById("tandemOrbit");
    if (!root) return;
    const canvas = root.querySelector("canvas");
    const log = root.querySelector("[data-orbit-log]");
    const ctx = canvas && canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let W = 0, H = 0, dpr = 1;
    let colors = readColors();
    let running = false, visible = false, raf = 0;
    let last = 0, t = 0;

    // Fixed background dust so the system sits "in" space.
    const dust = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.2, a: Math.random() * 0.5 + 0.15, p: Math.random() * TAU,
    }));

    const packets = [];
    const pulses = { c: 0, g: 0 };
    let step = 0, nextAt = 0.8;

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const theme = document.documentElement.getAttribute("data-theme");
      return {
        claude: (cs.getPropertyValue("--accent-2") || "#f6b26b").trim(),
        gemini: (cs.getPropertyValue("--accent") || "#8ab4ff").trim(),
        text: (cs.getPropertyValue("--text-dim") || "#7b8aa3").trim(),
        light: theme === "light",
      };
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw();
    }

    // Orbit geometry: ellipse seen at an inclination (y squashed), slight
    // tilt; the two stars sit opposite each other around the barycenter.
    function geom() {
      const cx = W / 2, cy = H * 0.5;
      const R = Math.min(W * 0.36, H * 0.42);
      return { cx, cy, rx: R, ry: R * 0.46, tilt: -0.2 };
    }
    function starPos(angle, scale) {
      const g = geom();
      const x0 = Math.cos(angle) * g.rx * scale;
      const y0 = Math.sin(angle) * g.ry * scale;
      const ct = Math.cos(g.tilt), st = Math.sin(g.tilt);
      // depth: sin(angle) > 0 → nearer the viewer (lower on screen)
      return { x: g.cx + x0 * ct - y0 * st, y: g.cy + x0 * st + y0 * ct, z: Math.sin(angle) };
    }
    function positions() {
      const a = t * 0.42; // slow, stately orbit
      // Claude slightly heavier → slightly tighter orbit around the barycenter.
      return { c: starPos(a, 0.92), g: starPos(a + Math.PI, 1.08) };
    }

    function glow(x, y, r, color, alpha) {
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, withAlpha(color, alpha));
      grd.addColorStop(0.35, withAlpha(color, alpha * 0.35));
      grd.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    function drawStar(p, color, key) {
      const depth = (p.z + 1) / 2; // 0 far … 1 near
      const size = 9 + depth * 5;
      const pulse = pulses[key];
      const flick = 1 + Math.sin(t * 7 + (key === "c" ? 0 : 2)) * 0.04;
      glow(p.x, p.y, size * 7.5 * flick * (1 + pulse * 0.5), color, colors.light ? 0.35 : 0.55);
      glow(p.x, p.y, size * 2.4, color, 0.9);
      ctx.fillStyle = colors.light ? withAlpha(color, 1) : "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 0.55, 0, TAU);
      ctx.fill();
      if (pulse > 0.01) {
        ctx.strokeStyle = withAlpha(color, pulse * 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * (1.5 + (1 - pulse) * 4), 0, TAU);
        ctx.stroke();
      }
    }

    function drawOrbitPath(scale, color) {
      const g = geom();
      ctx.save();
      ctx.translate(g.cx, g.cy);
      ctx.rotate(g.tilt);
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = withAlpha(color, colors.light ? 0.4 : 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, g.rx * scale, g.ry * scale, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Curved path between the stars, bowing away from the barycenter.
    function packetPoint(a, b, k) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const bow = 0.28;
      const cx = mx - dy * bow, cy = my + dx * bow;
      const u = 1 - k;
      return { x: u * u * a.x + 2 * u * k * cx + k * k * b.x, y: u * u * a.y + 2 * u * k * cy + k * k * b.y };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const P = positions();
      const g = geom();

      // dust
      for (const d of dust) {
        const tw = reduce.matches ? 1 : 0.65 + 0.35 * Math.sin(t * 1.3 + d.p);
        ctx.fillStyle = colors.light ? `rgba(40,60,100,${d.a * 0.35 * tw})` : `rgba(220,230,255,${d.a * tw})`;
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, d.r, 0, TAU);
        ctx.fill();
      }

      drawOrbitPath(0.92, colors.claude);
      drawOrbitPath(1.08, colors.gemini);

      // barycenter cross
      ctx.strokeStyle = withAlpha(colors.text, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.cx - 5, g.cy); ctx.lineTo(g.cx + 5, g.cy);
      ctx.moveTo(g.cx, g.cy - 5); ctx.lineTo(g.cx, g.cy + 5);
      ctx.stroke();

      if (!colors.light) ctx.globalCompositeOperation = "lighter";
      // packets (with a short comet tail)
      for (const pk of packets) {
        const a = P[pk.from], b = P[pk.to];
        const col = pk.from === "c" ? colors.claude : colors.gemini;
        for (let i = 6; i >= 0; i--) {
          const k = Math.max(0, pk.k - i * 0.035);
          const q = packetPoint(a, b, k);
          ctx.fillStyle = withAlpha(col, (1 - i / 7) * 0.9);
          ctx.beginPath();
          ctx.arc(q.x, q.y, 2.6 - i * 0.28, 0, TAU);
          ctx.fill();
        }
      }
      // far star first so the near one overlaps it
      const order = P.c.z < P.g.z ? ["c", "g"] : ["g", "c"];
      for (const k of order) drawStar(P[k], k === "c" ? colors.claude : colors.gemini, k);
      ctx.globalCompositeOperation = "source-over";

      // labels
      ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      for (const k of ["c", "g"]) {
        ctx.fillStyle = withAlpha(k === "c" ? colors.claude : colors.gemini, 0.95);
        ctx.fillText(k === "c" ? "CLAUDE" : "GEMINI", P[k].x, P[k].y - 26);
      }
      ctx.font = '500 9px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.fillStyle = withAlpha(colors.text, 0.55);
      ctx.fillText("barycenter", g.cx + 9, g.cy - 7);
      ctx.fillStyle = withAlpha(colors.text, 0.75);
      ctx.textAlign = "right";
      ctx.fillText("TANDEM · BINARY SYSTEM", W - 14, H - 14);
    }

    function addLog(entry, animate) {
      if (!log) return;
      const li = document.createElement("li");
      li.className = "orbit__line orbit__line--" + entry.from + (animate ? " is-new" : "");
      const who = { c: "claude", g: "gemini", r: "router" }[entry.from];
      li.innerHTML = `<span class="orbit__who">${who}</span><span class="orbit__msg"></span>`;
      li.querySelector(".orbit__msg").textContent = entry.text;
      log.appendChild(li);
      while (log.children.length > 4) log.removeChild(log.firstChild);
    }

    function fire() {
      const e = SCRIPT[step % SCRIPT.length];
      step++;
      addLog(e, true);
      if (e.from === "r") {
        pulses[e.to] = 1;
      } else {
        packets.push({ from: e.from, to: e.to, k: 0 });
      }
    }

    function tick(now) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      t += dt;
      nextAt -= dt;
      if (nextAt <= 0) { fire(); nextAt = 2.1; }
      for (let i = packets.length - 1; i >= 0; i--) {
        packets[i].k += dt / 1.1;
        if (packets[i].k >= 1) { pulses[packets[i].to] = 1; packets.splice(i, 1); }
      }
      pulses.c = Math.max(0, pulses.c - dt * 1.4);
      pulses.g = Math.max(0, pulses.g - dt * 1.4);
      draw();
    }

    function start() {
      if (running || reduce.matches || !visible || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function staticFrame() {
      t = 1.2;
      if (log && !log.children.length) SCRIPT.slice(0, 4).forEach((e) => addLog(e, false));
      draw();
    }

    // Wiring
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else addEventListener("resize", resize);
    resize();

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      }, { rootMargin: "80px" }).observe(root);
    } else {
      visible = true;
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    document.addEventListener("themechange", () => {
      // tokens update synchronously with data-theme; read on next frame
      requestAnimationFrame(() => { colors = readColors(); if (!running) draw(); });
    });
    const onMotion = () => (reduce.matches ? (stop(), staticFrame()) : start());
    if (reduce.addEventListener) reduce.addEventListener("change", onMotion);

    if (reduce.matches) staticFrame();
    else { addLog(SCRIPT[SCRIPT.length - 1], false); step = 0; start(); draw(); }
  }

  // "#f6b26b" / "rgb(…)" + alpha → rgba()
  function withAlpha(color, a) {
    const c = String(color).trim();
    if (c[0] === "#") {
      let h = c.slice(1);
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h.slice(0, 6), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b] = m[1].split(",").map((s) => parseFloat(s));
      return `rgba(${r},${g},${b},${a})`;
    }
    return c;
  }

  // main.js renders the section on DOMContentLoaded; this script loads after
  // it, so its listener runs after main's.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
