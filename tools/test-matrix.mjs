/* 맞춤 제안서 · 선택 조합 전수 테스트 (2026-09-17)
   「고객이 무엇을 고르든 PDF 가 제대로 만들어지고, 정해 둔 대로 메일이 자동으로 나가는가」
   실행: node tools/test-matrix.mjs            (전체 — 수 분)
         node tools/test-matrix.mjs --quick    (입구별 대표 조합만)
   필요: poppler-utils (pdfinfo · pdffonts · pdftotext)
   저장소·메일·AI 는 가짜로 바꾸고, PDF 생성·매칭·발송 판단은 실제 코드를 그대로 돈다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

globalThis.__PROPOSAL_MEM = {};
process.env.BREVO_API_KEY = 'test-brevo';
process.env.ANTHROPIC_API_KEY = 'test-ai';
process.env.PROPOSAL_SECRET = 'matrix-secret';
process.env.PROPOSAL_SITE = 'https://monnit.co.kr';
process.env.PROPOSAL_MODE = 'instant';
process.env.PROPOSAL_INSTANT_SECONDS = '5';
process.env.PROPOSAL_RATE_IP_HOUR = '100000';
process.env.PROPOSAL_RATE_DAY = '100000';
const QUICK = process.argv.includes('--quick');

/* ── 가짜 외부 서비스 ── */
const MAILS = [];
let AI_MODE = 'good';     /* good | bad | broken | down */
const AI_OUT = {
  good: {
    summary: '가장 고민하신 과제를 먼저 잡는 구성을 제안합니다. 무선 센서로 배선 공사 없이 시작해 한 달간 데이터를 보고 넓힙니다.',
    understanding: '귀사 현장의 운영 조건을 기준으로 정리했습니다.',
    diagnosis: [{ id: 'x', text: '이상 징후가 생기는 지점을 먼저 정하고, 무선 센서로 상시 기록합니다.' }],
    steps: [{ title: '1단계 · 현장 확인', text: '엔지니어가 배치를 보고 우선 감시 지점을 고릅니다.' },
            { title: '2단계 · 작게 시작', text: '핵심 지점에 센서를 붙여 한 달간 데이터를 봅니다.' },
            { title: '3단계 · 넓히기', text: '결과를 보고 다른 구역으로 넓힙니다.' }],
    caseNotes: [], next: ['설비 배치도를 보내 주세요.', '현장 진단 일정을 잡아 주세요.']
  },
  /* 형식은 멀쩡한데 근거 없는 % 수치가 들어간 문안 — 규칙 점검에 걸려 템플릿으로 바뀌어야 한다 */
  badnum: {
    summary: '가장 고민하신 과제를 먼저 잡습니다. 유사 현장에서는 점검 인력이 47% 줄었습니다.',
    diagnosis: [{ id: 'x', text: '이상 징후가 생기는 지점을 먼저 정합니다.' }],
    steps: [{ title: '1단계 · 현장 확인', text: '배치를 봅니다.' }, { title: '2단계 · 작게 시작', text: '한 달간 봅니다.' }, { title: '3단계 · 넓히기', text: '넓힙니다.' }],
    caseNotes: [], next: ['설비 배치도를 보내 주세요.']
  },
  /* 문장 단위 정리를 통과하는 금지 표기(900MHz) — 규칙 점검에서 걸려 템플릿으로 바뀌어야 한다 */
  badword: {
    summary: '가장 고민하신 과제를 먼저 잡습니다. 무선 센서는 900MHz 대역으로 벽을 넘어 통신합니다. 청와대 현장과 같은 방식입니다.',
    diagnosis: [{ id: 'x', text: '이상 징후가 생기는 지점을 먼저 정합니다.' }],
    steps: [{ title: '1단계 · 현장 확인', text: '배치를 봅니다.' }, { title: '2단계 · 작게 시작', text: '한 달간 봅니다.' }, { title: '3단계 · 넓히기', text: '넓힙니다.' }],
    caseNotes: [], next: ['설비 배치도를 보내 주세요.']
  },
  /* 사람이 쓰면 안 되는 표현을 일부러 섞은 문안 — 자동 발송되면 안 된다 */
  bad: {
    summary: '이 구성은 효과를 보장합니다. 비용은 300만 원입니다. 고장을 99% 줄이고 900MHz 로 청와대에도 설치되었습니다.',
    diagnosis: [{ id: 'x', text: '무조건 해결됩니다.' }],
    steps: [{ title: '1단계', text: '바로 설치' }], caseNotes: [], next: ['연락 주세요']
  }
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('api.brevo.com')) {
    const b = JSON.parse(opt.body);
    MAILS.push({ to: b.to.map(t => t.email).join(','), subject: b.subject, html: b.htmlContent || '', text: b.textContent || '',
      attach: b.attachment ? b.attachment[0] : null, tags: b.tags || [] });
    return new Response(JSON.stringify({ messageId: 'm' + MAILS.length }), { status: 201 });
  }
  if (url.includes('api.anthropic.com')) {
    if (AI_MODE === 'down') return new Response('{"error":{"message":"overloaded"}}', { status: 529 });
    if (AI_MODE === 'broken') return new Response(JSON.stringify({ content: [{ type: 'text', text: '죄송합니다. {잘못된' }] }), { status: 200 });
    const out = AI_OUT[AI_MODE];
    return new Response(JSON.stringify({ model: 'claude-test', content: [{ type: 'text', text: '```json\n' + JSON.stringify(out) + '\n```' }], usage: {} }), { status: 200 });
  }
  if (url.includes('proposal-build-background')) return new Response(null, { status: 202 });   /* 생성은 아래에서 직접 부른다 */
  if (/staticforms|web3forms|api\.monday\.com|hooks\./.test(url)) return new Response('{"success":true,"data":{}}', { status: 200 });
  return realFetch(url, opt);
};

const API = (await import('../netlify/functions/proposal-api.mjs')).default;
const S = await import('../netlify/lib/proposal/store.mjs');
const J = await import('../netlify/lib/proposal/jobs.mjs');
const P = await import('../netlify/lib/proposal/pipeline.mjs');
const KB = await import('../netlify/lib/proposal/kb.mjs');
const { CONTACT_INDUSTRY } = await import('../netlify/lib/proposal/company.mjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-matrix-'));
const FORBID = [/청와대/, /900\s*MHz/i, /공공데이터\s*활용/, /dekist|데키스트/i, /undefined/, /\bNaN\b/, /\[object /, /\$\{/, /\{\{/, /보장합니다/, /무조건/];

let n = 0, fails = [], seq = 0;
const stat = { instant: 0, review: 0, ai: 0, template: 0, pages: {}, bytesMax: 0, bytesMin: Infinity };
const fail = (tag, why) => { fails.push(tag + ' — ' + why); };

/* 받침과 맞지 않는 조사 — 「발견를」「정지을」 */
function josaBad(text) {
  const re = /([가-힣])(을|를|과|와)\s(기준|직접|포함)/g;
  let m;
  while ((m = re.exec(text))) {
    const jong = (m[1].charCodeAt(0) - 0xac00) % 28 !== 0;
    const want = { 을: true, 를: false, 과: true, 와: false }[m[2]];
    if (jong !== want) return m[0];
  }
  return '';
}

function pdfCheck(tag, bytes, company) {
  const f = path.join(TMP, 'p' + (++seq) + '.pdf');
  fs.writeFileSync(f, bytes);
  try {
    const info = execFileSync('pdfinfo', [f], { encoding: 'utf8' });
    const pages = Number((info.match(/Pages:\s+(\d+)/) || [])[1] || 0);
    stat.pages[pages] = (stat.pages[pages] || 0) + 1;
    if (pages < 7 || pages > 12) fail(tag, `쪽수 ${pages}`);
    const fonts = execFileSync('pdffonts', [f], { encoding: 'utf8' }).split('\n').slice(2).filter(Boolean);
    if (!fonts.length) fail(tag, '글꼴 없음');
    if (fonts.some(l => /\bno\s+\S+\s+\S+\s*$/.test(l.replace(/\s+\d+\s+\d+\s*$/, '')) && !/Type 3/.test(l))) {
      const bad = fonts.filter(l => / no /.test(l.slice(60, 75)));
      if (bad.length) fail(tag, '글꼴 미포함: ' + bad[0].slice(0, 40));
    }
    const text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
    const flat = text.replace(/\s+/g, '');
    /* PDF 글꼴에 없는 그림 문자(이모지)는 빠지므로 한글·영문·숫자만 비교 */
    const want = company.normalize('NFKC').replace(/[^\p{Script=Hangul}A-Za-z0-9]/gu, '').slice(0, 6);
    if (!flat.normalize('NFKC').replace(/[^\p{Script=Hangul}A-Za-z0-9]/gu, '').includes(want)) fail(tag, 'PDF 에 회사명 없음');
    for (const re of FORBID) if (re.test(text)) fail(tag, 'PDF 금지 표현 ' + re);
    if (/�/.test(text)) fail(tag, 'PDF 깨진 글자(�)');
    if (/□/.test(text)) fail(tag, 'PDF 에 글꼴 없는 글자(□): ' + (text.match(/.{0,8}□.{0,8}/) || [''])[0]);
    const jb = josaBad(text);
    if (jb) fail(tag, 'PDF 조사 오류: ' + jb);
    if (!/940\s*MHz/i.test(text) && /MHz/i.test(text)) fail(tag, 'PDF 주파수 표기 확인');
    stat.bytesMax = Math.max(stat.bytesMax, bytes.length); stat.bytesMin = Math.min(stat.bytesMin, bytes.length);
    return { pages, text };
  } finally { fs.unlinkSync(f); }
}

function mailCheck(tag, mails, job) {
  const cust = mails.filter(m => m.to === job.lead.email);
  const prop = cust.filter(m => m.tags.includes('proposal'));
  if (prop.length !== 1) fail(tag, `고객 제안서 메일 ${prop.length}통`);
  /* 즉시 방식은 제안서 메일 1통, 엔지니어 확인 방식은 접수 안내 + 제안서 2통 */
  const expect = job.plan.mode === 'instant' ? 1 : 2;
  if (cust.length !== expect) fail(tag, `고객 메일 합계 ${cust.length}통, 기대 ${expect}통 (${cust.map(m => m.subject).join(' / ')})`);
  if (expect === 2 && !cust.some(x => /준비하고 있습니다/.test(x.subject))) fail(tag, '엔지니어 확인 건인데 접수 안내 메일 없음');
  const m = prop[0];
  if (!m) return;
  if (!m.subject.includes(job.lead.company)) fail(tag, '메일 제목에 회사명 없음');
  if (!m.attach || !/\.pdf$/.test(m.attach.name) || Buffer.from(m.attach.content, 'base64').subarray(0, 4).toString() !== '%PDF') fail(tag, 'PDF 첨부 없음');
  const link = (m.html.match(/https:\/\/monnit\.co\.kr\/api\/proposal\/pdf\?id=[a-f0-9]{16}&amp;e=\d+&amp;s=[a-f0-9]{32}/) || [])[0];
  if (!link) fail(tag, 'PDF 링크 없음');
  else {
    const u = new URL(link.replace(/&amp;/g, '&'));
    if (!J.verifyPdf(u.searchParams.get('id'), u.searchParams.get('e'), u.searchParams.get('s'))) fail(tag, 'PDF 링크 서명 불일치');
  }
  if (!/\/visit\?/.test(m.html)) fail(tag, '현장 진단 예약 링크 없음');
  for (const re of FORBID) if (re.test(m.html + m.subject + m.text)) fail(tag, '메일 금지 표현 ' + re);
  const mj = josaBad(m.html.replace(/<[^>]+>/g, ' '));
  if (mj) fail(tag, '메일 조사 오류: ' + mj);
  const staff = mails.filter(x => x.to !== job.lead.email);
  if (!staff.some(x => /\[맞춤 제안서\]|접수|신청/.test(x.subject))) fail(tag, '담당자 접수 알림 없음');
  if (!staff.some(x => /발송/.test(x.subject))) fail(tag, '담당자 발송 알림 없음');
}

/** 한 건: 접수 → 생성 → (즉시면) 발송 판단 → 발송 → 확인 */
async function one(tag, body, { expectSend = true } = {}) {
  n++;
  const from = MAILS.length;
  const company = body.company || '매트릭스' + n + '정밀';
  const email = `m${n}.kim@matrix${n}-corp.co.kr`;
  const r = await API(new Request('https://monnit.co.kr/api/proposal', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://monnit.co.kr', 'x-nf-client-connection-ip': '10.0.' + (n >> 8) + '.' + (n & 255) },
    body: JSON.stringify({ name: '김매트', title: '팀장', phone: '010-2957-' + String(4000 + n).slice(-4), consent: true, elapsed: 20000, ...body, company, email }) }), {});
  const b = await r.json();
  if (r.status !== 200 || !b.token) { fail(tag, `접수 실패 ${r.status} ${JSON.stringify(b).slice(0, 160)}`); return null; }
  const id = (await S.getJSON(J.tokenKey(b.token))).id;

  /* 백그라운드 함수와 같은 경로: 생성 → 즉시 방식이면 규칙 점검 → 발송 */
  /* 화면 단계 대기(2~3분)를 건너뛴다 — 대기열 키도 함께 옮긴다 */
  { const j0 = await S.getJob(id); await P.moveDue(j0, Date.now() - 1); await S.saveJob(j0); }
  const br = await P.buildJob(id, { ai: true, autoSend: true });
  if (!br.ok) { fail(tag, '생성 실패 ' + (br.error || '')); return null; }
  let job = await S.getJob(id);
  job.plan.mode === 'instant' ? stat.instant++ : stat.review++;
  job.draft.ai ? stat.ai++ : stat.template++;

  /* 엔지니어 확인으로 넘어간 건 — 담당자가 아무것도 안 해도 예정 시각에 정기 점검이 보낸다 */
  if (job.status !== 'sent') {
    const due = job.dueAt;
    await P.tick({ now: due + 60000, origin: 'https://monnit.co.kr' });
    job = await S.getJob(id);
  }
  if (expectSend && job.status !== 'sent') { fail(tag, `발송 안 됨 (${job.status}, ${job.plan.mode}, ${(job.plan.reasons || []).join('/')}) ${job.lastError || ''}`); return job; }

  const bytes = await S.getBytes(job.draft.pdfKey);
  pdfCheck(tag, bytes, job.lead.company);
  mailCheck(tag, MAILS.slice(from), job);
  if (/^ai-(badnum|badword|bad)\//.test(tag) && job.draft.ai && /47%|보장|300만|900\s*MHz|청와대/.test(job.draft.summary || '')) fail(tag, '문제 있는 AI 문안이 그대로 발송됨');
  if (/^ai-(badnum|badword)\//.test(tag) && job.plan.mode !== 'instant') fail(tag, '템플릿 교체 대신 엔지니어 확인으로 넘어감(발송 지연)');
  const hard = (job.draft.checks || []).filter(c => !c.ok && !c.warn);
  if (hard.length) fail(tag, '규칙 점검 실패 문안이 발송됨: ' + hard.map(c => c.label + '(' + c.note + ')').join(', '));
  return job;
}

const t0 = Date.now();
const pickN = (arr, k) => QUICK ? arr.filter((_, i) => i % Math.ceil(arr.length / k) === 0) : arr;

/* 1) 신청 화면 — 산업 × 그 산업의 과제 전부 */
console.log('\n[1] /proposal — 산업 × 과제');
for (const ind of KB.INDUSTRIES) {
  for (const p of pickN(ind.problems.filter(k => KB.PROBLEMS[k]), 2)) {
    await one(`proposal/${ind.key}/${p}`, { entry: 'proposal', industry: ind.key, problems: [p], goals: [] });
  }
  process.stdout.write('.');
}

/* 2) 홈 솔루션 파인더 — 시설 × 고민 × 규모 */
console.log('\n[2] finder — 시설 × 고민');
const FAC = Object.keys(KB.FINDER_FAC).concat(['etc']);
const CON = Object.keys(KB.FINDER_CON);
const SCALE = Object.keys(KB.FINDER_SCALE);
for (const fac of pickN(FAC, 4)) {
  for (const con of pickN(CON, 3)) {
    await one(`finder/${fac}/${con}`, { entry: 'finder', auto: true, fac, con, scale: SCALE[(fac.length + con.length) % SCALE.length] });
  }
  process.stdout.write('.');
}

/* 3) 백서 폼 애드온 — 시설 선택 안 함(회사명으로 판단) · 고민 안 고름 포함 */
console.log('\n[3] whitepaper — 시설 × 고민(선택 안 함 포함)');
const DOCS = ['무선센서 Modbus 연동 백서', '무선 IoT 설비 예지보전 제안 가이드', '의약품 보관 온도 모니터링 제안서', '데이터센터 · IDC 모니터링'];
for (const fac of pickN([''].concat(FAC), 4)) {
  for (const con of pickN([''].concat(CON), 3)) {
    const doc = DOCS[(fac.length + con.length) % DOCS.length];
    await one(`whitepaper/${fac || '자동'}/${con || '없음'}`, { entry: 'whitepaper', auto: true, fac, con, doc, industryText: doc, memo: '[자료] ' + doc, facility: fac ? '' : '' });
  }
  process.stdout.write('.');
}

/* 4) 상담 폼 — 산업군 × 관심 주제(0~3개) × 문의 글 */
console.log('\n[4] contact — 산업군 × 관심 주제');
const MEMOS = ['', '야간에 냉동창고 온도가 올라가 제품 폐기가 있었습니다.', '분전반 과열이 걱정입니다. 견적 부탁드립니다.', '견적 문의'];
for (const it of pickN(Object.keys(CONTACT_INDUSTRY), 4)) {
  for (const [i, concerns] of pickN([[], [CON[0]], [CON[1], CON[2]], [CON[3], CON[4], CON[5]]], 2).entries()) {
    await one(`contact/${it}/${concerns.join('+') || '없음'}`, { entry: 'contact', auto: true, industryText: it, concerns, memo: MEMOS[i % MEMOS.length], inquiry: '견적' });
  }
  process.stdout.write('.');
}

/* 5) 회사명만으로 판단 · 알려진 고객사 이름 · 영문/숫자 회사명 */
console.log('\n[5] 회사 인식');
for (const company of ['㈜한빛정밀', 'ＡＢＣ　물류', '①공장 설비팀', '삼성바이오로직스', '쿠팡 풀필먼트', 'KT 클라우드', '(주)한빛 제약', 'ABC Logistics Co., Ltd.', '가나다라마바사아자차카타파하 주식회사 제2공장', '㈜ 대한', '평택2공장']) {
  await one(`company/${company}`, { entry: 'whitepaper', auto: true, company });
}

/* 6) AI 문안 상태별 — 좋음 · 금지 표현 · 깨진 응답 · 서버 장애 */
console.log('\n[6] AI 문안 상태');
for (const mode of ['good', 'badnum', 'badword', 'bad', 'broken', 'down']) {
  AI_MODE = mode;
  for (const ind of pickN(KB.INDUSTRIES, 3)) await one(`ai-${mode}/${ind.key}`, { entry: 'proposal', industry: ind.key, problems: [ind.problems[0]] });
}
AI_MODE = 'good';

/* 7) 긴 입력 · 특수문자 */
console.log('\n[7] 긴 입력·특수문자');
await one('long/facility', { entry: 'proposal', industry: 'manufacturing', problems: ['downtime'], facility: '가'.repeat(60), memo: '메모 '.repeat(200), company: '아주긴회사이름을가진주식회사테스트용'.repeat(3) });
await one('special/chars', { entry: 'proposal', industry: 'datacenter', problems: ['hotspot'], company: 'R&D "센터" <IDC> & Co.', facility: '3층 #2 / A-동 (본관)' });
await one('emoji', { entry: 'proposal', industry: 'food_agri', problems: [KB.industryByKey('food_agri').problems[0]], company: '스마트팜🍓농장', facility: '딸기 하우스 🌱' });

console.log(`\n\n${n}건 · ${Math.round((Date.now() - t0) / 1000)}초`);
console.log(`발송 방식: 즉시 ${stat.instant} · 엔지니어 확인 후 자동 ${stat.review}`);
console.log(`문안: AI ${stat.ai} · 템플릿 ${stat.template}`);
console.log(`PDF 쪽수 분포: ${JSON.stringify(stat.pages)} · 크기 ${Math.round(stat.bytesMin / 1024)}~${Math.round(stat.bytesMax / 1024)}KB`);
fs.rmSync(TMP, { recursive: true, force: true });
if (fails.length) {
  const uniq = [...new Set(fails)];
  console.log(`\n❌ 실패 ${uniq.length}건`);
  uniq.slice(0, 60).forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('\n✅ 모든 조합에서 PDF 생성·자동 발송·메일 내용 정상');
