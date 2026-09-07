/* 접수 한 건 → 원장 · 알림 메일 · 먼데이 가 모두 도는가 (/api/lead 전 구간)
   고객 응대 메일은 여기서 안 나간다 — 백서는 sendpw, 컨설팅은 sendguide 담당 */
import fs from 'node:fs';
const F = process.cwd() + '/netlify/functions/';

globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = []; globalThis.__MON = [];

fs.writeFileSync(F + '_store_c.mjs', `
export async function get(s,k){return (globalThis.__MEM[s]||{})[k]||null;}
export async function set(s,k,t){(globalThis.__MEM[s]=globalThis.__MEM[s]||{})[k]=t;return true;}
export async function append(s,k,o){const c=await get(s,k)||'';return set(s,k,c?c+'\\n'+JSON.stringify(o):JSON.stringify(o));}
`);
fs.writeFileSync(F + '_notify_c.mjs', `export async function notify(l,p){ globalThis.__NOTIFY.push(l); return {ok:true}; }`);
fs.writeFileSync(F + '_monday_c.mjs', `export async function pushLead(id,l){ globalThis.__MON.push({id,l}); return {ok:true,itemId:'i1'}; }`);
/* 먼데이가 통째로 터져도 원장·메일은 살아야 한다 */
fs.writeFileSync(F + '_monday_boom.mjs', `export async function pushLead(){ throw new Error('먼데이 다운'); }`);

const mk = (mondayMod) => {
  fs.writeFileSync(F + '_lead_c.mjs', fs.readFileSync(F + 'lead.mjs', 'utf8')
    .replace("from './_store.mjs'", "from './_store_c.mjs'")
    .replace("from './_notify.mjs'", "from './_notify_c.mjs'")
    .replace("from './_monday.mjs'", "from './" + mondayMod + "'"));
  return import(F + '_lead_c.mjs?' + Date.now());
};

const post = (M, payload, type) => M.default(new Request('https://x/api/lead', {
  method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'test' },
  body: JSON.stringify({ lead_type: type || 'contact', ts: '2026-09-07T01:00:00.000Z', page: '/promo/alarm', payload })
}));

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };

let M = await mk('_monday_c.mjs');

/* 정상 접수 */
let res = await post(M, {
  '회사명': '가나전자', '이름/직급': '홍길동', '전화번호': '010-1111-2222', '이메일': 'a@x.com',
  '신청 프로모션': '긴급 경보 알리미 상시 프로모션', '접점': 'promo_apply',
  '출처': 'utm_source=meta · utm_content=alarm_a'
});
ok('응답 204', res.status === 204, res.status);
const rows = (globalThis.__MEM.leads['2026-09.jsonl'] || '').split('\n').filter(Boolean).map(JSON.parse);
ok('① 원장 1건', rows.length === 1, rows.length);
ok('② 알림 메일 1통', globalThis.__NOTIFY.length === 1, globalThis.__NOTIFY.length);
ok('③ 먼데이 1건', globalThis.__MON.length === 1, globalThis.__MON.length);
ok('먼데이 id = ops id 규격',
   globalThis.__MON[0].id === '2026-09-07T01:00:00.000Z|a@x.com', globalThis.__MON[0].id);
ok('채널 판별 메타', rows[0].channel === '메타', rows[0].channel);
ok('회사명 전달', globalThis.__MON[0].l.company === '가나전자', globalThis.__MON[0].l.company);

/* 신원 없는 껍데기는 아무것도 하지 않는다 */
const before = [globalThis.__NOTIFY.length, globalThis.__MON.length];
res = await post(M, { '문의 사항': '(미기재)' });
ok('껍데기 접수는 204', res.status === 204, res.status);
ok('껍데기는 원장 미기록', (globalThis.__MEM.leads['2026-09.jsonl'].split('\n').filter(Boolean).length) === 1);
ok('껍데기는 메일·먼데이 없음',
   globalThis.__NOTIFY.length === before[0] && globalThis.__MON.length === before[1]);

/* 먼데이가 터져도 원장·메일은 살아야 한다 */
globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = [];
M = await mk('_monday_boom.mjs');
res = await post(M, { '회사명': '다라산업', '이메일': 'b@x.com', '접점': 'promo_apply' });
ok('먼데이 예외에도 204', res.status === 204, res.status);
ok('먼데이 예외에도 원장 기록', (globalThis.__MEM.leads['2026-09.jsonl'] || '').includes('다라산업'));
ok('먼데이 예외에도 알림 메일', globalThis.__NOTIFY.length === 1, globalThis.__NOTIFY.length);

for (const f of ['_store_c.mjs', '_notify_c.mjs', '_monday_c.mjs', '_monday_boom.mjs', '_lead_c.mjs'])
  fs.unlinkSync(F + f);
console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
