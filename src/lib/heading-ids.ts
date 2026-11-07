// A heading's id: GitHub's slug of its text, with a "/" read as a "-".
//
// Astro gives every heading GitHub's slug, which drops a "/". A check rule's
// heading is its id — `### config/effort-fitted` — and `foldrun check`, the
// dashboard and SARIF output link to it as checks#config-effort-fitted
// (foldrun-core scan.ts docsUrl), so on this site every one of those links
// missed its section: the page made #configeffort-fitted. Read a "/" as a
// "-" first and the two agree. Everything else is GitHub's slug as before, so
// no other anchor moves. The dashboard's docs viewer (foldrun-web
// components/markdown.tsx) makes the same ids.
//
// It runs before Astro's own heading pass, which keeps an id already set and
// lists it in the page's table of contents.

import Slugger from "github-slugger";
import type { HastPluginDefinition } from "satteri";

export const headingSlug = (text: string, slugger: Slugger) => slugger.slug(text.replace(/\//g, "-"));

/** One per document: a repeated heading gets -1, -2 within its own page. */
export function headingIds(): () => HastPluginDefinition {
  return () => {
    const slugger = new Slugger();
    return {
      name: "foldrun-heading-ids",
      element: {
        filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
        visit(node, ctx) {
          if (typeof node.properties?.id === "string") return;
          ctx.setProperty(node, "id", headingSlug(ctx.textContent(node), slugger));
        },
      },
    };
  };
}
