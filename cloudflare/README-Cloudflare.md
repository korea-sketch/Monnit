# monnit.co.kr — Cloudflare 운영 안내

사이트 전체가 Cloudflare Workers(무료 플랜) 한 곳에서 돌아갑니다. Netlify 는 쓰지 않습니다 (2026-10-29 정리).

## 1. 구성

| 기능 | 담당 | 비용 |
|---|---|---|
| 정적 페이지·이미지 | Workers 정적 파일 (`dist/`) | 무료 |
| 리다이렉트·헤더·예쁜 주소·404 | `_redirects` → `_headers` → `cloudflare/site-rules.toml` 순서로 Worker 가 적용 | 무료 |
| 서버 함수 (`server/functions/*`) | Worker — `/api/fn/<이름>` 또는 함수별 `config.path` | 무료 |
| IP 차단·방문 기록 (`server/edge/block-ip.js`) | Worker 가 페이지 요청마다 먼저 실행 | 무료 |
| 저장소 | R2 버킷 `monnit-blobs` (`server/lib/blobs.mjs`) | 무료(10GB) |
| 예약 작업 (adsync · health · proposal-dispatch) | Cron Trigger | 무료 |
| 맞춤 제안서 PDF 생성 | GitHub Actions (`.github/workflows/proposal-build.yml`) | 무료 |

## 2. 설정값(환경변수)

- 메일·AI·광고 키, 관제 계정 등은 R2 의 `__config/env.json` 에 저장돼 있습니다.
- 값을 바꾸거나 새로 넣을 때: Cloudflare → Workers & Pages → monnit → Settings → **Variables and Secrets** 에 같은 이름으로 넣으면 대시보드 값이 우선합니다.
- `MIGRATE_SECRET` 은 지우지 마세요. 이름만 옛것이고, 지금은 GitHub Actions 가 R2 를 읽고 쓰는 열쇠(`/api/__blobs`)로 씁니다. GitHub 비밀값에도 같은 값이 있어야 합니다.
- 예약 작업은 기본으로 켜져 있습니다. 잠시 멈추려면 변수 `CRON_ENABLED=0`.

## 3. 주소

- 서버 함수: `/api/fn/<이름>` (예: `/api/fn/sendpw`, `/api/fn/getdoc`)
- 옛 주소 `/.netlify/functions/<이름>` 도 같은 함수로 계속 받습니다 — 이미 보낸 메일의 자료 받기 링크가 열리도록 남겨 둔 것입니다.

## 4. 작업 방식

- 수정 → GitHub 커밋·푸시 → Cloudflare 가 자동 빌드·배포.
- 빌드 순서: `scripts/proposal-sync.mjs` → `scripts/support-sync.mjs` → `build.js` → `cloudflare/prepare.mjs` (wrangler.toml `[build]`).
- 배포 상태: Workers & Pages → monnit → Deployments. 오류 로그: Observability(Logs).
- 로컬 실행(선택): `npm install` → `npx wrangler@4 dev` → http://localhost:8787 (비밀값은 `.dev.vars` 파일에).

## 5. 파일

```
wrangler.toml                         Cloudflare 설정
cloudflare/worker.mjs                 진입점 (함수·IP 차단·예약·큐·정적 파일)
cloudflare/site.mjs                   리다이렉트·헤더·예쁜 주소 처리
cloudflare/site-rules.toml            리다이렉트·헤더 규칙 (_redirects · _headers 다음 순서)
cloudflare/prepare.mjs                빌드 후 dist/ 와 규칙 파일 생성
cloudflare/env-config.mjs             R2 설정값 + 대시보드 값 합치기
cloudflare/blob-api.mjs               GitHub Actions 가 저장소를 읽고 쓰는 통로 (/api/__blobs)
cloudflare/actions/build-proposal.mjs GitHub Actions 에서 제안서 PDF 를 만드는 스크립트
server/functions/*                    서버 함수
server/edge/block-ip.js               IP 차단·방문 기록
server/lib/*                          공용 모듈 (blobs.mjs = R2 저장소)
.github/workflows/proposal-build.yml  제안서 PDF 생성 작업 정의
```
