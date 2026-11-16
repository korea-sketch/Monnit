---
date: 2026-08-05
기준: Monnit-main (19)
---

# 성능 개선 · 오류 수정 내역

용량 **18.8 MB → 13.1 MB** (−5.7 MB) · 깨진 참조 **1건 → 0건** · 스타일 미정의 클래스 **31개 → 10개**

---

## A. 수정한 오류

### A-1. promo-consulting.html — CSS 21개 클래스 통째 누락 (치명)

마크업만 새로 짜이고 스타일이 따라오지 않아 해당 블록 전체가 무스타일로 렌더되고 있었습니다.

| 블록 | 클래스 | 증상 |
|---|---|---|
| 히어로 | `h1b` 외 13개 | `전화 상담`·`체험 신청`이 **브라우저 기본 링크(파란 밑줄)로 표시**. 진동 그래프 카드에 배경·테두리 없음. 판독값 3칸이 세로로 흘러내림. `LIVE` 배지·`8월 한정` 칩 무스타일 |
| 하단 고정 CTA | `stickybar` `sb-call` `sb-apply` | **모바일 하단 고정바가 아예 동작 안 함** → 스크롤 중 CTA 사라짐 (전환 동선 손실) |
| 접기 섹션 | `howfold` `howfold-body` | `<details>` 브라우저 기본 삼각형 그대로 노출 |
| 기타 | `proofband` `feats-divider` | 섹션 여백·구분선 없음 |

**수정** — 같은 파일 `<style>` 안 `.hero-proof` 규칙 뒤에 복구 블록 삽입.
새 토큰을 만들지 않고 이 파일이 이미 쓰던 것만 재사용했습니다 (`--green` `--card` `--hair` `--alert` `--mut` `--ink0`).
버튼은 기존 `.btnA`/`.btnB` 규격과 동일 — 첫 번째 채움, 두 번째 외곽선.

### A-2. style.css — 롤링 배너 배경 프레이밍

```diff
- object-position:22% center;   (2곳)
+ object-position:72% center;
```

배경 컨테이너가 화면 오른쪽 56%만 차지하는데 `22%`는 사진의 왼쪽을 보여주라는 뜻입니다.
새 배경 사진 6장은 왼쪽이 어두운 그라디언트, 오른쪽이 피사체 구조라 **2번(모터)·3번(UPS) 슬라이드가 검은 화면으로 보였습니다.**
`.nh-why-bg img` 기본 규칙과 `.is-roll` 규칙 두 곳 모두 수정.

### A-3. church/index.html — 존재하지 않는 이미지 참조

`/images/promo-church-hero.jpg` (파일 없음) → `./hero.webp`.
365행에서 덮어쓰고 있어 화면 영향은 없었지만 죽은 참조를 정리했습니다.

---

## B. 성능 개선

### B-1. 미사용 자산 62개 삭제 (5.7 MB)

코드 전체(html·js·css·toml·xml·_redirects·_headers)에서 **참조 0회**인 것만 삭제했습니다.

- **`field-*` 반응형 세트 30여 개 (약 2.2 MB)** — `promo-consulting.html`이 `images/promo/pc-*.webp` 기반 `<picture>`+`srcset`으로 이전하면서 통째로 고아가 됨. `field-1-pump-1440.jpg`는 og:image·schema 이미지로 살아 있어 **유지**
- `sol-*.jpg` 6개, `promo-safeflame-*.jpg` 6개, `.webp`만 쓰는데 남아 있던 `promo-*.jpg` 5개
- `cta-bg.jpg`, `about-hero-bg.svg`, `church/space-worship.webp`, `icon-512.png`(= `logo.png` 바이트 동일, manifest 없음)
- `gitignore.txt`(중복), `functions/`(netlify.toml은 `netlify/functions`를 가리킴 → 미배포 폴더)

배포 용량·빌드 시간이 줄고, 다음 사람이 "이거 쓰는 건가" 고민할 파일이 사라집니다.

### B-2. 이미 잘 되어 있어 손대지 않은 것

감사 결과 아래는 이미 최적화되어 있었습니다. 확인만 하고 그대로 뒀습니다.

- `data.js`(1.5 MB) — 선로딩 안 함, 지식베이스 진입 시 `app.js`가 동적 로드
- `i18n.js`(214 KB) — `requestIdleCallback` 지연 로딩, 영어 모드일 때만 즉시
- 웹폰트 2종 — `media="print" onload` 논블로킹 + `<noscript>` 폴백
- `promo-consulting.html` 히어로 이미지 — `<picture>`+`srcset`+`width/height`+`fetchpriority="high"`
- `_headers` 캐시 정책 — `immutable` 대신 `stale-while-revalidate`. 2026-07 사고 경위까지 주석으로 남아 있음

**`app.js`에 `defer`를 붙이지 않았습니다.** 402 KB라 붙이고 싶지만, 바로 뒤 인라인 `<script>`(사이트 검색 등)가 `app.js` 전역을 참조합니다. `defer`를 붙이면 인라인이 먼저 실행돼 깨집니다. 현재가 맞는 구조입니다.

---

## C. 남은 항목 — 판단이 필요해 건드리지 않음

### C-1. `<img>` 128개에 width/height 없음 (index.html)

CLS(레이아웃 이동) 원인이라 Lighthouse 점수에 직접 반영됩니다.
다만 이미지별 실제 치수를 넣어야 해서 자동 일괄 처리는 위험합니다. 별도 작업으로 잡는 게 맞습니다.

### C-2. index.html 스타일 미정의 클래스 9개

`wp-ico`(×16) `vx-fl`(×4) `section-pad`(×2) `mh-twin` `paf-full` `page-hero` `nh-values-section` `wiz-wrap` `dark`

전부 부모·형제 클래스는 스타일을 갖고 있어 **레이아웃이 깨지진 않습니다.** 아이콘 크기·섹션 여백 정도의 미세한 차이입니다.
원래 의도한 모양을 모르는 상태에서 추측으로 채우면 오히려 어긋나므로 보고만 합니다.

### C-3. style.css 331 KB 렌더 블로킹

가장 큰 남은 지렛대지만, 크리티컬 CSS 분리는 전면 리팩터링이라 회귀 위험이 큽니다.

---

## D. 검증

| 항목 | 결과 |
|---|---|
| JS 문법 (`app.js` `data.js` `i18n.js` `build.js` `js/*` `netlify/functions/*`) | 전체 통과 |
| 깨진 로컬 참조 | 1건 → **0건** |
| 중복 `id` 속성 | 0건 |
| CSS 중괄호 균형 (style.css + 인라인 4개) | 전부 균형 |
| 스타일 미정의 클래스 | promo-consulting **21 → 0** / 전체 31 → 10 |
| 삭제 62개가 코드에서 호출되는지 | 0건 재확인 |
