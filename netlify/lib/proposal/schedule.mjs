/** 맞춤 제안서 — 발송 일정 · 진행 단계 계산
 *  서버(상태 API)가 계산해서 내려준다. 화면은 받은 값을 그리기만 한다 → 기기 시계가 틀려도 같은 결과. */
import { CFG } from './config.mjs';
import { STAGE_EN, NOTE_EN, NOTICE_EN, fmtEn } from './i18n.mjs';

/* 한국 공휴일 (대체공휴일·선거일 포함). 2027년은 인사혁신처 확정 공고 후 PROPOSAL_HOLIDAYS 로 보정 */
const HOLIDAYS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-01', '2026-05-05',
  '2026-05-25', '2026-06-03', '2026-08-17', '2026-09-24', '2026-09-25', '2026-10-05', '2026-10-09', '2026-12-25',
  '2027-01-01', '2027-02-05', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13',
  '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11', '2027-12-27'
]);

const H = 3600000, KST = 9 * H;
const kParts = ms => { const d = new Date(ms + KST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() }; };
const pad = n => String(n).padStart(2, '0');
export const kDay = ms => { const p = kParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
const kAt = (y, m, d, h) => Date.UTC(y, m - 1, d, h) - KST;

export function isBizDay(ms) {
  const p = kParts(ms);
  if (p.wd === 0 || p.wd === 6) return false;
  const k = kDay(ms);
  return !HOLIDAYS.has(k) && !CFG.extraHolidays.includes(k);
}

/** 접수 시각 → 발송 예정 시각 (hours 뒤, 영업일·업무시간 보정) */
export function computeDue(createdMs, hours = CFG.delayHours) {
  const raw = createdMs + hours * H;
  if (!CFG.businessOnly) return raw;
  const p = kParts(raw);
  if (isBizDay(raw) && p.h >= CFG.workStart && p.h < CFG.workEnd) return raw;
  /* 같은 날 업무 시작 전이면 그날 발송 시각, 아니면 다음 영업일 */
  let day = kAt(p.y, p.m, p.d, CFG.sendHour);
  if (!(isBizDay(raw) && p.h < CFG.workStart)) day += 24 * H;
  for (let i = 0; i < 20 && !isBizDay(day); i++) day += 24 * H;
  return day;
}

/** 한국어 시각 표기 — 9월 19일(금) 오전 10:00 */
export function fmtKST(ms, withTime = true) {
  const p = kParts(ms), W = '일월화수목금토'[p.wd];
  if (!withTime) return `${p.m}월 ${p.d}일(${W})`;
  const ap = p.h < 12 ? '오전' : '오후', hh = p.h % 12 || 12;
  return `${p.m}월 ${p.d}일(${W}) ${ap} ${hh}:${pad(p.mi)}`;
}

/* 단계 — 방식마다 시간 배분과 「검수」 단계의 성격이 다르다.
   instant 는 몇 분 안에 실제로 일어나는 일(매칭·플레이북 조립·PDF 조판·자동 점검)을 순서대로 보여준다. */
const BASE = [
  ['collect', '고객 정보 수집', '입력하신 회사·시설·과제 정보를 받았습니다'],
  ['analyze', '업종·과제 분석', '회사와 문의 내용으로 업종과 세부 공정을 정리합니다'],
  ['gather', '모넷 데이터 취합', '글로벌 레퍼런스·산업 플레이북·센서 적용 데이터를 모읍니다'],
  ['insight', '모넷 인사이트 알고리즘 가동', '유사 현장을 매칭하고 참고 수치를 추립니다'],
  ['compose', '맞춤 제안서 작성', '구역별 모니터링 맵과 스마트 관리 로드맵을 조판합니다'],
  ['review', '엔지니어 검수', '담당 엔지니어가 내용을 확인합니다'],
  ['deliver', '제안서 발송', '이메일로 PDF를 보내드립니다']
];
const AT = {
  instant: [0, 0.06, 0.18, 0.36, 0.56, 0.82, 1],
  review: [0, 0.01, 0.03, 0.06, 0.1, 0.4, 1],
  delayed: [0, 0.03, 0.12, 0.28, 0.48, 0.72, 1]
};
export const modeOf = job => (job && job.plan && job.plan.mode) || 'delayed';
export function stagesFor(mode, lang = 'ko') {
  const at = AT[mode] || AT.delayed;
  return BASE.map(([key, label, sub], i) => {
    if (key === 'review' && mode === 'instant') { label = '품질 점검'; sub = '수치·표현·구성을 자동으로 점검합니다'; }
    if (lang === 'en') [label, sub] = STAGE_EN[key === 'review' && mode === 'instant' ? 'reviewInstant' : key];
    return { key, label, sub, at: at[i] };
  });
}
export const STAGES = stagesFor('delayed');

/** 진행 상태 — 시간 경과와 실제 처리 상태 중 「실제로 된 만큼만」 보여준다 */
export function progress(job, now = Date.now(), lang = 'ko') {
  const mode = modeOf(job), STAGES = stagesFor(mode, lang);
  const en = lang === 'en', F = en ? fmtEn : fmtKST;
  const created = Date.parse(job.createdAt), due = job.dueAt;
  /* 예정보다 일찍 보냈으면(담당자 「지금 발송」) 실제 발송 시각까지로 단계를 나눈다 */
  const end = job.status === 'sent' && job.sentAt ? Math.min(due, Date.parse(job.sentAt)) : due;
  const span = Math.max(1, end - created);
  const t = Math.min(1, Math.max(0, (now - created) / span));
  let idx = 1;                      /* 접수(0단계)는 들어온 순간 끝난 것이다 */
  STAGES.forEach((s, i) => { if (t >= s.at && i < STAGES.length - 1 && i > idx) idx = i; });

  const st = job.status;
  const built = !!(job.draft && job.draft.pdfKey);
  let cap = built ? 5 : 4;          /* 제안서가 안 만들어졌으면 「작성」 단계에서 멈춘다 */
  let note = '';
  if (st === 'sending') { idx = 6; cap = 6; }
  if (st === 'hold') { cap = 5; note = en ? NOTE_EN.hold : '담당 엔지니어가 내용을 보강하고 있습니다. 발송 일정이 조정될 수 있습니다.'; }
  if (st !== 'hold' && mode === 'review' && job.plan && job.plan.switched) note = en ? NOTE_EN.switched : '입력하신 정보만으로는 판단이 어려운 부분이 있어, 담당 엔지니어가 확인한 뒤 보내드립니다.';
  if (st === 'failed') { idx = Math.max(idx, 5); cap = 6; note = en ? NOTE_EN.failed : '메일 전송이 지연되어 다시 보내는 중입니다.'; }
  if (st === 'canceled') note = en ? NOTE_EN.canceled : '요청에 따라 발송이 취소되었습니다.';
  idx = Math.min(idx, cap);

  const sent = st === 'sent';
  if (sent && mode === 'instant') note = en ? NOTE_EN.callback : `담당 엔지니어가 ${CFG.callbackText} 내용을 확인하고 연락드립니다.`;
  const pct = sent ? 100 : Math.round(Math.min(t, 0.97, cap >= 6 ? 0.97 : STAGES[cap].at + 0.2) * 100);
  const stages = STAGES.map((s, i) => ({
    key: s.key, label: s.label, sub: s.sub,
    state: sent || i < idx ? 'done' : i === idx ? (st === 'canceled' ? 'stop' : 'now') : 'wait',
    at: i < idx || sent ? F(created + s.at * span) : ''
  }));
  if (sent) stages[6].at = F(Date.parse(job.sentAt || job.updatedAt));
  /* 도착 안내 — 즉시 방식도 「몇 시간 이내 · 접수 순서대로」로 넉넉하게 약속하고, 실제로는 더 빨리 보낸다 */
  const eta = sent ? F(Date.parse(job.sentAt))
    : mode === 'instant' ? (en ? 'Within a few hours · in the order received' : CFG.etaText + ' · 접수 순서대로')
    : (en ? 'By ' + F(due) : F(due) + '까지');
  return {
    mode, pct: Math.max(pct, 3), stages, current: sent ? 'deliver' : STAGES[idx].key, note, eta,
    due: F(due), dueMs: due, remainMs: Math.max(0, due - now), sent,
    sentAt: sent ? F(Date.parse(job.sentAt)) : ''
  };
}

/** 알림 타임라인 — 실제 나간 것 + 앞으로 나갈 것 */
export function noticeTimeline(job, now = Date.now(), lang = 'ko') {
  const en = lang === 'en', F = en ? fmtEn : fmtKST, N = NOTICE_EN;
  const tx = (ko, e) => (en ? e : ko);
  const n = job.notices || [];
  const has = t => n.find(x => x.type === t && x.ok);
  const failed = t => n.find(x => x.type === t && !x.ok);
  const created = Date.parse(job.createdAt), due = job.dueAt;
  const mode = modeOf(job), STAGES = stagesFor(mode, lang);
  const email = maskEmail(job.lead.email);
  /* 「분석 완료」는 화면의 진행 단계와 어긋나지 않게 — 제안서가 만들어졌고, 화면이 작성 단계에 들어섰을 때 */
  const span = Math.max(1, due - created);
  const composeAt = created + STAGES[4].at * span;
  const analysed = !!(job.draft && job.draft.pdfKey) && (now >= composeAt || job.status === 'sent');
  const row = (key, label, ch, planned, extra = {}) => {
    const d = has(key);
    return { key, label, ch, state: d ? 'done' : failed(key) ? 'retry' : 'plan',
      at: d ? F(Date.parse(d.at)) : planned ? F(planned) + tx(' 예정', ' ' + N.planned) : '', ...extra };
  };
  const analysis = { key: 'analysis', label: tx('데이터 분석 완료', N.analysis), ch: tx('이 화면에서 확인', N.chScreen), state: analysed ? 'done' : 'plan',
    at: analysed ? F(Math.min(composeAt, job.sentAt ? Date.parse(job.sentAt) : composeAt)) : F(composeAt) + tx(' 예정', ' ' + N.planned) };
  /* 즉시 방식 — 발송 예정 시각을 분 단위로 약속하지 않는다(「몇 시간 이내」) */
  const sentPlan = mode === 'instant' ? null : due;
  let out;
  if (mode === 'instant') {
    const cb = has('callback');
    const s = row('sent', tx('맞춤 제안서 발송', N.sent), email, sentPlan);
    if (s.state !== 'done') s.at = tx(CFG.etaText + ' 순차 발송', 'Within a few hours');
    out = [
      row('staff', tx('담당 엔지니어 배정', N.staff), tx('모넷코리아 기술영업팀', N.chStaff), created),
      analysis,
      s,
      { key: 'callback', label: tx('엔지니어 확인 연락', N.callback), ch: tx('회신 메일 또는 전화', N.chCallback), state: cb ? 'done' : 'plan',
        at: cb ? F(Date.parse(cb.at)) : tx(CFG.callbackText.replace(/에$/, '') + ' 예정', N.callbackAt) }
    ];
    if (has('receipt')) out.unshift(row('receipt', tx('접수 확인 메일', N.receipt), email, created));
  } else {
    out = [
      row('receipt', tx('접수 확인 메일', N.receipt), email, created),
      row('staff', tx('담당 엔지니어 배정', N.staff), tx('모넷코리아 기술영업팀', N.chStaff), created),
      analysis,
      row('preview', mode === 'review' ? tx('엔지니어 검수 요청', N.previewReview) : tx('발송 전 최종 검수', N.preview), tx('담당 엔지니어', N.chEngineer), mode === 'review' ? created : due - CFG.previewLeadHours * H),
      row('sent', tx('맞춤 제안서 발송', N.sent), email, due)
    ];
  }
  if (job.status === 'canceled') out.forEach(r => { if (r.state === 'plan') r.state = 'skip'; });
  return out;
}

export function maskEmail(e) {
  const [u = '', d = ''] = String(e || '').split('@');
  if (!d) return '';
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.min(4, u.length - 2))) + '@' + d;
}
