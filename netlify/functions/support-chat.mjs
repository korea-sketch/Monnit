/** 기술지원 대화 API (2026-10-20)
 *
 *   POST /api/support/chat   { q, history:[{role,text}], cat, seen:[id], lang, elapsed, website }
 *        → { ok, mode:'kb'|'ai'|'rule', reply, ids:[], level:'high'|'mid'|'low'|'none',
 *            escalate, urgent, angry, paused }
 *
 *  · 모니 화면은 대부분 브라우저 안(js/support-kb.js)에서 바로 답한다. 이 API 는
 *    ① 검색이 애매할 때 AI 로 문서를 골라 요약하거나 ② 놓친 질문을 남기기 위해 부른다.
 *  · AI 한도·정지·IP 제한은 맞춤 제안서 대화와 같은 장부(aiusage)를 함께 쓴다 — 월 한도가 하나다.
 *  · 답에 전화번호·가격은 나가지 않는다(answer.mjs cleanReply). 마지막 창구는 「기술지원 접수」.
 */
import crypto from 'node:crypto';
import { CFG } from '../lib/proposal/config.mjs';
import * as S from '../lib/proposal/store.mjs';
import { readUsage, addUsage, readHalt, setHalt, isBillingSignal, recordAiError } from '../lib/proposal/aiusage.mjs';
import { kDay } from '../lib/proposal/schedule.mjs';
import * as _guard from '../lib/proposal/guard.mjs';
import { find, confidence, mood, getArticle, askSupportAI, RULE as RULE_KO, RULE_EN } from '../lib/support/answer.mjs';

export const config = { path: '/api/support/chat' };

const H = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });
const later = (p) => { try { p.catch(() => {}); const w = globalThis.__MNK_WAIT_UNTIL; if (typeof w === 'function') w(p); } catch (e) {} };

function sameOrigin(req) {
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return false;
  const o = req.headers.get('origin');
  if (!o) return true;
  try {
    const h = new URL(o).hostname, self = new URL(req.url).hostname;
    return [self, 'localhost', '127.0.0.1'].includes(h) || /(^|\.)monnit\.co\.kr$/.test(h) || /\.workers\.dev$|\.netlify\.app$/.test(h);
  } catch (e) { return false; }
}

/* 놓친 질문 — 지식베이스를 채울 정답지. 개인정보는 남기지 않는다 */
const scrub = s => String(s || '').replace(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '(메일)').replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '(전화)').slice(0, 300);
function logQ(kind, o) {
  const k = `support/${kind}/${kDay(Date.now())}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return S.setJSON(k, { at: new Date().toISOString(), ...o, q: scrub(o.q) });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (!sameOrigin(req)) return json({ ok: false, error: 'origin' }, 403);
  let b;
  try {
    const t = await req.text();
    if (t.length > 12000) return json({ ok: false, error: 'too_large' }, 413);
    b = JSON.parse(t);
  } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad_request' }, 400);

  const RULE = b.lang === 'en' ? RULE_EN : RULE_KO;   /* 2026-10-28 영문 모드 */
  const q = String(b.q || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 600);
  if (!q) return json({ ok: false, error: 'empty' }, 400);
  const cat = typeof b.cat === 'string' ? b.cat.slice(0, 20) : '';
  const seen = Array.isArray(b.seen) ? b.seen.filter(x => typeof x === 'string').slice(0, 12) : [];
  const history = (Array.isArray(b.history) ? b.history : []).filter(m => m && typeof m.text === 'string')
    .slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text.slice(0, 500) }));

  const halt = await readHalt().catch(() => null);
  const m = mood(q);
  const base = { angry: m.angry, urgent: m.urgent, fire: m.fire, paused: !!halt };
  const URG = m.fire ? RULE.fire : RULE.urgent;

  /* 봇 — 조용히 규칙 답 */
  if (String(b.website || '').trim() || (Number(b.elapsed) > 0 && Number(b.elapsed) < 1200)) {
    return json({ ok: true, mode: 'rule', reply: RULE.none, ids: [], level: 'none', escalate: true, ...base });
  }
  const blocked = await _guard.guard(req.headers, { title: '기술지원(대화)' }, 'support-chat').catch(() => false);
  if (blocked) return json({ ok: true, mode: 'rule', reply: RULE.human, ids: [], level: 'none', escalate: true, ...base });

  const results = find(q, { cat, limit: 4 });
  const level = confidence(results);
  const topIds = results.map(r => r.id);

  /* ① 감정·사람 요청이 먼저 — 점검표를 더 내밀지 않는다 */
  if (m.angry || m.human) {
    later(logQ('escalate', { q, why: m.angry ? 'angry' : 'human', top: topIds.slice(0, 2) }));
    return json({ ok: true, mode: 'rule', reply: m.angry ? RULE.angry : RULE.human, ids: level === 'high' ? topIds.slice(0, 1) : [], level, escalate: true, ...base });
  }
  /* ①-2 구매·견적·배송 — 기술 문서가 아니라 영업 담당에게 */
  if (m.sales && level !== 'high') {
    return json({ ok: true, mode: 'rule', reply: RULE.sales, ids: [], level, escalate: true, sales: true, ...base });
  }
  /* ② 검색이 확실 — AI 없이 */
  if (level === 'high' && !seen.includes(topIds[0])) {
    return json({ ok: true, mode: 'kb', reply: m.urgent ? URG : RULE.high, ids: topIds.slice(0, 1), level, escalate: m.urgent, ...base });
  }

  /* ③ 애매하다 — 한도 안이면 AI 가 찾은 문서 안에서 고른다 */
  const docs = (results.length ? results : find(q, { limit: 4 })).map(r => getArticle(r.id)).filter(Boolean).slice(0, 4);
  let allowAI = CFG.chatOn && !!CFG.chatAiKey && !halt && docs.length > 0;
  if (allowAI) {
    const usage = await readUsage(Date.now(), { halt }).catch(() => ({ paused: false }));
    if (usage.paused || (CFG.aiFreeOnly && usage.freeCap && usage.calls >= usage.freeCap)) allowAI = false;
  }
  if (allowAI) {
    const ip = _guard.ipOf(req.headers);
    if (ip) {
      try {
        const k = 'supportrate/' + kDay(Date.now()) + '/' + crypto.createHash('sha256').update('ip|' + ip + '|' + CFG.secret).digest('hex').slice(0, 16);
        if (!(await S.bumpUnder(k, CFG.chatPerIpDay))) allowAI = false;
      } catch (e) {}
    }
  }
  if (allowAI) {
    const r = await askSupportAI(q, history, docs, b.lang === 'en' ? 'en' : 'ko');
    if (r && r.out && r.out.reply) {
      if (r.usage) later(addUsage(r.model, r.usage));
      later(logQ('ai', { q, top: topIds, got: r.out.ids, esc: !!r.out.escalate }));
      return json({ ok: true, mode: 'ai', reply: (m.urgent ? URG + '\n\n' : '') + r.out.reply, ids: r.out.ids, level,
        escalate: !!r.out.escalate || r.out.confident === false || m.urgent, ...base });
    }
    if (r && r.error) {
      const sig = isBillingSignal(r.error.status, r.error.message);
      if (sig && CFG.aiFreeOnly) later(setHalt(sig, r.error));
      else later(recordAiError(r.error));
    }
  }

  /* ④ AI 없이 — 가까운 문서를 고르게 하거나, 솔직하게 접수로 */
  later(logQ('miss', { q, top: topIds, level }));
  if (level === 'mid' || (level === 'high' && seen.includes(topIds[0]))) {
    const ids = topIds.filter(id => !seen.includes(id)).slice(0, 3);
    if (ids.length) return json({ ok: true, mode: 'rule', reply: m.urgent ? URG : RULE.mid, ids, level: 'mid', escalate: m.urgent, ...base });
  }
  return json({ ok: true, mode: 'rule', reply: m.urgent ? URG : RULE.none, ids: level === 'low' ? topIds.slice(0, 2) : [], level, escalate: true, ...base });
};
