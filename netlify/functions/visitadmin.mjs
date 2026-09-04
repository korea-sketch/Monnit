/** 현장 진단 예약 — 스케줄 관리 화면 (/visit/admin)
 *  로그인 전에는 관리 화면 코드조차 내려가지 않는다.
 *  아이디·비밀번호는 Netlify 환경변수 VISIT_USER / VISIT_PASS 로만 받는다.
 */
import * as auth from './_visit_auth.mjs';
import { get, set } from './_store.mjs';

export const config = {
  path: ['/visit/admin', '/visit/admin/', '/visit/admin/login', '/visit/admin/logout']
};

const MAX_FAIL = 8, LOCK_MS = 15 * 60 * 1000;

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY'
};
const page = (body, extra) => new Response(body,
  { status: 200, headers: { ...H, 'content-type': 'text/html; charset=utf-8', ...(extra || {}) } });
const redirect = (to, extra) => new Response(null,
  { status: 303, headers: { ...H, location: to, ...(extra || {}) } });

function ipOf(req) {
  return String(req.headers.get('x-nf-client-connection-ip')
    || req.headers.get('x-forwarded-for') || '?').split(',')[0].trim().slice(0, 45)
    .replace(/[^\w.:-]/g, '_');
}
async function fails(k) {
  try {
    const o = JSON.parse(await get('ops', 'visitfail_' + k) || 'null');
    return (o && Date.now() - o.t < LOCK_MS) ? o : { n: 0, t: 0 };
  } catch { return { n: 0, t: 0 }; }
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ─────────────────────────────────────────────────────────── */
export default async (req) => {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '') || '/visit/admin';

  /* 로그아웃 */
  if (p === '/visit/admin/logout') {
    return redirect('/visit/admin', { 'set-cookie': auth.clearCookie() });
  }

  /* 로그인 처리 */
  if (p === '/visit/admin/login' && req.method === 'POST') {
    if (!auth.configured()) return page(LOGIN({ notice: '아직 잠금이 설정되지 않았습니다. Netlify 환경변수 VISIT_USER / VISIT_PASS 를 먼저 등록해 주세요.' }));

    const key = ipOf(req);
    const f = await fails(key);
    if (f.n >= MAX_FAIL) {
      const left = Math.ceil((LOCK_MS - (Date.now() - f.t)) / 60000);
      return page(LOGIN({ error: `여러 번 틀렸습니다. ${left}분 뒤에 다시 시도해 주세요.` }));
    }

    let u = '', pw = '';
    try {
      const fd = await req.formData();
      u = String(fd.get('u') || '');
      pw = String(fd.get('p') || '');
    } catch { /* 파싱 실패는 실패로 처리 */ }

    if (auth.check(u, pw)) {
      try { await set('ops', 'visitfail_' + key, JSON.stringify({ n: 0, t: 0 })); } catch {}
      return redirect('/visit/admin', { 'set-cookie': auth.setCookie(auth.issue()) });
    }
    try { await set('ops', 'visitfail_' + key, JSON.stringify({ n: f.n + 1, t: Date.now() })); } catch {}
    return page(LOGIN({ error: '아이디 또는 비밀번호가 맞지 않습니다.' }));
  }

  /* 그 외 — 인증 확인 */
  if (!auth.configured()) {
    return page(LOGIN({ notice: '아직 잠금이 설정되지 않았습니다. Netlify 환경변수 VISIT_USER / VISIT_PASS 를 등록한 뒤 다시 열어 주세요.' }));
  }
  if (!auth.valid(auth.cookieFrom(req.headers))) {
    return page(LOGIN({}));
  }
  return page(ADMIN());
};

/* ═══════════════════════ 로그인 화면 ═══════════════════════ */
function LOGIN({ error, notice } = {}) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>스케줄 관리 로그인 | 모넷코리아</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/visit.css">
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <h1>스케줄 관리
      <span class="sub">현장 진단 방문 일정을 여는 화면입니다.<br>담당자만 들어올 수 있습니다.</span>
    </h1>
    ${error ? `<div class="banner bad" style="margin:0">${esc(error)}</div>` : ''}
    ${notice ? `<div class="banner" style="margin:0">${esc(notice)}</div>` : ''}
    <form method="post" action="/visit/admin/login">
      <div class="field">
        <label for="u">아이디</label>
        <input id="u" name="u" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required>
      </div>
      <div class="field">
        <label for="p">비밀번호</label>
        <input id="p" name="p" type="password" autocomplete="current-password" required>
      </div>
      <div class="actions"><button class="btn" type="submit">들어가기</button></div>
    </form>
    <p class="hint" style="margin:0">
      고객용 예약 화면은 <a href="/visit">monnit.co.kr/visit</a> 입니다.
    </p>
  </div>
</div>
</body>
</html>`;
}

/* ═══════════════════════ 관리 화면 ═══════════════════════ */
function ADMIN() {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>스케줄 관리 | 모넷코리아</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/visit.css">
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="brand">
      <a href="/" class="brand-mark">Monnit Korea</a>
      <span class="brand-name">스케줄 관리</span>
    </div>
    <div class="masthead-meta">
      <a href="/visit/admin/logout" style="color:var(--ink-3)">로그아웃</a>
    </div>
  </header>

  <div class="statline">
    <div class="stat"><span class="k">공개 기간 내 슬롯</span><span class="v" id="stSlots">–</span></div>
    <div class="stat"><span class="k">방문 가능일</span><span class="v" id="stDays">–</span></div>
    <div class="stat"><span class="k">첫 방문 가능일</span><span class="v" id="stFirst">–</span></div>
    <div class="stat"><span class="k">제외된 날</span><span class="v" id="stClosed">–</span></div>
  </div>

  <div class="admin-grid">
    <div>
      <div class="card">
        <h3>근무 조건
          <span class="sub">여기서 정한 값이 고객 화면의 선택 가능한 시간을 그대로 결정합니다.</span>
        </h3>
        <div class="field"><label>방문 가능 요일</label><div class="dows" id="dowset"></div></div>
        <div class="row2">
          <div class="field"><label for="s-start">업무 시작</label><input id="s-start" type="time"></div>
          <div class="field"><label for="s-end">업무 종료</label><input id="s-end" type="time"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="s-lstart">점심 시작</label><input id="s-lstart" type="time"></div>
          <div class="field"><label for="s-lend">점심 종료</label><input id="s-lend" type="time"></div>
        </div>
        <div class="row3">
          <div class="field"><label for="s-mins">방문 소요(분)</label><input id="s-mins" type="number" min="15" max="480" step="15"></div>
          <div class="field"><label for="s-buffer">이동 버퍼(분)</label><input id="s-buffer" type="number" min="0" max="240" step="15"></div>
          <div class="field"><label for="s-gran">슬롯 간격(분)</label><input id="s-gran" type="number" min="15" max="120" step="15"></div>
        </div>
        <div class="row3">
          <div class="field"><label for="s-lead">최소 리드타임(시간)</label><input id="s-lead" type="number" min="0" max="720"></div>
          <div class="field"><label for="s-hor">공개 기간(일)</label><input id="s-hor" type="number" min="1" max="120"></div>
          <div class="field"><label for="s-max">하루 최대 건수</label><input id="s-max" type="number" min="1" max="10"></div>
        </div>
        <p class="hint">리드타임은 사전 통화에 필요한 시간입니다. 영업일 3~4일을 확보하려면 72시간 이상으로 두세요.</p>
      </div>

      <div class="card">
        <h3>쉬는 날 추가
          <span class="sub">휴가, 출장, 전사 행사처럼 하루 전체를 비워야 하는 날입니다. 공휴일은 자동으로 빠집니다.</span>
        </h3>
        <div class="row2">
          <div class="field"><label for="c-date">날짜</label><input id="c-date" type="date"></div>
          <div class="field"><label for="c-memo">메모 (선택)</label><input id="c-memo" placeholder="예) 하계 휴가"></div>
        </div>
        <div class="actions"><button class="btn sm" id="addClosed" type="button">쉬는 날 추가</button></div>
        <div class="chiplist" id="closedList"></div>
      </div>

      <div class="card">
        <h3>시간 막기
          <span class="sub">이미 잡힌 미팅이나 확정된 방문처럼 하루 중 일부만 막을 때 씁니다. 확정된 예약도 여기에 넣어 두면 이중 예약이 생기지 않습니다.</span>
        </h3>
        <div class="row3">
          <div class="field"><label for="b-date">날짜</label><input id="b-date" type="date"></div>
          <div class="field"><label for="b-start">시작</label><input id="b-start" type="time"></div>
          <div class="field"><label for="b-end">종료</label><input id="b-end" type="time"></div>
        </div>
        <div class="field"><label for="b-memo">메모 (선택)</label><input id="b-memo" placeholder="예) LG 가산 방문"></div>
        <div class="actions"><button class="btn sm" id="addBlock" type="button">시간 막기 추가</button></div>
        <div class="chiplist" id="blockList"></div>
      </div>

      <div class="card">
        <h3>자동으로 빠지는 공휴일
          <span class="sub">대한민국 관공서 공휴일과 대체공휴일입니다. 따로 넣지 않아도 예약 화면에서 빠집니다.</span>
        </h3>
        <div class="holgrid" id="holList"></div>
      </div>
    </div>

    <div>
      <div class="card">
        <h3>고객에게 보낼 링크
          <span class="sub">지금 설정을 링크에 담아 만듭니다. 사이트를 다시 올릴 필요가 없습니다.</span>
        </h3>
        <div class="actions">
          <button class="btn" id="makeLink" type="button">링크 만들기</button>
          <button class="btn ghost sm" id="copyLink" type="button">복사</button>
        </div>
        <textarea class="linkout" id="linkOut" readonly spellcheck="false" placeholder="‘링크 만들기’를 누르면 여기에 나옵니다."></textarea>
        <p class="hint" id="linkHint"></p>
      </div>

      <div class="card">
        <h3>미리보기</h3>
        <div class="preview" id="previewBox"></div>
      </div>

      <div class="card">
        <h3>들어온 예약 보기</h3>
        <p class="hint" style="margin:0">접수된 예약은 monday 보드에 쌓입니다. 상태·담당 엔지니어·설비 정보를 그곳에서 관리하세요.</p>
        <div class="actions">
          <a class="btn ghost sm" href="https://monnitk.monday.com/boards/18429687217" target="_blank" rel="noopener">monday 보드 열기</a>
        </div>
      </div>

      <div class="card">
        <h3>설정 저장</h3>
        <div class="actions">
          <button class="btn sm" id="saveCfg" type="button">이 컴퓨터에 저장</button>
          <button class="btn ghost sm" id="resetCfg" type="button">처음 값으로</button>
        </div>
        <p class="hint" id="cfgHint">저장하면 이 컴퓨터에서 다음에 열 때 그대로 불러옵니다.</p>
      </div>
    </div>
  </div>

  <footer class="foot">
    <span>MONNIT KOREA · 스케줄 관리</span>
    <span>ADMIN · NOINDEX</span>
  </footer>
</div>

<script src="/visit-core.js"></script>
<script>
(function(){
  "use strict";
  var V=window.VisitCore;
  var cfg=V.loadCfg().cfg;

  function fillForm(){
    document.getElementById("s-start").value=cfg.dayStart;
    document.getElementById("s-end").value=cfg.dayEnd;
    document.getElementById("s-lstart").value=cfg.lunchStart;
    document.getElementById("s-lend").value=cfg.lunchEnd;
    document.getElementById("s-mins").value=cfg.mins;
    document.getElementById("s-buffer").value=cfg.buffer;
    document.getElementById("s-gran").value=cfg.granularity;
    document.getElementById("s-lead").value=cfg.leadHours;
    document.getElementById("s-hor").value=cfg.horizonDays;
    document.getElementById("s-max").value=cfg.maxPerDay;
    var box=document.getElementById("dowset"); box.innerHTML="";
    V.DOW_KO.forEach(function(d,i){
      var b=document.createElement("button");
      b.type="button"; b.className="dow-chip"; b.textContent=d;
      b.setAttribute("aria-pressed",String(cfg.workdays.indexOf(i)!==-1));
      b.addEventListener("click",function(){
        b.setAttribute("aria-pressed",String(b.getAttribute("aria-pressed")!=="true"));
        pullForm(); render();
      });
      box.appendChild(b);
    });
  }
  function pullForm(){
    var days=[];
    Array.prototype.forEach.call(document.querySelectorAll("#dowset .dow-chip"),function(b,i){
      if(b.getAttribute("aria-pressed")==="true") days.push(i);
    });
    cfg.workdays=days;
    cfg.dayStart=document.getElementById("s-start").value||"09:30";
    cfg.dayEnd=document.getElementById("s-end").value||"16:00";
    cfg.lunchStart=document.getElementById("s-lstart").value||"12:00";
    cfg.lunchEnd=document.getElementById("s-lend").value||"13:00";
    cfg.mins=Math.max(15,parseInt(document.getElementById("s-mins").value,10)||60);
    cfg.buffer=Math.max(0,parseInt(document.getElementById("s-buffer").value,10)||0);
    cfg.granularity=Math.max(15,parseInt(document.getElementById("s-gran").value,10)||30);
    cfg.leadHours=Math.max(0,parseInt(document.getElementById("s-lead").value,10)||0);
    cfg.horizonDays=Math.max(1,parseInt(document.getElementById("s-hor").value,10)||28);
    cfg.maxPerDay=Math.max(1,parseInt(document.getElementById("s-max").value,10)||1);
  }
  function renderClosed(){
    var box=document.getElementById("closedList");
    if(!cfg.closed.length){box.innerHTML='<span class="hint">등록된 쉬는 날이 없습니다.</span>';return;}
    box.innerHTML="";
    cfg.closed.slice().sort(function(a,b){return a.d<b.d?-1:1;}).forEach(function(x){
      var el=document.createElement("span"); el.className="chip";
      el.innerHTML=V.esc(x.d)+(x.memo?' <span class="memo">'+V.esc(x.memo)+'</span>':'');
      var del=document.createElement("button"); del.type="button"; del.textContent="\\u00d7"; del.title="삭제";
      del.addEventListener("click",function(){
        cfg.closed=cfg.closed.filter(function(y){return y.d!==x.d;});
        renderClosed(); render();
      });
      el.appendChild(del); box.appendChild(el);
    });
  }
  function renderBlocks(){
    var box=document.getElementById("blockList");
    if(!cfg.blocks.length){box.innerHTML='<span class="hint">막아 둔 시간이 없습니다.</span>';return;}
    box.innerHTML="";
    cfg.blocks.slice().sort(function(a,b){return (a.d+a.s)<(b.d+b.s)?-1:1;}).forEach(function(x){
      var el=document.createElement("span"); el.className="chip";
      el.innerHTML=V.esc(x.d)+" "+V.esc(x.s)+"\\u2013"+V.esc(x.e)+(x.memo?' <span class="memo">'+V.esc(x.memo)+'</span>':'');
      var del=document.createElement("button"); del.type="button"; del.textContent="\\u00d7"; del.title="삭제";
      del.addEventListener("click",function(){
        cfg.blocks=cfg.blocks.filter(function(y){return !(y.d===x.d&&y.s===x.s&&y.e===x.e);});
        renderBlocks(); render();
      });
      el.appendChild(del); box.appendChild(el);
    });
  }
  function renderHolidays(){
    var box=document.getElementById("holList"), t=V.today(), out=[];
    Object.keys(V.HOLIDAYS).sort().forEach(function(k){
      if(k>=t) out.push('<div><b>'+k+'</b>'+V.esc(V.HOLIDAYS[k])+'</div>');
    });
    box.innerHTML=out.join("")||'<span class="hint">등록된 공휴일이 없습니다.</span>';
  }
  function render(){
    var keys=V.horizonKeys(cfg), total=0, days=0, first=null, closedCnt=0;
    keys.forEach(function(k){
      var n=V.slotsFor(cfg,k).length;
      if(n){ total+=n; days++; if(!first) first=k; }
      else if(V.HOLIDAYS[k]||V.closedMemo(cfg,k)!==null) closedCnt++;
    });
    document.getElementById("stSlots").textContent=total;
    document.getElementById("stDays").textContent=days+"일";
    document.getElementById("stFirst").textContent=first?first.slice(5).replace("-","/"):"–";
    document.getElementById("stClosed").textContent=closedCnt+"일";

    var pv=document.getElementById("previewBox"), rows=[];
    keys.forEach(function(k){
      var list=V.slotsFor(cfg,k);
      if(list.length){
        rows.push('<div class="pv-row"><span class="k">'+V.esc(V.labelDate(k))+'</span><span class="v">'+
          V.esc(list[0].hm)+" ~ "+V.esc(list[list.length-1].hm)+" \\u00b7 "+list.length+'개</span></div>');
      }
    });
    pv.innerHTML=rows.slice(0,12).join("")||'<p class="hint" style="margin:0">지금 조건으로는 예약 가능한 시간이 없습니다. 요일이나 리드타임을 확인해 주세요.</p>';
    if(rows.length>12) pv.innerHTML+='<p class="hint" style="margin:6px 0 0">외 '+(rows.length-12)+'일 더 있습니다.</p>';
  }

  document.getElementById("addClosed").addEventListener("click",function(){
    var d=document.getElementById("c-date").value, memo=document.getElementById("c-memo").value.trim();
    if(!d) return;
    cfg.closed=cfg.closed.filter(function(x){return x.d!==d;});
    cfg.closed.push({d:d,memo:memo});
    document.getElementById("c-date").value=""; document.getElementById("c-memo").value="";
    renderClosed(); render();
  });
  document.getElementById("addBlock").addEventListener("click",function(){
    var d=document.getElementById("b-date").value,
        s=document.getElementById("b-start").value,
        e=document.getElementById("b-end").value,
        memo=document.getElementById("b-memo").value.trim();
    if(!d||!s||!e||V.toMin(e)<=V.toMin(s)) return;
    cfg.blocks.push({d:d,s:s,e:e,memo:memo});
    document.getElementById("b-date").value=""; document.getElementById("b-start").value="";
    document.getElementById("b-end").value=""; document.getElementById("b-memo").value="";
    renderBlocks(); render();
  });
  ["s-start","s-end","s-lstart","s-lend","s-mins","s-buffer","s-gran","s-lead","s-hor","s-max"]
    .forEach(function(id){
      document.getElementById(id).addEventListener("change",function(){pullForm();render();});
    });

  document.getElementById("makeLink").addEventListener("click",function(){
    pullForm();
    var url=location.origin+"/visit?s="+V.encodeCfg(cfg);
    document.getElementById("linkOut").value=url;
    document.getElementById("linkHint").textContent=
      "이 링크를 고객에게 보내면 위 설정이 그대로 적용됩니다. 스케줄을 바꾸면 링크를 다시 만들어 주세요. ("+url.length+"자)";
    render();
  });
  document.getElementById("copyLink").addEventListener("click",function(){
    var t=document.getElementById("linkOut"); if(!t.value) return;
    var btn=this; t.focus(); t.select();
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t.value).then(function(){btn.textContent="복사됨";},function(){});
    } else { try{document.execCommand("copy");btn.textContent="복사됨";}catch(e){} }
    setTimeout(function(){btn.textContent="복사";},2000);
  });
  document.getElementById("saveCfg").addEventListener("click",function(){
    pullForm();
    var h=document.getElementById("cfgHint");
    h.textContent = V.saveCfg(cfg)
      ? "저장했습니다."
      : "이 브라우저에서는 저장할 수 없습니다. 대신 고객용 링크를 만들어 보관하세요.";
    render();
  });
  document.getElementById("resetCfg").addEventListener("click",function(){
    cfg=JSON.parse(JSON.stringify(V.DEFAULT_CFG));
    V.clearCfg();
    fillForm(); renderClosed(); renderBlocks(); render();
    document.getElementById("cfgHint").textContent="처음 값으로 되돌렸습니다.";
  });

  fillForm(); renderClosed(); renderBlocks(); renderHolidays(); render();
})();
</script>
</body>
</html>`;
}
