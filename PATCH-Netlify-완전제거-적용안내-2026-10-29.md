# Netlify 완전 제거 — Cloudflare 전용 전환 적용 안내 (2026-10-29)

## 무엇이 바뀌나

사이트 동작은 그대로입니다. 코드에서 Netlify 에 기대던 부분을 전부 Cloudflare 기준으로 바꿨습니다.

| 이전 | 이후 |
|---|---|
| `netlify/functions/` · `netlify/edge-functions/` · `netlify/lib/` | `server/functions/` · `server/edge/` · `server/lib/` |
| `@netlify/blobs` (wrangler alias 로 R2 에 연결) | `server/lib/blobs.mjs` 를 직접 import (R2) |
| `netlify.toml` | `cloudflare/site-rules.toml` — 리다이렉트·헤더 규칙만, 순서 그대로 |
| `Netlify.env.get()` | Worker 설정값 (`globalThis.__MNK_ENV_GET`) |
| 함수 주소 `/.netlify/functions/<이름>` | `/api/fn/<이름>` (옛 주소도 계속 동작 — 이미 보낸 메일 링크용) |
| 방문자 IP 헤더 `x-nf-client-connection-ip` | `x-mnk-client-ip` (Worker 가 Cloudflare 값으로만 채움) |
| 예약 작업: `CRON_ENABLED=1` 일 때만 실행 | 기본 실행 (멈추려면 `CRON_ENABLED=0`) |
| `NETLIFY_CRON_OFF` 검사 | 삭제 |

### 삭제한 것 (Netlify → Cloudflare 이관 전용)
- `/api/blob-export` (Netlify 쪽 데이터 내보내기), `/ops/migrate` (데이터 복사 화면)
- 설정값을 Netlify 에서 받아 오던 코드 — 이제 R2 `__config/env.json` 과 대시보드 값만 읽음
- DNS 전환 기간용 Netlify 중계(`a-relay-cf.js`)와 그 서명 검사
- `*.netlify.app`, `DEPLOY_URL` · `DEPLOY_PRIME_URL` 을 「우리 사이트」로 인정하던 예외 (출처 검사가 더 엄격해짐)
- `package.json` 의 `@netlify/blobs` 의존성, GitHub Actions 의 `--import register.mjs` 로더

## 적용 순서

1. **Netlify 사이트 먼저 정리** — app.netlify.com → monnit26 → Project configuration → Build & deploy → **Stop builds**.
   이번 변경부터 Cloudflare 예약 작업이 기본으로 돌기 때문에, Netlify 쪽 예약 작업이 아직 살아 있으면 알림 메일이 두 번 나갈 수 있습니다.
2. 압축 파일 내용을 저장소에 덮어쓰기 (Finder 「대치」 가능 — `server/` · `cloudflare/` · `.github/` 는 통째로 들어 있음).
3. 저장소 루트에서 `bash Netlify-파일-삭제.sh` — `netlify/` 폴더, `netlify.toml` 등 옛 파일을 지웁니다.
   (GitHub 웹에서 올리는 경우: 위 파일·폴더를 직접 삭제)
4. 커밋·푸시 → Cloudflare 가 자동 배포.
5. 확인
   - 메인 · 프로모션 랜딩 · `/ops` 로그인 · 맞춤 제안서 접수 1건(테스트)
   - 자료 받기 메일의 링크가 열리는지 (옛 `/.netlify/functions/getdoc` 링크 포함)
   - Cloudflare → monnit → Observability 에 `[proposal-dispatch]` 로그가 10분마다 찍히는지
6. 이상 없으면 Netlify 에서 **Delete project**.

## 그대로 두는 것
- Cloudflare·GitHub 의 `MIGRATE_SECRET` — 이름만 옛것이고 GitHub Actions 가 R2 를 읽는 열쇠로 계속 씁니다. 지우면 제안서 PDF 생성이 멈춥니다.
- 대시보드의 `CRON_ENABLED=1` — 있어도 됩니다(기본과 같음).

## 검증 (로컬 Cloudflare 실행 환경)
- 빌드 결과 비교: 공개 파일 674개 · 헤더 규칙 75개 동일. 리다이렉트 395개 중 차이는 비공개 차단 규칙 `/netlify/*` → `/server/*`, `/cloudflare/*` 추가뿐.
- 주소 38개를 변경 전·후로 호출해 비교: 상태 코드·이동 주소·본문 일치. 차이는 `/api/fn/*` 새 주소가 열린 것과 이관용 `/api/blob-export` · `/ops/migrate` 가 404 가 된 것뿐.
- 예약 작업 3종 실행 확인, GitHub Actions 제안서 생성 스크립트가 로더 없이 실행되는지 확인.
- 배포 묶음(worker.js)에 Netlify API 호출이 남아 있지 않음.
