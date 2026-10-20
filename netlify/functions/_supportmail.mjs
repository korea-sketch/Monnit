/** 기술지원 접수 확인 메일 — 고객에게 (2026-10-20)
 *
 *  모니 「사용 중 문제 해결」로 접수한 고객에게 접수번호와 다음 단계를 바로 알려 준다.
 *  「접수가 된 건가?」 하는 불안을 줄이는 게 목적이라 짧고 담백하게 — 시간 약속은 하지 않는다.
 *
 *  · 대상: 관심분야가 「기술지원(AS) 접수」 「알리미 설치 확인 요청」 「영업 문의(모니)」인 건
 *  · 절대 throw 하지 않는다 — 메일 실패가 접수를 막으면 안 된다
 *  · 전화번호는 쓰지 않는다. 답장 주소(korea@monnit.com)만 둔다
 *
 *  환경변수
 *    BREVO_API_KEY      없으면 조용히 건너뛴다
 *    SUPPORT_MAIL_OFF   '1' 이면 끈다
 */
const env = (k, d = '') => {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};
const SENDER = { name: '모넷코리아 기술지원', email: env('MAIL_FROM', 'no-reply@monnit.co.kr') };
const REPLY_TO = { name: '모넷코리아 기술지원', email: 'korea@monnit.com' };
const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function supportKind(interest) {
  const s = String(interest || '');
  if (/설치\s*확인/.test(s)) return 'install';
  if (/영업\s*문의\(모니\)/.test(s)) return 'sales';
  if (/기술지원/.test(s)) return 'support';
  return '';
}

function body(kind, { name, no, urgent }) {
  const who = String(name || '').trim() || '고객';
  const head = kind === 'install' ? '알리미 설치 확인 요청을 받았습니다'
    : kind === 'sales' ? '문의를 받았습니다' : '기술지원 접수를 받았습니다';
  const next = kind === 'install'
    ? ['담당자가 게이트웨이·센서 연결 상태를 확인합니다.', '확인되면 이메일로 알려 드리고, 센서마다 한 번씩 시험을 함께 진행합니다.', '시험 문자가 오면 설치가 끝납니다.']
    : kind === 'sales'
      ? ['영업 담당자가 문의 내용을 확인합니다.', '필요한 제품·구성·일정을 이메일로 안내드립니다.']
      : ['담당 엔지니어가 접수 내용과 해 보신 조치를 확인합니다.', '원인과 다음 조치를 이메일로 안내드립니다.', '필요하면 원격 점검이나 AS 절차를 함께 진행합니다.'];
  const lines = [
    `${who}님, ${head}.`,
    no ? `접수번호: ${no}` : '',
    '',
    '진행 순서',
    ...next.map((t, i) => `${i + 1}. ${t}`),
    '',
    '평일 업무시간에 접수 순서대로 확인합니다.' + (urgent ? ' 긴급으로 접수하신 건은 먼저 확인합니다.' : ''),
    '현장 사진이나 추가로 전하실 내용은 이 메일에 답장으로 보내 주시면 같은 건으로 이어서 확인합니다.',
    '',
    '모넷코리아 기술지원'
  ].filter(l => l !== null);
  const text = lines.join('\n');
  const html = `<div style="font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.7;color:#111820;max-width:560px">
<p style="font-size:16px;font-weight:700;margin:0 0 6px">${escH(who)}님, ${escH(head)}.</p>
${no ? `<p style="margin:0 0 14px;color:#0868f2;font-weight:700">접수번호 ${escH(no)}</p>` : ''}
<p style="margin:0 0 6px;font-weight:700">진행 순서</p>
<ol style="margin:0 0 14px;padding-left:20px">${next.map(t => `<li>${escH(t)}</li>`).join('')}</ol>
<p style="margin:0 0 6px;color:#36404d">평일 업무시간에 접수 순서대로 확인합니다.${urgent ? ' 긴급으로 접수하신 건은 먼저 확인합니다.' : ''}</p>
<p style="margin:0 0 18px;color:#36404d">현장 사진이나 추가로 전하실 내용은 <b>이 메일에 답장</b>으로 보내 주시면 같은 건으로 이어서 확인합니다.</p>
<p style="margin:0;color:#7a8492;font-size:12px">모넷코리아 기술지원 · monnit.co.kr</p></div>`;
  const subject = `[모넷코리아] ${head}${no ? ' · ' + no : ''}`;
  return { subject, html, text };
}

/** @returns {{sent:boolean, kind?:string, skipped?:string, error?:string}} */
export async function sendSupportAck({ interest, email, name, no, urgent }) {
  const kind = supportKind(interest);
  if (!kind) return { sent: false, skipped: 'not_support' };
  if (env('SUPPORT_MAIL_OFF') === '1') return { sent: false, kind, skipped: 'off' };
  const key = env('BREVO_API_KEY');
  if (!key) return { sent: false, kind, skipped: 'no_key' };
  const to = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return { sent: false, kind, skipped: 'no_email' };
  try {
    const { subject, html, text } = body(kind, { name, no, urgent });
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: SENDER, to: [{ email: to }], replyTo: REPLY_TO, subject, htmlContent: html, textContent: text, tags: ['support-ack', kind] }),
      signal: AbortSignal.timeout(8000)
    });
    if (r.status === 201) return { sent: true, kind };
    let detail = ''; try { detail = (await r.text()).slice(0, 200); } catch (e) { /* 무시 */ }
    return { sent: false, kind, error: `brevo ${r.status} ${detail}` };
  } catch (e) { return { sent: false, kind, error: String((e && e.message) || e) }; }
}
