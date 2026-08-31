/** 제안서 다운로드 — 이메일 검증 후 "서명된 임시 다운로드 링크" 1건만 반환 + 안내 메일
 *
 *  ── 왜 이렇게 하는가 ────────────────────────────────────────────────
 *  예전에는 다운로드 주소가 구글 시트(Whitepapers 탭) url 열에 있었고, 그 시트를
 *  브라우저가 gviz CSV 로 통째로 내려받았다. 방문자가 개발자도구만 열면 16개 주소가
 *  전부 보였고 이메일 입력은 아무것도 막지 못했다.
 *  → 이제 PDF 는 저장소 proposals/ 안에 있고 공개 URL 이 없다(_redirects 로 차단).
 *    이 함수가 이메일을 확인한 뒤, 10분짜리 서명 링크를 1건만 발급한다.
 *
 *  필요 환경변수
 *    BREVO_API_KEY : 안내 메일 발송 (없으면 메일만 건너뛰고 다운로드는 정상)
 *    DL_SECRET     : 링크 서명 키 (없으면 코드 기본값 사용 — 운영에서는 설정 권장)
 */
const { lookup, SECRET, TTL_MS } = require('./_docmap');
const crypto = require('crypto');

const TOKEN = 'mnt-pw-2026-7f3k9';

function sign(file, exp) {
  return crypto.createHmac('sha256', SECRET).update(file + '|' + exp).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  const reply = (code, obj) => ({ statusCode: code, headers: H, body: JSON.stringify(obj) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false });

  try {
    const d = JSON.parse(event.body || '{}');
    if (d.token !== TOKEN) return reply(401, { ok: false, error: 'unauthorized' });

    const email = String(d.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { ok: false, error: 'bad_email' });

    const title = String(d.title || '').slice(0, 120).trim();
    if (!title) return reply(400, { ok: false, error: 'no_title' });

    /* ── 이 조회를 통과해야만 주소가 밖으로 나간다 ── */
    const hit = lookup(title);
    if (!hit) return reply(404, { ok: false, error: 'not_ready' });
    const [file, dlname] = hit;

    const exp = Date.now() + TTL_MS;
    const url = '/.netlify/functions/getdoc?f=' + encodeURIComponent(file) +
                '&e=' + exp + '&s=' + sign(file, exp) + '&n=' + encodeURIComponent(dlname);

    const origin = (event.headers && (event.headers.origin || event.headers.referer)) || 'https://monnit.co.kr';
    const abs = (origin.match(/^https?:\/\/[^/]+/) || ['https://monnit.co.kr'])[0] + url;

    /* ── 안내 메일 (실패해도 다운로드는 진행) ── */
    const body =
      '안녕하세요, Monnit Korea입니다.\n\n' +
      '요청하신 「' + title + '」 제안서를 신청해 주셔서 감사합니다.\n' +
      '브라우저에서 다운로드가 자동으로 시작됩니다.\n' +
      '혹시 시작되지 않았다면 아래 주소로 10분 이내에 내려받아 주세요.\n\n' +
      '■ 제안서   : ' + title + '\n' +
      '■ 다운로드 : ' + abs + '\n' +
      '■ 유효시간 : 발급 후 10분 (만료 시 사이트에서 다시 신청)\n' +
      '■ 열람     : 비밀번호 없이 바로 열림\n' +
      '■ 편집     : 보호됨 (수정이 필요하시면 담당자에게 요청해 주세요)\n\n' +
      '현장 상황에 맞춘 구성·견적 상담은 언제든 도와드리겠습니다.\n' +
      '문의: korea@monnit.com · 02-2088-1454\n\n' +
      '감사합니다.\nMonnit Korea 드림';

    let mailed = false;
    try {
      if (process.env.BREVO_API_KEY) {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'Monnit Korea', email: 'korea@monnit.com' },
            to: [{ email }],
            replyTo: { name: 'Monnit Korea', email: 'korea@monnit.com' },
            subject: '[Monnit Korea] 제안서 다운로드 안내 — ' + title,
            textContent: body
          })
        });
        mailed = (r.status === 201);
      }
    } catch (e) { /* 메일 실패가 다운로드를 막지 않는다 */ }

    return reply(200, { ok: true, url, mailed });
  } catch (e) {
    return reply(500, { ok: false, error: 'server' });
  }
};
