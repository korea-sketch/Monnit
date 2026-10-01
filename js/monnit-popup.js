/*! Monnit Korea — 사이트 공통 팝업 v2 · 맞춤형 제안서 무료 제작 EVENT (2026-09-23)
 *
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
    id: 'proposal-event-2026-09',   /* 새 팝업으로 바꾸면 id 도 바꾼다 — 「오늘 그만 보기」가 새 팝업에는 적용되지 않게 */
    href: '/proposal?from=finder&fac=public&con=air&fl=%EA%B3%B5%EA%B3%B5%C2%B7%EA%B5%90%EC%9C%A1%C2%B7%EB%AC%B8%ED%99%94&cl=%EA%B3%B5%EA%B8%B0%EC%A7%88%C2%B7%ED%99%98%EA%B2%BD'
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
  var STAR = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 0C21.6 11 29 18.4 40 20 29 21.6 21.6 29 20 40 18.4 29 11 21.6 0 20 11 18.4 18.4 11 20 0Z"/></svg>';

  /* 로봇 좌표는 원본(400×248) 기준 % — 카드 폭에 맞춰 같이 커지고 작아진다 */
  function css() {
    var s = d.createElement('style');
    s.id = 'mkpop-css';
    s.textContent = [
      '.mkpop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 16px max(12px,env(safe-area-inset-bottom));',
      'background:rgba(4,10,24,.66);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .35s ease;',
      'font-family:Pretendard,"Pretendard Variable",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased}',
      '.mkpop.in{opacity:1}',
      /* 폭: 400px 한도 · 좌우 16px 여백 · 화면 높이가 낮으면 높이에 맞춰 줄인다 (전체 비율 400:740) */
      '.mkpe{position:relative;width:min(400px,calc(100vw - 32px),calc((100vh - 40px) * .54));width:min(400px,calc(100vw - 32px),calc((100dvh - 40px) * .54));container-type:inline-size;',
      'transform:translateY(24px) scale(.96);opacity:0;transition:transform .6s cubic-bezier(.2,1.2,.3,1),opacity .4s ease}',
      '.mkpop.in .mkpe{transform:none;opacity:1}',

      /* ── 로봇 ── */
      '.mkpe-stage{position:relative;aspect-ratio:400/248;margin-bottom:-2px;pointer-events:none;z-index:1}',
      '.mkpe-rb{position:absolute;inset:0;transform:translateY(-18%);opacity:0}',
      '.mkpop.in .mkpe-rb{animation:mkpeDrop .9s cubic-bezier(.3,1.5,.5,1) .15s forwards}',
      '.mkpe-fl{position:absolute;inset:0;animation:mkpeFloat 3.4s ease-in-out 1.1s infinite}',
      '.mkpe-fl img{position:absolute;display:block;height:auto;max-width:none;user-select:none;-webkit-user-drag:none}',
      '.mkpe-body{left:21.5%;top:6.45%;width:57%;z-index:2}',
      '.mkpe-wl{left:1.25%;top:22.98%;width:22.25%;z-index:1;transform-origin:96% 45%;animation:mkpeWingL .42s ease-in-out infinite alternate}',
      '.mkpe-wr{left:76.5%;top:21.37%;width:22%;z-index:1;transform-origin:4% 45%;animation:mkpeWingR .42s ease-in-out infinite alternate}',
      /* 안테나 빛 */
      '.mkpe-glow{position:absolute;z-index:3;left:50%;top:12.9%;width:17%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;',
      'background:radial-gradient(circle,rgba(90,180,255,.75) 0%,rgba(40,140,255,.28) 38%,rgba(40,140,255,0) 70%);animation:mkpeGlow 1.9s ease-in-out infinite;mix-blend-mode:screen}',
      /* 눈 깜빡임 — 얼굴색 눈꺼풀이 위에서 내려온다 */
      '.mkpe-lid{position:absolute;z-index:3;top:69.4%;width:7.4%;aspect-ratio:1;border-radius:50%;overflow:hidden;transform:translate(-50%,-50%)}',
      '.mkpe-lid::before{content:"";position:absolute;inset:-10%;background:#13294f;transform:scaleY(0);transform-origin:50% 0;animation:mkpeBlink 4.6s ease-in-out 1.6s infinite}',
      '.mkpe-lid.l{left:38.75%}.mkpe-lid.r{left:61%}',

      /* ── 카드 ── */
      '.mkpe-card{position:relative;z-index:2;display:block;text-decoration:none;color:#fff;text-align:center;overflow:hidden;',
      'background:linear-gradient(180deg,#183662 0%,#16325B 55%,#132c52 100%);border-radius:6cqw;padding:10cqw 7cqw 8cqw;',
      'box-shadow:0 30px 70px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);-webkit-tap-highlight-color:transparent}',
      '.mkpe-card:focus-visible{outline:3px solid #7cc0ff;outline-offset:3px}',
      /* 배경 원 · 빛 */
      '.mkpe-orb{position:absolute;right:-26cqw;bottom:-30cqw;width:74cqw;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#3a5885,#2c4670 60%,#284068);opacity:.95;animation:mkpeOrb 9s ease-in-out infinite alternate}',
      '.mkpe-orb2{position:absolute;left:-18cqw;top:-22cqw;width:60cqw;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(92,164,255,.18),rgba(92,164,255,0) 65%);animation:mkpeOrb 11s ease-in-out infinite alternate-reverse}',
      '.mkpe-dot{position:absolute;bottom:-6px;width:4px;height:4px;border-radius:50%;background:rgba(170,215,255,.55);animation:mkpeRise 7s linear infinite;opacity:0}',
      '.mkpe-in{position:relative;z-index:1}',
      /* 반짝이 별 */
      '.mkpe-star{position:absolute;z-index:1;fill:#FFE52D;filter:drop-shadow(0 0 6px rgba(255,229,45,.55));animation:mkpeTwinkle 2.4s ease-in-out infinite}',
      '.mkpe-star svg{display:block;width:100%;height:100%}',
      '.mkpe-star.a{left:5.5cqw;top:5cqw;width:10.5cqw;height:12cqw}',
      '.mkpe-star.b{right:9cqw;top:43cqw;width:7cqw;height:8.5cqw;animation-delay:.9s}',
      '.mkpe-star.c{left:6cqw;top:98cqw;width:3cqw;height:3cqw;animation-delay:1.5s;opacity:.7}',
      '.mkpe-star.d{right:5cqw;top:30cqw;width:2.6cqw;height:2.6cqw;animation-delay:.4s;opacity:.6;fill:#bfe3ff}',
      /* 뱃지 */
      '.mkpe-badge{display:inline-block;position:relative;overflow:hidden;background:#ECF6FD;color:#16325B;font-weight:700;font-size:max(12px,3.7cqw);letter-spacing:-.01em;padding:1.9cqw 4.4cqw;border-radius:99px;',
      'box-shadow:0 0 0 0 rgba(236,246,253,.5);animation:mkpeBadge 2.6s ease-out 1.4s infinite}',
      '.mkpe-badge::after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.95),transparent);animation:mkpeShine 3.6s ease-in-out 1.8s infinite}',
      /* 제목 · 본문 */
      '.mkpe-t{margin:5.5cqw 0 0;font-size:9cqw;line-height:1.3;font-weight:800;letter-spacing:-.03em;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.25)}',
      '.mkpe-t span{display:block}',
      '.mkpe-p{margin:6cqw 0 0;font-size:max(13px,4.1cqw);line-height:1.6;color:#E4ECF7;font-weight:500;letter-spacing:-.02em}',
      '.mkpe-p + .mkpe-p{margin-top:3.6cqw}',
      '.mkpe-p em{font-style:normal;color:#9EE0EC;font-weight:600;background:linear-gradient(90deg,#9EE0EC,#c9f3ff,#9EE0EC);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:mkpeFlow 4s linear infinite}',
      /* 버튼 */
      '.mkpe-cta{position:relative;display:block;margin:7cqw auto 0;width:max-content;max-width:100%;padding:3.6cqw 7cqw;border-radius:99px;background:linear-gradient(180deg,#4fa3ff,#3a8cf5);color:#fff;font-weight:700;font-size:max(14px,4.6cqw);letter-spacing:-.02em;',
      'box-shadow:0 8px 22px rgba(58,140,245,.45),inset 0 1px 0 rgba(255,255,255,.35);overflow:hidden;transition:translate .2s ease,box-shadow .2s ease}',
      '.mkpe-cta::after{content:"";position:absolute;top:0;bottom:0;left:-45%;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:mkpeShine 2.8s ease-in-out 1.2s infinite}',
      '.mkpe-ring{position:absolute;inset:0;border-radius:99px;box-shadow:0 0 0 0 rgba(79,163,255,.55);animation:mkpeRing 2.2s ease-out 1s infinite;pointer-events:none}',
      '.mkpe-card:hover .mkpe-cta{translate:0 -2px;box-shadow:0 12px 28px rgba(58,140,245,.6),inset 0 1px 0 rgba(255,255,255,.35)}',
      '.mkpe-cta i{font-style:normal;display:inline-block;margin-left:1.6cqw;transition:transform .2s ease}',
      '.mkpe-card:hover .mkpe-cta i{transform:translateX(3px)}',
      /* 순서대로 등장 */
      '.mkpe-up{opacity:0;transform:translateY(12px)}',
      '.mkpop.in .mkpe-up{animation:mkpeUp .6s cubic-bezier(.2,.9,.3,1) forwards}',
      '.mkpop.in .mkpe-badge.mkpe-up{animation:mkpeUp .6s cubic-bezier(.2,.9,.3,1) .35s forwards,mkpeBadge 2.6s ease-out 1.6s infinite}.mkpop.in .mkpe-up.s1{animation-delay:.35s}.mkpop.in .mkpe-up.s2{animation-delay:.47s}.mkpop.in .mkpe-up.s3{animation-delay:.59s}',
      '.mkpop.in .mkpe-up.s4{animation-delay:.71s}.mkpop.in .mkpe-up.s5{animation-delay:.83s}.mkpop.in .mkpe-up.s6{animation-delay:.95s}',
      /* 닫기 X (카드 오른쪽 위) */
      '.mkpe-x{position:absolute;z-index:4;right:calc(11.25cqw - 20px);top:calc(75cqw - 20px);width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:#DDE7F5;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s ease,transform .25s ease}',
      '.mkpe-x:hover{background:rgba(255,255,255,.1);transform:rotate(90deg)}',
      '.mkpe-x svg{width:20px;height:20px}',
      /* 아래 줄 */
      '.mkpe-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:0 4px}',
      '.mkpe-foot button{appearance:none;background:none;border:0;color:rgba(235,242,252,.85);font:inherit;font-size:13.5px;padding:10px 6px;cursor:pointer;min-height:44px}',
      '.mkpe-foot button:hover{color:#fff;text-decoration:underline;text-underline-offset:3px}',
      '.mkpop :focus-visible{outline:2px solid #7cc0ff;outline-offset:2px;border-radius:8px}.mkpop .mkpe:focus,.mkpop .mkpe:focus-visible{outline:none}',

      '@keyframes mkpeDrop{0%{transform:translateY(-18%);opacity:0}60%{opacity:1}100%{transform:none;opacity:1}}',
      '@keyframes mkpeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.2%)}}',
      '@keyframes mkpeWingL{from{transform:rotate(4deg)}to{transform:rotate(-13deg)}}',
      '@keyframes mkpeWingR{from{transform:rotate(-4deg)}to{transform:rotate(13deg)}}',
      '@keyframes mkpeGlow{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(.85)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}}',
      '@keyframes mkpeBlink{0%,90%,100%{transform:scaleY(0)}93%,95%{transform:scaleY(1)}}',
      '@keyframes mkpeTwinkle{0%,100%{transform:scale(.82) rotate(0);opacity:.75}50%{transform:scale(1.12) rotate(20deg);opacity:1}}',
      '@keyframes mkpeShine{0%{left:-60%}55%,100%{left:130%}}',
      '@keyframes mkpeRing{0%{box-shadow:0 0 0 0 rgba(79,163,255,.55)}100%{box-shadow:0 0 0 14px rgba(79,163,255,0)}}',
      '@keyframes mkpeBadge{0%{box-shadow:0 0 0 0 rgba(236,246,253,.45)}100%{box-shadow:0 0 0 10px rgba(236,246,253,0)}}',
      '@keyframes mkpeOrb{from{transform:translate(0,0)}to{transform:translate(-5cqw,-4cqw)}}',
      '@keyframes mkpeRise{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-120cqw);opacity:0}}',
      '@keyframes mkpeFlow{to{background-position:-200% 0}}',
      '@keyframes mkpeUp{to{opacity:1;transform:none}}',
      '@media(prefers-reduced-motion:reduce){.mkpop *,.mkpop *::before,.mkpop *::after{animation:none!important;transition:none!important}.mkpe-rb,.mkpe-up,.mkpe{opacity:1!important;transform:none!important}}',
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
    var dots = '';
    for (var i = 0; i < 7; i++) dots += '<i class="mkpe-dot" style="left:' + (8 + i * 13) + '%;animation-delay:' + (i * 1.05).toFixed(2) + 's;animation-duration:' + (6 + (i % 3) * 1.6) + 's"></i>';
    var root = d.createElement('div');
    root.className = 'mkpop'; root.id = 'mkpop';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'mkpe-title');
    root.innerHTML =
      '<div class="mkpe" tabindex="-1">' +
        '<div class="mkpe-stage" aria-hidden="true"><div class="mkpe-rb"><div class="mkpe-fl">' +
          '<img class="mkpe-wl" src="' + IMG + 'robot-wing-l.webp" alt="" width="178" height="382" decoding="async">' +
          '<img class="mkpe-wr" src="' + IMG + 'robot-wing-r.webp" alt="" width="176" height="390" decoding="async">' +
          '<img class="mkpe-body" src="' + IMG + 'robot-body.webp" alt="" width="456" height="464" decoding="async">' +
          '<i class="mkpe-glow"></i><i class="mkpe-lid l"></i><i class="mkpe-lid r"></i>' +
        '</div></div></div>' +
        '<a class="mkpe-card" href="' + esc(href) + '" data-a="go" data-track-off>' +
          '<i class="mkpe-orb2" aria-hidden="true"></i><i class="mkpe-orb" aria-hidden="true"></i>' + dots +
          '<i class="mkpe-star a" aria-hidden="true">' + STAR + '</i><i class="mkpe-star b" aria-hidden="true">' + STAR + '</i>' +
          '<i class="mkpe-star c" aria-hidden="true">' + STAR + '</i><i class="mkpe-star d" aria-hidden="true">' + STAR + '</i>' +
          '<div class="mkpe-in">' +
            '<span class="mkpe-badge mkpe-up s1">맞춤형 제안서 무료 제작 EVENT!</span>' +
            '<strong class="mkpe-t" id="mkpe-title"><span class="mkpe-up s2">전 세계의 노하우를</span><span class="mkpe-up s3">우리 현장으로</span></strong>' +
            '<p class="mkpe-p mkpe-up s4">글로벌 대형 현장의 <em>실제 적용 사례가</em><br><em>축적된 DB</em>를 기반으로</p>' +
            '<p class="mkpe-p mkpe-up s5">당신의 현장에 최적화된<br><em>맞춤형 솔루션</em>을 제안합니다.</p>' +
            '<span class="mkpe-cta mkpe-up s6"><i class="mkpe-ring" aria-hidden="true"></i>단 1분 만에 제안서 받아보기<i aria-hidden="true">→</i></span>' +
          '</div>' +
        '</a>' +
        '<button type="button" class="mkpe-x" data-a="close" data-track-off aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
        '<div class="mkpe-foot"><button type="button" data-a="today" data-track-off>오늘 하루 보지 않기</button><button type="button" data-a="close" data-track-off>닫기</button></div>' +
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
    var imgs = root.querySelectorAll('.mkpe-stage img'), left = imgs.length, go = false;
    function reveal() { if (go) return; go = true; requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('in'); }); }); }
    for (var k = 0; k < imgs.length; k++) {
      if (imgs[k].complete) { if (--left === 0) reveal(); }
      else imgs[k].addEventListener('load', function () { if (--left === 0) reveal(); }), imgs[k].addEventListener('error', reveal);
    }
    setTimeout(reveal, 1200);
    setTimeout(function () { var x = root.querySelector('.mkpe'); try { x.focus({ preventScroll: true }); } catch (e) {} }, 80);
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
      if (busy && busy.getClientRects().length && tries++ < 20) { setTimeout(wait, 1500); return; }
      show(c);
    })();
  }

  function boot() {
    /* 설정은 서버에서(ops 스위치). 응답이 늦거나 실패하면 띄우지 않는다 — 안전한 쪽으로 */
    var done = false;
    var t = setTimeout(function () { done = true; }, 4000);
    /* 로봇 이미지를 미리 받아 둔다 (팝업은 1.2초 뒤에 뜬다) */
    ['robot-body', 'robot-wing-l', 'robot-wing-r'].forEach(function (n) { var i = new Image(); i.src = IMG + n + '.webp'; });
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
