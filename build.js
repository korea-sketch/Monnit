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
    PROMOS: D.Promotions.filter(r => r.title).map(r => ({ id: r.id || '', title: r.title, period: r.period || '', badge: r.badge || '', ended: /^(true|1)$/i.test(r.ended || ''), desc: r.desc || '', link: r.link || '', order: r.order || '' }))
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
let PROMOS = __src ? __src.PROMOS : (extract('let PROMOS =') || []);
/* app.js 의 내장 프로모션(시트에 없는 항목)을 정적 페이지에도 반영 */
const BUILTIN_PROMOS = extract('const BUILTIN_PROMOS =') || [];
BUILTIN_PROMOS.forEach(b => { if (!PROMOS.some(p => p.id === b.id)) PROMOS.push(b); });
PROMOS = PROMOS.sort((a, b) => (parseInt(a.order,10)||999) - (parseInt(b.order,10)||999));

/* ---------- data.js 에서 지식베이스/가이드 로드 ---------- */
let KNOWLEDGEBASE = [], GUIDES = [];
try {
  const DATAJS = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  /* data.js 는 브라우저용이라 값을 window.__KB_BASE / window.GUIDES 에 담는다.
     Node 에는 window 가 없어 예전 코드는 "window is not defined" 로 통째로 실패했고,
     그 결과 knowledgebase, guides, kb- 및 guide- 계열 15개 페이지가 생성되지 않았다.
     생성되지 않은 pages 하위 html 은 아래 정리 단계에서 삭제되므로 배포본이 404 가 됐다.
     window/document 를 흉내 낸 샌드박스를 넣어 값만 안전하게 꺼낸다. */
  const win = {};
  const doc = {
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    head: { appendChild() {} }, body: { appendChild() {} }
  };
  (new Function('window', 'self', 'globalThis', 'document', 'location', 'navigator', DATAJS))(
    win, win, win, doc, { href: '', hostname: '' }, { userAgent: '' }
  );
  KNOWLEDGEBASE = win.__KB_BASE || win.KNOWLEDGEBASE || [];
  GUIDES        = win.GUIDES    || [];
  console.log(`[build] data.js 로드 OK — 지식베이스 ${KNOWLEDGEBASE.length}건, 가이드 ${GUIDES.length}건`);
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

/* ═══════════════════════════════════════════════════════════════════
   SSG — 경로마다 완전한 HTML 파일을 만듭니다 (2026-07 path 라우팅 전환)
   · /pages/app-temp.html  →  /app/temp/index.html
   · 이름이 달랐던 정적 슬러그를 SPA 라우트 이름으로 통일합니다
     company→who-we-are · solutions→applications · cases→stories
   · 각 파일은 index.html(SPA 껍데기)에 그 경로의 제목·설명·본문을 넣은 것이라
     크롤러는 바로 읽고, 사람은 그 위에서 SPA 로 이어집니다.
   ═══════════════════════════════════════════════════════════════════ */
let _lastParts = null;
const SLUG_ROUTE = {
  company:'who-we-are', solutions:'applications', cases:'stories',
  customers:'customers', products:'products', partners:'partners', awards:'awards',
  blog:'blog', knowledgebase:'knowledgebase', guides:'guides',
  contact:'contact', promotions:'promotions'
};
function slugToRoute(slug){
  if (slug.indexOf('app-')===0)   return 'app/'   + slug.slice(4);
  if (slug.indexOf('case-')===0)  return 'case/'  + slug.slice(5);
  if (slug.indexOf('kb-')===0)    return 'kb/'    + slug.slice(3);
  if (slug.indexOf('guide-')===0) return 'guide/' + slug.slice(6);
  return SLUG_ROUTE[slug] || slug;
}
const slugToPath = slug => '/' + slugToRoute(slug);

/* 본문 안의 예전 주소를 새 경로로 바꿉니다 (정적 페이지끼리 서로 거는 링크) */
function fixLinks(html){
  return String(html || '')
    .replace(/\/pages\/app-([a-z0-9-]+)\.html/gi,   '/app/$1')
    .replace(/\/pages\/case-([a-z0-9-]+)\.html/gi,  '/case/$1')
    .replace(/\/pages\/kb-([a-z0-9-]+)\.html/gi,    '/kb/$1')
    .replace(/\/pages\/guide-([a-z0-9-]+)\.html/gi, '/guide/$1')
    .replace(/\/pages\/company\.html/gi,    '/who-we-are')
    .replace(/\/pages\/solutions\.html/gi,  '/applications')
    .replace(/\/pages\/cases\.html/gi,      '/stories')
    .replace(/\/pages\/([a-z0-9-]+)\.html/gi, '/$1')
    .replace(/\/#(app|case|kb|guide|promotions)\//g, '/$1/')
    .replace(/\/#([a-z-]+)/g, '/$1')
    /* 같은 페이지를 다시 가리키는 "인터랙티브 버전 보기" 안내는 뺍니다 */
    .replace(/\s*·\s*<a href="[^"]*">인터랙티브 버전 보기<\/a>/g, '');
}

/* index.html 껍데기를 읽어 경로별 SEO 머리말과 본문을 심습니다 */
let SHELL = '';
try { SHELL = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); }
catch (e) { console.warn('[build] index.html 을 읽지 못해 SSG 를 건너뜁니다'); }

/* ═══════════════════════════════════════════════════════════════════
   공통 셸(SPA 뷰 19개) 격납 — 페이지 간 중복 콘텐츠 제거
   ───────────────────────────────────────────────────────────────────
   index.html 에는 홈·제품·활용분야·회사소개 등 모든 화면이 통째로 들어 있습니다.
   SSG 페이지는 이 껍데기를 재사용하므로, 지금까지 모든 경로가 서로 98% 동일한
   HTML 을 내보내 크롤러가 중복으로 판정했습니다.

   그래서 크롤러가 받는 HTML 에서는 <section class="view"> 19개를 통째로 빼
   <script type="text/html"> 안에 넣습니다. 스크립트 내용은 문서 텍스트로 취급되지
   않으므로 각 페이지에는 [네비게이션 + 그 페이지 고유 본문(#ssg-content) + 푸터]
   만 남습니다.

   브라우저에서는 바로 아래 부트스트랩이 app.js 보다 먼저 실행돼 원래 DOM 을
   <main> 안에 그대로 복원합니다. createContextualFragment 를 쓰므로 뷰 안의
   인라인 <script>(홈 솔루션 파인더 등)도 정상 실행됩니다. 즉 사람이 보는 화면과
   SPA 동작은 이전과 완전히 동일합니다.

   ※ index.html(홈) 자체는 건드리지 않습니다 — 홈은 뷰가 그대로 있어야 합니다.
   ═══════════════════════════════════════════════════════════════════ */
function stashShellViews(html){
  const lines = html.split('\n');
  const kept = [], stash = [];
  let buf = null;
  for (const ln of lines){
    if (buf === null){
      if (/^<section class="view[ "]/.test(ln)) { buf = [ln]; continue; }
      kept.push(ln);
      continue;
    }
    buf.push(ln);
    if (/^<\/section>/.test(ln)) { stash.push(buf.join('\n')); buf = null; }
  }
  /* 파싱이 어긋나면(껍데기 구조 변경 등) 아무것도 하지 않고 원본을 그대로 씁니다 */
  if (buf !== null || !stash.length) return html;

  let out = kept.join('\n');
  if (out.indexOf('</main>') < 0) return html;

  /* 스크립트 안에 들어가므로 </script> 시퀀스만 무해화 (복원 시 되돌립니다) */
  const payload = stash.join('\n').replace(/<\/script/gi, '<\\/script');

  const boot =
    '\n<!-- SPA 화면 원본 — 아래 스크립트가 app.js 보다 먼저 <main> 으로 복원합니다 -->\n'
    + '<script type="text/html" id="mk-shell-views">' + payload + '</script>\n'
    + '<script>(function(){'
    +   'var b=document.getElementById("mk-shell-views"),m=document.querySelector("main");'
    +   'if(!b||!m)return;'
    +   'var h=b.textContent.replace(/<\\\\\\/script/g,"<\\/script");'
    +   'var t=document.createElement("div");t.innerHTML=h;'
    /* innerHTML 로 만든 <script> 는 실행되지 않으므로, 삽입 뒤 새 script 로 교체해
       원래처럼 실행시킵니다 (홈 솔루션 파인더 등 뷰 안 인라인 스크립트 3개) */
    +   'var s=[].slice.call(t.querySelectorAll("script"));'
    +   'while(t.firstChild)m.appendChild(t.firstChild);'
    +   'for(var i=0;i<s.length;i++){var o=s[i],n=document.createElement("script"),k;'
    +     'for(k=0;k<o.attributes.length;k++)n.setAttribute(o.attributes[k].name,o.attributes[k].value);'
    +     'n.text=o.textContent;'
    +     'if(o.parentNode)o.parentNode.replaceChild(n,o);}'
    +   'if(b.parentNode)b.parentNode.removeChild(b);'
    + '})();</script>\n';

  return out.replace('</main>', '</main>' + boot);
}

function ssgWrite(slug, parts){
  if (!SHELL || !parts) return;
  const route = slugToRoute(slug);
  const url   = SITE + '/' + route;
  const title = String(parts.title || '');
  const desc  = String(parts.desc  || '');
  let h = SHELL;
  const set = (re, val) => { h = h.replace(re, val); };
  set(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>');
  set(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(desc) + '">');
  set(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
  set(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(title) + '">');
  set(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(desc) + '">');
  set(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">');
  set(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(title) + '">');
  set(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(desc) + '">');
  if (parts.jsonld){
    h = h.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(parts.jsonld) + '</script>\n</head>');
  }
  /* 크롤러가 바로 읽는 본문 — SPA 가 뜨면 app.js 가 이 블록을 지웁니다 */
  const block = '<div id="ssg-content" data-route="' + route + '">'
    + '<h1>' + esc(parts.h1 || title) + '</h1>' + fixLinks(parts.bodyHtml || '')
    + '</div>';
  h = h.replace('<body>', '<body>\n' + block);
  h = stashShellViews(h);            // 페이지 간 중복(공통 셸) 제거
  const dir = path.join(__dirname, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), h);
  ssgCount++;
}
let ssgCount = 0;

function page({ slug, title, desc, h1, bodyHtml, jsonld }) {
  _lastParts = { slug, title, desc, h1, bodyHtml, jsonld };
  const url = SITE + slugToPath(slug);   // canonical 은 항상 새 경로
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T8H73VW');</script>
<script>
(function(){var G='G-49THHRYKR4';var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+G;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',G);
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script','x38egtft64');})();
</script>
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
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T8H73VW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="crumb"><a href="${SITE}/">Monnit Korea</a> / ${esc(title.split('—')[0].trim())}</nav>
<a class="back" href="${SITE}/">← 메인으로</a>
<h1>${esc(h1)}</h1>
${fixLinks(bodyHtml)}
<hr style="margin:40px 0;border:none;border-top:1px solid #e5e8ef">
<p class="muted">이 페이지는 검색·AI 크롤러를 위한 정적 콘텐츠 버전입니다. 인터랙티브 버전은 <a href="${SITE}/">monnit.co.kr</a> 에서 확인하세요.</p>
<p class="muted">문의: <a href="mailto:korea@monnit.com">korea@monnit.com</a> · 02-2088-1454</p>
</body>
</html>`;
}

if (!fs.existsSync(OUT_PAGES)) fs.mkdirSync(OUT_PAGES);
const generated = [];   // {loc, title}
function writePage(slug, html, title) {
  fs.writeFileSync(path.join(OUT_PAGES, slug + '.html'), html);   // 예전 주소 (301 로 새 경로에 넘깁니다)
  ssgWrite(slug, _lastParts);                                      // 새 경로에 완전한 HTML
  generated.push({ loc: SITE + slugToPath(slug), title, slug });
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
<p><a href="${SITE}/products">제품 전체 보기</a> · <a href="${SITE}/applications">활용 분야</a> · <a href="${SITE}/stories">도입 사례</a></p>`
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
    items.forEach(a => { body += `<li><a href="${SITE}/app/${esc(a.id)}"><strong>${esc(a.name)}</strong></a> — ${esc(a.desc)}${a.sensors ? ` <span class="muted">[${esc(a.sensors)}]</span>` : ''}</li>`; });
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
    idx += `<li><a href="${SITE}/case/${esc(id)}"><strong>${esc(c.name || id)}</strong></a> — ${esc(strip(c.tagline || ''))}</li>`;
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
<p><a href="${SITE}/stories">← 전체 도입 사례</a></p>`;
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
    body += `<p><a href="${SITE}/applications">← 활용 분야 전체</a> · <a href="${SITE}/contact">상담·문의</a></p>`;

    writePage('app-' + a.id, page({
      slug: 'app-' + a.id,
      title: `${strip(a.name)} — 무선 IoT 모니터링 솔루션 | Monnit Korea`,
      desc: (strip(a.desc) + (a.sensors ? ' 적용 센서: ' + a.sensors + '.' : '')).slice(0, 158),
      h1: strip(a.name),
      jsonld: {
        '@context': 'https://schema.org', '@type': 'Service',
        name: strip(a.name) + ' — 무선 IoT 모니터링', serviceType: strip(a.name),
        description: strip(a.desc), provider: ORG_LD, areaServed: 'KR',
        url: SITE + '/app/' + a.id
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
  body += `</ul><p><a href="${SITE}/stories">상세 도입 사례 보기</a></p>`;
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
    idx += `<li><a href="${SITE}${slugToPath(slug)}"><strong>${esc(cat)}</strong></a> — ${arr.length}건</li>`;
    let body = `<p class="muted">기술 지식베이스 / ${esc(cat)} · ${arr.length}건</p>`;
    arr.forEach(k => {
      body += `<h2>${esc(k.title)}</h2>${sanitize(k.body || ('<p>' + esc(k.desc || '') + '</p>'))}`;
    });
    body += `<p><a href="${SITE}/knowledgebase">← 지식베이스 전체</a></p>`;
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
    idx += `<li><a href="${SITE}${slugToPath(slug)}"><strong>${esc(cat)}</strong></a> — ${arr.length}건</li>`;
    let body = `<p class="muted">기술지원 가이드 / ${esc(cat)} · ${arr.length}건</p>`;
    arr.forEach(g => {
      body += `<h2>${esc(g.title)}</h2>${g.sub ? `<p class="muted">${esc(g.sub)}</p>` : ''}${sanitize(g.body || ('<p>' + esc(g.desc || '') + '</p>'))}`;
    });
    body += `<p><a href="${SITE}/guides">← 가이드 전체</a></p>`;
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
  const block = (p) => `<h2>${esc(strip(p.title))}${p.badge ? ` <span class="muted">[${esc(p.badge)}]</span>` : ''}${p.ended ? ' <span class="muted">(종료)</span>' : ''}</h2>${p.desc ? `<p>${esc(strip(p.desc))}</p>` : ''}${p.period ? `<p class="muted">기간: ${esc(p.period)}</p>` : ''}<p><a href="${p.link ? (p.link.indexOf('http')===0 ? p.link : SITE + p.link) : SITE + '/promotions/' + esc(p.id)}">프로모션 상세·신청 →</a></p>`;
  act.forEach(p => body += block(p));
  if (ended.length) { body += `<h2>종료된 프로모션</h2>`; ended.forEach(p => body += block(p)); }
  writePage('promotions', page({
    slug: 'promotions', title: '프로모션 안내 — Monnit Korea',
    desc: (act.map(p => strip(p.title)).join(' · ') || 'Monnit Korea 프로모션 안내').slice(0, 155),
    h1: '진행 중인 프로모션',
    bodyHtml: body
  }), 'Monnit 프로모션');
})();

/* ═══════════════════════════════════════════════════════════════════
   4-8-b) 프로모션 상세 — slug 별 정적 페이지 생성
   ───────────────────────────────────────────────────────────────────
   지금까지 /promotions/fire · /promotions/church 등은 모두 promo.html 한 장을
   그대로 받아, URL 만 다르고 HTML 이 완전히 동일했습니다.
     · title / description   : 전부 "Monnit Korea 프로모션"
     · og:image              : 전부 promo-fire.jpg (교회 프로모션도 화재 이미지)
     · canonical             : 없음
     · 본문                  : JS 가 URL 을 읽어 클라이언트에서 주입
   크롤러는 JS 실행 전 HTML 만 보므로 7개가 같은 빈 페이지 1개로 보였습니다.
   → slug 별로 고유 메타와 정적 본문을 서버에서 미리 박아 파일로 내보냅니다.
      (promo.html 의 폼·디자인·시트 연동은 그대로 유지)
   ═══════════════════════════════════════════════════════════════════ */
const PROMO_SEO = {
  fire: {
    title: '물류센터 화재 사전예방 알리미 — 0.1초 화재 감지',
    desc: '물류센터·창고 화재 징후를 0.1초 안에 감지해 담당자 휴대폰으로 즉시 알립니다. 배선 공사 없이 15분 설치, 배터리 최대 10년. 무료 현장 진단 신청.',
    img: '/images/promo-fire.jpg'
  },
  flame: {
    title: '무선 불꽃감지기 출시 특가 — 화재 징조 즉시 대처',
    desc: '초정밀 무선 불꽃감지기 출시 특가 프로모션. 불꽃 파장을 직접 감지해 연기가 퍼지기 전에 알립니다. 무선이라 기존 설비를 건드리지 않고 설치합니다.',
    img: '/images/promo-flame.webp'
  },
  water: {
    title: '실시간 침수 알리미 — 누수·침수 사전 감지',
    desc: '전기실·기계실·서버실의 누수와 침수를 사전 감지해 피해를 최소화합니다. 물이 닿는 즉시 SMS·이메일 알림, 무선 설치로 공사 부담이 없습니다.',
    img: '/images/promo-water.webp'
  },
  elect: {
    title: '실시간 정전 알리미 — 정전·차단기 트립 즉시 통보',
    desc: '정전과 차단기 트립을 실시간 모니터링해 즉시 알립니다. 무인 시간대 정전으로 인한 냉동·냉장 손실, 설비 정지 피해를 막습니다.',
    img: '/images/promo-elect.webp'
  },
  church: {
    title: '스마트 교회 알리미 — 24시간 무인 시간대 감시',
    desc: '주중 무인 시간대의 화재·누수·동파·정전을 24시간 감시해 담당 집사님 휴대폰으로 바로 알립니다. 배선 공사 없이 설치, 배터리로 수년간 동작합니다.',
    img: '/images/promo-church.webp'
  },
  soil: {
    title: '산사태 사전예방 — 토양 수분·경사 변위 계측',
    desc: '사면·절개지의 토양 수분과 경사 변위를 무선으로 계측해 산사태 징후를 사전에 포착합니다. 전원·통신이 없는 현장에도 설치할 수 있습니다.',
    img: '/images/promo-soil.webp'
  }
};

const promoPages = [];   // sitemap 용
(function () {
  let TPL = '';
  try { TPL = fs.readFileSync(path.join(__dirname, 'promo.html'), 'utf8'); }
  catch (e) { console.warn('[build] promo.html 을 읽지 못해 프로모션 정적 페이지를 건너뜁니다'); return; }

  /* 시트(PROMOS) 값이 있으면 우선, 없으면 위 PROMO_SEO 를 씁니다.
     link 가 외부/전용 랜딩(예: consulting → /promo/consulting)인 프로모션은
     이미 자기 페이지가 있으므로 여기서 만들지 않습니다. */
  const ids = new Set(Object.keys(PROMO_SEO));
  PROMOS.forEach(p => { if (p.id && !/^https?:/i.test(p.link || '') && !(p.link || '').startsWith('/promo-') && !(p.link || '').startsWith('/promo/')) ids.add(p.id); });

  ids.forEach(id => {
    const seo   = PROMO_SEO[id] || {};
    const sheet = PROMOS.find(p => p.id === id) || {};
    const title = strip(sheet.title || seo.title || 'Monnit 프로모션');
    const desc  = strip(sheet.desc  || seo.desc  || 'Monnit 무선 IoT 알리미 프로모션 — 실시간 감지·즉시 알림. 공사 없이 15분 설치.');
    const img   = seo.img || '/images/promo-' + id + '.webp';
    const url   = SITE + '/promotions/' + id;
    const fullTitle = title + ' | Monnit Korea';
    const ended = !!sheet.ended;

    let h = TPL;
    h = h.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(fullTitle) + '</title>');
    h = h.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(desc) + '">');
    h = h.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(fullTitle) + '">');
    h = h.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(desc) + '">');
    h = h.replace(/<meta property="og:image" content="[^"]*">/,
      '<meta property="og:image" content="' + SITE + img + '">\n'
      + '<meta property="og:url" content="' + url + '">\n'
      + '<link rel="canonical" href="' + url + '">\n'
      + '<meta name="twitter:card" content="summary_large_image">\n'
      + '<meta name="twitter:title" content="' + esc(fullTitle) + '">\n'
      + '<meta name="twitter:description" content="' + esc(desc) + '">');
    /* 종료된 프로모션은 색인에서 빼되 링크는 따라가게 둡니다 */
    if (ended) h = h.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex,follow">');

    /* 크롤러가 JS 없이 바로 읽는 본문 — SPA/스크립트가 그리기 전에 존재합니다 */
    const seoBlock = '<div id="promo-ssg" data-promo="' + esc(id) + '">'
      + '<h1>' + esc(title) + '</h1>'
      + '<p>' + esc(desc) + '</p>'
      + (sheet.period ? '<p>기간: ' + esc(strip(sheet.period)) + '</p>' : '')
      + (ended ? '<p>이 프로모션은 종료되었습니다.</p>' : '')
      + '<ul>'
      +   '<li>배선 공사 없이 약 15분 설치 — 기존 설비를 건드리지 않습니다</li>'
      +   '<li>이상 감지 시 SMS·이메일·전화로 즉시 알림</li>'
      +   '<li>배터리 최대 10년 · Encrypt-RF® 암호화 무선 통신</li>'
      + '</ul>'
      + '<p>문의: <a href="mailto:korea@monnit.com">korea@monnit.com</a> · '
      +   '<a href="tel:0220881454">02-2088-1454</a> · '
      +   '<a href="' + SITE + '/promotions">전체 프로모션</a></p>'
      + '</div>'
      /* 사람이 볼 때는 아래 실제 랜딩이 이 블록을 대체합니다 */
      + '<script>(function(){var b=document.getElementById("promo-ssg");if(b&&b.parentNode)b.parentNode.removeChild(b);})();</script>';

    h = h.replace('<body>', '<body>\n' + seoBlock);

    const dir = path.join(__dirname, 'promotions', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), h);
    if (!ended) promoPages.push({ loc: url, pri: '0.7' });
  });
  console.log(`[build] 프로모션 상세 정적 페이지 ${ids.size}개 생성 (/promotions/*)`);
})();

/* ═══════════════════════════════════════════════════════════════════
   4-9) SPA 전용이던 5개 화면을 정적 페이지로 승격
   ───────────────────────────────────────────────────────────────────
   /our-solution · /what-we-do · /faqs · /whitepaper · /newsletter 는
   _redirects 에서 index.html 을 그대로 내보내고 있었습니다. 그래서 5개 모두
   title·description·canonical 이 홈페이지 값(canonical=https://monnit.co.kr/)
   이었고, 구글은 "이 URL 의 정본은 홈"으로 해석해 홈에 통합했습니다.
   → 다른 11개 라우트와 동일하게 고유 메타 + 고유 본문을 갖도록 생성합니다.
   (아래 writePage 가 실제 파일을 만들면 _redirects 의 SPA 폴백보다 우선합니다)
   ═══════════════════════════════════════════════════════════════════ */

/* --- 4-9-1) 솔루션 --- */
writePage('our-solution', page({
  slug: 'our-solution',
  title: 'Monnit 솔루션 — 감지·분석·자동제어 통합 플랫폼',
  desc: '무선 센서로 수집한 온도·진동·전류 데이터를 AI가 분석해 이상을 예측하고, 엣지 게이트웨이가 서버 없이 설비를 직접 제어합니다. 통신 거리·보안·배터리 핵심 사양과 실제 관제 대시보드를 확인하세요.',
  h1: '감지하고, 분석하고, 스스로 제어합니다',
  jsonld: ORG_LD,
  bodyHtml: `
<p>현장의 온도·진동·전류 같은 데이터를 무선으로 수집하고, AI가 분석해 이상을 예측하며, 필요하면 설비를 자동으로 제어합니다.</p>

<h2>어떻게 작동하는가 — Sense → Transmit → Act</h2>
<h3>01 · SENSE — 80종 이상의 무선 센서</h3>
<p>온도·진동·전류·가스 등 현장 물리량을 FHSS 무선으로 측정합니다. AES-128 암호화와 센서 자체 로컬 저장을 지원합니다.</p>
<h3>02 · TRANSMIT — 게이트웨이</h3>
<p>다수 센서의 데이터를 암호화·수집해 전송합니다. 통신이 끊겨도 오프라인 버퍼가 데이터를 보호하고, MQTT 멀티 클라우드 연동과 FOTA 펌웨어 업데이트를 지원합니다. PoE·WiFi 센서는 게이트웨이 없이도 동작합니다.</p>
<h3>03 · ACT — 플랫폼 · AI</h3>
<p>분석·알림·AI 예지보전·자동제어를 수행합니다. 엣지 게이트웨이는 서버 없이 BMS/BACnet 설비를 직접 제어하고, REST API 로 기존 시스템과 연동합니다.</p>

<h2>핵심 사양</h2>
<h3>무선 성능 · 연동</h3>
<ul>
<li>통신 거리 — 실내 최대 약 600m (구조물·층간 환경에 따라 변동)</li>
<li>RF 기술 — Sub-GHz FHSS</li>
<li>센서 연결 — 게이트웨이 모델별 다수 센서 연결</li>
<li>데이터 로깅 — 센서·게이트웨이 로컬 저장</li>
<li>외부 연동 — REST API · MQTT · Webhook · JSON/XML · Modbus TCP</li>
</ul>
<h3>보안 · 인증</h3>
<ul>
<li>키 교환 — 256-bit Key Exchange</li>
<li>데이터 암호화 — AES-128 CTR</li>
<li>보안 체계 — Encrypt-RF®</li>
<li>계정 보안 — 2단계 인증(2FA) 지원</li>
<li>펌웨어 — OTA/FOTA 업데이트 지원</li>
<li>인증 — FCC · IC · CE/ETSI · 방폭 모델 별도 지원</li>
</ul>
<h3>배터리 · 전력</h3>
<ul>
<li>최장 수명 — AA 타입 기준 최대 10년 이상</li>
<li>배터리 타입 — AA / 코인셀 / 산업용 리튬</li>
<li>잔량 확인 — 배터리 잔량 모니터링 · 저잔량 알림</li>
<li>설치 방식 — 배선 부담을 줄인 무선 설치</li>
</ul>
<p class="muted">※ 통신 거리, 배터리 수명, 센서 연결 수, 인증 항목은 모델 및 현장 환경에 따라 달라질 수 있습니다.</p>

<h2>현장 통합 대시보드 (iMonnit)</h2>
<ul>
<li>HVAC 예지보전 — 공조 설비 상태와 에너지 효율을 함께 감시</li>
<li>진동 예지보전 — 회전설비 진동을 ISO 20816-3 기준으로 AI 진단(불균형·정렬불량·베어링 결함 등)</li>
<li>현장 통합관제 — 자산별 정상/경고/위험 상태를 한 화면에서 관리</li>
</ul>
<p><a href="${SITE}/products">제품군 보기</a> · <a href="${SITE}/applications">활용 분야 보기</a> · <a href="${SITE}/contact">상담·문의</a></p>`
}), 'Monnit 솔루션');

/* --- 4-9-2) 사업 영역 --- */
writePage('what-we-do', page({
  slug: 'what-we-do',
  title: 'Monnit 사업 영역 — 커스텀 센서 제작부터 SI까지',
  desc: '국방·오일가스·발전·데이터센터 등 8개 산업 대상. OEM/ODM 무선 센서 제작, 커스텀 소프트웨어 개발, 예지보전 패트롤, 레거시 관제 연동 등 6대 서비스를 제공합니다.',
  h1: '현장이 필요로 하는 모든 것을 합니다',
  jsonld: ORG_LD,
  bodyHtml: `
<p>단순 센서 공급을 넘어, 컨설팅부터 커스텀 제작·소프트웨어 개발·시스템 연동·예지보전까지 산업 IoT의 전 과정을 책임집니다.</p>

<h2>사업 영역 — Industries we serve</h2>
<ul>
<li><strong>국방</strong> — 미군 부대 핵심 전략 자산 모니터링</li>
<li><strong>오일가스</strong> — 정유·석유화학 설비 안전 감시</li>
<li><strong>발전소</strong> — 전력 생산 설비 상태 진단</li>
<li><strong>데이터센터</strong> — 온습도·전력·누수 통합 관제</li>
<li><strong>인프라</strong> — 고속도로·기차·공항·항만·댐·공공시설</li>
<li><strong>대형 상업건물</strong> — 스마트 빌딩 에너지·환경 관리</li>
<li><strong>물류창고</strong> — 콜드체인·재고 환경 모니터링</li>
<li><strong>생산시설</strong> — 반도체·제약·자동차 등 정밀 생산 라인</li>
</ul>

<h2>주요 서비스 — Core services</h2>
<h3>01. 맞춤형 무선 센서 제작 (OEM · ODM)</h3><p>자동 제어가 가능한 커스텀 무선 센서를 현장 요구에 맞춰 설계·제작합니다.</p>
<h3>02. 프로젝트별 소프트웨어 커스텀 개발</h3><p>대시보드·관제·자동화 로직을 프로젝트 단위로 맞춤 구현합니다.</p>
<h3>03. 설비 예지보전 패트롤 서비스</h3><p>진동·온도 데이터를 기반으로 한 정기 점검 패트롤로 고장을 사전에 차단합니다.</p>
<h3>04. 레거시 및 관제 시스템 연동 (SI)</h3><p>기존 관제·SCADA·MES 시스템과 ALTA 데이터를 매끄럽게 통합합니다.</p>
<h3>05. AI 분석용 맞춤형 빅데이터 제공 · 분석</h3><p>AI 예지보전을 위한 정제된 데이터 셋을 구축하고 분석 모델을 제공합니다.</p>
<h3>06. 전문 컨설팅 기반 솔루션 제안</h3><p>현장을 이해하는 엔지니어가 직접 진단하고 최적의 해결책과 솔루션을 제시합니다.</p>
<p><a href="${SITE}/who-we-are">회사 소개</a> · <a href="${SITE}/stories">도입 사례</a> · <a href="${SITE}/contact">상담·문의</a></p>`
}), 'Monnit 사업 영역');

/* --- 4-9-3) FAQ (FAQPage 스키마) --- */
const FAQ_ITEMS = [
  ['센서 무선 통신 거리는 얼마나 되나요?', 'ALTA 무선 센서는 비가시선 기준 벽 12장을 관통해 1,200ft 이상, ALTA XL 게이트웨이 사용 시 벽 18장 관통 2,000ft 이상까지 통신합니다. 안테나 방향과 설치 환경에 따라 최적 성능이 달라집니다.'],
  ['센서 배터리는 얼마나 가나요?', '사용 환경에 따라 다르지만, 단일 AA 배터리로 최대 10년 이상 사용 가능합니다. 데이터 전송 주기(하트비트), 통신 거리, 장애물 수가 수명에 영향을 줍니다. 배터리 잔량은 iMonnit에서 백분율로 확인할 수 있고, 설정 임계값 이하가 되면 알림을 받을 수 있습니다.'],
  ['인터넷이 끊기면 데이터가 사라지나요?', '아닙니다. 게이트웨이 연결이 끊겨도 센서가 자체적으로 최대 4,000건의 측정값을 저장하며, 연결이 복구되면 누락 없이 전송합니다. 게이트웨이 역시 내부 메모리에 다수의 메시지를 저장합니다.'],
  ['데이터 보안은 어떻게 보장되나요?', 'Encrypt-RF® 기술로 256-bit ECDH 키 교환과 AES-128 암호화를 적용해 센서~게이트웨이 구간을 보안 터널로 보호합니다. 또한 패킷 변조 검증 루틴으로 위·변조 및 재전송 공격을 차단합니다.'],
  ['알림은 어떤 방식으로 받나요?', '사용자가 설정한 조건을 초과하면 iMonnit이 SMS 문자, 이메일, 전화로 즉시 알림을 보냅니다. 임계값과 수신자는 자유롭게 설정할 수 있습니다.'],
  ['설치와 설정은 어렵지 않나요?', '대부분의 ALTA 센서는 전원을 켜는 즉시 게이트웨이에 연결되는 플러그앤플레이 방식으로, 시스템 구성에 보통 15분이면 충분합니다. Monnit Korea가 현장 설치와 초기 설정을 지원합니다.']
];
writePage('faqs', page({
  slug: 'faqs',
  title: 'Monnit 자주 묻는 질문 — 통신 거리·배터리·보안',
  desc: '무선 통신 거리, 배터리 수명, 통신 두절 시 데이터 보존, Encrypt-RF 보안, 알림 방식, 설치 난이도 등 도입 전 가장 많이 받는 질문을 정리했습니다.',
  h1: '자주 묻는 질문',
  jsonld: {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
  },
  bodyHtml: `
<p>도입 전 가장 많이 받는 질문을 정리했습니다. 더 궁금한 점은 언제든 문의해 주세요.</p>
${FAQ_ITEMS.map(([q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('\n')}
<p><a href="${SITE}/contact">상담·문의</a> · <a href="${SITE}/knowledgebase">기술 지식베이스</a> · <a href="${SITE}/guides">설치 가이드</a></p>`
}), 'Monnit 자주 묻는 질문');

/* --- 4-9-4) 산업별 제안서 --- */
const WP_FALLBACK = [
  ['데이터센터 · IDC 모니터링', '랙 단위 열편차와 과냉각을 실측해, 더 차갑게가 아니라 정확하게 냉방하는 방법.'],
  ['공장 설비 예지보전', '모터·펌프·감속기의 진동과 전류로 고장을 7~30일 전에 잡아내는 예지보전 설계.'],
  ['진동 · 구조안전 계측', '배관 피로, 구조 부재 변형, 회전설비 진동을 24bit 정밀도로 무선 계측합니다.'],
  ['건설 · 토목 구조물 모니터링', '전원도 통신도 없는 초기 현장부터 사면·흙막이·양생 구간을 24시간 계측합니다.'],
  ['UPS · ESS · 전력 설비 모니터링', '배터리 열화와 수배전반 과열을 활선 상태에서 비접촉으로 감시합니다.'],
  ['무선 화재경보 · 소방 안전', '기존 수신반은 그대로 두고 경보만 담당자 휴대폰으로 직접 전달합니다.'],
  ['스마트 FM · 시설관리', '민원이 들어오기 전에 먼저 아는 예지형 FM. 관리 성과가 리포트로 남습니다.'],
  ['공공 · 국방 시설 안전관리', '배선 공사 승인 없이, 보안 요건을 충족하는 암호화 무선 계측으로 시작합니다.'],
  ['호텔 · 리조트 시설 모니터링', '객실 누수와 빈 객실 냉난방, 비수기 동파를 컴플레인이 접수되기 전에 잡아냅니다.'],
  ['학교 · 교회 · 공공시설 모니터링', '방학·주말 무인 기간의 동파와 누수를 감시하고 급식실 온도 기록을 자동으로 남깁니다.'],
  ['온도 · 누수 · 동파 · HVAC 통합', '배관이 얼기 전에, 물이 차기 전에. 전기실·기계실·공조·저온창고 통합 감시.'],
  ['농업 · 골프장 토양 수분', '물을 얼마나 줄지 감이 아니라 수분 포텐셜(kPa) 수치로 결정합니다.'],
  ['바이오 · 제약 유틸리티 모니터링', 'GMP 환경의 온습도·차압·유틸리티를 자동 기록해 감사 대응 근거를 남깁니다.'],
  ['실버타운 · 시니어 안전', '몸에 아무것도 차지 않아도 되는 비접촉 센서로 어르신의 일상을 살핍니다.'],
  ['콜드체인 · 물류 온도 관리', '창고에서 차량까지 온도 이력이 끊기지 않게. HACCP 기록을 자동으로 남깁니다.'],
  ['리테일 · 매장 · 외식 온도 관리', '여러 점포의 냉장 진열대와 주방 냉동고를 본사 한 화면에서 보고 HACCP 기록을 자동화합니다.']
];
const WP_LIST = (WHITEPAPERS && WHITEPAPERS.length)
  ? WHITEPAPERS.map(w => [strip(w.title), strip(w.desc)])
  : WP_FALLBACK;
writePage('whitepaper', page({
  slug: 'whitepaper',
  title: `산업별 제안서 ${WP_LIST.length}종 — Monnit Korea`,
  desc: `데이터센터·공장 예지보전·콜드체인·바이오 등 ${WP_LIST.length}개 산업별 제안서. 각 16페이지 분량으로 과제 정의, 시스템 구성도, 존별 센서 배치, 투자 대비 효과, 도입 절차를 담았습니다.`,
  h1: '산업별 제안서',
  bodyHtml: `
<p>현장에서 실제로 겪는 문제부터 출발해, 센서 구성·설치·운영·도입 효과까지 ${WP_LIST.length}종의 산업별 제안서로 정리했습니다. 각 제안서는 16페이지 분량으로 과제 정의, 시스템 구성도, 존별 센서 배치, 투자 대비 효과, 도입 절차와 체크리스트를 담고 있습니다.</p>
<p>필요한 제안서를 선택하고 이메일을 입력해 신청하시면 다운로드가 바로 시작됩니다. PDF는 비밀번호 없이 열람할 수 있으며, 무단 편집·수정을 막기 위해 보호되어 있습니다.</p>
<h2>제안서 목록</h2>
${WP_LIST.map(([t, d]) => `<h3>${esc(t)}</h3><p>${esc(d)}</p>`).join('\n')}
<p><a href="${SITE}/applications">활용 분야 보기</a> · <a href="${SITE}/contact">제안서 신청·문의</a></p>`
}), '산업별 제안서');

/* --- 4-9-5) 뉴스레터 --- */
writePage('newsletter', page({
  slug: 'newsletter',
  title: 'Inside the IoT 뉴스레터 — Monnit Korea',
  desc: '월 1회 발행. 원격 모니터링·예지보전 트렌드, ALTA 신제품, 수상 소식, 현장 적용 사례를 한국어로 정리해 이메일로 전해드립니다.',
  h1: 'Inside the IoT 뉴스레터',
  bodyHtml: `
<p>Monnit의 월간 뉴스레터 <strong>Inside the IoT</strong>는 최신 IoT 소식, 예지보전 인사이트, 신제품 발표, 기술 팁을 한국어로 정리해 정기적으로 전해드립니다.</p>
<h2>월 1회, 핵심 소식만 골라서</h2>
<p>원격 모니터링·예지보전 트렌드부터 ALTA 신제품, 수상 소식, 현장 적용 사례까지 — 실무에 바로 쓰이는 내용만 담아 이메일로 보내드립니다.</p>
<h2>최근 발행 소식</h2>
<ul>
<li><strong>2026 IoT Sensor Company of the Year 수상</strong> — Monnit이 2년 연속 올해의 IoT 센서 기업으로 선정되었습니다.</li>
<li><strong>IoT Platforms Leadership Award 연속 수상</strong> — 플랫폼 리더십 부문에서 백투백 수상을 기록했습니다.</li>
<li><strong>신형 ALTA / ALTA XL Ethernet Gateway 4K 발표</strong> — 대규모 센서 네트워크를 위한 차세대 게이트웨이를 출시했습니다.</li>
</ul>
<p>구독 신청은 <a href="${SITE}/contact">상담·문의</a> 페이지에서 하실 수 있습니다. · <a href="${SITE}/awards">수상 내역</a> · <a href="${SITE}/blog">블로그</a></p>`
}), 'Inside the IoT 뉴스레터');

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

/* ---------- 오래된(구 슬러그) 페이지 자동 정리 — 중복 콘텐츠·404 방지 ----------
   build.js 는 매 빌드마다 최신 데이터로 pages/*.html 를 새로 쓰지만, 예전 빌드에서
   만들어진 구 슬러그 파일(예: 고객사 key 변경 전 case-Samsung.html)은 남아 배포됩니다.
   이번 빌드에서 생성되지 않은 pages/*.html 는 삭제해 색인 중복을 막습니다. */
const _keepFiles = new Set(generated.map(g => g.slug + '.html'));
try {
  fs.readdirSync(OUT_PAGES).forEach(f => {
    if (f.endsWith('.html') && !_keepFiles.has(f)) {
      fs.unlinkSync(path.join(OUT_PAGES, f));
      console.log('[clean] 구 페이지 삭제:', f);
    }
  });
} catch (e) { console.warn('[clean] pages 정리 중 오류:', e.message); }

/* ---------- robots.txt ----------
   [중요] robots.txt 규칙상 크롤러는 자기 이름의 User-agent 블록을 발견하면
   "User-agent: *" 블록을 완전히 무시합니다. 지금까지 봇별 블록에 Allow 만 있어
   /editor, /church 차단이 명시된 봇 16종 모두에게 적용되지 않았습니다.
   → 공통 Disallow 를 모든 블록에 반복해 실제로 적용되게 합니다.

   ※ /pages/ 는 일부러 차단하지 않습니다. /pages/*.html 는 새 경로로 301 하는
     통로라, 차단하면 크롤러가 301 을 따라가지 못해 색인 이전이 끊깁니다. */
const DISALLOW = ['/editor', '/editor.html', '/church', '/church/', '/ops', '/ops/', '/api/'];
const AI_BOTS = [
  /* OpenAI */          'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  /* Anthropic */       'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
  /* Perplexity */      'PerplexityBot', 'Perplexity-User',
  /* Google */          'Google-Extended', 'Google-CloudVertexBot', 'Google-NotebookLM',
  /* Meta */            'meta-externalagent', 'Meta-ExternalFetcher',
  /* Apple */           'Applebot', 'Applebot-Extended',
  /* 기타 AI 검색 */     'DuckAssistBot', 'MistralAI-User', 'Amazonbot', 'cohere-ai', 'CCBot', 'Bytespider',
  /* 국내 검색엔진 */    'Yeti', 'Daum'
];
const botBlock = name => `User-agent: ${name}\nAllow: /\n` + DISALLOW.map(p => `Disallow: ${p}`).join('\n') + '\n\n';
let robots = '# Monnit Korea — 모든 검색·AI 크롤러 허용 (build.js 자동 생성)\n'
           + `# 최종 생성: ${TODAY}\n`
           + '# 크롤러는 자기 이름 블록을 찾으면 "User-agent: *" 를 무시하므로\n'
           + '# 공통 Disallow 를 각 블록마다 반복해 둡니다.\n\n';
robots += botBlock('*');
AI_BOTS.forEach(b => { robots += botBlock(b); });
robots += `Sitemap: ${SITE}/sitemap.xml\n`;
fs.writeFileSync(path.join(__dirname, 'robots.txt'), robots);

/* ---------- 구 사이트 URL 301 리다이렉트 (_redirects 자동 관리) ----------
   2026-07 구조 개편으로 /apps, /cases, /company 등이 /pages/*.html 로 바뀌었으나
   리다이렉트가 없어 Google 색인 URL 대부분이 404 였다.
   아래 마커 사이 구간만 매 빌드마다 교체하므로, 마커 밖에 직접 적은 규칙은 보존된다.

   ※ Netlify 는 "먼저 매칭되는 규칙"이 이기고 리다이렉트를 연쇄 적용하지 않는다.
      그래서 대문자·한글 구 슬러그와 허브 페이지 규칙을 와일드카드보다 위에 둔다. */
const RD_BEGIN = '# >>> AUTO-LEGACY-REDIRECTS (build.js 가 관리 — 직접 수정하지 마세요) >>>';
const RD_END   = '# <<< AUTO-LEGACY-REDIRECTS <<<';

const LEGACY_RULES = (function(){
  /* ① 예전 /pages/*.html → 새 경로 (301)
        파일이 실제로 남아 있으므로 강제(!) 로 리다이렉트해야 규칙이 이깁니다. */
  const pageRules = generated
    .filter(g => g.slug)
    .map(g => `/pages/${g.slug}.html`.padEnd(38) + slugToPath(g.slug).padEnd(28) + '301!')
    .join('\n');

  /* ② 구 사이트 슬러그 → 새 경로 (한 번에 도착하도록 새 경로를 직접 지정) */
  const oldRules = `
# --- 구 슬러그(대문자·한글)
/cases/Samsung        /case/samsung        301
/cases/samsung        /case/samsung        301
/cases/Veolia         /case/veolia         301
/cases/HDC랩스         /case/hdc-labs       301
/cases/hdc랩스         /case/hdc-labs       301

# --- 허브(목록) 페이지
/apps                 /applications        301
/apps/                /applications        301
/cases                /stories             301
/cases/               /stories             301
/company              /who-we-are          301
/company/             /who-we-are          301
/solutions            /applications        301
/solutions/           /applications        301
/browse               /applications        301
/browse/              /applications        301
/faq                  /faqs                301
/faq/                 /faqs                301
/whitepapers          /whitepaper          301
/whitepapers/         /whitepaper          301

# --- 상세 페이지 (구 슬러그 → 새 경로)
/apps/*               /app/:splat          301
/cases/*              /case/:splat         301

# --- 구 Wix 잔존 경로
/kakaoalarm           /contact             301
/kakaoalarm/          /contact             301
/manual               /guides              301
/consultingpromotion  /promo/consulting    301`;

  /* ③ 관리자 */
  const editorRules = `
# --- 에디터(비공개)
/editor               /editor.html         200
/editor/              /editor.html         200`;

  /* ④ 마지막 안전망 — 미리 만들어 둔 파일이 없는 경로(준비 중 활용분야 등)는
        SPA 껍데기가 받아서 클라이언트에서 그립니다. 반드시 맨 아래에 둡니다.
        실제 파일이 있으면 Netlify 가 파일을 먼저 주므로 SSG 페이지가 우선합니다. */
  /* ※ /our-solution · /what-we-do · /faqs · /whitepaper · /newsletter 는
        예전엔 여기서 index.html 을 그대로 내보내 canonical 이 홈으로 잡혔습니다.
        이제 위에서 고유 메타·본문을 가진 SSG 파일을 만드므로 폴백에서 제외합니다.
        (규칙을 남겨두면 Netlify 가 파일보다 규칙을 먼저 볼 여지가 있어 지웁니다) */
  const fallback = `
# --- 개인정보처리방침·설치사례 중복 URL 정리 (확장자 없는 주소 → 정본 1개)
/privacy              /privacy.html                301
/privacy/             /privacy.html                301
/installation-photos  /installation-photos.html    301
/installation-photos/ /installation-photos.html    301

# --- SPA 폴백 (미리 만든 파일이 없는 상세 경로 · 준비 중 화면이 받습니다)
/app/*                /index.html          200
/case/*               /index.html          200
/kb/*                 /index.html          200
/guide/*              /index.html          200
/promotions/*         /promo.html?id=:splat  200`;

  return '\n# --- 예전 /pages 주소 → 새 경로 (' + generated.filter(g=>g.slug).length + '개)\n'
       + pageRules + '\n' + oldRules + '\n' + editorRules + '\n' + fallback + '\n';
})();


try {
  const RD_PATH = path.join(__dirname, '_redirects');
  let rd = fs.existsSync(RD_PATH) ? fs.readFileSync(RD_PATH, 'utf8') : '';
  const bi = rd.indexOf(RD_BEGIN), ei = rd.indexOf(RD_END);
  if (bi !== -1 && ei !== -1 && ei > bi) rd = rd.slice(0, bi) + rd.slice(ei + RD_END.length);
  rd = rd.replace(/\s+$/, '');
  rd += '\n\n' + RD_BEGIN + '\n' + LEGACY_RULES.trim() + '\n' + RD_END + '\n';
  fs.writeFileSync(RD_PATH, rd);

  const _n = LEGACY_RULES.split('\n').filter(l => l.trim().startsWith('/')).length;
  console.log(`[build] _redirects 갱신 — 구 URL 301 규칙 ${_n}개`);
} catch (e) { console.warn('[build] _redirects 갱신 실패:', e.message); }

/* ---------- 404.html (Netlify 가 미매칭 요청에 자동으로 사용) ---------- */
try {
  const NOTFOUND = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>페이지를 찾을 수 없습니다 — Monnit Korea</title>
<style>
  :root{--ink:#111;--soft:#666;--line:#e5e5e5;--accent:#0b5fff}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
       color:var(--ink);background:#fff;line-height:1.65;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
  .wrap{max-width:640px;width:100%}
  .code{font-size:13px;letter-spacing:.12em;color:var(--soft);text-transform:uppercase}
  h1{font-size:28px;margin:8px 0 12px;line-height:1.3}
  p{color:var(--soft);margin:0 0 28px}
  ul{list-style:none;padding:0;margin:0 0 28px;border-top:1px solid var(--line)}
  li{border-bottom:1px solid var(--line)}
  li a{display:block;padding:14px 4px;color:var(--ink);text-decoration:none;font-weight:600}
  li a span{display:block;font-weight:400;font-size:13px;color:var(--soft);margin-top:2px}
  li a:hover{color:var(--accent)}
  .home{display:inline-block;padding:12px 22px;background:var(--ink);color:#fff;
        text-decoration:none;border-radius:6px;font-weight:600}
  .foot{margin-top:32px;font-size:13px;color:var(--soft)}
  .foot a{color:var(--soft)}
</style>
</head>
<body>
  <div class="wrap">
    <div class="code">404</div>
    <h1>찾으시는 페이지가 없습니다</h1>
    <p>주소가 바뀌었거나 삭제된 페이지입니다. 아래에서 원하시는 내용을 찾아보세요.</p>
    <ul>
      <li><a href="/applications">활용 분야 60선<span>산업별 IoT 모니터링 활용 사례</span></a></li>
      <li><a href="/stories">도입 사례<span>글로벌 기업 도입 성과</span></a></li>
      <li><a href="/products">제품<span>센서·게이트웨이·소프트웨어</span></a></li>
      <li><a href="/who-we-are">회사 소개<span>Monnit Korea 소개</span></a></li>
      <li><a href="/knowledgebase">기술 지식베이스<span>설치·설정·문제 해결 문서</span></a></li>
      <li><a href="/contact">상담·문의<span>자주 묻는 질문 · 문의하기</span></a></li>
    </ul>
    <a class="home" href="/">메인으로 돌아가기</a>
    <div class="foot">문의 <a href="mailto:korea@monnit.com">korea@monnit.com</a> · <a href="tel:0220881454">02-2088-1454</a></div>
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, '404.html'), NOTFOUND);
  console.log('[build] 404.html 생성');
} catch (e) { console.warn('[build] 404.html 생성 실패:', e.message); }

/* ---------- sitemap.xml ---------- */
const urls = [
  { loc: SITE + '/', pri: '1.0' },
  { loc: SITE + '/installation-photos.html', pri: '0.6' },
  { loc: SITE + '/promo/consulting', pri: '0.9' },
  { loc: SITE + '/privacy.html', pri: '0.3' },
  ...generated.map(g => ({ loc: g.loc, pri: '0.8' })),
  ...promoPages                                        // /promotions/{slug} 상세
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
CORE_SLUGS.forEach(s => { const g = generated.find(x => x.slug === s); if (g) llms += `- [${g.title}](${g.loc})\n`; });
llms += `\n## 활용 분야 상세 (${APPS.length})\n`;
APPS.forEach(a => { llms += `- [${strip(a.name)}](${SITE}/app/${a.id}): ${strip(a.desc).slice(0, 90)}\n`; });
llms += `\n## 도입 사례 상세\n`;
Object.keys(CASE_DATA).forEach(id => { const c = CASE_DATA[id]; llms += `- [${strip(c.name || id)} (${strip(c.industry || '')})](${SITE}/case/${id})\n`; });
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
    full += `\n#### ${strip(a.name)}\nURL: ${SITE}/app/${a.id}\n${strip(a.desc)}${a.sensors ? ' [센서: ' + a.sensors + ']' : ''}\n`;
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
  full += `\n### ${strip(c.name || id)} (${strip(c.industry || '')})\nURL: ${SITE}/case/${id}\n${strip(c.tagline || '')}\n${c.about ? strip(c.about) + '\n' : ''}`;
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
    full += `\n### ${cat} (${SITE}/guide/${slugKo(cat) || 'etc'})\n`;
    arr.forEach(g => full += `- ${g.title}${g.desc ? ': ' + strip(g.desc).slice(0, 100) : ''}\n`);
  });
}
fs.writeFileSync(path.join(__dirname, 'llms-full.txt'), full);

console.log(`[build] 완료 — 정적 페이지 ${generated.length}개, robots.txt, sitemap.xml(${urls.length} URL), llms.txt, llms-full.txt`);
console.log('[build] 데이터: APPS', APPS.length, '| PRODUCTS', PRODUCTS.length, '| CASES', Object.keys(CASE_DATA).length, '| PROMOS', PROMOS.length, '| 상세', Object.keys(APP_DETAILS).length);
})().catch(e => { console.error('[build] 실패:', e); process.exit(1); });
