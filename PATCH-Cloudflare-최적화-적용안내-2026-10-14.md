# Cloudflare 이전 후 검수·최적화 (2026-10-14)

## 고친 것

| 구분 | 문제 | 조치 |
|---|---|---|
| 관제 오류 | /ops 통계, 유입·경로, 차단 관리, 알림함 등이 Cloudflare 무료 플랜 CPU 한도(요청당 10ms)를 넘겨 자주 실패(오류 1102) | ① 날짜 형식기를 매번 새로 만들던 코드(건당 0.1ms × 수천 번)를 재사용하도록 Worker 전체에 적용 (`cloudflare/intl-cache.mjs`), 자주 쓰는 `kday` 는 산술 계산으로 교체 — /ops/data 약 350ms → 5~8ms<br>② 유입·경로는 서버가 원장 원문만 보내고 집계는 관제 화면(브라우저)이 같은 코드로 계산 (`/ops/flow/raw`). 실패하면 예전 방식으로 자동 전환<br>③ 방문 기록 90일 정리는 한 시간에 한 번만 |
| 사이트 속도 | 모든 페이지가 구글 시트 18개 탭을 「캐시 금지」로 따로 불러옴(페이지당 18번) | `/api/sheets` 한 번으로 묶고 Cloudflare 가장자리에 보관(60초마다 뒤에서 갱신, 구글 실패 시 마지막 정상본). 시트 수정은 1~2분 안에 반영, 바로 보려면 주소 뒤에 `?fresh=1` |
| 깨진 이미지 | 시트 SiteContent 의 `images/…`(앞에 / 없음) 경로가 /case/… 페이지에서 /case/images/… 로 불려 404 | 사이트 기준 경로(/images/…)로 고정 |
| 외부 이미지 | 블로그·사례 이미지 일부가 외부 사이트(pngtree, wallpaperflare)에서 막혀 깨진 그림 표시 | 깨진 그림 대신 자리만 남김(아래 「시트에서 바꿀 것」 참고) |
| 이전 마무리 | DNS 전파 중 Netlify 로 들어온 요청이 따로 저장됨 · http 가 https 로 안 바뀜 · AI 가 회사명에 말끝(「~고」)을 붙임 | Netlify→Cloudflare 중계(`netlify/edge-functions/a-relay-cf.js`), http→https, 회사명 말꼬리 정리, /ops/migrate 「새 항목만」 |

app.js 버전 211 → 212.

## 시트에서 바꿀 것 (코드로는 못 고침)
아래 이미지는 원 사이트가 외부 사용을 막고 있습니다. 저작권 문제도 있으니 자체 이미지로 바꾸세요.
- Blog 탭: png.pngtree.com 이미지 3개
- Cases·Blog 탭: c1.wallpaperflare.com 이미지 1개

## 반영 후 확인
1. GitHub Desktop 에서 Commit → Push (Cloudflare·Netlify 자동 배포)
2. 5분 뒤 monnit.co.kr/ops, /ops/flow, /ops/block, /ops/notices 열어 숫자가 나오는지
3. /ops/migrate → 「이미 여기 있는 항목은 덮어쓰지 않기」만 체크 → 복사 시작
