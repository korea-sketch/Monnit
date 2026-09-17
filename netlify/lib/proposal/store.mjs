/** 맞춤 제안서 — 저장소 (Netlify Blobs 'proposals')
 *
 *  키 구조
 *    job/<id>.json          작업 한 건 (상태·입력·매칭·알림 기록)
 *    pdf/<id>.pdf           완성된 제안서
 *    queue/<due>-<id>       발송 대기열 (due = epoch ms, 13자리 → 문자열 정렬 = 시간순)
 *    dedupe/<hash>          같은 사람·회사 24시간 중복 방지 → id
 *    rate/<yyyy-mm-dd>/<ip>/<n>, day/<yyyy-mm-dd>/<n>   접수 제한 카운터
 *    lock/<id>              발송 잠금(임대)
 *
 *  테스트: globalThis.__PROPOSAL_MEM = {} 를 두면 메모리에서 동작한다.
 *  v8 Blobs 에는 조건부 쓰기가 없어서, 잠금은 「쓰고-잠깐 기다렸다-다시 읽어 내 것인지 확인」 방식이다. */
let _gs = null;
async function blobs() {
  if (globalThis.__PROPOSAL_MEM) return null;
  if (!_gs) { const m = await import('@netlify/blobs'); _gs = m.getStore; }
  return _gs({ name: 'proposals', consistency: 'strong' });
}
const mem = () => globalThis.__PROPOSAL_MEM;

export async function getJSON(key) {
  const m = mem();
  if (m) return m[key] == null ? null : JSON.parse(m[key]);
  const s = await blobs();
  return (await s.get(key, { type: 'json' })) ?? null;
}
export async function setJSON(key, val) {
  const m = mem();
  if (m) { m[key] = JSON.stringify(val); return true; }
  const s = await blobs();
  await s.setJSON(key, val);
  return true;
}
export async function getBytes(key) {
  const m = mem();
  if (m) return m[key] ? new Uint8Array(m[key]) : null;
  const s = await blobs();
  const ab = await s.get(key, { type: 'arrayBuffer' });
  return ab ? new Uint8Array(ab) : null;
}
export async function setBytes(key, bytes) {
  const m = mem();
  if (m) { m[key] = Array.from(bytes); return true; }
  const s = await blobs();
  await s.set(key, bytes);
  return true;
}
export async function del(key) {
  const m = mem();
  if (m) { delete m[key]; return true; }
  const s = await blobs();
  await s.delete(key);
  return true;
}
export async function list(prefix, limit = 1000) {
  const m = mem();
  if (m) return Object.keys(m).filter(k => k.startsWith(prefix)).sort().slice(0, limit);
  const s = await blobs();
  const out = [];
  for await (const page of s.list({ prefix, paginate: true })) {
    for (const b of page.blobs || []) { out.push(b.key); if (out.length >= limit) return out.sort(); }
  }
  return out.sort();
}

/* 카운터 — 정확할 필요는 없다(동시 접수 시 1~2건 오차 허용). 키 개수로 센다 */
export async function bump(prefix) {
  const k = prefix + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  await setJSON(k, 1);
  return (await list(prefix + '/', 5000)).length;
}
export async function count(prefix) { return (await list(prefix + '/', 5000)).length; }

/* 발송 잠금 — ttl 동안 유효. 성공하면 해제 함수를 돌려준다 */
export async function lease(id, ttlMs = 120000) {
  const key = 'lock/' + id;
  const cur = await getJSON(key);
  if (cur && cur.until > Date.now()) return null;
  const nonce = Math.random().toString(36).slice(2) + Date.now();
  await setJSON(key, { nonce, until: Date.now() + ttlMs });
  await new Promise(r => setTimeout(r, mem() ? 1 : 350));
  const again = await getJSON(key);
  if (!again || again.nonce !== nonce) return null;
  return async () => { try { const x = await getJSON(key); if (x && x.nonce === nonce) await del(key); } catch (e) { /* 만료로 풀린다 */ } };
}

/* 작업 저장 — 읽고-고치고-쓰기. 작은 사업장 규모에서 충돌은 드물고, 충돌해도 알림 기록 한 줄 정도다 */
export const jobKey = id => 'job/' + id + '.json';
export async function getJob(id) { return /^[a-z0-9]{8,40}$/.test(String(id || '')) ? getJSON(jobKey(id)) : null; }
export async function saveJob(job) { job.updatedAt = new Date().toISOString(); job.rev = (job.rev || 0) + 1; return setJSON(jobKey(job.id), job); }
/* 읽고-고치고-쓰기. 쓰기 직전에 다시 읽어 그사이 다른 곳이 저장했으면 최신본으로 다시 한다(최대 3회).
   fn 안에서는 메일 발송 같은 부수 효과를 하지 말 것 — 재시도 때 두 번 일어날 수 있다. */
export async function patchJob(id, fn) {
  for (let i = 0; i < 3; i++) {
    const job = await getJob(id);
    if (!job) return null;
    const rev = job.rev || 0;
    const r = await fn(job);
    if (r === false) return job;
    const cur = await getJob(id);
    if (cur && (cur.rev || 0) !== rev) continue;
    await saveJob(job);
    return job;
  }
  return null;
}
export const queueKey = (due, id) => 'queue/' + String(Math.max(0, Math.floor(due))).padStart(13, '0') + '-' + id;
