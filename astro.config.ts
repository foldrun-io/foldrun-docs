// The docs site: static files, nothing else.
//
// Its own project on its own domain (docs.foldrun.io) because the docs are
// their own repo — the markdown here is the single source the platform's
// consistency tests police, and the dashboard renders the same files. No
// adapter and no SSR: everything is knowable at build time.

import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import tailwind from "@tailwindcss/vite";
import { docLinks } from "./src/lib/doc-links.ts";
import { headingIds } from "./src/lib/heading-ids.ts";
import { DOCS_URL } from "./src/lib/site.ts";

export default defineConfig({
  site: DOCS_URL,
  integrations: [sitemap()],
  markdown: {
    // [[scaling-adr]] in a doc becomes a link to that doc. See doc-links.ts.
    // Headings: GitHub's slug, a "/" read as "-" so checks#config-x resolves.
    // See heading-ids.ts.
    processor: satteri({ mdastPlugins: [docLinks()], hastPlugins: [headingIds()] }),
    shikiConfig: { themes: { light: "github-light", dark: "github-dark-default" } },
  },
  vite: { plugins: [tailwind()] },
});
