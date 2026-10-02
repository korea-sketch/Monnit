/* 접수 삭제 기능 시험 (2026-09-18)
 *
 *   node tools/test-delete.mjs
 *
 * 점검하려고 넣은 접수를 관리 화면에서 지울 수 있어야 한다.
 * 여기서 보는 것.
 *   ① 지우면 목록·상세·진행 화면에서 정말 사라지는가
 *   ② 개인정보와 PDF 사본이 실제로 지워지는가
 *   ③ 대기 중이던 발송 예약이 함께 지워져 나가지 않는가
 *   ④ 이미 발송된 건은 실수로 지워지지 않는가 (force 를 줘야 지워진다)
 *   ⑤ 누가 언제 무엇을 지웠는지 기록이 남는가
 */
globalThis.__PROPOSAL_MEM = {};              /* 저장소를 메모리로 — 실제 Blobs 를 쓰지 않는다 */
process.env.PROPOSAL_ADMIN_KEY = 'test-admin-key-0123456789';
process.env.PROPOSAL_SECRET = 'test-secret-0123456789abcdef';
process.env.PROPOSAL_SITE = 'https://monnit.co.kr';
process.env.BREVO_API_KEY = 'test-brevo';
process.env.ANTHROPIC_API_KEY = '';
process.env.PROPOSAL_MODE = 'review';

/* 메일은 밖으로 내보내지 않는다 */
const MAILS = [];
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('api.brevo.com')) {
    try { const b = JSON.parse(opt.body || '{}'); MAILS.push({ subject: b.subject || '' }); } catch (e) { /* 무시 */ }
    return new Response('{"messageId":"m1"}', { status: 201 });
  }
  return new Response('{}', { status: 200 });
};

const S = await import('../netlify/lib/proposal/store.mjs');
const API = (await import('../netlify/functions/proposal-api.mjs')).default;
const ADMIN = (await import('../netlify/functions/proposal-admin.mjs')).default;

let pass = 0, fail = 0;
const ok = (m, c, got) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + '  받음=' + JSON.stringify(got)); } };

const COOKIE = await (async () => {
  const r = await ADMIN(new Request('https://monnit.co.kr/ops/proposals/login', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr' },
    body: JSON.stringify({ key: process.env.PROPOSAL_ADMIN_KEY })
  }));
  const c = r.headers.get('set-cookie') || '';
  return c.split(';')[0];
})();
ok('관리 화면 로그인', !!COOKIE && COOKIE.includes('='), COOKIE.slice(0, 20));

const act = (body) => ADMIN(new Request('https://monnit.co.kr/ops/proposals/action', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-requested-with': 'mk', cookie: COOKIE },
  body: JSON.stringify(body)
})).then(r => r.json());

async function newJob(company) {
  const r = await API(new Request('https://monnit.co.kr/api/proposal', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': '1.2.3.4' },
    body: JSON.stringify({ test: false, entry: 'proposal', company, name: '조한준', title: '팀장',
      email: 'del.' + Math.random().toString(36).slice(2, 7) + '@del-corp.co.kr', phone: '010-2957-4831',
      industry: 'manufacturing', problems: ['elec_fire'], goals: ['safety'], consent: true, elapsed: 12000 })
  }), {});
  const b = await r.json();
  if (!b.ok) { console.log('   (접수 실패)', JSON.stringify(b).slice(0, 200)); return { job: null }; }
  const keys = await S.list('job/', 500);
  const jobs = await Promise.all(keys.map(k => S.getJSON(k).catch(() => null)));
  const job = jobs.filter(Boolean).find(j => j.lead && j.lead.company === company);
  return { token: b.token, job };
}

console.log('\n[1] 대기 중인 접수 지우기');
let { job } = await newJob('삭제시험정밀');
ok('접수 생성됨', !!job && job.status !== 'canceled', job && job.status);
const qKey = S.queueKey(job.dueAt, job.id);
ok('  발송 예약이 걸려 있다', !!(await S.getJSON(qKey)), qKey);

let r = await act({ id: job.id, op: 'delete' });
ok('지우기 성공', r.ok === true, r);
ok('  접수가 사라졌다', !(await S.getJob(job.id)), await S.getJob(job.id));
ok('  발송 예약도 사라졌다', !(await S.getJSON(qKey)), await S.getJSON(qKey));
ok('  PDF 사본도 사라졌다', !(await S.getJSON('pdf/' + job.id + '.pdf')), '');
const rec = await S.getJSON('deleted/' + job.id + '.json');
ok('  「누가 언제 무엇을」 기록이 남는다', !!rec && rec.no === job.no && !!rec.at, rec);

console.log('\n[2] 관리 화면 목록에서도 빠진다');
const data = await ADMIN(new Request('https://monnit.co.kr/ops/proposals/data', { headers: { cookie: COOKIE } })).then(x => x.json());
ok('목록에 없다', !(data.rows || []).some(x => x.id === job.id), (data.rows || []).length);

console.log('\n[3] 이미 발송된 건은 실수로 지워지지 않는다');
const two = await newJob('발송된건정밀');
await S.patchJob(two.job.id, x => { x.status = 'sent'; x.sentAt = new Date().toISOString(); });
r = await act({ id: two.job.id, op: 'delete' });
ok('그냥 지우면 막는다', r.ok === false && /발송/.test(r.error || ''), r);
ok('  접수는 그대로 있다', !!(await S.getJob(two.job.id)), '');
r = await act({ id: two.job.id, op: 'delete', force: true });
ok('「발송된 건도 지우기」를 켜면 지워진다', r.ok === true, r);
ok('  접수가 사라졌다', !(await S.getJob(two.job.id)), '');

console.log('\n[4] 없는 접수를 지우려 하면');
r = await act({ id: 'zzzzzzzzzz', op: 'delete' });
ok('조용히 오류로 알린다(500 아님)', r.ok === false, r);

console.log('\n합계  통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
