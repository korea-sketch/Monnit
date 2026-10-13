/** 밀린 접수 자동 발송 — 건별로 한 통씩.
 *
 *  2026-09-04 부터 알림이 한 통도 나가지 않았다. 접수는 원장에 다 남아 있으므로
 *  배포 직후 그 건들을 「평소와 똑같은 형식으로 한 건에 한 통씩」 보낸다.
 *  묶어 보내면 어느 게 새 문의인지 구분이 안 되고, 응대 기록도 건별로 안 남는다.
 *
 *  메일과 함께 먼데이 보드에도 올린다 — 접수는 ops·메일·먼데이 세 곳에 남아야 한다.
 *  로그인도 버튼도 필요 없다 — 배포만 하면 15분 안에 나간다.
 *  이미 보낸 건은 id 로 기억해 두 번 보내지 않는다. 실패한 건만 다음 주기에 재시도한다.
 *  (먼데이는 자체 중복 방지가 있어 여러 번 불러도 안전하다)
 *
 *  환경변수
 *    BACKFILL_FROM   시작일 (기본 2026-09-04)
 *    BACKFILL_MAX    한 주기에 보낼 최대 통수 (기본 20) — 발송처 속도 제한 대비
 *    BACKFILL_OFF    'true' 면 아예 돌지 않는다
 */
import { get, set, readLines } from './_store.mjs';
import { notify } from './_notify.mjs';
import { pushLead } from './_monday.mjs';

const STATE = 'backfill_state.json';

/* 환경변수는 호출 시점에 읽는다.
   서버리스는 모듈을 여러 호출에 걸쳐 재사용하므로, 로드 시점에 굳혀 두면
   Netlify 에서 값을 바꿔도 함수가 새로 뜨기 전까지 반영되지 않는다. */
const cfgFrom = () => process.env.BACKFILL_FROM || '2026-09-04';
const cfgMax  = () => Number(process.env.BACKFILL_MAX || 20);

const kday = d => new Intl.DateTimeFormat('en-CA',
  { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const monthKey = d => kday(d).slice(0, 7) + '.jsonl';
const idOf = r => (r.ts || '') + '|' + (r.email || r.phone || r.company || '');

async function readState() {
  try { return JSON.parse(await get('ops', STATE) || '{}'); } catch { return {}; }
}

/** 밀린 건을 한 건에 한 통씩 보낸다. 이미 보낸 건은 건너뛴다. */
export async function runOnce() {
  if (String(process.env.BACKFILL_OFF).toLowerCase() === 'true') return { skipped: '꺼짐' };

  const FROM = cfgFrom(), MAX = cfgMax();

  const state = await readState();
  if (state.complete) return { skipped: '완료됨', at: state.at, sent: (state.sent || []).length };

  const now = new Date();
  const keys = [];
  for (let i = 0; i <= 3; i++) keys.push(monthKey(new Date(now - i * 30.5 * 864e5)));

  let rows = [];
  for (const k of [...new Set(keys)]) rows = rows.concat(await readLines('leads', k));
  rows = rows.filter(r => r && r.ts && !/^__/.test(r.company || ''));
  rows = rows.filter(r => kday(new Date(r.ts)) >= FROM);
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const already = new Set(state.sent || []);
  const todo = rows.filter(r => !already.has(idOf(r)));

  if (!todo.length) {
    await set('ops', STATE, JSON.stringify({ ...state, complete: true, at: now.toISOString(), sent: [...already] }));
    return { sent: 0, remaining: 0, complete: true };
  }

  /* 한 주기에 MAX 통까지만. 나머지는 다음 주기에 이어서 보낸다. */
  const batch = todo.slice(0, MAX);
  const sentNow = [];
  const failed = [];
  let boarded = 0;

  for (const r of batch) {
    /* 평소 문의 알림과 똑같은 형식. 밀린 건이라는 표시만 덧붙인다. */
    const lead = { ...r, memo: [r.memo, `(${kday(new Date(r.ts))} 접수 · 알림이 나가지 않아 뒤늦게 보냅니다)`].filter(Boolean).join('\n') };
    const res = await notify(lead, {});

    /* 먼데이에도 올린다. 메일이 실패해도 보드에는 남겨야 한다. */
    try { const m = await pushLead(idOf(r), r); if (m.ok && !m.skipped) boarded++; } catch { /* 무시 */ }

    if (res.ok) sentNow.push(idOf(r)); else failed.push({ id: idOf(r), error: res.error });
  }

  const sent = [...already, ...sentNow];
  const remaining = todo.length - sentNow.length;
  await set('ops', STATE, JSON.stringify({
    at: now.toISOString(), sent, complete: remaining === 0
  }));

  return { sent: sentNow.length, boarded, remaining, complete: remaining === 0, failed };
}
