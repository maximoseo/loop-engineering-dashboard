#!/usr/bin/env bash
# review-all.sh — run every available AI code reviewer over the current diff and
# print a consolidated report. Designed to be safe and non-blocking: any tool
# that is missing, unauthenticated, or errors is skipped with a clear note so a
# single broken reviewer never blocks the others (or a push).
#
# Usage:
#   scripts/review-all.sh                # review uncommitted (working-tree) changes
#   scripts/review-all.sh --base main    # review committed changes vs a base ref
#   scripts/review-all.sh --range A..B   # review an explicit commit range (CI)
#
# Keys are read from ~/.config/<tool>/config.json (local) or env vars (CI).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 0
MODE="uncommitted"; BASE=""; RANGE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="$2"; MODE="base"; shift 2 ;;
    --range) RANGE="$2"; MODE="range"; shift 2 ;;
    *) shift ;;
  esac
done

cfg() { # cfg <tool> <json-key>
  local f="$HOME/.config/$1/config.json"
  [ -f "$f" ] && python3 -c "import json,sys;print(json.load(open('$f')).get('$2','') or '')" 2>/dev/null || true
}

# Determine changed files + a git diff range for the reviewers.
case "$MODE" in
  base)  DIFF_ARGS="$BASE...HEAD"; FILES=$(git diff --name-only "$BASE"...HEAD) ;;
  range) DIFF_ARGS="$RANGE";        FILES=$(git diff --name-only $RANGE) ;;
  *)     DIFF_ARGS="";              FILES=$(git diff --name-only; git ls-files --others --exclude-standard) ;;
esac
CODE_FILES=$(echo "$FILES" | grep -iE '\.(ts|tsx|js|jsx|py|go|rb|java|rs|php|css)$' | sort -u)

echo "=================================================="
echo " AI code review — mode=$MODE  files=$(echo "$CODE_FILES" | grep -c . )"
echo "=================================================="
[ -z "$CODE_FILES" ] && { echo "No reviewable code files changed."; exit 0; }
echo "$CODE_FILES" | sed 's/^/  • /'

PROMPT="$(mktemp)"
cat > "$PROMPT" <<'EOF'
Senior reviewer. Report only concrete bugs, race conditions, security issues
(auth/secrets/injection), and correctness problems as "SEVERITY: file:line — problem — fix".
Skip style nits. If none, say "No issues".
EOF

run() { echo; echo "----- $1 -----"; }

# 1) Bito — per-file (headless, key-based)
run "Bito"
BITO_KEY="$(cfg bito api_key)"; : "${BITO_KEY:=${BITO_API_KEY:-}}"
if command -v bito >/dev/null && [ -n "$BITO_KEY" ]; then
  echo "$CODE_FILES" | while read -r f; do
    [ -f "$f" ] || continue
    out=$(timeout 200 bito -p "$PROMPT" -f "$f" -k "$BITO_KEY" 2>/dev/null | grep -vE '^Model in use|^\s*$')
    echo "$out" | grep -qiE 'No issues' && echo "  $f: clean" || { echo "  $f:"; echo "$out" | sed 's/^/    /'; }
  done
else
  echo "  skipped (no bito CLI or key)"
fi

# 2) CodeRabbit — whole-diff (key-based)
run "CodeRabbit"
CR_KEY="$(cfg coderabbit api_key_agentic)"; : "${CR_KEY:=${CODERABBIT_API_KEY:-}}"
if command -v coderabbit >/dev/null && [ -n "$CR_KEY" ]; then
  export CODERABBIT_API_KEY="$CR_KEY"
  if [ "$MODE" = base ]; then CR_ARGS="--base $BASE"; else CR_ARGS="--type uncommitted"; fi
  timeout 500 coderabbit review --plain --light $CR_ARGS 2>/dev/null | grep -vE '^\s*$|elapsed|What.s new|CodeRabbit CLI|update available|Run: coderabbit|Notice:|═|║|╔|╚|╗|╝|Making your bugs' | tail -40 || echo "  (no output / error)"
else
  echo "  skipped (no coderabbit CLI or key)"
fi

# 3) CodeAnt — headless JSON (needs `codeant login`; skips gracefully on 403)
run "CodeAnt"
if command -v codeant >/dev/null; then
  ca_args="--uncommitted"; [ "$MODE" = base ] && ca_args="--base $BASE"
  out=$(timeout 240 codeant review $ca_args --headless 2>&1)
  if echo "$out" | grep -qiE 'Access denied|login|403'; then echo "  skipped (run 'codeant login' once to enable)";
  else echo "$out" | python3 -c "import json,sys
try:
    d=json.load(sys.stdin); iss=d.get('issues') or d.get('findings') or []
    print('  issues:',len(iss))
    for i in iss[:20]: print('   ',i.get('severity','?'),i.get('file',''),i.get('message',i.get('title',''))[:120])
except Exception: print('  (no JSON findings)')" 2>/dev/null || echo "  (no findings)"; fi
else
  echo "  skipped (no codeant CLI)"
fi

# 4) Rafter — hardcoded-secret scan (local, headless). Triage: npm integrity
#    hashes and secret-scanner docs are known false positives.
run "Rafter (secrets)"
RF_KEY="$(cfg rafter api_key)"; : "${RF_KEY:=${RAFTER_API_KEY:-}}"
if command -v npx >/dev/null; then
  RAFTER_API_KEY="$RF_KEY" timeout 200 npx -y @rafter-security/cli -a secrets . 2>/dev/null \
    | grep -iE 'CRITICAL|HIGH|Total|No secrets|Found secrets|\.(ts|tsx|js|json|md|env)' | tail -25 \
    || echo "  (no output)"
else
  echo "  skipped (no npx)"
fi

# 5) Qodo — agentic review (needs QODO_API_KEY; best-effort)
run "Qodo"
QD_KEY="$(cfg qodo api_key)"; : "${QD_KEY:=${QODO_API_KEY:-}}"
if command -v npx >/dev/null && [ -n "$QD_KEY" ]; then
  QODO_API_KEY="$QD_KEY" timeout 300 npx -y @qodo/command run code_review -y -q --dir "$ROOT" 2>/dev/null | tail -25 \
    || echo "  skipped (qodo agent not configured — run 'qodo login' or add a code_review agent)"
else
  echo "  skipped (no qodo key)"
fi

# 6) Sourcery — Python only
run "Sourcery"
PY_FILES=$(echo "$CODE_FILES" | grep -iE '\.py$' || true)
if command -v sourcery >/dev/null && [ -n "$PY_FILES" ]; then
  timeout 200 sourcery review $PY_FILES 2>/dev/null | tail -25 || echo "  (sourcery errored)"
else
  echo "  skipped (no Python files changed)"
fi

rm -f "$PROMPT"
echo; echo "=================================================="
echo " Review complete. Findings above are advisory — fix real ones before merge."
echo "=================================================="
