#!/bin/bash
# 홈을 덮었던 랜딩 잔재와, 게이트를 우회해 공개돼 있던 제안 가이드 PDF 를 지웁니다.
# 저장소 루트에서 실행하세요:  bash 삭제할-파일.sh
set -e
for t in "pdm-guide 2" "monnit-promo-proposal" "guide.pdf"; do
  if [ -e "$t" ]; then
    git rm -r --cached --ignore-unmatch "$t" >/dev/null 2>&1 || true
    rm -rf "$t"
    echo "  삭제: $t"
  else
    echo "  (없음): $t"
  fi
done
echo
echo "완료 — pdm-guide 2/ = 홈을 덮었던 랜딩 + 공개 PDF"
echo "       monnit-promo-proposal/ = 옛 랜딩 사본 + 공개 PDF"
echo "       guide.pdf = 루트 공개 PDF"
