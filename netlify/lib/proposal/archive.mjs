/** 맞춤 제안서 — 발송 대장(아카이브) · 고객 인사이트
 *
 *  「누구에게 · 무슨 자료가 · 언제 · 어떤 버전으로」 나갔는지를 발송할 때마다 한 줄씩 남긴다.
 *  작업(job)은 재생성·재발송으로 바뀌지만, 대장 기록과 PDF 사본은 발송 시점 그대로 보관한다.
 *
 *  키
 *    archive/<발송ms13>-<id>-<n>.json   발송 기록 (고객 메일 1통 = 1줄 — 제안서·재발송·후속 안내)
 *    arch-pdf/<id>-<n>.pdf              그때 보낸 PDF 사본
 *    insights/latest.json               Claude 가 정리한 영업 인사이트(가장 최근)
 *
 *  개인정보: 보관 기간(CFG.retainDays)이 지나면 받는 사람 정보와 PDF 사본을 지우고,
 *  회사·업종·과제·반응 같은 분석용 항목만 남긴다(anonymize).
 *  외부 연동: crm.mjs (먼데이) — 설정이 있을 때만. */
import crypto from 'node:crypto';
import * as S from './store.mjs';
import { CFG } from './config.mjs';
import { PROBLEMS, GOALS } from './kb.mjs';
import { fmtKST } from './schedule.mjs';

const pad = ms => String(Math.max(0, Math.floor(ms))).padStart(13, '0');
export const archPdfKey = (id, n) => `arch-pdf/${id}-${n}.pdf`;
const label = k => (PROBLEMS[k] || {}).label || k;
const normCo = s => String(s || '').replace(/\(주\)|주식회사|㈜|\s|\(유\)|유한회사/g, '').toLowerCase();

export function channelOf(src) {
  const s = String(src || '').toLowerCase();
  if (/fbclid|facebook|instagram|utm_source=(meta|fb|ig)\b/.test(s)) return '메타';
  if (/gclid|gbraid|wbraid|utm_source=(google|youtube)\b/.test(s)) return '구글';
  if (/naver/.test(s)) return '네이버';
  if (/kakao/.test(s)) return '카카오';
  if (/utm_source=share/.test(s)) return '공유';
  if (/utm_source=email/.test(s)) return '이메일';
  if (!s || s === 'direct') return '직접';
  return '기타';
}

/** 발송 한 건 기록 — kind: proposal · resend · followup */
export async function recordSend(job, { kind = 'proposal', bytes = null, via = '', attached = false, messageId = '', by = 'auto' } = {}) {
  try {
    const n = (job.sendSeq || 0) + 1;
    const at = Date.now();
    const m = job.match, L = job.lead, g = (job.meta && job.meta.grade) || {};
    let pdf = '', sha = '', pages = 0;
    if (bytes && bytes.length) {
      pdf = archPdfKey(job.id, n);
      await S.setBytes(pdf, bytes);
      sha = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex').slice(0, 16);
      try { const { PDFDocument } = await import('pdf-lib'); pages = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount(); } catch (e) { pages = 0; }
    }
    const cur = job.versions && job.versions.find(v => v.pdfKey === (job.draft && job.draft.pdfKey) && v.adopted);
    const rec = {
      v: 1, key: `archive/${pad(at)}-${job.id}-${n}.json`, id: job.id, no: job.no, n, kind, by,
      at: new Date(at).toISOString(),
      to: { email: L.email, name: L.name, title: L.title || '', phone: L.phone || '' },
      company: L.company, companyKey: normCo(L.company), domain: String(L.email || '').split('@')[1] || '',
      industry: { key: m.industry.key, label: m.industry.label },
      segment: m.playbook && m.playbook.segment ? m.playbook.segment.label : '',
      problemKeys: m.input.problems, problems: m.input.problems.map(label),
      alsoKeys: (job.intake && job.intake.also) || [], also: ((job.intake && job.intake.also) || []).map(label),
      goals: m.input.goals.map(k => (GOALS[k] || {}).label || k),
      scale: L.scale || '', timeline: L.timeline || '', region: L.region || '', facility: L.facility || '',
      entry: (job.intake && job.intake.entry) || 'proposal', source: (job.meta && job.meta.source) || '', channel: channelOf(job.meta && job.meta.source),
      grade: g.grade || '', score: g.score || 0, mode: (job.plan && job.plan.mode) || 'delayed',
      doc: kind === 'followup' ? '후속 안내 메일(제안서 링크)' : `맞춤 제안서 PDF${pages ? ` ${pages}쪽` : ''}`,
      ai: !!(job.draft && job.draft.ai), model: (job.draft && job.draft.model) || '',
      version: cur ? cur.n : 0, instruction: cur ? cur.instruction || '' : '',
      review: job.draft && job.draft.review ? { verdict: job.draft.review.verdict, score: job.draft.review.score } : null,
      pages, bytes: bytes ? bytes.length : 0, sha, pdf, attached, via, messageId,
      top: m.top.slice(0, 3).map(t => ({ name: t.name, pct: t.pct })),
      ownCase: m.ownCase ? m.ownCase.name : '',
      companyConfidence: (job.intake && job.intake.company && job.intake.company.confidence) || 0
    };
    await S.setJSON(rec.key, rec);
    await S.patchJob(job.id, j => { j.sendSeq = n; j.archive = (j.archive || []).concat(rec.key).slice(-30); });
    /* 먼데이 등 외부 대장 — 실패해도 발송·기록에는 영향 없음 */
    try {
      const C = await import('./crm.mjs');
      const r = await C.pushSend(await S.getJob(job.id) || job, rec);
      if (r && r.itemId) await S.patchJob(job.id, j => { j.crm = { ...(j.crm || {}), monday: r.itemId }; });
    } catch (e) { /* 무시 */ }
    return rec;
  } catch (e) {
    console.error('[proposal-archive]', e);
    return null;
  }
}

export async function listArchive(limit = 3000) {
  const keys = (await S.list('archive/', 20000)).slice(-limit);
  const recs = (await Promise.all(keys.map(k => S.getJSON(k).catch(() => null)))).filter(Boolean);
  return recs.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** 보관 기간 만료 — 받는 사람 정보와 PDF 사본 삭제, 분석 항목은 남긴다 */
export async function anonymize(id) {
  let n = 0;
  for (const key of await S.list('archive/', 20000)) {
    if (!key.includes('-' + id + '-')) continue;
    const r = await S.getJSON(key); if (!r) continue;
    if (r.pdf) await S.del(r.pdf).catch(() => {});
    r.to = { email: '', name: '(파기)', title: '', phone: '' };
    r.pdf = ''; r.domain = ''; r.facility = ''; r.purged = true;
    await S.setJSON(key, r); n++;
  }
  return n;
}

/* ── 인사이트 — 작업(반응)과 대장(발송)을 합쳐 영업에 쓸 숫자를 만든다 ── */
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const median = arr => { const s = arr.filter(x => x >= 0).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function insights(jobs, archive, { from = 0, to = Infinity } = {}) {
  const list = jobs.filter(j => { const t = Date.parse(j.createdAt); return t >= from && t <= to && j.status !== 'canceled'; });
  const sent = list.filter(j => j.status === 'sent');
  const opened = sent.filter(j => j.pdfOpens > 0);
  const contacted = list.filter(j => (j.notices || []).some(n => n.type === 'callback' && n.ok));
  const asked = list.filter(j => ((j.meta || {}).moreAsks || []).length);
  const group = (arr, keyf) => {
    const m = {};
    for (const j of arr) for (const k of [].concat(keyf(j) || '기타')) {
      const g = m[k] = m[k] || { key: k, n: 0, sent: 0, opened: 0, asked: 0, contacted: 0, score: 0, a: 0 };
      g.n++; g.score += ((j.meta || {}).grade || {}).score || 0;
      if (((j.meta || {}).grade || {}).grade === 'A') g.a++;
      if (j.status === 'sent') g.sent++;
      if (j.pdfOpens > 0) g.opened++;
      if (((j.meta || {}).moreAsks || []).length) g.asked++;
      if ((j.notices || []).some(n => n.type === 'callback' && n.ok)) g.contacted++;
    }
    return Object.values(m).map(g => ({ ...g, openRate: pct(g.opened, g.sent), avgScore: g.n ? Math.round(g.score / g.n) : 0 }))
      .sort((a, b) => b.n - a.n);
  };
  const openHours = sent.map(j => j.firstOpenAt ? (Date.parse(j.firstOpenAt) - Date.parse(j.sentAt)) / 3600000 : -1);
  const hourOf = j => new Date(Date.parse(j.createdAt) + 9 * 3600000).getUTCHours();
  const dowOf = j => '일월화수목금토'[new Date(Date.parse(j.createdAt) + 9 * 3600000).getUTCDay()];

  /* 함께 관심 — 제안서 과제 → 추가로 말한 과제 */
  const pairs = {};
  for (const j of list) {
    const p = label(j.match.input.problems[0]);
    const extra = ((j.intake || {}).also || []).concat(((j.meta || {}).moreAsks || []).map(a => a.problem).filter(Boolean));
    for (const x of extra) { const k = p + ' → ' + (PROBLEMS[x] ? label(x) : x); pairs[k] = (pairs[k] || 0) + 1; }
  }

  /* 회사별 프로필 */
  const cos = {};
  for (const j of list) {
    const k = normCo(j.lead.company) || j.id;
    const c = cos[k] = cos[k] || { company: j.lead.company, jobs: 0, sent: 0, opens: 0, views: 0, asks: 0, contacted: 0, best: '', score: 0, industries: new Set(), problems: new Set(), last: '', ids: [] };
    c.jobs++; c.ids.push(j.id);
    if (j.status === 'sent') c.sent++;
    c.opens += j.pdfOpens || 0; c.views += j.views || 0;
    c.asks += ((j.meta || {}).moreAsks || []).length;
    if ((j.notices || []).some(n => n.type === 'callback' && n.ok)) c.contacted++;
    const g = (j.meta || {}).grade || {};
    if ((g.score || 0) > c.score) { c.score = g.score; c.best = g.grade; }
    c.industries.add(j.match.industry.label);
    j.match.input.problems.forEach(p => c.problems.add(label(p)));
    ((j.intake || {}).also || []).forEach(p => c.problems.add(label(p) + '*'));
    if (j.createdAt > c.last) c.last = j.createdAt;
  }
  const docsBy = {};
  for (const r of archive) docsBy[r.companyKey] = (docsBy[r.companyKey] || 0) + 1;
  const companies = Object.entries(cos).map(([k, c]) => {
    /* 영업 우선순위 — 반응(열람·재방문·추가 요청)과 등급을 합친 단순 점수. 설명할 수 있게 항목을 남긴다 */
    const heat = Math.min(100, c.score * 0.5 + Math.min(c.opens, 3) * 10 + Math.min(c.views, 3) * 4 + c.asks * 20 - (c.contacted ? 15 : 0));
    const why = [];
    if (c.asks) why.push(`추가 요청 ${c.asks}회`);
    if (c.opens) why.push(`PDF 열람 ${c.opens}회`);
    if (c.views > 1) why.push(`진행 화면 ${c.views}회`);
    if (c.best) why.push(`${c.best}등급`);
    if (!c.contacted && c.sent) why.push('아직 연락 전');
    return { ...c, key: k, docs: docsBy[k] || 0, industries: [...c.industries], problems: [...c.problems], heat: Math.round(heat), why, lastAt: fmtKST(Date.parse(c.last), false) };
  }).sort((a, b) => b.heat - a.heat);

  return {
    range: { from: from ? new Date(from).toISOString() : '', to: to < Infinity ? new Date(to).toISOString() : '' },
    funnel: { applied: list.length, sent: sent.length, opened: opened.length, contacted: contacted.length, asked: asked.length,
      openRate: pct(opened.length, sent.length), contactRate: pct(contacted.length, sent.length), askRate: pct(asked.length, sent.length),
      medianOpenHours: median(openHours) == null ? null : Math.round(median(openHours) * 10) / 10 },
    docs: { total: archive.length, proposal: archive.filter(r => r.kind === 'proposal').length, resend: archive.filter(r => r.kind === 'resend').length, followup: archive.filter(r => r.kind === 'followup').length, ai: archive.filter(r => r.ai).length },
    byIndustry: group(list, j => j.match.industry.label),
    bySegment: group(list.filter(j => j.match.playbook && j.match.playbook.segment), j => j.match.playbook.segment.label).slice(0, 12),
    byProblem: group(list, j => label(j.match.input.problems[0])).slice(0, 15),
    byEntry: group(list, j => ({ finder: '홈 파인더', contact: '상담 폼', widget: '빠른 상담', proposal: '제안서 신청', whitepaper: '백서 다운로드' })[(j.intake || {}).entry] || '제안서 신청'),
    byChannel: group(list, j => channelOf((j.meta || {}).source)),
    byGrade: group(list, j => ((j.meta || {}).grade || {}).grade || '-'),
    byScale: group(list, j => j.lead.scale || '미입력'),
    byTimeline: group(list, j => j.lead.timeline || '미입력'),
    byHour: Array.from({ length: 24 }, (_, h) => list.filter(j => hourOf(j) === h).length),
    byDow: '일월화수목금토'.split('').map(d => ({ key: d, n: list.filter(j => dowOf(j) === d).length })),
    pairs: Object.entries(pairs).map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n).slice(0, 12),
    companies: companies.slice(0, 200)
  };
}

/** Claude 에게 넘길 요약 — 사람 이름·연락처는 빼고, 회사명·업종·과제·반응만 */
export function insightBrief(ins) {
  const t = g => g.slice(0, 10).map(x => ({ 항목: x.key, 접수: x.n, 발송: x.sent, 열람률: x.openRate + '%', 추가요청: x.asked, 평균점수: x.avgScore }));
  return {
    퍼널: ins.funnel, 산업별: t(ins.byIndustry), 세부업종별: t(ins.bySegment), 과제별: t(ins.byProblem),
    입구별: t(ins.byEntry), 채널별: t(ins.byChannel), 규모별: t(ins.byScale), 도입시점별: t(ins.byTimeline),
    함께관심: ins.pairs, 시간대별접수: ins.byHour, 요일별접수: ins.byDow,
    우선순위회사: ins.companies.slice(0, 15).map(c => ({ 회사: c.company, 업종: c.industries, 과제: c.problems, 점수: c.heat, 근거: c.why }))
  };
}

export async function aiInsight(ins) {
  if (!CFG.aiKey) return { ok: false, error: 'ANTHROPIC_API_KEY 가 없습니다' };
  const brief = insightBrief(ins);
  if (!ins.funnel.applied) return { ok: false, error: '분석할 접수가 없습니다' };
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), CFG.aiTimeoutMs);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ac.signal,
      headers: { 'x-api-key': CFG.aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: CFG.aiModel, max_tokens: 1800, temperature: 0.2,
        system: '당신은 산업용 무선 IoT 센서(모넷코리아) B2B 영업 분석가입니다. 주어진 집계 밖의 사실을 만들지 않고, 표본이 작으면 작다고 말합니다.',
        messages: [{ role: 'user', content: `아래 <data>는 홈페이지 맞춤 제안서 신청·발송·반응 집계입니다. 영업팀이 이번 주에 바로 쓸 수 있게 정리해 주세요.
규칙: 숫자는 <data>에 있는 것만 쓰고, 표본이 10건 미만인 항목은 「표본 적음」이라고 붙이세요. 과장 없이 담백하게. JSON 한 개만 출력.
{"headline":"한 문장","findings":["관찰 3~5개, 각 90자 이내"],"actions":["이번 주 할 일 3~5개, 각 90자 이내 — 우선순위회사 이름을 써도 됨"],"content":["광고·콘텐츠 제안 2~3개"],"watch":["주의할 점 1~3개"]}
<data>${JSON.stringify(brief)}</data>` }]
      })
    });
    if (!r.ok) return { ok: false, error: 'anthropic ' + r.status };
    const j = await r.json();
    const raw = (j.content || []).map(c => c.text || '').join('');
    const out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const clean = a => (Array.isArray(a) ? a : []).map(x => String(x).slice(0, 160)).slice(0, 6);
    const res = { ok: true, at: new Date().toISOString(), model: j.model || CFG.aiModel, basis: ins.funnel,
      headline: String(out.headline || '').slice(0, 160), findings: clean(out.findings), actions: clean(out.actions), content: clean(out.content), watch: clean(out.watch) };
    await S.setJSON('insights/latest.json', res);
    return res;
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? '시간 초과' : e.message }; }
  finally { clearTimeout(tm); }
}
