#!/usr/bin/env bash
# دیپلوی دستی با rsync (لینوکس/WSL): DEPLOY_HOST=IP DEPLOY_USER=user npm run deploy
set -euo pipefail
: "${DEPLOY_HOST:?DEPLOY_HOST را تنظیم کن}"
: "${DEPLOY_USER:?DEPLOY_USER را تنظیم کن}"
npm run build
rsync -az --delete -e "ssh -p ${DEPLOY_PORT:-22}" dist/ "$DEPLOY_USER@$DEPLOY_HOST:${DEPLOY_PATH:-/var/www/biznesyar}/"
