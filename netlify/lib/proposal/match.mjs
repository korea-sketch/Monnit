/** 모넷 인사이트 알고리즘 — 입력 → 유사 사례 순위 · 권장 구성 · 참고 수치
 *
 *  점수 (0~1)
 *    산업 일치 0.40  (같은 산업 1.0 · 인접 산업 0.5)
 *    과제 일치 0.30  (선택한 과제의 키워드가 사례 과제·해결책에 나오는 비율)
 *    효과 일치 0.20  (선택한 효과의 키워드가 사례 성과·요약에 나오는 비율)
 *    센서 일치 0.10  (권장 센서 종류가 사례 해결책에 나오는 비율)
 *  화면의 「일치도」는 이 점수를 그대로 %로 보여준다(최대 98). 부풀리지 않는다.
 *  결과는 결정적이다 — 같은 입력이면 언제나 같은 순위. */
import { PROBLEMS, GOALS, SENSORS, PLATFORM, INDUSTRIES, industryByKey } from './kb.mjs';
import CASES from './cases.data.mjs';
import PLAYBOOKS from './playbooks.data.mjs';
import { CFG } from './config.mjs';

const W = { ind: 0.40, prob: 0.30, goal: 0.20, sens: 0.10 };
const low = s => String(s || '').toLowerCase();
const has = (text, kws) => kws.some(k => text.includes(low(k)));

function caseText(c) {
  return {
    problem: low([c.tagline, c.about, ...c.challenges, ...c.solutions.map(s => s.t + ' ' + s.d)].join(' ')),
    effect: low([c.tagline, ...c.results.map(r => r.n + ' ' + r.l), ...c.qs.map(r => r.n + ' ' + r.l), c.quote].join(' ')),
    solution: low(c.solutions.map(s => s.t + ' ' + s.d).join(' '))
  };
}

export function recommendSensors(problemKeys) {
  const count = {};
  for (const p of problemKeys) for (const s of (PROBLEMS[p] || {}).sensors || []) count[s] = (count[s] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({
    key: k, name: SENSORS[k].name, use: SENSORS[k].use, n,
    for: problemKeys.filter(p => (PROBLEMS[p].sensors || []).includes(k)).map(p => PROBLEMS[p].label)
  }));
}

export function scoreCase(c, input, sensors) {
  const ind = industryByKey(input.industry);
  const why = [];
  let s1 = 0;
  if (c.industries.includes(input.industry)) { s1 = 1; why.push('같은 산업'); }
  else if (ind && c.industries.some(k => (ind.adj || []).includes(k))) { s1 = 0.5; why.push('인접 산업'); }

  const tx = caseText(c);
  const probHit = input.problems.filter(p => PROBLEMS[p] && has(tx.problem, PROBLEMS[p].kw));
  const s2 = input.problems.length ? probHit.length / input.problems.length : 0;
  if (probHit.length) why.push('공통 과제: ' + probHit.slice(0, 3).map(p => PROBLEMS[p].label).join(', '));

  const goalHit = input.goals.filter(g => GOALS[g] && has(tx.effect, GOALS[g].kw));
  const s3 = input.goals.length ? goalHit.length / input.goals.length : 0;
  if (goalHit.length) why.push('같은 목표: ' + goalHit.slice(0, 2).map(g => GOALS[g].label).join(', '));

  const sensHit = sensors.filter(s => has(tx.solution, SENSORS[s.key].kw));
  const s4 = sensors.length ? sensHit.length / sensors.length : 0;

  const score = W.ind * s1 + W.prob * s2 + W.goal * s3 + W.sens * s4;
  /* 이 사례에서 고객 목표와 관련된 성과 수치만 추린다 */
  const results = c.results.filter(r => input.goals.some(g => GOALS[g] && has(low(r.n + ' ' + r.l), GOALS[g].kw)));
  return { key: c.key, score, pct: Math.min(98, Math.round(score * 100)), why, probHit, goalHit,
           goalResults: results.slice(0, 3), results: results.concat(c.results.filter(r => !results.includes(r))).slice(0, 4) };
}

/* ── 산업 플레이북 조립 ───────────────────────────────────────────
   기본(산업) + 세부 업종(segment)을 합치고, 고객이 고른 과제와 겹치는 항목을 앞으로 올린다. */
const bigrams = t => { t = String(t).replace(/[^가-힣a-z0-9]/gi, '').toLowerCase(); const b = new Set(); for (let i = 0; i < t.length - 1; i++) b.add(t.slice(i, i + 2)); return b; };
const similar = (x, y) => { const A = bigrams(x), B = bigrams(y); if (!A.size || !B.size) return x === y; let n = 0; for (const g of A) if (B.has(g)) n++; return n / (A.size + B.size - n) >= 0.5; };
const overlap = (arr, picked) => (arr || []).filter(x => picked.includes(x)).length;
function rank(list, picked, bonus = () => 0) {
  return list.map((x, i) => ({ x, i, s: overlap(x.problems, picked) + bonus(x) }))
    .sort((a, b) => b.s - a.s || a.i - b.i).map(({ x, s }) => ({ ...x, focus: overlap(x.problems, picked) > 0 }));
}

export function segmentOf(industryKey, text) {
  const pb = PLAYBOOKS[industryKey]; if (!pb) return null;
  const t = low(text).replace(/\s+/g, '');
  if (!t) return null;
  let best = null;
  for (const [k, sg] of Object.entries(pb.segments || {})) {
    const hit = (sg.match || []).filter(m => m && t.includes(low(m).replace(/\s+/g, '')));
    const sc = hit.reduce((n, m) => n + m.length, 0);
    if (hit.length && (!best || sc > best.sc)) best = { key: k, label: sg.label, sc, hit };
  }
  return best && { key: best.key, label: best.label, hit: best.hit };
}

export function playbook(industryKey, segmentKey, picked = []) {
  const ind = industryByKey(industryKey) || industryByKey('general') || INDUSTRIES[0];
  const pb = PLAYBOOKS[ind.key];
  if (!pb) {   /* 플레이북이 없는 산업 — 과제 표로 최소 구성 */
    const probs = ind.problems.map(k => PROBLEMS[k]).filter(Boolean);
    return {
      industry: ind.key, segment: null, context: ind.short || '', segmentContext: '',
      chronic: ind.problems.slice(0, 4).map(k => ({ title: PROBLEMS[k].label, detail: PROBLEMS[k].desc, impact: '', problems: [k], focus: picked.includes(k) })),
      personas: [], zones: [], niceToHave: [], automation: [], kpis: [], compliance: [], consult: [], fallback: true, size: probs.length
    };
  }
  const seg = segmentKey && pb.segments[segmentKey] ? { key: segmentKey, ...pb.segments[segmentKey] } : null;
  const segChronic = (seg ? seg.chronic : []).map(c => ({ ...c, seg: true }));
  /* 세부 업종 문제와 과제가 겹치기만 하는 기본 문제는 뺀다(같은 이야기 반복 방지) */
  const covered = c => segChronic.some(sc => c.problems.length && c.problems.every(p => sc.problems.includes(p)));
  const chronic = rank([...segChronic, ...pb.chronic.filter(c => !covered(c))], picked, x => (x.seg ? 0.5 : 0))
    .filter((c, i, a) => a.findIndex(o => similar(o.title, c.title)) === i).slice(0, 4);
  /* 구역표 — 세부 업종 구역을 앞에, 기본 구역은 공정 흐름 순서 유지. 7행을 넘으면 관련 없는 기본 구역부터 뺀다 */
  let zones = [...(seg ? seg.zones : []).map(z => ({ ...z, seg: true })), ...pb.zones]
    .filter((z, i, a) => a.findIndex(o => similar(o.zone, z.zone)) === i)
    .map(z => ({ ...z, focus: overlap(z.problems, picked) > 0 }));
  while (zones.length > 7) {
    let j = -1;
    for (let i = zones.length - 1; i >= 0; i--) if (!zones[i].seg && !zones[i].focus) { j = i; break; }
    if (j < 0) for (let i = zones.length - 1; i >= 0; i--) if (!zones[i].seg) { j = i; break; }
    if (j < 0) j = zones.length - 1;
    zones.splice(j, 1);
  }
  return {
    industry: ind.key,
    segment: seg ? { key: seg.key, label: seg.label } : null,
    context: pb.context, segmentContext: seg ? seg.context : '',
    chronic,
    personas: rank(pb.personas, picked),
    zones,
    zoneSensors: [...new Set(zones.filter(z => z.focus).flatMap(z => z.sensors))],
    niceToHave: pb.niceToHave, automation: pb.automation, kpis: pb.kpis,
    compliance: pb.compliance, consult: pb.consult,
    segments: Object.entries(pb.segments).map(([k, v]) => ({ key: k, label: v.label }))
  };
}

/** 무료 제안서 범위 — 자세히 다루는 것(선택 과제·연결 구역)과, 견적 상담 때 다루는 것을 나눈다.
 *  zones: 선택 과제와 연결된 구역만 자세히. 연결 구역이 없으면 앞의 2개를 「먼저 살피는 구역」으로. */
export function scopeOf(m) {
  const pb = m.playbook || { zones: [], automation: [], niceToHave: [] };
  const focus = pb.zones.filter(z => z.focus);
  const open = focus.length ? focus : pb.zones.slice(0, 2);
  const locked = pb.zones.filter(z => !open.includes(z));
  const picked = m.input.problems;
  return {
    problems: picked.map(k => PROBLEMS[k].label),
    others: (industryByKey(m.industry.key) || { problems: [] }).problems.filter(k => !picked.includes(k) && PROBLEMS[k]).map(k => PROBLEMS[k].label),
    openZones: open.map(z => z.zone), lockedZones: locked.map(z => z.zone), zonesFocused: focus.length > 0,
    openLevels: (pb.automation || []).slice(0, 2).map(a => a.title), lockedLevels: (pb.automation || []).slice(2).map(a => a.title),
    niceCount: (pb.niceToHave || []).length
  };
}

/** 메인 — input: { industry, segment?, problems[], goals[] }, opts: { company? (company.mjs detect 결과) } */
export function insight(input, cases = CASES, opts = {}) {
  const ind = industryByKey(input.industry) || INDUSTRIES[0];
  /* 무료 제안서는 가장 고민되는 과제 CFG.maxProblems 개(기본 1)만 다룬다 */
  let problems = (input.problems || []).filter(p => PROBLEMS[p]).slice(0, CFG.maxProblems);
  let goals = (input.goals || []).filter(g => GOALS[g]);
  const defaulted = !problems.length || !goals.length;   /* 비워 두면 산업 대표 과제·효과로 채운다 */
  if (!problems.length) problems = ind.problems.slice(0, CFG.maxProblems);
  if (!goals.length) goals = ind.goals.slice(0, 2);
  const company = opts.company || input.companyInfo || null;
  const pbData = PLAYBOOKS[ind.key];
  let segment = input.segment && pbData && pbData.segments[input.segment] ? input.segment : null;
  if (!segment && company && company.industry === ind.key && company.segment) segment = company.segment;
  const clean = { industry: ind.key, segment, problems, goals };
  const segKw = segment ? pbData.segments[segment].match : [];
  const sensors = recommendSensors(problems);

  /* 기존 도입 고객이면 자기 사례는 「귀사 도입 현황」으로 따로 보여주고 비교 사례에서는 뺀다 */
  const ownKey = company && company.customer ? company.customer : null;
  const own = ownKey ? cases.find(c => c.key === ownKey) : null;
  const detailed = cases.filter(c => c.detailed && c.results.length);
  /* 세부 업종 키워드가 사례에 보이면 같은 점수 안에서 앞으로 (점수 자체는 바꾸지 않음) */
  const segTie = c => segKw.length && has(low(c.name + ' ' + c.industryText + ' ' + c.tagline + ' ' + c.about), segKw) ? 1 : 0;
  const ranked = detailed.filter(c => c.key !== ownKey).map(c => ({ ...scoreCase(c, clean, sensors), c, st: segTie(c) }))
    .sort((a, b) => (Math.round(b.score * 100) - Math.round(a.score * 100)) || (b.st - a.st) || (a.c.global - b.c.global) || a.key.localeCompare(b.key));
  const top = ranked.slice(0, 3).map(({ c, st, ...r }) => ({
    ...r, name: c.name, title: c.title, tagline: c.tagline, industryText: c.industryText, global: c.global,
    challenges: c.challenges.slice(0, 3), solutions: c.solutions.slice(0, 4), quote: c.quote, cite: c.cite,
    image: c.image, url: c.url
  }));

  /* 같은 산업 도입 고객 (로고형 사례 포함) */
  const peers = cases.filter(c => c.industries.includes(ind.key) && !c.global && !c.detailed && c.key !== ownKey).map(c => ({ key: c.key, name: c.name, url: c.url }));

  /* 산업 공통 과제 — 선택한 것을 앞에 */
  const common = ind.problems.map(k => ({ key: k, label: PROBLEMS[k].label, desc: PROBLEMS[k].desc, picked: problems.includes(k) }))
    .sort((a, b) => b.picked - a.picked);

  /* 참고 수치 — 상위 사례에서 목표 관련 성과 */
  const evidence = [];
  for (const t of top) for (const r of t.goalResults) {
    if (evidence.length >= 4) break;
    if (!evidence.some(e => e.l === r.l)) evidence.push({ n: r.n, l: r.l, from: t.name, global: t.global, goal: true });
  }
  /* 목표와 직접 맞는 수치가 적으면 1위 사례의 대표 성과로 채운다 (goal:false 로 구분 표기) */
  for (const r of (top[0] ? top[0].results : [])) {
    if (evidence.length >= 3) break;
    if (!evidence.some(e => e.l === r.l)) evidence.push({ n: r.n, l: r.l, from: top[0].name, global: top[0].global, goal: false });
  }

  const ownCase = own ? { key: own.key, name: own.name, tagline: own.tagline, detailed: own.detailed,
    results: own.results.slice(0, 4), solutions: own.solutions.slice(0, 3), url: own.url } : null;

  return {
    input: clean, defaulted, playbook: playbook(ind.key, segment, problems), ownCase,
    company: company ? { name: company.name || '', segmentLabel: company.segmentLabel || '', source: company.source || '', confidence: company.confidence || 0, customer: !!ownCase } : null, industry: { key: ind.key, label: ind.label, short: ind.short, icon: ind.icon, hero: ind.hero, doc: ind.doc },
    top, peers, common, sensors, platform: PLATFORM, evidence,
    poolSize: cases.length, detailedSize: detailed.length,
    confidence: top[0] ? (top[0].pct >= 70 ? 'high' : top[0].pct >= 45 ? 'mid' : 'low') : 'low'
  };
}
