/*
 * ============================================================================
 *  arcane.js — generative-AI background for the opt-in "Arcane" theme.
 * ============================================================================
 *  When the Arcane theme is activated, this module summons a fresh fantasy
 *  background image from Pollinations.ai (a free, key-less text-to-image
 *  endpoint — safe to call from a static site since no secret is exposed).
 *
 *  While the image generates, a slowly-rotating d20 motif is shown; once the
 *  image loads it crossfades in behind a dark scrim that keeps text legible.
 *  A new random scene + seed is used every time the theme is selected.
 *
 *  Decoupling: this module only listens for a `themechange` CustomEvent
 *  (dispatched by main.js). It never imports or is imported by other modules.
 * ============================================================================
 */
(function () {
  "use strict";

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

  // Stylised 20-sided die used as the loading / fallback motif.
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
  }

  function generate() {
    build();
    layer.classList.add("is-loading");
    layer.classList.remove("has-image");

    const scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    const seed = Math.floor(Math.random() * 1e6);
    const prompt = scene + ", " + STYLE;
    const url =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      "?width=1280&height=820&nologo=true&model=flux&seed=" +
      seed;

    const pre = new Image();
    pre.onload = function () {
      imgLayer.style.backgroundImage = 'url("' + url + '")';
      layer.classList.remove("is-loading");
      layer.classList.add("has-image");
    };
    pre.onerror = function () {
      // Keep the d20 motif as a graceful fallback.
      layer.classList.remove("is-loading");
    };
    pre.src = url;
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
