/** 경쟁사 차단 관리 화면 — /ops/block (2026-09-16)
 *
 *  /ops 와 같은 로그인(mk_ops 쿠키)을 쓴다. 로그인 안 했으면 /ops 로 보낸다.
 *    GET  /ops/block        화면
 *    GET  /ops/block/data   규칙 · 차단 기록 · 최근 리드(IP 포함)
 *    POST /ops/block/save   규칙 추가/삭제  { op, kind, v, scope, days, memo }
 *    GET  /ops/block/visits?day=YYYY-MM-DD   그날 방문한 IP 목록
 *    GET  /ops/block/ip?ip=1.2.3.4           한 IP 의 최근 30일 방문 내역
 *
 *  규칙은 ops 저장소 blocklist.json 에 저장되고, 1분 안에 아래 모두에 반영된다.
 *    · 사이트 전체 차단   netlify/edge-functions/block-ip.js
 *    · 자료·접수 차단     sendpw · getdoc · sendguide · lead (_guard.js) */
import * as auth from './_ops_auth.mjs';
import { readLines } from './_store.mjs';
import * as V from './_visits.mjs';
import G from './_guard.js';

export const config = { path: ['/ops/block', '/ops/block/data', '/ops/block/save', '/ops/block/visits', '/ops/block/ip'] };

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  /* _headers 의 CSP 는 정적 파일에만 붙는다. 함수가 내는 화면은 직접 달아야 한다. (2026-09-19)
     차단 목록에는 방문자가 보낸 값(UA·경로)이 그대로 표시되므로 여기가 XSS 가 닿기 쉬운 곳이다. */
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};
const j = (o, status = 200) => new Response(JSON.stringify(o),
  { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });


function months(n) {
  const out = [], d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15));
    out.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(x).slice(0, 7));
  }
  return out;
}

async function data() {
  const stored = await G.readStored();
  const eff = await G.rules(true);
  const ms = months(3);
  let hits = [], leads = [];
  for (const m of ms) {
    hits = hits.concat(await readLines('ops', 'blocked-' + m + '.jsonl'));
    leads = leads.concat(await readLines('leads', m + '.jsonl'));
  }
  hits.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  leads.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  const env = k => String(process.env[k] || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  return {
    now: Date.now(),
    defaults: G.DEFAULTS,
    env: { domains: env('BLOCK_DOMAINS'), companies: env('BLOCK_COMPANIES'), phones: env('BLOCK_PHONES'), ips: env('BLOCK_IPS') },
    stored,
    hits: hits.slice(0, 400),
    leads: leads.slice(0, 300).map(r => {
      /* 이 리드가 지금 규칙에 걸리는지 표시 — 차단 이전에 들어온 기록 확인용 */
      const em = String(r.email || '').toLowerCase(), dom = em.split('@')[1] || '';
      const co = G.normCompany(r.company), ph = G.normPhone(r.phone);
      const why = (dom && eff.domains.some(d => dom === d || dom.endsWith('.' + d))) ? '도메인'
        : (co && eff.companies.some(c => co.includes(c))) ? '회사명'
        : (ph.length >= 8 && eff.phones.includes(ph)) ? '전화'
        : (r.ip && eff.ips.some(x => G.ipMatch(r.ip, x.v))) ? 'IP' : '';
      return { ts: r.ts, company: r.company, name: r.name, email: r.email, phone: r.phone,
               ip: r.ip || '', ua: r.ua || '', point: r.point, interest: r.interest, channel: r.channel, match: why };
    }),
    freeMail: G.FREE_MAIL,
    days: V.days(14)
  };
}

async function save(req) {
  let b;
  try { b = await req.json(); } catch (e) { return j({ ok: false, error: '요청 형식 오류' }, 400); }
  const kind = String(b.kind || ''), op = String(b.op || '');
  if (!G.KINDS.includes(kind) || !['add', 'remove'].includes(op)) return j({ ok: false, error: '요청 형식 오류' }, 400);
  const r = op === 'remove'
    ? await G.removeRule(kind, b.v)
    : await G.addRule(kind, b.v, { scope: b.scope, days: b.days, memo: b.memo, by: 'ops' });
  return j({ ok: r.ok, error: r.error });
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const authed = auth.configured() && auth.valid(auth.cookieFrom({ cookie: req.headers.get('cookie') || '' }));

  if (!authed) {
    if (path !== '/ops/block') return j({ error: 'unauthorized' }, 401);
    return new Response(null, { status: 302, headers: { ...H, location: '/ops' } });
  }
  if (path === '/ops/block/data') return j(await data());
  if (path === '/ops/block/visits') {
    const day = new URL(req.url).searchParams.get('day') || V.kday(new Date());
    V.cleanup(200).catch(() => {});                 /* 90일 지난 기록을 조금씩 정리 */
    return j(await V.daySummary(day, 300));
  }
  if (path === '/ops/block/ip') {
    const ip = G.normIp(new URL(req.url).searchParams.get('ip'));
    if (!ip) return j({ error: 'ip 필요' }, 400);
    return j({ ip, status: await G.ipStatus(ip), rows: await V.ipHistory(ip, 30, 300) });
  }
  if (path === '/ops/block/save') {
    if (req.method !== 'POST') return j({ ok: false }, 405);
    if (!/application\/json/.test(req.headers.get('content-type') || '')) return j({ ok: false }, 415);
    return save(req);
  }
  return new Response(PAGE, { status: 200, headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
};

const PAGE = String.raw`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive"><title>차단 관리 · Monnit</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
:root{--bg:#0B1220;--card:#111A2C;--line:#223049;--ink:#F2F5FA;--mut:#A6B3CC;--dim:#6E7C96;--acc:#7AA8FF;--dn:#FF7A7A;--up:#4FE39B;--warn:#FFC65C}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:var(--bg);color:var(--ink);
font-size:14px;line-height:1.5;padding:20px 16px 60px}
.wrap{max-width:1100px;margin:0 auto}
header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:18px}
h1{font-size:19px;font-weight:800;letter-spacing:-.01em}
h1 small{display:block;font-size:12.5px;font-weight:500;color:var(--dim);margin-top:2px}
h2{font-size:15px;font-weight:700;margin-bottom:10px;display:flex;gap:8px;align-items:baseline}
h2 span{font-size:12px;color:var(--dim);font-weight:500}
.btn{background:#1A2640;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:8px 13px;font:inherit;font-size:13px;
font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;white-space:nowrap}
.btn:hover{border-color:var(--acc)}
.btn.pri{background:var(--acc);color:#06101F;border-color:var(--acc)}
.btn.bad{color:var(--dn)}
.btn.sm{padding:4px 9px;font-size:12px;border-radius:7px}
.btn[disabled]{opacity:.35;cursor:default}
.sec{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.kpi b{display:block;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}
.kpi span{font-size:12px;color:var(--mut)}
form.add{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
select,input{background:#0E1626;border:1px solid var(--line);color:var(--ink);border-radius:9px;padding:8px 10px;font:inherit;font-size:13px}
input.v{flex:1 1 200px;min-width:0}
input.m{flex:1 1 160px;min-width:0}
.hint{font-size:12px;color:var(--dim);margin-top:8px}
.msg{font-size:12.5px;margin-top:8px;min-height:18px}
.msg.bad{color:var(--dn)} .msg.ok{color:var(--up)}
.tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px}
th{color:var(--dim);font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:7px 8px;border-bottom:1px solid #1A2438;vertical-align:top}
td.mono,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
tr.hit td{background:rgba(255,122,122,.06)}
.tag{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--mut);white-space:nowrap}
.tag.site{color:var(--dn);border-color:rgba(255,122,122,.4)}
.tag.gate{color:var(--warn);border-color:rgba(255,198,92,.4)}
.tag.auto{color:var(--acc);border-color:rgba(122,168,255,.4)}
.tag.lock{color:var(--dim)}
.acts{display:flex;gap:4px;flex-wrap:wrap}
.empty{color:var(--dim);font-size:12.5px;padding:10px 2px}
.filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
[hidden]{display:none!important}
.pg{max-width:340px;word-break:break-all}
.lead{color:var(--warn);font-weight:700}
</style></head><body><style>.opsnav{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(8,12,22,.85);backdrop-filter:blur(10px);overflow-x:auto;position:sticky;top:0;z-index:50;font-family:inherit}
.opsnav a{color:#A6B3CC;text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.opsnav a:hover{color:#F2F5FA}.opsnav a.on{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}</style>
<nav class="opsnav" aria-label="관제 메뉴"><a href="/ops">통합 관제</a><a href="/ops/proposals">맞춤 제안서</a><a href="/ops/proposals/archive">발송 대장</a><a href="/ops/proposals/insights">고객 인사이트</a><a href="/ops/flow">유입·경로</a><a href="/ops/block" class="on">차단 관리</a></nav><div class="wrap">
<header>
  <h1>경쟁사 차단 관리<small>막힌 상대에게는 차단 사실을 알리지 않습니다 · 변경은 1분 안에 반영됩니다</small></h1>
  <div class="acts"><a class="btn" href="/ops">← 관제 화면</a><button class="btn" id="reload">새로고침</button></div>
</header>

<div class="kpis" id="kpis"></div>

<div class="sec">
  <h2>차단 추가</h2>
  <form class="add" id="addForm">
    <select id="kind">
      <option value="ips">접속 IP</option>
      <option value="domains">이메일 도메인</option>
      <option value="companies">회사명</option>
      <option value="phones">전화번호</option>
    </select>
    <input class="v" id="val" placeholder="1.2.3.4 · 1.2.3.0/24 · 1.2.3.*" autocomplete="off" required>
    <select id="scope"><option value="site">사이트 전체</option><option value="gate">자료·접수만</option></select>
    <select id="days"><option value="0">영구</option><option value="90">90일</option><option value="30">30일</option><option value="7">7일</option></select>
    <input class="m" id="memo" placeholder="메모 (예: 데키스트 사무실)" maxlength="80">
    <button class="btn pri" type="submit">추가</button>
  </form>
  <div class="msg" id="addMsg"></div>
  <p class="hint">사이트 전체 = 어떤 페이지도 못 엽니다 · 자료·접수만 = 페이지는 보이지만 자료 링크·문의 접수가 조용히 무시됩니다.<br>
  휴대폰(통신사) IP 는 여러 사람이 같이 쓰므로 「자료·접수만」 + 기간 지정을 권합니다.</p>
</div>

<div class="sec">
  <h2>방문 기록 <span id="visSum">IP 별 · 90일 보관</span></h2>
  <div class="filter">
    <select id="visDay"></select>
    <input id="visQ" placeholder="IP · 지역 · 페이지 검색" style="flex:1 1 200px">
    <input id="ipLook" placeholder="IP 바로 조회 (최근 30일)" style="flex:1 1 180px">
    <button class="btn" id="ipGo">조회</button>
  </div>
  <div class="tbl"><table><thead><tr><th>마지막</th><th>IP</th><th>뷰</th><th>지역</th><th>기기</th><th>마지막 페이지 · 유입</th><th>리드</th><th></th></tr></thead>
  <tbody id="vis"><tr><td colspan="8" class="empty">불러오는 중…</td></tr></tbody></table></div>
</div>

<div class="sec" id="ipBox" hidden>
  <h2>IP 상세 <span id="ipTitle"></span></h2>
  <div class="acts" id="ipActs" style="margin-bottom:10px"></div>
  <div class="tbl"><table><thead><tr><th>시각</th><th>페이지</th><th>유입</th><th>지역</th><th>기기</th></tr></thead>
  <tbody id="ipRows"></tbody></table></div>
</div>

<div class="sec">
  <h2>차단 규칙 <span id="ruleCount"></span></h2>
  <div class="tbl"><table><thead><tr><th>종류</th><th>값</th><th>범위</th><th>출처</th><th>만료</th><th>메모</th><th></th></tr></thead>
  <tbody id="rules"></tbody></table></div>
</div>

<div class="sec">
  <h2>차단된 시도 <span>최근 3개월 · 새로 잡힌 IP 는 자동으로 목록에 들어갑니다</span></h2>
  <div class="tbl"><table><thead><tr><th>시각</th><th>위치</th><th>IP</th><th>사유</th><th>회사 / 이메일</th><th>자료</th><th>기기</th><th></th></tr></thead>
  <tbody id="hits"></tbody></table></div>
</div>

<div class="sec">
  <h2>최근 리드 <span>IP 는 2026-09-16 배포 이후 접수부터 기록됩니다</span></h2>
  <div class="filter"><input id="q" placeholder="회사·이메일·IP 검색" style="flex:1 1 220px"></div>
  <div class="tbl"><table><thead><tr><th>시각</th><th>회사 / 담당자</th><th>이메일 · 전화</th><th>IP</th><th>접점</th><th>상태</th><th>바로 차단</th></tr></thead>
  <tbody id="leads"></tbody></table></div>
</div>
</div>
<script>
(function(){
var D=null;
var KIND={ips:'IP',domains:'도메인',companies:'회사명',phones:'전화'};
var WHERE={sendpw:'자료 신청',getdoc:'자료 열기',sendguide:'가이드 메일',lead:'문의 접수'};
var BY={domain:'도메인',company:'회사명',phone:'전화',ip:'IP'};
function $(s){return document.querySelector(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function t(ts){ if(!ts) return ''; var d=new Date(ts); if(isNaN(d)) return esc(ts);
  return d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}); }
function day(ms){ return new Date(ms).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}); }
function dev(ua){ ua=ua||''; var m=mobile(ua);
  var b=/kakaotalk/i.test(ua)?'카카오톡':/instagram/i.test(ua)?'인스타':/fban|fbav/i.test(ua)?'페이스북':/naver/i.test(ua)?'네이버앱':/edg\//i.test(ua)?'Edge':/whale/i.test(ua)?'Whale':/chrome|crios/i.test(ua)?'Chrome':/safari/i.test(ua)?'Safari':/firefox/i.test(ua)?'Firefox':/curl|python|wget|java|go-http|node|axios|headless/i.test(ua)?'스크립트':'기타';
  return (m?'휴대폰':'PC')+' · '+b; }
function host(u){ try{ var h=new URL(u).hostname; return /monnit\.co\.kr$/.test(h)?'':h; }catch(e){ return ''; } }
function geo(o){ return [o.city,o.r,o.c&&o.c!=='KR'?o.c:''].filter(Boolean).join(' · '); }
function leadMap(){ var m={}; (D&&D.leads||[]).forEach(function(l){ if(l.ip&&!m[l.ip]) m[l.ip]=l.company||l.email||'리드'; }); return m; }
function mobile(ua){ return /iphone|ipad|ipod|android|mobile|kakaotalk|fban|fbav|instagram/i.test(ua||''); }

function load(){
  fetch('/ops/block/data',{credentials:'same-origin'}).then(function(r){
    if(r.status===401){ location.href='/ops'; throw 0; } return r.json();
  }).then(function(d){ D=d; render(); fillDays(); }).catch(function(e){ if(e!==0) $('#addMsg').textContent='불러오기 실패'; });
}

function ipState(ip){
  if(!D||!ip) return null;
  var all=[].concat(
    D.defaults.ips.map(function(v){return {v:v,scope:'site'};}),
    D.env.ips.map(function(v){return {v:v,scope:'site'};}),
    D.stored.ips.filter(function(x){return !x.until||x.until>D.now;}));
  for(var i=0;i<all.length;i++) if(match(ip,all[i].v)) return all[i].scope||'site';
  return null;
}
function v4(ip){var p=String(ip).split('.');if(p.length!==4)return null;var n=0;for(var i=0;i<4;i++){if(!/^\d{1,3}$/.test(p[i]))return null;n=n*256+Number(p[i]);}return n;}
function match(ip,r){ip=String(ip).toLowerCase();r=String(r).toLowerCase();if(ip===r)return true;
  if(r.slice(-1)==='*')return ip.indexOf(r.slice(0,-1))===0;
  var m=/^([\d.]+)\/(\d{1,2})$/.exec(r);if(m){var a=v4(ip),b=v4(m[1]),k=Math.pow(2,32-Number(m[2]));if(a==null||b==null)return false;return Math.floor(a/k)===Math.floor(b/k);}
  return false;}

function render(){
  var st=D.stored, now=D.now;
  var live=st.ips.filter(function(x){return !x.until||x.until>now;});
  var siteN=live.filter(function(x){return (x.scope||'site')==='site';}).length+D.env.ips.length+D.defaults.ips.length;
  var gateN=live.filter(function(x){return x.scope==='gate';}).length;
  var monthKey=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).slice(0,7);
  var monthHits=D.hits.filter(function(h){return new Date(h.ts).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).slice(0,7)===monthKey;}).length;
  var ipsSeen={}; D.hits.forEach(function(h){ if(h.ip) ipsSeen[h.ip]=1; });
  $('#kpis').innerHTML=
    '<div class="kpi"><b>'+monthHits+'</b><span>이번 달 차단된 시도</span></div>'+
    '<div class="kpi"><b>'+Object.keys(ipsSeen).length+'</b><span>잡힌 IP (3개월)</span></div>'+
    '<div class="kpi"><b>'+siteN+'</b><span>사이트 전체 차단 IP</span></div>'+
    '<div class="kpi"><b>'+gateN+'</b><span>자료·접수 차단 IP</span></div>';

  /* 규칙 표 */
  var rows=[];
  ['domains','companies','phones','ips'].forEach(function(k){
    D.defaults[k].forEach(function(v){ rows.push({k:k,v:v,src:'기본값',lock:1,scope:k==='ips'?'site':''}); });
    D.env[k].forEach(function(v){ rows.push({k:k,v:v,src:'환경변수',lock:1,scope:k==='ips'?'site':''}); });
    st[k].forEach(function(x){
      if(x.until && x.until<=now) return;
      rows.push({k:k,v:x.v,src:x.src==='auto'?'자동 수집':'직접 추가',auto:x.src==='auto',scope:k==='ips'?(x.scope||'site'):'',until:x.until,memo:x.memo,n:x.n,ua:x.ua});
    });
  });
  $('#ruleCount').textContent=rows.length+'건';
  $('#rules').innerHTML=rows.length?rows.map(function(r){
    var sc=r.scope==='site'?'<span class="tag site">사이트 전체</span>':r.scope==='gate'?'<span class="tag gate">자료·접수만</span>':'<span class="tag">자료·접수</span>';
    var src=r.lock?'<span class="tag lock">'+r.src+'</span>':r.auto?'<span class="tag auto">'+r.src+(r.n>1?' ×'+r.n:'')+'</span>':'<span class="tag">'+r.src+'</span>';
    var act=r.lock?'<span class="hint" style="margin:0">'+(r.src==='기본값'?'코드':'Netlify')+'에서 변경</span>':
      '<div class="acts">'+
      (r.auto&&r.k==='ips'?'<button class="btn sm" data-keep="'+esc(r.v)+'" data-scope="'+r.scope+'">영구 확정</button>':'')+
      (r.k==='ips'&&r.scope==='gate'?'<button class="btn sm" data-up="'+esc(r.v)+'">전체 차단으로</button>':'')+
      '<button class="btn sm bad" data-del="'+esc(r.v)+'" data-kind="'+r.k+'">해제</button></div>';
    return '<tr><td>'+KIND[r.k]+'</td><td class="mono">'+esc(r.v)+'</td><td>'+sc+'</td><td>'+src+'</td><td>'+(r.until?day(r.until):'영구')+
      '</td><td>'+esc(r.memo||'')+'</td><td>'+act+'</td></tr>';
  }).join(''):'<tr><td colspan="7" class="empty">규칙이 없습니다</td></tr>';

  /* 차단 시도 */
  $('#hits').innerHTML=D.hits.length?D.hits.map(function(h){
    var s=ipState(h.ip);
    var btn=!h.ip?'':s==='site'?'<span class="tag site">전체 차단 중</span>':
      '<button class="btn sm" data-ip="'+esc(h.ip)+'" data-memo="'+esc((h.company||h.email||'')+' 차단 시도')+'">전체 차단</button>';
    if(h.ip) btn='<div class="acts"><button class="btn sm" data-detail="'+esc(h.ip)+'">기록</button>'+btn+'</div>';
    return '<tr class="hit"><td>'+t(h.ts)+'</td><td>'+(WHERE[h.where]||esc(h.where))+'</td><td class="mono">'+esc(h.ip)+'</td><td>'+(BY[h.by]||esc(h.by))+
      ' <span class="mono" style="color:var(--dim)">'+esc(h.rule)+'</span></td><td>'+esc(h.company||'')+(h.company&&h.email?'<br>':'')+'<span class="mono">'+esc(h.email||'')+'</span></td><td>'+
      esc(h.title||'')+'</td><td>'+(mobile(h.ua)?'휴대폰':'PC')+'</td><td>'+btn+'</td></tr>';
  }).join(''):'<tr><td colspan="8" class="empty">아직 차단된 시도가 없습니다</td></tr>';

  renderLeads();
}

function renderLeads(){
  var q=($('#q').value||'').trim().toLowerCase();
  var list=D.leads.filter(function(r){
    if(!q) return true;
    return [r.company,r.name,r.email,r.phone,r.ip].join(' ').toLowerCase().indexOf(q)>=0;
  }).slice(0,200);
  $('#leads').innerHTML=list.length?list.map(function(r){
    var dom=(String(r.email||'').split('@')[1]||'').toLowerCase();
    var free=!dom||D.freeMail.indexOf(dom)>=0;
    var s=ipState(r.ip);
    var st=r.match?'<span class="tag site">차단 대상 · '+r.match+'</span>':'<span class="tag">정상</span>';
    var b='<div class="acts">'+
      (r.ip?'<button class="btn sm" data-detail="'+esc(r.ip)+'">기록</button>':'')+
      (r.ip?(s==='site'?'':'<button class="btn sm" data-ip="'+esc(r.ip)+'" data-memo="'+esc(r.company||r.email||'')+'" data-mob="'+(mobile(r.ua)?1:0)+'">IP</button>'):'')+
      '<button class="btn sm" '+(free?'disabled title="일반 메일 도메인은 막을 수 없습니다"':'')+' data-dom="'+esc(dom)+'" data-memo="'+esc(r.company||'')+'">도메인</button>'+
      (r.company?'<button class="btn sm" data-co="'+esc(r.company)+'">회사</button>':'')+
      (r.phone?'<button class="btn sm" data-ph="'+esc(r.phone)+'" data-memo="'+esc(r.company||'')+'">전화</button>':'')+
      '</div>';
    return '<tr'+(r.match?' class="hit"':'')+'><td>'+t(r.ts)+'</td><td>'+esc(r.company||'')+(r.name?'<br><span style="color:var(--mut)">'+esc(r.name)+'</span>':'')+
      '</td><td class="mono">'+esc(r.email||'')+(r.phone?'<br>'+esc(r.phone):'')+'</td><td class="mono">'+(r.ip?esc(r.ip)+(mobile(r.ua)?' <span class="tag">휴대폰</span>':''):'<span style="color:var(--dim)">기록 없음</span>')+
      '</td><td>'+esc(r.interest||r.point||'')+'</td><td>'+st+'</td><td>'+b+'</td></tr>';
  }).join(''):'<tr><td colspan="7" class="empty">리드가 없습니다</td></tr>';
}

function save(o,msgEl){
  return fetch('/ops/block/save',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)})
    .then(function(r){return r.json();}).then(function(j){
      var m=msgEl||$('#addMsg');
      m.className='msg '+(j.ok?'ok':'bad');
      m.textContent=j.ok?'저장했습니다 · 1분 안에 반영됩니다':(j.error||'저장 실패');
      if(j.ok) load();
      return j.ok;
    });
}

/* ── 방문 기록 ── */
var VIS=null, filled=false;
function fillDays(){
  if(filled) { loadVisits($('#visDay').value); return; }
  filled=true;
  $('#visDay').innerHTML=D.days.map(function(d,i){ return '<option value="'+d+'">'+d+(i===0?' (오늘)':i===1?' (어제)':'')+'</option>'; }).join('');
  loadVisits(D.days[0]);
}
function loadVisits(day){
  fetch('/ops/block/visits?day='+encodeURIComponent(day),{credentials:'same-origin'}).then(function(r){return r.json();})
    .then(function(v){ VIS=v; renderVisits(); });
}
function renderVisits(){
  if(!VIS) return;
  var q=($('#visQ').value||'').trim().toLowerCase(), lm=leadMap();
  $('#visSum').textContent=VIS.day+' · 방문자 '+(VIS.visitors||0)+'명 · 페이지뷰 '+(VIS.total||0);
  var list=VIS.ips.filter(function(o){ return !q||[o.ip,o.city,o.r,o.lastPage,o.ref,lm[o.ip]||''].join(' ').toLowerCase().indexOf(q)>=0; });
  $('#vis').innerHTML=list.length?list.map(function(o){
    var s=ipState(o.ip), h=host(o.ref);
    var tag=s==='site'?'<span class="tag site">전체 차단</span>':s==='gate'?'<span class="tag gate">자료 차단</span>':
      '<button class="btn sm" data-ip="'+esc(o.ip)+'" data-mob="'+(mobile(o.ua)?1:0)+'" data-memo="'+esc((lm[o.ip]||'')+' 방문기록')+'">차단</button>';
    return '<tr'+(s?' class="hit"':'')+'><td>'+t(o.last)+'</td><td class="mono">'+esc(o.ip)+'</td><td>'+o.n+'</td><td>'+esc(geo(o))+'</td><td>'+esc(dev(o.ua))+
      '</td><td class="pg">'+esc(o.lastPage)+(h?'<br><span style="color:var(--dim)">← '+esc(h)+'</span>':'')+'</td><td>'+(lm[o.ip]?'<span class="lead">'+esc(lm[o.ip])+'</span>':'')+
      '</td><td><div class="acts"><button class="btn sm" data-detail="'+esc(o.ip)+'">기록</button>'+tag+'</div></td></tr>';
  }).join(''):'<tr><td colspan="8" class="empty">기록이 없습니다</td></tr>';
}
function showIp(ip){
  ip=String(ip||'').trim(); if(!ip) return;
  $('#ipBox').hidden=false; $('#ipTitle').textContent=ip+' · 불러오는 중…'; $('#ipRows').innerHTML='';
  fetch('/ops/block/ip?ip='+encodeURIComponent(ip),{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(x){
    var lm=leadMap(), st=x.status||{};
    var last=x.rows[0]||{};
    $('#ipTitle').textContent=ip+' · 최근 30일 '+x.rows.length+'건'+(geo(last)?' · '+geo(last):'')+(lm[ip]?' · 리드: '+lm[ip]:'')+
      (st.blocked?' · 차단 중('+(st.scope==='gate'?'자료·접수':'사이트 전체')+(st.until?' ~'+day(st.until):'')+')':'');
    var mob=mobile(last.ua);
    $('#ipActs').innerHTML=
      (st.blocked&&st.scope==='site'?'':'<button class="btn sm" data-ip="'+esc(ip)+'" data-mob="'+(mob?1:0)+'">사이트 전체 차단</button>')+
      (st.blocked?'':'<button class="btn sm" data-gate="'+esc(ip)+'">자료·접수만 차단</button>')+
      (st.blocked&&st.src!=='fixed'&&st.rule===ip?'<button class="btn sm bad" data-del="'+esc(ip)+'" data-kind="ips">차단 해제</button>':'')+
      '<a class="btn sm" target="_blank" rel="noopener" href="https://ipinfo.io/'+encodeURIComponent(ip)+'">소유자 조회</a>'+
      '<button class="btn sm" data-close="1">닫기</button>';
    $('#ipRows').innerHTML=x.rows.length?x.rows.map(function(r){
      var h=host(r.ref);
      return '<tr'+(r.dl?' class="hit"':'')+'><td>'+t(r.t)+'</td><td class="pg">'+esc(r.p||'')+(r.b?' <span class="tag site">차단됨</span>':'')+'</td><td>'+esc(h)+'</td><td>'+esc(geo(r))+'</td><td>'+esc(dev(r.ua))+'</td></tr>';
    }).join(''):'<tr><td colspan="5" class="empty">최근 30일 방문 기록이 없습니다</td></tr>';
    $('#ipBox').scrollIntoView({behavior:'smooth',block:'start'});
  });
}
$('#visDay').addEventListener('change',function(){ loadVisits(this.value); });
$('#visQ').addEventListener('input',renderVisits);
$('#ipGo').addEventListener('click',function(){ showIp($('#ipLook').value); });
$('#ipLook').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); showIp(this.value); } });

$('#kind').addEventListener('change',function(){
  var k=this.value, ph={ips:'1.2.3.4 · 1.2.3.0/24 · 1.2.3.*',domains:'dekist.com',companies:'데키스트',phones:'010-0000-0000'};
  $('#val').placeholder=ph[k];
  $('#scope').style.display=k==='ips'?'':'none';
  $('#days').style.display=k==='ips'?'':'none';
});
$('#addForm').addEventListener('submit',function(e){
  e.preventDefault();
  save({op:'add',kind:$('#kind').value,v:$('#val').value,scope:$('#scope').value,days:$('#days').value,memo:$('#memo').value})
    .then(function(ok){ if(ok){ $('#val').value=''; $('#memo').value=''; } });
});
$('#reload').addEventListener('click',load);
$('#q').addEventListener('input',function(){ if(D) renderLeads(); });

document.addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b||b.disabled) return;
  var d=b.dataset;
  if(d.detail){ showIp(d.detail); return; }
  if(d.close){ $('#ipBox').hidden=true; return; }
  if(d.gate){ if(confirm(d.gate+' 에서 자료 신청·문의 접수를 30일간 막을까요? (페이지는 열립니다)')) save({op:'add',kind:'ips',v:d.gate,scope:'gate',days:30,memo:'방문기록에서 차단'}).then(function(){ showIp(d.gate); }); return; }
  if(d.del){ if(confirm(d.del+' 차단을 해제할까요?')) save({op:'remove',kind:d.kind,v:d.del}); }
  else if(d.keep){ save({op:'add',kind:'ips',v:d.keep,scope:d.scope||'site',days:0,memo:'자동 수집 → 영구 확정'}); }
  else if(d.up){ if(confirm(d.up+' 를 사이트 전체 차단으로 바꿀까요?\n휴대폰 통신사 IP 라면 같은 IP 를 쓰는 다른 고객도 막힐 수 있습니다.')) save({op:'add',kind:'ips',v:d.up,scope:'site',days:30,memo:'자료 차단 → 전체 차단'}); }
  else if(d.ip){
    var mob=d.mob==='1';
    var msg=d.ip+' 를 차단할까요?\n\n확인 = 사이트 전체 차단'+(mob?' (휴대폰 IP 라 30일만)':' (영구)')+'\n취소 = 그만두기';
    if(confirm(msg)) save({op:'add',kind:'ips',v:d.ip,scope:'site',days:mob?30:0,memo:d.memo||''});
  }
  else if(d.dom){ if(confirm('@'+d.dom+' 로 오는 모든 신청을 막을까요?')) save({op:'add',kind:'domains',v:d.dom,memo:d.memo||''}); }
  else if(d.co){ if(confirm('회사명에 「'+d.co+'」가 들어간 모든 신청을 막을까요?')) save({op:'add',kind:'companies',v:d.co}); }
  else if(d.ph){ if(confirm(d.ph+' 번호로 오는 신청을 막을까요?')) save({op:'add',kind:'phones',v:d.ph,memo:d.memo||''}); }
});
load();
})();
</script></body></html>`;
