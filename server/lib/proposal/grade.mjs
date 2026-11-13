/** 리드 등급 — 누구에게 먼저 연락할지. 점수만 보여주지 않고 「왜 이 등급인지」를 항목별로 남긴다.
 *  A 60점 이상 · B 35점 이상 · C 35점 미만 (100점 만점)
 *  순수 함수 — 서버(담당자 메일·관리 화면)와 프로토타입이 같이 쓴다. */
export const FREE_MAIL = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com', 'hotmail.com',
  'outlook.com', 'yahoo.com', 'icloud.com', 'me.com', 'live.com', 'msn.com'];

const TIMELINE = { '1개월 이내': 20, '3개월 이내': 14, '올해 안': 8, '정보 수집 단계': 0 };
const SCALE = { '6개소 이상 · 300개 이상': 15, '2~5개소 · 100~300개': 12, '1개소 · 20~100개': 8, '1개소 · 감시 포인트 20개 이하': 4, '아직 모름': 0 };

export const GRADE_MEANING = {
  A: '도입 검토가 구체적입니다 — 당일 전화 권장',
  B: '관심이 확인됩니다 — 제안서 발송 뒤 1~2일 안에 연락',
  C: '정보 수집 단계일 가능성이 큽니다 — 제안서 열람·재방문 같은 반응을 보고 연락'
};

export function grade(lead = {}, meta = {}, intake = null, match = null) {
  const dom = String(lead.email || '').split('@')[1] || '';
  const free = FREE_MAIL.includes(dom);
  const auto = (intake && intake.auto) || {};
  const company = (intake && intake.company) || {};
  const probs = (lead.problems || []).length;
  const probCounts = auto.problems !== 'default';          /* 고객이 고르지 않아 산업 기본값으로 채운 과제는 점수에 넣지 않는다 */
  const items = [
    { key: 'email', label: '회사 이메일', max: 15, pts: dom && !free ? 15 : 0,
      note: !dom ? '이메일 없음' : free ? `개인 메일(${dom})` : `회사 도메인(${dom})` },
    { key: 'phone', label: '연락처', max: 15, pts: lead.phone ? 15 : 0, note: lead.phone ? '있음' : '없음' },
    { key: 'timeline', label: '도입 시점', max: 20, pts: TIMELINE[lead.timeline] || 0, note: lead.timeline || '미입력' },
    { key: 'scale', label: '감시 규모', max: 15, pts: SCALE[lead.scale] || 0, note: lead.scale || '미입력' },
    { key: 'problems', label: '과제 구체성', max: 10, pts: probCounts ? Math.min(10, probs * 3) : 0,
      note: probCounts ? `과제 ${probs}개 선택` : '과제 미선택(산업 기본값)' },
    { key: 'memo', label: '현장 설명', max: 8, pts: String(lead.memo || '').length > 30 ? 8 : 0,
      note: String(lead.memo || '').length > 30 ? '구체적으로 작성' : lead.memo ? '짧음' : '없음' },
    { key: 'title', label: '직함', max: 4, pts: lead.title ? 4 : 0, note: lead.title || '없음' },
    { key: 'company', label: '회사 확인', max: 5, pts: company.confidence >= 0.8 ? 5 : 0,
      note: company.confidence >= 0.8 ? (match && match.ownCase ? '기존 도입 고객' : '업종까지 확인된 회사') : '확인 안 됨' },
    { key: 'dwell', label: '작성 시간', max: 5, pts: Number(meta.dwell) > 60 ? 5 : 0, note: Number(meta.dwell) > 0 ? `${Math.round(meta.dwell)}초` : '-' },
    { key: 'cases', label: '사례 열람', max: 5, pts: Number(meta.caseViews) > 0 ? 5 : 0, note: Number(meta.caseViews) > 0 ? `${meta.caseViews}회` : '없음' }
  ];
  const score = Math.min(100, items.reduce((n, x) => n + x.pts, 0));
  const g = score >= 60 ? 'A' : score >= 35 ? 'B' : 'C';

  /* 점수를 못 받은 큰 항목부터 — 「왜 이 등급인지」 */
  const missing = items.filter(x => x.pts < x.max).sort((a, b) => (b.max - b.pts) - (a.max - a.pts));
  const got = items.filter(x => x.pts > 0).map(x => `${x.label} +${x.pts}`);
  const MISS = {
    email: dom ? '개인 메일 사용' : '이메일 없음', phone: '연락처 없음',
    timeline: lead.timeline === '정보 수집 단계' ? '정보 수집 단계' : lead.timeline ? '도입 시점 먼 편' : '도입 시점 미입력',
    scale: lead.scale && lead.scale !== '아직 모름' ? '규모 작음' : '규모 미입력',
    problems: probCounts ? `과제 ${probs}개뿐` : '과제 미선택', memo: lead.memo ? '현장 설명 짧음' : '현장 설명 없음',
    title: '직함 없음', company: '회사 확인 안 됨', dwell: '작성 시간 짧음', cases: '사례 열람 없음'
  };
  const lost = missing.slice(0, 3).map(x => `${MISS[x.key]} −${x.max - x.pts}`);
  const why = g === 'A'
    ? `${score}점 — ${got.slice(0, 4).join(', ')}`
    : `${score}점 — ${lost.join(', ')}`;

  /* 다음 등급까지 — 어떤 정보 하나면 올라가는지 */
  let next = '';
  if (g !== 'A') {
    const need = (g === 'C' ? 35 : 60) - score;
    const one = missing.filter(x => x.max - x.pts >= need).map(x => x.label);
    let combo = [], sum = 0;
    for (const x of missing) { if (sum >= need) break; combo.push(x.label); sum += x.max - x.pts; }
    next = `${g === 'C' ? 'B' : 'A'}등급까지 ${need}점 — ` + (one.length > 1 ? `${one.slice(0, 3).join(', ')} 중 하나만 확인돼도 올라갑니다` : one.length ? `${one[0]}만 확인돼도 올라갑니다` : sum >= need ? `${combo.join('·')}까지 확인되면 올라갑니다` : '통화로 도입 시점·규모를 확인해 주세요');
  }
  return { score, grade: g, freeMail: free, items, why, next, meaning: GRADE_MEANING[g] };
}
