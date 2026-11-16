#!/usr/bin/env bash
# Bring the baselines a CI update run made into visual/baselines (FOL-196).
# Baselines are made on CI's Linux, never on a laptop: another OS draws
# fonts differently and every compare would fail.
#
#   GH_TOKEN=… bash scripts/visual-baselines.sh <run-id>
#
# <run-id>: a `ci` run started by hand (Actions → ci → Run workflow, on your
# branch) with "update the visual baselines" ticked. Then look at the new
# pictures, commit them with the change that made them, and say so.
set -euo pipefail
run=${1:?usage: GH_TOKEN=… scripts/visual-baselines.sh <run-id>}
: "${GH_TOKEN:?a GitHub token that can read the artifacts of this repository}"
REPO=${REPO:-foldrun-io/foldrun-docs}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
api() { curl -fsSL -H "authorization: Bearer $GH_TOKEN" -H "accept: application/vnd.github+json" "https://api.github.com/repos/$REPO/$1"; }
id=$(api "actions/runs/$run/artifacts" | python3 -c 'import sys,json; a=[x for x in json.load(sys.stdin)["artifacts"] if x["name"]=="visual"]; print(a[0]["id"] if a else "")')
[ -n "$id" ] || { echo "run $run has no visual artifact" >&2; exit 1; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
# The download redirects to storage that refuses the GitHub token: follow it bare.
loc=$(curl -fsS -o /dev/null -w '%{redirect_url}' -H "authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$REPO/actions/artifacts/$id/zip")
curl -fsSL -o "$tmp/a.zip" "$loc"
(cd "$tmp" && unzip -q a.zip)
n=$(find "$tmp/baselines" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] || { echo "run $run made no baselines (was it an update run?)" >&2; exit 1; }
rm -f "$ROOT/visual/baselines/"*.png
cp "$tmp/baselines/"*.png "$ROOT/visual/baselines/"
echo "visual: $n baselines from run $run in visual/baselines"
git -C "$ROOT" status --short -- visual/baselines
