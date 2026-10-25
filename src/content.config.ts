// The docs collection is this repo's own markdown, at its root.
//
// The files are the source engineers read in a checkout — no copy, no
// duplication. The dashboard renders the same files through the index at
// ../index.ts; this project renders them as the public docs site.

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  docs: defineCollection({
    // *.md only — the repo also holds two generated .html diagrams, which are
    // not pages and have no frontmatter to load. README.md is about building
    // this project, for GitHub; index.ts leaves it out of every list, and
    // without this it was still built as a page and put in the sitemap.
    loader: glob({ pattern: ["*.md", "!README.md"], base: "." }),
  }),
};
