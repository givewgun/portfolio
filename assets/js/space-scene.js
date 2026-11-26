/* ============================================================================
   space-scene.js — Deep-space WebGL2 cosmos + 2D canvas fallback (ES module)
   Owned by Gemini for Gun Kaewngarm's portfolio revamp.
   Contract:
     - Mounts inside #spaceStage (first child of <body>)
     - Listens on document: "themechange" ({ detail: { theme } }), "space:warp", "space:train"
     - Dispatches on document: "space:ready" ({ detail: { webgl } })
     - Exposes window.SpaceScene (and lowercase alias window.spaceScene) =
       { warp, satelliteTrain, setTheme, isWebGL, pause, resume }
   ============================================================================ */

const DEG2RAD = Math.PI / 180;
const BANGKOK_LON = 100.5018 * DEG2RAD;
// Equirectangular SphereGeometry: lon 0 is +X, lon -90 is +Z, lon +90 is -Z.
// Put Bangkok / Southeast Asia prominently on the visible front-right face.
const PLANET_BASE_YAW = -Math.PI * 0.5 - BANGKOK_LON + 14 * DEG2RAD;
const WARP_DURATION = 2.2;
const TRAIN_COUNT = 32;
const TRAIN_DURATION = 14.5;
const TRAIN_FIRST_MIN = 6;
const TRAIN_FIRST_MAX = 10;
const TRAIN_INTERVAL_MIN = 45;
const TRAIN_INTERVAL_MAX = 90;
const TRAIN_REDUCED_MS = 2800;
const AUTO_SPIN_RATE = 0.014;
const CLOUD_DRIFT_RATE = 0.0042;
const DRAG_SENS = 0.36 * DEG2RAD; // ~0.36° per CSS pixel
const MAX_TILT = 35 * DEG2RAD;
const MAX_YAW_VEL = 7.5;
const DRAG_EXCLUDE =
  "a,button,input,textarea,select,label,[role=dialog],[contenteditable],p,h1,h2,h3,h4,li,code,kbd,img,canvas,.spot,.nav,.footer,.cmdk-backdrop";
const HINT_STORAGE_KEY = "planetHintSeen";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

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

/** Unit vector matching THREE.SphereGeometry default equirectangular UVs (lon -180 at u=0, +180 at u=1). */
function latLonToVec3(lat, lon) {
  const cl = Math.cos(lat);
  return [cl * Math.cos(lon), Math.sin(lat), -cl * Math.sin(lon)];
}

/** Subsolar point (solar declination + UTC longitude) as a unit vector in the
 *  Earth's own frame — the same frame as the texture/geometry. The render loop
 *  rotates it by the globe's current world orientation every frame, so day and
 *  night stay on the right continents however the globe is spun or dragged. */
function subsolarGeo(now) {
  const doy = (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000 + 1;
  const decl = -23.44 * DEG2RAD * Math.cos(((2 * Math.PI) / 365.24) * (doy + 10));
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  return latLonToVec3(decl, (12 - utcH) * 15 * DEG2RAD);
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
  const lift = clamp(y / (Math.max(1, window.innerHeight) * 1.4), 0, 1);
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

function isExcludedTarget(target) {
  const el = target && target.nodeType === 1 ? target : target && target.parentElement;
  return Boolean(el && el.closest && el.closest(DRAG_EXCLUDE));
}

/* ── GLSL Shaders (Three.js r170 ShaderMaterial — WebGL2 safe) ───────────── */

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

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosLocal;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPos;
  varying vec3 vEastWorld;
  varying vec3 vNorthWorld;
  void main() {
    vUv = uv;
    vec3 p = normalize(position);
    vPosLocal = p;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    mat3 m3 = mat3(modelMatrix);
    vNormalWorld = normalize(m3 * normal);
    vec3 e = cross(vec3(0.0, 1.0, 0.0), p);
    float el = length(e);
    e = el > 0.0001 ? e / el : vec3(1.0, 0.0, 0.0);
    vec3 n = cross(p, e);
    vEastWorld = normalize(m3 * e);
    vNorthWorld = normalize(m3 * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Real Earth surface shader: linear-space shading with hardware sRGB-decoded day/night maps,
// linear masks (R = cloud alpha, G = ocean mask), encoded back via colorspace_fragment.
const PLANET_FRAG = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uMasksMap;
  uniform vec3 uSunDir;
  uniform vec3 uAccent;
  uniform float uLightMode;
  uniform float uCloudOffset;
  uniform float uNightReady;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vPosLocal;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPos;
  varying vec3 vEastWorld;
  varying vec3 vNorthWorld;

  void main() {
    vec3 p = normalize(vPosLocal);
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(mix(uSunDir, normalize(vec3(-0.35, 0.45, 0.82)), uLightMode * 0.72));
    float eLen = length(vEastWorld);
    vec3 E = eLen > 0.001 ? vEastWorld / eLen : vec3(1.0, 0.0, 0.0);
    float bLen = length(vNorthWorld);
    vec3 B = bLen > 0.001 ? vNorthWorld / bLen : vec3(0.0, 1.0, 0.0);

    vec3 dayCol = texture2D(uDayMap, vUv).rgb;
    vec3 nightCol = texture2D(uNightMap, vUv).rgb;
    float ocean = texture2D(uMasksMap, vUv).g;

    // Cloud cover overhead & subtle sun-offset cloud shadow on surface (<= 24% darkening)
    float ndl = dot(N, L);
    vec2 cloudUv = vec2(vUv.x - uCloudOffset, vUv.y);
    float cloudOver = texture2D(uMasksMap, cloudUv).r;
    float cosLat = max(sqrt(max(1.0 - p.y * p.y, 0.0)), 0.35);
    float shDist = min(0.0022 / max(ndl, 0.28), 0.0085);
    vec2 shadowUv = vec2(
      cloudUv.x + (dot(L, E) * shDist) / (3.14159265 * cosLat),
      clamp(cloudUv.y + (dot(L, B) * shDist) / 1.57079633, 0.001, 0.999)
    );
    float cloudShadow = texture2D(uMasksMap, shadowUv).r * smoothstep(-0.04, 0.20, ndl);
    float shadowFactor = 1.0 - cloudShadow * 0.24;

    // Smooth Lambert with ~0.1 wrap + soft terminator band
    float wrapDiff = clamp((ndl + 0.1) / 1.1, 0.0, 1.0);
    float dayFactor = smoothstep(-0.12, 0.22, ndl);
    float diffuse = mix(wrapDiff * smoothstep(-0.14, 0.18, ndl), 0.56 + 0.44 * wrapDiff, uLightMode);
    vec3 lit = dayCol * (mix(0.008, 0.12, uLightMode) + diffuse * mix(1.18, 1.0, uLightMode)) * shadowFactor;

    // Warm orange twilight tint in the terminator strip
    float tw = (ndl - 0.01) * 5.2;
    float twilight = exp(-(tw * tw)) * (1.0 - uLightMode * 0.85);
    lit += (dayCol * vec3(1.0, 0.40, 0.12) * 0.55 + vec3(0.055, 0.016, 0.004)) * twilight * shadowFactor;

    // Modest Blinn-Phong sun-colored ocean specular glint
    vec3 hv = L + V;
    float hLen = length(hv);
    vec3 H = hLen > 0.001 ? hv / hLen : N;
    float nh = max(dot(N, H), 0.0001);
    float spec = (pow(nh, 44.0) * 0.28 + pow(nh, 12.0) * 0.045) * ocean * shadowFactor * smoothstep(-0.02, 0.22, ndl);
    lit += vec3(1.0, 0.94, 0.84) * spec * mix(1.0, 0.42, uLightMode);

    // Black Marble night-side city lights (warm, subtly softened under dense clouds)
    float nightMask = (1.0 - smoothstep(-0.14, 0.16, ndl)) * (1.0 - uLightMode * 0.94) * uNightReady;
    lit += nightCol * vec3(1.08, 0.92, 0.72) * nightMask * 1.65 * (1.0 - cloudOver * 0.45);

    // Subtle Rayleigh inner-limb atmospheric veil
    float ndv = max(dot(N, V), 0.0);
    float fres = pow(max(1.0 - ndv, 0.0001), 3.4);
    vec3 rayleigh = mix(vec3(0.14, 0.40, 0.95), uAccent, 0.22);
    vec3 rimCol = mix(rayleigh, vec3(0.88, 0.34, 0.12), twilight * 0.42);
    lit += rimCol * fres * mix(0.045 + 0.44 * dayFactor, 0.22, uLightMode);

    // Light-theme sky haze lift so the whole disc stays pleasant on the pale backdrop
    lit = mix(lit, mix(lit, vec3(0.72, 0.80, 0.92), 0.06), uLightMode);

    // Smooth highlight shoulder above 0.85 (preserves midtone albedo, prevents harsh clipping)
    lit = lit / (1.0 + max(lit - vec3(0.85), vec3(0.0)));

    gl_FragColor = vec4(lit, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SHELL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CLOUDS_FRAG = /* glsl */ `
  uniform sampler2D uMasksMap;
  uniform vec3 uSunDir;
  uniform float uLightMode;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPos;

  void main() {
    float c = texture2D(uMasksMap, vUv).r;
    if (c < 0.015) discard;
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(mix(uSunDir, normalize(vec3(-0.35, 0.45, 0.82)), uLightMode * 0.72));

    float ndl = dot(N, L);
    float wrap = clamp((ndl + 0.16) / 1.16, 0.0, 1.0);
    float day = smoothstep(-0.16, 0.24, ndl);
    float tw = ndl * 4.8;
    float twilight = exp(-(tw * tw)) * (1.0 - uLightMode * 0.85);

    vec3 dayCloud = vec3(0.92, 0.95, 1.0);
    vec3 termCloud = vec3(0.32, 0.40, 0.56);
    vec3 nightCloud = vec3(0.016, 0.024, 0.042);

    vec3 col = mix(nightCloud, dayCloud * (0.14 + 0.94 * wrap), day);
    col = mix(col, termCloud, twilight * 0.45);
    col += vec3(0.38, 0.16, 0.06) * twilight * 0.18;
    col = mix(col, mix(vec3(0.76, 0.83, 0.93), vec3(0.96, 0.98, 1.0), 0.35 + 0.65 * wrap), uLightMode);

    float fres = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 3.2);
    col = mix(col, vec3(0.26, 0.52, 0.96), fres * 0.25 * (1.0 - uLightMode * 0.6));

    float alpha = c * mix(0.42 + 0.50 * day, 0.62, uLightMode) * uOpacity;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uAccent;
  uniform vec3 uAccent2;
  uniform float uLightMode;
  uniform float uOpacity;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(mix(uSunDir, normalize(vec3(-0.35, 0.45, 0.82)), uLightMode * 0.72));
    float rim = pow(clamp(max(-dot(N, V), 0.0) / 0.36, 0.0001, 1.0), 2.8);
    float st = dot(N, L);
    float sunSide = smoothstep(-0.45, 0.62, st);
    float tw = (st - 0.02) * 4.5;
    float twilight = exp(-(tw * tw)) * (1.0 - uLightMode);
    vec3 rayleigh = mix(vec3(0.12, 0.38, 0.96), uAccent, 0.25);
    vec3 col = mix(
      mix(rayleigh * 0.22, rayleigh * 1.05, sunSide) + uAccent2 * twilight * 0.36,
      mix(vec3(0.32, 0.54, 0.88), uAccent, 0.25),
      uLightMode
    );
    gl_FragColor = vec4(col, rim * mix(0.14 + 0.66 * sunSide, 0.28, uLightMode) * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RING_VERT = /* glsl */ `
  varying vec3 vRingPos;
  void main() { vRingPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const RING_FRAG = /* glsl */ `
  uniform float uSatAngle, uLightMode, uOpacity;
  uniform vec3 uColor, uAccent;
  varying vec3 vRingPos;
  void main() {
    float wake = exp(-mod(uSatAngle - atan(vRingPos.z, vRingPos.x) + 6.2831853, 6.2831853) * 2.5);
    gl_FragColor = vec4(mix(uColor, uAccent, wake * 0.82), (mix(0.13, 0.22, uLightMode) + wake * mix(0.55, 0.30, uLightMode)) * uOpacity);
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
  uniform float uLightMode, uOpacity;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = (exp(-d * d * 28.0) + (1.0 - smoothstep(0.0, 0.5, d)) * 0.42) * vPulse * uOpacity;
    gl_FragColor = vec4(mix(uColor, vec3(0.24, 0.44, 0.78), uLightMode * 0.72), a);
  }
`;

const TRAIN_VERT = /* glsl */ `
  attribute float aIdx;
  attribute vec3 aJitter;
  attribute vec2 aGlint;
  uniform float uHead, uSpacing, uArcLift, uTime, uPixelRatio, uOpacity;
  uniform vec3 uStart, uEnd, uPerp;
  varying float vAlpha;
  varying float vGlint;
  void main() {
    float u = uHead - aIdx * uSpacing + aJitter.x;
    float visible = step(-0.02, u) * step(u, 1.02);
    float uc = clamp(u, 0.0, 1.0);
    vec3 p = mix(uStart, uEnd, uc);
    p.y += 4.0 * uc * (1.0 - uc) * uArcLift;
    p += uPerp * aJitter.y;
    float edgeFade = smoothstep(0.0, 0.14, u) * (1.0 - smoothstep(0.86, 1.0, u));
    float softWave = 0.5 + 0.5 * sin(uTime * aGlint.y + aGlint.x);
    float glint = pow(max(0.0, sin(uTime * (aGlint.y * 0.65 + 1.15) + aGlint.x * 1.9 + uc * 10.0)), 14.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((3.4 + 1.5 * aJitter.z + 2.6 * glint) * uPixelRatio * (21.0 / max(-mv.z, 1.0)), 1.6, 11.0) * visible;
    vAlpha = edgeFade * visible * (0.72 + 0.28 * softWave + 0.65 * glint) * uOpacity;
    vGlint = glint;
    gl_Position = projectionMatrix * mv;
  }
`;

const TRAIN_FRAG = /* glsl */ `
  uniform float uLightMode;
  varying float vAlpha;
  varying float vGlint;
  void main() {
    if (vAlpha <= 0.004) discard;
    vec2 q = gl_PointCoord - vec2(0.5);
    float d = length(q);
    if (d > 0.5) discard;
    float core = exp(-d * d * 42.0);
    float halo = (1.0 - smoothstep(0.0, 0.5, d)) * 0.34;
    float a = clamp((core + halo) * vAlpha, 0.0, 1.0);
    vec3 darkCol = mix(vec3(0.85, 0.93, 1.0), vec3(1.0, 0.98, 0.92), vGlint);
    vec3 lightCol = vec3(0.20, 0.40, 0.72);
    gl_FragColor = vec4(mix(darkCol, lightCol, uLightMode * 0.78), a);
  }
`;

/* ── WebGL2 Engine (Three.js r170, 9 draw calls idle / 10 during warp) ───── */

function createWebGLEngine(THREE, stageEl, state, onContextLost, onNeedsRender) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ antialias: dpr <= 1.5, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(dpr, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
  nebulaMesh.renderOrder = 0;
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
    points.renderOrder = 0;
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

  // 3b. Starlink-style Satellite Train (hidden when idle; 1 draw call during pass, zero per-frame allocations)
  const tPos = new Float32Array(TRAIN_COUNT * 3);
  const tIdx = new Float32Array(TRAIN_COUNT);
  const tJitter = new Float32Array(TRAIN_COUNT * 3);
  const tGlint = new Float32Array(TRAIN_COUNT * 2);
  for (let i = 0; i < TRAIN_COUNT; i++) {
    tIdx[i] = i;
    tJitter[i * 3] = (Math.random() - 0.5) * 0.0022;      // slight longitudinal jitter
    tJitter[i * 3 + 1] = (Math.random() - 0.5) * 0.042;   // subtle transverse offset
    tJitter[i * 3 + 2] = Math.random();                   // tiny size variation
    tGlint[i * 2] = Math.random() * Math.PI * 2;          // glint phase
    tGlint[i * 2 + 1] = 1.6 + Math.random() * 2.4;        // glint cadence
  }
  const trainGeo = new THREE.BufferGeometry();
  trainGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
  trainGeo.setAttribute("aIdx", new THREE.BufferAttribute(tIdx, 1));
  trainGeo.setAttribute("aJitter", new THREE.BufferAttribute(tJitter, 3));
  trainGeo.setAttribute("aGlint", new THREE.BufferAttribute(tGlint, 2));
  const trainMat = new THREE.ShaderMaterial({
    vertexShader: TRAIN_VERT,
    fragmentShader: TRAIN_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uHead: { value: 0 },
      uSpacing: { value: 0.0098 },
      uArcLift: { value: 0.45 },
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uOpacity: { value: 0.96 },
      uLightMode: { value: 0 },
      uStart: { value: new THREE.Vector3(-12, 4.5, -14) },
      uEnd: { value: new THREE.Vector3(12, 6.0, -14) },
      uPerp: { value: new THREE.Vector3(0, 1, 0) },
    },
  });
  const trainPoints = new THREE.Points(trainGeo, trainMat);
  trainPoints.visible = false;
  trainPoints.frustumCulled = false;
  trainPoints.renderOrder = 0;
  scene.add(trainPoints);

  let trainBaseOp = 0.96;
  let lastTrainPassId = -1;
  let trainDir = 1;
  let trainY0 = 0.54;
  let trainY1 = 0.74;
  let trainArc = 0.055;

  // 4. Real NASA Earth (surface + drifting clouds + Rayleigh atmosphere + orbital ring & satellite)
  const planetRoot = new THREE.Group();
  const planetPitch = new THREE.Group(); // user vertical tilt (eases back to 0)
  const planetTilt = new THREE.Group();  // default axial obliquity
  const planetSpin = new THREE.Group();  // shared spin for surface + clouds
  const planetBase = new THREE.Vector3(); // resting spot; scroll offsets are added per frame
  const tiltZ = -11 * DEG2RAD;
  planetTilt.rotation.z = tiltZ;
  planetSpin.rotation.y = PLANET_BASE_YAW;
  planetTilt.add(planetSpin);
  planetPitch.add(planetTilt);
  planetRoot.add(planetPitch);
  planetRoot.visible = false; // stays hidden until 2k day + masks textures load
  scene.add(planetRoot);

  const planetR = 1.52;
  const accLin = new THREE.Vector3(...state.palette.accent.map(srgbToLinear));
  const acc2Lin = new THREE.Vector3(...state.palette.accent2.map(srgbToLinear));
  const accSrgb = new THREE.Vector3(...state.palette.accent);
  const sun = new THREE.Vector3(...computeSunDirection(new Date(), PLANET_BASE_YAW, tiltZ));
  const sunGeo = new THREE.Vector3(...subsolarGeo(new Date())); // Earth frame
  const sunWorld = new THREE.Vector3();
  const spinQuat = new THREE.Quaternion();

  // 1x1 placeholder textures so uniforms are always valid prior to 2k load
  const makePlaceholder = (r, g, b, a, isSRGB) => {
    const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
    t.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const dummyDay = makePlaceholder(10, 22, 48, 255, true);
  const dummyNight = makePlaceholder(0, 0, 0, 255, true);
  const dummyMasks = makePlaceholder(0, 0, 0, 255, false);
  const activeTex = { day: dummyDay, night: dummyNight, masks: dummyMasks };

  const segW = lowSpec ? 64 : 128;
  const segH = lowSpec ? 48 : 96;

  const planetMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: PLANET_FRAG,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uDayMap: { value: dummyDay },
      uNightMap: { value: dummyNight },
      uMasksMap: { value: dummyMasks },
      uSunDir: { value: sun.clone() },
      uAccent: { value: accLin.clone() },
      uLightMode: { value: 0 },
      uCloudOffset: { value: 0 },
      uNightReady: { value: 0 },
      uOpacity: { value: 0 },
    },
  });
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(planetR, segW, segH), planetMat);
  planetMesh.renderOrder = 1;
  planetSpin.add(planetMesh);

  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT,
    fragmentShader: CLOUDS_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMasksMap: { value: dummyMasks },
      uSunDir: { value: sun.clone() },
      uLightMode: { value: 0 },
      uOpacity: { value: 0 },
    },
  });
  const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(planetR * 1.008, segW, segH), cloudMat);
  cloudMesh.renderOrder = 2;
  planetSpin.add(cloudMesh);

  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT,
    fragmentShader: ATMO_FRAG,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSunDir: { value: sun.clone() },
      uAccent: { value: accLin.clone() },
      uAccent2: { value: acc2Lin.clone() },
      uLightMode: { value: 0 },
      uOpacity: { value: 0 },
    },
  });
  const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(planetR * 1.068, lowSpec ? 48 : 64, lowSpec ? 36 : 48), atmoMat);
  atmoMesh.renderOrder = 5;
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
    uniforms: {
      uSatAngle: { value: 0.7 },
      uColor: { value: new THREE.Vector3(0.45, 0.60, 0.85) },
      uAccent: { value: accSrgb.clone() },
      uLightMode: { value: 0 },
      uOpacity: { value: 0 },
    },
  });
  const ringLine = new THREE.LineLoop(ringGeo, ringMat);
  ringLine.renderOrder = 3;
  orbitGroup.add(ringLine);

  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([Math.cos(0.7) * ringR, 0, Math.sin(0.7) * ringR]), 3));
  const satMat = new THREE.ShaderMaterial({
    vertexShader: SAT_VERT, fragmentShader: SAT_FRAG, transparent: true, depthWrite: false,
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uTime: { value: 0 },
      uColor: { value: new THREE.Vector3(0.95, 0.97, 1.0) },
      uLightMode: { value: 0 },
      uOpacity: { value: 0 },
    },
  });
  const satPoints = new THREE.Points(satGeo, satMat);
  satPoints.renderOrder = 4;
  orbitGroup.add(satPoints);

  // Progressive Earth texture loader (2k fast boot -> idle 4k upgrade on desktop)
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  const texUrl = (file) => new URL(`../textures/${file}`, import.meta.url).href;

  let destroyed = false;
  let dayLoaded = false, masksLoaded = false, nightLoaded = false;
  let daySettled = false, masksSettled = false;
  let planetFade = 0, fadeStarted = false, nightFade = 0;
  let upgrade4kScheduled = false, idleHandle = 0, idleIsRic = false;

  function configureTexture(tex, isSRGB) {
    tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
    return tex;
  }

  function swapTexture(slot, tex) {
    if (destroyed) { tex.dispose(); return; }
    const prev = activeTex[slot];
    activeTex[slot] = tex;
    if (slot === "day") planetMat.uniforms.uDayMap.value = tex;
    else if (slot === "night") planetMat.uniforms.uNightMap.value = tex;
    else if (slot === "masks") {
      planetMat.uniforms.uMasksMap.value = tex;
      cloudMat.uniforms.uMasksMap.value = tex;
    }
    if (prev && prev !== dummyDay && prev !== dummyNight && prev !== dummyMasks) prev.dispose();
  }

  function setPlanetOpacity(v) {
    planetMat.uniforms.uOpacity.value = v;
    cloudMat.uniforms.uOpacity.value = v;
    atmoMat.uniforms.uOpacity.value = v;
    ringMat.uniforms.uOpacity.value = v;
    satMat.uniforms.uOpacity.value = v;
  }

  function maybeStartFadeIn() {
    if (destroyed || fadeStarted) return;
    if ((dayLoaded && masksLoaded) || (daySettled && masksSettled && (dayLoaded || masksLoaded))) {
      fadeStarted = true;
      planetRoot.visible = true;
      if (state.reducedMotion) {
        planetFade = 1;
        setPlanetOpacity(1);
        if (nightLoaded) { nightFade = 1; planetMat.uniforms.uNightReady.value = 1; }
      }
      if (onNeedsRender) onNeedsRender();
    }
  }

  function schedule4kUpgrade() {
    if (destroyed || upgrade4kScheduled || lowSpec) return;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.saveData) return;
    if (window.innerWidth < 768) return;
    upgrade4kScheduled = true;

    const runUpgrade = () => {
      idleHandle = 0;
      if (destroyed) return;
      const load4k = (file, slot, isSRGB) => {
        loader.load(
          texUrl(file),
          (tex) => {
            configureTexture(tex, isSRGB);
            swapTexture(slot, tex);
            if (state.reducedMotion && onNeedsRender) onNeedsRender();
          },
          undefined,
          () => { /* keep 2k silently on error */ }
        );
      };
      load4k("earth-day.webp", "day", true);
      load4k("earth-masks.webp", "masks", false);
      load4k("earth-night.webp", "night", true);
    };

    if (typeof window.requestIdleCallback === "function") {
      idleIsRic = true;
      idleHandle = window.requestIdleCallback(runUpgrade, { timeout: 3000 });
    } else {
      idleIsRic = false;
      idleHandle = window.setTimeout(runUpgrade, 1500);
    }
  }

  // Kick off fast 2k set immediately
  loader.load(
    texUrl("earth-day-2k.webp"),
    (tex) => {
      configureTexture(tex, true);
      swapTexture("day", tex);
      dayLoaded = true; daySettled = true;
      maybeStartFadeIn();
    },
    undefined,
    () => { daySettled = true; maybeStartFadeIn(); }
  );
  loader.load(
    texUrl("earth-masks-2k.webp"),
    (tex) => {
      configureTexture(tex, false);
      swapTexture("masks", tex);
      masksLoaded = true; masksSettled = true;
      maybeStartFadeIn();
    },
    undefined,
    () => { masksSettled = true; maybeStartFadeIn(); }
  );
  loader.load(
    texUrl("earth-night-2k.webp"),
    (tex) => {
      configureTexture(tex, true);
      swapTexture("night", tex);
      nightLoaded = true;
      if (state.reducedMotion) {
        nightFade = 1;
        planetMat.uniforms.uNightReady.value = 1;
        if (onNeedsRender) onNeedsRender();
      }
    },
    undefined,
    () => { /* optional: continue without night lights */ }
  );

  const handleLost = (e) => { e.preventDefault(); onContextLost(); };
  renderer.domElement.addEventListener("webglcontextlost", handleLost, false);

  // Spin & drag state
  let isMobile = false, sunAccum = 0, warpTravel = 0, satAngle = 0.7;
  let spinYaw = PLANET_BASE_YAW;
  let yawVel = AUTO_SPIN_RATE;
  let dragPitch = 0;
  let cloudDrift = 0;
  let isDragging = false;

  // Scratch vectors for screen-disc projection (zero per-frame allocations)
  const _centerW = new THREE.Vector3();
  const _centerV = new THREE.Vector3();
  const _ndc = new THREE.Vector3();

  function getPlanetScreenDisc() {
    if (!planetRoot.visible || planetFade < 0.05) return null;
    camera.updateMatrixWorld();
    planetRoot.updateWorldMatrix(true, false);
    _centerW.setFromMatrixPosition(planetRoot.matrixWorld);
    _centerV.copy(_centerW).applyMatrix4(camera.matrixWorldInverse);
    const depth = -_centerV.z;
    const worldR = planetR * planetRoot.scale.x;
    if (depth <= worldR * 1.05) return null;
    _ndc.copy(_centerW).project(camera);
    if (_ndc.z < -1 || _ndc.z > 1) return null;
    const W = stageEl.clientWidth || window.innerWidth;
    const H = stageEl.clientHeight || window.innerHeight;
    const x = (_ndc.x * 0.5 + 0.5) * W;
    const y = (-_ndc.y * 0.5 + 0.5) * H;
    const focalPx = (H * 0.5) / Math.tan(camera.fov * 0.5 * DEG2RAD);
    const r = (worldR * 1.03 * focalPx) / Math.max(depth, 0.001);
    if (x + r < 0 || x - r > W || y + r < 0 || y - r > H) return null;
    return { x, y, r };
  }

  function beginDrag() {
    isDragging = true;
    yawVel = 0;
  }

  function applyDrag(dYaw, dPitch, moveDt) {
    spinYaw += dYaw;
    if (dPitch !== 0) dragPitch = clamp(dragPitch + dPitch, -MAX_TILT, MAX_TILT);
    planetSpin.rotation.y = spinYaw;
    planetPitch.rotation.x = dragPitch;
    if (!state.reducedMotion && moveDt > 0) {
      const instVel = clamp(dYaw / moveDt, -MAX_YAW_VEL, MAX_YAW_VEL);
      yawVel = lerp(yawVel, instVel, 0.45);
    }
  }

  function endDrag(stopMotion) {
    isDragging = false;
    if (stopMotion || state.reducedMotion) yawVel = state.reducedMotion ? 0 : AUTO_SPIN_RATE;
  }

  function isInteracting() {
    return isDragging || Math.abs(yawVel - AUTO_SPIN_RATE) > 0.02 || Math.abs(dragPitch) > 0.002;
  }

  function resize(w, h) {
    const W = Math.max(1, w), H = Math.max(1, h), pr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    isMobile = W < 820;
    for (const l of starLayers) l.mat.uniforms.uPixelRatio.value = pr;
    satMat.uniforms.uPixelRatio.value = pr;
    trainMat.uniforms.uPixelRatio.value = pr;
    if (isMobile) { planetBase.set(0, -1.62, 0); planetRoot.scale.setScalar(0.60); }
    else { planetBase.set(clamp(camera.aspect * 1.5, 1.65, 3.0), 0.12, 0); planetRoot.scale.setScalar(clamp(camera.aspect * 0.62, 0.76, 1.0)); }
    planetRoot.position.copy(planetBase);
  }

  function applyTheme(theme, palette) {
    const light = theme === "light", lm = light ? 1 : 0, blend = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    const linA = palette.accent.map(srgbToLinear);
    const linA2 = palette.accent2.map(srgbToLinear);
    planetMat.uniforms.uLightMode.value = lm;
    planetMat.uniforms.uAccent.value.set(linA[0], linA[1], linA[2]);
    cloudMat.uniforms.uLightMode.value = lm;
    atmoMat.uniforms.uLightMode.value = lm;
    atmoMat.uniforms.uAccent.value.set(linA[0], linA[1], linA[2]);
    atmoMat.uniforms.uAccent2.value.set(linA2[0], linA2[1], linA2[2]);
    atmoMat.blending = blend; atmoMat.needsUpdate = true;
    ringMat.uniforms.uLightMode.value = lm; ringMat.uniforms.uAccent.value.set(...palette.accent);
    ringMat.uniforms.uColor.value.set(light ? 0.30 : 0.45, light ? 0.44 : 0.60, light ? 0.66 : 0.85);
    satMat.uniforms.uLightMode.value = lm;
    for (const l of starLayers) { l.mat.uniforms.uLightMode.value = lm; l.mat.uniforms.uOpacity.value = light ? l.baseOp * 0.14 : l.baseOp; }
    nebulaMat.opacity = light ? 0.12 : 0.65; nebulaMat.blending = blend; nebulaMat.needsUpdate = true;
    warpMat.uniforms.uOpacity.value = light ? 0.55 : 0.92; warpMat.blending = blend; warpMat.needsUpdate = true;
    trainBaseOp = light ? 0.62 : 0.96;
    trainMat.uniforms.uLightMode.value = lm;
    trainMat.uniforms.uOpacity.value = trainBaseOp;
    trainMat.blending = blend; trainMat.needsUpdate = true;
  }

  function render(dt, elapsed, warpState, trainState) {
    sunAccum += dt;
    if (sunAccum >= 60) {
      sunAccum = 0;
      sunGeo.set(...subsolarGeo(new Date()));
    }

    // Smooth ~0.8s planet fade-in once 2k day + masks are ready
    if (fadeStarted && planetFade < 1) {
      planetFade = state.reducedMotion ? 1 : Math.min(1, planetFade + dt / 0.8);
      const eased = 1 - Math.pow(1 - planetFade, 3);
      setPlanetOpacity(eased);
      if (planetFade >= 1) schedule4kUpgrade();
    } else if (planetFade >= 1 && !upgrade4kScheduled) {
      schedule4kUpgrade();
    }

    if (nightLoaded && nightFade < 1) {
      nightFade = state.reducedMotion ? 1 : Math.min(1, nightFade + dt / 0.45);
      planetMat.uniforms.uNightReady.value = nightFade;
    }

    if (!state.reducedMotion) {
      if (!isDragging) {
        // dt-correct friction (~0.94/frame at 60fps), blending seamlessly back into slow auto-rotation
        const decay = Math.pow(0.94, dt * 60);
        yawVel = lerp(AUTO_SPIN_RATE, yawVel, decay);
        spinYaw += yawVel * dt;
        // Ease vertical drag tilt back to default axial tilt over ~2s
        if (Math.abs(dragPitch) > 0.0001) {
          dragPitch *= Math.exp(-dt * 2.2);
          if (Math.abs(dragPitch) < 0.0001) dragPitch = 0;
        }
      }
      cloudDrift = (cloudDrift + dt * CLOUD_DRIFT_RATE) % (Math.PI * 2);
      satAngle = (satAngle + dt * 0.24) % (Math.PI * 2);
      const attr = satGeo.getAttribute("position");
      attr.setXYZ(0, Math.cos(satAngle) * ringR, 0, Math.sin(satAngle) * ringR);
      attr.needsUpdate = true;
      ringMat.uniforms.uSatAngle.value = satAngle;
    }

    planetSpin.rotation.y = spinYaw;
    planetPitch.rotation.x = dragPitch;
    cloudMesh.rotation.y = cloudDrift;
    planetMat.uniforms.uCloudOffset.value = cloudDrift / (Math.PI * 2);

    const sp = state.scroll, fov = baseFov + warpState.fovPunch * 22;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const parX = state.reducedMotion ? 0 : state.mouseX * 0.26, parY = state.reducedMotion ? 0 : state.mouseY * 0.18;
    // Gentle camera drift (keeps warp streaks and nebula centered) …
    const dx = isMobile ? -sp * 0.55 : -sp * 1.45, dy = isMobile ? -sp * 1.25 : -sp * 1.15;
    camera.position.set(dx + parX, dy + parY, 7.2 + sp * (isMobile ? 4.8 : 5.8));
    camera.lookAt(dx * 0.22, dy * 0.22, 0);
    // … while the planet itself "leaves orbit": it slides up and out to the
    // right and recedes, so it clears the content once the hero is passed.
    planetRoot.position.set(
      planetBase.x + sp * (isMobile ? 2.2 : 8),
      planetBase.y + sp * (isMobile ? 8 : 7),
      planetBase.z - sp * (isMobile ? 6 : 8)
    );

    for (let i = 0; i < starLayers.length; i++) {
      const l = starLayers[i];
      l.mat.uniforms.uTime.value = elapsed; l.mat.uniforms.uWarp.value = warpState.intensity;
      if (!state.reducedMotion) { l.points.rotation.y = elapsed * (0.002 + i * 0.0012); l.points.rotation.x = elapsed * 0.0008; }
    }
    satMat.uniforms.uTime.value = elapsed;

    if (warpState.intensity > 0.002 && !state.reducedMotion) {
      warpLines.visible = true;
      warpTravel += dt * (26 + warpState.intensity * 62);
      warpMat.uniforms.uWarp.value = warpState.intensity; warpMat.uniforms.uWarpTravel.value = warpTravel;
    } else { warpLines.visible = false; }

    if (trainState && trainState.active) {
      if (trainState.passId !== lastTrainPassId) {
        lastTrainPassId = trainState.passId;
        if (lastTrainPassId <= 1) {
          trainDir = 1; trainY0 = 0.54; trainY1 = 0.74; trainArc = 0.055;
        } else {
          const s1 = Math.sin(lastTrainPassId * 12.9898) * 43758.5453;
          const s2 = Math.sin(lastTrainPassId * 78.233) * 19341.213;
          const r1 = s1 - Math.floor(s1);
          const r2 = s2 - Math.floor(s2);
          trainDir = lastTrainPassId % 2 === 1 ? 1 : -1;
          trainY0 = 0.50 + r1 * 0.12;
          trainY1 = 0.64 + r2 * 0.12;
          if (trainDir < 0) { const tmp = trainY0; trainY0 = trainY1; trainY1 = tmp; }
          trainArc = 0.04 + r1 * 0.03;
        }
      }
      const trainZ = -14;
      const depth = camera.position.z - trainZ;
      const halfH = depth * Math.tan(camera.fov * 0.5 * DEG2RAD);
      const halfW = halfH * camera.aspect;
      const cx = dx * 0.62, cy = dy * 0.62;
      const sx = cx - trainDir * halfW * 1.12;
      const ex = cx + trainDir * halfW * 1.12;
      const sy = cy + trainY0 * halfH;
      const ey = cy + trainY1 * halfH;
      const segDx = ex - sx, segDy = ey - sy;
      const segLen = Math.hypot(segDx, segDy) || 1;
      const spacing = isMobile ? 0.0145 : 0.0098;
      const totalSpan = 1 + (TRAIN_COUNT - 1) * spacing;
      trainPoints.visible = true;
      trainMat.uniforms.uStart.value.set(sx, sy, trainZ);
      trainMat.uniforms.uEnd.value.set(ex, ey, trainZ);
      trainMat.uniforms.uPerp.value.set(-segDy / segLen, segDx / segLen, 0);
      trainMat.uniforms.uSpacing.value = spacing;
      trainMat.uniforms.uArcLift.value = trainArc * halfH;
      trainMat.uniforms.uHead.value = trainState.progress * totalSpan;
      trainMat.uniforms.uTime.value = elapsed;
      trainMat.uniforms.uOpacity.value = trainBaseOp * (1 - warpState.intensity * 0.7);
    } else {
      trainPoints.visible = false;
    }

    // Sun follows the globe's orientation (auto-spin, drag, tilt): the real
    // subsolar point in Earth's frame → world space for this frame.
    planetSpin.updateWorldMatrix(true, false);
    planetSpin.getWorldQuaternion(spinQuat);
    sunWorld.copy(sunGeo).applyQuaternion(spinQuat).normalize();
    planetMat.uniforms.uSunDir.value.copy(sunWorld);
    cloudMat.uniforms.uSunDir.value.copy(sunWorld);
    atmoMat.uniforms.uSunDir.value.copy(sunWorld);
    renderer.render(scene, camera);
  }

  function destroy() {
    destroyed = true;
    if (idleHandle) {
      if (idleIsRic && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      idleHandle = 0;
    }
    renderer.domElement.removeEventListener("webglcontextlost", handleLost);
    const toDispose = new Set([
      nebulaTex, nebulaMat, nebulaMesh.geometry, warpGeo, warpMat, trainGeo, trainMat,
      planetMesh.geometry, planetMat, cloudMesh.geometry, cloudMat,
      atmoMesh.geometry, atmoMat, ringGeo, ringMat, satGeo, satMat,
      dummyDay, dummyNight, dummyMasks, activeTex.day, activeTex.night, activeTex.masks,
    ]);
    toDispose.forEach((o) => { if (o && o.dispose) o.dispose(); });
    for (const l of starLayers) { l.points.geometry.dispose(); l.mat.dispose(); }
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { resize, applyTheme, render, destroy, getPlanetScreenDisc, beginDrag, applyDrag, endDrag, isInteracting };
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
  const trainDots = Array.from({ length: 28 }, (_, i) => ({
    idx: i,
    jx: (Math.random() - 0.5) * 0.0024,
    jy: (Math.random() - 0.5) * 2.2,
    phase: Math.random() * Math.PI * 2,
    speed: 1.8 + Math.random() * 2.2,
  }));

  let W = 1, H = 1, dpr = 1, isLight = state.theme === "light", palette = state.palette;

  function resize(w, h) {
    W = Math.max(1, w); H = Math.max(1, h); dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  function applyTheme(theme, nextPalette) { isLight = theme === "light"; palette = nextPalette; }

  function render(_dt, elapsed, warpState, trainState) {
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

    if (trainState && trainState.active) {
      const dir = trainState.passId % 2 === 0 ? -1 : 1;
      const spacing = isMobile ? 0.015 : 0.0105;
      const head = trainState.progress * (1 + (trainDots.length - 1) * spacing);
      const x0 = dir > 0 ? -W * 0.05 : W * 1.05;
      const x1 = dir > 0 ? W * 1.05 : -W * 0.05;
      const y0 = H * (dir > 0 ? 0.22 : 0.14);
      const y1 = H * (dir > 0 ? 0.14 : 0.22);
      ctx.fillStyle = isLight ? "rgb(56,102,178)" : "#eaf3ff";
      for (let i = 0; i < trainDots.length; i++) {
        const d = trainDots[i];
        const u = head - d.idx * spacing + d.jx;
        if (u < 0 || u > 1) continue;
        const edge = Math.min(1, u / 0.14) * Math.min(1, (1 - u) / 0.14);
        const glint = 0.65 + 0.35 * Math.sin(elapsed * d.speed + d.phase);
        const tx = lerp(x0, x1, u);
        const ty = lerp(y0, y1, u) - 4 * u * (1 - u) * H * 0.025 + d.jy;
        ctx.globalAlpha = edge * glint * (isLight ? 0.55 : 0.92);
        ctx.beginPath();
        ctx.arc(tx, ty, 1.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const pR = Math.min(W, H) * (isMobile ? 0.17 : 0.21) * lerp(1, 0.4, sp);
    const px = isMobile ? lerp(W * 0.5, W * 0.85, sp) : lerp(W * 0.76, W * 0.95, sp);
    const py = isMobile ? lerp(H * 0.74, H * 0.02, sp) : lerp(H * 0.48, H * 0.06, sp);

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
  const fineMq = window.matchMedia ? window.matchMedia("(pointer: fine)") : null;
  const initTheme = document.documentElement.dataset.theme || "dark";

  const state = {
    theme: initTheme, palette: readThemePalette(initTheme),
    reducedMotion: Boolean(reducedMq && reducedMq.matches), isTouch: Boolean(coarseMq && coarseMq.matches),
    scroll: getScrollProgress(), mouseX: 0, mouseY: 0, targetMouseX: 0, targetMouseY: 0,
    paused: false, warpActive: false, warpElapsed: 0,
    trainActive: false, trainElapsed: 0, trainReducedStatic: false, trainPassId: 0,
    nextTrainAt: TRAIN_FIRST_MIN + Math.random() * (TRAIN_FIRST_MAX - TRAIN_FIRST_MIN),
  };

  let engine = null, usingWebGL = false, rafId = 0, lastTs = 0, lastRenderTs = 0, elapsed = 0, readySent = false;
  let onDemandRaf = 0, reducedTrainTimer = 0;
  const _warpState = { intensity: 0, flash: 0, fovPunch: 0 };
  const _trainState = { active: false, progress: 0, passId: 0 };

  const syncThemeClasses = (t) => { stageEl.classList.toggle("is-light", t === "light"); stageEl.classList.toggle("is-arcane", t === "arcane"); };
  const shouldAnimate = () => !state.paused && !document.hidden && state.theme !== "arcane" && !state.reducedMotion && engine !== null;
  const stopLoop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } };

  function clearTrain() {
    if (reducedTrainTimer) { clearTimeout(reducedTrainTimer); reducedTrainTimer = 0; }
    state.trainActive = false;
    state.trainElapsed = 0;
    state.trainReducedStatic = false;
  }

  function markReady() {
    if (readySent) return;
    readySent = true;
    stageEl.classList.add("is-ready");
    document.dispatchEvent(new CustomEvent("space:ready", { detail: { webgl: usingWebGL } }));
  }

  function renderSingleFrame(dt) {
    if (!engine || state.theme === "arcane") return;
    _warpState.intensity = 0; _warpState.flash = 0; _warpState.fovPunch = 0;
    if (state.warpActive) {
      state.warpElapsed += dt;
      if (state.warpElapsed >= WARP_DURATION) { state.warpActive = false; state.warpElapsed = 0; flashEl.style.opacity = "0"; }
      else {
        const w = evaluateWarp(state.warpElapsed);
        _warpState.intensity = w.intensity; _warpState.flash = w.flash; _warpState.fovPunch = w.fovPunch;
        flashEl.style.opacity = w.flash.toFixed(3);
      }
    }
    if (!state.reducedMotion && dt > 0) {
      if (!state.trainActive && elapsed >= state.nextTrainAt) {
        state.trainActive = true;
        state.trainElapsed = 0;
        state.trainReducedStatic = false;
        state.trainPassId++;
      }
      if (state.trainActive && !state.trainReducedStatic) {
        state.trainElapsed += dt;
        if (state.trainElapsed >= TRAIN_DURATION) {
          state.trainActive = false;
          state.trainElapsed = 0;
          state.nextTrainAt = elapsed + TRAIN_INTERVAL_MIN + Math.random() * (TRAIN_INTERVAL_MAX - TRAIN_INTERVAL_MIN);
        }
      }
    }
    _trainState.active = state.trainActive;
    _trainState.progress = state.trainReducedStatic ? 0.54 : clamp(state.trainElapsed / TRAIN_DURATION, 0, 1);
    _trainState.passId = state.trainPassId;
    engine.render(dt, elapsed, _warpState, _trainState);
    markReady();
  }

  function requestOnDemandRender() {
    if (onDemandRaf || !engine || state.theme === "arcane" || state.paused) return;
    onDemandRaf = requestAnimationFrame(() => {
      onDemandRaf = 0;
      if (!engine || state.theme === "arcane" || state.paused) return;
      if (state.reducedMotion) state.scroll = getScrollProgress();
      renderSingleFrame(0);
    });
  }

  function tick(ts) {
    rafId = 0;
    if (!shouldAnimate()) return;
    rafId = requestAnimationFrame(tick);
    const interacting = usingWebGL && engine && engine.isInteracting && engine.isInteracting();
    if (!state.warpActive && !state.trainActive && !interacting && (window.scrollY || 0) > window.innerHeight * 2 && ts - lastRenderTs < 32) return;
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

  /* ── Globe Free-Spin Interaction, Hover Cursor & First-Time Hint ───────── */

  const rootEl = document.documentElement;
  let hintEl = null, hintTimer = 0, hintRemoveTimer = 0, hintShown = false;
  try { hintShown = localStorage.getItem(HINT_STORAGE_KEY) === "1"; } catch (_) { hintShown = false; }

  function markHintSeen() {
    hintShown = true;
    try { localStorage.setItem(HINT_STORAGE_KEY, "1"); } catch (_) { /* ignore */ }
  }

  function hideHint() {
    clearTimeout(hintTimer); hintTimer = 0;
    if (!hintEl) return;
    hintEl.classList.remove("is-visible");
    const el = hintEl;
    hintEl = null;
    clearTimeout(hintRemoveTimer);
    hintRemoveTimer = setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }

  function maybeShowHint(disc) {
    if (hintShown || !disc || state.theme === "arcane" || !usingWebGL) return;
    if (fineMq && !fineMq.matches) return;
    markHintSeen();
    const el = document.createElement("div");
    el.className = "planet-hint";
    el.setAttribute("aria-hidden", "true");
    el.textContent = "⟲ drag to spin";
    const left = clamp(disc.x - disc.r * 0.74, 14, Math.max(14, window.innerWidth - 148));
    const top = clamp(disc.y + disc.r * 0.62, 14, Math.max(14, window.innerHeight - 40));
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    document.body.appendChild(el);
    hintEl = el;
    requestAnimationFrame(() => { if (hintEl === el) el.classList.add("is-visible"); });
    hintTimer = setTimeout(hideHint, 2500);
  }

  const drag = {
    active: false,
    committed: false,
    pointerId: -1,
    isTouch: false,
    captured: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTs: 0,
  };

  let hoverRaf = 0;
  let pendingHover = null;

  function canInteract() {
    return usingWebGL && engine && typeof engine.getPlanetScreenDisc === "function" && state.theme !== "arcane" && !state.paused;
  }

  function hitTestPlanet(clientX, clientY) {
    if (!canInteract()) return null;
    const disc = engine.getPlanetScreenDisc();
    if (!disc) return null;
    return Math.hypot(clientX - disc.x, clientY - disc.y) <= disc.r ? disc : null;
  }

  function clearHover() {
    rootEl.classList.remove("planet-hover");
    pendingHover = null;
    if (hoverRaf) { cancelAnimationFrame(hoverRaf); hoverRaf = 0; }
  }

  function finishDrag(abort) {
    if (!drag.active) return;
    const wasCommitted = drag.committed;
    const pid = drag.pointerId;
    const wasCaptured = drag.captured;
    const stale = performance.now() - drag.lastTs > 85;
    drag.active = false;
    drag.committed = false;
    drag.pointerId = -1;
    drag.captured = false;
    rootEl.classList.remove("planet-dragging");
    if (wasCaptured) {
      try { rootEl.releasePointerCapture(pid); } catch (_) { /* ignore */ }
    }
    if (wasCommitted && usingWebGL && engine && engine.endDrag) {
      engine.endDrag(abort || stale || state.reducedMotion);
    }
  }

  function flushHover() {
    hoverRaf = 0;
    const h = pendingHover;
    pendingHover = null;
    if (!h || drag.active || !canInteract() || isExcludedTarget(h.target)) {
      rootEl.classList.remove("planet-hover");
      return;
    }
    const disc = hitTestPlanet(h.x, h.y);
    rootEl.classList.toggle("planet-hover", Boolean(disc));
    if (disc && h.pointerType === "mouse") maybeShowHint(disc);
  }

  document.addEventListener("pointerdown", (e) => {
    if (drag.active || !canInteract()) return;
    if (e.isPrimary === false) return;
    const isTouch = e.pointerType === "touch";
    if (!isTouch && e.button !== 0) return;
    if (isExcludedTarget(e.target)) return;
    const disc = hitTestPlanet(e.clientX, e.clientY);
    if (!disc) return;

    drag.active = true;
    drag.pointerId = e.pointerId;
    drag.isTouch = isTouch;
    drag.captured = false;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastTs = performance.now();

    // Mouse/pen commits immediately; touch waits briefly to distinguish horizontal spin from vertical pan-y scroll
    if (!isTouch) {
      drag.committed = true;
      rootEl.classList.add("planet-dragging");
      rootEl.classList.remove("planet-hover");
      hideHint();
      markHintSeen();
      try { rootEl.setPointerCapture(e.pointerId); drag.captured = true; } catch (_) { /* ignore */ }
      engine.beginDrag();
    } else {
      drag.committed = false;
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (drag.active && e.pointerId === drag.pointerId) {
      const now = performance.now();
      if (drag.isTouch && !drag.committed) {
        const totalDx = e.clientX - drag.startX;
        const totalDy = e.clientY - drag.startY;
        if (Math.abs(totalDy) > 8 && Math.abs(totalDy) >= Math.abs(totalDx)) {
          // Vertical scroll gesture: bail cleanly without preventing scroll
          finishDrag(true);
          return;
        }
        if (Math.abs(totalDx) > 6 && Math.abs(totalDx) > Math.abs(totalDy) * 1.15) {
          drag.committed = true;
          rootEl.classList.add("planet-dragging");
          hideHint();
          markHintSeen();
          engine.beginDrag();
          drag.lastX = e.clientX;
          drag.lastY = e.clientY;
          drag.lastTs = now;
        }
        return;
      }

      if (!drag.committed) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      if (!drag.isTouch) {
        if (e.cancelable) e.preventDefault();
      } else if (Math.abs(dx) > Math.abs(dy) && e.cancelable) {
        e.preventDefault();
      }

      const moveDt = Math.max((now - drag.lastTs) / 1000, 0.004);
      const dYaw = dx * DRAG_SENS;
      const dPitch = drag.isTouch ? 0 : dy * DRAG_SENS;
      engine.applyDrag(dYaw, dPitch, moveDt);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastTs = now;
      if (state.reducedMotion) requestOnDemandRender();
      return;
    }

    // Parallax + throttled hover cursor check
    if (e.pointerType !== "touch") {
      if (!state.isTouch && !state.reducedMotion) {
        state.targetMouseX = clamp((e.clientX / (window.innerWidth || 1)) * 2 - 1, -1, 1);
        state.targetMouseY = clamp(-((e.clientY / (window.innerHeight || 1)) * 2 - 1), -1, 1);
      }
      if (canInteract()) {
        pendingHover = { x: e.clientX, y: e.clientY, target: e.target, pointerType: e.pointerType };
        if (!hoverRaf) hoverRaf = requestAnimationFrame(flushHover);
      }
    }
  }, { passive: false });

  window.addEventListener("pointerup", (e) => {
    if (drag.active && e.pointerId === drag.pointerId) finishDrag(false);
  });
  window.addEventListener("pointercancel", (e) => {
    if (drag.active && e.pointerId === drag.pointerId) finishDrag(true);
  });
  window.addEventListener("blur", () => { finishDrag(true); clearHover(); });
  rootEl.addEventListener("pointerleave", clearHover);
  window.addEventListener("scroll", () => {
    if (!drag.active) clearHover();
    if (state.reducedMotion && state.theme !== "arcane" && !state.paused && engine) requestOnDemandRender();
  }, { passive: true });

  /* ── Engine Boot & Public API ──────────────────────────────────────────── */

  function activateFallback() {
    finishDrag(true);
    clearHover();
    hideHint();
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
    engine = createWebGLEngine(THREE, stageEl, state, activateFallback, requestOnDemandRender);
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
    if (t === "arcane") {
      finishDrag(true); clearHover(); hideHint(); clearTrain();
      stopLoop(); state.warpActive = false; state.warpElapsed = 0; flashEl.style.opacity = "0";
      return;
    }
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

  function satelliteTrain() {
    if (state.theme === "arcane") return;
    if (state.reducedMotion) {
      if (reducedTrainTimer) clearTimeout(reducedTrainTimer);
      state.trainActive = true;
      state.trainReducedStatic = true;
      state.trainPassId++;
      requestOnDemandRender();
      reducedTrainTimer = setTimeout(() => {
        reducedTrainTimer = 0;
        state.trainActive = false;
        state.trainReducedStatic = false;
        requestOnDemandRender();
      }, TRAIN_REDUCED_MS);
      return;
    }
    if (reducedTrainTimer) { clearTimeout(reducedTrainTimer); reducedTrainTimer = 0; }
    state.trainReducedStatic = false;
    state.trainActive = true;
    state.trainElapsed = 0.4;
    state.trainPassId++;
    state.nextTrainAt = elapsed + TRAIN_DURATION + TRAIN_INTERVAL_MIN + Math.random() * (TRAIN_INTERVAL_MAX - TRAIN_INTERVAL_MIN);
    if (!state.paused) startLoop();
  }

  const pause = () => { state.paused = true; finishDrag(true); clearHover(); stopLoop(); };
  const resume = () => { state.paused = false; startLoop(); };

  const api = { warp, satelliteTrain, setTheme, pause, resume };
  Object.defineProperty(api, "isWebGL", { enumerable: true, get: () => usingWebGL });
  window.SpaceScene = api;
  window.spaceScene = api;

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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { finishDrag(true); clearHover(); stopLoop(); }
    else startLoop();
  });
  document.addEventListener("themechange", (e) => setTheme(e && e.detail && e.detail.theme ? e.detail.theme : document.documentElement.dataset.theme));
  document.addEventListener("space:warp", warp);
  document.addEventListener("space:train", satelliteTrain);

  if (reducedMq && reducedMq.addEventListener) {
    reducedMq.addEventListener("change", (e) => {
      state.reducedMotion = e.matches;
      if (state.reducedMotion) { stopLoop(); clearTrain(); state.warpActive = false; flashEl.style.opacity = "0"; if (state.theme !== "arcane") renderSingleFrame(0); }
      else startLoop();
    });
  }
}

const safeBoot = () => { bootSpaceScene().catch(() => {}); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeBoot, { once: true });
else safeBoot();
