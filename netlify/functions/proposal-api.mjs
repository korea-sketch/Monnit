/** 맞춤 제안서 — 공개 API (2026-09-17)
 *
 *   POST /api/proposal          신청 접수 → { ok, token }
 *   GET  /api/proposal/status   진행 현황  ?t=<token>
 *   GET  /api/proposal/pdf      제안서 PDF ?id=&e=&s=  (발송 메일의 서명 링크)
 *   GET  /api/proposal/preview  신청 전 미리보기 ?industry=&problems=a,b&goals=c  (개인정보 없음)
 *
 *  방어
 *   · 경쟁사 차단(_guard) — 걸리면 정상 응답처럼 보이지만 아무것도 만들지 않는다
 *   · 허니팟·작성시간 3초 미만 → 봇으로 보고 조용히 무시
 *   · IP당 시간당 N건, 하루 전체 N건 제한 (메일·AI 비용 폭주 방지)
 *   · 같은 이메일+회사 재신청 → 새로 만들지 않는다. 진행 화면 주소(토큰)는 응답에 싣지 않고,
 *     신청자 메일로만 다시 보낸다 — 남의 이메일·회사명만 알아도 진행 화면을 여는 일을 막는다
 *   · 요청 크기 16KB 제한 · JSON 만 · 다른 사이트에서 보낸 요청 거절(Origin / Sec-Fetch-Site)
 *   · 저장소 장애 시에도 담당자 알림 메일로 접수 내용을 남긴다 */
import * as S from '../lib/proposal/store.mjs';
import * as _test from './_istest.mjs';
import { CFG } from '../lib/proposal/config.mjs';
import { cleanInput, createJob, grade, dedupeKey, tokenKey, publicView, verifyPdf, addNotice, addLog, hash } from '../lib/proposal/jobs.mjs';
import { progress, noticeTimeline, fmtKST, kDay } from '../lib/proposal/schedule.mjs';
import { insight } from '../lib/proposal/match.mjs';
import { detect } from '../lib/proposal/company.mjs';
import { resolveIntake } from '../lib/proposal/intake.mjs';
import { PROBLEMS } from '../lib/proposal/kb.mjs';
import { langOf } from '../lib/proposal/i18n.mjs';
import { kickBuild, sendJob } from '../lib/proposal/pipeline.mjs';
import * as Mail from '../lib/proposal/mail.mjs';
import * as _guard from '../lib/proposal/guard.mjs';   /* 경쟁사 차단 — 느슨한 연결 */

export const config = { path: ['/api/proposal', '/api/proposal/status', '/api/proposal/pdf', '/api/proposal/preview', '/api/proposal/detect'] };

const BASE_H = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...BASE_H, 'content-type': 'application/json; charset=utf-8' } });

/* 허용 출처 — 이 사이트 · monnit.co.kr · 이 사이트의 Netlify 배포 주소(환경변수) · 로컬 */
const envHost = k => { try { return new URL(process.env[k] || '').hostname; } catch (e) { return ''; } };
function sameOrigin(req) {
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return false;
  const o = req.headers.get('origin');
  if (!o) return true;                                  /* 같은 출처 GET·일부 브라우저는 origin 을 안 보낸다 */
  try {
    const h = new URL(o).hostname, self = new URL(req.url).hostname;
    const allowed = [self, 'localhost', '127.0.0.1', envHost('URL'), envHost('DEPLOY_URL'), envHost('DEPLOY_PRIME_URL')].filter(Boolean);
    return allowed.includes(h) || /(^|\.)monnit\.co\.kr$/.test(h);
  } catch (e) { return false; }
}
async function readJson(req, max = 16000) {
  if (!/application\/json/i.test(req.headers.get('content-type') || '')) return { error: 'content_type' };
  const len = Number(req.headers.get('content-length') || 0);
  if (len > max) return { error: 'too_large' };
  const text = await req.text();
  if (text.length > max) return { error: 'too_large' };
  try { const b = JSON.parse(text); return b && typeof b === 'object' && !Array.isArray(b) ? { body: b } : { error: 'bad_request' }; }
  catch (e) { return { error: 'bad_request' }; }
}

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '');
  try {
    if (path === '/api/proposal' && req.method === 'POST') return await create(req, url);
    if (path === '/api/proposal/status' && req.method === 'GET') return await status(req, url, context);
    if (path === '/api/proposal/pdf' && req.method === 'GET') return await pdf(req, url);
    if (path === '/api/proposal/preview' && req.method === 'GET') return preview(url);
    if (path === '/api/proposal/detect' && req.method === 'GET') return detectApi(req, url);
    return json({ ok: false, error: 'not_found' }, 404);
  } catch (e) {
    console.error('[proposal-api]', path, e);
    return json({ ok: false, error: 'server', message: '잠시 후 다시 시도해 주세요. 급하시면 ' + CFG.company.tel + ' 로 연락 주세요.' }, 500);
  }
};

/* ── 신청 전 미리보기 — 산업 대표 사례·공통 과제 (개인정보 없음, 캐시 가능) ── */
function preview(url) {
  const list = k => String(url.searchParams.get(k) || '').split(',').filter(Boolean).slice(0, 6);
  const r = insight({ industry: url.searchParams.get('industry'), segment: url.searchParams.get('segment') || '', problems: list('problems'), goals: list('goals') });
  const pb = r.playbook;
  return new Response(JSON.stringify({
    ok: true, industry: r.industry, common: r.common, peers: r.peers.slice(0, 8), confidence: r.confidence,
    top: r.top.map(t => ({ key: t.key, name: t.name, pct: t.pct, why: t.why, tagline: t.tagline, results: t.results, global: t.global, image: t.image, url: t.url })),
    sensors: r.sensors.slice(0, 5).map(s => s.name), pool: r.poolSize,
    playbook: pb && {
      segment: pb.segment, context: pb.context, segmentContext: pb.segmentContext,
      chronic: pb.chronic.map(c => ({ title: c.title, detail: c.detail, focus: c.focus })),
      zones: pb.zones.map(z => ({ zone: z.zone, focus: z.focus })),
      personas: pb.personas.map(p => p.role), automation: pb.automation.map(a => a.title), segments: pb.segments || []
    }
  }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' } });
}

/* ── 회사 인식 미리보기 — 신청 화면에서 회사명을 치는 동안 「○○ 업종으로 구성합니다」 칩 ──
   고객 목록 여부는 내려보내지 않는다. 결과는 추정이며, 고객이 산업을 바꾸면 그쪽이 우선한다. */
function detectApi(req, url) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'origin' }, 403);
  const q = k => String(url.searchParams.get(k) || '').slice(0, 80);
  const company = q('company');
  if (company.replace(/\s/g, '').length < 2) return json({ ok: true, industry: '' });
  const r = resolveIntake({ entry: q('entry') || 'finder', company, email: q('email'), fac: q('fac'), con: q('con'), facility: q('facility'), industryText: q('industryText') });
  const d = r.company;
  return new Response(JSON.stringify({
    ok: true, industry: r.industry, segment: r.segment,
    industryLabel: (d.industry === r.industry && d.industryLabel) || '', segmentLabel: r.segment ? (r.segment === d.segment ? d.segmentLabel : '') : '',
    confidence: Math.round((d.confidence || 0) * 100) / 100, from: r.auto.industry,
    known: d.source === 'directory' && d.confidence >= 0.85
  }), { headers: { ...BASE_H, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=600' } });
}

/* ── 접수 ─────────────────────────────────────────────────────────── */
async function create(req, url) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'origin' }, 403);
  const rj = await readJson(req);
  if (rj.error) return json({ ok: false, error: rj.error }, rj.error === 'too_large' ? 413 : 400);
  const b = rj.body;

  const silent = () => json({ ok: true, token: null, silent: true });
  /* 봇: 숨은 칸을 채웠거나 3초 안에 제출 */
  if (String(b.website || '').trim()) return silent();
  if (Number(b.elapsed) > 0 && Number(b.elapsed) < 3000) return silent();

  const c = cleanInput(b);
  if (c.errors) return json({ ok: false, error: 'invalid', fields: c.errors }, 400);
  const lead = c.lead;
  const intake = c.intake;

  const ip = _guard.ipOf(req.headers);
  const blocked = await _guard.guard(req.headers, { email: lead.email, company: lead.company, name: lead.name, phone: lead.phone, title: '맞춤 제안서' }, 'proposal');
  if (blocked) return silent();

  /* 제한 */
  const day = kDay(Date.now()), hour = new Date().toISOString().slice(0, 13);
  try {
    const ipKey = 'rate/' + hour + '/' + hash('ip|' + ip).slice(0, 16);
    /* 로컬(127.0.0.1)은 개발·자동 테스트뿐이라 시간당 제한을 세지 않는다 (2026-09-18) */
    const isLocal = /^(127\.|::1$|::ffff:127\.|0\.0\.0\.0$)/.test(String(ip || ''));
    if (ip && !isLocal && await S.count(ipKey) >= CFG.perIpHour) return json({ ok: false, error: 'rate', message: '잠시 후 다시 신청해 주세요. 급하시면 ' + CFG.company.tel + ' 로 연락 주세요.' }, 429);
    if (await S.count('day/' + day) >= CFG.perDay) return json({ ok: false, error: 'rate_day', message: '오늘 신청이 많아 접수가 잠시 멈췄습니다. ' + CFG.company.tel + ' 로 연락 주시면 바로 안내드리겠습니다.' }, 429);
    if (ip) await S.bump(ipKey);
    await S.bump('day/' + day);
  } catch (e) { /* 제한 카운터 장애로 접수를 막지 않는다 */ }

  /* 중복 · 무료 제안서 1회 — 같은 회사·이메일은 CFG.onePerDays 일에 한 번.
     · 하루 안에 같은 과제로 다시 신청 → 기존 진행 화면 안내
     · 다른 과제·기간 안 재신청 → 새로 만들지 않고 「전체 현장 견적 요청」으로 안내 + 담당자에게 연락 필요 알림 */
  const dk = dedupeKey(lead);
  try {
    const d = await S.getJSON(dk);
    const age = d ? Date.now() - d.at : Infinity;
    if (d && age < CFG.onePerDays * 86400000) {
      const old = await S.getJob(d.id);
      if (old && old.status !== 'canceled' && old.token && !old.purged) {
        const nowKey = lead.problems[0], oldKey = old.match.input.problems[0];
        const asked = (PROBLEMS[nowKey] || {}).label || '';
        /* 진행 화면 주소는 응답에 싣지 않고 신청자 메일로만 다시 보낸다(10분에 한 번) */
        const resend = async () => {
          const last = (old.notices || []).filter(n => n.type === 'link').pop();
          if (last && Date.now() - Date.parse(last.at) < 10 * 60000) return;
          const r = await Mail.sendStatusLink(old).catch(e => ({ ok: false, error: String(e) }));
          await S.patchJob(old.id, j => { addNotice(j, 'link', r.ok, { via: r.via || '' }); });
        };
        if (nowKey === oldKey && age < 24 * 3600000) {
          await S.patchJob(old.id, j => { addLog(j, '24시간 내 재신청 → 진행 화면 링크 메일 재발송'); j.meta.resubmits = (j.meta.resubmits || 0) + 1; });
          await resend();
          return json({ ok: true, dup: true, mailed: true, same: true, days: CFG.onePerDays });
        }
        const ask = { at: new Date().toISOString(), problem: asked, entry: intake.entry, memo: lead.memo.slice(0, 200), also: (intake.also || []).map(k => (PROBLEMS[k] || {}).label).filter(Boolean) };
        const r = await Mail.notifyStaff('more', old, {
          '신호': '이미 제안서를 받은 고객이 다른 과제로 다시 신청했습니다 — 전체 현장 견적 상담 연결',
          '새로 요청한 과제': asked || '-', ...(ask.also.length ? { '함께 언급': ask.also.join(', ') } : {}),
          ...(lead.memo ? { '새 메모': lead.memo } : {}), ...(lead.phone && lead.phone !== old.lead.phone ? { '새 연락처': lead.phone } : {})
        }).catch(e => ({ ok: false, error: String(e) }));
        await S.patchJob(old.id, j => {
          j.meta.moreAsks = (j.meta.moreAsks || []).concat(ask).slice(-10);
          addLog(j, `추가 제안 요청(${asked || '-'}) → 견적 요청 안내`);
          addNotice(j, 'more', r.ok, { via: r.via || '' });
        });
        await resend();
        return json({ ok: true, dup: true, limit: true, mailed: true, same: nowKey === oldKey, asked, days: CFG.onePerDays });
      }
    }
  } catch (e) { /* 중복 확인 실패 → 새로 접수 */ }

  const meta = {
    source: String(b.source || '').slice(0, 300), landing: String(b.landing || '').slice(0, 300),
    referrer: String(b.referrer || '').slice(0, 300),
    doc: String(b.doc || '').replace(/[<>]/g, '').slice(0, 60),   /* 백서 입구 — 함께 받은 자료 */
    ip, ua: String(req.headers.get('user-agent') || '').slice(0, 180),
    dwell: Math.round(Number(b.elapsed || 0) / 1000), caseViews: Number(b.caseViews || 0) | 0,
    device: /Mobi|Android|iPhone/i.test(req.headers.get('user-agent') || '') ? 'mobile' : 'pc'
  };
  const job = createJob(lead, meta, Date.now(), intake);
  job.meta.grade = grade(lead, meta, job.intake, job.match);
  /* 테스트 접수 표시 (2026-09-18) — 담당자 알림·발송 대장·먼데이에 올리지 않는다.
     제안서 생성·PDF·고객 메일은 그대로 돌아가므로 자동 테스트는 계속 유효하다. */
  job.test = _test.isTest({ ip: meta.ip, landing: meta.landing, email: lead.email,
    company: lead.company, name: lead.name, memo: lead.memo, flag: typeof b.test === 'boolean' ? b.test : undefined, point: intake && intake.entry ? '/' + intake.entry : '' });
  if (job.test) job.lead.company = _test.tag(job.lead.company);

  /* 저장 — 실패하면 담당자 메일로라도 남긴다 */
  try {
    await S.saveJob(job);
    await S.setJSON(tokenKey(job.token), { id: job.id });
    await S.setJSON(S.queueKey(job.dueAt, job.id), 1);
    await S.setJSON(dk, { id: job.id, at: Date.now() });
    await S.setJSON('purge/' + String(Date.now() + CFG.retainDays * 86400000).padStart(13, '0') + '-' + job.id, 1);
  } catch (e) {
    console.error('[proposal-api] 저장 실패', e);
    const r = await Mail.notifyStaff('new', job, { '주의': '저장소 오류로 자동 제안서가 만들어지지 않습니다. 직접 연락해 주세요.' });
    return json({ ok: r.ok, token: null, degraded: true, due: fmtKST(job.dueAt), name: lead.name, company: lead.company });
  }

  /* 고객 접수 메일 · 담당자 알림 · 생성 시작 — 동시에, 서로 실패 무관 */
  /* 고객 접수 메일 · 담당자 알림 — 동시에, 서로 실패 무관. 기록을 먼저 남긴 뒤 생성을 깨운다(저장 충돌 방지) */
  /* 즉시 방식은 몇 분 안에 제안서 메일이 가므로 접수 메일을 따로 보내지 않는다(메일 2통 방지).
     엔지니어 확인 방식이면 접수 메일로 예정 시각과 진행 화면 주소를 알린다. */
  const instant = job.plan.mode === 'instant';
  const [rc, st] = await Promise.allSettled([instant ? Promise.resolve(null) : Mail.sendReceipt(job), Mail.notifyStaff('new', job)]);
  const v = x => (x.status === 'fulfilled' ? x.value : { ok: false, error: String(x.reason) });
  await S.patchJob(job.id, j => {
    if (v(rc)) addNotice(j, 'receipt', v(rc).ok, { via: v(rc).via || '', error: v(rc).error || v(rc).skipped || '' });
    addNotice(j, 'staff', v(st).ok, { via: v(st).via || '' });
    if (j.plan.mode === 'review') addNotice(j, 'preview', v(st).ok, { via: v(st).via || '' });
  });
  const kb = await kickBuild(url.origin, job.id);
  if (!kb.ok) await S.patchJob(job.id, j => { addLog(j, '생성 요청 실패 → 정기 점검에서 재시도 (' + (kb.error || kb.status) + ')'); });

  return json({ ok: true, token: job.token, due: fmtKST(job.dueAt), mode: job.plan.mode, grade: job.meta.grade.grade });
}

/* ── 진행 현황 ─────────────────────────────────────────────────────── */
async function status(req, url, context) {
  const t = String(url.searchParams.get('t') || '');
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(t)) return json({ ok: false, error: 'not_found' }, 404);
  const m = await S.getJSON(tokenKey(t));
  const job = m && await S.getJob(m.id);
  if (!job || job.token !== t || job.purged) return json({ ok: false, error: 'not_found' }, 404);

  const now = Date.now();
  /* 열람 기록 — 10분에 한 번. 발송 후 다시 들어오면 담당자에게 「관심 신호」 */
  if (!job.lastViewAt || now - Date.parse(job.lastViewAt) > 10 * 60000) {
    const hot = job.status === 'sent' && !job.notices.some(n => n.type === 'hot');
    const p = (async () => {
      const r = hot ? await Mail.notifyStaff('hot', job, { '신호': '제안서 발송 후 진행 화면을 다시 열었습니다' }) : null;
      await S.patchJob(job.id, j => {
        j.views = (j.views || 0) + 1; j.lastViewAt = new Date(now).toISOString();
        if (r) addNotice(j, 'hot', r.ok);
      });
    })().catch(() => {});
    if (context && typeof context.waitUntil === 'function') context.waitUntil(p); else await p;
  }
  /* 즉시 방식 안전장치 — 백그라운드 함수가 발송 전에 끊겼으면, 고객이 보고 있는 이 요청에서 이어서 보낸다 */
  if (job.plan && job.plan.mode === 'instant' && job.status === 'drafted' && now > job.dueAt + 20000) {
    const p2 = sendJob(job.id, { now }).catch(() => {});
    if (context && typeof context.waitUntil === 'function') context.waitUntil(p2); else await p2;
  } else if (job.plan && job.plan.mode === 'instant' && !(job.draft && job.draft.pdfKey) && !job.rekicked && now - Date.parse(job.createdAt) > 75000) {
    const p3 = (async () => { await S.patchJob(job.id, j => { j.rekicked = true; addLog(j, '생성 지연 → 다시 깨움'); }); await kickBuild(url.origin, job.id); })().catch(() => {});
    if (context && typeof context.waitUntil === 'function') context.waitUntil(p3); else await p3;
  }
  const lang = langOf(url.searchParams.get('lang'));
  return json({
    ok: true, now, lang, view: publicView(job, lang), progress: progress(job, now, lang), notices: noticeTimeline(job, now, lang),
    pdf: job.status === 'sent', tel: CFG.company.tel
  });
}

/* ── PDF ─────────────────────────────────────────────────────────── */
async function pdf(req, url) {
  const id = url.searchParams.get('id'), e = url.searchParams.get('e'), s = url.searchParams.get('s');
  const text = (msg, code) => new Response(msg, { status: code, headers: { ...BASE_H, 'content-type': 'text/plain; charset=utf-8' } });
  if (!verifyPdf(id, e, s)) return text('링크가 만료되었거나 올바르지 않습니다. ' + CFG.company.tel + ' 로 연락 주시면 다시 보내드립니다.', 410);
  if (await _guard.guard(req.headers, { title: 'proposal-pdf' }, 'proposal-pdf')) return text('링크가 만료되었습니다.', 410);
  const job = await S.getJob(id);
  if (!job || job.purged || !job.draft) return text('제안서를 찾을 수 없습니다.', 404);
  const bytes = await S.getBytes(job.draft.pdfKey);
  if (!bytes) return text('제안서를 찾을 수 없습니다.', 404);

  const first = !job.pdfOpens;
  try {
    const r = first ? await Mail.notifyStaff('opened', job, { '신호': '고객이 제안서를 처음 열었습니다 — 연락하기 좋은 때입니다' }) : null;
    await S.patchJob(id, j => {
      j.pdfOpens = (j.pdfOpens || 0) + 1; j.lastOpenAt = new Date().toISOString();
      if (!j.firstOpenAt) j.firstOpenAt = j.lastOpenAt;
      if (r) addNotice(j, 'opened', r.ok);
    });
  } catch (e) { /* 열람 기록 실패로 파일 전달을 막지 않는다 */ }
  const name = `모넷코리아_맞춤제안서_${job.lead.company.replace(/[\\/:*?"<>|\s]/g, '')}.pdf`;
  return new Response(bytes, { headers: {
    ...BASE_H, 'content-type': 'application/pdf',
    'content-disposition': `inline; filename="proposal-${job.no}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`
  } });
}
