/* 대화 AI 설정 조합·보안 — 키 유무·공급자 지정·무료 모드 꺼짐·관제 재개 권한 (2026-09-19)
   실행: node tools/test-ai-config.mjs */
process.env.PROPOSAL_SECRET = 'cfg-secret'; process.env.PROPOSAL_SITE = 'https://monnit.co.kr'; process.env.BREVO_API_KEY = 'b';
globalThis.__PROPOSAL_MEM = {};
let aiUrl = '', aiFail = null;
globalThis.fetch = async (url, o = {}) => {
  url = String(url);
  if (/anthropic|generativelanguage/.test(url)) {
    aiUrl = url;
    if (aiFail) return new Response(aiFail.body, { status: aiFail.status });
    if (url.includes('anthropic')) return new Response(JSON.stringify({ model: 'claude-haiku-4-5', content: [{ type: 'text', text: '{"reply":"네","fields":{}}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"네","fields":{}}' }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }), { status: 200 });
  }
  return new Response('{"messageId":"m"}', { status: 201 });
};
let fail = 0; const ok = (n, c, g) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + String(JSON.stringify(g)).slice(0, 200))); if (!c) fail++; };
const { CFG } = await import('../netlify/lib/proposal/config.mjs');
const U = await import('../netlify/lib/proposal/aiusage.mjs');
const S = await import('../netlify/lib/proposal/store.mjs');
const CHAT = (await import('../netlify/functions/proposal-chat.mjs')).default;
const ADMIN = (await import('../netlify/functions/proposal-admin.mjs')).default;
let ipn = 0;
const call = (body, h = {}) => CHAT(new Request('https://monnit.co.kr/api/proposal/chat', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': '198.51.100.' + (++ipn % 250), ...h }, body: typeof body === 'string' ? body : JSON.stringify({ lang: 'ko', elapsed: 9000, ...body }) }), {}).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
const Q = { messages: [{ role: 'user', text: '인터넷 없어도 되나요?' }], fields: { company: '설정검사' } };
const setEnv = (o) => { for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'AI_PROVIDER', 'PROPOSAL_CHAT', 'AI_FREE_ONLY']) delete process.env[k]; Object.assign(process.env, o); };

setEnv({});
let r = await call(Q);
ok('키 없음 — 공급자 기본 gemini, 규칙 답만, paused 아님, 오류 없음', CFG.aiProvider === 'gemini' && !CFG.chatAiKey && r.s === 200 && r.j.mode === 'rule' && !r.j.paused, { p: CFG.aiProvider, r: r.j });
setEnv({ ANTHROPIC_API_KEY: 'a' }); aiUrl = '';
r = await call(Q);
ok('Anthropic 키만 — Claude 로 호출', CFG.aiProvider === 'anthropic' && /anthropic/.test(aiUrl) && r.j.mode === 'ai', { p: CFG.aiProvider, aiUrl });
setEnv({ ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g' }); aiUrl = '';
r = await call(Q);
ok('둘 다 — 무료 Gemini 우선', CFG.aiProvider === 'gemini' && /generativelanguage/.test(aiUrl) && r.j.mode === 'ai', { p: CFG.aiProvider, aiUrl });
setEnv({ ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g', AI_PROVIDER: 'anthropic' }); aiUrl = '';
r = await call(Q);
ok('AI_PROVIDER=anthropic 이면 지정이 이긴다', CFG.aiProvider === 'anthropic' && /anthropic/.test(aiUrl), aiUrl);
setEnv({ ANTHROPIC_API_KEY: 'a', AI_PROVIDER: 'gemini' }); aiUrl = '';
r = await call(Q);
ok('AI_PROVIDER=gemini 인데 GEMINI 키 없음 — 조용히 규칙만(죽지 않음)', r.s === 200 && r.j.mode === 'rule' && aiUrl === '', r.j);
setEnv({ GEMINI_API_KEY: 'g', PROPOSAL_CHAT: 'off' }); aiUrl = '';
r = await call(Q);
ok('PROPOSAL_CHAT=off — AI 없이 규칙만', !CFG.chatOn && r.j.mode === 'rule' && aiUrl === '', r.j);
/* 무료 모드 꺼짐 — 과금 신호가 와도 멈추지 않는다(유료로 쓰기로 한 경우) */
setEnv({ ANTHROPIC_API_KEY: 'a', AI_FREE_ONLY: 'off' }); await U.clearHalt();
aiFail = { status: 429, body: '{"error":{"type":"rate_limit_error","message":"quota exceeded for billing"}}' };
r = await call(Q); aiFail = null;
ok('AI_FREE_ONLY=off — 과금 신호에도 정지하지 않고 규칙으로', CFG.aiFreeOnly === false && r.j.mode === 'rule' && !r.j.paused && !(await U.readHalt()), { free: CFG.aiFreeOnly, r: r.j });
/* 무료 모드 켜짐(기본) — 같은 신호면 멈춘다 */
setEnv({ GEMINI_API_KEY: 'g' }); await U.clearHalt();
aiFail = { status: 429, body: '{"error":{"message":"You exceeded your current quota, please check your plan and billing details."}}' };
r = await call(Q); aiFail = null;
ok('기본(무료 모드) — 같은 신호면 정지 + 점검 중', r.j.paused === true && (await U.readHalt())?.reason === 'quota-exceeded', r.j);
/* 보안 */
const KEY = 'k'.repeat(24); process.env.PROPOSAL_ADMIN_KEY = KEY;
const crypto = await import('node:crypto'); const exp = String(Date.now() + 3600000);
const cookie = 'mk_pa=' + encodeURIComponent(exp + '.' + crypto.createHmac('sha256', 'cfg-secret|admin|' + KEY).update(exp).digest('hex'));
const adm = (h = {}) => ADMIN(new Request('https://monnit.co.kr/ops/proposals/action', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', ...h }, body: JSON.stringify({ op: 'ai_resume' }) }), {});
let a = await adm({});
ok('보안 — 로그인 없이 ai_resume → 401', a.status === 401 && (await U.readHalt()), a.status);
a = await adm({ cookie });
ok('  로그인은 됐지만 x-requested-with 없음 → 403(CSRF)', a.status === 403 && (await U.readHalt()), a.status);
a = await adm({ cookie, 'x-requested-with': 'mk' });
ok('  정상 요청 → 해제', a.status === 200 && !(await U.readHalt()), a.status);
r = await call(Q, { origin: 'https://evil.example' });
ok('  다른 출처에서 대화 API → 403', r.s === 403, r.s);
r = await call('x'.repeat(17000));
ok('  16KB 초과 본문 → 413', r.s === 413, r.s);
r = await call({ messages: [{ role: 'user', text: '<img src=x onerror=alert(1)>' }], fields: { company: '<script>alert(1)</script>' } });
ok('  HTML 을 넣어도 값은 문자열로만 돌아온다(화면은 esc 로 그린다)', r.s === 200 && typeof r.j.reply === 'string', r.j);
ok('  응답에 키·내부 경로가 새지 않는다', !/GEMINI|ANTHROPIC|sk-|AIza|\/var\/task/.test(JSON.stringify(r.j)));
console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 설정 조합·보안 전부 통과');
process.exit(fail ? 1 : 0);
