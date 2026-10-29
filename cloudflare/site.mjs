/* ============================================================
   정적 사이트 규칙 — 리다이렉트 · 예쁜 주소(.html 생략) · 헤더 · 404
   ------------------------------------------------------------
   적용 규칙
   · 리다이렉트: _redirects → cloudflare/site-rules.toml 순, 위에서부터 첫 일치
       - 강제(!) 가 아니면, 그 주소에 파일이 있을 때 규칙을 건너뜀(shadowing)
       - 200 = 주소는 그대로 두고 다른 파일을 보여 줌, 404 = 지정 파일을 404 로
   · 예쁜 주소
       /a       → a.html 이 있으면 그대로 보여 줌,  a/index.html 이 있으면 301 /a/
       /a/      → a/index.html 이 있으면 보여 줌,  a.html 만 있으면 301 /a
   · 헤더: _headers → site-rules.toml [[headers]] 의 일치 규칙을 모두 합침(같은 이름은 뒤 규칙)
           함수 응답에는 붙이지 않음
   ============================================================ */
import SITE from './generated/site.json';

const FILES = new Set(SITE.files);

const safeDecode = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const escRe = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/* "/promo/*" · "/a/:id" → 정규식 */
function compileFrom(from) {
  const names = [];
  let src = '';
  const parts = from.split('/');
  parts.forEach((seg, i) => {
    if (i === 0) return;
    if (seg === '*') {                         /* 끝의 * — 앞 슬래시까지 선택적으로 */
      src += '(?:/(.*))?'; names.push('splat'); return;
    }
    src += '/';
    if (seg.startsWith(':')) { src += '([^/]+)'; names.push(seg.slice(1)); return; }
    if (seg.includes('*')) { src += seg.split('*').map(escRe).join('(.*)'); names.push('splat'); return; }
    src += escRe(seg);
  });
  if (from === '/') src = '/';
  return { re: new RegExp('^' + src + '/?$'), names };
}
const REDIRECTS = SITE.redirects.map(r => {
  let host = null, from = r.from;
  if (/^https?:\/\//.test(from)) { const u = new URL(from); host = u.host; from = u.pathname; }
  return { ...r, host, ...compileFrom(from) };
});

/* "/a/*" 는 "/a" 자체도 포함, 끝 슬래시는 있어도 없어도 같은 주소 */
function compileHeaderFor(f) {
  let tail = '/?';
  let body = f;
  if (body.endsWith('/*')) { body = body.slice(0, -2); tail = '(?:/.*)?'; }
  else if (body.length > 1 && body.endsWith('/')) body = body.slice(0, -1);
  const re = '^' + body.split('*').map(p => p.split(/:[a-zA-Z_]\w*/).map(escRe).join('[^/]+')).join('.*') + tail + '$';
  return new RegExp(re);
}
const HEADERS = SITE.headers.map(h => ({ re: compileHeaderFor(h.for), values: h.values }));

export function headersFor(pathname) {
  const out = {};
  const cands = new Set([pathname, safeDecode(pathname)]);
  for (const h of HEADERS) {
    let hit = false; for (const p of cands) if (h.re.test(p)) { hit = true; break; }
    if (!hit) continue;
    for (const [k, v] of Object.entries(h.values)) out[k.toLowerCase()] = { name: k, value: v };
  }
  return out;
}
/* 기본값 (규칙이 없을 때) */
const DEFAULT_CACHE = 'public, max-age=0, must-revalidate';
export const DEFAULT_HSTS = 'max-age=31536000';
export function applyHeaders(res, pathname) {
  const hs = headersFor(pathname);
  const r = new Response(res.body, res);
  for (const { name, value } of Object.values(hs)) r.headers.set(name, value);
  if (!r.headers.has('cache-control')) r.headers.set('cache-control', DEFAULT_CACHE);
  if (!r.headers.has('strict-transport-security')) r.headers.set('strict-transport-security', DEFAULT_HSTS);
  return r;
}

/** 주소 → 파일 찾기. { file } | { redirect } | null */
export function resolveStatic(pathname) {
  const p = safeDecode(pathname);
  if (p.includes('/../') || p.startsWith('/__private')) return null;
  if (p.endsWith('/')) {
    if (FILES.has(p + 'index.html')) return { file: p + 'index.html' };
    const bare = p.slice(0, -1);
    if (bare && FILES.has(bare + '.html')) return { redirect: bare };
    if (bare && FILES.has(bare)) return { redirect: bare };
    return null;
  }
  if (FILES.has(p)) return { file: p };
  if (FILES.has(p + '.html')) return { file: p + '.html' };
  if (FILES.has(p + '/index.html')) return { redirect: p + '/' };
  return null;
}

/** 리다이렉트 규칙 중 첫 일치 */
export function matchRedirect(url) {
  const raw = url.pathname, dec = safeDecode(raw);
  for (const r of REDIRECTS) {
    if (r.host && r.host !== url.host) continue;
    const m = r.re.exec(raw) || r.re.exec(dec);
    if (!m) continue;
    const vars = {};
    r.names.forEach((n, i) => { vars[n] = m[i + 1] || ''; });
    if (!r.force && resolveStatic(raw)) continue;           /* 파일이 있으면 규칙보다 파일 */
    let to = r.to.replace(/:splat/g, vars.splat || '').replace(/:([a-zA-Z_]\w*)/g, (s, n) => (n in vars ? vars[n] : s));
    return { ...r, to };
  }
  return null;
}

export const SITE_FILES = FILES;
