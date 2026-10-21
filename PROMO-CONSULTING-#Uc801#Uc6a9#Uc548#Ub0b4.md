# 프로모션 랜딩 「회전설비 AI 예지보전 1개월 무료 체험(컨설팅)」 적용 안내

작성일: 2026-07-27 · 대상 저장소: `Monnit`

---

## 0. 한눈에 보기

| 항목 | 내용 |
|---|---|
| 최종 주소 | **https://monnit.co.kr/promo/consulting** |
| 실제 파일 | `/promo-consulting.html` (루트) |
| 문구 수정 | 구글 스프레드시트 **`PromoConsulting`** 탭에서 실시간 수정 |
| 리드 접수 | StaticForms → Web3Forms → 메일앱 (기존 홈페이지와 동일 체인, 같은 곳으로 수신) |
| 분석·전환 | GTM `GTM-T8H73VW` + GA4 `G-49THHRYKR4` + Clarity `x38egtft64` |
| 기존 페이지 | `promo.html`(fire/water/elect/church)은 **그대로 유지** — 영향 없음 |

---

## 1. 무엇이 바뀌었나 (변경 파일 목록)

### 새로 추가된 파일

| 파일 | 설명 |
|---|---|
| `promo-consulting.html` | 새 랜딩페이지 본체 |
| `images/field-1-pump-*.{webp,jpg}` 외 36개 | 랜딩용 현장 사진 (기존 이미지와 이름 충돌 없음) |
| `images/monnit-logo.png` | 랜딩 상단·푸터 로고 |
| `promo-consulting-sheet-template.csv` | 스프레드시트에 붙여넣을 초기 양식 (327줄) |
| `PROMO-CONSULTING-적용안내.md` | 이 문서 |

### 수정된 파일

| 파일 | 수정 내용 |
|---|---|
| `_redirects` | `/promo/consulting` → `promo-consulting.html` 규칙 추가 (**와일드카드보다 위**에 배치) |
| `netlify.toml` | 위와 동일한 규칙을 Netlify 설정에도 추가 |
| `_headers` | 새 랜딩 no-cache 설정 (수정 즉시 반영되도록) |
| `sitemap.xml` | `/promo/consulting` URL 추가 (우선순위 0.9) |
| `build.js` | 빌드 시 사이트맵에 자동 포함 + Promotions 시트의 `link` 열 지원 |
| `app.js` | 프로모션 카드에 `link` 값이 있으면 랜딩페이지로 이동하도록 지원 |
| `style.css` | `<a>` 형태 프로모션 카드 스타일 보정 (2줄) |

> ⚠️ `build.js`를 수정한 이유: Netlify는 배포할 때마다 `node build.js`로 `sitemap.xml`을 새로 만듭니다.
> build.js를 고치지 않으면 다음 배포 때 새 URL이 사이트맵에서 사라집니다.

---

## 2. GitHub에 덮어쓰는 방법

### 방법 A — 웹 브라우저에서 (가장 쉬움 · 추천)

1. 받은 zip을 압축 해제합니다. → `Monnit-main` 폴더가 나옵니다.
2. GitHub에서 `Monnit` 저장소를 엽니다.
3. **먼저 백업**: `Code` 버튼 → `Download ZIP` 으로 현재 버전을 저장해 둡니다. (문제가 생기면 되돌릴 수 있게)
4. 저장소 메인 화면에서 `Add file` → **`Upload files`** 클릭
5. 압축 해제한 `Monnit-main` 폴더를 **열어서, 그 안의 내용물 전체**(폴더 포함)를 드래그해 올립니다.
   - ❗ `Monnit-main` 폴더 자체를 올리면 안 됩니다. **폴더 안쪽 파일들**을 올려야 합니다.
   - 같은 이름의 파일은 자동으로 덮어써집니다.
6. 화면 아래 `Commit changes` 에 설명을 적고 (예: `프로모션 랜딩 추가 — 회전설비 예지보전 1개월 무료 체험`) → **Commit changes** 클릭
7. Netlify가 자동으로 감지해 1~3분 내 배포합니다.

> 브라우저 업로드는 폴더 드래그를 지원하지만, 파일이 많으면 가끔 멈춥니다.
> 실패하면 `images` 폴더를 먼저 올리고, 그다음 루트 파일들을 나눠서 올리세요.

### 방법 B — GitHub Desktop (파일이 많을 때 안정적)

1. GitHub Desktop에서 `Monnit` 저장소를 `Clone` 합니다.
2. 로컬 폴더를 열고, 압축 해제한 `Monnit-main` 안의 내용물을 **전부 복사 → 붙여넣기 → 덮어쓰기**
3. GitHub Desktop 왼쪽에 변경 파일 목록이 뜨는지 확인합니다.
4. 아래 `Summary`에 설명을 쓰고 `Commit to main` → 오른쪽 위 `Push origin`

### 방법 C — 명령줄

```bash
git clone https://github.com/<계정>/Monnit.git
cd Monnit
# 압축 해제한 Monnit-main 안의 "내용물"을 이 폴더에 덮어쓰기 (macOS/Linux)
cp -R /경로/Monnit-main/. .
git add -A
git commit -m "프로모션 랜딩 추가 — 회전설비 예지보전 1개월 무료 체험(/promo/consulting)"
git push origin main
```

---

## 3. 배포 후 확인 체크리스트

- [ ] `https://monnit.co.kr/promo/consulting` 접속 → 페이지가 정상 표시되는가
- [ ] **현장 사진 6장이 보이는가** (안 보이면 `images/` 업로드 누락)
- [ ] 상단 로고 클릭 → 홈으로 이동하는가
- [ ] 모바일에서 하단 `☎ 무료 현장 컨설팅 받기` 버튼이 뜨는가
- [ ] 신청 폼에 테스트 입력 → `korea@monnit.com` 으로 메일이 오는가
- [ ] 카카오톡에 주소를 붙여넣어 → 썸네일·제목·설명이 뜨는가
- [ ] `https://monnit.co.kr/sitemap.xml` 에 `/promo/consulting` 이 있는가
- [ ] 기존 `https://monnit.co.kr/promo/fire` 가 여전히 정상인가

---

## 4. 스프레드시트로 문구 수정하기 ⭐

### 4-1. 최초 1회 세팅

1. 기존에 쓰던 구글 스프레드시트를 엽니다.
   `https://docs.google.com/spreadsheets/d/1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc`
2. 아래쪽 시트 탭에서 `+` → 새 시트를 만들고 이름을 정확히 **`PromoConsulting`** 으로 바꿉니다. (대소문자 동일하게)
3. `promo-consulting-sheet-template.csv` 파일을 엽니다.
   - 엑셀로 바로 열면 한글이 깨질 수 있습니다. **구글 드라이브에 업로드 → 구글 스프레드시트로 열기**를 권장합니다.
4. 내용 전체를 복사해 `PromoConsulting` 탭 **A1 셀**에 붙여넣습니다.
5. 스프레드시트 공유 설정이 **「링크가 있는 모든 사용자 — 뷰어」** 인지 확인합니다. (기존 시트와 동일 조건)

### 4-2. 실제 수정 방법

시트는 4개 열로 되어 있습니다.

| 키 | 위치 | 현재문구(참고용) | **수정문구** |
|---|---|---|---|
| `hero-03` | 히어로(첫화면) · h1 | 도입을 결정하기 전에… | ← **여기에만 입력** |

- **`수정문구` 칸에 글을 넣으면** 그 문구로 바뀝니다.
- **비워두면** HTML 원본 문구가 그대로 나옵니다. → 바꿀 것만 채우면 됩니다.
- `현재문구` 칸은 참고용입니다. (지워도 되지만 원본을 찾기 어려워집니다)
- 저장 즉시 반영됩니다. (캐시 없음 · 페이지 새로고침만)
- `<b>`, `<br>` 같은 태그를 그대로 쓰면 굵게·줄바꿈이 적용됩니다.

### 4-3. `@` 로 시작하는 설정 키

문구가 아니라 페이지 설정을 바꿉니다.

| 키 | 하는 일 | 입력 예시 |
|---|---|---|
| `@title` | 브라우저 탭·구글 검색 결과 제목 | `회전설비 예지보전 무료 체험 \| 모넷코리아` |
| `@description` | 구글 검색 결과 설명문 | 120~155자 권장 |
| `@ogimage` | 카톡·페북 공유 썸네일 | `https://monnit.co.kr/images/....jpg` |
| `@promotitle` | 리드 접수 메일에 찍히는 프로모션 이름 | `9월 예지보전 체험` |
| `@accent` | 페이지 포인트 색 | `#2B84F5` |
| `@alert` | 상단 이벤트바·경고 색 | `#FF5A3C` |
| `@tel` | 대표 전화번호 (모든 전화 버튼 일괄 변경) | `02-2088-1454` |
| `@email` | 접수 메일 주소 | `korea@monnit.com` |
| `@ended` | **`1` 입력 시** 접수 마감 + 검색 제외 | `1` |
| `@endedmsg` | 종료 시 상단에 띄울 안내 문구 | `본 프로모션은 종료되었습니다.` |

> 💡 **이벤트가 끝나면** `@ended` 에 `1` 만 넣으세요.
> 신청 버튼이 잠기고, 상단에 종료 안내가 뜨고, 검색엔진에서 자동으로 빠집니다. (HTML 수정 불필요)

### 4-4. 자주 바꾸는 키 빠른 참조

| 키 | 위치 |
|---|---|
| `bar-01` | 맨 위 주황색 이벤트 띠 |
| `nav-01` | 상단 오른쪽 파란 버튼 「무료 컨설팅」 |
| `hero-01` / `hero-02` | 「8월 한정 …」 배지 2개 |
| `hero-03` | **대표 제목(H1)** |
| `hero-04` | 제목 아래 설명문 |
| `hero-05` ~ `hero-09` | 「30일 실설비 검증 프로그램」 강조 박스 |
| `hero-10` / `hero-11` | 히어로 버튼 2개 |
| `hero-12` ~ `hero-14` | 「상담·설치 0원 / 구매 의무 없음 / 조건 없는 반납」 |
| `hero-15` ~ `hero-25` | 「30초 현장 적합도 체크」 체크리스트 |
| `hero-26` ~ `hero-62` | 통합관제 대시보드 데모 라벨·수치 |
| `hero-63` ~ `hero-73` | 글로벌 실적(130개국·90K 고객사 등) + 수상 배지 |
| `prob-01` ~ | 「숙련자의 판단에…」 섹션 |
| `call-01` ~ | 컨설팅 안내 · 전화 CTA |
| `how-01` ~ | 작동 방식 섹션 |
| `dash-01` ~ | 대시보드 섹션 제목 |
| `feat-01` ~ | 핵심 기능 4가지 |
| `sup-01` ~ | 1개월 체험 STEP 01~03 |
| `form-01` ~ | 신청 폼 라벨·안내문·동의 문구 |
| `form-ph-01` ~ `form-ph-05` | 입력창 안내문구(placeholder) |
| `pp-01` ~ | 개인정보처리방침 팝업 전문 |
| `foot-01` ~ | 푸터 |
| `mcall-01` | 모바일 하단 고정 통화 버튼 |

> 전체 목록과 현재 문구는 `promo-consulting-sheet-template.csv` 에 그대로 들어 있습니다.
> 시트에서 `Ctrl+F` 로 바꾸고 싶은 문구를 검색하면 해당 키를 바로 찾을 수 있습니다.

---

## 5. 사이트 프로모션 목록에 노출하기

기존 스프레드시트의 **`Promotions` 탭**에 아래 한 줄을 추가하세요.
(홈페이지 `#promotions` 목록과 `pages/promotions.html` 에 자동 반영됩니다)

| 열 | 값 |
|---|---|
| `id` | `consulting` |
| `title` | `회전설비 AI 예지보전 1개월 무료 체험` |
| `badge` | `HOT` |
| `period` | `2026.08.01 ~ 08.31` |
| `desc` | `무료 현장 컨설팅 후 핵심 설비에 센서를 무상 설치. 한 달 데이터를 보고 도입을 결정하세요.` |
| `image` | `https://monnit.co.kr/images/field-1-pump-1440.jpg` |
| **`link`** | **`/promo/consulting`** ← 이번에 새로 지원되는 열 |
| `order` | `1` |
| `ended` | (비움) |

> ❗ `Promotions` 탭에 **`link` 열이 없으면 새로 만들어야 합니다.** 헤더 행 맨 끝에 `link` 라고 추가하세요.
> `link` 값이 있으면 프로모션 카드를 눌렀을 때 기존 팝업 대신 이 랜딩페이지로 이동합니다.
> `link` 를 비워두면 지금까지처럼 사이트 안 팝업이 열립니다. → 기존 프로모션은 영향 없습니다.

---

## 6. 적용된 검색 최적화(SEO) 내역

| 항목 | 내용 |
|---|---|
| 메타 설명 | 회전설비·진동센서·예지보전·무료 체험 키워드 포함 |
| canonical | `https://monnit.co.kr/promo/consulting` (중복 색인 방지) |
| robots | `index,follow,max-image-preview:large` |
| OG / 트위터 카드 | 제목·설명·1485×1325 썸네일 (카톡·페북·슬랙 공유 대응) |
| 파비콘 | 기존 사이트와 동일 아이콘 세트 |
| 구조화 데이터 (JSON-LD) | `Organization` · `WebSite` · `WebPage` · `BreadcrumbList` · `Service`+`Offer` · **`FAQPage`(5문항)** |
| 이미지 | 모든 사진에 한글 `alt`, WebP + JPG 폴백, `srcset` 반응형, LCP 이미지 `preload` |
| 사이트맵 | `sitemap.xml` 등록 (우선순위 0.9) |
| AI 크롤러 | 기존 `robots.txt`가 GPTBot·ClaudeBot·PerplexityBot 등 전체 허용 — 별도 작업 불필요 |

> `FAQPage` 구조화 데이터는 구글 검색 결과에 질문·답변이 펼쳐져 표시될 가능성을 높입니다.
> 내용은 `promo-consulting.html` 상단 `<script type="application/ld+json">` 안에서 수정합니다.

---

## 7. 리드(신청서) 연동 상세

폼 전송은 기존 홈페이지 `sendLead()` 와 **완전히 같은 체인**입니다.

```
1순위  StaticForms  (sf_e026c9ef91b8eaeba9d1d472)
  └ 실패 시 →
2순위  Web3Forms    (e4d5cb03-1b25-425c-a47d-f04e4a05e7e2)
  └ 실패 시 →
3순위  방문자 메일앱 자동 작성 (korea@monnit.com)
```

접수 항목 (한글 키 — 기존 리드와 같은 형식):

```
신청 프로모션 / 회사명 / 담당자명 / 전화번호 / 이메일
사업장 지역 / 주요 회전설비
개인정보 수집·이용 동의(필수) / 마케팅 정보 수신(선택) / 동의 일시
접수 경로 / 출처 / 유입 페이지
```

**`출처`** 에는 광고 파라미터가 자동으로 담깁니다:
`promo=consulting · utm_source=… · utm_medium=… · utm_campaign=… · gclid=… · ref=…`
→ 어떤 광고에서 들어온 리드인지 메일만 보고 바로 구분할 수 있습니다.

### 전환 이벤트

| 이벤트 | 발생 시점 | 전송처 |
|---|---|---|
| `lead_submit` | 신청서 제출 | GTM dataLayer, Clarity |
| `generate_lead` | 신청서 제출 | GA4 (Google Ads 전환 연결용) |
| `call_click` | 전화 버튼 클릭 | GA4, GTM, Clarity |
| `promo_card_click` | 홈 프로모션 카드 클릭 | GA4 |

> Google Ads 전환 설정: GA4에서 `generate_lead` 를 **핵심 이벤트**로 표시한 뒤,
> Google Ads → 전환 → GA4 가져오기 로 연결하시면 됩니다.

---

## 8. 문제가 생겼을 때

| 증상 | 원인 / 해결 |
|---|---|
| 사진이 안 보임 | `images/` 폴더 업로드 누락 → `field-*.webp` 파일들이 올라갔는지 확인 |
| `/promo/consulting` 이 다른 페이지로 감 | `_redirects` 에서 `/promo/consulting` 줄이 `/promo/*` 줄보다 **위**에 있는지 확인 |
| 시트를 고쳐도 안 바뀜 | ① 탭 이름이 정확히 `PromoConsulting` 인지 ② 시트 공유가 「링크가 있는 모든 사용자」인지 ③ `수정문구` 열에 입력했는지 (`현재문구` 열 아님) |
| 신청서가 안 옴 | StaticForms 대시보드에서 키 유효 여부 확인 → 안 되면 Web3Forms로 자동 폴백되므로 스팸함도 확인 |
| 사이트맵에서 사라짐 | `build.js` 수정본이 올라갔는지 확인 (624번 줄 근처 `/promo/consulting`) |
| 페이지를 내리고 싶음 | 시트 `@ended` 에 `1` → 즉시 마감 / 완전 삭제는 `promo-consulting.html` 제거 + `_redirects`·`sitemap.xml` 줄 삭제 |

---

## 9. 참고 — 기술 메모

- 문구 키는 `promo-consulting.html` 안의 `data-k="키"` 속성과 1:1 대응합니다.
  HTML 구조를 크게 바꾸면 키 번호가 밀릴 수 있으니, 구조 변경 시 CSV를 다시 만드는 것이 안전합니다.
- 스프레드시트 로딩은 **화면이 다 그려진 뒤 덮어쓰는 방식**입니다.
  시트를 못 읽어도 페이지는 원본 문구로 정상 동작하므로, 광고 트래픽이 유실되지 않습니다.
- 페이지는 외부 JS 프레임워크 없이 단일 HTML로 동작합니다. (폰트만 CDN)
