# 알리미 계약 → 먼데이 회신 파일 자동 첨부 (2026-10-26)

운영 환경: **Cloudflare Workers 전용** (Netlify 미사용). `netlify/functions/*` 폴더명은 함수 형식만 유지한 것이며 `cloudflare/worker.mjs` 가 직접 불러 실행합니다.

## 바뀐 점
- 먼데이 「알리미 계약 현황」 보드에 파일 칼럼 **「회신 파일」(file_mm8gye1m)** 추가 (보드에는 이미 생성됨)
- 날인 계약서·사업자등록증이 올라오면 (고객 회신 · 담당자 등록 모두) 해당 아이템 「회신 파일」 칸에 자동 첨부
- 「체결 완료」 처리 시
  - 발급 때 먼데이 아이템이 빠졌으면 새로 생성
  - 「구분」 → 계약 체결
  - 아직 먼데이에 없는 회신 파일 보충 업로드 (기존 계약도 체결 완료를 한 번 더 누르면 반영)
- 먼데이 작업은 모두 **응답 뒤(ctx.waitUntil)** 에 처리 → 관리 화면·고객 업로드가 먼데이 응답을 기다리지 않음 (무료 플랜 CPU 영향 없음)
- 올라간 파일은 계약 레코드에 `mondayAssetId` 로 표시 → 중복 업로드 방지

## 수정 파일
- `netlify/functions/_alarm_monday.mjs` — `attachFile()` 추가 (monday `/v2/file` 멀티파트)
- `netlify/functions/alarm.mjs` — 업로드·체결 완료 처리에 먼데이 연동, `later()`·`syncFiles()`·`markAsset()` 추가

## 배포
GitHub 에 올리면 Cloudflare 가 `wrangler.toml` 빌드 명령으로 자동 배포. 필요한 비밀값: `MONDAY_TOKEN` (기존과 동일, 추가 설정 없음).

## 참고
- 관리 화면에서 파일을 삭제해도 먼데이 첨부는 지워지지 않습니다 (먼데이에서 직접 삭제).
