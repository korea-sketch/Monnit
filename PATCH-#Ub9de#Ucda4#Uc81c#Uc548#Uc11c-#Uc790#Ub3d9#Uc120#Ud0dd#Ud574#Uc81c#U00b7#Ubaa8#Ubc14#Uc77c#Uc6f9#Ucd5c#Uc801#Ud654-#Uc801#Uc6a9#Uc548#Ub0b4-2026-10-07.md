# 맞춤 제안서 자동 선택 해제 + 모바일·웹 최적화 (2026-10-07)

## 바뀐 파일 (레포 같은 경로에 덮어쓰기)
- js/proposal-view.js (v=55)
- style.css (v=234)
- app.js — proposal-view.js 버전만 54 → 55
- index.html, proposal/, whitepaper/, our-solution/, what-we-do/, faqs/, newsletter/ 의 index.html — style.css 버전만 233 → 234

## 내용
1. 맞춤 제안서 옵션 자동 선택 제거 — 파인더·광고 주소(industry=)·임시저장 값으로 산업/과제를 미리 고르지 않음. 산업을 고객이 직접 골라야 과제 목록이 열림.
2. 회사명으로 업종 인식 시 자동 반영하지 않고 「○○ 선택하기」 버튼만 표시.
3. 숨겨진 단계의 제목(예: 「03 대비하고 싶은 위험」)이 미리 보이던 문제 수정.
4. 단계 이동 시 제목이 상단 메뉴에 가리던 문제 수정(scroll-margin).
5. 모바일: 하단 고정 버튼 뒤 내용이 비쳐 겹치던 것 → 배경 페이드, 모니 런처 축소.
6. 웹 1024~1680px: 헤더 검색창이 화면 오른쪽 밖으로 밀리던 문제 → 돋보기 버튼 + 펼침 검색창.

## 참고
- 라이브(monnit.co.kr)와 비교 시 js/proposal-chat.js(v=32, 챗봇 규모·도입시점 전달)는 레포에만 있고 아직 배포 전이었음 — 이번 커밋과 함께 반영됨.

---
# 추가 — 기록 점검 후 미해결 항목 처리 (2026-10-07)

## 이번에 고친 것
7. 첫 방문 시 프로모션 팝업이 쿠키 동의 배너를 덮어 「모든 쿠키 수락」을 누를 수 없던 문제 → 배너에서 고른 뒤에 팝업 표시 (js/monnit-popup.js v=4)
8. 쿠키 동의 배너가 PC 첫 화면을 약 280px 덮던 문제(알리미 랜딩 「남은 것」) → PC 147px 한 줄 배치, 모바일 버튼 2열 (js/monnit-consent.js v=112). 두 버튼 크기·색 동일 유지
9. 맞춤 제안서 모바일 레이아웃 이동(CLS 0.25 → 0.02) — 산업 버튼 자리 미리 확보
10. 모니 캐릭터 이미지 assets/moni/moni.png 766KB → 15KB (1254px → 360px, 표시 크기 최대 108px)

## 사람이 처리해야 하는 것 (코드로 못 함)
- StaticForms·Web3Forms 키가 promo-proposal.html·js/monnit-send.js 소스에 그대로 공개 — 두 키 재발급 후 교체 (2026-09-30 기록)
- 개인정보처리방침에 IP·방문기록 이용 목적 「보안·부정 이용 방지」, 보유 기간 「90일」 문구 없음 (경쟁사 차단 기록)
- en.monnit.co.kr DNS 정리 (SEO 기록) — 여전히 응답 없음
- 시트 InstallPhotos: Dropbox 비공개 링크 3장, 업로드 흔적(C:\fakepath) 정리
- GA4 generate_lead 주요 이벤트 설정 (2차작업 기록)

## 판단 필요 (보고만)
- ui/ops-app.html 원본이 _ops_ui.mjs 보다 오래됨 — tools/build-ops-ui.mjs 실행 금지 유지
- index.html <img> 127개 width/height 없음 (현재 홈 CLS 0.007이라 영향 작음)
- style.css 589KB(br 전송 114KB) 렌더 차단 — 크리티컬 CSS 분리는 별도 작업

## 참고
- promo-consulting-미리보기.html 도 팝업·동의 스크립트 버전만 올라가는 파일이지만, 압축본 파일명이 깨져 있어 패치에서 뺐습니다(미리보기용이라 영향 없음).
