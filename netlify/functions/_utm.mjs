/** 유입 출처 문자열 해석기.
 *
 *  monnit-lead.js 가 남기는 「출처」는 이런 모양이다:
 *    "utm_source=google · utm_medium=cpc · utm_campaign=alarm_0831 · utm_content=01_소방"
 *    "fbclid=IwAR... · utm_content=alarm_carousel"
 *    "ref=https://search.naver.com/..."
 *    "direct"
 *
 *  이미 원장(leads)에 저장돼 있으므로, 읽을 때 풀기만 하면
 *  과거 리드까지 소급해서 소재 단위로 가를 수 있다. */

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
              'gclid', 'gbraid', 'wbraid', 'fbclid', 'naver_ad', 'kakao_ad', 'promo', 'ref'];

export function parseSource(src) {
  const out = {};
  const s = String(src || '');
  /* 구분자는 ' · ' 이지만 과거 데이터를 위해 &, 개행도 받아준다 */
  for (const part of s.split(/\s*·\s*|\s*&\s*|\n/)) {
    const m = part.trim().match(/^([a-z_]+)=([\s\S]*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (KEYS.includes(k)) out[k] = m[2].trim();
  }
  return out;
}

/** 소재 키 — 무엇을 「하나의 소재」로 볼 것인가.
 *  utm_content 가 있으면 그것이 기준이다. 없으면 캠페인, 그마저 없으면 채널.
 *  광고가 아닌 유입은 소재가 아니므로 따로 묶는다. */
export function creativeKey(lead) {
  const u = parseSource(lead && lead.source);
  if (u.utm_content) return u.utm_content;
  if (u.utm_campaign) return u.utm_campaign;
  if (u.gclid || u.gbraid || u.wbraid) return '(구글 · utm 없음)';
  if (u.fbclid) return '(메타 · utm 없음)';
  if (u.naver_ad) return '(네이버 · utm 없음)';
  if (u.kakao_ad) return '(카카오 · utm 없음)';
  /* 검색 유입은 광고인지 자연인지 링크만으로는 못 가른다 — 따로 묶어둔다 */
  if (/search\.naver\.com|m\.search\.naver/.test(u.ref || '')) return '(네이버 검색 유입)';
  if (/google\.[a-z.]+\/search|www\.google\./.test(u.ref || '')) return '(구글 검색 유입)';
  return '(광고 외 유입)';
}

/** 광고 링크 URL 에서 utm_content 를 뽑는다 — 광고 API 쪽 매칭용 */
export function utmContentFromUrl(url) {
  try {
    const q = new URL(String(url)).searchParams;
    return q.get('utm_content') || q.get('utm_campaign') || '';
  } catch { return ''; }
}

/** 광고 유입인지 */
export function isPaid(lead) {
  const u = parseSource(lead && lead.source);
  return !!(u.utm_source || u.gclid || u.gbraid || u.wbraid || u.fbclid || u.naver_ad || u.kakao_ad);
}
