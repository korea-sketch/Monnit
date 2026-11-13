# Scube 매뉴얼 · 모니 연결 · 사용법 영상 — 적용 안내 (2026-10-29)

## 무엇이 바뀌나

### 1. 상단 Support 메뉴 → 「Scube 매뉴얼 · 플랫폼 사용법」
- Support 드롭다운(Contact Us · FAQs · Tech Support · Knowledgebase)에 항목 추가 → `/kb/scube`
- 푸터에도 「Scube 매뉴얼」 링크. 영어 화면은 Scube Platform Manual.
- `/kb/scube` = Knowledgebase의 새 분류 「Scube 플랫폼」 (맨 앞) — 12개 문서
  - 시작하기
  - 알람 조치
  - 반복 알람
  - 문자 미수신
  - 진동 읽는 법
  - 진동 기준값 (ISO 10816-3)
  - 진동 탭이 안 보일 때
  - 데이터 내보내기
  - 점검 모드
  - 알람 규칙
  - 사용자 추가
  - 모바일
- 문서마다 실제 화면 캡처, 사용법 영상, 단계, 표가 있고, 끝에 「모니에게 물어보기」 버튼이 있음.
- 시안 문서 목록(`/guide/docs`) 맨 앞에 「Scube 모니터링 플랫폼 사용자 매뉴얼」 PDF 추가.

### 2. 모니 챗봇 → 「제품 사용 중 문제가 생겼어요」 안에 Scube
- 증상 고르기 두 번째 칸에 **📈 Scube 플랫폼 사용법**이 생김.
- 답변 14개를 추가: 위 12개에 「응답 없음」과 「계정·로그인」을 더함.
- 답변 아래에는 「더 보기」로 연결:
  - 해당 PDF 페이지
  - 영상(챗 안에서 바로 재생)
  - 매뉴얼 전체
- 「스큐브·에스큐브·S-cube·라이브스팟·livespot」도 Scube로 알아들음. 기존 iMonnit 답변에는 영향 없음.
- FAQs 페이지에도 같은 분류 탭이 생김.

### 3. 바로가기 주소 (PDF·QR·문자 안내용)
| 주소 | 동작 |
|---|---|
| `monnit.co.kr/?moni=support&src=…` | 모니 기술지원 화면 바로 열림 |
| `monnit.co.kr/?moni=support&q=질문` | 질문을 넣은 채로 모니가 답변 |
| `monnit.co.kr/?moni=ticket&src=…` | 담당자 접수 양식 바로 열림 |
| `monnit.co.kr/kb/scube` | Scube 매뉴얼 목록 |
- 열린 뒤 주소창의 파라미터는 지워짐. 사이트 어디서든 `data-moni-q="질문"` 링크를 달면 모니가 열림.

### 4. 사용법 영상 4편 (자막 포함, 개인정보 블러 처리)
| 파일 | 길이 | 내용 |
|---|---|---|
| scube-01-alarm-action | 37초 | 알람 확인 → 조치 기록 |
| scube-02-vibration | 32초 | 진동 화면 읽기 · 기준값 |
| scube-03-data-export | 32초 | 기간 선택 → 엑셀 내보내기 |
| scube-04-mobile | 27초 | 휴대폰에서 보기 |
- 각 영상: MP4(H.264, 1.2–1.9MB) + WebM + 포스터. 클릭 전에는 영상을 받지 않음(`preload=none`).
- 이미지 34장은 WebP(합계 약 0.8MB).
- `/images/scube/*`, `/videos/scube/*`는 30일 캐시.

### 5. PDF 매뉴얼 (`/files/scube-user-manual.pdf`, 67쪽)
- 장마다 「모니에게 물어보기 · 영상」 링크를 둠.
- 마지막 「8.2 더 도움이 필요하면」 페이지에 QR 코드: 모니, 매뉴얼, 접수, 영상 4편.
- 전화번호, 다른 고객 현장명, API 키는 모두 빼거나 블러 처리.

## 바뀐 파일
- 수정
  - `index.html`
  - `app.js`
  - `data.js`
  - `style.css`
  - `i18n.js`
  - `_headers`
  - `js/support-chat.js`
  - `js/proposal-chat.js`
  - `js/support-kb.js` (자동 생성)
  - `netlify/lib/support/kb.data.mjs`
  - `installation-photos.html` · `promo-alarm.html` · `visit.html` (i18n 버전만)
- 신규
  - `images/scube/` (34)
  - `videos/scube/` (12)
  - `files/scube-user-manual.pdf`
- 버전: app.js v218 · style.css v240 · i18n v121 · support-chat v3 · support-kb v2 · data.js v111

## 적용
1. zip을 저장소 루트에 덮어쓰고 커밋·푸시 → Cloudflare 자동 배포. 배포 스크립트가 support-sync와 build.js를 실행하므로 따로 할 일 없음.
2. 환경변수 추가 없음.
3. 시트(Knowledgebase)에 같은 글이 없어도 `pin:true` 기본 문서라 항상 보임. 시트에 같은 id(kbs1–kbs12)로 올리면 시트 내용이 우선함.

## 확인 (로컬 빌드로 점검 완료)
- `node build.js` → 라우터 정합성 OK, `/kb/scube` 생성됨
- Support 메뉴 → `/kb/scube` 이동 → 카드 12개 표시
- `?moni=support&q=…` → 모니가 진동 답변, 영상, 매뉴얼 링크와 함께 열림
- `?moni=ticket` → 접수 양식이 열림
- 모니 「제품 사용 중 문제가 생겼어요」 → 📈 Scube 플랫폼 사용법 표시
- `/faqs` → Scube 탭, `/guide/docs` → 매뉴얼 PDF
- PDF와 영상 200 응답, 콘솔 오류 없음(로컬 /api 404 제외)
- 배포 후: 휴대폰으로 PDF 마지막 페이지 QR을 찍어 모니가 열리는지 한 번 확인
