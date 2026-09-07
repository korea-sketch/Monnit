/* 사장님 확정 규칙 3가지가 코드대로 지켜지는가
   1) 모든 문의 알림 → 0702yeom@gmail.com · ops 와 먼데이에 동시 기록
   2) 고객 응대 메일은 백서·컨설팅만 (sendpw / sendguide, 답장 korea@monnit.com)
      알리미는 고객 회신 없음
   3) 발송은 StaticForms 기본, 실패하면 Web3Forms */
import fs from 'node:fs';
const F = process.cwd() + '/netlify/functions/';

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };
const H = t => console.log('\n' + t);

/* ── 규칙 3 : 발송 순서 ────────────────────────────── */
H('규칙 3 — StaticForms 기본, 실패 시 Web3Forms');
{
  const calls = [];
  globalThis.fetch = async (u) => { calls.push(String(u)); return { ok: true, json: async () => ({ success: true }) }; };
  const { notify, configured } = await import(F + '_notify.mjs?a');
  const r = await notify({ ts: '2026-09-07T05:00:00Z', company: '가나전자', interest: '긴급 경보 알리미' }, {});
  ok('1순위 = staticforms', r.via === 'staticforms', r);
  ok('  한 곳만 호출', calls.length === 1 && calls[0].includes('staticforms'), calls);
  ok('  선언된 순서', JSON.stringify(configured().order) === '["staticforms","web3forms","brevo"]', configured().order);
}
{
  const calls = [];
  globalThis.fetch = async (u) => {
    calls.push(String(u));
    if (String(u).includes('staticforms')) return { ok: false, status: 500, json: async () => ({ success: false }) };
    return { ok: true, json: async () => ({ success: true }) };
  };
  const { notify } = await import(F + '_notify.mjs?b');
  const r = await notify({ ts: '2026-09-07T05:00:00Z', company: '가나전자' }, {});
  ok('staticforms 실패 → web3forms', r.via === 'web3forms', r);
  ok('  실패 이력 기록', (r.tried || []).length === 1, r.tried);
}
{
  globalThis.fetch = async (u) => {
    if (String(u).includes('brevo')) return { ok: true };
    return { ok: false, status: 429, json: async () => ({ success: false }) };
  };
  process.env.BREVO_API_KEY = 'x';
  const { notify } = await import(F + '_notify.mjs?c');
  const r = await notify({ ts: '2026-09-07T05:00:00Z', company: '가나전자' }, {});
  ok('둘 다 한도 초과 → brevo', r.via === 'brevo' && r.to === '0702yeom@gmail.com', r);
  delete process.env.BREVO_API_KEY;
}
{
  globalThis.fetch = async () => { throw new Error('전부 다운'); };
  const { notify } = await import(F + '_notify.mjs?d');
  const r = await notify({ ts: '2026-09-07T05:00:00Z', company: '가나전자' }, {});
  ok('전부 실패해도 예외 없음', r.ok === false && Array.isArray(r.tried), r);
}

/* ── 규칙 1 : 수신자 · 본문 · 동시 기록 ────────────── */
H('규칙 1 — 0702yeom@gmail.com · ops · 먼데이');
{
  let body = null;
  globalThis.fetch = async (u, o) => { body = JSON.parse(o.body); return { ok: true, json: async () => ({ success: true }) }; };
  const { notify, subjectOf } = await import(F + '_notify.mjs?e');
  const lead = { ts: '2026-09-07T05:00:00Z', label: '접수', channel: '메타', company: '가나전자',
    name: '홍길동', phone: '010-1111-2222', email: 'a@x.com', interest: '긴급 경보 알리미',
    memo: '수량 문의', source: 'utm_source=meta', landing: 'https://monnit.co.kr/promo/alarm' };
  await notify(lead, { '알리미 모델': '소방 알리미' });
  ok('제목에 회사명', subjectOf(lead).includes('가나전자'), subjectOf(lead));
  ok('본문에 담당자·전화·이메일',
     body['담당자'] === '홍길동' && body['전화'] === '010-1111-2222' && body['이메일'] === 'a@x.com', body);
  ok('폼 원본 항목도 포함', body['알리미 모델'] === '소방 알리미', body);
  ok('빈 항목은 뺀다', !('형식 확인 필요' in body), Object.keys(body));
}
{
  globalThis.__MEM = { leads: {} }; globalThis.__NOTIFY = []; globalThis.__MON = [];
  fs.writeFileSync(F + '_store_r.mjs', `
export async function get(){return null;} export async function set(){return true;}
export async function append(s,k,o){ (globalThis.__MEM[s]=globalThis.__MEM[s]||{}); globalThis.__MEM[s][k]=(globalThis.__MEM[s][k]||'')+JSON.stringify(o); return true; }`);
  fs.writeFileSync(F + '_notify_r.mjs', `export async function notify(l){ globalThis.__NOTIFY.push(l); return {ok:true, via:'staticforms'}; }`);
  fs.writeFileSync(F + '_monday_r.mjs', `export async function pushLead(id,l){ globalThis.__MON.push({id,l}); return {ok:true}; }`);
  fs.writeFileSync(F + '_lead_r.mjs', fs.readFileSync(F + 'lead.mjs', 'utf8')
    .replace("from './_store.mjs'", "from './_store_r.mjs'")
    .replace("from './_notify.mjs'", "from './_notify_r.mjs'")
    .replace("from './_monday.mjs'", "from './_monday_r.mjs'"));
  const S = (await import(F + '_lead_r.mjs')).default;
  await S(new Request('https://x/api/lead', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 't' },
    body: JSON.stringify({ lead_type: 'contact', ts: '2026-09-07T05:00:00Z', page: '/promo/alarm',
      payload: { '회사명': '가나전자', '이름/직급': '홍길동', '이메일': 'a@x.com', '접점': 'promo_apply' } }) }));
  ok('ops 원장 기록', /가나전자/.test(globalThis.__MEM.leads['2026-09.jsonl'] || ''), globalThis.__MEM.leads);
  ok('먼데이 등록', globalThis.__MON.length === 1, globalThis.__MON.length);
  ok('알림 1통', globalThis.__NOTIFY.length === 1, globalThis.__NOTIFY.length);
  for (const f of ['_store_r.mjs', '_notify_r.mjs', '_monday_r.mjs', '_lead_r.mjs']) fs.unlinkSync(F + f);
}

/* ── 규칙 2 : 고객 응대 메일 ──────────────────────── */
H('규칙 2 — 응대 메일은 백서·컨설팅만');
{
  const leadSrc = fs.readFileSync(F + 'lead.mjs', 'utf8');
  ok('lead.mjs 는 고객에게 메일을 보내지 않는다', !/_reply/.test(leadSrc));
  ok('_reply.mjs 제거됨', !fs.existsSync(F + '_reply.mjs'));
  const pw = fs.readFileSync(F + 'sendpw.js', 'utf8');
  const gd = fs.readFileSync(F + 'sendguide.js', 'utf8');
  ok('백서 응대 = sendpw.js, 답장 korea@monnit.com', /replyTo[^\n]*korea@monnit\.com/.test(pw));
  ok('컨설팅 응대 = sendguide.js, 답장 korea@monnit.com', /replyTo[^\n]*korea@monnit\.com/.test(gd));
  ok('  둘 다 Brevo 발송', /api\.brevo\.com/.test(pw) && /api\.brevo\.com/.test(gd));
  const app = fs.readFileSync(process.cwd() + '/app.js', 'utf8');
  ok('알리미 접수에는 고객 회신 경로가 없다',
     !/sendguide/.test(app) && /PW_MAIL_URL/.test(app), '백서만 sendpw 호출');
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 규칙 3가지 전부 코드와 일치');
process.exit(fail ? 1 : 0);
