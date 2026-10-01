/** 경쟁사 차단(_guard.js) 연결 — 없어도 동작하도록 느슨하게 불러온다.
 *  _guard.js 는 _store.mjs 를 필요로 하는데, 저장소 사본에 따라 빠져 있는 경우가 있어
 *  정적 import 를 하면 함수 빌드 전체가 실패한다(2026-09-17 확인). 그래서 실행 시점에만 읽는다.
 *  netlify.toml 의 proposal-api included_files 에 _guard.js 가 들어 있어야 한다. */
let _g;
async function load() {
  if (_g !== undefined) return _g;
  /* 번들러가 lib 를 함수 파일 안에 합치면 기준 위치가 netlify/functions/ 로 바뀐다 → 후보를 차례로 */
  const name = '_guard' + '.js';
  const cands = [];
  try { cands.push(new URL('./' + name, import.meta.url).href); } catch (e) { /* 무시 */ }
  try { cands.push(new URL('../../functions/' + name, import.meta.url).href); } catch (e) { /* 무시 */ }
  if (process.env.LAMBDA_TASK_ROOT) cands.push('file://' + process.env.LAMBDA_TASK_ROOT + '/netlify/functions/' + name);
  _g = null;
  for (const spec of cands) {
    try { const m = await import(spec); _g = m.default || m; if (_g && _g.guard) break; } catch (e) { /* 다음 후보 */ }
  }
  return _g;
}

export function ipOf(h) {
  const g = k => (h && typeof h.get === 'function') ? h.get(k) : '';
  return String(g('x-nf-client-connection-ip') || g('x-forwarded-for') || g('client-ip') || '').split(',')[0].trim().slice(0, 45);
}

/** 차단 대상이면 hit 객체, 아니면 null. 검사 오류는 null (정상 고객을 막지 않는다) */
export async function guard(headers, who, where) {
  try { const g = await load(); return g && g.guard ? await g.guard(headers, who, where) : null; }
  catch (e) { return null; }
}

export async function available() { try { const g = await load(); return !!(g && g.guard); } catch (e) { return false; } }
