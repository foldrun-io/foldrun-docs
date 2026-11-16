#!/usr/bin/env bash
# The visual suite (FOL-196): key docs pages, light, dark and phone, against
# visual/baselines, in Microsoft's Playwright image so the browser and fonts
# are the same wherever it runs. Baselines are made by CI on Linux, never on
# a laptop (README → Visual baselines).
#
#   bash scripts/visual.sh <built-site-dir>                  # compare
#   VISUAL_UPDATE=1 bash scripts/visual.sh <built-site-dir>  # new baselines
#
# Shots go to visual-report/ (for a difference: <page>-actual.png,
# -expected.png, -diff.png) and an update's baselines to
# visual-report/baselines/ — CI uploads the folder as the `visual` artifact.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SITE=$(cd "${1:?usage: scripts/visual.sh <built-site-dir>}" && pwd)
V=${VISUAL_PLAYWRIGHT:-1.64.1}
OUT="$ROOT/visual-report"
rm -rf "$OUT"; mkdir -p "$OUT/baselines" "$ROOT/visual/baselines"
if [ "${VISUAL_UPDATE:-0}" = 1 ]; then
  flags="--update-snapshots=all"
else
  # A missing baseline fails; it is never written silently.
  flags="--update-snapshots=none"
  compgen -G "$ROOT/visual/baselines/*.png" >/dev/null || { echo "visual: no baselines in visual/baselines — make them with an update run (README)" >&2; exit 1; }
fi
# Copied in and out (docker cp), not bind-mounted: a Docker VM's file
# sharing (Colima on a Mac) can show a fresh folder empty.
cid=$(docker create --ipc=host -e "FLAGS=$flags" -e "UPDATE=${VISUAL_UPDATE:-0}" \
  "mcr.microsoft.com/playwright:v$V-noble" \
  bash -c "set -e; cd /work; npm init -y >/dev/null; npm i --silent @playwright/test@$V >/dev/null
    rc=0; npx playwright test -c visual.config.mjs \$FLAGS || rc=\$?
    if [ \"\$UPDATE\" = 1 ]; then cp baselines/*.png /reports/baselines/ 2>/dev/null || true; fi
    exit \$rc")
trap 'docker rm -f "$cid" >/dev/null 2>&1' EXIT
docker cp "$ROOT/visual/." "$cid:/work"
docker cp "$SITE/." "$cid:/site"
docker cp "$OUT/." "$cid:/reports"
rc=0; docker start -a "$cid" || rc=$?
docker cp "$cid:/reports/." "$OUT/"
exit $rc
