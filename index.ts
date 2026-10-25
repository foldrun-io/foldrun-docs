// What the docs section is, as data.
//
// The markdown lives in the repo's docs/ and always has: these are the files
// engineers already read in a checkout, and duplicating them into JSX would
// create the exact drift this codebase writes consistency tests to catch. So
// a docs page is a *lens* over docs/*.md, and a doc is edited in one place.
//
// There are two lenses now. site/ renders these docs publicly, for people who
// have not signed up and never will; web/ renders the same files inside the
// dashboard for people who have. Two renderers over one source is fine — two
// copies of the source is what this file exists to prevent, so the grouping
// below (the only part not derivable from the directory) lives here rather
// than in either app.
//
// Both consumers run one level below the repo root — `next` from foldrun-web/, `astro`
// from site/ — which is why docsDir() is cwd/../foldrun-docs for both (FOLDRUN_DOCS_DIR overrides).

import fs from "node:fs";
import path from "node:path";

// Which docs a customer gets (no ADRs, no operator routes) — shared with the
// CLI's copy of the docs and the dashboard's assistant.
export { customerDocs } from "./customer-docs.mjs";

export const docsDir = () => {
  if (process.env.FOLDRUN_DOCS_DIR) return process.env.FOLDRUN_DOCS_DIR;
  const sibling = path.join(process.cwd(), "..", "foldrun-docs");
  if (fs.existsSync(path.join(sibling, "index.ts"))) return sibling;
  // The docs site builds from inside this repo, and on Cloudflare Pages the
  // checkout is not called foldrun-docs — so "the sibling" does not exist
  // and every doc silently vanished from the sidebar on 2026-09-05. The cwd
  // is the docs directory when it holds this file.
  if (fs.existsSync(path.join(process.cwd(), "index.ts"))) return process.cwd();
  return sibling;
};

export interface DocGroup {
  title: string;
  blurb: string;
  slugs: string[];
}

/** Order and grouping. A doc not named here still renders — it lands in More. */
export const GROUPS: DocGroup[] = [
  {
    title: "Start here",
    blurb: "What foldrun is, and from nothing to an agent running on your own machine.",
    slugs: ["introduction", "getting-started", "how-it-works", "coding-agents", "assistant"],
  },
  {
    title: "The format",
    blurb:
      "Every field, on every kind of file. What a workspace, an agent, a flow, a " +
      "tool and an eval accept, and what each one does.",
    slugs: ["workspaces", "four-jobs", "agents", "flows", "tools", "hooks", "evals", "knowledge-and-memory"],
  },
  {
    title: "Running it",
    blurb:
      "What happens once it runs: schedules, the run record, approvals, what it " +
      "costs, where the files go, and who gets told.",
    slugs: ["scheduling", "runs", "harness", "budgets-and-billing", "storage-and-sharing", "notifications", "secrets", "network"],
  },
  {
    title: "Your account",
    blurb: "People, roles, keys, getting a workspace onto the platform, and getting it back.",
    slugs: ["team-and-access", "deploying", "providers", "backups-and-restore", "feature-flags"],
  },
  {
    title: "Operating it",
    blurb: "Running the platform yourself, what it does and does not let an agent do, and when something goes wrong.",
    slugs: ["self-hosting", "security", "status", "troubleshooting", "faq"],
  },
  {
    title: "Reference",
    blurb: "Every command, every route, every variable. The things you look up rather than read.",
    slugs: ["cli", "checks", "api", "api-usage", "versions", "environment", "glossary"],
  },
  {
    title: "Why it works this way",
    blurb:
      "Decision records. Written when the decision was made, so they say what was " +
      "actually traded rather than what sounds good afterwards.",
    slugs: ["grammar-adr", "paas-adr", "scaling-adr"],
  },
];

/**
 * Is this doc withheld from publication? A `draft: true` / `private: true` /
 * `public: false` line in the frontmatter keeps a file out of the public site
 * (and the dashboard's docs list). The pipeline publishes every docs/*.md
 * unconditionally otherwise — no flag anywhere — so this is the one gate that
 * stops an internal runbook or pricing note dropped into docs/ from being
 * built, listed, and put in the sitemap on the next deploy.
 */
function isWithheld(file: string): boolean {
  try {
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.startsWith("---")) return false;
    const end = raw.indexOf("\n---", 3);
    if (end === -1) return false;
    const fm = raw.slice(3, end);
    return (
      /^\s*(?:draft|private)\s*:\s*true\b/m.test(fm) ||
      /^\s*public\s*:\s*false\b/m.test(fm)
    );
  } catch {
    return false;
  }
}

/** Every doc that ships, whether or not a group names it. Withheld drafts excluded. */
export function allDocs(): string[] {
  let files: string[];
  try {
    files = fs.readdirSync(docsDir());
  } catch {
    // No docs/ where we looked — usually a build run from the wrong cwd (both
    // consumers resolve docs/ as cwd/../docs). Warn rather than silently ship
    // an empty docs section with every wikilink left as dead brackets.
    console.warn(`[docs-index] no docs directory at ${docsDir()} — docs section will be empty`);
    return [];
  }
  return files
    .filter((f) => f.endsWith(".md"))
    // The repo's own README is about building this project, not about the
    // product; it is for GitHub, not for the docs section.
    .filter((f) => f !== "README.md")
    // Nor is the licence summary: it is the repository's (each package ships
    // its own LICENSE and LICENSING.md).
    .filter((f) => f !== "LICENSING.md")
    .filter((f) => !isWithheld(path.join(docsDir(), f)))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/** Grouped, with anything ungrouped gathered at the end rather than lost. */
export function groupedDocs(): DocGroup[] {
  const all = allDocs();
  const named = new Set(GROUPS.flatMap((g) => g.slugs));
  const rest = all.filter((s) => !named.has(s));
  const groups = GROUPS.map((g) => ({ ...g, slugs: g.slugs.filter((s) => all.includes(s)) })).filter(
    (g) => g.slugs.length,
  );
  if (rest.length) {
    groups.push({ title: "More", blurb: "Everything else that ships in docs/.", slugs: rest });
  }
  return groups;
}

export function docTitle(raw: string, slug: string): string {
  return raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug.replace(/-/g, " ");
}

/** The first real paragraph — not a heading, table row, list item or fence.
 *
 *  Returned as prose, not as markdown. It is used as a card subtitle and, on
 *  the public site, as the <meta name="description"> — the sentence a search
 *  result shows. Leaving the source's own markup in it meant paas-adr.md
 *  advertised itself as "Sequels [[scaling-adr]], which said *when* to move
 *  state" in Google, so the inline markers are stripped here rather than in
 *  either renderer. */
export function docSummary(raw: string, limit = 200): string {
  const body = raw.replace(/^#\s+.+$/m, "").trim();
  // Skip what is not prose: a heading, a table, a quote, a fenced block, a
  // list item. A LONE backtick is not one of those — docs/cli.md opens with
  // "`foldrun` needs no account", and excluding every paragraph that starts
  // with one left that doc with no summary at all, which on the public site
  // is an empty <meta name="description">.
  const para = body
    .split(/\n\s*\n/)
    .find((p) => p.trim() && !/^(#|\||>|```|[-*+] |\d+\. )/.test(p.trim()));
  const prose = plainText(para ?? "").replace(/\s+/g, " ").trim();
  // Cut on a word boundary and say so, rather than stopping mid-word.
  if (prose.length <= limit) return prose;
  const cut = prose.slice(0, limit);
  return cut.slice(0, cut.lastIndexOf(" ")).trimEnd() + "…";
}

/** Inline markdown, as a person reads it: no brackets, stars or backticks. */
function plainText(md: string): string {
  return md
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[doc]] → doc
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](href) → text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_([^_\n]+)_(?![\w_])/g, "$1");
}
