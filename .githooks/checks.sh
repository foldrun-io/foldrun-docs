# shellcheck shell=bash
# What pre-push runs in this repo, after the gitleaks scans in pre-push.
# Mirror CI (.github/workflows) and the box deploy gate; keep it read only.
# .github/workflows/ci.yml runs the same list; the site build is what Cloudflare Pages runs. The
# build goes to a temp dir so dist/ is left as it was.
repo_checks() {
  step "astro check" npx --no-install astro check
  step "astro build (to a temp dir)" astro_build
}
astro_build() { local d rc; d=$(mktemp -d); npx --no-install astro build --outDir "$d/out"; rc=$?; rm -rf "$d"; return $rc; }
