// The built site, served for the visual suite (FOL-196): plain files from
// SITE, `/x/` → `/x/index.html`, nothing else. No dependency, so the
// Playwright image needs nothing installed to serve it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.env.SITE || "/site");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(body);
  });
}).listen(Number(process.env.PORT || 4399), "127.0.0.1");
