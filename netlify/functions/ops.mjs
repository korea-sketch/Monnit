/** 관제 화면 — 인증 · 데이터 · 화면.
 *  로그인 전에는 관제 화면 코드조차 내려가지 않는다. */
import * as auth from './_ops_auth.mjs';
import { LOGIN, APP } from './_ops_ui.mjs';
import { get, set, readLines, available, diag } from './_store.mjs';
import { configured as adsConfigured, kday as adsKday } from './_ads.mjs';

export const config = { path: ['/ops', '/ops/login', '/ops/logout', '/ops/data', '/ops/diag', '/ops/mark', '/ops/export'] };

const TZ = 'Asia/Seoul';
const MAX_FAIL = 8, LOCK_MS = 15 * 60 * 1000;

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY'
};
const page = (body, extra) => new Response(body,
  { status: 200, headers: { ...H, 'content-type': 'text/html; charset=utf-8', ...(extra || {}) } });
const j = (o, status = 200, extra) => new Response(JSON.stringify(o),
  { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8', ...(extra || {}) } });

const kday = d => new Intl.DateTimeFormat('en-CA',
  { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const monthKey = d => kday(d).slice(0, 7) + '.jsonl';

function ipOf(req) {
  return String(req.headers.get('x-nf-client-connection-ip')
    || req.headers.get('x-forwarded-for') || '?').split(',')[0].trim().slice(0, 45)
    .replace(/[^\w.:-]/g, '_');
}
async function fails(k) {
  try { const o = JSON.parse(await get('ops', 'fail_' + k) || 'null');
        return (o && Date.now() - o.t < LOCK_MS) ? o : { n: 0, t: 0 }; }
  catch { return { n: 0, t: 0 }; }
}

async function build() {
  const now = new Date(), prevM = new Date(now - 32 * 864e5);
  let rows = [];
  for (const k of [...new Set([monthKey(prevM), monthKey(now)])]) rows = rows.concat(await readLines('leads', k));
  rows = rows.filter(r => r?.ts && !/^__/.test(r.company || ''));   /* 점검용 더미 제외 */

  const today = kday(now), ago = n => kday(new Date(now - n * 864e5));
  const d7 = ago(7), d14 = ago(14);
  const btw = (r, a, b) => { const d = kday(new Date(r.ts)); return d > a && d <= b; };
  const cur = rows.filter(r => btw(r, d7, today)), prv = rows.filter(r => btw(r, d14, d7));
  const tdy = rows.filter(r => kday(new Date(r.ts)) === today);
  const cnt = (a, t) => a.filter(r => r.type === t).length;
  const grp = (a, f) => a.reduce((m, r) => { const k = f(r) || '미상'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const srt = m => Object.entries(m).sort((a, b) => b[1] - a[1]);

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = ago(i), day = rows.filter(r => kday(new Date(r.ts)) === d);
    daily.push({ d: d.slice(5), c: cnt(day, 'contact'), r: cnt(day, 'doc_request'), s: cnt(day, 'subscribe') });
  }
  let health = null;
  try { health = JSON.parse(await get('health', 'latest.json') || 'null'); } catch {}

  /* 광고 지출 — 최근 7일 채널별 합계 */
  let adRows = [];
  for (const k of [...new Set([monthKey(prevM), monthKey(now)])]) adRows = adRows.concat(await readLines('ads', k));
  const ad7 = adRows.filter(r => r?.date && r.date > d7 && r.date <= today);
  const adBy = {};
  for (const r of ad7) {
    const a = adBy[r.channel] || (adBy[r.channel] = { channel: r.channel, spend: 0, impressions: 0, clicks: 0 });
    a.spend += r.spend || 0; a.impressions += r.impressions || 0; a.clicks += r.clicks || 0;
  }
  const ads_week = Object.values(adBy).sort((a, b) => b.spend - a.spend);
  let syncLog = null; try { syncLog = JSON.parse(await get('ads', 'sync_log.json') || 'null'); } catch {}

  /* 응대 완료 표시 */
  let done = {}; try { done = JSON.parse(await get('ops', 'handled.json') || '{}'); } catch {}
  const idOf = r => (r.ts || '') + '|' + (r.email || r.phone || r.company || '');

  return {
    generated: new Date().toISOString(),
    storage: await available(),
    health,
    ads: { week: ads_week, configured: adsConfigured(), sync: syncLog },
    summary: {
      today: { contact: cnt(tdy, 'contact'), doc: cnt(tdy, 'doc_request'), sub: cnt(tdy, 'subscribe'), total: tdy.length },
      week:  { contact: cnt(cur, 'contact'), doc: cnt(cur, 'doc_request'), sub: cnt(cur, 'subscribe'), total: cur.length },
      prev:  { contact: cnt(prv, 'contact'), doc: cnt(prv, 'doc_request'), sub: cnt(prv, 'subscribe'), total: prv.length },
      channel: srt(grp(cur, r => r.channel)),
      point: srt(grp(cur, r => r.point)),
      interest: srt(grp(cur.filter(r => r.type === 'doc_request'), r => r.interest)).slice(0, 8),
      daily
    },
    leads: rows.slice(-200).reverse().map(r => ({
      id: idOf(r), handled: !!done[idOf(r)],
      ts: r.ts, label: r.label, type: r.type, channel: r.channel, point: r.point,
      company: r.company, name: r.name, phone: r.phone, email: r.email,
      region: r.region, asset: r.asset, interest: r.interest
    })),
    pending: rows.filter(r => r.type === 'contact' && !done[idOf(r)]).length
  };
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const sub = path.endsWith('/login') ? 'login' : path.endsWith('/logout') ? 'logout'
            : path.endsWith('/data') ? 'data' : path.endsWith('/diag') ? 'diag'
            : path.endsWith('/mark') ? 'mark' : path.endsWith('/export') ? 'export' : '';
  const authed = auth.valid(auth.cookieFrom({ cookie: req.headers.get('cookie') || '' }));

  if (!auth.configured()) return page(LOGIN.replace('__ERR__', '환경변수 OPS_USER · OPS_PASS 를 먼저 설정해 주세요'));

  if (sub === 'logout')
    return new Response(null, { status: 302, headers: { ...H, location: '/ops', 'set-cookie': auth.clearCookie() } });

  if (sub === 'login') {
    if (req.method !== 'POST') return new Response(null, { status: 302, headers: { location: '/ops' } });
    const key = ipOf(req), f = await fails(key);
    if (f.n >= MAX_FAIL) return page(LOGIN.replace('__ERR__', '시도가 많습니다. 15분 뒤 다시 해주세요'));
    const q = new URLSearchParams(await req.text());
    if (auth.check(q.get('u'), q.get('p'))) {
      await set('ops', 'fail_' + key, JSON.stringify({ n: 0, t: 0 }));
      return new Response(null, { status: 302, headers: { ...H, location: '/ops', 'set-cookie': auth.setCookie(auth.issue()) } });
    }
    await set('ops', 'fail_' + key, JSON.stringify({ n: (f.n || 0) + 1, t: Date.now() }));
    return page(LOGIN.replace('__ERR__', '아이디 또는 비밀번호가 맞지 않습니다'));
  }

  if (!authed) {
    if (sub === 'data' || sub === 'diag' || sub === 'mark') return j({ error: 'unauthorized' }, 401);
    if (sub === 'export') return new Response(null, { status: 302, headers: { ...H, location: '/ops' } });
    return page(LOGIN.replace('__ERR__', ''));
  }

  if (sub === 'diag') return j(await diag());

  if (sub === 'mark') {
    if (req.method !== 'POST') return j({ error: 'method' }, 405);
    try {
      const { id, on } = await req.json();
      const cur = JSON.parse(await get('ops', 'handled.json') || '{}');
      if (on) cur[id] = new Date().toISOString(); else delete cur[id];
      await set('ops', 'handled.json', JSON.stringify(cur));
      return j({ ok: true });
    } catch (e) { return j({ error: String(e?.message || e) }, 500); }
  }

  if (sub === 'export') {
    const d = await build();
    const head = ['접수일시', '유형', '채널', '접점', '회사', '담당자', '전화', '이메일', '지역', '설비', '관심', '응대'];
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const body = d.leads.map(r => [
      new Date(r.ts).toLocaleString('ko-KR', { timeZone: TZ }), r.label, r.channel, r.point,
      r.company, r.name, r.phone, r.email, r.region, r.asset, r.interest, r.handled ? '완료' : ''
    ].map(esc).join(',')).join('\n');
    return new Response('\uFEFF' + head.map(esc).join(',') + '\n' + body, {
      headers: { ...H, 'content-type': 'text/csv; charset=utf-8',
                 'content-disposition': 'attachment; filename="monnit-leads.csv"' }
    });
  }
  if (sub === 'data') { try { return j(await build()); } catch (e) { return j({ error: String(e?.message || e) }, 500); } }
  return page(APP);
};
