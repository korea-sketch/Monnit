/** 소재 성과 집계 — 「얼마에 / 몇 개 소재로 / 언제부터 / 실제로 얼마나」.
 *
 *  조인 키는 utm_content 다.
 *   · 리드 쪽: 원장의 「출처」 문자열에서 파싱 (과거분까지 소급된다)
 *   · 광고 쪽: 광고 링크 URL에서 파싱 (adcreatives 스토어)
 *
 *  지출이 소재 단위로 아직 안 들어오는 채널은 spend 를 null 로 둔다.
 *  숫자를 지어내지 않는다 — 없으면 화면에 「연동 대기」로 나온다. */

import { creativeKey, parseSource } from './_utm.mjs';
import { ltvOf } from './_deals.mjs';

const r0 = v => Math.round(v || 0);

/**
 * @param leads  attach() 를 거친 리드 (deal 포함)
 * @param adAds  소재 단위 광고 실적 [{date,channel,campaign,adset,ad_id,ad_name,utm_content,spend,impressions,clicks}]
 * @param from,to  기간 (YYYY-MM-DD, from 초과 ~ to 이하)
 */
export function rollup(leads, adAds, from, to) {
  const rows = {};
  const touch = key => rows[key] || (rows[key] = {
    key, channel: '', campaign: '', ad_names: [], first_lead: '', first_ad: '',
    spend: null, impressions: null, clicks: null,
    active: {}, leadDays: [],
    leads: 0, contacts: 0, docs: 0,
    quoted: 0, won: 0, lost: 0, revenue: 0, revenue_assumed: false
  });

  /* ── 리드 쪽 ─────────────────────────────────────────── */
  for (const r of leads) {
    const day = String(r.ts || '').slice(0, 10);
    if (from && !(day > from)) continue;
    if (to && !(day <= to)) continue;

    const k = creativeKey({ source: r.source });
    const a = touch(k);
    const u = parseSource(r.source);
    if (!a.channel) a.channel = r.channel || '';
    if (!a.campaign && u.utm_campaign) a.campaign = u.utm_campaign;
    if (!a.first_lead || r.ts < a.first_lead) a.first_lead = r.ts;

    a.leads++;
    if (day) a.leadDays.push(day);
    if (r.type === 'contact') a.contacts++;
    else if (r.type === 'doc_request') a.docs++;

    const d = r.deal || {};
    if (d.quoted_at) a.quoted++;
    if (d.won_at) {
      a.won++;
      const l = ltvOf(d);
      a.revenue += l.value;
      if (l.assumed) a.revenue_assumed = true;
    }
    if (d.stage === '실패') a.lost++;
  }

  /* ── 광고 쪽 ─────────────────────────────────────────── */
  for (const r of (adAds || [])) {
    if (from && !(r.date > from)) continue;
    if (to && !(r.date <= to)) continue;
    const k = r.utm_content || r.ad_name || '(매칭 안 됨)';
    const a = touch(k);
    if (!a.channel) a.channel = r.channel || '';
    if (!a.campaign && r.campaign) a.campaign = r.campaign;
    if (r.ad_name && !a.ad_names.includes(r.ad_name)) a.ad_names.push(r.ad_name);
    if (r.created_at && (!a.first_ad || r.created_at < a.first_ad)) a.first_ad = r.created_at;
    a.spend = (a.spend || 0) + (r.spend || 0);
    a.impressions = (a.impressions || 0) + (r.impressions || 0);
    a.clicks = (a.clicks || 0) + (r.clicks || 0);
    /* 지출이 있었던 날만 «켜져 있던 날»로 본다 — 껐다 켠 구간이 그대로 보인다 */
    if ((r.spend || 0) > 0) a.active[r.date] = true;
  }

  const now = Date.now();
  return Object.values(rows).map(a => {
    const started = a.first_ad || a.first_lead || '';
    const ageDays = started ? Math.floor((now - new Date(started).getTime()) / 864e5) : null;
    /* 연속된 날짜를 구간으로 묶는다 → 타임라인 막대 */
    const ds = Object.keys(a.active).sort();
    const segs = [];
    for (const d of ds) {
      const last = segs[segs.length - 1];
      if (last && (new Date(d) - new Date(last.to)) <= 864e5 * 1.5) last.to = d;
      else segs.push({ from: d, to: d });
    }
    return {
      ...a,
      active: undefined,
      segments: segs,
      lead_days: [...new Set(a.leadDays)].sort(),
      leadDays: undefined,
      started,
      age_days: ageDays,
      /* 지출이 없으면 계산하지 않는다. 0 으로 채우면 거짓말이 된다. */
      cpc: a.spend != null && a.clicks ? r0(a.spend / a.clicks) : null,
      cpl: a.spend != null && a.leads ? r0(a.spend / a.leads) : null,
      cac: a.spend != null && a.won ? r0(a.spend / a.won) : null,
      roas: a.spend ? Math.round(a.revenue / a.spend * 100) / 100 : null,
      /* 표본이 적거나 집행 초기면 판단하지 말라는 표시 */
      learning: (ageDays != null && ageDays < 7) || (a.clicks != null && a.clicks < 30)
    };
  }).sort((x, y) => (y.spend || 0) - (x.spend || 0) || y.leads - x.leads);
}

/** 상품군별 수익성 — 알리미(구독)와 컨설팅(일시)은 경제성이 다르다 */
export function economics(leads, adTotalSpend) {
  const won = leads.filter(r => r.deal && r.deal.won_at);
  const mrr = won.reduce((s, r) => s + (r.deal.mrr || 0), 0);
  const oneoff = won.reduce((s, r) => s + (r.deal.oneoff || 0), 0);
  const revenue = won.reduce((s, r) => s + (r.ltv || 0), 0);
  const assumed = won.some(r => r.ltv_assumed);
  const contacts = leads.filter(r => r.type !== 'subscribe').length;
  return {
    spend: adTotalSpend,
    contacts,
    won: won.length,
    mrr, oneoff, revenue, revenue_assumed: assumed,
    cac: won.length && adTotalSpend != null ? r0(adTotalSpend / won.length) : null,
    cpl: contacts && adTotalSpend != null ? r0(adTotalSpend / contacts) : null,
    avg_ltv: won.length ? r0(revenue / won.length) : null,
    ltv_cac: won.length && adTotalSpend ? Math.round(revenue / adTotalSpend * 100) / 100 : null,
    payback_months: won.length && mrr && adTotalSpend
      ? Math.round(adTotalSpend / mrr * 10) / 10 : null
  };
}
