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
| 방문자 IP 헤더 `x-nf-client-connection-ip` | `cf-connecting-ip` (Cloudflare 가 넣는 값, 위조 불가) |
| 예약 작업: `CRON_ENABLED=1` 일 때만 실행 | 기본 실행 (멈추려면 `CRON_ENABLED=0`) |
| `NETLIFY_CRON_OFF` 검사 | 삭제 |

### 삭제한 것 (Netlify → Cloudflare 이관 전용)
- `/api/blob-export` (Netlify 쪽 데이터 내보내기), `/ops/migrate` (데이터 복사 화면)
- 설정값을 Netlify 에서 받아 오던 코드 — 이제 R2 `__config/env.json` 과 대시보드 값만 읽음
- DNS 전환 기간용 Netlify 중계(`a-relay-cf.js`)와 그 서명 검사
- `*.netlify.app`, `DEPLOY_URL` · `DEPLOY_PRIME_URL` 을 「우리 사이트」로 인정하던 예외 (출처 검사가 더 엄격해짐)
- `package.json` 의 `@netlify/blobs` 의존성, GitHub Actions 의 `--import register.mjs` 로더

## 최적화 (같은 날 추가)

| 항목 | 이전 | 이후 |
|---|---|---|
| Worker 묶음 크기 | 4.16MB (압축 1.15MB) | 2.46MB (압축 0.74MB) |
| Worker 시작 비용(모듈 초기화) | 약 270ms | 약 70~90ms |
| 일반 페이지 1건 CPU | 약 1.2~2.6ms | 약 0.9~1.3ms |
| 맞춤 제안서 접수 1건 CPU | 약 5.6ms | 약 3.2ms |
| 리드 접수 1건 CPU | 약 3.4ms | 약 2.1ms |
| 사이트 감시(15분 예약) CPU | 약 21ms | 약 15ms |

(로컬 Node 에서 배포 묶음을 그대로 실행해 잰 값 — 실제 Cloudflare 값은 더 작지만 비율은 같습니다.
무료 플랜 한도는 요청당 CPU 10ms 입니다.)

- **PDF 라이브러리를 Worker 에서 뺌** — `pdf-lib`·`fontkit`(약 1.6MB)은 GitHub Actions 만 씁니다. wrangler.toml `[alias]` 로 Worker 묶음에는 빈 모듈(`cloudflare/pdf-stub.mjs`)이 들어갑니다. **`PDF_BUILDER = "github"` 는 바꾸지 마세요.**
- 요청마다 Request 를 두 번 새로 만들던 것 제거 — IP 는 모든 함수가 `cf-connecting-ip`(Cloudflare 가 넣는 값, 위조 불가)를 먼저 읽습니다.
- 리다이렉트·헤더 규칙 판정 결과를 주소별로 기억 (같은 주소는 다시 계산하지 않음, 긴 주소는 제외)
- 설정값 합치기를 요청마다 하지 않고 재사용 (10분마다 갱신은 그대로)
- 기술지원 챗봇 검색 색인은 처음 질문이 올 때 만듦 (모든 요청의 시작 비용에서 빠짐)
- 맞춤 제안서 PDF 모듈은 실제로 PDF 를 만들 때만 불러옴
- 사이트 감시: 이미지 점검은 본문을 읽지 않고 상태 코드만 확인

## 수정한 문제

- 외부 주소로 그대로 보여 주는(200) 리다이렉트 규칙이 생기면 방문자 쿠키·IP 헤더까지 외부로 넘어가던 문제 — 쿠키·위조 가능한 IP 헤더를 빼고 실제 IP 만 전달 (지금은 해당 규칙 없음, 예방 조치)
- 빌드 폴더에 바로가기(심볼릭 링크) 폴더가 있으면 `cloudflare/prepare.mjs` 가 멈추던 문제
- 함수에 넘기는 요청 ID 가 읽을 때마다 바뀌던 문제 (예약 작업)

## 적용 순서

1. **Netlify 사이트 먼저 정리** — app.netlify.com → monnit26 → Project configuration → Build & deploy → **Stop builds**.
   이번 변경부터 Cloudflare 예약 작업이 기본으로 돌기 때문에, Netlify 쪽 예약 작업이 아직 살아 있으면 알림 메일이 두 번 나갈 수 있습니다.
2. 압축 파일 내용을 저장소에 덮어쓰기 (Finder 「대치」 가능 — `server/` · `cloudflare/` · `.github/` 는 통째로 들어 있음).
3. (선택) 저장소 루트에서 `bash Netlify-파일-삭제.sh` — `netlify/` 폴더, `netlify.toml` 등 옛 파일을 지웁니다.
   지우지 않아도 이제 빌드가 자동으로 공개 대상에서 빼고 주소도 404 로 막습니다(정리 차원에서 지우는 것을 권장).
4. 커밋·푸시 → Cloudflare 가 자동 배포.
5. 확인
   - 메인 · 프로모션 랜딩 · `/ops` 로그인 · 맞춤 제안서 접수 1건(테스트)
   - 자료 받기 메일의 링크가 열리는지 (옛 `/.netlify/functions/getdoc` 링크 포함)
   - Cloudflare → monnit → Observability 에 `[proposal-dispatch]` 로그가 10분마다 찍히는지
6. 이상 없으면 Netlify 에서 **Delete project**.

## 그대로 두는 것
- Cloudflare·GitHub 의 `MIGRATE_SECRET` — 이름만 옛것이고 GitHub Actions 가 R2 를 읽는 열쇠로 계속 씁니다. 지우면 제안서 PDF 생성이 멈춥니다.
- 대시보드의 `CRON_ENABLED=1` — 있어도 됩니다(기본과 같음).

## 검증 (로컬 Cloudflare 실행 환경 — 변경 전·후 나란히 실행해 비교)
- 빌드 결과 비교: 공개 파일 674개 · 헤더 규칙 75개 동일. 리다이렉트 395개 중 차이는 비공개 차단 규칙 `/netlify/*` → `/server/*`, `/cloudflare/*` 추가뿐.
- 주소 38개를 변경 전·후로 호출해 비교: 상태 코드·이동 주소·본문 일치. 차이는 `/api/fn/*` 새 주소가 열린 것과 이관용 `/api/blob-export` · `/ops/migrate` 가 404 가 된 것뿐.
- 예약 작업 3종 실행 확인, GitHub Actions 제안서 생성 스크립트가 로더 없이 실행되는지 확인.
- 배포 묶음(worker.js)에 Netlify API 호출이 남아 있지 않음.
- 사이트 주소 624개 상태 코드·이동 주소 전·후 동일, 내부 링크·이미지 깨짐 0건, 브라우저로 페이지 488개 열어 스크립트 오류 0건(외부 블로그 제외).
- 서버 함수 경로 85개 전·후 동일. 관제 로그인·잠금, 리드 접수, 맞춤 제안서 접수 → GitHub Actions 방식 PDF 생성(10쪽) → 발송 점검, 자료 받기 링크(새·옛 주소, 위조 403, 만료 410), IP 차단(403, /ops 통과), 방문 기록, 기술지원 챗봇, 예약 작업 3종 정상.
