/*
 * Cloudflare Worker entry. Serves the static site (via the ASSETS binding) and
 * handles the dynamic /api/arcane-* routes. Configured in wrangler.jsonc.
 */
import { handleArcaneImage } from "./arcane-image.js";
import { handleArcaneText } from "./arcane-text.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/arcane-image") {
      return handleArcaneImage(request, env);
    }
    if (url.pathname === "/api/arcane-text") {
      return handleArcaneText(request, env);
    }
    // Everything else is a static asset.
    return env.ASSETS.fetch(request);
  },
};
