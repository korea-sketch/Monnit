import { parseSource, creativeKey, utmContentFromUrl } from '../netlify/functions/_utm.mjs';
import * as D from '../netlify/functions/_deals.mjs';
import { rollup, economics } from '../netlify/functions/_creatives.mjs';

let fail = 0;
const eq = (got, want, msg) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { console.log('FAIL', msg, '\n  got ', a, '\n  want', b); fail++; }
  else console.log('ok  ', msg);
};

/* 1. 실제 출처 문자열 파싱 */
eq(parseSource('utm_source=google · utm_medium=cpc · utm_campaign=alarm_0831 · utm_content=01_소방'),
   {utm_source:'google',utm_medium:'cpc',utm_campaign:'alarm_0831',utm_content:'01_소방'}, 'utm 파싱');
eq(creativeKey({source:'utm_source=google · utm_content=sl_lineup'}), 'sl_lineup', '소재키=utm_content');
eq(creativeKey({source:'fbclid=abc'}), '(메타 · utm 없음)', '소재키=fbclid');
eq(creativeKey({source:'direct'}), '(광고 외 유입)', '소재키=direct');
eq(utmContentFromUrl('https://monnit.co.kr/promo/alarm/?utm_content=01_소방'), '01_소방', 'URL에서 utm_content');

/* 2. LTV */
eq(D.ltvOf({mrr:30000, term_months:12, oneoff:0}), {value:360000, term:12, assumed:false}, 'LTV 실측');
eq(D.ltvOf({mrr:30000}), {value:720000, term:24, assumed:true}, 'LTV 기본가정 24개월');
eq(D.ltvOf({oneoff:5000000, mrr:0}), {value:5000000, term:24, assumed:false}, 'LTV 일시금');

/* 3. 리드타임 + 퍼널 */
const leads = [
  {id:'a', ts:'2026-08-20T00:00:00Z', type:'contact', channel:'구글', company:'A',
   source:'utm_source=google · utm_medium=cpc · utm_content=01_소방'},
  {id:'b', ts:'2026-08-22T00:00:00Z', type:'contact', channel:'메타', company:'B',
   source:'utm_source=facebook · utm_content=alarm_noshow'},
  {id:'c', ts:'2026-08-25T00:00:00Z', type:'doc_request', channel:'메타', company:'C',
   source:'utm_source=facebook · utm_content=alarm_noshow'},
  {id:'d', ts:'2026-08-26T00:00:00Z', type:'contact', channel:'직접', company:'D', source:'direct'}
];
const dealMap = {
  a:{stage:'수주', quoted_at:'2026-08-23T00:00:00Z', won_at:'2026-08-30T00:00:00Z', mrr:30000, term_months:24},
  b:{stage:'견적', quoted_at:'2026-08-27T00:00:00Z', quote_amount:1200000},
  d:{stage:'실패', lost_reason:'예산'}
};
const J = D.attach(leads, dealMap);
eq(J[0].days_to_quote, 3, '접수→견적 3일');
eq(J[0].days_to_win, 10, '접수→수주 10일');
eq(J[0].ltv, 720000, 'LTV 72만');
eq(J[1].days_to_win, null, '수주 안 함 → null');

const f = D.funnel(J);
eq(f.total, 4, '후속 대상 4건 (구독만 제외 — 기존 pending 로직과 동일)');
eq(f.reached.견적, 2, '견적 도달 2');
eq(f.reached.수주, 1, '수주 1');
eq(f.days_to_quote_median, 4, '견적 중앙값 4일 (3,5)');

/* 4. 소재 롤업 — 지출 없는 소재는 null 유지 */
const adAds = [
  {date:'2026-08-22', channel:'메타', ad_id:'1', ad_name:'알리미(노출용)', campaign:'260826_알리미4종',
   utm_content:'alarm_noshow', created_at:'2026-08-20', spend:20000, impressions:5000, clicks:40}
];
const R = rollup(J, adAds, '2026-08-01', '2026-08-31');
const byKey = Object.fromEntries(R.map(x => [x.key, x]));
eq(byKey['alarm_noshow'].spend, 20000, '메타 소재 지출 붙음');
eq(byKey['alarm_noshow'].leads, 2, '메타 소재 리드 2 (문의+자료)');
eq(byKey['alarm_noshow'].cpl, 10000, 'CPL = 2만/2');
eq(byKey['01_소방'].spend, null, '구글 소재는 지출 미연동 → null');
eq(byKey['01_소방'].cpl, null, '지출 없으면 CPL 계산 안 함');
eq(byKey['01_소방'].revenue, 720000, '수주 매출 반영');
eq(byKey['01_소방'].roas, null, '지출 없으면 ROAS 안 냄');

/* 5. 수익성 */
const e = economics(J, 350000);
eq(e.won, 1, '수주 1');
eq(e.cac, 350000, 'CAC = 광고비/수주');
eq(e.avg_ltv, 720000, '평균 LTV');
eq(e.ltv_cac, 2.06, 'LTV:CAC');
eq(e.payback_months, 11.7, '회수 개월');

/* 6. 네이버 — 검색 유입 구분 */
eq(creativeKey({source:'ref=https://search.naver.com/search.naver?query=화재알리미'}), '(네이버 검색 유입)', '네이버 검색 유입 구분');
eq(creativeKey({source:'naver_ad=abc123'}), '(네이버 · utm 없음)', '네이버 광고 utm 없음');
eq(creativeKey({source:'utm_source=naver · utm_content=알리미_소방'}), '알리미_소방', '네이버 utm 있으면 소재로');

/* 7. 네이버 캠페인 롤업 */
const naverAds = [
  {date:'2026-08-20', channel:'네이버', ad_id:'cmp-1', ad_name:'알리미_소방_검색',
   campaign:'알리미_소방_검색', created_at:'2026-08-01', spend:33000, impressions:1200, clicks:18, utm_content:''}
];
const R2 = rollup([], naverAds, '2026-08-01','2026-08-31');
eq(R2[0].key, '알리미_소방_검색', '네이버는 캠페인명이 소재 키');
eq(R2[0].spend, 33000, '네이버 지출 집계');
eq(R2[0].cpl, null, '리드 0이면 CPL 계산 안 함');
console.log(fail ? '\n❌ 실패 ' + fail + '건' : '\n✅ 전부 통과');
