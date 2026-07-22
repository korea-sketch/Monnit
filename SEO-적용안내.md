# AI 크롤러 · SEO 적용 안내 (monnit.co.kr)

오전에 정리하신 5개 항목의 적용 상태와 배포 방법입니다.

## 적용 결과

| # | 항목 | 상태 | 파일 |
|---|------|------|------|
| 1 | 정적 HTML 프리렌더링 | ✅ 적용 | `build.js` → `pages/*.html` (13개), `noscript` 폴백(index.html) |
| 2 | robots.txt AI 봇 전면 허용 | ✅ 적용 | `robots.txt` (GPTBot·ClaudeBot·PerplexityBot·Google-Extended·CCBot 등 16종 Allow) |
| 3 | llms.txt / llms-full.txt | ✅ 적용 | `llms.txt`, `llms-full.txt` |
| 4 | 이미지 → 텍스트 병기 | ✅ 적용 | 모든 이미지 alt 텍스트 + 정적 페이지에 본문 텍스트 병기 |
| 5 | sitemap.xml + JSON-LD | ✅ 적용 | `sitemap.xml`, index.html 헤드에 Organization/WebSite/FAQPage, 정적 페이지에 Product/ItemList/Article/FAQPage |

## 프리렌더링 방식

해시 SPA(`#products`)는 크롤러에게 안 보이므로, `build.js`가 `app.js`의 콘텐츠 데이터(제품 51·활용분야 60·사례 8)를 읽어 **실제 경로의 정적 페이지**를 생성합니다:

- `/pages/company.html` — 회사 소개
- `/pages/products.html` — 제품 51종 (JSON-LD ItemList/Product)
- `/pages/solutions.html` — 활용 분야 60개
- `/pages/cases.html` + `/pages/case-*.html` — 도입 사례 8개
- `/pages/contact.html` — 상담·문의 (FAQPage)

이 페이지들은 JS 없이 전체 콘텐츠가 읽히며, sitemap.xml·llms.txt에 자동 포함됩니다. index.html의 `<noscript>`에도 이 페이지 링크를 넣어 무JS 봇이 탐색할 수 있습니다.

## 배포 방법 (Netlify)

1. `netlify.toml`이 포함되어 있어 **Build command = `node build.js`**, Publish dir = `.`로 자동 설정됩니다.
2. 배포 시 build.js가 실행되어 robots/sitemap/llms/pages를 최신 데이터로 다시 생성합니다.
3. 콘텐츠(제품·사례 등)를 Google Sheet에서 수정하면, 재배포(빌드) 시 정적 페이지도 함께 갱신됩니다.
   - 즉시 반영이 필요하면 Netlify에서 "Trigger deploy"만 눌러도 됩니다.

> 도메인: `build.js` 상단 `const SITE = 'https://monnit.co.kr'` 를 실제 대표 도메인으로 유지하세요. (현재 배포는 monnitj.netlify.app → 커스텀 도메인 monnit.co.kr 기준)

## 참고 — 추가로 하면 좋은 것

- Google Search Console / Bing Webmaster에 `sitemap.xml` 제출
- 커스텀 도메인(monnit.co.kr)이 확정되면 SITE 변수와 canonical 확인

---

# 2026-07 커버리지 확장 업데이트 (실도메인 점검 반영)

실제 monnit.co.kr 를 AI 크롤러 시점으로 점검한 결과를 반영해 build.js 를 확장했습니다.

## 변경 내역

| 항목 | 이전 | 이후 |
|---|---|---|
| 정적 페이지 | 13개 | **92개** |
| 활용 분야 | 목록 1페이지(한 줄 요약) | 목록 + **상세 60페이지** (고객 프로필·문제점·솔루션·도입 절차·ROI·도입 고객사) |
| 도입 사례 | 8건 (요약: 과제·지표만) | 8건 **전문** (적용 솔루션·성과·고객 인용 추가) |
| 지식베이스 | 봇에게 안 보임 | **215건 본문 전체** → `/pages/kb-*.html` 7개 + 인덱스 |
| 기술지원 가이드 | 봇에게 안 보임 | **371건 본문 전체** → `/pages/guide-*.html` 6개 + 인덱스 |
| 고객사/수상/파트너 | 봇에게 빈 목록 | `/pages/customers.html`(72) · `awards.html`(45) · `partners.html`(73) |
| 블로그·백서 | 메인 3건만 | `/pages/blog.html` (+네이버 블로그 연결) |
| sitemap.xml | 15 URL | **94 URL** |
| llms-full.txt | 16KB | **~770KB** (활용분야 상세 + 사례 전문 + KB 215건 본문 포함) |
| llms.txt | 페이지 나열 | 핵심 페이지 / 활용분야 60 / 사례 링크로 구조화 |
| netlify.toml | — | 구 Wix 경로 `/monnitblog` → 네이버 블로그 **301** 추가 |
| index.html noscript | 링크 5개 | 링크 11개 (신규 페이지 반영) |

솔루션 목록의 각 항목은 이제 상세 페이지로 링크되며, 내부 링크 318개 무결성 검사를 통과했습니다.

## 배포 후 수동 작업 (저장소 밖 — 꼭 필요)

1. **Google Search Console + Bing Webmaster에 sitemap.xml 재제출 및 메인 URL '색인 생성 요청'** — 현재 검색 결과에 노출되는 것은 구버전 스냅샷(옛 타이틀)입니다. 재크롤을 요청해야 새 콘텐츠로 교체됩니다.
2. **en.monnit.co.kr DNS 정리** — 현재 DNS가 끊긴 채 검색 색인에 남아 있습니다. DNS 관리에서 `en` 서브도메인을 monnit.co.kr 로 리다이렉트(또는 Netlify 도메인 별칭 추가 후 리다이렉트)하면 색인이 자연스럽게 정리됩니다.
3. 배포 후 확인: `/pages/app-vaccine.html`, `/pages/kb-sensor.html`, `/llms-full.txt`(≈770KB), `/monnitblog`(네이버로 301) 열리는지.


---

# 2026-07 데이터 소스 통일 (시트 = 단일 원본)

## 무엇이 바뀌었나
- **build.js가 이제 빌드 시 구글 시트를 직접 읽습니다** (`AppCategories·Applications·AppDetails·Cases·Customers·Awards·Partners·Blog·Whitepapers·Promotions·Products`). 사람(SPA 런타임)과 봇(정적 페이지·llms·sitemap)이 항상 같은 시트 데이터를 보게 됩니다.
- 시트 응답 실패 시 **app.js 리터럴로 자동 폴백** — 빌드는 절대 실패하지 않습니다. (`SHEET_SOURCE=off`로 폴백 강제 테스트 가능)
- Knowledgebase·기술가이드 **본문**은 계속 `data.js`가 원본입니다(시트는 제목·요약 색인만).
- 결과: 활용분야 상세 6→**60건**, 케이스 8→**25건**(한국 레퍼런스 포함), 프로모션 **5건** 정적 페이지 신설 → 총 **110페이지 / sitemap 112 URL / llms-full ≈ 920KB**.

## 배포 순서
1. 함께 제공된 **`monnit_구글시트_마스터_v6.xlsx`** 내용을 라이브 구글 시트에 반영
   (가장 쉬운 방법: 구글 드라이브에 업로드 → 열기 → 각 탭 내용 확인 후, 기존 시트에서 파일 > 가져오기 > 시트 교체. 백필 항목: Cases +2, Blog +3, Whitepapers +4, KB/TechSupport 동기화)
2. 이 저장소를 커밋·푸시 → Netlify 빌드가 시트를 읽어 110페이지 생성
3. 배포 확인: `/pages/app-manufact.html`(상세 렌더), `/pages/case-emart.html`, `/pages/promotions.html`, `sitemap.xml`(112 URL)

## 운영 규칙
- 콘텐츠 수정 = **시트에서만**. 저장 후 자동 배포(Apps Script 트리거) 또는 Netlify Trigger deploy.
- Cases 탭의 `key`는 **영문 소문자-하이픈 권장** (예: `hdc-labs`). 한글/대문자 key도 동작하지만 URL이 %인코딩되거나 대소문자 구분됩니다. key 변경 시 기존 공유 링크가 끊기니 신규 건부터 적용 권장.
- app.js의 하드코딩 리터럴은 오프라인 폴백용으로 유지 — 직접 수정하지 마세요.
