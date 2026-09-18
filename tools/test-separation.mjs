/* 테스트 접수가 실제 문의와 섞이지 않는지 확인한다. (2026-09-18)
 *
 *   node tools/test-separation.mjs
 *
 * 2026-09-18 에 자동 테스트가 담당자 메일함으로 가짜 접수 10여 건을 보냈다.
 * (회사명 「호스트정밀0」 · 접속 IP 127.0.0.1 · 유입 페이지 localhost:8888)
 * 여기서 보는 것 둘.
 *   ① 테스트로 판정되면 담당자 알림·발송 대장·먼데이·ops 원장 어디에도 남지 않는다
 *   ② 진짜 문의는 그 어떤 조건에도 걸리지 않는다 (오탐 0)
 */
import { isTest, isTestLead, tag, TEST_EMAIL, TEST_NAME } from '../netlify/functions/_istest.mjs';

let pass = 0, fail = 0;
const ok = (m, c, got) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + '  받음=' + JSON.stringify(got)); } };

console.log('\n[1] 테스트로 봐야 하는 것');
const T = [
  ['로컬에서 들어온 접수',            { ip: '127.0.0.1', email: 'a@b.co.kr', company: '한빛정밀' }],
  ['IPv6 루프백',                    { ip: '::1' }],
  ['유입 페이지가 localhost',         { ip: '203.0.113.9', landing: 'http://localhost:8888/promo/modbus' }],
  ['유입 페이지가 사설망',            { ip: '203.0.113.9', landing: 'http://192.168.0.12:8888/proposal' }],
  ['테스트 대표 계정',                { ip: '203.0.113.9', email: TEST_EMAIL }],
  ['대문자·공백이 섞여도',            { ip: '203.0.113.9', email: '  1004@Monnit.COM ' }],
  ['회사명에 테스트 표시',            { ip: '203.0.113.9', company: '[테스트] 호스트정밀' }],
  ['성함에 test',                     { ip: '203.0.113.9', name: 'test kim' }],
  ['관제에서 직접 찌른 점검',         { ip: '203.0.113.9', point: '/ops-probe' }],
  ['본문에 test:true',                { ip: '203.0.113.9', email: 'a@b.co.kr', flag: true }]
];
for (const [m, x] of T) ok(m, isTest(x) === true, x);

console.log('\n[2] 진짜 문의는 걸리지 않아야 하는 것 (오탐 0)');
const F = [
  ['운영 주소에서 온 일반 문의',      { ip: '203.0.113.9', landing: 'https://monnit.co.kr/promo/modbus', email: 'sykim@hanbit-dc.co.kr', company: '(주)한빛데이터센터', name: '김시열' }],
  ['monnit.co.kr 은 남의 주소',       { ip: '203.0.113.9', email: 'a@monnit.co.kr' }],
  ['monnit.com.tw 도 남의 주소',      { ip: '203.0.113.9', email: 'a@monnit.com.tw' }],
  ['Testo 는 실제 센서 회사',         { ip: '203.0.113.9', company: 'Testo Korea', email: 'a@testo.com' }],
  ['latest·contest 는 test 가 아님',   { ip: '203.0.113.9', company: 'Contest Lab', memo: 'latest 자료 부탁드립니다' }],
  ['사설망처럼 보이는 회사명',        { ip: '203.0.113.9', company: '10.0 소재', landing: 'https://monnit.co.kr/' }],
  ['본문에 test:false (검증용)',      { ip: '127.0.0.1', email: TEST_EMAIL, flag: false }],
  ['빈 값',                           {}]
];
for (const [m, x] of F) ok(m, isTest(x) === false, x);

console.log('\n[3] ops · 먼데이 판정이 갈라지지 않는다');
const { isTestLead: opsIs } = await import('../netlify/functions/ops.mjs');
const { isTestLead: mondayIs } = await import('../netlify/functions/_monday.mjs');
for (const [m, x] of [...T, ...F]) {
  const a = opsIs(x), b = mondayIs(x), c = isTestLead(x);
  ok('  같은 판정 — ' + m, a === b && b === c, { ops: a, monday: b, base: c });
}

console.log('\n[4] 표시');
ok('회사명 앞에 [테스트]', tag('호스트정밀') === '[테스트] 호스트정밀', tag('호스트정밀'));
ok('두 번 붙지 않는다', tag(tag('호스트정밀')) === '[테스트] 호스트정밀', tag(tag('호스트정밀')));
ok('대표 계정·성함', TEST_EMAIL === '1004@monnit.com' && TEST_NAME === '조한준', { TEST_EMAIL, TEST_NAME });

console.log('\n합계  통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
