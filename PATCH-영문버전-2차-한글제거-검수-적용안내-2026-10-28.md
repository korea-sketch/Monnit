# 영문(EN) 버전 2차 정비 — 한글 노출 제거 · 전 페이지 검수 (2026-10-28)

1차 패치(PATCH-영문버전-전수정비-적용안내-2026-10-28.md) 위에 이어서 작업했습니다.
라이브(monnit.co.kr)는 아직 1차 이전 버전(app.js v214)이라, 대표님 캡처의 한글 섞인 사례 카드는 1차·2차를 올리면 영문으로 나옵니다.

## 검수 방법
- 사이트맵 전 경로 + 단독 페이지(/visit, /promo/*, /church, 설치 사례, 개인정보처리방침) 137개를 영문 모드로 열어 화면의 한글을 전수 수집 (데스크톱 1440px · 모바일 390px)
- 버튼·탭·필터·아코디언·폼·달력·라이트박스·모니 대화창 등을 자동으로 눌러 가며 상태가 바뀐 화면까지 다시 수집 (페이지당 최대 200회)
- 구글 시트 실데이터를 그대로 불러온 상태에서 검수
- 결과: 화면에 보이는 한글 0건 (기술문서 본문 제외 — 아래 참고)

## 고친 것
1. **번역 사전 보강 약 3,400건** (`js/i18n-extra.js`, 영문 전환 시에만 로드 → 한국어 방문자 영향 없음)
   - 현장 진단 예약(달력·시간·폼·확인 화면), Modbus 랜딩, 무료체험(컨설팅) 랜딩, 온도 감시 랜딩, 알리미 구독 빌더, 설치 사례 73건, 교회 랜딩
   - 맞춤 제안서 데이터·대화, 모니 기술지원(빠른 질문·답변), 지역명(시·군·구 220여 개), 디지털 트윈, 쿠키 동의, 팝업, 폼 검증 메시지
   - 개인정보처리방침 영문 번역 + "한국어본이 우선" 안내 문구
2. **숫자가 바뀌는 문구 자동 번역** — 날짜(11월 3일 (화) → Tue, Nov 3), 시간대, 예약 슬롯, 요금(월 구독료 40,000원), 배터리 계산기, 프로모션 마감 안내, "○○ 어플리케이션", "가운뎃점(·)으로 이은 목록" 등
3. **Modbus 랜딩이 영문으로 안 바뀌던 문제** — 실제로 서빙되는 `promo/modbus/index.html` 사본에 영문 로더가 빠져 있었음. promo-*.html 원본과 promo/*/index.html 사본을 다시 맞춤
4. **기술문서(지식베이스·가이드)** — 본문은 한국어 번역본이라 영문 모드에서는 숨기고, 같은 제목으로 Monnit 본사 영문 KB(support.monnit.com)를 검색하는 버튼을 보여 줌
5. **모니 기술지원 대화** — 영문 모드에서 서버에 lang=en 을 보내고, 규칙 답·AI 답 모두 영어로 (`netlify/lib/support/answer.mjs`, `netlify/functions/support-chat.mjs`)
6. **알리미 상단 배너 이미지** — "출시 6개월 만에 누적 가입 시설 1,000+ 돌파" 글자가 박힌 이미지 → 영문판 이미지(PC·모바일) 제작, 영문 모드에서 자동 교체 (`data-en-src`)
7. **영문 표현 다듬기** — "Server-Room", "Semiconductor-Fab" 처럼 하이픈으로 붙은 어색한 영문(시트 영문 포함)을 자동으로 띄어 씀
8. **사례 카드 모바일** — 업종 태그(MANUFACTURING & INDUSTRY)가 글자 중간에서 끊기던 문제 수정
9. **KO 버튼 위치** — 단독 페이지에서 떠 있는 KO 버튼이 머리말 버튼(제안서 받기·상담 문의)과 라이트박스 닫기 버튼을 가리던 문제 → 각 페이지 머리말 안으로 넣음
10. 현장 진단 예약 페이지 영문 줄바꿈 정리 (visit.css)

## 그대로 둔 것 (참고)
- **이미지 안의 한글** — 휴대폰 화면 목업, 제안서 샘플 표지, 일부 프로모션 썸네일 등 이미지에 박힌 글자는 이미지 교체가 필요합니다 (알리미 배너만 영문판 제작)
- **메일·PDF 제안서** — 서버가 보내는 안내 메일과 PDF 제안서는 한국어
- **알리미 계약서·설문·SLA 동의 페이지**(contract, survey, sla-consent) — 국내 계약 고객 전용 문서라 한국어 유지
- 구글 시트에서 **새로 추가·수정한 한글 문구**는 사전에 없으므로 영문 화면에 한글로 나옵니다 → 해당 행의 *_en 열을 함께 채워 주세요
  (Applications·AppDetails 탭 영문 열 재정리 후 app.js `SHEET_EN_APPS = true` — 1차 안내 그대로)

## 바뀐 파일
i18n.js · js/i18n-extra.js · js/support-chat.js · app.js(버전) · style.css · visit.css · visit.html ·
promo-alarm/consulting/modbus/proposal/residence.html 와 promo/*/index.html 사본 · promo/temperature/index.html ·
installation-photos.html · church/index.html · privacy.html · index.html 외 하위 index(버전) ·
netlify/lib/support/answer.mjs · netlify/functions/support-chat.mjs ·
images/alarm/alarm-milestone-banner-en.webp · images/alarm/alarm-milestone-banner-mobile-en.webp (신규)
캐시 버전: style.css v238 · app.js v216 · i18n.js v119 · i18n-extra v2 · support-chat v2 · visit.css v2
