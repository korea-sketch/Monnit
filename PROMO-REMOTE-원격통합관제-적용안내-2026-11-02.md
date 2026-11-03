# 건물 원격 통합 관제 — 랜딩 발행 + 프로모션 등재 (2026-11-02)

광고 영상 「원격 통합 관제」(10.29 최종) 클릭 후 도착하는 페이지를 `/promo/remote/` 로 올리고,
`/promotions` 목록 맨 앞에 썸네일 카드로 등재합니다.

새 서비스도, 새 환경변수도 없습니다. 사이트에 있는 규격(`monnit-consent` · `monnit-lead` · `valid` · `/api/lead` · Brevo)만 씁니다.

---

## 1. 흐름

```
광고 영상 · /promotions 카드 · 검색(sitemap·llms.txt)
              ↓
        /promo/remote/
   관제 대상 → 위험 감지 → 즉시 알림 → 통합 관제 → 왜 무선 → 도입 절차 → 설치 사례 → FAQ → 문의
              ↓
   폼 (회사·기관명 · 담당자명 · 연락처 필수 / 이메일 · 건물 수 · 설비 · 문의내용 · 동의)
              ↓
   ① MonnitLead.submit → /api/lead
        · 리드 원장(ops)            접점 promo_remote · 관심분야 「건물 원격 통합 관제」
        · 먼데이 리드 보드           관심분야 라벨 「건물 원격 통합 관제」
        · 담당자 메일               1015@monnit.com + 대표님 (기존 contact 정책 그대로)
        · 고객 접수 확인 메일        Brevo — 이메일을 남긴 경우만 (아래 4절)
        · 메타 전환 API(서버)        메타 이벤트ID 로 브라우저 픽셀과 중복 제거
   ② 서버가 응답하지 않으면 StaticForms → Web3Forms → 메일 앱 순 (레지던스 랜딩과 동일)
              ↓
   MonnitLead.track('contact') → dataLayer lead_contact · GA4 generate_lead · Clarity · 메타 Lead
```

---

## 2. 바뀐 · 추가된 파일

### 발행 대상

| 파일 | 내용 |
|---|---|
| `promo-remote.html` | **신규** — 랜딩 원본 (72 KB, 이미지·영상은 파일로 분리) |
| `promo/remote/index.html` | 위 파일 사본 — `build.js` 가 매 빌드 자동 생성 (같이 커밋해 둠) |
| `videos/promo-remote.mp4` | **신규** — 히어로 영상 720px · 무음 · 18초 (700 KB) |
| `images/remote/*.jpg` | **신규** — 영상에서 뽑은 장면 6장 (poster · zones · alert · worker · platform · phone) |
| `images/remote/refs/*.jpg` | **신규** — 현장 설치 사진 10곳 × 3장 + 썸네일 10장 (드롭박스 「제안서 자료 취합/…/현장 설치 사진」 원본을 축소) |
| `images/promo-remote.webp` · `.jpg` | **신규** — 프로모션 카드 썸네일 1200×675 |
| `images/promo-remote-og.jpg` | **신규** — 링크 미리보기 1200×630 |

### 배선

| 파일 | 내용 |
|---|---|
| `app.js` | `BUILTIN_PROMOS` 에 `remote` 추가(order 1) · 나머지 2~6 으로 한 칸씩 |
| `editor.html` | `BUILTIN_PROMO_ROWS` 동기화 — 순서 패널에 썸네일과 함께 나옴 |
| `i18n.js` | 카드 제목·기간·설명 영문 3줄 |
| `build.js` | `/promo/remote` 사본 생성기 · 필수 파일 점검 목록 · sitemap · llms.txt 「무료 서비스·신청」 |
| `_redirects` | `/promo/remote` 200 · `/promo-remote(.html)` · `/promotions/remote` · `/remote-monitoring` 301 |
| `_headers` | `/promo/remote` no-cache (광고 소재와 함께 고치므로) |
| `sitemap.xml` | `/promo/remote/` 한 줄 (빌드가 어차피 다시 씀) |
| `server/functions/health.mjs` | 15분 자동 점검에 등록 — 폼·리드 스크립트·GTM·영상 경로·접점 중 하나라도 빠지면 ops 「사이트 상태」 빨간불 |
| `server/functions/_monday.mjs` | 관심분야 라벨 「건물 원격 통합 관제」 규칙(알리미·누수 규칙보다 먼저) |
| `server/functions/_supportmail.mjs` | 고객 접수 확인 메일 종류 `remote` 추가 |

### 원본 보관

`source/remote-monitoring/` (공개 폴더 아님 — prepare.mjs 가 빼고 `/source/*` 는 404)

| 파일 | 용도 |
|---|---|
| `landing_template.html` | 랜딩 본문 원본 (claude.ai 미리보기 판과 같은 파일) |
| `build_landing.py` | 위 원본 → `promo-remote.html` 생성 (머리말·SEO·폼 전송 코드·FAQ 를 끼워 넣음). `python3 source/remote-monitoring/build_landing.py` |
| `thumb/thumbnail.html` | 카드 썸네일·OG 이미지 원본 (Playwright 로 1200×675 / 1200×630 캡처) |
| (광고 원본 4K 영상) | 33 MB 라 저장소에는 넣지 않았습니다. 장면을 다시 뽑을 때만 원본에서 ffmpeg 로 추출 |

---

## 3. 프로모션 카드

| 항목 | 값 |
|---|---|
| id | `remote` |
| 제목 | 여러 건물 주요 설비 원격 통합 관제 |
| 배지 | NEW |
| 기간 자리 | 무료 현장 진단 · 배선 공사 없는 무선 설치 |
| 링크 | `/promo/remote` |
| 시작 / 종료 | 2026-11-02 / 없음(상시) |
| 순서 | 1 (원격관제 1 · 알리미 2 · 예지보전 3 · modbus 4 · 레지던스 5 · 사전예약 6) |

시트(Promotions 탭)에 `remote` 행을 만들면 시트 값이 우선합니다. 에디터에서 「↕ 순서 바꾸기」로 옮길 수 있습니다.
`link` 가 `/promo/` 로 시작하므로 `/promotions/remote` 상세는 만들지 않고 301 로 정본에 보냅니다. `PROMO_SEO` 에 넣지 마십시오.

---

## 4. 이메일

| 받는 사람 | 무엇 | 경로 |
|---|---|---|
| 담당자 | 접수 알림 1통 | `/api/lead` → `_route.mjs` (1015@monnit.com + 0702yeom@) · 서버 실패 시 브라우저 StaticForms/Web3Forms |
| 고객 | 접수 확인 메일 | `_supportmail.mjs` kind `remote` — 「건물 원격 통합 관제 문의를 받았습니다」 + 진행 순서 3단계 · 답장 주소 korea@monnit.com |

고객 메일은 **이메일을 남긴 경우에만** 나갑니다(연락처만 필수). 시간 약속 문구는 넣지 않았습니다.
끄려면 `SUPPORT_MAIL_OFF=1`(기술지원 접수 확인 메일과 함께 꺼짐). 발송 기록은 ops `automail-YYYYMM` 에 `support-ack:remote` 로 남습니다.

---

## 5. 마케팅 측정

- `monnit-consent`(GTM-T8H73VW, Consent Mode v2) · `monnit-lead` · `monnit-track` 만 씁니다. **gtag config · fbq init 직접 호출 없음** (페이지뷰 중복 방지)
- dataLayer 이벤트

| 이벤트 | 시점 |
|---|---|
| `monnit_form_open` | 폼에 처음 들어감 |
| `lead_contact` | 접수 성공 — **주 전환** (MonnitLead.track → GA4 generate_lead · 메타 Lead · Clarity) |
| `lead_submit` | 접수 성공 — form_name `promo_remote`, buildings, zones 동봉 |
| `monnit_contact` | 전화·메일 클릭 — method `tel`/`email`, cta 위치 |

- UTM·클릭ID 는 `MonnitLead.source()` 가 「출처」로 원장에 남깁니다. 광고 URL 예: `/promo/remote/?utm_source=meta&utm_medium=paid&utm_campaign=remote_1029`

---

## 6. SEO · GEO

| 항목 | 내용 |
|---|---|
| title · description · keywords · canonical | `/promo/remote/` 정본 |
| robots | index,follow · max-image-preview:large · max-video-preview:-1 |
| OG · Twitter | 1200×630 이미지 + og:video |
| JSON-LD `@graph` | WebPage · BreadcrumbList · Service · Organization(contactPoint) · VideoObject · FAQPage |
| 본문 FAQ | 7문항 (배선·감시 설비·알림 방식·정전·250개·통합 화면·비용) — FAQPage 와 같은 문장 |
| 화면 이동 경로 | 홈 › 프로모션 › 건물 원격 통합 관제 |
| sitemap · llms.txt · llms-full.txt | 등재 (빌드 생성) |
| `/promotions` 정적 스냅샷 | `pages/promotions.html` 에 자동 포함 (빌드 생성) |

FAQ·본문의 사양 표기는 고정 사실만 썼습니다 — 940MHz · 게이트웨이 반경 내 센서 250개 · 정전 시 2~3일 · 알림은 SMS·이메일·대시보드(음성 전화 없음) · 플랫폼 명칭 「iMonnit Scube 전용 플랫폼」. 가격은 넣지 않았습니다.

---

## 7. 검증 (로컬 wrangler dev 로 실제 구동)

| 항목 | 결과 |
|---|---|
| `node build.js` · `node cloudflare/prepare.mjs` | 오류 없음 · 필수 파일 점검 OK · 라우터 정합성 OK |
| `/promo/remote/` | 200 · Cache-Control no-cache · CSP 통과 |
| `/promo/remote` · `/promo-remote.html` · `/promotions/remote` · `/remote-monitoring` | 301 → `/promo/remote/` |
| 영상 · 이미지 · 썸네일 · 로고 | 전부 200 |
| `/promotions/` | 「여러 건물 주요 설비 원격 통합 관제」 카드가 맨 앞, 썸네일 표시, 링크 `/promo/remote` |
| 빈 폼 제출 | 회사·담당자·연락처 오류 표시, 전송 안 함 |
| 가짜 번호(010-1234-5678) | `valid.js` 가 막고 이유를 보여 줌 |
| 정상 제출 | `/api/lead` 204 → 원장에 `point:promo_remote · interest:건물 원격 통합 관제 · asset:제어반, EPS실` 저장 → 완료 화면 → `lead_contact` 발화 |
| health 필수 문자열 5개 | 빌드 결과물(주석 제거 후)에 모두 있음 |
| 중복 id · alt 없는 이미지 · JS 오류 | 0 · 0 · 0 |
| 390px 모바일 | 가로 넘침 없음 |

---

## 8. 올린 뒤 확인할 것

1. https://monnit.co.kr/promotions — 첫 카드가 이 프로모션이고 썸네일이 보이는가
2. 카드 → `/promo/remote/` 로 가는가 (`/promotions/remote` 아님)
3. 테스트 접수 1건(회사명에 「테스트」) → 1015@ 메일 · ops 리드 표 · 먼데이 아이템 · (이메일 넣었으면) 고객 확인 메일
4. **먼데이 리드 보드 「관심분야」 열에 `건물 원격 통합 관제` 라벨을 추가**하십시오. 없으면 아이템은 만들어지되 관심분야가 비어 들어갑니다(리드는 빠지지 않음)
5. ops 「사이트 상태」에 「광고 랜딩(원격 통합 관제)」가 초록불인가
6. GA4 실시간 페이지뷰 1회 · 메타 이벤트 관리자 Lead(브라우저+서버, 중복 제거)
7. 링크 미리보기(카카오톡·페이스북)에 OG 이미지가 뜨는가

## 9. 확인이 필요한 것

- 설치 사례 카드의 설명 문구·연도는 드롭박스 폴더명과 사진 파일 날짜로 적었습니다. 3M·CJ·ETRI 설명은 사진 내용 기준 추정입니다
- 「CJ 곤지암 메거허브」 → 「CJ대한통운 곤지암 메가허브」로 표기했습니다
- 고객사 현장 사진의 외부 공개 동의 여부
- `netlify/` 폴더의 옛 함수 사본은 손대지 않았습니다(배포 대상 아님)

*작성 2026-11-02 · 모넷코리아*

---

## 10. 재점검 후 고친 것 (2026-11-02 오후)

원본 저장소(Monnit-main 84)에 이 패치만 덮어쓴 상태에서 `build.js` → `prepare.mjs` → `wrangler dev` 로 다시 띄워 확인했습니다.

**「홈으로 가기」 버튼 추가** — 상단 바(PC: 아이콘+「홈으로 가기」, 모바일: 아이콘+「홈」), 접수 완료 화면, 하단 법적고지 줄 세 곳. 모두 `/` 로 갑니다.

**페이지뷰가 두 번 잡히던 것 (GTM)**
- 접수 완료 때 주소를 `?submitted=1#contact` 로 바꾸고 있었습니다 → GTM 기록 변경(`gtm.historyChange`)·GA4 향상된 측정이 `page_view` 를 한 번 더 보냄. 주소 변경을 없앴습니다.
- 메뉴(`#faq` 등)를 누를 때마다 주소의 `#` 가 바뀌어 같은 문제가 생길 수 있어, 주소는 그대로 두고 스크롤만 하도록 바꿨습니다.
- 확인: 접수까지 한 번 진행해도 `page_view` 1회.

**메뉴 이동 위치가 어긋나던 것** — 설치 사례 카드의 사진 칸이 인라인 요소라 크기가 고정되지 않아, 사진이 늦게 뜨면서 페이지가 420px 늘어나 FAQ 로 가는 스크롤이 중간에 멈췄습니다. 칸 크기를 고정하고 본문 이미지에 width·height 를 넣었습니다. 메뉴 4곳 모두 상단 바 바로 아래에 정확히 멈춤.

**GTM·측정 점검 결과 (쿠키 동의 후)**

| 항목 | 결과 |
|---|---|
| 콘솔 오류 · CSP 위반 · 4xx | 0 · 0 · 0 (/promo/remote · / · /promo/alarm · /promo/modbus 모두) |
| 컨테이너 | GTM-T8H73VW · G-49THHRYKR4 · AW-664353920 로드 |
| 동의 흐름 | 기본 denied → 「모든 쿠키 수락」 → consent update · 메타 픽셀 로드 |
| 전송 순서 | page_view → form_start → /api/lead 204 → generate_lead · dataLayer `lead_contact` |

Playwright 에 `ERR_ABORTED` 로 찍히는 collect 요청 3건은 응답(200/204)을 받은 뒤 본문을 버리는 비콘이라 오류가 아닙니다(기존 페이지도 같음).
로컬 주소(127.0.0.1)에서는 메타 픽셀의 `tr` 전송이 나가지 않아 브라우저 Lead 는 실제 도메인에서 이벤트 관리자로 확인하십시오(서버 전환 API 는 /api/lead 가 보냄).

## 11. 편집기 바로가기 링크 (2026-11-02)

`/ops/editor` 주소 뒤에 `#탭/ID` 를 붙이면 시트를 불러온 뒤 그 항목 편집 화면이 바로 열립니다.

- 원격 통합 관제 카드: https://monnit.co.kr/ops/editor#Promotions/remote
- 다른 프로모션: `#Promotions/alarm` · `#Promotions/consulting` · `#Promotions/modbus` …
- ID 대신 제목 일부도 됩니다: `#Promotions/원격`

관제 로그인이 안 된 상태면 로그인 후 링크를 한 번 더 여십시오(로그인 화면은 # 를 넘기지 않습니다).
시트 Promotions 탭에 `link · start · end` 열이 없으면 편집기가 자동으로 붙이고, 저장할 때 시트 머리글에도 기록합니다.

## 12. 카드 이름 변경 · 편집기 연동 보강 · 전화 바로 걸기 (2026-11-02)

- 카드 제목: 「여러 건물 주요 설비 원격 통합 관제」 → **「건물 주요 설비 통합 관제 솔루션」** (app.js · editor.html · i18n.js)
  ※ 편집기로 이미 시트에 저장했다면 시트 값이 우선하므로 편집기에서도 같은 제목으로 고쳐 주십시오.
- 편집기에서 카드의 모든 칸(제목·뱃지·기간·설명·썸네일·상세 이미지·HTML·링크·시작/종료일·순서·강제 종료)을 고칠 수 있습니다.
  시트 행의 링크·썸네일 칸이 비어 있으면 같은 id 의 내장값을 쓰도록 app.js · build.js 를 보강했습니다(제목만 고쳐 저장해도 카드가 랜딩으로 감).
- 랜딩 문의 영역: 전화번호·이메일을 누르면 바로 전화/메일 앱이 열리고 「복사」 버튼은 그대로 둠. 모바일(760px 이하·터치 기기)에는 「전화 걸기」 버튼 추가. 클릭은 dataLayer `monnit_contact` 로 잡힘.

## 13. 모바일 프로모션 버튼 · 홈 팝업 교체 (v5)

- **모바일 헤더**: 760px 이하에서도 「프로모션」 버튼 노출. 480px 이하는 아이콘형(주황 + 빨간 점)으로 바뀌고 헤더는 한 줄 유지. style.css?v=241
- **사이트 팝업**: js/monnit-popup.js를 「건물 주요 설비 통합 관제 솔루션」 카드형으로 교체 (id `remote-promo-2026-11-02`)
  - 링크: `/promo/remote/?utm_source=monnit.co.kr&utm_medium=popup&utm_campaign=remote_promo`
  - 전 HTML의 참조를 `monnit-popup.js?v=5`로 올려 캐시 갱신
  - 동작은 기존과 같음: 탭당 1회, 「오늘 하루 보지 않기」, 쿠키 배너 이후 노출, /promo/* 페이지 제외, ON/OFF는 /ops/flow 스위치
  - 되돌리기: `source/remote-monitoring/monnit-popup.v4-proposal-backup.js`를 js/monnit-popup.js로 복사
