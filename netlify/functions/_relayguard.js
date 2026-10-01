/** 공개 메일 발송 함수(sendpw · sendguide) 앞단 보호 — 2026-09-18
 *
 *  두 함수는 브라우저가 직접 부르므로 토큰을 페이지 소스에 실을 수밖에 없다.
 *  즉 토큰은 자물쇠가 아니다. 실제로 막아야 하는 것은 이 두 가지다.
 *
 *    ① 남의 사이트·스크립트에서 부르는 것   → 요청 출처(Origin/Referer) 검사
 *    ② 같은 곳에서 계속 부르는 것            → IP·이메일별 횟수 제한
 *
 *  ①은 「출처가 붙어 있는데 우리 것이 아닐 때」만 막는다. 출처 헤더가 아예
 *  없는 요청(구형 브라우저·일부 인앱 브라우저)까지 막으면 진짜 리드를 잃는다.
 *  대신 그런 요청은 ②에서 더 엄격한 한도를 적용한다.
 *
 *  ②는 Netlify Blobs 에 시도 한 건씩 파일로 남기고 개수를 세는 방식이다.
 *  「읽고 더해서 쓰기」가 아니라서 동시에 들어와도 카운트가 덮이지 않는다.
 *  저장소를 못 읽으면 통과시킨다 — 발송이 막히는 것보다 낫다.
 */
const crypto = require('crypto');

/* ── 허용 출처 ──────────────────────────────────────────────────────── */
const SITE_HOSTS = ['monnit.co.kr', 'www.monnit.co.kr'];

function hostOf(u) { try { return new URL(String(u)).host.toLowerCase(); } catch (e) { return ''; } }
function headerOf(headers, k) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(k) || '');
  return String(headers[k] || headers[k.toLowerCase()] || '');
}
const envHost = k => { try { return new URL(process.env[k] || '').hostname.toLowerCase(); } catch (e) { return ''; } };
function allowedHosts() {
  /* 우리 사이트를 다른 주소로도 서비스하거나, 외부에 올린 랜딩에서 이 함수를
     불러야 하면 Netlify 환경변수 RELAY_ORIGINS 에 도메인을 쉼표로 적는다. */
  const extra = String(process.env.RELAY_ORIGINS || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  return SITE_HOSTS
    .concat([envHost('URL'), envHost('DEPLOY_URL'), envHost('DEPLOY_PRIME_URL')])
    .concat(extra.map(h => hostOf(h.includes('://') ? h : 'https://' + h) || h.toLowerCase()))
    .filter(Boolean);
}
function hostAllowed(h) {
  if (!h) return false;
  /* 배포 미리보기(deploy preview)도 우리 사이트다 */
  return allowedHosts().includes(h) || /(^|\.)netlify\.app$/.test(h) || h === 'localhost' || /^localhost:/.test(h);
}

/** 'ours' 우리 출처 · 'foreign' 남의 출처 · 'unknown' 출처 헤더 없음
 *  판정 순서는 /api/proposal(proposal-api.mjs 의 sameOrigin)과 같게 맞춘다. */
function originKind(headers) {
  /* 브라우저가 스스로 알려주는 값 — 남의 페이지에서 부른 요청이면 여기서 끝난다 */
  if (headerOf(headers, 'sec-fetch-site') === 'cross-site') return 'foreign';

  const raw = headerOf(headers, 'origin');
  if (raw) {
    /* Origin: null (샌드박스 iframe·data: 문서 등)은 주소가 없다는 뜻이라 우리 것이 아니다 */
    const o = hostOf(raw);
    return o && hostAllowed(o) ? 'ours' : 'foreign';
  }
  const r = hostOf(headerOf(headers, 'referer'));
  if (r) return hostAllowed(r) ? 'ours' : 'foreign';
  return 'unknown';
}

/** CORS 응답 헤더 — 예전에는 '*' 라 어느 사이트에서든 부를 수 있었다. */
function corsHeaders(headers, extra) {
  const origin = headerOf(headers, 'origin');
  const ok = origin && hostAllowed(hostOf(origin));
  return Object.assign({
    'Access-Control-Allow-Origin': ok ? origin : 'https://monnit.co.kr',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  }, extra || {});
}

/* ── 메일 본문에 들어갈 값 소독 ───────────────────────────────────────
   이름·회사명이 그대로 본문에 박히는데 줄바꿈이 살아 있으면 남의 이름으로
   문단을 통째로 끼워 넣을 수 있다(우리 도메인에서 나가는 피싱 메일이 된다). */
function clean(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\r\n\u2028\u2029]+/g, ' ')        /* 줄바꿈 제거 */
    .replace(/[\u0000-\u001F\u007F]/g, '')       /* 제어문자 제거 */
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max || 80);
}

/* ── 횟수 제한 ──────────────────────────────────────────────────────── */
let _getStore = null;
async function store() {
  if (!_getStore) { const m = await import('@netlify/blobs'); _getStore = m.getStore; }
  return _getStore({ name: 'ops', consistency: 'strong' });
}
const hourKey = t => new Date(t).toISOString().slice(0, 13);   /* YYYY-MM-DDTHH */
const dayKey  = t => new Date(t).toISOString().slice(0, 10);
const tag = s => crypto.createHash('sha256').update(String(s || '')).digest('hex').slice(0, 16);

async function countPrefix(s, prefix) {
  const r = await s.list({ prefix });
  return ((r && r.blobs) || []).length;
}

/** 한도를 넘었으면 true. 저장소 오류면 항상 false(통과). */
async function tooMany({ ip, email, kind }) {
  try {
    const s = await store();
    const now = Date.now();
    const ipTag = tag(ip || 'unknown');
    const emTag = tag(String(email || '').toLowerCase());

    /* 출처 헤더가 없는 요청은 한도를 절반으로 죈다 */
    const strict = kind === 'unknown';
    const HOUR_MAX = strict ? 3 : 6;
    const DAY_MAX  = strict ? 8 : 20;
    const EMAIL_MAX = 3;

    const [h, d, e] = await Promise.all([
      countPrefix(s, 'relay/h/' + hourKey(now) + '/' + ipTag + '/'),
      countPrefix(s, 'relay/d/' + dayKey(now) + '/' + ipTag + '/'),
      countPrefix(s, 'relay/e/' + dayKey(now) + '/' + emTag + '/')
    ]);
    if (h >= HOUR_MAX || d >= DAY_MAX || e >= EMAIL_MAX) return true;

    const stamp = now + '-' + crypto.randomBytes(3).toString('hex');
    await Promise.all([
      s.setJSON('relay/h/' + hourKey(now) + '/' + ipTag + '/' + stamp, { t: now }),
      s.setJSON('relay/d/' + dayKey(now) + '/' + ipTag + '/' + stamp, { t: now }),
      s.setJSON('relay/e/' + dayKey(now) + '/' + emTag + '/' + stamp, { t: now })
    ]);
    return false;
  } catch (err) {
    return false;
  }
}

/** 오래된 횟수 기록 정리 — 다른 정리 작업에서 함께 부르면 된다 */
async function sweep(keepDays = 3) {
  try {
    const s = await store();
    const cutH = new Date(Date.now() - keepDays * 86400000).toISOString().slice(0, 13);
    const cutD = cutH.slice(0, 10);
    const r = await s.list({ prefix: 'relay/' });
    let n = 0;
    for (const b of (r && r.blobs) || []) {
      const part = b.key.split('/')[2] || '';
      const old = b.key.startsWith('relay/h/') ? part < cutH : part < cutD;
      if (old) { await s.delete(b.key); n++; }
    }
    return n;
  } catch (e) { return 0; }
}

module.exports = { originKind, corsHeaders, clean, tooMany, sweep, hostAllowed };
