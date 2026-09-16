/** 저장소 — Netlify Blobs 공식 SDK 사용.
 *  · 실패해도 예외를 던지지 않는다(리드 유실 방지가 최우선).
 *  · diag() 로 왜 안 되는지 확인할 수 있다. */
let _getStore = null, _err = '';

async function sdk() {
  if (_getStore) return _getStore;
  try {
    const m = await import('@netlify/blobs');
    _getStore = m.getStore;
    return _getStore;
  } catch (e) {
    _err = 'SDK 로드 실패: ' + (e && e.message || e);
    return null;
  }
}

async function open(name) {
  const g = await sdk();
  if (!g) return null;
  try {
    return g({ name, consistency: 'strong' });
  } catch (e) {
    _err = 'store 열기 실패: ' + (e && e.message || e);
    return null;
  }
}

export async function get(store, key) {
  const s = await open(store); if (!s) return null;
  try { return await s.get(key, { type: 'text' }); }
  catch (e) { _err = 'get 실패: ' + (e && e.message || e); return null; }
}

export async function set(store, key, text) {
  const s = await open(store); if (!s) return false;
  try { await s.set(key, text); return true; }
  catch (e) { _err = 'set 실패: ' + (e && e.message || e); return false; }
}

/** JSON Lines 로 한 줄씩 이어 붙인다 */
export async function append(store, key, obj) {
  const cur = (await get(store, key)) || '';
  const line = JSON.stringify(obj);
  return set(store, key, cur ? cur + '\n' + line : line);
}

export async function readLines(store, key) {
  const t = await get(store, key);
  if (!t) return [];
  return t.split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/** 연결 상태 점검 — 실제로 쓰고 읽어본다 */
export async function diag() {
  const out = {
    sdk: false, write: false, read: false, error: '',
    ctx: !!process.env.NETLIFY_BLOBS_CONTEXT,
    envs: Object.keys(process.env).filter(k => /NETLIFY|SITE|DEPLOY/i.test(k)).sort()
  };
  const g = await sdk();
  out.sdk = !!g;
  if (!g) { out.error = _err; return out; }
  const probe = 'diag_' + Date.now();
  out.write = await set('ops', probe, 'ok');
  out.read = (await get('ops', probe)) === 'ok';
  out.error = _err;
  return out;
}

export async function available() {
  return !!(await sdk());
}
