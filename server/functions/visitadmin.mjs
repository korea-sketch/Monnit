/** 현장 진단 예약 — 스케줄 관리 화면 (/visit/admin)
 *  로그인 전에는 관리 화면 코드조차 내려가지 않는다.
 *  아이디·비밀번호는 Cloudflare 환경변수 VISIT_USER / VISIT_PASS 로만 받는다.
 */
import * as auth from './_visit_auth.mjs';
import { get, set, readLines } from './_store.mjs';
import { readVisitRecipients, saveVisitRecipients, generalTo, sendBrevo } from './_route.mjs';
import * as LOCK from './_loginlock.mjs';

export const config = {
  path: ['/visit/admin', '/visit/admin/', '/visit/admin/login', '/visit/admin/logout',
         '/visit/admin/config',   /* 저장 — 로그인한 담당자만 */
         '/visit/admin/holds',    /* 자동으로 잡힌 예약 시간 보기·해제 — 로그인한 담당자만 */
         '/visit/admin/bookings', /* 신청 리스트·예약 스케줄 — 로그인한 담당자만 (2026-10-13) */
         '/visit/admin/notify',   /* 예약 알림 받는 사람 보기·저장·테스트 — 로그인한 담당자만 (2026-10-13) */
         '/visit/config',         /* 읽기 — 고객 화면이 열 때마다 가져갑니다 */
         '/visit/hold']           /* 고객이 예약하는 순간 그 시간을 잡습니다 (이중 예약 방지) */
};

/* 설정 저장소 — 관리 화면에서 저장하면 여기 올라가고,
   /visit 이 그걸 읽어 갑니다. 그래서 링크를 다시 만들 필요가 없습니다. */
const CFG_STORE = 'visit', CFG_KEY = 'config.json';

/* ── 자동 예약 잡기 (2026-09-17) ─────────────────────────────────────
   예전에는 같은 시간에 두 고객이 예약할 수 있었고, 관리 화면의 「하루 최대 건수」도 적용되지 않았다.
   (담당자가 확정된 예약을 「시간 막기」에 손으로 넣어야 했다)
   이제 고객이 예약하는 순간 서버가 그 시간을 잡고, 고객 화면은 잡힌 시간(개인정보 없이 날짜·시각만)을 빼고 보여 준다.
   잡힌 시간은 관리 화면 「자동으로 잡힌 예약」에서 해제할 수 있다. */
const HOLD_KEY = 'holds.json';
const KST = 9 * 3600000;
const kstParts = ms => { const x = new Date(ms + KST).toISOString(); return { d: x.slice(0, 10), hm: x.slice(11, 16), dow: new Date(ms + KST).getUTCDay() }; };
const toMin = hm => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
async function readHolds() {
  try { const o = JSON.parse((await get(CFG_STORE, HOLD_KEY)) || '[]'); return Array.isArray(o) ? o : []; }
  catch (e) { return []; }
}
async function readCfg() {
  try { const o = JSON.parse((await get(CFG_STORE, CFG_KEY)) || 'null'); return o && o.cfg ? cleanCfg(o.cfg) : cleanCfg({}); }
  catch (e) { return cleanCfg({}); }
}
const publicHolds = (holds, now) => holds.filter(h => h.end > now).map(h => ({ d: h.d, s: h.s, e: h.e }));
const ipHash = ip => { let x = 0; for (const c of String(ip)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x.toString(36); };

/* 들어온 값을 그대로 믿지 않고 필요한 것만 골라 담습니다. */
function cleanCfg(c) {
  const num = (v, lo, hi, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const hm = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : d);
  const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : '');
  const txt = (v, n) => String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
  const days = Array.isArray(c.workdays)
    ? [...new Set(c.workdays.map(n => parseInt(n, 10)).filter(n => n >= 0 && n <= 6))].sort()
    : [1, 2, 3, 4, 5];
  return {
    v: 1,
    workdays: days,
    dayStart: hm(c.dayStart, '09:30'), dayEnd: hm(c.dayEnd, '16:00'),
    lunchStart: hm(c.lunchStart, '12:00'), lunchEnd: hm(c.lunchEnd, '13:00'),
    mins: num(c.mins, 15, 480, 60),
    buffer: num(c.buffer, 0, 240, 60),
    granularity: num(c.granularity, 15, 120, 30),
    leadHours: num(c.leadHours, 0, 720, 72),
    horizonMonths: num(c.horizonMonths, 0, 12, 1),
    horizonUntil: day(c.horizonUntil),
    horizonDays: num(c.horizonDays, 1, 400, 400),
    maxPerDay: num(c.maxPerDay, 1, 10, 2),
    closed: (Array.isArray(c.closed) ? c.closed : []).slice(0, 200)
      .map(x => ({ d: day(x && x.d), memo: txt(x && x.memo, 40) })).filter(x => x.d),
    blocks: (Array.isArray(c.blocks) ? c.blocks : []).slice(0, 400)
      .map(x => ({ d: day(x && x.d), s: hm(x && x.s, ''), e: hm(x && x.e, ''), memo: txt(x && x.memo, 40) }))
      .filter(x => x.d && x.s && x.e)
  };
}

const MAX_FAIL = 8, LOCK_MS = 15 * 60 * 1000;

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  /* _headers 의 CSP 는 정적 파일에만 붙는다 — 함수 화면은 직접 단다. (2026-09-19)
     예약 목록에는 고객이 적은 회사명·메모가 그대로 보이므로 XSS 가 닿기 쉬운 곳이다. */
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};
const page = (body, extra) => new Response(body,
  { status: 200, headers: { ...H, 'content-type': 'text/html; charset=utf-8', ...(extra || {}) } });
const redirect = (to, extra) => new Response(null,
  { status: 303, headers: { ...H, location: to, ...(extra || {}) } });

function ipOf(req) {
  /* cf-connecting-ip = Cloudflare 가 넣어 주는 진짜 방문자 IP */
  return String(req.headers.get('cf-connecting-ip') || req.headers.get('x-mnk-ip') || req.headers.get('x-mnk-client-ip')
    || req.headers.get('x-forwarded-for') || '?').split(',')[0].trim().slice(0, 45)
    .replace(/[^\w.:-]/g, '_');
}
/* 실패 횟수는 _loginlock 이 파일 개수로 센다 — 동시에 들어와도 어긋나지 않는다.
   예전 방식(읽고-1더해-쓰기)은 한꺼번에 보내면 8회 제한이 걸리지 않았다. (2026-09-18) */

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ─────────────────────────────────────────────────────────── */
export default async (req) => {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '') || '/visit/admin';

  const json = (o, status = 200) => new Response(JSON.stringify(o),
    { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });

  /* ── 고객 화면이 읽어 가는 곳 (누구나) ───────────────────── */
  if (p === '/visit/config') {
    if (req.method !== 'GET') return json({ ok: false, error: 'method' }, 405);
    try {
      const taken = publicHolds(await readHolds(), Date.now());
      const raw = await get(CFG_STORE, CFG_KEY);
      if (!raw) return json({ ok: true, cfg: null, taken });   /* 아직 저장 전 — 기본값으로 열립니다 */
      const o = JSON.parse(raw);
      return json({ ok: true, cfg: o.cfg, savedAt: o.savedAt || '', taken });
    } catch (e) {
      return json({ ok: true, cfg: null });                    /* 읽기 실패해도 예약 화면은 열려야 합니다 */
    }
  }

  /* ── 고객이 예약하는 순간 시간 잡기 (누구나 · 검증 후) ────────── */
  if (p === '/visit/hold') {
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    const site = req.headers.get('sec-fetch-site') || '';
    if (site === 'cross-site') return json({ ok: false, error: 'origin' }, 403);
    let b = null;
    try { b = await req.json(); } catch (e) {}
    const start = Date.parse(b && b.start);
    const code = String((b && b.code) || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 40);
    if (!Number.isFinite(start) || !code) return json({ ok: false, error: 'bad_body' }, 400);
    const now = Date.now();
    const cfg = await readCfg();
    const k = kstParts(start), sMin = toMin(k.hm), eMin = sMin + cfg.mins;
    /* 고객 화면이 보여 줄 수 있는 시간인지 — 과거·휴무·업무시간 밖·점심·리드타임 */
    const wrong =
      start < now + cfg.leadHours * 3600000 - 5 * 60000 ||
      !cfg.workdays.includes(k.dow) || cfg.closed.some(x => x.d === k.d) ||
      sMin < toMin(cfg.dayStart) || eMin > toMin(cfg.dayEnd) ||
      (sMin < toMin(cfg.lunchEnd) && toMin(cfg.lunchStart) < eMin) ||
      (sMin - toMin(cfg.dayStart)) % cfg.granularity !== 0 ||
      cfg.blocks.some(x => x.d === k.d && sMin - cfg.buffer < toMin(x.e) && toMin(x.s) < eMin + cfg.buffer);
    if (wrong) return json({ ok: false, error: 'unavailable' }, 409);
    const ip = ipOf(req), ih = ipHash(ip);
    let holds = (await readHolds()).filter(h => h.end > now - 86400000);   /* 지난 건 정리 */
    if (holds.some(h => h.code === code)) return json({ ok: true, again: true });
    /* 같은 IP 하루 3건 제한 — 로컬(127.0.0.1)은 개발·자동 테스트뿐이라 세지 않는다 (2026-09-18) */
    const isLocal = /^(127\.|::1$|::ffff:127\.|0\.0\.0\.0$)/.test(String(ip || ''));
    if (!isLocal && holds.filter(h => h.ih === ih && h.at > now - 86400000).length >= 3) return json({ ok: false, error: 'rate' }, 429);
    const sameDay = holds.filter(h => h.d === k.d && h.end > now);
    const clash = sameDay.some(h => sMin - cfg.buffer < toMin(h.e) && toMin(h.s) < eMin + cfg.buffer);
    if (clash) return json({ ok: false, error: 'taken' }, 409);
    if (sameDay.length >= cfg.maxPerDay) return json({ ok: false, error: 'full' }, 409);
    const eHM = String(Math.floor(eMin / 60)).padStart(2, '0') + ':' + String(eMin % 60).padStart(2, '0');
    holds.push({
      code, start, end: start + cfg.mins * 60000, d: k.d, s: k.hm, e: eHM, at: now, ih,
      company: String((b && b.company) || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 60)
    });
    if (!(await set(CFG_STORE, HOLD_KEY, JSON.stringify(holds)))) return json({ ok: false, error: 'store' }, 503);
    return json({ ok: true });
  }

  /* ── 자동으로 잡힌 예약 — 보기·해제 (로그인 필요) ──────────── */
  if (p === '/visit/admin/holds') {
    if (!auth.configured() || !auth.valid(auth.cookieFrom(req.headers))) return json({ ok: false, error: 'unauthorized' }, 401);
    const now = Date.now();
    let holds = await readHolds();
    if (req.method === 'POST') {
      let b = null;
      try { b = await req.json(); } catch (e) {}
      const code = String((b && b.release) || '');
      holds = holds.filter(h => h.code !== code);
      if (!(await set(CFG_STORE, HOLD_KEY, JSON.stringify(holds)))) return json({ ok: false, error: 'store' }, 500);
    }
    return json({ ok: true, holds: holds.filter(h => h.end > now).sort((a, b) => a.start - b.start)
      .map(h => ({ code: h.code, d: h.d, s: h.s, e: h.e, company: h.company || '' })) });
  }

  /* ── 신청 리스트 · 예약 스케줄 (로그인 필요 · 2026-10-13) ─────────
     접수 원장(leads)에서 「현장진단 예약」 만 골라, 자동으로 잡힌 시간(holds)과 맞춰 상태를 붙인다.
     따로 저장하지 않으므로 이 기능 이전에 들어온 예약도 그대로 보인다. 최근 3개월. */
  if (p === '/visit/admin/bookings') {
    if (!auth.configured() || !auth.valid(auth.cookieFrom(req.headers))) return json({ ok: false, error: 'unauthorized' }, 401);
    const now = Date.now();
    const months = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now + KST); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i);
      months.push(d.toISOString().slice(0, 7) + '.jsonl');
    }
    let rows = [];
    for (const m of months) rows = rows.concat(await readLines('leads', m).catch(() => []));
    const holds = await readHolds();
    const byCode = new Map(holds.map(h => [h.code, h]));
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      if (!/현장진단 예약|visit_booking/.test(String(r.point || ''))) continue;
      const m = String(r.interest || '').match(/MV-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})-[A-Z0-9]+/i);
      const code = m ? m[0].toUpperCase() : '';
      const key = code || (r.ts + '|' + (r.email || r.phone || ''));
      if (seen.has(key)) continue;
      seen.add(key);
      const tm = String(r.interest || '').match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
      const d = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
      const s = m ? `${m[4]}:${m[5]}` : '';
      const start = d ? Date.parse(d + 'T' + s + ':00+09:00') : 0;
      const h = code ? byCode.get(code) : null;
      const status = !d ? 'unknown' : start < now ? 'past' : h ? 'held' : 'released';
      list.push({
        code, d, s, e: (h && h.e) || (tm ? tm[2] : ''), start, ts: r.ts, status, test: !!r.test,
        company: r.company || '', name: r.name || '', phone: r.phone || '', email: r.email || '',
        place: r.region || '', asset: r.asset || '', exp: r.exp || '', memo: r.memo || '',
        channel: r.channel || ''
      });
    }
    list.sort((a, b) => (String(b.ts) < String(a.ts) ? -1 : String(b.ts) > String(a.ts) ? 1 : 0));
    return json({ ok: true, now, list });
  }

  /* ── 예약 알림 받는 사람 (로그인 필요 · 2026-10-13) ────────────────
     공개 설정(config.json)과 따로 저장한다 — 메일 주소가 /visit/config 로 새지 않게. */
  if (p === '/visit/admin/notify') {
    if (!auth.configured() || !auth.valid(auth.cookieFrom(req.headers))) return json({ ok: false, error: 'unauthorized' }, 401);
    if (req.method === 'POST') {
      let b = null;
      try { b = await req.json(); } catch (e) {}
      if (!b) return json({ ok: false, error: 'bad_body' }, 400);
      if (b.test) {
        const cur = await readVisitRecipients();
        const to = cur.list.map(x => x.email);
        const r = await sendBrevo({
          to, subject: '[현장진단 예약] 알림 수신 테스트 메일',
          fields: { '안내': '스케줄 관리(/visit/admin)에서 보낸 테스트 메일입니다. 이 메일이 보이면 예약 알림을 정상적으로 받습니다.',
                    '보낸 시각': new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), '받는 사람': to.join(', ') }
        });
        return json({ ok: !!r.ok, to, error: r.error || r.skipped || '' }, r.ok ? 200 : 502);
      }
      if (!Array.isArray(b.list)) return json({ ok: false, error: 'bad_body' }, 400);
      const r = await saveVisitRecipients(b.list);
      if (!r.ok) return json({ ok: false, error: 'store' }, 500);
      return json({ ok: true, list: r.list, savedAt: r.savedAt, general: generalTo() });
    }
    const cur = await readVisitRecipients();
    return json({ ok: true, ...cur, general: generalTo() });
  }

  /* ── 담당자가 저장하는 곳 (로그인 필요) ──────────────────── */
  if (p === '/visit/admin/config') {
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (!auth.configured() || !auth.valid(auth.cookieFrom(req.headers))) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    let body = null;
    try { body = await req.json(); } catch (e) {}
    if (!body || !body.cfg) return json({ ok: false, error: 'bad_body' }, 400);
    const cfg = cleanCfg(body.cfg);
    if (!cfg.workdays.length) return json({ ok: false, error: 'no_workdays' }, 400);
    const savedAt = new Date().toISOString();
    const ok = await set(CFG_STORE, CFG_KEY, JSON.stringify({ cfg, savedAt }));
    if (!ok) return json({ ok: false, error: 'store' }, 500);
    return json({ ok: true, savedAt });
  }

  /* 로그아웃 */
  if (p === '/visit/admin/logout') {
    return redirect('/visit/admin', { 'set-cookie': auth.clearCookie() });
  }

  /* 로그인 처리 */
  if (p === '/visit/admin/login' && req.method === 'POST') {
    if (!auth.configured()) return page(LOGIN({ notice: '아직 잠금이 설정되지 않았습니다. Cloudflare 환경변수 VISIT_USER / VISIT_PASS 를 먼저 등록해 주세요.' }));

    const key = ipOf(req);
    const f = await LOCK.recent('visit', key);
    if (f.locked) return page(LOGIN({ error: LOCK.lockText(f.until) }));

    let u = '', pw = '';
    try {
      const fd = await req.formData();
      u = String(fd.get('u') || '');
      pw = String(fd.get('p') || '');
    } catch { /* 파싱 실패는 실패로 처리 */ }

    if (auth.check(u, pw)) {
      await LOCK.clear('visit', key);
      return redirect('/visit/admin', { 'set-cookie': auth.setCookie(auth.issue()) });
    }
    await LOCK.fail('visit', key);
    return page(LOGIN({ error: '아이디 또는 비밀번호가 맞지 않습니다.' }));
  }

  /* 그 외 — 인증 확인 */
  if (!auth.configured()) {
    return page(LOGIN({ notice: '아직 잠금이 설정되지 않았습니다. Cloudflare 환경변수 VISIT_USER / VISIT_PASS 를 등록한 뒤 다시 열어 주세요.' }));
  }
  if (!auth.valid(auth.cookieFrom(req.headers))) {
    return page(LOGIN({}));
  }
  return page(ADMIN());
};

/* ═══════════════════════ 로그인 화면 ═══════════════════════ */
function LOGIN({ error, notice } = {}) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>스케줄 관리 로그인 | 모넷코리아</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<meta name="theme-color" content="#E6EDE8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#070C0A" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/visit.css">
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <h1>스케줄 관리
      <span class="sub">현장 진단 방문 일정을 여는 화면입니다.<br>담당자만 들어올 수 있습니다.</span>
    </h1>
    ${error ? `<div class="banner bad" style="margin:0">${esc(error)}</div>` : ''}
    ${notice ? `<div class="banner" style="margin:0">${esc(notice)}</div>` : ''}
    <form method="post" action="/visit/admin/login">
      <div class="field">
        <label for="u">아이디</label>
        <input id="u" name="u" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required>
      </div>
      <div class="field">
        <label for="p">비밀번호</label>
        <input id="p" name="p" type="password" autocomplete="current-password" required>
      </div>
      <div class="actions"><button class="btn" type="submit">들어가기</button></div>
    </form>
    <p class="hint" style="margin:0">
      고객용 예약 화면은 <a href="/visit">monnit.co.kr/visit</a> 입니다.
    </p>
  </div>
</div>
</body>
</html>`;
}

/* ═══════════════════════ 관리 화면 ═══════════════════════ */
function ADMIN() {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>스케줄 관리 | 모넷코리아</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<meta name="theme-color" content="#E6EDE8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#070C0A" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/visit.css">
<style>
/* 신청 리스트 · 예약 스케줄 · 알림 받는 사람 (2026-10-13) */
.bk-card{margin-bottom:22px}
.bk-tabs{display:inline-flex;gap:4px;padding:4px;border:1px solid var(--hair);border-radius:10px;background:var(--glass-sunken);margin:2px 0 14px}
.bk-tabs button{border:0;background:transparent;color:var(--ink-2);font:inherit;font-size:13px;padding:7px 14px;border-radius:7px;cursor:pointer}
.bk-tabs button[aria-selected="true"]{background:var(--glass-strong);color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.bk-tabs .n{font-family:var(--mono);font-size:11px;color:var(--accent);margin-left:5px}
.bk-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.bk-tools input{flex:1 1 220px;min-width:0}
.bk-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--hair);border-radius:var(--radius-sm)}
table.bk{border-collapse:collapse;width:100%;font-size:13px;min-width:760px}
table.bk th{position:sticky;top:0;text-align:left;font-weight:600;font-size:11.5px;color:var(--ink-3);font-family:var(--mono);letter-spacing:.04em;padding:9px 10px;border-bottom:1px solid var(--hair-strong);background:var(--glass-strong);white-space:nowrap}
table.bk td{padding:10px;border-bottom:1px solid var(--hair);vertical-align:top;color:var(--ink-2)}
table.bk tr:last-child td{border-bottom:0}
table.bk td b{color:var(--ink);font-weight:600}
table.bk td .mono{font-family:var(--mono);font-size:11.5px}
table.bk td a{color:var(--accent)}
table.bk tr.more td{background:var(--glass-quiet);font-size:12.5px;line-height:1.7}
table.bk tr.row{cursor:pointer}
table.bk tr.row:hover td{background:var(--glass-quiet)}
.st{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;white-space:nowrap;border:1px solid var(--hair-strong);color:var(--ink-3)}
.st.held{color:var(--accent);background:var(--accent-soft);border-color:var(--accent-line)}
.st.released{color:var(--danger);background:var(--danger-soft);border-color:var(--danger-line)}
.st.test{color:var(--signal);background:var(--signal-soft);border-color:var(--signal-line);margin-left:4px}
.sch-day{margin:0 0 14px}
.sch-day h4{margin:0 0 6px;font-size:13px;color:var(--ink);font-weight:600}
.sch-day h4 .mono{font-family:var(--mono);font-weight:500;color:var(--ink-3);font-size:11.5px;margin-left:6px}
.sch-item{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;padding:10px 12px;border:1px solid var(--hair);border-radius:var(--radius-xs);background:var(--glass-strong);margin-bottom:6px}
.sch-item .t{font-family:var(--mono);font-size:12.5px;color:var(--accent);font-weight:600}
.sch-item .who{color:var(--ink);font-weight:600;font-size:13.5px}
.sch-item .meta{color:var(--ink-3);font-size:12.5px;margin-top:2px;word-break:break-all}
.sch-item a{color:var(--accent)}
.bk-tools input{font:inherit;font-size:13px;padding:9px 12px;border:1px solid var(--hair-strong);border-radius:var(--radius-xs);background:var(--glass-strong);color:var(--ink)}
.rcp{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.rcp-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--hair);border-radius:var(--radius-xs);background:var(--glass-strong);font-size:13px}
.rcp-row .em{font-family:var(--mono);font-size:12.5px;color:var(--ink);word-break:break-all;flex:1}
.rcp-row .nm{color:var(--ink-3);font-size:12px}
.rcp-row button{border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px}
.rcp-row button:hover{color:var(--danger)}
@media (max-width:560px){.sch-item{grid-template-columns:1fr;gap:4px}}
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="brand">
      <a href="/" class="brand-mark">Monnit Korea</a>
      <span class="brand-name">스케줄 관리</span>
    </div>
    <div class="masthead-meta">
      <a href="/visit/admin/logout" style="color:var(--ink-3)">로그아웃</a>
    </div>
  </header>

  <div class="statline">
    <div class="stat"><span class="k">공개 기간 내 슬롯</span><span class="v" id="stSlots">–</span></div>
    <div class="stat"><span class="k">방문 가능일</span><span class="v" id="stDays">–</span></div>
    <div class="stat"><span class="k">첫 방문 가능일</span><span class="v" id="stFirst">–</span></div>
    <div class="stat"><span class="k">제외된 날</span><span class="v" id="stClosed">–</span></div>
  </div>

  <div class="card bk-card">
    <h3>예약 현황
      <span class="sub">고객이 /visit 에서 신청한 내역입니다(최근 3개월). 행을 누르면 상세 내용이 열립니다.
        <b>예약 확정</b>은 시간이 잡혀 있는 건, <b>시간 해제</b>는 아래 「자동으로 잡힌 예약」에서 풀린 건입니다.</span>
    </h3>
    <div class="bk-tabs" role="tablist">
      <button type="button" role="tab" id="tabSch" aria-selected="true">예약 스케줄<span class="n" id="nSch"></span></button>
      <button type="button" role="tab" id="tabList" aria-selected="false">신청 리스트<span class="n" id="nList"></span></button>
    </div>
    <div id="paneSch"><p class="hint">불러오는 중…</p></div>
    <div id="paneList" hidden>
      <div class="bk-tools">
        <input id="bkQ" type="search" placeholder="회사·담당자·연락처·예약코드 검색">
        <button class="btn ghost sm" id="bkCsv" type="button">CSV 내려받기</button>
        <button class="btn ghost sm" id="bkReload" type="button">새로고침</button>
      </div>
      <div id="bkTable"><p class="hint">불러오는 중…</p></div>
    </div>
  </div>

  <div class="admin-grid">
    <div>
      <div class="card">
        <h3>근무 조건
          <span class="sub">여기서 정한 값이 고객 화면의 선택 가능한 시간을 그대로 결정합니다.</span>
        </h3>
        <div class="field"><label>방문 가능 요일</label><div class="dows" id="dowset"></div></div>
        <div class="row2">
          <div class="field"><label for="s-start">업무 시작</label><input id="s-start" type="time"></div>
          <div class="field"><label for="s-end">업무 종료</label><input id="s-end" type="time"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="s-lstart">점심 시작</label><input id="s-lstart" type="time"></div>
          <div class="field"><label for="s-lend">점심 종료</label><input id="s-lend" type="time"></div>
        </div>
        <div class="row3">
          <div class="field"><label for="s-mins">방문 소요(분)</label><input id="s-mins" type="number" min="15" max="480" step="15"></div>
          <div class="field"><label for="s-buffer">이동 버퍼(분)</label><input id="s-buffer" type="number" min="0" max="240" step="15"></div>
          <div class="field"><label for="s-gran">슬롯 간격(분)</label><input id="s-gran" type="number" min="15" max="120" step="15"></div>
        </div>
        <div class="row3">
          <div class="field"><label for="s-lead">최소 리드타임(시간)</label><input id="s-lead" type="number" min="0" max="720"></div>
          <div class="field"><label for="s-max">하루 최대 건수</label><input id="s-max" type="number" min="1" max="10"></div>
          <div class="field">
            <label for="s-months">몇 달치 열기</label>
            <select id="s-months">
              <option value="0">이번 달 말일까지</option>
              <option value="1">다음 달 말일까지</option>
              <option value="2">두 달 뒤 말일까지</option>
              <option value="3">세 달 뒤 말일까지</option>
              <option value="6">여섯 달 뒤 말일까지</option>
            </select>
          </div>
        </div>
        <p class="hint" id="horNote"></p>
        <div class="field">
          <label for="s-until">여기서 멈추기 (선택)
            <span class="sub">특정 날짜 이후로는 아예 받지 않으려면 그 날짜를 넣으세요.
              비워 두면 위의 ‘몇 달치 열기’ 대로 매달 자동으로 이어집니다.</span>
          </label>
          <input id="s-until" type="date">
        </div>
        <p class="hint">리드타임은 사전 통화에 필요한 시간입니다. 영업일 3~4일을 확보하려면 72시간 이상으로 두세요.</p>
      </div>

      <div class="card">
        <h3>쉬는 날 추가
          <span class="sub">휴가, 출장, 전사 행사처럼 하루 전체를 비워야 하는 날입니다. 공휴일은 자동으로 빠집니다.</span>
        </h3>
        <div class="row2">
          <div class="field"><label for="c-date">날짜</label><input id="c-date" type="date"></div>
          <div class="field"><label for="c-memo">메모 (선택)</label><input id="c-memo" placeholder="예) 하계 휴가"></div>
        </div>
        <div class="actions"><button class="btn sm" id="addClosed" type="button">쉬는 날 추가</button></div>
        <div class="chiplist" id="closedList"></div>
      </div>

      <div class="card">
        <h3>시간 막기
          <span class="sub">이미 잡힌 미팅이나 확정된 방문처럼 하루 중 일부만 막을 때 씁니다. 확정된 예약도 여기에 넣어 두면 이중 예약이 생기지 않습니다.</span>
        </h3>
        <div class="row3">
          <div class="field"><label for="b-date">날짜</label><input id="b-date" type="date"></div>
          <div class="field"><label for="b-start">시작</label><input id="b-start" type="time"></div>
          <div class="field"><label for="b-end">종료</label><input id="b-end" type="time"></div>
        </div>
        <div class="field"><label for="b-memo">메모 (선택)</label><input id="b-memo" placeholder="예) LG 가산 방문"></div>
        <div class="actions"><button class="btn sm" id="addBlock" type="button">시간 막기 추가</button></div>
        <div class="chiplist" id="blockList"></div>
      </div>

      <div class="card">
        <h3>자동으로 잡힌 예약
          <span class="sub">고객이 예약하면 그 시간이 자동으로 잡혀 다른 고객에게는 보이지 않습니다. 취소·변경된 예약은 해제하면 다시 열립니다. (저장 버튼 없이 바로 반영)</span>
        </h3>
        <div class="chiplist" id="holdList"><span class="hint">불러오는 중…</span></div>
      </div>

      <div class="card">
        <h3>자동으로 빠지는 공휴일
          <span class="sub">대한민국 관공서 공휴일과 대체공휴일입니다. 따로 넣지 않아도 예약 화면에서 빠집니다.</span>
        </h3>
        <div class="holgrid" id="holList"></div>
      </div>
    </div>

    <div>
      <div class="card">
        <h3>저장하기
          <span class="sub">누르면 곧바로 <b>monnit.co.kr/visit</b> 에 반영됩니다.
            고객에게는 그 주소만 보내시면 됩니다.</span>
        </h3>
        <div class="actions">
          <button class="btn" id="publishCfg" type="button">저장하고 공개하기</button>
          <button class="btn ghost sm" id="reloadCfg" type="button">되돌리기</button>
        </div>
        <p class="hint" id="pubHint">아직 저장하지 않았습니다.</p>
        <div class="actions" style="border-top:1px solid var(--hair);padding-top:12px;margin-top:2px">
          <a class="btn ghost sm" id="openVisit" href="/visit" target="_blank" rel="noopener">고객 화면 열어 보기</a>
        </div>
      </div>

      <div class="card">
        <h3>특정 고객에게만 다른 일정을 줄 때
          <span class="sub">평소에는 쓰지 않습니다. 지금 화면 설정을 링크에 담아
            <b>그 고객에게만</b> 다른 일정을 보여 주고 싶을 때만 씁니다.</span>
        </h3>
        <div class="actions">
          <button class="btn ghost sm" id="makeLink" type="button">전용 링크 만들기</button>
          <button class="btn ghost sm" id="copyLink" type="button">복사</button>
        </div>
        <textarea class="linkout" id="linkOut" readonly spellcheck="false" placeholder="필요할 때만 만드십시오."></textarea>
        <p class="hint" id="linkHint"></p>
      </div>

      <div class="card">
        <h3>미리보기</h3>
        <div class="preview" id="previewBox"></div>
      </div>

      <div class="card">
        <h3>예약 알림 받는 사람
          <span class="sub">고객이 예약하면 여기 있는 모든 주소로 접수 메일이 바로 갑니다. (추가·삭제는 저장 버튼 없이 바로 반영)</span>
        </h3>
        <div class="rcp" id="rcpList"><span class="hint">불러오는 중…</span></div>
        <div class="row2">
          <div class="field"><label for="r-email">이메일</label><input id="r-email" type="email" placeholder="name@monnit.com" autocomplete="off"></div>
          <div class="field"><label for="r-name">이름 (선택)</label><input id="r-name" placeholder="예) 담당 엔지니어"></div>
        </div>
        <div class="actions">
          <button class="btn sm" id="rcpAdd" type="button">받는 사람 추가</button>
          <button class="btn ghost sm" id="rcpTest" type="button">테스트 메일 보내기</button>
        </div>
        <p class="hint" id="rcpHint"></p>
      </div>

      <div class="card">
        <h3>들어온 예약 보기</h3>
        <p class="hint" style="margin:0">접수된 예약은 monday 보드에 쌓입니다. 상태·담당 엔지니어·설비 정보를 그곳에서 관리하세요.</p>
        <div class="actions">
          <a class="btn ghost sm" href="https://monnitk.monday.com/boards/18429687217" target="_blank" rel="noopener">monday 보드 열기</a>
        </div>
      </div>

      <div class="card">
        <h3>처음 값으로</h3>
        <p class="hint" style="margin:0">설정이 엉켰을 때 기본 조건으로 되돌립니다.
          되돌린 뒤 <b>저장하고 공개하기</b> 를 눌러야 고객 화면에도 반영됩니다.</p>
        <div class="actions">
          <button class="btn ghost sm" id="resetCfg" type="button">처음 값으로</button>
        </div>
        <p class="hint" id="cfgHint"></p>
      </div>
    </div>
  </div>

  <footer class="foot">
    <span>MONNIT KOREA · 스케줄 관리</span>
    <span>ADMIN · NOINDEX</span>
  </footer>
</div>

<script src="/visit-core.js?v=2"></script>
<script>
(function(){
  "use strict";
  var V=window.VisitCore;
  var cfg=JSON.parse(JSON.stringify(V.DEFAULT_CFG));
  var dirty=false;          /* 고친 뒤 아직 저장 안 한 상태 */
  var savedAt="";

  function stamp(iso){
    if(!iso) return "";
    try{
      var d=new Date(iso);
      return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"long",day:"numeric",
        hour:"2-digit",minute:"2-digit"}).format(d);
    }catch(e){ return ""; }
  }
  function showPub(){
    var h=document.getElementById("pubHint");
    if(dirty){
      h.innerHTML="고친 내용이 있습니다. <b>‘저장하고 공개하기’</b> 를 눌러야 고객 화면에 반영됩니다.";
      h.style.color="var(--signal)";
      return;
    }
    h.style.color="";
    h.innerHTML = savedAt
      ? "지금 고객 화면(<b>monnit.co.kr/visit</b>)에 나가는 설정입니다. 마지막 저장 "+V.esc(stamp(savedAt))+"."
      : "아직 한 번도 저장하지 않았습니다. 고객 화면은 <b>기본 일정</b>으로 열립니다.";
  }
  function markDirty(){ dirty=true; showPub(); }

  function fillForm(){
    document.getElementById("s-start").value=cfg.dayStart;
    document.getElementById("s-end").value=cfg.dayEnd;
    document.getElementById("s-lstart").value=cfg.lunchStart;
    document.getElementById("s-lend").value=cfg.lunchEnd;
    document.getElementById("s-mins").value=cfg.mins;
    document.getElementById("s-buffer").value=cfg.buffer;
    document.getElementById("s-gran").value=cfg.granularity;
    document.getElementById("s-lead").value=cfg.leadHours;
    document.getElementById("s-months").value=String(cfg.horizonMonths===undefined?1:cfg.horizonMonths);
    document.getElementById("s-until").value=cfg.horizonUntil||"";
    document.getElementById("s-max").value=cfg.maxPerDay;
    var box=document.getElementById("dowset"); box.innerHTML="";
    V.DOW_KO.forEach(function(d,i){
      var b=document.createElement("button");
      b.type="button"; b.className="dow-chip"; b.textContent=d;
      b.setAttribute("aria-pressed",String(cfg.workdays.indexOf(i)!==-1));
      b.addEventListener("click",function(){
        b.setAttribute("aria-pressed",String(b.getAttribute("aria-pressed")!=="true"));
        pullForm(); render(); markDirty();
      });
      box.appendChild(b);
    });
  }
  function pullForm(){
    var days=[];
    Array.prototype.forEach.call(document.querySelectorAll("#dowset .dow-chip"),function(b,i){
      if(b.getAttribute("aria-pressed")==="true") days.push(i);
    });
    cfg.workdays=days;
    cfg.dayStart=document.getElementById("s-start").value||"09:30";
    cfg.dayEnd=document.getElementById("s-end").value||"16:00";
    cfg.lunchStart=document.getElementById("s-lstart").value||"12:00";
    cfg.lunchEnd=document.getElementById("s-lend").value||"13:00";
    cfg.mins=Math.max(15,parseInt(document.getElementById("s-mins").value,10)||60);
    cfg.buffer=Math.max(0,parseInt(document.getElementById("s-buffer").value,10)||0);
    cfg.granularity=Math.max(15,parseInt(document.getElementById("s-gran").value,10)||30);
    cfg.leadHours=Math.max(0,parseInt(document.getElementById("s-lead").value,10)||0);
    cfg.horizonMonths=parseInt(document.getElementById("s-months").value,10)||0;
    cfg.horizonUntil=document.getElementById("s-until").value||"";
    cfg.maxPerDay=Math.max(1,parseInt(document.getElementById("s-max").value,10)||1);
  }
  function renderClosed(){
    var box=document.getElementById("closedList");
    if(!cfg.closed.length){box.innerHTML='<span class="hint">등록된 쉬는 날이 없습니다.</span>';return;}
    box.innerHTML="";
    cfg.closed.slice().sort(function(a,b){return a.d<b.d?-1:1;}).forEach(function(x){
      var el=document.createElement("span"); el.className="chip";
      el.innerHTML=V.esc(x.d)+(x.memo?' <span class="memo">'+V.esc(x.memo)+'</span>':'');
      var del=document.createElement("button"); del.type="button"; del.textContent="\\u00d7"; del.title="삭제";
      del.addEventListener("click",function(){
        cfg.closed=cfg.closed.filter(function(y){return y.d!==x.d;});
        renderClosed(); render(); markDirty();
      });
      el.appendChild(del); box.appendChild(el);
    });
  }
  function renderBlocks(){
    var box=document.getElementById("blockList");
    if(!cfg.blocks.length){box.innerHTML='<span class="hint">막아 둔 시간이 없습니다.</span>';return;}
    box.innerHTML="";
    cfg.blocks.slice().sort(function(a,b){return (a.d+a.s)<(b.d+b.s)?-1:1;}).forEach(function(x){
      var el=document.createElement("span"); el.className="chip";
      el.innerHTML=V.esc(x.d)+" "+V.esc(x.s)+"\\u2013"+V.esc(x.e)+(x.memo?' <span class="memo">'+V.esc(x.memo)+'</span>':'');
      var del=document.createElement("button"); del.type="button"; del.textContent="\\u00d7"; del.title="삭제";
      del.addEventListener("click",function(){
        cfg.blocks=cfg.blocks.filter(function(y){return !(y.d===x.d&&y.s===x.s&&y.e===x.e);});
        renderBlocks(); render(); markDirty();
      });
      el.appendChild(del); box.appendChild(el);
    });
  }
  function renderHolidays(){
    var box=document.getElementById("holList"), t=V.today(), out=[];
    Object.keys(V.HOLIDAYS).sort().forEach(function(k){
      if(k>=t) out.push('<div><b>'+k+'</b>'+V.esc(V.HOLIDAYS[k])+'</div>');
    });
    box.innerHTML=out.join("")||'<span class="hint">등록된 공휴일이 없습니다.</span>';
  }
  function render(){
    var keys=V.horizonKeys(cfg), total=0, days=0, first=null, closedCnt=0;
    keys.forEach(function(k){
      var n=V.slotsFor(cfg,k).length;
      if(n){ total+=n; days++; if(!first) first=k; }
      else if(V.HOLIDAYS[k]||V.closedMemo(cfg,k)!==null) closedCnt++;
    });
    document.getElementById("stSlots").textContent=total;
    document.getElementById("stDays").textContent=days+"일";
    document.getElementById("stFirst").textContent=first?first.slice(5).replace("-","/"):"–";
    document.getElementById("stClosed").textContent=closedCnt+"일";

    var end=V.horizonEnd(cfg);
    document.getElementById("horNote").innerHTML=
      "지금은 <b>"+V.esc(V.labelDate(end))+"</b> 까지 열려 있습니다. "+
      (cfg.horizonUntil
        ? "‘여기서 멈추기’ 날짜가 들어가 있어 그 뒤로는 더 열리지 않습니다."
        : "달이 바뀌면 한 달치가 자동으로 더 열립니다. 따로 손대지 않으셔도 됩니다.");

    var pv=document.getElementById("previewBox"), rows=[];
    keys.forEach(function(k){
      var list=V.slotsFor(cfg,k);
      if(list.length){
        rows.push('<div class="pv-row"><span class="k">'+V.esc(V.labelDate(k))+'</span><span class="v">'+
          V.esc(list[0].hm)+" ~ "+V.esc(list[list.length-1].hm)+" \\u00b7 "+list.length+'개</span></div>');
      }
    });
    var SHOW=14;
    pv.innerHTML=rows.slice(0,SHOW).join("")||'<p class="hint" style="margin:0">지금 조건으로는 예약 가능한 시간이 없습니다. 요일이나 리드타임을 확인해 주세요.</p>';
    if(rows.length>SHOW){
      pv.innerHTML+='<p class="hint" style="margin:8px 0 0">외 '+(rows.length-SHOW)+'일 더 있습니다. '+
        '마지막 공개일은 <b>'+V.esc(V.labelDate(V.horizonEnd(cfg)))+'</b> 입니다.</p>';
    }
  }

  document.getElementById("addClosed").addEventListener("click",function(){
    var d=document.getElementById("c-date").value, memo=document.getElementById("c-memo").value.trim();
    if(!d) return;
    cfg.closed=cfg.closed.filter(function(x){return x.d!==d;});
    cfg.closed.push({d:d,memo:memo});
    document.getElementById("c-date").value=""; document.getElementById("c-memo").value="";
    renderClosed(); render(); markDirty();
  });
  document.getElementById("addBlock").addEventListener("click",function(){
    var d=document.getElementById("b-date").value,
        s=document.getElementById("b-start").value,
        e=document.getElementById("b-end").value,
        memo=document.getElementById("b-memo").value.trim();
    if(!d){ V.toast("날짜를 골라 주세요"); return; }
    if(!s||!e){ V.toast("시작과 종료 시간을 넣어 주세요"); return; }
    if(V.toMin(e)<=V.toMin(s)){ V.toast("종료 시간이 시작보다 빠릅니다"); return; }
    cfg.blocks.push({d:d,s:s,e:e,memo:memo});
    document.getElementById("b-date").value=""; document.getElementById("b-start").value="";
    document.getElementById("b-end").value=""; document.getElementById("b-memo").value="";
    renderBlocks(); render(); markDirty();
  });
  ["s-start","s-end","s-lstart","s-lend","s-mins","s-buffer","s-gran","s-lead","s-months","s-until","s-max"]
    .forEach(function(id){
      document.getElementById(id).addEventListener("change",function(){pullForm();render();markDirty();});
    });

  document.getElementById("makeLink").addEventListener("click",function(){
    pullForm();
    var url=location.origin+"/visit?s="+V.encodeCfg(cfg);
    document.getElementById("linkOut").value=url;
    document.getElementById("linkHint").textContent=
      "이 링크를 고객에게 보내면 위 설정이 그대로 적용됩니다. 스케줄을 바꾸면 링크를 다시 만들어 주세요. ("+url.length+"자)";
    render();
  });
  document.getElementById("copyLink").addEventListener("click",function(){
    var t=document.getElementById("linkOut");
    if(!t.value){ V.toast("먼저 ‘링크 만들기’를 눌러 주세요"); return; }
    t.focus(); t.select();
    V.copy(t.value,"링크를 복사했습니다");
  });
  /* ── 저장하고 공개하기 ── */
  var pubBtn=document.getElementById("publishCfg");
  pubBtn.addEventListener("click",function(){
    pullForm();
    if(!cfg.workdays.length){ V.toast("방문 가능 요일을 하나 이상 켜 주세요"); return; }
    pubBtn.disabled=true; pubBtn.textContent="저장하는 중…";
    V.pushCfg(cfg).then(function(r){
      pubBtn.disabled=false; pubBtn.textContent="저장하고 공개하기";
      if(r.ok){
        dirty=false; savedAt=new Date().toISOString(); showPub();
        V.toast("저장했습니다. 고객 화면에 반영되었습니다","ok");
      } else if(r.error==="unauthorized"){
        V.toast("로그인이 풀렸습니다. 새로고침 후 다시 로그인해 주세요");
      } else {
        V.toast("저장하지 못했습니다. 잠시 후 다시 눌러 주세요");
      }
    });
  });

  /* 서버에 저장된 설정으로 되돌리기 */
  function pullFromServer(quiet){
    return V.fetchRemote().then(function(r){
      if(r&&r.cfg){ cfg=r.cfg; savedAt=r.savedAt||""; }
      else { cfg=JSON.parse(JSON.stringify(V.DEFAULT_CFG)); savedAt=""; }
      dirty=false;
      fillForm(); renderClosed(); renderBlocks(); render(); showPub();
      if(!quiet) V.toast(r&&r.cfg?"저장된 설정을 불러왔습니다":"저장된 설정이 없어 기본값으로 두었습니다");
    });
  }
  document.getElementById("reloadCfg").addEventListener("click",function(){ pullFromServer(false); });

  document.getElementById("resetCfg").addEventListener("click",function(){
    cfg=JSON.parse(JSON.stringify(V.DEFAULT_CFG));
    fillForm(); renderClosed(); renderBlocks(); render(); markDirty();
    document.getElementById("cfgHint").textContent=
      "처음 값으로 되돌렸습니다. ‘저장하고 공개하기’ 를 눌러야 고객 화면에도 반영됩니다.";
    V.toast("처음 값으로 되돌렸습니다");
  });

  /* 자동으로 잡힌 예약 */
  function renderHolds(list){
    var box=document.getElementById("holdList");
    if(!list||!list.length){box.innerHTML='<span class="hint">잡힌 예약이 없습니다.</span>';return;}
    box.innerHTML="";
    list.forEach(function(x){
      var el=document.createElement("span"); el.className="chip";
      el.innerHTML=V.esc(x.d)+" "+V.esc(x.s)+"\u2013"+V.esc(x.e)+' <span class="memo">'+V.esc(x.company||x.code)+'</span>';
      var del=document.createElement("button"); del.type="button"; del.textContent="\u00d7"; del.title="해제";
      del.addEventListener("click",function(){
        if(!confirm(x.d+" "+x.s+" 예약 시간을 해제할까요? 고객 화면에 다시 열립니다.")) return;
        loadHolds({release:x.code}).then(function(){ V.toast("해제했습니다","ok"); });
      });
      el.appendChild(del); box.appendChild(el);
    });
  }
  function loadHolds(body){
    return fetch("/visit/admin/holds",{method:body?"POST":"GET",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store"})
      .then(function(r){return r.json();})
      .then(function(j){ if(j&&j.ok) renderHolds(j.holds); else document.getElementById("holdList").innerHTML='<span class="hint">불러오지 못했습니다.</span>'; })
      .catch(function(){ document.getElementById("holdList").innerHTML='<span class="hint">불러오지 못했습니다.</span>'; });
  }

  /* ── 예약 현황: 예약 스케줄 · 신청 리스트 (2026-10-13) ── */
  var BK=[], DOWS=["일","월","화","수","목","금","토"];
  var ST={held:"예약 확정",released:"시간 해제",past:"지난 일정",unknown:"일시 미상"};
  function dayLabel(d){ try{ var x=new Date(d+"T00:00:00Z"); if(isNaN(x)) return d; return (x.getUTCMonth()+1)+"월 "+x.getUTCDate()+"일 ("+DOWS[x.getUTCDay()]+")"; }catch(e){ return d; } }
  function tsLabel(iso){ return stamp(iso); }
  function badge(x){ return '<span class="st '+x.status+'">'+ST[x.status]+'</span>'+(x.test?'<span class="st test">테스트?</span>':''); }
  function tel(v){ return v?'<a href="tel:'+V.esc(String(v).replace(/[^0-9+]/g,""))+'">'+V.esc(v)+'</a>':""; }
  function mailto(v){ return v?'<a href="mailto:'+V.esc(v)+'">'+V.esc(v)+'</a>':""; }

  function renderSchedule(){
    var box=document.getElementById("paneSch");
    var up=BK.filter(function(x){return x.status==="held"||x.status==="released";})
             .sort(function(a,b){return a.start-b.start;});
    document.getElementById("nSch").textContent=up.filter(function(x){return x.status==="held";}).length||"";
    if(!up.length){ box.innerHTML='<p class="hint">앞으로 잡힌 방문 일정이 없습니다.</p>'; return; }
    var html="", cur="";
    up.forEach(function(x){
      if(x.d!==cur){ if(cur) html+="</div>"; cur=x.d; html+='<div class="sch-day"><h4>'+V.esc(dayLabel(x.d))+'<span class="mono">'+V.esc(x.d)+'</span></h4>'; }
      html+='<div class="sch-item"><div><div class="t">'+V.esc(x.s)+(x.e?"–"+V.esc(x.e):"")+'</div>'+badge(x)+'</div>'+
        '<div><div class="who">'+V.esc(x.company||"(회사 미기재)")+(x.name?' · '+V.esc(x.name):'')+'</div>'+
        '<div class="meta">'+[tel(x.phone),mailto(x.email)].filter(Boolean).join(" · ")+'</div>'+
        (x.place?'<div class="meta">방문지 '+V.esc(x.place)+'</div>':'')+
        (x.asset?'<div class="meta">대상 설비 '+V.esc(x.asset)+'</div>':'')+
        '<div class="meta mono">'+V.esc(x.code)+'</div></div></div>';
    });
    box.innerHTML=html+"</div>";
  }

  function renderList(){
    var q=(document.getElementById("bkQ").value||"").trim().toLowerCase();
    var rows=BK.filter(function(x){
      if(!q) return true;
      return [x.company,x.name,x.phone,x.email,x.code,x.place,x.asset].join(" ").toLowerCase().indexOf(q)!==-1;
    });
    document.getElementById("nList").textContent=BK.length||"";
    var box=document.getElementById("bkTable");
    if(!rows.length){ box.innerHTML='<p class="hint">'+(BK.length?"검색 결과가 없습니다.":"최근 3개월 동안 들어온 예약 신청이 없습니다.")+'</p>'; return; }
    var h='<div class="bk-scroll"><table class="bk"><thead><tr><th>신청 시각</th><th>방문 희망</th><th>상태</th><th>회사 · 담당자</th><th>연락처</th><th>이메일</th><th>대상 설비</th></tr></thead><tbody>';
    rows.forEach(function(x,i){
      h+='<tr class="row" data-i="'+i+'"><td class="mono">'+V.esc(tsLabel(x.ts))+'</td>'+
        '<td><b>'+V.esc(x.d?dayLabel(x.d):"-")+'</b><br><span class="mono">'+V.esc(x.s)+(x.e?"–"+V.esc(x.e):"")+'</span></td>'+
        '<td>'+badge(x)+'</td>'+
        '<td><b>'+V.esc(x.company)+'</b><br>'+V.esc(x.name)+'</td>'+
        '<td>'+tel(x.phone)+'</td><td>'+mailto(x.email)+'</td><td>'+V.esc(x.asset)+'</td></tr>'+
        '<tr class="more" data-m="'+i+'" hidden><td colspan="7">'+
          '<b>예약코드</b> <span class="mono">'+V.esc(x.code||"-")+'</span>'+
          (x.place?' · <b>방문지</b> '+V.esc(x.place):'')+
          (x.exp?' · <b>진동센서 경험</b> '+V.esc(x.exp):'')+
          (x.channel?' · <b>유입</b> '+V.esc(x.channel):'')+
          (x.memo?'<br>'+V.esc(x.memo):'')+'</td></tr>';
    });
    box.innerHTML=h+'</tbody></table></div>';
    box.querySelectorAll("tr.row").forEach(function(tr){
      tr.addEventListener("click",function(e){
        if(e.target.closest("a")) return;
        var m=box.querySelector('tr.more[data-m="'+tr.getAttribute("data-i")+'"]'); if(m) m.hidden=!m.hidden;
      });
    });
  }

  function loadBookings(){
    return fetch("/visit/admin/bookings",{cache:"no-store"})
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j||!j.ok) throw 0;
        BK=j.list||[]; renderSchedule(); renderList();
      })
      .catch(function(){
        document.getElementById("paneSch").innerHTML='<p class="hint">불러오지 못했습니다.</p>';
        document.getElementById("bkTable").innerHTML='<p class="hint">불러오지 못했습니다.</p>';
      });
  }
  function tab(which){
    var sch=which==="sch";
    document.getElementById("tabSch").setAttribute("aria-selected",String(sch));
    document.getElementById("tabList").setAttribute("aria-selected",String(!sch));
    document.getElementById("paneSch").hidden=!sch;
    document.getElementById("paneList").hidden=sch;
  }
  document.getElementById("tabSch").addEventListener("click",function(){tab("sch");});
  document.getElementById("tabList").addEventListener("click",function(){tab("list");});
  document.getElementById("bkQ").addEventListener("input",renderList);
  document.getElementById("bkReload").addEventListener("click",function(){ loadBookings().then(function(){ V.toast("새로 불러왔습니다","ok"); }); });
  document.getElementById("bkCsv").addEventListener("click",function(){
    var head=["신청시각","방문일","시작","종료","상태","회사","담당자","연락처","이메일","방문지","대상설비","진동센서경험","예약코드","메모"];
    var q=function(v){ v=String(v==null?"":v); if(/^[=+\\-@]/.test(v)) v="'"+v; return '"'+v.replace(/"/g,'""')+'"'; };
    var lines=[head.map(q).join(",")].concat(BK.map(function(x){
      return [tsLabel(x.ts),x.d,x.s,x.e,ST[x.status]+(x.test?" (테스트?)":""),x.company,x.name,x.phone,x.email,x.place,x.asset,x.exp,x.code,x.memo].map(q).join(",");
    }));
    var blob=new Blob(["\\ufeff"+lines.join("\\r\\n")],{type:"text/csv;charset=utf-8"});
    var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="visit-bookings-"+new Date().toISOString().slice(0,10)+".csv";
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
  });

  /* ── 예약 알림 받는 사람 (2026-10-13) ── */
  var RCP=[], GEN=[];
  function rcpHint(t,bad){ var h=document.getElementById("rcpHint"); h.textContent=t||""; h.style.color=bad?"var(--danger)":""; }
  function renderRcp(info){
    var box=document.getElementById("rcpList"); box.innerHTML="";
    if(!RCP.length) box.innerHTML='<span class="hint" style="color:var(--danger)">받는 사람이 없습니다. 예약 메일은 일반 문의 담당에게만 갑니다.</span>';
    RCP.forEach(function(x){
      var row=document.createElement("div"); row.className="rcp-row";
      row.innerHTML='<span class="em">'+V.esc(x.email)+'</span>'+(x.name?'<span class="nm">'+V.esc(x.name)+'</span>':'');
      var del=document.createElement("button"); del.type="button"; del.textContent="×"; del.title="삭제";
      del.addEventListener("click",function(){
        if(!confirm(x.email+" 을(를) 예약 알림에서 뺄까요?")) return;
        saveRcp(RCP.filter(function(y){return y.email!==x.email;}),"삭제했습니다");
      });
      row.appendChild(del); box.appendChild(row);
    });
    var g=GEN.length?"일반 문의 담당 "+GEN.join(", ")+" 에게도 함께 갑니다.":"";
    rcpHint(info||g);
  }
  function loadRcp(){
    return fetch("/visit/admin/notify",{cache:"no-store"}).then(function(r){return r.json();})
      .then(function(j){ if(!j||!j.ok) throw 0; RCP=j.list||[]; GEN=j.general||[]; renderRcp(j.isDefault?"기본값입니다. 추가·삭제하면 저장됩니다.":""); })
      .catch(function(){ document.getElementById("rcpList").innerHTML='<span class="hint">불러오지 못했습니다.</span>'; });
  }
  function saveRcp(list,msg){
    return fetch("/visit/admin/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({list:list}),cache:"no-store"})
      .then(function(r){return r.json();})
      .then(function(j){ if(!j||!j.ok) throw 0; RCP=j.list||[]; GEN=j.general||GEN; renderRcp(); V.toast(msg||"저장했습니다","ok"); })
      .catch(function(){ rcpHint("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",true); });
  }
  document.getElementById("rcpAdd").addEventListener("click",function(){
    var em=(document.getElementById("r-email").value||"").trim().toLowerCase();
    var nm=(document.getElementById("r-name").value||"").trim();
    if(!/^[^\\s@<>"',;]+@[^\\s@<>"',;]+\\.[a-z]{2,}$/.test(em)){ rcpHint("이메일 주소를 확인해 주세요.",true); return; }
    if(RCP.some(function(x){return x.email===em;})){ rcpHint("이미 들어 있는 주소입니다.",true); return; }
    saveRcp(RCP.concat([{email:em,name:nm}]),"추가했습니다").then(function(){
      document.getElementById("r-email").value=""; document.getElementById("r-name").value="";
    });
  });
  document.getElementById("rcpTest").addEventListener("click",function(){
    if(!RCP.length){ rcpHint("받는 사람을 먼저 추가해 주세요.",true); return; }
    var b=this; b.disabled=true; rcpHint("보내는 중…");
    fetch("/visit/admin/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({test:true}),cache:"no-store"})
      .then(function(r){return r.json();})
      .then(function(j){ if(j&&j.ok){ rcpHint("테스트 메일을 보냈습니다: "+(j.to||[]).join(", ")); V.toast("테스트 메일 발송","ok"); } else rcpHint("발송 실패: "+((j&&j.error)||"알 수 없음"),true); })
      .catch(function(){ rcpHint("발송 실패: 서버에 닿지 않았습니다.",true); })
      .then(function(){ b.disabled=false; });
  });

  renderHolidays();
  pullFromServer(true);
  loadHolds();
  loadBookings();
  loadRcp();
})();
</script>
</body>
</html>`;
}
