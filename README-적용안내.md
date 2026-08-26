# 모넷코리아 사이트 업데이트 — 알리미 4종 + 홈/프로모션 개편 (2026-08-26)

zip 안의 파일을 **Monnit-main 저장소에 그대로 덮어쓰기(병합)** 하고 커밋하면 끝입니다.
⚠️ images/ 폴더는 절대 "대치" 하지 말고 **병합**으로 넣어주세요.

## 이번 변경 사항

### 1) 홈 히어로 — 두 줄 고정 (웹/모바일)
- "보이지 않는 위험까지 / 데이터로 관리합니다" 가 어떤 화면 폭에서도 정확히 두 줄로 나옵니다.
- 변경 파일: `index.html`(제목 마크업), `style.css`(줄바꿈 고정 + 모바일 크기 조정)

### 2) 프로모션 페이지 인트로 문구
- /promotions 진입 시 가장 먼저 읽히는 문구 추가:
  "필요한 건 제품이 아니라, 맞는 방법이니까. / 먼저 살피고, 필요한 순간 알립니다."
- 변경 파일: `index.html`, `style.css`

### 3) 레지던스 카드 카피 변경 (app.js)
- 제목: "누수 걱정 없는 레지던스 생활을 시작하세요"
- 설명: "싱크대와 세탁기, 보일러 주변에 누수 알림 센서를 설치하면 물샘을 빠르게 감지해 앱으로 알려드립니다. 큰 피해로 번지기 전에 미리 대비하세요."
- ※ 구글시트(PROMOS)에 residence 행을 만들면 시트 값이 우선합니다 — 시트에서 관리하려면 같은 문구로 입력하세요.

### 4) 알리미 4종 구독 프로모션 (신규)
- `promo-alarm.html` + `images/alarm/`(9개) + `images/promo-alarm.webp/.jpg`(카드·OG)
- /promotions 맨 앞 NEW 카드 → 클릭 시 `/promo/alarm` 진입 (app.js·build.js·netlify.toml)
- 8/26 오픈 · 마감일 없음(상시). 내릴 때: app.js alarm 항목에 end 지정 또는 삭제
- 시트(PROMOS)에 alarm 행이 없어도 내장값으로 노출됩니다 (시트에 행을 만들면 시트 우선 = 에디터로 관리 가능)
- 접수 연동: StaticForms→Web3Forms→메일 폴백 (홈페이지와 동일 규격·동일 키, korea@monnit.com 수신)
  + MonnitLead.record → /ops 리드 원장 (접점 promo_alarm)
  + GA4 generate_lead / dataLayer lead_submit / Clarity 이벤트 (Consent Mode v2)

### 5) 프로모션 페이지들 하단 링크 정비
- promo-residence.html / promo-consulting.html: 상단·하단에 "산업별 제안서"(/whitepaper) 링크 추가

## 검수 완료 항목 (로컬 전체 빌드 + 브라우저 실측)
- node build.js 정상 (117페이지 · sitemap 129 URL · /promo/alarm 물리 라우팅 생성)
- 홈 히어로 두 줄: 데스크톱 + 390px 모바일 확인
- /promotions: 인트로 문구 → 알리미 NEW 카드(1번) → 레지던스 새 카피 순 노출 확인
- /promo/alarm/: 이미지 절대경로 전환 후 전부 로드, 팝업/바텀시트/폼 검증 동작 확인
- MonnitLead·Consent·dataLayer 로드 확인

## 포함 파일
index.html · style.css · app.js · build.js · netlify.toml ·
promo-alarm.html · promo-residence.html · promo-consulting.html ·
images/alarm/(9) · images/promo-alarm.webp · images/promo-alarm.jpg
