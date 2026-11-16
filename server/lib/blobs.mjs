/* ============================================================
   저장소 모듈 — Cloudflare R2
   ------------------------------------------------------------
   server/functions · server/lib 코드가 이 파일의 getStore() 로 R2 를 읽고 씁니다.

   저장 위치:  R2 버킷(바인딩 BLOBS)  키 = "<저장소 이름>/<키>"
   메타데이터: R2 customMetadata.m 에 JSON 으로
   지원 API:   getStore(name | {name}) → get · getWithMetadata · getMetadata ·
               set · setJSON · delete · list({prefix, paginate, directories}) · listStores()
   ============================================================ */

let BUCKET = null;
/** worker.mjs 가 요청마다 env.BLOBS 를 넘겨 줍니다 */
export function bindBlobs(bucket) { BUCKET = bucket; }
function bucket() {
  if (!BUCKET) throw new Error('R2 바인딩(BLOBS)이 없습니다 — wrangler.toml [[r2_buckets]] 를 확인하세요');
  return BUCKET;
}

const enc = new TextEncoder();
const fullKey = (store, key) => store + '/' + String(key);

async function readBody(obj, type) {
  if (!obj) return null;
  switch (type) {
    case 'json': { const t = await obj.text(); try { return JSON.parse(t); } catch (e) { throw new Error('JSON 이 아닌 값: ' + e.message); } }
    case 'arrayBuffer': return obj.arrayBuffer();
    case 'blob': return new Blob([await obj.arrayBuffer()], { type: obj.httpMetadata?.contentType || '' });
    case 'stream': return obj.body;
    case 'text': default: return obj.text();
  }
}
function metaOf(obj) {
  try { return obj && obj.customMetadata && obj.customMetadata.m ? JSON.parse(obj.customMetadata.m) : {}; }
  catch (e) { return {}; }
}

class Store {
  constructor(name) { this.name = String(name); }

  async get(key, opts = {}) {
    const obj = await bucket().get(fullKey(this.name, key));
    return readBody(obj, opts.type);
  }
  async getWithMetadata(key, opts = {}) {
    const obj = await bucket().get(fullKey(this.name, key));
    if (!obj) return null;
    return { data: await readBody(obj, opts.type), etag: obj.httpEtag || obj.etag, metadata: metaOf(obj) };
  }
  async getMetadata(key) {
    const obj = await bucket().head(fullKey(this.name, key));
    if (!obj) return null;
    return { etag: obj.httpEtag || obj.etag, metadata: metaOf(obj) };
  }
  async set(key, value, opts = {}) {
    const k = fullKey(this.name, key);
    if (opts.onlyIfNew) { const h = await bucket().head(k); if (h) return { modified: false }; }
    let body = value;
    if (value instanceof Blob) body = await value.arrayBuffer();
    else if (ArrayBuffer.isView(value)) body = value;
    else if (!(value instanceof ArrayBuffer) && typeof value !== 'string' && !(value instanceof ReadableStream)) body = String(value);
    const put = {};
    if (opts.metadata && Object.keys(opts.metadata).length) put.customMetadata = { m: JSON.stringify(opts.metadata) };
    const r = await bucket().put(k, body, put);
    return { modified: true, etag: r && (r.httpEtag || r.etag) };
  }
  async setJSON(key, value, opts = {}) { return this.set(key, JSON.stringify(value), opts); }
  async delete(key) { await bucket().delete(fullKey(this.name, key)); }

  /* paginate 없으면 전부 모아서, paginate:true 면 페이지 단위 async iterator */
  async *_pages({ prefix = '', directories = false } = {}) {
    const base = this.name + '/';
    let cursor;
    do {
      const r = await bucket().list({ prefix: base + prefix, cursor, delimiter: directories ? '/' : undefined, limit: 1000 });
      yield {
        blobs: r.objects.map(o => ({ key: o.key.slice(base.length), etag: o.httpEtag || o.etag })),
        directories: (r.delimitedPrefixes || []).map(p => p.slice(base.length).replace(/\/$/, ''))
      };
      cursor = r.truncated ? r.cursor : undefined;
    } while (cursor);
  }
  list(opts = {}) {
    if (opts.paginate) return this._pages(opts);
    return (async () => {
      const out = { blobs: [], directories: [] };
      for await (const p of this._pages(opts)) { out.blobs.push(...p.blobs); out.directories.push(...p.directories); }
      return out;
    })();
  }
}

export function getStore(input) {
  const name = typeof input === 'string' ? input : (input && input.name);
  if (!name) throw new Error('getStore: 저장소 이름이 필요합니다');
  return new Store(name);
}
export const getDeployStore = getStore;

/** 저장소 이름 목록 — R2 최상위 접두어 */
export async function listStores() {
  const r = await bucket().list({ delimiter: '/', limit: 1000 });
  return { stores: (r.delimitedPrefixes || []).map(p => p.replace(/\/$/, '')) };
}

export const _internal = { enc };
