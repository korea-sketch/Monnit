# 영문(EN) 3차 — 언어 선택 KO|EN 분리 · 접속 국가별 첫 화면 · 운영 충돌 점검 (2026-10-28)

2차(PATCH-영문버전-2차-한글제거-검수-적용안내-2026-10-28.md) 위에 이어서 작업했습니다.
※ 함께 받은 Monnit-main (76).zip 은 현재 라이브(app.js v214)와 같은 파일이라, 2차 정비본을 기준으로 이어서 고쳤습니다.

## 1. 언어 선택 버튼 — KO | EN 두 칸
- 예전: 버튼 하나에 '바꿀 언어'가 적혀 있어 한국어 화면에 EN, 영어 화면에 KO 가 떠서 지금 언어가 헷갈림
- 지금: `KO | EN` 두 칸, 현재 언어 칸이 파랗게 칠해짐 (PC 머리말 · 모바일 머리말 · 단독 랜딩 머리말 공통)
- 이미 선택된 칸을 눌러도 '직접 고른 언어'로 저장되어 이후 자동 전환되지 않음

## 2. 접속 국가로 첫 화면 언어 정하기
- 처음 온 방문자(저장된 언어 선택이 없을 때)만 `/api/geo` 로 접속 국가를 한 번 확인
  - 한국(KR) → 한국어 · 그 외 국가 → 영문으로 시작
  - 결과는 브라우저에 저장 → 다음 방문부터는 다시 묻지 않음. 방문자가 KO/EN 을 누르면 그 선택이 항상 우선
- 제외: 검색로봇(Googlebot·Yeti(네이버)·Daum 등)·자동화 브라우저·미리보기(iframe, 편집기 미리보기)
  → 검색엔진에는 지금처럼 한국어 페이지가 색인됨(SEO 영향 없음)
- 국가 확인이 실패하면 한국어 그대로
- 링크로 언어 고정: 주소 뒤에 `?lang=en` / `?lang=ko` (해외 광고·영문 소개 링크용)
- 서버: Cloudflare Worker 의 `request.cf.country` (Netlify 에서는 context.geo) — IP 는 저장·반환하지 않고 국가 코드 2글자만 응답
  - 신규 `netlify/functions/geo.mjs`, `cloudflare/worker.mjs` 에 등록, 방문 기록(엣지 block-ip) 제외 목록에 `/api/geo` 추가
  - 첫 방문 1회만 호출 → Worker 무료 한도 영향 미미

## 3. 운영 충돌 점검 결과와 조치
| 항목 | 결과 |
|---|---|
| 문의 폼 선택값 | **충돌 있었음 → 수정.** value 없는 `<option>` 은 영문 화면에서 선택값까지 영문이 되어 '기타' 선택 시 기타 입력칸이 안 열렸고, 접수 데이터에도 영문 분류가 들어갈 수 있었음 → 번역 전에 한글 원문을 value 로 고정. 영문 화면에서도 접수되는 분류값은 한국어 그대로 |
| 시트 문구(SiteContent 영문 열) | 버튼 클릭 때만 다시 적용되던 것을 언어가 바뀌는 모든 경우(자동 전환 포함)에 다시 적용 |
| 모니·제안서 대화 첫 말풍선 | 처음 그릴 때 언어로 고정되어 자동 전환 뒤 한글이 남던 문구(152건) 사전에 추가 |
| 관리 화면(/ops·/editor·계약서) | i18n 을 불러오지 않음 → 영향 없음 |
| 보안 정책(CSP) | 같은 도메인 호출이라 추가 설정 불필요 |
| 검색엔진 | 로봇은 자동 전환 제외, `<html lang>` 은 로봇에게 ko 그대로 |
| 캐시 | 페이지 HTML 은 국가와 무관하게 동일 → Cloudflare 캐시 그대로 |
| 참고 | 영문 화면에서 사이트 내 검색은 문서 데이터가 한국어라 영문 검색어로는 결과가 적을 수 있음 |

## 바뀐 파일
i18n.js · app.js · style.css · index.html 외 하위 index 6개 · promo-*.html 와 promo/*/index.html 사본 ·
promo/temperature/index.html · visit.html · installation-photos.html · church/index.html · privacy.html · promo.html ·
js/i18n-extra.js · netlify/functions/geo.mjs(신규) · cloudflare/worker.mjs · netlify/edge-functions/block-ip.js
캐시 버전: style.css v239 · app.js v217 · i18n.js v120 · i18n-extra v2

## 배포 후 확인
1. 한국에서 시크릿 창으로 접속 → 한국어, 오른쪽 위 KO 칸이 칠해져 있는지
2. VPN(미국 등)으로 시크릿 창 접속 → 영문으로 시작, EN 칸이 칠해져 있는지
3. https://monnit.co.kr/api/geo → `{"ok":true,"country":"KR"}`
