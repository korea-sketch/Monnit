/* 알림 발송 경로 — 누가 성공을 판정하고, 사본은 어디로 가는가 */
import fs from 'node:fs';
const src = fs.readFileSync(process.cwd() + '/app.js', 'utf8');
const consts = src.slice(src.indexOf('const GOOGLE_FORM_URL'), src.indexOf('async function sendLead'));
const fn = src.slice(src.indexOf('async function sendLead'), src.indexOf('/* ========== DATA ========== */'));

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };

/* via: 성공을 판정할 곳 · both: 사본 발송 여부 */
function run({ via, both }, fetchImpl) {
  const calls = [];
  const c = consts
    .replace(/const NOTIFY_VIA  = "[^"]*";/, `const NOTIFY_VIA  = "${via}";`)
    .replace(/const NOTIFY_BOTH = \w+;/, `const NOTIFY_BOTH = ${both};`);
  const wrapped = async (u, o) => { calls.push(String(u)); return fetchImpl(String(u), o); };
  const f = new Function('fetch', 'window', 'document', 'URLSearchParams',
    'const CONTACT_EMAIL = "korea@monnit.com";\n' + c + fn + '\nreturn sendLead;');
  const send = f(wrapped, { location: { href: '' } },
    { createElement: () => ({ style: {}, click() {} }), body: { appendChild() {} } }, URLSearchParams);
  return { send, calls };
}
const P = { '이메일': 'a@x.com', _subject: 't' };
const allOk   = async () => ({ ok: true,  json: async () => ({ success: true }) });
const sfLies  = async (u) => u.includes('staticforms')
  ? { ok: true, json: async () => ({ success: true }) }          // 거짓 성공
  : { ok: false, status: 500, json: async () => ({ success: false }) };
const has = (calls, w) => calls.some(u => u.includes(w));

/* ── 지금 설정: Web3Forms 가 판정, StaticForms 로 사본 ── */
{
  const t = run({ via: 'web3forms', both: true }, allOk);
  const r = await t.send(P, null);
  ok('web3forms 판정 · 성공', r === true, r);
  ok('  두 곳 다 발송', has(t.calls, 'web3forms') && has(t.calls, 'staticforms'), t.calls);
}
{
  /* 9/4 사고 재현 시험 — StaticForms 가 거짓말해도 속으면 안 된다 */
  const t = run({ via: 'web3forms', both: true }, sfLies);
  const r = await t.send(P, null);
  ok('StaticForms 거짓 성공에 속지 않는다', r === 'mailto', r);
}
{
  const t = run({ via: 'web3forms', both: true },
    async (u) => { if (u.includes('staticforms')) throw new Error('다운'); return allOk(); });
  ok('사본이 터져도 본 경로는 성공', (await t.send(P, null)) === true);
}

/* ── 사장님 설정: StaticForms 가 판정 ── */
{
  const t = run({ via: 'staticforms', both: true }, allOk);
  const r = await t.send(P, null);
  ok('staticforms 판정 · 성공', r === true, r);
  ok('  두 곳 다 발송', has(t.calls, 'staticforms') && has(t.calls, 'web3forms'), t.calls);
}
{
  const t = run({ via: 'staticforms', both: false }, allOk);
  await t.send(P, null);
  ok('both=false 면 한 곳만', t.calls.length === 1 && has(t.calls, 'staticforms'), t.calls);
}
{
  const t = run({ via: 'staticforms', both: true },
    async (u) => u.includes('staticforms')
      ? { ok: false, status: 500, json: async () => ({ success: false }) }
      : allOk());
  ok('staticforms 실패하면 mailto', (await t.send(P, null)) === 'mailto');
  ok('  그래도 web3forms 사본은 갔다', has(t.calls, 'web3forms'), t.calls);
}

/* 네트워크 전멸 */
{
  const t = run({ via: 'web3forms', both: true }, async () => { throw new Error('끊김'); });
  ok('전부 죽어도 mailto', (await t.send(P, null)) === 'mailto');
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
