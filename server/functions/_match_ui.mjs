/** /ops/enablement 화면 — 맞견적 접수 · 코호트 · 고객 평가·확장 · 시나리오 · 환산 기준 (2026-11-16)
 *  데이터는 /ops/enablement/data, 저장은 /ops/enablement/save (match.mjs). 화면 코드에는 템플릿 문자열을 쓰지 않는다. */
export const PAGE = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>바이어 인에이블먼트 · 맞견적 | 모넷 관제</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{--bg:#0A0F1C;--card:#111a2e;--card2:#16213a;--line:rgba(255,255,255,.1);--ink:#F2F5FA;--mut:#A6B3CC;--dim:#76839c;--acc:#7aa8ff;--mint:#5fe3c4;--or:#f5a524;--up:#4fe39b;--dn:#ff7a7a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo',sans-serif;font-size:14px}
.opsnav{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(8,12,22,.85);backdrop-filter:blur(10px);overflow-x:auto;position:sticky;top:0;z-index:20}
.opsnav a{color:#A6B3CC;text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.opsnav a:hover{color:#F2F5FA}.opsnav a.on{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}
.wrap{max-width:1280px;margin:0 auto;padding:22px max(16px,env(safe-area-inset-left)) 80px}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.02em}.sub{color:var(--mut);margin:0 0 18px;line-height:1.6;max-width:900px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;flex-wrap:wrap}.seg button{background:none;border:0;color:var(--mut);padding:8px 14px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}.seg button.on{background:var(--card2);color:#fff}
.pill{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;color:var(--mut)}.pill.ok{color:var(--up);border-color:rgba(79,227,155,.35)}.pill.bad{color:var(--dn);border-color:rgba(255,122,122,.35)}
.kpi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:16px}
.k{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}.k small{display:block;color:var(--mut);font-size:12px}.k b{display:block;font-size:22px;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}.k em{font-style:normal;font-size:12px;color:var(--dim)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px;min-width:0}
.card h2{font-size:15.5px;margin:0 0 4px}.card .note{color:var(--dim);font-size:12.5px;margin:0 0 12px;line-height:1.55}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:top}th{color:var(--mut);font-weight:600;font-size:12px}td.n,th.n{text-align:right}td.w{white-space:normal;min-width:220px}
tr.row{cursor:pointer}tr.row:hover td{background:rgba(255,255,255,.03)}tr.open td{white-space:normal;background:#0d1527;padding:14px}
.st{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--mut);margin:0 4px 4px 0}
.st.lower{background:rgba(79,227,155,.16);color:var(--up)}.st.higher{background:rgba(255,122,122,.14);color:var(--dn)}.st.partial{background:rgba(245,165,36,.16);color:var(--or)}.st.similar{background:rgba(122,168,255,.16);color:#a9c7ff}
.st.A{background:rgba(79,227,155,.16);color:var(--up)}.st.B{background:rgba(122,168,255,.16);color:#a9c7ff}.st.C{background:rgba(255,122,122,.14);color:var(--dn)}.st.s{background:rgba(95,227,196,.14);color:var(--mint)}
.dim{color:var(--dim)}.mint{color:var(--mint)}.empty{color:var(--dim);padding:10px 0}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:3px 8px;color:var(--mut)}.chip.must{border-color:rgba(95,227,196,.5);color:var(--mint)}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
label{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}
input,select,textarea{width:100%;background:#0c1426;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:8px 10px;font-family:inherit;font-size:13px}textarea{min-height:120px;line-height:1.6}
input[type=checkbox]{width:auto;margin-right:6px}
.btn{background:var(--acc);color:#071022;border:0;border-radius:9px;padding:9px 16px;font-weight:700;font-family:inherit;font-size:13px;cursor:pointer}.btn.ghost{background:none;border:1px solid var(--line);color:var(--mut)}
.msg{font-size:12.5px;color:var(--mint);margin-left:10px}
.sc{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card2)}.sc h3{margin:0 0 6px;font-size:14.5px}.sc p{margin:4px 0;color:var(--mut);font-size:12.5px;line-height:1.6}.sc b.n{float:right;font-size:20px;color:var(--mint)}
.help{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--mut);font-size:12.5px;line-height:1.65;margin-bottom:14px}.help b{color:var(--ink)}
.cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:10px}.cmp div{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.cmp small{color:var(--mut);display:block;font-size:12px}.cmp b{font-size:17px}
@media (max-width:1000px){.kpi{grid-template-columns:repeat(3,minmax(0,1fr))}.grid3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){.kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2,.grid3,.cmp{grid-template-columns:minmax(0,1fr)}}
</style></head><body>
<nav class="opsnav" aria-label="관제 메뉴"><a href="/ops">통합 관제</a><a href="/ops/journey">고객 여정</a><a href="/ops/enablement" class="on">바이어 인에이블먼트</a><a href="/ops/mall">리소스 센터 접수</a><a href="/ops/proposals">맞춤 제안서</a><a href="/ops/notices">알림함</a><a href="/ops/block">차단 관리</a></nav><script src="/js/ops-nav.js?v=2" defer></script>
<div class="wrap">
  <h1>바이어 인에이블먼트 · 맞견적</h1>
  <p class="sub">고객이 내부 품의·결재를 통과하도록 돕는 데 필요한 것을 한 화면에 모았습니다. 맞견적(/match)으로 올라온 견적서, 시장 데이터, 코호트별 문의 → 견적 → 결재 시간과 요청 자료, 수주 이후의 확장·재발주와 고객 평가, 그리고 단계별 대응 시나리오입니다.</p>
  <div class="bar"><div class="seg" id="tabs"><button data-t="match" class="on">올린 견적서</button><button data-t="market">시장 데이터</button><button data-t="cohort">코호트</button><button data-t="acct">고객 평가 · 확장</button><button data-t="scen">시나리오</button><button data-t="cfg">환산 기준</button></div>
    <div class="seg" id="days"><button data-d="90">90일</button><button data-d="180" class="on">180일</button><button data-d="365">1년</button></div><span class="pill" id="qsTag">불러오는 중…</span><span class="pill" id="atTag"></span></div>
  <div class="kpi" id="kpi"></div>
  <div id="view"></div>
</div>
<script>
(function(){
var $=function(s,r){return (r||document).querySelector(s)}, esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var won=function(n){n=Number(n)||0; var a=Math.abs(n); return (n<0?'-':'')+(a>=1e8?(Math.round(a/1e7)/10)+'억':a>=1e4?Math.round(a/1e4).toLocaleString('ko-KR')+'만':a.toLocaleString('ko-KR'))};
var full=function(n){return (Math.round(Number(n)||0)).toLocaleString('ko-KR')};
var pct=function(a,b){return b?Math.round(a/b*1000)/10+'%':'-'};
var dayv=function(v){return v==null?'<span class="dim">-</span>':v+'일'};
function kt(t){var d=new Date(new Date(t).getTime()+324e5).toISOString();return d.slice(2,10).replace(/-/g,'/')+' '+d.slice(11,16)}
var VERD={lower:'모넷이 낮음',similar:'비슷함',higher:'모넷이 높음',partial:'부분 산정',empty:'-'};
var days=180, tab='match', dim='cohort', D=null;
function load(fresh){ $('#atTag').textContent='불러오는 중…';
  fetch('/ops/enablement/data?days='+days+(fresh?'&fresh=1':''),{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){ if(!d.ok){$('#atTag').textContent='오류: '+(d.error||'');return;} D=d; paint(); }).catch(function(){$('#atTag').textContent='불러오지 못했습니다'});}
function post(o,cb){ fetch('/ops/enablement/save',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(o)}).then(function(r){return r.json()}).then(cb).catch(function(){cb({ok:false,error:'저장하지 못했습니다'})}); }
function paint(){
  var q=D.qs, t=$('#qsTag'); t.className='pill '+(q.ok?'ok':'bad'); t.textContent=q.ok?('견적시스템 연결 · 견적서 '+q.n+'건'+(q.stale?' (지난 값)':'')):('견적시스템 미연결 · '+q.error+' — 수주는 /ops 딜 단계만 반영');
  $('#atTag').textContent='갱신 '+kt(D.at);
  var k=D.kpi, m=D.match;
  $('#kpi').innerHTML=[['올린 견적서',(D.upKpi||{}).groups||0,'비교표 신청 '+((D.upKpi||{}).leads||0)+'건 · 파일 '+((D.upKpi||{}).files||0)+'개'],['문의',k.leads,''],['견적',k.quoted,pct(k.quoted,k.leads)+' · 중앙 '+(k.medQuote==null?'-':k.medQuote+'일')],['결재(수주)',k.won,pct(k.won,k.quoted)+' · 중앙 '+(k.medWin==null?'-':k.medWin+'일')],['수주 고객',k.customers,''],['재발주 고객',k.reorder,pct(k.reorder,k.customers)+' (수주 고객 대비)']]
    .map(function(x){return '<div class="k"><small>'+x[0]+'</small><b>'+Number(x[1]).toLocaleString('ko-KR')+'</b><em>'+x[2]+'</em></div>'}).join('');
  ({match:vMatch,market:vMarket,cohort:vCohort,acct:vAcct,scen:vScen,cfg:vCfg})[tab]();
}

/* ① 올린 견적서 — 고객이 올린 사진·PDF. 신청 여부와 무관하게 전부 모인다 */
function fsz(n){return n>=1048576?(Math.round(n/104857.6)/10)+'MB':Math.round(n/1024)+'KB'}
function vMatch(){
  var U=D.uploads||[], k=D.upKpi||{};
  var h='<div class="help"><b>읽는 법</b> · 고객이 /match 에 올린 견적서 파일입니다 — 묶음 '+(k.groups||0)+'건 · 파일 '+(k.files||0)+'개 · 그중 비교표 신청 <b>'+(k.leads||0)+'건</b> · 품목 입력 완료 '+(k.typed||0)+'건. 올리는 즉시 AI 가 품목을 읽어 기록하고(「AI 판독」), 줄을 누르면 파일과 읽은 품목을 볼 수 있습니다. 읽지 못했거나 틀린 건은 품목 줄을 붙여 넣어 고치면 됩니다. 입력된 품목은 「시장 데이터」 탭 통계에 들어갑니다. 신청하지 않은 건에는 연락처가 없습니다.</div>'
    +'<div class="card"><p style="margin:0 0 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" id="upDel" disabled style="background:#c0392b;border-color:#c0392b;opacity:.45">선택 삭제</button><span class="dim" style="font-size:13px">지우면 올린 파일은 저장소에서 완전히 삭제되고, 읽은 품목은 시장 데이터 통계에서도 빠집니다. 되돌릴 수 없습니다.</span><span class="msg" id="upMsg"></span></p><div class="tw"><table><thead><tr><th style="width:34px"><input type="checkbox" id="upAll" aria-label="전체 선택" style="width:auto"></th><th>올린 시각</th><th class="n">파일</th><th>신청</th><th>회사 · 담당 · 연락처</th><th>업체</th><th class="n">타사 총비용</th><th class="n">모넷 총비용</th><th>상태</th></tr></thead><tbody>'
    +(U.length?U.map(function(g,i){var s=g.sum,l=g.lead;return '<tr class="row" data-u="'+i+'"><td><input type="checkbox" data-pick="'+esc(g.cid)+'" data-lead="'+(l?1:0)+'" aria-label="선택" style="width:auto"></td><td>'+kt(g.ts)+'</td><td class="n">'+g.files.length+'</td><td>'+(l?'<span class="st lower">신청 '+esc(l.id)+'</span>':'<span class="dim">파일만</span>')+'</td><td>'+(l?esc(l.company)+' <span class="dim">'+esc(l.name)+' · '+esc(l.phone||l.email||'')+'</span>':'<span class="dim">-</span>')+'</td><td>'+esc(g.vendor||'-')+'</td><td class="n">'+(s?won(s.tTco):'-')+'</td><td class="n">'+(s?won(s.oTco):'-')+'</td><td>'+(s?'<span class="st '+esc(s.verdict)+'">'+(VERD[s.verdict]||'-')+'</span>'+(g.src==='ai'?'<span class="st similar">AI 판독</span>':g.src==='staff'?'<span class="st">담당자 입력</span>':'')+(g.fx?'<span class="st">'+esc(g.fx.cur)+' × '+esc(g.fx.rate)+'</span>':''):'<span class="st partial">품목 입력 전</span>'+(g.fail?'<span class="st higher" title="'+esc(g.fail.err||'')+'">판독 실패 · '+esc(g.fail.why)+'</span>':''))+'</td></tr>'}).join(''):'<tr><td colspan="9" class="empty">아직 올라온 견적서가 없습니다. 고객 화면: <a href="/match" target="_blank" style="color:var(--acc)">/match</a></td></tr>')
    +'</tbody></table></div></div>';
  $('#view').innerHTML=h;
}
function upSel(){var n=document.querySelectorAll('[data-pick]:checked').length,b=$('#upDel'); if(!b) return; b.disabled=!n; b.style.opacity=n?'1':'.45'; b.textContent=n?'선택 삭제 ('+n+')':'선택 삭제';}
function openUp(tr){
  var nx=tr.nextElementSibling; if(nx&&nx.classList.contains('open')){nx.remove();return;}
  var g=D.uploads[+tr.dataset.u], s=g.sum, K=D.kinds; var row=document.createElement('tr'); row.className='open';
  var files=g.files.map(function(f){var u='/ops/enablement/file?k='+encodeURIComponent(f.k), img=/^(jpg|png|webp)$/.test(f.ext);
    return '<a href="'+u+'" target="_blank" rel="noopener" style="display:block;width:170px;border:1px solid var(--line);border-radius:10px;padding:8px;color:var(--mut);text-decoration:none;font-size:12px">'+(img?'<img src="'+u+'" alt="" loading="lazy" style="display:block;width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px">':'<span style="display:grid;place-items:center;height:120px;background:#0a1224;border-radius:6px;margin-bottom:6px;font-weight:700">'+esc(f.ext.toUpperCase())+'</span>')+'<span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.name||'견적서')+'</span>'+fsz(f.size)+' · 새 창에서 열기</a>'}).join('');
  row.innerHTML='<td colspan="9"><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'+files+'</div>'
    +(g.lead?'<p style="margin:0 0 10px"><span class="st '+(g.lead.ack?'lower':'higher')+'">'+(g.lead.ack?'예상 금액 고지 확인 '+kt(g.lead.ack):'예상 금액 고지 확인 기록 없음')+'</span><span class="dim">고객이 「정식 견적은 달라질 수 있음」에 체크한 시각입니다</span></p>':'')+(g.lead&&g.lead.memo?'<p style="margin:0 0 10px">'+esc(g.lead.memo)+'</p>':'')
    +(s?'<div class="cmp"><div><small>타사 — 초기 '+full(s.tInit)+'원 · 연 '+full(s.tYearly)+'원</small><b>'+s.years+'년 총비용 '+full(s.tTco)+'원</b></div><div><small>모넷 — 초기 '+full(s.oInit)+'원 · 연 '+full(s.oYearly)+'원</small><b class="mint">'+s.years+'년 총비용 '+full(s.oTco)+'원</b></div></div>'
      +(g.src==='ai'?'<p style="margin:0 0 8px;color:var(--or)">AI 가 사진에서 읽은 품목입니다'+(g.stated?' — 견적서에 적힌 합계 '+full(g.stated)+'원':'')+'. 원본과 대조한 뒤 틀린 곳이 있으면 아래에 다시 붙여 넣어 저장하세요.</p>':'')+'<p class="dim" style="margin:0 0 8px">차이 '+full(s.diff)+'원('+s.pct+'%)'+(s.oneSided?' — 타사 유지보수·기타 '+full(s.oneSided)+'원 제외 기준':'')+' · 센서 '+s.points+'개 · 게이트웨이 '+s.gateways+'대'+(s.unpriced&&s.unpriced.length?' · <span style="color:var(--or)">단가 미입력: '+esc(s.unpriced.join(', '))+'</span>':'')+'</p>'
      +'<div class="tw" style="margin-bottom:12px"><table><thead><tr><th>품목</th><th>분류</th><th class="n">수량</th><th class="n">금액</th><th>주기</th></tr></thead><tbody>'+(g.lines||[]).map(function(l){return '<tr><td>'+esc(l.name)+'</td><td>'+esc(K[l.kind]||l.kind)+(l.cat?' <span class="dim">'+esc(l.cat)+'</span>':'')+'</td><td class="n">'+l.qty+'</td><td class="n">'+full(l.amount)+'</td><td>'+(l.period==='month'?'매월':l.period==='year'?'매년':'1회')+'</td></tr>'}).join('')+'</tbody></table></div>':'')
    +'<div class="grid2"><div><label>견적서 품목 붙여 넣기 (한 줄에 품명 · 수량 · 단가 · 금액 — 합계·부가세 줄은 자동 제외)'+(s?' · 다시 저장하면 바뀝니다':'')+'</label><textarea data-lt placeholder="온도센서  20  180,000  3,600,000&#10;배선 공사  1식  8,500,000&#10;플랫폼 월 이용료  1  250,000"></textarea></div>'
    +'<div><label>견적을 낸 업체</label><input data-lv value="'+esc(g.vendor||'')+'"><div class="grid3" style="margin-top:10px"><div><label>현장 수</label><input type="number" min="1" value="1" data-lo="sites"></div><div><label>비교 기간(년)</label><input type="number" min="1" max="10" value="3" data-lo="years"></div><div><label>금액</label><select data-lo="vat"><option value="0">VAT 별도</option><option value="1">VAT 포함</option></select></div></div>'
    +'<p style="margin:12px 0 0"><button class="btn" data-lines="'+esc(g.cid)+'">읽어서 저장</button><span class="msg"></span></p></div></div></td>';
  tr.after(row);
}

/* ①-2 시장 데이터 — 다른 업체들이 무엇에 얼마를 받는가 */
function vMarket(){
  var m=D.market, r=function(o,u){return o&&o.n?('<b>'+(u==='%'?o.med+'%':won(o.med)+'원')+'</b> <span class="dim">'+(u==='%'?o.min+'~'+o.max+'%':won(o.min)+'~'+won(o.max))+' · '+o.n+'건</span>'):'<span class="dim">-</span>'};
  var h='<div class="help"><b>읽는 법</b> · 「올린 견적서」 탭에서 AI 가 읽었거나 담당자가 입력한 견적서 <b>'+m.n+'건</b>을 표본으로 합니다. AI 판독은 틀릴 수 있으니 중요한 수치는 원본과 대조하세요. 금액은 VAT 별도로 맞춘 중앙값이고 옆은 최소~최대·건수입니다. 표본이 적은 칸은 참고만 하세요. 분류는 품목명으로 자동 판정하므로 틀린 줄이 섞일 수 있습니다.</div>'
    +'<div class="kpi" style="grid-template-columns:repeat(5,minmax(0,1fr))">'+[['견적서 1건 초기 비용',r(m.init)],['매년 반복 비용',r(m.yearly)],['월 이용료(있는 견적만)',r(m.monthly)],['공사비 ÷ 장비값',r(m.consRatio,'%')],['플랫폼 구축비 ÷ 장비값',r(m.platRatio,'%')]].map(function(x){return '<div class="k"><small>'+x[0]+'</small><div style="margin-top:6px;font-size:15px">'+x[1]+'</div></div>'}).join('')+'</div>'
    +'<div class="grid2"><div class="card"><h2>비용 종류별</h2><p class="note">그 종류가 들어 있는 견적서 비율과, 들어 있을 때의 금액입니다.</p><div class="tw"><table><thead><tr><th>종류</th><th class="n">포함 비율</th><th>1회 금액</th><th>매년 금액</th></tr></thead><tbody>'+m.kinds.map(function(k){return '<tr><td>'+esc(k.label)+'</td><td class="n">'+(k.share==null?'-':k.share+'%')+'</td><td>'+r(k.init)+'</td><td>'+r(k.yearly)+'</td></tr>'}).join('')+'</tbody></table></div></div>'
    +'<div class="card"><h2>센서 종류별 타사 단가</h2><p class="note">금액 ÷ 수량. 오른쪽은 환산 기준에 넣어 둔 모넷 단가입니다.</p><div class="tw"><table><thead><tr><th>종류</th><th>타사 단가</th><th class="n">모넷 단가</th></tr></thead><tbody>'+(m.units.length?m.units.map(function(u){return '<tr><td>'+esc(u.name)+'</td><td>'+r(u)+'</td><td class="n">'+(u.ours?won(u.ours)+'원':'<span class="dim">미입력</span>')+'</td></tr>'}).join(''):'<tr><td colspan="3" class="empty">아직 없음</td></tr>')+'</tbody></table></div></div></div>'
    +'<div class="grid2"><div class="card"><h2>어떤 이름으로 받는가</h2><p class="note">센서 외 품목 중 자주 나온 이름과 금액 중앙값입니다.</p><div class="tw"><table><thead><tr><th>종류</th><th>품목명</th><th class="n">건수</th><th class="n">금액</th></tr></thead><tbody>'+(m.names.length?m.names.map(function(x){return '<tr><td>'+esc(x.kind)+'</td><td>'+esc(x.name)+'</td><td class="n">'+x.n+'</td><td class="n">'+won(x.med)+'원'+(x.period==='month'?'/월':x.period==='year'?'/년':'')+'</td></tr>'}).join(''):'<tr><td colspan="4" class="empty">아직 없음</td></tr>')+'</tbody></table></div></div>'
    +'<div><div class="card"><h2>견적서 밖에서 추가로 요구받은 비용</h2><p class="note">고객이 선택 항목으로 답한 것 — 응답 '+m.extras.n+'건'+(m.extras.amount.n?' · 금액 '+r(m.extras.amount):'')+'</p><div class="chips">'+(m.extras.items.length?m.extras.items.map(function(x){return '<span class="chip">'+esc(x.k)+' '+x.v+'</span>'}).join(''):'<span class="empty">아직 없음</span>')+'</div></div>'
    +'<div class="card"><h2>업체별</h2><p class="note">고객이 업체명을 적은 견적서만 집계됩니다.</p><div class="tw"><table><thead><tr><th>업체</th><th class="n">건수</th><th class="n">초기 비용</th><th class="n">공사비 ÷ 장비값</th></tr></thead><tbody>'+(m.vendors.length?m.vendors.map(function(v){return '<tr><td>'+esc(v.vendor)+'</td><td class="n">'+v.n+'</td><td class="n">'+(v.medInit==null?'-':won(v.medInit)+'원')+'</td><td class="n">'+(v.consRatio==null?'-':v.consRatio+'%')+'</td></tr>'}).join(''):'<tr><td colspan="4" class="empty">아직 없음</td></tr>')+'</tbody></table></div></div></div></div>';
  $('#view').innerHTML=h;
}

/* ② 코호트 */
function vCohort(){
  var list=D.cohorts[dim]||[];
  var h='<div class="help"><b>읽는 법</b> · 문의(상담·신청) 한 건을 기준으로, 견적까지·결재(수주)까지 걸린 날의 중앙값입니다. 견적일·수주일은 견적시스템 견적서와 /ops 딜 단계 중 있는 쪽을 씁니다. <b>요청 자료</b>는 같은 담당자·같은 회사가 문의 전후 120일 안에 신청한 자료와 맞견적 이용입니다. <b>필수 제공요소</b>는 코호트별로 결재에 필요한 자료 목록이며 직접 고칠 수 있고, 수주 건의 절반 이상이 받아 간 자료에는 초록 표시가 붙습니다.</div>'
    +'<div class="bar"><div class="seg" id="dim">'+[['cohort','산업'],['ch','유입 채널'],['point','접점']].map(function(x){return '<button data-dim="'+x[0]+'"'+(dim===x[0]?' class="on"':'')+'>'+x[1]+'</button>'}).join('')+'</div></div>'
    +'<div class="card"><div class="tw"><table><thead><tr><th>코호트</th><th class="n">문의</th><th class="n">고객사</th><th class="n">견적</th><th class="n">결재(수주)</th><th class="n">문의→견적</th><th class="n">문의→결재</th><th class="n">수주액</th><th>요청 자료 (건수 · 그중 수주)</th></tr></thead><tbody>'
    +(list.length?list.map(function(c,i){return '<tr class="'+(dim==='cohort'?'row':'')+'" data-c="'+i+'"><td>'+esc(c.label||c.key)+'</td><td class="n">'+c.n+'</td><td class="n">'+c.accounts+'</td><td class="n">'+c.quoted+' <span class="dim">'+pct(c.quoted,c.n)+'</span></td><td class="n">'+c.won+' <span class="dim">'+pct(c.won,c.quoted)+'</span></td><td class="n">'+dayv(c.medQuote)+' <span class="dim">('+c.nQuote+')</span></td><td class="n">'+dayv(c.medWin)+' <span class="dim">('+c.nWin+')</span></td><td class="n">'+won(c.rev)+'</td><td class="w"><div class="chips">'+(c.docs.length?c.docs.map(function(d){return '<span class="chip'+(c.must.indexOf(d.k)>=0?' must':'')+'">'+esc(d.k)+' '+d.v+(d.won?' · '+d.won:'')+'</span>'}).join(''):'<span class="dim">-</span>')+'</div></td></tr>'}).join(''):'<tr><td colspan="9" class="empty">기간 안에 문의가 없습니다</td></tr>')
    +'</tbody></table></div>'+(dim==='cohort'?'<p class="note" style="margin:10px 0 0">줄을 누르면 그 코호트의 필수 제공요소를 보고 고칠 수 있습니다. 괄호 안 숫자는 날짜가 기록된 건수입니다 — 건수가 적으면 참고만 하세요.</p>':'')+'</div>';
  $('#view').innerHTML=h;
}
function openKit(tr){
  var nx=tr.nextElementSibling; if(nx&&nx.classList.contains('open')){nx.remove();return;}
  var c=D.cohorts.cohort[+tr.dataset.c]; var row=document.createElement('tr'); row.className='open';
  row.innerHTML='<td colspan="9"><label>'+esc(c.label)+' — 필수 제공요소 (한 줄에 하나'+(c.kitEdited?' · 수정됨':' · 기본값')+')</label><textarea>'+esc((c.kit||[]).join('\\n'))+'</textarea>'
    +(c.must.length?'<p class="dim" style="margin:8px 0 0">수주 건의 절반 이상이 받아 간 자료: <span class="mint">'+esc(c.must.join(' · '))+'</span></p>':'')
    +'<p style="margin:10px 0 0"><button class="btn" data-kit="'+esc(c.key)+'">저장</button> <button class="btn ghost" data-kitreset="'+esc(c.key)+'">기본값으로</button><span class="msg"></span></p></td>';
  tr.after(row);
}

/* ③ 고객 평가 · 확장 */
function vAcct(){
  var L=D.accounts;
  var h='<div class="help"><b>읽는 법</b> · 회사 단위로 묶었습니다. <b>수주</b>는 견적시스템의 수주·출고 견적서와 /ops 딜의 수주를 합친 횟수, <b>재발주 간격</b>은 수주 사이 날짜의 중앙값, <b>다음 예상</b>은 마지막 수주에 그 간격을 더한 날입니다. <b>평가</b>는 담당자가 1~5점으로 적으며, 가중 평균이 75 이상 A · 50 이상 B · 미만 C 입니다. 전체 대상 개소와 설치 개소를 적으면 남은 확장 여지가 계산됩니다.</div>'
    +'<div class="card"><div class="tw"><table><thead><tr><th>고객</th><th>코호트</th><th class="n">문의</th><th class="n">수주</th><th class="n">누적 수주액</th><th>마지막 수주</th><th class="n">재발주 간격</th><th>다음 예상</th><th class="n">확장 여지</th><th>평가</th><th>지금 할 일</th></tr></thead><tbody>'
    +(L.length?L.map(function(a,i){return '<tr class="row" data-a="'+i+'"><td>'+esc(a.company)+(a.mq?' <span class="dim">'+esc(a.mq)+'</span>':'')+'</td><td>'+esc(a.cohortLabel)+'</td><td class="n">'+a.leads+'</td><td class="n">'+a.orders+(a.open?' <span class="dim">+미결 '+a.open+'</span>':'')+'</td><td class="n">'+won(a.rev)+'</td><td>'+(a.last?esc(a.last)+' <span class="dim">'+a.since+'일 전</span>':'<span class="dim">-</span>')+'</td><td class="n">'+dayv(a.gap)+'</td><td>'+esc(a.next||'-')+'</td><td class="n">'+(a.remain==null?'<span class="dim">-</span>':a.remain+'개소')+'</td><td>'+(a.grade?'<span class="st '+a.grade+'">'+a.grade+' '+a.score+'</span>':'<span class="dim">미평가</span>')+'</td><td class="w">'+(a.scen.length?a.scen.map(function(s){return '<span class="st s">'+s+' '+esc(scName(s))+'</span>'}).join(''):'<span class="dim">-</span>')+'</td></tr>'}).join(''):'<tr><td colspan="11" class="empty">표시할 고객이 없습니다 (수주·미결 견적·맞견적 이용이 있는 고객만 나옵니다)</td></tr>')
    +'</tbody></table></div></div>';
  $('#view').innerHTML=h;
}
function scName(id){for(var i=0;i<D.scenarios.length;i++) if(D.scenarios[i].id===id) return D.scenarios[i].name; return id;}
function openAcct(tr){
  var nx=tr.nextElementSibling; if(nx&&nx.classList.contains('open')){nx.remove();return;}
  var a=D.accounts[+tr.dataset.a], ev=a.ev||{s:{}}; var row=document.createElement('tr'); row.className='open';
  var kit=(D.cohorts.cohort.filter(function(c){return c.key===a.cohort})[0]||{}).kit||D.defaultKits[a.cohort]||[];
  row.innerHTML='<td colspan="11"><div class="grid3">'+D.evalItems.map(function(e){return '<div><label>'+esc(e[1])+' <span class="dim">(가중 '+e[2]+')</span></label><select data-ev="'+e[0]+'"><option value="">-</option>'+[1,2,3,4,5].map(function(n){return '<option'+(Number(ev.s[e[0]])===n?' selected':'')+'>'+n+'</option>'}).join('')+'</select></div>'}).join('')
    +'<div><label>전체 대상 개소</label><input type="number" min="0" data-f="total" value="'+esc(ev.total||'')+'"></div><div><label>설치 완료 개소</label><input type="number" min="0" data-f="done" value="'+esc(ev.done||'')+'"></div><div><label>메모 (의사결정 구조 · 다음 예산 시기 등)</label><input data-f="memo" value="'+esc(ev.memo||'')+'"></div></div>'
    +'<p style="margin:12px 0 0"><button class="btn" data-acct="'+esc(a.key)+'">평가 저장</button><span class="msg">'+(ev.at?'마지막 저장 '+kt(ev.at):'')+'</span></p>'
    +(a.scen.length?'<div style="margin-top:14px">'+a.scen.map(function(id){var s=D.scenarios.filter(function(x){return x.id===id})[0];return '<p style="margin:6px 0"><span class="st s">'+id+' '+esc(s.name)+'</span> '+esc(s.todo)+' <span class="dim">— 건넬 것: '+esc(s.give.join(' · '))+'</span></p>'}).join('')+'</div>':'')
    +'<p class="dim" style="margin:12px 0 4px">이 코호트의 필수 제공요소</p><div class="chips">'+kit.map(function(x){return '<span class="chip">'+esc(x)+'</span>'}).join('')+'</div></td>';
  tr.after(row);
}

/* ④ 시나리오 */
function vScen(){
  var by={}; D.scenarios.forEach(function(s){(by[s.stage]=by[s.stage]||[]).push(s)});
  $('#view').innerHTML='<div class="help"><b>바이어 인에이블먼트</b> · 구매 담당자가 내부에서 설득·품의·결재를 해낼 수 있도록 필요한 자료를 필요한 때 건네는 일입니다. 아래 조건에 지금 걸린 고객 수가 오른쪽 숫자이고, 「고객 평가 · 확장」 탭의 「지금 할 일」에 같은 번호로 표시됩니다.</div>'
    +Object.keys(by).map(function(st){return '<div class="card"><h2>'+esc(st)+' 단계</h2><div class="grid2" style="margin-top:10px">'+by[st].map(function(s){return '<div class="sc"><b class="n">'+s.n+'</b><h3>'+s.id+' · '+esc(s.name)+'</h3><p><b style="color:var(--ink)">조건</b> '+esc(s.when)+'</p><p><b style="color:var(--ink)">건넬 것</b> '+esc(s.give.join(' · '))+'</p><p><b style="color:var(--ink)">할 일</b> '+esc(s.todo)+'</p></div>'}).join('')+'</div></div>'}).join('');
}

/* ⑤ 환산 기준 */
function vCfg(){
  var c=D.cfg, cat=c.catalog;
  var h='<div class="help"><b>고객 화면(/match)의 모넷 금액은 전부 여기 값으로 계산되며, 고객에게는 구간으로만 표시됩니다.</b> 단가와 정확한 합계는 서버와 이 화면에만 있습니다. 단가가 0 인 종류는 「담당자 확인」으로 나가며 그 견적은 「부분 산정」이 됩니다. 프로모션 면제를 켜면 고객 화면에 「프로모션 면제」로 표시되고, 플랫폼은 2년차부터의 금액이 총비용에 그대로 들어갑니다.</div>'
    +'<div class="card"><h2>센서 단가 (원 · VAT 별도)</h2><div class="grid3" style="margin-top:10px">'+Object.keys(cat).map(function(k){return '<div><label>'+esc(cat[k].name)+' <span class="dim">'+k+'</span></label><input type="number" min="0" data-cat="'+k+'" value="'+cat[k].price+'"></div>'}).join('')+'</div></div>'
    +'<div class="grid2"><div class="card"><h2>게이트웨이</h2><div class="grid3" style="margin-top:10px"><div><label>IoT 게이트웨이(LTE)</label><input type="number" data-p="gateway.lte.price" value="'+c.gateway.lte.price+'"></div><div><label>이더넷 게이트웨이</label><input type="number" data-p="gateway.lan.price" value="'+c.gateway.lan.price+'"></div><div><label>1대당 센서 수</label><input type="number" data-p="gateway.capacity" value="'+c.gateway.capacity+'"></div></div></div>'
    +'<div class="card"><h2>플랫폼 (연 구독)</h2><div class="grid3" style="margin-top:10px"><div><label>iMonnit Cloud</label><input type="number" data-p="platform.cloud.annual" value="'+c.platform.cloud.annual+'"></div><div><label>Scube 전용</label><input type="number" data-p="platform.scube.annual" value="'+c.platform.scube.annual+'"></div><div><label>상한 (이 금액을 넘지 않음)</label><input type="number" data-p="platform.cap" value="'+c.platform.cap+'"></div></div></div></div>'
    +'<div class="grid2"><div class="card"><h2>설치 · 통신</h2><p class="note">설치 대행 요율이 0 이면 금액 대신 「현장 확인 뒤 안내」로 나가고 그 견적은 부분 산정이 됩니다. 통신비는 실제 과금 조건대로 넣어 주세요(연 금액).</p><div class="grid3"><div><label>설치 대행 — 현장 1곳당</label><input type="number" data-p="install.assistBase" value="'+c.install.assistBase+'"></div><div><label>설치 대행 — 센서 1개당</label><input type="number" data-p="install.assistPerPoint" value="'+c.install.assistPerPoint+'"></div><div><label>LTE 통신비 (연)</label><input type="number" data-p="comm.lte" value="'+c.comm.lte+'"></div></div></div>'
    +'<div class="card"><h2>프로모션 · 공개 범위</h2><p style="margin:8px 0"><label style="display:inline;color:var(--ink);font-size:13px"><input type="checkbox" data-b="promo.platformFirstYearFree"'+(c.promo.platformFirstYearFree?' checked':'')+'>플랫폼 첫 해 면제</label></p><p style="margin:8px 0"><label style="display:inline;color:var(--ink);font-size:13px"><input type="checkbox" data-b="promo.installFree"'+(c.promo.installFree?' checked':'')+'>설치 대행비 면제</label></p><div><label>프로모션 이름 (고객 화면에 표시)</label><input data-x="promo.label" value="'+esc(c.promo.label)+'"></div><div class="grid3" style="margin-top:12px"><div><label>고객 화면 구간 — 아래로(%)</label><input type="number" min="0" max="50" data-p="range.down" value="'+((c.range||{}).down==null?10:c.range.down)+'"></div><div><label>고객 화면 구간 — 위로(%)</label><input type="number" min="1" max="100" data-p="range.up" value="'+((c.range||{}).up||15)+'"></div></div><div class="grid3" style="margin-top:10px">'+['USD','EUR','JPY','CNY'].map(function(k){return '<div><label>외화 견적 환율 — 1 '+k+' (원)</label><input type="number" min="0" step="0.01" data-p="fx.'+k+'" value="'+(((c.fx||{})[k])||'')+'"></div>'}).join('')+'</div><p class="note" style="margin:8px 0 0">외화로 된 견적서는 견적서에 적힌 환율로 원화 환산하고, 환율이 적혀 있지 않으면 위 값을 씁니다.</p><p class="note" style="margin:8px 0 0">고객에게는 모넷 금액을 구간으로만 보여 주고 단가·정확한 합계는 내보내지 않습니다. 이 화면(관제)에는 정확한 계산값이 그대로 보입니다.</p></div></div>'
    +'<div class="card"><h2>고객 화면 고지 문구</h2><textarea data-x="disclaimer" style="min-height:80px">'+esc(c.disclaimer)+'</textarea><p style="margin:12px 0 0"><button class="btn" id="cfgSave">환산 기준 저장</button><span class="msg" id="cfgMsg"></span></p></div>';
  $('#view').innerHTML=h;
}
function setPath(o,p,v){var a=p.split('.'),x=o;for(var i=0;i<a.length-1;i++){x=x[a[i]]=x[a[i]]||{}}x[a[a.length-1]]=v}
function saveCfg(){
  var c=JSON.parse(JSON.stringify(D.cfg));
  document.querySelectorAll('[data-cat]').forEach(function(el){c.catalog[el.dataset.cat].price=Number(el.value)||0});
  document.querySelectorAll('[data-p]').forEach(function(el){setPath(c,el.dataset.p,Number(el.value)||0)});
  document.querySelectorAll('[data-b]').forEach(function(el){setPath(c,el.dataset.b,el.checked)});
  document.querySelectorAll('[data-x]').forEach(function(el){setPath(c,el.dataset.x,el.value)});
  $('#cfgMsg').textContent='저장 중…';
  post({kind:'cfg',cfg:c},function(r){ if(r.ok){D.cfg=r.cfg;$('#cfgMsg').textContent='저장했습니다 — 고객 화면에는 1분 안에 반영됩니다';}else $('#cfgMsg').textContent=r.error||'저장하지 못했습니다'; });
}

document.addEventListener('click',function(e){
  var b=e.target.closest('#tabs button'); if(b){tab=b.dataset.t;document.querySelectorAll('#tabs button').forEach(function(x){x.classList.toggle('on',x===b)}); if(D) paint(); return;}
  b=e.target.closest('#days button'); if(b){days=+b.dataset.d;document.querySelectorAll('#days button').forEach(function(x){x.classList.toggle('on',x===b)});load();return;}
  b=e.target.closest('#dim button'); if(b){dim=b.dataset.dim;vCohort();return;}
  if(e.target.id==='cfgSave'){saveCfg();return;}
  b=e.target.closest('[data-kit],[data-kitreset]'); if(b){var td=b.closest('td'),msg=$('.msg',td);msg.textContent='저장 중…';
    post(b.dataset.kitreset?{kind:'kit',key:b.dataset.kitreset,reset:true}:{kind:'kit',key:b.dataset.kit,items:$('textarea',td).value.split('\\n')},function(r){ if(r.ok){msg.textContent='저장했습니다';load(true);}else msg.textContent=r.error||'저장하지 못했습니다'; });return;}
  b=e.target.closest('[data-acct]'); if(b){var td2=b.closest('td'),m2=$('.msg',td2),s={};td2.querySelectorAll('[data-ev]').forEach(function(el){if(el.value)s[el.dataset.ev]=Number(el.value)});
    m2.textContent='저장 중…';post({kind:'account',key:b.dataset.acct,s:s,total:$('[data-f=total]',td2).value,done:$('[data-f=done]',td2).value,memo:$('[data-f=memo]',td2).value},function(r){ if(r.ok){m2.textContent='저장했습니다';load(true);}else m2.textContent=r.error||'저장하지 못했습니다'; });return;}
  b=e.target.closest('[data-lines]'); if(b){var td3=b.closest('td'),m3=$('.msg',td3);m3.textContent='읽는 중…';
    post({kind:'lines',cid:b.dataset.lines,text:$('[data-lt]',td3).value,vendor:$('[data-lv]',td3).value,opts:{sites:$('[data-lo=sites]',td3).value,years:$('[data-lo=years]',td3).value,vatIncluded:$('[data-lo=vat]',td3).value==='1'}},function(r){ if(r.ok){m3.textContent=r.n+'줄을 저장했습니다';load(true);}else m3.textContent=r.error||'저장하지 못했습니다'; });return;}
  if(e.target.id==='upAll'){document.querySelectorAll('[data-pick]').forEach(function(x){x.checked=e.target.checked});upSel();return;}
  if(e.target.closest('[data-pick]')){upSel();return;}
  if(e.target.id==='upDel'){var pk=[].slice.call(document.querySelectorAll('[data-pick]:checked')); if(!pk.length) return;
    var nl=pk.filter(function(x){return x.dataset.lead==='1'}).length, um=$('#upMsg');
    if(!window.confirm('선택한 '+pk.length+'건을 지웁니다. 올린 파일은 완전히 삭제되며 되돌릴 수 없습니다.'+(nl?' 이 중 '+nl+'건은 비교표 신청이 들어온 건이며, 신청 기록도 이 화면에서 사라집니다.':'')+' 계속할까요?')) return;
    um.textContent='지우는 중…'; e.target.disabled=true;
    post({kind:'del',cids:pk.map(function(x){return x.dataset.pick})},function(r){ if(r.ok){um.textContent=r.n+'건을 지웠습니다 (파일 '+r.files+'개 삭제'+(r.failed?', '+r.failed+'개는 삭제 실패':'')+')';load(true);}else{um.textContent=r.error||'지우지 못했습니다';upSel();} });return;}
  if(e.target.closest('tr.open')) return;
  var tr=e.target.closest('tr.row'); if(!tr||!D) return;
  if(tr.dataset.u!=null) openUp(tr); else if(tr.dataset.c!=null) openKit(tr); else if(tr.dataset.a!=null) openAcct(tr);
});
load();
})();
</script></body></html>`;
