/* ============================================================================
   space-scene.js — Deep-space WebGL2 cosmos + 2D canvas fallback (ES module)
   Owned by Gemini for Gun Kaewngarm's portfolio revamp.
   Contract:
     - Mounts inside #spaceStage (first child of <body>)
     - Listens on document: "themechange" ({ detail: { theme } }), "space:warp"
     - Dispatches on document: "space:ready" ({ detail: { webgl } })
     - Exposes window.SpaceScene = { warp, setTheme, isWebGL, pause, resume }
   ============================================================================ */

const DEG2RAD = Math.PI / 180;
const BANGKOK_LAT = 13.7563 * DEG2RAD;
const BANGKOK_LON = 100.5018 * DEG2RAD;
const PLANET_BASE_YAW = -(BANGKOK_LON - 28 * DEG2RAD); // Bangkok near visible right limb
const WARP_DURATION = 2.2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ── Palette, UTC Sun-Sync Math & Baked Nebula ───────────────────────────── */

function parseColor(str, fallback) {
  if (!str) return fallback.slice();
  const s = str.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  const rgb = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  return rgb ? [clamp(rgb[1] / 255, 0, 1), clamp(rgb[2] / 255, 0, 1), clamp(rgb[3] / 255, 0, 1)] : fallback.slice();
}

function readThemePalette(theme) {
  const cs = getComputedStyle(document.documentElement);
  const light = theme === "light";
  return {
    accent: parseColor(cs.getPropertyValue("--accent"), light ? [0.23, 0.45, 0.88] : [0.54, 0.71, 1.0]),
    accent2: parseColor(cs.getPropertyValue("--accent-2"), light ? [0.85, 0.57, 0.30] : [0.96, 0.70, 0.42]),
  };
}

function latLonToVec3(lat, lon) {
  const cl = Math.cos(lat);
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)];
}

/** Real-time UTC subsolar vector (solar declination + UTC longitude) in world space. */
function computeSunDirection(now, planetYaw, tiltZ) {
  const doy = (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000 + 1;
  const decl = -23.44 * DEG2RAD * Math.cos(((2 * Math.PI) / 365.24) * (doy + 10));
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const [lx, ly, lz] = latLonToVec3(decl, (12 - utcH) * 15 * DEG2RAD);
  const cy = Math.cos(planetYaw), sy = Math.sin(planetYaw);
  const rx = lx * cy + lz * sy, rz = -lx * sy + lz * cy;
  const cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
  const wx = rx * cz - ly * sz, wy = rx * sz + ly * cz;
  const len = Math.hypot(wx, wy, rz) || 1;
  return [wx / len, wy / len, rz / len];
}

// "Leaving orbit": most of the pull-back happens over the first ~1.4
// viewports (eased), so the planet clears the content once the hero is
// scrolled past; the last quarter drifts slowly across the whole page.
function getScrollProgress() {
  const y = window.scrollY || window.pageYOffset || 0;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const lift = clamp(y / (window.innerHeight * 1.4), 0, 1);
  const eased = 1 - Math.pow(1 - lift, 3);
  return clamp(eased * 0.75 + (y / max) * 0.25, 0, 1);
}

function evaluateWarp(elapsed) {
  const t = clamp(elapsed / WARP_DURATION, 0, 1);
  let intensity = 1;
  if (t < 0.22) { const u = t / 0.22; intensity = u * u * (3 - 2 * u); }
  else if (t > 0.6) { const u = (t - 0.6) / 0.4; intensity = 1 - u * u * (3 - 2 * u); }
  const d = (t - 0.52) / 0.13;
  return { intensity, flash: Math.exp(-(d * d)) * 0.88, fovPunch: Math.sin(Math.pow(t, 0.85) * Math.PI) * intensity };
}

/** Bake a soft 512x256 nebula canvas once at boot (zero per-frame noise cost). */
function buildNebulaCanvas(palette) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const a = palette.accent.map((v) => Math.round(v * 255));
  const b = palette.accent2.map((v) => Math.round(v * 255));
  const puffs = [
    [0.72, 0.42, 0.46, a, 0.20], [0.60, 0.54, 0.34, b, 0.10],
    [0.24, 0.68, 0.42, a, 0.13], [0.36, 0.28, 0.36, [110, 145, 220], 0.11],
    [0.84, 0.22, 0.28, b, 0.08], [0.48, 0.46, 0.52, [70, 105, 175], 0.09],
  ];
  ctx.globalCompositeOperation = "screen";
  for (const [x, y, r, col, alpha] of puffs) {
    const g = ctx.createRadialGradient(x * 512, y * 256, 0, x * 512, y * 256, r * 256);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${alpha})`);
    g.addColorStop(0.5, `rgba(${col[0]},${col[1]},${col[2]},${alpha * 0.35})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
  }
  return c;
}

/* ── GLSL Shaders (Three.js r170 ShaderMaterial — WebGL2 safe, no in/out) ── */

const STAR_VERT = /* glsl */ `
  attribute float aSize, aPhase, aSpeed;
  attribute vec3 aColor;
  uniform float uTime, uPixelRatio, uOpacity, uWarp, uZMin, uZSpan;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    if (uWarp > 0.001) p.z = mod((p.z - uZMin) + uWarp * 36.0, uZSpan) + uZMin;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (135.0 / max(-mv.z, 1.0)), 1.0, 13.0);
    vColor = aColor;
    vAlpha = (0.72 + 0.28 * sin(uTime * aSpeed + aPhase)) * uOpacity * (1.0 - uWarp * 0.45);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform vec3 uLightTint;
  uniform float uLightMode;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = (exp(-d * d * 26.0) + (1.0 - smoothstep(0.0, 0.5, d)) * 0.34) * vAlpha;
    gl_FragColor = vec4(mix(vColor, uLightTint, uLightMode * 0.65), a);
  }
`;

const WARP_VERT = /* glsl */ `
  attribute float aTail;
  attribute vec3 aColor;
  uniform float uWarp, uWarpTravel, uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float zb = mod(p.z + 65.0 + uWarpTravel, 62.0) - 65.0;
    p.z = zb - aTail * (uWarp * 15.0 + 0.2);
    float fade = smoothstep(-65.0, -52.0, zb) * (1.0 - smoothstep(-10.0, -3.0, zb));
    vColor = aColor;
    vAlpha = (1.0 - aTail * 0.88) * uWarp * uOpacity * fade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const WARP_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha); }
`;

const SPHERE_VERT = /* glsl */ `
  varying vec3 vPosLocal, vNormalWorld, vWorldPos;
  void main() {
    vPosLocal = normalize(position);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform vec3 uSunDir, uAccent, uAccent2, uBangkokDir;
  uniform float uTime, uLightMode;
  varying vec3 vPosLocal, vNormalWorld, vWorldPos;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n0 = mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
                   mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y);
    float n1 = mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
                   mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y);
    return mix(n0, n1, f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.04 + vec3(17.1, 31.7, 11.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = normalize(vPosLocal), N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(mix(uSunDir, normalize(vec3(-0.35, 0.45, 0.82)), uLightMode * 0.72));

    // Procedural continents, oceans, polar ice & drifting cloud bands
    float baseN = fbm(p * 2.15 + vec3(0.4, -0.2, 1.1));
    float elev = baseN * 0.68 + fbm(p * 4.4 + vec3(baseN * 0.75)) * 0.32;
    float land = smoothstep(0.50, 0.545, elev), lat = abs(p.y);
    float ice = smoothstep(0.77, 0.90, lat + (elev - 0.5) * 0.16);
    vec3 cp = vec3(p.x * 1.45, p.y * 2.75, p.z * 1.45) + vec3(uTime * 0.011, 0.0, -uTime * 0.007);
    float clouds = smoothstep(0.52, 0.76, fbm(cp * 1.85 + vec3(2.7, 1.3, -0.8))) * 0.58;

    vec3 seaCol = mix(mix(vec3(0.035, 0.078, 0.165), vec3(0.56, 0.69, 0.86), uLightMode),
                      mix(vec3(0.075, 0.155, 0.270), vec3(0.66, 0.78, 0.91), uLightMode), smoothstep(0.43, 0.50, elev));
    vec3 landCol = mix(mix(vec3(0.115, 0.165, 0.165), vec3(0.70, 0.76, 0.79), uLightMode),
                       mix(vec3(0.220, 0.235, 0.225), vec3(0.79, 0.82, 0.85), uLightMode), smoothstep(0.57, 0.72, elev));
    vec3 surf = mix(seaCol, landCol, land);
    surf = mix(surf, mix(vec3(0.68, 0.77, 0.88), vec3(0.92, 0.95, 0.99), uLightMode), ice * 0.75);
    surf = mix(surf, mix(vec3(0.80, 0.87, 0.96), vec3(0.96, 0.98, 1.00), uLightMode), clouds);

    // Sun-synced terminator, ocean glint & warm twilight scatter
    float ndl = dot(N, L), day = smoothstep(-0.14, 0.24, ndl);
    float tw = (ndl - 0.02) * 5.0;
    float twilight = exp(-(tw * tw)) * (1.0 - uLightMode * 0.8);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0001), 34.0) * (1.0 - land) * (1.0 - clouds) * day;
    vec3 lit = surf * (mix(0.045, 0.56, uLightMode) + max(ndl, 0.0) * mix(1.08, 0.46, uLightMode));
    lit += mix(vec3(0.78, 0.88, 1.0), vec3(1.0), uLightMode) * spec * mix(0.26, 0.12, uLightMode);
    lit += uAccent2 * twilight * 0.18;

    // Night-side city-light speckles + subtle Bangkok cluster
    float nightMask = (1.0 - smoothstep(-0.22, 0.05, ndl)) * (1.0 - uLightMode);
    float urban = smoothstep(0.505, 0.545, elev) * (1.0 - smoothstep(0.62, 0.74, elev)) * (1.0 - smoothstep(0.56, 0.80, lat));
    float cities = smoothstep(0.43, 0.66, noise3(p * 19.0) * noise3(p * 37.0 + vec3(4.2))) * urban;
    vec3 db = p - uBangkokDir;
    float bkk = exp(-dot(db, db) * 340.0) * 0.85;
    lit += mix(vec3(1.0, 0.78, 0.46), uAccent2, 0.4) * (cities * 0.95 + bkk) * nightMask * (1.0 - clouds * 0.72);

    // Inner-limb atmospheric veil + light-mode haze lift for text readability
    float fres = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 3.1);
    lit += mix(uAccent, vec3(0.76, 0.86, 0.98), uLightMode) * fres * mix(0.16 + 0.36 * day, 0.28, uLightMode);
    lit = mix(lit, mix(lit, vec3(0.89, 0.93, 0.98), 0.34), uLightMode);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSunDir, uAccent, uAccent2;
  uniform float uLightMode;
  varying vec3 vNormalWorld, vWorldPos;
  void main() {
    vec3 N = normalize(vNormalWorld), V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(mix(uSunDir, normalize(vec3(-0.35, 0.45, 0.82)), uLightMode * 0.72));
    float rim = pow(clamp(max(-dot(N, V), 0.0) / 0.39, 0.0001, 1.0), 2.5);
    float st = dot(N, L), sunSide = smoothstep(-0.5, 0.65, st), tw = (st - 0.02) * 4.5;
    float twilight = exp(-(tw * tw)) * (1.0 - uLightMode);
    vec3 col = mix(mix(uAccent * 0.45, uAccent * 1.15, sunSide) + uAccent2 * twilight * 0.38,
                   mix(vec3(0.62, 0.77, 0.95), uAccent, 0.30), uLightMode);
    gl_FragColor = vec4(col, rim * mix(0.20 + 0.64 * sunSide, 0.32, uLightMode));
  }
`;

const RING_VERT = /* glsl */ `
  varying vec3 vRingPos;
  void main() { vRingPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const RING_FRAG = /* glsl */ `
  uniform float uSatAngle, uLightMode;
  uniform vec3 uColor, uAccent;
  varying vec3 vRingPos;
  void main() {
    float wake = exp(-mod(uSatAngle - atan(vRingPos.z, vRingPos.x) + 6.2831853, 6.2831853) * 2.5);
    gl_FragColor = vec4(mix(uColor, uAccent, wake * 0.82), mix(0.13, 0.22, uLightMode) + wake * mix(0.55, 0.30, uLightMode));
  }
`;

const SAT_VERT = /* glsl */ `
  uniform float uPixelRatio, uTime;
  varying float vPulse;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(7.5 * uPixelRatio * (8.5 / max(-mv.z, 1.0)), 3.0, 14.0);
    vPulse = 0.84 + 0.16 * sin(uTime * 3.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const SAT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLightMode;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = (exp(-d * d * 28.0) + (1.0 - smoothstep(0.0, 0.5, d)) * 0.42) * vPulse;
    gl_FragColor = vec4(mix(uColor, vec3(0.24, 0.44, 0.78), uLightMode * 0.72), a);
  }
`;

/* ── WebGL2 Engine (Three.js r170, 8 draw calls idle / 9 during warp) ────── */

function createWebGLEngine(THREE, stageEl, state, onContextLost) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ antialias: dpr <= 1.5, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(dpr, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "space-stage__canvas";
  stageEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const baseFov = 42;
  const camera = new THREE.PerspectiveCamera(baseFov, 1, 0.1, 220);
  camera.position.set(0, 0, 7.2);

  // 1. Baked Nebula Backdrop
  const nebulaTex = new THREE.CanvasTexture(buildNebulaCanvas(state.palette));
  const nebulaMat = new THREE.MeshBasicMaterial({ map: nebulaTex, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending });
  const nebulaMesh = new THREE.Mesh(new THREE.PlaneGeometry(175, 92), nebulaMat);
  nebulaMesh.position.set(0, 0, -108);
  scene.add(nebulaMesh);

  // 2. Layered Parallax Starfield (3 depth layers)
  const lowSpec = window.innerWidth < 768 || (navigator.hardwareConcurrency || 4) <= 4;
  const tints = [[0.68, 0.82, 1.0], [0.88, 0.93, 1.0], [0.98, 0.97, 0.94], [0.99, 0.88, 0.72], [0.96, 0.73, 0.49]];
  const layerDefs = [
    { count: lowSpec ? 380 : 900, zMin: -96, zMax: -46, size: [1.1, 2.2], op: 0.74 },
    { count: lowSpec ? 180 : 420, zMin: -48, zMax: -18, size: [1.5, 3.0], op: 0.88 },
    { count: lowSpec ? 60 : 130, zMin: -20, zMax: -6, size: [2.0, 3.8], op: 0.96 },
  ];

  const starLayers = layerDefs.map((def) => {
    const pos = new Float32Array(def.count * 3), col = new Float32Array(def.count * 3);
    const sizes = new Float32Array(def.count), phases = new Float32Array(def.count), speeds = new Float32Array(def.count);
    for (let i = 0; i < def.count; i++) {
      const z = lerp(def.zMin, def.zMax, Math.random()), sp = Math.abs(z) * 1.15;
      pos[i * 3] = (Math.random() - 0.5) * sp * 2.1;
      pos[i * 3 + 1] = (Math.random() - 0.5) * sp * 1.45;
      pos[i * 3 + 2] = z;
      const t = tints[(Math.random() * tints.length) | 0];
      col[i * 3] = t[0]; col[i * 3 + 1] = t[1]; col[i * 3 + 2] = t[2];
      sizes[i] = lerp(def.size[0], def.size[1], Math.pow(Math.random(), 1.8));
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.55 + Math.random() * 1.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uOpacity: { value: def.op },
        uWarp: { value: 0 }, uZMin: { value: def.zMin }, uZSpan: { value: def.zMax - def.zMin },
        uLightTint: { value: new THREE.Vector3(0.48, 0.60, 0.78) }, uLightMode: { value: 0 },
      },
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, mat, baseOp: def.op };
  });

  // 3. Radial Hyperspace Warp Streaks (hidden when idle)
  const streakCount = lowSpec ? 180 : 300;
  const wPos = new Float32Array(streakCount * 6), wCol = new Float32Array(streakCount * 6), wTail = new Float32Array(streakCount * 2);
  for (let i = 0; i < streakCount; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.4 + Math.pow(Math.random(), 0.7) * 34;
    const x = Math.cos(a) * r * 1.35, y = Math.sin(a) * r * 0.9, z = lerp(-65, -3, Math.random());
    const t = tints[(Math.random() * tints.length) | 0];
    for (let k = 0; k < 2; k++) {
      const idx = (i * 2 + k) * 3;
      wPos[idx] = x; wPos[idx + 1] = y; wPos[idx + 2] = z;
      wCol[idx] = t[0]; wCol[idx + 1] = t[1]; wCol[idx + 2] = t[2];
      wTail[i * 2 + k] = k;
    }
  }
  const warpGeo = new THREE.BufferGeometry();
  warpGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3));
  warpGeo.setAttribute("aColor", new THREE.BufferAttribute(wCol, 3));
  warpGeo.setAttribute("aTail", new THREE.BufferAttribute(wTail, 1));
  const warpMat = new THREE.ShaderMaterial({
    vertexShader: WARP_VERT, fragmentShader: WARP_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uWarp: { value: 0 }, uWarpTravel: { value: 0 }, uOpacity: { value: 0.92 } },
  });
  const warpLines = new THREE.LineSegments(warpGeo, warpMat);
  warpLines.visible = false;
  scene.add(warpLines);

  // 4. Procedural Planet, Fresnel Atmosphere, Orbital Ring & Horizon Satellite
  const planetRoot = new THREE.Group(), planetTilt = new THREE.Group();
  const tiltZ = -11 * DEG2RAD;
  planetTilt.rotation.z = tiltZ;
  planetRoot.add(planetTilt);
  scene.add(planetRoot);

  const planetR = 1.52;
  const bkk = latLonToVec3(BANGKOK_LAT, BANGKOK_LON);
  const acc = new THREE.Vector3(...state.palette.accent), acc2 = new THREE.Vector3(...state.palette.accent2);
  const sun = new THREE.Vector3(...computeSunDirection(new Date(), PLANET_BASE_YAW, tiltZ));

  const planetMat = new THREE.ShaderMaterial({
    vertexShader: SPHERE_VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uSunDir: { value: sun.clone() }, uTime: { value: 0 }, uLightMode: { value: 0 },
      uAccent: { value: acc.clone() }, uAccent2: { value: acc2.clone() },
      uBangkokDir: { value: new THREE.Vector3(bkk[0], bkk[1], bkk[2]) },
    },
  });
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(planetR, lowSpec ? 40 : 60, lowSpec ? 32 : 48), planetMat);
  planetMesh.rotation.y = PLANET_BASE_YAW;
  planetTilt.add(planetMesh);

  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: SPHERE_VERT, fragmentShader: ATMO_FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSunDir: { value: sun.clone() }, uAccent: { value: acc.clone() }, uAccent2: { value: acc2.clone() }, uLightMode: { value: 0 } },
  });
  const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(planetR * 1.085, lowSpec ? 36 : 48, lowSpec ? 28 : 36), atmoMat);
  planetTilt.add(atmoMesh);

  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.set(24 * DEG2RAD, 0, -18 * DEG2RAD);
  planetRoot.add(orbitGroup);

  const ringR = planetR * 1.38, rPos = new Float32Array(128 * 3);
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    rPos[i * 3] = Math.cos(a) * ringR; rPos[i * 3 + 2] = Math.sin(a) * ringR;
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
  const ringMat = new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false,
    uniforms: { uSatAngle: { value: 0.7 }, uColor: { value: new THREE.Vector3(0.45, 0.60, 0.85) }, uAccent: { value: acc.clone() }, uLightMode: { value: 0 } },
  });
  orbitGroup.add(new THREE.LineLoop(ringGeo, ringMat));

  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([Math.cos(0.7) * ringR, 0, Math.sin(0.7) * ringR]), 3));
  const satMat = new THREE.ShaderMaterial({
    vertexShader: SAT_VERT, fragmentShader: SAT_FRAG, transparent: true, depthWrite: false,
    uniforms: { uPixelRatio: { value: renderer.getPixelRatio() }, uTime: { value: 0 }, uColor: { value: new THREE.Vector3(0.95, 0.97, 1.0) }, uLightMode: { value: 0 } },
  });
  orbitGroup.add(new THREE.Points(satGeo, satMat));

  const handleLost = (e) => { e.preventDefault(); onContextLost(); };
  renderer.domElement.addEventListener("webglcontextlost", handleLost, false);

  let isMobile = false, sunAccum = 0, warpTravel = 0, satAngle = 0.7;

  function resize(w, h) {
    const W = Math.max(1, w), H = Math.max(1, h), pr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    isMobile = W < 820;
    for (const l of starLayers) l.mat.uniforms.uPixelRatio.value = pr;
    satMat.uniforms.uPixelRatio.value = pr;
    if (isMobile) { planetRoot.position.set(0, -1.62, 0); planetRoot.scale.setScalar(0.60); }
    else { planetRoot.position.set(clamp(camera.aspect * 1.5, 1.65, 3.0), 0.12, 0); planetRoot.scale.setScalar(clamp(camera.aspect * 0.62, 0.76, 1.0)); }
  }

  function applyTheme(theme, palette) {
    const light = theme === "light", lm = light ? 1 : 0, blend = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    for (const m of [planetMat, atmoMat]) {
      m.uniforms.uLightMode.value = lm; m.uniforms.uAccent.value.set(...palette.accent); m.uniforms.uAccent2.value.set(...palette.accent2);
    }
    atmoMat.blending = blend; atmoMat.needsUpdate = true;
    ringMat.uniforms.uLightMode.value = lm; ringMat.uniforms.uAccent.value.set(...palette.accent);
    ringMat.uniforms.uColor.value.set(light ? 0.30 : 0.45, light ? 0.44 : 0.60, light ? 0.66 : 0.85);
    satMat.uniforms.uLightMode.value = lm;
    for (const l of starLayers) { l.mat.uniforms.uLightMode.value = lm; l.mat.uniforms.uOpacity.value = light ? l.baseOp * 0.14 : l.baseOp; }
    nebulaMat.opacity = light ? 0.12 : 0.65; nebulaMat.blending = blend; nebulaMat.needsUpdate = true;
    warpMat.uniforms.uOpacity.value = light ? 0.55 : 0.92; warpMat.blending = blend; warpMat.needsUpdate = true;
  }

  function render(dt, elapsed, warpState) {
    sunAccum += dt;
    if (sunAccum >= 60) {
      sunAccum = 0;
      const s = computeSunDirection(new Date(), PLANET_BASE_YAW, tiltZ);
      planetMat.uniforms.uSunDir.value.set(s[0], s[1], s[2]);
      atmoMat.uniforms.uSunDir.value.set(s[0], s[1], s[2]);
    }
    if (!state.reducedMotion) {
      planetMesh.rotation.y = PLANET_BASE_YAW + elapsed * 0.014;
      satAngle = (satAngle + dt * 0.24) % (Math.PI * 2);
      const attr = satGeo.getAttribute("position");
      attr.setXYZ(0, Math.cos(satAngle) * ringR, 0, Math.sin(satAngle) * ringR);
      attr.needsUpdate = true;
      ringMat.uniforms.uSatAngle.value = satAngle;
    }

    const sp = state.scroll, fov = baseFov + warpState.fovPunch * 22;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const parX = state.reducedMotion ? 0 : state.mouseX * 0.26, parY = state.reducedMotion ? 0 : state.mouseY * 0.18;
    // Pan parallel (lookAt follows the camera) so the receding planet slides
    // up and out to the right instead of converging on screen center.
    const dx = isMobile ? -sp * 1.2 : -sp * 6.2, dy = isMobile ? -sp * 4.2 : -sp * 5.2;
    camera.position.set(dx + parX, dy + parY, 7.2 + sp * (isMobile ? 9 : 11));
    camera.lookAt(dx, dy, 0);

    for (let i = 0; i < starLayers.length; i++) {
      const l = starLayers[i];
      l.mat.uniforms.uTime.value = elapsed; l.mat.uniforms.uWarp.value = warpState.intensity;
      if (!state.reducedMotion) { l.points.rotation.y = elapsed * (0.002 + i * 0.0012); l.points.rotation.x = elapsed * 0.0008; }
    }
    planetMat.uniforms.uTime.value = elapsed; satMat.uniforms.uTime.value = elapsed;

    if (warpState.intensity > 0.002 && !state.reducedMotion) {
      warpLines.visible = true;
      warpTravel += dt * (26 + warpState.intensity * 62);
      warpMat.uniforms.uWarp.value = warpState.intensity; warpMat.uniforms.uWarpTravel.value = warpTravel;
    } else { warpLines.visible = false; }
    renderer.render(scene, camera);
  }

  function destroy() {
    renderer.domElement.removeEventListener("webglcontextlost", handleLost);
    [nebulaTex, nebulaMat, nebulaMesh.geometry, warpGeo, warpMat, planetMesh.geometry, planetMat, atmoMesh.geometry, atmoMat, ringGeo, ringMat, satGeo, satMat]
      .forEach((o) => o.dispose());
    for (const l of starLayers) { l.points.geometry.dispose(); l.mat.dispose(); }
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { resize, applyTheme, render, destroy };
}

/* ── 2D Canvas Fallback Engine ───────────────────────────────────────────── */

function createFallbackEngine(stageEl, state) {
  const canvas = document.createElement("canvas");
  canvas.className = "space-stage__canvas";
  stageEl.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const lowSpec = window.innerWidth < 768 || (navigator.hardwareConcurrency || 4) <= 4;
  const tints = ["#b6d2ff", "#e8f0ff", "#fff6e5", "#f6c184", "#8ab4ff"];
  const stars = Array.from({ length: lowSpec ? 150 : 250 }, (_, i) => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.pow(Math.random(), 2) * 1.6,
    depth: 0.35 + Math.random() * 0.65, phase: Math.random() * Math.PI * 2,
    speed: 0.7 + Math.random() * 1.4, color: tints[i % tints.length],
  }));

  let W = 1, H = 1, dpr = 1, isLight = state.theme === "light", palette = state.palette;

  function resize(w, h) {
    W = Math.max(1, w); H = Math.max(1, h); dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  function applyTheme(theme, nextPalette) { isLight = theme === "light"; palette = nextPalette; }

  function render(_dt, elapsed, warpState) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const [ar, ag, ab] = palette.accent.map((v) => Math.round(v * 255));
    const [br, bg, bb] = palette.accent2.map((v) => Math.round(v * 255));
    const sp = state.scroll, isMobile = W < 820, cx = W * 0.5, cy = H * 0.5, baseA = isLight ? 0.16 : 0.85;

    for (const s of stars) {
      const px = ((s.x + (state.reducedMotion ? 0 : elapsed * 0.002 * s.depth) - state.mouseX * 0.012 * s.depth) % 1 + 1) % 1;
      const py = ((s.y - sp * 0.14 * s.depth - state.mouseY * 0.01 * s.depth) % 1 + 1) % 1;
      const sx = px * W, sy = py * H;
      const a = (state.reducedMotion ? 0.85 : 0.65 + 0.35 * Math.sin(elapsed * s.speed + s.phase)) * baseA * s.depth;
      if (warpState.intensity > 0.02 && !state.reducedMotion) {
        const dx = sx - cx, dy = sy - cy, len = Math.hypot(dx, dy) || 1;
        const streak = warpState.intensity * (24 + len * 0.22) * s.depth;
        ctx.strokeStyle = isLight ? `rgba(80,115,170,${a})` : s.color;
        ctx.globalAlpha = Math.min(1, a * 1.1); ctx.lineWidth = Math.max(0.8, s.r * 0.9);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (dx / len) * streak, sy + (dy / len) * streak); ctx.stroke();
      } else {
        ctx.fillStyle = isLight ? `rgba(72,102,148,${a})` : s.color; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    const pR = Math.min(W, H) * (isMobile ? 0.17 : 0.21) * lerp(1, 0.52, sp);
    const px = isMobile ? lerp(W * 0.5, W * 0.72, sp) : lerp(W * 0.76, W * 0.86, sp);
    const py = isMobile ? lerp(H * 0.74, H * 0.26, sp) : lerp(H * 0.48, H * 0.22, sp);

    const halo = ctx.createRadialGradient(px, py, pR * 0.85, px, py, pR * 1.65);
    halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isLight ? 0.22 : 0.34})`);
    halo.addColorStop(0.5, isLight ? `rgba(${ar},${ag},${ab},0.08)` : `rgba(${br},${bg},${bb},0.08)`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, pR * 1.65, 0, Math.PI * 2); ctx.fill();

    const body = ctx.createRadialGradient(px - pR * 0.34, py - pR * 0.3, pR * 0.1, px, py, pR);
    if (isLight) {
      body.addColorStop(0, "rgba(232,241,252,0.95)"); body.addColorStop(0.65, "rgba(186,208,236,0.78)"); body.addColorStop(1, "rgba(146,174,212,0.45)");
    } else {
      body.addColorStop(0, `rgba(${Math.min(255, ar + 30)},${Math.min(255, ag + 30)},${Math.min(255, ab + 30)},0.48)`);
      body.addColorStop(0.52, "rgba(18,32,58,0.88)"); body.addColorStop(1, "rgba(7,12,24,0.96)");
    }
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(px, py, pR, 0, Math.PI * 2); ctx.fill();

    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3);
    ctx.strokeStyle = isLight ? "rgba(65,100,155,0.22)" : `rgba(${ar},${ag},${ab},0.24)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, pR * 1.38, pR * 0.42, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  return { resize, applyTheme, render, destroy: () => { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } };
}

/* ── Main Controller & Boot ──────────────────────────────────────────────── */

async function bootSpaceScene() {
  const stageEl = document.getElementById("spaceStage");
  if (!stageEl) return;

  const flashEl = document.createElement("div");
  flashEl.className = "space-stage__flash";
  stageEl.appendChild(flashEl);

  const reducedMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const coarseMq = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
  const initTheme = document.documentElement.dataset.theme || "dark";

  const state = {
    theme: initTheme, palette: readThemePalette(initTheme),
    reducedMotion: Boolean(reducedMq && reducedMq.matches), isTouch: Boolean(coarseMq && coarseMq.matches),
    scroll: getScrollProgress(), mouseX: 0, mouseY: 0, targetMouseX: 0, targetMouseY: 0,
    paused: false, warpActive: false, warpElapsed: 0,
  };

  let engine = null, usingWebGL = false, rafId = 0, lastTs = 0, lastRenderTs = 0, elapsed = 0, readySent = false;

  const syncThemeClasses = (t) => { stageEl.classList.toggle("is-light", t === "light"); stageEl.classList.toggle("is-arcane", t === "arcane"); };
  const shouldAnimate = () => !state.paused && !document.hidden && state.theme !== "arcane" && !state.reducedMotion && engine !== null;
  const stopLoop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } };

  function markReady() {
    if (readySent) return;
    readySent = true;
    stageEl.classList.add("is-ready");
    document.dispatchEvent(new CustomEvent("space:ready", { detail: { webgl: usingWebGL } }));
  }

  function renderSingleFrame(dt) {
    if (!engine || state.theme === "arcane") return;
    let warpState = { intensity: 0, flash: 0, fovPunch: 0 };
    if (state.warpActive) {
      state.warpElapsed += dt;
      if (state.warpElapsed >= WARP_DURATION) { state.warpActive = false; state.warpElapsed = 0; flashEl.style.opacity = "0"; }
      else { warpState = evaluateWarp(state.warpElapsed); flashEl.style.opacity = warpState.flash.toFixed(3); }
    }
    engine.render(dt, elapsed, warpState);
    markReady();
  }

  function tick(ts) {
    rafId = 0;
    if (!shouldAnimate()) return;
    rafId = requestAnimationFrame(tick);
    if (!state.warpActive && (window.scrollY || 0) > window.innerHeight * 2 && ts - lastRenderTs < 32) return;
    lastRenderTs = ts;
    const dt = Math.min(lastTs ? (ts - lastTs) / 1000 : 1 / 60, 0.08);
    lastTs = ts;
    elapsed += dt;
    const s = 1 - Math.exp(-dt * 6);
    state.scroll = lerp(state.scroll, getScrollProgress(), s);
    state.mouseX = lerp(state.mouseX, state.targetMouseX, s * 0.75);
    state.mouseY = lerp(state.mouseY, state.targetMouseY, s * 0.75);
    renderSingleFrame(dt);
  }

  function startLoop() {
    if (!shouldAnimate()) {
      stopLoop();
      if (state.reducedMotion && state.theme !== "arcane" && !state.paused && engine) { state.scroll = getScrollProgress(); renderSingleFrame(0); }
      return;
    }
    if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(tick); }
  }

  function activateFallback() {
    if (engine) { try { engine.destroy(); } catch (_) { /* ignore */ } }
    usingWebGL = false;
    engine = createFallbackEngine(stageEl, state);
    engine.resize(stageEl.clientWidth || window.innerWidth, stageEl.clientHeight || window.innerHeight);
    engine.applyTheme(state.theme, state.palette);
    renderSingleFrame(0);
    startLoop();
  }

  try {
    const THREE = await import("../vendor/three.module.min.js");
    engine = createWebGLEngine(THREE, stageEl, state, activateFallback);
    usingWebGL = true;
    console.info("[space-scene] initialized (WebGL2)");
  } catch (_) {
    engine = createFallbackEngine(stageEl, state);
    usingWebGL = false;
    console.info("[space-scene] initialized (2D fallback)");
  }

  function setTheme(next) {
    const t = next || document.documentElement.dataset.theme || "dark";
    state.theme = t; state.palette = readThemePalette(t); syncThemeClasses(t);
    if (t === "arcane") { stopLoop(); state.warpActive = false; state.warpElapsed = 0; flashEl.style.opacity = "0"; return; }
    if (engine) engine.applyTheme(t, state.palette);
    if (state.reducedMotion) renderSingleFrame(0); else startLoop();
  }

  function warp() {
    if (state.theme === "arcane") return;
    if (state.reducedMotion) {
      flashEl.classList.remove("is-reduced-flash"); void flashEl.offsetWidth; flashEl.classList.add("is-reduced-flash");
      return;
    }
    state.warpActive = true; state.warpElapsed = 0;
    if (!state.paused) startLoop();
  }

  const pause = () => { state.paused = true; stopLoop(); };
  const resume = () => { state.paused = false; startLoop(); };

  const api = { warp, setTheme, pause, resume };
  Object.defineProperty(api, "isWebGL", { enumerable: true, get: () => usingWebGL });
  window.SpaceScene = api;

  syncThemeClasses(state.theme);
  engine.resize(stageEl.clientWidth || window.innerWidth, stageEl.clientHeight || window.innerHeight);
  engine.applyTheme(state.theme, state.palette);
  if (state.theme === "arcane") markReady(); else { renderSingleFrame(0); startLoop(); }

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!engine) return;
      engine.resize(stageEl.clientWidth || window.innerWidth, stageEl.clientHeight || window.innerHeight);
      if (state.reducedMotion && state.theme !== "arcane") renderSingleFrame(0);
    }, 120);
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(onResize).observe(stageEl);
  else window.addEventListener("resize", onResize, { passive: true });

  window.addEventListener("pointermove", (e) => {
    if (state.isTouch || state.reducedMotion || e.pointerType === "touch") return;
    state.targetMouseX = clamp((e.clientX / (window.innerWidth || 1)) * 2 - 1, -1, 1);
    state.targetMouseY = clamp(-((e.clientY / (window.innerHeight || 1)) * 2 - 1), -1, 1);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => (document.hidden ? stopLoop() : startLoop()));
  document.addEventListener("themechange", (e) => setTheme(e && e.detail && e.detail.theme ? e.detail.theme : document.documentElement.dataset.theme));
  document.addEventListener("space:warp", warp);

  if (reducedMq && reducedMq.addEventListener) {
    reducedMq.addEventListener("change", (e) => {
      state.reducedMotion = e.matches;
      if (state.reducedMotion) { stopLoop(); state.warpActive = false; flashEl.style.opacity = "0"; if (state.theme !== "arcane") renderSingleFrame(0); }
      else startLoop();
    });
  }
}

const safeBoot = () => { bootSpaceScene().catch(() => {}); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeBoot, { once: true });
else safeBoot();
