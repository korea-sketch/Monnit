/** IoT몰 관제 — /ops/mall (2026-11-04)
 *
 *  /ops 와 같은 로그인(mk_ops 쿠키).
 *    GET  /ops/mall                 화면
 *    GET  /ops/mall/data?m=YYYY-MM  그달 견적 요청 · 처리 상태 · 이용 통계 · 알림 받는 사람
 *    POST /ops/mall/status          { no, st, memo }  처리 상태·메모 저장
 *    POST /ops/mall/recipients      { list:[{name,email}] }  견적 알림 받는 사람 저장
 *    POST /ops/mall/testmail        알림 받는 사람에게 시험 메일 한 통
 *  공개
 *    POST /api/mall/ev              몰 이용 기록(세션 요약 한 줄 · sendBeacon)
 *
 *  저장 위치는 _mall.mjs 맨 위 설명 참고. */
import * as auth from './_ops_auth.mjs';
import { get, set, readLines } from './_store.mjs';
import { STORE, readRecipients, saveRecipients, recordEvents, okEmail, DEFAULT_RECIPIENTS, readQuoteLink, saveQuoteLink, refreshQs, pushQuote, testQuoteLink, publicKey } from './_mall.mjs';
import { withMust } from './_staffto.mjs';
import { sendBrevo, alwaysTo } from './_route.mjs';

export const config = { path: ['/ops/mall', '/ops/mall/data', '/ops/mall/status', '/ops/mall/recipients', '/ops/mall/testmail', '/ops/mall/quote-link', '/ops/mall/quote-test', '/ops/mall/push', '/api/mall/ev', '/api/mall/pubkey'] };

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });
const kMonth = (d) => new Date((d ? new Date(d).getTime() : Date.now()) + 9 * 3600e3).toISOString().slice(0, 7);
const ST = ['new', 'contact', 'quoted', 'won', 'hold', 'lost'];

async function readStatus() { try { return JSON.parse((await get(STORE, 'status.json')) || '{}') || {}; } catch (e) { return {}; } }

/* 공개 이용 기록 — 같은 IP 하루 300줄까지 */
async function ev(req) {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const raw = await req.text(); if (raw.length > 12000) return new Response(null, { status: 413 });
  let body; try { body = JSON.parse(raw); } catch (e) { return new Response(null, { status: 400 }); }
  const ua = String(req.headers.get('user-agent') || '');
  if (/bot|crawl|spider|slurp|preview|headless/i.test(ua)) return new Response(null, { status: 204 });
  const ip = req.headers.get('cf-connecting-ip') || '';
  try {
    const day = kMonth().slice(0, 7) + '-' + new Date(Date.now() + 9 * 3600e3).toISOString().slice(8, 10);
    const rk = 'rate/' + day + '/' + ip.replace(/[^0-9a-f.:]/gi, '_');
    const n = Number((await get(STORE, rk)) || 0);
    if (n > 300) return new Response(null, { status: 204 });
    await set(STORE, rk, String(n + 1));
  } catch (e) { /* 제한 실패해도 기록은 시도 */ }
  const country = (req.cf && req.cf.country) || req.headers.get('cf-ipcountry') || '';
  await recordEvents(body, { c: country }).catch(() => false);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

function addCount(map, k, n) { if (!k) return; map[k] = (map[k] || 0) + n; }
const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);

async function data(url) {
  const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('m') || '') ? url.searchParams.get('m') : kMonth();
  const [quotes, evs, status, rcp] = await Promise.all([readLines(STORE, 'q-' + m).catch(() => []), readLines(STORE, 'ev-' + m).catch(() => []), readStatus(), readRecipients()]);
  const showTest = url.searchParams.get('test') === '1';
  const qs = quotes.filter((q) => showTest || !q.test).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  /* 통계 — 요청 기준(견적에 실제로 들어간 품목) · 이용 기준(본 · 담은) */
  const reqItems = {}, reqQty = {}, views = {}, adds = {}, searches = {}, inds = {}, byDay = {};
  for (const q of qs) { for (const it of q.items || []) { addCount(reqItems, it.n, 1); addCount(reqQty, it.n, it.q || 1); } addCount(byDay, String(q.ts).slice(0, 10), 1); }
  let sessions = 0, mobile = 0, pages = 0, quoteSess = 0;
  for (const e of evs) {
    sessions++; if (e.dev === 'm') mobile++; pages += e.pg || 0; if (e.q) quoteSess++;
    for (const [k, v] of Object.entries(e.v || {})) addCount(views, k, v);
    for (const [k, v] of Object.entries(e.a || {})) addCount(adds, k, v);
    for (const [k, v] of Object.entries(e.s || {})) addCount(searches, k, v);
    for (const [k, v] of Object.entries(e.i || {})) addCount(inds, k, v);
  }
  /* 견적시스템 견적서 — 진행 상태 새로 받고, 아직 못 보낸 건은 최대 5건 다시 보낸다 */
  const link = await readQuoteLink();
  let qsMap = {};
  if (link.configured) {
    qsMap = await refreshQs(qs.filter((q) => !q.test).map((q) => q.no)).catch(() => ({}));
    const pend = qs.filter((q) => !q.test && q.no && !(qsMap[q.no] && qsMap[q.no].id)).slice(0, 5);
    for (const q of pend) { const r = await pushQuote(q); if (r && r.ok) qsMap[q.no] = { id: r.id, no: r.no, status: r.status, total: r.total, missing: r.missing || [] }; else if (r && r.error) qsMap[q.no] = { ...(qsMap[q.no] || {}), err: r.error }; }
  }
  const stCount = {}; ST.forEach((s) => (stCount[s] = 0));
  qs.forEach((q) => { const s = (status[q.no] && status[q.no].st) || 'new'; stCount[s] = (stCount[s] || 0) + 1; });
  return {
    month: m, link: { url: link.url, configured: link.configured, savedAt: link.savedAt }, quotes: qs.map((q) => ({ ...q, qsys: qsMap[q.no] || null, st: (status[q.no] && status[q.no].st) || 'new', note: (status[q.no] && status[q.no].memo) || '', stAt: (status[q.no] && status[q.no].at) || '' })),
    stats: { sessions, mobile, pages, quoteSess, reqItems: top(reqItems, 12), reqQty: top(reqQty, 12), views: top(views, 12), adds: top(adds, 12), searches: top(searches, 15), inds: top(inds, 6), byDay, stCount },
    recipients: rcp, always: alwaysTo(), must: withMust([]), defaults: DEFAULT_RECIPIENTS
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/mall/ev') return ev(req);
  /* 견적시스템이 서명을 확인할 공개키 — 공개해도 되는 값 */
  if (path === '/api/mall/pubkey') return new Response(JSON.stringify(await publicKey()), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
  const authed = auth.configured() && auth.valid(auth.cookieFrom({ cookie: req.headers.get('cookie') || '' }));
  if (!authed) return path === '/ops/mall' ? new Response(null, { status: 302, headers: { ...H, location: '/ops' } }) : j({ error: 'unauthorized' }, 401);
  if (path === '/ops/mall') return new Response(PAGE, { headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
  if (path === '/ops/mall/data') return j(await data(url));
  if (req.method !== 'POST') return j({ error: 'method' }, 405);
  /* 같은 사이트에서 온 요청만 — 관제 쿠키를 노린 다른 사이트의 요청 차단 */
  const origin = req.headers.get('origin') || '';
  if (origin && new URL(origin).host !== url.host) return j({ error: 'origin' }, 403);
  let body = {}; try { body = await req.json(); } catch (e) { return j({ error: 'json' }, 400); }
  if (path === '/ops/mall/status') {
    const no = String(body.no || '').slice(0, 24); if (!no) return j({ error: 'no' }, 400);
    const st = ST.includes(body.st) ? body.st : 'new';
    const all = await readStatus();
    all[no] = { st, memo: String(body.memo || '').replace(/[\u0000-\u0008]/g, '').slice(0, 1000), at: new Date().toISOString() };
    const ok = await set(STORE, 'status.json', JSON.stringify(all));
    return j({ ok, item: all[no] });
  }
  if (path === '/ops/mall/recipients') { const r = await saveRecipients(body.list); return j(r); }
  if (path === '/ops/mall/quote-link') return j(await saveQuoteLink({ url: body.url, key: body.key }));
  if (path === '/ops/mall/quote-test') { const l = await readQuoteLink(); const r = await testQuoteLink(l); return j({ ok: !!r.ok, error: r.error || r.skipped || '', url: l.url }); }
  if (path === '/ops/mall/push') {
    const no = String(body.no || '').slice(0, 24); const mm = /^[A-Z]{2}-(\d{2})(\d{2})/.exec(no);
    const month = mm ? '20' + mm[1] + '-' + mm[2] : kMonth();
    const rec = (await readLines(STORE, 'q-' + month).catch(() => [])).find((q) => q.no === no);
    if (!rec) return j({ ok: false, error: '접수 건을 찾지 못했습니다' }, 404);
    return j(await pushQuote({ ...rec, test: false }));
  }
  if (path === '/ops/mall/testmail') {
    const rcp = (await readRecipients()).list.map((r) => r.email).filter(okEmail);
    const to = withMust([...rcp, ...alwaysTo()]);
    const r = await sendBrevo({ to, subject: '[IoT몰 견적] 시험 메일 — 알림 받는 사람 확인', fields: { '내용': 'IoT몰 견적 알림이 이 주소로 정상 도착하는지 확인하는 시험 메일입니다.', '받는 사람': to.join(', '), '보낸 시각': new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), '관리 화면': 'https://monnit.co.kr/ops/mall' } });
    return j({ ...r, to });
  }
  return j({ error: 'not found' }, 404);
};

const PAGE = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>IoT몰 관제</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{--bg:#0A0F1C;--card:#111a2e;--card2:#16213a;--line:rgba(255,255,255,.1);--ink:#F2F5FA;--mut:#A6B3CC;--dim:#76839c;--acc:#7aa8ff;--or:#f5a524;--up:#4fe39b;--dn:#ff7a7a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo',sans-serif;font-size:14px}
.opsnav{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(8,12,22,.85);backdrop-filter:blur(10px);overflow-x:auto;position:sticky;top:0;z-index:20}
.opsnav a{color:#A6B3CC;text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.opsnav a:hover{color:#F2F5FA}.opsnav a.on{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}
.wrap{max-width:1280px;margin:0 auto;padding:20px 16px 60px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:16px}
h1{margin:0;font-size:22px}h1 small{display:block;font-size:12.5px;color:var(--dim);font-weight:500;margin-top:4px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.btn{background:var(--card2);border:1px solid var(--line);color:var(--ink);border-radius:9px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer}.btn:hover{border-color:var(--acc)}.btn.on{background:var(--acc);color:#0A0F1C;border-color:var(--acc);font-weight:700}
.btn.pri{background:var(--or);color:#111;border-color:var(--or);font-weight:700}
input,select,textarea{background:#0E1628;border:1px solid var(--line);border-radius:9px;color:var(--ink);font:inherit;font-size:13px;padding:7px 10px}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}.kpi span{font-size:12px;color:var(--dim)}.kpi b{display:block;font-size:22px;margin-top:3px}
.grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px;align-items:start}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px}.card h3{margin:0 0 10px;font-size:15px;display:flex;justify-content:space-between;align-items:center}
.card h3 small{color:var(--dim);font-weight:500;font-size:12px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.q{border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-bottom:8px;background:var(--card2);cursor:pointer}
.q .t{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}.q .when{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
.q .who{font-weight:700}.q .who small{color:var(--mut);font-weight:500;margin-left:4px}.q .sum{font-size:12.5px;color:var(--mut);margin-top:4px}
.tag{display:inline-block;font-size:11.5px;font-weight:700;border-radius:6px;padding:1px 7px;background:#1A2640;color:var(--mut)}
.s-new{background:rgba(245,165,36,.18);color:var(--or)}.s-contact{background:rgba(122,168,255,.16);color:var(--acc)}.s-quoted{background:rgba(160,120,255,.18);color:#c3a6ff}.s-won{background:rgba(79,227,155,.16);color:var(--up)}.s-hold{background:#1A2640;color:var(--mut)}.s-lost{background:rgba(255,122,122,.15);color:var(--dn)}
.det{display:none;margin-top:10px;border-top:1px dashed var(--line);padding-top:10px;cursor:default}.q.open .det{display:block}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}th{color:var(--dim);font-weight:600;font-size:12px}td.n{text-align:right;font-variant-numeric:tabular-nums}
.kv{display:grid;grid-template-columns:110px 1fr;gap:3px 12px;font-size:12.5px;margin:10px 0}.kv dt{color:var(--dim)}.kv dd{margin:0;word-break:break-all;white-space:pre-wrap}
.acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.acts a{color:var(--acc);font-size:12.5px;text-decoration:none}
.bars .r{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px;align-items:center;margin:6px 0;font-size:12.5px}
.bars .r i{display:block;height:6px;border-radius:9px;background:linear-gradient(90deg,var(--acc),#a3c2ff);margin-top:3px}
.bars .r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bars .r b{text-align:right;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{background:var(--card2);border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:12.5px}.chips b{color:var(--or);margin-left:4px}
.rcp{display:grid;grid-template-columns:1fr 1.4fr 32px;gap:6px;margin-bottom:6px}.rcp input{min-width:0}
.note{font-size:12px;color:var(--dim);line-height:1.7}.warn{color:var(--or)}
.spark{display:flex;align-items:flex-end;gap:2px;height:44px}.spark i{flex:1;background:var(--acc);opacity:.8;border-radius:2px 2px 0 0;min-height:2px}
.empty{color:var(--dim);text-align:center;padding:30px 0}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:.2s;pointer-events:none}.toast.on{opacity:1}
@media (max-width:980px){.grid{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kv{grid-template-columns:86px 1fr}}
</style></head><body>
<nav class="opsnav" aria-label="관제 메뉴"><a href="/ops">통합 관제</a><a href="/ops/proposals">맞춤 제안서</a><a href="/ops/proposals/archive">발송 대장</a><a href="/ops/proposals/insights">고객 인사이트</a><a href="/ops/notices">알림함</a><a href="/ops/mall" class="on">IoT몰</a><a href="/ops/flow">유입·경로</a><a href="/ops/block">차단 관리</a></nav>
<div class="wrap">
<header><h1>IoT몰 관제<small>견적 요청 · 처리 상태 · 많이 찾는 제품 · 검색어 · 알림 받는 사람을 한 화면에서 — /mall · /store</small></h1>
<div class="bar"><select id="m"></select><label class="note"><input type="checkbox" id="tst"> 테스트 포함</label><input type="search" id="qq" placeholder="회사 · 담당자 · 접수번호 · 품목"><button class="btn" id="csv">CSV 내려받기</button><button class="btn" id="rf">새로고침</button><a class="btn" href="/mall" target="_blank" rel="noopener" style="text-decoration:none">몰 열기 ↗</a></div></header>
<div class="kpis" id="kpis"></div>
<div class="grid"><div>
 <div class="card"><h3>견적 요청<small id="cnt"></small></h3><div class="tabs" id="tabs"></div><div id="list"><div class="empty">불러오는 중…</div></div></div>
</div><div>
 <div class="card"><h3>일별 견적 요청<small id="mm"></small></h3><div class="spark" id="spark"></div></div>
 <div class="card"><h3>견적에 많이 들어간 제품<small>요청 건수 · 수량</small></h3><div class="bars" id="req"></div></div>
 <div class="card"><h3>많이 본 · 담은 제품<small>몰 이용 기록</small></h3><div class="bars" id="views"></div><div class="bars" id="adds" style="margin-top:10px"></div></div>
 <div class="card"><h3>검색어<small>몰 검색창</small></h3><div class="chips" id="srch"></div><h3 style="margin-top:14px">업종별 구성 담기</h3><div class="chips" id="inds"></div></div>
 <div class="card"><h3>견적시스템 연결<small id="lsaved"></small></h3>
  <p class="note">견적 요청이 들어오면 <b>MK+DC 견적시스템</b>에 단가표 판매가로 「견적 대기」 견적서가 자동으로 만들어지고, 견적시스템 목록의 <b>🛒 IoT몰 접수</b> 탭에 모입니다. 발송 → 수주 → 출고완료가 되면 ERP 판매서로 이어집니다.</p>
  <div class="rcp" style="grid-template-columns:1fr"><input id="lurl" placeholder="견적시스템 주소"></div>
  <div class="rcp" style="grid-template-columns:1fr"><input id="lkey" type="password" autocomplete="off" placeholder="연동 키 (선택 — 비워 두면 자동 서명으로 연결)"></div>
  <div class="acts"><button class="btn pri" id="lsave">저장</button><button class="btn" id="ltest">연결 확인</button><a class="btn" id="lopen" target="_blank" rel="noopener" style="text-decoration:none">견적시스템 열기 ↗</a></div></div>
 <div class="card"><h3>견적 알림 받는 사람<small id="rsaved"></small></h3>
  <div id="rcp"></div><div class="acts"><button class="btn" id="radd">+ 사람 추가</button><button class="btn pri" id="rsave">저장</button><button class="btn" id="rtest">시험 메일 보내기</button></div>
  <p class="note" id="rnote"></p></div>
 <div class="card"><h3>데이터가 남는 곳</h3><p class="note">
  · <b>견적 요청</b> — R2 <code>mall/q-YYYY-MM</code>(품목·조건 구조화) + 리드 원장 <code>leads</code>(/ops 통합 관제) + 먼데이 리드 보드 + 알림함<br>
  · <b>견적서</b> — MK+DC 견적시스템에 「견적 대기」로 자동 작성(🛒 IoT몰 접수 탭) → 수주·출고완료 시 ERP 판매서<br>
  · <b>처리 상태·메모</b> — <code>mall/status.json</code> (이 화면에서 저장)<br>
  · <b>몰 이용 기록</b> — <code>mall/ev-YYYY-MM</code> 방문 세션당 한 줄(본·담은 제품, 검색어, 업종 구성)<br>
  · <b>견적함·관심 제품</b> — 고객 브라우저에만 보관(서버로 보내지 않음). 견적 요청을 보내는 순간 서버에 남습니다.<br>
  · <b>메일</b> — 담당자 알림(아래 받는 사람 + 1015@ 필수) · 고객 접수 확인 메일(이메일 적은 경우) · Brevo 발송</p></div>
</div></div></div>
<div class="toast" id="toast"></div>
<script>
(function(){
var D=null, F='all';
var $=function(s){return document.querySelector(s)};
var ST={new:'신규',contact:'연락함',quoted:'견적 발송',won:'수주',hold:'보류',lost:'종료'};
var KIND={quote:'견적',consult:'구성 상담',qna:'제품 문의'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function kt(ts){try{return new Date(ts).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}catch(e){return ts}}
function toast(t){var e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove('on')},2200)}
function post(u,o){return fetch(u,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(o)}).then(function(r){if(r.status===401){location.href='/ops';throw 0}return r.json()})}
(function(){var s=$('#m'),d=new Date(Date.now()+9*3600e3);for(var i=0;i<12;i++){var x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-i,1)),v=x.toISOString().slice(0,7);s.insertAdjacentHTML('beforeend','<option value="'+v+'">'+v.replace('-','년 ')+'월</option>')}})();
function load(){$('#rf').disabled=true;fetch('/ops/mall/data?m='+$('#m').value+($('#tst').checked?'&test=1':''),{credentials:'same-origin'}).then(function(r){if(r.status===401){location.href='/ops';return null}return r.json()}).then(function(j){if(!j)return;D=j;render()}).catch(function(){$('#list').innerHTML='<div class="empty">불러오지 못했습니다</div>'}).then(function(){$('#rf').disabled=false})}
function bars(el,arr,unit){el.innerHTML=arr.length?arr.map(function(x){var mx=arr[0][1]||1;return '<div class="r"><div><span>'+esc(x[0])+'</span><i style="width:'+Math.max(4,x[1]/mx*100)+'%"></i></div><b>'+x[1].toLocaleString('ko-KR')+(unit||'')+'</b></div>'}).join(''):'<div class="note">아직 기록이 없습니다</div>'}
function rows(){var q=$('#qq').value.trim().toLowerCase();return D.quotes.filter(function(x){if(F!=='all'&&x.st!==F)return false;if(q&&[x.company,x.name,x.no,x.email,x.phone,(x.items||[]).map(function(i){return i.n}).join(' ')].join(' ').toLowerCase().indexOf(q)<0)return false;return true})}
function render(){
 var s=D.stats, qs=D.quotes, sc=s.stCount;
 var items=qs.reduce(function(a,q){return a+(q.items||[]).reduce(function(b,i){return b+(i.q||0)},0)},0);
 $('#kpis').innerHTML=[['견적 요청',qs.length],['처리 대기(신규)',sc.new||0],['수주',sc.won||0],['요청 수량 합계',items],['몰 방문 세션',s.sessions],['모바일 비율',s.sessions?Math.round(s.mobile/s.sessions*100)+'%':'-']].map(function(k){return '<div class="kpi"><span>'+k[0]+'</span><b>'+(typeof k[1]==='number'?k[1].toLocaleString('ko-KR'):k[1])+'</b></div>'}).join('');
 $('#tabs').innerHTML=[['all','전체',qs.length]].concat(Object.keys(ST).map(function(k){return [k,ST[k],sc[k]||0]})).map(function(t){return '<button class="btn'+(F===t[0]?' on':'')+'" data-f="'+t[0]+'">'+t[1]+' '+t[2]+'</button>'}).join('');
 var rs=rows(); $('#cnt').textContent=rs.length+'건';
 $('#list').innerHTML=rs.length?rs.map(function(q,i){
  var it=q.items||[], c=q.cond||{};
  var sum=it.length?esc(it[0].n)+(it.length>1?' 외 '+(it.length-1)+'종':'')+' · '+it.reduce(function(a,b){return a+b.q},0)+'개':esc(q.product||KIND[q.kind]||'');
  var kv=[['접수번호',q.no],['전화',q.phone],['이메일',q.email],['부서',c.dept],['지역',q.region],['구매 유형',c.type],['희망 납기',c.due],['설치',c.inst],['지급',c.pay],['예산',c.budget],['사업자번호',c.biz],['요청 서류',(c.docs||[]).join(', ')],['회원',c.grade],['메모',q.memo],['유입',q.source]].filter(function(r){return r[1]});
  var mail='mailto:'+encodeURIComponent(q.email||'')+'?subject='+encodeURIComponent('[모넷코리아] 견적서 송부 · '+q.no)+'&body='+encodeURIComponent((q.name||'')+'님, 안녕하세요. 모넷코리아입니다.\\n\\n요청하신 견적('+q.no+')을 첨부해 드립니다.\\n\\n'+it.map(function(x,i){return (i+1)+'. '+x.n+' × '+x.q}).join('\\n')+'\\n\\n감사합니다.\\n모넷코리아 02-2088-1454');
  var qy=q.qsys, QS={draft:'견적 대기',sent:'견적 발송',won:'수주',shipped:'출고완료 · ERP 반영',lost:'실주',void:'취소'};
  var qline=qy&&qy.id?'<span class="tag s-quoted">견적시스템 '+esc(qy.no)+' · '+(QS[qy.status]||esc(qy.status))+'</span>'+(qy.missing&&qy.missing.length?'<span class="tag s-new">단가 확인 '+qy.missing.length+'</span>':''):(D.link.configured&&!q.test?'<span class="tag s-lost">견적시스템 미전송'+(qy&&qy.err?' · '+esc(qy.err):'')+'</span>':'');
  return '<div class="q" data-no="'+esc(q.no)+'"><div class="t"><span class="when">'+esc(kt(q.ts))+'</span><span class="tag s-'+q.st+'">'+ST[q.st]+'</span><span class="tag">'+(KIND[q.kind]||'견적')+(q.shop==='store'?' · 제품몰':'')+'</span>'+(q.test?'<span class="tag">테스트</span>':'')+qline+'<span class="who">'+esc(q.company||'(회사 미기재)')+'<small>'+esc(q.name||'')+'</small></span></div><div class="sum">'+sum+(q.note?' · 메모: '+esc(q.note.slice(0,40)):'')+'</div>'+
   '<div class="det">'+(it.length?'<table><thead><tr><th>No.</th><th>품목</th><th>분류</th><th style="text-align:right">수량</th></tr></thead><tbody>'+it.map(function(x,k){return '<tr><td>'+(k+1)+'</td><td>'+esc(x.n)+'</td><td>'+esc(x.c)+'</td><td class="n">'+x.q+'</td></tr>'}).join('')+'</tbody></table>':'')+
   '<dl class="kv">'+kv.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>'}).join('')+'</dl>'+
   '<div class="acts"><select data-st>'+Object.keys(ST).map(function(k){return '<option value="'+k+'"'+(k===q.st?' selected':'')+'>'+ST[k]+'</option>'}).join('')+'</select><input data-memo placeholder="처리 메모 (담당·견적 금액 등)" value="'+esc(q.note)+'" style="flex:1;min-width:160px"><button class="btn pri" data-save>저장</button>'+
   (qy&&qy.id?'<a href="'+esc(D.link.url)+'/#/quote/'+esc(qy.id)+'" target="_blank" rel="noopener">견적서 열기 ↗</a>':(D.link.configured&&!q.test?'<button class="btn" data-push>견적시스템으로 보내기</button>':''))+
   (q.phone?'<a href="tel:'+esc(q.phone)+'">전화 걸기</a>':'')+(q.email?'<a href="'+mail+'">견적서 메일 쓰기</a>':'')+'</div>'+(q.stAt?'<div class="note">마지막 변경 '+esc(kt(q.stAt))+'</div>':'')+'</div></div>';
 }).join(''):'<div class="empty">이 달에 해당하는 견적 요청이 없습니다</div>';
 /* 오른쪽 */
 var days={},m=D.month,dim=new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
 qs.forEach(function(q){var d=new Date(new Date(q.ts).getTime()+9*3600e3).toISOString().slice(8,10);days[+d]=(days[+d]||0)+1});
 var mx=Math.max.apply(null,[1].concat(Object.keys(days).map(function(k){return days[k]})));
 var sp='';for(var d=1;d<=dim;d++)sp+='<i title="'+d+'일 '+(days[d]||0)+'건" style="height:'+((days[d]||0)/mx*100)+'%"></i>';$('#spark').innerHTML=sp;$('#mm').textContent=m;
 bars($('#req'),s.reqItems,'건');
 bars($('#views'),s.views.map(function(x){return ['👁 '+x[0],x[1]]}));bars($('#adds'),s.adds.map(function(x){return ['＋ '+x[0],x[1]]}));
 $('#srch').innerHTML=s.searches.length?s.searches.map(function(x){return '<span>'+esc(x[0])+'<b>'+x[1]+'</b></span>'}).join(''):'<span class="note">아직 없음</span>';
 var IN={facility:'시설·빌딩',pharma:'제약·바이오',cold:'물류·콜드체인',pdm:'제조·예지보전',energy:'에너지·유틸리티',agri:'스마트팜·골프장'};
 $('#inds').innerHTML=s.inds.length?s.inds.map(function(x){return '<span>'+esc(IN[x[0]]||x[0])+'<b>'+x[1]+'</b></span>'}).join(''):'<span class="note">아직 없음</span>';
 $('#lurl').value=D.link.url;$('#lopen').href=D.link.url+'/#/';$('#lsaved').textContent=D.link.configured?'자동 연결 (서명)':'꺼짐';
 drawRcp(D.recipients.list);
 $('#rsaved').textContent=D.recipients.isDefault?'기본값':'저장 '+kt(D.recipients.savedAt);
 $('#rnote').innerHTML='함께 받는 주소: '+esc(D.always.concat(D.must).filter(function(v,i,a){return a.indexOf(v)===i}).join(', '))+' (대표님 · 1015@ 필수 규칙)<br>견적·제품 문의가 들어오면 위 사람 모두에게 같은 메일이 한 통씩 갑니다. 고객 메일 「답장」은 고객에게 바로 갑니다.'+(D.recipients.list.some(function(r){return !r.email})?'<br><b class="warn">이메일이 비어 있는 사람은 메일을 받지 못합니다 — 주소를 넣고 저장하세요.</b>':'');
}
function drawRcp(list){$('#rcp').innerHTML=list.map(function(r){return '<div class="rcp"><input data-rn placeholder="이름" value="'+esc(r.name)+'"><input data-re type="email" placeholder="이메일" value="'+esc(r.email)+'"><button class="btn" data-rdel title="빼기">×</button></div>'}).join('')}
function readRcp(){return Array.prototype.map.call(document.querySelectorAll('.rcp'),function(x){return {name:x.querySelector('[data-rn]').value,email:x.querySelector('[data-re]').value}})}
document.addEventListener('click',function(e){
 var f=e.target.closest('[data-f]');if(f){F=f.getAttribute('data-f');render();return}
 var sv=e.target.closest('[data-save]');if(sv){var q=sv.closest('.q'),no=q.getAttribute('data-no');post('/ops/mall/status',{no:no,st:q.querySelector('[data-st]').value,memo:q.querySelector('[data-memo]').value}).then(function(r){if(r.ok){var it=D.quotes.find(function(x){return x.no===no});it.st=r.item.st;it.note=r.item.memo;it.stAt=r.item.at;D.stats.stCount={};D.quotes.forEach(function(x){D.stats.stCount[x.st]=(D.stats.stCount[x.st]||0)+1});render();var el=document.querySelector('.q[data-no="'+no+'"]');if(el)el.classList.add('open');toast('저장했습니다')}else toast('저장 실패')});return}
 var pu=e.target.closest('[data-push]');if(pu){pu.disabled=true;post('/ops/mall/push',{no:pu.closest('.q').getAttribute('data-no')}).then(function(r){toast(r.ok?'견적서를 만들었습니다 · '+r.no:'실패 · '+(r.error||r.skipped||''));load()});return}
 var del=e.target.closest('[data-rdel]');if(del){del.closest('.rcp').remove();return}
 if(e.target.closest('.det'))return;
 var q=e.target.closest('.q');if(q)q.classList.toggle('open');
});
$('#lsave').onclick=function(){post('/ops/mall/quote-link',{url:$('#lurl').value.trim(),key:$('#lkey').value.trim()}).then(function(r){if(r.ok){$('#lkey').value='';toast('견적시스템 연결을 저장했습니다');load()}else toast('저장 실패 '+(r.error||''))})};
$('#ltest').onclick=function(){post('/ops/mall/quote-test',{}).then(function(r){toast(r.ok?'견적시스템과 연결되었습니다':'연결 실패 · '+(r.error||''))})};
$('#radd').onclick=function(){var l=readRcp();l.push({name:'',email:''});drawRcp(l)};
$('#rsave').onclick=function(){var l=readRcp().filter(function(r){return r.name||r.email});var bad=l.filter(function(r){return r.email&&!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(r.email)});if(bad.length)return toast('이메일 형식을 확인하세요: '+bad[0].email);post('/ops/mall/recipients',{list:l}).then(function(r){if(r.ok){D.recipients={list:r.list,savedAt:r.savedAt,isDefault:false};render();toast('받는 사람을 저장했습니다')}else toast('저장 실패')})};
$('#rtest').onclick=function(){this.disabled=true;var b=this;post('/ops/mall/testmail',{}).then(function(r){toast(r.ok?'시험 메일을 보냈습니다 · '+r.to.length+'명':'발송 실패 '+(r.error||r.skipped||''))}).finally(function(){b.disabled=false})};
$('#csv').onclick=function(){if(!D)return;var L=[['접수시각','접수번호','구분','상태','회사','담당자','전화','이메일','지역','품목','총수량','구매유형','희망납기','설치','지급','예산','메모']];D.quotes.forEach(function(q){var c=q.cond||{};L.push([kt(q.ts),q.no,KIND[q.kind]||'',ST[q.st],q.company,q.name,q.phone,q.email,q.region,(q.items||[]).map(function(i){return i.n+'×'+i.q}).join(' / '),(q.items||[]).reduce(function(a,b){return a+b.q},0),c.type,c.due,c.inst,c.pay,c.budget,q.note])});var csv='\\ufeff'+L.map(function(r){return r.map(function(v){v=String(v==null?'':v);return /[",\\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')}).join('\\r\\n');var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='IoT몰_견적_'+D.month+'.csv';a.click()};
$('#qq').addEventListener('input',function(){if(D)render()});$('#m').onchange=load;$('#tst').onchange=load;$('#rf').onclick=load;
load();
})();
</script></body></html>`;
