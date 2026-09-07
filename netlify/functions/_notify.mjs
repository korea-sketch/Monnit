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
 *    NOTIFY_TO         Brevo 로 떨어질 때의 수신자 (기본 0702yeom@gmail.com)
 *    STATICFORMS_KEY   1순위 키
 *    WEB3FORMS_KEY     2순위 키
 *    BREVO_API_KEY     3순위. 없으면 건너뛴다.
 */

const TO       = process.env.NOTIFY_TO || '0702yeom@gmail.com';
const SF_KEY   = process.env.STATICFORMS_KEY || 'sf_e026c9ef91b8eaeba9d1d472';
const W3_KEY   = process.env.WEB3FORMS_KEY   || 'e4d5cb03-1b25-425c-a47d-f04e4a05e7e2';
const FROM     = { name: 'Monnit Korea 접수알림', email: 'no-reply@monnit.co.kr' };
const REPLY_TO = { name: 'Monnit Korea', email: 'korea@monnit.com' };

const JSON_HEAD = { 'Content-Type': 'application/json', Accept: 'application/json' };
const SKIP = ['_subject', '_url', '_captcha', '_template'];

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
    '유입 채널': lead.channel || '',
    '회사': lead.company || '',
    '담당자': lead.name || '',
    '전화': lead.phone || '',
    '이메일': lead.email || '',
    '관심분야': lead.interest || '',
    '문의내용': lead.memo || '',
    '출처': lead.source || '',
    '유입 페이지': lead.landing || ''
  };
  if (lead.flags) f['형식 확인 필요'] = lead.flags;
  for (const k of Object.keys(payload || {})) {
    if (SKIP.indexOf(k) >= 0 || f[k] != null) continue;
    if (String(payload[k] ?? '').trim() === '') continue;
    f[k] = String(payload[k]);
  }
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
    body: JSON.stringify({ sender: FROM, to: [{ email: to }], replyTo: REPLY_TO, subject, textContent: text })
  });
  if (!r.ok) return { ok: false, error: `brevo ${r.status}` };
  return { ok: true, via: 'brevo', to };
}

/** 알림 한 통. 한 곳이 실패하면 다음으로 넘어간다. 절대 throw 하지 않는다. */
export async function notify(lead, payload, opts) {
  const to = (opts && opts.to) || TO;
  const subject = subjectOf(lead);
  const fields = fieldsOf(lead, payload);
  const text = textOf(fields);
  const tried = [];

  for (const step of [
    () => viaStaticForms(subject, fields),
    () => viaWeb3Forms(subject, fields),
    () => viaBrevo(subject, text, to)
  ]) {
    try {
      const r = await step();
      if (r.ok) return { ...r, tried };
      tried.push(r.error || r.skipped);
    } catch (e) {
      tried.push(String(e && e.message || e));
    }
  }
  return { ok: false, tried };
}

export function configured() {
  return {
    to: TO,
    order: ['staticforms', 'web3forms', 'brevo'],
    staticforms: !!SF_KEY, web3forms: !!W3_KEY, brevo: !!process.env.BREVO_API_KEY
  };
}
