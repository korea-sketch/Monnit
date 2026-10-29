/** 담당자 알림 메일 「필수 수신자」 — 한 곳에서만 정한다 (2026-10-28 대표 지시)
 *
 *  「이메일 알람은 예지보전 가이드 말고는 1015@monnit.com 을 무조건 넣는다」
 *
 *  사이트에서 담당자에게 나가는 모든 알림 메일(문의 접수 · 프로모션 · 자료 신청 · 구독 · 현장진단 예약 ·
 *  맞춤 제안서 · 알리미 계약·SLA·설문 · 사이트 장애 경보 · 누락 복구)의 받는 사람에 이 주소를 항상 더한다.
 *  환경변수로 다른 주소를 넣어도 이 주소는 빠지지 않는다.
 *
 *  예외 — 예지보전 가이드
 *    · 자료 신청 중 「예지보전 제안 가이드」 (가이드 랜딩 · 백서 다운로드)
 *    · /promo/consulting 무경험(처음) 신청 — 가이드가 고객에게 자동 발송되는 건
 *  예외 건은 이 규칙이 강제하지 않는다(기존 동작 유지).
 *
 *  환경변수
 *    STAFF_MUST_TO   필수 수신자. 쉼표로 여러 명. 기본 1015@monnit.com
 *                    ※ 비워 둬도 기본값이 들어간다 — 「무조건」이므로 끄는 스위치는 두지 않는다.
 */
const env = (k, d = '') => {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/;
const split = s => String(s || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => EMAIL_RE.test(x));

export const DEFAULT_MUST = '1015@monnit.com';

/** 필수 수신자 목록 — 항상 1명 이상 */
export function mustTo() {
  const l = split(env('STAFF_MUST_TO', DEFAULT_MUST));
  return l.length ? l : [DEFAULT_MUST];
}

/** 자료 신청 「예지보전 제안 가이드」 인가 */
export function isGuideDoc(lead, payload) {
  const p = payload || {};
  const s = [lead && lead.interest, p['관심분야'], p['백서명'], lead && lead.point].map(v => String(v || '')).join(' ');
  return /예지보전\s*(제안\s*)?가이드/.test(s);
}

/** 무경험 신청 — 가이드 자동 발송 건 */
export function isGuideExp(lead, payload) {
  const p = payload || {};
  return String((lead && lead.exp_group) || p['경험 구분'] || '').trim() === '무경험';
}

/** 「예지보전 가이드」 예외인가 */
export const isGuide = (lead, payload) => isGuideDoc(lead, payload) || isGuideExp(lead, payload);

/** 받는 사람 목록에 필수 수신자를 더한다. 입력은 문자열(쉼표)·배열 모두 받는다. 순서 유지 · 중복 제거. */
export function withMust(list, opts) {
  const base = Array.isArray(list) ? list.flatMap(split) : split(list);
  if (opts && opts.guide) return [...new Set(base)];
  return [...new Set([...base, ...mustTo()])];
}
