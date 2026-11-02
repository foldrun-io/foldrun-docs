# One CI/CD for every repo

*2–3 Nov 2026. Status: **built**. Owner's goal: every repo has its own
high-end CI/CD, consistent, DevSecOps, versioned and tagged the way top SaaS
do it, old images pruned, registries audited. The home box is gone; CI/CD
runs on hosted services only. Owner's split (2 Nov): **private repos on
CircleCI** (its free plan), **public repos on GitHub Actions** (free and
unlimited for them, npm provenance only there, fork-safe).*

## The same gate in every repo

Two files decide what every repo's CI does, the same bytes everywhere, synced
from foldrun-infra by `dev/ci/repo-ci/sync.sh` (infra's own checks fail when
a sibling drifts):

| File | What |
|---|---|
| `.githooks/checks.sh` | the repo's own suites — what pre-push runs (each repo's own) |
| `.githooks/security.sh` | the security gate (identical everywhere) |

`security.sh`, every repo, every push:

| Stage | Tool (pinned) | Fails on |
|---|---|---|
| secrets | gitleaks 8.30.1, the deploy gate's rules (`.githooks/gitleaks.toml`) | a secret in the pushed commits or the tree |
| SAST | Semgrep CE 1.171.0 (typescript, nodejs, secrets) | an ERROR-severity finding |
| dependencies | npm audit (what ships), `npm audit signatures` | high or critical; a registry signature that does not verify |
| SBOM | CycloneDX (`@cyclonedx/cyclonedx-npm` 6.0.1), per app | — (kept as a CI artifact) |

It refuses to report clean when its containers cannot see the repo (a scan
of an empty mount passes). Not CodeQL: its free licence covers OSI-licensed
code only, and FSL-1.1 is not.

| Repo | Visibility | CI | CD |
|---|---|---|---|
| core, cli | public | GitHub Actions: tests + `security` | npm release (release PR → publish, provenance), GitHub Actions |
| platform, web, docs | public | GitHub Actions: tests + `security` | ship in the dev release (CircleCI, infra) |
| admin | private | CircleCI: `checks` (hosted build) + `security` | ships in the dev release |
| site, brand | private | CircleCI: `checks` + `security` + `release` | Cloudflare Pages |
| deck | private | CircleCI: `checks` (secrets) + `security` | — |
| infra | private | CircleCI: `checks` (its checks.sh, terraform validate, IaC scan, gitleaks) | the dev pipeline, CircleCI |

Private repos' `.circleci/config.yml` is generated from one template
(`dev/ci/repo-ci/circleci.yml.tmpl`). Secrets live in two CircleCI contexts:
`foldrun-dev` (the deploy, restricted to foldrun-infra on `main`) and
`foldrun-ci` (restricted to the four private repos' projects).

GitHub access is the **foldrun-bot GitHub App**, not a person's token
(3 Nov 2026). Each step mints an installation token (`contents: write`, one
hour, `dev/ci/gh-app-token.sh`), and git asks for it through a credential
helper, so no token sits in a remote URL. The token carries `contents` and
`workflows: write` (a tag over changed workflow files needs the latter). The
one thing the App cannot do is push to GHCR, which takes no App token: that
login alone uses `FOLDRUN_GHCR_TOKEN` in `foldrun-dev`.
AWS is OIDC (no keys); images are signed keyless (CircleCI OIDC).
Fork pull requests to public repos run with no
secrets.

## The dev pipeline (foldrun-infra, CircleCI)

One serialized `deploy` job does the whole transaction: decide (the six
repos' main against the pin) → every suite, both end to end runs, the scan,
the migration guard → images built, scanned (Trivy), tagged, published,
signed (cosign keyless, CircleCI OIDC) and SBOM-attested → the pin pushed →
Cloudflare, the guarded apply over SSM (deferred while runs are live), the
smoke → `deployed/<v>` and `dev/applied` — or the roll back. An `apply` job
takes a person's own overlay pushes and the daily drift check. Schedules: a
tick every 30 min, the drift check at 20:23 UTC.

## Versions and tags

| What | Scheme | Tag |
|---|---|---|
| core, cli (npm) | SemVer | `vX.Y.Z` + GitHub Release (release PR) |
| the platform (dev) | CalVer | `vYYYY.MM.DD.N` on infra (+ `deployed/vX` once up) |
| platform, web, docs, admin, core | the platform release they shipped in | `release/vYYYY.MM.DD.N` on the exact commit (`dev/ci/dev/tag-components.sh`) |
| site, brand | CalVer of the commit Pages serves | `release/vYYYY.MM.DD.N` once checks and security pass on main |
| the HTTP API | dated (`Foldrun-Version`) | — |

## Images

Every deployment pins by digest (dev-aws; postgres and redis too). Retention
(`image-retention.yml`, GitHub Actions — the registry is GitHub's; by hand,
dry run first): never a deployed or pinned version, `latest`, `stable`; with
each kept image its children and cosign referrers; private images 30 days,
public 90; validate after. First cut 2 Nov 2026: 366 old versions, no image
broken, dev's pins still resolve and verify.
