/* 랜딩 페이지마다 폼 코드가 따로 있다. 어느 경로로 들어와도 원장에 남는가.
   2026-09-07: track() 에서 record() 를 빼는 바람에 자체 sendLead 를 쓰는
   /promo/alarm · /promo/proposal 의 접수가 통째로 사라졌다. 그 재발을 막는다. */
import fs from 'node:fs';
const leadJs = fs.readFileSync(process.cwd() + '/js/monnit-lead.js', 'utf8');

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };

function makeLead({ submitOk } = {}) {
  const posts = [];
  const win = {
    location: { href: 'https://monnit.co.kr/promo/alarm', pathname: '/promo/alarm', search: '', hash: '' },
    document: { referrer: '' }, navigator: {}, dataLayer: [],
    fetch: async (u, o) => { posts.push(JSON.parse(o.body)); return { ok: submitOk !== false }; }
  };
  new Function('window', 'document', leadJs)(win, { referrer: '' });
  return { L: win.MonnitLead, posts };
}
const P = { '회사명': '1004test', '이름/직급': '1004test', '전화번호': '010-0000-1004', '이메일': '1004@monnit.com' };

/* ① app.js 경로 — submit() 으로 기록, track() 은 중복 기록하지 않는다 */
{
  const { L, posts } = makeLead({ submitOk: true });
  L.build('contact', 'promo_apply', '알리미 사전신청', P);
  await L.submit(P);
  L.track('contact', { page: 'promo_apply' });
  await new Promise(r => setImmediate(r));
  ok('app.js 경로 — 원장 1건', posts.length === 1, posts.length);
}

/* ② 자체 sendLead 경로 — submit() 없이 track() 만 부른다 (alarm · proposal) */
{
  const { L, posts } = makeLead({ submitOk: true });
  L.build('contact', 'promo_apply', '알리미 사전신청', P);
  L.track('contact', { page: 'promo_apply' });
  await new Promise(r => setImmediate(r));
  ok('자체 sendLead 경로 — 원장 1건', posts.length === 1, posts.length);
  ok('  회사명 전달', posts[0] && posts[0].payload['회사명'] === '1004test', posts[0]);
}

/* ③ 명시적 record() 경로 (residence) */
{
  const { L, posts } = makeLead({ submitOk: true });
  L.build('contact', 'promo_residence', '레지던스', P);
  L.record('contact', P);
  await new Promise(r => setImmediate(r));
  ok('record() 직접 호출 — 원장 1건', posts.length === 1, posts.length);
}

/* ④ submit() 이 실패하면 track() 이 백업으로 기록한다 */
{
  const { L, posts } = makeLead({ submitOk: false });
  L.build('contact', 'promo_apply', '알리미', P);
  await L.submit(P);
  L.track('contact', { page: 'promo_apply' });
  await new Promise(r => setImmediate(r));
  ok('submit 실패 시 track 이 백업 기록', posts.length === 2, posts.length);
}

/* ⑤ 실제 랜딩 페이지가 어느 경로를 쓰는지 — 하나라도 기록 경로가 없으면 실패 */
{
  const pages = ['promo/alarm', 'promo/proposal', 'promo/residence', 'promo/consulting'];
  for (const p of pages) {
    const f = process.cwd() + '/' + p + '/index.html';
    if (!fs.existsSync(f)) { ok(p + ' — 파일 없음', false); continue; }
    const src = fs.readFileSync(f, 'utf8');
    const hasTrack = /MonnitLead\.track/.test(src) || /MonnitLead && window\.MonnitLead\.track/.test(src);
    const hasRecord = /MonnitLead\.record/.test(src);
    const hasSubmit = /MonnitLead\.submit/.test(src);
    const loadsLeadJs = /monnit-lead\.js/.test(src);
    ok(p + ' — 원장 기록 경로 있음', loadsLeadJs && (hasTrack || hasRecord || hasSubmit),
       { loadsLeadJs, hasTrack, hasRecord, hasSubmit });
  }
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
