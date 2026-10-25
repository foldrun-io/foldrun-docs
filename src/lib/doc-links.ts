// [[scaling-adr]] → a link, when a doc by that name actually ships.
//
// The docs cross-reference each other in the same [[ ]] the runtime resolves
// inside a workspace. Rendered as-is they are dead brackets on a public page.
// Rendered as links unconditionally they are worse: grammar-adr.md writes
// [[agent]] and [[flow:name]] as *syntax*, describing the format rather than
// pointing at anything, and every one of those would 404.
//
// So the rule is the one resolveDocLinks already uses: resolve what exists,
// leave the rest as prose. Membership is checked against the shipped docs, so
// this cannot drift from what /docs actually serves.
//
// Only `text` nodes are visited. That is what keeps [[agent]] inside a fence or
// backticks untouched — those parse to `code` and `inlineCode`, which carry
// their content as a string and are never descended into.

import type { MdastPluginDefinition } from "satteri";
import { allDocs } from "./docs.ts";

type Text = { type: "text"; value: string };
type Link = { type: "link"; url: string; title: null; children: Text[] };

// A markdown link to another doc is written relative — `[Runs](runs#test-runs)`
// — because the dashboard serves the docs as /dashboard/docs/<slug>, where
// that resolves to the right page. This site serves /<slug>/ with a trailing
// slash, where the same href resolved to /agents/runs: no such page, and the
// host answered with its fallback page instead of an error, so ~60 links were
// quietly dead. Here a link to a shipped doc becomes absolute.
const RELATIVE_DOC = /^(?:\.\/)?([a-z0-9][a-z0-9-]*)(?:\.md)?\/?(#.*)?$/;

const WIKILINK = /\[\[([^\]]+)\]\]/g;

// Annotated as the plugin type so `text`'s node and context are typed by the
// pipeline rather than by a hand-written guess at its shape.
export function docLinks(): MdastPluginDefinition {
  const shipped = new Set(allDocs());

  return {
    name: "foldrun-doc-links",
    text(node, ctx) {
      if (!node.value.includes("[[")) return;

      const out: (Text | Link)[] = [];
      let last = 0;
      let matched = false;
      let m: RegExpExecArray | null;
      WIKILINK.lastIndex = 0;

      while ((m = WIKILINK.exec(node.value))) {
        const slug = m[1].trim();
        if (!shipped.has(slug)) continue; // syntax, not a reference
        if (m.index > last) out.push({ type: "text", value: node.value.slice(last, m.index) });
        out.push({
          type: "link",
          url: `/${slug}/`,
          title: null,
          children: [{ type: "text", value: slug }],
        });
        last = m.index + m[0].length;
        matched = true;
      }

      if (!matched) return;
      if (last < node.value.length) out.push({ type: "text", value: node.value.slice(last) });
      ctx.replaceNode(node, out);
    },
    link(node, ctx) {
      const m = RELATIVE_DOC.exec(node.url);
      if (m && shipped.has(m[1])) ctx.setProperty(node, "url", `/${m[1]}/${m[2] ?? ""}`);
    },
  };
}
