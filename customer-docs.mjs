// Which docs a customer gets, and in what form — the one definition.
//
// Two things hand foldrun's docs to someone outside: the CLI package ships
// them on disk for a coding agent (foldrun-cli/scripts/sync-docs.mjs), and
// the dashboard's assistant answers from them (foldrun-web/server/
// assistant-docs.ts). Both must hand over the same set, so the rule lives
// here. Left out:
//   *-adr.md          design records about how the platform is built
//   README.md         the docs repo's own readme
//   LICENSING.md      the repo's licence summary (each package ships its own)
//   environment.md    the platform's server environment variables
// and inside api.md, the "Super admin" and "Operations" sections, which are
// the platform operator's routes, not an account's.
//
// Plain JavaScript so a Node script can import it without a build.

import fs from "node:fs";
import path from "node:path";

export const SKIP = new Set(["README.md", "LICENSING.md", "environment.md"]);
export const DROP_SECTIONS = { "api.md": ["Super admin", "Operations"] };

export function dropSections(text, titles) {
  const lines = text.split("\n");
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const h = /^## (.+)$/.exec(line);
    if (h) skipping = titles.includes(h[1].trim());
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** `{ "agents.md": text, … }` — every customer doc in `dir`, sorted by name. */
export function customerDocs(dir) {
  const files = {};
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".md") || SKIP.has(name) || name.endsWith("-adr.md")) continue;
    let text = fs.readFileSync(path.join(dir, name), "utf8");
    if (DROP_SECTIONS[name]) text = dropSections(text, DROP_SECTIONS[name]);
    files[name] = text;
  }
  return files;
}
