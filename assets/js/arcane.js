/*
 * ============================================================================
 *  arcane.js — generative-AI background for the opt-in "Arcane" theme.
 * ============================================================================
 *  When Arcane is activated (or the d20 reroll button is clicked) this module
 *  summons a fresh fantasy background image.
 *
 *  Image source (progressive enhancement):
 *    1. /api/arcane-image — a Cloudflare Worker that calls Google Gemini using
 *       a server-side secret (preferred when GEMINI_API_KEY is configured).
 *    2. Pollinations.ai — a free, key-less text-to-image endpoint (fallback,
 *       and what the static site uses out of the box).
 *    3. A rotating d20 motif — shown while generating and if both fail.
 *
 *  A new random scene + seed is used on every activation / reroll. The image
 *  crossfades in behind a scrim so text stays legible.
 *
 *  Decoupling: this module only listens for a `themechange` CustomEvent
 *  (dispatched by main.js). It is imported by nothing.
 * ============================================================================
 */
(function () {
  "use strict";

  const WORKER_ENDPOINT = "/api/arcane-image";

  const STYLE =
    "ornate Dungeons & Dragons arcane fantasy art, glowing magical runes and sigils, " +
    "deep amethyst purple and antique gold, mystical, atmospheric, highly detailed, " +
    "painterly, no text, no watermark, no people";

  const SCENES = [
    "an ancient arcane library with floating tomes",
    "a wizard's tower interior crackling with energy",
    "an enchanted moonlit forest clearing",
    "a glowing magical portal of swirling runes",
    "a dragon's treasure hoard in a vast cavern",
    "a celestial observatory under a starry void",
    "a rune-carved dungeon hall lit by torches",
    "a misty mountain temple of forgotten gods",
  ];

  // Stylised 20-sided die — loading/fallback motif and reroll icon.
  const D20_SVG =
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' +
    '<polygon points="50,3 92,27 92,73 50,97 8,73 8,27"/>' +
    '<polygon points="50,32 73,69 27,69"/>' +
    '<path d="M50,3 L50,32 M92,27 L73,69 M8,27 L27,69 M92,73 L73,69 M8,73 L27,69 ' +
    'M50,97 L73,69 M50,97 L27,69 M50,32 L92,27 M50,32 L8,27"/>' +
    '<text x="50" y="60" text-anchor="middle" font-size="15" font-family="Cinzel, Georgia, serif" ' +
    'fill="currentColor" stroke="none" font-weight="700">20</text></svg>';

  let layer = null;
  let imgLayer = null;
  let reroll = null;
  let genToken = 0; // guards against overlapping/rerolled generations

  function build() {
    if (layer) return;

    layer = document.createElement("div");
    layer.className = "arcane-bg";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML =
      '<div class="arcane-bg__img"></div>' +
      '<div class="arcane-bg__scrim"></div>' +
      '<div class="arcane-bg__motif">' + D20_SVG + "</div>";
    document.body.appendChild(layer);
    imgLayer = layer.querySelector(".arcane-bg__img");

    reroll = document.createElement("div");
    reroll.className = "arcane-reroll";
    reroll.innerHTML =
      '<span class="arcane-reroll__label">&#10022; Summoning&hellip;</span>' +
      '<button class="arcane-reroll__btn" type="button" aria-label="Reroll background">' + D20_SVG + "</button>";
    document.body.appendChild(reroll);
    reroll.querySelector(".arcane-reroll__btn").addEventListener("click", generate);
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(url); };
      img.onerror = function () { reject(new Error("image load failed")); };
      img.src = url;
    });
  }

  function generate() {
    build();
    const token = ++genToken;
    layer.classList.add("is-loading");
    layer.classList.remove("has-image");
    reroll.classList.add("is-busy");

    const scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    const seed = Math.floor(Math.random() * 1e6);
    const prompt = scene + ", " + STYLE;
    const q = "prompt=" + encodeURIComponent(prompt) + "&seed=" + seed;
    const workerUrl = WORKER_ENDPOINT + "?" + q;
    const pollUrl =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      "?width=1280&height=820&nologo=true&model=flux&seed=" + seed;

    loadImage(workerUrl)
      .catch(function () { return loadImage(pollUrl); })
      .then(function (url) {
        if (token !== genToken) return; // a newer reroll superseded this one
        imgLayer.style.backgroundImage = 'url("' + url + '")';
        layer.classList.remove("is-loading");
        layer.classList.add("has-image");
        reroll.classList.remove("is-busy");
      })
      .catch(function () {
        if (token !== genToken) return;
        layer.classList.remove("is-loading"); // keep the d20 motif as fallback
        reroll.classList.remove("is-busy");
      });
  }

  document.addEventListener("themechange", function (e) {
    const theme = e.detail && e.detail.theme;
    if (theme === "arcane") {
      build();
      layer.classList.add("is-active");
      generate(); // fresh image on every activation
    } else if (layer) {
      layer.classList.remove("is-active");
    }
  });
})();
