/* ============================================================
   설정값(환경변수) 자동 이전 — Netlify → Cloudflare
   ------------------------------------------------------------
   Cloudflare 대시보드에 비밀값 20여 개를 하나하나 다시 넣지 않아도 되도록,
   Netlify 의 /api/blob-export?op=env 에서 한 번 받아 R2(__config/env.json)에 둡니다.
   인증은 데이터 이관과 같은 HMAC(PROPOSAL_SECRET) — 그래서 대시보드에는
   PROPOSAL_SECRET 과 GITHUB_TOKEN 만 직접 넣으면 됩니다.
   · 대시보드에 같은 이름이 있으면 대시보드 값이 이깁니다(나중에 바꾸고 싶을 때).
   · 다시 받으려면 /ops/migrate 에서 「복사 시작」 (설정값도 함께 새로 받음).
   ============================================================ */
import { migrateToken } from '../netlify/functions/blob-export.mjs';

export const CONFIG_KEY = '__config/env.json';
const TTL = 10 * 60 * 1000;
let CACHE = null, AT = 0, INFLIGHT = null;
const MINE = new Set();   /* 여기서 채운 process.env 이름 — 새로 받으면 갱신 */

async function pull(env) {
  const src = String(env.MIGRATE_SOURCE || '').replace(/\/$/, '');
  const tok = migrateToken();
  if (!src || !tok) return null;
  const f = globalThis.__MNK_REAL_FETCH || fetch;
  const r = await f(src + '/api/blob-export?op=env', { headers: { 'x-mnk-migrate': tok } });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok || !j.vars) throw new Error('설정값 받기 실패 ' + r.status);
  await env.BLOBS.put(CONFIG_KEY, JSON.stringify({ at: new Date().toISOString(), source: src, vars: j.vars }));
  return j.vars;
}

async function load(env) {
  try {
    const o = await env.BLOBS.get(CONFIG_KEY);
    CACHE = o ? (JSON.parse(await o.text()).vars || {}) : ((await pull(env)) || {});
    AT = Date.now();
  } catch (e) {
    console.error('[config]', e && e.message);
    CACHE = CACHE || {}; AT = Date.now() - TTL + 60 * 1000;   /* 1분 뒤 다시 시도 */
  }
}

/** 원본에서 새로 받아 저장 (/ops/migrate) */
export async function refreshConfig(env) {
  const vars = await pull(env);
  CACHE = vars || {}; AT = Date.now();
  return Object.keys(CACHE).length;
}

/** 요청마다: 저장된 설정값 + 대시보드 값(우선)을 합친 env */
export async function withConfig(env) {
  if (!env || !env.BLOBS) return env;
  if (!CACHE || Date.now() - AT > TTL) { INFLIGHT = INFLIGHT || load(env).finally(() => { INFLIGHT = null; }); await INFLIGHT; }
  const vars = CACHE || {};
  const merged = { ...vars, ...env };
  for (const k in vars) {
    if (env[k] != null && env[k] !== '') continue;
    if (MINE.has(k) || process.env[k] == null || process.env[k] === '') { try { process.env[k] = vars[k]; MINE.add(k); } catch (e) { /* 무시 */ } }
  }
  return merged;
}
