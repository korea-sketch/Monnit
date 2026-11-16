/*! Monnit Korea — 모니 「사용 중 문제 해결」 + 자주 묻는 질문 페이지 v1 (2026-10-20)
 *
 *  흐름 (고객이 화나지 않게 설계한 순서)
 *    ① 공감 한 줄 → 증상 고르기 / 편하게 적기         (먼저 들어 준다)
 *    ② 쉬운 점검부터 — 단계마다 「해 봤어요」 체크      (통제감·진행감)
 *    ③ 해결됐어요 / 아직 안 돼요 — 고객이 판단           (막다른 길 없음)
 *    ④ 안 되면 한 번만 다른 원인 제안 → 그다음은 접수    (같은 질문 반복 금지)
 *    ⑤ 접수 시 대화·해 본 조치 자동 첨부                (다시 설명시키지 않는다)
 *    ⑥ 접수번호 + 다음 단계 안내                        (기다림의 불안 줄이기)
 *   · 어느 화면에서든 「바로 담당자에게 접수」가 보인다  (강제 루프 금지)
 *   · 화난 말·사람 찾는 말·긴급한 말은 점검표보다 접수를 먼저 보여 준다
 *   · 전화번호는 보여 주지 않는다 — 마지막 창구는 접수 하나 (2026-10-20 결정)
 *
 *  쓰는 곳
 *    MKSupport.mount(el, { onHome })     모니 패널 안 (js/proposal-chat.js 가 부름)
 *    MKSupport.ask(text)                 모니 입력창에서 보낸 말
 *    MKSupport.renderFaq(el)             /faqs 페이지 (app.js renderFaqs 가 부름)
 *  데이터: window.MKSupportKB (js/support-kb.js · 자동 생성)
 *  기록:   dataLayer support_* 이벤트 · 접수는 MonnitLead → /api/lead (관제·메일·먼데이)
 */
(function (w, d) {
  'use strict';
  if (w.MKSupport) return;

  var KB_SRC = '/js/support-kb.js?v=2', LEAD_SRC = '/js/monnit-lead.js?v=6', API = '/api/support/chat';
  var KEY = 'mk_support_v1';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var track = function (e, o) { try { (w.dataLayer = w.dataLayer || []).push(Object.assign({ event: e }, o || {})); } catch (_) {} };
  var ss = { get: function (k) { try { return w.sessionStorage.getItem(k); } catch (_) { return null; } }, set: function (k, v) { try { w.sessionStorage.setItem(k, v); } catch (_) {} }, del: function (k) { try { w.sessionStorage.removeItem(k); } catch (_) {} } };

  function load(src, test, cb) {
    if (test()) return cb();
    var s = d.createElement('script'); s.src = src; s.async = true;
    s.onload = function () { cb(); }; s.onerror = function () { cb(); };
    d.head.appendChild(s);
  }
  var _kbWait = [];
  function ensure(cb) {
    if (w.MKSupportKB) return cb(w.MKSupportKB);
    _kbWait.push(cb); if (_kbWait.length > 1) return;
    load(KB_SRC, function () { return !!w.MKSupportKB; }, function () { var q = _kbWait; _kbWait = []; q.forEach(function (f) { try { f(w.MKSupportKB); } catch (e) { console.warn('[support]', e); } }); });
  }
  function ensureLead(cb) { load(LEAD_SRC, function () { return !!w.MonnitLead; }, cb); }

  /* ── 상태 ─────────────────────────────────────────────────────── */
  var S = null, root = null, opts = {};
  function fresh() { return { log: [], tried: {}, seen: [], fails: 0, cat: '', symptom: '', ticket: null, done: null, started: Date.now(), T0: Date.now() }; }
  function save() { try { ss.set(KEY, JSON.stringify({ log: S.log.slice(-40), tried: S.tried, seen: S.seen, fails: S.fails, cat: S.cat, symptom: S.symptom, ticket: S.ticket, done: S.done, started: S.started })); } catch (_) {} }
  function restore() { try { var o = JSON.parse(ss.get(KEY) || 'null'); if (o) { S = Object.assign(fresh(), o); return true; } } catch (_) {} S = fresh(); return false; }

  /* ── 문구 — 사과는 짧게 한 번, 고객 탓 금지, 과한 약속 금지 ─────────── */
  var T = {
    hello: '사용 중에 불편을 드려 죄송해요.<br><strong>같이 빠르게 확인해 볼게요.</strong>',
    helloSub: '증상을 고르거나 아래 입력창에 편하게 적어 주세요.<br>해 보신 내용은 모니가 기억해 두었다가, 필요하면 담당 엔지니어에게 그대로 전달해 드려요.',
    high: '이 증상이라면 아래 순서로 확인해 보시면 대부분 해결돼요. 쉬운 것부터 하나씩 같이 볼게요.',
    mid: '비슷한 안내가 몇 가지 있어요. 지금 상황과 가장 가까운 것을 골라 주세요.',
    none: '말씀하신 내용과 딱 맞는 안내를 찾지 못했어요. 비슷한 답을 억지로 드리기보다, 담당 엔지니어가 직접 확인하는 게 더 빠를 것 같아요.',
    angry: '여러 번 시도하셨는데도 해결되지 않아 많이 답답하셨을 것 같아요. 더 기다리시지 않도록 지금 바로 담당 엔지니어에게 넘겨 드릴게요. 지금까지 나눈 내용은 함께 전달되니 다시 설명하지 않으셔도 돼요.',
    human: '네, 담당 엔지니어가 직접 확인하도록 접수해 드릴게요. 지금까지의 대화와 해 보신 조치는 자동으로 함께 전달돼요.',
    fire: '지금 불이나 연기가 보인다면 119 신고와 대피가 먼저예요. 센서·알림 확인은 그다음에 해도 늦지 않아요. 안전이 확보된 뒤 아래에서 「긴급」으로 접수해 주시면 우선 확인할게요.',
    urgent: '현장 안전이 가장 먼저예요. 화재·침수·온도 이탈처럼 바로 대응이 필요한 상황이라면 먼저 현장을 직접 확인해 주세요. 아래에서 「긴급」으로 접수하시면 우선 확인하겠습니다.',
    sales: '구매·견적·배송·계약 문의는 영업 담당자가 정확하게 안내드리는 게 가장 빨라요. 아래에 남겨 주시면 확인 후 회신드릴게요.',
    resolved: '해결돼서 다행이에요! 😊 끝까지 직접 확인해 주셔서 감사합니다.',
    retry: '확인해 주셔서 감사해요. 이 원인은 아닌 것 같네요. 함께 자주 생기는 원인이 하나 더 있어요.',
    handoff: '여기까지 직접 확인해 주셔서 정말 감사해요. 이제부터는 저희가 직접 볼게요. 해 보신 내용은 그대로 전달되니 다시 설명하지 않으셔도 돼요.',
    asFirst: '이 증상은 점검 후에도 계속되면 장비 확인이 필요한 경우가 많아요. 아래 점검을 해 보시고, 그래도 같으면 바로 접수해 주세요.',
    netErr: '연결이 잠시 불안정해요. 대신 가까운 안내를 보여 드릴게요.'
  };

  /* ── 공통 UI 조각 ─────────────────────────────────────────────── */
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function logBox() { return root && root.querySelector('.sp-log'); }
  /* scrollIntoView 는 쓰지 않는다 — 모니 패널(overflow:hidden)까지 밀려 올라가 화면이 비어 보인다 */
  function scroller() { return root && (root.closest('.pc-body') || root); }
  function scroll() { var b = scroller(); if (b) w.requestAnimationFrame(function () { b.scrollTop = b.scrollHeight; }); }
  function reveal(node) { var b = scroller(); if (!b || !node) return; w.requestAnimationFrame(function () { var r = node.getBoundingClientRect(), br = b.getBoundingClientRect(); b.scrollTop += (r.top - br.top) - 16; }); }
  function push(item, render) { S.log.push(item); if (render !== false) draw(item); save(); }
  function bubble(role, text) { push({ t: 'msg', role: role, text: String(text).slice(0, 800) }); }
  function draw(item) {
    var box = logBox(); if (!box) return;
    var node = null;
    if (item.t === 'msg') { node = el('div', 'pc-msg sp-msg ' + (item.role === 'user' ? 'me' : 'bot'), '<span>' + esc(item.text).replace(/\n/g, '<br>') + '</span>'); }
    else if (item.t === 'card') node = cardNode(item.id, item);
    else if (item.t === 'choices') node = choicesNode(item);
    else if (item.t === 'ticket') node = ticketNode(item);
    else if (item.t === 'done') node = doneNode(item);
    else if (item.t === 'next') node = nextNode(item);
    if (node) { box.appendChild(node); scroll(); }
    if (item.t === 'done') { var e = root.querySelector('.sp-escape'); if (e) e.hidden = true; }
  }
  function redraw() { var box = logBox(); if (!box) return; box.innerHTML = ''; S.log.forEach(draw); }

  /* ── 문서 카드 — 쉬운 단계부터, 단계마다 체크 ───────────────────── */
  function catOf(k) { var C = (w.MKSupportKB && w.MKSupportKB.CATS) || []; for (var i = 0; i < C.length; i++) if (C[i].key === k) return C[i]; return { icon: '💡', name: '' }; }
  /* 2026-10-29 — 문서의 「자세히 보기」 링크(매뉴얼 PDF·영상·기술 문서). 영상(.mp4)은 누를 때만 불러오는 작은 플레이어로 보여 준다 */
  function moreHtml(a, cls) {
    if (!a.more || !a.more.length) return '';
    var safe = function (h) { return /^(\/|https:\/\/)/.test(h) ? h : '#'; };
    return '<div class="' + cls + '">' + a.more.map(function (m) {
      var h = safe(m.href);
      if (/\.mp4$/i.test(h)) {
        var base = h.replace(/\.mp4$/i, '');
        return '<figure class="sp-vid"><video controls playsinline preload="none" poster="' + esc(base) + '-poster.webp" width="1280" height="720"><source src="' + esc(base) + '.webm" type="video/webm"><source src="' + esc(h) + '" type="video/mp4"></video><figcaption>' + esc(m.label) + '</figcaption></figure>';
      }
      return '<a class="sp-more-a" href="' + esc(h) + '"' + (/\.pdf/i.test(h) || /^https/.test(h) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(m.label) + '</a>';
    }).join('') + '</div>';
  }
  function cardNode(id, item) {
    var K = w.MKSupportKB, a = K && K.get(id); if (!a) return null;
    var c = catOf(a.cat), tried = S.tried[id] || [], n = (a.steps || []).length;
    var box = el('div', 'sp-card' + (item.closed ? ' is-closed' : ''));
    box.setAttribute('data-id', id);
    box.innerHTML =
      '<p class="sp-kicker">' + c.icon + ' ' + esc(c.name) + '</p>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<p class="sp-lead">' + esc(a.lead) + '</p>' +
      (a.as && !item.closed ? '<p class="sp-hint">' + esc(T.asFirst) + '</p>' : '') +
      (n ? '<div class="sp-steps-h"><b>이 순서로 확인해 보세요</b><span class="sp-prog"><i style="width:' + Math.round(tried.length / n * 100) + '%"></i></span><em>' + tried.length + '/' + n + '</em></div><ol class="sp-steps">' +
        a.steps.map(function (s, i) { var on = tried.indexOf(i) > -1; return '<li class="' + (on ? 'on' : '') + (i < 2 && /주세요|하세요/.test(s) ? ' easy' : '') + '"><label><input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + '><span>' + esc(s) + (i < 2 && /주세요|하세요/.test(s) ? ' <small>쉬움</small>' : '') + '</span></label></li>'; }).join('') + '</ol>' : '') +
      (a.warn && a.warn.length ? '<div class="sp-warn">🛡️ ' + a.warn.map(esc).join('<br>') + '</div>' : '') +
      (a.note && a.note.length ? '<details class="sp-note"><summary>알아 두면 좋아요</summary><ul>' + a.note.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
      (a.cta ? '<button type="button" class="sp-cta">' + esc(a.cta.label) + '</button>' : '') +
      moreHtml(a, 'sp-more') +
      (item.closed ? '' : '<div class="sp-fb"><p>확인해 보셨나요?</p><div><button type="button" class="sp-yes">👍 해결됐어요</button><button type="button" class="sp-no">아직 안 돼요</button></div></div>') +
      (a.src && a.src.length && /^https?:/.test(a.src[0]) ? '<p class="sp-src">근거: <a href="' + esc(a.src[0]) + '" target="_blank" rel="noopener">Monnit 기술 문서(영문)</a></p>' : '');
    box.querySelectorAll('.sp-steps input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var i = +cb.getAttribute('data-i'), arr = S.tried[id] = S.tried[id] || [], at = arr.indexOf(i);
        if (cb.checked && at < 0) arr.push(i); if (!cb.checked && at > -1) arr.splice(at, 1);
        cb.closest('li').classList.toggle('on', cb.checked);
        var p = box.querySelector('.sp-prog i'), e = box.querySelector('.sp-steps-h em');
        if (p) p.style.width = Math.round(arr.length / n * 100) + '%'; if (e) e.textContent = arr.length + '/' + n;
        save();
      });
    });
    var cta = box.querySelector('.sp-cta');
    if (cta) cta.addEventListener('click', function () { bubble('user', a.cta.label.replace(/^\W+\s*/, '')); bubble('bot', '수고 많으셨어요! 아래에 현장 정보만 남겨 주시면 담당자가 연결 상태를 확인하고 시험을 함께 진행해 드릴게요.'); openTicket({ why: a.cta.why, memo: a.cta.memo, urgency: a.cta.urgency, silent: true }); });
    var yes = box.querySelector('.sp-yes'), no = box.querySelector('.sp-no');
    if (yes) yes.addEventListener('click', function () { closeCard(item, box); resolved(id); });
    if (no) no.addEventListener('click', function () { closeCard(item, box); notYet(id); });
    return box;
  }
  function closeCard(item, box) { item.closed = true; var n = box.querySelector('.sp-fb'), h = box.querySelector('.sp-hint'); if (n) n.remove(); if (h) h.remove(); box.classList.add('is-closed'); save(); }

  function choicesNode(item) {
    var K = w.MKSupportKB, box = el('div', 'sp-choices');
    if (item.title) box.appendChild(el('p', 'sp-choices-t', esc(item.title)));
    (item.ids || []).forEach(function (id) {
      var a = K && K.get(id); if (!a) return;
      var b = el('button', 'sp-choice', '<span>' + catOf(a.cat).icon + '</span>' + esc(a.title)); b.type = 'button';
      b.addEventListener('click', function () { if (item.used) return; item.used = true; save(); box.classList.add('used'); b.classList.add('picked'); bubble('user', a.title); showArticle(id, T.high); });
      box.appendChild(b);
    });
    if (item.none !== false) {
      var x = el('button', 'sp-choice sp-choice-none', '<span>🙋</span>여기엔 없어요 — 담당자에게 접수할게요'); x.type = 'button';
      x.addEventListener('click', function () { if (item.used) return; item.used = true; save(); box.classList.add('used'); openTicket({ why: 'not-listed' }); });
      box.appendChild(x);
    }
    if (item.used) box.classList.add('used');
    return box;
  }
  function nextNode(item) {
    var box = el('div', 'sp-next');
    var a = el('button', '', '다른 문제도 확인할래요'); a.type = 'button'; a.addEventListener('click', function () { showCats(); });
    var b = el('button', '', '처음으로'); b.type = 'button'; b.addEventListener('click', function () { reset(); if (opts.onHome) opts.onHome(); });
    box.appendChild(a); box.appendChild(b); return box;
  }

  /* ── 흐름 ─────────────────────────────────────────────────────── */
  function showArticle(id, lead) {
    if (S.seen.indexOf(id) < 0) S.seen.push(id);
    var a = w.MKSupportKB.get(id); if (!S.symptom && a) S.symptom = a.title;
    if (lead) bubble('bot', lead);
    push({ t: 'card', id: id });
    track('support_article', { support_id: id });
  }
  function resolved(id) {
    var a = w.MKSupportKB.get(id);
    bubble('user', '해결됐어요');
    bubble('bot', T.resolved + (a && a.note && a.note[0] ? '\n\n💡 다음에 참고하세요: ' + a.note[0] : ''));
    push({ t: 'next' });
    track('support_resolved', { support_id: id, support_fails: S.fails });
  }
  function notYet(id) {
    S.fails++;
    var a = w.MKSupportKB.get(id);
    bubble('user', '아직 안 돼요');
    track('support_unresolved', { support_id: id, support_fails: S.fails });
    /* 한 번만 다른 원인을 제안한다. 두 번째부터는(또는 장비 확인이 필요한 증상이면) 접수로 — 같은 질문을 반복시키지 않는다 */
    var rel = ((a && a.rel) || []).filter(function (r) { return S.seen.indexOf(r) < 0; }).slice(0, 3);
    if (S.fails >= 2 || !rel.length || (a && a.as && (S.tried[id] || []).length >= Math.min(3, (a.steps || []).length))) {
      bubble('bot', T.handoff);
      openTicket({ why: 'unresolved', silent: true });
      return;
    }
    bubble('bot', T.retry);
    push({ t: 'choices', ids: rel, title: '이것도 확인해 볼까요?' });
  }
  function showCats() {
    var K = w.MKSupportKB; if (!K) return;
    var box = root.querySelector('.sp-cats'); if (box) { box.hidden = false; reveal(box); }
  }
  function pickCat(c) {
    var K = w.MKSupportKB, list = K.byCat(c.key);
    S.cat = c.key; bubble('user', c.name);
    track('support_cat', { support_cat: c.key });
    if (list.length === 1) { showArticle(list[0].id, T.high); return; }
    bubble('bot', '어떤 상황에 가장 가까운가요?');
    push({ t: 'choices', ids: list.map(function (a) { return a.id; }).slice(0, 8) });
  }

  /* 고객이 직접 쓴 말 */
  var busy = false;
  function ask(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    ensure(function (K) {
      if (!K) { bubble('user', text); bubble('bot', T.none); openTicket({ why: 'kb-missing', silent: true }); return; }
      bubble('user', text);
      if (!S.symptom) S.symptom = text.slice(0, 200);
      var m = K.mood(text), r = K.search(text, { cat: S.cat, limit: 4 }), lv = K.confidence(r);
      track('support_ask', { support_level: lv, support_mood: m.angry ? 'angry' : m.urgent ? 'urgent' : m.human ? 'human' : '' });
      if (m.angry || m.human) { bubble('bot', m.angry ? T.angry : T.human); openTicket({ why: m.angry ? 'angry' : 'human', urgent: m.urgent, silent: true }); return; }
      if (m.thanks && S.seen.length) { var last = S.seen[S.seen.length - 1]; resolved(last); return; }
      if (m.nowork && S.seen.length && lv !== 'high') { notYet(S.seen[S.seen.length - 1]); return; }
      if (m.sales && lv !== 'high') { bubble('bot', T.sales); openTicket({ why: 'sales', kind: 'sales', silent: true }); return; }
      if (m.urgent) bubble('bot', m.fire ? T.fire : T.urgent);
      var unseen = r.filter(function (x) { return S.seen.indexOf(x.id) < 0; });
      if (lv === 'high' && unseen.length && unseen[0].id === r[0].id) { showArticle(r[0].id, m.urgent ? '' : T.high); if (m.urgent) urgentOffer(); return; }
      if (lv === 'mid' && unseen.length) { bubble('bot', T.mid); push({ t: 'choices', ids: unseen.slice(0, 3).map(function (x) { return x.id; }) }); if (m.urgent) urgentOffer(); return; }
      remote(text, m);
    });
  }
  function urgentOffer() { push({ t: 'ticket', why: 'urgent', urgent: true, kind: 'tech', compact: true }); }
  function remote(text, m) {
    busy = true; var box = logBox(), t = el('div', 'pc-msg bot pc-typing sp-typing', '<span><i></i><i></i><i></i></span>'); if (box) { box.appendChild(t); scroll(); }
    var hist = S.log.filter(function (x) { return x.t === 'msg'; }).slice(-8).map(function (x) { return { role: x.role, text: x.text }; });
    var c = w.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (c) c.abort(); }, 15000);
    fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, signal: c ? c.signal : undefined,
      body: JSON.stringify({ q: text, history: hist, cat: S.cat, seen: S.seen, lang: (function(){ try { return (document.documentElement.lang === 'en' || localStorage.getItem('mlang') === 'en') ? 'en' : 'ko'; } catch (e) { return 'ko'; } })(), elapsed: Date.now() - S.T0, website: '' }) })
      .then(function (r) { return r.json(); })
      .then(function (x) { done(x); }, function () { done(null); });
    function done(x) {
      clearTimeout(timer); busy = false; t.remove();
      var K = w.MKSupportKB;
      if (!x || !x.ok) {
        var r = K.search(text, { limit: 3 }).filter(function (y) { return S.seen.indexOf(y.id) < 0; });
        if (r.length && K.confidence(r) !== 'none') { bubble('bot', T.netErr); push({ t: 'choices', ids: r.map(function (y) { return y.id; }) }); }
        else { bubble('bot', T.none); openTicket({ why: 'no-answer', silent: true }); }
        return;
      }
      if (x.reply) bubble('bot', x.reply);
      var ids = (x.ids || []).filter(function (id) { return K.get(id) && S.seen.indexOf(id) < 0; });
      if (x.mode === 'ai' && ids.length) { push({ t: 'card', id: ids[0] }); if (S.seen.indexOf(ids[0]) < 0) S.seen.push(ids[0]); if (ids.length > 1) push({ t: 'choices', ids: ids.slice(1), title: '함께 확인해 볼 만한 안내' }); }
      else if (ids.length) push({ t: 'choices', ids: ids });
      if (x.escalate) openTicket({ why: x.sales ? 'sales' : x.urgent ? 'urgent' : 'ai-escalate', kind: x.sales ? 'sales' : 'tech', urgent: x.urgent, silent: true, compact: !!ids.length });
      save();
    }
  }

  /* ── 접수 ─────────────────────────────────────────────────────── */
  function openTicket(o) {
    o = o || {};
    if (S.done) { bubble('bot', '이미 접수해 주셨어요 (접수번호 ' + S.done.no + '). 추가로 전하실 내용은 회신 메일에 답장으로 보내 주시면 같은 건으로 이어서 확인해요.'); return; }
    var open = S.log.filter(function (x) { return x.t === 'ticket' && !x.sent; });
    if (open.length) { var all = root.querySelectorAll('.sp-ticket:not(.sent)'), n = all[all.length - 1]; if (n) { n.classList.remove('compact'); reveal(n); } return; }
    if (o.memo || o.urgency) { S.ticket = Object.assign({}, S.ticket || {}); if (o.memo && !S.ticket.memo) S.ticket.memo = o.memo; if (o.urgency && !S.ticket.urgency) S.ticket.urgency = o.urgency; }
    if (o.why === 'install-check') S.symptom = '알리미 설치 완료 — 연결 확인·시험 요청';
    if (!o.silent) bubble('bot', T.human);
    push({ t: 'ticket', why: o.why || 'manual', urgent: !!o.urgent, kind: o.kind || 'tech', compact: !!o.compact });
    track('support_escalate', { support_why: o.why || 'manual', support_fails: S.fails });
  }
  function triedList() {
    var K = w.MKSupportKB, out = [];
    Object.keys(S.tried).forEach(function (id) { var a = K && K.get(id); if (!a) return; (S.tried[id] || []).slice().sort(function (x, y) { return x - y; }).forEach(function (i) { if (a.steps[i]) out.push((i + 1) + '단계 ' + a.steps[i] + ' (' + a.title.replace(/\s*\(.*\)$/, '') + ')'); }); });
    return out;
  }
  function ticketNode(item) {
    var f = S.ticket || {}, sales = item.kind === 'sales', install = item.why === 'install-check', tried = triedList();
    var box = el('div', 'sp-ticket' + (item.compact ? ' compact' : '') + (item.sent ? ' sent' : ''));
    if (item.sent) { box.innerHTML = '<p class="sp-sent">✓ 접수 양식을 보냈어요</p>'; return box; }
    var seenTitles = S.seen.map(function (id) { var a = w.MKSupportKB && w.MKSupportKB.get(id); return a ? a.title : ''; }).filter(Boolean);
    box.innerHTML =
      '<button type="button" class="sp-ticket-open">' + (item.urgent ? '🚨 긴급으로 바로 접수하기' : sales ? '✉️ 영업 담당자에게 문의 남기기' : install ? '✅ 설치 완료 확인 요청하기' : '🙋 담당 엔지니어에게 접수하기') + '</button>' +
      '<form class="sp-form" novalidate>' +
      '<p class="sp-form-k">' + (sales ? '영업 문의' : install ? '설치 완료 확인 요청' : '기술지원 접수') + '</p>' +
      '<h3>' + (sales ? '문의 내용을 남겨 주세요' : install ? '연결 상태는 저희가 확인할게요' : '이제부터는 저희가 직접 확인할게요') + '</h3>' +
      '<p class="sp-form-sub">' + (sales ? '담당자가 확인 후 이메일로 회신드려요.' : '담당 엔지니어가 내용을 확인한 뒤 이메일로 회신드려요. <b>지금까지의 대화와 해 보신 조치는 자동으로 첨부</b>되니 다시 설명하지 않으셔도 돼요.') + '</p>' +
      (!sales && (seenTitles.length || tried.length) ? '<div class="sp-attach"><b>📎 함께 전달되는 내용</b><ul>' +
        (S.symptom ? '<li>증상: ' + esc(S.symptom) + '</li>' : '') +
        (seenTitles.length ? '<li>확인한 안내 ' + seenTitles.length + '건</li>' : '') +
        (tried.length ? '<li>해 보신 조치 ' + tried.length + '개 — ' + esc(tried.slice(0, 2).map(function (x) { return x.replace(/^\d+단계\s*/, '').slice(0, 24) + '…'; }).join(', ')) + '</li>' : '') +
        '</ul></div>' : '') +
      '<div class="sp-grid">' +
      '<label><span>회사·현장명 <em>*</em></span><input name="company" maxlength="60" autocomplete="organization" value="' + esc(f.company || '') + '"></label>' +
      '<label><span>성함 <em>*</em></span><input name="name" maxlength="30" autocomplete="name" value="' + esc(f.name || '') + '"></label>' +
      '<label class="wide"><span>회신받을 이메일 <em>*</em></span><input name="email" type="email" inputmode="email" maxlength="120" autocomplete="email" value="' + esc(f.email || '') + '"></label>' +
      '<label><span>연락처 <small>(선택)</small></span><input name="phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="통화가 편하시면" value="' + esc(f.phone || '') + '"></label>' +
      (sales ? '' : '<label><span>제품 <small>(선택)</small></span><select name="product">' + ['', '화재 알리미', '물감지 알리미', '정전 알리미', '경보 알리미', '센서 — 일반형(AA)', '센서 — 산업용(IND)', '센서 — 코인셀형', '이더넷 게이트웨이', 'LTE·IoT 게이트웨이', 'Modbus·기타 게이트웨이', 'iMonnit 계정·설정', '잘 모르겠어요'].map(function (p) { return '<option' + (f.product === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></label>' +
        '<label class="wide"><span>장치 ID <small>(선택 · 라벨에 적힌 번호)</small></span><input name="device" maxlength="80" placeholder="여러 개면 쉼표로" value="' + esc(f.device || '') + '"></label>') +
      '</div>' +
      (sales || install ? '' : '<fieldset class="sp-urg"><legend>지금 상황은 어떤가요?</legend>' +
        [['high', '현장 운영에 지장이 있어요 (긴급)'], ['mid', '불편하지만 운영은 돼요'], ['low', '궁금한 점을 확인하고 싶어요']].map(function (u) { var on = (f.urgency || (item.urgent ? 'high' : 'mid')) === u[0]; return '<label class="' + (on ? 'on' : '') + '"><input type="radio" name="urgency" value="' + u[0] + '"' + (on ? ' checked' : '') + '><span>' + u[1] + '</span></label>'; }).join('') + '</fieldset>') +
      '<label class="wide sp-more"><span>' + (sales ? '문의 내용' : '추가로 전하실 내용') + ' <small>' + (sales ? '' : '(선택)') + '</small></span><textarea name="memo" rows="3" maxlength="1000" placeholder="' + (sales ? '필요하신 제품·수량·현장 등을 적어 주세요' : '예) 오늘 오전부터 2층 냉동고 센서 3개만 안 들어와요') + '">' + esc(f.memo || '') + '</textarea></label>' +
      '<label class="sp-agree"><input type="checkbox" name="agree"' + (f.agree ? ' checked' : '') + '><span><b>[필수]</b> 문의 처리와 회신을 위한 개인정보 수집·이용에 동의합니다. 1년 뒤 파기합니다. <a href="/privacy.html" target="_blank" rel="noopener">자세히</a></span></label>' +
      '<input name="website" class="sp-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="sp-err" hidden></p>' +
      '<button type="submit" class="sp-submit">접수하기</button>' +
      '</form>';
    var form = box.querySelector('form');
    box.querySelector('.sp-ticket-open').addEventListener('click', function () { box.classList.remove('compact'); item.compact = false; save(); var i = form.querySelector('input[name=company]'); if (i) i.focus({ preventScroll: true }); reveal(box); });
    form.addEventListener('input', function () { S.ticket = collect(form); save(); });
    form.addEventListener('change', function (e) { if (e.target.name === 'urgency') form.querySelectorAll('.sp-urg label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); S.ticket = collect(form); save(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(form, item, box); });
    return box;
  }
  function collect(form) {
    var g = function (n) { var x = form.elements[n]; return x ? String(x.value || '').trim() : ''; };
    var u = form.querySelector('input[name=urgency]:checked');
    return { company: g('company'), name: g('name'), email: g('email'), phone: g('phone'), product: g('product'), device: g('device'), memo: g('memo'), urgency: u ? u.value : '', agree: !!(form.elements.agree && form.elements.agree.checked) };
  }
  function ticketNo() { var t = new Date(Date.now() + 9 * 3600000), p = function (n) { return (n < 10 ? '0' : '') + n; }; var A = '23456789BCDFGHJKMNPQRSTVWXZ', r = ''; for (var i = 0; i < 4; i++) r += A[Math.floor(Math.random() * A.length)]; return 'AS' + String(t.getUTCFullYear()).slice(2) + p(t.getUTCMonth() + 1) + p(t.getUTCDate()) + '-' + r; }
  function submit(form, item, box) {
    var f = collect(form); if (!f.urgency && item.why === 'install-check') f.urgency = 'low';
    var err = box.querySelector('.sp-err'), btn = box.querySelector('.sp-submit'), sales = item.kind === 'sales';
    var fail = function (t, focus) { err.hidden = false; err.textContent = t; if (focus && form.elements[focus]) form.elements[focus].focus(); };
    if (!f.company) return fail('회사·현장명을 적어 주세요.', 'company');
    if (!f.name) return fail('성함을 적어 주세요.', 'name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) return fail('회신받으실 이메일 주소를 확인해 주세요.', 'email');
    if (sales && !f.memo) return fail('문의 내용을 간단히 적어 주세요.', 'memo');
    if (!f.agree) return fail('개인정보 수집·이용에 동의해 주셔야 접수할 수 있어요.', 'agree');
    if (String(form.elements.website.value || '').trim()) return;
    err.hidden = true; btn.disabled = true; btn.textContent = '접수하는 중…';
    var no = ticketNo(), tried = triedList(), K = w.MKSupportKB;
    var seen = S.seen.map(function (id) { var a = K && K.get(id); return a ? a.title : id; });
    var convo = S.log.filter(function (x) { return x.t === 'msg'; }).slice(-14).map(function (x) { return (x.role === 'user' ? '고객: ' : '모니: ') + x.text.replace(/\s+/g, ' ').slice(0, 160); }).join('\n');
    var urgLabel = item.why === 'install-check' ? '설치 확인' : ({ high: '긴급(운영 지장)', mid: '보통', low: '단순 문의' }[f.urgency] || '');
    var memo = [
      '[' + (sales ? '영업 문의' : item.why === 'install-check' ? '알리미 설치 확인 요청' : '기술지원 접수') + ' ' + no + ']' + (f.urgency === 'high' ? ' 🚨긴급' : ''),
      S.symptom ? '증상: ' + S.symptom : '',
      f.product ? '제품: ' + f.product : '', f.device ? '장치 ID: ' + f.device : '',
      f.memo ? '고객 메모: ' + f.memo : '',
      seen.length ? '확인한 안내: ' + seen.join(' / ') : '',
      tried.length ? '해 본 조치(' + tried.length + '):\n- ' + tried.join('\n- ') : '',
      S.fails ? '「아직 안 돼요」 ' + S.fails + '회' : ''
    ].filter(Boolean).join('\n').slice(0, 3000);
    ensureLead(function () {
      if (!w.MonnitLead) { finish(false); return; }
      var install = item.why === 'install-check';
      var title = (sales ? '영업 문의 — ' : install ? '알리미 설치 확인 요청 — ' : '기술지원 접수 — ') + f.company + (f.urgency === 'high' ? ' [긴급]' : '');
      var p = w.MonnitLead.build('contact', sales ? 'support_sales' : 'support_ticket', title, {
        '회사명': f.company, '담당자명': f.name, '이메일': f.email, '전화번호': f.phone || '',
        '관심분야': sales ? '영업 문의(모니)' : install ? '알리미 설치 확인 요청' : '기술지원(AS) 접수', '시설 유형': f.product || '', '제품': f.product || '',
        '접수번호': no, '긴급도': urgLabel, '장치 ID': f.device || '', '증상': S.symptom || '',
        '시도한 조치': tried.join('\n').slice(0, 2500), '대화 내용': convo.slice(0, 2500), '추가 내용': f.memo || '',
        '문의 사항': memo, '마케팅 정보 수신(선택)': '미동의'
      });
      w.MonnitLead.submit(p).then(function (ok) {
        if (ok) { try { w.MonnitLead.track('contact', { page: sales ? 'support_sales' : 'support_ticket', interest: sales ? '영업 문의' : '기술지원' }); } catch (_) {} }
        finish(ok);
      });
    });
    function finish(ok) {
      btn.disabled = false; btn.textContent = '접수하기';
      if (!ok) {
        err.hidden = false;
        err.innerHTML = '접수가 전송되지 않았어요. 입력하신 내용은 그대로 남아 있으니 잠시 후 다시 눌러 주세요.' +
          '<br><a href="mailto:korea@monnit.com?subject=' + encodeURIComponent('[기술지원] ' + f.company + ' ' + no) + '&body=' + encodeURIComponent(memo + '\n\n성함: ' + f.name + '\n이메일: ' + f.email) + '">이메일로 대신 보내기</a>';
        track('support_ticket_fail'); return;
      }
      item.sent = true; S.done = { no: no, email: f.email, urgent: f.urgency === 'high', sales: sales }; S.ticket = null;
      box.replaceWith(ticketNode(item));
      push({ t: 'done' }); push({ t: 'next' });
      track('support_ticket_submit', { support_urgency: f.urgency || '', support_fails: S.fails, support_kind: sales ? 'sales' : 'tech' });
    }
  }
  function doneNode() {
    var x = S.done || {};
    return el('div', 'sp-done',
      '<span class="sp-done-i">✓</span><p class="sp-done-k">접수번호 ' + esc(x.no || '') + '</p><h3>접수가 완료됐어요</h3>' +
      '<p>' + (x.sales ? '영업 담당자' : '담당 엔지니어') + '가 내용을 확인한 뒤 <b>' + esc(x.email || '입력하신 이메일') + '</b>(으)로 회신드릴게요.' + (x.urgent ? ' 긴급으로 접수하신 건은 먼저 확인합니다.' : '') + '</p>' +
      '<ol><li>담당자가 접수 내용과 해 보신 조치를 확인해요</li><li>이메일로 원인과 다음 조치를 안내드려요</li><li>필요하면 원격 점검이나 AS 절차를 함께 진행해요</li></ol>' +
      '<p class="sp-done-s">접수 확인 메일을 보내 드렸어요. 평일 업무시간에 접수 순서대로 확인하며, 현장 사진이나 추가 자료는 그 메일에 답장으로 보내 주시면 같은 건으로 이어서 볼게요.</p>');
  }

  /* ── 모니 패널 안에 그리기 ─────────────────────────────────────── */
  function mount(host, o) {
    opts = o || {}; css();
    restore();
    host.innerHTML = '<div class="sp-wrap"><div class="sp-intro"><div class="pc-moni-orb" aria-hidden="true"><img src="/assets/moni/moni.png" alt=""></div><h2>' + T.hello + '</h2><p>' + T.helloSub + '</p></div>' +
      '<div class="sp-cats" role="list"></div><div class="sp-log" role="log" aria-live="polite"></div>' +
      '<div class="sp-escape"><button type="button" class="sp-escape-b">🙋 점검 없이 바로 담당자에게 접수할게요</button></div></div>';
    root = host.querySelector('.sp-wrap');
    root.querySelector('.sp-escape-b').addEventListener('click', function () { bubble('user', '담당자에게 바로 접수할게요'); bubble('bot', T.human); openTicket({ why: 'escape', silent: true }); });
    ensure(function (K) {
      var box = root.querySelector('.sp-cats');
      if (!K) { box.innerHTML = '<p class="sp-empty">안내를 불러오지 못했어요. 아래 버튼으로 바로 접수해 주세요.</p>'; return; }
      K.CATS.forEach(function (c) {
        var b = el('button', 'sp-cat', '<span aria-hidden="true">' + c.icon + '</span><b>' + esc(c.name) + '</b><small>' + esc(c.desc) + '</small>'); b.type = 'button'; b.setAttribute('role', 'listitem');
        b.addEventListener('click', function () { pickCat(c); });
        box.appendChild(b);
      });
      redraw();
      if (o && o.article && K.get(o.article) && S.seen.indexOf(o.article) < 0) { bubble('bot', '자주 묻는 질문에서 보시던 안내를 이어서 확인해 볼게요.'); showArticle(o.article, ''); }
      if (o && o.ticket) openTicket({ why: o.from || 'faq' });
      if (o && o.q) ask(o.q);
      if (S.log.length) scroll();
    });
    track('support_open', { support_from: (o && o.from) || 'moni' });
  }
  function reset() { ss.del(KEY); S = fresh(); if (root) { var b = logBox(); if (b) b.innerHTML = ''; } }

  /* ── /faqs 페이지 — 같은 문서를 「찾아보는」 방식으로 ──────────────── */
  function renderFaq(host, general) {
    if (!host) return; css();
    /* 이미 그려져 있으면 「도입 전」 문항만 바꾼다 — 시트(CMS)가 늦게 도착해도 고객이 치던 검색어·펼친 항목이 날아가지 않게 */
    if (host._sf) { host._sf(general); return; }
    ensure(function (K) {
      if (!K) return;   /* 실패하면 기존 정적 FAQ 가 그대로 남는다 */
      var gen = [], all = [];
      function setGeneral(g) {
        gen = (g || []).map(function (x, i) { return { id: 'g' + i, cat: 'general', title: x.q, lead: x.a, steps: [], gen: true }; });
        all = K.ARTICLES.filter(function (a) { return a.cat !== 'general' || !gen.length; }).concat(gen);
      }
      setGeneral(general);
      var genKey = JSON.stringify(general || []);
      host._sf = function (g) { var k = JSON.stringify(g || []); if (k === genKey) return; genKey = k; setGeneral(g); draw(); };
      var cur = 'all', q = '';
      host.innerHTML = '<div class="sf"><div class="sf-search"><span aria-hidden="true">🔎</span><input type="search" id="sfQ" placeholder="증상이나 궁금한 점을 입력해 보세요  예) 센서가 안 들어와요, 게이트웨이 빨간불" aria-label="자주 묻는 질문 검색"><button type="button" id="sfAsk">모니에게 묻기</button></div>' +
        '<div class="sf-tabs" role="tablist"></div><p class="sf-count" aria-live="polite"></p><div class="sf-list"></div>' +
        '<div class="sf-cta"><div><b>찾는 답이 없으신가요?</b><span>모니가 증상을 함께 확인하고, 해결이 안 되면 담당 엔지니어에게 바로 연결해 드려요.</span></div><button type="button" id="sfMoni">🤖 모니와 문제 해결하기</button><button type="button" id="sfTicket" class="ghost">🙋 바로 기술지원 접수</button></div></div>';
      var tabs = host.querySelector('.sf-tabs'), list = host.querySelector('.sf-list'), cnt = host.querySelector('.sf-count'), inp = host.querySelector('#sfQ');
      [{ key: 'all', icon: '📚', name: '전체' }].concat(K.CATS).forEach(function (c) {
        var b = el('button', 'sf-tab' + (c.key === 'all' ? ' on' : ''), c.icon + ' ' + esc(c.name)); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-k', c.key);
        b.addEventListener('click', function () { cur = c.key; tabs.querySelectorAll('.sf-tab').forEach(function (t) { t.classList.toggle('on', t === b); }); draw(); });
        tabs.appendChild(b);
      });
      function item(a) {
        var c = catOf(a.cat);
        return '<details class="sf-item" data-id="' + esc(a.id) + '"><summary><span class="sf-tag">' + c.icon + ' ' + esc(c.name) + '</span><span class="sf-q">' + esc(a.title) + '</span></summary><div class="sf-a">' +
          '<p class="sf-lead">' + esc(a.lead) + '</p>' +
          (a.steps && a.steps.length ? '<ol>' + a.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') +
          (a.warn && a.warn.length ? '<p class="sf-warn">🛡️ ' + a.warn.map(esc).join('<br>') + '</p>' : '') +
          (a.note && a.note.length ? '<ul class="sf-note">' + a.note.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
          moreHtml(a, 'sf-more') +
          '<div class="sf-fb"><span>이 안내로 해결되셨나요?</span><button type="button" data-fb="yes">👍 해결됐어요</button><button type="button" data-fb="no">아직 안 돼요</button></div>' +
          '</div></details>';
      }
      function draw() {
        var rows;
        if (q) { var hit = K.search(q, { limit: 12 }).map(function (r) { return r.a; }); var gq = gen.filter(function (g) { return (g.title + g.lead).indexOf(q) > -1; }); rows = gq.concat(hit.filter(function (a) { return cur === 'all' || a.cat === cur; })); }
        else rows = all.filter(function (a) { return cur === 'all' || a.cat === cur; });
        var opened = [].map.call(list.querySelectorAll('.sf-item[open]'), function (x) { return x.getAttribute('data-id'); });
        list.innerHTML = rows.length ? rows.map(item).join('') : '<p class="sf-empty">딱 맞는 안내를 찾지 못했어요. 아래 「모니에게 묻기」로 상황을 알려 주시면 함께 찾아 드릴게요.</p>';
        opened.forEach(function (id) { var x = list.querySelector('.sf-item[data-id="' + id + '"]'); if (x) x.open = true; });
        cnt.textContent = q ? '「' + q + '」 관련 안내 ' + rows.length + '건' : '안내 ' + rows.length + '건';
      }
      var tmr = 0; inp.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { q = inp.value.trim(); draw(); if (q.length > 1) track('faq_search', { faq_q_len: q.length }); }, 160); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (inp.value.trim()) openMoni({ q: inp.value.trim(), from: 'faq-search' }); } });
      host.querySelector('#sfAsk').addEventListener('click', function () { openMoni({ q: inp.value.trim(), from: 'faq-search' }); });
      host.querySelector('#sfMoni').addEventListener('click', function () { openMoni({ from: 'faq-cta' }); });
      host.querySelector('#sfTicket').addEventListener('click', function () { openMoni({ ticket: true, from: 'faq-ticket' }); });
      list.addEventListener('toggle', function (e) { var dd = e.target; if (dd.open) track('faq_open', { faq_id: dd.getAttribute('data-id') }); }, true);
      list.addEventListener('click', function (e) {
        var b = e.target.closest('[data-fb]'); if (!b) return;
        var it = b.closest('.sf-item'), id = it.getAttribute('data-id'), fb = it.querySelector('.sf-fb');
        track('faq_feedback', { faq_id: id, faq_fb: b.getAttribute('data-fb') });
        if (b.getAttribute('data-fb') === 'yes') fb.innerHTML = '<span>해결돼서 다행이에요! 😊</span>';
        else { fb.innerHTML = '<span>불편을 드려 죄송해요. 모니가 이어서 같이 확인해 드릴게요.</span><button type="button" class="go">모니와 이어서 확인하기</button>'; fb.querySelector('.go').addEventListener('click', function () { openMoni({ article: /^g\d/.test(id) ? '' : id, from: 'faq-no' }); }); }
      });
      draw();
    });
  }
  function openMoni(o) {
    if (w.MKPropChat && w.MKPropChat.openSupport) w.MKPropChat.openSupport(o || {});
    else { /* 모니가 아직 안 떴으면 잠시 뒤 다시 */ setTimeout(function () { if (w.MKPropChat && w.MKPropChat.openSupport) w.MKPropChat.openSupport(o || {}); }, 800); }
  }

  /* ── 스타일 — 모니 패널(밝은 화면)과 /faqs(사이트 다크 네이비) 두 벌 ───── */
  function css() {
    if (d.getElementById('sp-css')) return;
    var s = d.createElement('style'); s.id = 'sp-css';
    s.textContent = [
      /* 모니 패널 */
      '.mkp-chat.pc-panel.is-support{background-color:#f8f8fb;background-image:radial-gradient(circle at 86% 5%,rgba(220,234,255,.85),transparent 42%),radial-gradient(circle at 8% 9%,rgba(220,248,250,.7),transparent 43%)}',
      '.mkp-chat.pc-panel.is-support .pc-moni-head{background:transparent!important;border:0!important;box-shadow:none!important}.mkp-chat.pc-panel.is-support .pc-body{background:transparent!important}',
      '.sp-wrap{padding:6px 18px 12px;font-family:Pretendard,"Pretendard Variable",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;color:#1d2430;letter-spacing:-.02em}',
      '.sp-intro{text-align:center;margin:4px 0 16px}.sp-intro .pc-moni-orb{margin:0 auto 8px}.sp-intro h2{margin:0 0 8px;font-size:21px;line-height:1.4;font-weight:600;color:#111820}.sp-intro h2 strong{color:#0868f2;font-weight:800}.sp-intro p{margin:0;font-size:13px;line-height:1.6;color:#5a6472}',
      '.sp-cats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}.sp-cat{display:grid;grid-template-columns:26px 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;text-align:left;padding:11px 12px;border:1px solid #e3e8ef;border-radius:14px;background:#fff;cursor:pointer;font:inherit;color:inherit;box-shadow:0 3px 12px rgba(34,48,70,.04);transition:border-color .15s,transform .15s,box-shadow .15s}',
      '.sp-cat:hover,.sp-cat:focus-visible{outline:0;border-color:#0868f2;box-shadow:0 6px 18px rgba(8,104,242,.12);transform:translateY(-1px)}.sp-cat span{grid-row:1/3;font-size:19px;text-align:center}.sp-cat b{font-size:13.5px;font-weight:700}.sp-cat small{font-size:11.5px;color:#7a8492}',
      '.sp-log{display:flex;flex-direction:column;gap:10px}.sp-msg span{white-space:pre-line}',
      '.sp-card{background:#fff;border:1px solid #dfe7f3;border-radius:18px 18px 18px 6px;padding:15px 15px 12px;box-shadow:0 6px 20px rgba(8,104,242,.07)}.sp-card.is-closed{opacity:.92}',
      '.sp-kicker{margin:0 0 4px;font-size:11.5px;font-weight:700;color:#0868f2}.sp-card h3{margin:0 0 7px;font-size:15.5px;line-height:1.45;color:#111820}.sp-lead{margin:0 0 10px;font-size:13.5px;line-height:1.65;color:#36404d}',
      '.sp-hint{margin:0 0 10px;padding:8px 10px;border-radius:10px;background:#fff8e8;color:#7a5a12;font-size:12.5px;line-height:1.55}',
      '.sp-steps-h{display:flex;align-items:center;gap:8px;margin:2px 0 6px;font-size:12.5px}.sp-steps-h b{color:#111820}.sp-prog{flex:1;height:5px;border-radius:9px;background:#edf1f6;overflow:hidden}.sp-prog i{display:block;height:100%;background:linear-gradient(90deg,#3fa7ff,#0868f2);transition:width .25s}.sp-steps-h em{font-style:normal;color:#7a8492;font-size:11.5px}',
      '.sp-steps{list-style:none;margin:0;padding:0;display:grid;gap:6px;counter-reset:s}.sp-steps li{counter-increment:s}.sp-steps label{position:relative;display:flex;gap:9px;align-items:flex-start;padding:9px 10px;border-radius:11px;background:#f6f8fb;cursor:pointer;font-size:13px;line-height:1.55;color:#2b3440;transition:background .15s}',
      '.sp-steps label::before{content:counter(s);flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#e4ecf7;color:#0868f2;font-size:11px;font-weight:800;margin-top:1px}.sp-steps li.on label{background:#eaf6ef}.sp-steps li.on label::before{content:"✓";background:#20b26b;color:#fff}',
      '.sp-steps input{position:absolute;left:8px;top:8px;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}.sp-steps small{display:inline-block;margin-left:3px;padding:0 6px;border-radius:9px;background:#e7f1ff;color:#0868f2;font-size:10.5px;font-weight:700;vertical-align:1px}',
      '.sp-warn{margin:10px 0 0;padding:9px 11px;border-radius:11px;background:#f0f6ff;color:#2a4a78;font-size:12.5px;line-height:1.55}',
      '.sp-note{margin:9px 0 0;font-size:12.5px;color:#4a5462}.sp-note summary{cursor:pointer;font-weight:700;color:#36404d}.sp-note ul{margin:6px 0 0;padding-left:18px;line-height:1.6}',
      '.sp-fb{margin:12px 0 2px;padding-top:11px;border-top:1px dashed #e3e8ef}.sp-fb p{margin:0 0 7px;font-size:12.5px;color:#5a6472}.sp-fb div{display:flex;gap:7px}.sp-fb button{flex:1;min-height:40px;border-radius:11px;font:600 13.5px/1 inherit;cursor:pointer;border:1px solid #d6dee9;background:#fff;color:#2b3440}.sp-fb .sp-yes{background:#0868f2;border-color:#0868f2;color:#fff}.sp-fb button:hover{filter:brightness(.97)}',
      '.sp-cta{display:block;width:100%;min-height:44px;margin:12px 0 0;border:0;border-radius:12px;background:#20b26b;color:#fff;font:700 14px/1.3 inherit;cursor:pointer}.sp-cta:hover{filter:brightness(.96)}',
      '.sp-src{margin:9px 0 0;font-size:11px;color:#8a93a0}.sp-src a{color:#5a7fb3}',
      '.sp-more,.sf-more{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}.sp-more-a{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;font-size:12.5px;font-weight:600;text-decoration:none;background:#eef3ff;color:#2552a8;border:1px solid #d6e2fb}.sf-more .sp-more-a{background:rgba(127,178,255,.12);color:#cfe0ff;border-color:rgba(127,178,255,.35)}',
      '.sp-vid{margin:0;width:100%}.sp-vid video{display:block;width:100%;height:auto;aspect-ratio:16/9;border-radius:10px;background:#0b1830}.sp-vid figcaption{font-size:11.5px;color:#6b7686;margin-top:5px}.sf-more .sp-vid{max-width:560px}.sf-more .sp-vid figcaption{color:#9fb3d6}',
      '.sp-choices{display:grid;gap:6px}.sp-choices-t{margin:2px 0 2px;font-size:12.5px;font-weight:700;color:#36404d}.sp-choice{display:flex;gap:9px;align-items:center;text-align:left;padding:11px 13px;border:1px solid #dfe5ee;border-radius:13px;background:#fff;font:500 13.5px/1.45 inherit;color:#1d2430;cursor:pointer;transition:border-color .15s}',
      '.sp-choice:hover{border-color:#0868f2}.sp-choice span{flex:none;font-size:16px}.sp-choice-none{background:transparent;border-style:dashed;color:#4a5462}.sp-choices.used .sp-choice{opacity:.5;pointer-events:none}.sp-choices.used .sp-choice.picked{opacity:1;border-color:#0868f2}',
      '.sp-next{display:flex;gap:7px}.sp-next button{flex:1;min-height:40px;border-radius:11px;border:1px solid #d6dee9;background:#fff;font:600 13px/1 inherit;color:#2b3440;cursor:pointer}',
      '.sp-escape[hidden]{display:none}.sp-escape{position:sticky;bottom:0;margin:14px -18px -12px;padding:8px 18px 10px;background:linear-gradient(180deg,rgba(248,248,251,0),#f8f8fb 40%)}.sp-escape-b{width:100%;min-height:38px;border:1px dashed #c9d3e1;border-radius:11px;background:rgba(255,255,255,.75);font:500 12.5px/1.3 inherit;color:#4a5462;cursor:pointer}.sp-escape-b:hover{border-color:#0868f2;color:#0868f2}',
      '.sp-ticket{background:#fff;border:1px solid #cfe0f7;border-radius:18px;padding:14px;box-shadow:0 8px 24px rgba(8,104,242,.09)}.sp-ticket-open{display:none;width:100%;min-height:44px;border:0;border-radius:12px;background:#0868f2;color:#fff;font:700 14px/1 inherit;cursor:pointer}',
      '.sp-ticket.compact{padding:0;border:0;background:transparent;box-shadow:none}.sp-ticket.compact .sp-ticket-open{display:block}.sp-ticket.compact .sp-form{display:none}.sp-ticket.sent{padding:10px 14px}.sp-sent{margin:0;font-size:12.5px;color:#20b26b;font-weight:700}',
      '.sp-form-k{margin:0 0 3px;font-size:11.5px;font-weight:800;color:#0868f2}.sp-form h3{margin:0 0 6px;font-size:16px;color:#111820}.sp-form-sub{margin:0 0 10px;font-size:12.5px;line-height:1.6;color:#4a5462}.sp-form-sub b{color:#1d2430}',
      '.sp-attach{margin:0 0 11px;padding:9px 11px;border-radius:11px;background:#f4f8fd;font-size:12px;color:#36404d}.sp-attach ul{margin:4px 0 0;padding-left:17px;line-height:1.6}',
      '.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sp-grid label,.sp-more{display:grid;gap:4px;font-size:12px;color:#36404d}.sp-grid .wide,.sp-more{grid-column:1/-1}.sp-grid em{color:#e5484d;font-style:normal}.sp-grid small,.sp-more small{color:#8a93a0}',
      '.sp-form input:not([type=checkbox]):not([type=radio]),.sp-form select,.sp-form textarea{width:100%;box-sizing:border-box;min-height:40px;padding:9px 11px;border:1px solid #dbe2ec;border-radius:10px;background:#fbfcfe;font:14px/1.4 inherit;color:#111820}.sp-form textarea{resize:vertical}.sp-form input:focus,.sp-form select:focus,.sp-form textarea:focus{outline:2px solid rgba(8,104,242,.25);border-color:#0868f2;background:#fff}',
      '.sp-more{margin-top:8px}.sp-urg{margin:10px 0 0;padding:0;border:0;display:grid;gap:6px}.sp-urg legend{font-size:12px;color:#36404d;margin-bottom:5px}.sp-urg label{display:flex;gap:8px;align-items:center;padding:9px 11px;border:1px solid #dbe2ec;border-radius:10px;font-size:13px;cursor:pointer}.sp-urg label.on{border-color:#0868f2;background:#f0f6ff}',
      '.sp-agree{display:flex;gap:8px;align-items:flex-start;margin:11px 0 0;font-size:11.5px;line-height:1.55;color:#4a5462}.sp-agree input{margin-top:2px}.sp-agree a{color:#0868f2}',
      '.sp-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important}.sp-err{margin:9px 0 0;padding:8px 10px;border-radius:9px;background:#fff1f1;color:#b4232a;font-size:12.5px;line-height:1.55}.sp-err a{color:#0868f2;font-weight:700}',
      '.sp-submit{width:100%;min-height:46px;margin-top:11px;border:0;border-radius:12px;background:#0868f2;color:#fff;font:700 15px/1 inherit;cursor:pointer}.sp-submit:disabled{opacity:.6}',
      '.sp-done{background:#fff;border:1px solid #cdeedd;border-radius:18px;padding:16px;text-align:left;box-shadow:0 8px 24px rgba(32,178,107,.1)}.sp-done-i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#20b26b;color:#fff;font-weight:800;margin-bottom:8px}',
      '.sp-done-k{margin:0;font-size:11.5px;color:#20b26b;font-weight:800}.sp-done h3{margin:2px 0 6px;font-size:17px}.sp-done p{margin:0 0 8px;font-size:13px;line-height:1.6;color:#36404d}.sp-done ol{margin:0 0 8px;padding-left:18px;font-size:12.5px;line-height:1.7;color:#36404d}.sp-done-s{font-size:12px!important;color:#6a7480!important}',
      '.sp-empty{grid-column:1/-1;font-size:13px;color:#5a6472}',
      '@media(max-width:420px){.sp-cats{grid-template-columns:1fr}.sp-grid{grid-template-columns:1fr}}',
      /* /faqs — 사이트 다크 테마 */
      '.sf{margin-top:8px}.sf-search{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;border:1px solid var(--line-strong,#384358);border-radius:16px;background:var(--surface,#141C2E)}.sf-search span{font-size:17px}',
      '.sf-search input{flex:1;min-width:0;min-height:44px;border:0;background:transparent;color:var(--ink,#EEF1F6);font:16px/1.4 var(--fb,inherit)}.sf-search input:focus{outline:0}.sf-search:focus-within{border-color:var(--accent,#4A82C4);box-shadow:0 0 0 3px var(--accent-soft,rgba(74,130,196,.14))}',
      '.sf-search button,.sf-cta button{flex:none;min-height:44px;padding:0 16px;border:0;border-radius:11px;background:var(--btn-bg,#2E5C9A);color:#fff;font:700 14px/1 var(--fb,inherit);cursor:pointer}.sf-search button:hover,.sf-cta button:hover{background:var(--btn-bg-h,#244B80)}',
      '.sf-tabs{display:flex;gap:6px;overflow-x:auto;padding:16px 0 4px;scrollbar-width:none}.sf-tabs::-webkit-scrollbar{display:none}.sf-tab{flex:none;min-height:36px;padding:0 13px;border:1px solid var(--line,#26304A);border-radius:999px;background:transparent;color:var(--ink-mid,#B7BECD);font:500 13px/1 var(--fb,inherit);cursor:pointer;white-space:nowrap}',
      '.sf-tab:hover{border-color:var(--accent,#4A82C4);color:var(--ink,#EEF1F6)}.sf-tab.on{background:var(--accent-soft,rgba(74,130,196,.14));border-color:var(--accent,#4A82C4);color:var(--ink,#EEF1F6);font-weight:700}',
      '.sf-count{margin:8px 0 10px;font-size:12.5px;color:var(--ink-soft,#838C9E)}.sf-list{display:grid;gap:8px}',
      '.sf-item{border:1px solid var(--line,#26304A);border-radius:14px;background:var(--surface,#141C2E);overflow:hidden}.sf-item[open]{border-color:var(--line-strong,#384358)}',
      '.sf-item summary{display:grid;gap:5px;padding:15px 44px 15px 16px;cursor:pointer;list-style:none;position:relative}.sf-item summary::-webkit-details-marker{display:none}.sf-item summary::after{content:"+";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:20px;color:var(--ink-soft,#838C9E)}.sf-item[open] summary::after{content:"–"}',
      '.sf-tag{font-size:11.5px;color:var(--accent-dark,#6B9FD6);font-weight:700}.sf-q{font-size:15px;line-height:1.5;color:var(--ink,#EEF1F6);font-weight:600}',
      '.sf-a{padding:0 16px 16px;color:var(--ink-mid,#B7BECD);font-size:14px;line-height:1.7}.sf-lead{margin:0 0 10px;color:var(--ink,#EEF1F6)}.sf-a ol{margin:0 0 10px;padding-left:20px}.sf-a ol li{margin:3px 0}',
      '.sf-warn{margin:0 0 10px;padding:9px 12px;border-radius:10px;background:var(--accent-soft,rgba(74,130,196,.14));font-size:13px}.sf-note{margin:0 0 10px;padding-left:18px;font-size:13px;color:var(--ink-soft,#838C9E)}',
      '.sf-fb{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-top:11px;border-top:1px dashed var(--line,#26304A);font-size:13px}.sf-fb span{margin-right:auto}.sf-fb button{min-height:34px;padding:0 12px;border:1px solid var(--line-strong,#384358);border-radius:9px;background:transparent;color:var(--ink,#EEF1F6);font:500 13px/1 var(--fb,inherit);cursor:pointer}.sf-fb button:hover,.sf-fb .go{border-color:var(--accent,#4A82C4)}.sf-fb .go{background:var(--btn-bg,#2E5C9A);color:#fff}',
      '.sf-empty{padding:22px;border:1px dashed var(--line,#26304A);border-radius:14px;text-align:center;color:var(--ink-soft,#838C9E)}',
      '.sf-cta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:22px;padding:18px;border:1px solid var(--line,#26304A);border-radius:16px;background:linear-gradient(135deg,rgba(74,130,196,.12),rgba(74,130,196,.03))}.sf-cta div{flex:1 1 260px;display:grid;gap:4px}.sf-cta b{color:var(--ink,#EEF1F6);font-size:15px}.sf-cta span{color:var(--ink-mid,#B7BECD);font-size:13px;line-height:1.55}',
      '.sf-cta .ghost{background:transparent;border:1px solid var(--line-strong,#384358);color:var(--ink,#EEF1F6)}.sf-cta .ghost:hover{background:transparent;border-color:var(--accent,#4A82C4)}',
      '@media(max-width:640px){.sf-search{flex-wrap:wrap;padding:8px}.sf-search input{flex-basis:calc(100% - 40px)}.sf-search button{width:100%}.sf-cta button{flex:1 1 100%}}'
    ].join('');
    d.head.appendChild(s);
  }

  w.MKSupport = { ensure: ensure, mount: mount, ask: ask, reset: reset, openTicket: function (o) { if (root) openTicket(o); }, renderFaq: renderFaq, open: openMoni };
})(window, document);
