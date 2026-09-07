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
const BOARD = process.env.MONDAY_BOARD_ID || '18429299666';
const TOKEN = process.env.MONDAY_TOKEN || '';
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
  memo:     'long_text_mm6tbx0s' // 응대 기록
};

const CHANNELS = ['메타', '구글', '네이버', '직접', '외부유입', '기타'];

/* 관심 분야 드롭다운에 실제로 있는 값. 없는 값을 넣으면 라벨이 지저분해지므로
   맞는 게 없으면 비워 두고 응대 기록에 원문을 남긴다. */
const INTERESTS = [
  '공장 설비 예지보전', '예지보전 제안 가이드', '데이터센터 · IDC 모니터링',
  '콜드체인 · 물류 온도 관리', '리테일 · 매장 · 외식 온도 관리', '진동 · 구조안전 계측',
  'UPS · ESS · 전력 설비 모니터링', '온도 · 누수 · 동파 · HVAC 통합',
  '무선 화재경보 · 소방 안전', '긴급 경보 알리미', '회전설비 AI 예지보전 체험',
  '센서 구매', '기타'
];

async function gql(query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN, 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables })
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
  const d = await gql(`query($b:[ID!]){ boards(ids:$b){ groups{ id title } } }`, { b: [BOARD] });
  const groups = (d.boards && d.boards[0] && d.boards[0].groups) || [];
  const hit = groups.find(g => g.title.trim() === want);
  if (hit) return hit.id;
  const c = await gql(
    `mutation($b:ID!,$t:String!){ create_group(board_id:$b, group_name:$t){ id } }`,
    { b: BOARD, t: want }
  );
  return c.create_group.id;
}

/** 관심분야 원문을 보드 라벨로 맞춘다. 못 맞추면 null */
function matchInterest(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (INTERESTS.includes(s)) return s;
  /* 라벨이 원문에 들어 있으면 그걸로 본다.
     예: "긴급 경보 알리미 상시 프로모션" → "긴급 경보 알리미" */
  const hits = INTERESTS.filter(l => l !== '기타' && s.includes(l));
  if (hits.length) return hits.sort((a, b) => b.length - a.length)[0];
  return null;
}

function kindOf(lead) {
  const t = `${lead.point || ''} ${lead.interest || ''} ${lead.memo || ''}`;
  if (lead.type === 'doc_request') return '자료요청';
  if (/promo/i.test(lead.point || '') || /프로모션/.test(t)) return '프로모션 신청';
  if (/견적/.test(t)) return '견적';
  return '기타';
}

function utmOf(lead) {
  const m = String(lead.source || '').match(/utm_content=([^·&\n]+)/);
  return m ? m[1].trim() : '';
}

/** 사람이 보드에서 알아볼 이름 */
function itemName(lead) {
  return String(lead.company || lead.name || lead.email || lead.phone || '(미식별 리드)').slice(0, 200);
}

function columnValues(lead) {
  const cv = {};
  cv[COL.stage] = { label: '접수' };
  cv[COL.route] = { label: '홈페이지 문의' };
  cv[COL.kind]  = { label: kindOf(lead) };

  const ch = CHANNELS.includes(lead.channel) ? lead.channel : '기타';
  cv[COL.channel] = { label: ch };

  const it = matchInterest(lead.interest);
  if (it) cv[COL.interest] = { labels: [it] };

  if (lead.name)  cv[COL.person] = String(lead.name).slice(0, 200);
  if (lead.phone) cv[COL.phone]  = { phone: String(lead.phone).replace(/[^0-9+]/g, ''), countryShortName: 'KR' };
  if (lead.email) cv[COL.email]  = { email: lead.email, text: lead.email };

  const utm = utmOf(lead);
  if (utm) cv[COL.utm] = utm;

  cv[COL.date] = { date: kstDate(lead.ts) };

  const memo = [
    lead.memo ? `문의: ${lead.memo}` : '',
    /* 드롭다운에 못 넣은 관심분야 원문은 여기에 남긴다 */
    (!it && lead.interest) ? `관심분야(원문): ${lead.interest}` : '',
    lead.asset   ? `시설·제품: ${lead.asset}` : '',
    lead.region  ? `지역: ${lead.region}` : '',
    lead.source  ? `출처: ${lead.source}` : '',
    lead.landing ? `유입: ${lead.landing}` : '',
    lead.flags   ? `⚠ 형식 확인 필요: ${lead.flags}` : ''
  ].filter(Boolean).join('\n');
  if (memo) cv[COL.memo] = { text: memo.slice(0, 2000) };

  return cv;
}

async function readMap() {
  try { return JSON.parse(await get('ops', MAP_KEY) || '{}'); } catch { return {}; }
}

/** 접수 한 건을 보드에 만든다. 이미 올린 건은 건너뛴다. 실패해도 throw 하지 않는다. */
export async function pushLead(id, lead) {
  if (!TOKEN) return { ok: false, skipped: 'MONDAY_TOKEN 없음' };
  try {
    const map = await readMap();
    if (map[id]) return { ok: true, skipped: '이미 등록됨', itemId: map[id] };

    const group = await groupIdFor(lead.ts);
    const d = await gql(
      `mutation($b:ID!,$g:String!,$n:String!,$v:JSON!){
         create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$v,
                     create_labels_if_missing:false){ id } }`,
      { b: BOARD, g: group, n: itemName(lead), v: JSON.stringify(columnValues(lead)) }
    );
    const itemId = d.create_item.id;

    /* 지도 갱신 — 다시 읽어서 쓴다(그 사이 다른 건이 들어왔을 수 있다) */
    const fresh = await readMap();
    fresh[id] = itemId;
    await set('ops', MAP_KEY, JSON.stringify(fresh));
    return { ok: true, itemId };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/** 연동이 살아 있는지 확인 — 토큰과 보드 접근만 본다. 아무것도 만들지 않는다. */
export async function ping() {
  if (!TOKEN) return { ok: false, reason: 'MONDAY_TOKEN 환경변수가 없습니다' };
  try {
    const d = await gql(`query($b:[ID!]){ boards(ids:$b){ id name items_count } }`, { b: [BOARD] });
    const b = d.boards && d.boards[0];
    if (!b) return { ok: false, reason: '보드를 찾을 수 없습니다 (권한 또는 보드 ID 확인)' };
    return { ok: true, board: b.name, items: b.items_count };
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) };
  }
}

export const _internal = { matchInterest, kindOf, columnValues, groupTitle, utmOf, itemName };
