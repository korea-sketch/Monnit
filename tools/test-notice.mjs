/* 담당자 알림 — 「결정적 행위만 메일, 나머지는 알림함」 (2026-09-30)
   2026-09-29 사세 남우현 건을 그대로 재현한다: 제안 가이드 랜딩에서 자료 신청 + 맞춤 제안서.
   예전 5통 → 이제 담당자 메일 2통(신규 접수 · 제안서 열람), 나머지는 /ops/notices 알림함.
   실행: node tools/test-notice.mjs   (저장소 루트에서, 저장소·메일은 가짜) */
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
  STATICFORMS_KEY: 'sf-test', WEB3FORMS_KEY: 'w3-test', OPS_USER: 'ops', OPS_PASS: 'pw-test', URL: 'https://monnit.co.kr'
});

const STAFF = 'korea@monnit.com';
const MAILS = [];            /* { to, subject, html, text, via } */
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('api.brevo.com')) {
    const b = JSON.parse(opt.body);
    MAILS.push({ via: 'brevo', to: b.to.map(t => t.email).join(','), subject: b.subject, html: b.htmlContent || '', text: b.textContent || '' });
    return new Response(JSON.stringify({ messageId: 'm' + MAILS.length }), { status: 201 });
  }
  if (/staticforms|web3forms/.test(url)) {
    const b = JSON.parse(opt.body);
    MAILS.push({ via: 'form', to: STAFF, subject: b.subject, html: '', text: JSON.stringify(b) });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  if (url.includes('proposal-build-background')) {
    const B = await import('../netlify/functions/proposal-build-background.mjs');
    await B.default(new Request(url, { method: 'POST', headers: opt.headers, body: opt.body }));
    return new Response(null, { status: 202 });
  }
  if (/monday\.com|anthropic|googleapis/.test(url)) return new Response('{}', { status: 500 });
  return realFetch(url, opt);
};

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };
const staffMails = () => MAILS.filter(m => m.to.split(',').includes(STAFF));

const LEAD = (await import('../netlify/functions/lead.mjs')).default;
const API = (await import('../netlify/functions/proposal-api.mjs')).default;
const S = await import('../netlify/lib/proposal/store.mjs');
const J = await import('../netlify/lib/proposal/jobs.mjs');
const NOTE = await import('../netlify/functions/_staffnote.mjs');
const ADMIN = (await import('../netlify/functions/noticeadmin.mjs')).default;
const AUTH = await import('../netlify/functions/_ops_auth.mjs');

const SRC = 'utm_source=meta · utm_medium=paid_social · utm_campaign=proposal_promo · utm_content=proposal_ad_03 · utm_term=백서 크리에이티브 OFF · fbclid=IwZXh0bgNhZW0BMABwZG9mBWFkaWQBqzfOv3ucmHNydGMGYXBwX2lkDDM1MDY4NTUzMTcyOAABHsogUR4cwlxl1AQLwjhNkiAIEN3sWqMiwFB68x_r96tdKjkeRU292qtV-JS8_aem_2H0CJirsKOsPVgN9aUf2JQ';
const LANDING = 'https://monnit.co.kr/promo/proposal/?utm_source=meta&utm_medium=paid_social&utm_campaign=proposal_promo&utm_content=proposal_ad_03&fbclid=IwZXh0bgNhZW0BMABwZG9mBWFkaWQBqzfOv3ucmHNydGMGYXBwX2lkDDM1MDY4NTUzMTcyOAABHsogUR4cwlxl1AQLwjhNkiAIEN3sWqMiwFB68x_r96tdKjkeRU292qtV';
const hdr = { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': '118.46.243.185', 'user-agent': 'Mozilla/5.0 (iPhone)' };

/* ① 랜딩 — 자료 신청(doc_request)이 서버로 먼저 간다 (notified 없음) */
await LEAD(new Request('https://monnit.co.kr/api/lead', { method: 'POST', headers: hdr, body: JSON.stringify({
  lead_type: 'doc_request', page: '/promo/proposal', ts: new Date().toISOString(), test: false,
  payload: { '회사명': '사세', '담당자명': '남우현', '연락처': '010-2222-3333', '이메일': 'nam@sase.co.kr', '주요 회전설비': '10 ~ 30대',
    '관심분야': '예지보전 제안 가이드', '문의 사항': '[B·62점] · 설비 규모: 10 ~ 30대 · 체류 159초', '접수 경로': '제안 가이드 랜딩(/promo/proposal)',
    '접수 유형': '자료', '접점': 'promo_proposal', '출처': SRC, '유입 페이지': LANDING, '_subject': '[모넷·자료] 사세 예지보전 제안 가이드 신청' } }) }));
ok('자료 신청 — 담당자 메일 0통', staffMails().length === 0, staffMails().map(m => m.subject));

/* ② 같은 폼에서 「맞춤 제안서도 받기」 → /api/proposal (entry: whitepaper) */
let r = await API(new Request('https://monnit.co.kr/api/proposal', { method: 'POST', headers: hdr, body: JSON.stringify({
  test: false, entry: 'whitepaper', auto: true, company: '사세', name: '남우현', email: 'nam@sase.co.kr', phone: '010-2222-3333',
  fac: 'factory', con: 'equip', facility: '', industryText: '예지보전 제안 가이드', memo: '[자료] 예지보전 제안 가이드 · 설비 규모: 10 ~ 30대',
  doc: '예지보전 제안 가이드', consent: true, consentMkt: false, elapsed: 60000, source: SRC, landing: LANDING, referrer: '' }) }), {});
const b = await r.json();
ok('제안서 접수', b.ok && b.token, b);
const newMail = staffMails().find(m => /신규 접수/.test(m.subject));
ok('신규 접수 — 요약 메일 1통', staffMails().length === 1 && !!newMail, staffMails().map(m => m.subject));
ok('신규 접수 — 함께 받은 자료 한 줄', newMail && /함께 받은 자료/.test(newMail.html) && /예지보전 제안 가이드/.test(newMail.html));
ok('신규 접수 — 긴 주소·fbclid 원문 없음, 링크로', newMail && !/fbclid/.test(newMail.text) && !/IwZXh0bg/.test(newMail.html.replace(/href="[^"]*"/g, '')) && /유입 페이지 \(monnit\.co\.kr\/promo\/proposal\)/.test(newMail.html), newMail && newMail.text);
ok('신규 접수 — 유입은 채널·캠페인 이름으로', newMail && /메타 · proposal_promo \/ proposal_ad_03/.test(newMail.text), newMail && newMail.text);
ok('신규 접수 — 알림함 링크', newMail && /\/ops\/notices/.test(newMail.html));

/* ③ 즉시 발송(백그라운드 생성 → 예정 시각에 발송) — 담당자 메일 없음 */
let job = null;
for (let i = 0; i < 40; i++) { const m = await S.getJSON(J.tokenKey(b.token)); job = m && await S.getJob(m.id); if (job && job.status === 'sent') break; await new Promise(res => setTimeout(res, 500)); }
ok('제안서 자동 발송됨', job && job.status === 'sent', job && job.status);
ok('발송 완료 — 담당자 메일 없음', staffMails().length === 1, staffMails().map(m => m.subject));

/* ④ 진행 화면 재방문(hot) — 메일 없음 */
await S.patchJob(job.id, j => { j.lastViewAt = new Date(Date.now() - 3600000).toISOString(); });
await API(new Request('https://monnit.co.kr/api/proposal/status?t=' + b.token), {});
ok('재방문 — 담당자 메일 없음', staffMails().length === 1, staffMails().map(m => m.subject));

/* ⑤ 고객이 제안서를 처음 연다 — 결정적 행위 → 메일 */
job = await S.getJob(job.id);
const pu = new URL(J.pdfUrl(job));
await API(new Request('https://monnit.co.kr/api/proposal/pdf' + pu.search, { headers: { 'user-agent': 'Mozilla/5.0' } }), {});
const opened = MAILS.find(m => /제안서 열람·연락 적기/.test(m.subject));
ok('제안서 열람 — 1015@monnit.com 으로만 1통', opened && opened.to === '1015@monnit.com' && MAILS.filter(m => /제안서 열람/.test(m.subject)).length === 1, MAILS.map(m => m.to + ' ' + m.subject));
ok('제안서 열람 — 기존 담당자 주소로는 안 감', staffMails().length === 1, staffMails().map(m => m.subject));
ok('브라우저 폼 메일(StaticForms·Web3Forms) 0통 — 무료 한도 미사용', !MAILS.some(m => m.via === 'form'), MAILS.filter(m => m.via === 'form').map(m => m.subject));

/* ⑥ 알림함 — 메일 보낸 것과 안 보낸 것이 모두 남는다 */
const { rows } = await NOTE.read({ months: 1 });
const kinds = rows.map(x => x.kind + (x.mailed ? '(메일)' : '(알림함)'));
ok('알림함 — 자료 신청(알림함)', kinds.includes('doc_request(알림함)'), kinds);
ok('알림함 — 신규 접수(메일)', kinds.includes('new(메일)'), kinds);
ok('알림함 — 발송 완료(알림함)', kinds.includes('sent(알림함)'), kinds);
ok('알림함 — 재방문(알림함)', kinds.includes('hot(알림함)'), kinds);
ok('알림함 — 열람(메일)', kinds.includes('opened(메일)'), kinds);
const docRow = rows.find(x => x.kind === 'doc_request');
ok('알림함 — 유입 원문 보존', docRow && /fbclid/.test(docRow.summary['출처(원문)'] || '') && docRow.landing === LANDING, docRow);

/* ⑦ 상담 문의(contact)는 예전처럼 한 통 — 긴 값은 줄여서 */
MAILS.length = 0;
await LEAD(new Request('https://monnit.co.kr/api/lead', { method: 'POST', headers: hdr, body: JSON.stringify({
  lead_type: 'contact', page: '/contact', ts: new Date().toISOString(), test: false,
  payload: { '회사명': '한빛기계', '담당자명': '이하나', '연락처': '010-4444-5555', '이메일': 'hana@hanbit.co.kr', '문의 사항': '진동센서 견적',
    '접점': 'contact', '출처': SRC, '유입 페이지': LANDING } }) }));
const cm = staffMails();
ok('상담 문의 — 메일 1통', cm.length === 1, cm.map(m => m.subject));
ok('상담 문의 — fbclid·긴 주소 없음', cm[0] && !/fbclid|IwZXh0bg/.test(cm[0].text) && /monnit\.co\.kr\/promo\/proposal/.test(cm[0].text), cm[0] && cm[0].text);

/* ⑧ 관제 화면 /ops/notices */
const cookie = 'mk_ops=' + encodeURIComponent(AUTH.issue());
r = await ADMIN(new Request('https://monnit.co.kr/ops/notices', { headers: { cookie } }));
const html = await r.text();
ok('관제 — 알림함 화면', r.status === 200 && /알림함/.test(html) && /class="opsnav"/.test(html), r.status);
r = await ADMIN(new Request('https://monnit.co.kr/ops/notices/data?m=1', { headers: { cookie } }));
const d = await r.json();
ok('관제 — 알림함 데이터', r.status === 200 && d.rows.length >= 6 && d.mailKinds.includes('opened'), { n: d.rows && d.rows.length });
r = await ADMIN(new Request('https://monnit.co.kr/ops/notices/data'));
ok('관제 — 로그인 없으면 401', r.status === 401, r.status);

if (process.env.DUMP) { const fs = await import('node:fs'); fs.writeFileSync(process.env.DUMP + '/new.html', newMail.html); fs.writeFileSync(process.env.DUMP + '/opened.html', staffMails.length ? '' : ''); }
console.log(fail ? `\n실패 ${fail}건` : '\n✅ 전부 통과 — 5통 → 2통, 나머지는 알림함');
process.exit(fail ? 1 : 0);
