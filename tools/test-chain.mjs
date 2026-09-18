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

/* 접수 시각 — 서버가 「지금에서 이틀 안쪽」만 받아들인다(lead.mjs safeTs).
   그래서 검사도 현재 시각을 쓴다. 옛 날짜를 보내면 어떻게 되는지는 아래에서 따로 본다. */
const NOW_TS = new Date().toISOString();
const post = (M, payload, type, ts) => M.default(new Request('https://x/api/lead', {
  method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'test' },
  body: JSON.stringify({ lead_type: type || 'contact', ts: ts === undefined ? NOW_TS : ts, page: '/promo/alarm', payload })
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
   globalThis.__MON[0].id === NOW_TS + '|a@x.com', globalThis.__MON[0].id);
ok('  원장과 먼데이가 같은 시각을 쓴다', rows[0].ts === NOW_TS, { ops: rows[0].ts, monday: globalThis.__MON[0].id });
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

/* ── 접수 시각을 화면이 마음대로 정하지 못하게 (2026-09-18) ──────────────
   예전에는 body.ts 를 그대로 원장 키로 썼다.
     · 과거 날짜를 넣으면 저장은 되지만 /ops 조회 범위 밖이라 영영 안 보였고
     · 날짜가 아닌 값이면 월 키를 만들다 예외가 나 접수가 통째로 사라졌다.
   이제 「진짜 날짜이고 지금에서 이틀 안쪽」일 때만 받아들인다. */
{
  const monthOf = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date(t)).slice(0, 7) + '.jsonl';
  const thisMonth = monthOf(Date.now());

  globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = []; globalThis.__MON = [];
  M = await mk('_monday_c.mjs');
  res = await post(M, { '회사명': '과거날짜', '이메일': 'old@x.com' }, 'contact', '2020-01-01T00:00:00.000Z');
  const oldRows = (globalThis.__MEM.leads[thisMonth] || '').split('\n').filter(Boolean).map(JSON.parse);
  ok('과거 날짜를 보내도 접수는 성공', res.status === 204, res.status);
  ok('  이번 달 원장에 들어간다(숨지 않는다)', oldRows.length === 1, Object.keys(globalThis.__MEM.leads));
  ok('  시각은 서버가 정한 값으로 바뀐다', oldRows[0] && Math.abs(Date.parse(oldRows[0].ts) - Date.now()) < 120000, oldRows[0] && oldRows[0].ts);

  globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = []; globalThis.__MON = [];
  res = await post(M, { '회사명': '깨진날짜', '이메일': 'bad@x.com' }, 'contact', 'not-a-date');
  const badRows = (globalThis.__MEM.leads[thisMonth] || '').split('\n').filter(Boolean).map(JSON.parse);
  ok('날짜가 아닌 값을 보내도 접수가 사라지지 않는다', res.status === 204 && badRows.length === 1, { status: res.status, rows: badRows.length });

  globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = []; globalThis.__MON = [];
  res = await post(M, { '회사명': '미래날짜', '이메일': 'fut@x.com' }, 'contact', '2099-01-01T00:00:00.000Z');
  const futRows = (globalThis.__MEM.leads[thisMonth] || '').split('\n').filter(Boolean).map(JSON.parse);
  ok('먼 미래 날짜도 서버 시각으로 바로잡는다', futRows.length === 1 && Math.abs(Date.parse(futRows[0].ts) - Date.now()) < 120000, futRows[0] && futRows[0].ts);

  globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = []; globalThis.__MON = [];
  const near = new Date(Date.now() - 60 * 60 * 1000).toISOString();   /* 한 시간 전 — 느린 전송·시계 오차 */
  res = await post(M, { '회사명': '한시간전', '이메일': 'near@x.com' }, 'contact', near);
  const nearRows = (globalThis.__MEM.leads[monthOf(near)] || '').split('\n').filter(Boolean).map(JSON.parse);
  ok('가까운 과거(한 시간 전)는 그대로 살린다', nearRows.length === 1 && nearRows[0].ts === near, nearRows[0] && nearRows[0].ts);
}

/* ── 본문이 지나치게 크면 받지 않는다 ── */
{
  const big = await M.default(new Request('https://x/api/lead', {
    method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'test' },
    body: JSON.stringify({ lead_type: 'contact', payload: { '회사명': 'x'.repeat(40000) } })
  }));
  ok('32KB 초과 본문 → 413', big.status === 413, big.status);
}

for (const f of ['_store_c.mjs', '_notify_c.mjs', '_monday_c.mjs', '_monday_boom.mjs', '_lead_c.mjs'])
  fs.unlinkSync(F + f);
console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
