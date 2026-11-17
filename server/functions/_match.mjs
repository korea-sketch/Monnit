/** 맞견적(MatchQuote) — 환산 기준 · 저장소 (2026-11-16)
 *
 *  단가·상한·프로모션은 여기(서버)에만 둔다. 공개 스크립트(js/match-core.js)에는 숫자가 없다.
 *  /ops/enablement 「환산 기준」 탭에서 고치면 R2 match/config.json 에 저장되고, 아래 기본값 위에 덮인다.
 *
 *  기본 단가는 2026-11 기준 정가(VAT 별도)다. price 가 0 인 종류는 「담당자 확인」으로 나가고
 *  그 견적은 '부분 산정'으로 표시된다 — 단가가 정해지면 관제 화면에서 채워 넣는다.
 */
import { get, set, append, readLines } from './_store.mjs';
import core from '../../js/match-core.js';
import { getStore } from '../lib/blobs.mjs';

export const M = core.MonnitMatch;
export const STORE = 'match';

export const DEFAULT_CFG = {
  catalog: {
    temp:     { name: '무선 온도 센서',                 price: 220000 },
    temphum:  { name: '무선 온습도 센서',               price: 350000 },
    dry:      { name: '무선 무전압접점(드라이컨택) 센서', price: 250000 },
    volt:     { name: '무선 AC/DC 전압감지 센서',        price: 360000 },
    water:    { name: '무선 물감지 센서(플로트)',        price: 280000 },
    rope:     { name: '무선 물감지 로프 센서',           price: 440000, note: '누수감지 케이블 기본 3m 포함 · 연장 케이블은 길이에 따라 추가' },
    pressure: { name: '산업용 무선 압력 센서',           price: 1050000 },
    thermo:   { name: '산업용 무선 열전대(K-Type) 센서', price: 560000 },
    button:   { name: '무선 비상벨(버튼) 센서',          price: 300000 },
    door:     { name: '무선 도어(개폐) 센서',            price: 240000 },
    motion:   { name: '무선 동작감지 센서',              price: 260000 },
    /* 아래는 단가 미입력 — 관제 화면에서 넣기 전까지 「담당자 확인」으로 나간다 */
    vib:      { name: '무선 진동 센서',                  price: 0 },
    current:  { name: '무선 전류 센서',                  price: 0 },
    dp:       { name: '무선 차압 센서',                  price: 0 },
    gas:      { name: '무선 가스 센서',                  price: 0 },
    other:    { name: '대응 센서 확인',                  price: 0 }
  },
  gateway: {
    capacity: 250,   /* 게이트웨이 1대당 센서 수 */
    lte: { name: 'IoT 게이트웨이 (LTE 유심 내장)', price: 900000 },
    lan: { name: '이더넷 게이트웨이',             price: 470000 }
  },
  platform: {
    cap: 1500000,    /* 플랫폼 비용 상한 — 어떤 구성이든 이 금액을 넘기지 않는다 */
    cloud: { name: 'iMonnit Cloud 플랫폼',      annual: 300000, note: '연 구독 · 최소 센싱주기 10분 · Open API(Webhook)·MQTT 지원' },
    scube: { name: 'iMonnit Scube 전용 플랫폼', annual: 500000, note: '연 구독 · 문자메시지 알람 · 시스템 알람' }
  },
  install: {
    selfNote: '배선 공사가 없는 940MHz 무선 방식, 센서는 자석으로 붙이고 게이트웨이는 전원만 연결합니다',
    assistBase: 0,       /* 설치 대행 — 현장 1곳당 기본료. 0 이면 「현장 확인 뒤 안내」로 나간다 */
    assistPerPoint: 0    /* 설치 대행 — 센서 1개당 */
  },
  /* 통신비 — 비워 두면(0) 금액 없이 안내 문구만 나간다. 실제 과금 조건에 맞게 관제 화면에서 넣는다 */
  comm: { lte: 0, lan: 0, note: { lte: 'LTE 유심 내장 게이트웨이, 현장 인터넷 회선이 필요 없습니다', lan: '현장 유선 인터넷(랜)에 연결합니다' } },
  promo: { platformFirstYearFree: false, installFree: false, label: '' },
  warrantyNote: '제품 기본 보증 1년',
  /* 고객 화면 맨 아래 고지 */
  disclaimer: '모넷 금액은 견적서 품목을 같은 조건으로 바꿔 본 예상 금액(VAT 별도)입니다. 정식 견적서는 담당자가 센서 용도와 게이트웨이 수신 범위, 수량을 확인한 뒤 발행하며 그 금액이 기준입니다.',
  /* 고객 화면의 모넷 금액 구간 — 계산값에서 아래로 down%, 위로 up% (7차 2026-11-16). 고객에게는 정확한 금액·단가를 내보내지 않는다 */
  range: { down: 10, up: 15 },
  /* 외화 견적서 환산 (9차 2026-11-17) — 견적서에 환율이 적혀 있으면 그 값을 쓰고, 없으면 이 값(1 외화 = 원)을 쓴다. 관제 「환산 기준」에서 고친다 */
  fx: { USD: 1500, EUR: 1700, JPY: 10, CNY: 205 },
  gateDetail: true
};

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
function merge(a, b) {
  if (!isObj(b)) return a;
  const o = { ...a };
  for (const k of Object.keys(b)) o[k] = isObj(a[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k];
  return o;
}
const num = (v, max = 1e9) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && x <= max ? x : 0; };
const str = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n).trim();

/** 관제 화면에서 온 설정 정리 — 아는 칸만, 범위 안에서만 */
export function cleanCfg(inp) {
  const d = DEFAULT_CFG, o = merge(d, isObj(inp) ? inp : {});
  const cat = {};
  for (const k of Object.keys(d.catalog)) cat[k] = { name: str((o.catalog[k] || {}).name, 60) || d.catalog[k].name, price: num((o.catalog[k] || {}).price, 5e7), ...(str((o.catalog[k] || {}).note, 160) ? { note: str(o.catalog[k].note, 160) } : {}) };
  const cap = num(o.platform.cap, 1e8) || d.platform.cap;
  const pf = (k) => ({ name: str(o.platform[k].name, 60) || d.platform[k].name, annual: Math.min(num(o.platform[k].annual, 1e8), cap), note: str(o.platform[k].note, 160) });
  return {
    catalog: cat,
    gateway: { capacity: Math.max(1, num(o.gateway.capacity, 4000)) || 250,
      lte: { name: str(o.gateway.lte.name, 60) || d.gateway.lte.name, price: num(o.gateway.lte.price, 5e7) },
      lan: { name: str(o.gateway.lan.name, 60) || d.gateway.lan.name, price: num(o.gateway.lan.price, 5e7) } },
    platform: { cap, cloud: pf('cloud'), scube: pf('scube') },
    install: { selfNote: str(o.install.selfNote, 200), assistBase: num(o.install.assistBase, 1e8), assistPerPoint: num(o.install.assistPerPoint, 1e7) },
    comm: { lte: num(o.comm.lte, 1e8), lan: num(o.comm.lan, 1e8), note: { lte: str((o.comm.note || {}).lte, 200), lan: str((o.comm.note || {}).lan, 200) } },
    promo: { platformFirstYearFree: !!o.promo.platformFirstYearFree, installFree: !!o.promo.installFree, label: str(o.promo.label, 40) },
    warrantyNote: str(o.warrantyNote, 120) || d.warrantyNote,
    disclaimer: str(o.disclaimer, 400) || d.disclaimer,
    range: { down: Math.min(50, num((o.range || {}).down, 50)), up: Math.min(100, num((o.range || {}).up, 100)) || d.range.up },
    fx: Object.fromEntries(Object.keys(d.fx).map((k) => { const v = Number((o.fx || {})[k]); return [k, Number.isFinite(v) && v > 0 && v < 1e5 ? Math.round(v * 100) / 100 : d.fx[k]]; })),
    gateDetail: o.gateDetail !== false
  };
}

let _cfg = null;
export async function readCfg(fresh) {
  if (_cfg && !fresh && Date.now() - _cfg.at < 60e3) return _cfg.v;
  let saved = null;
  try { const t = await get(STORE, 'config.json'); if (t) saved = JSON.parse(t); } catch (e) { /* 기본값 */ }
  const v = cleanCfg(saved || {});
  _cfg = { at: Date.now(), v };
  return v;
}
export async function saveCfg(inp) {
  const v = cleanCfg(inp);
  const ok = await set(STORE, 'config.json', JSON.stringify(v));
  if (ok) _cfg = { at: Date.now(), v };
  return ok ? v : null;
}

/* ── 맞견적 기록 — match/q-YYYY-MM (조각 원장) ───────────────── */
export const kday = (t) => new Date(new Date(t).getTime() + 324e5).toISOString().slice(0, 10);
export const kmonth = (t) => kday(t).slice(0, 7);
export function newId(ts = Date.now()) {
  const d = kday(ts).replace(/-/g, '').slice(2);
  return 'MG-' + d + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}
export async function record(rec) { return append(STORE, 'q-' + kmonth(rec.ts || Date.now()), rec); }
export async function readRecords(fromMs, toMs = Date.now()) {
  const yms = new Set(); for (let t = fromMs; t <= toMs + 864e5; t += 20 * 864e5) yms.add(kmonth(t)); yms.add(kmonth(toMs));
  let out = [];
  for (const ym of [...yms].sort()) out = out.concat(await readLines(STORE, 'q-' + ym).catch(() => []));
  return out.filter((r) => r && r.ts && new Date(r.ts).getTime() >= fromMs);
}

/* ── 작은 JSON 문서 (코호트 키트 · 고객 평가) ─────────────────── */
export async function readDoc(key, dflt = {}) { try { const t = await get(STORE, key); return t ? JSON.parse(t) : dflt; } catch (e) { return dflt; } }
export async function writeDoc(key, obj) { return set(STORE, key, JSON.stringify(obj)); }

/* ── 견적서 파일(사진·PDF) — match/f/<YYYY-MM>/<cid>/<파일> (2026-11-16 3차) ─────
   고객이 올린 원본을 그대로 둔다. 공개 주소는 없고 /ops/enablement/file 로만 열린다. */
export async function putFile(key, buf, meta) {
  const F = globalThis.__MNK_FAKE_BLOBS;
  if (F) return F.set(STORE, key, 'b64:' + Buffer.from(buf).toString('base64'));
  try { await getStore(STORE).set(key, buf, { metadata: meta || {} }); return true; } catch (e) { return false; }
}
export async function getFile(key) {
  const F = globalThis.__MNK_FAKE_BLOBS;
  if (F) { const t = await F.get(STORE, key); return t ? Buffer.from(String(t).replace(/^b64:/, ''), 'base64') : null; }
  try { return await getStore(STORE).get(key, { type: 'arrayBuffer' }); } catch (e) { return null; }
}
/* 조각 원장 읽기 — prefix: 'q-' 접수 · 'a-' 품목 · 'u-' 올린 파일 */
export async function readLedger(prefix, fromMs, toMs = Date.now()) {
  const yms = new Set(); for (let t = fromMs; t <= toMs + 864e5; t += 20 * 864e5) yms.add(kmonth(t)); yms.add(kmonth(toMs));
  let out = [];
  for (const ym of [...yms].sort()) out = out.concat(await readLines(STORE, prefix + ym).catch(() => []));
  return out.filter((r) => r && r.ts && new Date(r.ts).getTime() >= fromMs);
}
