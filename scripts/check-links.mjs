#!/usr/bin/env node
// Every link inside the built site lands: the page exists, and so does the
// heading or element its #anchor names. Run over a build directory:
//
//   node scripts/check-links.mjs dist
//
// Links that leave the site (https:, mailto:) are not fetched. Seven links
// had quietly gone dead before this ran on every push — five of them into
// the check rules' sections, the anchors `foldrun check` prints.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
if (!fs.existsSync(root)) {
  console.error(`check-links: no build at ${root}`);
  process.exit(2);
}

const files = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.add(path.relative(root, p).split(path.sep).join("/"));
  }
})(root);

/** The built file a site path is served from, or null. */
function page(p) {
  const rel = p.replace(/^\/+/, "");
  for (const c of [rel, `${rel.replace(/\/$/, "")}/index.html`, `${rel}.html`, rel === "" ? "index.html" : null]) {
    if (c !== null && files.has(c)) return c;
  }
  return null;
}

const idsCache = new Map();
function ids(file) {
  if (!idsCache.has(file)) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const bad = [];
for (const file of [...files].filter((f) => f.endsWith(".html")).sort()) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  for (const [, raw] of html.matchAll(/\shref="([^"]*)"/g)) {
    const href = decode(raw);
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;
    const [pathPart, frag] = href.split("#", 2);
    const clean = pathPart.split("?")[0];
    const target = clean === "" ? file : page(clean.startsWith("/") ? clean : path.posix.join("/", path.posix.dirname(file), clean));
    if (!target) {
      bad.push(`${file} → ${href} (no such page)`);
      continue;
    }
    if (frag && target.endsWith(".html") && !ids(target).has(decodeURIComponent(frag))) bad.push(`${file} → ${href} (no #${frag} on ${target})`);
  }
}

if (bad.length) {
  console.error(`check-links: ${bad.length} link(s) land nowhere:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-links: every link in ${files.size} files lands`);
