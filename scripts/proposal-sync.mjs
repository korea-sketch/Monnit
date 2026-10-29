#!/usr/bin/env node
/** 맞춤 제안서 — 사례 데이터 동기화 (빌드 단계, 2026-09-17)
 *
 *  구글 시트 Cases 탭(사이트 CMS와 같은 시트)을 읽어 두 파일을 만든다.
 *    netlify/lib/proposal/cases.data.mjs   서버(매칭·PDF)용
 *    js/proposal-data.js                   신청·현황 화면용 (사례 + 산업·과제 표)
 *
 *  시트를 못 읽으면 기존 cases.data.mjs(저장소에 커밋된 스냅샷)를 그대로 쓴다.
 *  어떤 경우에도 exit 0 — 이 스크립트 때문에 배포가 멈추면 안 된다.
 *  실행:  node scripts/proposal-sync.mjs        (오프라인: PROPOSAL_SYNC=off)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET_ID = process.env.CONTENT_SHEET_ID || '1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc';
const OUT_SERVER = path.join(ROOT, 'netlify/lib/proposal/cases.data.mjs');
const OUT_BROWSER = path.join(ROOT, 'js/proposal-data.js');

const KB = await import(pathToFileURL(path.join(ROOT, 'netlify/lib/proposal/kb.mjs')).href);
const PB_DIR = path.join(ROOT, 'data/proposal/playbooks');
const OUT_PB = path.join(ROOT, 'netlify/lib/proposal/playbooks.data.mjs');
const OUT_BRAND = path.join(ROOT, 'netlify/lib/proposal/brand.data.mjs');
const EN_FILE = path.join(ROOT, 'data/proposal/i18n/en.json');

/* ── 브랜드 이미지 (제안서 PDF 표지 필수) ─────────────────────────────
   data/proposal/brand/cover.jpg · logo-white.png · logo-blue.png 를 함수 번들 안에 넣는다.
   파일 경로에 기대지 않으므로 배포 환경이 달라도 표지가 빠지지 않는다. 파일이 없으면 기존 모듈을 유지한다. */
function buildBrand() {
  const dir = path.join(ROOT, 'data/proposal/brand');
  const need = { cover: 'cover.jpg', logoWhite: 'logo-white.png', logoBlue: 'logo-blue.png' };
  const out = {};
  for (const [k, f] of Object.entries(need)) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) { console.warn('[proposal-sync] 브랜드 파일 없음:', f, '— 기존 brand.data.mjs 유지'); return false; }
    out[k] = fs.readFileSync(fp).toString('base64');
  }
  const body = '/* 자동 생성 — scripts/proposal-sync.mjs · 원본 data/proposal/brand/ (표지 배너 · 흰색/파란색 로고)\n' +
    '   제안서 PDF 첫 장에는 반드시 표지 배너가 들어간다(시스템 기본값). */\n' +
    Object.entries(out).map(([k, v]) => `export const ${k} = '${v}';`).join('\n') + '\n';
  const prev = fs.existsSync(OUT_BRAND) ? fs.readFileSync(OUT_BRAND, 'utf8') : '';
  if (prev !== body) fs.writeFileSync(OUT_BRAND, body);
  return true;
}

/* ── 산업 플레이북 (data/proposal/playbooks/*.json) ─────────────────
   잘못된 센서·과제 키, 과장 표현은 빌드 로그에 경고하고 그 항목만 뺀다. */
const PB_BANNED = /(보장|완벽|100\s*%|무조건|최저가)/;
function loadPlaybooks() {
  const out = {}; const warn = [];
  if (!fs.existsSync(PB_DIR)) return { out, warn: ['플레이북 폴더 없음'] };
  for (const f of fs.readdirSync(PB_DIR).filter(f => f.endsWith('.json')).sort()) {
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(PB_DIR, f), 'utf8')); }
    catch (e) { warn.push(f + ' JSON 오류: ' + e.message); continue; }
    if (!KB.industryByKey(p.key)) { warn.push(f + ' 알 수 없는 산업 키 ' + p.key); continue; }
    const keys = (arr, dict, where) => (arr || []).filter(x => dict[x] || (warn.push(`${p.key} ${where}: ${x} 제외`), false));
    const zone = z => ({ zone: z.zone, risk: z.risk, nice: z.nice || '', sensors: keys(z.sensors, KB.SENSORS, 'sensor'), problems: keys(z.problems, KB.PROBLEMS, 'problem') });
    const chronic = c => ({ title: c.title, detail: c.detail, impact: c.impact || '', problems: keys(c.problems, KB.PROBLEMS, 'problem') });
    const clean = {
      key: p.key, context: p.context || '',
      chronic: (p.chronic || []).map(chronic),
      personas: (p.personas || []).map(x => ({ role: x.role, pains: (x.pains || []).slice(0, 4), monnit: x.monnit || '', problems: keys(x.problems, KB.PROBLEMS, 'problem') })),
      zones: (p.zones || []).map(zone),
      niceToHave: (p.niceToHave || []).slice(0, 6),
      automation: (p.automation || []).sort((a, b) => a.level - b.level).map(a => ({ level: a.level, title: a.title, what: a.what, example: a.example, kit: keys(a.kit, KB.AUTOMATION_KIT, 'kit') })),
      kpis: (p.kpis || []).slice(0, 6), compliance: (p.compliance || []).slice(0, 4), consult: (p.consult || []).slice(0, 6),
      segments: Object.fromEntries(Object.entries(p.segments || {}).map(([k, s]) => [k, {
        label: s.label, match: (s.match || []).map(x => String(x).toLowerCase()), context: s.context || '',
        chronic: (s.chronic || []).map(chronic), zones: (s.zones || []).map(zone)
      }]))
    };
    const txt = JSON.stringify(clean);
    if (PB_BANNED.test(txt)) warn.push(`${p.key} 금지 표현 "${txt.match(PB_BANNED)[0]}" — 문구를 고치세요`);
    if (clean.automation.length !== 5) warn.push(`${p.key} 자동화 단계가 5개가 아님`);
    out[p.key] = clean;
  }
  const missing = KB.INDUSTRIES.map(i => i.key).filter(k => !out[k]);
  if (missing.length) warn.push('플레이북 없는 산업: ' + missing.join(', ') + ' (기본 문구로 대체)');
  return { out, warn };
}

function parseCSV(text) {
  const rows = []; let row = [], f = '', i = 0, q = false;
  text = text.replace(/^﻿/, '');
  while (i < text.length) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const good = rows.filter(r => r.some(x => String(x).trim()));
  if (good.length < 2) return [];
  const head = good[0].map(h => h.trim().toLowerCase());
  return good.slice(1).map(r => Object.fromEntries(head.map((h, k) => [h, (r[k] || '').trim()]).filter(([h]) => h)));
}
const items = s => String(s || '').split(/\s*\|\|\s*|\r?\n/).map(x => x.trim()).filter(Boolean);
const pair = s => { const [a = '', b = ''] = String(s).split('::').map(x => x.trim()); return [a, b]; };
const strip = s => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
/* 이미지는 우리 사이트 것만 쓴다 — 외부 핫링크는 언제 끊길지 모른다 */
const img = s => {
  s = String(s || '').trim();
  if (!s) return '';
  const own = s.match(/^https?:\/\/(?:www\.)?(?:monnit\.co\.kr|monnitk\.netlify\.app)(\/images\/[^?#]+)/);
  if (own) s = own[1];
  if (/^https?:/.test(s)) return '';
  s = '/' + s.replace(/^\/+/, '');
  return fs.existsSync(path.join(ROOT, s)) ? s : '';
};

function mapRow(o) {
  const key = String(o.key || '').trim();
  if (!key || !o.name || /^[━─]/.test(key)) return null;
  const results = items(o.results).map(pair).map(([n, l]) => ({ n, l })).filter(x => x.n && x.l);
  const qs = items(o.qs).map(pair).map(([n, l]) => ({ n, l })).filter(x => x.n && x.l);
  const firstPhoto = items(o.photos)[0] ? pair(items(o.photos)[0])[0] : '';
  return {
    key,
    name: strip(o.name),
    industryText: strip(o.industry),
    industries: KB.industriesOfCase(key, o.industry),
    global: KB.GLOBAL_CASES.includes(key),
    title: strip(o.title),
    tagline: strip(o.tagline),
    about: strip(o.about),
    challenges: items(o.challenges).map(strip),
    solutions: items(o.solutions).map(pair).map(([t, d]) => ({ t: strip(t), d: strip(d) })).filter(x => x.t),
    results, qs,
    quote: strip(o.quote), cite: strip(o.cite),
    image: img(o.hero) || img(firstPhoto),
    url: '/case/' + key,
    detailed: results.length > 0 || items(o.challenges).length > 0
  };
}

async function fetchCases() {
  if (process.env.PROPOSAL_SYNC === 'off') throw new Error('PROPOSAL_SYNC=off');
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Cases&_=${Date.now()}`;
  let last;
  for (let a = 1; a <= 3; a++) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
      const r = await fetch(url, { redirect: 'follow', signal: ac.signal }); clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      if (/^\s*</.test(txt)) throw new Error('HTML 응답(시트 비공개?)');
      const list = parseCSV(txt).map(mapRow).filter(Boolean);
      if (list.filter(c => c.detailed).length < 3) throw new Error('상세 사례가 3건 미만 — 시트 구조 변경 의심');
      return list;
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * a)); }
  }
  throw last;
}

async function main() {
  let cases, from = 'sheet';
  try { cases = await fetchCases(); }
  catch (e) {
    from = 'snapshot';
    console.warn('[proposal-sync] 시트 읽기 실패 → 저장소 스냅샷 사용:', e.message);
    try { cases = (await import(pathToFileURL(OUT_SERVER).href + '?' + Date.now())).default; }
    catch (e2) { console.warn('[proposal-sync] 스냅샷도 없음 — 사례 없이 진행'); cases = []; }
  }

  /* 산업 분류 규칙(kb.mjs)이 바뀌었을 수 있으니 스냅샷도 다시 분류한다 */
  let reclassified = 0;
  for (const c of cases) {
    const next = KB.industriesOfCase(c.key, c.industryText);
    if (JSON.stringify(next) !== JSON.stringify(c.industries)) { c.industries = next; reclassified++; }
  }
  const stamp = new Date().toISOString();
  buildBrand();
  const { out: pb, warn: pbWarn } = loadPlaybooks();
  if (Object.keys(pb).length) {
    fs.writeFileSync(OUT_PB,
      '/* 자동 생성 — scripts/proposal-sync.mjs (' + stamp + ', 원본: data/proposal/playbooks/*.json)\n' +
      '   산업 문구는 JSON 파일을 고치세요. */\n' +
      'export default ' + JSON.stringify(pb, null, 1) + ';\n');
  }
  if (from === 'sheet' || reclassified) {
    fs.writeFileSync(OUT_SERVER,
      '/* 자동 생성 — scripts/proposal-sync.mjs (' + stamp + ', 원본: 구글 시트 Cases 탭)\n' +
      (from === 'sheet' ? '' : '   (산업 재분류 ' + reclassified + '건 반영)\n') +
      '   직접 고치지 말고 시트를 고치세요. 시트를 못 읽을 때는 이 스냅샷을 그대로 씁니다. */\n' +
      'export const SYNCED_AT = ' + JSON.stringify(stamp) + ';\n' +
      'export default ' + JSON.stringify(cases, null, 1) + ';\n');
  }

  /* 브라우저용 — 개인정보·내부값 없음. 화면에 필요한 필드만 */
  const lite = cases.map(c => ({
    key: c.key, name: c.name, industries: c.industries, global: c.global, detailed: c.detailed,
    tagline: c.tagline, challenges: c.challenges.slice(0, 3), results: c.results.slice(0, 4),
    image: c.image, url: c.url
  }));
  const kb = {
    industries: KB.INDUSTRIES.map(({ key, label, icon, short, hero, problems, goals }) => ({ key, label, icon, short, hero, problems, goals })),
    problems: Object.fromEntries(Object.entries(KB.PROBLEMS).map(([k, v]) => [k, { label: v.label, desc: v.desc, sensors: v.sensors }])),
    goals: Object.fromEntries(Object.entries(KB.GOALS).map(([k, v]) => [k, v.label])),
    sensors: Object.fromEntries(Object.entries(KB.SENSORS).map(([k, v]) => [k, v.name])),
    scales: KB.SCALES, timelines: KB.TIMELINES,
    /* 홈 솔루션 파인더 코드 → 산업·과제 (빠른 신청 화면) */
    finder: { fac: KB.FINDER_FAC, segment: KB.FINDER_SEGMENT, con: KB.FINDER_CON, scale: KB.FINDER_SCALE },
    /* 신청 화면 미리보기용 — 산업 고질 문제·공정 구역 이름만 */
    playbooks: Object.fromEntries(Object.entries(pb).map(([k, p]) => [k, {
      context: p.context,
      chronic: p.chronic.map(c => ({ title: c.title, detail: c.detail, problems: c.problems })),
      zones: p.zones.map(z => ({ zone: z.zone, problems: z.problems })),
      personas: p.personas.map(x => x.role),
      automation: p.automation.map(a => a.title),
      segments: Object.fromEntries(Object.entries(p.segments).map(([sk, sv]) => [sk, sv.label]))
    }]))
  };
  /* 영문 화면용 — data/proposal/i18n/en.json (없는 항목은 화면에서 숨기거나 한국어로 둔다) */
  let en = null;
  try { en = JSON.parse(fs.readFileSync(EN_FILE, 'utf8')); }
  catch (e) { console.warn('[proposal-sync] 영문 사전 없음/오류 — 영문 화면은 라벨만 사이트 사전으로:', e.message); }
  if (en) {
    const miss = [];
    for (const i of KB.INDUSTRIES) if (!en.industries || !en.industries[i.key]) miss.push('industry ' + i.key);
    for (const k of Object.keys(KB.PROBLEMS)) if (!en.problems || !en.problems[k]) miss.push('problem ' + k);
    for (const p of Object.values(pb)) for (const c of p.chronic) if (!(en.playbook || {})[c.title]) miss.push('playbook ' + c.title.slice(0, 20));
    if (miss.length) console.warn(`[proposal-sync] 영문 미번역 ${miss.length}건 (예: ${miss.slice(0, 3).join(', ')}) — data/proposal/i18n/en.json 보강`);
  }
  fs.writeFileSync(OUT_BROWSER,
    '/*! 자동 생성 — scripts/proposal-sync.mjs (' + stamp + ') · 직접 고치지 마세요 */\n' +
    'window.MK_PROPOSAL_DATA=' + JSON.stringify({ at: stamp, from, kb, cases: lite, en }) + ';\n');
  /* 서버용 영문 사전 — 진행 현황 API 가 ?lang=en 일 때 쓴다 */
  if (en) {
    const body = '/* 자동 생성 — scripts/proposal-sync.mjs · 원본 data/proposal/i18n/en.json */\nexport default ' + JSON.stringify(en) + ';\n';
    const OUT_EN = path.join(ROOT, 'netlify/lib/proposal/en.data.mjs');
    if (!fs.existsSync(OUT_EN) || fs.readFileSync(OUT_EN, 'utf8') !== body) fs.writeFileSync(OUT_EN, body);
  }

  console.log(`[proposal-sync] 플레이북 ${Object.keys(pb).length}개 → playbooks.data.mjs` + (pbWarn.length ? ' · 경고 ' + pbWarn.length : ''));
  pbWarn.forEach(w => console.warn('  [playbook] ' + w));
  console.log(`[proposal-sync] ${from} · 사례 ${cases.length}건 (상세 ${cases.filter(c => c.detailed).length}) → cases.data.mjs, js/proposal-data.js`);
}

main().catch(e => console.warn('[proposal-sync] 건너뜀:', e && e.message)).finally(() => process.exit(0));
