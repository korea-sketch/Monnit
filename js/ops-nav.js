/* 관제(/ops) 메뉴 묶음 (2026-11-09)
   예전에는 탭 8개가 한 줄로 늘어서 있었다. 하는 일 기준으로 4묶음으로 나누고, 고른 묶음의 세부 메뉴만 아래 줄에 보여 준다.
   각 화면의 <nav class="opsnav"> 안 링크를 그대로 옮겨 담는다 — 맞춤 제안서 화면처럼 링크에 클릭 동작이 걸려 있어도 유지된다.
   메뉴를 더하거나 옮기려면 아래 GROUPS 만 고치면 된다. */
(function () {
  'use strict';
  var GROUPS = [
    { key: 'home', label: '대시보드', items: [['/ops', '통합 관제']] },
    { key: 'journey', label: '고객 여정', items: [['/ops/journey', '여정 · 매출 연결'], ['/ops/flow', '유입 · 경로'], ['/ops/proposals/insights', '고객 인사이트'], ['/ops/proposals/misses', '규칙이 놓친 말']] },
    { key: 'sales', label: '접수 · 영업', items: [['/ops/mall', '리소스 센터 접수'], ['/ops/proposals', '맞춤 제안서'], ['/ops/proposals/archive', '발송 대장']] },
    { key: 'admin', label: '설정', items: [['/ops/notices', '알림함'], ['/ops/block', '차단 관리']] }
  ];
  function run() {
    var nav = document.querySelector('nav.opsnav');
    if (!nav || nav.dataset.grouped) return;
    nav.dataset.grouped = '1';
    var links = {};
    Array.prototype.forEach.call(nav.querySelectorAll('a[href]'), function (a) { links[a.getAttribute('href').replace(/\/+$/, '') || '/ops'] = a; });
    var top = document.createElement('div'); top.className = 'opsg';
    var sub = document.createElement('div'); sub.className = 'opss';
    var park = document.createElement('div'); park.hidden = true;
    var brand = document.createElement('a'); brand.className = 'opsg-brand'; brand.href = '/ops'; brand.textContent = 'MONNIT OPS';
    top.appendChild(brand);
    var groupEls = {}, subWraps = {};
    GROUPS.forEach(function (g) {
      var ga = document.createElement('a'); ga.className = 'opsg-a'; ga.href = g.items[0][0]; ga.textContent = g.label; ga.dataset.g = g.key;
      top.appendChild(ga); groupEls[g.key] = ga;
      var w = document.createElement('div'); w.className = 'opss-w'; w.dataset.g = g.key;
      g.items.forEach(function (it) {
        var a = links[it[0]];
        if (!a) { a = document.createElement('a'); a.href = it[0]; }
        a.textContent = it[1];
        delete links[it[0]];
        w.appendChild(a);
      });
      subWraps[g.key] = w; sub.appendChild(w);
    });
    /* 묶음에 없는 링크(혹시 남은 것)는 숨겨 두되 버리지 않는다 */
    Object.keys(links).forEach(function (k) { park.appendChild(links[k]); });
    nav.textContent = '';
    nav.appendChild(top); nav.appendChild(sub); nav.appendChild(park);
    nav.classList.add('opsnav--g');

    var path = location.pathname.replace(/\/+$/, '') || '/ops';
    function activeGroup() {
      /* 화면 안에서 탭을 바꾸는 페이지(맞춤 제안서)는 a.on 을 따른다 */
      var on = nav.querySelector('.opss a.on');
      var href = on ? on.getAttribute('href').replace(/\/+$/, '') : path;
      var best = null, bestLen = -1;
      GROUPS.forEach(function (g) { g.items.forEach(function (it) { var h = it[0]; if ((href === h || href.indexOf(h + '/') === 0) && h.length > bestLen) { best = g.key; bestLen = h.length; } }); });
      return best || 'home';
    }
    function paint() {
      var g = activeGroup();
      Object.keys(groupEls).forEach(function (k) { groupEls[k].classList.toggle('on', k === g); subWraps[k].hidden = k !== g; });
      /* 서버가 a.on 을 안 붙인 화면이면 주소로 표시 */
      if (!nav.querySelector('.opss a.on')) {
        var w = subWraps[g], best = null, len = -1;
        Array.prototype.forEach.call(w.querySelectorAll('a'), function (a) { var h = a.getAttribute('href').replace(/\/+$/, ''); if ((path === h || path.indexOf(h + '/') === 0) && h.length > len) { best = a; len = h.length; } });
        if (best) best.classList.add('on');
      }
      sub.hidden = subWraps[g].children.length < 2;
    }
    paint();
    new MutationObserver(paint).observe(sub, { subtree: true, attributes: true, attributeFilter: ['class'] });

    var st = document.createElement('style');
    st.textContent = [
      'nav.opsnav.opsnav--g{display:block!important;padding:0!important;gap:0!important;overflow:visible!important}',
      '.opsg{display:flex;align-items:center;gap:2px;padding:10px 16px 8px;overflow-x:auto;scrollbar-width:none}',
      '.opsg::-webkit-scrollbar,.opss::-webkit-scrollbar{display:none}',
      '.opsg-brand{font-weight:800;font-size:12px;line-height:1;font-family:inherit;letter-spacing:.14em;color:#7aa8ff!important;text-decoration:none;margin-right:14px;white-space:nowrap;padding:0!important;border:0!important;background:none!important}',
      '.opsg a.opsg-a{color:#A6B3CC;text-decoration:none;padding:8px 14px!important;border-radius:999px!important;font-size:14px;font-weight:700;white-space:nowrap;border:1px solid transparent!important;background:none}',
      '.opsg a.opsg-a:hover{color:#F2F5FA;background:rgba(255,255,255,.05)}',
      '.opsg a.opsg-a.on{color:#fff;background:rgba(122,168,255,.16);border-color:rgba(122,168,255,.35)!important}',
      '.opss{display:flex;gap:2px;padding:0 16px;overflow-x:auto;scrollbar-width:none;border-top:1px solid rgba(255,255,255,.06)}',
      '.opss-w{display:flex;gap:2px}',
      '.opss-w[hidden],.opss[hidden]{display:none!important}',
      '.opss a{color:#8f9bb5;text-decoration:none;padding:10px 12px!important;font-size:13px;font-weight:600;white-space:nowrap;border:0!important;border-bottom:2px solid transparent!important;border-radius:0!important;background:none!important}',
      '.opss a:hover{color:#F2F5FA}',
      '.opss a.on{color:#fff;border-bottom-color:#7aa8ff!important;box-shadow:none!important}',
      '@media (max-width:700px){.opsg{padding:8px 12px 6px}.opsg-brand{display:none}.opsg a.opsg-a{padding:7px 12px!important;font-size:13.5px}.opss{padding:0 12px}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
