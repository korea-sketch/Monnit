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
import { askAI, cleanFields, cleanReply, isReady, isStrongQuestion, missing, needsHandoff, nextAsk, pausedNotice, ruleParse, ruleReply, LABELS } from '../lib/proposal/chat.mjs';
import { kDay } from '../lib/proposal/schedule.mjs';
import * as _guard from '../lib/proposal/guard.mjs';
import { logMiss, logRescue } from '../lib/proposal/chatlog.mjs';
import { costOf } from '../lib/proposal/aiusage.mjs';

export const config = { path: '/api/proposal/chat' };

/* 같은 항목을 몇 번 되묻고 나서 AI 를 부를지 — 오타·실수에 토큰을 쓰지 않기 위한 값 */
const RETRY_BEFORE_AI = Number(process.env.PROPOSAL_CHAT_RETRY || 2);

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
/* 기록은 응답을 붙잡지 않는다 — 실패해도 대화는 그대로 이어진다 */
const later = (p) => { try { p.catch(() => {}); } catch (e) {} };

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
  const handoff = needsHandoff(lastText);
  const retry = Math.max(0, Math.min(9, Number(b.retry) || 0));
  /* 담당자에게 넘기는 말(가격·납기…)은 신청 값으로 읽지 않는다 —
     「배터리는 얼마나 가나요」가 회사명으로 저장되던 문제. (2026-09-19) */
  if (!handoff) fields = cleanFields(p.fields, fields);

  /* 가격·납기·A/S 같은 제안서 밖 요청 — 답은 정해져 있다(담당자가 연락드립니다).
     정해진 문장을 내는 데 AI 를 부를 이유가 없다. 예전에는 여기서도 토큰을 썼다. (2026-09-19) */
  if (handoff) {
    return out({ mode: 'rule', fields, ready: isReady(fields), ask: nextAsk(fields), handoff: true,
      reply: ruleReply(fields, lang, { handoff: true }) });
  }

  if (p.understood && !p.question) {
    /* 오타·자판·초성 추정으로 살린 값은 남겨 둔다 — 추정이 틀리면 여기서 보인다 (AI 아님, 비용 0) */
    if (p.how && p.how !== 'exact') later(logRescue({ ask: asking, say: lastText, how: p.how, retry, lang, fac: fields.fac, con: fields.con }));
    /* 고민을 건너뛴 경우 — 그 항목은 더 묻지 않고 넘어간다 */
    if (p.skipAsk === 'con') fields.con = fields.con || 'skip';
    const ask = p.skipAsk === 'con' ? 'done' : nextAsk(fields);
    return out({ mode: 'rule', fields: p.skipAsk === 'con' ? { ...fields, con: '' } : fields,
      ready: isReady(fields), ask, confirmed: !!p.confirmed, edit: !!p.edit, skipped: p.skipAsk || '',
      reply: ruleReply(fields, lang, { got: p.got, again: p.again || '', emailAsk: p.emailAsk || '', emailBad: p.emailBad || '', skipped: p.skipAsk || '' }),
      labels: ask === 'done' ? { fac: LABELS.fac[fields.fac] || '', con: LABELS.con[fields.con] || '' } : undefined });
  }

  /* ② 규칙이 못 알아들었다 — 바로 AI 를 부르지 않는다. (2026-09-18)
     오타·짧은 답·실수는 「한 번 더 쉽게 묻기」로 대부분 풀린다. 같은 항목을 두 번
     되물어도 안 되면 그때 AI 를 부른다 — 토큰은 「사람이 자유롭게 쓴 말」에만 쓴다.
     되물은 횟수는 화면이 retry 로 돌려준다(위조되어도 최대 손해는 AI 1회). */
  /* 진짜 묻는 말(「인터넷 없어도 되나요」)에 「회사명을 적어 주세요」를 두 번 되묻는 건 잘못이다.
     질문은 AI 가 답할 자리다 — 오타·실수와 달리 여기서는 토큰을 쓰는 게 맞다. (2026-09-19)
     키가 없으면 어차피 아래에서 규칙 되묻기로 떨어진다. */
  const strongQ = isStrongQuestion(lastText);
  if (!strongQ && retry < RETRY_BEFORE_AI) {
    /* 아직 돈은 안 썼지만 규칙에 구멍이 있다는 신호다 — 남겨 두고 다음에 막는다 */
    later(logMiss({ ask: asking, say: lastText, why: p.miss || 'unmatched', retry, ai: false, lang }));
    return out({ mode: 'rule', fields, ready: isReady(fields), ask: asking, retry: retry + 1,
      reply: ruleReply(fields, lang, { again: asking }) });
  }

  /* ③ 두 번 되물어도 안 통했다 — 한도·설정을 보고 AI 를 부를지 정한다 */
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

  /* 돈을 쓴 자리 — 무엇 때문에 썼고 AI 가 무엇을 읽어 냈는지 반드시 남긴다.
     이 기록의 got 가 곧 「규칙이 이렇게 읽었어야 했다」는 정답지다. */
  later(logMiss({
    ask: asking, say: lastText, why: p.miss || (p.question ? 'question' : 'unmatched'),
    retry, ai: true, lang, model: r.model,
    usd: r.usage ? costOf(r.model, r.usage).usd : 0,
    got: r.out.fields || {}
  }));

  fields = cleanFields(r.out.fields || {}, fields);
  const hand = handoff || r.out.handoff === true;
  const ask = nextAsk(fields);
  let reply = cleanReply(r.out.reply);
  if (!reply) reply = ruleReply(fields, lang, { handoff: hand });
  return out({ mode: 'ai', fields, ready: isReady(fields), ask, handoff: hand, need: missing(fields), reply,
    labels: ask === 'done' ? { fac: LABELS.fac[fields.fac] || '', con: LABELS.con[fields.con] || '' } : undefined });
};
