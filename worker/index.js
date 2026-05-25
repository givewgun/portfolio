/*
 * Cloudflare Worker entry. Serves the static site (via the ASSETS binding) and
 * handles the dynamic /api/arcane-image route. Configured in wrangler.jsonc.
 */
import { handleArcaneImage } from "./arcane-image.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/arcane-image") {
      return handleArcaneImage(request, env);
    }
    // Everything else is a static asset.
    return env.ASSETS.fetch(request);
  },
};
