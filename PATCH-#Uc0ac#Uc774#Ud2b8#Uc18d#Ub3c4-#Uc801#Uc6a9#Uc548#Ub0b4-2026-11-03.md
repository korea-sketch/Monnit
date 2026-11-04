# 사이트 속도 전면 개선 · 알리미 계약 시작일 자동 · 제안서 작업 오류 수정 (2026-11-03)

## 1. 사이트 속도

| 항목 | 이전 | 이후 |
|---|---|---|
| 본문 콘텐츠(시트) 도착 | 약 3.0~3.6초 | 약 0.8초 |
| 첫 방문자 Apps Script 대기 | 1~3초 | 없음 |
| 홈 화면 그리기 | 기본값으로 1번 + 시트로 1번 더(내용이 바뀌며 나타남) | 시트가 0.4초 안에 오면 1번만 |
| /promo/remote 처럼 끝 슬래시 없는 주소 | 301 로 한 번 더 왕복 | 바로 응답 |
| 분석·광고 스크립트(약 700KB) | `<head>` 에서 즉시 | 페이지가 다 뜬 뒤(최대 3초) — 이벤트 누락 없음 |
| 글꼴(Pretendard) | jsDelivr 외부 CDN | 우리 사이트에서 직접(`/fonts/pretendard/`) |
| JS·CSS | 원본 그대로 전송 | 배포 때 dist 사본만 압축(app.js −20%, style.css −18%) |
| 알리미 랜딩 상단 사이렌 이미지 | 1254px·214KB, 지연 로딩(LCP 6.9초) | 520px·51KB, 우선 로딩 |
| 알리미 랜딩 팝업 이미지 4장 | 처음부터 받음(최대 361KB) | 1280px로 줄이고 열 때만 |
| 고객사 로고 16개 | 최대 3948px | 600px (840KB → 567KB) |
| 원격관제 랜딩 영상·포스터 | 720p 712KB · 76KB | 480p 473KB · 43KB (공유용 og:video 는 원본 유지) |
| 영상 캐시 | 규칙 없음 | 하루 캐시 |

로컬 Lighthouse(같은 조건 비교): 홈 0.62 → 0.70, 알리미 랜딩 0.57 → 0.72 (LCP 6.7초 → 3.5초), 전체 전송량 홈 2.27MB → 1.93MB.
30개 주요 페이지를 이전/이후로 띄워 화면 글자·오류·요청 실패를 비교 — 차이 없음(실시간 데모 숫자 제외).

### 바뀐 파일
- `app.js` — 공개 화면 Apps Script 확인 생략, 미리 받은 시트 재사용, 홈은 한 번만 그리기
- `index.html` 외 SPA 셸(faqs·our-solution·what-we-do·whitepaper·newsletter·proposal) — `<head>` 시트 선요청, 팝업 이미지 WebP·지연
- `js/monnit-consent.js` (?v=113, 27개 페이지) — 분석 스크립트를 load 뒤에
- 글꼴 링크 26개 파일 — jsDelivr → `/fonts/pretendard/pretendardvariable-dynamic-subset.css` (새 폴더 `fonts/`)
- `cloudflare/prepare.mjs` — dist 의 JS·CSS 압축(esbuild). 끄려면 Cloudflare 빌드 변수 `MINIFY=0`
- `package.json` · `package-lock.json` — esbuild 추가
- `cloudflare/sheets-cache.mjs` — 지역 보관본이 없으면 R2 의 마지막 정상본을 즉시 응답
- `cloudflare/worker.mjs` · `server/edge/block-ip.js` — 차단 목록 읽기를 설정값 읽기와 동시에
- `cloudflare/site.mjs` — 폴더 주소 슬래시 없이 와도 바로 응답(상대 경로를 쓰는 /church 는 예전처럼 이동)
- `_headers` — `/videos/*` 캐시
- `promo-alarm.html` · `promo/alarm/index.html` — 이미지 로딩 순서
- `promo-remote.html` · `promo/remote/index.html` · `source/remote-monitoring/build_landing.py` — 480p 영상·포스터
- 이미지(같은 파일명으로 크기만 줄임): `images/clogo-*.png`, `images/alarm/ta-siren.webp`, `images/alarm/ta-modal-intro-*.webp`, `images/img-10.jpg`, `images/img-11.jpg`
- 새 파일: `assets/proposal/factory-event-prompt.webp`, `images/remote/poster-480.jpg`, `videos/promo-remote-480.mp4`

## 2. 알리미 계약 — 시작일을 고객 제출일로 자동

- 계약 관리 화면(「계약 링크 만들기」)에 **「계약 시작일 = 고객이 계약서를 제출하는 날 (자동)」** 체크가 생겼고 기본으로 켜져 있습니다.
- 켜 두면 링크에는 의무 이용기간(1·2·3년)만 담기고, 고객이 계약서를 발급받는 순간 한국 날짜로 시작일이 정해집니다.
  종료일 = 시작일 + 기간 − 1일 (예: 2026-11-03 제출, 3년 → 2026-11-03 ~ 2029-11-02)
- 고객 화면에는 「계약서 제출일부터 3년 (오늘 제출 시 … ~ …)」으로 보입니다. 발급 뒤 계약서·관리 화면·먼데이에는 확정 날짜가 들어갑니다.
- 같은 링크로 정보를 고쳐 다시 발급해도 처음 제출한 날짜는 그대로입니다.
- 체크를 끄면 예전처럼 날짜를 직접 정합니다. 이미 보낸 링크는 예전 방식 그대로 동작합니다.
- 바뀐 파일: `server/functions/alarm.mjs`, `contract-admin.html`, `contract.html`

## 3. 「proposal-build: All jobs have failed」 메일 (10분마다)

- 원인: 10-29 Netlify 제거 때 코드가 `server/` 로 옮겨졌는데, `.github/workflows/proposal-build.yml` 만 옛 상태라
  ① `server/` 폴더를 받지 않고 ② 지워진 `register.mjs` 를 불러 매번 13초 만에 실패했습니다.
  (Finder 는 `.github` 같은 숨김 폴더를 덮어쓰지 않아 이 파일만 빠진 것으로 보입니다)
- 수정: `.github/workflows/proposal-build.yml`
- **꼭 확인**: 숨김 폴더라 Finder 로 덮어쓰면 또 빠질 수 있습니다. GitHub 웹에서 이 파일을 직접 열어 고치거나,
  Finder 에서 `Cmd + Shift + .` 로 숨김 파일을 보이게 한 뒤 덮어써 주세요.
- 배포 뒤 /ops/proposals 에서 그동안 멈춰 있던 제안서(생성 실패) 건을 확인해 주세요. 오래된 건은 고객에게 늦게 나가지 않도록 보류·삭제를 판단해 주세요.

## 적용 순서
1. 압축을 풀어 저장소에 덮어쓰기 (숨김 폴더 `.github` 포함 — 위 3번 참고)
2. 커밋 → Cloudflare 가 자동 빌드·배포 (빌드 로그에 「JS·CSS 압축 29개」 줄이 보이면 정상)
3. 배포 뒤 확인: 홈 · /promo/alarm · /promo/remote · /contract-admin 에서 새 계약 링크 1건 만들어 보기
