/* ============================================================
   맞춤 제안서 PDF 생성 — GitHub Actions 에서 실행 (Cloudflare 무료 운영)
   ------------------------------------------------------------
   Worker 가 GitHub 에 「proposal-build」 신호를 보내면 이 스크립트가
   server/functions/proposal-build-background.mjs 를 그대로 실행합니다.
   저장소(R2)는 사이트의 /api/__blobs 를 통해 읽고 씁니다.
   발송은 하지 않습니다 — 사이트의 정기 점검(10분마다)이 예정 시각에 보냅니다.

   필요한 값(GitHub → Settings → Secrets and variables → Actions)
     SITE_URL          https://monnit.co.kr  (전환 전에는 workers.dev 주소)
     MIGRATE_SECRET    사이트(Cloudflare 대시보드)와 같은 값
     나머지(메일·AI 키·SITE_ID 등)는 사이트 저장소의 __config/env.json 에서 자동으로 읽습니다
   ============================================================ */
import { bindBlobs } from '../../server/lib/blobs.mjs';
import { blobsToken } from '../blob-api.mjs';

const SITE = String(process.env.SITE_URL || process.env.URL || 'https://monnit.co.kr').replace(/\/$/, '');
process.env.URL = process.env.URL || SITE;
const TOKEN = blobsToken(null);
if (!TOKEN) { console.error('MIGRATE_SECRET 가 없습니다 (GitHub → Settings → Secrets)'); process.exit(1); }

/* R2 바인딩과 같은 모양의 원격 버킷 */
const api = (q, init = {}) => fetch(SITE + '/api/__blobs?' + new URLSearchParams(q), { ...init, headers: { 'x-mnk-blobs': TOKEN, ...(init.headers || {}) } });
function obj(res, key) {
  const m = decodeURIComponent(res.headers.get('x-meta') || '');
  let buf = null;
  const ab = async () => (buf ??= await res.arrayBuffer());
  return {
    key, httpEtag: res.headers.get('etag') || '', customMetadata: m ? { m } : {},
    arrayBuffer: ab, text: async () => new TextDecoder().decode(await ab()),
    get body() { return res.body; }
  };
}
async function retry(fn) {
  let e; for (let i = 0; i < 3; i++) { try { return await fn(); } catch (x) { e = x; await new Promise(r => setTimeout(r, 800 * (i + 1))); } }
  throw e;
}
const bucket = {
  async get(key) { return retry(async () => { const r = await api({ op: 'get', key }); if (r.status === 404) return null; if (!r.ok) throw new Error('get ' + r.status); return obj(r, key); }); },
  async head(key) { return retry(async () => { const r = await api({ op: 'head', key }); if (r.status === 404) return null; if (!r.ok) throw new Error('head ' + r.status); return obj(r, key); }); },
  async put(key, body, opts = {}) {
    const data = typeof body === 'string' ? new TextEncoder().encode(body) : body instanceof ArrayBuffer ? new Uint8Array(body) : body;
    return retry(async () => {
      const r = await api({ op: 'put', key }, { method: 'PUT', body: data, headers: opts.customMetadata && opts.customMetadata.m ? { 'x-meta': encodeURIComponent(opts.customMetadata.m) } : {} });
      if (!r.ok) throw new Error('put ' + r.status); return r.json();
    });
  },
  async delete(key) { return retry(async () => { const r = await api({ op: 'delete', key }, { method: 'DELETE' }); if (!r.ok) throw new Error('delete ' + r.status); }); },
  async list(o = {}) {
    const q = { op: 'list', prefix: o.prefix || '' }; if (o.cursor) q.cursor = o.cursor; if (o.delimiter) q.delimiter = o.delimiter;
    return retry(async () => { const r = await api(q); if (!r.ok) throw new Error('list ' + r.status); return r.json(); });
  }
};
bindBlobs(bucket);
/* 사이트 저장소(R2)의 설정값(메일·AI 키 등) — GitHub 비밀값에 없는 것만 채움 */
try {
  const c = await bucket.get('__config/env.json');
  const vars = c ? (JSON.parse(await c.text()).vars || {}) : {};
  for (const [k, v] of Object.entries(vars)) if (!process.env[k]) process.env[k] = v;
  console.log('[build-proposal] 설정값', Object.keys(vars).length + '개');
} catch (e) { console.warn('[build-proposal] 설정값 읽기 실패', e && e.message); }
globalThis.__MNK_ENV_GET = k => process.env[k];
globalThis.__MNK_BUILD_ONLY = true;

const payload = JSON.parse(process.env.PAYLOAD || '{}');
if (!payload.body) { console.error('PAYLOAD 가 비어 있습니다'); process.exit(1); }
const { default: handler } = await import('../../server/functions/proposal-build-background.mjs');
const req = new Request(SITE + '/api/fn/proposal-build-background', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-proposal-sig': payload.sig || '' },
  body: Buffer.from(payload.body, 'base64')
});
const pending = [];
const res = await handler(req, { waitUntil: p => pending.push(p), ip: '', geo: {} });
await Promise.allSettled(pending);
console.log('[build-proposal] 결과', res && res.status);
if (res && res.status >= 400) process.exit(1);
