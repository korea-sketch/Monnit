#!/usr/bin/env node
/* ============================================================
   Monnit Korea — 정적 프리렌더 + AI/SEO 자산 빌드 스크립트
   실행:  node build.js
   Netlify:  Build command = "node build.js"   Publish dir = "."
   ------------------------------------------------------------
   app.js 의 콘텐츠 데이터(APPS/PRODUCTS/CASE_DATA 등)를 읽어
   - robots.txt / sitemap.xml / llms.txt / llms-full.txt
   - /pages/*.html  (JS 없이 읽히는 정적 콘텐츠 페이지)
   를 생성합니다. 해시 SPA는 그대로 두고, 크롤러용 정적 경로를 병행 제공.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const SITE = 'https://monnit.co.kr';           // 대표 도메인
const TODAY = new Date().toISOString().slice(0, 10);
const OUT_PAGES = path.join(__dirname, 'pages');

/* ---------- app.js 에서 데이터 리터럴 추출 (괄호 균형 파싱) ---------- */
const APPJS = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
function extract(decl) {
  const i = APPJS.indexOf(decl);
  if (i < 0) return null;
  let j = APPJS.indexOf('=', i) + 1;
  while (/\s/.test(APPJS[j])) j++;
  const open = APPJS[j], close = open === '[' ? ']' : '}';
  let depth = 0, inStr = false, strCh = '', esc = false, k = j;
  for (; k < APPJS.length; k++) {
    const c = APPJS[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
    if (c === '/' && APPJS[k + 1] === '*') { k = APPJS.indexOf('*/', k) + 1; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { k++; break; } }
  }
  try { return (new Function('return (' + APPJS.slice(j, k) + ')'))(); }
  catch (e) { console.warn('[build] 추출 실패:', decl, e.message); return null; }
}

/* ============================================================
   ========== 데이터 소스: 구글 시트 우선, 실패 시 리터럴 폴백 ==========
   빌드 시 시트를 직접 읽어 사람(SPA)과 봇(정적 페이지)이 항상
   같은 콘텐츠를 보게 합니다. 시트 응답 실패 시 app.js 하드코딩
   리터럴로 자동 폴백 — 빌드는 절대 실패하지 않습니다.
   환경변수 SHEET_SOURCE=off 로 폴백을 강제할 수 있습니다.
   ============================================================ */
const SHEET_ID = '1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc';

function parseCSVBuild(text) {
  const rows = []; let row = [], field = '', i = 0, inQ = false;
  text = text.replace(/^\uFEFF/, '');
  while (i < text.length) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; } field += ch; i++; continue; }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
function csvToObjects(text) {
  const rows = parseCSVBuild(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => { const o = {}; head.forEach((h, idx) => { if (h) o[h] = (r[idx] || '').trim(); }); return o; });
}
async function fetchTab(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const t = await res.text();
      if (/^\s*</.test(t)) throw new Error('HTML 응답(시트 비공개?)');
      return csvToObjects(t);
    } catch (e) { if (attempt === 3) throw new Error(`[${tab}] ${e.message}`); await new Promise(r => setTimeout(r, 700 * attempt)); }
  }
}
const splitL = (s, sep) => String(s || '').split(sep || '||').map(x => x.trim()).filter(Boolean);
const partsOf = s => String(s || '').split('::').map(x => x.trim());

/* 시트 행 → 빌더가 쓰는 구조로 변환 */
function convertSheet(D, prodCats) {
  const CATEGORIES = {};
  D.AppCategories.forEach(r => { if (r.key) CATEGORIES[r.key] = { name: r.name || r.key, label: r.label || '' }; });
  const APPS = D.Applications.filter(r => r.id && r.name).map(r => ({
    id: r.id, name: r.name, cat: r.cat, desc: r.desc || '', sensors: r.sensors || '',
    popularity: parseFloat(r.popularity) || 0, isNew: /^(true|1)$/i.test(r.isnew || ''), added: r.added || ''
  }));
  const APP_DETAILS = {};
  D.AppDetails.forEach(r => {
    if (!r.key) return;
    const has = f => (r[f] || '').trim();
    if (!has('customerlead') && !has('challengelead') && !has('solutionlead')) return;
    APP_DETAILS[r.key] = {
      snapshot: splitL(r.snapshot).map(x => { const p = partsOf(x); return { label: p[0] || '', value: p[1] || '', desc: p[2] || '' }; }),
      customer: { lead: r.customerlead || '', paragraphs: splitL(r.customerparagraphs) },
      challenge: { lead: r.challengelead || '', pains: splitL(r.pains).map(x => { const p = partsOf(x); return { title: p[0] || '', desc: p.slice(1).join(' · ') }; }) },
      solution: { lead: r.solutionlead || '', paragraphs: splitL(r.solutionparagraphs), sensors: splitL(r.sensors) },
      proposal: { lead: r.proposallead || '', phases: splitL(r.phases).map(x => { const p = partsOf(x); return { tag: p[0] || '', title: p[1] || '', desc: p[2] || '', duration: p[3] || '' }; }) },
      roi: { lead: r.roilead || '', metrics: splitL(r.metrics).map(x => { const p = partsOf(x); return { num: p[0] || '', desc: p.slice(1).join(' · ') }; }), before: r.before || '', after: r.after || '' }
    };
  });
  const CASE_DATA = {};
  D.Cases.forEach(r => {
    if (!r.key || !r.name) return;
    CASE_DATA[r.key] = {
      num: r.num || '', industry: r.industry || '', name: r.name, title: r.title || '', tagline: r.tagline || '', about: r.about || '',
      qs: splitL(r.qs).map(x => { const p = partsOf(x); return { n: p[0] || '', l: p[1] || '' }; }),
      challenges: splitL(r.challenges),
      solutions: splitL(r.solutions).map(x => { const p = partsOf(x); return { t: p[0] || '', d: p.slice(1).join(' · ') }; }),
      results: splitL(r.results).map(x => { const p = partsOf(x); return { n: p[0] || '', l: p[1] || '' }; }),
      quote: r.quote || '', cite: r.cite || ''
    };
  });
  const koToCat = {}; (prodCats || []).forEach(c => { koToCat[(c.ko || '').trim()] = c.id; });
  const PRODUCTS = D.Products.filter(r => r.name).map(r => ({
    c: koToCat[(r.category || '').trim()] || r.category || '', g: r.group || '', n: r.name, d: r.desc || '', u: r.url || ''
  }));
  return {
    CATEGORIES, APPS, APP_DETAILS, CASE_DATA, PRODUCTS,
    CUSTOMERS: D.Customers.filter(r => r.name).map(r => ({ n: r.name, i: r.industry || '', h: r.headline || '', a: r.apps || '' })),
    AWARDS: D.Awards.filter(r => r.name).map(r => ({ y: r.year || '', n: r.name, c: r.category || '', note: r.note || '', url: r.url || '' })),
    PARTNERS: D.Partners.filter(r => r.name).map(r => ({ n: r.name, r: r.region || '', d: r.desc || '', url: r.url || '' })),
    BLOG: D.Blog.filter(r => r.title).map(r => ({ date: r.date || '', title: r.title, body: r.body || '', thumb: r.thumb || '', url: r.url || '' })),
    WHITEPAPERS: D.Whitepapers.filter(r => r.title).map(r => ({ icon: r.icon || '', title: r.title, desc: r.desc || '', url: r.url || '' })),
    PROMOS: D.Promotions.filter(r => r.title).map(r => ({ id: r.id || '', title: r.title, period: r.period || '', badge: r.badge || '', ended: /^(true|1)$/i.test(r.ended || ''), desc: r.desc || '', order: r.order || '' }))
  };
}

async function loadDataSource(prodCats) {
  if (process.env.SHEET_SOURCE === 'off') throw new Error('SHEET_SOURCE=off (폴백 강제)');
  const tabNames = ['AppCategories', 'Applications', 'AppDetails', 'Cases', 'Customers', 'Awards', 'Partners', 'Blog', 'Whitepapers', 'Promotions', 'Products'];
  const D = {};
  for (const t of tabNames) D[t] = await fetchTab(t);
  if (D.Applications.length < 10 || D.Products.length < 10 || !D.Cases.length) throw new Error('필수 탭이 비어있거나 비정상');
  return convertSheet(D, prodCats);
}

/* ---- 코드 영역 데이터(시트에 없는 것)는 항상 리터럴에서 ---- */
const PRODUCT_CATS = extract('var PRODUCT_CATS =') || [];
const APP_TO_CUSTOMERS = extract('const APP_TO_CUSTOMERS =') || {};
const CAT_DESCRIPTIONS = extract('const CAT_DESCRIPTIONS =') || {};
const REGION_KO = extract('const REGION_KO =') || {};

(async () => { /* ===== 메인: 데이터 로드 후 전체 빌드 ===== */
let __src = null, __from = '구글 시트';
try { __src = await loadDataSource(PRODUCT_CATS); }
catch (e) { __from = 'app.js 리터럴 (폴백: ' + e.message + ')'; }
console.log('[build] 데이터 소스:', __from);
const CATEGORIES = __src ? __src.CATEGORIES : (extract('let CATEGORIES =') || {});
const APPS = __src ? __src.APPS : (extract('let APPS =') || []);
const PRODUCTS = __src ? __src.PRODUCTS : (extract('var PRODUCTS =') || []);
const CASE_DATA = __src ? __src.CASE_DATA : (extract('let CASE_DATA =') || {});
const APP_DETAILS = __src ? __src.APP_DETAILS : (extract('let APP_DETAILS =') || {});
const AWARDS = __src ? __src.AWARDS : (extract('let AWARDS =') || []);
const PARTNERS = __src ? __src.PARTNERS : (extract('let PARTNERS =') || []);
const CUSTOMERS = __src ? __src.CUSTOMERS : (extract('let CUSTOMERS =') || []);
const BLOG = __src ? __src.BLOG : (extract('let BLOG =') || []);
const WHITEPAPERS = __src ? __src.WHITEPAPERS : (extract('let WHITEPAPERS =') || []);
const PROMOS = __src ? __src.PROMOS : (extract('let PROMOS =') || []);

/* ---------- data.js 에서 지식베이스/가이드 로드 ---------- */
let KNOWLEDGEBASE = [], GUIDES = [];
try {
  const DATAJS = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  const r = (new Function(DATAJS + '\n;return { KB: (typeof KNOWLEDGEBASE !== "undefined") ? KNOWLEDGEBASE : [], G: (typeof GUIDES !== "undefined") ? GUIDES : [] };'))();
  KNOWLEDGEBASE = r.KB; GUIDES = r.G;
} catch (e) { console.warn('[build] data.js 로드 실패(지식베이스 생략):', e.message); }

/* 본문 HTML 새니타이즈 — script/iframe/이벤트핸들러 제거 */
const sanitize = h => String(h || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<iframe[\s\S]*?(<\/iframe>|\/>)/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
  .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
const CAT_SLUG_MAP = {
  '센서': 'sensor', '게이트웨이': 'gateway', '소프트웨어': 'software', '액세서리': 'accessory',
  '문서/가이드': 'docs', '온프라미스': 'onprem', 'iMonnit Online': 'imonnit-online',
  '온프레미스 소프트웨어': 'onprem-software', '애드온 기기': 'addon', '지원 동영상': 'videos', '기기 손상': 'damage'
};
const slugKo = s => CAT_SLUG_MAP[s] || String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'etc';

/* ---------- 유틸 ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const CATNAME = { sensors: '무선 센서', gateways: '게이트웨이', software: '통합관제 소프트웨어', accessories: '액세서리·연동장치' };

function page({ slug, title, desc, h1, bodyHtml, jsonld }) {
  const url = SITE + '/pages/' + slug + '.html';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Monnit Korea">
<meta name="robots" content="index,follow">
${jsonld ? '<script type="application/ld+json">' + JSON.stringify(jsonld) + '</script>' : ''}
<style>body{font-family:'Pretendard',system-ui,sans-serif;max-width:900px;margin:0 auto;padding:32px 20px;line-height:1.7;color:#1a2130;background:#fff}a{color:#2E5C9A}h1{font-size:30px}h2{font-size:22px;margin-top:36px;border-top:1px solid #e5e8ef;padding-top:24px}h3{font-size:17px;margin:20px 0 4px}.muted{color:#666}.back{display:inline-block;margin-bottom:20px;font-size:14px}nav.crumb{font-size:13px;color:#888;margin-bottom:8px}ul{padding-left:18px}li{margin:6px 0}.card{border:1px solid #e5e8ef;border-radius:10px;padding:16px 18px;margin:12px 0}</style>
</head>
<body>
<nav class="crumb"><a href="${SITE}/">Monnit Korea</a> / ${esc(title.split('—')[0].trim())}</nav>
<a class="back" href="${SITE}/">← 메인으로</a>
<h1>${esc(h1)}</h1>
${bodyHtml}
<hr style="margin:40px 0;border:none;border-top:1px solid #e5e8ef">
<p class="muted">이 페이지는 검색·AI 크롤러를 위한 정적 콘텐츠 버전입니다. 인터랙티브 버전은 <a href="${SITE}/">monnit.co.kr</a> 에서 확인하세요.</p>
<p class="muted">문의: <a href="mailto:korea@monnit.com">korea@monnit.com</a> · 02-2088-1454</p>
</body>
</html>`;
}

if (!fs.existsSync(OUT_PAGES)) fs.mkdirSync(OUT_PAGES);
const generated = [];   // {loc, title}
function writePage(slug, html, title) {
  fs.writeFileSync(path.join(OUT_PAGES, slug + '.html'), html);
  generated.push({ loc: SITE + '/pages/' + slug + '.html', title });
}

const ORG_LD = {
  '@context': 'https://schema.org', '@type': 'Organization', name: 'Monnit Korea',
  url: SITE, email: 'korea@monnit.com', telephone: '+82-2-2088-1454',
  description: '산업용 무선 IoT 센서와 통합관제 플랫폼으로 화재·누수·설비 이상·환경 데이터를 실시간 모니터링하고 사고를 예방하는 산업용 IoT 전문기업.',
  sameAs: ['https://www.monnit.com']
};

/* ---------- 1) 회사 소개 ---------- */
writePage('company', page({
  slug: 'company', title: 'Monnit Korea 회사 소개 — 산업용 무선 IoT 전문기업',
  desc: 'Monnit은 2010년부터 고정밀 산업용 무선 센서를 개발해 온 글로벌 IoT 기업입니다. 130여 개국·64,000여 고객사·하루 750억 건 데이터 처리, 방산 전용 신뢰성으로 검증되었습니다.',
  h1: '신뢰성으로 세상을 모니터링합니다',
  jsonld: ORG_LD,
  bodyHtml: `
<p>Monnit은 신뢰성 높은 <strong>고정밀 산업용 등급의 무선 센서</strong>로 전 세계 핵심 도시 인프라와 주요 생산 시설, 건물을 실시간 모니터링합니다. 대형 사고를 사전에 예방하고 에너지·운영 비용을 절감하며, 다양한 산업의 탄소 배출량 감소에 앞장섭니다.</p>
<p>Monnit Korea는 글로벌 역량을 국내 현장에 맞춰 직접 컨설팅·구축·운영하는 통합 솔루션 파트너입니다. — Monnit Korea 대표이사 염정훈</p>
<h2>숫자로 보는 Monnit</h2>
<ul>
<li><strong>Since 2010</strong> — IoT 태동기부터 센싱 기술 개발</li>
<li><strong>64,000+</strong> 전 세계 고객사</li>
<li><strong>130+</strong> 개국 글로벌 납품</li>
<li><strong>2,000+</strong> 제품군</li>
<li><strong>하루 750억 건</strong> 데이터 처리</li>
<li><strong>방산 전용</strong> — 현장 검증 신뢰성</li>
</ul>
<h2>왜 Monnit인가</h2>
<h3>산업 현장에서 검증된 신뢰성</h3><p>미군·삼성·현대 등 최고 수준의 보안과 내구성을 요구하는 현장에서 검증되었습니다.</p>
<h3>AI 기반 예지보전 및 이상 감지</h3><p>하루 750억 건의 데이터로 설비 고장과 이상 징후를 미리 예측합니다.</p>
<h3>대규모 통합관제 역량</h3><p>수천~수만 개 사이트를 단일 플랫폼으로 안정적으로 통합 관제합니다.</p>
<h2>설계부터 제조·검증까지</h2>
<p>본사 R&amp;D 센터, PCB 회로 설계, 자체 SMT 생산 라인까지 제품 설계부터 제조·검증을 직접 관리합니다.</p>
<p><a href="${SITE}/pages/products.html">제품 전체 보기</a> · <a href="${SITE}/pages/solutions.html">활용 분야</a> · <a href="${SITE}/pages/cases.html">도입 사례</a></p>`
}), 'Monnit Korea 회사 소개');

/* ---------- 2) 제품 ---------- */
(function () {
  const cats = PRODUCT_CATS.length ? PRODUCT_CATS : [{ id: 'sensors', ko: '센서' }, { id: 'gateways', ko: '게이트웨이' }, { id: 'software', ko: '소프트웨어' }, { id: 'accessories', ko: '액세서리' }];
  let body = `<p>Monnit은 무선 센서·게이트웨이·통합관제 소프트웨어·연동장치를 하나의 흐름(감지→전송→분석→대응)으로 제공합니다. 총 ${PRODUCTS.length}개 제품.</p>`;
  const itemLd = [];
  cats.forEach(cat => {
    const items = PRODUCTS.filter(p => p.c === cat.id);
    if (!items.length) return;
    body += `<h2>${esc(CATNAME[cat.id] || cat.ko)} (${items.length})</h2>`;
    items.forEach(p => {
      body += `<div class="card"><h3>${esc(p.n)}</h3><p>${esc(p.d)}</p>${p.u ? `<p class="muted"><a href="${esc(p.u)}" rel="nofollow">데이터시트(PDF)</a></p>` : ''}</div>`;
      itemLd.push({ name: strip(p.n), description: strip(p.d) });
    });
  });
  writePage('products', page({
    slug: 'products', title: 'Monnit 제품 전체 — 무선 센서·게이트웨이·소프트웨어·액세서리',
    desc: `Monnit 산업용 IoT 제품 ${PRODUCTS.length}종 — 온도·진동·누수·전류 등 무선 센서, 게이트웨이, 통합관제 소프트웨어(iMonnit), 액세서리·연동장치 전체 목록.`,
    h1: '제품 — 감지에서 대응까지 하나로',
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: itemLd.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })) },
    bodyHtml: body
  }), 'Monnit 제품 전체');
})();

/* ---------- 3) 솔루션 / 활용 분야 (Applications) ---------- */
(function () {
  let body = `<p>산업별로 검증된 ${APPS.length}개 활용 분야입니다. 화재·안전, 설비 예지보전, 누수·침수, 환경·공기질, 에너지 관리, 대규모 시설 통합관제까지.</p>`;
  Object.entries(CATEGORIES).forEach(([key, info]) => {
    const items = APPS.filter(a => a.cat === key);
    if (!items.length) return;
    body += `<h2>${esc(info.name)} (${items.length})</h2><ul>`;
    items.forEach(a => { body += `<li><a href="${SITE}/pages/app-${esc(a.id)}.html"><strong>${esc(a.name)}</strong></a> — ${esc(a.desc)}${a.sensors ? ` <span class="muted">[${esc(a.sensors)}]</span>` : ''}</li>`; });
    body += '</ul>';
  });
  writePage('solutions', page({
    slug: 'solutions', title: 'Monnit 활용 분야 — 산업별 IoT 모니터링 솔루션',
    desc: `화재·안전, 설비 예지보전, 누수·침수, 환경·공기질, 에너지 관리, 통합관제 등 ${APPS.length}개 산업용 IoT 활용 분야.`,
    h1: '활용 분야 — 현장의 문제를 데이터로',
    bodyHtml: body
  }), 'Monnit 활용 분야');
})();

/* ---------- 4) 도입 사례 (Cases) ---------- */
(function () {
  const keys = Object.keys(CASE_DATA);
  let idx = `<p>글로벌 기업들이 12개 산업 현장에서 선택한 검증된 도입 사례입니다.</p><ul>`;
  keys.forEach(id => {
    const c = CASE_DATA[id];
    idx += `<li><a href="${SITE}/pages/case-${esc(id)}.html"><strong>${esc(c.name || id)}</strong></a> — ${esc(strip(c.tagline || ''))}</li>`;
    // per-case page
    const q = (c.qs || []).map(x => `<li><strong>${esc(x.n)}</strong> — ${esc(x.l)}</li>`).join('');
    const ch = (c.challenges || []).map(x => `<li>${esc(strip(x))}</li>`).join('');
    const sol = (c.solutions || []).map(x => `<li><strong>${esc(x.t)}</strong> — ${esc(strip(x.d || ''))}</li>`).join('');
    const rs = (c.results || []).map(x => `<li><strong>${esc(x.n)}</strong> — ${esc(x.l)}</li>`).join('');
    const body = `
<p class="muted">${esc(c.industry || '')}</p>
<p>${esc(strip(c.tagline || ''))}</p>
${c.about ? `<h2>고객 소개</h2><p>${esc(strip(c.about))}</p>` : ''}
${ch ? `<h2>당면 과제</h2><ul>${ch}</ul>` : ''}
${sol ? `<h2>적용 솔루션</h2><ul>${sol}</ul>` : ''}
${rs ? `<h2>성과</h2><ul>${rs}</ul>` : ''}
${q ? `<h2>핵심 성과 지표</h2><ul>${q}</ul>` : ''}
${c.quote ? `<h2>고객의 말</h2><p>“${esc(strip(c.quote))}”${c.cite ? ` <span class="muted">— ${esc(c.cite)}</span>` : ''}</p>` : ''}
<p><a href="${SITE}/pages/cases.html">← 전체 도입 사례</a> · <a href="${SITE}/#case/${esc(id)}">인터랙티브 버전 보기</a></p>`;
    writePage('case-' + id, page({
      slug: 'case-' + id, title: `${strip(c.name || id)} 도입 사례 — ${strip(c.industry || '산업용')} 무선 IoT 모니터링 | Monnit Korea`,
      desc: (function(){ var nm=strip(c.name||id), ind=strip(c.industry||''), tg=strip(c.tagline||'');
        var d = nm + (ind?'('+ind+')':'') + '의 Monnit 산업용 무선 IoT 모니터링 도입 사례. ' + (tg?tg+(/[.。]$/.test(tg)?'':'.')+' ':'') + '실시간 데이터로 사고를 예방하고 설비·에너지 운영 효율을 높인 성과를 소개합니다.';
        return d.slice(0, 160); })(),
      h1: `${strip(c.name || id)} — ${strip((c.title || '').replace(/<br>/g, ' '))}`,
      jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: strip(c.name || id) + ' 도입 사례', publisher: ORG_LD, about: strip(c.tagline || '') },
      bodyHtml: body
    }), strip(c.name || id) + ' 도입 사례');
  });
  idx += '</ul>';
  writePage('cases', page({
    slug: 'cases', title: 'Monnit 도입 사례 — 글로벌 기업 IoT 모니터링 성공 사례',
    desc: 'Samsung Biologics, ExxonMobil, Walmart, Microsoft, 현대자동차 등 글로벌 기업의 Monnit 산업용 IoT 도입 사례와 성과.',
    h1: '도입 사례 — 글로벌이 신뢰하는 파트너',
    bodyHtml: idx
  }), 'Monnit 도입 사례');
})();

/* ---------- 4-1) 활용 분야 상세 (60개) ---------- */
(function () {
  APPS.forEach(a => {
    const d = APP_DETAILS[a.id];
    const catInfo = CATEGORIES[a.cat] || {};
    const custs = APP_TO_CUSTOMERS[a.id] || [];
    let body = `<p class="muted">${esc(catInfo.name || '')}${a.sensors ? ' · 적용 센서: ' + esc(a.sensors) : ''}</p>
<p><strong>${esc(strip(a.desc))}</strong></p>`;
    if (CAT_DESCRIPTIONS[a.cat]) body += `<p class="muted">${esc(CAT_DESCRIPTIONS[a.cat])}</p>`;

    if (d) {
      if (Array.isArray(d.snapshot) && d.snapshot.length) {
        body += `<h2>한눈에 보기</h2><ul>` + d.snapshot.map(s =>
          `<li><strong>${esc(s.label)}</strong>: ${esc(s.value)}${s.desc ? ` <span class="muted">— ${esc(s.desc)}</span>` : ''}</li>`).join('') + `</ul>`;
      }
      if (d.customer) {
        body += `<h2>01 · 고객 프로필</h2><p><strong>${esc(strip(d.customer.lead || ''))}</strong></p>`;
        (d.customer.paragraphs || []).forEach(p => body += `<p>${esc(strip(p))}</p>`);
      }
      if (d.challenge) {
        body += `<h2>02 · 현재의 문제점</h2><p><strong>${esc(strip(d.challenge.lead || ''))}</strong></p>`;
        if ((d.challenge.pains || []).length) body += `<ul>` + d.challenge.pains.map(p =>
          `<li><strong>${esc(p.title)}</strong> — ${esc(strip(p.desc || ''))}</li>`).join('') + `</ul>`;
      }
      if (d.solution) {
        body += `<h2>03 · Monnit 솔루션</h2><p><strong>${esc(strip(d.solution.lead || ''))}</strong></p>`;
        (d.solution.paragraphs || []).forEach(p => body += `<p>${esc(strip(p))}</p>`);
        if (d.solution.sensors) body += `<p class="muted">구성 센서: ${esc(Array.isArray(d.solution.sensors) ? d.solution.sensors.join(' · ') : d.solution.sensors)}</p>`;
      }
      if (d.proposal) {
        body += `<h2>04 · 제안 단계</h2><p><strong>${esc(strip(d.proposal.lead || ''))}</strong></p>`;
        if ((d.proposal.phases || []).length) body += `<ul>` + d.proposal.phases.map(p =>
          `<li><strong>${esc(p.tag || '')} ${esc(p.title || '')}</strong>${p.duration ? ` <span class="muted">(${esc(p.duration)})</span>` : ''} — ${esc(strip(p.desc || ''))}</li>`).join('') + `</ul>`;
      }
      if (d.roi) {
        body += `<h2>05 · 예상 ROI</h2><p><strong>${esc(strip(d.roi.lead || ''))}</strong></p>`;
        if ((d.roi.metrics || []).length) body += `<ul>` + d.roi.metrics.map(m =>
          `<li><strong>${esc(m.num)}</strong> — ${esc(strip(m.desc || ''))}</li>`).join('') + `</ul>`;
        if (d.roi.before) body += `<p><strong>도입 전:</strong> ${esc(strip(d.roi.before))}</p>`;
        if (d.roi.after) body += `<p><strong>도입 후:</strong> ${esc(strip(d.roi.after))}</p>`;
      }
    } else {
      body += `<h2>도입 방식</h2>
<p>무선 센서를 부착만으로 설치(현장당 보통 1일 이내)하고, 게이트웨이가 데이터를 수집해 iMonnit 플랫폼에서 실시간 모니터링·알림을 제공합니다. 임계값 초과 시 SMS·이메일·전화로 즉시 통보되며, 현장 평가부터 설치·설정·교육까지 Monnit Korea가 지원합니다.</p>`;
    }
    if (custs.length) {
      body += `<h2>이 솔루션을 도입한 고객사</h2><p>${custs.map(esc).join(' · ')}</p>`;
    }
    body += `<p><a href="${SITE}/pages/solutions.html">← 활용 분야 전체</a> · <a href="${SITE}/pages/contact.html">상담·문의</a> · <a href="${SITE}/#app/${esc(a.id)}">인터랙티브 버전 보기</a></p>`;

    writePage('app-' + a.id, page({
      slug: 'app-' + a.id,
      title: `${strip(a.name)} — 무선 IoT 모니터링 솔루션 | Monnit Korea`,
      desc: (strip(a.desc) + (a.sensors ? ' 적용 센서: ' + a.sensors + '.' : '')).slice(0, 158),
      h1: strip(a.name),
      jsonld: {
        '@context': 'https://schema.org', '@type': 'Service',
        name: strip(a.name) + ' — 무선 IoT 모니터링', serviceType: strip(a.name),
        description: strip(a.desc), provider: ORG_LD, areaServed: 'KR',
        url: SITE + '/pages/app-' + a.id + '.html'
      },
      bodyHtml: body
    }), strip(a.name) + ' 솔루션');
  });
})();

/* ---------- 4-2) 고객사 전체 ---------- */
(function () {
  if (!CUSTOMERS.length) return;
  let body = `<p>제조·에너지·바이오·유통·데이터센터 등 ${CUSTOMERS.length}개 고객사가 12개 산업 현장에서 Monnit을 선택했습니다.</p><ul>`;
  CUSTOMERS.forEach(c => {
    body += `<li><strong>${esc(c.n)}</strong>${c.i ? ` <span class="muted">(${esc(c.i)})</span>` : ''}${c.h ? ` — ${esc(strip(c.h))}` : ''}</li>`;
  });
  body += `</ul><p><a href="${SITE}/pages/cases.html">상세 도입 사례 보기</a></p>`;
  writePage('customers', page({
    slug: 'customers', title: `Monnit 고객사 ${CUSTOMERS.length}곳 — 산업별 도입 현황 | Monnit Korea`,
    desc: `SK하이닉스·삼성SDS·현대건설·카카오 등 ${CUSTOMERS.length}개 고객사의 Monnit 무선 IoT 도입 현황과 적용 내용.`,
    h1: `고객사 — ${CUSTOMERS.length}곳의 선택`,
    bodyHtml: body
  }), 'Monnit 고객사 전체');
})();

/* ---------- 4-3) 수상·인증 ---------- */
(function () {
  if (!AWARDS.length) return;
  const byYear = {};
  AWARDS.forEach(a => { (byYear[a.y] = byYear[a.y] || []).push(a); });
  let body = `<p>2010년 첫 수상 이후 센서·플랫폼·스마트시티 등 9개 분야에서 ${AWARDS.length}회 이상의 글로벌 어워드로 기술력을 인정받았습니다. CE·FCC·KC 등 글로벌 제품 인증 보유.</p>`;
  Object.keys(byYear).sort((x, y) => y - x).forEach(y => {
    body += `<h2>${esc(y)}</h2><ul>` + byYear[y].map(a =>
      `<li><strong>${esc(a.n)}</strong>${a.c ? ` <span class="muted">(${esc(a.c)})</span>` : ''}${a.note ? ` — ${esc(a.note)}` : ''}</li>`).join('') + `</ul>`;
  });
  writePage('awards', page({
    slug: 'awards', title: `Monnit 수상·인증 ${AWARDS.length}건 — 15년 글로벌 IoT 리더십 | Monnit Korea`,
    desc: `IoT Sensor Company of the Year 등 ${AWARDS.length}회 글로벌 수상 기록과 CE·FCC·KC 제품 인증.`,
    h1: '수상·인증 — 매년 더해지는 기록',
    bodyHtml: body
  }), 'Monnit 수상·인증');
})();

/* ---------- 4-4) 글로벌 파트너 ---------- */
(function () {
  if (!PARTNERS.length) return;
  const byRegion = {};
  PARTNERS.forEach(p => { const r = REGION_KO[p.r] || p.r || '기타'; (byRegion[r] = byRegion[r] || []).push(p); });
  let body = `<p>6개 대륙 30여 개국의 파트너 ${PARTNERS.length}곳과 함께 산업용 IoT 솔루션을 공급합니다.</p>`;
  Object.entries(byRegion).forEach(([r, arr]) => {
    body += `<h2>${esc(r)} (${arr.length})</h2><ul>` + arr.map(p =>
      `<li><strong>${esc(p.n)}</strong>${p.d ? ` — ${esc(strip(p.d))}` : ''}</li>`).join('') + `</ul>`;
  });
  body += `<p>파트너 문의: <a href="mailto:korea@monnit.com">korea@monnit.com</a></p>`;
  writePage('partners', page({
    slug: 'partners', title: `Monnit 글로벌 파트너 ${PARTNERS.length}곳 — 6개 대륙 네트워크 | Monnit Korea`,
    desc: `6개 대륙 30여 개국 ${PARTNERS.length}개 파트너와 함께하는 Monnit 글로벌 공급 네트워크.`,
    h1: '글로벌 파트너 네트워크',
    bodyHtml: body
  }), 'Monnit 글로벌 파트너');
})();

/* ---------- 4-5) 기술 지식베이스 (본문 포함) ---------- */
const KB_SLUGS = {};
(function () {
  if (!KNOWLEDGEBASE.length) return;
  const byCat = {};
  KNOWLEDGEBASE.forEach(k => { (byCat[k.category] = byCat[k.category] || []).push(k); });
  let idx = `<p>센서·게이트웨이·iMonnit 설치·설정·문제 해결 기술 문서 ${KNOWLEDGEBASE.length}건. 영문 원문: <a href="https://monnit.crisp.help/en-us/" rel="nofollow">Monnit Knowledge Base</a></p><ul>`;
  Object.entries(byCat).forEach(([cat, arr]) => {
    const slug = 'kb-' + (slugKo(cat) || 'etc');
    KB_SLUGS[cat] = slug;
    idx += `<li><a href="${SITE}/pages/${slug}.html"><strong>${esc(cat)}</strong></a> — ${arr.length}건</li>`;
    let body = `<p class="muted">기술 지식베이스 / ${esc(cat)} · ${arr.length}건</p>`;
    arr.forEach(k => {
      body += `<h2>${esc(k.title)}</h2>${sanitize(k.body || ('<p>' + esc(k.desc || '') + '</p>'))}`;
    });
    body += `<p><a href="${SITE}/pages/knowledgebase.html">← 지식베이스 전체</a></p>`;
    writePage(slug, page({
      slug, title: `${cat} 기술 문서 ${arr.length}건 — Monnit 지식베이스 | Monnit Korea`,
      desc: `Monnit ${cat} 설치·설정·문제 해결 기술 문서 ${arr.length}건 전문.`,
      h1: `지식베이스 — ${cat}`,
      bodyHtml: body
    }), `지식베이스 · ${cat}`);
  });
  idx += `</ul>`;
  writePage('knowledgebase', page({
    slug: 'knowledgebase', title: `Monnit 기술 지식베이스 ${KNOWLEDGEBASE.length}건 — 설치·설정·문제 해결 | Monnit Korea`,
    desc: `센서·게이트웨이·iMonnit 소프트웨어의 설치·설정·문제 해결 한국어 기술 문서 ${KNOWLEDGEBASE.length}건.`,
    h1: '기술 지식베이스',
    bodyHtml: idx
  }), 'Monnit 기술 지식베이스');
})();

/* ---------- 4-6) 제품별 기술지원 가이드 (본문 포함) ---------- */
(function () {
  if (!GUIDES.length) return;
  const byCat = {};
  GUIDES.forEach(g => { (byCat[g.category] = byCat[g.category] || []).push(g); });
  let idx = `<p>제품별 설치·설정·활용 가이드 ${GUIDES.length}건.</p><ul>`;
  Object.entries(byCat).forEach(([cat, arr]) => {
    const slug = 'guide-' + (slugKo(cat) || 'etc');
    idx += `<li><a href="${SITE}/pages/${slug}.html"><strong>${esc(cat)}</strong></a> — ${arr.length}건</li>`;
    let body = `<p class="muted">기술지원 가이드 / ${esc(cat)} · ${arr.length}건</p>`;
    arr.forEach(g => {
      body += `<h2>${esc(g.title)}</h2>${g.sub ? `<p class="muted">${esc(g.sub)}</p>` : ''}${sanitize(g.body || ('<p>' + esc(g.desc || '') + '</p>'))}`;
    });
    body += `<p><a href="${SITE}/pages/guides.html">← 가이드 전체</a></p>`;
    writePage(slug, page({
      slug, title: `${cat} 가이드 ${arr.length}건 — Monnit 기술지원 | Monnit Korea`,
      desc: `Monnit ${cat} 제품의 설치·설정·활용 가이드 ${arr.length}건 전문.`,
      h1: `기술지원 가이드 — ${cat}`,
      bodyHtml: body
    }), `기술지원 · ${cat}`);
  });
  idx += `</ul>`;
  writePage('guides', page({
    slug: 'guides', title: `Monnit 기술지원 가이드 ${GUIDES.length}건 — 제품별 설치·활용 | Monnit Korea`,
    desc: `센서·게이트웨이·소프트웨어·액세서리 제품별 설치·설정·활용 한국어 가이드 ${GUIDES.length}건.`,
    h1: '기술지원 가이드',
    bodyHtml: idx
  }), 'Monnit 기술지원 가이드');
})();

/* ---------- 4-7) 블로그·기술 백서 ---------- */
(function () {
  if (!BLOG.length && !WHITEPAPERS.length) return;
  let body = `<p>현장 적용 노하우, 센서 기술, 예지보전 인사이트. 더 많은 글은 <a href="https://blog.naver.com/monnitkorea" rel="nofollow">Monnit Korea 네이버 블로그</a>에서 확인하세요.</p>`;
  BLOG.forEach(b => {
    body += `<h2>${esc(strip(b.title))}</h2><p class="muted">${esc(b.date || '')}</p><p>${esc(strip(b.body || ''))}</p>${b.url ? `<p><a href="${esc(b.url)}" rel="nofollow">전문 보기</a></p>` : ''}`;
  });
  if (WHITEPAPERS.length) {
    body += `<h2>기술 백서 (Whitepapers)</h2><ul>` + WHITEPAPERS.map(w =>
      `<li><strong>${esc(strip(w.title || w.t || ''))}</strong>${(w.desc || w.d) ? ` — ${esc(strip(w.desc || w.d))}` : ''}</li>`).join('') + `</ul>`;
  }
  writePage('blog', page({
    slug: 'blog', title: '블로그·기술 백서 — Monnit Korea 인사이트',
    desc: '무선 IoT 현장 적용 노하우, 예지보전 인사이트, 신제품 소식과 산업별 기술 백서.',
    h1: '블로그 & 기술 백서',
    bodyHtml: body
  }), 'Monnit 블로그·백서');
})();

/* ---------- 4-8) 프로모션 (이미지 → 텍스트) ---------- */
(function () {
  if (!PROMOS.length) return;
  const act = PROMOS.filter(p => !p.ended), ended = PROMOS.filter(p => p.ended);
  let body = `<p>이미지 배너로 안내되는 프로모션 내용을 텍스트로 제공합니다. 신청·상세: <a href="${SITE}/#promotions">monnit.co.kr 프로모션</a></p>`;
  const block = (p) => `<h2>${esc(strip(p.title))}${p.badge ? ` <span class="muted">[${esc(p.badge)}]</span>` : ''}${p.ended ? ' <span class="muted">(종료)</span>' : ''}</h2>${p.desc ? `<p>${esc(strip(p.desc))}</p>` : ''}${p.period ? `<p class="muted">기간: ${esc(p.period)}</p>` : ''}<p><a href="${SITE}/#promotions/${esc(p.id)}">프로모션 상세·신청 →</a></p>`;
  act.forEach(p => body += block(p));
  if (ended.length) { body += `<h2>종료된 프로모션</h2>`; ended.forEach(p => body += block(p)); }
  writePage('promotions', page({
    slug: 'promotions', title: '프로모션 안내 — Monnit Korea',
    desc: (act.map(p => strip(p.title)).join(' · ') || 'Monnit Korea 프로모션 안내').slice(0, 155),
    h1: '진행 중인 프로모션',
    bodyHtml: body
  }), 'Monnit 프로모션');
})();

/* ---------- 5) 문의 (FAQPage 스키마 포함) ---------- */
writePage('contact', page({
  slug: 'contact', title: '상담·문의 — Monnit Korea 산업용 IoT 솔루션',
  desc: '시설 환경과 관리 목적에 맞는 IoT 모니터링 솔루션을 제안해드립니다. 이메일 korea@monnit.com · 전화 02-2088-1454.',
  h1: '상담·문의',
  jsonld: {
    '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: 'Monnit은 어떤 회사인가요?', acceptedAnswer: { '@type': 'Answer', text: '2010년부터 고정밀 산업용 무선 IoT 센서를 개발해 온 글로벌 기업으로, 130여 개국·64,000여 고객사에 화재·누수·설비·환경 모니터링 솔루션을 공급합니다.' } },
      { '@type': 'Question', name: '어떤 문제를 해결하나요?', acceptedAnswer: { '@type': 'Answer', text: '무선 센서와 통합관제 플랫폼으로 화재·누수·설비 이상·환경 데이터를 실시간 모니터링해 사고를 예방하고, AI 예지보전으로 설비 고장을 사전에 예측하며, 에너지·운영 비용을 절감합니다.' } },
      { '@type': 'Question', name: '상담은 어떻게 신청하나요?', acceptedAnswer: { '@type': 'Answer', text: '이메일 korea@monnit.com 또는 전화 02-2088-1454로 문의하시면 시설 환경에 맞는 IoT 모니터링 솔루션을 제안해드립니다.' } }
    ]
  },
  bodyHtml: `
<p>현장의 위험과 운영 문제, Monnit이 데이터로 해결합니다. 시설 환경과 관리 목적에 맞는 IoT 모니터링 솔루션을 제안해드립니다.</p>
<ul>
<li>이메일: <a href="mailto:korea@monnit.com">korea@monnit.com</a></li>
<li>전화: <a href="tel:0220881454">02-2088-1454</a></li>
<li>상담 신청: <a href="${SITE}/#contact">monnit.co.kr 상담 신청</a></li>
</ul>
<h2>자주 묻는 질문</h2>
<h3>Monnit은 어떤 회사인가요?</h3><p>2010년부터 고정밀 산업용 무선 IoT 센서를 개발해 온 글로벌 기업으로, 130여 개국·64,000여 고객사에 화재·누수·설비·환경 모니터링 솔루션을 공급합니다.</p>
<h3>어떤 문제를 해결하나요?</h3><p>무선 센서와 통합관제 플랫폼으로 화재·누수·설비 이상·환경 데이터를 실시간 모니터링해 사고를 예방하고, AI 예지보전으로 설비 고장을 사전에 예측합니다.</p>
<h3>상담은 어떻게 신청하나요?</h3><p>이메일 korea@monnit.com 또는 전화 02-2088-1454로 문의해 주세요.</p>`
}), '상담·문의');

/* ---------- robots.txt ---------- */
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'CCBot', 'Applebot-Extended', 'Bytespider', 'Amazonbot', 'meta-externalagent', 'cohere-ai'];
let robots = '# Monnit Korea — 모든 검색·AI 크롤러 허용\n';
robots += 'User-agent: *\nAllow: /\n\n';
AI_BOTS.forEach(b => { robots += `User-agent: ${b}\nAllow: /\n\n`; });
robots += `Sitemap: ${SITE}/sitemap.xml\n`;
fs.writeFileSync(path.join(__dirname, 'robots.txt'), robots);

/* ---------- sitemap.xml ---------- */
const urls = [
  { loc: SITE + '/', pri: '1.0' },
  { loc: SITE + '/installation-photos.html', pri: '0.6' },
  ...generated.map(g => ({ loc: g.loc, pri: '0.8' }))
];
let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
urls.forEach(u => { sm += `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><priority>${u.pri}</priority></url>\n`; });
sm += '</urlset>\n';
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sm);

/* ---------- llms.txt (간결) ---------- */
let llms = `# Monnit Korea\n\n> 산업용 무선 IoT 센서와 통합관제 플랫폼으로 화재·누수·설비 이상·환경 데이터를 실시간 모니터링하고 사고를 예방하는 산업용 IoT 전문기업. 2010년 설립, 130여 개국·64,000여 고객사, 하루 750억 건 데이터 처리, 방산 전용 신뢰성.\n\n`;
llms += `## 핵심 정보\n- 회사: Monnit Korea (대표이사 염정훈)\n- 이메일: korea@monnit.com | 전화: 02-2088-1454\n- 사이트: ${SITE}\n\n`;
const CORE_SLUGS = ['company', 'products', 'solutions', 'cases', 'customers', 'awards', 'partners', 'knowledgebase', 'guides', 'blog', 'contact'];
llms += `## 핵심 페이지\n`;
CORE_SLUGS.forEach(s => { const g = generated.find(x => x.loc.endsWith('/pages/' + s + '.html')); if (g) llms += `- [${g.title}](${g.loc})\n`; });
llms += `\n## 활용 분야 상세 (${APPS.length})\n`;
APPS.forEach(a => { llms += `- [${strip(a.name)}](${SITE}/pages/app-${a.id}.html): ${strip(a.desc).slice(0, 90)}\n`; });
llms += `\n## 도입 사례 상세\n`;
Object.keys(CASE_DATA).forEach(id => { const c = CASE_DATA[id]; llms += `- [${strip(c.name || id)} (${strip(c.industry || '')})](${SITE}/pages/case-${id}.html)\n`; });
llms += `\n## 제품군\n- 무선 센서 (온도·진동·누수·전류·공기질 등 80여 종)\n- 게이트웨이 (센서 데이터 수집·전송)\n- 통합관제 소프트웨어 (iMonnit — 실시간 관제·자동제어)\n- 액세서리·연동장치\n\n`;
llms += `## 대표 솔루션\n화재·안전 모니터링 · 설비 예지보전 · 누수·침수 감지 · 환경·공기질 관리 · 에너지 관리 · 대규모 시설 통합관제\n\n`;
llms += `전체 본문 텍스트는 ${SITE}/llms-full.txt 에서 한 번에 읽을 수 있습니다.\n`;
fs.writeFileSync(path.join(__dirname, 'llms.txt'), llms);

/* ---------- llms-full.txt (전체) ---------- */
let full = llms + `\n\n---\n\n# 전체 콘텐츠\n\n## 활용 분야 (${APPS.length})\n`;
Object.entries(CATEGORIES).forEach(([key, info]) => {
  const items = APPS.filter(a => a.cat === key); if (!items.length) return;
  full += `\n### ${info.name}\n`;
  items.forEach(a => {
    full += `\n#### ${strip(a.name)}\nURL: ${SITE}/pages/app-${a.id}.html\n${strip(a.desc)}${a.sensors ? ' [센서: ' + a.sensors + ']' : ''}\n`;
    const d = APP_DETAILS[a.id];
    if (d) {
      (d.snapshot || []).forEach(s => full += `- ${s.label}: ${s.value}${s.desc ? ' — ' + s.desc : ''}\n`);
      if (d.customer) full += `고객 프로필 — ${strip(d.customer.lead || '')} ${(d.customer.paragraphs || []).map(strip).join(' ')}\n`;
      if (d.challenge) { full += `문제점 — ${strip(d.challenge.lead || '')}\n`; (d.challenge.pains || []).forEach(p => full += `- ${p.title}: ${strip(p.desc || '')}\n`); }
      if (d.solution) full += `솔루션 — ${strip(d.solution.lead || '')} ${(d.solution.paragraphs || []).map(strip).join(' ')}\n`;
      if (d.proposal) { full += `도입 절차 — ${strip(d.proposal.lead || '')}\n`; (d.proposal.phases || []).forEach(p => full += `- ${p.tag} ${p.title} (${p.duration || ''}): ${strip(p.desc || '')}\n`); }
      if (d.roi) { full += `ROI — ${strip(d.roi.lead || '')}\n`; (d.roi.metrics || []).forEach(m => full += `- ${m.num}: ${strip(m.desc || '')}\n`); if (d.roi.before) full += `- 도입 전: ${strip(d.roi.before)}\n`; if (d.roi.after) full += `- 도입 후: ${strip(d.roi.after)}\n`; }
    }
    const custs = APP_TO_CUSTOMERS[a.id] || [];
    if (custs.length) full += `도입 고객사: ${custs.join(', ')}\n`;
  });
});
full += `\n## 제품 (${PRODUCTS.length})\n`;
(PRODUCT_CATS || []).forEach(cat => {
  const items = PRODUCTS.filter(p => p.c === cat.id); if (!items.length) return;
  full += `\n### ${CATNAME[cat.id] || cat.ko}\n`;
  items.forEach(p => { full += `- ${p.n}: ${strip(p.d)}\n`; });
});
full += `\n## 도입 사례 (${Object.keys(CASE_DATA).length})\n`;
Object.keys(CASE_DATA).forEach(id => {
  const c = CASE_DATA[id];
  full += `\n### ${strip(c.name || id)} (${strip(c.industry || '')})\nURL: ${SITE}/pages/case-${id}.html\n${strip(c.tagline || '')}\n${c.about ? strip(c.about) + '\n' : ''}`;
  if ((c.challenges || []).length) full += `당면 과제:\n${c.challenges.map(x => '- ' + strip(x)).join('\n')}\n`;
  if ((c.solutions || []).length) full += `적용 솔루션:\n${c.solutions.map(x => `- ${x.t}: ${strip(x.d || '')}`).join('\n')}\n`;
  if ((c.results || []).length) full += `성과:\n${c.results.map(x => `- ${x.n} ${x.l}`).join('\n')}\n`;
  if ((c.qs || []).length) full += `핵심 지표:\n${c.qs.map(x => `- ${x.n} ${x.l}`).join('\n')}\n`;
  if (c.quote) full += `> "${strip(c.quote)}" — ${c.cite || ''}\n`;
});
if (CUSTOMERS.length) {
  full += `\n## 고객사 (${CUSTOMERS.length})\n`;
  CUSTOMERS.forEach(c => full += `- ${c.n}${c.i ? ' (' + c.i + ')' : ''}${c.h ? ': ' + strip(c.h) : ''}\n`);
}
if (AWARDS.length) {
  full += `\n## 수상·인증 (${AWARDS.length})\n`;
  AWARDS.forEach(a => full += `- [${a.y}] ${a.n}${a.c ? ' (' + a.c + ')' : ''}${a.note ? ' — ' + a.note : ''}\n`);
}
if (PARTNERS.length) {
  full += `\n## 글로벌 파트너 (${PARTNERS.length})\n`;
  PARTNERS.forEach(p => full += `- ${p.n} [${REGION_KO[p.r] || p.r || ''}]${p.d ? ': ' + strip(p.d) : ''}\n`);
}
if (PROMOS.length) {
  full += `\n## 프로모션 (${PROMOS.length})\n`;
  PROMOS.forEach(p => full += `- ${p.title}${p.ended ? ' (종료)' : ''}${p.period ? ' | 기간: ' + p.period : ''}${p.desc ? ': ' + p.desc.replace(/\s+/g, ' ').trim() : ''}\n`);
}
if (KNOWLEDGEBASE.length) {
  full += `\n## 기술 지식베이스 (${KNOWLEDGEBASE.length}) — 전문 포함\n`;
  const kbByCat = {};
  KNOWLEDGEBASE.forEach(k => { (kbByCat[k.category] = kbByCat[k.category] || []).push(k); });
  Object.entries(kbByCat).forEach(([cat, arr]) => {
    full += `\n### ${cat}\n`;
    arr.forEach(k => { full += `\n#### ${k.title}\n${strip(sanitize(k.body || k.desc || ''))}\n`; });
  });
}
if (GUIDES.length) {
  full += `\n## 기술지원 가이드 (${GUIDES.length}) — 목차\n`;
  const gByCat = {};
  GUIDES.forEach(g => { (gByCat[g.category] = gByCat[g.category] || []).push(g); });
  Object.entries(gByCat).forEach(([cat, arr]) => {
    full += `\n### ${cat} (${SITE}/pages/guide-${slugKo(cat) || 'etc'}.html)\n`;
    arr.forEach(g => full += `- ${g.title}${g.desc ? ': ' + strip(g.desc).slice(0, 100) : ''}\n`);
  });
}
fs.writeFileSync(path.join(__dirname, 'llms-full.txt'), full);

console.log(`[build] 완료 — 정적 페이지 ${generated.length}개, robots.txt, sitemap.xml(${urls.length} URL), llms.txt, llms-full.txt`);
console.log('[build] 데이터: APPS', APPS.length, '| PRODUCTS', PRODUCTS.length, '| CASES', Object.keys(CASE_DATA).length, '| PROMOS', PROMOS.length, '| 상세', Object.keys(APP_DETAILS).length);
})().catch(e => { console.error('[build] 실패:', e); process.exit(1); });
