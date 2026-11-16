/** 먼데이 「기술지원 접수 (Support)」 보드 자동 등록 (2026-10-20)
 *
 *  모니 「사용 중 문제 해결」로 들어온 기술지원(AS)·알리미 설치 확인 접수를 기술팀 보드에 만든다.
 *  리드 원장(Lead CRM) 보드는 영업용이라 AS 건을 섞지 않는다 — 이 종류는 여기에만 올린다.
 *  (영업 문의(모니)는 예전처럼 리드 원장으로 간다.)
 *
 *  보드: https://monnitk.monday.com/boards/18436191828  (2026-10-20 생성 · 워크스페이스 Monnit)
 *  그룹: 신규 접수(topics) → 처리 중 → 완료   ※ 웹사이트는 「신규 접수」 맨 위에만 넣는다
 *
 *  환경변수
 *    MONDAY_TOKEN           리드 원장과 같은 토큰 (없으면 조용히 건너뛴다)
 *    MONDAY_SUPPORT_BOARD   보드 id (기본 18436191828)
 *    MONDAY_SUPPORT_GROUP   신규 접수 그룹 id (기본 topics)
 *  실패해도 throw 하지 않는다 — 접수는 원장·메일로 이미 남아 있다.
 */
import { get, set } from './_store.mjs';
import { isTestLead } from './_istest.mjs';

const API = 'https://api.monday.com/v2';
const BOARD = () => process.env.MONDAY_SUPPORT_BOARD || '18436191828';
const GROUP = () => process.env.MONDAY_SUPPORT_GROUP || 'topics';
const TOKEN = () => process.env.MONDAY_TOKEN || '';
const MAP_KEY = 'monday-support.json';   /* 리드 id → 아이템 id (중복 등록 방지) */

/* 보드 컬럼 id — 보드에서 컬럼을 지우거나 새로 만들면 여기도 바꿔야 한다 */
export const COL = {
  status:  'color_mm8a8f2f',         /* 상태: 접수 · 확인 중 · 고객 회신 대기 · AS 진행 · 완료 · 보류 */
  urgency: 'color_mm8av0q9',         /* 긴급도: 긴급(운영 지장) · 보통 · 단순 문의 · 설치 확인 */
  kind:    'color_mm8awh6y',         /* 접수 종류: 기술지원(AS) · 알리미 설치 확인 · 알리미 고장 */
  product: 'color_mm8azzd3',         /* 제품 */
  no:      'text_mm8a9x5k',
  person:  'text_mm8a11rs',
  phone:   'phone_mm8aekj6',
  email:   'email_mm8a6pb0',
  device:  'text_mm8a64n0',
  symptom: 'long_text_mm8apnyb',
  tried:   'long_text_mm8at9v2',
  convo:   'long_text_mm8axc2t',
  memo:    'long_text_mm8arhsf',
  date:    'date_mm8apxfq'
};
const PRODUCTS = ['센서 — 일반형(AA)', '센서 — 산업용(IND)', '센서 — 코인셀형', '이더넷 게이트웨이', 'LTE·IoT 게이트웨이', 'Modbus·기타 게이트웨이', 'iMonnit 계정·설정', '화재 알리미', '물감지 알리미', '정전 알리미', '경보 알리미', '잘 모르겠어요'];
const URGENCY = { '긴급(운영 지장)': '긴급(운영 지장)', '보통': '보통', '단순 문의': '단순 문의', '설치 확인': '설치 확인' };

/** 이 접수가 기술지원 보드 대상인가 */
export function isSupportLead(lead, payload) {
  const i = String((lead && lead.interest) || (payload && payload['관심분야']) || '');
  return /기술지원|설치\s*확인\s*요청/.test(i);
}

async function gql(query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN(), 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000)
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors.map(e => e.message).join(' / '));
  return j.data;
}
const kstDate = ts => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts ? new Date(ts) : new Date());

async function topItemOf(groupId) {
  try {
    const d = await gql(`query($b:[ID!],$g:[String!]){ boards(ids:$b){ groups(ids:$g){ items_page(limit:1){ items{ id } } } } }`, { b: [BOARD()], g: [groupId] });
    const items = d?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
    return items.length ? items[0].id : null;
  } catch { return null; }
}

function columnValues(lead, p) {
  const g = k => String(p[k] || '').trim();
  const cv = {};
  const install = /설치\s*확인/.test(String(lead.interest || ''));
  const product = g('제품') || g('시설 유형') || lead.asset || '';
  cv[COL.status] = { label: '접수' };
  cv[COL.kind] = { label: install ? '알리미 설치 확인' : /알리미/.test(product) ? '알리미 고장' : '기술지원(AS)' };
  const u = URGENCY[g('긴급도')] || (install ? '설치 확인' : '보통');
  cv[COL.urgency] = { label: u };
  if (PRODUCTS.includes(product)) cv[COL.product] = { label: product };
  if (g('접수번호')) cv[COL.no] = g('접수번호');
  if (lead.name) cv[COL.person] = String(lead.name).slice(0, 200);
  if (lead.phone) cv[COL.phone] = { phone: String(lead.phone).replace(/[^0-9+]/g, ''), countryShortName: 'KR' };
  if (lead.email) cv[COL.email] = { email: lead.email, text: lead.email };
  if (g('장치 ID')) cv[COL.device] = g('장치 ID').slice(0, 200);
  const symptom = [g('증상'), !PRODUCTS.includes(product) && product ? `제품(원문): ${product}` : ''].filter(Boolean).join('\n');
  if (symptom) cv[COL.symptom] = { text: symptom.slice(0, 2000) };
  if (g('시도한 조치')) cv[COL.tried] = { text: g('시도한 조치').slice(0, 2000) };
  if (g('대화 내용')) cv[COL.convo] = { text: g('대화 내용').slice(0, 2000) };
  const memo = [g('추가 내용') || '', lead.landing ? `유입: ${lead.landing}` : '', lead.flags ? `⚠ 형식 확인 필요: ${lead.flags}` : ''].filter(Boolean).join('\n');
  /* 양식의 「추가로 전하실 내용」은 문의 사항 안에 「고객 메모:」 줄로 들어온다 */
  const m = String(lead.memo || '').match(/고객 메모:\s*([^\n]+)/);
  const note = [m ? m[1] : '', memo].filter(Boolean).join('\n');
  if (note) cv[COL.memo] = { text: note.slice(0, 2000) };
  cv[COL.date] = { date: kstDate(lead.ts) };
  return cv;
}

async function readMap() { try { return JSON.parse(await get('ops', MAP_KEY) || '{}'); } catch { return {}; } }

/** 접수 한 건을 기술지원 보드에 만든다. 이미 올린 건은 건너뛴다. 절대 throw 하지 않는다. */
export async function pushSupport(id, lead, payload) {
  const p = payload || {};
  if (!isSupportLead(lead, p)) return { ok: false, skipped: 'not_support' };
  if (!TOKEN()) return { ok: false, skipped: 'MONDAY_TOKEN 없음' };
  if (lead.test || isTestLead(lead)) return { ok: false, skipped: '테스트 접수' };   /* 리드 원장과 같은 규칙 */
  try {
    const map = await readMap();
    if (id && map[id]) return { ok: true, itemId: map[id], dup: true };
    const no = String(p['접수번호'] || '').trim();
    const name = ((no ? no + ' · ' : '') + String(lead.company || lead.name || lead.email || '(미식별)')).slice(0, 200);
    const groupId = GROUP();
    const top = await topItemOf(groupId);
    const cv = JSON.stringify(columnValues(lead, p));
    const d = top
      ? await gql(`mutation($b:ID!,$g:String!,$n:String!,$c:JSON!,$r:ID!){ create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$c, relative_to:$r, position_relative_method:before_at){ id } }`, { b: BOARD(), g: groupId, n: name, c: cv, r: top })
      : await gql(`mutation($b:ID!,$g:String!,$n:String!,$c:JSON!){ create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$c){ id } }`, { b: BOARD(), g: groupId, n: name, c: cv });
    const itemId = d.create_item.id;
    if (id) { map[id] = itemId; await set('ops', MAP_KEY, JSON.stringify(map)).catch(() => {}); }
    return { ok: true, itemId };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 300) };
  }
}
