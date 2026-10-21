/** 접수 알림 메일 — 우리가 받는 쪽. 수신자 0702yeom@gmail.com.
 *
 *  ── 발송 순서 (2026-09-07 확정) ────────────────────────────────────
 *    1순위  StaticForms   무료 250건/월. 실제로 0702yeom@gmail.com 으로 배달 확인됨.
 *    2순위  Web3Forms     무료 250건/월. 수신자를 0702yeom@gmail.com 으로 변경 완료.
 *    3순위  Brevo         위 둘이 모두 실패했을 때만. to 를 직접 지정할 수 있는 유일한 경로.
 *
 *  두 무료 서비스를 번갈아 쓰는 이유는 한 곳의 월 한도(250건)에 걸려도
 *  알림이 끊기지 않게 하기 위해서다.
 *
 *  ── 2026-09-04 사고에서 배운 것 ────────────────────────────────────
 *  StaticForms 는 「안 보낸」 게 아니라 「다른 주소로 보낸」 것이었다.
 *  korea@monnit.com 이 수신자에서 빠져 있었는데 API 는 계속 success 를 돌려줬다.
 *  그래서 여기서는 성공/실패를 응답으로만 판단하지 않고,
 *  어느 경로로 나갔는지(via)를 항상 함께 돌려준다. ops 화면에서 확인할 수 있다.
 *
 *  환경변수
 *    NOTIFY_TO         Brevo 로 떨어질 때의 수신자. 쉼표로 여러 명 (미설정 시 korea@monnit.com)
 *    NOTIFY_ALWAYS_TO  어느 경로로 나가든 항상 함께 받는 사람 (미설정 시 0702yeom@gmail.com — 대표님 지시 2026-10-16)
 *                      StaticForms·Web3Forms 는 수신자를 그쪽 대시보드에서 정하므로, 그 경로로 나간 뒤에도
 *                      이 주소에는 Brevo 로 한 통 더 보낸다. 대표님이 "문의가 이젠 안 들어온다" 하신 뒤 추가.
 *    STATICFORMS_KEY   1순위 키
 *    WEB3FORMS_KEY     2순위 키
 *    BREVO_API_KEY     3순위. 없으면 건너뛴다.
 */

/* ── 키는 코드에 두지 않는다 (2026-09-18) ─────────────────────────────
   예전에는 STATICFORMS_KEY · WEB3FORMS_KEY 의 실제 값이 이 파일에 적혀 있었다.
   저장소를 본 사람은 누구나 우리 무료 한도(각 250건/월)를 태울 수 있었다.
   이제 환경변수가 없으면 그 경로를 건너뛴다 — 알림은 Brevo 로 나간다.
   어느 경로가 꺼져 있는지는 /ops → 연동 점검에서 바로 보인다.
   ※ 저장소에 한 번 올라간 두 키는 이미 노출된 값이므로 재발급이 필요하다. */
const splitTo  = s => String(s || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x));
/* 2026-10-21 — 접수 알림은 korea@monnit.com 으로 보내지 않는다. 대표님(0702yeom@gmail.com)이 받는다.
   NOTIFY_TO 환경변수에 korea@monnit.com 이 남아 있어도 아래 noKorea() 가 걸러낸다. */
const DROP     = ['korea@monnit.com'];
const noKorea  = arr => arr.filter(e => DROP.indexOf(e) < 0);
const TO       = process.env.NOTIFY_TO || '0702yeom@gmail.com';
const ALWAYS   = () => splitTo(process.env.NOTIFY_ALWAYS_TO == null ? '0702yeom@gmail.com' : process.env.NOTIFY_ALWAYS_TO);
const SF_KEY   = process.env.STATICFORMS_KEY || '';
const W3_KEY   = process.env.WEB3FORMS_KEY   || '';
const FROM     = { name: 'Monnit Korea 접수알림', email: 'no-reply@monnit.co.kr' };
const REPLY_TO = { name: 'Monnit Korea', email: 'korea@monnit.com' };

import { shortUrl, campaignOf } from './_staffnote.mjs';

const JSON_HEAD = { 'Content-Type': 'application/json', Accept: 'application/json' };
/* 폼이 보낸 값 중 메일에 싣지 않는 것 — 긴 추적값은 알림함(/ops/notices)에 원문이 남는다 (2026-09-30) */
const SKIP = ['_subject', '_url', '_captcha', '_template', '출처', '유입 페이지', '접수 유형', '접점', '메타 이벤트ID'];
const SITE = String(process.env.URL || 'https://monnit.co.kr').replace(/\/$/, '');

const when = ts => new Date(ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

/** 메일 제목 */
export function subjectOf(lead) {
  const who = lead.company || lead.name || lead.email || lead.phone || '(신원 미기재)';
  return `[모넷·접수] ${lead.interest || lead.label || '문의'} — ${who}`;
}

/** 표로 렌더되는 항목들 — 사장님이 보시던 그 형식 */
export function fieldsOf(lead, payload) {
  const f = {
    '접수 시각': when(lead.ts),
    '유형': lead.label || '',
    '회사': lead.company || '',
    '담당자': lead.name || '',
    '전화': lead.phone || '',
    '이메일': lead.email || '',
    '관심분야': lead.interest || '',
    '문의내용': lead.memo || '',
    /* 대표님 지시 (2026-09-30) — 「경로나 긴 주소는 링크 표시로」.
       fbclid·utm 이 붙은 400자 주소 대신 「메타 · proposal_promo / proposal_ad_03」 과 경로만 싣는다. */
    '유입': [lead.channel, campaignOf(lead.source)].filter(Boolean).join(' · '),
    '유입 페이지': lead.landing ? shortUrl(lead.landing) : '',
    /* 경쟁사로 의심되면 이 IP 를 /ops/block 에 넣어 바로 막는다 (2026-09-16) */
    '접속 IP': lead.ip || ''
  };
  if (lead.flags) f['형식 확인 필요'] = lead.flags;
  for (const k of Object.keys(payload || {})) {
    if (SKIP.indexOf(k) >= 0 || f[k] != null) continue;
    if (String(payload[k] ?? '').trim() === '') continue;
    let v = String(payload[k]);
    if (/^https?:\/\//.test(v) && v.length > 100) v = shortUrl(v);
    f[k] = v.length > 300 ? v.slice(0, 299) + '…' : v;
  }
  f['전체 이력'] = SITE + '/ops/notices';
  for (const k of Object.keys(f)) if (!String(f[k]).trim()) delete f[k];
  return f;
}

/** 줄글 본문 — Web3Forms · Brevo 용 */
function textOf(fields) {
  return Object.keys(fields).map(k => `${k.padEnd(12)} ${fields[k]}`).join('\n');
}

async function viaStaticForms(subject, fields) {
  if (!SF_KEY) return { ok: false, skipped: 'STATICFORMS_KEY 없음' };
  const r = await fetch('https://api.staticforms.dev/submit', {
    method: 'POST', headers: JSON_HEAD,
    body: JSON.stringify({ apiKey: SF_KEY, subject, honeypot: '', ...fields })
  });
  let ok = r.ok;
  try { const j = await r.json(); ok = ok && !!j.success; } catch { /* 무시 */ }
  return ok ? { ok: true, via: 'staticforms' } : { ok: false, error: `staticforms ${r.status}` };
}

async function viaWeb3Forms(subject, fields) {
  if (!W3_KEY) return { ok: false, skipped: 'WEB3FORMS_KEY 없음' };
  const r = await fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: JSON_HEAD,
    body: JSON.stringify({ access_key: W3_KEY, subject, from_name: 'Monnit Korea 접수알림', botcheck: false, ...fields })
  });
  let ok = r.ok;
  try { const j = await r.json(); ok = ok && (j.success === true || j.success === 'true'); } catch { /* 무시 */ }
  return ok ? { ok: true, via: 'web3forms' } : { ok: false, error: `web3forms ${r.status}` };
}

async function viaBrevo(subject, text, to) {
  if (!process.env.BREVO_API_KEY) return { ok: false, skipped: 'BREVO_API_KEY 없음' };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: FROM, to: splitTo(to).map(email => ({ email })), replyTo: REPLY_TO, subject, textContent: text })
  });
  if (!r.ok) return { ok: false, error: `brevo ${r.status}` };
  return { ok: true, via: 'brevo', to };
}

/** 항상 받는 사람(대표님)에게 Brevo 로 한 통 더 — 1·2순위로 나갔을 때 그쪽 수신자 설정과 무관하게 받도록 */
async function copyAlways(subject, text, already) {
  const extra = ALWAYS().filter(e => !splitTo(already).includes(e));
  if (!extra.length) return null;
  try { return await viaBrevo(subject, text, extra.join(',')); }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/** 알림 한 통. 한 곳이 실패하면 다음으로 넘어간다. 절대 throw 하지 않는다. */
export async function notify(lead, payload, opts) {
  /* Brevo 수신자: 지정값(또는 NOTIFY_TO) + 항상 받는 사람 */
  const base = (opts && opts.to) || TO;
  /* 2026-10-21 — 무경험(가이드 자동 발송) 신청도 대표님께 보낸다. 예전엔 빠져 있어 「메일이 안 온다」고 하셨다. */
  const always = ALWAYS();
  let to = noKorea([...new Set([...splitTo(base), ...always])]);
  if (!to.length) to = ['0702yeom@gmail.com'];
  to = to.join(',');
  const subject = subjectOf(lead);
  const fields = fieldsOf(lead, payload);
  const text = textOf(fields);
  const tried = [];

  /* 2026-10-21 — Brevo 를 1순위로. 받는 주소를 코드가 정하는 유일한 경로라서
     대표님 메일함으로 확실히 간다. StaticForms·Web3Forms 는 Brevo 가 실패할 때만 쓴다
     (그 둘의 수신자는 각 서비스 대시보드 설정을 따른다). */
  for (const step of [
    () => viaBrevo(subject, text, to),
    () => viaStaticForms(subject, fields),
    () => viaWeb3Forms(subject, fields)
  ]) {
    try {
      const r = await step();
      if (r.ok) {
        /* 1·2순위(무료 폼)로 나갔으면 대표님께는 따로 한 통 더 */
        if (r.via !== 'brevo' && always.length) { const c = await copyAlways(subject, text, ''); if (c) r.copy = c; }
        return { ...r, tried };
      }
      tried.push(r.error || r.skipped);
    } catch (e) {
      tried.push(String(e && e.message || e));
    }
  }
  return { ok: false, tried };
}

export function configured() {
  return {
    to: TO, always: ALWAYS(),
    order: ['staticforms', 'web3forms', 'brevo'],
    staticforms: !!SF_KEY, web3forms: !!W3_KEY, brevo: !!process.env.BREVO_API_KEY
  };
}
