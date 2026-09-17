/** 현장 진단 예약 — 스케줄 관리 화면 인증
 *  서버에서만 검사한다. 브라우저 코드로는 우회할 수 없다.
 *
 *  아이디·비밀번호는 코드에 넣지 않는다. Netlify 환경변수로만 받는다.
 *    VISIT_USER / VISIT_PASS
 *  환경변수가 없으면 아예 잠겨서 아무도 못 들어간다(안전한 기본값).
 *
 *  구조는 /ops 화면의 _ops_auth.mjs 와 같다. 쿠키 이름만 다르다.
 */
import crypto from 'node:crypto';

const USER = process.env.VISIT_USER || '';
const PASS = process.env.VISIT_PASS || '';
const TTL  = 8 * 60 * 60 * 1000;          /* 8시간 뒤 자동 로그아웃 */

const configured = () => !!(USER && PASS);

/* 서명 열쇠는 비밀번호에서 파생 — 별도 환경변수를 더 만들지 않아도 된다 */
function secret() {
  return crypto.createHash('sha256')
    .update(USER + '|' + PASS + '|' + (process.env.SITE_ID || 'monnit-visit'))
    .digest();
}

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function issue() {
  const p = b64u(JSON.stringify({ u: USER, exp: Date.now() + TTL }));
  return p + '.' + sign(p);
}

/* 시간차 공격을 막기 위해 길이가 같을 때만 timingSafeEqual 을 쓴다 */
function eq(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  try { return crypto.timingSafeEqual(A, B); } catch (e) { return false; }
}

function valid(token) {
  if (!configured() || !token) return false;
  const i = String(token).lastIndexOf('.');
  if (i < 1) return false;
  const p = token.slice(0, i), s = token.slice(i + 1);
  if (!eq(s, sign(p))) return false;
  try {
    const o = JSON.parse(unb64u(p).toString('utf8'));
    return o && o.u === USER && typeof o.exp === 'number' && Date.now() < o.exp;
  } catch (e) { return false; }
}

function check(u, p) {
  if (!configured()) return false;
  const okU = eq(String(u || ''), USER);
  const okP = eq(String(p || ''), PASS);
  return okU && okP;
}

function cookieFrom(headers) {
  const raw = (headers && (typeof headers.get === 'function' ? headers.get('cookie') : (headers.cookie || headers.Cookie))) || '';
  const m = /(?:^|;\s*)mk_visit=([^;]+)/.exec(raw);
  return m ? decodeURIComponent(m[1]) : '';
}

const setCookie = t =>
  `mk_visit=${encodeURIComponent(t)}; HttpOnly; Secure; SameSite=Strict; Path=/visit; Max-Age=${TTL / 1000}`;
const clearCookie = () =>
  'mk_visit=; HttpOnly; Secure; SameSite=Strict; Path=/visit; Max-Age=0';

export { configured, issue, valid, check, cookieFrom, setCookie, clearCookie };
