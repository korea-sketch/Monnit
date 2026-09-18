/** 규칙이 놓친 말 · AI 를 쓴 말 — 원장 (2026-09-18)
 *
 *  왜 남기는가
 *    AI 는 「규칙이 못 알아들었을 때」만 부른다. 그러니 AI 를 한 번 불렀다는 것은
 *    규칙에 구멍이 하나 있다는 뜻이다. 그 구멍을 눈으로 봐야 막을 수 있다.
 *    여기 쌓인 말이 다음 규칙 개정의 재료다 — 이 파일은 「비용의 이유」를 모으는 곳이다.
 *
 *  무엇을 남기는가
 *    · 무엇을 묻고 있었는지(항목), 사람이 뭐라고 답했는지(개인정보 지운 원문)
 *    · 규칙이 왜 못 알아들었는지(unmatched·question), 몇 번째 되묻기였는지
 *    · AI 를 실제로 불렀는지, 불렀다면 AI 가 무엇을 뽑아냈고 얼마가 들었는지
 *
 *  무엇을 남기지 않는가
 *    · 이메일·전화·주민번호는 ko.redact 가 「(메일)」「(전화)」로 지운 뒤 저장한다
 *    · 대화 전체는 남기지 않는다. 못 알아들은 그 한 마디만 남긴다
 *    · 보관 90일 — /ops 에서 지울 수 있다
 */
import * as S from './store.mjs';
import KO from './ko.mjs';
import { kDay } from './schedule.mjs';

const STORE = 'chatmiss';
export const KEEP_DAYS = 90;

const safe = async (p) => { try { return await p; } catch (e) { return null; } };
/* 같은 밀리초에 여러 건이 들어와도 덮이지 않게 꼬리를 붙인다 */
const key = (ts, tag) => kDay(ts) + '/' + ts + '-' + Math.random().toString(36).slice(2, 7) + '-' + tag;

/** 한 건 남긴다. 기록이 실패해도 대화는 절대 막지 않는다. */
export async function logMiss(input) {
  const x = input || {};
  const ts = Date.now();
  const rec = {
    ts,
    ask: String(x.ask || '').slice(0, 12),          /* 무엇을 묻고 있었나 — company·name·email·fac·con·done */
    say: KO.redact(x.say || ''),                    /* 사람이 한 말 (개인정보 제거) */
    flat: KO.squash(KO.redact(x.say || '')).slice(0, 80),  /* 같은 말끼리 묶기 위한 형태 */
    why: String(x.why || '').slice(0, 20),          /* unmatched · question · empty */
    retry: Math.max(0, Math.min(9, Number(x.retry) || 0)),
    ai: !!x.ai,
    lang: x.lang === 'en' ? 'en' : 'ko'
  };
  if (x.ai) {
    rec.model = String(x.model || '').slice(0, 40);
    rec.usd = Math.round(Number(x.usd || 0) * 1e6) / 1e6;
    /* AI 가 무엇을 뽑아냈는지 — 이 값이 곧 「규칙이 이렇게 읽었어야 했다」는 정답지다 */
    const g = x.got || {};
    rec.got = {};
    for (const k of ['company', 'name', 'title', 'fac', 'con']) if (g[k]) rec.got[k] = String(g[k]).slice(0, 40);
    if (g.email) rec.got.email = '(메일)';
    if (g.phone) rec.got.phone = '(전화)';
  }
  await safe(S.setJSON(STORE + '/' + key(ts, rec.ai ? 'ai' : 'miss'), rec));
  return rec;
}

/** 모아 보기 — 같은 말끼리 묶어 잦은 것부터 */
export async function readMisses({ days = 30, limit = 400 } = {}) {
  const now = Date.now();
  const rows = [];
  for (let d = 0; d < days; d++) {
    const day = kDay(now - d * 86400000);
    const list = await safe(S.list(STORE + '/' + day + '/')) || [];
    for (const k of list) {
      const v = await safe(S.getJSON(k));
      if (v) rows.push(v);
      if (rows.length >= limit) break;
    }
    if (rows.length >= limit) break;
  }
  rows.sort((a, b) => b.ts - a.ts);

  /* 같은 말끼리 묶는다 — 「세 번 나왔다」가 「한 번 나왔다」보다 먼저 고칠 것이다 */
  const groups = new Map();
  for (const r of rows) {
    const gk = r.ask + '|' + r.flat;
    const g = groups.get(gk) || { ask: r.ask, say: r.say, n: 0, ai: 0, usd: 0, last: 0, why: r.why, got: null };
    g.n++; if (r.ai) { g.ai++; g.usd += Number(r.usd || 0); if (!g.got && r.got) g.got = r.got; }
    if (r.ts > g.last) { g.last = r.ts; g.say = r.say; }
    groups.set(gk, g);
  }
  const grouped = [...groups.values()].sort((a, b) => (b.ai - a.ai) || (b.n - a.n) || (b.last - a.last));
  const totals = {
    rows: rows.length,
    ai: rows.filter(r => r.ai).length,
    usd: Math.round(rows.reduce((s, r) => s + Number(r.usd || 0), 0) * 1e4) / 1e4,
    byAsk: rows.reduce((o, r) => { o[r.ask] = (o[r.ask] || 0) + 1; return o; }, {})
  };
  return { rows, grouped, totals };
}

/** 오래된 기록 지우기 — 90일. /ops 에서 부른다 */
export async function sweep(days = KEEP_DAYS) {
  const cut = kDay(Date.now() - days * 86400000);
  const all = await safe(S.list(STORE + '/')) || [];
  let n = 0;
  for (const k of all) {
    const day = k.slice(STORE.length + 1, STORE.length + 11);
    if (day && day < cut) { await safe(S.del(k)); n++; }
  }
  return n;
}

/** 통째로 비우기 — 규칙을 고치고 나서 새로 모을 때 */
export async function clearAll() {
  const all = await safe(S.list(STORE + '/')) || [];
  for (const k of all) await safe(S.del(k));
  return all.length;
}
