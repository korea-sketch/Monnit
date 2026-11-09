/** 고객 여정 · 매출 연결 — /ops/journey (2026-11-09)
 *
 *  「어디서 들어와서 → 사이트(리소스 센터 포함)에서 무엇을 보고 → 문의를 남기고 → 견적 → 수주(매출)」를 한 화면에서.
 *
 *  잇는 방법
 *    방문 기록   track 저장소 (js/monnit-track.js) — 세션(sid) · 방문자(vid) · 페이지 · 클릭 · 이벤트
 *    문의        leads 저장소 (lead.mjs) — 접수 건에 vid · sid 가 붙는다 (2026-11-09 이후 접수부터)
 *    견적 · 수주 견적시스템(monnit-quote) /webhook/mall-quote/sales — 서명 요청으로 견적서 상태 · 금액 · 고객 연락처를 받는다
 *                 몰 접수번호 → 이메일 → 전화 → 회사명 순으로 문의와 맞춘다. /ops 의 수기 딜(deals.json)도 함께 본다.
 *
 *    GET /ops/journey                 화면
 *    GET /ops/journey/data?days=30    집계 (7|30|90)
 *    GET /ops/journey/data?lead=<id>  문의 한 건의 여정(방문 기록 타임라인) */
import * as auth from './_ops_auth.mjs';
import { get, set, readLines } from './_store.mjs';
import { channel } from './_track.mjs';
import { readDeals } from './_deals.mjs';
import { isTestLead } from './_istest.mjs';
import { salesFromQs, readQuoteLink } from './_mall.mjs';

export const config = { path: ['/ops/journey', '/ops/journey/data'] };

const H = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...H, 'content-type': 'application/json; charset=utf-8' } });
const kday = (t) => new Date(new Date(t).getTime() + 324e5).toISOString().slice(0, 10);
const kmonth = (t) => kday(t).slice(0, 7);
const DAY = 864e5;

/* ── 원장 읽기 (지난달 파일은 인스턴스가 살아 있는 동안 재사용) ── */
const _mc = new Map();
async function month(store, ym, cur) {
  const k = store + '/' + ym;
  const hit = _mc.get(k);
  if (hit && (!cur || Date.now() - hit.at < 60e3)) return hit.rows;
  const rows = await readLines(store, ym + '.jsonl').catch(() => []);
  _mc.set(k, { at: Date.now(), rows });
  return rows;
}
async function monthsBetween(store, fromMs, toMs) {
  const yms = new Set(); for (let t = fromMs; t <= toMs + DAY; t += 20 * DAY) yms.add(kmonth(t)); yms.add(kmonth(toMs));
  const cur = kmonth(Date.now());
  let out = [];
  for (const ym of [...yms].sort()) out = out.concat(await month(store, ym, ym === cur));
  return out;
}

/* ── 견적시스템 견적서 (10분 보관) ── */
let _qs = null;
async function quotes(sinceMs) {
  if (_qs && Date.now() - _qs.at < 10 * 60e3 && _qs.since <= sinceMs) return _qs;
  const link = await readQuoteLink();
  if (!link.configured) return { ok: false, list: [], error: '견적시스템 연동이 꺼져 있습니다 (/ops/mall 연결 설정)' };
  const since = new Date(sinceMs).toISOString();
  const r = await salesFromQs(since);
  if (!r || !r.ok) {
    /* 직전에 받아 둔 것이 있으면 그것이라도 보여준다 */
    try { const t = await get('ops', 'cache/qs-sales.json'); if (t) { const c = JSON.parse(t); return { ok: true, stale: true, list: c.list || [], at: c.at, error: (r && (r.error || r.skipped)) || '' }; } } catch (e) {}
    return { ok: false, list: [], error: (r && (r.error || r.skipped)) || '견적시스템 응답 없음' };
  }
  _qs = { ok: true, at: Date.now(), since: sinceMs, list: r.quotes || [] };
  set('ops', 'cache/qs-sales.json', JSON.stringify({ at: _qs.at, list: _qs.list })).catch(() => {});
  return _qs;
}

/* ── 문의 ↔ 견적 맞추기 ── */
const digits = (s) => String(s || '').replace(/\D/g, '');
const coKey = (s) => String(s || '').toLowerCase().replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|corp\.?|co\.?,? ?ltd\.?|inc\.?|\s|[.,·()-]/g, '');
const STAGE_RANK = { '': 0, draft: 1, sent: 2, won: 3, shipped: 4, lost: -1 };
const STAGE_KO = { draft: '견적 작성', sent: '견적 발송', won: '수주', shipped: '출고', lost: '실주' };
const DEAL_RANK = { '접수': 0, '통화': 0.5, '견적': 2, '수주': 3, '실패': -1 };
function mallNo(lead) { const m = /\[((?:MQ|PQ|RD)-[0-9A-Z-]+)\]/.exec(String(lead.memo || '')); return m ? m[1] : ''; }
function matchQuote(lead, idx) {
  const t0 = new Date(lead.ts).getTime() - DAY;
  const ok = (q) => q && new Date(q.created_at).getTime() >= t0;
  const pick = (arr) => (arr || []).filter(ok).sort((a, b) => (STAGE_RANK[b.status] || 0) - (STAGE_RANK[a.status] || 0) || String(a.created_at).localeCompare(String(b.created_at)))[0];
  const no = mallNo(lead);
  if (no && idx.mno.get(no)) return { q: idx.mno.get(no), by: '접수번호' };
  const e = String(lead.email || '').trim().toLowerCase();
  let q = e && pick(idx.email.get(e)); if (q) return { q, by: '이메일' };
  const p = digits(lead.phone); q = p.length >= 9 && pick(idx.phone.get(p)); if (q) return { q, by: '전화' };
  const c = coKey(lead.company); q = c.length >= 2 && pick(idx.co.get(c)); if (q) return { q, by: '회사명' };
  return null;
}

/* ── 방문 기록 해석 ── */
const KEY_EV = /^(mall_|res_|chat_|proposal_chat_open|home_banner_click|promo)/;
const KEY_PV = /^\/(mall\/(cart|quote|product|resources|industry)|contact|promo\/|whitepaper|proposal|stories)/;
function isKey(r) {
  if (r.t === 'ev') return KEY_EV.test(r.n || '');
  if (r.t === 'pv') return KEY_PV.test(r.p || '');
  if (r.t === 'click') return r.to === 'tel' || r.to === 'mail' || /^\/(contact|mall\/quote)/.test(r.to || '');
  return false;
}
function keyLabel(r) {
  if (r.t === 'ev') {
    const N = { mall_add: '몰 담기', mall_quote: '몰 견적 요청', mall_res_open: '자료 신청 창', mall_res_send: '자료 신청', mall_resq: '자료 견적에 담기', mall_ind: '업종 구성 담기', mall_search: '몰 검색', mall_promo: '프로모션 클릭', mall_compare: '제품 비교', home_banner_click: '홈 배너 클릭', proposal_chat_open: '모니 열기' };
    return (N[r.n] || r.n) + (r.l ? ' · ' + r.l : '');
  }
  if (r.t === 'click') return r.to === 'tel' ? '전화 걸기' : r.to === 'mail' ? '메일 보내기' : '클릭 · ' + (r.l || r.to);
  return r.tt || r.p;
}
const pageName = (r) => (r.tt ? String(r.tt).replace(/\s*[|·-]\s*(모넷|Monnit).*$/i, '').trim() : '') || r.p;

async function build(days) {
  const now = Date.now(), from = now - days * DAY;
  const [leadRows, trackRows, dealMap, delMap] = await Promise.all([
    monthsBetween('leads', from, now),
    monthsBetween('track', from, now),
    readDeals(),
    get('ops', 'deleted.json').then((t) => JSON.parse(t || '{}')).catch(() => ({}))
  ]);
  const idOf = (r) => (r.ts || '') + '|' + (r.email || r.phone || r.company || '');
  const leads = leadRows.filter((r) => r && r.ts && new Date(r.ts).getTime() >= from && !/^__/.test(r.company || '') && !isTestLead(r) && !delMap[idOf(r)] && r.type !== 'subscribe')
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  /* 세션 · 방문자 */
  const S = new Map(), V = new Map(), pageSessions = new Map();
  for (const r of trackRows) {
    if (!r || r.in || !r.sid) continue;
    const t = new Date(r.ts).getTime(); if (!(t >= from)) continue;
    let s = S.get(r.sid);
    if (!s) { s = { sid: r.sid, vid: r.vid || '', t0: t, t1: t, ch: '', src: '', land: '', pv: 0, key: false, mall: false, pages: new Set() }; S.set(r.sid, s); }
    if (t < s.t0) s.t0 = t; if (t > s.t1) s.t1 = t;
    if (!s.vid && r.vid) s.vid = r.vid;
    if (r.t === 'pv') {
      s.pv++; s.pages.add(r.p);
      if (r.src && !s.src) { s.src = r.src; s.ch = r.ch || channel(r.src); }
      if (!s.land) s.land = r.p;
      if (/^\/mall/.test(r.p)) s.mall = true;
    }
    if (isKey(r)) s.key = true;
  }
  for (const s of S.values()) {
    if (!s.ch) s.ch = '직접';
    if (s.pv >= 3) s.key = true;
    if (s.vid) { const v = V.get(s.vid) || { sessions: [], t0: s.t0 }; v.sessions.push(s); if (s.t0 < v.t0) v.t0 = s.t0; V.set(s.vid, v); }
  }

  /* 견적시스템 */
  const qs = await quotes(from - 30 * DAY);
  const idx = { mno: new Map(), email: new Map(), phone: new Map(), co: new Map() };
  const add = (m, k, q) => { if (!k) return; const a = m.get(k) || []; a.push(q); m.set(k, a); };
  for (const q of qs.list || []) {
    if (q.mno) idx.mno.set(q.mno, q);
    add(idx.email, String(q.email || '').trim().toLowerCase(), q);
    const p = digits(q.phone); if (p.length >= 9) add(idx.phone, p, q);
    const c = coKey(q.buyer_name); if (c.length >= 2) add(idx.co, c, q);
  }

  /* 문의 한 건씩 — 여정 · 견적 · 수주 */
  const converted = new Set();
  const L = leads.map((r) => {
    const id = idOf(r), lt = new Date(r.ts).getTime();
    const v = r.vid ? V.get(r.vid) : null;
    const before = v ? v.sessions.filter((s) => s.t0 <= lt + 60e3).sort((a, b) => a.t0 - b.t0) : [];
    if (r.vid) converted.add(r.vid);
    const first = before[0];
    const m = matchQuote(r, idx);
    const deal = dealMap[id] || null;
    const qRank = m ? (STAGE_RANK[m.q.status] || 0) : 0, dRank = deal ? (DEAL_RANK[deal.stage] || 0) : 0;
    let stage = '문의', rank = 0;
    if (qRank >= dRank && m) { stage = STAGE_KO[m.q.status] || m.q.status; rank = qRank; }
    else if (deal && dRank > 0) { stage = deal.stage === '수주' ? '수주' : deal.stage === '견적' ? '견적 발송' : deal.stage; rank = dRank; }
    if (rank < 0) stage = '실주';
    const won = rank >= 3;
    const amount = won ? (m && qRank >= 3 ? Number(m.q.total) || 0 : Number((deal && (deal.oneoff || deal.quote_amount)) || 0)) : 0;
    const quoted = rank >= 2 || (m && qRank >= 1);
    return {
      id, ts: r.ts, company: r.company || '', name: r.name || '', type: r.label || r.type || '', point: r.point || '', interest: r.interest || '',
      ch: r.channel || '직접', vid: r.vid ? 1 : 0,
      first: first ? { ch: first.ch, land: first.land, at: new Date(first.t0).toISOString() } : null,
      visits: before.length, pages: before.reduce((a, s) => a + s.pv, 0),
      days: first ? Math.max(0, Math.round((lt - first.t0) / DAY * 10) / 10) : null,
      mall: before.some((s) => s.mall),
      quote: m ? { no: m.q.no, id: m.q.id, status: m.q.status, total: Number(m.q.total) || 0, by: m.by, won_at: m.q.won_at || '', shipped_at: m.q.shipped_at || '' } : null,
      deal: deal ? { stage: deal.stage } : null,
      stage, rank, won, quoted: !!quoted, amount
    };
  });

  /* 채널별 깔때기 — 방문 · 관심 행동은 세션, 문의 이후는 접수 건 기준 */
  const F = new Map();
  const fr = (ch) => { let o = F.get(ch); if (!o) { o = { ch, visits: 0, engaged: 0, mall: 0, leads: 0, quoted: 0, won: 0, revenue: 0 }; F.set(ch, o); } return o; };
  for (const s of S.values()) { const o = fr(s.ch); o.visits++; if (s.key) o.engaged++; if (s.mall) o.mall++; }
  for (const l of L) { const o = fr(l.ch); o.leads++; if (l.quoted) o.quoted++; if (l.won) { o.won++; o.revenue += l.amount; } }
  const funnel = [...F.values()].sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || b.visits - a.visits);
  const tot = funnel.reduce((a, o) => { for (const k of ['visits', 'engaged', 'mall', 'leads', 'quoted', 'won', 'revenue']) a[k] += o[k]; return a; }, { ch: '전체', visits: 0, engaged: 0, mall: 0, leads: 0, quoted: 0, won: 0, revenue: 0 });

  /* 문의한 방문자가 거쳐 간 페이지 — 페이지를 본 방문자 중 문의로 이어진 비율 */
  const PV = new Map();
  for (const s of S.values()) for (const p of s.pages) {
    let o = PV.get(p); if (!o) { o = { p, vids: new Set(), conv: new Set() }; PV.set(p, o); }
    const who = s.vid || s.sid; o.vids.add(who); if (s.vid && converted.has(s.vid)) o.conv.add(who);
  }
  const titles = new Map(); for (const r of trackRows) if (r && r.t === 'pv' && r.tt && !titles.has(r.p)) titles.set(r.p, pageName(r));
  const pages = [...PV.values()].filter((o) => o.conv.size > 0).map((o) => ({ p: o.p, t: titles.get(o.p) || o.p, visitors: o.vids.size, conv: o.conv.size, rate: Math.round(o.conv.size / o.vids.size * 1000) / 10 }))
    .sort((a, b) => b.conv - a.conv || b.rate - a.rate).slice(0, 15);

  /* 리소스 센터(/mall) 행동 */
  const M = { views: new Map(), adds: new Map(), res: new Map(), search: new Map(), promo: new Map(), sessions: 0, quotes: 0 };
  const inc = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const r of trackRows) {
    if (!r || r.in || new Date(r.ts).getTime() < from) continue;
    if (r.t === 'pv' && /^\/mall\/product\//.test(r.p)) inc(M.views, pageName(r).replace(/\s*\|.*$/, ''));
    if (r.t === 'ev') {
      if (r.n === 'mall_add' || r.n === 'mall_ind') inc(M.adds, r.l);
      else if (r.n === 'mall_res_send' || r.n === 'mall_res_open') inc(M.res, r.l);
      else if (r.n === 'mall_search') inc(M.search, r.l);
      else if (r.n === 'mall_promo') inc(M.promo, r.l);
      else if (r.n === 'mall_quote') M.quotes++;
    }
  }
  for (const s of S.values()) if (s.mall) M.sessions++;
  const top = (m, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));

  /* 문의 전 여정 요약 */
  const withJ = L.filter((l) => l.vid && l.visits);
  const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const firstCh = new Map(); for (const l of withJ) if (l.first) inc(firstCh, l.first.ch);

  return {
    ok: true, days, at: new Date().toISOString(),
    qs: { ok: !!qs.ok, stale: !!qs.stale, n: (qs.list || []).length, error: qs.error || '' },
    kpi: { ...tot, leadsWithJourney: withJ.length, medVisits: med(withJ.map((l) => l.visits)), medDays: med(withJ.map((l) => l.days)), matched: L.filter((l) => l.quote).length },
    funnel, pages, firstTouch: top(firstCh, 10),
    mall: { sessions: M.sessions, quotes: M.quotes, views: top(M.views), adds: top(M.adds), res: top(M.res), search: top(M.search), promo: top(M.promo) },
    leads: L.slice(-80).reverse()
  };
}

/* 문의 한 건의 방문 기록 */
async function timeline(id) {
  const ts = String(id).split('|')[0], t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return { ok: false, error: 'id' };
  const leads = await monthsBetween('leads', t - DAY, t + DAY);
  const lead = leads.find((r) => (r.ts || '') + '|' + (r.email || r.phone || r.company || '') === id);
  if (!lead) return { ok: false, error: '접수 건을 찾지 못했습니다' };
  if (!lead.vid && !lead.sid) return { ok: true, rows: [], note: '이 접수는 방문자 기록 연결(2026-11-09) 이전에 들어왔거나, 방문 기록을 남기지 않는 화면에서 들어왔습니다.' };
  const rows = (await monthsBetween('track', t - 90 * DAY, Math.min(Date.now(), t + 30 * DAY)))
    .filter((r) => r && !r.in && ((lead.vid && r.vid === lead.vid) || (lead.sid && r.sid === lead.sid)))
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const out = rows.slice(-400).map((r) => ({ ts: r.ts, sid: r.sid, t: r.t, p: r.p, l: r.t === 'pv' ? pageName(r) : keyLabel(r), key: isKey(r) ? 1 : 0, src: r.t === 'pv' && r.src ? (r.ch || channel(r.src)) + ' · ' + r.src : '' }));
  out.push({ ts: lead.ts, t: 'lead', p: lead.point || '', l: '문의 접수 · ' + (lead.label || '') + (lead.interest ? ' · ' + lead.interest : ''), key: 1 });
  out.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return { ok: true, rows: out };
}

const _cache = new Map();
export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const ok = auth.configured() && auth.valid(auth.cookieFrom({ cookie: req.headers.get('cookie') || '' }));
  if (!ok) return path === '/ops/journey' ? new Response(null, { status: 302, headers: { ...H, location: '/ops' } }) : j({ error: 'unauthorized' }, 401);
  if (path === '/ops/journey') return new Response(PAGE, { headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
  if (path === '/ops/journey/data') {
    const lead = url.searchParams.get('lead');
    if (lead) return j(await timeline(lead.slice(0, 300)));
    const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    const hit = _cache.get(days);
    if (hit && Date.now() - hit.at < 60e3 && !url.searchParams.get('fresh')) return j(hit.data);
    try { const data = await build(days); _cache.set(days, { at: Date.now(), data }); return j(data); }
    catch (e) { return j({ ok: false, error: String((e && e.message) || e) }, 500); }
  }
  return j({ error: 'not found' }, 404);
};

const PAGE = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>고객 여정 · 매출 | 모넷 관제</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{--bg:#0A0F1C;--card:#111a2e;--card2:#16213a;--line:rgba(255,255,255,.1);--ink:#F2F5FA;--mut:#A6B3CC;--dim:#76839c;--acc:#7aa8ff;--mint:#5fe3c4;--or:#f5a524;--up:#4fe39b;--dn:#ff7a7a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo',sans-serif;font-size:14px}
.opsnav{display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(8,12,22,.85);backdrop-filter:blur(10px);overflow-x:auto;position:sticky;top:0;z-index:20}
.opsnav a{color:#A6B3CC;text-decoration:none;padding:9px 14px;border-radius:10px 10px 0 0;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid transparent;border-bottom:0}
.opsnav a:hover{color:#F2F5FA}.opsnav a.on{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}
.wrap{max-width:1240px;margin:0 auto;padding:22px max(16px,env(safe-area-inset-left)) 80px}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.02em}.sub{color:var(--mut);margin:0 0 18px;line-height:1.6}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.seg button{background:none;border:0;color:var(--mut);padding:8px 14px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}.seg button.on{background:var(--card2);color:#fff}
.pill{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;color:var(--mut)}.pill.ok{color:var(--up);border-color:rgba(79,227,155,.35)}.pill.bad{color:var(--dn);border-color:rgba(255,122,122,.35)}
.kpi{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin-bottom:16px}
.k{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}.k small{display:block;color:var(--mut);font-size:12px}.k b{display:block;font-size:22px;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}.k em{font-style:normal;font-size:12px;color:var(--dim)}
.k.rev b{color:var(--mint)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px;min-width:0}
.card h2{font-size:15.5px;margin:0 0 4px}.card .note{color:var(--dim);font-size:12.5px;margin:0 0 12px;line-height:1.55}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--mut);font-weight:600;font-size:12px}td.n,th.n{text-align:right}
tr.tot td{font-weight:700;border-top:1px solid rgba(255,255,255,.2)}
.fbar{display:flex;align-items:center;gap:6px}.fbar i{display:block;height:6px;border-radius:6px;background:linear-gradient(90deg,var(--acc),var(--mint))}
.rate{color:var(--dim);font-size:11.5px;margin-left:4px}
.list{display:flex;flex-direction:column;gap:6px}.li{display:flex;justify-content:space-between;gap:10px;font-size:13px}.li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.li b{font-variant-numeric:tabular-nums;color:var(--mut)}
.mall{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.mall h3{font-size:13px;color:var(--mut);margin:0 0 8px;font-weight:600}
.st{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--mut)}
.st.s2{background:rgba(122,168,255,.16);color:#a9c7ff}.st.s3{background:rgba(95,227,196,.16);color:var(--mint)}.st.s4{background:rgba(79,227,155,.18);color:var(--up)}.st.sx{background:rgba(255,122,122,.14);color:var(--dn)}
tr.lead{cursor:pointer}tr.lead:hover td{background:rgba(255,255,255,.03)}
tr.tl td{white-space:normal;background:#0d1527;padding:12px 14px}
.tlv{display:flex;flex-direction:column;gap:2px;max-height:360px;overflow:auto;font-size:12.5px}
.tlv div{display:grid;grid-template-columns:118px 60px minmax(0,1fr);gap:8px;padding:3px 0;color:var(--mut)}.tlv div.key{color:var(--ink)}.tlv div.lead{color:var(--mint);font-weight:700}.tlv div.ss{border-top:1px dashed var(--line);margin-top:4px;padding-top:7px}
.tlv i{font-style:normal;color:var(--dim)}
.empty{color:var(--dim);padding:10px 0}
.help{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--mut);font-size:12.5px;line-height:1.65;margin-bottom:14px}
.help b{color:var(--ink)}
@media (max-width:1000px){.kpi{grid-template-columns:repeat(4,minmax(0,1fr))}.mall{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){.kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2,.mall{grid-template-columns:minmax(0,1fr)}.tlv div{grid-template-columns:92px minmax(0,1fr)}.tlv div i:nth-child(2){display:none}}
</style></head><body>
<nav class="opsnav" aria-label="관제 메뉴"><a href="/ops">통합 관제</a><a href="/ops/journey" class="on">고객 여정</a><a href="/ops/flow">유입·경로</a><a href="/ops/proposals/insights">고객 인사이트</a><a href="/ops/mall">리소스 센터 접수</a><a href="/ops/proposals">맞춤 제안서</a><a href="/ops/proposals/archive">발송 대장</a><a href="/ops/notices">알림함</a><a href="/ops/block">차단 관리</a></nav><script src="/js/ops-nav.js?v=1" defer></script>
<div class="wrap">
  <h1>고객 여정 · 매출 연결</h1>
  <p class="sub">들어온 경로 → 사이트·리소스 센터에서 한 행동 → 문의 → 견적 → 수주까지 한 줄로 이었습니다. 견적·수주는 견적시스템 견적서와 /ops 의 딜 단계 중 더 앞선 쪽을 씁니다.</p>
  <div class="bar"><div class="seg" id="days"><button data-d="7">7일</button><button data-d="30" class="on">30일</button><button data-d="90">90일</button></div><span class="pill" id="qsTag">견적시스템 확인 중…</span><span class="pill" id="atTag"></span></div>
  <div class="kpi" id="kpi"></div>
  <div class="card"><h2>채널별 깔때기</h2><p class="note">방문·관심 행동은 방문 세션 수, 문의부터는 접수 건 수입니다. 관심 행동 = 리소스 센터 담기·견적·자료 신청, 문의·프로모션 페이지 방문, 전화·메일 누름, 3페이지 이상 보기. 매출 = 수주·출고된 견적서 금액(VAT 포함).</p><div class="tw"><table id="funnel"></table></div></div>
  <div class="grid2">
    <div class="card"><h2>문의로 이어진 페이지</h2><p class="note">이 페이지를 본 방문자 중 나중에 문의를 남긴 사람 수와 비율 (2026-11-09 이후 기록부터)</p><div class="tw"><table id="pages"></table></div></div>
    <div class="card"><h2>문의 전 여정</h2><p class="note" id="jNote"></p><div class="list" id="firstTouch"></div></div>
  </div>
  <div class="card"><h2>리소스 센터(/mall) 행동</h2><p class="note" id="mallNote"></p><div class="mall" id="mall"></div></div>
  <div class="card"><h2>최근 문의와 결과</h2><p class="note">줄을 누르면 그 고객이 문의 전에 본 페이지와 누른 것이 시간순으로 펼쳐집니다.</p><div class="tw"><table id="leads"></table></div></div>
  <div class="help"><b>이렇게 이어집니다</b> · 방문자 브라우저에 이름·연락처와 무관한 난수(방문자 id)를 1년 보관하고, 문의를 남기면 그 값이 접수 건에 함께 저장됩니다. 그래서 2026-11-09 이후 접수부터 문의 전 여정이 보입니다. 견적시스템 견적서는 몰 접수번호 → 이메일 → 전화 → 회사명 순으로 문의와 맞춥니다. 전화로만 들어온 고객은 /ops 의 「+ 수기 접수」로 넣어야 이 표에 잡힙니다.</div>
</div>
<script>
(function(){
var $=function(s){return document.querySelector(s)}, esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var won=function(n){n=Number(n)||0; return n>=1e8?(Math.round(n/1e7)/10)+'억':n>=1e4?Math.round(n/1e4).toLocaleString('ko-KR')+'만':n.toLocaleString('ko-KR')};
var pct=function(a,b){return b?Math.round(a/b*1000)/10+'%':'-'};
var days=30, D=null;
function kt(t){var d=new Date(new Date(t).getTime()+324e5).toISOString();return d.slice(5,10).replace('-','/')+' '+d.slice(11,16)}
function load(fresh){ $('#atTag').textContent='불러오는 중…';
  fetch('/ops/journey/data?days='+days+(fresh?'&fresh=1':''),{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){D=d; if(!d.ok){$('#atTag').textContent='오류: '+(d.error||'');return;} paint(d);}).catch(function(e){$('#atTag').textContent='불러오지 못했습니다'});}
function paint(d){
  var q=d.qs; var t=$('#qsTag'); t.className='pill '+(q.ok?'ok':'bad'); t.textContent=q.ok?('견적시스템 연결 · 견적서 '+q.n+'건'+(q.stale?' (지난 값)':'')):('견적시스템 미연결 · '+q.error);
  $('#atTag').textContent='갱신 '+kt(d.at);
  var k=d.kpi;
  $('#kpi').innerHTML=[['방문 세션',k.visits,''],['관심 행동',k.engaged,pct(k.engaged,k.visits)],['리소스 센터 방문',k.mall,pct(k.mall,k.visits)],['문의',k.leads,pct(k.leads,k.visits)+' (방문 대비)'],['견적',k.quoted,pct(k.quoted,k.leads)+' (문의 대비)'],['수주',k.won,pct(k.won,k.quoted)+' (견적 대비)'],['매출',won(k.revenue)+'원','수주 견적 합계']]
    .map(function(x,i){return '<div class="k'+(i===6?' rev':'')+'"><small>'+x[0]+'</small><b>'+(typeof x[1]==='number'?x[1].toLocaleString('ko-KR'):x[1])+'</b><em>'+x[2]+'</em></div>'}).join('');
  var mx=Math.max.apply(null,d.funnel.map(function(o){return o.visits}).concat([1]));
  var row=function(o,cls){return '<tr class="'+(cls||'')+'"><td>'+esc(o.ch)+'</td><td class="n"><span class="fbar" style="justify-content:flex-end"><i style="width:'+Math.max(2,Math.round(o.visits/mx*70))+'px"></i>'+o.visits.toLocaleString('ko-KR')+'</span></td><td class="n">'+o.engaged+'<span class="rate">'+pct(o.engaged,o.visits)+'</span></td><td class="n">'+o.mall+'</td><td class="n">'+o.leads+'<span class="rate">'+pct(o.leads,o.visits)+'</span></td><td class="n">'+o.quoted+'<span class="rate">'+pct(o.quoted,o.leads)+'</span></td><td class="n">'+o.won+'<span class="rate">'+pct(o.won,o.quoted)+'</span></td><td class="n"><b>'+won(o.revenue)+'</b></td></tr>'};
  $('#funnel').innerHTML='<thead><tr><th>채널</th><th class="n">방문</th><th class="n">관심 행동</th><th class="n">리소스 센터</th><th class="n">문의</th><th class="n">견적</th><th class="n">수주</th><th class="n">매출</th></tr></thead><tbody>'+d.funnel.map(function(o){return row(o)}).join('')+row(k,'tot')+'</tbody>';
  $('#pages').innerHTML=d.pages.length?'<thead><tr><th>페이지</th><th class="n">본 방문자</th><th class="n">문의</th><th class="n">비율</th></tr></thead><tbody>'+d.pages.map(function(p){return '<tr><td title="'+esc(p.p)+'">'+esc(p.t).slice(0,34)+'</td><td class="n">'+p.visitors+'</td><td class="n">'+p.conv+'</td><td class="n">'+p.rate+'%</td></tr>'}).join('')+'</tbody>':'<tr><td class="empty">아직 연결된 문의가 없습니다. 오늘 이후 접수부터 쌓입니다.</td></tr>';
  $('#jNote').textContent=k.leadsWithJourney?('여정이 연결된 문의 '+k.leadsWithJourney+'건 · 문의까지 방문 중앙값 '+(k.medVisits||0)+'회 · 첫 방문부터 '+(k.medDays==null?'-':k.medDays+'일')+' · 견적서와 맞춰진 문의 '+k.matched+'건'):('여정이 연결된 문의가 아직 없습니다 · 견적서와 맞춰진 문의 '+k.matched+'건');
  $('#firstTouch').innerHTML=d.firstTouch.length?'<div class="li"><span style="color:var(--dim)">처음 들어온 채널</span><b>문의</b></div>'+d.firstTouch.map(function(x){return '<div class="li"><span>'+esc(x.k)+'</span><b>'+x.v+'</b></div>'}).join(''):'<div class="empty">-</div>';
  var m=d.mall; $('#mallNote').textContent='리소스 센터 방문 세션 '+m.sessions+' · 견적 요청 '+m.quotes+'건';
  var blk=function(h,a){return '<div><h3>'+h+'</h3><div class="list">'+(a.length?a.map(function(x){return '<div class="li"><span>'+esc(x.k)+'</span><b>'+x.v+'</b></div>'}).join(''):'<div class="empty">아직 없음</div>')+'</div></div>'};
  $('#mall').innerHTML=blk('많이 본 제품',m.views)+blk('많이 담은 제품·구성',m.adds)+blk('자료 신청',m.res)+blk('검색어',m.search);
  var cls=function(l){return l.rank>=4?'s4':l.rank>=3?'s3':l.rank>=2?'s2':l.rank<0?'sx':''};
  $('#leads').innerHTML='<thead><tr><th>접수</th><th>회사 · 담당</th><th>유형 · 접점</th><th>채널</th><th>첫 유입</th><th class="n">방문</th><th class="n">페이지</th><th>결과</th><th class="n">금액</th></tr></thead><tbody>'+d.leads.map(function(l,i){
    return '<tr class="lead" data-i="'+i+'"><td>'+kt(l.ts)+'</td><td>'+esc(l.company||'-')+' <span style="color:var(--dim)">'+esc(l.name)+'</span></td><td>'+esc(l.type)+' <span style="color:var(--dim)">'+esc(l.point).slice(0,24)+'</span></td><td>'+esc(l.ch)+'</td><td>'+(l.first?esc(l.first.ch)+' <span style="color:var(--dim)">'+esc(l.first.land).slice(0,22)+'</span>':'<span style="color:var(--dim)">'+(l.vid?'-':'기록 전')+'</span>')+'</td><td class="n">'+(l.visits||'-')+'</td><td class="n">'+(l.pages||'-')+'</td><td><span class="st '+cls(l)+'">'+esc(l.stage)+'</span>'+(l.quote?' <span style="color:var(--dim);font-size:12px">'+esc(l.quote.no)+' · '+esc(l.quote.by)+'</span>':'')+(l.mall?' <span class="pill" style="padding:1px 7px">몰</span>':'')+'</td><td class="n">'+(l.amount?won(l.amount):l.quote&&l.quote.total?'<span style="color:var(--dim)">'+won(l.quote.total)+'</span>':'-')+'</td></tr>'}).join('')+'</tbody>';
}
document.addEventListener('click',function(e){
  var b=e.target.closest('#days button'); if(b){ days=+b.dataset.d; document.querySelectorAll('#days button').forEach(function(x){x.classList.toggle('on',x===b)}); load(); return; }
  var tr=e.target.closest('tr.lead'); if(!tr||!D) return;
  var nx=tr.nextElementSibling; if(nx&&nx.classList.contains('tl')){ nx.remove(); return; }
  var l=D.leads[+tr.dataset.i]; var row=document.createElement('tr'); row.className='tl'; row.innerHTML='<td colspan="9"><div class="tlv">불러오는 중…</div></td>'; tr.after(row);
  fetch('/ops/journey/data?lead='+encodeURIComponent(l.id),{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(t){
    var box=row.querySelector('.tlv'); if(!t.ok){box.textContent=t.error||'오류';return;}
    if(!t.rows.length){box.textContent=t.note||'기록 없음';return;}
    var last='';
    box.innerHTML=t.rows.map(function(r){var ss=r.sid&&r.sid!==last; if(r.sid) last=r.sid; var kind=r.t==='pv'?'페이지':r.t==='click'?'클릭':r.t==='ev'?'행동':'문의';
      return '<div class="'+(r.t==='lead'?'lead':r.key?'key':'')+(ss?' ss':'')+'"><i>'+kt(r.ts)+'</i><i>'+kind+'</i><span>'+esc(r.l)+(r.src?' <i>· '+esc(r.src).slice(0,60)+'</i>':'')+'</span></div>'}).join('');
  });
});
load();
})();
</script></body></html>`;
