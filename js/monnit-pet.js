/*! Monnit Korea — 상시 도우미 로봇 「모니」 v1 (2026-09-23)
 *
 *  화면 오른쪽 아래에 늘 떠 있는 작은 로봇. 광고로 처음 들어온 방문자가
 *  「여기서 맞춤 제안서를 무료로 만들어 주는구나」를 바로 알 수 있게 한다.
 *
 *    · 로봇을 누르면 → 안내 카드 (1분 만에 제안서 받기 / 상담 문의 / 전화)
 *    · 말풍선이 가끔 나와 한 줄 안내 (닫으면 이 탭에서는 다시 안 나옴)
 *    · 「도우미 숨기기」 → 화면 가장자리의 작은 손잡이로 접힘 (이 탭 동안 유지, 누르면 다시 펼침)
 *    · 하단 고정 바·상담 버튼·쿠키 안내와 겹치지 않게 자동으로 그 위로 올라간다
 *    · 사진 확대·팝업 같은 전체 화면 창이 열리면 잠시 숨는다
 *    · 모바일에서 스크롤 중에는 살짝 작아지고 흐려져 내용을 덜 가린다
 *  켜기/끄기  →  /ops/flow 「상시 도우미」 스위치 (1분 안에 전 페이지 반영)
 *  기록: MonnitTrack.event('pet_open' | 'pet_cta' | 'pet_contact' | 'pet_tel' | 'pet_bubble' | 'pet_hide' | 'pet_restore')
 */
(function (w, d) {
  'use strict';
  if (w.MonnitPet) return;
  /* 띄우지 않을 경로 — 제안서·접수 진행 화면, 광고 전용 랜딩, 관리 화면 */
  var EXCLUDE = /^\/(proposal|ops|editor|visit|contact|church|email|privacy|404|promo(?=\/|-|\.html|$))(\/|-|\.html|$)/;
  if (EXCLUDE.test(w.location.pathname)) return;

  var HREF = '/proposal?from=finder&fac=public&con=air&fl=%EA%B3%B5%EA%B3%B5%C2%B7%EA%B5%90%EC%9C%A1%C2%B7%EB%AC%B8%ED%99%94&cl=%EA%B3%B5%EA%B8%B0%EC%A7%88%C2%B7%ED%99%98%EA%B2%BD';
  var CONTACT = '/contact?from=pet';
  var TEL = '02-2088-1454';
  var IMG = '/images/popup/';
  var TIPS = [
    '우리 현장 <b>맞춤 제안서</b>,<br>1분이면 무료로 받아요!',
    '비슷한 현장의 <b>실제 적용 사례</b>로<br>구성과 예상 비용을 알려드려요',
    '궁금한 점은 저를 눌러<br><b>바로 상담</b>하세요 👋'
  ];

  var ls = null, ss = null;
  try { ls = w.localStorage; } catch (e) {}
  try { ss = w.sessionStorage; } catch (e) {}
  var sget = function (k) { try { return ss && ss.getItem(k); } catch (e) { return null; } };
  var sset = function (k, v) { try { ss && ss.setItem(k, v); } catch (e) {} };
  var track = function (n, p) { try { w.MonnitTrack && w.MonnitTrack.event(n, p); } catch (e) {} };
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function css() {
    var s = d.createElement('style');
    s.id = 'mkpet-css';
    s.textContent = [
      '.mkpet{--lift:0px;--sz:118px;position:fixed;z-index:2147482000;right:max(26px,env(safe-area-inset-right));bottom:calc(max(14px,env(safe-area-inset-bottom)) + var(--lift));',
      'font-family:Pretendard,"Pretendard Variable",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;',
      'transition:bottom .35s cubic-bezier(.2,.9,.3,1),opacity .3s ease,transform .3s ease;opacity:0;transform:translateY(20px)}',
      '.mkpet.in{opacity:1;transform:none}',
      '.mkpet.away{opacity:0!important;transform:translateY(20px)!important;pointer-events:none}',
      '.mkpet *{box-sizing:border-box}',
      /* 로봇 버튼 */
      '.mkpet-bot{position:relative;display:block;width:var(--sz);padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .3s ease,opacity .3s ease}',
      '.mkpet-stage{position:relative;aspect-ratio:400/248;pointer-events:none}',
      '.mkpet-fl{position:absolute;inset:0;animation:mkpetFloat 3.2s ease-in-out infinite}',
      '.mkpet-fl img{position:absolute;display:block;height:auto;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none}',
      '.mkpet-body{left:21.5%;top:6.45%;width:57%;z-index:2;filter:drop-shadow(0 6px 10px rgba(0,20,60,.35))}',
      '.mkpet-wl{left:1.25%;top:22.98%;width:22.25%;z-index:1;transform-origin:96% 45%;animation:mkpetWingL .4s ease-in-out infinite alternate}',
      '.mkpet-wr{left:76.5%;top:21.37%;width:22%;z-index:1;transform-origin:4% 45%;animation:mkpetWingR .4s ease-in-out infinite alternate}',
      '.mkpet-glow{position:absolute;z-index:3;left:50%;top:12.9%;width:20%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(90,180,255,.8),rgba(40,140,255,.25) 40%,rgba(40,140,255,0) 70%);animation:mkpetGlow 1.8s ease-in-out infinite;mix-blend-mode:screen}',
      '.mkpet-lid{position:absolute;z-index:3;top:69.4%;width:7.4%;aspect-ratio:1;border-radius:50%;overflow:hidden;transform:translate(-50%,-50%)}',
      '.mkpet-lid::before{content:"";position:absolute;inset:-10%;background:#13294f;transform:scaleY(0);transform-origin:50% 0;animation:mkpetBlink 5s ease-in-out 1s infinite}',
      '.mkpet-lid.l{left:38.75%}.mkpet-lid.r{left:61%}',
      /* 이름표 — 로봇 아래쪽을 받치는 알약 */
      '.mkpet-tag{position:relative;z-index:3;display:flex;align-items:center;justify-content:center;gap:5px;margin:-7% auto 0;width:max-content;padding:6px 11px 6px 9px;border-radius:99px;',
      'background:linear-gradient(180deg,#1d3f72,#16325B);color:#fff;font-size:12px;font-weight:700;letter-spacing:-.02em;white-space:nowrap;',
      'box-shadow:0 8px 20px rgba(3,12,30,.45),0 0 0 1px rgba(124,192,255,.35),inset 0 1px 0 rgba(255,255,255,.12)}',
      '.mkpet-tag i{width:7px;height:7px;border-radius:50%;background:#4fe39b;box-shadow:0 0 0 0 rgba(79,227,155,.6);animation:mkpetLive 2s ease-out infinite}',
      '.mkpet-bot:hover .mkpet-fl{animation-duration:1.2s}',
      '.mkpet-bot:hover .mkpet-tag{background:linear-gradient(180deg,#2458a0,#1b3f73)}',
      '.mkpet-bot:focus-visible{outline:none}.mkpet-bot:focus-visible .mkpet-tag{outline:2px solid #7cc0ff;outline-offset:2px}',
      '.mkpet.hop .mkpet-bot{animation:mkpetHop .7s cubic-bezier(.3,1.6,.5,1)}',
      /* 스크롤 중 (모바일) */
      '.mkpet.scroll .mkpet-bot{transform:scale(.84);opacity:.72}',
      /* 말풍선 */
      '.mkpet-bub{position:absolute;right:calc(var(--sz) * .18);bottom:calc(100% + 8px);width:max-content;max-width:min(240px,calc(100vw - 40px));padding:11px 30px 11px 14px;border-radius:16px 16px 4px 16px;',
      'background:#fff;color:#16325B;font-size:13.5px;line-height:1.45;letter-spacing:-.02em;box-shadow:0 12px 30px rgba(3,12,30,.28),0 0 0 1px rgba(22,50,91,.08);cursor:pointer;',
      'opacity:0;transform:translateY(8px) scale(.94);transform-origin:100% 100%;pointer-events:none;transition:opacity .28s ease,transform .35s cubic-bezier(.2,1.3,.4,1)}',
      '.mkpet-bub b{color:#1f6fe0}',
      '.mkpet-bub.on{opacity:1;transform:none;pointer-events:auto}',
      '.mkpet-bub::after{content:"";position:absolute;right:14px;bottom:-7px;width:14px;height:14px;background:#fff;transform:rotate(45deg);border-radius:0 0 3px 0;box-shadow:3px 3px 6px rgba(3,12,30,.08)}',
      '.mkpet-bx{position:absolute;top:5px;right:5px;width:24px;height:24px;border:0;border-radius:50%;background:transparent;color:#7b8aa3;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.mkpet-bx:hover{background:#eef3fa;color:#16325B}',
      /* 안내 카드 */
      '.mkpet-panel{position:absolute;right:0;bottom:calc(100% + 10px);width:min(318px,calc(100vw - 28px));padding:20px 18px 16px;border-radius:20px;color:#fff;overflow:hidden;',
      'background:linear-gradient(170deg,#1b3b6b 0%,#16325B 60%,#122b50 100%);box-shadow:0 24px 60px rgba(3,10,26,.55),0 0 0 1px rgba(124,192,255,.22);',
      'opacity:0;transform:translateY(12px) scale(.96);transform-origin:100% 100%;pointer-events:none;visibility:hidden;transition:opacity .25s ease,transform .35s cubic-bezier(.2,1.2,.4,1),visibility 0s .3s}',
      '.mkpet.open .mkpet-panel{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition-delay:0s}',
      '.mkpet.open .mkpet-bub{opacity:0;pointer-events:none}',
      '.mkpet-panel::before{content:"";position:absolute;right:-60px;bottom:-70px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#3a5885,#2a446c);opacity:.75}',
      '.mkpet-pin{position:relative}',
      '.mkpet-badge{display:inline-block;padding:4px 10px;border-radius:99px;background:#ECF6FD;color:#16325B;font-size:11.5px;font-weight:700;letter-spacing:-.01em}',
      '.mkpet-h{margin:10px 0 0;font-size:20px;line-height:1.32;font-weight:800;letter-spacing:-.03em}',
      '.mkpet-d{margin:8px 0 0;font-size:13.5px;line-height:1.55;color:#DCE6F4;letter-spacing:-.02em}',
      '.mkpet-d em{font-style:normal;color:#9EE0EC;font-weight:600}',
      '.mkpet-ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:5px;font-size:12.5px;color:#C8D6EA}',
      '.mkpet-ul li{display:flex;gap:7px;align-items:flex-start}.mkpet-ul li::before{content:"";flex:none;width:14px;height:14px;margin-top:1px;border-radius:50%;background:#4fa3ff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%273.4%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M5 12.5l4.5 4.5L19 7.5%27/%3E%3C/svg%3E") center/9px no-repeat}',
      '.mkpet-go{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;min-height:48px;border-radius:99px;background:linear-gradient(180deg,#4fa3ff,#3a8cf5);color:#fff!important;text-decoration:none!important;font-size:15px;font-weight:700;letter-spacing:-.02em;overflow:hidden;',
      'box-shadow:0 8px 20px rgba(58,140,245,.45),inset 0 1px 0 rgba(255,255,255,.35)}',
      '.mkpet-go::after{content:"";position:absolute;top:0;bottom:0;left:-45%;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:mkpetShine 2.8s ease-in-out 0.6s infinite}',
      '.mkpet-go:hover{filter:brightness(1.07)}',
      '.mkpet-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}',
      '.mkpet-sub{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff!important;text-decoration:none!important;font-size:13.5px;font-weight:600;letter-spacing:-.02em}',
      '.mkpet-sub:hover{background:rgba(255,255,255,.12)}',
      '.mkpet-sub svg{width:15px;height:15px;flex:none}',
      '.mkpet-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}',
      '.mkpet-foot button{appearance:none;border:0;background:none;color:#A9B8D0;font:inherit;font-size:12.5px;padding:6px 2px;cursor:pointer}',
      '.mkpet-foot button:hover{color:#fff;text-decoration:underline;text-underline-offset:3px}',
      '.mkpet-px{position:absolute;top:10px;right:10px;width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:#DDE7F5;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}',
      '.mkpet-px:hover{background:rgba(255,255,255,.1)}.mkpet-px svg{width:18px;height:18px}',
      '.mkpet :focus-visible{outline:2px solid #7cc0ff;outline-offset:2px}',
      /* 접힘 — 가장자리 손잡이 */
      '.mkpet-mini{display:none;position:relative;width:54px;height:54px;padding:0;border:0;border-radius:18px 0 0 18px;margin-right:calc(-1 * max(26px,env(safe-area-inset-right)));',
      'background:linear-gradient(180deg,#1d3f72,#16325B);box-shadow:0 8px 20px rgba(3,12,30,.45),0 0 0 1px rgba(124,192,255,.35);cursor:pointer;overflow:hidden}',
      '.mkpet-mini img{position:absolute;left:3px;top:6px;width:48px;height:auto;pointer-events:none}',
      '.mkpet.min .mkpet-bot,.mkpet.min .mkpet-bub,.mkpet.min .mkpet-panel{display:none}',
      '.mkpet.min .mkpet-mini{display:block}',
      /* 모바일 */
      '@media(max-width:760px){.mkpet{--sz:86px;right:max(20px,env(safe-area-inset-right));bottom:calc(max(10px,env(safe-area-inset-bottom)) + var(--lift))}',
      '.mkpet-tag{font-size:11px;padding:5px 9px 5px 8px}.mkpet-bub{font-size:13px;max-width:min(210px,calc(100vw - 36px))}',
      '.mkpet-panel{padding:18px 16px 14px;right:-10px}.mkpet-h{font-size:19px}.mkpet-mini{margin-right:calc(-1 * max(20px,env(safe-area-inset-right)))}}',
      '@media(max-width:360px){.mkpet{--sz:78px;right:max(18px,env(safe-area-inset-right))}}',

      '@keyframes mkpetFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5%)}}',
      '@keyframes mkpetWingL{from{transform:rotate(5deg)}to{transform:rotate(-14deg)}}',
      '@keyframes mkpetWingR{from{transform:rotate(-5deg)}to{transform:rotate(14deg)}}',
      '@keyframes mkpetGlow{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(.85)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}}',
      '@keyframes mkpetBlink{0%,91%,100%{transform:scaleY(0)}94%,96%{transform:scaleY(1)}}',
      '@keyframes mkpetLive{0%{box-shadow:0 0 0 0 rgba(79,227,155,.6)}100%{box-shadow:0 0 0 7px rgba(79,227,155,0)}}',
      '@keyframes mkpetHop{0%,100%{transform:none}35%{transform:translateY(-14px) rotate(-6deg)}65%{transform:translateY(0) rotate(4deg)}}',
      '@keyframes mkpetShine{0%{left:-60%}55%,100%{left:130%}}',
      '@media(prefers-reduced-motion:reduce){.mkpet *,.mkpet *::before,.mkpet *::after{animation:none!important}.mkpet{transition:none}}'
    ].join('');
    d.head.appendChild(s);
  }

  var ICON_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';

  var root, bub, tipI = 0, bubTimer = null, bubCount = 0;

  function build() {
    css();
    root = d.createElement('div');
    root.className = 'mkpet'; root.id = 'mkpet'; root.setAttribute('data-zone', 'pet');
    root.innerHTML =
      '<div class="mkpet-bub" role="status" data-p="bub"><span class="mkpet-bt"></span><button type="button" class="mkpet-bx" data-p="bubx" data-track-off aria-label="말풍선 닫기">×</button></div>' +
      '<div class="mkpet-panel" id="mkpet-panel" role="dialog" aria-label="맞춤형 제안서 무료 제작 안내">' +
        '<button type="button" class="mkpet-px" data-p="close" data-track-off aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<div class="mkpet-pin">' +
          '<span class="mkpet-badge">맞춤형 제안서 무료 제작 EVENT</span>' +
          '<p class="mkpet-h">전 세계의 노하우를<br>우리 현장으로</p>' +
          '<p class="mkpet-d">글로벌 현장의 <em>실제 적용 사례 DB</em>로<br>우리 현장에 맞는 구성을 제안해 드려요.</p>' +
          '<ul class="mkpet-ul"><li>시설·고민만 고르면 1분이면 끝</li><li>구성·예상 비용까지 담아 무료 발송</li><li>상담 강요 없이 자료만 받아보셔도 돼요</li></ul>' +
          '<a class="mkpet-go" href="' + HREF + '" data-p="go" data-track-off>단 1분 만에 제안서 받아보기 <span aria-hidden="true">→</span></a>' +
          '<div class="mkpet-row">' +
            '<a class="mkpet-sub" href="' + CONTACT + '" data-p="contact" data-track-off>' + ICON_CHAT + '상담 문의</a>' +
            '<a class="mkpet-sub" href="tel:' + TEL.replace(/-/g, '') + '" data-p="tel" data-track-off>' + ICON_PHONE + TEL + '</a>' +
          '</div>' +
          '<div class="mkpet-foot"><button type="button" data-p="hide" data-track-off>도우미 숨기기</button><button type="button" data-p="close" data-track-off>닫기</button></div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="mkpet-bot" data-p="bot" data-track-off aria-expanded="false" aria-controls="mkpet-panel" aria-label="모넷 도우미 — 맞춤 제안서 안내 열기">' +
        '<div class="mkpet-stage" aria-hidden="true"><div class="mkpet-fl">' +
          '<img class="mkpet-wl" src="' + IMG + 'robot-wing-l.webp" alt="" width="178" height="382" decoding="async">' +
          '<img class="mkpet-wr" src="' + IMG + 'robot-wing-r.webp" alt="" width="176" height="390" decoding="async">' +
          '<img class="mkpet-body" src="' + IMG + 'robot-body.webp" alt="" width="456" height="464" decoding="async">' +
          '<i class="mkpet-glow"></i><i class="mkpet-lid l"></i><i class="mkpet-lid r"></i>' +
        '</div></div>' +
        '<span class="mkpet-tag"><i aria-hidden="true"></i>무료 제안서</span>' +
      '</button>' +
      '<button type="button" class="mkpet-mini" data-p="restore" data-track-off aria-label="모넷 도우미 다시 보기"><img src="' + IMG + 'robot-body.webp" alt="" width="456" height="464"></button>';
    d.body.appendChild(root);
    bub = root.querySelector('.mkpet-bub');

    if (sget('mk_pet_min') === '1') root.classList.add('min');
    root.addEventListener('click', onClick);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) { setOpen(false); root.querySelector('.mkpet-bot').focus(); } });
    d.addEventListener('click', function (e) { if (root.classList.contains('open') && !root.contains(e.target)) setOpen(false); }, true);

    /* 이미지가 준비되면 등장 (최대 1초) */
    var body = root.querySelector('.mkpet-body'), shown = false;
    function reveal() { if (shown) return; shown = true; requestAnimationFrame(function () { root.classList.add('in'); }); }
    if (body.complete) reveal(); else { body.addEventListener('load', reveal); body.addEventListener('error', reveal); }
    setTimeout(reveal, 1000);

    watch();
    /* 첫 말풍선 — 들어오자마자 */
    if (sget('mk_pet_bub_off') !== '1') {
      setTimeout(function () { showBub(); }, 1300);
      bubTimer = setInterval(function () { if (bubCount < 4) showBub(); else clearInterval(bubTimer); }, 28000);
    }
  }

  function showBub() {
    if (!root || root.classList.contains('open') || root.classList.contains('min') || root.classList.contains('away')) return;
    if (sget('mk_pet_bub_off') === '1') return;
    root.querySelector('.mkpet-bt').innerHTML = TIPS[tipI++ % TIPS.length];
    bub.classList.add('on'); bubCount++;
    root.classList.remove('hop'); void root.offsetWidth; if (!reduce) root.classList.add('hop');
    clearTimeout(showBub.t);
    showBub.t = setTimeout(function () { bub.classList.remove('on'); }, 7000);
  }

  function setOpen(on) {
    root.classList.toggle('open', !!on);
    root.querySelector('.mkpet-bot').setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { bub.classList.remove('on'); track('pet_open'); setTimeout(function () { try { root.querySelector('.mkpet-go').focus({ preventScroll: true }); } catch (e) {} }, 60); }
  }

  function onClick(e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    var a = b.getAttribute('data-p');
    if (a === 'bot') { setOpen(!root.classList.contains('open')); }
    else if (a === 'close') { setOpen(false); }
    else if (a === 'bub') { track('pet_bubble'); setOpen(true); }
    else if (a === 'bubx') { e.stopPropagation(); bub.classList.remove('on'); sset('mk_pet_bub_off', '1'); clearInterval(bubTimer); }
    else if (a === 'hide') { setOpen(false); root.classList.add('min'); sset('mk_pet_min', '1'); track('pet_hide'); }
    else if (a === 'restore') { root.classList.remove('min'); sset('mk_pet_min', ''); track('pet_restore'); setOpen(true); }
    else if (a === 'go' || a === 'contact') {
      track(a === 'go' ? 'pet_cta' : 'pet_contact', { to: b.getAttribute('href') });
      try { w.MonnitTrack && w.MonnitTrack.flush(); } catch (x) {}
      try { w.dataLayer && w.dataLayer.push({ event: a === 'go' ? 'pet_cta' : 'pet_contact' }); } catch (x) {}
      /* SPA 안에서도 확실히 이동 (새로 연다) */
      if (!(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); w.location.href = b.getAttribute('href'); }
    }
    else if (a === 'tel') { track('pet_tel'); }
  }

  /* ── 다른 고정 요소와 겹치지 않게 ─────────────────────────────────
     화면 아래에 붙는 고정 요소(모바일 하단 바 · 상담 버튼 · 쿠키 안내 · 진행 알림)가
     도우미 자리와 겹치면 그 위로 올라간다. 전체 화면 창(사진 확대 · 팝업)이 열리면 숨는다. */
  var fixedEls = [];
  function scan() {
    var out = [], all = d.body.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el === root || root.contains(el)) continue;
      var cs = w.getComputedStyle(el);
      if (cs.position === 'fixed') out.push(el);
    }
    fixedEls = out;
  }
  function visible(el, r, cs) {
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
  }
  function measure() {
    if (!root) return;
    var vw = w.innerWidth, vh = w.innerHeight, lift = 0, cover = false;
    var zoneL = vw - 150;   /* 도우미가 차지하는 가로 범위 */
    for (var i = 0; i < fixedEls.length; i++) {
      var el = fixedEls[i];
      if (!el.isConnected) continue;
      var r = el.getBoundingClientRect(); if (!r.width) continue;
      var cs = w.getComputedStyle(el);
      if (!visible(el, r, cs)) continue;
      /* 화면을 거의 덮는 창 → 숨는다 (단, 클릭이 통과하는 투명 틀은 제외) */
      if (r.width >= vw * 0.8 && r.height >= vh * 0.8) {
        if (cs.pointerEvents !== 'none') cover = true;
        /* 쿠키 안내 같은 틀 안의 실제 막대는 자식에 있다 */
        var kids = el.children;
        for (var k = 0; k < kids.length; k++) consider(kids[k].getBoundingClientRect());
        continue;
      }
      consider(r);
    }
    function consider(q) {
      if (!q.width || !q.height) return;
      if (q.height > vh * 0.6) return;
      if (q.bottom < vh - 4 - 140 || q.top > vh) return;     /* 아래쪽에 붙은 것만 */
      if (q.right < zoneL || q.left > vw) return;            /* 도우미 가로 범위와 겹칠 때만 */
      lift = Math.max(lift, Math.round(vh - q.top + 8));
    }
    lift = Math.min(lift, Math.round(vh * 0.5));
    root.style.setProperty('--lift', lift + 'px');
    root.classList.toggle('away', cover);
    if (cover && root.classList.contains('open')) setOpen(false);
  }
  function watch() {
    scan(); measure();
    setInterval(measure, 600);
    /* 새로 생기는 고정 요소(쿠키 안내 · SPA 알림)를 위해 가끔 다시 훑는다 */
    var rescan = function () { (w.requestIdleCallback || setTimeout)(function () { scan(); measure(); }); };
    setTimeout(rescan, 2500);
    var n = 0, iv = setInterval(function () { rescan(); if (++n > 8) { clearInterval(iv); setInterval(rescan, 30000); } }, 8000);
    w.addEventListener('resize', function () { measure(); }, { passive: true });
    /* 모바일: 스크롤하는 동안 살짝 물러난다 */
    var st = null;
    w.addEventListener('scroll', function () {
      if (w.innerWidth > 760) return;
      root.classList.add('scroll');
      clearTimeout(st); st = setTimeout(function () { root.classList.remove('scroll'); }, 450);
    }, { passive: true });
  }

  /* 켜기/끄기 — 마지막으로 받은 설정을 기억해 두었다가 꺼져 있었으면 확인 전까지 안 띄운다 */
  function boot() {
    var last = null; try { last = ls && ls.getItem('mk_pet_cfg'); } catch (e) {}
    var started = false;
    function go() { if (!started) { started = true; build(); } }
    if (last !== 'off') go();
    try {
      w.fetch('/api/popup', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j) return;
        var on = j.pet !== false;
        try { ls && ls.setItem('mk_pet_cfg', on ? 'on' : 'off'); } catch (e) {}
        if (on) go(); else if (root) { root.parentNode && root.parentNode.removeChild(root); root = null; }
      }).catch(function () {});
    } catch (e) {}
  }

  w.MonnitPet = { open: function () { if (root) { root.classList.remove('min'); setOpen(true); } }, tip: function () { showBub(); } };
  if (d.body) boot(); else d.addEventListener('DOMContentLoaded', boot);
})(window, document);
