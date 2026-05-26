# Gun Kaewngarm — Portfolio

A fast, dependency-free portfolio site. No build step, no framework — just
HTML, CSS, and vanilla JS. **All content lives in one file**, so updating it
is quick and safe.

🔗 Live at **[givewgun.com](https://givewgun.com)**

## Editing content

Open [`assets/js/data.js`](assets/js/data.js) and edit the `portfolioData`
object. Everything on the page is generated from it:

- **Add a job** → add an object to `experience` (newest first).
- **Add a project / skill / certification** → push to the relevant array.
- **Reorder or hide a section** → edit the `sectionOrder` array at the bottom
  (delete a line to hide that section from the page *and* the nav).
- **Change your links / email / phone** → edit the `contact` object.

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
index.html              # markup shell (mostly empty placeholders)
assets/css/styles.css   # all styling + theme tokens
assets/js/data.js       # ← YOUR CONTENT lives here
assets/js/resume.js     # generates the résumé PDF on the fly from data.js
assets/js/arcane.js     # AI-generated background for the opt-in Arcane theme
assets/js/main.js       # renders data.js into the page (rarely needs edits)
CNAME                   # custom domain for GitHub Pages
```

## Themes

Three themes are available from the menu in the navbar: **Dark**, **Light**,
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
