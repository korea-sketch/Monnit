/** 유입·이동 경로 관제 + 사이트 팝업 스위치 — /ops/flow (2026-09-23)
 *
 *  /ops 와 같은 로그인(mk_ops 쿠키). 로그인 안 했으면 /ops 로 보낸다.
 *    GET  /ops/flow              화면
 *    GET  /ops/flow/data?days=7  집계 (days=1|7|30|90, inc=1 이면 내부 접속 포함)
 *    POST /ops/flow/popup        팝업 켜기/끄기 { on: true|false }
 *
 *  원장: track 저장소 YYYY-MM.jsonl (netlify/functions/track.mjs 가 쓴다)
 *  보는 것
 *    · 어디서 들어왔나 — 유입 채널 · 외부 사이트 · 첫 페이지(랜딩)
 *    · 사이트 안에서 어디서 → 어디로 — 페이지 이동, 버튼·링크 클릭
 *    · 페이지별 — 들어온 곳 / 누른 것 / 나간 곳
 *    · 최근 방문 흐름 — 세션 하나가 밟은 순서 */
import * as auth from './_ops_auth.mjs';
import { get, set, readLines } from './_store.mjs';
import { POPUP_KEY, POPUP_DEFAULT, channel } from './_track.mjs';

export const config = { path: ['/ops/flow', '/ops/flow/data', '/ops/flow/popup'] };

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  /* 방문자가 보낸 값(경로·버튼 문구)을 그대로 표시하는 화면 — 화면 쪽에서 전부 이스케이프하고 CSP 도 좁힌다 */
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};
const j = (o, status = 200) => new Response(JSON.stringify(o),
  { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });

const TZ = 'Asia/Seoul';
const kday = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const kmonth = d => kday(d).slice(0, 7);

/* 지난달 파일은 다시 쓰이지 않으므로 인스턴스가 살아 있는 동안 재사용 */
const _cache = new Map();
async function readMonth(ym, isCur) {
  const key = ym + '.jsonl';
  if (!isCur && _cache.has(key)) return _cache.get(key);
  const rows = await readLines('track', key);
  if (!isCur) _cache.set(key, rows);
  return rows;
}

async function readPopup() {
  try { const t = await get('ops', POPUP_KEY); if (t) return { ...POPUP_DEFAULT, ...JSON.parse(t) }; } catch (e) {}
  return { ...POPUP_DEFAULT };
}

const inc = (m, k, n = 1) => { m.set(k, (m.get(k) || 0) + n); };
const top = (m, n, map) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(map);
const isInternalPath = f => f && f.charAt(0) === '/';

async function data(days, withInternal) {
  const now = new Date();
  const from = kday(new Date(now.getTime() - (days - 1) * 864e5));   /* 오늘 포함 days 일 */
  const months = new Set();
  for (let i = 0; i < days; i++) months.add(kmonth(new Date(now.getTime() - i * 864e5)));
  const curM = kmonth(now);
  let rows = [];
  for (const m of months) rows = rows.concat(await readMonth(m, m === curM));
  const internalCount = rows.filter(r => r.in).length;
  rows = rows.filter(r => r && r.ts && r.sid && kday(new Date(r.ts)) >= from && (withInternal || !r.in));
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const sess = new Map();
  for (const r of rows) {
    let s = sess.get(r.sid);
    if (!s) sess.set(r.sid, s = { sid: r.sid, dv: r.dv, first: r.ts, last: r.ts, pv: [], ev: [], src: '', ch: '' });
    s.last = r.ts;
    if (r.t === 'pv') { s.pv.push(r); if (!s.src && r.src) { s.src = r.src; s.ch = r.ch || channel(r.src); } }
    s.ev.push(r);
  }

  const daily = new Map(), dailyS = new Map();
  for (let i = days - 1; i >= 0; i--) { const d = kday(new Date(now.getTime() - i * 864e5)); daily.set(d, 0); dailyS.set(d, new Set()); }

  const pagePv = new Map(), pageSess = new Map(), pageEntry = new Map(), pageExit = new Map(), pageTitle = new Map();
  const chS = new Map(), chPv = new Map(), landing = new Map(), extRef = new Map(), flows = new Map(), clicks = new Map();
  const popup = { view: 0, click: 0, close: 0, today: 0 }, popupPage = new Map();
  let pv = 0, clk = 0, mob = 0;

  for (const s of sess.values()) {
    if (!s.pv.length) continue;
    const ch = s.ch || '직접';
    inc(chS, ch); inc(chPv, ch, s.pv.length);
    if (s.dv === 'm') mob++;
    const land = s.pv[0].p;
    inc(landing, land + '\u0001' + ch);
    inc(pageEntry, land);
    inc(pageExit, s.pv[s.pv.length - 1].p);
    const f0 = s.pv[0].f || '';
    if (/^ext:/.test(f0)) inc(extRef, f0.slice(4));
    const seen = new Set();
    for (const r of s.pv) if (!seen.has(r.p)) { seen.add(r.p); inc(pageSess, r.p); }
  }
  for (const r of rows) {
    const d = kday(new Date(r.ts));
    if (r.t === 'pv') {
      pv++; inc(pagePv, r.p);
      if (r.tt && !pageTitle.has(r.p)) pageTitle.set(r.p, r.tt);
      if (daily.has(d)) { daily.set(d, daily.get(d) + 1); dailyS.get(d).add(r.sid); }
      if (isInternalPath(r.f) && r.f !== r.p) inc(flows, r.f + '\u0001' + r.p);
    } else if (r.t === 'click') {
      clk++; inc(clicks, [r.p, r.l || '(문구 없음)', r.to || '', r.z || ''].join('\u0001'));
    } else if (r.t === 'ev' && /^popup_/.test(r.n || '')) {
      const k = { popup_view: 'view', popup_click: 'click', popup_close: 'close', popup_hide_today: 'today' }[r.n];
      if (k) {
        popup[k]++;
        const o = popupPage.get(r.p) || { p: r.p, view: 0, click: 0, close: 0, today: 0 };
        o[k]++; popupPage.set(r.p, o);
      }
    }
  }

  const sessions = [...sess.values()].filter(s => s.pv.length);
  const journeys = sessions.slice().sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, 60).map(s => {
    const steps = [];
    for (const r of s.ev) {
      if (steps.length >= 24) break;
      if (r.t === 'pv') steps.push({ k: 'pv', p: r.p });
      else if (r.t === 'click') steps.push({ k: 'c', l: r.l || '', to: r.to || '' });
      else if (r.t === 'ev') steps.push({ k: 'e', n: r.n || '' });
    }
    return { sid: s.sid.slice(-6), ts: s.first, last: s.last, ch: s.ch || '직접', src: s.src || '', dv: s.dv, pages: s.pv.length, steps };
  });

  return {
    generated: now.toISOString(), days, from, withInternal: !!withInternal, internalCount,
    popupCfg: await readPopup(),
    kpi: {
      pv, sessions: sessions.length, clicks: clk,
      pps: sessions.length ? Math.round(pv / sessions.length * 10) / 10 : 0,
      mobile: sessions.length ? Math.round(mob / sessions.length * 100) : 0,
      bounce: sessions.length ? Math.round(sessions.filter(s => s.pv.length === 1).length / sessions.length * 100) : 0
    },
    popup: { ...popup, ctr: popup.view ? Math.round(popup.click / popup.view * 1000) / 10 : 0,
             pages: [...popupPage.values()].sort((a, b) => b.view - a.view).slice(0, 20) },
    daily: [...daily.entries()].map(([d, n]) => ({ d, pv: n, s: dailyS.get(d).size })),
    channels: top(chS, 20, ([ch, s]) => ({ ch, s, pv: chPv.get(ch) || 0 })),
    landings: top(landing, 60, ([k, n]) => { const [p, ch] = k.split('\u0001'); return { p, ch, n }; }),
    refs: top(extRef, 20, ([f, n]) => ({ f, n })),
    pages: top(pagePv, 80, ([p, n]) => ({ p, tt: pageTitle.get(p) || '', pv: n, s: pageSess.get(p) || 0,
                                          entry: pageEntry.get(p) || 0, exit: pageExit.get(p) || 0 })),
    flows: top(flows, 300, ([k, n]) => { const [f, p] = k.split('\u0001'); return { f, p, n }; }),
    clicks: top(clicks, 400, ([k, n]) => { const [p, l, to, z] = k.split('\u0001'); return { p, l, to, z, n }; }),
    journeys
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const authed = auth.configured() && auth.valid(auth.cookieFrom({ cookie: req.headers.get('cookie') || '' }));
  if (!authed) {
    if (path !== '/ops/flow') return j({ error: 'unauthorized' }, 401);
    return new Response(null, { status: 302, headers: { ...H, location: '/ops' } });
  }
  if (path === '/ops/flow/data') {
    const days = [1, 7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7;
    return j(await data(days, url.searchParams.get('inc') === '1'));
  }
  if (path === '/ops/flow/popup') {
    if (req.method !== 'POST') return j({ ok: false }, 405);
    if (!/application\/json/.test(req.headers.get('content-type') || '')) return j({ ok: false }, 415);
    let b; try { b = await req.json(); } catch (e) { return j({ ok: false, error: '요청 형식 오류' }, 400); }
    const cfg = { ...(await readPopup()), on: !!(b && b.on), at: new Date().toISOString() };
    const ok = await set('ops', POPUP_KEY, JSON.stringify(cfg));
    return j({ ok, cfg });
  }
  return new Response(PAGE, { status: 200, headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
};

const PAGE = String.raw`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive"><title>유입·경로 · Monnit</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
:root{--bg:#0B1220;--card:#111A2C;--line:#223049;--ink:#F2F5FA;--mut:#A6B3CC;--dim:#6E7C96;--acc:#7AA8FF;--dn:#FF7A7A;--up:#4FE39B;--warn:#FFC65C;--gold:#D4A93C}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.5;padding:0 0 60px}
.wrap{max-width:1180px;margin:0 auto;padding:20px 16px 0}
header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px}
h1{font-size:19px;font-weight:800;letter-spacing:-.01em}
h1 small{display:block;font-size:12.5px;font-weight:500;color:var(--dim);margin-top:2px}
h2{font-size:15px;font-weight:700;margin-bottom:10px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
h2 span{font-size:12px;color:var(--dim);font-weight:500}
.btn{background:#1A2640;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:7px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--acc)} .btn.on{background:var(--acc);color:#06101F;border-color:var(--acc)}
.seg{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.sec{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px;min-width:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.kpi b{display:block;font-size:23px;font-weight:800;font-variant-numeric:tabular-nums}
.kpi span{font-size:12px;color:var(--mut)}
.tbl{overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:460px;overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{color:var(--dim);font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--card)}
td{padding:7px 8px;border-bottom:1px solid #1A2438;vertical-align:top}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pth{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
.pth.lk{color:var(--acc);cursor:pointer}
.pth.lk:hover{text-decoration:underline}
.tt{display:block;color:var(--dim);font-size:11.5px}
.tag{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--mut);white-space:nowrap}
.bar{height:6px;border-radius:3px;background:var(--acc);opacity:.75;min-width:2px}
.empty{color:var(--dim);font-size:12.5px;padding:10px 2px}
.hint{font-size:12px;color:var(--dim);margin-top:8px;line-height:1.6}
.pop{display:flex;gap:16px;align-items:center;flex-wrap:wrap;border-color:rgba(212,169,60,.35);background:linear-gradient(120deg,rgba(212,169,60,.07),rgba(17,26,44,1) 55%)}
.pop .t{flex:1 1 280px;min-width:0}
.pop .t b{font-size:15px}
.pop .t p{font-size:12.5px;color:var(--mut);margin-top:3px;word-break:break-all}
.sw{position:relative;width:58px;height:32px;border-radius:99px;border:1px solid var(--line);background:#1A2640;cursor:pointer;flex:0 0 auto;transition:background .2s}
.sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#A6B3CC;transition:transform .2s,background .2s}
.sw.on{background:var(--gold);border-color:var(--gold)} .sw.on i{transform:translateX(26px);background:#fff}
.swl{font-weight:700;font-size:13px;min-width:40px}
.pstats{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--mut)}
.pstats b{color:var(--ink);font-variant-numeric:tabular-nums}
.chart{display:flex;align-items:flex-end;gap:3px;height:90px;padding-top:6px}
.chart div{flex:1;background:var(--acc);opacity:.7;border-radius:3px 3px 0 0;min-height:2px;position:relative}
.chart div:hover{opacity:1}
.cx{display:flex;justify-content:space-between;font-size:11px;color:var(--dim);margin-top:4px}
.sel{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
select{background:#0E1626;border:1px solid var(--line);color:var(--ink);border-radius:9px;padding:7px 10px;font:inherit;font-size:13px;max-width:100%}
.jn{padding:10px 0;border-bottom:1px solid #1A2438}
.jn:last-child{border-bottom:0}
.jh{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--mut);margin-bottom:6px}
.js{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.st{font-size:11.5px;padding:2px 8px;border-radius:7px;background:#16223A;border:1px solid var(--line);word-break:break-all}
.st.c{background:rgba(122,168,255,.08);border-color:rgba(122,168,255,.35);color:#BFD3FF}
.st.e{background:rgba(212,169,60,.1);border-color:rgba(212,169,60,.4);color:#F1D58C}
.ar{color:var(--dim);font-size:11px}
label.chk{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:var(--mut);cursor:pointer}
.msg{font-size:12px;color:var(--up);min-height:16px}
[hidden]{display:none!important}
</style></head><body><style>.opsnav{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(8,12,22,.85);backdrop-filter:blur(10px);overflow-x:auto;position:sticky;top:0;z-index:50;font-family:inherit}
.opsnav a{color:#A6B3CC;text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.opsnav a:hover{color:#F2F5FA}.opsnav a.on{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}</style>
<nav class="opsnav" aria-label="관제 메뉴"><a href="/ops">통합 관제</a><a href="/ops/proposals">맞춤 제안서</a><a href="/ops/proposals/archive">발송 대장</a><a href="/ops/proposals/insights">고객 인사이트</a><a href="/ops/flow" class="on">유입·경로</a><a href="/ops/block">차단 관리</a></nav>
<div class="wrap">
<header>
 <h1>유입 · 이동 경로<small>어디서 들어와서 · 무엇을 눌러 · 어디로 갔는지 (개인 식별 정보 없이 탭 단위로 집계)</small></h1>
 <div class="seg">
  <button class="btn" data-d="1">오늘</button><button class="btn on" data-d="7">7일</button><button class="btn" data-d="30">30일</button><button class="btn" data-d="90">90일</button>
  <label class="chk"><input type="checkbox" id="inc"> 내부 접속 포함</label>
  <button class="btn" id="rf">새로고침</button>
 </div>
</header>

<section class="sec pop">
 <div class="sw" id="sw" role="switch" aria-checked="false" tabindex="0" aria-label="사이트 팝업 켜기/끄기"><i></i></div>
 <span class="swl" id="swl">—</span>
 <div class="t"><b>사이트 팝업 · 한옥 배너</b>
  <p>누르면 → /proposal (공공·교육·문화 · 공기질·환경 맞춤 제안). 탭당 1회 · 「오늘 하루 보지 않기」 지원 · 켜고 끄면 1분 안에 전 페이지 반영</p>
  <div class="msg" id="swm"></div></div>
 <div class="pstats" id="pst"></div>
</section>

<div class="kpis" id="kpis"></div>

<section class="sec"><h2>일자별 방문 <span id="dRange"></span></h2><div class="chart" id="chart"></div><div class="cx" id="cx"></div></section>

<div class="grid2">
 <section class="sec"><h2>유입 채널 <span>세션 기준 · 첫 방문 시 출처</span></h2><div class="tbl" id="tCh"></div></section>
 <section class="sec"><h2>외부 유입 사이트 <span>리퍼러 도메인</span></h2><div class="tbl" id="tRef"></div></section>
</div>

<section class="sec"><h2>첫 페이지(랜딩) × 채널 <span>어디로 처음 들어왔나</span></h2><div class="tbl" id="tLand"></div></section>

<section class="sec"><h2>페이지별 <span>경로를 누르면 그 페이지의 들어온 곳·누른 것·나간 곳을 봅니다</span></h2><div class="tbl" id="tPg"></div></section>

<section class="sec" id="detail">
 <h2>페이지 상세 <span>선택한 페이지 기준</span></h2>
 <div class="sel"><select id="pgSel"></select></div>
 <div class="grid2">
  <div><h2 style="font-size:13.5px">← 어디서 왔나</h2><div class="tbl" id="tIn"></div></div>
  <div><h2 style="font-size:13.5px">→ 어디로 갔나 (다음 페이지)</h2><div class="tbl" id="tOut"></div></div>
 </div>
 <h2 style="font-size:13.5px;margin-top:14px">이 페이지에서 누른 것</h2><div class="tbl" id="tPgClk"></div>
</section>

<div class="grid2">
 <section class="sec"><h2>페이지 이동 Top <span>사이트 안 A → B</span></h2><div class="tbl" id="tFlow"></div></section>
 <section class="sec"><h2>클릭 Top <span>버튼·링크 문구 → 이동할 곳</span></h2><div class="tbl" id="tClk"></div></section>
</div>

<section class="sec"><h2>최근 방문 흐름 <span>세션 하나가 밟은 순서 (최근 60건)</span></h2><div id="jn"></div></section>
<p class="hint">· 기록 대상: 사이트 공개 페이지(관제·에디터 제외). 관제에 로그인한 브라우저의 접속은 「내부」로 따로 표시되어 기본 집계에서 빠집니다.<br>· 채널: utm_source·gclid·fbclid·리퍼러로 판정합니다. 광고 링크에는 utm 을 꼭 붙여야 정확합니다.<br>· 원장: Netlify Blobs <b>track</b> 저장소 · 월별 파일.</p>
</div>
<script>
(function(){
var D=null, days=7, sel='';
var $=function(s){return document.querySelector(s)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nf(n){return Number(n||0).toLocaleString('ko-KR')}
function pth(p,link){return '<span class="pth'+(link?' lk':'')+'"'+(link?' data-p="'+esc(p)+'"':'')+'>'+esc(p||'(없음)')+'</span>'}
function dest(to){ if(!to) return '<span class="tag">동작</span>';
  if(to==='tel') return '<span class="tag">전화</span>'; if(to==='mail') return '<span class="tag">메일</span>';
  if(to.indexOf('ext:')===0) return '<span class="tag">외부</span> '+pth(to.slice(4));
  if(to.charAt(0)==='#') return '<span class="tag">앵커</span> '+pth(to);
  return pth(to.split('?')[0],true)+(to.indexOf('?')>0?'<span class="tt">?'+esc(to.split('?')[1])+'</span>':''); }
function zone(z){var m={nav:'메뉴',header:'상단',footer:'하단',dialog:'팝업·모달',aside:'사이드'};return z?'<span class="tag">'+esc(m[z]||z)+'</span>':''}
function from(f){ if(!f) return '<span class="tag">직접·북마크</span>'; if(f.indexOf('ext:')===0) return '<span class="tag">외부</span> '+pth(f.slice(4)); return pth(f,true) }
function table(head,rows,empty){ if(!rows.length) return '<div class="empty">'+(empty||'기록 없음')+'</div>';
  return '<table><thead><tr>'+head.map(function(h){return '<th'+(h.n?' class="n"':'')+'>'+h.t+'</th>'}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>' }
function barW(n,max){return '<div class="bar" style="width:'+Math.max(2,Math.round(n/Math.max(1,max)*100))+'%"></div>'}

function load(){
  $('#rf').disabled=true;
  fetch('/ops/flow/data?days='+days+($('#inc').checked?'&inc=1':''),{credentials:'same-origin'})
   .then(function(r){ if(r.status===401){location.href='/ops';return null} return r.json() })
   .then(function(j){ if(!j) return; D=j; render(); })
   .catch(function(){ $('#kpis').innerHTML='<div class="empty">불러오지 못했습니다. 새로고침을 눌러 주세요.</div>' })
   .finally(function(){ $('#rf').disabled=false });
}
function setSw(on){ var s=$('#sw'); s.classList.toggle('on',!!on); s.setAttribute('aria-checked',on?'true':'false'); $('#swl').textContent=on?'켜짐':'꺼짐'; $('#swl').style.color=on?'var(--gold)':'var(--dim)'; }
function render(){
  var k=D.kpi, P=D.popup;
  setSw(D.popupCfg && D.popupCfg.on);
  $('#pst').innerHTML='<span>노출 <b>'+nf(P.view)+'</b></span><span>클릭 <b>'+nf(P.click)+'</b></span><span>클릭률 <b>'+P.ctr+'%</b></span><span>닫기 <b>'+nf(P.close)+'</b></span><span>오늘 그만 <b>'+nf(P.today)+'</b></span>';
  $('#kpis').innerHTML=[['방문(세션)',k.sessions],['페이지 보기',k.pv],['클릭',k.clicks],['세션당 페이지',k.pps],['한 페이지만 보고 이탈',k.bounce+'%'],['모바일 비중',k.mobile+'%']]
    .map(function(x){return '<div class="kpi"><b>'+(typeof x[1]==='number'?nf(x[1]):x[1])+'</b><span>'+x[0]+'</span></div>'}).join('')
    +(D.internalCount&&!D.withInternal?'<div class="kpi"><b>'+nf(D.internalCount)+'</b><span>제외된 내부 기록</span></div>':'');
  var mx=Math.max.apply(null,D.daily.map(function(d){return d.s}).concat([1]));
  $('#chart').innerHTML=D.daily.map(function(d){return '<div title="'+d.d+' · 세션 '+d.s+' · 페이지 '+d.pv+'" style="height:'+Math.max(2,Math.round(d.s/mx*100))+'%"></div>'}).join('');
  $('#cx').innerHTML='<span>'+(D.daily[0]||{}).d+'</span><span>'+(D.daily[D.daily.length-1]||{}).d+'</span>';
  $('#dRange').textContent=D.from+' 부터 · 막대=세션';
  var chMax=(D.channels[0]||{}).s||1;
  $('#tCh').innerHTML=table([{t:'채널'},{t:'세션',n:1},{t:'페이지',n:1},{t:''}],D.channels.map(function(c){return '<tr><td>'+esc(c.ch)+'</td><td class="n">'+nf(c.s)+'</td><td class="n">'+nf(c.pv)+'</td><td style="width:40%">'+barW(c.s,chMax)+'</td></tr>'}));
  $('#tRef').innerHTML=table([{t:'사이트'},{t:'세션',n:1}],D.refs.map(function(r){return '<tr><td>'+pth(r.f)+'</td><td class="n">'+nf(r.n)+'</td></tr>'}),'외부 사이트에서 넘어온 기록이 아직 없습니다');
  $('#tLand').innerHTML=table([{t:'첫 페이지'},{t:'채널'},{t:'세션',n:1}],D.landings.map(function(r){return '<tr><td>'+pth(r.p,true)+'</td><td>'+esc(r.ch)+'</td><td class="n">'+nf(r.n)+'</td></tr>'}));
  $('#tPg').innerHTML=table([{t:'페이지'},{t:'보기',n:1},{t:'세션',n:1},{t:'첫 진입',n:1},{t:'마지막(이탈)',n:1}],D.pages.map(function(r){return '<tr><td>'+pth(r.p,true)+(r.tt?'<span class="tt">'+esc(r.tt)+'</span>':'')+'</td><td class="n">'+nf(r.pv)+'</td><td class="n">'+nf(r.s)+'</td><td class="n">'+nf(r.entry)+'</td><td class="n">'+nf(r.exit)+'</td></tr>'}));
  $('#tFlow').innerHTML=table([{t:'어디서'},{t:'→ 어디로'},{t:'횟수',n:1}],D.flows.slice(0,60).map(function(r){return '<tr><td>'+pth(r.f,true)+'</td><td>'+pth(r.p,true)+'</td><td class="n">'+nf(r.n)+'</td></tr>'}));
  $('#tClk').innerHTML=table([{t:'페이지'},{t:'누른 것'},{t:'→ 이동'},{t:'횟수',n:1}],D.clicks.slice(0,80).map(function(r){return '<tr><td>'+pth(r.p,true)+'</td><td>'+esc(r.l)+' '+zone(r.z)+'</td><td>'+dest(r.to)+'</td><td class="n">'+nf(r.n)+'</td></tr>'}));
  var opts=D.pages.map(function(r){return r.p});
  if(!sel||opts.indexOf(sel)<0) sel=opts[0]||'';
  $('#pgSel').innerHTML=opts.map(function(p){return '<option'+(p===sel?' selected':'')+'>'+esc(p)+'</option>'}).join('');
  detail();
  $('#jn').innerHTML=D.journeys.length?D.journeys.map(function(s){
    var t=new Date(s.ts), tt=t.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return '<div class="jn"><div class="jh"><span>'+tt+'</span><span class="tag">'+esc(s.ch)+'</span><span class="tag">'+(s.dv==='m'?'모바일':'PC')+'</span><span>'+s.pages+'페이지</span>'+(s.src&&s.src!=='direct'?'<span class="pth" style="color:var(--dim)">'+esc(s.src)+'</span>':'')+'</div><div class="js">'
     +s.steps.map(function(x,i){ var a=i?'<span class="ar">›</span>':'';
        if(x.k==='pv') return a+'<span class="st">'+esc(x.p)+'</span>';
        if(x.k==='c') return a+'<span class="st c">클릭 · '+esc(x.l||'클릭')+(x.to&&x.to.charAt(0)!=='#'?' → '+esc(x.to.replace(/^ext:/,'외부 ')):'')+'</span>';
        return a+'<span class="st e">'+esc({popup_view:'팝업 노출',popup_click:'팝업 클릭',popup_close:'팝업 닫기',popup_hide_today:'오늘 그만 보기'}[x.n]||x.n)+'</span>'; }).join('')
     +'</div></div>' }).join(''):'<div class="empty">기록 없음</div>';
}
function detail(){
  if(!D) return;
  var p=sel;
  var inFlow=D.flows.filter(function(r){return r.p===p}).map(function(r){return {k:r.f,n:r.n,t:'이동'}});
  var inLand=D.landings.filter(function(r){return r.p===p}).map(function(r){return {k:'',ch:r.ch,n:r.n,t:'첫 진입'}});
  var rowsIn=inLand.map(function(r){return '<tr><td><span class="tag">첫 진입</span> '+esc(r.ch)+'</td><td class="n">'+nf(r.n)+'</td></tr>'})
    .concat(inFlow.map(function(r){return '<tr><td>'+from(r.k)+'</td><td class="n">'+nf(r.n)+'</td></tr>'}));
  $('#tIn').innerHTML=table([{t:'출처'},{t:'횟수',n:1}],rowsIn);
  var out=D.flows.filter(function(r){return r.f===p});
  var pg=D.pages.filter(function(r){return r.p===p})[0];
  var rowsOut=out.map(function(r){return '<tr><td>'+pth(r.p,true)+'</td><td class="n">'+nf(r.n)+'</td></tr>'});
  if(pg&&pg.exit) rowsOut.push('<tr><td><span class="tag">여기서 이탈</span></td><td class="n">'+nf(pg.exit)+'</td></tr>');
  $('#tOut').innerHTML=table([{t:'다음 페이지'},{t:'횟수',n:1}],rowsOut);
  $('#tPgClk').innerHTML=table([{t:'누른 것'},{t:'→ 이동'},{t:'횟수',n:1}],D.clicks.filter(function(r){return r.p===p}).slice(0,60).map(function(r){return '<tr><td>'+esc(r.l)+' '+zone(r.z)+'</td><td>'+dest(r.to)+'</td><td class="n">'+nf(r.n)+'</td></tr>'}));
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-d]'); if(b){ days=+b.getAttribute('data-d'); document.querySelectorAll('[data-d]').forEach(function(x){x.classList.toggle('on',x===b)}); load(); return; }
  var l=e.target.closest('.pth.lk'); if(l&&D){ var p=l.getAttribute('data-p'); if(D.pages.some(function(r){return r.p===p})){ sel=p; $('#pgSel').value=p; detail(); document.getElementById('detail').scrollIntoView({behavior:'smooth',block:'start'}); } }
});
$('#pgSel').addEventListener('change',function(){sel=this.value;detail()});
$('#rf').addEventListener('click',load);
$('#inc').addEventListener('change',load);
function toggle(){
  var on=!$('#sw').classList.contains('on'); setSw(on); $('#swm').textContent='저장 중…';
  fetch('/ops/flow/popup',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:on})})
   .then(function(r){return r.json()}).then(function(j){ if(!j.ok) throw 0; setSw(j.cfg.on); $('#swm').textContent=(j.cfg.on?'켰습니다':'껐습니다')+' — 1분 안에 모든 페이지에 반영됩니다'; })
   .catch(function(){ setSw(!on); $('#swm').textContent='저장하지 못했습니다. 다시 눌러 주세요.'; $('#swm').style.color='var(--dn)'; });
}
$('#sw').addEventListener('click',toggle);
$('#sw').addEventListener('keydown',function(e){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); toggle(); } });
load();
})();
</script></body></html>`;
