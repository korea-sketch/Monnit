# monnit.co.kr — Netlify → Cloudflare 이관 안내

작성 2026-10-10 (무료 운영 구성) · 대상 저장소 korea-sketch/Monnit

## 1. 무엇이 어디로 옮겨 가나 (무료 운영 구성)

| 지금(Netlify) | 옮긴 뒤 | 비용 |
|---|---|---|
| 정적 페이지·이미지 | Cloudflare Workers 정적 파일 (`dist/`) — 이미지·JS·CSS 는 Worker 를 거치지 않고 바로 나감 | 무료·무제한 |
| `_redirects` · `netlify.toml` 리다이렉트·헤더, 예쁜 주소, 404 | Worker 가 Netlify 와 같은 순서로 처리 | 무료 |
| 서버 함수 42개 · 엣지 함수(IP 차단·방문 기록) | 같은 Worker 안에서 그대로 실행 | 무료(하루 10만 요청) |
| 예약 함수 3개 | Cron Trigger (같은 시각, UTC) | 무료(5개까지) |
| 맞춤 제안서 PDF 생성(백그라운드) | **GitHub Actions** — 접수되면 Worker 가 깨움 | 무료(월 2,000분 안) |
| Netlify Blobs | R2 버킷 `monnit-blobs` | 무료(10GB) |

왜 PDF 만 GitHub 에서 만드나: 무료 Worker 는 요청 1건당 CPU 10ms 까지만 쓸 수 있는데, 제안서 PDF 조판은 수 초가 걸립니다.
GitHub Actions 는 1건에 약 1분, 무료 사용량(비공개 저장소 월 2,000분)이면 한 달 1,000건 넘게 만들 수 있습니다.
만든 PDF 는 사이트의 정기 점검(10분마다)이 예정 시각에 메일로 보냅니다 — 고객에게는 지금처럼 「몇 시간 이내」 안내 그대로입니다.

보조 수정은 모두 「Cloudflare·GitHub 에서 실행될 때만」 동작하는 분기라 Netlify 동작은 그대로입니다.

## 2. 무료 한도와 주의점

| 항목 | 무료 한도 | 현재 사이트 기준 |
|---|---|---|
| Worker 요청 | 하루 100,000건 (페이지·API 만 집계, 이미지 등 정적 파일 제외) | 여유 |
| Worker CPU | 요청 1건당 10ms | 페이지 1ms 안팎 · 제안서 접수 5ms · 관제 화면 5~8ms (실측) |
| R2 저장 | 10GB · 쓰기 월 100만 건 | 방문 기록 1페이지뷰 = 쓰기 1건 → 하루 3만 페이지뷰까지 |
| GitHub Actions | 월 2,000분(비공개 저장소) | 제안서 1건 ≈ 1분 |

- 관제 화면(/ops)에서 기간을 길게(30일 이상) 잡거나 데이터가 아주 많아지면 CPU 10ms 를 넘어 「Error 1102」가 날 수 있습니다. 새로고침하거나 기간을 줄이면 됩니다. 고객 화면(페이지·접수)은 여유가 큽니다.
- R2 를 처음 켤 때 Cloudflare 가 결제 수단(카드) 등록을 요구할 수 있습니다. 무료 한도 안에서는 청구되지 않습니다.
- 나중에 트래픽이 크게 늘어 무료 한도를 넘기면 Workers 유료($5/월)로 올릴 수 있습니다. 그때는 PDF 도 Worker 안에서 만들도록 설정을 바꿔 드릴 수 있습니다.

## 3. 순서

### ① 파일 올리기 (Netlify 는 계속 정상 운영)
1. 받은 압축을 저장소 루트에 풀어 덮어쓰고 커밋 1번 · 푸시 1번.
   - `netlify/` · `cloudflare/` · `.github/` 폴더는 통째로 들어 있으므로 Finder 「대치」를 눌러도 됩니다.
2. Netlify 에 `/api/blob-export` 함수가 추가로 배포됩니다(데이터 이관에 필요). 사이트 동작은 바뀌지 않습니다.

### ② Cloudflare 준비 (무료 계정)
1. **R2 버킷**: R2 Object Storage → Create bucket → 이름 `monnit-blobs`.

### ③ GitHub 연결 (자동 배포)
1. Workers & Pages → Create → **Import a repository** → GitHub 연결 → `korea-sketch/Monnit` 선택.
2. 설정 — Project name `monnit` · Build command **비워 둠** · Deploy command `npx wrangler deploy` · Root directory `/`
3. Save and Deploy → 몇 분 뒤 `https://monnit.<계정이름>.workers.dev` 주소가 생깁니다.

### ④ 비밀값 옮기기 — 가장 중요
**Cloudflare** — Worker → Settings → **Variables and Secrets** → Add (종류 **Secret**)
- Netlify → Project configuration → Environment variables 에 있는 값을 **이름 그대로 전부** 옮깁니다.
- **`SITE_ID`** = Netlify 의 Project ID (Project configuration → General → Project ID). 관제 로그인·자료 링크 서명이 이 값을 씁니다.
- **`GITHUB_TOKEN`** — 제안서 PDF 작업을 깨우는 열쇠:
  GitHub → 오른쪽 위 프로필 → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate
  · Repository access: Only select repositories → `korea-sketch/Monnit`
  · Permissions → Repository permissions → **Contents: Read and write**
  · 만료일은 1년으로 하고, 만료 전에 새로 만들어 바꿔 넣습니다.

**GitHub** — 저장소 → Settings → Secrets and variables → **Actions** → New repository secret
| 이름 | 값 |
|---|---|
| `SITE_URL` | 전환 전 `https://monnit.<계정>.workers.dev` → 도메인 전환 후 `https://monnit.co.kr` |
| `PROPOSAL_SECRET` | Netlify 와 같은 값 |
| `DL_SECRET` · `SITE_ID` | Netlify 와 같은 값 |
| `ANTHROPIC_API_KEY` 또는 `GEMINI_API_KEY` | AI 문안용 (없으면 템플릿 문안) |
| (선택) Variables 탭: `AI_PROVIDER` · `GEMINI_MODEL` · `PROPOSAL_AI_MODEL` · `PROPOSAL_MODE` · `PROPOSAL_REVIEW` | Netlify 에 값이 있으면 같게 |

코드가 읽는 환경변수 이름 전체(없으면 기본값):
`AI_PROVIDER ALARM_MAIL_OFF ANTHROPIC_API_KEY BACKFILL_FROM BACKFILL_MAX BACKFILL_OFF BLOCK_API_KEY BLOCK_COMPANIES BLOCK_DOMAINS BLOCK_IPS BLOCK_PHONES BREVO_API_KEY CLARITY_TOKEN DL_SECRET GA4_PROPERTY_ID GA4_SA_EMAIL GA4_SA_KEY GEMINI_API_KEY GEMINI_MODEL GOOGLE_ADS_SHEET MAIL_FROM MAIL_PREVIEW_TOKEN MAIL_REPLYTO META_AD_ACCOUNT META_TOKEN MONDAY_API_TOKEN MONDAY_BOARD_ID MONDAY_TOKEN MONNIT_TEST_EMAIL MONNIT_TEST_NAME NAVER_API_KEY NAVER_CUSTOMER_ID NAVER_SECRET NOTIFY_TO OPS_PASS OPS_USER PROPOSAL_ADMIN_KEY PROPOSAL_AI_MODEL PROPOSAL_BCC PROPOSAL_BRAND_COUNTRIES PROPOSAL_BRAND_CUSTOMERS PROPOSAL_BRAND_LINE PROPOSAL_BRAND_PUBLIC PROPOSAL_CALLBACK_TEXT PROPOSAL_CHAT_MODEL PROPOSAL_CHAT_RETRY PROPOSAL_ETA_TEXT PROPOSAL_FROM_EMAIL PROPOSAL_FROM_NAME PROPOSAL_HOLIDAYS PROPOSAL_MODE PROPOSAL_MONDAY_BOARD PROPOSAL_MONDAY_COLUMNS PROPOSAL_MONDAY_GROUP PROPOSAL_MONDAY_TOKEN PROPOSAL_OPENED_TO PROPOSAL_REPLY_TO PROPOSAL_REVIEW PROPOSAL_SECRET PROPOSAL_SITE PROPOSAL_STAFF_TO PROPOSAL_WEBHOOK_URL RELAY_ORIGINS RELAY_TOKEN SITE_ID SITE_ORIGIN STAFF_MAIL_KINDS STATICFORMS_KEY VISIT_LOG VISIT_PASS VISIT_USER WEB3FORMS_KEY`

`URL` · `PRIMARY_HOST` · `SELF_HOSTS` · `MIGRATE_SOURCE` · `PDF_BUILDER` · `GITHUB_REPO` 는 wrangler.toml 에 이미 있습니다.
값을 넣은 뒤 Deployments → 최신 배포 → **Retry deployment** 로 한 번 다시 배포합니다.

### ⑤ workers.dev 주소에서 확인 (실제 도메인 전환 전)
| 확인 | 기대 결과 |
|---|---|
| `/` · `/proposal/` · `/promo/alarm` · `/case/samsung/` | 지금 사이트와 같은 화면 |
| `/proposal` | `/proposal/` 로 이동 |
| `/proposals/data-center-monitoring.pdf` · `/editor.html` | 404 (막혀 있어야 정상) |
| `/ops` 로그인 | 기존 아이디·비밀번호로 로그인 |
| `/ops/migrate` | 데이터 이관 화면 |
| 맞춤 제안서 시험 신청 | 1~3분 뒤 GitHub → Actions 탭에 `proposal-build` 실행이 초록색으로 끝나고, 관제 > 맞춤 제안서에 PDF 가 생김 |

### ⑥ 데이터 옮기기
1. `https://monnit.<계정>.workers.dev/ops/migrate` 접속 → 관제 로그인.
2. 원본 주소는 `https://monnit26.netlify.app` (기본값) 그대로 → **복사 시작**.
   - 저장소별로 원본 건수와 복사 건수가 표시됩니다. 여러 번 눌러도 안전합니다(같은 키는 덮어씀).
   - 원본 주소에 `https://monnit.co.kr` 을 넣지 마세요 — 전환 뒤에는 자기 자신이 됩니다.
3. 복사 후 `/ops` 에서 리드 원장·방문 기록·제안서 목록이 보이는지 확인.
4. 맞춤 제안서를 시험 신청해 PDF 메일이 오는지 확인(관제 > 맞춤 제안서에서 진행 상태 확인).

### ⑦ 도메인 전환
도메인을 옮긴 뒤 GitHub 비밀값 `SITE_URL` 을 `https://monnit.co.kr` 로 바꿉니다.

Worker 의 사용자 지정 도메인은 **monnit.co.kr 의 DNS 가 Cloudflare 에 있어야** 붙일 수 있습니다.
- DNS 가 아직 다른 곳(가비아·Netlify DNS 등)에 있다면: Cloudflare → Add a domain → `monnit.co.kr` → 기존 DNS 레코드 가져오기 → **메일 관련 레코드(MX·TXT·SPF·DKIM — Brevo 발송 인증 포함)가 모두 들어왔는지 확인** → 도메인 등록 업체에서 네임서버를 Cloudflare 가 알려 준 2개로 변경.
- 그다음 Worker → Settings → Domains & Routes → Add → Custom domain → `monnit.co.kr`, 이어서 `www.monnit.co.kr`.
  (기존 monnit.co.kr 의 A/CNAME 레코드가 Netlify 를 가리키고 있으면 Cloudflare 가 교체를 안내합니다.)
- `www` 는 Worker 가 자동으로 `monnit.co.kr` 로 301 이동시킵니다.

전환 직후 ⑥의 **복사 시작을 한 번 더** 누르세요. 전환 사이 Netlify 쪽에 들어온 접수·방문 기록까지 옮겨집니다.

### ⑧ 정리 (1~2주 병행 운영 후)
- Netlify → Project configuration → Build & deploy → **Stop builds** (GitHub 푸시마다 Netlify 도 배포되어 크레딧을 쓰지 않도록).
- 문제가 없으면 `netlify/functions/blob-export.mjs` 는 지워도 됩니다(worker.mjs · migrate.mjs 의 관련 줄도 함께).
- Netlify 사이트 자체는 바로 지우지 말고 한 달쯤 보관하세요(되돌리기용).

## 4. 되돌리기
Worker → Domains & Routes 에서 `monnit.co.kr` 사용자 지정 도메인을 지우고, DNS 의 monnit.co.kr 레코드를 다시 Netlify(`monnit26.netlify.app`)로 향하게 하면 즉시 원래대로 돌아갑니다. 그 사이 Cloudflare 에 쌓인 데이터는 R2 에 남아 있습니다.

## 5. 이후 작업 방식
- 수정 → GitHub 커밋·푸시 → Cloudflare 가 자동 빌드·배포 (지금과 같음).
- 배포 상태: Workers & Pages → monnit → Deployments. 오류 로그: Observability(Logs).
- 로컬 실행(선택): `npm install` → `npx wrangler@4 dev` → http://localhost:8787 (비밀값은 `.dev.vars` 파일에).

## 6. 이관 전 검증 결과 (2026-10-10, 로컬 Cloudflare 실행 환경 · 무료 구성)
- 사이트 주소 1,196개를 현재 Netlify 사이트와 하나씩 비교 — 상태 코드·이동 주소 일치. 차이는 보안 헤더가 이동(301) 응답에도 붙는 정도이며 동작에는 영향 없음.
- 관제 로그인·리드 원장 기록·맞춤 제안서 접수 → GitHub Actions 와 같은 방식(일부 파일만 받은 상태)으로 PDF 생성 → 저장소 기록 → 정기 점검 발송 단계까지
- 요청별 CPU 실측: 페이지 0.7~1ms · 접수 5ms · 관제 4~8ms · 예약 함수 1~4ms (무료 한도 10ms)
- 이미지·JS·CSS 는 Worker 를 거치지 않음 확인(요청 수·CPU 0)
- 자료 다운로드 링크(서명 검사·만료·차단), 비공개 파일 직접 접근 404
- IP 차단(차단 IP 403, /ops 는 통과), 방문 기록, 예약 함수 3종 실행
- 데이터 이관 화면으로 3,306건 복사 → 복사본에서 같은 제안서 조회 성공

## 7. 추가된 파일
```
wrangler.toml                         Cloudflare 설정
cloudflare/worker.mjs                 진입점 (함수·엣지·예약·큐·정적 파일)
cloudflare/netlify-compat/site.mjs    Netlify 리다이렉트·헤더·예쁜 주소 재현
cloudflare/netlify-compat/blobs.mjs   Netlify Blobs → R2 호환 모듈
cloudflare/prepare.mjs                빌드 후 dist/ 와 규칙 파일 생성
cloudflare/migrate.mjs                /ops/migrate 데이터 이관 화면
cloudflare/blob-api.mjs               GitHub Actions 가 저장소를 읽고 쓰는 통로 (/api/__blobs)
cloudflare/actions/*                  GitHub Actions 에서 제안서 PDF 를 만드는 스크립트
.github/workflows/proposal-build.yml  제안서 PDF 생성 작업 정의
netlify/functions/blob-export.mjs     Netlify 쪽 데이터 내보내기 (이관 후 삭제 가능)
```

---

## 추가 (2026-10-13) — 설정값 자동 이전 · 무중단 순서

- **설정값 자동 이전**: Cloudflare 대시보드에는 `MIGRATE_SECRET`(Netlify 에도 같은 새 값을 넣음)과 `GITHUB_TOKEN` 두 개만 직접 넣습니다.
  (Netlify 의 비밀값은 저장 후 다시 볼 수 없으므로 PROPOSAL_SECRET 을 복사하지 않고, 이관 전용 새 열쇠를 양쪽에 넣습니다.
  대시보드에 PROPOSAL_SECRET 을 따로 넣으면 옮겨 온 진짜 값보다 우선하므로 넣지 마십시오.)
  나머지(OPS/VISIT 계정, 메일·AI·광고 키, SITE_ID 등)는 Worker 가 처음 뜰 때 Netlify 의 `/api/blob-export?op=env` 에서
  자동으로 받아 R2(`__config/env.json`)에 둡니다. 대시보드에 같은 이름을 넣으면 대시보드 값이 우선합니다.
  `/ops/migrate` 의 「복사 시작」을 누르면 설정값도 새로 받습니다.
- **GitHub Actions 비밀값**: `SITE_URL`, `MIGRATE_SECRET` 두 개면 됩니다(나머지는 위 설정값에서 읽음).
- **예약 작업 잠금**: 대시보드 변수 `CRON_ENABLED=1` 을 넣기 전에는 cron 이 아무것도 하지 않습니다.
  시험 기간에 Netlify 와 메일이 겹치지 않게 하려는 것으로, 도메인 전환 직후에 켭니다.
- **무중단 순서**: ① GitHub 반영(Netlify 는 원자 배포라 중단 없음) → ② Cloudflare 에 Worker·R2 준비(workers.dev 임시 주소)
  → ③ 데이터·설정 복사 후 시험 → ④ DNS 를 Cloudflare 로(이때는 기존 Netlify 를 그대로 가리킴) → ⑤ 도메인을 Worker 로 연결 + `CRON_ENABLED=1` + 데이터 한 번 더 복사.
