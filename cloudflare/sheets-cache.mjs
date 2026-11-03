/* ============================================================
   CMS 구글 시트 묶음 캐시 — GET /api/sheets?tabs=Customers,Awards,…  (2026-10-14)
   ------------------------------------------------------------
   예전: 방문자 브라우저가 페이지마다 구글 시트 탭 18개를 「캐시 금지」로 따로 받았다
         (페이지당 요청 18번 · 약 230KB · 구글 쪽 속도 제한에 걸리면 기본 데이터로 떨어짐).
   지금: Worker 가 18개를 한 번에 받아 Cloudflare 가장자리에 보관하고, 방문자는 한 번만 받는다.
     · 60초가 지나면 다음 방문자에게는 보관본을 바로 주고, 뒤에서 새로 받아 둔다(기다림 없음)
     · 구글이 실패하면 마지막 정상본을 계속 준다(최대 하루)
     · 시트 편집은 1~2분 안에 반영. 바로 보려면 페이지 주소 뒤에 ?fresh=1
     · 우리 사이트 시트(CONTENT_SHEET_ID)만 받는다 — 다른 시트 중계 금지
   ============================================================ */
const DEFAULT_SHEET = '1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc';
const FRESH_MS = 60 * 1000;
const KEEP_S = 86400;
const R2_EVERY_MS = 5 * 60 * 1000;
let R2_SAVED_AT = 0;

const json = (o, s = 200, extra = {}) => new Response(JSON.stringify(o), {
  status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'x-robots-tag': 'noindex', ...extra }
});

function parseTabs(q) {
  const tabs = String(q || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!tabs.length || tabs.length > 30) return null;
  for (const t of tabs) if (!/^[\w가-힣 .-]{1,40}$/.test(t)) return null;
  return tabs;
}

async function pullAll(id, tabs, prev) {
  const f = globalThis.__MNK_REAL_FETCH || fetch;
  const out = {}; let ok = 0;
  await Promise.all(tabs.map(async t => {
    try {
      const r = await f(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(t)}`, {
        headers: { 'user-agent': 'monnit-sheets-cache' }, cf: { cacheTtl: 0 }
      });
      const txt = await r.text();
      /* 구글 로그인·오류 화면(HTML)은 시트 내용이 아니다 */
      if (!r.ok || /^\s*<(!doctype|html)/i.test(txt)) throw new Error('HTTP ' + r.status);
      out[t] = txt; ok++;
    } catch (e) {
      if (prev && typeof prev[t] === 'string') out[t] = prev[t];   /* 실패한 탭은 지난 값 유지 */
    }
  }));
  return { tabs: out, ok };
}

export async function sheetsRoute(req, env, ctx) {
  const u = new URL(req.url);
  if (u.pathname !== '/api/sheets') return null;
  if (req.method !== 'GET') return json({ ok: false, error: 'method' }, 405);
  const id = String(env.CONTENT_SHEET_ID || DEFAULT_SHEET);
  const tabs = parseTabs(u.searchParams.get('tabs'));
  if (!tabs) return json({ ok: false, error: 'tabs' }, 400);
  const fresh = u.searchParams.get('fresh') === '1';

  const cache = (typeof caches !== 'undefined' && caches.default) || null;
  const key = new Request('https://sheets-cache.monnit.internal/' + id + '/' + encodeURIComponent(tabs.slice().sort().join(',')));
  const r2key = '__cache/sheets/' + id + '/' + encodeURIComponent(tabs.slice().sort().join(','));
  /* 보관본은 방문자에게 줄 JSON 그대로 — 꺼낼 때 다시 해석하지 않는다(무료 플랜 CPU 10ms) */
  const out = (text, at, state) => new Response(text, { headers: {
    'content-type': 'application/json; charset=utf-8', 'x-robots-tag': 'noindex',
    'cache-control': 'public, max-age=30', 'x-sheets-cache': state, 'x-sheets-at': at } });
  const save = (text, at) => {
    if (!cache) return Promise.resolve();
    return cache.put(key, new Response(text, { headers: { 'content-type': 'application/json', 'x-sheets-at': at, 'cache-control': `public, s-maxage=${KEEP_S}` } })).catch(() => {});
  };
  const build = async (prevText) => {
    let n = await pullAll(id, tabs, null);
    if (n.ok < tabs.length && prevText) {       /* 일부 탭 실패 — 그 탭만 지난 값으로 메운다 */
      try { n = { tabs: { ...(JSON.parse(prevText).tabs || {}), ...n.tabs }, ok: n.ok }; } catch (e) { /* 그대로 */ }
    }
    if (!n.ok) return null;
    const at = new Date().toISOString();
    return { at, text: JSON.stringify({ ok: true, at, tabs: n.tabs }) };
  };

  let hit = null;
  if (cache && !fresh) { try { hit = await cache.match(key); } catch (e) { hit = null; } }
  if (hit) {
    const at = hit.headers.get('x-sheets-at') || '';
    if (Date.now() - Date.parse(at) < FRESH_MS) return out(hit.body, at, 'hit');
    /* 오래됨 — 지금은 보관본을 주고 뒤에서 새로 받는다 */
    const [a, b] = hit.body.tee();
    ctx.waitUntil(new Response(b).text().then(build).then(r => r && saveAll(r.text, r.at)).catch(() => {}));
    return out(a, at, 'stale');
  }
  /* 2026-11-03 속도 — 이 지역(Cloudflare 가장자리) 보관본이 없을 때.
     가장자리 보관은 지역마다 따로라, 방문이 드문 서울·도쿄 쪽은 자주 비어 있었다.
     그때마다 방문자가 구글 시트 18개 탭을 받는 동안(0.6~2초) 기다렸다.
     이제 R2 에 둔 마지막 정상본을 바로 주고(약 0.05초), 새 값은 뒤에서 받아 둔다. */
  if (!fresh && env.BLOBS) {
    let o = null;
    try { o = await env.BLOBS.get(r2key); } catch (e) { o = null; }
    if (o) {
      const at = (o.customMetadata && o.customMetadata.at) || '';
      const text = await o.text();
      const old = !at || Date.now() - Date.parse(at) >= FRESH_MS;
      ctx.waitUntil((old ? build(text).then(r => r && saveAll(r.text, r.at)) : save(text, at)).catch(() => {}));
      return out(text, at, 'r2');
    }
  }
  const r = await build(null);
  if (!r) return json({ ok: false, error: 'upstream' }, 502, { 'cache-control': 'no-store' });
  ctx.waitUntil(saveAll(r.text, r.at));
  return out(r.text, r.at, 'miss');

  /* 가장자리 + R2 에 함께 보관 — R2 쓰기는 한 Worker 당 5분에 한 번까지(무료 한도 절약) */
  function saveAll(text, at) {
    const jobs = [save(text, at)];
    if (env.BLOBS && Date.now() - R2_SAVED_AT > R2_EVERY_MS) {
      R2_SAVED_AT = Date.now();
      jobs.push(env.BLOBS.put(r2key, text, { httpMetadata: { contentType: 'application/json' }, customMetadata: { at } }).catch(() => {}));
    }
    return Promise.all(jobs);
  }
}
