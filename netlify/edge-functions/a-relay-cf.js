/** Netlify → Cloudflare 중계 (2026-10-13, 이관 직후 임시)
 *
 *  네임서버를 Cloudflare 로 바꾼 뒤에도 하루~이틀은 일부 통신사·회사 DNS 가 옛 주소(Netlify)를
 *  기억하고 있어 방문자 일부가 여전히 Netlify 로 들어온다. 그 요청이 Netlify 에서 처리되면
 *  문의·제안서 신청이 Netlify 저장소에 따로 쌓이고(관제에 안 보임), 예약 발송도 돌지 않는다.
 *  그래서 Netlify 로 들어온 요청은 전부 Cloudflare(Worker)로 그대로 넘긴다 — 처리·저장은 한 곳에서만.
 *
 *  · 끄려면 Netlify 환경변수 RELAY_TO=off  (다른 주소로 보내려면 RELAY_TO=https://…)
 *  · /api/blob-export 는 넘기지 않는다 — Cloudflare 가 이 주소로 설정값·데이터를 가져가기 때문(무한 반복 방지)
 *  · 방문자 IP 는 MIGRATE_SECRET 서명과 함께 넘긴다 — 서명이 맞을 때만 Worker 가 믿는다
 *  · 오류가 나면 Netlify 가 예전처럼 직접 처리한다(onError: bypass) */
const DEFAULT_TO = 'https://monnit.korea-439.workers.dev';
const DROP = ['host', 'content-length', 'accept-encoding', 'connection', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
  'x-nf-client-connection-ip', 'x-nf-request-id', 'x-nf-account-id', 'x-nf-site-id', 'x-nf-deploy-id', 'x-mnk-ip',
  'x-mnk-relay-ip', 'x-mnk-relay-sig', 'x-mnk-relay-host', 'cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'client-ip'];

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sign(secret, ip) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('relay|' + ip)));
}

export default async (request, context) => {
  const env = k => (globalThis.Netlify && Netlify.env.get(k)) || '';
  const to = String(env('RELAY_TO') || DEFAULT_TO).trim();
  if (!/^https:\/\//.test(to)) return;                      /* off → Netlify 가 직접 처리 */
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, to);
  if (target.host === url.host) return;                     /* 자기 자신으로 보내지 않음 */

  const h = new Headers(request.headers);
  for (const k of DROP) h.delete(k);
  const ip = context.ip || '';
  h.set('x-mnk-relay-host', url.host);
  if (ip) {
    h.set('x-mnk-relay-ip', ip);
    const secret = env('MIGRATE_SECRET') || env('PROPOSAL_SECRET') || env('DL_SECRET');
    if (secret) h.set('x-mnk-relay-sig', await sign(secret, ip));
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const r = await fetch(target, { method: request.method, headers: h, body, redirect: 'manual' });

  /* 본문은 이미 풀린 상태로 온다 — 압축 표시를 지워야 브라우저가 다시 풀려다 깨지지 않는다 */
  const out = new Headers(r.headers);
  for (const k of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) out.delete(k);
  /* 리다이렉트 주소가 workers.dev 로 나가지 않게 원래 주소로 */
  const loc = out.get('location');
  if (loc) { try { const l = new URL(loc, target); if (l.host === target.host) { l.host = url.host; l.protocol = url.protocol; out.set('location', l.toString()); } } catch (e) { /* 그대로 */ } }
  out.set('x-mnk-relay', '1');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: out });
};

export const config = {
  path: "/*",
  excludedPath: ["/api/blob-export"],
  onError: "bypass"
};
