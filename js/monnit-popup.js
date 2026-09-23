/*! Monnit Korea — 사이트 공통 팝업 v1 (2026-09-23)
 *
 *  켜기/끄기  →  /ops/flow 화면 상단 「사이트 팝업」 스위치 (저장 즉시, 1분 안에 전 페이지 반영)
 *             비상시엔 아래 HARD_OFF 를 true 로 바꿔 배포해도 꺼진다.
 *  노출 규칙
 *    · 탭(세션)당 한 번만 — 페이지를 옮길 때마다 다시 뜨지 않는다
 *    · 「오늘 하루 보지 않기」 → 한국 시간 자정까지 숨김 (localStorage)
 *    · 팝업이 보내는 곳(/proposal)과 접수·관리 화면에서는 띄우지 않는다
 *    · 페이지가 뜨고 1.2초 뒤, 사용자가 이미 스크롤·입력 중이어도 방해하지 않게 부드럽게 등장
 *  닫기: X · 배경 클릭 · ESC · 「닫기」
 *  기록: MonnitTrack.event('popup_view' | 'popup_click' | 'popup_close' | 'popup_hide_today')
 */
(function (w, d) {
  'use strict';
  var HARD_OFF = false;
  if (HARD_OFF || w.MonnitPopup) return;

  var DEFAULTS = {
    on: true,
    id: 'hanok-2026-09',   /* 새 팝업으로 바꾸면 id 도 바꾼다 — 「오늘 그만 보기」가 새 팝업에는 적용되지 않게 */
    href: '/proposal?from=finder&fac=public&con=air&fl=%EA%B3%B5%EA%B3%B5%C2%B7%EA%B5%90%EC%9C%A1%C2%B7%EB%AC%B8%ED%99%94&cl=%EA%B3%B5%EA%B8%B0%EC%A7%88%C2%B7%ED%99%98%EA%B2%BD',
    kicker: 'MONNIT KOREA',
    line1: '모든 선택에는,',
    line2: '분명한 이유가 있다.',
    cta: '맞춤 제안서 받아보기'
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

  function css() {
    var s = d.createElement('style');
    s.id = 'mkpop-css';
    s.textContent =
      '.mkpop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));' +
      'background:rgba(5,9,18,.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s ease;font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}' +
      '.mkpop.in{opacity:1}' +
      '.mkpop-card{position:relative;width:min(880px,100%);max-height:calc(100vh - 32px);background:#0C1220;border:1px solid rgba(255,255,255,.12);border-radius:16px;overflow:hidden;' +
      'box-shadow:0 30px 80px rgba(0,0,0,.55);transform:translateY(14px) scale(.985);transition:transform .45s cubic-bezier(.16,1,.3,1)}' +
      '.mkpop.in .mkpop-card{transform:none}' +
      '.mkpop-link{display:block;position:relative;color:#fff;text-decoration:none;-webkit-tap-highlight-color:transparent}' +
      '.mkpop-img{position:relative;aspect-ratio:4103/1255;background:#0C1220;overflow:hidden}' +
      '.mkpop-img img{display:block;width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.16,1,.3,1)}' +
      '.mkpop-link:hover .mkpop-img img{transform:scale(1.02)}' +
      '.mkpop-img::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(12,18,32,0) 70%,rgba(12,18,32,.55) 90%,#0C1220 100%)}' +
      '.mkpop-k,.mkpop-t{position:absolute;z-index:1;top:30%;transform:translateY(-50%);color:#fff;text-shadow:0 1px 10px rgba(8,12,22,.6);letter-spacing:-.01em}' +
      '.mkpop-k{left:11%;font-weight:600;font-size:clamp(13px,2.1vw,19px)}' +
      '.mkpop-t{right:9%;text-align:center;font-weight:500;line-height:1.35;font-size:clamp(13px,2vw,18px)}' +
      '.mkpop-cta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 22px 18px;background:#0C1220}' +
      '.mkpop-cta span{font-size:14px;color:#A6B3CC}' +
      '.mkpop-cta b{display:inline-flex;align-items:center;gap:8px;background:#D4A93C;color:#0B1220;font-size:14.5px;font-weight:700;padding:11px 18px;border-radius:999px;white-space:nowrap;transition:background .2s ease}' +
      '.mkpop-link:hover .mkpop-cta b{background:#E6BD55}' +
      '.mkpop-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.09);background:#0A0F1B}' +
      '.mkpop-foot button{appearance:none;background:none;border:0;color:#A6B3CC;font:inherit;font-size:13.5px;padding:13px 22px;cursor:pointer;min-height:44px}' +
      '.mkpop-foot button:hover{color:#fff}' +
      '.mkpop-x{position:absolute;top:10px;right:10px;z-index:2;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(8,12,22,.55);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0}' +
      '.mkpop-x:hover{background:rgba(8,12,22,.85)}' +
      '.mkpop-x svg{width:16px;height:16px}' +
      '.mkpop :focus-visible{outline:2px solid #D4A93C;outline-offset:2px}' +
      '.mkpop-m{display:none}' +
      /* 모바일: 봉황 중심 4:3 사진 + 문구는 아래 패널로 (작은 화면에서 글자가 사진에 묻히지 않게) */
      '@media(max-width:640px){' +
      '.mkpop-card{width:min(400px,100%);border-radius:14px}' +
      '.mkpop-img{aspect-ratio:4/3}' +
      '.mkpop-k,.mkpop-t{display:none}' +
      '.mkpop-m{display:block;padding:4px 20px 0;text-align:left}' +
      '.mkpop-m i{display:block;font-style:normal;font-size:11.5px;font-weight:600;letter-spacing:.14em;color:#D4A93C;margin-bottom:8px}' +
      '.mkpop-m strong{display:block;font-size:20px;font-weight:600;line-height:1.4;color:#fff;letter-spacing:-.02em}' +
      '.mkpop-cta{padding:16px 20px 18px}.mkpop-cta span{display:none}.mkpop-cta b{width:100%;justify-content:center;padding:13px 18px;font-size:15px}' +
      '.mkpop-foot button{padding:12px 18px;font-size:13px}' +
      '}' +
      '@media(max-height:520px) and (min-width:641px){.mkpop-cta{padding:10px 18px}.mkpop-foot button{padding:8px 18px;min-height:36px}}' +
      '@media(prefers-reduced-motion:reduce){.mkpop,.mkpop-card,.mkpop-img img{transition:none}}' +
      'html.mkpop-lock,html.mkpop-lock body{overflow:hidden}';
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
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', c.line1 + ' ' + c.line2);
    root.innerHTML =
      '<div class="mkpop-card">' +
        '<button type="button" class="mkpop-x" data-a="close" data-track-off aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<a class="mkpop-link" href="' + esc(href) + '" data-a="go" data-track-off>' +
          '<div class="mkpop-img"><picture>' +
            '<source type="image/webp" media="(max-width:640px)" srcset="/images/field-review/popup-m-640.webp 640w, /images/field-review/popup-m-960.webp 960w" sizes="min(400px,calc(100vw - 32px))">' +
            '<source media="(max-width:640px)" srcset="/images/field-review/popup-m-960.jpg">' +
            '<source type="image/webp" srcset="/images/field-review/hero-v3-1200.webp 1200w, /images/field-review/hero-v3-1600.webp 1600w, /images/field-review/hero-v3-2400.webp 2400w" sizes="min(880px,calc(100vw - 32px))">' +
            '<img src="/images/field-review/hero-v3-1600.jpg" alt="" width="1600" height="489" decoding="async">' +
          '</picture>' +
          '<div class="mkpop-k">' + esc(c.kicker) + '</div>' +
          '<div class="mkpop-t">' + esc(c.line1) + '<br>' + esc(c.line2) + '</div></div>' +
          '<div class="mkpop-m"><i>' + esc(c.kicker) + '</i><strong>' + esc(c.line1) + '<br>' + esc(c.line2) + '</strong></div>' +
          '<div class="mkpop-cta"><span>공공·교육·문화 시설 공기질·환경 모니터링 맞춤 제안</span><b>' + esc(c.cta) + ' <span aria-hidden="true" style="display:inline;color:inherit;font-size:inherit">→</span></b></div>' +
        '</a>' +
        '<div class="mkpop-foot"><button type="button" data-a="today" data-track-off>오늘 하루 보지 않기</button><button type="button" data-a="close" data-track-off>닫기</button></div>' +
      '</div>';

    var prevFocus = d.activeElement;
    function close(how) {
      d.removeEventListener('keydown', onKey, true);
      root.classList.remove('in');
      d.documentElement.classList.remove('mkpop-lock');
      setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 350);
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
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('in'); }); });
    setTimeout(function () { var x = root.querySelector('.mkpop-x'); try { x.focus({ preventScroll: true }); } catch (e) {} }, 60);
    track('popup_view');
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
      var busy = d.querySelector('[aria-modal="true"]:not(#mkpop)');
      if (busy && busy.offsetParent !== null && tries++ < 20) { setTimeout(wait, 1500); return; }
      show(c);
    })();
  }

  function boot() {
    /* 설정은 서버에서(ops 스위치). 응답이 늦거나 실패하면 띄우지 않는다 — 안전한 쪽으로 */
    var done = false;
    var t = setTimeout(function () { done = true; }, 4000);
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
