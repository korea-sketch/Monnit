#!/bin/sh
# 맞춤 제안서 v3 — 별도 페이지 방식(v2)에서 쓰던 파일 정리
# 저장소 최상위(Monnit-main)에서 실행:  sh 맞춤제안서-이전파일-삭제.sh
# v2 파일을 올린 적이 없다면 실행하지 않아도 됩니다(없는 파일은 건너뜀).
set -e
for f in proposal.html proposal-status.html \
         js/proposal-apply.js js/proposal-status.js js/proposal-bridge.js \
         css/proposal.css; do
  if [ -e "$f" ]; then
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then git rm -q "$f"; else rm "$f"; fi
    echo "삭제: $f"
  fi
done
rmdir css 2>/dev/null || true
# v2 가 페이지 끝에 넣었던 bridge 스크립트 줄이 남아 있는지 확인
grep -l "proposal-bridge.js" *.html */index.html 2>/dev/null && echo "↑ 위 파일에서 proposal-bridge.js 줄을 지워 주세요" || echo "bridge 스크립트 참조 없음 — 정리 완료"
