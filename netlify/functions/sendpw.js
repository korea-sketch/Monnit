/** 제안서 열람 비밀번호 발송 — Netlify Function + Brevo API
 *  필요 환경변수: BREVO_API_KEY (Netlify > Site configuration > Environment variables) */
const TOKEN = 'mnt-pw-2026-7f3k9';
const PDF_PASSWORD = 'mk2026';

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
      'PDF 파일의 열람 비밀번호는 아래와 같습니다.\n\n' +
      '■ 열람 비밀번호: ' + PDF_PASSWORD + '\n\n' +
      '문의: korea@monnit.com · 02-2088-1454\n\n' +
      '감사합니다.\nMonnit Korea 드림';

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Monnit Korea', email: 'korea@monnit.com' },
        to: [{ email }],
        replyTo: { name: 'Monnit Korea', email: 'korea@monnit.com' },
        subject: '[Monnit Korea] 제안서 열람 비밀번호 안내 — ' + title,
        textContent: body
      })
    });
    return { statusCode: r.status === 201 ? 200 : 502, headers: H, body: JSON.stringify({ ok: r.status === 201 }) };
  } catch (e) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
