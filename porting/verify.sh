#!/usr/bin/env bash
#
# The gate. A port is not committed until this exits 0.
#
#   porting/verify.sh <slug>...
#   porting/verify.sh --all
#
# Every push to `web` goes live on GitHub Pages and there are no pull requests,
# so this stands in for human review. It automates the CLAUDE.md section 6
# checklist:
#
#   1. node --check on every script in the game folder
#   2. porting/check-<slug>.mjs, the port's own Node logic test
#      (required whenever the folder has a DOM-free core)
#   3. porting/lint-page.mjs   - the page against the CLAUDE.md rules
#   4. porting/smoke-test.mjs  - headless Chromium, 375px and desktop, both themes
#   5. the manifest is current, and the catalogue and folders agree
#   6. porting/check-concepts.mjs - every tag has a place in the concept graph
#      and every game a level, so the recommender can place a new game
#
# SKIP_SMOKE=1 drops step 4 for a machine with no browser. Use it only when you
# have checked the page another way; it is the step that catches a page that
# looks right in the source and is broken in a browser.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
cd "$REPO" || exit 2

if [ "$#" -eq 0 ]; then
  echo "usage: porting/verify.sh <slug>... | --all" >&2
  exit 2
fi

if [ "$1" = "--all" ]; then
  mapfile -t SLUGS < <(node -e '
    const src = require("fs").readFileSync("assets/games.js", "utf8");
    const w = {}; new Function("window", src)(w);
    for (const g of w.COOLMATHS.games) console.log(g.slug);
  ')
else
  SLUGS=("$@")
fi

FAILED=0
step() { printf "\n\033[1m== %s\033[0m\n" "$1"; }
fail() { printf "   \033[31mFAILED: %s\033[0m\n" "$1"; FAILED=1; }

# ---------------------------------------------------------- 1. syntax check

step "node --check"
for slug in "${SLUGS[@]}"; do
  if [ ! -d "$slug" ]; then
    fail "$slug/ does not exist"
    continue
  fi
  shopt -s nullglob
  scripts=("$slug"/*.js)
  shopt -u nullglob
  if [ ${#scripts[@]} -eq 0 ]; then
    echo "   $slug: no scripts"
    continue
  fi
  for f in "${scripts[@]}"; do
    if node --check "$f"; then
      echo "   ok   $f"
    else
      fail "$f does not parse"
    fi
  done
done

# ------------------------------------------------------- 2. core logic test

step "core logic tests"
for slug in "${SLUGS[@]}"; do
  check_script="porting/check-$slug.mjs"
  shopt -s nullglob
  cores=("$slug"/*-core.js "$slug"/*-game.js)
  shopt -u nullglob

  if [ -f "$check_script" ]; then
    if ! node "$check_script"; then
      fail "$check_script"
    fi
  elif [ ${#cores[@]} -gt 0 ]; then
    # CLAUDE.md: logic that is worth extracting into a core is worth testing.
    fail "$slug has a core (${cores[0]}) but no $check_script"
  else
    echo "   --   $slug has no core, no logic test required"
  fi
done

# ----------------------------------------------------------- 3. page lint

step "page lint"
if ! node porting/lint-page.mjs "${SLUGS[@]}"; then
  fail "porting/lint-page.mjs"
fi

# ---------------------------------------------------------- 4. smoke test

step "headless browser smoke test"
if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "   skipped (SKIP_SMOKE=1)"
else
  if ! node porting/smoke-test.mjs "${SLUGS[@]}"; then
    fail "porting/smoke-test.mjs"
  fi
fi

# ------------------------------------------------------- 5. manifest is current

step "manifest"
if ! node porting/build-manifest.mjs --check; then
  fail "porting/manifest.json is stale; run: node porting/build-manifest.mjs"
fi

# ------------------------------------------------------- 6. concept graph

step "concept graph"
if ! node porting/check-concepts.mjs; then
  fail "porting/check-concepts.mjs (a new tag needs an entry in assets/concepts.js; every game needs a level)"
fi

# ------------------------------------------------------------------ verdict

echo
if [ "$FAILED" -eq 0 ]; then
  printf "\033[32mPASS\033[0m  %s\n" "${SLUGS[*]}"
else
  printf "\033[31mFAIL\033[0m  see above\n"
fi
exit "$FAILED"
