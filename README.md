# foldrun-docs

**docs.foldrun.io.** The documentation: the markdown, the grouping, and the
static site that publishes them.

```bash
npm install
npm run dev      # http://localhost:4340
npm run check    # types, including the .astro files
npm run build    # → dist/, plain HTML
```

## The markdown at the root is the source

`agents.md`, `flows.md`, `api.md` and the rest sit at the top of this repo
because they are what an engineer reads in a checkout. Three renderers stand
over them and none of them copies:

| where | who reads it |
|---|---|
| this Astro site | anyone, signed in or not |
| the dashboard's `/dashboard/docs` | people who have signed up |
| a checkout | whoever is in the code |

That is the whole reason the docs are their own repo. Four tests in
`foldrun-web/tests/consistency.test.ts` fail the build when `api.md` stops
naming a route that exists, or when a flow option is parsed and undocumented.
A second copy of these files would render perfectly and be outside every one
of those tests.

## index.ts is the editorial part

Which docs a person needs first, and in what order, is not derivable from the
directory — so `index.ts` holds the grouping, plus the rules for reading a
title and a summary out of the markdown. The dashboard imports the same file
through a tsconfig alias. Adding `foo.md` and naming it in a group puts it in
the sidebar of both, with no other change.

## The look is @foldrun/ui, shared with foldrun.io

The shell (header, footer, theme switch), the prose, code panels, cards and
the tokens come from [`@foldrun/ui`](https://github.com/foldrun-io/foldrun-ui),
the components foldrun.io uses too — a git dependency pinned to a tag in
`package.json`. This repo keeps its words and links (`src/lib/site.ts`), the
docs layout (`src/layouts/Docs.astro`) and three small pieces built from the
shared ones (`src/components/`: the sidebar, the page outline, previous and
next). A change to the look is a change in foldrun-ui, then a new tag here.
`npm run check` also runs `foldrun-ui-check-native` over `src/` and the
markdown: no browser-native controls.

## Environment

Set at the host (the Cloudflare Pages project), never committed. Each default
is written once, in `src/lib/site.ts`.

| Variable | What it is | Default if unset |
|---|---|---|
| `PUBLIC_DOCS_URL` | this site's own origin — canonical URLs, the sitemap | `https://docs.foldrun.io` |
| `PUBLIC_SITE_URL` | foldrun.io, for the links back | `https://foldrun.io` |
| `PUBLIC_APP_URL` | the dashboard: Sign in, Get started, the sign-up switches | `https://dash.foldrun.io` (production sets `https://dev.foldrun.io` until dash exists) |
| `PUBLIC_STATUS_API` | the footer's status dot | `https://dev.foldrun.io/api/status` |

## Git hooks

Problems are caught before the push, not in CI or the deploy. `.githooks/` is
versioned here and `npm install` (its `prepare` runs `sh .githooks/install.sh`) points `core.hooksPath` at it.

- **pre-commit** (seconds, staged files only): gitleaks with the deploy gate's
  config (`../foldrun-infra/.gitleaks.toml`), `node --check` on `.mjs`,
  `bash -n` + `shellcheck -S error` on `.sh`, YAML parse.
- **pre-push** (what CI and the deploy gate run): gitleaks over the commits being
  pushed and the pushed tree, then `astro check` and `astro build`. The checks run on a
  detached worktree of the pushed commit beside this checkout (sharing its
  `node_modules`), so uncommitted work here neither hides a failure nor
  causes one.

Hooks only read; they never format, stash or reset. Emergency bypass:
`SKIP_HOOKS=1 git push` (or `--no-verify`) — and say why in the commit or PR.
