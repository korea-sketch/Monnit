# 커밋: 프로모션 2종 동시 오픈 (2026-08-25)

## 제안 커밋 메시지
```
feat(promo): 레지던스 물넘침알람 + 사전예약 프로모션 동시 오픈 (8/25)

[residence — 신규, 8/25~9/24 한 달 한정]
- promo-residence.html: /promo/residence 전용 랜딩
  · Consent Mode v2(GTM/GA4/Clarity) + monnit-lead.js 규격
  · StaticForms→Web3Forms→mailto 3단 폴백 + /api/lead 원장(OPS) 기록
  · 개인정보(필수)/마케팅(선택) 동의, KST D-day 카운트다운, 9/24 후 자동 마감 문구
  · canonical/OG/JSON-LD(WebPage·FAQPage), sitemap·llms.txt 반영
- netlify.toml: /promo/residence 리라이트 3종
- images/promo-residence.webp(카드)·.jpg(OG)

[flame-reservation — 사전예약, 오픈일 명시]
- app.js: start '2026-08-25' 지정(오늘 오픈), end 없음(상시) — 기존 병합된
  전용 정적 페이지·flame_reservation_apply 리드 접점은 검증 완료

[공통]
- app.js BUILTIN_PROMOS 정렬: residence(0) → flame-reservation(1) → consulting(2)
- build.js: sitemap 에 /promo/residence(0.9) 추가
```

## 이번 커밋 변경 파일
| 파일 | 내용 |
|---|---|
| `promo-residence.html` | 신규 랜딩 |
| `images/promo-residence.jpg` / `.webp` | OG·카드 배너 (코드 생성 시안 — 실사 교체 가능) |
| `netlify.toml` | `/promo/residence` 리라이트 |
| `app.js` | residence 등록 · flame-reservation start=8/25 · order 재정렬 |
| `build.js` | sitemap 항목 추가 |

## 연동 검증 결과 (커밋 전 확인 완료)
- residence 랜딩: 태그 균형·인라인 JS 문법·JSON-LD 파싱 ✅ / consent·lead·StaticForms·record·dataLayer 포함 ✅
- 사전예약(flame-reservation): 전용 정적 페이지에 consent·lead 스크립트 ✅,
  폼 → app.js `sendLead()` (GoogleForms→StaticForms→Web3Forms→mailto) ✅,
  성공 시 `MonnitLead.track('contact',{page:'flame_reservation_apply'})` → `/api/lead` 원장(OPS 콘솔) 기록 ✅
- app.js / build.js `node --check` 통과 ✅
- sitemap: residence 수동 등록 ✅ · flame-reservation 은 빌드 시 자동 포함(전용 링크 없음 규칙) ✅
- llms.txt(GEO): 두 프로모션 모두 PROMOS 병합으로 빌드 시 자동 서술 ✅

## ⚠️ 대용량 영상 처리 (커밋 차단 이슈 해결)
- `videos/flame-immersive-4k.mp4`(333MB)는 GitHub 100MB 한도 초과로 **저장소에서 제외**했습니다(.gitignore 등록, zip에도 미포함).
- `app.js`의 영상 참조를 웹용 `flame-immersive-4k-web.mp4`(94MB)로 교체 — 화질용 원본이 꼭 필요하면 Git LFS 또는 외부 스토리지(CDN) 사용을 권장합니다.
- 94MB 파일도 GitHub 경고(50MB+) 대상이므로, 추후 CDN 이전을 검토하세요.

## 배포 후 체크리스트
- [ ] `/promo/residence` — D-day 배지, 테스트 접수 → 메일 수신 + `/ops` 에 `promo_residence` 기록
- [ ] `/promotions/flame-reservation` — 사전예약 접수 → `/ops` 에 `flame_reservation_apply` 기록
- [ ] `/promotions` 그리드 순서: 물넘침알람 → 사전예약 → 컨설팅
- [ ] GA4 실시간 `generate_lead` 이벤트 2종 확인
- [ ] 빌드 로그에서 sitemap/llms 생성 확인

## 운영 메모
- residence 기간 변경: `app.js`(end)와 `promo-residence.html` 하단 `END` 상수 두 곳 동시 수정
- 사전예약 마감 시: `app.js` flame-reservation 에 `end` 날짜 지정
- 편집기(구글시트) 관리 전환: Promotions 탭에 해당 id 행 추가 시 시트 값 우선
- 광고 링크: `/promo/residence?utm_source=...&promo=residence` — 출처 자동 기록
