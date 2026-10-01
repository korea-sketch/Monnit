/** 리드 원장 — 사이트 모든 접점의 접수를 한 곳에 기록한다.
 *  · 기록이 실패해도 항상 성공(204)으로 응답한다. 메일 경로가 안전망이다. */
import { append } from './_store.mjs';
import { notify } from './_notify.mjs';
import { pushLead } from './_monday.mjs';
import * as _test from './_istest.mjs';
import { sendAlarmReply } from './_alarmmail.mjs';
import _valid from '../../valid.js';
import _guard from './_guard.js';   /* 경쟁사 차단 (2026-09-16) */
import _docmap from './_docmap.js';   /* siteBase — 메일 링크 주소 검증 */
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

  let body = null;

  try {
    /* 본문 크기 제한 — 없으면 누구나 큰 덩어리를 보내 저장소를 채울 수 있다. (2026-09-18) */
    const _raw = await req.text();
    if (_raw.length > 32000) return new Response(null, { status: 413, headers: cors });
    body = JSON.parse(_raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return new Response(null, { status: 400, headers: cors });
    const p = (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) ? body.payload : {};
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

    /* ── 경쟁사 차단 (2026-09-16) ──────────────────────────────────────
       차단 대상은 리드 원장·먼데이·자동 응답에 올리지 않고 차단 기록에만 남긴다.
       브라우저에는 평소처럼 204 를 준다. */
    const _blk = await _guard.guard(req.headers, {
      email: _em, company: _co, name: _nm, phone: _ph,
      title: pick(p, ['관심분야', '백서명', '신청 프로모션', '문의항목']) || String(body.page || '')
    }, 'lead');
    if (_blk) return new Response(null, { status: 204, headers: cors });

    const lead = {
      ts: safeTs(body.ts),
      type, label: TYPE_LABEL[type], channel: channel(src),
      point: pick(p, ['접점']) || String(body.page || ''),
      company: _co,
      name: _nm,
      phone: (_phChk.ok && _phChk.value) ? _phChk.value : _ph,
      email: _em,
      region: pick(p, ['사업장 지역', '지역']),
      asset: pick(p, ['예약 희망 제품', '주요 회전설비', '시설 유형', '산업군', '교회 규모']),
      product: pick(p, ['알리미 모델', '예약 희망 제품']),
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
      ua: String(req.headers.get('user-agent') || '').slice(0, 180),
      /* 접속 IP — 나중에 경쟁사로 밝혀지면 /ops/block 에서 이 값으로 바로 막는다 (2026-09-16) */
      ip: _guard.ipOf(req.headers)
    };

    /* ── 테스트 접수 분리 (2026-09-18) ────────────────────────────────
       자동 테스트가 만든 가짜 접수는 실제 문의와 섞이면 안 된다.
       다만 「원장에서 아예 빼는 것」과 「집계·보드에서 빼는 것」을 구분한다.

         · isCertainTest — 접속 환경이 우리 것임이 분명할 때(로컬·개발 주소·
           회사 메일·관제 점검·명시 플래그). 원장에 남기지 않고 leads-test 로 옮긴다.
         · 그 밖의 「테스트」 글자만 걸린 건 — 원장에는 그대로 남긴다.
           우리는 센서 회사라 「센서 테스트 해보고 싶습니다」 같은 진짜 문의가 흔하다.
           예전처럼 집계·먼데이에서만 빠진다(ops.mjs · _monday.mjs 의 isTestLead). */
    const _env = { ip: lead.ip, landing: lead.landing, email: lead.email, point: lead.point,
      company: lead.company, name: lead.name, memo: lead.memo,
      flag: typeof body.test === 'boolean' ? body.test : undefined };
    if (_test.isCertainTest(_env)) {
      lead.test = true;
      lead.company = _test.tag(lead.company);
      await append('leads-test', monthKey(safeTs(body.ts)), lead).catch(() => {});
      return new Response(null, { status: 204, headers: cors });
    }
    if (_test.isTest(_env)) lead.test = true;   /* 원장에는 남기되 표시만 해 둔다 */

    /* 원장 기록이 먼저다 — 뒤의 알림·연동이 실패해도 데이터는 남아야 한다 */
    await append('leads', monthKey(safeTs(body.ts)), lead);

    const id = lead.ts + '|' + (lead.email || lead.phone || lead.company || '');

    /* 접수 한 건에 두 가지가 같이 일어난다. 하나가 실패해도 나머지는 진행한다.
         · 알림 메일  → 0702yeom@gmail.com (StaticForms → Web3Forms → Brevo 순)
         · 먼데이     → 리드 원장 보드에 아이템 생성
       원장(ops) 기록은 바로 위에서 이미 끝났다.

       고객에게 나가는 응대 메일은 접점마다 다르다.
         · 백서              → sendpw.js
         · 컨설팅 무경험자   → sendguide.js
         · 알리미 4종        → 아래 sendAlarmReply (2026-09-08 추가)
       모두 답장 주소가 korea@monnit.com 이다.
       알리미 자동 응답은 '알리미 모델'이 잡히고 이메일 형식이 맞을 때만 나간다.
       실패해도 원장·알림에는 영향이 없다 (allSettled + 내부 try). */
    /* 요청 머리글의 주소는 이 사이트일 때만 쓴다 — 남의 주소가 고객 메일의 링크로 들어가지 않게 */
    const _hdrOrigin = req.headers.get('origin') || req.headers.get('referer') || '';
    const _origin = _hdrOrigin ? _docmap.siteBase(_hdrOrigin) : undefined;

    /* 브라우저가 이미 알림 메일을 보냈으면 서버는 보내지 않는다 → 총 1통.
       monnit-lead.js 의 record() 가 notified 플래그를 함께 보낸다.
       2026-09-08 : 이 값을 읽지 않고 있어서 /promo/alarm 접수마다 알림이 두 통씩 갔다.
         · [프로모션 사전신청] …  ← 브라우저가 StaticForms 로 보낸 것
         · [모넷·접수] …          ← 여기 notify() 가 보낸 것
       고객 응대 메일(sendAlarmReply)은 서버만 보내므로 이 조건과 무관하게 항상 나간다. */
    const _browserSent = body.notified === true;

    const [_notified, , _reply] = await Promise.allSettled([
      _browserSent ? Promise.resolve({ ok: true, via: 'browser' }) : notify(lead, p),
      pushLead(id, lead),
      sendAlarmReply({ product: lead.product || lead.interest, email: lead.email, name: lead.name, origin: _origin })
    ]);
    /* 나갔는지 안 나갔는지는 따로 남긴다 — 2026-09-04 사고의 교훈.
       리드 원장(leads)은 이미 위에서 기록이 끝났으므로 건드리지 않는다.
       같은 파일을 두 번 쓰면 동시 접수 때 한 건이 덮여 사라진다. */
    /* ── 알림이 진짜로 나갔는지 남긴다 (2026-09-09) ────────────────────
       notify() 는 { ok, via, tried } 를 돌려주는데 그동안 아무도 안 읽고 버렸다.
       그래서 「서버는 접수를 받았는데 발송처 세 곳이 전부 죽어 아무도 못 받은」
       상황이 어디에도 안 남는다. /api/lead 는 기록 실패와 무관하게 204 를 주므로
       브라우저도 그 사실을 모르고, 자기 백업 경로(StaticForms)를 쓰지 않는다.
       원장에는 접수가 남으니 리드를 잃지는 않지만, 「왜 알림이 안 오지」를
       함수 로그를 뒤져야만 알 수 있었다. 이제 /ops/automail 에서 바로 보인다. */
    try {
      const nv = (_notified && _notified.status === 'fulfilled') ? _notified.value : null;
      await append('ops', 'notify-' + monthKey(safeTs(body.ts)), {
        ts: lead.ts,
        ok: !!(nv && nv.ok),
        via: (nv && nv.via) || '',                       /* browser · staticforms · web3forms · brevo */
        tried: (nv && nv.tried) ? String(nv.tried) : '',  /* 어디까지 시도했는가 */
        browser: _browserSent,                            /* 브라우저가 이미 보냈다고 한 건 */
        point: lead.point || '', company: lead.company || ''
      });
    } catch (e) { /* 관측용 기록이 접수를 막으면 안 된다 */ }

    if (_reply && _reply.status === 'fulfilled' && _reply.value) {
      const r = _reply.value;
      await append('ops', 'automail-' + monthKey(safeTs(body.ts)), {
        ts: lead.ts, email: lead.email, product: r.product || lead.product || '',
        sent: !!r.sent, note: r.skipped || r.error || ''
      }).catch(() => {});
    }
  } catch (e) {
    /* 조용히 넘기되 흔적은 남긴다 (2026-09-18).
       전에는 여기서 오류가 나면 접수가 소리 없이 사라져, 「메일은 왔는데 원장에는 없는」
       상태를 함수 로그를 뒤져야만 알 수 있었다. 이제 /ops 에서 바로 보인다. */
    console.error('[lead] 접수 처리 실패', e);
    try {
      await append('ops', 'lead-failed-' + monthKey(safeTs(body && body.ts)), {
        ts: new Date().toISOString(), error: String(e && e.message || e).slice(0, 200),
        page: String((body && body.page) || ''),
        company: String(((body && body.payload) || {})['회사명'] || ''),
        email: String(((body && body.payload) || {})['이메일'] || ''),
        phone: String(((body && body.payload) || {})['연락처'] || ''),
        raw: JSON.stringify(body || {}).slice(0, 1800)   /* 손으로 복구할 수 있게 원문을 남긴다 */
      });
    } catch (e2) { /* 여기까지 실패하면 함수 로그만 남는다 */ }
  }

  return new Response(null, { status: 204, headers: cors });
};

/** 접수 시각 — 화면이 보낸 값을 그대로 믿지 않는다. (2026-09-18)
 *  예전에는 body.ts 를 그대로 썼다. 과거 날짜를 넣으면 원장에는 저장되지만
 *  /ops 조회 범위 밖이라 영영 보이지 않았고, 날짜가 아닌 값이면 월 키를 만들다
 *  예외가 나 접수가 통째로 사라졌다.
 *  이제 「진짜 날짜이고, 지금에서 이틀 안쪽일 때」만 받아들이고 아니면 서버 시각을 쓴다.
 *  (시계가 조금 어긋난 기기·느린 전송은 살리고, 조작만 막는 범위다.) */
const TS_SLACK = 2 * 24 * 3600 * 1000;
function safeTs(v) {
  const now = Date.now();
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime();
    if (Number.isFinite(t) && Math.abs(t - now) <= TS_SLACK) return new Date(t).toISOString();
  }
  return new Date(now).toISOString();
}

function monthKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(d);
  return s.slice(0, 7) + '.jsonl';
}
