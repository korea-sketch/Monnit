/** 리드 원장(ops) → 먼데이 「리드 원장 (Lead CRM)」 자동 맞춤 (2026-10-28)
 *
 *  ── 왜 ──────────────────────────────────────────────────────────────
 *  대표 지시: 「먼데이 리드 원장만 보면 모든 리드가 다 보이게」.
 *  접수 순간의 먼데이 등록(pushLead)은 한 번만 시도한다. 그 순간 먼데이가 느리거나, 라벨이 안 맞거나
 *  (2026-10 「공장 설비 예지보전」 라벨 불일치로 백서 신청이 통째로 빠졌다), 함수가 시간 초과로 끊기면
 *  그 리드는 사이트 원장에만 있고 보드에는 영영 없었다.
 *
 *  이제 15분마다(health 예약 함수) 원장을 훑어, 보드에 없는 접수를 채운다.
 *    · 이미 올린 건(ops/monday.json 지도)은 건너뛴다
 *    · 지도에는 없지만 보드에 같은 사람(이메일·전화)·같은 접수일 아이템이 있으면 — 사람이 손으로 넣은 것 —
 *      새로 만들지 않고 지도에만 적는다(중복 방지)
 *    · 테스트 접수 · 관제에서 지운 접수는 올리지 않는다
 *    · 기술지원(AS) 접수도 리드 원장에 함께 올린다(기술지원 보드는 그대로 유지)
 *
 *  환경변수
 *    MONDAY_SYNC_FROM   이 날짜(KST, YYYY-MM-DD) 이후 접수만 맞춘다. 기본 2026-09-06 (먼데이 자동 등록 시작 다음 날)
 *    MONDAY_SYNC_MAX    한 번에 새로 만들 최대 건수. 기본 15
 *    MONDAY_SYNC_OFF=1  끈다
 */
import { get, readLines } from './_store.mjs';
import { pushLead, readMap, writeMap, boardIndex, dupKey, isTestLead } from './_monday.mjs';

const env = (k, d = '') => {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};

const kday = d => new Date(new Date(d).getTime() + 324e5).toISOString().slice(0, 10);
export const idOf = r => (r.ts || '') + '|' + (r.email || r.phone || r.company || '');

async function readDeleted() {
  try { return JSON.parse(await get('ops', 'deleted.json') || '{}'); } catch { return {}; }
}

/** 한 번 돈다. { checked, missing, created, linked, failed[] } — 절대 throw 하지 않는다 */
export async function syncOnce(opts = {}) {
  try {
    if (env('MONDAY_SYNC_OFF') === '1') return { skipped: 'off' };
    if (!env('MONDAY_TOKEN')) return { skipped: 'MONDAY_TOKEN 없음' };
    const FROM = opts.from || env('MONDAY_SYNC_FROM', '2026-09-06');
    const MAX = Number(opts.max || env('MONDAY_SYNC_MAX', '15')) || 15;

    /* 이번 달 + 지난달 (KST) */
    const now = Date.now();
    const keys = [...new Set([0, 1].map(i => kday(now - i * 30.5 * 864e5).slice(0, 7) + '.jsonl'))];
    let rows = [];
    for (const k of keys) rows = rows.concat(await readLines('leads', k));
    const deleted = await readDeleted();
    rows = rows.filter(r => r && r.ts && !/^__/.test(r.company || '') && kday(r.ts) >= FROM
      && !r.test && !isTestLead(r) && !deleted[idOf(r)]
      /* 방금 들어온 접수는 접수 경로가 지금 올리는 중일 수 있다 — 10분 지난 것만 */
      && now - new Date(r.ts).getTime() > 10 * 60 * 1000);

    const map = await readMap();
    const missing = rows.filter(r => !map[idOf(r)]);
    if (!missing.length) return { checked: rows.length, missing: 0, created: 0, linked: 0 };

    /* 보드에 이미 있는지 — 사람이 손으로 넣었거나, 지도 기록만 날아간 건 */
    let idx = [];
    try { idx = await boardIndex(); } catch (e) { return { checked: rows.length, missing: missing.length, created: 0, linked: 0, failed: [{ error: '보드 읽기 실패: ' + e.message }] }; }
    const byEmailDay = new Map(), byPhoneDay = new Map();
    for (const it of idx) {
      if (it.email) byEmailDay.set(it.email + '|' + it.date, it.id);
      if (it.phone) byPhoneDay.set(it.phone + '|' + it.date, it.id);
    }

    const link = {};
    const mapped = new Set(Object.values(map).map(String));
    let created = 0, linked = 0;
    const failed = [];
    /* 오래된 것부터 — 그래야 그룹 맨 위에 최신이 남는다 */
    missing.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    for (const r of missing) {
      const day = kday(r.ts);
      const em = String(r.email || '').trim().toLowerCase();
      const ph = String(r.phone || '').replace(/[^0-9]/g, '');
      const hit = (em && byEmailDay.get(em + '|' + day)) || (ph && byPhoneDay.get(ph + '|' + day));
      const dk = dupKey(r);
      /* 보드에 같은 사람·같은 날 아이템이 있는데 아직 어느 접수와도 이어지지 않았다 → 사람이 손으로 넣은 것.
         새로 만들지 않고 그 아이템으로 이어 둔다. 이미 다른 접수의 아이템이면(같은 날 다른 신청) 새로 만든다. */
      if (hit && !mapped.has(String(hit))) {
        link[idOf(r)] = hit; if (dk) link[dk] = hit; mapped.add(String(hit)); linked++; continue;
      }
      if (created >= MAX) continue;
      const p = await pushLead(idOf(r), r);
      if (p.ok && !p.skipped) { created++; mapped.add(String(p.itemId)); }
      else if (!p.ok) failed.push({ id: idOf(r), company: r.company || '', error: p.error || p.skipped || '' });
    }
    if (Object.keys(link).length) await writeMap(link);
    return { checked: rows.length, missing: missing.length, created, linked, remaining: Math.max(0, missing.length - created - linked - failed.length), failed };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}
