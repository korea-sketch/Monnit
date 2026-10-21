/** 담당자별 접수 메일 배분 (2026-10-13)
 *
 *  ── 규칙 ────────────────────────────────────────────────────────────
 *    맞춤 제안서        → 보내지 않음 (제안서 시스템이 자체 알림을 보낸다)
 *    예지보전 현장 진단 예약(/visit)
 *                       → 예약 알림 받는 사람 (/visit/admin 에서 추가·삭제, 기본 msk8206@monnit.com)
 *                         + 일반 문의 담당 (1015@monnit.com)
 *    알리미(긴급 경보 알리미 · /promo/alarm)
 *                       → 일반 문의 담당 (1015@monnit.com) + 알리미 담당 (5959@monnit.com)
 *    그 밖의 모든 접수  → 일반 문의 담당 (1015@monnit.com)
 *                         백서·자료 신청 / 프로모션 신청 / 협업·상담 문의 / 컨설팅(무료 체험) / 구독 등
 *
 *  기존 알림(0702yeom@gmail.com · StaticForms → Web3Forms → Brevo)은 그대로 두고,
 *  이 메일은 「추가로」 나간다. 받는 주소를 우리가 정해야 하므로 Brevo 로만 보낸다.
 *  절대 throw 하지 않는다 — 접수 처리를 막으면 안 된다.
 *
 *  환경변수 (없으면 기본값)
 *    ROUTE_GENERAL_TO   일반 문의 담당. 쉼표로 여러 명. 기본 1015@monnit.com
 *    ROUTE_ALARM_TO     알리미 담당. 쉼표로 여러 명. 기본 5959@monnit.com
 *    ROUTE_SUPPORT_TO   기술지원(AS) 접수 담당 — 모니 「사용 중 문제 해결」에서 들어온 건 (2026-10-20).
 *                       비어 있으면 일반 문의 담당만 받는다. 기술팀 주소를 넣으면 그쪽도 함께 받는다.
 *                       제품이 알리미인 고장 접수는 알리미 담당에게도 간다.
 *    ROUTE_ALWAYS_TO    어떤 종류든 배분 메일을 항상 함께 받는 사람. 기본 0702yeom@gmail.com
 *                       (대표님 지시 2026-10-16 — 담당자에게 가는 문의를 대표도 같이 받는다. 비우려면 ROUTE_ALWAYS_TO=- )
 *                       (2026-10-21) 예지보전 가이드 자동 발송 건도 대표님께 보낸다.
 *    VISIT_NOTIFY_TO    /visit/admin 에서 한 번도 저장하지 않았을 때의 예약 알림 기본값. 기본 msk8206@monnit.com
 *    ROUTE_MAIL_OFF=1   이 배분 메일을 끈다
 */
import { get, set } from './_store.mjs';
import { subjectOf, fieldsOf } from './_notify.mjs';

const env = (k, d = '') => {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/;
export const okEmail = s => EMAIL_RE.test(String(s || '').trim());
const splitList = s => String(s || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(okEmail);

export const generalTo = () => splitList(env('ROUTE_GENERAL_TO', '1015@monnit.com'));
export const alarmTo = () => splitList(env('ROUTE_ALARM_TO', '5959@monnit.com'));
export const supportTo = () => splitList(env('ROUTE_SUPPORT_TO', ''));
export const alwaysTo = () => splitList(env('ROUTE_ALWAYS_TO', '0702yeom@gmail.com'));
/** 예지보전 가이드 자동 발송 건 — 무경험 신청. 대표님은 받지 않는다 (2026-10-16) */
export const isGuideLead = (lead, payload) => {
  const p = payload || {};
  return String((lead && lead.exp_group) || p['경험 구분'] || '').trim() === '무경험';
};
const visitDefault = () => splitList(env('VISIT_NOTIFY_TO', 'msk8206@monnit.com'));

/* 예약 알림 받는 사람 — 공개 설정(config.json)과 분리해서 둔다.
   config.json 은 /visit/config 로 누구에게나 내려가므로 메일 주소를 넣으면 안 된다. */
const STORE = 'visit', KEY = 'notify.json';

export function cleanRecipients(arr) {
  const seen = new Set(), out = [];
  for (const x of (Array.isArray(arr) ? arr : []).slice(0, 30)) {
    const email = String((x && x.email) || x || '').trim().toLowerCase();
    if (!okEmail(email) || seen.has(email)) continue;
    seen.add(email);
    const name = String((x && x.name) || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
    out.push({ email, name });
  }
  return out;
}

/** { list:[{email,name}], savedAt, isDefault } */
export async function readVisitRecipients() {
  try {
    const raw = await get(STORE, KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return { list: cleanRecipients(o.list), savedAt: o.savedAt || '', isDefault: false };
    }
  } catch (e) { /* 읽기 실패 → 기본값 */ }
  return { list: visitDefault().map(email => ({ email, name: '' })), savedAt: '', isDefault: true };
}

export async function saveVisitRecipients(list) {
  const clean = cleanRecipients(list);
  const savedAt = new Date().toISOString();
  const ok = await set(STORE, KEY, JSON.stringify({ list: clean, savedAt }));
  return { ok, list: clean, savedAt };
}

/** 이 접수는 어디로 가는가 */
export function kindOf(lead, payload) {
  const p = payload || {};
  const hay = [lead.interest, lead.point, p['구분'], p['_subject'], p['관심분야']].map(v => String(v || '')).join(' ');
  if (/맞춤\s*제안/.test(hay)) return 'proposal';
  if (/현장진단 예약|visit_booking/.test(String(lead.point || '')) || /현장\s*진단\s*예약/.test(hay)) return 'visit';
  /* 알리미 — 알리미 모델을 고른 신청이거나, 알리미 랜딩(/promo/alarm)에서 들어온 접수 */
  if (String(p['알리미 모델'] || '').trim() || /알리미/.test(hay) || /promo[\/-]alarm/.test(String(lead.landing || p['유입 페이지'] || ''))) return 'alarm';
  /* 모니 기술지원 접수 — 제품이 알리미면 알리미 담당도 함께 (2026-10-20) */
  if (/기술지원|support_ticket/.test(hay + ' ' + String(lead.point || ''))) return /알리미/.test(String(p['제품'] || '')) ? 'alarm-support' : 'support';
  return 'general';
}

/* 2026-10-21 대표 지시 — 일반 문의는 「무조건」 1015 와 대표님이 같이 받는다.
   환경변수를 잘못 바꿔도 이 두 주소는 빠지지 않는다. */
export const MUST_TO = ['1015@monnit.com', '0702yeom@gmail.com'];

export async function recipientsFor(kind, opts) {
  if (kind === 'proposal') return [];
  const out = new Set([...MUST_TO, ...generalTo()]);
  if (kind === 'visit') for (const r of (await readVisitRecipients()).list) out.add(r.email);
  if (kind === 'alarm' || kind === 'alarm-support') for (const e of alarmTo()) out.add(e);
  if (kind === 'support' || kind === 'alarm-support') for (const e of supportTo()) out.add(e);
  for (const e of alwaysTo()) out.add(e);   /* 대표님은 종류와 상관없이 항상 (2026-10-21: 가이드 건 제외 규칙 폐지) */
  out.delete('korea@monnit.com');   /* 2026-10-21 — korea@ 로는 접수 알림을 보내지 않는다 */
  return [...out];
}

const FROM     = { name: 'Monnit Korea 접수알림', email: env('MAIL_FROM', 'no-reply@monnit.co.kr') };
const REPLY_TO = { name: 'Monnit Korea', email: 'korea@monnit.com' };

const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlOf(title, fields) {
  const rows = Object.keys(fields).map(k =>
    `<tr><th style="text-align:left;vertical-align:top;padding:8px 12px;background:#f4f6f5;color:#41524b;font-weight:600;white-space:nowrap;border-bottom:1px solid #e3e8e5">${escH(k)}</th>` +
    `<td style="padding:8px 12px;color:#0f1a16;border-bottom:1px solid #e3e8e5;word-break:break-all">${escH(fields[k]).replace(/\n/g, '<br>')}</td></tr>`).join('');
  return `<div style="font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;max-width:640px">
<h2 style="font-size:17px;margin:0 0 12px;color:#0f1a16">${escH(title)}</h2>
<table style="border-collapse:collapse;width:100%;border:1px solid #e3e8e5">${rows}</table>
<p style="color:#7c8b84;font-size:12px;margin-top:14px">monnit.co.kr 접수 자동 배분 메일입니다. 고객에게 답장하려면 위 이메일 주소로 직접 보내 주세요.</p></div>`;
}

export async function sendBrevo({ to, subject, fields, replyTo }) {
  const key = env('BREVO_API_KEY', '');
  if (!key) return { ok: false, skipped: 'BREVO_API_KEY 없음' };
  if (!to || !to.length) return { ok: false, skipped: '받는 사람 없음' };
  const text = Object.keys(fields).map(k => `${k}: ${fields[k]}`).join('\n');
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: FROM, to: to.map(email => ({ email })), replyTo: replyTo || REPLY_TO,
      subject, htmlContent: htmlOf(subject, fields), textContent: text
    })
  });
  if (!r.ok) return { ok: false, error: `brevo ${r.status}` };
  return { ok: true, via: 'brevo', to };
}

/** 접수 한 건을 담당자에게 배분한다. { ok, kind, to, skipped?, error? } */
export async function routeLead(lead, payload) {
  try {
    if (env('ROUTE_MAIL_OFF', '') === '1') return { ok: false, skipped: 'off' };
    const kind = kindOf(lead, payload);
    if (kind === 'proposal') return { ok: true, kind, skipped: '맞춤 제안서 — 배분 대상 아님' };
    const to = await recipientsFor(kind, { guide: isGuideLead(lead, payload) });
    const tag = kind === 'visit' ? '현장진단 예약' : kind === 'alarm' ? '알리미 문의' : '일반 문의';
    const subject = `[${tag}] ` + subjectOf(lead).replace(/^\[모넷·접수\]\s*/, '') + (lead.test ? ' (테스트 의심)' : '');
    const fields = fieldsOf(lead, payload);
    /* 고객 메일 주소가 맞으면 「답장」 이 곧바로 고객에게 가도록 */
    const _rn = String(lead.name || lead.company || '').trim();
    const replyTo = okEmail(lead.email) ? (_rn ? { email: String(lead.email).trim(), name: _rn } : { email: String(lead.email).trim() }) : undefined;
    /* 받는 사람마다 따로 보낸다 (2026-10-21) — 한 주소가 막혀도(수신 거부·반송 목록) 나머지는 받고,
       누가 받았는지(delivered)를 주소별로 남길 수 있다. 실패한 주소는 한 번 더 시도한다. */
    const one = async e => {
      let r = await sendBrevo({ to: [e], subject, fields, replyTo }).catch(err => ({ ok: false, error: String(err && err.message || err) }));
      if (!r.ok && !r.skipped) r = await sendBrevo({ to: [e], subject, fields, replyTo }).catch(err => ({ ok: false, error: String(err && err.message || err) }));
      return { email: e, ...r };
    };
    const res = await Promise.all(to.map(one));
    const delivered = res.filter(x => x.ok).map(x => x.email);
    const failed = res.filter(x => !x.ok).map(x => x.email + ':' + (x.error || x.skipped || '실패'));
    return { ok: failed.length === 0 && delivered.length > 0, via: 'brevo', kind, to, delivered,
      ...(failed.length ? { error: failed.join(' / ') } : {}) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
