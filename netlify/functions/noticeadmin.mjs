/** 알림함 — /ops/notices (2026-09-30)
 *
 *  대표님 지시: 「모든 단계마다 노티 메일 보낼 필요 없고 결정적인 행위 시에만 요약 메일로」.
 *  메일로 안 보내게 된 단계(발송 완료 · 재방문 · 자료 신청 · 구독 …)와 메일로 보낸 것까지
 *  담당자 알림 전부를 여기서 시간순으로 본다. 긴 유입 주소·UTM 원문도 여기에 남는다.
 *
 *  /ops 와 같은 로그인(mk_ops 쿠키). 로그인 안 했으면 /ops 로 보낸다.
 *    GET /ops/notices               화면
 *    GET /ops/notices/data?m=2      최근 m개월 (1~6) · ?month=2026-09 특정 월
 *
 *  원장: ops 저장소 staffnote-YYYY-MM.jsonl (functions/_staffnote.mjs 가 쓴다) */
import * as auth from './_ops_auth.mjs';
import { read, LABEL, mailKinds } from './_staffnote.mjs';

export const config = { path: ['/ops/notices', '/ops/notices/data'] };

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  /* 방문자가 보낸 값(회사명·메모·주소)을 표시하는 화면 — 화면 쪽에서 전부 이스케이프하고 CSP 도 좁힌다 */
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const authed = auth.configured() && auth.valid(auth.cookieFrom({ cookie: req.headers.get('cookie') || '' }));
  if (!authed) {
    if (path !== '/ops/notices') return j({ error: 'unauthorized' }, 401);
    return new Response(null, { status: 302, headers: { ...H, location: '/ops' } });
  }
  if (path === '/ops/notices/data') {
    const m = Math.max(1, Math.min(6, Number(url.searchParams.get('m')) || 2));
    const r = await read({ months: m, month: String(url.searchParams.get('month') || '') });
    return j({ ...r, labels: LABEL, mailKinds: [...mailKinds()] });
  }
  return new Response(PAGE, { status: 200, headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
};

const PAGE = String.raw`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive"><title>알림함 · Monnit</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
:root{--bg:#0B1220;--card:#111A2C;--line:#223049;--ink:#F2F5FA;--mut:#A6B3CC;--dim:#6E7C96;--acc:#7AA8FF;--dn:#FF7A7A;--up:#4FE39B;--warn:#FFC65C;--gold:#D4A93C}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.5;padding:0 0 60px}
.wrap{max-width:1180px;margin:0 auto;padding:20px 16px 0}
header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px}
h1{font-size:19px;font-weight:800;letter-spacing:-.01em}
h1 small{display:block;font-size:12.5px;font-weight:500;color:var(--dim);margin-top:2px}
.btn{background:#1A2640;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:7px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.btn.on{background:var(--acc);color:#0B1220;border-color:var(--acc)}
.seg{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chk{display:flex;gap:5px;align-items:center;font-size:12.5px;color:var(--mut);cursor:pointer}
input[type=search]{background:#0E1628;border:1px solid var(--line);border-radius:9px;color:var(--ink);font:inherit;font-size:13px;padding:7px 11px;min-width:190px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 15px}
.kpi b{display:block;font-size:22px;font-weight:800;margin-top:2px}.kpi span{font-size:12px;color:var(--dim)}
.policy{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 15px;margin-bottom:14px;font-size:12.5px;color:var(--mut);line-height:1.8}
.policy b{color:var(--ink)}
.tag{display:inline-block;font-size:11.5px;font-weight:700;border-radius:6px;padding:1px 7px;margin:1px 3px 1px 0;background:#1A2640;color:var(--mut);white-space:nowrap}
.t-mail{background:rgba(79,227,155,.14);color:var(--up)}.t-ops{background:rgba(122,168,255,.12);color:var(--acc)}.t-fail{background:rgba(255,122,122,.15);color:var(--dn)}.t-test{background:rgba(255,198,92,.14);color:var(--warn)}
.list{display:flex;flex-direction:column;gap:8px}
.row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 14px;cursor:pointer}
.row.held{opacity:.86}
.row .top{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline}
.row .when{font-size:12px;color:var(--dim);min-width:112px;font-variant-numeric:tabular-nums}
.row .who{font-weight:700}.row .who small{font-weight:500;color:var(--mut);margin-left:4px}
.row .src{font-size:12px;color:var(--mut)}.row .src a{color:var(--acc);text-decoration:none}
.row .why{font-size:12px;color:var(--dim);margin-top:3px}
.det{display:none;margin-top:10px;border-top:1px dashed var(--line);padding-top:10px}
.row.open .det{display:block}
.kv{display:grid;grid-template-columns:130px 1fr;gap:3px 12px;font-size:12.5px}
.kv dt{color:var(--dim)}.kv dd{word-break:break-all;white-space:pre-wrap}
.det .acts{margin-top:9px;display:flex;gap:8px;flex-wrap:wrap}.det .acts a{font-size:12.5px;color:var(--acc);text-decoration:none}
.empty{color:var(--dim);text-align:center;padding:40px 0}
.day{font-size:12px;font-weight:700;color:var(--dim);margin:10px 2px 2px}
@media (max-width:640px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kv{grid-template-columns:96px 1fr}.row .when{min-width:0}}
</style></head><body><style>.opsnav{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(8,12,22,.85);backdrop-filter:blur(10px);overflow-x:auto;position:sticky;top:0;z-index:50;font-family:inherit}
.opsnav a{color:#A6B3CC;text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.opsnav a:hover{color:#F2F5FA}.opsnav a.on{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}</style>
<nav class="opsnav" aria-label="관제 메뉴"><a href="/ops">통합 관제</a><a href="/ops/proposals">맞춤 제안서</a><a href="/ops/proposals/archive">발송 대장</a><a href="/ops/proposals/insights">고객 인사이트</a><a href="/ops/notices" class="on">알림함</a><a href="/ops/flow">유입·경로</a><a href="/ops/block">차단 관리</a></nav>
<div class="wrap">
<header>
 <h1>알림함<small>담당자 알림 전체 — 메일은 결정적인 순간에만, 나머지 단계는 여기에만 남습니다</small></h1>
 <div class="seg">
  <button class="btn on" data-f="all">전체</button><button class="btn" data-f="mail">메일 보냄</button><button class="btn" data-f="ops">알림함만</button>
  <input type="search" id="q" placeholder="회사 · 담당자 · 이메일 검색">
  <label class="chk"><input type="checkbox" id="tst"> 테스트 포함</label>
  <button class="btn" id="more">이전 달 더 보기</button>
  <button class="btn" id="rf">새로고침</button>
 </div>
</header>
<div class="kpis" id="kpis"></div>
<div class="policy" id="policy"></div>
<div class="list" id="list"><div class="empty">불러오는 중…</div></div>
</div>
<script>
(function(){
var D=null, F='all', M=2;
var $=function(s){return document.querySelector(s)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function safeUrl(u){u=String(u||'');return /^https?:\/\//i.test(u)?u:(u.charAt(0)==='/'?u:'')}
function shortUrl(u){try{var x=new URL(u,location.origin);return x.hostname.replace(/^www\./,'')+(x.pathname==='/'?'':x.pathname.replace(/\/$/,''))}catch(e){return String(u||'').split('?')[0]}}
function ktime(ts){try{return new Date(ts).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}catch(e){return ts}}
function kday(ts){try{return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(ts))}catch(e){return ''}}
function load(){
  $('#rf').disabled=true;
  fetch('/ops/notices/data?m='+M,{credentials:'same-origin'})
   .then(function(r){if(r.status===401){location.href='/ops';return null}return r.json()})
   .then(function(j){if(!j)return;D=j;render()})
   .catch(function(){$('#list').innerHTML='<div class="empty">불러오지 못했습니다</div>'})
   .then(function(){$('#rf').disabled=false});
}
function rows(){
  var q=$('#q').value.trim().toLowerCase(), t=$('#tst').checked;
  return (D.rows||[]).filter(function(r){
    if(!t&&r.test)return false;
    if(F==='mail'&&!r.mailed)return false;
    if(F==='ops'&&r.mailed)return false;
    if(q&&[r.company,r.name,r.email,r.phone,r.ref].join(' ').toLowerCase().indexOf(q)<0)return false;
    return true;
  });
}
function render(){
  var all=(D.rows||[]).filter(function(r){return $('#tst').checked||!r.test});
  var mailed=all.filter(function(r){return r.mailed}).length, fail=all.filter(function(r){return !r.mailed&&/실패/.test(r.why||'')}).length;
  $('#kpis').innerHTML=[['전체 알림',all.length],['메일 보냄',mailed],['알림함에만',all.length-mailed-fail],['메일 실패',fail]]
    .map(function(k){return '<div class="kpi"><span>'+k[0]+'</span><b>'+Number(k[1]).toLocaleString('ko-KR')+'</b></div>'}).join('');
  var L=D.labels||{}, mk=D.mailKinds||[];
  var held=Object.keys(L).filter(function(k){return mk.indexOf(k)<0});
  $('#policy').innerHTML='<b>메일로 보내는 순간</b> '+mk.map(function(k){return '<span class="tag t-mail">'+esc(L[k]||k)+'</span>'}).join('')+
    '<br><b>알림함에만</b> '+held.map(function(k){return '<span class="tag t-ops">'+esc(L[k]||k)+'</span>'}).join('')+
    '<br>기간: '+esc((D.months||[]).join(', '))+' · 목록은 Netlify 환경변수 STAFF_MAIL_KINDS 로 바꿀 수 있습니다.';
  var rs=rows();
  if(!rs.length){$('#list').innerHTML='<div class="empty">해당하는 알림이 없습니다</div>';return}
  var out=[], last='';
  rs.forEach(function(r,i){
    var d=kday(r.ts); if(d!==last){out.push('<div class="day">'+esc(d)+'</div>');last=d}
    var fail=!r.mailed&&/실패/.test(r.why||'');
    var st=r.mailed?'<span class="tag t-mail">메일 '+esc(r.via==='browser'?'(브라우저)':'')+'</span>':fail?'<span class="tag t-fail">메일 실패</span>':'<span class="tag t-ops">알림함만</span>';
    var land=safeUrl(r.landing);
    var src=esc([r.channel,r.campaign].filter(Boolean).join(' · '))+(land?' · <a href="'+esc(land)+'" target="_blank" rel="noopener noreferrer">'+esc(shortUrl(land))+'</a>':'');
    var sm=r.summary||{}, kv=Object.keys(sm).map(function(k){
      var v=String(sm[k]); var u=safeUrl(v);
      return '<dt>'+esc(k)+'</dt><dd>'+(u&&/^https?:/.test(v)?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer" style="color:var(--acc)">'+esc(shortUrl(v))+'</a> <span style="color:var(--dim)">(원문 '+v.length+'자)</span>':esc(v))+'</dd>'}).join('');
    var link=safeUrl(r.link);
    out.push('<div class="row'+(r.mailed?'':' held')+'" data-i="'+i+'"><div class="top">'+
      '<span class="when">'+esc(ktime(r.ts))+'</span>'+st+'<span class="tag">'+esc(r.label||r.kind)+'</span>'+(r.test?'<span class="tag t-test">테스트</span>':'')+
      (r.grade?'<span class="tag">'+esc(r.grade)+'등급</span>':'')+
      '<span class="who">'+esc(r.company||'(회사 미기재)')+'<small>'+esc(r.name||'')+'</small></span>'+
      (src?'<span class="src">'+src+'</span>':'')+'</div>'+
      (r.why?'<div class="why">'+esc(r.why)+'</div>':'')+
      '<div class="det">'+(r.subject?'<div style="font-size:12.5px;color:var(--mut);margin-bottom:8px">'+esc(r.subject)+'</div>':'')+
      '<dl class="kv">'+(r.phone?'<dt>전화</dt><dd>'+esc(r.phone)+'</dd>':'')+(r.email?'<dt>이메일</dt><dd>'+esc(r.email)+'</dd>':'')+kv+'</dl>'+
      '<div class="acts">'+(link?'<a href="'+esc(link)+'">관리 화면 →</a>':'')+(r.phone?'<a href="tel:'+esc(r.phone)+'">전화 걸기</a>':'')+(r.email?'<a href="mailto:'+esc(r.email)+'">메일 쓰기</a>':'')+'</div></div></div>');
  });
  $('#list').innerHTML=out.join('');
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-f]'); if(b){F=b.getAttribute('data-f');document.querySelectorAll('[data-f]').forEach(function(x){x.classList.toggle('on',x===b)});if(D)render();return}
  if(e.target.closest('a'))return;
  var r=e.target.closest('.row'); if(r)r.classList.toggle('open');
});
$('#q').addEventListener('input',function(){if(D)render()});
$('#tst').addEventListener('change',function(){if(D)render()});
$('#rf').addEventListener('click',load);
$('#more').addEventListener('click',function(){if(M<6){M++;load()}if(M>=6)this.disabled=true});
load();
})();
</script></body></html>`;
