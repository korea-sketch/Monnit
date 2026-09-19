/** 맞춤 제안서 — 관리 화면 /ops/proposals (2026-09-17)
 *
 *  로그인: 통합 관제(/ops) 로그인을 그대로 쓴다. 따로 들어올 때는 PROPOSAL_ADMIN_KEY (12시간 쿠키).
 *  화면 탭: 접수·발송(/ops/proposals) · 발송 대장(/archive) · 고객 인사이트(/insights) — 한 화면에서 탭으로 오간다.
 *    GET  /ops/proposals[/archive|/insights]   화면
 *    GET  /ops/proposals/job?id=      한 건(재생성 진행 상황 · 발송 이력 포함)
 *    GET  /ops/proposals/archive/data?month=   발송 대장
 *    GET  /ops/proposals/archive.csv  발송 대장 CSV
 *    GET  /ops/proposals/archive/pdf?key=      발송 당시 PDF 사본
 *    GET  /ops/proposals/insights/data?days=   고객 인사이트
 *    GET  /ops/proposals/data         목록 · 요약 · 점검 상태
 *    POST /ops/proposals/action       { id, op, ... }  보류·해제·승인·지금발송·재생성·취소·일정변경·메모·요약수정·점검실행
 *    GET  /ops/proposals/pdf?id=      제안서 미리보기
 *    GET  /ops/proposals/export.csv   CRM 옮기기용 CSV
 *    POST /ops/proposals/login        { key }
 *    POST /ops/proposals/logout */
import crypto from 'node:crypto';
import * as S from '../lib/proposal/store.mjs';
import { CFG } from '../lib/proposal/config.mjs';
import { readMisses, clearAll as clearMisses } from '../lib/proposal/chatlog.mjs';
import { readHalt, clearHalt, readUsage } from '../lib/proposal/aiusage.mjs';
import { addLog, addNotice, statusUrl, tokenKey } from '../lib/proposal/jobs.mjs';
import { fmtKST } from '../lib/proposal/schedule.mjs';
import { PROBLEMS, GOALS } from '../lib/proposal/kb.mjs';
import { intakeLines } from '../lib/proposal/mail.mjs';
import { buildJob, sendJob, tick, requestCandidate, decideCandidate } from '../lib/proposal/pipeline.mjs';
import { listArchive, insights, aiInsight, channelOf } from '../lib/proposal/archive.mjs';
import { configured as mondayOn } from '../lib/proposal/crm.mjs';
import { opsAuthed } from '../lib/proposal/opsauth.mjs';
import { runHealth } from '../lib/proposal/health.mjs';

export const config = { path: ['/ops/proposals', '/ops/proposals/archive', '/ops/proposals/insights', '/ops/proposals/data', '/ops/proposals/job', '/ops/proposals/action', '/ops/proposals/pdf', '/ops/proposals/export.csv',
  '/ops/proposals/archive/data', '/ops/proposals/archive.csv', '/ops/proposals/archive/pdf', '/ops/proposals/insights/data', '/ops/proposals/health', '/ops/proposals/login', '/ops/proposals/logout',
  '/ops/proposals/misses', '/ops/proposals/misses/data'] };

const H = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' };
const j = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8', ...extra } });
const COOKIE = 'mk_pa';
const sign = v => crypto.createHmac('sha256', CFG.secret + '|admin|' + CFG.adminKey).update(v).digest('hex');
const eq = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

async function authed(req) {
  if (await opsAuthed(req)) return true;
  if (!CFG.adminKey) return false;
  const m = /(?:^|;\s*)mk_pa=([^;]+)/.exec(req.headers.get('cookie') || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  return Number(exp) > Date.now() && eq(sig || '', sign(exp));
}

/* 같은 출처에서 온 요청인지 — 쓰기 요청(POST)은 반드시 확인한다 */
function sameSite(req) {
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return false;
  const o = req.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(req.url).host; } catch (e) { return false; }
}
const ipOf = req => String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
const FAIL_WIN = 15 * 60000, FAIL_MAX = 8;
async function recentFails(ip) {
  const pre = 'adminfail/' + hashIp(ip) + '/';
  const keys = await S.list(pre, 200).catch(() => []);
  const now = Date.now();
  const at = k => Number(k.slice(pre.length).split('-')[0]);
  const live = keys.filter(k => now - at(k) < FAIL_WIN);
  keys.filter(k => !live.includes(k)).slice(0, 20).forEach(k => S.del(k).catch(() => {}));
  /* 언제 풀리는지도 함께 준다 — 가장 오래된 기록이 15분을 넘기면 한 칸이 빈다 */
  const until = live.length ? Math.min(...live.map(at)) + FAIL_WIN : 0;
  return { n: live.length, until };
}
/** 남은 시간을 분·초로 (다시 눌러도 늘어나지 않는다) — 2026-09-18 */
function lockText(until) {
  const left = Math.max(0, until - Date.now());
  const m = Math.floor(left / 60000), sec = Math.ceil((left % 60000) / 1000);
  const when = new Date(until).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
  return `로그인 시도가 많아 잠시 막았습니다. ${m > 0 ? m + '분 ' : ''}${sec}초 뒤(${when})에 다시 해주세요. 다시 눌러도 시간이 늘어나지는 않습니다.`;
}
const hashIp = ip => crypto.createHmac('sha256', CFG.secret).update('ip|' + ip).digest('hex').slice(0, 16);
/* 화면 보안 헤더 — 스크립트는 이번 응답의 nonce 가 붙은 것만 실행 */
function pageHeaders(nonce) {
  return { ...H, 'content-type': 'text/html; charset=utf-8',
    'content-security-policy': [`default-src 'self'`, `script-src 'nonce-${nonce}'`, `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
      `font-src 'self' https://cdn.jsdelivr.net data:`, `img-src 'self' data:`, `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`, `object-src 'none'`].join('; '),
    'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'cross-origin-opener-policy': 'same-origin' };
}

export default async (req) => {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/$/, '');
  if (req.method === 'POST' && !sameSite(req)) return j({ ok: false, error: 'origin' }, 403);

  if (p === '/ops/proposals/login' && req.method === 'POST') {
    let b = {}; try { b = JSON.parse((await req.text()).slice(0, 2000)); } catch (e) { /* 빈 값 */ }
    if (!CFG.adminKey) return j({ ok: false, error: 'PROPOSAL_ADMIN_KEY 환경변수가 없습니다' }, 503);
    const ip = ipOf(req);
    const _f = await recentFails(ip);
    if (_f.n >= FAIL_MAX) return j({ ok: false, error: lockText(_f.until) }, 429);
    if (!eq(String(b.key || ''), CFG.adminKey)) {
      await S.setJSON('adminfail/' + hashIp(ip) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), 1).catch(() => {});
      await new Promise(r => setTimeout(r, 900));
      return j({ ok: false, error: '키가 맞지 않습니다' }, 401);
    }
    const exp = String(Date.now() + 12 * 3600000);
    return j({ ok: true }, 200, { 'set-cookie': `${COOKIE}=${encodeURIComponent(exp + '.' + sign(exp))}; Path=/ops/proposals; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` });
  }
  if (p === '/ops/proposals/logout' && req.method === 'POST') return j({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/ops/proposals; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });

  const ok = await authed(req);
  if (['/ops/proposals', '/ops/proposals/archive', '/ops/proposals/insights', '/ops/proposals/misses'].includes(p)) {
    const nonce = crypto.randomBytes(16).toString('base64');
    return new Response(page(ok, !!CFG.adminKey, nonce), { headers: pageHeaders(nonce) });
  }
  if (!ok) return j({ ok: false, error: 'unauthorized' }, 401);

  try {
    if (p === '/ops/proposals/data') return j(await data(url));
    if (p === '/ops/proposals/pdf') return await pdf(url);
    if (p === '/ops/proposals/export.csv') return await csv();
    if (p === '/ops/proposals/job') return j(await one(url.searchParams.get('id')));
    if (p === '/ops/proposals/archive/data') return j(await archiveData(url));
    if (p === '/ops/proposals/archive.csv') return await archiveCsv();
    if (p === '/ops/proposals/archive/pdf') return await archivePdf(url);
    if (p === '/ops/proposals/insights/data') return j(await insightData(url));
    if (p === '/ops/proposals/misses/data') return j(await readMisses({ days: Math.max(1, Math.min(90, Number(url.searchParams.get('days')) || 30)) }));
    if (p === '/ops/proposals/health') return j(await runHealth({ deep: url.searchParams.get('deep') === '1', origin: url.origin }));
    if (p === '/ops/proposals/action' && req.method === 'POST') {
      if ((req.headers.get('x-requested-with') || '') !== 'mk') return j({ ok: false, error: 'csrf' }, 403);
      return j(await action(await req.json(), url));
    }
  } catch (e) {
    console.error('[proposal-admin]', e);
    return j({ ok: false, error: e.message }, 500);
  }
  return j({ ok: false, error: 'not_found' }, 404);
};

async function allJobs(limit = 600, withTest = false) {
  const keys = (await S.list('job/', 5000)).slice(-limit);
  let jobs = (await Promise.all(keys.map(k => S.getJSON(k).catch(() => null)))).filter(Boolean);
  /* 테스트 접수는 기본으로 숨긴다 — 실제 문의와 섞이면 안 된다 (2026-09-18).
     확인이 필요하면 주소에 ?test=1 을 붙인다. */
  if (!withTest) jobs = jobs.filter(j => j.test !== true);
  return jobs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const row = x => ({
  id: x.id, no: x.no, status: x.status, approved: x.approved, createdAt: x.createdAt, created: fmtKST(Date.parse(x.createdAt)),
  dueAt: x.dueAt, due: fmtKST(x.dueAt), sentAt: x.sentAt || '', sent: x.sentAt ? fmtKST(Date.parse(x.sentAt)) : '',
  company: x.lead.company, name: x.lead.name, title: x.lead.title, email: x.lead.email, phone: x.lead.phone,
  industry: x.match.industry.label, facility: x.lead.facility, region: x.lead.region, scale: x.lead.scale, timeline: x.lead.timeline,
  problems: x.match.input.problems.map(k => (PROBLEMS[k] || {}).label || k), goals: x.match.input.goals.map(k => (GOALS[k] || {}).label || k),
  memo: x.lead.memo, consentMkt: x.lead.consentMkt,
  grade: (x.meta.grade || {}).grade || '', score: (x.meta.grade || {}).score || 0,
  gradeWhy: (x.meta.grade || {}).why || '', gradeNext: (x.meta.grade || {}).next || '', gradeMeaning: (x.meta.grade || {}).meaning || '',
  gradeItems: (x.meta.grade || {}).items || [], source: x.meta.source, device: x.meta.device, ip: x.meta.ip,
  top: x.match.top.map(t => ({ name: t.name, pct: t.pct, why: t.why })), confidence: x.match.confidence,
  entry: (x.intake || {}).entry || 'proposal', intake: intakeLines(x), mode: (x.plan && x.plan.mode) || 'delayed',
  contacted: (x.notices || []).some(n => n.type === 'callback' && n.ok),
  also: ((x.intake || {}).also || []).map(k => (PROBLEMS[k] || {}).label || k),
  moreAsks: ((x.meta || {}).moreAsks || []).length,
  moreOpen: ((x.meta || {}).moreAsks || []).length > 0 && !(x.notices || []).some(n => n.type === 'callback' && n.ok && Date.parse(n.at) > Date.parse(((x.meta || {}).moreAsks || []).slice(-1)[0].at)),
  segment: x.match.playbook && x.match.playbook.segment ? x.match.playbook.segment.label : '', customer: !!x.match.ownCase,
  built: !!(x.draft && x.draft.pdfKey), ai: !!(x.draft && x.draft.ai), summary: x.draft ? x.draft.summary : '', override: x.override || null,
  views: x.views || 0, pdfOpens: x.pdfOpens || 0, lastOpenAt: x.lastOpenAt || '',
  attempts: x.attempts || 0, buildAttempts: x.buildAttempts || 0, lastError: x.lastError || '',
  notices: x.notices || [], log: (x.log || []).slice(-25), note: x.note || '', purged: !!x.purged,
  statusUrl: x.token ? statusUrl(x) : '',
  checks: (x.draft && x.draft.checks) || [], review: (x.draft && x.draft.review) || null,
  candidate: x.candidate ? { ...x.candidate, draft: x.candidate.draft ? { summary: x.candidate.draft.summary, ai: x.candidate.draft.ai, model: x.candidate.draft.model, next: x.candidate.draft.next, steps: x.candidate.draft.steps } : null } : null,
  versions: (x.versions || []).map(v => ({ n: v.n, at: v.at, ai: v.ai, model: v.model || '', instruction: v.instruction || '', review: v.review || null, adopted: !!v.adopted, label: v.label || '', by: v.by || '' })),
  sends: x.sendSeq || 0, crm: !!(x.crm && x.crm.monday)
});

async function one(id) {
  const x = await S.getJob(id);
  if (!x) return { ok: false, error: '없는 건입니다' };
  const recs = (await Promise.all((x.archive || []).map(k => S.getJSON(k).catch(() => null)))).filter(Boolean)
    .map(r => ({ key: r.key, at: fmtKST(Date.parse(r.at)), kind: r.kind, doc: r.doc, to: r.to, by: r.by, ai: r.ai, version: r.version, pdf: !!r.pdf, via: r.via, attached: r.attached }));
  return { ok: true, row: row(x), sends: recs.reverse() };
}

async function data(url) {
  const jobs = await allJobs(600, url.searchParams.get('test') === '1');
  const month = url.searchParams.get('month') || '';
  const list = month ? jobs.filter(x => fmtMonth(x.createdAt) === month) : jobs;
  const sent = list.filter(x => x.status === 'sent');
  const by = (arr, f) => arr.reduce((m, x) => { const k = f(x) || '기타'; m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    ok: true, now: Date.now(),
    config: { mode: CFG.mode, instantSeconds: CFG.instantSeconds, review: CFG.review, delayHours: CFG.delayHours, businessOnly: CFG.businessOnly, ai: !!CFG.aiKey, aiModel: CFG.aiModel, mail: !!CFG.brevoKey, staffTo: CFG.staffTo, secretDefault: CFG.secretIsDefault, followupDays: CFG.followupDays },
    lastTick: await S.getJSON('meta/last-tick.json').catch(() => null),
    /* 대화 AI 정지 상태 — 있으면 첫 화면에 팝업이 뜬다 (「과금으로 바뀌면 멈추고 알린다」 2026-09-19) */
    halt: await readHalt().catch(() => null),
    chat: await readUsage().then(u => ({ provider: CFG.aiProvider, model: CFG.chatModel, key: !!CFG.chatAiKey, freeOnly: CFG.aiFreeOnly, freeCap: u.freeCap, calls: u.calls, usd: u.usd, month: u.month, paused: u.paused })).catch(() => null),
    months: [...new Set(jobs.map(x => fmtMonth(x.createdAt)))],
    stats: {
      total: list.length, sent: sent.length,
      waiting: list.filter(x => ['received', 'drafting', 'drafted'].includes(x.status)).length,
      hold: list.filter(x => x.status === 'hold').length, failed: list.filter(x => x.status === 'failed').length,
      opened: sent.filter(x => x.pdfOpens > 0).length,
      gradeA: list.filter(x => (x.meta.grade || {}).grade === 'A').length,
      industry: by(list, x => x.match.industry.label), channel: by(list, x => channelOf(x.meta.source))
    },
    rows: list.map(row)
  };
}
const fmtMonth = iso => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 7);

async function pdf(url) {
  const job = await S.getJob(url.searchParams.get('id'));
  if (!job) return new Response('없는 건입니다', { status: 404, headers: H });
  const v = url.searchParams.get('v'), cand = url.searchParams.get('c') === '1';
  const key = cand ? job.candidate && job.candidate.draft && job.candidate.draft.pdfKey
    : v != null ? ((job.versions || []).find(x => String(x.n) === String(v)) || {}).pdfKey
    : job.draft && job.draft.pdfKey;
  if (!key) return new Response('아직 생성되지 않았습니다', { status: 404, headers: H });
  const b = await S.getBytes(key);
  if (!b) return new Response('파일 없음', { status: 404, headers: H });
  return new Response(b, { headers: { ...H, 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${job.no}.pdf"` } });
}

/* 엑셀 수식 주입 막기 — 셀이 = + - @ 나 제어문자로 시작하면 엑셀이 「수식」으로 읽는다.
   회사명에 =HYPERLINK("http://나쁜곳","청구서") 를 넣어 접수하면, 담당자가 CSV 를
   여는 순간 그 링크가 셀에 만들어진다. 앞에 작은따옴표를 붙이면 엑셀이 글자로 읽는다. (2026-09-18) */
const noFormula = t => /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
async function csv() {
  const jobs = await allJobs(5000);
  const cols = ['no', 'created', 'status', 'grade', 'score', 'gradeWhy', 'company', 'name', 'title', 'email', 'phone', 'industry', 'segment', 'entry', 'facility', 'region', 'scale', 'timeline', 'problems', 'also', 'moreAsks', 'goals', 'memo', 'source', 'sent', 'pdfOpens', 'views', 'consentMkt'];
  const q = v => '"' + noFormula(String(Array.isArray(v) ? v.join(' / ') : v == null ? '' : v)).replace(/"/g, '""') + '"';
  const body = '\uFEFF' + cols.join(',') + '\n' + jobs.map(row).map(r => cols.map(c => q(r[c])).join(',')).join('\n');
  return new Response(body, { headers: { ...H, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="custom-proposals-${new Date().toISOString().slice(0, 10)}.csv"` } });
}

async function action(b, url) {
  const op = String(b.op || '');
  if (op === 'tick') return { ok: true, result: await tick({ origin: url.origin }) };
  if (op === 'insight_ai') return await aiInsight(await buildInsights(Number(b.days) || 90));
  if (op === 'ai_resume') {
    /* 담당자가 무료 키를 바꾸거나 한도가 풀린 뒤 누른다 — 정지 파일만 지운다.
       같은 신호가 또 오면 다음 호출에서 다시 멈추고 알리므로 위험은 AI 1회 분이다. */
    const h = await readHalt().catch(() => null);
    await clearHalt();
    return { ok: true, prev: h };
  }
  const id = String(b.id || '');
  const job = await S.getJob(id);
  if (!job) return { ok: false, error: '없는 건입니다' };
  const who = '관리자';

  switch (op) {
    case 'hold':
      if (['sent', 'canceled'].includes(job.status)) return { ok: false, error: '이미 끝난 건입니다' };
      await S.patchJob(id, x => { x.prevStatus = x.status === 'hold' ? x.prevStatus : x.status; x.status = 'hold'; addLog(x, who + ' 보류'); });
      return { ok: true };
    case 'release':
      await S.patchJob(id, x => {
        if (x.status !== 'hold') return false;
        x.status = x.draft && x.draft.pdfKey ? 'drafted' : 'received'; x.retryAt = 0; addLog(x, who + ' 보류 해제');
      });
      return { ok: true };
    case 'approve':
      await S.patchJob(id, x => { x.approved = true; addLog(x, who + ' 승인'); });
      return { ok: true };
    case 'send_now': {
      if (job.status === 'sent' && !b.again) return { ok: false, error: '이미 발송했습니다. 다시 보내려면 「재발송」을 쓰세요' };
      if (!job.draft || !job.draft.pdfKey) { const r = await buildJob(id, { ai: false }); if (!r.ok) return { ok: false, error: '생성 실패: ' + (r.error || '') }; }
      if (job.status === 'sent') await S.patchJob(id, x => { x.status = 'drafted'; addLog(x, who + ' 재발송 요청'); });
      await S.patchJob(id, x => { x.approved = true; x.retryAt = 0; if (x.status === 'failed') x.status = 'drafted'; });
      const r = await sendJob(id, { force: true, kind: job.status === 'sent' ? 'resend' : 'proposal', by: who });
      return { ok: !!r.ok, error: r.error || (r.busy ? '다른 곳에서 처리 중입니다' : r.skipped || '') };
    }
    case 'rebuild': {   /* 템플릿으로 바로 다시 만들기 (AI 는 아래 ai_regen 흐름) */
      const r = await buildJob(id, { ai: false }); return { ok: r.ok, error: r.error || '' };
    }
    case 'ai_regen':      /* ① Claude 재생성 → ② 점검·검토 → ③ 담당자 결정 */
      return await requestCandidate(url.origin, id, { instruction: String(b.instruction || ''), by: who });
    case 'candidate':
      return await decideCandidate(id, String(b.decision || ''), { by: who });
    case 'cancel':
      await S.patchJob(id, x => { if (x.status === 'sent') return false; x.status = 'canceled'; addLog(x, who + ' 발송 취소' + (b.reason ? ': ' + String(b.reason).slice(0, 100) : '')); });
      await S.del(S.queueKey(job.dueAt, id)).catch(() => {});
      return { ok: true };
    case 'reschedule': {
      const due = Date.parse(b.due);
      if (!(due > Date.now() - 60000)) return { ok: false, error: '시각을 확인해 주세요' };
      await S.del(S.queueKey(job.dueAt, id)).catch(() => {});
      await S.patchJob(id, x => { x.dueAt = due; x.notices = x.notices.filter(n => n.type !== 'preview'); addLog(x, who + ' 발송 예정 변경 → ' + fmtKST(due)); });
      await S.setJSON(S.queueKey(due, id), 1);
      return { ok: true };
    }
    case 'contacted':
      await S.patchJob(id, x => { addNotice(x, 'callback', true, { by: who }); addLog(x, who + ' 확인 연락 완료' + (b.text ? ': ' + String(b.text).slice(0, 100) : '')); });
      if (job.crm && job.crm.monday) { try { const C = await import('../lib/proposal/crm.mjs'); await C.pushEvent(job, `[확인 연락 완료] ${fmtKST(Date.now())}${b.text ? '\n' + String(b.text).slice(0, 300) : ''}`); } catch (e) { /* 무시 */ } }
      return { ok: true };
    case 'note':
      await S.patchJob(id, x => { x.note = String(b.text || '').slice(0, 1000); });
      return { ok: true };
    case 'summary':
      await S.patchJob(id, x => { x.override = { ...(x.override || {}), summary: String(b.text || '').slice(0, 400) || undefined }; addLog(x, who + ' 요약 문안 수정'); });
      { const r = await buildJob(id, { ai: false }); return { ok: r.ok, error: r.error || '' }; }
    case 'no_followup':
      await S.patchJob(id, x => { x.meta.noFollowup = true; addLog(x, who + ' 후속 안내 끔'); });
      return { ok: true };

    /* ── 접수 삭제 (2026-09-18) ──────────────────────────────────────
       내가 점검하려고 넣은 접수를 목록에서 지운다.
       · 개인정보(성함·이메일·전화·메모)와 PDF 사본을 실제로 지운다
       · 대기 중이면 발송 예약도 함께 지워 나가지 않게 한다
       · 「누가 언제 무엇을 지웠는지」는 남긴다 — 나중에 「그때 그 문의」를 찾기 위해서다
       · 이미 고객에게 발송된 건은 기본적으로 막는다(force 를 줘야 지워진다) */
    case 'clear_misses': {
      /* 규칙을 고치고 나서 새로 모을 때 — 놓친 말 기록을 통째로 비운다 */
      const n = await clearMisses();
      return { ok: true, cleared: n };
    }
    case 'delete': {
      if (job.status === 'sent' && !b.force)
        return { ok: false, error: '이미 고객에게 발송된 건입니다. 정말 지우려면 「발송된 건도 지우기」를 켜 주세요' };
      await S.del(S.queueKey(job.dueAt, id)).catch(() => {});
      if (job.token) await S.del(tokenKey(job.token)).catch(() => {});
      await S.del('pdf/' + id + '.pdf').catch(() => {});
      for (const v of job.versions || []) if (v.pdfKey) await S.del(v.pdfKey).catch(() => {});
      await S.del(S.jobKey(id)).catch(() => {});
      await S.setJSON('deleted/' + id + '.json', {
        id, no: job.no, at: new Date().toISOString(), by: who,
        company: job.lead && job.lead.company || '', status: job.status,
        reason: String(b.reason || '').slice(0, 200)
      }).catch(() => {});
      return { ok: true, deleted: 1 };
    }
    default:
      return { ok: false, error: '알 수 없는 작업' };
  }
}

/* ── 발송 대장 · 인사이트 ──────────────────────────────────────── */
async function archiveData(url) {
  const month = url.searchParams.get('month') || '';
  const all = await listArchive(5000);
  const recs = month ? all.filter(r => fmtMonth(r.at) === month) : all;
  const ids = [...new Set(recs.map(r => r.id))];
  const jobs = Object.fromEntries((await Promise.all(ids.map(id => S.getJob(id).catch(() => null)))).filter(Boolean).map(x => [x.id, x]));
  return {
    ok: true, monday: mondayOn(), months: [...new Set(all.map(r => fmtMonth(r.at)))],
    rows: recs.map(r => {
      const x = jobs[r.id] || {};
      return { ...r, atText: fmtKST(Date.parse(r.at)), opens: x.pdfOpens || 0, firstOpenAt: x.firstOpenAt ? fmtKST(Date.parse(x.firstOpenAt)) : '',
        contacted: (x.notices || []).some(n => n.type === 'callback' && n.ok), asks: ((x.meta || {}).moreAsks || []).length, status: x.status || '', crm: !!(x.crm && x.crm.monday) };
    })
  };
}
async function archiveCsv() {
  const d = await archiveData(new URL('https://x/'));
  const cols = [['atText', '발송 시각'], ['no', '제안 번호'], ['kind', '종류'], ['doc', '자료'], ['company', '회사'], ['to.name', '받는 분'], ['to.title', '직함'], ['to.email', '이메일'], ['to.phone', '전화'],
    ['industry.label', '산업'], ['segment', '세부 업종'], ['problems', '기준 과제'], ['also', '추가 관심'], ['goals', '목표'], ['scale', '규모'], ['timeline', '도입 시점'], ['region', '지역'],
    ['entry', '입구'], ['channel', '채널'], ['grade', '등급'], ['score', '점수'], ['mode', '발송 방식'], ['ai', 'AI 문안'], ['model', '모델'], ['version', '버전'], ['review.verdict', '검토'],
    ['pages', '쪽수'], ['sha', '파일 지문'], ['opens', 'PDF 열람'], ['firstOpenAt', '첫 열람'], ['contacted', '확인 연락'], ['asks', '추가 요청'], ['by', '발송 주체'], ['via', '경로']];
  const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? '' : v[k]), o);
  const q = v => '"' + noFormula(String(Array.isArray(v) ? v.join(' / ') : v == null ? '' : v)).replace(/"/g, '""') + '"';
  const body = '﻿' + cols.map(c => c[1]).join(',') + '\n' + d.rows.map(r => cols.map(c => q(get(r, c[0]))).join(',')).join('\n');
  return new Response(body, { headers: { ...H, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="proposal-archive-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
async function archivePdf(url) {
  const key = String(url.searchParams.get('key') || '');
  const rec = /^archive\/\d{13}-[a-f0-9]{16}-\d+\.json$/.test(key) ? await S.getJSON(key) : null;
  if (!rec || !rec.pdf) return new Response('사본이 없습니다(후속 안내 메일이거나 보관 기간이 지났습니다)', { status: 404, headers: H });
  const b = await S.getBytes(rec.pdf);
  if (!b) return new Response('파일 없음', { status: 404, headers: H });
  return new Response(b, { headers: { ...H, 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${rec.no}-${rec.n}.pdf"` } });
}
async function buildInsights(days) {
  const jobs = await allJobs(5000);
  const arch = await listArchive(20000);
  const from = days > 0 ? Date.now() - days * 86400000 : 0;
  return insights(jobs, arch.filter(r => Date.parse(r.at) >= from), { from });
}
async function insightData(url) {
  const days = Number(url.searchParams.get('days') || 90);
  const ins = await buildInsights(days);
  return { ok: true, days, ...ins, ai: await S.getJSON('insights/latest.json').catch(() => null), aiReady: !!CFG.aiKey };
}

/* ── 화면 ───────────────────────────────────────────────────────── */
/* 통합 관제 탭 — /ops · /ops/block 화면에도 같은 줄이 있다 */
const OPS_NAV = `<nav class="opsnav" aria-label="관제 메뉴">
<a href="/ops">통합 관제</a><a href="/ops/proposals" data-tab="queue">맞춤 제안서</a><a href="/ops/proposals/archive" data-tab="archive">발송 대장</a><a href="/ops/proposals/insights" data-tab="insights">고객 인사이트</a><a href="/ops/proposals/misses" data-tab="misses">규칙이 놓친 말</a><a href="/ops/block">차단 관리</a></nav>`;

function page(ok, keyLogin, nonce = '') {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>맞춤 제안서 · 관제</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{--bg:#0A111F;--card:#111B2C;--card2:#0D1626;--line:#1F2D44;--ink:#E8EEF7;--mut:#8FA2BD;--blue:#2B84F5;--teal:#2DD4BF;--amber:#F59E0B;--red:#FF5A5F;--vio:#C4A5FF}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 'Pretendard Variable',Pretendard,system-ui,sans-serif}
.opsnav{display:flex;gap:4px;padding:10px 20px 0;border-bottom:1px solid var(--line);background:#08101C;overflow-x:auto;position:sticky;top:0;z-index:6}
.opsnav a{color:var(--mut);text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.ai-mark{color:var(--amber)}
.opsnav a:hover{color:var(--ink)}.opsnav a.on{color:#fff;background:var(--bg);border-color:var(--line);box-shadow:0 1px 0 var(--bg)}
header{position:sticky;top:43px;z-index:5;background:rgba(10,17,31,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:10px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
h1{font-size:16px;margin:0 8px 0 0}h3{margin:0 0 8px;font-size:14px}.wrap{padding:16px 20px;max-width:1400px;margin:0 auto}
button,select,input,textarea{font:inherit;color:inherit}button{background:#1B2A42;border:1px solid var(--line);border-radius:8px;padding:6px 11px;cursor:pointer}
button:hover{border-color:var(--blue)}button.pri{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:700}button.ok{background:#0f3d3a;border-color:#1c6b63;color:#8ff0df;font-weight:700}
button.warn{border-color:#5a2a2a;color:#ffb3b3}button:disabled{opacity:.5;cursor:default}
select,input,textarea{background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:6px 9px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px}.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.kpi b{display:block;font-size:22px}.kpi span{color:var(--mut);font-size:12px}
.warnbar{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#ffd9a0;border-radius:10px;padding:9px 12px;margin-bottom:10px}
.hpop{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px}.hpop[hidden]{display:none}.hpop .box{background:var(--card);border:1px solid rgba(245,158,11,.5);border-radius:14px;max-width:560px;width:100%;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5);max-height:calc(100vh - 40px);overflow-y:auto;-webkit-overflow-scrolling:touch}.hpop .acts button{min-height:44px}.hpop h2{margin:0 0 8px;font-size:18px;color:#ffd9a0}.hpop dl{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;margin:10px 0;font-size:13px}.hpop dt{color:var(--mut)}.hpop dd{margin:0;word-break:break-all}.hpop ol{margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.7}.hpop .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.hpop a{color:#8fc1ff}
.infobar{background:rgba(43,132,245,.1);border:1px solid rgba(43,132,245,.35);color:#cfe0ff;border-radius:10px;padding:9px 12px;margin-bottom:10px}
table{width:100%;border-collapse:separate;border-spacing:0;background:var(--card);border:1px solid var(--line);border-radius:12px}a button{color:var(--ink)}th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--mut);font-weight:600;font-size:12px;background:var(--card)}tr.r{cursor:pointer}tr.r:hover{background:#15223a}
.tag{display:inline-block;border-radius:20px;padding:1px 8px;font-size:12px;font-weight:700;border:1px solid var(--line)}
.s-received,.s-drafting{color:#9fc3ff}.s-drafted{color:var(--teal)}.s-sent{color:#8ee6a0}.s-hold{color:var(--amber)}.s-failed{color:var(--red)}.s-canceled{color:var(--mut)}
.g-A{background:rgba(45,212,191,.15);color:var(--teal)}.g-B{color:#9fc3ff}.g-C{color:var(--mut)}
.mut{color:var(--mut)}.small{font-size:12px}.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#drawer{position:fixed;right:0;top:0;bottom:0;width:min(620px,100%);background:var(--card2);border-left:1px solid var(--line);overflow:auto;padding:18px;transform:translateX(100%);transition:.2s;z-index:10}
#drawer.on{transform:none}#drawer h2{margin:0 0 4px;font-size:18px}.sec{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}
.acts{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.kv{display:grid;grid-template-columns:90px 1fr;gap:4px 10px}.kv div:nth-child(odd){color:var(--mut)}
.login{max-width:380px;margin:14vh auto;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px}
.login input{width:100%;margin:12px 0}textarea{width:100%;min-height:70px}
[hidden]{display:none!important}
/* AI 재생성 패널 */
.ai{background:linear-gradient(160deg,#122036,#0F1A2B);border:1px solid #27406a;border-radius:12px;padding:14px;margin-top:12px}
.ai h3{display:flex;align-items:center;gap:8px}.ai h3 small{font-weight:500;color:var(--mut)}
.flow{display:flex;gap:6px;margin:8px 0 12px}.flow span{flex:1;text-align:center;padding:6px 4px;border-radius:8px;border:1px solid var(--line);color:var(--mut);font-size:12px}
.flow span.on{border-color:var(--blue);color:#fff;background:rgba(43,132,245,.15)}.flow span.done{border-color:#1c6b63;color:#8ff0df}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}.chips button{font-size:12px;padding:3px 9px;border-radius:20px}
.spin{display:inline-block;width:12px;height:12px;border:2px solid #3b5a86;border-top-color:#9fc3ff;border-radius:50%;animation:sp 1s linear infinite;vertical-align:-2px}@keyframes sp{to{transform:rotate(360deg)}}
.verdict{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:10px;margin:8px 0}
.verdict b{font-size:16px}.v-send{background:rgba(45,212,191,.12);border:1px solid #1c6b63}.v-revise{background:rgba(245,158,11,.1);border:1px solid #6b4a12}.v-hold{background:rgba(255,90,95,.1);border:1px solid #6b2a2c}
.score{font-size:24px;font-weight:800;min-width:54px;text-align:center}
.chk{display:grid;grid-template-columns:18px 1fr auto;gap:4px 8px;font-size:12.5px}.chk i{font-style:normal}
.diff{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.diff div{background:#0A1322;border:1px solid var(--line);border-radius:8px;padding:8px;font-size:12.5px}
.diff div b{display:block;color:var(--mut);font-size:11px;margin-bottom:4px}
.issue{font-size:12.5px;margin:3px 0}.issue em{font-style:normal;font-size:11px;border-radius:4px;padding:0 5px;margin-right:6px}
.l-high{background:#4a1d1f;color:#ffb3b3}.l-mid{background:#4a3712;color:#ffd9a0}.l-low{background:#1b2a42;color:#9fc3ff}
/* 인사이트 */
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px}@media(max-width:480px){.grid2{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;overflow:auto}
.card table{border:0;background:none}.card th,.card td{padding:6px 6px}.card td:first-child{min-width:130px;word-break:keep-all}.card .num{padding:6px 4px}
.bar{height:6px;background:#1B2A42;border-radius:3px;overflow:hidden;min-width:60px}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--blue),var(--teal))}
.hours{display:flex;align-items:flex-end;gap:3px;height:80px}.hours i{flex:1;background:linear-gradient(180deg,var(--teal),var(--blue));border-radius:3px 3px 0 0;min-height:2px}
.funnel{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.funnel div{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:10px}
.funnel b{display:block;font-size:22px}.funnel small{color:var(--mut)}
.aicard{background:linear-gradient(160deg,#16233a,#101a2b);border:1px solid #27406a}
.aicard ul{margin:4px 0 10px;padding-left:18px}.aicard li{margin:3px 0}
.heat{display:inline-block;min-width:34px;text-align:center;border-radius:6px;padding:1px 6px;font-weight:800}
@media(max-width:800px){.hide-m{display:none}.diff{grid-template-columns:1fr}header{top:43px}}
</style></head><body>
${OPS_NAV}
${ok ? `<header><h1 id="ttl">맞춤 제안서</h1>
<span id="hq" style="display:inline-flex;flex-wrap:wrap;gap:8px;align-items:center"><select id="month"><option value="">전체 기간</option></select><button id="tickBtn">정기 점검 실행</button><button id="healthBtn">연동 점검</button><a href="/ops/proposals/export.csv"><button>CSV</button></a></span>
<span id="ha" hidden><select id="amonth"><option value="">전체 기간</option></select><select id="akind"><option value="">모든 자료</option><option value="proposal">제안서</option><option value="resend">재발송</option><option value="followup">후속 안내</option></select><input id="aq" placeholder="회사·이메일·과제 검색" size="18"><a href="/ops/proposals/archive.csv"><button>대장 CSV</button></a></span>
<span id="hi" hidden><select id="days"><option value="30">최근 30일</option><option value="90" selected>최근 90일</option><option value="365">최근 1년</option><option value="0">전체</option></select></span>
<span id="hm" hidden><select id="mdays"><option value="7">최근 7일</option><option value="30" selected>최근 30일</option><option value="90">최근 90일</option></select><button id="mClear">기록 비우기</button></span>
<button id="refresh">새로고침</button><span id="tickInfo" class="mut small"></span><span style="flex:1"></span><span class="mut small hide-m">1·2·3·4 키로 탭 이동</span>${keyLogin ? '<button id="logout">로그아웃</button>' : ''}</header>
<div id="haltPop" class="hpop" hidden role="dialog" aria-modal="true" aria-labelledby="haltTtl"><div class="box"><h2 id="haltTtl">대화 AI 정지 — 과금 신호</h2><div id="haltBody"></div>
<p class="small mut" style="margin:10px 0 0">고객 화면의 「대화로 신청」은 <b>점검 중</b>으로 바뀌었고 규칙 대화·단계별 신청은 평소대로 됩니다. 담당자 메일도 한 번 나갔습니다.</p>
<div class="acts"><button id="haltResume">AI 다시 시도</button><button id="haltLater">나중에</button></div></div></div>
<div class="wrap">
<section id="t-queue"><div id="health" class="card" style="margin-bottom:12px" hidden></div><div id="warns"></div><div class="kpis" id="kpis"></div>
<div id="delbar" class="small" style="display:none;gap:10px;align-items:center;margin:0 0 10px"><span id="delcnt"></span><button id="delBtn">선택한 접수 지우기</button><label class="small mut"><input type="checkbox" id="delForce"> 발송된 건도 지우기</label><button id="delClear">선택 해제</button></div>
<table><thead><tr><th style="width:28px"><input type="checkbox" id="chkAll" title="전체 선택"></th><th>접수</th><th>상태</th><th>등급</th><th>회사 · 담당</th><th class="hide-m">산업 · 과제</th><th class="hide-m">1위 사례</th><th>발송 예정</th><th class="hide-m">열람</th></tr></thead><tbody id="rows"></tbody></table></section>
<section id="t-archive" hidden><div id="abar"></div><div class="kpis" id="akpis"></div>
<div style="overflow-x:auto"><table><thead><tr><th>발송 시각</th><th>받는 분</th><th>나간 자료</th><th class="hide-m">기준 과제 · 산업</th><th>등급</th><th>반응</th><th></th></tr></thead><tbody id="arows"></tbody></table></div>
<p class="mut small">발송할 때마다 한 줄씩 남고, PDF는 그때 보낸 파일 그대로 보관합니다. 보관 기간(${Math.round(CFG.retainDays / 30)}개월)이 지나면 받는 분 정보와 PDF 사본은 지우고 회사·업종·과제·반응만 남깁니다.</p></section>
<section id="t-insights" hidden><div id="ins"></div></section>
<section id="t-misses" hidden>
<p class="mut small" style="margin:0 0 12px">대화로 신청에서 <b>규칙이 못 알아들은 말</b>을 모읍니다. AI 를 부른 건은 <b class="ai-mark">AI</b> 로 표시됩니다 —
AI 를 한 번 불렀다는 건 규칙에 구멍이 하나 있다는 뜻이고, 그 구멍을 막으면 다음부터는 돈이 들지 않습니다.
자주 나온 말부터 고치면 됩니다. 이메일·전화번호는 저장 전에 지워집니다.</p>
<div class="kpis" id="mkpis"></div>
<div style="overflow-x:auto"><table><thead><tr><th>묻던 항목</th><th>사람이 한 말</th><th>횟수</th><th>AI</th><th class="hide-m">AI 가 읽어 낸 값</th><th class="hide-m">마지막</th></tr></thead><tbody id="mrows"></tbody></table></div>
</section>
</div>
<div id="drawer"></div>` : `<div class="login"><h2 style="margin:0">맞춤 제안서 관리</h2>
<p class="mut small">통합 관제에 로그인하면 이 화면도 바로 열립니다.</p><a href="/ops"><button class="pri" style="width:100%">통합 관제 로그인으로</button></a>
${keyLogin ? `<p class="mut small" style="margin-top:18px">또는 관리 키(PROPOSAL_ADMIN_KEY)로 들어가기</p><input id="key" type="password" autocomplete="current-password"><button id="go" style="width:100%">관리 키로 들어가기</button><p id="err" style="color:#ff9b9b"></p>` : ''}</div>`}
<script nonce="${nonce}">
const $=s=>document.querySelector(s);const $$=s=>[].slice.call(document.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST={received:'접수',drafting:'생성 중',drafted:'대기',sending:'발송 중',sent:'발송 완료',hold:'보류',failed:'실패',canceled:'취소'};
const PATHS={queue:'/ops/proposals',archive:'/ops/proposals/archive',insights:'/ops/proposals/insights',misses:'/ops/proposals/misses'};
const tabOf=p=>({'/ops/proposals/archive':'archive','/ops/proposals/insights':'insights','/ops/proposals/misses':'misses'})[p.replace(/\\/$/,'')]||'queue';
${ok ? `
let D=null,A=null,I=null,CUR=null,TAB=tabOf(location.pathname),POLL=null;
const post=(body)=>fetch('/ops/proposals/action',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'mk'},body:JSON.stringify(body)}).then(r=>r.json());

/* ── 탭 ── */
function setTab(t,push){
  TAB=t;
  $$('.opsnav a[data-tab]').forEach(a=>a.classList.toggle('on',a.dataset.tab===t));
  ['queue','archive','insights','misses'].forEach(k=>{$('#t-'+k).hidden=k!==t;});
  $('#hq').hidden=t!=='queue';$('#ha').hidden=t!=='archive';$('#hi').hidden=t!=='insights';$('#hm').hidden=t!=='misses';
  $('#ttl').textContent={queue:'맞춤 제안서',archive:'발송 대장',insights:'고객 인사이트',misses:'규칙이 놓친 말'}[t];
  document.title=$('#ttl').textContent+' · 관제';
  if(push)history.pushState(null,'',PATHS[t]+(t==='queue'&&CUR?'#'+CUR.row.id:''));
  if(t!=='queue')closeD(true);
  loadTab();
}
$$('.opsnav a[data-tab]').forEach(a=>a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey)return;e.preventDefault();setTab(a.dataset.tab,true);}));
window.addEventListener('popstate',()=>setTab(tabOf(location.pathname),false));
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
  const t={'1':'queue','2':'archive','3':'insights','4':'misses'}[e.key];if(t){setTab(t,true);}if(e.key==='Escape')closeD();});
function loadTab(){return TAB==='queue'?load():TAB==='archive'?loadArchive():TAB==='insights'?loadInsights():loadMisses();}
$('#refresh').onclick=loadTab;
if($('#mdays'))$('#mdays').onchange=loadMisses;
if($('#mClear'))$('#mClear').onclick=async()=>{
  if(!confirm('모아 둔 「규칙이 놓친 말」을 전부 지웁니다. 규칙을 고친 뒤 새로 모을 때 쓰세요. 계속할까요?'))return;
  const r=await post({op:'clear_misses'});
  if(r&&r.ok)loadMisses();else alert((r&&r.error)||'지우지 못했습니다');
};

/* ── 대화 AI 정지 팝업 — 「과금으로 바뀌면 멈추고, 무료 대안을 팝업으로」 (2026-09-19) ── */
function haltWhy(r){return {'payment-required':'결제 요구(402)','quota-exceeded':'무료 한도 초과(429)','billing-required':'결제 활성화 요구(403)','key-problem':'키 문제(401/400)','free-cap':'월 무료 호출 상한 도달(다음 달 1일 자동 복귀)','daily-quota':'무료 일일 한도 소진(자정에 자동 복귀)'}[r]||(r||'알 수 없음');}
function haltPopup(h){
  const pop=$('#haltPop');if(!h){pop.hidden=true;return;}
  const seen=sessionStorage.getItem('mk_halt_seen');
  const prov=h.provider==='gemini'?'Gemini(Google AI Studio)':'Claude(Anthropic)';
  $('#haltBody').innerHTML='<dl><dt>언제</dt><dd>'+esc(new Date(h.at).toLocaleString('ko-KR'))+'</dd><dt>왜</dt><dd>'+esc(haltWhy(h.reason))+'</dd><dt>공급자·모델</dt><dd>'+esc(prov+' · '+(h.model||''))+'</dd>'+(h.status?'<dt>응답</dt><dd>HTTP '+esc(h.status)+' '+esc(h.message||'')+'</dd>':'')+'</dl>'
    +'<b class="small">무료로 계속 쓰는 방법</b><ol>'
    +'<li>Gemini 무료 키를 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">AI Studio</a>에서 새 프로젝트로 다시 발급 → Netlify <code>GEMINI_API_KEY</code> 교체(무료 등급은 결제수단 없이 유지) → 「AI 다시 시도」</li>'
    +'<li>월 무료 호출 상한(<code>AI_FREE_CALLS_MONTH</code>)에 닿은 것이면 다음 달 1일 자동 복귀 — 지금 풀려면 「AI 다시 시도」</li>'
    +'<li>다른 무료 엔진: <a href="https://console.groq.com/keys" target="_blank" rel="noopener">Groq</a> · <a href="https://dash.cloudflare.com/?to=/:account/ai/workers-ai" target="_blank" rel="noopener">Cloudflare Workers AI</a> · <a href="https://openrouter.ai/models?q=free" target="_blank" rel="noopener">OpenRouter 무료 모델</a> — 연결 코드가 필요하니 Claude 에게 「○○로 바꿔 줘」라고 요청</li></ol>';
  pop.hidden=seen===h.at;
  if(!pop.hidden)setTimeout(()=>{const b=$('#haltResume');if(b)b.focus();},50);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#haltPop').hidden){$('#haltLater').click();}});
async function haltResume(){
  if(!confirm('정지를 풀고 AI 대화를 다시 켭니다. 같은 과금 신호가 또 오면 즉시 다시 멈춥니다(최대 손해 AI 1회). 계속할까요?'))return;
  const r=await post({op:'ai_resume'});
  if(r&&r.ok){sessionStorage.removeItem('mk_halt_seen');$('#haltPop').hidden=true;load();}else alert((r&&r.error)||'풀지 못했습니다');
}
$('#haltResume').onclick=haltResume;
$('#haltLater').onclick=()=>{if(D&&D.halt)sessionStorage.setItem('mk_halt_seen',D.halt.at);$('#haltPop').hidden=true;};
$('#warns').addEventListener('click',e=>{if(e.target.id==='haltShow'){sessionStorage.removeItem('mk_halt_seen');haltPopup(D.halt);}if(e.target.id==='haltResume2')haltResume();});

/* ── 접수·발송 ── */
async function load(){const m=$('#month').value;const r=await fetch('/ops/proposals/data'+(m?'?month='+m:''));if(r.status===401)return location.reload();D=await r.json();render();}
function render(){
  const c=D.config,s=D.stats,w=[];
  if(!c.mail)w.push('BREVO_API_KEY 가 없어 고객 메일이 나가지 않습니다.');
  if(c.secretDefault)w.push('PROPOSAL_SECRET(또는 DL_SECRET) 이 기본값입니다. 운영 전에 설정하세요.');
  if(!c.ai)w.push('ANTHROPIC_API_KEY 가 없어 제안서 문안은 템플릿으로 만들고, 재생성 검토는 규칙 점검만 합니다(대화 AI 와는 별개 — 대화는 GEMINI_API_KEY 무료).');
  const lt=D.lastTick;if(!lt||D.now-Date.parse(lt.at)>40*60000)w.push('정기 점검 기록이 40분 넘게 없습니다 — 게시된 배포인지, 스케줄 함수가 켜져 있는지 확인하세요. 급하면 「점검 실행」.');
  if(D.halt)w.push('대화 AI 정지 중('+haltWhy(D.halt.reason)+', '+new Date(D.halt.at).toLocaleString('ko-KR')+') — 고객 화면은 「점검 중」. 원인을 풀고 「AI 다시 시도」를 누르세요.');
  else if(D.chat&&!D.chat.key)w.push('대화 AI 키가 없습니다('+(D.chat.provider==='gemini'?'GEMINI_API_KEY':'ANTHROPIC_API_KEY')+') — 규칙 대화만 동작합니다. 무료: https://aistudio.google.com/apikey');
  $('#warns').innerHTML=w.map(x=>'<div class="warnbar">'+esc(x)+'</div>').join('');
  if(D.halt)$('#warns').insertAdjacentHTML('beforeend','<div class="infobar"><button id="haltShow">정지 안내 다시 보기</button> <button id="haltResume2">AI 다시 시도</button></div>');
  haltPopup(D.halt);
  $('#tickInfo').textContent=lt?'마지막 점검 '+new Date(lt.at).toLocaleString('ko-KR')+' · 발송 '+(lt.sent||0):'';
  const ms=$('#month');if(ms.options.length<2)D.months.forEach(m=>ms.add(new Option(m,m)));
  const openRate=s.sent?Math.round(s.opened/s.sent*100)+'%':'-';
  const wait=D.rows.filter(r=>(r.mode==='instant'&&r.status==='sent'&&!r.contacted)||r.moreOpen).length;
  const cand=D.rows.filter(r=>r.candidate&&r.candidate.state==='ready').length;
  $('#kpis').innerHTML=[['접수',s.total],['대기',s.waiting],['보류',s.hold],['실패',s.failed],['발송',s.sent],['열람률',openRate],['A등급',s.gradeA],['방식',c.mode==='instant'?'즉시':c.mode==='review'?'확인 후':'예약'],['연락 대기',wait],['검토 대기',cand]].map(([l,v])=>'<div class="kpi"><b>'+esc(v)+'</b><span>'+l+'</span></div>').join('')
   +'<div class="kpi" style="grid-column:span 2"><span>산업</span><div class="small">'+Object.entries(s.industry).map(([k,v])=>esc(k)+' '+v).join(' · ')+'</div><span>채널</span><div class="small">'+Object.entries(s.channel).map(([k,v])=>esc(k)+' '+v).join(' · ')+'</div></div>';
  const tag=(t,bg,fg,title)=>' <span class="tag" style="background:'+bg+';color:'+fg+'"'+(title?' title="'+esc(title)+'"':'')+'>'+t+'</span>';
  $('#rows').innerHTML=D.rows.map(r=>'<tr class="r" data-id="'+r.id+'"><td class="nosel"><input type="checkbox" class="chk" data-id="'+r.id+'"></td><td class="small">'+esc(r.created)+'<div class="mut">'+esc(r.no)+'</div></td><td><span class="tag s-'+r.status+'">'+ST[r.status]+'</span>'
    +(r.mode==='instant'&&r.status==='sent'&&!r.contacted?tag('연락 필요','#3a2a0a','#fbbf24'):'')
    +(r.moreOpen?tag('추가 요청 '+r.moreAsks,'#3b1d4a','#e9b3ff','다른 과제로 다시 신청 — 전체 현장 견적 상담 연결'):'')
    +(r.mode==='review'&&!/sent|canceled/.test(r.status)?tag('확인 필요','#0f2a44','#93c5fd'):'')
    +(r.candidate?tag(r.candidate.state==='ready'?'검토 대기 v'+r.candidate.n:r.candidate.state==='error'?'재생성 실패':'재생성 중','#1d2b4a','#c4d4ff'):'')
    +(r.lastError?'<div class="small" style="color:#ff9b9b">'+esc(r.lastError).slice(0,40)+'</div>':'')+'</td>'
    +'<td><span class="tag g-'+r.grade+'" title="'+esc(r.gradeWhy)+'">'+esc(r.grade)+' '+r.score+'</span>'+(r.gradeWhy?'<div class="small mut" style="max-width:220px">'+esc(r.gradeWhy.replace(/^\\d+점 — /,''))+'</div>':'')+'</td>'
    +'<td><b>'+esc(r.company)+'</b>'+(r.customer?tag('기존 고객','#0f3d3a','#5eead4'):'')+'<div class="small mut">'+({finder:'파인더 · ',contact:'상담폼 · ',widget:'빠른상담 · ',whitepaper:'백서 · '}[r.entry]||'')+esc(r.name)+' '+esc(r.title)+' · '+esc(r.phone||r.email)+'</div></td>'
    +'<td class="hide-m small">'+esc(r.industry)+'<div class="mut">'+esc(r.problems.join(', '))+(r.also.length?' <span title="'+esc(r.also.join(', '))+'">+'+r.also.length+'</span>':'')+'</div></td>'
    +'<td class="hide-m small">'+(r.top[0]?esc(r.top[0].name)+' '+r.top[0].pct+'%':'')+'</td><td class="small">'+(r.status==='sent'?'<span class="mut">'+esc(r.sent)+'</span>':esc(r.due))+'</td><td class="hide-m small">PDF '+r.pdfOpens+' · 화면 '+r.views+(r.sends>1?'<div class="mut">발송 '+r.sends+'회</div>':'')+'</td></tr>').join('')||'<tr><td colspan="8" class="mut">아직 접수가 없습니다.</td></tr>';
  $$('tr.r').forEach(tr=>tr.onclick=e=>{ if(e.target.closest('.nosel'))return; openJob(tr.dataset.id); });
  $$('#rows .chk').forEach(c=>c.onchange=syncDel);
  syncDel();
  if(location.hash.length>2&&!CUR)openJob(location.hash.slice(1));
}

/* ── 한 건 ── */
async function openJob(id){
  const x=await fetch('/ops/proposals/job?id='+encodeURIComponent(id)).then(r=>r.json());
  if(!x.ok)return;
  CUR=x;history.replaceState(null,'',PATHS.queue+'#'+id);drawJob();
  clearTimeout(POLL);
  const c=x.row.candidate;
  if(c&&['queued','building','reviewing'].includes(c.state))POLL=setTimeout(()=>{if(CUR&&CUR.row.id===id&&$('#drawer').classList.contains('on'))openJob(id);},3000);
}
const QUICK=['문장을 더 짧고 담백하게','선택 과제와 닮은 사례를 앞에 설명','도입 단계를 현장 작업 순서로 구체적으로','회사 이름 대신 「귀사」로','현장 담당자(시설팀) 눈높이로','경영진 보고용으로 효과·리스크 중심'];
function aiPanel(r){
  const c=r.candidate, st=c?c.state:'';
  const step=st==='ready'?2:st==='reviewing'?1:0;
  const flow='<div class="flow">'+['① Claude 재생성','② 확인 (점검·검토)','③ 발송 여부 결정'].map((t,i)=>'<span class="'+(i<step?'done':i===step?'on':'')+'">'+(i<step?'✓ ':'')+t+'</span>').join('')+'</div>';
  let h='<div class="ai" id="aiBox"><h3>Claude 재생성 · 검토 <small>현재 발송본은 채택 전까지 그대로</small></h3>'+flow;
  if(!c||st==='error'){
    h+=(st==='error'?'<div class="warnbar">재생성 실패: '+esc(c.error||'')+'</div>':'')
     +'<div class="small mut">이번 재작성에 바라는 점(선택) — 비워 두면 같은 자료로 다시 씁니다</div>'
     +'<textarea id="instr" maxlength="500" placeholder="예) 누수 사례를 앞으로, 문장은 짧게, 야간 무인 운영을 강조">'+esc((c&&c.instruction)||'')+'</textarea>'
     +'<div class="chips">'+QUICK.map(q=>'<button data-q="'+esc(q)+'">'+esc(q)+'</button>').join('')+'</div>'
     +'<div class="acts"><button class="pri" data-act="ai_regen">Claude로 재생성 →</button><span class="small mut">'+(D&&D.config.ai?'생성 30~60초 · 검토 10~20초':'API 키가 없어 템플릿으로 만들고 규칙 점검만 합니다')+'</span></div>';
  } else if(st!=='ready'){
    h+='<p><span class="spin"></span> '+({queued:'재생성을 준비하고 있습니다',building:'Claude가 v'+c.n+' 문안을 쓰고 PDF를 만드는 중입니다',reviewing:'규칙 점검과 Claude 검토 중입니다'})[st]+' <span class="mut small">'+new Date(c.at).toLocaleTimeString('ko-KR')+' 요청'+(c.instruction?' · 「'+esc(c.instruction)+'」':'')+'</span></p>';
  } else {
    const v=c.review||{},vn={send:'발송 추천',revise:'수정 추천',hold:'보류 추천'}[v.verdict]||'-';
    h+='<div class="verdict v-'+esc(v.verdict)+'"><div class="score">'+esc(v.score)+'</div><div><b>'+vn+'</b> <span class="small mut">v'+c.n+' · '+(v.by==='claude'?'Claude 검토 ('+esc(v.model||'')+')':'규칙 점검')+'</span><div class="small">'+esc(v.summary)+'</div>'+(v.error?'<div class="small" style="color:#ffd9a0">'+esc(v.error)+'</div>':'')+'</div></div>'
     +(v.issues&&v.issues.length?'<div>'+v.issues.map(i=>'<div class="issue"><em class="l-'+esc(i.level)+'">'+esc(i.where||i.level)+'</em>'+esc(i.text)+'</div>').join('')+'</div>':'')
     +'<div class="sec"><b class="small">규칙 점검</b><div class="chk">'+(c.checks||[]).map(k=>'<i>'+(k.ok?'✅':k.warn?'⚠️':'❌')+'</i><span>'+esc(k.label)+'</span><span class="mut">'+esc(k.note)+'</span>').join('')+'</div></div>'
     +'<div class="diff"><div><b>지금 발송본 요약</b>'+esc(c.prevSummary||'-')+'</div><div><b>새 v'+c.n+' 요약 '+(c.draft&&c.draft.ai?'(AI)':'(템플릿)')+'</b>'+esc(c.draft?c.draft.summary:'')+'</div></div>'
     +(c.instruction?'<div class="small mut">요청: 「'+esc(c.instruction)+'」</div>':'')
     +'<div class="acts"><a target="_blank" href="/ops/proposals/pdf?id='+r.id+'&c=1"><button>v'+c.n+' PDF 열어 보기 ('+esc(c.pages)+'쪽)</button></a></div>'
     +'<div class="acts">'
       +'<button class="ok" data-act="cand_send">'+(r.status==='sent'?'이 버전으로 재발송':'이 버전으로 지금 발송')+'</button>'
       +(r.status!=='sent'?'<button class="pri" data-act="cand_adopt">채택 — 예정대로 발송 ('+esc(r.due)+')</button>':'<button data-act="cand_adopt">채택만 (보내지 않음)</button>')
       +'<button data-act="cand_retry">요청 고쳐서 다시 생성</button>'
       +'<button data-act="cand_discard">버리기</button>'
       +(r.status!=='hold'&&r.status!=='sent'?'<button class="warn" data-act="hold">보류</button>':'')
     +'</div>'
     +'<div id="retryBox" hidden><textarea id="instr" maxlength="500">'+esc(v.retry||c.instruction||'')+'</textarea><div class="chips">'+QUICK.map(q=>'<button data-q="'+esc(q)+'">'+esc(q)+'</button>').join('')+'</div><div class="acts"><button class="pri" data-act="ai_regen">이 요청으로 다시 생성 →</button></div></div>';
  }
  if(r.versions.length)h+='<div class="sec"><b class="small">버전 기록</b>'+r.versions.slice().reverse().map(x=>'<div class="small">'+(x.adopted?'<b style="color:#8ff0df">● 발송본</b> ':'○ ')+'v'+x.n+' '+(x.label?esc(x.label)+' ':'')+(x.ai?'AI':'템플릿')+(x.review?' · 검토 '+esc(x.review.verdict)+' '+x.review.score:'')+(x.instruction?' · 「'+esc(x.instruction)+'」':'')+' <span class="mut">'+new Date(x.at).toLocaleString('ko-KR')+'</span> <a style="color:#9fc3ff" target="_blank" href="/ops/proposals/pdf?id='+r.id+'&v='+x.n+'">PDF</a></div>').join('')+'</div>';
  return h+'</div>';
}
function drawJob(){
  const r=CUR.row,d=$('#drawer');
  const due=new Date(r.dueAt+9*3600000).toISOString().slice(0,16);
  const bad=(r.checks||[]).filter(k=>!k.ok&&!k.warn);
  d.innerHTML='<button data-act="close" style="float:right">닫기 (Esc)</button><h2>'+esc(r.company)+'</h2><div class="mut">'+esc(r.no)+' · <span class="tag s-'+r.status+'">'+ST[r.status]+'</span> · '+(r.approved?'승인됨':'미승인')+(r.crm?' · 먼데이 연결':'')+'</div>'
  +'<div class="acts">'+(r.built?'<a target="_blank" href="/ops/proposals/pdf?id='+r.id+'"><button class="pri">발송본 PDF</button></a>':'<span class="mut small">PDF 생성 전</span>')
  +(r.status==='hold'?'<button data-act="release">보류 해제</button>':r.status!=='sent'&&r.status!=='canceled'?'<button data-act="hold">보류</button>':'')
  +(D.config.review==='manual'&&!r.approved?'<button data-act="approve">승인</button>':'')
  +(r.status==='sent'?'<button data-act="resend">재발송</button>':'<button data-act="send_now">지금 발송</button>')
  +((r.status==='sent'&&!r.contacted)||r.moreOpen?'<button class="ok" data-act="contacted">확인 연락 완료</button>':'')
  +'<button data-act="rebuild">템플릿으로 재생성</button>'
  +(r.statusUrl?'<a target="_blank" href="'+esc(r.statusUrl)+'"><button>고객 화면</button></a>':'')
  +(r.status!=='sent'&&r.status!=='canceled'?'<button class="warn" data-act="cancel">취소</button>':'')+'</div>'
  +(bad.length?'<div class="warnbar">발송본 규칙 점검: '+bad.map(k=>esc(k.label)+' — '+esc(k.note)).join(' / ')+'</div>':'')
  +aiPanel(r)
  +'<div class="sec"><b>발송 이력</b> <span class="small mut">누구에게 무슨 자료가 나갔는지</span>'+(CUR.sends.length?CUR.sends.map(s=>'<div class="small">'+esc(s.at)+' · '+({proposal:'제안서',resend:'재발송',followup:'후속 안내'}[s.kind]||s.kind)+' · '+esc(s.doc)+(s.version?' v'+s.version:'')+(s.ai?' (AI)':'')+' → '+esc(s.to.name)+' '+esc(s.to.email)+' <span class="mut">'+esc(s.by==='auto'?'자동':s.by)+' · '+esc(s.via)+(s.attached?' 첨부':'')+'</span>'+(s.pdf?' <a style="color:#9fc3ff" target="_blank" href="/ops/proposals/archive/pdf?key='+encodeURIComponent(s.key)+'">보낸 PDF</a>':'')+'</div>').join(''):'<div class="small mut">아직 발송 전</div>')+'</div>'
  +'<div class="sec"><div class="kv"><div>담당</div><div>'+esc(r.name)+' '+esc(r.title)+'</div><div>연락</div><div>'+[r.phone?'<a style="color:#9fc3ff" href="tel:'+esc(r.phone)+'">'+esc(r.phone)+'</a>':'','<a style="color:#9fc3ff" href="mailto:'+esc(r.email)+'">'+esc(r.email)+'</a>'].filter(Boolean).join(' · ')+'</div><div>산업·시설</div><div>'+[r.industry,r.segment,r.facility,r.region].filter(Boolean).map(esc).join(' · ')+'</div><div>규모·시점</div><div>'+([r.scale,r.timeline].filter(Boolean).map(esc).join(' · ')||'-')+'</div><div>기준 과제</div><div>'+r.problems.map(esc).join(', ')+'</div>'+(r.also.length?'<div>추가 관심</div><div style="color:#e9b3ff">'+r.also.map(esc).join(', ')+'</div>':'')+'<div>목표</div><div>'+r.goals.map(esc).join(', ')+'</div><div>메모</div><div>'+(esc(r.memo)||'-')+'</div><div>유입</div><div class="small">'+esc(r.source)+' · '+esc(r.device)+' · '+esc(r.ip)+'</div><div>마케팅</div><div>'+(r.consentMkt?'수신 동의':'미동의')+'</div></div></div>'
  +(r.gradeItems.length?'<div class="sec"><b>등급 근거</b> <span class="tag g-'+r.grade+'">'+esc(r.grade)+' '+r.score+'점</span><div class="small" style="margin:4px 0 6px">'+esc(r.gradeMeaning)+'</div>'
    +'<table style="width:100%;font-size:12.5px">'+r.gradeItems.map(it=>'<tr><td class="mut">'+esc(it.label)+'</td><td>'+esc(it.note)+'</td><td style="text-align:right;white-space:nowrap;color:'+(it.pts?'#5eead4':'#8fa2bd')+'">'+it.pts+' / '+it.max+'</td></tr>').join('')+'</table>'
    +(r.gradeNext?'<div class="small" style="margin-top:6px;color:#fbbf24">'+esc(r.gradeNext)+'</div>':'')+'</div>':'')
  +'<div class="sec"><b>자동 판단</b>'+Object.entries(r.intake||{}).map(([k,v])=>'<div class="small"><span class="mut">'+esc(k)+'</span> '+esc(v)+'</div>').join('')+'</div>'
  +'<div class="sec"><b>매칭</b> <span class="mut small">신뢰도 '+esc(r.confidence)+'</span>'+r.top.map((t,i)=>'<div class="small">'+(i+1)+'위 '+esc(t.name)+' <b>'+t.pct+'%</b> <span class="mut">'+t.why.map(esc).join(' / ')+'</span></div>').join('')+'</div>'
  +'<div class="sec"><b>발송 예정</b><div class="acts"><input type="datetime-local" id="due" value="'+due+'"><button data-act="resched">변경</button></div><div class="small mut">한국 시간 기준</div></div>'
  +'<div class="sec"><b>요약 문안 직접 고치기</b> <span class="small mut">'+(r.ai?'AI':'템플릿')+'</span><textarea id="sum">'+esc(r.override&&r.override.summary||r.summary)+'</textarea><div class="acts"><button data-act="summary">요약 고치고 PDF 다시 만들기</button></div></div>'
  +'<div class="sec"><b>내부 메모</b><textarea id="note">'+esc(r.note)+'</textarea><div class="acts"><button data-act="note">저장</button><button data-act="no_followup">후속 메일 끄기</button></div></div>'
  +'<div class="sec"><b>알림</b>'+r.notices.map(n=>'<div class="small">'+(n.ok?'✓':'✗')+' '+esc(n.type)+' <span class="mut">'+new Date(n.at).toLocaleString('ko-KR')+' '+esc(n.via||'')+' '+esc(n.error||'')+'</span></div>').join('')+'</div>'
  +'<div class="sec"><b>기록</b>'+r.log.slice().reverse().map(l=>'<div class="small"><span class="mut">'+new Date(l.at).toLocaleString('ko-KR')+'</span> '+esc(l.msg)+'</div>').join('')+'</div>';
  d.classList.add('on');
}
function closeD(quiet){$('#drawer').classList.remove('on');clearTimeout(POLL);CUR=null;if(!quiet&&TAB==='queue')history.replaceState(null,'',PATHS.queue);}
async function act(op,extra){
  if(!CUR)return;const id=CUR.row.id;
  const x=await post(Object.assign({id,op},extra||{}));
  if(!x.ok)alert(x.error||'실패');
  await Promise.all([openJob(id),load()]);
  return x;
}
$('#drawer').addEventListener('click',e=>{
  const q=e.target.closest('[data-q]');if(q){const t=$('#instr');t.value=(t.value?t.value.replace(/\\s+$/,'')+', ':'')+q.dataset.q;t.focus();return;}
  const b=e.target.closest('[data-act]');if(!b||!CUR)return;
  const a=b.dataset.act,r=CUR.row;
  if(a==='close')return closeD();
  if(a==='ai_regen'){b.disabled=true;return act('ai_regen',{instruction:($('#instr')||{}).value||''});}
  if(a==='cand_retry'){$('#retryBox').hidden=false;$('#instr').focus();return;}
  if(a==='cand_send'){if(confirm((r.status==='sent'?'이 버전으로 고객에게 다시 보낼까요?':'이 버전으로 지금 고객에게 보낼까요?')+'\\n'+r.name+' · '+r.email))act('candidate',{decision:'send'});return;}
  if(a==='cand_adopt')return act('candidate',{decision:'adopt'});
  if(a==='cand_discard'){if(confirm('v'+r.candidate.n+' 을 버리고 지금 발송본을 유지할까요?'))act('candidate',{decision:'discard'});return;}
  if(a==='send_now'){if(confirm('지금 고객에게 발송할까요?'))act('send_now');return;}
  if(a==='resend'){if(confirm('같은 제안서를 다시 보낼까요?'))act('send_now',{again:true});return;}
  if(a==='contacted')return act('contacted',{text:prompt('연락 메모(선택)')||''});
  if(a==='cancel'){if(confirm('발송을 취소할까요?'))act('cancel',{reason:prompt('사유(선택)')||''});return;}
  if(a==='resched'){const v=$('#due').value;if(v)act('reschedule',{due:v+':00+09:00'});return;}
  if(a==='summary')return act('summary',{text:$('#sum').value});
  if(a==='note')return act('note',{text:$('#note').value});
  act(a);
});
$('#month').onchange=load;
/* 연동 점검 — 기본(설정·저장소·PDF·스케줄) → 이어서 외부 서비스 읽기 전용 호출 */
async function health(deep){
  const box=$('#health');box.hidden=false;
  box.innerHTML='<h3>연동 점검 <span class="small mut"><span class="spin"></span> '+(deep?'외부 서비스까지 확인 중':'확인 중')+'</span></h3>';
  const x=await fetch('/ops/proposals/health'+(deep?'?deep=1':'')).then(r=>r.json()).catch(e=>({ok:false,items:[{label:'점검 요청',ok:false,detail:String(e)}]}));
  box.innerHTML='<h3>연동 점검 '+(x.ok?'<span class="tag" style="background:#0f3d3a;color:#8ff0df">정상</span>':'<span class="tag" style="background:#4a1d1f;color:#ffb3b3">확인 필요 '+(x.bad||'')+'</span>')+(x.warn?' <span class="tag" style="color:#ffd9a0">참고 '+x.warn+'</span>':'')+' <span class="small mut">'+(x.at?new Date(x.at).toLocaleString('ko-KR'):'')+(deep?' · 외부 서비스 포함':' · 기본')+'</span></h3>'
   +'<div class="chk">'+(x.items||[]).map(i=>'<i>'+(i.ok?'✅':i.warn?'⚠️':'❌')+'</i><span>'+esc(i.label)+'</span><span class="mut">'+esc(i.detail)+'</span>').join('')+'</div>'
   +'<div class="acts">'+(deep?'':'<button data-h="deep" class="pri">외부 서비스까지 확인 (읽기 전용)</button>')+'<button data-h="close">닫기</button></div>';
}
/* ── 접수 지우기 (2026-09-18) ────────────────────────────────────
   점검하려고 내가 넣은 접수를 목록에서 없앤다. 개인정보·PDF 사본을 실제로 지우고
   대기 중이면 발송 예약도 함께 지운다. 누가 언제 무엇을 지웠는지는 따로 남는다. */
function selIds(){ return $$('#rows .chk').filter(c=>c.checked).map(c=>c.dataset.id); }
function syncDel(){
  const n=selIds().length, bar=$('#delbar');
  bar.style.display=n?'flex':'none';
  $('#delcnt').textContent=n+'건 선택됨';
  const all=$('#chkAll'); if(all){ const t=$$('#rows .chk').length; all.checked=t>0&&n===t; all.indeterminate=n>0&&n<t; }
}
document.addEventListener('change',e=>{ if(e.target&&e.target.id==='chkAll'){ $$('#rows .chk').forEach(c=>c.checked=e.target.checked); syncDel(); }});
document.addEventListener('click',async e=>{
  if(e.target&&e.target.id==='delClear'){ $$('#rows .chk').forEach(c=>c.checked=false); syncDel(); return; }
  if(!e.target||e.target.id!=='delBtn')return;
  const ids=selIds(); if(!ids.length)return;
  const force=$('#delForce').checked;
  const names=ids.map(id=>{const r=(D.rows||[]).find(x=>x.id===id);return r?r.company+' ('+r.no+')':id;});
  if(!confirm('아래 '+ids.length+'건을 지웁니다. 되돌릴 수 없습니다.\\n\\n'+names.slice(0,10).join('\\n')+(names.length>10?'\\n… 외 '+(names.length-10)+'건':'')))return;
  const btn=e.target; btn.disabled=true; btn.textContent='지우는 중…';
  let ok=0; const err=[];
  for(const id of ids){
    const r=await post({id,op:'delete',force}).catch(x=>({ok:false,error:String(x)}));
    if(r&&r.ok)ok++; else err.push((names[ids.indexOf(id)]||id)+' — '+((r&&r.error)||'실패'));
  }
  btn.disabled=false; btn.textContent='선택한 접수 지우기';
  CUR=null; await load();
  alert(ok+'건을 지웠습니다.'+(err.length?'\\n\\n못 지운 건 '+err.length+'건:\\n'+err.join('\\n'):''));
});
$('#healthBtn').onclick=()=>health(false);
$('#health').addEventListener('click',e=>{const b=e.target.closest('[data-h]');if(!b)return;if(b.dataset.h==='deep')health(true);else $('#health').hidden=true;});
$('#tickBtn').onclick=async()=>{const b=$('#tickBtn');b.disabled=true;const x=await post({op:'tick'});b.disabled=false;const r=x.result||{};$('#tickInfo').textContent='점검 결과 · 발송 '+(r.sent||0)+' · 실패 '+(r.failed||0)+' · 재시도 '+(r.kicked||0)+' · 후속 '+(r.followup||0);load();};

/* ── 발송 대장 ── */
async function loadArchive(){
  const m=$('#amonth').value;
  const r=await fetch('/ops/proposals/archive/data'+(m?'?month='+m:''));if(r.status===401)return location.reload();
  A=await r.json();
  const ms=$('#amonth');if(ms.options.length<2)A.months.forEach(x=>ms.add(new Option(x,x)));
  drawArchive();
}
function drawArchive(){
  const k=$('#akind').value,q=$('#aq').value.trim().toLowerCase();
  const rows=A.rows.filter(r=>(!k||r.kind===k)&&(!q||[r.company,r.to.email,r.to.name,r.problems.join(' '),r.industry.label,r.no].join(' ').toLowerCase().includes(q)));
  const cos=new Set(rows.map(r=>r.companyKey)).size;
  $('#abar').innerHTML=A.monday?'<div class="infobar">먼데이 「제안서 발송 대장」 보드와 연결되어 있습니다 — 발송 1건마다 항목이 생기고 열람·연락·추가 요청이 업데이트로 쌓입니다.</div>'
    :'<div class="infobar">사이트 안 대장이 기준 기록입니다. 먼데이에도 쌓으려면 환경변수 PROPOSAL_MONDAY_TOKEN(없으면 관제의 MONDAY_TOKEN)·PROPOSAL_MONDAY_BOARD 를 넣으세요. 분석은 「대장 CSV」를 스프레드시트·BI에 붙여도 됩니다.</div>';
  $('#akpis').innerHTML=[['나간 자료',rows.length],['회사',cos],['제안서',rows.filter(r=>r.kind==='proposal').length],['재발송',rows.filter(r=>r.kind==='resend').length],['후속 안내',rows.filter(r=>r.kind==='followup').length],['AI 문안',rows.filter(r=>r.ai).length],['열람',rows.filter(r=>r.opens>0&&r.kind!=='followup').length],['추가 요청',rows.filter(r=>r.asks).length]].map(([l,v])=>'<div class="kpi"><b>'+v+'</b><span>'+l+'</span></div>').join('');
  $('#arows').innerHTML=rows.map(r=>'<tr><td class="small">'+esc(r.atText)+'<div class="mut">'+esc(r.no)+'</div></td>'
    +'<td><b>'+esc(r.company)+'</b><div class="small mut">'+esc(r.to.name)+' '+esc(r.to.title)+' · '+esc(r.to.email||'(파기)')+'</div></td>'
    +'<td class="small">'+({proposal:'제안서',resend:'재발송',followup:'후속 안내'}[r.kind]||r.kind)+' · '+esc(r.doc)+'<div class="mut">'+(r.ai?'AI '+esc(r.model):'템플릿')+(r.version?' · v'+r.version:'')+(r.review?' · 검토 '+esc(r.review.verdict):'')+' · '+esc(r.by==='auto'?'자동':r.by)+(r.crm?' · 먼데이':'')+'</div></td>'
    +'<td class="hide-m small">'+esc(r.problems.join(', '))+(r.also.length?' <span class="mut">+'+esc(r.also.join(', '))+'</span>':'')+'<div class="mut">'+esc(r.industry.label)+(r.segment?' › '+esc(r.segment):'')+' · '+esc(r.channel)+'</div></td>'
    +'<td><span class="tag g-'+esc(r.grade)+'">'+esc(r.grade)+' '+esc(r.score)+'</span></td>'
    +'<td class="small">'+(r.kind==='followup'?'<span class="mut">-</span>':(r.opens?'열람 '+r.opens+(r.firstOpenAt?'<div class="mut">'+esc(r.firstOpenAt)+'</div>':''):'<span class="mut">미열람</span>'))+(r.contacted?'<div style="color:#8ff0df">연락 완료</div>':'')+(r.asks?'<div style="color:#e9b3ff">추가 요청 '+r.asks+'</div>':'')+'</td>'
    +'<td class="small">'+(r.pdf?'<a style="color:#9fc3ff" target="_blank" href="/ops/proposals/archive/pdf?key='+encodeURIComponent(r.key)+'">PDF</a> ':'')+'<a style="color:#9fc3ff" href="'+PATHS.queue+'#'+r.id+'" data-open="'+r.id+'">건 보기</a></td></tr>').join('')||'<tr><td colspan="7" class="mut">아직 나간 자료가 없습니다.</td></tr>';
}
$('#amonth').onchange=loadArchive;$('#akind').onchange=()=>A&&drawArchive();$('#aq').oninput=()=>A&&drawArchive();
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(!o||e.metaKey||e.ctrlKey)return;e.preventDefault();setTab('queue',true);openJob(o.dataset.open);});

/* ── 고객 인사이트 ── */
async function loadInsights(){
  $('#ins').innerHTML='<p class="mut"><span class="spin"></span> 집계 중…</p>';
  const r=await fetch('/ops/proposals/insights/data?days='+$('#days').value);if(r.status===401)return location.reload();
  I=await r.json();drawInsights();
}

/* ── 규칙이 놓친 말 ── AI 를 부른 이유를 눈으로 보고 규칙을 고치는 화면 */
const kpi=(label,val,note)=>'<div class="kpi"><b>'+esc(val)+'</b><span>'+esc(label)+'</span>'+(note?'<span class="mut small" style="display:block;margin-top:3px;line-height:1.4">'+esc(note)+'</span>':'')+'</div>';
const ASKNAME={company:'회사명',name:'성함',email:'이메일',fac:'현장 종류',con:'고민 주제',done:'확인'};
const WHYNAME={unmatched:'사전에 없는 말',question:'질문을 했다',empty:'빈 답','rescue-typo':'오타로 추정해 살림','rescue-keyboard':'영문 자판으로 추정해 살림','rescue-chosung':'초성으로 추정해 살림','rescue-email-ask':'이메일 오타 되물음','rescue-email-fix':'이메일 모양 교정','ai-error':'AI 호출 실패(연동 점검 참고)'};
async function loadMisses(){
  $('#mrows').innerHTML='<tr><td colspan="6" class="mut"><span class="spin"></span> 모으는 중…</td></tr>';
  const r=await fetch('/ops/proposals/misses/data?days='+$('#mdays').value);if(r.status===401)return location.reload();
  const m=await r.json();drawMisses(m);
}
function drawMisses(m){
  const t=m.totals||{},g=m.grouped||[];
  const saved=Math.max(0,(t.rows||0)-(t.ai||0));
  $('#mkpis').innerHTML=
    kpi('못 알아들은 말',(t.rows||0)+'건','규칙에 난 구멍의 수')+
    kpi('AI 를 부른 것',(t.ai||0)+'건',(t.rows?Math.round((t.ai/t.rows)*100):0)+'% — 나머지는 되묻기로 해결')+
    kpi('되묻기로 막은 것',saved+'건','AI 없이 끝난 실수')+
    kpi('이 기간 AI 비용','$'+(t.usd||0).toFixed(4),'놓친 말을 규칙에 넣으면 0 에 가까워집니다');
  if(!g.length){$('#mrows').innerHTML='<tr><td colspan="6" class="mut">아직 놓친 말이 없습니다. 규칙이 다 알아듣고 있습니다.</td></tr>';return;}
  $('#mrows').innerHTML=g.map(x=>{
    const got=x.got?Object.entries(x.got).map(([k,v])=>esc(ASKNAME[k]||k)+' → <b>'+esc(v)+'</b>').join('<br>'):'<span class="mut">—</span>';
    return '<tr>'+
      '<td>'+esc(ASKNAME[x.ask]||x.ask||'—')+'</td>'+
      '<td style="max-width:360px;word-break:break-all">'+esc(x.say||'')+'<br><span class="mut small">'+esc(WHYNAME[x.why]||x.why||'')+'</span></td>'+
      '<td>'+x.n+'</td>'+
      '<td>'+(x.ai?'<b class="ai-mark">AI '+x.ai+'</b><br><span class="mut small">$'+(x.usd||0).toFixed(4)+'</span>':'<span class="mut">—</span>')+'</td>'+
      '<td class="hide-m small">'+got+'</td>'+
      '<td class="hide-m mut small">'+(x.last?new Date(x.last).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'')+'</td>'+
    '</tr>';
  }).join('');
}
function tbl(title,g,note){
  const max=Math.max(1,...g.map(x=>x.n));
  return '<div class="card"><h3>'+title+'</h3>'+(note?'<div class="small mut" style="margin:-4px 0 6px">'+note+'</div>':'')+'<table><tr><th>항목</th><th></th><th class="num">접수</th><th class="num">발송</th><th class="num">열람률</th><th class="num">추가 요청</th><th class="num">평균 점수</th></tr>'
   +(g.length?g.map(x=>'<tr><td>'+esc(x.key)+'</td><td style="width:54px"><div class="bar"><i style="width:'+Math.round(x.n/max*100)+'%"></i></div></td><td class="num">'+x.n+'</td><td class="num">'+x.sent+'</td><td class="num">'+(x.sent?x.openRate+'%':'-')+'</td><td class="num">'+(x.asked||'')+'</td><td class="num">'+x.avgScore+'</td></tr>').join(''):'<tr><td colspan="7" class="mut">데이터 없음</td></tr>')+'</table></div>';
}
function drawInsights(){
  const f=I.funnel,ai=I.ai;
  const maxH=Math.max(1,...I.byHour);
  const heatC=h=>h>=70?'background:#0f3d3a;color:#8ff0df':h>=45?'background:#1d2b4a;color:#c4d4ff':'background:#1B2A42;color:#8FA2BD';
  $('#ins').innerHTML=
  '<div class="card aicard" style="margin-bottom:12px"><h3>Claude 영업 인사이트 <span class="small mut">'+(ai&&ai.ok?new Date(ai.at).toLocaleString('ko-KR')+' 기준 · 접수 '+ai.basis.applied+'건':'아직 없음')+'</span></h3>'
   +(ai&&ai.ok?'<p style="font-size:15px;font-weight:700;margin:4px 0 8px">'+esc(ai.headline)+'</p><div class="grid2"><div><b class="small">관찰</b><ul>'+ai.findings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><b class="small">이번 주 할 일</b><ul>'+ai.actions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><b class="small">광고·콘텐츠</b><ul>'+ai.content.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><b class="small">주의</b><ul>'+ai.watch.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div></div>':'<p class="small mut">아래 집계(이름·연락처 제외)를 Claude에게 넘겨 영업팀이 바로 쓸 관찰·할 일을 정리합니다.</p>')
   +'<div class="acts"><button class="pri" id="aiIns"'+(I.aiReady?'':' disabled title="ANTHROPIC_API_KEY 필요"')+'>Claude로 인사이트 정리 ('+esc($('#days').selectedOptions[0].text)+')</button><span class="small mut" id="aiInsMsg"></span></div></div>'
  +'<div class="funnel" style="margin-bottom:12px">'+[['접수',f.applied,''],['발송',f.sent,''],['열람',f.opened,f.openRate+'%'],['확인 연락',f.contacted,f.contactRate+'%'],['추가 요청(견적 의향)',f.asked,f.askRate+'%'],['첫 열람까지',f.medianOpenHours==null?'-':f.medianOpenHours+'시간','중앙값'],['나간 자료',I.docs.total,'AI '+I.docs.ai+' · 후속 '+I.docs.followup]].map(x=>'<div><small>'+x[0]+'</small><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></div>').join('')+'</div>'
  +'<div class="card" style="margin-bottom:12px"><h3>먼저 연락할 회사 <span class="small mut">반응(열람·재방문·추가 요청)과 등급을 합친 점수 · 연락 완료는 낮춤</span></h3><div style="overflow-x:auto"><table><tr><th>점수</th><th>회사</th><th>업종 · 과제 (*는 추가 관심)</th><th>근거</th><th class="num">자료</th><th>최근</th><th></th></tr>'
   +(I.companies.slice(0,25).map(c=>'<tr><td><span class="heat" style="'+heatC(c.heat)+'">'+c.heat+'</span></td><td><b>'+esc(c.company)+'</b></td><td class="small">'+esc(c.industries.join(', '))+'<div class="mut">'+esc(c.problems.join(', '))+'</div></td><td class="small">'+esc(c.why.join(' · '))+'</td><td class="num">'+c.docs+'</td><td class="small">'+esc(c.lastAt)+'</td><td class="small"><a style="color:#9fc3ff" href="#" data-open="'+c.ids[0]+'">건 보기</a></td></tr>').join('')||'<tr><td colspan="7" class="mut">데이터 없음</td></tr>')+'</table></div></div>'
  +'<div class="grid2">'
   +tbl('산업별',I.byIndustry)+tbl('기준 과제별',I.byProblem,'무료 제안서의 과제(가장 고민되는 것)')+tbl('세부 업종별',I.bySegment)+tbl('입구별',I.byEntry)+tbl('채널별',I.byChannel)+tbl('등급별',I.byGrade)+tbl('감시 규모별',I.byScale)+tbl('도입 시점별',I.byTimeline)
   +'<div class="card"><h3>함께 관심 <span class="small mut">기준 과제 → 추가로 말한 과제 (견적 상담 때 묶어 제안)</span></h3>'+(I.pairs.length?I.pairs.map(p=>'<div class="small" style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:5px 0"><span>'+esc(p.key)+'</span><b>'+p.n+'</b></div>').join(''):'<p class="small mut">아직 없음</p>')+'</div>'
   +'<div class="card"><h3>신청 시간대</h3><div class="hours">'+I.byHour.map((n,h)=>'<i title="'+h+'시 '+n+'건" style="height:'+Math.round(n/maxH*100)+'%"></i>').join('')+'</div><div class="small mut" style="display:flex;justify-content:space-between"><span>0시</span><span>12시</span><span>23시</span></div>'
     +'<div class="small" style="margin-top:8px">'+I.byDow.map(d=>esc(d.key)+' '+d.n).join(' · ')+'</div></div>'
  +'</div>';
  const b=$('#aiIns');if(b)b.onclick=async()=>{b.disabled=true;$('#aiInsMsg').innerHTML='<span class="spin"></span> Claude가 정리하는 중 (20~40초)';const x=await post({op:'insight_ai',days:Number($('#days').value)});if(!x.ok){$('#aiInsMsg').textContent=x.error||'실패';b.disabled=false;return;}I.ai=x;drawInsights();};
}
$('#days').onchange=loadInsights;
${keyLogin ? "$('#logout').onclick=async()=>{await fetch('/ops/proposals/logout',{method:'POST'});location.href='/ops';};" : ''}
setTab(TAB,false);
setInterval(()=>{if(TAB==='queue'&&!$('#drawer').classList.contains('on'))load();},60000);
` : `
$$('.opsnav a[data-tab]').forEach(a=>a.classList.toggle('on',a.dataset.tab===tabOf(location.pathname)));
async function go(){const r=await fetch('/ops/proposals/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:$('#key').value})});const x=await r.json();if(x.ok)location.reload();else $('#err').textContent=x.error;}
if($('#go')){$('#go').onclick=go;$('#key').onkeydown=e=>{if(e.key==='Enter')go();};}
`}
</script></body></html>`;
}
