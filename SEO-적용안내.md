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
