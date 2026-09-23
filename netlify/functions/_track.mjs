/** 유입·경로 기록 공통 — track.mjs(기록) · flowadmin.mjs(관제)가 같이 쓴다 (2026-09-23) */
export const POPUP_KEY = 'popup.json';
export const POPUP_DEFAULT = { on: true };

/* monnit-lead.js 출처 문자열 → 채널 (lead.mjs 와 같은 규칙) */
export function channel(src) {
  const s = String(src || '').toLowerCase();
  if (/fbclid|facebook|instagram|utm_source=(meta|fb|ig)\b/.test(s)) return '메타';
  if (/gclid|gbraid|wbraid|utm_source=(google|youtube|gdn)\b|ref=([a-z0-9-]+\.)*(google|youtube)\./.test(s)) return '구글';
  if (/naver/.test(s)) return '네이버';
  if (/kakao|daum\.net/.test(s)) return '카카오';
  if (/utm_source=email/.test(s)) return '이메일';
  if (/utm_source=tel/.test(s)) return '전화문자';
  if (/utm_source=post/.test(s)) return '우편DM';
  if (/ref=([a-z0-9-]+\.)*(bing|duckduckgo|yahoo|zum)\./.test(s)) return '기타검색';
  if (/(^|· )ref=/.test(s)) return '외부유입';
  if (!s || s === 'direct') return '직접';
  if (/^from=|· from=/.test(s) && !/utm_/.test(s)) return '직접';
  return '기타';
}

