/*
 * ============================================================================
 *  arcane.js — generative-AI background + ambient music for the Arcane theme.
 * ============================================================================
 *  Background image: Pollinations.ai (free, key-less). flux-pro model at
 *  1920×1080 for crisp full-screen results. A new random scene + seed is used
 *  on every activation / reroll. The image crossfades in behind a scrim so
 *  text stays legible.
 *
 *  Background music: YouTube IFrame API. A curated fantasy-RPG OST playlist
 *  shuffles on each Arcane activation. Controls (play/pause, next, mute) float
 *  at the bottom-left. Music respects the browser's autoplay policy — it starts
 *  after any user interaction (theme toggle counts).
 *
 *  To update the music playlist, edit the MUSIC_TRACKS array below.
 *
 *  Decoupling: listens for the `themechange` CustomEvent dispatched by main.js.
 * ============================================================================
 */
(function () {
  "use strict";

  /* ── Background image ────────────────────────────────────────────────────── */

  const IMAGE_STYLE =
    "ornate Dungeons & Dragons arcane fantasy art, glowing magical runes and sigils, " +
    "deep amethyst purple and antique gold, mystical, atmospheric, highly detailed, " +
    "painterly, wide cinematic landscape, no text, no watermark, no people";

  const SCENES = [
    "an ancient arcane library with floating tomes and candlelight",
    "a wizard's tower interior crackling with violet energy",
    "an enchanted moonlit forest clearing with glowing fireflies",
    "a glowing magical portal of swirling golden runes",
    "a dragon's treasure hoard in a vast underground cavern",
    "a celestial observatory under a starry void, constellations alive",
    "a rune-carved dungeon hall lit by torches and magical crystals",
    "a misty mountain temple of forgotten gods at dusk",
  ];

  const D20_SVG =
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' +
    '<polygon points="50,3 92,27 92,73 50,97 8,73 8,27"/>' +
    '<polygon points="50,32 73,69 27,69"/>' +
    '<path d="M50,3 L50,32 M92,27 L73,69 M8,27 L27,69 M92,73 L73,69 M8,73 L27,69 ' +
    'M50,97 L73,69 M50,97 L27,69 M50,32 L92,27 M50,32 L8,27"/>' +
    '<text x="50" y="60" text-anchor="middle" font-size="15" font-family="Cinzel, Georgia, serif" ' +
    'fill="currentColor" stroke="none" font-weight="700">20</text></svg>';

  let bgLayer = null;
  let imgLayer = null;
  let rerollEl = null;
  let genToken = 0;

  function buildBg() {
    if (bgLayer) return;
    bgLayer = document.createElement("div");
    bgLayer.className = "arcane-bg";
    bgLayer.setAttribute("aria-hidden", "true");
    bgLayer.innerHTML =
      '<div class="arcane-bg__img"></div>' +
      '<div class="arcane-bg__scrim"></div>' +
      '<div class="arcane-bg__motif">' + D20_SVG + "</div>";
    document.body.appendChild(bgLayer);
    imgLayer = bgLayer.querySelector(".arcane-bg__img");

    rerollEl = document.createElement("div");
    rerollEl.className = "arcane-reroll";
    rerollEl.innerHTML =
      '<span class="arcane-reroll__label">&#10022; Summoning&hellip;</span>' +
      '<button class="arcane-reroll__btn" type="button" aria-label="Reroll background">' + D20_SVG + "</button>";
    document.body.appendChild(rerollEl);
    rerollEl.querySelector(".arcane-reroll__btn").addEventListener("click", generate);
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(url); };
      img.onerror = function () { reject(new Error("image load failed")); };
      img.src = url;
    });
  }

  /* ── RPG wording (Gemini via the Worker) ─────────────────────────────────── */

  var TEXT_ENDPOINT = "/api/arcane-text";
  var labelsDone = false; // section labels are fetched once per page load

  function fetchJSON(url) {
    return fetch(url, { headers: { accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("text endpoint " + r.status);
      return r.json();
    });
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) throw new Error("text endpoint " + r.status);
      return r.json();
    });
  }

  // Retell the About bio in fantasy style from the real content (the base),
  // regenerated on every summon. Falls back to the real bio on any failure.
  function summonLore() {
    var data = window.portfolioData;
    var base = data && data.about && data.about.paragraphs;
    if (!base || !base.length) return;
    postJSON(TEXT_ENDPOINT, { kind: "lore", base: base, seed: Math.floor(Math.random() * 1e6) })
      .then(function (out) {
        if (out && out.paragraphs && window.PortfolioArcane) window.PortfolioArcane.setLore(out.paragraphs);
      })
      .catch(function () {}); // keep the real About content
  }

  // Section nav/kicker/title wording — generated once; static data.js labels
  // remain the instant fallback if this fails.
  function summonLabels() {
    if (labelsDone) return;
    labelsDone = true;
    fetchJSON(TEXT_ENDPOINT + "?kind=labels&seed=" + Math.floor(Math.random() * 1e6))
      .then(function (map) {
        if (window.PortfolioArcane) window.PortfolioArcane.setLabels(map);
      })
      .catch(function () { labelsDone = false; }); // allow a retry on re-activation
  }

  // Fresh "Parley" (contact) flavor — regenerated on every summon, like the bg.
  function summonParley() {
    fetchJSON(TEXT_ENDPOINT + "?kind=parley&seed=" + Math.floor(Math.random() * 1e6))
      .then(function (p) {
        if (window.PortfolioArcane) window.PortfolioArcane.setParley(p);
      })
      .catch(function () {}); // keep the static "Parley" label
  }

  function generate() {
    buildBg();
    summonParley(); // regenerate the Parley copy alongside the background
    summonLore();   // and retell the About lore in-theme
    var token = ++genToken;
    bgLayer.classList.add("is-loading");
    bgLayer.classList.remove("has-image");
    rerollEl.classList.add("is-busy");

    var scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    var seed = Math.floor(Math.random() * 1e6);
    var prompt = scene + ", " + IMAGE_STYLE;

    // flux-pro at 1920×1080 for crisp full-screen backgrounds; enhance=true
    // for Pollinations' built-in quality upscaling pass.
    var pollUrl =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      "?width=1920&height=1080&nologo=true&model=flux-pro&enhance=true&seed=" + seed;

    loadImage(pollUrl)
      .then(function (url) {
        if (token !== genToken) return;
        imgLayer.style.backgroundImage = 'url("' + url + '")';
        bgLayer.classList.remove("is-loading");
        bgLayer.classList.add("has-image");
        rerollEl.classList.remove("is-busy");
      })
      .catch(function () {
        if (token !== genToken) return;
        bgLayer.classList.remove("is-loading");
        rerollEl.classList.remove("is-busy");
      });
  }

  /* ── Background music ────────────────────────────────────────────────────── */

  /*
   * Curated fantasy-RPG OST playlist (YouTube video IDs, played in order).
   * To update: replace/add IDs. The player skips on load errors and shows the
   * real video title once it starts.
   *
   * When the list runs out, playback hands off to YouTube's "radio" mix seeded
   * from the LAST track (the RD<id> auto-generated playlist), so the music
   * keeps going with related songs indefinitely.
   */
  var MUSIC_TRACKS = [
    "f_5aHf3saoY",
    "zSVRtM1x9wQ",
    "DN-Dcwq4i2g",
    "YOMKc7DW-tY",
    "5Jq2zYmbMYU",
  ];

  function shuffleTracks() {
    for (var i = MUSIC_TRACKS.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = MUSIC_TRACKS[i]; MUSIC_TRACKS[i] = MUSIC_TRACKS[j]; MUSIC_TRACKS[j] = t;
    }
  }
  shuffleTracks(); // randomize the play order on every page load

  var radioMode = false; // true once we've handed off to the YouTube radio mix
  var errorStreak = 0;   // consecutive load failures — guards against runaway skipping

  var musicWidget = null;       // .arcane-music container
  var musicTrackLabel = null;   // <span> showing track name
  var musicPlayBtn = null;      // play/pause button
  var musicMuteBtn = null;      // mute/unmute button
  var ytPlayerEl = null;        // tiny YouTube player DOM node
  var ytPlayer = null;          // YT.Player instance
  var ytReady = false;
  var trackIndex = 0;
  var musicMuted = false;
  var musicPlaying = false;
  var wantPlay = false;         // desired state: should we be playing right now?
  var creatingPlayer = false;   // guards against double player creation

  var MUSIC_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="18" height="18">' +
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  var PAUSE_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18">' +
    '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

  var NEXT_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">' +
    '<polygon points="5,4 15,12 5,20"/><rect x="16" y="4" width="3" height="16"/></svg>';

  var MUTE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">' +
    '<polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>' +
    '<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

  var UNMUTE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">' +
    '<polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>' +
    '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
    '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

  function buildMusicWidget() {
    if (musicWidget) return;

    // 1×1px YouTube player — technically visible, not display:none
    ytPlayerEl = document.createElement("div");
    ytPlayerEl.id = "arcane-yt-player";
    ytPlayerEl.style.cssText =
      "position:fixed;bottom:0;left:0;width:1px;height:1px;overflow:hidden;" +
      "opacity:0.01;pointer-events:none;z-index:68;";
    var innerDiv = document.createElement("div");
    innerDiv.id = "arcane-yt";
    ytPlayerEl.appendChild(innerDiv);
    document.body.appendChild(ytPlayerEl);

    // Music control widget (bottom-left)
    musicWidget = document.createElement("div");
    musicWidget.className = "arcane-music";
    musicWidget.setAttribute("aria-label", "Background music controls");
    musicWidget.innerHTML =
      '<button class="arcane-music__toggle" type="button" aria-label="Toggle music" title="Toggle music">' +
        MUSIC_ICON +
      "</button>" +
      '<div class="arcane-music__panel">' +
        '<span class="arcane-music__track">&#10022; Loading&hellip;</span>' +
        '<div class="arcane-music__btns">' +
          '<button class="arcane-music__play" type="button" aria-label="Play / Pause">' + MUSIC_ICON + "</button>" +
          '<button class="arcane-music__next" type="button" aria-label="Next track">' + NEXT_ICON + "</button>" +
          '<button class="arcane-music__mute" type="button" aria-label="Mute / Unmute">' + UNMUTE_ICON + "</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(musicWidget);

    musicTrackLabel = musicWidget.querySelector(".arcane-music__track");
    musicPlayBtn = musicWidget.querySelector(".arcane-music__play");
    musicMuteBtn = musicWidget.querySelector(".arcane-music__mute");

    musicWidget.querySelector(".arcane-music__toggle").addEventListener("click", function () {
      musicWidget.classList.toggle("is-open");
      if (musicWidget.classList.contains("is-open")) startPlayback();
    });

    musicPlayBtn.addEventListener("click", function () {
      if (musicPlaying) stopPlayback(); else startPlayback();
    });

    musicWidget.querySelector(".arcane-music__next").addEventListener("click", function () {
      errorStreak = 0; // manual skip — let it try the next track afresh
      playNext();
    });

    musicMuteBtn.addEventListener("click", function () {
      musicMuted = !musicMuted;
      if (ytPlayer) {
        if (musicMuted) ytPlayer.mute(); else ytPlayer.unMute();
      }
      musicMuteBtn.innerHTML = musicMuted ? MUTE_ICON : UNMUTE_ICON;
      musicMuteBtn.setAttribute("aria-label", musicMuted ? "Unmute" : "Mute");
    });
  }

  function loadYouTubeAPI() {
    return new Promise(function (resolve) {
      if (window.YT && window.YT.Player) { resolve(); return; }
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (prev) prev();
        resolve();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        var s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    });
  }

  function updatePlayBtn() {
    if (!musicPlayBtn) return;
    musicPlayBtn.innerHTML = musicPlaying ? PAUSE_ICON : MUSIC_ICON;
    musicPlayBtn.setAttribute("aria-label", musicPlaying ? "Pause" : "Play");
  }

  function updateTrackLabel(text) {
    if (musicTrackLabel) musicTrackLabel.textContent = "✶ " + text;
  }

  // Pull the real video title from the player once it's known.
  function syncTrackLabelFromPlayer() {
    if (ytPlayer && ytPlayer.getVideoData) {
      var d = ytPlayer.getVideoData();
      if (d && d.title) updateTrackLabel(d.title);
    }
  }

  function playNext() {
    if (radioMode) {
      // Radio mix ended or failed — re-shuffle the list and start over.
      radioMode = false;
      shuffleTracks();
      trackIndex = 0;
      if (ytPlayer && ytReady) ytPlayer.loadVideoById(MUSIC_TRACKS[trackIndex]);
      return;
    }
    if (trackIndex >= MUSIC_TRACKS.length - 1) {
      // Ran out of the curated list — hand off to the YouTube radio mix
      // seeded from the last track so related songs keep playing.
      radioMode = true;
      if (ytPlayer && ytReady) {
        ytPlayer.loadPlaylist({ listType: "playlist", list: "RD" + MUSIC_TRACKS[trackIndex] });
      }
      return;
    }
    trackIndex += 1;
    if (ytPlayer && ytReady) ytPlayer.loadVideoById(MUSIC_TRACKS[trackIndex]);
  }

  // Called from onError. A track that can't embed is skipped, but a full cycle
  // of failures stops the chain so it can't spin through the whole list.
  function handleLoadError() {
    errorStreak += 1;
    if (errorStreak > MUSIC_TRACKS.length + 1) {
      updateTrackLabel("Track unavailable");
      return;
    }
    playNext();
  }

  // Create the YouTube player up front (no playback yet). Creating the player
  // does not require a user gesture; PLAYING does — so we create it eagerly and
  // only call playVideo() from inside a real click handler. That avoids the
  // autoplay-policy block that happens when playVideo() is deferred to the
  // async onReady callback (which loses the gesture context).
  function createPlayer() {
    if (ytPlayer || creatingPlayer) return;
    creatingPlayer = true;
    buildMusicWidget();
    trackIndex = 0;
    radioMode = false;
    updateTrackLabel("Loading…");

    loadYouTubeAPI().then(function () {
      ytPlayer = new window.YT.Player("arcane-yt", {
        width: 1,
        height: 1,
        videoId: MUSIC_TRACKS[trackIndex],
        playerVars: {
          autoplay: 0,
          controls: 0,
          loop: 0,
          playsinline: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
        },
        events: {
          onReady: function (e) {
            ytReady = true;
            e.target.setVolume(45);
            if (musicMuted) e.target.mute();
            if (wantPlay) e.target.playVideo(); // honor a play requested before ready
            syncTrackLabelFromPlayer();
          },
          onStateChange: function (e) {
            var S = window.YT.PlayerState;
            if (e.data === S.PLAYING) { musicPlaying = true; errorStreak = 0; updatePlayBtn(); syncTrackLabelFromPlayer(); }
            if (e.data === S.PAUSED) { musicPlaying = false; updatePlayBtn(); }
            if (e.data === S.ENDED) { playNext(); }
          },
          onError: function () { handleLoadError(); },
        },
      });
    });
  }

  function startPlayback() {
    wantPlay = true;
    buildMusicWidget();
    if (ytPlayer && ytReady) {
      ytPlayer.playVideo(); // synchronous within the triggering gesture → not blocked
    } else {
      createPlayer(); // will auto-play in onReady because wantPlay is set
    }
  }

  function stopPlayback() {
    wantPlay = false;
    if (ytPlayer && ytReady) ytPlayer.pauseVideo();
    musicPlaying = false;
    updatePlayBtn();
  }

  /* ── Theme event wiring ──────────────────────────────────────────────────── */

  document.addEventListener("themechange", function (e) {
    var theme = e.detail && e.detail.theme;
    if (theme === "arcane") {
      buildBg();
      bgLayer.classList.add("is-active");
      summonLabels(); // RPG-ify the section wording (once)
      generate();     // background + fresh Parley flavor
      buildMusicWidget();
      musicWidget.classList.add("is-open");
      // Runs synchronously inside the theme-selection click, so playVideo() is
      // still within a user gesture and the browser allows audio.
      startPlayback();
    } else {
      if (bgLayer) bgLayer.classList.remove("is-active");
      if (musicWidget) musicWidget.classList.remove("is-open", "is-visible");
      stopPlayback();
    }
  });

  // Warm up the YouTube player on the first interaction (e.g. opening the theme
  // menu) so it's ready by the time Arcane is selected — then playback can start
  // synchronously within that gesture instead of fighting the autoplay policy.
  function warmUp() {
    createPlayer();
    document.removeEventListener("pointerdown", warmUp);
    document.removeEventListener("keydown", warmUp);
  }
  document.addEventListener("pointerdown", warmUp);
  document.addEventListener("keydown", warmUp);
})();
