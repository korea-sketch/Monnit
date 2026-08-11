/** 리드 원장 — 사이트 모든 접점의 접수를 한 곳에 기록한다.
 *  · 기록이 실패해도 항상 성공(204)으로 응답한다. 메일 경로가 안전망이다. */
import { append } from './_store.mjs';

export const config = { path: '/api/lead' };

const TYPE_LABEL = { contact: '접수', doc_request: '자료', subscribe: '구독' };

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

export default async (req) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: cors });

  try {
    const body = await req.json();
    const p = body.payload || {};
    const type = ['contact', 'doc_request', 'subscribe'].includes(body.lead_type) ? body.lead_type : 'contact';
    const src = pick(p, ['출처']);

    await append('leads', monthKey(body.ts), {
      ts: body.ts || new Date().toISOString(),
      type, label: TYPE_LABEL[type], channel: channel(src),
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
      ua: String(req.headers.get('user-agent') || '').slice(0, 180)
    });
  } catch (e) { /* 조용히 넘긴다 */ }

  return new Response(null, { status: 204, headers: cors });
};

function monthKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(d);
  return s.slice(0, 7) + '.jsonl';
}
