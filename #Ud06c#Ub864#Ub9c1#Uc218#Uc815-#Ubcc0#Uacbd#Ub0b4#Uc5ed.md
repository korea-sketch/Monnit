# 크롤링 진단서 반영 — 변경 내역

작업일: 2026-08-07 · 기준 문서: `monnit_크롤링_진단_수정지시서.md`

진단서 항목을 실제 코드베이스와 하나씩 대조해 **재현되는 문제만** 고쳤습니다.
재현되지 않은 항목은 아래 "고치지 않은 것"에 이유를 적었습니다.

---

## 고친 것

### 1. canonical 이 홈으로 잡히던 5개 페이지 — 진단서 P0-2 (사실)

`_redirects` 가 아래 경로를 `index.html` 로 그대로 내보내고 있었습니다.
그래서 5개 모두 title·description·canonical 이 홈페이지 값이었고,
구글은 "이 URL 의 정본은 홈"으로 해석해 홈에 통합했습니다.

```
/our-solution  /what-we-do  /faqs  /whitepaper  /newsletter
```

**수정** — `build.js` 에 5개 페이지 생성 로직 추가 (§4-9).
다른 11개 라우트와 동일하게 고유 title·description·canonical·og + 고유 본문을 갖습니다.
본문은 index.html 의 실제 화면 내용을 그대로 옮겨 적었습니다(창작 아님).
`/faqs` 에는 FAQPage 구조화 데이터도 넣어 검색결과에 질문·답변이 펼쳐질 수 있게 했습니다.
동시에 `_redirects` 의 SPA 폴백 규칙에서 이 5개를 제거했습니다.

| 경로 | 변경 전 canonical | 변경 후 |
|---|---|---|
| /our-solution | `https://monnit.co.kr/` | `https://monnit.co.kr/our-solution` |
| /what-we-do | `https://monnit.co.kr/` | `https://monnit.co.kr/what-we-do` |
| /faqs | `https://monnit.co.kr/` | `https://monnit.co.kr/faqs` |
| /whitepaper | `https://monnit.co.kr/` | `https://monnit.co.kr/whitepaper` |
| /newsletter | `https://monnit.co.kr/` | `https://monnit.co.kr/newsletter` |

---

### 2. 프로모션 상세 7개가 전부 같은 HTML — 진단서 P1-1 (사실)

`/promotions/*` 가 모두 `promo.html` 한 장을 받고, 내용은 JS 가 URL 을 읽어
브라우저에서 주입하는 구조였습니다. 크롤러는 JS 실행 전 HTML 만 보므로
프로모션 6~7개가 **같은 빈 페이지 1개**로 보였습니다.
og:image 도 전부 `promo-fire.jpg` 라, 교회 프로모션을 카톡에 공유하면 화재 이미지가 떴습니다.

**수정** — `build.js` 에 slug 별 정적 페이지 생성 추가 (§4-8-b).
`/promotions/{fire,flame,water,elect,church,soil}/index.html` 을 빌드 때 미리 만듭니다.

- slug 별 고유 title·description·canonical·og:url·og:image·twitter 카드
- 프로모션 제목·설명·기간·핵심 혜택·연락처를 **정적 HTML** 로 본문 최상단 출력
- 종료된 프로모션은 자동으로 `noindex,follow` 처리 + 사이트맵 제외
- 디자인·신청 폼·구글 시트 연동은 기존 promo.html 그대로 (건드리지 않음)

`promo.html` 에는 경로에서 프로모션 ID 를 읽는 `pidFromPath()` 를 추가했습니다.
`?id=fire` 뿐 아니라 `/promotions/fire` 같은 깔끔한 주소에서도 올바른 내용이 뜹니다.

---

### 3. 페이지 간 98% 중복 — 진단서 P1-2 (사실)

SSG 페이지는 `index.html` 껍데기를 재사용하는데, 그 안에 홈·제품·회사소개 등
**모든 화면(`<section class="view">` 19개)** 이 통째로 들어 있었습니다.
결과적으로 모든 경로가 서로 98% 동일한 HTML 을 내보내 중복 판정을 받았습니다.

**수정** — `build.js` 의 `stashShellViews()` 신규 함수.
크롤러가 받는 HTML 에서 뷰 19개를 `<script type="text/html">` 안으로 옮깁니다.
스크립트 내용은 문서 텍스트로 취급되지 않으므로, 각 페이지에는
**[네비게이션 + 그 페이지 고유 본문 + 푸터]** 만 남습니다.

브라우저에서는 바로 뒤 부트스트랩이 `app.js` 보다 먼저 원래 DOM 을 복원합니다.
뷰 안의 인라인 스크립트 3개(홈 솔루션 파인더 등)도 script 요소를 새로 만들어
다시 실행시키므로, 사람이 보는 화면과 SPA 동작은 **이전과 완전히 동일**합니다.

측정 결과 (크롤러가 읽는 텍스트 기준):

| 페이지 | 변경 전 | 변경 후 |
|---|---|---|
| /knowledgebase | 약 28,600자 | 1,359자 |
| /products | 약 28,600자 | 4,006자 |
| /our-solution | — | 2,357자 |
| /app/{60건} | 약 28,600자 | 1,500자 내외 |

홈(`index.html`)은 건드리지 않았습니다 — 홈은 뷰가 그대로 있어야 합니다.

---

### 4. robots.txt — 명시한 봇 전부가 차단 경로를 크롤 가능 (사실, 실제 버그)

robots.txt 규칙상 크롤러는 자기 이름 블록을 찾으면 `User-agent: *` 블록을
**완전히 무시**합니다. 기존 생성 로직은 봇별 블록에 `Allow: /` 만 넣어서,
명시한 AI 봇 16종 모두에게 `/editor`, `/church` 차단이 **적용되지 않고** 있었습니다.

**수정** — `build.js` 의 robots 생성부.
- 공통 `Disallow` 를 25개 블록 전체에 반복 출력
- 신규 봇 추가: `Google-CloudVertexBot`, `Google-NotebookLM`, `Meta-ExternalFetcher`,
  `DuckAssistBot`, `MistralAI-User`, `Applebot`, `Yeti`(네이버), `Daum`(카카오)

> **첨부해 주신 robots.txt 와 한 곳 다르게 했습니다.**
> 첨부본에는 `Disallow: /pages/` 가 있었는데 넣지 않았습니다.
> `/pages/*.html` 는 구 URL 을 새 경로로 **301 리다이렉트하는 통로**입니다(134개 규칙).
> 여기를 막으면 크롤러가 301 을 따라가지 못해, 지금까지 쌓인 색인·링크 평가가
> 새 주소로 이전되지 못하고 끊깁니다. 색인에 노출되는 페이지도 아니므로
> 차단 이득은 없고 손해만 있습니다.

---

### 5. sitemap.xml 헤더 명시 — 진단서 P0-1 (일부)

저장소의 `sitemap.xml` 은 정상 ASCII XML 이었습니다(바이너리 아님).
즉 파일 문제가 아니라 **서빙 단계**의 문제입니다. 진단 도구가 압축 응답을
풀지 못했을 가능성이 큽니다. 방어적으로 헤더를 명시했습니다.

`netlify.toml` · `_headers` 양쪽에 추가:
```
/sitemap.xml
  Content-Type: application/xml; charset=utf-8
  Cache-Control: public, max-age=0, must-revalidate
```
캐시를 끈 이유 — 사이트맵이 캐시되면 새 페이지를 추가해도 크롤러가
낡은 사본을 계속 받습니다.

사이트맵 URL 도 **101 → 108개** 로 늘었습니다 (신규 5 + 프로모션 6, 종료분 제외).

---

### 6. 중복 URL · 메타 정리 — 진단서 P2 (일부)

- `/privacy` 와 `/privacy.html`, `/installation-photos` 와 `.html` 이 둘 다 200 응답
  → 확장자 없는 주소를 정본(.html)으로 **301** (`_redirects`)
  ※ 정본을 `.html` 쪽으로 잡은 이유: 이미 canonical·사이트맵이 `.html` 이라
    바꾸면 재색인이 필요합니다. 지금 상태가 이미 자기 일관적입니다.
- `installation-photos.html` — og:* 태그가 전혀 없어 카톡·페북 공유 시 미리보기가 비어 있었습니다.
  og / twitter 카드 8종 추가. title 도 "The Field Review" → 검색어가 들어간 한글 제목으로 변경.

---

## 고치지 않은 것 (재현 안 됨 / 고치면 손해)

| 진단서 항목 | 판단 |
|---|---|
| P0-1 sitemap 바이너리 응답 | 저장소 파일은 정상 XML입니다. 서빙 헤더만 방어적으로 명시했습니다. 배포 후 시크릿 모드로 직접 확인 필요 |
| P2 /privacy canonical 불일치 | canonical(`/privacy.html`) 과 사이트맵이 이미 일치합니다. 중복 URL 만 301 로 정리 |
| P2 /installation-photos 메타 누락 | title·description·canonical 은 이미 있었습니다. **없던 것은 og:\* 뿐** — 그것만 추가 |
| P2 /whitepaper 구버전 셸 | 저장소에는 한국어 16종이 정상적으로 있습니다. 배포된 파일만 낡은 것이므로 **재배포하면 해결**됩니다. 코드 수정 불필요 |
| P3 수치 불일치 | 저장소에서는 `64,000+` / `750억` 으로 일관됩니다. `90K+`, `72억+` 는 재현되지 않았습니다. 페이지 title 의 `88`, `45`, `73` 은 국내 실적으로 지표가 다른 값이라 불일치가 아닙니다 |
| `/promo/consulting` → `/promotions/consulting` 통일 | **일부러 두었습니다.** promo-consulting.html 은 이미 고유 title·description·canonical 을 갖춘 정상 페이지이고, 광고·QR 이 이 주소를 쓰고 있습니다. 경로만 바꾸면 재색인 리스크만 생기고 얻는 게 없습니다 |
| robots.txt `Disallow: /church` | `/promotions/church` 는 경로 시작이 달라 차단되지 않습니다. 교회 QR 랜딩(`/church/`)은 의도적 noindex 이므로 그대로 유지 |

---

## 추가 — /promo/consulting 화면 지적 2건 (대표님 피드백)

### A. 회전설비 통합관제 표 정렬 깨짐

원인이 두 가지 겹쳐 있었습니다.

1. **모바일 격자가 `auto`** — `.vx-fr{grid-template-columns:9px minmax(0,1fr) auto auto auto}`
   상태 배지 칸이 내용 길이대로 잡혀서, "비정상"(3자) 행과 "주의"(2자) 행의 폭이 달라졌습니다.
   → 그 뒤 수치·온도 칸이 **행마다 다른 x좌표**에 놓여 세로줄이 어긋났습니다.
2. **설비명이 두 줄로 접힘** — "컨베이어 L-03" → "컨베이 / 어 L-03", "컴프레서 C-01" → "컴프레 / 서 C-01"
   → 그 행만 높아져 위아래 행과 어긋났습니다.

**수정** — 고정폭 격자 + 이름 한 줄 고정

```css
.vx-fr{grid-template-columns:9px minmax(0,1fr) 48px 70px 40px;gap:8px;padding:10px 11px}
.vx-fn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vx-fb{padding:4px 0;text-align:center}
.vx-frms,.vx-ft{white-space:nowrap}
```

칸 폭이 모든 행에서 같아지므로 배지·수치·온도가 **자동으로 한 줄에 정렬**됩니다.
좁은 화면에서 이름이 잘리지 않도록 ≤420px, ≤360px 단계를 추가로 넣었습니다.

가용폭 계산 (컨테이너 padding 체인 반영, 최장 이름 "컨베이어 L-03" 기준):

| 뷰포트 | 이름칸 폭 | 필요 폭 | 결과 |
|---|---|---|---|
| 620px | 303px | 81px | 여유 |
| 430px | 129px | 81px | 여유 |
| 390px | 124px | 75px | 여유 |
| 375px | 109px | 75px | 여유 |
| 360px | 116px | 71px | 여유 |
| 320px | 76px | 71px | 여유 |

카드 헤더의 범례도 "비정상 / 1" 처럼 항목 **안에서** 끊기던 것을
`white-space:nowrap` 으로 항목 사이에서만 접히게 했습니다.

같은 컴포넌트가 `/our-solution` 에도 쓰이므로 `style.css` 에도 동일하게 적용했습니다.

### B. 드롭다운 글씨가 안 보임

`select` 에 어두운 배경 + 밝은 글자색만 지정돼 있었습니다.
**Windows Chrome/Edge 는 펼쳐진 목록을 시스템 밝은 배경으로 그리면서 글자색만
select 에서 상속**받습니다. 그래서 흰 글씨가 흰 배경에 묻혀 선택지가 하나도 안 보였습니다.
(사업장 지역 · 주요 회전설비 두 개 모두 해당)

**수정** — 목록의 배경과 글자색을 **함께** 고정

```css
select option, select optgroup{ background:#FFFFFF; color:#15192E; }
```

- `promo-consulting.html` — 신청 폼 (지적하신 곳)
- `promo.html` — 프로모션 공용 랜딩의 시설 선택
- `style.css` — 전역 규칙 추가. 배터리 수명 계산기, 솔루션 파인더, 홈 상담 폼의
  select 도 같은 구조라 같은 증상이 있었습니다. 이미 `.band .inline-form select option`
  에 같은 처방이 개별 적용돼 있었는데(과거에 한 번 겪었던 것으로 보입니다),
  이번에 전역으로 올려 재발을 막았습니다.

입력 안내문(placeholder) 대비도 함께 조정했습니다.

> `style.css` 를 고쳤으므로 `index.html` 의 `style.css?v=111` → **`?v=112`** 로 올렸습니다.
> 안 올리면 재방문자 브라우저가 캐시된 옛 CSS 를 계속 써서 수정이 반영되지 않습니다.

---

## 변경 파일

```
build.js                    로직 수정 4곳 (robots / SSG 5개 / 프로모션 / 셸 격납)
promo.html                  경로에서 프로모션 ID 인식 + 드롭다운 글씨색
promo-consulting.html       통합관제 표 정렬 + 드롭다운 글씨색  ← 대표님 지적 2건
style.css                   통합관제 표 정렬 + 드롭다운 글씨색(전역)
index.html                  style.css?v=111 → 112 (캐시 무효화)
installation-photos.html    og·twitter 태그 추가, title 개선
netlify.toml                sitemap.xml 헤더
_headers                    sitemap.xml 헤더
```

빌드로 자동 생성되는 것(직접 수정 불필요):
`robots.txt` · `sitemap.xml` · `_redirects` · `404.html` · `llms.txt` · `llms-full.txt`
· 라우트별 `index.html` 98개 · `/promotions/*/index.html` 6개

---

## 검증한 것

`SHEET_SOURCE=off node build.js` 로 빌드 후 jsdom 으로 실제 DOM 을 만들어 확인했습니다.

- 5개 페이지 canonical 이 각자 경로를 가리킴 ✓
- 프로모션 6개가 서로 다른 title·canonical·og:image 를 가짐 ✓
- 셸 격납 후 브라우저에서 `<main>` 안 view **19개 전부 복원** ✓
- 격납 payload 가 원본 index.html 의 view 와 **바이트 단위 완전 일치** ✓
- 뷰 안 인라인 스크립트 3개가 복원 후 **정상 실행** ✓
- `#ssg-content` · 푸터 · 상단 네비 · 중첩 섹션(`#mhTwin`) 모두 보존 ✓
- robots.txt 25개 블록 전부에 Disallow 적용, `/pages/` 차단 없음 ✓
- 빌드 산출물 98 페이지, 사이트맵 108 URL ✓

---

## 배포 후 할 일

1. 시크릿 모드에서 `https://monnit.co.kr/sitemap.xml` 열어 **XML 텍스트가 보이는지** 확인
   (여기서도 깨져 보이면 Netlify 압축 설정 문제 — 별도 확인 필요)
2. Search Console → 색인 → Sitemaps → **재제출**, "가져올 수 있음" 확인
3. 네이버 서치어드바이저 → 요청 → 사이트맵 제출
4. URL 검사 도구로 `/our-solution`, `/faqs`, `/promotions/church` 개별 검사 →
   "URL 이 Google 에 등록되어 있음" 확인
5. `/whitepaper` 가 한국어 16종으로 뜨는지 확인 (재배포로 해결되는 항목)
6. 2~4주 뒤 색인된 페이지 수 추이 확인

### 하나 더 (선택)

프로모션 og:image 중 fire 만 `.jpg`, 나머지 5개는 `.webp` 입니다.
카카오톡 공유 미리보기는 webp 를 못 읽는 경우가 있으니,
`/images/promo-{flame,water,elect,church,soil}.jpg` 를 만들어 두면 공유 카드가 안정적입니다.
파일을 넣으면 `build.js` 의 `PROMO_SEO` 에서 확장자만 바꾸면 됩니다.
