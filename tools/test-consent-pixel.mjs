/* 동의 모드 ↔ 메타 픽셀 검증
 *   node tools/test-consent-pixel.mjs
 *
 * 2026-11-13 — 운영에서 실측한 증상을 고정한다.
 *   신규 방문자(동의 전)에게는 fbq 가 아예 없어 랜딩 조회가 안 잡혔다.
 *   안내형(notice) 모드에서는 첫 로드에 바로 픽셀이 올라와야 한다.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONSENT = fs.readFileSync(path.join(ROOT, 'js/monnit-consent.js'), 'utf8');
const LEAD    = fs.readFileSync(path.join(ROOT, 'js/monnit-lead.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  — ' + extra : '')); }
};

/* ── 브라우저 흉내 ───────────────────────────────────────── */
function makeEnv({ cmode = '', mobile = false, saved = null, gtmPixel = false } = {}) {
  const listeners = {};
  const scripts = [];
  const store = {};
  if (saved) store['mnk_cookie_consent_v1'] = JSON.stringify(Object.assign({ v: 1, ts: '2026-11-01T00:00:00.000Z' }, saved));

  const mkEl = (tag) => ({
    tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [], attrs: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'src') this.src = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(c) { this.children.push(c); if (c.src) scripts.push(c.src); return c; },
    addEventListener() {}, removeEventListener() {}, remove() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, insertAdjacentHTML() {}, focus() {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; }
  });

  const head = mkEl('head'), body = mkEl('body');
  const d = {
    readyState: 'complete', cookie: cmode ? 'mk_cmode=' + cmode : '',
    head, body, documentElement: mkEl('html'), currentScript: null,
    createElement: mkEl,
    getElementsByTagName: () => [{ parentNode: head }],
    getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    removeEventListener() {},
    dispatchEvent(e) { (listeners[e.type] || []).forEach(f => f(e)); return true; }
  };

  const w = {
    document: d, location: { href: 'https://monnit.co.kr/promo/proposal/', search: '', pathname: '/promo/proposal/', hostname: 'monnit.co.kr' },
    navigator: { userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Mozilla/5.0 (Macintosh)', maxTouchPoints: mobile ? 5 : 0, sendBeacon: () => true },
    matchMedia: (q) => ({ matches: mobile && /max-width/.test(q), addListener(){}, addEventListener(){} }),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    dataLayer: [], MONNIT_CONSENT_CONFIG: { gtmId: 'GTM-T8H73VW' },
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    removeEventListener() {},
    dispatchEvent(e) { (listeners[e.type] || []).forEach(f => f(e)); return true; },
    setTimeout: (f) => { queue.push(f); return 0; },
    clearTimeout() {},
    setInterval: (f) => { intervals.push(f); return intervals.length; },
    clearInterval(id) { intervals[id - 1] = null; },
    requestAnimationFrame: (f) => { queue.push(f); return 0; },
    cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    crypto: { randomUUID: () => 'uuid-test-0001' },
    fetch: () => Promise.resolve({ ok: true }),
    console
  };
  const queue = [], intervals = [];
  w.window = w; w.self = w; w.top = w;
  d.defaultView = w;

  /* CustomEvent 흉내 */
  w.CustomEvent = function (type, init) { return { type, detail: init && init.detail }; };

  const ctx = vm.createContext(w);
  const run = (code, name) => vm.runInContext('(function(window,document){' + code + '})(window,document);', ctx, { filename: name });

  /* GTM 이 메타 픽셀을 올리는 상황 흉내 — fbevents.js 가 뜬 뒤 callMethod 가 생긴다 */
  const landFbevents = () => {
    const f = w.fbq;
    if (!f) return false;
    f.callMethod = function () { (f.sent ||= []).push([].slice.call(arguments)); };
    const q = f.queue || [];
    q.forEach(a => f.callMethod.apply(null, a));
    f.queue = [];
    return true;
  };

  return {
    w, d, scripts,
    drain(times = 60) { for (let i = 0; i < times; i++) { queue.splice(0).forEach(f => f()); intervals.filter(Boolean).forEach(f => f()); } },
    run, landFbevents,
    gtmInstallsPixel() {        /* GTM 태그가 직접 스니펫을 올린 상황 */
      const n = w.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      landFbevents();
    },
    consent(state) {            /* 방문자가 배너를 누른 상황 */
      w.MonnitConsent.state = state;
      w.dispatchEvent(new w.CustomEvent('monnit:consent', { detail: state }));
    },
    sent: () => (w.fbq && w.fbq.sent) || []
  };
}

/* ── [A] 옵트인 · 신규 방문자 — 지금 운영에서 나는 증상 ── */
console.log('\n[A] 옵트인 · 동의 전 — 픽셀이 올라오면 안 된다(현행 동작 고정)');
{
  const e = makeEnv({ cmode: '', mobile: true });
  e.run(CONSENT, 'monnit-consent.js'); e.run(LEAD, 'monnit-lead.js'); e.drain();
  ok('consentMode 가 optin', e.w.MonnitConsent.mode() === 'optin', e.w.MonnitConsent.mode());
  ok('marketing 동의 없음', e.w.MonnitConsent.state.marketing === false);
  ok('fbq 미설치 (= 랜딩 조회 0건의 원인)', typeof e.w.fbq === 'undefined');
  ok('fbevents.js 요청 없음', !e.scripts.some(s => /fbevents/.test(s)));
}

/* ── [B] 안내형 · 신규 방문자 — 이번 변경의 핵심 ── */
console.log('\n[B] 안내형(notice) · 첫 로드 — 배너를 누르지 않아도 픽셀이 떠야 한다');
{
  const e = makeEnv({ cmode: 'notice', mobile: true });
  e.run(CONSENT, 'monnit-consent.js'); e.run(LEAD, 'monnit-lead.js'); e.drain();
  ok('consentMode 가 notice', e.w.MonnitConsent.mode() === 'notice', e.w.MonnitConsent.mode());
  ok('marketing 기본 허용', e.w.MonnitConsent.state.marketing === true);
  ok('fbq 설치됨', typeof e.w.fbq === 'function');
  ok('fbevents.js 로드 요청', e.scripts.some(s => /connect\.facebook\.net\/en_US\/fbevents\.js/.test(s)));
  e.landFbevents(); e.drain();
  const sent = e.sent().map(a => a.slice(0, 2).join(':'));
  ok('init 호출', sent.includes('init:1375041798098647'), JSON.stringify(sent));
  ok('PageView 발사', sent.includes('track:PageView'), JSON.stringify(sent));
}

/* ── [C] 안내형 · 거부한 방문자 — 거부가 반드시 먹혀야 한다 ── */
console.log('\n[C] 안내형 · 거부 이력이 있는 재방문자 — 픽셀이 뜨면 안 된다');
{
  const e = makeEnv({ cmode: 'notice', mobile: true, saved: { analytics: false, marketing: false } });
  e.run(CONSENT, 'monnit-consent.js'); e.run(LEAD, 'monnit-lead.js'); e.drain();
  ok('저장된 거부가 유지됨', e.w.MonnitConsent.state.marketing === false);
  ok('fbq 미설치', typeof e.w.fbq === 'undefined');
}

/* ── [D] 옵트인 · 뒤늦게 동의 — 후크 재무장(이번 수정) ── */
console.log('\n[D] 옵트인 · 뒤늦게 동의 — 중복방지 후크가 다시 걸려야 한다');
{
  const e = makeEnv({ cmode: '', mobile: true });
  e.run(CONSENT, 'monnit-consent.js'); e.run(LEAD, 'monnit-lead.js');
  e.drain(60);                                   /* 로드 직후 재시도 8초치를 모두 소진 */
  ok('아직 fbq 없음', typeof e.w.fbq === 'undefined');
  e.gtmInstallsPixel();                          /* 동의 순간 GTM 이 픽셀을 올린다 */
  e.consent({ analytics: true, marketing: true });
  e.drain(60);
  ok('fbq.callMethod 에 후크가 걸림', !!(e.w.fbq && e.w.fbq.callMethod && e.w.fbq.callMethod.__mk),
     '걸리지 않으면 랜딩이 쏜 Lead 를 못 보고 한 번 더 쏴 중복 집계된다');
}

/* ── [E] Lead 중복 방지가 실제로 동작하는가 ── */
console.log('\n[E] 랜딩이 스스로 Lead 를 쏜 경우 — 우리가 또 쏘면 안 된다');
{
  const e = makeEnv({ cmode: 'notice', mobile: true });
  e.run(CONSENT, 'monnit-consent.js'); e.run(LEAD, 'monnit-lead.js');
  e.drain(3);                                                 /* fbevents.js 는 보통 1초 안에 뜬다 */
  e.landFbevents(); e.drain(3);
  e.w.fbq('track', 'Lead', { page: 'self' });                 /* 페이지가 직접 쏨 */
  const before = e.sent().filter(a => a[1] === 'Lead').length;
  e.w.MonnitLead.track('contact', { page: 'promo_proposal', interest: '테스트' });
  const after = e.sent().filter(a => a[1] === 'Lead').length;
  ok('Lead 가 1건으로 유지', before === 1 && after === 1, 'before=' + before + ' after=' + after);
}

/* ── [F] 정상 Lead 발사 ── */
console.log('\n[F] 안내형 · 랜딩이 안 쏘는 페이지 — 우리가 Lead 를 쏴야 한다');
{
  const e = makeEnv({ cmode: 'notice', mobile: true });
  e.run(CONSENT, 'monnit-consent.js'); e.run(LEAD, 'monnit-lead.js');
  e.drain(3); e.landFbevents(); e.drain(3);
  e.w.MonnitLead.build('contact', 'promo_consulting', '무료체험', {});
  e.w.MonnitLead.track('contact', { page: 'promo_consulting', interest: '무료체험' });
  const leads = e.sent().filter(a => a[1] === 'Lead');
  ok('Lead 1건 발사', leads.length === 1, 'count=' + leads.length);
  ok('eventID 동봉(CAPI 중복제거용)', !!(leads[0] && leads[0][3] && leads[0][3].eventID));
  ok('content_name 전달', !!(leads[0] && leads[0][2] && leads[0][2].content_name === '무료체험'));
}

/* ── [G] 동의 라이브러리가 없는 페이지 ── */
console.log('\n[G] monnit-consent.js 가 없는 페이지 — 터지지 않고 보수적으로 동작');
{
  const e = makeEnv({ cmode: 'notice' });
  let threw = null;
  try { e.run(LEAD, 'monnit-lead.js'); e.drain(); } catch (err) { threw = err; }
  ok('예외 없음', !threw, threw && threw.message);
  ok('동의 정보가 없으면 픽셀 미설치', typeof e.w.fbq === 'undefined');
}

console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + ' pass / ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
