/* 맞춤 제안서 · 경우의 수 테스트 (2026-09-17)
   정상 흐름은 test-proposal.mjs 가 본다. 여기서는 「이상한 입력·장애·악의적 요청」만 모은다.
   실행: node tools/test-edge.mjs   (저장소 루트에서) */
globalThis.__PROPOSAL_MEM = {};
process.env.BREVO_API_KEY = 'test-brevo';
process.env.ANTHROPIC_API_KEY = '';
process.env.PROPOSAL_SECRET = 'edge-secret';
process.env.PROPOSAL_ADMIN_KEY = 'admin-key-1234';
process.env.PROPOSAL_SITE = 'https://monnit.co.kr';
process.env.PROPOSAL_MODE = 'instant';
process.env.PROPOSAL_INSTANT_SECONDS = '0';
process.env.PROPOSAL_RATE_IP_HOUR = '6';

const MAILS = [];
let brevoDown = false, bgOff = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('api.brevo.com')) {
    if (brevoDown) return new Response('{"message":"down"}', { status: 503 });
    const b = JSON.parse(opt.body);
    MAILS.push({ to: b.to.map(t => t.email).join(','), subject: b.subject, html: (b.htmlContent || '') + (b.textContent || ''), attach: !!b.attachment });
    return new Response(JSON.stringify({ messageId: 'm' + MAILS.length }), { status: 201 });
  }
  if (url.includes('proposal-build-background')) {
    if (bgOff) return new Response(null, { status: 502 });
    const B = await import('../netlify/functions/proposal-build-background.mjs');
    await B.default(new Request(url, { method: 'POST', headers: opt.headers, body: opt.body }));
    return new Response(null, { status: 202 });
  }
  if (/staticforms|web3forms|api\.monday\.com/.test(url)) return new Response('{"success":true,"data":{}}', { status: 200 });
  return realFetch(url, opt);
};

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + String(JSON.stringify(got)).slice(0, 300))); if (!c) fail++; };
const API = (await import('../netlify/functions/proposal-api.mjs')).default;
const ADMIN = (await import('../netlify/functions/proposal-admin.mjs')).default;
const S = await import('../netlify/lib/proposal/store.mjs');
const J = await import('../netlify/lib/proposal/jobs.mjs');

let ipSeq = 10;
const nextIp = () => '203.0.113.' + (ipSeq++);
const req = (path, { method = 'POST', body, headers = {}, raw } = {}) => API(new Request('https://monnit.co.kr' + path, {
  method,
  headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': nextIp(), 'user-agent': 'Mozilla/5.0', ...headers },
  body: method === 'GET' ? undefined : (raw !== undefined ? raw : JSON.stringify(body))
}), {});
const js = async r => { try { return await r.json(); } catch (e) { return null; } };
let seq = 0;
/* test:false = 「실제 접수처럼 다뤄 달라」 — 담당자 알림·원장 경로 자체를 검증하기 위해서다.
   회사명에 「테스트」가 들어가면 기본은 테스트 접수로 분류되어 알림이 나가지 않는다
   (netlify/functions/_istest.mjs). 그 분류가 제대로 막는지는 아래에서 따로 확인한다. */
const lead = (o = {}) => ({
  test: false,
  company: '엣지테스트' + (++seq) + '(주)', name: '김현장', title: '팀장', email: `field.kim${seq}@edge-corp.co.kr`,
  phone: '010-2957-48' + String(10 + seq).slice(-2), industry: 'manufacturing', problems: ['elec_fire'], goals: ['safety'],
  consent: true, elapsed: 12000, entry: 'proposal', ...o
});

/* ── 1. 요청 형식 ── */
{
  let r = await req('/api/proposal', { method: 'GET' });
  ok('GET /api/proposal → 404/405', [404, 405].includes(r.status), r.status);
  r = await req('/api/proposal', { headers: { 'content-type': 'text/plain' }, body: lead() });
  ok('text/plain → 400', r.status === 400, r.status);
  r = await req('/api/proposal', { raw: '{"company":' });
  ok('깨진 JSON → 400', r.status === 400, r.status);
  r = await req('/api/proposal', { raw: '[1,2]' });
  ok('배열 JSON → 400', r.status === 400, r.status);
  r = await req('/api/proposal', { raw: 'null' });
  ok('null JSON → 400', r.status === 400, r.status);
  r = await req('/api/proposal', { body: lead({ memo: 'x'.repeat(20000) }) });
  ok('16KB 초과 → 413', r.status === 413, r.status);
  r = await req('/api/proposal', { headers: { origin: 'https://evil.example' }, body: lead() });
  ok('다른 사이트 Origin → 403', r.status === 403, r.status);
  r = await req('/api/proposal', { headers: { origin: 'https://monnit.co.kr.evil.example' }, body: lead() });
  ok('monnit.co.kr 를 흉내 낸 도메인 → 403', r.status === 403, r.status);
  r = await req('/api/proposal', { headers: { origin: 'null' }, body: lead() });
  ok('Origin: null → 403', r.status === 403, r.status);
  r = await req('/api/proposal', { headers: { 'sec-fetch-site': 'cross-site' }, body: lead() });
  ok('Sec-Fetch-Site: cross-site → 403', r.status === 403, r.status);
  r = await req('/api/proposal', { headers: { origin: 'https://www.monnit.co.kr' }, body: lead() });
  ok('www.monnit.co.kr 허용', r.status === 200, r.status);
  r = await req('/api/proposal/unknown', { method: 'GET' });
  ok('없는 경로 → 404', r.status === 404, r.status);
}

/* ── 2. 입력값 ── */
{
  const bad = async (name, o, field) => {
    const r = await req('/api/proposal', { body: lead(o) }); const b = await js(r);
    ok(name, r.status === 400 && b && b.fields && (field ? b.fields[field] : true), { s: r.status, b });
  };
  await bad('회사명 없음', { company: '' }, 'company');
  await bad('회사명 공백만', { company: '   ' }, 'company');
  await bad('회사명 1글자', { company: 'A' }, 'company');
  await bad('성함 없음', { name: '' }, 'name');
  await bad('이메일 형식 오류', { email: 'kim@@corp' }, 'email');
  await bad('일회용 메일', { email: 'field.kim@mailinator.com' }, 'email');
  await bad('오타 도메인(gmial)', { email: 'field.kim@gmial.com' }, 'email');
  await bad('자리만 채운 번호', { phone: '010-1234-5678' }, 'phone');
  await bad('동의 없음', { consent: false }, 'consent');
  await bad('동의가 문자열 "true"', { consent: 'true' }, 'consent');
  await bad('과제 없음(직접 신청)', { problems: [] }, 'problems');
  await bad('없는 과제 키만', { problems: ['__proto__', 'constructor'] }, 'problems');
  await bad('산업 없음(직접 신청)', { industry: 'nope' }, 'industry');

  let r = await req('/api/proposal', { body: lead({ phone: '' }) });
  ok('연락처는 선택 — 비워도 접수', r.status === 200, await js(r));
  r = await req('/api/proposal', { body: lead({ email: '  Field.Upper@Edge-Corp.CO.KR ' }) });
  ok('이메일 앞뒤 공백·대문자 정리 후 접수', r.status === 200, await js(r));
  r = await req('/api/proposal', { body: lead({ company: { a: 1 } }) });
  ok('회사명이 객체 → 거절', r.status === 400, { s: r.status, b: await js(r) });
  r = await req('/api/proposal', { body: lead({ name: ['김', '현장'] }) });
  ok('성함이 배열 → 거절', r.status === 400, { s: r.status, b: await js(r) });
  r = await req('/api/proposal', { body: lead({ problems: 'elec_fire' }) });
  const pb = await js(r);
  ok('과제가 문자열 한 개 → 400 또는 접수(오류 없음)', [200, 400].includes(r.status), pb);
  r = await req('/api/proposal', { body: lead({ elapsed: 'abc' }) });
  ok('작성시간이 문자 → 오류 없이 접수', r.status === 200, await js(r));
  r = await req('/api/proposal', { body: lead({ goals: ['nope', 'safety', 'safety'] }) });
  ok('목표 중복·잘못된 키 정리', r.status === 200, await js(r));
  r = await req('/api/proposal', { body: lead({ memo: '줄1\n줄2\u0000\u202e거꾸로', company: '제어문자\u0007회사\u200b' }) });
  const cb = await js(r);
  ok('제어문자 섞인 입력 → 접수(정리)', r.status === 200 && cb.token, cb);
  if (cb && cb.token) {
    const m = await S.getJSON(J.tokenKey(cb.token)); const job = await S.getJob(m.id);
    ok('  저장된 회사명·메모에 제어문자·방향 전환 문자 없음', !/[\u0000-\u001f\u200b-\u200f\u202a-\u202e]/.test(job.lead.company + job.lead.memo), job.lead.company + '|' + job.lead.memo);
  }
}

/* ── 3. 봇 ── */
{
  let n = MAILS.length;
  let r = await req('/api/proposal', { body: lead({ website: 'http://spam' }) }); let b = await js(r);
  ok('허니팟 → 조용히 성공처럼', r.status === 200 && b.silent && !b.token, b);
  r = await req('/api/proposal', { body: lead({ elapsed: 800 }) }); b = await js(r);
  ok('3초 안에 제출 → 조용히 무시', b.silent === true, b);
  ok('  봇 요청에는 메일 없음', MAILS.length === n, MAILS.length - n);
}

/* ── 4. 경쟁사 차단 ── */
{
  const n = MAILS.length;
  for (const [nm, o] of [['도메인', { email: 'buyer.lee@dekist.com' }], ['하위 도메인', { email: 'buyer.lee@mail.dekist.com' }],
    ['회사명', { company: '주식회사 데키스트' }], ['영문 회사명', { company: 'DEKIST Co.' }], ['전화번호', { phone: '010 7502 4359' }]]) {
    const r = await req('/api/proposal', { body: lead(o) }); const b = await js(r);
    ok('경쟁사(' + nm + ') → 조용히 무시', r.status === 200 && b.silent && !b.token, b);
  }
  ok('  경쟁사 요청에 메일 없음', MAILS.length === n, MAILS.slice(n).map(m => m.subject));
}

/* ── 5. 중복 ── */
{
  const base = lead({ company: '(주)중복정밀', email: 'dup.kim@dup-corp.co.kr' });
  let r = await req('/api/proposal', { body: base }); const first = await js(r);
  ok('첫 신청 → 토큰', !!first.token, first);
  r = await req('/api/proposal', { body: { ...base, company: '중복정밀' } }); let b = await js(r);
  ok('(주) 빼고 같은 회사 재신청 → dup, 토큰 없음', b.dup && !b.token, b);
  r = await req('/api/proposal', { body: { ...base, company: '주식회사 중복 정밀', email: 'DUP.KIM@dup-corp.co.kr' } }); b = await js(r);
  ok('주식회사·띄어쓰기·대문자 이메일도 같은 신청으로 봄', b.dup && !b.token, b);
  r = await req('/api/proposal', { body: { ...base, problems: ['leak'] } }); b = await js(r);
  ok('다른 과제로 재신청 → 견적 안내(limit)', b.dup && b.limit && !b.same, b);
  r = await req('/api/proposal', { body: { ...base, email: 'other.park@dup-corp.co.kr' } }); b = await js(r);
  ok('같은 회사 다른 담당자 → 새 접수', !!b.token, b);
  const links = MAILS.filter(m => /진행|status/i.test(m.subject + m.html) && m.to === 'dup.kim@dup-corp.co.kr');
  ok('  진행 화면 링크 재발송은 10분에 한 번', links.length <= 1, links.length);
}

/* ── 6. 접수 제한 ── */
{
  const ip = '198.51.100.7';
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const r = await API(new Request('https://monnit.co.kr/api/proposal', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': ip }, body: JSON.stringify(lead()) }), {});
    codes.push(r.status);
  }
  ok('같은 IP 시간당 6건 초과 → 429', codes.slice(0, 6).every(c => c === 200) && codes.slice(6).every(c => c === 429), codes);
}

/* ── 7. 진행 화면·PDF 링크 ── */
{
  let r = await req('/api/proposal/status?t=abc', { method: 'GET' });
  ok('짧은 토큰 → 404', r.status === 404, r.status);
  r = await req('/api/proposal/status?t=' + 'A'.repeat(24), { method: 'GET' });
  ok('없는 토큰 → 404', r.status === 404, r.status);
  r = await req('/api/proposal/status?t=' + encodeURIComponent('../../job/x') + 'aaaaaaaaaaaaaaaaaaaa', { method: 'GET' });
  ok('경로 문자 섞인 토큰 → 404', r.status === 404, r.status);
  r = await req('/api/proposal/status', { method: 'GET' });
  ok('토큰 없음 → 404', r.status === 404, r.status);

  const c = await js(await req('/api/proposal', { body: lead({ company: '진행화면테스트', email: 'status.kim@status-corp.co.kr' }) }));
  r = await req('/api/proposal/status?t=' + c.token, { method: 'GET' }); let b = await js(r);
  ok('정상 토큰 → 진행 화면', r.status === 200 && b.view && b.progress, b);
  ok('  진행 화면에 이메일·전화 노출 안 됨', !JSON.stringify(b).includes('status.kim@') && !JSON.stringify(b).includes('010-'), JSON.stringify(b).match(/status\.kim@|010-[\d-]+/));
  ok('  즉시 방식 → 발송 완료 후 pdf:true', b.pdf === true, b.view && b.view.status);
  r = await req('/api/proposal/status?t=' + c.token + '&lang=en', { method: 'GET' }); b = await js(r);
  ok('  lang=en → 영문', b.lang === 'en', b.lang);
  r = await req('/api/proposal/status?t=' + c.token + '&lang=<script>', { method: 'GET' }); b = await js(r);
  ok('  이상한 lang → ko 로', b.lang === 'ko', b.lang);

  const m = await S.getJSON(J.tokenKey(c.token)); const job = await S.getJob(m.id);
  const exp = Date.now() + 86400000, sig = J.signPdf(job.id, exp);
  r = await req(`/api/proposal/pdf?id=${job.id}&e=${exp}&s=${sig}`, { method: 'GET' });
  const buf = new Uint8Array(await r.arrayBuffer());
  ok('서명된 PDF 링크 → PDF', r.status === 200 && String.fromCharCode(...buf.slice(0, 4)) === '%PDF', r.status);
  ok('  파일 이름 헤더 안전', /filename="proposal-MK-P[\w-]+\.pdf"/.test(r.headers.get('content-disposition') || ''), r.headers.get('content-disposition'));
  r = await req(`/api/proposal/pdf?id=${job.id}&e=${exp}&s=${sig.replace(/.$/, c2 => c2 === '0' ? '1' : '0')}`, { method: 'GET' });
  ok('서명 1글자 변조 → 410', r.status === 410, r.status);
  const old = Date.now() - 1000;
  r = await req(`/api/proposal/pdf?id=${job.id}&e=${old}&s=${J.signPdf(job.id, old)}`, { method: 'GET' });
  ok('만료된 링크 → 410', r.status === 410, r.status);
  r = await req(`/api/proposal/pdf?id=${job.id}&e=${exp}`, { method: 'GET' });
  ok('서명 없음 → 410', r.status === 410, r.status);
  r = await req(`/api/proposal/pdf?id=../../x&e=${exp}&s=${sig}`, { method: 'GET' });
  ok('id 경로 조작 → 410', r.status === 410, r.status);

  await S.patchJob(job.id, j => { j.purged = true; });
  r = await req('/api/proposal/status?t=' + c.token, { method: 'GET' });
  ok('보관기간 지나 파기된 신청 → 404', r.status === 404, r.status);
  r = await req(`/api/proposal/pdf?id=${job.id}&e=${exp}&s=${sig}`, { method: 'GET' });
  ok('  파기된 신청 PDF → 404', r.status === 404, r.status);
}

/* ── 8. XSS · 메일 머리글 주입 ── */
{
  const n = MAILS.length;
  const x = '<img src=x onerror=alert(1)>"\'';
  const r = await req('/api/proposal', { body: lead({ company: '스크립트' + x, name: '홍<b>길동</b>', facility: '<script>alert(1)</script>', memo: x }) });
  const b = await js(r);
  ok('HTML 섞인 입력 → 접수', r.status === 200 && b.token, b);
  const html = MAILS.slice(n).map(m => m.html).join('\n');
  ok('  메일 본문에 태그가 그대로 들어가지 않음', !/<img src=x|<script>alert|<b>길동/.test(html), html.match(/<img src=x[^>]*>|<script>alert|<b>길동/));
  const subj = MAILS.slice(n).map(m => m.subject).join('|');
  ok('  메일 제목에 줄바꿈 없음', !/[\r\n]/.test(subj), subj);
  const v = await js(await req('/api/proposal/status?t=' + b.token, { method: 'GET' }));
  ok('  진행 화면 JSON 은 원문 그대로(화면에서 이스케이프)', typeof v.view.company === 'string', v.view.company);

  const hdr = await req('/api/proposal', { body: lead({ email: 'inj.kim@corp.co.kr\r\nBcc: victim@x.com' }) });
  const hb = await js(hdr);
  ok('이메일 머리글 주입 → 거절', hdr.status === 400, hb);
}

/* ── 9. 미리보기 · 회사 인식 ── */
{
  let r = await req('/api/proposal/preview?industry=nope&problems=__proto__,x', { method: 'GET' }); let b = await js(r);
  ok('미리보기 — 모르는 산업·과제 → 오류 없음', r.status === 200 && b.ok, { s: r.status, b });
  r = await req('/api/proposal/preview', { method: 'GET' }); b = await js(r);
  ok('미리보기 — 값 없음 → 오류 없음', r.status === 200 && b.ok, r.status);
  r = await req('/api/proposal/preview?problems=' + 'elec_fire,'.repeat(500), { method: 'GET' }); b = await js(r);
  ok('미리보기 — 과제 500개 → 오류 없음', r.status === 200, r.status);
  r = await req('/api/proposal/detect?company=A', { method: 'GET' }); b = await js(r);
  ok('회사 인식 — 1글자 → 빈 결과', b.ok && b.industry === '', b);
  r = await req('/api/proposal/detect?company=' + encodeURIComponent('삼성바이오로직스'), { method: 'GET' }); b = await js(r);
  ok('회사 인식 — 알려진 회사 → 산업 추정', b.ok && !!b.industry, b);
  ok('  고객 목록 여부(known) 외 개인정보 없음', !('email' in b) && !('list' in b), Object.keys(b));
  r = await req('/api/proposal/detect?company=' + encodeURIComponent('삼성'), { method: 'GET', headers: { origin: 'https://evil.example' } });
  ok('회사 인식 — 다른 사이트 → 403', r.status === 403, r.status);
}

/* ── 10. 장애 ── */
{
  /* 메일 서버 장애 — 접수는 성공, 나중에 재시도할 수 있게 기록 */
  brevoDown = true;
  let r = await req('/api/proposal', { body: lead({ company: '메일장애테스트' }) }); let b = await js(r);
  ok('메일 서버 장애에도 접수 성공', r.status === 200 && b.token, b);
  const m = await S.getJSON(J.tokenKey(b.token)); let job = await S.getJob(m.id);
  ok('  발송 실패가 기록됨(자동 재시도 대상)', job.status !== 'sent' && (job.attempts > 0 || /fail|retry|drafted/.test(job.status)), { status: job.status, attempts: job.attempts });
  brevoDown = false;
  const P = await import('../netlify/lib/proposal/pipeline.mjs');
  await P.tick({ now: Date.now() + 30 * 60000, origin: 'https://monnit.co.kr' });
  job = await S.getJob(m.id);
  ok('  메일 복구 후 정기 점검에서 발송', job.status === 'sent', { status: job.status, log: (job.log || []).slice(-3) });

  /* 생성 함수 호출 실패 — 진행 화면을 보는 동안/정기 점검에서 이어감 */
  bgOff = true;
  r = await req('/api/proposal', { body: lead({ company: '생성지연테스트' }) }); b = await js(r);
  ok('생성 함수 호출 실패에도 접수 성공', r.status === 200 && b.token, b);
  bgOff = false;
  const m2 = await S.getJSON(J.tokenKey(b.token));
  await P.tick({ now: Date.now() + 30 * 60000, origin: 'https://monnit.co.kr' });
  job = await S.getJob(m2.id);
  ok('  정기 점검에서 생성·발송', job.status === 'sent', { status: job.status, log: (job.log || []).slice(-4) });

  /* 저장소 장애 — 담당자 메일로 접수 내용을 남긴다 */
  const n = MAILS.length;
  const saved = globalThis.__PROPOSAL_MEM;
  globalThis.__PROPOSAL_MEM = new Proxy(saved, { set() { throw new Error('blobs down'); } });
  r = await req('/api/proposal', { body: lead({ company: '저장소장애테스트' }) }); b = await js(r);
  globalThis.__PROPOSAL_MEM = saved;
  ok('저장소 장애 → degraded 응답(오류 화면 아님)', r.status === 200 && b.degraded, { s: r.status, b });
  ok('  담당자에게 접수 내용 메일', MAILS.slice(n).some(mm => /저장소장애테스트/.test(mm.subject + mm.html)), MAILS.slice(n).map(mm => mm.subject));
}

/* ── 11. 관리 화면 권한 ── */
{
  const A = (path, headers = {}) => ADMIN(new Request('https://monnit.co.kr' + path, { headers: { origin: 'https://monnit.co.kr', ...headers } }), {});
  let r = await A('/api/proposal-admin/list');
  ok('관리 API 무인증 → 401/403', [401, 403, 404].includes(r.status), r.status);
  r = await A('/api/proposal-admin/list', { 'x-admin-key': 'wrong' });
  ok('관리 API 틀린 키 → 401/403', [401, 403, 404].includes(r.status), r.status);
  r = await A('/ops/proposals');
  const t = await r.text();
  ok('관리 화면 무인증 → 목록 대신 로그인', !/MK-P\d{6}/.test(t), r.status);
}

/* ── 12. 자료 받기(sendpw · getdoc) ── */
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const SP = require('../netlify/functions/sendpw.js');
  const GD = require('../netlify/functions/getdoc.js');
  const TITLE = '무선 IoT 설비 예지보전 제안 가이드';
  const ev = (body, headers = {}) => ({ httpMethod: 'POST', headers: { origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': nextIp(), ...headers }, body: JSON.stringify(body) });
  const call = async e => { const r = await SP.handler(e); return { s: r.statusCode, b: JSON.parse(r.body || '{}') }; };
  const good = { token: 'mnt-pw-2026-7f3k9', email: 'doc.kim@doc-corp.co.kr', title: TITLE, company: '자료테스트', name: '김자료' };

  let r = await call(ev({ ...good, token: 'wrong' }));
  ok('자료 — 토큰 틀림 → 401', r.s === 401, r);
  r = await call({ httpMethod: 'GET', headers: {} });
  ok('자료 — GET → 405', r.s === 405, r);
  r = await call({ httpMethod: 'POST', headers: {}, body: '{bad' });
  ok('자료 — 깨진 JSON → 500 대신 안전 응답', [400, 500].includes(r.s) && r.b.ok === false, r);
  r = await call(ev({ ...good, email: 'test@doc-corp.co.kr' }));
  ok('자료 — 장난 이메일 → 400', r.s === 400 && r.b.error === 'bad_email', r);
  r = await call(ev({ ...good, title: '없는 자료' }));
  ok('자료 — 없는 제목 → not_ready', r.s === 404, r);
  r = await call(ev({ ...good, title: undefined, titles: [TITLE, TITLE, '없는 자료', 1, null, {}] }));
  ok('자료 — 여러 건(중복·잘못된 값 섞임) → 있는 것만 1건', r.s === 200 && r.b.urls.length === 1, r);
  r = await call(ev({ ...good, email: 'buyer.lee@dekist.com' }));
  ok('자료 — 경쟁사 → not_ready(차단 사실 숨김)', r.s === 404 && r.b.error === 'not_ready', r);

  const n = MAILS.length;
  r = await call(ev(good, { origin: 'https://evil.example' }));
  ok('자료 — 다른 사이트 Origin 이어도 발급(토큰 기반)', r.s === 200 && r.b.url, r);
  const m = MAILS.slice(n).map(x => x.html).join('') + JSON.stringify(MAILS.slice(n));
  ok('  안내 메일 링크는 monnit.co.kr 로만', !/evil\.example/.test(m), m.match(/https?:\/\/[^\s"\\]+/g));

  const u = new URL('https://monnit.co.kr' + r.b.url);
  const q = Object.fromEntries(u.searchParams);
  const dl = async qq => (await GD.handler({ queryStringParameters: qq, headers: { 'x-nf-client-connection-ip': nextIp() } })).statusCode;
  ok('받기 — 정상 링크 → 200', await dl(q) === 200, await dl(q));
  ok('받기 — 서명 변조 → 403', await dl({ ...q, s: q.s.replace(/^./, c => c === 'a' ? 'b' : 'a') }) === 403, 0);
  ok('받기 — 만료 → 410', await dl({ ...q, e: String(Date.now() - 1) }) === 410, 0);
  ok('받기 — 경로 조작 파일명 → 400', await dl({ ...q, f: '../netlify.toml' }) === 400, 0);
  ok('받기 — 값 없음 → 400', await dl({}) === 400, 0);
  const hr = await GD.handler({ queryStringParameters: { ...q, n: 'a"\r\nSet-Cookie: x=1.pdf' }, headers: {} });
  ok('받기 — 다운로드 이름 머리글 주입 불가', !/[\r\n]/.test(hr.headers['Content-Disposition']), hr.headers['Content-Disposition']);
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 경우의 수 전부 통과');
process.exit(fail ? 1 : 0);
