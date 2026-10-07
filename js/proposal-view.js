/*! 모넷 맞춤 제안서 — 사이트 화면 (SPA 뷰) · 2026-09-17
 *
 *  index.html 의 두 화면을 움직인다. app.js 의 navigate() 가 들어올 때마다 MKProposal.enter() 를 부른다.
 *    #view-proposal         /proposal          신청 (산업 → 문제 → 효과 → 받으실 분)
 *                           /proposal?from=finder&fac=&con=&scale=   홈 솔루션 파인더에서 온 빠른 신청(담당자 정보만)
 *                           /proposal?industry=&problems=a,b         광고 주소로 미리 채우기
 *    #view-proposal-status  /proposal/status   신청 뒤 진행 현황 (개인 화면)
 *                           토큰은 주소가 아니라 이 탭의 sessionStorage(mk_prop_t)에 둔다 — index.html 머리말 참고
 *                           /proposal/status?demo=1&co=회사&nm=이름&ind=datacenter  시연(서버 호출 없음)
 *
 *  데이터: window.MK_PROPOSAL_DATA (js/proposal-data.js, 빌드 때 scripts/proposal-sync.mjs 가 생성)
 *  서버:   /api/proposal · /status · /preview · /detect  (netlify/functions/proposal-api.mjs)
 *  외부에서 쓰는 함수: MKProposal.enter(kind) · fromContact(body, btn) · goStatus(result) */
(function (w, d) {
  'use strict';
  if (w.MKProposal) return;

  var DATA = w.MK_PROPOSAL_DATA || { kb: { industries: [], problems: {}, goals: {}, scales: [], timelines: [], finder: {}, playbooks: {} }, cases: [] };
  var KB = DATA.kb;
  var FINDER = KB.finder || { fac: {}, segment: {}, con: {}, scale: {} };
  var TEL = '02-2088-1454';
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ss = {
    get: function (k) { try { return w.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { w.sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { w.sessionStorage.removeItem(k); } catch (e) {} }
  };
  function push(ev, extra) { try { w.dataLayer = w.dataLayer || []; w.dataLayer.push(Object.assign({ event: ev }, extra || {})); } catch (e) {} }
  function active(id) { var v = d.getElementById(id); return !!(v && v.classList.contains('active')); }
  /* 사이트 라우터로 이동 — 주소를 먼저 바꾸고 navigate() 를 부른다 (setURL 이 같은 주소를 다시 쌓지 않음) */
  function go(route, search) {
    try { w.history.pushState({ route: route }, '', '/' + route + (search || '')); } catch (e) {}
    if (typeof w.navigate === 'function') w.navigate(route);
  }
  var ind = function (k) { return KB.industries.filter(function (i) { return i.key === k; })[0]; };

  /* ── 언어 — 사이트 KO/EN 토글(i18n.js)을 따른다. 제안서 PDF·메일은 한국어 ── */
  var EN = DATA.en || {};
  function isEn() { try { return d.documentElement.getAttribute('lang') === 'en' || w.localStorage.getItem('mlang') === 'en'; } catch (e) { return d.documentElement.getAttribute('lang') === 'en'; } }
  function L(ko, en) { return isEn() ? en : ko; }
  var HANGUL = /[가-힣]/;
  function indL(I, f) { if (!I) return ''; if (!isEn()) return I[f || 'label']; var e = (EN.industries || {})[I.key] || {}; return e[f || 'label'] || ''; }
  function probL(k) { var p = KB.problems[k] || {}; return isEn() ? (((EN.problems || {})[k] || {}).label || '') : p.label; }
  function probD(k) { var p = KB.problems[k] || {}; return isEn() ? (((EN.problems || {})[k] || {}).desc || '') : p.desc; }
  function goalL(k) { return isEn() ? ((EN.goals || {})[k] || '') : KB.goals[k]; }
  function sensorL(k) { return isEn() ? ((EN.sensors || {})[k] || KB.sensors[k]) : KB.sensors[k]; }
  function pbL(ko) { return isEn() ? ((EN.playbook || {})[ko] || '') : ko; }
  function optL(kind, ko) { return isEn() ? ((EN[kind] || {})[ko] || ko) : ko; }
  function caseById(k) { return DATA.cases.filter(function (c) { return c.key === k; })[0]; }
  /* 사례 문구 — 영문이면 사전으로, 없는 항목은 뺀다 */
  function caseL(t) {
    if (!isEn()) return t;
    var e = (EN.cases || {})[t.key] || {}, src = caseById(t.key) || { results: [] };
    var res = (t.results || []).map(function (r) {
      var i = -1; src.results.forEach(function (x, j) { if (x.l === r.l) i = j; });
      var n = HANGUL.test(r.n) ? ({ 'AI 학습': 'AI-ready', '분 단위': 'Per-minute', '방폭 구간': 'Ex zones', '수억원+': 'KRW 100M+' })[r.n] || '' : r.n;
      return { n: n, l: i >= 0 && e.results ? e.results[i] : (HANGUL.test(r.l) ? '' : r.l) };
    }).filter(function (r) { return r.n && r.l; });
    return Object.assign({}, t, { name: (e.name && !HANGUL.test(e.name)) ? e.name : (HANGUL.test(t.name || '') ? 'Monnit reference' : t.name), tagline: e.tagline || '', results: res,
      why: (t.why || []).filter(function (x) { return !HANGUL.test(x); }) });
  }
  /* 링크는 사이트 안 경로나 https 만 */
  function safeUrl(u) { u = String(u || ''); return /^\/(?!\/)/.test(u) || /^https:\/\//i.test(u) ? u : ''; }
  var BRAND = { countries: '130+', publicRef: L('공공기관·대기업', 'public agencies and major enterprises') };

  /* 쿠키 동의 바(모바일 하단)가 떠 있으면 하단 버튼을 그 위로 */
  (function ccOffset() {
    var set = function () {
      var cc = d.getElementById('mnk-cc'), h = 0;
      if (cc && cc.classList.contains('show') && cc.classList.contains('bar')) { var box = cc.firstElementChild || cc; h = Math.round(box.getBoundingClientRect().height); }
      d.documentElement.style.setProperty('--cc-h', h + 'px');
    };
    try { new MutationObserver(set).observe(d.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    w.addEventListener('resize', set); set();
  })();

  /* ═══════════════════════════════════════════════════════════════
     신청 화면
     ═══════════════════════════════════════════════════════════════ */
  var A = {
    ready: false, sig: null, T0: Date.now(),
    st: { industry: '', problems: [], goals: [], caseViews: 0, started: false, sending: false, edited: false, detect: null },
    Q: null, QF: null, quick: false, demo: false, detailsOpen: false, goalsOpen: false,
    analyzing: false, analysisTimer: null, analysisSubmitTimer: null
  };
  var DRAFT = 'mk_prop_draft_v2';
  var val = function (id) { return String(($('#' + id) || {}).value || '').trim(); };

  function initApply() {
    if (A.ready) return;
    A.ready = true;
    relabelApply();
    prepareRecipientLayout();
    prepareStepHeadings();

    $('#ppInds').addEventListener('click', function (e) {
      var b = e.target.closest('.mkp-ind'); if (!b) return;
      A.st.edited = true;
      pickIndustry(b.dataset.k, true);
    });
    $('#ppPlist').addEventListener('click', function (e) {
      var b = e.target.closest('.mkp-pitem'); if (!b) return;
      /* 무료 제안서는 가장 고민되는 문제 하나 — 다른 것을 누르면 바꾼다 */
      A.st.problems = A.st.problems[0] === b.dataset.k ? [] : [b.dataset.k];
      [].forEach.call($('#ppPlist').querySelectorAll('.mkp-pitem'), function (x) {
        var on = A.st.problems.indexOf(x.dataset.k) >= 0;
        x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on));
      });
      A.st.edited = true;
      $('#ppErrProblems').hidden = true;
      renderChronic();
      push('proposal_problem_select', { proposal_problem: b.dataset.k });
      saveDraft(); updateCta(); preview();
    });
    $('#ppGoals').addEventListener('click', function (e) {
      var b = e.target.closest('.mkp-chip'); if (!b) return;
      toggle(A.st.goals, b.dataset.k, 4); A.st.edited = true;
      renderGoals(); saveDraft(); preview();
    });
    $('#ppTopCase').addEventListener('click', function (e) { if (e.target.closest('[data-case]')) { A.st.caseViews++; push('proposal_case_click'); } });
    $('#ppScale').addEventListener('change', saveDraft);
    $('#ppTimeline').addEventListener('change', saveDraft);
    $('#ppFactoryConsult').addEventListener('change', saveDraft);
    $$('.mkp-select-trigger').forEach(function (b) {
      b.addEventListener('click', function () { openOptionPanel(b.dataset.optionType); });
    });

    /* 폼 */
    $('#ppForm').addEventListener('input', function (e) {
      if (!A.st.started) { A.st.started = true; push('proposal_form_start'); }
      var box = e.target.closest('.mkp-fld'); if (box && box.classList.contains('bad')) setErr(box.dataset.f, '');
      saveDraft(); updateCta();
    });
    $('#ppForm').addEventListener('submit', function (e) { e.preventDefault(); $('#ppCta').click(); });
    $('#ppConsent').addEventListener('change', function () { setErr('consent', ''); updateCta(); });
    $('#ppEmail').addEventListener('blur', function () {
      var V = w.MonnitValid; if (!V || !val('ppEmail')) return;
      var r = V.email(val('ppEmail'));
      if (!r.ok) setErr('email', (isEn() ? 'Please check the email address' : r.message) + (r.suggest ? L(' (눌러서 고치기)', ' (tap to fix: ' + r.suggest + ')') : ''));
    });
    $('.mkp-fld[data-f="email"] .mkp-ferr').addEventListener('click', function () {
      var V = w.MonnitValid, r = V && V.email(val('ppEmail'));
      if (r && r.suggest) { $('#ppEmail').value = r.suggest; setErr('email', ''); }
    });
    $('#ppPhone').addEventListener('blur', function () { var V = w.MonnitValid; if (V && val('ppPhone')) { var p = V.phone(val('ppPhone'), { required: false }); if (p.ok && p.value) $('#ppPhone').value = p.value; } });
    $('#ppCompany').addEventListener('input', detectCompany);
    $('#ppEmail').addEventListener('change', detectCompany);
    $('#ppDetect').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ind]'); if (!b) return;
      A.st.edited = true; pickIndustry(b.dataset.ind, false); detectCompany();
    });
    $('#ppQEdit').addEventListener('click', function () {
      A.st.edited = true;
      $('#ppS1').hidden = false; $('#ppS3').hidden = false; this.hidden = true;
      $('#ppS1').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#ppRegion').readOnly = true;
    $('#ppRegion').setAttribute('aria-haspopup', 'dialog');
    $('#ppRegion').addEventListener('click', openRegionPanel);
    $('#ppRegion').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRegionPanel(); }
    });
    $('#ppBack').addEventListener('click', onBack);
    $('#ppCta').addEventListener('click', onCta);
    $('#ppEventCancel').addEventListener('click', function () { closeEventPrompt(); continueProposal(); });
    $('#ppEventApply').addEventListener('click', function () {
      if (!w.confirm('이벤트에 참여하시겠습니까?')) return;
      $('#ppFactoryConsult').checked = true;
      saveDraft();
      closeEventPrompt();
      continueProposal();
    });
    $('#ppEventModal').addEventListener('click', function (e) {
      if (e.target === this) { closeEventPrompt(); continueProposal(); }
    });
  }

  function prepareRecipientLayout() {
    var form = $('#ppForm');
    if (!form || form.querySelector('.mkp-form-panel')) return;
    var panel = d.createElement('div');
    panel.className = 'mkp-form-panel';
    [].slice.call(form.children).filter(function (el) {
      return el.classList && (el.classList.contains('mkp-row2') || el.classList.contains('mkp-fld'));
    }).forEach(function (el) { panel.appendChild(el); });
    var hp = $('#ppWebsite');
    if (hp && hp.nextSibling) form.insertBefore(panel, hp.nextSibling); else form.insertBefore(panel, form.firstChild);
  }

  function prepareStepHeadings() {
    var main = $('.mkp-main'); if (!main) return;
    ['ppS1', 'ppS3'].forEach(function (id) {
      var step = $('#' + id), head = step && step.querySelector('.mkp-step-h');
      if (!step || !head || head.classList.contains('mkp-outside-heading')) return;
      head.classList.add('mkp-outside-heading', 'is-for-' + id.toLowerCase());
      main.insertBefore(head, step);
      /* 2026-10-07 — 단계 밖으로 꺼낸 제목은 그 단계가 숨겨지면 같이 숨긴다 (산업을 고르기 전 「03」 제목만 떠 있던 문제) */
      var sync = function () { head.hidden = step.hidden; };
      sync();
      if (w.MutationObserver) new MutationObserver(sync).observe(step, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* 언어가 바뀌거나 처음 들어올 때 — 산업 버튼·선택 목록 글자 */
  function relabelApply() {
    var groups = [
      { title:L('산업·생산','Industry & production'), keys:['manufacturing','bio_pharma','food_agri'] },
      { title:L('건물·생활시설','Buildings & living facilities'), keys:['building_fm','residential','edu_med'] },
      { title:L('학교·공공기관','Schools & public sector'), keys:['education','public'] },
      { title:L('소상공인·매장','Small business'), keys:['small_biz'] },
      { title:L('에너지·인프라','Energy & infrastructure'), keys:['energy','construction'] },
      { title:L('물류·특수시설','Logistics & special facilities'), keys:['cold_chain','datacenter'] },
      { title:L('기타','Other'), keys:['general'] }
    ];
    /* 데이터에 새 산업이 생겨도 화면에서 빠지지 않게 — 묶음에 없는 산업은 「기타」 앞에 붙인다 */
    var listed = {}; groups.forEach(function (g) { g.keys.forEach(function (k) { listed[k] = 1; }); });
    (KB.industries || []).forEach(function (i) { if (!listed[i.key]) groups[groups.length - 1].keys.unshift(i.key); });
    $('#ppInds').innerHTML = groups.map(function (group) {
      var buttons = group.keys.map(ind).filter(Boolean).map(function (i) {
        return '<button type="button" class="mkp-ind" aria-pressed="' + (A.st.industry === i.key) + '" data-k="' + i.key + '">' + esc(indL(i)) + '</button>';
      }).join('');
      return '<section class="mkp-ind-group"><h4>' + esc(group.title) + '</h4><div class="mkp-ind-options">' + buttons + '</div></section>';
    }).join('');
    [['#ppScale', KB.scales, 'scales'], ['#ppTimeline', KB.timelines, 'timelines']].forEach(function (x) {
      var sel = $(x[0]), cur = sel.value;
      sel.options.length = 1; sel.options[0].text = L('선택 안 함', 'Not selected');
      x[1].forEach(function (s) { sel.add(new Option(optL(x[2], s), s)); });
      sel.value = cur;
    });
  }
  function toggle(arr, k, max) { var i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else if (arr.length < max) arr.push(k); }

  function pickIndustry(k, scroll) {
    if (!ind(k)) return;
    if (A.st.industry !== k) A.st.problems = [];
    A.st.industry = k;
    $$('.mkp-ind').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === k)); });
    renderIndustry();
    ['#ppS2', '#ppS3', '#ppS4'].forEach(function (s) { var el = $(s); if (el.hidden && !(A.quick && s === '#ppS3' && !A.st.edited)) { el.hidden = false; el.classList.add('mkp-reveal'); } });
    push('proposal_industry_select', { proposal_industry: k });
    saveDraft(); updateCta(); preview();
    if (scroll) setTimeout(function () { $('#ppS2').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }

  function renderIndustry() {
    var I = ind(A.st.industry); if (!I) return;
    $('#ppIndShort').textContent = indL(I, 'short') || indL(I);
    var peers = isEn() ? [] : DATA.cases.filter(function (c) { return !c.detailed && !c.global && c.industries.indexOf(I.key) >= 0; }).map(function (c) { return c.name; });
    $('#ppIndHero').innerHTML = esc(indL(I, 'hero')) + (peers.length ? '<span>같은 업종 도입 고객 · ' + esc(peers.slice(0, 6).join(', ')) + '</span>' : '');
    $('#ppPlist').innerHTML = I.problems.filter(function (k) { return probL(k); }).map(function (k) {
      var on = A.st.problems.indexOf(k) >= 0;
      return '<button type="button" role="radio" class="mkp-pitem' + (on ? ' on' : '') + '" data-k="' + k + '" aria-checked="' + on + '" aria-pressed="' + on + '"><span class="mkp-ck" aria-hidden="true"></span><span><b>' + esc(probL(k)) + '</b><small>' + esc(probD(k)) + '</small></span></button>';
    }).join('');
    renderChronic(); renderGoals();
    var fallbackTop = localTop();
    renderTopCase(fallbackTop);
    if (A.quick && fallbackTop) {
      $('#ppLmPct').textContent = fallbackTop.pct + '%';
      $('#ppLmBar').style.width = fallbackTop.pct + '%';
      $('#ppLmText').innerHTML = L('지금 가장 닮은 Monnit 레퍼런스 · ', 'Closest Monnit reference now · ') + '<b>' + esc(caseL(fallbackTop).name) + '</b>';
    }
  }
  function renderChronic() {
    var P = (KB.playbooks || {})[A.st.industry], box = $('#ppChronic');
    if (!P || !P.chronic || !P.chronic.length) { box.hidden = true; return; }
    box.hidden = false;
    var list = P.chronic.slice(0, 4).filter(function (c) { return pbL(c.title); });
    if (!list.length) { box.hidden = true; return; }
    /* 처음에는 접어 둔다 — 고르는 일에 먼저 집중하도록 (2026-09-18) */
    box.innerHTML = '<summary class="mkp-chronic-h">' + L('모넷이 이 현장에서 반복해서 보는 문제 ' + list.length + '가지 — 눌러서 보기', 'What Monnit sees repeatedly here — ' + list.length + ' problems') + '</summary>'
      + '<div class="mkp-chronic-b">' + list.map(function (c) {
        var on = (c.problems || []).some(function (k) { return A.st.problems.indexOf(k) >= 0; });
        return '<div class="mkp-ch' + (on ? ' on' : '') + '"><b>' + esc(pbL(c.title)) + '</b><span>' + esc(pbL(c.detail)) + '</span></div>';
      }).join('') + '</div>';
  }
  function renderGoals() {
    var I = ind(A.st.industry); if (!I) return;
    var rec = I.goals || [];
    var groups = [
      { title:L('사고·안전 관리','Incident & safety'), keys:['response','loss','safety'] },
      { title:L('설비 운영 효율화','Operational efficiency'), keys:['downtime','labor'] },
      { title:L('비용 절감','Cost reduction'), keys:['energy','capex'] },
      { title:L('데이터·관리 자동화','Data & management automation'), keys:['integration','compliance'] }
    ];
    $('#ppGoals').innerHTML = groups.map(function (group) {
      var buttons = group.keys.filter(function (g) { return goalL(g); }).map(function (g) {
        var on = A.st.goals.indexOf(g) >= 0;
        return '<button type="button" class="mkp-chip" aria-pressed="' + on + '" data-k="' + g + '">' + esc(goalL(g)) + '</button>';
      }).join('');
      return '<section class="mkp-goal-group"><h4>' + esc(group.title) + '</h4><div class="mkp-goal-options">' + buttons + '</div></section>';
    }).join('');
  }

  function localTop() {
    var list = DATA.cases.filter(function (c) { return c.detailed && c.results.length; });
    var I = ind(A.st.industry) || {};
    var problem = A.st.problems[0] || (I.problems || [])[0] || '';
    var goalSig = A.st.goals.length ? A.st.goals.slice().sort().join(',') : '_default';
    var map = w.MK_INSIGHT_MAP || {};
    var hit = map[A.st.industry + '|' + problem + '|' + goalSig] || map[A.st.industry + '|' + problem + '|_default'];
    var c = hit && list.find(function (x) { return x.key === hit.key; });
    if (!c) {
      list.sort(function (a, b) {
        var sa = a.industries.indexOf(A.st.industry) >= 0 ? 1 : 0, sb = b.industries.indexOf(A.st.industry) >= 0 ? 1 : 0;
        return (sb - sa) || (a.global - b.global);
      });
      c = list[0];
    }
    return c ? { key: c.key, name: c.name, tagline: c.tagline, results: c.results, global: c.global, image: c.image, url: c.url,
      pct: hit ? hit.pct : 0, why: hit ? hit.why : [] } : null;
  }
  function renderTopCase(t) {
    var box = $('#ppTopCase');
    if (!t) { box.innerHTML = ''; return; }
    t = caseL(t);
    var url = safeUrl(t.url), img = safeUrl(t.image);
    box.innerHTML =
      '<a class="mkp-case" href="' + esc(url || '#') + '"' + caseLinkAttrs(url, 'proposal') + ' data-case>' +
      '<span class="mkp-case-ph"' + (img ? ' style="background-image:url(\'' + esc(img).replace(/'/g, '%27') + '\')"' : '') + '><em>' + (t.pct != null ? L('가장 닮은 사례 · ', 'Closest match · ') + t.pct + '%' : L('대표 사례', 'Featured reference')) + '</em></span>' +
      '<span class="mkp-case-in"><b>' + esc(t.name) + '<i>' + (t.global ? L('Monnit 글로벌', 'Monnit global') : L('국내', 'Korea')) + '</i></b>' +
      (t.tagline ? '<span class="mkp-case-tg">' + esc(t.tagline) + '</span>' : '') +
      (t.why && t.why.length ? '<span class="mkp-case-why">' + esc(t.why.join(' · ')) + '</span>' : '') +
      '<span class="mkp-nums">' + (t.results || []).slice(0, 3).map(function (r) { return '<span><b>' + esc(r.n) + '</b><small>' + esc(r.l) + '</small></span>'; }).join('') + '</span></span></a>';
  }
  function renderPeek(pb) {
    var box = $('#ppPeek');
    if (!pb || !pb.zones) { box.innerHTML = ''; return; }
    var seg = pb.segment ? pbL(pb.segment.label) : '';
    box.innerHTML =
      /* 2026-09-18 — 옆 칸이 화면보다 길어져 아래에 빈 공간이 생기던 것을 고침: 상세는 접어 둔다 */
      '<details class="mkp-peek-d"><summary class="mkp-peek-h">' + L('제안서에 들어갈 공정·구역 ' + pb.zones.length + '곳', pb.zones.length + ' zones in your proposal') + (seg ? ' · ' + esc(seg) : '') + '</summary>' +
      '<div class="mkp-zones">' + pb.zones.filter(function (z) { return pbL(z.zone); }).map(function (z) { return '<span class="' + (z.focus ? 'on' : '') + '">' + esc(pbL(z.zone)) + '</span>'; }).join('') + '</div></details>' +
      '<details class="mkp-peek-d"><summary class="mkp-peek-h">' + L('센서 이후 — 스마트 관리 로드맵 ' + (pb.automation || []).length + '단계', 'Beyond sensors — ' + (pb.automation || []).length + '-step roadmap') + '</summary>' +
      '<div class="mkp-road">' + (pb.automation || []).map(function (a, i) { return '<i class="' + (i >= 2 ? 'lock' : '') + '" style="height:' + (34 + i * 10) + 'px"><em>L' + (i + 1) + '</em>' + esc(pbL(a) || a) + '</i>'; }).join('') + '</div></details>';
  }

  /* 실시간 매칭 (서버 계산, 5분 캐시) */
  var pvTimer = null, pvSeq = 0;
  function preview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () {
      if (!A.st.industry) return;
      var seq = ++pvSeq, st = A.st;
      var seg = st.detect && st.detect.industry === st.industry ? st.detect.segment : (A.quick && !st.edited ? (FINDER.segment[A.QF.fac] || '') : '');
      var u = '/api/proposal/preview?industry=' + st.industry + '&problems=' + st.problems.join(',') + '&goals=' + st.goals.join(',') + (seg ? '&segment=' + seg : '');
      fetch(u).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
        if (!x || seq !== pvSeq || !x.top || !x.top[0]) return;
        var t = x.top[0], picked = st.problems.length || A.quick;
        renderTopCase(t);
        renderPeek(x.playbook);
        $('#ppLmPct').textContent = picked ? t.pct + '%' : '–';
        $('#ppLmBar').style.width = (picked ? t.pct : 8) + '%';
        $('#ppLmText').innerHTML = picked ? L('지금 가장 닮은 Monnit 레퍼런스 · ', 'Closest Monnit reference now · ') + '<b>' + esc(caseL(t).name) + '</b>' : L('문제를 고르면 일치도가 올라갑니다', 'Pick a problem to sharpen the match');
      }).catch(function () { /* 미리보기 실패는 신청에 영향 없음 */ });
    }, 250);
  }

  /* 회사 인식 칩 */
  var dtTimer = null, dtSeq = 0;
  function detectCompany() {
    clearTimeout(dtTimer);
    dtTimer = setTimeout(function () {
      var co = val('ppCompany'), box = $('#ppDetect');
      if (co.replace(/\s/g, '').length < 2 || A.demo) { box.hidden = true; A.st.detect = null; return; }
      var seq = ++dtSeq;
      var q = new URLSearchParams({ company: co, email: val('ppEmail'), fac: A.QF.fac, con: A.QF.con, entry: A.quick ? 'finder' : 'proposal' });
      fetch('/api/proposal/detect?' + q.toString()).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
        if (!x || seq !== dtSeq) return;
        A.st.detect = x;
        var I = ind(x.industry);
        var lab = x.segmentLabel ? pbL(x.segmentLabel) : (x.industryLabel && I ? indL(I) : '');
        if (!lab || x.confidence < 0.6) { box.hidden = true; return; }
        var html = L('<b>' + esc(lab) + '</b> 현장 기준으로 제안서를 구성합니다', 'We’ll build your proposal for a <b>' + esc(lab) + '</b> site');
        /* 아직 산업을 고르지 않았으면 자동으로 정하지 않고, 고객이 눌러서 고르도록 버튼만 보여 준다 */
        if (!A.st.industry) {
          if (!I) { box.hidden = true; return; }
          html = L('<b>' + esc(lab) + '</b> 현장으로 보입니다', 'Looks like a <b>' + esc(lab) + '</b> site') + ' <button type="button" data-ind="' + x.industry + '">' + L('「' + esc(indL(I)) + '」 선택하기', 'Select “' + esc(indL(I)) + '”') + '</button>';
        }
        else if (!A.quick && x.industry !== A.st.industry) {
          if (x.confidence >= 0.8 && I) html += ' <button type="button" data-ind="' + x.industry + '">' + L('산업을 「' + esc(indL(I)) + '」로 바꾸기', 'Switch industry to “' + esc(indL(I)) + '”') + '</button>';
          else { box.hidden = true; return; }
        }
        box.innerHTML = html; box.hidden = false;
        push('proposal_company_detect', { proposal_detect: x.industry, proposal_detect_known: !!x.known });
        /* 파인더에서 「그 외 시설」을 골랐는데 회사로 업종이 분명하면 화면도 그 산업으로 */
        if (A.quick && !A.st.edited && x.from === 'detect' && x.industry !== A.st.industry) {
          var keep = A.st.problems.slice();
          pickIndustry(x.industry, false);
          A.st.problems = keep.filter(function (k) { return (ind(x.industry) || { problems: [] }).problems.indexOf(k) >= 0; });
          renderIndustry(); $('#ppS3').hidden = true;
        }
        preview();
      }).catch(function () {});
    }, 450);
  }

  /* 검증 · 버튼 */
  function setErr(f, msg) {
    var e = f === 'consent' ? $('#ppErrConsent') : $('.mkp-fld[data-f="' + f + '"] .mkp-ferr');
    var box = $('.mkp-fld[data-f="' + f + '"]');
    if (box) box.classList.toggle('bad', !!msg);
    if (e) { e.textContent = msg || ''; e.classList.toggle('on', !!msg); }
  }
  function validate(show) {
    var V = w.MonnitValid, errs = {};
    if (val('ppCompany').length < 2) errs.company = L('회사명을 입력해 주세요', 'Please enter your company name');
    if (val('ppName').length < 2) errs.name = L('성함을 입력해 주세요', 'Please enter your name');
    var em = V ? V.email(val('ppEmail')) : { ok: /.+@.+\..+/.test(val('ppEmail')) };
    if (!em.ok) errs.email = isEn() ? 'Please check the email address' : (em.message || '이메일 주소를 확인해 주세요');
    if (val('ppPhone') && V) { var ph = V.phone(val('ppPhone'), { required: false }); if (!ph.ok) errs.phone = isEn() ? 'Please check the phone number' : ph.message; }
    if (!$('#ppConsent').checked) errs.consent = L('개인정보 수집·이용에 동의해 주세요', 'Please agree to the collection and use of your information');
    if (show) ['company', 'name', 'email', 'phone', 'consent'].forEach(function (f) { setErr(f, errs[f]); });
    return errs;
  }
  function stage() {
    if (!A.st.industry) return 1;
    if (!A.st.problems.length && !(A.quick && FINDER.con[A.QF.con])) return 2;
    return Object.keys(validate(false)).length ? 4 : 5;
  }
  function ensureAssistPanel() {
    var side = $('#ppSide'), event = $('#ppAssistEvent');
    if (!side) return;
    if (!event) {
      event = d.createElement('div');
      event.id = 'ppAssistEvent';
      event.className = 'mkp-assist-event';
      event.innerHTML = '<img src="/assets/proposal/banner2.png" alt="맞춤형 공장 설비 진단 이벤트 — 진동 센서 솔루션 1개월 무료 체험권 증정">';
      side.insertBefore(event, side.firstChild);
    }
    event.hidden = false;
    side.classList.remove('is-choice');
  }
  function ensureRegionPanel() {
    var side = $('#ppSide'), panel = $('#ppRegionPanel'), data = w.MK_REGIONS || {};
    if (!side) return null;
    if (!panel) {
      panel = d.createElement('section');
      panel.id = 'ppRegionPanel';
      panel.className = 'mkp-region-panel';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', 'ppRegionTitle');
      panel.innerHTML = '<button type="button" class="mkp-region-close" aria-label="지역 선택창 닫기">&times;</button>' +
        '<p class="mkp-region-eyebrow">지역 찾기</p><h3 id="ppRegionTitle">현장 지역을 알려주세요</h3>' +
        '<p class="mkp-region-desc">검색하거나 시·도와 시·군·구를 차례로 선택해 주세요.</p>' +
        '<div class="mkp-region-tabs" role="tablist"><button type="button" class="on" data-region-mode="search">검색으로 찾기</button><button type="button" data-region-mode="classify">시·도 분류로 찾기</button></div>' +
        '<div class="mkp-region-search" data-region-view="search"><label><span aria-hidden="true">⌕</span><input id="ppRegionSearch" autocomplete="off" placeholder="지역명"></label><div class="mkp-region-results" id="ppRegionResults"></div></div>' +
        '<div class="mkp-region-classify" data-region-view="classify" hidden><h4>시·도</h4><div class="mkp-region-chips" id="ppProvinceList"></div><div class="mkp-district-section" id="ppDistrictSection" hidden><h4>시·군·구</h4><div class="mkp-region-chips" id="ppDistrictList"></div></div></div>';
      side.appendChild(panel);
      $('#ppProvinceList').innerHTML = Object.keys(data).map(function (p) { return '<button type="button" data-province="' + esc(p) + '">' + esc(p) + '</button>'; }).join('');
      panel.addEventListener('click', function (e) {
        if (e.target.closest('.mkp-region-close')) return closeRegionPanel();
        var tab = e.target.closest('[data-region-mode]');
        if (tab) return setRegionMode(tab.dataset.regionMode);
        var district = e.target.closest('[data-district]');
        if (district) return chooseRegion(district.dataset.province, district.dataset.district);
        var province = e.target.closest('[data-province]');
        if (province) return chooseProvince(province.dataset.province);
      });
      $('#ppRegionSearch').addEventListener('input', renderRegionSearch);
    }
    return panel;
  }
  function openRegionPanel() {
    var panel = ensureRegionPanel(), side = $('#ppSide');
    if (!panel || !side) return;
    var event = $('#ppAssistEvent'); if (event) event.hidden = false;
    panel.hidden = false; side.classList.add('is-region');
    setRegionMode('search');
    setTimeout(function () { try { $('#ppRegionSearch').focus(); } catch (e) {} }, 40);
  }
  function closeRegionPanel() {
    var panel = $('#ppRegionPanel'), side = $('#ppSide');
    if (panel) panel.hidden = true;
    if (side) side.classList.remove('is-region');
  }
  function openOptionPanel(type) {
    var side = $('#ppSide'), event = $('#ppAssistEvent'), old = $('#ppOptionPanel');
    if (!side) return;
    if (old) old.remove();
    if (event) event.hidden = false;
    var isScale = type === 'scale', select = $(isScale ? '#ppScale' : '#ppTimeline');
    var panel = d.createElement('section');
    panel.id = 'ppOptionPanel'; panel.className = 'mkp-option-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = '<button type="button" class="mkp-option-close" aria-label="선택창 닫기">&times;</button>' +
      '<h3>' + (isScale ? '감시 규모' : '도입 검토 시점') + '</h3><div class="mkp-option-list">' +
      [].map.call(select.options, function (o) {
        return '<button type="button" data-option-value="' + esc(o.value) + '"' + (o.value === select.value ? ' class="on"' : '') + '><span>' + esc(o.textContent) + '</span>' + (o.value === select.value ? '<b>✓</b>' : '') + '</button>';
      }).join('') + '</div>';
    side.appendChild(panel); side.classList.add('is-option');
    panel.addEventListener('click', function (e) {
      if (e.target.closest('.mkp-option-close')) return closeOptionPanel();
      var choice = e.target.closest('[data-option-value]'); if (!choice) return;
      select.value = choice.dataset.optionValue;
      select.dispatchEvent(new Event('change', { bubbles:true }));
      $(isScale ? '#ppScaleTrigger' : '#ppTimelineTrigger').textContent = choice.textContent.replace('✓','').trim();
      closeOptionPanel();
    });
  }
  function closeOptionPanel() {
    var panel = $('#ppOptionPanel'), side = $('#ppSide');
    if (panel) panel.remove();
    if (side) side.classList.remove('is-option');
  }
  function setRegionMode(mode) {
    var panel = $('#ppRegionPanel'); if (!panel) return;
    $$('[data-region-mode]', panel).forEach(function (b) { b.classList.toggle('on', b.dataset.regionMode === mode); });
    $$('[data-region-view]', panel).forEach(function (v) { v.hidden = v.dataset.regionView !== mode; });
    if (mode === 'classify') {
      $$('#ppProvinceList button').forEach(function (b) { b.hidden = false; b.classList.remove('on'); });
      $('#ppDistrictList').innerHTML = '';
      $('#ppDistrictSection').hidden = true;
    }
    if (mode === 'search') setTimeout(function () { try { $('#ppRegionSearch').focus(); } catch (e) {} }, 20);
  }
  function renderRegionSearch() {
    var q = val('ppRegionSearch').replace(/\s+/g, '').toLowerCase(), data = w.MK_REGIONS || {}, out = [];
    if (q) Object.keys(data).forEach(function (p) { data[p].forEach(function (x) { if ((p + x).replace(/\s+/g, '').toLowerCase().indexOf(q) >= 0) out.push([p, x]); }); });
    $('#ppRegionResults').innerHTML = q ? (out.slice(0, 80).map(function (x) { return '<button type="button" data-province="' + esc(x[0]) + '" data-district="' + esc(x[1]) + '"><b>' + esc(x[1]) + '</b><small>' + esc(x[0]) + '</small></button>'; }).join('') || '<p>검색 결과가 없습니다.</p>') : '';
  }
  function chooseProvince(name) {
    var data = w.MK_REGIONS || {}, section = $('#ppDistrictSection');
    $$('#ppProvinceList button').forEach(function (b) {
      var chosen = b.dataset.province === name;
      b.classList.toggle('on', chosen);
      b.hidden = !chosen;
    });
    $('#ppDistrictList').innerHTML = (data[name] || []).map(function (x) { return '<button type="button" data-province="' + esc(name) + '" data-district="' + esc(x) + '">' + esc(x) + '</button>'; }).join('');
    section.hidden = false;
    setTimeout(function () { var panel = $('#ppRegionPanel'); if (panel) panel.scrollTo({ top: section.offsetTop - 24, behavior: 'smooth' }); }, 30);
  }
  function chooseRegion(province, district) {
    $('#ppRegion').value = province + ' ' + district;
    $('#ppRegion').dispatchEvent(new Event('input', { bubbles: true }));
    closeRegionPanel();
  }
  function onBack() {
    closeRegionPanel();
    closeOptionPanel();
    if (A.quick && A.detailsOpen && A.goalsOpen) {
      A.goalsOpen = false;
      $('#ppRoot').classList.remove('is-goals-open');
      $('#ppS3').hidden = true;
      openAssistChoices();
      updateCta();
      setTimeout(function () { $('#ppS1').scrollIntoView({ behavior:'smooth', block:'start' }); }, 40);
      return;
    }
    if (A.quick && A.detailsOpen) {
      A.detailsOpen = false;
      $('#ppRoot').classList.remove('is-details-open');
      restoreAssistChoices();
      $('#ppS1').hidden = true; $('#ppS2').hidden = true; $('#ppS4').hidden = false;
      ensureAssistPanel(); updateCta();
      setTimeout(function () { $('#ppS4').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
      return;
    }
    w.history.back();
  }
  function openAssistChoices() {
    var side = $('#ppSide'), event = $('#ppAssistEvent'), step = $('#ppS2'), industry = $('#ppS1'), recipient = $('#ppS4'), live = $('#ppLive'), quick = $('.mkp-quick'), grid = $('.mkp-grid'), scope = step.querySelector('.mkp-scope-note');
    if (!side || !step || !industry || !recipient) return;
    recipient.hidden = true;
    industry.hidden = false;
    industry.classList.add('mkp-reveal');
    if (event) event.hidden = false;
    side.classList.add('is-choice');
    side.insertBefore(step, live);
    if (live && quick && live.parentNode !== quick) quick.appendChild(live);
    if (quick && grid && grid.parentNode) grid.parentNode.insertBefore(quick, grid.nextSibling);
    if (scope && quick && quick.parentNode) {
      scope.classList.add('is-promoted');
      quick.parentNode.insertBefore(scope, quick.nextSibling);
    }
    if (!step.querySelector('.mkp-choice-close')) {
      var close = d.createElement('button');
      close.type = 'button';
      close.className = 'mkp-choice-close';
      close.setAttribute('aria-label', '선택창 닫기');
      close.innerHTML = '&times;';
      close.addEventListener('click', function () { step.hidden = true; });
      step.insertBefore(close, step.firstChild);
    }
    step.hidden = false;
    step.classList.add('mkp-reveal');
  }
  function restoreAssistChoices() {
    var main = $('.mkp-main'), step = $('#ppS2'), s3 = $('#ppS3'), side = $('#ppSide'), live = $('#ppLive'), quick = $('.mkp-quick'), grid = $('.mkp-grid'), scope = $('.mkp-scope-note.is-promoted');
    if (main && step && step.parentNode === side) main.insertBefore(step, s3 || $('#ppS4'));
    if (step && scope) { scope.classList.remove('is-promoted'); step.appendChild(scope); }
    if (side && live && live.parentNode !== side) side.appendChild(live);
    if (quick && grid && grid.parentNode && quick.parentNode === grid.parentNode) grid.parentNode.insertBefore(quick, grid);
    if (side) side.classList.remove('is-choice');
  }
  function updateCta() {
    if (A.st.sending) return;
    if (A.quick && !A.detailsOpen && w.matchMedia && w.matchMedia('(min-width: 901px)').matches) {
      $('#ppCta').textContent = L('맞춤 제안서 제작하기', 'Create custom proposal');
      return;
    }
    if (A.quick && A.detailsOpen) {
      $('#ppCta').textContent = A.goalsOpen
        ? L('선택한 옵션으로 제안서 제작하기', 'Create proposal with selected options')
        : L('다음', 'Next');
      return;
    }
    var s = stage();
    $('#ppCta').textContent = s === 1 ? L('현장을 골라 주세요', 'Choose a facility') : s === 2 ? L('가장 고민되는 문제 고르기', 'Pick your top concern') : s === 4 ? L('맞춤 제안서 제작하기', 'Create custom proposal') : L('선택 완료하고 제안서 받기', 'Complete choices');
  }
  function onCta() {
    if (A.quick && !A.detailsOpen && w.matchMedia && w.matchMedia('(min-width: 901px)').matches) {
      var introErr = validate(true), introFirst = Object.keys(introErr)[0];
      if (introFirst) {
        var introEl = introFirst === 'consent' ? $('#ppConsent') : $('#pp' + introFirst.charAt(0).toUpperCase() + introFirst.slice(1));
        if (introEl) { introEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { try { introEl.focus({ preventScroll: true }); } catch (x) {} }, 350); }
        return;
      }
      A.detailsOpen = true;
      $('#ppRoot').classList.add('is-details-open');
      openAssistChoices();
      updateCta();
      push('proposal_details_open', { proposal_entry: 'finder' });
      setTimeout(function () { $('#ppS1').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
      return;
    }
    if (A.quick && A.detailsOpen && !A.goalsOpen && w.matchMedia && w.matchMedia('(min-width: 901px)').matches) {
      if (!A.st.industry) return $('#ppS1').scrollIntoView({ behavior:'smooth', block:'start' });
      if (!A.st.problems.length) { $('#ppErrProblems').hidden = false; return $('#ppPlist').scrollIntoView({ behavior:'smooth', block:'center' }); }
      A.goalsOpen = true;
      $('#ppRoot').classList.add('is-goals-open');
      restoreAssistChoices();
      $('#ppS1').hidden = true; $('#ppS2').hidden = true; $('#ppS3').hidden = false;
      ensureAssistPanel(); updateCta();
      setTimeout(function () { $('#ppS3').scrollIntoView({ behavior:'smooth', block:'start' }); }, 50);
      return;
    }
    var s = stage();
    if (s === 1) return $('#ppS1').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (s === 2) { $('#ppErrProblems').hidden = false; return $('#ppPlist').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (s === 4) {
      var e = validate(true), first = Object.keys(e)[0];
      var el = first === 'consent' ? $('#ppConsent') : $('#pp' + first.charAt(0).toUpperCase() + first.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (x) {} }, 350); }
      return;
    }
    if (A.quick && A.detailsOpen && A.goalsOpen && w.matchMedia && w.matchMedia('(min-width: 901px)').matches) {
      if (!$('#ppFactoryConsult').checked) return openEventPrompt();
      return continueProposal();
    }
    if (!$('#ppFactoryConsult').checked) return openEventPrompt();
    continueProposal();
  }

  function openEventPrompt() {
    var modal = $('#ppEventModal');
    if (!modal) return continueProposal();
    modal.hidden = false;
    d.body.classList.add('mkp-event-open');
    setTimeout(function () { try { $('#ppEventApply').focus(); } catch (e) {} }, 20);
  }
  function closeEventPrompt() {
    var modal = $('#ppEventModal');
    if (modal) modal.hidden = true;
    d.body.classList.remove('mkp-event-open');
  }
  function continueProposal() {
    if (A.quick && A.detailsOpen && A.goalsOpen && w.matchMedia && w.matchMedia('(min-width: 901px)').matches) return startAnalysis();
    submit();
  }

  function startAnalysis(previewOnly) {
    if (A.analyzing || A.st.sending) return;
    A.analyzing = true;
    var root = $('#ppRoot');
    var panel = $('#ppAnalysis');
    if (!panel) {
      panel = d.createElement('section');
      panel.id = 'ppAnalysis';
      panel.className = 'mkp-analysis-screen';
      panel.setAttribute('aria-live', 'polite');
      panel.innerHTML = '<div class="mkp-analysis-main">' +
        '<div class="mkp-analysis-orb" aria-hidden="true"><img src="/assets/moni/moni.png" alt=""></div>' +
        '<div class="mkp-analysis-copy">' +
          '<p>' + L('글로벌 레퍼런스 수집 중', 'Collecting global references') + '</p>' +
          '<p>' + L('실제 현장 제안서 분석 중', 'Analyzing real-site proposals') + '</p>' +
          '<p>' + L('맞춤형 인사이트 도출 중', 'Building tailored insights') + '</p>' +
        '</div></div>' +
        '<aside class="mkp-analysis-banner"><img src="/assets/proposal/banner2.png" alt="맞춤형 공장 설비 진단 이벤트"></aside>';
      root.insertBefore(panel, $('.mkp-bar', root));
    }
    root.classList.add('is-analyzing');
    panel.hidden = false;
    var lines = $$('.mkp-analysis-copy p', panel), idx = 0;
    function paint() {
      lines.forEach(function (line, i) {
        line.classList.toggle('is-active', i === idx);
        line.classList.toggle('is-done', i < idx);
      });
    }
    paint();
    clearInterval(A.analysisTimer);
    clearTimeout(A.analysisSubmitTimer);
    A.analysisTimer = setInterval(function () { idx = (idx + 1) % lines.length; paint(); }, 1150);
    if (previewOnly) {
      push('proposal_analysis_preview');
      w.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    A.analysisSubmitTimer = setTimeout(function () { submit(); }, 3450);
    push('proposal_analysis_start');
    w.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stopAnalysis() {
    clearInterval(A.analysisTimer); clearTimeout(A.analysisSubmitTimer);
    A.analysisTimer = null; A.analysisSubmitTimer = null; A.analyzing = false;
    var root = $('#ppRoot'), panel = $('#ppAnalysis');
    if (root) root.classList.remove('is-analyzing');
    if (panel) panel.hidden = true;
  }

  function payload() {
    var src = w.MonnitLead ? w.MonnitLead.source() : '';
    var p = {
      company: val('ppCompany'), facility: val('ppFacility'), name: val('ppName'), title: val('ppTitle'),
      email: val('ppEmail'), phone: val('ppPhone'), region: val('ppRegion'), memo: val('ppMemo'),
      industry: A.st.industry, problems: A.st.problems.slice(), goals: A.st.goals.slice(),
      scale: $('#ppScale').value, timeline: $('#ppTimeline').value,
      factoryConsult: $('#ppFactoryConsult').checked,
      consent: $('#ppConsent').checked, consentMkt: $('#ppConsentMkt').checked,
      website: $('#ppWebsite').value, elapsed: Date.now() - A.T0, caseViews: A.st.caseViews,
      source: src, landing: String(w.location.href).split('#')[0], referrer: d.referrer || ''
    };
    if (A.quick) {
      /* 빠른 신청 — 고객이 조건을 손대지 않았으면 산업·과제는 서버가 파인더 값 + 회사 인식으로 정한다 */
      p.entry = A.QF.from === 'widget' ? 'widget' : 'finder';
      p.auto = true; p.fac = A.QF.fac; p.con = A.QF.con;
      if (!p.scale) p.scale = FINDER.scale[A.QF.scale] || '';
      if (!A.st.edited) { p.industry = ''; p.problems = []; p.goals = []; }
    }
    return p;
  }

  /* 사이트 공통 리드 원장에도 한 줄 — 알림 메일은 제안서 서버가 이미 보냈으므로 notified 로 중복을 막는다 */
  function ledger(p, grade, page) {
    try {
      if (!w.MonnitLead) return;
      var I = ind(p.industry) || {};
      w.MonnitLead.build('contact', page || 'custom_proposal', '맞춤 제안서 신청 — ' + p.company, {
        '회사명': p.company, '담당자명': (p.name + ' ' + (p.title || '')).trim(), '전화번호': p.phone, '이메일': p.email,
        '관심분야': '맞춤 제안서', '산업군': I.label || p.industry || p.industryText || '', '사업장 지역': p.region || '',
        '문의 사항': '[' + (grade || '-') + '] ' + (p.facility ? p.facility + ' · ' : '') + (p.problems || []).map(function (k) { return (KB.problems[k] || {}).label; }).join(', ') + (p.memo ? ' / ' + p.memo : ''),
        '마케팅 정보 수신(선택)': p.consentMkt ? '동의' : '미동의'
      });
      w.MonnitLead.setNotified(true);
      w.MonnitLead.track('contact', { page: page || 'custom_proposal', interest: I.label || '맞춤 제안서' });
    } catch (e) {}
  }

  function post(p) {
    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch('/api/proposal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().then(function (x) { return { s: r.status, x: x || {} }; }, function () { return { s: r.status, x: {} }; }); })
      .then(function (res) { clearTimeout(timer); return res; }, function (e) { clearTimeout(timer); throw e; });
  }

  function submit() {
    if (A.st.sending) return;
    var p = payload();
    A.st.sending = true;
    var cta = $('#ppCta');
    cta.disabled = true; cta.classList.add('is-loading'); cta.innerHTML = '<span class="mkp-spin" aria-hidden="true"></span> ' + L('접수하는 중…', 'Submitting…');
    showMsg('');
    push('proposal_submit_click');
    if (A.demo) {
      var q = new URLSearchParams({ demo: '1', co: p.company, nm: p.name, ti: p.title, ind: A.st.industry, pr: A.st.problems.join(','), gl: A.st.goals.join(',') });
      A.st.sending = false; cta.disabled = false; updateCta();
      return go('proposal/status', '?' + q.toString());
    }
    post(p).then(function (res) {
      var x = res.x;
      if (!x.ok && isLocalPreview()) return goLocalPreview(p);
      if (res.s === 400 && x.fields) {
        Object.keys(x.fields).forEach(function (f) { setErr(f, x.fields[f]); });
        if (x.fields.problems) $('#ppErrProblems').hidden = false;
        return fail(L('입력 내용을 확인해 주세요.', 'Please check the highlighted fields.'));
      }
      if (!x.ok) return fail(isEn() ? 'We could not submit your request. Please try again shortly or call +82-2-2088-1454.' : (x.message || '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      clearDraft();
      push('proposal_submit', { lead_type: 'custom_proposal', proposal_grade: x.grade || '', proposal_mode: x.mode || '', proposal_entry: p.entry || 'proposal' });
      try { if (w.fbq) w.fbq('track', 'Lead', { content_name: 'custom_proposal', content_category: p.industry || A.QF.fac }); } catch (e) {}
      if (!x.silent) ledger(p, x.grade);
      A.st.sending = false; cta.disabled = false; cta.classList.remove('is-loading'); updateCta();
      if (x.token || x.dup) return goStatus(x);
      done(p, x);
    }).catch(function () {
      if (isLocalPreview()) return goLocalPreview(p);
      ledger(p, 'NET');
      fail(L('연결이 불안정해 접수를 확인하지 못했습니다. 입력하신 내용은 담당자에게 전달했으며, 확인이 필요하시면 ' + TEL + ' 로 연락 주세요.', 'The connection was unstable and we could not confirm your request. Your details were passed to our team — call +82-2-2088-1454 if you need to confirm.'));
    });
  }

  function isLocalPreview() {
    return /^(localhost|127\.0\.0\.1)$/i.test(w.location.hostname);
  }

  /* Vite/정적 미리보기에는 서버리스 /api/proposal 이 없다. 이때만 실제
     진행 화면의 데모 데이터로 연결하고, 운영 도메인에서는 반드시 API
     접수 결과의 토큰으로 이동한다. */
  function goLocalPreview(p) {
    A.st.sending = false;
    var q = new URLSearchParams({
      demo: '1', co: p.company, nm: p.name, ti: p.title,
      ind: A.st.industry, pr: A.st.problems.join(','), gl: A.st.goals.join(',')
    });
    go('proposal/status', '?' + q.toString());
  }
  function fail(msg) {
    stopAnalysis();
    A.st.sending = false; $('#ppCta').disabled = false; $('#ppCta').classList.remove('is-loading'); updateCta();
    showMsg(msg);
    $('#ppMsg').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function showMsg(m) { var el = $('#ppMsg'); el.hidden = !m; el.textContent = m; }
  function done(p, x) {
    /* 토큰 없이 끝난 경우(저장소 장애·봇 판정) — 담당자가 직접 보내드린다 */
    stopAnalysis();
    $('#ppS4').innerHTML = '<div class="mkp-done"><span class="nh-eyebrow">' + L('접수 완료', 'Request received') + '</span><h3>' + L(esc(p.company) + ' ' + esc(p.name) + '님, 신청이 접수되었습니다', 'Thank you, ' + esc(p.name) + ' — your request is in') + '</h3>' +
      '<p>' + L('담당 엔지니어가 맞춤 제안서를 정리해 ' + esc(p.email) + ' 으로 접수 순서대로 보내드립니다. 급하시면 ' + TEL + ' 로 연락 주세요.', 'An engineer will prepare your proposal and email it to ' + esc(p.email) + ' in the order received. For urgent needs, call +82-2-2088-1454.') + '</p></div>';
  }

  function goStatus(x) {
    /* 같은 회사·이메일 재신청 — 서버는 진행 화면 주소를 주지 않고 신청자 메일로만 보낸다 */
    if (!x.token) {
      ss.set('mk_prop_lim', JSON.stringify({ asked: x.asked || '', same: !!x.same, days: x.days || 30, limit: !!x.limit }));
      return go('proposal/status', '?lim=1');
    }
    ss.set('mk_prop_t', x.token);
    ss.set('mk_prop_new', x.token);
    ss.del('mk_prop_pill_off');
    var q = '';
    if (!ss.get('mk_prop_t')) q = '?t=' + encodeURIComponent(x.token);   /* 저장소를 못 쓰는 환경 */
    go('proposal/status', q);
  }

  /* 상담 폼(#view-contact)의 「맞춤 제안서도 받기」 — app.js contactSubmit 이 부른다 */
  function fromContact(b, btn) {
    var p = {
      entry: 'contact', auto: true, company: b.company, name: b.name, email: b.email, phone: b.phone,
      industryText: b.industryText, inquiry: b.inquiry, memo: b.memo, facility: b.facility, concerns: b.concerns || [],
      consent: true, consentMkt: false, elapsed: Date.now() - A.T0,
      source: w.MonnitLead ? w.MonnitLead.source() : '', landing: String(w.location.href).split('#')[0], referrer: d.referrer || ''
    };
    var prev = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = L('맞춤 제안서 접수 중…', 'Submitting your proposal request…'); }
    var restore = function () { if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = prev; } };
    return post(p).then(function (res) {
      restore();
      var x = res.x;
      if (x.ok && (x.token || x.dup)) { push('proposal_submit', { lead_type: 'custom_proposal', proposal_mode: x.mode || '', proposal_entry: 'contact', proposal_dup: x.dup ? 1 : 0 }); return x; }
      if (res.s === 400 && x.fields) w.alert(Object.keys(x.fields).map(function (k) { return x.fields[k]; }).join('\n'));
      return { ok: false };
    }, function () { restore(); return { ok: false }; });
  }

  /* 임시 저장 (새로고침 대비, 이 탭에만) */
  var F = ['ppCompany', 'ppFacility', 'ppName', 'ppTitle', 'ppEmail', 'ppPhone', 'ppRegion', 'ppMemo'];
  function saveDraft() {
    var o = { industry: A.st.industry, problems: A.st.problems, goals: A.st.goals, scale: $('#ppScale').value, timeline: $('#ppTimeline').value, factoryConsult: $('#ppFactoryConsult').checked, quick: A.quick, edited: A.st.edited };
    F.forEach(function (f) { o[f] = val(f); });
    ss.set(DRAFT, JSON.stringify(o));
  }
  function clearDraft() { ss.del(DRAFT); }
  function readDraft() { try { return JSON.parse(ss.get(DRAFT) || 'null'); } catch (e) { return null; } }

  function resetApply() {
    A.st.industry = ''; A.st.problems = []; A.st.goals = []; A.st.edited = false; A.st.detect = null;
    $$('.mkp-ind').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    ['#ppS2', '#ppS3', '#ppS4'].forEach(function (s) { $(s).hidden = true; });
    $('#ppS1').hidden = false; $('#ppDetect').hidden = true;
    $('#ppLmPct').textContent = '–'; $('#ppLmBar').style.width = '0%';
    $('#ppLmText').textContent = L('산업을 고르면 가장 닮은 Monnit 레퍼런스를 찾아 드립니다', 'Choose an industry to find the closest Monnit reference');
    $('#ppTopCase').innerHTML = ''; $('#ppPeek').innerHTML = '';
  }

  function enterApply() {
    initApply();
    var search = w.location.search;
    var Q = new URLSearchParams(search);
    var sig = ['from', 'fac', 'con', 'scale', 'industry', 'problems', 'goals', 'demo'].map(function (k) { return Q.get(k) || ''; }).join('|');
    ss.del('mk_prop_back');
    if (sig === A.sig && A.lang === isEn()) { updateCta(); return; }        /* 같은 조건으로 다시 들어옴 — 입력하던 상태 유지 */
    if (sig === A.sig) { A.lang = isEn(); relabelApply(); if (A.st.industry) renderIndustry(); detectCompany(); updateCta(); preview(); return; }
    A.lang = isEn();
    A.sig = sig; A.Q = Q; A.T0 = Date.now();
    A.demo = Q.get('demo') === '1';
    A.QF = { from: Q.get('from') || '', fac: Q.get('fac') || '', con: Q.get('con') || '', scale: Q.get('scale') || '' };
    /* 2026-10-07 자동 선택 없음 — 파인더·광고 주소·이전 입력값으로 산업·과제·규모를 미리 고르지 않는다.
       고객이 직접 산업을 고른 뒤에만 세부 과제가 열리고, 과제도 직접 눌러야 선택된다. (A.QF 는 유입 기록용으로만 유지) */
    A.quick = false;
    A.detailsOpen = false;
    resetApply();
    var root = $('#ppRoot');
    root.classList.toggle('is-quick', A.quick);
    root.classList.toggle('is-recipient-first', A.quick);
    root.classList.remove('is-details-open');
    restoreAssistChoices();
    $('#ppHero').hidden = A.quick;
    $('#ppQuick').hidden = !A.quick;
    $('#ppQEdit').hidden = false;

    var o = readDraft();
    if (o) F.forEach(function (f) { if (o[f] && $('#' + f) && !$('#' + f).value) $('#' + f).value = o[f]; });
    if (o && o.factoryConsult) $('#ppFactoryConsult').checked = true;

    if (A.quick) {
      ensureAssistPanel();
      var fac = FINDER.fac[A.QF.fac], c = FINDER.con[A.QF.con] || { problems: [], goals: [] }, I = ind(fac);
      /* 조건 칩 — 주소의 fl·cl(파인더 표시 글자)은 화면에 그대로 쓰지 않는다(길이 제한 · 한국어 화면에서만) */
      var clip = function (v) { return String(v || '').slice(0, 40); };
      var facLab = (!isEn() && clip(Q.get('fl'))) || indL(I), conLab = (!isEn() && clip(Q.get('cl'))) || (c.problems[0] ? probL(c.problems[0]) : '');
      $('#ppQChips').innerHTML = [facLab, conLab, FINDER.scale[A.QF.scale] ? optL('scales', FINDER.scale[A.QF.scale]) : ''].filter(Boolean).map(function (x) { return '<span class="mkp-chip is-static" aria-pressed="true">' + esc(x) + '</span>'; }).join('');
      $('#ppS1').hidden = true;
      A.st.goals = c.goals.slice(0, 3);
      pickIndustry(fac, false);
      var inList = c.problems.filter(function (k) { return I && I.problems.indexOf(k) >= 0; });
      A.st.problems = inList.slice(0, 1);
      renderIndustry();
      $('#ppS3').hidden = true;
      if (w.matchMedia && w.matchMedia('(min-width: 901px)').matches) $('#ppS2').hidden = true;
      var quickNo = $('#ppS4 .mkp-no'); if (quickNo) quickNo.textContent = '01';
      if (FINDER.scale[A.QF.scale]) $('#ppScale').value = FINDER.scale[A.QF.scale];
      push('proposal_quick_view', { proposal_fac: A.QF.fac, proposal_con: A.QF.con });
      if (val('ppCompany')) detectCompany();
    } else {
      var assistEvent = $('#ppAssistEvent'); if (assistEvent) assistEvent.hidden = true;
      var regularNo = $('#ppS4 .mkp-no'); if (regularNo) regularNo.textContent = '04';
      var src = null;   /* 2026-10-07 — 주소(industry·problems)·임시저장 값으로 옵션을 미리 고르지 않음 */
      if (src && ind(src.industry)) {
        A.st.goals = (src.goals || []).filter(function (g) { return KB.goals[g]; }).slice(0, 4);
        pickIndustry(src.industry, !!qi);
        A.st.problems = (src.problems || []).filter(function (k) { return ind(src.industry).problems.indexOf(k) >= 0; }).slice(0, 1);
        A.st.edited = true;
        renderIndustry();
        if (o && !qi) { if (o.scale) $('#ppScale').value = o.scale; if (o.timeline) $('#ppTimeline').value = o.timeline; }
      }
    }
    updateCta(); preview();
    if (Q.get('preview') === 'analysis') setTimeout(function () { startAnalysis(true); }, 0);
    push('proposal_view', { proposal_quick: A.quick ? 1 : 0 });
  }

  /* ═══════════════════════════════════════════════════════════════
     진행 현황 화면
     ═══════════════════════════════════════════════════════════════ */
  var S = { token: '', demo: false, first: false, last: null, offset: 0, rendered: false, fails: 0, poll: null, tickT: null, liveT: null, sentSeen: false, gen: 0 };
  var ICON = {
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>'
  };
  var NICON = { receipt: 'mail', staff: 'user', analysis: 'chart', preview: 'check', sent: 'send', callback: 'phone', link: 'mail' };
  function shortLabels(instant) {
    return isEn() ? ['Received', 'Analysis', 'Data', 'Insight', 'Writing', instant ? 'QA' : 'Review', 'Sent']
      : ['접수', '분석', '취합', '알고리즘', '작성', instant ? '점검' : '검수', '발송'];
  }

  function stopStatus() { clearTimeout(S.poll); clearInterval(S.tickT); clearInterval(S.liveT); S.poll = S.tickT = S.liveT = null; }

  function enterStatus() {
    stopStatus();
    ss.del('mk_prop_back');
    var Q = new URLSearchParams(w.location.search);
    S.demo = Q.get('demo') === '1';
    S.token = Q.get('t') || ss.get('mk_prop_t') || '';
    if (Q.get('t')) ss.set('mk_prop_t', Q.get('t'));
    S.first = S.demo || (!!S.token && ss.get('mk_prop_new') === S.token);
    if (S.first && !S.demo) ss.del('mk_prop_new');
    S.lim = null;
    if (Q.get('lim') === '1') { try { S.lim = JSON.parse(ss.get('mk_prop_lim') || 'null'); } catch (e) { S.lim = null; } if (!S.lim) S.lim = { asked: '', days: 30, limit: true }; }
    S.rendered = false; S.last = null; S.fails = 0; S.sentSeen = false; S.gen++;
    S.demoT0 = S.demoT0 || Date.now();
    if (!S.demo) S.demoT0 = Date.now();
    S.lang = isEn();
    /* 재신청 안내 — 진행 화면 주소는 신청자 메일로만 보낸다 */
    if (S.lim) return limitOnly(S.lim);
    $('#ppsApp').innerHTML = '<div class="mkp-skel" style="height:34px;width:60%"></div><div class="mkp-skel" style="height:34px;width:40%;margin-top:10px"></div><div class="mkp-skel" style="height:260px;margin-top:30px"></div>';
    load();
    S.tickT = setInterval(tick, 1000);
  }

  function schedule() {
    clearTimeout(S.poll);
    var p = S.last && S.last.progress;
    /* 즉시 방식은 몇 분 안에 끝나므로 3초마다, 그 밖에는 1분마다 */
    var fast = p && !p.sent && p.mode === 'instant' && p.remainMs < 15 * 60000;
    S.poll = setTimeout(function () {
      if (!active('view-proposal-status')) return stopStatus();
      if (!d.hidden) load(); else schedule();
    }, fast ? 3000 : 60000);
  }

  function load() {
    var gen = S.gen;
    if (S.demo) { render(demoData(), true); return schedule(); }
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(S.token)) return notFound();
    fetch('/api/proposal/status?t=' + encodeURIComponent(S.token) + (isEn() ? '&lang=en' : ''), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (r.status === 404) { notFound(); return null; } if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (x) { if (gen !== S.gen || !x) return; S.fails = 0; render(x); schedule(); })
      .catch(function () {
        if (gen !== S.gen) return;
        S.fails++;
        if (!S.rendered) $('#ppsApp').innerHTML = '<div class="mkps-empty"><h3>' + L('연결이 잠시 불안정합니다', 'The connection is unstable') + '</h3><p>' + L('자동으로 다시 불러옵니다. 급하시면 ' + TEL + ' 로 연락 주세요.', 'We’ll retry automatically. For urgent needs, call +82-2-2088-1454.') + '</p></div>';
        clearTimeout(S.poll);
        S.poll = setTimeout(function () { if (active('view-proposal-status')) load(); }, Math.min(60000, 3000 * S.fails));
      });
  }

  function notFound() {
    stopStatus();
    $('#ppsApp').innerHTML = '<div class="mkps-empty"><span class="nh-eyebrow">' + L('링크를 확인해 주세요', 'Please check your link') + '</span>' +
      '<h2 class="seo-h1">' + L('진행 현황을 <em>찾을 수 없습니다</em>', 'We couldn’t <em>find this page</em>') + '</h2><p class="lead">' +
      L('링크가 잘못되었거나 보관 기간이 지났습니다. 메일에 있는 링크로 다시 열어 주시거나, 새로 신청해 주세요.', 'The link may be wrong or expired. Open it again from your email, or request a new proposal.') + '</p>' +
      '<div class="mkps-empty-acts"><button type="button" class="mkp-btn" data-pgo="proposal">' + L('맞춤 제안서 신청하기 →', 'Request a proposal →') + '</button>' +
      '<a class="mkp-btn is-ghost" href="/contact?quote=scope" data-quote="scope">' + L('견적 요청하기', 'Request a quote') + '</a></div></div>';
  }

  /* 같은 회사·이메일로 다시 신청한 경우 — 토큰 없이 안내만 */
  function limitOnly(Lm) {
    var sameCo = !!ss.get('mk_prop_t');
    $('#ppsApp').innerHTML = '<div class="mkps-top"><span class="nh-eyebrow">' + L('이미 신청하신 제안서가 있습니다', 'You already have a proposal') + '</span>' +
      '<h2 class="seo-h1 mkps-h">' + L('신청하신 메일로<br><em>진행 화면 링크를 다시 보내드렸습니다</em>', 'We’ve re-sent the<br><em>status link to your email</em>') + '</h2></div>' +
      limitBox(null, Lm) +
      (sameCo ? '<p class="mkps-small"><button type="button" class="mkp-link" id="ppsMine">' + L('이 브라우저에서 신청한 진행 화면 열기', 'Open the status page from this browser') + '</button></p>' : '') +
      '<p class="mkps-small">' + L('보안을 위해 진행 화면 주소는 신청하신 메일로만 보내드립니다. 메일이 보이지 않으면 스팸함을 확인하시거나 ' + TEL + ' 로 연락 주세요.', 'For security, status links are sent only to the email used for the request. Check your spam folder or call +82-2-2088-1454.') + '</p>';
    setBar(null, true);
    push('proposal_limit_view', { proposal_limit: Lm.limit ? 1 : 0 });
  }

  function setBar(v, quote) {
    var cta = $('#ppsCta'); if (!cta) return;
    if (quote) { cta.textContent = L('현장 전체 견적 요청 →', 'Request a full-site quote →'); cta.setAttribute('href', quoteHref(v)); cta.setAttribute('data-quote', '1'); }
    else { cta.textContent = L('기다리는 동안 현장 진단 예약 →', 'Book a site survey while you wait →'); cta.setAttribute('href', 'https://monnit.co.kr/contact'); cta.removeAttribute('data-quote'); }
  }

  function render(x, demo) {
    S.offset = Date.now() - x.now;
    var first = !S.rendered;
    var wasSent = S.last && S.last.progress.sent;
    S.last = x;
    var v = x.view, p = x.progress, I = v.industry;
    var en = isEn();
    var who = en ? esc(v.name) : esc(v.company) + ' ' + esc(v.name) + (v.title ? ' ' + esc(v.title) : '') + '님';
    var top = v.top || [], t1 = top[0], t2 = top[1];
    var instant = p.mode === 'instant';
    var brand = v.brand || BRAND;
    var verdict = v.confidence === 'high' ? L('입력하신 현장과 Monnit 레퍼런스가 잘 맞습니다', 'Your site closely matches Monnit references')
      : v.confidence === 'mid' ? L('비슷한 레퍼런스가 있어, 현장 조건을 더해 맞춥니다', 'Similar references found — tailored with your site details')
      : L('딱 맞는 레퍼런스가 적어 산업 플레이북 중심으로 구성합니다', 'Built mainly on the industry playbook');
    var tiles = (t1 ? t1.results : []).slice(0, 4);
    var picked = v.common.filter(function (c) { return c.picked; });
    var mailTo = (x.notices.filter(function (n) { return n.key === 'sent'; })[0] || {}).ch || '';
    var sc = v.scope || { problems: v.problems, others: [], openZones: [], lockedZones: [], openLevels: [], lockedLevels: [], also: [], quote: '/contact' };
    var eta = p.eta || (p.sent ? p.sentAt : p.due);
    var segName = v.segment || I.label;
    var miniStage = p.sent ? 3 : (p.pct > 1 ? 2 : 1);
    var assignedAt = (p.stages[0] || {}).atShort || (p.stages[0] || {}).at || '';

    var head = p.sent
      ? '<h2 class="seo-h1 mkps-h">' + L(who + '의 맞춤 제안서를<br><em>메일로 보내드렸습니다</em>', who + ', your custom proposal<br><em>has been emailed</em>') + '</h2>'
      : '<h2 class="seo-h1 mkps-h">' + L('<span class="mkps-title-person">' + who + '만을 위한 제안서를</span><em>Monnit 글로벌 데이터로</em><span class="mkps-title-last">준비하고 있습니다</span>', 'We’re preparing a proposal for ' + (who ? who + ',' : 'you,') + '<br><em>built on Monnit’s global data</em>') + '</h2>';

    var html =
    '<div class="mkps-top">' +
      head +
      (v.recognized ? '<p class="mkps-rec">' + esc(v.recognized) + (v.ownCase && (!en || v.ownCase.name) ? ' · <b>' + L('모넷 도입 고객 확장 제안', 'Expansion proposal for an existing Monnit customer') + '</b>' : '') + '</p>' : '') +
      (en ? '<p class="mkps-rec is-note">The proposal PDF and emails are written in Korean. For an English proposal, <a href="' + esc(quoteHref(v)) + '" data-quote="1">contact our team</a>.</p>' : '') +
    '</div>' +

    '<aside class="mkps-sticky-progress" aria-label="' + L('제안서 진행 상태', 'Proposal progress') + '">' +
      '<h3>' + L('알림 발송 과정', 'Delivery progress') + '</h3>' +
      '<div class="mkps-mini-steps stage-' + miniStage + '">' +
        '<i class="mkps-mini-line"><em></em></i>' +
        '<div class="done"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span><b>' + L('담당자<br>배정', 'Engineer<br>assigned') + '</b><small>' + (assignedAt ? esc(assignedAt) + ' ' + L('완료', 'done') : L('완료', 'Done')) + '</small></div>' +
        '<div class="' + (miniStage === 2 ? 'now' : miniStage > 2 ? 'done' : '') + '"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15v-4M12 17V7M18 15V9"/></svg></span><b>' + L('데이터<br>분석', 'Data<br>analysis') + '</b><small>' + (miniStage === 2 ? L('현재 진행중', 'In progress') : miniStage > 2 ? L('완료', 'Done') : L('대기', 'Pending')) + '</small></div>' +
        '<div class="' + (miniStage === 3 ? 'done' : '') + '"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2L20 4l-6.2 16-3.1-6.1-7.2-2.7zM10.7 13.9L20 4"/></svg></span><b>' + L('제안서<br>발송', 'Proposal<br>delivery') + '</b><small>' + (p.sent ? L('발송 완료', 'Sent') : L('순차 발송 예정', 'Scheduled')) + '</small></div>' +
      '</div>' +
      '<div class="mkps-mini-note"><strong>ⓘ</strong><p><b>' + (p.sent ? L('제안서 발송이 완료되었습니다.', 'Your proposal has been sent.') : L('현재 데이터를 분석 중이며,<br>완료 후 제안서가 순차 발송됩니다.', 'We are analyzing your data.<br>The proposal will be sent when complete.')) + '</b><small>' + L('필요 시 담당자가 별도로 연락드립니다.', 'Our team will contact you if needed.') + '</small></p></div>' +
    '</aside>' +
    (p.sent ? '<div class="mkps-mailbox mkps-mailbox-top">' + ICON.mail + '<div><b>' + L(esc(mailTo) + ' 으로 PDF를 보냈습니다', 'We sent the PDF to ' + esc(mailTo)) + '</b><small>' + L('메일이 보이지 않으면 스팸함을 확인해 주세요. 그래도 없으면 ' + TEL + ' 또는 korea@monnit.com 으로 알려 주시면 바로 다시 보내드립니다.', 'If you can’t find it, check your spam folder or let us know at korea@monnit.com / +82-2-2088-1454 and we’ll resend it.') + '</small></div></div>' : '') +

    '<section class="mkps-summary-card mkps-summary-contents">' +
      '<div class="mkps-summary-head"><div><h3>' + L('제안서에서 확인할 수 있는 내용', 'What your proposal includes') + '</h3><p>' + L('선택하신 현장과 과제를 기준으로 핵심 내용만 정리합니다.', 'Key findings based on your site and selected concern.') + '</p></div></div>' +
      '<div class="mkps-summary-grid">' +
        '<article><b>' + L('현장 문제 진단', 'Site diagnosis') + '</b><span>' + esc((picked[0] || {}).label || v.problems[0] || L('선택 과제 분석', 'Selected concern analysis')) + '</span></article>' +
        '<article><b>' + L('권장 센서', 'Recommended sensors') + '</b><span>' + esc(v.sensors.slice(0, 3).map(function (s2) { return s2.name; }).join(' · ') || L('현장 데이터 기반 구성', 'Configuration based on site data')) + '</span></article>' +
        '<article><b>' + L('유사 사례', 'Similar references') + '</b><span>' + esc(top.slice(0, 2).map(function (t) { return t.name; }).join(' · ') || L('글로벌 레퍼런스 대조', 'Global reference matching')) + '</span></article>' +
        '<article><b>' + L('알림·대응 및 운영 방향', 'Alerts and operations') + '</b><span>' + esc((v.playbook && v.playbook.automation || []).slice(0, 2).join(' · ') || L('알림과 대응 체계 제안', 'Alert and response recommendations')) + '</span></article>' +
      '</div>' +
    '</section>' +

    '<section class="mkps-summary-card mkps-summary-results">' +
      '<div class="mkps-summary-head"><div><h3>' + L('우리 현장에 맞는 제안은 어떻게 준비하나요?', 'How do we tailor the proposal to your site?') + '</h3><p>' + L('입력하신 조건과 Monnit 레퍼런스를 비교해, 현장에 맞는 적용 방향을 검토합니다.', 'We compare your conditions with Monnit references to review the right implementation approach for your site.') + '</p></div></div>' +
      '<div class="mkps-result-strip">' + (tiles.length ? tiles.map(function (r, i) {
        return '<div class="' + (first ? 'pop' : '') + '" style="animation-delay:' + (0.1 + i * 0.12) + 's"><b>' + esc(r.n) + '</b><small>' + esc(r.l) + '</small></div>';
      }).join('') : '<div><b>—</b><small>' + L('분석 중', 'Analyzing') + '</small></div>') + '</div>' +
      '<p class="mkps-summary-source">' + L(esc(brand.countries) + '개국 Monnit 글로벌 레퍼런스와 ' + esc(segName) + ' 산업 플레이북을 대조합니다.', 'Matched against Monnit references across ' + esc(brand.countries) + ' countries and the ' + esc(segName) + ' playbook.') + '</p>' +
    '</section>' +

    '<section class="mkps-summary-card mkps-summary-cta" id="mkpsQuoteCard">' +
      '<div class="mkps-summary-head"><div><h3>' + L('제안서로 방향을 확인했다면,<br>견적에서 실제 적용 범위를 확인해보세요.', 'Ready for the next step?<br>Confirm the implementation scope with a quote.') + '</h3></div></div>' +
      '<p class="mkps-quote-note">' + L('센서 수량 · 설치 위치 · 적용 범위 · 예상 비용까지 함께 확인할 수 있습니다.', 'Confirm sensor quantities, locations, scope, and expected cost together.') + '</p>' +
      '<a class="mkp-btn" href="' + esc(quoteHref(v)) + '" data-quote="1">' + L('현장 맞춤 견적 받아보기 →', 'Request a site-specific quote →') + '</a>' +
    '</section>' +

    /* E. 산업 × 과제 */
    '<details class="mkps-acc"><summary>' + L(esc(I.short || I.label) + ' 현장 공통 과제와 우리 현장 과제', 'Common challenges in ' + esc(I.label) + ' vs. yours') + ' <span>' + L('기준 과제 ' + picked.length + '건', picked.length + ' selected') + '</span></summary><div class="mkp-plist is-static">' +
      v.common.map(function (c) { return '<div class="mkp-pitem' + (c.picked ? ' on' : '') + '"><span class="mkp-ck"></span><span><b>' + esc(c.label) + '</b><small>' + esc(c.desc) + '</small></span></div>'; }).join('') +
    '</div></details>' +
    (t1 ? '<details class="mkps-acc"' + (p.sent ? ' open' : '') + '><summary>' + L('가장 닮은 사례 자세히 보기', 'Closest references in detail') + ' <span>' + L('상위 ' + top.length + '곳', 'Top ' + top.length) + '</span></summary><div>' +
      top.map(function (t, i) {
        var url = safeUrl(t.url), inside = isInternal(url);
        return '<a class="mkps-case" href="' + esc(url || '#') + '"' + caseLinkAttrs(url, 'status') + '><em>' + L((i + 1) + '위', '#' + (i + 1)) + '</em><div><b>' + esc(t.name) + ' · ' + t.pct + '%</b><small>' + esc((t.why || []).join(' · ') || t.tagline || '') + '</small></div><span>' +
          (t.results || []).slice(0, 2).map(function (r) { return '<i><b>' + esc(r.n) + '</b>' + esc(r.l) + '</i>'; }).join('') + '</span><u aria-hidden="true">' + (inside ? '→' : '↗') + '</u></a>';
      }).join('') +
      '<p class="mkps-small">' + L('사례 페이지를 봐도 상단 「내 맞춤 제안서」 버튼으로 이 화면에 바로 돌아올 수 있습니다. 사례 수치는 해당 현장의 공개 결과이며, 현장마다 달라질 수 있습니다.', 'After viewing a case, use the “My proposal” button to return here. Figures are published results and vary by site.') + '</p></div></details>' : '') +
    '<details class="mkps-acc"><summary>' + L('제안서에 들어갈 권장 센서', 'Recommended sensors') + ' <span>' + L(v.sensors.length + '종', v.sensors.length + ' types') + '</span></summary><div class="mkp-plist is-static">' +
      v.sensors.map(function (s2) { return '<div class="mkp-pitem on"><span class="mkp-ck"></span><span><b>' + esc(s2.name) + '</b><small>' + esc(s2.for.join(', ')) + '</small></span></div>'; }).join('') +
      '</div></details>' +
    '<details class="mkps-acc"><summary>' + L('입력하신 내용', 'Your request') + '</summary><div><div class="mkp-chips">' +
      v.problems.map(function (t) { return '<span class="mkp-chip is-static" aria-pressed="true">' + esc(t) + '</span>'; }).join('') +
      v.goals.map(function (t) { return '<span class="mkp-chip is-static">' + esc(t) + '</span>'; }).join('') +
      '</div>' + (v.facility ? '<p class="mkps-small">' + L('시설 · ', 'Site · ') + esc(v.facility) + '</p>' : '') +
      '<p class="mkps-small">' + L('바꾸실 내용이 있으면 메일에 회신해 주세요. 담당자가 반영해 드립니다.', 'To change anything, simply reply to our email.') + '</p></div></details>' +

    '<div class="mkps-share"><div><b>' + L('다른 현장을 맡은 동료에게도 필요할까요?', 'Could a colleague use one for another site?') + '</b><small>' + L('신청 페이지 주소만 전달되며 입력하신 정보는 공유되지 않습니다.', 'Only the request page link is shared — never your details.') + '</small></div>' +
      '<button type="button" class="mkp-btn is-ghost" id="ppsShare">' + L('신청 페이지 링크 공유', 'Share request page') + '</button></div>';

    var y = w.scrollY;
    var opened = $$('#ppsApp details').map(function (el) { return el.open; });
    $('#ppsApp').innerHTML = html;
    if (!first) {
      $$('#ppsApp details').forEach(function (el, i) { if (opened[i] != null) el.open = opened[i]; });
      w.scrollTo(0, y);
    }
    S.rendered = true;
    S.lang = en;

    var fill = $('#ppsFill'), rider = $('#ppsRider');
    var set = function () {
      if (fill) fill.style.width = p.pct + '%';
      if (rider) rider.style.left = p.pct + '%';
    };
    if (first && fill) {
      fill.style.width = '0%';
      if (rider) rider.style.left = '0%';
      setTimeout(set, 350);
    } else set();

    live(v, p);
    tick();
    setBar(v, !!p.sent);
    if (first) {
      push('proposal_status_view', { proposal_stage: p.current, proposal_first: S.first ? 1 : 0, proposal_mode: p.mode || '', proposal_lang: en ? 'en' : 'ko' });
      if (S.first) intro(x);
    }
    if (p.sent && !first && !wasSent && !S.sentSeen) {
      S.sentSeen = true;
      toast('send', L('맞춤 제안서를 보냈습니다', 'Your proposal has been sent'), L(mailTo + ' 메일함을 확인해 주세요', 'Check your inbox: ' + mailTo));
      push('proposal_status_delivered', { proposal_mode: p.mode || '' });
    }
  }

  /* 사례 링크 — 사이트 안 사례는 같은 탭에서 열고 「내 맞춤 제안서」 버튼으로 돌아온다. 외부 링크는 새 탭 */
  function isInternal(url) { return /^\/(?!\/)/.test(url || ''); }
  function caseLinkAttrs(url, from) {
    if (!url) return ' aria-disabled="true"';
    return isInternal(url) ? ' data-case-go="' + esc(url.slice(1)) + '" data-back="' + from + '"' : ' target="_blank" rel="noopener noreferrer"';
  }

  /* 진행 중 단계의 작업 로그 — 실제 매칭 결과로 문장을 만든다 */
  function live(v, p) {
    clearInterval(S.liveT);
    var el = $('#ppsLive'); if (!el) return;
    var t1 = v.top[0] || {}, pb = v.playbook || { chronic: [], zones: [], automation: [] };
    var brand = v.brand || BRAND;
    var en = isEn();
    var lines = en ? {
      collect: ['Checking request · ' + v.company, 'Industry · ' + v.industry.label],
      analyze: [v.segment ? 'Segment · ' + v.segment : 'Industry · ' + v.industry.label, 'Concern ' + v.problems.length + ' · goals ' + v.goals.length],
      gather: ['Querying Monnit references · ' + brand.countries + ' countries', 'Korean sites incl. ' + brand.publicRef, (v.segment || v.industry.label) + ' playbook · zones ' + pb.zones.length],
      insight: ['Similarity · ' + (t1.name || ''), 'Match ' + (t1.pct || 0) + '%', 'Reference figures ' + v.evidence.length],
      compose: ['Zone monitoring map', 'Recommended sensors ' + v.sensors.length, 'Smart operations roadmap ' + pb.automation.length + ' levels'],
      review: p.mode === 'instant' ? ['Checking figures & wording', 'Confirming 940MHz configuration', 'Checking the PDF'] : ['Waiting for engineer review', 'Reviewing configuration'],
      deliver: ['Preparing email', 'Checking attachment']
    }[p.current] : {
      collect: ['입력 정보 확인 · ' + v.company, '산업 분류 · ' + v.industry.label],
      analyze: [v.segment ? '세부 업종 · ' + v.segment : '업종 분류 · ' + v.industry.label, '기준 과제 ' + v.problems.length + '건 · 목표 ' + v.goals.length + '건 정리'],
      gather: ['Monnit 글로벌 레퍼런스 조회 · ' + brand.countries + '개국', brand.publicRef + ' 국내 도입 현장 데이터 대조', (v.segment || v.industry.short) + ' 플레이북 · 공정·구역 ' + pb.zones.length + '곳'],
      insight: ['유사도 계산 · ' + (t1.name || ''), '일치도 ' + (t1.pct || 0) + '% 산출', '참고 수치 ' + v.evidence.length + '건 추출'],
      compose: ['구역별 모니터링 맵 조판', '권장 센서 ' + v.sensors.length + '종 배치', '스마트 관리 로드맵 ' + pb.automation.length + '단계 정리'],
      review: p.mode === 'instant' ? ['근거 없는 수치·표현 점검', '940MHz 구성 표기 확인', '첨부 PDF 확인'] : ['담당 엔지니어 검수 대기', '구성안 확인 중'],
      deliver: ['메일 발송 준비', '첨부 파일 확인']
    }[p.current] || [''];
    if (!lines) lines = [''];
    var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = '> ' + lines[0]; return; }
    var i = 0, j = 0;
    S.liveT = setInterval(function () {
      if (!el.isConnected) return clearInterval(S.liveT);
      var t = '> ' + lines[i % lines.length];
      j++;
      el.innerHTML = esc(t.slice(0, j)) + '<i></i>';
      if (j > t.length + 12) { i++; j = 0; }
    }, 60);
  }

  /* 남은 시간 — 즉시 방식은 분 단위로 약속하지 않는다(「순차 처리 중」) */
  function tick() {
    if (!active('view-proposal-status')) return stopStatus();
    var x = S.last; if (!x || x.progress.sent) return;
    var el = $('#ppsLeft'); if (!el) return;
    var ms = Math.max(0, x.progress.dueMs - (Date.now() - S.offset));
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    if (ms <= 0) { el.textContent = L('곧 도착합니다', 'Arriving soon'); return; }
    var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s2 = Math.floor(ms % 60000 / 1000), dd = Math.floor(h / 24);
    el.textContent = h > 0 ? (dd > 0 ? 'D-' + dd + ' · ' : '') + pad(h % 24) + ':' + pad(m) + ':' + pad(s2) : pad(m) + ':' + pad(s2);
  }

  function toast(icon, title, sub) {
    var box = $('#ppToasts'); if (!box) return;
    var t = d.createElement('div');
    t.className = 'mkp-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + (ICON[icon] || ICON.mail) + '</span><div><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></div>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 3400);
  }
  /* 신청 직후 — 이미 나간 알림을 푸시처럼 차례로 보여준다 */
  function intro(x) {
    var brand = x.view.brand || BRAND;
    var list = x.notices.filter(function (n) { return n.state === 'done' && (n.key === 'receipt' || n.key === 'staff'); })
      .map(function (n) { return [NICON[n.key], n.label, n.ch]; });
    if (!list.length) list = [['mail', L('접수가 완료되었습니다', 'Request received'), L('진행 상황을 이 화면에서 확인하세요', 'Follow the progress on this page')]];
    list.push(['chart', L('Monnit 글로벌 데이터 취합을 시작합니다', 'Gathering Monnit global data'), L(brand.countries + '개국 레퍼런스 · ' + brand.publicRef + ' 국내 현장 · 산업 플레이북', 'References in ' + brand.countries + ' countries · industry playbooks')]);
    list.forEach(function (n, i) { setTimeout(function () { toast(n[0], n[1], n[2]); }, 700 + i * 1100); });
  }

  d.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var qb = e.target.closest('[data-quote]');
    if (qb && (S.last || qb.getAttribute('data-quote') === 'scope' || S.lim)) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      push('proposal_quote_click', { from: qb.id === 'ppsCta' ? 'status_bar' : 'status_card', proposal_limit: S.lim ? 1 : 0 });
      goQuote(S.last && !S.lim ? S.last.view : null);
      return;
    }
    var cg = e.target.closest('[data-case-go]');
    if (cg) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      if (cg.getAttribute('data-back') === 'proposal') { A.st.caseViews++; saveDraft(); }
      ss.set('mk_prop_back', cg.getAttribute('data-back') === 'proposal' ? 'proposal' : 'proposal/status');
      push('proposal_case_open', { from: cg.getAttribute('data-back') });
      go(cg.getAttribute('data-case-go'), '');
      return;
    }
    if (e.target.id === 'ppsMine') { S.lim = null; w.history.replaceState(null, '', '/proposal/status'); enterStatus(); return; }
    var g = e.target.closest('[data-pgo]');
    if (g) { e.preventDefault(); go(g.getAttribute('data-pgo'), ''); return; }
    if (e.target.id === 'ppsShare') {
      var url = 'https://monnit.co.kr/proposal?utm_source=share&utm_medium=referral&utm_campaign=custom_proposal';
      push('proposal_share_click');
      if (navigator.share) { navigator.share({ title: L('모넷 맞춤 제안서', 'Monnit custom proposal'), text: L('우리 현장에 맞춘 IoT 제안서를 무료로 받아볼 수 있어요', 'Get a free IoT proposal tailored to your site'), url: url }).catch(function () {}); return; }
      var b = e.target;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = L('링크를 복사했습니다', 'Link copied'); }, function () { w.prompt(L('링크를 복사해 주세요', 'Copy this link'), url); });
    }
    if (e.target.id === 'ppsCta' && !e.target.hasAttribute('data-quote')) push('proposal_visit_click', { from: 'status' });
  });
  /* 다른 스크립트가 현황을 바로 다시 불러오게 할 때: window.dispatchEvent(new Event('mk-proposal-refresh')) */
  w.addEventListener('mk-proposal-refresh', function () { if (active('view-proposal-status') && S.rendered) { clearTimeout(S.poll); load(); } });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && active('view-proposal-status') && S.rendered && !S.demo) { clearTimeout(S.poll); load(); } });
  /* 사이트 언어 전환(KO/EN) — 화면을 그 언어로 다시 그린다 */
  w.addEventListener('monnit:langchange', function () {
    if (active('view-proposal-status')) { if (S.lim) limitOnly(S.lim); else { S.rendered = false; clearTimeout(S.poll); load(); } }
    if (active('view-proposal') && A.ready) { A.sig = null; enterApply(); }
  });

  /* 무료 제안서 범위 · 전체 견적 요청 — 주소에는 제안 번호만(회사·성함은 이 탭 저장소로) */
  function quoteHref(v) { return '/contact?quote=' + encodeURIComponent(v && v.no ? v.no : 'scope'); }
  function goQuote(v) {
    if (v) ss.set('mk_quote', JSON.stringify({ no: v.no, company: v.company || '', name: v.name || '', topic: ((v.scope && v.scope.problems) || v.problems || []).join(', ') }));
    else ss.del('mk_quote');
    go('contact', quoteHref(v).slice('/contact'.length));
  }
  function scopeCard(v, p) {
    var sc = v.scope; if (!sc || !sc.problems.length) return '';
    var li = function (a) { return a.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join(''); };
    return '<div class="mkps-scope' + (p.sent ? ' is-sent' : '') + '">' +
      '<div class="mkps-scope-h"><h3>' + L('이 제안서는 <em>「' + esc(sc.problems.join(', ')) + '」</em> 기준입니다', 'This proposal focuses on <em>“' + esc(sc.problems.join(', ')) + '”</em>') + '</h3>' +
        '<p>' + L('무료 맞춤 제안서는 가장 고민되는 과제 하나를 깊게 다룹니다. 다른 과제와 현장 전체 구성·수량·견적은 견적 요청으로 담당 엔지니어가 함께 정리합니다.', 'The free proposal goes deep on your top concern. For other challenges and a full-site configuration, quantities and pricing, request a quote and an engineer will prepare it with you.') + '</p></div>' +
      '<div class="mkps-scope-cols">' +
        '<div class="in"><p>' + L('제안서에 담긴 것', 'Included') + '</p><ul>' +
          '<li>' + L('선택 과제 진단 · 권장 센서 · 유사 사례', 'Diagnosis of your concern · recommended sensors · closest references') + '</li>' +
          (sc.openZones.length ? '<li>' + L('연결 구역 ' + sc.openZones.length + '곳', sc.openZones.length + ' linked zone(s)') + ' <div class="mkp-zones">' + li(sc.openZones) + '</div></li>' : '') +
          (sc.openLevels.length ? '<li>' + L('우선 적용 단계 · ', 'First steps · ') + esc(sc.openLevels.join(' → ')) + '</li>' : '') +
        '</ul></div>' +
        '<div class="out"><p>' + L('견적 요청 시 함께 정리', 'With a quote request') + '</p><ul>' +
          (sc.others.length ? '<li>' + L('다른 과제', 'Other challenges') + ' <div class="mkp-zones">' + li(sc.others.slice(0, 6)) + '</div></li>' : '') +
          (sc.lockedZones.length ? '<li>' + L('나머지 구역 ' + sc.lockedZones.length + '곳의 관리 포인트·센서', 'Checkpoints and sensors for ' + sc.lockedZones.length + ' more zones') + '</li>' : '') +
          (sc.lockedLevels.length ? '<li>' + L('확장 단계 · ', 'Expansion · ') + esc(sc.lockedLevels.join(' · ')) + '</li>' : '') +
          '<li>' + L('구역별 수량 · 설치 위치 · 견적', 'Quantities, locations and pricing by zone') + '</li>' +
        '</ul></div>' +
      '</div>' +
      '<div class="mkps-scope-cta"><a class="mkp-btn" href="' + esc(quoteHref(v)) + '" data-quote="1">' + L('현장 전체 견적 요청 →', 'Request a full-site quote →') + '</a>' +
        '<small>' + L('설비 목록이나 도면이 있으면 함께 보내 주세요. 더 정확하게 정리해 드립니다.', 'Share an equipment list or floor plan for a more precise quote.') + '</small></div>' +
    '</div>';
  }
  function limitBox(v, Lm) {
    return '<div class="mkps-limit"><b>' + (Lm.same ? L('같은 과제로 이미 받으신 맞춤 제안서가 있습니다', 'You already have a proposal for this concern') : L('이미 받으신 맞춤 제안서가 있어 새로 만들지 않았습니다', 'You already have a proposal, so we didn’t create a new one')) + '</b>' +
      '<p>' + L('무료 맞춤 제안서는 회사·이메일당 ' + esc(Lm.days || 30) + '일에 한 번, 가장 고민되는 과제 하나를 기준으로 만들어 드립니다.' +
        (Lm.asked && !Lm.same ? ' 새로 말씀하신 「' + esc(Lm.asked) + '」 과제' : ' 다른 과제') + '나 현장 전체 구성·견적은 견적 요청으로 받아 보실 수 있어요. 담당 엔지니어에게도 요청 내용을 전달했습니다.',
        'The free proposal is available once every ' + esc(Lm.days || 30) + ' days per company and email, focused on one concern. For other challenges or a full-site configuration and quote, send a quote request — we’ve also passed your request to our engineers.') + '</p>' +
      '<a class="mkp-btn" href="' + esc(quoteHref(v)) + '" data-quote="1">' + L('견적 요청으로 이어서 받기 →', 'Continue with a quote request →') + '</a></div>';
  }

  /* 시연 데이터 — 서버 없이 화면만 (?demo=1). 즉시 방식 흐름을 2분 30초로 재생한다 */
  function demoData() {
    var Q = new URLSearchParams(w.location.search);
    var clip = function (v, n) { return String(v || '').slice(0, n || 30); };
    var ik = Q.get('ind') || 'datacenter', I = ind(ik) || KB.industries[0];
    var pr = (Q.get('pr') || '').split(',').filter(function (k) { return I.problems.indexOf(k) >= 0; });
    pr = (pr.length ? pr : I.problems).slice(0, 1);
    var gl = (Q.get('gl') || '').split(',').filter(function (k) { return KB.goals[k]; });
    if (!gl.length) gl = I.goals.slice(0, 2);
    var cs = DATA.cases.filter(function (c) { return c.detailed && c.results.length; }).sort(function (a, b) {
      return (b.industries.indexOf(ik) >= 0) - (a.industries.indexOf(ik) >= 0) || a.global - b.global;
    }).slice(0, 3);
    var pcts = [88, 61, 47];
    var now = Date.now(), span = 150000, created = Q.get('done') === '1' ? now - span - 1000 : S.demoT0, due = created + span, tt = Math.min(1, (now - created) / span);
    var AT = [0, 0.06, 0.18, 0.36, 0.56, 0.82, 1];
    var ST = isEn() ? [['Request received', 'We have your company, site and challenge details'], ['Industry & challenge analysis', 'We identify your industry and process'], ['Gathering Monnit data', 'Global references, industry playbooks and sensor data'], ['Monnit insight engine', 'Matching similar sites and reference figures'], ['Writing your proposal', 'Zone monitoring map and smart operations roadmap'], ['Quality check', 'Figures, wording and structure are checked automatically'], ['Proposal delivery', 'We email the PDF to you']]
      : [['고객 정보 수집', '입력하신 회사·시설·과제 정보를 받았습니다'], ['업종·과제 분석', '회사와 문의 내용으로 업종과 세부 공정을 정리합니다'], ['모넷 데이터 취합', 'Monnit 글로벌 레퍼런스·산업 플레이북·센서 적용 데이터를 모읍니다'], ['모넷 인사이트 알고리즘 가동', '유사 현장을 매칭하고 참고 수치를 추립니다'], ['맞춤 제안서 작성', '구역별 모니터링 맵과 스마트 관리 로드맵을 조판합니다'], ['품질 점검', '수치·표현·구성을 자동으로 점검합니다'], ['제안서 발송', '이메일로 PDF를 보내드립니다']];
    var sent = tt >= 1, idx = 1;
    AT.forEach(function (a, i) { if (tt >= a && i < 6 && i > idx) idx = i; });
    var fmt = function (ms) {
      var x = new Date(ms);
      if (isEn()) return 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[x.getMonth()] + ' ' + x.getDate() + ' ' + ((x.getHours() % 12) || 12) + ':' + ('0' + x.getMinutes()).slice(-2) + (x.getHours() < 12 ? ' AM' : ' PM');
      return (x.getMonth() + 1) + '월 ' + x.getDate() + '일(' + '일월화수목금토'[x.getDay()] + ') ' + (x.getHours() < 12 ? '오전 ' : '오후 ') + ((x.getHours() % 12) || 12) + ':' + ('0' + x.getMinutes()).slice(-2);
    };
    var fmtShort = function (ms) {
      var x = new Date(ms);
      return (x.getMonth() + 1) + '/' + x.getDate() + ' ' + ((x.getHours() % 12) || 12) + ':' + ('0' + x.getMinutes()).slice(-2);
    };
    var sensors = {};
    pr.forEach(function (k) { (KB.problems[k].sensors || []).forEach(function (sk) { (sensors[sk] = sensors[sk] || []).push(probL(k)); }); });
    var P = (KB.playbooks || {})[I.key];
    var mail = 'ki**@monnit.co.kr';
    var zs = P ? P.zones.map(function (z) { return { zone: z.zone, f: (z.problems || []).some(function (k) { return pr.indexOf(k) >= 0; }) }; }) : [];
    var open = zs.filter(function (z) { return z.f; }); if (!open.length) open = zs.slice(0, 2);
    var on = open.map(function (z) { return z.zone; });
    var locked = zs.filter(function (z) { return on.indexOf(z.zone) < 0; }).map(function (z) { return z.zone; });
    var lz = function (a) { return a.map(pbL).filter(Boolean); };
    return {
      now: now,
      view: {
        no: 'MK-P-DEMO', company: clip(Q.get('co')) || L('(주)모넷물류', 'Monnit Logistics Co.'), name: clip(Q.get('nm')) || L('김모넷', 'Alex Kim'), title: clip(Q.get('ti')),
        industry: { key: I.key, label: indL(I), short: indL(I, 'short'), hero: indL(I, 'hero') }, facility: '',
        problems: pr.map(probL).filter(Boolean), goals: gl.map(goalL).filter(Boolean),
        top: cs.map(function (c, i) { return caseL({ key: c.key, name: c.name, pct: pcts[i], why: i === 0 ? [L('같은 산업', 'Same industry')] : [L('인접 산업', 'Adjacent industry')], tagline: c.tagline, results: c.results.slice(0, 4), global: c.global, image: c.image, url: c.url }); }),
        common: I.problems.map(function (k) { return { key: k, label: probL(k), desc: probD(k), picked: pr.indexOf(k) >= 0 }; }).filter(function (c) { return c.label; }).sort(function (a, b) { return b.picked - a.picked; }),
        peers: [], sensors: Object.keys(sensors).map(function (sk) { return { name: sensorL(sk), for: sensors[sk] }; }),
        evidence: cs[0] ? caseL({ key: cs[0].key, name: cs[0].name, results: cs[0].results.slice(0, 3) }).results : [], confidence: 'high', pool: DATA.cases.length, status: sent ? 'sent' : 'drafted', mode: 'instant',
        segment: isEn() ? '' : clip(Q.get('sgl'), 40), recognized: isEn() ? '' : clip(Q.get('rc'), 80), brand: BRAND,
        scope: { problems: pr.map(probL).filter(Boolean), others: I.problems.filter(function (k) { return pr.indexOf(k) < 0; }).map(probL).filter(Boolean),
          openZones: lz(on), lockedZones: lz(locked), lockedZonesKo: locked,
          openLevels: P ? P.automation.slice(0, 2).map(function (a) { return pbL(a) || a; }) : [], lockedLevels: P ? P.automation.slice(2).map(function (a) { return pbL(a) || a; }) : [], also: [], quote: '/contact?quote=MK-P-DEMO' },
        playbook: P ? {
          chronic: P.chronic.filter(function (c) { return pbL(c.title); }).map(function (c) { return { title: pbL(c.title), detail: pbL(c.detail), focus: (c.problems || []).some(function (k) { return pr.indexOf(k) >= 0; }) }; }),
          zones: P.zones.filter(function (z) { return pbL(z.zone); }).map(function (z) { return { zone: pbL(z.zone), ko: z.zone, focus: (z.problems || []).some(function (k) { return pr.indexOf(k) >= 0; }) }; }),
          personas: (P.personas || []).map(pbL).filter(Boolean), automation: P.automation.map(function (a) { return pbL(a) || a; })
        } : null
      },
      progress: {
        mode: 'instant', pct: sent ? 100 : Math.max(3, Math.round(tt * 97)), current: sent ? 'deliver' : ['collect', 'analyze', 'gather', 'insight', 'compose', 'review', 'deliver'][idx],
        note: sent ? L('담당 엔지니어가 영업일 기준 1일 안에 내용을 확인하고 연락드립니다.', 'An engineer will review it and contact you within 1 business day.') : '',
        eta: sent ? fmt(due) : L('몇 시간 이내 · 접수 순서대로', 'Within a few hours · in the order received'),
        due: fmt(due), dueMs: due, remainMs: Math.max(0, due - now), sent: sent, sentAt: sent ? fmt(due) : '',
        stages: ST.map(function (st, i) { return { key: i, label: st[0], sub: st[1], state: sent || i < idx ? 'done' : i === idx ? 'now' : 'wait', at: sent || i < idx ? fmt(created + AT[i] * span) : '', atShort: sent || i < idx ? fmtShort(created + AT[i] * span) : '' }; })
      },
      notices: [
        { key: 'staff', label: L('담당 엔지니어 배정', 'Engineer assigned'), ch: L('모넷코리아 기술영업팀', 'Monnit Korea technical sales'), state: 'done', at: fmt(created) },
        { key: 'analysis', label: L('데이터 분석 완료', 'Data analysis complete'), ch: L('이 화면에서 확인', 'Shown on this page'), state: tt >= AT[4] ? 'done' : 'plan', at: fmt(created + AT[4] * span) + (tt >= AT[4] ? '' : L(' 예정', ' scheduled')) },
        { key: 'sent', label: L('맞춤 제안서 발송', 'Proposal sent'), ch: mail, state: sent ? 'done' : 'plan', at: sent ? fmt(due) : L('몇 시간 이내 순차 발송', 'Within a few hours') },
        { key: 'callback', label: L('엔지니어 확인 연락', 'Engineer follow-up'), ch: L('회신 메일 또는 전화', 'Reply email or phone call'), state: 'plan', at: L('영업일 기준 1일 안 예정', 'Within 1 business day') }
      ]
    };
  }

  w.MKProposal = {
    enter: function (kind) {
      if (kind === 'status') { enterStatus(); }
      else { stopStatus(); enterApply(); }
    },
    fromContact: fromContact,
    goStatus: goStatus
  };
})(window, document);
