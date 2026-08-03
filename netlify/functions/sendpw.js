/** 제안서 다운로드 안내 메일 발송 — Netlify Function + Brevo API
 *  필요 환경변수: BREVO_API_KEY (Netlify > Site configuration > Environment variables) */
const TOKEN = 'mnt-pw-2026-7f3k9';
const PDF_PASSWORD = 'Monnit0204!';  // 편집 보호용 (열람은 비밀번호 불필요)

exports.handler = async (event) => {
  const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: H, body: JSON.stringify({ ok: false }) };
  try {
    const d = JSON.parse(event.body || '{}');
    if (d.token !== TOKEN) return { statusCode: 401, headers: H, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    const email = String(d.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { statusCode: 400, headers: H, body: JSON.stringify({ ok: false, error: 'bad email' }) };
    const title = String(d.title || '산업별 제안서').slice(0, 120);

    const body =
      '안녕하세요, Monnit Korea입니다.\n\n' +
      '요청하신 「' + title + '」 제안서를 신청해 주셔서 감사합니다.\n' +
      '다운로드하신 PDF는 비밀번호 없이 바로 열람하실 수 있습니다.\n' +
      '문서 내용은 무단 편집·수정을 막기 위해 보호되어 있습니다.\n\n' +
      '■ 제안서 : ' + title + '\n' +
      '■ 열람   : 비밀번호 없이 바로 열림\n' +
      '■ 편집   : 보호됨 (수정이 필요하시면 담당자에게 요청해 주세요)\n\n' +
      '현장 상황에 맞춘 구성·견적 상담은 언제든 도와드리겠습니다.\n' +
      '문의: korea@monnit.com · 02-2088-1454\n\n' +
      '감사합니다.\nMonnit Korea 드림';

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Monnit Korea', email: 'korea@monnit.com' },
        to: [{ email }],
        replyTo: { name: 'Monnit Korea', email: 'korea@monnit.com' },
        subject: '[Monnit Korea] 제안서 다운로드 안내 — ' + title,
        textContent: body
      })
    });
    return { statusCode: r.status === 201 ? 200 : 502, headers: H, body: JSON.stringify({ ok: r.status === 201 }) };
  } catch (e) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
