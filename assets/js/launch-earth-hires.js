/*
 * launch-earth-hires.js — Hi-res Earth upgrade for launch.html
 * ---------------------------------------------------------------------------
 * 1. Desktop (!mobile): upgrades the global 2K textures on earthMat to the
 *    4K assets already in assets/textures/ and bumps anisotropy to max.
 * 2. Regional overlay: progressively fetches public-domain NASA GIBS
 *    BlueMarble_ShadedRelief_Bathymetry (EPSG:4326, 500m TMS) tiles covering
 *    the flight corridor (0°–27°N, 90°–135°E: Bangkok → South China Sea →
 *    Philippines), composites them into a capped canvas mosaic, and renders
 *    a feathered spherical patch child mesh matching earthMat's lighting,
 *    continuous global clouds/night/ocean-specular masks, and subtle
 *    low-altitude procedural terrain detail.
 */

const GIBS_BASE =
  "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m";
const TILE_PX = 512;
const LEVEL0_DEG = 288; // NASA GIBS EPSG:4326 level-0 tile span (0.5625 deg/px * 512 px)
const DEG2RAD = Math.PI / 180;
const PATCH_ALT_KM = 0.15;
const FEATHER_DEG = 2.0;

// Flight corridor bounds aligned cleanly to both z=6 (4.5°/tile) and z=5 (9°/tile).
// Launch site Bangkok (13.7563°N, 100.5018°E) flying east up to ~2,700–3,400 km.
const REGION = { lonMin: 90, lonMax: 135, latMin: 0, latMax: 27 };
const TRACK_LAT = 13.7563;
const TRACK_LON0 = 100.5018;
const TRACK_LON1 = 125.5;

const UPGRADE_4K = [
  ["uDay", "earth-day.webp"],
  ["uNight", "earth-night.webp"],
  ["uMask", "earth-masks.webp"],
];

/**
 * Upgrade the Earth globe with 4K global textures (desktop) and a regional
 * NASA GIBS high-resolution mosaic patch along the launch corridor.
 *
 * @param {object} opts
 * @param {object} opts.THREE     Three.js namespace
 * @param {object} opts.renderer  THREE.WebGLRenderer
 * @param {object} opts.earth     Earth THREE.Mesh (radius ~6371 km)
 * @param {object} opts.earthMat  Earth THREE.ShaderMaterial (uDay, uNight, uMask, uSun, uReady)
 * @param {boolean} opts.mobile   True on mobile / coarse-pointer viewports
 * @param {(file: string) => string} opts.texUrl  Asset URL resolver
 * @returns {{ dispose: () => void }}
 */
export function upgradeEarth({ THREE, renderer, earth, earthMat, mobile, texUrl } = {}) {
  if (!THREE || !earth || !earthMat || !earthMat.uniforms) {
    return { dispose() {} };
  }

  let disposed = false;
  let warned = false;
  const warnOnce = (msg, err) => {
    if (warned) return;
    warned = true;
    if (err !== undefined) console.warn("[earth-hires]", msg, err);
    else console.warn("[earth-hires]", msg);
  };

  const caps = renderer && renderer.capabilities;
  const maxAniso = Math.max(1, caps && caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1);
  const maxTexSize = (caps && caps.maxTextureSize) || 4096;

  const configureTex = (tex) => {
    if (!tex || !tex.isTexture || tex.isDataTexture) return;
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
  };

  const bumpAniso = (tex) => {
    if (!tex || !tex.isTexture || tex.isDataTexture) return;
    if (tex.anisotropy < maxAniso) {
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 1. Uniform guard (2K anisotropy bump + race-safe 4K upgrade on desktop)  */
  /* ------------------------------------------------------------------------ */
  const owned4k = new Set();
  const upgradedKeys = new Set();
  const restoreUniforms = [];

  for (const [key] of UPGRADE_4K) {
    const u = earthMat.uniforms[key];
    if (!u) continue;
    let cur = u.value;
    bumpAniso(cur);

    // Intercept late 2K assignments so they receive maxAniso and never clobber
    // a 4K texture that finished earlier (e.g. from cache).
    Object.defineProperty(u, "value", {
      configurable: true,
      enumerable: true,
      get() {
        return cur;
      },
      set(next) {
        if (upgradedKeys.has(key) && !owned4k.has(next)) {
          if (next && next.isTexture && !next.isDataTexture && next !== cur) {
            next.dispose();
          }
          return;
        }
        cur = next;
        bumpAniso(cur);
      },
    });
    restoreUniforms.push(() => {
      Object.defineProperty(u, "value", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: cur,
      });
    });
  }

  if (!mobile && typeof texUrl === "function") {
    const loader = new THREE.TextureLoader();
    for (const [key, file] of UPGRADE_4K) {
      const u = earthMat.uniforms[key];
      if (!u) continue;
      loader.load(
        texUrl(file),
        (tex) => {
          if (disposed) {
            tex.dispose();
            return;
          }
          configureTex(tex);
          const prev = u.value;
          owned4k.add(tex);
          upgradedKeys.add(key);
          u.value = tex;
          if (key === "uDay" && earthMat.uniforms.uReady) {
            earthMat.uniforms.uReady.value = 1;
          }
          if (prev && prev !== tex && prev.isTexture && !prev.isDataTexture) {
            prev.dispose();
          }
        },
        undefined,
        () => {
          warnOnce("4K Earth texture load failed; keeping 2K fallback.");
        },
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 2. Regional NASA GIBS high-res mosaic & spherical patch mesh             */
  /* ------------------------------------------------------------------------ */
  const zoom = mobile ? 5 : 6; // z=6: 4.5°/tile (~978 m/px); z=5: 9°/tile (~1.96 km/px)
  const tileDeg = LEVEL0_DEG / (1 << zoom);
  const colMin = Math.floor((REGION.lonMin + 180) / tileDeg);
  const colMax = Math.ceil((REGION.lonMax + 180) / tileDeg) - 1;
  const rowMin = Math.floor((90 - REGION.latMax) / tileDeg);
  const rowMax = Math.ceil((90 - REGION.latMin) / tileDeg) - 1;

  const cols = colMax - colMin + 1;
  const rows = rowMax - rowMin + 1;
  const lonMin = -180 + colMin * tileDeg;
  const lonMax = -180 + (colMax + 1) * tileDeg;
  const latMax = 90 - rowMin * tileDeg;
  const latMin = 90 - (rowMax + 1) * tileDeg;

  const capDim = Math.min(mobile ? 2048 : 4096, maxTexSize);
  const rawW = cols * TILE_PX;
  const rawH = rows * TILE_PX;
  const scale = Math.min(1, capDim / rawW, capDim / rawH);
  const canvasW = Math.max(1, Math.round(rawW * scale));
  const canvasH = Math.max(1, Math.round(rawH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");

  let patch = null;
  let patchGeo = null;
  let patchMat = null;
  let patchTex = null;
  let flushTimer = 0;
  let fadeRaf = 0;
  const activeImgs = new Set();

  if (!ctx) {
    warnOnce("2D canvas unavailable for regional Earth overlay.");
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    patchTex = new THREE.CanvasTexture(canvas);
    patchTex.colorSpace = THREE.NoColorSpace;
    patchTex.wrapS = THREE.ClampToEdgeWrapping;
    patchTex.wrapT = THREE.ClampToEdgeWrapping;
    patchTex.generateMipmaps = true;
    patchTex.minFilter = THREE.LinearMipmapLinearFilter;
    patchTex.magFilter = THREE.LinearFilter;
    patchTex.anisotropy = maxAniso;

    const earthR = (earth.geometry && earth.geometry.parameters && earth.geometry.parameters.radius) || 6371;
    patchGeo = buildPatchGeometry(
      THREE,
      earthR + PATCH_ALT_KM,
      lonMin,
      lonMax,
      latMin,
      latMax,
      mobile ? 64 : 96,
      mobile ? 40 : 64,
    );

    const uOpacity = { value: 0 };
    patchMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      uniforms: {
        uPatch: { value: patchTex },
        uMask: earthMat.uniforms.uMask,
        uNight: earthMat.uniforms.uNight,
        uSun: earthMat.uniforms.uSun,
        uReady: earthMat.uniforms.uReady,
        uBounds: { value: new THREE.Vector4(lonMin, latMin, lonMax, latMax) },
        uFeather: { value: FEATHER_DEG },
        uOpacity,
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        uniform sampler2D uPatch, uMask, uNight;
        uniform vec3 uSun;
        uniform vec4 uBounds;
        uniform float uReady, uFeather, uOpacity;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vW;

        float hash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          vec4 hi = texture2D(uPatch, vUv);
          float lonDeg = mix(uBounds.x, uBounds.z, vUv.x);
          float latDeg = mix(uBounds.y, uBounds.w, vUv.y);
          float edgeLon = smoothstep(0.0, uFeather, min(lonDeg - uBounds.x, uBounds.z - lonDeg));
          float edgeLat = smoothstep(0.0, uFeather, min(latDeg - uBounds.y, uBounds.w - latDeg));
          float alpha = hi.a * edgeLon * edgeLat * uOpacity;
          if (alpha <= 0.002) discard;

          vec2 gUv = vec2((lonDeg + 180.0) / 360.0, (latDeg + 90.0) / 180.0);
          vec3 n = normalize(vN);
          vec3 vVec = cameraPosition - vW;
          float camDist = length(vVec);
          vec3 v = vVec / max(camDist, 1e-4);
          float ndl = dot(n, uSun);

          // Unpremultiply edge texels where unloaded tiles have alpha 0
          vec3 day = hi.rgb / max(hi.a, 0.001);
          vec3 night = texture2D(uNight, gUv).rgb * uReady;
          vec4 m = texture2D(uMask, gUv);
          float cloud = m.r * uReady;
          float ocean = m.g;

          // Subtle low-altitude procedural micro-detail to break up texels
          float detailFade = 1.0 - smoothstep(45.0, 260.0, camDist);
          if (detailFade > 0.001) {
            vec2 geo = vec2(lonDeg, latDeg);
            float det = (vnoise(geo * 140.0) * 0.65 + vnoise(geo * 380.0 + 19.7) * 0.35) - 0.5;
            float amp = mix(0.035, 0.14, 1.0 - ocean) * detailFade * (1.0 - cloud * 0.8);
            day *= (1.0 + det * amp);
          }

          // Match earthMat lighting & fresnel rim exactly (display-space)
          float light = smoothstep(-0.12, 0.3, ndl);
          vec3 col = day * (0.04 + 1.05 * max(ndl, 0.0));
          col = mix(col, vec3(0.96) * (0.03 + max(ndl, 0.0)), cloud * 0.88);
          col += night * vec3(1.0, 0.82, 0.55) * 1.3 * (1.0 - light) * (1.0 - cloud);
          vec3 r = reflect(-uSun, n);
          col += vec3(1.0, 0.92, 0.8) * ocean * pow(max(dot(r, v), 0.0), 60.0) * 0.55 * light * (1.0 - cloud);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          col = mix(col, vec3(0.38, 0.62, 1.0) * (0.15 + light), fres * 0.65);

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    patch = new THREE.Mesh(patchGeo, patchMat);
    patch.name = "earthHiresPatch";
    patch.renderOrder = (earth.renderOrder || 2) + 0.5;
    patch.visible = false;
    earth.add(patch);

    // Self-stopping fade animator (runs only during brief ~450 ms transitions; zero per-frame allocs)
    let fadeTarget = 0;
    let fadeLast = 0;
    const stepFade = (now) => {
      fadeRaf = 0;
      if (disposed) return;
      const dt = fadeLast ? Math.min(0.1, (now - fadeLast) / 1000) : 0.016;
      fadeLast = now;
      const cur = uOpacity.value;
      const step = dt / 0.45;
      if (fadeTarget > cur) {
        uOpacity.value = Math.min(fadeTarget, cur + step);
      } else {
        uOpacity.value = Math.max(fadeTarget, cur - step);
      }
      if (Math.abs(uOpacity.value - fadeTarget) > 0.001) {
        fadeRaf = requestAnimationFrame(stepFade);
      } else {
        uOpacity.value = fadeTarget;
        if (fadeTarget <= 0) patch.visible = false;
      }
    };
    const fadeTo = (target) => {
      fadeTarget = target;
      if (target > 0) patch.visible = true;
      if (!fadeRaf && Math.abs(uOpacity.value - target) > 0.001) {
        fadeLast = 0;
        fadeRaf = requestAnimationFrame(stepFade);
      } else if (target <= 0 && uOpacity.value <= 0) {
        patch.visible = false;
      }
    };

    // Build tile queue sorted by proximity to Bangkok & eastward flight track
    const queue = [];
    for (let r = rowMin; r <= rowMax; r++) {
      const cLat = 90 - (r + 0.5) * tileDeg;
      for (let c = colMin; c <= colMax; c++) {
        const cLon = -180 + (c + 0.5) * tileDeg;
        const clampedLon = Math.min(TRACK_LON1, Math.max(TRACK_LON0, cLon));
        const dist = Math.hypot(cLat - TRACK_LAT, cLon - clampedLon);
        const startBias = Math.max(0, cLon - TRACK_LON0) * 0.08;
        queue.push({ r, c, ri: r - rowMin, ci: c - colMin, score: dist + startBias });
      }
    }
    queue.sort((a, b) => a.score - b.score);

    const total = queue.length;
    let nextIdx = 0;
    let loaded = 0;
    let failed = 0;
    let dirty = false;
    let uploadedOnce = false;

    const flushCanvas = () => {
      flushTimer = 0;
      if (disposed || !dirty) return;
      dirty = false;
      patchTex.needsUpdate = true;
      if (!uploadedOnce && loaded > 0) {
        uploadedOnce = true;
        fadeTo(1);
      }
    };

    const scheduleFlush = (immediate) => {
      if (immediate) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = 0;
        }
        flushCanvas();
        return;
      }
      if (!flushTimer) {
        flushTimer = setTimeout(flushCanvas, 350);
      }
    };

    const onTileDone = () => {
      const settled = loaded + failed;
      if (settled === total) {
        if (loaded === 0) {
          warnOnce("NASA GIBS tiles failed to load; using global Earth texture.");
          fadeTo(0);
        } else {
          scheduleFlush(true);
          if (failed > 0) {
            warnOnce(`Some NASA GIBS tiles failed (${failed}/${total}); global texture fills gaps.`);
            if (loaded / total < 0.3) fadeTo(0);
          }
        }
        return;
      }
      if (dirty) {
        // Upload quickly once the core tiles under Bangkok arrive, then throttle.
        if (!uploadedOnce && loaded >= Math.min(4, total)) scheduleFlush(true);
        else scheduleFlush(false);
      }
    };

    const pump = () => {
      if (disposed || nextIdx >= total) return;
      const tile = queue[nextIdx++];
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      activeImgs.add(img);

      const finish = () => {
        activeImgs.delete(img);
        img.onload = img.onerror = null;
        if (!disposed) {
          onTileDone();
          pump();
        }
      };

      img.onload = () => {
        if (!disposed) {
          try {
            const dx0 = Math.round((tile.ci * canvasW) / cols);
            const dx1 = Math.round(((tile.ci + 1) * canvasW) / cols);
            const dy0 = Math.round((tile.ri * canvasH) / rows);
            const dy1 = Math.round(((tile.ri + 1) * canvasH) / rows);
            ctx.drawImage(img, dx0, dy0, dx1 - dx0, dy1 - dy0);
            loaded++;
            dirty = true;
          } catch {
            failed++;
          }
        }
        finish();
      };

      img.onerror = () => {
        if (!disposed) failed++;
        finish();
      };

      img.src = `${GIBS_BASE}/${zoom}/${tile.r}/${tile.c}.jpeg`;
    };

    const concurrency = Math.min(mobile ? 4 : 8, total);
    for (let i = 0; i < concurrency; i++) pump();
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = 0;
      }
      if (fadeRaf) {
        cancelAnimationFrame(fadeRaf);
        fadeRaf = 0;
      }
      for (const img of activeImgs) {
        img.onload = img.onerror = null;
        img.src = "";
      }
      activeImgs.clear();
      for (const restore of restoreUniforms) restore();
      restoreUniforms.length = 0;
      for (const tex of owned4k) tex.dispose();
      owned4k.clear();
      if (patch) {
        earth.remove(patch);
        patch = null;
      }
      if (patchGeo) {
        patchGeo.dispose();
        patchGeo = null;
      }
      if (patchMat) {
        patchMat.dispose();
        patchMat = null;
      }
      if (patchTex) {
        patchTex.dispose();
        patchTex = null;
      }
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/**
 * Build a spherical lat/lon grid patch matching launch-flight.js's globe
 * orientation: (cos(lat)*cos(lon), sin(lat), -cos(lat)*sin(lon)).
 * Outward CCW winding, UVs linear in (lon, lat) with v=1 at latMax (North).
 */
function buildPatchGeometry(THREE, radius, lonMin, lonMax, latMin, latMax, segLon, segLat) {
  const cols = segLon + 1;
  const rows = segLat + 1;
  const vCount = cols * rows;
  const pos = new Float32Array(vCount * 3);
  const norm = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);

  let p = 0;
  let u = 0;
  for (let j = 0; j < rows; j++) {
    const fy = j / segLat; // 0 = North (latMax), 1 = South (latMin)
    const lat = (latMax - fy * (latMax - latMin)) * DEG2RAD;
    const sl = Math.sin(lat);
    const cl = Math.cos(lat);
    const vCoord = 1 - fy;

    for (let i = 0; i < cols; i++) {
      const fx = i / segLon; // 0 = West (lonMin), 1 = East (lonMax)
      const lon = (lonMin + fx * (lonMax - lonMin)) * DEG2RAD;
      const nx = cl * Math.cos(lon);
      const ny = sl;
      const nz = -cl * Math.sin(lon);

      norm[p] = nx;
      norm[p + 1] = ny;
      norm[p + 2] = nz;
      pos[p] = nx * radius;
      pos[p + 1] = ny * radius;
      pos[p + 2] = nz * radius;
      p += 3;

      uvs[u] = fx;
      uvs[u + 1] = vCoord;
      u += 2;
    }
  }

  const idx = new (vCount > 65535 ? Uint32Array : Uint16Array)(segLon * segLat * 6);
  let k = 0;
  for (let j = 0; j < segLat; j++) {
    for (let i = 0; i < segLon; i++) {
      const a = j * cols + i;
      const b = a + cols;
      const c = b + 1;
      const d = a + 1;
      // (b - a) = South, (c - a) = South + East -> South x East = outward normal
      idx[k++] = a;
      idx[k++] = b;
      idx[k++] = c;
      idx[k++] = a;
      idx[k++] = c;
      idx[k++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
