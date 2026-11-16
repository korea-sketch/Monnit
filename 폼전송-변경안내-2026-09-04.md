# 문의 폼 메일 전송 방식 변경 안내 (2026-09-04)

## 한 줄 요약

문의 폼 알림 메일이 **Web3Forms(월 250건 무료)** 를 타던 경로를 없애고,
전 페이지가 **StaticForms** 를 먼저 쓰도록 통일했습니다. Web3Forms는 예비용으로만 남깁니다.

---

## 1. 예전엔 어떻게 됐었나

사이트에는 문의 폼이 여러 곳에 있고, 페이지마다 메일 보내는 방식이 따로 적혀 있었습니다.

| 페이지 | 예전 동작 |
|---|---|
| 홈 · 솔루션 · FAQ · 뉴스레터 등 (app.js) | StaticForms로 보냄. **실패하면 곧바로 방문자 메일 앱 열기** |
| 예지보전 상담 랜딩 (promo/consulting) | StaticForms → 실패 시 Web3Forms → 메일 앱 |
| 누수 랜딩 (promo/residence) | StaticForms → 실패 시 Web3Forms → 메일 앱 |
| 프로모션 랜딩 (promo.html) | StaticForms → 실패 시 Web3Forms → 메일 앱 |
| 교회 랜딩 (church) | StaticForms → 실패 시 Web3Forms → 메일 앱 |
| 경보 랜딩 (promo/alarm) | StaticForms로 보냄. **실패하면 곧바로 메일 앱 열기** |
| **제안 가이드 랜딩 (promo/proposal)** | **StaticForms를 아예 안 씀. 처음부터 Web3Forms로 직행** |

여기서 문제가 두 가지였습니다.

**문제 1 — 제안 가이드 랜딩만 Web3Forms 직행**
이 페이지 하나만 StaticForms 코드가 빠져 있었습니다.
`notify@web3forms.com` 에서 오던 그 접수 메일이 바로 이 페이지에서 온 것입니다.
광고를 태우는 랜딩이라 접수량이 가장 많은데, 하필 여기가 무료 250건 한도를 갉아먹고 있었습니다.

**문제 2 — 폴백이 껍데기였음 (홈·경보 랜딩)**
코드에는 "StaticForms 실패하면 Web3Forms로" 라고 적혀 있었지만,
실제로는 StaticForms 단계에서 성공/실패를 판단한 뒤 **실패면 그 자리에서 메일 앱을 여는 구조**라
Web3Forms 코드까지 도달할 수가 없었습니다. 즉 적어만 놨지 작동하지 않는 예비 경로였습니다.

이 상태에서 StaticForms가 잠깐이라도 응답하지 않으면, 방문자에게는 갑자기 메일 앱이 뜨고
대부분은 그냥 창을 닫습니다. **리드가 통째로 사라지는 구간**이었습니다.

---

## 2. 지금은 어떻게 바뀌었나

**모든 문의 폼이 아래 순서로 똑같이 동작합니다.**

```
① StaticForms   ← 평소엔 여기서 끝. 무료 한도 넉넉함
      ↓ 실패하면
② Web3Forms     ← 예비. 여기까지 오면 방문자는 아무것도 못 느낌
      ↓ 그것도 실패하면
③ 방문자 메일 앱 열기  ← 마지막 안전장치
```

바뀐 점을 표로 보면:

| 페이지 | 예전 | 지금 |
|---|---|---|
| 제안 가이드 랜딩 | Web3Forms 직행 | **StaticForms** → Web3Forms → 메일앱 |
| 홈 · 솔루션 · FAQ 등 | StaticForms → (실패 시) 메일앱 | StaticForms → **Web3Forms** → 메일앱 |
| 경보 랜딩 | StaticForms → (실패 시) 메일앱 | StaticForms → **Web3Forms** → 메일앱 |
| 나머지 랜딩 | 이미 정상 | 그대로 (변경 없음) |

효과는 두 가지입니다.

- Web3Forms 무료 250건을 평상시에 쓰지 않게 되어 **한도 걱정이 사라집니다.**
- StaticForms가 잠깐 죽어도 **접수가 조용히 Web3Forms로 넘어가** 리드를 놓치지 않습니다.

받는 메일 내용과 받는 주소는 예전과 똑같습니다. 방문자 화면도 달라진 게 없습니다.

---

## 3. 실제로 고친 파일 (5개)

| 파일 | 고친 내용 |
|---|---|
| `promo-proposal.html` | CONFIG에 `SF_ENDPOINT`/`SF_KEY` 추가, `notifyStaff()`를 StaticForms 우선으로 재작성 |
| `promo/proposal/index.html` | 위와 동일 (같은 페이지의 폴더형 사본) |
| `app.js` | StaticForms 실패 시 `mailto`로 빠지지 않고 Web3Forms 단계로 넘어가도록 수정 |
| `promo-alarm.html` | 위와 동일 |
| `promo/alarm/index.html` | 위와 동일 |

그 외 파일은 **하나도 건드리지 않았습니다.**

---

## 4. 검수 결과

| 항목 | 결과 |
|---|---|
| HTML 147개 · JS 32개 인라인 스크립트 문법 검사 | 통과 (오류 0) |
| 루트본 ↔ `promo/` 하위 사본 4쌍 일치 여부 | 4쌍 모두 완전 일치 |
| StaticForms API 키 통일 | `sf_e026c9ef91b8eaeba9d1d472` 12곳 전부 동일 |
| Web3Forms 키 통일 | `e4d5cb03-…-f04e4a05e7e2` 13곳 전부 동일 |
| 폼 있는 페이지 전송 순서 | 7개 전부 `StaticForms → Web3Forms → 메일앱` |
| StaticForms 엔드포인트 응답 | HTTP 200 (정상) |
| 원본 대비 변경 파일 | 의도한 5개만 변경 확인 |

---

## 5. 참고 — 손대지 않았지만 알아두실 점

**(1) 사이트 감시 경보 메일은 일부러 Web3Forms를 씁니다**
`netlify/functions/health.mjs` 는 15분마다 사이트와 폼 백엔드를 점검하고
이상이 생기면 `korea@monnit.com` 으로 경보를 보냅니다.
이건 StaticForms가 죽었을 때 알려주는 역할이라, 같은 StaticForms로 보내면 의미가 없습니다.
**감시용 경보는 Web3Forms에 남겨두는 게 맞습니다.** 사용량도 극히 적습니다.

**(2) 안 쓰는 것으로 보이는 폴더 2개**
- `monnit-promo-proposal/promo-proposal.html`
- `pdm-guide 2/index.html`

둘 다 예전 초안으로 보입니다. 존재하지 않는 `/.netlify/functions/capi` 를 호출하고 있어
그대로 두면 나중에 헷갈릴 수 있습니다. 삭제 여부는 확인 후 진행하겠습니다.

**(3) 배포 후 확인 방법**
`/promo/proposal` 에서 폼을 한 번 넣어보고,
StaticForms 대시보드 Inbox에 들어오는지 (그리고 `notify@web3forms.com` 메일이 **안** 오는지) 보시면 됩니다.
