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
assets/js/main.js       # renders data.js into the page (rarely needs edits)
CNAME                   # custom domain for GitHub Pages
```

## Résumé

There is no résumé file to maintain. The **"Résumé (PDF)"** button generates a
PDF in the browser from the same `data.js` content (via `assets/js/resume.js`,
which lazy-loads jsPDF on click), so the résumé always matches the site. To
change what appears in it, edit `data.js` — or tweak the layout/sections in
`resume.js`.
