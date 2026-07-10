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

const CATEGORIES = extract('let CATEGORIES =') || {};
const APPS = extract('let APPS =') || [];
const PRODUCTS = extract('var PRODUCTS =') || [];
const PRODUCT_CATS = extract('var PRODUCT_CATS =') || [];
const CASE_DATA = extract('let CASE_DATA =') || {};

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
      itemLd.push({ '@type': 'Product', name: strip(p.n), description: strip(p.d), category: CATNAME[cat.id] || cat.ko, brand: { '@type': 'Brand', name: 'Monnit' } });
    });
  });
  writePage('products', page({
    slug: 'products', title: 'Monnit 제품 전체 — 무선 센서·게이트웨이·소프트웨어·액세서리',
    desc: `Monnit 산업용 IoT 제품 ${PRODUCTS.length}종 — 온도·진동·누수·전류 등 무선 센서, 게이트웨이, 통합관제 소프트웨어(iMonnit), 액세서리·연동장치 전체 목록.`,
    h1: '제품 — 감지에서 대응까지 하나로',
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: itemLd.map((it, i) => ({ '@type': 'ListItem', position: i + 1, item: it })) },
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
    items.forEach(a => { body += `<li><strong>${esc(a.name)}</strong> — ${esc(a.desc)}${a.sensors ? ` <span class="muted">[${esc(a.sensors)}]</span>` : ''}</li>`; });
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
    const body = `
<p class="muted">${esc(c.industry || '')}</p>
<p>${esc(strip(c.tagline || ''))}</p>
${c.about ? `<h2>고객 소개</h2><p>${esc(strip(c.about))}</p>` : ''}
${ch ? `<h2>당면 과제</h2><ul>${ch}</ul>` : ''}
${q ? `<h2>핵심 성과</h2><ul>${q}</ul>` : ''}
<p><a href="${SITE}/pages/cases.html">← 전체 도입 사례</a></p>`;
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
llms += `## 페이지\n`;
generated.forEach(g => { llms += `- [${g.title}](${g.loc})\n`; });
llms += `\n## 제품군\n- 무선 센서 (온도·진동·누수·전류·공기질 등 80여 종)\n- 게이트웨이 (센서 데이터 수집·전송)\n- 통합관제 소프트웨어 (iMonnit — 실시간 관제·자동제어)\n- 액세서리·연동장치\n\n`;
llms += `## 대표 솔루션\n화재·안전 모니터링 · 설비 예지보전 · 누수·침수 감지 · 환경·공기질 관리 · 에너지 관리 · 대규모 시설 통합관제\n`;
fs.writeFileSync(path.join(__dirname, 'llms.txt'), llms);

/* ---------- llms-full.txt (전체) ---------- */
let full = llms + `\n\n---\n\n# 전체 콘텐츠\n\n## 활용 분야 (${APPS.length})\n`;
Object.entries(CATEGORIES).forEach(([key, info]) => {
  const items = APPS.filter(a => a.cat === key); if (!items.length) return;
  full += `\n### ${info.name}\n`;
  items.forEach(a => { full += `- ${a.name}: ${strip(a.desc)}\n`; });
});
full += `\n## 제품 (${PRODUCTS.length})\n`;
(PRODUCT_CATS || []).forEach(cat => {
  const items = PRODUCTS.filter(p => p.c === cat.id); if (!items.length) return;
  full += `\n### ${CATNAME[cat.id] || cat.ko}\n`;
  items.forEach(p => { full += `- ${p.n}: ${strip(p.d)}\n`; });
});
full += `\n## 도입 사례\n`;
Object.keys(CASE_DATA).forEach(id => { const c = CASE_DATA[id]; full += `\n### ${c.name || id} (${strip(c.industry || '')})\n${strip(c.tagline || '')}\n${c.about ? strip(c.about) + '\n' : ''}`; });
fs.writeFileSync(path.join(__dirname, 'llms-full.txt'), full);

console.log(`[build] 완료 — 정적 페이지 ${generated.length}개, robots.txt, sitemap.xml(${urls.length} URL), llms.txt, llms-full.txt`);
console.log('[build] 데이터: APPS', APPS.length, '| PRODUCTS', PRODUCTS.length, '| CASES', Object.keys(CASE_DATA).length, '| CATEGORIES', Object.keys(CATEGORIES).length);
