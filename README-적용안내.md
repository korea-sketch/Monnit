# 최종 적용 파일 (2026-08-25) — 이 zip 하나만 저장소 루트에 풀어서 커밋하세요

압축을 저장소 루트에 그대로 풀면 아래 4개 파일이 제 위치에 덮입니다.

| 파일 | 역할 |
|---|---|
| `build.js` | ① `/promo/residence` 물리 경로(promo/residence/index.html) 자동 생성 → 어떤 리다이렉트 규칙보다 우선이라 라우팅 100% 해결 ② JS 실패 시 노출되는 SSG 폴백에 최소 스타일 내장(무스타일 원문 노출 방지) ③ sitemap 에 /promo/residence 추가 |
| `netlify.toml` | /promo/residence 리라이트 3종 (이중 안전망) |
| `images/promo-residence.jpg` | OG 배너 (레지던스 객실 씬 + 골드 타이포, 타사 기기 제거판) |
| `images/promo-residence.webp` | 프로모션 카드 배너 (동일 디자인) |

## 일부러 넣지 않은 것 (덮어쓰면 안 되는 파일)
- `promo-residence.html` — 현재 배포본이 더 최신 버전(취사시설 필드·확장 FAQ 포함)이라 그대로 두는 게 맞습니다.
- `app.js` — 프로모션 카드가 이미 라이브에 정상 노출 중이므로 손대지 않습니다.

## 커밋 메시지 제안
```
fix(promo): /promo/residence 라우팅 확정 + SSG 폴백 스타일 + 레지던스 배너 교체
```

## 배포 후 확인
- [ ] https://monnit.co.kr/promo/residence → 골드 톤 레지던스 랜딩 표시
- [ ] /promotions 그리드 카드가 새 배너(객실 씬)로 교체됨
- [ ] 모바일 무스타일 화면이 났던 기기에서 사전예약 페이지 재확인
