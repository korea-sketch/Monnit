/** AI 사용량·한도 (2026-09-18)
 *  Console API 키로 나가는 비용을 달 단위로 세어 두고, 한도의 95% 에 닿으면 대화를 멈춘다.
 *  (claude.ai 구독과는 별개로 과금되므로 홈페이지가 스스로 한도를 지켜야 한다.)
 *  키: ai/usage-YYYY-MM.json  { calls, in, out, usd, byModel:{ model: {calls,in,out,usd} } }
 */
import * as S from './store.mjs';
import { CFG } from './config.mjs';

/* $/백만 토큰 — 모르는 모델은 Sonnet 기준으로 잡아 과소평가하지 않는다 */
const PRICE = {
  /* Gemini 무료 등급 — $0. 무료가 끝나면(과금 신호) halt 가 걸려 어차피 안 부른다.
     참고로 유료 전환 시 Flash-Lite 는 [0.1, 0.4] 수준이라 1,500회여도 몇십 원이다. */
  'gemini-3.5-flash-lite': [0, 0],
  'gemini-3.1-flash-lite': [0, 0],
  'gemini-3.5-flash': [0, 0],
  'gemini-2.5-flash-lite': [0, 0],
  'gemini-2.5-flash': [0, 0],
  'gemini-2.0-flash': [0, 0],
  'gemini': [0, 0],
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

/* ── 정지(halt) — 「과금으로 바뀌면 멈춘다」 (2026-09-19) ────────────────
   무료 등급이 끝났다는 신호(429 한도 초과 · 402/403 결제 요구 · 월 무료 호출 상한)가
   오면 ai/halt.json 을 쓴다. 이 파일이 있는 동안 AI 경로는 닫히고, 화면에는
   「점검 중」이 뜨며, 관제 첫 화면에 팝업이 뜬다. 담당자가 「다시 시도」를 눌러야 풀린다. */
const HALT = 'ai/halt.json';
/* 다음 날 0시(KST) — 일일 무료 한도는 자정에 다시 채워지므로 그때 저절로 풀린다 */
const nextKstMidnight = (now = Date.now()) => new Date(Math.floor((now + 9 * 3600000) / 86400000 + 1) * 86400000 - 9 * 3600000).toISOString();
export async function readHalt(now = Date.now()) {
  const h = (await S.getJSON(HALT)) || null;
  if (h && h.until && Date.parse(h.until) <= now) { await S.del(HALT).catch(() => {}); return null; }   /* 기한이 지난 정지는 스스로 풀린다 */
  return h;
}
export async function setHalt(reason, detail = {}) {
  const cur = await readHalt();
  if (cur) return cur;                                  /* 이미 멈춰 있으면 처음 사유를 지킨다 */
  reason = String(reason || '').slice(0, 40);
  const h = { at: new Date().toISOString(), reason, provider: CFG.aiProvider,
    model: CFG.chatModel, status: Number(detail.status) || 0, message: String(detail.message || '').slice(0, 300), notified: false };
  if (reason === 'daily-quota') h.until = nextKstMidnight();
  await S.setJSON(HALT, h).catch(() => {});
  return h;
}
export async function clearHalt() { await S.del(HALT).catch(() => {}); }
export async function markHaltNotified(at = '') {
  const h = await readHalt(); if (!h) return;
  if (at && h.at !== at) return;                       /* 그새 풀리고 다른 정지가 걸렸으면 손대지 않는다 */
  h.notified = true; await S.setJSON(HALT, h).catch(() => {});
}

/* 마지막 AI 오류 — 과금 신호가 아닌 실패(타임아웃·모델 없음·응답 깨짐)도 관제에서 보여야 한다.
   조용히 규칙으로 떨어지면 「AI 가 한 번도 안 불린다」를 아무도 모른다. (2026-09-19) */
const LASTERR = 'ai/last-error.json';
export async function recordAiError(err = {}) {
  const cur = (await S.getJSON(LASTERR).catch(() => null)) || { n: 0 };
  await S.setJSON(LASTERR, { at: new Date().toISOString(), n: (Number(cur.n) || 0) + 1, provider: CFG.aiProvider, model: CFG.chatModel,
    status: Number(err.status) || 0, message: String(err.message || '').slice(0, 300) }).catch(() => {});
}
export async function readAiError() { return (await S.getJSON(LASTERR).catch(() => null)) || null; }
export async function clearAiError() { await S.del(LASTERR).catch(() => {}); }

/** 응답이 「이제 돈 내라」는 신호인가 — 공급자마다 모양이 다르다 */
export function isBillingSignal(status, bodyText = '') {
  const t = String(bodyText || '').toLowerCase();
  if (status === 402) return 'payment-required';
  if (status === 429) {
    /* Gemini 무료 등급은 분당·일당 한도도 429 로 답한다(본문에 「billing」이 섞여 있어도 과금 아님).
       분당 한도 = 순간 폭주 → 이번 턴만 규칙으로. 일당 한도 = 자정까지 정지(스스로 풀림). */
    if (/per.?minute|requestsperminute|tokensperminute|rate.?limit/.test(t)) return '';
    if (/per.?day|requestsperday|daily/.test(t)) return 'daily-quota';
    if (/quota|resource_exhausted|exceeded|billing/.test(t)) return 'quota-exceeded';
    return '';
  }
  if (status === 403 && /billing|payment|enable billing|not enabled|suspended|free tier/.test(t)) return 'billing-required';
  if (status === 400 && /credit balance|billing/.test(t)) return 'payment-required';   /* Anthropic: 잔액 부족은 400 */
  if (status === 400 && /api key expired|api_key_invalid|api key not valid/.test(t)) return 'key-problem';
  if (status === 401) return 'key-problem';
  return '';
}

export async function readUsage(now = Date.now()) {
  const m = monthKey(now);
  const o = (await S.getJSON(key(m))) || {};
  const usd = Number(o.usd || 0);
  const budget = CFG.chatBudgetUsd;
  const calls = Number(o.calls || 0);
  const halt = await readHalt();
  const freeCap = CFG.aiFreeOnly ? CFG.aiFreeCallsMonth : 0;
  return {
    month: m, calls, in: Number(o.in || 0), out: Number(o.out || 0), usd,
    budget, pct: budget ? usd / budget : 0,
    /* 멈추는 조건 셋 — 정지 파일 · 달러 한도 95% · 무료 모드 월 호출 상한 */
    paused: !!halt || (!!budget && usd >= budget * CFG.chatPauseAt) || (!!freeCap && calls >= freeCap),
    halt, freeCap,
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
