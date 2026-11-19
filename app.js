/* ── 개발용 디버그 로그 스위치 ─────────────────────────────────────────
   기본은 꺼짐(운영). 켜려면 주소 뒤에 ?debug=1 을 붙이거나
   콘솔에서 localStorage.setItem('monnit_debug','1') 후 새로고침. */
var MONNIT_DEBUG = (function(){
  try{
    if (new URLSearchParams(location.search).get('debug') === '1'){ localStorage.setItem('monnit_debug','1'); return true; }
    if (new URLSearchParams(location.search).get('debug') === '0'){ localStorage.removeItem('monnit_debug'); return false; }
    return localStorage.getItem('monnit_debug') === '1';
  }catch(e){ return false; }
})();
function dlog(){ if (MONNIT_DEBUG) console.log.apply(console, arguments); }
/* ============================================================
   ========== 상담/문의 폼 수신 설정 (FORM DELIVERY) ==========
   ▼ 여기 이메일 한 줄만 바꾸면, 모든 상담신청·구독·백서신청이
     해당 이메일로 실제 발송됩니다. (별도 서버/가입 불필요)

   처음 한 번만: 사이트에서 폼을 한 번 제출하면 FormSubmit이
   아래 주소로 "활성화 확인" 메일을 보냅니다. 그 메일의 링크를
   한 번 클릭하면 이후 모든 접수 메일이 정상 수신됩니다.
   (대안: Web3Forms 등으로 교체 가능)
   ============================================================ */
const CONTACT_EMAIL = "korea@monnit.com";   // ← 수신 이메일 주소

/* ============================================================
   대용량 data.js(지식베이스·가이드 ~1.5MB) 지연 로딩
   — 홈·광고·대부분 페이지는 이 데이터가 필요 없으므로, 지식베이스/가이드를
     실제로 열 때만 data.js를 내려받아 초기 로딩을 크게 줄인다.
   ============================================================ */
window.KNOWLEDGEBASE = window.KNOWLEDGEBASE || [];  // data.js 로드 전 안전 기본값
window.GUIDES        = window.GUIDES || [];
window.__KB_BASE     = window.__KB_BASE || [];
/* 지식베이스: 시트 행(__kbRows)과 data.js 본문(__KB_BASE)을 병합해 KNOWLEDGEBASE 구성 */
function rebuildKB(){
  try{
    var base = window.__KB_BASE || [];
    var rows = window.__kbRows || null;
    if (rows && rows.length && typeof mapKnowledgebase === 'function'){
      var m = mapKnowledgebase(rows);
      if (m.length){
        var byTitle = {}; base.forEach(function(d){ byTitle[(d.title||'').trim()] = d; });
        window.KNOWLEDGEBASE = m.map(function(row,i){ var mt = byTitle[(row.title||'').trim()]; return Object.assign({ id:'kb'+i, body: mt?mt.body:'' }, row); });
        /* 2026-10-29 — data.js 에서 pin:true 인 문서(Scube 플랫폼 등)는 시트에 행이 없어도 항상 보이게 덧붙인다 */
        var have = {}; window.KNOWLEDGEBASE.forEach(function(d){ have[(d.title||'').trim()] = 1; });
        base.forEach(function(d){ if (d.pin && !have[(d.title||'').trim()]) window.KNOWLEDGEBASE.push(d); });
        return;
      }
    }
    window.KNOWLEDGEBASE = base.slice();   // 시트 KB 행이 없으면 data.js 원본 사용
  }catch(e){ console.warn('[rebuildKB]', e); }
}
/* data.js를 필요 시 1회만 동적 로드 후 콜백 */
function ensureDataJS(cb){
  if (window.__DATA_READY){ rebuildKB(); if(cb) cb(); return; }
  window.__dataCbs = window.__dataCbs || [];
  if (cb) window.__dataCbs.push(cb);
  if (window.__dataLoading) return;
  window.__dataLoading = true;
  var s = document.createElement('script');
  s.src = '/data.js?v=111'; s.async = true;
  s.onload = function(){
    window.__DATA_READY = true;
    rebuildKB();                                   // 본문 병합
    (window.__dataCbs||[]).forEach(function(f){ try{ f&&f(); }catch(e){} });
    window.__dataCbs = [];
  };
  s.onerror = function(){
    window.__dataLoading = false;
    console.warn('[data.js] 로드 실패 — 지식베이스/가이드 표시 불가');
    (window.__dataCbs||[]).forEach(function(f){ try{ f&&f(); }catch(e){} });
    window.__dataCbs = [];
  };
  document.head.appendChild(s);
}
/* 솔루션 페이지 HVAC 디지털 트윈 스크립트(약 400KB) — #our-solution 진입 시 1회만 로드
   (홈·광고 등에서는 로드하지 않아 초기 파싱/실행 부담을 없앰) */
/* 맞춤 제안서 화면(/proposal · /proposal/status) — 들어올 때만 데이터(약 45KB)와 화면 스크립트를 불러옵니다 */
function ensureProposal(cb){
  if (window.MKProposal){ if (cb) cb(window.MKProposal); return; }
  window.__propCbs = window.__propCbs || [];
  if (cb) window.__propCbs.push(cb);
  if (window.__propLoading) return;
  window.__propLoading = true;
  var add = function(src, next){
    var s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = next;
    s.onerror = function(){ window.__propLoading = false; console.warn('[proposal] 스크립트 로드 실패:', src);
      var box = document.getElementById('ppsApp') || document.getElementById('ppLmText');
      if (box) box.textContent = '화면을 불러오지 못했습니다. 새로고침하시거나 02-2088-1454 로 연락 주세요.'; };
    document.head.appendChild(s);
  };
  var done = function(){
    window.__propLoading = false;
    (window.__propCbs || []).forEach(function(f){ try { f && f(window.MKProposal); } catch(e){ console.warn('[proposal]', e); } });
    window.__propCbs = [];
  };
  add('/js/proposal-data.js?v=7', function(){ add('/js/proposal-insight-map.js?v=2', function(){ add('/js/region-data.js?v=1', function(){ add('/js/proposal-view.js?v=55', done); }); }); });
}
/* Monnit AI is available site-wide, independently of the proposal view. */
function ensureProposalChat(){
  if (window.MKPropChat || window.__propChatLoading) return;
  window.__propChatLoading = true;
  var s = document.createElement('script');
  s.src = '/js/proposal-chat.js?v=33'; s.async = true;
  s.onload = function(){ window.__propChatLoading = false; if (window.MKPropChat) window.MKPropChat.bind(); };
  s.onerror = function(){ window.__propChatLoading = false; console.warn('[proposal-chat] load failed'); };
  document.head.appendChild(s);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureProposalChat);
else ensureProposalChat();
/* 2026-10-29 — 모니 바로 열기
   · 주소: /?moni=support&q=질문  (문제 해결 화면 + 질문 검색) · ?moni=support&a=문서id · ?moni=ticket · ?moni=open
     Scube 매뉴얼 PDF·QR·기술 문서에서 이 주소로 들어온다. 열고 나면 주소창에서 moni 파라미터를 지운다(새로고침 시 다시 열리지 않게).
   · 페이지 안 링크: <a data-moni-q="질문"> 를 누르면 이동 없이 모니 문제 해결이 열린다. */
function openMoniWith(o, tries){
  if (window.MKPropChat && window.MKPropChat.openSupport){
    if (o.mode === 'open') window.MKPropChat.open(); else window.MKPropChat.openSupport(o);
    return;
  }
  ensureProposalChat();
  if ((tries||0) < 40) setTimeout(function(){ openMoniWith(o, (tries||0)+1); }, 150);
}
(function moniDeepLink(){
  try{
    var p = new URLSearchParams(location.search), m = p.get('moni');
    if (!m) return;
    var o = { from: 'link-' + (p.get('src') || 'url').replace(/[^\w-]/g,'').slice(0,40) };
    if (p.get('q')) o.q = p.get('q').slice(0, 200);
    if (p.get('a')) o.article = p.get('a').replace(/[^\w-]/g,'').slice(0,60);
    if (m === 'ticket') o.ticket = true;
    if (m === 'open') o.mode = 'open';
    ['moni','q','a','src'].forEach(function(k){ p.delete(k); });
    var qs = p.toString();
    try { history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch(e){}
    var go = function(){ setTimeout(function(){ openMoniWith(o, 0); }, 400); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }catch(e){ console.warn('[moni-link]', e); }
})();
document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('[data-moni-q]');
  if (!a) return;
  e.preventDefault();
  openMoniWith({ q: a.getAttribute('data-moni-q') || '', from: 'kb-link' }, 0);
});
function ensureSolutionTwin(){
  if (window.__twinLoaded || window.__twinLoading) return;
  var mount = document.getElementById('mhTwin');
  if (!mount) return;   // 컨테이너 없으면 스킵
  window.__twinLoading = true;
  var loadScript = function(){
    var s = document.createElement('script');
    s.src = '/js/solution-twin.js?v=110'; s.async = true;
    s.onload = function(){ window.__twinLoaded = true; };
    s.onerror = function(){ window.__twinLoading = false; console.warn('[solution-twin] script 로드 실패'); };
    document.head.appendChild(s);
  };
  if (mount.__filled){ loadScript(); return; }
  // 트윈 마크업(약 236KB · SVG/패널)을 먼저 주입한 뒤 애니메이션 스크립트 로드
  fetch('/views/solution-twin.html?v=110').then(function(r){ return r.ok ? r.text() : ''; })
    .then(function(html){
      if (html){ mount.innerHTML = html; mount.__filled = true; loadScript(); }
      else { window.__twinLoading = false; console.warn('[solution-twin] fragment 비어있음'); }
    })
    .catch(function(){ window.__twinLoading = false; console.warn('[solution-twin] fragment 로드 실패'); });
}

/* ★★★ Google Forms 방식 (구글 인증·차단 없음 / 응답이 구글시트에 자동 저장) ★★★
   설정: 구글폼을 만들고(질문: 이름/회사명·이메일·전화번호·산업군·문의항목·문의내용),
        '미리 채워진 링크 받기'로 각 칸의 entry.번호 를 알아내 아래에 넣으세요.
        제출 주소는 .../viewform 대신 .../formResponse 입니다. */
const GOOGLE_FORM_URL = "";   // 예: "https://docs.google.com/forms/d/e/1FAIpQLS.../formResponse"
const GOOGLE_FORM_FIELDS = {  // 사이트 폼 필드 → 구글폼 entry 번호
  '구분':        "",   // 예: "entry.111111111"
  '회사명':      "",   // 예: "entry.222222222"
  '담당자명':    "",
  '이메일':      "",
  '전화번호':    "",
  '산업군':      "",
  '문의항목':    "",
  '문의내용':    "",
  '출처':        ""
};

/* ★★ 무제한·무료 방식: Google Apps Script (문의가 구글 시트에 저장 + 메일 발송)
   설정: 가이드 참고 → 스크립트 배포 후 받은 /exec 주소를 아래에 붙여넣기 (이 한 줄만). */
const GAS_ENDPOINT = "";   // 예: "https://script.google.com/macros/s/AKfy.../exec"

/* ★ 추천 대안: 엔드포인트 방식 (Static Forms · Splitforms · Formspree · Basin · Getform 등)
   각 서비스 가입 후 발급받은 "폼 엔드포인트 URL" 을 아래에 붙여넣기 (이 한 줄만). 활성화 클릭·OAuth 불필요. */
const FORM_POST_URL = "";  // 예: "https://formspree.io/f/xxxx" / "https://api.staticforms.dev/submit/xxxx"

/* ══ 알림 발송처 설정 ══════════════════════════════════════════════
   2026-09-04 사고 요약: StaticForms 가 200 { success:true } 를 돌려주면서
   메일은 보내지 않았다. 예전 코드는 그 성공을 믿고 즉시 return 해서,
   멀쩡히 살아 있던 Web3Forms 를 건너뛰었다. 한 곳이 거짓말하면 전체가 멈췄다.

   그래서 「누가 성공을 판정하는가」를 한 줄로 분리했다.
     · NOTIFY_VIA 로 지정한 곳만 성공/실패를 판정한다
     · 나머지 한 곳은 보내고 잊는다 — 응답을 읽지 않으므로 거짓말에 속지 않는다

   StaticForms 메일이 다시 오는 걸 확인하면:
     NOTIFY_VIA = "staticforms"  로 바꾸면 사장님이 보시던 그 형식으로 돌아간다.
     그때 NOTIFY_BOTH 를 false 로 두면 메일이 한 통만 온다.
   ══════════════════════════════════════════════════════════════ */
const NOTIFY_VIA  = "web3forms";  /* "web3forms" | "staticforms" — 성공을 판정하는 쪽 */
const NOTIFY_BOTH = false;        /* true = 나머지 한 곳에도 사본 발송 (메일 2통) */

const STATICFORMS_URL = "https://api.staticforms.dev/submit";
const STATICFORMS_KEY = ((typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|.*\.local)$/.test(location.hostname))?'':"sf_e026c9ef91b8eaeba9d1d472");

/* ★★ Web3Forms — 서버가 죽었을 때만 쓰는 비상 경로.
   평소 알림은 서버가 Brevo 로 NOTIFY_TO(0702yeom@gmail.com) 에 보낸다.
   이 키는 「키에 등록된 주소」로만 발송되므로 여기서 수신자를 정할 수 없다.
   수신자를 이 경로까지 바꾸려면 web3forms.com 에서 0702yeom@gmail.com 으로
   새 access key 를 발급받아 아래 한 줄만 교체하면 된다. */
const WEB3FORMS_KEY = ((typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|.*\.local)$/.test(location.hostname))?'':"e4d5cb03-1b25-425c-a47d-f04e4a05e7e2");

/* (대안) FormSubmit — 무제한 무료. 단, 최초 1회 활성화 메일 클릭 필요 */
const FORM_ENDPOINT = "https://formsubmit.co/ajax/" + encodeURIComponent(CONTACT_EMAIL);

/* 제안서 비밀번호 발송용 Apps Script 웹앱 (korea@monnit.com 명의 발신)
   — 배포 후 받은 웹 앱 URL을 아래에 붙여넣으면 자동 전환됩니다. 비어 있으면 FormSubmit 자동회신 사용 */
const PW_MAIL_URL = "/api/fn/sendpw"; /* 2026-09-17: 서버 함수 경로(Cloudflare Worker /api/fn/*) */
const PW_MAIL_TOKEN = "mnt-pw-2026-7f3k9";

/* 폼 데이터를 실제로 전송하는 공통 함수 (AJAX — 페이지 이동 없음)
   반환값: true(서버 전송 성공) / 'mailto'(메일 앱으로 작성) / false(실패) */
function buildMailto(payload){
  const subject = payload._subject || '모넷코리아 웹사이트 문의';
  const skip = ['_subject','_url','_captcha','_template'];
  const lines = Object.keys(payload).filter(k => skip.indexOf(k)<0).map(k => k + ': ' + payload[k]);
  const body = lines.join('\n');
  return 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}
/* 개발·테스트 주소인가 — 여기서는 외부 메일 서비스를 부르지 않는다 (2026-09-18) */
window.MonnitNotify = window.MonnitNotify || {};
window.MonnitNotify.isDevHost = function(){
  try {
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0' || /\.local$/.test(h) || /^192\.168\./.test(h) || /^10\./.test(h);
  } catch(e){ return false; }
};

async function sendLead(payload, btn){
  /* 마지막 방어선 — 어느 폼을 거쳐 오든 형식이 틀린 연락처는 여기서 끊는다. */
  try {
    var _V = window.MonnitValid;
    if (_V) {
      var _em = payload['이메일'] || payload.email || '';
      var _ph = payload['전화번호'] || '';
      if (_em && !_V.email(_em).ok) { alert(_V.email(_em).message); return false; }
      if (_ph && !_V.phone(_ph).ok) { alert(_V.phone(_ph).message); return false; }
    }
  } catch(e){}
  /* 개발·테스트 주소(localhost)에서는 실제 알림 메일을 절대 보내지 않는다. (2026-09-18)
     화면 자동 테스트가 담당자 메일함으로 가짜 접수를 흘려보내던 문제를 막는다.
     접수 자체(원장 기록·화면 흐름)는 그대로 진행되므로 테스트는 계속 유효하다. */
  if (window.MonnitNotify && window.MonnitNotify.isDevHost && window.MonnitNotify.isDevHost()) {
    try { console.info('[모넷] 개발 주소 — 알림 메일 보내지 않음', payload._subject || ''); } catch(e){}
    try { if (window.MonnitLead && window.MonnitLead.setNotified) window.MonnitLead.setNotified(false); } catch(e){}
    return true;
  }
  const prevText = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.dataset._t = prevText; btn.textContent = '전송 중…'; }
  const restore = () => { if (btn){ btn.disabled = false; btn.textContent = btn.dataset._t || prevText; } };
  /* 브라우저에서 알림 메일이 나갔는지 원장에 알려준다.
     서버는 이 값을 보고 「안 나갔을 때만」 한 통 보낸다 → 총 1통. */
  const notified = (v) => { try { if (window.MonnitLead && window.MonnitLead.setNotified) window.MonnitLead.setNotified(v); } catch(e){} };
  notified(false);

  const mailto = () => {
    restore();
    /* 메일 경로가 전부 실패해도 접수 사실은 원장에 남긴다.
       전환(track)은 부르지 않는다 — 실패 건이 전환으로 잡히면 안 된다. */
    try { if (window.MonnitLead && window.MonnitLead.recordPending) window.MonnitLead.recordPending(payload); } catch(e){}
    try { window.location.href = buildMailto(payload); } catch(e){}
    return 'mailto';
  };
  try {
    // 0) Google Forms (구글 인증 없음 · 응답이 구글시트에 자동 저장) — 최우선
    if (GOOGLE_FORM_URL) {
      try {
        const fd = new URLSearchParams();
        Object.keys(GOOGLE_FORM_FIELDS).forEach(function(k){
          const id = GOOGLE_FORM_FIELDS[k];
          if (id && payload[k] != null && payload[k] !== '') fd.append(id, payload[k]);
        });
        await fetch(GOOGLE_FORM_URL, { method:'POST', mode:'no-cors',
          headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: fd.toString() });
        restore(); return true;
      } catch(e){ return mailto(); }
    }
    /* 0b) 두 발송처의 요청 본문 */
    const sfBody = () => JSON.stringify(Object.assign({
      apiKey: STATICFORMS_KEY,
      subject: payload._subject || '모넷코리아 웹사이트 접수',
      email: payload['이메일'] || payload.email || '',
      replyTo: '@',
      honeypot: ''
    }, payload));
    const w3Body = () => JSON.stringify(Object.assign({
      access_key: WEB3FORMS_KEY,
      subject: payload._subject || '모넷코리아 웹사이트 접수',
      from_name: 'Monnit Korea 웹사이트',
      replyto: payload['이메일'] || payload.email || '',
      botcheck: false
    }, payload));
    const JSON_HEAD = { 'Content-Type':'application/json', 'Accept':'application/json' };

    /* 사본 — 응답을 읽지 않고 기다리지도 않는다. 여기서 무슨 일이 나도 본 경로는 간다. */
    const copyTo = (which) => {
      try {
        if (which === 'staticforms' && STATICFORMS_KEY)
          fetch(STATICFORMS_URL, { method:'POST', keepalive:true, headers:JSON_HEAD, body:sfBody() }).catch(function(){});
        if (which === 'web3forms' && WEB3FORMS_KEY)
          fetch('https://api.web3forms.com/submit', { method:'POST', keepalive:true, headers:JSON_HEAD, body:w3Body() }).catch(function(){});
      } catch(e){}
    };

    /* 1순위 — 우리 서버. 원장 기록 · 고객 응대 메일 · 알림 메일 · 먼데이를 여기서 다 한다.
       알림 받는 주소를 우리가 정하려면 서버(Brevo)를 거쳐야 한다.
       Web3Forms · StaticForms 는 키에 등록된 주소로만 보내므로 받는 사람을 못 바꾼다. */
    try {
      if (window.MonnitLead && window.MonnitLead.submit) {
        const served = await window.MonnitLead.submit(payload);
        if (served) { notified(true); restore(); return true; }
      }
    } catch(e){}

    /* 2순위 — 서버가 죽었을 때. 주소는 korea@monnit.com 이 되지만 0통보다 낫다. */
    if (NOTIFY_VIA === 'staticforms' && STATICFORMS_KEY) {
      if (NOTIFY_BOTH) copyTo('web3forms');
      try {
        const res = await fetch(STATICFORMS_URL, { method:'POST', headers:JSON_HEAD, body:sfBody() });
        let ok = res.ok; try { const j = await res.json(); ok = ok && !!j.success; } catch(e){}
        if (ok) { notified(true); restore(); return true; }
      } catch(e){}
      return mailto();
    }
    if (NOTIFY_VIA === 'web3forms' && WEB3FORMS_KEY) {
      if (NOTIFY_BOTH) copyTo('staticforms');
      try {
        const res = await fetch('https://api.web3forms.com/submit', { method:'POST', headers:JSON_HEAD, body:w3Body() });
        let ok = res.ok; try { const j = await res.json(); ok = ok && (j.success === true || j.success === 'true'); } catch(e){}
        if (ok) { notified(true); restore(); return true; }
      } catch(e){}
      return mailto();
    }
    // 1) Google Apps Script (시트 저장 + 메일)
    if (GAS_ENDPOINT) {
      try {
        await fetch(GAS_ENDPOINT, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) });
        restore(); return true;
      } catch(e){ return mailto(); }
    }
    // 2) 범용 엔드포인트 (Static Forms · Splitforms · Formspree · Basin · Getform)
    if (FORM_POST_URL) {
      const res = await fetch(FORM_POST_URL, { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(Object.assign({ subject: payload._subject || '모넷코리아 웹사이트 접수' }, payload)) });
      let ok = res.ok; try { const j = await res.json(); if (j && (j.success===false || j.ok===false || j.error)) ok = false; } catch(e){}
      return ok ? (restore(), true) : mailto();
    }
    // 3) Web3Forms
    if (WEB3FORMS_KEY) {
      const res = await fetch("https://api.web3forms.com/submit", { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(Object.assign({ access_key: WEB3FORMS_KEY, subject: payload._subject || '모넷코리아 웹사이트 접수', from_name:'Monnit Korea 웹사이트', replyto: payload['이메일'] || payload.email || '', botcheck:false }, payload)) });
      let ok = res.ok; try { const j = await res.json(); ok = ok && (j.success===true || j.success==='true'); } catch(e){}
      return ok ? (restore(), true) : mailto();
    }
    // 4) 설정된 백엔드가 없으면 → 방문자 메일 앱으로 작성 (FormSubmit 다운 대비 안전장치)
    return mailto();
  } catch (err) {
    return mailto();
  }
}

/* ========== DATA ========== */
const INDUSTRIES = {
  mfg:    { label: '제조 · 산업',      tag: 'tag-mfg' },
  it:     { label: 'IT · 데이터센터',  tag: 'tag-it' },
  auto:   { label: '자동차 · 운송',    tag: 'tag-auto' },
  energy: { label: '에너지',          tag: 'tag-energy' },
  bio:    { label: '의료 · 바이오',    tag: 'tag-bio' },
  retail: { label: '유통 · 소비재',    tag: 'tag-retail' },
  food:   { label: '외식',            tag: 'tag-food' },
  bldg:   { label: '건설 · 부동산',    tag: 'tag-bldg' },
  edu:    { label: '교육',            tag: 'tag-edu' },
  hotel:  { label: '호텔 · 숙박',      tag: 'tag-hotel' },
  pub:    { label: '공공 · 비영리',    tag: 'tag-pub' },
  defense:{ label: '국방 · 방위',      tag: 'tag-defense' },
  power:  { label: '발전 · 전력',      tag: 'tag-power' }
};

/* NOTE: CUSTOMERS / AWARDS / PARTNERS 아래 데이터는 "기본값(fallback)"입니다.
   구글 시트가 연결되면(아래 CONTENT_SHEET 설정) 시트 내용으로 자동 교체됩니다.
   시트를 못 읽어도 사이트는 이 기본값으로 정상 동작합니다. */
let CUSTOMERS = [
  // === Defense / Power (대표 고객사) ===
  { n:"US Army", i:"defense", h:"군 부대 핵심 전략 자산 모니터링",
    a:["전략 자산 상태 모니터링","탄약·물자 보관 환경 관리","발전기·동력설비 예지보전","연료 저장 탱크 관리","시설 누수·침입 감지","원격 통합 관제"] },
  { n:"GS EPS", i:"power", h:"복합화력 발전 설비 통합 감시",
    a:["터빈·발전기 진동 예지보전","보일러·열교환기 상태 진단","변압기·배전반 모니터링","연료·윤활유 누설 감지","발전 효율·전력 분석","원격 SCADA 연동"] },

  // === Manufacturing ===
  { n:"3M", i:"mfg", h:"공장 설비 예지보전 솔루션",
    a:["공장 설비 예지보전","클린 생산환경 관리","자재 창고 온습도","에너지 소비 모니터링","누수 감지 알림","HVAC 효율 관리"] },
  { n:"Alcoa", i:"mfg", h:"제련 라인 통합 모니터링",
    a:["제련로 가동 모니터링","전력 부하 관리","설비 진동 예지보전","작업장 안전 환경","원자재 창고 관리","에너지 최적화"] },
  { n:"Siemens", i:"mfg", h:"산업 자동화 환경 관리",
    a:["산업 설비 가동 모니터링","생산라인 환경 관리","에너지 자산 관리","시설 누수 감지","접근 통제","사무실 IEQ"] },
  { n:"Square D", i:"mfg", h:"전력 인프라 상태 관리",
    a:["분전반 상태 모니터링","전력 부하 관리","시설 누수 감지","변압기 운영 관리","에너지 사용 분석","원격 알림"] },
  { n:"GE", i:"mfg", h:"발전·항공 설비 예지보전",
    a:["발전 설비 예지보전","항공 부품 공장 환경 관리","터빈 상태 모니터링","자산 추적","에너지 관리","안전 통합 모니터링"] },
  { n:"Eaton", i:"mfg", h:"전력 자산 관리 솔루션",
    a:["전력 자산 관리","UPS·배전반 모니터링","데이터센터 환경","시설 누수 감지","부하 분석","원격 진단"] },
  { n:"Parker", i:"mfg", h:"유공압 시스템 상태 모니터링",
    a:["유공압 시스템 상태 모니터링","제조 설비 예지보전","필터 교체 주기 관리","압축기 운영","누설 감지","에너지 효율"] },
  { n:"Tyco", i:"mfg", h:"시설 보안·환경 통합 관리",
    a:["시설 보안·환경 통합 관리","소방 시스템 연계","누수 감지","도어 접근 통제","자산 추적","원격 알림"] },
  { n:"AO Smith", i:"mfg", h:"생산라인 품질 환경 관리",
    a:["생산라인 품질 환경 관리","보일러 가동 모니터링","창고 온습도","에너지 사용량 분석","누수 감지","출하 환경 관리"] },
  { n:"Steelcase", i:"mfg", h:"공장·창고 환경 관리",
    a:["공장 환경 관리","자재 창고 운영","사무실 점유율 분석","에너지 효율","도어 모니터링","생산설비 가동률"] },
  { n:"Mitsubishi", i:"mfg", h:"산업 설비 가동 모니터링",
    a:["산업 설비 가동 모니터링","공장 환경 관리","자재 창고 운영","에너지 자산 관리","시설 누수 감지","안전 환경 통합"] },
  { n:"Lexmark", i:"mfg", h:"클린 생산환경 관리",
    a:["클린 생산환경 관리","부품 보관 환경","설비 예지보전","창고 자산 추적","에너지 모니터링","시설 누수 감지"] },
  { n:"Fender", i:"mfg", h:"악기 제작 자재 보관 관리",
    a:["목재 보관 창고 환경 관리","도장 부스 환경","완제품 보관","공장 IEQ","자재 추적","에너지 모니터링"] },
  { n:"Weider", i:"mfg", h:"생산·창고 환경 관리",
    a:["생산시설 환경 관리","원료 보관 온습도","창고 자산 관리","출하 콜드체인","에너지 모니터링","HACCP 자동 기록"] },
  { n:"Rocket Industrial", i:"mfg", h:"산업 포장재 창고 관리",
    a:["포장 자재 창고 환경 관리","출하 콜드체인","자산 추적","설비 모니터링","시설 누수 감지","에너지 효율"] },

  // === IT / Semiconductor / Telecom ===
  { n:"Intel", i:"it", h:"반도체 팹·서버 통합 모니터링",
    a:["클린룸 환경 관리","서버룸 모니터링","진동 기반 설비 보호","클린 가스 배관","누수 감지","에너지 최적화"] },
  { n:"Microsoft", i:"it", h:"데이터센터 통합 모니터링",
    a:["데이터센터 환경 관리","서버 랙 운영","누수 조기 감지","전력 사용 최적화","도어 접근 통제","HVAC 효율"] },
  { n:"Amazon", i:"it", h:"물류·데이터센터 환경 관리",
    a:["물류센터 콜드체인","데이터센터 환경 관리","창고 자산 추적","도어 모니터링","에너지 관리","안전 환경"] },
  { n:"AT&T", i:"it", h:"통신 인프라 원격 모니터링",
    a:["통신 기지국 원격 모니터링","서버실 환경 관리","백업 배터리 운영","도어 접근 통제","누수 감지","전력 부하 관리"] },
  { n:"Samsung Electronics", i:"it", h:"반도체 팹 환경 관리",
    a:["반도체 팹 환경 관리","클린룸 파티클 모니터링","클린 가스 시스템","진동 모니터링","누수 감지","에너지 최적화"] },
  { n:"Shutterstock", i:"it", h:"데이터센터 운영 모니터링",
    a:["데이터센터 서버실 환경 관리","백업 시스템 모니터링","전력 부하","누수 감지","도어 접근","HVAC 효율"] },

  // === Automotive / Logistics ===
  { n:"Hyundai Motors", i:"auto", h:"자동차 공장 설비 예지보전",
    a:["자동차 공장 설비 예지보전","도장 부스 환경 관리","자재 창고 운영","에너지 자산 관리","안전 환경 통합","도어 모니터링"] },
  { n:"Volvo", i:"auto", h:"공장·물류 환경 관리",
    a:["공장 설비 가동 모니터링","도장·용접 라인 환경 관리","부품 창고 운영","에너지 효율","누수 감지","출하 환경"] },
  { n:"FedEx", i:"auto", h:"콜드체인 물류 관리",
    a:["콜드체인 물류 추적","창고 환경 관리","차량 컨테이너 모니터링","자산 추적","도어 개폐 관리","안전 환경"] },

  // === Energy ===
  { n:"ExxonMobil", i:"energy", h:"정유 플랜트 통합 모니터링",
    a:["정유 설비 상태 모니터링","탱크 레벨·자산 관리","누설 조기 감지","펌프·압축기 예지보전","안전 환경 통합","자산 원격 관리"] },
  { n:"Shell", i:"energy", h:"석유 시설 자산 관리",
    a:["석유 시설 자산 관리","탱크 레벨 모니터링","가스 누설 감지","펌프 예지보전","안전 환경","원격 운영"] },
  { n:"Aramco", i:"energy", h:"플랜트 통합 모니터링",
    a:["플랜트 설비 모니터링","가스·유체 누설 감지","압력·온도 자산 관리","안전 환경 통합","원격 자산 운영","에너지 효율"] },
  { n:"PTT", i:"energy", h:"에너지 인프라 모니터링",
    a:["에너지 인프라 모니터링","가스 시설 자산 관리","누설 감지","안전 환경 통합","원격 시설 운영","에너지 효율"] },
  { n:"ENGIE", i:"energy", h:"발전·전력 자산 관리",
    a:["발전 자산 관리","전력 인프라 모니터링","부하 분석","시설 누수 감지","안전 환경","원격 운영"] },
  { n:"Tacoma Power", i:"energy", h:"전력 시설 운영 관리",
    a:["전력 시설 운영 관리","변전소 모니터링","부하 분석","시설 환경 관리","안전 통합","원격 알림"] },

  // === Bio / Medical / Pharma ===
  { n:"Bayer", i:"bio", h:"제약 GMP 환경 관리",
    a:["GMP 환경 관리","의약품 콜드체인","클린룸 모니터링","백신 냉장고 자동 기록","연구실 인큐베이터","원료 창고 관리"] },
  { n:"Merck & Co", i:"bio", h:"백신 콜드체인 솔루션",
    a:["백신 콜드체인","GMP 생산환경 관리","클린룸 모니터링","연구실 자산 관리","의약품 보관","안전 환경 통합"] },
  { n:"Samsung Biologics", i:"bio", h:"바이오의약품 GMP 통합 관리",
    a:["바이오 클린룸 환경 관리","의약품 보관 콜드체인","백신 냉장고 자동 기록","연구실 인큐베이터","원료 창고 관리","GMP 컴플라이언스"] },
  { n:"CDC", i:"bio", h:"백신·검체 보관 모니터링",
    a:["백신 보관 콜드체인","검체 저장 모니터링","연구실 환경 관리","클린룸 운영","자산 추적","비상 알림"] },
  { n:"Methodist Hospital", i:"bio", h:"의료 콜드스토리지 관리",
    a:["의료 콜드스토리지 자동 기록","약품·혈액 보관","검체 저장 관리","시설 누수 감지","도어 접근 통제","환자실 IEQ"] },
  { n:"UA Cancer Center", i:"bio", h:"항암제·검체 보관 관리",
    a:["항암제·검체 보관 관리","연구실 콜드체인","인큐베이터 모니터링","클린룸 환경","자산 추적","컴플라이언스 자동 기록"] },
  { n:"Intermountain Healthcare", i:"bio", h:"의료시설 통합 모니터링",
    a:["의료시설 통합 모니터링","약품 콜드스토리지","환자실 환경 관리","시설 누수 감지","도어 접근 통제","에너지 관리"] },
  { n:"Cal Biotech", i:"bio", h:"연구실 콜드스토리지 관리",
    a:["연구실 콜드스토리지","인큐베이터 모니터링","클린룸 환경","검체 보관","자산 추적","GLP 컴플라이언스"] },
  { n:"ANTHC", i:"bio", h:"원격지 의료 콜드체인",
    a:["원격지 의료 콜드체인","백신 냉장고 모니터링","의료시설 환경","시설 누수 감지","자산 추적","비상 원격 알림"] },

  // === Retail / Consumer Goods ===
  { n:"Walmart", i:"retail", h:"매장 콜드체인 자동화",
    a:["매장 콜드체인","HACCP 자동 기록","누수 감지","도어 개폐 모니터링","에너지 최적화","자산 추적"] },
  { n:"Costco", i:"retail", h:"대형 콜드체인 모니터링",
    a:["대형 콜드체인 모니터링","HACCP 컴플라이언스","매장 에너지 관리","시설 누수 감지","도어 모니터링","창고 환경 관리"] },
  { n:"NIKE", i:"retail", h:"매장·물류 시설 관리",
    a:["매장 환경 관리","물류센터 자산 추적","창고 운영 모니터링","에너지 효율","도어 접근 통제","시설 누수 감지"] },
  { n:"Nestlé", i:"retail", h:"식품 콜드체인 통합 관리",
    a:["식품 콜드체인","GMP 생산환경 관리","원료 보관","HACCP 자동 기록","시설 누수 감지","에너지 최적화"] },
  { n:"PepsiCo", i:"retail", h:"음료 생산·물류 모니터링",
    a:["음료 생산라인 환경 관리","창고 콜드체인","HACCP 컴플라이언스","설비 예지보전","에너지 효율","누수 감지"] },
  { n:"Unilever", i:"retail", h:"공장 설비·환경 통합 관리",
    a:["공장 설비·환경 관리","원료·완제품 창고 운영","에너지 자산 관리","시설 누수 감지","안전 환경","자산 추적"] },
  { n:"Keurig", i:"retail", h:"커피 생산·보관 환경 관리",
    a:["생산·보관 환경 관리","원두 창고 온습도","설비 예지보전","출하 콜드체인","에너지 효율","자산 추적"] },
  { n:"Gaia Herbs", i:"retail", h:"허브 원료 보관 관리",
    a:["허브 원료 보관 환경","GMP 컴플라이언스","발효·추출 공정 관리","창고 자산 관리","시설 누수 감지","HACCP 자동 기록"] },
  { n:"Stone Edge Farm", i:"retail", h:"와이너리·농장 운영 관리",
    a:["와이너리 발효 탱크 관리","저장고 환경 모니터링","농장 시설 운영","에너지 관리","자산 추적","환경 컴플라이언스"] },
  { n:"Wegmans", i:"retail", h:"매장 HACCP 자동 기록",
    a:["매장 HACCP 자동 기록","콜드체인 통합 관리","델리·베이커리 환경","누수 감지","도어 모니터링","에너지 최적화"] },
  { n:"Racetrac", i:"retail", h:"주유소 자산·재고 관리",
    a:["주유소 연료 탱크 레벨 관리","매장 콜드체인","시설 누수 감지","도어 접근 통제","에너지 모니터링","자산 추적"] },

  // === Food / Restaurant ===
  { n:"Dairy Queen", i:"food", h:"HACCP 자동 기록 솔루션",
    a:["HACCP 자동 기록","냉동고 콜드체인","매장 식품안전 관리","시설 누수 감지","도어 모니터링","에너지 효율"] },
  { n:"Chick-fil-A", i:"food", h:"매장 식품안전 관리",
    a:["매장 식품안전 관리","콜드체인 자동 기록","튀김기·냉장고 모니터링","HACCP 컴플라이언스","누수 감지","에너지 최적화"] },
  { n:"Subway", i:"food", h:"식자재 콜드체인 관리",
    a:["식자재 콜드체인","HACCP 자동 기록","매장 환경 관리","누수 감지","도어 모니터링","에너지 효율"] },
  { n:"Zaxby's", i:"food", h:"매장 콜드체인 모니터링",
    a:["매장 콜드체인 모니터링","HACCP 자동 기록","튀김기·냉장고 관리","시설 누수 감지","도어 접근","에너지 효율"] },

  // === Construction / Real Estate / Data Center ===
  { n:"Arup", i:"bldg", h:"스마트 빌딩 IEQ 솔루션",
    a:["스마트 빌딩 IEQ","점유율 분석","에너지 효율 관리","시설 누수 감지","자산 추적","환경 컴플라이언스"] },
  { n:"VINCI", i:"bldg", h:"건설 인프라 자산 관리",
    a:["건설 인프라 자산 관리","현장 환경 모니터링","자재 창고 운영","안전 환경 통합","에너지 효율","원격 자산 관리"] },
  { n:"JLL", i:"bldg", h:"스마트 빌딩 운영 관리",
    a:["스마트 빌딩 운영","점유율 분석","에너지 최적화","시설 누수 감지","HVAC 효율","자산 관리"] },
  { n:"CBRE", i:"bldg", h:"상업용 빌딩 통합 시설 관리",
    a:["상업용 빌딩 통합 시설 관리","점유율 분석","에너지·HVAC 효율","누수 감지","도어 접근 통제","자산 추적"] },
  { n:"C7 Data Centers", i:"bldg", h:"데이터센터 환경·자산 관리",
    a:["데이터센터 환경 관리","서버 랙 운영","누수 조기 감지","전력 부하 관리","도어 접근 통제","HVAC 효율"] },

  // === Education ===
  { n:"Fordham University", i:"edu", h:"캠퍼스 시설 관리",
    a:["캠퍼스 시설 관리","강의동 환경","기숙사 운영","에너지 효율","시설 누수 감지","도어 접근 통제"] },
  { n:"University of Maryland", i:"edu", h:"연구실 콜드스토리지 관리",
    a:["연구실 콜드스토리지","인큐베이터 모니터링","캠퍼스 시설 운영","에너지 관리","누수 감지","자산 추적"] },
  { n:"University of Miami", i:"edu", h:"캠퍼스·연구 환경 관리",
    a:["캠퍼스 시설·연구 환경 관리","의료 콜드체인","기숙사 운영","에너지 효율","누수 감지","도어 모니터링"] },
  { n:"SUNY", i:"edu", h:"캠퍼스 운영 통합 관리",
    a:["기숙사·강의동 운영","캠퍼스 에너지 관리","시설 누수 감지","도어 접근 통제","점유율 분석","환경 컴플라이언스"] },
  { n:"University of Michigan", i:"edu", h:"연구실 콜드스토리지 관리",
    a:["연구실 콜드스토리지","초저온 냉동고 관리","캠퍼스 에너지 효율","시설 누수 감지","자산 추적","IEQ 관리"] },
  { n:"University of Utah", i:"edu", h:"캠퍼스 에너지·시설 관리",
    a:["캠퍼스 에너지·시설 관리","연구실 환경","의료 콜드체인","기숙사 운영","누수 감지","도어 모니터링"] },

  // === Hospitality ===
  { n:"Wyndham", i:"hotel", h:"스마트 호텔 객실 운영",
    a:["스마트 호텔 객실 운영","미니바 자동 관리","시설 누수 감지","에너지 최적화","도어 접근 통제","자산 추적"] },
  { n:"Noralta Lodge", i:"hotel", h:"산업현장 캠프 시설 관리",
    a:["산업현장 캠프 시설 관리","객실 환경","식당 콜드체인","시설 누수 감지","안전 환경 통합","원격 자산 관리"] },
  { n:"Silverton", i:"hotel", h:"호텔 시설 통합 관리",
    a:["호텔 시설 통합 관리","객실 운영","F&B 콜드체인","시설 누수 감지","에너지 효율","도어 접근 통제"] },

  // === Public / Non-profit ===
  { n:"Salvation Army", i:"pub", h:"구호물품 보관 관리",
    a:["구호물품 보관 관리","시설 환경","식품 콜드체인","시설 누수 감지","도어 접근 통제","에너지 관리"] },
  { n:"BSA", i:"pub", h:"캠프시설 원격 운영 관리",
    a:["캠프시설 원격 관리","식당 콜드체인","시설 환경","안전 환경 통합","자산 추적","비상 알림"] }
];

const FEATURED_KEYS = ["Samsung Biologics", "ExxonMobil", "Walmart", "Microsoft", "Hyundai Motors", "CBRE", "US Army", "GS EPS"];

let AWARDS = [
  { y:2026, n:"IoT Sensor Company of the Year Award", c:"leadership", note:"연속 수상", url:"https://www.monnit.com/blog/monnit-wins-the-2026-iot-sensor-company-of-the-year-award/" },

  { y:2025, n:"IoT Sensor Company of the Year Award", c:"leadership", url:"https://www.monnit.com/blog/monnit-wins-2025-iot-sensor-company-of-the-year-award/" },
  { y:2025, n:"IoT Platforms Leadership Award", c:"platform", url:"https://www.monnit.com/blog/monnit-wins-back-to-back-iot-platforms-leadership-awards/" },
  { y:2025, n:"Industrial IoT Product of the Year", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-2025-industrial-iot-product-of-the-year/" },
  { y:2025, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-next-wi-fi-win-2025-product-of-the-year-award/" },
  { y:2025, n:"Cloud Computing Product of the Year", c:"platform", url:"https://www.monnit.com/blog/monnit-wins-2025-cloud-computing-award/" },
  { y:2025, n:"Smart City Product of the Year", c:"vertical", url:"https://www.monnit.com/blog/monnit-win-2025-smart-city-product-of-the-year-award/" },
  { y:2025, n:"AgTech Breakthrough Water Monitoring Solution", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2025-agtech-breakthrough-year-award/" },
  { y:2025, n:"IoT Evolution Asset Tracking Award", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2025-asset-tracking-award/" },
  { y:2025, n:"IoT Evolution Business Impact Award", c:"excellence", url:"https://www.monnit.com/blog/2025-iot-business-impact-award-winner/" },
  { y:2025, n:"INTERNET TELEPHONY Excellence Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-the-2025-internet-telephony-excellence-award/" },
  { y:2025, n:"Private Wireless Network Innovation Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-2025-private-wireless-network-innovation-award/" },
  { y:2025, n:"Best of State Awards", c:"state", note:"3건", url:"https://www.monnit.com/blog/monnit-wins-three-best-of-state-awards-again/" },

  { y:2024, n:"IoT Excellence Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-2024-iot-evolution-iot-excellence-award/" },
  { y:2024, n:"IoT Platforms Leadership Award", c:"platform", url:"https://www.monnit.com/blog/monnit-wins-the-2024-iot-evolution-iot-platforms-leadership-award/" },
  { y:2024, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-wins-the-2024-iot-evolution-iot-product-of-the-year-award/" },
  { y:2024, n:"Smart City Product of the Year", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-the-2024-smart-city-product-of-the-year-award/" },
  { y:2024, n:"AgTech Breakthrough Water Monitoring Solution", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-the-2024-agtech-breakthrough-water-monitoring-solution-of-the-year-award/" },
  { y:2024, n:"IoT Evolution Asset Tracking Award", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2024-asset-tracking-award/" },
  { y:2024, n:"IoT Evolution Business Impact Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-2024-iot-evolution-iot-business-impact-award/" },
  { y:2024, n:"INTERNET TELEPHONY Excellence Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-the-2024-internet-telephony-excellence-award/" },
  { y:2024, n:"Private Wireless Network Innovation Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-the-2024-iot-evolution-private-wireless-network-innovation-award/" },
  { y:2024, n:"Best of State Awards", c:"state", note:"3건", url:"https://www.monnit.com/blog/monnit-wins-three-2024-best-of-state-awards/" },

  { y:2023, n:"IoT Evolution Industrial IoT Product of the Year", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-evolution-industrial-iot-product-of-the-year-award/" },
  { y:2023, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-evolution-product-of-the-year-award/" },
  { y:2023, n:"IoT Evolution Asset Tracking Award", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-evolution-asset-tracking-award/" },
  { y:2023, n:"IoT Evolution Business Impact Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-2023-business-impact-award/" },
  { y:2023, n:"IoT Global Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-global-award-for-helping-save-babies-in-sub-sarahan-african-nicus/" },
  { y:2023, n:"Pandemic Tech Innovation Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-2023-pandemic-tech-innovation-award/" },
  { y:2023, n:"Best of State Awards", c:"state", note:"2건", url:"https://www.monnit.com/blog/monnit-wins-two-2023-best-of-state-awards/" },

  { y:2022, n:"IoT Innovator Gold — Best of IoT Industrial", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-two-2022-iot-innovator-awards/" },
  { y:2022, n:"IoT Innovator Silver — Connected Medical & Healthcare", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-two-2022-iot-innovator-awards/" },
  { y:2022, n:"Industrial IoT Product of the Year", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-2022-iot-evolution-industrial-iot-product-of-the-year-award/" },
  { y:2022, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-receives-2022-iot-evolution-product-of-the-year-award/" },
  { y:2022, n:"Pandemic Tech Innovation Award", c:"innovation" },
  { y:2022, n:"Best of State — Production & Manufacturing", c:"state" },

  { y:2021, n:"IoT Czar of the Year Award", c:"leadership", note:"CEO 리더십" },
  { y:2020, n:"LEAP Award", c:"engineering", note:"하드웨어" },
  { y:2019, n:"Manufacturer of the Year Award", c:"leadership" },
  { y:2019, n:"LEAP Award", c:"engineering" },
  { y:2019, n:"Best of State Award", c:"state" },

  { y:2015, n:"IoT Innovations Award", c:"innovation" },
  { y:2015, n:"Best of Sensors — Honorable Mention", c:"engineering" },
  { y:2015, n:"CRN Internet of Things 50 List", c:"leadership", note:"복수 연도" },

  { y:2012, n:"Entrepreneur Excellence — Greatest Potential", c:"innovation", note:"NorthFront" },
];

const CATEGORY_LABELS = {
  leadership:"리더십", industrial:"산업용 IoT", vertical:"산업별 솔루션",
  product:"제품", excellence:"우수성", innovation:"혁신",
  engineering:"엔지니어링", platform:"플랫폼", state:"최우수 기업상"
};

const REGION_LABELS = {
  na: "North America", sa: "South America", eu: "Europe",
  as: "Asia", af: "Africa", oc: "Oceania"
};

let PARTNERS = [
  // North America (30)
  { n:"ADSOL", r:"na", d:"LED · 농업 · 환경 IoT 솔루션", url:"http://www.adsol.ca/" },
  { n:"AIMNET", r:"na", d:"원격 모니터링 · 에너지 관리 기술", url:"https://www.mysmartbuilding.com" },
  { n:"AIR", r:"na", d:"EMEA · 공공 · 산업 IoT 통합", url:"http://www.airadio.com/" },
  { n:"ALM Systems", r:"na", d:"시스템 통합 및 엔지니어링", url:"http://www.almsystemscorp.com/" },
  { n:"Bestobell", r:"na", d:"산업 계측기 유통", url:"https://www.bestobell.com/" },
  { n:"BiPOM Electronics", r:"na", d:"마이크로컨트롤러 · 무선 시스템", url:"https://www.bipom.com/periph_cat/us/72/150.html" },
  { n:"BMIL Technologies", r:"na", d:"냉동 저장 · 설계 솔루션", url:"https://bmil.com" },
  { n:"Brainlike Inc.", r:"na", d:"엣지 데이터 처리" },
  { n:"ClearView Asset Protection", r:"na", d:"위협 탐지 솔루션", url:"http://www.clearviewassetprotection.com/" },
  { n:"Consolidated Solutions", r:"na", d:"전기 OEM · 대리점", url:"https://www.consolidatedsolns.com/" },
  { n:"Data Crunch Corp", r:"na", d:"예측 유지보수 · IoT 분석", url:"https://datacrunchcorp.com/" },
  { n:"ESBE Scientific", r:"na", d:"실험실 장비 · 공급", url:"https://en.esbe.com/" },
  { n:"EVO Integration", r:"na", d:"자동화 · 통합 솔루션", url:"https://www.evointegration.com/" },
  { n:"Grove Streams", r:"na", d:"클라우드 데이터 분석", url:"https://www.grovestreams.com" },
  { n:"JFC & Associates", r:"na", d:"엔터프라이즈 IoT 통합", url:"https://www.jfc-associates.com" },
  { n:"Lotus Pacific Technologies", r:"na", d:"IoT SI (NA · GCC · India)", url:"https://www.lotustek.com/" },
  { n:"Lynxspring, Inc.", r:"na", d:"엣지 · 엔터프라이즈 IoT 플랫폼", url:"https://www.lynxspring.com/" },
  { n:"M2M Data Corp.", r:"na", d:"원격 자산 모니터링" },
  { n:"MicroBMS", r:"na", d:"에너지 · 스마트 시티 IoT", url:"https://www.microbms.com/" },
  { n:"Nova Mobile Systems", r:"na", d:"GPS 추적 · 텔레매틱스" },
  { n:"Nexus Data Systems", r:"na", d:"환경 모니터링 · 규정 준수", url:"https://www.nxdatasystems.com/" },
  { n:"Power TakeOff", r:"na", d:"분석 · 리포팅 소프트웨어", url:"https://www.powertakeoff.com" },
  { n:"rams / American MTS", r:"na", d:"신뢰성 서비스 솔루션", url:"https://www.americanmts.com/copy-of-rams" },
  { n:"Registro y Monitoreo", r:"na", d:"센서 · 로그 유통 (중미)", url:"http://www.rm2.io/" },
  { n:"RevX Systems", r:"na", d:"셀룰러 IoT 리셀러" },
  { n:"Scigiene", r:"na", d:"온 · 습도 모니터링 및 인증", url:"http://www.scigiene.com/" },
  { n:"Sensorfi", r:"na", d:"무선 센서 기술 공급" },
  { n:"SensorGO", r:"na", d:"자산 모니터링 솔루션", url:"https://www.sensorgo.mx/" },
  { n:"SRT Labs", r:"na", d:"건물 · 캠퍼스 자동화", url:"https://srtlabs.com/" },
  { n:"Westell", r:"na", d:"원격 터미널 유닛 (RTU)", url:"https://www.westell.com/markets/intelligent-site-management" },

  // South America (6)
  { n:"AIWT&S", r:"sa", d:"자동화 · 클라우드 IoT 솔루션", url:"https://www.aiwts.net/" },
  { n:"ENECO", r:"sa", d:"에너지 제어 솔루션", url:"https://www.enecosolutions.com/" },
  { n:"Imagunet", r:"sa", d:"콜롬비아 IoT 시스템", url:"https://www.imagunet.com" },
  { n:"IoTMax", r:"sa", d:"칠레 IoT 운영 최적화", url:"http://www.iotmax.cl/" },
  { n:"New Access", r:"sa", d:"데이터센터 · IoT 모니터링", url:"http://www.new-access.net/" },
  { n:"Smart Box Panama", r:"sa", d:"파나마 스마트 기술 설계 · 지원", url:"https://smartboxpanama.com/en-us/soluciones/monitoreo/monnit/" },

  // Europe (14)
  { n:"Airicom", r:"eu", d:"IoT 통신 · 솔루션 공급", url:"https://airicom.com/blog/" },
  { n:"BitBlue Frost", r:"eu", d:"냉각 · 온도 기록 장비", url:"https://www.bitbluefrost.pl/" },
  { n:"Comgate", r:"eu", d:"IoT · 연결성 솔루션" },
  { n:"Connect Vision", r:"eu", d:"통신 · 자동화 솔루션", url:"https://www.connectvision.biz/" },
  { n:"E-Logger", r:"eu", d:"데이터 로깅 · 센서 유통" },
  { n:"Elkome Systems Oy", r:"eu", d:"핀란드 산업 IoT · 테스트", url:"https://www.elkome.com" },
  { n:"Fjarvöktun", r:"eu", d:"아이슬란드 IoT 모니터링", url:"https://fjarvoktun.is/" },
  { n:"GK", r:"eu", d:"북유럽 기술 컨트랙터", url:"https://www.gk.no/" },
  { n:"Intermarket", r:"eu", d:"전자 부품 · 시스템 유통", url:"https://www.abrosakis.com" },
  { n:"Master Chips", r:"eu", d:"IoT · 임베디드 유통", url:"https://masterchips.be/en/brand/monnit" },
  { n:"Matlog Data Corp.", r:"eu", d:"임베디드 · 산업 IT", url:"https://www.matlog.fr/collections/solutions-monnit" },
  { n:"Neodelis", r:"eu", d:"LED · 에너지 · 센서 솔루션", url:"https://www.neodelis.com" },
  { n:"RG2i", r:"eu", d:"프랑스 IoT · M2M 통신", url:"https://www.rg2i.fr" },
  { n:"SKADEteknik", r:"eu", d:"덴마크 누수 · 습도 솔루션", url:"https://www.skadeteknik.dk" },

  // Asia (16)
  { n:"Crownsys Consulting", r:"as", d:"필리핀 CMMS · IoT 통합", url:"https://crownsys.com/" },
  { n:"EBSL", r:"as", d:"디지털 · IoT 모바일 · RFID 솔루션", url:"https://www.ebsl.hk/" },
  { n:"eMeterEnergy", r:"as", d:"통합 모니터링 · 자동화", url:"https://www.monnit.ru/" },
  { n:"Enthu Technology Sdn Bhd", r:"as", d:"말레이시아 상업 · 산업 IoT", url:"https://www.enthu-tech.com" },
  { n:"Gemwel", r:"as", d:"데이터 자동화 · 원격 모니터링" },
  { n:"Heaven Homes Realty", r:"as", d:"인도 홈 자동화" },
  { n:"Huy Phuc", r:"as", d:"베트남 배포 · 설치 파트너", url:"https://huyphuc.vn" },
  { n:"Innovkez Pte Ltd", r:"as", d:"싱가포르 IoT 통합 솔루션", url:"https://www.innovkez.com" },
  { n:"Integra Data Digital", r:"as", d:"인도네시아 정보 솔루션", url:"http://www.integradatadigital.com/" },
  { n:"Power Technologies Pvt Ltd", r:"as", d:"싱가포르 에너지 효율 솔루션", url:"https://powertechnologies.com.sg/" },
  { n:"Qonda System Pte Ltd", r:"as", d:"Industrial 4.0 · 환경 IoT", url:"https://www.qondasystem.com/" },
  { n:"Smartec Scientific", r:"as", d:"대만 환경 · 물류 IoT", url:"https://sophicautomation.com/" },
  { n:"Vantage Power", r:"as", d:"태국 에너지 · 시설 솔루션", url:"http://www.vantagepower.co.th/" },
  { n:"Waterstone Electronics Tech", r:"as", d:"중국 전자 · 온라인 유통", url:"https://www.waterstone-tech.com" },
  { n:"Widetec", r:"as", d:"일본 IT · 인프라 솔루션", url:"https://www.widetec.com/" },
  { n:"WinSys Technology Pte Ltd", r:"as", d:"싱가포르 IT · IoT SI", url:"https://www.winsys.com.sg" },

  // Africa (1)
  { n:"Avtec", r:"af", d:"남아프리카 IoT 모니터링", url:"http://www.avtec.co.za/" },

  // Oceania (6)
  { n:"IoT Managed Sensor Systems", r:"oc", d:"무선 센서 제공", url:"https://www.iotmss.com.au" },
  { n:"mätt solutions", r:"oc", d:"뉴질랜드 프로세스 · 품질 솔루션", url:"https://www.ffi.nz" },
  { n:"OneTemp", r:"oc", d:"산업 · 환경 측정기기", url:"https://www.onetemp.com.au" },
  { n:"ProSense", r:"oc", d:"호주 모니터링 · 자동화", url:"https://www.prosense.com.au/" },
  { n:"Sense IoT", r:"oc", d:"예측 유지보수 IoT", url:"https://senseiot.com.au/" },
  { n:"WEB ID Systems", r:"oc", d:"냉장 · 자산 모니터링", url:"https://www.webidsystems.com.au" }
];

let CASE_DATA = {  /* 기본값 — 구글 시트(Cases 탭)가 있으면 덮어씀 */
'samsung-biologics': {
    num:'01', industry:'의료 · 바이오',
    accent:'#4D2C73', accentBg:'#E5DDEE', accentText:'#C4ABF2',
    name:'Samsung Biologics', title:'바이오의약품 GMP 환경<br><em>통합 관리 솔루션</em>',
    tagline:'송도 캠퍼스 바이오리액터 라인의 클린룸·콜드체인·연구실을 단일 플랫폼으로 통합 가시화',
    qs:[{n:'99.8%',l:'GMP 환경 준수율'},{n:'-90%',l:'수동 기록 시간'},{n:'24/7',l:'실시간 모니터링'}],
    about:'삼성바이오로직스는 송도에 4개 공장을 운영하며 60만 4천 리터 규모의 바이오리액터 생산 능력을 갖춘 세계 최대 CMO 중 하나입니다. mRNA 백신, 단클론 항체, 세포·유전자 치료제 등 바이오의약품 위탁생산을 담당하며 글로벌 제약사 60여 곳과 협력하고 있습니다.',
    challenges:['GMP 환경(클린룸, 콜드체인, 인큐베이터) 수십 곳의 24/7 데이터를 종이·엑셀로 관리 — FDA·EMA 감사 대응 시 추적성 부족','초저온 냉동고와 백신 보관고 이상 발생 시 알림이 늦어 수십억 원 규모 원료·완제품 폐기 리스크','신규 라인 증설마다 별도 모니터링 시스템을 구축 — 캠퍼스 통합 가시성 부재'],
    solutions:[{t:'바이오 클린룸 환경 관리',d:'ISO 7-8등급 클린룸의 차압·온습도·파티클을 통합 대시보드로 실시간 추적'},{t:'의약품 보관 콜드체인',d:'2-8℃ / -20℃ / -80℃ 보관고 상시 모니터링, 임계치 이탈 시 다중 채널 알림'},{t:'백신 냉장고 자동 기록',d:'감사 대응용 PDF 리포트 자동 생성, 5초 단위 데이터 5년 이상 보존'},{t:'연구실 인큐베이터 관리',d:'세포 배양 환경 안정성을 위한 CO₂·온도·습도 통합 모니터링'},{t:'원료 창고 온습도 관리',d:'원료 보관 구역별 적정 보관 조건 자동 검증 및 알림'},{t:'GMP 컴플라이언스 자동화',d:'FDA 21 CFR Part 11, EU GMP Annex 11 대응 데이터 무결성 확보'}],
    results:[{n:'99.8%',l:'GMP 환경 준수율'},{n:'-90%',l:'수동 기록 시간'},{n:'-65%',l:'이상 상황 대응 시간'},{n:'100%',l:'감사 데이터 추적성'}],
    quote:'단일 플랫폼으로 클린룸부터 콜드체인까지 통합 가시화되면서, 감사 대응과 폐기 손실 양쪽에서 성과가 나타났습니다.',
    cite:'공정 운영팀 리더, Samsung Biologics'
},
'exxonmobil': {
    num:'02', industry:'에너지',
    accent:'#7A5418', accentBg:'#F2E5D2', accentText:'#EBC062',
    name:'ExxonMobil', title:'정유 플랜트<br><em>통합 자산 모니터링</em>',
    tagline:'다수 정유 시설의 펌프·압축기·탱크·배관을 원격 통합 감시하는 산업용 IoT 인프라',
    qs:[{n:'-45%',l:'비계획 정지'},{n:'+28%',l:'설비 MTBF'},{n:'-75%',l:'누설 감지 시간'}],
    about:'ExxonMobil은 미국·아시아·중동 등 전세계 30개 이상의 정유·석유화학 시설을 운영하는 글로벌 에너지 메이저입니다. 노후화된 설비와 24/7 운영 환경에서 안전성과 생산성을 동시에 확보하기 위해 산업용 IoT 모니터링을 도입했습니다.',
    challenges:['노후 펌프·압축기의 비계획 정지가 라인 전체 생산 손실로 직결 — 진동·온도 데이터의 상시 수집 어려움','광활한 플랜트 부지의 가스 누설·유체 누설을 작업자 순회로만 감지 — 사고 리스크 상시 존재','탱크 레벨·배관 압력 수기 점검으로 운영 효율 한계, 자산 ROI 분석 불가'],
    solutions:[{t:'정유 설비 상태 모니터링',d:'회전 기기 진동·온도 데이터 기반 예지보전, 이상 패턴 자동 감지'},{t:'탱크 레벨·자산 관리',d:'원유·완제품 탱크 레벨 실시간 추적으로 출하·재고 최적화'},{t:'누설 조기 감지',d:'가스·유체 누설을 분 단위로 감지해 작업자 안전과 환경 사고 예방'},{t:'펌프·압축기 예지보전',d:'회전체 진동 트렌드 분석으로 고장 24~72시간 전 사전 대응'},{t:'안전 환경 통합 관리',d:'압력·온도·가스 농도 다중 안전 지표를 통합 대시보드로 관제'},{t:'자산 원격 운영',d:'분산된 플랜트 자산을 단일 SCADA·클라우드 환경에서 통합 운영'}],
    results:[{n:'-45%',l:'비계획 정지 시간'},{n:'+28%',l:'설비 평균 MTBF'},{n:'-75%',l:'누설 감지 시간'},{n:'+12%',l:'자산 ROI'}],
    quote:'예지보전 알림을 받기 시작한 이후 비계획 정지가 절반 가까이 줄었고, 안전 사고 리스크도 크게 낮아졌습니다.',
    cite:'플랜트 운영 매니저, ExxonMobil'
},
'walmart': {
    num:'03', industry:'유통 · 소비재',
    accent:'#3D5E2E', accentBg:'#DFEAD7', accentText:'#8FD98F',
    name:'Walmart', title:'매장 콜드체인<br><em>자동화 솔루션</em>',
    tagline:'4,600개 이상 매장의 냉장·냉동·HACCP·에너지·시설을 단일 플랫폼으로 자동화',
    qs:[{n:'-32%',l:'식품 폐기 손실'},{n:'100%',l:'HACCP 준수율'},{n:'-18%',l:'에너지 비용'}],
    about:'Walmart는 미국 4,600개 이상의 매장과 글로벌 10,500개 매장을 운영하는 세계 최대 유통 기업입니다. 매장당 수십 대의 냉장·냉동 설비를 24/7 운영하면서 식품 안전, 에너지 비용, 손실율을 동시에 관리해야 하는 과제를 안고 있습니다.',
    challenges:['매장별 냉장고·냉동고 수십 대의 온도 이상을 종이 점검표로 관리 — 야간·휴일 누락 빈발','한 매장당 연간 수백만 원의 식품 폐기 손실, 보험 청구 사례 증가','HACCP 종이 기록에 매장 직원이 하루 1~2시간 소요, 감사 시 추적 어려움'],
    solutions:[{t:'매장 콜드체인',d:'전 매장 냉장·냉동 설비의 온도를 클라우드로 통합, 이상 시 즉시 알림'},{t:'HACCP 자동 기록',d:'디지털 점검 리포트 자동 생성으로 직원 부담 제거, 감사 100% 대응'},{t:'누수 조기 감지',d:'냉장고 결로·배관 누수 조기 감지로 매장 손해 최소화'},{t:'도어 개폐 모니터링',d:'워크인 냉장고 도어 열림 시간 분석으로 에너지 손실 최소화'},{t:'에너지 사용 최적화',d:'매장별 전력 패턴 분석으로 비효율 설비 식별 및 교체 가이드'},{t:'자산 추적',d:'설비 점검 이력과 유지보수 일정을 통합 관리, 다운타임 최소화'}],
    results:[{n:'-32%',l:'식품 폐기 손실'},{n:'100%',l:'HACCP 준수율'},{n:'-18%',l:'매장 에너지 비용'},{n:'-41%',l:'보험 청구 건수'}],
    quote:'직원이 점검표를 들고 다닐 필요가 없어졌고, 야간 이상 상황도 즉시 알림으로 받게 되어 손실이 크게 줄었습니다.',
    cite:'매장 운영 총괄, Walmart'
},
'microsoft': {
    num:'04', industry:'IT · 데이터센터',
    accent:'#2E4A6B', accentBg:'#DDE6F0', accentText:'#8FBEFF',
    name:'Microsoft', title:'데이터센터<br><em>통합 모니터링 솔루션</em>',
    tagline:'글로벌 Azure 데이터센터의 랙·HVAC·누수·전력을 단일 가시성 플랫폼으로',
    qs:[{n:'-67%',l:'다운타임'},{n:'+15%',l:'쿨링 효율'},{n:'-75%',l:'장애 대응 시간'}],
    about:'Microsoft는 전세계 60개 이상 리전에서 200여 개의 데이터센터를 운영하며 Azure 클라우드 인프라를 제공합니다. 수백만 대 서버가 24/7 가동되는 환경에서 미세한 환경 이상도 대규모 서비스 장애로 이어질 수 있어, 정밀한 실시간 모니터링이 필수입니다.',
    challenges:['수천 개 서버 랙 단위의 미세한 온도·습도 편차가 장기적으로 하드웨어 수명에 영향','데이터센터 누수·결로 사고가 발생하면 수억 원 단위 장비 손실 직결','쿨링·전력 시스템의 비효율 운영이 PUE 악화로 이어져 운영비 압박'],
    solutions:[{t:'데이터센터 환경 관리',d:'랙·복도 단위 온습도·차압을 1분 단위로 추적, 핫스팟 즉시 식별'},{t:'서버 랙 운영 모니터링',d:'랙별 흡기·배기 온도 차이로 쿨링 효율 정밀 분석'},{t:'누수 조기 감지',d:'수냉식 시스템·배관·바닥 단위 누수를 분 단위로 감지'},{t:'전력 사용 최적화',d:'PDU·UPS 부하 데이터로 전력 분산 최적화, PUE 개선'},{t:'도어 접근 통제',d:'데이터센터 출입·랙 도어 개폐 이력 자동 기록으로 보안 강화'},{t:'HVAC 효율 관리',d:'CRAH·CRAC 운영 데이터와 환경 데이터 연계로 쿨링 자동 최적화'}],
    results:[{n:'-67%',l:'환경 원인 다운타임'},{n:'+15%',l:'쿨링 효율'},{n:'-75%',l:'장애 대응 시간'},{n:'+14%',l:'자산 활용률'}],
    quote:'환경 원인으로 발생하던 장애를 사전에 차단할 수 있게 되었고, 데이터센터당 운영 효율이 가시적으로 개선되었습니다.',
    cite:'데이터센터 인프라 운영팀, Microsoft'
},
'hyundai-motors': {
    num:'05', industry:'자동차 · 운송',
    accent:'#4A4541', accentBg:'#E8E5E2', accentText:'#CFCFDC',
    name:'Hyundai Motors', title:'자동차 공장<br><em>설비 예지보전 솔루션</em>',
    tagline:'울산·앨라배마·체코 글로벌 공장의 도장·용접·조립 라인을 통합 모니터링',
    qs:[{n:'+9%',l:'라인 가동률'},{n:'88%',l:'예지보전 정확도'},{n:'-14%',l:'에너지 사용량'}],
    about:'현대자동차는 전세계 9개국에서 13개 생산 거점을 운영하며 연간 400만 대 이상을 생산합니다. 도장·용접·조립 라인은 한 곳의 정지가 라인 전체에 영향을 주는 구조여서, 설비 가동률과 품질 안정성이 직접적인 수익으로 연결됩니다.',
    challenges:['도장 부스·용접 로봇의 비계획 정지가 라인 전체에 분 단위로 영향 — 사후 대응의 한계','도장 부스 온습도 편차가 도장 품질 불량으로 이어져 재작업 비용 증가','자재 창고의 부품 보관 환경이 부적정해 결로·부식으로 인한 자재 손실'],
    solutions:[{t:'공장 설비 예지보전',d:'용접 로봇·컨베이어·프레스 진동 데이터 기반 사전 정비 알림'},{t:'도장 부스 환경 관리',d:'도장 부스 온습도 정밀 제어로 도장 품질 안정화'},{t:'자재 창고 운영',d:'부품·자재 보관 구역별 환경 모니터링으로 결로·부식 예방'},{t:'에너지 자산 관리',d:'설비별 전력 사용 패턴 분석으로 비효율 설비 식별'},{t:'안전 환경 통합',d:'용접 흄·작업장 가스 농도·온도를 통합 관제'},{t:'도어·물류 모니터링',d:'셔터·도어 개폐 이력 추적으로 자재 흐름 최적화'}],
    results:[{n:'+9%',l:'라인 가동률'},{n:'88%',l:'예지보전 정확도'},{n:'-14%',l:'에너지 사용량'},{n:'-22%',l:'자재 손실 비용'}],
    quote:'공장 단위가 아니라 라인·설비 단위로 이상 신호를 미리 받게 되면서, 비계획 정지를 사전에 차단할 수 있게 됐습니다.',
    cite:'생산 운영 부문, Hyundai Motors'
},
'cbre': {
    num:'06', industry:'건설 · 부동산',
    accent:'#2E4651', accentBg:'#D9E2E6', accentText:'#7FCEE6',
    name:'CBRE', title:'상업용 빌딩<br><em>통합 시설 관리 솔루션</em>',
    tagline:'전세계 100,000+ 상업용 빌딩의 점유율·에너지·HVAC·시설을 단일 운영 플랫폼으로',
    qs:[{n:'-22%',l:'운영 비용'},{n:'+15%',l:'HVAC 효율'},{n:'+18%',l:'임차인 만족도'}],
    about:'CBRE는 100개국 530개 사무소에서 활동하는 세계 최대 상업용 부동산 서비스 기업입니다. 자산 관리 면적은 70억 평방피트를 상회하며, 임대·운영 자산의 효율성을 데이터 기반으로 끌어올리는 것이 핵심 경쟁력입니다.',
    challenges:['수많은 빌딩의 HVAC·조명·전력 운영이 빌딩별로 분산되어 통합 분석 불가','공간 점유율이 가시화되지 않아 임차 공간 최적화와 에너지 절감 기회 손실','시설 누수·이상 사고가 발생하면 사후 대응 — 임차인 클레임과 수리 비용 증가'],
    solutions:[{t:'상업용 빌딩 통합 시설 관리',d:'전 자산의 환경·에너지·점유 데이터를 단일 플랫폼으로 통합'},{t:'점유율 분석',d:'회의실·층별 공간 활용도 가시화로 임대 공간 최적화'},{t:'에너지·HVAC 효율',d:'환경 데이터 기반 HVAC 자동 최적화로 운영비 절감'},{t:'시설 누수 감지',d:'워터 디텍션으로 누수 사고 조기 감지, 손해 최소화'},{t:'도어 접근 통제',d:'공용·전용 공간 접근 이력 자동 기록'},{t:'자산 추적·유지보수',d:'설비별 점검·교체 이력 통합으로 예방 정비 효율화'}],
    results:[{n:'-22%',l:'운영 비용'},{n:'+15%',l:'HVAC 효율'},{n:'100%',l:'점유율 가시화'},{n:'+18%',l:'임차인 만족도'}],
    quote:'임차인에게 더 나은 환경을 제공하면서도 운영비를 줄일 수 있다는 사실을, 데이터를 통해 입증할 수 있게 되었습니다.',
    cite:'자산 운영 부문, CBRE'
},
'us-army': {
    num:'07', industry:'국방 · 방위',
    accent:'#3A4A33', accentBg:'#DEE6D9', accentText:'#9ECF9E',
    name:'US Army', title:'군 부대 핵심 전략 자산<br><em>통합 모니터링 솔루션</em>',
    tagline:'전방·후방 기지의 전략 자산·탄약고·동력설비·연료 저장 시설을 단일 보안 플랫폼으로 원격 감시',
    qs:[{n:'24/7',l:'무인 원격 감시'},{n:'-60%',l:'순찰 인력 부담'},{n:'99.9%',l:'자산 가용성'}],
    about:'미 육군(US Army)은 전 세계 다수의 기지와 전개 거점에서 전략 자산과 막대한 규모의 탄약·물자·연료를 운용합니다. 인력 순찰에 의존하던 기존 점검 체계를 무선 IoT 기반의 원격 상시 감시로 전환해, 보안성과 작전 가용성을 동시에 확보했습니다.',
    challenges:['탄약고·물자 창고 수십 곳의 온습도·침입 여부를 인력 순찰로만 점검 — 야간·악천후 시 사각지대 발생','비상 발전기·동력 설비의 비계획 정지가 작전 지속성에 직접적 위협','광활한 기지 내 연료 저장 탱크의 누설·레벨을 실시간으로 파악하기 어려움'],
    solutions:[{t:'전략 자산 상태 모니터링',d:'핵심 장비·자산의 온도·진동·위치를 24/7 원격 추적, 이상 시 즉시 보고'},{t:'탄약·물자 보관 환경 관리',d:'탄약고·창고 온습도·결로를 상시 감시해 저장 안정성 확보'},{t:'발전기·동력설비 예지보전',d:'비상 발전기·동력 설비 진동·온도 데이터로 고장 사전 차단'},{t:'연료 저장 탱크 관리',d:'연료 레벨·온도·누설을 실시간 추적해 손실과 안전 사고 예방'},{t:'시설 침입·누수 감지',d:'도어 개폐·침입·누수를 분 단위로 감지해 시설 보안 강화'},{t:'원격 통합 관제',d:'분산된 기지 자산을 단일 보안 대시보드에서 통합 운영 (암호화 전송)'}],
    results:[{n:'24/7',l:'무인 원격 감시'},{n:'-60%',l:'순찰 인력 부담'},{n:'-50%',l:'자산 이상 대응 시간'},{n:'99.9%',l:'전략 자산 가용성'}],
    quote:'사람이 직접 돌아보던 점검을 원격 상시 감시로 전환하면서, 인력 부담은 줄고 자산 가용성과 보안성은 오히려 높아졌습니다.',
    cite:'시설·자산 운영 부문, US Army'
},
'gs-eps': {
    num:'08', industry:'발전 · 전력',
    accent:'#8A4A18', accentBg:'#F2E2D2', accentText:'#F0B070',
    name:'GS EPS', title:'복합화력 발전 설비<br><em>통합 상태 감시 솔루션</em>',
    tagline:'복합화력 발전소의 가스·증기 터빈, 보일러, 변압기, 연료 설비를 단일 플랫폼으로 예지보전',
    qs:[{n:'-40%',l:'비계획 정지'},{n:'+10%',l:'설비 가동률'},{n:'-70%',l:'누설 감지 시간'}],
    about:'GS EPS는 충남 당진에 대규모 복합화력 발전 단지를 운영하는 국내 대표 민간 발전사입니다. 24시간 연속 운전이 필수인 발전 설비의 특성상, 터빈·보일러·변압기 등 핵심 회전·열 설비의 미세한 이상 신호를 조기에 포착하는 것이 안정적 전력 공급의 핵심입니다.',
    challenges:['가스·증기 터빈, 발전기 등 회전 기기의 비계획 정지가 발전 손실과 계통 영향으로 직결','보일러·열교환기·변압기의 온도·진동 이상을 주기 점검만으로는 조기 포착 어려움','연료·윤활유 누설과 배관 이상을 인력 순회로 감지 — 안전·환경 리스크 상존'],
    solutions:[{t:'터빈·발전기 진동 예지보전',d:'회전 기기의 진동·온도 트렌드 분석으로 고장 24~72시간 전 사전 정비'},{t:'보일러·열교환기 상태 진단',d:'열 설비의 온도·압력을 상시 추적해 효율 저하와 이상을 조기 식별'},{t:'변압기·배전반 모니터링',d:'변압기 온도·부하와 배전반 상태를 통합 감시해 정전 리스크 최소화'},{t:'연료·윤활유 누설 감지',d:'연료·윤활유 누설과 배관 이상을 분 단위로 감지해 안전·환경 사고 예방'},{t:'발전 효율·전력 분석',d:'설비별 전력·열 데이터를 분석해 발전 효율과 운영 비용 최적화'},{t:'원격 SCADA 연동',d:'기존 발전소 SCADA·DCS와 ALTA 데이터를 매끄럽게 연동, 단일 관제'}],
    results:[{n:'-40%',l:'비계획 정지 시간'},{n:'+10%',l:'설비 가동률'},{n:'-70%',l:'누설 감지 시간'},{n:'+8%',l:'발전 효율'}],
    quote:'핵심 설비의 이상 신호를 미리 받게 되면서 비계획 정지를 크게 줄였고, 안정적인 전력 공급과 안전 관리를 동시에 강화할 수 있었습니다.',
    cite:'발전 운영 부문, GS EPS'
}
};

/* ============================================================
   ========== 구글 시트 연결 (CONTENT SHEET) ==========
   고객사·수상·파트너 목록을 구글 시트에서 읽어옵니다.
   여기 sheetId 한 줄만 바꾸면 됩니다. (탭 이름은 그대로 두세요)
   ============================================================ */
const CONTENT_SHEET = {
  // 1) 구글 시트 주소에서 /d/ 와 /edit 사이의 긴 문자열을 붙여넣으세요.
  //    예) https://docs.google.com/spreadsheets/d/[이부분]/edit
  //    아직 비워두면(아래 기본값 그대로면) 사이트는 코드 내 기본 데이터로 동작합니다.
  sheetId: "1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc",

  // 2) 시트 하단 탭 이름 (기본값 그대로 사용 권장)
  tabs: {
    customers: "Customers", awards: "Awards", partners: "Partners",
    cases: "Cases", appcategories: "AppCategories", applications: "Applications",
    appdetails: "AppDetails", blog: "Blog", whitepapers: "Whitepapers",
    news: "NewsHighlights", faqs: "FAQs", knowledgebase: "Knowledgebase",
    photos: "Photos", products: "Products", homecases: "homecases", sitecontent: "SiteContent",
    logos: "Logos", promotions: "Promotions"
  },

  // 3) (선택) 위 방식 대신 '웹에 게시 → CSV' 링크를 직접 쓰려면 여기에 전체 URL을 넣으세요.
  //    비워두면 자동으로 sheetId + 탭 이름으로 주소를 만듭니다.
  urls: {
    customers: "", awards: "", partners: "",
    cases: "", appcategories: "", applications: "",
    appdetails: "", blog: "", whitepapers: "",
    news: "", faqs: "", knowledgebase: "", photos: "", products: "", homecases: "", sitecontent: "", logos: ""
  }
};

/* 재배포 없이 시트 바꾸기:
   - 주소 뒤에 ?sheetId=새ID 를 붙이면 그 방문에 한해 해당 시트를 읽습니다.
   - ?sheetId=새ID&remember=1 로 열면 이 브라우저에 저장돼 다음에도 그 시트를 씁니다.
   - 저장 해제: 주소 뒤에 ?sheetId=clear */
try {
  var _q = new URLSearchParams(location.search);
  var _sid = _q.get('sheetId');
  if (_sid === 'clear') { try { localStorage.removeItem('monnit_sheetid'); } catch(e){} }
  else if (_sid) { CONTENT_SHEET.sheetId = _sid.trim(); if (_q.get('remember')) { try { localStorage.setItem('monnit_sheetid', _sid.trim()); } catch(e){} } }
  else { var _saved = (function(){ try { return localStorage.getItem('monnit_sheetid'); } catch(e){ return null; } })(); if (_saved) CONTENT_SHEET.sheetId = _saved.trim(); }
} catch(e){}

/* --- 가벼운 CSV 파서 (따옴표·줄바꿈·쉼표 처리) --- */
function parseCSV(text){
  const rows = []; let row = [], field = '', i = 0, inQ = false;
  text = text.replace(/^\uFEFF/, ''); // BOM 제거
  while (i < text.length){
    const ch = text[i];
    if (inQ){
      if (ch === '"'){ if (text[i+1] === '"'){ field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"'){ inQ = true; i++; continue; }
    if (ch === ','){ row.push(field); field = ''; i++; continue; }
    if (ch === '\r'){ i++; continue; }
    if (ch === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
/* CSV 행들을 헤더 기반 객체 배열로 변환 (열 순서 무관, 대소문자 무시) */
function csvToObjects(text){
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => {
    const o = {}; head.forEach((h, idx) => { o[h] = (r[idx] || '').trim(); }); return o;
  });
}
function sheetURL(key){
  const bust = '_cb=' + Date.now();   // 캐시 무력화: 시트 편집이 즉시 반영되도록
  if (CONTENT_SHEET.urls[key]) return CONTENT_SHEET.urls[key] + (CONTENT_SHEET.urls[key].includes('?') ? '&' : '?') + bust;
  const id = CONTENT_SHEET.sheetId, tab = CONTENT_SHEET.tabs[key];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&${bust}`;
}
/* 시트 탭 묶음 — 사이트 서버(/api/sheets)가 18개 탭을 한 번에, 가장자리 캐시로 준다 (2026-10-14).
   예전에는 페이지마다 구글 시트를 18번 「캐시 금지」로 따로 불렀다(느리고, 구글 속도 제한에 걸림).
   · 우리 기본 시트일 때만 쓴다 — ?sheetId=… 로 다른 시트를 볼 때·?fresh=1·편집기는 예전처럼 직접
   · 묶음이 실패하면 탭마다 구글에서 직접 받는다(예전 방식) — 화면은 그대로 */
var DEFAULT_SHEET_ID = '1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc';
var _SHEET_BUNDLE = null;
function sheetBundle(){
  if (_SHEET_BUNDLE) return _SHEET_BUNDLE;
  var direct = false;
  try {
    var q = new URLSearchParams(location.search);
    direct = CONTENT_SHEET.sheetId !== DEFAULT_SHEET_ID || q.has('sheetId') || q.get('fresh') === '1' ||
             /^\/(ops|editor)/.test(location.pathname) || location.protocol === 'file:';
  } catch(e){ direct = true; }
  if (direct) return (_SHEET_BUNDLE = Promise.resolve(null));
  var tabs = Object.keys(CONTENT_SHEET.tabs).filter(function(k){ return !CONTENT_SHEET.urls[k]; }).map(function(k){ return CONTENT_SHEET.tabs[k]; });
  var url = '/api/sheets?tabs=' + encodeURIComponent(tabs.join(','));
  /* 2026-11-03 속도 — index.html <head> 가 HTML 을 받자마자 같은 주소를 미리 요청해 둔다(window.__mkSheetsPre).
     주소가 같으면 그 응답을 그대로 쓰고, 다르거나 실패하면 여기서 새로 받는다. */
  var pre = window.__mkSheetsPre;
  var first = (pre && pre.url === url && pre.p) ? pre.p : Promise.resolve(null);
  _SHEET_BUNDLE = first
    .then(function(j){ return (j && j.ok && j.tabs) ? j : fetch(url).then(function(r){ return r.ok ? r.json() : null; }); })
    .then(function(j){ return (j && j.ok && j.tabs) ? j.tabs : null; })
    .catch(function(){ return null; });
  return _SHEET_BUNDLE;
}
async function fetchSheet(key){
  if (!CONTENT_SHEET.urls[key]){
    const b = await sheetBundle();
    const t = b && b[CONTENT_SHEET.tabs[key]];
    if (typeof t === 'string') return csvToObjects(t);
  }
  const res = await fetch(sheetURL(key), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return csvToObjects(await res.text());
}

/* --- 시트 → 사이트 데이터 형식으로 변환 (잘못된 값은 건너뜀) --- */
// 영문(EN) 전환 시 번역 등록 — 어느 매퍼에서나 사용 (한글·영문 둘 다 값이 있을 때만)
function regI18N(ko, en){
  if (typeof window !== 'undefined' && window.MonnitI18N && ko != null && en != null
      && String(ko).trim() && String(en).trim()) window.MonnitI18N.add(String(ko).trim(), String(en).trim());
}
function mapCustomers(rows){
  const out = [];
  rows.forEach(o => {
    const n = o.name, i = (o.industry||'').toLowerCase();
    if (!n || !INDUSTRIES[i]) return;
    const a = (o.apps||'').split('|').map(s => s.trim()).filter(Boolean);
    regI18N(o.headline, o.headline_en);
    out.push({ n, i, h: o.headline||'', a, install: (o.install||'').trim(), key: (o.key||'').trim() });
  });
  return out;
}
function mapAwards(rows){
  const out = [];
  rows.forEach(o => {
    const y = parseInt(o.year, 10), c = (o.category||'').toLowerCase();
    if (!o.name || !y || !CATEGORY_LABELS[c]) return;
    const a = { y, n: o.name, c }; if ((o.note||'').trim()) a.note = o.note.trim();
    if ((o.url||'').trim()) a.url = o.url.trim();
    regI18N(o.name, o.name_en); regI18N(o.note, o.note_en);
    out.push(a);
  });
  return out;
}
function mapPartners(rows){
  const out = [];
  rows.forEach(o => {
    const r = (o.region||'').toLowerCase();
    if (!o.name || !REGION_LABELS[r]) return;
    const p = { n: o.name, r, d: o.desc||'' };
    if ((o.url||'').trim()) p.url = o.url.trim();
    regI18N(o.desc, o.desc_en);
    out.push(p);
  });
  return out;
}

/* --- 중첩 데이터용 구분자 ( ||  항목구분 ,  ::  항목 내 칸 구분) --- */
/* ===== 활용 분야 콘텐츠 출처 스위치 (2026-11-19) =====
   true  : 상세(AppDetails)와 한 줄 설명(desc)을 이 파일(app.js)의 값으로 표시 — 시트의 해당 칸은 무시
   false : 기존처럼 구글 시트 AppDetails·Applications 탭 값이 우선
   시트에 새 문구를 옮겨 적은 뒤 false 로 바꾸면 다시 시트에서 편집할 수 있습니다. (build.js 에도 같은 스위치가 있습니다) */
var APP_CONTENT_FROM_CODE = true;
var APP_DESC_CODE = {"temp": "측정 대상의 온도 범위와 열용량에 맞는 센서 방식을 선정해, 냉장·냉동·공정·전산실 온도를 10분 주기로 자동 기록합니다.", "leak": "전극 간 통전 원리의 포인트·로프·플로트형 센서를 누수 경로에 맞게 배치해, 기계실·전산실·천장 배관의 물 접촉을 감지 즉시 통보합니다.", "hvac": "공조기 필터 전후 차압과 급·환기 온도, 팬 전류를 측정해 필터 교체 시점과 송풍 계통의 이상을 수치로 관리합니다.", "greenhouse": "온실 내부의 온도·습도·CO₂·조도를 구역별로 측정해 야간 저온, 결로, 환기 부족 구간을 찾아냅니다.", "air": "CO₂·미세먼지·온습도를 상시 측정해 재실 인원에 맞는 환기 운전과 실내공기질 유지기준 관리를 지원합니다.", "uc-mold": "누수·침수 복구 현장의 온습도와 이슬점을 연속 기록해 건조 완료 시점을 데이터로 판정하고 곰팡이 재발을 관리합니다.", "uc-hot-yoga": "고온·고습으로 운영하는 수련실의 온도·습도·CO₂를 측정해 수업 환경의 일관성과 환기 상태를 관리합니다.", "uc-hvac": "냉동기·보일러·냉각탑·순환펌프의 공급·환수 온도와 전류, 운전 신호를 측정해 열원 설비의 효율 저하와 정지를 조기에 파악합니다.", "refrig": "쇼케이스·워크인 냉장고·냉동고의 고내 온도와 압축기 전류, 도어 상태를 측정해 냉동 설비의 이상을 상품 온도가 이탈하기 전에 파악합니다.", "cold-chain": "입고부터 보관, 출고 도크, 수송 차량까지 구간별 온도를 같은 기준으로 기록해 온도 이력이 끊기는 지점을 없앱니다.", "logistics": "대형 창고의 구역별·높이별 온습도를 다점 측정해 냉동·냉장 구역의 편차와 상온 구역의 결로 위험을 관리합니다.", "food": "집단급식소와 중앙 조리시설의 냉장·냉동고, 검수·보존식 온도를 자동 기록해 HACCP 모니터링 기록의 공백을 줄입니다.", "grocery": "슈퍼마켓·SSM 다점포의 쇼케이스와 후방 냉장·냉동고를 같은 기준으로 감시하고 본사가 점포별 온도 관리 상태를 비교합니다.", "transport": "냉장·냉동 탑차 적재함의 온도와 도어 개폐를 운행 중 연속 기록하고, 이탈 시 운전자와 관제 담당자에게 문자로 알립니다.", "uc-restaurant": "외식 매장 주방의 냉장·냉동고와 워크인 온도를 자동 기록해 수기 점검 부담을 줄이고 영업 종료 후 고장을 문자로 알립니다.", "uc-convenience": "편의점의 워크인 쿨러, 오픈 쇼케이스, 냉동 평대 온도를 점포당 소수의 센서로 감시하고 야간·무인 운영 시간의 고장을 통보합니다.", "uc-school-cafeteria": "학교 급식실의 냉장·냉동고와 보존식 냉동고 온도를 자동 기록하고 방학·주말 무인 기간의 이상을 영양교사와 행정실에 알립니다.", "uc-perishable-food": "식품 제조공장의 원료 보관, 해동·숙성, 가공실, 완제품 창고의 온습도를 연속 기록해 HACCP 모니터링과 공정 조건 관리를 지원합니다.", "vaccine": "백신 냉장고의 온도를 2~8℃ 기준으로 연속 기록하고, 고온 이탈과 동결 위험을 구분해 의료기관 담당자에게 알립니다.", "hospital": "혈액·검체·의약품 보관 장비의 온도와 음압격리실 차압, 기계실 누수를 병원 시설팀과 해당 부서가 함께 확인하도록 구성합니다.", "lab": "초저온 냉동고, 안정성 시험 챔버, 시약 냉장고, 청정실 차압을 연속 기록하고 서버구축형으로 사내망 안에서 데이터를 관리할 수 있습니다.", "morgue": "장례식장 안치 냉장고, 해부·병리 시설, 조직 보관 냉동고의 온도와 도어 상태를 연속 기록하고 이탈 시 당직자에게 알립니다.", "pharma-cold": "의약품 도매·물류 거점의 냉장 창고와 수송 용기·차량 온도를 기록해 KGSP와 생물학적 제제 수송 관리 요건의 이행을 지원합니다.", "uc-nicu": "신생아 집중치료실의 모유·약품 냉장고와 병동 온습도, 음압·양압 구역 차압을 시설 보조 감시 체계로 기록합니다.", "uc-pharma-refrig": "약국·의원·병원 약제부의 의약품 냉장고 온도를 연속 기록해 인슐린·백신·생물학적 제제 등 냉장 의약품의 보관 이탈을 조기에 알립니다.", "uc-elderly": "영상 촬영 없이 동작·출입문·비상벨·실내 온도 신호만으로 독거 어르신의 생활 반응과 주거 환경 위험을 보호자와 관리 기관에 알립니다.", "manufact": "모터·펌프·팬·감속기의 진동 속도와 표면 온도, 전류를 주기적으로 측정해 회전 설비의 열화 추세를 관리하고 정비 시점을 앞당겨 판단합니다.", "construct": "동절기 콘크리트 양생 온도, 양생 공간의 일산화탄소, 가설 전력과 침수를 무선으로 기록해 품질 기록과 현장 안전 관리를 함께 지원합니다.", "datacenter": "랙 흡기 온도 분포, 이중마루 하부 누수, 컨테인먼트 차압, 배터리실 온도를 다점 측정해 냉각 여유와 침수 위험을 상시 확인합니다.", "energy": "정압기실, 가스·수소 충전 설비, 집단에너지 배관, 관정 펌프처럼 상주 인력이 없는 에너지 설비의 압력·온도·경보 접점을 LTE로 수집합니다.", "solar": "태양광 발전소의 인버터실·접속반 온도, 침수, 출입문, 인버터 고장 접점을 수집해 발전량 모니터링이 다루지 않는 부대설비 상태를 감시합니다.", "uc-plant-maint": "공정 플랜트의 펌프·송풍기·열교환기·배관에 무선 진동·온도·압력 센서를 추가해 계기가 없던 지점의 상태를 정기 점검 사이에도 확인합니다.", "uc-datacenter": "사옥 전산실, 통신실, 지점 서버실처럼 전담 인력이 없는 소규모 전산 공간의 온도·누수·전원·출입을 최소 구성으로 감시합니다.", "uc-manufacturing": "압축공기 압력, 건조로·오븐 온도, 설비 전류를 측정해 유틸리티 손실과 공정 조건 이탈, 설비 가동 시간을 수치로 관리합니다.", "uc-solar": "공장·물류센터·건물 지붕형 태양광의 모듈 온도, 접속반 과열, 전기실 환경을 감시해 자가용 발전 설비의 안전 관리와 건물 관리를 연결합니다.", "facility": "소방 수신기의 화재 신호, 전기실 정전, 집수정 침수, 기계실 온도를 문자로 통보해 야간·휴일 무인 사업장의 초기 대응 시간을 확보합니다.", "hospitality": "객실 욕실과 층별 배관 샤프트의 누수, 객실 온습도, 냉장 설비를 감시해 객실 판매 중단으로 이어지는 시설 사고를 줄입니다.", "financial": "금융기관 전산센터의 부대설비실과 본점·지점 시설의 온도·누수·전원을 감시하되, 전산실 무선 제한 등 금융 보안 규정에 맞춰 구성합니다.", "vacant": "공실 상가·사무실·건물의 누수, 동파, 무단 출입, 화재 수신기 신호를 원격으로 통보해 관리인 없이 비어 있는 기간의 자산 손상을 막습니다.", "smartcity": "지하차도·저지대 침수, 공공시설의 누수·정전, 무더위쉼터 실내 온도를 독립 무선망으로 수집해 지자체 통합 플랫폼에 전달합니다.", "uc-commercial-building": "업무용 빌딩의 기계실·전기실·공조실·층별 PS에 무선 감시점을 추가하고 Modbus로 기존 자동제어에 연결해 유지관리 기록과 민원 대응의 근거를 만듭니다.", "uc-retail": "무인 매장과 다점포 소매 매장의 냉동·냉장 설비, 정전, 누수, 출입을 점포당 LTE 게이트웨이 한 대로 감시합니다.", "uc-hotels": "리조트·콘도·호텔의 급탕 온도, 수영장·사우나 기계실, 주방 냉장 설비, 보일러 운전 신호를 감시해 부대시설의 위생과 설비 연속성을 관리합니다.", "uc-apartment": "공동주택 지하 전기실·기계실·집수정의 침수와 정전, 공용 배관 누수, 저수조·소방 펌프실 상태를 관리사무소와 관리소장에게 통보합니다.", "uc-second-home": "주말에만 사용하는 전원주택·별장·농막의 실내 온도, 누수, 보일러 정지, 출입을 휴대전화 문자로 알려 비어 있는 동안의 동파와 침입에 대비합니다.", "uc-schools-churches": "방학과 주중에 비어 있는 학교·종교시설의 누수, 동파, 정전, 화재 수신기 신호를 통보하고 교실·예배 공간의 CO₂와 온습도를 기록합니다.", "uc-foreclosed": "경매·공매 진행 중이거나 담보권 실행으로 관리 주체가 불명확한 부동산의 동파, 누수, 무단 점유를 감시해 처분 시점까지 담보 가치를 보전합니다.", "uc-dormitory": "기숙사의 공용 배관 누수, 방학 중 공실 동파, 보일러·급탕 설비 정지, 세탁실·공용 주방의 누수를 감시해 소수의 관리 인력으로 여러 동을 운영합니다.", "uc-storage": "셀프스토리지, 문서·기록물 보관소, 미술품·와인 보관 시설의 온습도와 누수, 출입을 기록해 보관 조건을 고객에게 증빙합니다.", "uc-financial": "은행·증권·보험 지점과 무인 점포의 통신실, 금고·문서고, 자동화기기 코너의 온도·누수·정전을 본점에서 통합 확인합니다.", "livestock": "밀폐형 돈사·계사의 온습도와 환기팬 운전, 정전, 급수 압력을 감시해 폭염과 환기 정지에 따른 폐사 위험을 조기에 통보합니다.", "marina": "계류 중인 요트·레저 보트·어선의 빌지 수위, 배터리 전압, 육상 전원 연결 상태를 감시해 무인 계류 중의 침수와 방전을 알립니다.", "pet": "애견 호텔·유치원, 동물병원 입원실, 반려동물 판매·미용 시설의 실내 온습도와 냉난방 정지, 정전을 야간·무인 시간에 통보합니다.", "pest": "식품공장·물류센터의 방충·방서 관리에서 온습도, 출입문 개방, 트랩 작동 신호를 기록해 해충·설치류 유입 조건과 경로를 관리합니다.", "grow": "인공광 식물공장, 버섯 재배사, 육묘장의 온도·습도·CO₂·조도를 재배단과 구역별로 측정해 설정값과 실제 재배 환경의 차이를 확인합니다.", "uc-smart-farm": "온실·축사의 환기팬, 측창·천창 개폐기, 순환 팬이 설정대로 실제 동작했는지를 전류·접점 신호로 확인하고 실내 환경 변화와 대조합니다.", "uc-greenhouse": "토양·배지의 수분, 양액 탱크 온도, 관수 펌프 운전을 기록해 딸기·토마토·화훼 등 시설 재배의 관수 시점과 급액 설비 상태를 관리합니다.", "uc-pest-control": "빈대·저장물 해충의 열처리 방제 작업에서 공간 내 여러 지점의 온도를 연속 기록해 목표 온도 도달과 유지 시간을 증빙합니다.", "uc-pet-welfare": "군·경찰·세관의 특수목적견 견사와 수송 차량, 지자체 동물보호센터의 온습도와 정전을 감시해 관리 인력이 없는 시간의 환경 사고를 예방합니다.", "uc-aquaculture": "육상 양식장의 수온, 순환 펌프·블로워 운전, 정전, 수조 수위를 감시해 고수온기와 설비 정지에 따른 대량 폐사 위험을 통보합니다."};
function splitItems(s){ return String(s||'').split(/\s*\|\|\s*|\r?\n/).map(x => x.trim()).filter(Boolean); }
function splitFields(s){ return String(s||'').split('::').map(x => x.trim()); }

/* Cases (활용 사례 / Use case) — 한 행 = 한 사례
   *_en 열(title_en, tagline_en, about_en, quote_en, cite_en, challenges_en,
   solutions_en, results_en, qs_en)이 있으면 영문(EN) 전환 시 자동 번역되도록 등록한다. */
function mapCases(rows){
  const out = {};
  const I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
  const reg = (ko, en) => { if (I18N && ko != null && en != null && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
  const regTitle = (ko, en) => {
    if (!ko || !en) return;
    const kf = String(ko).split(/<[^>]*>/).map(s => s.trim()).filter(Boolean);
    const ef = String(en).split(/<[^>]*>/).map(s => s.trim()).filter(Boolean);
    if (kf.length === ef.length) kf.forEach((k, i) => reg(k, ef[i]));
    else { reg(String(ko).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(), String(en).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()); }
  };
  const regList = (ko, en) => { const k = splitItems(ko), e = splitItems(en); const m = Math.min(k.length, e.length); for (let i=0;i<m;i++) reg(k[i], e[i]); };
  const regPairList = (ko, en, n) => { // t::d 또는 n::l 형태에서 n번째 칸끼리 매칭 (개수 달라도 가능한 만큼)
    const k = splitItems(ko), e = splitItems(en);
    const m = Math.min(k.length, e.length);
    for (let i=0;i<m;i++){ const kf = splitFields(k[i]), ef = splitFields(e[i]); reg(kf[n], ef[n]); }
  };
  rows.forEach(o => {
    const key = (o.key||'').trim();
    if (!key || !o.name) return;
    out[key] = {
      num: o.num||'', industry: o.industry||'',
      accent: o.accent||'#444', accentBg: o.accentbg||'#eee',
      name: o.name, title: o.title||'', tagline: o.tagline||'',
      qs: splitItems(o.qs).map(it => { const f = splitFields(it); return { n:f[0]||'', l:f[1]||'' }; }),
      about: o.about||'',
      challenges: splitItems(o.challenges),
      solutions: splitItems(o.solutions).map(it => { const f = splitFields(it); return { t:f[0]||'', d:f[1]||'' }; }),
      results: splitItems(o.results).map(it => { const f = splitFields(it); return { n:f[0]||'', l:f[1]||'' }; }),
      quote: o.quote||'', cite: o.cite||'',
      hero: (o.hero||'').trim(),
      photos: parsePhotos(o.photos),
      featured: /^(true|1|y|yes|예|네|대표|featured)$/i.test(String(o.featured||'').trim())
    };
    // 영문(EN) 등록 — *_en 열이 있을 때만
    regTitle(o.title, o.title_en || o.titleen);
    reg(o.tagline, o.tagline_en || o.taglineen);
    reg(o.about,   o.about_en   || o.abouten);
    reg(o.quote,   o.quote_en   || o.quoteen);
    reg(o.cite,    o.cite_en    || o.citeen);
    regList(o.challenges, o.challenges_en || o.challengesen);
    regPairList(o.solutions, o.solutions_en || o.solutionsen, 0); // 솔루션 제목
    regPairList(o.solutions, o.solutions_en || o.solutionsen, 1); // 솔루션 설명
    regPairList(o.results, o.results_en || o.resultsen, 1);       // 결과 라벨
    regPairList(o.qs,      o.qs_en      || o.qsen,      1);       // 핵심지표 라벨
    // 합성 문구(회사명·업종·인용·헤딩)도 화면에 나타나는 그대로 등록
    var _nmEn  = (o.name_en || o.nameen || '').trim();
    var _indEn = (o.industry_en || o.industryen || '').trim();
    var _ciEn  = (o.cite_en || o.citeen || '').trim();
    var _shown = _nmEn || o.name;
    reg(o.name, _nmEn);
    reg(o.industry, _indEn);
    if (_indEn) reg('Industry — ' + o.industry, 'Industry — ' + _indEn);
    if (_ciEn)  reg('— ' + o.cite, '— ' + _ciEn);
    if (o.name) reg(o.name + '가 활용하는 솔루션', 'Solutions used by ' + _shown);
    if (o.num && o.name) reg('Case Study ' + o.num + ' · ' + o.name, 'Case Study ' + o.num + ' · ' + _shown);
  });
  return out;
}

/* AppCategories — 한 행 = 한 카테고리 */
function mapCategories(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    if (!key || !o.name) return;
    out[key] = { name: o.name, label: o.label||'' };
  });
  return out;
}

/* 시트 Applications·AppDetails 탭의 *_en 열 사용 여부 (2026-10-28 행 어긋남 확인 → false) */
const SHEET_EN_APPS = false;
/* Applications — 한 행 = 한 어플리케이션 */
function mapApps(rows){
  const out = [];
  const I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
  const reg = (ko, en) => { if (I18N && ko != null && en != null && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
  rows.forEach(o => {
    if (!o.id || !o.name) return;
    out.push({
      id: o.id.trim(), name: o.name, cat: (o.cat||'').trim(),
      desc: o.desc||'', sensors: o.sensors||'',
      popularity: parseInt(o.popularity,10) || 0,
      isNew: /^(true|1|y|yes|예|네|새|new)$/i.test((o.isnew||'').trim()),
      added: o.added||'',
      file: (o.file||o.pdf||o.download||o.attachment||'').trim(),
      photos: parsePhotos(o.photos)
    });
    /* 2026-10-28 Applications 탭 name_en·desc_en 열이 행과 어긋나 있음(예: 호텔·숙박 → Financial Services).
       시트를 바로잡기 전까지 영문은 /js/i18n-extra.js 사전을 씁니다. 바로잡은 뒤 SHEET_EN_APPS 를 true 로. */
    if (SHEET_EN_APPS) { reg(o.name, o.name_en || o.nameen); reg(o.desc, o.desc_en || o.descen); }
  });
  return out;
}

/* AppDetails — 한 행 = 어플리케이션 1개의 상세 페이지
   · 내용이 하나도 없는(키만 있는) 템플릿 행은 건너뜀 → 기존 기본 상세 유지
   · 일부 칸만 채운 행은 비어 있는 항목을 DEFAULT_APP_DETAIL 로 자동 보완 */
function mapAppDetails(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    if (!key) return;
    // 키 외에 내용이 전혀 없으면 템플릿 행으로 보고 건너뛴다
    const contentCols = [o.snapshot,o.customerlead,o.customerparagraphs,o.challengelead,o.pains,
      o.solutionlead,o.solutionparagraphs,o.sensors,o.proposallead,o.phases,o.roilead,o.metrics,o.before,o.after];
    if (!contentCols.some(v => (v==null?'':String(v)).trim())) return;

    const D = (typeof DEFAULT_APP_DETAIL !== 'undefined') ? DEFAULT_APP_DETAIL : {snapshot:[],customer:{lead:'',paragraphs:[]},challenge:{lead:'',pains:[]},solution:{lead:'',paragraphs:[],sensors:[]},proposal:{lead:'',phases:[]},roi:{lead:'',metrics:[],before:'',after:''}};
    const snapshot = splitItems(o.snapshot).map(it => { const f = splitFields(it); return { label:f[0]||'', value:f[1]||'', desc:f[2]||'' }; });
    const custParas = splitItems(o.customerparagraphs);
    const pains = splitItems(o.pains).map(it => { const f = splitFields(it); return { title:f[0]||'', desc:f[1]||'' }; });
    const solParas = splitItems(o.solutionparagraphs);
    const solSensors = splitItems(o.sensors);
    const phases = splitItems(o.phases).map(it => { const f = splitFields(it); return { tag:f[0]||'', title:f[1]||'', desc:f[2]||'', duration:f[3]||'' }; });
    const metrics = splitItems(o.metrics).map(it => { const f = splitFields(it); return { num:f[0]||'', desc:f[1]||'' }; });

    out[key] = {
      snapshot: snapshot.length ? snapshot : D.snapshot,
      datasheet: (o.datasheet || o.file || o.pdf || o.attachment || o.download || '').trim(),
      customer: { lead: (o.customerlead||'').trim() || D.customer.lead, paragraphs: custParas.length ? custParas : D.customer.paragraphs },
      challenge: { lead: (o.challengelead||'').trim() || D.challenge.lead, pains: pains.length ? pains : D.challenge.pains },
      solution: { lead: (o.solutionlead||'').trim() || D.solution.lead, paragraphs: solParas.length ? solParas : D.solution.paragraphs, sensors: solSensors.length ? solSensors : D.solution.sensors },
      proposal: { lead: (o.proposallead||'').trim() || D.proposal.lead, phases: phases.length ? phases : D.proposal.phases },
      roi: { lead: (o.roilead||'').trim() || D.roi.lead, metrics: metrics.length ? metrics : D.roi.metrics, before: (o.before||'').trim() || D.roi.before, after: (o.after||'').trim() || D.roi.after }
    };

    // 영문(EN) 등록 — *_en 열이 있을 때만 (한글 칸과 항목 개수·구분자가 같아야 매칭)
    const I18N = (typeof window !== 'undefined' && SHEET_EN_APPS) ? window.MonnitI18N : null;  /* AppDetails *_en 열도 공통 문구·행 어긋남이 있어 보류 (위 SHEET_EN_APPS 참고) */
    if (I18N) {
      const reg = (ko, en) => { if (ko != null && en != null && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
      const regList = (ko, en) => { const k = splitItems(ko), e = splitItems(en); const m = Math.min(k.length, e.length); for (let i=0;i<m;i++) reg(k[i], e[i]); };
      const regPair = (ko, en, n) => { const k = splitItems(ko), e = splitItems(en); const m = Math.min(k.length, e.length); for (let i=0;i<m;i++){ reg(splitFields(k[i])[n], splitFields(e[i])[n]); } };
      reg(o.customerlead,  o.customerlead_en  || o.customerleaden);
      reg(o.challengelead, o.challengelead_en || o.challengeleaden);
      reg(o.solutionlead,  o.solutionlead_en  || o.solutionleaden);
      reg(o.proposallead,  o.proposallead_en  || o.proposalleaden);
      reg(o.roilead,       o.roilead_en       || o.roileaden);
      reg(o.before,        o.before_en        || o.beforeen);
      reg(o.after,         o.after_en         || o.afteren);
      regList(o.customerparagraphs, o.customerparagraphs_en || o.customerparagraphsen);
      regList(o.solutionparagraphs, o.solutionparagraphs_en || o.solutionparagraphsen);
      regList(o.sensors,            o.sensors_en            || o.sensorsen);
      const snapEn = o.snapshot_en || o.snapshoten;
      regPair(o.snapshot, snapEn, 0); regPair(o.snapshot, snapEn, 1); regPair(o.snapshot, snapEn, 2);
      const painsEn = o.pains_en || o.painsen;
      regPair(o.pains, painsEn, 0); regPair(o.pains, painsEn, 1);
      const phEn = o.phases_en || o.phasesen;
      regPair(o.phases, phEn, 0); regPair(o.phases, phEn, 1); regPair(o.phases, phEn, 2); regPair(o.phases, phEn, 3);
      regPair(o.metrics, o.metrics_en || o.metricsen, 1); // 지표 설명(숫자는 공용)
    }
  });
  return out;
}

/* 자료실 & 지원 (단순 목록 탭) */
function mapBlog(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.body,o.body_en); regI18N(o.insight,o.insight_en);
    return ({ date:o.date||'', title:o.title, body:o.body||'', insight:o.insight||'', thumb:o.thumb||'◐', image:normalizeImageUrl(o.image||''), category:o.category||'', url:o.url||'' }); });
}
function mapNews(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.desc,o.desc_en);
    return ({ title:o.title, desc:o.desc||'', url:o.url||'' }); });
}
/* 공유 링크(구글 드라이브·드롭박스)를 <img>에서 바로 보이는 직접 이미지 주소로 변환 */
function normalizeImageUrl(u){
  u = String(u==null?'':u).trim();
  if (!u) return '';
  if (u.indexOf('drive.google.com') !== -1){
    var m = u.match(/\/file\/d\/([^/]+)/) || u.match(/[?&]id=([^&]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  }
  if (u.indexOf('dropbox.com') !== -1){
    return u.replace('www.dropbox.com','dl.dropboxusercontent.com').replace(/[?&]dl=0/, '');
  }
  /* 시트에 「images/img-10.jpg」처럼 앞의 / 없이 적힌 경로 — /case/… 같은 하위 페이지에서
     /case/images/… 로 잘못 불려 404 가 나던 문제 (2026-10-14). 사이트 기준 경로로 고정 */
  if (!/^(https?:|data:|blob:|\/\/|\/)/i.test(u)) u = '/' + u.replace(/^\.\/+/, '');
  return u;
}
/* 구글 드라이브·원드라이브 공유 링크를 바로 받아지는 주소로 바꿔 줍니다.
   시트 url 열에 공유 링크를 그대로 붙여 넣어도 되도록 하기 위함입니다. */
function normalizeDocUrl(u){
  u=(u||'').trim(); if(!u) return '';
  var m=u.match(/drive\.google\.com\/file\/d\/([^/]+)/) || u.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if(m) return 'https://drive.google.com/uc?export=download&id='+m[1];
  if(/docs\.google\.com\/document\/d\//.test(u)) return u.replace(/\/(edit|view).*$/,'/export?format=pdf');
  if(/1drv\.ms|onedrive\.live\.com/.test(u) && u.indexOf('download')<0) return u+(u.indexOf('?')<0?'?':'&')+'download=1';
  return u;
}
function mapWhitepapers(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.desc,o.desc_en);
    /* url 열은 의도적으로 읽지 않는다 — 다운로드 주소는 sendpw 함수(서버)만 안다.
       시트는 gviz CSV 로 공개 조회되므로, 여기에 링크를 두면 그 자체로 노출된다. */
    return ({ icon:o.icon||'▤', title:o.title, desc:o.desc||'', category:o.category||'', dlname:o.dlname||o.filename||'', thumb:o.thumb||'', photo:normalizeImageUrl((o.photo||'').split('||')[0].split('::')[0]) }); });
}
function mapFaqs(rows){
  return rows.filter(o => o.question).map(o => { regI18N(o.question,o.question_en); regI18N(o.answer,o.answer_en);
    return ({ q:o.question, a:o.answer||'' }); });
}
function mapKnowledgebase(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.desc,o.desc_en);
    return ({ category:o.category||'', title:o.title, desc:o.desc||'' }); });
}

/* ====== 메인/About us 본문 슬롯 주입 ======
   index.html 을 건드리지 않고, 각 뷰의 제목·문단·이미지에 런타임 키를 부여하여
   SiteContent 탭(열: key, ko, en, image)의 값으로 덮어쓴다. 값이 비어 있으면 기존 기본값 유지. */
let SITE_CONTENT = {};
const SITE_VIEWS = ['view-home','view-proposal','view-who-we-are','view-what-we-do','view-our-solution','view-stories','view-applications','view-blog','view-products','view-partners','view-awards','view-knowledgebase','view-faqs','view-guides','view-whitepaper'];
const SLOT_TEXT_SEL = 'h1,h2,h3,h4,h5,p,figcaption,.sp-k,.sp-v,.sp-d,.hs-t,.hs-d,.step-title,.step-desc';
let _siteToggleHooked = false;
function eachSlot(cb){
  let homeCount=0;
  SITE_VIEWS.forEach(function(vid){
    const root = document.getElementById(vid); if(!root) return;
    const base = vid.replace('view-','');
    if (vid === 'view-home' || vid === 'view-who-we-are' || vid === 'view-proposal'){
      /* data-sc 슬롯 기반 (홈 + About us) — 시트 SiteContent 값으로 텍스트·이미지 덮어쓰기 */
      const slots = root.querySelectorAll('[data-sc]');
      slots.forEach(function(el){
        const key = el.getAttribute('data-sc'); if(!key) return;
        homeCount++;
        cb(key, el, el.tagName === 'IMG' ? 'img' : 'text');
      });
    } else {
      /* 위치 기반 슬롯 — 텍스트에 data-sc(고정 키)가 박혀 있으면 그 키를 우선(DOM 순서 변경에도 매핑 유지).
         단, 고정 키는 반드시 '{base}#t{index}' 형태(내가 주입한 위치키와 동일)여야 위치 인덱스 ti도 함께 소비해 정렬이 어긋나지 않음. */
      let ti=0; root.querySelectorAll(SLOT_TEXT_SEL).forEach(function(el){ const dsc=el.getAttribute('data-sc'); cb((dsc && dsc.indexOf(base+'#t')===0) ? dsc : (base+'#t'+ti), el, 'text'); ti++; });
      let ii=0; root.querySelectorAll('img').forEach(function(el){ cb(base+'#i'+(ii++), el, 'img'); });
    }
  });
  dlog('[eachSlot] 총', homeCount, '개 홈 슬롯 처리됨');
}
function mapSiteContent(rows){
  const out = {};
  dlog('[mapSC] rows 개수:', rows?.length || 0);
  rows.forEach(function(o){ 
    const k=(o.key||'').trim(); 
    if(!k) { dlog('[mapSC] row key 비움:', o); return; }
    out[k]={ ko:o.ko||'', en:o.en||'', image:o.image||'' };
    dlog('[mapSC] ✓', k, '→', (o.ko||'').slice(0,30));
  });
  dlog('[mapSC] 완료:', Object.keys(out).length, '개 key');
  return out;
}
function applySiteContentNow(){
  dlog('[ASC] 시작 — SITE_CONTENT:', Object.keys(SITE_CONTENT||{}).length, '개');
  if(!SITE_CONTENT || !Object.keys(SITE_CONTENT).length){ MONNIT_DEBUG && console.warn('[ASC] ❌ SITE_CONTENT 비어있음'); return; }
  dlog('[ASC] SITE_CONTENT keys:', Object.keys(SITE_CONTENT).slice(0,10).join(', '), '...');
  let lang='ko'; try{ lang=localStorage.getItem('mlang')||'ko'; }catch(e){}
  dlog('[ASC] 언어:', lang);
  let applied=0, skipped=0, slotCount=0;
  eachSlot(function(key, el, kind){
    slotCount++;
    const row = SITE_CONTENT[key];
    if(!row){ dlog('[ASC-skip]', key); skipped++; return; }
    if(kind==='img'){
      if(row.image && row.image.trim()){ const u=normalizeImageUrl(row.image.trim()); if(el.getAttribute('src')!==u){ el.removeAttribute('srcset'); el.removeAttribute('data-srcset'); el.setAttribute('src',u); applied++; } }
    } else {
      const val = (lang==='en' && row.en && row.en.trim()) ? row.en : row.ko;
      if(val!=null && String(val).trim()!==''){ 
        dlog('[ASC✓]', key, '→', val.slice(0,40)); 
        el.innerHTML=val; 
        applied++; 
      }
    }
  });
  dlog('[ASC] 완료: 총슬롯', slotCount, '| 적용', applied, '| 스킵', skipped);
  (function(){
    const st=SITE_CONTENT['seo#title']; if(st){ const v=(lang==='en'&&st.en&&st.en.trim())?st.en:st.ko; if(v&&v.trim()) document.title=v.trim(); }
    const sd=SITE_CONTENT['seo#description']; if(sd){ const v=(lang==='en'&&sd.en&&sd.en.trim())?sd.en:sd.ko; if(v&&v.trim()){ let m=document.querySelector('meta[name="description"]'); if(!m){ m=document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); } m.setAttribute('content', v.trim()); } }
  })();
  (function(){
    const c=SITE_CONTENT['product#catalog'];
    const url = c ? ((lang==='en'&&c.en&&c.en.trim())?c.en.trim():(c.ko||'').trim()) : '';
    // 시트(product#catalog)에 주소가 있으면 그 값으로 교체.
    // 없으면 HTML 기본 링크(linktr.ee)를 그대로 유지.
    if(url){ document.querySelectorAll('.cta-download').forEach(a=>{ a.setAttribute('href',url); }); }
  })();
  /* 파인더 Q1·Q2 목록(finder.config)이 시트에서 들어왔으면 버튼을 다시 그립니다 */
  try{ if(typeof window.MK_FINDER_REFRESH==='function') window.MK_FINDER_REFRESH(); }catch(e){}
  if(!_siteToggleHooked){
    /* 2026-10-28(2차) 버튼 클릭뿐 아니라 접속 국가로 자동 전환될 때도 시트 문구(영문 열)를 다시 적용 */
    window.addEventListener('monnit:langchange', function(){ setTimeout(applySiteContent, 90); }); _siteToggleHooked=true;
  }
}


/* applySiteContent(): 같은 프레임에 여러 번 불려도 실제 적용은 1회만 (중복 재적용 방지) */
let _ascPending = false;
function applySiteContent(){
  if (_ascPending) return;
  _ascPending = true;
  const run = () => { _ascPending = false; try { applySiteContentNow(); } catch(e){ console.warn('[ASC] 적용 실패:', e); } };
  (window.requestAnimationFrame || setTimeout)(run, 0);
}

/* Photos (현장 사진) — 한 행 = 사진 1장.  열: key, url, caption, order
   key 예: "case:us-army", "app:vaccine"  /  같은 key 끼리 묶어 본문에 표시 */
function mapPhotos(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    const src = normalizeImageUrl((o.url||o.src||'').trim());
    if (!key || !src) return;
    (out[key] = out[key] || []).push({ src, caption: (o.caption||'').trim(), order: parseInt(o.order,10)||0 });
  });
  Object.keys(out).forEach(k => {
    out[k].sort((a,b)=>a.order-b.order);
    out[k] = out[k].map(({src,caption})=>({src,caption}));
  });
  return out;
}

/* 시트 행 → 제품 객체. 카테고리/그룹은 한글 라벨 또는 영문 id 모두 허용.
   url이 .pdf로 끝나면 '데이터시트', 아니면 '제품 페이지'로 자동 표시.
   name_en / desc_en 열이 있으면 영문 모드 번역에 자동 등록. */
function mapProducts(rows){
  var catById = {}; PRODUCT_CATS.forEach(function(c){ catById[c.id]=c.id; catById[c.ko]=c.id; });
  var grpById = {}; SENSOR_GROUPS.forEach(function(g){ grpById[g.id]=g.id; grpById[g.ko]=g.id; });
  var pick = function(o, keys){ for (var i=0;i<keys.length;i++){ if (o[keys[i]] != null && String(o[keys[i]]).trim() !== '') return String(o[keys[i]]).trim(); } return ''; };
  var out = [];
  rows.forEach(function(o){
    var name = pick(o, ['name','이름','제품명','name_ko']);
    var rawCat = pick(o, ['category','cat','카테고리','분류']);
    var c = catById[rawCat] || catById[rawCat.toLowerCase()];
    if (!name || !c) return;
    var rawGrp = pick(o, ['group','grp','그룹','센서군']);
    var g = (c === 'sensors') ? (grpById[rawGrp] || grpById[rawGrp.toLowerCase()] || '') : '';
    var u = pick(o, ['url','link','링크','데이터시트','datasheet']);
    var d = pick(o, ['desc','description','설명','desc_ko']);
    var pdfRaw = pick(o, ['pdf','ispdf']).toLowerCase();
    var p = pdfRaw ? (['y','yes','true','1','pdf','o','예'].indexOf(pdfRaw) >= 0) : /\.pdf($|\?)/i.test(u);
    var ne = pick(o, ['name_en','nameen','영문명','name(en)']);
    var de = pick(o, ['desc_en','descen','영문설명','desc(en)']);
    if (window.MonnitI18N){ if (ne) window.MonnitI18N.add(name, ne); if (de && d) window.MonnitI18N.add(d, de); }
    out.push({ c: c, g: g, n: name, d: d, u: u, p: p });
  });
  return out;
}

/* homecases 탭 → 메인 페이지 대표 유즈케이스 3선.
   resultnum(소수)을 % 문자열로 변환. order로 정렬. caseid 없으면(안내행 등) 건너뜀. */
function fmtResult(v){
  var s = String(v==null?'':v).trim();
  if (s === '') return '';
  if (/[%/A-Za-z가-힣]/.test(s)) return s;          // 이미 형식 있음(예: 24/7, "99%")
  var n = parseFloat(s);
  if (isNaN(n)) return s;
  var r = Math.round(n * 1000) / 10;                // 소수→백분율, 소수 1자리
  var str = (r % 1 === 0) ? String(r) : String(r);
  return str + '%';
}
function mapHomeCases(rows){
  var out = [];
  var I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
  var reg = function(ko,en){ if (I18N && ko && en && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
  rows.forEach(function(o){
    var caseid = (o.caseid||'').trim();
    if (!caseid) return;                              // 안내/빈 행 제외
    out.push({
      order: parseInt(o.order,10) || 999,
      caseid: caseid,
      name: (o.name||'').trim(),
      industry: (o.industry||'').trim(),
      tagline: (o.tagline||'').trim(),
      resultNum: fmtResult(o.resultnum),
      resultLabel: (o.resultlabel||'').trim(),
      photo: normalizeImageUrl((o.photo||'').trim()),
      link: (o.link||'').trim()
    });
    reg(o.tagline, o.tagline_en || o.taglineen);
    reg(o.resultlabel, o.resultlabel_en || o.resultlabelen);
  });
  out.sort(function(a,b){ return a.order - b.order; });
  return out;
}

/* --- 시트 로드: 성공한 데이터만 교체, 실패하면 기본값 유지 --- */
async function loadSheetData(){
  // 아직 ID를 안 넣었으면 기본 데이터로 동작 (콘솔에만 안내)
  if (!CONTENT_SHEET.urls.customers && (!CONTENT_SHEET.sheetId || CONTENT_SHEET.sheetId.includes('여기에'))){
    console.info('[CONTENT_SHEET] 구글 시트 미설정 — 코드 내 기본 데이터를 사용합니다.');
    return;
  }
  const hasKeys = o => o && Object.keys(o).length > 0;
  // 앱 상세의 고정 한글 라벨도 영문 전환되도록 등록
  if (window.MonnitI18N) {
    window.MonnitI18N.add('함께 사용되는 Monnit 제품', 'Monnit products used together');
    window.MonnitI18N.add('소요', 'Duration');
  }
  const labels = [];
  const jobs = [];
  const add = (key, fn) => { labels.push(key); jobs.push(fetchSheet(key).then(fn)); };

  add('customers',     r => { const m = mapCustomers(r);     if (m.length) CUSTOMERS = m; });
  add('awards',        r => { const m = mapAwards(r);        if (m.length) AWARDS = m; });
  add('partners',      r => { const m = mapPartners(r);      if (m.length) PARTNERS = m; });
  add('cases',         r => { const m = mapCases(r);         if (hasKeys(m)) CASE_DATA = m; });
  add('appcategories', r => { const m = mapCategories(r);    if (hasKeys(m)) CATEGORIES = m; });
  add('applications',  r => { const m = mapApps(r);          if (m.length) { APPS = m; if (APP_CONTENT_FROM_CODE) APPS.forEach(a => { if (APP_DESC_CODE[a.id]) a.desc = APP_DESC_CODE[a.id]; }); } });
  add('appdetails',    r => { const m = mapAppDetails(r); if (APP_CONTENT_FROM_CODE) { Object.keys(m).forEach(k => { if (APP_DETAILS[k] && m[k].datasheet) APP_DETAILS[k].datasheet = m[k].datasheet; }); return; }    if (hasKeys(m)) APP_DETAILS = m; });
  add('blog',          r => { const m = mapBlog(r);          if (m.length) BLOG = m; });
  add('promotions',    r => { const m = mapPromotions(r);    PROMOS = m; if(typeof renderPromotions==='function') renderPromotions(); });
  // 산업별 제안서(16종)는 구글 시트 Whitepapers 탭에서 관리합니다.
  //   · PDF 는 저장소에 두지 않고 Google Drive 등 외부 링크를 url 열에 넣습니다.
  //   · 열: icon / title / desc / url / category / photo / thumb / filename
  //   · 시트가 비면 코드 내 기본 배열(제목·설명·표지)로 표시되고 다운로드만 잠깁니다.
  const WHITEPAPERS_FROM_SHEET = true;
  if (WHITEPAPERS_FROM_SHEET) add('whitepapers', r => { const m = mapWhitepapers(r); if (m.length) WHITEPAPERS = m; });
  add('news',          r => { const m = mapNews(r);          if (m.length) NEWS_HIGHLIGHTS = m; });
  add('faqs',          r => { const m = mapFaqs(r);          if (m.length) FAQS = m; });
  add('knowledgebase', r => {
    // 시트 행은 즉시 보관하고, 본문(data.js)이 이미 로드됐을 때만 병합.
    // data.js 미로드 시엔 지식베이스 진입 시 ensureDataJS→rebuildKB가 병합한다.
    window.__kbRows = r;
    if (window.__DATA_READY) rebuildKB();
  });
  add('photos',        r => { const m = mapPhotos(r);        if (hasKeys(m)) PHOTOS = Object.assign({}, PHOTOS, m); });
  add('products',      r => { const m = mapProducts(r);      if (m.length) PRODUCTS = m; });
  add('homecases',     r => { const m = mapHomeCases(r);     if (m.length) HOME_CASES = m; });
  add('logos',         r => { const m = mapLogos(r);         dlog('[add-logos]',m?.length); if(m&&m.length) renderLogos(m); else dlog('[Logos] 데이터 없음'); });
  add('sitecontent',   r => { dlog('[add-sitecontent] 로드 시작, rows:', r?.length); const sc = mapSiteContent(r); SITE_CONTENT = sc; dlog('[add-sitecontent] 맵핑 완료, 100ms 후 apply'); setTimeout(applySiteContent, 100); });

  const results = await Promise.allSettled(jobs);
  results.forEach((res, idx) => {
    if (res.status === 'rejected'){
      console.warn('[CONTENT_SHEET] ' + labels[idx] + ' 탭 로드 실패 — 기본값 사용:', res.reason);
    }
  });
  // 연결 상태 진단: 콘솔에서 시트가 실제로 반영됐는지 바로 확인 가능
  MONNIT_DEBUG && console.info('[CONTENT_SHEET] 로드 요약 — homecases:' + (HOME_CASES ? HOME_CASES.length : 0)
    + '행, cases:' + Object.keys(CASE_DATA).length + '개, products:' + PRODUCTS.length
    + '개, customers:' + CUSTOMERS.length + '개  (sheetId=' + CONTENT_SHEET.sheetId + ')');
  if (!HOME_CASES || !HOME_CASES.length){
    console.warn('[CONTENT_SHEET] homecases 탭을 읽지 못했습니다 — 연결된 시트에 "homecases" 탭이 있는지, sheetId가 올바른지, 공유가 "링크가 있는 모든 사용자-뷰어"인지 확인하세요.');
  }
}

/* ========== NAVIGATION ========== */
/* ═══════════════════════════════════════════════════════════════════
   경로(Path) 라우팅  — 2026-07 해시 라우팅에서 전환
   ------------------------------------------------------------------
   화면 이름 ↔ 주소
     home             →  /
     stories          →  /stories
     app/temp         →  /app/temp
     case/samsung     →  /case/samsung
     promotions/fire  →  /promotions/fire
   · 주소는 history.pushState 로 바꾸므로 새로고침·공유·뒤로가기가 모두 됩니다.
   · 예전 #해시 주소로 들어와도 부팅 때 같은 경로로 조용히 바꿔 줍니다.
   ═══════════════════════════════════════════════════════════════════ */
const ROUTE_PREFIX = '';                 // 하위 폴더 배포 시에만 사용 (예: '/site')
function routeToPath(target){
  const t = String(target||'').replace(/^[#/]+/,'').replace(/\/+$/,'');
  return (!t || t==='home') ? (ROUTE_PREFIX||'/') : (ROUTE_PREFIX + '/' + t);
}
function pathToRoute(pathname){
  let p = String(pathname||'/');
  if (ROUTE_PREFIX && p.indexOf(ROUTE_PREFIX)===0) p = p.slice(ROUTE_PREFIX.length);
  p = p.replace(/^\/+|\/+$/g,'');
  if (!p) return 'home';
  p = p.replace(/\.html$/,'');           // 혹시 남은 .html 주소도 받아 줍니다
  return decodeURIComponent(p);
}
let _navSilent = false;                  // 뒤로가기 처리 중에는 주소를 다시 쌓지 않습니다
/* 맞춤 제안서 화면의 조건·개인 링크 값은 다른 화면 주소로 따라가지 않게 뺍니다 */
const PROPOSAL_QS = ['t','dup','lim','demo','from','fac','con','scale','fl','cl','co','nm','ti','ind','pr','gl','sgl','rc','industry','problems','goals'];
function searchFor(target){
  try{
    if (/^proposal(\/|$)/.test(String(target||''))) return location.search;
    if (!/^\/proposal(\/|$)/.test(location.pathname)) return location.search;
    const p = new URLSearchParams(location.search);
    PROPOSAL_QS.forEach(k => p.delete(k));
    const q = p.toString();
    return q ? '?' + q : '';
  }catch(e){ return location.search; }
}
function setURL(target, replace){
  if (_navSilent) return;
  try{
    const url = routeToPath(target) + searchFor(target);
    if (location.pathname + location.search !== url){
      history[replace ? 'replaceState' : 'pushState']({ route:String(target||'') }, '', url);
    }
    if (typeof window.MK_TRACK_PAGEVIEW === 'function') window.MK_TRACK_PAGEVIEW();
  }catch(e){}
}

function navigate(target) {
  { const _k = document.querySelector('h1.ssg-h1'); if (_k && _k.dataset.route !== String(target || '').replace(/^\/+|\/+$/g, '')) _k.remove(); }
  // target: "stories", "applications", "awards", "partners", "case/{id}", or "app/{id}"
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (target.startsWith('case/')) {
    const caseId = target.slice(5);
    // 아직 내용이 없는 사례는 빈 화면 대신 '준비 중' 안내로 보냅니다
    if (!CASE_DATA[caseId]) {
      renderCaseComingSoon(caseId);
      document.getElementById('view-coming').classList.add('active');
      { const _n=document.querySelector('.nav-link[data-nav="stories"]'); if(_n) _n.classList.add('active'); }
      setURL(target);
      proposalPill(target);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    renderCaseDetail(caseId);
    document.getElementById('view-case').classList.add('active');
    { const _n=document.querySelector('.nav-link[data-nav="stories"]'); if(_n) _n.classList.add('active'); }
    setURL(target);
  } else if (target.startsWith('app/')) {
    const appId = target.slice(4);
    // 아직 내용이 없는 활용분야는 빈 화면 대신 '준비 중' 안내로 보냅니다
    if (!APPS.some(a => a.id === appId)) {
      renderComingSoon(appId);
      document.getElementById('view-coming').classList.add('active');
      { const _n=document.querySelector('.nav-link[data-nav="applications"]'); if(_n) _n.classList.add('active'); }
      setURL(target);
      proposalPill(target);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    renderAppDetail(appId);
    document.getElementById('view-app-detail').classList.add('active');
    { const _n=document.querySelector('.nav-link[data-nav="applications"]'); if(_n) _n.classList.add('active'); }
    setURL(target);
  } else if (target.startsWith('promotions/')) {
    // 프로모션 상세 딥링크 (#promotions/{id}) — 빈 페이지 방지
    const promoId = decodeURIComponent(target.slice('promotions/'.length));
    document.getElementById('view-promotions').classList.add('active');
    const pnav = document.querySelector('.nav-promo-btn') || document.querySelector('[data-nav="promotions"]');
    if (pnav) pnav.classList.add('active');
    setURL(target);
    // PROMOS가 아직 로드 안 됐으면(특히 모바일 저속망) 로드 후 열도록 재시도
    const tryOpen = (n) => {
      if (PROMOS && PROMOS.length){ openPromo(promoId, true); }   // openPromo 안에서 기간 검사 후 차단
      else if (n > 0){ setTimeout(() => tryOpen(n-1), 300); }
      else { if (typeof closePromo === 'function') closePromo(true); }
    };
    tryOpen(20);
  } else if (target.startsWith('promo/')) {
    /* /promo/<id> — 광고에서 바로 들어오는 단일 프로모션 주소.
       프로모션 화면을 열되 주소는 그대로 둡니다.
       이 분기가 없던 동안 navigate() 가 이 주소를 못 알아보고 홈으로 폴백하면서
       주소를 monnit.co.kr/ 로 바꿔 버렸고, GA4 도 랜딩을 홈으로 기록했습니다. */
    { const _v = document.getElementById('view-promotions'); if (_v) _v.classList.add('active'); }
    { const _n = document.querySelector('[data-nav="promotions"]'); if (_n) _n.classList.add('active'); }
    setURL(target);
  } else if (target.startsWith('kb/')) {
    /* /kb/<카테고리슬러그> — build.js 가 지식베이스 카테고리마다 만드는 경로 */
    const cat = CAT_BY_SLUG[target.slice(3)];
    document.getElementById('view-knowledgebase').classList.add('active');
    { const _n=document.querySelector('.nav-link[data-nav="knowledgebase"]'); if(_n) _n.classList.add('active'); }
    setURL(target);
    kbState.view = cat ? 'list' : 'home'; kbState.cat = cat || null;
    kbState.search = ''; kbState.page = 1; kbState.docId = null; kbState.ret = null;
    { const ks=document.getElementById('kbSearch'); if(ks) ks.value=''; }
    { const kc=document.getElementById('kbSearchClear'); if(kc) kc.style.display='none'; }
    if (!window.__DATA_READY){ const _g=document.getElementById('kbGrid'); if(_g) _g.innerHTML='<div style="padding:48px 0;text-align:center;color:var(--ink-soft,#8598b4)">지식베이스를 불러오는 중…</div>'; }
    ensureDataJS(function(){ if (typeof renderKnowledgebase === 'function') renderKnowledgebase(); });
  } else if (target.startsWith('guide/')) {
    /* /guide/<카테고리슬러그> — build.js 가 기술지원 가이드 카테고리마다 만드는 경로 */
    const cat = CAT_BY_SLUG[target.slice(6)];
    document.getElementById('view-guides').classList.add('active');
    { const _n=document.querySelector('.nav-link[data-nav="guides"]'); if(_n) _n.classList.add('active'); }
    setURL(target);
    guideState.view = cat ? 'list' : 'home'; guideState.cat = cat || null;
    guideState.search = ''; guideState.page = 1; guideState.docId = null; guideState.ret = null;
    { const gs=document.getElementById('gSearch'); if(gs) gs.value=''; }
    { const gc=document.getElementById('gSearchClear'); if(gc) gc.style.display='none'; }
    if (!window.__DATA_READY){ const _g=document.getElementById('gGrid'); if(_g) _g.innerHTML='<div style="padding:48px 0;text-align:center;color:var(--ink-soft,#8598b4)">가이드를 불러오는 중…</div>'; }
    ensureDataJS(function(){ if (typeof guideModule !== 'undefined' && guideModule.render) guideModule.render(); });
  } else if (target === 'proposal' || target.startsWith('proposal/')) {
    /* /proposal — 맞춤 제안서 신청 · /proposal/status — 신청 뒤 진행 현황(개인 화면, 색인 제외) */
    const isStatus = target.startsWith('proposal/status');
    if (!isStatus && target !== 'proposal') target = 'proposal';
    const _pv = document.getElementById(isStatus ? 'view-proposal-status' : 'view-proposal');
    if (_pv) _pv.classList.add('active');
    setURL(isStatus ? 'proposal/status' : 'proposal');
    ensureProposal(function(M){ M.enter(isStatus ? 'status' : 'apply'); });
  } else if (target === 'customers') {
    /* /customers — 고객사 목록. SPA 에서는 도입 사례(view-stories) 안에 그려지므로
       같은 화면을 열되 주소는 /customers 로 유지합니다 (case/ · app/ 과 같은 방식). */
    document.getElementById('view-stories').classList.add('active');
    { const _n=document.querySelector('.nav-link[data-nav="stories"]'); if(_n) _n.classList.add('active'); }
    setURL(target);
  } else {
    // 존재하지 않는 뷰(잘못된 해시 등)면 홈으로 폴백 — null classList 크래시 방지
    var _view = document.getElementById('view-' + target);
    if (!_view) { target = 'home'; _view = document.getElementById('view-home'); }
    _view.classList.add('active');
    const navBtn = document.querySelector(`.nav-link[data-nav="${target}"]`);
    if (navBtn) navBtn.classList.add('active');
    setURL(target);

    if (target === 'contact') applyContactQuote();

    // 솔루션 페이지 진입 시에만 HVAC 디지털 트윈 스크립트 지연 로드
    if (target === 'our-solution' && typeof ensureSolutionTwin === 'function') { ensureSolutionTwin(); }

    // 다른 메뉴를 거쳐 다시 들어왔을 때 기술지원/기술문서는 항상 초기 화면으로
    if (target === 'promotions' && typeof closePromo === 'function') { closePromo(); }
    if (target === 'knowledgebase' && typeof kbState !== 'undefined') {
      kbState.view = 'home'; kbState.cat = null; kbState.search = '';
      kbState.page = 1; kbState.docId = null; kbState.ret = null;
      const ks = document.getElementById('kbSearch'); if (ks) ks.value = '';
      const kc = document.getElementById('kbSearchClear'); if (kc) kc.style.display = 'none';
      // data.js(지식베이스 본문)를 이 시점에만 로드 → 로드 후 렌더
      if (!window.__DATA_READY){ const _g=document.getElementById('kbGrid'); if(_g) _g.innerHTML='<div style="padding:48px 0;text-align:center;color:var(--ink-soft,#8598b4)">지식베이스를 불러오는 중…</div>'; }
      ensureDataJS(function(){ if (typeof renderKnowledgebase === 'function') renderKnowledgebase(); });
    }
    if (target === 'guides' && typeof guideModule !== 'undefined' && guideModule.reset) {
      if (!window.__DATA_READY){ const _g=document.getElementById('gGrid'); if(_g) _g.innerHTML='<div style="padding:48px 0;text-align:center;color:var(--ink-soft,#8598b4)">가이드를 불러오는 중…</div>'; }
      ensureDataJS(function(){ if (guideModule && guideModule.reset) guideModule.reset(); });
    }
  }
  // 뷰를 열 때마다 최신 시트 본문(SiteContent)을 다시 적용 → 어떤 화면이든 시트 값이 항상 반영
  try { if (typeof applySiteContent === 'function' && SITE_CONTENT && Object.keys(SITE_CONTENT).length) applySiteContent(); } catch(e){}
  proposalPill(target);
  if (target === 'whitepaper') wpPropMount();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', e => {
    // Ctrl/Cmd/Shift+클릭·가운데 버튼은 브라우저에 맡겨 새 탭으로 열리게 둡니다
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    navigate(el.dataset.nav);
  });
});

/* ===== Business areas → Applications,  Services → Contact (prefilled) ===== */
function goToContactWith(topic) {
  navigate('contact');
  const msg = document.getElementById('ctMsg');
  if (msg) {
    msg.value = `[${topic}] 관련 문의드립니다.\n\n`;
    setTimeout(() => { msg.focus(); msg.setSelectionRange(msg.value.length, msg.value.length); }, 60);
  }
}
function goToAppsCat(catId) {
  if (catId && typeof appsState !== 'undefined') {
    appsState.category = catId; appsState.search = ''; appsState.sort = 'default'; appsState.page = 1;
    const s = document.getElementById('appsSearch'); if (s) s.value = '';
    const so = document.getElementById('appsSort'); if (so) so.value = 'default';
    renderAppsCategoryBar(); renderAppsGrid();
  }
  navigate('applications');
}
document.querySelectorAll('[data-go-contact]').forEach(el => {
  const fire = () => goToContactWith(el.dataset.goContact);
  el.addEventListener('click', fire);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
});
document.querySelectorAll('[data-go-apps]').forEach(el => {
  const fire = () => goToAppsCat(el.dataset.goApps);
  el.addEventListener('click', fire);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
});
/* Business-area photos → matched representative case study */
document.querySelectorAll('[data-go-case]').forEach(el => {
  const fire = () => { const id = el.dataset.goCase; if (CASE_DATA[id]) navigate('case/' + id); };
  el.addEventListener('click', fire);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
});

/* 뒤로/앞으로 — 주소를 다시 쌓지 않고 화면만 되돌립니다 */
window.addEventListener('popstate', () => {
  const route = pathToRoute(location.pathname);
  _navSilent = true;
  try { navigate(route); } finally { _navSilent = false; }
});

/* ========== STORIES / AWARDS / PARTNERS (시트 데이터로 렌더) ========== */
function bindOnce(el, ev, fn){ if(el && !el.__bound){ el.addEventListener(ev, fn); el.__bound = true; } }
function renderData() {
/* 재렌더(구글 시트 로드 후) 시 목록 중복 방지 — append 대상 컨테이너를 먼저 비운다 */
['featuredGrid','filterBar','cardsGrid','awardCatBars','yearChips','catChips','awardsList','regionChips','partnersList'].forEach(function(_id){ var _e=document.getElementById(_id); if(_e) _e.innerHTML=''; });
/* ========== STORIES VIEW ========== */
const featuredGrid = document.getElementById('featuredGrid');
const _labelToKey = {}; Object.entries(INDUSTRIES).forEach(([k,v]) => { _labelToKey[v.label] = k; });
const _stripTags = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const _anyFeatured = Object.values(CASE_DATA).some(c => c && c.featured);
const featuredCases = Object.entries(CASE_DATA)
  .filter(([id,c]) => {
    if (!c || !c.name) return false;
    if (_anyFeatured) return !!c.featured;                 // 대표(featured) 지정된 케이스만
    // 플래그 미설정 시: 내용이 충실한 케이스만 대표로 (최소 케이스 자동 제외)
    return !!(c.about && String(c.about).trim() && c.challenges && c.challenges.length && c.solutions && c.solutions.length);
  })
  .sort((a,b) => String(a[1].num||'').localeCompare(String(b[1].num||'')));
featuredGrid.innerHTML = '';
featuredCases.forEach(([caseId, c], idx) => {
  const num = String(idx + 1).padStart(2, '0');
  const indKey = _labelToKey[(c.industry||'').trim()];
  const tagClass = indKey ? INDUSTRIES[indKey].tag : '';
  const tagStyle = indKey ? '' : ` style="background:${c.accentBg||'#1d2942'};color:${c.accentText||c.accent||'#cfe0ff'}"`;
  const tagLabel = c.industry || '';
  const headline = c.title || c.tagline || '';
  let apps = [];
  if (c.solutions && c.solutions.length) apps = c.solutions.map(s => s.t);
  else if (c.qs && c.qs.length) apps = c.qs.map(q => q.l);
  else if (c.results && c.results.length) apps = c.results.map(r => r.l);
  apps = apps.filter(Boolean).slice(0, 4);
  const _cardBg = c.hero || CASE_HERO_BG[caseId] || ((c.photos && c.photos[0]) ? (c.photos[0].src || c.photos[0].url) : '');
  const card = document.createElement('article');
  card.className = 'featured-card';
  card.dataset.caseId = caseId;
  if (indKey) card.dataset.industry = indKey;
  card.innerHTML = `
    <div class="fc-media">${_cardBg ? `<img class="fc-img" src="${_cardBg}" alt="${c.name}" loading="lazy" style="object-position:${CASE_HERO_POS[caseId]||'center'}" onerror="this.remove();">` : ''}</div>
    <div class="fc-body">
      <div class="num">CASE / ${num}</div>
      <div class="logo">${c.name}</div>
      <span class="tag ${tagClass}"${tagStyle}>${tagLabel}</span>
      <h3 class="headline">${headline}</h3>
      <ul class="app-list">
        ${apps.map(a => `<li>${a}</li>`).join('')}
      </ul>
      <a href="#" class="cta-link">자세히 보기</a>
    </div>
  `;
  card.addEventListener('click', e => { e.preventDefault(); if (CASE_DATA[caseId]) navigate('case/' + caseId); });
  featuredGrid.appendChild(card);
});
const _fm = document.getElementById('featuredMeta');
if (_fm) _fm.textContent = 'Featured Case Studies — ' + String(featuredCases.length).padStart(2,'0');

const filterBar = document.getElementById('filterBar');
const counts = { all: CUSTOMERS.length };
CUSTOMERS.forEach(c => { counts[c.i] = (counts[c.i] || 0) + 1; });

filterBar.insertAdjacentHTML('beforeend',
  `<button class="filter-btn active" data-filter="all">전체 <span class="filter-count">${counts.all}</span></button>`
);
Object.entries(INDUSTRIES).forEach(([key, info]) => {
  if (!counts[key]) return;
  filterBar.insertAdjacentHTML('beforeend',
    `<button class="filter-btn" data-filter="${key}">${info.label} <span class="filter-count">${counts[key]}</span></button>`
  );
});

const cardsGrid = document.getElementById('cardsGrid');
{ const _tc = document.getElementById('totalCount'); if (_tc) _tc.textContent = CUSTOMERS.length; }
CUSTOMERS.forEach(c => {
  const ind = INDUSTRIES[c.i];
  const caseKey = (c.key || c.n.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
  const hasCase = !!CASE_DATA[caseKey];
  const inst = (c.install || '').trim();
  const hasInstall = !!inst;
  const isClickable = hasCase || hasInstall;
  const instUrl = hasInstall ? ('installation-photos.html?client=' + encodeURIComponent(inst)) : '';
  const card = document.createElement('article');
  card.className = 'case-card' + (isClickable ? ' clickable' : '');
  card.dataset.industry = c.i;
  card.dataset.name = c.n;
  card.innerHTML = `
    <div class="logo">${c.n}</div>
    <span class="tag ${ind.tag}">${ind.label}</span>
    <div class="headline">${c.h}</div>
    <ul class="apps">
      ${c.a.map(app => `<li>${app}</li>`).join('')}
    </ul>
    ${hasInstall ? `<a class="case-install-link" href="${instUrl}"><svg class="cil-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.3" r="1.7"/><path d="M20.5 16.5 15 11l-7 7"/></svg><span class="cil-tx">설치 사진</span><span class="cil-arrow">&rarr;</span></a>` : ''}
  `;
  if (hasCase) {
    card.addEventListener('click', (e) => { if (e.target.closest('.case-install-link')) return; navigate('case/' + caseKey); });
  } else if (hasInstall) {
    card.addEventListener('click', (e) => { if (e.target.closest('.case-install-link')) return; window.location.href = instUrl; });
  }
  cardsGrid.appendChild(card);
});

bindOnce(filterBar, 'click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  document.querySelectorAll('.case-card').forEach(card => {
    const show = (filter === 'all') || card.dataset.industry === filter;
    card.classList.toggle('hidden', !show);
  });
});


/* ========== AWARDS VIEW ========== */
const byYear = {};
AWARDS.forEach(a => { (byYear[a.y] = byYear[a.y] || []).push(a); });
const yearsList = Object.keys(byYear).map(Number).sort((a,b) => b-a);
const maxCount = Math.max(...yearsList.map(y => byYear[y].length));
const awardCategories = Object.keys(CATEGORY_LABELS);

// ===== AWARD STATISTICS — category distribution =====
const awardCatBarsEl = document.getElementById('awardCatBars');
if (awardCatBarsEl) {
  const catCount = {};
  awardCategories.forEach(c => { catCount[c] = 0; });
  AWARDS.forEach(a => { catCount[a.c] = (catCount[a.c] || 0) + 1; });
  const ranked = awardCategories.slice().sort((a, b) => catCount[b] - catCount[a]);
  const maxCat = Math.max(...ranked.map(c => catCount[c])) || 1;
  ranked.forEach(c => {
    const n = catCount[c];
    const pct = Math.round((n / maxCat) * 100);
    awardCatBarsEl.insertAdjacentHTML('beforeend', `
      <div class="astat-bar" style="--cat-color: var(--tag-${c}-fg);">
        <span class="ab-label">${CATEGORY_LABELS[c]}</span>
        <span class="ab-track"><span class="ab-fill" style="width:${pct}%;"></span></span>
        <span class="ab-num">${n}</span>
      </div>
    `);
  });
}

const yearChips = document.getElementById('yearChips');
yearChips.insertAdjacentHTML('beforeend', `<button class="chip active" data-year="all">All</button>`);
yearsList.forEach(y => {
  yearChips.insertAdjacentHTML('beforeend', `<button class="chip" data-year="${y}">${y}</button>`);
});

const catChips = document.getElementById('catChips');
catChips.insertAdjacentHTML('beforeend', `<button class="chip active" data-cat="all">All</button>`);
awardCategories.forEach(c => {
  catChips.insertAdjacentHTML('beforeend', `<button class="chip" data-cat="${c}">${CATEGORY_LABELS[c]}</button>`);
});

const awardsList = document.getElementById('awardsList');
[...AWARDS].sort((a,b) => b.y - a.y).forEach(a => {
  const noteHtml = a.note ? `<span class="note">· ${a.note}</span>` : '';
  awardsList.insertAdjacentHTML('beforeend', `
    <li class="award" data-year="${a.y}" data-cat="${a.c}">
      <a class="award-link" href="${a.url || 'https://www.monnit.com/awards/'}" target="_blank" rel="noopener">
        <span class="award-year">${a.y}</span>
        <span class="award-dot dot-${a.c}"></span>
        <span class="award-name">${a.n}${noteHtml}<span class="award-more">자세히 보기 →</span></span>
        <span class="tag tag-${a.c}">${CATEGORY_LABELS[a.c]}</span>
      </a>
    </li>
  `);
});

let currentYear = 'all';
let currentCat = 'all';

function applyAwardsFilter() {
  let visible = 0;
  document.querySelectorAll('.award').forEach(el => {
    const matchYear = currentYear === 'all' || el.dataset.year === currentYear;
    const matchCat = currentCat === 'all' || el.dataset.cat === currentCat;
    const show = matchYear && matchCat;
    el.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('visibleCountAwards').textContent = `${visible} of ${AWARDS.length} awards`;
  document.getElementById('emptyAwards').style.display = visible === 0 ? 'block' : 'none';

  document.querySelectorAll('.dist-row').forEach(row => {
    row.classList.toggle('active', currentCat !== 'all' && row.dataset.cat === currentCat);
  });
}

bindOnce(yearChips, 'click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#yearChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentYear = btn.dataset.year;
  applyAwardsFilter();
});

bindOnce(catChips, 'click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentCat = btn.dataset.cat;
  applyAwardsFilter();
});

applyAwardsFilter();

/* ========== PARTNERS VIEW ========== */
const byRegion = {};
PARTNERS.forEach(p => { (byRegion[p.r] = byRegion[p.r] || []).push(p); });
const regions = ["na","as","eu","sa","oc","af"];

const regionChips = document.getElementById('regionChips');
regionChips.insertAdjacentHTML('beforeend', `<button class="chip active" data-region="all">All <span class="ct">${PARTNERS.length}</span></button>`);
regions.forEach(r => {
  const ct = (byRegion[r] || []).length;
  if (!ct) return;
  regionChips.insertAdjacentHTML('beforeend',
    `<button class="chip" data-region="${r}">${REGION_LABELS[r]} <span class="ct">${ct}</span></button>`
  );
});

const partnersList = document.getElementById('partnersList');
const orderedPartners = regions.flatMap(r => byRegion[r] || []);
orderedPartners.forEach(p => {
  partnersList.insertAdjacentHTML('beforeend', `
    <li class="partner" data-region="${p.r}">
      <a class="partner-link" href="${p.url || 'https://www.monnit.com/partner/current-partners/'}" target="_blank" rel="noopener">
        <span class="partner-dot dot-${p.r}"></span>
        <div class="partner-body">
          <span class="partner-name">${p.n}<span class="partner-more">사이트 방문 →</span></span>
          <span class="partner-desc">${p.d}</span>
        </div>
        <span class="tag tag-${p.r}">${REGION_LABELS[p.r]}</span>
      </a>
    </li>
  `);
});

let currentRegion = 'all';
const resetBtn = document.getElementById('resetBtn');

/* Build region cards (replaces the old world map) */
const REGION_COLORS = { na:'#85B6FF', sa:'#5FDDA0', eu:'#EBC062', as:'#FF9E78', af:'#CFBE9C', oc:'#F08FBE' };
const REGION_KO = { na:'북미', sa:'남미', eu:'유럽', as:'아시아', af:'아프리카', oc:'오세아니아' };
const regionGrid = document.getElementById('worldMap');
const REGION_PATHS = {"na": "M158.8 97.2L153.0 94.5L146.0 92.1L144.9 88.0L140.8 84.6L137.4 81.1L138.9 79.8L134.1 76.2L129.6 71.1L125.2 68.7L120.9 68.2L115.7 67.9L111.1 65.9L108.4 50.0L108.4 39.7L117.9 41.7L123.3 40.8L130.8 40.3L139.5 38.4L143.4 38.9L146.0 37.8L154.4 38.4L158.2 40.1L162.6 39.5L173.3 41.6L179.9 41.9L179.7 44.7L192.2 45.0L197.6 46.2L197.7 43.6L202.9 42.5L207.4 42.9L213.3 44.2L222.5 45.0L226.2 43.3L233.0 43.8L234.8 44.2L238.2 41.5L232.0 38.6L235.5 33.6L242.0 35.2L243.3 39.7L248.5 43.1L255.5 42.7L257.4 46.7L262.3 42.3L266.4 39.4L274.2 41.2L272.3 44.1L273.9 46.9L264.6 49.3L260.9 49.8L257.4 53.4L250.2 55.5L247.9 58.4L241.2 61.0L237.1 66.4L241.1 70.0L243.6 74.8L252.7 75.4L257.4 77.8L263.9 79.7L271.5 80.1L271.9 85.3L278.0 91.1L281.7 87.3L278.3 81.5L285.8 78.2L287.2 74.4L281.9 70.0L284.0 64.6L285.0 59.6L292.6 60.6L297.5 60.8L301.7 63.5L306.6 66.1L310.1 70.0L316.1 70.1L320.6 65.7L326.4 71.8L328.3 76.8L334.5 80.0L340.7 81.6L344.0 84.3L345.3 88.5L341.3 90.5L333.2 93.8L322.6 93.6L315.6 93.8L309.7 97.0L302.5 103.3L309.3 99.2L319.3 96.6L319.1 99.8L320.9 104.9L329.1 105.9L332.1 104.8L330.4 107.6L321.5 110.4L316.3 112.2L321.0 107.5L313.5 108.0L311.7 102.6L308.6 102.3L305.6 103.6L303.7 107.1L301.7 107.6L296.3 108.3L290.8 108.8L287.5 111.1L284.1 112.1L280.1 112.6L280.8 114.0L277.1 115.6L271.0 117.6L269.4 117.1L269.1 116.4L271.0 113.9L271.3 109.9L267.8 106.1L267.7 105.2L266.4 104.8L265.7 104.4L265.2 104.1L264.2 103.1L259.8 101.2L254.5 99.2L251.1 100.0L245.4 99.6L239.9 98.3L237.1 97.7L235.7 96.2L229.9 97.2L211.0 97.2L194.3 97.2L177.6 97.2L166.7 97.2Z M266.7 59.9L268.7 58.6L272.6 58.6L272.5 59.1L269.3 60.7L267.3 60.6L266.7 59.9Z M278.4 31.1L275.3 29.6L275.5 28.6L276.8 28.4L283.2 28.7L287.9 30.3L288.2 31.0L285.2 31.0L282.2 30.9L279.2 31.3L278.4 31.1Z M276.9 60.9L278.0 60.0L279.1 60.1L279.8 60.7L278.7 62.1L277.5 61.9L276.8 61.1L276.9 60.9Z M240.0 25.1L238.5 26.1L234.4 25.9L231.1 25.2L232.5 24.0L236.5 23.2L239.0 24.2L240.0 25.1Z M239.3 18.0L238.1 18.1L232.9 17.9L232.1 17.1L237.7 17.2L239.7 17.7L239.3 18.0Z M231.2 14.5L234.6 15.5L233.8 16.5L229.7 17.1L227.4 16.4L226.2 15.4L226.0 14.2L229.6 14.4L231.2 14.5Z M255.1 26.7L250.7 26.3L243.3 25.5L242.3 23.9L242.0 22.5L239.2 21.3L233.4 21.0L230.2 20.1L231.3 19.0L237.0 19.2L240.1 20.1L245.5 20.1L247.9 21.0L247.3 22.0L250.5 22.6L252.3 23.3L256.0 23.4L260.1 23.7L264.5 23.1L270.1 22.8L274.6 23.0L277.6 24.1L278.2 25.2L276.5 26.0L272.4 26.5L268.8 26.2L260.8 26.6L255.1 26.7Z M190.9 16.2L194.8 16.7L193.9 17.5L188.7 18.3L184.6 17.4L186.9 16.5L190.9 16.2Z M191.8 14.4L195.4 15.0L192.0 15.5L187.4 15.5L187.4 15.1L190.3 14.3L191.8 14.4Z M345.6 90.8L344.1 92.5L342.2 95.0L344.0 94.0L345.9 94.6L344.9 95.6L347.4 96.4L348.7 95.7L351.5 96.5L350.6 98.6L352.5 98.1L352.9 99.6L353.8 101.3L352.6 103.7L351.3 103.8L349.5 103.3L350.1 101.0L349.3 100.7L346.1 103.1L344.5 103.0L346.4 101.7L343.7 101.0L340.8 101.2L335.4 101.1L334.9 100.3L336.7 99.3L335.5 98.5L337.8 96.9L340.7 92.4L342.4 90.9L344.8 89.9L346.1 90.0L345.6 90.8Z M267.0 52.5L270.0 53.4L273.2 54.3L273.5 55.6L275.5 55.4L277.5 56.3L275.0 57.2L270.7 56.5L269.1 55.3L266.4 56.8L262.4 58.2L261.5 56.6L257.7 56.8L260.1 55.5L260.5 53.3L261.4 50.7L263.4 51.0L264.0 52.2L265.4 51.7L267.0 52.5Z M281.2 32.4L283.8 31.3L290.0 32.7L293.8 34.0L294.2 35.2L299.3 34.6L302.2 36.3L308.9 37.4L311.3 38.6L314.0 41.1L308.9 42.4L315.4 44.3L319.8 44.9L323.8 47.4L328.2 47.6L327.3 49.6L322.4 52.8L319.0 51.6L314.7 48.9L311.1 49.3L310.7 50.9L313.6 52.5L317.4 53.8L318.6 54.5L320.4 57.2L319.4 59.2L315.9 58.5L308.9 56.3L312.9 58.7L315.8 60.3L316.2 61.3L308.7 60.2L302.7 58.6L299.3 57.2L300.3 56.4L296.2 55.0L292.1 53.7L292.2 54.5L284.1 54.9L281.8 54.0L283.6 51.9L288.8 51.9L294.6 51.5L293.6 50.5L294.6 49.1L298.2 46.4L297.4 45.2L296.4 44.3L292.1 42.9L286.5 42.0L288.3 41.3L285.3 39.5L282.9 39.4L280.7 38.4L279.2 39.2L274.2 39.6L264.0 39.0L258.2 38.2L253.7 37.7L251.4 36.8L254.3 35.5L250.3 35.5L249.4 32.7L251.6 30.2L254.4 29.1L261.6 28.3L259.5 30.1L261.7 31.8L264.3 29.6L271.3 28.5L276.1 31.3L275.7 33.2L281.2 32.4Z M237.5 27.4L243.3 27.5L248.6 28.2L244.4 30.6L241.1 31.2L238.1 33.3L235.0 33.2L233.2 30.7L233.3 29.3L234.7 28.2L237.5 27.4Z M158.7 21.9L158.7 21.9L163.5 19.8L169.2 18.0L173.4 18.1L177.2 17.7L176.8 19.8L174.7 20.7L172.1 20.9L166.9 22.1L162.5 22.5L158.7 21.9Z M131.4 83.2L134.0 83.0L133.2 86.2L135.6 88.4L134.5 88.4L132.8 87.1L131.8 85.8L130.4 85.0L129.9 83.7L130.1 82.9L131.4 83.2Z M207.0 13.1L212.4 13.4L219.9 14.4L222.1 15.8L223.1 16.9L218.6 16.6L214.0 15.7L207.8 15.6L210.5 14.8L207.2 14.1L207.0 13.1Z M156.9 98.6L155.5 99.0L151.0 97.7L150.1 96.7L147.6 95.8L147.1 95.0L144.3 94.5L143.2 92.9L143.4 92.3L146.4 92.9L148.1 93.3L150.7 93.6L151.6 94.6L153.0 95.9L155.8 97.0L156.9 98.6Z M162.4 26.5L166.4 27.1L173.5 27.3L176.2 28.1L179.1 29.2L175.6 29.9L168.8 31.9L165.4 33.8L165.4 35.0L158.1 36.4L156.6 35.2L150.2 33.7L151.4 32.5L153.3 30.5L155.7 28.7L153.0 27.0L162.4 26.5Z M200.5 22.7L203.0 22.2L205.9 22.3L206.4 23.7L204.7 25.0L195.3 25.4L188.3 26.6L184.0 26.7L183.7 25.8L189.5 24.5L176.9 24.9L173.0 24.4L176.8 21.7L179.4 20.9L187.2 21.8L192.2 23.5L197.0 23.7L193.1 21.0L195.6 20.0L198.5 20.3L199.4 21.7L200.5 22.7Z M204.1 30.3L207.2 31.5L209.0 34.2L209.8 36.1L214.5 37.5L219.5 38.8L219.2 40.0L214.6 40.3L216.4 41.3L215.5 42.4L210.4 41.9L205.7 41.2L202.4 41.3L197.2 42.3L190.2 42.7L185.2 43.0L183.7 41.6L179.9 40.9L177.5 41.2L174.1 39.0L175.9 38.7L180.2 38.2L184.1 38.4L187.7 37.9L182.4 37.2L176.4 37.4L172.5 37.4L171.0 36.4L177.5 35.3L173.2 35.3L168.3 34.6L170.7 32.5L172.6 31.4L180.0 29.7L182.9 30.2L181.5 31.5L187.7 30.7L191.5 32.1L194.7 30.7L197.2 31.6L199.5 34.3L200.9 33.2L198.9 30.3L201.3 29.9L204.1 30.3Z M221.0 31.4L217.9 29.6L221.2 28.2L224.5 28.8L229.5 28.4L230.2 29.3L227.6 30.6L231.8 31.8L231.3 34.3L226.8 35.4L224.1 35.1L222.2 34.1L215.3 31.9L215.3 31.0L221.0 31.4Z M203.9 28.9L207.6 28.8L209.7 29.4L207.3 31.2L202.9 29.3L203.9 28.9Z M226.4 20.2L228.5 21.5L228.6 22.9L227.3 25.0L222.8 25.3L219.8 24.8L219.8 23.2L215.3 23.4L215.1 21.3L218.1 21.4L222.3 20.4L226.2 20.6L226.4 20.2Z M233.3 9.4L235.2 8.6L238.1 8.4L236.8 7.8L243.3 7.6L246.9 9.1L251.5 9.7L256.1 10.2L258.3 12.1L261.6 13.0L257.8 13.8L252.7 15.9L247.8 16.1L242.0 15.7L239.0 14.6L239.1 13.6L241.3 12.8L236.2 12.9L233.1 11.9L231.4 10.7L233.3 9.4Z M245.6 5.8L249.7 5.3L253.0 5.2L258.4 4.8L262.5 3.7L265.9 3.9L268.9 4.7L271.1 3.2L274.7 2.7L279.7 2.4L288.2 2.3L289.7 2.6L297.7 2.1L303.7 2.3L309.7 2.5L317.1 2.7L323.1 3.1L328.2 3.8L328.1 4.6L321.3 5.8L314.6 6.3L312.1 6.9L318.1 6.9L311.6 8.6L307.0 9.4L302.3 11.7L296.5 12.1L294.8 12.7L286.4 13.0L290.2 13.3L288.3 13.8L290.6 15.2L287.9 16.2L283.6 16.9L282.3 18.0L278.4 18.9L278.8 19.5L283.6 19.4L283.6 20.1L276.2 21.7L269.0 21.0L260.8 21.4L256.7 21.1L251.4 20.9L251.1 19.6L256.2 18.9L254.8 16.9L256.5 16.7L264.0 17.9L260.2 16.2L255.7 15.6L257.9 14.6L262.8 13.9L263.6 12.9L259.7 11.8L258.5 10.4L266.1 10.5L268.3 10.8L272.6 9.8L266.4 9.5L256.7 9.7L251.8 8.7L249.4 7.6L246.2 6.8L245.6 5.8Z M291.1 46.0L289.3 46.8L286.1 46.9L285.5 45.6L286.6 44.0L289.2 43.6L291.3 44.4L291.4 45.6L291.1 46.0Z M232.6 40.3L234.3 41.4L232.6 42.3L228.8 41.5L226.6 41.8L222.8 40.6L225.2 39.7L227.2 38.5L230.1 39.3L231.8 39.8L232.6 40.3Z M320.8 94.8L321.7 94.6L325.4 95.3L328.2 96.4L328.3 96.9L327.0 97.0L323.4 96.1L320.8 94.8Z M322.2 102.7L323.2 104.0L325.2 104.4L327.7 104.3L326.4 105.5L325.3 105.6L321.8 104.5L321.1 103.5L322.2 102.7Z M158.8 97.2L174.9 97.2L186.1 97.2L202.6 97.2L220.4 97.2L235.7 97.2L236.6 96.1L238.0 98.1L242.8 98.7L247.7 99.2L252.0 99.9L257.1 100.2L262.1 102.2L264.5 103.8L265.0 104.3L266.3 104.1L267.0 105.2L268.1 105.6L270.7 107.4L271.8 112.3L269.7 115.5L269.1 116.7L270.3 117.6L274.2 116.1L280.7 114.3L280.5 113.1L281.3 112.2L286.6 112.1L287.8 110.8L292.0 108.3L301.4 108.3L302.5 107.5L304.7 105.8L307.7 101.5L310.5 101.8L311.7 106.4L314.0 108.9L308.2 111.2L303.8 113.6L303.3 115.7L305.3 117.3L305.9 116.9L303.8 118.1L300.4 118.6L297.6 118.8L299.3 119.1L296.3 120.5L294.6 120.1L294.5 121.0L291.9 125.2L291.1 124.3L290.8 125.1L291.5 126.7L289.1 130.0L289.7 128.0L287.9 124.6L288.0 127.5L288.1 128.0L289.0 130.8L289.6 134.6L285.0 137.5L281.8 139.3L280.0 141.2L275.4 144.4L273.6 148.0L275.1 152.3L276.3 155.4L277.5 160.5L276.7 163.3L274.5 163.3L273.0 161.5L270.3 157.0L270.4 154.0L267.5 150.2L263.6 151.0L261.7 149.6L256.9 149.2L252.3 149.1L251.6 150.3L252.2 152.0L250.6 151.9L247.6 152.4L243.1 151.2L239.3 150.8L234.4 153.5L230.2 156.0L229.5 159.2L230.2 161.5L227.1 160.9L224.2 158.8L221.9 155.3L219.6 151.7L215.3 150.7L211.3 152.0L209.2 149.7L206.6 147.0L204.1 145.1L199.3 146.3L191.6 146.3L181.1 143.0L177.8 142.7L174.2 141.5L171.1 139.6L169.2 138.7L165.6 137.6L164.6 135.7L159.6 129.0L158.5 127.5L155.9 122.9L155.1 119.0L154.1 114.5L155.5 109.4L155.3 103.2L153.6 99.5L158.0 99.9L160.2 101.8L158.8 97.2Z M68.3 177.6L68.8 177.8L69.3 178.2L70.0 179.1L69.9 179.3L68.8 179.9L67.9 180.3L67.5 180.8L66.8 180.4L66.9 179.6L66.5 178.6L66.6 178.3L67.1 177.8L66.9 177.3L67.1 177.0L67.3 177.1L68.3 177.6Z M66.7 175.7L66.4 176.0L65.5 176.2L65.0 175.6L64.7 175.4L64.7 175.2L65.0 175.0L66.0 175.2L66.7 175.7Z M61.0 173.0L61.3 173.2L62.1 174.1L61.9 174.3L61.7 174.2L60.8 174.1L60.4 173.5L60.3 173.4L61.0 173.0Z M57.3 171.6L57.4 172.3L57.0 172.5L56.1 172.0L56.3 171.8L56.7 171.6L57.3 171.6Z M37.6 65.6L39.8 65.9L40.1 66.9L38.4 67.3L36.5 66.8L34.8 66.1L37.6 65.6Z M74.4 72.3L76.2 72.5L77.4 73.4L75.0 74.7L72.2 75.7L70.8 75.0L70.4 73.7L72.9 72.7L74.4 72.3Z M108.4 39.7L108.4 50.0L111.1 65.9L115.7 67.9L120.9 68.2L125.2 68.7L129.6 71.1L134.1 76.2L138.9 79.8L137.4 81.1L135.9 80.1L132.6 76.8L127.6 71.9L120.5 71.6L111.5 68.0L104.0 66.4L94.7 65.4L88.3 64.8L87.3 66.9L81.6 68.4L78.2 67.4L82.4 63.8L78.1 64.6L72.2 68.5L71.6 71.8L65.8 73.8L60.8 76.5L56.7 79.0L52.2 79.5L47.0 81.4L41.8 81.7L47.6 79.6L54.0 77.8L59.2 75.0L61.9 73.4L63.8 69.7L59.7 70.0L56.4 69.6L54.6 69.2L50.1 70.4L50.3 67.7L44.9 67.2L40.7 65.3L38.6 62.5L41.9 59.4L45.1 57.7L49.3 56.8L53.4 56.2L51.3 54.4L51.7 53.4L47.9 54.6L41.8 54.3L36.5 52.5L36.9 49.8L45.4 48.4L50.9 49.7L45.2 46.9L40.6 44.3L38.3 42.0L46.8 40.6L50.3 38.0L58.2 36.4L65.1 35.1L71.3 37.0L77.2 36.6L81.3 37.7L90.0 38.3L97.4 38.9L105.4 39.3L108.4 39.7Z M23.0 56.2L24.7 56.7L26.4 56.4L28.7 57.1L31.4 57.5L31.2 57.8L29.1 58.4L27.0 57.8L25.9 57.3L23.5 57.5L22.8 57.2L23.0 56.2Z M300.8 178.6L301.0 180.1L300.8 181.2L300.2 181.6L300.9 182.5L300.8 183.2L299.0 182.7L297.7 182.9L296.0 182.7L294.7 183.2L293.2 182.4L293.4 181.5L296.0 181.9L298.1 182.1L299.1 181.5L297.8 180.3L297.8 179.2L296.1 178.8L296.7 178.0L298.4 178.1L300.8 178.6Z M300.8 183.2L300.9 182.5L300.2 181.6L300.8 181.2L301.0 180.1L300.8 178.6L301.1 178.1L303.3 178.1L305.0 178.8L305.7 178.8L306.2 179.7L307.7 179.7L307.6 180.5L308.9 180.6L310.2 181.6L309.2 182.8L307.9 182.2L306.6 182.3L305.7 182.1L305.2 182.7L304.1 182.8L303.7 182.1L302.8 182.5L301.7 184.4L301.0 184.0L300.8 183.2Z M280.6 158.9L281.9 158.7L283.8 158.8L283.8 159.5L280.8 159.9L280.6 158.9Z M283.9 158.2L286.1 159.5L285.6 161.4L285.1 161.1L285.2 159.6L283.9 158.5L283.9 158.2Z M282.8 163.3L283.6 163.4L284.6 165.7L284.6 167.3L283.9 167.5L283.2 165.9L282.2 165.1L282.8 163.3Z M370.1 3.8L389.2 2.3L402.5 1.0L442.1 3.5L426.3 4.7L412.8 5.5L431.0 6.1L438.7 6.3L442.7 6.9L464.5 6.3L454.8 9.5L444.3 10.6L447.5 12.8L445.4 17.7L444.3 19.6L444.9 21.9L442.6 24.6L440.0 27.2L442.3 29.3L434.5 29.7L438.1 32.8L431.1 32.4L438.5 34.8L434.6 37.6L429.0 34.9L426.8 38.3L437.9 38.5L422.9 43.1L411.7 44.1L405.0 48.1L397.1 50.2L389.4 51.5L387.0 55.2L381.1 59.2L380.9 63.7L375.6 66.6L365.9 64.3L361.4 60.0L355.2 54.8L350.9 49.7L350.1 46.7L357.0 42.4L358.7 39.1L354.0 40.5L348.1 40.0L349.0 36.6L357.2 37.3L350.0 34.6L344.9 34.3L346.3 30.7L340.8 25.8L337.3 23.6L323.9 21.7L309.7 22.1L301.7 19.4L314.5 18.4L296.4 16.5L307.3 14.1L318.5 11.8L313.5 9.7L327.1 7.4L332.5 5.5L349.6 5.0L360.0 4.3L370.6 5.6L369.7 5.0Z M174.6 143.0L181.3 142.4L185.3 144.3L197.1 146.3L199.3 145.1L205.2 146.1L208.2 148.2L209.8 151.2L213.6 152.9L217.6 150.6L221.0 153.6L223.6 156.8L224.9 160.1L229.1 161.6L229.1 163.9L228.4 169.6L228.6 172.5L230.0 176.0L232.5 179.7L236.6 181.8L240.1 182.2L244.3 181.4L247.9 179.8L248.7 175.8L251.1 174.3L256.5 173.7L258.9 174.1L257.3 177.1L257.1 179.2L256.0 182.6L254.7 181.9L253.2 183.7L252.4 183.5L249.8 183.8L247.2 185.4L247.0 186.3L248.3 187.6L248.7 188.7L243.8 191.0L243.9 192.1L240.7 190.0L237.0 188.3L233.2 189.6L229.8 189.1L225.1 187.3L219.9 185.6L216.9 183.6L212.5 182.5L208.4 179.7L206.3 176.6L206.9 175.5L207.6 173.8L206.4 171.5L203.0 167.3L198.9 163.4L196.0 161.6L195.0 159.2L192.7 155.9L189.6 154.3L188.1 152.0L185.7 147.8L183.7 145.6L181.2 145.0L181.2 147.5L182.4 150.7L184.9 153.3L185.7 154.4L186.8 156.2L188.2 157.9L190.9 161.9L192.5 164.4L194.0 165.9L196.1 168.4L194.8 169.9L193.6 168.2L189.8 165.3L188.5 162.6L186.7 160.2L184.5 159.3L182.0 157.9L180.6 156.1L182.8 155.2L180.7 152.0L178.1 149.5L175.8 145.5Z M285.1 209.2L284.8 209.7L285.4 211.3L284.9 212.1L284.0 211.9L283.7 213.3L282.7 212.5L282.1 211.0L282.8 210.2L282.1 210.0L281.6 209.1L280.2 208.3L279.0 208.5L278.4 209.5L277.3 210.2L276.7 210.3L276.4 210.9L277.8 212.4L277.0 212.7L276.6 213.1L275.3 213.3L274.8 211.6L274.5 212.1L273.6 211.9L273.0 210.8L271.9 210.6L271.1 210.3L269.9 210.3L269.9 210.9L269.5 210.5L269.7 209.9L269.9 209.4L269.8 208.9L270.2 208.5L269.6 208.1L269.6 207.0L270.7 206.8L271.7 207.8L271.6 208.3L272.8 208.5L273.0 208.2L273.8 208.9L275.1 208.7L276.3 208.0L278.0 207.5L279.0 206.6L280.5 206.8L280.4 207.1L281.9 207.2L283.2 207.6L284.1 208.5L285.1 209.2Z M270.7 206.8L269.6 207.0L269.6 208.1L270.2 208.5L269.8 208.9L269.9 209.4L269.7 209.9L269.5 210.5L268.0 209.9L267.5 209.3L267.8 208.8L267.7 208.2L266.9 207.5L265.8 207.0L264.9 206.6L264.7 205.8L264.0 205.3L264.1 206.1L263.6 206.8L262.9 206.0L262.1 205.7L261.7 205.2L261.7 204.3L262.1 203.5L261.3 203.1L261.9 202.5L262.3 202.2L264.2 202.9L264.8 202.5L265.7 202.8L266.1 203.4L267.0 203.5L267.6 202.9L268.3 204.5L269.4 205.6L270.7 206.8Z M267.6 202.9L267.0 203.5L266.1 203.4L265.7 202.8L264.8 202.5L264.2 202.9L262.3 202.2L261.9 202.5L260.9 201.7L259.7 200.5L259.0 199.6L257.9 198.7L256.5 197.5L256.8 197.0L257.2 197.5L257.5 197.3L258.3 197.2L258.7 196.5L259.1 196.5L259.0 195.1L259.7 195.1L260.2 195.1L260.8 194.3L261.7 194.9L261.9 194.6L262.5 194.2L263.4 193.5L263.5 192.9L263.7 192.9L264.1 192.2L264.4 192.2L264.9 192.6L265.4 192.7L266.0 192.4L266.7 192.4L267.7 192.0L268.1 191.6L269.0 191.7L268.8 191.9L268.7 192.6L268.9 193.6L268.3 194.5L268.0 195.6L267.9 196.9L268.1 197.6L268.1 198.8L267.7 199.1L267.4 200.3L267.6 201.0L267.1 201.7L267.2 202.5L267.6 202.9Z M269.0 191.7L268.1 191.6L267.7 192.0L266.7 192.4L266.0 192.4L265.4 192.7L264.9 192.6L264.4 192.2L264.1 192.2L263.7 192.9L263.5 192.9L263.4 193.5L262.5 194.2L261.9 194.6L261.7 194.9L260.8 194.3L260.2 195.1L259.7 195.1L259.0 195.1L259.1 196.5L258.7 196.5L258.3 197.2L257.5 197.3L257.0 196.4L256.1 196.2L256.3 195.0L255.9 194.7L255.4 194.5L254.2 194.9L254.1 194.5L253.2 194.1L252.6 193.5L251.8 193.3L252.4 192.6L252.2 192.0L252.3 191.5L253.7 190.7L254.9 189.6L255.2 189.8L255.8 189.3L256.6 189.2L256.9 189.5L257.3 189.3L258.6 189.6L259.9 189.5L260.8 189.2L261.1 188.9L262.0 189.0L262.7 189.2L263.4 189.1L263.9 188.9L265.2 189.3L265.6 189.3L266.5 189.9L267.3 190.5L268.3 190.9L269.0 191.7Z M251.8 193.3L252.6 193.5L253.2 194.1L254.1 194.5L254.2 194.9L255.4 194.5L255.9 194.7L256.3 195.0L256.1 196.2L255.8 196.8L254.2 196.8L253.2 196.5L252.1 195.9L250.5 195.8L249.7 195.2L249.8 194.8L250.8 194.1L251.3 193.8L251.1 193.4L251.8 193.3Z M243.8 192.9L243.9 192.1L244.2 191.5L243.8 191.0L245.1 188.7L248.7 188.7L248.8 187.7L248.3 187.6L248.0 187.0L247.0 186.3L246.0 185.4L247.2 185.4L247.2 183.8L249.8 183.8L252.4 183.9L252.4 186.1L252.1 189.2L253.0 189.2L253.9 189.7L254.1 189.3L254.9 189.6L253.7 190.7L252.3 191.5L252.2 192.0L252.4 192.6L251.8 193.3L251.1 193.4L251.3 193.8L250.8 194.1L249.8 194.8L249.7 195.2L248.3 194.7L246.6 194.6L245.3 194.1L243.8 192.9Z M252.4 183.9L252.4 183.5L252.7 183.3L253.2 183.7L254.2 182.0L254.7 181.9L254.7 182.4L255.3 182.4L255.2 183.1L254.8 184.3L255.0 184.8L254.7 185.7L254.9 186.0L254.6 187.4L254.0 188.2L253.5 188.2L253.0 189.2L252.1 189.2L252.4 186.1L252.4 183.9Z M315.9 181.9L317.3 182.1L317.8 182.7L317.1 183.4L315.0 183.4L313.4 183.5L313.2 182.3L313.6 181.9L315.9 181.9Z M284.5 182.0L286.4 182.2L287.9 182.9L288.3 183.6L286.4 183.7L285.5 184.2L284.0 183.7L282.4 182.7L282.7 182.1L283.9 181.9L284.5 182.0Z M271.5 168.9L273.9 169.1L276.1 169.2L278.7 170.1L279.8 171.1L282.4 170.8L283.4 171.5L285.7 173.2L287.4 174.4L288.3 174.4L290.0 175.0L289.8 175.7L291.9 175.9L293.9 177.0L293.6 177.6L291.8 178.0L289.9 178.1L288.0 177.9L284.0 178.2L285.9 176.6L284.7 175.9L283.0 175.7L282.0 174.9L281.3 173.3L279.8 173.4L277.2 172.7L276.3 172.1L272.7 171.7L271.8 171.1L272.8 170.5L270.1 170.3L268.1 171.8L266.9 171.8L266.5 172.5L265.1 172.8L264.0 172.5L265.4 171.7L266.0 170.7L267.3 170.0L268.7 169.5L270.8 169.2L271.5 168.9Z M328.7 203.4L330.3 203.1L330.8 203.2L330.7 205.3L328.4 205.6L327.9 205.3L328.7 204.5L328.7 203.4Z", "sa": "M309.3 379.5L310.4 380.8L311.8 382.9L315.4 384.6L319.3 385.3L318.1 386.7L315.4 386.8L314.0 385.8L312.3 385.8L309.4 385.7L309.3 379.5Z M339.9 317.3L338.5 322.3L337.9 325.7L337.5 329.0L340.7 333.3L342.3 335.8L335.5 340.9L326.8 341.2L326.9 344.9L325.7 347.3L320.2 346.7L319.5 350.2L322.9 350.1L321.2 352.4L318.5 356.9L315.3 358.4L312.3 361.9L317.7 364.5L313.4 368.6L309.1 373.0L308.8 377.1L309.5 378.6L300.2 377.8L299.1 374.1L296.3 373.3L298.2 369.1L298.8 365.9L301.2 359.9L302.2 357.7L300.6 356.1L300.2 353.9L300.7 350.1L300.9 343.9L303.3 340.4L302.4 335.2L304.5 331.0L306.1 325.8L304.1 320.5L305.5 314.9L308.3 309.8L309.5 307.0L310.0 301.4L313.9 297.2L315.9 294.0L321.2 296.7L325.4 294.5L331.0 299.7L336.6 302.1L339.9 304.5L340.0 309.4L345.3 309.4L348.3 304.8L351.0 305.9L348.6 309.7L343.6 313.5Z M309.3 379.5L309.4 385.7L312.3 385.8L314.0 385.8L313.1 386.9L310.7 387.8L309.3 387.7L307.7 387.5L305.7 386.7L302.8 386.3L299.3 384.7L296.4 383.2L292.6 380.1L294.9 380.7L298.8 382.5L302.5 383.5L303.9 382.3L304.8 380.4L307.4 379.2L309.3 379.5Z M306.7 282.2L308.4 286.1L309.0 289.9L311.6 296.9L313.9 297.2L310.0 301.4L309.5 307.0L308.3 309.8L305.5 314.9L304.1 320.5L306.1 325.8L304.5 331.0L302.4 335.2L303.3 340.4L300.9 343.9L300.7 350.1L300.2 353.9L300.6 356.1L302.2 357.7L301.2 359.9L298.8 365.9L298.2 369.1L296.3 373.3L299.1 374.1L300.2 377.8L309.5 378.6L305.7 379.3L302.8 382.9L298.5 382.0L295.3 380.1L290.9 376.7L290.3 373.3L291.2 365.9L289.9 362.9L293.5 355.8L298.0 351.1L295.3 353.8L294.4 349.4L296.6 342.4L295.6 336.5L298.5 332.0L301.6 323.4L301.7 316.9L303.0 310.1L304.4 299.0L305.1 288.2L305.9 283.6Z M330.0 377.4L333.3 375.7L335.7 376.4L337.4 375.3L339.6 376.5L338.8 377.5L335.0 378.3L333.8 377.4L331.4 378.6L330.0 377.4Z M339.9 317.3L341.7 317.0L344.5 319.1L345.6 319.0L348.4 320.8L350.6 322.4L352.2 324.2L351.0 325.6L351.7 327.1L350.5 328.9L347.4 330.4L345.3 329.9L343.8 330.2L341.3 329.0L339.4 329.1L337.7 327.5L337.9 325.7L338.5 325.1L338.5 322.3L339.2 319.5L339.9 317.3Z M351.7 327.1L352.2 324.2L348.4 320.8L344.5 319.1L339.9 317.3L346.8 310.8L351.0 308.1L349.6 304.3L348.8 303.2L349.2 300.1L347.1 300.0L345.8 298.8L345.0 295.4L342.0 295.2L339.2 290.9L339.3 288.8L339.8 286.0L339.6 282.1L337.8 280.2L332.9 278.5L332.6 275.2L332.1 273.2L330.3 270.8L327.4 270.0L324.5 268.4L318.3 265.5L318.2 262.5L314.9 260.9L311.0 263.1L308.9 264.0L305.3 264.2L304.2 259.7L299.5 261.3L296.6 259.6L295.6 256.7L295.2 253.7L296.9 251.7L297.3 249.3L300.7 246.1L303.3 245.1L307.1 237.7L306.7 234.9L305.5 231.8L307.6 231.7L306.1 230.3L311.5 228.6L313.2 228.6L314.2 229.9L317.9 231.1L320.5 229.6L322.0 228.0L323.8 226.6L321.1 224.6L320.0 222.1L322.5 222.2L325.5 222.2L330.6 220.7L331.3 218.9L333.4 219.4L334.0 221.0L333.8 223.3L334.1 227.1L336.0 229.7L337.7 229.3L339.8 228.7L342.3 228.2L344.5 228.3L344.2 227.2L345.6 226.6L348.5 226.9L350.6 226.7L351.6 227.6L354.0 226.4L356.5 221.8L358.1 223.2L361.2 228.5L359.2 232.7L364.9 234.0L367.2 234.9L375.3 237.6L376.2 240.8L384.8 241.4L393.1 243.6L398.7 247.5L402.1 248.5L403.5 253.7L401.0 260.1L395.3 267.1L392.6 269.6L392.0 276.9L390.9 283.0L389.6 287.8L386.3 294.3L383.4 297.1L376.0 298.2L370.9 300.2L365.3 305.2L365.3 308.8L364.2 313.0L359.2 319.4L354.8 322.9L351.7 327.1Z M306.9 263.8L308.9 264.0L310.4 263.9L311.0 263.1L313.4 262.0L314.9 260.9L318.5 260.4L318.2 262.5L318.6 263.6L318.3 265.5L321.3 267.9L324.5 268.4L325.5 269.4L327.4 270.0L328.6 270.8L330.3 270.8L331.9 271.6L332.1 273.2L332.6 274.0L332.6 275.2L331.8 275.3L332.9 278.5L338.2 278.6L337.8 280.2L338.1 281.3L339.6 282.1L340.3 283.8L339.8 286.0L339.0 287.2L339.3 288.8L338.4 289.4L338.4 288.5L335.8 287.1L333.2 287.1L328.4 287.9L327.0 290.3L327.0 291.8L325.9 295.1L325.4 294.5L322.3 294.4L321.2 296.7L319.5 294.7L315.9 294.0L313.6 296.5L311.6 296.9L310.5 293.0L309.0 289.9L309.9 287.2L308.4 286.1L308.1 284.1L306.7 282.2L308.4 279.2L307.3 276.8L307.9 275.9L307.4 274.9L308.5 273.5L308.5 271.1L308.7 269.2L309.3 268.2L306.9 263.8Z M305.9 245.3L303.3 245.1L303.0 245.6L300.7 246.1L297.5 248.0L297.3 249.3L296.6 250.2L296.9 251.7L295.2 252.6L295.2 253.7L294.5 254.2L295.6 256.7L297.2 258.4L296.6 259.6L298.4 259.8L299.5 261.3L301.9 261.3L304.2 259.7L304.0 263.9L305.3 264.2L306.9 263.8L309.3 268.2L308.7 269.2L308.5 271.1L308.5 273.5L307.4 274.9L307.9 275.9L307.3 276.8L308.4 279.2L306.7 282.2L305.9 283.6L304.5 284.3L301.7 282.7L301.5 281.6L296.0 278.8L291.0 275.7L288.9 274.0L287.7 271.7L288.2 270.9L285.8 267.3L283.1 262.2L280.5 256.6L279.3 255.4L278.4 253.3L276.3 251.5L274.3 250.4L275.2 249.1L273.9 246.5L274.7 244.5L276.9 242.8L277.3 243.9L276.5 244.6L276.5 245.6L277.7 245.4L278.8 245.7L280.0 247.1L281.6 246.0L282.1 244.1L283.8 241.7L287.1 240.6L290.2 237.7L291.0 235.9L290.6 233.8L291.4 233.5L293.2 234.8L294.1 236.1L295.4 236.8L297.0 239.7L299.1 240.1L300.6 239.4L301.6 239.8L303.3 239.6L305.4 240.9L303.6 243.7L304.5 243.8L305.9 245.3Z M314.2 229.9L313.2 228.6L311.5 228.6L306.1 230.3L307.6 231.7L305.5 231.8L306.7 234.9L307.1 237.7L304.5 243.8L305.4 240.9L301.6 239.8L299.1 240.1L295.4 236.8L293.2 234.8L290.6 233.8L288.1 232.2L284.9 232.2L283.7 231.1L280.6 228.6L281.5 227.0L283.5 225.8L285.8 222.6L285.3 220.4L285.2 217.1L283.7 213.3L284.9 212.1L284.8 209.7L286.6 209.3L289.8 207.1L290.3 203.8L293.7 202.5L296.1 202.1L299.3 200.1L301.7 199.0L301.9 200.6L299.4 202.5L297.5 204.3L296.4 207.9L298.2 209.4L299.0 211.1L298.8 212.7L300.1 213.9L305.3 214.0L308.4 216.1L312.0 215.9L312.4 217.9L311.6 220.8L313.0 223.5L311.6 225.5L313.4 227.1Z M331.3 218.9L330.6 220.7L325.5 222.2L322.5 222.2L320.0 222.1L321.1 224.6L323.8 226.6L322.0 228.0L320.5 229.6L317.9 231.1L314.2 229.9L312.6 226.1L313.0 224.1L312.2 222.7L311.8 218.8L312.9 216.4L310.4 216.2L307.3 216.4L303.7 213.6L299.4 212.9L298.7 212.1L298.8 210.0L297.8 208.1L297.1 206.3L298.3 203.3L300.1 201.1L301.8 201.3L301.1 202.9L299.8 205.9L302.0 208.0L301.8 205.0L305.1 201.7L305.7 199.5L308.7 201.5L310.6 204.0L316.0 203.8L319.7 205.3L321.3 203.8L328.1 203.6L326.7 205.7L331.0 207.3L332.9 209.4L331.8 211.7L332.5 213.8L330.1 214.7L329.4 216.8Z M342.9 228.1L342.3 228.2L340.7 227.9L339.8 228.7L338.6 229.1L337.7 229.3L337.4 229.8L336.0 229.7L334.3 228.4L334.1 227.1L333.4 225.7L333.8 223.3L334.6 222.3L334.0 221.0L333.0 220.6L333.4 219.4L332.7 218.8L331.3 218.9L329.4 216.8L330.2 216.0L330.1 214.7L331.8 214.3L332.5 213.8L331.6 212.7L331.8 211.7L334.0 210.1L335.8 211.1L337.5 212.9L337.6 214.4L338.7 214.4L340.2 215.8L341.3 216.7L340.8 219.2L339.1 220.0L339.3 220.6L338.8 222.1L340.0 224.1L340.9 224.1L341.2 225.6L342.9 228.1Z M348.5 226.9L347.0 226.3L345.6 226.6L344.5 226.4L344.2 227.2L344.7 227.7L344.5 228.3L342.9 228.1L341.2 225.6L340.9 224.1L340.0 224.1L338.8 222.1L339.3 220.6L339.1 220.0L340.8 219.2L341.3 216.7L344.6 217.3L344.9 216.8L347.1 216.6L350.1 217.3L348.7 219.7L348.9 221.6L350.0 223.3L349.5 224.5L349.3 225.7L348.5 226.9Z M290.6 233.8L291.0 235.9L290.2 237.7L287.1 240.6L283.8 241.7L282.1 244.1L281.6 246.0L280.0 247.1L278.8 245.7L277.7 245.4L276.5 245.6L276.5 244.6L277.3 243.9L276.9 242.8L278.4 240.7L277.8 239.5L276.8 240.8L275.1 239.6L275.7 238.8L275.2 236.3L276.2 235.9L276.7 234.1L277.7 232.3L277.5 231.2L279.0 230.6L281.0 229.5L283.7 231.1L284.3 231.0L284.9 232.2L287.3 232.6L288.1 232.2L289.4 233.1L290.6 233.8Z M338.4 289.4L339.2 290.9L339.1 294.7L342.0 295.2L343.1 294.7L345.0 295.4L345.5 296.3L345.8 298.8L346.1 299.9L347.1 300.0L348.2 299.6L349.2 300.1L349.2 301.6L348.8 303.2L348.3 304.8L347.8 307.3L345.3 309.4L343.1 309.9L340.0 309.4L337.2 308.7L339.9 304.5L339.5 303.2L336.6 302.1L333.3 300.1L331.0 299.7L325.9 295.1L327.0 291.8L327.0 290.3L328.4 287.9L333.2 287.1L335.8 287.1L338.4 288.5L338.4 289.4Z", "eu": "M636.4 104.4L632.4 106.6L632.2 112.1L635.0 117.2L633.3 118.3L631.6 118.8L628.9 117.1L626.3 115.3L622.0 115.1L617.8 113.3L611.3 112.4L607.4 110.3L601.9 107.7L606.2 104.9L608.7 102.7L606.2 102.5L607.7 100.5L610.8 99.4L611.3 96.4L607.2 94.6L603.9 93.4L598.2 92.8L597.3 91.1L594.8 90.1L593.8 88.0L590.0 88.1L588.3 88.6L587.6 86.8L587.5 85.6L590.8 85.1L588.1 83.9L587.2 82.9L586.0 80.3L583.0 78.4L581.2 78.0L577.4 75.7L575.8 73.7L576.2 70.2L577.7 68.1L580.9 66.6L578.0 65.3L586.5 60.1L583.4 56.8L582.1 52.9L580.7 47.4L579.0 43.4L581.7 41.2L586.4 40.1L593.8 40.8L611.9 44.6L614.2 47.8L606.6 50.0L592.2 48.2L596.9 51.6L600.6 55.3L603.2 54.6L603.3 52.4L612.3 53.4L616.9 48.7L622.1 49.8L621.4 46.2L620.7 42.9L630.1 45.3L626.6 47.2L633.0 47.5L639.5 44.4L651.3 42.2L652.0 44.2L659.2 43.1L666.5 43.7L666.8 40.2L676.4 40.1L690.3 44.2L689.3 41.3L685.9 40.4L685.3 36.9L690.4 33.5L694.3 30.4L702.2 32.7L701.3 35.9L701.6 41.6L703.4 45.2L701.2 49.5L705.3 47.8L708.5 45.1L708.2 41.7L704.4 39.9L703.1 34.9L707.4 31.0L710.2 32.5L712.1 35.7L715.5 32.6L726.4 34.0L723.6 28.8L735.2 28.3L738.9 26.5L745.3 24.6L758.1 22.9L766.3 21.8L774.8 21.0L780.7 19.8L789.9 17.5L790.8 19.1L797.9 20.9L808.5 20.3L817.0 22.6L813.3 24.9L803.9 27.3L811.4 28.4L815.4 29.6L821.0 28.5L830.6 30.2L842.4 28.5L852.7 29.0L858.5 32.2L860.3 35.6L867.4 33.8L876.6 34.3L884.0 34.4L886.5 32.2L915.3 32.8L924.9 36.5L941.7 36.5L943.6 39.7L950.8 39.9L960.9 40.4L971.0 42.5L972.2 39.9L982.3 39.4L996.1 40.6L1000.0 52.8L996.4 54.1L995.3 55.3L998.3 58.4L997.9 60.3L984.9 61.8L978.2 64.0L973.1 67.0L961.9 67.3L958.0 67.4L953.4 68.9L950.1 72.7L952.9 77.3L949.2 79.8L945.5 82.4L940.4 86.2L935.5 91.6L933.3 85.7L933.1 75.6L935.6 72.7L944.9 68.6L954.6 63.5L953.5 59.8L944.8 65.2L935.3 62.7L930.7 69.0L920.2 70.1L916.1 67.6L904.1 68.5L886.0 74.8L879.7 81.7L883.8 84.0L888.6 82.8L892.7 88.2L890.3 94.3L884.9 102.8L880.2 107.9L874.6 112.8L869.2 114.4L863.7 115.1L863.3 116.1L863.3 116.1L862.9 115.6L864.3 114.1L864.0 108.4L869.7 107.9L872.5 102.2L875.1 98.7L868.1 100.6L862.7 98.0L854.6 95.1L852.6 90.7L849.9 86.7L843.3 84.8L836.1 85.4L835.3 87.5L833.8 89.9L831.4 94.0L824.1 94.8L819.3 94.1L813.6 95.7L807.4 96.9L801.3 96.4L796.9 93.7L790.6 93.7L784.0 93.0L780.2 90.2L774.6 88.8L772.9 93.3L766.2 94.5L761.5 93.1L756.2 92.2L746.7 95.9L742.7 96.6L737.6 95.3L734.5 93.6L731.6 91.5L723.8 90.6L716.1 85.0L713.6 82.0L704.0 84.8L700.6 82.3L696.8 80.1L689.4 80.6L681.1 82.3L669.4 84.3L668.7 86.9L666.6 89.0L670.4 92.2L665.7 92.9L657.7 91.5L651.5 91.6L641.0 89.7L634.9 94.8L629.9 96.2L629.1 98.9L633.5 100.7L635.0 104.0Z M760.5 8.3L766.5 7.6L771.9 9.0L778.3 11.7L777.6 14.2L771.5 14.6L763.8 13.8L759.2 12.7L757.1 10.7L753.3 10.2L760.5 8.3Z M785.7 13.1L792.7 14.7L791.9 15.8L776.2 16.9L781.3 13.2L783.6 12.9L785.7 13.1Z M885.6 21.8L893.0 22.0L903.0 23.4L900.8 25.5L890.6 25.4L886.0 26.1L880.5 24.3L882.0 22.4L885.6 21.8Z M911.7 24.0L918.7 24.8L915.5 25.9L911.0 25.6L905.9 24.5L906.6 23.6L911.7 24.0Z M888.5 29.5L891.1 28.4L894.6 28.2L898.6 29.2L898.9 30.0L894.7 30.0L889.0 29.7L888.5 29.5Z M624.6 9.5L630.0 9.0L634.2 8.9L634.8 9.7L636.4 9.0L639.0 8.6L643.1 9.2L642.0 9.6L638.3 10.0L635.8 10.2L635.4 10.6L632.2 11.1L629.2 10.4L630.8 9.6L624.6 9.5Z M563.1 82.4L558.0 82.5L554.6 82.1L555.2 80.9L559.1 80.0L562.0 80.5L563.2 81.0L562.9 81.7L563.1 82.4Z M648.6 28.5L655.3 26.0L654.5 24.8L660.7 23.3L669.9 21.5L679.2 21.0L683.9 20.0L689.3 19.6L691.3 20.7L689.4 21.6L679.5 23.0L671.1 24.3L662.4 26.9L658.3 29.6L653.9 32.3L654.5 34.6L659.8 36.9L658.2 37.1L649.1 36.8L648.4 35.5L643.3 34.8L642.9 33.3L645.8 32.7L645.7 31.2L651.2 28.8L648.6 28.5Z M897.0 84.2L897.9 86.8L897.9 89.6L899.0 92.4L901.8 97.3L897.7 96.4L896.0 100.4L898.7 103.2L898.6 105.2L896.5 103.5L894.7 105.6L894.2 103.3L894.5 100.6L894.2 97.6L894.8 95.5L894.9 91.8L893.3 89.1L893.6 85.3L896.1 84.0L895.0 82.7L896.3 82.3L897.0 84.2Z M14.1 46.7L13.8 48.4L15.7 49.1L15.1 47.0L22.6 47.5L28.1 50.1L25.3 51.3L20.7 51.6L20.7 54.3L19.6 54.9L17.0 54.8L14.9 53.8L11.2 53.0L10.5 51.8L7.7 51.3L4.6 51.7L3.0 50.7L3.6 49.7L0.3 50.3L1.6 51.7L0.0 52.8L0.0 41.8L6.8 43.9L14.1 46.7Z M3.6 36.4L0.0 36.6L0.0 34.7L0.4 34.6L2.7 34.6L6.7 35.4L6.5 35.7L3.6 36.4Z M592.9 105.6L593.6 104.9L595.6 105.5L596.5 105.7L596.8 106.2L597.3 106.3L597.3 106.5L598.6 107.2L601.5 107.0L600.9 108.0L597.9 108.5L594.1 110.1L592.6 109.5L593.2 108.2L590.2 107.4L590.6 106.9L593.3 106.0L592.9 105.6Z M542.1 12.0L543.1 11.1L547.2 11.0L550.7 11.9L559.8 14.0L552.9 15.1L551.3 17.1L548.9 17.7L547.6 20.0L544.2 20.1L538.2 18.4L540.7 17.4L536.6 16.6L531.2 14.3L529.0 12.1L536.6 11.1L538.1 12.1L542.1 12.0Z M586.4 40.1L581.7 41.2L579.4 41.5L580.6 39.5L577.0 38.4L572.7 39.4L571.4 41.4L568.7 42.6L565.7 42.0L562.1 42.1L559.0 40.6L557.3 41.4L555.6 41.5L555.2 43.3L550.0 42.9L549.2 44.4L546.6 44.4L544.7 46.4L542.0 49.5L537.7 53.4L538.7 54.3L537.7 55.4L534.9 55.4L533.1 58.0L533.3 61.7L535.1 63.1L534.2 66.3L531.9 68.2L530.6 69.8L528.8 68.1L523.3 71.4L519.6 72.0L515.7 70.6L514.7 67.6L513.9 61.2L516.4 59.4L523.8 57.1L529.2 54.2L534.3 50.3L541.0 45.0L545.7 42.9L553.3 39.4L559.4 38.2L564.0 38.3L568.2 36.0L573.3 36.1L578.2 35.6L586.9 37.6L583.3 38.4L586.4 40.1Z M576.1 11.0L572.0 12.5L564.0 12.8L555.8 12.3L555.3 11.5L551.3 11.5L548.2 10.2L556.8 9.4L560.9 10.1L563.7 9.3L570.7 10.0L576.1 11.0Z M568.7 17.1L562.5 18.2L557.6 17.6L559.5 16.8L557.8 16.0L563.6 15.4L564.7 16.4L568.7 17.1Z M356.5 221.8L354.9 224.3L354.0 226.4L352.9 227.4L351.6 227.6L351.2 226.8L350.6 226.7L349.8 227.5L348.5 226.9L349.3 225.7L349.5 224.5L350.0 223.3L348.9 221.6L348.7 219.7L350.1 217.3L351.1 217.6L353.1 218.3L356.0 220.7L356.5 221.8Z M517.2 95.9L518.5 96.7L522.5 97.2L521.1 99.1L520.7 101.1L520.0 101.5L518.7 101.3L518.8 102.0L516.8 103.5L516.7 104.8L518.1 104.4L519.0 105.6L518.9 106.4L519.7 107.4L518.7 108.3L519.5 110.4L521.0 110.8L520.7 112.0L518.1 113.5L512.7 112.8L508.6 113.7L508.3 115.4L505.1 115.7L501.9 114.5L500.9 115.1L495.8 113.8L494.7 112.7L496.2 111.0L496.7 105.5L493.8 102.6L491.8 101.2L487.5 100.1L487.2 98.1L490.8 97.5L495.5 98.2L494.6 95.1L497.3 96.3L503.7 94.1L504.6 91.8L507.0 91.3L507.4 92.2L508.7 92.3L510.0 93.4L511.9 94.7L513.3 94.5L515.8 95.8L516.4 96.0L517.2 95.9Z M524.3 114.9L526.1 113.9L526.6 116.2L525.6 118.4L524.4 117.8L523.7 116.0L524.3 114.9Z M530.6 69.8L531.9 68.2L534.2 66.3L535.1 63.1L533.3 61.7L533.1 58.0L534.9 55.4L537.7 55.4L538.7 54.3L537.7 53.4L542.0 49.5L544.7 46.4L546.6 44.4L549.2 44.4L550.0 42.9L555.2 43.3L555.6 41.5L557.3 41.4L561.1 42.7L565.4 44.6L565.5 48.9L566.4 50.0L561.6 50.8L558.9 52.7L559.4 54.4L554.9 56.6L549.6 59.0L547.6 62.9L549.5 64.9L552.2 66.4L549.6 69.6L546.7 70.2L545.7 74.9L544.1 77.5L540.7 77.2L539.2 79.4L536.0 79.6L535.1 76.9L532.7 73.8L530.6 69.8Z M578.3 77.3L581.2 78.0L581.6 78.7L583.0 78.4L585.8 79.0L586.0 80.3L585.4 81.1L587.2 82.9L588.3 83.4L588.1 83.9L590.0 84.4L590.8 85.1L589.7 85.7L587.5 85.6L587.0 85.9L587.6 86.8L588.3 88.6L588.3 88.6L585.9 88.8L585.1 89.4L584.9 90.8L583.8 90.5L581.3 90.6L580.5 90.0L579.5 90.5L578.4 90.1L576.3 90.0L573.2 89.4L570.4 89.1L568.2 89.2L566.7 90.0L565.4 90.1L565.3 88.8L564.4 87.5L566.1 87.0L566.1 85.9L565.4 84.8L565.2 83.6L567.9 83.6L570.9 82.5L571.6 81.0L573.9 80.1L573.6 78.8L575.3 78.4L578.3 77.3Z M588.3 88.6L590.0 88.1L593.8 88.0L594.8 90.1L597.3 91.1L598.2 92.8L603.9 93.4L607.2 94.6L611.3 96.4L610.8 99.4L607.7 100.5L606.2 102.5L602.1 103.6L597.1 104.8L596.8 106.2L595.6 105.5L592.9 105.6L588.2 104.6L585.4 103.9L582.2 107.5L579.7 107.5L579.1 106.7L580.4 104.8L580.8 104.1L582.7 104.6L582.9 104.1L582.1 103.0L580.7 101.4L579.6 99.7L576.5 98.7L573.9 99.4L572.1 100.0L569.1 100.7L566.0 100.0L563.1 100.3L561.3 98.8L562.7 97.0L562.6 95.9L566.5 93.3L565.4 90.1L568.2 89.2L573.2 89.4L578.4 90.1L580.5 90.0L583.8 90.5L585.1 89.4L588.3 88.6Z M565.2 83.6L565.4 84.8L566.1 85.9L566.1 87.0L564.4 87.5L565.3 88.8L565.4 90.1L566.7 92.5L566.5 93.3L565.1 93.6L562.6 95.9L563.3 97.1L562.7 97.0L560.0 95.9L558.0 96.3L556.7 96.0L555.1 96.6L553.7 95.6L552.5 96.0L552.4 95.8L551.1 94.5L549.0 94.3L548.8 93.4L546.9 93.1L546.4 93.8L544.9 93.3L545.1 92.5L543.0 92.3L541.7 91.4L540.6 89.6L540.8 88.6L540.1 87.2L539.1 86.2L539.9 85.4L539.2 84.0L541.1 83.2L545.5 81.9L549.0 81.0L551.7 81.4L551.9 82.1L554.6 82.1L558.0 82.5L563.1 82.4L564.6 82.7L565.2 83.6Z M547.2 99.7L547.0 100.8L545.4 100.8L545.9 101.4L545.0 103.2L544.5 103.7L542.0 103.7L540.6 104.4L538.4 104.1L534.4 103.4L533.8 102.5L531.0 102.9L530.7 103.5L529.0 103.1L527.6 103.0L526.3 102.5L526.8 101.8L526.7 101.3L527.5 101.2L528.9 101.9L529.3 101.2L531.7 101.3L533.7 100.8L535.1 100.9L535.9 101.5L536.2 101.0L535.8 99.2L536.8 98.8L537.8 97.6L539.8 98.5L541.4 97.3L542.4 97.1L544.5 98.0L545.8 97.8L547.1 98.3L546.9 98.7L547.2 99.7Z M561.3 98.8L562.9 99.6L563.1 100.3L561.4 100.9L560.1 102.8L558.4 104.7L556.2 105.2L554.4 105.1L552.3 105.8L552.3 105.8L551.3 106.2L549.0 105.7L546.9 104.5L546.0 104.2L545.5 103.2L545.0 103.2L545.9 101.4L545.4 100.8L547.0 100.8L547.2 99.7L548.6 100.4L549.6 100.7L551.9 100.3L552.2 99.8L553.3 99.7L554.6 99.3L554.9 99.4L556.2 99.1L556.9 98.4L557.8 98.3L560.8 99.1L561.3 98.8Z M573.9 99.4L574.6 99.0L576.5 98.7L578.5 99.6L579.6 99.7L580.9 100.4L580.7 101.4L581.7 101.8L582.1 103.0L583.1 103.7L582.9 104.1L583.4 104.4L582.7 104.6L581.0 104.5L580.8 104.1L580.2 104.3L580.4 104.8L579.6 105.7L579.1 106.7L578.4 107.0L577.9 105.7L578.2 104.5L578.1 103.3L576.5 101.7L575.6 100.5L574.8 99.7L573.9 99.4Z M578.4 107.0L579.7 107.5L581.0 107.0L582.2 107.5L582.3 108.2L580.9 108.8L580.1 108.6L579.3 111.9L577.7 111.6L575.7 110.6L572.4 111.3L571.0 112.0L566.9 111.8L564.8 111.4L563.7 111.6L562.9 110.5L562.4 110.0L563.1 109.5L562.4 109.2L561.5 109.8L559.9 109.0L559.7 107.8L558.0 107.2L557.7 106.3L556.2 105.2L558.4 104.7L560.1 102.8L561.4 100.9L563.1 100.3L564.3 99.7L566.0 100.0L567.8 100.1L569.1 100.7L570.0 100.3L572.1 100.0L572.8 99.4L573.9 99.4L574.8 99.7L575.6 100.5L576.5 101.7L578.1 103.3L578.2 104.5L577.9 105.7L578.4 107.0Z M573.6 78.8L573.9 80.1L571.6 81.0L570.9 82.5L567.9 83.6L565.2 83.6L564.6 82.7L563.1 82.4L562.9 81.7L563.2 81.0L562.0 80.5L559.1 80.0L558.5 77.7L561.7 76.8L566.3 77.0L569.1 76.7L569.4 77.3L570.9 77.5L573.6 78.8Z M575.8 73.7L577.1 74.3L577.4 75.7L578.3 77.3L575.3 78.4L573.6 78.8L570.9 77.5L569.4 77.3L569.1 76.7L566.3 77.0L561.7 76.8L558.5 77.7L558.6 75.6L559.9 73.9L562.6 72.9L564.8 75.0L567.0 74.9L567.5 72.8L569.9 72.3L571.1 72.6L573.5 73.7L575.8 73.7Z M577.7 68.1L577.7 68.1L578.1 68.6L576.2 70.2L577.0 72.8L575.8 73.7L573.5 73.7L571.1 72.6L569.9 72.3L567.5 72.8L567.9 71.2L566.8 71.5L565.1 70.5L564.8 68.9L568.3 68.2L571.8 67.7L574.9 68.2L577.7 68.1L577.7 68.1Z M539.2 84.0L539.9 85.4L539.1 86.2L540.1 87.2L540.8 88.6L540.6 89.6L541.7 91.4L540.5 91.7L539.7 91.3L539.0 91.9L537.1 92.4L536.0 93.1L534.0 93.7L534.5 94.5L534.8 95.7L536.2 96.4L537.8 97.6L536.8 98.8L535.8 99.2L536.2 101.0L535.9 101.5L535.1 100.9L533.7 100.8L531.7 101.3L529.3 101.2L528.9 101.9L527.5 101.2L526.7 101.3L523.7 100.5L523.1 101.1L520.7 101.1L521.1 99.1L522.5 97.2L518.5 96.7L517.2 95.9L517.3 94.7L516.8 94.1L517.1 92.2L516.6 89.3L518.3 89.3L519.0 88.3L519.7 85.7L519.2 84.8L519.7 84.2L522.0 84.0L522.6 84.6L524.4 83.3L523.8 82.2L523.7 80.7L525.8 81.0L527.6 80.6L527.6 81.7L530.4 82.3L530.4 83.3L533.2 82.8L534.8 82.0L537.9 83.1L539.2 84.0Z M562.9 110.5L563.7 111.6L564.8 111.4L566.9 111.8L571.0 112.0L572.4 111.3L575.7 110.6L577.7 111.6L579.3 111.9L577.9 113.1L576.9 115.1L577.8 116.6L575.4 116.3L572.5 117.1L572.5 118.5L570.0 118.8L568.0 117.8L565.8 118.6L563.8 118.5L563.6 116.7L562.2 115.8L562.6 115.4L562.3 115.1L562.8 114.2L563.9 113.3L562.5 112.1L562.3 111.1L562.9 110.5Z M573.0 135.3L572.7 136.1L568.7 136.3L568.7 135.9L565.3 135.3L565.8 134.2L567.4 135.1L569.5 134.9L571.6 135.1L571.5 135.6L573.0 135.3Z M563.8 118.5L565.8 118.6L568.0 117.8L570.0 118.8L572.5 118.5L572.5 117.1L573.9 117.9L573.0 119.6L572.4 119.9L570.7 119.9L569.2 119.6L565.9 120.3L567.8 121.9L566.4 122.3L564.8 122.3L563.4 120.9L562.9 121.5L563.5 123.2L564.9 124.5L563.8 125.1L565.4 126.4L566.7 127.2L566.8 128.7L564.2 128.0L565.0 129.4L563.3 129.7L564.3 132.2L562.5 132.2L560.2 131.0L559.2 128.8L558.7 126.9L557.6 125.6L556.2 124.1L556.0 123.3L557.3 121.9L557.4 121.0L558.3 120.6L558.4 119.9L560.2 119.6L561.3 119.0L562.8 119.1L563.2 118.6L563.8 118.5Z M558.4 119.9L558.3 120.6L557.4 121.0L557.3 121.9L556.0 123.3L555.5 123.1L555.4 122.5L553.9 121.5L553.7 120.2L553.9 118.3L554.3 117.4L553.8 117.0L553.8 117.0L553.6 116.1L554.8 114.8L555.0 115.3L555.8 115.0L556.3 115.8L557.0 116.1L557.2 117.1L557.2 117.1L556.8 118.0L557.2 119.2L558.4 119.9Z M546.0 104.2L546.9 104.5L549.0 105.7L551.3 106.2L552.3 105.8L553.0 106.9L553.9 107.7L552.8 108.7L551.5 108.1L549.6 108.1L547.2 107.7L545.9 107.7L545.3 108.3L544.3 107.7L543.8 108.8L545.1 110.1L545.7 111.0L547.0 112.0L548.0 112.6L549.1 113.8L551.6 114.9L551.3 115.3L551.3 115.3L548.6 114.3L547.0 113.3L544.5 112.5L542.2 110.4L542.7 110.2L541.4 109.1L541.4 108.1L539.6 107.7L538.8 108.9L537.9 108.0L538.0 107.0L538.1 106.9L540.0 107.0L540.5 106.6L541.5 107.0L542.6 107.1L542.6 106.3L543.5 106.0L543.8 104.9L546.0 104.2Z M526.7 101.3L526.8 101.8L526.3 102.5L527.6 103.0L529.0 103.1L528.8 104.2L527.6 104.7L525.5 104.3L524.9 105.5L523.6 105.5L523.1 105.1L521.5 106.0L520.2 106.2L519.0 105.6L518.1 104.4L516.7 104.8L516.8 103.5L518.8 102.0L518.7 101.3L520.0 101.5L520.7 101.1L523.1 101.1L523.7 100.5L526.7 101.3Z M516.8 94.1L517.3 94.7L517.2 95.9L516.4 96.0L515.8 95.8L516.1 94.2L516.8 94.1Z M517.1 92.2L516.8 94.1L516.1 94.2L515.8 95.8L513.3 94.5L511.9 94.7L510.0 93.4L508.7 92.3L507.4 92.2L507.0 91.3L509.2 90.7L509.2 90.7L509.2 90.7L511.2 90.9L513.8 90.3L515.6 91.6L517.1 92.2Z M519.2 84.8L519.7 85.7L519.0 88.3L518.3 89.3L516.6 89.3L517.1 92.2L515.6 91.6L513.8 90.3L511.2 90.9L509.2 90.7L509.2 90.7L510.6 89.9L513.1 85.9L516.9 84.7L519.2 84.8Z M474.9 117.0L475.9 116.3L477.0 115.9L477.7 117.2L479.4 117.2L479.9 116.9L481.5 117.0L482.3 118.4L481.0 119.1L480.9 121.3L480.5 121.7L480.4 123.0L479.2 123.3L480.3 124.9L479.5 126.7L480.5 127.6L480.1 128.3L479.1 129.4L479.3 130.3L478.2 131.0L476.7 130.6L475.3 130.9L475.7 128.7L475.4 127.0L474.2 126.8L473.5 125.7L473.8 123.9L474.9 122.9L475.1 121.8L475.6 120.1L475.6 118.9L475.0 117.9L474.9 117.0Z M479.3 130.3L479.1 129.4L480.1 128.3L480.5 127.6L479.5 126.7L480.3 124.9L479.2 123.3L480.4 123.0L480.5 121.7L480.9 121.3L481.0 119.1L482.3 118.4L481.5 117.0L479.9 116.9L479.4 117.2L477.7 117.2L477.0 115.9L475.9 116.3L474.9 117.0L475.0 115.0L473.9 113.8L477.8 111.8L481.2 112.3L485.0 112.3L487.9 112.8L490.2 112.6L494.7 112.7L495.8 113.8L500.9 115.1L501.9 114.5L505.1 115.7L508.3 115.4L508.4 117.0L505.8 118.8L502.3 119.4L502.0 120.3L500.3 121.9L499.2 124.1L500.3 125.7L498.7 127.0L498.1 128.8L496.0 129.3L494.0 131.5L490.5 131.5L487.9 131.5L486.1 132.4L485.1 133.5L483.7 133.3L482.7 132.3L481.9 130.7L479.3 130.3Z M482.8 83.7L483.2 85.7L481.1 88.2L476.2 89.8L472.3 89.4L474.5 86.5L473.1 83.7L476.9 81.5L479.0 80.2L479.5 81.7L479.0 83.2L480.7 83.1L482.8 83.7Z M529.0 103.1L530.7 103.5L531.0 102.9L533.8 102.5L534.4 103.4L538.4 104.1L538.1 105.5L538.7 106.7L536.5 106.3L534.2 107.3L534.4 108.7L534.1 109.4L535.0 110.9L537.6 112.3L539.0 114.6L542.1 116.8L544.2 116.8L544.9 117.4L544.1 117.9L546.6 118.9L548.7 119.8L551.0 121.2L551.3 121.8L550.8 122.7L549.3 121.5L546.9 121.0L545.7 122.8L547.7 123.8L547.4 125.3L546.2 125.4L544.7 127.8L543.6 128.0L543.6 127.2L544.1 125.7L544.7 125.1L543.7 123.5L542.8 122.1L541.7 121.7L540.8 120.5L539.1 120.0L537.9 118.9L535.8 118.7L533.6 117.5L531.1 115.7L529.2 114.1L528.3 111.3L527.0 111.0L524.7 110.1L523.4 110.5L521.8 111.8L520.7 112.0L521.0 110.8L519.5 110.4L518.7 108.3L519.7 107.4L518.9 106.4L519.0 105.6L520.2 106.2L521.5 106.0L523.1 105.1L523.6 105.5L524.9 105.5L525.5 104.3L527.6 104.7L528.8 104.2L529.0 103.1Z M541.0 127.4L543.1 127.1L542.1 129.3L542.5 130.2L541.9 131.6L539.8 130.6L538.4 130.3L534.5 128.9L534.9 127.4L538.2 127.7L541.0 127.4Z M524.2 119.7L525.6 118.9L527.2 120.8L526.9 124.5L525.6 124.3L524.5 125.3L523.4 124.5L523.3 121.2L522.7 119.6L524.2 119.7Z M527.6 80.6L525.8 81.0L523.7 80.7L522.6 79.1L522.5 76.3L522.9 75.5L523.7 74.7L526.2 74.5L527.2 73.8L529.4 73.0L529.3 74.4L528.5 75.3L528.8 76.1L530.3 76.5L529.6 77.6L528.8 77.2L526.8 79.3L527.6 80.6Z M534.4 77.5L535.3 78.9L533.6 81.1L530.7 79.5L530.3 78.4L534.4 77.5Z M482.8 83.7L480.7 83.1L479.0 83.2L479.5 81.7L479.0 80.2L481.3 80.1L484.3 81.8L482.8 83.7Z M491.4 85.0L491.4 85.0L491.8 83.4L490.0 81.7L489.9 81.6L486.5 81.1L485.9 80.4L486.9 79.1L486.0 78.4L484.5 79.7L484.3 77.0L482.9 75.6L483.9 72.7L486.1 70.5L488.3 70.7L491.7 70.5L488.7 73.5L491.5 73.1L494.6 73.1L493.8 75.4L491.3 77.9L494.2 78.0L494.4 78.3L496.9 81.6L498.8 82.0L500.5 85.2L501.3 86.3L504.7 86.8L504.3 88.6L502.9 89.4L504.0 90.9L501.5 92.3L497.8 92.3L493.1 93.1L491.8 92.5L490.0 93.8L487.4 93.5L485.4 94.6L484.0 94.0L488.0 91.1L490.5 90.5L490.5 90.5L486.2 90.0L485.4 88.9L488.3 88.1L486.7 86.6L487.3 84.7L491.4 85.0Z M459.7 48.7L459.1 50.5L462.2 52.4L458.6 54.5L450.6 56.4L448.2 57.0L444.5 56.5L436.8 55.7L439.5 54.4L433.5 53.1L438.4 52.5L438.3 51.7L432.4 51.1L434.3 49.3L438.5 48.9L442.8 50.7L447.1 49.2L450.6 50.0L455.1 48.5L459.7 48.7Z M538.4 104.1L540.6 104.4L542.0 103.7L544.5 103.7L545.0 103.2L545.5 103.2L546.0 104.2L543.8 104.9L543.5 106.0L542.6 106.3L542.6 107.1L541.5 107.0L540.5 106.6L540.0 107.0L538.1 106.9L538.7 106.7L538.1 105.5L538.4 104.1Z M579.4 41.5L579.0 43.4L583.3 45.3L580.7 47.4L583.9 50.5L582.1 52.9L584.6 55.0L583.4 56.8L587.5 58.7L586.5 60.1L583.9 61.7L578.0 65.3L578.0 65.3L578.0 65.3L572.9 65.5L568.0 66.5L563.5 67.1L561.9 65.6L559.2 64.7L559.8 61.9L558.5 59.4L559.8 57.8L562.3 56.1L568.7 53.0L570.6 52.5L570.3 51.3L566.4 50.0L565.5 48.9L565.4 44.6L561.1 42.7L557.3 41.4L559.0 40.6L562.1 42.1L565.7 42.0L568.7 42.6L571.4 41.4L572.7 39.4L577.0 38.4L580.6 39.5L579.4 41.5Z M562.7 97.0L561.9 97.7L561.3 98.8L560.8 99.1L557.8 98.3L556.9 98.4L556.2 99.1L554.9 99.4L554.6 99.3L553.3 99.7L552.2 99.8L551.9 100.3L549.6 100.7L548.6 100.4L547.2 99.7L546.9 98.7L547.1 98.3L547.5 97.7L548.7 97.8L549.7 97.5L549.8 97.2L550.3 97.1L550.5 96.5L551.1 96.3L551.5 95.8L552.4 95.8L552.5 96.0L553.7 95.6L555.1 96.6L556.7 96.0L558.0 96.3L560.0 95.9L562.7 97.0Z M541.7 91.4L543.0 92.3L545.1 92.5L544.9 93.3L546.4 93.8L546.9 93.1L548.8 93.4L549.0 94.3L551.1 94.5L552.4 95.8L551.5 95.8L551.1 96.3L550.5 96.5L550.3 97.1L549.8 97.2L549.7 97.5L548.7 97.8L547.5 97.7L547.1 98.3L545.8 97.8L544.5 98.0L542.4 97.1L541.4 97.3L539.8 98.5L537.8 97.6L536.2 96.4L534.8 95.7L534.5 94.5L534.0 93.7L536.0 93.1L537.1 92.4L539.0 91.9L539.7 91.3L540.5 91.7L541.7 91.4Z M551.6 114.9L549.1 113.8L548.0 112.6L547.0 112.0L545.7 111.0L545.1 110.1L543.8 108.8L544.3 107.7L545.3 108.3L545.9 107.7L547.2 107.7L549.6 108.1L551.5 108.1L552.8 108.7L552.8 108.7L553.8 108.7L553.1 109.9L554.4 111.0L554.0 112.3L553.4 112.4L552.9 112.7L552.0 113.3L551.6 114.9Z M562.2 115.8L563.6 116.7L563.8 118.5L563.2 118.6L562.8 119.1L561.3 119.0L560.2 119.6L558.4 119.9L557.2 119.2L556.8 118.0L557.2 117.1L557.2 117.1L557.5 117.1L557.7 116.5L559.3 116.1L559.9 116.0L560.9 115.8L562.2 115.8Z M552.3 105.8L552.3 105.8L554.4 105.1L556.2 105.2L557.7 106.3L558.0 107.2L559.7 107.8L559.9 109.0L561.5 109.8L562.4 109.2L563.1 109.5L562.4 110.0L562.9 110.5L562.3 111.1L562.5 112.1L563.9 113.3L562.8 114.2L562.3 115.1L562.6 115.4L562.2 115.8L560.9 115.8L559.9 116.0L559.8 115.8L560.2 115.4L560.5 114.8L560.1 114.8L559.6 114.3L559.1 114.1L558.7 113.7L558.2 113.5L557.8 113.1L557.3 113.3L556.9 114.2L556.3 114.4L556.5 114.2L555.4 113.6L554.5 113.3L554.1 112.9L553.4 112.4L554.0 112.3L554.4 111.0L553.1 109.9L553.8 108.7L552.8 108.7L552.8 108.7L553.9 107.7L553.0 106.9L552.3 105.8Z M555.8 115.0L555.0 115.3L554.8 114.8L553.6 116.1L553.8 117.0L553.2 116.8L552.5 115.9L551.3 115.3L551.6 114.9L552.0 113.3L552.9 112.7L553.4 112.4L554.1 112.9L554.5 113.3L555.4 113.6L556.5 114.2L556.3 114.4L555.8 115.0Z M557.2 117.1L557.0 116.1L556.3 115.8L555.8 115.0L556.3 114.4L556.9 114.2L557.3 113.3L557.8 113.1L558.2 113.5L558.7 113.7L559.1 114.1L559.6 114.3L560.1 114.8L560.5 114.8L560.2 115.4L559.8 115.8L559.9 116.0L559.3 116.1L557.7 116.5L557.5 117.1L557.2 117.1Z", "as": "M742.7 96.6L738.2 98.7L736.6 102.8L729.1 106.8L722.1 108.6L722.7 114.1L721.2 115.3L715.7 114.0L710.1 114.2L704.6 113.6L699.6 114.3L697.1 115.9L691.9 118.4L689.6 120.4L685.3 119.0L683.4 116.7L680.3 111.9L672.3 112.5L667.3 108.9L662.5 106.7L655.5 118.6L652.1 116.5L647.1 116.3L645.7 116.6L645.8 114.5L641.4 111.0L639.7 109.4L642.5 107.7L647.3 107.6L647.3 103.2L642.2 102.6L636.4 104.4L635.3 102.6L631.4 100.8L630.7 96.8L632.1 93.2L635.3 92.8L645.4 89.7L654.8 92.7L662.1 91.5L666.5 92.1L671.1 90.9L669.2 87.6L671.4 86.2L670.7 83.3L682.4 81.7L691.9 79.5L697.7 83.0L704.2 83.2L706.6 84.6L712.6 82.8L722.3 92.0L727.6 92.2L733.2 92.0L736.4 94.1L741.2 94.9Z M655.5 118.6L655.4 108.3L662.5 106.7L663.0 106.9L667.3 108.9L669.6 110.0L672.3 112.5L675.5 112.1L680.3 111.9L683.6 113.9L683.4 116.7L684.8 116.7L685.3 119.0L688.8 119.1L689.6 120.4L690.6 120.4L691.9 118.4L695.5 116.4L697.1 115.9L697.9 116.2L695.6 118.0L697.7 119.0L699.6 118.4L702.9 119.8L699.4 121.8L697.3 121.5L696.1 121.6L695.7 120.8L696.3 119.6L692.6 120.2L691.7 122.0L690.4 123.5L688.1 123.4L687.3 124.6L689.4 125.3L690.0 127.3L688.4 130.2L686.3 129.6L684.8 129.5L684.9 127.8L681.2 126.7L678.3 125.3L676.4 124.0L673.3 122.1L671.9 119.2L671.0 118.7L668.0 118.8L666.9 118.3L666.6 116.0L662.9 114.6L660.5 116.2L658.1 117.1L658.6 118.5L655.5 118.6Z M891.7 240.6L891.7 249.6L891.8 258.7L889.3 256.4L886.5 255.8L885.8 256.6L882.3 256.7L883.4 254.4L885.2 253.7L884.5 250.6L883.1 248.3L877.7 246.0L875.5 245.7L871.3 243.2L870.5 244.5L869.4 244.8L868.8 243.7L868.8 242.5L866.6 241.2L869.6 240.2L871.6 240.2L871.4 239.5L867.3 239.5L866.2 237.8L863.7 237.3L862.6 235.9L866.3 235.3L867.7 234.4L872.2 235.5L872.6 236.5L873.4 241.0L876.3 242.7L878.6 239.7L881.8 238.1L884.2 238.1L886.6 239.0L888.7 240.0L891.7 240.6Z M847.1 258.0L847.4 258.6L847.5 259.4L845.7 261.5L843.3 262.1L842.9 261.8L843.2 260.8L844.4 259.1L847.1 258.0Z M872.8 252.5L872.5 250.4L873.0 249.4L873.6 248.5L874.2 249.3L874.2 250.6L872.8 252.5Z M827.5 221.8L825.9 224.3L827.9 227.0L827.4 228.3L830.5 230.8L827.3 231.2L826.3 233.0L826.4 235.6L823.8 237.5L823.7 240.2L822.6 244.5L822.2 243.5L819.1 244.7L818.0 243.0L816.0 242.9L814.6 242.0L811.3 243.0L810.3 241.7L808.5 241.8L806.2 241.5L805.8 237.8L804.4 237.0L803.0 234.6L802.6 232.2L803.0 229.6L804.6 227.8L805.1 229.6L807.0 231.2L808.8 230.6L810.5 230.8L812.2 229.4L813.5 229.2L816.1 230.0L818.4 229.4L819.8 225.5L820.9 224.5L821.8 221.4L825.0 221.4L827.5 221.8Z M859.4 241.1L862.4 241.9L863.4 244.1L861.1 242.9L858.8 242.7L857.2 242.9L855.3 242.8L855.9 241.2L859.4 241.1Z M852.4 243.9L850.5 243.4L850.0 242.2L852.8 242.0L853.5 242.9L852.4 243.9Z M855.4 227.3L855.6 228.8L857.2 229.1L857.5 230.2L857.3 232.6L855.9 232.3L855.5 234.0L856.6 235.5L855.8 235.8L854.7 234.1L853.9 230.5L854.4 228.3L855.4 227.3Z M841.5 230.9L844.7 230.8L847.4 228.8L847.9 229.4L845.7 232.1L843.6 232.7L840.9 232.1L836.3 232.3L833.8 232.7L833.4 234.8L835.9 237.2L837.4 236.0L842.6 235.0L842.4 236.3L841.2 235.9L840.0 237.5L837.5 238.6L840.2 242.2L839.6 243.1L842.1 246.3L842.1 248.2L840.6 249.0L839.5 248.0L840.9 245.7L838.2 246.8L837.5 246.0L837.8 245.0L835.8 243.3L836.0 240.6L834.2 241.5L834.4 244.7L834.5 248.7L832.8 249.1L831.6 248.3L832.4 245.7L831.9 243.0L830.8 243.0L829.9 241.1L831.1 239.3L831.5 237.1L832.8 232.9L833.4 231.8L835.8 229.7L838.0 230.5L841.5 230.9Z M834.2 261.8L830.5 259.9L833.1 259.3L834.5 260.2L835.5 261.0L835.3 261.8L834.2 261.8Z M837.1 257.0L838.9 256.8L841.4 255.8L841.0 257.4L836.8 258.1L833.1 257.8L833.1 256.8L835.3 256.2L837.1 257.0Z M828.5 256.6L830.2 256.3L830.9 257.5L827.7 258.1L825.8 258.4L824.3 258.4L825.2 256.8L826.8 256.8L827.5 255.8L828.5 256.6Z M801.4 251.2L801.7 252.2L807.1 252.4L807.7 251.3L812.8 252.6L813.8 254.4L818.0 254.9L821.4 256.6L818.2 257.6L815.2 256.5L812.7 256.6L809.8 256.4L807.2 255.9L804.0 254.8L801.9 254.6L800.8 254.9L795.7 253.8L795.2 252.6L792.7 252.4L794.6 249.7L798.0 249.9L800.2 251.0L801.4 251.2Z M789.9 236.3L790.4 238.3L791.4 239.8L793.4 240.1L794.7 241.8L794.0 245.3L793.9 249.6L790.9 249.6L788.5 247.3L785.0 245.1L783.8 243.4L781.7 241.1L780.3 239.0L778.2 235.1L775.7 232.8L774.9 230.4L773.9 228.3L771.4 226.5L769.9 224.1L767.8 222.6L764.9 219.5L764.7 218.1L766.5 218.2L770.8 218.8L773.2 221.5L775.4 223.4L776.9 224.5L779.6 227.5L782.4 227.5L784.7 229.4L786.3 231.8L788.4 233.0L787.3 235.3L788.9 236.3L789.9 236.3Z M847.1 258.0L847.5 257.4L849.9 256.8L851.8 256.7L852.7 256.3L853.7 256.7L852.7 257.4L849.8 258.6L847.5 259.4L847.4 258.6L847.1 258.0Z M599.2 142.5L598.7 143.4L597.7 143.0L597.2 144.8L597.8 145.1L597.1 145.5L597.0 146.2L598.3 145.9L598.4 146.9L597.0 151.4L596.7 150.7L595.2 146.6L595.2 146.6L595.2 146.6L596.0 145.7L595.8 145.5L596.5 144.2L597.1 142.1L597.5 141.4L597.6 141.4L598.5 141.4L598.8 140.9L599.5 140.9L599.5 142.0L599.2 142.5L599.2 142.5Z M599.5 140.9L598.8 140.9L598.5 141.4L597.6 141.4L598.6 139.2L599.9 137.2L600.0 137.1L601.2 137.2L601.7 138.3L600.2 139.4L599.5 140.9Z M598.3 145.9L597.0 146.2L597.1 145.5L597.8 145.1L597.2 144.8L597.7 143.0L598.7 143.4L598.7 145.0L598.3 145.9Z M598.7 143.4L599.2 142.5L602.3 143.6L607.8 140.6L608.9 144.0L608.3 144.4L602.8 145.8L605.6 148.6L604.6 149.1L604.2 150.0L602.1 150.4L601.4 151.4L600.2 152.2L597.1 151.8L597.0 151.4L598.4 146.9L598.3 145.9L598.7 145.0L598.7 143.4Z M643.3 166.0L643.8 165.8L643.9 166.6L646.0 166.2L648.3 166.2L650.0 166.3L651.9 164.5L654.0 162.7L655.8 161.0L656.3 161.9L656.7 164.1L655.2 164.1L655.0 165.9L655.5 166.3L654.2 166.9L654.2 168.0L653.4 169.1L653.4 170.3L652.8 170.8L644.4 169.4L643.4 166.6L643.3 166.0Z M641.1 164.6L641.0 162.5L641.7 161.1L642.5 160.8L643.3 161.7L643.4 163.3L642.7 164.9L642.0 165.1L641.1 164.6Z M633.3 150.1L633.8 151.3L633.6 151.9L634.5 154.0L632.5 154.1L631.8 152.8L629.4 152.5L631.4 149.8L633.3 150.1Z M608.9 144.0L607.8 140.6L613.9 137.7L615.0 134.4L614.7 132.3L616.2 131.7L617.6 129.9L618.8 129.5L622.1 129.8L623.0 130.6L624.4 130.1L626.2 133.4L628.0 134.2L628.2 135.9L626.8 136.8L626.2 139.0L628.1 141.6L631.5 143.1L632.9 145.3L632.5 147.3L633.3 147.3L633.4 148.7L634.9 150.2L633.3 150.1L631.4 149.8L629.4 152.5L624.2 152.3L616.4 146.7L612.2 144.8L608.9 144.0Z M653.4 170.3L653.4 169.1L654.2 168.0L654.2 166.9L655.5 166.3L655.0 165.9L655.2 164.1L656.7 164.1L657.9 166.0L659.5 167.0L661.5 167.4L663.1 167.9L664.4 169.5L665.1 170.4L666.1 170.7L666.1 171.4L665.1 173.0L664.7 173.8L663.5 174.7L662.5 176.6L661.2 176.4L660.6 177.1L660.2 178.5L660.5 180.4L660.3 180.7L659.0 180.7L657.2 181.7L657.0 183.1L656.3 183.7L654.6 183.7L653.5 184.4L653.5 185.5L652.2 186.2L650.7 186.0L648.8 186.9L647.5 187.1L646.6 185.1L644.4 180.6L652.8 177.8L654.6 172.2L653.4 170.3Z M656.3 161.9L655.8 161.0L656.6 160.0L656.9 160.3L656.6 161.4L656.3 161.9Z M785.0 199.5L784.3 196.1L786.1 193.8L789.7 193.3L792.3 193.7L794.6 194.8L795.8 192.9L798.3 193.9L798.9 195.7L798.6 199.1L793.9 201.2L795.1 202.9L792.2 203.1L789.8 204.2L787.5 203.8L786.4 202.4L785.0 199.5Z M792.3 193.7L789.7 193.3L786.1 193.8L784.3 196.1L785.0 199.5L782.5 198.2L780.1 198.3L780.5 196.1L778.0 196.1L777.8 199.1L776.3 203.2L775.4 205.7L775.6 207.7L777.4 207.8L778.6 210.3L779.1 212.7L780.6 214.3L782.3 214.6L783.7 216.1L782.8 217.2L781.0 217.5L780.8 216.1L778.5 214.9L778.0 215.4L776.9 214.3L776.4 212.9L775.0 211.4L773.6 210.0L773.2 211.7L772.6 210.1L772.9 208.4L773.8 205.7L775.1 202.9L776.6 200.3L775.5 197.8L775.6 196.5L775.3 194.9L773.4 192.7L772.8 191.3L773.7 190.8L774.7 188.4L773.6 186.6L771.8 184.5L770.5 182.1L771.7 181.6L772.9 178.6L774.9 178.5L776.5 177.3L778.1 176.6L779.3 177.5L779.5 179.1L781.3 179.3L780.7 182.2L780.7 184.7L783.6 183.0L784.5 183.5L786.1 183.4L786.7 182.5L788.8 182.7L790.9 184.9L791.1 187.7L793.3 190.1L793.2 192.4L792.3 193.7Z M798.3 193.9L795.8 192.9L794.6 194.8L792.3 193.7L793.2 192.4L793.3 190.1L791.1 187.7L790.9 184.9L788.8 182.7L786.7 182.5L786.1 183.4L784.5 183.5L783.6 183.0L780.7 184.7L780.7 182.2L781.3 179.3L779.5 179.1L779.3 177.5L778.1 176.6L778.7 175.6L781.1 173.8L781.3 174.4L782.8 174.5L782.4 171.3L783.8 170.9L785.4 173.1L786.7 175.6L790.1 175.7L791.2 178.1L789.4 178.8L788.6 179.8L791.9 181.5L794.2 184.8L796.0 187.2L798.1 189.1L798.8 191.1L798.3 193.9Z M778.1 176.6L776.5 177.3L774.9 178.5L772.9 178.6L771.7 181.6L770.5 182.1L771.8 184.5L773.6 186.6L774.7 188.4L773.7 190.8L772.8 191.3L773.4 192.7L775.3 194.9L775.6 196.5L775.5 197.8L776.6 200.3L775.1 202.9L773.8 205.7L773.5 203.7L774.3 201.6L773.4 199.9L773.6 196.9L772.5 195.4L771.6 192.1L771.1 188.6L769.9 186.3L768.1 187.7L764.9 189.7L763.4 189.4L761.6 188.8L762.6 185.3L762.0 182.7L759.8 179.5L760.2 178.5L758.6 178.2L756.6 175.9L756.4 173.7L757.4 174.1L757.4 172.1L758.8 171.4L758.5 170.3L759.1 169.3L759.2 166.4L761.4 167.1L762.6 164.8L762.8 163.4L764.3 161.1L764.2 159.5L767.8 157.6L769.8 158.1L769.6 156.4L770.6 155.9L770.4 154.8L772.0 154.6L772.9 156.3L774.1 156.9L774.2 159.0L774.1 161.3L771.5 163.7L771.1 167.0L774.1 166.5L774.7 169.0L776.5 169.6L775.7 171.9L777.7 172.9L778.9 173.4L781.0 172.6L781.1 173.8L778.7 175.6L778.1 176.6Z M789.8 204.2L792.2 203.1L795.1 202.9L793.9 201.2L798.6 199.1L798.9 195.7L798.3 193.9L798.8 191.1L798.1 189.1L796.0 187.2L794.2 184.8L791.9 181.5L788.6 179.8L789.4 178.8L791.2 178.1L790.1 175.7L786.7 175.6L785.4 173.1L783.8 170.9L785.3 170.3L787.5 170.3L790.2 169.9L792.6 168.5L793.9 169.5L796.5 170.0L796.0 171.6L797.3 172.7L800.1 173.5L796.4 175.8L794.1 178.5L793.5 180.4L795.6 183.3L798.2 187.0L800.7 188.7L802.4 190.9L803.7 196.0L803.3 200.9L801.0 202.8L797.8 204.5L795.6 206.9L792.1 209.4L791.1 207.7L791.9 205.8L789.8 204.2Z M862.9 115.6L862.9 115.6L863.3 116.1L862.2 115.9L861.0 116.8L860.2 117.8L860.3 119.8L858.9 120.4L858.4 120.9L857.3 121.7L855.5 122.2L854.3 122.9L854.2 124.1L853.8 124.4L855.0 124.9L856.5 126.1L856.1 126.7L854.9 126.9L853.0 127.1L851.9 128.3L850.7 128.2L850.5 128.5L849.1 127.9L848.8 128.5L848.0 128.7L847.9 128.2L847.2 127.9L846.4 127.5L847.2 126.3L847.8 125.9L847.6 125.4L848.3 123.9L848.1 123.5L846.5 123.2L845.2 122.4L847.4 120.6L850.5 119.1L852.4 117.2L853.7 118.0L856.1 118.1L855.7 116.7L860.0 115.5L861.1 113.9L862.9 115.6Z M850.5 128.5L850.7 128.2L851.9 128.3L853.0 127.1L854.9 126.9L856.1 126.7L856.5 126.1L858.9 129.4L859.6 131.2L859.6 134.4L858.6 135.9L856.1 136.4L853.9 137.6L851.3 137.8L851.0 136.3L851.6 134.2L850.3 131.3L852.4 130.9L850.5 128.5Z M743.8 96.4L746.7 95.9L752.0 93.5L756.2 92.2L758.6 93.1L761.5 93.1L763.4 94.4L766.2 94.5L770.2 95.2L772.9 93.3L771.7 91.6L774.6 88.8L777.7 89.9L780.2 90.2L783.5 90.9L784.0 93.0L788.0 94.2L790.6 93.7L794.1 93.3L796.9 93.7L799.6 95.0L801.3 96.4L803.9 96.4L807.4 96.9L809.9 96.2L813.6 95.7L817.7 93.8L819.3 94.1L820.8 95.0L824.1 94.8L822.8 96.8L820.8 99.6L821.5 100.8L823.1 100.4L825.8 100.8L828.0 99.8L830.2 100.7L832.7 102.6L832.4 103.6L830.2 103.3L826.2 103.7L824.2 104.5L822.2 106.3L817.9 107.4L815.2 108.9L812.3 108.3L810.8 108.0L809.3 109.8L810.2 110.9L810.6 111.8L808.7 112.8L806.7 114.2L803.5 115.2L799.3 115.3L794.8 116.3L791.6 117.8L790.3 116.9L787.0 116.9L782.9 115.2L780.1 114.8L776.4 115.2L770.7 114.6L767.6 114.7L766.0 113.0L764.7 110.4L763.0 110.1L759.7 108.4L755.9 108.0L752.6 107.5L751.6 106.3L752.7 103.1L750.8 100.9L746.8 99.8L744.5 98.3L743.8 96.4Z M770.4 154.8L769.6 156.4L767.8 157.6L764.3 161.1L762.6 164.8L759.2 166.4L758.5 170.3L757.4 172.1L755.2 167.7L753.2 168.0L755.3 166.3L755.0 163.5L749.8 163.1L748.2 161.1L745.0 161.8L745.3 164.3L746.4 166.0L746.9 169.8L746.9 173.1L741.6 173.6L740.3 177.4L733.2 182.5L728.3 186.1L726.9 188.0L723.1 189.2L722.9 194.9L721.8 199.8L720.4 204.7L720.0 207.7L716.5 210.4L712.8 208.6L710.4 201.9L708.0 197.9L706.8 192.7L703.1 183.5L702.3 176.6L697.7 175.7L692.1 172.0L692.6 169.9L691.2 165.7L696.8 163.3L694.9 159.7L696.2 155.6L702.3 152.9L706.7 147.3L709.1 143.7L705.8 140.4L706.2 136.8L713.5 137.1L719.2 138.0L720.0 141.7L717.9 142.7L721.4 147.5L723.5 150.8L725.2 154.4L731.4 157.3L736.8 159.1L742.3 160.0L744.9 158.9L744.8 155.9L746.7 157.5L749.3 159.1L753.4 158.9L755.8 157.1L757.0 155.8L762.7 152.0L767.0 151.5L767.4 154.4Z M757.4 172.1L757.4 174.1L756.4 173.7L756.6 175.9L755.8 174.5L755.6 173.1L755.1 171.7L753.9 170.1L751.4 170.0L751.6 171.1L750.8 172.7L749.6 172.1L749.2 172.6L748.4 172.3L747.3 172.1L746.9 169.8L745.9 167.7L746.4 166.0L744.7 165.3L745.3 164.3L747.0 163.2L745.0 161.8L746.0 159.9L748.2 161.1L749.5 161.2L749.8 163.1L752.4 163.5L755.0 163.5L756.6 164.0L755.3 166.3L754.1 166.5L753.2 168.0L754.7 169.5L755.2 167.7L756.0 167.7L757.4 172.1Z M754.7 156.2L755.8 157.1L755.6 158.8L753.4 158.9L751.0 158.7L749.3 159.1L746.8 158.1L746.7 157.5L748.5 155.4L750.0 154.7L752.0 155.4L753.5 155.4L754.7 156.2Z M744.8 155.9L744.6 157.1L744.9 158.9L744.6 160.0L742.3 160.0L739.0 159.4L736.8 159.1L735.2 157.7L731.4 157.3L727.8 155.8L725.2 154.4L722.5 153.3L723.5 150.8L725.3 149.5L726.5 148.8L728.7 149.7L731.5 151.5L733.1 151.9L734.0 153.2L736.1 153.8L738.4 155.0L741.5 155.6L744.8 155.9Z M716.2 134.7L713.5 137.1L710.4 137.5L706.2 136.8L704.9 138.0L705.8 140.4L706.8 142.3L709.1 143.7L706.7 145.3L706.7 147.3L704.0 150.1L702.3 152.9L699.4 155.8L696.2 155.6L693.1 158.5L694.9 159.7L695.2 161.9L696.8 163.3L697.3 165.7L691.2 165.7L689.4 167.5L687.3 166.8L686.5 164.8L684.4 162.7L679.3 163.2L674.7 163.3L670.8 163.7L671.9 160.4L675.9 159.0L675.6 157.7L674.3 157.3L674.2 154.8L671.6 153.6L670.5 151.9L669.1 150.5L673.7 151.9L676.5 151.5L678.2 151.8L678.8 151.2L680.7 151.5L684.3 150.3L684.4 147.9L685.9 146.4L688.0 146.4L688.3 145.6L690.4 145.2L691.5 145.5L692.5 144.7L692.4 143.1L693.6 141.4L695.3 140.7L694.3 138.8L696.9 138.9L697.7 137.9L697.5 136.9L698.9 135.7L698.6 134.3L698.0 133.1L699.6 131.9L702.6 131.3L705.7 131.0L707.2 130.5L708.8 130.2L710.8 131.5L711.6 133.6L716.2 134.7Z M684.8 129.5L686.3 129.6L688.4 130.2L689.3 130.5L691.3 129.6L692.2 130.1L693.1 128.9L694.8 128.9L695.2 128.5L695.5 127.4L696.7 126.4L698.2 127.1L697.9 127.9L698.7 128.0L698.5 130.4L699.6 131.3L700.5 130.7L701.8 130.4L703.5 129.2L705.4 129.4L708.3 129.4L708.8 130.2L707.2 130.5L705.7 131.0L702.6 131.3L699.6 131.9L698.0 133.1L698.6 134.3L698.9 135.7L697.5 136.9L697.7 137.9L696.9 138.9L694.3 138.8L695.3 140.7L693.6 141.4L692.4 143.1L692.5 144.7L691.5 145.5L690.4 145.2L688.3 145.6L688.0 146.4L685.9 146.4L684.4 147.9L684.3 150.3L680.7 151.5L678.8 151.2L678.2 151.8L676.5 151.5L673.7 151.9L669.1 150.5L671.6 148.0L671.4 146.2L669.3 145.7L669.1 143.9L668.2 141.7L669.3 140.2L668.1 139.8L668.9 137.8L670.0 134.3L672.9 135.4L675.0 135.0L675.5 133.7L677.7 133.3L679.3 132.5L679.9 130.2L682.2 129.7L682.6 128.7L683.9 129.5L684.8 129.5Z M688.4 130.2L690.0 127.3L689.4 125.3L687.3 124.6L688.1 123.4L690.4 123.5L691.7 122.0L692.6 120.2L696.3 119.6L695.7 120.8L696.1 121.6L697.3 121.5L696.2 122.4L693.2 121.9L693.0 123.5L696.0 123.3L699.4 124.2L704.7 123.8L705.4 126.4L706.3 126.1L708.0 126.7L707.9 127.8L708.3 129.4L705.4 129.4L703.5 129.2L701.8 130.4L700.5 130.7L699.6 131.3L698.5 130.4L698.7 128.0L697.9 127.9L698.2 127.1L696.7 126.4L695.5 127.4L695.2 128.5L694.8 128.9L693.1 128.9L692.2 130.1L691.3 129.6L689.3 130.5L688.4 130.2Z M697.1 115.9L697.7 114.7L699.6 114.3L704.1 115.3L704.6 113.6L706.1 113.1L710.1 114.2L711.1 113.9L715.7 114.0L719.8 114.3L721.2 115.3L722.9 115.7L722.6 116.3L718.2 117.8L717.2 118.9L713.6 119.3L712.6 121.0L709.6 120.7L707.7 121.2L705.1 122.5L705.4 123.2L704.7 123.8L699.4 124.2L696.0 123.3L693.0 123.5L693.2 121.9L696.2 122.4L697.3 121.5L699.4 121.8L702.9 119.8L699.6 118.4L697.7 119.0L695.6 118.0L697.9 116.2L697.1 115.9Z M645.8 117.3L647.1 116.3L650.2 115.8L652.1 116.5L654.0 118.7L655.5 118.6L658.6 118.5L658.1 117.1L660.5 116.2L662.9 114.6L666.6 116.0L666.9 118.3L668.0 118.8L671.0 118.7L671.9 119.2L673.3 122.1L676.4 124.0L678.3 125.3L681.2 126.7L684.9 127.8L684.8 129.5L683.9 129.5L682.6 128.7L682.2 129.7L679.9 130.2L679.3 132.5L677.7 133.3L675.5 133.7L675.0 135.0L672.9 135.4L670.0 134.3L669.8 132.0L667.7 131.9L664.5 129.4L662.3 129.1L659.3 127.7L657.3 127.4L656.1 128.0L654.2 127.9L652.2 129.5L649.8 130.0L649.3 128.0L649.7 125.1L647.5 124.2L648.2 122.3L646.4 122.1L647.0 119.8L649.6 120.5L652.0 119.6L650.0 117.9L649.2 116.3L647.0 117.0L646.7 119.1L645.8 117.3Z M634.9 150.2L633.4 148.7L633.3 147.3L632.5 147.3L632.9 145.3L631.5 143.1L628.1 141.6L626.2 139.0L626.8 136.8L628.2 135.9L628.0 134.2L626.2 133.4L624.4 130.1L624.4 130.1L622.8 127.9L623.4 127.0L622.5 123.8L624.4 123.0L624.9 124.1L626.3 125.3L628.2 125.7L629.2 125.6L632.5 123.6L633.5 123.4L634.3 124.2L633.4 125.6L635.1 127.0L635.8 126.9L636.7 128.9L639.3 129.5L641.2 130.9L645.2 131.4L649.5 130.7L649.8 130.0L652.2 129.5L654.2 127.9L656.1 128.0L657.3 127.4L659.3 127.7L662.3 129.1L664.5 129.4L667.7 131.9L669.8 132.0L670.0 134.3L668.9 137.8L668.1 139.8L669.3 140.2L668.2 141.7L669.1 143.9L669.3 145.7L671.4 146.2L671.6 148.0L669.1 150.5L670.5 151.9L671.6 153.6L674.2 154.8L674.3 157.3L675.6 157.7L675.9 159.0L671.9 160.4L670.8 163.7L665.6 162.8L662.6 162.2L659.4 161.8L658.3 158.4L656.9 157.9L654.8 158.4L652.0 159.8L648.6 158.9L645.8 156.7L643.1 155.9L641.3 153.3L639.2 149.6L637.7 150.0L635.9 149.1L634.9 150.2Z M599.2 142.5L599.2 142.5L599.5 142.0L599.5 140.9L600.2 139.4L601.7 138.3L601.2 137.2L600.0 137.1L599.7 135.0L600.4 133.8L601.2 133.2L601.9 132.6L602.1 131.1L603.0 131.6L606.0 130.8L607.5 131.4L609.8 131.3L613.0 130.3L614.5 130.3L617.6 129.9L616.2 131.7L614.7 132.3L615.0 134.4L613.9 137.7L607.8 140.6L602.3 143.6L599.2 142.5Z M629.2 125.6L628.2 125.7L627.0 124.1L627.1 123.7L625.8 123.7L625.0 122.9L624.4 123.0L623.3 122.2L621.3 121.5L621.5 120.2L621.1 119.2L624.9 118.8L625.5 119.5L626.6 120.0L626.0 120.7L627.5 121.6L626.7 122.5L627.9 123.3L629.1 123.7L629.2 125.6Z M624.4 130.1L623.0 130.6L622.1 129.8L618.8 129.5L617.6 129.9L614.5 130.3L613.0 130.3L609.8 131.3L607.5 131.4L606.0 130.8L603.0 131.6L602.1 131.1L601.9 132.6L601.2 133.2L600.4 133.8L599.4 132.6L600.4 131.5L598.8 131.8L596.4 131.1L594.5 132.7L590.3 133.0L588.1 131.5L585.1 131.5L584.4 132.6L582.5 132.9L579.8 131.5L576.8 131.5L575.1 128.7L573.1 127.2L574.5 125.0L572.7 123.7L575.8 121.1L580.1 120.9L581.2 118.8L586.5 119.2L589.9 117.4L593.1 116.6L597.7 116.6L602.5 118.5L606.5 119.6L609.8 119.2L612.1 119.4L615.4 118.0L618.4 117.8L621.1 119.2L621.5 120.2L621.3 121.5L623.3 122.2L624.4 123.0L622.5 123.8L623.4 127.0L622.8 127.9L624.4 130.1L624.4 130.1Z M572.5 117.1L575.4 116.3L577.8 116.6L578.1 117.7L580.5 118.6L580.0 119.3L576.7 119.4L575.5 120.3L573.2 121.8L572.3 120.5L572.4 119.9L573.0 119.6L573.9 117.9L572.5 117.1Z M727.2 212.4L726.8 215.3L725.6 216.1L723.2 216.8L721.9 214.5L721.4 210.6L722.6 206.0L724.6 207.6L725.8 209.5L727.2 212.4Z M804.1 182.8L801.8 181.9L801.7 179.5L803.1 178.3L806.1 177.5L807.7 177.6L808.4 178.6L807.1 179.8L806.5 181.4L804.1 182.8Z M722.9 115.7L724.6 113.4L727.6 107.5L731.1 101.9L738.1 101.5L740.6 98.5L743.8 96.4L746.8 99.8L752.7 103.1L752.6 107.5L759.7 108.4L764.7 110.4L767.6 114.7L776.4 115.2L782.9 115.2L790.3 116.9L794.8 116.3L803.5 115.2L808.7 112.8L810.2 110.9L810.8 108.0L815.2 108.9L822.2 106.3L826.2 103.7L832.4 103.6L830.2 100.7L825.8 100.8L821.5 100.8L822.8 96.8L827.4 95.8L831.3 92.8L835.4 89.0L833.8 86.8L839.6 84.9L847.4 85.7L851.6 89.5L853.6 92.4L859.4 96.0L863.9 100.6L870.5 99.5L873.6 101.2L871.6 105.2L866.3 107.4L864.7 110.8L862.9 114.2L861.1 113.9L855.7 116.7L853.7 118.0L850.5 119.1L845.2 122.4L839.3 124.5L837.7 124.0L839.4 121.0L835.5 120.6L830.6 124.3L826.5 125.7L830.2 128.1L832.5 130.1L838.1 129.2L840.3 130.7L835.1 133.0L831.0 136.4L835.1 140.6L838.6 145.3L836.8 148.1L839.1 150.5L838.0 154.9L834.4 158.2L829.6 165.1L821.9 170.0L817.1 171.6L814.6 172.1L807.7 173.9L805.2 177.0L805.2 173.9L800.1 173.5L796.0 171.6L793.9 169.5L790.2 169.9L785.3 170.3L782.4 171.3L781.3 174.4L781.0 172.6L777.7 172.9L776.5 169.6L774.1 166.5L771.5 163.7L774.2 159.0L772.9 156.3L770.4 154.8L768.3 153.2L765.0 152.7L759.5 153.8L754.7 156.2L752.0 155.4L748.5 155.4L746.5 155.3L741.5 155.6L736.1 153.8L733.1 151.9L728.7 149.7L725.3 149.5L718.7 145.8L719.9 143.1L718.9 140.3L716.2 134.7L710.8 131.5L708.3 129.4L708.0 126.7L705.4 126.4L705.4 123.2L707.7 121.2L712.6 121.0L717.2 118.9L722.6 116.3Z M838.3 165.6L836.6 170.0L835.4 172.3L833.9 170.0L833.6 167.9L835.3 165.2L837.5 163.1L838.8 163.9L838.3 165.6Z M628.9 117.1L629.7 117.1L631.6 118.8L632.8 119.0L633.3 118.3L635.0 117.2L636.4 118.7L637.8 120.6L639.1 120.8L640.0 121.5L637.7 121.7L637.2 123.9L636.7 124.9L635.7 125.5L635.8 126.9L635.1 127.0L633.4 125.6L634.3 124.2L633.5 123.4L632.5 123.6L629.2 125.6L629.1 123.7L627.9 123.3L626.7 122.5L627.5 121.6L626.0 120.7L626.6 120.0L625.5 119.5L624.9 118.8L625.6 118.3L627.7 119.1L629.2 119.3L629.5 118.9L628.2 117.4L628.9 117.1Z M628.2 125.7L626.3 125.3L624.9 124.1L624.4 123.0L625.0 122.9L625.8 123.7L627.1 123.7L627.0 124.1L628.2 125.7Z M611.0 112.7L611.3 112.4L613.7 112.8L617.8 113.3L621.5 114.6L622.0 115.1L623.7 114.7L626.3 115.3L627.2 116.4L628.9 117.1L628.2 117.4L629.5 118.9L629.2 119.3L627.7 119.1L625.6 118.3L624.9 118.8L621.1 119.2L618.4 117.8L615.4 118.0L615.8 116.8L615.1 114.9L613.5 113.9L612.0 113.5L611.0 112.7Z M835.6 198.0L834.2 195.9L836.6 196.0L837.6 197.0L836.8 199.4L835.6 198.0Z M840.5 205.6L841.2 204.8L841.5 203.1L843.1 202.9L842.6 204.8L844.7 202.1L844.4 204.8L843.4 205.7L842.5 207.4L841.7 208.3L839.9 206.4L840.5 205.6Z M851.0 210.0L851.3 211.8L851.5 213.4L850.5 215.9L849.5 213.1L848.2 214.5L849.1 216.5L848.3 217.8L845.1 216.2L844.3 214.2L845.1 212.9L843.4 211.6L842.5 212.7L841.2 212.6L839.1 214.2L838.7 213.4L839.8 211.0L841.5 210.2L843.0 209.2L844.0 210.4L846.1 209.7L846.6 208.4L848.5 208.4L848.4 206.2L850.6 207.5L850.9 208.9L851.0 210.0Z M829.2 207.5L825.5 210.1L826.8 208.1L828.9 206.4L830.5 204.5L832.0 201.8L832.5 204.0L830.6 205.5L829.2 207.5Z M839.8 182.7L839.4 183.9L840.3 185.9L839.6 188.2L838.0 189.1L837.5 191.3L838.1 193.5L839.6 193.8L840.8 193.5L844.3 195.0L844.0 196.6L844.9 197.2L844.7 198.5L842.5 197.1L841.5 195.7L840.8 196.7L839.0 195.0L836.5 195.5L835.1 194.8L835.2 193.7L836.1 193.0L835.3 192.3L834.9 193.3L833.5 191.7L833.1 190.5L833.0 187.9L834.1 188.8L834.4 184.4L835.3 181.9L837.0 181.9L838.7 182.7L839.6 182.0L839.8 182.7Z M839.0 201.6L838.6 200.3L840.2 201.2L842.0 201.2L841.9 202.3L840.7 203.5L838.9 204.3L838.8 203.0L839.0 201.6Z M848.6 199.5L849.4 202.6L847.3 201.9L847.3 202.8L848.0 204.6L846.7 205.2L846.6 203.2L845.7 203.1L845.3 201.4L846.9 201.6L846.9 200.6L845.2 198.5L847.9 198.5L848.6 199.5Z M778.0 215.4L778.5 214.9L780.8 216.1L781.0 217.5L782.8 217.2L783.7 216.1L784.4 216.3L786.0 218.0L787.2 219.8L787.3 221.7L787.0 223.0L787.3 223.9L787.5 225.6L788.5 226.3L789.6 228.8L789.5 229.7L787.6 229.9L784.9 227.9L781.6 225.7L781.3 224.2L779.7 222.4L779.3 220.1L778.3 218.6L778.6 216.6L778.0 215.4Z M827.5 221.8L825.0 221.4L821.8 221.4L820.9 224.5L819.8 225.5L818.4 229.4L816.1 230.0L813.5 229.2L812.2 229.4L810.5 230.8L808.8 230.6L807.0 231.2L805.1 229.6L804.6 227.8L806.7 228.7L808.8 228.2L809.4 225.8L810.5 225.3L813.9 224.7L815.9 222.5L817.2 220.8L818.5 222.2L819.1 221.3L820.4 221.3L820.6 219.6L820.7 218.2L822.8 216.3L824.2 214.1L825.4 214.1L826.8 215.5L826.9 216.7L828.7 217.5L831.1 218.3L830.9 219.4L829.0 219.5L829.5 220.9L827.5 221.8Z M820.7 218.2L820.6 219.6L820.4 221.3L819.1 221.3L818.5 222.2L817.2 220.8L818.3 219.7L820.7 218.2Z M894.1 124.5L891.6 127.3L891.6 130.2L890.6 132.4L891.0 133.8L889.6 135.7L886.0 137.0L881.2 137.2L877.2 140.4L875.3 139.3L875.2 137.2L870.4 137.8L867.1 139.2L863.9 139.2L866.7 141.3L864.8 146.0L863.0 147.1L861.7 146.1L862.4 143.6L860.6 142.7L859.5 140.8L862.1 140.0L863.6 138.2L866.3 136.8L868.4 134.9L873.9 134.1L876.9 134.6L879.8 129.7L881.6 131.0L885.7 128.3L887.3 127.2L889.0 123.8L888.6 120.7L889.7 118.9L892.7 118.4L894.2 122.2L894.1 124.5Z M901.7 111.2L903.7 110.0L904.3 113.2L900.2 113.9L897.7 116.7L893.4 114.8L891.9 117.8L888.8 117.9L888.4 115.1L889.8 113.0L892.7 112.8L893.5 109.0L894.4 106.8L897.6 109.7L899.8 110.6L901.7 111.2Z M867.7 140.4L869.2 138.7L870.8 139.0L872.0 137.9L874.0 138.5L874.4 139.4L872.8 141.1L871.6 140.2L870.2 140.9L869.5 142.5L867.7 141.7L867.7 140.4Z M644.4 180.6L646.6 185.1L647.5 187.1L645.5 187.8L645.0 189.1L644.9 190.0L642.1 191.2L637.7 192.5L635.2 194.4L634.0 194.6L633.2 194.4L631.5 195.6L629.8 196.1L627.4 196.3L626.7 196.4L626.1 197.1L625.4 197.4L625.0 198.1L623.6 198.0L622.7 198.4L620.8 198.2L620.1 196.6L620.1 195.1L619.7 194.3L619.1 192.2L618.3 191.1L618.9 190.9L618.6 189.7L619.0 189.1L618.8 187.9L620.1 187.0L619.8 185.9L620.5 184.5L621.6 185.2L622.4 185.0L625.6 184.9L626.1 185.2L628.8 185.5L629.9 185.3L630.6 186.3L631.9 185.8L633.8 182.9L636.4 181.6L644.4 180.6Z M597.1 151.8L600.2 152.2L601.4 151.4L602.1 150.4L604.2 150.0L604.6 149.1L605.6 148.6L602.8 145.8L608.3 144.4L608.9 144.0L612.2 144.8L616.4 146.7L624.2 152.3L629.4 152.5L631.8 152.8L632.5 154.1L634.5 154.0L635.6 156.4L636.9 157.1L637.4 158.0L639.3 159.2L639.5 160.3L639.2 161.3L639.6 162.2L640.4 163.0L640.7 163.9L641.1 164.6L642.0 165.1L642.7 164.9L643.3 166.0L643.4 166.6L644.4 169.4L652.8 170.8L653.4 170.3L654.6 172.2L652.8 177.8L644.4 180.6L636.4 181.6L633.8 182.9L631.9 185.8L630.6 186.3L629.9 185.3L628.8 185.5L626.1 185.2L625.6 184.9L622.4 185.0L621.6 185.2L620.5 184.5L619.8 185.9L620.1 187.0L618.8 187.9L618.5 186.7L617.6 185.9L617.4 184.8L616.0 183.8L614.5 181.5L613.7 179.2L611.8 177.3L610.6 176.8L608.7 174.2L608.4 172.3L608.5 170.6L606.9 167.5L605.6 166.4L604.1 165.9L603.2 164.3L603.4 163.7L602.6 162.2L601.8 161.6L600.7 159.5L599.0 157.3L597.6 155.4L596.2 155.4L596.6 153.9L596.8 152.9L597.1 151.8Z M590.9 135.7L591.1 135.7L591.5 135.0L593.5 135.1L596.0 134.2L594.2 135.4L594.4 135.9L594.1 135.9L593.5 136.1L593.1 136.0L593.0 136.1L592.9 135.8L592.7 135.7L592.2 135.6L591.4 135.9L590.9 135.7Z M590.9 135.7L591.4 135.9L592.2 135.6L592.7 135.7L592.9 135.8L593.0 136.1L593.1 136.0L593.5 136.1L594.1 135.9L594.4 135.9L594.5 136.2L591.6 137.3L590.3 136.9L589.6 135.8L590.9 135.7Z", "af": "M594.2 236.0L594.6 236.3L604.7 241.9L604.9 243.5L608.9 246.3L607.6 249.7L607.8 251.3L609.6 252.3L609.6 253.1L608.9 254.7L609.0 255.6L608.9 256.9L609.8 258.6L611.0 261.4L612.0 262.0L612.0 262.0L609.8 263.6L606.7 264.7L605.1 264.6L604.1 265.5L602.2 265.5L601.4 265.9L598.1 265.1L596.0 265.3L595.2 261.6L594.3 260.3L593.7 259.5L591.0 259.0L589.4 258.1L587.7 257.7L586.5 257.2L585.4 256.5L585.4 256.5L583.9 253.0L582.3 251.4L581.7 249.8L582.0 248.4L581.5 245.8L582.6 245.7L583.7 244.7L584.7 243.2L585.4 242.7L585.4 241.8L584.8 241.1L584.6 240.0L584.6 240.0L585.4 239.7L585.6 238.1L584.5 236.5L585.5 236.2L588.5 236.2L594.2 236.0Z M475.9 156.5L475.9 156.7L475.9 157.2L475.9 161.4L466.8 161.3L466.8 168.4L464.2 168.7L463.6 170.1L464.1 174.1L453.2 174.1L452.6 175.0L452.7 173.8L452.8 173.8L459.0 173.6L459.4 172.6L460.5 171.4L461.4 167.5L465.3 164.5L466.6 161.0L467.4 160.8L468.4 158.7L470.7 158.4L471.7 158.7L473.0 158.7L473.9 158.1L475.6 158.0L475.5 156.5L475.9 156.5Z M581.5 245.8L581.7 249.8L583.9 253.0L585.4 256.5L580.6 256.7L579.0 258.8L579.2 263.3L579.6 266.6L582.3 267.2L580.4 270.1L578.2 267.4L575.5 265.6L571.5 266.1L568.8 264.6L567.4 263.8L565.2 263.5L562.2 263.9L561.7 260.8L560.6 258.1L560.4 255.3L557.0 253.6L555.8 252.6L553.9 253.2L552.8 255.5L550.4 255.5L547.5 254.3L546.0 251.7L537.2 249.6L535.4 249.9L533.8 249.4L534.6 247.9L536.1 246.6L537.8 245.8L539.5 246.6L542.1 245.4L544.5 243.2L545.6 238.2L548.7 235.4L549.1 233.5L549.4 231.0L550.3 226.8L551.3 223.6L552.6 220.3L556.4 220.3L560.2 221.6L563.1 220.5L564.7 220.5L568.9 219.7L570.2 219.0L573.3 219.0L576.0 218.8L579.0 221.4L581.0 221.1L583.2 221.7L585.6 223.6L586.6 227.2L584.6 228.9L583.0 231.7L582.2 235.0L581.4 237.8L580.9 239.7L581.3 242.5Z M615.5 238.0L613.9 235.7L613.8 225.6L616.3 222.4L617.0 221.6L618.8 221.5L621.3 219.6L624.9 219.4L632.7 211.1L634.7 208.8L635.9 207.1L635.9 205.6L635.9 202.8L636.0 201.7L636.0 201.6L636.0 201.6L636.9 201.6L638.1 201.2L639.6 200.9L640.9 199.9L642.0 199.9L642.0 200.7L641.8 202.3L641.8 203.8L641.2 204.8L640.4 207.8L639.1 210.9L637.4 214.4L635.0 218.5L632.6 221.6L629.3 225.4L626.6 227.7L622.4 230.4L619.8 232.5L616.8 235.9L616.1 237.4L615.5 238.0Z M608.9 246.3L604.9 243.5L604.7 241.9L594.6 236.3L594.2 236.0L594.1 233.0L594.9 231.9L596.3 230.1L597.3 228.0L596.1 224.9L595.8 223.5L594.5 221.5L596.2 219.9L598.1 218.0L599.5 218.5L599.5 220.1L600.4 221.0L602.4 221.0L605.9 223.3L606.8 223.4L607.4 223.3L608.0 223.6L609.9 223.8L610.7 222.7L613.2 221.5L614.4 222.4L616.3 222.4L613.8 225.6L613.9 235.7L615.5 238.0L613.6 239.1L612.9 240.3L611.8 240.5L611.4 242.4L610.6 243.6L610.0 245.4L608.9 246.3Z M568.2 210.5L565.2 208.5L565.4 206.4L563.8 203.6L563.5 201.7L562.5 199.3L560.9 198.4L561.9 196.2L562.5 194.2L562.7 191.8L566.4 190.0L566.2 177.8L569.4 172.2L591.4 172.2L603.3 174.9L603.1 178.3L605.2 182.3L605.3 184.9L602.4 186.2L600.9 192.2L600.8 195.7L597.9 199.8L596.5 203.0L594.3 206.7L594.3 207.0L594.0 205.6L592.2 203.6L592.2 199.5L590.8 199.9L589.8 200.9L588.5 204.1L585.7 206.4L582.3 205.3L580.6 206.7L577.7 207.2L575.3 206.6L573.5 206.8L571.6 204.4L568.9 206.1L567.2 209.1L568.2 210.5Z M566.2 178.9L566.4 190.0L564.0 189.8L562.7 191.8L562.0 193.5L562.5 194.2L561.6 195.0L561.9 196.2L561.2 197.3L560.9 198.4L561.9 198.2L562.5 199.3L562.5 200.9L563.5 201.7L563.5 202.4L561.8 202.9L560.3 204.0L558.3 207.0L555.7 208.3L553.0 208.1L552.3 208.4L552.5 209.4L551.1 210.3L549.9 211.4L546.4 212.5L545.7 211.8L545.3 211.8L544.7 212.5L542.4 212.7L542.9 212.0L542.0 210.0L541.6 208.9L540.4 208.4L538.8 206.8L539.4 205.5L540.6 205.8L541.4 205.6L543.0 205.6L541.5 203.1L541.6 201.2L541.4 199.4L540.3 197.6L540.5 196.3L538.8 196.2L538.8 194.5L537.6 193.4L538.8 189.8L542.4 187.1L542.5 183.5L543.6 177.9L544.2 176.7L543.0 175.7L543.0 174.9L541.9 174.1L541.3 169.8L544.1 168.3L555.1 173.6L566.2 178.9Z M545.4 312.7L547.8 312.1L549.5 313.5L552.8 313.8L555.3 302.1L557.7 305.2L558.0 307.9L561.4 306.3L563.4 304.2L565.9 303.9L569.5 304.8L571.6 303.3L573.6 301.7L575.3 298.8L581.8 294.7L584.2 295.2L586.6 295.1L588.7 301.0L588.4 305.1L586.2 304.8L585.2 306.7L586.9 309.1L589.1 307.6L590.5 309.6L589.5 313.2L587.0 315.0L585.1 317.8L580.3 322.7L576.3 325.6L572.0 326.9L569.9 327.2L565.5 327.2L562.7 327.4L557.5 328.9L554.5 330.1L552.4 329.0L551.0 328.2L550.7 325.8L550.7 323.4L548.8 318.7L547.4 316.3Z M580.5 313.8L581.5 314.6L580.6 316.0L580.1 316.9L578.6 317.3L578.1 318.2L577.1 318.5L575.0 316.3L576.5 314.6L578.0 313.5L579.3 312.9L580.5 313.8Z M586.6 295.1L585.2 294.9L584.2 295.2L582.9 294.7L581.8 294.7L580.0 293.4L577.8 293.0L577.0 291.3L577.0 290.3L575.8 290.0L572.7 286.9L571.8 285.3L571.2 284.8L570.2 282.6L573.3 282.9L574.2 283.2L575.1 283.2L576.7 281.4L579.1 279.1L580.1 278.9L580.4 277.9L582.0 276.8L584.1 276.4L584.3 277.4L586.6 277.4L587.9 278.0L588.5 278.7L589.8 278.9L591.2 279.8L591.2 283.3L590.7 285.2L590.6 287.3L591.0 288.1L590.7 289.7L590.3 290.0L589.6 292.0L586.6 295.1Z M581.8 294.7L577.8 296.7L575.3 298.8L574.4 300.7L573.6 301.7L572.1 301.9L571.6 303.3L571.3 304.1L569.5 304.8L567.3 304.6L565.9 303.9L564.8 303.5L563.4 304.2L562.7 305.5L561.4 306.3L560.0 307.6L558.0 307.9L557.4 306.9L557.7 305.2L556.0 302.5L555.3 302.1L555.3 294.0L558.0 293.9L558.1 284.0L560.2 283.9L564.4 283.0L565.5 284.1L567.3 283.0L568.1 283.0L569.7 282.4L570.2 282.6L571.2 284.8L571.8 285.3L572.7 286.9L575.8 290.0L577.0 290.3L577.0 291.3L577.8 293.0L580.0 293.4L581.8 294.7Z M555.3 302.1L555.3 312.4L552.8 313.8L551.3 314.0L549.5 313.5L548.3 313.3L547.8 312.1L546.7 311.3L545.4 312.7L543.3 310.6L542.3 308.6L541.6 305.9L541.0 303.9L540.0 299.6L540.0 296.3L539.6 294.8L538.5 293.6L537.1 291.3L535.6 288.0L535.0 286.2L532.8 283.5L532.6 281.4L533.9 280.9L535.6 280.4L537.4 280.5L539.1 281.7L539.5 281.5L550.7 281.4L552.7 282.7L559.4 283.1L564.5 282.0L566.8 281.4L568.6 281.5L569.7 282.2L569.7 282.4L568.1 283.0L567.3 283.0L565.5 284.1L564.4 283.0L560.2 283.9L558.1 284.0L558.0 293.9L555.3 294.0L555.3 302.1Z M453.6 195.6L452.4 193.4L451.0 192.4L452.3 191.9L453.6 189.9L454.3 188.5L455.2 187.6L456.6 187.9L458.0 187.3L459.5 187.2L460.8 188.0L462.7 188.8L464.4 190.8L466.2 192.7L466.3 194.5L466.9 196.0L467.9 196.8L468.1 197.9L468.0 198.8L467.6 198.9L466.1 198.7L465.9 199.0L465.3 199.1L463.3 198.4L461.9 198.4L456.8 198.3L456.1 198.6L455.1 198.5L453.7 198.9L453.2 196.8L455.7 196.9L456.4 196.5L456.9 196.4L457.9 195.8L459.1 196.4L460.3 196.4L461.5 195.8L461.0 195.0L460.1 195.5L459.2 195.5L458.1 194.8L457.2 194.8L456.6 195.5L453.6 195.6Z M468.0 198.8L468.1 197.9L467.9 196.8L466.9 196.0L466.3 194.5L466.2 192.7L467.1 192.2L467.6 190.6L468.5 190.5L470.4 191.3L472.0 190.7L473.1 190.9L473.5 190.3L484.6 190.3L485.2 188.3L484.8 188.0L483.4 176.0L482.1 164.0L486.3 164.0L495.7 170.0L505.1 176.1L505.7 177.4L507.5 178.2L508.7 178.6L508.8 180.4L511.9 180.1L511.9 186.5L510.3 188.4L510.1 190.1L507.6 190.5L503.8 190.8L502.8 191.8L501.0 191.9L499.3 191.9L498.6 191.3L497.0 191.7L494.4 192.9L493.9 193.8L491.8 195.0L491.4 195.7L490.2 196.3L488.9 195.9L488.1 196.6L487.7 198.5L485.5 200.8L485.6 201.7L484.8 202.9L485.0 204.5L483.8 204.9L483.2 205.3L482.8 204.1L482.0 204.4L481.5 204.4L481.0 205.2L478.8 205.1L478.1 204.7L477.7 205.0L476.8 204.2L477.0 203.4L476.6 203.0L476.1 203.3L476.2 202.4L476.7 201.7L475.6 200.5L475.3 199.8L474.6 199.1L474.1 199.1L473.4 199.5L472.5 199.8L471.8 200.4L470.6 200.2L469.8 199.5L469.3 199.4L468.6 199.8L468.2 199.8L468.0 198.8Z M452.6 175.0L453.2 174.1L464.1 174.1L463.6 170.1L464.2 168.7L466.8 168.4L466.8 161.3L475.9 161.4L475.9 157.2L486.3 164.0L482.1 164.0L483.4 176.0L484.8 188.0L485.2 188.3L484.6 190.3L473.5 190.3L473.1 190.9L472.0 190.7L470.4 191.3L468.5 190.5L467.6 190.6L467.1 192.2L466.2 192.7L464.4 190.8L462.7 188.8L460.8 188.0L459.5 187.2L458.0 187.3L456.6 187.9L455.2 187.6L454.3 188.5L454.0 187.0L454.8 185.6L455.1 183.0L454.8 180.3L454.5 178.9L454.8 177.5L454.1 176.2L452.6 175.0Z M507.5 215.9L505.2 216.3L504.5 214.4L504.6 208.0L504.1 207.4L504.0 206.0L503.0 205.1L502.1 204.2L502.5 202.8L503.5 202.5L504.0 201.3L505.4 201.0L506.0 200.2L506.9 199.4L507.9 199.3L510.0 200.9L509.9 201.9L510.5 203.5L510.0 204.6L510.3 205.4L508.9 207.1L508.1 208.0L507.6 209.7L507.6 211.5L507.5 215.9Z M541.3 169.8L541.9 174.1L543.0 174.9L543.0 175.7L544.2 176.7L543.6 177.9L542.5 183.5L542.4 187.1L538.8 189.8L537.6 193.4L538.8 194.5L538.8 196.2L540.5 196.3L540.3 197.6L539.5 197.8L539.4 198.7L538.9 198.7L537.0 195.7L536.3 195.6L534.2 197.1L532.0 196.3L530.5 196.1L529.7 196.5L528.1 196.5L526.5 197.6L525.0 197.7L521.7 196.3L520.4 196.9L518.9 196.9L517.9 195.9L515.1 194.8L512.1 195.1L511.4 195.7L511.0 197.3L510.2 198.5L510.0 200.9L507.9 199.3L506.9 199.4L506.0 200.2L506.0 198.3L502.8 197.6L502.8 196.3L501.2 194.5L500.8 193.2L501.0 191.9L502.8 191.8L503.8 190.8L507.6 190.5L510.1 190.1L510.3 188.4L511.9 186.5L511.9 180.1L515.8 178.9L523.8 173.4L533.3 168.1L537.7 169.3L539.3 170.9L541.3 169.8Z M507.5 215.9L507.6 211.5L507.6 209.7L508.1 208.0L508.9 207.1L510.3 205.4L510.0 204.6L510.5 203.5L509.9 201.9L510.0 200.9L510.2 198.5L511.0 197.3L511.4 195.7L512.1 195.1L515.1 194.8L517.9 195.9L518.9 196.9L520.4 196.9L521.7 196.3L525.0 197.7L526.5 197.6L528.1 196.5L529.7 196.5L530.5 196.1L532.0 196.3L534.2 197.1L536.3 195.6L537.0 195.7L538.9 198.7L539.4 198.7L540.5 199.8L540.2 200.3L540.0 201.2L537.7 203.3L537.0 205.1L536.6 206.6L536.0 207.2L535.4 209.1L533.9 210.3L533.5 211.7L532.9 212.8L532.6 213.9L530.7 214.9L529.2 213.7L528.1 213.8L526.5 215.4L525.6 215.4L524.3 218.1L523.6 220.1L520.7 221.1L519.7 220.9L518.6 221.6L516.4 221.5L514.9 219.8L514.0 217.7L512.0 215.9L509.9 215.9L507.5 215.9Z M540.3 197.6L541.4 199.4L541.6 201.2L541.5 203.1L543.0 205.6L541.4 205.6L540.6 205.8L539.4 205.5L538.8 206.8L540.4 208.4L541.6 208.9L542.0 210.0L542.9 212.0L542.4 212.7L541.0 215.5L540.4 216.0L540.2 218.2L540.4 219.4L540.2 220.2L541.5 221.6L541.8 222.6L542.8 224.1L544.1 225.0L544.2 226.2L544.5 227.0L544.3 228.5L542.1 227.9L539.8 227.1L536.3 227.0L536.0 226.9L534.3 227.2L532.6 226.9L531.3 227.1L526.8 227.0L527.2 224.8L526.1 223.0L524.9 222.5L524.3 221.2L523.6 220.8L523.6 220.1L524.3 218.1L525.6 215.4L526.5 215.4L528.1 213.8L529.2 213.7L530.7 214.9L532.6 213.9L532.9 212.8L533.5 211.7L533.9 210.3L535.4 209.1L536.0 207.2L536.6 206.6L537.0 205.1L537.7 203.3L540.0 201.2L540.2 200.3L540.5 199.8L539.4 198.7L539.5 197.8L540.3 197.6Z M502.5 202.8L502.1 204.2L503.0 205.1L504.0 206.0L504.1 207.4L504.6 208.0L504.5 214.4L505.2 216.3L502.9 216.9L502.3 215.9L501.6 214.1L501.4 212.7L502.0 210.2L501.3 209.2L501.0 207.0L501.0 205.0L499.9 203.6L500.1 202.7L502.5 202.8Z M500.1 202.7L499.9 203.6L501.0 205.0L501.0 207.0L501.3 209.2L502.0 210.2L501.4 212.7L501.6 214.1L502.3 215.9L502.9 216.9L498.6 218.5L497.0 219.4L494.5 220.2L492.1 219.5L492.2 218.4L491.0 216.0L491.7 212.8L492.9 210.5L492.1 206.5L491.8 204.5L491.8 202.9L496.7 202.8L497.9 203.0L498.8 202.5L500.1 202.7Z M477.7 205.0L478.1 204.7L478.8 205.1L481.0 205.2L481.5 204.4L482.0 204.4L482.8 204.1L483.2 205.3L483.8 204.9L485.0 204.5L486.2 205.1L486.7 206.1L488.0 206.6L488.9 205.9L490.2 205.8L492.1 206.5L492.9 210.5L491.7 212.8L491.0 216.0L492.2 218.4L492.1 219.5L490.8 219.5L488.9 218.9L487.1 219.0L483.8 219.5L481.9 220.3L479.1 221.3L478.6 221.2L478.8 218.9L479.1 218.6L479.0 217.5L477.8 216.3L476.9 216.1L476.1 215.4L476.7 214.1L476.4 212.8L476.6 212.0L477.0 212.0L477.2 210.8L476.9 210.2L477.2 209.8L478.2 209.5L477.6 207.3L476.9 206.1L477.1 205.2L477.7 205.0Z M461.9 198.4L463.3 198.4L465.3 199.1L465.9 199.0L466.1 198.7L467.6 198.9L468.0 198.8L468.2 199.8L468.6 199.8L469.3 199.4L469.8 199.5L470.6 200.2L471.8 200.4L472.5 199.8L473.4 199.5L474.1 199.1L474.6 199.1L475.3 199.8L475.6 200.5L476.7 201.7L476.2 202.4L476.1 203.3L476.6 203.0L477.0 203.4L476.8 204.2L477.7 205.0L477.1 205.2L476.9 206.1L477.6 207.3L478.2 209.5L477.2 209.8L476.9 210.2L477.2 210.8L477.0 212.0L476.6 212.0L475.8 211.9L475.2 213.0L474.4 213.0L473.9 212.4L474.1 211.3L472.9 209.6L472.2 209.9L471.6 210.0L470.8 210.1L470.8 209.1L470.4 208.4L470.5 207.6L469.9 206.4L469.1 205.4L466.9 205.4L466.2 205.9L465.5 206.0L465.0 206.6L464.7 207.4L463.2 208.6L462.0 207.0L460.9 205.9L460.2 205.5L459.5 205.0L459.2 203.7L458.8 203.1L458.0 202.7L459.2 201.3L460.0 201.4L460.8 200.9L461.4 200.9L461.8 200.5L461.6 199.6L461.9 199.3L461.9 198.4Z M453.7 198.9L455.1 198.5L456.1 198.6L456.8 198.3L461.9 198.4L461.9 199.3L461.6 199.6L461.8 200.5L461.4 200.9L460.8 200.9L460.0 201.4L459.2 201.3L458.0 202.7L456.5 201.5L455.3 201.3L454.7 200.5L454.7 200.1L453.9 199.5L453.7 198.9Z M476.6 212.0L476.4 212.8L476.7 214.1L476.1 215.4L476.9 216.1L477.8 216.3L479.0 217.5L479.1 218.6L478.8 218.9L478.6 221.2L477.8 221.2L475.0 219.9L472.5 217.8L470.1 216.3L468.2 214.5L468.9 213.6L469.0 212.8L470.3 211.3L471.6 210.0L472.2 209.9L472.9 209.6L474.1 211.3L473.9 212.4L474.4 213.0L475.2 213.0L475.8 211.9L476.6 212.0Z M463.2 208.6L464.7 207.4L465.0 206.6L465.5 206.0L466.2 205.9L466.9 205.4L469.1 205.4L469.9 206.4L470.5 207.6L470.4 208.4L470.8 209.1L470.8 210.1L471.6 210.0L470.3 211.3L469.0 212.8L468.9 213.6L468.2 214.5L467.5 214.3L465.5 213.2L464.0 211.7L463.5 210.7L463.2 208.6Z M485.0 204.5L484.8 202.9L485.6 201.7L485.5 200.8L487.7 198.5L488.1 196.6L488.9 195.9L490.2 196.3L491.4 195.7L491.8 195.0L493.9 193.8L494.4 192.9L497.0 191.7L498.6 191.3L499.3 191.9L501.0 191.9L500.8 193.2L501.2 194.5L502.8 196.3L502.8 197.6L506.0 198.3L506.0 200.2L505.4 201.0L504.0 201.3L503.5 202.5L502.5 202.8L500.1 202.7L498.8 202.5L497.9 203.0L496.7 202.8L491.8 202.9L491.8 204.5L492.1 206.5L490.2 205.8L488.9 205.9L488.0 206.6L486.7 206.1L486.2 205.1L485.0 204.5Z M576.0 218.8L575.1 219.1L573.3 219.0L571.3 218.7L570.2 219.0L569.8 219.6L568.9 219.7L567.8 219.1L564.7 220.5L563.4 220.2L563.1 220.5L562.2 222.1L560.2 221.6L558.1 221.3L556.4 220.3L554.1 219.4L552.6 220.3L551.5 221.7L551.3 223.6L549.5 223.4L547.6 223.0L545.9 224.4L544.5 227.0L544.2 226.2L544.1 225.0L542.8 224.1L541.8 222.6L541.5 221.6L540.2 220.2L540.4 219.4L540.2 218.2L540.4 216.0L541.0 215.5L542.4 212.7L544.7 212.5L545.3 211.8L545.7 211.8L546.4 212.5L549.9 211.4L551.1 210.3L552.5 209.4L552.3 208.4L553.0 208.1L555.7 208.3L558.3 207.0L560.3 204.0L561.8 202.9L563.5 202.4L563.8 203.6L565.4 205.3L565.4 206.4L565.0 207.6L565.2 208.5L566.1 209.3L568.2 210.5L569.8 211.6L569.8 212.5L571.7 213.9L572.8 215.1L573.5 216.8L575.6 217.9L576.0 218.8Z M551.3 223.6L551.1 225.3L550.3 226.8L549.7 228.5L549.4 231.0L549.5 232.5L549.1 233.5L549.0 234.5L548.7 235.4L546.8 236.7L545.6 238.2L544.4 240.9L544.5 243.2L543.8 244.0L542.1 245.4L540.5 247.1L539.5 246.6L539.3 245.9L537.8 245.8L536.8 246.9L536.1 246.6L535.1 245.7L534.2 246.1L533.1 247.3L530.8 244.4L532.9 242.9L531.9 241.0L532.8 240.3L534.7 240.0L534.9 238.7L536.4 240.1L538.9 240.2L539.7 238.9L540.1 237.0L539.8 234.9L538.5 233.2L539.7 230.0L539.0 229.5L536.9 229.7L536.1 228.2L536.3 227.0L539.8 227.1L542.1 227.9L544.3 228.5L544.5 227.0L545.9 224.4L547.6 223.0L549.5 223.4L551.3 223.6Z M531.3 227.1L532.6 226.9L534.3 227.2L536.0 226.9L536.3 227.0L536.1 228.2L536.9 229.7L539.0 229.5L539.7 230.0L538.5 233.2L539.8 234.9L540.1 237.0L539.7 238.9L538.9 240.2L536.4 240.1L534.9 238.7L534.7 240.0L532.8 240.3L531.9 241.0L532.9 242.9L530.8 244.4L528.0 241.6L526.1 239.3L524.4 236.4L524.5 235.5L525.1 234.6L525.8 232.6L526.4 230.5L527.3 230.4L531.3 230.4L531.3 227.1Z M526.8 227.0L531.3 227.1L531.3 230.4L527.3 230.4L526.4 230.5L525.8 230.1L526.8 227.0Z M585.4 256.5L586.5 257.2L587.7 257.7L589.4 258.1L591.0 259.0L592.3 260.2L593.0 262.6L592.5 263.3L592.0 265.6L592.5 267.9L591.6 268.8L590.8 271.4L592.3 272.1L583.8 274.4L584.1 276.4L582.0 276.8L580.4 277.9L580.1 278.9L579.1 279.1L576.7 281.4L575.1 283.2L574.2 283.2L573.3 282.9L570.2 282.6L569.7 282.4L569.7 282.2L568.6 281.5L566.8 281.4L564.5 282.0L562.7 280.3L560.8 278.0L560.9 269.2L566.7 269.2L566.5 268.2L566.9 267.2L566.4 265.9L566.7 264.5L566.4 263.7L567.4 263.8L567.5 264.6L568.8 264.6L570.6 264.8L571.5 266.1L573.8 266.5L575.5 265.6L576.1 267.0L578.2 267.4L579.2 268.6L580.4 270.1L582.5 270.2L582.3 267.2L581.5 267.7L579.6 266.6L578.8 266.1L579.2 263.3L579.6 260.0L579.0 258.8L579.8 257.0L580.6 256.7L584.3 256.2L585.4 256.5Z M591.0 259.0L593.7 259.5L594.3 260.3L595.2 261.6L596.0 265.3L595.2 267.4L596.0 271.1L597.0 271.0L598.0 271.9L599.1 273.9L599.4 277.5L598.2 278.1L597.3 280.0L595.5 278.3L595.3 276.3L595.9 275.0L595.7 273.9L594.6 273.2L593.9 273.5L592.3 272.1L590.8 271.4L591.6 268.8L592.5 267.9L592.0 265.6L592.5 263.3L593.0 262.6L592.3 260.2L591.0 259.0Z M596.0 265.3L598.1 265.1L601.4 265.9L602.2 265.5L604.1 265.5L605.1 264.6L606.7 264.7L609.8 263.6L612.0 262.0L612.0 262.0L612.0 262.0L612.4 263.2L612.3 266.0L612.7 268.4L612.8 272.8L613.3 274.1L612.4 276.1L611.4 278.1L609.6 279.8L607.1 280.8L603.9 282.2L600.8 285.2L599.7 285.7L597.8 287.6L596.6 288.3L596.4 290.3L597.7 292.4L598.3 294.0L598.3 294.8L598.8 294.7L598.7 297.4L598.3 298.7L598.9 299.2L598.5 300.3L597.3 301.3L595.0 302.3L591.7 303.8L590.5 304.8L590.7 306.0L591.4 306.2L591.2 307.6L589.1 307.6L588.8 306.4L588.4 305.1L588.2 304.1L588.7 301.0L588.0 299.1L586.6 295.1L589.6 292.0L590.3 290.0L590.7 289.7L591.0 288.1L590.6 287.3L590.7 285.2L591.2 283.3L591.2 279.8L589.8 278.9L588.5 278.7L587.9 278.0L586.6 277.4L584.3 277.4L584.1 276.4L583.8 274.4L592.3 272.1L593.9 273.5L594.6 273.2L595.7 273.9L595.9 275.0L595.3 276.3L595.5 278.3L597.3 280.0L598.2 278.1L599.4 277.5L599.1 273.9L598.0 271.9L597.0 271.0L596.0 271.1L595.2 267.4L596.0 265.3Z M589.1 307.6L588.5 308.8L586.9 309.1L585.2 307.6L585.2 306.7L586.0 305.6L586.2 304.8L587.0 304.6L588.4 305.1L588.8 306.4L589.1 307.6Z M536.1 246.6L535.1 247.2L534.6 247.9L534.5 249.1L533.8 249.4L533.1 247.3L534.2 246.1L535.1 245.7L536.1 246.6Z M534.2 250.3L535.4 249.9L536.2 250.0L537.2 249.6L545.4 249.7L546.0 251.7L546.8 253.4L547.5 254.3L548.5 255.7L550.4 255.5L551.3 255.1L552.8 255.5L553.2 254.8L553.9 253.2L555.7 253.1L555.8 252.6L557.2 252.6L557.0 253.6L560.4 253.6L560.4 255.3L561.0 256.4L560.6 258.1L560.8 259.8L561.7 260.8L561.5 264.1L562.2 263.9L563.4 263.9L565.2 263.5L566.4 263.7L566.7 264.5L566.4 265.9L566.9 267.2L566.5 268.2L566.7 269.2L560.9 269.2L560.8 278.0L562.7 280.3L564.5 282.0L559.4 283.1L552.7 282.7L550.7 281.4L539.5 281.5L539.1 281.7L537.4 280.5L535.6 280.4L533.9 280.9L532.6 281.4L532.3 279.6L532.7 277.2L533.7 274.7L533.8 273.5L534.7 271.0L535.4 269.8L537.0 268.0L537.9 266.8L538.2 264.7L538.0 263.1L537.2 262.1L536.4 260.5L535.8 258.8L535.9 258.2L536.8 257.1L535.9 254.4L535.4 252.6L534.0 250.8L534.2 250.3Z M584.6 240.0L584.8 241.1L585.4 241.8L585.4 242.7L584.7 243.2L583.7 244.7L582.6 245.7L581.5 245.8L581.3 242.5L580.6 241.2L582.3 241.4L583.2 239.9L584.6 240.0Z M637.6 268.0L638.4 269.2L639.0 271.0L639.5 274.3L640.2 275.6L639.9 277.0L639.4 277.8L638.5 276.2L638.0 277.0L638.5 279.0L638.3 280.2L637.5 280.9L637.3 283.2L636.2 286.4L634.9 290.3L633.1 295.5L632.1 299.4L630.8 302.6L628.6 303.3L626.1 304.4L624.5 303.7L622.3 302.7L621.6 301.3L621.4 298.8L620.4 296.6L620.2 294.6L620.6 292.6L621.9 292.1L621.9 291.2L623.3 289.1L623.5 287.3L622.9 286.0L622.3 284.3L622.1 281.7L623.1 280.1L623.5 278.4L624.8 278.3L626.4 277.7L627.4 277.2L628.6 277.2L630.2 275.6L632.5 273.9L633.3 272.5L633.0 271.3L634.1 271.6L635.7 269.7L635.7 268.0L636.7 266.8L637.6 268.0Z M453.6 195.6L456.6 195.5L457.2 194.8L458.1 194.8L459.2 195.5L460.1 195.5L461.0 195.0L461.5 195.8L460.3 196.4L459.1 196.4L457.9 195.8L456.9 196.4L456.4 196.5L455.7 196.9L453.2 196.8L453.6 195.6Z M526.3 149.1L525.2 144.2L523.4 143.0L523.4 142.4L521.1 140.7L520.9 138.6L522.6 137.1L523.3 134.8L522.8 132.1L523.4 130.7L526.4 129.6L528.4 129.9L528.3 131.3L530.6 130.3L530.8 130.8L529.4 132.2L529.4 133.5L530.4 134.2L530.0 136.6L528.2 138.0L528.7 139.5L530.2 139.5L530.9 140.9L531.9 141.3L531.8 143.4L530.4 144.2L529.5 145.1L527.6 146.2L527.9 147.3L527.7 148.5L526.3 149.1Z M475.9 157.2L475.9 156.7L475.9 156.5L475.9 153.2L480.4 151.2L483.2 150.7L485.4 150.0L486.5 148.6L489.7 147.5L489.9 145.5L491.5 145.2L492.7 144.2L496.4 143.7L496.9 142.6L496.1 142.0L495.2 139.1L495.0 137.4L494.0 135.6L496.6 134.1L499.6 133.6L501.4 132.5L504.1 131.7L508.8 131.2L513.4 130.9L514.8 131.3L517.4 130.2L520.4 130.2L521.5 130.9L523.4 130.7L522.8 132.1L523.3 134.8L522.6 137.1L520.9 138.6L521.1 140.7L523.4 142.4L523.4 143.0L525.2 144.2L526.3 149.1L527.2 151.6L527.4 152.9L526.9 155.2L527.1 156.4L526.7 157.9L527.0 159.7L525.9 160.8L527.5 162.9L527.6 164.1L528.6 165.6L529.9 165.1L532.1 166.4L533.3 168.1L523.8 173.4L515.8 178.9L511.9 180.1L508.8 180.4L508.7 178.6L507.5 178.2L505.7 177.4L505.1 176.1L495.7 170.0L486.3 164.0L475.9 157.2Z M601.2 193.3L600.9 192.2L602.1 188.1L602.4 186.2L603.2 185.4L605.3 184.9L606.7 183.3L608.3 186.6L609.1 189.1L610.6 190.5L614.4 193.1L615.9 194.7L617.4 196.3L618.3 197.2L619.7 198.1L618.8 198.7L617.6 198.5L616.7 197.6L615.6 196.0L614.3 195.1L613.6 194.1L611.2 193.0L609.3 193.0L608.6 192.4L607.0 193.0L605.3 191.8L604.4 193.9L601.2 193.3Z M494.0 135.6L495.0 137.4L495.2 139.1L496.1 142.0L496.9 142.6L496.4 143.7L492.7 144.2L491.5 145.2L489.9 145.5L489.7 147.5L486.5 148.6L485.4 150.0L483.2 150.7L480.4 151.2L475.9 153.2L475.9 156.5L475.5 156.5L475.6 158.0L473.9 158.1L473.0 158.7L471.7 158.7L470.7 158.4L468.4 158.7L467.4 160.8L466.6 161.0L465.3 164.5L461.4 167.5L460.5 171.4L459.4 172.6L459.0 173.6L452.8 173.8L452.7 173.8L452.9 172.5L453.9 171.8L454.8 170.3L454.6 169.4L455.6 167.4L457.1 165.7L458.1 165.2L458.8 163.6L458.9 162.1L459.9 160.4L461.7 159.4L463.5 156.6L463.6 156.5L464.9 155.4L467.5 155.1L469.7 153.2L471.1 152.5L473.4 150.2L472.7 146.7L473.8 144.3L474.2 142.9L476.0 141.0L478.7 139.7L480.8 138.6L482.7 135.7L483.5 134.0L485.6 134.0L487.2 135.2L489.9 135.0L492.8 135.6L494.0 135.6Z M602.4 172.2L591.4 172.2L580.6 172.2L569.4 172.2L569.4 162.0L569.4 152.1L568.6 149.9L569.3 148.2L568.9 147.0L569.9 145.6L573.6 145.6L576.3 146.3L579.0 147.2L580.3 147.6L582.5 146.7L583.6 145.9L586.0 145.7L588.0 146.0L588.8 147.4L589.4 146.5L591.6 147.2L593.8 147.3L595.2 146.6L595.2 146.6L596.7 150.7L597.0 151.4L596.2 152.5L595.6 154.6L594.9 156.0L594.2 156.5L593.3 155.6L592.0 154.4L590.1 150.4L589.8 150.7L590.9 153.6L592.6 156.4L594.7 160.7L595.8 162.2L596.7 163.8L599.1 166.9L598.6 167.4L598.7 169.2L601.9 171.7L602.4 172.2Z M569.4 172.2L569.4 177.8L566.2 177.8L566.2 178.9L555.1 173.6L544.1 168.3L541.3 169.8L539.3 170.9L537.7 169.3L533.3 168.1L532.1 166.4L529.9 165.1L528.6 165.6L527.6 164.1L527.5 162.9L525.9 160.8L527.0 159.7L526.7 157.9L527.1 156.4L526.9 155.2L527.4 152.9L527.2 151.6L526.3 149.1L527.7 148.5L527.9 147.3L527.6 146.2L529.5 145.1L530.4 144.2L531.8 143.4L531.9 141.3L535.2 142.2L536.3 142.0L538.7 142.5L542.3 143.7L543.6 146.2L546.1 146.7L550.1 147.9L553.0 149.3L554.4 148.5L555.7 147.3L555.1 145.1L555.9 143.8L557.9 142.5L559.8 142.1L563.6 142.7L564.5 143.9L565.6 143.9L566.5 144.4L569.2 144.7L569.9 145.6L568.9 147.0L569.3 148.2L568.6 149.9L569.4 152.1L569.4 162.0L569.4 172.2Z M632.7 211.1L624.9 219.4L621.3 219.6L618.8 221.5L617.0 221.6L616.3 222.4L614.4 222.4L613.2 221.5L610.7 222.7L609.9 223.8L608.0 223.6L607.4 223.3L606.8 223.4L605.9 223.3L602.4 221.0L600.4 221.0L599.5 220.1L599.5 218.5L598.1 218.0L596.4 215.0L595.1 214.4L594.7 213.3L593.2 211.9L591.5 211.7L592.5 210.1L594.0 210.1L594.4 209.2L594.3 206.7L595.2 203.8L596.5 203.0L596.8 201.9L597.9 199.8L599.6 198.4L600.8 195.7L601.2 193.3L604.4 193.9L605.3 191.8L607.0 193.0L608.6 192.4L609.3 193.0L611.2 193.0L613.6 194.1L614.3 195.1L615.6 196.0L616.7 197.6L617.6 198.5L616.7 199.7L615.7 201.0L615.9 201.8L616.0 202.6L617.5 202.7L618.2 202.5L618.8 203.0L618.2 204.0L619.2 205.5L620.3 206.8L621.3 207.8L630.4 211.1L632.7 211.1Z M617.6 198.5L618.8 198.7L619.7 198.1L620.3 198.9L620.2 200.1L618.7 200.7L619.8 201.5L618.8 203.0L618.2 202.5L617.5 202.7L616.0 202.6L615.9 201.8L615.7 201.0L616.7 199.7L617.6 198.5Z M636.0 201.6L636.0 201.6L636.0 201.7L635.9 202.8L635.9 205.6L635.9 207.1L634.7 208.8L632.7 211.1L630.4 211.1L621.3 207.8L620.3 206.8L619.2 205.5L618.2 204.0L618.8 203.0L619.8 201.5L620.8 202.0L621.3 203.2L622.5 204.3L623.9 204.3L626.5 203.6L629.6 203.3L632.0 202.4L633.4 202.2L634.4 201.7L636.0 201.6L636.0 201.6Z M594.2 236.0L588.5 236.2L585.5 236.2L584.5 236.5L582.8 237.3L582.2 237.1L582.2 235.0L582.8 233.9L583.0 231.7L583.6 230.4L584.6 228.9L585.7 228.2L586.6 227.2L585.5 226.8L585.6 223.6L585.6 223.6L586.8 222.8L588.6 223.4L590.8 222.8L592.8 222.8L594.5 221.5L595.8 223.5L596.1 224.9L597.3 228.0L596.3 230.1L594.9 231.9L594.1 233.0L594.2 236.0Z M584.5 236.5L585.6 238.1L585.4 239.7L584.6 240.0L584.6 240.0L583.2 239.9L582.3 241.4L580.6 241.2L580.9 239.7L581.3 239.5L581.4 237.8L582.2 237.1L582.8 237.3L584.5 236.5Z M585.6 223.6L583.2 221.7L582.5 220.6L581.0 221.1L579.7 221.0L579.0 221.4L577.7 221.1L576.0 218.8L575.6 217.9L573.5 216.8L572.8 215.1L571.7 213.9L569.8 212.5L569.8 211.6L568.2 210.5L566.4 209.4L567.2 209.1L568.2 208.6L568.9 206.1L569.6 204.8L571.6 204.4L572.1 205.2L573.5 206.8L574.3 207.0L575.3 206.6L577.3 206.7L577.7 207.2L580.5 207.2L580.6 206.7L582.0 206.1L582.3 205.3L583.3 204.7L585.7 206.4L587.1 206.1L588.5 204.1L590.0 202.6L589.8 200.9L589.1 200.1L590.8 199.9L591.0 199.3L592.2 199.5L591.9 201.6L592.2 203.6L593.7 204.7L594.0 205.6L594.0 207.0L594.3 207.0L594.4 209.2L594.0 210.1L592.5 210.1L591.5 211.7L593.2 211.9L594.7 213.3L595.1 214.4L596.4 215.0L598.1 218.0L596.2 219.9L594.5 221.5L592.8 222.8L590.8 222.8L588.6 223.4L586.8 222.8L585.6 223.6Z", "oc": "M1000.0 278.0L1000.0 279.3L998.2 280.0L996.5 280.6L996.1 279.6L997.5 279.0L998.4 278.8L1000.0 278.0Z M994.8 282.0L995.5 281.5L996.4 282.3L996.0 283.8L994.3 284.1L992.7 283.8L992.5 282.6L993.5 281.6L994.8 282.0Z M891.7 240.6L896.5 242.5L901.6 244.1L903.5 245.5L905.1 246.9L905.5 248.5L910.1 250.2L910.8 251.7L908.3 252.0L908.9 253.9L911.3 255.7L913.2 258.6L914.7 258.5L914.6 259.8L916.8 260.2L915.9 260.8L918.9 261.9L918.6 262.7L916.7 262.9L916.1 262.2L913.7 261.9L910.9 261.5L908.7 259.7L907.1 258.2L905.7 255.7L902.1 254.5L899.7 255.3L898.0 256.2L898.4 258.3L896.2 259.2L894.6 258.8L891.8 258.7L891.7 249.6L891.7 240.6Z M924.0 243.5L925.1 244.4L925.4 245.8L924.5 246.6L924.0 244.9L923.4 243.9L922.1 243.0L920.5 241.8L918.5 240.9L919.3 240.3L920.8 241.1L921.7 241.7L922.9 242.3L924.0 243.5Z M920.3 249.6L918.8 250.2L917.3 250.9L915.9 250.9L913.6 250.1L912.0 249.3L912.2 248.4L914.7 248.8L916.2 248.6L916.7 247.3L917.1 247.2L917.3 248.7L918.9 248.5L919.7 247.5L921.2 246.5L920.9 244.9L922.6 244.9L923.2 245.3L923.1 246.9L922.2 248.6L920.7 248.8L920.3 249.6Z M929.9 248.2L930.7 248.8L932.1 250.6L933.4 251.5L933.0 252.3L932.2 252.6L931.0 251.5L929.8 249.7L929.2 247.6L929.6 247.3L929.9 248.2Z M963.3 276.9L962.9 276.1L962.9 274.0L964.2 274.8L964.6 277.1L963.9 276.7L963.3 276.9Z M960.5 291.9L962.8 293.6L964.2 294.9L963.2 295.6L961.6 294.8L959.7 293.6L957.9 292.1L956.0 290.1L955.6 289.2L956.8 289.2L958.4 290.2L959.6 291.1L960.5 291.9Z M950.3 262.5L951.1 263.4L949.2 263.4L948.1 261.7L949.8 262.4L950.3 262.5Z M949.1 260.0L948.7 260.5L946.6 258.1L946.1 256.4L947.0 256.4L948.0 258.7L949.1 260.0Z M946.8 260.8L945.7 260.8L944.0 260.5L943.4 260.1L943.6 259.0L945.5 259.4L946.4 260.0L946.8 260.8Z M943.4 255.6L944.1 256.5L944.2 257.1L942.0 255.9L940.5 254.9L939.5 253.9L939.9 253.7L941.2 254.3L943.4 255.6Z M936.5 252.8L937.6 253.7L937.1 253.9L935.8 253.3L934.7 252.1L934.8 251.7L936.5 252.8Z M991.3 344.6L990.3 346.1L988.9 348.0L986.8 349.1L986.3 348.4L985.1 348.0L986.7 345.7L985.8 344.2L982.8 343.1L982.9 342.1L984.9 341.1L985.4 339.0L985.3 337.2L984.1 335.3L984.2 334.8L982.9 333.7L980.7 331.2L979.5 329.2L980.6 329.0L982.1 330.6L984.2 331.3L985.0 333.8L987.0 336.7L987.1 334.8L988.4 335.6L988.8 337.7L991.0 338.6L992.9 338.8L994.5 337.7L995.9 338.0L995.2 340.5L994.4 342.1L992.2 342.1L991.5 342.9L991.8 344.1L991.3 344.6Z M971.3 354.3L973.7 352.9L975.3 351.4L976.6 349.4L977.6 348.7L978.0 347.1L980.0 345.8L980.6 347.0L981.2 348.1L983.2 347.0L984.0 348.2L984.0 349.4L983.0 350.6L981.2 352.7L979.8 353.8L980.8 355.1L978.6 355.2L976.3 356.2L975.5 358.0L973.9 360.9L971.8 362.1L970.4 362.9L967.8 362.8L966.0 361.9L963.0 361.7L962.5 360.7L964.0 358.6L967.5 355.9L969.3 355.4L971.3 354.3Z M910.2 346.7L911.9 346.9L912.1 350.2L911.2 351.1L910.9 353.4L909.9 352.6L908.0 354.5L907.4 354.4L905.7 354.3L904.0 351.9L903.6 350.1L902.0 347.7L902.1 346.4L903.9 346.6L906.6 347.6L908.1 347.2L910.2 346.7Z M850.4 322.8L845.1 324.9L843.5 327.5L839.4 327.8L834.9 327.6L831.4 329.2L829.2 329.9L825.8 330.6L821.0 328.9L819.6 326.7L821.4 325.7L821.7 322.8L819.9 318.3L819.6 315.2L818.4 312.5L816.8 309.3L814.8 305.9L815.1 304.5L817.3 306.4L815.9 302.8L815.0 301.1L815.9 298.8L815.9 295.8L817.3 295.9L820.7 293.0L824.2 290.8L826.2 291.0L830.1 289.6L831.3 288.8L835.7 288.0L837.9 285.3L839.7 282.8L841.7 278.9L844.1 280.7L843.9 278.1L845.5 276.6L847.7 274.1L849.1 272.9L850.4 272.5L853.0 271.7L856.6 274.6L860.1 274.9L860.8 271.2L861.6 269.7L864.5 267.2L868.3 267.0L866.2 264.6L869.5 264.9L873.3 266.8L875.8 267.4L878.5 266.8L880.4 267.6L878.6 270.3L878.0 271.5L876.2 274.2L878.6 276.5L882.2 278.4L885.0 280.0L886.8 281.6L891.3 281.6L892.4 278.9L893.6 275.1L893.4 273.0L893.5 269.3L893.6 267.8L894.8 264.8L895.9 263.0L896.9 266.1L897.7 267.6L898.9 270.6L899.8 273.7L902.5 273.9L903.5 276.2L904.5 280.0L906.0 282.7L906.6 286.0L911.6 288.8L913.1 290.6L915.8 295.4L918.0 296.0L919.2 298.5L922.4 301.3L925.4 305.8L925.3 309.1L926.4 313.9L925.2 317.6L924.7 321.2L921.4 325.1L919.5 328.6L917.6 332.4L916.5 336.4L915.1 338.3L909.4 339.5L906.4 341.8L902.4 340.0L901.3 339.1L896.5 340.4L893.4 339.7L888.9 337.2L887.7 333.7L883.7 332.3L883.9 328.8L880.1 331.3L882.0 328.1L882.8 324.7L878.8 328.0L875.6 329.1L873.9 325.6L873.0 323.9L867.5 322.2L859.8 321.1L853.1 323.0Z"};
const WM_W=1000, WM_H=388.9;
const maxRegion = Math.max(...regions.map(r => (byRegion[r]||[]).length)) || 1;
const REGION_GEO = { na:[-100,48], sa:[-58,-15], eu:[15,52], as:[95,45], af:[20,2], oc:[134,-25] };
function geoXY(lon,lat){ return [ (lon+180)/360*WM_W, (84-lat)/140*WM_H ]; }
let _svg = '<svg class="wm-svg" viewBox="0 0 '+WM_W+' '+WM_H+'" preserveAspectRatio="xMidYMid meet">';
['af','sa','na','as','eu','oc'].forEach(function(r){ if(REGION_PATHS[r]) _svg += '<path class="wm-region" data-region="'+r+'" style="--c:'+(REGION_COLORS[r]||'#cbd5e1')+'" d="'+REGION_PATHS[r]+'"/>'; });
_svg += '</svg>';
regionGrid.innerHTML = '<div class="wm-inner">' + _svg + '<div class="wm-pins" id="wmPins"></div></div>';
const wmPins = document.getElementById('wmPins');
regions.forEach(r => {
  const ct = (byRegion[r] || []).length; if (!ct || !REGION_GEO[r]) return;
  const xy = geoXY(REGION_GEO[r][0], REGION_GEO[r][1]);
  const left = (xy[0]/WM_W*100).toFixed(2), top = (xy[1]/WM_H*100).toFixed(2);
  const size = Math.round(22 + (ct/maxRegion)*26);
  const btn = document.createElement('button');
  btn.className='wm-pin'; btn.dataset.region=r;
  btn.style.left=left+'%'; btn.style.top=top+'%';
  btn.style.setProperty('--c', REGION_COLORS[r] || 'var(--accent)');
  btn.style.setProperty('--sz', size+'px');
  btn.setAttribute('aria-label', (REGION_KO[r]||REGION_LABELS[r])+' 파트너 '+ct+'곳');
  btn.innerHTML = '<span class="wm-ring"></span><span class="wm-dot">'+ct+'</span>'
    + '<span class="wm-tip">'+(REGION_KO[r]||'')+' <b>'+REGION_LABELS[r]+'</b> · '+ct+'곳</span>';
  wmPins.appendChild(btn);
});
bindOnce(regionGrid, 'click', e => {
  const hit = e.target.closest('.wm-pin, .wm-region');
  if (!hit) return;
  const r = hit.dataset.region;
  currentRegion = (currentRegion === r) ? 'all' : r;
  applyPartnersFilter();
});

function applyPartnersFilter() {
  let visible = 0;
  document.querySelectorAll('.partner').forEach(el => {
    const show = currentRegion === 'all' || el.dataset.region === currentRegion;
    el.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('visibleCountPartners').textContent = `${visible} of ${PARTNERS.length} partners`;
  document.getElementById('emptyPartners').style.display = visible === 0 ? 'block' : 'none';

  document.querySelectorAll('.wm-pin').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });
  document.querySelectorAll('.wm-region').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });
  const wm = document.getElementById('worldMap');
  if (wm) wm.classList.toggle('has-active', currentRegion !== 'all');

  document.querySelectorAll('#regionChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });

  resetBtn.classList.toggle('visible', currentRegion !== 'all');
}

bindOnce(regionChips, 'click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  currentRegion = btn.dataset.region;
  applyPartnersFilter();
});

bindOnce(resetBtn, 'click', () => {
  currentRegion = 'all';
  applyPartnersFilter();
});

applyPartnersFilter();
} /* ===== end renderData() ===== */

/* ========== CASE STUDY DETAIL RENDER ========== */
const CASE_HERO_BG = {
  'us-army': '/images/case-hero-us-army.jpg',
  'exxonmobil': '/images/img-31.jpg',
  'gs-eps': '/images/case-hero-gs-eps.jpg',
  'microsoft': '/images/case-hero-microsoft.jpg',
  'cbre': '/images/img-35.jpg',
  'walmart': '/images/img-36.jpg',
  'hyundai-motors': '/images/case-hero-hyundai-motors.jpg',
  'samsung-biologics': '/images/img-45.jpg'
};
/* 카드 배너(가로형)에서 정사각형 사진의 핵심 피사체가 보이도록 표시 위치 보정 */
const CASE_HERO_POS = {
  'us-army': 'center 28%',
  'exxonmobil': 'center 42%',
  'gs-eps': 'center 50%',
  'cbre': 'center 38%',
  'hyundai-motors': 'center 50%'
};
function renderCaseDetail(id) {
  const c = CASE_DATA[id];
  if (!c) { navigate('stories'); return; }

  const page = document.getElementById('casePage');
  page.style.setProperty('--accent', c.accent);
  page.style.setProperty('--accent-bg', c.accentBg);
  page.style.setProperty('--accent-text', c.accentText);

  const qsHtml = c.qs.map(q => `
    <div class="qs">
      <div class="qs-num" style="color:${c.accentText}">${q.n}</div>
      <div class="qs-lbl">${q.l}</div>
    </div>
  `).join('');

  const chHtml = c.challenges.map((t, i) => `
    <li>
      <span class="ch-num" style="color:${c.accentText}">${String(i+1).padStart(2,'0')}</span>
      <span class="ch-txt">${t}</span>
    </li>
  `).join('');

  const solHtml = c.solutions.map((s, i) => `
    <div class="sol-card" data-hover-bg="var(--surface-2)">
      <div class="sol-num">${String(i+1).padStart(2,'0')}</div>
      <h4>${s.t}</h4>
      <p>${s.d}</p>
    </div>
  `).join('');

  const resHtml = c.results.map(r => `
    <div class="res">
      <div class="res-num" style="color:${c.accentText}">${r.n}</div>
      <div class="res-lbl">${r.l}</div>
    </div>
  `).join('');

  const _hasQs = c.qs && c.qs.length;
  const _hasAbout = !!(c.about && String(c.about).trim());
  const _hasCh = c.challenges && c.challenges.length;
  const _hasSol = c.solutions && c.solutions.length;
  const _hasRes = c.results && c.results.length;
  const _hasQuote = !!((c.quote && String(c.quote).trim()) || (c.cite && String(c.cite).trim()));
  const _relIds = CUSTOMER_TO_APPS[c.name] || [];
  const _cust = (typeof CUSTOMERS !== 'undefined') ? CUSTOMERS.find(x => String(x.key||'').trim() === id) : null;
  const _installClient = _cust ? String(_cust.install||'').trim() : '';
  const _fieldLink = _installClient ? `<a class="case-field-link" href="installation-photos.html?client=${encodeURIComponent(_installClient)}">설치 현장 사진 전체 보기 &rarr;</a>` : '';
  page.innerHTML = `
    <div class="top-band" style="background:${c.accent}">
      <span class="label">Customer Success · Case Study ${c.num}</span>
      <span>${c.industry}</span>
    </div>

    <section class="hero">
      <div class="meta">Industry — ${c.industry}</div>
      <div class="case-logo" style="border-bottom:2px solid ${c.accentText}">${c.name}</div>
      <h1>${c.title.replace('<em>', `<em style="color:${c.accentText}">`)}</h1>
      <p class="tagline">${c.tagline}</p>
      ${_hasQs ? `<div class="qs-row">${qsHtml}</div>` : ''}
    </section>

    ${_hasAbout ? `<section class="sec">
      <div class="sec-label" style="color:${c.accentText}">About the Customer</div>
      <p class="body">${c.about}</p>
    </section>` : ''}

    ${_hasCh ? `<section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Challenge</div>
      <h2>현장이 마주한 문제</h2>
      <ul class="ch-list">${chHtml}</ul>
    </section>` : ''}

    ${_hasSol ? `<section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Solution</div>
      <h2>적용 어플리케이션</h2>
      <div class="sol-grid">${solHtml}</div>
    </section>` : ''}

    ${_hasSol ? `<section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Architecture</div>
      <h2>솔루션 구성</h2>
      <div class="arch">
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.48"/><path d="M16.24 7.76a6 6 0 0 1 0 8.48"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></div>
          <div class="name">무선 센서 노드</div>
          <div class="desc">FIELD</div>
          <span class="arch-arrow" style="color:${c.accentText}">→</span>
        </div>
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.31 0"/></svg></div>
          <div class="name">ALTA 게이트웨이</div>
          <div class="desc">AGGREGATE</div>
          <span class="arch-arrow" style="color:${c.accentText}">→</span>
        </div>
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg></div>
          <div class="name">클라우드 플랫폼</div>
          <div class="desc">MQTTS / API</div>
          <span class="arch-arrow" style="color:${c.accentText}">→</span>
        </div>
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg></div>
          <div class="name">통합 대시보드</div>
          <div class="desc">ANALYTICS</div>
        </div>
      </div>
    </section>` : ''}

    ${_hasRes ? `<section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Results</div>
      <h2>도입 후 성과</h2>
      <div class="res-grid">${resHtml}</div>
    </section>` : ''}

    ${_hasQuote ? `<section class="quote-sec" style="background:${c.accentBg}">
      <blockquote style="--quote-color:${c.accent};color:#17213B">
        <span style="display:none">${c.quote}</span>
        ${c.quote}
      </blockquote>
      <cite style="color:${c.accent}">— ${c.cite}</cite>
    </section>` : ''}

    <!-- INTEGRATION: related applications -->
    ${_relIds.length ? `<section class="related-apps-section">
      <div class="related-apps-head">
        <div>
          <span class="kicker">Explore deeper</span>
          <h3 style="margin-top:8px;">관련 어플리케이션</h3>
        </div>
        <span class="meta">${c.name}가 활용하는 솔루션</span>
      </div>
      <div class="related-apps-grid" id="caseRelatedApps"></div>
    </section>` : ''}

    <section class="sec photo-section">
      <div class="sec-label" style="color:${c.accentText}">Field Gallery</div>
      <h2>현장 · 설치 사진</h2>
      ${_fieldLink}
      <div id="caseGallery" class="ph-wrap"></div>
    </section>
  `;

  // The blockquote::before quote mark needs accent color too — use a style block
  const styleId = 'case-quote-color';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `#casePage .quote-sec blockquote::before { color: ${c.accent}; }`;

  // Hover backgrounds for sol cards
  page.querySelectorAll('.sol-card').forEach(card => {
    const bg = card.dataset.hoverBg;
    card.addEventListener('mouseenter', () => card.style.background = bg);
    card.addEventListener('mouseleave', () => card.style.background = '');
  });

  // Render related applications (cross-link to Application library)
  const relatedAppIds = CUSTOMER_TO_APPS[c.name] || [];
  const raContainer = document.getElementById('caseRelatedApps');
  if (raContainer && relatedAppIds.length) {
    raContainer.innerHTML = relatedAppIds
      .map(aid => APPS.find(a => a.id === aid))
      .filter(Boolean)
      .map(app => `
        <button class="related-app-card" data-app-id="${app.id}">
          <span class="app-tag ${app.cat}">${CATEGORIES[app.cat].label}</span>
          <div class="ra-name">${app.name}</div>
          <div class="ra-desc">${app.desc}</div>
        </button>
      `).join('');
    raContainer.querySelectorAll('.related-app-card').forEach(card => {
      card.addEventListener('click', () => navigate('app/' + card.dataset.appId));
    });
  } else if (raContainer) {
    raContainer.parentElement.style.display = 'none';
  }

  document.getElementById('caseFooter').innerHTML = `
    <div class="ft-logo">Wireless IoT Monitoring</div>
    <div class="ft-meta">Case Study ${c.num} · ${c.name}</div>
  `;

  renderGalleryItems(document.getElementById('caseGallery'), (c.photos && c.photos.length) ? c.photos : getPhotos('case:' + id));
}

/* ========== APPLICATIONS DATA ========== */
let CATEGORIES = {  /* 기본값 — 구글 시트(AppCategories 탭)가 있으면 덮어씀 */
  env:    { name: "환경 모니터링",    label: "Environmental" },
  cold:   { name: "콜드체인 & 물류",  label: "Cold Chain" },
  health: { name: "의료 & 실험실",    label: "Healthcare" },
  indus:  { name: "산업 & 제조",      label: "Industrial" },
  fac:    { name: "시설 & 자산",      label: "Facility" },
  agri:   { name: "농업 & 야외",      label: "Agriculture" }
};

let APPS = [  /* 기본값 — 구글 시트(Applications 탭)가 있으면 덮어씀 */
  { id:"temp", name:"온도 모니터링", cat:"env", desc:"측정 대상의 온도 범위와 열용량에 맞는 센서 방식을 선정해, 냉장·냉동·공정·전산실 온도를 10분 주기로 자동 기록합니다.", sensors:"TEMP", popularity:100, isNew:false, added:"2018-01" },
  { id:"leak", name:"누수 감지", cat:"env", desc:"전극 간 통전 원리의 포인트·로프·플로트형 센서를 누수 경로에 맞게 배치해, 기계실·전산실·천장 배관의 물 접촉을 감지 즉시 통보합니다.", sensors:"WATER", popularity:88, isNew:false, added:"2018-03" },
  { id:"hvac", name:"HVAC 모니터링", cat:"env", desc:"공조기 필터 전후 차압과 급·환기 온도, 팬 전류를 측정해 필터 교체 시점과 송풍 계통의 이상을 수치로 관리합니다.", sensors:"DP · TEMP", popularity:72, isNew:false, added:"2018-06" },
  { id:"greenhouse", name:"그린하우스", cat:"env", desc:"온실 내부의 온도·습도·CO₂·조도를 구역별로 측정해 야간 저온, 결로, 환기 부족 구간을 찾아냅니다.", sensors:"TEMP · CO₂", popularity:54, isNew:false, added:"2019-03" },
  { id:"refrig", name:"상업용 냉장", cat:"env", desc:"쇼케이스·워크인 냉장고·냉동고의 고내 온도와 압축기 전류, 도어 상태를 측정해 냉동 설비의 이상을 상품 온도가 이탈하기 전에 파악합니다.", sensors:"TEMP", popularity:84, isNew:false, added:"2018-09" },
  { id:"air", name:"공기질 모니터링", cat:"env", desc:"CO₂·미세먼지·온습도를 상시 측정해 재실 인원에 맞는 환기 운전과 실내공기질 유지기준 관리를 지원합니다.", sensors:"AIR · VOC", popularity:60, isNew:true, added:"2025-09" },
  { id:"cold-chain", name:"콜드체인 모니터링", cat:"cold", desc:"입고부터 보관, 출고 도크, 수송 차량까지 구간별 온도를 같은 기준으로 기록해 온도 이력이 끊기는 지점을 없앱니다.", sensors:"TEMP · GPS", popularity:95, isNew:false, added:"2018-02" },
  { id:"logistics", name:"물류 & 창고", cat:"cold", desc:"대형 창고의 구역별·높이별 온습도를 다점 측정해 냉동·냉장 구역의 편차와 상온 구역의 결로 위험을 관리합니다.", sensors:"TEMP · HUMID", popularity:78, isNew:false, added:"2018-05" },
  { id:"food", name:"식품 서비스", cat:"cold", desc:"집단급식소와 중앙 조리시설의 냉장·냉동고, 검수·보존식 온도를 자동 기록해 HACCP 모니터링 기록의 공백을 줄입니다.", sensors:"TEMP", popularity:70, isNew:false, added:"2018-08" },
  { id:"grocery", name:"그로서리 & 편의점", cat:"cold", desc:"슈퍼마켓·SSM 다점포의 쇼케이스와 후방 냉장·냉동고를 같은 기준으로 감시하고 본사가 점포별 온도 관리 상태를 비교합니다.", sensors:"TEMP", popularity:76, isNew:false, added:"2019-01" },
  { id:"transport", name:"수송 차량", cat:"cold", desc:"냉장·냉동 탑차 적재함의 온도와 도어 개폐를 운행 중 연속 기록하고, 이탈 시 운전자와 관제 담당자에게 문자로 알립니다.", sensors:"TEMP · GPS", popularity:58, isNew:true, added:"2025-11" },
  { id:"vaccine", name:"백신 모니터링", cat:"health", desc:"백신 냉장고의 온도를 2~8℃ 기준으로 연속 기록하고, 고온 이탈과 동결 위험을 구분해 의료기관 담당자에게 알립니다.", sensors:"ULT TEMP", popularity:92, isNew:false, added:"2020-04" },
  { id:"hospital", name:"병원 & 클리닉", cat:"health", desc:"혈액·검체·의약품 보관 장비의 온도와 음압격리실 차압, 기계실 누수를 병원 시설팀과 해당 부서가 함께 확인하도록 구성합니다.", sensors:"TEMP · DP", popularity:81, isNew:false, added:"2018-11" },
  { id:"lab", name:"실험실 & 제약", cat:"health", desc:"초저온 냉동고, 안정성 시험 챔버, 시약 냉장고, 청정실 차압을 연속 기록하고 서버구축형으로 사내망 안에서 데이터를 관리할 수 있습니다.", sensors:"TEMP · HUMID", popularity:74, isNew:false, added:"2019-05" },
  { id:"morgue", name:"영안실 & 조직", cat:"health", desc:"장례식장 안치 냉장고, 해부·병리 시설, 조직 보관 냉동고의 온도와 도어 상태를 연속 기록하고 이탈 시 당직자에게 알립니다.", sensors:"ULT TEMP", popularity:38, isNew:false, added:"2020-08" },
  { id:"pharma-cold", name:"제약 콜드체인", cat:"health", desc:"의약품 도매·물류 거점의 냉장 창고와 수송 용기·차량 온도를 기록해 KGSP와 생물학적 제제 수송 관리 요건의 이행을 지원합니다.", sensors:"TEMP · GPS", popularity:66, isNew:true, added:"2025-07" },
  { id:"manufact", name:"제조 라인", cat:"indus", desc:"모터·펌프·팬·감속기의 진동 속도와 표면 온도, 전류를 주기적으로 측정해 회전 설비의 열화 추세를 관리하고 정비 시점을 앞당겨 판단합니다.", sensors:"VIB · CURRENT", popularity:86, isNew:false, added:"2018-04" },
  { id:"construct", name:"건설 현장", cat:"indus", desc:"동절기 콘크리트 양생 온도, 양생 공간의 일산화탄소, 가설 전력과 침수를 무선으로 기록해 품질 기록과 현장 안전 관리를 함께 지원합니다.", sensors:"MOTION · TEMP", popularity:52, isNew:false, added:"2019-08" },
  { id:"datacenter", name:"데이터센터 & 서버룸", cat:"indus", desc:"랙 흡기 온도 분포, 이중마루 하부 누수, 컨테인먼트 차압, 배터리실 온도를 다점 측정해 냉각 여유와 침수 위험을 상시 확인합니다.", sensors:"TEMP · WATER · DP", popularity:90, isNew:false, added:"2018-07" },
  { id:"energy", name:"에너지 탐사", cat:"indus", desc:"정압기실, 가스·수소 충전 설비, 집단에너지 배관, 관정 펌프처럼 상주 인력이 없는 에너지 설비의 압력·온도·경보 접점을 LTE로 수집합니다.", sensors:"VIB · PRESSURE", popularity:44, isNew:false, added:"2020-02" },
  { id:"solar", name:"태양광 & 재생에너지", cat:"indus", desc:"태양광 발전소의 인버터실·접속반 온도, 침수, 출입문, 인버터 고장 접점을 수집해 발전량 모니터링이 다루지 않는 부대설비 상태를 감시합니다.", sensors:"TEMP · CURRENT", popularity:56, isNew:true, added:"2025-10" },
  { id:"facility", name:"시설 모니터링", cat:"fac", desc:"소방 수신기의 화재 신호, 전기실 정전, 집수정 침수, 기계실 온도를 문자로 통보해 야간·휴일 무인 사업장의 초기 대응 시간을 확보합니다.", sensors:"OCC · DOOR · TEMP", popularity:68, isNew:false, added:"2018-12" },
  { id:"hospitality", name:"호텔 & 숙박", cat:"fac", desc:"객실 욕실과 층별 배관 샤프트의 누수, 객실 온습도, 냉장 설비를 감시해 객실 판매 중단으로 이어지는 시설 사고를 줄입니다.", sensors:"OCC · WATER", popularity:50, isNew:false, added:"2019-11" },
  { id:"financial", name:"금융기관", cat:"fac", desc:"금융기관 전산센터의 부대설비실과 본점·지점 시설의 온도·누수·전원을 감시하되, 전산실 무선 제한 등 금융 보안 규정에 맞춰 구성합니다.", sensors:"TEMP · WATER", popularity:46, isNew:false, added:"2020-05" },
  { id:"vacant", name:"공실 부동산", cat:"fac", desc:"공실 상가·사무실·건물의 누수, 동파, 무단 출입, 화재 수신기 신호를 원격으로 통보해 관리인 없이 비어 있는 기간의 자산 손상을 막습니다.", sensors:"WATER · TEMP", popularity:40, isNew:false, added:"2021-02" },
  { id:"smartcity", name:"스마트시티", cat:"fac", desc:"지하차도·저지대 침수, 공공시설의 누수·정전, 무더위쉼터 실내 온도를 독립 무선망으로 수집해 지자체 통합 플랫폼에 전달합니다.", sensors:"MULTI · LoRaWAN", popularity:36, isNew:true, added:"2025-12" },
  { id:"livestock", name:"축산 & 농업", cat:"agri", desc:"밀폐형 돈사·계사의 온습도와 환기팬 운전, 정전, 급수 압력을 감시해 폭염과 환기 정지에 따른 폐사 위험을 조기에 통보합니다.", sensors:"TEMP · HUMID", popularity:48, isNew:false, added:"2019-06" },
  { id:"marina", name:"마리나 & 보트", cat:"agri", desc:"계류 중인 요트·레저 보트·어선의 빌지 수위, 배터리 전압, 육상 전원 연결 상태를 감시해 무인 계류 중의 침수와 방전을 알립니다.", sensors:"WATER · VOLTAGE", popularity:32, isNew:false, added:"2020-11" },
  { id:"pet", name:"반려동물 복지", cat:"agri", desc:"애견 호텔·유치원, 동물병원 입원실, 반려동물 판매·미용 시설의 실내 온습도와 냉난방 정지, 정전을 야간·무인 시간에 통보합니다.", sensors:"TEMP · HUMID", popularity:28, isNew:false, added:"2021-04" },
  { id:"pest", name:"해충 방역", cat:"agri", desc:"식품공장·물류센터의 방충·방서 관리에서 온습도, 출입문 개방, 트랩 작동 신호를 기록해 해충·설치류 유입 조건과 경로를 관리합니다.", sensors:"TRAP · MOTION", popularity:24, isNew:false, added:"2021-08" },
  { id:"grow", name:"그로하우스", cat:"agri", desc:"인공광 식물공장, 버섯 재배사, 육묘장의 온도·습도·CO₂·조도를 재배단과 구역별로 측정해 설정값과 실제 재배 환경의 차이를 확인합니다.", sensors:"LIGHT · CO₂", popularity:42, isNew:true, added:"2025-08" }
  /* ── Monnit 공식 Use Case 라이브러리(자료 다운로드 연결) ── */
  ,{ id:"uc-mold", name:"곰팡이 제거·예방", cat:"env", desc:"누수·침수 복구 현장의 온습도와 이슬점을 연속 기록해 건조 완료 시점을 데이터로 판정하고 곰팡이 재발을 관리합니다.", sensors:"TEMP · HUMID", popularity:46, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-mold-remediation.pdf" }
  ,{ id:"uc-plant-maint", name:"플랜트 예지보전", cat:"indus", desc:"공정 플랜트의 펌프·송풍기·열교환기·배관에 무선 진동·온도·압력 센서를 추가해 계기가 없던 지점의 상태를 정기 점검 사이에도 확인합니다.", sensors:"VIB · TEMP", popularity:55, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-magnetic-inspection-laboratory.pdf" }
  ,{ id:"uc-hot-yoga", name:"핫요가 스튜디오 공조", cat:"env", desc:"고온·고습으로 운영하는 수련실의 온도·습도·CO₂를 측정해 수업 환경의 일관성과 환기 상태를 관리합니다.", sensors:"TEMP · HUMID", popularity:34, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-yoga-studio-climate-control.pdf" }
  ,{ id:"uc-smart-farm", name:"농장·온실 환기 자동화", cat:"agri", desc:"온실·축사의 환기팬, 측창·천창 개폐기, 순환 팬이 설정대로 실제 동작했는지를 전류·접점 신호로 확인하고 실내 환경 변화와 대조합니다.", sensors:"TEMP · HUMID · CO₂", popularity:48, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-smart-farms.pdf" }
  ,{ id:"uc-nicu", name:"신생아 집중치료실(NICU)", cat:"health", desc:"신생아 집중치료실의 모유·약품 냉장고와 병동 온습도, 음압·양압 구역 차압을 시설 보조 감시 체계로 기록합니다.", sensors:"TEMP · HUMID", popularity:52, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/iot-nicu-monitoring-use-case.pdf" }
  ,{ id:"uc-hvac", name:"상업용 냉난방(HVAC)", cat:"env", desc:"냉동기·보일러·냉각탑·순환펌프의 공급·환수 온도와 전류, 운전 신호를 측정해 열원 설비의 효율 저하와 정지를 조기에 파악합니다.", sensors:"DP · TEMP", popularity:60, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-HVAC.pdf" }
  ,{ id:"uc-restaurant", name:"레스토랑·외식 서비스", cat:"cold", desc:"외식 매장 주방의 냉장·냉동고와 워크인 온도를 자동 기록해 수기 점검 부담을 줄이고 영업 종료 후 고장을 문자로 알립니다.", sensors:"TEMP", popularity:58, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-restaurant-and-food-services.pdf" }
  ,{ id:"uc-convenience", name:"편의점", cat:"cold", desc:"편의점의 워크인 쿨러, 오픈 쇼케이스, 냉동 평대 온도를 점포당 소수의 센서로 감시하고 야간·무인 운영 시간의 고장을 통보합니다.", sensors:"TEMP", popularity:50, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-convenience-store.pdf" }
  ,{ id:"uc-school-cafeteria", name:"학교 급식실 냉장·냉동고", cat:"cold", desc:"학교 급식실의 냉장·냉동고와 보존식 냉동고 온도를 자동 기록하고 방학·주말 무인 기간의 이상을 영양교사와 행정실에 알립니다.", sensors:"TEMP", popularity:44, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-school-cafeteria.pdf" }
  ,{ id:"uc-datacenter", name:"서버룸·데이터센터", cat:"indus", desc:"사옥 전산실, 통신실, 지점 서버실처럼 전담 인력이 없는 소규모 전산 공간의 온도·누수·전원·출입을 최소 구성으로 감시합니다.", sensors:"TEMP · WATER · DP", popularity:62, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-data-center-management.pdf" }
  ,{ id:"uc-pharma-refrig", name:"의약품 냉장 보관", cat:"health", desc:"약국·의원·병원 약제부의 의약품 냉장고 온도를 연속 기록해 인슐린·백신·생물학적 제제 등 냉장 의약품의 보관 이탈을 조기에 알립니다.", sensors:"TEMP", popularity:54, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-pharmaceutical-refrigeration.pdf" }
  ,{ id:"uc-perishable-food", name:"신선식품 제조", cat:"cold", desc:"식품 제조공장의 원료 보관, 해동·숙성, 가공실, 완제품 창고의 온습도를 연속 기록해 HACCP 모니터링과 공정 조건 관리를 지원합니다.", sensors:"TEMP · HUMID", popularity:47, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-perishable-food-manufacturing.pdf" }
  ,{ id:"uc-commercial-building", name:"상업용 빌딩 관리", cat:"fac", desc:"업무용 빌딩의 기계실·전기실·공조실·층별 PS에 무선 감시점을 추가하고 Modbus로 기존 자동제어에 연결해 유지관리 기록과 민원 대응의 근거를 만듭니다.", sensors:"OCC · TEMP · WATER", popularity:57, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-commercial-building-management.pdf" }
  ,{ id:"uc-retail", name:"리테일 매장 관리", cat:"fac", desc:"무인 매장과 다점포 소매 매장의 냉동·냉장 설비, 정전, 누수, 출입을 점포당 LTE 게이트웨이 한 대로 감시합니다.", sensors:"TEMP · OCC", popularity:49, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-retail-store-management.pdf" }
  ,{ id:"uc-hotels", name:"호텔·숙박", cat:"fac", desc:"리조트·콘도·호텔의 급탕 온도, 수영장·사우나 기계실, 주방 냉장 설비, 보일러 운전 신호를 감시해 부대시설의 위생과 설비 연속성을 관리합니다.", sensors:"OCC · WATER", popularity:45, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-hotels-and-hospitality.pdf" }
  ,{ id:"uc-apartment", name:"아파트·임대 부동산 관리", cat:"fac", desc:"공동주택 지하 전기실·기계실·집수정의 침수와 정전, 공용 배관 누수, 저수조·소방 펌프실 상태를 관리사무소와 관리소장에게 통보합니다.", sensors:"WATER · TEMP", popularity:43, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-apartment-property-management.pdf" }
  ,{ id:"uc-manufacturing", name:"제조·생산", cat:"indus", desc:"압축공기 압력, 건조로·오븐 온도, 설비 전류를 측정해 유틸리티 손실과 공정 조건 이탈, 설비 가동 시간을 수치로 관리합니다.", sensors:"VIB · CURRENT", popularity:59, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-manufacturing-and-production.pdf" }
  ,{ id:"uc-greenhouse", name:"온실 모니터링", cat:"agri", desc:"토양·배지의 수분, 양액 탱크 온도, 관수 펌프 운전을 기록해 딸기·토마토·화훼 등 시설 재배의 관수 시점과 급액 설비 상태를 관리합니다.", sensors:"TEMP · CO₂", popularity:46, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/iot-greenhouse-use-case.pdf" }
  ,{ id:"uc-second-home", name:"별장·세컨드하우스", cat:"fac", desc:"주말에만 사용하는 전원주택·별장·농막의 실내 온도, 누수, 보일러 정지, 출입을 휴대전화 문자로 알려 비어 있는 동안의 동파와 침입에 대비합니다.", sensors:"WATER · TEMP", popularity:30, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-second-and-vacation-homes.pdf" }
  ,{ id:"uc-schools-churches", name:"학교·교회", cat:"fac", desc:"방학과 주중에 비어 있는 학교·종교시설의 누수, 동파, 정전, 화재 수신기 신호를 통보하고 교실·예배 공간의 CO₂와 온습도를 기록합니다.", sensors:"TEMP · OCC", popularity:33, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-schools-and-churches.pdf" }
  ,{ id:"uc-foreclosed", name:"압류 부동산 관리", cat:"fac", desc:"경매·공매 진행 중이거나 담보권 실행으로 관리 주체가 불명확한 부동산의 동파, 누수, 무단 점유를 감시해 처분 시점까지 담보 가치를 보전합니다.", sensors:"WATER · TEMP", popularity:28, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-foreclosed-property-management.pdf" }
  ,{ id:"uc-pest-control", name:"해충 방역·열처리", cat:"agri", desc:"빈대·저장물 해충의 열처리 방제 작업에서 공간 내 여러 지점의 온도를 연속 기록해 목표 온도 도달과 유지 시간을 증빙합니다.", sensors:"TRAP · TEMP", popularity:35, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/iot-for-pest-control-use-case.pdf" }
  ,{ id:"uc-elderly", name:"노인 케어 모니터링", cat:"health", desc:"영상 촬영 없이 동작·출입문·비상벨·실내 온도 신호만으로 독거 어르신의 생활 반응과 주거 환경 위험을 보호자와 관리 기관에 알립니다.", sensors:"MOTION · TEMP", popularity:40, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-adult-and-elderly-care.pdf" }
  ,{ id:"uc-dormitory", name:"대학 기숙사", cat:"fac", desc:"기숙사의 공용 배관 누수, 방학 중 공실 동파, 보일러·급탕 설비 정지, 세탁실·공용 주방의 누수를 감시해 소수의 관리 인력으로 여러 동을 운영합니다.", sensors:"OCC · TEMP", popularity:31, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-college-and-university-housing.pdf" }
  ,{ id:"uc-storage", name:"보관·창고 시설", cat:"fac", desc:"셀프스토리지, 문서·기록물 보관소, 미술품·와인 보관 시설의 온습도와 누수, 출입을 기록해 보관 조건을 고객에게 증빙합니다.", sensors:"TEMP · HUMID", popularity:37, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-storage-facilities.pdf" }
  ,{ id:"uc-financial", name:"금융 서비스", cat:"fac", desc:"은행·증권·보험 지점과 무인 점포의 통신실, 금고·문서고, 자동화기기 코너의 온도·누수·정전을 본점에서 통합 확인합니다.", sensors:"TEMP · WATER", popularity:39, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/financial-services-use-case.pdf" }
  ,{ id:"uc-pet-welfare", name:"K9·반려동물 복지", cat:"agri", desc:"군·경찰·세관의 특수목적견 견사와 수송 차량, 지자체 동물보호센터의 온습도와 정전을 감시해 관리 인력이 없는 시간의 환경 사고를 예방합니다.", sensors:"TEMP · HUMID", popularity:29, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-pet-animal-welfare.pdf" }
  ,{ id:"uc-solar", name:"태양광 발전 모니터링", cat:"indus", desc:"공장·물류센터·건물 지붕형 태양광의 모듈 온도, 접속반 과열, 전기실 환경을 감시해 자가용 발전 설비의 안전 관리와 건물 관리를 연결합니다.", sensors:"TEMP · CURRENT", popularity:41, isNew:false, added:"2024-06", file:"https://cdn.monnit.com/content/documents/applications/UCM-030-Solar-Energy-Monitoring.pdf" }
  ,{ id:"uc-aquaculture", name:"양식장·아쿠아컬처", cat:"agri", desc:"육상 양식장의 수온, 순환 펌프·블로워 운전, 정전, 수조 수위를 감시해 고수온기와 설비 정지에 따른 대량 폐사 위험을 통보합니다.", sensors:"TEMP · WATER", popularity:36, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-fish-farms-aquaculture.pdf" }
];

/* ========== APP → CUSTOMERS MAPPING ========== */
/* Manual curation: link applications to actual customers from CUSTOMERS array */
const APP_TO_CUSTOMERS = {
  manufact:    ["Hyundai Motors", "3M", "GE", "Siemens", "Volvo"],
  datacenter:  ["Microsoft", "Intel", "C7 Data Centers", "Amazon", "Shutterstock"],
  "cold-chain":["Walmart", "Costco", "Wegmans", "Nestlé", "FedEx"],
  vaccine:     ["Samsung Biologics", "Merck & Co", "CDC", "Bayer", "ANTHC"],
  hvac:        ["CBRE", "JLL", "Arup", "Microsoft", "Intermountain Healthcare"],
  leak:        ["Microsoft", "Walmart", "C7 Data Centers", "Arup", "Methodist Hospital"],
  facility:    ["CBRE", "JLL", "Arup", "Fordham University", "Wyndham"],
  food:        ["Dairy Queen", "Chick-fil-A", "Subway", "Zaxby's", "Walmart"],
  grocery:     ["Walmart", "Costco", "Wegmans", "Racetrac"],
  hospital:    ["Methodist Hospital", "UA Cancer Center", "Intermountain Healthcare"],
  lab:         ["Samsung Biologics", "Bayer", "Merck & Co", "Cal Biotech", "UA Cancer Center"],
  "pharma-cold":["Samsung Biologics", "Merck & Co", "Bayer", "ANTHC"],
  energy:      ["ExxonMobil", "Shell", "Aramco", "PTT", "ENGIE"],
  refrig:      ["Walmart", "Costco", "Wegmans", "Dairy Queen"],
  temp:        ["Samsung Biologics", "ExxonMobil", "Walmart", "Microsoft", "Hyundai Motors", "CBRE"],
  logistics:   ["Amazon", "FedEx", "Walmart", "Nestlé"],
  transport:   ["FedEx", "Walmart", "Nestlé"],
  construct:   ["VINCI", "Arup"],
  solar:       ["ENGIE", "Tacoma Power", "PTT"],
  hospitality: ["Wyndham", "Noralta Lodge", "Silverton"],
  livestock:   ["Gaia Herbs", "Stone Edge Farm"],
  greenhouse:  ["Stone Edge Farm", "Gaia Herbs"]
};

/* Customer → app IDs (reverse mapping used by case study detail's related apps) */
const CUSTOMER_TO_APPS = {
  "Samsung Biologics": ["vaccine", "lab", "pharma-cold", "hospital"],
  "ExxonMobil":        ["manufact", "energy", "leak", "facility"],
  "Walmart":           ["cold-chain", "food", "refrig", "leak"],
  "Microsoft":         ["datacenter", "hvac", "leak", "facility"],
  "Hyundai Motors":    ["manufact", "facility", "logistics"],
  "CBRE":              ["facility", "hvac", "leak", "hospitality"],
  "US Army":           ["manufact", "facility", "leak", "energy"],
  "GS EPS":            ["energy", "manufact", "leak", "facility"]
};

/* ========== APPLICATION DETAILS (rich content for 6 priority apps) ========== */
/* 2026-11-19 활용 분야 60개 상세 개정 — 한국 법령·기준 반영, ROI 는 산식·기준값 중심.
   APP_CONTENT_FROM_CODE(파일 상단 매핑부)가 true 인 동안은 구글 시트 AppDetails 탭 대신 이 값을 씁니다. */
let APP_DETAILS = {
  "temp": {"snapshot": [{"label": "측정 주기", "value": "10분", "desc": "하루 144회 자동 기록(기본 설정)"}, {"label": "무선 대역", "value": "940MHz", "desc": "센서 → IoT 게이트웨이 → 플랫폼"}, {"label": "알림", "value": "SMS", "desc": "문자메시지·시스템 알람"}], "customer": {"lead": "온도가 품질·안전·설비 수명을 좌우하는 식품·의약품 보관시설, 제조 공정, 전기실·전산실 운영 조직이 대상입니다.", "paragraphs": ["국내 현장의 온도 관리는 식품공전의 보존·유통 기준(냉장 0~10℃, 냉동 -18℃ 이하), 의약품 보관 조건(2~8℃ 등), 공정 표준서의 관리 범위처럼 근거 기준이 분명한 경우가 많습니다. 기준은 명확한데 기록 방식이 수기나 단독형 기록계에 머물러 있는 현장이 주된 도입 대상입니다."]}, "challenge": {"lead": "온도 사고의 대부분은 측정 장비가 없어서가 아니라, 측정값이 담당자에게 제때 전달되지 않아 발생합니다.", "pains": [{"title": "측정 위치와 실제 품온의 차이", "desc": "문 개폐 직후의 공기 온도는 수 분 내 수 ℃씩 변하지만 내용물의 온도는 열용량 때문에 천천히 변합니다. 공기 온도만 보면 오경보가 잦고, 반대로 토출구 근처에만 설치하면 이탈을 놓칩니다."}, {"title": "야간·휴일 공백", "desc": "정전·압축기 정지·도어 미닫힘은 근무자가 없는 시간에 집중되며, 다음 근무 시간에 발견될 때에는 이미 폐기 판정 대상이 됩니다."}, {"title": "센서 방식의 부적합", "desc": "서미스터·측온저항체(RTD)·열전대(K타입)는 측정 범위와 정확도가 다릅니다. 초저온이나 고온 공정에 일반 온도 센서를 적용하면 측정 자체가 성립하지 않습니다."}, {"title": "기록의 증빙력 부족", "desc": "수기 점검표는 점검 시각의 순간값만 남기므로, 이탈이 언제 시작되어 얼마나 지속되었는지를 사후에 입증하기 어렵습니다."}]}, "solution": {"lead": "측정 범위에 맞는 무선 온도 센서를 선정하고, 프로브 위치와 알림 조건(임계값·지속 시간)을 현장 기준에 맞춰 설계합니다.", "paragraphs": ["일반 냉장·상온은 온도 센서, 냉동·초저온은 저온 센서(프로브만 고내에 넣고 본체는 외부 설치), 오븐·건조로·양생 등 고온은 K타입 열전대 센서를 적용합니다. 금속 재질의 냉장고·분전반은 전파를 차폐하므로 센서 본체는 외부에 부착하고 리드형 프로브만 내부로 인입합니다. 품온에 가깝게 측정해야 하는 경우 온도 버퍼(완충 용기)에 프로브를 넣어 문 개폐에 따른 순간 변동을 걸러냅니다.", "데이터는 940MHz 무선으로 IoT 게이트웨이에 수집됩니다. 게이트웨이는 LTE 유심을 내장해 현장 인터넷 공사가 필요 없고, 반경 내 센서 250개를 수용하며 정전 시에도 내장 배터리로 2~3일 동작합니다. 법정 계량이나 교정성적서가 요구되는 용도는 교정 범위와 주기를 도입 전에 별도 협의합니다."], "sensors": ["온도", "저온", "고온(K타입 열전대)", "덕트 온도", "온도 버퍼", "습도", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "관리 기준과 측정 위치를 먼저 확정한 뒤 설치합니다. 배선 공사가 없어 설치 자체는 대부분 하루 안에 끝납니다.", "phases": [{"tag": "PHASE 1", "title": "기준·측정점 정의", "desc": "대상 설비별 관리 온도 범위, 허용 이탈 시간, 프로브 위치를 확정합니다.", "duration": "1~3일"}, {"tag": "PHASE 2", "title": "설치·통신 확인", "desc": "센서 부착, 게이트웨이 배치, 설비별 수신 감도를 확인합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "알림 조건 조정", "desc": "1~2주간의 실측 추세를 보고 제상·문 개폐에 따른 정상 변동을 제외하도록 임계값과 지연 시간을 조정합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "기록 체계 전환", "desc": "수기 점검표를 자동 기록·월간 보고서로 대체하고 이탈 시 조치 절차를 문서화합니다.", "duration": "1주"}]}, "roi": {"lead": "회수 기간은 '도입비 ÷ (연간 회피 손실 + 절감 점검 공수)'로 산정합니다. 아래 수치는 산식에 넣는 입력값의 예시이며, 실제 금액은 보관품 가액과 설비 대수에 따라 달라집니다.", "metrics": [{"num": "144회", "desc": "10분 주기의 하루 자동 기록 횟수(수기 2회 대비)"}, {"num": "240h", "desc": "설비 10대·하루 2회·회당 2분 수기 점검의 연간 공수(약)"}, {"num": "1건", "desc": "보관품 전량 폐기 사고 1건의 손실이 통상 도입비를 상회"}], "before": "하루 1~2회 수기 기록. 야간·휴일 이탈은 다음 근무 시 발견. 이탈 시작 시각과 지속 시간 불명.", "after": "10분 주기 자동 기록. 임계값·지속 시간 조건으로 문자 알림. 이탈 구간을 그래프와 이력으로 증빙."}},
  "leak": {"snapshot": [{"label": "감지 방식", "value": "전극 통전", "desc": "포인트·로프·플로트형 선택"}, {"label": "전송", "value": "상태 변화 시", "desc": "감지 즉시 무선 전송"}, {"label": "연동", "value": "Modbus RTU", "desc": "시리얼 게이트웨이로 BAS·DDC 연동"}], "customer": {"lead": "기계실·전기실·전산실·지하층을 운영하는 빌딩, 공장, 물류센터, 공동주택 관리주체와 FM사가 대상입니다.", "paragraphs": ["국내 건축물은 지하층에 수변전실과 기계실이 집중되어 있고, 여름철 집중호우와 겨울철 배관 동파가 반복됩니다. 준공 후 20년이 지난 건물은 급수·소화 배관의 부식과 이음부 누수가 늘어나는 시기이므로, 순찰 중심의 관리로는 발견 시점이 늦어집니다."]}, "challenge": {"lead": "누수 피해액은 누수량이 아니라 발견까지 걸린 시간에 비례합니다.", "pains": [{"title": "발견 지연", "desc": "천장 속 배관, 이중마루 하부, 집수정은 사람이 상시 볼 수 없는 위치이며 야간·연휴에 발생한 누수는 아래층으로 확산된 뒤에 발견됩니다."}, {"title": "전기 사고로의 전이", "desc": "수변전실·UPS실 침수는 정전과 감전 위험으로 이어지고, 복구 기간 동안 건물 전체 운영이 중단됩니다."}, {"title": "유선 감지 설비의 시공 부담", "desc": "기존 건물에 유선 누수 감지 설비를 추가하려면 천장 해체와 배선·제어반 공사가 필요해 구역이 제한됩니다."}, {"title": "감지 원리에 따른 사각", "desc": "전극식 센서는 물의 전기 전도성을 이용하므로 초순수나 오일류는 감지되지 않습니다. 대상 유체를 확인하지 않고 설치하면 오인하게 됩니다."}]}, "solution": {"lead": "누수 예상 지점의 형상에 맞춰 포인트형·로프형·플로트형을 조합하고, 감지 신호를 문자 알림과 기존 감시반에 동시에 전달합니다.", "paragraphs": ["드레인 팬·밸브 하부처럼 한 점에 고이는 곳은 포인트형, 배관 경로나 벽체를 따라 흐르는 곳은 로프형(기본 3m, 연장 케이블로 확장)을 적용합니다. 집수정·피트의 수위 상승은 플로트(오뚜기볼)형으로 감지합니다. 센서는 배터리로 동작하고 자석 또는 브래킷으로 고정하므로 천장 해체나 배선 공사가 필요 없습니다.", "기존 자동제어(BAS) 감시반에서 함께 보려면 시리얼 Modbus 게이트웨이(RS-485, Modbus RTU)를 사용하며 게이트웨이 1대에 누수 센서 최대 50개를 수용합니다. 본 시스템은 감지와 통보를 담당하며, 급수 차단은 전동 밸브 등 별도 설비와의 연동 설계가 필요합니다."], "sensors": ["누수 감지(포인트)", "누수 감지 로프", "누수 감지 플로트", "온도(동파 감시)", "시리얼 Modbus 게이트웨이", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "피해 규모가 큰 구역부터 설치하고 실제 감지 이력을 근거로 범위를 넓힙니다.", "phases": [{"tag": "PHASE 1", "title": "위험 구역 도출", "desc": "도면과 과거 누수 이력을 기준으로 전기실·전산실·기계실·천장 배관의 우선순위를 정합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "우선 구역 설치", "desc": "수변전실·전산실 등 피해가 큰 구역에 센서를 배치하고 수신 감도를 확인합니다.", "duration": "1~3일"}, {"tag": "PHASE 3", "title": "감시반 연동", "desc": "필요 시 Modbus 주소표를 제공해 기존 감시반에 누수 포인트를 등록합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "전 구역 확장", "desc": "화장실 PS, 옥상 물탱크실, 지하주차장 집수정까지 단계적으로 확대합니다.", "duration": "2~4주"}]}, "roi": {"lead": "누수 1건의 피해액은 '복구 공사비 + 설비 교체비 + 영업 중단 손실'의 합이며, 조기 감지는 이 중 확산 면적과 중단 시간에 해당하는 부분을 줄입니다.", "metrics": [{"num": "50개", "desc": "시리얼 Modbus 게이트웨이 1대당 누수 센서 수용(최대)"}, {"num": "3m", "desc": "로프 센서 기본 길이, 연장 케이블로 확장"}, {"num": "무공사", "desc": "천장 해체·배선 없이 기존 건물에 추가 설치"}], "before": "순찰과 입주자 신고에 의존. 야간·연휴 누수는 아래층 피해 후 인지. 유선 감지 설비는 일부 구역만 설치.", "after": "물 접촉 즉시 문자 알림. 감시반에 구역별 표시. 발생 시각과 위치가 이력으로 남아 원인 조사와 보험 처리에 활용."}},
  "hvac": {"snapshot": [{"label": "핵심 측정", "value": "필터 차압", "desc": "초기 저항 대비 증가분 추적"}, {"label": "법적 배경", "value": "기계설비법", "desc": "연면적 1만㎡ 이상 등 유지관리 대상"}, {"label": "연동", "value": "Modbus", "desc": "BAS·DDC에 포인트 추가"}], "customer": {"lead": "공조기(AHU)·팬코일·송풍기를 다수 운영하는 업무용 빌딩, 병원, 공장 클린룸·항온항습실, 연구시설의 설비 관리 조직이 대상입니다.", "paragraphs": ["기계설비법에 따라 연면적 1만㎡ 이상 건축물과 일정 규모 이상의 공동주택은 유지관리자를 선임하고 반기별 유지점검과 연 1회 성능점검 기록을 남겨야 합니다. 제약·식품·반도체 공장은 공조기 필터 차압이 실내 청정도와 실간 차압 유지의 전제 조건입니다."]}, "challenge": {"lead": "자동제어 시스템은 실내 온도 제어에 맞춰 설계되어 있어, 필터 막힘이나 팬 성능 저하 같은 설비 상태 정보는 포인트가 없는 경우가 많습니다.", "pains": [{"title": "달력 기준 필터 교체", "desc": "오염 부하는 계절과 외기 조건에 따라 달라지는데 교체는 분기·반기 단위로 일괄 시행되어, 조기 교체로 인한 낭비와 과부하 운전이 동시에 발생합니다."}, {"title": "차압 상승에 따른 팬 동력 증가", "desc": "팬 축동력은 풍량과 정압의 곱에 비례합니다. 필터 저항이 커지면 정풍량 제어에서는 팬 동력이 늘고, 정속 운전에서는 풍량이 줄어 환기 성능이 떨어집니다."}, {"title": "포인트 추가 비용", "desc": "기존 BAS에 차압 포인트를 유선으로 추가하려면 배관·배선과 DDC 입력 증설이 필요해 공조기 수가 많은 현장은 예산이 부담됩니다."}, {"title": "점검 기록의 객관성", "desc": "현장 차압계를 눈으로 읽어 적는 방식은 측정 시점의 운전 조건이 기록되지 않아 추세 비교가 어렵습니다."}]}, "solution": {"lead": "무선 차압 센서를 필터 전후에 연결해 차압 추세를 기록하고, 초기 저항 대비 설정 배수에 도달하면 교체 알림을 발생시킵니다.", "paragraphs": ["프리필터·미디엄필터·HEPA 각 단의 전후에 차압 포트를 설치하고, 급기·환기 덕트 온도와 팬 모터 전류를 함께 측정합니다. 차압은 풍량의 제곱에 비례해 변하므로 동일 운전 조건(풍량)에서의 값을 비교해야 하며, 전류 값을 함께 보면 운전·정지 구간을 구분할 수 있습니다.", "이더넷 게이트웨이(Modbus TCP) 또는 시리얼 Modbus 게이트웨이(RS-485)를 통해 기존 BAS에 포인트를 추가할 수 있어, 감시 화면을 이원화하지 않습니다. 실내 청정도나 풍량의 공인 측정(TAB)은 전문 측정업체의 영역이며, 본 시스템은 그 사이의 상시 추세 감시를 담당합니다."], "sensors": ["차압", "덕트 온도", "온도", "습도", "전류", "건접점", "이더넷 게이트웨이(Modbus TCP)", "시리얼 Modbus 게이트웨이"]}, "proposal": {"lead": "대표 공조기 몇 대에서 차압 상승 곡선을 확보한 뒤 교체 기준을 정하고 전체로 확대합니다.", "phases": [{"tag": "PHASE 1", "title": "대상 선정·초기값 측정", "desc": "부하가 큰 공조기를 선정하고 필터 교체 직후의 초기 차압을 기준값으로 기록합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "센서 설치", "desc": "필터 단별 차압 포트 연결, 덕트 온도·팬 전류 센서를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "교체 기준 수립", "desc": "1~3개월 추세로 필터 종류별 교체 차압(제조사 권장 최종 저항 기준)을 확정합니다.", "duration": "1~3개월"}, {"tag": "PHASE 4", "title": "전 공조기 확대·BAS 연동", "desc": "검증된 기준을 전체 공조기에 적용하고 감시반에 등록합니다.", "duration": "2~4주"}]}, "roi": {"lead": "절감액은 '과차압 구간의 팬 동력 증가분 × 운전 시간 × 전력 단가'와 '불필요한 조기 교체 횟수 × 필터 단가'로 계산합니다. 아래는 물리식에 따른 산정 예시입니다.", "metrics": [{"num": "0.46kW", "desc": "풍량 10,000㎥/h·과차압 100Pa·팬 효율 60% 가정 시 추가 동력(약)"}, {"num": "4MWh", "desc": "위 조건으로 연중 연속 운전 시 추가 전력량(연 약 4,000kWh)"}, {"num": "10년", "desc": "기계설비 성능점검 기록 보존 기간"}], "before": "분기·반기 일괄 교체. 현장 차압계 육안 확인. 필터 막힘에 따른 풍량 저하는 민원 발생 후 인지.", "after": "차압 추세에 따른 상태 기준 교체. 공조기별 교체 이력과 근거 데이터 확보. 과차압 운전 구간 축소."}},
  "greenhouse": {"snapshot": [{"label": "측정 항목", "value": "4종", "desc": "온도·습도·CO₂·조도"}, {"label": "구역 편차", "value": "다점 측정", "desc": "측창·중앙·천창부 비교"}, {"label": "통신", "value": "LTE", "desc": "인터넷이 없는 농지에도 설치"}], "customer": {"lead": "토마토·파프리카·딸기·화훼 등을 재배하는 시설원예 농가와 농업법인, 육묘장, 농업기술센터의 시험 온실이 대상입니다.", "paragraphs": ["국내 시설원예는 비닐 온실 비중이 높고 겨울 난방비가 경영비에서 차지하는 비율이 큽니다. 복합환경제어기가 설치된 온실도 제어용 센서가 온실 중앙 한 곳에만 있는 경우가 많아, 구역별 편차와 제어기 고장을 따로 확인할 수단이 필요합니다."]}, "challenge": {"lead": "온실은 외기와 일사에 따라 내부 환경이 빠르게 변하고, 같은 동 안에서도 위치별 편차가 큽니다.", "pains": [{"title": "야간 저온과 난방기 정지", "desc": "겨울철 야간 난방기 정지나 정전은 수 시간 안에 냉해로 이어지지만, 농가가 현장에 없는 시간대에 발생합니다."}, {"title": "결로와 병해", "desc": "일몰 후 피복재와 잎 표면 온도가 이슬점 아래로 내려가면 결로가 생기고, 잿빛곰팡이병 등 다습성 병해의 발생 조건이 됩니다."}, {"title": "CO₂ 부족", "desc": "밀폐된 온실은 오전 광합성으로 CO₂ 농도가 외기(약 420ppm)보다 낮아질 수 있으나 측정하지 않으면 알 수 없습니다."}, {"title": "단일 지점 제어의 한계", "desc": "제어 센서가 한 곳뿐이면 측창 쪽과 중앙부의 온도 차를 반영하지 못해 일부 구역의 생육이 불균일해집니다."}]}, "solution": {"lead": "무선 온습도·CO₂·조도 센서를 구역별로 분산 설치해 제어기와 독립된 감시 계통을 구성합니다.", "paragraphs": ["온습도 값으로 이슬점과 포화수증기압차(VPD)를 계산해 결로 위험 시간대와 과습·과건 구간을 확인할 수 있습니다. 온실 내 센서는 직사광과 관수에 노출되지 않도록 차광·통풍형 보호구에 넣어 작물 높이에 설치해야 측정값이 실제 기온을 대표합니다.", "난방기·환기팬·개폐기의 운전 상태는 건접점 또는 전류 센서로 함께 수집해 '설정값은 정상인데 장치가 동작하지 않는' 상황을 구분합니다. 게이트웨이는 LTE 유심을 내장해 농지에 인터넷 회선을 끌어올 필요가 없으며, 정전 시에도 내장 배터리로 2~3일간 알림을 유지합니다. 본 시스템은 감시·알림용이며 환경 제어는 기존 제어기가 담당합니다."], "sensors": ["온도", "습도", "CO₂", "조도", "토양 수분", "건접점", "전류", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "한 동에서 한 작기의 데이터를 확보한 뒤 설치 위치와 알림 기준을 확정합니다.", "phases": [{"tag": "PHASE 1", "title": "측정 구역 설계", "desc": "동별 측창·중앙·출입구 인근 등 편차가 예상되는 지점을 정합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "설치", "desc": "보호구에 넣은 센서와 게이트웨이를 설치하고 난방기·환기팬 상태 신호를 연결합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "기준 설정", "desc": "작목별 야간 최저 온도, 과습 지속 시간 등 알림 기준을 설정합니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "동 확대", "desc": "검증된 배치를 나머지 동에 적용합니다.", "duration": "1~2주"}]}, "roi": {"lead": "효과는 '냉해·고온 피해 회피액'과 '난방 설정 조정에 따른 연료 절감'으로 나누어 봅니다. 수량 증가는 품종·재배 기술의 영향이 커서 본 시스템의 효과로 단정하지 않습니다.", "metrics": [{"num": "1회", "desc": "야간 난방 정지 1회의 냉해 피해가 통상 도입비를 상회"}, {"num": "3지점", "desc": "동당 권장 최소 측정 지점(측창·중앙·천창부)"}, {"num": "2~3일", "desc": "정전 시 게이트웨이 내장 배터리 동작 시간"}], "before": "제어기 화면과 농가의 순회에 의존. 야간 난방 정지는 아침에 발견. 구역 편차는 경험으로 추정.", "after": "구역별 온습도·CO₂ 추세 확보. 야간 저온·장치 정지 문자 알림. 결로 시간대 데이터를 근거로 환기·난방 설정 조정."}},
  "air": {"snapshot": [{"label": "CO₂ 유지기준", "value": "1,000ppm", "desc": "실내공기질 관리법 다중이용시설"}, {"label": "법정 측정", "value": "연 1회", "desc": "유지기준 항목(공정시험기준)"}, {"label": "본 시스템", "value": "상시 감시", "desc": "법정 측정 사이의 추세 관리"}], "customer": {"lead": "실내공기질 관리법상 다중이용시설(의료기관·어린이집·대규모 점포·지하역사 등)과 업무시설, 학교, 학원, 공장 사무동의 시설 관리자가 대상입니다.", "paragraphs": ["다중이용시설 소유자는 미세먼지(PM10·PM2.5), 이산화탄소, 폼알데하이드, 총부유세균, 일산화탄소의 유지기준을 지켜야 하며 유지기준 항목은 연 1회 측정합니다. 학교는 학교보건법에 따라 교실 공기질을 별도로 관리합니다."]}, "challenge": {"lead": "법정 측정은 1년에 하루의 값만 보여주므로 나머지 기간의 환기 상태는 확인되지 않습니다.", "pains": [{"title": "환기와 에너지의 상충", "desc": "외기 도입량을 늘리면 CO₂는 낮아지지만 냉난방 부하가 커집니다. 측정값 없이 고정 풍량으로 운전하면 과환기 또는 환기 부족 중 하나가 됩니다."}, {"title": "재실 밀도 변화", "desc": "회의실·강의실·식당은 시간대별 인원 차가 커서 CO₂ 농도가 수십 분 안에 기준을 넘을 수 있습니다."}, {"title": "외기 미세먼지 유입", "desc": "고농도 미세먼지 시기에 외기 도입을 유지하면 필터 성능에 따라 실내 농도가 함께 올라갑니다."}, {"title": "측정 방식의 차이", "desc": "법정 측정은 공정시험기준(중량법 등)에 따르며, 광산란식 간이 센서의 값은 이와 동일하게 취급되지 않습니다."}]}, "solution": {"lead": "무선 CO₂·미세먼지·온습도 센서를 재실 공간에 설치해 시간대별 농도 추세를 확보하고, 환기 운전 조정의 근거로 사용합니다.", "paragraphs": ["CO₂는 재실 인원 대비 환기량의 지표입니다. 농도가 기준에 접근하는 시간대와 공간을 특정해 외기 댐퍼 개도와 전열교환기 운전 스케줄을 조정합니다. 센서는 호흡 높이(바닥에서 1.2~1.5m)에, 급기구·출입문·창가를 피해 설치해야 대표값을 얻습니다.", "미세먼지 센서는 광산란 방식으로 추세 관리와 구역 간 비교에 적합하며, 법정 측정이나 대외 제출용 수치를 대체하지 않습니다. 데이터는 iMonnit Cloud의 Open API(Webhook)·MQTT로 기존 BEMS나 대시보드에 전달할 수 있습니다."], "sensors": ["CO₂", "미세먼지(PM)", "온도", "습도", "차압", "IoT 게이트웨이(LTE)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "재실 밀도가 높은 공간에서 기준 초과 시간대를 먼저 파악한 뒤 환기 스케줄을 조정합니다.", "phases": [{"tag": "PHASE 1", "title": "대상 공간 선정", "desc": "회의실·강의실·대기실 등 밀도 변화가 큰 공간을 선정합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치합니다. 전원·통신 배선 공사는 필요하지 않습니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "기초 데이터 수집", "desc": "2~4주간 시간대별 CO₂·미세먼지 추세를 수집합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "환기 운전 조정", "desc": "초과 시간대에 맞춰 외기 도입과 운전 스케줄을 조정하고 결과를 재측정합니다.", "duration": "2주"}]}, "roi": {"lead": "효과는 '기준 초과 시간의 감소'와 '비재실 시간대 과환기 축소에 따른 냉난방 부하 절감'으로 평가합니다. 절감률은 건물의 환기 방식과 기존 운전 상태에 따라 달라 사전 약속 수치로 제시하지 않습니다.", "metrics": [{"num": "1,000", "desc": "다중이용시설 CO₂ 유지기준(ppm)"}, {"num": "144회", "desc": "10분 주기의 하루 기록 횟수"}, {"num": "연 1회 → 상시", "desc": "법정 측정 주기 대비 감시 빈도"}], "before": "연 1회 측정 결과만 보유. 환기는 고정 스케줄. 민원이 들어온 뒤에 창문 개방으로 대응.", "after": "공간·시간대별 농도 추세 확보. 기준 접근 시 알림. 환기 스케줄 조정의 전후 비교 자료 확보."}},
  "uc-mold": {"snapshot": [{"label": "관리 지표", "value": "상대습도·이슬점", "desc": "표면 결로 여부 판단"}, {"label": "위험 조건", "value": "RH 70% 이상 지속", "desc": "곰팡이 생육 가능 범위"}, {"label": "산출물", "value": "건조 이력", "desc": "시공 전후 증빙 자료"}], "customer": {"lead": "수해 복구·건조 전문업체, 인테리어·방수 시공사, 공동주택 관리주체, 손해사정·보험 관련 실무자가 대상입니다.", "paragraphs": ["국내 공동주택은 겨울철 외벽 모서리·발코니 확장부·붙박이장 뒷면의 결로와 여름 장마철 고습으로 곰팡이 민원이 반복됩니다. 누수 복구 후 충분히 건조되지 않은 상태에서 마감재를 덮으면 수개월 뒤 재발해 하자 분쟁으로 이어집니다."]}, "challenge": {"lead": "건조가 끝났는지를 손의 감각이나 경과 일수로 판단하면, 마감 후 재발했을 때 책임 소재를 가릴 근거가 없습니다.", "pains": [{"title": "건조 완료 판정 기준 부재", "desc": "콘크리트와 석고보드는 표면이 말라도 내부 수분이 남아 있어, 제습기 가동 일수만으로는 완료 여부를 알 수 없습니다."}, {"title": "결로 원인 논쟁", "desc": "입주자의 환기 부족인지 단열 결함인지에 대한 다툼은 실내 온습도와 벽체 표면 온도 기록이 없으면 결론이 나지 않습니다."}, {"title": "현장 재방문 비용", "desc": "건조 상태 확인을 위해 매일 현장을 방문해야 하고, 제습 장비 정지도 방문해야만 알 수 있습니다."}, {"title": "재시공 부담", "desc": "재발 시 마감재 철거와 재시공 비용, 거주자 이주 비용이 발생합니다."}]}, "solution": {"lead": "건조 구역에 무선 온습도 센서를 설치해 상대습도와 이슬점의 하강 곡선을 기록하고, 안정 구간에 도달한 시점을 건조 완료 근거로 삼습니다.", "paragraphs": ["곰팡이는 재료 표면의 상대습도가 대략 70~80% 이상으로 유지될 때 생육합니다. 실내 공기의 온습도에서 이슬점을 구하고, 온도 센서를 벽체 표면 가까이에 두어 표면 온도가 이슬점에 근접하는지를 함께 확인하면 결로 발생 조건을 판단할 수 있습니다.", "제습기·송풍기의 가동 여부는 전류 센서로 확인해 장비 정지 시 문자로 통보합니다. 본 시스템은 공기 중 온습도를 측정하며 자재의 함수율을 직접 측정하지 않으므로, 최종 판정에는 함수율계 측정을 병행하는 것이 적절합니다."], "sensors": ["온도", "습도", "누수 감지", "누수 감지 로프", "전류", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "복구 공사 일정에 맞춰 설치하고 건조 종료 후 회수해 다음 현장에 재사용합니다.", "phases": [{"tag": "PHASE 1", "title": "측정점 선정", "desc": "침수 구역, 인접 실, 외기 기준점을 정합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치·건조 개시", "desc": "센서와 LTE 게이트웨이를 설치하고 제습 장비 가동을 시작합니다.", "duration": "반나절"}, {"tag": "PHASE 3", "title": "건조 감시", "desc": "습도·이슬점 하강 곡선과 장비 가동 상태를 원격으로 확인합니다.", "duration": "1~3주"}, {"tag": "PHASE 4", "title": "완료 보고·회수", "desc": "안정 구간 도달을 확인하고 이력 보고서를 발행한 뒤 장비를 회수합니다.", "duration": "1일"}]}, "roi": {"lead": "효과는 '확인 방문 횟수 감소'와 '재발 시 재시공 비용 회피', '분쟁 시 증빙 확보'입니다. 장비는 현장 간 재사용하므로 현장당 비용은 사용 횟수에 반비례합니다.", "metrics": [{"num": "70%", "desc": "곰팡이 생육이 가능해지는 표면 상대습도 하한(70~80%)"}, {"num": "1~3주", "desc": "건조 감시 기간(현장 조건에 따라)"}, {"num": "회수 재사용", "desc": "현장 종료 후 센서·게이트웨이 재사용"}], "before": "경과 일수와 육안으로 건조 판정. 매일 현장 방문. 재발 시 원인과 책임 다툼.", "after": "습도·이슬점 곡선으로 완료 판정. 장비 정지 원격 인지. 시공 전후 이력으로 분쟁 대응."}},
  "uc-hot-yoga": {"snapshot": [{"label": "운영 조건", "value": "고온·고습", "desc": "일반적으로 38~40℃ 수준"}, {"label": "안전 지표", "value": "CO₂", "desc": "밀폐·다인 수업의 환기 확인"}, {"label": "관리 범위", "value": "다지점", "desc": "본사에서 지점별 비교"}], "customer": {"lead": "핫요가·핫필라테스 스튜디오, 찜질·사우나 시설, 실내 수영장 등 온열 환경을 상품으로 제공하는 사업장과 프랜차이즈 본사가 대상입니다.", "paragraphs": ["온열 수련 시설은 난방기와 가습기를 수업 시작 전에 가동해 목표 조건을 맞추고, 밀폐 상태에서 다수 인원이 운동합니다. 지점이 여러 곳인 경우 지점별 환경 편차가 회원 불만으로 이어집니다."]}, "challenge": {"lead": "고온·고습 환경은 설정값과 실제 실내 조건의 차이가 크고, 환기를 줄일수록 CO₂가 빠르게 상승합니다.", "pains": [{"title": "설정값과 실측값의 차이", "desc": "난방기 설정 온도는 기기 주변 값이며, 수련 위치의 온습도는 외기·인원·문 개폐에 따라 달라집니다."}, {"title": "환기 부족", "desc": "열 손실을 막으려 환기를 최소화하면 다인 수업 중 CO₂ 농도가 단시간에 높아져 두통·피로 민원이 발생합니다."}, {"title": "결로와 마감재 손상", "desc": "고습 공기가 외벽·창호의 차가운 표면에 닿으면 결로가 생기고 곰팡이와 마감재 들뜸으로 이어집니다."}, {"title": "예열 에너지", "desc": "수업 시간보다 지나치게 일찍 가동하면 난방·가습 에너지가 낭비됩니다."}]}, "solution": {"lead": "수련실 내부에 무선 온습도·CO₂ 센서를 설치해 수업 시간대별 실측 조건을 기록하고 지점 간 비교 자료로 사용합니다.", "paragraphs": ["센서는 난방기 토출 기류와 가습기 분무를 피해 수련 위치의 가슴 높이에 설치합니다. 예열 시작 후 목표 온습도에 도달하는 시간을 기록하면 수업 시간표에 맞춘 가동 시점을 정할 수 있습니다.", "CO₂ 값은 수업 사이 환기 시간과 전열교환기 가동 판단의 근거가 됩니다. 고온·고습에서는 센서의 사용 온습도 범위와 결로 영향을 사양서로 확인해야 하며, 본 시스템은 환경 기록용으로 이용자의 건강 상태를 판단하는 장치가 아닙니다."], "sensors": ["온도", "습도", "CO₂", "개폐 감지", "전류", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "한 지점의 한 달 데이터를 기준으로 운영 표준을 만들고 다른 지점에 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "측정 위치 선정", "desc": "수련실별 대표 지점과 외벽·창가 결로 우려 지점을 정합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치합니다.", "duration": "반나절"}, {"tag": "PHASE 3", "title": "운영 데이터 수집", "desc": "수업 시간표와 대조해 예열 시간, 수업 중 CO₂ 상승 폭을 확인합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "표준화·지점 확대", "desc": "예열 시점과 환기 시간 기준을 정하고 다른 지점에 동일 구성으로 설치합니다.", "duration": "1~2주"}]}, "roi": {"lead": "절감 요소는 '과도한 예열 시간'이며 '지점당 하루 예열 단축 시간 × 난방·가습 소비전력 × 영업일'로 계산합니다. 회원 유지율 변화는 다른 요인이 커서 효과 지표로 삼지 않습니다.", "metrics": [{"num": "40℃", "desc": "온열 수련실의 일반적 운영 온도 수준(38~40℃)"}, {"num": "CO₂", "desc": "수업별 농도 기록으로 환기 시간 판단"}, {"num": "지점 간 비교", "desc": "동일 지표로 지점별 편차 확인"}], "before": "난방기 설정값으로 관리. 환기는 강사 재량. 지점별 체감 편차를 민원으로 인지.", "after": "수련 위치의 실측 온습도·CO₂ 기록. 예열·환기 기준 표준화. 지점별 운영 상태를 본사에서 확인."}},
  "uc-hvac": {"snapshot": [{"label": "핵심 측정", "value": "공급·환수 온도차", "desc": "설계 ΔT 대비 실측 비교"}, {"label": "대상 설비", "value": "열원·반송", "desc": "냉동기·보일러·냉각탑·펌프"}, {"label": "경보 수집", "value": "건접점", "desc": "설비 고장 접점 통보"}], "customer": {"lead": "중앙 열원 방식의 업무용 빌딩, 상가, 병원, 호텔, 공장 유틸리티동을 관리하는 시설팀과 위탁 관리 FM사가 대상입니다.", "paragraphs": ["냉난방 에너지는 업무용 건물 에너지 사용량에서 가장 큰 비중을 차지합니다. 준공 후 오래된 건물은 자동제어 포인트가 노후하거나 일부만 살아 있어, 열원 설비의 실제 운전 상태를 기계실에 내려가야 확인할 수 있는 경우가 많습니다."]}, "challenge": {"lead": "열원 설비는 고장이 나기 전부터 효율이 떨어지지만, 실내 온도가 유지되는 동안에는 드러나지 않습니다.", "pains": [{"title": "저 ΔT 운전", "desc": "냉수 공급·환수 온도차가 설계값보다 작으면 같은 열량을 보내기 위해 유량과 펌프 동력이 늘어납니다. 측정하지 않으면 알 수 없는 손실입니다."}, {"title": "냉각수 온도 상승", "desc": "냉각탑 충전재 오염이나 팬 고장으로 냉각수 온도가 오르면 냉동기 압축일이 늘어 소비전력이 증가합니다."}, {"title": "야간·휴일 정지", "desc": "보일러 실화, 펌프 트립은 동절기 야간에 발생하면 배관 동결과 다음 날 난방 불가로 이어집니다."}, {"title": "노후 자동제어", "desc": "기존 BAS의 센서 오차나 통신 단절로 감시 화면의 값을 신뢰하기 어려운 현장이 있습니다."}]}, "solution": {"lead": "배관 표면 부착형 온도 센서와 전류 센서, 건접점 센서를 열원 계통에 추가해 기존 자동제어와 독립된 감시 계통을 구성합니다.", "paragraphs": ["냉수·온수·냉각수의 공급·환수 배관에 온도 센서를 밀착 부착하고 보온재로 다시 감싸 외기 영향을 줄입니다. 표면 측정은 삽입형보다 응답이 느리고 절대값 오차가 있으나, 공급·환수의 온도차와 추세를 비교하는 용도에는 충분합니다.", "펌프·팬·압축기의 전류로 운전 시간과 부하 변화를 파악하고, 설비 제어반의 고장 접점은 건접점 센서로 받아 문자로 통보합니다. 수신 신호는 Modbus 게이트웨이로 기존 감시반에 통합할 수 있습니다. 열량의 정산용 계량은 법정 계량기의 영역입니다."], "sensors": ["온도(배관 표면)", "전류", "건접점", "압력", "덕트 온도", "이더넷 게이트웨이(Modbus TCP)", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "냉방기 또는 난방기 시작 전에 설치해 한 시즌의 운전 데이터를 확보합니다.", "phases": [{"tag": "PHASE 1", "title": "계통 조사", "desc": "열원 계통도와 설계 온도차, 기존 감시 포인트의 상태를 확인합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "설치", "desc": "공급·환수 온도, 주요 모터 전류, 고장 접점 센서를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "시즌 운전 분석", "desc": "부하별 온도차와 운전 시간을 분석해 저 ΔT, 과다 운전 구간을 특정합니다.", "duration": "1~3개월"}, {"tag": "PHASE 4", "title": "운전 조정·확대", "desc": "설정값·대수 제어를 조정하고 다른 건물로 확대합니다.", "duration": "2~4주"}]}, "roi": {"lead": "절감액은 '조정 전후 운전 전류 × 운전 시간 × 전력 단가'의 차이로 직접 산출합니다. 절감률은 기존 운전 상태에 좌우되므로 실측 전에는 범위로만 제시합니다.", "metrics": [{"num": "ΔT", "desc": "설계값(통상 5℃ 내외) 대비 실측 온도차 비교"}, {"num": "반기", "desc": "기계설비법 유지점검 주기, 점검 기록의 보조 자료"}, {"num": "운전 시간 집계", "desc": "전류 기반 설비별 가동 시간"}], "before": "기계실 순회로 상태 확인. 고장은 실내 온도 민원으로 인지. 효율 저하는 전기요금 고지서로 사후 확인.", "after": "공급·환수 온도차와 전류 추세 확보. 설비 정지 문자 알림. 운전 조정의 전후 비교 자료 확보."}},
  "refrig": {"snapshot": [{"label": "보존 기준", "value": "0~10℃ / -18℃ 이하", "desc": "식품공전 냉장·냉동 기준"}, {"label": "설비 지표", "value": "압축기 전류", "desc": "가동률·기동 횟수 추적"}, {"label": "알림 조건", "value": "임계값 + 지속 시간", "desc": "제상 구간 오경보 제외"}], "customer": {"lead": "쇼케이스와 워크인 냉장·냉동고를 운영하는 마트, 식자재 유통사, 정육·수산 매장, 냉동 설비 유지보수 업체가 대상입니다.", "paragraphs": ["냉장·냉동 설비는 압축기, 응축기, 증발기, 제상 장치로 구성되며 고장의 다수는 응축기 오염, 냉매 부족, 제상 불량, 도어 가스켓 손상처럼 서서히 진행됩니다. 고내 온도가 기준을 넘는 시점은 이미 설비 이상이 상당히 진행된 뒤입니다."]}, "challenge": {"lead": "고내 온도만 보면 '지금 괜찮은지'는 알 수 있지만 '설비가 버티고 있는지'는 알 수 없습니다.", "pains": [{"title": "제상 주기와 오경보", "desc": "증발기 제상 중에는 고내 온도가 일시적으로 오릅니다. 단순 임계값 알림은 하루에도 여러 번 울려 결국 무시됩니다."}, {"title": "압축기 과부하 누적", "desc": "응축기 막힘이나 냉매 부족은 압축기 가동 시간을 늘리고 전력 사용과 고장 위험을 함께 키웁니다."}, {"title": "도어 미닫힘", "desc": "워크인 도어가 열려 있으면 외기 유입으로 증발기에 성에가 쌓이고 냉각 능력이 떨어집니다."}, {"title": "야간 정전·차단기 트립", "desc": "영업 종료 후 발생한 전원 이상은 다음 날 개점 때 발견됩니다."}]}, "solution": {"lead": "고내 온도에 압축기 전류와 도어 개폐를 더해, 온도 이탈의 원인을 설비·사람·전원으로 구분할 수 있게 합니다.", "paragraphs": ["온도 프로브는 증발기 토출 기류를 피해 환기 측 또는 상품 적재 위치에 두고, 필요 시 온도 버퍼를 사용해 품온에 가깝게 측정합니다. 알림은 '기준 초과가 일정 시간 지속될 때'로 설정해 제상 구간을 제외합니다.", "압축기 전류는 클램프형 전류 센서로 측정합니다. 가동률이 평소보다 높아지거나 기동·정지가 잦아지는 변화는 온도 이탈보다 먼저 나타나는 신호입니다. 전원 상실은 전압 감지 센서로 통보하며, 게이트웨이는 내장 배터리로 정전 중에도 2~3일간 알림을 전송합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "전류", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "보관 가액이 큰 워크인과 고장 이력이 있는 설비부터 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "설비 목록·기준 확정", "desc": "설비별 보관 품목, 관리 온도, 제상 주기를 정리합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "설치", "desc": "온도·도어·전류 센서를 설치합니다. 전류 센서는 분전반 작업이므로 전기 담당자가 입회합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "기준선 수집", "desc": "2주간 정상 운전 시의 온도 변동폭과 압축기 가동률을 수집합니다.", "duration": "2주"}, {"tag": "PHASE 4", "title": "알림 확정·확대", "desc": "기준선을 반영해 알림 조건을 확정하고 나머지 설비로 확대합니다.", "duration": "1~2주"}]}, "roi": {"lead": "회수는 '폐기 회피액 + 긴급 출동 수리의 계획 정비 전환'으로 산정합니다. 워크인 1실의 보관 가액을 기준으로 사고 1건의 손실을 먼저 계산해 보시기 바랍니다.", "metrics": [{"num": "-18℃", "desc": "식품공전 냉동 보존 기준(이하)"}, {"num": "10℃", "desc": "식품공전 냉장 보존 기준 상한(0~10℃)"}, {"num": "2~3일", "desc": "정전 시 게이트웨이 알림 유지 시간"}], "before": "고내 온도계 육안 확인. 제상 중 오경보로 알림 무시. 고장은 상품 온도 이탈 후 인지.", "after": "온도·전류·도어를 함께 기록. 지속 시간 조건으로 유효 알림만 수신. 가동률 변화로 정비 시점 판단."}},
  "cold-chain": {"snapshot": [{"label": "관리 구간", "value": "4단계", "desc": "입고·보관·도크·수송"}, {"label": "기록 연결", "value": "구간별 이력", "desc": "동일 플랫폼에서 조회"}, {"label": "데이터 연계", "value": "Open API·MQTT", "desc": "WMS·TMS에 전달"}], "customer": {"lead": "냉장·냉동 식품과 의약품을 취급하는 제조사, 3PL 물류사, 식자재 유통사, 프랜차이즈 본사의 품질·물류 조직이 대상입니다.", "paragraphs": ["식품은 식품위생법과 식품공전의 보존·유통 기준에 따라, 의약품은 의약품 유통품질 관리기준(KGSP)과 생물학적 제제 관련 규칙에 따라 보관과 수송 온도를 관리합니다. 화주가 물류사에 구간별 온도 기록 제출을 요구하는 계약이 늘고 있습니다."]}, "challenge": {"lead": "콜드체인의 온도 이탈은 보관고 내부보다 구간과 구간 사이에서 주로 발생합니다.", "pains": [{"title": "도크 체류", "desc": "상·하차 대기 중 상온 도크에 놓인 시간은 어느 쪽 기록에도 남지 않습니다."}, {"title": "구간별 기록 방식 차이", "desc": "창고는 설비 기록계, 차량은 차량 온도기록계, 매장은 수기 점검표로 나뉘어 한 건의 화물 이력으로 이어 붙이기 어렵습니다."}, {"title": "사후 분쟁", "desc": "도착 시 품온 이탈이 확인되어도 어느 구간에서 발생했는지 입증할 자료가 없으면 책임 분담이 어렵습니다."}, {"title": "기록 신뢰성", "desc": "수기 기록과 단독형 기록계는 누락과 사후 기재의 여지가 있어 감사 시 지적 대상이 됩니다."}]}, "solution": {"lead": "보관고, 도크, 차량 적재함에 동일한 무선 온도 센서를 두고 구간별 기록을 하나의 플랫폼에서 시간축으로 조회합니다.", "paragraphs": ["보관 구역은 고정형 게이트웨이로, 차량은 차량 전원(USB)으로 구동하는 LTE 게이트웨이로 수집합니다. 차량용 게이트웨이는 내장 배터리가 있어 시동을 끈 상·하차 대기 중에도 기록이 이어집니다. 도크와 전실에는 온도와 도어 개폐 센서를 함께 두어 개방 시간을 기록합니다.", "iMonnit Cloud의 Open API(Webhook)와 MQTT로 온도 데이터를 WMS·TMS에 전달하면 출고 건과 온도 이력을 연결할 수 있습니다. 차량 위치 추적은 본 시스템의 범위가 아니므로 기존 차량 관제(DTG 등)의 운행 기록과 시각을 기준으로 대조합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "습도", "IoT 게이트웨이(LTE·차량 전원)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "한 개 노선과 그 출발 창고를 묶어 전 구간 기록이 실제로 이어지는지 먼저 검증합니다.", "phases": [{"tag": "PHASE 1", "title": "구간 정의", "desc": "대상 품목의 관리 온도와 구간(보관·도크·차량·인수)을 정의합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "시범 노선 구축", "desc": "창고 1개소와 차량 수 대에 센서·게이트웨이를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "이력 검증", "desc": "출고 건별로 구간 기록이 끊김 없이 이어지는지, 이탈 구간이 특정되는지 확인합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "전 노선 확대·시스템 연계", "desc": "차량과 거점을 확대하고 WMS·TMS에 데이터를 연계합니다.", "duration": "1~2개월"}]}, "roi": {"lead": "효과는 '온도 이탈로 인한 반품·폐기 감소'와 '분쟁 시 책임 구간 특정'입니다. 최근 1년간 온도 관련 클레임 건수와 건당 처리 비용을 기준으로 산정하는 것이 가장 정확합니다.", "metrics": [{"num": "4구간", "desc": "입고·보관·도크·수송 전 구간 기록"}, {"num": "2년", "desc": "생물학적 제제 수송 온도 기록 보관 기간"}, {"num": "250개", "desc": "게이트웨이 1대 반경 내 센서 수용"}], "before": "구간별로 기록 방식이 다름. 도크 체류 시간 미기록. 클레임 발생 시 책임 구간 불명.", "after": "전 구간 동일 기준 기록. 도크 개방 시간 포함. 출고 건별 온도 이력 제출 가능."}},
  "logistics": {"snapshot": [{"label": "측정 방식", "value": "다점 분포", "desc": "구역·높이별 온도 편차 확인"}, {"label": "환경 제약", "value": "금속 패널", "desc": "게이트웨이 배치 사전 검증"}, {"label": "부가 감시", "value": "도어·누수·전원", "desc": "도크 개방, 스프링클러 배관"}], "customer": {"lead": "냉동·냉장 물류센터, 상온 풀필먼트 센터, 보세창고, 위험물 옥내저장소를 운영하는 물류사와 화주사의 시설·품질 담당 조직이 대상입니다.", "paragraphs": ["국내 물류센터는 수도권 외곽에 대형화되는 추세이며 한 동 안에 냉동·냉장·상온 구역이 함께 있는 복합 구조가 일반적입니다. 식품을 보관하는 창고는 식품위생법·축산물 위생관리법상 보존 기준의 적용을 받습니다."]}, "challenge": {"lead": "창고가 클수록 설비 제어용 온도 센서 한두 개가 전체를 대표하지 못합니다.", "pains": [{"title": "구역 내 온도 편차", "desc": "증발기에서 먼 구석, 도크 인접 랙, 상단 랙은 평균보다 온도가 높습니다. 제어 센서 위치에서는 정상으로 보입니다."}, {"title": "도크 개방과 외기 유입", "desc": "상·하차 중 열린 도크로 습한 외기가 들어오면 냉동 구역에는 성에가, 냉장·상온 구역에는 결로가 생깁니다."}, {"title": "상온 창고의 결로", "desc": "일교차가 큰 환절기에 지붕과 화물 표면 온도가 이슬점 아래로 내려가 포장재가 젖는 피해가 반복됩니다."}, {"title": "금속 구조의 통신 제약", "desc": "샌드위치 패널과 철제 랙은 전파를 감쇠·반사시켜 무선 설비의 수신 범위를 줄입니다."}]}, "solution": {"lead": "구역 모서리·중앙·도크 인접부와 랙 상·하단에 무선 온습도 센서를 분산 배치해 분포를 측정합니다.", "paragraphs": ["940MHz 대역은 2.4GHz보다 회절과 투과가 유리하지만 금속 패널로 구획된 실 사이는 감쇠가 큽니다. 리피터 없이 센서와 게이트웨이가 직접 통신하는 구조이므로 구획별로 게이트웨이를 두고 설치 전 수신 감도를 측정합니다. 냉동 구역은 저온에서 배터리 용량이 줄어들므로 리드형 프로브만 구역 안에 두고 본체는 전실에 설치하는 방식을 우선 검토합니다.", "상온 구역은 온습도에서 이슬점을 계산해 결로 위험 시간대를 알립니다. 도크 도어에는 개폐 센서를 두어 개방 시간을 기록하고, 스프링클러 배관과 지붕 누수 우려 구역에는 로프형 누수 센서를 설치합니다."], "sensors": ["온도", "저온", "습도", "개폐 감지", "누수 감지 로프", "전압 감지", "IoT 게이트웨이(LTE)", "이더넷 게이트웨이(Modbus TCP)"]}, "proposal": {"lead": "한 개 구역에서 온도 분포를 측정해 상시 감시 지점을 줄여 나가는 순서로 진행합니다.", "phases": [{"tag": "PHASE 1", "title": "통신·구획 조사", "desc": "구획별 패널 구조와 게이트웨이 위치, 수신 감도를 확인합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "분포 측정", "desc": "대상 구역에 센서를 조밀하게 설치해 2~4주간 온도 분포를 측정합니다.", "duration": "2~4주"}, {"tag": "PHASE 3", "title": "상시 감시점 확정", "desc": "가장 높은 온도와 큰 변동이 나타난 지점을 상시 감시점으로 남깁니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "전 구역 확대", "desc": "같은 절차를 다른 구역에 반복합니다.", "duration": "1~2개월"}]}, "roi": {"lead": "회수는 '보관 불량 클레임 감소'와 '순회 온도 점검 공수 절감'으로 산정합니다. 구역 수와 일 점검 횟수를 곱하면 현재 공수를 바로 계산할 수 있습니다.", "metrics": [{"num": "다점", "desc": "구역·높이별 분포 측정으로 최고 온도 지점 특정"}, {"num": "이슬점", "desc": "상온 구역 결로 위험 시간대 판단 지표"}, {"num": "도크 개방 시간", "desc": "도어 센서로 구역 온도 상승과 대조"}], "before": "제어용 센서 값으로 구역 전체 판단. 순회 점검으로 기록. 결로 피해는 발생 후 인지.", "after": "구역·높이별 분포 확보. 취약 지점 상시 감시. 결로 위험 시간대 사전 알림."}},
  "food": {"snapshot": [{"label": "보존식", "value": "-18℃ 이하 144시간", "desc": "식품위생법 시행규칙"}, {"label": "기록 대상", "value": "냉장·냉동·검수", "desc": "중요관리점 모니터링 보조"}, {"label": "기록 주기", "value": "10분", "desc": "수기 점검표 보완"}], "customer": {"lead": "기업·병원·복지시설의 구내식당을 운영하는 위탁급식 업체, 센트럴 키친, 도시락·케이터링 제조업체가 대상입니다.", "paragraphs": ["집단급식소는 식품위생법에 따라 조리·제공한 식품을 매회 1인분 분량으로 -18℃ 이하에서 144시간 이상 보관해야 하며, 식재료는 품목별 보존 기준에 맞춰 보관해야 합니다. HACCP 적용 업소는 중요관리점의 모니터링 기록을 유지해야 합니다."]}, "challenge": {"lead": "급식 현장의 온도 기록은 조리 인력이 바쁜 시간에 손으로 작성하는 부가 업무입니다.", "pains": [{"title": "기록 누락과 일괄 기재", "desc": "배식 시간대에는 점검표 작성이 뒤로 밀리고, 나중에 한꺼번에 채워 넣는 관행이 생깁니다."}, {"title": "보존식 냉동고 관리", "desc": "보존식 냉동고가 이탈하면 식중독 의심 사고 시 원인 조사에 필요한 시료가 무효가 됩니다."}, {"title": "주말·연휴 공백", "desc": "구내식당은 주말에 무인 상태가 되어 냉장고 고장이 월요일 아침에 발견됩니다."}, {"title": "위생 점검 대응", "desc": "지자체·발주처 점검 시 기록의 연속성과 이탈 시 조치 내역을 요구받습니다."}]}, "solution": {"lead": "냉장·냉동고와 보존식 냉동고에 무선 온도 센서를 설치해 점검표의 온도 항목을 자동 기록으로 대체합니다.", "paragraphs": ["보존식 냉동고는 별도 센서로 분리해 -18℃ 기준 이탈을 독립적으로 감시합니다. 조리장은 세척수와 증기에 노출되므로 센서 본체는 고내 외부의 건조한 위치에 부착하고 리드형 프로브만 고내로 넣습니다.", "이탈 알림은 영양사·조리 책임자와 설비 담당자에게 문자로 전달합니다. 가열 조리 중심온도, 식재료 검수 품온처럼 사람이 탐침으로 측정해야 하는 항목은 본 시스템의 대상이 아니며, HACCP 계획서상 모니터링 방법 변경은 내부 검증 절차에 따라 반영해야 합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "습도", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "사업장 한 곳에서 점검표 양식 전환까지 마친 뒤 다른 사업장에 같은 구성으로 확대합니다.", "phases": [{"tag": "PHASE 1", "title": "대상 설비·기준 확정", "desc": "냉장·냉동·보존식 설비 목록과 품목별 관리 온도를 정리합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치합니다.", "duration": "반나절~1일"}, {"tag": "PHASE 3", "title": "기록 양식 전환", "desc": "자동 기록 보고서를 점검표의 온도 항목으로 대체하고 이탈 시 조치 기록란을 유지합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "사업장 확대", "desc": "다른 급식 사업장에 동일 구성으로 설치합니다.", "duration": "사업장당 1일"}]}, "roi": {"lead": "회수는 '온도 기록 공수 절감 + 주말 고장에 따른 식재료 폐기 회피'로 산정합니다. 식중독 사고 대응 비용은 금액 산정이 어려워 포함하지 않습니다.", "metrics": [{"num": "144h", "desc": "보존식 보관 의무 시간(-18℃ 이하)"}, {"num": "240h", "desc": "설비 10대·하루 2회·회당 2분 수기 기록의 연간 공수(약)"}, {"num": "주말 포함", "desc": "무인 시간대 이탈 알림"}], "before": "조리 인력이 점검표 수기 작성. 주말 고장은 월요일 발견. 보존식 냉동고 이탈 여부 불명.", "after": "온도 자동 기록과 월간 보고서. 무인 시간대 문자 알림. 보존식 보관 온도 이력 확보."}},
  "grocery": {"snapshot": [{"label": "관리 단위", "value": "점포·설비", "desc": "본사 통합 조회"}, {"label": "대상 설비", "value": "쇼케이스·워크인", "desc": "오픈형·도어형·평대"}, {"label": "점포 통신", "value": "LTE", "desc": "점포 POS망과 분리"}], "customer": {"lead": "기업형 슈퍼마켓(SSM), 지역 마트 체인, 식자재 마트, 생협 매장을 운영하는 본사의 점포 운영·시설·식품안전 조직이 대상입니다.", "paragraphs": ["점포당 수십 대의 쇼케이스와 후방 워크인이 설치되어 있고 설비 유지보수는 외주 업체가 순회 방문하는 방식이 일반적입니다. 냉장 제품은 0~10℃, 냉동 제품은 -18℃ 이하 보존 기준을 지켜야 하며 지자체 위생 점검의 확인 항목입니다."]}, "challenge": {"lead": "점포 수가 늘수록 본사는 각 점포의 온도 관리 상태를 점검표 사진으로만 확인하게 됩니다.", "pains": [{"title": "오픈 쇼케이스의 특성", "desc": "에어커튼 방식의 오픈 쇼케이스는 매장 공조, 조명, 진열 높이에 따라 상품 위치의 온도가 달라집니다."}, {"title": "점포별 관리 편차", "desc": "점검 주기와 기록 방식이 점포 근무자에 따라 달라 본사가 동일 기준으로 비교할 수 없습니다."}, {"title": "폐점 후 고장", "desc": "야간 압축기 정지는 개점 준비 시간에 발견되며 신선 상품 진열대 전체가 폐기 대상이 됩니다."}, {"title": "POS망 보안 정책", "desc": "점포 네트워크에 외부 장비를 연결하는 것은 본사 보안 정책상 제한되는 경우가 많습니다."}]}, "solution": {"lead": "쇼케이스 계통별 대표 지점과 워크인에 무선 온도 센서를 설치하고 점포마다 LTE 게이트웨이를 두어 본사 계정에서 통합 조회합니다.", "paragraphs": ["오픈 쇼케이스는 환기 흡입구 측과 최상단 진열 위치의 온도를 측정해야 상품 온도에 가깝습니다. 냉동기 계통이 같은 쇼케이스는 대표 지점만 측정해 센서 수를 줄입니다.", "게이트웨이는 LTE 유심을 내장해 점포 POS망과 물리적으로 분리되며 전원만 연결하면 동작합니다. 알림은 점포 책임자와 유지보수 업체에 동시에 문자로 전달되고, 본사는 점포별 이탈 횟수와 지속 시간을 같은 지표로 비교합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "전류", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "설비 구성이 다른 점포 2~3곳에서 표준 배치를 정한 뒤 전 점포로 확대합니다.", "phases": [{"tag": "PHASE 1", "title": "표준 배치 설계", "desc": "쇼케이스 유형별 측정 위치와 점포당 센서 수량 기준을 정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "시범 점포 설치", "desc": "점포 2~3곳에 설치하고 영업시간·폐점 후의 온도 패턴을 수집합니다.", "duration": "점포당 1일"}, {"tag": "PHASE 3", "title": "알림·보고 체계 확정", "desc": "알림 수신자, 조치 기한, 본사 보고서 양식을 확정합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "전 점포 확대", "desc": "점포 개·보수 일정에 맞춰 순차 설치합니다.", "duration": "점포당 1일"}]}, "roi": {"lead": "점포 1곳의 '연간 온도 관련 폐기액'과 '긴급 수리 출동비'를 기준으로 산정합니다. 체인 전체 효과는 점포 수를 곱하되 시범 점포의 실측 감소분을 근거로 삼는 것이 타당합니다.", "metrics": [{"num": "1일", "desc": "점포당 설치 소요(배선 공사 없음)"}, {"num": "LTE", "desc": "점포 POS망과 분리된 통신"}, {"num": "점포 간 비교", "desc": "이탈 횟수·지속 시간을 동일 지표로 집계"}], "before": "점포별 수기 점검표. 본사는 사후 보고로 파악. 야간 고장은 개점 시 발견.", "after": "전 점포 온도 이력 통합 조회. 점포·유지보수 업체 동시 알림. 점포별 관리 수준 비교."}},
  "transport": {"snapshot": [{"label": "차량 전원", "value": "USB", "desc": "시동 OFF 시 내장 배터리로 유지"}, {"label": "측정 지점", "value": "전면·후면", "desc": "도어 측 편차 확인"}, {"label": "기록", "value": "운행 중 연속", "desc": "도어 개방 시각 포함"}], "customer": {"lead": "식품·식자재·의약품을 배송하는 운송사, 화주사 물류팀, 지입 차량을 관리하는 배차 조직이 대상입니다.", "paragraphs": ["식품 운반 차량은 식품위생법에 따라 운반 중 보존 기준 온도를 유지해야 하며, 냉장·냉동 의약품과 백신류 운송에는 자동온도기록장치가 요구됩니다. 최근에는 차량 온도기록계 조작 사례가 단속 대상이 되면서 화주가 독립적인 온도 기록을 요구하는 경우가 늘었습니다."]}, "challenge": {"lead": "차량 냉동기는 설정 온도를 표시할 뿐, 적재함 안쪽 화물이 실제로 몇 도인지는 따로 측정해야 합니다.", "pains": [{"title": "다회 배송과 도어 개방", "desc": "점포 배송 차량은 하루 수십 번 문을 열며, 후면 도어 쪽 화물은 전면보다 온도 상승이 큽니다."}, {"title": "냉동기 정지", "desc": "공회전 제한이나 휴식 중 시동을 끄면 냉동기가 정지하고, 여름철 적재함 온도는 빠르게 오릅니다."}, {"title": "기록의 독립성", "desc": "차량 장착 기록계는 운송사가 관리하므로 화주 입장에서는 별도의 검증 수단이 필요합니다."}, {"title": "금속 적재함의 통신", "desc": "알루미늄·FRP 패널로 된 적재함은 전파를 약화시켜 센서 위치에 따라 수신이 불안정해집니다."}]}, "solution": {"lead": "적재함 전면과 후면에 무선 온도 센서를, 도어에 개폐 센서를 설치하고 차량용 LTE 게이트웨이로 수집합니다.", "paragraphs": ["게이트웨이는 차량 USB 전원으로 구동하며 내장 배터리로 시동이 꺼진 뒤에도 2~3일간 동작해 상·하차 대기 중의 기록이 이어집니다. 적재함 패널의 차폐 정도는 차종마다 다르므로 게이트웨이 위치(운전석 또는 적재함 내부)를 정하기 전에 수신 감도를 확인합니다.", "온도 이탈과 도어 장시간 개방은 문자로 통보합니다. 차량 위치 정보는 본 시스템에서 제공하지 않으므로 기존 차량 관제의 운행 기록과 시각을 기준으로 대조합니다. 의약품 수송에 적용할 때는 센서의 검·교정과 수송 검증 요건을 규정에 맞춰 별도로 확인해야 합니다."], "sensors": ["온도", "저온", "개폐 감지", "습도", "IoT 게이트웨이(LTE·차량 전원)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "차종별로 한 대씩 수신 상태와 온도 편차를 확인한 뒤 차량 대수를 늘립니다.", "phases": [{"tag": "PHASE 1", "title": "차종별 통신 확인", "desc": "탑차 유형별로 게이트웨이 위치와 수신 감도를 확인합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "시범 차량 설치", "desc": "차량당 센서 2~3개와 게이트웨이를 설치합니다.", "duration": "대당 1시간 내외"}, {"tag": "PHASE 3", "title": "운행 데이터 검증", "desc": "2~4주간 노선별 도어 개방 횟수와 온도 상승 폭을 분석합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "전 차량 확대", "desc": "알림 기준을 확정하고 전 차량에 적용합니다.", "duration": "차량 수에 따라"}]}, "roi": {"lead": "효과는 '온도 이탈로 인한 인수 거부·재배송 감소'와 '화주 감사 대응'입니다. 최근 1년간 온도 관련 인수 거부 건수와 건당 비용으로 산정합니다.", "metrics": [{"num": "2~3일", "desc": "시동 OFF 후 게이트웨이 동작 시간"}, {"num": "2지점", "desc": "적재함 전면·후면 온도 편차 측정"}, {"num": "도어 개방 이력", "desc": "배송지별 개방 시각·지속 시간"}], "before": "냉동기 설정 온도와 차량 기록계에 의존. 도어 개방 시간 미기록. 인수 거부 시 원인 구간 불명.", "after": "적재함 실측 온도 연속 기록. 이탈·장시간 개방 문자 알림. 배송 건별 온도 이력 제출."}},
  "uc-restaurant": {"snapshot": [{"label": "대상", "value": "주방 냉장·냉동", "desc": "테이블 냉장고·워크인"}, {"label": "설치", "value": "자석 부착", "desc": "영업 중단 없이 설치"}, {"label": "알림", "value": "SMS", "desc": "점주·점장·본사 슈퍼바이저"}], "customer": {"lead": "프랜차이즈 외식 브랜드의 가맹본부와 직영 매장, 다점포 외식 기업, 공유 주방 운영사가 대상입니다.", "paragraphs": ["외식 매장은 조리 인력이 위생 점검표 작성까지 맡고 있으며, 인력 교체가 잦아 기록 품질이 일정하지 않습니다. 가맹본부는 슈퍼바이저 방문 점검으로 매장의 식품 안전 수준을 확인합니다."]}, "challenge": {"lead": "주방은 고온·다습하고 문 개폐가 잦아, 냉장 설비가 가장 가혹하게 사용되는 환경입니다.", "pains": [{"title": "피크 시간 과부하", "desc": "테이블 냉장고는 조리 중 계속 열려 있어 고내 온도가 기준을 넘는 시간이 길어집니다."}, {"title": "응축기 오염", "desc": "주방의 유증기와 먼지가 응축기에 쌓여 냉각 능력이 서서히 떨어지지만 고장 전까지 드러나지 않습니다."}, {"title": "영업 종료 후 고장", "desc": "심야에 발생한 고장은 다음 날 영업 준비 중 발견되며 당일 식자재를 폐기하고 영업에 차질이 생깁니다."}, {"title": "기록의 형식화", "desc": "점검표가 실제 측정 없이 같은 숫자로 채워지는 문제가 본부 점검에서 반복 지적됩니다."}]}, "solution": {"lead": "매장의 냉장·냉동 설비에 무선 온도 센서를 부착하고 매장당 LTE 게이트웨이 1대로 수집합니다.", "paragraphs": ["센서는 자석으로 부착하며 게이트웨이는 전원만 연결하면 동작합니다. 매장 인터넷이나 POS망을 사용하지 않으므로 가맹점 네트워크 환경과 무관하게 같은 방식으로 설치할 수 있습니다.", "피크 시간의 일시적 상승과 설비 이상을 구분하도록 '기준 초과가 일정 시간 지속될 때' 알림이 가도록 설정합니다. 가열 조리 온도나 튀김유 관리처럼 사람이 직접 측정하는 항목은 대상이 아니며, 본 시스템은 보관 온도 기록에 한정됩니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "직영점에서 운영 기준을 만든 뒤 가맹점에 표준 패키지로 보급합니다.", "phases": [{"tag": "PHASE 1", "title": "표준 패키지 구성", "desc": "매장 유형별 설비 수에 맞춰 센서 수량과 알림 수신자를 정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "직영점 설치", "desc": "직영 매장에 설치하고 피크 시간대 온도 패턴을 확인합니다.", "duration": "매장당 반나절"}, {"tag": "PHASE 3", "title": "운영 기준 확정", "desc": "알림 지연 시간, 조치 절차, 본부 보고 양식을 확정합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "가맹점 보급", "desc": "신규 오픈·리뉴얼 매장부터 순차 적용합니다.", "duration": "매장당 반나절"}]}, "roi": {"lead": "회수는 '폐기 식자재 회피 + 긴급 수리 감소 + 점검표 작성 시간 절감'으로 산정합니다. 매장 1곳의 일 식자재 재고액이 사고 1건의 손실 상한입니다.", "metrics": [{"num": "반나절", "desc": "매장당 설치 소요(영업 중단 없음)"}, {"num": "LTE", "desc": "매장 인터넷·POS망 미사용"}, {"num": "지속 시간 조건", "desc": "피크 시간 일시 상승과 고장 구분"}], "before": "조리 인력의 수기 점검표. 심야 고장은 다음 날 발견. 본부는 방문 점검으로만 확인.", "after": "보관 온도 자동 기록. 심야 이탈 문자 알림. 본부가 매장별 관리 상태를 원격 확인."}},
  "uc-convenience": {"snapshot": [{"label": "운영 형태", "value": "24시간·무인", "desc": "심야 1인 또는 무인 운영"}, {"label": "점포 규모", "value": "소형", "desc": "센서 3~6개 수준"}, {"label": "설치", "value": "점포당 1시간 내외", "desc": "전원만 연결"}], "customer": {"lead": "편의점 가맹본부의 점포 시설·영업 관리 조직, 하이브리드·무인 점포 운영사, 점포 설비 유지보수 협력사가 대상입니다.", "paragraphs": ["편의점은 도시락·삼각김밥·샌드위치·유제품 등 냉장 즉석식품의 매출 비중이 높고 유통기한이 짧습니다. 심야 무인 운영 점포가 늘면서 설비 이상을 발견할 사람이 없는 시간대가 길어졌습니다."]}, "challenge": {"lead": "소형 점포는 설비 대수가 적은 만큼 한 대의 고장이 판매 가능 상품의 상당 부분을 차지합니다.", "pains": [{"title": "무인 시간대 고장", "desc": "심야 무인 운영 중 쇼케이스가 정지하면 아침 근무자가 올 때까지 수 시간 방치됩니다."}, {"title": "여름철 실외기 과열", "desc": "실외기가 건물 틈이나 밀폐된 공간에 설치된 점포는 폭염 시 고압 차단으로 냉동기가 정지합니다."}, {"title": "워크인 도어 개방", "desc": "음료 보충 후 워크인 도어가 덜 닫히면 냉기가 빠지고 증발기에 성에가 쌓입니다."}, {"title": "전국 분산 점포", "desc": "점포가 전국에 흩어져 있어 유지보수 협력사의 출동 우선순위를 정할 근거가 필요합니다."}]}, "solution": {"lead": "워크인, 오픈 쇼케이스, 냉동 평대에 무선 온도 센서를 두고 워크인 도어에 개폐 센서를 설치합니다.", "paragraphs": ["점포당 센서 수를 최소화하기 위해 냉동기 계통별 대표 지점만 측정합니다. LTE 게이트웨이는 점포 통신망과 분리되어 가맹점 네트워크 정책에 영향을 주지 않고, 정전 시에도 내장 배터리로 알림을 유지하므로 점포 전체 정전 자체를 감지할 수 있습니다.", "알림은 점주와 본부 담당자, 유지보수 협력사에 문자로 전달됩니다. 협력사는 이탈 지속 시간과 설비 종류를 보고 출동 순서를 정할 수 있습니다."], "sensors": ["온도", "저온", "개폐 감지", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "무인·하이브리드 점포와 고장 이력이 많은 점포부터 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "우선 점포 선정", "desc": "무인 운영 점포와 최근 설비 고장 점포를 선정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "표준 키트 설치", "desc": "점포 유형별 표준 키트를 설치합니다.", "duration": "점포당 1시간 내외"}, {"tag": "PHASE 3", "title": "알림 체계 운영", "desc": "점주·본부·협력사 알림 흐름과 조치 기한을 운영해 봅니다.", "duration": "1개월"}, {"tag": "PHASE 4", "title": "권역 확대", "desc": "권역별 협력사 일정에 맞춰 확대합니다.", "duration": "권역당 2~4주"}]}, "roi": {"lead": "회수는 '점포당 연간 냉장 상품 폐기액 중 설비 고장 기인분'과 '긴급 출동의 계획 출동 전환'으로 산정합니다. 가맹본부의 폐기 지원 제도가 있다면 본부 부담분이 직접 절감 대상입니다.", "metrics": [{"num": "3~6개", "desc": "점포당 센서 수(계통별 대표 지점)"}, {"num": "1시간", "desc": "점포당 설치 소요(내외)"}, {"num": "정전 감지", "desc": "게이트웨이 내장 배터리로 정전 중 알림"}], "before": "근무자 육안 확인. 무인 시간대 고장 방치. 협력사는 신고 순서대로 출동.", "after": "야간·무인 시간 이탈 문자 알림. 점포 정전 감지. 이탈 지속 시간 기준 출동."}},
  "uc-school-cafeteria": {"snapshot": [{"label": "관리 기준", "value": "냉장 5℃ 이하·냉동 -18℃ 이하", "desc": "학교급식 위생관리 지침"}, {"label": "보존식", "value": "-18℃ 이하 144시간", "desc": "매회 1인분"}, {"label": "무인 기간", "value": "방학·주말", "desc": "원격 감시"}], "customer": {"lead": "초·중·고등학교와 유치원 급식실, 교육지원청 급식 담당 부서, 학교 급식 위탁·공동조리 운영 주체가 대상입니다.", "paragraphs": ["학교 급식은 학교급식법과 학교급식 위생관리 지침에 따라 HACCP 방식으로 운영되며, 냉장·냉동고 온도 확인과 기록은 영양(교)사와 조리 종사자가 매일 수행하는 관리 항목입니다. 교육청 위생·안전 점검에서 기록 여부를 확인합니다."]}, "challenge": {"lead": "학교 급식실은 하루 한 끼를 집중 조리하고, 방학과 주말에는 장기간 사람이 없습니다.", "pains": [{"title": "방학 중 장기 무인", "desc": "방학 기간에도 일부 식재료와 장류가 보관되지만 고장을 확인할 인력이 없습니다."}, {"title": "월요일 아침 발견", "desc": "주말에 발생한 고장은 월요일 조리 시작 전에 발견되어 당일 급식 식재료를 급히 교체해야 합니다."}, {"title": "기록 업무 부담", "desc": "영양교사 1명이 식단, 발주, 검수, 위생 기록을 모두 담당하는 학교가 많습니다."}, {"title": "노후 설비", "desc": "급식실 냉장·냉동고는 교체 주기가 길어 고장 빈도가 높습니다."}]}, "solution": {"lead": "급식실 냉장·냉동고와 보존식 냉동고에 무선 온도 센서를 설치해 온도를 자동 기록하고 이탈 시 문자로 알립니다.", "paragraphs": ["게이트웨이는 LTE 유심을 내장해 학교 내부망(교육청 보안 정책 대상)에 연결하지 않습니다. 전원만 있으면 동작하며 정전 시에도 내장 배터리로 2~3일간 알림을 유지합니다.", "알림 수신자를 영양교사와 행정실 담당자로 이중 지정하면 방학 중에도 대응할 수 있습니다. 자동 기록은 냉장·냉동고 온도 항목에 한정되며, 검수 품온과 조리 중심온도 측정은 기존 절차대로 수행합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "학교 한 곳에서 한 학기를 운영한 뒤 교육지원청 단위로 확대하는 방식이 적합합니다.", "phases": [{"tag": "PHASE 1", "title": "대상 설비 확인", "desc": "냉장·냉동·보존식 설비 수와 설치 위치를 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "방과 후 또는 방학 중에 설치합니다.", "duration": "반나절"}, {"tag": "PHASE 3", "title": "기록 전환", "desc": "자동 기록 보고서를 위생 점검 기록의 온도 항목으로 활용합니다.", "duration": "1개월"}, {"tag": "PHASE 4", "title": "학교 확대", "desc": "교육지원청 관내 학교로 확대합니다.", "duration": "학교당 반나절"}]}, "roi": {"lead": "효과는 '주말·방학 고장에 따른 식재료 폐기와 급식 차질 회피'와 '기록 업무 경감'입니다. 공공 예산 사업이므로 사고 예방과 기록 신뢰성 확보가 주된 도입 근거가 됩니다.", "metrics": [{"num": "5℃", "desc": "학교급식 냉장 관리 기준(이하), 냉동은 -18℃ 이하"}, {"num": "144h", "desc": "보존식 보관 의무 시간"}, {"num": "망 분리", "desc": "LTE로 학교 내부망 미사용"}], "before": "하루 1~2회 수기 기록. 주말·방학 고장은 등교일에 발견. 보존식 이탈 여부 확인 불가.", "after": "온도 자동 기록. 무인 기간 문자 알림. 보존식 냉동고 온도 이력 확보."}},
  "uc-perishable-food": {"snapshot": [{"label": "대상 공정", "value": "원료~완제품", "desc": "보관·해동·숙성·가공실"}, {"label": "식육 보존", "value": "-2~10℃", "desc": "축산물 위생관리법 기준(가금육 -2~5℃)"}, {"label": "데이터 연계", "value": "Modbus TCP·MQTT", "desc": "공장 감시 시스템 연동"}], "customer": {"lead": "육가공·수산가공·유가공·김치·반찬·신선편의식품(샐러드·밀키트) 제조업체의 품질·생산·공무 조직이 대상입니다.", "paragraphs": ["식품·축산물 제조업체는 HACCP 인증이 의무화된 품목이 많고, 냉장·냉동 보관실과 작업장 온도가 중요관리점 또는 선행요건 관리 항목으로 지정되어 있습니다. 대형 유통사 납품 업체는 2차 감사에서 온도 기록의 연속성을 요구받습니다."]}, "challenge": {"lead": "제조 현장은 물과 세척제를 쓰는 습한 환경이며 작업실 온도 기록이 생산 일지와 분리되어 있습니다.", "pains": [{"title": "작업실 온도 상승", "desc": "가공실은 15℃ 이하 등으로 관리하지만 인원 투입, 설비 발열, 세척 온수 사용으로 기준을 넘는 시간대가 생깁니다."}, {"title": "해동·숙성 조건", "desc": "해동과 숙성은 온도와 시간의 조합으로 품질과 미생물 증식이 결정되나 경과 기록이 남지 않는 경우가 많습니다."}, {"title": "결로와 낙수", "desc": "냉장 작업실 천장과 배관의 결로수가 제품에 떨어지는 문제는 위생 감사의 주요 지적 사항입니다."}, {"title": "세척 환경", "desc": "고압 세척과 소독제에 노출되는 구역은 일반 전자 기기의 수명이 짧습니다."}]}, "solution": {"lead": "보관실과 작업실에 무선 온습도 센서를 배치해 공정 구역별 온도 이력을 생산 로트와 대조할 수 있게 합니다.", "paragraphs": ["작업실은 온습도에서 이슬점을 계산해 천장·배관 표면의 결로 조건을 감시합니다. 세척수가 직접 닿는 구역은 센서 본체를 세척 범위 밖에 두고 리드형 프로브만 인입하거나 방수 등급이 맞는 산업용 타입을 적용합니다.", "이더넷 게이트웨이의 Modbus TCP 또는 iMonnit Cloud의 MQTT로 공장의 기존 감시 시스템·MES에 값을 전달할 수 있습니다. 중요관리점의 모니터링 방법으로 채택하려면 센서 교정과 검증 절차를 HACCP 계획에 반영해야 합니다."], "sensors": ["온도", "저온", "습도", "개폐 감지", "차압", "산업용 온도 센서", "이더넷 게이트웨이(Modbus TCP)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "감사 지적이 있었던 구역 또는 중요관리점으로 지정된 보관실부터 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "관리 항목 매핑", "desc": "HACCP 관리 기준서의 온도 항목과 측정 위치를 대응시킵니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "보관실·작업실에 센서와 게이트웨이를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "검증·기준 반영", "desc": "수기 측정값과 비교 검증하고 모니터링 방법을 기준서에 반영합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "공정 확대·시스템 연계", "desc": "해동·숙성실과 완제품 창고로 확대하고 MES에 연계합니다.", "duration": "1~2개월"}]}, "roi": {"lead": "회수는 '온도 이탈 로트의 폐기·재작업 감소'와 '감사 대응 자료 작성 공수 절감'으로 산정합니다. 로트당 원가를 알고 있으므로 이탈 1건의 손실을 직접 계산할 수 있습니다.", "metrics": [{"num": "10℃", "desc": "식육 보존 기준 상한(-2~10℃, 가금육 -2~5℃)"}, {"num": "이슬점", "desc": "작업실 결로·낙수 위험 판단 지표"}, {"num": "로트 대조", "desc": "생산 로트와 구역 온도 이력 연결"}], "before": "작업실 온도계 육안 확인과 일지 기재. 해동·숙성 경과 미기록. 결로는 발견 후 닦아냄.", "after": "구역별 온습도 연속 기록. 기준 초과·결로 조건 알림. 로트별 온도 이력을 감사 자료로 제출."}},
  "vaccine": {"snapshot": [{"label": "보관 기준", "value": "2~8℃", "desc": "대부분의 냉장 백신"}, {"label": "감시 방향", "value": "상·하한 모두", "desc": "동결(0℃ 이하) 노출 포함"}, {"label": "기록", "value": "10분 주기", "desc": "하루 2회 수기 확인 보완"}], "customer": {"lead": "국가예방접종 위탁의료기관(의원·병원), 보건소, 종합병원 약제부, 백신을 취급하는 의약품 도매상이 대상입니다.", "paragraphs": ["질병관리청의 백신 보관·관리 지침은 백신 전용 냉장고 사용과 하루 2회 이상의 온도 확인·기록을 안내하고 있으며, 보관 온도 이탈 시에는 사용 가능 여부를 제조사·보건당국에 확인해야 합니다. 동네 의원은 야간과 휴일에 무인 상태가 되는 대표적인 시설입니다."]}, "challenge": {"lead": "백신은 고온뿐 아니라 동결에도 손상되며, 손상 여부가 외관으로 드러나지 않습니다.", "pains": [{"title": "동결 손상", "desc": "알루미늄 보조제가 포함된 백신은 0℃ 이하에 노출되면 역가가 떨어집니다. 냉각판 근처나 냉기 토출구 앞에 둔 백신에서 발생합니다."}, {"title": "가정용 냉장고 사용", "desc": "가정용 냉장고는 제상 주기와 문 선반의 온도 변동이 커서 2~8℃ 범위를 안정적으로 유지하기 어렵습니다."}, {"title": "휴일 정전·고장", "desc": "연휴 중 정전이나 고장은 다음 진료일에 발견되며 이탈 지속 시간을 알 수 없으면 전량 폐기로 판정됩니다."}, {"title": "이탈 판단 자료 부족", "desc": "최고·최저 온도계는 범위만 보여주고 이탈이 몇 시간 지속되었는지는 알려주지 않습니다."}]}, "solution": {"lead": "백신 냉장고 내부에 온도 버퍼를 사용한 무선 온도 센서를 두어 상한과 하한을 모두 감시하고, 이탈 시각과 지속 시간을 기록합니다.", "paragraphs": ["프로브는 백신이 보관된 선반 중앙에 두고 글리콜 등 완충 용기에 넣어 문 개폐에 따른 공기 온도 변동을 걸러냅니다. 센서 본체는 냉장고 외부에 부착해 금속 캐비닛에 의한 전파 차폐를 피합니다.", "이탈 이력은 '몇 ℃에서 몇 분간'으로 남으므로 제조사에 사용 가능 여부를 문의할 때 근거 자료가 됩니다. 초저온 보관 품목은 저온 센서를 적용하되 측정 하한을 사양서로 확인합니다. 교정성적서가 필요한 기관은 교정 범위와 주기를 도입 시 함께 정합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "설치는 진료에 지장을 주지 않고 한 시간 안팎에 끝나며, 이후 2주간 냉장고의 온도 특성을 확인합니다.", "phases": [{"tag": "PHASE 1", "title": "냉장고 상태 확인", "desc": "백신 전용 여부, 적재 위치, 최근 이탈 이력을 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서·온도 버퍼·게이트웨이를 설치합니다.", "duration": "1시간 내외"}, {"tag": "PHASE 3", "title": "온도 특성 확인", "desc": "선반별 온도와 제상 주기를 2주간 관찰해 보관 위치와 알림 조건을 조정합니다.", "duration": "2주"}, {"tag": "PHASE 4", "title": "기록 체계 확정", "desc": "자동 기록 보고서와 이탈 시 조치 절차를 내부 지침에 반영합니다.", "duration": "1주"}]}, "roi": {"lead": "회수는 '보유 백신 가액 × 이탈 사고 발생 가능성'으로 판단합니다. 냉장고 1대에 보관 중인 백신 가액을 합산하면 사고 1건의 손실이 계산됩니다.", "metrics": [{"num": "2~8℃", "desc": "냉장 백신 보관 범위(상·하한 감시)"}, {"num": "0℃", "desc": "동결 손상 위험 온도(이하 노출 시)"}, {"num": "이탈 지속 시간", "desc": "사용 가능 여부 판단의 핵심 자료"}], "before": "하루 2회 수기 기록. 연휴 중 이탈은 다음 진료일 발견. 이탈 지속 시간 불명으로 전량 폐기.", "after": "10분 주기 자동 기록. 고온·동결 방향 구분 알림. 이탈 시각·지속 시간 근거로 사용 여부 판단."}},
  "hospital": {"snapshot": [{"label": "혈액 보관", "value": "1~6℃ 등", "desc": "제제별 보존 온도 관리"}, {"label": "음압격리", "value": "-2.5Pa 이상", "desc": "격리병실 실간 차압 기준"}, {"label": "운영 범위", "value": "부서 + 시설팀", "desc": "알림 수신자 분리"}], "customer": {"lead": "종합병원·상급종합병원의 시설관리팀, 진단검사의학과·혈액은행, 약제부, 감염관리실과 병원 FM 위탁사가 대상입니다.", "paragraphs": ["병원은 혈액관리법에 따른 혈액제제 보존 온도(적혈구 1~6℃, 혈소판 20~24℃, 신선동결혈장 -18℃ 이하), 의약품 보관 조건, 격리병실 음압 기준 등 부서별로 서로 다른 환경 기준을 동시에 관리합니다. 의료기관 인증평가에서는 이들 기록의 유지 여부를 확인합니다."]}, "challenge": {"lead": "병원의 보관 장비는 부서 소관이고 건물 설비는 시설팀 소관이어서, 이상 신호가 한쪽에만 전달되는 경우가 많습니다.", "pains": [{"title": "장비별 개별 경보", "desc": "냉장고·냉동고의 자체 경보음은 해당 실에 사람이 있을 때만 유효하며 야간 검사실은 비어 있는 시간이 깁니다."}, {"title": "음압 유지 확인", "desc": "격리병실은 전실 문 개폐와 필터 막힘으로 차압이 변하지만 현장 차압계는 지나가며 확인해야 합니다."}, {"title": "누수의 의료 영향", "desc": "수술실·중환자실·영상 장비실 상부의 배관 누수는 진료 중단과 고가 장비 손상으로 이어집니다."}, {"title": "유선 증설의 제약", "desc": "운영 중인 병동에서 천장을 열고 배선하는 공사는 감염관리 절차상 제약이 큽니다."}]}, "solution": {"lead": "무선 센서를 사용해 운영 중인 병동과 검사실에 공사 없이 감시점을 추가하고, 알림을 부서 담당자와 시설팀에 동시에 전달합니다.", "paragraphs": ["혈액·시약·의약품 냉장고는 온도 버퍼를 사용한 프로브로, 초저온 냉동고는 저온 센서로 측정합니다. 격리병실은 차압 센서를 복도–전실–병실 사이에 설치해 음압 유지 여부를 연속 기록합니다.", "의료용 냉장고의 건접점 경보 출력, 의료가스·무정전전원장치(UPS)·항온항습기의 고장 접점은 건접점 센서로 받아 통합합니다. 본 시스템은 시설·환경 감시 장치이며 환자 생체신호 감시나 의료기기의 기능을 대체하지 않습니다. 병원 정보보안 정책에 따라 LTE 게이트웨이(외부망 분리) 또는 서버구축형 iMonnit Enterprise 중에서 선택합니다."], "sensors": ["온도", "저온", "온도 버퍼", "차압", "습도", "누수 감지", "건접점", "IoT 게이트웨이(LTE)", "iMonnit Enterprise(서버구축형)"]}, "proposal": {"lead": "인증평가 대상 보관 장비와 격리병실처럼 기준이 명확한 곳부터 시작합니다.", "phases": [{"tag": "PHASE 1", "title": "대상·기준 정리", "desc": "부서별 보관 장비 목록, 관리 범위, 알림 수신자를 정리합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "우선 부서 설치", "desc": "혈액은행·검사실·약제부에 설치합니다. 감염관리 절차에 따라 작업 시간을 조율합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "격리실·기계실 확대", "desc": "음압격리실 차압, 기계실·영상 장비실 누수 감시를 추가합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "운영 정착", "desc": "야간 당직 체계에 알림 대응 절차를 반영하고 인증 대비 보고서 양식을 확정합니다.", "duration": "2~4주"}]}, "roi": {"lead": "회수는 '보관 사고 회피(혈액·시약·의약품 폐기)'와 '기록·순회 공수 절감'으로 산정합니다. 혈액제제는 금액보다 수급 영향이 크므로 예방 자체가 도입 근거가 됩니다.", "metrics": [{"num": "1~6℃", "desc": "적혈구제제 보존 온도"}, {"num": "-2.5Pa", "desc": "음압격리병실 차압 기준"}, {"num": "이중 수신", "desc": "부서 담당자와 시설팀 동시 알림"}], "before": "장비 자체 경보음과 수기 기록. 차압계 육안 확인. 누수는 천장 얼룩으로 인지.", "after": "보관 온도·차압 연속 기록. 야간 이탈 문자 알림. 인증평가용 이력 보고서 확보."}},
  "lab": {"snapshot": [{"label": "대상 장비", "value": "초저온·챔버·청정실", "desc": "-80℃급 냉동고 포함"}, {"label": "구축 방식", "value": "서버구축형", "desc": "iMonnit Enterprise, 사내망 운영"}, {"label": "데이터 연계", "value": "Modbus TCP", "desc": "기존 EMS·BMS 연동"}], "customer": {"lead": "제약·바이오 의약품 제조소의 품질(QA·QC)·설비 조직, 위탁개발생산(CDMO) 시설, 대학·출연연 연구실, 임상시험 검체 분석기관이 대상입니다.", "paragraphs": ["의약품 제조소는 GMP에 따라 보관 조건과 제조 환경을 관리·기록해야 하며, 최근 규제 실사는 데이터 완전성(기록의 귀속성·동시성·원본성 등)을 중점적으로 확인합니다. 연구실은 수년간 축적한 세포주·검체를 초저온 냉동고에 보관합니다."]}, "challenge": {"lead": "연구·제조 시설의 보관 사고는 금액으로 환산하기 어려운 시료와 시험 일정의 손실로 이어집니다.", "pains": [{"title": "초저온 냉동고 고장", "desc": "-80℃급 냉동고는 2단 압축 방식으로 구조가 복잡하고, 고장 시 고내 온도가 수 시간 안에 허용 범위를 벗어납니다."}, {"title": "장비별 분산 기록", "desc": "챔버·냉동고마다 제조사 기록 방식이 달라 통합 조회와 검토가 어렵습니다."}, {"title": "청정실 차압 변동", "desc": "공조기 필터 부하와 문 개폐에 따라 실간 차압이 변하며 역전 여부를 연속으로 확인해야 합니다."}, {"title": "외부 클라우드 제약", "desc": "제조·연구 데이터의 외부 반출을 제한하는 보안 정책으로 클라우드형 서비스 도입이 어려운 조직이 많습니다."}]}, "solution": {"lead": "장비 유형별로 맞는 센서를 적용하고, 보안 요건에 따라 사내 서버에 설치하는 iMonnit Enterprise로 운영합니다.", "paragraphs": ["초저온 냉동고는 저온 센서의 프로브만 포트로 넣고 본체는 외부에 둡니다. 배터리와 전자회로는 초저온에서 동작하지 않기 때문입니다. 액체질소 보관 용기처럼 더 낮은 온도는 센서 측정 하한을 사양서로 확인해 적용 여부를 판단합니다. 안정성 챔버는 온습도 센서로, 청정실은 차압 센서로 측정합니다.", "iMonnit Enterprise는 Windows Server와 MS SQL 환경의 사내 서버에 설치하며 이더넷 게이트웨이로 수집합니다. 이더넷 게이트웨이의 Modbus TCP 출력으로 기존 환경 모니터링 시스템(EMS)에 값을 전달할 수도 있습니다. GMP 용도로 사용할 때 요구되는 적격성 평가, 컴퓨터화 시스템 밸리데이션, 센서 교정은 사용 기관의 품질 시스템에 따라 수행해야 하며 도입 단계에서 범위를 협의합니다."], "sensors": ["저온", "온도", "습도", "차압", "온도 버퍼", "건접점", "이더넷 게이트웨이(Modbus TCP)", "iMonnit Enterprise(서버구축형)"]}, "proposal": {"lead": "비GMP 구역인 연구실 보관 장비에서 시작해 검증 범위를 정한 뒤 GMP 구역으로 넓히는 순서가 현실적입니다.", "phases": [{"tag": "PHASE 1", "title": "요건 정의", "desc": "대상 장비, 관리 범위, 보안·밸리데이션 요건을 문서화합니다.", "duration": "1~2주"}, {"tag": "PHASE 2", "title": "연구 구역 설치", "desc": "초저온 냉동고와 시약 냉장고에 설치해 운영합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "검증 계획 수립", "desc": "GMP 적용 범위에 대해 적격성 평가와 교정 계획을 수립합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "GMP 구역 적용", "desc": "서버구축형 구성과 기존 EMS 연동을 완료하고 검증을 수행합니다.", "duration": "1~3개월"}]}, "roi": {"lead": "회수는 '시료·원료·시험 재수행 손실의 회피'로 판단합니다. 초저온 냉동고 1대에 보관된 검체의 재확보 비용과 기간을 기준으로 삼는 것이 실제에 가깝습니다.", "metrics": [{"num": "-80℃", "desc": "초저온 냉동고 감시(프로브 인입, 본체 외부)"}, {"num": "사내망", "desc": "서버구축형으로 데이터 외부 미반출"}, {"num": "검증 범위 협의", "desc": "적격성 평가·교정은 품질 시스템 기준"}], "before": "장비 자체 경보와 주기적 순회. 장비별 기록 분산. 야간 고장은 출근 후 발견.", "after": "전 장비 온도·차압 통합 기록. 야간 이탈 문자 알림. 사내 서버에 이력 보관."}},
  "morgue": {"snapshot": [{"label": "대상", "value": "안치·조직 보관", "desc": "냉장·냉동 설비"}, {"label": "운영 시간", "value": "24시간", "desc": "야간 당직 1인 체계"}, {"label": "기록", "value": "온도·도어", "desc": "이력 자동 보관"}], "customer": {"lead": "병원 장례식장과 전문 장례식장, 의과대학 해부학 교실, 병리과, 법의학 시설, 인체조직은행이 대상입니다.", "paragraphs": ["장례식장은 장사 등에 관한 법률에 따라 시신 보관용 냉장시설을 갖추어야 하며, 인체조직은행은 관련 법률에 따라 조직의 보관 조건을 관리·기록해야 합니다. 대부분 소수 인원이 24시간 교대로 운영합니다."]}, "challenge": {"lead": "안치·보관 설비의 고장은 금전적 손실보다 유족과 기관에 대한 신뢰 문제로 이어집니다.", "pains": [{"title": "야간 1인 근무", "desc": "당직자가 접객과 사무를 함께 맡고 있어 안치실 설비를 상시 확인하기 어렵습니다."}, {"title": "다실형 냉장고의 편차", "desc": "여러 칸으로 나뉜 안치 냉장고는 칸별 온도 차가 있고 사용 중인 칸의 도어 밀폐 상태가 온도에 영향을 줍니다."}, {"title": "노후 냉동기", "desc": "설비 교체 주기가 길고 여름철 기계실 온도 상승 시 냉동기가 정지하는 사례가 있습니다."}, {"title": "기록 요구", "desc": "조직은행과 교육·연구 시설은 보관 온도 이력을 기록으로 유지해야 합니다."}]}, "solution": {"lead": "안치 냉장고와 보관 냉동고에 무선 온도 센서와 도어 센서를 설치하고 냉동기 전류를 함께 감시합니다.", "paragraphs": ["칸별 온도 차가 큰 설비는 가장 온도가 높게 나타나는 칸을 대표 지점으로 정합니다. 센서 본체는 냉장고 외부에 부착하고 프로브만 고내에 두어 금속 캐비닛의 전파 차폐를 피합니다.", "이탈 알림은 당직자와 시설 담당자에게 문자로 전달합니다. 조직 보관용 초저온 설비는 저온 센서를 적용하고, 법령상 기록 요건에 맞는 보관 기간과 교정 주기를 기관 규정에 따라 설정합니다."], "sensors": ["온도", "저온", "개폐 감지", "전류", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "운영 중단 없이 설치할 수 있으며 대표 지점 선정에 1~2주의 관찰 기간을 둡니다.", "phases": [{"tag": "PHASE 1", "title": "설비 확인", "desc": "안치·보관 설비 수, 칸 구성, 냉동기 위치를 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "온도·도어·전류 센서와 게이트웨이를 설치합니다.", "duration": "반나절~1일"}, {"tag": "PHASE 3", "title": "대표 지점 확정", "desc": "칸별 온도 차를 관찰해 상시 감시 지점과 알림 조건을 정합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "운영 정착", "desc": "당직 근무 지침에 알림 대응 절차를 반영합니다.", "duration": "1주"}]}, "roi": {"lead": "본 분야의 도입 근거는 비용 절감보다 사고 예방과 기록 확보입니다. 설비 고장 1건의 수습 비용과 기관 평판 영향을 기준으로 판단합니다.", "metrics": [{"num": "24h", "desc": "당직자 부재 구간 없는 감시"}, {"num": "전류", "desc": "냉동기 정지 조기 인지"}, {"num": "도어 개폐 이력", "desc": "칸별 개폐 시각 기록"}], "before": "당직자 순회 확인. 설비 자체 경보음에 의존. 온도 이력 수기 관리.", "after": "온도·도어·냉동기 상태 연속 기록. 이탈 시 문자 알림. 보관 이력 자동 보관."}},
  "pharma-cold": {"snapshot": [{"label": "대상", "value": "보관 + 수송", "desc": "창고·수송 용기·차량"}, {"label": "기록 보관", "value": "2년", "desc": "생물학적 제제 수송 온도 기록"}, {"label": "전제 조건", "value": "검·교정", "desc": "자동온도기록장치 요건"}], "customer": {"lead": "의약품 도매상, 제약사 물류센터, 의약품 전문 3PL, 백신·바이오의약품 유통을 맡은 물류사가 대상입니다.", "paragraphs": ["의약품 유통품질 관리기준(KGSP)은 보관 조건의 유지와 기록을 요구합니다. 생물학적 제제 등의 제조·판매관리 규칙은 백신과 냉장·냉동 보관 제품군의 수송에 자동온도기록장치가 설치된 수송설비 사용, 검·교정, 온도 기록 보관을 규정하고 있으며 위반 시 업무정지 등 행정처분 대상입니다."]}, "challenge": {"lead": "의약품 콜드체인은 온도를 지키는 것만으로는 부족하고, 지켰음을 기록으로 입증해야 합니다.", "pains": [{"title": "소량 다회 배송", "desc": "약국·의원으로 가는 소량 배송은 수송 용기 단위로 이루어져 용기마다 온도 기록이 필요합니다."}, {"title": "냉매 구성에 따른 편차", "desc": "수송 용기의 내부 온도는 냉매 종류·수량과 외기 온도에 따라 달라져 사전 검증이 요구됩니다."}, {"title": "기록 관리 부담", "desc": "용기별 기록계 회수, 데이터 추출, 2년 보관은 인력이 많이 드는 작업입니다."}, {"title": "창고 내 온도 분포", "desc": "냉장 창고는 도어 인근과 상단 선반의 온도가 높아 보관 위치에 따라 이탈 위험이 다릅니다."}]}, "solution": {"lead": "냉장 창고는 다점 온도 센서로, 수송 차량은 차량용 LTE 게이트웨이와 온도 센서로 구성해 보관과 수송 기록을 같은 플랫폼에 남깁니다.", "paragraphs": ["창고는 온도 분포 측정으로 취약 지점을 찾아 상시 감시점으로 지정합니다. 차량 적재함에는 온도 센서를 설치하고 차량 전원으로 구동하는 게이트웨이로 실시간 전송하며, 기록은 플랫폼에 보관되어 용기별 기록계를 회수해 내려받는 작업을 줄입니다.", "규칙상 '자동온도기록장치'로 사용하려면 센서의 검·교정 성적과 수송 검증(밸리데이션) 자료가 필요합니다. 적용 가능 범위와 교정 방법은 도입 전 품질 책임자와 함께 확인하며, 수송 용기 내부에 넣는 일회성 기록계는 본 시스템과 병행 사용을 검토합니다."], "sensors": ["온도", "저온", "온도 버퍼", "개폐 감지", "습도", "IoT 게이트웨이(LTE·차량 전원)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "창고 보관 구간을 먼저 구축하고, 수송 구간은 검·교정과 검증 범위를 확정한 뒤 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "규정 대응 범위 확정", "desc": "취급 품목의 제품군 분류와 요구 기록 항목을 품질 책임자와 확정합니다.", "duration": "1~2주"}, {"tag": "PHASE 2", "title": "창고 온도 분포 측정", "desc": "냉장 창고에 센서를 조밀하게 설치해 분포를 측정하고 상시 감시점을 정합니다.", "duration": "2~4주"}, {"tag": "PHASE 3", "title": "수송 구간 시범", "desc": "차량 수 대에 설치해 노선별 온도 기록과 수신 상태를 검증합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "교정·확대", "desc": "검·교정 계획을 반영해 전 거점·차량으로 확대합니다.", "duration": "1~3개월"}]}, "roi": {"lead": "회수는 '온도 이탈에 따른 반품·폐기 감소', '기록 관리 공수 절감', '행정처분 위험 감소'로 판단합니다. 행정처분에 따른 업무정지 손실은 사업 규모에 따라 직접 산정할 수 있습니다.", "metrics": [{"num": "2년", "desc": "수송 온도 기록 의무 보관 기간"}, {"num": "2~8℃", "desc": "냉장 의약품·백신 수송 유지 온도"}, {"num": "검·교정", "desc": "자동온도기록장치 사용의 전제 요건"}], "before": "용기·차량별 기록계 회수 후 수동 추출. 창고는 제어용 센서 값에 의존. 이탈은 도착 후 확인.", "after": "보관·수송 온도를 플랫폼에 자동 보관. 운행 중 이탈 문자 알림. 감사 시 기간별 이력 즉시 제출."}},
  "uc-nicu": {"snapshot": [{"label": "감시 대상", "value": "보관 장비·실 환경", "desc": "모유·약품 냉장고, 온습도"}, {"label": "역할", "value": "시설 보조 감시", "desc": "의료기기·임상 판단 비대체"}, {"label": "설치", "value": "무공사", "desc": "운영 중 병동에 부착 설치"}], "customer": {"lead": "신생아 집중치료실을 운영하는 병원의 간호부, 감염관리실, 시설관리팀이 대상입니다.", "paragraphs": ["신생아 집중치료실은 체온 조절 능력이 낮은 미숙아가 재실하는 공간으로 실내 온습도 유지가 중요하며, 유축 모유와 약품을 병동 내 냉장고에 보관합니다. 감염관리를 위해 출입과 공사가 엄격히 제한됩니다."]}, "challenge": {"lead": "치료실 안의 환경과 보관 장비는 간호 인력이 진료와 병행해 확인하고 있습니다.", "pains": [{"title": "모유 냉장고 관리", "desc": "유축 모유는 보관 온도와 기간 관리가 필요하지만 냉장고 온도 확인은 근무 교대 시 수기로 이루어집니다."}, {"title": "실내 온습도 변동", "desc": "공조 이상이나 출입문 개방으로 실내 온습도가 변해도 벽면 온도계는 지나가며 확인하는 수준입니다."}, {"title": "공사 제약", "desc": "천장 개방과 배선 공사는 감염 위험 때문에 운영 중인 치료실에서 시행하기 어렵습니다."}, {"title": "기록 부담", "desc": "인증평가와 내부 감사에 대비한 환경·보관 기록이 간호 업무에 더해집니다."}]}, "solution": {"lead": "배터리로 동작하는 무선 센서를 부착 방식으로 설치해 치료실 운영을 멈추지 않고 감시점을 추가합니다.", "paragraphs": ["모유·약품 냉장고에는 온도 버퍼를 사용한 프로브를, 치료실 벽면에는 온습도 센서를, 전실과 복도 사이에는 차압 센서를 설치합니다. 센서는 보육기 내부가 아닌 실 환경과 보관 장비를 측정합니다.", "보육기(인큐베이터)와 환자 감시 장치는 허가된 의료기기이며 본 시스템은 그 기능을 대체하거나 연결하지 않습니다. 무선 기기의 의료기기 인접 사용은 병원의 전자파 관리 기준에 따라 사전 검토를 거칩니다. 알림은 수간호사와 시설팀에 문자로 전달합니다."], "sensors": ["온도", "습도", "온도 버퍼", "차압", "개폐 감지", "누수 감지", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "감염관리실과 설치 위치·시간을 협의한 뒤 짧은 시간 안에 부착 설치합니다.", "phases": [{"tag": "PHASE 1", "title": "사전 협의", "desc": "감염관리실·의공팀과 설치 위치, 무선 기기 사용 조건을 협의합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "냉장고·실 환경·차압 센서를 부착 설치합니다.", "duration": "반나절"}, {"tag": "PHASE 3", "title": "기준 설정", "desc": "부서 기준에 맞춰 알림 범위와 수신자를 설정합니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "기록 활용", "desc": "자동 기록을 근무 교대 점검표와 인증 대비 자료에 활용합니다.", "duration": "지속"}]}, "roi": {"lead": "본 분야는 비용 회수보다 환자 안전을 위한 환경 관리와 간호 인력의 기록 부담 경감이 도입 근거입니다.", "metrics": [{"num": "무공사", "desc": "천장 개방·배선 없이 부착 설치"}, {"num": "144회", "desc": "10분 주기의 하루 기록 횟수(교대별 수기 확인 대비)"}, {"num": "이중 수신", "desc": "간호부와 시설팀 동시 알림"}], "before": "근무 교대 시 수기 확인. 벽면 온도계 육안 점검. 냉장고 이상은 사용 시 발견.", "after": "보관 온도·실 온습도·차압 연속 기록. 이탈 시 문자 알림. 인증 대비 이력 확보."}},
  "uc-pharma-refrig": {"snapshot": [{"label": "보관 조건", "value": "2~8℃", "desc": "냉장 보관 의약품"}, {"label": "무인 시간", "value": "야간·휴일", "desc": "폐문 후 감시"}, {"label": "설치", "value": "1시간 내외", "desc": "전원 연결만 필요"}], "customer": {"lead": "지역 약국, 의원, 요양병원, 병원 약제부, 동물병원 등 냉장 의약품을 소량 다품목으로 보관하는 기관이 대상입니다.", "paragraphs": ["약사법령은 의약품을 허가된 저장 방법대로 보관하도록 하고 있으며 냉장 의약품은 대부분 2~8℃입니다. 약국과 의원은 영업시간 외에는 무인 상태이고, 고가의 생물학적 제제와 주사제 취급이 늘면서 냉장고 1대의 보관 가액이 커졌습니다."]}, "challenge": {"lead": "소규모 기관의 의약품 냉장고는 하루 대부분의 시간 동안 아무도 보지 않습니다.", "pains": [{"title": "일반 냉장고의 한계", "desc": "가정용·음료용 냉장고는 온도 편차가 크고 벽면 근처에서 동결이 일어날 수 있습니다."}, {"title": "과적재", "desc": "의약품을 가득 채우면 냉기 순환이 막혀 위치별 온도 차가 커집니다."}, {"title": "휴일 정전", "desc": "건물 전기 점검이나 차단기 트립으로 인한 정전은 예고 없이 발생하고 복귀 후에는 흔적이 남지 않습니다."}, {"title": "기록 미비", "desc": "소규모 기관은 온도 기록 자체가 없는 경우가 많아 이탈 시 사용 여부를 판단할 근거가 없습니다."}]}, "solution": {"lead": "냉장고 내부에 온도 버퍼를 사용한 무선 온도 센서를 두고 LTE 게이트웨이 1대로 수집합니다.", "paragraphs": ["프로브는 의약품이 놓인 중앙 선반에 두며 본체는 냉장고 외부에 자석으로 부착합니다. 게이트웨이는 내장 배터리로 정전 중에도 동작하므로, 정전 시각과 복귀 시각 사이의 고내 온도 변화가 그대로 기록됩니다.", "상한(8℃ 초과)과 하한(2℃ 미만) 알림을 모두 설정합니다. 이탈이 확인되면 지속 시간 기록을 근거로 제조사·공급사에 사용 가능 여부를 문의할 수 있습니다."], "sensors": ["온도", "온도 버퍼", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "센서 한두 개와 게이트웨이 한 대로 시작할 수 있는 가장 단순한 구성입니다.", "phases": [{"tag": "PHASE 1", "title": "보관 상태 확인", "desc": "냉장고 종류, 적재 상태, 보관 품목 가액을 확인합니다.", "duration": "30분"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서·온도 버퍼·게이트웨이를 설치합니다.", "duration": "1시간 내외"}, {"tag": "PHASE 3", "title": "기준 조정", "desc": "1~2주간 온도 변동폭을 확인해 보관 위치와 알림 조건을 조정합니다.", "duration": "1~2주"}]}, "roi": {"lead": "회수는 '냉장고 1대의 의약품 보관 가액'을 기준으로 판단합니다. 고가 주사제를 보관하는 기관은 이탈 사고 1건의 손실이 연간 운영비를 넘는 경우가 일반적입니다.", "metrics": [{"num": "2~8℃", "desc": "상·하한 양방향 감시"}, {"num": "1시간", "desc": "설치 소요(내외)"}, {"num": "정전 중 기록", "desc": "게이트웨이 내장 배터리로 온도 변화 기록"}], "before": "온도 기록 없음 또는 하루 1회 수기. 휴일 정전 미인지. 이탈 시 판단 근거 없음.", "after": "10분 주기 자동 기록. 폐문 후 이탈 문자 알림. 이탈 지속 시간 근거 확보."}},
  "uc-elderly": {"snapshot": [{"label": "감지 방식", "value": "비영상", "desc": "동작·도어·비상벨·온도"}, {"label": "통신", "value": "LTE", "desc": "가정 인터넷 불필요"}, {"label": "알림", "value": "SMS", "desc": "보호자·생활지원사·관리자"}], "customer": {"lead": "지방자치단체 노인복지 부서, 노인맞춤돌봄 수행기관, 고령자 임대주택 운영 기관, 요양시설, 사회복지관이 대상입니다.", "paragraphs": ["고독사 예방 및 관리에 관한 법률 시행 이후 지자체의 1인 가구 안부 확인 사업이 확대되었고, 보건복지부의 응급안전안심서비스도 가정 내 감지 장비를 활용하고 있습니다. 대상 가구는 인터넷이 없거나 스마트폰 사용이 어려운 경우가 많습니다."]}, "challenge": {"lead": "안부 확인 인력이 방문하지 않는 시간 동안에는 이상 징후를 알 방법이 없습니다.", "pains": [{"title": "방문 주기 사이의 공백", "desc": "생활지원사 1명이 다수 가구를 담당해 방문·전화 간격이 며칠씩 벌어집니다."}, {"title": "영상 장비에 대한 거부감", "desc": "카메라는 사생활 침해 우려로 당사자 동의를 얻기 어렵습니다."}, {"title": "폭염·한파 위험", "desc": "냉난방을 아끼는 고령 가구는 여름철 실내 고온과 겨울철 저온에 장시간 노출됩니다."}, {"title": "통신 환경", "desc": "가정 내 인터넷이 없어 와이파이 기반 기기는 설치할 수 없습니다."}]}, "solution": {"lead": "동작 감지, 출입문 개폐, 비상벨(버튼), 온도 센서를 거실·침실·현관·화장실에 부착하고 LTE 게이트웨이로 수집합니다.", "paragraphs": ["일정 시간 동안 동작 감지나 출입문 개폐가 없으면 관리자에게 알림이 가도록 조건을 설정합니다. 실내 온도가 폭염·한파 기준을 넘는 경우와 비상벨이 눌린 경우는 즉시 문자로 통보합니다. 센서는 영상과 음성을 수집하지 않으며 배터리로 동작해 배선이 필요 없습니다.", "본 시스템은 생활 반응과 환경을 확인하는 보조 수단이며 낙상이나 건강 상태를 진단하는 의료기기가 아닙니다. 설치 전 당사자 동의와 수집 항목 고지 등 개인정보 보호법상 절차를 수행 기관이 갖추어야 하고, 알림 수신 후의 확인·출동 절차를 사전에 정해 두어야 합니다."], "sensors": ["움직임 감지", "개폐 감지", "비상벨(버튼)", "온도", "습도", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "소수 가구 시범 운영으로 미감지 판단 시간과 대응 절차를 다듬은 뒤 대상 가구를 늘립니다.", "phases": [{"tag": "PHASE 1", "title": "대상 선정·동의", "desc": "대상 가구를 선정하고 수집 항목과 알림 대상을 설명해 동의를 받습니다.", "duration": "1~2주"}, {"tag": "PHASE 2", "title": "설치", "desc": "가구당 센서 3~5개와 게이트웨이를 부착 설치합니다.", "duration": "가구당 30분~1시간"}, {"tag": "PHASE 3", "title": "판단 기준 조정", "desc": "가구별 생활 패턴에 맞춰 미감지 판단 시간과 온도 기준을 조정합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "대상 확대", "desc": "대응 절차를 확정하고 대상 가구를 확대합니다.", "duration": "지속"}]}, "roi": {"lead": "공공 돌봄 사업의 효과는 '위급 상황 발견 시간 단축'과 '생활지원사의 확인 업무 효율'로 평가합니다. 가구당 장비 비용과 연간 플랫폼 이용료를 방문 확인 인건비와 비교해 사업 규모를 정합니다.", "metrics": [{"num": "비영상", "desc": "영상·음성 미수집으로 동의 부담 완화"}, {"num": "3~5개", "desc": "가구당 센서 수"}, {"num": "미감지 시간", "desc": "가구별 생활 패턴에 맞춘 판단 기준"}], "before": "주기적 방문·전화 확인. 방문 사이 이상 미인지. 폭염·한파 시 전수 전화.", "after": "생활 반응 미감지·비상벨·실내 온도 이상 문자 알림. 우선 확인 가구 선별. 확인 이력 기록."}},
  "manufact": {"snapshot": [{"label": "평가 지표", "value": "진동 속도 RMS(mm/s)", "desc": "ISO 20816 평가 구간 참조"}, {"label": "보조 지표", "value": "온도·전류", "desc": "베어링 발열·부하 변화"}, {"label": "측정 방식", "value": "주기 측정", "desc": "추세 감시용, 정밀 진단은 별도"}], "customer": {"lead": "자동차·부품, 철강·금속, 화학, 제지, 식품·사료 등 연속 가동 설비를 보유한 제조업체의 공무·설비보전 조직이 대상입니다.", "paragraphs": ["국내 제조 현장의 회전 설비 관리는 순회 점검원이 휴대용 진동계로 월 1회 안팎 측정하는 방식이 일반적입니다. 숙련 보전 인력의 고령화와 채용난으로 순회 주기를 유지하기 어려워지고 있으며, 중대재해처벌법 시행 이후 가동 중인 설비 근처의 점검 작업을 줄이려는 요구가 커졌습니다."]}, "challenge": {"lead": "회전 설비의 고장은 대부분 수 주에서 수개월에 걸쳐 진행되지만, 측정 간격이 길면 그 사이의 변화를 놓칩니다.", "pains": [{"title": "측정 간격의 한계", "desc": "월 1회 측정으로는 베어링 손상이 급격히 진행되는 마지막 구간을 포착하기 어렵습니다."}, {"title": "접근 위험 설비", "desc": "고소, 고온, 회전체 인근 설비는 가동 중 측정 자체가 위험 작업이어서 점검이 생략되기 쉽습니다."}, {"title": "사후 정비 비용", "desc": "비계획 정지는 부품비 외에 생산 손실, 2차 손상, 긴급 조달 비용을 동반합니다."}, {"title": "유선 진동 감시의 비용", "desc": "상시 감시용 유선 진동 시스템은 채널당 비용과 배선 공사 부담으로 핵심 설비 일부에만 적용됩니다."}]}, "solution": {"lead": "베어링 하우징에 무선 진동 센서를 부착해 진동 속도와 온도를 주기적으로 기록하고, 기준 대비 상승 추세가 나타나면 알림을 발생시킵니다.", "paragraphs": ["진동 속도 RMS는 불평형·축정렬 불량·풀림 같은 저주파 결함의 대표 지표이며 ISO 20816의 설비 등급별 평가 구간과 비교할 수 있습니다. 예를 들어 강성 기초의 중형 기계는 2.8mm/s와 4.5mm/s가 주의·위험 구간의 경계로 쓰입니다. 절대값보다 설비별 정상 상태 대비 변화율을 보는 것이 실무에 맞습니다. 모터 전류는 클램프형 전류 센서로 측정해 부하 변화와 가동 시간을 함께 기록합니다.", "무선 센서는 배터리 수명을 위해 주기적으로 측정·전송하므로 연속 파형 수집과 스펙트럼 정밀 분석을 대체하지 않습니다. 이상 추세가 감지된 설비에 한해 정밀 진단 장비로 원인을 분석하는 2단계 운영이 적합합니다. 폭발위험장소는 방폭 인증 기기가 필요하므로 설치 구역의 방폭 등급을 사전에 확인합니다."], "sensors": ["진동", "온도", "전류", "전압", "압력", "건접점", "IoT 게이트웨이(LTE)", "이더넷 게이트웨이(Modbus TCP)"]}, "proposal": {"lead": "고장 시 생산 영향이 큰 설비 10~20대를 선정해 기준선을 만든 뒤 대상을 넓힙니다.", "phases": [{"tag": "PHASE 1", "title": "대상 설비 선정", "desc": "설비 중요도와 고장 이력을 기준으로 대상을 정하고 정격·회전수·기초 형식을 정리합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "센서 부착", "desc": "베어링 하우징의 부하 방향에 센서를 부착합니다. 가동 중 부착이 어려운 설비는 정기 정지에 맞춥니다.", "duration": "1~3일"}, {"tag": "PHASE 3", "title": "기준선 수립", "desc": "4~8주간 정상 운전 데이터를 수집해 설비별 경고·위험 기준을 설정합니다.", "duration": "4~8주"}, {"tag": "PHASE 4", "title": "정비 연계·확대", "desc": "알림을 작업 요청 절차에 연결하고 대상 설비를 확대합니다.", "duration": "지속"}]}, "roi": {"lead": "회수는 '비계획 정지 1회의 손실(시간당 생산 손실 × 정지 시간 + 긴급 수리비)'을 기준으로, 연간 몇 건을 계획 정비로 전환할 수 있는지로 산정합니다.", "metrics": [{"num": "2.8", "desc": "ISO 20816 중형 기계(강성 기초) 주의 구간 경계(mm/s)"}, {"num": "4.5", "desc": "같은 조건의 위험 구간 경계(mm/s)"}, {"num": "월 1회 → 상시", "desc": "순회 측정 대비 감시 빈도"}], "before": "월 1회 휴대 측정. 접근 위험 설비는 점검 생략. 고장 후 긴급 정비.", "after": "설비별 진동·온도 추세 확보. 상승 추세 알림으로 계획 정지에 맞춘 정비. 위험 구역 점검 작업 축소."}},
  "construct": {"snapshot": [{"label": "한중 콘크리트", "value": "5℃ 이상 유지", "desc": "소요 압축강도 확보 시까지"}, {"label": "밀폐공간 CO", "value": "30ppm 미만", "desc": "산업안전보건기준 적정공기"}, {"label": "통신", "value": "LTE", "desc": "현장 인터넷 불필요"}], "customer": {"lead": "건축·토목 시공사의 품질·안전 관리 조직, 골조 전문건설업체, 감리단, 품질시험 대행기관이 대상입니다.", "paragraphs": ["콘크리트 표준시방서(KCS 14 20 40)는 일평균기온 4℃ 이하 등의 조건을 한중 콘크리트로 규정하고, 소요 압축강도가 얻어질 때까지 콘크리트 온도를 5℃ 이상으로 유지하도록 하고 있습니다. 보온 양생 공간에서 갈탄·열풍기를 사용할 때의 일산화탄소 중독은 매년 겨울 반복되는 중대재해 유형입니다."]}, "challenge": {"lead": "양생은 타설 후 수일간 야간에도 진행되지만, 현장에는 그 시간에 관리 인력이 거의 없습니다.", "pains": [{"title": "야간 양생 온도 저하", "desc": "열풍기 연료 소진이나 천막 손상으로 양생 온도가 떨어지면 초기 동해로 강도가 회복되지 않습니다."}, {"title": "기록의 대표성", "desc": "하루 몇 차례 봉 온도계로 잰 값은 부재의 모서리·중앙 등 위치별 차이와 야간 최저값을 반영하지 못합니다."}, {"title": "양생 공간 질식 위험", "desc": "보온을 위해 밀폐한 공간에 일산화탄소가 축적되며, 양생 상태를 확인하러 들어간 작업자가 피해를 입습니다."}, {"title": "임시 설비 환경", "desc": "가설 전기와 임시 통신에 의존하는 현장은 유선 계측 설비를 설치·철거하기 번거롭습니다."}]}, "solution": {"lead": "K타입 열전대 센서를 콘크리트에 매립하거나 표면에 부착해 양생 온도를 연속 기록하고, 양생 공간에는 가스 센서를 두어 출입 전 농도를 확인합니다.", "paragraphs": ["열전대 프로브는 부재 중앙부와 모서리·개구부 주변처럼 온도가 가장 낮을 위치에 설치합니다. 기록된 온도 이력으로 적산온도 M=Σ(θ+10)Δt 를 계산해 강도 발현을 추정하고 거푸집 해체 시기 판단의 참고 자료로 씁니다. 최종 판정은 공시체 강도 시험에 따릅니다.", "양생 공간의 일산화탄소 농도는 문자 알림으로 관리자에게 전달해 출입 통제 판단을 돕습니다. 이 센서는 상시 감시용이며, 밀폐공간 작업 전 측정은 법령에 따라 교정된 휴대용 측정기로 수행해야 합니다. 지하층 집수정의 수위와 가설 분전반 전원도 같은 게이트웨이로 수집합니다. 장비는 공정이 끝나면 회수해 다음 층·다음 현장에 재사용합니다."], "sensors": ["고온(K타입 열전대)", "온도", "습도", "일산화탄소(CO)", "누수 감지 플로트", "전압 감지", "기울기", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "동절기 타설 계획에 맞춰 층 단위로 설치·회수를 반복합니다.", "phases": [{"tag": "PHASE 1", "title": "측정 계획 수립", "desc": "타설 구획별 측정 위치, 관리 온도, 알림 수신자를 양생 계획서에 반영합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "타설 시 설치", "desc": "철근 배근 후 프로브를 고정하고 타설 직후부터 기록을 시작합니다.", "duration": "타설 당일"}, {"tag": "PHASE 3", "title": "양생 감시", "desc": "양생 온도와 양생 공간 가스 농도를 원격으로 확인합니다.", "duration": "타설 후 수일"}, {"tag": "PHASE 4", "title": "기록 제출·회수", "desc": "온도 이력과 적산온도 계산서를 품질 기록으로 제출하고 장비를 회수합니다.", "duration": "1일"}]}, "roi": {"lead": "효과는 '초기 동해에 따른 보수·재시공 회피'와 '야간 양생 관리 인력 배치 축소', '품질 기록 확보'입니다. 장비는 현장 간 재사용되므로 타설 회차당 비용으로 환산해 봅니다.", "metrics": [{"num": "5℃", "desc": "한중 콘크리트 초기 양생 유지 온도(이상)"}, {"num": "30ppm", "desc": "밀폐공간 일산화탄소 적정공기 기준(미만)"}, {"num": "적산온도", "desc": "온도 이력으로 M=Σ(θ+10)Δt 산정"}], "before": "하루 수회 수기 측정. 야간 온도 저하 미인지. 양생 공간 출입 전 농도 확인 누락.", "after": "양생 온도 연속 기록과 야간 저하 알림. 가스 농도 원격 확인. 온도 이력을 품질 기록으로 제출."}},
  "datacenter": {"snapshot": [{"label": "흡기 온도", "value": "18~27℃", "desc": "ASHRAE 권장 범위"}, {"label": "감시 밀도", "value": "랙 단위", "desc": "상·중·하단 다점 측정"}, {"label": "연동", "value": "Modbus TCP", "desc": "DCIM·BMS에 포인트 추가"}], "customer": {"lead": "상업용 데이터센터 사업자, 금융·공공·통신사의 전산센터, 기업 자체 데이터센터의 시설 운영 조직이 대상입니다.", "paragraphs": ["2022년 판교 데이터센터 화재 이후 일정 규모 이상의 데이터센터는 방송통신발전기본법상 재난관리 의무 대상에 포함되었고, 집적정보통신시설 보호지침도 강화되었습니다. 고밀도 서버 도입으로 랙당 발열이 커지면서 실 평균 온도만으로는 냉각 상태를 판단하기 어려워졌습니다."]}, "challenge": {"lead": "전산실 사고의 물리적 원인은 대부분 열, 물, 전원 세 가지이며 모두 국부적으로 시작됩니다.", "pains": [{"title": "국부 과열", "desc": "실 전체 온도는 정상이어도 특정 랙 상단의 흡기 온도는 재순환 기류로 권장 범위를 넘습니다."}, {"title": "이중마루 하부 누수", "desc": "냉수 배관, 항온항습기 드레인, 가습 급수 배관의 누수는 마루 아래에서 진행되어 발견이 늦습니다."}, {"title": "과냉각 운전", "desc": "핫스팟이 어디인지 모르기 때문에 급기 온도를 필요 이상으로 낮게 설정해 냉각 전력을 낭비합니다."}, {"title": "감시 포인트 증설 비용", "desc": "기존 DCIM·BMS에 유선 포인트를 추가하려면 가동 중인 전산실에서 배선 공사를 해야 합니다."}]}, "solution": {"lead": "무선 온도 센서를 랙 전면 상·중·하단에 배치해 흡기 온도 분포를 측정하고, 누수·차압·배터리실 온도를 같은 계통으로 수집합니다.", "paragraphs": ["흡기 온도는 랙 상단이 가장 높게 나타나므로 상단 측정을 우선합니다. 콜드아일 컨테인먼트는 차압 센서로 양압 유지 여부를 확인합니다. 이중마루 하부에는 배관 경로를 따라 로프형 누수 센서를 설치합니다. 납축전지는 주위 온도가 높을수록 수명이 짧아지므로 배터리실 온도를 별도로 기록합니다.", "이더넷 게이트웨이의 Modbus TCP로 기존 DCIM·BMS에 값을 전달해 감시 화면을 통합합니다. 본 시스템은 환경 감시용이며 소방 설비, 배터리 관리 시스템(BMS)의 셀 단위 감시, 전력 계통 보호 기능을 대체하지 않습니다. 망 분리 정책이 있는 시설은 서버구축형 iMonnit Enterprise로 내부망에서 운영합니다."], "sensors": ["온도", "습도", "차압", "누수 감지 로프", "누수 감지", "개폐 감지", "전류", "이더넷 게이트웨이(Modbus TCP)", "iMonnit Enterprise(서버구축형)"]}, "proposal": {"lead": "한 개 전산실에서 온도 분포를 측정해 핫스팟을 확인한 뒤 상시 감시 지점을 정합니다.", "phases": [{"tag": "PHASE 1", "title": "현황 조사", "desc": "랙 배치, 냉각 방식, 배관 경로, 기존 감시 포인트를 조사합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "분포 측정", "desc": "대상 전산실 랙에 센서를 조밀하게 설치해 2~4주간 흡기 온도 분포를 측정합니다.", "duration": "2~4주"}, {"tag": "PHASE 3", "title": "기류 개선·상시점 확정", "desc": "블랭킹 패널, 타일 배치 등 기류 개선 후 재측정하고 상시 감시 지점을 확정합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "전 실 확대·연동", "desc": "다른 전산실로 확대하고 DCIM·BMS에 연동합니다.", "duration": "1~2개월"}]}, "roi": {"lead": "절감은 '급기 설정 온도를 올릴 수 있는 여유'에서 나옵니다. 설정 변경 전후의 냉동기·항온항습기 전력을 실측 비교해 산정하며, 장애 회피 효과는 시간당 서비스 손실액을 기준으로 별도 평가합니다.", "metrics": [{"num": "18℃", "desc": "ASHRAE 권장 흡기 온도 하한"}, {"num": "27℃", "desc": "ASHRAE 권장 흡기 온도 상한"}, {"num": "전후 실측", "desc": "급기 설정 조정 효과 검증 방식"}], "before": "실 평균 온도와 항온항습기 환기 온도로 판단. 마루 하부 누수는 점검 시 발견. 여유를 몰라 과냉각.", "after": "랙 단위 흡기 온도 분포 확보. 누수·차압 이상 문자 알림. 실측 근거로 급기 설정 조정."}},
  "energy": {"snapshot": [{"label": "대상", "value": "무인·원격 설비", "desc": "정압기·충전소·열배관·관정"}, {"label": "신호", "value": "압력·온도·접점", "desc": "기존 제어반 경보 수집"}, {"label": "유의 사항", "value": "방폭 구역", "desc": "방폭 인증 기기 적용"}], "customer": {"lead": "도시가스사, 집단에너지 사업자, LPG·수소 충전소 운영사, 발전소 부대설비 관리 조직, 상수도·지하수 시설을 관리하는 공공기관이 대상입니다.", "paragraphs": ["국내 에너지 공급 설비는 도시가스사업법, 고압가스 안전관리법, 전기안전관리법 등에 따라 정기 점검과 안전관리자 선임이 의무화되어 있습니다. 설비는 넓은 지역에 분산되어 있고 다수가 무인으로 운영되며, 기존 원격감시제어(SCADA)에 포함되지 않은 소규모 설비가 남아 있습니다."]}, "challenge": {"lead": "원격지 설비의 제어반에는 이미 경보 접점이 있지만, 그 신호가 현장 경광등에서 끝나는 경우가 많습니다.", "pains": [{"title": "순회 점검 의존", "desc": "분산된 무인 설비는 점검원이 주기적으로 방문해 압력계와 경보등을 확인합니다."}, {"title": "소규모 설비의 감시 공백", "desc": "SCADA 포인트 추가 비용이 설비 규모에 비해 커서 소형 정압기나 관정은 원격 감시 대상에서 빠집니다."}, {"title": "통신·전원 제약", "desc": "현장에 인터넷 회선이 없고 전원 여유가 적어 일반 IT 장비를 설치하기 어렵습니다."}, {"title": "방폭 요건", "desc": "가스 취급 구역은 폭발위험장소로 분류되어 설치 가능한 전기 기기가 제한됩니다."}]}, "solution": {"lead": "제어반의 경보 접점은 건접점 센서로, 압력과 온도는 무선 압력·온도 센서로 수집하고 LTE 게이트웨이로 전송합니다.", "paragraphs": ["기존 압력 전송기의 4-20mA 신호는 전류 입력형 센서로 받을 수 있어 계기를 교체하지 않고 값을 원격에서 확인합니다. 차단기 트립, 펌프 고장, 이상 압력 같은 접점 신호는 상태가 바뀌는 즉시 전송됩니다. 게이트웨이는 LTE 유심을 내장하고 내장 배터리로 정전 중에도 2~3일 동작합니다.", "폭발위험장소 내부에는 방폭 인증을 받은 기기만 설치할 수 있습니다. 방폭 사양 센서(IECEx 인증)는 국내 설치 조건과 인증 요건을 사전에 확인해 적용하고, 일반 센서와 게이트웨이는 비위험 구역에 둡니다. 본 시스템은 감시·통보용이며 긴급 차단 등 안전 계장 기능은 기존 설비가 담당합니다."], "sensors": ["압력", "온도", "건접점", "전압 감지", "전류", "4-20mA 입력", "방폭 온도 센서", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "기존 감시 체계에서 빠져 있는 소규모 설비부터 접점 신호 수집으로 시작합니다.", "phases": [{"tag": "PHASE 1", "title": "설비·구역 조사", "desc": "대상 설비의 경보 접점, 계기 신호, 방폭 구역 구분을 조사합니다.", "duration": "1~2주"}, {"tag": "PHASE 2", "title": "시범 설치", "desc": "설비 수 개소에 접점·압력 센서와 게이트웨이를 설치합니다.", "duration": "개소당 반나절"}, {"tag": "PHASE 3", "title": "알림 체계 정비", "desc": "경보 종류별 수신자와 출동 기준을 정합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "권역 확대", "desc": "권역별 설비로 확대하고 필요 시 상위 시스템에 데이터를 연계합니다.", "duration": "1~3개월"}]}, "roi": {"lead": "회수는 '순회 점검 횟수 조정에 따른 출동비 절감'과 '고장 인지 지연에 따른 공급 중단 손실 회피'로 산정합니다. 법정 점검 주기는 줄일 수 없으므로 법정 외 자체 순회분만 절감 대상으로 봅니다.", "metrics": [{"num": "4-20mA", "desc": "기존 전송기 신호 활용"}, {"num": "2~3일", "desc": "정전 시 게이트웨이 동작 시간"}, {"num": "접점 즉시 전송", "desc": "경보 상태 변화 시 문자 통보"}], "before": "주기적 순회로 압력계·경보등 확인. 소규모 설비 원격 감시 없음. 고장은 수용가 신고로 인지.", "after": "경보 접점·압력 원격 수집. 이상 시 문자 알림. 출동 우선순위를 데이터로 결정."}},
  "solar": {"snapshot": [{"label": "역할", "value": "부대설비 감시", "desc": "인버터 모니터링(RMS) 보완"}, {"label": "모듈 특성", "value": "약 -0.3~-0.4%/℃", "desc": "결정질 모듈 출력 온도계수"}, {"label": "통신", "value": "LTE", "desc": "산지·농지 현장 대응"}], "customer": {"lead": "태양광 발전사업자, 발전소 유지관리(O&M) 전문업체, 전기안전관리 대행 사업자, 자산운용사의 발전 자산 관리 조직이 대상입니다.", "paragraphs": ["국내 태양광 발전소는 중소 규모가 전국에 분산되어 있고 다수가 무인으로 운영됩니다. 발전량은 인버터 제조사의 원격 모니터링으로 확인하지만, 인버터실의 환기 상태, 접속반 과열, 침수, 무단 출입은 그 범위에 들어 있지 않습니다."]}, "challenge": {"lead": "발전량이 줄었다는 사실은 알 수 있어도, 현장에 가기 전에는 그 원인을 구분하기 어렵습니다.", "pains": [{"title": "인버터 과열 출력 제한", "desc": "인버터는 내부 온도가 오르면 출력을 스스로 제한합니다. 환기팬 고장이나 필터 막힘이 원인이지만 발전량 그래프만으로는 구분되지 않습니다."}, {"title": "접속반 열화", "desc": "단자 풀림과 접촉 저항 증가는 국부 발열로 이어지며 화재의 원인이 됩니다."}, {"title": "집중호우 피해", "desc": "저지대와 산지 발전소는 배수 불량으로 인버터실·수배전반이 침수됩니다."}, {"title": "원거리 출동", "desc": "발전소가 분산되어 있어 한 번의 출동에 반나절 이상이 소요됩니다."}]}, "solution": {"lead": "인버터실과 접속반 내부에 온도 센서를, 바닥에 누수 센서를, 출입문에 개폐 센서를 설치하고 인버터의 고장 접점을 건접점 센서로 받습니다.", "paragraphs": ["결정질 실리콘 모듈은 온도가 1℃ 오를 때 출력이 약 0.3~0.4% 감소합니다. 모듈 후면 온도를 기록하면 일사 조건이 같은 날의 발전량 차이를 온도 영향과 설비 이상으로 나누어 볼 수 있습니다. 인버터실 온도와 환기팬 전류를 함께 기록하면 출력 제한의 원인을 원격에서 판단할 수 있습니다.", "무선 전류 센서는 교류 전류 측정용이므로 인버터 출력 측에 적용합니다. 직류 스트링 전류는 별도의 직류 전류 변환기 출력을 아날로그 입력형 센서로 받는 방식으로 구성해야 합니다. 발전량 계량과 전력 거래용 데이터는 기존 계량 설비의 영역입니다."], "sensors": ["온도", "전류(AC)", "건접점", "누수 감지", "개폐 감지", "전압 감지", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "출동 거리가 먼 발전소와 과거 침수·과열 이력이 있는 발전소부터 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "대상 발전소 선정", "desc": "출동 거리와 고장 이력을 기준으로 대상을 정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "인버터실·접속반·수배전반에 센서를 설치합니다. 충전부 인근 작업은 전기안전관리자 입회하에 진행합니다.", "duration": "개소당 반나절"}, {"tag": "PHASE 3", "title": "원인 판별 기준 수립", "desc": "발전량 저하와 온도·접점 신호의 대응 관계를 정리합니다.", "duration": "1~2개월"}, {"tag": "PHASE 4", "title": "전 발전소 확대", "desc": "관리 발전소 전체로 확대합니다.", "duration": "개소당 반나절"}]}, "roi": {"lead": "회수는 '출동 전 원인 파악에 따른 재방문 감소'와 '출력 제한·정지 시간 단축에 따른 발전 수익 회복'으로 산정합니다. 발전소 용량과 SMP·REC 단가로 정지 1시간의 손실을 계산할 수 있습니다.", "metrics": [{"num": "-0.4%", "desc": "결정질 모듈 출력 온도계수(℃당 약 -0.3~-0.4%)"}, {"num": "반나절", "desc": "개소당 설치 소요"}, {"num": "원인 구분", "desc": "과열·침수·접점 고장 원격 판별"}], "before": "발전량 저하 확인 후 현장 출동. 원인은 도착 후 파악. 침수·과열은 사고 후 인지.", "after": "부대설비 상태 원격 확인. 이상 시 문자 알림. 출동 전 원인 추정과 부품 준비."}},
  "uc-plant-maint": {"snapshot": [{"label": "대상", "value": "보조·예비 설비", "desc": "DCS 감시 범위 밖의 설비"}, {"label": "설치", "value": "무배선", "desc": "케이블 트레이 공사 불필요"}, {"label": "유의 사항", "value": "방폭 등급", "desc": "구역별 인증 기기 적용"}], "customer": {"lead": "석유화학·정밀화학, 발전, 제철, 시멘트, 수처리 플랜트의 설비보전·검사 조직과 정비 전문 협력사가 대상입니다.", "paragraphs": ["대형 플랜트의 주기기는 분산제어시스템(DCS)과 상시 감시 장치로 관리되지만, 수량이 훨씬 많은 보조 펌프·팬·밸브·배관은 순회 점검에 의존합니다. 공정안전관리(PSM) 대상 사업장은 설비 점검·정비 기록을 유지해야 하며 정기 대정비(TA) 범위를 정하는 근거 자료가 필요합니다."]}, "challenge": {"lead": "플랜트에서 계측점 하나를 유선으로 추가하는 비용의 대부분은 계기가 아니라 케이블과 공사에서 발생합니다.", "pains": [{"title": "보조 설비의 감시 공백", "desc": "보조 펌프와 팬은 고장 나기 전까지 데이터가 없어 주기기 정지의 원인이 되고 나서야 주목받습니다."}, {"title": "계측 증설 비용", "desc": "방폭 구역의 전선관 공사, 케이블 트레이 여유, DCS 입력 카드 증설이 필요해 계측점 추가가 미뤄집니다."}, {"title": "열교환기 성능 저하", "desc": "파울링에 따른 전열 성능 저하는 입·출구 온도차 추세로 알 수 있으나 측정점이 부족합니다."}, {"title": "스팀 트랩·보온 배관", "desc": "트랩 고장과 보온재 하부 이상은 외관으로 확인하기 어렵습니다."}]}, "solution": {"lead": "배선 없이 부착하는 무선 센서로 보조 설비와 배관에 측정점을 추가하고, 수집 데이터를 Modbus TCP로 기존 시스템에 전달합니다.", "paragraphs": ["펌프·팬 베어링부에는 진동·온도 센서를, 열교환기와 스팀 트랩 전후 배관에는 표면 온도 센서를, 유틸리티 라인에는 압력 센서를 설치합니다. 고온 배관은 K타입 열전대 센서를 적용합니다. 넓은 옥외 플랜트는 철 구조물에 의한 전파 음영이 생기므로 게이트웨이 위치를 수신 감도 측정으로 정합니다.", "폭발위험장소에는 해당 구역 등급에 맞는 방폭 인증 기기만 설치할 수 있습니다. 방폭 사양 센서의 적용 가능 여부를 구역별로 확인하고, 불가한 구역은 비위험 구역에서 측정 가능한 지점으로 대체합니다. 본 시스템의 데이터는 정비 판단용 보조 자료이며 공정 제어나 안전 계장에 사용하지 않습니다."], "sensors": ["진동", "온도(배관 표면)", "고온(K타입 열전대)", "압력", "전류", "건접점", "방폭 온도 센서", "이더넷 게이트웨이(Modbus TCP)"]}, "proposal": {"lead": "대정비 주기에 맞춰 한 개 공정 단위의 보조 설비를 대상으로 시작합니다.", "phases": [{"tag": "PHASE 1", "title": "대상·구역 검토", "desc": "보조 설비 목록, 고장 이력, 방폭 구역 도면을 검토합니다.", "duration": "2주"}, {"tag": "PHASE 2", "title": "통신 시험", "desc": "게이트웨이 후보 위치에서 수신 감도를 측정합니다.", "duration": "2~3일"}, {"tag": "PHASE 3", "title": "설치·기준선 수립", "desc": "센서를 부착하고 정상 운전 데이터를 수집합니다.", "duration": "1~2개월"}, {"tag": "PHASE 4", "title": "정비 계획 반영", "desc": "추세 데이터를 대정비 범위 결정과 예비품 계획에 반영합니다.", "duration": "지속"}]}, "roi": {"lead": "회수는 '유선 계측 증설 대비 초기비 차이'와 '보조 설비 고장으로 인한 공정 정지 회피'로 산정합니다. 유선 한 점의 설치 견적과 비교하면 초기비 차이를 바로 확인할 수 있습니다.", "metrics": [{"num": "무배선", "desc": "전선관·케이블 공사 없이 측정점 추가"}, {"num": "ΔT", "desc": "열교환기 입·출구 온도차로 성능 저하 추세 확인"}, {"num": "방폭 구역 확인", "desc": "구역 등급에 맞는 인증 기기 적용"}], "before": "보조 설비는 순회 점검. 계측 증설은 예산·공사 문제로 보류. 대정비 범위는 경험으로 결정.", "after": "보조 설비 진동·온도 추세 확보. 이상 추세 알림. 데이터 기반 대정비 범위 조정."}},
  "uc-datacenter": {"snapshot": [{"label": "대상", "value": "소규모 전산 공간", "desc": "서버실·통신실(MDF·IDF)"}, {"label": "주요 위험", "value": "냉방기 정지", "desc": "단일 에어컨 의존"}, {"label": "구성", "value": "센서 4~6개", "desc": "온도·누수·전원·도어"}], "customer": {"lead": "중소·중견기업 전산 담당자, 학교·병원·공공기관의 통신실 관리자, 다수 지점의 랙을 관리하는 IT 운영 조직이 대상입니다.", "paragraphs": ["소규모 서버실은 일반 사무실을 개조해 벽걸이·스탠드 에어컨 한두 대로 냉방하는 경우가 많습니다. 전담 운영 인력이 없고 주말과 야간에는 건물 자체가 비어 있습니다."]}, "challenge": {"lead": "작은 서버실은 열용량이 작아 냉방이 멈추면 실내 온도가 수십 분 만에 위험 수준에 도달합니다.", "pains": [{"title": "주말 냉방기 정지", "desc": "에어컨 고장, 실외기 과열, 건물 전체 절전 설정으로 냉방이 멈추면 월요일 아침에 서버가 과열로 정지한 상태로 발견됩니다."}, {"title": "에어컨 응축수 누수", "desc": "배수 호스 막힘으로 응축수가 넘쳐 랙 하부와 멀티탭을 적시는 사고가 흔합니다."}, {"title": "정전과 UPS 방전", "desc": "정전 시 UPS가 버티는 시간 안에 조치하지 못하면 시스템이 비정상 종료됩니다."}, {"title": "전담 인력 부재", "desc": "총무나 IT 담당자 1명이 겸임해 상시 확인이 불가능합니다."}]}, "solution": {"lead": "랙 흡기 위치의 온도 센서, 에어컨 하부의 누수 센서, 전원 감시용 전압 감지 센서, 출입문 센서를 설치합니다.", "paragraphs": ["온도 알림은 주의와 위험 2단계로 설정해 초기 상승 단계에서 조치할 시간을 확보합니다. 전압 감지 센서는 상용 전원의 유무를 감시해 정전 발생을 즉시 알립니다.", "LTE 게이트웨이는 사내망과 분리되어 동작하고 내장 배터리가 있어, 정전으로 사내 네트워크 장비가 모두 꺼진 상황에서도 문자 알림을 보낼 수 있습니다. 기존 서버 관리 도구의 장비 내부 온도 감시와는 별개의 독립 경로라는 점이 장점입니다."], "sensors": ["온도", "습도", "누수 감지", "전압 감지", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "표준 키트 형태로 한 곳에 설치해 본 뒤 지점·분실로 복제합니다.", "phases": [{"tag": "PHASE 1", "title": "현장 확인", "desc": "냉방 방식, 에어컨 배수 경로, 전원 계통을 확인합니다.", "duration": "1시간"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치합니다.", "duration": "1~2시간"}, {"tag": "PHASE 3", "title": "알림 설정", "desc": "주의·위험 2단계 온도와 수신자를 설정하고 모의 시험을 합니다.", "duration": "1일"}, {"tag": "PHASE 4", "title": "지점 확대", "desc": "동일 구성을 다른 서버실·통신실에 적용합니다.", "duration": "개소당 1~2시간"}]}, "roi": {"lead": "회수는 '서버 과열 정지 1회의 업무 중단 손실과 장비 손상'을 기준으로 판단합니다. 업무 시스템이 반나절 멈출 때의 인건비 손실만 계산해도 비교할 수 있습니다.", "metrics": [{"num": "2단계", "desc": "주의·위험 온도 알림으로 조치 시간 확보"}, {"num": "2시간", "desc": "개소당 설치 소요(1~2시간)"}, {"num": "독립 경로", "desc": "사내망 정전 시에도 LTE로 알림"}], "before": "출근 후 서버실 확인. 주말 냉방 정지는 월요일 발견. 정전은 UPS 방전 후 인지.", "after": "온도 상승 초기 문자 알림. 누수·정전 즉시 통보. 지점 서버실 통합 조회."}},
  "uc-manufacturing": {"snapshot": [{"label": "대상", "value": "유틸리티·공정 조건", "desc": "압축공기·열처리·가동률"}, {"label": "고온 측정", "value": "K타입 열전대", "desc": "건조로·오븐·금형"}, {"label": "연계", "value": "Modbus TCP·MQTT", "desc": "MES·에너지 관리 시스템"}], "customer": {"lead": "금속 가공, 사출·압출, 도장, 열처리, 전자 부품 조립 등 중소·중견 제조업체의 생산기술·공무·품질 조직이 대상입니다.", "paragraphs": ["스마트공장 구축 과정에서 MES와 생산 설비의 데이터 연결이 추진되고 있으나, 통신 기능이 없는 노후 설비와 유틸리티 설비는 여전히 데이터가 없습니다. 에너지 다소비 사업장은 에너지이용 합리화법에 따른 진단·신고 대상이며 원단위 관리 요구가 커지고 있습니다."]}, "challenge": {"lead": "공정 조건과 유틸리티는 품질과 원가를 좌우하지만 설비 조작반의 표시값으로만 존재하는 경우가 많습니다.", "pains": [{"title": "압축공기 손실", "desc": "압축공기는 누설과 과압 공급으로 인한 손실이 크지만 말단 압력을 측정하지 않으면 드러나지 않습니다."}, {"title": "열처리 온도 편차", "desc": "건조로와 오븐은 제어용 열전대 위치와 제품 위치의 온도가 다르고, 히터 열화로 구역별 편차가 커집니다."}, {"title": "가동률 수기 집계", "desc": "통신 기능이 없는 설비의 가동 시간은 작업 일보에 의존해 정확하지 않습니다."}, {"title": "데이터 수집 개조 비용", "desc": "노후 설비의 제어기를 개조해 데이터를 뽑아내는 작업은 설비별 비용과 가동 중단이 필요합니다."}]}, "solution": {"lead": "설비 제어기를 건드리지 않고 외부에 센서를 부착하는 방식으로 압력·온도·전류 데이터를 확보합니다.", "paragraphs": ["압축공기는 압축기 토출과 말단 배관의 압력을 함께 측정해 배관 압력 강하와 비가동 시간대의 압력 유지 여부(누설 지표)를 확인합니다. 건조로·오븐은 K타입 열전대 센서로 구역별 실제 온도를 기록합니다. 설비 주전원에 클램프형 전류 센서를 설치하면 전류값으로 가동·대기·정지 상태를 구분해 가동 시간을 자동 집계할 수 있습니다.", "이더넷 게이트웨이의 Modbus TCP 또는 iMonnit Cloud의 Open API(Webhook)·MQTT로 MES와 에너지 관리 시스템에 데이터를 전달합니다. 무선 전류 센서는 전류의 크기를 측정하며 전력량의 정산용 계량을 대신하지 않습니다."], "sensors": ["압력", "고온(K타입 열전대)", "전류", "온도", "습도", "건접점", "이더넷 게이트웨이(Modbus TCP)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "압축공기 계통 또는 한 개 열처리 라인처럼 범위가 명확한 대상에서 시작합니다.", "phases": [{"tag": "PHASE 1", "title": "대상 정의", "desc": "측정 목적(손실 파악, 조건 관리, 가동률 집계)과 측정 지점을 정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서를 부착합니다. 분전반 작업은 전기 담당자가 입회합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "현황 분석", "desc": "2~4주 데이터로 비가동 시간대 압력 강하, 구역별 온도 편차, 설비별 가동 시간을 분석합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "개선·시스템 연계", "desc": "누설 보수, 설정 압력 조정 등 개선 후 재측정하고 MES에 연계합니다.", "duration": "1~2개월"}]}, "roi": {"lead": "압축공기는 '설정 압력 인하분과 누설 보수 전후의 압축기 전류 차이 × 운전 시간 × 전력 단가'로 절감액을 직접 산출합니다. 가동률 데이터는 설비 투자 판단의 근거로 활용됩니다.", "metrics": [{"num": "압력", "desc": "비가동 시간대 압력 강하로 압축공기 누설 수준 확인"}, {"num": "전류", "desc": "설비 가동 시간 자동 집계"}, {"num": "구역별 실측", "desc": "건조로·오븐 온도 편차 확인"}], "before": "조작반 표시값 확인. 가동 시간은 작업 일보. 유틸리티 손실은 전기요금으로 사후 확인.", "after": "압력·온도·전류 연속 기록. 조건 이탈 알림. 개선 전후 실측 비교와 MES 연계."}},
  "uc-solar": {"snapshot": [{"label": "대상", "value": "지붕형·자가용", "desc": "공장·창고·공공건물 옥상"}, {"label": "관리 주체", "value": "건물 시설팀", "desc": "전기안전관리자 점검 보조"}, {"label": "감시 항목", "value": "온도·접점·누수", "desc": "접속반·인버터·옥상 방수"}], "customer": {"lead": "지붕형 태양광을 설치한 공장·물류센터·공공건물의 시설관리팀, 지붕 임대형 발전사업자, 건물 FM사가 대상입니다.", "paragraphs": ["RE100 대응과 전기요금 절감을 위해 공장과 물류센터 지붕의 자가용 태양광이 늘고 있습니다. 지붕형 설비는 건물 화재·누수와 직접 연결되므로 발전 사업 관점뿐 아니라 건물 안전 관점의 관리가 필요합니다."]}, "challenge": {"lead": "지붕 위 설비는 평소에 올라가 볼 일이 없어 이상이 생겨도 가장 늦게 발견됩니다.", "pains": [{"title": "접속반·커넥터 발열", "desc": "직류 접속부의 접촉 불량은 발열과 아크로 이어지며, 샌드위치 패널 지붕에서는 화재 확산 위험이 큽니다."}, {"title": "지붕 누수", "desc": "구조물 고정부 주변의 방수 손상으로 빗물이 실내로 유입되는 사례가 있습니다."}, {"title": "여름철 출력 저하", "desc": "지붕 밀착형 설치는 모듈 후면 통풍이 나빠 모듈 온도가 높고 출력 저하 폭이 큽니다."}, {"title": "관리 책임의 분산", "desc": "발전 설비 업체와 건물 관리자의 역할이 나뉘어 이상 신호가 건물 측에 전달되지 않습니다."}]}, "solution": {"lead": "접속반과 인버터 주변에 온도 센서를, 지붕 하부 취약 지점에 누수 센서를 설치하고 인버터 고장 접점을 건물 관리자에게도 전달합니다.", "paragraphs": ["접속반 내부 온도는 외기 온도와 비교해 평소보다 높아지는 추세를 감시합니다. 모듈 후면 온도를 기록하면 계절별 출력 저하가 온도 영향인지 판단할 수 있습니다. 인버터의 고장 접점은 건접점 센서로 받아 발전 업체와 건물 시설팀에 동시에 문자로 통보합니다.", "온도 센서는 표면 한 점의 온도를 측정하므로 열화상 점검처럼 전체 접속부를 살피는 방식을 대체하지 않습니다. 정기 열화상 점검 사이의 상시 감시로 사용하며, 화재 감지는 소방 설비가 담당합니다."], "sensors": ["온도", "건접점", "누수 감지", "누수 감지 로프", "전류(AC)", "개폐 감지", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "발전 설비 업체와 역할을 정리한 뒤 건물 측 감시 항목부터 설치합니다.", "phases": [{"tag": "PHASE 1", "title": "설비·책임 범위 확인", "desc": "접속반·인버터 위치, 지붕 구조, 업체와 건물 측의 대응 범위를 확인합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "온도·접점·누수 센서를 설치합니다. 지붕 작업은 추락 방지 조치 후 진행합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "기준 설정", "desc": "외기 대비 온도 차 기준과 알림 수신자를 설정합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "사업장 확대", "desc": "다른 지붕형 설비에 동일 구성으로 적용합니다.", "duration": "개소당 1일"}]}, "roi": {"lead": "도입 근거는 발전 수익보다 '건물 화재·누수 위험 관리'에 있습니다. 지붕 아래 보관 자산의 가액과 영업 중단 손실을 기준으로 판단합니다.", "metrics": [{"num": "ΔT", "desc": "외기 대비 접속반 온도 차로 과열 추세 판단"}, {"num": "1일", "desc": "개소당 설치 소요"}, {"num": "동시 통보", "desc": "발전 업체와 건물 시설팀"}], "before": "발전 업체의 발전량 모니터링에만 의존. 건물 측은 설비 상태 미인지. 누수는 실내 피해 후 발견.", "after": "접속반 온도·고장 접점·누수 감시. 건물 시설팀 문자 수신. 점검 주기 사이의 이상 추세 확인."}},
  "facility": {"snapshot": [{"label": "감시 대상", "value": "화재 신호·정전·침수·온도", "desc": "기존 설비의 신호를 2차 통보"}, {"label": "화재 신호", "value": "DC 24V 감지", "desc": "수신기 주경종 작동 전압"}, {"label": "정전 대응", "value": "2~3일", "desc": "게이트웨이 내장 배터리"}], "customer": {"lead": "야간과 휴일에 상주 인력이 없거나 경비 인력만 있는 공장, 물류센터, 중소형 빌딩, 공공시설의 안전·시설 담당자가 대상입니다.", "paragraphs": ["소방시설은 화재를 감지해 건물 안에 경보를 울리지만, 건물에 사람이 없으면 그 경보를 들을 사람이 없습니다. 중대재해처벌법과 화재예방법 체계에서 사업주의 안전 확보 의무가 강화되면서, 무인 시간대의 이상을 책임자가 직접 통보받는 체계에 대한 수요가 늘었습니다."]}, "challenge": {"lead": "설비는 정상적으로 경보를 냈지만 아무도 받지 못한 경우가 무인 사업장 사고의 전형입니다.", "pains": [{"title": "수신기 경보의 전달 한계", "desc": "화재 수신기의 경종은 현장에서만 울립니다. 경비실이 비어 있거나 수신기가 잠긴 방재실에 있으면 인지가 늦어집니다."}, {"title": "정전의 2차 피해", "desc": "야간 정전은 냉동·냉장 설비, 배수 펌프, 공정 설비를 멈추게 하고 복전 시점까지 피해가 누적됩니다."}, {"title": "집수정 범람", "desc": "배수 펌프 고장이나 집중호우로 집수정 수위가 오르면 지하 전기실과 기계실이 침수됩니다."}, {"title": "순찰 공백", "desc": "경비 인력의 순찰 주기 사이에 발생한 이상은 다음 순찰까지 방치됩니다."}]}, "solution": {"lead": "기존 설비가 내는 신호를 무선 센서로 받아 책임자의 휴대전화로 전달하는 2차 통보 계통을 구성합니다.", "paragraphs": ["화재 신호는 소방 수신기의 주경종 출력(DC 24V)을 전압 감지 센서로 받아, 경종이 작동하면 문자가 발송되도록 합니다. 정전은 상용 전원에 연결한 전압 감지 센서로, 집수정 수위는 플로트(오뚜기볼)형 센서로, 전기실·기계실 온도는 온도 센서로 감시합니다.", "IoT 게이트웨이는 LTE 유심과 내장 배터리를 갖추고 있어 건물이 정전되어도 2~3일간 알림을 보냅니다. 이 구성은 소방시설법상의 소방시설이나 자동화재속보설비를 대체하지 않으며, 수신기 결선은 소방시설 관리 업체와 협의해 진행합니다. 수신기가 정지(축적·차단) 상태이면 신호도 발생하지 않으므로 수신기의 정상 운영이 전제 조건입니다."], "sensors": ["전압 감지(DC 24V)", "전압 감지(AC)", "누수 감지 플로트", "온도", "건접점", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "신호 한 가지(화재 또는 정전)로 시작해 통보 체계가 정착되면 항목을 늘립니다.", "phases": [{"tag": "PHASE 1", "title": "현장 조사", "desc": "수신기 기종과 출력 단자, 전기실·집수정 위치, 통보 대상자를 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치합니다. 수신기 결선은 소방 관리 업체가 입회합니다.", "duration": "반나절~1일"}, {"tag": "PHASE 3", "title": "통보 시험", "desc": "모의 신호로 문자 수신과 대응 절차를 시험합니다.", "duration": "1일"}, {"tag": "PHASE 4", "title": "항목 확대", "desc": "누수, 온도, 설비 고장 접점 등으로 감시 항목을 넓힙니다.", "duration": "1~2주"}]}, "roi": {"lead": "본 분야의 효과는 '사고 인지 시간 단축'입니다. 화재와 침수는 초기 수십 분의 대응 여부에 따라 피해 규모가 달라지므로, 사업장 자산 가액과 영업 중단 손실을 기준으로 도입 여부를 판단합니다.", "metrics": [{"num": "24V", "desc": "수신기 주경종 작동 전압(DC) 감지 방식"}, {"num": "2~3일", "desc": "정전 중 알림 유지 시간"}, {"num": "250개", "desc": "게이트웨이 1대 반경 내 센서 수용"}], "before": "현장 경종과 경비 순찰에 의존. 야간 정전·침수는 출근 후 발견. 책임자는 사후 보고로 인지.", "after": "화재 신호·정전·침수 발생 시 책임자 문자 수신. 발생 시각 이력 확보. 무인 시간대 초기 대응 가능."}},
  "hospitality": {"snapshot": [{"label": "주요 위험", "value": "욕실·배관 누수", "desc": "아래층 객실 연쇄 피해"}, {"label": "객실 환경", "value": "온습도", "desc": "곰팡이·결로 민원 예방"}, {"label": "설치", "value": "영업 중 설치", "desc": "객실 정비 시간 내 부착"}], "customer": {"lead": "호텔, 비즈니스 호텔 체인, 레지던스, 생활형 숙박시설을 운영하는 시설팀과 운영 위탁사가 대상입니다.", "paragraphs": ["숙박시설은 객실마다 욕실이 있어 급수·배수 지점이 건물 전체에 분산되어 있습니다. 누수가 발생하면 해당 객실뿐 아니라 아래층 객실까지 판매를 중단해야 하며, 성수기에는 대체 객실 확보와 고객 보상이 뒤따릅니다."]}, "challenge": {"lead": "객실 시설 문제는 고객이 먼저 발견하는 순간 시설 사고가 아니라 서비스 사고가 됩니다.", "pains": [{"title": "욕실 누수의 확산", "desc": "욕조·세면대 하부와 변기 급수 연결부의 누수는 바닥 슬래브를 통해 아래층 천장으로 번집니다."}, {"title": "장기 공실 객실", "desc": "비수기에 닫아 둔 객실은 환기가 되지 않아 습도가 오르고 곰팡이 냄새가 생깁니다."}, {"title": "배관 샤프트 접근성", "desc": "층별 배관 샤프트는 점검구를 열어야 볼 수 있어 정기 점검 외에는 확인되지 않습니다."}, {"title": "객실 내 설비 추가의 제약", "desc": "영업 중인 객실에 배선 공사를 하려면 객실 판매를 막아야 합니다."}]}, "solution": {"lead": "욕실 하부와 배관 샤프트에 무선 누수 센서를, 객실에 온습도 센서를 부착해 객실 정비 시간 안에 설치를 마칩니다.", "paragraphs": ["누수 센서는 세면대 하부장, 욕조 점검구, 샤프트 바닥에 두며 로프형은 배관을 따라 설치합니다. 온습도 센서는 장기 공실 객실의 습도 상승을 감지해 환기·제습 시점을 알립니다. 센서는 소형이고 배선이 없어 고객 눈에 띄지 않는 위치에 둘 수 있습니다.", "객실 내 재실 여부를 감지하는 용도는 투숙객 사생활과 관련되므로 본 구성에 포함하지 않으며, 필요 시 고지와 동의 절차를 갖춘 뒤 별도로 검토합니다. 알림은 시설 당직자에게 문자로 전달되고 층·호실 단위로 위치가 표시됩니다."], "sensors": ["누수 감지", "누수 감지 로프", "온도", "습도", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "누수 이력이 있는 라인(수직 배관 계통)부터 설치하고 층 단위로 확대합니다.", "phases": [{"tag": "PHASE 1", "title": "누수 이력 분석", "desc": "최근 수년간 누수 발생 객실과 배관 계통을 정리합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "우선 라인 설치", "desc": "이력이 많은 수직 라인의 객실과 샤프트에 설치합니다.", "duration": "객실당 10~20분"}, {"tag": "PHASE 3", "title": "운영 반영", "desc": "당직 근무 지침에 알림 대응과 객실 판매 차단 절차를 반영합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "전 객실 확대", "desc": "객실 리노베이션 일정에 맞춰 확대합니다.", "duration": "단계적"}]}, "roi": {"lead": "회수는 '누수 1건의 손실 = 복구비 + (판매 중단 객실 수 × 객실 단가 × 중단 일수) + 고객 보상'을 기준으로 산정합니다. 자사 평균 객실 단가와 복구 기간을 넣어 계산하시기 바랍니다.", "metrics": [{"num": "20분", "desc": "객실당 부착 설치 소요(10~20분)"}, {"num": "호실", "desc": "층·호실 단위 누수 위치 표시"}, {"num": "판매 중단 일수", "desc": "손실 산정의 핵심 변수"}], "before": "고객 신고와 하우스키핑 발견에 의존. 아래층 피해 후 인지. 공실 객실 곰팡이는 판매 직전 발견.", "after": "누수 발생 즉시 당직자 문자 수신. 공실 객실 습도 추세 확인. 피해 범위와 판매 중단 기간 축소."}},
  "financial": {"snapshot": [{"label": "적용 구역", "value": "부대설비·지점", "desc": "전산실 내부는 사전 보안 검토"}, {"label": "구축 방식", "value": "서버구축형 가능", "desc": "iMonnit Enterprise, 내부망"}, {"label": "규정 배경", "value": "전자금융감독규정", "desc": "재해·위해 방지 대책"}], "customer": {"lead": "은행·증권·보험·카드사의 전산센터 시설 운영 조직, 총무·시설 부서, 금융 IT 자회사가 대상입니다.", "paragraphs": ["전자금융감독규정은 전산실에 대해 화재·수해 등 재해와 외부 위해에 대한 방지 대책을 수립·운용하도록 하고 있으며, 2025년 개정으로 세부 항목 나열에서 원칙 중심으로 바뀌어 금융회사가 자체 기준으로 통제 수준을 정해야 합니다. 동 규정은 전산실 내 무선통신망 설치를 제한하고 있습니다."]}, "challenge": {"lead": "금융 전산 시설은 장애 허용 범위가 매우 좁고, 새로 들이는 모든 장비가 보안성 검토 대상입니다.", "pains": [{"title": "부대설비실의 감시 밀도", "desc": "UPS실, 배터리실, 항온항습기 실외기 구역, 발전기실은 전산실에 비해 감시 포인트가 적습니다."}, {"title": "누수 경로", "desc": "냉수 배관과 상부층 화장실·급탕실에서 발생한 누수가 전산 시설로 유입되는 경로를 사전에 감시해야 합니다."}, {"title": "보안 규정 제약", "desc": "무선 기기와 외부 클라우드 사용이 제한되어 일반적인 IoT 서비스는 그대로 도입할 수 없습니다."}, {"title": "지점 시설 관리", "desc": "전국 지점의 통신실과 금고 주변 환경은 본점에서 파악하기 어렵습니다."}]}, "solution": {"lead": "보안 구역 구분에 따라 적용 범위를 나누고, 데이터는 내부망의 서버구축형 플랫폼에서 관리하도록 구성합니다.", "paragraphs": ["전산실 내부의 무선 센서 사용은 전산실 무선통신망 제한 규정의 적용 여부를 금융회사 정보보호 부서가 판단해야 하므로, 사전 보안성 검토를 거친 범위에만 적용합니다. 검토 전에는 전산실 밖의 UPS실·배터리실·기계실·발전기실과 상부층 누수 경로를 우선 대상으로 합니다.", "iMonnit Enterprise는 금융회사 내부 서버(Windows Server, MS SQL)에 설치하며 데이터가 외부로 나가지 않습니다. 이더넷 게이트웨이의 Modbus TCP로 기존 시설 감시 시스템(FMS)에 값을 전달할 수 있습니다. 센서는 온도·누수·접점 등 환경 값만 전송하며 금융 정보를 다루지 않습니다."], "sensors": ["온도", "습도", "누수 감지 로프", "누수 감지", "건접점", "전압 감지", "이더넷 게이트웨이(Modbus TCP)", "iMonnit Enterprise(서버구축형)"]}, "proposal": {"lead": "보안성 검토를 선행하고, 승인된 구역부터 단계적으로 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "보안성 검토", "desc": "적용 구역, 통신 방식, 데이터 흐름을 문서화해 정보보호 부서 검토를 받습니다.", "duration": "2~4주"}, {"tag": "PHASE 2", "title": "부대설비실 구축", "desc": "UPS실·배터리실·기계실과 누수 경로에 센서를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "FMS 연동", "desc": "Modbus TCP로 기존 감시 시스템에 포인트를 등록합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "지점 확대", "desc": "지점 통신실과 금고 주변으로 표준 구성을 확대합니다.", "duration": "지점당 반나절"}]}, "roi": {"lead": "금융 시설의 도입 근거는 절감액이 아니라 '장애 예방과 감독 규정상 통제 수준의 입증'입니다. 전산 장애 1시간의 영향과 감독 당국 보고 부담을 기준으로 판단합니다.", "metrics": [{"num": "내부망", "desc": "서버구축형으로 데이터 외부 미반출"}, {"num": "환경값", "desc": "센서는 온도·누수·접점만 전송"}, {"num": "사전 보안 검토", "desc": "전산실 내부 적용은 검토 후"}], "before": "전산실 중심 감시. 부대설비실은 순회 점검. 지점 시설은 사고 후 보고.", "after": "부대설비실·누수 경로 상시 감시. 내부망에서 이력 관리. 지점 시설 통합 조회."}},
  "vacant": {"snapshot": [{"label": "주요 위험", "value": "동파·누수·침입", "desc": "관리 인력 부재 기간"}, {"label": "통신", "value": "LTE", "desc": "공실의 인터넷 해지 상태 대응"}, {"label": "전제 조건", "value": "전원 확보", "desc": "게이트웨이용 상시 전원"}], "customer": {"lead": "공실을 보유한 건물주, 자산관리회사(PM·AM), 분양 후 미입주 상가를 관리하는 시행·신탁사, 임대 관리 대행사가 대상입니다.", "paragraphs": ["상가와 지식산업센터의 공실 기간이 길어지면서 비어 있는 호실의 관리가 건물 운영의 부담이 되고 있습니다. 공실은 난방이 꺼져 있고 사람이 드나들지 않아, 겨울철 배관 동파와 누수가 발생해도 아래층 임차인의 신고로 뒤늦게 알려집니다."]}, "challenge": {"lead": "공실의 사고는 발견할 사람이 없다는 한 가지 이유로 피해가 커집니다.", "pains": [{"title": "겨울철 동파", "desc": "물은 얼면서 부피가 약 9% 늘어 배관과 계량기를 파손하고, 해빙 시점에 대량 누수가 시작됩니다."}, {"title": "누수의 인접 호실 피해", "desc": "공실에서 시작된 누수가 영업 중인 아래층 점포에 피해를 주면 손해배상 책임이 발생합니다."}, {"title": "무단 출입과 훼손", "desc": "장기 공실은 무단 점유, 폐기물 투기, 설비 도난의 대상이 됩니다."}, {"title": "순회 비용", "desc": "관리 직원이 호실마다 주기적으로 방문해 확인하는 방식은 호실 수에 비례해 비용이 듭니다."}]}, "solution": {"lead": "배터리로 동작하는 무선 센서를 공실에 부착하고 LTE 게이트웨이로 수집해, 인터넷이 해지된 호실에서도 감시가 가능하도록 합니다.", "paragraphs": ["실내 온도가 동결 위험 수준(예: 3~5℃)으로 내려가면 먼저 알림을 보내 난방 가동이나 배관 퇴수 조치를 할 시간을 줍니다. 급수 배관과 화장실, 천장 배관 하부에는 누수 센서를, 출입문에는 개폐 센서를, 실내에는 움직임 감지 센서를 둡니다.", "센서는 배터리로 동작하지만 게이트웨이는 상시 전원이 필요합니다. 내장 배터리는 정전 시 2~3일을 버티는 용도이므로, 전기가 끊긴 호실은 공용부 전원이나 인접 호실에 게이트웨이를 두는 방식으로 설계합니다. 한 대의 게이트웨이로 같은 층 여러 호실의 센서를 수용할 수 있습니다."], "sensors": ["온도", "누수 감지", "누수 감지 로프", "개폐 감지", "움직임 감지", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "동절기 전에 설치를 마치는 일정으로 진행하며, 임차인이 들어오면 회수해 다른 공실로 옮깁니다.", "phases": [{"tag": "PHASE 1", "title": "공실 현황 정리", "desc": "공실 호실, 급수·난방 상태, 전원 가용 여부를 확인합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "설치", "desc": "호실당 센서 3~5개를 부착하고 층별 게이트웨이를 배치합니다.", "duration": "호실당 30분 내외"}, {"tag": "PHASE 3", "title": "대응 체계 수립", "desc": "알림 수신자와 출동 주체(관리사무소·협력업체)를 정합니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "회수·재배치", "desc": "임대 완료 호실의 장비를 회수해 다른 공실에 재사용합니다.", "duration": "수시"}]}, "roi": {"lead": "회수는 '동파·누수 1건의 복구비와 인접 호실 배상액'과 '정기 순회 인건비'를 기준으로 산정합니다. 장비를 재배치해 쓰므로 공실 1호실당 실질 비용은 사용 기간에 따라 낮아집니다.", "metrics": [{"num": "9%", "desc": "물이 얼 때의 부피 팽창률(약), 동파 원인"}, {"num": "3~5개", "desc": "호실당 센서 수"}, {"num": "회수 재배치", "desc": "임대 후 장비 재사용"}], "before": "주기적 방문 확인. 동파·누수는 아래층 신고로 인지. 무단 출입 확인 불가.", "after": "저온·누수·출입 문자 알림. 동결 전 조치 가능. 방문은 알림 발생 시에만."}},
  "smartcity": {"snapshot": [{"label": "침수 통제", "value": "침수심 5cm", "desc": "지하차도 통제 기준(강화)"}, {"label": "통신 구조", "value": "자체 무선 + LTE", "desc": "자가망 구축 불필요"}, {"label": "데이터 연계", "value": "Open API·MQTT", "desc": "도시 통합 플랫폼 전달"}], "customer": {"lead": "지방자치단체의 재난안전·도로·시설관리 부서, 시설관리공단, 스마트도시 통합운영센터, 공공시설 위탁 관리 기관이 대상입니다.", "paragraphs": ["2023년 오송 지하차도 참사 이후 지하차도 진입차단시설 설치 대상이 확대되고 통제 기준 침수심이 15cm에서 5cm로 강화되었습니다. 지자체는 지하차도 외에도 경로당·주민센터·공중화장실·배수펌프장 등 다수의 소규모 공공시설을 적은 인력으로 관리합니다."]}, "challenge": {"lead": "지자체 시설은 수가 많고 넓게 흩어져 있어, 한 곳 한 곳에 통신 회선과 제어반을 설치하는 방식으로는 감시 범위를 넓히기 어렵습니다.", "pains": [{"title": "침수 초기 인지", "desc": "집중호우 시 지하차도와 저지대 도로는 수 분 단위로 수위가 오르며 담당자가 현장에 도착하기 전에 통제 시점을 놓칩니다."}, {"title": "소규모 시설의 감시 공백", "desc": "경로당과 공중화장실 같은 소규모 시설은 원격 감시 대상에서 빠져 있어 누수·동파·정전이 민원으로 접수됩니다."}, {"title": "통신 인프라 비용", "desc": "센서마다 통신 회선을 두거나 지자체 자가망을 새로 구축하려면 초기 비용이 큽니다."}, {"title": "시스템 간 단절", "desc": "부서별로 도입한 감시 시스템이 서로 연결되지 않아 통합운영센터에서 한 화면으로 보기 어렵습니다."}]}, "solution": {"lead": "현장 센서는 940MHz 무선으로 가까운 LTE 게이트웨이에 연결하고, 수집된 데이터를 Open API·MQTT로 지자체 플랫폼에 전달합니다.", "paragraphs": ["침수 감지는 플로트형 센서를 통제 기준 수위 높이에 설치해 도달 즉시 신호를 보내는 방식으로 구성합니다. 공공시설에는 누수, 전압 감지(정전), 온도 센서를, 무더위·한파 쉼터에는 온도 센서를 설치합니다. 게이트웨이 1대가 반경 내 센서 250개를 수용하므로 인접 시설을 묶어 구성할 수 있습니다.", "본 시스템은 독자 규격의 940MHz 통신을 사용하며 LoRaWAN 등 지자체 자가망 규격과는 별개로 동작합니다. 법정 진입차단시설이나 수위 관측 설비를 대체하지 않으며, 그 사이의 보조 감시점을 저비용으로 늘리는 용도입니다. 옥외 설치 시 방수 등급과 낙뢰·침수에 대비한 게이트웨이 설치 높이를 설계에 반영합니다."], "sensors": ["누수 감지 플로트", "누수 감지", "전압 감지", "온도", "습도", "비상벨(버튼)", "IoT 게이트웨이(LTE)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "우기 전에 침수 취약 지점 몇 곳에서 시범 운영하고 플랫폼 연계를 검증한 뒤 대상 시설을 넓힙니다.", "phases": [{"tag": "PHASE 1", "title": "대상 선정", "desc": "침수 이력 지점과 관리 사각 시설을 선정합니다.", "duration": "2주"}, {"tag": "PHASE 2", "title": "시범 설치", "desc": "대상 지점에 센서와 게이트웨이를 설치하고 수신 상태를 확인합니다.", "duration": "지점당 반나절"}, {"tag": "PHASE 3", "title": "플랫폼 연계", "desc": "Open API·MQTT로 통합 플랫폼에 데이터를 전달하고 알림 흐름을 시험합니다.", "duration": "1~2개월"}, {"tag": "PHASE 4", "title": "확대", "desc": "우기 운영 결과를 반영해 대상 시설을 확대합니다.", "duration": "연차별"}]}, "roi": {"lead": "공공 부문의 효과는 '인지 시간 단축'과 '순회 점검 인력의 재배치'로 평가합니다. 지점당 구축비를 기존 유선·전용 회선 방식의 견적과 비교하면 같은 예산으로 감시할 수 있는 지점 수의 차이가 드러납니다.", "metrics": [{"num": "5cm", "desc": "지하차도 통제 기준 침수심"}, {"num": "250개", "desc": "게이트웨이 1대 반경 내 센서 수용"}, {"num": "회선 공사 없음", "desc": "LTE 유심 내장 게이트웨이"}], "before": "기상 특보 시 인력 현장 배치. 소규모 시설은 민원으로 인지. 부서별 시스템 분리.", "after": "침수 기준 수위 도달 즉시 통보. 공공시설 누수·정전 문자 알림. 통합 플랫폼에 데이터 연계."}},
  "uc-commercial-building": {"snapshot": [{"label": "법적 배경", "value": "기계설비법", "desc": "반기 유지점검·연 1회 성능점검"}, {"label": "연동", "value": "Modbus RTU·TCP", "desc": "BAS·DDC·BECON 등"}, {"label": "수용", "value": "최대 50개", "desc": "시리얼 게이트웨이 1대당 누수 센서"}], "customer": {"lead": "프라임·중대형 오피스의 자산관리(PM)·시설관리(FM)사, 사옥 관리 부서, 빌딩 자동제어 유지보수 업체가 대상입니다.", "paragraphs": ["연면적 1만㎡ 이상 건축물은 기계설비법에 따라 유지관리자를 선임하고 점검 기록을 10년간 보존해야 합니다. 준공 후 20년이 넘은 빌딩이 늘면서 자동제어 포인트의 노후화, 배관 누수, 임차인 환경 민원이 FM 업무의 중심이 되었습니다."]}, "challenge": {"lead": "빌딩 자동제어는 준공 시점의 설계 포인트에 머물러 있고, 운영 중에 생긴 감시 수요는 순회 점검으로 메우고 있습니다.", "pains": [{"title": "감시 포인트 증설의 어려움", "desc": "입주 상태에서 천장을 열어 배선하고 DDC 입력을 증설하는 공사는 야간 작업과 임차인 협의가 필요합니다."}, {"title": "누수 민원", "desc": "화장실·탕비실·팬코일 드레인의 누수가 임차인 전용 공간에 피해를 주면 배상과 임대 관계 문제가 생깁니다."}, {"title": "환경 민원의 객관성", "desc": "'덥다, 춥다'는 민원은 해당 위치의 실측 기록이 없으면 설비 문제인지 판단하기 어렵습니다."}, {"title": "점검 기록 부담", "desc": "법정 점검 기록을 수기와 사진으로 작성하는 데 많은 시간이 듭니다."}]}, "solution": {"lead": "무선 센서로 감시점을 추가하고 시리얼 Modbus 게이트웨이로 기존 BAS에 연결해 하나의 감시 화면에서 운영합니다.", "paragraphs": ["층별 PS·화장실·팬코일 유닛 하부에는 누수 센서를, 민원이 잦은 임차 공간에는 온습도 센서를, 기계실 펌프와 팬에는 전류 센서를 설치합니다. 시리얼 Modbus 게이트웨이는 RS-485로 DDC에 연결하며 주소표(Map Address)를 제공해 자동제어 업체가 포인트를 등록합니다.", "자동제어 연동 없이 단독 운영할 경우에는 LTE 게이트웨이와 전용 플랫폼으로 문자 알림을 받습니다. 센서와 게이트웨이의 내구연한은 15년으로 설계되어 있고, 임차인 변경으로 레이아웃이 바뀌면 센서를 옮겨 붙일 수 있습니다."], "sensors": ["누수 감지", "누수 감지 로프", "온도", "습도", "전류", "건접점", "시리얼 Modbus 게이트웨이", "이더넷 게이트웨이(Modbus TCP)"]}, "proposal": {"lead": "누수 이력 구역을 먼저 설치하고 BAS 연동 여부를 결정한 뒤 감시 항목을 넓힙니다.", "phases": [{"tag": "PHASE 1", "title": "대상·연동 방식 결정", "desc": "누수 이력과 민원 구역을 정리하고 BAS 연동 또는 단독 운영을 결정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "공용부와 PS부터 설치합니다. 임차 공간은 임차인 협의 후 진행합니다.", "duration": "2~5일"}, {"tag": "PHASE 3", "title": "BAS 포인트 등록", "desc": "주소표에 따라 감시 화면에 포인트를 등록하고 알람 등급을 정합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "운영 정착", "desc": "추세 데이터를 점검 기록의 보조 자료와 민원 대응 근거로 활용합니다.", "duration": "지속"}]}, "roi": {"lead": "회수는 '유선 증설 견적 대비 초기비 차이', '누수 1건의 배상·복구비', '순회 점검 공수'로 산정합니다. 유선 포인트 증설 견적을 함께 받아 비교하는 것이 가장 명확합니다.", "metrics": [{"num": "10년", "desc": "기계설비 성능점검 기록 보존 기간"}, {"num": "50개", "desc": "시리얼 Modbus 게이트웨이 1대당 누수 센서(최대)"}, {"num": "15년", "desc": "센서·게이트웨이 내구연한"}], "before": "준공 당시 포인트만 감시. 누수는 임차인 신고로 인지. 환경 민원은 현장 방문 측정.", "after": "운영 중 필요한 지점에 감시점 추가. 기존 BAS 화면에서 통합 감시. 실측 기록으로 민원 대응."}},
  "uc-retail": {"snapshot": [{"label": "대상", "value": "무인·다점포 매장", "desc": "아이스크림·밀키트·카페 등"}, {"label": "핵심 위험", "value": "정전·냉동고 정지", "desc": "무인 시간대 상품 손실"}, {"label": "설치", "value": "점포당 1시간 내외", "desc": "전원만 연결"}], "customer": {"lead": "무인 아이스크림·밀키트·반찬 매장 가맹본부와 점주, 드러그스토어·화장품·의류 다점포 운영사의 점포 시설 관리 조직이 대상입니다.", "paragraphs": ["인건비 부담으로 무인·하이브리드 매장이 빠르게 늘었습니다. 무인 매장은 냉동 쇼케이스 여러 대가 매장 자산의 대부분을 차지하고, 점주가 하루 한두 번 방문해 진열과 청소를 하는 방식으로 운영됩니다."]}, "challenge": {"lead": "무인 매장은 CCTV로 사람은 볼 수 있어도 냉동고 안의 온도는 볼 수 없습니다.", "pains": [{"title": "차단기 트립", "desc": "여름철 냉동고 여러 대가 동시에 기동하면 과부하로 차단기가 내려가고 점주가 방문할 때까지 방치됩니다."}, {"title": "상가 건물 정전", "desc": "건물 전기 점검이나 사고로 인한 정전은 점주에게 사전 통지되지 않는 경우가 있습니다."}, {"title": "상부층 누수", "desc": "상가 건물의 위층 배관 누수가 매장 천장으로 떨어져 상품과 집기를 손상시킵니다."}, {"title": "다점포 관리", "desc": "점주 한 명이 여러 매장을 운영하면 매장별 상태를 일일이 방문해 확인해야 합니다."}]}, "solution": {"lead": "냉동·냉장 쇼케이스에 온도 센서를, 분전반에 전압 감지 센서를, 천장 누수 우려 지점에 누수 센서를 설치합니다.", "paragraphs": ["전압 감지 센서는 정전과 차단기 트립을 발생 즉시 알리므로, 고내 온도가 오르기 전에 점주가 조치할 수 있습니다. 고내 온도 센서는 실제 상품 온도 영향을 확인하는 2차 확인 수단이 됩니다.", "게이트웨이는 LTE 유심과 내장 배터리를 갖추고 있어 매장 인터넷과 전원이 모두 끊긴 상황에서도 문자를 보냅니다. 여러 매장을 하나의 계정에서 조회할 수 있어 다점포 점주와 가맹본부가 같은 화면을 볼 수 있습니다."], "sensors": ["온도", "저온", "전압 감지", "누수 감지", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "가맹본부가 표준 키트를 정해 신규 출점 매장에 기본 포함하는 방식이 효율적입니다.", "phases": [{"tag": "PHASE 1", "title": "표준 키트 구성", "desc": "매장 유형별 쇼케이스 수에 맞춰 센서 구성을 정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "시범 매장 설치", "desc": "매장 몇 곳에 설치해 한 달간 운영합니다.", "duration": "매장당 1시간 내외"}, {"tag": "PHASE 3", "title": "알림 운영 확정", "desc": "점주·본부 수신 범위와 야간 대응 방법을 정합니다.", "duration": "1개월"}, {"tag": "PHASE 4", "title": "가맹점 보급", "desc": "신규 출점과 기존 매장에 순차 보급합니다.", "duration": "매장당 1시간 내외"}]}, "roi": {"lead": "회수는 '매장 냉동 상품 재고액'을 기준으로 판단합니다. 정전 1회로 재고 전량을 폐기하는 사고의 손실과 연간 운영비를 비교하면 됩니다.", "metrics": [{"num": "1시간", "desc": "매장당 설치 소요(내외)"}, {"num": "LTE", "desc": "매장 인터넷과 독립된 통신, 내장 배터리로 정전 중 알림"}, {"num": "다점포 통합", "desc": "여러 매장을 한 계정에서 조회"}], "before": "CCTV와 하루 1~2회 방문 확인. 정전·트립은 방문 시 발견. 상품 전량 폐기.", "after": "정전·온도 이탈·누수 문자 알림. 조치 가능한 시간 안에 인지. 매장별 이력 확인."}},
  "uc-hotels": {"snapshot": [{"label": "급탕 관리", "value": "저탕조 60℃ 이상", "desc": "레지오넬라 관리 권고 수준"}, {"label": "대상", "value": "부대시설·기계실", "desc": "급탕·수처리·주방·세탁"}, {"label": "신호 수집", "value": "접점·전류", "desc": "보일러·펌프 고장"}], "customer": {"lead": "리조트, 콘도미니엄, 온천·스파 시설, 대형 호텔의 시설팀과 부대시설 운영 부서가 대상입니다.", "paragraphs": ["대형 숙박·휴양 시설은 급탕 설비, 수영장·사우나 여과 설비, 대형 주방, 세탁 설비를 함께 운영합니다. 레지오넬라균은 25~45℃의 정체된 물에서 증식하므로 질병관리청 관리 지침은 저탕조 60℃ 이상 유지 등을 권고하며, 목욕장 수질은 공중위생관리법의 관리 대상입니다."]}, "challenge": {"lead": "부대시설의 기계실은 고객 동선 밖에 있어 관심에서 멀지만, 고장이 나면 시설 전체의 영업에 영향을 줍니다.", "pains": [{"title": "급탕 온도 저하", "desc": "보일러나 열교환기 이상으로 저탕조 온도가 내려가면 객실 온수 민원과 함께 위생 위험이 커집니다."}, {"title": "여과·순환 펌프 정지", "desc": "수영장과 사우나의 순환 펌프가 멈추면 수질이 빠르게 나빠지고 영업을 중단해야 합니다."}, {"title": "주방 냉장 설비", "desc": "연회와 뷔페를 위한 대량 식재료가 워크인 냉장고에 보관되어 사고 시 손실이 큽니다."}, {"title": "비수기 인력 축소", "desc": "비수기에는 시설 인력이 줄어 기계실 순회 주기가 길어집니다."}]}, "solution": {"lead": "급탕 공급·환수 배관과 저탕조에 온도 센서를, 순환 펌프와 보일러에 전류·건접점 센서를, 주방 워크인에 온도 센서를 설치합니다.", "paragraphs": ["급탕은 저탕조 출구와 환탕 배관의 온도를 함께 기록해 순환 계통 전체가 관리 온도를 유지하는지 확인합니다. 배관 표면 부착 방식은 보온재 안쪽에 밀착 설치해야 하며, 관 내부 수온과의 차이를 고려해 기준을 정합니다. 펌프 전류는 운전 여부와 부하 이상을, 보일러 제어반의 고장 접점은 정지를 알립니다.", "수영장·욕조수의 잔류염소와 탁도 같은 수질 항목은 본 시스템의 측정 대상이 아니며 법정 수질 검사를 대체하지 않습니다. 본 구성은 수질을 좌우하는 설비의 운전 상태와 온도를 감시하는 역할입니다."], "sensors": ["온도(배관 표면)", "전류", "건접점", "누수 감지", "저온", "습도", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "성수기 전 점검 기간에 기계실 중심으로 설치합니다.", "phases": [{"tag": "PHASE 1", "title": "설비 계통 확인", "desc": "급탕·여과·주방 설비의 계통과 관리 온도를 확인합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "설치", "desc": "기계실과 주방에 센서를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "기준 설정", "desc": "급탕 온도 하한, 펌프 정지, 냉장 이탈 알림 조건을 설정합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "운영 반영", "desc": "당직 지침과 위생 관리 기록에 반영합니다.", "duration": "지속"}]}, "roi": {"lead": "회수는 '부대시설 영업 중단 1일의 매출 손실'과 '식재료 폐기 회피'를 기준으로 산정합니다. 위생 사고의 영향은 금액 산정이 어려우므로 예방 자체를 도입 근거로 봅니다.", "metrics": [{"num": "60℃", "desc": "저탕조 유지 온도 권고 수준(이상)"}, {"num": "45℃", "desc": "레지오넬라균 증식 온도 범위 상한(25~45℃)"}, {"num": "접점 수집", "desc": "보일러·펌프 고장 즉시 통보"}], "before": "기계실 순회로 온도계 확인. 펌프 정지는 수질 악화 후 인지. 온수 민원으로 보일러 이상 파악.", "after": "급탕 온도·펌프 운전 연속 기록. 정지·저온 문자 알림. 위생 관리 기록의 보조 자료 확보."}},
  "uc-apartment": {"snapshot": [{"label": "법적 배경", "value": "공동주택관리법·기계설비법", "desc": "시설물 안전관리·유지관리"}, {"label": "핵심 위험", "value": "지하 침수·정전", "desc": "전기실·집수정"}, {"label": "통보", "value": "SMS", "desc": "관리소장·기전 담당·당직"}], "customer": {"lead": "아파트 관리사무소, 위탁관리 회사, 입주자대표회의, 임대주택 운영 기관(공공·민간)이 대상입니다.", "paragraphs": ["공동주택은 지하층에 수변전실, 기계실, 저수조, 소방 펌프실이 모여 있습니다. 최근 집중호우로 지하주차장과 전기실이 침수되어 단지 전체가 정전·단수되는 사고가 반복되었고, 야간에는 경비원과 당직 기전 인력 한두 명이 단지 전체를 맡습니다."]}, "challenge": {"lead": "단지의 핵심 설비는 모두 지하에 있고, 지하에는 밤에 사람이 없습니다.", "pains": [{"title": "집수정 배수 펌프 고장", "desc": "펌프 고장이나 플로트 스위치 불량으로 집수정이 넘치면 전기실로 물이 유입됩니다."}, {"title": "전기실 침수와 장기 정전", "desc": "수변전 설비가 침수되면 복구에 수일이 걸리고 그 기간 동안 승강기·급수·난방이 중단됩니다."}, {"title": "공용 배관 누수", "desc": "노후 단지의 입상관과 횡주관 누수는 PS와 지하 천장에서 시작되어 발견이 늦습니다."}, {"title": "세대 누수 분쟁", "desc": "위·아래층 누수 분쟁에서 발생 시점과 원인을 가릴 객관적 기록이 없습니다."}]}, "solution": {"lead": "집수정에 플로트형 수위 센서를, 전기실·기계실 바닥에 누수 센서를, 수전 계통에 전압 감지 센서를 설치하고 문자로 통보합니다.", "paragraphs": ["집수정은 배수 펌프 기동 수위보다 높은 위치에 플로트 센서를 설치해 '펌프가 돌아야 하는데 수위가 계속 오르는 상태'를 감지합니다. 배수 펌프와 급수 펌프의 운전은 전류 센서로, 소방 펌프 제어반의 고장 신호는 건접점 센서로 받습니다. 지하 구조는 철근콘크리트로 전파 감쇠가 크므로 게이트웨이를 지하층에 두고 수신 감도를 확인합니다.", "게이트웨이는 LTE 유심과 내장 배터리를 갖추고 있어 단지 전체가 정전되어도 2~3일간 알림이 유지됩니다. 세대 내부 설치는 사유 공간이므로 입주민 동의를 전제로 하며, 본 구성은 공용부 감시를 기본으로 합니다."], "sensors": ["누수 감지 플로트", "누수 감지", "누수 감지 로프", "전압 감지", "전류", "건접점", "온도", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "우기 전에 지하 침수 감시를 먼저 구축하고 동절기 전에 동파·누수 감시를 추가합니다.", "phases": [{"tag": "PHASE 1", "title": "지하 설비 조사", "desc": "집수정 위치와 펌프 계통, 전기실 바닥 레벨, 과거 침수 이력을 조사합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "침수·정전 감시 설치", "desc": "집수정·전기실·기계실에 센서를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "통보 체계 수립", "desc": "관리소장·기전 담당·경비실의 수신과 대응 순서를 정합니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "누수·동파 감시 확대", "desc": "공용 배관 PS, 옥상 물탱크실, 노출 배관으로 확대합니다.", "duration": "1~2주"}]}, "roi": {"lead": "회수는 '전기실 침수 1건의 복구비와 단지 정전 기간의 피해'를 기준으로 판단합니다. 장기수선충당금이나 관리비 집행 안건으로 상정할 때는 최근 인근 단지의 침수 사례를 근거로 제시하는 것이 효과적입니다.", "metrics": [{"num": "2~3일", "desc": "단지 정전 중 알림 유지 시간"}, {"num": "수위", "desc": "펌프 기동 수위 이상에서 집수정 범람 전 감지"}, {"num": "공용부 기본", "desc": "세대 내부는 동의 후 적용"}], "before": "당직 인력의 지하 순찰. 집수정 범람은 주차장 침수로 인지. 정전은 입주민 신고로 파악.", "after": "수위 상승·누수·정전 문자 알림. 범람 전 단계에서 조치. 발생 시각 이력으로 원인 조사."}},
  "uc-second-home": {"snapshot": [{"label": "주요 위험", "value": "동파·누수·침입", "desc": "주중 무인 상태"}, {"label": "통신", "value": "LTE", "desc": "현장 인터넷 불필요"}, {"label": "설치", "value": "직접 설치 가능", "desc": "자석 부착, 전원 연결"}], "customer": {"lead": "전원주택·세컨드하우스·농막 소유자, 펜션·독채 숙소 운영자, 전원주택 단지 관리 업체가 대상입니다.", "paragraphs": ["주중에는 도시에서, 주말에는 지방에서 지내는 생활이 늘면서 주중에 비어 있는 주택이 많아졌습니다. 강원·경기 북부 등 내륙 산간은 겨울철 기온이 낮아 보일러가 멈추면 하룻밤 사이에 배관이 얼 수 있습니다."]}, "challenge": {"lead": "비어 있는 집의 사고는 다음 방문 때까지 며칠씩 진행됩니다.", "pains": [{"title": "보일러 정지와 동파", "desc": "외출 모드로 둔 보일러가 정전, 연료 소진, 고장으로 멈추면 실내 온도가 영하로 내려가 배관과 보일러가 파손됩니다."}, {"title": "해빙 후 누수", "desc": "얼었던 배관이 녹으면서 터진 부위로 물이 계속 나와 바닥과 가구가 손상됩니다."}, {"title": "무단 침입", "desc": "인적이 드문 지역의 빈집은 침입과 도난의 대상이 됩니다."}, {"title": "원거리 확인", "desc": "이상이 의심되어도 직접 가 보려면 왕복 수 시간이 걸립니다."}]}, "solution": {"lead": "실내 온도 센서, 누수 센서, 출입문 센서, 전압 감지 센서를 설치하고 LTE 게이트웨이로 문자 알림을 받습니다.", "paragraphs": ["실내 온도가 설정값(예: 5℃) 아래로 내려가면 알림이 와서 이웃이나 관리 업체에 보일러 확인을 요청할 시간을 벌 수 있습니다. 전압 감지 센서는 정전과 복전 시각을 알려 보일러가 다시 가동되었는지 판단하는 근거가 됩니다.", "센서는 자석으로 붙이고 게이트웨이는 전원만 꽂으면 동작하므로 소유자가 직접 설치할 수 있습니다. 게이트웨이는 정전 시 내장 배터리로 2~3일 동작합니다. 본 구성은 통보 장치이며 침입을 막거나 출동하는 경비 서비스는 아니므로 현지 대응 연락처를 미리 정해 두어야 합니다."], "sensors": ["온도", "누수 감지", "개폐 감지", "움직임 감지", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "겨울이 오기 전에 설치하는 것이 가장 효과적입니다.", "phases": [{"tag": "PHASE 1", "title": "구성 결정", "desc": "보일러실, 화장실·주방, 현관 등 설치 위치와 센서 수를 정합니다.", "duration": "30분"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서를 부착하고 게이트웨이 전원을 연결합니다.", "duration": "1시간 내외"}, {"tag": "PHASE 3", "title": "알림 설정", "desc": "온도 하한과 수신 번호, 현지 대응 연락처를 설정합니다.", "duration": "30분"}]}, "roi": {"lead": "비용 판단 기준은 '동파 1회의 배관·보일러 수리비와 바닥 복구비'입니다. 겨울철 한 번의 동파 수리 견적과 장비·연간 이용료를 비교해 판단합니다.", "metrics": [{"num": "5℃", "desc": "동결 전 사전 알림 온도 예시"}, {"num": "1시간", "desc": "직접 설치 소요"}, {"num": "정전·복전 시각", "desc": "보일러 재가동 판단 근거"}], "before": "다음 방문 때 확인. 동파는 해빙 후 누수로 발견. 침입 여부 알 수 없음.", "after": "저온·누수·정전·출입 문자 알림. 동결 전 조치 요청 가능. 불필요한 확인 방문 감소."}},
  "uc-schools-churches": {"snapshot": [{"label": "교실 CO₂", "value": "1,000ppm", "desc": "학교보건법 시행규칙 기준(기계환기 시 1,500ppm)"}, {"label": "무인 기간", "value": "방학·주중", "desc": "원격 통보"}, {"label": "통신", "value": "LTE", "desc": "학교 내부망 미사용"}], "customer": {"lead": "초·중·고등학교 행정실과 교육지원청 시설 담당, 대학 시설팀, 교회·성당·사찰의 관리 책임자가 대상입니다.", "paragraphs": ["학교는 교육시설법에 따라 안전점검을 실시하며 교실 공기질은 학교보건법으로 관리됩니다. 학교와 종교시설은 사용 시간대에 인원이 집중되고 그 밖의 시간에는 거의 비어 있다는 공통점이 있습니다."]}, "challenge": {"lead": "사람이 몰리는 시간과 비어 있는 시간의 차이가 큰 건물은 두 가지 서로 다른 문제를 동시에 가집니다.", "pains": [{"title": "방학·주중 무인 사고", "desc": "겨울방학 중 화장실과 급수 배관의 동파, 누수는 개학 준비 시점에 발견됩니다."}, {"title": "밀집 시간대 환기", "desc": "수업 중 교실과 예배 중 본당은 재실 밀도가 높아 CO₂ 농도가 빠르게 오릅니다."}, {"title": "강당·체육관 결로", "desc": "대공간은 난방 가동 초기에 바닥과 벽면에 결로가 생겨 미끄럼 사고와 마감재 손상의 원인이 됩니다."}, {"title": "관리 인력 부족", "desc": "행정실 직원이나 관리 집사 한두 명이 건물 전체 시설을 맡습니다."}]}, "solution": {"lead": "무인 시간대 감시(누수·온도·정전·수신기 신호)와 사용 시간대 환경 기록(CO₂·온습도)을 하나의 게이트웨이로 수집합니다.", "paragraphs": ["화장실·급식실·기계실에는 누수와 온도 센서를, 수전 계통에는 전압 감지 센서를 설치합니다. 소방 수신기의 주경종 출력을 전압 감지 센서로 받으면 무인 시간의 화재 신호를 책임자가 문자로 받을 수 있습니다. 이는 소방시설을 대체하지 않는 보조 통보입니다.", "교실과 본당의 CO₂ 센서는 환기 시점 판단과 환기 설비 운전의 근거 자료가 됩니다. 법정 공기질 측정을 대신하지는 않습니다. 게이트웨이는 LTE를 사용해 교육청 보안 정책 대상인 학교 내부망에 연결하지 않습니다."], "sensors": ["누수 감지", "온도", "습도", "CO₂", "전압 감지", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "방학 전에 무인 감시를 먼저 설치하고 학기 중에 환경 기록을 추가합니다.", "phases": [{"tag": "PHASE 1", "title": "위험 지점 확인", "desc": "동파·누수 이력 지점과 수신기 위치를 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "무인 감시 설치", "desc": "누수·온도·전압 감지 센서와 게이트웨이를 설치합니다.", "duration": "반나절~1일"}, {"tag": "PHASE 3", "title": "환경 기록 추가", "desc": "교실·강당·본당에 CO₂·온습도 센서를 설치합니다.", "duration": "반나절"}, {"tag": "PHASE 4", "title": "운영 정착", "desc": "방학 중 당번 체계와 환기 지침에 반영합니다.", "duration": "1개월"}]}, "roi": {"lead": "효과는 '방학 중 동파·누수 복구비 회피'와 '환기 판단의 근거 확보'입니다. 공공·비영리 시설이므로 사고 예방과 관리 인력 부담 경감을 도입 근거로 삼습니다.", "metrics": [{"num": "1,000", "desc": "교실 CO₂ 기준(ppm), 기계환기 시 1,500ppm"}, {"num": "LTE", "desc": "학교 내부망 미사용"}, {"num": "방학 포함", "desc": "무인 기간 문자 알림"}], "before": "방학 중 당번 순회. 동파는 개학 전 발견. 환기는 교사·진행자 재량.", "after": "무인 기간 누수·저온·정전 알림. CO₂ 기록에 근거한 환기. 시설 이력 축적."}},
  "uc-foreclosed": {"snapshot": [{"label": "대상", "value": "경매·공매·담보 부동산", "desc": "처분 전 관리 공백"}, {"label": "목적", "value": "담보 가치 보전", "desc": "손상·점유 조기 인지"}, {"label": "전제 조건", "value": "전원·출입 권한", "desc": "설치 가능 여부 사전 확인"}], "customer": {"lead": "금융기관의 여신 사후관리 부서, 부실채권(NPL) 투자·자산관리회사, 부동산 신탁사, 경매 낙찰 후 명도 전 단계의 매수인이 대상입니다.", "paragraphs": ["채무 불이행으로 경매·공매 절차에 들어간 부동산은 소유자의 관리가 중단된 채 수개월에서 1년 이상 방치됩니다. 이 기간의 동파·누수·무단 점유·설비 도난은 감정가 대비 처분 가치를 떨어뜨리는 직접적인 원인입니다."]}, "challenge": {"lead": "절차가 진행되는 동안 부동산의 상태는 누구의 일상 업무에도 속하지 않습니다.", "pains": [{"title": "관리 주체 공백", "desc": "소유자는 관리 의지가 없고 채권자는 점유 권한이 제한되어 상태 확인이 어렵습니다."}, {"title": "단전·단수 상태", "desc": "요금 체납으로 전기와 수도가 끊긴 건물이 많아 일반적인 감시 장비를 설치할 수 없습니다."}, {"title": "무단 점유", "desc": "유치권 주장이나 제3자의 무단 점유는 명도 지연과 처분가 하락으로 이어집니다."}, {"title": "원거리 다수 물건", "desc": "관리 대상 물건이 전국에 흩어져 있어 정기 현장 확인 비용이 큽니다."}]}, "solution": {"lead": "설치 권한과 전원이 확보되는 물건에 한해 배터리 구동 센서와 LTE 게이트웨이로 최소한의 감시를 구성합니다.", "paragraphs": ["온도 센서로 동결 위험을, 누수 센서로 배관 파손을, 개폐·움직임 감지 센서로 출입 발생을 감지해 문자로 통보합니다. 출입 감지 기록은 점유 상황 변화를 파악하는 참고 자료가 됩니다.", "센서는 배터리로 동작하지만 게이트웨이는 상시 전원이 필요하며 내장 배터리만으로는 2~3일 동작합니다. 단전된 물건은 공용부 전원 사용 협의나 별도 전원 확보가 선행되어야 합니다. 또한 설치는 점유·관리 권한이 있는 주체만 할 수 있으므로 법률 검토 후 진행해야 하며, 권한 없이 타인 점유 공간에 설치해서는 안 됩니다."], "sensors": ["온도", "누수 감지", "개폐 감지", "움직임 감지", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "물건별로 설치 가능 여부를 먼저 판정하고, 가능한 물건에 표준 키트를 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "설치 가능성 판정", "desc": "점유 상태, 관리 권한, 전원 가용 여부를 물건별로 확인합니다.", "duration": "물건당 1~2일"}, {"tag": "PHASE 2", "title": "설치", "desc": "표준 키트(센서 3~5개, 게이트웨이 1대)를 설치합니다.", "duration": "물건당 1시간 내외"}, {"tag": "PHASE 3", "title": "통보·출동 체계", "desc": "알림 수신자와 현지 출동 협력 업체를 지정합니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "회수·재사용", "desc": "처분 완료 시 장비를 회수해 다른 물건에 사용합니다.", "duration": "수시"}]}, "roi": {"lead": "판단 기준은 '손상에 따른 처분가 하락 가능액'과 '정기 현장 확인 출장비'입니다. 물건 가액 대비 장비·이용료의 비율이 매우 낮아 고가 물건일수록 타당성이 높습니다.", "metrics": [{"num": "3~5개", "desc": "물건당 센서 수(게이트웨이 1대)"}, {"num": "2~3일", "desc": "게이트웨이 내장 배터리 동작 시간, 상시 전원 필요"}, {"num": "권한 확인", "desc": "점유·관리 권한이 있는 경우에만 설치"}], "before": "정기 현장 방문으로 확인. 동파·점유 변화는 방문 시 발견. 처분 직전 손상 확인.", "after": "저온·누수·출입 발생 문자 알림. 이상 발생 물건 우선 방문. 상태 이력 보유."}},
  "uc-dormitory": {"snapshot": [{"label": "주요 위험", "value": "누수·동파·급탕 정지", "desc": "학기 중 민원, 방학 중 사고"}, {"label": "운영 인력", "value": "사감·기전 소수", "desc": "야간 1~2인"}, {"label": "기준", "value": "기계설비법", "desc": "연면적 1만㎡ 이상 유지관리 대상"}], "customer": {"lead": "대학 생활관, 기업 사원 기숙사, 공공 기숙사(행복기숙사 등), 학원·연수원 숙소의 운영·시설 담당자가 대상입니다.", "paragraphs": ["기숙사는 층마다 화장실·샤워실·세탁실이 반복되는 구조로 급수·급탕 사용량이 많습니다. 학기 중에는 수백 명이 생활하고 방학에는 대부분 비는 운영 주기를 가지며, 야간에는 사감이나 경비 인력만 근무합니다."]}, "challenge": {"lead": "기숙사는 물을 많이 쓰는 건물이면서 방학마다 장기 공실이 되는 건물입니다.", "pains": [{"title": "샤워실·세탁실 누수", "desc": "방수층 손상과 세탁기 급수 호스 이탈로 인한 누수가 아래층 호실로 번집니다."}, {"title": "급탕 정지", "desc": "보일러나 순환 펌프가 야간에 멈추면 아침 시간대에 다수의 민원이 동시에 발생합니다."}, {"title": "방학 중 동파", "desc": "겨울방학에 난방을 줄인 동에서 복도 끝 호실과 외벽 측 배관이 얼어 터집니다."}, {"title": "환기 불량과 곰팡이", "desc": "겨울철 창문을 닫고 생활하는 호실은 습도가 높아 곰팡이 민원이 발생합니다."}]}, "solution": {"lead": "공용부와 기계실 중심으로 무선 누수·온도·전류 센서를 설치하고, 호실 내부는 필요 구역에 한해 온습도만 측정합니다.", "paragraphs": ["층별 샤워실·세탁실 바닥과 PS에는 누수 센서를, 급탕 공급 배관에는 온도 센서를, 보일러와 순환 펌프에는 전류·건접점 센서를 설치합니다. 방학 중에는 외벽 측 복도와 공실 호실에 온도 센서를 두어 동결 위험을 미리 알립니다.", "호실 내부의 움직임 감지는 거주자 사생활과 관련되므로 기본 구성에서 제외합니다. 알림은 사감과 기전 담당자에게 문자로 전달되며 동·층 단위로 위치를 표시합니다."], "sensors": ["누수 감지", "누수 감지 로프", "온도", "습도", "전류", "건접점", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "방학 기간에 설치하고 다음 학기 운영에 반영합니다.", "phases": [{"tag": "PHASE 1", "title": "이력 정리", "desc": "누수·급탕 민원 이력과 동파 발생 지점을 정리합니다.", "duration": "2~3일"}, {"tag": "PHASE 2", "title": "설치", "desc": "공용부와 기계실에 센서를 설치합니다.", "duration": "1~2일"}, {"tag": "PHASE 3", "title": "알림 운영", "desc": "사감·기전 담당의 야간 대응 절차를 정합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "동 확대", "desc": "다른 동으로 확대합니다.", "duration": "동당 1~2일"}]}, "roi": {"lead": "회수는 '누수 복구비와 호실 사용 중단에 따른 재배정 비용', '방학 중 동파 복구비'로 산정합니다. 최근 3년간 누수·동파 수선비 집행 내역이 가장 좋은 근거입니다.", "metrics": [{"num": "동·층", "desc": "누수 위치 표시 단위"}, {"num": "급탕", "desc": "야간 정지를 아침 민원 전에 인지"}, {"num": "공용부 중심", "desc": "호실 내 사생활 영역 제외"}], "before": "학생 신고와 순찰로 인지. 급탕 정지는 아침 민원으로 파악. 방학 동파는 개강 전 발견.", "after": "누수·급탕 저온·설비 정지 문자 알림. 방학 중 저온 사전 통보. 수선 이력과 연계한 관리."}},
  "uc-storage": {"snapshot": [{"label": "관리 지표", "value": "온도·상대습도", "desc": "결로·곰팡이·변형 방지"}, {"label": "부가 감시", "value": "누수·출입", "desc": "상부층 누수, 유닛 도어"}, {"label": "산출물", "value": "보관 환경 이력", "desc": "고객 제공용 기록"}], "customer": {"lead": "도심형 셀프스토리지·공유 창고 운영사, 문서 보관 전문업체, 기록관·도서관 서고, 미술품 수장고와 와인 보관 시설 운영자가 대상입니다.", "paragraphs": ["도심 셀프스토리지는 상가·오피스 건물의 지하나 저층을 개조해 운영하는 경우가 많고 무인으로 운영됩니다. 보관품은 의류, 서류, 전자제품, 악기처럼 습기에 약한 물품이 다수이며 보관 환경이 서비스 품질 그 자체입니다."]}, "challenge": {"lead": "보관 시설의 고객은 물건을 맡긴 뒤 오랫동안 오지 않으므로, 손상은 수개월 뒤에야 발견됩니다.", "pains": [{"title": "지하 공간의 고습", "desc": "지하층은 여름철 외기 유입과 벽체 투습으로 상대습도가 높아 곰팡이와 종이 변형이 발생합니다."}, {"title": "결로", "desc": "공조가 간헐 운전되는 시설은 온도 변화에 따라 금속 유닛 벽과 보관품 표면에 결로가 생깁니다."}, {"title": "상부층 누수", "desc": "건물 위층의 배관·화장실 누수가 유닛 천장으로 유입됩니다."}, {"title": "분쟁 시 입증", "desc": "보관품 손상에 대한 배상 분쟁에서 시설의 보관 환경을 입증할 기록이 필요합니다."}]}, "solution": {"lead": "보관 구역에 무선 온습도 센서를 분산 배치하고 천장 배관 하부에 누수 센서를 설치해 환경 이력을 축적합니다.", "paragraphs": ["온습도에서 이슬점을 계산해 결로 위험을 판단하고 제습기·공조 운전의 근거로 씁니다. 제습기의 가동 여부는 전류 센서로 확인하며 물통 만수로 정지한 상태를 알릴 수 있습니다. 금속 패널로 구획된 유닛은 전파 감쇠가 있어 복도 측에 센서를 두거나 게이트웨이 위치를 조정합니다.", "미술품과 기록물처럼 엄격한 조건이 요구되는 수장고는 센서 정확도와 교정 주기를 사양서로 확인해 적용합니다. 유닛 출입문에 개폐 센서를 두면 출입 시각 기록을 남길 수 있으나, 출입 통제와 보안은 기존 출입 시스템이 담당합니다."], "sensors": ["온도", "습도", "누수 감지", "누수 감지 로프", "전류", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "장마철 전에 설치해 여름 한 철의 습도 추세를 확보합니다.", "phases": [{"tag": "PHASE 1", "title": "구역 설계", "desc": "층·구역별 측정 지점과 누수 우려 배관을 확인합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치하고 수신 상태를 확인합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "기준 설정", "desc": "보관 품목에 맞는 온습도 범위와 알림 조건을 설정합니다.", "duration": "1~2주"}, {"tag": "PHASE 4", "title": "고객 제공", "desc": "보관 환경 이력을 고객 안내 자료로 활용합니다.", "duration": "지속"}]}, "roi": {"lead": "회수는 '보관품 손상 배상 건수와 금액', '고습 구간의 제습 운전 최적화'로 산정합니다. 보관 환경 기록은 요금 차별화의 근거로도 쓸 수 있으나 그 효과는 사업자의 판매 전략에 달려 있습니다.", "metrics": [{"num": "이슬점", "desc": "결로 위험 판단 지표"}, {"num": "전류", "desc": "제습기 정지 상태 인지"}, {"num": "환경 이력", "desc": "분쟁 시 보관 조건 입증 자료"}], "before": "무인 운영 중 환경 미확인. 손상은 고객 방문 시 발견. 분쟁 시 입증 자료 없음.", "after": "구역별 온습도 이력 확보. 고습·누수 문자 알림. 고객에게 보관 환경 기록 제공."}},
  "uc-financial": {"snapshot": [{"label": "대상", "value": "지점·무인 점포", "desc": "통신실·금고·문서고·ATM 코너"}, {"label": "운영", "value": "본점 통합", "desc": "지점별 상태 비교"}, {"label": "통신", "value": "보안 정책 선택", "desc": "LTE 분리 또는 내부망 서버구축형"}], "customer": {"lead": "금융기관의 총무·시설·점포 관리 부서, 자동화기기 운영 위탁사, 점포 시설 유지보수 협력사가 대상입니다.", "paragraphs": ["금융 지점은 상가 건물의 1~2층을 임차해 운영하는 경우가 많아 건물 설비 관리는 건물주 소관입니다. 지점 통폐합으로 무인 점포와 자동화기기 코너가 늘어 야간·휴일에 사람이 없는 금융 공간이 증가했습니다."]}, "challenge": {"lead": "지점의 시설 사고는 건물주 소관 설비에서 시작되는 경우가 많아 금융기관이 미리 알기 어렵습니다.", "pains": [{"title": "상부층 누수", "desc": "임차 건물의 위층 배관 누수가 통신실, 문서고, 자동화기기 위로 떨어집니다."}, {"title": "통신실 과열", "desc": "지점 통신실은 소형 에어컨 한 대에 의존하며 주말에 정지하면 월요일 영업 개시에 지장이 생깁니다."}, {"title": "문서고 환경", "desc": "장기 보존 문서와 담보 서류는 고습 환경에서 곰팡이와 변색이 생깁니다."}, {"title": "휴일 정전", "desc": "건물 전기 점검으로 인한 정전은 통신 장비와 보안 설비에 영향을 줍니다."}]}, "solution": {"lead": "지점마다 통신실 온도, 누수, 정전 감지 센서를 표준 구성으로 설치하고 본점에서 지점별 상태를 조회합니다.", "paragraphs": ["통신실에는 온도와 누수 센서를, 문서고와 금고실에는 온습도 센서를, 수전 계통에는 전압 감지 센서를 설치합니다. 센서는 환경 값만 전송하며 금융 거래 정보와 무관합니다.", "통신 방식은 금융기관 보안 정책에 따라 선택합니다. 지점 업무망과 완전히 분리된 LTE 게이트웨이를 사용하거나, 내부망에 설치하는 서버구축형 iMonnit Enterprise로 운영할 수 있습니다. 어느 방식이든 도입 전 정보보호 부서의 보안성 검토를 거칩니다."], "sensors": ["온도", "습도", "누수 감지", "전압 감지", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Enterprise(서버구축형)"]}, "proposal": {"lead": "보안성 검토 후 지점 몇 곳에서 표준 구성을 검증하고 전 지점으로 확대합니다.", "phases": [{"tag": "PHASE 1", "title": "보안성 검토", "desc": "통신 방식과 데이터 흐름에 대한 검토를 받습니다.", "duration": "2~4주"}, {"tag": "PHASE 2", "title": "시범 지점 설치", "desc": "유형이 다른 지점 몇 곳에 설치합니다.", "duration": "지점당 반나절"}, {"tag": "PHASE 3", "title": "운영 기준 수립", "desc": "알림 수신(지점장·본점 시설·협력사)과 대응 기준을 정합니다.", "duration": "1개월"}, {"tag": "PHASE 4", "title": "전 지점 확대", "desc": "권역별로 확대합니다.", "duration": "권역당 2~4주"}]}, "roi": {"lead": "회수는 '지점 영업 차질 1일의 영향'과 '누수에 따른 장비·문서 손상 복구비'를 기준으로 판단합니다. 임차 건물의 누수는 건물주와의 책임 협의에 발생 시각 기록이 근거가 됩니다.", "metrics": [{"num": "반나절", "desc": "지점당 설치 소요"}, {"num": "표준", "desc": "지점당 동일 센서 구성"}, {"num": "발생 시각 기록", "desc": "건물주와의 책임 협의 근거"}], "before": "영업 개시 시 직원이 발견. 무인 점포는 고객 신고로 인지. 본점은 사후 보고 수령.", "after": "지점 통신실·문서고 상시 감시. 휴일 이상 문자 알림. 본점에서 지점별 이력 조회."}},
  "livestock": {"snapshot": [{"label": "최우선 위험", "value": "환기 정지·정전", "desc": "밀폐형 축사의 급성 폐사"}, {"label": "관리 지표", "value": "온습도", "desc": "열 스트레스 판단"}, {"label": "통신", "value": "LTE", "desc": "농장 인터넷 불필요"}], "customer": {"lead": "양돈·양계(육계·산란계)·오리 농장, 축산 계열화 사업자의 사육 관리 부서, 축산 컨설팅·방역 관리 업체가 대상입니다.", "paragraphs": ["국내 양돈·양계는 무창(밀폐형) 축사 비중이 높아 실내 환경이 전적으로 환기팬과 냉방 설비에 달려 있습니다. 여름철 폭염 일수가 늘면서 가축 폐사 피해가 해마다 보고되고, 농장주가 농장에 상주하지 않는 경우도 많습니다."]}, "challenge": {"lead": "밀폐형 축사에서 환기가 멈추면 가축의 체열과 호흡으로 실내 온도와 가스 농도가 수십 분 안에 위험 수준에 도달합니다.", "pains": [{"title": "정전·차단기 트립", "desc": "낙뢰와 과부하로 환기팬 전원이 끊기면 야간에는 알아차릴 사람이 없습니다."}, {"title": "폭염 시 열 스트레스", "desc": "온도와 습도가 함께 높으면 가축이 체열을 발산하지 못해 사료 섭취 감소와 폐사가 발생합니다."}, {"title": "급수 중단", "desc": "급수 라인의 압력 저하나 동결은 수 시간 내에 가축 상태에 영향을 줍니다."}, {"title": "제어기 단일 의존", "desc": "환경 제어기가 고장 나면 제어와 경보가 함께 멈춥니다."}]}, "solution": {"lead": "환경 제어기와 독립된 무선 센서로 축사 온습도, 환기팬 전류, 전원, 급수 압력을 감시하고 문자로 통보합니다.", "paragraphs": ["온습도 센서는 가축 높이 근처에 설치하되 분진과 세척수에 노출되므로 보호 조치를 하고 정기적으로 청소합니다. 온도와 습도로 열 스트레스 수준을 판단해 단계별 알림을 설정합니다. 환기팬은 전류 센서로 실제 회전 여부를 확인하고, 축사 전원은 전압 감지 센서로 감시합니다.", "게이트웨이는 LTE 유심과 내장 배터리를 갖추고 있어 농장이 정전되어도 2~3일간 문자를 보냅니다. 암모니아와 황화수소 같은 축사 유해 가스의 농도 측정은 본 구성에 포함되지 않으며, 부식성 환경에 맞는 전용 계측기를 별도로 사용해야 합니다."], "sensors": ["온도", "습도", "전류", "전압 감지", "압력", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "여름이 오기 전에 정전과 환기 정지 감시를 먼저 갖추는 것이 우선입니다.", "phases": [{"tag": "PHASE 1", "title": "축사 설비 확인", "desc": "동별 환기 방식, 전원 계통, 급수 라인을 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "전압 감지·전류·온습도 센서와 게이트웨이를 설치합니다.", "duration": "동당 1~2시간"}, {"tag": "PHASE 3", "title": "알림 기준 설정", "desc": "축종과 일령에 맞는 온습도 기준과 수신자를 설정합니다.", "duration": "1주"}, {"tag": "PHASE 4", "title": "동 확대", "desc": "다른 축사 동과 계열 농장으로 확대합니다.", "duration": "동당 1~2시간"}]}, "roi": {"lead": "판단 기준은 '환기 정지 사고 1회의 폐사 손실'입니다. 동당 사육 두수와 출하 단가를 곱하면 손실 상한이 계산되며, 가축재해보험의 보장 범위와 자기부담을 함께 고려합니다.", "metrics": [{"num": "2~3일", "desc": "정전 시 알림 유지 시간"}, {"num": "전류", "desc": "환기팬의 실제 운전 여부 확인"}, {"num": "독립 계통", "desc": "환경 제어기 고장과 무관하게 동작"}], "before": "환경 제어기 경보와 농장주 순회. 야간 정전은 아침에 발견. 폭염 시 수시 방문.", "after": "정전·환기 정지 즉시 문자 통보. 온습도 단계별 알림. 농장 밖에서 동별 상태 확인."}},
  "marina": {"snapshot": [{"label": "주요 위험", "value": "빌지 침수·배터리 방전", "desc": "무인 계류 기간"}, {"label": "감시 항목", "value": "수위·전압·전원", "desc": "빌지·배터리·육전"}, {"label": "환경", "value": "염분·습기", "desc": "방수 등급·부식 대책 필요"}], "customer": {"lead": "마리나 운영사, 요트·보트 소유자와 관리 대행업체, 낚시 어선·소형 어선 선주, 어항 관리 기관이 대상입니다.", "paragraphs": ["국내 등록 레저 선박과 마리나 시설은 꾸준히 늘고 있으며, 대부분의 선박은 주말에만 운항하고 평일에는 무인으로 계류됩니다. 여름 태풍과 집중호우 때 계류 선박의 침수·침몰 사고가 반복됩니다."]}, "challenge": {"lead": "선박은 물 위에 떠 있는 동안 계속 조금씩 물이 들어오며, 그것을 퍼내는 것은 배터리로 도는 펌프입니다.", "pains": [{"title": "빌지 펌프 고장", "desc": "자동 빌지 펌프나 플로트 스위치가 고장 나면 빗물과 누수가 선저에 고여 침수로 이어집니다."}, {"title": "배터리 방전", "desc": "육상 전원이 빠지거나 차단기가 내려가면 충전이 중단되고, 펌프가 배터리를 소진한 뒤 멈춥니다."}, {"title": "육전 연결 이탈", "desc": "계류장 전원 케이블이 조석과 파도로 빠지거나 누전 차단기가 작동해도 선주는 알 수 없습니다."}, {"title": "원거리 소유자", "desc": "선주가 마리나에서 멀리 거주해 수시로 확인하기 어렵습니다."}]}, "solution": {"lead": "빌지에 플로트형 수위 센서, 배터리에 전압 센서, 육상 전원 인입부에 전압 감지 센서를 설치합니다.", "paragraphs": ["빌지 수위 센서는 펌프 기동 수위보다 높은 위치에 두어 펌프가 제 역할을 하지 못하는 상황을 감지합니다. 배터리 전압의 하강 추세는 충전 중단을 조기에 알려 줍니다. 게이트웨이는 계류장 육상 측에 설치해 주변 선박의 센서를 함께 수용하는 방식이 효율적입니다.", "해상 환경은 염분과 습기로 부식이 빠르므로 센서의 방수 등급을 확인하고 단자부를 방식 처리해야 합니다. 선체 재질(금속·탄소섬유)에 따라 전파 감쇠가 다르므로 설치 전 수신 상태를 확인합니다. 본 시스템은 계류 중 감시용이며 항해 중 안전 장비를 대체하지 않습니다."], "sensors": ["누수 감지 플로트", "전압", "전압 감지", "습도", "온도", "개폐 감지", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "마리나 단위로 게이트웨이를 설치하고 선석별 선박에 센서를 추가하는 방식으로 진행합니다.", "phases": [{"tag": "PHASE 1", "title": "계류장 통신 확인", "desc": "게이트웨이 설치 위치와 선석별 수신 상태를 확인합니다.", "duration": "1일"}, {"tag": "PHASE 2", "title": "선박 설치", "desc": "빌지·배터리·전원 센서를 설치하고 방수·방식 처리를 합니다.", "duration": "척당 1~2시간"}, {"tag": "PHASE 3", "title": "알림 설정", "desc": "수위·전압 기준과 선주·마리나 관리자의 수신 범위를 설정합니다.", "duration": "1일"}, {"tag": "PHASE 4", "title": "선석 확대", "desc": "다른 선박으로 서비스를 확대합니다.", "duration": "수시"}]}, "roi": {"lead": "판단 기준은 '침수 1건의 인양·수리비'와 '배터리 교체비'입니다. 마리나 운영사는 계류 고객 대상 부가 서비스로 제공하는 방안을 함께 검토할 수 있습니다.", "metrics": [{"num": "수위", "desc": "펌프 기동 수위 이상에서 빌지 펌프 이상 감지"}, {"num": "전압", "desc": "하강 추세로 충전 중단 조기 인지"}, {"num": "공용 게이트웨이", "desc": "계류장 1대로 다수 선박 수용"}], "before": "주말 방문 시 확인. 태풍 전후 직접 점검. 침수는 마리나 직원 발견에 의존.", "after": "빌지 수위·배터리 전압·육전 상태 문자 알림. 태풍 시 원격 확인. 방문은 이상 발생 시에만."}},
  "pet": {"snapshot": [{"label": "주요 위험", "value": "냉난방 정지", "desc": "야간 무인 위탁 시간"}, {"label": "관리 지표", "value": "온습도", "desc": "견종·개체별 취약도 상이"}, {"label": "증빙", "value": "환경 이력", "desc": "보호자 안내 자료"}], "customer": {"lead": "동물위탁관리업(호텔·유치원), 동물병원, 동물미용·판매업 사업장과 프랜차이즈 본사가 대상입니다.", "paragraphs": ["동물보호법은 반려동물 영업자에게 시설·인력 기준과 준수 사항을 정하고 있으며 위탁 동물의 안전은 영업자의 책임입니다. 다수 시설은 야간에 직원이 상주하지 않고 CCTV로만 확인합니다."]}, "challenge": {"lead": "위탁받은 동물은 스스로 환경을 바꾸거나 도움을 요청할 수 없습니다.", "pains": [{"title": "여름철 냉방 정지", "desc": "에어컨 고장이나 정전으로 실내 온도가 오르면 단두종과 노령 동물은 단시간에 위험해집니다."}, {"title": "겨울철 난방 정지", "desc": "소형견과 수술 후 회복 중인 동물은 저온에 취약합니다."}, {"title": "CCTV의 한계", "desc": "영상으로는 동물의 모습은 보이지만 실내 온도와 정전 여부는 알 수 없습니다."}, {"title": "사고 시 책임", "desc": "위탁 중 사고가 발생하면 시설의 관리 상태를 입증할 자료가 필요합니다."}]}, "solution": {"lead": "위탁실과 입원실에 무선 온습도 센서를, 수전 계통에 전압 감지 센서를 설치해 이상 시 문자로 통보합니다.", "paragraphs": ["온습도 센서는 동물이 물어뜯거나 소변이 닿지 않는 높이에, 에어컨 기류를 직접 받지 않는 위치에 설치합니다. 고온·저온 기준을 계절별로 설정하고 주의와 위험 2단계로 알림을 나눕니다.", "전압 감지 센서는 정전을 즉시 알려 실내 온도가 변하기 전에 대응할 수 있게 합니다. 본 시스템은 시설 환경을 감시하며 개별 동물의 건강 상태를 측정하지 않습니다. 환경 기록은 보호자에게 시설 관리 수준을 설명하는 자료로 활용할 수 있습니다."], "sensors": ["온도", "습도", "전압 감지", "개폐 감지", "누수 감지", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "설치는 영업에 지장 없이 한 시간 안팎에 끝납니다.", "phases": [{"tag": "PHASE 1", "title": "위치 선정", "desc": "위탁실·입원실·격리실별 설치 위치를 정합니다.", "duration": "30분"}, {"tag": "PHASE 2", "title": "설치", "desc": "센서와 게이트웨이를 설치합니다.", "duration": "1시간 내외"}, {"tag": "PHASE 3", "title": "기준 설정", "desc": "계절별 온습도 기준과 야간 대응자를 지정합니다.", "duration": "1일"}]}, "roi": {"lead": "도입 근거는 '위탁 동물 사고의 예방'입니다. 사고 1건의 배상과 평판 영향이 소규모 사업장의 존속을 좌우하므로 비용 절감이 아닌 위험 관리 관점에서 판단합니다.", "metrics": [{"num": "2단계", "desc": "주의·위험 온도로 대응 시간 확보"}, {"num": "1시간", "desc": "설치 소요(내외)"}, {"num": "정전 즉시 통보", "desc": "온도 변화 전 인지"}], "before": "야간 CCTV 확인. 냉난방 정지는 아침 출근 시 발견. 관리 상태 입증 자료 없음.", "after": "온습도 이탈·정전 문자 알림. 야간에도 대응 가능. 환경 이력 보관."}},
  "pest": {"snapshot": [{"label": "관리 체계", "value": "방충·방서 모니터링", "desc": "HACCP 선행요건"}, {"label": "감시 항목", "value": "개방·온습도·트랩 신호", "desc": "유입 경로와 발생 조건"}, {"label": "유의 사항", "value": "트랩 기종 확인", "desc": "접점 출력 가능 여부"}], "customer": {"lead": "HACCP 적용 식품·축산물 제조업체의 품질 부서, 물류센터 운영사, 방역 전문업체(PCO)가 대상입니다.", "paragraphs": ["HACCP 선행요건은 작업장의 방충·방서 관리와 주기적 모니터링 기록을 요구합니다. 방역 업체는 포충등과 쥐 트랩을 정해진 주기로 방문 점검하며, 포획 수가 늘면 원인과 유입 경로를 조사합니다."]}, "challenge": {"lead": "해충과 설치류는 들어올 수 있는 틈과 살 수 있는 환경이 있을 때 유입됩니다.", "pains": [{"title": "출입문·도크 개방", "desc": "자재 반입 시 도크 도어와 방충문을 열어 둔 시간이 유입의 주된 경로이지만 기록되지 않습니다."}, {"title": "고온·다습 구역", "desc": "온습도가 높은 구역은 저장물 해충과 날벌레가 번식하기 좋은 조건이 됩니다."}, {"title": "점검 주기 사이의 공백", "desc": "주 1회나 월 2회 점검 사이에 발생한 포획과 유입 증가를 제때 알지 못합니다."}, {"title": "원인 추적의 어려움", "desc": "포획 수 증가의 원인을 설비·문 관리·환경 중 어디에서 찾을지 근거가 부족합니다."}]}, "solution": {"lead": "출입문과 도크에 개폐 센서를, 취약 구역에 온습도 센서를 설치하고, 접점 출력이 가능한 트랩에는 건접점 센서를 연결합니다.", "paragraphs": ["문 개방 시간 기록은 유입 경로 관리의 직접적인 근거가 됩니다. 일정 시간 이상 열려 있으면 관리자에게 알림을 보낼 수 있습니다. 온습도 추세는 발생 가능성이 높은 구역과 계절을 미리 파악하는 데 쓰입니다.", "트랩 작동 감지는 작동 시 접점이 닫히거나 열리는 구조의 트랩에 건접점 센서를 연결하는 방식이며, 트랩 기종에 따라 적용 가능 여부가 달라 사전 확인이 필요합니다. 포충등의 포획 수 계수나 해충 종 식별은 본 시스템의 범위가 아니며 방역 업체의 방문 점검을 대체하지 않습니다."], "sensors": ["개폐 감지", "온도", "습도", "건접점", "움직임 감지", "IoT 게이트웨이(LTE)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "포획 수가 많은 구역의 출입문과 환경부터 측정해 원인을 좁혀 갑니다.", "phases": [{"tag": "PHASE 1", "title": "현황 분석", "desc": "최근 포획 기록과 유입 추정 경로를 방역 업체와 함께 정리합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "설치", "desc": "출입문·도크·취약 구역에 센서를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "상관 분석", "desc": "문 개방 시간, 온습도와 포획 수의 관계를 1~2개월간 비교합니다.", "duration": "1~2개월"}, {"tag": "PHASE 4", "title": "관리 기준 반영", "desc": "문 개방 허용 시간 등 관리 기준을 정하고 다른 구역으로 확대합니다.", "duration": "지속"}]}, "roi": {"lead": "효과는 '유입 원인의 특정과 재발 감소'입니다. 이물 혼입 클레임 1건의 처리 비용과 거래처 감사 지적에 따른 영향을 기준으로 판단합니다.", "metrics": [{"num": "개방", "desc": "출입문·도크 개방 시간 기록(유입 경로 지표)"}, {"num": "온습도", "desc": "발생 조건 사전 파악"}, {"num": "트랩 기종 확인", "desc": "접점 출력 가능 여부 사전 검토"}], "before": "주기적 방문 점검 기록. 문 개방 시간 미기록. 포획 증가 시 원인 추정.", "after": "문 개방·온습도 연속 기록. 장시간 개방 알림. 포획 기록과 대조한 원인 분석."}},
  "grow": {"snapshot": [{"label": "대상", "value": "밀폐형 재배 시설", "desc": "식물공장·버섯 재배사·육묘장"}, {"label": "측정 항목", "value": "온습도·CO₂·조도", "desc": "재배단별 편차 확인"}, {"label": "유의 사항", "value": "고습 환경", "desc": "센서 결로 대책 필요"}], "customer": {"lead": "수직농장·식물공장 운영 기업, 버섯 재배 농가와 영농조합, 육묘장, 약용작물 재배 시설, 농업 연구 기관이 대상입니다.", "paragraphs": ["밀폐형 재배 시설은 외기 영향을 차단하고 조명·공조·CO₂ 공급을 인공적으로 제어합니다. 재배단이 여러 층으로 쌓여 있어 상하 간 온도 차와 기류 편차가 생기고, 전기 요금이 운영비에서 큰 비중을 차지합니다."]}, "challenge": {"lead": "밀폐 시설은 모든 조건을 제어할 수 있지만 제어 센서가 있는 한 지점만 그 조건을 만족하는 경우가 많습니다.", "pains": [{"title": "재배단 상하 온도 차", "desc": "조명 발열과 공기 정체로 상단과 하단의 온도가 달라 생육 속도가 불균일합니다."}, {"title": "CO₂ 관리", "desc": "엽채류는 CO₂ 공급이 생육을 높이지만, 버섯은 반대로 호흡으로 쌓인 CO₂를 환기로 낮춰야 품질이 유지됩니다."}, {"title": "공조 정지", "desc": "밀폐 시설은 공조가 멈추면 조명 발열로 온도가 급상승합니다."}, {"title": "고습에 의한 장비 수명", "desc": "버섯 재배사처럼 상대습도가 매우 높은 환경은 전자 장비의 결로와 부식을 일으킵니다."}]}, "solution": {"lead": "재배단의 상·중·하단과 구역 모서리에 무선 온습도·CO₂·조도 센서를 분산 설치해 분포를 측정합니다.", "paragraphs": ["온습도 분포 데이터는 순환 팬 위치와 풍량 조정의 근거가 됩니다. 조도 센서는 조명의 점등 여부와 상대적 밝기 변화를 확인하는 용도이며, 광합성 유효 광량(PPFD)은 전용 광량계로 측정해야 합니다.", "상대습도가 포화에 가까운 구역에서는 센서 표면 결로로 측정값이 불안정해질 수 있으므로, 설치 위치와 보호 방법을 시험 설치로 확인합니다. 공조기와 가습기의 운전은 전류 센서로, 전원은 전압 감지 센서로 감시해 정지 시 즉시 문자를 보냅니다."], "sensors": ["온도", "습도", "CO₂", "조도", "전류", "전압 감지", "IoT 게이트웨이(LTE)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "한 개 재배실에서 분포를 측정해 기류를 개선한 뒤 상시 감시점을 정합니다.", "phases": [{"tag": "PHASE 1", "title": "측정 설계", "desc": "재배단 구조와 공조 방식에 맞춰 측정 지점을 정합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "시험 설치", "desc": "고습 구역에서 센서 동작과 수신 상태를 확인합니다.", "duration": "1주"}, {"tag": "PHASE 3", "title": "분포 측정·개선", "desc": "한 작기 동안 분포를 측정하고 순환 팬과 급기 위치를 조정합니다.", "duration": "1작기"}, {"tag": "PHASE 4", "title": "재배실 확대", "desc": "상시 감시점을 정해 다른 재배실에 적용합니다.", "duration": "재배실당 1일"}]}, "roi": {"lead": "효과는 '재배단 간 생육 편차 축소'와 '공조 정지 사고 회피'입니다. 수량과 품질 변화는 품종과 재배 기술의 영향을 함께 받으므로 편차 지표(온도 차)로 개선 효과를 평가합니다.", "metrics": [{"num": "ΔT", "desc": "재배단 상·하단 온도 차, 기류 개선 전후 비교 지표"}, {"num": "1주", "desc": "고습 구역 시험 설치 기간"}, {"num": "공조 정지 통보", "desc": "조명 발열에 따른 급상승 대비"}], "before": "제어기 설정값으로 관리. 재배단별 생육 차이를 수확 시 확인. 공조 정지는 순회 시 발견.", "after": "재배단·구역별 환경 분포 확보. 설비 정지 문자 알림. 기류 조정의 전후 비교."}},
  "uc-smart-farm": {"snapshot": [{"label": "목적", "value": "환기 동작 검증", "desc": "제어 지령과 실제 동작 대조"}, {"label": "신호", "value": "전류·접점·온습도", "desc": "장치 운전과 결과 환경"}, {"label": "역할", "value": "독립 감시", "desc": "제어는 기존 제어기 담당"}], "customer": {"lead": "복합환경제어기를 사용하는 시설원예 농가, 자동 환기 축사, 스마트팜 시공·유지보수 업체, 농업기술센터가 대상입니다.", "paragraphs": ["정부 보급 사업으로 환경 제어기와 자동 개폐기가 많이 설치되었으나, 장치가 노후하면서 '제어기는 열었다고 표시하는데 실제로는 열리지 않은' 사고가 발생합니다. 농가는 제어기 화면을 신뢰하고 현장을 떠나 있는 경우가 많습니다."]}, "challenge": {"lead": "자동화 설비의 사고는 자동으로 돌아간다고 믿는 동안 일어납니다.", "pains": [{"title": "개폐기 고장", "desc": "모터 과부하, 리미트 스위치 불량, 와이어 이탈로 측창·천창이 중간에 멈춥니다."}, {"title": "환기팬 벨트·모터 이상", "desc": "팬에 전원은 들어가지만 벨트가 끊어져 실제 풍량이 나오지 않는 경우가 있습니다."}, {"title": "제어 센서 오차", "desc": "제어기의 온습도 센서가 노후해 실제와 다른 값으로 제어합니다."}, {"title": "원격 확인 수단 부재", "desc": "제어기 원격 접속이 없는 구형 설비는 현장에 가야만 상태를 알 수 있습니다."}]}, "solution": {"lead": "환기 장치의 전류와 개폐 상태를 무선 센서로 직접 측정하고, 별도의 온습도 센서로 환기 결과를 확인합니다.", "paragraphs": ["환기팬과 개폐 모터의 전류는 클램프형 전류 센서로 측정합니다. 전류가 평소보다 낮으면 무부하(벨트 이탈), 높으면 과부하를 의심할 수 있습니다. 측창과 천창에는 개폐 센서나 리미트 접점을 받는 건접점 센서를 두어 실제 열림 여부를 확인합니다.", "독립 설치한 온습도·CO₂ 센서의 값이 환기 가동 후에도 변하지 않으면 장치 이상으로 판단해 문자를 보냅니다. 본 시스템은 환기 장치를 직접 제어하지 않으며, 기존 제어기의 동작을 검증하고 이상을 통보하는 역할입니다."], "sensors": ["전류", "건접점", "개폐 감지", "온도", "습도", "CO₂", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "고장 이력이 있는 개폐기와 환기팬부터 적용합니다.", "phases": [{"tag": "PHASE 1", "title": "장치 조사", "desc": "환기팬·개폐기 수량, 전원 계통, 고장 이력을 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "전류·접점·온습도 센서를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "정상 패턴 수집", "desc": "2~4주간 정상 동작 시의 전류와 환경 변화를 수집합니다.", "duration": "2~4주"}, {"tag": "PHASE 4", "title": "이상 판단 기준 설정", "desc": "정상 패턴에서 벗어나는 조건을 알림으로 설정합니다.", "duration": "1주"}]}, "roi": {"lead": "판단 기준은 '환기 실패 1회의 작물·가축 피해액'입니다. 개폐기가 닫힌 채 맑은 날 낮 시간을 보내면 고온 피해가 수 시간 안에 발생하므로 한 번의 사고 회피로 비용이 상쇄되는 경우가 많습니다.", "metrics": [{"num": "전류", "desc": "무부하·과부하 패턴으로 기계 이상 추정"}, {"num": "접점", "desc": "개폐기의 실제 열림 여부 확인"}, {"num": "지령 대 실제", "desc": "제어기 표시와 장치 동작의 대조"}], "before": "제어기 화면을 신뢰. 개폐기·팬 고장은 피해 발생 후 발견. 현장 방문으로 확인.", "after": "장치의 실제 동작을 원격 확인. 미동작·과부하 문자 알림. 독립 센서로 제어 결과 검증."}},
  "uc-greenhouse": {"snapshot": [{"label": "관리 대상", "value": "근권 환경", "desc": "토양·배지 수분, 양액 온도"}, {"label": "설비 감시", "value": "관수 펌프·급액", "desc": "전류·압력"}, {"label": "통신", "value": "LTE", "desc": "농지 현장 대응"}], "customer": {"lead": "토경·고설·수경 재배를 하는 시설원예 농가와 농업법인, 화훼 농가, 관수·양액 설비 시공 업체가 대상입니다.", "paragraphs": ["시설 재배는 관수와 양액 공급이 수량과 품질을 직접 결정합니다. 타이머 기반 관수가 여전히 많이 쓰이고 있으며, 날씨에 따라 증산량이 달라지는데도 같은 양을 공급해 과습이나 수분 부족이 생깁니다."]}, "challenge": {"lead": "지상부 환경은 눈에 보이지만 뿌리 주변의 상태는 측정하지 않으면 알 수 없습니다.", "pains": [{"title": "타이머 관수의 한계", "desc": "흐린 날과 맑은 날의 증산량 차이가 반영되지 않아 과습에 따른 뿌리 병해나 수분 스트레스가 생깁니다."}, {"title": "급액 설비 고장", "desc": "펌프 정지, 필터 막힘, 배관 파손으로 급액이 중단되면 고온기에는 수 시간 안에 시듦이 나타납니다."}, {"title": "양액 온도", "desc": "여름철 양액 온도가 오르면 용존 산소가 줄어 뿌리 활력이 떨어집니다."}, {"title": "구역 간 편차", "desc": "배관 말단과 경사에 따라 구역별 공급량이 다릅니다."}]}, "solution": {"lead": "토양 수분 센서로 근권 수분 추세를 기록하고, 관수 펌프 전류와 배관 압력으로 급액 설비의 운전을 확인합니다.", "paragraphs": ["토양 수분 센서는 뿌리가 분포한 깊이에 설치하며, 배지 종류(토양·코코피트·암면)에 따라 측정값의 해석이 달라지므로 절대값보다 관수 전후의 변화와 추세를 기준으로 삼습니다. 구역별로 설치하면 배관 말단의 공급 부족을 확인할 수 있습니다.", "양액 탱크와 배지 온도는 온도 센서로, 급액 펌프의 가동은 전류 센서로, 배관 압력 저하는 압력 센서로 감시합니다. 양액의 전기전도도(EC)와 산도(pH)는 본 구성의 측정 대상이 아니며 기존 양액기의 계측을 사용합니다."], "sensors": ["토양 수분", "온도", "전류", "압력", "누수 감지", "습도", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "한 구역에서 한 작기의 수분 추세를 확보해 관수 기준을 정합니다.", "phases": [{"tag": "PHASE 1", "title": "측정 지점 선정", "desc": "대표 구역과 배관 말단 구역을 정합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "설치", "desc": "토양 수분·온도·전류 센서와 게이트웨이를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "추세 확보", "desc": "관수 전후 수분 변화와 날씨별 차이를 기록합니다.", "duration": "1작기"}, {"tag": "PHASE 4", "title": "관수 기준 조정", "desc": "추세를 근거로 관수 횟수와 양을 조정하고 구역을 확대합니다.", "duration": "지속"}]}, "roi": {"lead": "효과는 '급액 중단 사고 회피'와 '관수량 조정에 따른 용수·양액·배액 처리 비용 절감'입니다. 수량 증가 효과는 재배 관리 전반의 영향을 받으므로 사전 수치로 약속하지 않습니다.", "metrics": [{"num": "수분", "desc": "관수 전후 변화로 관수 시점 판단"}, {"num": "전류", "desc": "급액 펌프 정지 즉시 인지"}, {"num": "구역별 비교", "desc": "배관 말단 공급 편차 확인"}], "before": "타이머와 경험으로 관수. 급액 중단은 시듦으로 발견. 구역 편차는 생육 차이로 추정.", "after": "근권 수분 추세 기록. 펌프 정지·압력 저하 문자 알림. 데이터에 근거한 관수 조정."}},
  "uc-pest-control": {"snapshot": [{"label": "방제 원리", "value": "고온 유지", "desc": "치사 온도와 유지 시간의 조합"}, {"label": "측정", "value": "다점 온도", "desc": "가장 늦게 오르는 지점 확인"}, {"label": "산출물", "value": "작업 보고서", "desc": "온도 이력 그래프"}], "customer": {"lead": "방역 전문업체(PCO), 숙박 시설과 기숙사 운영자, 제분·곡물 가공 공장, 목재·팔레트 열처리 업체가 대상입니다.", "paragraphs": ["2023년 이후 숙박 시설과 기숙사, 대중교통에서 빈대 발생이 사회적 관심사가 되면서 살충제 저항성 문제로 열처리 방제 수요가 늘었습니다. 열처리는 약제 잔류가 없으나, 공간 전체가 치사 온도에 도달했는지를 확인하지 못하면 재발합니다."]}, "challenge": {"lead": "열처리의 성패는 가장 온도가 늦게 오르는 지점이 목표 온도에 얼마나 머물렀는지에 달려 있습니다.", "pains": [{"title": "저온 사각", "desc": "매트리스 내부, 가구 뒤, 벽체 틈, 바닥 모서리는 공기 온도보다 늦게 오릅니다."}, {"title": "작업 중 확인 곤란", "desc": "고온 상태의 공간에 작업자가 들어가 온도를 확인하는 것은 안전상 제한됩니다."}, {"title": "과열에 의한 손상", "desc": "온도가 지나치게 오르면 가전제품, 마감재, 스프링클러 헤드에 영향을 줄 수 있습니다."}, {"title": "고객 증빙", "desc": "방제가 제대로 수행되었음을 고객에게 설명할 객관적 자료가 필요합니다."}]}, "solution": {"lead": "처리 공간의 사각 지점에 무선 온도 센서 또는 열전대 프로브를 배치하고 공간 밖에서 실시간으로 온도를 확인합니다.", "paragraphs": ["빈대는 50℃ 안팎 이상의 온도에 일정 시간 노출되면 사멸하는 것으로 알려져 있으며, 실제 작업의 목표 온도와 유지 시간은 방제 대상과 업체의 작업 기준에 따릅니다. 프로브는 공기 중이 아니라 매트리스 내부나 가구 틈처럼 열이 늦게 전달되는 위치에 넣습니다.", "게이트웨이는 처리 공간 밖에 두고 작업자는 외부에서 지점별 온도를 확인하며 열원과 송풍기 위치를 조정합니다. 센서 본체가 처리 온도에 직접 노출되는 경우 사용 온도 범위를 확인하고, 범위를 넘는 작업에는 본체를 외부에 두는 리드형 프로브나 K타입 열전대 센서를 사용합니다. 스프링클러 등 소방 설비 보호 조치는 작업 업체가 별도로 수행합니다."], "sensors": ["온도", "고온(K타입 열전대)", "습도", "개폐 감지", "IoT 게이트웨이(LTE)", "iMonnit Cloud(Open API·MQTT)"]}, "proposal": {"lead": "작업용 이동식 키트로 구성해 현장마다 반복 사용합니다.", "phases": [{"tag": "PHASE 1", "title": "키트 구성", "desc": "작업 규모에 맞춰 센서 수량과 프로브 종류를 정합니다.", "duration": "1주"}, {"tag": "PHASE 2", "title": "현장 배치", "desc": "처리 공간의 사각 지점에 프로브를 배치합니다.", "duration": "현장당 30분"}, {"tag": "PHASE 3", "title": "작업 중 감시", "desc": "지점별 온도를 보며 열원을 조정하고 유지 시간을 확인합니다.", "duration": "작업 시간"}, {"tag": "PHASE 4", "title": "보고서 발행", "desc": "온도 이력 그래프를 작업 보고서로 제출하고 장비를 회수합니다.", "duration": "30분"}]}, "roi": {"lead": "효과는 '재처리 방문 감소'와 '작업 품질의 증빙'입니다. 재발에 따른 무상 재시공 비율을 기준으로 절감액을 산정할 수 있습니다.", "metrics": [{"num": "50℃", "desc": "빈대 열처리에서 통용되는 치사 온도 수준(안팎 이상)"}, {"num": "다점", "desc": "가장 늦게 오르는 지점의 온도 확인"}, {"num": "유지 시간 기록", "desc": "목표 온도 이상 머문 시간"}], "before": "공기 온도 한두 지점 확인. 사각 지점 도달 여부 불명. 고객에게 구두 설명.", "after": "다점 온도 실시간 확인. 목표 온도 유지 시간 기록. 온도 이력 보고서 제출."}},
  "uc-pet-welfare": {"snapshot": [{"label": "대상", "value": "견사·수송 차량·보호소", "desc": "특수목적견, 유기동물"}, {"label": "차량 적용", "value": "차량 전원 게이트웨이", "desc": "시동 OFF 후에도 감시 유지"}, {"label": "운영 특성", "value": "소수 인력", "desc": "야간·휴일 무인"}], "customer": {"lead": "군견·경찰견·탐지견·구조견 운용 기관, 지방자치단체 동물보호센터와 위탁 보호소, 동물 수송 업체가 대상입니다.", "paragraphs": ["특수목적견은 양성에 오랜 기간과 비용이 드는 자산이며 임무 수행을 위해 차량으로 이동하는 일이 잦습니다. 지자체 동물보호센터는 수용 두수에 비해 인력이 적고 야간에는 무인으로 운영되는 곳이 많습니다."]}, "challenge": {"lead": "차량과 견사는 냉방이 멈추면 짧은 시간 안에 위험한 온도에 도달하는 밀폐 공간입니다.", "pains": [{"title": "차량 내 고온", "desc": "여름철 정차 중 시동이 꺼지거나 냉방이 멈추면 차량 내부 온도가 수 분 단위로 상승합니다."}, {"title": "견사 냉난방 정지", "desc": "야간 정전이나 설비 고장은 다음 근무 시간까지 발견되지 않습니다."}, {"title": "인력 대비 과다 수용", "desc": "보호소는 수용 동물이 많아 개체별로 세심하게 살피기 어렵습니다."}, {"title": "관리 기록 요구", "desc": "동물 복지에 대한 사회적 감시가 높아져 관리 상태의 기록이 필요합니다."}]}, "solution": {"lead": "견사와 차량 적재 공간에 무선 온습도 센서를 설치하고, 차량에는 차량 전원으로 구동하는 LTE 게이트웨이를 사용합니다.", "paragraphs": ["차량용 게이트웨이는 내장 배터리로 시동이 꺼진 뒤에도 2~3일간 동작하므로, 핸들러가 차량을 떠나 있는 동안의 온도 상승을 문자로 알릴 수 있습니다. 고온 알림은 주의와 위험 2단계로 설정합니다.", "견사는 온습도와 전압 감지 센서로 냉난방과 전원 상태를 감시합니다. 센서는 동물이 닿지 않는 높이에 고정하고 세척수에 노출되지 않게 설치합니다. 본 시스템은 환경을 알리는 장치이며 차량 냉방을 자동으로 가동하거나 문을 여는 기능은 포함하지 않습니다."], "sensors": ["온도", "습도", "전압 감지", "개폐 감지", "IoT 게이트웨이(LTE·차량 전원)", "iMonnit Scube 전용 플랫폼"]}, "proposal": {"lead": "수송 차량부터 적용하고 견사와 보호소로 넓힙니다.", "phases": [{"tag": "PHASE 1", "title": "운용 형태 확인", "desc": "차량 종류, 견사 구조, 근무 체계를 확인합니다.", "duration": "1~2일"}, {"tag": "PHASE 2", "title": "차량 설치", "desc": "차량에 센서와 게이트웨이를 설치하고 수신을 확인합니다.", "duration": "대당 1시간 내외"}, {"tag": "PHASE 3", "title": "견사·보호소 설치", "desc": "온습도·전압 감지 센서를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 4", "title": "대응 절차 수립", "desc": "알림 수신자와 단계별 조치를 정합니다.", "duration": "1주"}]}, "roi": {"lead": "도입 근거는 '대체가 어려운 특수목적견의 보호'와 '보호 동물 사고 예방'입니다. 공공 기관은 사고 발생 시의 사회적 책임을 고려해 예방 투자로 판단합니다.", "metrics": [{"num": "2~3일", "desc": "시동 OFF 후 게이트웨이 동작 시간"}, {"num": "2단계", "desc": "주의·위험 온도 알림"}, {"num": "정전 통보", "desc": "견사 냉난방 정지 조기 인지"}], "before": "핸들러와 근무자의 직접 확인. 정차 중 차량 온도 미확인. 야간 정지는 다음 날 발견.", "after": "차량·견사 온도 이탈 문자 알림. 야간 정전 통보. 환경 이력 보관."}},
  "uc-aquaculture": {"snapshot": [{"label": "고수온 특보", "value": "28℃", "desc": "고수온 주의보 발령 기준 수온"}, {"label": "최우선 위험", "value": "정전·급기 정지", "desc": "용존 산소 급감"}, {"label": "환경", "value": "염분·습기", "desc": "방식·방수 대책 필요"}], "customer": {"lead": "넙치·조피볼락·뱀장어·새우 등을 기르는 육상 수조식 양식장, 종자 생산 시설, 수산 연구 기관, 활어 보관·유통 시설이 대상입니다.", "paragraphs": ["국내 육상 양식장은 제주와 남해안, 서해안에 집중되어 있고 해수를 끌어와 순환시키는 방식이 많습니다. 여름철 고수온으로 인한 양식 생물 폐사 피해가 매년 보고되며, 수온이 28℃에 이르면 고수온 주의보가 발령됩니다."]}, "challenge": {"lead": "물속 생물은 산소 공급이 끊기면 대처할 시간이 거의 없습니다.", "pains": [{"title": "정전과 급기 정지", "desc": "수온이 높을수록 물에 녹는 산소는 줄고 생물의 산소 소비는 늘어납니다. 여름철 블로워나 펌프가 멈추면 짧은 시간에 폐사가 시작됩니다."}, {"title": "취수 펌프 고장", "desc": "해수 취수가 중단되면 수조 수위가 내려가고 수질이 급격히 나빠집니다."}, {"title": "야간 인력 공백", "desc": "양식장은 야간에 한두 명이 넓은 수조를 맡거나 무인으로 운영됩니다."}, {"title": "부식 환경", "desc": "해수와 염분으로 전기 설비의 고장이 잦습니다."}]}, "solution": {"lead": "블로워와 펌프의 전류, 수전 전압, 수조 수위와 수온을 무선 센서로 감시하고 이상 시 문자로 통보합니다.", "paragraphs": ["가장 먼저 감시할 대상은 전원과 급기입니다. 전압 감지 센서로 정전을, 전류 센서로 블로워와 순환 펌프의 실제 운전을 확인합니다. 수온은 방수 프로브를 수조에 넣어 측정하고, 수위는 플로트형 센서로 저수위를 감지합니다.", "용존 산소, 염분, 산도는 본 시스템의 기본 센서로 측정하지 않습니다. 기존 수질 계측기가 4-20mA 출력을 제공하면 전류 입력형 센서로 값을 받아 함께 기록할 수 있습니다. 해수 환경에 설치하는 센서는 방수 등급을 확인하고 프로브와 단자부에 방식 조치를 해야 하며, 게이트웨이는 염분이 직접 닿지 않는 실내에 둡니다. 비상 발전기 기동 신호는 건접점 센서로 받아 정전 시 발전기가 실제로 돌았는지를 확인합니다."], "sensors": ["온도(방수 프로브)", "전류", "전압 감지", "누수 감지 플로트", "건접점", "4-20mA 입력", "IoT 게이트웨이(LTE)"]}, "proposal": {"lead": "고수온기 전에 전원·급기 감시를 먼저 구축합니다.", "phases": [{"tag": "PHASE 1", "title": "설비 계통 확인", "desc": "수전, 비상 발전기, 블로워·펌프 계통과 수조 배치를 확인합니다.", "duration": "반나절"}, {"tag": "PHASE 2", "title": "전원·급기 감시 설치", "desc": "전압 감지·전류·건접점 센서와 게이트웨이를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 3", "title": "수온·수위 추가", "desc": "대표 수조에 수온과 수위 센서를 설치합니다.", "duration": "1일"}, {"tag": "PHASE 4", "title": "알림·대응 훈련", "desc": "야간 알림 수신과 비상 조치 절차를 점검합니다.", "duration": "1주"}]}, "roi": {"lead": "판단 기준은 '급기 정지 1회의 폐사 손실'입니다. 수조별 입식량과 출하 단가로 손실 상한을 계산할 수 있으며, 양식 재해보험의 보장 조건과 함께 검토합니다.", "metrics": [{"num": "28℃", "desc": "고수온 주의보 발령 기준 수온"}, {"num": "전류", "desc": "블로워·펌프의 실제 운전 확인"}, {"num": "발전기 기동 확인", "desc": "정전 시 실제 기동 여부"}], "before": "야간 순회와 수조 육안 확인. 정전·급기 정지는 순회 시 발견. 고수온기 상시 대기.", "after": "정전·급기·펌프 정지 문자 알림. 수온·수위 추세 기록. 비상 발전기 기동 여부 확인."}}
};

const DEFAULT_APP_DETAIL = {
  snapshot: [
    {label:"운영 방식", value:"24/7", desc:"무인 자동 모니터링"},
    {label:"알림 응답", value:"5분", desc:"평균 알림 도달 시간"},
    {label:"ROI 회수", value:"<12개월", desc:"평균 회수 기간"}
  ],
  customer: {
    lead: "산업·환경 모니터링이 필요한 다양한 규모의 조직이 이 솔루션을 도입합니다.",
    paragraphs: [
      "이 어플리케이션은 24/7 자동화된 환경 추적이 비즈니스 가치를 만들어내는 환경에 적합합니다. 작은 단위 매장부터 대규모 시설·캠퍼스까지 확장 가능합니다.",
      "기존 운영 방식이 사후 대응·수동 점검에 의존하고 있다면, IoT 기반 자동화가 가장 큰 효과를 만들어내는 영역입니다."
    ]
  },
  challenge: {
    lead: "이 영역의 공통 과제는 데이터 부재로 인한 사후 대응과 비효율 누적입니다.",
    pains: [
      {title:"수동 점검의 한계", desc:"사람이 없는 시간대의 사고를 인지할 수 없습니다."},
      {title:"데이터 기반 의사결정 부재", desc:"근거 데이터 없이 정비·운영 의사결정이 이루어집니다."},
      {title:"사고 발생 후 대응", desc:"예방이 아닌 사후 대응 비용이 누적됩니다."},
      {title:"규제·감사 대응 어려움", desc:"수동 기록만으로는 무결성 입증이 어렵습니다."}
    ]
  },
  solution: {
    lead: "Monnit 무선 센서가 측정한 데이터를 IoT 게이트웨이가 수집해 플랫폼으로 전송합니다.",
    paragraphs: [
      "센서는 940MHz 무선과 배터리로 동작해 배선 공사가 필요 없습니다. IoT 게이트웨이는 LTE 유심을 내장하고 반경 내 센서 250개를 수용하며, 정전 시에도 내장 배터리로 2~3일 동작합니다.",
      "iMonnit Express V4가 즉시 사용 가능한 대시보드와 자동 알림을 제공하며, 추가 개발 없이 운영을 시작할 수 있습니다."
    ],
    sensors: ["무선 센서", "IoT 게이트웨이(LTE)", "iMonnit Scube 전용 플랫폼"]
  },
  proposal: {
    lead: "표준 도입 절차는 2–4주 내 완료됩니다.",
    phases: [
      {tag:"PHASE 1", title:"현장 평가", desc:"센서 위치·통신 환경·기존 시스템 검토.", duration:"1주"},
      {tag:"PHASE 2", title:"설치 & 페어링", desc:"센서·게이트웨이 배치 및 클라우드 연결.", duration:"1–2주"},
      {tag:"PHASE 3", title:"운영 시작", desc:"임계값 설정·담당자 라우팅·교육.", duration:"1주"}
    ]
  },
  roi: {
    lead: "사고 1건 회피만으로도 초기 투자가 회수되는 경우가 많습니다.",
    metrics: [
      {num:"24/7",    desc:"무인 자동 모니터링"},
      {num:"5분",     desc:"평균 알림 도달 시간"},
      {num:"<12개월", desc:"평균 ROI 회수 기간"}
    ],
    before: "수동 점검에 의존. 사후 대응 운영. 감사 시 수동 보고서 작성.",
    after:  "10분 주기 자동 기록. 이상 시 문자 알림. 이력 보고서로 감사 대응 단순화."
  }
};

/* ========== APPLICATIONS RENDERING ========== */
const APP_SORTERS = {
  default:  (a, b) => 0,
  name:     (a, b) => a.name.localeCompare(b.name, "ko"),
  category: (a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name, "ko"),
  new:      (a, b) => b.added.localeCompare(a.added),
  popular:  (a, b) => b.popularity - a.popularity
};

let appsState = { category: "all", sort: "default", search: "", page: 1 };

function renderAppsCategoryBar() {
  const bar = document.getElementById('appsCategoryBar');
  const catCounts = { all: APPS.length };
  Object.keys(CATEGORIES).forEach(k => catCounts[k] = APPS.filter(a => a.cat === k).length);
  const items = [
    {id: "all", name: "전체", count: catCounts.all},
    ...Object.entries(CATEGORIES).map(([k, v]) => ({id: k, name: v.name, count: catCounts[k]}))
  ];
  bar.innerHTML = items.map(i => `
    <button class="cat-pill ${appsState.category === i.id ? 'active' : ''}" data-cat="${i.id}">
      ${i.name}<span class="count">${i.count}</span>
    </button>
  `).join('');
  bar.querySelectorAll('.cat-pill').forEach(btn => {
    btn.onclick = () => {
      appsState.category = btn.dataset.cat; appsState.page = 1;
      renderAppsCategoryBar();
      renderAppsGrid();
    };
  });
}

function renderAppsGrid() {
  const grid = document.getElementById('appsGrid');
  const title = document.getElementById('appsResultsTitle');
  const count = document.getElementById('appsResultsCount');
  let filtered = APPS.slice();
  if (appsState.category !== 'all') filtered = filtered.filter(a => a.cat === appsState.category);
  if (appsState.search) {
    const q = appsState.search.toLowerCase();
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q) ||
      (CATEGORIES[a.cat] || {}).name?.toLowerCase().includes(q)
    );
  }
  filtered.sort(APP_SORTERS[appsState.sort] || APP_SORTERS.default);
  title.textContent = appsState.category === 'all'
    ? '전체 어플리케이션'
    : CATEGORIES[appsState.category].name + ' 어플리케이션';
  count.textContent = `${filtered.length} ${appsState.search ? 'matching ' : ''}items`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="apps-empty">
        <h3>일치하는 어플리케이션이 없습니다</h3>
        <p>필터를 조정하거나 검색어를 변경해보세요.</p>
        <button onclick="resetAppsFilters()">필터 초기화</button>
      </div>
    `;
    const ep = document.getElementById('appsPager'); if (ep) ep.innerHTML = '';
    return;
  }
  const per = 12, total = filtered.length, pages = Math.ceil(total/per) || 1;
  appsState.page = Math.min(Math.max(1, appsState.page || 1), pages);
  const start = (appsState.page - 1) * per;
  grid.innerHTML = filtered.slice(start, start + per).map(a => `
    <button class="app-card ${a.cat}" data-id="${a.id}" data-file="${a.file||''}">
      <div class="app-card-top">
        <span class="app-tag ${a.cat}">${CATEGORIES[a.cat].label}</span>
        ${a.isNew ? '<span class="new-badge">● New</span>' : (a.file ? '<span class="doc-badge">↓ 자료</span>' : '')}
      </div>
      <div class="app-name">${a.name}</div>
      <div class="app-desc">${a.desc}</div>
      <div class="app-card-footer">
        <span class="app-sensors">${a.sensors}</span>
        <span class="arrow">→</span>
      </div>
    </button>
  `).join('');
  grid.querySelectorAll('.app-card').forEach(card => {
    card.onclick = () => { navigate('app/' + card.dataset.id); };
  });
  renderPager(grid, 'appsPager', total, per, appsState.page, g=>{ appsState.page=g; renderAppsGrid(); grid.scrollIntoView({behavior:'smooth',block:'start'}); });
}

function resetAppsFilters() {
  appsState = { category: 'all', sort: 'default', search: '', page: 1 };
  document.getElementById('appsSearch').value = '';
  document.getElementById('appsSort').value = 'default';
  renderAppsCategoryBar();
  renderAppsGrid();
}

document.getElementById('appsSearch').addEventListener('input', e => {
  appsState.search = e.target.value.trim(); appsState.page = 1;
  renderAppsGrid();
});
document.getElementById('appsSort').addEventListener('change', e => {
  appsState.sort = e.target.value; appsState.page = 1;
  renderAppsGrid();
});

renderAppsCategoryBar();
renderAppsGrid();

/* ========== HOME PAGE RENDERING ========== */

// Map app categories to industry-style tag classes used elsewhere
const CAT_TO_HOMETAG = {
  env:    'tag-bldg',
  cold:   'tag-food',
  health: 'tag-bio',
  indus:  'tag-mfg',
  fac:    'tag-bldg',
  agri:   'tag-edu'
};

const CAT_DESCRIPTIONS = {
  env:    "온도·습도·누수·공기질 등 실내외 환경의 모든 변수를 통합 추적.",
  cold:   "매장·차량·창고 전 구간 콜드체인 무결성을 단일 플랫폼으로.",
  health: "GMP·VFC·21 CFR Part 11 컴플라이언스를 자동화.",
  indus:  "진동·전류·온도로 라인 다운타임을 사전 차단하는 예지보전.",
  fac:    "빌딩·캠퍼스·자산의 점유·에너지·시설 통합 운영.",
  agri:   "축산·작물·아쿠아·야외 환경의 24/7 자동 모니터링."
};

function renderHomeCatCards() {
const homeCatCards = document.getElementById('homeCatCards');
if (!homeCatCards) return;   /* 2026 리디자인: 홈에서 앱 카테고리 카드 섹션 제거됨 — 컨테이너 없으면 건너뜀 */
homeCatCards.innerHTML = '';
Object.entries(CATEGORIES).forEach(([key, info]) => {
  const count = APPS.filter(a => a.cat === key).length;
  const tagClass = CAT_TO_HOMETAG[key] || 'tag-pub';
  homeCatCards.insertAdjacentHTML('beforeend', `
    <button class="cat-card" data-cat="${key}">
      <div class="cc-head">
        <span class="cc-tag ${tagClass}">${info.label}</span>
        <span class="cc-count">${count} apps</span>
      </div>
      <div class="cc-name">${info.name}</div>
      <div class="cc-desc">${CAT_DESCRIPTIONS[key] || ''}</div>
      <div class="cc-foot">
        <span class="cc-foot-label">카테고리 살펴보기</span>
        <span class="cc-arrow">→</span>
      </div>
    </button>
  `);
});
homeCatCards.querySelectorAll('.cat-card').forEach(card => {
  card.addEventListener('click', () => {
    appsState.category = card.dataset.cat; appsState.page = 1;
    appsState.search = '';
    appsState.sort = 'default';
    const searchEl = document.getElementById('appsSearch');
    if (searchEl) searchEl.value = '';
    const sortEl = document.getElementById('appsSort');
    if (sortEl) sortEl.value = 'default';
    renderAppsCategoryBar();
    renderAppsGrid();
    navigate('applications');
  });
});
}
renderHomeCatCards();

// Featured customer cases on home — pick 3 of the 6 featured with highlight results
const HOME_CASE_HIGHLIGHTS = {
  "samsung-biologics": { num: "99.8%", lbl: "GMP 환경 준수율" },
  "microsoft":          { num: "-67%",  lbl: "환경 원인 다운타임" },
  "walmart":            { num: "-32%",  lbl: "식품 폐기 손실" },
  "exxonmobil":         { num: "-45%",  lbl: "비계획 정지 시간" },
  "hyundai-motors":     { num: "+9%",   lbl: "라인 가동률" },
  "cbre":               { num: "-22%",  lbl: "운영 비용" }
};

const HOME_CASE_PICKS = ["samsung-biologics", "microsoft", "walmart"];
let HOME_CASES = [];  /* homecases 시트가 채우면 이것을 우선 사용 */

/* 고객사 로고 (메인 하단 띠) — Logos 시트 탭으로 추가/수정. 비어있으면 기존 기본 로고 유지 */
function mapLogos(rows){
  return (rows||[]).map(function(o){ return { name:(o.name||'').trim(), image:(o.image||'').trim() }; })
                   .filter(function(x){ return x.name || x.image; });
}
let _logosRendered = false;
function renderLogos(list){
  if(!list || !list.length){ dlog('[Logos] 데이터 없음'); return; }
  if(_logosRendered){ dlog('[Logos] 이미 렌더링됨 (중복 호출 방지)'); return; }
  // 흰색 통일 보장: 시트에 외부 URL(컬러) 로고가 하나라도 있으면 배포된 정적 흰색 로고 마퀴를 그대로 유지.
  // 시트를 흰색 로컬 로고(images/clogo-*.png)로 갱신한 경우에만 시트 기준으로 렌더링.
  var allLocal = list.every(function(it){ return !it.image || /^images\//.test(String(it.image)); });
  if(!allLocal){ dlog('[Logos] 외부 URL 감지 → 배포된 흰색 로고 유지(시트 무시)'); return; }
  const track = document.querySelector('.logo-marquee .logo-track');
  if(!track){ console.warn('[Logos] DOM 요소 없음'); return; }
  dlog('[Logos] 렌더링:', list.length, '개');
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const slide = it => {
    const src = it.image ? (typeof normalizeImageUrl==='function'? normalizeImageUrl(it.image) : it.image) : '';
    // 이미지 로드 실패 시 회사명을 카드 안에 표시(슬롯 폭 유지 → 마퀴 어긋남 방지)
    const onerr = "this.onerror=null;this.style.display='none';this.parentNode.classList.add('logo-fallback');this.parentNode.setAttribute('data-name',this.alt||'');";
    const img = src ? '<img src="'+esc(src)+'" alt="'+esc(it.name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="'+onerr+'">' : '';
    return '<div class="logo-slide">'+img+'<span>'+esc(it.name)+'</span></div>';
  };
  const html = list.map(slide).join('');
  track.innerHTML = html + html;
  _logosRendered = true;
  dlog('[Logos] 완료');
}

function renderHomeCases() {
const homeCases = document.getElementById('homeCases');
if (!homeCases) return;
homeCases.innerHTML = '';
let picks;
if (HOME_CASES && HOME_CASES.length) {
  picks = HOME_CASES;
} else {
  // homecases 탭이 없으면 Cases(시트) 앞 3개로 자동 구성 — 코드 하드코딩 잔재가 노출되지 않도록
  const ck = Object.keys(CASE_DATA);
  picks = (ck.length ? ck.slice(0, 3) : HOME_CASE_PICKS).map(id => ({ caseid:id }));
}
picks.forEach((p, idx) => {
  const caseId = p.caseid;
  const c = CASE_DATA[caseId] || {};
  const name = p.name || c.name || caseId;
  // 태그: 시트 industry(키 또는 라벨) → CASE_DATA → 고객사 매칭 순으로 보완
  let tagInfo = INDUSTRIES[p.industry];
  if (!tagInfo && p.industry){ const k = Object.keys(INDUSTRIES).find(k => INDUSTRIES[k].label === p.industry); if (k) tagInfo = INDUSTRIES[k]; }
  if (!tagInfo){ const cust = CUSTOMERS.find(x => x.n === name); tagInfo = cust ? INDUSTRIES[cust.i] : null; }
  const tagClass = tagInfo ? tagInfo.tag : 'tag-pub';
  const tagLabel = tagInfo ? tagInfo.label : (c.industry || '');
  const tagline = p.tagline || c.tagline || '';
  let rNum = p.resultNum, rLbl = p.resultLabel;
  if (!rNum){ const hl = HOME_CASE_HIGHLIGHTS[caseId] || (c.qs && c.qs[0]) || {}; rNum = hl.n || hl.num || ''; rLbl = hl.l || hl.lbl || ''; }
  const num = String(idx + 1).padStart(2, '0');
  const bg = p.photo || ((typeof CASE_HERO_BG !== 'undefined') ? CASE_HERO_BG[caseId] : '') || '';
  const media = `<div class="hcc-media">${bg ? `<img class="hcc-img" src="${bg}" alt="${name}" loading="lazy" onerror="this.parentElement.style.display='none';">` : ''}</div>`;
  const hasDetail = !!CASE_DATA[caseId] || !!p.link;
  homeCases.insertAdjacentHTML('beforeend', `
    <article class="home-case-card${hasDetail?'':' no-link'}" data-case="${caseId}" data-link="${p.link||''}" style="cursor:${hasDetail?'pointer':'default'}">
      ${media}
      <div class="hcc-body">
        <div class="hcc-num">CASE / ${num}</div>
        <div class="hcc-logo">${name}</div>
        <span class="hcc-tag ${tagClass}">${tagLabel}</span>
        <div class="hcc-headline">${tagline}</div>
        <div class="hcc-result">
          <div class="hcc-result-num">${rNum}</div>
          <div class="hcc-result-lbl">${rLbl}</div>
        </div>
        ${hasDetail ? '<div class="hcc-cta">케이스스터디 보기</div>' : ''}
      </div>
    </article>
  `);
});
homeCases.querySelectorAll('.home-case-card').forEach(card => {
  card.addEventListener('click', () => {
    const link = card.dataset.link;
    if (link) { window.open(link, '_blank', 'noopener'); return; }
    if (CASE_DATA[card.dataset.case]) navigate('case/' + card.dataset.case);
  });
});
}
renderHomeCases();

/* ========== APP DETAIL RENDERING ========== */
/* ═══════════════════════════════════════════════════════════════════
   준비 중 콘텐츠 안내 화면
   · 파인더에서 아직 상세 페이지가 없는 활용분야를 고른 경우에 표시합니다.
   · 빈 화면으로 튕기지 않고 상담·전화로 이어주고, 다른 콘텐츠도 안내합니다.
   · 나중에 에디터에서 해당 어플리케이션을 추가하면 이 화면은 자동으로
     사라지고 정상 상세 페이지가 열립니다 (별도 작업 불필요).
   ═══════════════════════════════════════════════════════════════════ */
function comingSoonLabel(id){
  // 파인더 설정(finder.config)에 이름이 있으면 그 이름을 씁니다
  try{
    const el=document.querySelector('[data-sc="finder.config"]');
    const raw=el?(el.textContent||'').trim():'';
    if(raw){
      const cfg=JSON.parse(raw);
      // 준비 중인 신규 어플리케이션 이름표 (finder.config 의 soon 목록)
      if(cfg.soon && cfg.soon[id]) return cfg.soon[id];
      const hit=[].concat(cfg.fac||[],cfg.con||[]).find(x=>('app/'+String(x.app||''))===('app/'+id)||String(x.id||'')===id);
      if(hit&&hit.ko) return hit.ko;
    }
  }catch(e){}
  return '';
}
/* 준비 중 화면 — 활용분야·도입사례·프로모션 등 어디서든 같은 모양으로 씁니다.
   opts = { kind, title, sub, back:[[route,라벨],...] } · 값이 없으면 활용분야 기준 기본값 */
function comingSoonHTML(opts){
  opts = opts || {};
  let lang='ko'; try{ lang=localStorage.getItem('mlang')||'ko'; }catch(e){}
  const en=(lang==='en');
  const title = opts.title || (en?'Preparing this page':'준비 중입니다');
  const sub   = opts.sub || (en
    ? 'Page in preparation. Send us your site details and we will reply with a sensor set-up and estimate within 24 hours.'
    : '상세 페이지를 준비 중입니다.<br>현장 상황을 남겨 주시면 <b>24시간 안에</b> 센서 구성과 예상 비용을 보내드립니다.');
  const back = opts.back || [['applications',en?'All applications':'전체 활용분야'],
                             ['stories',en?'Customer stories':'도입 사례'],
                             ['products',en?'Products':'제품'],['home',en?'Home':'홈']];
  return ''
    + '<div style="max-width:520px;margin:0 auto;padding:'+(opts.pad||'96px 20px 112px')+';text-align:center">'
    + '<div style="font-size:12px;letter-spacing:.16em;font-weight:700;color:var(--accent-dark,#6B9FD6);margin-bottom:18px">'
    +   (en?'IN PREPARATION':'준비 중')+'</div>'
    + '<h2 style="font-size:clamp(23px,3.6vw,30px);font-weight:800;letter-spacing:-.03em;line-height:1.35;margin:0 0 16px">'+title+'</h2>'
    + '<p style="font-size:15px;line-height:1.8;color:var(--ink-mid,#B7BECD);word-break:keep-all;margin:0 0 32px">'+sub+'</p>'
    + '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">'
    +   '<button type="button" class="cs-cta" style="display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:0 28px;border:0;border-radius:13px;background:var(--accent,#4A82C4);color:#fff;font-weight:800;font-size:16px;font-family:inherit;cursor:pointer;white-space:nowrap">'
    +     (en?'Free site review →':'무료 현장 진단 신청 →')+'</button>'
    +   '<a href="tel:02-2088-1454" style="display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:0 24px;border-radius:13px;border:1.5px solid var(--line,#26304A);color:var(--ink,#EEF1F6);font-weight:700;font-size:15px;white-space:nowrap">'
    +     (en?'Call 02-2088-1454':'전화 상담')+'</a>'
    + '</div>'
    + '<p style="font-size:12.5px;color:var(--ink-soft,#838C9E);margin:0 0 44px">'+(en?'Free of charge':'진단 무료')+'</p>'
    + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
    +   back.map(function(p){ return '<button type="button" class="cs-link" data-go="'+esc(p[0])+'" style="background:none;border:1px solid var(--line,#26304A);border-radius:999px;padding:9px 16px;font-size:13px;color:var(--ink-soft,#838C9E);cursor:pointer;font-family:inherit">'+esc(p[1])+'</button>'; }).join('')
    + '</div></div>';
}
/* 준비 중 화면의 버튼 동작 연결 (상담 폼에 맥락을 미리 채워 줍니다) */
function bindComingSoon(root, ctx){
  ctx = ctx || {};
  root.querySelectorAll('.cs-link').forEach(function(b){ b.onclick=function(){ navigate(b.dataset.go); }; });
  const c=root.querySelector('.cs-cta');
  if(c) c.onclick=function(){
    navigate('contact');
    setTimeout(function(){
      try{
        const sel=document.getElementById('c-industry')||document.getElementById('f-type');
        if(sel&&ctx.facLabel){ for(let i=0;i<sel.options.length;i++){ if(sel.options[i].text.indexOf(ctx.facLabel)>=0){ sel.selectedIndex=i; break; } } }
        const msg=document.getElementById('c-message');
        if(msg&&!msg.value&&ctx.memo) msg.value=ctx.memo;
      }catch(e){}
    },400);
  };
}

function renderComingSoon(id){
  let v=document.getElementById('view-coming');
  if(!v){
    v=document.createElement('section');
    v.className='view'; v.id='view-coming';
    (document.querySelector('main')||document.body).appendChild(v);
  }
  let lang='ko'; try{ lang=localStorage.getItem('mlang')||'ko'; }catch(e){}
  const en=(lang==='en');
  const pick=(window.MK_PICK||{});
  const facL=(pick.facLabel||'').trim();
  const conL=(pick.conLabel||'').trim();
  const name=comingSoonLabel(id);
  const both=(facL&&conL);

  /* 제목 — 파인더로 왔으면 고른 조합, 아니면 활용분야 이름 */
  const title = both ? (esc(facL)+' <em>'+esc(conL)+'</em>')
              : (name ? esc(name) : (en?'Preparing this page':'준비 중입니다'));

  v.innerHTML = '<div class="wrap">' + comingSoonHTML({ title:title }) + '</div>';
  bindComingSoon(v, { facLabel:facL, memo: both ? (facL+' · '+conL+' 관련 구성과 예상 비용 문의') : (name? name+' 관련 문의':'') });
  try{ if(window.gtag) gtag('event','coming_soon_view',{kind:'app',app_id:id,fac:pick.fac||'',con:pick.con||''}); }catch(e){}
}

/* 도입 사례가 아직 없을 때 — 같은 화면을 사례 문구로 */
function renderCaseComingSoon(id){
  let v=document.getElementById('view-coming');
  if(!v){ v=document.createElement('section'); v.className='view'; v.id='view-coming';
    (document.querySelector('main')||document.body).appendChild(v); }
  let lang='ko'; try{ lang=localStorage.getItem('mlang')||'ko'; }catch(e){}
  const en=(lang==='en');
  const cu=(typeof CUSTOMERS!=='undefined'?CUSTOMERS:[]).find(c=>String(c.key||'')===String(id));
  const nm=(cu&&cu.n)?cu.n:'';
  v.innerHTML = '<div class="wrap">' + comingSoonHTML({
    title: nm ? (esc(nm)+' <em>'+(en?'case study':'도입 사례')+'</em>') : (en?'Case study in preparation':'도입 사례를 준비 중입니다'),
    sub: en ? 'This case study is being written. Tell us about your site and we will share a similar reference and an estimate within 24 hours.'
            : '이 사례는 현재 정리 중입니다.<br>현장 상황을 남겨 주시면 <b>비슷한 사례</b>와 예상 구성을 24시간 안에 보내드립니다.',
    back: [['stories',en?'Other case studies':'다른 도입 사례'],['applications',en?'All applications':'전체 활용분야'],
           ['products',en?'Products':'제품'],['home',en?'Home':'홈']]
  }) + '</div>';
  bindComingSoon(v, { memo: nm ? (nm+' 도입 사례와 비슷한 구성 문의') : '' });
  try{ if(window.gtag) gtag('event','coming_soon_view',{kind:'case',case_id:id}); }catch(e){}
}
function renderAppDetail(id) {
  const app = APPS.find(a => a.id === id);
  if (!app) { navigate('applications'); return; }
  const det = APP_DETAILS[id] || DEFAULT_APP_DETAIL;

  document.getElementById('appd-cat-tag').innerHTML =
    `<span class="app-tag ${app.cat}">${CATEGORIES[app.cat].label}</span>`;
  document.getElementById('appd-name').textContent = app.name;
  const _descEl = document.getElementById('appd-desc');
  _descEl.textContent = app.desc;
  // 데이터시트(첨부 PDF): AppDetails 탭의 datasheet 열이 단일 출처
  const _ds = (det && det.datasheet) ? det.datasheet : '';
  const _host = _descEl.parentElement;
  const _old = _host.querySelector('.appd-datasheet'); if (_old) _old.remove();
  if (_ds) {
    _descEl.insertAdjacentHTML('afterend',
      `<a class="appd-datasheet" href="${_ds}" target="_blank" rel="noopener"
          style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:9px 16px;border-radius:8px;background:#003087;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">적용사례 다운로드 <span style="font-size:15px;">↓</span></a>`);
  }

  document.getElementById('appd-snapshot').innerHTML = (det.snapshot || []).map(s => `
    <div class="snap">
      <div class="snap-label">${s.label}</div>
      <div class="snap-value">${s.value}</div>
      <div class="snap-desc">${s.desc}</div>
    </div>
  `).join('');

  document.getElementById('appd-customer').innerHTML = `
    <p class="case-lead">${det.customer.lead}</p>
    ${det.customer.paragraphs.map(p => `<p class="muted">${p}</p>`).join('')}
  `;

  document.getElementById('appd-challenge').innerHTML = `
    <p class="case-lead">${det.challenge.lead}</p>
    <ul class="pain-list">
      ${det.challenge.pains.map(p => `<li><strong>${p.title}</strong><span>${p.desc}</span></li>`).join('')}
    </ul>
  `;

  document.getElementById('appd-solution').innerHTML = `
    <p class="case-lead">${det.solution.lead}</p>
    ${det.solution.paragraphs.map(p => `<p class="muted">${p}</p>`).join('')}
    <div class="sensor-tags">
      <div class="sensor-tags-label">함께 사용되는 Monnit 제품</div>
      ${det.solution.sensors.map(s => `<span class="sensor-tag">${s}</span>`).join('')}
    </div>
  `;

  document.getElementById('appd-proposal').innerHTML = `
    <p class="case-lead">${det.proposal.lead}</p>
    <div class="phases">
      ${det.proposal.phases.map(ph => `
        <div class="phase">
          <div class="phase-tag">${ph.tag}</div>
          <div>
            <div class="phase-title">${ph.title}</div>
            <div class="phase-desc">${ph.desc}</div>
            <div class="phase-duration"><span class="dur-k">소요</span>: <span class="dur-v">${ph.duration}</span></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('appd-roi').innerHTML = `
    <p class="case-lead">${det.roi.lead}</p>
    <div class="roi-metrics">
      ${det.roi.metrics.map(m => `
        <div class="roi-card">
          <div class="roi-num">${m.num}</div>
          <div class="roi-desc">${m.desc}</div>
        </div>
      `).join('')}
    </div>
    <div class="comparison">
      <div class="compare-row">
        <div class="compare-side before">
          <h5>Before</h5>
          <p>${det.roi.before}</p>
        </div>
        <div class="compare-side after">
          <h5>After Monnit</h5>
          <p>${det.roi.after}</p>
        </div>
      </div>
    </div>
  `;

  // INTEGRATION: render customer cards from APP_TO_CUSTOMERS
  const customerNames = APP_TO_CUSTOMERS[id] || [];
  const customerContainer = document.getElementById('appd-customers');
  const customerSection = customerContainer.closest('.app-customers-section');
  if (customerNames.length === 0) {
    customerSection.style.display = 'none';
  } else {
    customerSection.style.display = '';
    const featuredCustomerIds = ['Samsung Biologics','ExxonMobil','Walmart','Microsoft','Hyundai Motors','CBRE'];
    const cards = customerNames.map(name => {
      const cust = CUSTOMERS.find(c => c.n === name);
      if (!cust) return '';
      const isClickable = featuredCustomerIds.includes(name);
      const caseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `
        <div class="app-customer-card ${isClickable ? 'clickable' : ''}" data-case="${isClickable ? caseId : ''}">
          <div class="ac-name">${cust.n}</div>
          <div class="ac-headline">${cust.h}</div>
          ${isClickable ? '<div class="ac-link">케이스스터디 보기</div>' : ''}
        </div>
      `;
    }).join('');
    customerContainer.innerHTML = cards;
    customerContainer.querySelectorAll('.app-customer-card.clickable').forEach(card => {
      card.addEventListener('click', () => navigate('case/' + card.dataset.case));
    });
    document.getElementById('appd-customers-count').textContent =
      `${customerNames.length} customers · 1 featured case study`;
  }

  document.getElementById('appd-cta-title').innerHTML =
    `${app.name}, <em style="font-style:italic;color:var(--accent);font-weight:500;">우리 환경</em>에서 어떻게 작동할까요?`;

  renderGalleryItems(document.getElementById('appd-gallery'), (app.photos && app.photos.length) ? app.photos : getPhotos('app:' + id));
}

/* ========== FAQ ACCORDION (이벤트 위임 — 다시 그려도 동작) ========== */
const faqListEl = document.getElementById('faqList');
if (faqListEl) {
  faqListEl.addEventListener('click', e => {
    const q = e.target.closest('.faq-q');
    if (q) q.closest('.faq-item').classList.toggle('open');
  });
}

/* ========== MOBILE NAV ========== */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
/* 2026-10-27 모바일 메뉴: 화면 끝까지 덮고(뒤 페이지 버튼이 메뉴 항목처럼 보이던 문제),
   열린 동안 본문 스크롤·모니 말풍선을 잠그며, ☰ ↔ ✕ 로 닫기를 분명히 한다. */
function setMobileNav(open){
  if (!navLinks) return;
  if (open) {
    const nav = navLinks.closest('.topnav');
    const bottom = nav ? Math.round(nav.getBoundingClientRect().bottom) : 64;
    document.documentElement.style.setProperty('--m-nav-bottom', Math.max(0, bottom) + 'px');
  }
  navLinks.classList.toggle('open', open);
  document.documentElement.classList.toggle('m-nav-open', open);
  if (navToggle){
    navToggle.textContent = open ? '✕' : '☰';
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (!open) document.querySelectorAll('.nav-item.m-open').forEach(i => i.classList.remove('m-open'));
}
if (navToggle) {
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-controls', 'navLinks');
  navToggle.addEventListener('click', () => setMobileNav(!navLinks.classList.contains('open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && navLinks.classList.contains('open')) setMobileNav(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 920 && navLinks.classList.contains('open')) setMobileNav(false); });
  /* 뒤로 가기·주소 이동으로 화면이 바뀌어도 메뉴가 남지 않게 */
  window.addEventListener('popstate', () => setMobileNav(false));
}

/* 문의 페이지 — 이메일·전화 복사 버튼 */
document.addEventListener('click', e => {
  const b = e.target.closest('.ci-copy');
  if (!b) return;
  const val = b.getAttribute('data-copy') || '';
  const t = b.querySelector('.ci-copy-t');
  const en = document.documentElement.lang === 'en';
  const done = () => {
    b.classList.add('is-done');
    if (t) t.textContent = en ? 'Copied' : '복사됨';
    clearTimeout(b._ciT);
    b._ciT = setTimeout(() => { b.classList.remove('is-done'); if (t) t.textContent = en ? 'Copy' : '복사'; }, 1600);
  };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = val; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(_){}
    ta.remove(); done();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(val).then(done, fallback);
  else fallback();
});
// On mobile, tapping a dropdown parent opens its submenu instead of navigating
document.querySelectorAll('.nav-link.has-caret').forEach(btn => {
  btn.addEventListener('click', e => {
    if (window.innerWidth <= 920) {
      e.preventDefault();
      btn.closest('.nav-item').classList.toggle('m-open');
    }
  });
});
// Close mobile menu after choosing any nav target
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => setMobileNav(false));
});

/* ========== 현장 사진 갤러리 (브라우저 저장) ========== */
/* ============================================================
   현장 사진 (Field Photos) — 본문 직접 삽입 방식
   ------------------------------------------------------------
   · 브라우저에 업로드/저장하지 않습니다. 사진은 본문 콘텐츠로 직접 들어갑니다.
   · 아래 PHOTOS 기본값에 넣거나, 구글 시트(Photos 탭)에서 추가·수정할 수 있습니다.
   · key 형식:  케이스스터디 → "case:<케이스 id>"  /  어플리케이션 → "app:<앱 id>"
   · 각 사진은 { src, caption } 형태 (src 는 이미지 URL 또는 data URL)
   ============================================================ */
let PHOTOS = {  /* 기본값 — 구글 시트(Photos 탭)가 있으면 해당 key 를 덮어씀 */
  // 예시) 'case:us-army': [
  //   { src:'https://.../army-1.jpg', caption:'기지 내 전략 자산 모니터링 노드 설치' },
  // ],
  // 예시) 'app:vaccine': [ { src:'https://.../vaccine-1.jpg', caption:'백신 보관고 센서 설치' } ],
};

function getPhotos(key){ return PHOTOS[key] || []; }

/* "url::caption||url2::caption2" 또는 "url||url2" → [{src,caption}] */
function parsePhotos(str){
  if (!str) return [];
  return String(str).split('||').map(s => s.trim()).filter(Boolean).map(s => {
    const idx = s.indexOf('::');
    return idx >= 0 ? { src: normalizeImageUrl(s.slice(0, idx).trim()), caption: s.slice(idx + 2).trim() }
                    : { src: normalizeImageUrl(s), caption: '' };
  }).filter(p => p.src);
}

/* 사진 배열을 본문에 렌더링. 없으면 섹션을 숨김. */
function renderGalleryItems(container, photos){
  if (!container) return;
  const section = container.closest('.photo-section');
  if (!photos || !photos.length){
    if (section) section.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  if (section) section.style.display = '';
  container.innerHTML = `
    <div class="ph-grid">
      ${photos.map((ph,i)=>`
        <figure class="ph-item">
          <img src="${ph.src}" alt="${(ph.caption||('현장 사진 '+(i+1)))}" loading="lazy">
          ${ph.caption ? `<figcaption class="ph-cap">${ph.caption}</figcaption>` : ''}
        </figure>`).join('')}
    </div>`;
}
function renderPhotoGallery(container, key){ renderGalleryItems(container, getPhotos(key)); }


/* ── 이메일·전화번호 검사 (valid.js) ─────────────────────────────
   valid.js 가 늦게 뜨거나 빠져도 최소한의 형식은 보도록 대비해 둔다. */
function mkCheckEmail(v, el) {
  const V = window.MonnitValid;
  const r = V ? V.email(v)
              : { ok: /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(v || '').trim()) };
  if (!r.ok) { alert(r.message || '올바른 이메일 주소를 입력해 주세요.'); if (el) el.focus(); }
  return r;
}
function mkCheckPhone(v, el, required) {
  const V = window.MonnitValid;
  if (!V) return { ok: true };
  const r = V.phone(v, { required: !!required });
  if (!r.ok) { alert(r.message || '연락처를 확인해 주세요.'); if (el) el.focus(); }
  return r;
}

/* ========== FORM HANDLERS (실제 발송) ========== */
async function subscribeMsg(id) {
  const el = document.getElementById(id);
  const v = el ? el.value.trim() : '';
  if (!mkCheckEmail(v, el).ok) return;
  const kind = (id === 'wpEmail') ? '백서 신청' : '뉴스레터 구독';
  const btn = el.parentElement ? el.parentElement.querySelector('button') : null;
  const _type = (id === 'wpEmail') ? 'doc_request' : 'subscribe';
  const _page = (id === 'wpEmail') ? 'proposal_quick' : 'newsletter';
  let _p = { 구분: kind, 이메일: v };
  _p = window.MonnitLead ? window.MonnitLead.build(_type, _page, kind, _p)
                         : Object.assign(_p, { _subject: '[모넷코리아 웹사이트] ' + kind, 출처: location.href });
  const ok = await sendLead(_p, btn);
  if (ok === true && window.MonnitLead) window.MonnitLead.track(_type, { page: _page, interest: kind });
  if (ok === true) {
    alert(kind + '이 접수되었습니다. 감사합니다!\n(' + v + ')');
    el.value = '';
  } else if (ok === 'mailto') {
    alert('메일 앱이 열립니다. 내용이 자동 입력되어 있으니 [보내기]를 누르면 완료됩니다.');
    el.value = '';
  } else {
    alert('전송에 실패했습니다. 잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }
}
/* ===== 백서 신청: 드롭다운에서 백서 선택 → 이메일 입력 시 다운로드 제공 ===== */
/* 백서 폼의 「우리 현장 맞춤 제안서도 받기」 — js/proposal-addon.js 를 처음 열 때만 불러온다 */
const WP_FAC = [[/데이터센터|IDC|전산/, 'datacenter'], [/공장|예지보전|진동|제조|Modbus/i, 'factory'], [/건설|토목/, 'construction'],
  [/UPS|ESS|전력|에너지|발전/, 'energy'], [/콜드체인|물류|창고/, 'logistics'], [/제약|바이오|의약|초저온|병원/, 'pharma'],
  [/호텔|리조트|FM|시설관리|빌딩|HVAC/, 'commercial'], [/학교|교육|대학|캠퍼스|급식/, 'edu'], [/소상공인|자영업|점포|무인/, 'smallbiz'], [/공공|국방|교회|요양|시니어/, 'public'], [/리테일|매장|외식|식품/, 'food'],
  [/농업|골프|토양/, 'agri']];
const WP_CON = [[/화재|소방/, 'fire'], [/누수|동파/, 'leak'], [/콜드체인|냉장|냉동|초저온/, 'cold'], [/예지보전|진동/, 'equip'],
  [/UPS|ESS|전력/, 'power'], [/Modbus|연동|통합/i, 'control'], [/온도|습도/, 'temp']];
function wpPickedTitle(){ const s = document.getElementById('wpSelect'); const w = s && WHITEPAPERS[s.value]; return w ? w.title : ''; }
function wpHint(list){ const t = wpPickedTitle(); const hit = list.find(x => x[0].test(t)); return hit ? hit[1] : ''; }
function wpPropMount(){
  const slot = document.getElementById('wpPropSlot');
  if (!slot || slot.dataset.on) return;
  slot.dataset.on = '1';
  const go = function(){
    if (!window.MKPropAddon) return;
    window.__wpProp = window.MKPropAddon.mount(slot, { theme: 'site', page: 'whitepaper',
      doc: wpPickedTitle, fac: function(){ return wpHint(WP_FAC); }, con: function(){ return wpHint(WP_CON); } });
  };
  if (window.MKPropAddon) return go();
  const s = document.createElement('script'); s.src = '/js/proposal-addon.js?v=5'; s.async = true; s.onload = go;
  s.onerror = function(){ slot.dataset.on = ''; };
  document.head.appendChild(s);
}
function populateWpSelect(){
  const sel = document.getElementById('wpSelect'); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">받아보실 제안서를 선택하세요</option>' +
    WHITEPAPERS.map((w,i) => `<option value="${i}">${esc(w.title)}</option>`).join('');
  if (cur !== '' && WHITEPAPERS[cur]) sel.value = cur;
}
function pickWhitepaper(i){
  const sel = document.getElementById('wpSelect');
  if (sel) sel.value = String(i);
  const band = document.querySelector('#view-whitepaper .band');
  if (band){
    band.scrollIntoView({ behavior:'smooth', block:'center' });
    band.classList.add('band-flash');
    setTimeout(() => band.classList.remove('band-flash'), 1300);
  }
  const em = document.getElementById('wpEmail');
  if (em) setTimeout(() => em.focus({ preventScroll:true }), 450);
}
function wpClear(sel, co, nm, em, ph){
  [co, nm, em, ph].forEach(function(e){ if (e) e.value = ''; });
  if (sel) sel.value = '';
}
/* 연타 방지 — 요청이 끝날 때까지 버튼을 잠근다.
   (2026-09-17 확인: 세 번 누르면 자료 링크 6건·리드 3건·맞춤 제안서 3건이 접수됐다) */
let _wpBusy = false;
async function wpRequest(){
  if (_wpBusy) return;
  _wpBusy = true;
  const b = document.getElementById('wpSubmit');
  if (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); }
  try { await wpRequestRun(); }
  finally {
    _wpBusy = false;
    if (b) { b.disabled = false; b.removeAttribute('aria-busy'); }
  }
}
async function wpRequestRun(){
  const sel = document.getElementById('wpSelect');
  const em  = document.getElementById('wpEmail');
  const co  = document.getElementById('wpCompany');
  const nm  = document.getElementById('wpName');
  const ph  = document.getElementById('wpPhone');
  const idx = sel ? sel.value : '';
  const v   = em ? em.value.trim() : '';
  const _co = co ? co.value.trim() : '';
  const _nm = nm ? nm.value.trim() : '';
  const _ph = ph ? ph.value.trim() : '';

  /* ── 전 항목 필수 ────────────────────────────────────────────────
     2026-09-07 이전에는 「제안서 선택 + 이메일」 두 칸이 전부였다.
     그래서 이름·회사·연락처가 통째로 빈 리드가 21건 쌓였고, 영업이
     연락할 방법이 없었다. 이제 네 항목을 모두 채워야 PDF 를 내준다.
     검증은 sendpw 호출 「전」에 있어야 한다 — 뒤에 두면 자료는
     이미 나간 뒤라 막는 의미가 없다. */
  if (idx === '' || !WHITEPAPERS[idx]) { alert('받아보실 제안서를 먼저 선택해 주세요.'); if (sel) sel.focus(); return; }
  if (!_co) { alert('회사명을 입력해 주세요.');   if (co) co.focus(); return; }
  if (!_nm) { alert('담당자명을 입력해 주세요.'); if (nm) nm.focus(); return; }
  if (!mkCheckEmail(v, em).ok) return;
  if (!_ph) { alert('연락처를 입력해 주세요.');   if (ph) ph.focus(); return; }
  if (!mkCheckPhone(_ph, ph, true).ok) return;
  if (window.__wpProp && !window.__wpProp.check()) return;
  const wp = WHITEPAPERS[idx];

  /* ── 다운로드 주소는 브라우저가 갖고 있지 않다 ──────────────────────────
     예전에는 시트 url 열을 그대로 열었기 때문에 개발자도구만 열면 16개 주소가
     전부 노출됐고, 이메일 입력이 아무것도 막지 못했다.
     이제 PDF 는 저장소 proposals/ 안에 있고 공개 경로가 없다(_redirects 로 차단).
     sendpw 가 이메일을 확인한 뒤 10분짜리 서명 링크를 1건만 발급한다.
     같은 도메인 첨부파일 응답이라 새 창 없이 바로 저장된다(팝업 차단 무관). */
  const _body = JSON.stringify({ token: PW_MAIL_TOKEN, email: v, title: wp.title });
  const _post = (u) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: _body });

  let _res = null;
  try {
    let r = await _post(PW_MAIL_URL || '/api/fn/sendpw');
    if ((r.status === 404 || r.status === 405) && PW_MAIL_URL !== '/api/fn/sendpw') r = await _post('/api/fn/sendpw');
    _res = await r.json().catch(() => null);
  } catch (e) { _res = null; }

  const dl = (_res && _res.ok && _res.url) ? _res.url : '';
  if (dl) {
    try {
      const a = document.createElement('a');
      a.href = dl; a.download = wp.dlname || '';
      a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); }, 1500);
    } catch (e) { try { window.open(dl, '_blank', 'noopener'); } catch (_) { location.href = dl; } }
  } else {
    const code = _res && _res.error;
    alert(code === 'not_ready'
      ? '해당 제안서는 준비 중입니다. 잠시 후 다시 시도해 주세요.'
      : '지금은 다운로드를 준비할 수 없습니다.\n잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }

  /* 리드 기록 (다운로드 성패와 무관하게 남긴다) */
  const btn = document.getElementById('wpSubmit') || ((sel && sel.parentElement) ? sel.parentElement.querySelector('button') : null);
  let _p = { 구분: '제안서 신청', 백서명: wp.title, 관심분야: wp.title,
             회사명: _co, 담당자명: _nm, 이메일: v, 연락처: _ph };
  _p = window.MonnitLead ? window.MonnitLead.build('doc_request', 'proposal', wp.title + ' 제안서', _p)
                         : Object.assign(_p, { _subject: '[모넷코리아 웹사이트] 제안서 신청 — ' + wp.title, 출처: location.href });
  const ok = await sendLead(_p, btn);
  if (ok === true && window.MonnitLead) window.MonnitLead.track('doc_request', { page: 'proposal', interest: wp.title });

  /* 「맞춤 제안서도 받기」를 골랐으면 같은 입력값으로 접수 — 자료 전달과 따로 간다 */
  let _prop = null;
  if (window.__wpProp && window.__wpProp.wanted()) {
    _prop = await window.__wpProp.send({ company: _co, name: _nm, email: v, phone: _ph });
    window.__wpProp.result(_prop, document.getElementById('wpPropRes'));
    if (_prop && _prop.ok) window.__wpProp.reset();
  }

  if (!dl) return;
  if (ok === true) {
    alert('「' + wp.title + '」 신청이 접수되었습니다.\n다운로드가 새 창에서 시작됩니다.\nPDF는 비밀번호 없이 바로 열람하실 수 있으며, 안내 메일을 ' + v + ' 로 보내드렸습니다.' + (_prop && _prop.ok && _prop.token ? '\n\n맞춤 제안서도 접수되었습니다. 담당자 확인 후 접수 1시간 이내에 보내드립니다.' : ''));
    wpClear(sel, co, nm, em, ph);
  } else if (ok === 'mailto') {
    alert('다운로드가 시작되었습니다.\n메일 앱이 열리면 [보내기]를 눌러 신청을 완료해 주세요.');
    wpClear(sel, co, nm, em, ph);
  } else {
    alert('다운로드는 시작되었습니다. 신청 접수 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }
}
function toggleOtherField(selectId, otherId){
  const sel = document.getElementById(selectId);
  const other = document.getElementById(otherId);
  if (!sel || !other) return;
  const show = sel.value === '기타';
  other.style.display = show ? 'block' : 'none';
  if (show) other.focus(); else other.value = '';
}
/* 맞춤 제안서 → 「현장 전체 견적 요청」 — /contact?quote=제안번호&qc=회사&qn=성함&qt=과제
   상담 폼을 견적 요청으로 채워 둡니다(한 번만). 주소의 값은 채운 뒤 지웁니다. */
function applyContactQuote(){
  try{
    const Q = new URLSearchParams(location.search);
    const no = (Q.get('quote') || '').slice(0, 40);
    if (!no) return;
    const box = document.getElementById('view-contact'); if (!box) return;
    const en = document.documentElement.getAttribute('lang') === 'en';
    const isNo = /^MK-P[\w-]{4,30}$/.test(no);
    /* 회사·성함은 주소가 아니라 이 탭 저장소에서만 받는다(개인정보가 주소·분석 도구에 남지 않게) */
    let q = {};
    try { q = JSON.parse(sessionStorage.getItem('mk_quote') || '{}') || {}; } catch(e) { q = {}; }
    if (q.no !== no) q = {};
    const set = (id, v) => { const e = document.getElementById(id); if (e && v && !e.value) e.value = String(v).slice(0, 60); };
    set('ctCompany', q.company); set('ctName', q.name);
    const inq = document.getElementById('ctInquiry');
    if (inq) { const o = [].find.call(inq.options, x => x.text === '견적' || x.text === 'Quote' || x.value === '견적'); if (o) { inq.value = o.value; inq.dispatchEvent(new Event('change')); } }
    const msg = document.getElementById('ctMsg');
    if (msg && box.dataset.quote !== no) {
      const topic = String(q.topic || '').slice(0, 60);
      msg.value = isNo
        ? (en ? `[Full-site quote request] I received custom proposal ${no}${topic ? ' (focused on "' + topic + '")' : ''}. I'd like a configuration, quantities and a quote for our whole site, including other challenges.\n\n- Site / facility:\n- Other challenges to cover:\n- Equipment list or floor plan available:\n`
              : `[현장 전체 견적 요청] 맞춤 제안서(${no}${topic ? ', 「' + topic + '」 기준' : ''})를 받았습니다. 다른 과제와 현장 전체 구성·수량·견적을 요청드립니다.\n\n- 현장·시설:\n- 추가로 보고 싶은 과제:\n- 설비 목록·도면 여부:\n`)
        : (en ? `[Quote request] I'd like a configuration, quantities and a quote covering several challenges across our site.\n\n- Site / facility:\n- Challenges to cover:\n- Equipment list or floor plan available:\n`
              : `[견적 요청] 여러 과제와 현장 전체 구성·수량·견적을 요청드립니다.\n\n- 현장·시설:\n- 보고 싶은 과제:\n- 설비 목록·도면 여부:\n`);
      box.dataset.quote = no;
    }
    /* 견적 요청은 상담으로 받는다 — 제안서 받기 선택은 끈다 */
    const cons = document.querySelector('input[name="ctMode"][value="consult"]');
    if (cons && !cons.checked) { cons.checked = true; cons.dispatchEvent(new Event('change', { bubbles: true })); }
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'quote_request_view', proposal_no: isNo ? no : '', from: isNo ? 'proposal' : 'proposal_scope' }); } catch(x){}
    Q.delete('quote');
    const qs = Q.toString();
    history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : ''));
    if (msg) setTimeout(() => { msg.focus({ preventScroll: true }); msg.setSelectionRange(msg.value.length, msg.value.length); msg.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 160);
  }catch(e){}
}

/* ── 「내 맞춤 제안서」 돌아가기 버튼 — 사례 페이지 등 다른 화면에 있어도 한 번에 돌아온다 ──
   · 사례를 누르고 나간 경우(mk_prop_back) → 신청 화면 또는 진행 현황으로
   · 이 탭에서 신청한 적이 있으면(mk_prop_t) → 진행 현황으로 (닫으면 이 탭에서는 다시 안 뜸) */
function proposalPill(target){
  try{
    let el = document.getElementById('mkReturn');
    const ss = window.sessionStorage;
    const back = ss.getItem('mk_prop_back');
    const has = ss.getItem('mk_prop_t') && ss.getItem('mk_prop_pill_off') !== '1';
    const onProposal = /^proposal([\/-]|$)/.test(String(target || ''));
    const dest = back || (has ? 'proposal/status' : '');
    if (onProposal || !dest) { if (el) el.hidden = true; return; }
    const en = document.documentElement.getAttribute('lang') === 'en';
    if (!el) {
      el = document.createElement('div');
      el.id = 'mkReturn'; el.className = 'mk-return';
      el.setAttribute('role', 'region');
      el.innerHTML = '<a class="mk-return-go" href="/proposal/status"><span class="mk-return-dot" aria-hidden="true"></span><span class="mk-return-t"></span></a><button type="button" class="mk-return-x" aria-label="닫기">×</button>';
      document.body.appendChild(el);
      el.addEventListener('click', function(e){
        if (e.target.closest('.mk-return-x')) { ss.setItem('mk_prop_pill_off', '1'); ss.removeItem('mk_prop_back'); el.hidden = true; return; }
        const a = e.target.closest('.mk-return-go'); if (!a || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        const r = a.dataset.route;
        try { (window.dataLayer = window.dataLayer || []).push({ event: 'proposal_return_click', to: r }); } catch(x){}
        try { history.pushState({ route: r }, '', '/' + r); } catch(x){}
        navigate(r);
      });
    }
    const a = el.querySelector('.mk-return-go');
    a.dataset.route = dest; a.setAttribute('href', '/' + dest);
    el.querySelector('.mk-return-t').textContent = dest === 'proposal'
      ? (en ? 'Back to my proposal request' : '맞춤 제안서 신청으로 돌아가기')
      : (en ? 'My proposal status' : '내 맞춤 제안서 진행 현황');
    el.querySelector('.mk-return-x').setAttribute('aria-label', en ? 'Close' : '닫기');
    el.setAttribute('aria-label', en ? 'Return to your custom proposal' : '맞춤 제안서로 돌아가기');
    el.hidden = false;
  }catch(e){}
}
window.addEventListener('monnit:langchange', function(){ const v = document.querySelector('.view.active'); proposalPill(v ? v.id.replace(/^view-/, '') : ''); });
document.addEventListener('click', function(e){
  const a = e.target.closest && e.target.closest('[data-nav-quote]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  try { history.pushState({ route:'contact' }, '', a.getAttribute('href')); } catch(x){}
  navigate('contact');
});
/* 상담 폼 — 「상담만 / 맞춤 제안서도 받기」 */
function ctPropMode(){ const r = document.querySelector('input[name="ctMode"]:checked'); return r ? r.value : 'consult'; }
(function bindCtProp(){
  const box = document.getElementById('ctProp'); if (!box) return;
  const more = document.getElementById('ctPropMore'), btn = document.getElementById('ctSubmit');
  box.addEventListener('change', function(e){
    if (e.target.name !== 'ctMode') return;
    box.querySelectorAll('.ct-prop-seg label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    const on = ctPropMode() === 'proposal';
    if (more) more.hidden = !on;
    if (btn) btn.textContent = on ? '상담 신청 + 맞춤 제안서 받기' : '상담 신청 보내기';
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'proposal_contact_toggle', mode: ctPropMode() }); } catch(x){}
    if (on) ensureProposal();   /* 미리 불러 두면 제출 뒤 화면 전환이 빠릅니다 */
  });
  box.addEventListener('click', function(e){
    const b = e.target.closest('#ctPropChips button'); if (!b) return;
    /* 무료 제안서는 가장 고민되는 주제 하나 — 다른 칩을 누르면 바뀐다 */
    const on = b.getAttribute('aria-pressed') !== 'true';
    box.querySelectorAll('#ctPropChips button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
  });
})();
function contactProposal(body, btn){
  return new Promise(function(resolve){
    ensureProposal(function(M){
      M.fromContact(body, btn).then(function(r){
        if (!r || !r.ok) { resolve(false); return; }
        try {
          if (window.MonnitLead) {
            window.MonnitLead.build('contact', 'contact_page', '상담 신청 + 맞춤 제안서 — ' + body.name, {
              구분: '상담 신청(맞춤 제안서)', 회사명: body.company, 담당자명: body.name, 이메일: body.email, 전화번호: body.phone,
              산업군: body.industryText, 문의항목: body.inquiry, 문의내용: body.memo
            });
            window.MonnitLead.setNotified(true);
            window.MonnitLead.track('contact', { page: 'contact_page', interest: '맞춤 제안서' });
          }
        } catch(e){}
        ['ctCompany','ctName','ctEmail','ctPhone','ctMsg','ctFacility','ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.value=''; });
        resolve(true);
        M.goStatus(r);
      });
    });
    setTimeout(function(){ resolve(false); }, 20000);
  });
}
async function contactSubmit() {
  const company = (document.getElementById('ctCompany')||{}).value || '';
  const name = (document.getElementById('ctName')||{}).value || '';
  const email = (document.getElementById('ctEmail')||{}).value || '';
  const phone = (document.getElementById('ctPhone')||{}).value || '';
  let industry = (document.getElementById('ctIndustry')||{}).value || '';
  let inquiry = (document.getElementById('ctInquiry')||{}).value || '';
  const industryOther = (document.getElementById('ctIndustryOther')||{}).value || '';
  const inquiryOther = (document.getElementById('ctInquiryOther')||{}).value || '';
  if (industry === '기타' && industryOther.trim()) industry = '기타: ' + industryOther.trim();
  if (inquiry === '기타' && inquiryOther.trim()) inquiry = '기타: ' + inquiryOther.trim();
  const msg = (document.getElementById('ctMsg')||{}).value || '';
  /* 회사명·담당자명을 한 칸에 받던 시절에는 원장에서 둘을 갈라내지 못해
     상담 신청 5건이 전부 「담당자 없음」으로 들어왔다. 칸을 나누고 둘 다 필수로 둔다.
     연락처도 필수다 — 이메일만으로는 회신이 늦다. */
  if (!company.trim()) { alert('회사명을 입력해 주세요.'); const e0=document.getElementById('ctCompany'); if(e0) e0.focus(); return; }
  if (!name.trim()) { alert('담당자명을 입력해 주세요.'); const e1=document.getElementById('ctName'); if(e1) e1.focus(); return; }
  if (!mkCheckEmail(email, document.getElementById('ctEmail')).ok) return;
  if (!phone.trim()) { alert('전화번호를 입력해 주세요.'); const e2=document.getElementById('ctPhone'); if(e2) e2.focus(); return; }
  if (!mkCheckPhone(phone, document.getElementById('ctPhone'), true).ok) return;
  if (industry === '기타' && !industryOther.trim()) { alert('산업군을 직접 입력해 주세요.'); return; }
  if (inquiry === '기타' && !inquiryOther.trim()) { alert('문의 항목을 직접 입력해 주세요.'); return; }
  const btn = document.querySelector('#view-contact .form-btn');
  /* 「맞춤 제안서도 받기」 — 제안서 서버가 접수·담당자 알림을 맡고, 사이트 원장에는 알림 없이 한 줄만 남깁니다(메일 2통 방지) */
  if (typeof ctPropMode === 'function' && ctPropMode() === 'proposal') {
    const cs = document.getElementById('ctPropConsent');
    if (!cs || !cs.checked) { alert('맞춤 제안서를 받으시려면 개인정보 이용에 동의해 주세요.'); if (cs) cs.focus(); return; }
    const done = await contactProposal({
      company: company.trim(), name: name.trim(), email: email.trim(), phone: phone.trim(),
      industryText: industry, inquiry: inquiry, memo: msg.trim(),
      facility: ((document.getElementById('ctFacility')||{}).value || '').trim(),
      concerns: [].map.call(document.querySelectorAll('#ctPropChips [aria-pressed="true"]'), b => b.dataset.c)
    }, btn);
    if (done) return;
    /* 제안서 접수가 안 되면 아래 일반 상담 접수로 이어갑니다 — 상담 신청은 잃지 않습니다 */
  }
  let _p = {
    구분: '상담 신청', 회사명: company.trim(), 담당자명: name.trim(),
    이메일: email.trim(), 전화번호: phone.trim(),
    산업군: industry, 문의항목: inquiry, 문의내용: msg.trim()
  };
  _p = window.MonnitLead ? window.MonnitLead.build('contact', 'contact_page', '상담 신청 — ' + name.trim() + (inquiry ? ' / ' + inquiry : ''), _p)
                         : Object.assign(_p, { _subject: '[모넷코리아 웹사이트] 상담 신청 — ' + name.trim(), 출처: location.href });
  const ok = await sendLead(_p, btn);
  if (ok === true && window.MonnitLead) window.MonnitLead.track('contact', { page: 'contact_page', interest: inquiry || '상담' });
  if (ok === true) {
    alert('상담 신청이 접수되었습니다. 빠르게 연락드리겠습니다!');
    ['ctCompany','ctName','ctEmail','ctPhone','ctMsg','ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.value=''; });
    ['ctIndustry','ctInquiry'].forEach(i => { const e=document.getElementById(i); if(e) e.selectedIndex=0; });
    ['ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.style.display='none'; });
  } else if (ok === 'mailto') {
    alert('메일 앱이 열립니다. 내용이 자동 입력되어 있으니 [보내기]를 누르면 상담 신청이 완료됩니다.');
    ['ctCompany','ctName','ctEmail','ctPhone','ctMsg','ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.value=''; });
    ['ctIndustry','ctInquiry'].forEach(i => { const e=document.getElementById(i); if(e) e.selectedIndex=0; });
    ['ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.style.display='none'; });
  } else {
    alert('전송에 실패했습니다. 잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }
}

/* ============================================================
   ========== 자료실 & 지원 (RESOURCES / SUPPORT) 데이터 ==========
   아래 기본값은 구글 시트의 해당 탭이 있으면 덮어써집니다.
   ============================================================ */
let BLOG = [
  { date:'2026.01.08', title:'신형 ALTA Ethernet Gateway 4K 출시', body:'게이트웨이 1대로 최대 4,000개 센서를 통합 관리하는 차세대 이더넷 게이트웨이가 공개되었습니다. 캠퍼스·대규모 공장 배포가 단일 인프라로 가능해집니다.', thumb:'◐', url:'https://blog.naver.com/monnitkorea' },
  { date:'2026.05.31', title:'진동 센서로 설비 고장 예측하기', body:'Velocity RMS와 Acceleration RMS의 관계를 활용해, 축별 주파수만으로도 다른 측정값을 추론하는 예지보전 실무 노하우를 정리했습니다.', thumb:'〜', url:'https://blog.naver.com/monnitkorea' },
  { date:'2025.10.24', title:'겨울철 설비 동파, 스마트하게 막는 법', body:'온도·누수 센서를 결합한 조기 경보로 한파 시즌의 배관 동파와 누수 피해를 예방하는 방법을 소개합니다.', thumb:'◇', url:'https://blog.naver.com/monnitkorea' }
];
let PROMOS = [];

/* 프로모션 카드 이미지 폴백 — 시트(CMS) 이미지가 깨지면 내장 로컬 이미지로,
   그것도 없으면 깨진 아이콘 대신 자연스럽게 숨깁니다 */
window.__promoImgFallback = function(img, id){
  try{
    var b = (typeof BUILTIN_PROMOS !== 'undefined') && BUILTIN_PROMOS.find(function(x){ return x.id === id; });
    var alt = b && b.image;
    if (alt && !img.dataset.fb && img.getAttribute('src') !== alt){ img.dataset.fb = '1'; img.src = alt; return; }
  }catch(e){}
  /* 대체 이미지가 없으면 빈 칸 대신 기본 아이콘 상자로 */
  var box = img.parentNode;
  if (box && box.classList && box.classList.contains('has-img')) { box.classList.remove('has-img'); box.textContent = '◐'; return; }
  img.style.display = 'none';
};
/* 외부 사이트에서 막힌 이미지(핫링크 차단 등) — 깨진 그림 아이콘 대신 자리만 남긴다 (2026-10-14) */
document.addEventListener('error', function(e){
  var t = e.target;
  if (!t || t.tagName !== 'IMG' || t.dataset.fb || t.getAttribute('onerror')) return;
  try { if (new URL(t.src, location.href).origin === location.origin) return; } catch(x){ return; }
  t.dataset.fb = '1'; t.style.visibility = 'hidden';
}, true);
/* ── 사이트 내장 프로모션 ─────────────────────────────────────────────
   Promotions 시트에 행이 없어도 프로모션 목록에 항상 노출됩니다.
   시트에 같은 id(consulting) 행을 추가하면 시트 값이 우선 적용됩니다.
   내리고 싶으면 아래 배열을 [] 로 비우세요. */
const BUILTIN_PROMOS = [{
  /* 건물 원격 통합 관제 (2026-11-02) — 광고 영상 「원격 통합 관제」 클릭 후 도착하는 랜딩.
     link 가 '/promo/' 로 시작하므로 /promotions/remote 는 만들지 않습니다(정본은 /promo/remote).
     접수는 /api/lead · 접점 promo_remote · 관심분야 「건물 원격 통합 관제」 로 들어갑니다. */
  id: 'remote',
  title: '건물 주요 설비 통합 관제 솔루션',
  html: '',
  period: '무료 현장 진단 · 배선 공사 없는 무선 설치',
  badge: 'NEW',
  desc: '제어반·기계실·EPS실·수변전실의 과열·화재·누수·정전을 실시간 감지해 담당자 휴대폰으로 즉시 알립니다. 여러 건물을 한 화면에서 관제하세요.',
  image: '/images/promo-remote.webp?v=1',
  images: [],
  link: '/promo/remote',
  start: '2026-11-02',   // 한국시간 이 날 00:00 부터 오픈
  end:   '',             // 상시 — 내릴 때 end 지정 또는 배열에서 제거
  order: 1
}, {
  id: 'alarm',
  title: '긴급 경보 알리미 상시 프로모션',
  html: '',
  period: '구독제 · 월 3만 원(서울·경기·인천 외 지역 월 4만 원) · 설치비 무료 EVENT',
  badge: 'NEW',
  desc: '화재·침수·정전·설비 이상 발생 시 담당자 휴대폰으로 즉시 알려드려요. 필요한 알리미부터 간편하게 시작하세요.',
  image: '/images/promo-emergency-alert-thumb.webp?v=1',
  images: [],
  link: '/promo/alarm',
  start: '2026-08-26',   // 한국시간 이 날 00:00 부터 오픈
  end:   '',             // 상시 — 내릴 때 end 지정 또는 배열에서 제거
  order: 2
}, {
  id: 'consulting',
  title: '회전설비 AI 예지보전 1개월 무료 체험',
  html: '',
  period: '시즈널 프로모션',
  badge: 'NEW',
  desc: '무료 검증 후 핵심 설비에 센서를 무상 설치. 한 달 데이터를 보고 도입을 결정하세요.',
  image: '/images/promo-consulting-banner.jpg',
  images: [],
  link: '/promo/consulting',
  start: '2026-08-01',   // 한국시간 이 날 00:00 부터 오픈
  end:   '',             // 비워두면 자동 종료 없음 — 내릴 때 forcedEnded:true 로 바꾸거나 이 배열을 비우세요
  order: 3
}, {
  /* 시스템 연동 기술지원 — 할인 프로모션이 아니라 「기술지원을 무료로 붙여 드린다」는
     제안입니다. 그래서 period 자리에 기간 대신 제공 범위를 적었습니다. 할인 문구를
     넣으면 카드가 다른 특가와 섞여서, 정작 찾아와야 할 설비·관제 담당자가 그냥 지나갑니다.
     link 가 '/promo/' 로 시작하므로 build.js 는 /promotions/modbus 를 따로 만들지
     않습니다 — 실제 랜딩(/promo/modbus/index.html) 과 주소가 겹치지 않게 하는 규칙입니다. */
  id: 'modbus',
  title: 'PLC·BMS·SCADA 시스템 연동 기술지원',
  html: '',
  period: '무료 현장 구성 검토 · 연동 자료 제공',
  badge: '기술지원',
  desc: '쓰던 관제 시스템은 그대로 두고 무선센서만 Modbus로 붙입니다. 현장 구성을 함께 검토해 드리고, 센서 수량과 점유 레지스터 주소까지 정리한 구성 제안 자료를 보내 드립니다.',
  image: '/images/promo-modbus.webp',
  images: [],
  link: '/promo/modbus',
  start: '2026-09-15',   // 한국시간 이 날 00:00 부터 오픈
  end:   '',             // 상시 — 내릴 때 end 지정 또는 배열에서 제거
  order: 4
}, {
  id: 'flame-reservation',
  title: '사전 예약 프로모션',
  html: '',
  period: '사전 예약 접수 중',
  badge: '사전 예약',
  desc: 'Looking to the Future! 지금 사전 예약하시고 다양한 혜택 받아 가세요.',
  image: '/images/promo-flame-reservation-thumb-v3.webp',
  images: ['/images/promo-flame-reservation.webp'],
  link: '',
  start: '2026-08-25',   // 한국시간 이 날 00:00 부터 오픈
  end: '',               // 마감일 없음 — 내릴 때 end 지정 또는 배열에서 제거
  order: 6
}, {
  id: 'residence',
  title: '누수까지 놓치지 않는 레지던스 관리',
  html: '',
  period: '2026. 8. 25 – 9. 24',
  badge: 'NEW',
  desc: '싱크대와 세탁기, 보일러 주변에 누수 알림 센서를 설치하면 물샘을 빠르게 감지해 앱으로 알려드립니다. 큰 피해로 번지기 전에 미리 대비하세요.',
  image: '/images/promo-residence.webp',
  images: [],
  link: '/promo/residence',
  start: '2026-08-25',   // 한국시간 이 날 00:00 부터 오픈
  end:   '2026-09-24',   // 한국시간 이 날 자정까지 — 이후 자동 '종료' 표시
  order: 5
}];
/* PROMOS 초기값은 아래 applyPromoSchedule / sortPromos 정의 뒤에서 채웁니다.
   (여기서 바로 채우면 status 가 없어 첫 화면에서 모든 카드가 '진행 중이 아님'으로 보입니다) */

/* 종료된 프로모션을 목록에 남길지 여부.
   true  → 이미지를 어둡게 덮고 '프로모션 종료' 표시, 목록 맨 뒤로 정렬 (현재 설정)
   false → 예전처럼 목록에서 완전히 숨김 */
const PROMO_SHOW_ENDED = true;

/* ── 프로모션 대표 이미지(카드 썸네일) 기본값 ───────────────────────
   에디터(시트)의 image 값이 비어 있을 때만 쓰는 예비 이미지입니다.
   에디터에서 이미지를 넣으면 무조건 그 값이 화면에 나옵니다.
   · 이유: 외부 이미지 호스트(ibb.co 등)는 느리고 링크가 끊길 수 있어,
     사이트 안에 최적화한 webp 를 두고 직접 서빙합니다. (장당 약 900KB → 80KB)
   · 파일 위치: /images/promo-{id}.webp  (og:image 용 .jpg 도 같이 있습니다)
   · 다시 시트로 관리하고 싶은 프로모션은 아래에서 해당 줄만 지우면 됩니다. */
const PROMO_LOCAL_IMG = {
  fire:   '/images/promo-fire.webp',    // 물류센터 화재예방 알리미
  flame:  '/images/promo-flame.webp',   // 무선 불꽃감지기 출시 특가
  water:  '/images/promo-water.webp',   // 실시간 침수 알리미
  elect:  '/images/promo-elect.webp',   // 실시간 정전 알리미
  church: '/images/promo-church.webp',  // 스마트 교회 알리미
  soil:   '/images/promo-soil.webp'     // 산사태 사전감지 솔루션
};

/* ═══════════════════════════════════════════════════════════════════
   프로모션 기간(한국시간 KST 고정) — 방문자 기기 시간대와 무관하게 동작
   · start/end 열이 있으면 그 값을 쓰고, 없으면 period 문구에서 자동 추출
   · 상태: upcoming(시작 전) / active(진행 중) / ended(종료)
   ═══════════════════════════════════════════════════════════════════ */
/* KST 기준 특정 날짜의 자정을 UTC 타임스탬프로 (KST = UTC+9) */
function kstMidnight(y, m, d){ return Date.UTC(y, m - 1, d, -9, 0, 0, 0); }
function kstToday(){
  const n = new Date(Date.now() + 9 * 3600000);
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate() };
}
/* 'YYYY-MM-DD' | 'YYYY.M.D' | 'M/D' | 'M월 D일' → {y,m,d} (연도 없으면 추론) */
function parseKDate(str, baseYear){
  if (!str) return null;
  const t = String(str).trim();
  let m = t.match(/(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) return { y:+m[1], m:+m[2], d:+m[3] };
  m = t.match(/(\d{1,2})\s*[/.월]\s*(\d{1,2})/);
  if (m){
    const mo = +m[1], da = +m[2];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    let y = baseYear || kstToday().y;
    // 지난 6개월보다 더 과거로 계산되면 내년으로 간주 (연말·연초 대응)
    if (kstMidnight(y, mo, da) < Date.now() - 182 * 86400000) y += 1;
    return { y:y, m:mo, d:da };
  }
  return null;
}
/* period 문구에서 시작·종료일 추출
   지원: '7/30까지' '~8/31' '8/1 ~ 8/31' '2026.08.01 ~ 08.31' '8월 한정' '8월 1일 ~ 8월 31일' */
function parsePeriodRange(period){
  const out = { start:null, end:null };
  if (!period) return out;
  const t = String(period).replace(/\s+/g, ' ').trim();

  // 'N월 한정' → 그 달 1일 ~ 말일
  let m = t.match(/(\d{1,2})\s*월\s*한정/);
  if (m){
    const mo = +m[1]; let y = kstToday().y;
    if (kstMidnight(y, mo, 1) < Date.now() - 182 * 86400000) y += 1;
    out.start = { y:y, m:mo, d:1 };
    out.end   = { y:y, m:mo, d:new Date(Date.UTC(y, mo, 0)).getUTCDate() };
    return out;
  }
  // 범위 표기 (~ 또는 - 로 구분)
  const parts = t.split(/\s*[~–—]\s*|\s+-\s+/);
  if (parts.length >= 2){
    const a = parseKDate(parts[0]);
    let b = parseKDate(parts[1]);
    if (a && !b){ // '8/1 ~ 31' 처럼 뒤에 일자만 있는 경우
      const dd = (parts[1].match(/(\d{1,2})/) || [])[1];
      if (dd) b = { y:a.y, m:a.m, d:+dd };
    }
    if (a) out.start = a;
    if (b) out.end = b;
    if (out.start || out.end) return out;
  }
  // '…까지' 단일 종료일
  if (/까지/.test(t)){ out.end = parseKDate(t); return out; }
  // 그 외 날짜 하나만 있으면 종료일로 간주
  out.end = parseKDate(t);
  return out;
}
/* 프로모션 객체에 startTs/endTs/status 부여 */
function applyPromoSchedule(p){
  if (!String(p.image || '').trim() && PROMO_LOCAL_IMG[p.id]) p.image = PROMO_LOCAL_IMG[p.id];   // 에디터 값이 항상 우선. 비어 있을 때만 내장 이미지
  const fromPeriod = parsePeriodRange(p.period);
  const s = parseKDate(p.start) || fromPeriod.start;
  let   e = parseKDate(p.end)   || fromPeriod.end;
  /* '7/30까지' 처럼 연도가 없는 종료일은 parseKDate 가 "지나갔으면 내년" 으로
     밀어 버려서, 해가 바뀌면 끝난 프로모션이 다시 살아납니다.
     시트의 end 열에 연도가 없고 종료일이 6개월 넘게 미래로 계산되면 작년으로 되돌립니다. */
  if (e && !/20\d{2}/.test(String(p.end || '') + ' ' + String(p.period || ''))){
    if (kstMidnight(e.y, e.m, e.d) > Date.now() + 182 * 86400000) e = { y:e.y - 1, m:e.m, d:e.d };
  }
  p.startTs = s ? kstMidnight(s.y, s.m, s.d) : null;               // 시작일 00:00 KST
  p.endTs   = e ? kstMidnight(e.y, e.m, e.d) + 86400000 : null;    // 종료일 24:00 KST (당일 포함)
  p.startLabel = s ? (s.y + '년 ' + s.m + '월 ' + s.d + '일') : '';
  p.endLabel   = e ? (e.y + '년 ' + e.m + '월 ' + e.d + '일') : '';
  const now = Date.now();
  if (p.forcedEnded)                    p.status = 'ended';
  else if (p.endTs   && now >= p.endTs) p.status = 'ended';
  else if (p.startTs && now <  p.startTs) p.status = 'upcoming';
  else                                  p.status = 'active';
  return p;
}
/* 지금 신청 가능한 프로모션 / 곧 시작하는 프로모션 */
function activePromos(){ return PROMOS.filter(p => p.status === 'active' && p.id !== 'flame-reservation'); }
function upcomingPromos(){
  return PROMOS.filter(p => p.status === 'upcoming' && p.id !== 'flame-reservation').sort((a,b) => (a.startTs||0) - (b.startTs||0));
}
function endedPromos(){ return PROMOS.filter(p => p.status === 'ended' && p.id !== 'flame-reservation'); }

/* ── 노출 순서: 진행 중 → 시작 전 → 종료 ────────────────────────────
   같은 그룹 안에서는
   · 진행 중  : 시트 order 순 (기존 노출 순서 유지)
   · 시작 전  : 먼저 열리는 것부터
   · 종료     : 최근에 끝난 것부터
   ------------------------------------------------------------------ */
const PROMO_RANK = { active: 0, upcoming: 1, ended: 2 };
function sortPromos(list){
  return list.slice().sort((a, b) => {
    const ra = PROMO_RANK[a.status] != null ? PROMO_RANK[a.status] : 3;
    const rb = PROMO_RANK[b.status] != null ? PROMO_RANK[b.status] : 3;
    if (ra !== rb) return ra - rb;
    if (a.status === 'upcoming') return (a.startTs || 0) - (b.startTs || 0);
    if (a.status === 'ended')    return (b.endTs   || 0) - (a.endTs   || 0);
    return (a.order || 0) - (b.order || 0);
  });
}
/* 화면을 그리는 시점의 '지금'으로 상태를 다시 계산합니다.
   (탭을 켜 둔 채 자정을 넘겨도 종료된 프로모션이 진행 중으로 남지 않도록) */
function refreshPromoStatuses(){
  PROMOS.forEach(applyPromoSchedule);
  PROMOS = sortPromos(PROMOS);
  return PROMOS;
}
/* 시트가 로드되기 전에 보여 줄 내장 프로모션 — 상태·정렬까지 적용해서 넣습니다 */
PROMOS = sortPromos(BUILTIN_PROMOS.map(b => applyPromoSchedule(Object.assign({}, b))));
function mapPromotions(rows){
  const out = rows.filter(o => (o.title || o.html || o.images || o.image))
    .map(o => ({
      // 시트의 ended 열은 '기간과 무관하게 강제 종료' 스위치로 씁니다
      forcedEnded: /^(1|true|y|yes)$/i.test(String(o.ended||'').trim()),
      start: (o.start||'').trim(),
      end: (o.end||'').trim(),
      id: (o.id||'').trim(),
      title: o.title||'',
      html: o.html||'',
      period: o.period||'',
      badge: o.badge||'',
      desc: o.desc||'',
      link: (o.link||'').trim(),   // 값이 있으면 카드 클릭 시 해당 랜딩페이지로 이동
      image: normalizeImageUrl(o.image||''),
      // 상세 페이지용 이미지들 (||로 여러 장 구분). 각 항목의 ':: 캡션' 부분은 제거. images 없으면 image 한 장 사용
      images: (o.images||'').split('||').map(s=>normalizeImageUrl((s.split('::')[0]||'').trim())).filter(Boolean),
      /* 0 도 유효한 순서입니다. || 999 를 쓰면 0 이 falsy 라 맨 뒤로 갑니다. */
      order: (function(){ const n = parseInt(o.order, 10); return Number.isFinite(n) ? n : 999; })()
    }))
    .sort((a,b) => a.order - b.order);
  /* 시트 행이 내장 프로모션과 같은 id 인데 link·image 칸이 비어 있으면 내장값을 씁니다 (2026-11-02).
     편집기로 제목만 고쳐 저장했을 때 시트에 link 열이 없으면 카드가 랜딩 대신 빈 상세로 가던 것을 막습니다. */
  out.forEach(p => { const b = BUILTIN_PROMOS.find(x => x.id === p.id); if (!b) return;
    if (!p.link && b.link) p.link = b.link;
    if (!p.image && b.image) p.image = b.image; });
  // 시트에 없는 내장 프로모션을 합칩니다 (시트 우선)
  BUILTIN_PROMOS.forEach(b => { if (!out.some(p => p.id === b.id)) out.push(Object.assign({}, b)); });
  out.forEach(applyPromoSchedule);
  // 진행 중 → 시작 전 → 종료 순 (같은 그룹 안 규칙은 sortPromos 참고)
  return sortPromos(out);
}
let NEWS_HIGHLIGHTS = [
  { title:'2026 IoT Sensor Company of the Year 수상', desc:'Monnit이 2년 연속 올해의 IoT 센서 기업으로 선정되었습니다.', url:'https://blog.naver.com/monnitkorea' },
  { title:'IoT Platforms Leadership Award 연속 수상', desc:'플랫폼 리더십 부문에서 백투백 수상을 기록했습니다.', url:'https://blog.naver.com/monnitkorea' },
  { title:'신형 ALTA / ALTA XL Ethernet Gateway 4K 발표', desc:'대규모 센서 네트워크를 위한 차세대 게이트웨이를 출시했습니다.', url:'https://blog.naver.com/monnitkorea' }
];
let WHITEPAPERS = [
  { icon:"▤", category:"산업 · 제조", title:"데이터센터 · IDC 모니터링", desc:"랙 단위 열편차와 과냉각을 실측해, 더 차갑게가 아니라 정확하게 냉방하는 방법.", url:"", photo:"https://images.unsplash.com/photo-1762163516269-3c143e04175c?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-02.jpg", dlname:"모넷코리아_데이터센터_IDC_모니터링_제안서.pdf" },
  { icon:"▤", category:"산업 · 제조", title:"공장 설비 예지보전", desc:"모터·펌프·감속기의 진동과 전류로 고장을 7~30일 전에 잡아내는 예지보전 설계.", url:"", photo:"https://images.unsplash.com/photo-1610891015188-5369212db097?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-03.jpg", dlname:"모넷코리아_공장설비_예지보전_제안서.pdf" },
  { icon:"▤", category:"산업 · 제조", title:"진동 · 구조안전 계측", desc:"배관 피로, 구조 부재 변형, 회전설비 진동을 24bit 정밀도로 무선 계측합니다.", url:"", photo:"https://images.unsplash.com/photo-1694674818352-f6061a0561a1?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-04.jpg", dlname:"모넷코리아_진동_구조안전_계측_제안서.pdf" },
  { icon:"▤", category:"산업 · 제조", title:"건설 · 토목 구조물 모니터링", desc:"전원도 통신도 없는 초기 현장부터 사면·흙막이·양생 구간을 24시간 계측합니다.", url:"", photo:"https://images.unsplash.com/photo-1783753445140-7de87b0e90f3?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-05.jpg", dlname:"모넷코리아_건설_토목_구조물모니터링_제안서.pdf" },
  { icon:"▤", category:"산업 · 제조", title:"UPS · ESS · 전력 설비 모니터링", desc:"배터리 열화와 수배전반 과열을 활선 상태에서 비접촉으로 감시합니다.", url:"", photo:"https://images.unsplash.com/photo-1509390144018-eeaf65052242?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-07.jpg", dlname:"모넷코리아_UPS_ESS_전력설비_모니터링_제안서.pdf" },
  { icon:"▤", category:"시설 · 안전", title:"무선 화재경보 · 소방 안전", desc:"기존 수신반은 그대로 두고 경보만 담당자 휴대폰으로 직접 전달합니다.", url:"", photo:"https://images.unsplash.com/photo-1767741683084-08ac01518c8c?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-06.jpg", dlname:"모넷코리아_무선화재경보_소방안전_제안서.pdf" },
  { icon:"▤", category:"시설 · 안전", title:"스마트 FM · 시설관리", desc:"민원이 들어오기 전에 먼저 아는 예지형 FM. 관리 성과가 리포트로 남습니다.", url:"", photo:"https://images.unsplash.com/photo-1540397990819-5197ccf2608a?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-10.jpg", dlname:"모넷코리아_스마트FM_시설관리_플랫폼_제안서.pdf" },
  { icon:"▤", category:"시설 · 안전", title:"공공 · 국방 시설 안전관리", desc:"배선 공사 승인 없이, 보안 요건을 충족하는 암호화 무선 계측으로 시작합니다.", url:"", photo:"https://images.unsplash.com/photo-1767022086667-3e3f1e0fcaf3?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-14.jpg", dlname:"모넷코리아_공공_국방_시설안전관리_제안서.pdf" },
  { icon:"▤", category:"시설 · 안전", title:"호텔 · 리조트 시설 모니터링", desc:"객실 누수와 빈 객실 냉난방, 비수기 동파를 컴플레인이 접수되기 전에 잡아냅니다.", url:"", photo:"https://images.unsplash.com/photo-1783599677025-be14dfdc73d7?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-16.jpg", dlname:"모넷코리아_호텔_리조트_시설모니터링_제안서.pdf" },
  { icon:"▤", category:"시설 · 안전", title:"학교 · 교회 · 공공시설 모니터링", desc:"방학·주말 무인 기간의 동파와 누수를 감시하고 급식실 온도 기록을 자동으로 남깁니다.", url:"", photo:"https://images.unsplash.com/photo-1613896527026-f195d5c818ed?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-18.jpg", dlname:"모넷코리아_학교_교회_공공시설_모니터링_제안서.pdf" },
  { icon:"▤", category:"온도 · 환경", title:"온도 · 누수 · 동파 · HVAC 통합", desc:"배관이 얼기 전에, 물이 차기 전에. 전기실·기계실·공조·저온창고 통합 감시.", url:"", photo:"https://images.unsplash.com/photo-1778855179330-6b73b6d599e7?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-08.jpg", dlname:"모넷코리아_온도_누수_동파_HVAC_통합모니터링_제안서.pdf" },
  { icon:"▤", category:"온도 · 환경", title:"농업 · 골프장 토양 수분", desc:"물을 얼마나 줄지 감이 아니라 수분 포텐셜(kPa) 수치로 결정합니다.", url:"", photo:"https://images.unsplash.com/photo-1742498626087-af76400d968c?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-13.jpg", dlname:"모넷코리아_농업_골프장_토양수분_모니터링_제안서.pdf" },
  { icon:"▤", category:"의료 · 바이오", title:"바이오 · 제약 유틸리티 모니터링", desc:"GMP 환경의 온습도·차압·유틸리티를 자동 기록해 감사 대응 근거를 남깁니다.", url:"", photo:"https://images.unsplash.com/photo-1748000970909-845f4aa144d2?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-09.jpg", dlname:"모넷코리아_바이오_제약_유틸리티_모니터링_제안서.pdf" },
  { icon:"▤", category:"의료 · 바이오", title:"실버타운 · 시니어 안전", desc:"몸에 아무것도 차지 않아도 되는 비접촉 센서로 어르신의 일상을 살핍니다.", url:"", photo:"https://images.unsplash.com/photo-1773227059780-5e865ce7fb13?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-11.jpg", dlname:"모넷코리아_실버타운_시니어안전_모니터링_제안서.pdf" },
  { icon:"▤", category:"콜드체인 · 유통", title:"콜드체인 · 물류 온도 관리", desc:"창고에서 차량까지 온도 이력이 끊기지 않게. HACCP 기록을 자동으로 남깁니다.", url:"", photo:"https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-12.jpg", dlname:"모넷코리아_콜드체인_물류_온도모니터링_제안서.pdf" },
  { icon:"▤", category:"콜드체인 · 유통", title:"리테일 · 매장 · 외식 온도 관리", desc:"여러 점포의 냉장 진열대와 주방 냉동고를 본사 한 화면에서 보고 HACCP 기록을 자동화합니다.", url:"", photo:"https://images.unsplash.com/photo-1760463921658-0fa0ce72c91c?auto=format&fit=crop&crop=entropy&w=440&h=560&q=72", thumb:"/images/proposals/cover-17.jpg", dlname:"모넷코리아_리테일_매장_외식_온도관리_제안서.pdf" }
];
let FAQS = [
  { q:'센서 무선 통신 거리는 얼마나 되나요?', a:'ALTA 무선 센서는 비가시선 기준 벽 12장을 관통해 1,200ft 이상, ALTA XL 게이트웨이 사용 시 벽 18장 관통 2,000ft 이상까지 통신합니다. 안테나 방향과 설치 환경에 따라 최적 성능이 달라집니다.' },
  { q:'센서 배터리는 얼마나 가나요?', a:'사용 환경에 따라 다르지만, 단일 AA 배터리로 최대 10년 이상 사용 가능합니다. 데이터 전송 주기(하트비트), 통신 거리, 장애물 수가 수명에 영향을 줍니다. 배터리 잔량은 iMonnit에서 백분율로 확인할 수 있고, 설정 임계값 이하가 되면 알림을 받을 수 있습니다.' },
  { q:'인터넷이 끊기면 데이터가 사라지나요?', a:'아닙니다. 게이트웨이 연결이 끊겨도 센서가 자체적으로 최대 4,000건의 측정값을 저장하며, 연결이 복구되면 누락 없이 전송합니다. 게이트웨이 역시 내부 메모리에 다수의 메시지를 저장합니다.' },
  { q:'데이터 보안은 어떻게 보장되나요?', a:'Encrypt-RF® 기술로 256-bit ECDH 키 교환과 AES-128 암호화를 적용해 센서~게이트웨이 구간을 보안 터널로 보호합니다. 또한 패킷 변조 검증 루틴으로 위·변조 및 재전송 공격을 차단합니다.' },
  { q:'알림은 어떤 방식으로 받나요?', a:'사용자가 설정한 조건을 초과하면 iMonnit이 SMS 문자, 이메일, 전화로 즉시 알림을 보냅니다. 임계값과 수신자는 자유롭게 설정할 수 있습니다.' },
  { q:'설치와 설정은 어렵지 않나요?', a:'대부분의 ALTA 센서는 전원을 켜는 즉시 게이트웨이에 연결되는 플러그앤플레이 방식으로, 시스템 구성에 보통 15분이면 충분합니다. Monnit Korea가 현장 설치와 초기 설정을 지원합니다.' }
];
// KNOWLEDGEBASE 데이터는 data.js 로 분리됨 (index.html 에서 app.js 보다 먼저 로드)

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const pageState = { blog: 1, wp: 1, blogCat: 'all', wpCat: 'all', kb: 1, kbCat: 'all' };
function renderPager(afterEl, id, total, per, page, go){
  let pager = document.getElementById(id);
  if (!pager){ pager = document.createElement('div'); pager.id = id; pager.className = 'pager'; afterEl.insertAdjacentElement('afterend', pager); }
  const pages = Math.ceil(total / per) || 1;
  if (pages <= 1){ pager.innerHTML = ''; return; }
  /* 페이지가 많아도 버튼이 벽처럼 늘어서지 않도록 앞·뒤·현재 주변만 보여주고 나머지는 … 로 접습니다 */
  const win = new Set([1, pages, page, page-1, page+1]);
  if (page <= 3) { win.add(2); win.add(3); win.add(4); }
  if (page >= pages-2) { win.add(pages-1); win.add(pages-2); win.add(pages-3); }
  const nums = [...win].filter(n => n>=1 && n<=pages).sort((a,b)=>a-b);
  let h = `<button class="pg-btn pg-nav" data-go="${page-1}" aria-label="이전 페이지" ${page<=1?'disabled':''}>‹</button>`;
  let prev = 0;
  nums.forEach(n => {
    if (prev && n - prev > 1) h += `<span class="pg-gap" aria-hidden="true">…</span>`;
    h += `<button class="pg-btn ${n===page?'active':''}" data-go="${n}"${n===page?' aria-current="page"':''}>${n}</button>`;
    prev = n;
  });
  h += `<button class="pg-btn pg-nav" data-go="${page+1}" aria-label="다음 페이지" ${page>=pages?'disabled':''}>›</button>`;
  h += `<span class="pg-count">${page} / ${pages} 페이지 · 전체 ${total}건</span>`;
  pager.innerHTML = h;
  pager.querySelectorAll('.pg-btn[data-go]').forEach(b=>{
    b.onclick = ()=>{ const g=parseInt(b.dataset.go,10); if(g>=1 && g<=pages && g!==page) go(g); };
  });
}
function renderCatBar(barId, allCount, cats, current, onPick){
  const bar = document.getElementById(barId); if (!bar) return;
  if (!cats.length){ bar.innerHTML = ''; bar.style.display = 'none'; return; }
  bar.style.display = '';
  const items = [{id:'all', name:'전체', count:allCount}, ...cats];
  bar.innerHTML = items.map(i =>
    `<button class="cat-pill ${current===i.id?'active':''}" data-cat="${esc(i.id)}">${esc(i.name)}<span class="count">${i.count}</span></button>`
  ).join('');
  bar.querySelectorAll('.cat-pill').forEach(b => { b.onclick = () => onPick(b.dataset.cat); });
}
function uniqCats(arr){
  const seen = {}; arr.forEach(o => { const c=(o.category||'').trim(); if(c) seen[c]=(seen[c]||0)+1; });
  return Object.keys(seen).map(c => ({ id:c, name:c, count:seen[c] }));
}
function renderBlog(){
  const el = document.getElementById('blogGrid'); if (!el) return;
  const cats = uniqCats(BLOG);
  renderCatBar('blogCatBar', BLOG.length, cats, pageState.blogCat, c => { pageState.blogCat=c; pageState.blog=1; renderBlog(); });
  let list = (pageState.blogCat==='all') ? BLOG.slice() : BLOG.filter(p => (p.category||'')===pageState.blogCat);
  const per = 6, total = list.length, pages = Math.ceil(total/per) || 1;
  pageState.blog = Math.min(Math.max(1, pageState.blog), pages);
  const start = (pageState.blog - 1) * per;
  el.innerHTML = list.slice(start, start + per).map(p => {
    const thumb = p.image
      ? `<div class="blog-thumb has-img"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" onerror="__promoImgFallback(this,'${esc(p.id)}')"></div>`
      : `<div class="blog-thumb">${esc(p.thumb||'◐')}</div>`;
    const insight = (p.insight && p.insight.trim())
      ? `<div class="blog-insight"><div class="blog-insight-inner"><span class="bi-label">INSIGHT · 전체 요약</span><p>${esc(p.insight)}</p><span class="b-link">자세히 보기 →</span></div></div>`
      : '';
    const inner = `
      ${thumb}
      <div class="blog-body">
        <div class="blog-date">${esc(p.date)}</div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.body)}</p>
        <span class="b-link">자세히 보기 →</span>
      </div>
      ${insight}`;
    const cls = insight ? 'blog-card has-insight' : 'blog-card';
    return p.url
      ? `<a class="${cls} res-link" href="${esc(p.url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<article class="${cls}">${inner}</article>`;
  }).join('');
  renderPager(el, 'blogPager', total, per, pageState.blog, g=>{ pageState.blog=g; renderBlog(); el.scrollIntoView({behavior:'smooth',block:'start'}); });
}
/* ═══════════════════════════════════════════════════════════════════
   종료·시작 전 프로모션 안내창
   · 종료된 프로모션 → 지금 진행 중인 혜택으로 유도
   · 시작 전 프로모션 → 오픈 예정일 안내
   ═══════════════════════════════════════════════════════════════════ */
function closePromoGate(){
  const el = document.getElementById('promoGate');
  if (el){ el.classList.remove('show'); setTimeout(()=>el.remove(), 200); }
  document.body.style.overflow = '';
}
function showPromoGate(p){
  closePromoGate();
  const ended = p.status === 'ended';
  const alts  = activePromos().filter(x => x.id !== p.id);
  const soon  = upcomingPromos().filter(x => x.id !== p.id);

  let head, lead;
  if (ended){
    head = '종료된 프로모션입니다';
    lead = `<b>${esc(p.title)}</b> 은(는) ${p.endLabel ? esc(p.endLabel) + '자로 ' : ''}접수가 마감되었습니다.`;
  } else {
    head = '아직 시작 전인 프로모션입니다';
    lead = `<b>${esc(p.title)}</b> 은(는) <b class="pg-hl">${esc(p.startLabel)}</b> 부터 신청하실 수 있습니다.`;
  }

  let bodyHtml = '';
  if (alts.length){
    bodyHtml += `<div class="pg-sub">${ended ? '지금 진행 중인 혜택으로 안내해 드릴까요?' : '먼저 진행 중인 혜택을 살펴보셔도 좋습니다.'}</div>`;
    bodyHtml += '<div class="pg-list">' + alts.slice(0,3).map(a => {
      const href = a.link ? esc(a.link) : ('#promotions/' + esc(a.id));
      const thumb = a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<span class="pg-ico">◆</span>';
      return `<a class="pg-item" href="${href}" data-gate-go="${esc(a.id)}">
        <span class="pg-thumb">${thumb}</span>
        <span class="pg-txt"><b>${esc(a.title)}</b><small>${esc(a.period || '진행 중')}</small></span>
        <span class="pg-arrow">→</span></a>`;
    }).join('') + '</div>';
  } else if (soon.length || !ended){
    const n = soon[0] || p;
    bodyHtml += `<div class="pg-sub">현재 신청 가능한 프로모션이 없습니다.<br>
      <b class="pg-hl">${esc(n.startLabel || '곧')}</b> 에 <b>${esc(n.title)}</b> 이(가) 시작됩니다. 조금만 기다려 주세요.</div>`;
  } else {
    bodyHtml += '<div class="pg-sub">새로운 프로모션을 준비하고 있습니다.<br>준비되는 대로 이곳에서 가장 먼저 안내드리겠습니다.</div>';
  }

  const wrap = document.createElement('div');
  wrap.id = 'promoGate';
  wrap.className = 'pg-ov';
  wrap.innerHTML = `<div class="pg-box" role="dialog" aria-modal="true" aria-label="${esc(head)}">
      <button class="pg-x" type="button" aria-label="닫기">✕</button>
      <div class="pg-icon">${ended ? '🔒' : '⏳'}</div>
      <h3 class="pg-head">${esc(head)}</h3>
      <p class="pg-lead">${lead}</p>
      ${bodyHtml}
      <div class="pg-foot">
        <button class="pg-btn pg-btn-ghost" type="button" data-gate-close>닫기</button>
        <a class="pg-btn pg-btn-main" href="#contact" data-gate-close>상담 문의하기</a>
      </div>
      <p class="pg-note">문의 02-2088-1454 · korea@monnit.com</p>
    </div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(()=> wrap.classList.add('show'));

  wrap.addEventListener('click', e => {
    if (e.target === wrap || e.target.closest('.pg-x') || e.target.closest('[data-gate-close]')) closePromoGate();
  });
  wrap.querySelectorAll('[data-gate-go]').forEach(a => a.addEventListener('click', () => {
    try { if (window.gtag) gtag('event', 'promo_gate_redirect', { from: p.id, to: a.getAttribute('data-gate-go') }); } catch(e){}
    closePromoGate();
  }));
  document.addEventListener('keydown', function esc2(e){
    if (e.key === 'Escape'){ closePromoGate(); document.removeEventListener('keydown', esc2); }
  });
  try { if (window.gtag) gtag('event', 'promo_gate_view', { promo: p.id, state: p.status }); } catch(e){}
}

/* ===== PROMOTIONS ===== */
function renderPromotions(){
  const grid = document.getElementById('promoGrid');
  const empty = document.getElementById('promoEmpty');
  if (!grid) return;
  refreshPromoStatuses();   // 그리는 순간 기준으로 진행 중/시작 전/종료 다시 판정 + 재정렬
  /* 브랜드 메시지 등장 모션 — 뷰가 열릴 때마다 재생 */
  var _creed = document.querySelector('.promo-creed');
  if (_creed) { _creed.classList.remove('creed-in'); void _creed.offsetWidth;
    setTimeout(function(){ _creed.classList.add('creed-in'); }, 60); }
  const countEl = document.getElementById('promoHeroCount');
  if (countEl) {
    let _lang='ko'; try{ _lang=localStorage.getItem('mlang')||'ko'; }catch(e){}
    const nActive = activePromos().length, up = upcomingPromos()[0];
    if (nActive) {
      countEl.textContent = (_lang==='en')
        ? `${nActive} promotion${nActive>1?'s':''} currently running · apply before they sell out`
        : `현재 ${nActive}건의 혜택이 진행 중입니다 · 선착순 마감 전 신청하세요`;
    } else if (up) {
      countEl.textContent = (_lang==='en')
        ? `Next promotion opens on ${up.startLabel} · stay tuned`
        : `${up.startLabel}에 새 프로모션이 시작됩니다 · 조금만 기다려 주세요`;
    } else {
      countEl.textContent = (_lang==='en') ? 'New promotions are on the way' : '새로운 프로모션을 준비하고 있습니다';
    }
  }
  if (!PROMOS.length){
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  /* 종료된 프로모션도 목록에 남깁니다 — 이미지를 어둡게 덮고 '프로모션 종료' 를 표시,
     순서는 진행 중 → 시작 전 → 종료 이므로 항상 맨 뒤로 내려갑니다.
     (PROMO_SHOW_ENDED 를 false 로 바꾸면 예전처럼 목록에서 감춥니다) */
  const VISIBLE = (PROMO_SHOW_ENDED ? PROMOS.slice() : PROMOS.filter(p => p.status !== 'ended'))
    .filter(p => p.id !== 'flame-reservation');   /* 링크 직접 입력으로만 접근 — 목록 비노출 */
  if (!VISIBLE.length){
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = VISIBLE.map(p => {
    const off = p.status !== 'active';                    // 종료 또는 시작 전 → 진입 차단
    const stateCls = off ? ' promo-card-' + p.status : '';
    const stamp = p.status === 'ended'
      ? '<span class="promo-stamp promo-stamp-ended">종료</span>'
      : (p.status === 'upcoming' ? '<span class="promo-stamp promo-stamp-soon">시작 전</span>' : '');
    /* 이미지를 덮는 어두운 막 + 가운데 상태 문구 */
    const veil = p.status === 'ended'
      ? '<span class="promo-veil promo-veil-ended" aria-hidden="true"><span class="promo-veil-txt">프로모션 종료</span></span>'
      : (p.status === 'upcoming'
          ? `<span class="promo-veil promo-veil-soon" aria-hidden="true"><span class="promo-veil-txt">${esc(p.startLabel ? p.startLabel + ' 오픈' : '오픈 예정')}</span></span>`
          : '');
    const thumb = (p.image
      ? `<div class="promo-thumb has-img"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" onerror="__promoImgFallback(this,'${esc(p.id)}')">${veil}${stamp}</div>`
      : `<div class="promo-thumb">◆${veil}${stamp}</div>`);
    const badge = p.badge && p.status === 'active' ? `<span class="promo-badge">${esc(p.badge)}</span>` : '';
    let periodTxt = p.period || '';
    if (p.status === 'upcoming' && p.startLabel) periodTxt = p.startLabel + ' 오픈 예정';
    else if (p.status === 'ended') periodTxt = (p.endLabel ? p.endLabel + ' 종료' : '종료된 프로모션');
    const period = periodTxt ? `<div class="promo-period">${esc(periodTxt)}</div>` : '';
    const cta = p.status === 'active' ? '자세히 보기 →'
              : (p.status === 'upcoming' ? '오픈 알림 받기 →' : '진행 중인 혜택 보기 →');
    const body = `
      <div class="promo-body">
        ${badge}
        <h3>${esc(p.title)}</h3>
        ${period}
        <p>${esc(p.desc)}</p>
        <span class="b-link">${cta}</span>
      </div>`;
    // 진행 중 + 랜딩 링크가 있을 때만 실제 <a> 로 이동시킵니다
    if (p.link && !off){
      const ext = p.link.indexOf('http') === 0;
      return `<a class="promo-card" href="${esc(p.link)}"${ext ? ' target="_blank" rel="noopener"' : ''} data-promo-link="${esc(p.id)}">${thumb}${body}</a>`;
    }
    return `<article class="promo-card${stateCls}" data-promo="${esc(p.id)}" role="button" tabindex="0"
             aria-disabled="${off ? 'true' : 'false'}">${thumb}${body}</article>`;
  }).join('');
  grid.querySelectorAll('[data-promo-link]').forEach(card => {
    card.addEventListener('click', () => {
      try { if (window.gtag) gtag('event', 'promo_card_click', { promo: card.getAttribute('data-promo-link') }); } catch(e){}
    });
  });
  grid.querySelectorAll('[data-promo]').forEach(card => {
    const id = card.getAttribute('data-promo');
    const open = () => {
      const p = PROMOS.find(x => x.id === id);
      if (p && p.status !== 'active'){ showPromoGate(p); return; }   // 종료·시작 전 → 안내창
      openPromo(id);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
  });
  // 사전 신청 폼의 프로모션 선택 드롭다운 채우기
  const sel = document.getElementById('pafPromo');
  if (sel){
    const cur = sel.value;
    sel.innerHTML = '<option value="">— 프로모션을 선택하세요 —</option>'
      + activePromos().map(p => `<option value="${esc(p.title)}">${esc(p.title)}</option>`).join('')
      + '<option value="기타/미정">기타 · 아직 정하지 않음</option>';
    if (cur) sel.value = cur;
    sel.onchange = updatePromoApplyFields;
    updatePromoApplyFields();
  }
}
function updatePromoApplyFields(){
  const promo = document.getElementById('pafPromo');
  const label = document.getElementById('pafQtyLabel');
  const control = document.getElementById('pafQtyControl');
  if (!promo || !label || !control) return;
  const reservation = promo.value === '사전 예약 프로모션';
  const mode = reservation ? 'product' : 'quantity';
  if (control.dataset.mode === mode) return;
  control.dataset.mode = mode;
  if (reservation){
    label.innerHTML = '예약 희망 제품 <b>*</b>';
    control.innerHTML = '<select id="pafQty" required>'
      + '<option value="">— 제품을 선택하세요 —</option>'
      + '<option value="불꽃 감지기">불꽃 감지기</option>'
      + '<option value="P형 화재 감지 센서">P형 화재 감지 센서</option>'
      + '<option value="코인셀 센서">코인셀 센서</option>'
      + '<option value="엣지 게이트웨이">엣지 게이트웨이</option>'
      + '</select>';
  } else {
    label.textContent = '구매 희망 수량';
    control.innerHTML = '<input type="text" id="pafQty" placeholder="예: 센서 50개 / 게이트웨이 2대">';
  }
}
function flameReservationHTML(){
  return `
    <div class="flame-story">
      <section class="flame-hero flame-hero-static" aria-labelledby="flameHeroTitle">
        <div class="flame-hero-copy">
          <h2 id="flameHeroTitle">한계를 넘어<br><em>새로운 시작으로</em></h2>
          <p>차세대 무선 센서 라인업을 가장 먼저 만나보세요.</p>
          <button class="flame-cta" type="button" onclick="scrollToFlameReservationForm()">사전 예약하기</button>
        </div>
      </section>

      <section class="flame-section flame-highlights" aria-labelledby="flameHighlights">
        <div class="flame-section-head">
          <span class="flame-kicker">오직, 사전 예약 고객 대상으로만</span>
          <h2 id="flameHighlights">강력한 프로모션</h2>
        </div>
        <div class="flame-highlight-track">
          <article class="flame-highlight-card flame-card-blue">
            <span class="flame-card-no">01</span>
            <h3>20%<br>특별 할인</h3>
            <p>정식 출시 전 사전 예약 시<br>20% 할인된 특별가로 만나보실 수 있습니다.</p>
            <p class="flame-highlight-note">※ 구매 수량에 따라 할인율이 차등 적용됩니다.</p>
          </article>
          <article class="flame-highlight-card flame-card-violet">
            <span class="flame-card-no">02</span>
            <h3>설치비<br>전액 지원</h3>
            <p>정식 출시 전 사전 예약 시<br>설치비를 전액 지원해 드립니다.</p>
          </article>
          <article class="flame-highlight-card flame-card-red">
            <span class="flame-card-no">03</span>
            <h3>프리미엄 플랫폼<br>1년 구독권 제공</h3>
            <p>정식 출시 전 사전 예약 시<br>새롭게 출시되는 프리미엄 플랫폼<br>1년 구독권을 제공해 드립니다.</p>
          </article>
        </div>
      </section>

      <section class="flame-section flame-lineup" aria-labelledby="flameLineupTitle">
        <div class="flame-section-head">
          <h2 id="flameLineupTitle">새로운 라인업을<br>미리 만나 보세요</h2>
          <p class="flame-lineup-note">세부 사양과 출시 일정은 순차적으로 공개될 예정입니다.</p>
        </div>
        <div class="flame-explorer">
        <div class="flame-explorer-stage">
          <div class="flame-explorer-tabs" role="tablist" aria-label="신제품 라인업 자세히 보기">
            <button class="flame-explorer-tab" type="button" role="tab" aria-selected="false" data-index="0"
              data-image="/images/flame-detector-detail.webp"
              data-title="불꽃 감지기"
              data-desc="정밀한 UV 감지 방식으로 불꽃을 빠르게 감지해 넓은 공간의 화재를 조기에 확인할 수 있습니다."
              onclick="selectFlameFeature(this)"><span class="flame-explorer-icon">+</span><span class="flame-explorer-label">불꽃 감지기</span><span class="flame-explorer-detail"><strong>불꽃 감지기</strong><span>정밀한 UV 감지 방식으로 불꽃을 빠르게 감지해 넓은 공간의 화재를 조기에 확인할 수 있습니다.</span></span></button>
            <button class="flame-explorer-tab" type="button" role="tab" aria-selected="false" data-index="1"
              data-image="/images/flame-p-type-fireshield.webp"
              data-title="P형 화재 감지 센서"
              data-desc="기존 P형 화재 수신기와 연동해 건물 전 층의 화재 발생 여부를 실시간으로 통합 확인할 수 있습니다."
              onclick="selectFlameFeature(this)"><span class="flame-explorer-icon">+</span><span class="flame-explorer-label">P형 화재 감지 센서</span><span class="flame-explorer-detail"><strong>P형 화재 감지 센서</strong><span>기존 P형 화재 수신기와 연동해 건물 전 층의 화재 발생 여부를 실시간으로 통합 확인할 수 있습니다.</span></span></button>
            <button class="flame-explorer-tab" type="button" role="tab" aria-selected="false" data-index="2"
              data-image="/images/flame-coincell-sensor.webp"
              data-title="코인셀 센서"
              data-desc="컴팩트하고 가벼운 디자인으로 공간 제약 없이 간편하게 설치할 수 있습니다."
              onclick="selectFlameFeature(this)"><span class="flame-explorer-icon">+</span><span class="flame-explorer-label">코인셀 센서</span><span class="flame-explorer-detail"><strong>코인셀 센서</strong><span>컴팩트하고 가벼운 디자인으로 공간 제약 없이 간편하게 설치할 수 있습니다.</span></span></button>
            <button class="flame-explorer-tab" type="button" role="tab" aria-selected="false" data-index="3"
              data-image="/images/flame-edge-gateway-lineup.webp"
              data-title="엣지 게이트웨이"
              data-desc="센서 데이터를 현장에서 직접 처리해 서버를 거치지 않고 더 빠르게 판단합니다. BMS·클라우드와도 유연하게 연결할 수 있습니다."
              onclick="selectFlameFeature(this)"><span class="flame-explorer-icon">+</span><span class="flame-explorer-label">엣지 게이트웨이</span><span class="flame-explorer-detail"><strong>엣지 게이트웨이</strong><span>센서 데이터를 현장에서 직접 처리해 서버를 거치지 않고 더 빠르게 판단합니다. BMS·클라우드와도 유연하게 연결할 수 있습니다.</span></span></button>
          </div>
          <div class="flame-explorer-visual">
            <img src="/images/flame-detector-detail.webp" alt="Monnit 불꽃 감지기">
          </div>
          <button class="flame-explorer-close" type="button" aria-label="상세 설명 닫기" onclick="closeFlameFeature(this)">×</button>
          <div class="flame-explorer-nav" aria-label="제품 항목 이동">
            <button type="button" aria-label="이전 항목" onclick="stepFlameFeature(this,-1)">↑</button>
            <button type="button" aria-label="다음 항목" onclick="stepFlameFeature(this,1)">↓</button>
          </div>
        </div>
        </div>
      </section>

      <section class="flame-product-stories" aria-labelledby="flameProductStoriesTitle">
        <header class="flame-product-stories-head">
          <span>성능</span>
          <h2 id="flameProductStoriesTitle">제품별로<br>더 깊이</h2>
          <div class="flame-product-stories-intro">
            <p>현장의 한계를 넘어설 새로운 4가지 솔루션이 시작됩니다.<br><strong>더 정밀하게</strong> 감지하고, <strong>더 간편하게</strong> 연결하고, <strong>더 상세하게</strong> 모니터링하고, <strong>더 빠르게</strong> 데이터를 처리하는 것.<br>서로 다른 한계를 뛰어넘기 위해 탄생한 <strong>4가지 신제품</strong>이 현장 모니터링의 새로운 시작을 완성합니다.</p>
            <strong class="flame-product-stories-highlight">더 새로운 기술을,<br>더 좋은 조건으로.</strong>
            <p>그리고 그 시작을 가장 먼저 경험하는 고객을 위해 <strong>사전 예약</strong>에서만 누릴 수 있는 강력한 혜택을 준비했습니다.<br><strong class="flame-product-stories-final-line">정식 출시 전, 지금 가장 먼저 만나 보세요.</strong></p>
          </div>
        </header>

        <article class="flame-product-story flame-story-edge">
          <div class="flame-product-story-copy">
            <h3>엣지 게이트웨이</h3>
            <strong>데이터가 발생하는 곳에서<br>바로 판단하고 대응.</strong>
            <p>센서 데이터를 현장에서 직접 처리해 지연 시간을 줄이고, 별도의 복잡한 서버 구성 없이 더욱 빠른 자동화와 데이터 연동을 구현합니다.</p>
            <dl class="flame-spec-sheet flame-edge-capabilities">
              <div><dt>엣지 프로세싱</dt><dd>센서 데이터를 현장에서 실시간 처리</dd></div>
              <div><dt>BMS 직접 연동</dt><dd>BACnet으로 기존 BMS와 바로 연결</dd></div>
              <div><dt>맞춤형 자동화</dt><dd>Node-RED·SDK로 현장 맞춤 로직 구현</dd></div>
              <div><dt>다양한 연결 방식</dt><dd>ALTA·Ethernet·Wi-Fi·Bluetooth 지원</dd></div>
              <div><dt>빠른 응답 속도</dt><dd>로컬 처리로 지연 시간 최소화</dd></div>
            </dl>
            <button class="flame-spec-detail-button" type="button" onclick="document.getElementById('edgeGatewaySpecsDialog').showModal()">세부 스펙 살펴보기</button>
            <dialog class="flame-spec-dialog" id="edgeGatewaySpecsDialog" onclick="if(event.target===this)this.close()">
              <div class="flame-spec-dialog-head">
                <div><span>엣지 게이트웨이</span><h4>세부 스펙</h4></div>
                <form method="dialog"><button type="submit" aria-label="세부 스펙 닫기">×</button></form>
              </div>
              <dl class="flame-spec-sheet flame-spec-dialog-sheet">
                <div><dt>모델</dt><dd>엣지 게이트웨이</dd></div>
                <div><dt>CPU</dt><dd>Cortex-A53</dd></div>
                <div><dt>RAM</dt><dd>1 GB LPDDR2 SDRAM</dd></div>
                <div><dt>저장 용량</dt><dd>16 GB</dd></div>
                <div><dt>운영체제</dt><dd>Ubuntu Linux</dd></div>
                <div><dt>입력 전원</dt><dd>5.0 VDC @ 2.5 A</dd></div>
                <div><dt>최대 정격 입력 전압</dt><dd>5.5 VDC</dd></div>
                <div><dt>LED 표시</dt><dd>연결 상태, 전원, 클라우드 서비스, 네트워크 상태</dd></div>
                <div><dt>외함 재질</dt><dd>ABS</dd></div>
                <div><dt>크기</dt><dd>5.004 × 3.8 × 1.51 in.</dd></div>
                <div><dt>무게</dt><dd>7 oz</dd></div>
                <div><dt>작동 온도</dt><dd>0 ~ +50℃<br><span class="flame-spec-note">(32 ~ 122℉)</span></dd></div>
                <div><dt>송신 출력<br><span class="flame-spec-note">(EIRP)</span></dt><dd>50 mW (900 MHz), 25 mW (868 MHz),<br>10 mW (433 MHz)</dd></div>
                <div><dt>안테나 타입</dt><dd>RPSMA 커넥터<br><span class="flame-spec-note">안테나 이득: 3.0 dBi</span></dd></div>
                <div><dt>무선 통신 거리</dt><dd>비가시거리 기준 1,200 ft 이상</dd></div>
                <div><dt>보안</dt><dd>Encrypt-RF®<br><span class="flame-spec-note">(256-bit 키 교환 및 AES-128 CBC)</span></dd></div>
              </dl>
            </dialog>
          </div>
          <figure class="flame-product-story-media"><img src="/images/flame-edge-cutout.webp" alt="Monnit 엣지 게이트웨이"></figure>
        </article>

        <article class="flame-product-story flame-story-coincell">
          <div class="flame-product-story-copy">
            <h3>코인셀 센서</h3>
            <strong>컴팩트한 크기로<br>더 자유로운 모니터링.</strong>
            <p>컴팩트하고 가벼운 디자인으로 공간 제약 없이<br>간편하게 설치할 수 있습니다.</p>
            <dl class="flame-spec-sheet">
              <div><dt>Model</dt><dd>무선 온습도/Dry Contact 센서</dd></div>
              <div><dt>Gateway</dt><dd>GETy Ethernet/IoT 연동</dd></div>
              <div><dt>사용 온도 범위</dt><dd>-10℃ ~ +60℃</dd></div>
              <div><dt>설치 장소</dt><dd>실내 전용</dd></div>
              <div><dt>외형 치수</dt><dd>32 × 17 × 29</dd></div>
            </dl>
            <button class="flame-spec-detail-button" type="button" onclick="document.getElementById('coinCellSpecsDialog').showModal()">세부 스펙 살펴보기</button>
            <dialog class="flame-spec-dialog" id="coinCellSpecsDialog" onclick="if(event.target===this)this.close()">
              <div class="flame-spec-dialog-head">
                <div><span>코인셀 센서</span><h4>세부 스펙</h4></div>
                <form method="dialog"><button type="submit" aria-label="세부 스펙 닫기">×</button></form>
              </div>
              <dl class="flame-spec-sheet flame-spec-dialog-sheet">
                <div><dt>Model</dt><dd>무선 온습도/Dry Contact 센서</dd></div>
                <div><dt>Gateway</dt><dd>GETy Ethernet/IoT 연동</dd></div>
                <div><dt>무선 주파수/변조</dt><dd>940MHz / FSK / FHSS</dd></div>
                <div><dt>전송 출력</dt><dd>+9dBm</dd></div>
                <div><dt>전원</dt><dd>CR2032</dd></div>
                <div><dt>Battery 수명</dt><dd>3년 / HB 10분 기준</dd></div>
                <div><dt>사용 온도 범위</dt><dd>-10℃ ~ +60℃<br><span class="flame-spec-note">(결로가 없을 것)</span></dd></div>
                <div><dt>설치 장소</dt><dd>실내 전용<br><span class="flame-spec-note">(Indoor use)</span></dd></div>
                <div><dt>외형 치수</dt><dd>32 × 17 × 29<br><span class="flame-spec-note">(W×H×D)</span></dd></div>
              </dl>
            </dialog>
          </div>
          <figure class="flame-product-story-media"><img src="/images/flame-coincell-cutout.webp" alt="Monnit 코인셀 센서"></figure>
        </article>

        <article class="flame-product-story flame-story-detector">
          <div class="flame-product-story-copy">
            <h3>불꽃 감지기</h3>
            <strong>UV 방식으로<br>화재 징후를<br>정밀하게 감지.</strong>
            <p>정밀한 UV 감지 방식으로 불꽃을 빠르게 감지해<br>넓은 공간의 화재를 조기에 확인할 수 있습니다.</p>
            <dl class="flame-spec-sheet">
              <div><dt>Model</dt><dd>무선불꽃감지센서</dd></div>
              <div><dt>감지 방식</dt><dd>자외선 감지 방식</dd></div>
              <div><dt>감지 거리</dt><dd>최대 10m</dd></div>
              <div><dt>감지 각도</dt><dd>정면 기준 약 120° 원뿔 형태</dd></div>
              <div><dt>설치 장소</dt><dd>실내 전용</dd></div>
              <div><dt>외형 치수</dt><dd>Φ 120mm × H 45mm</dd></div>
            </dl>
            <button class="flame-spec-detail-button" type="button" onclick="document.getElementById('flameDetectorSpecsDialog').showModal()">세부 스펙 살펴보기</button>
            <dialog class="flame-spec-dialog" id="flameDetectorSpecsDialog" onclick="if(event.target===this)this.close()">
              <div class="flame-spec-dialog-head">
                <div><span>불꽃 감지기</span><h4>세부 스펙</h4></div>
                <form method="dialog"><button type="submit" aria-label="세부 스펙 닫기">×</button></form>
              </div>
              <dl class="flame-spec-sheet flame-spec-dialog-sheet">
                <div><dt>Model</dt><dd>무선불꽃감지센서</dd></div>
                <div><dt>감지 방식</dt><dd>자외선 감지 방식<br><span class="flame-spec-note">(Ultraviolet Rays, 185 ~ 260nm)</span></dd></div>
                <div><dt>감지 거리</dt><dd>최대 10m<br><span class="flame-spec-note">(7cm 불꽃 기준)</span></dd></div>
                <div><dt>감지 각도</dt><dd>정면 기준 약 120° 원뿔 형태</dd></div>
                <div><dt>전원 공급</dt><dd>AA 알칼리 건전지 2개 (LR6 3V)<br>또는 외부 DC 10 ~ 30V</dd></div>
                <div><dt>소비 전류<br><span class="flame-spec-note">(DC 전원)</span></dt><dd>대기 시: 9mA 이하<br>경보 시: 220mA 이하</dd></div>
                <div><dt>경보 출력</dt><dd class="flame-spec-multiline"><span>· RED LED (점멸)</span><span>· Sound (8Ohm, 1.5W)</span><span>· Open Collector (NO, NC 2개)</span><span>· Option: GETy 무선 (Sub-1GHz)</span></dd></div>
                <div><dt>사용 온도 범위</dt><dd>-10℃ ~ +60℃<br><span class="flame-spec-note">(결로가 없을 것)</span></dd></div>
                <div><dt>설치 장소</dt><dd>실내 전용<br><span class="flame-spec-note">(Indoor use)</span></dd></div>
                <div><dt>외형 치수</dt><dd>Φ 120mm × H 45mm</dd></div>
                <div><dt>중량</dt><dd>약 230g<br><span class="flame-spec-note">(배터리 무게 포함)</span></dd></div>
              </dl>
            </dialog>
          </div>
          <figure class="flame-product-story-media"><img src="/images/flame-detector-cutout.webp" alt="Monnit 불꽃 감지기"></figure>
        </article>

        <article class="flame-product-story flame-story-p-type">
          <div class="flame-product-story-copy">
            <h3>P형 화재 감지 센서</h3>
            <strong>기존 설비 그대로<br>전 층 화재를 한눈에.</strong>
            <p>기존 P형 화재 수신기와 연동해 건물 전 층의 화재<br>발생 여부를 실시간으로 통합 확인할 수 있습니다.</p>
            <dl class="flame-spec-sheet">
              <div><dt>Model</dt><dd>P형 소방알리미</dd></div>
              <div><dt>감지 방식</dt><dd>P형수신기 주경종/지구경종 접점</dd></div>
              <div><dt>사용 온도 범위</dt><dd>-10℃ ~ +60℃</dd></div>
              <div><dt>설치 장소</dt><dd>실내 전용</dd></div>
              <div><dt>외형 치수</dt><dd>140 × 85 × 80</dd></div>
              <div><dt>Web Server</dt><dd>장치 설정용 Web Server 내장</dd></div>
              <div><dt>휴대폰 앱</dt><dd>Android, iOS</dd></div>
            </dl>
            <button class="flame-spec-detail-button" type="button" onclick="document.getElementById('pTypeSpecsDialog').showModal()">세부 스펙 살펴보기</button>
            <dialog class="flame-spec-dialog" id="pTypeSpecsDialog" onclick="if(event.target===this)this.close()">
              <div class="flame-spec-dialog-head">
                <div><span>P형 화재 감지 센서</span><h4>세부 스펙</h4></div>
                <form method="dialog"><button type="submit" aria-label="세부 스펙 닫기">×</button></form>
              </div>
              <dl class="flame-spec-sheet flame-spec-dialog-sheet">
                <div><dt>Model</dt><dd>P형 소방알리미</dd></div>
                <div><dt>감지 방식</dt><dd>P형수신기 주경종/지구경종<br><span class="flame-spec-note">(DC24V) 접점</span></dd></div>
                <div><dt>감지 채널</dt><dd>8채널, RS485 확장 가능</dd></div>
                <div><dt>채널 보호</dt><dd>Photo Coupler Isolation</dd></div>
                <div><dt>감지 전원</dt><dd>DC 10~24V, 10mA</dd></div>
                <div><dt>전원</dt><dd>USB Type-C, 5V/200mA</dd></div>
                <div><dt>경보 해제</dt><dd>1채널, Solid Switch</dd></div>
                <div><dt>사용 온도 범위</dt><dd>-10℃ ~ +60℃<br><span class="flame-spec-note">(결로가 없을 것)</span></dd></div>
                <div><dt>설치 장소</dt><dd>실내 전용<br><span class="flame-spec-note">(Indoor use)</span></dd></div>
                <div><dt>외형 치수</dt><dd>140 × 85 × 80<br><span class="flame-spec-note">(W×H×D)</span></dd></div>
                <div><dt>통신방식</dt><dd>Ethernet(10Base-T), WiFi(2.4G), LTE</dd></div>
                <div><dt>표시장치</dt><dd>OLED (128×64)</dd></div>
                <div><dt>Web Server</dt><dd>장치 설정용 Web Server 내장</dd></div>
                <div><dt>휴대폰 앱</dt><dd>Android, iOS</dd></div>
              </dl>
            </dialog>
          </div>
          <figure class="flame-product-story-media"><img src="/images/flame-p-type-fireshield-cutout.webp" alt="Monnit P형 화재 감지 센서"></figure>
        </article>
      </section>

      <section class="flame-immersive" aria-labelledby="flameImmersiveTitle">
        <div class="flame-immersive-sticky">
          <video class="flame-immersive-media" autoplay muted loop playsinline preload="metadata"
                 poster="/images/flame-product-overview.webp"
                 aria-label="Monnit 차세대 화재 감지 솔루션 영상">
            <source src="/videos/flame-immersive-4k-web.mp4?v=3" type="video/mp4">
          </video>
          <span class="flame-immersive-shade" aria-hidden="true"></span>
          <div class="flame-immersive-copy">
            <span>MONNIT KOREA</span>
            <h2 id="flameImmersiveTitle">기술의 한계를 넘어<br>현장의 가능성을 넓히다.</h2>
            <button class="flame-immersive-cta" type="button" onclick="scrollToFlameReservationForm()">사전 예약 신청하기</button>
          </div>
          <button class="flame-immersive-toggle" type="button" aria-label="모션 일시정지" aria-pressed="false" onclick="toggleFlameImmersive(this)">
            <span aria-hidden="true">Ⅱ</span>
          </button>
        </div>
      </section>

      <section class="flame-reservation-apply" id="flameReservationForm" aria-labelledby="flameReservationFormTitle">
        <div class="flame-reservation-apply-head">
          <span class="flame-kicker">PRE-REGISTRATION</span>
          <h2 id="flameReservationFormTitle">프로모션 <em>사전 신청</em></h2>
          <p>정보를 남겨주시면 담당자가 빠르게 연락드립니다.</p>
        </div>
        <form id="flameReservationApplyForm" class="promo-apply-form flame-reservation-form" onsubmit="return submitFlameReservationApply(event)">
          <div class="paf-row paf-row-full">
            <label class="paf-field paf-full">
              <span>신청 프로모션 <b>*</b></span>
              <select id="frfPromo" disabled><option>사전 예약 프로모션</option></select>
            </label>
          </div>
          <div class="paf-row">
            <label class="paf-field"><span>이름 / 직급 <b>*</b></span><input type="text" id="frfName" placeholder="예: 홍길동 / 설비팀장" required></label>
            <label class="paf-field"><span>회사명 <b>*</b></span><input type="text" id="frfCompany" placeholder="예: (주)모넷코리아" required></label>
          </div>
          <div class="paf-row">
            <label class="paf-field"><span>전화번호 <b>*</b></span><input type="tel" id="frfPhone" placeholder="예: 010-1234-5678" required></label>
            <label class="paf-field"><span>이메일 <b>*</b></span><input type="email" id="frfEmail" placeholder="예: name@company.com" required></label>
          </div>
          <div class="paf-row">
            <label class="paf-field">
              <span>예약 희망 제품 <b>*</b></span>
              <select id="frfProduct" required>
                <option value="">— 제품을 선택하세요 —</option>
                <option value="불꽃 감지기">불꽃 감지기</option>
                <option value="P형 화재 감지 센서">P형 화재 감지 센서</option>
                <option value="코인셀 센서">코인셀 센서</option>
                <option value="엣지 게이트웨이">엣지 게이트웨이</option>
              </select>
            </label>
            <label class="paf-field"><span>문의 사항</span><input type="text" id="frfMemo" placeholder="추가로 남기실 내용 (선택)"></label>
          </div>
          <div class="paf-actions">
            <span id="frfStatus" class="paf-status" aria-live="polite"></span>
            <button type="submit" class="cta-primary" id="frfSubmit">신청하기</button>
          </div>
        </form>
      </section>

    </div>`;
}

function scrollToFlameReservationForm(){
  const form = document.getElementById('flameReservationForm');
  if (form) form.scrollIntoView({ behavior:'smooth', block:'start' });
}

async function submitFlameReservationApply(e){
  e.preventDefault();
  const g = id => (document.getElementById(id)?.value || '').trim();
  const name = g('frfName'), company = g('frfCompany'), phone = g('frfPhone');
  const email = g('frfEmail'), product = g('frfProduct'), memo = g('frfMemo');
  const status = document.getElementById('frfStatus');
  const btn = document.getElementById('frfSubmit');
  if (!name || !company || !phone || !email || !product){
    if (status){ status.textContent = '필수 항목(*)을 모두 입력해 주세요.'; status.className = 'paf-status err'; }
    return false;
  }
  const payload = {
    '신청 프로모션': '사전 예약 프로모션',
    '이름/직급': name,
    '회사명': company,
    '전화번호': phone,
    '이메일': email,
    '예약 희망 제품': product,
    '문의 사항': memo || '(없음)',
    '접수 경로': '사전 예약 프로모션 상세 페이지'
  };
  const pay = window.MonnitLead
    ? window.MonnitLead.build('contact', 'flame_reservation_apply', '사전 예약 프로모션 신청 — ' + company, payload)
    : Object.assign(payload, { _subject: '[모넷·접수] 사전 예약 프로모션 신청 — ' + company });
  if (status){ status.textContent = ''; status.className = 'paf-status'; }
  const result = await sendLead(pay, btn);
  if (result === true && window.MonnitLead) window.MonnitLead.track('contact', { page:'flame_reservation_apply', interest:product });
  if (result === true){
    if (status){ status.textContent = '✓ 신청이 접수되었습니다. 담당자가 곧 연락드립니다.'; status.className = 'paf-status ok'; }
    e.currentTarget.reset();
  } else if (result === 'mailto'){
    if (status){ status.textContent = '메일 앱으로 신청 내용을 작성합니다. 전송 버튼을 눌러 완료해 주세요.'; status.className = 'paf-status'; }
  } else if (status){
    status.textContent = '전송에 실패했습니다. 잠시 후 다시 시도하거나 korea@monnit.com 으로 연락 주세요.';
    status.className = 'paf-status err';
  }
  return false;
}

function updateFlameImmersive(){
  const section = document.querySelector('.flame-immersive');
  if (!section) return;
  const rect = section.getBoundingClientRect();
  const travel = Math.max(1, section.offsetHeight - window.innerHeight);
  const progress = Math.max(0, Math.min(1, -rect.top / travel));
  const expandProgress = 1 - Math.pow(1 - progress, 1.45);
  const compact = window.innerWidth <= 640;
  const startWidth = compact ? 90 : 78;
  const startHeight = compact ? 56 : 58;
  section.classList.toggle('is-active', rect.top <= 0 && rect.bottom >= window.innerHeight);
  section.classList.toggle('is-past', rect.bottom < window.innerHeight);
  if (!section.classList.contains('is-paused')) {
    section.style.setProperty('--flame-immersive-progress', progress.toFixed(4));
    section.style.setProperty('--flame-frame-width', `${startWidth + expandProgress * (100 - startWidth)}vw`);
    section.style.setProperty('--flame-frame-height', `${startHeight + expandProgress * (100 - startHeight)}vh`);
    section.style.setProperty('--flame-frame-radius', `${Math.max(0, 34 * (1 - expandProgress))}px`);
  }
}

function initFlameImmersive(){
  const section = document.querySelector('.flame-immersive');
  if (!section) return;
  const video = section.querySelector('video');
  if (video) {
    video.muted = true;
    const startVideo = () => video.play().catch(() => {});
    if (video.readyState >= 2) startVideo();
    else video.addEventListener('canplay', startVideo, { once: true });
  }
  updateFlameImmersive();
  if (window.__flameImmersiveBound) return;
  window.__flameImmersiveBound = true;
  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateFlameImmersive();
      ticking = false;
    });
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
}

function toggleFlameImmersive(button){
  const section = button && button.closest('.flame-immersive');
  if (!section) return;
  const paused = section.classList.toggle('is-paused');
  button.setAttribute('aria-pressed', paused ? 'true' : 'false');
  button.setAttribute('aria-label', paused ? '모션 재생' : '모션 일시정지');
  const icon = button.querySelector('span');
  if (icon) icon.textContent = paused ? '▶' : 'Ⅱ';
  const video = section.querySelector('video');
  if (video) {
    if (paused) video.pause();
    else video.play().catch(() => {});
  }
  if (!paused) updateFlameImmersive();
}

function selectFlameFeature(button){
  const section = button && button.closest('.flame-explorer');
  if (!section) return;
  const stage = section.querySelector('.flame-explorer-stage');
  if (stage && stage.classList.contains('is-expanded') && button.classList.contains('is-active')) {
    closeFlameFeature(button);
    return;
  }
  const index = Number(button.dataset.index || 0);
  if (stage) {
    stage.classList.add('is-expanded');
    stage.dataset.activeIndex = String(index);
    stage.dataset.view = String(index);
  }
  section.querySelectorAll('.flame-explorer-tab').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.setAttribute('aria-expanded', active ? 'true' : 'false');
    const icon = tab.querySelector('.flame-explorer-icon');
    if (icon) icon.textContent = '+';
  });
  const image = section.querySelector('.flame-explorer-visual img');
  if (image && button.dataset.image) {
    image.src = button.dataset.image;
    image.alt = `Monnit ${button.dataset.title || '신제품'}`;
    image.classList.remove('is-moving');
    void image.offsetWidth;
    image.classList.add('is-moving');
  }
}

function closeFlameFeature(control){
  const section = control && control.closest('.flame-explorer');
  const stage = section && section.querySelector('.flame-explorer-stage');
  if (!section || !stage) return;
  stage.classList.remove('is-expanded');
  delete stage.dataset.activeIndex;
  delete stage.dataset.view;
  section.querySelectorAll('.flame-explorer-tab').forEach(tab => {
    tab.classList.remove('is-active');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-expanded', 'false');
  });
}

function stepFlameFeature(control, direction){
  const section = control && control.closest('.flame-explorer');
  if (!section) return;
  const tabs = [...section.querySelectorAll('.flame-explorer-tab')];
  if (!tabs.length) return;
  const stage = section.querySelector('.flame-explorer-stage');
  const current = Number(stage && stage.dataset.activeIndex || 0);
  const next = (current + direction + tabs.length) % tabs.length;
  selectFlameFeature(tabs[next]);
}

function openPromo(id, fromHash){
  const p = PROMOS.find(x => x.id === id);
  if (!p) {
    // 존재하지 않는 프로모션 id → 목록으로 안전 복귀 (빈 페이지 방지)
    if (typeof closePromo === 'function') closePromo(fromHash);
    return;
  }
  // 기간이 지났거나 아직 시작 전이면 상세로 들어가지 못하게 막고 안내창을 띄웁니다
  // (주소창에 #promotions/fire 를 직접 입력해도 동일하게 차단됩니다)
  if (p.status !== 'active'){
    if (typeof closePromo === 'function') closePromo(true);
    try { history.replaceState(null, '', '#promotions'); } catch(e){}
    showPromoGate(p);
    return;
  }
  if (p.link){ window.location.href = p.link; return; }
  const view = document.getElementById('promoDetail');
  const body = document.getElementById('promoDetailBody');
  const titleEl = document.getElementById('promoDetailTitle');
  if (!view || !body) return;
  view.classList.toggle('is-flame-detail', id === 'flame-reservation');
  if (titleEl) {
    titleEl.textContent = p.title || '프로모션';
    titleEl.style.display = id === 'flame-reservation' ? 'none' : '';
  }
  // 이미지 방식: images를 세로로 나열 (표시 폭은 CSS max-width로 제한 → 데스크탑/모바일 모두 적정 크기). 없으면 html, 그것도 없으면 안내
  if (id === 'flame-reservation'){
    body.innerHTML = flameReservationHTML();
    requestAnimationFrame(initFlameImmersive);
  } else if (p.images && p.images.length){
    body.innerHTML = '<div class="promo-images">' +
      p.images.map(src => `<img src="${esc(src)}" alt="${esc(p.title)}" loading="lazy">`).join('') +
      '</div>';
  } else if (p.html && p.html.trim()){
    body.innerHTML = p.html;
  } else {
    let _lg='ko'; try{ _lg=localStorage.getItem('mlang')||'ko'; }catch(e){}
    const _en=(_lg==='en');
    body.innerHTML = comingSoonHTML({
      pad:'56px 20px 24px',
      title: esc(p.title||'') || (_en?'Details in preparation':'상세 내용을 준비 중입니다'),
      sub: _en ? 'Details are being prepared. Leave your contact and we will send the full offer within 24 hours.'
               : '상세 내용을 준비 중입니다.<br>연락처를 남겨 주시면 <b>24시간 안에</b> 자세한 혜택 안내를 보내드립니다.',
      back: [['promotions',_en?'Other promotions':'다른 프로모션'],['applications',_en?'All applications':'전체 활용분야'],
             ['home',_en?'Home':'홈']]
    });
    bindComingSoon(body, { memo: (p.title||'')+' 프로모션 문의' });
  }
  // 상세 하단에 '이 프로모션 신청하기' 버튼
  const applyBtn = document.getElementById('promoDetailApply');
  if (applyBtn){
    applyBtn.onclick = () => applyForPromo(p.title);
    applyBtn.style.display = id === 'flame-reservation' ? 'none' : 'inline-flex';
  }
  const applyTop = document.getElementById('promoDetailApplyTop');
  if (applyTop){
    applyTop.onclick = () => applyForPromo(p.title);
    applyTop.style.display = id === 'flame-reservation' ? 'none' : 'inline-flex';
  }
  document.getElementById('promoList').style.display = 'none';
  view.style.display = 'block';
  // 브라우저 뒤로가기 연동: 상세를 히스토리에 추가 (해시에 프로모션 id)
  if (!fromHash){
    setURL('promotions/' + encodeURIComponent(id));
  }
  window.scrollTo({top:0, behavior: id === 'flame-reservation' ? 'auto' : 'smooth'});
}
function closePromo(toHash){
  const view = document.getElementById('promoDetail');
  const list = document.getElementById('promoList');
  if (view) {
    view.style.display = 'none';
    view.classList.remove('is-flame-detail');
  }
  if (list) list.style.display = 'block';
  const body = document.getElementById('promoDetailBody');
  if (body) body.innerHTML = '';
  // 목록으로 돌아가면 해시도 목록 상태로 (뒤로가기가 아닌 버튼 클릭 시)
  if (!toHash){
    if (pathToRoute(location.pathname).indexOf('promotions/')===0) setURL('promotions');
  }
}
// 브라우저 뒤로/앞으로 버튼 대응 (프로모션 상세)
window.addEventListener('popstate', function(){
  const h = pathToRoute(location.pathname);
  if (h.indexOf('promotions/')===0){
    const id = decodeURIComponent(h.slice('promotions/'.length));
    if (typeof navigate==='function') navigate('promotions');
    setTimeout(()=>openPromo(id, true), 30);
  } else if (h === 'promotions'){
    if (typeof closePromo==='function') closePromo(true);
  }
});
async function submitPromoApply(e){
  e.preventDefault();
  const g = id => (document.getElementById(id)?.value || '').trim();
  const promo = g('pafPromo'), name = g('pafName'), company = g('pafCompany');
  const phone = g('pafPhone'), email = g('pafEmail'), qty = g('pafQty'), memo = g('pafMemo');
  const status = document.getElementById('pafStatus');
  const btn = document.getElementById('pafSubmit');
  if (!promo || !name || !company || !phone || !email || (promo === '사전 예약 프로모션' && !qty)){
    if (status){ status.textContent = '필수 항목(*)을 모두 입력해 주세요.'; status.className = 'paf-status err'; }
    return false;
  }
  const payload = {
    '신청 프로모션': promo,
    '이름/직급': name,
    '회사명': company,
    '전화번호': phone,
    '이메일': email,
    '문의 사항': memo || '(없음)',
    '접수 경로': '프로모션 사전신청'
  };
  payload[promo === '사전 예약 프로모션' ? '예약 희망 제품' : '구매 희망 수량'] = qty || '(미기재)';
  if (status){ status.textContent = ''; status.className = 'paf-status'; }
  const _pay = window.MonnitLead ? window.MonnitLead.build('contact', 'promo_apply', promo + ' 사전신청 — ' + company, payload)
                                 : Object.assign(payload, { _subject: '[모넷·접수] ' + promo + ' 사전신청 — ' + company });
  const result = await sendLead(_pay, btn);
  if (result === true && window.MonnitLead) window.MonnitLead.track('contact', { page: 'promo_apply', interest: promo });
  if (result === true){
    if (status){ status.textContent = '✓ 신청이 접수되었습니다. 담당자가 곧 연락드립니다.'; status.className = 'paf-status ok'; }
    document.getElementById('promoApplyForm').reset();
  } else if (result === 'mailto'){
    if (status){ status.textContent = '메일 앱으로 신청 내용을 작성합니다. 전송 버튼을 눌러 완료해 주세요.'; status.className = 'paf-status'; }
  } else {
    if (status){ status.textContent = '전송에 실패했습니다. 잠시 후 다시 시도하거나 korea@monnit.com 으로 연락 주세요.'; status.className = 'paf-status err'; }
  }
  return false;
}
function openApplyForm(){
  // 접힌 사전신청 폼 펼치기
  const form = document.getElementById('promoApplyForm');
  const prompt = document.getElementById('promoApplyPrompt');
  if (prompt) prompt.style.display = 'none';
  if (form){ form.hidden = false; form.classList.add('is-open'); }
  return form;
}
function applyForPromo(title){
  // 상세페이지 '이 프로모션 신청' → 목록으로 돌아가 폼을 펼치고 프로모션 미리 선택 + 스크롤
  closePromo();
  setTimeout(() => {
    const form = openApplyForm();
    const sel = document.getElementById('pafPromo');
    if (sel && title){ sel.value = title; updatePromoApplyFields(); }
    if (form) form.scrollIntoView({behavior:'smooth', block:'center'});
  }, 100);
}
function renderNewsHighlights(){
  const el = document.getElementById('newsHighlights'); if (!el) return;
  el.innerHTML = NEWS_HIGHLIGHTS.map(h => {
    const inner = `<div class="svc-n">▸</div><div><h4>${esc(h.title)}</h4><p>${esc(h.desc)}</p></div>`;
    return h.url
      ? `<a class="svc-row res-link" href="${esc(h.url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="svc-row">${inner}</div>`;
  }).join('');
}
function renderWhitepapers(){
  const el = document.getElementById('wpList'); if (!el) return;
  const cats = uniqCats(WHITEPAPERS);
  renderCatBar('wpCatBar', WHITEPAPERS.length, cats, pageState.wpCat, c => { pageState.wpCat=c; pageState.wp=1; renderWhitepapers(); });
  let list = (pageState.wpCat==='all') ? WHITEPAPERS.slice() : WHITEPAPERS.filter(w => (w.category||'')===pageState.wpCat);
  const per = 6, total = list.length, pages = Math.ceil(total/per) || 1;
  pageState.wp = Math.min(Math.max(1, pageState.wp), pages);
  const start = (pageState.wp - 1) * per;
  el.innerHTML = list.slice(start, start + per).map(w => {
    const gi = WHITEPAPERS.indexOf(w);
    const glyph = `<span class="wp-glyph">${esc(w.icon||'▤')}</span>`;
    // 외부(Unsplash) 이미지가 막히거나 실패하면 로컬 표지 썸네일로 1회 대체, 그마저 실패하면 글리프만 남긴다
    const fb  = w.thumb ? ` data-fb="${esc(w.thumb)}"` : '';
    const onerr = w.thumb
      ? "if(this.dataset.fb&&this.src.indexOf(this.dataset.fb)&lt;0){this.src=this.dataset.fb;}else{this.remove();}"
      : "this.remove();";
    const img = w.photo ? `<img class="wp-img" src="${esc(w.photo)}" alt="${esc(w.title)}" loading="lazy"${fb} onerror="${onerr}">` : '';
    const media = `<div class="wp-media">${glyph}${img}</div>`;
    const body = `<div class="wp-body"><h4>${esc(w.title)}</h4><p>${esc(w.desc)}</p><span class="b-link wp-dl-hint" style="margin-top:8px;display:inline-block;">이메일 입력 후 다운로드 →</span></div>`;
    const cls = 'wp-card wp-pick' + (w.photo ? ' has-photo' : '');
    return `<button type="button" class="${cls}" data-wpi="${gi}" onclick="pickWhitepaper(${gi})">${media}${body}</button>`;
  }).join('');
  populateWpSelect();
  renderPager(el, 'wpPager', total, per, pageState.wp, g=>{ pageState.wp=g; renderWhitepapers(); el.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function renderFaqs(){
  const el = document.getElementById('faqList'); if (!el) return;
  el.innerHTML = FAQS.map(f => `
    <div class="faq-item">
      <h3 class="faq-h"><button class="faq-q">${esc(f.q)}</button></h3>
      <div class="faq-a"><div class="faq-a-inner">${esc(f.a)}</div></div>
    </div>`).join('');
  wireSupportFaq();
}
/* 2026-10-20 — 자주 묻는 질문을 기술지원 지식베이스(js/support-kb.js)로 확장.
   검색·분류·문제 해결 단계 + 「해결 안 됨 → 모니와 이어서 확인 → 접수」.
   FAQ 화면이 열릴 때만 불러온다(다른 페이지 무게 0). 불러오지 못하면 위의 기본 FAQ 가 그대로 보인다.
   시트(CMS)의 FAQS 는 「도입 전 궁금해요」 분류로 함께 보여 준다. */
let _faqSupportWired = false, _faqSupportDone = false;
function wireSupportFaq(){
  const view = document.getElementById('view-faqs'), list = document.getElementById('faqList');
  if (!view || !list) return;
  const run = () => {
    if (!view.classList.contains('active')) return;
    let host = document.getElementById('faqSupport');
    if (!host){ host = document.createElement('div'); host.id = 'faqSupport'; list.parentNode.insertBefore(host, list); }
    const go = () => { if (!window.MKSupport) return; if (host._faqs === FAQS) return; host._faqs = FAQS; window.MKSupport.renderFaq(host, FAQS); window.MKSupport.ensure(K => { if (K){ list.hidden = true; _faqSupportDone = true; } }); };
    if (window.MKSupport) return go();
    if (window.__spLoading) return; window.__spLoading = true;
    const sc = document.createElement('script'); sc.src = '/js/support-chat.js?v=3'; sc.async = true;
    sc.onload = () => { window.__spLoading = false; go(); }; sc.onerror = () => { window.__spLoading = false; };
    document.head.appendChild(sc);
  };
  if (_faqSupportDone) { run(); return; }
  if (!_faqSupportWired){ _faqSupportWired = true; try { new MutationObserver(run).observe(view, { attributes:true, attributeFilter:['class'] }); } catch(e){} }
  run();
}
let kbState = { view:'home', cat:null, search:'', page:1, docId:null, ret:null };
let kbWired = false;
const ICO = {
  waves:   '<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7.5 12a4.5 4.5 0 0 1 9 0"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  gateway: '<rect x="3" y="13" width="18" height="7" rx="1.6"/><circle cx="7" cy="16.5" r="1" fill="currentColor" stroke="none"/><path d="M12 13V7.5"/><path d="M8.5 7.5a3.5 3.5 0 0 1 7 0"/><path d="M6 5a6 6 0 0 1 12 0"/>',
  cloud:   '<path d="M7.5 18.5A4.25 4.25 0 0 1 7 10.05a5 5 0 0 1 9.62 1.3A3.6 3.6 0 0 1 16.5 18.5H7.5z"/>',
  server:  '<rect x="3.5" y="4.5" width="17" height="6" rx="1.6"/><rect x="3.5" y="13.5" width="17" height="6" rx="1.6"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="7.5" cy="16.5" r="1" fill="currentColor" stroke="none"/><path d="M14.5 7.5h3M14.5 16.5h3"/>',
  win:     '<rect x="3" y="4.5" width="18" height="13" rx="1.6"/><path d="M3 9h18"/><path d="M9 20.5h6"/><path d="M12 17.5v3"/>',
  addon:   '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  video:   '<rect x="3" y="6" width="18" height="12" rx="2.4"/><path d="M10.3 9.4l4.6 2.6-4.6 2.6z" fill="currentColor" stroke="none"/>',
  alert:   '<path d="M12 3.4l8.5 15.1H3.5z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r="1.05" fill="currentColor" stroke="none"/>',
  doc:     '<path d="M7 3.2h6.5L18 7.7V20.8H7z"/><path d="M13.5 3.2v4.5H18"/><path d="M9.6 12.5h6M9.6 15.8h6"/>'
};
/* 카테고리 이름 ↔ URL 슬러그 — 이 표가 유일한 출처입니다.
   build.js 가 app.js 를 읽어 이 표로 /kb/<슬러그> · /guide/<슬러그> 페이지를 만들고,
   아래 navigate() 가 같은 표를 뒤집어 그 주소를 다시 카테고리로 되돌립니다.
   예전에는 이 표가 build.js 에만 있어서, 카테고리 페이지를 추가해도 라우터는
   그 주소를 몰랐고 → 전부 홈으로 폴백하며 주소가 '/' 로 바뀌었습니다. */
const CAT_SLUG_MAP = {
  'Scube 플랫폼': 'scube', '센서': 'sensor', '게이트웨이': 'gateway', '소프트웨어': 'software', '액세서리': 'accessory',
  '문서/가이드': 'docs', '온프라미스': 'onprem', 'iMonnit Online': 'imonnit-online',
  '온프레미스 소프트웨어': 'onprem-software', '애드온 기기': 'addon', '지원 동영상': 'videos', '기기 손상': 'damage'
};
const CAT_BY_SLUG = (function(){ const o={}; for (const k in CAT_SLUG_MAP) o[CAT_SLUG_MAP[k]] = k; return o; })();

const KB_CATS = [
  { name:'Scube 플랫폼',        ico:ICO.win,     color:'#22C55E' },
  { name:'센서',                ico:ICO.waves,   color:'#18D0E6' },
  { name:'게이트웨이',           ico:ICO.gateway, color:'#3B82F6' },
  { name:'iMonnit Online',      ico:ICO.cloud,   color:'#0EA5E9' },
  { name:'온프레미스 소프트웨어',  ico:ICO.server,  color:'#8B5CF6' },
  { name:'애드온 기기',          ico:ICO.addon,   color:'#F59E0B' },
  { name:'지원 동영상',          ico:ICO.video,   color:'#EF4444' },
  { name:'기기 손상',            ico:ICO.alert,   color:'#F43F5E' }
];
function kbWire(){
  if (kbWired) return; kbWired = true;
  const s = document.getElementById('kbSearch');
  const clr = document.getElementById('kbSearchClear');
  if (s) s.addEventListener('input', e => {
    kbState.search = e.target.value.trim(); kbState.page = 1;
    if (clr) clr.style.display = e.target.value ? 'block' : 'none';
    renderKnowledgebase();
  });
  if (clr) clr.addEventListener('click', () => {
    const i = document.getElementById('kbSearch'); if (i) i.value = '';
    kbState.search = ''; clr.style.display = 'none'; renderKnowledgebase();
  });
}
function kbHome(){ kbState.view='home'; kbState.cat=null; kbState.page=1; renderKnowledgebase(); }
function kbBack(){
  const r = kbState.ret || { view:'home' };
  kbState.view = r.view || 'home'; kbState.cat = r.cat || null;
  kbState.search = r.search || ''; kbState.page = r.page || 1;
  const s = document.getElementById('kbSearch'); if (s) s.value = kbState.search;
  const clr = document.getElementById('kbSearchClear'); if (clr) clr.style.display = kbState.search ? 'block' : 'none';
  renderKnowledgebase();
  document.getElementById('view-knowledgebase').scrollIntoView({behavior:'smooth',block:'start'});
}
function kbRenderList(grid, list){
  const per = 12, total = list.length, pages = Math.ceil(total/per) || 1;
  kbState.page = Math.min(Math.max(1, kbState.page), pages);
  const start = (kbState.page - 1) * per;
  grid.innerHTML = list.slice(start, start + per).map(k => `
    <button class="kb-card" data-id="${esc(k.id||'')}"><div class="kb-cat">${esc(k.category)}</div><h3>${esc(k.title)}</h3><p>${esc(k.desc)}</p><span class="kb-more">전체 보기 →</span></button>`).join('')
    || '<p style="color:var(--ink-soft);padding:24px 0;">일치하는 문서가 없습니다.</p>';
  grid.querySelectorAll('.kb-card[data-id]').forEach(c => {
    c.onclick = () => {
      kbState.ret = { view: kbState.view, cat: kbState.cat, search: kbState.search, page: kbState.page };
      kbState.view = 'doc'; kbState.docId = c.dataset.id;
      renderKnowledgebase();
      document.getElementById('view-knowledgebase').scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
  renderPager(grid, 'kbPager', total, per, kbState.page, g => { kbState.page=g; renderKnowledgebase(); grid.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function renderKnowledgebase(){
  const grid = document.getElementById('kbGrid'); if (!grid) return;
  kbWire();
  const catGrid = document.getElementById('kbCatGrid');
  const listHead = document.getElementById('kbListHead');
  const pager = document.getElementById('kbPager');
  const counts = {};
  KNOWLEDGEBASE.forEach(k => { const c=(k.category||'').trim(); if(c) counts[c]=(counts[c]||0)+1; });
  grid.style.display = '';

  // 0) 문서 상세 (전체 본문)
  if (kbState.view === 'doc'){
    const d = KNOWLEDGEBASE.find(x => x.id === kbState.docId);
    if (catGrid) catGrid.style.display='none';
    if (listHead) listHead.style.display='none';
    if (pager) pager.innerHTML='';
    grid.style.display='block';
    grid.innerHTML = d ? `
      <article class="kb-article">
        <button class="kb-back" onclick="kbBack()">← 목록</button>
        <div class="kb-cat">${esc(d.category)}</div>
        <h2 class="kb-art-title">${esc(d.title)}</h2>
        <div class="kb-art-body">${d.body || ('<p>'+esc(d.desc)+'</p>')}</div>
      </article>` : '<p style="color:var(--ink-soft);padding:24px 0;">문서를 찾을 수 없습니다.</p>';
    return;
  }

  // 1) 검색 모드
  if (kbState.search){
    const q = kbState.search.toLowerCase();
    const list = KNOWLEDGEBASE.filter(k =>
      (k.title||'').toLowerCase().includes(q) ||
      (k.desc||'').toLowerCase().includes(q) ||
      (k.category||'').toLowerCase().includes(q));
    if (catGrid) catGrid.style.display='none';
    if (listHead){ listHead.style.display='flex';
      listHead.innerHTML = `<button class="kb-back" onclick="kbHome()">← 전체</button><span class="kb-title">검색 결과</span><span class="kb-count">"${esc(kbState.search)}" — ${list.length}건</span>`; }
    kbRenderList(grid, list);
    return;
  }
  // 2) 홈 — 카테고리 타일
  if (kbState.view === 'home'){
    if (catGrid) catGrid.style.display='grid';
    if (listHead) listHead.style.display='none';
    grid.innerHTML=''; if (pager) pager.innerHTML='';
    const known = KB_CATS.map(c=>c.name);
    const extras = Object.keys(counts).filter(c=>!known.includes(c)).map(c=>({name:c, ico:ICO.doc, color:'#94A3B8'}));
    const tiles = [...KB_CATS, ...extras].filter(c=>counts[c.name]);
    if (catGrid) catGrid.innerHTML = tiles.map(c=>`
      <button class="kb-cat-tile" data-cat="${esc(c.name)}" style="--ic:${c.color||'#64748B'}">
        <span class="kb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${c.ico}</svg></span>
        <span class="nm">${esc(c.name)}</span>
        <span class="ct">${counts[c.name]||0}개 문서</span>
        <span class="arr">보기 →</span>
      </button>`).join('');
    if (catGrid) catGrid.querySelectorAll('.kb-cat-tile').forEach(t=>{
      t.onclick = () => { kbState.view='list'; kbState.cat=t.dataset.cat; kbState.page=1; renderKnowledgebase();
        document.getElementById('view-knowledgebase').scrollIntoView({behavior:'smooth',block:'start'}); };
    });
    return;
  }
  // 3) 리스트 — 선택 카테고리 문서
  if (catGrid) catGrid.style.display='none';
  const list = KNOWLEDGEBASE.filter(k => (k.category||'')===kbState.cat);
  if (listHead){ listHead.style.display='flex';
    listHead.innerHTML = `<button class="kb-back" onclick="kbHome()">← 카테고리</button><span class="kb-title">${esc(kbState.cat)}</span><span class="kb-count">${list.length}개 문서</span>`; }
  kbRenderList(grid, list);
}
function renderResources(){
  renderBlog(); renderNewsHighlights(); renderWhitepapers(); renderFaqs(); renderKnowledgebase();
  if(typeof renderPromotions==='function') renderPromotions();
  renderGuides();
}

/* ========== 범용 지식베이스형 엔진 (카테고리 타일 → 목록 → 전체 본문 + 검색/필터) ========== */
function makeKBModule(cfg){
  const st = cfg.state; let wired = false;
  const $ = id => document.getElementById(id);
  function wire(){
    if (wired) return; wired = true;
    const s = $(cfg.ids.search), clr = $(cfg.ids.clear);
    if (s) s.addEventListener('input', e => { st.search = e.target.value.trim(); st.page = 1; if (clr) clr.style.display = e.target.value ? 'block' : 'none'; render(); });
    if (clr) clr.addEventListener('click', () => { const i = $(cfg.ids.search); if (i) i.value = ''; st.search = ''; clr.style.display = 'none'; render(); });
  }
  function toView(){ const v = $(cfg.ids.view); if (v) v.scrollIntoView({behavior:'smooth',block:'start'}); }
  function home(){ st.view='home'; st.cat=null; st.page=1; render(); }
  function back(){
    const r = st.ret || { view:'home' };
    st.view = r.view||'home'; st.cat = r.cat||null; st.search = r.search||''; st.page = r.page||1;
    const s = $(cfg.ids.search); if (s) s.value = st.search;
    const clr = $(cfg.ids.clear); if (clr) clr.style.display = st.search ? 'block' : 'none';
    render(); toView();
  }
  function renderList(grid, list){
    const per = 12, total = list.length, pages = Math.ceil(total/per) || 1;
    st.page = Math.min(Math.max(1, st.page), pages);
    const start = (st.page-1)*per;
    grid.innerHTML = list.slice(start, start+per).map(k => `<button class="kb-card" data-id="${esc(k.id||'')}"><div class="kb-cat">${esc(k.category)}</div><h3>${esc(k.title)}</h3><p>${esc(k.desc)}</p><span class="kb-more">전체 보기 →</span></button>`).join('')
      || '<p style="color:var(--ink-soft);padding:24px 0;">일치하는 문서가 없습니다.</p>';
    grid.querySelectorAll('.kb-card[data-id]').forEach(c => { c.onclick = () => { st.ret={view:st.view,cat:st.cat,search:st.search,page:st.page}; st.view='doc'; st.docId=c.dataset.id; render(); toView(); }; });
    renderPager(grid, cfg.ids.pager, total, per, st.page, g => { st.page=g; render(); grid.scrollIntoView({behavior:'smooth',block:'start'}); });
  }
  function render(){
    const grid = $(cfg.ids.grid); if (!grid) return; wire();
    const catGrid = $(cfg.ids.catGrid), listHead = $(cfg.ids.listHead), pager = $(cfg.ids.pager);
    const DATA = cfg.data(); const counts = {}; DATA.forEach(k => { const c=(k.category||'').trim(); if(c) counts[c]=(counts[c]||0)+1; });
    grid.style.display = '';
    if (st.view === 'doc'){
      const d = DATA.find(x => x.id === st.docId);
      if (catGrid) catGrid.style.display='none'; if (listHead) listHead.style.display='none'; if (pager) pager.innerHTML='';
      grid.style.display='block';
      grid.innerHTML = d ? `<article class="kb-article"><button class="kb-back" data-act="back">← 목록</button><div class="kb-cat">${esc(d.category)}</div><h2 class="kb-art-title">${esc(d.title)}</h2><div class="kb-art-body">${d.body || ('<p>'+esc(d.desc)+'</p>')}</div></article>` : '<p style="color:var(--ink-soft);padding:24px 0;">문서를 찾을 수 없습니다.</p>';
      const bk = grid.querySelector('[data-act="back"]'); if (bk) bk.onclick = back;
      return;
    }
    if (st.search){
      const q = st.search.toLowerCase();
      const list = DATA.filter(k => (k.title||'').toLowerCase().includes(q) || (k.desc||'').toLowerCase().includes(q) || (k.category||'').toLowerCase().includes(q));
      if (catGrid) catGrid.style.display='none';
      if (listHead){ listHead.style.display='flex'; listHead.innerHTML = `<button class="kb-back" data-act="home">← 전체</button><span class="kb-title">검색 결과</span><span class="kb-count">"${esc(st.search)}" — ${list.length}건</span>`; const hb=listHead.querySelector('[data-act="home"]'); if(hb) hb.onclick=home; }
      renderList(grid, list); return;
    }
    if (st.view === 'home'){
      if (catGrid) catGrid.style.display='grid'; if (listHead) listHead.style.display='none'; grid.innerHTML=''; if (pager) pager.innerHTML='';
      const known = cfg.cats.map(c=>c.name);
      const extras = Object.keys(counts).filter(c=>!known.includes(c)).map(c=>({name:c, ico:ICO.doc, color:'#94A3B8'}));
      const tiles = [...cfg.cats, ...extras].filter(c=>counts[c.name]);
      if (catGrid){
        catGrid.innerHTML = tiles.map(c=>`<button class="kb-cat-tile" data-cat="${esc(c.name)}" style="--ic:${c.color||'#64748B'}"><span class="kb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${c.ico}</svg></span><span class="nm">${esc(c.name)}</span><span class="ct">${counts[c.name]||0}개 문서</span><span class="arr">보기 →</span></button>`).join('');
        catGrid.querySelectorAll('.kb-cat-tile').forEach(t=>{ t.onclick=()=>{ st.view='list'; st.cat=t.dataset.cat; st.page=1; render(); toView(); }; });
      }
      return;
    }
    if (catGrid) catGrid.style.display='none';
    const list = DATA.filter(k => (k.category||'')===st.cat);
    if (listHead){ listHead.style.display='flex'; listHead.innerHTML = `<button class="kb-back" data-act="home">← 카테고리</button><span class="kb-title">${esc(st.cat)}</span><span class="kb-count">${list.length}개 문서</span>`; const hb=listHead.querySelector('[data-act="home"]'); if(hb) hb.onclick=home; }
    renderList(grid, list);
  }
  function reset(){
    st.view='home'; st.cat=null; st.search=''; st.page=1; st.docId=null; st.ret=null;
    const s=$(cfg.ids.search); if(s) s.value='';
    const clr=$(cfg.ids.clear); if(clr) clr.style.display='none';
    render();
  }
  return { render, home, back, reset };
}

/* ===== 제품 가이드 (6개 주제) — 본문에 이미지 포함 가능 =====
   GUIDES 의 body 에 <img src="이미지주소"> 를 넣으면 본문에 사진이 표시됩니다.
   (아래는 구조 확인용 샘플 — 실제 자료로 교체) */
const GUIDE_CATS = [
  { name:'센서',       ico:ICO.waves,   color:'#18D0E6' },
  { name:'게이트웨이',  ico:ICO.gateway, color:'#3B82F6' },
  { name:'소프트웨어',  ico:ICO.win,     color:'#8B5CF6' },
  { name:'액세서리',    ico:ICO.addon,   color:'#F59E0B' },
  { name:'문서/가이드', ico:ICO.doc,     color:'#14B8A6' },
  { name:'온프라미스',  ico:ICO.server,  color:'#6366F1' }
];
// GUIDES 데이터는 data.js 로 분리됨 (index.html 에서 app.js 보다 먼저 로드)
/* 지식베이스의 kbState 와 같은 방식으로 이름을 붙입니다 — 라우터가 카테고리를 지정할 수 있도록 */
let guideState = { view:'home', cat:null, search:'', page:1, docId:null, ret:null };
const guideModule = makeKBModule({
  data: () => GUIDES, cats: GUIDE_CATS, state: guideState,
  ids: { search:'gSearch', clear:'gSearchClear', catGrid:'gCatGrid', listHead:'gListHead', grid:'gGrid', pager:'gPager', view:'view-guides' }
});
function renderGuides(){ guideModule.render(); }

var PRODUCTS = [
  {c:"sensors",g:"env",n:"온도",d:"-200~+370°C 범위, 식품·백신·HVAC·데이터센터 등 온도 모니터링. NIST 인증 옵션.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/temperature/standard/TS-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"습도",d:"시설·전시·데이터센터의 상대습도(RH) 원격 모니터링. NIST 인증 옵션.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/humidity/HU-RH-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"공기질",d:"PM1·PM2.5·PM10 농도 측정으로 실내 공기질 관리.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/air-quality/AQ-P25A-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"풍속",d:"기류 속도·온도·고도 측정(병원·클린룸 등).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/air-velocity/PS-AV-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"차압",d:"두 지점의 압력차 측정(클린룸·제약·주방·HVAC).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/differential-air-pressure/PS-DP-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"토양 수분",d:"토양 수분장력·온도 측정으로 관개 최적화.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/soil-moisture/WS-WM-ADS.pdf",p:true},
  {c:"sensors",g:"env",n:"조도 (Lux)",d:"조도(Lux) 측정 — 박물관·약품·식품 등 빛에 민감한 자산 관리(0~83,000 lux).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/light-meter/LS-LM-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"조도 (PAR·광합성)",d:"PAR(광합성유효광) 측정 — 작물·재배 조명의 광량 관리(389~692nm).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/light-meter/par/LS-PAR-ADS.pdf",p:true},
  {c:"sensors",g:"power",n:"AC 전류계",d:"전류·전력 소비를 원격 측정해 설비 상태·HVAC 성능 진단.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/current-meters/CM-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"3상 전류계",d:"산업용 3상 전력 소비 모니터링. 20/150/500A 모델 제공(데이터시트 공통).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/three-phase-current-meters/3P-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"200VDC 미터",d:"0~200VDC 직류 전압을 정밀 측정(미터형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/200-VDC-meter/VM-200-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"200VDC 감지",d:"200VDC 전원의 On/Off 상태 감지(감지형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/200-volt-detection/VD-200-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"500VAC 미터",d:"0~500VAC 교류 전압을 정밀 측정(미터형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/500-VAC-meter/VM-500-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"500VAC 감지",d:"500VAC 전원의 On/Off 상태 감지(감지형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/500-volt-detection/VD-AC-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"모션·점유",d:"PIR 기반 사람·동물 움직임 및 공간 점유 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pir-motion/MS-IR-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"개폐(도어)",d:"문·창·캐비닛의 개폐 및 비인가 출입을 즉시 알림.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/open-closed/OC-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"버튼",d:"버튼을 누르면 즉시 알림(호출·점검 확인용).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/button-press/PB-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"차량 감지",d:"차량 진출입·대기시간 감지 및 카운트.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/vehicle-detection/VS-TT-ADS-01.pdf",p:true},
  {c:"sensors",g:"mech",n:"가속도·진동계",d:"3축 진동·주파수·속도·변위·가속도 측정으로 설비 예지보전.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/accelerometers/advanced-vibration/AC-ADV-ADS-01.pdf",p:true},
  {c:"sensors",g:"mech",n:"열전대",d:"K타입 등 고온 공정을 최대 400°C까지 측정.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/thermocouple/TS-TC-ADS-01.pdf",p:true},
  {c:"sensors",g:"mech",n:"저항",d:"최대 250kΩ 저항 측정, 산업·과학 장비용.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/resistance/RS-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 로프형",d:"워터 로프로 라인 전체의 누수를 감지(연장 가능).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/rope/WS-WR-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 프로브형(Detect+)",d:"프로브형 — 누수 유무에 더해 수위 단계까지 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/detect-plus/WS-WP-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 퍽형(디스크)",d:"디스크(퍽)형 — 바닥에 놓아 물 고임을 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/disc/WS-PS-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 전선형(Detect)",d:"전선(스팟)형 — 특정 지점의 누수 유무를 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/detect/WS-WD-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"압력계",d:"기체·액체·증기 라인 압력 측정. 50/300/750/3000 PSIG 모델(데이터시트 공통).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pressure-meters/PS-000-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"초음파 거리",d:"액위·재고·통행 감지를 위한 거리 측정.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/ultrasonic-ranging/US-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"프로판 탱크",d:"R3D 게이지 연동으로 프로판 잔량을 원격 모니터링.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/propane-tank-level/HE-MG-ADS-01.pdf",p:true},
  {c:"sensors",g:"gas",n:"일산화탄소(CO)",d:"일산화탄소(CO) 농도 감지 및 임계 초과 시 알림.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/gas-detection/CO/GS-C1-ADS-01.pdf",p:true},
  {c:"sensors",g:"gas",n:"이산화탄소(CO2)",d:"이산화탄소(CO2) 농도 감지 — 실내 공기질·환기 관리.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/gas-detection/CO2/GS-C2-ADS-01.pdf",p:true},
  {c:"sensors",g:"gas",n:"황화수소(H2S)",d:"황화수소(H2S) 농도 감지 — 작업장 안전·규정 준수.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/gas-detection/H2S/GS-H2S-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"드라이컨택",d:"건접점(Dry Contact) 개폐 상태 모니터링.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/dry-contact/DC-CF-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"5채널 드라이컨택",d:"건접점 5채널 입력 — 여러 접점을 한 센서로 모니터링.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/5-input/DC-05-ADS.pdf",p:true},
  {c:"sensors",g:"iface",n:"0-5VDC",d:"0~5VDC 아날로그 전압 입력 계측.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/5-VDC/VM-005-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"0-10VDC",d:"0~10VDC 아날로그 전압 입력 계측.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/5-VDC/VM-005-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"0-20mA",d:"0~20mA 아날로그 전류 루프 입력 계측.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/20mA/MA-020-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"저항 브리지",d:"저항 브리지 입력 — 로드셀·스트레인게이지 등 아날로그 계측기 연결.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/resistive-bridge/RS-BR-ADS.pdf",p:true},
  {c:"sensors",g:"iface",n:"펄스 카운터 — 싱글",d:"단일 펄스 입력 카운트 — 미터·스위치·릴레이.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pulse-counter/PC-01-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"펄스 카운터 — 듀얼",d:"2채널 펄스 카운트 — 한전 전력량계 등 연결.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pulse-counter/PC-02-ADS.pdf",p:true},
  {c:"gateways",g:"",n:"북미 IoT 셀룰러 게이트웨이",d:"4G LTE CAT-M1/NB2 기반 원거리 셀룰러 IoT 연결.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/4G-LTE/LTE-CCE-ND-ADS-01.pdf",p:true},
  {c:"gateways",g:"",n:"인터내셔널 셀룰러 게이트웨이",d:"약 90개국 지원 ALTA IoT 셀룰러 게이트웨이(SIM 카드 정보 별도 안내).",u:"https://monnit.blob.core.windows.net/site/documents/gateways/IoT/CME-CCE-ADS.pdf",p:true},
  {c:"gateways",g:"",n:"이더넷 게이트웨이",d:"최대 100~4,000개 센서 수용, PC 없이 iMonnit 연동.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/EGW4/EGW-CCE-EGW4-ADS-01.pdf",p:true},
  {c:"gateways",g:"",n:"시리얼 Modbus 게이트웨이",d:"RS-232C·RS-485 Modbus 인프라에 센서 최대 50개 연동.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/serial-modbus/SG-SMG-ADS-01.pdf",p:true},
  {c:"gateways",g:"",n:"센서 어댑터 (USB)",d:"USB로 PC·서드파티 게이트웨이에 무선 센서 연동.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/sensor-adapter/WSA-USB-ADS-01.pdf",p:true},
  {c:"software",g:"",n:"iMonnit 클라우드 관리 SW",d:"클라우드 기반 센서 구성·관리·알림(소프트웨어 비교표 제공).",u:"https://monnit.blob.core.windows.net/site/documents/global/IM-SCS-01-iMonnit-Software-Comparison.pdf",p:true},
  {c:"software",g:"",n:"iMonnit Express 독립형 SW",d:"오프라인 PC 단독 실행(10~100개 규모).",u:"https://monnit.blob.core.windows.net/site/documents/software/Express/IM-EX-MDS-01.pdf",p:true},
  {c:"software",g:"",n:"온프레미스 엔터프라이즈",d:"대규모 센서망용 온프레미스 데이터 호스팅·관리.",u:"https://monnit.blob.core.windows.net/site/documents/software/Enterprise/IM-E-MUG-01-User.pdf",p:true},
  {c:"software",g:"",n:"Monnit Mine",d:"오픈 플랫폼 — 디바이스를 커스텀 호스트/IP로 연동.",u:"https://monnit.blob.core.windows.net/site/documents/software/Mine/IM-M-GSGJ-01.pdf",p:true},
  {c:"accessories",g:"",n:"사이트 서베이 툴",d:"설치 전 ALTA 신호 신뢰도를 사전 진단.",u:"https://monnit.blob.core.windows.net/site/documents/accessories/site-survey/SS-ST-ADS.pdf",p:true},
  {c:"accessories",g:"",n:"컨트롤 유닛",d:"원격 제어용 컨트롤 유닛 — 임계 조건에서 장비를 자동 제어.",u:"https://monnit.blob.core.windows.net/site/documents/accessories/facility-accessories/CTL-00-ADS.pdf",p:true},
  {c:"accessories",g:"",n:"로컬 경보기",d:"현장 로컬 경보기 — 임계 초과 시 현장에서 소리·시각 경보.",u:"https://monnit.blob.core.windows.net/site/documents/accessories/local-alert/AV-LA-ADS.pdf",p:true}
];

var PRODUCT_CATS = [
  {id:'sensors',     ko:'센서',     color:'#18D0E6', icon:'<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7 12a5 5 0 0 1 10 0"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'},
  {id:'gateways',    ko:'게이트웨이', color:'#3B82F6', icon:'<rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="16.5" r="1" fill="currentColor" stroke="none"/><path d="M12 13V7"/><path d="M8.5 7a3.5 3.5 0 0 1 7 0"/><path d="M6 4.5a6 6 0 0 1 12 0"/>'},
  {id:'software',    ko:'소프트웨어', color:'#8B5CF6', icon:'<rect x="3" y="4" width="18" height="14" rx="1.5"/><path d="M3 9h18"/><path d="M9 21h6"/><path d="M12 18v3"/>'},
  {id:'accessories', ko:'액세서리',  color:'#F59E0B', icon:'<path d="M14.5 5.5a3.5 3.5 0 0 1-4.9 4.9L4 16l-1 4 4-1 5.6-5.6a3.5 3.5 0 0 1 4.9-4.9l-2.5 2.5-2-2 1.0-3z"/>'}
];
var SENSOR_GROUPS = [
  {id:'env',    ko:'환경',          color:'#2BB673'},
  {id:'power',  ko:'전력',          color:'#F2A900'},
  {id:'motion', ko:'모션·보안',      color:'#A855F7'},
  {id:'mech',   ko:'기계·진동',      color:'#EF4444'},
  {id:'level',  ko:'레벨·누수',      color:'#3B82F6'},
  {id:'gas',    ko:'가스·안전',      color:'#14B8A6'},
  {id:'iface',  ko:'인터페이스·계측', color:'#EC4899'}
];
/* 제품 아이콘 — 사이트 라인 스타일에 맞춘 인라인 SVG (또렷·일관) */
var PROD_SVG = {
  temperature:'<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v6"/>',
  humidity:'<path d="M12 3.5s5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 5-9 5-9z"/><path d="M14.5 11l-4 4"/><circle cx="10.6" cy="11.2" r="0.6"/><circle cx="14.4" cy="14.6" r="0.6"/>',
  water:'<path d="M12 3.5s5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 5-9 5-9z"/>',
  vibration:'<path d="M3 12h2.2l1.8-5 3 11 3-15 2.8 13 1.6-4H21"/>',
  electrical:'<path d="M13 2.5 5 13.5h5.2L9 21.5l8-11.5h-5.4z"/>',
  motion:'<circle cx="12" cy="12" r="2"/><path d="M8.4 8.4a5 5 0 0 0 0 7.2M5.6 5.6a9 9 0 0 0 0 12.8M15.6 8.4a5 5 0 0 1 0 7.2M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  door:'<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="14.5" cy="12" r="1"/>',
  contact:'<path d="M3 12h5M16 12h5"/><circle cx="16" cy="12" r="0.6"/><path d="M8 12l6-4"/><circle cx="8" cy="12" r="1.4"/>',
  gas:'<path d="M7.5 17.5a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.4A3.6 3.6 0 0 1 16.6 17.5z"/>',
  air:'<path d="M3 8h10.5a2.8 2.8 0 1 0-2.8-2.8M3 12h13a2.8 2.8 0 1 1-2.8 2.8M3 16h8.5a2.4 2.4 0 1 1-2.4 2.4"/>',
  pressure:'<circle cx="12" cy="13" r="7"/><path d="M12 13l3.2-3.2"/><path d="M12 6V4.5"/><path d="M5.5 13H4M20 13h-1.5"/>',
  soil:'<path d="M12 12.5c.2-3 2-4.8 4.2-4.8-.8 3-2 4.2-4.2 4.8zM12 12.5c-.2-3-2-4.8-4.2-4.8.8 3 2 4.2 4.2 4.8zM12 12.5V17"/><path d="M4 20h16"/>',
  vehicle:'<path d="M5 11.5 6.5 7h11L19 11.5M4 16.5h16v-3l-1.2-2H5.2L4 13.5z"/><circle cx="7.8" cy="16.8" r="1.4"/><circle cx="16.2" cy="16.8" r="1.4"/>',
  control:'<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.6"/>',
  button:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  battery:'<rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2"/><path d="M7 12h5"/>',
  power:'<path d="M9 3v5M15 3v5M6.5 8h11v2.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v5"/>',
  gateway:'<rect x="4" y="13.5" width="16" height="6" rx="1.5"/><circle cx="8" cy="16.5" r="0.7"/><path d="M12 13.5V8M9.4 9.6a3.6 3.6 0 0 1 5.2 0M7.4 7.4a6.4 6.4 0 0 1 9.2 0"/>',
  edge:'<rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.6"/><path d="M10 7V4.5M14 7V4.5M10 19.5V17M14 19.5V17M7 10H4.5M7 14H4.5M19.5 10H17M19.5 14H17"/>',
  light:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>',
  tilt:'<path d="M4 18h13L8 6z"/><path d="M14.5 13.5a5.5 5.5 0 0 0 5.5 0"/>',
  resistance:'<path d="M4.5 17.5h3.4v-1.1a5 5 0 1 1 8.2 0v1.1h3.4"/>',
  pulse:'<rect x="3" y="4" width="18" height="6" rx="1"/><path d="M6 7h1.6M9.2 7h1.6M12.4 7h1.6M15.6 7h1.6"/><path d="M3 15h3.2l2-4 3 8 2-4H21"/>',
  software:'<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M3 8.2h18"/><path d="M8.5 21h7M12 17v4"/><circle cx="5.5" cy="6.1" r="0.5"/><path d="M6.5 12h4M6.5 14.4h7"/>',
  cloud:'<path d="M7.5 17.5a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.4A3.6 3.6 0 0 1 16.6 17.5z"/><path d="M9.6 13.2l1.9 1.9 3-3.4"/>',
  server:'<rect x="4" y="3.5" width="16" height="7" rx="1.3"/><rect x="4" y="13.5" width="16" height="7" rx="1.3"/><path d="M7.5 7h.01M7.5 17h.01M11 7h.01M11 17h.01"/><path d="M16.5 7h1.2M16.5 17h1.2"/>',
  signal:'<path d="M5 20v-3.5M10 20v-7.5M15 20v-11.5M20 20v-15.5"/>',
  alarm:'<path d="M6 16.5h12l-1.6-2.6V10a4.4 4.4 0 0 0-8.8 0v3.9L6 16.5z"/><path d="M10 19.5a2 2 0 0 0 4 0"/><path d="M3.5 7A6 6 0 0 1 6 3.5M20.5 7A6 6 0 0 0 18 3.5"/>',
  sensor:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
};
var PROD_ICON_RULES = [
  [/온프레미스|엔터프라이즈|enterprise|on-?prem|서버|server/i,'server'],
  [/클라우드|cloud/i,'cloud'],
  [/소프트|\bsw\b|imonnit|express|\bmine\b|플랫폼|platform|대시보드|dashboard/i,'software'],
  [/서베이|survey|신호.?세기|signal|레인지|range.?test/i,'signal'],
  [/경보|경보기|알람|alarm|사이렌|siren|부저|buzzer|beacon/i,'alarm'],
  [/저항|resistance|브리지|bridge|\brtd\b/i,'resistance'],
  [/펄스|pulse|카운터|counter/i,'pulse'],
  [/드라이.?컨택|건접점|dry.?contact|채널.?드라이/i,'contact'],
  [/프로판|propane|lpg|lng/i,'gas'],
  [/co2|이산화/i,'gas'],
  [/가스|\bgas\b|일산화|황화|h2s|\bco\b/i,'gas'],
  [/도어|문열|출입|개폐|open|closed/i,'door'],
  [/버튼|button|호출/i,'button'],
  [/차량|vehicle|\bcar\b|주차/i,'vehicle'],
  [/모션|motion|움직임|점유|occupancy|pir/i,'motion'],
  [/열전대|thermocouple|온도|temp|thermo|써미스/i,'temperature'],
  [/습도|humid/i,'humidity'],
  [/압력|pressure|psi|차압|differential/i,'pressure'],
  [/누수|물.?감지|water|leak|액위|레벨|침수|로프|퍽|디스크|전선형|초음파|ultrason|거리/i,'water'],
  [/진동|vibrat|가속|accel|g-?force|충격/i,'vibration'],
  [/공기|air|pm2|먼지|풍속|기류/i,'air'],
  [/토양|soil|수분/i,'soil'],
  [/제어|컨트롤|control|relay|릴레이|액추|automation|\b10\s?amp\b|\b30\s?amp\b/i,'control'],
  [/조도|light|밝기|일사|lux|par/i,'light'],
  [/기울|tilt|각도/i,'tilt'],
  [/배터리|battery|coin|코인|건전지|\baa\b|lithium|리튬/i,'battery'],
  [/전압|전류|voltage|current|vdc|vac|0-5|0-10|0-20|\dma\b|밀리암|계측|아날로그|analog/i,'electrical'],
  [/엣지|에지|\bedge\b/i,'edge'],
  [/모드버스|modbus|시리얼|serial/i,'gateway'],
  [/어댑터|adapter|전원|power|케이블|cable|프로그래밍|programmer/i,'power'],
  [/게이트웨이|gateway|\bgw\b|셀룰러|cellular|\blte\b|\b3g\b|\b4g\b|이더넷|ethernet|elte/i,'gateway'],
];
function prodIconKey(p, catId){
  var hay = (p.n||'') + ' ' + (p.g||'') + ' ' + (catId||'');
  for (var i=0;i<PROD_ICON_RULES.length;i++){ if (PROD_ICON_RULES[i][0].test(hay)) return PROD_ICON_RULES[i][1]; }
  if (catId==='software') return 'software';
  if (catId==='gateways') return 'gateway';
  if (catId==='accessories') return 'control';
  return 'sensor';
}
function _prodCard(p, catId){
  var label = p.p ? '데이터시트 →' : '제품 페이지 →';
  var svg = PROD_SVG[prodIconKey(p, catId)] || PROD_SVG.sensor;
  var _k = prodIconKey(p, catId);
  var _PHUE = {temperature:'red',humid:'blue',humidity:'blue',water:'blue',vibration:'violet',electrical:'amber',power:'amber',motion:'cyan',door:'green',contact:'green',gas:'teal',air:'teal',pressure:'violet',soil:'green',vehicle:'blue',control:'cyan',button:'pink',light:'amber',tilt:'violet',resistance:'amber',pulse:'cyan',software:'violet',cloud:'cyan',server:'blue',signal:'cyan',alarm:'pink',battery:'green',gateway:'blue',edge:'violet',sensor:'cyan'};
  var _hue = _PHUE[_k] || 'cyan';
  var ico = '<span class="prod-ico ic-'+_hue+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+svg+'</svg></span>';
  return '<a class="prod-card'+(p.p?' has-ds':'')+'" href="'+esc(p.u)+'" target="_blank" rel="noopener">'
    +   ico
    +   '<span class="prod-card-body"><h3>'+esc(p.n)+'</h3>'
    +   '<p>'+esc(p.d)+'</p>'
    +   '<span class="prod-ds">'+label+'</span></span>'
    + '</a>';
}
function renderProducts(){
  var root = document.getElementById('productsRoot');
  if (!root) return;
  var html = '';
  PRODUCT_CATS.forEach(function(cat){
    var items = PRODUCTS.filter(function(p){ return p.c === cat.id; });
    if (!items.length) return;
    html += '<section class="prod-cat" id="prodcat-'+cat.id+'" style="--cat:'+cat.color+'">';
    html += '<div class="prod-cat-head">'
          +   '<span class="prod-cat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+cat.icon+'</svg></span>'
          +   '<h2>'+esc(cat.ko)+'</h2><span class="prod-count">'+items.length+'</span>'
          + '</div>';
    if (cat.id === 'sensors'){
      SENSOR_GROUPS.forEach(function(g){
        var gi = items.filter(function(p){ return p.g === g.id; });
        if (!gi.length) return;
        html += '<div class="prod-group" style="--grp:'+g.color+'">';
        html += '<div class="prod-group-head"><span class="prod-grp-dot"></span>'+esc(g.ko)+'<span class="prod-grp-n">'+gi.length+'</span></div>';
        html += '<div class="prod-grid">'+gi.map(function(p){return _prodCard(p,cat.id);}).join('')+'</div>';
        html += '</div>';
      });
      var known = SENSOR_GROUPS.map(function(g){ return g.id; });
      var rest = items.filter(function(p){ return known.indexOf(p.g) < 0; });
      if (rest.length){
        html += '<div class="prod-group" style="--grp:#94A3B8">';
        html += '<div class="prod-group-head"><span class="prod-grp-dot"></span>기타<span class="prod-grp-n">'+rest.length+'</span></div>';
        html += '<div class="prod-grid">'+rest.map(function(p){return _prodCard(p,cat.id);}).join('')+'</div>';
        html += '</div>';
      }
    } else {
      html += '<div class="prod-grid">'+items.map(function(p){return _prodCard(p,cat.id);}).join('')+'</div>';
    }
    html += '</section>';
  });
  root.innerHTML = html;
}
function goToProductCat(catId){
  navigate('products');
  setTimeout(function(){ var el=document.getElementById('prodcat-'+catId); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 60);
}
document.querySelectorAll('[data-product-cat]').forEach(function(el){
  el.addEventListener('click', function(e){ e.preventDefault(); goToProductCat(el.dataset.productCat); });
});

/* ========== BOOT: 시트 로드 → 렌더 → 초기 라우팅 ========== */
/* 저장(편집기)과 사이트가 항상 같은 시트를 보도록, 저장 스크립트가 연결된 시트를 자동 감지.
   ?sheetId= 로 직접 지정했거나 저장 URL이 없으면 건너뜀. 한 번 확인되면 브라우저에 캐시. */
const SITE_GAS_URL = 'https://script.google.com/macros/s/AKfycbzkEN3DSGuoaZeQwgG0V7BgUe1a_UFIzAQWTCGGcI5SuxQXCQ2u6mBTg9Ed4axIa4jJLw/exec';
async function alignSheetToWriter(){
  try{
    const params = new URLSearchParams(location.search);
    if (params.get('sheetId')) return;                 // URL로 직접 지정 시 존중
    if (!SITE_GAS_URL) return;
    /* 2026-11-03 속도 — 공개 화면은 Apps Script 에 「연결된 시트」를 묻지 않는다.
       예전에는 첫 방문자마다 Apps Script 응답(1~3초)을 기다린 뒤에야 시트를 받기 시작해
       본문(사례·고객사·프로모션 등)이 늦게, 한 번 더 바뀌며 나타났다.
       공개 화면은 사이트 서버 묶음(/api/sheets — Cloudflare 변수 CONTENT_SHEET_ID)을 그대로 쓰고,
       시트 맞춤은 편집기(/ops/editor)에서만 한다. */
    if (!/^\/(ops|editor)/.test(location.pathname)) return;
    const ask = () => fetch(SITE_GAS_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'whoami'}) })
      .then(r=>r.json()).then(j=>{ if(j&&j.boundSheetId){ try{localStorage.setItem('monnit_writer_sheet', j.boundSheetId);}catch(e){} return j.boundSheetId; } return null; });
    let cached=null; try{ cached=localStorage.getItem('monnit_writer_sheet'); }catch(e){}
    if (cached){ CONTENT_SHEET.sheetId = cached; ask().catch(()=>{}); return; }  // 캐시 있으면 즉시 사용 + 백그라운드 갱신
    // 첫 방문만 잠깐 대기 (최대 3초, 실패/지연 시 기본 시트 사용)
    const sid = await Promise.race([ ask().catch(()=>null), new Promise(r=>setTimeout(()=>r(null),3000)) ]);
    if (sid) CONTENT_SHEET.sheetId = sid;
  }catch(e){ /* 실패 시 기본 sheetId 사용 */ }
}

/* 설치사진 → 도입사례: 특정 고객사 카드로 스크롤 + 강조 */
function focusCustomer(name){
  const target=(name||'').trim(); if(!target) return;
  const cards=[...document.querySelectorAll('#cardsGrid .case-card')];
  const card=cards.find(c=>{const dn=(c.dataset.name||'').trim(); return dn && (target===dn || target.includes(dn) || dn.includes(target));});
  if(!card) return;
  const allBtn=document.querySelector('#filterBar .filter-btn[data-filter="all"]');
  if(allBtn && !allBtn.classList.contains('active')) allBtn.click();
  setTimeout(()=>{ card.scrollIntoView({behavior:'smooth',block:'center'}); card.classList.add('focus-flash'); setTimeout(()=>card.classList.remove('focus-flash'),2400); }, 90);
}

function renderAll() {
  renderData();
  renderHomeCatCards();
  renderHomeCases();
  renderAppsCategoryBar();
  renderAppsGrid();
  renderResources();
  renderProducts();
  if (window.MonnitI18N) window.MonnitI18N.refresh();
}
async function boot() {
  /* SSG 로 심어 둔 크롤러용 본문은 SPA 가 뜨면 치웁니다 (같은 내용을 두 번 보여주지 않도록) */
  try { const _ssg = document.getElementById('ssg-content'); if (_ssg) {
    /* 2026-10-02 검색 최적화 — 크롤러가 렌더링한 화면에 <h1>이 하나도 남지 않던 문제.
       SSG 본문의 제목(h1)만 화면에 보이지 않는 h1 로 남겨 둔다(보이는 제목과 같은 문구). 다른 화면으로 이동하면 지운다. */
    const _h = _ssg.querySelector('h1');
    if (_h && ![...document.querySelectorAll('h1')].some(x => !_ssg.contains(x))) {
      const k = document.createElement('h1'); k.className = 'sr-only ssg-h1';
      k.dataset.route = _ssg.getAttribute('data-route') || ''; k.textContent = _h.textContent.trim();
      document.body.insertBefore(k, document.body.firstChild);
    }
    _ssg.remove(); } } catch(e){}
  /* 2026-11-03 속도 — 시트 묶음(<head> 에서 미리 요청)이 곧 도착하면 기다렸다가 「한 번만」 그린다.
     예전에는 기본 데이터로 한 번 그리고, 시트가 오면 전체를 다시 그려(화면 전체 재계산 2회)
     사례·고객사·프로모션이 눈에 띄게 바뀌며 나타났다.
     최대 0.4초만 기다리고, 그때까지 안 오면 예전처럼 기본 데이터로 먼저 그린 뒤 시트가 오면 다시 그린다.
     홈(/)으로 들어올 때만 기다린다 — 다른 화면 주소로 바로 들어오면 기다리는 동안 홈이 잠깐 보일 수 있어서. */
  let _sheetFirst = false;
  try {
    const _pre = window.__mkSheetsPre;
    const _r0 = pathToRoute(location.pathname);
    if (_pre && _pre.p && (!_r0 || _r0 === 'home') && !(location.hash || '').replace(/^#/, '').trim()) {
      const _ok = await Promise.race([
        _pre.p.then(j => !!(j && j.ok && j.tabs)),
        new Promise(r => setTimeout(() => r(false), 400))
      ]);
      if (_ok) { await loadSheetData(); _sheetFirst = true; }
    }
  } catch (e) { _sheetFirst = false; }
  // 1) 기본 데이터로 즉시 렌더 + 초기 라우팅 (빠른 첫 화면 · 느린 망에서도 빈 화면/홈 고정 없음)
  renderAll();
  /* 주소에서 첫 화면을 정합니다.
     예전 #해시 주소(#app/temp)로 들어오면 같은 경로(/app/temp)로 바꿔 줍니다. */
  let initRoute = pathToRoute(location.pathname);
  const legacyHash = (location.hash || '').replace(/^#/, '').trim();
  if (legacyHash && initRoute === 'home'){
    initRoute = legacyHash;
    try { history.replaceState(null, '', routeToPath(initRoute) + location.search); } catch(e){}
  }
  if (initRoute && initRoute !== 'home') navigate(initRoute);
  else { setURL('home', true); proposalPill('home'); }
  try{ const uc=new URLSearchParams(location.search).get('usecase'); if(uc){ const t=uc.trim(); const cu=CUSTOMERS.find(c=>{const dn=(c.n||'').trim(); return dn && (t===dn||t.includes(dn)||dn.includes(t));}); if(cu && cu.key && CASE_DATA[cu.key]){ navigate('case/'+cu.key); } else { navigate('stories'); setTimeout(()=>focusCustomer(uc),500); } } }catch(e){}
  // 2) 구글 시트/에디터 데이터가 로드되면 최신 값으로 "다시 렌더 + 본문(SiteContent) 재적용"
  //    → 렌더 함수가 모두 멱등(idempotent)이라 중복 없이 시트 변경이 반드시 반영된다.
  if (!_sheetFirst) {
    try { await alignSheetToWriter(); await loadSheetData(); }
    catch (e) { console.warn('[CONTENT_SHEET] 로드 중 오류 — 기본값 사용:', e); }
    renderAll();
  }
  /* 2026-10-28 시트에만 있는 사례·활용분야로 바로 들어오면(새로고침·외부 링크·검색) 첫 라우팅 때는
     기본 데이터에 없어 '준비 중' 화면이 떴고, 시트가 로드된 뒤에도 그대로 남았다.
     시트 반영 후 사례·활용분야 상세는 최신 데이터로 다시 그린다(스크롤 위치 유지). */
  try {
    const cur = pathToRoute(location.pathname);
    if (cur && /^(case|app)\//.test(cur)) {
      const y = window.scrollY;
      navigate(cur);
      if (y) window.scrollTo({ top: y, behavior: 'instant' });
    }
  } catch(e){}
  try { if (typeof applySiteContent === 'function' && SITE_CONTENT && Object.keys(SITE_CONTENT).length) applySiteContent(); } catch(e){}
}
boot();

/* ===== 블로그 인사이트: 터치 기기에서 탭하면 오버레이 표시(레이오버), '자세히 보기'는 이동 ===== */
(function(){
  const isTouch = () => window.matchMedia && window.matchMedia('(hover: none)').matches;
  document.addEventListener('click', function(e){
    if (!isTouch()) return;
    const card = e.target.closest && e.target.closest('.blog-card.has-insight');
    if (!card) {
      // 카드 밖 탭 → 열린 오버레이 닫기
      document.querySelectorAll('.blog-card.has-insight.insight-open').forEach(c=>c.classList.remove('insight-open'));
      return;
    }
    const onLink = e.target.closest('.blog-insight .b-link');
    if (card.classList.contains('insight-open')) {
      if (onLink) return;                 // 요약 안의 '자세히 보기 →' → 링크 이동 허용
      e.preventDefault(); e.stopPropagation();
      card.classList.remove('insight-open');   // 다시 탭하면 닫힘
    } else {
      e.preventDefault(); e.stopPropagation();  // 첫 탭: 링크 이동 막고 오버레이 열기
      document.querySelectorAll('.blog-card.has-insight.insight-open').forEach(c=>c.classList.remove('insight-open'));
      card.classList.add('insight-open');
    }
  }, true);
})();

/* ===== scroll reveal (fade-up) — fails open (all visible) on any error ===== */
(function(){
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var home = document.getElementById('view-home');
    if (!home) return;
    var sel = '.section-head, .strength-card, .fac-cell, .why-card, .cat-cards > *, .home-cases > *, .awards-strip-inner > *';
    var els = Array.prototype.slice.call(home.querySelectorAll(sel));
    if (!els.length) return;
    home.classList.add('reveal-on');
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    els.forEach(function(el){
      el.classList.add('reveal');
      var idx = 0, p = el.previousElementSibling;
      while (p) { idx++; p = p.previousElementSibling; }
      el.style.transitionDelay = (Math.min(idx, 5) * 70) + 'ms';
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.95) el.classList.add('in');
    });
    if (!('IntersectionObserver' in window)) {
      els.forEach(function(el){ el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function(el){ if (!el.classList.contains('in')) io.observe(el); });

    /* count-up for stat numbers */
    var cuEls = Array.prototype.slice.call(home.querySelectorAll('.cu[data-to]'));
    if (cuEls.length) {
      var fmt = function(n){ return Math.round(n).toLocaleString('en-US'); };
      var cuIO = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (!e.isIntersecting) return;
          var el = e.target; cuIO.unobserve(el);
          var to = parseFloat(el.getAttribute('data-to')) || 0;
          var dur = 1400, t0 = null;
          var loop = function(ts){
            if (t0 === null) t0 = ts;
            var p = Math.min((ts - t0) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(to * eased);
            if (p < 1) requestAnimationFrame(loop); else el.textContent = fmt(to);
          };
          requestAnimationFrame(loop);
        });
      }, { threshold: 0.5 });
      cuEls.forEach(function(el){ cuIO.observe(el); });
    }
  } catch (err) {
    var h = document.getElementById('view-home');
    if (h) h.classList.remove('reveal-on');
  }
})();

/* ===== Our Solution — interactive (calculator · dashboards · AI log) ===== */
(function(){
  function clk(){ var _lc=(document.documentElement.getAttribute('lang')==='en')?'en-US':'ko-KR'; var t=new Date().toLocaleTimeString(_lc,{hour12:false}); document.querySelectorAll('.dash-clock').forEach(function(e){e.textContent=t;}); }
  setInterval(clk,1000); clk();

  // tabs
  document.addEventListener('click', function(e){
    var b=e.target.closest('.soldash-tab'); if(!b) return;
    document.querySelectorAll('.soldash-tab').forEach(function(x){ x.classList.toggle('active', x===b); });
    var id=b.getAttribute('data-tab');
    document.querySelectorAll('.soldash-panel').forEach(function(p){ p.classList.toggle('active', p.id==='soldash-'+id); });
  });

  // SCUBE facility grid
  var grid=document.getElementById('facilityGrid');
  if(grid && !grid.children.length){
    var st=['normal','normal','normal','normal','normal','normal','normal','normal','normal','normal','warning','normal','normal','normal','normal','normal','normal','alert','normal','normal','normal','warning','normal','normal','offline','normal','normal','normal','normal','normal','normal','normal','warning','normal','normal','normal','normal','normal','alert','normal','normal','warning','normal','normal','normal','warning','normal','normal','offline','alert'];
    var lb=['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','V01','V02','V03','V04','V05','H01','H02','H03','H04','H05','C01','C02','C03','C04','C05','P01','P02','P03','P04','P05','E01','E02','E03','E04','E05','L01','L02','L03','L04','L05','W01','W02','W03','W04','W05','G01','G02','G03','G04','G05'];
    var tip={normal:'정상',warning:'주의',alert:'알림',offline:'오프라인'};
    st.forEach(function(s,i){ var c=document.createElement('div'); c.className='facility-cell '+s; c.textContent=lb[i]||'--'; c.title=tip[s]; grid.appendChild(c); });
  }

  // HVAC zones (16)
  var hz=document.getElementById('hvacZones');
  if(hz && !hz.children.length){
    var zt=[23.1,22.8,25.4,23.9,23.3,22.1,24.7,23.0,22.6,23.8,24.2,21.9,23.5,25.1,22.4,23.2];
    zt.forEach(function(v,i){ var d=document.createElement('div'); d.className='zone'+(v>=25?' hot':v<=22?' cool':''); d.innerHTML='<b>'+v.toFixed(1)+'</b><small>존 '+(i+1)+'</small>'; hz.appendChild(d); });
  }

  // === 진동 대시보드 실시간 스트리밍 (live status) ===
  (function(){
    var panel=document.getElementById('soldash-vib'); if(!panel) return;
    function on(){ return panel.classList.contains('active'); }
    function rnd(a,b){ return a+Math.random()*(b-a); }
    var lv=document.getElementById('vxLiveVal');
    var volt=document.getElementById('vxVolt'), amp=document.getElementById('vxAmp'), rpm=document.getElementById('vxRpm');
    var fleetBase=[4.12,2.84,2.10,1.33,0.91,0.67], fEl=[];
    for(var i=0;i<6;i++) fEl.push(document.getElementById('vxF'+(i+1)));
    var svg=panel.querySelector('.vx-chart svg'); if(!svg) return;
    var paths=[svg.querySelector('.vx-sp.s1'),svg.querySelector('.vx-sp.s2'),svg.querySelector('.vx-sp.s3')];
    var N=130, base=288, top=30, L=44, R=956, xs=[];
    for(var i=0;i<N;i++) xs.push(+(L+(R-L)*i/(N-1)).toFixed(1));
    function envAmp(t){ if(t<0.16) return rnd(0.02,0.06); if(t<0.6) return rnd(0.05,0.16); if(t<0.82) return rnd(0.2,0.42); return rnd(0.55,0.98); }
    // s1/s2/s3 = Crest Factor X/Y/Z (스파이크)
    var buf=[[],[],[]];
    for(var i=0;i<N;i++){ var t=i/(N-1); for(var k=0;k<3;k++) buf[k].push(Math.min(envAmp(t)*(1-0.08*k)*rnd(0.7,1.15),1)); }
    function spike(arr){ var d=''; for(var i=0;i<N;i++){ var y=base-arr[i]*(base-top); d+='M'+xs[i]+' '+base+'L'+xs[i]+' '+y.toFixed(1); } return d; }
    function draw(){ for(var k=0;k<3;k++) if(paths[k]) paths[k].setAttribute('d', spike(buf[k])); }
    function nextCrit(k){ return Math.min(rnd(0.5,1.0)*(1-0.08*k)*rnd(0.7,1.2),1); }
    draw();
    function tick(){
      if(!on()) return;
      for(var k=0;k<3;k++){ buf[k].shift(); buf[k].push(nextCrit(k)); }
      draw();
      if(lv){ var v=rnd(0.66,1.05); if(Math.random()<0.15) v=rnd(1.1,1.55); lv.textContent=v.toFixed(2); lv.style.color = v>1.1 ? '#FF8190' : '#fff'; }
      if(volt) volt.textContent=rnd(381.2,384.4).toFixed(2);
      if(amp) amp.textContent=rnd(12.2,12.9).toFixed(2);
      if(rpm) rpm.textContent=(2950+Math.round(rnd(-14,14))).toLocaleString();
      for(var i=0;i<6;i++){ if(fEl[i]){ var jb=Math.max(0,fleetBase[i]+rnd(-0.04,0.05)); fEl[i].firstChild.nodeValue=jb.toFixed(2); } }
    }
    setInterval(tick, 850);
  })();

  // AI decision log (typing feed)
  var logEl=document.getElementById('aiLog');
  if(logEl){
    var lines=[
      ['AI_PRED','펌프 B-02 베어링 이상 패턴 → 점검 권고 D+7'],
      ['EDGE_CTL','3F-B04 댐퍼 +15% 명령 → BMS ACK'],
      ['ENERGY_OPT','야간 부하 예측 → AHU 78%→62% 조정'],
      ['ALERT_SEND','전기실 A 79.3°C → SMS 담당자 3명 발송'],
      ['PATROL_REQ','진동 이상 확정 → 패트롤 출동 등록']
    ], li=0;
    function pushLog(){
      var t=new Date().toLocaleTimeString((document.documentElement.getAttribute('lang')==='en')?'en-US':'ko-KR',{hour12:false});
      var l=lines[li%lines.length]; li++;
      var row=document.createElement('div'); row.className='ai-log-row';
      row.innerHTML='<span class="t">['+t+']</span> <span class="k k-'+l[0]+'">'+l[0]+'</span> '+l[1];
      logEl.appendChild(row);
      var rows=logEl.querySelectorAll('.ai-log-row'); if(rows.length>5) rows[0].remove();
    }
    for(var k=0;k<4;k++) pushLog();
    setInterval(pushLog, 3200);
  }

  // 언어 토글 시 라이브 시계·로그 타임스탬프를 즉시 해당 언어 형식으로 갱신
  window.addEventListener('monnit:langchange', function(){
    try { clk(); } catch(e){}
    try {
      if (logEl){
        var _lc=(document.documentElement.getAttribute('lang')==='en')?'en-US':'ko-KR';
        var _t=new Date().toLocaleTimeString(_lc,{hour12:false});
        logEl.querySelectorAll('.ai-log-row .t').forEach(function(s){ s.textContent='['+_t+']'; });
      }
    } catch(e){}
  });

  // Battery calculator
  var hb=5, rpb=1;
  var SENSOR_PROFILES={temp:{sleepuA:1.5,assessuA:180,txuA:14000,txMs:8,name:'온도 센서'},humid:{sleepuA:1.8,assessuA:210,txuA:14000,txMs:8,name:'온습도 센서'},open_close:{sleepuA:1.2,assessuA:160,txuA:14000,txMs:8,name:'도어/개폐'},motion:{sleepuA:3.5,assessuA:400,txuA:14000,txMs:8,name:'모션 감지'},water:{sleepuA:2.0,assessuA:200,txuA:14000,txMs:8,name:'누수 감지'},vib:{sleepuA:2.5,assessuA:800,txuA:15000,txMs:10,name:'진동 센서'},vib_adv:{sleepuA:2.8,assessuA:1200,txuA:15000,txMs:12,name:'진동 ADV'},current_20:{sleepuA:3.0,assessuA:600,txuA:14500,txMs:9,name:'전류계 20A'},current_150:{sleepuA:3.0,assessuA:620,txuA:14500,txMs:9,name:'전류계 150A'},current_500:{sleepuA:3.2,assessuA:650,txuA:14500,txMs:9,name:'전류계 500A'},accel:{sleepuA:2.2,assessuA:700,txuA:14000,txMs:8,name:'가속도계'},pressure_50:{sleepuA:2.5,assessuA:500,txuA:14000,txMs:8,name:'압력 50PSI'},pressure_300:{sleepuA:2.5,assessuA:520,txuA:14000,txMs:8,name:'압력 300PSI'},gas_co2:{sleepuA:8.0,assessuA:2500,txuA:15000,txMs:10,name:'가스 CO2'},gas_co:{sleepuA:7.5,assessuA:2200,txuA:15000,txMs:10,name:'가스 CO'},airvel:{sleepuA:3.0,assessuA:600,txuA:14000,txMs:8,name:'풍속'},ultrasonic:{sleepuA:4.0,assessuA:900,txuA:14500,txMs:9,name:'초음파'},volt_200:{sleepuA:2.8,assessuA:480,txuA:14000,txMs:8,name:'전압 200V'},volt_500:{sleepuA:3.0,assessuA:500,txuA:14000,txMs:8,name:'전압 500V'},pulse:{sleepuA:2.0,assessuA:300,txuA:14000,txMs:8,name:'펄스카운터'},dry_contact:{sleepuA:1.5,assessuA:180,txuA:14000,txMs:8,name:'Dry Contact'}};
  var BATTERY_MAH={'2AA_alk':3000,'2AA_li':3500,'coin':240,'industrial':5500,'2AAA':1200};
  var SIGNAL_MULT={good:1.0,medium:1.3,low:1.8};
  function gid(x){return document.getElementById(x);}
  document.addEventListener('click', function(e){
    var s=e.target.closest('[data-step]'); if(!s) return;
    var f=s.getAttribute('data-step'), d=+s.getAttribute('data-d');
    if(f==='hb'){ hb=Math.max(1,Math.min(120,hb+d)); if(gid('hbVal'))gid('hbVal').textContent=hb; }
    else { rpb=Math.max(1,Math.min(10,rpb+d)); if(gid('rpbVal'))gid('rpbVal').textContent=rpb; }
  });
  function calculate(){
    if(!gid('batteryType')) return;
    var p=SENSOR_PROFILES[gid('sensorType').value]||SENSOR_PROFILES.temp;
    var batmAh=BATTERY_MAH[gid('batteryType').value], sig=gid('signalCond').value, sigMult=SIGNAL_MULT[sig];
    var hbsPerDay=86400/(hb*60), txPerDay=hbsPerDay*rpb;
    var txSecs=(p.txMs/1000)*txPerDay*sigMult, assessSecs=0.05*hbsPerDay*rpb, sleepSecs=86400-txSecs-assessSecs;
    var sleepD=(p.sleepuA*Math.max(sleepSecs,0))/3.6e6, assessD=(p.assessuA*assessSecs)/3.6e6, agingD=batmAh*0.000005, txD=(p.txuA*(p.txMs/1000)*txPerDay*sigMult)/3.6e6;
    var K=15; sleepD*=K; assessD*=K; agingD*=K; txD*=K; /* 현실 보정: 온도~10년·진동~수년·CO2~1-2년 */
    var totD=sleepD+assessD+agingD+txD, days=Math.round(batmAh/(totD||0.01)), years=(days/365).toFixed(1), msgs=Math.round(txPerDay*days);
    gid('resYears').textContent=years; gid('resDays').textContent=days.toLocaleString();
    gid('resMsgs').textContent=msgs>1e6?(msgs/1e6).toFixed(1)+'M':msgs.toLocaleString();
    var tot=totD||1, segs=document.querySelectorAll('.power-seg');
    if(segs.length>=4){ segs[0].style.flex=(sleepD/tot*100).toFixed(1); segs[1].style.flex=(assessD/tot*100).toFixed(1); segs[2].style.flex=(agingD/tot*100).toFixed(1); segs[3].style.flex=(txD/tot*100).toFixed(1); }
    gid('legSleep').textContent=(sleepD*1000).toFixed(2)+'μAh/d'; gid('legAssess').textContent=(assessD*1000).toFixed(2)+'μAh/d';
    gid('legAging').textContent=(agingD*1000).toFixed(2)+'μAh/d'; gid('legTx').textContent=(txD*1000).toFixed(2)+'μAh/d';
    var sl={good:'양호',medium:'보통',low:'불량'}[sig];
    gid('calcNotes').innerHTML='▸ <b>'+p.name+'</b> · '+batmAh+'mAh · HB '+hb+'분 · '+rpb+'회/HB · 신호 '+sl+' (TX×'+sigMult+')<br>▸ 일 소비량 '+totD.toFixed(4)+' mAh → 예상 <b>'+years+'년</b> · 총 '+msgs.toLocaleString()+'회 전송<br>▸ 실제 수명은 온도·장애물·신호 환경에 따라 ±30% 변동 가능';
  }
  var go=gid('calcGo'); if(go){ go.addEventListener('click', calculate); calculate(); }
})();


/* ===== 활용 분야 상세 — 미세 인터랙션 (2026-11-19) =====
   스크롤 진입 시 본문이 살짝 올라오며 나타난다. 오류가 나거나 지원하지 않는 환경에서는
   .appd-fx 가 붙지 않아 모든 내용이 그대로 보인다(fail-open). 호버 효과는 style.css 담당. */
(function(){
  if (typeof renderAppDetail !== 'function') return;
  var io = null;
  function arm(){
    var view = document.getElementById('view-app-detail');
    if (!view) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { view.classList.remove('appd-fx'); return; }
    if (io) io.disconnect();
    var groups = [
      ['#appd-snapshot .snap', 70],
      ['#appd-customer', 0], ['#appd-challenge > .case-lead', 0], ['#appd-challenge .pain-list li', 60],
      ['#appd-solution', 0], ['#appd-proposal > .case-lead', 0], ['#appd-proposal .phase', 60],
      ['#appd-roi > .case-lead', 0], ['#appd-roi .roi-card', 70], ['#appd-roi .comparison', 0]
    ];
    var els = [];
    groups.forEach(function(g){
      var list = view.querySelectorAll(g[0]);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        el.classList.add('appd-rv'); el.classList.remove('in');
        el.style.setProperty('--appd-d', (g[1] * i) + 'ms');
        els.push(el);
      }
    });
    view.classList.add('appd-fx');
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    els.forEach(function(el){ io.observe(el); });
    /* 안전장치: 관찰이 누락돼도 2.5초 뒤에는 화면 안의 요소를 모두 보이게 한다 */
    setTimeout(function(){
      var vh = window.innerHeight || 800;
      els.forEach(function(el){ if (el.getBoundingClientRect().top < vh) el.classList.add('in'); });
    }, 2500);
  }
  var _render = renderAppDetail;
  renderAppDetail = function(id){
    _render(id);
    try { (window.requestAnimationFrame || setTimeout)(arm); }
    catch (e) { var v = document.getElementById('view-app-detail'); if (v) v.classList.remove('appd-fx'); }
  };
})();
