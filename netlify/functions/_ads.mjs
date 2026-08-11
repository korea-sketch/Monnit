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
   필요: NAVER_API_KEY, NAVER_SECRET, NAVER_CUSTOMER_ID */
export async function naver(date) {
  const key = process.env.NAVER_API_KEY, sec = process.env.NAVER_SECRET, cid = process.env.NAVER_CUSTOMER_ID;
  if (!key || !sec || !cid) return null;
  const ts = Date.now(), path = '/stats';
  const sig = crypto.createHmac('sha256', sec).update(`${ts}.GET.${path}`).digest('base64');
  const u = new URL('https://api.searchad.naver.com' + path);
  u.searchParams.set('statType', 'ACCOUNT');
  u.searchParams.set('datePreset', 'today');
  u.searchParams.set('fields', JSON.stringify(['impCnt', 'clkCnt', 'salesAmt']));
  const r = await fetch(u, { headers: {
    'X-Timestamp': String(ts), 'X-API-KEY': key, 'X-Customer': String(cid), 'X-Signature': sig
  }, signal: T() });
  if (!r.ok) throw new Error('naver ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const d = (await r.json())?.data?.[0] || {};
  return { channel: '네이버', date, spend: num(d.salesAmt), impressions: num(d.impCnt),
           clicks: num(d.clkCnt), results: 0 };
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
