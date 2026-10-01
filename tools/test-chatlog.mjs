/** 「규칙이 놓친 말」 기록 검사 (2026-09-18)
 *
 *  AI 를 한 번 부르면 반드시 기록이 남아야 한다. 기록이 없으면 구멍을 못 막는다.
 *  동시에, 그 기록에 고객의 이메일·전화가 그대로 남아서도 안 된다.
 */
globalThis.__PROPOSAL_MEM = {};        /* 저장소를 메모리로 — 실제 Blobs 를 건드리지 않는다 */

const { logMiss, readMisses, clearAll } = await import('../netlify/lib/proposal/chatlog.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + '  받음=' + JSON.stringify(got)); } };

/* ── 1. 규칙이 놓친 말 (AI 안 씀) ── */
{
  const r = await logMiss({ ask: 'company', say: '음 그게 저기 그거요', why: 'unmatched', retry: 0, ai: false });
  ok('규칙 실패가 기록된다', r.ask === 'company' && r.ai === false && r.why === 'unmatched', r);
  ok('  돈을 안 썼으면 비용 항목이 없다', r.usd === undefined && r.got === undefined, r);
}

/* ── 2. 개인정보는 지운 뒤 남긴다 ── */
{
  const r = await logMiss({ ask: 'email', say: '제 메일은 hong@daehan.co.kr 이고 전화는 010-1234-5678 입니다', why: 'unmatched', ai: false });
  ok('이메일이 지워진다', !/hong@daehan/.test(r.say) && /\(메일\)/.test(r.say), r.say);
  ok('  전화번호도 지워진다', !/1234-5678/.test(r.say) && /\(전화\)/.test(r.say), r.say);
}

/* ── 3. AI 를 쓴 건 — 비용과 「정답지」까지 ── */
{
  const r = await logMiss({
    ask: 'company', say: '저희가 평택이랑 안성에 공장이 두 개 있는데요', why: 'unmatched', retry: 2,
    ai: true, model: 'claude-haiku-4-5', usd: 0.00042,
    got: { company: '대한정밀', fac: 'factory', email: 'kim@daehan.co.kr', phone: '010-1111-2222' }
  });
  ok('AI 호출이 기록된다', r.ai === true && r.model === 'claude-haiku-4-5', r);
  ok('  비용이 남는다', r.usd === 0.00042, r.usd);
  ok('  AI 가 읽어 낸 값이 남는다(규칙 개선용 정답지)', r.got.company === '대한정밀' && r.got.fac === 'factory', r.got);
  ok('  정답지에도 이메일·전화 원문은 남지 않는다', r.got.email === '(메일)' && r.got.phone === '(전화)', r.got);
}

/* ── 4. 같은 말은 묶여서 보인다 ── */
{
  for (let i = 0; i < 3; i++) await logMiss({ ask: 'con', say: '글쎄요 뭐랄까 그런 거요', why: 'unmatched', ai: false });
  const { grouped, totals } = await readMisses({ days: 2 });
  const g = grouped.find(x => x.ask === 'con');
  ok('같은 말이 한 줄로 묶인다', g && g.n === 3, g);
  ok('  AI 를 쓴 것이 맨 위로 온다', grouped[0] && grouped[0].ai > 0, grouped[0]);
  ok('  합계가 맞는다', totals.rows === 6 && totals.ai === 1, totals);
  ok('  항목별로도 센다', totals.byAsk.company === 2 && totals.byAsk.con === 3, totals.byAsk);
}

/* ── 5. 기록 실패가 대화를 막지 않는다 ── */
{
  let threw = false;
  try { await logMiss(null); } catch (e) { threw = true; }
  ok('빈 값을 넣어도 터지지 않는다', !threw, threw);
}

/* ── 6. 정리 ── */
{
  const n = await clearAll();
  ok('통째로 비울 수 있다', n >= 6, n);
  const { totals } = await readMisses({ days: 2 });
  ok('  비운 뒤에는 0건', totals.rows === 0, totals);
}

console.log('\n합계  통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
