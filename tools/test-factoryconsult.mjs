/* 맞춤 제안서 + 「공장 설비 진단 EVENT」 — 담당자 메일 1통 · 리드 원장 기록 (2026-10-02)
   예전: [맞춤제안·신규 접수] + [무료체험 신청·맞춤형 제안서] 두 통이 korea@monnit.com 으로 갔다.
   지금: 신규 접수 메일 한 통(제목 ·공장진단EVENT, 본문 「공장 진단 EVENT: 신청함」)
         + 리드 원장(leads)에 /promo/consulting 신청과 같은 모양으로 한 줄 + 알림함 「중복 알림 보류」
   실행: node tools/test-factoryconsult.mjs   (저장소 루트에서, 저장소·메일은 가짜) */
globalThis.__PROPOSAL_MEM = {};
const MEM = new Map();
globalThis.__MNK_FAKE_BLOBS = {
  async get(s, k) { return MEM.has(s + '/' + k) ? MEM.get(s + '/' + k) : null; },
  async set(s, k, t) { MEM.set(s + '/' + k, String(t)); return true; },
  async del(s, k) { MEM.delete(s + '/' + k); return true; },
  async list(s, p) { return [...MEM.keys()].filter(k => k.startsWith(s + '/' + p)).map(k => k.slice(s.length + 1)); }
};
Object.assign(process.env, {
  BREVO_API_KEY: 'test-brevo', ANTHROPIC_API_KEY: '', GEMINI_API_KEY: '', PROPOSAL_SECRET: 'test-secret',
  PROPOSAL_SITE: 'https://monnit.co.kr', PROPOSAL_MODE: 'instant', PROPOSAL_INSTANT_SECONDS: '5',
  STATICFORMS_KEY: 'sf-test', WEB3FORMS_KEY: 'w3-test', URL: 'https://monnit.co.kr'
});

const STAFF = 'korea@monnit.com';
const MAILS = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('api.brevo.com')) {
    const b = JSON.parse(opt.body);
    MAILS.push({ to: b.to.map(t => t.email).join(','), subject: b.subject, html: b.htmlContent || '', text: b.textContent || '' });
    return new Response(JSON.stringify({ messageId: 'm' + MAILS.length }), { status: 201 });
  }
  if (/staticforms|web3forms/.test(url)) { MAILS.push({ to: STAFF, subject: JSON.parse(opt.body).subject || 'form', html: '', text: '' }); return new Response('{"success":true}', { status: 200 }); }
  if (url.includes('proposal-build-background')) return new Response(null, { status: 202 });
  if (/monday\.com|anthropic|googleapis/.test(url)) return new Response('{}', { status: 500 });
  return realFetch(url, opt);
};

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };
const staffMails = () => MAILS.filter(m => m.to.split(',').includes(STAFF));
const lines = prefix => [...MEM.entries()].filter(([k]) => k.startsWith(prefix)).flatMap(([, v]) => String(v).split('\n').filter(Boolean).map(l => JSON.parse(l)));

const API = (await import('../netlify/functions/proposal-api.mjs')).default;
const hdr = { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': '211.33.10.20', 'user-agent': 'Mozilla/5.0 (Macintosh)' };
const base = {
  test: false, company: '대한정밀(주)', name: '박지훈', title: '설비팀장', email: 'jh.park@daehan-pm.co.kr', phone: '010-4821-3390',
  industry: 'manufacturing', facility: '2공장 프레스 라인', region: '경기 화성시', scale: '', timeline: '3개월 이내',
  problems: ['downtime'], goals: ['downtime'], memo: '프레스 모터 베어링 이상 징후 확인 필요',
  consent: true, consentMkt: true, elapsed: 70000, caseViews: 1, source: 'utm_source=meta · utm_campaign=proposal_promo', landing: 'https://monnit.co.kr/proposal'
};

/* ① 공장 설비 진단 EVENT 함께 신청 */
let r = await API(new Request('https://monnit.co.kr/api/proposal', { method: 'POST', headers: hdr, body: JSON.stringify({ ...base, factoryConsult: true }) }), {});
let b = await r.json();
ok('제안서 접수', b.ok && b.token, b);
ok('담당자 메일은 1통', staffMails().length === 1, staffMails().map(m => m.subject));
const m = staffMails()[0] || {};
ok('제목에 ·공장진단EVENT 표시', /신규 접수.*공장진단EVENT/.test(m.subject || ''), m.subject);
ok('본문에 「공장 진단 EVENT: 신청함」', /공장 진단 EVENT/.test(m.html || '') && /신청함/.test(m.html || ''), '');
ok('예전 별도 메일([무료체험 신청·맞춤형 제안서]) 없음', !MAILS.some(x => /무료체험 신청/.test(x.subject)), MAILS.map(x => x.subject));
const leads = lines('leads/');
const consult = leads.find(l => l.point === 'promo_consulting');
ok('리드 원장에 컨설팅 접수 1줄', leads.filter(l => l.point === 'promo_consulting').length === 1, leads);
ok('원장 — 회사·담당자·연락처·관심분야', consult && consult.company === base.company && /박지훈/.test(consult.name) && consult.phone === base.phone
  && consult.email === base.email && /예지보전 1개월 무료 체험/.test(consult.interest), consult);
ok('원장 — 채널·유입·제안번호', consult && consult.channel === '메타' && consult.landing === base.landing && /^P?[\w-]+/.test(consult.proposal || ''), consult);
const notes = lines('ops/staffnote-');
const dup = notes.find(n => n.kind === 'dup' && /무료 체험/.test(n.subject || ''));
ok('알림함 — 중복 알림 보류(메일 안 보냄)로 1줄', dup && dup.mailed === false && dup.via === 'proposal', notes.map(n => [n.kind, n.subject, n.mailed]));

/* ② 선택 안 하면 원장 컨설팅 줄 없음 · 메일 1통 그대로 */
MAILS.length = 0;
r = await API(new Request('https://monnit.co.kr/api/proposal', { method: 'POST', headers: hdr, body: JSON.stringify({ ...base, email: 'sy.lee@hanil-steel.co.kr', company: '한일철강', name: '이수연', phone: '010-5512-7781', factoryConsult: false }) }), {});
b = await r.json();
ok('EVENT 미선택 — 접수', b.ok && b.token, b);
ok('EVENT 미선택 — 담당자 메일 1통 · 표시 없음', staffMails().length === 1 && !/공장진단/.test(staffMails()[0].subject), staffMails().map(x => x.subject));
ok('EVENT 미선택 — 원장 컨설팅 줄 추가 없음', lines('leads/').filter(l => l.point === 'promo_consulting').length === 1, '');

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
