/** 원격 차단 API — /api/block (2026-09-16)
 *
 *  채팅에서 「1.2.3.4 차단해」 라고 하면 Claude 가 이 주소를 불러 바로 막는다.
 *  사람이 쓰는 화면은 /ops/block 이고, 이 API 는 같은 규칙 저장소를 쓴다.
 *
 *  인증  : 헤더  Authorization: Bearer <BLOCK_API_KEY>
 *          Netlify 환경변수 BLOCK_API_KEY 가 없으면 API 자체가 꺼진다(404).
 *
 *  읽기 (GET  /api/block?action=…)
 *    status                     차단 규칙 개수 · 이번 달 차단 시도 수
 *    rules                      차단 규칙 전체
 *    ip      &ip=1.2.3.4&days=30  그 IP 의 차단 상태 · 방문 내역 · 그 IP 로 들어온 리드
 *    visits  &day=YYYY-MM-DD      그날 방문한 IP 목록 (기본 오늘)
 *    hits    &limit=50            차단된 시도
 *    lead    &q=데키스트            리드 검색 (회사·담당자·이메일·IP) → 접속 IP 확인용
 *
 *  쓰기 (POST /api/block  JSON)
 *    { "action":"block",   "ip":"1.2.3.4", "scope":"site|gate", "days":0, "memo":"…" }
 *    { "action":"block",   "kind":"domains|companies|phones", "v":"dekist.com", "memo":"…" }
 *    { "action":"unblock", "ip":"1.2.3.4" }   또는 { "action":"unblock", "kind":"…", "v":"…" }
 *    scope 기본 site(사이트 전체) · days 0 = 영구 */
import crypto from 'node:crypto';
import G from './_guard.js';
import * as V from './_visits.mjs';
import { readLines } from './_store.mjs';

export const config = { path: ['/api/block'] };

const H = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow'
};
const out = (o, status = 200) => new Response(JSON.stringify(o, null, 1), { status, headers: H });

function authed(req) {
  const key = process.env.BLOCK_API_KEY || '';
  if (key.length < 24) return null;                    /* 키가 없으면 API 꺼짐 */
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.headers.get('x-block-key') || '';
  const a = crypto.createHash('sha256').update(String(got)).digest();
  const b = crypto.createHash('sha256').update(key).digest();
  return crypto.timingSafeEqual(a, b);
}

function months(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - i);
    out.push(V.kday(d).slice(0, 7));
  }
  return out;
}
async function lines(store, fmt, n) {
  let all = [];
  for (const m of months(n)) all = all.concat(await readLines(store, fmt(m)));
  return all.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}
const iso = ms => ms ? new Date(ms).toISOString() : null;

export default async (req) => {
  const ok = authed(req);
  if (ok === null) return new Response('Not Found', { status: 404 });
  if (!ok) { await new Promise(r => setTimeout(r, 600)); return out({ ok: false, error: 'unauthorized' }, 401); }

  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return out({ ok: false, error: 'JSON 형식 오류' }, 400); } }
  const q = k => body[k] != null ? body[k] : url.searchParams.get(k);
  const action = String(q('action') || 'status');

  try {
    /* ── 쓰기 ── */
    if (action === 'block' || action === 'unblock') {
      if (req.method !== 'POST') return out({ ok: false, error: 'POST 로 보내 주세요' }, 405);
      const kind = q('ip') ? 'ips' : String(q('kind') || '');
      const v = q('ip') || q('v');
      const r = action === 'block'
        ? await G.addRule(kind, v, { scope: q('scope'), days: q('days'), memo: q('memo') || 'API', by: 'api' })
        : await G.removeRule(kind, v);
      const res = { ok: r.ok, error: r.error || undefined, action, kind, value: v };
      if (kind === 'ips' && r.ok) res.status = await G.ipStatus(G.normIp(v));
      if (r.item && r.item.until) res.until = iso(r.item.until);
      return out(res, r.ok ? 200 : 400);
    }

    /* ── 읽기 ── */
    if (action === 'status') {
      const st = await G.readStored(), now = Date.now();
      const live = st.ips.filter(x => !x.until || x.until > now);
      const hits = await readLines('ops', 'blocked-' + V.kday(new Date()).slice(0, 7) + '.jsonl');
      return out({
        ok: true,
        ips_site: live.filter(x => (x.scope || 'site') === 'site').length,
        ips_gate: live.filter(x => x.scope === 'gate').length,
        domains: G.DEFAULTS.domains.length + st.domains.length,
        companies: G.DEFAULTS.companies.length + st.companies.length,
        phones: G.DEFAULTS.phones.length + st.phones.length,
        hits_this_month: hits.length
      });
    }
    if (action === 'rules') {
      const st = await G.readStored(), now = Date.now();
      const fix = x => ({ ...x, at: iso(x.at), last: iso(x.last), until: x.until ? iso(x.until) : '영구', expired: !!(x.until && x.until <= now) });
      return out({ ok: true, defaults: G.DEFAULTS,
        stored: { domains: st.domains.map(fix), companies: st.companies.map(fix), phones: st.phones.map(fix), ips: st.ips.map(fix) } });
    }
    if (action === 'ip') {
      const ip = G.normIp(q('ip'));
      if (!ip) return out({ ok: false, error: 'ip 가 필요합니다' }, 400);
      const days = Math.min(Number(q('days')) || 30, 90);
      const rows = await V.ipHistory(ip, days, 200);
      const leads = (await lines('leads', m => m + '.jsonl', 3)).filter(l => l.ip && G.ipMatch(l.ip, ip))
        .map(l => ({ ts: l.ts, company: l.company, name: l.name, email: l.email, point: l.point, interest: l.interest }));
      const hits = (await lines('ops', m => 'blocked-' + m + '.jsonl', 3)).filter(h => h.ip && G.ipMatch(h.ip, ip)).slice(0, 30);
      const st = await G.ipStatus(ip);
      if (st.until) st.until = iso(st.until);
      return out({ ok: true, ip, status: st, visits: rows.length, leads, hits,
        history: rows.map(r => ({ t: iso(r.t), page: r.p, ref: r.ref || undefined, geo: [r.city, r.r, r.c].filter(Boolean).join(' '), ua: r.ua, blocked: r.b ? true : undefined, download: r.dl ? true : undefined })) });
    }
    if (action === 'visits') {
      const day = q('day') || V.kday(new Date());
      const s = await V.daySummary(day, Math.min(Number(q('limit')) || 100, 300));
      const leadIp = {};
      for (const l of await lines('leads', m => m + '.jsonl', 3)) if (l.ip && !leadIp[l.ip]) leadIp[l.ip] = l.company || l.email;
      s.ips = s.ips.map(o => ({ ...o, first: iso(o.first), last: iso(o.last), lead: leadIp[o.ip] || undefined }));
      V.cleanup(200).catch(() => {});
      return out({ ok: true, ...s });
    }
    if (action === 'hits') {
      const n = Math.min(Number(q('limit')) || 50, 300);
      return out({ ok: true, hits: (await lines('ops', m => 'blocked-' + m + '.jsonl', 3)).slice(0, n) });
    }
    if (action === 'lead') {
      const term = String(q('q') || '').trim().toLowerCase();
      if (term.length < 2) return out({ ok: false, error: 'q 는 2글자 이상' }, 400);
      const nc = G.normCompany(term);
      const rows = (await lines('leads', m => m + '.jsonl', 3)).filter(l =>
        [l.company, l.name, l.email, l.ip].join(' ').toLowerCase().includes(term) ||
        (nc && G.normCompany(l.company).includes(nc)));
      const hits = (await lines('ops', m => 'blocked-' + m + '.jsonl', 3)).filter(h =>
        [h.company, h.name, h.email, h.ip].join(' ').toLowerCase().includes(term) ||
        (nc && G.normCompany(h.company).includes(nc)));
      return out({ ok: true,
        leads: rows.slice(0, 50).map(l => ({ ts: l.ts, company: l.company, name: l.name, email: l.email, ip: l.ip || '(IP 기록 전 접수)', point: l.point })),
        blocked_attempts: hits.slice(0, 50).map(h => ({ ts: h.ts, company: h.company, email: h.email, ip: h.ip, by: h.by, where: h.where })) });
    }
    return out({ ok: false, error: '알 수 없는 action', actions: ['status', 'rules', 'ip', 'visits', 'hits', 'lead', 'block', 'unblock'] }, 400);
  } catch (e) {
    return out({ ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500);
  }
};
