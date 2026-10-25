// robots.txt, generated from DOCS_URL rather than hardcoded.
//
// The static asset it replaced always advertised the production host and
// `Allow: /` — so a staging build (PUBLIC_SITE_URL overridden) shipped a
// robots that invited crawlers in and pointed them at a production sitemap.
// Here production opens the door; anything else closes it.

import type { APIRoute } from "astro";
import { DOCS_URL } from "../lib/site.ts";

const PROD_ORIGIN = "https://docs.foldrun.io";

export const GET: APIRoute = () => {
  const isProd = DOCS_URL === PROD_ORIGIN;
  const body = isProd
    ? [
        "# The docs are the surface a first-time reader finds, so they are",
        "# open; app.foldrun.io serves the dashboard behind a login and is not.",
        "User-agent: *",
        "Allow: /",
        "",
        `Sitemap: ${DOCS_URL}/sitemap-index.xml`,
        "",
      ].join("\n")
    : [
        "# Non-production build — keep it out of every index.",
        "User-agent: *",
        "Disallow: /",
        "",
      ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
