/*
 * mars.js — Mission planning: Mars (mars.html)
 * ---------------------------------------------------------------------------
 * 1. Orrery: Mercury–Mars positions from JPL's "Keplerian Elements for
 *    Approximate Positions of the Major Planets" (Standish, valid 1800–2050),
 *    the Earth→Mars phase angle, the next minimum-energy (Hohmann) transfer
 *    window, and a transfer you can fly.
 * 2. Lander: an original propulsive-landing game in Mars gravity.
 */
(function () {
  "use strict";

  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0)); return k * k * (3 - 2 * k); };
  const D2R = Math.PI / 180, DAY = 86400000, AU_KM = 149597870.7, C_KMS = 299792.458;
  const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
  const fmtDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  /* ======================================================================== */
  /*  Ephemeris                                                               */
  /* ======================================================================== */
  // [a, a', e, e', L, L', ϖ, ϖ'] — J2000 values and rates per Julian century.
  const EL = {
    mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 252.2503235, 149472.67411175, 77.45779628, 0.16047689],
    venus:   [0.72333566, 0.0000039, 0.00677672, -0.00004107, 181.9790995, 58517.81538729, 131.60246718, 0.00268329],
    earth:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, 100.46457166, 35999.37244981, 102.93768193, 0.32327364],
    mars:    [1.52371034, 0.00001847, 0.0933941, 0.00007882, -4.55343205, 19140.30268499, -23.94362959, 0.44441088],
  };
  const centuries = (ms) => (ms / DAY + 2440587.5 - 2451545.0) / 36525;
  function kepler(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  }
  function planet(name, ms, out = {}) {
    const k = EL[name], T = centuries(ms);
    const a = k[0] + k[1] * T, e = k[2] + k[3] * T, L = k[4] + k[5] * T, w = k[6] + k[7] * T;
    let M = ((L - w) % 360) * D2R;
    const E = kepler(M, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w * D2R), sw = Math.sin(w * D2R);
    out.x = xp * cw - yp * sw; out.y = xp * sw + yp * cw;
    out.r = Math.hypot(out.x, out.y); out.lon = Math.atan2(out.y, out.x);
    out.a = a; out.e = e; out.w = w * D2R;
    return out;
  }
  const wrap360 = (d) => ((d % 360) + 360) % 360;
  function phaseAt(ms) {
    const E = planet("earth", ms), M = planet("mars", ms);
    return wrap360((M.lon - E.lon) / D2R);
  }
  function hohmann(ms) {
    const E = planet("earth", ms);
    let r2 = planet("mars", ms).r, tof = 259;
    for (let i = 0; i < 3; i++) {
      const a = (E.r + r2) / 2;
      tof = 0.5 * Math.pow(a, 1.5) * 365.25;
      // Mars' distance where the transfer meets it (opposite the departure point)
      const Mars = planet("mars", ms + tof * DAY);
      r2 = Mars.r;
    }
    return { r1: E.r, r2, tof, lon0: E.lon };
  }
  const TARGET = 44; // ° Mars leads Earth for a minimum-energy departure (circular-orbit approx.)
  /** First departure date ≥ fromMs where the phase angle falls through TARGET. */
  function nextWindow(fromMs) {
    let prev = phaseAt(fromMs);
    for (let d = 1; d < 1200; d++) {
      const ms = fromMs + d * DAY, p = phaseAt(ms);
      if (prev >= TARGET && p < TARGET && prev - p < 10) {
        const k = (prev - TARGET) / (prev - p);
        return fromMs + (d - 1 + k) * DAY;
      }
      prev = p;
    }
    return NaN;
  }

  /* ======================================================================== */
  /*  Orrery                                                                  */
  /* ======================================================================== */
  const cv = $("#orrery"), ctx = cv.getContext("2d");
  const ui = {
    state: $("[data-w-state]"), big: $("[data-w-big]"), sub: $("[data-w-sub]"),
    date: $("[data-r-date]"), phase: $("[data-r-phase]"), dist: $("[data-r-dist]"), light: $("[data-r-light]"), tof: $("[data-r-tof]"),
    range: $("#dateRange"), now: $("#nowBtn"), win: $("#windowBtn"), fly: $("#flyBtn"),
  };
  const NOW = Date.now();
  const today = new Date(NOW); today.setHours(12, 0, 0, 0);
  const T0 = today.getTime();
  const nowPhase = phaseAt(T0);
  const OPEN_TOL = 7; // ± degrees of phase ≈ ± 2 weeks
  const isOpen = Math.abs(nowPhase - TARGET) <= OPEN_TOL;
  // For the planner: if the window is open, plan from the ideal day of *this* window.
  const WIN = isOpen ? nextWindow(T0 - 40 * DAY) : nextWindow(T0);
  const WIN_H = hohmann(WIN);

  // Window summary (always about the real "today")
  (function summary() {
    if (!isFinite(WIN)) { setText(ui.state, "OUT OF RANGE"); return; }
    const arrive = new Date(WIN + WIN_H.tof * DAY);
    const days = Math.round((WIN - T0) / DAY);
    if (isOpen) {
      ui.state.classList.add("is-open");
      setText(ui.state, "TRANSFER WINDOW OPEN");
      setText(ui.big, days > 0 ? `OPTIMUM T-${days} D` : days < 0 ? `OPTIMUM T+${-days} D` : "DEPART TODAY");
      setText(ui.sub, `Ideal departure ${fmtDate(new Date(WIN))} · arrive ~${fmtDate(arrive)} · ${Math.round(WIN_H.tof)} days`);
    } else {
      setText(ui.state, "NEXT TRANSFER WINDOW");
      setText(ui.big, `T-${days} DAYS`);
      setText(ui.sub, `Depart ~${fmtDate(new Date(WIN))} · arrive ~${fmtDate(arrive)} · ${Math.round(WIN_H.tof)} days`);
    }
  })();

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    drawOrrery();
  }
  const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.2, a: Math.random() * 0.7 + 0.15 }));
  const orbitCache = {};
  function orbitPath(name, ms) {
    const key = name + Math.round(centuries(ms) * 10);
    if (orbitCache[key]) return orbitCache[key];
    const p = planet(name, ms), pts = [];
    for (let i = 0; i <= 160; i++) {
      const E = (i / 160) * Math.PI * 2;
      const xp = p.a * (Math.cos(E) - p.e), yp = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
      pts.push([xp * Math.cos(p.w) - yp * Math.sin(p.w), xp * Math.sin(p.w) + yp * Math.cos(p.w)]);
    }
    return (orbitCache[key] = pts);
  }

  const view = { rot: -Math.PI / 2, tilt: 0.56, drag: null };
  let simMs = T0, flying = null, arrived = false;

  function proj(x, y) {
    const c = Math.cos(view.rot), s = Math.sin(view.rot);
    const xr = x * c - y * s, yr = x * s + y * c;
    const wide = W > 900;
    const cx = wide ? W * 0.6 : W * 0.5, cy = wide ? (W <= 1400 ? H * 0.42 : H * 0.52) : H * 0.42;
    const sc = Math.min(wide ? W * 0.3 : W * 0.44, H * 0.62) / 1.7;
    return [cx + xr * sc, cy + yr * sc * view.tilt, sc];
  }

  const pE = {}, pM = {}, pV = {}, pH = {};
  function drawOrrery() {
    if (!W) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W * 0.6, H * 0.5, 10, W * 0.6, H * 0.5, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#130a07"); bg.addColorStop(1, "#040203");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    stars.forEach((s) => { ctx.globalAlpha = s.a; ctx.fillStyle = "#fff"; ctx.fillRect(s.x * W, s.y * H, s.r, s.r); });
    ctx.globalAlpha = 1;

    // orbits
    const orbit = (name, col, lw) => {
      const pts = orbitPath(name, simMs);
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const [sx, sy] = proj(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
    };
    orbit("mercury", "rgba(255,255,255,0.07)", 1);
    orbit("venus", "rgba(255,255,255,0.09)", 1);
    orbit("earth", "rgba(90,167,255,0.35)", 1.2);
    orbit("mars", "rgba(224,112,58,0.4)", 1.2);

    // sun
    const [sx, sy, sc] = proj(0, 0);
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sc * 0.13);
    sg.addColorStop(0, "rgba(255,244,214,1)"); sg.addColorStop(0.15, "rgba(255,200,120,0.85)"); sg.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sc * 0.13, 0, Math.PI * 2); ctx.fill();

    planet("earth", simMs, pE); planet("mars", simMs, pM); planet("venus", simMs, pV); planet("mercury", simMs, pH);

    // planned transfer (from the departure in progress, or the planner's window)
    const dep = flying ? flying.dep : WIN, H0 = flying ? flying.h : WIN_H;
    if (isFinite(dep)) {
      const e = (H0.r2 - H0.r1) / (H0.r2 + H0.r1), a = (H0.r1 + H0.r2) / 2;
      ctx.beginPath();
      for (let i = 0; i <= 90; i++) {
        const nu = (i / 90) * Math.PI, r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
        const [px, py] = proj(r * Math.cos(H0.lon0 + nu), r * Math.sin(H0.lon0 + nu));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.setLineDash([5, 6]); ctx.strokeStyle = flying ? "rgba(255,106,43,0.9)" : "rgba(255,106,43,0.45)"; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
      // departure / arrival ticks
      const tick = (r, ang, label) => {
        const [px, py] = proj(r * Math.cos(ang), r * Math.sin(ang));
        ctx.strokeStyle = "rgba(255,106,43,0.8)"; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,180,140,0.8)"; ctx.font = "500 9px 'JetBrains Mono', monospace"; ctx.fillText(label, px + 8, py + 3);
      };
      tick(H0.r1, H0.lon0, "DEPART " + fmtDate(new Date(dep)));
      tick(H0.r2, H0.lon0 + Math.PI, "ARRIVE " + fmtDate(new Date(dep + H0.tof * DAY)));
    }

    // phase-angle wedge
    const pr = 0.42;
    ctx.beginPath();
    const steps = 48, a0 = pE.lon, da = phaseAt(simMs) * D2R;
    for (let i = 0; i <= steps; i++) { const ang = a0 + (da * i) / steps; const [px, py] = proj(pr * Math.cos(ang), pr * Math.sin(ang)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.stroke();
    [pE, pM].forEach((p) => { const [ax, ay] = proj(0, 0), [bx, by] = proj(p.x, p.y); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.stroke(); });
    {
      const mid = a0 + da / 2; const [px, py] = proj((pr + 0.1) * Math.cos(mid), (pr + 0.1) * Math.sin(mid));
      ctx.fillStyle = "#fff"; ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(Math.round(phaseAt(simMs)) + "°", px, py + 3); ctx.textAlign = "left";
    }

    // planets
    const body = (p, col, r, label) => {
      const [px, py] = proj(p.x, p.y);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
      g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      if (label) { ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.fillText(label, px + r + 6, py - r - 2); }
    };
    body(pH, "rgba(180,170,160,0.9)", 2.2, "");
    body(pV, "rgba(240,220,170,0.95)", 3.4, "");
    body(pE, "#5aa7ff", 5, "EARTH");
    body(pM, "#e0703a", 4.2, "MARS");

    // ship
    if (flying) {
      const t = clamp((simMs - flying.dep) / (flying.h.tof * DAY));
      const e = (flying.h.r2 - flying.h.r1) / (flying.h.r2 + flying.h.r1), a = (flying.h.r1 + flying.h.r2) / 2;
      const E = kepler(Math.PI * t, e);
      const nu = 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      const ang = flying.h.lon0 + nu;
      const [px, py] = proj(r * Math.cos(ang), r * Math.sin(ang));
      ctx.fillStyle = "#fff"; ctx.shadowColor = "#ff6a2b"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff"; ctx.font = "600 10px 'JetBrains Mono', monospace";
      ctx.fillText("GK-2 · DAY " + Math.round(t * flying.h.tof), px + 8, py - 6);
    }
  }

  function updateReadouts() {
    const d = new Date(simMs);
    setText(ui.date, fmtDate(d));
    setText(ui.phase, phaseAt(simMs).toFixed(1) + "°");
    const dist = Math.hypot(pE.x - pM.x, pE.y - pM.y);
    setText(ui.dist, (dist * AU_KM / 1e6).toFixed(1) + " M KM");
    setText(ui.light, "light-time " + ((dist * AU_KM) / C_KMS / 60).toFixed(1) + " min");
    setText(ui.tof, Math.round(hohmann(simMs).tof) + " DAYS");
  }
  function setDay(d) {
    simMs = T0 + d * DAY;
    if (+ui.range.value !== Math.round(d)) ui.range.value = String(Math.round(d));
    drawOrrery(); updateReadouts();
  }
  let animId = 0;
  function stopAnim() {
    if (animId) cancelAnimationFrame(animId);
    animId = 0;
    if (flying) {
      flying = null; ui.fly.disabled = false;
      if (!arrived) setText(ui.state, ui.state.dataset.orig || ui.state.textContent);
    }
  }
  ui.range.addEventListener("input", () => { stopAnim(); setDay(+ui.range.value); });
  ui.now.addEventListener("click", () => { stopAnim(); animateTo(0); });
  ui.win.addEventListener("click", () => { stopAnim(); animateTo((WIN - T0) / DAY); });
  function animateTo(targetDay) {
    const from = (simMs - T0) / DAY;
    if (REDUCE) return setDay(targetDay);
    const t0 = performance.now(), dur = 1100;
    const step = (now) => {
      const k = smooth(0, 1, (now - t0) / dur);
      setDay(lerp(from, targetDay, k));
      animId = k < 1 ? requestAnimationFrame(step) : 0;
    };
    animId = requestAnimationFrame(step);
  }
  ui.fly.addEventListener("click", () => {
    if (arrived) { $("#land").scrollIntoView({ behavior: REDUCE ? "auto" : "smooth" }); return; }
    if (!isFinite(WIN)) return;
    stopAnim();
    ui.state.dataset.orig = ui.state.textContent;
    flying = { dep: WIN, h: WIN_H };
    const t0 = performance.now(), dur = REDUCE ? 1 : 9000;
    const startDay = (WIN - T0) / DAY, endDay = startDay + WIN_H.tof;
    ui.fly.disabled = true;
    setText(ui.state, "IN TRANSIT · GK-2");
    const step = (now) => {
      if (!flying) return; // cancelled by NOW / NEXT WINDOW / the slider
      const k = clamp((now - t0) / dur);
      setDay(lerp(startDay, endDay, k));
      if (k < 1) animId = requestAnimationFrame(step);
      else {
        animId = 0;
        arrived = true; ui.fly.disabled = false;
        ui.state.classList.add("is-open");
        setText(ui.state, "ARRIVED · MARS ORBIT");
        setText(ui.big, "NOW LAND IT ↓");
        setText(ui.sub, `Transit ${Math.round(WIN_H.tof)} days · arrived ${fmtDate(new Date(WIN + WIN_H.tof * DAY))}`);
        ui.fly.textContent = "LAND IT ▾";
      }
    };
    animId = requestAnimationFrame(step);
  });
  // drag to rotate the view
  cv.addEventListener("pointerdown", (e) => { view.drag = { x: e.clientX, y: e.clientY, rot: view.rot, tilt: view.tilt }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!view.drag) return;
    view.rot = view.drag.rot + (e.clientX - view.drag.x) * 0.006;
    view.tilt = clamp(view.drag.tilt - (e.clientY - view.drag.y) * 0.003, 0.2, 1);
    drawOrrery();
  });
  cv.addEventListener("pointerup", () => { view.drag = null; });
  cv.addEventListener("pointercancel", () => { view.drag = null; });
  addEventListener("resize", () => { resize(); resizeLander(); });
  resize(); setDay(0);
  // Gentle slow rotation so the page feels alive (only while on screen).
  let orreryVisible = true;
  new IntersectionObserver((es) => { orreryVisible = es[es.length - 1].isIntersecting; }).observe(cv);
  if (!REDUCE) {
    let last = performance.now();
    const drift = (now) => {
      const dt = now - last; last = now;
      if (orreryVisible && !flying && !view.drag && !document.hidden && document.activeElement !== ui.range) {
        view.rot += dt * 0.000012; drawOrrery();
      }
      requestAnimationFrame(drift);
    };
    requestAnimationFrame(drift);
  }

  /* ======================================================================== */
  /*  Lander                                                                  */
  /* ======================================================================== */
  const lc = $("#landerCanvas"), lx = lc.getContext("2d"), box = $("#lander");
  const lhud = { alt: $("[data-l-alt]"), vs: $("[data-l-vs]"), hs: $("[data-l-hs]"), tilt: $("[data-l-tilt]"), fuel: $("[data-l-fuel]") };
  const over = { el: $("#landerOverlay"), kicker: $("[data-lo-kicker]"), title: $("[data-lo-title]"), body: $("[data-lo-body]"), best: $("[data-lo-best]"), btn: $("#landStart") };
  const G = 3.71, MAX_ACC = G * 2.75, BURN_S = 24, ROT = 1.5, LEN = 40, WID = 3.7;
  let LW = 0, LH = 0, LDPR = 1;
  function resizeLander() {
    LDPR = Math.min(devicePixelRatio || 1, 2);
    const r = lc.getBoundingClientRect(); LW = r.width; LH = r.height;
    lc.width = Math.round(LW * LDPR); lc.height = Math.round(LH * LDPR);
    if (game && !game.running) drawLander();
  }
  const keys = { thrust: false, left: false, right: false };
  let attempt = 0;
  const best = () => { try { return JSON.parse(localStorage.getItem("marsLanderBest") || "null"); } catch (e) { return null; } };
  function showBest() {
    const b = best();
    setText(over.best, b ? `BEST: ${b.score} PTS · ${b.vs} M/S · ${b.fuel}% PROP LEFT` : "");
  }
  showBest();

  let game = null;
  function newGame() {
    attempt++;
    const padX = 0;
    const startSide = Math.random() < 0.5 ? -1 : 1;
    game = {
      running: true, t: 0, over: false,
      x: padX - startSide * (180 + Math.random() * 120), y: 1500,
      vx: startSide * (10 + Math.random() * 8), vy: -88 - Math.random() * 8,
      ang: startSide * 0.05, fuel: 1, thr: 0, legs: 0,
      padX, padW: 64, wind: (Math.random() - 0.5) * 1.2, seed: Math.random() * 1000,
      cam: { ppm: 0.4, x: 0, base: 0 }, parts: [], shake: 0,
    };
    over.el.classList.add("is-off"); over.el.classList.remove("is-win", "is-fail");
    if (document.activeElement === over.btn) over.btn.blur();
  }
  function terrain(x) {
    const s = game ? game.seed : 0;
    let h = 22 * Math.sin(x * 0.0037 + s) + 11 * Math.sin(x * 0.0113 + s * 2) + 4 * Math.sin(x * 0.041 + s * 3) + 1.5 * Math.sin(x * 0.17);
    // a couple of craters
    for (const c of [-420, 360, 820]) { const d = (x - c) / 46; h -= 9 * Math.exp(-d * d) - 4 * Math.exp(-((Math.abs(d) - 1.2) ** 2) * 4); }
    const pad = game ? game.padX : 0, pw = game ? game.padW : 64;
    return h * smooth(pw / 2, pw / 2 + 70, Math.abs(x - pad));
  }

  function end(kind, msg) {
    const g = game; g.running = false; g.over = true;
    const vs = Math.abs(g.vy).toFixed(1), fuel = Math.round(g.fuel * 100);
    over.el.classList.remove("is-off");
    over.el.classList.add(kind === "win" ? "is-win" : "is-fail");
    setText(over.kicker, `EDL · ATTEMPT ${attempt}`);
    if (kind === "win") {
      const acc = Math.max(0, 1 - Math.abs(g.x - g.padX) / (g.padW / 2));
      const score = Math.round(500 + fuel * 4 + acc * 300 + (2.5 - Math.abs(g.vy)) * 80);
      setText(over.title, Math.abs(g.vy) < 1 && acc > 0.8 ? "Bullseye. The booster has landed." : "The booster has landed.");
      setText(over.body, `Touchdown at ${vs} m/s, ${Math.abs(g.x - g.padX).toFixed(1)} m from centre, ${fuel}% propellant left. Score ${score}.`);
      const b = best();
      if (!b || score > b.score) { try { localStorage.setItem("marsLanderBest", JSON.stringify({ score, vs, fuel })); } catch (e) { /* private mode */ } }
    } else {
      setText(over.title, kind === "rud" ? "Rapid unscheduled disassembly." : kind === "off" ? "Landed — just not on the pad." : "Lost the vehicle.");
      setText(over.body, msg + " Press R or try again.");
    }
    showBest();
    over.btn.textContent = "FLY AGAIN ▸";
    keys.thrust = keys.left = keys.right = false;
    if (visible) over.btn.focus({ preventScroll: true });
  }

  function step(dt) {
    const g = game;
    g.t += dt;
    const thrusting = keys.thrust && g.fuel > 0;
    g.thr = lerp(g.thr, thrusting ? 1 : 0, 1 - Math.pow(0.0005, dt));
    if (thrusting) g.fuel = Math.max(0, g.fuel - dt / BURN_S);
    if (keys.left) g.ang -= ROT * dt;
    if (keys.right) g.ang += ROT * dt;
    g.ang = clamp(g.ang, -1.3, 1.3);
    const acc = MAX_ACC * g.thr;
    const sp = Math.hypot(g.vx, g.vy);
    const drag = 0.0011 * sp;
    g.wind += (Math.random() - 0.5) * dt * 0.6; g.wind = clamp(g.wind, -1.5, 1.5);
    g.vx += (Math.sin(g.ang) * acc - drag * g.vx + g.wind * 0.08) * dt;
    g.vy += (Math.cos(g.ang) * acc - G - drag * g.vy) * dt;
    g.x += g.vx * dt; g.y += g.vy * dt;
    g.legs = lerp(g.legs, g.y < 160 ? 1 : 0, 1 - Math.pow(0.1, dt));
    // engine and dust particles
    if (g.thr > 0.1) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const sp2 = 30 + Math.random() * 20;
        g.parts.push({ x: g.x - Math.sin(g.ang) * 1, y: g.y - Math.cos(g.ang) * 1, vx: -Math.sin(g.ang) * sp2 + g.vx + (Math.random() - 0.5) * 6, vy: -Math.cos(g.ang) * sp2 + g.vy + (Math.random() - 0.5) * 6, life: 0.35, max: 0.35, kind: 0 });
      }
      const gy = terrain(g.x);
      if (g.y - gy < 70) {
        const k = 1 - (g.y - gy) / 70;
        for (let i = 0; i < 4 * k * g.thr; i++) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          g.parts.push({ x: g.x + (Math.random() - 0.5) * 6, y: gy + 0.5, vx: dir * (18 + Math.random() * 30) * k, vy: Math.random() * 6, life: 1.8, max: 1.8, kind: 1 });
        }
      }
    }
    for (const p of g.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 1) { p.vx *= 1 - 1.2 * dt; p.vy -= 0.6 * dt; } else { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
    }
    g.parts = g.parts.filter((p) => p.life > 0);
    if (g.parts.length > 900) g.parts.splice(0, g.parts.length - 900);
    g.shake = lerp(g.shake, g.thr * 0.6, 0.2);

    // contact
    const gy = terrain(g.x);
    if (g.y <= gy) {
      g.y = gy;
      const vs = Math.abs(g.vy), hs = Math.abs(g.vx), tilt = Math.abs(g.ang) / D2R;
      const onPad = Math.abs(g.x - g.padX) < g.padW / 2 - 3;
      if (vs > 2.5 || hs > 1.5 || tilt > 8) {
        const why = vs > 2.5 ? `Vertical speed ${vs.toFixed(1)} m/s (limit 2.5).` : hs > 1.5 ? `Horizontal speed ${hs.toFixed(1)} m/s (limit 1.5).` : `Tilt ${tilt.toFixed(0)}° (limit 8°).`;
        explode(); end("rud", why);
      } else if (!onPad) end("off", `Soft touchdown ${Math.abs(g.x - g.padX).toFixed(0)} m from the pad. The recovery crew is not amused.`);
      else end("win");
      g.vx = g.vy = 0; g.thr = 0;
    } else if (g.y > 3200 || Math.abs(g.x - g.padX) > 2600) end("lost", "Drifted out of the landing zone.");
  }
  function explode() {
    const g = game;
    for (let i = 0; i < 180; i++) {
      const a = Math.random() * Math.PI, s = 10 + Math.random() * 60;
      g.parts.push({ x: g.x, y: g.y + Math.random() * LEN * 0.6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8, life: 1.5 + Math.random(), max: 2.5, kind: 2 });
    }
    g.boom = 1;
  }

  // --- rendering ---
  function drawLander() {
    if (!LW) return;
    const g = game || { x: -200, y: 380, ang: 0.05, thr: 0, legs: 0, padX: 0, padW: 64, parts: [], cam: { ppm: 1, x: 0, base: 0 }, seed: 0, shake: 0 };
    const c = lx;
    c.setTransform(LDPR, 0, 0, LDPR, 0, 0);
    // camera
    const groundY = LH * 0.84;
    const wantPpm = clamp((LH * 0.6) / (g.y + 70), 0.32, 3.2);
    g.cam.ppm = g.cam.ppm ? lerp(g.cam.ppm, wantPpm, 0.08) : wantPpm;
    const ppm = g.cam.ppm;
    g.cam.x = lerp(g.cam.x || g.x, g.x * 0.65 + g.padX * 0.35, 0.1);
    let base = 0;
    const craftSy = groundY - g.y * ppm;
    if (craftSy < LH * 0.32) base = g.y - (groundY - LH * 0.32) / ppm;
    g.cam.base = lerp(g.cam.base || base, base, 0.2);
    const sh = REDUCE ? 0 : g.shake * (g.y < 60 ? 2 : 0.6);
    const ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
    const SX = (x) => LW / 2 + (x - g.cam.x) * ppm + ox;
    const SY = (y) => groundY - (y - g.cam.base) * ppm + oy;

    // sky
    const sky = c.createLinearGradient(0, 0, 0, LH);
    sky.addColorStop(0, "#4b2a22"); sky.addColorStop(0.55, "#b87a55"); sky.addColorStop(1, "#e2b48a");
    c.fillStyle = sky; c.fillRect(0, 0, LW, LH);
    // sun
    const sunx = LW * 0.78, suny = LH * 0.2;
    const sg = c.createRadialGradient(sunx, suny, 0, sunx, suny, 90);
    sg.addColorStop(0, "rgba(235,240,255,0.95)"); sg.addColorStop(0.08, "rgba(200,215,240,0.6)"); sg.addColorStop(1, "rgba(200,215,240,0)");
    c.fillStyle = sg; c.fillRect(sunx - 90, suny - 90, 180, 180);
    // far hills (parallax)
    const hills = (par, amp, yOff, col, f) => {
      c.beginPath(); c.moveTo(0, LH);
      for (let px = 0; px <= LW; px += 8) {
        const wx = (px - LW / 2) / (ppm * par) + g.cam.x;
        const h = amp * (Math.sin(wx * f + 1.3) * 0.6 + Math.sin(wx * f * 2.7 + 0.4) * 0.3 + Math.sin(wx * f * 6.1) * 0.1);
        c.lineTo(px, SY(g.cam.base * (1 - par) + yOff + h) );
      }
      c.lineTo(LW, LH); c.closePath(); c.fillStyle = col; c.fill();
    };
    hills(0.25, 160, 120, "rgba(150,88,60,0.55)", 0.0016);
    hills(0.5, 80, 30, "rgba(128,70,46,0.75)", 0.003);
    // terrain
    c.beginPath(); c.moveTo(0, LH);
    for (let px = 0; px <= LW; px += 3) { const wx = (px - LW / 2 - ox) / ppm + g.cam.x; c.lineTo(px, SY(terrain(wx))); }
    c.lineTo(LW, LH); c.closePath();
    const tg = c.createLinearGradient(0, SY(20), 0, LH);
    tg.addColorStop(0, "#9a5536"); tg.addColorStop(1, "#5b2c1b");
    c.fillStyle = tg; c.fill();
    // rocks
    c.fillStyle = "rgba(60,28,16,0.55)";
    const cell0 = Math.floor(g.cam.x / 40);
    for (let i = -60; i < 60; i++) {
      const cell = cell0 + i, hsh = ((cell * 2654435761) >>> 0);
      const wx = cell * 40 + (hsh % 23);
      if (Math.abs(wx - g.padX) < g.padW) continue;
      const r = ((hsh >>> 5) % 5) * 0.35 + 0.4;
      c.beginPath(); c.ellipse(SX(wx), SY(terrain(wx)) + 1, r * ppm * 1.5, r * ppm * 0.7, 0, 0, Math.PI * 2); c.fill();
    }
    // pad
    const pl = SX(g.padX - g.padW / 2), pr = SX(g.padX + g.padW / 2), py = SY(0);
    c.fillStyle = "#3b3a3a"; c.fillRect(pl, py - 1, pr - pl, Math.max(3, 1.2 * ppm));
    c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = Math.max(1, ppm * 0.6);
    c.beginPath(); c.ellipse(SX(g.padX), py, g.padW * 0.3 * ppm, Math.max(1.5, g.padW * 0.05 * ppm), 0, 0, Math.PI * 2); c.stroke();
    const blink = (performance.now() / 600) % 1 < 0.5;
    c.fillStyle = blink ? "#ff4a3a" : "#5a1a14";
    c.fillRect(pl - 2, py - 4, 4, 4); c.fillRect(pr - 2, py - 4, 4, 4);

    // particles
    for (const p of g.parts) {
      const k = p.life / p.max;
      if (p.kind === 0) { c.fillStyle = `rgba(255,${180 + 60 * k | 0},120,${0.5 * k})`; const s = (1 - k) * 4 * Math.max(ppm, 1) + 2; c.fillRect(SX(p.x) - s / 2, SY(p.y) - s / 2, s, s); }
      else if (p.kind === 1) { c.fillStyle = `rgba(196,132,92,${0.35 * k})`; const s = (1 - k) * 10 * Math.max(ppm, 0.8) + 3; c.beginPath(); c.arc(SX(p.x), SY(p.y), s, 0, Math.PI * 2); c.fill(); }
      else { c.fillStyle = k > 0.6 ? `rgba(255,220,160,${k})` : `rgba(70,40,30,${k})`; const s = 2 + (1 - k) * 6 * Math.max(ppm, 0.8); c.fillRect(SX(p.x) - s / 2, SY(p.y) - s / 2, s, s); }
    }

    // booster (drawn at least ~1.1 px/m so it reads at altitude)
    if (!g.boom) {
      const bs = Math.max(ppm, 1.1);
      c.save();
      c.translate(SX(g.x), SY(g.y));
      c.rotate(g.ang);
      // plume
      if (g.thr > 0.02) {
        const L = (10 + Math.random() * 4) * bs * g.thr;
        const pg = c.createLinearGradient(0, 0, 0, L);
        pg.addColorStop(0, "rgba(255,250,235,0.95)"); pg.addColorStop(0.3, "rgba(255,170,80,0.8)"); pg.addColorStop(1, "rgba(255,90,30,0)");
        c.fillStyle = pg; c.beginPath(); c.moveTo(-WID * 0.3 * bs, 0); c.lineTo(WID * 0.3 * bs, 0); c.lineTo(WID * 0.9 * bs, L); c.lineTo(-WID * 0.9 * bs, L); c.closePath(); c.fill();
      }
      // legs
      c.strokeStyle = "#1b1c20"; c.lineWidth = Math.max(1, 0.5 * bs);
      [-1, 1].forEach((s) => {
        const ang = lerp(0.05, 0.75, g.legs);
        c.beginPath(); c.moveTo(s * WID * 0.5 * bs, -6 * bs); c.lineTo(s * (WID * 0.5 + Math.sin(ang) * 8) * bs, (-6 + Math.cos(ang) * 6.5) * bs); c.stroke();
      });
      // body
      c.fillStyle = "#eceef1"; c.fillRect(-WID / 2 * bs, -LEN * bs, WID * bs, LEN * bs);
      c.fillStyle = "rgba(80,60,50,0.25)"; c.fillRect(-WID / 2 * bs, -LEN * 0.35 * bs, WID * bs, LEN * 0.35 * bs); // soot
      c.fillStyle = "#16181c"; c.fillRect(-WID / 2 * bs, -LEN * bs, WID * bs, 3.4 * bs); c.fillRect(-WID / 2 * bs, -1.2 * bs, WID * bs, 1.2 * bs);
      // grid fins
      c.fillStyle = "#6b7079";
      c.fillRect(-WID / 2 * bs - 2.2 * bs, -LEN * bs + 1.2 * bs, 2.2 * bs, 1 * bs);
      c.fillRect(WID / 2 * bs, -LEN * bs + 1.2 * bs, 2.2 * bs, 1 * bs);
      // nozzle
      c.fillStyle = "#3b3631"; c.beginPath(); c.moveTo(-0.6 * bs, 0); c.lineTo(0.6 * bs, 0); c.lineTo(0.9 * bs, 1.4 * bs); c.lineTo(-0.9 * bs, 1.4 * bs); c.closePath(); c.fill();
      c.restore();
    }
    // dust haze when low
    if (g.thr > 0.1 && g.y < 70) {
      c.fillStyle = `rgba(200,140,100,${0.12 * (1 - g.y / 70) * g.thr})`; c.fillRect(0, 0, LW, LH);
    }
  }

  function updateLhud() {
    const g = game; if (!g) return;
    const alt = Math.max(0, g.y - terrain(g.x));
    setText(lhud.alt, alt.toFixed(alt < 100 ? 1 : 0));
    setText(lhud.vs, g.vy.toFixed(1));
    setText(lhud.hs, g.vx.toFixed(1));
    setText(lhud.tilt, (g.ang / D2R).toFixed(0));
    const low = alt < 120;
    lhud.vs.className = low ? (Math.abs(g.vy) > 2.5 ? "bad" : "good") : Math.abs(g.vy) > 60 && alt < 600 ? "warn" : "";
    lhud.hs.className = low ? (Math.abs(g.vx) > 1.5 ? "bad" : "good") : "";
    lhud.tilt.className = low ? (Math.abs(g.ang / D2R) > 8 ? "bad" : "good") : "";
    lhud.fuel.style.width = (g.fuel * 100).toFixed(1) + "%";
    lhud.fuel.classList.toggle("low", g.fuel < 0.2);
  }

  let lastL = 0, visible = false;
  function loop(now) {
    const dt = clamp((now - lastL) / 1000, 0, 0.033); lastL = now;
    if (game && game.running) {
      // fixed sub-steps for stable physics
      const n = 2; for (let i = 0; i < n && game.running; i++) step(dt / n);
      updateLhud();
    } else if (game && game.parts.length) {
      for (const p of game.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= G * dt; }
      game.parts = game.parts.filter((p) => p.life > 0);
    }
    if (visible) drawLander();
    if (visible || (game && game.running)) requestAnimationFrame(loop); else looping = false;
  }
  let looping = false;
  function kick() { if (!looping) { looping = true; lastL = performance.now(); requestAnimationFrame(loop); } }
  let ratio = 0;
  new IntersectionObserver((es) => {
    const e = es[es.length - 1];
    visible = e.isIntersecting; ratio = e.intersectionRatio;
    if (visible) { resizeLander(); kick(); } else keys.thrust = keys.left = keys.right = false;
  }, { threshold: [0, 0.05, 0.6, 0.8, 1] }).observe(box);

  over.btn.addEventListener("click", () => { newGame(); kick(); });
  const inGame = () => game && game.running && visible;
  const map = { ArrowUp: "thrust", w: "thrust", W: "thrust", " ": "thrust", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select, a, button:not(#landStart)")) return;
    if ((e.key === "r" || e.key === "R") && visible) { newGame(); kick(); return; }
    const k = map[e.key];
    if (!k) return;
    if (!inGame()) {
      // First thrust press while the lander is on screen starts a descent
      // (but not while the button has focus — Space would also click it).
      // Only when the lander is mostly on screen, so Space-to-scroll doesn't start a run.
      if (ratio < 0.6 || k !== "thrust" || document.activeElement === over.btn) return;
      newGame(); kick();
    }
    keys[k] = true; e.preventDefault();
  });
  addEventListener("keyup", (e) => { const k = map[e.key]; if (k) keys[k] = false; });
  addEventListener("blur", () => { keys.thrust = keys.left = keys.right = false; });
  document.querySelectorAll("[data-tp]").forEach((b) => {
    const k = b.dataset.tp;
    const on = (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      if (!inGame()) { newGame(); kick(); }
      keys[k] = true; b.classList.add("is-down");
    };
    const off = () => { keys[k] = false; b.classList.remove("is-down"); };
    b.addEventListener("pointerdown", on);
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, off));
  });
  resizeLander();
})();
