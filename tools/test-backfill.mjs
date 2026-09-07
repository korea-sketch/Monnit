/* 밀린 접수 자동 발송 — 한 번만, 정확한 범위로, 실패하면 다시 시도 */
import fs from 'node:fs';
const F = process.cwd() + '/netlify/functions/';

globalThis.__MEM = { ops: {}, leads: {} };
globalThis.__SENT = [];
globalThis.__FAILNEXT = false;

const lead = (ts, co) => JSON.stringify({ ts, company: co, name: '담당', phone: '010-1111-2222',
  email: co + '@x.com', interest: '긴급 경보 알리미', channel: '메타', label: '접수' });
globalThis.__MEM.leads['2026-09.jsonl'] = [
  lead('2026-09-03T01:00:00Z', '범위밖'),
  lead('2026-09-04T01:00:00Z', '가나전자'),
  lead('2026-09-05T02:00:00Z', '다라산업'),
  lead('2026-09-07T03:00:00Z', '마바빌딩'),
  JSON.stringify({ ts: '2026-09-06T04:00:00Z', company: '__더미' })
].join('\n');

fs.writeFileSync(F + '_store_b.mjs', `
export async function get(s,k){return (globalThis.__MEM[s]||{})[k]||null;}
export async function set(s,k,t){(globalThis.__MEM[s]=globalThis.__MEM[s]||{})[k]=t;return true;}
export async function readLines(s,k){const t=await get(s,k);if(!t)return [];
  return t.split('\\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);}
`);
fs.writeFileSync(F + '_notify_b.mjs', `
export async function notify(lead,p,o){
  if (globalThis.__FAILON && globalThis.__FAILON.has(lead.company)) return {ok:false, error:'발송 실패'};
  globalThis.__SENT.push(lead); return {ok:true, to:'0702yeom@gmail.com'};
}`);
fs.writeFileSync(F + '_backfill_b.mjs', fs.readFileSync(F + '_backfill.mjs', 'utf8')
  .replace("from './_store.mjs'", "from './_store_b.mjs'")
  .replace("from './_notify.mjs'", "from './_notify_b.mjs'"));

process.env.BACKFILL_FROM = '2026-09-04';
const { runOnce } = await import(F + '_backfill_b.mjs');

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };
const names = () => globalThis.__SENT.map(x => x.company);

/* 한 건에 한 통씩 */
globalThis.__FAILON = new Set(['다라산업']);
const r1 = await runOnce();
ok('건별 발송 — 성공 2통', r1.sent === 2, r1);
ok('  실패 1건은 남는다', r1.remaining === 1 && !r1.complete, r1);
ok('  범위 밖 제외', names().indexOf('범위밖') < 0, names());
ok('  점검 더미 제외', names().indexOf('__더미') < 0, names());
ok('  보낸 건 = 가나전자, 마바빌딩', names().join(',') === '가나전자,마바빌딩', names());
ok('  본문에 연락처', globalThis.__SENT[0].phone === '010-1111-2222');
ok('  뒤늦은 발송 표시', /뒤늦게 보냅니다/.test(globalThis.__SENT[0].memo), globalThis.__SENT[0].memo);

/* 실패한 건만 다음 주기에 재시도 — 성공한 건은 다시 안 보낸다 */
globalThis.__FAILON = new Set();
const r2 = await runOnce();
ok('재시도 — 실패했던 1통만', r2.sent === 1 && r2.complete, r2);
ok('  총 3통, 중복 없음', globalThis.__SENT.length === 3, names());
ok('  누락됐던 다라산업 포함', names().indexOf('다라산업') >= 0, names());

/* 다 끝나면 더 안 돈다 */
const r3 = await runOnce();
ok('완료 후 재실행은 건너뜀', r3.skipped === '완료됨', r3);
ok('  발송은 여전히 3통', globalThis.__SENT.length === 3, globalThis.__SENT.length);

/* 한 주기 상한 */
globalThis.__MEM.ops = {}; globalThis.__SENT = []; process.env.BACKFILL_MAX = '2';
const r4 = await runOnce();
ok('한 주기 상한 2통', r4.sent === 2 && r4.remaining === 1, r4);
const r5 = await runOnce();
ok('  다음 주기에 나머지', r5.sent === 1 && r5.complete, r5);
delete process.env.BACKFILL_MAX;

/* 스위치 */
globalThis.__MEM.ops = {}; process.env.BACKFILL_OFF = 'true';
const r6 = await runOnce();
ok('BACKFILL_OFF 로 중단', r6.skipped === '꺼짐', r6);
delete process.env.BACKFILL_OFF;

for (const f of ['_store_b.mjs', '_notify_b.mjs', '_backfill_b.mjs']) fs.unlinkSync(F + f);
console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
