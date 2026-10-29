/** 접속 국가 (2026-10-28) — 영문/국문 첫 화면 결정용
 *
 *   GET /api/geo  → { ok:true, country:"KR" }
 *
 *  · Cloudflare Worker 에서는 request.cf.country, 그 밖에는 context.geo.country.code 를 그대로 돌려준다.
 *  · IP 자체는 돌려주지도 남기지도 않는다(국가 코드 두 글자만).
 *  · 방문 기록(엣지 block-ip)을 거치지 않도록 excludedPath 에 넣어 두었다.
 */
export const config = { path: '/api/geo' };

export default async (req, context) => {
  let c = '';
  try { c = (context && context.geo && context.geo.country && context.geo.country.code) || ''; } catch (e) {}
  if (!c) c = req.headers.get('cf-ipcountry') || req.headers.get('x-country') || '';
  c = String(c).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return new Response(JSON.stringify({ ok: true, country: c }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff'
    }
  });
};
