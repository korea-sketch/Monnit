/* ============================================================
   저장소 원격 API — /api/__blobs  (GitHub Actions 의 제안서 생성 작업 전용)
   ------------------------------------------------------------
   무료 플랜의 Worker 는 요청당 CPU 10ms 라 PDF 조판을 하지 못합니다.
   그래서 PDF 는 GitHub Actions(무료)에서 만들고, 그 작업이 이 API 로 R2 를 읽고 씁니다.
   인증: x-mnk-blobs = HMAC-SHA256(MIGRATE_SECRET → 없으면 PROPOSAL_SECRET → DL_SECRET, 'mnk-blobs-v1')
   ============================================================ */
import crypto from 'node:crypto';

export function blobsToken(env) {
  const s = (env && (env.MIGRATE_SECRET || env.PROPOSAL_SECRET || env.DL_SECRET)) || process.env.MIGRATE_SECRET || process.env.PROPOSAL_SECRET || process.env.DL_SECRET || '';
  return s ? crypto.createHmac('sha256', s).update('mnk-blobs-v1').digest('hex') : '';
}
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function blobApi(req, env) {
  const u = new URL(req.url);
  if (u.pathname !== '/api/__blobs') return null;
  const tok = blobsToken(env), got = req.headers.get('x-mnk-blobs') || '';
  if (!tok || got.length !== tok.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(tok))) return j({ ok: false }, 401);
  const B = env.BLOBS, op = u.searchParams.get('op'), key = u.searchParams.get('key') || '';
  if (op === 'get' || op === 'head') {
    const o = op === 'get' ? await B.get(key) : await B.head(key);
    if (!o) return new Response(null, { status: 404 });
    const h = { 'x-meta': encodeURIComponent((o.customMetadata && o.customMetadata.m) || ''), etag: o.httpEtag || o.etag || '' };
    return new Response(op === 'get' ? o.body : null, { status: 200, headers: h });
  }
  if (op === 'put' && req.method === 'PUT') {
    const m = decodeURIComponent(req.headers.get('x-meta') || '');
    const r = await B.put(key, await req.arrayBuffer(), m ? { customMetadata: { m } } : {});
    return j({ ok: true, etag: r && (r.httpEtag || r.etag) });
  }
  if (op === 'delete' && req.method === 'DELETE') { await B.delete(key); return j({ ok: true }); }
  if (op === 'list') {
    const r = await B.list({
      prefix: u.searchParams.get('prefix') || '', cursor: u.searchParams.get('cursor') || undefined,
      delimiter: u.searchParams.get('delimiter') || undefined, limit: 1000
    });
    return j({ objects: r.objects.map(o => ({ key: o.key, httpEtag: o.httpEtag || o.etag })), truncated: r.truncated, cursor: r.cursor, delimitedPrefixes: r.delimitedPrefixes || [] });
  }
  return j({ ok: false, error: 'op' }, 400);
}
