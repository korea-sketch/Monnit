/** 알리미 자동 응답 메일 미리보기 · 테스트 발송
 *
 *  폼을 실제로 넣어보지 않고도 무엇이 나가는지 확인할 수 있어야 한다.
 *  문구를 고치고 배포한 뒤 여기서 한 번 열어보는 것이 마지막 점검이다.
 *
 *  ── 쓰는 법 ────────────────────────────────────────────────────────
 *    미리보기   GET /api/mailpreview?p=fire
 *               p = fire | power | alarm | water  (기본 alarm)
 *               &name=홍길동 을 붙이면 인사말이 바뀐다
 *
 *    테스트발송 GET /api/mailpreview?p=fire&to=내주소@회사.com&t=<MAIL_PREVIEW_TOKEN>
 *               토큰이 맞아야만 실제로 나간다. 없으면 400.
 *
 *  본문은 우리가 광고에 쓰는 소개 내용이라 미리보기 자체는 비밀이 아니다.
 *  다만 발송은 남용될 수 있으므로 토큰으로 잠근다. 검색엔진에는 노출하지 않는다.
 */
import { renderEmail, sendAlarmReply, configured } from './_alarmmail.mjs';

export const config = { path: '/api/mailpreview' };

const TOKEN = process.env.MAIL_PREVIEW_TOKEN || '';

export default async (req) => {
  const u = new URL(req.url);
  const p = (u.searchParams.get('p') || 'alarm').trim();
  const to = (u.searchParams.get('to') || '').trim();
  const name = (u.searchParams.get('name') || '홍길동').trim();
  const origin = u.origin;

  const H = {
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store'
  };
  const json = (code, obj) =>
    new Response(JSON.stringify(obj, null, 2), { status: code, headers: { ...H, 'Content-Type': 'application/json; charset=utf-8' } });

  /* 설정 점검용 — 키가 꽂혀 있는지, 어디로 나가는지 */
  if (u.searchParams.get('status') != null) return json(200, configured());

  try {
    if (to) {
      if (!TOKEN) return json(400, { ok: false, error: 'MAIL_PREVIEW_TOKEN 환경변수가 없어 테스트 발송이 잠겨 있습니다.' });
      if (u.searchParams.get('t') !== TOKEN) return json(403, { ok: false, error: '토큰이 맞지 않습니다.' });
      const r = await sendAlarmReply({ product: p, email: to, name, origin });
      return json(200, { ok: !!r.sent, ...r, to });
    }

    const { subject, html } = await renderEmail(p, { CUSTOMER_NAME: name, SITE_ORIGIN: origin });
    /* 제목은 브라우저에서 안 보이므로 맨 위에 한 줄 얹어 준다 */
    const bar = `<div style="background:#0F2B5B;color:#fff;padding:10px 16px;font:13px/1.5 -apple-system,'Apple SD Gothic Neo',sans-serif">
      <b>미리보기</b> · 제목: ${subject.replace(/</g, '&lt;')} · 제품키: ${p}</div>`;
    return new Response(html.replace('<body id="body"', bar + '<body id="body"').replace(bar + '<body', '<body'), {
      status: 200,
      headers: { ...H, 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (e) {
    return json(400, { ok: false, error: String((e && e.message) || e), hint: 'p 는 fire · power · alarm · water 중 하나여야 합니다.' });
  }
};
