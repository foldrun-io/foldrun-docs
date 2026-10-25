# API versioning — the rule

Internal. Written for FOL-41, 18 Oct 2026, from what the code does. It is not
a plan.

## Where the version lives

- **A header, never the path.** The request header is `Foldrun-Version: YYYY-MM-DD`. Every response
  says which version answered it (`Foldrun-Version`). It also carries `X-Foldrun-Api`, the
  server's current version, and `X-Foldrun-Cli`, the CLI released with it. URLs stay
  `/api/…` for good.
- **Which version answers a request:**
  1. the header;
  2. else the account's pin, for an API key only;
  3. else the current version.

  The dashboard sends no header and never gets the pin, because it ships with the server.
- **An unknown or malformed header is a 400, never "current".** The body is
  `{ error, code: "unknown_api_version" | "bad_api_version", known: [...] }`. A pin that has
  been retired falls forward to current instead, so a stale setting cannot fail every request.

Code: `foldrun-web/server/api-version.ts` and `apiGate` in `server/api-limits.ts`.

## What counts as breaking

- **Breaking:** a field removed, renamed or retyped; a status code changed; a request field
  newly required; a route removed.
- **Not breaking:**
  - a new route;
  - a new optional field;
  - a new enum value in a list.

  Clients must ignore fields they don't know.

## How a breaking change ships

1. Add a `VersionChange` to `VERSION_CHANGES`, with a `downgrade` that gives older pins the old
   body. Answer the route through `versionedJson()`. Move `API_VERSION` in
   `server/release.ts` to that date.
2. `scripts/api-guard.mjs` (pre-push and CI) refuses an unversioned break of any field
   `server/openapi.ts` documents. So document a field before you rely on the guard for it.
3. Removing a route takes a `DEPRECATIONS` entry first, with a sunset at least 6 months out.
   Accounts that called it in the last 30 days are emailed. The route goes only after the
   sunset.
4. A version is answered for at least 12 months after the one that replaces it.

## The CLI

- **It pins.** It sends the `API_VERSION` it was built with (`foldrun-cli/src/commands.mjs`)
  on every call. It does not negotiate.
- **CLI older than the platform:** it works, because the platform downgrades bodies to its
  version. Once that version has been retired (after 12 months or more), every command
  stops with "no longer answers API X — npm i -g foldrun@latest".
- **CLI newer than the platform** (a self-hosted box or staging behind npm): every command
  stops with exit 1. It names the CLI released with that platform (from `X-Foldrun-Cli`).
  `foldrun version` asks with no header, so it still shows the platform and warns.
  Before 18 Oct 2026, `foldrun workspaces` printed "no workspaces" with exit 0 in this case.
- **Bumping the CLI's `API_VERSION`** is a release of the CLI that needs a platform
  answering that date. Ship the platform first, then the CLI.

## Proof

- **Web:** `tests/api-standards.test.ts` covers the 400 with `code` and `known`, the pin
  applying to keys only, and downgrades.
- **CLI:** `tests/cli-api-version-mismatch.test.ts` covers both directions, an older server
  that sends no `code`, and `foldrun version`.
- **Live (18 Oct 2026)**, with a CLI copy sending a version dev.foldrun.io does not know:
  - 2027-01-01: "older than the CLI … npm i -g foldrun@2.0.0", exit 1;
  - 2025-01-01: "no longer answers … npm i -g foldrun@latest".
