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
    Q: null, QF: null, quick: false, demo: false
  };
  var DRAFT = 'mk_prop_draft_v2';
  var val = function (id) { return String(($('#' + id) || {}).value || '').trim(); };

  function initApply() {
    if (A.ready) return;
    A.ready = true;
    relabelApply();

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
    $('#ppCta').addEventListener('click', onCta);
  }

  /* 언어가 바뀌거나 처음 들어올 때 — 산업 버튼·선택 목록 글자 */
  function relabelApply() {
    $('#ppInds').innerHTML = KB.industries.map(function (i) {
      return '<button type="button" class="mkp-ind" aria-pressed="' + (A.st.industry === i.key) + '" data-k="' + i.key + '"><span class="mkp-ic" aria-hidden="true">' + i.icon + '</span><span>' + esc(indL(i)) + '</span></button>';
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
    renderChronic(); renderGoals(); renderTopCase(localTop());
  }
  function renderChronic() {
    var P = (KB.playbooks || {})[A.st.industry], box = $('#ppChronic');
    if (!P || !P.chronic || !P.chronic.length) { box.hidden = true; return; }
    box.hidden = false;
    var list = P.chronic.slice(0, 4).filter(function (c) { return pbL(c.title); });
    if (!list.length) { box.hidden = true; return; }
    box.innerHTML = '<p class="mkp-chronic-h">' + L('모넷이 이 산업 현장에서 반복해서 보는 문제', 'Recurring problems Monnit sees in this industry') + '</p>' + list.map(function (c) {
      var on = (c.problems || []).some(function (k) { return A.st.problems.indexOf(k) >= 0; });
      return '<div class="mkp-ch' + (on ? ' on' : '') + '"><b>' + esc(pbL(c.title)) + '</b><span>' + esc(pbL(c.detail)) + '</span></div>';
    }).join('');
  }
  function renderGoals() {
    var I = ind(A.st.industry); if (!I) return;
    var rec = I.goals || [];
    var order = rec.concat(Object.keys(KB.goals).filter(function (g) { return rec.indexOf(g) < 0; }));
    $('#ppGoals').innerHTML = order.filter(function (g) { return goalL(g); }).map(function (g) {
      var on = A.st.goals.indexOf(g) >= 0;
      return '<button type="button" class="mkp-chip" aria-pressed="' + on + '" data-k="' + g + '">' + esc(goalL(g)) + (rec.indexOf(g) >= 0 && !on ? '<small>' + L('많이 선택', 'Popular') + '</small>' : '') + '</button>';
    }).join('');
  }

  function localTop() {
    var list = DATA.cases.filter(function (c) { return c.detailed && c.results.length; });
    list.sort(function (a, b) {
      var sa = a.industries.indexOf(A.st.industry) >= 0 ? 1 : 0, sb = b.industries.indexOf(A.st.industry) >= 0 ? 1 : 0;
      return (sb - sa) || (a.global - b.global);
    });
    var c = list[0];
    return c ? { key: c.key, name: c.name, tagline: c.tagline, results: c.results, global: c.global, image: c.image, url: c.url, pct: null, why: [] } : null;
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
      '<span class="mkp-nums">' + (t.results || []).slice(0, 3).map(function (r) { return '<span><b>' + esc(r.n) + '</b><small>' + esc(r.l) + '</small></span>'; }).join('') + '</span>' +
      '<span class="mkp-case-note">' + L('공개된 사례 결과이며 현장마다 달라질 수 있습니다 · 사례 보기', 'Published results; outcomes vary by site · View case') + (isInternal(url) ? ' →' : ' ↗') + '</span></span></a>';
  }
  function renderPeek(pb) {
    var box = $('#ppPeek');
    if (!pb || !pb.zones) { box.innerHTML = ''; return; }
    var seg = pb.segment ? pbL(pb.segment.label) : '';
    box.innerHTML =
      '<p class="mkp-peek-h">' + L('제안서에 들어갈 공정·구역 모니터링 맵', 'Zone monitoring map in your proposal') + (seg ? ' · ' + esc(seg) : '') + '</p>' +
      '<div class="mkp-zones">' + pb.zones.filter(function (z) { return pbL(z.zone); }).map(function (z) { return '<span class="' + (z.focus ? 'on' : '') + '">' + esc(pbL(z.zone)) + '</span>'; }).join('') + '</div>' +
      '<p class="mkp-peek-h">' + L('센서 이후 — 스마트 관리 로드맵', 'Beyond sensors — smart operations roadmap') + '</p>' +
      '<div class="mkp-road">' + (pb.automation || []).map(function (a, i) { return '<i class="' + (i >= 2 ? 'lock' : '') + '" style="height:' + (34 + i * 10) + 'px"><em>L' + (i + 1) + '</em>' + esc(pbL(a) || a) + '</i>'; }).join('') + '</div>';
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
        if (!A.quick && A.st.industry && x.industry !== A.st.industry) {
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
  function updateCta() {
    if (A.st.sending) return;
    var s = stage();
    $('#ppCta').textContent = s === 1 ? L('산업부터 골라 주세요 →', 'Choose your industry →') : s === 2 ? L('가장 고민되는 문제 고르기 →', 'Pick your top concern →') : s === 4 ? L('받으실 분 정보 입력하기 →', 'Enter your details →') : L('내 맞춤 제안서 받기 →', 'Get my proposal →');
  }
  function onCta() {
    var s = stage();
    if (s === 1) return $('#ppS1').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (s === 2) { $('#ppErrProblems').hidden = false; return $('#ppPlist').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (s === 4) {
      var e = validate(true), first = Object.keys(e)[0];
      var el = first === 'consent' ? $('#ppConsent') : $('#pp' + first.charAt(0).toUpperCase() + first.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (x) {} }, 350); }
      return;
    }
    submit();
  }

  function payload() {
    var src = w.MonnitLead ? w.MonnitLead.source() : '';
    var p = {
      company: val('ppCompany'), facility: val('ppFacility'), name: val('ppName'), title: val('ppTitle'),
      email: val('ppEmail'), phone: val('ppPhone'), region: val('ppRegion'), memo: val('ppMemo'),
      industry: A.st.industry, problems: A.st.problems.slice(), goals: A.st.goals.slice(),
      scale: $('#ppScale').value, timeline: $('#ppTimeline').value,
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
      ledger(p, 'NET');
      fail(L('연결이 불안정해 접수를 확인하지 못했습니다. 입력하신 내용은 담당자에게 전달했으며, 확인이 필요하시면 ' + TEL + ' 로 연락 주세요.', 'The connection was unstable and we could not confirm your request. Your details were passed to our team — call +82-2-2088-1454 if you need to confirm.'));
    });
  }
  function fail(msg) {
    A.st.sending = false; $('#ppCta').disabled = false; $('#ppCta').classList.remove('is-loading'); updateCta();
    showMsg(msg);
    $('#ppMsg').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function showMsg(m) { var el = $('#ppMsg'); el.hidden = !m; el.textContent = m; }
  function done(p, x) {
    /* 토큰 없이 끝난 경우(저장소 장애·봇 판정) — 담당자가 직접 보내드린다 */
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
    var o = { industry: A.st.industry, problems: A.st.problems, goals: A.st.goals, scale: $('#ppScale').value, timeline: $('#ppTimeline').value, quick: A.quick, edited: A.st.edited };
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
    A.quick = !!(A.QF.fac && FINDER.fac[A.QF.fac]);
    resetApply();
    var root = $('#ppRoot');
    root.classList.toggle('is-quick', A.quick);
    $('#ppHero').hidden = A.quick;
    $('#ppQuick').hidden = !A.quick;
    $('#ppQEdit').hidden = false;

    var o = readDraft();
    if (o) F.forEach(function (f) { if (o[f] && $('#' + f) && !$('#' + f).value) $('#' + f).value = o[f]; });

    if (A.quick) {
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
      if (FINDER.scale[A.QF.scale]) $('#ppScale').value = FINDER.scale[A.QF.scale];
      push('proposal_quick_view', { proposal_fac: A.QF.fac, proposal_con: A.QF.con });
      if (val('ppCompany')) detectCompany();
    } else {
      var qi = Q.get('industry'), qp = (Q.get('problems') || '').split(',').filter(Boolean), qg = (Q.get('goals') || '').split(',').filter(Boolean);
      var src = qi ? { industry: qi, problems: qp, goals: qg } : (o && !o.quick ? o : null);
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
    else { cta.textContent = L('기다리는 동안 현장 진단 예약 →', 'Book a site survey while you wait →'); cta.setAttribute('href', '/visit?utm_source=proposal_status&utm_medium=web&utm_campaign=custom_proposal'); cta.removeAttribute('data-quote'); }
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

    var head = p.sent
      ? '<h2 class="seo-h1 mkps-h">' + L(who + '의 맞춤 제안서를<br><em>메일로 보내드렸습니다</em>', who + ', your custom proposal<br><em>has been emailed</em>') + '</h2>'
      : '<h2 class="seo-h1 mkps-h">' + L(who + '만을 위한 제안서를<br><em>Monnit 글로벌 데이터로</em> 준비하고 있습니다', 'We’re preparing a proposal for ' + (who ? who + ',' : 'you,') + '<br><em>built on Monnit’s global data</em>') + '</h2>';

    var html =
    '<div class="mkps-top">' +
      '<span class="nh-eyebrow">' + (p.sent ? 'Delivered' : instant ? L('접수 순서대로 처리 중', 'Processing in order received') : 'Engineer review') + ' · ' + esc(v.no) + (demo ? L(' · 시연 화면', ' · Demo') : '') + '</span>' +
      head +
      (v.recognized ? '<p class="mkps-rec">' + esc(v.recognized) + (v.ownCase && (!en || v.ownCase.name) ? ' · <b>' + L('모넷 도입 고객 확장 제안', 'Expansion proposal for an existing Monnit customer') + '</b>' : '') + '</p>' : '') +
      (en ? '<p class="mkps-rec is-note">The proposal PDF and emails are written in Korean. For an English proposal, <a href="' + esc(quoteHref(v)) + '" data-quote="1">contact our team</a>.</p>' : '') +
    '</div>' +

    '<div class="mkps-grid">' +
      /* A. 배달형 진행 */
      '<div class="mkps-track">' +
        '<div class="mkps-eta"><div><small>' + (p.sent ? L('발송 시각', 'Sent') : L('도착 안내', 'Arrival')) + '</small><b>' + esc(eta) + '</b></div>' +
          (p.sent ? '<span class="mkps-left is-done">' + L('메일함을 확인해 주세요', 'Check your inbox') + '</span>'
            : instant ? '<span class="mkps-left is-live"><i aria-hidden="true"></i>' + L('순차 처리 중', 'In progress') + '</span>'
            : '<span class="mkps-left" id="ppsLeft">--:--</span>') + '</div>' +
        '<div class="mkps-bar" aria-hidden="true"><div class="mkps-fill" id="ppsFill"></div>' +
          p.stages.map(function (st, i) { return '<span class="mkps-dot' + (st.state === 'done' ? ' done' : '') + '" style="left:' + (i / (p.stages.length - 1) * 100) + '%"></span>'; }).join('') +
          '<span class="mkps-rider" id="ppsRider">' + ICON.doc + '</span></div>' +
        '<div class="mkps-labels">' + shortLabels(instant).map(function (t, i) { return '<span class="' + (p.stages[i].state === 'now' ? 'on' : '') + '">' + t + '</span>'; }).join('') + '</div>' +
        '<p class="mkps-sr" role="progressbar" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100">' + L('진행률 ', 'Progress ') + p.pct + '%</p>' +
        '<ol class="mkps-steps">' + p.stages.map(function (st, i) {
          return '<li class="' + st.state + '"><span class="mkps-ic">' + (st.state === 'done' ? '✓' : st.state === 'stop' ? '×' : (i + 1)) + '</span>' +
            '<div><b>' + esc(st.label) + '</b><small>' + esc(st.sub) + '</small>' + (st.state === 'now' ? '<div class="mkps-live" id="ppsLive"></div>' : '') + '</div>' +
            '<time>' + esc(st.state === 'now' ? L('진행 중', 'In progress') : st.at) + '</time></li>';
        }).join('') + '</ol>' +
        (p.note ? '<p class="mkps-note">' + esc(p.note) + '</p>' : '') +
        (p.sent ? '<div class="mkps-mailbox">' + ICON.mail + '<div><b>' + L(esc(mailTo) + ' 으로 PDF를 보냈습니다', 'We sent the PDF to ' + esc(mailTo)) + '</b><small>' + L('메일이 보이지 않으면 스팸함을 확인해 주세요. 그래도 없으면 ' + TEL + ' 또는 korea@monnit.com 으로 알려 주시면 바로 다시 보내드립니다.', 'If you can’t find it, check your spam folder or let us know at korea@monnit.com / +82-2-2088-1454 and we’ll resend it.') + '</small></div></div>' : '') +
      '</div>' +

      '<div class="mkps-side">' +
        /* B. 결과 카드 */
        '<div class="mkps-result">' +
          '<p class="mkps-strike"><s>' + L('누구에게나 같은 제품 카탈로그', 'The same catalog for everyone') + '</s></p>' +
          '<p class="mkps-k">' + L('Monnit 글로벌 데이터가 찾은 가장 닮은 현장', 'The closest site in Monnit’s global data') + '</p>' +
          '<div class="mkps-tiles">' + (tiles.length ? tiles.map(function (r, i) {
            return '<div class="' + (first ? 'pop' : '') + '" style="animation-delay:' + (0.1 + i * 0.12) + 's"><b>' + esc(r.n) + '</b><small>' + esc(r.l) + '</small></div>';
          }).join('') : '<div><b>—</b><small>' + L('분석 중', 'Analyzing') + '</small></div>') + '</div>' +
          (t1 ? '<p class="mkps-rank">' + L('1위 ', 'No.1 ') + '<b>' + esc(t1.name) + ' ' + t1.pct + '%</b>' + (t2 ? L(' · 2위 ', ' · No.2 ') + esc(t2.name) + ' ' + t2.pct + '%' : '') + '</p>' : '') +
          '<p class="mkps-verdict">' + verdict + '</p>' +
          '<p class="mkps-foot">' + L(esc(brand.countries) + '개국 Monnit 글로벌 레퍼런스 · ' + esc(brand.publicRef) + ' 국내 현장 · ' + esc(segName) + ' 플레이북 대조',
            'Matched against Monnit references across ' + esc(brand.countries) + ' countries, Korean sites incl. ' + esc(brand.publicRef) + ', and the ' + esc(segName) + ' playbook') + '</p>' +
        '</div>' +
        /* D. 알림 */
        '<div class="mkps-noti"><p class="mkps-sh">' + L('알림 발송 과정', 'Notifications') + '</p>' + x.notices.map(function (n) {
          var lab = n.state === 'done' ? L('완료', 'Done') : n.state === 'retry' ? L('재시도 중', 'Retrying') : n.state === 'skip' ? L('취소', 'Canceled') : L('예정', 'Planned');
          return '<div class="mkps-n ' + n.state + '"><span>' + ICON[NICON[n.key] || 'mail'] + '</span><div><b>' + esc(n.label) + '<em>' + lab + '</em></b><small>' + esc(n.ch) + (n.at ? ' · ' + esc(n.at) : '') + '</small></div></div>';
        }).join('') + '</div>' +
      '</div>' +
    '</div>' +

    scopeCard(v, p) +

    /* C. 산업 플레이북 */
    (v.playbook && v.playbook.chronic.length ? '<div class="mkps-block">' +
      '<span class="nh-eyebrow">' + esc(segName) + ' Playbook</span>' +
      '<h3>' + L('이 현장의 고질적인 문제부터 스마트 관리까지 담았습니다', 'From recurring site problems to smart operations') + '</h3>' +
      '<div class="mkp-chronic is-grid">' + v.playbook.chronic.map(function (c) {
        return '<div class="mkp-ch' + (c.focus ? ' on' : '') + '"><b>' + esc(c.title) + '</b><span>' + esc(c.detail) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="mkps-pb">' +
        (v.playbook.personas.length ? '<div><p class="mkp-peek-h">' + L('담당자별 어려움', 'Pain points by role') + '</p><div class="mkp-zones">' + v.playbook.personas.map(function (r) { return '<span>' + esc(r) + '</span>'; }).join('') + '</div></div>' : '') +
        '<div><p class="mkp-peek-h">' + L('공정·구역별 모니터링 맵', 'Zone monitoring map') + ' <small>' + L('(파란색: 말씀하신 과제와 연결 · 점선: 견적 요청 시 정리)', '(blue: linked to your concern · dashed: covered in a full-site quote)') + '</small></p><div class="mkp-zones">' + v.playbook.zones.map(function (z) {
          var lk = (sc.lockedZonesKo || sc.lockedZones).indexOf(z.ko || z.zone) >= 0;
          return '<span class="' + (z.focus ? 'on' : lk ? 'lock' : '') + '"' + (lk ? ' title="' + L('전체 현장 견적 요청 시 정리', 'Covered in a full-site quote') + '"' : '') + '>' + esc(z.zone) + '</span>';
        }).join('') + '</div></div>' +
        '<div><p class="mkp-peek-h">' + L('센서 이후 — 스마트 관리 로드맵', 'Beyond sensors — smart operations roadmap') + '</p><div class="mkp-road">' + v.playbook.automation.map(function (a, i) { return '<i class="' + (i >= 2 ? 'lock' : '') + '" style="height:' + (34 + i * 10) + 'px"><em>L' + (i + 1) + '</em>' + esc(a) + '</i>'; }).join('') + '</div></div>' +
      '</div></div>' : '') +

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
      '</div><p class="mkps-small">' + L('국내 940MHz 무선 게이트웨이와 iMonnit 관제로 구성합니다. 수량·위치는 현장 확인 후 정해집니다.', 'Configured with 940MHz wireless gateways (Korea) and iMonnit monitoring. Quantities and locations are confirmed on site.') + '</p></details>' +
    '<details class="mkps-acc"><summary>' + L('입력하신 내용', 'Your request') + '</summary><div><div class="mkp-chips">' +
      v.problems.map(function (t) { return '<span class="mkp-chip is-static" aria-pressed="true">' + esc(t) + '</span>'; }).join('') +
      v.goals.map(function (t) { return '<span class="mkp-chip is-static">' + esc(t) + '</span>'; }).join('') +
      '</div>' + (v.facility ? '<p class="mkps-small">' + L('시설 · ', 'Site · ') + esc(v.facility) + '</p>' : '') +
      '<p class="mkps-small">' + L('바꾸실 내용이 있으면 메일에 회신해 주세요. 담당자가 반영해 드립니다.', 'To change anything, simply reply to our email.') + '</p></div></details>' +

    '<div class="mkps-share"><div><b>' + L('다른 현장을 맡은 동료에게도 필요할까요?', 'Could a colleague use one for another site?') + '</b><small>' + L('신청 페이지 주소만 전달됩니다. 입력하신 정보는 공유되지 않습니다.', 'Only the request page link is shared — never your details.') + '</small></div>' +
      '<button type="button" class="mkp-btn is-ghost" id="ppsShare">' + L('신청 페이지 링크 공유', 'Share request page') + '</button>' +
      '<button type="button" class="mkp-btn is-ghost" data-pgo="proposal">' + L('다른 현장도 신청하기', 'Request for another site') + '</button></div>' +
    '<p class="mkps-small">' + L('이 화면은 신청하신 분의 브라우저에서만 열립니다. 주식회사 모넷코리아 · ' + TEL + ' · korea@monnit.com', 'This page opens only in the browser used for the request. Monnit Korea · +82-2-2088-1454 · korea@monnit.com') + '</p>';

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
    var set = function () { fill.style.width = p.pct + '%'; rider.style.left = p.pct + '%'; };
    if (first) { fill.style.width = '0%'; rider.style.left = '0%'; setTimeout(set, 350); } else set();

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
      '<div class="mkps-scope-h"><span class="nh-eyebrow">What\'s included</span><h3>' + L('이 제안서는 <em>「' + esc(sc.problems.join(', ')) + '」</em> 기준입니다', 'This proposal focuses on <em>“' + esc(sc.problems.join(', ')) + '”</em>') + '</h3>' +
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
    var now = Date.now(), created = S.demoT0, span = 150000, due = created + span, tt = Math.min(1, (now - created) / span);
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
        stages: ST.map(function (st, i) { return { key: i, label: st[0], sub: st[1], state: sent || i < idx ? 'done' : i === idx ? 'now' : 'wait', at: sent || i < idx ? fmt(created + AT[i] * span) : '' }; })
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
