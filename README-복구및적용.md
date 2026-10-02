# 긴급 복구 + 적용 (2026-08-26) — 이 zip 하나를 저장소 루트에 풀어서 커밋

## ⚠️ 이미지 전멸 사고 원인과 복구
어제 zip을 풀 때 **macOS Finder 가 images 폴더를 '병합'이 아니라 '통째로 대치'** 하면서
기존 이미지 100여 개(로고·프로모 배너·사전예약 제품컷 등)가 삭제된 상태로 커밋됐습니다.
→ 이 zip 의 `images/` 는 **원래 이미지 118개 전부 + 레지던스 배너 2개**가 들어있는 완전 세트입니다.
   이번에는 Finder 가 대치해도 안전합니다. 풀고 나서 `images` 폴더 안 파일 수가 120개인지 확인하세요.

## 포함 파일
| 파일 | 내용 |
|---|---|
| `images/` (120개) | 사이트 전체 이미지 복구 + promo-residence 배너 |
| `promo-residence.html` | 라이브 최신판(취사시설 필드·강화 FAQ) 기준 + ① 사이트 상단바(홈·제품·전체 프로모션·상담 링크, 다크 글래스) ② GTM/GA4/Clarity 동의모드 ③ 접수 3단 전송 + /api/lead 원장(OPS) ④ D-day 카운트다운(9/24 자동 마감) ⑤ canonical/OG/JSON-LD |
| `build.js` | /promo/residence 물리 경로 자동 생성(라우팅 확정) + SSG 폴백 스타일 + sitemap |
| `netlify.toml` | /promo/residence 리라이트 (이중 안전망) |

## 커밋 메시지
```
fix: images 전체 복구 + residence 랜딩(상단바·리드연동) + /promo/residence 라우팅 확정
```

## 배포 후 확인 (순서대로)
- [ ] 홈·/promotions — 로고와 카드 이미지 전부 복구됐는지
- [ ] /promotions/flame-reservation — 제품 이미지 표시
- [ ] /promo/residence — 골드 랜딩 + 상단 네비게이션 바
- [ ] 랜딩에서 테스트 접수 → korea@monnit.com 수신 + /ops 콘솔 기록
