/** 리드 원장 — 사이트 모든 접점의 접수를 한 곳에 기록한다.
 *
 *  설계 원칙
 *   · 이 함수가 실패해도 리드는 절대 잃지 않는다. 기존 메일 발송은 브라우저에서
 *     별도로 이미 이뤄졌고, 여기서는 "기록"만 담당한다.
 *   · 그래서 어떤 오류가 나도 204(성공)로 응답한다. 화면에 오류를 띄우지 않는다.
 *   · 저장은 월 단위 파일(JSON Lines)에 한 줄씩 이어 붙인다.
 */
const store = require('./_store');

const TYPE_LABEL = { contact: '접수', doc_request: '자료', subscribe: '구독' };

/* 출처 문자열에서 채널을 판별한다 (fbclid/gclid/utm/ref) */
function channel(src) {
  const s = String(src || '').toLowerCase();
  if (/fbclid|facebook|instagram/.test(s)) return '메타';
  if (/gclid|gbraid|wbraid|utm_source=google/.test(s)) return '구글';
  if (/naver/.test(s)) return '네이버';
  if (/utm_source=email/.test(s)) return '이메일';
  if (/utm_source=tel/.test(s)) return '전화문자';
  if (/utm_source=post/.test(s)) return '우편DM';
  if (/kakao/.test(s)) return '카카오';
  if (/^ref=/.test(s)) return '외부유입';
  if (!s || s === 'direct') return '직접';
  return '기타';
}

const pick = (p, keys) => { for (const k of keys) if (p[k]) return String(p[k]); return ''; };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const p = body.payload || {};
    const type = ['contact', 'doc_request', 'subscribe'].includes(body.lead_type) ? body.lead_type : 'contact';
    const src = pick(p, ['출처']);

    const row = {
      ts: body.ts || new Date().toISOString(),
      type,
      label: TYPE_LABEL[type],
      channel: channel(src),
      point: pick(p, ['접점']) || String(body.page || ''),
      company: pick(p, ['회사명', '회사/시설명', '이름/회사명', '교회명/성함']),
      name: pick(p, ['담당자명', '이름/직급']),
      phone: pick(p, ['전화번호', '연락처']),
      email: pick(p, ['이메일']),
      region: pick(p, ['사업장 지역', '지역']),
      asset: pick(p, ['주요 회전설비', '시설 유형', '산업군', '교회 규모']),
      interest: pick(p, ['관심분야', '백서명', '신청 프로모션', '문의항목']),
      source: src,
      landing: pick(p, ['유입 페이지']),
      consent_mkt: pick(p, ['마케팅 정보 수신(선택)']),
      ua: (event.headers && (event.headers['user-agent'] || '')).slice(0, 180)
    };

    const d = new Date(row.ts);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}.jsonl`;
    await store.append('leads', key, row);
  } catch (e) {
    /* 기록 실패는 조용히 넘긴다 — 메일 경로가 안전망이다 */
  }
  return { statusCode: 204, headers: cors(), body: '' };
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
}
