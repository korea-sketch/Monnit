/** 맞춤 제안서 — 대화로 신청 API (2026-09-18)
 *
 *   POST /api/proposal/chat   { messages:[{role,text}], fields, lang, elapsed, website }
 *        → { ok, reply, fields, ready, ask, handoff, mode:'rule'|'ai', paused, notice }
 *
 *  · 기본 대화(회사명·성함·이메일·현장·고민 묻고 받기)는 코드로 처리한다 — AI 호출 없음(비용 0)
 *  · 코드가 못 알아들은 말·질문일 때만 Claude(가장 싼 모델)를 부른다
 *  · 월 한도의 95% 에 닿으면 AI 를 부르지 않고 「점검 중」으로 알린 뒤 단계별 신청 화면으로 돌린다
 *  · 접수 자체는 기존 /api/proposal (entry: chat) 이 한다
 */
import { CFG } from '../lib/proposal/config.mjs';
import * as S from '../lib/proposal/store.mjs';
import { readUsage, addUsage } from '../lib/proposal/aiusage.mjs';
import { askAI, cleanFields, cleanReply, isReady, missing, needsHandoff, nextAsk, pausedNotice, ruleParse, ruleReply, LABELS } from '../lib/proposal/chat.mjs';
import { kDay } from '../lib/proposal/schedule.mjs';
import * as _guard from '../lib/proposal/guard.mjs';

export const config = { path: '/api/proposal/chat' };

const H = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });

const envHost = k => { try { return new URL(process.env[k] || '').hostname; } catch (e) { return ''; } };
function sameOrigin(req) {
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return false;
  const o = req.headers.get('origin');
  if (!o) return true;
  try {
    const h = new URL(o).hostname, self = new URL(req.url).hostname;
    return [self, 'localhost', '127.0.0.1', envHost('URL'), envHost('DEPLOY_URL'), envHost('DEPLOY_PRIME_URL')].filter(Boolean).includes(h) || /(^|\.)monnit\.co\.kr$/.test(h);
  } catch (e) { return false; }
}
const out = (o) => json({ ok: true, ...o });

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (!sameOrigin(req)) return json({ ok: false, error: 'origin' }, 403);
  if (!/application\/json/i.test(req.headers.get('content-type') || '')) return json({ ok: false, error: 'content_type' }, 400);

  let b = null;
  try {
    const text = await req.text();
    if (text.length > 16000) return json({ ok: false, error: 'too_large' }, 413);
    b = JSON.parse(text);
  } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ ok: false, error: 'bad_request' }, 400);

  const lang = b.lang === 'en' ? 'en' : 'ko';
  const rawMsgs = Array.isArray(b.messages) ? b.messages : [];
  const messages = rawMsgs
    .filter(m => m && typeof m.text === 'string' && m.text.trim())
    .slice(-CFG.chatMaxTurns)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: String(m.text).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 600) }));
  const userTurns = messages.filter(m => m.role === 'user').length;
  const last = [...messages].reverse().find(m => m.role === 'user');
  const lastText = last ? last.text : '';

  /* 대화가 너무 길어지면 단계별 신청으로 (비용·품질 모두) */
  if (rawMsgs.length > CFG.chatMaxTurns) {
    return out({ mode: 'rule', tooLong: true, fields: cleanFields(b.fields || {}, {}), ready: isReady(cleanFields(b.fields || {}, {})),
      reply: lang === 'en' ? 'This chat is getting long — the step form below will be quicker.' : '대화가 길어졌습니다. 아래 단계별 신청으로 이어 주시면 더 빠릅니다.' });
  }

  /* 봇 — 조용히 일반적인 답만 (AI 호출 없음) */
  if (String(b.website || '').trim() || (Number(b.elapsed) > 0 && Number(b.elapsed) < 2000)) {
    return out({ mode: 'rule', silent: true, fields: {}, ready: false, ask: 'company', reply: ruleReply({}, lang, { first: true }) });
  }

  let fields = cleanFields(b.fields || {}, {});
  const asking = nextAsk(fields);

  /* 첫 인사 — 아직 고객이 아무 말도 하지 않았다 */
  if (!userTurns) return out({ mode: 'rule', fields, ready: false, ask: asking, reply: ruleReply(fields, lang, { first: true }) });

  /* 경쟁사 차단 — 막혔다는 걸 알리지 않고 담당자 연결처럼 답한다 */
  const blocked = await _guard.guard(req.headers, { email: fields.email || '', company: fields.company || '', name: fields.name || '', phone: fields.phone || '', title: '맞춤 제안서(대화)' }, 'proposal-chat');
  if (blocked) return out({ mode: 'rule', silent: true, fields: {}, ready: false, ask: 'company',
    reply: lang === 'en' ? 'Thank you for your enquiry. A staff member will contact you.' : '문의 감사합니다. 담당자가 확인 후 연락드리겠습니다.' });

  /* ① 규칙으로 먼저 알아듣는다 — 여기서 끝나면 AI 비용이 들지 않는다 */
  const p = ruleParse(lastText, asking, fields);
  fields = cleanFields(p.fields, fields);
  const handoff = needsHandoff(lastText);

  if (!handoff && p.understood && !p.question) {
    const ask = nextAsk(fields);
    return out({ mode: 'rule', fields, ready: isReady(fields), ask, confirmed: !!p.confirmed, edit: !!p.edit,
      reply: ruleReply(fields, lang, { got: p.got }),
      labels: ask === 'done' ? { fac: LABELS.fac[fields.fac] || '', con: LABELS.con[fields.con] || '' } : undefined });
  }

  /* ② 규칙이 못 알아들었다 — 한도·설정을 보고 AI 를 부를지 정한다 */
  const usage = await readUsage().catch(() => ({ paused: false }));
  let allowAI = CFG.chatOn && !!CFG.aiKey && !usage.paused;
  if (allowAI) {
    const ip = _guard.ipOf(req.headers);
    if (ip) {
      try {
        const k = 'chatrate/' + kDay(Date.now()) + '/' + ip.replace(/[^\w.:]/g, '');
        if (await S.count(k) >= CFG.chatPerIpDay) allowAI = false;
        else await S.bump(k);
      } catch (e) { /* 제한 계산 실패로 대화를 막지 않는다 */ }
    }
  }

  if (!allowAI) {
    /* AI 없이 — 담당자 연결 안내 또는 다시 한 번 쉽게 묻기 */
    const notice = usage.paused ? pausedNotice(lang) : '';
    return out({ mode: 'rule', paused: !!usage.paused, notice, fields, ready: isReady(fields), ask: nextAsk(fields), handoff,
      reply: ruleReply(fields, lang, { handoff, again: handoff ? '' : asking }) });
  }

  const r = await askAI(messages, fields, lang);
  if (!r || !r.out) {
    return out({ mode: 'rule', fields, ready: isReady(fields), ask: nextAsk(fields), handoff,
      reply: ruleReply(fields, lang, { handoff, again: handoff ? '' : asking }) });
  }
  if (r.usage) await addUsage(r.model, r.usage);

  fields = cleanFields(r.out.fields || {}, fields);
  const hand = handoff || r.out.handoff === true;
  const ask = nextAsk(fields);
  let reply = cleanReply(r.out.reply);
  if (!reply) reply = ruleReply(fields, lang, { handoff: hand });
  return out({ mode: 'ai', fields, ready: isReady(fields), ask, handoff: hand, need: missing(fields), reply,
    labels: ask === 'done' ? { fac: LABELS.fac[fields.fac] || '', con: LABELS.con[fields.con] || '' } : undefined });
};
