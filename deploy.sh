#!/bin/sh
set -eu
# Commit source changes before running. Publish exactly the committed dist tree.
if [ -n "$(git status --porcelain -- dist)" ]; then
  echo 'Commit changes in dist/ before deploying.' >&2
  exit 1
fi
git push origin main
deploy_tree=$(git rev-parse HEAD:dist)
if git fetch origin gh-pages; then
  deploy_parent=$(git rev-parse FETCH_HEAD)
  deploy_commit=$(git commit-tree "$deploy_tree" -p "$deploy_parent" -m 'Deploy PDF OCR site')
else
  deploy_commit=$(git commit-tree "$deploy_tree" -m 'Deploy PDF OCR site')
fi
git push origin "$deploy_commit:refs/heads/gh-pages"
