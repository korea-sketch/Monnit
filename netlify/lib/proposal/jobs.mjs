/** 맞춤 제안서 — 접수 정리 · 작업 생성 · 토큰 */
import crypto from 'node:crypto';
import _valid from '../../../valid.js';
import { CFG } from './config.mjs';
import { INDUSTRIES, PROBLEMS, GOALS, SCALES, TIMELINES } from './kb.mjs';
import { computeDue } from './schedule.mjs';
import { insight, scopeOf } from './match.mjs';
import * as I18N from './i18n.mjs';
import CASES from './cases.data.mjs';
import { resolveIntake } from './intake.mjs';

const VALID = _valid.MonnitValid;

/* 제어문자·꺾쇠 제거 후 길이 제한 */
/* 제어문자·꺾쇠 + 글자 방향을 뒤집는 유니코드(메일·화면에서 이름을 거꾸로 보이게 하는 속임수) */
const CTRL = new RegExp('[\\x00-\\x1f\\x7f<>\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');
/* 문자·숫자만 받는다 — 객체·배열이 오면 "[object Object]" 같은 값이 회사명으로 저장되던 것을 막는다 */
const clip = (v, n) => String(typeof v === 'string' || typeof v === 'number' ? v : '').replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const oneOf = (v, list) => list.includes(v) ? v : '';

/** 브라우저 입력 → 검증된 입력. 문제가 있으면 { errors }
 *  auto 입구(홈 파인더·상담 신청)는 산업·과제를 고르지 않아도 된다 — intake.mjs 가 채운다. */
export function cleanInput(b) {
  b = b || {};
  const errors = {};
  const safe = {
    ...b,
    company: clip(b.company, 60), email: clip(b.email, 120).toLowerCase(),
    facility: clip(b.facility, 60), memo: clip(b.memo, 600), industryText: clip(b.industryText, 40),
    fac: clip(b.fac, 20), con: clip(b.con, 20), scale: clip(b.scale, 40), segment: clip(b.segment, 30),
    concerns: (Array.isArray(b.concerns) ? b.concerns : []).map(x => clip(x, 20)).slice(0, 6)
  };
  const intake = resolveIntake(safe);
  const auto = b.auto === true || intake.entry !== 'proposal';
  const lead = {
    company: clip(b.company, 60),
    name: clip(b.name, 30),
    title: clip(b.title, 30),
    email: clip(b.email, 120).toLowerCase(),
    phone: clip(b.phone, 20),
    industry: auto ? intake.industry : (INDUSTRIES.some(i => i.key === b.industry) ? b.industry : ''),
    segment: intake.segment,
    facility: clip(b.facility, 60),                 /* 시설 이름·유형 (예: 평택 2공장, 물류센터 A동) */
    region: clip(b.region, 30),
    scale: oneOf(clip(b.scale, 40), SCALES) || intake.scale,
    timeline: oneOf(clip(b.timeline, 20), TIMELINES),
    /* 직접 고른 과제가 있으면 intake 가 문의 글에서 찾은 과제를 뒤에 붙여 준다 */
    problems: auto || intake.auto.problems === 'explicit' ? intake.problems : [],
    goals: auto ? intake.goals : [...new Set((Array.isArray(b.goals) ? b.goals : []).filter(k => GOALS[k]))].slice(0, 4),
    memo: clip(b.memo, 600),
    industryText: safe.industryText,
    inquiry: clip(b.inquiry, 40),
    consent: b.consent === true,
    consentMkt: b.consentMkt === true
  };
  if (lead.company.length < 2) errors.company = '회사명을 입력해 주세요';
  if (lead.name.length < 2) errors.name = '성함을 입력해 주세요';
  const em = VALID.email(lead.email);
  if (!em.ok) errors.email = em.message || '이메일 주소를 확인해 주세요';
  else lead.email = em.value;
  if (lead.phone) {
    const ph = VALID.phone(lead.phone, { required: false });
    if (!ph.ok) errors.phone = ph.message || '연락처를 확인해 주세요';
    else lead.phone = ph.value || lead.phone;
  }
  if (!lead.industry) errors.industry = '산업을 선택해 주세요';
  if (!lead.problems.length) errors.problems = '가장 고민되는 문제를 하나 골라 주세요';
  if (!lead.consent) errors.consent = '개인정보 수집·이용에 동의해 주세요';
  if (!lead.goals.length) lead.goals = intake.goals;
  return Object.keys(errors).length ? { errors } : { lead, intake: { entry: intake.entry, auto: auto ? intake.auto : { ...intake.auto, industry: 'explicit' }, company: intake.company, also: intake.also || [] } };
}

export { grade, FREE_MAIL } from './grade.mjs';

export const newId = () => crypto.randomBytes(8).toString('hex');            /* 16자 */
export const newToken = () => crypto.randomBytes(18).toString('base64url');  /* 24자, 추측 불가 */
export const hash = s => crypto.createHmac('sha256', CFG.secret).update(String(s)).digest('hex').slice(0, 32);
export const dedupeKey = lead => 'dedupe/' + hash(lead.email + '|' + lead.company.replace(/\s|\(주\)|주식회사|㈜/g, '').toLowerCase());
export const tokenKey = token => 'token/' + hash('t|' + token);
export const proposalNo = (id, ms) => 'MK-P' + new Date(ms + 9 * 3600000).toISOString().slice(2, 10).replace(/-/g, '') + '-' + id.slice(0, 4).toUpperCase();

/* PDF 링크 서명 — getdoc 과 같은 방식 (id|exp) */
export function signPdf(id, exp) { return crypto.createHmac('sha256', CFG.secret).update('pdf|' + id + '|' + exp).digest('hex').slice(0, 32); }
export function pdfUrl(job, days = CFG.linkDays) {
  const exp = Date.now() + days * 86400000;
  return `${CFG.site}/api/proposal/pdf?id=${job.id}&e=${exp}&s=${signPdf(job.id, exp)}`;
}
export function verifyPdf(id, exp, sig) {
  if (!/^[a-f0-9]{16}$/.test(String(id)) || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(signPdf(id, Number(exp))), b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const statusUrl = job => `${CFG.site}/proposal/status?t=${job.token}`;

export { decidePlan, dueFor } from './plan.mjs';
import { decidePlan, dueFor } from './plan.mjs';

export function createJob(lead, meta, now = Date.now(), intake = null) {
  const id = newId();
  const ins = insight(lead, undefined, { company: intake && intake.company });
  const plan = decidePlan(lead, intake, ins);
  return {
    v: 1, id, token: newToken(), no: proposalNo(id, now),
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    dueAt: dueFor(plan, now), plan,
    status: 'received',        /* received → drafting → drafted → sending → sent  (hold · failed · canceled) */
    approved: plan.mode === 'instant' || CFG.review === 'auto',
    attempts: 0, buildAttempts: 0, lastError: '',
    lead, meta, match: ins, intake: intake || { entry: 'proposal', auto: {}, company: null },
    draft: null, notices: [], log: [{ at: new Date(now).toISOString(), msg: '접수' }],
    views: 0, pdfOpens: 0
  };
}

export function addLog(job, msg) {
  job.log = (job.log || []).concat({ at: new Date().toISOString(), msg: String(msg).slice(0, 300) }).slice(-60);
}
export function addNotice(job, type, ok, extra = {}) {
  job.notices = (job.notices || []).concat({ type, ok: !!ok, at: new Date().toISOString(), ...extra }).slice(-40);
}

/** 화면에 내려보낼 공개 정보 — 연락처 등 민감 정보는 빼고 가린다.
 *  lang=en 이면 영문 사전으로 바꾸고, 사전에 없는 한국어 항목은 뺀다. */
export function publicView(job, lang = 'ko') {
  const m = job.match, pb = m.playbook, en = lang === 'en';
  const E = I18N;
  const indEn = en ? E.industryEn(m.industry.key) : null;
  const probs = m.input.problems, goals = m.input.goals;
  const caseMap = {};
  if (en) for (const c of CASES) caseMap[c.key] = c;
  const tTop = t => {
    if (!en) return { key: t.key, name: t.name, pct: t.pct, why: t.why, tagline: t.tagline, results: t.results, global: t.global, image: t.image, url: t.url, industryText: t.industryText };
    const ce = E.caseEn(t.key) || {}, src = caseMap[t.key];
    return { key: t.key, name: E.noHangul(ce.name) || (t.global ? E.noHangul(t.name) : '') || 'Monnit reference', pct: t.pct,
      why: t.why.map(E.whyEn).filter(Boolean), tagline: E.noHangul(ce.tagline),
      results: t.results.map(r => ({ n: E.numEn(r.n), l: E.resultLabel(t.key, r.l, src && src.results) })).filter(r => r.l && r.n),
      global: t.global, image: t.image, url: t.url, industryText: E.noHangul(ce.industryText) };
  };
  const view = {
    no: job.no, company: job.lead.company, name: job.lead.name, title: job.lead.title, lang,
    industry: en ? { key: m.industry.key, label: indEn ? indEn.label : m.industry.key, short: indEn ? indEn.short : '', hero: indEn ? indEn.hero : '', icon: m.industry.icon }
      : m.industry,
    facility: job.lead.facility,
    problemKeys: probs, goalKeys: goals,
    problems: en ? E.labels(probs, E.probLabel) : probs.map(k => PROBLEMS[k].label),
    goals: en ? E.labels(goals, E.goalLabel) : goals.map(k => GOALS[k].label),
    top: m.top.map(tTop),
    common: en ? m.common.map(c => ({ key: c.key, label: E.probLabel(c.key), desc: E.probDesc(c.key), picked: c.picked })).filter(c => c.label) : m.common,
    peers: en ? [] : m.peers.slice(0, 8),
    sensors: m.sensors.slice(0, 5).map(s => en
      ? { name: E.sensorName(s.key) || s.name, for: s.for.map(l => E.probLabel(E.probByLabel(l))).filter(Boolean) }
      : { name: s.name, for: s.for }),
    evidence: en ? m.evidence.map(e => ({ n: E.numEn(e.n), l: E.resultLabel(topKeyOf(m, e.from), e.l, (caseMap[topKeyOf(m, e.from)] || {}).results), from: E.noHangul((E.caseEn(topKeyOf(m, e.from)) || {}).name), global: e.global, goal: e.goal })).filter(e => e.l && e.n)
      : m.evidence,
    confidence: m.confidence,
    pool: m.poolSize, status: job.status, mode: (job.plan && job.plan.mode) || 'delayed',
    entry: (job.intake || {}).entry || 'proposal',
    scope: scopeView(job, lang),
    segment: pb && pb.segment ? (en ? E.pb(pb.segment.label) : pb.segment.label) : '',
    recognized: recognizedLine(job, lang),
    ownCase: m.ownCase ? { name: en ? E.noHangul((E.caseEn(m.ownCase.key) || {}).name) : m.ownCase.name, url: m.ownCase.url } : null,
    brand: { countries: CFG.brand.countries, customers: CFG.brand.customers, publicRef: en ? 'public agencies and major enterprises' : CFG.brand.publicRef },
    playbook: pb ? (en ? {
      context: E.pb(pb.context),
      chronic: pb.chronic.map(c => ({ title: E.pb(c.title), detail: E.pb(c.detail), focus: c.focus })).filter(c => c.title),
      zones: pb.zones.map(z => ({ zone: E.pb(z.zone), ko: z.zone, focus: z.focus })).filter(z => z.zone),
      personas: pb.personas.map(p => E.pb(p.role)).filter(Boolean),
      automation: pb.automation.map(a => E.pb(a.title) || a.title)
    } : {
      context: pb.context,
      chronic: pb.chronic.map(c => ({ title: c.title, detail: c.detail, focus: c.focus })),
      zones: pb.zones.map(z => ({ zone: z.zone, ko: z.zone, focus: z.focus })),
      personas: pb.personas.map(p => p.role),
      automation: pb.automation.map(a => a.title)
    }) : null
  };
  return view;
}
const topKeyOf = (m, name) => (m.top.find(t => t.name === name) || {}).key || '';

/* 고객 화면용 한 줄 — 확신도가 높을 때만 회사 이름을 들어 말한다 */
export function recognizedLine(job, lang = 'ko') {
  const c = job.intake && job.intake.company;
  const pb = job.match.playbook;
  if (!pb) return '';
  const en = lang === 'en';
  const seg = pb.segment ? pb.segment.label : job.match.industry.label;
  const segEn = en ? (pb.segment ? I18N.pb(pb.segment.label) : (I18N.industryEn(job.match.industry.key) || {}).label) : '';
  if (c && c.confidence >= 0.8 && c.industry === job.match.industry.key) return en ? (segEn ? `We identified ${job.lead.company} as “${segEn}” and built your proposal on that basis` : '') : `${job.lead.company}의 업종을 「${seg}」로 보고 제안서를 구성합니다`;
  if (pb.segment) return en ? (segEn ? `Your proposal is built for a “${segEn}” site` : '') : `「${seg}」 현장을 기준으로 제안서를 구성합니다`;
  return '';
}

/* 무료 제안서 범위 — 다룬 과제 · 다루지 않은 것 · 전체 견적 요청 주소 */
export function quoteUrl(job, src = 'proposal') {
  return `${CFG.site}/contact?quote=${encodeURIComponent(job.no)}&utm_source=${src}&utm_medium=${src === 'proposal_mail' ? 'email' : 'web'}&utm_campaign=custom_proposal_quote`;
}
export function scopeView(job, lang = 'ko') {
  const sc = scopeOf(job.match);
  const quote = '/contact?quote=' + encodeURIComponent(job.no);
  const also = ((job.intake && job.intake.also) || []).filter(k => PROBLEMS[k]);
  if (lang !== 'en') return { ...sc, also: also.map(k => PROBLEMS[k].label), quote };
  const E = I18N, pk = job.match.input.problems;
  const ind = (INDUSTRIES.find(i => i.key === job.match.industry.key) || { problems: [] }).problems;
  return {
    problems: E.labels(pk, E.probLabel),
    others: E.labels(ind.filter(k => !pk.includes(k)), E.probLabel),
    openZones: E.labels(sc.openZones, E.pb), lockedZones: E.labels(sc.lockedZones, E.pb), lockedZonesKo: sc.lockedZones,
    zonesFocused: sc.zonesFocused,
    openLevels: sc.openLevels.map(x => E.pb(x) || x), lockedLevels: sc.lockedLevels.map(x => E.pb(x) || x),
    niceCount: sc.niceCount, also: E.labels(also, E.probLabel), quote
  };
}

