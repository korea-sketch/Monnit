/** 딜 파이프라인 — 접수 이후에 벌어진 일을 기록한다.
 *
 *  광고 플랫폼은 「리드까지」만 안다. 견적을 언제 냈고 얼마에 계약했는지는
 *  여기서 쌓지 않으면 어디에도 남지 않는다.
 *
 *  저장: ops 스토어의 deals.json — { 리드ID: 딜 } 맵.
 *  기존 handled.json 은 그대로 두고 하위 호환으로 읽는다. */

import { get, set } from './_store.mjs';

export const STAGES = ['접수', '통화', '견적', '수주', '실패'];
export const OPEN_STAGES = ['접수', '통화', '견적'];

/** 기본 유지 개월 — 구독형(알리미) LTV 계산의 기본 가정.
 *  딜별로 term_months 를 넣으면 그 값이 우선한다. */
export const DEFAULT_TERM = 24;

const n = v => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : 0; };

export function normalize(d) {
  const o = d && typeof d === 'object' ? d : {};
  const stage = STAGES.includes(o.stage) ? o.stage : '접수';
  return {
    stage,
    quoted_at:  o.quoted_at || '',
    won_at:     o.won_at || '',
    lost_at:    o.lost_at || '',
    quote_amount: n(o.quote_amount),
    mrr:        n(o.mrr),
    oneoff:     n(o.oneoff),
    term_months: o.term_months === '' || o.term_months == null ? null : n(o.term_months),
    lost_reason: String(o.lost_reason || '').slice(0, 200),
    memo:       String(o.memo || '').slice(0, 500),
    updated_at: o.updated_at || ''
  };
}

/** LTV = 월 구독료 × 유지 개월 + 일시 매출.
 *  유지 개월은 딜에 값이 있으면 그것을, 없으면 기본 가정을 쓴다.
 *  가정을 쓴 경우 assumed=true 로 표시해서 화면에서 실측과 구분한다. */
export function ltvOf(deal) {
  const d = normalize(deal);
  const assumed = d.term_months == null && d.mrr > 0;
  const term = d.term_months == null ? DEFAULT_TERM : d.term_months;
  return { value: d.mrr * term + d.oneoff, term, assumed };
}

const DAY = 864e5;
const daysBetween = (a, b) => {
  if (!a || !b) return null;
  const x = new Date(a).getTime(), y = new Date(b).getTime();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.round((y - x) / DAY * 10) / 10;
};

export function median(list) {
  const a = list.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2 * 10) / 10;
}

/** 리드 배열 + 딜 맵 → 리드마다 딜 정보를 붙이고 파생값을 계산한다 */
export function attach(leads, deals) {
  return leads.map(r => {
    const d = normalize(deals[r.id]);
    const ltv = ltvOf(d);
    return {
      ...r,
      deal: d,
      ltv: ltv.value,
      ltv_term: ltv.term,
      ltv_assumed: ltv.assumed,
      days_to_quote: daysBetween(r.ts, d.quoted_at),
      days_to_win:   daysBetween(r.ts, d.won_at)
    };
  });
}

/** 퍼널 · 리드타임 요약 */
export function funnel(list) {
  const contacts = list.filter(r => r.type !== 'subscribe');
  const at = s => contacts.filter(r => r.deal.stage === s).length;
  const reached = s => {
    const i = STAGES.indexOf(s);
    return contacts.filter(r => {
      const j = STAGES.indexOf(r.deal.stage);
      /* 실패는 어느 단계에서든 날 수 있으므로 도달 계산에서 제외한다 */
      return r.deal.stage !== '실패' && j >= i;
    }).length;
  };
  const quotedAll = contacts.filter(r => r.deal.quoted_at).length;
  const wonAll    = contacts.filter(r => r.deal.won_at).length;

  return {
    total: contacts.length,
    stage: { 접수: at('접수'), 통화: at('통화'), 견적: at('견적'), 수주: at('수주'), 실패: at('실패') },
    reached: { 통화: reached('통화'), 견적: quotedAll, 수주: wonAll },
    lead_to_quote: contacts.length ? Math.round(quotedAll / contacts.length * 1000) / 10 : 0,
    quote_to_win:  quotedAll ? Math.round(wonAll / quotedAll * 1000) / 10 : 0,
    days_to_quote_median: median(contacts.map(r => r.days_to_quote)),
    days_to_win_median:   median(contacts.map(r => r.days_to_win)),
    /* 견적을 아직 안 낸 채 오래 묵은 건 — 가장 아까운 것들 */
    stale: contacts
      .filter(r => OPEN_STAGES.includes(r.deal.stage) && !r.deal.quoted_at)
      .map(r => ({ id: r.id, company: r.company || r.name || r.email,
                   days: daysBetween(r.ts, new Date().toISOString()), stage: r.deal.stage }))
      .filter(r => r.days != null && r.days >= 3)
      .sort((a, b) => b.days - a.days).slice(0, 8)
  };
}

export async function readDeals() {
  try { return JSON.parse(await get('ops', 'deals.json') || '{}') || {}; }
  catch { return {}; }
}

export async function writeDeal(id, patch) {
  const cur = await readDeals();
  const before = normalize(cur[id]);
  const next = normalize({ ...before, ...patch });

  /* 단계를 올리면 날짜를 자동으로 찍어준다 — 손이 덜 가야 실제로 쓴다 */
  const now = new Date().toISOString();
  if (next.stage === '견적' && !next.quoted_at) next.quoted_at = now;
  if (next.stage === '수주' && !next.won_at)    next.won_at = now;
  if (next.stage === '수주' && !next.quoted_at) next.quoted_at = now;
  if (next.stage === '실패' && !next.lost_at)   next.lost_at = now;
  next.updated_at = now;

  cur[id] = next;
  await set('ops', 'deals.json', JSON.stringify(cur));
  return next;
}
