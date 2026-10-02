/* 현장 진단 예약 — 시간 잡기·이중 예약·하루 최대 건수·관리 화면 해제 (2026-09-17)
   실행: node tools/test-visit.mjs   (저장소 루트에서) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const F = path.join(process.cwd(), 'netlify/functions/');
globalThis.__MEM = {};
fs.writeFileSync(F + '_store_mem_v.mjs', `
export async function get(s,k){return (globalThis.__MEM[s]||{})[k]||null;}
export async function set(s,k,t){if(globalThis.__STORE_DOWN)return false;(globalThis.__MEM[s]=globalThis.__MEM[s]||{})[k]=t;return true;}
`);
fs.writeFileSync(F + '_visitadmin_test.mjs', fs.readFileSync(F + 'visitadmin.mjs', 'utf8').replace("from './_store.mjs'", "from './_store_mem_v.mjs'"));
process.env.VISIT_USER = 'staff'; process.env.VISIT_PASS = 'pw-1234';

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + String(JSON.stringify(got)).slice(0, 240))); if (!c) fail++; };
try {
  const V = (await import(F + '_visitadmin_test.mjs')).default;
  const auth = await import(F + '_visit_auth.mjs');
  const call = async (p, { method = 'GET', body, headers = {} } = {}) => {
    const r = await V(new Request('https://monnit.co.kr' + p, { method, headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': headers.ip || '198.51.100.1', ...headers }, body: body ? JSON.stringify(body) : undefined }), {});
    let j = null; try { j = await r.json(); } catch (e) {}
    return { s: r.status, j };
  };
  /* KST 기준 다음 평일 10:00 (리드타임 72시간 이후) */
  const kst = (d, hm) => new Date(`${d}T${hm}:00+09:00`).toISOString();
  const nextBiz = (after) => {
    let t = Date.now() + after * 86400000;
    for (;;) { const d = new Date(t + 9 * 3600000); const w = d.getUTCDay(); const k = d.toISOString().slice(0, 10);
      if (w >= 1 && w <= 5 && !['2026-09-24', '2026-09-25', '2026-10-05', '2026-10-09'].includes(k)) return k; t += 86400000; }
  };
  const D = nextBiz(5), D2 = nextBiz(12);

  let r = await call('/visit/config');
  ok('설정 읽기 — 저장 전에도 taken 목록', r.s === 200 && Array.isArray(r.j.taken) && r.j.taken.length === 0, r);

  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '10:00'), code: 'MV-A1', company: '에이정밀' } });
  ok('예약 시간 잡기 → ok', r.s === 200 && r.j.ok, r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '10:00'), code: 'MV-A1', company: '에이정밀' } });
  ok('같은 예약 다시 보냄(새로고침·재시도) → ok(중복 저장 안 함)', r.s === 200 && r.j.again, r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '10:00'), code: 'MV-B1' }, headers: { ip: '198.51.100.2' } });
  ok('같은 시간 다른 고객 → 409 taken', r.s === 409 && r.j.error === 'taken', r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '11:00'), code: 'MV-B2' }, headers: { ip: '198.51.100.2' } });
  ok('앞 예약 끝(11:00) 직후 → 이동 버퍼(60분) 때문에 409', r.s === 409 && r.j.error === 'taken', r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '14:30'), code: 'MV-B3' }, headers: { ip: '198.51.100.2' } });
  ok('버퍼 밖 시간 → ok', r.s === 200 && r.j.ok, r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '09:30'), code: 'MV-C1' }, headers: { ip: '198.51.100.3' } });
  ok('하루 최대 2건 초과 → 409 full', r.s === 409 && ['full', 'taken'].includes(r.j.error), r);

  for (const [name, start] of [
    ['점심시간', kst(D2, '12:00')], ['업무 종료 뒤', kst(D2, '15:30')], ['업무 시작 전', kst(D2, '08:00')],
    ['30분 단위가 아님', kst(D2, '10:10')], ['과거', new Date(Date.now() - 3600000).toISOString()],
    ['리드타임(72시간) 안', new Date(Date.now() + 3600000).toISOString()],
    ['주말', kst((() => { let t = Date.parse(D2 + 'T12:00:00+09:00'); for (;;) { t += 86400000; if (new Date(t + 9 * 3600000).getUTCDay() === 6) return new Date(t + 9 * 3600000).toISOString().slice(0, 10); } })(), '10:00')]
  ]) {
    r = await call('/visit/hold', { method: 'POST', body: { start, code: 'MV-X' + name.length }, headers: { ip: '198.51.100.9' } });
    ok('고를 수 없는 시간(' + name + ') → 409', r.s === 409 && r.j.error === 'unavailable', r);
  }
  r = await call('/visit/hold', { method: 'POST', body: { start: 'abc', code: 'MV-Z' } });
  ok('잘못된 시각 → 400', r.s === 400, r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D2, '10:00') } });
  ok('예약코드 없음 → 400', r.s === 400, r);
  r = await call('/visit/hold', { method: 'GET' });
  ok('GET → 405', r.s === 405, r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D2, '10:00'), code: 'MV-CS' }, headers: { 'sec-fetch-site': 'cross-site' } });
  ok('다른 사이트에서 → 403', r.s === 403, r);

  /* 같은 IP 가 하루에 여러 시간을 잡아 달력을 막는 것 방지 */
  const codes = [];
  const rdays = [];
  for (let k = 20; rdays.length < 3; k++) { const d = nextBiz(k); if (!rdays.includes(d)) rdays.push(d); }
  for (const [i, hm] of ['09:30', '13:00', '14:30'].entries()) { const d = rdays[i]; r = await call('/visit/hold', { method: 'POST', body: { start: kst(d, hm), code: 'MV-R' + i }, headers: { ip: '203.0.113.50' } }); codes.push(r.s); }
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(nextBiz(30), '10:00'), code: 'MV-R9' }, headers: { ip: '203.0.113.50' } });
  ok('같은 IP 하루 3건까지, 4건째 → 429', codes.every(c => c === 200) && r.s === 429, { codes, last: r });

  r = await call('/visit/config');
  const t = r.j.taken;
  ok('고객 화면에 잡힌 시간 전달(날짜·시각만)', t.some(x => x.d === D && x.s === '10:00' && x.e === '11:00') && !JSON.stringify(t).includes('에이정밀') && !JSON.stringify(t).includes('MV-'), t);

  /* 고객 화면 엔진(visit-core.js)이 잡힌 시간을 빼는지 */
  const ctx = { window: {}, Intl, Date, JSON, Math, URLSearchParams, location: { search: '' }, fetch: async () => ({ ok: true, json: async () => ({ ok: true, cfg: null, taken: t }) }), btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('visit-core.js', 'utf8'), ctx);
  const Core = ctx.window.VisitCore;
  const rc = await Core.resolveCfg();
  const slots = Core.slotsFor(rc.cfg, D).map(x => x.hm);
  ok('예약 화면 — 잡힌 날은 「예약 마감」', slots.length === 0 && Core.dayStatus(rc.cfg, D).why === '예약 마감', { slots, st: Core.dayStatus(rc.cfg, D) });
  const d20 = nextBiz(20);
  const s20 = Core.slotsFor(rc.cfg, d20).map(x => x.hm);
  ok('예약 화면 — 1건 잡힌 날은 그 시간·버퍼만 빠짐', !s20.includes('09:30') && !s20.includes('10:00') && s20.includes('13:00'), s20);
  const plain = Core.slotsFor({ ...rc.cfg, taken: [] }, d20).map(x => x.hm);
  ok('예약 화면 — 잡힌 시간이 없으면 그대로', plain.includes('09:30'), plain);

  /* 관리 화면 */
  r = await call('/visit/admin/holds');
  ok('관리 — 로그인 없이 목록 → 401', r.s === 401, r);
  const cookie = auth.setCookie ? String(auth.setCookie(auth.issue ? auth.issue() : '')).split(';')[0] : '';
  const hc = { cookie };
  r = await call('/visit/admin/holds', { headers: hc });
  ok('관리 — 잡힌 예약 목록(회사명 포함)', r.s === 200 && r.j.holds.some(h => h.code === 'MV-A1' && h.company === '에이정밀'), r);
  r = await call('/visit/admin/holds', { method: 'POST', body: { release: 'MV-A1' }, headers: hc });
  ok('관리 — 해제', r.s === 200 && !r.j.holds.some(h => h.code === 'MV-A1'), r);
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(D, '10:00'), code: 'MV-B9' }, headers: { ip: '198.51.100.7' } });
  ok('해제한 시간은 다시 예약 가능', r.s === 200, r);

  /* 저장소 장애 → 503 (고객 화면은 예전처럼 접수 진행) */
  globalThis.__STORE_DOWN = true;
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(nextBiz(40), '10:00'), code: 'MV-S1' }, headers: { ip: '198.51.100.8' } });
  ok('저장소 장애 → 503', r.s === 503, r);
  globalThis.__STORE_DOWN = false;

  /* 관리 설정의 하루 최대 건수 1 로 바꾸면 적용 */
  __MEM.visit['config.json'] = JSON.stringify({ cfg: { workdays: [1, 2, 3, 4, 5], maxPerDay: 1 }, savedAt: '' });
  const d44 = nextBiz(44);
  await call('/visit/hold', { method: 'POST', body: { start: kst(d44, '09:30'), code: 'MV-M1' }, headers: { ip: '198.51.100.11' } });
  r = await call('/visit/hold', { method: 'POST', body: { start: kst(d44, '14:30'), code: 'MV-M2' }, headers: { ip: '198.51.100.12' } });
  ok('하루 최대 1건 설정 → 두 번째 409', r.s === 409 && r.j.error === 'full', r);

  /* 예약 화면 소스 — 접수 흐름 */
  const html = fs.readFileSync('visit.html', 'utf8');
  ok('예약 화면 — 시간 잡기 후 메일 전송', /holdSlot\(b\)\.then/.test(html) && /sendBooking\(b\)\.then\(function\(mailed\)/.test(html), '');
  ok('예약 화면 — 브라우저 메일이 나가면 서버 알림 생략(notified)', /notified:!!mailed/.test(html), '');
  ok('예약 화면 — 브라우저 메일이 실패해도 원장 기록·서버 알림', /logLead\(b,mailed\)\.then\(function\(logged\)\{ finish\(b, mailed\|\|logged\)/.test(html), '');
} finally {
  for (const f of ['_store_mem_v.mjs', '_visitadmin_test.mjs']) try { fs.unlinkSync(F + f); } catch (e) {}
}
console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 예약 시스템 전부 통과');
process.exit(fail ? 1 : 0);
