/** 맞춤 제안서 — 정기 점검 (10분마다)
 *   · 발송 시각이 된 제안서 발송 (실패 시 백오프 재시도)
 *   · 생성이 멈춘 건 다시 깨우기
 *   · 발송 전 검수 알림, 후속 안내, 보관 기간 지난 개인정보 파기
 *  스케줄 함수는 30초 제한이라 22초 예산 안에서만 일하고 나머지는 다음 회차로 넘긴다.
 *  ※ 스케줄 함수는 게시(Published)된 배포에서만 돈다. 미리보기 배포에서는 /ops/proposals 의 「점검 실행」을 쓰세요. */
import { tick } from '../lib/proposal/pipeline.mjs';
import * as S from '../lib/proposal/store.mjs';
import { compactAll } from './_store.mjs';
import { sweep as sweepMisses } from '../lib/proposal/chatlog.mjs';
import { kDay } from '../lib/proposal/schedule.mjs';

export const config = { schedule: '*/10 * * * *' };

export default async () => {
  const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  const t0 = Date.now();
  let r;
  try { r = await tick({ origin }); }
  catch (e) { r = { error: e.message }; console.error('[proposal-dispatch]', e); }

  /* 리드·알림 원장 조각 합치기 (2026-09-19)
     접수는 한 건이 한 파일(조각)로 쌓인다 — 동시에 들어와도 덮이지 않게 하려고.
     조각이 많아지면 읽기가 느려지므로 여기서 잠금을 쥐고 오래된 조각만 합친다.
     최근 조각은 건드리지 않아, 합치는 동안 들어온 접수는 안전하다.
     잠금을 못 잡으면(관제에서 「점검 실행」과 겹침) 이번 회차는 건너뛴다. */
  try {
    const release = await S.lease('compact-ledgers', 60000);
    if (release) {
      try {
        r.compact = [];
        for (const store of ['leads', 'leads-test', 'ops', 'health'])
          r.compact.push(await compactAll(store, { keep: 50, budgetMs: 2500 }));
        /* 「규칙이 놓친 말」 90일 지난 것 정리 — 만들어 두고 아무 데서도 안 부르고 있었다 */
        r.sweptMisses = await sweepMisses();
        /* 접수·대화 제한 카운터는 그날만 쓴다 — 이틀 지난 것은 지운다(안 지우면 키가 영원히 쌓인다) */
        const cut = kDay(Date.now() - 2 * 86400000);
        r.sweptRate = (await S.sweepDated('chatrate/', cut)) + (await S.sweepDated('rate/', cut)) + (await S.sweepDated('day/', cut));
      } finally { await release(); }
    }
  } catch (e) { r.compactError = e.message; }
  /* 마지막 실행 기록 — 관리 화면에서 「점검이 돌고 있는지」 확인용 */
  try { await S.setJSON('meta/last-tick.json', { at: new Date().toISOString(), ms: Date.now() - t0, ...r }); } catch (e) { /* 무시 */ }
  console.log('[proposal-dispatch]', JSON.stringify(r));
};
