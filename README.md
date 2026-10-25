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

## The shell is a near-copy of foldrun-site's

`src/layouts/Page.astro`, `src/lib/site.ts` and `src/styles/global.css` are
about seventy lines of header, footer and type, duplicated on purpose: the two
sites are separate projects on separate domains, and sharing a component would
mean sharing a build. When one changes, change both — they are meant to look
like one product.

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
