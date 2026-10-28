/* 2026-10-28 — 「1015@ 무조건(예지보전 가이드 제외)」 · 「1개월 예지보전 EVENT 먼데이 자동 기입」 · 「리드 원장에 모든 리드」
 *  실행: node tools/test-monday-all.mjs   (네트워크 없음 — 먼데이·Brevo 를 흉내 낸다) */
const MEM = new Map();
globalThis.__MNK_FAKE_BLOBS = {
  async get(s, k) { return MEM.has(s + '/' + k) ? MEM.get(s + '/' + k) : null; },
  async set(s, k, t) { MEM.set(s + '/' + k, String(t)); return true; },
  async del(s, k) { MEM.delete(s + '/' + k); return true; },
  async list(s, p) { return [...MEM.keys()].filter(x => x.startsWith(s + '/' + p)).map(x => x.slice(s.length + 1)); }
};
process.env.MONDAY_TOKEN = 'tok';
process.env.BREVO_API_KEY = 'bk';
delete process.env.STAFF_MUST_TO; delete process.env.ROUTE_GENERAL_TO;

/* ── 가짜 먼데이 보드 (실제 보드 18429299666 의 라벨 그대로) ── */
const LABELS = {
  color_mm6ta6wq: ['응대', '수주', '실패', '견적', '접수'],
  color_mm6tdfp7: ['구글', '외부유입', '네이버', '메타', '기타', '직접'],
  color_mm6t7jqh: ['전화', '홈페이지 문의', '메일'],
  color_mm6t3gya: ['견적', '프로모션 신청', '자료요청', '기타', '협업'],
  dropdown_mm6tjqet: ['공장 설비 컨설팅', '예지보전 제안 가이드', '데이터센터 · IDC 모니터링', '콜드체인 · 물류 온도 관리', '리테일 · 매장 · 외식 온도 관리', '진동 · 구조안전 계측', 'UPS · ESS · 전력 설비 모니터링', '온도 · 누수 · 동파 · HVAC 통합', '무선 화재경보 · 소방 안전', '긴급 경보 알리미', '회전설비 AI 예지보전 체험', '기타', '센서 구매', '온도센서'],
  color_mm6vbg83: ['처음', '사용 중', '써봤음'],
  color_mm6vphpa: ['포장 · 물류 라인', '유틸리티(펌프·공조)', '조립 · 가공 라인', '원료 · 배합 공정', '발전 · 전력 설비', '기타 · 미정', '용수 · 폐수 처리'],
  color_mm6vjp7k: ['3영업일 이내', '연락 완료', '당일']
};
const ITEMS = [];   /* {id,name,cv} */
let failNext = 0, seq = 1000;
const MAILS = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const body = init.body ? JSON.parse(init.body) : {};
  const res = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('api.monday.com')) {
    const q = body.query, v = body.variables || {};
    if (/settings_str/.test(q)) return res({ data: { boards: [{ columns: Object.entries(LABELS).map(([id, l]) => ({ id, settings_str: JSON.stringify(id.startsWith('dropdown') ? { labels: l.map((name, i) => ({ id: i, name })) } : { labels: Object.fromEntries(l.map((x, i) => [i, x])) }) })) }] } });
    if (/groups\{ id title \}/.test(q)) return res({ data: { boards: [{ groups: [{ id: 'g10', title: '2026년 10월' }] }] } });
    if (/items_page\(limit:1\)/.test(q)) return res({ data: { boards: [{ groups: [{ items_page: { items: ITEMS.length ? [{ id: ITEMS[0].id }] : [] } }] }] } });
    if (/create_group/.test(q)) return res({ data: { create_group: { id: 'gx' } } });
    if (/create_item/.test(q)) {
      const cv = JSON.parse(v.v);
      if (failNext > 0) { failNext--; return res({ errors: [{ message: 'label not found' }] }); }
      /* 실제 먼데이처럼: 없는 라벨이면 거부 */
      for (const [col, val] of Object.entries(cv)) {
        if (val && val.label && LABELS[col] && !LABELS[col].includes(val.label)) return res({ errors: [{ message: 'missing label ' + val.label }] });
        if (val && val.labels && LABELS[col] && val.labels.some(l => !LABELS[col].includes(l))) return res({ errors: [{ message: 'missing dropdown ' + val.labels }] });
      }
      const id = String(seq++); ITEMS.unshift({ id, name: v.n, cv });
      return res({ data: { create_item: { id } } });
    }
    if (/items_page\(limit:500\)/.test(q)) return res({ data: { boards: [{ items_page: { cursor: null, items: ITEMS.map(i => ({ id: i.id, name: i.name, column_values: [
      { id: 'email_mm6txhmr', text: (i.cv.email_mm6txhmr || {}).email || '' }, { id: 'date_mm6tymbz', text: (i.cv.date_mm6tymbz || {}).date || '' }, { id: 'phone_mm6temtg', text: (i.cv.phone_mm6temtg || {}).phone || '' }] })) } }] } });
    return res({ data: {} });
  }
  if (url.includes('api.brevo.com')) { MAILS.push({ to: body.to.map(t => t.email), subject: body.subject }); return res({ messageId: 'm' }); }
  if (url.includes('staticforms') || url.includes('web3forms')) return res({ success: false });
  return realFetch(url, init);
};

let pass = 0, fail = 0;
const ok = (m, c, d) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m, d !== undefined ? JSON.stringify(d).slice(0, 300) : ''); } };

const M = await import('../netlify/functions/_monday.mjs');
const now = new Date().toISOString();
const base = { ts: now, type: 'contact', label: '접수', channel: '메타', phone: '010-1234-5678' };

/* 1 — 1개월 예지보전 EVENT (/promo/consulting) */
let r = await M.pushLead('a1', { ...base, point: 'promo_consulting', company: '가나공업', name: '홍길동', email: 'hong@gana.co.kr',
  interest: '회전설비 AI 예지보전 1개월 무료 체험', exp: '처음', exp_group: '무경험', line: '유틸리티 (펌프 · 컴프레서 · 공조)', spot: '3라인 급수펌프 2대', sla: '영업일 기준 3~4일 이내' });
let it = ITEMS[0];
ok('예지보전 EVENT — 보드에 생성', r.ok && !r.skipped && it, r);
ok('  관심 분야 = 회전설비 AI 예지보전 체험', it && JSON.stringify(it.cv.dropdown_mm6tjqet) === JSON.stringify({ labels: ['회전설비 AI 예지보전 체험'] }), it && it.cv.dropdown_mm6tjqet);
ok('  문의 유형 = 프로모션 신청', it && it.cv.color_mm6t3gya.label === '프로모션 신청');
ok('  진동센서 경험 = 처음', it && it.cv.color_mm6vbg83 && it.cv.color_mm6vbg83.label === '처음');
ok('  설치 대상 라인 = 유틸리티(펌프·공조)', it && it.cv.color_mm6vphpa && it.cv.color_mm6vphpa.label === '유틸리티(펌프·공조)');
ok('  설비 위치 기입', it && it.cv.text_mm6vjkdc === '3라인 급수펌프 2대');
ok('  연락 약속 = 3영업일 이내', it && it.cv.color_mm6vjp7k && it.cv.color_mm6vjp7k.label === '3영업일 이내');

/* 2 — 맞춤 제안서와 함께 신청한 EVENT (_factoryconsult) */
const FC = await import('../netlify/functions/_factoryconsult.mjs');
const job = { id: 'j1', no: 'MK-P261028-AAAA', lead: { company: '넥센', name: '김', title: '과장', email: 'kim@nexen.co.kr', phone: '01011112222', region: '김해', facility: '조립 라인 모터 10대', factoryConsult: true, consentMkt: true }, meta: { source: 'ref=https://www.bing.com/', grade: { grade: 'A' } }, match: { input: { problems: ['rotating'] }, industry: { label: '제조' } } };
r = await FC.recordFactoryConsult(job);
it = ITEMS[0];
ok('제안서+EVENT — 먼데이 생성', r.ok && r.monday && /넥센/.test(it.name), r);
ok('  관심 분야 = 회전설비 AI 예지보전 체험', it.cv.dropdown_mm6tjqet && it.cv.dropdown_mm6tjqet.labels[0] === '회전설비 AI 예지보전 체험');
ok('  설치 대상 라인 = 조립 · 가공 라인', it.cv.color_mm6vphpa && it.cv.color_mm6vphpa.label === '조립 · 가공 라인');
r = await FC.recordProposalLead(job);
ok('맞춤 제안서 자체도 서버가 먼데이에 (견적)', r.ok && !r.skipped && ITEMS[0].cv.color_mm6t3gya.label === '견적', r);
r = await M.pushLead(now + '|kim@nexen.co.kr', { ...base, company: '넥센', email: 'kim@nexen.co.kr', interest: '맞춤 제안서', point: 'custom_proposal' });
ok('  뒤따라온 브라우저 줄은 같은 날 같은 신청으로 묶임', r.ok && /중복/.test(r.skipped || ''), r);

/* 3 — 예전 라벨 「공장 설비 예지보전」 백서 신청이 보드에서 사라지던 문제 */
const n0 = ITEMS.length;
r = await M.pushLead('a3', { ...base, type: 'doc_request', company: '다라전자', email: 'x@dara.kr', interest: '공장 설비 예지보전' });
ok('공장 설비 예지보전 백서 — 생성됨(공장 설비 컨설팅)', r.ok && ITEMS.length === n0 + 1 && ITEMS[0].cv.dropdown_mm6tjqet.labels[0] === '공장 설비 컨설팅', r);

/* 4 — 어떤 이유로든 거부되면 칸을 줄여 재시도 */
failNext = 1;
r = await M.pushLead('a4', { ...base, company: '마바', email: 'm@ba.kr', interest: '기타: 질문' });
ok('먼데이가 한 번 거부해도 칸을 줄여 생성', r.ok && r.itemId && r.degraded, r);

/* 5 — 기술지원·현장진단 표시 */
r = await M.pushLead('a5', { ...base, company: '사아', email: 's@a.kr', interest: '기술지원(AS) 접수', point: 'support_ticket' });
ok('기술지원 접수도 리드 원장에 — [기술지원] 표시', r.ok && /^\[기술지원\]/.test(ITEMS[0].name), ITEMS[0].name);

/* 6 — 자동 맞춤(sync) */
const { append } = await import('../netlify/functions/_store.mjs');
const old = new Date(Date.now() - 3600e3).toISOString();
const mk = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date()) + '.jsonl';
await append('leads', mk, { ...base, ts: old, company: '빠진회사', email: 'lost@co.kr', interest: '무선 화재경보 · 소방 안전', type: 'doc_request' });
/* 사람이 손으로 넣은 아이템 */
ITEMS.unshift({ id: '9999', name: '손으로넣음', cv: { email_mm6txhmr: { email: 'manual@co.kr' }, date_mm6tymbz: { date: new Date(Date.now() + 324e5).toISOString().slice(0, 10) } } });
await append('leads', mk, { ...base, ts: old, company: '손으로넣음', email: 'manual@co.kr', interest: '센서 구매' });
await append('leads', mk, { ...base, ts: old, company: '테스트회사', email: 't@t.kr', interest: 'x' });
const S = await import('../netlify/functions/_monday_sync.mjs');
const before = ITEMS.length;
r = await S.syncOnce({ from: '2026-01-01' });
ok('자동 맞춤 — 빠진 접수 1건 생성 · 손으로 넣은 1건 연결 · 테스트 제외', r.created === 1 && r.linked === 1 && ITEMS.length === before + 1 && ITEMS[0].name === '빠진회사', r);
r = await S.syncOnce({ from: '2026-01-01' });
ok('  두 번 돌려도 그대로', r.created === 0 && r.missing === 0, r);

/* 7 — 메일 수신자 */
const T = await import('../netlify/functions/_staffto.mjs');
ok('필수 수신자 = 1015@monnit.com', T.mustTo().join() === '1015@monnit.com');
process.env.STAFF_MUST_TO = '';
ok('  환경변수를 비워도 1015@ 유지', T.mustTo().join() === '1015@monnit.com');
const R = await import('../netlify/functions/_route.mjs');
process.env.ROUTE_GENERAL_TO = 'someone@monnit.com';
let to = await R.recipientsFor('general', {});
ok('일반 담당을 바꿔도 1015@ 포함', to.includes('1015@monnit.com') && to.includes('someone@monnit.com'), to);
to = await R.recipientsFor('visit', {});
ok('현장진단 예약에도 1015@', to.includes('1015@monnit.com'), to);
delete process.env.ROUTE_GENERAL_TO;

MAILS.length = 0;
let rr = await R.routeLead({ ts: now, type: 'doc_request', label: '자료', company: '백서회사', email: 'w@p.kr', interest: '무선 화재경보 · 소방 안전' }, {}, { doc: true });
ok('자료 신청(가이드 아님) → 1015@ 한 통 · 대표 메일 제외', rr.ok && MAILS.length === 1 && MAILS[0].to.join() === '1015@monnit.com', { rr, MAILS });
MAILS.length = 0;
rr = await R.routeLead({ ts: now, type: 'doc_request', label: '자료', company: '가이드회사', email: 'g@p.kr', interest: '예지보전 제안 가이드' }, {}, { doc: true });
ok('예지보전 제안 가이드 → 메일 없음', MAILS.length === 0 && /가이드/.test(rr.skipped || ''), rr);
MAILS.length = 0;
rr = await R.routeLead({ ts: now, type: 'subscribe', label: '구독', company: '', email: 'n@p.kr', interest: '뉴스레터' }, {}, { doc: true });
ok('구독 → 1015@', MAILS.length === 1 && MAILS[0].to.includes('1015@monnit.com'), MAILS);

const N = await import('../netlify/functions/_notify.mjs');
MAILS.length = 0;
let nr = await N.notify({ ts: now, label: '접수', company: '알리미계약', interest: '계약 체결' }, {});
ok('notify(알리미 계약·누락 복구 등) → 1015@ 포함', nr.ok && MAILS[0] && MAILS[0].to.includes('1015@monnit.com'), MAILS);
MAILS.length = 0;
nr = await N.notify({ ts: now, label: '접수', company: '무경험', interest: '회전설비', exp_group: '무경험' }, {});
ok('  예지보전 가이드(무경험) 건은 강제하지 않음 · 대표 제외', MAILS[0] && !MAILS[0].to.includes('0702yeom@gmail.com'), MAILS);

const C = await import('../netlify/lib/proposal/config.mjs');
ok('맞춤 제안서 담당자 알림 → 1015@ 포함', C.CFG.staffTo.includes('1015@monnit.com'), C.CFG.staffTo);

console.log(`\n합계  통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
