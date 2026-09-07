/** 리드 원장 — 사이트 모든 접점의 접수를 한 곳에 기록한다.
 *  · 기록이 실패해도 항상 성공(204)으로 응답한다. 메일 경로가 안전망이다. */
import { append } from './_store.mjs';
import { notify } from './_notify.mjs';
import { pushLead } from './_monday.mjs';
import _valid from '../../valid.js';
const VALID = _valid.MonnitValid;

export const config = { path: '/api/lead' };

const TYPE_LABEL = { contact: '접수', doc_request: '자료', subscribe: '구독' };

function channel(src) {
  const s = String(src || '').toLowerCase();
  /* utm_source 는 우리가 광고 URL 에 직접 박는 값이라 표기가 제각각이다.
     meta / facebook / fb / ig 를 모두 메타로 본다 — 예전에는 utm_source=meta 가
     아무 데도 안 걸려서 「기타」로 떨어졌다. */
  if (/fbclid|facebook|instagram|utm_source=(meta|fb|ig)\b/.test(s)) return '메타';
  if (/gclid|gbraid|wbraid|utm_source=(google|youtube|gdn)\b/.test(s)) return '구글';
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

    const _co = pick(p, ['회사명', '회사/시설명', '이름/회사명', '교회명/성함']);
    const _nm = pick(p, ['담당자명', '이름/직급']);
    const _ph = pick(p, ['전화번호', '연락처']);
    const _em = pick(p, ['이메일']);
    /* 신원 정보가 전혀 없으면 껍데기 행이므로 기록하지 않는다 (서버 쪽 2차 방어) */
    const _clean = v => String(v || '').replace(/[()미기재\s]/g, '');
    if (!_clean(_co) && !_clean(_nm) && !_clean(_ph) && !_clean(_em))
      return new Response(null, { status: 204, headers: cors });

    /* 형식이 틀린 연락처는 기록해도 연락이 닿지 않는다.
       메일은 이미 나갔으므로 접수를 버리지 않고 원장에 표시만 남긴다. */
    const _emOk  = _em ? VALID.email(_em).ok : true;
    const _phChk = _ph ? VALID.phone(_ph, { required: false }) : { ok: true };
    const _flags = [];
    if (_em && !_emOk) _flags.push('이메일형식');
    if (_ph && !_phChk.ok) _flags.push('연락처형식');

    const lead = {
      ts: body.ts || new Date().toISOString(),
      type, label: TYPE_LABEL[type], channel: channel(src),
      point: pick(p, ['접점']) || String(body.page || ''),
      company: _co,
      name: _nm,
      phone: (_phChk.ok && _phChk.value) ? _phChk.value : _ph,
      email: _em,
      region: pick(p, ['사업장 지역', '지역']),
      asset: pick(p, ['예약 희망 제품', '주요 회전설비', '시설 유형', '산업군', '교회 규모']),
      product: pick(p, ['예약 희망 제품']),
      interest: pick(p, ['관심분야', '백서명', '신청 프로모션', '문의항목']),
      /* /promo/consulting 사전 자격 문항 — 없는 폼에서는 그냥 빈 값이다 */
      exp:       pick(p, ['진동센서 경험']),
      exp_group: pick(p, ['경험 구분']),
      line:      pick(p, ['설치 대상 라인']),
      spot:      pick(p, ['설비 위치']),
      sla:       pick(p, ['연락 예정']),
      memo: pick(p, ['문의 사항', '문의내용']),
      flags: _flags.join(','),
      source: src,
      landing: pick(p, ['유입 페이지']),
      consent_mkt: pick(p, ['마케팅 정보 수신(선택)']),
      ua: String(req.headers.get('user-agent') || '').slice(0, 180)
    };

    /* 원장 기록이 먼저다 — 뒤의 알림·연동이 실패해도 데이터는 남아야 한다 */
    await append('leads', monthKey(body.ts), lead);

    const id = lead.ts + '|' + (lead.email || lead.phone || lead.company || '');

    /* 접수 한 건에 두 가지가 같이 일어난다. 하나가 실패해도 나머지는 진행한다.
         · 알림 메일  → 0702yeom@gmail.com (StaticForms → Web3Forms → Brevo 순)
         · 먼데이     → 리드 원장 보드에 아이템 생성
       원장(ops) 기록은 바로 위에서 이미 끝났다.

       고객에게 나가는 응대 메일은 여기서 보내지 않는다.
       백서는 sendpw.js, 컨설팅 무경험자는 sendguide.js 가 각각 보낸다
       (둘 다 답장 주소가 korea@monnit.com).
       알리미·일반 문의는 고객 회신 없이 알림만 나간다 — 2026-09-07 확정. */
    await Promise.allSettled([ notify(lead, p), pushLead(id, lead) ]);
  } catch (e) { /* 조용히 넘긴다 */ }

  return new Response(null, { status: 204, headers: cors });
};

function monthKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(d);
  return s.slice(0, 7) + '.jsonl';
}
