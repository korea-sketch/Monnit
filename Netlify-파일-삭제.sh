#!/bin/bash
# Netlify 전용 파일·폴더를 지웁니다. (함수 코드는 server/ 로 옮겨졌습니다)
# 저장소 루트에서 실행하세요:  bash Netlify-파일-삭제.sh
set -e
if [ ! -d "server/functions" ]; then
  echo "server/functions 가 없습니다 — 새 파일을 먼저 덮어쓴 뒤 실행하세요."; exit 1
fi
for t in "netlify" "netlify.toml" "cloudflare/netlify-compat" "cloudflare/migrate.mjs" \
         "cloudflare/actions/alias-loader.mjs" "cloudflare/actions/register.mjs"; do
  if [ -e "$t" ]; then
    git rm -r --cached --ignore-unmatch "$t" >/dev/null 2>&1 || true
    rm -rf "$t"
    echo "  삭제: $t"
  else
    echo "  (없음): $t"
  fi
done
echo
echo "완료 — netlify/            → server/ 로 이동됨 (functions · edge · lib)"
echo "       netlify.toml        → cloudflare/site-rules.toml (리다이렉트·헤더만)"
echo "       netlify-compat/     → server/lib/blobs.mjs · cloudflare/site.mjs"
echo "       migrate.mjs 등      → Netlify 이관용, 더 이상 필요 없음"
