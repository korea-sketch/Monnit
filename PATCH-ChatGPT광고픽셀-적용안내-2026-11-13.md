# ChatGPT(OpenAI) 광고 픽셀 · 전환 API — 적용 안내 (2026-11-13)

픽셀 ID `9ewGG1XjnBQr6bSLcrgiHp`

## 왜 스니펫을 `<head>` 에 그대로 붙이지 않았나

- 사이트 보안 헤더(CSP)가 `bzrcdn.openai.com` 을 막고 있어, 그대로 붙이면 스크립트가 **차단**됩니다(브라우저로 확인).
- 이 사이트는 광고 픽셀을 「광고·마케팅」 동의 뒤에만 올립니다(메타와 같은 규칙). 그래서 동의 관리 스크립트 안에 넣었습니다.
  `js/monnit-consent.js` 는 145개 페이지에 이미 들어 있어 HTML 은 손대지 않았습니다.

## 바뀐 것

| 파일 | 내용 |
|---|---|
| `_headers` | 공통 CSP 에 `script-src bzrcdn.openai.com`, `connect-src bzr.openai.com bzrcdn.openai.com` 추가 |
| `js/monnit-consent.js` | 픽셀 로더. 동의 시 `consent true → init → page_viewed`, 거부 시 `consent false`(픽셀 쿠키 삭제). 배너·설정 문구에 OpenAI 추가 |
| `js/monnit-lead.js` | 접수 성공 시 `lead_created`(문의·자료요청), `registration_completed`(뉴스레터 구독). `event_id` = 접수 ID |
| `server/functions/_oai_capi.mjs` (신규) | 전환 API — 접수를 서버에서 OpenAI 로 전송 |
| `server/functions/lead.mjs` | 접수 원장 기록 뒤 전환 API 호출. 결과는 `ops/oai-capi-YYYY-MM` |
| `server/functions/ops.mjs` | `/ops/diag` 에 `oaiCapi`(키 설정 여부) 표시 |
| `privacy.html`, `promo-consulting.html`, `promo/consulting/index.html` | 광고 도구·국외 이전 수령인에 OpenAI OpCo, LLC 추가, 개정일 11월 13일 |
| `tools/test-consent-pixel.mjs` | ChatGPT 픽셀 검증 25항목 추가 |

## 동작

- 국내(안내형): 첫 화면부터 픽셀이 뜹니다. 해외(사전 동의): 배너에서 수락한 뒤에 뜹니다.
- `debug` 는 평소 꺼 두었습니다. 주소 뒤에 `?oai_debug=1` 을 붙이면 콘솔에 픽셀 동작이 찍힙니다.
- 전환 API 는 메타와 같은 조건입니다 — 광고 측정에 동의한 접수만, 이메일·전화번호 없이(접수 사실·IP·브라우저 정보·픽셀 쿠키 `__oppref`·`__obref`), 전화 클릭·테스트·기술지원 접수 제외.
  브라우저 픽셀과 같은 ID 로 보내므로 한 건으로 합쳐집니다.

## 해 주셔야 할 것

1. **전환 API 키 넣기** — Cloudflare → monnit → Settings → Variables and Secrets → **Secret** `OPENAI_ADS_API_KEY`.
   키가 없으면 서버 전송만 꺼지고 브라우저 픽셀은 그대로 동작합니다. 키는 코드·저장소에 적지 않습니다.
2. 배포 후 확인 — 광고 관리자 → Conversions → Data Source → 픽셀 ⋯ → **Test** 에 `https://monnit.co.kr/` 입력.
   Event Stream 에 `page_viewed` 가 보이면 정상. 문의 1건을 넣으면 `lead_created` 가 보입니다(테스트 이벤트도 통계에 집계됩니다).
3. (선택) 서버 전송만 시험하려면 `OPENAI_ADS_VALIDATE=1` — 검증만 하고 저장하지 않습니다. 확인 후 변수 삭제.

## 확인이 필요한 것

- 개인정보처리방침·쿠키 배너에 수령인을 **OpenAI OpCo, LLC(미국)** 로 적었습니다(OpenAI 광고 약관의 EEA 외 지역 계약 당사자). 문구는 검토해 주세요.
- 영문 사전(`i18n.js`)은 손대지 않았습니다. 배너의 Meta·안내형 문구도 원래 영문 사전에 없어, 영문 화면에서는 이 문구들이 한글로 보입니다.
- 결제·계정 화면(`/pay` `/account` 등)과 몰(`mall.html` `store.html`)은 동의 스크립트가 없어 픽셀이 뜨지 않습니다(구글·메타도 동일).

## 검증

- `node tools/test-consent-pixel.mjs` — 45 pass / 0 fail (기존 20 + 신규 25)
- 전환 API 본문·제외 조건 15항목 통과(네트워크는 가짜로 대체)
- 실제 브라우저 + 사이트 CSP: 수정본은 위반 없이 SDK 로드·이벤트 전송, 예전 CSP 로는 차단됨을 대조 확인.
  OpenAI 주소는 가짜로 바꿔 실제 픽셀에는 시험 데이터를 보내지 않았습니다 — **실제 수신 확인은 위 2번으로 해 주세요.**
