# 알리미 자동 응답 메일 — 적용 안내 (2026-09-08)

`/promo/alarm` · `/promotions` 에서 알리미를 신청하면, 접수 즉시 신청자에게
제품별 HTML 소개 메일이 자동으로 나갑니다. 담당자는 그 메일을 읽었다는 전제로 전화합니다.

---

## 0. HTML 메일, 되는가

**됩니다.** 이미 쓰고 계신 Brevo API 의 `htmlContent` 필드가 그 용도입니다.
`sendguide.js` 가 `textContent` 로 보내던 것을 `htmlContent` + `textContent` 두 개로 보내는 것뿐이라
새로 붙이는 서비스도, 추가 비용도 없습니다.

- `htmlContent` — 사진·표·버튼이 들어간 본문
- `textContent` — HTML 을 못 읽는 환경(구형 클라이언트, 문자 요약, 접근성 도구)에서 자동으로 대체됨

둘 다 넣는 것이 표준이라 그렇게 만들었습니다.
이미지는 메일에 첨부(CID)하지 않고 `https://monnit.co.kr/email/images/...` 로 불러옵니다.
메일이 가볍고, 나중에 이미지만 교체해도 이미 보낸 메일에 반영됩니다.

---

## 1. 무엇이 바뀌었나

### 새로 추가된 파일

```
email/template.html                      메일 본문 마스터 (플레이스홀더 포함)
email/products.json                      제품 4종 문구·이미지·링크 데이터
email/images/                            메일용 이미지 15종 (1.3MB)
netlify/functions/_alarmmail.mjs         렌더러 + Brevo 발송
netlify/functions/mailpreview.mjs        미리보기·테스트 발송 (/api/mailpreview)
files/alarm-service-4types.pdf           안내 자료 3종 (첨부 대신 링크로 나갑니다)
files/scube-platform-2026.pdf
files/monnit-korea-company-profile.pdf
```

### 수정된 파일 (6개)

| 파일 | 내용 |
|---|---|
| `netlify/functions/lead.mjs` | `sendAlarmReply` 호출 추가, `알리미 모델`을 `lead.product` 로 인식, **`notified` 플래그 반영 (알림 중복 발송 수정)** |
| `promo-alarm.html` | **`/api/lead` 를 1순위로 (알림 중복 발송 수정)** |
| `promo/alarm/index.html` | 위 파일의 빌드 사본 — `node build.js` 가 자동 생성 |
| `netlify.toml` | `included_files` 에 메일 템플릿 추가, `/email/images/*` 캐시 헤더 |
| `_redirects` | `email/template.html` · `email/products.json` 공개 차단 |
| `build.js` | 주석 제거기가 `email/` 을 건너뛰도록 (Outlook 조건부 주석 보호) |

---

## 1-1. 접수 알림이 두 통씩 오던 문제 (2026-09-08 수정)

`/promo/alarm` 에서 신청 한 건에 알림 메일이 두 통씩 도착하고 있었습니다.

```
[프로모션 사전신청] 긴급 경보 알리미 상시 프로모션 — …   20:40
[모넷·접수]        긴급 경보 알리미 상시 프로모션 — …   20:40
```

**원인은 두 가지가 겹친 것입니다.**

1. `promo-alarm.html` 이 `app.js` 와 별개로 자기만의 `sendLead()` 를 갖고 있는데,
   이게 2026-09 개편 **이전 버전**이었습니다. 서버(`/api/lead`)를 거치지 않고
   브라우저에서 StaticForms 로 곧장 보냅니다 → 첫 번째 메일.
   그 뒤 `MonnitLead.track()` 이 원장에 기록하면서 `/api/lead` 를 부르고,
   서버가 `notify()` 로 한 통 더 보냅니다 → 두 번째 메일.

2. 이 상황을 막으라고 `monnit-lead.js` 가 `notified` 플래그를 함께 보내고 있었는데,
   **`lead.mjs` 가 그 값을 읽지 않고 있었습니다.** 브라우저가 "이미 보냈다"고 알려도 서버가 또 보냈습니다.

**고친 방식** — `app.js` 가 이미 쓰고 있던 순서에 맞췄습니다.

- `promo-alarm.html` : `MonnitLead.submit()`(서버) 을 1순위로 시도.
  성공하면 거기서 끝냅니다. 서버가 죽었을 때만 StaticForms 로 내려가고,
  그때는 `setNotified(true)` 로 표시합니다.
- `lead.mjs` : `body.notified === true` 면 `notify()` 를 건너뜁니다.

**검증** — 폼 제출 흐름을 그대로 재현해 실제 발송 횟수를 셌습니다.

| | 수정 전 | 수정 후 |
|---|---|---|
| 서버 정상 | **2통** | 1통 (`[모넷·접수]`) |
| 서버 다운 | 1통 | 1통 (`[프로모션 사전신청]`) |

고객에게 나가는 자동 응답(`sendAlarmReply`)은 서버만 보내므로 이 조건과 무관하게 항상 1통 나갑니다.

> 참고: 자체 `sendLead()` 를 가진 페이지는 `promo-alarm.html` 하나뿐입니다.
> `promo-consulting.html` · `promo-proposal.html` 은 공용 `app.js` 를 쓰므로 이 문제가 없었습니다.

---

## 2. 발송 조건

`/api/lead` 로 접수가 들어오면 다음을 **모두** 만족할 때만 나갑니다.

1. `BREVO_API_KEY` 가 설정돼 있음
2. `ALARM_MAIL_OFF` 가 `1` 이 아님
3. 이메일이 형식에 맞음 — `(미기재)` 나 빈 값이면 건너뜀
4. `알리미 모델` 또는 `신청 프로모션` 값에 **'알리미'** 라는 말이 있고, 4종 중 하나로 해석됨

4번이 중요합니다. `문의항목`에 "화재 관련 문의" 같은 자유 입력이 들어와도
소방 알리미 소개문이 나가지 않도록 `알리미` 가 붙은 경우로 한정했습니다.

| 폼 값 | 결과 |
|---|---|
| `소방 알리미` | 소방 메일 발송 |
| `소방 알리미, 물감지 알리미` | **소방 메일 1통**. 나머지는 담당자가 통화에서 다룸 (4통 한꺼번에 보내면 스팸 분류됨) |
| `커스텀 알리미` | 발송 안 함 (`skipped: no_product`) — 맞는 소개문이 없음 |
| `화재 관련 문의` | 발송 안 함 (`skipped: not_alarm`) |

메일 발송이 실패해도 **접수·알림·먼데이 연동은 그대로 진행됩니다.**
`Promise.allSettled` + 함수 내부 `try` 로 이중으로 막아 뒀습니다.

---

## 3. 배포 전 해야 할 일

### (1) 환경변수 — Netlify → Site settings → Environment variables

| 변수 | 값 | 필수 |
|---|---|---|
| `BREVO_API_KEY` | 기존 값 그대로 (이미 있음) | ● |
| `MAIL_PREVIEW_TOKEN` | 아무 문자열 (예: `mnk-preview-2026-a91f`) | 테스트 발송용 |
| `ALARM_MAIL_OFF` | 문제 생겼을 때만 `1` | — |
| `MAIL_FROM` | 기본 `no-reply@monnit.co.kr` | — |
| `MAIL_REPLYTO` | 기본 `korea@monnit.com` | — |

발신 주소를 바꾸지 마세요. `monnit.com` 은 본사 도메인이라 DMARC 가 `p=reject` 이고
SPF·DKIM 에 Brevo 가 없어서, 그 주소로 보내면 수신측이 스푸핑으로 보고 거부합니다.
(`sendguide.js` 주석에 이미 적혀 있는 내용입니다.) 답장은 `korea@monnit.com` 으로 옵니다.

### (2) 배포 후 확인

```
https://monnit.co.kr/api/mailpreview?status              ← 키가 꽂혔는지
https://monnit.co.kr/api/mailpreview?p=fire              ← 소방 메일 눈으로 확인
https://monnit.co.kr/api/mailpreview?p=water&name=김철수
https://monnit.co.kr/api/mailpreview?p=fire&to=korea@monnit.com&t=<MAIL_PREVIEW_TOKEN>
                                                          ← 실제 수신함으로 테스트 발송
```

네이버메일·Gmail·아웃룩 세 곳에서 한 번씩 열어보시길 권합니다.
특히 **아웃룩에서 폭이 600px 로 잡히는지**, **모바일에서 센서 사진이 텍스트 위로 내려오는지** 두 가지를 보세요.

### (3) 발송 이력 확인

`ops` 저장소의 `automail-YYYY-MM.jsonl` 에 한 줄씩 쌓입니다.

```json
{"ts":"...","email":"...","product":"fire","sent":true,"note":""}
```

`sent:false` 이면 `note` 에 이유가 들어 있습니다 (`no_key` / `no_email` / `not_alarm` / `no_product` / `brevo 4xx ...`).
리드 원장(`leads`)은 건드리지 않습니다 — 같은 파일을 두 번 쓰면 동시 접수 때 한 건이 덮여 사라집니다.

---

## 4. 첨부 대신 링크로 바꾼 이유

원본 메일은 PDF 3종(합계 16MB)을 첨부하고 있었습니다.

- 수신 서버 첨부 한도(보통 25MB)에 가깝고, 사내 메일 게이트웨이는 10MB 에서 막는 곳이 많습니다
- 첨부가 큰 메일은 스팸 점수가 올라갑니다
- 열어보지도 않는 사람에게 매번 16MB 를 보내게 됩니다

그래서 `files/` 에 올려두고 본문 하단 버튼으로 링크했습니다.
용량도 줄였습니다 (Ghostscript, 이미지 144dpi 다운샘플 — 텍스트는 그대로).

| 자료 | 원본 | 현재 |
|---|---|---|
| 알리미 서비스 4종 | 775KB | 775KB (원본 유지) |
| S-CUBE 플랫폼 소개 | 6.7MB | **1.3MB** |
| 회사소개서 | 8.5MB | **5.8MB** |

첨부로 되돌리고 싶으시면 `_alarmmail.mjs` 의 `brevo()` 호출에 Brevo 의 `attachment` 필드를 추가하면 됩니다.
다만 위 이유로 권하지 않습니다.

---

## 5. 문구·가격 수정

전부 `email/products.json` 에 있습니다. 레이아웃은 `email/template.html` 하나만 고치면 4종에 동시 반영됩니다.
배포 후 `/api/mailpreview?p=...` 로 확인하세요.

`email/` 폴더는 함수가 읽는 원본입니다. 공개 접근은 `_redirects` 에서 막혀 있고
`/email/images/*` 만 열려 있습니다 (메일이 불러가야 하므로).

---

## 6. 원문에서 의도적으로 바꾼 곳

### 담당자 개인 명함 → 회사 공용 연락처

원본 메일 하단에 있던 **황미경 매니저 개인 명함 이미지**를 뺐습니다.
자동 발송이라 누가 배정될지 모르는 상태에서 개인 명함이 나가면 안 됩니다.
대신 회사 공용 연락처 블록(02-2088-1454 · 010-3000-7397 · korea@monnit.com)을 텍스트로 넣었습니다.
텍스트라 이미지 차단 환경에서도 보이고, 담당자가 바뀌어도 고칠 게 없습니다.

### 설치비 안내 삭제

원본에 있던 "서울·경기·인천권은 별도 설치비가 발생하지 않습니다 / 그 외 지역은 문의" 블록을
**HTML·텍스트 양쪽에서 전부 뺐습니다.** 메일에서 답을 다 주면 전화가 오지 않습니다.

대신 가격 카드 하단 문구를 물어보게 만드는 쪽으로 바꿨습니다.

> 기존 : 원하시는 수량을 알려주시면 더 자세한 견적을 안내해 드리겠습니다.
> 현재 : **설치 환경과 수량에 따라 구성이 달라집니다. 현장 조건을 알려주시면 맞춤 견적을 안내해 드리겠습니다.**

"환경에 따라 달라진다"까지만 말하고 금액은 말하지 않으므로, 궁금하면 연락하게 됩니다.

### 경보 버전 오타 수정

원본 경보 버전에 `정전 알리미 패키지 살펴보기` · `정전 알리미 솔루션은 보일러·펌프…` 로
잘못 적혀 있던 부분을 **경보**로 고쳤습니다. 소방의 확장 목록도 원문대로 물감지 제외로 맞췄습니다.

### 내부 메모 제거

`- 수정이나 자동화가 필요한 부분은 파란색 글씨로…` , `[경보 알리미 버전 최종]` 같은
작업용 메모는 발송본에서 뺐습니다.

---

## 7. 아직 정해야 할 것

### 블로그 링크

소방은 화재 알리미 글, 나머지 3종은 원본과 같은 "긴급 경보 알리미" 글로 갑니다.
제품별 전용 글이 있으면 `products.json` 의 `BLOG_URL` 만 바꾸면 됩니다.

### 수신거부

전용 페이지가 없어서 지금은 `mailto:korea@monnit.com` (제목 자동 입력)으로 되어 있습니다.
신청자 본인에게 보내는 안내 메일이라 현행 문안으로 문제없지만,
나중에 광고성 내용을 섞을 계획이면 `/unsubscribe` 페이지를 만들고
`products.json` 의 `UNSUBSCRIBE_URL` 을 바꿔 주세요. (그 경우 제목에 `(광고)` 표기도 필요합니다.)

---

## 8. 되돌리기

문제가 생기면 환경변수 `ALARM_MAIL_OFF=1` 만 넣고 재배포하면 자동 응답이 즉시 멈춥니다.
접수·알림·먼데이 연동은 그대로 돌아갑니다.

완전히 걷어내려면 `lead.mjs` 의 `import { sendAlarmReply }` 줄과
`Promise.allSettled` 안의 `sendAlarmReply(...)` 한 줄, 그 아래 `append('ops', 'automail-...')` 블록만 지우면 됩니다.
