/** 로그인 잠금 — 동시에 들어와도 세는 숫자가 어긋나지 않게 (2026-09-18)
 *
 *  예전 방식은 「실패 횟수 하나를 읽어 → 1 더해 → 다시 쓰기」였다.
 *  여덟 번을 한꺼번에 보내면 여덟 요청이 전부 「0번 실패」를 읽고 전부 「1」을 쓴다.
 *  세어 보면 1번, 잠금은 영영 걸리지 않는다 — 대입 공격을 못 막는다.
 *
 *  그래서 실패 한 건을 파일 하나로 남기고, 셀 때는 그 파일들을 센다.
 *  읽고 쓰는 과정이 없으니 동시에 들어와도 덮이지 않는다.
 *  (맞춤 제안서 관리 화면이 쓰던 방식과 같다 — 그쪽이 맞았다.)
 *
 *  IP 는 그대로 남기지 않고 해시로 남긴다. 실패 기록이 방문자 추적이 되면 안 된다.
 *  잠금 시간은 「마지막으로 틀린 시각」이 아니라 「가장 오래된 기록이 창을 벗어나는 시각」
 *  기준이다. 잠긴 동안 계속 눌러도 시간이 뒤로 밀리지 않는다.
 */
import crypto from 'node:crypto';
import { set, list, del } from './_store.mjs';

export const MAX_FAIL = 8;
export const WIN_MS = 15 * 60 * 1000;

const hashIp = ip => crypto.createHash('sha256')
  .update(String(ip || '?') + '|' + (process.env.OPS_PASS || process.env.PROPOSAL_SECRET || 'mnk'))
  .digest('hex').slice(0, 16);

const pre = (scope, ip) => 'loginfail/' + scope + '/' + hashIp(ip) + '/';
const atOf = (key, prefix) => Number(String(key).slice(prefix.length).split('-')[0]) || 0;

/** 지금까지 몇 번 틀렸나 · 언제 풀리나 */
export async function recent(scope, ip) {
  const p = pre(scope, ip);
  const keys = await list('ops', p).catch(() => []);
  const now = Date.now();
  const live = keys.filter(k => now - atOf(k, p) < WIN_MS);
  /* 창을 벗어난 기록은 조금씩 치운다 — 한 번에 몰아서 지우지 않는다 */
  keys.filter(k => !live.includes(k)).slice(0, 20).forEach(k => del('ops', k).catch(() => {}));
  const until = live.length ? Math.min(...live.map(k => atOf(k, p))) + WIN_MS : 0;
  return { n: live.length, until, locked: live.length >= MAX_FAIL };
}

/** 틀렸다 — 한 건 남긴다 */
export async function fail(scope, ip) {
  const p = pre(scope, ip);
  await set('ops', p + String(Date.now()).padStart(13, '0') + '-' + Math.random().toString(36).slice(2, 7), '1')
    .catch(() => {});
}

/** 맞았다 — 그 사람 기록을 지운다 */
export async function clear(scope, ip) {
  const p = pre(scope, ip);
  const keys = await list('ops', p).catch(() => []);
  for (const k of keys) await del('ops', k).catch(() => {});
}

/** 언제 풀리는지 사람 말로 — 다시 눌러도 시간이 늘어나지 않는다는 것까지 알려 준다 */
export function lockText(until) {
  const left = Math.max(0, (until || 0) - Date.now());
  const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
  const when = new Date(until || Date.now()).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
  return `로그인 시도가 많아 잠시 막았습니다. ${m > 0 ? m + '분 ' : ''}${s}초 뒤(${when})에 다시 해주세요. 다시 눌러도 시간이 늘어나지는 않습니다.`;
}
