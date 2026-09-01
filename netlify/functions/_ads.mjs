/** 광고 채널 수집기 — 환경변수가 있는 채널만 동작한다.
 *  키가 없으면 조용히 건너뛰므로, 나중에 키만 넣으면 코드 수정 없이 켜진다.
 *  외부 라이브러리를 쓰지 않는다(빌드 부담 최소화). */
import crypto from 'node:crypto';

const KST = 'Asia/Seoul';
export const kday = d => new Intl.DateTimeFormat('en-CA',
  { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const T = ms => AbortSignal.timeout(ms || 12000);

/* ── 메타 (페이스북·인스타그램) ──────────────────────────
   필요: META_TOKEN, META_AD_ACCOUNT (예: act_1139646790935646) */
export async function meta(date) {
  const tok = process.env.META_TOKEN, acct = process.env.META_AD_ACCOUNT;
  if (!tok || !acct) return null;
  const u = new URL(`https://graph.facebook.com/v21.0/${acct}/insights`);
  u.searchParams.set('fields', 'spend,impressions,clicks,actions');
  u.searchParams.set('time_range', JSON.stringify({ since: date, until: date }));
  u.searchParams.set('level', 'account');
  u.searchParams.set('access_token', tok);
  const r = await fetch(u, { signal: T() });
  if (!r.ok) throw new Error('meta ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const d = (await r.json()).data?.[0];
  if (!d) return { channel: '메타', date, spend: 0, impressions: 0, clicks: 0, results: 0 };
  const lead = (d.actions || []).find(a => /lead/i.test(a.action_type));
  return { channel: '메타', date, spend: num(d.spend), impressions: num(d.impressions),
           clicks: num(d.clicks), results: num(lead?.value) };
}

/* ── 네이버 검색광고 ────────────────────────────────────
   필요: NAVER_API_KEY, NAVER_SECRET, NAVER_CUSTOMER_ID
   (키는 Netlify 환경변수에만 둔다. 코드·저장소에 절대 적지 않는다.)

   주의: /stats 는 조회할 대상 id 가 있어야 한다. 캠페인 목록을 먼저 받고
   그 id 들로 날짜별 실적을 조회한다. datePreset 을 쓰면 날짜 인자가
   무시되므로 timeRange 로 지정한다. */

const NAVER_HOST = 'https://api.searchad.naver.com';

function naverCfg() {
  const key = process.env.NAVER_API_KEY, sec = process.env.NAVER_SECRET, cid = process.env.NAVER_CUSTOMER_ID;
  return (key && sec && cid) ? { key, sec, cid } : null;
}

async function naverGet(path, params) {
  const c = naverCfg(); if (!c) return null;
  const ts = Date.now();
  const sig = crypto.createHmac('sha256', c.sec).update(`${ts}.GET.${path}`).digest('base64');
  const u = new URL(NAVER_HOST + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach(x => u.searchParams.append(k, x));
    else if (v != null) u.searchParams.set(k, String(v));
  }
  const r = await fetch(u, { headers: {
    'X-Timestamp': String(ts), 'X-API-KEY': c.key, 'X-Customer': String(c.cid), 'X-Signature': sig
  }, signal: T(15000) });
  if (!r.ok) throw new Error('naver ' + path + ' ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return r.json();
}

/** 캠페인 목록 — 이름·상태·등록시각. 타임라인의 막대가 여기서 나온다. */
export async function naverCampaigns() {
  const rows = await naverGet('/ncc/campaigns', {});
  if (!rows) return null;
  return (Array.isArray(rows) ? rows : []).map(c => ({
    id: c.nccCampaignId,
    name: c.name || '',
    type: c.campaignTp || '',
    /* userLock=true 는 사용자가 끈 것, status 는 시스템 판정 */
    running: c.status === 'ELIGIBLE' && !c.userLock,
    created_at: String(c.regTm || '').slice(0, 10)
  }));
}

/** 캠페인 단위 하루 실적. ids 는 한 번에 100개까지. */
export async function naverAds(date, campaigns) {
  const c = naverCfg(); if (!c) return null;
  const list = campaigns || await naverCampaigns();
  if (!list || !list.length) return [];
  const fields = JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'ccnt']);
  const range = JSON.stringify({ since: date, until: date });

  const out = [];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const res = await naverGet('/stats', {
      ids: chunk.map(x => x.id), fields, timeRange: range
    });
    const byId = {};
    for (const d of (res?.data || [])) byId[d.id] = d;
    for (const cmp of chunk) {
      const d = byId[cmp.id] || {};
      out.push({
        channel: '네이버', date,
        ad_id: cmp.id, ad_name: cmp.name, campaign: cmp.name, adset: '',
        created_at: cmp.created_at,
        /* salesAmt 는 부가세 제외 광고비다 */
        spend: num(d.salesAmt), impressions: num(d.impCnt),
        clicks: num(d.clkCnt), results: num(d.ccnt),
        utm_content: ''
      });
    }
  }
  return out;
}

/** 채널 합계 — 기존 ads 스토어 형식 그대로 */
export async function naver(date, campaigns) {
  const rows = await naverAds(date, campaigns);
  if (!rows) return null;
  const t = rows.reduce((a, r) => {
    a.spend += r.spend; a.impressions += r.impressions;
    a.clicks += r.clicks; a.results += r.results; return a;
  }, { spend: 0, impressions: 0, clicks: 0, results: 0 });
  return { channel: '네이버', date, ...t };
}

/* ── GA4 (서비스 계정 · 라이브러리 없이 JWT 직접 서명) ──────
   필요: GA4_SA_EMAIL, GA4_SA_KEY(PEM), GA4_PROPERTY_ID */
async function googleToken(email, pem, scope) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).end()
    .sign(pem.replace(/\\n/g, '\n')).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                                assertion: `${head}.${body}.${sig}` }), signal: T()
  });
  if (!r.ok) throw new Error('google token ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return (await r.json()).access_token;
}

export async function ga4(date) {
  const email = process.env.GA4_SA_EMAIL, pem = process.env.GA4_SA_KEY, pid = process.env.GA4_PROPERTY_ID;
  if (!email || !pem || !pid) return null;
  const tok = await googleToken(email, pem, 'https://www.googleapis.com/auth/analytics.readonly');
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: date, endDate: date }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'keyEvents' }]
    }), signal: T()
  });
  if (!r.ok) throw new Error('ga4 ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const rows = (await r.json()).rows || [];
  return { date, channels: rows.map(x => ({
    name: x.dimensionValues[0].value, sessions: num(x.metricValues[0].value), key: num(x.metricValues[1].value)
  })) };
}

/* ── Clarity (사용자 행동) ──────────────────────────────
   필요: CLARITY_TOKEN */
/* Clarity — 전체 지표 + 페이지(URL)별 지표.
   API 한도가 하루 10회라 호출은 adsync 쪽에서 제한한다. */
const CL_METRICS = ['Traffic', 'EngagementTime', 'ScrollDepth', 'RageClickCount',
                    'DeadClickCount', 'QuickbackClick', 'ScriptErrorCount', 'ErrorClickCount'];

async function clarityFetch(days, dim) {
  const tok = process.env.CLARITY_TOKEN;
  if (!tok) return null;
  const u = 'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=' + days
          + (dim ? '&dimension1=' + encodeURIComponent(dim) : '');
  const r = await fetch(u, { headers: { authorization: 'Bearer ' + tok }, signal: T(20000) });
  if (!r.ok) throw new Error('clarity ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.json();
}

/* metricName → information[] 을 평평하게 편다 */
function clarityFlat(arr) {
  const out = {};
  for (const m of (arr || [])) out[m.metricName] = m.information || [];
  return out;
}
const clPct = o => num(o?.sessionsWithMetricPercentage);

export async function clarity(days = 1) {
  const raw = await clarityFetch(days, null);
  if (!raw) return null;
  const f = clarityFlat(raw);
  const t = f.Traffic?.[0] || {};
  return {
    days,
    sessions: num(t.totalSessionCount),
    users:    num(t.distinctUserCount),
    bots:     num(t.totalBotSessionCount),
    pages:    num(t.pagesPerSessionPercentage),
    engage:   num(f.EngagementTime?.[0]?.activeTime),
    scroll:   num(f.ScrollDepth?.[0]?.averageScrollDepth),
    rage:     clPct(f.RageClickCount?.[0]),
    dead:     clPct(f.DeadClickCount?.[0]),
    quick:    clPct(f.QuickbackClick?.[0]),
    err:      clPct(f.ScriptErrorCount?.[0]),
    errClick: clPct(f.ErrorClickCount?.[0])
  };
}

/* 페이지별 — 어느 화면이 문제인지 짚기 위해 */
export async function clarityPages(days = 3) {
  const raw = await clarityFetch(days, 'URL');
  if (!raw) return null;
  const f = clarityFlat(raw);
  const byUrl = {};
  const touch = u => byUrl[u] || (byUrl[u] = { url: u, sessions: 0, rage: 0, dead: 0, quick: 0, err: 0, scroll: 0 });
  for (const row of (f.Traffic || [])) if (row.URL) touch(row.URL).sessions = num(row.totalSessionCount);
  const put = (metric, key) => {
    for (const row of (f[metric] || [])) if (row.URL) touch(row.URL)[key] = clPct(row);
  };
  put('RageClickCount', 'rage'); put('DeadClickCount', 'dead');
  put('QuickbackClick', 'quick'); put('ScriptErrorCount', 'err');
  for (const row of (f.ScrollDepth || [])) if (row.URL) touch(row.URL).scroll = num(row.averageScrollDepth);
  return Object.values(byUrl).filter(x => x.sessions > 0).sort((a, b) => b.sessions - a.sessions).slice(0, 25);
}


/* 어떤 채널이 준비됐는지 */
/* 구글 시트 전체 이력 — 한 번의 요청으로 모든 날짜를 가져온다 (백필용) */
export async function googleAll() {
  const url = process.env.GOOGLE_ADS_SHEET;
  if (!url) return null;
  const r = await fetch(url, { signal: T(15000) });
  if (!r.ok) throw new Error('google sheet ' + r.status);
  const lines = (await r.text()).split('\n').map(l => l.split(','));
  if (!lines.length) return [];
  const head = lines[0].map(h => h.trim().toLowerCase().replace(/^\uFEFF/, ''));
  const iD = head.findIndex(h => /day|date|\ub0a0\uc9dc/.test(h));
  const iC = head.findIndex(h => /cost|\ube44\uc6a9/.test(h));
  const iI = head.findIndex(h => /impr|\ub178\ucd9c/.test(h));
  const iK = head.findIndex(h => /click|\ud074\ub9ad/.test(h));
  const iV = head.findIndex(h => /conv|\uc804\ud658/.test(h));
  if (iD < 0) return [];
  const cl = v => num(String(v || '').replace(/[^\d.-]/g, ''));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const d = String(row[iD] || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) continue;
    out.push({ channel: '\uad6c\uae00', date: d.slice(0, 10), spend: cl(row[iC]),
               impressions: cl(row[iI]), clicks: cl(row[iK]), results: iV >= 0 ? cl(row[iV]) : 0 });
  }
  return out;
}

export function configured() {
  return {
    meta:    !!(process.env.META_TOKEN && process.env.META_AD_ACCOUNT),
    naver:   !!(process.env.NAVER_API_KEY && process.env.NAVER_SECRET && process.env.NAVER_CUSTOMER_ID),
    ga4:     !!(process.env.GA4_SA_EMAIL && process.env.GA4_SA_KEY && process.env.GA4_PROPERTY_ID),
    clarity: !!process.env.CLARITY_TOKEN,
    google:  !!process.env.GOOGLE_ADS_SHEET   /* 구글은 시트 경유 (개발자토큰 승인 불필요) */
  };
}

/* ── 구글 애즈 — 예약 보고서를 구글 시트로 받아 읽는다 ─────
   필요: GOOGLE_ADS_SHEET (공개 링크로 게시된 CSV 주소) */
export async function google(date) {
  const url = process.env.GOOGLE_ADS_SHEET;
  if (!url) return null;
  const r = await fetch(url, { signal: T() });
  if (!r.ok) throw new Error('google sheet ' + r.status);
  const lines = (await r.text()).split('\n').map(l => l.split(','));
  const head = lines[0].map(h => h.trim().toLowerCase());
  const iD = head.findIndex(h => /day|date|날짜/.test(h));
  const iC = head.findIndex(h => /cost|비용/.test(h));
  const iI = head.findIndex(h => /impr|노출/.test(h));
  const iK = head.findIndex(h => /click|클릭/.test(h));
  const row = lines.find(l => (l[iD] || '').trim().startsWith(date));
  if (!row) return { channel: '구글', date, spend: 0, impressions: 0, clicks: 0, results: 0 };
  const cl = v => num(String(v || '').replace(/[^\d.-]/g, ''));
  return { channel: '구글', date, spend: cl(row[iC]), impressions: cl(row[iI]),
           clicks: cl(row[iK]), results: 0 };
}

/* ── 메타 · 소재(광고) 단위 ─────────────────────────────
   계정 합계로는 "어느 소재가 먹혔는지"를 알 수 없다.
   level=ad 로 하루치를 받아오고, 광고 링크의 utm_content 로 리드와 잇는다. */

export async function metaAds(date) {
  const tok = process.env.META_TOKEN, acct = process.env.META_AD_ACCOUNT;
  if (!tok || !acct) return null;
  const u = new URL(`https://graph.facebook.com/v21.0/${acct}/insights`);
  u.searchParams.set('level', 'ad');
  u.searchParams.set('fields', 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions');
  u.searchParams.set('time_range', JSON.stringify({ since: date, until: date }));
  u.searchParams.set('limit', '300');
  u.searchParams.set('access_token', tok);
  const r = await fetch(u, { signal: T(20000) });
  if (!r.ok) throw new Error('meta ads ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const data = (await r.json()).data || [];
  return data.map(d => {
    const lead = (d.actions || []).find(a => /lead/i.test(a.action_type));
    return {
      channel: '메타', date,
      ad_id: String(d.ad_id || ''), ad_name: d.ad_name || '',
      adset: d.adset_name || '', campaign: d.campaign_name || '',
      spend: num(d.spend), impressions: num(d.impressions),
      clicks: num(d.clicks), results: num(lead?.value)
    };
  });
}

/** 광고 ID → { utm_content, created_at, status } 지도.
 *  하루 한 번만 부르면 충분하다(변경이 잦지 않다). */
export async function metaAdMap() {
  const tok = process.env.META_TOKEN, acct = process.env.META_AD_ACCOUNT;
  if (!tok || !acct) return null;
  const fields = 'id,name,created_time,effective_status,'
    + 'creative{object_story_spec{link_data{link,child_attachments{link}},video_data{call_to_action{value{link}}}},'
    + 'asset_feed_spec{link_urls{website_url}},url_tags,object_url}';
  let url = new URL(`https://graph.facebook.com/v21.0/${acct}/ads`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', tok);

  const out = {};
  for (let page = 0; page < 8 && url; page++) {
    const r = await fetch(url, { signal: T(20000) });
    if (!r.ok) throw new Error('meta admap ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const jn = await r.json();
    for (const a of (jn.data || [])) {
      out[String(a.id)] = {
        name: a.name || '',
        created_at: (a.created_time || '').slice(0, 10),
        status: a.effective_status || '',
        utm_content: pickUtmContent(a)
      };
    }
    url = jn.paging?.next ? new URL(jn.paging.next) : null;
  }
  return out;
}

/** 광고 소재 안의 여러 위치에서 링크를 뒤져 utm_content 를 찾는다 */
function pickUtmContent(ad) {
  const urls = [];
  const c = ad.creative || {};
  const s = c.object_story_spec || {};
  if (s.link_data?.link) urls.push(s.link_data.link);
  for (const ch of (s.link_data?.child_attachments || [])) if (ch.link) urls.push(ch.link);
  if (s.video_data?.call_to_action?.value?.link) urls.push(s.video_data.call_to_action.value.link);
  for (const l of (c.asset_feed_spec?.link_urls || [])) if (l.website_url) urls.push(l.website_url);
  if (c.object_url) urls.push(c.object_url);

  for (const u of urls) {
    try {
      const v = new URL(u).searchParams.get('utm_content');
      if (v) return v;
    } catch { /* 무시 */ }
  }
  /* 링크에 없으면 url_tags(추적 템플릿)에서 찾는다 */
  const tags = String(c.url_tags || '');
  const m = tags.match(/utm_content=([^&\s]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }

  for (const u of urls) {
    try {
      const v = new URL(u).searchParams.get('utm_campaign');
      if (v) return v;
    } catch { /* 무시 */ }
  }
  return '';
}
