#!/usr/bin/env bash
set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Try to format README and docs with Prettier if available
if command -v npx >/dev/null 2>&1; then
  echo "Running prettier on docs if available"
  npx prettier --write "README.md" "docs/**/*.md" || true
fi

if ! git diff --quiet; then
  git add -A
  git commit -m "chore: format docs via workflow"
  # Push back to the same branch
  git push origin "HEAD:main"
else
  echo "No changes to commit"
fi
