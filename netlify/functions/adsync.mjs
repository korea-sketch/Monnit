/** 광고 지표 수집 — 매시간 어제·오늘 데이터를 갱신한다.
 *  키가 없는 채널은 건너뛴다. 한 채널이 실패해도 나머지는 계속 수집한다. */
import { append, set, get } from './_store.mjs';
import * as ads from './_ads.mjs';

export const config = { schedule: '17 * * * *' };   /* 매시 17분 (정각 혼잡 회피) */

async function upsert(key, row) {
  /* 같은 날짜·채널은 최신값으로 덮어쓴다 */
  const cur = (await get('ads', key)) || '';
  const keep = cur.split('\n').filter(Boolean).filter(l => {
    try { const o = JSON.parse(l); return !(o.date === row.date && o.channel === row.channel); }
    catch { return false; }
  });
  keep.push(JSON.stringify(row));
  return set('ads', key, keep.join('\n'));
}

export default async () => {
  const now = new Date();
  const days = [ads.kday(now), ads.kday(new Date(now - 864e5))];   /* 오늘·어제 */
  const month = d => d.slice(0, 7) + '.jsonl';
  const log = { ts: new Date().toISOString(), ok: [], skip: [], fail: [] };
  const cfg = ads.configured();

  for (const [name, fn] of [['meta', ads.meta], ['google', ads.google], ['naver', ads.naver]]) {
    if (!cfg[name]) { log.skip.push(name); continue; }
    for (const d of days) {
      try { const row = await fn(d); if (row) { await upsert(month(d), row); log.ok.push(name + ':' + d); } }
      catch (e) { log.fail.push(name + ':' + d + ' — ' + String(e?.message || e).slice(0, 100)); }
    }
  }

  if (cfg.ga4) {
    for (const d of days) {
      try { const r = await ads.ga4(d); if (r) await set('ads', 'ga4_' + d + '.json', JSON.stringify(r)); log.ok.push('ga4:' + d); }
      catch (e) { log.fail.push('ga4:' + d + ' — ' + String(e?.message || e).slice(0, 100)); }
    }
  } else log.skip.push('ga4');

  if (cfg.clarity) {
    try { const c = await ads.clarity(); if (c) await set('ads', 'clarity.json', JSON.stringify({ ...c, ts: log.ts })); log.ok.push('clarity'); }
    catch (e) { log.fail.push('clarity — ' + String(e?.message || e).slice(0, 100)); }
  } else log.skip.push('clarity');

  await set('ads', 'sync_log.json', JSON.stringify(log));
  return new Response(JSON.stringify(log), { headers: { 'content-type': 'application/json' } });
};
