/** 먼데이 「리드 원장 (Lead CRM)」 자동 등록.
 *
 *  여태 이 연결은 존재하지 않았다. 보드에는 웹사이트와 이어진 자동화가 하나도 없고,
 *  아이템은 사람이 알림 메일을 보고 손으로 넣고 있었다.
 *  그래서 2026-09-05 알림 메일이 끊기자 보드도 같이 멈췄다.
 *
 *  이제 접수가 원장에 기록되는 시점에 여기서 바로 아이템을 만든다.
 *  메일이 죽어도 보드는 채워진다.
 *
 *  필요한 환경변수: MONDAY_TOKEN  (없으면 조용히 건너뛴다)
 */
import { get, set } from './_store.mjs';

const API   = 'https://api.monday.com/v2';
const BOARD = () => process.env.MONDAY_BOARD_ID || '18429299666';   /* 실행 때 읽음 (Cloudflare 이관 — 설정 자동 이전 대응) */
const TOKEN = () => process.env.MONDAY_TOKEN || '';   /* 실행 때 읽음 (Cloudflare 이관 — 설정 자동 이전 대응) */
const MAP_KEY = 'monday.json';   // 리드 id → 먼데이 아이템 id

/* 보드 컬럼 id — 보드에서 컬럼을 지우거나 새로 만들면 여기도 바꿔야 한다 */
const COL = {
  stage:    'color_mm6ta6wq',    // 단계
  channel:  'color_mm6tdfp7',    // 유입 채널
  route:    'color_mm6t7jqh',    // 드롭다운(전화 / 홈페이지 문의)
  kind:     'color_mm6t3gya',    // 문의 유형
  interest: 'dropdown_mm6tjqet', // 관심 분야
  person:   'text_mm6tvchx',     // 담당자
  phone:    'phone_mm6temtg',
  email:    'email_mm6txhmr',
  utm:      'text_mm6tbg3w',     // 소재 / utm_content
  date:     'date_mm6tymbz',     // 접수일
  memo:     'long_text_mm6tbx0s', // 응대 기록
  /* /promo/consulting 「회전설비 AI 예지보전 1개월 무료 체험」 전용 칸 — 그동안 비어 있던 것 (2026-10-28) */
  exp:      'color_mm6vbg83',    // 진동센서 경험 (사용 중 · 써봤음 · 처음)
  line:     'color_mm6vphpa',    // 설치 대상 라인
  spot:     'text_mm6vjkdc',     // 설비 위치
  sla:      'color_mm6vjp7k'     // 연락 약속 (당일 · 3영업일 이내)
};

const CHANNELS = ['메타', '구글', '네이버', '직접', '외부유입', '기타'];

/* 관심 분야 드롭다운의 값 — 기본값. 실제 라벨은 보드에서 읽어 온다(boardLabels).
   2026-10-28 사고: 코드의 「공장 설비 예지보전」이 보드에선 「공장 설비 컨설팅」으로 바뀌어 있었고,
   create_labels_if_missing:false 라서 그 접수(공장 설비 예지보전 백서 신청)는 아이템 생성 자체가 실패해 보드에서 사라졌다.
   이제 ① 보드의 진짜 라벨에만 맞추고 ② 그래도 실패하면 칸을 줄여 다시 만든다 — 리드는 절대 빠지지 않는다. */
const INTERESTS = [
  '공장 설비 컨설팅', '예지보전 제안 가이드', '데이터센터 · IDC 모니터링',
  '콜드체인 · 물류 온도 관리', '리테일 · 매장 · 외식 온도 관리', '진동 · 구조안전 계측',
  'UPS · ESS · 전력 설비 모니터링', '온도 · 누수 · 동파 · HVAC 통합',
  '무선 화재경보 · 소방 안전', '긴급 경보 알리미', '회전설비 AI 예지보전 체험',
  '센서 구매', '온도센서', '기타'
];

/* 원문 → 보드 라벨. 위에서부터 먼저 걸리는 것. 라벨이 보드에 없으면 건너뛴다. */
const INTEREST_RULES = [
  [/회전설비.*예지보전|1\s*개월\s*무료|무료\s*체험|공장\s*(설비\s*)?진단\s*EVENT|promo_consulting/i, '회전설비 AI 예지보전 체험'],
  [/예지보전\s*(제안\s*)?가이드/, '예지보전 제안 가이드'],
  [/공장\s*설비|설비\s*예지보전|예지보전\s*컨설팅/, '공장 설비 컨설팅'],
  [/알리미/, '긴급 경보 알리미'],
  [/데이터\s*센터|IDC|서버실/i, '데이터센터 · IDC 모니터링'],
  [/콜드\s*체인|물류\s*온도|냉장|냉동/, '콜드체인 · 물류 온도 관리'],
  [/리테일|매장|외식/, '리테일 · 매장 · 외식 온도 관리'],
  [/구조\s*안전|진동\s*·?\s*구조/, '진동 · 구조안전 계측'],
  [/UPS|ESS|전력\s*설비/i, 'UPS · ESS · 전력 설비 모니터링'],
  [/누수|동파|HVAC/i, '온도 · 누수 · 동파 · HVAC 통합'],
  [/화재|소방/, '무선 화재경보 · 소방 안전'],
  [/센서\s*구매|구매\s*문의/, '센서 구매'],
  [/온도\s*센서/, '온도센서']
];

/* 설치 대상 라인 — 신청서 선택값 → 보드 라벨 */
const LINE_RULES = [
  [/조립|가공/, '조립 · 가공 라인'],
  [/포장|물류/, '포장 · 물류 라인'],
  [/유틸|펌프|컴프레서|공조/, '유틸리티(펌프·공조)'],
  [/원료|배합|혼합/, '원료 · 배합 공정'],
  [/발전|전력/, '발전 · 전력 설비'],
  [/용수|폐수/, '용수 · 폐수 처리'],
  [/기타|미정/, '기타 · 미정']
];

const norm = v => String(v || '').replace(/[\s·()（）\-_/]/g, '').toLowerCase();

/* ── 보드 라벨 읽기 (10분 캐시) ── 보드에서 라벨 이름을 바꿔도 코드가 따라간다 */
let _labels = null, _labelsAt = 0;
export async function boardLabels(force) {
  if (!force && _labels && Date.now() - _labelsAt < 10 * 60 * 1000) return _labels;
  try {
    const ids = [COL.stage, COL.channel, COL.route, COL.kind, COL.interest, COL.exp, COL.line, COL.sla];
    const d = await gql(`query($b:[ID!],$c:[String!]){ boards(ids:$b){ columns(ids:$c){ id settings_str } } }`, { b: [BOARD()], c: ids });
    const out = {};
    for (const c of (d.boards && d.boards[0] && d.boards[0].columns) || []) {
      let st = {}; try { st = JSON.parse(c.settings_str || '{}'); } catch (e) { st = {}; }
      const raw = st.labels;
      let list = [];
      if (Array.isArray(raw)) list = raw.map(x => (x && typeof x === 'object') ? x.name || x.label : x);   /* dropdown */
      else if (raw && typeof raw === 'object') list = Object.values(raw);                                    /* status */
      out[c.id] = list.map(x => String(x || '').trim()).filter(Boolean);
    }
    if (Object.keys(out).length) { _labels = out; _labelsAt = Date.now(); }
  } catch (e) { /* 못 읽으면 기본값으로 */ }
  return _labels || {};
}

/** 보드에 실제로 있는 라벨로 맞춘다. 없으면 null — 그 칸은 비워 두고 응대 기록에 원문을 남긴다. */
function fit(labels, colId, want) {
  if (!want) return null;
  const list = labels && labels[colId];
  if (!list || !list.length) return want;            /* 라벨을 못 읽었으면 그대로 시도(실패하면 아래에서 칸을 줄여 재시도) */
  if (list.includes(want)) return want;
  const n = norm(want);
  return list.find(l => norm(l) === n) || null;
}

async function gql(query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN(), 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000)
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors.map(e => e.message).join(' / '));
  return j.data;
}

/* 한국 시간 기준 날짜 문자열 */
function kstDate(ts) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(ts ? new Date(ts) : new Date());
}

function groupTitle(ts) {
  const d = kstDate(ts);                       // 2026-09-05
  return `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월`;
}

/** 월 그룹을 찾고, 없으면 만든다 */
async function groupIdFor(ts) {
  const want = groupTitle(ts);
  const d = await gql(`query($b:[ID!]){ boards(ids:$b){ groups{ id title } } }`, { b: [BOARD()] });
  const groups = (d.boards && d.boards[0] && d.boards[0].groups) || [];
  const hit = groups.find(g => g.title.trim() === want);
  if (hit) return hit.id;
  const c = await gql(
    `mutation($b:ID!,$t:String!){ create_group(board_id:$b, group_name:$t){ id } }`,
    { b: BOARD(), t: want }
  );
  return c.create_group.id;
}

/** 관심분야 원문을 보드 라벨로 맞춘다. 못 맞추면 null */
function matchInterest(raw, labels) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const list = (labels && labels[COL.interest] && labels[COL.interest].length) ? labels[COL.interest] : INTERESTS;
  if (list.includes(s)) return s;
  for (const [re, label] of INTEREST_RULES) if (re.test(s) && list.includes(label)) return label;
  /* 라벨이 원문에 들어 있으면 그걸로 본다.  예: "긴급 경보 알리미 상시 프로모션" → "긴급 경보 알리미" */
  const hits = list.filter(l => l !== '기타' && s.includes(l));
  if (hits.length) return hits.sort((a, b) => b.length - a.length)[0];
  return null;
}

function lineOf(raw) {
  const s = String(raw || '');
  for (const [re, label] of LINE_RULES) if (re.test(s)) return label;
  return null;
}

function slaOf(lead) {
  const s = String(lead.sla || '');
  if (!s) return null;
  if (/당일/.test(s)) return '당일';
  if (/영업일|일\s*이내|\d\s*~\s*\d\s*일/.test(s)) return '3영업일 이내';
  return null;
}

function kindOf(lead) {
  const t = `${lead.point || ''} ${lead.interest || ''} ${lead.memo || ''}`;
  if (lead.type === 'doc_request') return '자료요청';
  if (lead.type === 'subscribe') return '자료요청';
  if (/promo/i.test(lead.point || '') || /프로모션|무료\s*체험|EVENT/i.test(t)) return '프로모션 신청';
  if (/맞춤\s*제안|견적/.test(t)) return '견적';
  if (/협업|제휴|파트너|대리점|총판/.test(t)) return '협업';
  return '기타';
}

/** 접수 경로 한 단어 — 보드 이름 앞에 붙여 한눈에 구분한다 */
function tagOf(lead) {
  const t = `${lead.point || ''} ${lead.interest || ''}`;
  if (/기술지원|설치\s*확인|support_ticket/.test(t)) return '[기술지원] ';
  if (/visit_booking|현장\s*진단\s*예약|현장진단 예약/.test(t)) return '[현장진단 예약] ';
  if (lead.type === 'subscribe') return '[구독] ';
  return '';
}

function utmOf(lead) {
  const m = String(lead.source || '').match(/utm_content=([^·&\n]+)/);
  return m ? m[1].trim() : '';
}

/** 그룹의 맨 위 아이템 id. 새 접수를 그 앞에 꽂아 최신이 위로 오게 한다.
 *  아이템이 없으면 null — 그때는 그냥 만든다. */
async function topItemOf(groupId) {
  try {
    const d = await gql(
      `query($b:[ID!],$g:[String!]){ boards(ids:$b){ groups(ids:$g){ items_page(limit:1){ items{ id } } } } }`,
      { b: [BOARD()], g: [groupId] }
    );
    const items = d?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
    return items.length ? items[0].id : null;
  } catch { return null; }
}

/** 사람이 보드에서 알아볼 이름 */
function itemName(lead) {
  return (tagOf(lead) + String(lead.company || lead.name || lead.email || lead.phone || '(미식별 리드)')).slice(0, 200);
}

function columnValues(lead, labels) {
  const L = labels || {};
  const cv = {};
  const set = (col, want) => { const v = fit(L, col, want); if (v) cv[col] = { label: v }; return v; };
  set(COL.stage, '접수');
  set(COL.route, '홈페이지 문의');
  set(COL.kind, kindOf(lead));
  set(COL.channel, CHANNELS.includes(lead.channel) ? lead.channel : '기타');

  const it = matchInterest(lead.interest, L);
  if (it) cv[COL.interest] = { labels: [it] };

  if (lead.name)  cv[COL.person] = String(lead.name).slice(0, 200);
  const ph = String(lead.phone || '').replace(/[^0-9+]/g, '');
  if (ph.length >= 7) cv[COL.phone]  = { phone: ph, countryShortName: 'KR' };
  if (lead.email && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(lead.email).trim())) cv[COL.email] = { email: String(lead.email).trim(), text: String(lead.email).trim() };

  const utm = utmOf(lead);
  if (utm) cv[COL.utm] = utm.slice(0, 200);

  cv[COL.date] = { date: kstDate(lead.ts) };

  /* 1개월 무료 체험(예지보전 EVENT) 칸 — /promo/consulting 신청 · 맞춤 제안서와 함께 신청한 건 */
  const exp = String(lead.exp || '').trim();
  const gotExp = exp ? set(COL.exp, exp) : null;
  const ln = lineOf(lead.line);
  const gotLine = ln ? set(COL.line, ln) : null;
  if (lead.spot) cv[COL.spot] = String(lead.spot).slice(0, 200);
  const sla = slaOf(lead);
  if (sla) set(COL.sla, sla);

  const memo = [
    lead.memo ? `문의: ${lead.memo}` : '',
    /* 드롭다운에 못 넣은 값은 원문을 여기에 남긴다 */
    (lead.interest && it !== lead.interest) ? `관심분야(원문): ${lead.interest}` : '',
    (exp && !gotExp) ? `진동센서 경험: ${exp}` : '',
    (lead.exp_group) ? `경험 구분: ${lead.exp_group}${lead.exp_group === '무경험' ? ' — 예지보전 가이드 자동 발송' : ''}` : '',
    (lead.line && !gotLine) ? `설치 대상 라인: ${lead.line}` : '',
    lead.sla     ? `연락 예정: ${lead.sla}` : '',
    lead.proposal ? `맞춤 제안서: ${lead.proposal}` : '',
    lead.asset   ? `시설·제품: ${lead.asset}` : '',
    lead.product && lead.product !== lead.asset ? `제품: ${lead.product}` : '',
    lead.region  ? `지역: ${lead.region}` : '',
    lead.consent_mkt ? `마케팅 수신: ${lead.consent_mkt}` : '',
    lead.source  ? `출처: ${lead.source}` : '',
    lead.landing ? `유입: ${lead.landing}` : '',
    lead.flags   ? `⚠ 형식 확인 필요: ${lead.flags}` : ''
  ].filter(Boolean).join('\n');
  if (memo) cv[COL.memo] = { text: memo.slice(0, 2000) };

  return cv;
}

/** 칸을 줄인 안전판 — 라벨·전화 형식 때문에 생성이 거부되면 이걸로 다시 만든다. 리드는 반드시 보드에 남긴다. */
function safeValues(lead, full, why) {
  const cv = {};
  if (full[COL.date]) cv[COL.date] = full[COL.date];
  if (full[COL.person]) cv[COL.person] = full[COL.person];
  if (full[COL.email]) cv[COL.email] = full[COL.email];
  if (full[COL.utm]) cv[COL.utm] = full[COL.utm];
  const raw = [
    lead.phone ? `연락처: ${lead.phone}` : '',
    lead.interest ? `관심분야: ${lead.interest}` : '',
    `(자동 등록 — 일부 칸은 보드 라벨과 맞지 않아 비웠습니다: ${String(why || '').slice(0, 160)})`
  ].filter(Boolean).join('\n');
  const memo = ((full[COL.memo] && full[COL.memo].text) || '') + '\n' + raw;
  cv[COL.memo] = { text: memo.slice(0, 2000) };
  return cv;
}

export async function readMap() {
  try { return JSON.parse(await get('ops', MAP_KEY) || '{}'); } catch { return {}; }
}

/** 지도에 여러 건을 한 번에 적는다 — 다시 읽어서 합친다(그 사이 다른 건이 들어왔을 수 있다) */
export async function writeMap(entries) {
  const fresh = await readMap();
  Object.assign(fresh, entries);
  return set('ops', MAP_KEY, JSON.stringify(fresh));
}

/** 같은 사람이 같은 날 같은 관심분야로 두 번 누른 접수 — 보드에는 한 줄만 (2026-10-28)
 *  예전에는 더블클릭·새로고침 재전송이 그대로 두 줄씩 생겼다(하이큐스 · KCC 등). 관심분야가 다르면 다른 리드다. */
export function dupKey(lead) {
  const who = String(lead.email || '').trim().toLowerCase() || String(lead.phone || '').replace(/[^0-9]/g, '') || norm(lead.company);
  if (!who) return '';
  return 'k:' + kstDate(lead.ts) + '|' + who + '|' + norm(lead.interest || lead.type || '');
}

/** 아이템 한 개 만들기 — 실패하면 칸을 줄여 한 번, 그래도 안 되면 이름·날짜·기록만으로 한 번 더. */
async function createItem(lead) {
  const labels = await boardLabels();
  const group = await groupIdFor(lead.ts);
  const top = await topItemOf(group);
  const name = itemName(lead);
  const full = columnValues(lead, labels);

  const make = async (cv) => top
    ? gql(`mutation($b:ID!,$g:String!,$n:String!,$v:JSON!,$r:ID!){
             create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$v,
                         create_labels_if_missing:false,
                         relative_to:$r, position_relative_method:before_at){ id } }`,
          { b: BOARD(), g: group, n: name, v: JSON.stringify(cv), r: top })
    : gql(`mutation($b:ID!,$g:String!,$n:String!,$v:JSON!){
             create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$v,
                         create_labels_if_missing:false){ id } }`,
          { b: BOARD(), g: group, n: name, v: JSON.stringify(cv) });

  /* 맨 위 아이템 「앞」에 꽂는다. 먼데이는 기본이 맨 아래라서,
     그냥 두면 새 문의가 스크롤 끝에 숨어 못 보고 지나친다. */
  try { return { itemId: (await make(full)).create_item.id }; }
  catch (e1) {
    boardLabels(true).catch(() => {});   /* 라벨이 바뀌었을 수 있다 — 다음 접수부터 새로 읽는다 */
    try { return { itemId: (await make(safeValues(lead, full, e1.message))).create_item.id, degraded: String(e1.message || e1).slice(0, 200) }; }
    catch (e2) {
      const cv = { [COL.memo]: { text: (((full[COL.memo] && full[COL.memo].text) || '') + `\n연락처: ${lead.phone || '-'} · 이메일: ${lead.email || '-'}`).slice(0, 2000) } };
      return { itemId: (await make(cv)).create_item.id, degraded: String(e2.message || e2).slice(0, 200) };
    }
  }
}

/** 접수 한 건을 보드에 만든다. 이미 올린 건은 건너뛴다. 실패해도 throw 하지 않는다. */
/** 내부 테스트 접수인가 — ops.mjs 의 isTestLead 와 같은 규칙이다.
 *  두 곳이 갈라지면 「원장에서는 빠졌는데 보드에는 남는」 일이 생기므로
 *  tools/test-testlead.mjs 가 두 판정이 같은지 확인한다. */
export { isTestLead } from './_istest.mjs';
import { isTestLead } from './_istest.mjs';

export async function pushLead(id, lead) {
  if (!TOKEN()) return { ok: false, skipped: 'MONDAY_TOKEN 없음' };
  /* 내부 테스트 접수는 보드에 올리지 않는다. 리드 원장(CRM)은 영업이 보는
     화면이라 점검용 행이 섞이면 건수와 전환율이 어긋난다.
     원장(ops)에는 그대로 남으므로 접수 경로가 살아 있는지는 거기서 본다. */
  if (isTestLead(lead) || lead.test === true) return { ok: true, skipped: '테스트 접수' };
  try {
    const map = await readMap();
    if (map[id]) return { ok: true, skipped: '이미 등록됨', itemId: map[id] };
    const dk = dupKey(lead);
    if (dk && map[dk]) {
      await writeMap({ [id]: map[dk] });
      return { ok: true, skipped: '같은 날 같은 신청(중복)', itemId: map[dk] };
    }

    const r = await createItem(lead);
    await writeMap({ [id]: r.itemId, ...(dk ? { [dk]: r.itemId } : {}) });
    return { ok: true, itemId: r.itemId, ...(r.degraded ? { degraded: r.degraded } : {}) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/** 보드에 이미 있는 아이템 — 이메일·접수일·이름 (자동 맞춤에서 사람이 손으로 넣은 건과 겹치지 않게) */
export async function boardIndex(limit = 1000) {
  const out = [];
  let cursor = null, guard = 0;
  do {
    const d = cursor
      ? await gql(`query($c:String!){ next_items_page(limit:500, cursor:$c){ cursor items{ id name column_values(ids:["${COL.email}","${COL.date}","${COL.phone}"]){ id text } } } }`, { c: cursor })
      : await gql(`query($b:[ID!]){ boards(ids:$b){ items_page(limit:500){ cursor items{ id name column_values(ids:["${COL.email}","${COL.date}","${COL.phone}"]){ id text } } } } }`, { b: [BOARD()] });
    const page = cursor ? d.next_items_page : d.boards[0].items_page;
    for (const it of page.items || []) {
      const v = Object.fromEntries((it.column_values || []).map(c => [c.id, c.text || '']));
      out.push({ id: it.id, name: it.name, email: String(v[COL.email] || '').trim().toLowerCase(), date: v[COL.date] || '', phone: String(v[COL.phone] || '').replace(/[^0-9]/g, '') });
    }
    cursor = page.cursor;
  } while (cursor && out.length < limit && ++guard < 5);
  return out;
}

/** 연동이 살아 있는지 확인 — 토큰과 보드 접근만 본다. 아무것도 만들지 않는다. */
export async function ping() {
  if (!TOKEN()) return { ok: false, reason: 'MONDAY_TOKEN 환경변수가 없습니다' };
  try {
    const d = await gql(`query($b:[ID!]){ boards(ids:$b){ id name items_count } }`, { b: [BOARD()] });
    const b = d.boards && d.boards[0];
    if (!b) return { ok: false, reason: '보드를 찾을 수 없습니다 (권한 또는 보드 ID 확인)' };
    return { ok: true, board: b.name, items: b.items_count };
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) };
  }
}

export const _internal = { matchInterest, kindOf, columnValues, groupTitle, utmOf, itemName };
