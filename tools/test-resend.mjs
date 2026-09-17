/* /ops/resend · /ops/testmail 검사 — 실제 blob·메일·먼데이 없이 돌린다 */
import fs from 'node:fs';
const F = process.cwd() + '/netlify/functions/';

const MEM = { leads: {}, ads: {}, adcreatives: {}, ops: {}, health: {} };
const lead = (ts, co, em) => JSON.stringify({
  ts, type: 'contact', label: '접수', channel: '메타', point: 'promo_apply',
  company: co, name: '담당', phone: '010-1111-2222', email: em,
  interest: '긴급 경보 알리미 상시 프로모션', source: 'utm_source=meta · utm_content=alarm_a',
  landing: 'https://monnit.co.kr/promo/alarm/'
});
MEM.leads['2026-09.jsonl'] = [
  lead('2026-09-04T01:00:00Z', '이전건', 'old@x.com'),      // 범위 밖
  lead('2026-09-05T01:00:00Z', '가나전자', 'a@x.com'),
  lead('2026-09-06T02:00:00Z', '다라산업', 'b@x.com'),
  lead('2026-09-07T03:00:00Z', '마바빌딩', 'c@x.com'),
  JSON.stringify({ ts: '2026-09-06T04:00:00Z', company: '__점검더미', type: 'contact' }) // 제외돼야 함
].join('\n');
MEM.ops['deals.json'] = '{}';

const storeSrc = `
export async function get(s,k){return (globalThis.__MEM[s]||{})[k]||null;}
export async function set(s,k,t){(globalThis.__MEM[s]=globalThis.__MEM[s]||{})[k]=t;return true;}
export async function append(s,k,o){const c=await get(s,k)||'';return set(s,k,c?c+'\\n'+JSON.stringify(o):JSON.stringify(o));}
export async function readLines(s,k){const t=await get(s,k);if(!t)return [];
  return t.split('\\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);}
export async function available(){return true;}
export async function diag(){return {sdk:true};}
`;
fs.writeFileSync(F + '_store_mem.mjs', storeSrc);

/* 메일·먼데이는 실제로 부르지 않고 호출 내역만 기록한다 */
fs.writeFileSync(F + '_notify_mem.mjs', `
export async function notify(lead,p){ globalThis.__MAIL.push(lead); return {ok:true}; }
export function configured(){ return { to:'0702yeom@gmail.com', brevo:true }; }
`);
fs.writeFileSync(F + '_monday_mem.mjs', `
export async function pushLead(id,lead){
  if (globalThis.__MON.some(x=>x.id===id)) return {ok:true, skipped:'이미 등록됨'};
  globalThis.__MON.push({id,lead}); return {ok:true, itemId:'i'+globalThis.__MON.length}; }
export async function ping(){ return {ok:true, board:'리드 원장 (Lead CRM)'}; }
`);

globalThis.__MEM = MEM; globalThis.__MAIL = []; globalThis.__MON = [];
process.env.OPS_USER = 'u'; process.env.OPS_PASS = 'p';

for (const [src, dst] of [['ops.mjs', '_ops_rt.mjs'], ['_deals.mjs', '_deals_rt.mjs']]) {
  fs.writeFileSync(F + dst, fs.readFileSync(F + src, 'utf8')
    .replace("from './_store.mjs'", "from './_store_mem.mjs'")
    .replace("from './_deals.mjs'", "from './_deals_rt.mjs'")
    .replace("from './_notify.mjs'", "from './_notify_mem.mjs'")
    .replace("from './_monday.mjs'", "from './_monday_mem.mjs'"));
}
const M = await import(F + '_ops_rt.mjs');
const auth = await import(F + '_ops_auth.mjs');
const CK = { cookie: 'mk_ops=' + encodeURIComponent(auth.issue()) };
const call = async u => { const r = await M.default(new Request('https://x' + u, { headers: CK })); return { s: r.status, j: await r.json().catch(() => null) }; };

let fail = 0;
const ok = (n, cond, got) => { console.log((cond ? 'ok   ' : 'FAIL ') + n + (cond ? '' : '  받음=' + JSON.stringify(got))); if (!cond) fail++; };

/* 인증 없으면 401 */
const anon = await M.default(new Request('https://x/ops/resend?from=2026-09-05&to=2026-09-07'));
ok('미인증은 401', anon.status === 401, anon.status);

/* 날짜 형식 검사 */
let r = await call('/ops/resend?from=9/5&to=2026-09-07');
ok('잘못된 날짜는 400', r.s === 400, r);
r = await call('/ops/resend?from=2026-09-08&to=2026-09-05');
ok('시작>종료는 400', r.s === 400, r);

/* dry 미리보기 — 아무것도 보내면 안 된다 */
r = await call('/ops/resend?dry=1&from=2026-09-05&to=2026-09-07');
ok('dry 건수 3', r.j.count === 3, r.j.count);
ok('dry 는 메일 안 보냄', globalThis.__MAIL.length === 0, globalThis.__MAIL.length);
ok('dry 는 먼데이 안 올림', globalThis.__MON.length === 0, globalThis.__MON.length);
ok('범위 밖 제외', !JSON.stringify(r.j.leads).includes('이전건'), r.j.leads);
ok('점검더미 제외', !JSON.stringify(r.j.leads).includes('점검더미'), r.j.leads);

/* 실제 복구 */
r = await call('/ops/resend?from=2026-09-05&to=2026-09-07');
ok('복구 건수 3', r.j.count === 3, r.j.count);
ok('메일은 한 통으로 묶음', globalThis.__MAIL.length === 1, globalThis.__MAIL.length);
ok('메일에 3건 다 담김',
   ['가나전자', '다라산업', '마바빌딩'].every(n => globalThis.__MAIL[0].memo.includes(n)), globalThis.__MAIL[0].memo);
ok('먼데이 3건 생성', r.j.monday.created === 3, r.j.monday);

/* 두 번 눌러도 중복 생성 안 됨 */
r = await call('/ops/resend?from=2026-09-05&to=2026-09-07');
ok('재실행 시 신규 0', r.j.monday.created === 0, r.j.monday);
ok('재실행 시 이미있음 3', r.j.monday.already === 3, r.j.monday);
ok('먼데이 총 3건 유지', globalThis.__MON.length === 3, globalThis.__MON.length);

/* 재실행하면 메일은 의도적으로 다시 간다 — 중복을 막는 건 먼데이 쪽뿐이다 */
ok('재실행 시 메일은 다시 감', globalThis.__MAIL.length === 2, globalThis.__MAIL.length);

/* 빈 기간 — 보낼 게 없으면 메일도 안 나가야 한다 */
const before = globalThis.__MAIL.length;
r = await call('/ops/resend?from=2026-01-01&to=2026-01-02');
ok('빈 기간 0건', r.j.count === 0, r.j.count);
ok('빈 기간엔 메일 안 감', globalThis.__MAIL.length === before, globalThis.__MAIL.length);

/* testmail */
r = await call('/ops/testmail');
ok('testmail 발송', r.j.sent === true, r.j);

/* deal 라우팅 — 예전에는 표에서 빠져 화면 HTML 이 돌아왔다 */
const dealRes = await M.default(new Request('https://x/ops/deal', { method: 'GET', headers: CK }));
ok('deal 은 JSON 응답', (dealRes.headers.get('content-type') || '').includes('json'), dealRes.headers.get('content-type'));

for (const f of ['_store_mem.mjs', '_notify_mem.mjs', '_monday_mem.mjs', '_ops_rt.mjs', '_deals_rt.mjs'])
  fs.unlinkSync(F + f);

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
