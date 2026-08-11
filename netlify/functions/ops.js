/** 관제 화면 — 인증 · 데이터 · 화면을 한 함수가 담당한다.
 *
 *  · 정적 파일이 없다. 로그인 전에는 화면 코드조차 내려가지 않는다.
 *  · 비밀번호는 코드에 없다(환경변수 OPS_USER / OPS_PASS).
 *  · 로그인 실패가 반복되면 잠근다(무차별 대입 방지).
 *
 *  GET  /ops          로그인 화면 또는 관제 화면
 *  POST /ops/login    로그인
 *  POST /ops/logout   나가기
 *  GET  /ops/data     집계 데이터 (인증 필요)
 */
const auth  = require('./_ops_auth');
const ui    = require('./_ops_ui');
const store = require('./_store');

const TZ = 'Asia/Seoul';
const MAX_FAIL = 8;               /* 15분 내 8회 실패 시 잠금 */
const LOCK_MS  = 15 * 60 * 1000;

const html = (body, extra) => ({
  statusCode: 200,
  headers: Object.assign({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY'
  }, extra || {}),
  body
});

const json = (obj, code, extra) => ({
  statusCode: code || 200,
  headers: Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow'
  }, extra || {}),
  body: JSON.stringify(obj)
});

function ip(event) {
  const h = event.headers || {};
  return String(h['x-nf-client-connection-ip'] || h['client-ip'] || h['x-forwarded-for'] || '?')
    .split(',')[0].trim().slice(0, 45);
}

async function failCount(key) {
  const raw = await store.get('ops', 'fail_' + key.replace(/[^\w.:-]/g, '_'));
  if (!raw) return { n: 0, t: 0 };
  try { const o = JSON.parse(raw); return (Date.now() - o.t > LOCK_MS) ? { n: 0, t: 0 } : o; }
  catch (e) { return { n: 0, t: 0 }; }
}
async function bumpFail(key, cur) {
  await store.set('ops', 'fail_' + key.replace(/[^\w.:-]/g, '_'),
    JSON.stringify({ n: (cur.n || 0) + 1, t: Date.now() }));
}
async function clearFail(key) {
  await store.set('ops', 'fail_' + key.replace(/[^\w.:-]/g, '_'), JSON.stringify({ n: 0, t: 0 }));
}

/* ── 집계 ─────────────────────────────────────────────── */
const kday = d => new Intl.DateTimeFormat('en-CA',
  { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const monthKey = d => kday(d).slice(0, 7) + '.jsonl';

async function build() {
  const now = new Date();
  const prevM = new Date(now.getTime() - 32 * 864e5);

  let rows = [];
  for (const k of [...new Set([monthKey(prevM), monthKey(now)])]) {
    rows = rows.concat(await store.readLines('leads', k));
  }
  rows = rows.filter(r => r && r.ts && r.company !== '__배포검증__');

  const today = kday(now);
  const ago = n => kday(new Date(now.getTime() - n * 864e5));
  const d7 = ago(7), d14 = ago(14);
  const between = (r, a, b) => { const d = kday(new Date(r.ts)); return d > a && d <= b; };

  const cur = rows.filter(r => between(r, d7, today));
  const prv = rows.filter(r => between(r, d14, d7));
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
  try { health = JSON.parse((await store.get('health', 'latest.json')) || 'null'); } catch (e) {}

  return {
    generated: new Date().toISOString(),
    storage: store.available(),
    health,
    summary: {
      today: { contact: cnt(tdy, 'contact'), doc: cnt(tdy, 'doc_request'), sub: cnt(tdy, 'subscribe'), total: tdy.length },
      week:  { contact: cnt(cur, 'contact'), doc: cnt(cur, 'doc_request'), sub: cnt(cur, 'subscribe'), total: cur.length },
      prev:  { contact: cnt(prv, 'contact'), doc: cnt(prv, 'doc_request'), sub: cnt(prv, 'subscribe'), total: prv.length },
      channel: srt(grp(cur, r => r.channel)),
      point:   srt(grp(cur, r => r.point)),
      interest: srt(grp(cur.filter(r => r.type === 'doc_request'), r => r.interest)).slice(0, 8),
      daily
    },
    leads: rows.slice(-200).reverse().map(r => ({
      ts: r.ts, label: r.label, type: r.type, channel: r.channel, point: r.point,
      company: r.company, name: r.name, phone: r.phone, email: r.email,
      region: r.region, asset: r.asset, interest: r.interest
    }))
  };
}

/* ── 라우팅 ───────────────────────────────────────────── */
exports.handler = async (event) => {
  const p = String(event.path || '').replace(/\/+$/, '');
  const sub = p.endsWith('/login') ? 'login' : p.endsWith('/logout') ? 'logout'
            : p.endsWith('/data') ? 'data' : '';
  const authed = auth.valid(auth.cookieFrom(event.headers));

  if (!auth.configured()) {
    return html(ui.LOGIN.replace('__ERR__',
      '환경변수 OPS_USER · OPS_PASS 를 먼저 설정해 주세요'));
  }

  if (sub === 'logout') {
    return { statusCode: 302, headers: { location: '/ops', 'set-cookie': auth.clearCookie() }, body: '' };
  }

  if (sub === 'login') {
    if (event.httpMethod !== 'POST') return { statusCode: 302, headers: { location: '/ops' }, body: '' };
    const key = ip(event);
    const f = await failCount(key);
    if (f.n >= MAX_FAIL) {
      return html(ui.LOGIN.replace('__ERR__', '시도가 많습니다. 15분 뒤 다시 해주세요'));
    }
    let raw = event.body || '';
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
    const q = new URLSearchParams(raw);
    if (auth.check(q.get('u'), q.get('p'))) {
      await clearFail(key);
      return { statusCode: 302, headers: { location: '/ops', 'set-cookie': auth.setCookie(auth.issue()) }, body: '' };
    }
    await bumpFail(key, f);
    return html(ui.LOGIN.replace('__ERR__', '아이디 또는 비밀번호가 맞지 않습니다'));
  }

  if (sub === 'data') {
    if (!authed) return json({ error: 'unauthorized' }, 401);
    try { return json(await build()); }
    catch (e) { return json({ error: 'build_failed' }, 500); }
  }

  /* 화면 — 로그인 전에는 관제 코드를 내보내지 않는다 */
  return authed ? html(ui.APP) : html(ui.LOGIN.replace('__ERR__', ''));
};
