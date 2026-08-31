# 점검 결과 — 연동 · ops · editor · 성능 · SEO · AEO

`/promo/proposal` 을 저장소 규격에 맞춰 전수 점검했습니다. **6곳이 비어 있어 채웠고,
그 뒤 실제로 실행해 검증하다 버그 2건을 더 잡았습니다.**

---

# 실행 검증 결과

정적 검사만으로는 부족해서 **jsdom 으로 페이지를 실제로 띄우고 네트워크를 가로채
폼 제출까지 시뮬레이션**했습니다. 10개 시나리오 전부 통과합니다.

| 시나리오 | 결과 |
|---|---|
| 페이지 로드 오류 | 없음 |
| 초기 상태 (폼 닫힘 · 등장효과 38/38 · 카운트업 동작) | ✓ |
| PDF 버튼 → 폼이 열리고 **다운로드는 발생하지 않음** (게이트) | ✓ |
| 빈 폼 제출 → 회사명·이름·이메일·동의 오류 표시, 전송 차단 | ✓ |
| 잘못된 이메일 → 오류 표시, 전송 차단 | ✓ |
| 정상 제출 → sendpw → Web3Forms → MonnitLead(doc_request) 순차 실행 | ✓ |
| 완료 화면 전환 · 본문 확인 패널 노출 · 버튼 복구 | ✓ |
| 재방문자 → **폼 없이 서명 링크 재발급** | ✓ |
| 문의 모드 → 제목·필수항목·버튼 전환 | ✓ |
| 전화 클릭 → 원장 기록 | ✓ |

## 실행하다 잡은 버그 2건

**① 검증이 항목을 통째로 건너뛰고 있었습니다 — 심각**

`validate()` 가 `fl.offsetParent === null` 로 "현재 모드에서 숨겨진 항목"을 판단했습니다.
그런데 `offsetParent` 는 레이아웃 계산 결과라, 모달이 애니메이션 중이거나
`position:fixed` 조상 아래에 있으면 오판이 생깁니다.
실제로 **빈 폼을 제출해도 아무 오류가 안 뜨고 그대로 전송**됐습니다.

→ `data-only` 속성과 현재 모드를 직접 비교하도록 바꿨습니다. 렌더 상태에 기대지 않습니다.

```js
var scope = fl.closest('[data-only]');
if (scope && scope.getAttribute('data-only') !== mode) return;
```

**② 픽셀 안내가 동의 관리 설계와 충돌했습니다**

파일 상단에 "여기에 Meta 픽셀을 붙이세요" 라는 주석이 있었습니다.
이 사이트는 `monnit-consent.js` 가 **Consent Mode v2 로 기본값 denied** 를 걸어두고
동의 후에야 `ad_storage` 를 granted 로 바꿉니다. 안내대로 픽셀을 직접 붙이면
**동의 전에 발사되어 그 설계가 무너집니다.**

→ 안내를 GTM(GTM-T8H73VW) 기준으로 다시 썼습니다. 페이지는 dataLayer 로만 신호를 올리고,
픽셀은 GTM 안에서 붙이도록 했습니다.

| dataLayer 이벤트 | 의미 |
|---|---|
| `monnit_download` | 자료 신청 완료 — **주 전환** (lead_grade · value 동봉) |
| `monnit_form_submit` | 상담 문의 접수 |
| `monnit_form_open` | 폼 열기 |
| `monnit_contact` | 전화·메일 클릭 |

## 정적 검사

| 항목 | 결과 |
|---|---|
| 메타 태그 중복 | 없음 (canonical 1 · JSON-LD 1 · title 1) |
| 원본 연동 손실 | 없음 (GTM·GA4·Clarity·consent·lead·Web3Forms 키·모바일 보강 CSS 14/14 유지) |
| 태그 균형 · 중첩 | 이상 없음 |
| 이미지 속성 ↔ 실제 크기 | 전부 일치 (비율 기준) |
| 정의 안 된 CSS 변수 | 없음 |
| 죽은 코드 · 플레이스홀더 | 없음 |
| 안 쓰는 CONFIG 키 | 없음 |
| **`DOC_TITLE` ↔ `_docmap` 키** | **바이트 단위 일치** ✓ |
| getdoc 파일명 정규식 | 통과 |
| 두 사본(`promo-proposal.html` ↔ `promo/proposal/index.html`) | 동일 |
| JS 구문 (4개 파일) | 전부 통과 |

## 접근성 · 성능

| 항목 | 결과 |
|---|---|
| alt 없는 이미지 | 0 / 6 |
| 장식 SVG `aria-hidden` | 20 / 20 |
| `type` 없는 button | 0 / 9 |
| 입력 항목 라벨 연결 | 9 / 9 (모두 `<label>` 안) |
| 모달 `role="dialog"` + `aria-modal` | 2 / 2 |
| **HTML 전송량 (gzip)** | **25 KB** |
| **첫 화면 합계 (HTML + 표지)** | **92 KB** |
| 지연 로드 이미지 | 4 / 6 (표지·폼 썸네일만 즉시) |
| 폰트 렌더 차단 | 없음 (`media="print"` 지연) |
| 이미지 전부 받아도 | 1.0 MB |

---

## 요약

| 항목 | 점검 전 | 조치 |
|---|---|---|
| 동의 배너 · GTM · GA4 · Clarity | ✅ | — |
| MonnitLead → `/api/lead` 원장 | ⚠️ `contact` 로 기록 | **`doc_request` 로 교정** |
| 자료 전달 방식 | ❌ 공개 URL 직링크 | **`sendpw` → `getdoc` 서명 링크** |
| Web3Forms 담당자 알림 | ✅ | — |
| **health 자동 점검** | ❌ **미등록** | **`/promo/proposal` 추가** |
| **ops 미응대 큐** | ❌ 자료요청 누락 | **`ops.mjs` 수정** |
| **ops 리드 표** | ❌ 설비·등급 안 보임 | **`_ops_ui.mjs` 수정** |
| editor.html CMS | ✅ 대상 아님 | — (광고 랜딩은 비관리가 정상) |
| build.js 사본 생성 | ✅ 이미 있음 | — |
| **_headers 캐시** | ❌ 규칙 없음 | **no-cache 추가** |
| **본문 폰트** | ❌ 시스템 폰트만 | **Pretendard 지연 로드** |
| robots · sitemap | ✅ 의도적 제외 | — |
| **구조화 데이터** | ❌ **0개** | **@graph 6종 추가** |
| **FAQ** | ❌ 없음 | **본문 6문항 + FAQPage** |

---

## 1. 자료 전달 — 공개 URL 을 없앴습니다

**문제** — `/files/monnit-predictive-maintenance-guide.pdf` 가 열려 있어 폼을 거치지 않고
주소만 알면 누구나 받을 수 있었습니다. 게이트를 걸어도 의미가 없는 상태였습니다.

**조치** — 제안서 16종과 동일하게 `proposals/` 로 옮기고 `_docmap.js` 에 등록했습니다.
이제 `sendpw` 가 이메일을 확인한 뒤 10분짜리 서명 링크를 1건만 발급합니다.
`_redirects` 의 `/proposals/* → 404` 와 `included_files` 가 이미 있어 **설정 변경은 없습니다.**

## 2. health 자동 점검 — 광고비가 새는 걸 막습니다

**문제** — 15분마다 도는 자동 점검에 `/promo/consulting` 만 있고 이 페이지는 없었습니다.
폼이 깨져도 아무도 모른 채 광고비만 나갑니다.

**조치** — `health.mjs` 에 한 줄 추가했습니다.

```js
{ path: '/promo/proposal', name: '광고 랜딩(제안가이드)',
  must: ['id="fmForm"', 'monnit-lead.js', 'GTM-T8H73VW'] },
```

폼(`fmForm`)·리드 스크립트·GTM 중 하나라도 사라지면 ops 화면 「사이트 상태」에 빨간불이 뜹니다.

## 3. ops 관제 — 자료 요청이 큐에서 빠져 있었습니다

**문제 둘.**
`pending` 계산이 `type === 'contact'` 라서 **자료 요청은 미응대 건수에 안 잡혔고**,
리드 표의 응대 체크박스도 `contact` 에만 붙어 자료 요청은 완료 표시를 못 했습니다.
게다가 표의 부제가 `interest || asset` 이라 관심분야가 있으면 **설비·등급이 가려졌습니다.**

**조치** — 두 파일에서 세 줄을 고쳤습니다.

```js
// ops.mjs — 구독만 빼고 모두 후속 연락 대상
pending: rows.filter(r => r.type !== 'subscribe' && !done[idOf(r)]).length

// _ops_ui.mjs — 설비·등급도 함께 표시
var sub = [..., esc(r.interest||''), esc(r.asset||'')]
var chk = r.type!=='subscribe'   // 자료 요청도 체크 가능
```

이제 리드 표에 이렇게 보입니다:

```
[자료]  대한정밀공업          메타      12분 전
        김설비 · 예지보전 제안 가이드 · 30 ~ 50대 · A등급 78점
        010-0000-0000
```

CSV 내려받기의 `설비`·`관심` 칸에도 그대로 나갑니다.

## 4. editor.html — 손댈 것 없습니다

`editor.html` 은 `data.js` 기반 CMS 콘텐츠(제품·사례·FAQ 등)를 편집합니다.
`promo-*.html` 랜딩은 처음부터 관리 대상이 아니며, `/promo/consulting`·`/promo/residence` 도
같습니다. **광고 랜딩은 파일을 직접 고치는 것이 이 저장소의 관행**이라 그대로 두었습니다.

## 5. 성능

- `_headers` 에 `no-cache, must-revalidate` 추가 — 소재를 자주 고치므로 항상 최신본이 나가야 합니다
  (`/promo/consulting` 과 동일한 처리)
- Pretendard 를 `media="print" onload` 로 지연 로드 — 다른 페이지와 글꼴을 맞추면서 렌더는 막지 않습니다
- 이미지는 이미 `srcset`(800/1600) + `loading="lazy"` + 크기 지정으로 CLS 없음
- `/images/*` 는 기존 규칙(5분 캐시 후 재검증)이 그대로 적용됩니다

## 6. SEO — 검색 노출은 의도적으로 막혀 있습니다

`noindex, nofollow` + sitemap 제외 + `_redirects` 의 `X-Robots-Tag` 까지 삼중으로 막혀 있습니다.
**광고 전용 랜딩이므로 이게 맞습니다.** 홈페이지 본문과 내용이 겹쳐 색인되면
오히려 본 페이지들의 순위를 갉아먹습니다. 그대로 두었습니다.

다만 `og:image` 가 라이브에서 `/images/why-ai.jpg` 로 덮여 있었습니다.
카톡·페북 공유 시 엉뚱한 이미지가 떴습니다 → `/images/proposal-guide/og-image.jpg` 로 교정했습니다.
**CMS 나 빌드 쪽에서 og 태그를 덮어쓰는 로직이 있는지 한 번 확인해 주세요.**

## 7. AEO — 솔직하게 말씀드리면

**noindex 페이지라 구조화 데이터가 검색 리치결과로 나오지는 않습니다.** 그래도 넣었습니다:

- 사이트 공통 `@graph` 규격(Organization · WebSite · WebPage · BreadcrumbList · Service · FAQPage)을
  `/promo/consulting` 과 동일하게 맞춰 **일관성**을 유지
- 나중에 이 랜딩을 색인 허용으로 돌리면 **그날 바로 동작**
- FAQ 6문항은 스키마보다 **본문에 있는 것 자체가 전환에 도움**이 됩니다.
  "설비를 세워야 하나", "폐쇄망도 되나", "센서 몇 개 필요한가" — 폼 앞에서 막히는 질문들을
  미리 풀어줍니다. 스키마와 본문 문구는 완전히 동일하게 맞췄습니다(6/6 검증).

**AEO 를 제대로 하시려면** 이 랜딩이 아니라 `llms.txt` · `llms-full.txt` 와 색인 대상인
`/guides` · `/case/*` 쪽에 이 가이드 내용을 텍스트로 올리는 것이 맞습니다.
30포인트 배치표, ISO 20816-3 임계값 테이블처럼 **숫자가 있는 실무 정보**는
AI 답변 엔진이 특히 잘 인용합니다. 원하시면 그 작업을 따로 잡겠습니다.

---

## 바뀐 파일 (전체)

| 파일 | 상태 |
|---|---|
| `promo-proposal.html` | 교체 |
| `promo/proposal/index.html` | 교체 (build.js 가 자동 생성하지만 동봉) |
| `proposals/predictive-maintenance-guide.pdf` | 신규 |
| `files/monnit-predictive-maintenance-guide.pdf` | 교체 (예비 경로) |
| `netlify/functions/_docmap.js` | 1줄 추가 |
| `netlify/functions/health.mjs` | 1줄 추가 |
| `netlify/functions/ops.mjs` | 1줄 수정 |
| `netlify/functions/_ops_ui.mjs` | 2곳 수정 |
| `_headers` | 4줄 추가 |
| `images/proposal-guide/*.jpg` | 8개 교체 + `og-image.jpg` 신규 |

`netlify.toml` · `_redirects` · `build.js` · `robots.txt` · `sitemap.xml` 은 **손댈 것 없습니다.**

## 배포 후 확인

- [ ] `/promo/proposal` 폼 제출 → PDF 수신 → ops 「자료 요청」 +1 · 리드 표에 등급 표시
- [ ] `/proposals/predictive-maintenance-guide.pdf` 직접 접근 → 404
- [ ] ops 「사이트 상태」에 `광고 랜딩(제안가이드)` 초록불
- [ ] 카톡에 링크 공유 → 표지 이미지가 뜨는지
- [ ] [리치 결과 테스트](https://search.google.com/test/rich-results)로 JSON-LD 문법 확인
      (noindex라 색인은 안 되지만 문법 검증용)
