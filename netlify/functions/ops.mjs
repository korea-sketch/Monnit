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

/* ── UX 자동 진단 ───────────────────────────────────────────────
   Clarity 지표를 읽고 "무엇이 문제이고 무엇을 고쳐야 하는지"로 옮긴다.
   임계치는 업계에서 통용되는 범위를 쓰되, 판정은 항상 근거 수치와 함께 낸다. */
const UX_RULES = [
  { k: 'rage',  bad: 5,  warn: 3,  name: '분노 클릭',
    why: '같은 자리를 연속으로 여러 번 누른 세션입니다. 눌리는 줄 알았는데 반응이 없었다는 뜻입니다.',
    fix: '해당 화면에서 버튼처럼 보이는데 클릭이 안 되는 요소를 찾으세요. 이미지·아이콘·굵은 글씨가 흔한 범인입니다. 진짜 링크로 만들거나, 눌리지 않는다는 게 보이도록 스타일을 바꾸세요.' },
  { k: 'dead',  bad: 10, warn: 5,  name: '먹통 클릭',
    why: '눌렀는데 아무 일도 일어나지 않은 세션입니다.',
    fix: '링크처럼 생긴 텍스트, 확대될 것 같은 사진, 접힐 것 같은 제목을 확인하세요. 기대한 동작을 붙이거나 기대를 만들지 않도록 디자인을 조정합니다.' },
  { k: 'quick', bad: 20, warn: 12, name: '즉시 뒤로가기',
    why: '들어오자마자 되돌아간 세션입니다. 광고·검색에서 기대한 내용과 첫 화면이 달랐다는 신호입니다.',
    fix: '광고 문구와 랜딩 첫 화면의 문장을 나란히 놓고 비교하세요. 광고에서 약속한 것(무료 설치·모터 예지보전)이 스크롤 없이 바로 보여야 합니다.' },
  { k: 'err',   bad: 5,  warn: 2,  name: '스크립트 오류',
    why: '페이지에서 자바스크립트 오류가 난 세션입니다. 폼 전송이 막힐 수 있어 가장 위험합니다.',
    fix: '해당 페이지를 열고 브라우저 개발자도구 콘솔의 빨간 오류를 확인하세요. 신청 폼이 있는 페이지라면 최우선으로 처리해야 합니다.' }
];

function uxDiagnose(cur, pages) {
  const out = [];
  const push = (level, scope, r, v, extra) => out.push({
    level, scope, metric: r.name, value: v,
    title: scope + ' — ' + r.name + ' ' + v + '%',
    why: r.why, fix: r.fix, ...(extra || {})
  });

  if (cur) {
    for (const r of UX_RULES) {
      const v = Number(cur[r.k] || 0);
      if (v >= r.bad) push('bad', '사이트 전체', r, v);
      else if (v >= r.warn) push('warn', '사이트 전체', r, v);
    }
    if (cur.sessions >= 30 && cur.scroll && cur.scroll < 35)
      out.push({ level: 'warn', scope: '사이트 전체', metric: '스크롤 깊이', value: cur.scroll,
        title: '사이트 전체 — 평균 스크롤 ' + cur.scroll + '%',
        why: '방문자 대부분이 페이지 위쪽만 보고 떠납니다. 아래쪽 내용은 사실상 없는 것과 같습니다.',
        fix: '신청 버튼과 핵심 근거(무료·조건 없음)를 첫 화면 안으로 끌어올리세요. 긴 설명은 뒤로 미룹니다.' });
    if (cur.sessions >= 30 && cur.engage && cur.engage < 15)
      out.push({ level: 'warn', scope: '사이트 전체', metric: '체류 시간', value: cur.engage,
        title: '사이트 전체 — 평균 체류 ' + cur.engage + '초',
        why: '읽지 않고 떠납니다. 첫 문장이 자기 문제로 안 읽혔다는 뜻입니다.',
        fix: '첫 제목을 업종·설비를 지목하는 문장으로 바꿔 시험해보세요. 실측상 구체적 설비를 짚은 광고가 성과가 좋았습니다.' });
  }

  for (const p of (pages || [])) {
    if (p.sessions < 20) continue;              /* 표본이 적으면 판단하지 않는다 */
    for (const r of UX_RULES) {
      const v = Number(p[r.k] || 0);
      if (v >= r.bad) push('bad', short(p.url), r, v, { sessions: p.sessions, url: p.url });
      else if (v >= r.warn) push('warn', short(p.url), r, v, { sessions: p.sessions, url: p.url });
    }
  }
  const rank = { bad: 0, warn: 1 };
  return out.sort((a, b) => (rank[a.level] - rank[b.level]) || ((b.sessions || 9999) - (a.sessions || 9999)))
            .slice(0, 12);
}
const short = u => String(u || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 42) || '/';

const PERIODS = {
  '7d':  { label: '최근 7일',  days: 7  },
  '30d': { label: '최근 30일', days: 30 },
  '90d': { label: '최근 90일', days: 90 }
};

/* 월(YYYY-MM) → 분기 라벨 */
const quarterOf = ym => {
  const [y, m] = ym.split('-').map(Number);
  return y + ' Q' + Math.ceil(m / 3);
};

async function build(pkey) {
  const P = PERIODS[pkey] || PERIODS['7d'];
  const now = new Date();

  /* 리드 — 최근 13개월치 파일을 읽는다 (월별·분기별 비교용) */
  let rows = [];
  const monthKeys = [];
  for (let i = 0; i <= 12; i++) monthKeys.push(monthKey(new Date(now - i * 30.5 * 864e5)));
  for (const k of [...new Set(monthKeys)]) rows = rows.concat(await readLines('leads', k));
  rows = rows.filter(r => r?.ts && !/^__/.test(r.company || ''));   /* 점검용 더미 제외 */

  const today = kday(now), ago = n => kday(new Date(now - n * 864e5));
  const dCur = ago(P.days), dPrv = ago(P.days * 2);
  const dayOf = r => kday(new Date(r.ts));
  const btw = (r, a, b) => { const d = dayOf(r); return d > a && d <= b; };

  const cur = rows.filter(r => btw(r, dCur, today));
  const prv = rows.filter(r => btw(r, dPrv, dCur));
  const tdy = rows.filter(r => dayOf(r) === today);

  const cnt = (a, t) => a.filter(r => r.type === t).length;
  const grp = (a, f) => a.reduce((m, r) => { const k = f(r) || '미상'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const srt = m => Object.entries(m).sort((a, b) => b[1] - a[1]);

  /* 일자별 막대 — 기간이 길면 촘촘해지므로 최대 30칸 */
  const barDays = Math.min(P.days, 30);
  const daily = [];
  for (let i = barDays - 1; i >= 0; i--) {
    const d = ago(i), day = rows.filter(r => dayOf(r) === d);
    daily.push({ d: d.slice(5), c: cnt(day, 'contact'), r: cnt(day, 'doc_request'), s: cnt(day, 'subscribe') });
  }

  let health = null;
  try { health = JSON.parse(await get('health', 'latest.json') || 'null'); } catch {}

  /* ── 광고 — 같은 13개월 범위를 읽어 기간·월·분기별로 집계 ── */
  let adRows = [];
  for (const k of [...new Set(monthKeys)]) adRows = adRows.concat(await readLines('ads', k));
  adRows = adRows.filter(r => r?.date);

  const sumBy = list => {
    const m = {};
    for (const r of list) {
      const a = m[r.channel] || (m[r.channel] = { channel: r.channel, spend: 0, impressions: 0, clicks: 0, results: 0 });
      a.spend += r.spend || 0; a.impressions += r.impressions || 0;
      a.clicks += r.clicks || 0; a.results += r.results || 0;
    }
    return Object.values(m).sort((a, b) => b.spend - a.spend);
  };
  const adCur = sumBy(adRows.filter(r => r.date > dCur && r.date <= today));
  const adPrv = sumBy(adRows.filter(r => r.date > dPrv && r.date <= dCur));

  /* ── 월별 시계열 (최근 12개월, 데이터 있는 달만) ── */
  const mAgg = {};
  const touch = ym => mAgg[ym] || (mAgg[ym] = { m: ym, contact: 0, doc: 0, sub: 0, spend: 0, clicks: 0 });
  for (const r of rows) {
    const ym = dayOf(r).slice(0, 7); const a = touch(ym);
    if (r.type === 'contact') a.contact++; else if (r.type === 'doc_request') a.doc++; else a.sub++;
  }
  for (const r of adRows) {
    const a = touch(r.date.slice(0, 7));
    a.spend += r.spend || 0; a.clicks += r.clicks || 0;
  }
  const monthly = Object.values(mAgg).sort((a, b) => a.m.localeCompare(b.m)).slice(-12)
    .map(a => ({ ...a, total: a.contact + a.doc + a.sub,
                 cpl: a.contact ? Math.round(a.spend / a.contact) : 0 }));

  /* ── 분기별 (최근 6분기) ── */
  const qAgg = {};
  for (const a of Object.values(mAgg)) {
    const q = quarterOf(a.m);
    const t = qAgg[q] || (qAgg[q] = { q, contact: 0, doc: 0, sub: 0, spend: 0, clicks: 0 });
    t.contact += a.contact; t.doc += a.doc; t.sub += a.sub; t.spend += a.spend; t.clicks += a.clicks;
  }
  const quarterly = Object.values(qAgg).sort((a, b) => a.q.localeCompare(b.q)).slice(-6)
    .map(a => ({ ...a, total: a.contact + a.doc + a.sub,
                 cpl: a.contact ? Math.round(a.spend / a.contact) : 0 }));

  let syncLog = null; try { syncLog = JSON.parse(await get('ads', 'sync_log.json') || 'null'); } catch {}
  let clarity = null; try { clarity = JSON.parse(await get('ads', 'clarity.json') || 'null'); } catch {}
  let clPages = null; try { clPages = (JSON.parse(await get('ads', 'clarity_pages.json') || 'null') || {}).rows || null; } catch {}
  const ux = uxDiagnose(clarity, clPages);

  /* 응대 완료 표시 */
  let done = {}; try { done = JSON.parse(await get('ops', 'handled.json') || '{}'); } catch {}
  const idOf = r => (r.ts || '') + '|' + (r.email || r.phone || r.company || '');

  return {
    generated: new Date().toISOString(),
    storage: await available(),
    health,
    period: { key: pkey in PERIODS ? pkey : '7d', label: P.label, days: P.days,
              from: dCur, to: today, prevFrom: dPrv, prevTo: dCur },
    periods: Object.entries(PERIODS).map(([k, v]) => ({ k, label: v.label })),
    ads: { cur: adCur, prev: adPrv, configured: adsConfigured(), sync: syncLog },
    clarity, clarityPages: clPages, ux,
    series: { monthly, quarterly },
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
    const d = await build('90d');
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
  if (sub === 'data') { try { return j(await build(new URL(req.url).searchParams.get('p') || '7d')); } catch (e) { return j({ error: String(e?.message || e) }, 500); } }
  return page(APP);
};
