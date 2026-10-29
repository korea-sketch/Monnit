/* ============================================================
   설정값(환경변수) — R2 의 __config/env.json + 대시보드 값
   ------------------------------------------------------------
   메일·AI 키 등 설정값 20여 개는 R2(__config/env.json)에 저장돼 있습니다.
   · 대시보드(Variables and Secrets)에 같은 이름이 있으면 대시보드 값이 이깁니다.
   · 값을 바꾸려면 대시보드에 같은 이름으로 넣으면 됩니다.
   ============================================================ */
export const CONFIG_KEY = '__config/env.json';
const TTL = 10 * 60 * 1000;
let CACHE = null, AT = 0, INFLIGHT = null;
const MINE = new Set();   /* 여기서 채운 process.env 이름 — 새로 읽으면 갱신 */

async function load(env) {
  try {
    const o = await env.BLOBS.get(CONFIG_KEY);
    CACHE = o ? (JSON.parse(await o.text()).vars || {}) : {};
    AT = Date.now();
  } catch (e) {
    console.error('[config]', e && e.message);
    CACHE = CACHE || {}; AT = Date.now() - TTL + 60 * 1000;   /* 1분 뒤 다시 시도 */
  }
}

/* 합친 결과를 재사용 — env 객체와 설정값이 그대로면 요청마다 다시 합치지 않는다 */
let LAST_ENV = null, LAST_VARS = null, LAST_MERGED = null;

/** 요청마다: 저장된 설정값 + 대시보드 값(우선)을 합친 env */
export async function withConfig(env) {
  if (!env || !env.BLOBS) return env;
  if (!CACHE || Date.now() - AT > TTL) { INFLIGHT = INFLIGHT || load(env).finally(() => { INFLIGHT = null; }); await INFLIGHT; }
  const vars = CACHE || {};
  if (env === LAST_ENV && vars === LAST_VARS) return LAST_MERGED;
  const merged = { ...vars, ...env };
  for (const k in vars) {
    if (env[k] != null && env[k] !== '') continue;
    if (MINE.has(k) || process.env[k] == null || process.env[k] === '') { try { process.env[k] = vars[k]; MINE.add(k); } catch (e) { /* 무시 */ } }
  }
  LAST_ENV = env; LAST_VARS = vars; LAST_MERGED = merged;
  return merged;
}
