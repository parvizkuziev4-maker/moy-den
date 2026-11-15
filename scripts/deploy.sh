#!/bin/sh
# Публикация на GitHub Pages: тесты → сборка → готовые файлы в ветку gh-pages.
# Запуск: npm run deploy
set -e
cd "$(dirname "$0")/.."

REPO_URL=$(git remote get-url origin)
REPO_NAME=$(basename -s .git "$REPO_URL")

npx tsc -b
npm run lint
npm test
BASE_PATH="/$REPO_NAME/" npm run build

cd dist
touch .nojekyll
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Публикация $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$REPO_URL" gh-pages
rm -rf .git
echo "Готово! Через минуту обновится: https://$(gh api user --jq .login).github.io/$REPO_NAME/"
