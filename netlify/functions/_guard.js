/** 경쟁사 차단 — 자료 다운로드·문의 접수·사이트 접속을 한 곳의 규칙으로 막는다 (2026-09-16)
 *
 *  ── 왜 만드는가 ─────────────────────────────────────────────────────
 *  경쟁사(데키스트, dekist.com)가 광고 랜딩에서 제안 가이드를 반복해서 받아 갔다.
 *  회사 IP 는 밖에서 알아낼 방법이 없다(홈페이지·메일은 클라우드·구글 주소다).
 *  그래서 「그 회사가 스스로 신원을 밝힌 순간의 접속 IP」를 자동으로 수집해 막는다.
 *
 *  ── 막는 기준 (하나라도 맞으면 차단) ───────────────────────────────
 *    · 이메일 도메인   dekist.com (하위 도메인 포함)
 *    · 회사명          데키스트 / dekist  ((주)·주식회사·띄어쓰기 무시)
 *    · 전화번호        010-7502-4359      (숫자만 비교)
 *    · 접속 IP         수동 등록 + 위 기준에 걸린 접속에서 자동 수집
 *
 *  ── 규칙이 저장되는 곳 (세 곳을 합쳐서 쓴다) ────────────────────────
 *    ① 아래 DEFAULTS           — 코드에 박힌 기본값 (지워지지 않음)
 *    ② Netlify 환경변수         — BLOCK_DOMAINS · BLOCK_COMPANIES · BLOCK_PHONES · BLOCK_IPS
 *                                 (쉼표 구분, 재배포 필요)
 *    ③ ops 저장소 blocklist.json — /ops/block 화면에서 추가·삭제 (즉시 반영, 최대 1분)
 *
 *  ── IP 자동 수집 규칙 ───────────────────────────────────────────────
 *  PC 에서 온 접속 → 사이트 전체 차단(scope=site), 30일
 *  휴대폰에서 온 접속 → 자료·접수만 차단(scope=gate), 3일
 *    휴대폰 통신사 IP 는 수천 명이 같이 쓰고 수시로 바뀐다. 사이트 전체를 막으면
 *    같은 IP 를 받은 진짜 고객까지 광고 랜딩을 못 보게 되므로 자료·접수만 막는다.
 *
 *  차단은 조용히 한다 — 「차단되었습니다」라고 알려주면 바로 다른 주소로 바꿔 온다.
 *  모든 차단 시도는 ops/blocked-YYYY-MM.jsonl 에 남고 /ops/block 에서 보인다. */

const DEFAULTS = {
  domains:   ['dekist.com'],
  companies: ['데키스트', 'dekist'],
  phones:    ['01075024359'],
  ips:       []
};

const AUTO_TTL_MS = 30 * 24 * 60 * 60 * 1000;          /* 자동 수집 IP 유지 기간 — PC */
const AUTO_TTL_MOBILE_MS = 3 * 24 * 60 * 60 * 1000;    /* 휴대폰 — 통신사 IP 는 금방 다른 사람에게 넘어간다 */
const CACHE_MS = 60 * 1000;
const STORE = 'ops', KEY = 'blocklist.json';

let _cache = null, _cacheAt = 0;

async function store() { return import('./_store.mjs'); }

/* ── 정규화 ───────────────────────────────────────────────────────── */
const normCompany = s => String(s || '').toLowerCase()
  .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|inc\.?|co\.?,?\s*ltd\.?|corp\.?/g, '')
  .replace(/[\s()\[\]·.,\-_'"]/g, '');
const normPhone = s => String(s || '').replace(/\D/g, '').replace(/^82(?=1)/, '0');
const normDomain = s => String(s || '').trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const normIp = s => String(s || '').trim().toLowerCase();
const envList = k => String(process.env[k] || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);

/** 요청 헤더(Request.headers 또는 event.headers)에서 접속 IP */
function ipOf(h) {
  const g = k => (h && typeof h.get === 'function') ? h.get(k) : (h && (h[k] || h[k.toLowerCase()]));
  return String(g('x-nf-client-connection-ip') || g('x-forwarded-for') || g('client-ip') || '')
    .split(',')[0].trim().slice(0, 45);
}
function uaOf(h) {
  const g = k => (h && typeof h.get === 'function') ? h.get(k) : (h && (h[k] || h[k.toLowerCase()]));
  return String(g('user-agent') || '').slice(0, 180);
}
const isMobileUA = ua => /iphone|ipad|ipod|android|mobile|kakaotalk|fban|fbav|instagram|line\//i.test(String(ua || ''));

/* ── IP 비교: 정확히 일치 · IPv4 CIDR(1.2.3.0/24) · 접두어(1.2.3.*) ── */
function v4int(ip) {
  const p = String(ip).split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) { const v = Number(x); if (!/^\d{1,3}$/.test(x) || v > 255) return null; n = n * 256 + v; }
  return n;
}
function ipMatch(ip, rule) {
  ip = normIp(ip); rule = normIp(rule);
  if (!ip || !rule) return false;
  if (ip === rule) return true;
  if (rule.endsWith('*')) return ip.startsWith(rule.slice(0, -1));
  const m = /^([\d.]+)\/(\d{1,2})$/.exec(rule);
  if (m) {
    const a = v4int(ip), b = v4int(m[1]), bits = Number(m[2]);
    if (a == null || b == null || bits > 32) return false;
    if (bits === 0) return true;
    const div = Math.pow(2, 32 - bits);
    return Math.floor(a / div) === Math.floor(b / div);
  }
  return false;
}
function validIpRule(s) {
  s = normIp(s);
  if (!s || s.length > 45) return false;
  if (/^[\d.]+\/\d{1,2}$/.test(s)) { const [a, b] = s.split('/'); return v4int(a) != null && Number(b) >= 8 && Number(b) <= 32; }
  if (s.endsWith('*')) return /^[\d.]{4,}\*$|^[0-9a-f:]{5,}\*$/.test(s);
  return v4int(s) != null || (/^[0-9a-f:]{3,45}$/.test(s) && s.split(':').length >= 3);
}

/* ── 저장소 ───────────────────────────────────────────────────────── */
function blank() { return { domains: [], companies: [], phones: [], ips: [] }; }
function clean(o) {
  const b = blank();
  if (!o || typeof o !== 'object') return b;
  for (const k of Object.keys(b)) b[k] = Array.isArray(o[k]) ? o[k].filter(x => x && x.v).slice(0, 2000) : [];
  return b;
}

async function readStored() {
  try {
    const { get } = await store();
    return clean(JSON.parse((await get(STORE, KEY)) || 'null'));
  } catch (e) { return blank(); }
}
async function writeStored(o) {
  const { set } = await store();
  const now = Date.now();
  o = clean(o);
  o.ips = o.ips.filter(x => !x.until || x.until > now);   /* 만료된 자동 수집분은 저장할 때 정리 */
  _cache = null;
  return set(STORE, KEY, JSON.stringify(o));
}

/** 세 곳의 규칙을 합친 결과 (1분 캐시) */
async function rules(fresh) {
  if (!fresh && _cache && Date.now() - _cacheAt < CACHE_MS) return _cache;
  const st = await readStored();
  const now = Date.now();
  const r = {
    domains:   [...new Set([...DEFAULTS.domains, ...envList('BLOCK_DOMAINS'), ...st.domains.map(x => x.v)].map(normDomain).filter(Boolean))],
    companies: [...new Set([...DEFAULTS.companies, ...envList('BLOCK_COMPANIES'), ...st.companies.map(x => x.v)].map(normCompany).filter(Boolean))],
    phones:    [...new Set([...DEFAULTS.phones, ...envList('BLOCK_PHONES'), ...st.phones.map(x => x.v)].map(normPhone).filter(x => x.length >= 8))],
    ips: [
      ...DEFAULTS.ips.map(v => ({ v, scope: 'site' })),
      ...envList('BLOCK_IPS').map(v => ({ v, scope: 'site' })),
      ...st.ips.filter(x => !x.until || x.until > now)
    ]
  };
  _cache = r; _cacheAt = Date.now();
  return r;
}

/** 신원·IP 검사. 걸리면 { by, rule } 을, 아니면 null 을 돌려준다. */
async function inspect({ ip, email, company, phone } = {}) {
  const r = await rules();
  const em = String(email || '').trim().toLowerCase();
  const dom = em.includes('@') ? em.split('@').pop() : '';
  if (dom) for (const d of r.domains) if (dom === d || dom.endsWith('.' + d)) return { by: 'domain', rule: d };
  const co = normCompany(company);
  if (co) for (const c of r.companies) if (c && co.includes(c)) return { by: 'company', rule: c };
  const ph = normPhone(phone);
  if (ph.length >= 8) for (const p of r.phones) if (ph === p) return { by: 'phone', rule: p };
  if (ip) for (const x of r.ips) if (ipMatch(ip, x.v)) return { by: 'ip', rule: x.v, scope: x.scope || 'site' };
  return null;
}

/** 신원으로 걸린 접속의 IP 를 차단 목록에 넣는다 (이미 있으면 기간만 연장) */
async function learn(ip, ua, why) {
  ip = normIp(ip);
  if (!ip || !validIpRule(ip)) return false;
  try {
    const st = await readStored();
    const now = Date.now();
    const ttl = isMobileUA(ua) ? AUTO_TTL_MOBILE_MS : AUTO_TTL_MS;
    const hit = st.ips.find(x => normIp(x.v) === ip);
    if (hit) {
      if (hit.src === 'auto') { hit.until = now + ttl; hit.last = now; hit.n = (hit.n || 1) + 1; }
      else return true;                                   /* 수동 등록분은 건드리지 않는다 */
    } else {
      st.ips.push({
        v: ip, scope: isMobileUA(ua) ? 'gate' : 'site', src: 'auto',
        at: now, last: now, until: now + ttl, n: 1,
        memo: String(why || '').slice(0, 80), ua: String(ua || '').slice(0, 120)
      });
    }
    return await writeStored(st);
  } catch (e) { return false; }
}

/** 차단 기록 한 줄 */
async function logHit(entry) {
  try {
    const { append } = await store();
    const ts = new Date();
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(ts).slice(0, 7);
    await append(STORE, 'blocked-' + month + '.jsonl', { ts: ts.toISOString(), ...entry });
  } catch (e) { /* 기록 실패가 응답을 막으면 안 된다 */ }
}

/* ── 규칙 추가·삭제 (관리 화면 /ops/block 과 원격 API /api/block 이 같이 쓴다) ── */
const KINDS = ['domains', 'companies', 'phones', 'ips'];
/* 도메인째로 막으면 일반 고객이 전부 막히는 메일 서비스 */
const FREE_MAIL = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com', 'hotmail.com',
  'outlook.com', 'yahoo.com', 'icloud.com', 'me.com', 'live.com', 'msn.com', 'korea.kr', 'go.kr'];

function validateRule(kind, v) {
  if (kind === 'domains') {
    v = normDomain(v);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v)) return { err: '도메인 형식이 아닙니다 (예: dekist.com)' };
    if (FREE_MAIL.includes(v)) return { err: v + ' 는 일반 메일이라 도메인째 막으면 고객이 막힙니다. IP·회사명·전화번호로 막아 주세요.' };
    return { v };
  }
  if (kind === 'companies') {
    if (normCompany(v).length < 2) return { err: '회사명이 너무 짧습니다 (2글자 이상)' };
    return { v: String(v).trim().slice(0, 60) };
  }
  if (kind === 'phones') {
    const n = normPhone(v);
    if (n.length < 9) return { err: '전화번호 형식이 아닙니다' };
    return { v: n };
  }
  if (kind === 'ips') {
    v = normIp(v);
    if (!validIpRule(v)) return { err: 'IP 형식이 아닙니다 (예: 1.2.3.4 · 1.2.3.0/24 · 1.2.3.*)' };
    if (/^(10\.|127\.|192\.168\.|0\.)/.test(v) || v === '*' || /^[\d.]+\/(\d)$/.test(v))
      return { err: '내부망·너무 넓은 범위는 막을 수 없습니다' };
    return { v };
  }
  return { err: '종류가 잘못되었습니다 (ips · domains · companies · phones)' };
}

/** 규칙 추가. opts = { scope:'site'|'gate', days, memo, by } → { ok, error, item } */
async function addRule(kind, value, opts = {}) {
  if (!KINDS.includes(kind)) return { ok: false, error: '종류가 잘못되었습니다' };
  const chk = validateRule(kind, value);
  if (chk.err) return { ok: false, error: chk.err };
  const st = await readStored();
  const now = Date.now();
  const days = Number(opts.days) > 0 ? Math.min(Number(opts.days), 3650) : 0;
  const item = { v: chk.v, src: 'manual', at: now, memo: String(opts.memo || '').slice(0, 80), by: String(opts.by || '').slice(0, 20) };
  if (kind === 'ips') {
    item.scope = opts.scope === 'gate' ? 'gate' : 'site';
    item.until = days ? now + days * 86400000 : 0;
  }
  const list = st[kind];
  const i = list.findIndex(x => String(x.v).toLowerCase() === String(chk.v).toLowerCase());
  if (i >= 0) list[i] = { ...list[i], ...item };   /* 자동 수집분을 직접 확정하면 덮어쓴다 */
  else list.push(item);
  const ok = await writeStored(st);
  return { ok: !!ok, error: ok ? '' : '저장 실패', item };
}

/** 규칙 삭제 → { ok, error } */
async function removeRule(kind, value) {
  if (!KINDS.includes(kind)) return { ok: false, error: '종류가 잘못되었습니다' };
  const st = await readStored();
  const target = String(value || '').trim().toLowerCase();
  const norm = kind === 'phones' ? normPhone(target) : kind === 'domains' ? normDomain(target) : target;
  const before = st[kind].length;
  st[kind] = st[kind].filter(x => String(x.v).toLowerCase() !== target && String(x.v).toLowerCase() !== norm);
  if (st[kind].length === before) {
    const locked = [...DEFAULTS[kind], ...envList('BLOCK_' + kind.toUpperCase())].map(String).map(s => s.toLowerCase());
    return { ok: false, error: locked.includes(target) || locked.includes(norm)
      ? '코드 기본값·환경변수로 잡힌 항목이라 여기서는 풀 수 없습니다' : '차단 목록에 없는 항목입니다' };
  }
  const ok = await writeStored(st);
  return { ok: !!ok, error: ok ? '' : '저장 실패' };
}

/** IP 하나가 지금 어떤 규칙에 걸리는지 */
async function ipStatus(ip) {
  const r = await rules(true);
  const hit = r.ips.find(x => ipMatch(ip, x.v));
  return hit ? { blocked: true, scope: hit.scope || 'site', rule: hit.v, until: hit.until || 0, src: hit.src || 'fixed', memo: hit.memo || '' }
             : { blocked: false };
}

/** 함수들이 한 줄로 쓰는 진입점.
 *  걸리면 기록·IP 수집까지 끝내고 차단 사유를, 아니면 null 을 돌려준다. */
async function guard(headers, who = {}, where = '') {
  try {
    const ip = ipOf(headers), ua = uaOf(headers);
    const hit = await inspect({ ip, ...who });
    if (!hit) return null;
    if (hit.by !== 'ip') await learn(ip, ua, (who.company || who.email || '') + ' · ' + hit.by);
    await logHit({
      where, ip, ua, by: hit.by, rule: hit.rule,
      email: String(who.email || '').slice(0, 120), company: String(who.company || '').slice(0, 80),
      name: String(who.name || '').slice(0, 40), phone: String(who.phone || '').slice(0, 30),
      title: String(who.title || '').slice(0, 120)
    });
    return hit;
  } catch (e) { return null; }   /* 검사 오류로 정상 고객을 막지 않는다 */
}

module.exports = {
  DEFAULTS, AUTO_TTL_MS, AUTO_TTL_MOBILE_MS, STORE, KEY, KINDS, FREE_MAIL,
  addRule, removeRule, validateRule, ipStatus,
  guard, inspect, learn, logHit, rules, readStored, writeStored,
  ipOf, uaOf, ipMatch, validIpRule, isMobileUA,
  normCompany, normPhone, normDomain, normIp
};
