/** 알리미 계약·SLA 동의·설문 → 먼데이 「알리미 계약 현황」 보드 자동 기록 (2026-10-16)
 *
 *  보드: https://monnitk.monday.com/boards/18435756574 (Monnit 워크스페이스)
 *  토큰: 리드 원장과 같은 MONDAY_TOKEN. 없으면 조용히 건너뛴다 — 보드 기록 실패가 접수를 막으면 안 된다.
 *  보드 id 는 ALARM_MONDAY_BOARD 로 바꿀 수 있다 (기본 18435756574).
 *
 *  그룹: 신규 계약(topics) · 기존 고객 SLA 동의(group_mm86a9c5) · 만족도 조사(group_mm864g85)
 *  컬럼 id 는 보드에서 컬럼을 지우거나 새로 만들면 여기도 바꿔야 한다.
 */
const API = 'https://api.monday.com/v2';
const BOARD = () => process.env.ALARM_MONDAY_BOARD || '18435756574';
const TOKEN = () => process.env.MONDAY_TOKEN || '';
const SITE = () => String(process.env.URL || 'https://monnit.co.kr').replace(/\/$/, '');

const GROUP = { contract: 'topics', consent: 'group_mm86a9c5', survey: 'group_mm864g85' };
const COL = {
  kind: 'color_mm862x2z',      // 구분 (status)
  company: 'text_mm86rqby',    // 고객사
  site: 'text_mm86bqxf',       // 설치 현장
  products: 'dropdown_mm8664r3', // 제품
  sites: 'numeric_mm8696af',   // 개소
  monthly: 'numeric_mm86kz0',  // 월 청구액
  term: 'timerange_mm865zeb',  // 계약 기간
  person: 'text_mm862yvw',     // 담당자
  phone: 'phone_mm86196j',
  email: 'email_mm86njjz',
  ref: 'text_mm86vrn',         // 접수번호
  date: 'date_mm86tsxr',       // 접수일
  rating: 'numeric_mm86ct5j',  // 평균 별점
  memo: 'long_text_mm86gsaw',
  admin: 'text_mm86fvzk'       // 관리 화면
};
const PRODUCT_LABEL = { fire: '화재 알리미', water: '물감지 알리미', power: '정전 알리미', alarm: '경보 알리미', custom: '커스텀 알리미' };

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
const kst = ts => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts ? new Date(ts) : new Date());
const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
function phone(v) {
  const d = String(v || '').replace(/[^\d+]/g, '');
  if (!d) return null;
  return { phone: d.startsWith('+') ? d : (d.startsWith('0') ? '+82' + d.slice(1) : d), countryShortName: 'KR' };
}
function email(v) { const e = cut(v, 120); return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) ? { email: e, text: e } : null; }
function products(list) { const labels = (list || []).map(k => PRODUCT_LABEL[k]).filter(Boolean); return labels.length ? { labels } : null; }
function clean(o) { for (const k of Object.keys(o)) if (o[k] == null || o[k] === '') delete o[k]; return o; }

async function createItem(group, name, values) {
  if (!TOKEN()) return { ok: false, skipped: 'MONDAY_TOKEN 없음' };
  try {
    const d = await gql(
      `mutation($b:ID!,$g:String!,$n:String!,$v:JSON!){ create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$v, create_labels_if_missing:true){ id } }`,
      { b: BOARD(), g: group, n: cut(name, 250) || '(이름 없음)', v: JSON.stringify(clean(values)) }
    );
    return { ok: true, id: d.create_item.id };
  } catch (e) { console.error('[alarm→monday]', e && e.message || e); return { ok: false, error: String(e && e.message || e) }; }
}

/** 신규 계약 — 계약서 발급(날인본 회신 대기). 회신·체결 완료는 setContractKind 로 「구분」만 바꾼다 */
export function pushContract(rec) {
  const t = rec.terms || {}, c = rec.customer || {};
  const memo = [
    `계약서 발급 ${rec.ref} — 직인 날인본·사업자등록증 회신 대기 (1015@monnit.com / 온라인 회신)`,
    `SLA ${rec.slaVersion || ''} 동의 ${rec.slaAgreedAt || ''} · 제품 선택 ${t.productsChosenBy === 'customer' ? '고객' : '담당자'}`,
    t.discount ? `할인 ${Number(t.discount).toLocaleString('ko-KR')}원 (${t.discountNote || t.discountType})` : '',
    `지급 ${t.payDay || ''} · ${t.bank || ''}`,
    `수신자 ${(rec.recipients || []).map(r => `${r.name} ${r.phone}`).join(' / ')}`,
    `대표 ${c.ceo || ''} · ${c.contractType || ''} · 사업자번호 ${c.bizNo || '-'}`,
    `주소 ${c.address || ''}`,
    t.etc ? `기타: ${t.etc}` : ''
  ].filter(Boolean).join('\n');
  return createItem(GROUP.contract, `${c.name} · ${c.site}`, {
    [COL.kind]: { label: '계약서 발급' },
    [COL.company]: cut(c.name, 120), [COL.site]: cut(c.site, 200),
    [COL.products]: products(t.products),
    [COL.sites]: String(t.sites || ''), [COL.monthly]: String(t.monthly || ''),
    [COL.term]: (t.from && t.to) ? { from: t.from, to: t.to } : null,
    [COL.person]: cut(c.manager, 60), [COL.phone]: phone(c.phone), [COL.email]: email(c.email),
    [COL.ref]: rec.ref, [COL.date]: { date: kst(rec.submittedAt) },
    [COL.memo]: { text: cut(memo, 1900) }, [COL.admin]: SITE() + '/contract-admin'
  });
}

/** 기존 고객 SLA 동의 / 미동의 */
export function pushConsent(rec, client) {
  const agree = rec.decision === 'agree', s = rec.sla || {};
  const memo = agree
    ? `동의 ${s.agreedAt || ''} · ${s.effectiveFrom || ''}부터 적용 · 전문 ${s.readPct || 0}% 읽음 · 서명 ${rec.signature && rec.signature.name || ''} · 제품 선택 ${s.productsChosenBy === 'customer' ? '고객' : '담당자'}`
    : `동의하지 않음 — 기존 계약 조건 유지 (${rec.createdAt || ''})`;
  return createItem(GROUP.consent, `${client.name}${client.site ? ' · ' + client.site : ''}`, {
    [COL.kind]: { label: agree ? 'SLA 동의' : 'SLA 미동의' },
    [COL.company]: cut(client.name, 120), [COL.site]: cut(client.site, 200),
    [COL.products]: products(s.products),
    [COL.person]: cut(client.mgr, 60), [COL.email]: email(client.email),
    [COL.ref]: rec.ref, [COL.date]: { date: kst(rec.createdAt) },
    [COL.memo]: { text: cut(memo, 1900) }, [COL.admin]: SITE() + '/contract-admin'
  });
}

/** 만족도 조사 */
export function pushSurvey(rec) {
  const r = rec.ratings || {};
  const memo = [
    `전반 ${r.overall} · 정확도 ${r.accuracy} · 속도 ${r.speed} · 설치 ${r.install} · 응대 ${r.support}`,
    rec.used ? `실제 대응 경험: ${rec.used}` : '',
    `의견: ${rec.opinion || ''}`,
    rec.improve ? `개선 요청: ${rec.improve}` : '',
    rec.recipientChange ? `★ 수신자 변경 요청: ${rec.recipientChange}` : ''
  ].filter(Boolean).join('\n');
  return createItem(GROUP.survey, `${rec.company}${rec.site ? ' · ' + rec.site : ''} · ${rec.avg}점`, {
    [COL.kind]: { label: '설문 응답' },
    [COL.company]: cut(rec.company, 120), [COL.site]: cut(rec.site, 200),
    [COL.person]: cut(rec.respondent, 60), [COL.rating]: String(rec.avg || ''),
    [COL.ref]: rec.id, [COL.date]: { date: kst(rec.createdAt) },
    [COL.memo]: { text: cut(memo, 1900) }, [COL.admin]: SITE() + '/contract-admin'
  });
}

export function configured() { return { board: BOARD(), token: !!TOKEN() }; }

/** 계약 진행 단계 갱신: 계약서 발급 → 날인본 회신 → 계약 체결 */
export async function setContractKind(itemId, label) {
  if (!TOKEN() || !itemId) return { ok: false, skipped: true };
  try {
    await gql(
      `mutation($b:ID!,$i:ID!,$v:JSON!){ change_multiple_column_values(board_id:$b, item_id:$i, column_values:$v, create_labels_if_missing:true){ id } }`,
      { b: BOARD(), i: String(itemId), v: JSON.stringify({ [COL.kind]: { label } }) }
    );
    return { ok: true };
  } catch (e) { console.error('[alarm→monday]', e && e.message || e); return { ok: false, error: String(e && e.message || e) }; }
}
