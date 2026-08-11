/** Netlify Blobs 최소 클라이언트 — 외부 패키지 없이 REST 로 직접 쓴다.
 *  · 실패해도 절대 예외를 던지지 않는다(리드 유실 방지가 최우선).
 *  · 저장 실패 시 false 만 돌려주고, 호출부는 메일 경로로 계속 진행한다. */
function ctx() {
  try {
    const raw = process.env.NETLIFY_BLOBS_CONTEXT;
    if (!raw) return null;
    const c = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (!c || !c.apiURL || !c.token || !c.siteID) return null;
    return c;
  } catch (e) { return null; }
}

function url(c, store, key) {
  return `${c.apiURL}/api/v1/blobs/${c.siteID}/${encodeURIComponent(store)}/${encodeURIComponent(key)}`;
}

async function get(store, key) {
  const c = ctx(); if (!c) return null;
  try {
    const r = await fetch(url(c, store, key), { headers: { authorization: `Bearer ${c.token}` } });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    return await r.text();
  } catch (e) { return null; }
}

async function set(store, key, text) {
  const c = ctx(); if (!c) return false;
  try {
    const r = await fetch(url(c, store, key), {
      method: 'PUT',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'text/plain; charset=utf-8' },
      body: text
    });
    return r.ok;
  } catch (e) { return false; }
}

/** 한 줄씩 이어 붙이는 방식(JSON Lines) — 읽고 쓰는 비용이 가장 작다 */
async function append(store, key, obj) {
  const cur = (await get(store, key)) || '';
  const line = JSON.stringify(obj);
  return set(store, key, cur ? cur + '\n' + line : line);
}

async function readLines(store, key) {
  const t = await get(store, key);
  if (!t) return [];
  return t.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

module.exports = { get, set, append, readLines, available: () => !!ctx() };
