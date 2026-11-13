/*! Monnit Korea — 사이트 공통 팝업 v3 · 건물 주요 설비 통합 관제 솔루션 프로모션 (2026-11-02)
 *
 *  2026-11-02 내용 교체: 맞춤형 제안서(로봇) → 진행 중인 프로모션 「건물 주요 설비 통합 관제 솔루션」(/promo/remote/).
 *    이전 판은 source/remote-monitoring/monnit-popup.v4-proposal-backup.js 에 보관. 다시 쓰려면 그 파일로 되돌리면 된다.
 *    켜기·끄기·노출 규칙·기록 방식은 그대로다.
 *
 *  2026-09-30 문구 교체: 「전 세계의 노하우를 우리 현장으로」 → 「12,000개 고객사가 검증한 해답」
 *  켜기/끄기  →  /ops/flow 화면 상단 「사이트 팝업」 스위치 (저장 즉시, 1분 안에 전 페이지 반영)
 *             비상시엔 아래 HARD_OFF 를 true 로 바꿔 배포해도 꺼진다.
 *  노출 규칙
 *    · 탭(세션)당 한 번만 — 페이지를 옮길 때마다 다시 뜨지 않는다
 *    · 「오늘 하루 보지 않기」 → 한국 시간 자정까지 숨김 (localStorage)
 *    · 팝업이 보내는 곳(/proposal)·접수 화면·광고 랜딩·관리 화면에서는 띄우지 않는다
 *  닫기: X · 배경 클릭 · ESC · 「닫기」
 *  기록: MonnitTrack.event('popup_view' | 'popup_click' | 'popup_close' | 'popup_hide_today')
 *
 *  화면 구성 — 이미지 한 장이 아니라 층으로 나눠 움직인다
 *    로봇: 몸통 · 왼날개 · 오른날개 (images/popup/robot-*.webp) — 둥실 떠다님 · 날갯짓 · 안테나 빛 · 눈 깜빡임
 *    카드: 문구는 전부 HTML 텍스트 — 어떤 화면에서도 선명, 반짝이 별 · 버튼 광택 · 배경 원 움직임
 *    움직임 줄이기(reduced-motion) 설정이면 모든 효과를 멈춘다.
 */
(function (w, d) {
  'use strict';
  var HARD_OFF = false;
  if (HARD_OFF || w.MonnitPopup) return;

  var DEFAULTS = {
    on: true,
    id: 'remote-promo-2026-11-02',   /* 새 팝업으로 바꾸면 id 도 바꾼다 — 「오늘 그만 보기」가 새 팝업에는 적용되지 않게 */
    href: '/promo/remote/?utm_source=monnit.co.kr&utm_medium=popup&utm_campaign=remote_promo'
  };
  /* 띄우지 않을 경로
     · /proposal — 팝업이 보내는 곳 · /visit · /contact — 접수 중인 화면
     · /promo/* · promo-*.html — 광고 전용 랜딩 (광고비를 들여 데려온 방문자를 다른 제안으로 돌리지 않는다)
     · 관리·메일·교회 QR·개인정보 화면 */
  var EXCLUDE = /^\/(proposal|ops|editor|visit|contact|church|email|privacy|404|promo(?=\/|-|\.html|$))(\/|-|\.html|$)/;

  var loc = w.location;
  if (EXCLUDE.test(loc.pathname)) return;

  var ls = null, ss = null;
  try { ls = w.localStorage; } catch (e) {}
  try { ss = w.sessionStorage; } catch (e) {}
  var kst = function () { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()); };
  var track = function (n, p) { try { w.MonnitTrack && w.MonnitTrack.event(n, p); } catch (e) {} };

  function hiddenToday(id) { try { return ls && ls.getItem('mk_pop_hide_' + id) === kst(); } catch (e) { return false; } }
  function seenThisTab(id) { try { return ss && ss.getItem('mk_pop_seen_' + id) === '1'; } catch (e) { return false; } }

  var IMG = '/images/popup/';
  var IMG_THUMB = '/images/promo-remote.webp?v=1';

  /* 로봇 좌표는 원본(400×248) 기준 % — 카드 폭에 맞춰 같이 커지고 작아진다 */
  function css() {
    var s = d.createElement('style');
    s.id = 'mkpop-css';
    s.textContent = [
      '.mkpop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 16px max(12px,env(safe-area-inset-bottom));',
      'background:rgba(4,10,24,.7);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .35s ease;',
      'font-family:Pretendard,"Pretendard Variable",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all}',
      '.mkpop.in{opacity:1}',
      '.mkpr{position:relative;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border-radius:20px;background:#0B1322;border:1px solid rgba(150,185,235,.18);',
      'box-shadow:0 40px 90px -30px rgba(0,0,0,.9),0 0 80px -30px rgba(30,99,240,.55);transform:translateY(24px) scale(.96);opacity:0;transition:transform .55s cubic-bezier(.2,1.2,.3,1),opacity .4s ease;outline:none}',
      '.mkpop.in .mkpr{transform:none;opacity:1}',
      '.mkpr-card{display:block;color:#EEF3FB;text-decoration:none}',
      '.mkpr-img{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:#070C17}',
      '.mkpr-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.2,.7,.2,1)}',
      '.mkpr-card:hover .mkpr-img img{transform:scale(1.04)}',
      '.mkpr-badge{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#fff;background:rgba(6,10,19,.72);border:1px solid rgba(255,255,255,.18);padding:5px 10px;border-radius:999px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
      '.mkpr-badge i{width:7px;height:7px;border-radius:50%;background:#34D2B4;box-shadow:0 0 0 0 rgba(52,210,180,.6);animation:mkprPulse 1.8s infinite}',
      '.mkpr-in{display:block;padding:20px 22px 22px}',
      '.mkpr-eb{display:block;font-size:12px;font-weight:700;color:#5AA9FF;letter-spacing:.02em}',
      '.mkpr-t{display:block;margin-top:6px;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-.03em}',
      '.mkpr-p{display:block;margin:10px 0 0;font-size:14.5px;line-height:1.6;color:#AEB9CC}',
      '.mkpr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}',
      '.mkpr-chips span{font-size:12px;padding:5px 10px;border-radius:999px;border:1px solid rgba(150,185,235,.24);color:#D7E1F0;background:rgba(255,255,255,.04)}',
      '.mkpr-cta{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;height:50px;border-radius:12px;font-size:15.5px;font-weight:800;color:#fff;',
      'background:linear-gradient(90deg,#2BB3FF,#1E63F0);box-shadow:0 10px 26px -10px rgba(40,140,255,.85)}',
      '.mkpr-cta::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:mkprShine 3.2s ease-in-out 1s infinite}',
      '.mkpr-x{position:absolute;right:10px;top:10px;z-index:2;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.2);background:rgba(6,10,19,.7);color:#fff;cursor:pointer}',
      '.mkpr-x svg{width:18px;height:18px}',
      '.mkpr-foot{display:flex;border-top:1px solid rgba(150,185,235,.14)}',
      '.mkpr-foot button{flex:1;height:46px;border:0;background:transparent;color:#93A0B8;font:600 13px inherit;font-family:inherit;cursor:pointer}',
      '.mkpr-foot button+button{border-left:1px solid rgba(150,185,235,.14)}',
      '.mkpr-foot button:hover,.mkpr-x:hover{color:#fff}',
      '.mkpop :focus-visible{outline:2px solid #3FA7FF;outline-offset:2px}',
      '@keyframes mkprPulse{0%{box-shadow:0 0 0 0 rgba(52,210,180,.6)}100%{box-shadow:0 0 0 8px rgba(52,210,180,0)}}',
      '@keyframes mkprShine{0%{left:-60%}55%,100%{left:130%}}',
      '@media(prefers-reduced-motion:reduce){.mkpop *,.mkpop *::before,.mkpop *::after{animation:none!important;transition:none!important}.mkpr{opacity:1!important;transform:none!important}}',
      'html.mkpop-lock,html.mkpop-lock body{overflow:hidden}'
    ].join('');
    d.head.appendChild(s);
  }

  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeHref(h) { h = String(h || ''); return /^\/(?!\/)/.test(h) || /^https:\/\/(www\.)?monnit\.co\.kr\//.test(h) ? h : DEFAULTS.href; }

  function show(c) {
    if (d.getElementById('mkpop')) return;
    css();
    var href = safeHref(c.href);
    var root = d.createElement('div');
    root.className = 'mkpop'; root.id = 'mkpop';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'mkpr-title');
    root.innerHTML =
      '<div class="mkpr" tabindex="-1">' +
        '<a class="mkpr-card" href="' + esc(href) + '" data-a="go" data-track-off>' +
          '<span class="mkpr-img"><img src="' + IMG_THUMB + '" alt="여러 건물의 주요 설비를 원격으로 통합 관제" width="1200" height="675" decoding="async"><span class="mkpr-badge"><i aria-hidden="true"></i>진행 중인 프로모션</span></span>' +
          '<span class="mkpr-in">' +
            '<span class="mkpr-eb">배선 공사 필요 없는 무선 IoT 솔루션</span>' +
            '<strong class="mkpr-t" id="mkpr-title">건물 주요 설비 통합 관제 솔루션</strong>' +
            '<span class="mkpr-p" style="display:block">제어반·기계실·EPS실·수변전실의 과열·화재·누수·정전을 실시간 감지해 담당자 휴대폰으로 즉시 알립니다.</span>' +
            '<span class="mkpr-chips"><span>무료 현장 진단</span><span>배선 공사 0</span><span>정전 시 2~3일 작동</span></span>' +
            '<span class="mkpr-cta">자세히 보기<i aria-hidden="true">→</i></span>' +
          '</span>' +
        '</a>' +
        '<button type="button" class="mkpr-x" data-a="close" data-track-off aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<div class="mkpr-foot"><button type="button" data-a="today" data-track-off>오늘 하루 보지 않기</button><button type="button" data-a="close" data-track-off>닫기</button></div>' +
      '</div>';

    var prevFocus = d.activeElement;
    function close(how) {
      d.removeEventListener('keydown', onKey, true);
      root.classList.remove('in');
      d.documentElement.classList.remove('mkpop-lock');
      setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 380);
      try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (e) {}
      if (how) track(how);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close('popup_close'); return; }
      if (e.key === 'Tab') {   /* 포커스를 팝업 안에 가둔다 */
        var f = root.querySelectorAll('a,button'), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    root.addEventListener('click', function (e) {
      if (e.target === root) { close('popup_close'); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'close') close('popup_close');
      else if (a === 'today') {
        try { ls && ls.setItem('mk_pop_hide_' + c.id, kst()); } catch (x) {}
        close('popup_hide_today');
      } else if (a === 'go') {
        /* 어떤 페이지(SPA 포함)에 있든 같은 주소로 새로 연다 */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) { track('popup_click', { to: href }); return; }
        e.preventDefault();
        track('popup_click', { to: href });
        try { w.MonnitTrack && w.MonnitTrack.flush(); } catch (x) {}
        try { w.dataLayer && w.dataLayer.push({ event: 'popup_click', popup_id: c.id }); } catch (x) {}
        w.location.href = href;
      }
    });
    d.addEventListener('keydown', onKey, true);
    d.body.appendChild(root);
    d.documentElement.classList.add('mkpop-lock');
    try { ss && ss.setItem('mk_pop_seen_' + c.id, '1'); } catch (e) {}
    /* 로봇 이미지가 준비된 뒤에 등장 — 반쯤 그려진 채로 튀어나오지 않게 (최대 1.2초 대기) */
    var imgs = root.querySelectorAll('.mkpr-img img'), left = imgs.length, go = false;
    function reveal() { if (go) return; go = true; requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('in'); }); }); }
    for (var k = 0; k < imgs.length; k++) {
      if (imgs[k].complete) { if (--left === 0) reveal(); }
      else imgs[k].addEventListener('load', function () { if (--left === 0) reveal(); }), imgs[k].addEventListener('error', reveal);
    }
    setTimeout(reveal, 1200);
    setTimeout(function () { var x = root.querySelector('.mkpr'); try { x.focus({ preventScroll: true }); } catch (e) {} }, 80);
    track('popup_view', { id: c.id });
    try { w.dataLayer && w.dataLayer.push({ event: 'popup_view', popup_id: c.id }); } catch (x) {}
  }

  function start(remote) {
    var c = {}; var k;
    for (k in DEFAULTS) c[k] = DEFAULTS[k];
    if (remote && typeof remote === 'object') for (k in remote) if (remote[k] != null && remote[k] !== '') c[k] = remote[k];
    if (!c.on || hiddenToday(c.id) || seenThisTab(c.id)) return;
    if (EXCLUDE.test(w.location.pathname)) return;
    /* 이미 다른 모달(상담 폼·라이트박스 등)이 열려 있으면 조금 뒤에 다시 본다 */
    var tries = 0;
    (function wait() {
      /* 2026-10-07 쿠키 동의 배너가 떠 있으면 그 위를 덮지 않는다 — 팝업이 「모든 쿠키 수락」 버튼을 가려 누를 수 없던 문제.
         동의/거부를 고를 때까지 기다리고, 1분 안에 고르지 않으면 이번 방문에는 띄우지 않는다. */
      var cc = d.getElementById('mnk-cc');
      if (cc && cc.getClientRects().length && w.getComputedStyle(cc).display !== 'none') {
        if (tries++ < 40) setTimeout(wait, 1500);
        return;
      }
      var busy = d.querySelector('[aria-modal="true"]:not(#mkpop)');
      if (busy && busy.getClientRects().length && tries++ < 20) { setTimeout(wait, 1500); return; }
      show(c);
    })();
  }

  function boot() {
    /* 설정은 서버에서(ops 스위치). 응답이 늦거나 실패하면 띄우지 않는다 — 안전한 쪽으로 */
    var done = false;
    var t = setTimeout(function () { done = true; }, 4000);
    /* 썸네일을 미리 받아 둔다 (팝업은 1.2초 뒤에 뜬다) */
    (function () { var i = new Image(); i.src = IMG_THUMB; })();
    try {
      w.fetch('/api/popup', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (done) return; clearTimeout(t); done = true; if (j) setTimeout(function () { start(j); }, 1200); })
        .catch(function () {});
    } catch (e) {}
  }

  w.MonnitPopup = {
    /* 콘솔에서 확인용: MonnitPopup.preview() — 규칙 무시하고 바로 띄운다 */
    preview: function () { show(DEFAULTS); },
    reset: function () { try { ls && ls.removeItem('mk_pop_hide_' + DEFAULTS.id); ss && ss.removeItem('mk_pop_seen_' + DEFAULTS.id); } catch (e) {} }
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
