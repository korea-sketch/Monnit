/** 발송 방식 결정 (순수 함수) — 서버와 프로토타입이 같이 쓴다 */
import { CFG } from './config.mjs';
import { computeDue } from './schedule.mjs';

/** 발송 방식 결정 — instant 가 기본, 판단이 불확실하면 엔지니어 확인(review)으로 돌린다.
 *  고객 화면에는 사유를 자세히 말하지 않고 「확인 후 보내드립니다」로만 알린다. 사유는 담당자에게. */
export function decidePlan(lead, intake, match, mode = CFG.mode) {
  const reasons = [];
  if (mode === 'instant') {
    const a = (intake && intake.auto) || {}, c = (intake && intake.company) || {};
    if (a.industry === 'default') reasons.push('업종을 판단할 근거가 부족');
    if ((a.notes || []).some(n => /회사 인식/.test(n))) reasons.push('고른 산업과 회사 인식이 다름');
    if (c.maybeCustomer && !match.ownCase) reasons.push('기존 고객일 수 있음(도메인·약칭 일치)');
    /* 고객이 산업(신청서) 또는 시설(파인더·백서 폼)을 직접 골랐으면 산업 플레이북으로 바로 만든다 —
       사례 일치도가 낮은 것만으로는 발송을 미루지 않는다 (예: 건설 현장 × 온도·양생) */
    if (match.confidence === 'low' && !['explicit', 'finder'].includes(a.industry) && !(match.playbook && match.playbook.segment)) reasons.push('유사 사례 일치도가 낮음');
    if (!match.playbook || match.playbook.fallback) reasons.push('산업 플레이북 없음');
  }
  const final = mode === 'instant' && reasons.length ? 'review' : mode;
  return { mode: final, requested: mode, reasons, switched: final !== mode };
}
export function dueFor(plan, now) {
  if (plan.mode === 'instant') return now + CFG.instantSeconds * 1000;
  if (plan.mode === 'review') return computeDue(now, CFG.reviewHours);
  return computeDue(now, CFG.delayHours);
}

