/** 사이트 내 유입·이동 기록 + 공통 팝업 설정 (2026-09-23)
 *
 *    POST /api/track   js/monnit-track.js 가 모아서 보내는 이벤트 묶음을 원장에 남긴다.
 *                      track 저장소 · 키 YYYY-MM.jsonl (한 묶음 = 조각 파일 하나, 읽고-덮어쓰기 없음)
 *                      조각은 proposal-dispatch(10분마다)가 합친다.
 *    GET  /api/popup   js/monnit-popup.js 가 읽는 팝업 설정. /ops/flow 스위치로 바뀐다.
 *
 *  개인 식별 정보는 받지도 남기지도 않는다 — IP·쿠키·입력값 없음, 탭 단위 난수만.
 *  관제(/ops)에 로그인한 브라우저의 기록은 in:1 로 표시해 기본 집계에서 뺀다.
 *  기록이 실패해도 항상 204 — 사이트 동작에 영향을 주지 않는다. */
import { get, set, shardKey } from './_store.mjs';
import * as auth from './_ops_auth.mjs';
import { POPUP_KEY, POPUP_DEFAULT, channel } from './_track.mjs';

export const config = { path: ['/api/track', '/api/popup'] };


const BOTS = /bot|crawl|spider|slurp|yeti|daumoa|facebookexternalhit|meta-externalagent|headless|lighthouse|pagespeed|pingdom|uptime|python|curl|wget|node-fetch|axios|httpclient|java\//i;
const TZ = 'Asia/Seoul';
const monthKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(d) + '.jsonl';

const S = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
/* 같은 페이지가 여러 주소로 갈리지 않게 — /a.html · /a/ · /a/index.html → /a */
const P = v => {
  let s = S(v, 200);
  if (!s || s.charAt(0) !== '/') return s;
  const i = s.search(/[?#]/), q = i >= 0 ? s.slice(i) : '';
  let p = i >= 0 ? s.slice(0, i) : s;
  p = p.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
  return (p + q).slice(0, 200);
};

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');

  /* ── 팝업 설정 ─────────────────────────────────────────────── */
  if (path === '/api/popup') {
    let cfg = POPUP_DEFAULT;
    try { const t = await get('ops', POPUP_KEY); if (t) cfg = { ...POPUP_DEFAULT, ...JSON.parse(t) }; } catch (e) {}
    return new Response(JSON.stringify({ on: !!cfg.on, pet: cfg.pet !== false }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        /* 브라우저는 매번 확인, CDN 은 60초 — 스위치가 1분 안에 전 페이지에 반영된다 */
        'cache-control': 'public, max-age=0, must-revalidate',
        'netlify-cdn-cache-control': 'public, s-maxage=60, stale-while-revalidate=30',
        'x-robots-tag': 'noindex'
      }
    });
  }

  /* ── 이벤트 기록 ───────────────────────────────────────────── */
  const done = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  try {
    const h = req.headers;
    if (BOTS.test(h.get('user-agent') || '')) return done();
    /* 다른 사이트에서 찔러 넣는 기록은 받지 않는다 */
    const sfs = h.get('sec-fetch-site');
    if (sfs && sfs !== 'same-origin' && sfs !== 'none') return done();
    const raw = await req.text();
    if (!raw || raw.length > 20000) return done();
    const b = JSON.parse(raw);
    if (!b || typeof b !== 'object' || !Array.isArray(b.ev)) return done();

    const sid = S(b.sid, 16).replace(/[^a-z0-9]/gi, '');
    if (!sid) return done();
    const dv = b.dv === 'm' ? 'm' : 'd';
    const src = S(b.src, 300);
    const internal = auth.configured() && auth.valid(auth.cookieFrom({ cookie: h.get('cookie') || '' })) ? 1 : 0;
    const now = Date.now();

    const lines = [];
    for (const e of b.ev.slice(0, 40)) {
      if (!e || typeof e !== 'object') continue;
      const t = ['pv', 'click', 'ev'].includes(e.t) ? e.t : null;
      if (!t) continue;
      /* 브라우저 시각이 크게 틀리면 서버 시각을 쓴다 */
      const cts = Number(e.ts);
      const ts = (cts && Math.abs(cts - now) < 36e5) ? cts : now;
      const row = { ts: new Date(ts).toISOString(), sid, dv, t, p: P(e.p) || '/' };
      if (internal) row.in = 1;
      if (t === 'pv') {
        if (e.q) row.q = S(e.q, 160);
        if (e.f) row.f = P(e.f);
        if (e.tt) row.tt = S(e.tt, 80);
        if (src) { row.src = src; row.ch = channel(src); }
      } else {
        if (e.l) row.l = S(e.l, 60);
        if (e.to) row.to = P(e.to);
        if (e.z) row.z = S(e.z, 30);
        if (t === 'ev') row.n = S(e.n, 40);
      }
      lines.push(JSON.stringify(row));
    }
    if (lines.length) await set('track', shardKey(monthKey(new Date(now))), lines.join('\n'));
  } catch (e) { /* 기록 실패는 무시 */ }
  return done();
};
