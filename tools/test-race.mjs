/** 동시 요청 검사 — 「읽고-고쳐-쓰기」가 남아 있으면 여기서 걸린다 (2026-09-18)
 *
 *  두 가지를 본다.
 *    ① 같은 순간에 들어온 접수가 하나도 사라지지 않는가 (_store.append)
 *    ② 로그인을 한꺼번에 틀렸을 때 8회 제한이 실제로 걸리는가 (_loginlock)
 *
 *  둘 다 예전에는 「읽어서 → 고쳐서 → 덮어쓰기」였다. 동시에 들어오면
 *  나중 것이 먼저 것을 지운다. ①은 리드 유실, ②는 대입 공격 무방비로 이어진다.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* Netlify Blobs 대신 파일 한 개 = 키 한 개 인 가짜 저장소.
   실제 Blobs 와 같은 의미(키 단위 쓰기는 서로 독립)를 갖는다. */
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mnk-race-'));
const enc = k => Buffer.from(String(k)).toString('base64url');
const fileOf = (store, key) => path.join(ROOT, store + '__' + enc(key));

/* 실제 SDK 는 키를 URL 경로에 그대로 붙인다 — 그래서 '#'(fragment) '?'(query) 가 들어가면
   그 뒤가 잘려 엉뚱한 키에 쓴다. 가짜 저장소도 똑같이 잘라서, 그런 키는 여기서 걸리게 한다. */
function asSdkWould(key) {
  const u = new URL('/site/store/' + key, 'https://blobs.example');
  return decodeURIComponent(u.pathname).replace('/site/store/', '');
}
let urlMangled = 0;
const sdkKey = k => { const r = asSdkWould(k); if (r !== k) urlMangled++; return r; };

globalThis.__MNK_FAKE_BLOBS = {
  async get(store, key) { try { return fs.readFileSync(fileOf(store, sdkKey(key)), 'utf8'); } catch { return null; } },
  async set(store, key, text) { fs.writeFileSync(fileOf(store, sdkKey(key)), String(text)); return true; },
  async del(store, key) { try { fs.unlinkSync(fileOf(store, key)); } catch {} return true; },
  async list(store, prefix) {
    const pre = store + '__';
    return fs.readdirSync(ROOT).filter(f => f.startsWith(pre))
      .map(f => Buffer.from(f.slice(pre.length), 'base64url').toString('utf8'))
      .filter(k => k.startsWith(prefix));
  }
};

const S = await import('../netlify/functions/_store.mjs');
const LOCK = await import('../netlify/functions/_loginlock.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + '  받음=' + JSON.stringify(got)); } };

/* ── ⓪ 조각 키가 URL 경로에서 살아남는가 — '#' 을 썼다가 원장을 덮어쓸 뻔했다 ── */
{
  const k = S.shardKey('leads/2026-09.jsonl');
  ok('조각 키가 URL 에서 잘리지 않는다', asSdkWould(k) === k, { key: k, sdk: asSdkWould(k) });
  ok('  조각 키가 원본 키와 다르다', k !== 'leads/2026-09.jsonl' && k.startsWith('leads/2026-09.jsonl' + S.SHARD_SEP), k);
  ok('  구분자에 # ? 가 없다', !/[#?]/.test(S.SHARD_SEP), S.SHARD_SEP);
}

/* ── ① 같은 순간의 접수 20건 ── */
{
  const N = 20;
  await Promise.all(Array.from({ length: N }, (_, i) =>
    S.append('leads', '2026-09.jsonl', { no: i, company: '회사' + i })));
  const rows = await S.readLines('leads', '2026-09.jsonl');
  ok('동시 접수 ' + N + '건이 하나도 사라지지 않는다', rows.length === N, { 받은건수: rows.length });
  const nos = new Set(rows.map(r => r.no));
  ok('  번호가 0~' + (N - 1) + ' 전부 있다', nos.size === N, { 서로다른번호: nos.size });
}

/* ── ② 옛 방식으로 쌓인 기록도 그대로 보인다 ── */
{
  await S.set('leads', '2026-08.jsonl', JSON.stringify({ no: 1, company: '옛날건' }) + '\n' + JSON.stringify({ no: 2, company: '옛날건2' }));
  await S.append('leads', '2026-08.jsonl', { no: 3, company: '새건' });
  const rows = await S.readLines('leads', '2026-08.jsonl');
  ok('옛 기록 2건 + 새 기록 1건 = 3건', rows.length === 3, rows.map(r => r.company));
  ok('  순서가 시간순(옛것 먼저)', rows[0].no === 1 && rows[2].no === 3, rows.map(r => r.no));
}

/* ── ③ 조각이 많아지면 합칠 수 있다 ── */
{
  for (let i = 0; i < 12; i++) await S.append('ops', 'many.jsonl', { i });
  const before = await S.readLines('ops', 'many.jsonl');
  const r = await S.compact('ops', 'many.jsonl', { keep: 3 });
  const after = await S.readLines('ops', 'many.jsonl');
  ok('합쳐도 건수가 그대로', before.length === after.length && after.length === 12, { 전: before.length, 후: after.length, r });
  ok('  최근 것은 조각으로 남겨 둔다(합치는 중 유실 방지)', r.left === 3, r);
}

/* ── ④ 로그인 8회를 한꺼번에 — 제한이 걸리는가 ── */
{
  const ip = '203.0.113.9';
  await Promise.all(Array.from({ length: 8 }, () => LOCK.fail('ops', ip)));
  const f = await LOCK.recent('ops', ip);
  ok('동시에 8번 틀리면 8번으로 센다', f.n === 8, { 센횟수: f.n });
  ok('  그래서 잠긴다', f.locked === true, f);
  ok('  언제 풀리는지 알려 준다', typeof f.until === 'number' && f.until > Date.now(), new Date(f.until).toISOString());
  ok('  안내 문구에 시각이 들어간다', /뒤\(/.test(LOCK.lockText(f.until)), LOCK.lockText(f.until));
}

/* ── ⑤ 맞으면 기록이 지워진다 · 다른 사람은 영향 없다 ── */
{
  const me = '203.0.113.9', other = '203.0.113.10';
  await LOCK.fail('ops', other);
  await LOCK.clear('ops', me);
  const a = await LOCK.recent('ops', me), b = await LOCK.recent('ops', other);
  ok('로그인 성공하면 내 실패 기록이 사라진다', a.n === 0 && !a.locked, a);
  ok('  다른 IP 기록은 남아 있다', b.n === 1, b);
}

/* ── ⑥ 화면별로 따로 센다 ── */
{
  const ip = '203.0.113.11';
  for (let i = 0; i < 8; i++) await LOCK.fail('ops', ip);
  const a = await LOCK.recent('ops', ip), b = await LOCK.recent('visit', ip);
  ok('관제에서 잠겨도 방문 기록 화면은 따로', a.locked === true && b.locked === false, { ops: a.n, visit: b.n });
}

/* ── ⑦ 부하 — 조각 1,000개에서도 하나도 안 빠지고, 합친 뒤에도 같은가 ── */
{
  const N = 1000;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: N }, (_, i) => S.append('leads', 'big.jsonl', { i })));
  const rows = await S.readLines('leads', 'big.jsonl');
  const tRead = Date.now() - t0;
  ok('조각 ' + N + '개를 전부 읽는다', rows.length === N, { 읽은수: rows.length, ms: tRead });
  const all = await S.compactAll('leads', { keep: 50, budgetMs: 30000 });
  const after = await S.readLines('leads', 'big.jsonl');
  const seen = new Set(after.map(r => r.i));
  ok('  compactAll 이 합쳐도 ' + N + '건 그대로', after.length === N && seen.size === N, { 후: after.length, 서로다른: seen.size, all });
  const left = (await S.list('leads', 'big.jsonl' + S.SHARD_SEP)).length;
  ok('  최근 50개만 조각으로 남는다', left === 50, { 남은조각: left });
  ok('  다른 원장(2026-09)은 건드리지 않았다', (await S.readLines('leads', '2026-09.jsonl')).length === 20);
}

/* ── ⑧ 압축 중에 들어온 접수는 살아남는가 ── */
{
  for (let i = 0; i < 120; i++) await S.append('ops', 'live.jsonl', { i });
  /* 압축과 새 접수를 동시에 */
  const [r] = await Promise.all([
    S.compact('ops', 'live.jsonl', { keep: 20 }),
    ...Array.from({ length: 15 }, (_, j) => S.append('ops', 'live.jsonl', { i: 1000 + j }))
  ]);
  const rows = await S.readLines('ops', 'live.jsonl');
  ok('압축 중 들어온 15건 포함 135건 전부 있다', rows.length === 135, { 건수: rows.length, r });
}

ok('검사 내내 URL 에서 잘린 키가 한 번도 없었다', urlMangled === 0, { 잘린횟수: urlMangled });

fs.rmSync(ROOT, { recursive: true, force: true });
console.log('\n합계  통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
