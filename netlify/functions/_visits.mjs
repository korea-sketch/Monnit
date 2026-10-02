/** 방문 기록 조회 — visits 저장소 (2026-09-16)
 *  기록은 netlify/edge-functions/block-ip.js 가 한다. 키 = YYYY-MM-DD/IP/시각-난수
 *  여기서는 읽기·요약·정리만 한다. 실패해도 예외를 던지지 않는다. */
const KEEP_DAYS = 90;

let _gs = null;
async function store() {
  if (!_gs) { const m = await import('@netlify/blobs'); _gs = m.getStore; }
  return _gs({ name: 'visits', consistency: 'strong' });
}

export const kday = d => new Intl.DateTimeFormat('en-CA',
  { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const ipKey = ip => String(ip || '').toLowerCase().replace(/[^0-9a-f.]/g, '_');
export function days(n, from = new Date()) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(kday(new Date(from.getTime() - i * 86400000)));
  return [...new Set(out)];
}
const okDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const tsOf = key => Number(String(key).split('/')[2]?.split('-')[0]) || 0;

async function keys(prefix) {
  try {
    const s = await store();
    const r = await s.list({ prefix });
    return (r && r.blobs || []).map(b => b.key);
  } catch (e) { return []; }
}
async function read(key) {
  try { const s = await store(); return await s.get(key, { type: 'json' }); } catch (e) { return null; }
}

/** 서버 함수가 직접 남기는 기록 (자료 다운로드 등) */
export async function record(ip, obj) {
  try {
    if (process.env.VISIT_LOG === 'off' || !ip) return;
    const now = new Date();
    const s = await store();
    await s.setJSON(kday(now) + '/' + ipKey(ip) + '/' + now.getTime() + '-' + Math.random().toString(36).slice(2, 6),
      { ip, ...obj });
  } catch (e) { /* 무시 */ }
}

/** 하루치를 IP 별로 묶는다. 각 IP 의 가장 최근 기록 1건을 읽어 지역·기기를 붙인다. */
export async function daySummary(day, limit = 200) {
  if (!okDay(day)) return { day, ips: [], total: 0 };
  const ks = await keys(day + '/');
  const by = {};
  for (const k of ks) {
    const ik = k.split('/')[1];
    const t = tsOf(k);
    const o = by[ik] || (by[ik] = { key: ik, n: 0, first: t, last: t, lastKey: k });
    o.n++;
    if (t < o.first) o.first = t;
    if (t >= o.last) { o.last = t; o.lastKey = k; }
  }
  const list = Object.values(by).sort((a, b) => b.last - a.last).slice(0, limit);
  await Promise.all(list.map(async o => {
    const r = await read(o.lastKey) || {};
    o.ip = r.ip || o.key; o.ua = r.ua || ''; o.c = r.c || ''; o.r = r.r || ''; o.city = r.city || '';
    o.lastPage = r.p || ''; o.ref = r.ref || ''; o.b = r.b || 0;
    delete o.lastKey; delete o.key;
  }));
  return { day, total: ks.length, visitors: Object.keys(by).length, ips: list };
}

/** 한 IP 의 최근 n일 방문 내역 (최신순, 최대 max 건) */
export async function ipHistory(ip, n = 30, max = 300) {
  const ik = ipKey(ip);
  if (!ik) return [];
  let ks = [];
  for (const d of days(Math.min(Math.max(n, 1), KEEP_DAYS))) {
    ks = ks.concat(await keys(d + '/' + ik + '/'));
    if (ks.length >= max * 2) break;
  }
  ks.sort((a, b) => tsOf(b) - tsOf(a));
  ks = ks.slice(0, max);
  const rows = await Promise.all(ks.map(async k => ({ t: tsOf(k), ...(await read(k) || {}) })));
  return rows;
}

/** 90일 지난 기록 정리 — 한 번에 max 건까지만 (조회할 때 조금씩 돈다) */
export async function cleanup(max = 300) {
  try {
    const s = await store();
    const r = await s.list({ directories: true });
    const cut = kday(new Date(Date.now() - KEEP_DAYS * 86400000));
    const old = (r.directories || []).filter(d => okDay(d) && d < cut).sort();
    let n = 0;
    for (const d of old) {
      for (const k of await keys(d + '/')) {
        if (n >= max) return n;
        await s.delete(k); n++;
      }
    }
    return n;
  } catch (e) { return 0; }
}
