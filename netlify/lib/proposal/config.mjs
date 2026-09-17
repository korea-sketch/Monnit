/** 맞춤 제안서 — 설정 (환경변수 한 곳에서 읽기)
 *  값이 없으면 안전한 기본값으로 동작한다. 목록은 「맞춤제안서-적용안내.md」 참고. */
const env = (k, d = '') => {
  try { const v = (globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k)); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};
const num = (k, d) => { const n = Number(env(k, '')); return Number.isFinite(n) && env(k, '') !== '' ? n : d; };
const on = (k, d) => { const v = String(env(k, d ? 'on' : 'off')).toLowerCase(); return ['1', 'on', 'true', 'yes', 'y'].includes(v); };

export const CFG = {
  get site() { return env('PROPOSAL_SITE', env('URL', 'https://monnit.co.kr')).replace(/\/$/, ''); },
  /* 발송 방식 (2026-09-17 v3)
     instant  기본 — 신청 화면에서 단계가 진행되는 동안(약 2~3분) 실제로 만들고, 끝나는 즉시 발송.
              판단이 불확실한 건만 자동으로 review 로 돌린다. 담당 엔지니어는 발송 뒤 확인 연락.
     review   모든 건을 엔지니어 확인 후 발송 (영업일 기준 PROPOSAL_REVIEW_HOURS 이내)
     delayed  예전 방식 — 접수 후 PROPOSAL_DELAY_HOURS(48) 뒤 발송 */
  get mode() { const m = String(env('PROPOSAL_MODE', 'instant')).toLowerCase(); return ['instant', 'review', 'delayed'].includes(m) ? m : 'instant'; },
  get instantSeconds() { return Math.min(600, Math.max(5, num('PROPOSAL_INSTANT_SECONDS', 150))); },
  /* 무료 맞춤 제안서 범위 — 과제 몇 개까지 다룰지 · 같은 회사·이메일에 몇 일에 한 번 보낼지 */
  get maxProblems() { return Math.min(6, Math.max(1, num('PROPOSAL_MAX_PROBLEMS', 1))); },
  get onePerDays() { return Math.max(1, num('PROPOSAL_ONE_PER_DAYS', 30)); },
  /* 엔지니어 확인 건의 발송 시각 — 접수 후 N시간, 영업시간 밖이면 다음 영업일 오전.
     화면·메일이 「몇 시간 이내」라고 안내하므로 기본 4시간 (예전 24시간은 목요일 밤 접수가 월요일에 나갔다) */
  get reviewHours() { return num('PROPOSAL_REVIEW_HOURS', 4); },
  /* 즉시 방식 도착 안내 — 분 단위로 약속하지 않고 넉넉하게 */
  get etaText() { return env('PROPOSAL_ETA_TEXT', '몇 시간 이내'); },
  get callbackText() { return env('PROPOSAL_CALLBACK_TEXT', '영업일 기준 1일 안에'); },
  /* 발송 시점: 접수 후 N시간 → 영업일·영업시간으로 보정 (delayed 방식) */
  get delayHours() { return num('PROPOSAL_DELAY_HOURS', 48); },
  get businessOnly() { return on('PROPOSAL_BUSINESS_HOURS', true); },
  get sendHour() { return num('PROPOSAL_SEND_HOUR', 10); },          /* 영업시간 밖이면 다음 영업일 이 시각 */
  get workStart() { return num('PROPOSAL_WORK_START', 9); },
  get workEnd() { return num('PROPOSAL_WORK_END', 18); },
  get extraHolidays() { return env('PROPOSAL_HOLIDAYS', '').split(/[,\s]+/).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)); },
  /* 검수 방식: auto = 보류하지 않으면 예정 시각에 자동 발송 / manual = 승인한 건만 발송 */
  get review() { return env('PROPOSAL_REVIEW', 'auto') === 'manual' ? 'manual' : 'auto'; },
  /* 발송 N시간 전에 담당자에게 미리보기 알림 */
  get previewLeadHours() { return num('PROPOSAL_PREVIEW_HOURS', 20); },
  /* 중간 진행 알림 메일(분석 완료) — 기본 끔. 메일이 많으면 스팸으로 분류될 수 있다 */
  get progressMail() { return on('PROPOSAL_PROGRESS_MAIL', false); },
  /* 발송 후 N일 뒤 후속 안내(열람 안 했을 때만) — 0 이면 끔 */
  get followupDays() { return num('PROPOSAL_FOLLOWUP_DAYS', 3); },
  get maxAttempts() { return num('PROPOSAL_MAX_ATTEMPTS', 5); },
  get perIpHour() { return num('PROPOSAL_RATE_IP_HOUR', 5); },
  get perDay() { return num('PROPOSAL_RATE_DAY', 200); },          /* 하루 전체 상한 — 봇 공격 시 메일·AI 비용 폭주 방지 */
  get linkDays() { return num('PROPOSAL_LINK_DAYS', 30); },         /* PDF 링크 유효기간 */
  get retainDays() { return num('PROPOSAL_RETAIN_DAYS', 365); },    /* 개인정보 보관 기간 → 지나면 익명화 */
  get attachMaxBytes() { return num('PROPOSAL_ATTACH_MAX', 3500000); },

  /* 비밀값 */
  get secret() { return env('PROPOSAL_SECRET', env('DL_SECRET', 'mk-proposal-dev-secret-change-me')); },
  get secretIsDefault() { return !env('PROPOSAL_SECRET', '') && !env('DL_SECRET', ''); },
  get adminKey() { return env('PROPOSAL_ADMIN_KEY', ''); },

  /* 메일 */
  get brevoKey() { return env('BREVO_API_KEY', ''); },
  get from() { return { name: env('PROPOSAL_FROM_NAME', '모넷코리아'), email: env('PROPOSAL_FROM_EMAIL', 'no-reply@monnit.co.kr') }; },
  get replyTo() { return { name: '모넷코리아', email: env('PROPOSAL_REPLY_TO', 'korea@monnit.com') }; },
  get staffTo() { return env('PROPOSAL_STAFF_TO', env('NOTIFY_TO', 'korea@monnit.com')).split(/[,\s]+/).filter(Boolean); },
  get bcc() { return env('PROPOSAL_BCC', '').split(/[,\s]+/).filter(Boolean); },
  get webhook() { return env('PROPOSAL_WEBHOOK_URL', ''); },      /* 슬랙·팀즈·자체 알림톡 서버 등 */

  /* AI 문안 — 키가 없으면 템플릿 문안만 쓴다 */
  get aiKey() { return env('ANTHROPIC_API_KEY', ''); },
  get aiModel() { return env('PROPOSAL_AI_MODEL', 'claude-sonnet-4-5'); },
  get aiTimeoutMs() { return num('PROPOSAL_AI_TIMEOUT_MS', 60000); },

  /* 연락처 (PDF·메일 하단) */
  /* 신뢰 문구 — 홈 「신뢰 지표」와 같은 값(사이트에서 바꾸면 여기도 맞춰 주세요). 제안서·진행 화면에 쓴다 */
  get brand() {
    return {
      countries: env('PROPOSAL_BRAND_COUNTRIES', '130+'),        /* Monnit 글로벌 납품 국가 */
      customers: env('PROPOSAL_BRAND_CUSTOMERS', '64,000+'),     /* 글로벌 도입 고객사 */
      publicRef: env('PROPOSAL_BRAND_PUBLIC', '공공기관·대기업'), /* 국내 대표 레퍼런스 */
      line: env('PROPOSAL_BRAND_LINE', '')
    };
  },
  company: {
    name: '모넷코리아', legal: '주식회사 모넷코리아',
    address: '서울 서초구 효령로 380, 2층', tel: '02-2088-1454',
    email: 'korea@monnit.com', web: 'monnit.co.kr'
  }
};
