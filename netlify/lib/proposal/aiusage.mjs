/** AI 사용량·한도 (2026-09-18)
 *  Console API 키로 나가는 비용을 달 단위로 세어 두고, 한도의 95% 에 닿으면 대화를 멈춘다.
 *  (claude.ai 구독과는 별개로 과금되므로 홈페이지가 스스로 한도를 지켜야 한다.)
 *  키: ai/usage-YYYY-MM.json  { calls, in, out, usd, byModel:{ model: {calls,in,out,usd} } }
 */
import * as S from './store.mjs';
import { CFG } from './config.mjs';

/* $/백만 토큰 — 모르는 모델은 Sonnet 기준으로 잡아 과소평가하지 않는다 */
const PRICE = {
  'claude-haiku-4-5': [1, 5],
  'claude-haiku-3-5': [0.8, 4],
  'claude-sonnet-4-5': [3, 15],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-5': [2, 10],
  'claude-opus-4-5': [5, 25],
  'claude-opus-5': [5, 25]
};
const priceOf = model => {
  const k = Object.keys(PRICE).find(x => String(model || '').startsWith(x));
  return PRICE[k] || [3, 15];
};
export const monthKey = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 7);
const key = m => 'ai/usage-' + m + '.json';

export function costOf(model, usage = {}) {
  const [pin, pout] = priceOf(model);
  const i = Number(usage.input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0);
  const c = Number(usage.cache_read_input_tokens || 0);
  const o = Number(usage.output_tokens || 0);
  return { in: i + c, out: o, usd: (i * pin + c * pin * 0.1 + o * pout) / 1e6 };
}

export async function readUsage(now = Date.now()) {
  const m = monthKey(now);
  const o = (await S.getJSON(key(m))) || {};
  const usd = Number(o.usd || 0);
  const budget = CFG.chatBudgetUsd;
  return {
    month: m, calls: Number(o.calls || 0), in: Number(o.in || 0), out: Number(o.out || 0), usd,
    budget, pct: budget ? usd / budget : 0,
    /* 한도의 95%(기본) 를 넘으면 대화를 멈춘다 — 0 이면 한도 없음 */
    paused: !!budget && usd >= budget * CFG.chatPauseAt,
    byModel: o.byModel || {}
  };
}

/** 호출 한 건 기록 — 실패해도 서비스에 영향을 주지 않는다 */
export async function addUsage(model, usage, now = Date.now()) {
  const c = costOf(model, usage);
  try {
    const m = monthKey(now), k = key(m);
    const o = (await S.getJSON(k)) || { calls: 0, in: 0, out: 0, usd: 0, byModel: {} };
    const b = o.byModel[model] || { calls: 0, in: 0, out: 0, usd: 0 };
    o.calls++; o.in += c.in; o.out += c.out; o.usd = Math.round((o.usd + c.usd) * 1e6) / 1e6;
    b.calls++; b.in += c.in; b.out += c.out; b.usd = Math.round((b.usd + c.usd) * 1e6) / 1e6;
    o.byModel[model] = b; o.at = new Date(now).toISOString();
    await S.setJSON(k, o);
  } catch (e) { /* 기록 실패는 무시 */ }
  return c;
}
