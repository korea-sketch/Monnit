/*! Monnit Korea — 맞견적(/match) 화면 v4 (2026-11-16)
 *  견적서 사진·PDF 를 고르면 ① 원본을 올리고(/api/match/upload) ② AI 가 품목을 읽어(/api/match/read)
 *  ③ 같은 조건의 모넷 구성과 나란히 보여 준다. 읽는 동안의 단계 표시는 실제 진행 상태다.
 *  읽지 못하면 「담당자 확인」으로 안내한다. 연락처는 명세·정식 견적을 원하는 사람만 남긴다(/api/match/save + /api/lead). */
(function (w, d) {
  'use strict';
  var PAGE = 'match', INTEREST = '맞견적(견적 비교)', MAX = 8 * 1024 * 1024, LIMIT = 8, READS = 2;
  var $ = function (s) { return d.querySelector(s); };
  var newCid = function () { return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 18); };
  var CID = newCid(), okCount = 0, last = null, running = false;
  var calm = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var won = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ev = function (n, l) { try { w.dataLayer = w.dataLayer || []; w.dataLayer.push({ event: n, form_name: PAGE, label: l || '' }); } catch (e) {} try { if (w.MonnitTrack) w.MonnitTrack.event(n, { l: l || '' }); } catch (e) {} };
  var val = function (id) { return $('#' + id).value.trim(); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, calm ? 0 : ms); }); };
  var KIND = { sensor: '센서', gateway: '수집·통신 장비', platform: '플랫폼·소프트웨어', construction: '공사·설치', maintenance: '유지보수', comm: '통신비', etc: '기타' };
  var ORDER = ['sensor', 'gateway', 'platform', 'construction', 'maintenance', 'comm', 'etc'];

  /* ── 파일 준비 ── */
  var isImg = function (f) { return /^image\/(jpeg|png|webp)$/.test(f.type); };
  var isPdf = function (f) { return /pdf/.test(f.type) || /\.pdf$/i.test(f.name || ''); };
  function toJpeg(file, side, q) {   /* 긴 변 side px 의 JPEG Blob */
    return w.createImageBitmap(file).then(function (bm) {
      var k = Math.min(1, side / Math.max(bm.width, bm.height)), c = d.createElement('canvas');
      c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', q); });
    });
  }
  function b64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); }); }
  function upload(file) {   /* 원본 보관 — 큰 사진만 줄인다 */
    var body = (isImg(file) && file.size > 1.2 * 1024 * 1024 && w.createImageBitmap) ? toJpeg(file, 2400, 0.85).then(function (b) { return b && b.size < file.size ? b : file; }).catch(function () { return file; }) : Promise.resolve(file);
    return body.then(function (b) {
      if (b.size > MAX) return { ok: false, error: '8MB 이하만 올릴 수 있습니다' };
      return fetch('/api/match/upload', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/octet-stream', 'x-cid': CID, 'x-name': encodeURIComponent((file.name || '').slice(0, 80)) }, body: b }).then(function (r) { return r.json(); });
    }).catch(function () { return { ok: false, error: '올리지 못했습니다' }; });
  }
  function read(file) {   /* AI 읽기 — 읽을 수 없는 형식이면 null */
    var p = isImg(file) && w.createImageBitmap ? toJpeg(file, 1800, 0.82).then(b64).then(function (s) { return { s: s, t: 'jpg' }; })
      : isPdf(file) && file.size < 3.6 * 1024 * 1024 ? b64(file).then(function (s) { return { s: s, t: 'pdf' }; }) : Promise.resolve(null);
    return p.then(function (x) {
      if (!x || !x.s) return null;
      return fetch('/api/match/read', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'text/plain', 'x-cid': CID, 'x-type': x.t }, body: x.s }).then(function (r) { return r.json(); });
    }).catch(function () { return null; });
  }

  /* ── 단계 표시 ── */
  function step(name, state, note) {
    var li = $('#steps li[data-s=' + name + ']'); if (!li) return;
    li.className = state; var sp = li.querySelector('span');
    if (note != null) { var sm = li.querySelector('small') || sp.appendChild(d.createElement('small')); sm.textContent = note; }
  }
  function chips(items) {   /* 읽은 품목이 하나씩 떠오른다 */
    var box = $('#found'); box.textContent = '';
    return items.slice(0, 14).reduce(function (p, it, i) {
      return p.then(function () { var s = d.createElement('span'); s.innerHTML = '<b>' + esc(KIND[it.kind] || '') + '</b>' + esc(it.name); box.appendChild(s); return wait(i < 8 ? 110 : 50); });
    }, Promise.resolve()).then(function () { if (items.length > 14) { var m = d.createElement('span'); m.textContent = '외 ' + (items.length - 14) + '줄'; box.appendChild(m); } });
  }
  function countUp(el, to, suffix) {
    if (calm || !w.requestAnimationFrame) { el.innerHTML = won(to) + suffix; return; }
    var t0 = null, dur = 900;
    (function f(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.innerHTML = won(to * e) + suffix; if (k < 1) w.requestAnimationFrame(f); })(w.performance.now());
  }

  function start(list) {
    var files = [].slice.call(list || []).slice(0, LIMIT);
    if (!files.length || running) return;
    running = true; last = null; okCount = 0;
    $('#drop').hidden = true; $('#result').hidden = true; $('#facts').hidden = true; $('#done').hidden = true; $('#formCard').hidden = false;
    var scan = $('#scan'); scan.hidden = false; $('#found').textContent = ''; $('#cav0').hidden = true; $('#cav1').hidden = false;
    ['up', 'read', 'sort', 'conv'].forEach(function (s) { step(s, '', ''); });
    var shot = $('#shot'); shot.className = 'shot'; shot.style.backgroundImage = ''; shot.firstChild && (shot.childNodes[0].nodeType === 3) && shot.removeChild(shot.childNodes[0]);
    var first = files[0];
    if (/^image\//.test(first.type)) { try { shot.style.backgroundImage = 'url(' + URL.createObjectURL(first) + ')'; } catch (e) {} }
    $('#shotCnt').textContent = files.length > 1 ? files.length + '개' : (isPdf(first) ? 'PDF' : '');
    try { scan.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
    ev('match_upload', String(files.length));

    step('up', 'on');
    var ups = Promise.all(files.map(upload));
    var readable = files.filter(function (f) { return isImg(f) || isPdf(f); }).slice(0, READS);
    var res = null;
    Promise.all([ups, wait(700)]).then(function (a) {
      var oks = a[0].filter(function (r) { return r && r.ok; }); okCount = oks.length;
      if (!okCount) { var e = (a[0][0] && a[0][0].error) || '올리지 못했습니다'; throw new Error(e); }
      step('up', 'ok', okCount + '개'); step('read', 'on');
      /* 여러 장이면 차례로 읽는다 — 서버가 같은 화면의 품목을 이어 붙여 돌려준다 */
      return readable.reduce(function (p, f, i) {
        return p.then(function () { if (readable.length > 1) step('read', 'on', (i + 1) + ' / ' + readable.length + '장'); return read(f); }).then(function (r) { if (r && r.ok && !r.review) res = r; });
      }, Promise.resolve());
    }).then(function () {
      if (!res) { step('read', 'ok', '자동 판독 안 됨'); return wait(300).then(function () { review(); }); }
      step('read', 'ok', res.items.length + '줄'); step('sort', 'on');
      return chips(res.items).then(function () { step('sort', 'ok'); step('conv', 'on'); return wait(650); }).then(function () {
        step('conv', 'ok'); $('#shot').className = 'shot done'; return wait(450);
      }).then(function () { paint(res); ev('match_convert', res.verdict); });
    }).catch(function (e) {
      $('#scan').hidden = true; $('#drop').hidden = false; $('#facts').hidden = false; $('#cav1').hidden = true; $('#cav0').hidden = false;
      $('#use').textContent = (e && e.message && e.message.length < 60 ? e.message : '올리지 못했습니다') + ' — 다시 시도해 주세요.'; $('#use').style.color = 'var(--dn)';
    }).then(function () { running = false; });
  }

  /* ── 결과 ── */
  /* 모넷 금액은 구간으로만 온다(서버가 정확한 금액·단가를 내보내지 않는다) */
  function man(n) { n = Math.round((Number(n) || 0) / 1e4); if (n >= 1e4) { var e = Math.floor(n / 1e4), m = n % 1e4; return e + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : ''); } return n.toLocaleString('ko-KR') + '만'; }
  function span(a) { return a[1] > 0 ? '<span class="rg">' + man(a[0]) + '<i>~</i>' + man(a[1]) + '</span>' : '0'; }
  /* 숫자가 이전 값에서 새 값으로 굴러간다 — a·b 는 숫자 배열(구간이면 2개) */
  function tween(el, from, to, fmt) {
    if (calm || !w.requestAnimationFrame || !from) { el.innerHTML = fmt(to); return; }
    var t0 = null, dur = 650; el._tw = (el._tw || 0) + 1; var me = el._tw;
    (function f(t) { if (el._tw !== me) return; if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = fmt(to.map(function (v, i) { return (from[i] || 0) + (v - (from[i] || 0)) * e; })); if (k < 1) w.requestAnimationFrame(f); else el.innerHTML = fmt(to); })(w.performance.now());
  }
  var R = null, Y = 3, prev = null;
  function view() { var a = R.alt && R.alt[Y]; return a || R; }

  /* ── 누적 비용 그래프 (SVG) ── */
  var CH = { W: 640, H: 290, L: 58, Rt: 18, T: 16, B: 36 };
  function xs(y) { return CH.L + (CH.W - CH.L - CH.Rt) * y / 5; }
  function drawChart() {
    var c = R.curve, svg = $('#chartSvg'); if (!c || !c.length) { svg.parentNode.parentNode.hidden = true; return; }
    svg.parentNode.parentNode.hidden = false;
    /* 좁은 화면에서는 그래프를 더 높게, 글자·선을 더 굵게 (viewBox 단위라 화면 폭에 맞춰 같이 줄어든다) */
    var nar = (w.innerWidth || 1000) < 680; CH.nar = nar; CH.H = nar ? 440 : 290; CH.L = nar ? 104 : 58; CH.B = nar ? 56 : 36; CH.T = nar ? 24 : 16; CH.Rt = nar ? 26 : 18;
    svg.setAttribute('viewBox', '0 0 ' + CH.W + ' ' + CH.H); svg.setAttribute('class', nar ? 'nar' : '');
    var mx = Math.max.apply(null, c.map(function (p) { return Math.max(p.t, p.o[1]); })) * 1.1 || 1;
    var ys = function (v) { return CH.T + (CH.H - CH.T - CH.B) * (1 - v / mx); };
    CH.ys = ys;
    var pt = function (f) { return c.map(function (p) { return xs(p.y).toFixed(1) + ',' + ys(f(p)).toFixed(1); }); };
    var hi = pt(function (p) { return p.o[1]; }), lo = pt(function (p) { return p.o[0]; }), th = pt(function (p) { return p.t; });
    var h = '<defs><linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5CE0C2" stop-opacity=".5"/><stop offset="1" stop-color="#5CE0C2" stop-opacity=".16"/></linearGradient>'
      + '<linearGradient id="gGap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FB0D6" stop-opacity=".2"/><stop offset="1" stop-color="#9FB0D6" stop-opacity="0"/></linearGradient>'
      + '<clipPath id="cReveal"><rect id="cRect" x="0" y="0" width="0" height="' + CH.H + '"/></clipPath></defs>';
    for (var g = 0; g <= 4; g++) { var v = mx / 1.1 * g / 4, yy = ys(v); h += '<line class="gl" x1="' + CH.L + '" x2="' + (CH.W - CH.Rt) + '" y1="' + yy + '" y2="' + yy + '"/><text x="' + (CH.L - (nar ? 12 : 8)) + '" y="' + (yy + (nar ? 8 : 4)) + '" text-anchor="end">' + (v ? man(v) : '0') + '</text>'; }
    c.forEach(function (p) { h += '<text class="xl" data-y="' + p.y + '" x="' + xs(p.y) + '" y="' + (CH.H - (nar ? 18 : 12)) + '" text-anchor="middle">' + (p.y ? p.y + '년' : '도입') + '</text>'; });
    h += '<g clip-path="url(#cReveal)"><polygon class="gap" points="' + th.join(' ') + ' ' + hi.slice().reverse().join(' ') + '"/>'
      + '<polygon class="band" points="' + hi.join(' ') + ' ' + lo.slice().reverse().join(' ') + '"/><polyline class="edge" points="' + hi.join(' ') + '"/><polyline class="edge" points="' + lo.join(' ') + '"/>'
      + '<polyline class="their" points="' + th.join(' ') + '"/></g>'
      + '<g class="mk" id="mk"><line class="cross" x1="0" x2="0" y1="' + CH.T + '" y2="' + (CH.H - CH.B) + '"/><line class="barO" id="mkO" x1="0" x2="0" y1="0" y2="0"/><circle class="dotT" id="mkT" cx="0" cy="0" r="5.5"/></g>';
    svg.innerHTML = h;
    var rect = svg.querySelector('#cRect');
    if (calm || !w.requestAnimationFrame) rect.setAttribute('width', CH.W);
    else { var t0 = null; (function f(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - k, 3); rect.setAttribute('width', CH.W * e); if (k < 1) w.requestAnimationFrame(f); })(w.performance.now()); }
    pin(Y, false);
  }
  function pin(y, tip) {   /* 표시선·점을 y 년으로 옮기고, tip 이면 말풍선도 */
    var c = R && R.curve; if (!c || !CH.ys) return; var p = c[y]; if (!p) return;
    $('#mk').style.transform = 'translateX(' + xs(y) + 'px)';
    $('#mkT').setAttribute('cy', CH.ys(p.t)); $('#mkO').setAttribute('y1', CH.ys(p.o[1])); $('#mkO').setAttribute('y2', CH.ys(p.o[0]));
    [].forEach.call(d.querySelectorAll('#chartSvg .xl'), function (t) { t.setAttribute('class', 'xl' + (+t.getAttribute('data-y') === y ? ' on' : '')); });
    var tp = $('#tip'); if (!tip) { tp.hidden = true; return; }
    var dl = p.t - p.o[1], dh = p.t - p.o[0];
    tp.innerHTML = '<b>' + (y ? y + '년 운영 시점' : '도입 시점') + '</b><div><i style="background:#9FB0D6"></i>받으신 견적 ' + man(p.t) + '원</div><div><i style="background:#5CE0C2"></i>모넷 예상 ' + man(p.o[0]) + '~' + man(p.o[1]) + '원</div>'
      + (dl > 0 ? '<div>차이 <em>약 ' + man(dl) + '~' + man(dh) + '원</em></div>' : '<div>차이는 구성 확인 후 안내</div>');
    tp.hidden = false;
    var box = $('#chart').getBoundingClientRect(), px = xs(y) / CH.W * box.width, tw = tp.offsetWidth;
    tp.style.left = Math.max(0, Math.min(box.width - tw, px > box.width / 2 ? px - tw - 14 : px + 14)) + 'px';
  }
  (function () {
    var svg = $('#chartSvg'), near = function (e) { var b = svg.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * CH.W; return Math.max(0, Math.min(5, Math.round((x - CH.L) / (CH.W - CH.L - CH.Rt) * 5))); };
    svg.addEventListener('pointermove', function (e) { if (R) pin(near(e), true); });
    svg.addEventListener('pointerdown', function (e) { if (!R) return; var y = near(e); pin(y, true); if (y === 1 || y === 3 || y === 5) setYear(y); });
    svg.addEventListener('pointerleave', function () { if (R) pin(Y, false); });
    d.addEventListener('pointermove', function (e) { var c = e.target.closest && e.target.closest('.side,.chart-card'); if (!c) return; var b = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - b.left) + 'px'); c.style.setProperty('--my', (e.clientY - b.top) + 'px'); });
    $('#yrs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && R) { setYear(+b.dataset.y); ev('match_years', b.dataset.y); } });
    var bars = $('#barsBox');
    var act = function (k) { bars.classList.toggle('hov', !!k); [].forEach.call(d.querySelectorAll('.bar-row'), function (r) { r.classList.toggle('act', r.dataset.k === k); }); [].forEach.call(d.querySelectorAll('#map tbody tr,#items tbody tr'), function (r) { r.classList.toggle('act', !!k && r.dataset.k === k); }); };
    bars.addEventListener('pointerover', function (e) { var r = e.target.closest('.bar-row'); if (r && e.pointerType === 'mouse') act(r.dataset.k); });
    bars.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') act(''); });
    bars.addEventListener('click', function (e) { var r = e.target.closest('.bar-row'); if (!r) return; var on = r.classList.contains('act') && bars.classList.contains('hov'); act(on ? '' : r.dataset.k); if (!on) { var t = d.querySelector('#items tbody tr[data-k=' + r.dataset.k + ']'); if (t && e.pointerType !== 'mouse') try { t.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); } catch (x) {} } });
  })();
  function pill() { var b = d.querySelector('#yrs button.on'), p = d.querySelector('#yrs .pill'); if (b && p) { p.style.width = b.offsetWidth + 'px'; p.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)'; } }
  w.addEventListener('resize', function () { pill(); if (R && !$('#result').hidden) { if (((w.innerWidth || 1000) < 680) !== CH.nar) drawChart(); else pin(Y, false); } });
  function setYear(y) { if (y === Y && prev) return; Y = y; render(); pin(Y, false); }

  /* ── 결과 그리기 — 운영 기간(Y)에 맞는 묶음으로 ── */
  function render() {
    var r = view(), y = r.years, T = r.theirs, O = r.ours, D = r.diff, P = r.pct, vd = r.verdict;
    [].forEach.call(d.querySelectorAll('#yrs button'), function (b) { b.classList.toggle('on', +b.dataset.y === Y); b.setAttribute('aria-pressed', +b.dataset.y === Y ? 'true' : 'false'); }); pill();
    var v = $('#verdict'), vs = $('#verdictSub');
    var one = r.oneSided > 0 ? ' 받으신 견적서의 유지보수·기타 ' + won(r.oneSided) + '원은 모넷 구성에 대응 항목이 없어 차이에서 뺐습니다.' : '';
    var base = '가정: 센서 ' + R.points + '개 · 게이트웨이 ' + R.gateways + '대(현장 ' + R.opts.sites + '곳, 수신 범위 안) · ' + y + '년 운영 · ' + R.vat + '.';
    if (vd === 'lower') { v.innerHTML = y + '년 총비용 예상, 모넷 구성이 <span class="mint">약 ' + man(D[0]) + '~' + man(D[1]) + '원(' + P[0] + '~' + P[1] + '%) 낮은 구간</span>으로 계산됩니다. <span class="est">예상</span>'; vs.textContent = base + one; }
    else if (vd === 'similar') { v.innerHTML = y + '년 총비용은 두 구성이 비슷한 구간으로 예상됩니다. <span class="est">예상</span>'; vs.textContent = base + ' 구성에 따라 낮아질 수도, 높아질 수도 있어 담당자 확인이 필요합니다.' + one; }
    else if (vd === 'higher') { v.innerHTML = '읽은 조건에서는 모넷 구성이 더 높은 구간으로 예상됩니다. <span class="est">예상</span>'; vs.textContent = base + ' 품목 대응이나 수량이 실제와 다를 수 있어 담당자 확인이 필요합니다.' + one; }
    else { v.textContent = '일부 품목은 담당자 확인이 필요해 구간을 확정하지 못했습니다.'; vs.textContent = '확인이 필요한 품목: ' + R.unpriced.join(', ') + ' — 아래 모넷 구간에는 이 품목이 빠져 있습니다. ' + base; }
    var dl = function (a) { return a.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join(''); };
    $('#tD').innerHTML = dl([['초기 비용', won(T.init) + '원'], ['매년 비용', won(T.yearly) + '원']]);
    $('#oD').innerHTML = dl([['초기 비용', span(O.init) + '원'], ['매년 비용', span(O.yearly) + '원' + (O.firstYearFree ? ' (첫 해 면제)' : '')]]);
    var sfx = '<small>원 · ' + y + '년</small>';
    tween($('#tT'), prev ? [prev.t] : [0], [T.tco], function (a) { return won(a[0]) + sfx; });
    tween($('#oT'), prev ? prev.o : [0, 0], O.tco, function (a) { return span(a) + '<small>원 · ' + y + '년' + (vd === 'partial' ? ' (일부 제외)' : '') + '</small>'; });
    prev = { t: T.tco, o: O.tco };
    /* 종류별 막대 — 한 번 만든 줄을 그대로 두고 길이와 숫자만 바꾼다(기간을 바꾸면 막대가 움직인다) */
    var box = $('#bars'), all = ORDER.filter(function (k) { return [1, 3, 5].some(function (yy) { var a = (R.alt && R.alt[yy]) || R, t = a.theirs.byKind[k]; return t.init + t.yearly * a.years > 0 || a.ours.byKind[k][1] > 0; }); });
    if (box.dataset.k !== all.join()) {
      box.dataset.k = all.join();
      box.innerHTML = all.map(function (k) { return '<div class="bar-row" data-k="' + k + '"><div class="lb">' + KIND[k] + '</div><div class="pair"><div class="t"><i style="width:0"></i><span></span></div><div class="o"><i style="width:0"></i><i class="hi" style="width:0"></i><span></span></div></div></div>'; }).join('');
      [].forEach.call(box.children, function (el, i) { setTimeout(function () { el.classList.add('in'); }, calm ? 0 : 250 + i * 110); });
    }
    var rows = all.map(function (k) { var t = T.byKind[k]; return { k: k, t: t.init + t.yearly * y, o: O.byKind[k] }; });
    var mx = Math.max.apply(null, rows.map(function (x) { return Math.max(x.t, x.o[1]); }).concat([1]));
    var wd = function (n) { return Math.max(n > 0 ? 1 : 0, Math.round(n / mx * 100)) * 0.64; };
    setTimeout(function () { rows.forEach(function (x) { var el = box.querySelector('[data-k=' + x.k + ']'), is = el.querySelectorAll('i'), sp = el.querySelectorAll('span');
      is[0].style.width = wd(x.t) + '%'; is[1].style.width = wd(x.o[0]) + '%'; is[2].style.width = Math.max(0, wd(x.o[1]) - wd(x.o[0])) + '%';
      sp[0].textContent = won(x.t) + '원'; sp[1].textContent = x.o[1] > 0 ? man(x.o[0]) + '~' + man(x.o[1]) + '원' : '0원'; }); }, calm ? 0 : 420);
    if (!R.id) $('#ctaTxt').textContent = vd === 'lower' ? '예상 ' + man(D[0]) + '~' + man(D[1]) + '원 차이' : '예상 비교 결과';
  }
  function paint(r) {
    R = r; last = r; Y = r.years || 3; prev = null; $('#bars').dataset.k = '';
    $('#mapAmtH').textContent = '금액';
    $('#map tbody').innerHTML = r.map.map(function (m) {
      var tAmt = (m.theirAmt ? won(m.theirAmt) + '원' : '') + (m.theirYearly ? (m.theirAmt ? '<br>' : '') + '매년 ' + won(m.theirYearly) + '원' : '') || '-';
      var oAmt = m.priced === false ? '<span class="tag">담당자 확인</span>' : '<span class="tag p">정식 견적서</span>';
      return '<tr data-k="' + m.kind + '"><td class="k">' + KIND[m.kind] + '</td><td>' + esc(m.their) + '</td><td class="n">' + tAmt + '</td><td>' + esc(m.ours) + (m.note ? '<div class="nt">' + esc(m.note) + '</div>' : '') + '</td><td class="n">' + (m.qty || '-') + '</td><td class="n">' + oAmt + '</td></tr>';
    }).join('');
    /* 읽은 품목 한 줄씩 — 고객 견적의 금액은 그대로, 모넷 쪽은 무엇으로 바뀌는지 이름만 */
    var its = r.items || [], one0 = 0, yr0 = 0;
    its.forEach(function (l) { if (l.period === 'month') yr0 += l.amount * 12; else if (l.period === 'year') yr0 += l.amount; else one0 += l.amount; });
    $('#itN').textContent = its.length + '줄';
    $('#itSum').textContent = '1회 ' + won(one0) + '원' + (yr0 ? ' · 매년 ' + won(yr0) + '원' : '');
    $('#items tbody').innerHTML = its.map(function (l) {
      return '<tr data-k="' + l.kind + '"><td>' + esc(l.name) + '</td><td><span class="kd ' + l.kind + '">' + KIND[l.kind] + '</span></td><td class="n">' + l.qty + '</td><td class="n">' + won(l.amount) + '원' + (l.period === 'month' ? '/월' : l.period === 'year' ? '/년' : '') + '</td><td class="ou">' + esc(l.ours) + (l.check ? '<small>담당자 확인 필요</small>' : '') + '</td></tr>';
    }).join('');
    [].forEach.call(d.querySelectorAll('#items tbody tr'), function (tr, i) { setTimeout(function () { tr.classList.add('in'); }, calm ? 0 : 500 + Math.min(i, 20) * 70); });
    var nt = $('#itNote'), off = r.stated > 0 && Math.abs(r.stated - one0) / r.stated > 0.02 && Math.abs(r.stated - one0 * 1.1) / r.stated > 0.02;
    nt.className = 'it-note' + (off ? ' warn' : '');
    nt.textContent = off ? '견적서에 적힌 합계(' + won(r.stated) + '원)와 읽은 품목의 합계가 다릅니다. 빠지거나 잘못 읽은 줄이 있을 수 있어 담당자가 원본과 대조합니다.' : '자동으로 읽은 내용입니다. 품명·수량·금액이 원본과 다른 줄이 있으면 담당자가 원본과 대조해 바로잡습니다.';
    $('#notice').textContent = '모넷 금액은 예상 구간이며 정식 견적이 아닙니다. 품목별 단가와 확정 금액은 센서 용도·게이트웨이 수신 범위·수량을 확인한 뒤 정식 견적서로 안내합니다. 견적서는 자동으로 읽은 것이라 실제와 다를 수 있습니다. ' + (r.disclaimer || '') + (r.platformCap ? ' 플랫폼 비용은 연 구독이며 ' + won(r.platformCap) + '원을 넘지 않습니다.' : '');
    $('#resBody').hidden = false; $('#btnPrint').hidden = !r.id; $('#cav2').hidden = false; $('#f-ack').closest('label').hidden = false;
    var box = $('#result'); box.hidden = false; box.className = 'rise';
    render(); drawChart();
    if (!r.id) $('#ctaBar').classList.add('show');
    try { box.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); } catch (e) {}
  }
  function review() {   /* 자동으로 읽지 못한 경우 — 파일은 이미 받았다 */
    last = null;
    $('#verdict').textContent = '견적서는 잘 받았습니다. 자동으로 읽지 못해 담당자가 직접 확인하겠습니다.';
    $('#verdictSub').textContent = '연락처를 남겨 주시면 같은 조건의 모넷 구성 비교표와 견적서를 보내 드립니다.';
    $('#resBody').hidden = true; $('#btnPrint').hidden = true; $('#cav2').hidden = true; $('#f-ack').closest('label').hidden = true;
    $('#formH').textContent = '비교표 받기'; $('#formP').textContent = '원하지 않으시면 여기서 닫으셔도 됩니다.'; $('#submitBtn').textContent = '비교표 받기';
    var box = $('#result'); box.hidden = false; box.className = 'rise';
    try { box.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); } catch (e) {}
    ev('match_convert', 'review');
  }

  var input = $('#file'), drop = $('#drop');
  input.addEventListener('change', function () { start(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (n) { d.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { d.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  d.addEventListener('drop', function (e) { if (!drop.hidden) start(e.dataTransfer && e.dataTransfer.files); });
  d.addEventListener('paste', function (e) { var f = e.clipboardData && e.clipboardData.files; if (f && f.length && !drop.hidden) start(f); });
  $('#again').addEventListener('click', function () {
    CID = newCid(); last = null; $('#result').hidden = true; $('#scan').hidden = true; $('#ctaBar').classList.remove('show');
    drop.hidden = false; $('#facts').hidden = false; $('#cav1').hidden = true; $('#cav0').hidden = false; $('#f-ack').checked = false; try { drop.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
  });
  $('#btnPrint').addEventListener('click', function () { ev('match_print'); w.print(); });
  $('#ctaBtn').addEventListener('click', function (e) { e.preventDefault(); try { $('#formCard').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); $('#f-co').focus({ preventScroll: true }); } catch (x) {} });

  /* ── 연락처 (선택) → 명세 + 접수 ── */
  var f = $('#inq'), err = $('#err');
  var mark = function (id, bad) { var el = $('#' + id); el.classList.toggle('bad', !!bad); el.setAttribute('aria-invalid', bad ? 'true' : 'false'); };
  f.addEventListener('input', function (e) { if (e.target.classList) { e.target.classList.remove('bad'); e.target.removeAttribute('aria-invalid'); } });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#submitBtn'); if (btn.disabled) return;
    var V = w.MonnitValid, telR = V && V.phone ? V.phone(val('f-tel')) : null;
    var telOk = telR ? !!telR.ok : /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(val('f-tel').replace(/\s/g, ''));
    var miss = [];
    mark('f-co', !val('f-co')); mark('f-name', !val('f-name')); mark('f-tel', !telOk);
    if (!val('f-co')) miss.push('회사·기관명'); if (!val('f-name')) miss.push('담당자명'); if (!telOk) miss.push('연락처');
    if (miss.length) { err.textContent = miss.join(', ') + '을(를) 확인해 주세요.'; var b = f.querySelector('.bad'); if (b) b.focus(); return; }
    if (!$('#f-agree').checked) { err.textContent = '[필수] 개인정보 수집·이용에 동의해 주세요.'; return; }
    if (!$('#f-ack').closest('label').hidden && !$('#f-ack').checked) { err.textContent = '[필수] 예상 금액이며 정식 견적은 달라질 수 있음을 확인해 주세요.'; try { $('#f-ack').focus(); } catch (x) {} return; }
    err.textContent = '';
    var label = btn.textContent; btn.disabled = true; btn.textContent = '보내는 중…';
    var contact = { company: val('f-co'), name: val('f-name'), phone: val('f-tel') };
    fetch('/api/match/save', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'request', lines: [], contact: contact, cid: CID, ack: $('#f-ack').checked }) })
      .then(function (r) { return r.json(); }).catch(function () { return null; })
      .then(function (r) {
        var id = (r && r.id) || '', s = r && r.theirs ? r : last;
        var sum = s ? ' ' + s.years + '년 총비용 — 받은 견적 ' + won(s.theirs.tco) + '원 / 고객 화면에 보인 모넷 예상 구간 ' + man(s.ours.tco[0]) + '~' + man(s.ours.tco[1]) + '원' + (s.verdict === 'partial' ? ' (부분 산정)' : '') + ' — AI 판독 기준 · 원본 대조 필요, 정확한 계산값은 관제에서 확인.' : ' 자동 판독이 되지 않아 원본 확인이 필요합니다.';
        var payload = {
          _subject: '[맞견적 비교 신청] ' + contact.company + ' / ' + contact.name,
          '관심분야': INTEREST, '회사명': contact.company, '담당자명': contact.name, '전화번호': contact.phone,
          '문의 사항': '[맞견적 ' + (id || '번호 없음') + '] 견적서 파일 ' + okCount + '개.' + sum + ' ※ 고객에게 예상 금액으로 안내됨(용도·수신 범위 확인 후 변동 가능 고지 · 고객 확인 체크).' + ' 파일과 읽은 품목은 관제(/ops/enablement) 「올린 견적서」에서 확인합니다.',
          '예상 금액 고지 확인(필수)': '확인 — 센서 용도·게이트웨이 수신 범위 확인 후 정식 견적 금액이 달라질 수 있음', '개인정보 수집·이용 동의(필수)': '동의', '동의 일시': new Date().toLocaleString('ko-KR'), '접수 경로': '맞견적(/match)'
        };
        var ML = w.MonnitLead;
        try { if (ML) ML.build('contact', PAGE, '맞견적 비교 신청 — ' + contact.company, payload); else { payload['접점'] = PAGE; payload['유입 페이지'] = String(location.href).split('#')[0]; } } catch (x) {}
        return (ML && ML.submit ? Promise.resolve().then(function () { ML.setNotified(false); return ML.submit(payload); }).catch(function () { return false; }) : Promise.resolve(false))
          .then(function (served) { try { if (ML) { if (served) ML.track('contact', { page: PAGE, interest: INTEREST }); else ML.recordPending(payload); } } catch (x) {} return { r: r, id: id, served: served }; });
      })
      .then(function (o) {
        btn.disabled = false; btn.textContent = label;
        var r = o.r;
        if (!o.served && !(r && r.ok)) { err.textContent = '전송하지 못했습니다. 잠시 후 다시 시도하시거나 전화로 문의해 주세요.'; return; }
        ev('match_request');
        var hasDetail = !!(r && r.ok && r.theirs);
        if (hasDetail) { if (!r.items || !r.items.length) r.items = (last && last.items) || []; paint(r); }
        $('#formCard').hidden = true; $('#ctaBar').classList.remove('show');
        $('#doneH').textContent = o.id ? '접수되었습니다 · 접수번호 ' + o.id : '접수되었습니다';
        $('#doneMsg').textContent = contact.company + ' · ' + contact.name + ' 님, ' + '' + '담당자가 원본 견적서와 대조한 뒤, 품목별 단가와 확정 금액이 담긴 정식 견적서를 남겨 주신 연락처로 보내 드립니다.';
        $('#done').hidden = false;
      });
  });
})(window, document);
