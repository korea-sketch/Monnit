/* 실제 blob 없이 build() 전 구간을 돌린다 — 스토어를 메모리로 대체 */
import fs from 'node:fs';
const F=''+process.cwd()+'/netlify/functions/';

const MEM={leads:{},ads:{},adcreatives:{},ops:{},health:{}};
const ymNow='2026-09', ymPrev='2026-08';
const lead=(ts,type,src,co,em)=>JSON.stringify({ts,type,label:type==='contact'?'접수':'자료',
  channel:/facebook/.test(src)?'메타':(/google/.test(src)?'구글':(/naver/.test(src)?'네이버':'직접')),
  point:'promo_apply',company:co,name:'담당',phone:'010-0000-0000',email:em,region:'',asset:'공장',
  interest:'공장 설비 예지보전',source:src,landing:'https://monnit.co.kr/promo/alarm/'});
MEM.leads[ymPrev+'.jsonl']=[
  lead('2026-08-05T01:00:00Z','contact','utm_source=facebook · utm_medium=cpc · utm_content=alarm_noshow','A사','a@x.com'),
  lead('2026-08-16T01:00:00Z','contact','utm_source=facebook · utm_medium=cpc · utm_content=alarm_noshow','B사','b@x.com'),
  lead('2026-08-19T01:00:00Z','doc_request','utm_source=google · utm_medium=cpc · utm_content=01_소방','C사','c@x.com'),
  lead('2026-08-20T01:00:00Z','contact','ref=https://search.naver.com/search.naver?q=화재알리미','D사','d@x.com'),
  lead('2026-08-25T01:00:00Z','contact','direct','E사','e@x.com'),
  /* 우리가 손으로 넣어 본 점검 2건 — 집계에서 빠져야 한다 */
  lead('2026-08-26T01:00:00Z','contact','utm_source=facebook · utm_medium=cpc · utm_content=alarm_noshow','1004test','1004@monnit.com'),
  lead('2026-08-27T01:00:00Z','doc_request','direct','테스트회사','zz@x.com')
].join('\n');
const ad=(d,ch,sp,im,ck)=>JSON.stringify({channel:ch,date:d,spend:sp,impressions:im,clicks:ck,results:0});
MEM.ads[ymPrev+'.jsonl']=[ad('2026-08-05','메타',20000,900,12),ad('2026-08-16','메타',20000,880,11),
  ad('2026-08-19','구글',18000,300,22),ad('2026-08-25','메타',15000,700,9)].join('\n');
const cr=(d,ch,id,nm,utm,sp,im,ck,ca)=>JSON.stringify({channel:ch,date:d,ad_id:id,ad_name:nm,
  campaign:'260826_알리미4종',adset:'알리미_수도권',created_at:ca,spend:sp,impressions:im,clicks:ck,results:0,utm_content:utm});
MEM.adcreatives[ymPrev+'.jsonl']=[
  cr('2026-08-05','메타','1','알리미 노출용','alarm_noshow',20000,900,12,'2026-08-01'),
  cr('2026-08-16','메타','1','알리미 노출용','alarm_noshow',20000,880,11,'2026-08-01'),
  cr('2026-08-25','메타','2','알리미 가격용','',15000,700,9,'2026-08-01'),
  cr('2026-08-19','구글','3','01_소방','01_소방',18000,300,22,'2026-08-18')
].join('\n');
MEM.ops['deals.json']=JSON.stringify({
  '2026-08-05T01:00:00Z|a@x.com':{stage:'수주',quoted_at:'2026-08-08T00:00:00Z',won_at:'2026-08-15T00:00:00Z',mrr:30000,term_months:24},
  '2026-08-16T01:00:00Z|b@x.com':{stage:'견적',quoted_at:'2026-08-21T00:00:00Z',quote_amount:1200000}
});
MEM.ads['clarity.json']=JSON.stringify({sessions:203,engage:33,scroll:43.85,rage:0,dead:4.43,quick:2.96,err:0.99});
MEM.health['latest.json']=JSON.stringify({ts:'2026-09-01T05:00:00Z',ok:true,results:[{name:'홈',ok:true,ms:45}]});

/* _store.mjs 를 메모리 버전으로 갈아끼운다 */
const storeSrc = `
export async function get(s,k){return (globalThis.__MEM[s]||{})[k]||null;}
export async function set(s,k,t){(globalThis.__MEM[s]=globalThis.__MEM[s]||{})[k]=t;return true;}
export async function append(s,k,o){const c=await get(s,k)||'';return set(s,k,c?c+'\\n'+JSON.stringify(o):JSON.stringify(o));}
export async function readLines(s,k){const t=await get(s,k);if(!t)return [];
  return t.split('\\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);}
export async function available(){return true;}
export async function diag(){return {sdk:true};}
`;
fs.writeFileSync(F+'_store_mem.mjs', storeSrc);
globalThis.__MEM = MEM;
process.env.META_TOKEN='x'; process.env.META_AD_ACCOUNT='act_1';
process.env.GOOGLE_ADS_SHEET='https://x'; process.env.CLARITY_TOKEN='x';
process.env.OPS_USER='u'; process.env.OPS_PASS='p';

for (const [src,dst] of [['ops.mjs','_ops_test.mjs'],['_deals.mjs','_deals_test.mjs']]) {
  let t = fs.readFileSync(F+src,'utf8')
    .replace("from './_store.mjs'","from './_store_mem.mjs'")
    .replace("from './_deals.mjs'","from './_deals_test.mjs'");
  fs.writeFileSync(F+dst, t);
}
const M = await import(F+'_ops_test.mjs');

const auth = await import(F+'_ops_auth.mjs');
const COOKIE = 'mk_ops=' + encodeURIComponent(auth.issue());
const res = await M.default(new Request('https://x/ops/data?p=90d',{headers:{cookie:COOKIE}}));
const j = await res.json();

const P=(a,b)=>console.log(String(a).padEnd(22)+': '+b);
console.log('=== /ops/data 응답 ===');
P('status', res.status);
P('period', j.period.label+' ('+j.period.from+' ~ '+j.period.to+')');
P('creatives', j.creatives.length);
j.creatives.forEach(c=>P('  '+c.key, 'spend='+c.spend+' clk='+c.clicks+' leads='+c.leads+' cpl='+c.cpl+' seg='+(c.segments||[]).length));
P('utmAudit', j.utmAudit.length);
j.utmAudit.forEach(x=>P('  '+x.key, x.status+' — '+x.msg.slice(0,50)));
P('actions', j.actions.length);
j.actions.forEach(a=>P('  p'+a.p, a.title));
P('funnel 총', j.funnel.total+' / 견적 '+j.funnel.reached.견적+' / 수주 '+j.funnel.reached.수주);
P('견적 중앙값', j.funnel.days_to_quote_median+'일');
P('economics CAC', j.economics.cac+' LTV '+j.economics.avg_ltv+' LTV:CAC '+j.economics.ltv_cac);
P('leads', j.leads.length+' (첫 건 단계: '+j.leads[j.leads.length-1].deal.stage+')');
P('테스트 제외', j.testExcluded+'건');

/* 점검 2건이 실제로 빠졌는지 못을 박는다.
   숫자에서만 빼는 게 아니라 목록에도 안 나와야 한다 —
   목록에 남으면 그걸 보고 영업이 전화를 건다. */
{
  let bad = 0;
  const say = (ok, m) => { if (!ok) { bad++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
  console.log('\n=== 내부 테스트 접수 제외 ===');
  say(j.testExcluded === 2, '테스트 2건을 인식했다 (받음 ' + j.testExcluded + ')');
  const names = j.leads.map(r => r.company + '|' + r.email).join(' ');
  say(!/1004@monnit\.com/.test(names), '1004@monnit.com 이 목록에 없다');
  say(!/테스트회사/.test(names), '「테스트회사」가 목록에 없다');
  say(j.leads.length === 5, '남은 리드는 진짜 5건 (받음 ' + j.leads.length + ')');
  const meta = j.creatives.find(c => c.key === 'alarm_noshow');
  say(!meta || meta.leads === 2, '소재 집계에도 안 섞인다 — alarm_noshow leads=' + (meta ? meta.leads : '없음'));
  if (bad) { console.log('\n제외 시험 실패 ' + bad + '건'); process.exitCode = 1; }
}

/* ── 접수 삭제 ─────────────────────────────────────────────────────── */
{
  let bad = 0;
  const say = (ok, m) => { if (!ok) { bad++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
  console.log('\n=== 접수 삭제 · 되돌리기 ===');

  const post = (u, b) => M.default(new Request('https://x' + u, {
    method: 'POST', headers: { cookie: COOKIE, 'content-type': 'application/json' },
    body: JSON.stringify(b)
  }));
  const data = async () => (await M.default(new Request('https://x/ops/data?p=90d', { headers: { cookie: COOKIE } }))).json();

  const before = await data();
  const pick = before.leads.slice(0, 2).map(r => r.id);
  say(pick.length === 2, '지울 대상 2건을 골랐다');

  /* 로그인 안 한 요청은 막혀야 한다 — 목록을 지우는 일이라 특히 */
  const noAuth = await M.default(new Request('https://x/ops/delete', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: pick })
  }));
  say(noAuth.status === 401 || noAuth.status === 302, '로그인 없이는 못 지운다 (status ' + noAuth.status + ')');

  const r1 = await post('/ops/delete', { ids: pick });
  const o1 = await r1.json();
  say(r1.status === 200 && o1.changed === 2, '2건 삭제됨 (changed ' + o1.changed + ')');

  const after = await data();
  say(after.leads.length === before.leads.length - 2, '목록에서 2건 줄었다 ('
      + before.leads.length + ' → ' + after.leads.length + ')');
  say(!after.leads.some(r => pick.includes(r.id)), '지운 건이 목록에 안 보인다');
  say(after.deletedCount === 2, '삭제 건수를 화면에 알려준다 (' + after.deletedCount + ')');
  say(after.funnel.total === before.funnel.total - 2, '깔때기 총계에서도 빠졌다 ('
      + before.funnel.total + ' → ' + after.funnel.total + ')');

  /* 같은 건을 또 눌러도 두 번 세지 않는다 */
  const o2 = await (await post('/ops/delete', { ids: pick })).json();
  say(o2.changed === 0 && o2.total === 2, '두 번 눌러도 중복으로 안 쌓인다');

  /* 되돌리기 */
  const o3 = await (await post('/ops/restore', { ids: pick })).json();
  say(o3.changed === 2, '2건 되돌림');
  const back = await data();
  say(back.leads.length === before.leads.length, '목록이 원래대로 (' + back.leads.length + ')');
  say(back.deletedCount === 0, '삭제 표시가 사라졌다');

  /* 원장은 그대로여야 한다 — 진짜로 줄을 지우면 되돌릴 수 없다 */
  const raw = (globalThis.__MEM.leads['2026-08.jsonl'] || '').split('\n').filter(Boolean).length;
  say(raw === 7, '원장 원본은 그대로 7줄 (받음 ' + raw + ')');

  /* 빈 요청·과한 요청 방어 */
  say((await post('/ops/delete', { ids: [] })).status === 400, '대상이 없으면 400');
  const many = Array.from({ length: 201 }, (_, i) => 'x' + i);
  say((await post('/ops/delete', { ids: many })).status === 400, '한 번에 200건 넘으면 400');

  if (bad) { console.log('\n삭제 시험 실패 ' + bad + '건'); process.exitCode = 1; }
}

/* 커스텀 기간 */
const r2 = await M.default(new Request('https://x/ops/data?p=30d&from=2026-08-15&to=2026-08-20',{headers:{cookie:COOKIE}}));
const j2 = await r2.json();
console.log('\n=== 커스텀 기간 2026-08-15 ~ 08-20 ===');
P('period', j2.period.label+' custom='+j2.period.custom+' days='+j2.period.days);
P('creatives', j2.creatives.map(c=>c.key+'('+c.leads+')').join(', '));

/* 뒷정리 — 안 지우면 netlify/functions 에 남아 배포본에 딸려 간다 */
for (const f of ['_store_mem.mjs', '_ops_test.mjs', '_deals_test.mjs']) {
  try { fs.unlinkSync(F + f); } catch (e) {}
}
