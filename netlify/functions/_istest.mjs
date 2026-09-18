/** 내부 테스트 접수 판정 — 단 하나의 규칙 (2026-09-18)
 *
 *  사이트를 고칠 때마다 우리 손으로(또는 자동 테스트가) 접수를 넣는다.
 *  그게 리드로 잡히면 건수·전환율·CAC 가 전부 어긋난다. 2026-09-07 에 실제로 그랬고,
 *  2026-09-18 에는 자동 테스트가 담당자 메일함으로 가짜 접수 10여 건을 보냈다.
 *
 *  그래서 ops.mjs · _monday.mjs · lead.mjs · proposal-api.mjs 가 모두 이 파일 하나를 쓴다.
 *  (판정이 갈라지면 「원장에선 빠졌는데 보드에는 남는」 상태가 되고, 그게 제일 찾기 어렵다.
 *   tools/test-testlead.mjs 가 두 곳의 판정이 같은지 매번 확인한다.)
 *
 *  ── 테스트로 보는 것 ─────────────────────────────────────────────
 *    ① 이메일이 @monnit.com          — 우리 회사 주소로는 문의가 들어오지 않는다
 *    ② 접점이 /ops…                   — 관제 화면에서 직접 찌른 점검
 *    ③ 회사명·성함·메모에 test / 테스트
 *    ④ 접속 IP 가 루프백(127.0.0.1 · ::1)              ← 2026-09-18 추가
 *    ⑤ 유입 페이지가 localhost · 127.0.0.1 · 사설망      ← 2026-09-18 추가
 *    ⑥ 요청 본문에 test: true                           ← 2026-09-18 추가
 *  (test: false 는 「실제 접수처럼 다뤄 달라」는 뜻 — 알림·원장 경로 자체를
 *   검증하는 자동 테스트만 쓴다. 브라우저에서 오는 요청에는 이 값이 없다.)
 *
 *  ── 오탐하지 않는 것 ─────────────────────────────────────────────
 *    monnit.co.kr · monnit.com.tw 는 남의 주소다 · Testo 는 실제 센서 회사다 ·
 *    latest · contest 같은 단어는 test 로 보지 않는다(\btest\b).
 */

/** 자동 테스트가 쓰는 대표 계정 — 사람이 볼 때 바로 알아보라고 하나로 통일했다 */
export const TEST_EMAIL = process.env.MONNIT_TEST_EMAIL || '1004@monnit.com';
export const TEST_NAME  = process.env.MONNIT_TEST_NAME  || '조한준';
export const TEST_TAG   = '[테스트]';

const LOOPBACK = /^(::1|::ffff:127\.|127\.|0\.0\.0\.0$)/;

export const isLoopback = ip => LOOPBACK.test(String(ip || ''));
/** 유입 페이지가 개발용 주소인가 — 호스트만 떼어 본다 */
export function isDevUrl(u) {
  let h = String(u || '').trim();
  if (!h) return false;
  h = h.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].split('@').pop();
  h = h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1') return true;
  if (/\.local$/.test(h)) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true;
  return false;
}

/** 기존 규칙 — ops.mjs · _monday.mjs 가 쓰던 것 그대로다 */
export function isTestLead(r) {
  if (!r) return false;
  const em = String(r.email || '').trim().toLowerCase();
  if (/@monnit\.com$/.test(em)) return true;
  if (/^\/ops/.test(String(r.point || ''))) return true;
  if (/\btest\b|테스트/i.test([r.company, r.name, r.memo].filter(Boolean).join(' '))) return true;
  return false;
}

/** 접수 경로에서 쓰는 판정 — 위 규칙 + 접속 환경 */
export function isTest(x = {}) {
  if (x.flag === true) return true;
  if (x.flag === false) return false;          /* 「실제처럼 다뤄 달라」 — 자동 테스트 전용 */
  if (isLoopback(x.ip)) return true;
  if (isDevUrl(x.landing)) return true;
  return isTestLead(x);
}

/** 담당자 눈에 바로 테스트로 보이도록 회사명 앞에 표시를 붙인다 */
export const tag = s => {
  const v = String(s == null ? '' : s);
  return v.indexOf(TEST_TAG) >= 0 ? v : (TEST_TAG + ' ' + v).trim();
};
