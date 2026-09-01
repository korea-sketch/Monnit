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
  lead('2026-08-25T01:00:00Z','contact','direct','E사','e@x.com')
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

/* 커스텀 기간 */
const r2 = await M.default(new Request('https://x/ops/data?p=30d&from=2026-08-15&to=2026-08-20',{headers:{cookie:COOKIE}}));
const j2 = await r2.json();
console.log('\n=== 커스텀 기간 2026-08-15 ~ 08-20 ===');
P('period', j2.period.label+' custom='+j2.period.custom+' days='+j2.period.days);
P('creatives', j2.creatives.map(c=>c.key+'('+c.leads+')').join(', '));
