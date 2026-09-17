/** 자동 접수 해석 — 어느 입구(홈 솔루션 파인더 · 상담 신청 · 제안서 신청)로 들어와도
 *  「산업 · 세부 업종 · 과제 · 목표 · 규모」를 채워 같은 제안서 엔진을 돌린다.
 *
 *  우선순위
 *   산업   : 신청서에서 고른 값 → 파인더 시설 → 회사 인식 → 폼 산업군·설명 글 → 그 외 시설(general)
 *   과제   : 신청서에서 고른 값 → 파인더 고민 → 상담 폼 관심 칩 → 문의 내용 키워드 → 산업 대표 과제
 *   목표   : 신청서 → 파인더/칩 → 산업 대표 목표
 *  어느 단계에서 정해졌는지(auto.*)를 남겨 담당자 화면과 제안서 문구 강도에 쓴다.
 *
 *  무료 제안서 범위 — 과제는 「가장 고민되는 것」 CFG.maxProblems 개(기본 1)만 다룬다.
 *  그 밖에 고르거나 문의 글에 쓴 과제는 also 로 남겨 담당자가 견적 상담 때 쓴다(제안서에는 넣지 않음).
 *  순수 함수 — 외부 호출 없음. */
import { INDUSTRIES, PROBLEMS, GOALS, SCALES, FINDER_CON, FINDER_SEGMENT, fromFinder, industryByKey } from './kb.mjs';
import { detect } from './company.mjs';
import { segmentOf } from './match.mjs';
import PLAYBOOKS from './playbooks.data.mjs';
import { CFG } from './config.mjs';

/* whitepaper — 백서·제안 자료 다운로드 폼의 「우리 현장 맞춤 제안서도 받기」 (프로모션 랜딩 · /whitepaper) */
export const ENTRIES = ['proposal', 'finder', 'contact', 'widget', 'whitepaper'];

/* 문의 글에서 과제를 알아볼 입말 — PROBLEMS.kw(사례 매칭용)보다 넓게 */
const MEMO_KW = {
  downtime: ['고장', '멈춤', '정지', '다운타임', '예지보전', '진동', '베어링', '모터', '펌프', '컴프레서', '설비 이상'],
  rounds: ['순회', '순찰', '점검', '수기', '인력 부족', '야간 근무', '체크리스트'],
  wiring: ['배선', '유선', '공사비', '방폭', '케이블'],
  leak: ['누수', '물샘', '물 샘', '배관', '결로수', '스프링클러'],
  flood: ['침수', '호우', '장마', '집수정', '배수'],
  freeze: ['동파', '동결', '한파', '겨울'],
  elec_fire: ['화재', '분전반', '배전반', '과열', '과부하', '전기 안전', '열화상'],
  power_out: ['정전', '단전', '차단기', '트립', 'ups'],
  env_quality: ['온습도', '습도', '결로', '품질', '보관 환경'],
  cleanroom: ['차압', '클린룸', '무균', '실험실'],
  cold_storage: ['냉장', '냉동', '쇼케이스', '냉동기', '저온', '콜드'],
  ultracold: ['초저온', '딥프리저', '-80', '액체질소', '백신', '시료'],
  record: ['haccp', 'gmp', 'gdp', '기록', '감사', '인증', '일지', '온도 기록'],
  door_open: ['문 열림', '도어', '출입', '개폐', '보안'],
  hotspot: ['서버', '랙', '항온항습', '핫스팟', '전산실'],
  energy: ['에너지', '전기요금', '전력 사용', '절감', '냉난방', 'hvac', 'pue'],
  multi_site: ['지점', '매장', '점포', '다수 현장', '전국', '여러 곳', '원격'],
  integration: ['scada', 'bas', 'bems', 'fems', 'mes', '연동', '통합 관제', 'api', 'modbus'],
  gas: ['가스 누출', '가스 누설', '배관 압력'],
  unmanned: ['무인', '야간', '주말', '휴일', '원격 감시'],
  iaq: ['공기질', '미세먼지', '환기', 'co2', '이산화탄소'],
  tank_level: ['탱크', '수위', '레벨', '저수조'],
  structure: ['기울기', '구조물', '계측', '균열', '흙막이'],
  water_temp: ['수온', '양식', '폐사', '용존'],
  curing: ['양생', '콘크리트', '보온'],
  toxic_gas: ['유해가스', '일산화탄소', '황화수소', ' co ', '밀폐'],
  emergency: ['응급', '호출', '낙상', '고립', '비상벨'],
  occupancy: ['재실', '공실', '사용률', '회의실', '점유'],
  meter: ['검침', '계량기', '사용량'],
  legacy_alarm: ['경보', '수신반', '제어반', '알람', '접점']
};

const low = s => ' ' + String(s || '').toLowerCase() + ' ';
const uniq = a => [...new Set(a)];

export function inferProblems(text, industryKey, max = 3) {
  const t = low(text);
  if (t.trim().length < 2) return [];
  const ind = industryByKey(industryKey);
  const scored = [];
  for (const [k, kws] of Object.entries(MEMO_KW)) {
    const hits = kws.filter(w => t.includes(w));
    if (!hits.length) continue;
    const inInd = ind && ind.problems.includes(k) ? 1 : 0;
    scored.push({ k, s: hits.length + inInd * 0.5, inInd, pos: Math.min(...hits.map(w => t.indexOf(w))) });
  }
  /* 산업에 없는 과제는 두 단어 이상 걸릴 때만 */
  /* 산업에 없는 과제는 두 단어 이상 걸리거나, 산업 과제가 하나도 안 걸렸을 때만 */
  const anyIn = scored.some(x => x.inInd);
  /* 걸린 것 중 점수 상위를 고르고, 순서는 글에서 먼저 말한 것부터 — 가장 고민되는 것을 보통 먼저 쓴다 */
  return scored.filter(x => x.inInd || x.s >= 2 || !anyIn).sort((a, b) => b.s - a.s).slice(0, max).sort((a, b) => a.pos - b.pos).map(x => x.k);
}

function fromConcerns(codes, industryKey) {
  const ind = industryByKey(industryKey);
  let problems = [], goals = [];
  for (const c of codes) {
    const m = FINDER_CON[c]; if (!m) continue;
    const inList = m.problems.filter(p => ind && ind.problems.includes(p));
    problems.push(...(inList.length ? inList : m.problems).slice(0, 2));
    goals.push(...m.goals);
  }
  return { problems: uniq(problems).slice(0, 5), goals: uniq(goals).slice(0, 3) };
}

/** b: 브라우저 본문(검증 전). 반환값은 모두 사전 키로만 구성된다. */
export function resolveIntake(b = {}) {
  const entry = ENTRIES.includes(b.entry) ? b.entry : 'proposal';
  const text = [b.facility, b.memo, b.message].filter(Boolean).join(' ');
  const notes = [];
  const company = detect({ company: b.company, email: b.email, facility: b.facility, memo: [b.memo, b.message].join(' '), industryText: b.industryText });

  const finder = (b.fac || b.con) ? fromFinder({ fac: b.fac, con: b.con, scale: b.scale }) : null;

  /* 산업 */
  let industry = '', from = '';
  if (industryByKey(b.industry)) { industry = b.industry; from = 'explicit'; }
  else if (finder && finder.industry) { industry = finder.industry; from = 'finder'; }
  else if (company.industry && company.confidence >= 0.35) { industry = company.industry; from = 'detect'; }
  else { industry = 'general'; from = 'default'; }
  /* 파인더에서 「그 외」를 골랐는데 회사가 뚜렷하면 회사 쪽을 따른다 */
  if (from === 'finder' && industry === 'general' && company.industry && company.confidence >= 0.6) { industry = company.industry; from = 'detect'; }
  if (company.industry && company.industry !== industry && company.confidence >= 0.8)
    notes.push(`회사 인식은 「${industryByKey(company.industry).label}」 — 고른 산업(${industryByKey(industry).label})과 다름`);

  /* 세부 업종 */
  const pb = PLAYBOOKS[industry];
  const segOk = k => k && pb && pb.segments[k] ? k : '';
  let segment = segOk(b.segment);
  if (!segment && finder && finder.industry === industry) segment = segOk(FINDER_SEGMENT[b.fac]);
  if (!segment && company.industry === industry) segment = segOk(company.segment);
  if (!segment) { const sg = segmentOf(industry, [b.company, b.facility].join(' ')) || segmentOf(industry, text); if (sg) segment = sg.key; }
  /* 회사가 확실히 인식되면 파인더 기본 세부 업종보다 회사 쪽 */
  if (company.industry === industry && company.confidence >= 0.8 && segOk(company.segment)) segment = company.segment;

  /* 과제·목표 */
  const ind = industryByKey(industry);
  const MAX = CFG.maxProblems;
  const picked = uniq((Array.isArray(b.problems) ? b.problems : []).filter(k => PROBLEMS[k]));
  let problems = picked.slice(0, MAX), pFrom = problems.length ? 'explicit' : '';
  const also = picked.slice(MAX);
  let goals = uniq((Array.isArray(b.goals) ? b.goals : []).filter(k => GOALS[k])).slice(0, 4), gFrom = goals.length ? 'explicit' : '';
  const extra = { problems: [], goals: [] };
  if (finder && finder.problems.length) {
    /* 파인더 고민은 산업 기준으로 다시 고른다(회사 인식으로 산업이 바뀌었을 수 있음) */
    const f = fromConcerns([b.con], industry);
    extra.problems.push(...f.problems); extra.goals.push(...f.goals);
  }
  const concerns = (Array.isArray(b.concerns) ? b.concerns : []).filter(c => FINDER_CON[c]).slice(0, 5);
  if (concerns.length) {
    /* 상담 폼 관심 주제 — 첫 번째 주제가 제안서 과제, 나머지는 상담용 */
    const first = fromConcerns(concerns.slice(0, 1), industry), rest = fromConcerns(concerns.slice(1), industry);
    extra.problems.push(...first.problems); extra.goals.push(...first.goals);
    also.push(...rest.problems);
  }
  if (!problems.length && extra.problems.length) { problems = uniq(extra.problems).slice(0, MAX); pFrom = finder ? 'finder' : 'concerns'; }
  const memoP = inferProblems(text, industry);
  if (!problems.length && memoP.length) { problems = memoP.slice(0, MAX); pFrom = 'memo'; }
  also.push(...memoP.filter(k => !problems.includes(k)));
  if (!problems.length) { problems = ind.problems.slice(0, MAX); pFrom = 'default'; }
  const alsoKeys = uniq(also).filter(k => !problems.includes(k)).slice(0, 5);
  if (alsoKeys.length) notes.push('제안서 밖 관심 과제(견적 상담 때 확인): ' + alsoKeys.map(k => PROBLEMS[k].label).join(', '));
  if (!goals.length && extra.goals.length) { goals = uniq(extra.goals).slice(0, 3); gFrom = finder ? 'finder' : 'concerns'; }
  if (!goals.length) { goals = ind.goals.slice(0, 2); gFrom = 'default'; }

  let scale = SCALES.includes(b.scale) ? b.scale : (finder && finder.scale) || '';

  return {
    entry, industry, segment, problems, goals, scale,
    company, also: alsoKeys,
    auto: { industry: from, problems: pFrom, goals: gFrom, notes, also: alsoKeys }
  };
}
