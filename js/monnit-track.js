/*! Monnit Korea — 사이트 내 유입·이동 추적 v1 (2026-09-23)
 *
 *  「어디서 들어와서 · 무엇을 눌러 · 어디로 갔는가」를 /ops/flow 에서 보기 위한 기록.
 *
 *  남기는 것 (개인 식별 정보 없음 — 쿠키·IP·입력값 모두 저장하지 않는다)
 *    pv     페이지 보기     p=지금 경로, f=직전 경로(사이트 안) 또는 ext:외부도메인
 *    click  클릭           p=누른 페이지, l=버튼/링크 문구, to=이동할 곳, z=위치(nav/header/footer…)
 *    ev     그 밖의 신호     n=이름 (팝업 노출·클릭·닫기 등) — MonnitTrack.event(n, {...})
 *  세션 구분은 탭 단위 난수(sessionStorage)만 쓴다. 탭을 닫으면 사라진다.
 *
 *  전송: 모아서 4초마다 / 10건마다 / 페이지를 떠날 때 sendBeacon 한 번.
 *  SPA(app.js) 의 history.pushState 이동도 페이지 보기로 잡는다.
 *  끄기: 이 파일을 불러오는 <script> 한 줄을 지우거나, window.MNK_TRACK_OFF = true
 */
(function (w, d) {
  'use strict';
  if (w.MonnitTrack || w.MNK_TRACK_OFF) return;
  var loc = w.location;
  if (/^\/(ops|editor)(\/|$)/.test(loc.pathname)) return;           /* 관리 화면은 제외 */
  if (w.navigator && w.navigator.webdriver) return;                   /* 자동화 브라우저 */

  var API = '/api/track';
  var ss = null; try { ss = w.sessionStorage; } catch (e) {}
  function sget(k) { try { return ss ? ss.getItem(k) : null; } catch (e) { return null; } }
  function sset(k, v) { try { if (ss) ss.setItem(k, v); } catch (e) {} }

  /* 탭 세션 id */
  var sid = sget('mk_trk_sid');
  if (!sid) { sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(-12); sset('mk_trk_sid', sid); }

  /* 최초 유입 출처 — monnit-lead.js 와 같은 규칙(세션 최초 값 보존) */
  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid', 'naver_ad', 'kakao_ad', 'promo', 'from'];
  function capture() {
    try {
      var p = new URLSearchParams(loc.search), out = [];
      PARAMS.forEach(function (k) { var v = p.get(k); if (v) out.push(k + '=' + v.slice(0, 60)); });
      if (!out.length && d.referrer) {
        var r = new URL(d.referrer);
        if (r.hostname !== loc.hostname) out.push('ref=' + r.hostname);
      }
      return out.join(' · ');
    } catch (e) { return ''; }
  }
  var src = sget('mk_trk_src');
  if (!src) { src = capture() || 'direct'; sset('mk_trk_src', src); }

  var dv = /iphone|ipad|ipod|android|mobile/i.test(w.navigator.userAgent || '') ? 'm' : 'd';

  /* ── 전송 큐 ─────────────────────────────────────────────── */
  var Q = [], timer = null, sentSrc = false;
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!Q.length) return;
    var batch = Q.splice(0, 40);
    var body = JSON.stringify({ sid: sid, dv: dv, src: sentSrc ? '' : src, ev: batch });
    sentSrc = true;
    try {
      if (w.navigator.sendBeacon && w.navigator.sendBeacon(API, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try { w.fetch && w.fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {}); } catch (e) {}
  }
  var first = true;
  function push(o) {
    o.ts = Date.now();
    Q.push(o);
    if (Q.length >= 10) flush();
    /* 첫 묶음은 빨리(1.5초) — 한 페이지만 보고 떠나는 방문도 놓치지 않게. 이후는 4초 */
    else if (!timer) { timer = setTimeout(flush, first ? 1500 : 4000); first = false; }
  }
  w.addEventListener('pagehide', flush);
  d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') flush(); });

  var cut = function (s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); };
  /* 추적용 파라미터는 경로에서 빼고, 의미 있는 쿼리만 남긴다 */
  function qs(search) {
    try {
      var p = new URLSearchParams(search), out = [];
      p.forEach(function (v, k) { if (!/^(utm_|gclid|gbraid|wbraid|fbclid|_gl|msclkid)/.test(k)) out.push(k + '=' + v); });
      return cut(out.join('&'), 160);
    } catch (e) { return ''; }
  }

  /* ── 페이지 보기 ─────────────────────────────────────────── */
  var cur = loc.pathname;
  function firstFrom() {
    try {
      if (d.referrer) {
        var r = new URL(d.referrer);
        if (r.hostname === loc.hostname) return r.pathname;
        return 'ext:' + r.hostname.replace(/^www\./, '');
      }
    } catch (e) {}
    var prev = sget('mk_trk_prev');
    return prev || '';
  }
  function pageview(from, lateTitle) {
    var o = { t: 'pv', p: cut(loc.pathname, 160), q: qs(loc.search), f: cut(from, 160), tt: cut(d.title, 80) };
    push(o);
    sset('mk_trk_prev', loc.pathname);
    /* SPA 는 제목을 조금 늦게 바꾼다 — 아직 안 보냈으면 제목만 고쳐 둔다 */
    if (lateTitle) setTimeout(function () { if (Q.indexOf(o) >= 0) o.tt = cut(d.title, 80); }, 500);
  }
  pageview(firstFrom());

  var t0 = Date.now();
  function onRoute(isReplace) {
    if (loc.pathname === cur) return;          /* 쿼리·해시만 바뀐 건 같은 페이지 */
    /* 첫 화면에서 SPA 가 주소만 정리하는 replaceState (예: /#x → /x) 는 새 페이지가 아니다.
       아직 안 보낸 첫 페이지 보기의 경로만 고친다. */
    if (isReplace && Date.now() - t0 < 2500 && Q.length && Q[0].t === 'pv') {
      cur = loc.pathname; Q[0].p = cut(cur, 160); Q[0].q = qs(loc.search); sset('mk_trk_prev', cur); return;
    }
    var from = cur; cur = loc.pathname;
    pageview(from, true);
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = w.history && w.history[m];
    if (!orig) return;
    w.history[m] = function () { var r = orig.apply(this, arguments); try { onRoute(m === 'replaceState'); } catch (e) {} return r; };
  });
  w.addEventListener('popstate', function () { try { onRoute(false); } catch (e) {} });

  /* ── 클릭 ───────────────────────────────────────────────── */
  function where(el) {
    var z = el.closest('[data-zone]');
    if (z) return cut(z.getAttribute('data-zone'), 30);
    var t = el.closest('nav,header,footer,aside,dialog,[role="dialog"]');
    if (!t) return '';
    return t.getAttribute('role') === 'dialog' ? 'dialog' : t.tagName.toLowerCase();
  }
  function labelOf(el) {
    var v = el.getAttribute('data-track') || el.getAttribute('data-cta') || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    if (!v) v = el.innerText || el.textContent || '';
    if (!cut(v, 60)) { var img = el.querySelector('img[alt]'); if (img) v = img.getAttribute('alt'); }
    return cut(v, 60);
  }
  function target(el) {
    var href = el.getAttribute && el.getAttribute('href');
    if (!href || href === '#' || /^javascript:/i.test(href)) return '';
    if (/^tel:/i.test(href)) return 'tel';
    if (/^mailto:/i.test(href)) return 'mail';
    if (href.charAt(0) === '#') return '#' + cut(href.slice(1), 40);
    try {
      var u = new URL(href, loc.href);
      if (u.hostname === loc.hostname) return cut(u.pathname + (qs(u.search) ? '?' + qs(u.search) : ''), 200);
      return 'ext:' + u.hostname.replace(/^www\./, '') + cut(u.pathname, 60);
    } catch (e) { return ''; }
  }
  d.addEventListener('click', function (e) {
    try {
      var el = e.target && e.target.closest && e.target.closest('a[href],button,[data-cta],[data-track],[role="button"],summary');
      if (!el || el.hasAttribute('data-track-off')) return;
      if (el.closest('input,textarea,select,[contenteditable="true"]')) return;
      push({ t: 'click', p: cut(loc.pathname, 160), l: labelOf(el), to: target(el), z: where(el) });
    } catch (x) {}
  }, true);

  w.MonnitTrack = {
    event: function (name, props) {
      var o = { t: 'ev', p: cut(loc.pathname, 160), n: cut(name, 40) };
      if (props && props.l) o.l = cut(props.l, 60);
      if (props && props.to) o.to = cut(props.to, 200);
      push(o);
    },
    flush: flush,
    sid: function () { return sid; }
  };
})(window, document);
