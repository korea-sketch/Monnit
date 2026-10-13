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

/* 검사용 가짜 저장소 — tools/test-race.mjs 가 끼워 넣는다.
   실제 배포에서는 이 값이 없으므로 아래 Netlify Blobs 경로로만 간다. */
const fake = () => globalThis.__MNK_FAKE_BLOBS || null;

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
  const F = fake(); if (F) return F.get(store, key);
  const s = await open(store); if (!s) return null;
  try { return await s.get(key, { type: 'text' }); }
  catch (e) { _err = 'get 실패: ' + (e && e.message || e); return null; }
}

export async function set(store, key, text) {
  const F = fake(); if (F) return F.set(store, key, text);
  const s = await open(store); if (!s) return false;
  try { await s.set(key, text); return true; }
  catch (e) { _err = 'set 실패: ' + (e && e.message || e); return false; }
}

export async function list(store, prefix) {
  const F = fake(); if (F) return F.list(store, prefix);
  const s = await open(store); if (!s) return [];
  try {
    const r = await s.list({ prefix });
    return ((r && r.blobs) || []).map(b => b.key);
  } catch (e) { _err = 'list 실패: ' + (e && e.message || e); return []; }
}

export async function del(store, key) {
  const F = fake(); if (F) return F.del(store, key);
  const s = await open(store); if (!s) return false;
  try { await s.delete(key); return true; }
  catch (e) { _err = 'delete 실패: ' + (e && e.message || e); return false; }
}

/* 한 건을 한 파일로 — 같은 순간에 두 건이 들어와도 서로 덮지 않는다. (2026-09-18)
   예전에는 「기존 내용을 읽어 → 한 줄 붙여 → 통째로 다시 쓰기」였다.
   접수가 같은 초에 두 건 오면 나중 것이 먼저 것을 지워, 리드가 조용히 사라졌다.
   이제 append 는 읽지 않고 새 파일만 만든다. 덮어쓸 대상이 없으니 유실도 없다.
   읽을 때(readLines) 옛 파일과 새 조각을 합쳐서 돌려주므로 기존 기록도 그대로 보인다. */
/* 조각 구분자 — 반드시 URL 경로에 그대로 살아남는 글자여야 한다. (2026-09-19)
   Blobs SDK 는 키를 URL 경로에 그대로 붙여 요청한다. 처음에 '#' 을 썼는데
   '#' 은 URL 에서 fragment 라 그 뒤가 잘려 나가, 조각이 아니라 원본 파일을
   덮어쓸 뻔했다(그달 원장이 한 줄로). '~' 는 RFC 3986 unreserved 라 안전하다.
   아래 shardKey 는 tools/test-race.mjs 가 new URL 로 왕복 검사한다. */
const SHARD = '~';
export const shardKey = key => key + SHARD + String(Date.now()).padStart(13, '0') + '-' + Math.random().toString(36).slice(2, 8);
export const SHARD_SEP = SHARD;

/** JSON Lines 한 건 — 조각 파일 하나로 남긴다(읽고-덮어쓰기 없음) */
export async function append(store, key, obj) {
  return set(store, shardKey(key), JSON.stringify(obj));
}

const parse = t => String(t || '').split('\n').filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

export async function readLines(store, key) {
  /* ① 예전 방식으로 쌓인 한 덩어리 파일 */
  const out = parse(await get(store, key));
  /* ② 새 방식의 조각들 — 키에 시각이 들어 있어 이름순 = 시간순 */
  const keys = (await list(store, key + SHARD)).sort();
  if (keys.length) {
    const parts = await Promise.all(keys.map(k => get(store, k).catch(() => null)));
    for (const t of parts) out.push(...parse(t));
  }
  return out;
}

/** 조각을 한 덩어리로 합친다 — 조각이 너무 많아졌을 때 /ops 에서 부른다.
 *  읽기 중에는 절대 하지 않는다. 합치는 동안 들어온 접수를 지울 수 있기 때문이다. */
export async function compact(store, key, { keep = 200 } = {}) {
  const keys = (await list(store, key + SHARD)).sort();
  if (keys.length <= keep) return { merged: 0, left: keys.length };
  const take = keys.slice(0, keys.length - keep);   /* 최근 것은 건드리지 않는다 */
  const parts = await Promise.all(take.map(k => get(store, k).catch(() => null)));
  const lines = [];
  for (const t of parts) for (const o of parse(t)) lines.push(JSON.stringify(o));
  if (!lines.length) return { merged: 0, left: keys.length };
  const cur = (await get(store, key)) || '';
  const ok = await set(store, key, cur ? cur + '\n' + lines.join('\n') : lines.join('\n'));
  if (!ok) return { merged: 0, left: keys.length, error: '합치기 실패' };
  for (const k of take) await del(store, k);
  return { merged: take.length, left: keys.length - take.length };
}

/** 저장소 하나의 조각 원장을 전부 훑어 많이 쌓인 것만 합친다. (2026-09-19)
 *  정기 점검(proposal-dispatch, 10분마다)이 잠금을 쥔 채 부른다.
 *  한 번에 오래 붙들지 않도록 시간 예산 안에서만 일하고 나머지는 다음 회차로 넘긴다. */
export async function compactAll(store, { keep = 50, budgetMs = 6000 } = {}) {
  const t0 = Date.now();
  const out = { store, ledgers: 0, merged: 0, skipped: 0 };
  const keys = await list(store, '');
  const groups = new Map();
  for (const k of keys) {
    const i = k.indexOf(SHARD);
    if (i > 0) { const base = k.slice(0, i); groups.set(base, (groups.get(base) || 0) + 1); }
  }
  for (const [base, n] of groups) {
    if (n <= keep) continue;
    if (Date.now() - t0 > budgetMs) { out.skipped++; continue; }
    const r = await compact(store, base, { keep });
    out.ledgers++; out.merged += r.merged || 0;
  }
  return out;
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
