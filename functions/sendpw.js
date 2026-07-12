/** 제안서 열람 비밀번호 발송 — Cloudflare Pages Function (+Brevo)
 *  환경변수: BREVO_API_KEY (CF Pages > Settings > Environment variables) */
const TOKEN = 'mnt-pw-2026-7f3k9';
const PDF_PASSWORD = 'mk2026';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

export async function onRequestOptions() { return new Response('', { status: 200, headers: CORS }); }

export async function onRequestPost({ request, env }) {
  try {
    const d = await request.json().catch(() => ({}));
    if (d.token !== TOKEN) return json({ ok: false, error: 'unauthorized' }, 401);
    const email = String(d.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'bad email' }, 400);
    const title = String(d.title || '산업별 제안서').slice(0, 120);

    const body =
      '안녕하세요, Monnit Korea입니다.\n\n' +
      '요청하신 「' + title + '」 제안서를 신청해 주셔서 감사합니다.\n' +
      'PDF 파일의 열람 비밀번호는 아래와 같습니다.\n\n' +
      '■ 열람 비밀번호: ' + PDF_PASSWORD + '\n\n' +
      '문의: korea@monnit.com · 02-2088-1454\n\n감사합니다.\nMonnit Korea 드림';

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Monnit Korea', email: 'korea@monnit.com' },
        to: [{ email }],
        replyTo: { name: 'Monnit Korea', email: 'korea@monnit.com' },
        subject: '[Monnit Korea] 제안서 열람 비밀번호 안내 — ' + title,
        textContent: body
      })
    });
    return json({ ok: r.status === 201 }, r.status === 201 ? 200 : 502);
  } catch (e) { return json({ ok: false, error: String(e) }, 500); }
}
function json(o, status) { return new Response(JSON.stringify(o), { status, headers: CORS }); }
