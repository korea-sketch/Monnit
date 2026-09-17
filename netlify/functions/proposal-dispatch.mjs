/** 맞춤 제안서 — 정기 점검 (10분마다)
 *   · 발송 시각이 된 제안서 발송 (실패 시 백오프 재시도)
 *   · 생성이 멈춘 건 다시 깨우기
 *   · 발송 전 검수 알림, 후속 안내, 보관 기간 지난 개인정보 파기
 *  스케줄 함수는 30초 제한이라 22초 예산 안에서만 일하고 나머지는 다음 회차로 넘긴다.
 *  ※ 스케줄 함수는 게시(Published)된 배포에서만 돈다. 미리보기 배포에서는 /ops/proposals 의 「점검 실행」을 쓰세요. */
import { tick } from '../lib/proposal/pipeline.mjs';
import * as S from '../lib/proposal/store.mjs';

export const config = { schedule: '*/10 * * * *' };

export default async () => {
  const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  const t0 = Date.now();
  let r;
  try { r = await tick({ origin }); }
  catch (e) { r = { error: e.message }; console.error('[proposal-dispatch]', e); }
  /* 마지막 실행 기록 — 관리 화면에서 「점검이 돌고 있는지」 확인용 */
  try { await S.setJSON('meta/last-tick.json', { at: new Date().toISOString(), ms: Date.now() - t0, ...r }); } catch (e) { /* 무시 */ }
  console.log('[proposal-dispatch]', JSON.stringify(r));
};
