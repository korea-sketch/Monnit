/** 통합 관제(/ops) 로그인 공유 — _ops_auth.mjs 를 느슨하게 불러온다.
 *  /ops 에 로그인한 상태면 맞춤 제안서 관리(/ops/proposals)도 따로 로그인하지 않는다.
 *  _ops_auth.mjs 가 없는 사본에서는 false → 기존 관리 키 로그인만 쓴다. (guard.mjs 와 같은 방식) */
let _a;
async function load() {
  if (_a !== undefined) return _a;
  const name = '_ops_auth' + '.mjs';
  const cands = [];
  try { cands.push(new URL('./' + name, import.meta.url).href); } catch (e) { /* 무시 */ }
  try { cands.push(new URL('../../functions/' + name, import.meta.url).href); } catch (e) { /* 무시 */ }
  if (process.env.LAMBDA_TASK_ROOT) cands.push('file://' + process.env.LAMBDA_TASK_ROOT + '/netlify/functions/' + name);
  _a = null;
  for (const spec of cands) {
    try { const m = await import(spec); if (m && typeof m.valid === 'function') { _a = m; break; } } catch (e) { /* 다음 후보 */ }
  }
  return _a;
}

export async function opsAuthed(req) {
  try {
    const a = globalThis.__PROPOSAL_OPS_AUTH || await load();
    if (!a) return false;
    if (typeof a.configured === 'function' && !a.configured()) return false;
    const c = typeof a.cookieFrom === 'function' ? a.cookieFrom({ cookie: req.headers.get('cookie') || '' }) : req.headers.get('cookie') || '';
    return !!(await a.valid(c));
  } catch (e) { return false; }
}

export async function available() { try { return !!(globalThis.__PROPOSAL_OPS_AUTH || await load()); } catch (e) { return false; } }
