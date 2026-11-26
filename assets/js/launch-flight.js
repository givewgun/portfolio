/*
 * launch-flight.js — "Flight Profile" (launch.html)
 * ---------------------------------------------------------------------------
 * The career, flown as a two-stage launch. Scroll position drives mission
 * elapsed time (MET); every vehicle pose is a pure function of MET, so the
 * flight scrubs backwards and forwards. Particles and audio run on real time.
 *
 * Frames of reference
 *   Main scene, 1 unit = 10 m, the *focus vehicle* sits at the origin and the
 *   world (ground, pad, tower, other stages) is moved around it. Local +x is
 *   downrange (east), +y is local up.
 *   Earth scene, 1 unit = 1 km, Earth centred at the origin with the launch
 *   site at +Y and east along +X. The earth camera mirrors the main camera,
 *   rotated by the downrange angle, so the horizon curves for real.
 *
 * Content (event cards, mission log) comes from portfolioData.flight in
 * data.js. The vehicle and telemetry are original and illustrative.
 */
/* global portfolioData */

const D = window.portfolioData || {};
const FLIGHT = D.flight || { mission: "GK-1", events: [] };
const EVENTS = [...(FLIGHT.events || [])].sort((a, b) => a.t - b.t);
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOBILE = matchMedia("(max-width: 760px), (pointer: coarse)").matches;

const T_MECO = 150, T_SEP = 154, T_SES = 162, T_FAIRING = 228, T_SECO = 512;
const T_DEPLOY = 566, T_RIDESHARE = 610;
const R_E = 6371;           // km
const U = 100;              // main-scene units per km
const PAD_DECK = 0.3;       // pad deck height (units)
const S1_LEN = 4.6, S2_LEN = 1.5, BODY_R = 0.24;

/* ------------------------------------------------------------------------ */
/* Small math helpers                                                       */
/* ------------------------------------------------------------------------ */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0)); return k * k * (3 - 2 * k); };
const bell = (t, c, w) => Math.exp(-((t - c) * (t - c)) / (2 * w * w));
function tab(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      const k = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (k * k * (3 - 2 * k) * 0.35 + k * 0.65);
    }
  }
  return pts[pts.length - 1][1];
}

/* ------------------------------------------------------------------------ */
/* Trajectory (illustrative, loosely shaped like a real RTLS profile)       */
/* ------------------------------------------------------------------------ */
const S2 = {
  h: [[0, 0], [14, 0.25], [40, 3.2], [58, 9.6], [74, 15.6], [100, 29], [130, 52], [150, 68], [154, 71], [162, 76], [228, 118], [300, 150], [400, 180], [512, 210], [800, 212]],
  v: [[0, 0], [14, 190], [40, 640], [58, 1100], [74, 1720], [100, 3100], [130, 5600], [150, 7900], [154, 7860], [162, 7900], [228, 10300], [300, 14000], [400, 20000], [512, 27400], [800, 27400]],
  d: [[0, 0], [14, 0], [40, 0.4], [74, 6], [100, 17], [150, 62], [228, 170], [300, 330], [400, 700], [512, 1250], [800, 1250 + 288 * 7.6]],
  p: [[0, 0], [12, 0], [40, 12], [74, 27], [150, 57], [228, 70], [400, 82], [512, 88], [800, 90]],
};
const B = {
  h: [[T_SEP, tab(S2.h, T_SEP)], [200, 100], [262, 124], [300, 118], [362, 62], [380, 40], [404, 2.5], [412, 0.4], [418, 0.006], [9999, 0.006]],
  v: [[T_SEP, tab(S2.v, T_SEP)], [172, 7300], [220, 1900], [262, 1500], [362, 4800], [380, 2500], [404, 1100], [412, 300], [418, 0], [9999, 0]],
  d: [[T_SEP, tab(S2.d, T_SEP)], [180, 78], [220, 86], [262, 74], [362, 18], [404, 0.8], [418, 0], [9999, 0]],
  p: [[T_SEP, tab(S2.p, T_SEP)], [158, 58], [172, -95], [220, -95], [250, -40], [300, 0], [9999, 0]],
};
function vehicleAt(tbl, t) {
  return { h: tab(tbl.h, t), v: tab(tbl.v, t), d: tab(tbl.d, t), p: (tab(tbl.p, t) * Math.PI) / 180 };
}
function soundSpeed(h) { return h < 11 ? 340 - 4.1 * h : h < 25 ? 295 : Math.min(330, 295 + (h - 25) * 0.9); }

/** Booster engine count + throttle at MET t. */
function s1Engines(t) {
  if (t < -3) return [0, 0];
  if (t < 0) return [9, clamp((t + 3) / 2.2)];
  if (t < T_MECO) return [9, 1 - 0.28 * smooth(52, 60, t) * (1 - smooth(78, 86, t))];
  if (t >= 172 && t < 220) return [3, 1];
  if (t >= 362 && t < 380) return [3, 0.9];
  if (t >= 404 && t < 406) return [3, 0.85];
  if (t >= 406 && t < 417.5) return [1, 0.8];
  return [0, 0];
}
function s2Engine(t) { return t >= T_SES && t < T_SECO ? smooth(T_SES, T_SES + 1.5, t) : 0; }

function s1State(t) {
  if (t < -3) return ["STANDBY", ""];
  if (t < 0) return ["IGNITION", "burn"];
  if (t < T_MECO) return ["BURN", "burn"];
  if (t < T_SEP) return ["MECO", "active"];
  if (t < 172) return ["FLIP", "active"];
  if (t < 220) return ["BOOSTBACK", "burn"];
  if (t < 362) return ["COAST", "active"];
  if (t < 380) return ["ENTRY BURN", "burn"];
  if (t < 404) return ["DESCENT", "active"];
  if (t < 418) return ["LANDING BURN", "burn"];
  return ["CAUGHT", "active"];
}
function s2State(t) {
  if (t < T_SES) return [t < T_SEP ? (t < 0 ? "STANDBY" : "ATTACHED") : "SEPARATED", t < T_SEP ? "" : "active"];
  if (t < T_SECO) return ["BURN", "burn"];
  if (t < T_DEPLOY) return ["SECO", "active"];
  if (t < T_RIDESHARE) return ["DEPLOY", "active"];
  return ["ORBIT", "active"];
}

/* ------------------------------------------------------------------------ */
/* Scroll → MET                                                             */
/* ------------------------------------------------------------------------ */
const N_EV = Math.max(EVENTS.length, 2);
const P_LAST = 0.94;
const EV_P = EVENTS.map((_, i) => (i / (N_EV - 1)) * P_LAST);
function metFromP(p) {
  if (!EVENTS.length) return p * 640;
  if (p >= P_LAST) return EVENTS[EVENTS.length - 1].t + ((p - P_LAST) / (1 - P_LAST)) * 40;
  for (let i = 1; i < EVENTS.length; i++) {
    if (p <= EV_P[i]) return lerp(EVENTS[i - 1].t, EVENTS[i].t, (p - EV_P[i - 1]) / (EV_P[i] - EV_P[i - 1]));
  }
  return EVENTS[EVENTS.length - 1].t;
}

/* ------------------------------------------------------------------------ */
/* DOM / HUD                                                                */
/* ------------------------------------------------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const body = document.body;
const hud = {
  card: $("#eventCard"),
  cardTime: $("[data-card-time]"), cardCode: $("[data-card-code]"), cardTitle: $("[data-card-title]"),
  cardSub: $("[data-card-sub]"), cardBody: $("[data-card-body]"), cardStats: $("[data-card-stats]"), cardLink: $("[data-card-link]"),
  clock: $("[data-clock]"), clockSign: $("[data-clock-sign]"),
  mach: $("[data-mach]"), q: $("[data-q]"), thr: $("[data-thr]"), dr: $("[data-dr]"),
  s1: $(".stage--1"), s2: $(".stage--2"), s1State: $("[data-s1-state]"), s2State: $("[data-s2-state]"),
  g: {}, eng1: [...document.querySelectorAll('[data-engines="1"] i')], eng2: [...document.querySelectorAll('[data-engines="2"] i')],
  pip: $("#pip"), pipState: $("[data-pip-state]"), hint: $("#scrollHint"), flash: $("#fxFlash"),
  arc: $("#arc"), track: $("#track"),
};
document.querySelectorAll(".gauge").forEach((el) => {
  hud.g[el.dataset.g] = { fill: el.querySelector(".gauge__fill"), num: el.querySelector("b"), last: "" };
});
// Engine cluster layout: ring of 8 + centre.
hud.eng1.forEach((el, i) => {
  const c = 18.5;
  if (i === 8) { el.style.left = c + "px"; el.style.top = c + "px"; return; }
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  el.style.left = c + Math.cos(a) * 17 + "px";
  el.style.top = c + Math.sin(a) * 17 + "px";
});
$("[data-mission]").textContent = "MISSION " + (FLIGHT.mission || "GK-1");
const siteEl = $("[data-site]");
if (siteEl && FLIGHT.site) siteEl.textContent = FLIGHT.site.toUpperCase();

const fmtClock = (s) => {
  s = Math.floor(Math.abs(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};
const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };

/* Mission timeline arc */
const ARC = { cx: 400, cy: 940, r: 900, x0: 40, x1: 760 };
const arcY = (x) => ARC.cy - Math.sqrt(ARC.r * ARC.r - (x - ARC.cx) * (x - ARC.cx));
const arcPt = (s) => { const x = lerp(ARC.x0, ARC.x1, s); return [x, arcY(x)]; };
let arcFill, arcNow, arcLen = 1;
const arcDots = [];
(function buildArc() {
  const svg = hud.arc; if (!svg) return;
  const ns = "http://www.w3.org/2000/svg";
  const [ax, ay] = arcPt(0), [bx, by] = arcPt(1);
  const d = `M ${ax} ${ay} A ${ARC.r} ${ARC.r} 0 0 1 ${bx} ${by}`;
  const mk = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };
  mk("path", { d, class: "arc__track" });
  arcFill = mk("path", { d, class: "arc__fill" });
  arcLen = arcFill.getTotalLength ? arcFill.getTotalLength() : 760;
  arcFill.style.strokeDasharray = `0 ${arcLen}`;
  EVENTS.forEach((ev, i) => {
    const [x, y] = arcPt(EV_P[i] / 1);
    const booster = ev.vehicle === "booster";
    const dot = mk("circle", { cx: x, cy: y, r: booster ? 3.2 : 4, class: "arc__dot" + (booster ? " is-booster" : "") });
    const ang = (Math.atan2(ARC.cy - y, x - ARC.cx) * 180) / Math.PI;
    const lbl = mk("text", {
      x: x, y: y - 10, class: "arc__label" + (booster ? " is-booster" : ""),
      transform: `rotate(${-(ang) + 90 - 62} ${x} ${y - 10})`,
    });
    lbl.textContent = ev.code;
    arcDots.push({ dot, lbl, past: false });
  });
  arcNow = mk("circle", { cx: ax, cy: ay, r: 5.5, class: "arc__now" });
})();

/* Mission log (text version of every event) */
(function buildLog() {
  const list = $("#logList"); if (!list) return;
  EVENTS.forEach((ev) => {
    const li = document.createElement("li");
    if (ev.vehicle === "booster") li.className = "is-booster";
    const t = document.createElement("span"); t.className = "log__t"; t.textContent = "T+" + fmtClock(ev.t);
    const c = document.createElement("span"); c.className = "log__code"; c.textContent = ev.code;
    const b = document.createElement("div"); b.className = "log__body";
    const h = document.createElement("h3"); h.textContent = ev.title;
    const s = document.createElement("p"); s.className = "log__sub"; s.textContent = ev.sub || "";
    const p = document.createElement("p"); p.textContent = ev.body || "";
    b.append(h, s, p);
    if (ev.link) { const a = document.createElement("a"); a.href = ev.link.url; a.textContent = ev.link.label + " →"; b.append(a); }
    li.append(t, c, b);
    list.append(li);
  });
})();

let cardIdx = -2;
function showCard(i) {
  if (i === cardIdx) return;
  cardIdx = i;
  const ev = EVENTS[i];
  if (!ev) { hud.card.classList.remove("is-on"); return; }
  hud.card.classList.remove("is-on");
  // re-trigger the slide-in
  void hud.card.offsetWidth;
  hud.card.classList.toggle("is-booster", ev.vehicle === "booster");
  setText(hud.cardTime, "T+" + fmtClock(ev.t));
  setText(hud.cardCode, ev.code);
  setText(hud.cardTitle, ev.title);
  setText(hud.cardSub, ev.sub || "");
  setText(hud.cardBody, ev.body || "");
  hud.cardStats.replaceChildren(...(ev.stats || []).map((s) => {
    const d = document.createElement("div");
    const b = document.createElement("b"); b.textContent = s.v;
    const l = document.createElement("span"); l.textContent = s.l;
    d.append(b, l); return d;
  }));
  if (ev.link) { hud.cardLink.hidden = false; hud.cardLink.href = ev.link.url; hud.cardLink.textContent = ev.link.label; }
  else hud.cardLink.hidden = true;
  hud.card.classList.add("is-on");
}

function setGauge(key, value, max, digits = 0) {
  const g = hud.g[key]; if (!g) return;
  const txt = value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  if (txt !== g.last) {
    g.last = txt;
    g.num.textContent = txt;
    g.fill.style.strokeDasharray = `${(207.3 * clamp(value / max)).toFixed(2)} 276.5`;
  }
}
function setEngines(list, n) {
  // 9 → all, 3 → centre + two opposite, 1 → centre
  list.forEach((el, i) => {
    const on = list.length === 1 ? n > 0 : n >= 9 || (n === 3 && (i === 8 || i === 0 || i === 4)) || (n === 1 && i === 8);
    if (el._on !== on) { el._on = on; el.classList.toggle("on", on); }
  });
}

let flashLevel = 0;
function flash(a) { flashLevel = Math.max(flashLevel, a); }

/* ------------------------------------------------------------------------ */
/* Audio (synthesised, off by default)                                      */
/* ------------------------------------------------------------------------ */
const audio = {
  ctx: null, on: false,
  init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ctx = (this.ctx = new AC());
    const len = ctx.sampleRate * 2;
    const brown = ctx.createBuffer(1, len, ctx.sampleRate), white = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = brown.getChannelData(0), w = white.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const r = Math.random() * 2 - 1; w[i] = r; last = (last + 0.02 * r) / 1.02; b[i] = last * 3.5; }
    const src = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    this.lp = ctx.createBiquadFilter(); this.lp.type = "lowpass"; this.lp.frequency.value = 200;
    this.rumble = ctx.createGain(); this.rumble.gain.value = 0;
    src(brown).connect(this.lp); this.lp.connect(this.rumble); this.rumble.connect(this.master);
    this.hp = ctx.createBiquadFilter(); this.hp.type = "bandpass"; this.hp.frequency.value = 1400; this.hp.Q.value = 0.6;
    this.crackle = ctx.createGain(); this.crackle.gain.value = 0;
    src(white).connect(this.hp); this.hp.connect(this.crackle); this.crackle.connect(this.master);
    return true;
  },
  toggle() {
    if (!this.ctx && !this.init()) return false;
    this.on = !this.on;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.15);
    return this.on;
  },
  update(thr, atm) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.rumble.gain.setTargetAtTime(thr * (0.12 + 0.88 * atm) * 0.85, t, 0.08);
    this.lp.frequency.setTargetAtTime(110 + 520 * atm * thr, t, 0.1);
    this.crackle.gain.setTargetAtTime(thr * atm * (0.02 + Math.random() * 0.16), t, 0.02);
  },
  thump(strength = 1) {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * strength, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.8);
  },
};

/* ------------------------------------------------------------------------ */
/* Flight control: countdown, scroll, auto-fly, cameras                     */
/* ------------------------------------------------------------------------ */
const ctl = {
  phase: "countdown",   // countdown | flight
  cdStart: performance.now(), cdLen: 10,
  auto: false, cam: 0, p: 0, met: -10,
};
const autoBtn = $("#autoBtn"), soundBtn = $("#soundBtn");
function setAuto(on) { ctl.auto = on; autoBtn.setAttribute("aria-pressed", String(on)); }
function setCam(i) {
  ctl.cam = i;
  document.querySelectorAll("[data-cam]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.cam === i)));
}
document.querySelectorAll("[data-cam]").forEach((b) => b.addEventListener("click", () => setCam(+b.dataset.cam)));
autoBtn.addEventListener("click", () => setAuto(!ctl.auto));
soundBtn.addEventListener("click", () => soundBtn.setAttribute("aria-pressed", String(audio.toggle())));

const POLL = [
  ["PROPULSION", "GO"], ["GUIDANCE", "GO"], ["ARCHITECTURE REVIEW", "GO"], ["CI/CD PIPELINE", "GO"],
  ["IDENTITY & ACCESS", "GO"], ["ZERO TRUST", "GO"], ["COFFEE", "GO"], ["LAUNCH DIRECTOR", "GO FOR LAUNCH"],
];
const pollEl = $("#poll");
POLL.forEach(([k, v], i) => {
  const li = document.createElement("li");
  if (i === POLL.length - 1) li.className = "is-final";
  const a = document.createElement("span"); a.textContent = k;
  const b = document.createElement("b"); b.textContent = v;
  li.append(a, b); pollEl.append(li);
});
const pollItems = [...pollEl.children];
const cdEl = $("#cdClock"), countdownEl = $("#countdown");

function liftoff() {
  if (ctl.phase === "flight") return;
  ctl.phase = "flight";
  countdownEl.classList.add("is-gone");
  body.classList.remove("is-countdown");
  window.scrollTo(0, 0);
  if (!REDUCE) setAuto(true);
  setCam(0);
  flash(0.35);
  audio.thump(1);
}
function skipCountdown(scrollTarget) {
  ctl.phase = "flight";
  countdownEl.classList.add("is-gone");
  body.classList.remove("is-countdown");
  if (scrollTarget) requestAnimationFrame(() => scrollTarget.scrollIntoView());
}
$("#igniteBtn").addEventListener("click", () => {
  // Jump straight to ignition: compress the remaining count to ~3 seconds.
  const elapsed = (performance.now() - ctl.cdStart) / 1000;
  if (ctl.cdLen - elapsed > 3.2) ctl.cdStart = performance.now() - (ctl.cdLen - 3.2) * 1000;
  pollItems.forEach((li) => li.classList.add("is-on"));
});
$("#skipToLog").addEventListener("click", () => skipCountdown($("#log")));
$("#refly").addEventListener("click", () => {
  setAuto(false);
  window.scrollTo(0, 0);
  ctl.phase = "countdown"; ctl.cdStart = performance.now(); ctl.ignited = false;
  pollItems.forEach((li) => li.classList.remove("is-on"));
  countdownEl.classList.remove("is-gone");
  body.classList.add("is-countdown");
  cardIdx = -2;
});

if (REDUCE || /^#(log|manifest)$/.test(location.hash)) {
  skipCountdown(location.hash ? $(location.hash) : null);
}

// Any manual scroll input cancels auto-fly.
const cancelAuto = () => { if (ctl.auto) setAuto(false); };
addEventListener("wheel", cancelAuto, { passive: true });
addEventListener("touchstart", cancelAuto, { passive: true });
addEventListener("keydown", (e) => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(e.key)) cancelAuto();
  if (e.key >= "1" && e.key <= "4") setCam(+e.key - 1);
  else if (e.key === "a" || e.key === "A") { if (ctl.phase === "flight") setAuto(!ctl.auto); }
  else if (e.key === "m" || e.key === "M") soundBtn.click();
  else if (e.key === "Enter" && ctl.phase === "countdown" && document.activeElement === body) $("#igniteBtn").click();
});

function trackLen() { return Math.max(1, hud.track.offsetHeight - innerHeight); }

/* Real next launch (from Gemini's launch-manifest.js) */
let realNext = null;
setTimeout(() => {
  try {
    const p = window.LaunchManifest && window.LaunchManifest.next;
    if (p && p.then) p.then((l) => { if (l && l.net) { realNext = l; const el = $("#realNext"); el.hidden = false; setText($("[data-rn-name]", el), l.name || ""); } }).catch(() => {});
  } catch (e) { /* manifest optional */ }
}, 1200);
function tickRealNext() {
  if (!realNext) return;
  const dt = (Date.parse(realNext.net) - Date.now()) / 1000;
  const s = Math.abs(dt), d = Math.floor(s / 86400);
  setText($("[data-rn-clock]"), (dt >= 0 ? "T-" : "T+") + String(d).padStart(2, "0") + ":" + fmtClock(s % 86400));
}

/* ------------------------------------------------------------------------ */
/* Per-frame HUD update (works with or without WebGL)                       */
/* ------------------------------------------------------------------------ */
let lastEvIdx = -1, hintOff = false;
function updateHud(t, st) {
  const s2 = st.s2, b = st.b;
  setText(hud.clockSign, t < 0 ? "T-" : "T+");
  setText(hud.clock, fmtClock(t < 0 ? Math.ceil(-t) : t));
  const vms = (s2.v / 3.6);
  setText(hud.mach, (vms / soundSpeed(s2.h)).toFixed(1));
  setText(hud.q, st.q.toFixed(1));
  setText(hud.thr, String(Math.round(st.thr * 100)));
  setText(hud.dr, Math.round(s2.d).toLocaleString("en-US"));
  setGauge("s1v", t < T_SEP ? s2.v : b.v, 28000);
  setGauge("s1h", t < T_SEP ? s2.h : b.h, 220, (t < T_SEP ? s2.h : b.h) < 10 ? 1 : 0);
  setGauge("s2v", s2.v, 28000);
  setGauge("s2h", s2.h, 220, s2.h < 10 ? 1 : 0);
  const [n1] = s1Engines(t);
  setEngines(hud.eng1, n1);
  setEngines(hud.eng2, s2Engine(t) > 0.05 ? 1 : 0);
  const [a1, c1] = s1State(t), [a2, c2] = s2State(t);
  setText(hud.s1State, a1); setText(hud.s2State, a2);
  hud.s1.classList.toggle("is-burn", c1 === "burn"); hud.s1.classList.toggle("is-active", c1 === "active");
  hud.s2.classList.toggle("is-burn", c2 === "burn"); hud.s2.classList.toggle("is-active", c2 === "active");

  // event + arc
  let idx = -1;
  for (let i = 0; i < EVENTS.length; i++) if (t >= EVENTS[i].t - 0.001) idx = i;
  if (ctl.phase === "flight") showCard(idx);
  if (idx > lastEvIdx && lastEvIdx >= -1 && ctl.phase === "flight") {
    const code = EVENTS[idx] && EVENTS[idx].code;
    if (["STAGE SEP", "CATCH"].includes(code)) { flash(0.22); audio.thump(1); st.kick = 1; }
    else if (["SES-1", "FAIRING SEP", "PAYLOAD DEPLOY"].includes(code)) { flash(0.12); audio.thump(0.6); }
  }
  lastEvIdx = idx;
  const pArc = ctl.p;
  if (arcFill) {
    arcFill.style.strokeDasharray = `${(arcLen * pArc).toFixed(1)} ${arcLen}`;
    const [x, y] = arcPt(pArc);
    arcNow.setAttribute("cx", x.toFixed(1)); arcNow.setAttribute("cy", y.toFixed(1));
    arcDots.forEach((d, i) => {
      const past = i <= idx && ctl.phase === "flight";
      if (past !== d.past) { d.past = past; d.dot.classList.toggle("is-past", past); d.lbl.classList.toggle("is-past", past); }
    });
  }
  // PiP
  const pipOn = t > T_SEP + 2 && t < 428 && ctl.phase === "flight";
  hud.pip.classList.toggle("is-on", pipOn);
  if (pipOn) setText(hud.pipState, a1);
  if (!hintOff && ctl.p > 0.02) { hintOff = true; hud.hint.classList.add("is-off"); }
  if (hintOff && ctl.p < 0.005 && !ctl.auto) { hintOff = false; hud.hint.classList.remove("is-off"); }
  tickRealNext();
}

function computeState(t) {
  const s2 = vehicleAt(S2, Math.max(0, t));
  const b = t < T_SEP ? s2 : vehicleAt(B, t);
  const vms = s2.v / 3.6;
  const q = 0.5 * 1.225 * Math.exp(-s2.h / 8.5) * vms * vms / 1000;
  const [n1, th1] = s1Engines(t);
  const thr = t < T_SEP ? th1 : s2Engine(t);
  return { t, s2, b, q, n1, th1, th2: s2Engine(t), thr };
}

/* ------------------------------------------------------------------------ */
/* Main loop scaffolding                                                    */
/* ------------------------------------------------------------------------ */
let renderFrame = null; // set once WebGL is ready
let lastNow = performance.now();
let simTime = 0;
let prevMet = -10;
let metRate = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  simTime += dt;

  // --- MET ---
  if (ctl.phase === "countdown") {
    const el = (now - ctl.cdStart) / 1000;
    const remain = ctl.cdLen - el;
    ctl.met = -Math.max(0, remain);
    ctl.p = 0;
    setText(cdEl, fmtClock(Math.ceil(Math.max(0, remain))));
    const shown = Math.floor((el / (ctl.cdLen - 0.6)) * POLL.length);
    pollItems.forEach((li, i) => { if (i < shown) li.classList.add("is-on"); });
    if (remain <= 3 && !ctl.ignited) { ctl.ignited = true; audio.thump(0.4); }
    if (remain <= 0) liftoff();
  } else {
    const L = trackLen();
    if (ctl.auto) {
      const speed = L / 110; // whole flight in ~110 s
      const y = Math.min(L, scrollY + speed * dt);
      window.scrollTo(0, y);
      if (y >= L - 1) setAuto(false);
    }
    ctl.p = clamp(scrollY / L);
    ctl.met = metFromP(ctl.p);
    body.classList.toggle("is-past", scrollY > L + innerHeight * 0.35);
  }
  const t = ctl.met;
  metRate = lerp(metRate, Math.abs(t - prevMet) / Math.max(dt, 1e-3), 0.1);
  prevMet = t;

  const st = computeState(t);
  updateHud(t, st);

  // flash overlay decay
  if (flashLevel > 0.001) { hud.flash.style.opacity = String(flashLevel); flashLevel *= Math.pow(0.02, dt); }
  else if (hud.flash.style.opacity !== "0") hud.flash.style.opacity = "0";

  const atm = Math.exp(-st.s2.h / 9);
  audio.update(t < T_SEP ? st.th1 : st.th2 * 0.25, t < T_SEP ? atm : 0.15);

  if (renderFrame && !document.hidden) renderFrame(st, dt, simTime);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ------------------------------------------------------------------------ */
/* WebGL scene                                                              */
/* ------------------------------------------------------------------------ */
initScene().catch((err) => {
  console.warn("[flight] WebGL unavailable, HUD-only mode:", err);
  body.classList.add("no-webgl");
  const c = $("#flightCanvas");
  if (c) c.style.background = "radial-gradient(120% 80% at 50% 110%, #12305c, #03050a 70%)";
});

async function initScene() {
  const THREE = await import("../vendor/three.module.min.js");
  const canvas = $("#flightCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: "high-performance" });
  const DPR = Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 1.5);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const tmpV = V3(), tmpV2 = V3(), Z_AXIS = V3(0, 0, 1);
  const rotZ = new THREE.Quaternion();

  /* ---------- shared textures ---------- */
  function softTex(stops) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  }
  const texSoft = softTex([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]);
  const texSmoke = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    for (let i = 0; i < 22; i++) {
      const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 18 + Math.random() * 30;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.32)"); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    }
    const m = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = m; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const texGlow = softTex([[0, "rgba(255,250,240,1)"], [0.12, "rgba(255,220,170,0.9)"], [0.35, "rgba(255,140,60,0.35)"], [1, "rgba(255,90,20,0)"]]);

  function bodyTexture(label, interstage) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 1024;
    const g = c.getContext("2d");
    g.fillStyle = "#eef0f3"; g.fillRect(0, 0, 256, 1024);
    g.fillStyle = "rgba(0,0,0,0.05)";
    for (let y = 0; y < 1024; y += 96) g.fillRect(0, y, 256, 2);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,80,70,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 1024, 2 + Math.random() * 6, 20 + Math.random() * 160); }
    if (interstage) { g.fillStyle = "#16181c"; g.fillRect(0, 0, 256, 1024 * interstage); }
    if (label) {
      g.save(); g.translate(64, 640); g.rotate(-Math.PI / 2);
      g.fillStyle = "#15171b"; g.font = "700 54px 'Space Grotesk', Arial, sans-serif";
      g.fillText(label, 0, 0); g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  /* ---------- materials ---------- */
  const matWhite1 = new THREE.MeshStandardMaterial({ map: bodyTexture("GK · 1", 0.06), roughness: 0.5, metalness: 0.08 });
  const matWhite2 = new THREE.MeshStandardMaterial({ map: bodyTexture("", 0), roughness: 0.45, metalness: 0.08 });
  const matBlack = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6, metalness: 0.3 });
  const matNozzle = new THREE.MeshStandardMaterial({ color: 0x3b3631, roughness: 0.35, metalness: 0.85, emissive: 0xff4a10, emissiveIntensity: 0 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x6b7079, roughness: 0.55, metalness: 0.7 });
  const matTower = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8, metalness: 0.5 });
  const matConcrete = new THREE.MeshStandardMaterial({ color: 0x8d8f91, roughness: 0.95, metalness: 0 });
  const matGold = new THREE.MeshStandardMaterial({ color: 0xd4a23a, roughness: 0.3, metalness: 1 });
  const matPanel = new THREE.MeshStandardMaterial({ color: 0x1b2c5a, roughness: 0.25, metalness: 0.6, emissive: 0x0a1430, emissiveIntensity: 0.5 });

  /* ---------- plume shader ---------- */
  function makePlume() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 28, 24, true);
    geo.translate(0, -0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uR0: { value: 0.2 }, uR1: { value: 0.4 }, uLen: { value: 3 }, uThr: { value: 0 }, uVac: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
        uniform float uR0, uR1, uLen, uTime, uVac;
        varying float vS; varying vec3 vN; varying vec3 vV;
        void main(){
          float s = -position.y;
          float r = mix(uR0, uR1, pow(s, mix(0.55, 0.35, uVac)));
          r *= 1.0 + 0.04 * sin(uTime * 47.0 + s * 21.0);
          vec3 p = vec3(position.x * r, -s * uLen, position.z * r);
          vS = s;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uThr, uVac, uTime, uLen;
        varying float vS; varying vec3 vN; varying vec3 vV;
        void main(){
          float edge = abs(dot(normalize(vN), normalize(vV)));
          float core = pow(edge, mix(2.2, 0.9, uVac));
          float fade = pow(1.0 - vS, mix(1.6, 2.6, uVac));
          float diamonds = (1.0 - uVac) * pow(max(0.0, sin(vS * uLen * 7.5)), 10.0) * (1.0 - vS) * 0.9;
          float flick = 0.88 + 0.12 * sin(uTime * 61.0 + vS * 40.0);
          vec3 hot = vec3(1.0, 0.97, 0.9);
          vec3 mid = mix(vec3(1.0, 0.62, 0.24), vec3(0.55, 0.6, 1.0), uVac * 0.55);
          vec3 col = mix(mid, hot, clamp(core * (1.0 - vS * 1.4) + diamonds, 0.0, 1.0));
          float a = (core * fade + diamonds) * uThr * flick * mix(1.0, 0.35, uVac);
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    return mesh;
  }
  function makeGlow(scale) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(scale); s.renderOrder = 6; return s;
  }

  /* ---------- vehicle ---------- */
  function nozzle(rT, rB, h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 18, 1, true), matNozzle);
    m.material.side = THREE.DoubleSide; return m;
  }
  // Booster: group origin at its centre (so flips rotate about the middle).
  const booster = new THREE.Group();
  const bInner = new THREE.Group(); bInner.position.y = -S1_LEN / 2; booster.add(bInner);
  {
    const body1 = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, BODY_R, S1_LEN, 40, 1), matWhite1);
    body1.position.y = S1_LEN / 2; bInner.add(body1);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R * 1.02, BODY_R * 1.08, 0.16, 40), matBlack);
    skirt.position.y = 0.06; bInner.add(skirt);
    for (let i = 0; i < 9; i++) {
      const n = nozzle(0.035, 0.07, 0.17);
      if (i < 8) { const a = (i / 8) * Math.PI * 2; n.position.set(Math.cos(a) * 0.155, -0.08, Math.sin(a) * 0.155); }
      else n.position.set(0, -0.08, 0);
      bInner.add(n);
    }
  }
  const gridFins = [];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    pivot.position.set(Math.cos(a) * BODY_R, S1_LEN - 0.22, Math.sin(a) * BODY_R);
    pivot.rotation.y = -a;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.025), matMetal);
    fin.position.x = 0.11;
    pivot.add(fin);
    bInner.add(pivot);
    gridFins.push(pivot);
  }
  const plume1 = makePlume(); plume1.position.y = -0.17; bInner.add(plume1);
  const glow1 = makeGlow(1.2); glow1.position.y = -0.3; bInner.add(glow1);
  const plumeLight = new THREE.PointLight(0xff8a3c, 0, 60, 1.6); plumeLight.position.y = -1.2; bInner.add(plumeLight);
  // RCS / sep puffs emitter reference
  const bTop = V3(0, S1_LEN - 0.1, 0);

  // Stage 2: origin at its base.
  const s2 = new THREE.Group();
  {
    const body2 = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, BODY_R, S2_LEN, 40, 1), matWhite2);
    body2.position.y = S2_LEN / 2; s2.add(body2);
  }
  const mvac = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.05, 0), new THREE.Vector2(0.08, -0.12), new THREE.Vector2(0.15, -0.34), new THREE.Vector2(0.2, -0.56)], 28), matNozzle.clone());
  mvac.material.side = THREE.DoubleSide;
  s2.add(mvac);
  const plume2 = makePlume(); plume2.position.y = -0.56; s2.add(plume2);
  const glow2 = makeGlow(0.9); glow2.position.y = -0.6; s2.add(glow2);
  // Fairing halves
  const fairingProfile = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16, y = k * 1.4;
    const r = y < 0.55 ? 0.27 : 0.27 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.55) / 0.85, 2)));
    fairingProfile.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const fairings = [0, 1].map((side) => {
    const pivot = new THREE.Group();
    const sx = side === 0 ? 1 : -1;
    pivot.position.set(0.27 * sx, S2_LEN, 0);
    const geo = new THREE.LatheGeometry(fairingProfile, 28, side === 0 ? 0 : Math.PI, Math.PI);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: matWhite2.map, roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide }));
    m.position.x = -0.27 * sx;
    pivot.add(m);
    s2.add(pivot);
    return { pivot, sx };
  });
  // Payload: a tandem pair of satellites.
  const payload = new THREE.Group();
  const sats = [0xc8733f, 0x4a7dd8].map((tint, i) => {
    const g = new THREE.Group();
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), matGold);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.17), new THREE.MeshStandardMaterial({ color: tint, roughness: 0.4, metalness: 0.3, emissive: tint, emissiveIntensity: 0.25 }));
    cap.position.y = 0.13;
    const panels = [-1, 1].map((sd) => {
      const pv = new THREE.Group(); pv.position.x = 0.08 * sd;
      const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.012), matPanel);
      pnl.position.x = 0.3 * sd; pv.add(pnl); pv.scale.x = 0.02; g.add(pv); return pv;
    });
    g.add(bus, cap);
    g.position.x = i === 0 ? -0.09 : 0.09;
    payload.add(g);
    return { g, panels };
  });
  payload.position.y = S2_LEN + 0.3;
  s2.add(payload);
  // Rideshare cubesats
  const cubes = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.06), i % 2 ? matGold : matMetal);
    const a = (i / 6) * Math.PI * 2;
    c.userData.dir = V3(Math.cos(a) * 0.6, 0.35 + Math.random() * 0.3, Math.sin(a) * 0.6).normalize();
    c.userData.spin = V3(Math.random(), Math.random(), Math.random());
    c.position.set(Math.cos(a) * 0.12, S2_LEN + 0.12, Math.sin(a) * 0.12);
    c.userData.home = c.position.clone();
    c.visible = false;
    s2.add(c); cubes.push(c);
  }
  // Vapour cone (transonic)
  const vapour = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.2, 40, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uA: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ vY = position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uA; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float f = pow(1.0-abs(dot(vN,vV)), 1.6); float band = smoothstep(-1.1,-0.4,vY)*smoothstep(1.1,0.2,vY);
          float a = f*band*uA*0.55; gl_FragColor = vec4(vec3(0.95,0.97,1.0)*a, a); }`,
    }),
  );
  vapour.position.y = -0.6;
  vapour.renderOrder = 7;
  s2.add(vapour);

  /* ---------- ground, pad, tower ---------- */
  const ground = new THREE.Group();
  const groundMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uOpacity: { value: 1 }, uLight: { value: 1 }, uFog: { value: new THREE.Color(0.66, 0.78, 0.9) }, uFogD: { value: 1 / 2600 } },
    vertexShader: `varying vec3 vW; varying vec2 vP;
      void main(){ vP = position.xy; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uOpacity, uLight, uFogD; uniform vec3 uFog; varying vec3 vW; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec2 p = vec2(vP.x, -vP.y);
        float a = fbm(p*0.0035), b = fbm(p*0.03 + 7.0);
        vec3 col = mix(vec3(0.16,0.22,0.11), vec3(0.33,0.31,0.21), smoothstep(0.35,0.7,a));
        col = mix(col, vec3(0.1,0.16,0.09), smoothstep(0.5,0.85,b)*0.6);
        float grid = step(0.96, fract(p.x*0.012 + a)) + step(0.96, fract(p.y*0.012 + b));
        col = mix(col, vec3(0.42,0.4,0.32), clamp(grid,0.,1.)*0.25*(1.-smoothstep(600.,2500.,length(p))));
        float coast = 1700. + (fbm(vec2(p.x*0.0012, 3.1)) - 0.5) * 1400.;
        float sea = smoothstep(coast - 30., coast + 30., p.y);
        col = mix(col, vec3(0.05,0.12,0.19), sea);
        col *= uLight;
        float d = length(vW - cameraPosition);
        col = mix(col, uFog, 1.0 - exp(-d * uFogD));
        gl_FragColor = vec4(col, uOpacity);
      }`,
  });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000, 1, 1), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  ground.add(groundMesh);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, PAD_DECK, 56), matConcrete);
  pad.position.y = PAD_DECK / 2; ground.add(pad);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 7), matBlack);
  trench.position.set(0, PAD_DECK + 0.005, 2.6); ground.add(trench);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 24, 1, true), matTower);
  mount.material.side = THREE.DoubleSide;
  mount.position.y = PAD_DECK + 0.1; ground.add(mount);
  // Lattice tower (instanced beams)
  const TX = 1.95, TW = 0.5, TH = 9.2;
  const beams = [];
  const beam = (a, b, th = 0.05) => beams.push([a, b, th]);
  const legs = [[TX - TW, -TW], [TX + TW, -TW], [TX + TW, TW], [TX - TW, TW]];
  legs.forEach(([x, z]) => beam(V3(x, PAD_DECK, z), V3(x, TH, z), 0.07));
  for (let y = PAD_DECK; y < TH - 0.2; y += 0.7) {
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = legs[i], [x1, z1] = legs[(i + 1) % 4];
      beam(V3(x0, y, z0), V3(x1, y, z1), 0.035);
      const up = Math.min(TH, y + 0.7);
      if (((y / 0.7) | 0) % 2 === i % 2) beam(V3(x0, y, z0), V3(x1, up, z1), 0.022);
      else beam(V3(x1, y, z1), V3(x0, up, z0), 0.022);
    }
  }
  beam(V3(TX, TH, 0), V3(TX, TH + 1.1, 0), 0.03); // lightning mast
  const towerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matTower, beams.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V3(), up = V3(0, 1, 0);
    beams.forEach(([a, b, th], i) => {
      const dir = tmpV.copy(b).sub(a); const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(tmpV2.copy(a).add(b).multiplyScalar(0.5), q, s.set(th, len, th));
      towerMesh.setMatrixAt(i, m);
    });
  }
  ground.add(towerMesh);
  const ARM_Y = PAD_DECK + 0.6 + S1_LEN - 0.22 - 0.06; // grid-fin height at catch
  const arms = [1, -1].map((sz) => {
    const pv = new THREE.Group(); pv.position.set(TX - TW, ARM_Y, 0.42 * sz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.09), matMetal);
    arm.position.x = -1.0; pv.add(arm);
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.16), matTower);
    pv.add(carriage);
    ground.add(pv); return { pv, sz };
  });
  // Lamps around the pad
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), matTower);
    pole.position.set(Math.cos(a) * 8, 1.3, Math.sin(a) * 8); ground.add(pole);
  }
  // Water tower + tank farm for scale
  const tank = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), matConcrete); tank.position.set(-14, 1.1, -9); ground.add(tank);
  const tank2 = tank.clone(); tank2.position.set(-17, 1.1, -6.5); ground.add(tank2);
  const wt = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.5, 20), matConcrete); wt.position.set(11, 2.25, -12); ground.add(wt);

  /* ---------- particles ---------- */
  class Particles {
    constructor(max, opts) {
      this.max = max; this.cur = 0;
      this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
      this.life = new Float32Array(max); this.maxLife = new Float32Array(max).fill(1);
      this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.h0 = new Float32Array(max);
      this.aSize = new Float32Array(max); this.aAlpha = new Float32Array(max); this.aHeat = new Float32Array(max);
      this.drag = opts.drag || 0; this.rise = opts.rise || 0; this.alpha = opts.alpha || 1; this.fadeIn = opts.fadeIn || 0.08;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("aSize", new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("aAlpha", new THREE.BufferAttribute(this.aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("aHeat", new THREE.BufferAttribute(this.aHeat, 1).setUsage(THREE.DynamicDrawUsage));
      this.geo = g;
      this.mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uTex: { value: opts.tex }, uScale: { value: 500 }, uHot: { value: new THREE.Color(opts.hot || 0xffffff) }, uCool: { value: new THREE.Color(opts.cool || 0xffffff) }, uMax: { value: opts.maxPx || 400 }, uFade: { value: 1 } },
        vertexShader: `attribute float aSize, aAlpha, aHeat; uniform float uScale, uMax; varying float vA, vH;
          void main(){ vA = aAlpha; vH = aHeat; vec4 mv = modelViewMatrix*vec4(position,1.);
            gl_PointSize = min(uMax, aSize * uScale / max(0.1, -mv.z)); gl_Position = projectionMatrix*mv; if (aAlpha <= 0.0) gl_PointSize = 0.0; }`,
        fragmentShader: `uniform sampler2D uTex; uniform vec3 uHot, uCool; uniform float uFade; varying float vA, vH;
          void main(){ vec4 t = texture2D(uTex, gl_PointCoord); vec3 c = mix(uCool, uHot, vH); float a = t.a * vA * uFade;
            gl_FragColor = vec4(c * ${opts.additive ? "a" : "1.0"}, a); }`,
      });
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = opts.order || 4;
    }
    emit(x, y, z, vx, vy, vz, life, s0, s1, heat = 1) {
      const i = this.cur; this.cur = (i + 1) % this.max;
      const j = i * 3;
      this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
      this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
      this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.h0[i] = heat;
    }
    update(dt) {
      const P = this.pos, Vv = this.vel, dragK = Math.max(0, 1 - this.drag * dt);
      for (let i = 0; i < this.max; i++) {
        if (this.life[i] <= 0) { if (this.aAlpha[i] !== 0) this.aAlpha[i] = 0; continue; }
        this.life[i] -= dt;
        const j = i * 3;
        Vv[j] *= dragK; Vv[j + 1] = Vv[j + 1] * dragK + this.rise * dt; Vv[j + 2] *= dragK;
        P[j] += Vv[j] * dt; P[j + 1] += Vv[j + 1] * dt; P[j + 2] += Vv[j + 2] * dt;
        const k = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
        this.aSize[i] = lerp(this.s0[i], this.s1[i], Math.sqrt(k));
        this.aAlpha[i] = this.alpha * Math.min(1, k / this.fadeIn) * Math.pow(1 - k, 1.4);
        this.aHeat[i] = this.h0[i] * (1 - k) * (1 - k);
      }
      const a = this.geo.attributes;
      a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aHeat.needsUpdate = true;
    }
    shift(dx, dy, dz) { // move all live particles (keeps them in a moving frame)
      for (let i = 0; i < this.max; i++) if (this.life[i] > 0) { const j = i * 3; this.pos[j] += dx; this.pos[j + 1] += dy; this.pos[j + 2] += dz; }
    }
  }
  const PK = MOBILE ? 0.45 : 1;
  const exhaust = new Particles(Math.round(900 * PK), { tex: texSoft, additive: true, hot: 0xfff2d8, cool: 0xff5a14, drag: 1.2, alpha: 0.75, order: 6 });
  const trail = new Particles(Math.round(700 * PK), { tex: texSmoke, hot: 0xffffff, cool: 0xc9ced6, drag: 0.6, alpha: 0.55, rise: 0.4, order: 3, maxPx: 600 });
  const padCloud = new Particles(Math.round(520 * PK), { tex: texSmoke, hot: 0xffe9cf, cool: 0xd8dbe0, drag: 0.35, alpha: 0.85, rise: 0.35, fadeIn: 0.05, order: 3, maxPx: 900 });
  const puffs = new Particles(160, { tex: texSoft, hot: 0xffffff, cool: 0xe6ecf5, drag: 2.0, alpha: 0.6, order: 6 });
  const clouds = new Particles(Math.round(260 * PK), { tex: texSmoke, hot: 0xffffff, cool: 0xf2f5f8, drag: 0, alpha: 0.9, fadeIn: 0.001, order: 2, maxPx: 1400 });
  // Cloud deck: static, effectively immortal particles in ground space.
  for (let i = 0; i < clouds.max; i++) {
    const r = Math.sqrt(Math.random()) * 5200, a = Math.random() * Math.PI * 2;
    clouds.emit(Math.cos(a) * r, 380 + Math.random() * 90, Math.sin(a) * r, 0, 0, 0, 1e9, 160 + Math.random() * 220, 160 + Math.random() * 220, 0);
  }
  // immortal particles: freeze alpha at a constant
  clouds.update = function () {
    for (let i = 0; i < this.max; i++) { this.aSize[i] = this.s0[i]; this.aAlpha[i] = 0.55; this.aHeat[i] = 0; }
    this.geo.attributes.aSize.needsUpdate = this.geo.attributes.aAlpha.needsUpdate = true;
    this.update = () => {};
  };
  clouds.update(0);
  ground.add(padCloud.points, clouds.points);

  /* ---------- main scene ---------- */
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  world.add(s2, booster, ground, exhaust.points, trail.points, puffs.points);
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
  const hemi = new THREE.HemisphereLight(0x9cc4ff, 0x4a4436, 0.9);
  scene.add(sun, sun.target, hemi);

  const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 30000);
  const pipCam = new THREE.PerspectiveCamera(70, 16 / 10, 0.02, 30000);

  /* ---------- earth scene ---------- */
  const escene = new THREE.Scene();
  const ecam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 40000);
  const SUN_E = V3(-0.35, 0.6, 0.72).normalize();
  const loader = new THREE.TextureLoader();
  const texUrl = (f) => new URL(`../textures/${f}`, import.meta.url).href;
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uDay: { value: blank }, uNight: { value: blank }, uMask: { value: blank }, uSun: { value: SUN_E }, uReady: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D uDay, uNight, uMask; uniform vec3 uSun; uniform float uReady;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float ndl = dot(n, uSun);
        vec3 day = mix(vec3(0.08,0.18,0.32), texture2D(uDay, vUv).rgb, uReady);
        vec3 night = texture2D(uNight, vUv).rgb * uReady;
        vec4 m = texture2D(uMask, vUv);
        float cloud = m.r * uReady, ocean = m.g;
        float light = smoothstep(-0.12, 0.3, ndl);
        vec3 col = day * (0.04 + 1.05 * max(ndl, 0.0));
        col = mix(col, vec3(0.96) * (0.03 + max(ndl, 0.0)), cloud * 0.88);
        col += night * vec3(1.0, 0.82, 0.55) * 1.3 * (1.0 - light) * (1.0 - cloud);
        vec3 r = reflect(-uSun, n);
        col += vec3(1.0, 0.92, 0.8) * ocean * pow(max(dot(r, v), 0.0), 60.0) * 0.55 * light * (1.0 - cloud);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col = mix(col, vec3(0.38, 0.62, 1.0) * (0.15 + light), fres * 0.65);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, MOBILE ? 256 : 384, MOBILE ? 128 : 192), earthMat);
  {
    // Rotate the globe so the launch site (Bangkok) is at +Y and due east is +X.
    const lat = (13.7563 * Math.PI) / 180, lon = (100.5018 * Math.PI) / 180;
    const s = V3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    const e = V3(-Math.sin(lon), 0, -Math.cos(lon));
    const z = V3().crossVectors(e, s);
    const m = new THREE.Matrix4().makeBasis(e, s, z).transpose();
    earth.quaternion.setFromRotationMatrix(m);
  }
  earth.renderOrder = 2;
  escene.add(earth);
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uSun: { value: SUN_E }, uA: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uA; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float f = pow(1.0 - abs(dot(n, v)), 4.0); float l = smoothstep(-0.25, 0.4, dot(n, uSun));
        float a = f * (0.2 + l) * uA; gl_FragColor = vec4(vec3(0.32, 0.6, 1.0) * a, a); }`,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_E * 1.016, 128, 64), atmoMat);
  atmo.renderOrder = 3;
  escene.add(atmo);
  const skyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    uniforms: { uUp: { value: V3(0, 1, 0) }, uSun: { value: SUN_E }, uAlt: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vD = w.xyz - cameraPosition; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uUp, uSun; uniform float uAlt; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float mu = dot(d, uUp);
        float dens = exp(-uAlt / 7.5);
        vec3 zen = mix(vec3(0.01,0.02,0.06), vec3(0.12,0.35,0.8), clamp(dens*1.4, 0., 1.));
        vec3 hor = mix(vec3(0.22,0.38,0.75), vec3(0.68,0.8,0.94), clamp(dens*1.2, 0., 1.));
        vec3 col = mix(hor, zen, smoothstep(-0.02, 0.55, mu));
        col = mix(col, vec3(0.6,0.66,0.7), smoothstep(0.0, -0.1, mu) * clamp(dens*1.5, 0., 1.));
        float sd = max(dot(d, uSun), 0.0);
        float sunA = pow(sd, 900.0) * 6.0 + pow(sd, 60.0) * 0.5 + pow(sd, 6.0) * 0.18 * dens;
        col += vec3(1.0, 0.93, 0.82) * sunA;
        float a = clamp(dens * 1.8 + pow(1.0 - abs(mu), 12.0) * exp(-uAlt / 45.0) * 0.8, 0., 1.);
        a = max(a, clamp(sunA, 0., 1.));
        gl_FragColor = vec4(col, a); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 48, 24), skyMat);
  sky.renderOrder = 1;
  escene.add(sky);
  const starGeo = new THREE.BufferGeometry();
  {
    const n = MOBILE ? 1800 : 3600, arr = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      arr[i * 3] = r * Math.cos(a) * 20000; arr[i * 3 + 1] = u * 20000; arr[i * 3 + 2] = r * Math.sin(a) * 20000;
      sz[i] = Math.pow(Math.random(), 6) * 2.6 + 0.7;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
  }
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uPx: { value: DPR } },
    vertexShader: `attribute float aSize; uniform float uPx; varying float vS; void main(){ vS = aSize; gl_PointSize = aSize * uPx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * uA * min(1.0, vS * 0.6); gl_FragColor = vec4(vec3(0.85,0.9,1.0)*a, a); }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = 0;
  stars.frustumCulled = false;
  escene.add(stars);

  // Earth textures (2K, same files the home page uses)
  const loadTex = (f) => new Promise((res) => loader.load(texUrl(f), (t) => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
  Promise.all([loadTex("earth-day-2k.webp"), loadTex("earth-night-2k.webp"), loadTex("earth-masks-2k.webp")]).then(([d, n, m]) => {
    if (d) earthMat.uniforms.uDay.value = d;
    if (n) earthMat.uniforms.uNight.value = n;
    if (m) earthMat.uniforms.uMask.value = m;
    if (d) earthMat.uniforms.uReady.value = 1;
  });

  /* ---------- per-frame scene pose ---------- */
  const axisOf = (p, out) => out.set(Math.sin(p), Math.cos(p), 0);
  const s2Axis = V3(), sepAxis = V3(), bAxis = V3(), bRel = V3(), groundRel = V3();
  const payloadPos = V3();

  function poseScene(st, time) {
    const t = st.t, s = st.s2;
    axisOf(s.p, s2Axis);
    const ref = t < T_SEP ? s2Axis : axisOf(tab(S2.p, T_SEP) * Math.PI / 180, sepAxis);
    s2.position.set(0, 0, 0);
    s2.rotation.set(0, 0, -s.p);
    // booster relative to stage 2 (near-field separation + flip)
    const ts = Math.max(0, t - T_SEP);
    const drift = 0.35 * ts + 0.014 * ts * ts;
    bRel.copy(ref).multiplyScalar(-(S1_LEN / 2) - drift).addScaledVector(Z_AXIS, -0.02 * ts);
    booster.position.copy(bRel);
    const bp = t < T_SEP ? s.p : st.b.p;
    booster.rotation.set(0, 0, -bp + (t > 362 && t < 418 ? Math.sin(time * 1.7) * 0.015 : 0));
    axisOf(bp, bAxis);
    booster.visible = t < T_SEP + 60;
    // ground relative to stage 2
    groundRel.copy(ref).multiplyScalar(-S1_LEN).add(tmpV.set(-s.d * U, -s.h * U - PAD_DECK, 0));
    ground.position.copy(groundRel);

    // grid fins deploy after sep
    const fin = smooth(T_SEP + 4, T_SEP + 8, t);
    gridFins.forEach((g) => { g.rotation.z = lerp(-Math.PI / 2 + 0.06, 0, fin); });
    // tower arms: open for launch, close for the catch
    const close = smooth(400, 416, t);
    arms.forEach(({ pv, sz }) => { pv.rotation.y = sz * lerp(1.05, 0, close); });
    // engines
    const [n1, th1] = s1Engines(t);
    const atm = Math.exp(-st.b.h / 9);
    const vac1 = 1 - smooth(0.02, 0.6, atm);
    const u1 = plume1.material.uniforms;
    u1.uThr.value = th1 * (n1 ? 1 : 0); u1.uVac.value = vac1; u1.uTime.value = time;
    const clusterR = n1 >= 9 ? 0.22 : n1 === 3 ? 0.16 : 0.08;
    u1.uR0.value = clusterR; u1.uR1.value = lerp(clusterR * 1.8, 4.2, vac1); u1.uLen.value = lerp(3.4, 13, vac1) * (0.6 + 0.4 * th1);
    glow1.material.opacity = th1 * (n1 ? 1 : 0); glow1.scale.setScalar((n1 >= 9 ? 1.5 : 0.9) * (0.8 + Math.random() * 0.12));
    plumeLight.intensity = th1 * (n1 ? 1 : 0) * 40 * (1 - vac1 * 0.85);
    const th2 = st.th2, u2 = plume2.material.uniforms;
    u2.uThr.value = th2; u2.uVac.value = 1; u2.uTime.value = time; u2.uR0.value = 0.19; u2.uR1.value = 3.4; u2.uLen.value = 12;
    glow2.material.opacity = th2 * 0.8; glow2.scale.setScalar(0.8 + Math.random() * 0.1);
    // nozzle glows while burning and cools after SECO
    mvac.material.emissiveIntensity = th2 * 0.32 + (t > T_SECO ? Math.max(0, 1 - (t - T_SECO) / 40) * 1.2 : 0);
    matNozzle.emissiveIntensity = (n1 ? th1 : 0) * 0.9;
    // vapour cone
    vapour.material.uniforms.uA.value = bell(t, 58, 4) * (t < T_SEP ? 1 : 0);
    // fairing
    const tf = t - T_FAIRING;
    fairings.forEach(({ pivot, sx }) => {
      if (tf <= 0) { pivot.position.set(0.27 * sx, S2_LEN, 0); pivot.rotation.set(0, 0, 0); pivot.visible = true; return; }
      const open = smooth(0, 3, tf);
      pivot.rotation.z = -sx * open * 0.9 - sx * tf * 0.02;
      pivot.position.set(0.27 * sx + sx * tf * 0.09, S2_LEN - tf * 0.06, 0);
      pivot.visible = tf < 60;
    });
    // payload deploy: two satellites drift off and orbit each other
    const tp = t - T_DEPLOY;
    if (tp <= 0) { payload.position.set(0, S2_LEN + 0.3, 0); payload.rotation.set(0, 0, 0); }
    else {
      payload.position.set(0, S2_LEN + 0.3 + tp * 0.07, 0);
      payload.rotation.set(0, tp * 0.06, 0);
    }
    const spread = smooth(4, 18, tp);
    sats.forEach(({ g, panels }, i) => {
      const sgn = i === 0 ? -1 : 1;
      const a = tp > 0 ? tp * 0.05 : 0;
      g.position.set(sgn * (0.09 + spread * 0.55) * Math.cos(a), 0, sgn * spread * 0.55 * Math.sin(a));
      const unfold = smooth(8, 22, tp);
      panels.forEach((pv) => { pv.scale.x = lerp(0.02, 1, unfold); });
    });
    payloadPos.copy(payload.position).applyQuaternion(s2.quaternion);
    // rideshare
    const tr = t - T_RIDESHARE;
    cubes.forEach((c) => {
      c.visible = tr > 0;
      if (tr > 0) {
        c.position.copy(c.userData.home).addScaledVector(c.userData.dir, tr * 0.06 + 0.2);
        c.rotation.set(c.userData.spin.x * tr, c.userData.spin.y * tr, c.userData.spin.z * tr);
      }
    });
  }

  /* ---------- environment for a given focus frame ---------- */
  function setEnv(h, d, camLocalPos, camQuat, eCam, fov, aspect) {
    const th = d / R_E;
    // light
    rotZ.setFromAxisAngle(Z_AXIS, th);
    tmpV.copy(SUN_E).applyQuaternion(rotZ);
    sun.position.copy(tmpV).multiplyScalar(50); sun.target.position.set(0, 0, 0);
    const dens = Math.exp(-h / 8);
    hemi.color.setRGB(lerp(0.05, 0.62, dens), lerp(0.08, 0.77, dens), lerp(0.16, 1.0, dens));
    hemi.groundColor.setRGB(lerp(0.12, 0.29, dens), lerp(0.2, 0.27, dens), lerp(0.34, 0.21, dens));
    hemi.intensity = lerp(0.6, 1.0, dens);
    // ground fade + fog colour (keyed to the camera's altitude, so a pad camera
    // tracking a rocket 100 km up still stands on the ground)
    const camAlt = Math.max(0.002, h + camLocalPos.y / U);
    ground.visible = camAlt < 16;
    groundMat.uniforms.uOpacity.value = 1 - smooth(6, 14, camAlt);
    clouds.mat.uniforms.uFade.value = 1 - smooth(8, 15, camAlt);
    groundMat.uniforms.uFogD.value = lerp(1 / 1200, 1 / 2600, smooth(0, 3, h));
    groundMat.uniforms.uFog.value.setRGB(lerp(0.4, 0.66, dens), lerp(0.55, 0.78, dens), lerp(0.85, 0.92, dens));
    groundMat.uniforms.uLight.value = 0.85 + 0.25 * Math.max(0, tmpV.y);
    // earth camera mirrors the main camera
    rotZ.setFromAxisAngle(Z_AXIS, -th);
    eCam.position.set(Math.sin(th) * (R_E + h), Math.cos(th) * (R_E + h), 0)
      .add(tmpV2.copy(camLocalPos).multiplyScalar(1 / U).applyQuaternion(rotZ));
    eCam.quaternion.copy(rotZ).multiply(camQuat);
    eCam.fov = fov; eCam.aspect = aspect;
    eCam.near = Math.max(0.02, camAlt * 0.4);
    eCam.far = 40000;
    eCam.updateProjectionMatrix();
    eCam.updateMatrixWorld();
    earth.visible = camAlt > 4;
    atmoMat.uniforms.uA.value = smooth(4, 30, camAlt);
    sky.position.copy(eCam.position); stars.position.copy(eCam.position);
    skyMat.uniforms.uUp.value.set(Math.sin(th), Math.cos(th), 0);
    skyMat.uniforms.uAlt.value = camAlt;
    starMat.uniforms.uA.value = smooth(22, 75, camAlt) * 0.95;
  }

  /* ---------- cameras ---------- */
  const camPos = V3(), camTgt = V3(), shake = V3();
  const right = V3();
  function placeMainCam(st, time, dt) {
    const t = st.t;
    const sepBlend = smooth(T_SEP, T_SEP + 22, t);
    const deployBlend = smooth(T_DEPLOY + 2, T_DEPLOY + 26, t);
    camTgt.copy(s2Axis).multiplyScalar(lerp(-0.9, 1.0, sepBlend));
    camTgt.lerp(payloadPos, deployBlend * 0.6);
    right.set(Math.cos(st.s2.p), -Math.sin(st.s2.p), 0);
    let fov = 40;
    cam.up.set(0, 1, 0);
    const mode = ctl.phase === "countdown" ? 3 : ctl.cam;
    if (mode === 0) { // chase
      const dist = lerp(17, 9, sepBlend) + deployBlend * 1.5;
      camTgt.addScaledVector(s2Axis, lerp(-1.6, -0.6, sepBlend));
      camPos.copy(camTgt).addScaledVector(s2Axis, lerp(-3.5, -2.2, sepBlend)).addScaledVector(Z_AXIS, dist).addScaledVector(right, -2.2 + Math.sin(time * 0.13) * 0.8);
      if (t < 10) camPos.addScaledVector(s2Axis, -3 * (1 - t / 10));
      fov = 38;
    } else if (mode === 1) { // pad
      camPos.copy(ground.position).add(tmpV.set(-16, 1.4, 26));
      const dir = tmpV2.copy(camPos).sub(camTgt);
      let dist = dir.length();
      if (dist > 12000) { camPos.copy(camTgt).addScaledVector(dir.normalize(), 12000); dist = 12000; }
      fov = clamp((2 * Math.atan(6.5 / dist) * 180) / Math.PI, 0.5, 48);
    } else if (mode === 2) { // onboard (stage 2, looking aft)
      camPos.copy(s2Axis).multiplyScalar(0.55).addScaledVector(Z_AXIS, 0.36);
      camTgt.copy(camPos).addScaledVector(s2Axis, -10).addScaledVector(Z_AXIS, 0.4);
      cam.up.copy(Z_AXIS);
      fov = 72;
    } else { // track (cinematic orbit)
      const a = time * 0.06;
      const r = ctl.phase === "countdown" ? 24 : 26;
      camPos.copy(camTgt).add(tmpV.set(Math.sin(a) * r, (ctl.phase === "countdown" ? 1.5 : 5) + Math.cos(a * 0.7) * 2.5, Math.cos(a) * r));
      if (ctl.phase === "countdown") camTgt.addScaledVector(s2Axis, -1.5);
      fov = 34;
    }
    // shake: liftoff rumble, max-Q buffeting, separation kicks
    const amp = REDUCE ? 0 : (t >= -2 && t < 14 ? 0.05 * (t < 0 ? (t + 2) / 2 : 1 - t / 14) : 0) + (st.q / 25) * 0.035 * (t < T_SEP ? 1 : 0) + (st.kick ? 0.12 : 0);
    st.kick = 0;
    if (amp > 0 && mode !== 1) {
      shake.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
      camPos.add(shake);
    }
    cam.position.copy(camPos);
    cam.fov = fov; cam.aspect = innerWidth / innerHeight;
    const dTgt = camPos.distanceTo(camTgt);
    cam.near = clamp(dTgt * 0.01, 0.02, 30); cam.far = dTgt + 26000;
    cam.lookAt(camTgt);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /* ---------- particle emission (main frame) ---------- */
  const emitP = V3(), emitD = V3();
  function emitParticles(st, dt) {
    const t = st.t;
    const [n1, th1] = s1Engines(t);
    const h = st.s2.h;
    // stage-1 exhaust while attached (main frame only)
    if (n1 && t < T_SEP + 0.5 && th1 > 0.05) {
      booster.updateMatrixWorld();
      emitP.set(0, -0.25, 0); bInner.localToWorld(emitP); world.worldToLocal(emitP);
      emitD.copy(s2Axis).negate();
      const vac = smooth(30, 70, h);
      const nEx = Math.round((MOBILE ? 7 : 16) * th1);
      const speed = 22 + 30 * vac;
      for (let i = 0; i < nEx; i++) {
        const j = 0.25 + vac * 1.2;
        exhaust.emit(emitP.x + (Math.random() - 0.5) * 0.3, emitP.y, emitP.z + (Math.random() - 0.5) * 0.3,
          emitD.x * speed + (Math.random() - 0.5) * j * 10, emitD.y * speed + (Math.random() - 0.5) * j * 10, (Math.random() - 0.5) * j * 10,
          0.35 + Math.random() * 0.3, 0.5, 1.8 + vac * 4, 1);
      }
      // smoke trail in the lower atmosphere
      if (h < 32 && t >= 0) {
        const nT = Math.round((MOBILE ? 2 : 5) * (1 - h / 32));
        const sp = 14 + Math.min(40, st.s2.v / 60);
        for (let i = 0; i < nT; i++) {
          const k = Math.random();
          trail.emit(emitP.x + emitD.x * (2 + k * 3), emitP.y + emitD.y * (2 + k * 3), emitP.z,
            emitD.x * sp + (Math.random() - 0.5) * 2, emitD.y * sp + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2,
            2.4 + Math.random() * 1.8, 1.2, 5 + h * 0.4, 0.3);
        }
      }
    }
    // pre-launch venting
    if (t < -0.5) {
      if (Math.random() < 0.6) {
        const side = Math.random() < 0.5 ? 1 : -1;
        emitP.set(BODY_R * side * 1.05, Math.random() < 0.5 ? -0.3 : -3.2, 0.05);
        puffs.emit(emitP.x, emitP.y, emitP.z, side * (0.6 + Math.random() * 0.5), -0.25 - Math.random() * 0.4, (Math.random() - 0.5) * 0.4, 2 + Math.random() * 1.5, 0.15, 1.1, 0);
      }
    }
    // pad cloud: ground frame, survives the climb
    if (n1 && t > -2.5 && h < 0.4) {
      const n = Math.round((MOBILE ? 3 : 7) * th1);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const flameDir = Math.random() < 0.55; // most goes out of the trench
        const sp = 6 + Math.random() * 10;
        const vx = flameDir ? (Math.random() - 0.5) * 3 : Math.cos(a) * sp;
        const vz = flameDir ? 9 + Math.random() * 7 : Math.sin(a) * sp;
        padCloud.emit((Math.random() - 0.5) * 0.6, PAD_DECK + 0.3, (flameDir ? 2.5 : 0), vx, 0.6 + Math.random() * 1.4, vz, 7 + Math.random() * 6, 1.4, 9 + Math.random() * 7, t < 2 ? 0.6 : 0.15);
      }
    }
    // separation and RCS puffs
    if (t > T_SEP && t < T_SEP + 0.6) {
      for (let i = 0; i < 12; i++) {
        emitP.copy(s2Axis).multiplyScalar(-0.05);
        puffs.emit(emitP.x + (Math.random() - 0.5) * 0.5, emitP.y, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0.8 + Math.random() * 0.6, 0.2, 1.4, 0);
      }
    }
    if (t > T_SEP + 1 && t < 172 && Math.random() < 0.35 && booster.visible) {
      emitP.copy(bTop); bInner.localToWorld(emitP); world.worldToLocal(emitP);
      const side = Math.random() < 0.5 ? 1 : -1;
      puffs.emit(emitP.x, emitP.y, emitP.z, side * 2.2, 0, side * 0.6, 0.5, 0.1, 0.7, 0);
    }
    exhaust.update(dt); trail.update(dt); padCloud.update(dt); puffs.update(dt);
  }

  /* ---------- PiP: booster cam ---------- */
  const pipBox = { x: 0, y: 0, w: 0, h: 0 };
  function pipRect() {
    const el = hud.pip;
    if (!el.classList.contains("is-on")) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || getComputedStyle(el).display === "none") return null;
    pipBox.x = r.left + 1; pipBox.y = r.top + 1; pipBox.w = r.width - 2; pipBox.h = r.height - 2;
    return pipBox;
  }
  const pipPos = V3(), pipTgt = V3();
  const pipECam = new THREE.PerspectiveCamera(70, 1.6, 0.05, 40000);
  function renderPip(st, time, box) {
    const t = st.t, b = st.b;
    // re-centre the world on the booster
    const saveS2 = s2.position.clone(), saveB = booster.position.clone(), saveG = ground.position.clone();
    const saveBV = booster.visible;
    booster.position.set(0, 0, 0);
    booster.visible = true;
    s2.position.copy(saveS2).sub(saveB);
    s2.visible = t < T_SEP + 60;
    ground.position.set(-b.d * U, -b.h * U - PAD_DECK - S1_LEN / 2, 0);
    exhaust.points.visible = trail.points.visible = puffs.points.visible = false;
    const tower = t > 398;
    if (tower) {
      pipPos.copy(ground.position).add(tmpV.set(-5.5, ARM_Y + 2.2, 7.5));
      pipTgt.set(0, 0, 0).lerp(tmpV2.copy(ground.position).add(tmpV.set(0.6, ARM_Y - 1.5, 0)), 0.55);
      pipCam.up.set(0, 1, 0);
      pipCam.fov = 46;
    } else {
      pipPos.copy(bAxis).multiplyScalar(S1_LEN / 2 - 0.35).addScaledVector(Z_AXIS, 0.34);
      pipTgt.copy(pipPos).addScaledVector(bAxis, -10).addScaledVector(Z_AXIS, 0.6);
      pipCam.up.copy(Z_AXIS);
      pipCam.fov = 74;
    }
    pipCam.position.copy(pipPos);
    pipCam.aspect = box.w / box.h;
    pipCam.near = 0.02; pipCam.far = 26000;
    pipCam.lookAt(pipTgt);
    pipCam.updateProjectionMatrix(); pipCam.updateMatrixWorld();
    setEnv(b.h, b.d, pipCam.position, pipCam.quaternion, pipECam, pipCam.fov, pipCam.aspect);
    setPointScale(pipCam, box.h);
    const H = innerHeight;
    renderer.setScissorTest(true);
    renderer.setViewport(box.x, H - box.y - box.h, box.w, box.h);
    renderer.setScissor(box.x, H - box.y - box.h, box.w, box.h);
    renderer.clear();
    renderer.render(escene, pipECam);
    renderer.clearDepth();
    renderer.render(scene, pipCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    // restore
    s2.position.copy(saveS2); booster.position.copy(saveB); ground.position.copy(saveG);
    s2.visible = true; booster.visible = saveBV;
    exhaust.points.visible = trail.points.visible = puffs.points.visible = true;
  }

  function setPointScale(c, hPx) {
    const sc = (hPx * DPR * 0.5) / Math.tan((c.fov * Math.PI) / 360);
    exhaust.mat.uniforms.uScale.value = sc; trail.mat.uniforms.uScale.value = sc;
    padCloud.mat.uniforms.uScale.value = sc; puffs.mat.uniforms.uScale.value = sc; clouds.mat.uniforms.uScale.value = sc;
  }

  /* ---------- resize ---------- */
  function onResize() { renderer.setSize(innerWidth, innerHeight, false); }
  addEventListener("resize", onResize);

  // Keep particles glued to the moving stage frame when the ground jumps.
  let lastGround = V3().copy(ground.position);

  renderFrame = (st, dt, time) => {
    poseScene(st, time);
    // Exhaust/trail live in the stage frame, which is moving through the air:
    // keep the trail behind by shifting with the ground's vertical motion
    // (scaled down — the trail stretches instead of teleporting).
    const dy = ground.position.y - lastGround.y, dx = ground.position.x - lastGround.x;
    if (Math.abs(dy) < 50 && Math.abs(dx) < 50) trail.shift(dx * 0.85, dy * 0.85, 0);
    lastGround.copy(ground.position);
    emitParticles(st, dt);
    placeMainCam(st, time, dt);
    setEnv(st.s2.h, st.s2.d, cam.position, cam.quaternion, ecam, cam.fov, cam.aspect);
    setPointScale(cam, innerHeight);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    renderer.clear();
    renderer.render(escene, ecam);
    renderer.clearDepth();
    renderer.render(scene, cam);
    const box = pipRect();
    if (box) renderPip(st, time, box);
  };
}
