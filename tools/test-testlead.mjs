/* 내부 테스트 접수를 집계·보드에서 빼는 규칙 시험.
 *
 * 사이트를 고칠 때마다 우리 손으로 접수를 넣는다. 그게 리드로 잡히면
 * 건수·전환율·CAC 가 전부 어긋난다. 2026-09-07 에 실제로 그렇게 됐다.
 *
 * 여기서 보는 것 둘.
 *   ① 무엇을 테스트로 볼지 — 오탐(진짜 고객을 빼는 것)이 없어야 한다
 *   ② ops 와 먼데이의 판정이 같은지 — 갈라지면 「원장에선 빠졌는데
 *      보드에는 남는」 상태가 되고, 그게 제일 찾기 어렵다
 *
 *   node tools/test-testlead.mjs
 */
import { isTestLead as opsIs } from '../netlify/functions/ops.mjs';
import { isTestLead as mondayIs } from '../netlify/functions/_monday.mjs';

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  ' + d : '')); };

const CASES = [
  /* [설명, 리드, 테스트인가] */
  ['1004@monnit.com 은 테스트',            { email: '1004@monnit.com' }, true],
  ['korea@monnit.com 도 테스트',           { email: 'korea@monnit.com' }, true],
  ['대문자 섞여도 테스트',                  { email: '1004@Monnit.COM' }, true],
  ['앞뒤 공백이 있어도 테스트',             { email: '  1004@monnit.com ' }, true],
  ['관제에서 직접 찌른 점검',               { point: '/ops-probe', email: 'x@y.com' }, true],
  ['담당자명에 test',                       { name: '김유진test' }, true],
  ['회사명에 테스트',                       { company: '테스트회사' }, true],
  ['메모에 테스트',                         { memo: '테스트 접수입니다' }, true],

  ['진짜 고객 (네이버)',                    { email: 'hojymi@naver.com', company: '개인' }, false],
  ['진짜 고객 (회사 메일)',                 { email: 'svoip@dongjin.com', company: '동진첨단소재' }, false],
  ['monnit.com 이 아니라 monnit.co.kr',     { email: 'a@monnit.co.kr' }, false],
  ['도메인 중간에 monnit.com 이 있어도 아님', { email: 'a@monnit.com.tw' }, false],
  ['Testo 는 실제 센서 회사다',             { company: 'Testo Korea', email: 'a@testo.com' }, false],
  ['latest·contest 같은 단어에 걸리지 않는다', { company: 'Contest Lab', memo: 'latest 자료' }, false],
  ['빈 리드',                               {}, false],
  ['null',                                  null, false]
];

console.log('\n무엇을 테스트로 볼 것인가');
for (const [name, lead, want] of CASES) {
  const got = opsIs(lead);
  got === want ? ok(name) : bad(name, `받음=${got} 기대=${want}`);
}

console.log('\nops 와 먼데이의 판정이 같은가');
{
  let diff = 0;
  for (const [name, lead] of CASES) if (opsIs(lead) !== mondayIs(lead)) { diff++; bad('판정 불일치: ' + name); }
  if (!diff) ok(`${CASES.length}건 전부 두 곳의 판정이 같다`);
}

console.log('\n실제 원장에 있던 값으로');
{
  /* 2026-09-07 ops 원장에서 그대로 가져온 값들 */
  const real = [
    ['1004test2 (제안 가이드 테스트)', { company: '1004test2', email: '1004@monnit.com', point: 'promo_proposal' }, true],
    ['1004test (주거 랜딩 테스트)',    { company: '1004test',  email: '1004@monnit.com', point: 'promo_residence' }, true],
    ['ZZ연동점검 (먼데이 점검)',       { company: 'ZZ연동점검', email: 'probe@monnit.test', point: '/ops-probe' }, true],
    ['hojymi (자료실 실제 접수)',      { email: 'hojymi@naver.com', point: 'proposal', interest: '공장 설비 예지보전' }, false],
    ['bp@sjpmt.com (실제 접수)',       { email: 'bp@sjpmt.com', point: 'proposal' }, false],
    ['NT / Alex (실제 접수)',          { company: 'NT', name: 'Alex', email: 'deepspace2030@gmail.com' }, false]
  ];
  for (const [name, lead, want] of real) {
    const got = opsIs(lead);
    got === want ? ok(name) : bad(name, `받음=${got} 기대=${want}`);
  }
}

console.log(`\n합계  통과 ${pass} · 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);
