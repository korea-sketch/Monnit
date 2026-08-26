# /promotions/flame-reservation — 직링크 전용 전환 (2026. 8. 5. 병합됨)

이 소스에는 아래 패치가 이미 적용되어 있습니다. 그대로 배포만 하면 됩니다.

## 바뀐 파일 3개
- **app.js** — 프로모션 목록 그리드·"현재 N건 진행 중" 카운트에서 flame-reservation 제외
  (직링크 열람 경로인 openPromo 는 건드리지 않음 → 주소 직접 입력 시 정상 동작)
- **build.js** — sitemap.xml · 프로모션 텍스트 안내 페이지에서 제외,
  상세 정적 페이지에 noindex,nofollow 메타 주입 (페이지 생성 자체는 유지)
- **_headers** — /promotions/flame-reservation 에 X-Robots-Tag: noindex, nofollow

## 배포 후 확인 (시크릿 창)
1. monnit.co.kr/promotions → flame-reservation 카드 없음
2. monnit.co.kr/promotions/flame-reservation 직접 입력 → 정상 오픈 (신청 폼 포함)
3. monnit.co.kr/sitemap.xml 에서 "flame-reservation" 검색 → 0건

※ robots.txt 에는 일부러 넣지 않았습니다 — 적으면 오히려 경로가 노출됩니다.
※ 이 폴더에서 `node build.js` 실행·검증 완료 (정적 117페이지, sitemap 128 URL, 오류 없음)

## 캐시 자동 갱신 (2026. 8. 5. 추가)
방문자가 강제 새로고침을 안 해도 새 버전을 받도록 `app.js?v=117 → v=118` 로
버전을 올렸습니다 (119개 페이지 전부). 배포하면:
- 처음 오는 사람: 바로 새 버전
- 전에 왔던 사람: 페이지(HTML)는 no-cache 라 항상 새로 받고, 그 HTML이
  v=118 을 가리키므로 app.js 도 자동으로 새로 받습니다. 강제 새로고침 불필요.

※ 앞으로도 app.js 를 고치면 index.html 의 ?v= 숫자를 하나 올리고 배포하세요.
  (안 올리면 이번처럼 최대 1시간 + 재방문 시점까지 옛 파일이 보입니다)
