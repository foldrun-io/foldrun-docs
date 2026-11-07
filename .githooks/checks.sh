# shellcheck shell=bash
# What pre-push runs in this repo, after the gitleaks scans in pre-push.
# Mirror CI (.github/workflows) and the box deploy gate; keep it read only.
# .github/workflows/ci.yml runs the same list; the site build is what Cloudflare Pages runs. The
# build goes to a temp dir so dist/ is left as it was.
repo_checks() {
  step "no native browser controls" npx --no-install foldrun-ui-check-native src *.md
  step "astro check" npx --no-install astro check
  step "astro build (to a temp dir) + every link lands" astro_build
}
# The build, then every link inside it lands (scripts/check-links.mjs).
astro_build() { local d rc; d=$(mktemp -d); npx --no-install astro build --outDir "$d/out" && node scripts/check-links.mjs "$d/out"; rc=$?; rm -rf "$d"; return $rc; }
