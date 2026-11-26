# Gun Kaewngarm — Portfolio

A "Deep Space" portfolio: a real-time WebGL cosmos (sun-synced planet, warp
drive), a live tandem launch spotlight, a ⌘K command palette and a live ISS
ground-track radar. Still no build step and no framework — HTML, CSS and
vanilla JS, with Three.js vendored locally. **All content lives in one file**,
so updating it is quick and safe.

Designed and built by Claude (lead: design system, layout, tandem spotlight,
integration) and Gemini (WebGL scene, command palette, ISS radar) working as
one team through [tandem](https://github.com/givewgun/multi-agents-pc).

🔗 Live at **[givewgun.com](https://givewgun.com)**

## Editing content

Open [`assets/js/data.js`](assets/js/data.js) and edit the `portfolioData`
object. Everything on the page is generated from it:

- **Add a job** → add an object to `experience` (newest first).
- **Add a project / skill / certification** → push to the relevant array.
- **Reorder or hide a section** → edit the `sectionOrder` array at the bottom
  (delete a line to hide that section from the page *and* the nav).
- **Change your links / email / phone** → edit the `contact` object.
- **Latest launch spotlight** → edit the `launch` object (pitch, proof points,
  links). Add a `url` to a `coverage` item (e.g. a Reddit permalink) to turn
  that chip into a link. Stars, forks, npm version and downloads load live.
- **Keep a section off the navbar** → add `nav: false` to it in
  `sectionOrder` (it stays on the page and in the ⌘K palette).

You don't need to touch the HTML or CSS to change content.

## Tweaking the look

- Colors, spacing, and both light/dark themes are CSS variables at the top of
  [`assets/css/styles.css`](assets/css/styles.css) (`:root`,
  `html[data-theme="dark"]`, `html[data-theme="light"]`).
- The site remembers the visitor's theme choice and respects their OS
  preference by default.

## Running locally

It's a static site — just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploying to givewgun.com (Cloudflare)

**Option A — Cloudflare Pages (recommended):**
1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and select this repository.
2. Build settings: **Framework preset = None**, **Build command = (empty)**,
   **Build output directory = `/`**. (There's no build step.)
3. After the first deploy, go to the project's **Custom domains** tab and add
   `givewgun.com` (and `www.givewgun.com`). Since your DNS is already on
   Cloudflare, the records are created automatically.

**Option B — GitHub Pages behind Cloudflare:**
The included [`CNAME`](CNAME) file points GitHub Pages at `givewgun.com`. Enable
Pages on this repo (Settings → Pages → deploy from this branch), then in
Cloudflare DNS add a `CNAME` record for `givewgun.com` → `<user>.github.io`
(proxied).

## Structure

```
index.html                    # markup shell (mostly empty placeholders)
assets/css/styles.css         # design system, layout, every section, theme tokens
assets/css/space-scene.css    # WebGL stage
assets/css/mission-ui.css     # command palette, toasts, ISS radar
assets/js/data.js             # ← YOUR CONTENT lives here
assets/js/main.js             # renders data.js; scroll/counter/card effects
assets/js/space-scene.js      # WebGL cosmos (ES module) + 2D fallback + warp
assets/js/tandem-orbit.js     # binary-star visual in the launch spotlight
assets/js/mission-ui.js       # ⌘K palette, easter eggs, ISS ground-track radar
assets/js/resume.js           # generates the résumé PDF on the fly from data.js
assets/js/arcane.js           # AI-generated background for the opt-in Arcane theme
assets/vendor/three.module.min.js  # Three.js r170, self-hosted (no CDN)
CNAME                         # custom domain for GitHub Pages
```

## Space features

- **Cosmos** (`space-scene.js`): layered twinkling starfield, procedural
  planet with an atmosphere rim and a day/night terminator computed from the
  real subsolar point, faint nebula, a satellite in orbit; the camera "leaves
  orbit" as you scroll. Falls back to a 2D canvas when WebGL is unavailable,
  pauses in hidden tabs and in the Arcane theme, and renders still frames
  under `prefers-reduced-motion`.
- **Warp drive**: ⌘K → "Engage warp drive", the Konami code, or type `warp`.
- **⌘K / Ctrl K palette**: jump to sections, copy email or the npm install
  command, download the résumé, switch theme.
- **ISS radar** (footer): live position from `api.wheretheiss.at`, ground
  track and distance to Bangkok; polls only while visible.

## Social preview

`assets/og-image.png` (1200×630) is a screenshot of the live hero in a
chrome-free render mode. To regenerate it after changing the hero, serve the
site and run:

```bash
chrome --headless=new --hide-scrollbars --window-size=1200,630   --virtual-time-budget=7000 --screenshot=assets/og-image.png   "http://localhost:8080/?og"
```

## Themes

Three themes are available from the menu in the navbar: **Dark** (deep space, default), **Light** (high-altitude day),
and **Arcane** (an opt-in D&D / Baldur's Gate-inspired look). Selecting Arcane
summons a fresh AI-generated fantasy background each time. A d20 motif shows
while it generates (and stays as a fallback), a "Summoning…" label appears,
and a floating **d20 reroll button** (bottom-right) regenerates on demand.
Tune the prompt/scenes in `assets/js/arcane.js`, and the RPG-flavored section
labels in the `arcaneLabels` map in `data.js`.

When the Gemini Worker is configured, Arcane also uses `/api/arcane-text` to:

- **rewrite the section wording** (nav/kicker/title) in RPG style (once per
  activation), and
- **regenerate on every summon** (the d20 reroll, like the background): the
  **Lore** (About) section is retold as a fantasy origin story *from the real
  bio* — real facts/numbers preserved — and the **Parley** (contact) section
  gets a fresh "call to parley" invitation.

Everything else stays factual: experience, skills, projects, and links are
never sent for rewriting. If the Worker or key is missing, it silently falls
back to the static `arcaneLabels` and the real content in `data.js`.

While the text is generating, the Lore and Parley sections show a small
"Conjuring…" note, and once applied they carry an "AI-generated for the Arcane
theme" disclaimer (the real version is always one Dark/Light toggle away).

### Where the image comes from

`arcane.js` tries two sources, in order, then falls back to the d20 motif:

1. **`/api/arcane-image`** — a Cloudflare Worker (`worker/`) that calls Google
   Gemini using a server-side secret. Preferred when configured.
2. **[Pollinations.ai](https://pollinations.ai)** — a free, key-less
   text-to-image endpoint. This is what the static site uses out of the box,
   so nothing is required to get AI backgrounds working.

#### Enabling Gemini (optional)

1. Get a free API key at <https://aistudio.google.com/apikey> (note: a Gemini
   *app* subscription is separate from API access).
2. Add it as a Worker secret — in the Cloudflare dashboard
   (Workers → portfolio → Settings → Variables and Secrets) add
   `GEMINI_API_KEY`, or run `npx wrangler secret put GEMINI_API_KEY`.
3. (Optional) set `GEMINI_IMAGE_MODEL` / `GEMINI_TEXT_MODEL` if the default
   models change.
4. For local dev, copy `.dev.vars.example` to `.dev.vars` and run
   `npx wrangler dev`.

The same `GEMINI_API_KEY` powers both `/api/arcane-image` (background, paid
image model) and `/api/arcane-text` (RPG wording, free text model). If the key
is missing or a call fails, the Worker returns a non-2xx response: the
background falls back to Pollinations and the wording falls back to the static
`arcaneLabels` — so nothing breaks.

## Résumé

There is no résumé file to maintain. The **"Résumé (PDF)"** button generates a
PDF in the browser from the same `data.js` content (via `assets/js/resume.js`,
which lazy-loads jsPDF on click), so the résumé always matches the site. To
change what appears in it, edit `data.js` — or tweak the layout/sections in
`resume.js`.
