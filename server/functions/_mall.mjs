/** IoT몰(/mall) · 제품몰(/store) 견적 — 저장 · 받는 사람 · 메일 (2026-11-04)
 *
 *  데이터가 남는 곳 (R2 「mall」 저장소)
 *    q-YYYY-MM          견적 요청 한 건씩 (품목·수량·구매 조건까지 구조화) — lead.mjs 가 접수 때 기록
 *    ev-YYYY-MM         몰 이용 기록 — 방문 세션 하나당 한 줄(본 제품 · 담은 제품 · 검색어 · 업종 구성)
 *    status.json        견적별 처리 상태 · 메모 (/ops/mall 에서 바꾼다)
 *    recipients.json    견적 알림 받는 사람 (/ops/mall 에서 추가·삭제)
 *  같은 접수는 리드 원장(leads) · 먼데이 리드 보드 · 알림함에도 그대로 남는다.
 *
 *  받는 사람 기본값 — 대표 지시(2026-11-04): 염정훈 대표 · 장일호 팀장 · 황미경 매니저
 *    황미경 매니저 주소는 /ops/mall 「알림 받는 사람」에서 넣는다(환경변수 MALL_NOTIFY_TO 로도 가능).
 *    1015@monnit.com 은 _staffto.mjs 규칙대로 항상 들어간다.
 */
import { get, set, append } from './_store.mjs';

const env = (k, d = '') => {
  try { const v = globalThis.__MNK_ENV_GET && globalThis.__MNK_ENV_GET(k); if (v != null && v !== '') return v; } catch (e) { /* 무시 */ }
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/;
export const okEmail = (s) => EMAIL_RE.test(String(s || '').trim());
export const STORE = 'mall';
const kMonth = (ts) => new Date(new Date(ts || Date.now()).getTime() + 9 * 3600e3).toISOString().slice(0, 7);

/* ── 받는 사람 ─────────────────────────────────────────── */
export const DEFAULT_RECIPIENTS = [
  { name: '염정훈 대표', email: '0702yeom@gmail.com' },
  { name: '장일호 팀장', email: '1015@monnit.com' },
  { name: '황미경 매니저', email: '' }
];
export function cleanRecipients(arr) {
  const seen = new Set(), out = [];
  for (const x of (Array.isArray(arr) ? arr : []).slice(0, 20)) {
    const email = String((x && x.email) || '').trim().toLowerCase();
    const name = String((x && x.name) || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
    if (email && (!okEmail(email) || seen.has(email))) continue;
    if (!email && !name) continue;
    if (email) seen.add(email);
    out.push({ name, email });
  }
  return out;
}
export async function readRecipients() {
  try {
    const raw = await get(STORE, 'recipients.json');
    if (raw) { const o = JSON.parse(raw); return { list: cleanRecipients(o.list), savedAt: o.savedAt || '', isDefault: false }; }
  } catch (e) { /* 기본값 */ }
  const extra = String(env('MALL_NOTIFY_TO', '')).split(/[,;\s]+/).filter(okEmail).map((email) => ({ name: '', email: email.toLowerCase() }));
  return { list: cleanRecipients([...DEFAULT_RECIPIENTS, ...extra]), savedAt: '', isDefault: true };
}
export async function saveRecipients(list) {
  const clean = cleanRecipients(list), savedAt = new Date().toISOString();
  const ok = await set(STORE, 'recipients.json', JSON.stringify({ list: clean, savedAt }));
  return { ok, list: clean, savedAt };
}
export async function mallTo() { return (await readRecipients()).list.map((r) => r.email).filter(okEmail); }

/* ── 접수 구분 ─────────────────────────────────────────── */
export const isMallLead = (p) => /^\/(mall|store)\b/.test(String((p && p['접점']) || ''));
export function parseMall(p) {
  try { const o = JSON.parse(String((p && p['_mall']) || '')); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
}
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
function cleanItems(arr) {
  return (Array.isArray(arr) ? arr : []).slice(0, 80).map((x) => ({ n: clip(x && x.n, 60), c: clip(x && x.c, 40), q: Math.max(1, Math.min(99999, Number(x && x.q) || 1)) })).filter((x) => x.n);
}

/** 견적 한 건을 몰 원장에 남긴다 — lead.mjs 가 리드 원장 기록 직후 부른다. 실패해도 접수는 막지 않는다. */
export async function recordQuote(lead, p) {
  try {
    if (!isMallLead(p)) return null;
    const m = parseMall(p) || {};
    const rec = {
      ts: lead.ts || new Date().toISOString(),
      no: clip(p['접수번호'], 24),
      kind: /자료실/.test(p['접점'] || '') ? 'doc' : /제품 문의/.test(p['접점'] || '') ? 'qna' : /구성 상담/.test(p['문의항목'] || '') ? 'consult' : 'quote',
      shop: /^\/store/.test(p['접점'] || '') ? 'store' : 'mall',
      company: lead.company || '', name: lead.name || '', phone: lead.phone || '', email: lead.email || '',
      region: clip(p['지역'], 60), memo: clip(m.memo != null ? m.memo : lead.memo, 1000),
      items: cleanItems(m.items),
      cond: { type: clip(m.type, 30), due: clip(m.due, 30), inst: clip(m.inst, 30), pay: clip(m.pay, 30), budget: clip(m.budget, 40), biz: clip(m.biz, 20), docs: (Array.isArray(m.docs) ? m.docs : []).slice(0, 8).map((d) => clip(d, 20)), grade: clip(m.grade, 40), dept: clip(m.dept, 30) },
      product: clip(m.product, 60), source: lead.source || '', test: !!lead.test
    };
    await append(STORE, 'q-' + kMonth(rec.ts), rec);
    return rec;
  } catch (e) { return null; }
}

/** 담당자 메일에 넣을 품목 줄 */
export function itemLines(p) {
  const m = parseMall(p); const it = cleanItems(m && m.items);
  return it.length ? it.map((x, i) => `${i + 1}. ${x.n}${x.c ? ` (${x.c})` : ''} × ${x.q}`).join('\n') : '';
}

/* ── 고객 접수 확인 메일 ─────────────────────────────────── */
const escH = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export async function sendMallAck(lead, p) {
  try {
    if (!isMallLead(p) || !okEmail(lead.email) || lead.test) return { ok: false, skipped: '대상 아님' };
    if (/자료실/.test(p['접점'] || '')) return { ok: false, skipped: '자료 신청 — 안내 메일은 sendpw 가 보낸다' };
    const key = env('BREVO_API_KEY', ''); if (!key) return { ok: false, skipped: 'BREVO_API_KEY 없음' };
    const m = parseMall(p) || {}, items = cleanItems(m.items), no = clip(p['접수번호'], 24);
    const qna = /제품 문의/.test(p['접점'] || '');
    const title = qna ? '제품 문의가 접수되었습니다' : '견적 요청이 접수되었습니다';
    const rows = items.map((x, i) => `<tr><td style="padding:9px 12px;border-bottom:1px solid #eceff4;color:#6b7280">${i + 1}</td><td style="padding:9px 12px;border-bottom:1px solid #eceff4;font-weight:600;color:#14171f">${escH(x.n)}<div style="font-weight:400;color:#9aa1ad;font-size:12px">${escH(x.c)}</div></td><td style="padding:9px 12px;border-bottom:1px solid #eceff4;text-align:right;white-space:nowrap">${x.q}</td></tr>`).join('');
    const cond = [['구매 유형', m.type], ['희망 납기', m.due], ['설치', m.inst], ['지급 조건', m.pay], ['예산', m.budget], ['요청 서류', (m.docs || []).join(', ')]].filter((r) => r[1]);
    const html = `<div style="background:#f4f6f9;padding:28px 12px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#0b1530;padding:26px 28px;color:#fff"><div style="font-size:12px;letter-spacing:.14em;color:#f5a524">MONNIT KOREA · IoT몰</div><div style="font-size:22px;font-weight:800;margin-top:8px">${escH(title)}</div><div style="color:#a9b3c7;font-size:14px;margin-top:6px">접수번호 <b style="color:#fff">${escH(no)}</b></div></div>
<div style="padding:24px 28px;font-size:14.5px;line-height:1.7;color:#3c4250">
<p style="margin:0 0 14px">${escH(lead.name || '')}${lead.name ? '님' : '고객님'}, 모넷코리아 IoT몰을 이용해 주셔서 감사합니다.<br>담당자가 구성·단가·납기를 확인해 <b>영업일 1일 이내</b>에 ${qna ? '답변' : '공식 견적서'}을(를) 이메일로 보내 드립니다.</p>
${items.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:6px 0 14px"><thead><tr><th style="text-align:left;padding:8px 12px;background:#f4f6f9;color:#6b7280;font-size:12px">No.</th><th style="text-align:left;padding:8px 12px;background:#f4f6f9;color:#6b7280;font-size:12px">품목</th><th style="text-align:right;padding:8px 12px;background:#f4f6f9;color:#6b7280;font-size:12px">수량</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
${cond.length ? `<table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:14px">${cond.map((r) => `<tr><td style="padding:5px 0;color:#9aa1ad;width:90px">${escH(r[0])}</td><td style="padding:5px 0;color:#14171f">${escH(r[1])}</td></tr>`).join('')}</table>` : ''}
${qna && p['문의 사항'] ? `<div style="background:#f4f6f9;border-radius:10px;padding:12px 14px;margin-bottom:14px;white-space:pre-wrap">${escH(String(p['문의 사항']).slice(0, 800))}</div>` : ''}
<p style="margin:0;color:#6b7280;font-size:13px">급하시면 02-2088-1454 · 010-3000-7397 로 접수번호와 함께 연락 주세요. 이 메일에 바로 답장하셔도 담당자에게 전달됩니다.</p>
</div>
<div style="padding:16px 28px;border-top:1px solid #eceff4;font-size:11.5px;color:#9aa1ad;line-height:1.6">주식회사 모넷코리아 · 서울특별시 서초구 효령로 380, 2층 · 02-2088-1454 · korea@monnit.com<br>온라인 결제는 없으며, 단가와 납기는 모넷코리아가 발행하는 공식 견적서로 확정됩니다.</div>
</div></div>`;
    const text = `${title} (접수번호 ${no})\n\n` + (items.length ? items.map((x, i) => `${i + 1}. ${x.n} × ${x.q}`).join('\n') + '\n\n' : '') + '영업일 1일 이내에 담당자가 이메일로 회신드립니다.\n문의 02-2088-1454 · korea@monnit.com';
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: '모넷코리아 IoT몰', email: env('MAIL_FROM', 'no-reply@monnit.co.kr') }, to: [{ email: String(lead.email).trim(), ...(lead.name ? { name: String(lead.name).slice(0, 40) } : {}) }],
        replyTo: { name: '모넷코리아 견적 담당', email: '1015@monnit.com' }, subject: `[모넷코리아] ${title} · ${no}`, htmlContent: html, textContent: text })
    });
    return r.ok ? { ok: true } : { ok: false, error: 'brevo ' + r.status };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/* ── 이용 기록 (세션 요약 한 줄) ─────────────────────────── */
const cntMap = (o, maxKeys, maxKey) => {
  const out = {}; let n = 0;
  for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {})) {
    if (n >= maxKeys) break; const kk = clip(k, maxKey); const vv = Math.max(0, Math.min(500, Number(v) || 0));
    if (kk && vv) { out[kk] = vv; n++; }
  }
  return out;
};
export async function recordEvents(body, meta) {
  const rec = { ts: new Date().toISOString(), sid: clip(body.sid, 16), v: cntMap(body.v, 60, 60), a: cntMap(body.a, 60, 60), s: cntMap(body.s, 20, 40), i: cntMap(body.i, 10, 20), pg: Math.max(0, Math.min(500, Number(body.pg) || 0)), q: !!body.q, dev: body.dev === 'm' ? 'm' : 'd', src: clip(body.src, 80), ...meta };
  if (!Object.keys(rec.v).length && !Object.keys(rec.a).length && !Object.keys(rec.s).length && !Object.keys(rec.i).length && !rec.pg) return false;
  await append(STORE, 'ev-' + kMonth(rec.ts), rec);
  return true;
}

/* ── 견적시스템(monnit-quote) 연동 (2026-11-04) ──────────────────────────
   견적 요청이 들어오면 견적시스템에 「견적 대기」 견적서를 자동으로 만든다(단가표 판매가로 품목·단가 입력).
   견적시스템에서 발송 → 수주 → 출고완료가 되면 ERP 판매서로 이어진다(견적시스템 · ERP 쪽 기존 흐름).
   연결 정보: /ops/mall 「견적시스템 연결」 → mall/quote-link.json { url, key }  (환경변수 MALL_QUOTE_URL · MALL_QUOTE_KEY 도 가능)
   결과: mall/qs.json { 몰접수번호: { id, no, status, total, at, err } } */
export const QUOTE_DEFAULT_URL = 'https://monnit-quote.zilliondollarbabysound.workers.dev';
export async function readQuoteLink() {
  let o = {};
  try { o = JSON.parse((await get(STORE, 'quote-link.json')) || '{}') || {}; } catch (e) { o = {}; }
  const url = String(o.url || env('MALL_QUOTE_URL', QUOTE_DEFAULT_URL)).replace(/\/+$/, '');
  const key = String(o.key || env('MALL_QUOTE_KEY', ''));
  /* 연동 키가 없어도 서명(아래 signer)으로 자동 연결된다 — 끄려면 MALL_QUOTE_OFF=1 */
  return { url, key, savedAt: o.savedAt || '', configured: env('MALL_QUOTE_OFF', '') !== '1', mode: key ? 'key' : 'sign' };
}

/* ── 서명 연결 (2026-11-04) ─────────────────────────────────────────
   사이트가 처음 쓸 때 ECDSA P-256 열쇠쌍을 스스로 만들어 R2(mall/sign-key.json)에 두고,
   견적시스템에 보내는 요청마다 「시각.경로.본문」에 서명한다. 공개키는 GET /api/mall/pubkey 로 공개되고,
   견적시스템은 monnit.co.kr 에서 그 공개키를 받아 서명을 확인한다. 비밀키는 사이트 R2 밖으로 나가지 않는다.
   → 사람이 키를 옮겨 적을 필요가 없다. */
const b64u = (buf) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
let SIGNER = null;
async function signer() {
  if (SIGNER) return SIGNER;
  let o = null;
  try { o = JSON.parse((await get(STORE, 'sign-key.json')) || 'null'); } catch (e) { o = null; }
  if (!o || !o.priv || !o.pub) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const priv = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
    o = { priv, pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, kid: 'mall-' + Date.now().toString(36), at: new Date().toISOString() };
    /* 동시에 두 곳에서 만들었으면 먼저 저장된 것을 쓴다 */
    const again = await get(STORE, 'sign-key.json').catch(() => null);
    if (again) { try { const a = JSON.parse(again); if (a && a.priv) o = a; } catch (e) { /* 새로 만든 것 */ } }
    else await set(STORE, 'sign-key.json', JSON.stringify(o));
  }
  const key = await crypto.subtle.importKey('jwk', o.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  SIGNER = { key, pub: o.pub, kid: o.kid };
  return SIGNER;
}
export async function publicKey() { const s = await signer(); return { ...s.pub, kid: s.kid, alg: 'ES256', use: 'sig' }; }
async function signHeaders(path, body) {
  const s = await signer(), ts = String(Date.now());
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, s.key, new TextEncoder().encode(ts + '.' + path + '.' + body));
  return { 'x-mall-ts': ts, 'x-mall-sig': b64u(sig), 'x-mall-kid': s.kid };
}
export async function saveQuoteLink({ url, key }) {
  const cur = await readQuoteLink();
  const u = String(url || cur.url || QUOTE_DEFAULT_URL).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(\/[^\s]*)?$/i.test(u)) return { ok: false, error: '주소 형식' };
  const k = key === undefined || key === '' ? cur.key : String(key).trim().slice(0, 200);
  const savedAt = new Date().toISOString();
  const ok = await set(STORE, 'quote-link.json', JSON.stringify({ url: u, key: k, savedAt }));
  return { ok, url: u, configured: !!k, savedAt };
}
async function readQs() { try { return JSON.parse((await get(STORE, 'qs.json')) || '{}') || {}; } catch (e) { return {}; } }
async function patchQs(patch) {
  const all = await readQs();
  for (const [k, v] of Object.entries(patch)) all[k] = { ...(all[k] || {}), ...v, at: new Date().toISOString() };
  await set(STORE, 'qs.json', JSON.stringify(all));
  return all;
}
export { readQs };
async function qsFetch(path, body, link) {
  const l = link || await readQuoteLink();
  if (!l.configured) return { ok: false, skipped: '연동 꺼짐' };
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ac ? setTimeout(() => ac.abort(), 8000) : null;
  try {
    const raw = JSON.stringify(body);
    const headers = { 'content-type': 'application/json', ...(l.key ? { 'x-mall-key': l.key } : {}), ...(await signHeaders(path, raw)) };
    const r = await fetch(l.url + path, { method: 'POST', headers, body: raw, signal: ac ? ac.signal : undefined });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) return { ok: false, error: r.status === 404 ? '견적시스템이 서명을 확인하지 못함' : 'HTTP ' + r.status };
    return j;
  } catch (e) { return { ok: false, error: String(e && e.name === 'AbortError' ? '시간 초과' : (e && e.message) || e) }; }
  finally { if (t) clearTimeout(t); }
}
/** 몰 원장 한 건 → 견적시스템 견적서. 같은 접수번호는 견적시스템이 한 번만 만든다(다시 보내도 안전). */
export async function pushQuote(rec) {
  try {
    if (!rec || !rec.no || rec.test) return { ok: false, skipped: '대상 아님' };
    if (rec.kind === 'doc') return { ok: false, skipped: '자료 신청은 견적서를 만들지 않는다' };
    const r = await qsFetch('/webhook/mall-quote', { no: rec.no, kind: rec.kind, shop: rec.shop, company: rec.company, name: rec.name, phone: rec.phone, email: rec.email, region: rec.region, items: rec.items, cond: rec.cond, memo: rec.memo });
    if (r.skipped) return r;
    await patchQs({ [rec.no]: r.ok ? { id: r.id, no: r.no, status: r.status, total: r.total, missing: r.missing || [], err: '' } : { err: r.error || '실패' } });
    return r;
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** 견적서 진행 상태 새로 받기 — /ops/mall 을 열 때 */
export async function refreshQs(nos) {
  const list = [...new Set((nos || []).filter(Boolean))].slice(0, 100);
  if (!list.length) return await readQs();
  const r = await qsFetch('/webhook/mall-quote/status', { nos: list });
  if (!r.ok) return await readQs();
  const patch = {};
  for (const [k, v] of Object.entries(r.quotes || {})) patch[k] = { id: v.id, no: v.no, status: v.status, total: v.total, err: '' };
  return Object.keys(patch).length ? await patchQs(patch) : await readQs();
}
export async function testQuoteLink(link) { return qsFetch('/webhook/mall-quote/status', { nos: [] }, link); }
