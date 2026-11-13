/** Claude 우선 · 소진되면 Gemini 로 (2026-11-10)
 *
 *  AI_PROVIDER=anthropic 일 때만 동작한다. (기본 gemini 운영에는 영향 없음)
 *    1) Claude 를 먼저 부른다.
 *    2) Claude 가 실패하면(크레딧·결제 소진, 한도, 혼잡, 타임아웃, 응답 깨짐 — 무엇이든) 같은 요청을 Gemini 로 다시 보낸다.
 *    3) 크레딧·결제 소진 신호이거나 이번 달 Claude 예산(PROPOSAL_AI_BUDGET_USD)에 닿으면
 *       CLAUDE_PAUSE_HOURS(기본 6시간) 동안 Claude 를 건너뛰고 바로 Gemini 를 쓴다. 담당자에게는 한 번 알린다.
 *    4) 정지 시간이 지나 Claude 가 다시 성공하면 정지 기록을 지우고 「복귀」를 알린다.
 *
 *  정지 기록: ai/claude-pause.json { until, reason, at, status, message, notified }
 */
import * as S from './store.mjs';
import { CFG } from './config.mjs';
import { isBillingSignal, readUsage, addUsage } from './aiusage.mjs';

const KEY = 'ai/claude-pause.json';
const hours = () => CFG.claudePauseHours;
let _memo = { at: 0, p: null };
const MEMO_MS = 30000;

/** Claude 를 먼저 쓰는 설정인가 (Gemini 키가 있어야 대체가 된다) */
export const claudeFirst = () => CFG.aiProvider === 'anthropic' && !!CFG.aiKey;
export const canFallback = () => CFG.aiProvider === 'anthropic' && !!CFG.geminiKey;

export async function readClaudePause(now = Date.now()) {
  if (now - _memo.at < MEMO_MS && _memo.at) return _memo.p;
  let p = await S.getJSON(KEY).catch(() => null);
  if (p && p.until && Date.parse(p.until) <= now) p = { ...p, expired: true };
  _memo = { at: now, p };
  return p;
}

/** 지금 Claude 를 건너뛰어야 하는가 — 정지 기록 또는 이번 달 예산 */
export async function claudeBlocked(now = Date.now()) {
  if (!claudeFirst()) return 'no-claude';
  const p = await readClaudePause(now);
  if (p && !p.expired) return p.reason || 'paused';
  if (CFG.chatBudgetUsd) {
    const u = await readUsage(now, { halt: null }).catch(() => null);
    if (u && u.usd >= CFG.chatBudgetUsd * CFG.chatPauseAt) {
      await pauseClaude('budget', { status: 0, message: `이번 달 Claude 사용 $${u.usd.toFixed(2)} / 예산 $${CFG.chatBudgetUsd}` }, now);
      return 'budget';
    }
  }
  return '';
}

export async function pauseClaude(reason, err = {}, now = Date.now()) {
  const prev = await S.getJSON(KEY).catch(() => null);
  const live = prev && prev.until && Date.parse(prev.until) > now;
  const p = {
    at: new Date(now).toISOString(),
    until: new Date(now + hours() * 3600e3).toISOString(),
    reason, status: Number(err.status) || 0, message: String(err.message || '').slice(0, 300),
    notified: !!(live && prev.notified)
  };
  await S.setJSON(KEY, p).catch(() => {});
  _memo = { at: now, p };
  if (!p.notified) {
    p.notified = true;
    await S.setJSON(KEY, p).catch(() => {});
    try { const m = await import('./mail.mjs'); await m.notifyClaudeFallback({ ...p, provider: 'anthropic' }); } catch (e) { /* 알림 실패는 무시 */ }
  }
  return p;
}

/** Claude 가 다시 성공했다 — 정지 기록이 있었다면 지우고 복귀를 알린다 */
export async function claudeRecovered(now = Date.now()) {
  const p = await readClaudePause(now);
  if (!p) return;
  await S.del(KEY).catch(() => {});
  _memo = { at: now, p: null };
  try { const m = await import('./mail.mjs'); await m.notifyClaudeRecovered(p); } catch (e) { /* 무시 */ }
}

/** Claude 실패를 보고 정지할지 판단 (과금·결제 신호만 정지, 일시 오류는 이번 한 번만 Gemini) */
export async function onClaudeError(err = {}) {
  const sig = isBillingSignal(err.status, err.message);
  if (sig && sig !== 'daily-quota') await pauseClaude(sig, err);
  return sig;
}

/**
 * 공통 실행기 — Claude 를 먼저, 실패하면 Gemini.
 *   claude(): Promise<결과|{error}|null>   gemini(): Promise<결과|{error}|null>
 *   ok(r): 결과가 쓸 만한지 (기본: r && !r.error)
 * 돌려주는 값: 원래 결과에 { provider, fallback } 을 덧붙인다.
 *   meter: true 면 성공한 호출의 토큰을 월 사용량(ai/usage-YYYY-MM.json)에 기록한다 — 제안서 문안·검토·인사이트용.
 *          (대화 챗봇은 호출한 쪽이 따로 기록하므로 쓰지 않는다)
 */
export async function withClaudeFirst({ claude, gemini, ok = r => !!r && !r.error, meter = false }) {
  const done = r => { if (meter && r && r.model && r.usage) addUsage(r.model, r.usage).catch(() => {}); return r; };
  const blocked = await claudeBlocked();
  let first = null;
  if (!blocked) {
    try { first = await claude(); } catch (e) { first = { error: { status: 0, message: String(e && e.message || e).slice(0, 300) } }; }
    if (ok(first)) { claudeRecovered().catch(() => {}); return done(Object.assign(first, { provider: 'anthropic' })); }
    if (first && first.error) await onClaudeError(first.error);
  }
  console.warn('[claude-first] Claude -> Gemini:', blocked || (first && first.error ? first.error.status + ' ' + String(first.error.message || '').slice(0, 200) : 'empty'));
  if (!canFallback()) return first;
  let second = null;
  try { second = await gemini(); } catch (e) { second = { error: { status: 0, message: String(e && e.message || e).slice(0, 300) } }; }
  if (second && typeof second === 'object') {
    second.provider = 'gemini';
    second.fallback = blocked || (first && first.error ? `claude ${first.error.status || ''} ${String(first.error.message || '').slice(0, 80)}`.trim() : 'claude-empty');
  }
  return ok(second) ? done(second) : second;
}

/** Gemini 로 JSON 한 덩어리 받기 — 제안서 문안·검토처럼 Claude 전용이던 호출의 대체용.
 *  모델이 접혔으면(404) 다음 후보로 넘어간다. 돌려주는 값: { raw, model, usage } | { error } */
export async function geminiJSON({ system, user, maxTokens = 2000, temperature = 0.3, signal }) {
  const order = [CFG.geminiModel, ...CFG.geminiFallbacks].filter((m, i, a) => m && a.indexOf(m) === i);
  let last = null;
  for (const model of order) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', signal,
      headers: { 'x-goog-api-key': CFG.geminiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' } })
    });
    if (!r.ok) {
      const msg = (await r.text().catch(() => '')).slice(0, 300);
      last = { error: { status: r.status, message: msg } };
      if (r.status === 404 || (r.status === 400 && /not found|no longer available|unsupported model/i.test(msg))) continue;
      return last;
    }
    const j = await r.json();
    const raw = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    const u = j.usageMetadata || {};
    return { raw, model, usage: { input_tokens: Number(u.promptTokenCount || 0), output_tokens: Number(u.candidatesTokenCount || 0) } };
  }
  return last || { error: { status: 0, message: 'no-gemini-model' } };
}

export function _forgetClaudePause() { _memo = { at: 0, p: null }; }   /* 검사용 */
