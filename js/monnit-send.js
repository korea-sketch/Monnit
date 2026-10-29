/*! Monnit Korea — 폼 전송 공통 모듈 (monnit-send.js · 2026-10-02)
 *
 *  app.js 의 sendLead() 를 그대로 옮긴 사본입니다. 지금은 /promo/alarm 이 씁니다.
 *  예전에는 알리미 랜딩이 app.js 전체(410KB)를 옛 판으로 품고 있어서
 *  9/4 StaticForms 사고 수정·연락처 최종 검증이 반영되지 않았습니다.
 *
 *  ★ app.js 의 발송 설정(NOTIFY_VIA · 키)을 바꾸면 이 파일도 같이 바꾸세요.
 *    build.js 가 두 파일의 NOTIFY_VIA · STATICFORMS_KEY · WEB3FORMS_KEY 가
 *    다르면 배포를 멈춥니다.
 *
 *  사용: await window.MonnitSend.sendLead(payload, 버튼)
 *        → true(접수) / 'mailto'(메일 앱) / false(실패)
 */
(function(){
'use strict';
if (window.MonnitSend) return;
const CONTACT_EMAIL = "korea@monnit.com";
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


window.MonnitSend = { sendLead: sendLead, buildMailto: buildMailto };
})();
