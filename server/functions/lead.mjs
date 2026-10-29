/** 리드 원장 — 사이트 모든 접점의 접수를 한 곳에 기록한다.
 *  · 기록이 실패해도 항상 성공(204)으로 응답한다. 메일 경로가 안전망이다. */
import { append, set } from './_store.mjs';
import { notify } from './_notify.mjs';
import * as _note from './_staffnote.mjs';   /* 메일 보낼 것 / 알림함에만 남길 것 (2026-09-30) */
import { pushLead } from './_monday.mjs';
import { pushSupport, isSupportLead } from './_monday_support.mjs';   /* 기술지원 보드 — AS·설치 확인 접수는 리드 원장 대신 여기로 (2026-10-20) */
import * as _test from './_istest.mjs';
import { sendAlarmReply } from './_alarmmail.mjs';
import { sendSupportAck } from './_supportmail.mjs';   /* 모니 기술지원 접수 확인 메일 — 고객에게 (2026-10-20) */
import { routeLead } from './_route.mjs';   /* 담당자별 배분 — 일반 1015@ · 예약 msk8206@ (2026-10-13) */
import _valid from '../../valid.js';
import _guard from './_guard.js';   /* 경쟁사 차단 (2026-09-16) */
import _docmap from './_docmap.js';   /* siteBase — 메일 링크 주소 검증 */
import * as _capi from './_meta_capi.mjs';   /* 메타 전환 API — 서버에서 접수 알림 (2026-10-29) */
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
    /* 관제 화면이 기억해 둔 집계를 버리게 한다 — 새 접수가 바로 보이도록 */
    try { const _b = set('ops', 'cache/bust.txt', String(Date.now())); if (globalThis.__MNK_WAIT_UNTIL) globalThis.__MNK_WAIT_UNTIL(_b); } catch (e) { /* 무시 */ }

    /* 메타 전환 API — 브라우저 픽셀이 못 본 접수도 메타가 알도록. 같은 이벤트 ID 라 중복되지 않는다.
       응답을 늦추지 않게 뒤에서 보낸다. 결과는 ops/capi-YYYY-MM 에 남는다. */
    if (_capi.eligible(body, lead) && !isSupportLead(lead, p)) {   /* 기술지원(AS) 접수는 광고 전환이 아니다 */
      const job = _capi.sendLead(req, {
        type, eventId: p['메타 이벤트ID'] || '', url: lead.landing || '', source: src,
        interest: lead.interest || '', point: lead.point || '', email: lead.email, phone: lead.phone
      }).then(r => append('ops', 'capi-' + monthKey(safeTs(body.ts)), { ts: new Date().toISOString(), id: p['메타 이벤트ID'] || '', type, point: lead.point, ...r }))
        .catch(() => {});
      if (globalThis.__MNK_WAIT_UNTIL) globalThis.__MNK_WAIT_UNTIL(job); else await job;
    }

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

    /* ── 결정적 행위만 메일 (2026-09-30 대표님 지시) ───────────────────
       상담 문의·프로모션 신청(contact)은 예전처럼 한 통.
       자료 신청(doc_request)·구독(subscribe)은 메일 없이 알림함(/ops/notices)과 먼데이에만 남긴다.
       맞춤 제안서가 함께 접수된 자료 신청은 제안서 신규 접수 메일에 「함께 받은 자료」로 한 줄 들어간다.
       목록은 STAFF_MAIL_KINDS 환경변수로 바꿀 수 있다. */
    const _wantMail = _note.shouldMail(type);
    const _byProposal = /proposal/i.test(lead.point || '') && /맞춤 제안서/.test(lead.interest || '');

    /* ── 담당자별 배분 메일 (2026-10-13) ──────────────────────────────
       위 알림(대표님 메일함)과 별개로 담당자에게 한 통 더 간다. 브라우저 발송 여부·결정적 행위 여부와 무관.
         · 맞춤 제안서 외 모든 접수 → 1015@monnit.com (백서·프로모션·협업·컨설팅 등)
         · 현장 진단 예약           → /visit/admin 「예약 알림 받는 사람」(기본 msk8206@monnit.com) + 1015@
       규칙·주소는 _route.mjs 참고. */
    const _support = isSupportLead(lead, p);
    /* ── 메일 정책 (2026-10-21 대표 지시) ─────────────────────────────
         · 백서·자료 신청(doc_request)·구독(subscribe) → 담당자 메일 없음 (알림함·먼데이에만)
         · 그 밖의 문의(contact)                      → 1015@monnit.com + 0702yeom@gmail.com 동시에 (같은 메일)
       대표님께 따로 가던 알림(notify)은 배분 메일이 대표님께 닿지 못했을 때만 예비로 보낸다 → 중복 없음. */
    const _mailable = type === 'contact';
    /* 2026-10-28 대표 지시 — 「예지보전 가이드 말고는 1015@ 무조건」.
       자료 신청·구독도 1015@monnit.com 에게 한 통 간다(예지보전 제안 가이드만 메일 없음). 대표님 메일함 제외는 그대로. */
    const _routeP = _mailable ? routeLead(lead, p) : routeLead(lead, p, { doc: true });
    const _notifyP = _routeP.catch(() => null).then(rv => {
      if (!_mailable) return { ok: true, via: 'ops', held: true };
      if (rv && rv.kind !== 'proposal' && Array.isArray(rv.delivered) && rv.delivered.includes('0702yeom@gmail.com'))
        return { ok: true, via: 'route' };
      if (_browserSent) return { ok: true, via: _byProposal ? 'proposal' : 'browser' };
      if (rv && rv.kind === 'proposal' && !_wantMail) return { ok: true, via: 'ops', held: true };
      return notify(lead, p);
    });
    const [_notified, _board, _reply, _routed, _ack] = await Promise.allSettled([
      _notifyP,
      /* 기술지원 접수도 리드 원장(Lead CRM)에 함께 — 「리드 원장만 보면 모든 리드」 (2026-10-28). 기술지원 보드도 그대로 */
      _support ? Promise.allSettled([pushSupport(id, lead, p), pushLead(id, lead)]).then(a => a[0].status === 'fulfilled' ? a[0].value : { ok: false, error: String(a[0].reason) }) : pushLead(id, lead),
      sendAlarmReply({ product: lead.product || lead.interest, email: lead.email, name: lead.name, origin: _origin }),
      _routeP,
      sendSupportAck({ interest: lead.interest, email: lead.email, name: lead.name, no: pick(p, ['접수번호']), urgent: /긴급/.test(pick(p, ['긴급도'])) })
    ]);
    try {
      const bv = (_board && _board.status === 'fulfilled') ? _board.value : null;
      if (_support) await append('ops', 'route-' + monthKey(safeTs(body.ts)), {
        ts: lead.ts, ok: !!(bv && bv.ok), kind: 'monday-support', to: (bv && bv.itemId) ? 'item ' + bv.itemId : '',
        note: (bv && (bv.skipped || bv.error)) || '', point: lead.point || '', company: lead.company || ''
      });
    } catch (e) { /* 관측용 */ }
    try {
      const av = (_ack && _ack.status === 'fulfilled') ? _ack.value : null;
      if (av && av.kind) await append('ops', 'automail-' + monthKey(safeTs(body.ts)), {
        ts: lead.ts, email: lead.email, product: 'support-ack:' + av.kind, sent: !!av.sent, note: av.skipped || av.error || ''
      });
    } catch (e) { /* 관측용 */ }
    try {
      const rv = (_routed && _routed.status === 'fulfilled') ? _routed.value : null;
      await append('ops', 'route-' + monthKey(safeTs(body.ts)), {
        ts: lead.ts, ok: !!(rv && rv.ok), kind: (rv && rv.kind) || '', to: (rv && rv.to) ? rv.to.join(',') : '',
        note: (rv && (rv.skipped || rv.error)) || '', point: lead.point || '', company: lead.company || ''
      });
    } catch (e) { /* 관측용 기록 실패는 무시 */ }
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

    /* 알림함 — 메일을 보냈든 안 보냈든 한 줄 */
    {
      const nv = (_notified && _notified.status === 'fulfilled') ? _notified.value : null;
      const rvd = (_routed && _routed.status === 'fulfilled') ? _routed.value : null;
      const docMailed = !_mailable && !!(rvd && rvd.ok && !rvd.skipped);
      const why = _browserSent ? (_byProposal ? '맞춤제안 알림 메일로 대신' : '브라우저가 이미 알림 메일을 보냄')
        : docMailed ? '담당자(1015@) 메일로 알림 — 대표님 메일함 제외'
        : !_wantMail ? (rvd && rvd.skipped ? String(rvd.skipped) + ' — 알림함에만 기록' : '결정적 행위 아님 — 알림함에만 기록')
        : (nv && nv.ok) ? '' : '메일 발송 실패: ' + String((nv && nv.tried) || '');
      await _note.note({
        ts: lead.ts, src: 'lead', kind: _byProposal && _browserSent ? 'dup' : type,
        mailed: docMailed || !!(nv && nv.ok && !nv.held && nv.via !== 'proposal'), via: docMailed ? 'route' : (nv && nv.via) || '', why,
        subject: `[모넷·${lead.label || '접수'}] ${lead.interest || '문의'} — ${lead.company || lead.name || lead.email || ''}`, company: lead.company, name: lead.name, phone: lead.phone, email: lead.email,
        channel: lead.channel, campaign: _note.campaignOf(lead.source), landing: lead.landing, test: !!lead.test,
        ref: lead.point || '',
        summary: { '유형': lead.label, '관심분야': lead.interest, '설비·대상': lead.asset, '지역': lead.region,
          '문의내용': lead.memo, '마케팅 수신': lead.consent_mkt, '출처(원문)': lead.source, '유입 페이지': lead.landing, '접속 IP': lead.ip }
      });
    }

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
