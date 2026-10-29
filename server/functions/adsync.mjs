/** 광고 지표 수집 — 매시간 실행.
 *  · 구글: 시트 전체 이력을 통째로 갱신 (요청 1회, 과거분까지 항상 정확)
 *  · 메타/네이버: 최근 8일 (새벽 6시대에는 60일까지 소급해 과거를 채운다)
 *  키가 없는 채널은 건너뛴다. 한 채널이 실패해도 나머지는 계속 수집한다. */
import { set, get } from './_store.mjs';
import * as ads from './_ads.mjs';

export const config = { schedule: '17 * * * *' };   /* 매시 17분 (정각 혼잡 회피) */

const month = d => d.slice(0, 7) + '.jsonl';

/* 같은 날짜·채널은 최신값으로 덮어쓴다. 여러 건을 한 번에 처리해 쓰기 횟수를 줄인다. */
async function upsertMany(rows) {
  const byMonth = {};
  for (const r of rows) (byMonth[month(r.date)] ||= []).push(r);

  let n = 0;
  for (const [key, list] of Object.entries(byMonth)) {
    const cur = (await get('ads', key)) || '';
    const drop = new Set(list.map(r => r.date + '|' + r.channel));
    const keep = cur.split('\n').filter(Boolean).filter(l => {
      try { const o = JSON.parse(l); return !drop.has(o.date + '|' + o.channel); }
      catch { return false; }
    });
    for (const r of list) keep.push(JSON.stringify(r));
    keep.sort();                                   /* 날짜순 유지 */
    await set('ads', key, keep.join('\n'));
    n += list.length;
  }
  return n;
}

/* 소재(광고) 단위 — 같은 날짜·광고ID는 최신값으로 덮어쓴다 */
async function upsertAds(rows) {
  const byMonth = {};
  for (const r of rows) (byMonth[month(r.date)] ||= []).push(r);
  let n = 0;
  for (const [key, list] of Object.entries(byMonth)) {
    const cur = (await get('adcreatives', key)) || '';
    const drop = new Set(list.map(r => r.date + '|' + r.ad_id));
    const keep = cur.split('\n').filter(Boolean).filter(l => {
      try { const o = JSON.parse(l); return !drop.has(o.date + '|' + o.ad_id); }
      catch { return false; }
    });
    for (const r of list) keep.push(JSON.stringify(r));
    keep.sort();
    await set('adcreatives', key, keep.join('\n'));
    n += list.length;
  }
  return n;
}

export default async () => {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB',
    { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(now));

  /* 평소 8일 · 새벽 6시대에는 60일 소급 (누락분 자동 복구) */
  const span = hour === 6 ? 60 : 8;
  const days = [];
  for (let i = 0; i < span; i++) days.push(ads.kday(new Date(now - i * 864e5)));

  const log = { ts: new Date().toISOString(), span, ok: [], skip: [], fail: [] };
  const cfg = ads.configured();

  /* ── 구글: 시트 전체를 한 번에 (요청 1회로 전 기간 정확) ───────── */
  if (cfg.google) {
    try {
      const all = await ads.googleAll();
      if (all && all.length) { await upsertMany(all); log.ok.push('google:' + all.length + '일'); }
      else log.fail.push('google — 시트에 읽을 행이 없습니다(웹에 게시가 CSV 인지 확인)');
    } catch (e) { log.fail.push('google — ' + String(e?.message || e).slice(0, 120)); }
  } else log.skip.push('google');

  /* ── 메타: 하루씩 (계정 합계) ─────────────────────────────── */
  if (cfg.meta) {
    const rows = [];
    for (const d of days) {
      try { const r = await ads.meta(d); if (r) rows.push(r); }
      catch (e) { log.fail.push('meta:' + d + ' — ' + String(e?.message || e).slice(0, 80)); }
    }
    if (rows.length) { await upsertMany(rows); log.ok.push('meta:' + rows.length + '일'); }
  } else log.skip.push('meta');

  /* ── 네이버: 캠페인 목록을 한 번만 받고 날짜별로 조회 ──────────
     캠페인 단위까지 저장해 타임라인에 쓴다. */
  if (cfg.naver) {
    try {
      const camps = await ads.naverCampaigns();
      if (!camps || !camps.length) {
        log.fail.push('naver — 캠페인이 없습니다(고객 ID 확인)');
      } else {
        const totals = [], perCamp = [];
        for (const d of days) {
          try {
            const rows = await ads.naverAds(d, camps);
            for (const x of (rows || [])) perCamp.push(x);
            const t = (rows || []).reduce((a, r) => {
              a.spend += r.spend; a.impressions += r.impressions;
              a.clicks += r.clicks; a.results += r.results; return a;
            }, { spend: 0, impressions: 0, clicks: 0, results: 0 });
            totals.push({ channel: '네이버', date: d, ...t });
          } catch (e) { log.fail.push('naver:' + d + ' — ' + String(e?.message || e).slice(0, 80)); }
        }
        if (totals.length) { await upsertMany(totals); log.ok.push('naver:' + totals.length + '일'); }
        if (perCamp.length) { await upsertAds(perCamp); log.ok.push('naver캠페인:' + perCamp.length + '행'); }
      }
    } catch (e) { log.fail.push('naver — ' + String(e?.message || e).slice(0, 120)); }
  } else log.skip.push('naver');

  /* ── 메타 소재 단위 + 광고↔utm_content 지도 ─────────────────
     소재별 지출을 알아야 "어느 소재가 얼마에 리드를 만들었나"가 나온다.
     지도는 하루 한 번(6시대)만 갱신한다. */
  /* 소재별 지출은 하루 3번이면 충분하다(정산 후엔 값이 거의 안 변한다).
     매시 돌리면 메타 API 호출이 배로 늘어날 뿐이다. */
  if (cfg.meta && [7, 13, 20].includes(hour)) {
    let map = {};
    try { map = JSON.parse(await get('adcreatives', 'admap.json') || '{}'); } catch {}
    if (hour === 6 || !Object.keys(map).length) {
      try {
        const fresh = await ads.metaAdMap();
        if (fresh && Object.keys(fresh).length) {
          map = fresh;
          await set('adcreatives', 'admap.json', JSON.stringify(map));
          log.ok.push('meta지도:' + Object.keys(map).length + '개');
        }
      } catch (e) { log.fail.push('meta지도 — ' + String(e?.message || e).slice(0, 100)); }
    }
    const arows = [];
    for (const d of days) {
      try {
        const list = await ads.metaAds(d);
        for (const x of (list || [])) {
          const m = map[x.ad_id] || {};
          arows.push({ ...x, utm_content: m.utm_content || '', created_at: m.created_at || '' });
        }
      } catch (e) { log.fail.push('meta소재:' + d + ' — ' + String(e?.message || e).slice(0, 80)); }
    }
    if (arows.length) { await upsertAds(arows); log.ok.push('meta소재:' + arows.length + '행'); }
  }

  /* ── GA4: 최근 3일 (호출이 무거워 제한) ────────────────────── */
  if (cfg.ga4) {
    for (const d of days.slice(0, 3)) {
      try { const r = await ads.ga4(d); if (r) { await set('ads', 'ga4_' + d + '.json', JSON.stringify(r)); log.ok.push('ga4:' + d); } }
      catch (e) { log.fail.push('ga4:' + d + ' — ' + String(e?.message || e).slice(0, 80)); }
    }
  } else log.skip.push('ga4');

  /* ── Clarity: API 한도가 하루 10회라 07·14·21시에만 호출 (하루 6요청) ── */
  if (cfg.clarity) {
    if ([7, 14, 21].includes(hour)) {
      try {
        const today = ads.kday(now);
        const [c, pages] = await Promise.all([ads.clarity(1), ads.clarityPages(3)]);
        if (c) {
          let hist = {};
          try { hist = JSON.parse(await get('ads', 'clarity_daily.json') || '{}'); } catch {}
          hist[today] = { ...c, ts: log.ts };
          const keys = Object.keys(hist).sort();
          while (keys.length > 90) delete hist[keys.shift()];
          await set('ads', 'clarity_daily.json', JSON.stringify(hist));
          await set('ads', 'clarity.json', JSON.stringify({ ...c, ts: log.ts }));
        }
        if (pages) await set('ads', 'clarity_pages.json', JSON.stringify({ ts: log.ts, rows: pages }));
        log.ok.push('clarity' + (pages ? '(+페이지 ' + pages.length + ')' : ''));
      } catch (e) { log.fail.push('clarity — ' + String(e?.message || e).slice(0, 120)); }
    } else log.skip.push('clarity(호출시각 아님)');
  } else log.skip.push('clarity');

  await set('ads', 'sync_log.json', JSON.stringify(log));
  return new Response(JSON.stringify(log), { headers: { 'content-type': 'application/json' } });
};
