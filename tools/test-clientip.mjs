/* 방문자 IP 기록 시험 (2026-09-18)
 *
 *   node tools/test-clientip.mjs
 *
 * 2026-09-18: 한국에서 넣은 접수가 54.169.125.250(AWS 싱가포르)으로 기록됐다.
 * 엣지 함수(block-ip)를 거치면 뒤쪽 함수가 보는 x-nf-client-connection-ip 가
 * 방문자가 아니라 엣지 노드 주소가 되기 때문이다.
 * 그래서 리드 원장의 IP·IP 차단·접수 횟수 제한이 전부 헛돌았다.
 *
 * 엣지가 x-mnk-ip 로 진짜 IP 를 실어 보내고, 함수는 그것을 먼저 본다.
 */
const G = (await import('../netlify/functions/_guard.js')).default;

let pass = 0, fail = 0;
const ok = (m, c, got) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + '  받음=' + JSON.stringify(got)); } };
const H = o => new Headers(o);

console.log('\n[1] 엣지가 실어 준 진짜 IP 를 먼저 쓴다');
ok('엣지 IP 우선', G.ipOf(H({ 'x-mnk-ip': '118.235.73.191', 'x-nf-client-connection-ip': '54.169.125.250' })) === '118.235.73.191',
   G.ipOf(H({ 'x-mnk-ip': '118.235.73.191', 'x-nf-client-connection-ip': '54.169.125.250' })));

console.log('\n[2] 엣지를 거치지 않으면 예전대로');
ok('x-nf-client-connection-ip 사용', G.ipOf(H({ 'x-nf-client-connection-ip': '118.235.73.191' })) === '118.235.73.191');
ok('x-forwarded-for 사용', G.ipOf(H({ 'x-forwarded-for': '118.235.73.191, 10.0.0.1' })) === '118.235.73.191');
ok('아무것도 없으면 빈 값', G.ipOf(H({})) === '');

console.log('\n[3] 형식 방어');
ok('여러 개가 와도 첫 번째만', G.ipOf(H({ 'x-mnk-ip': '1.2.3.4, 5.6.7.8' })) === '1.2.3.4');
ok('공백 정리', G.ipOf(H({ 'x-mnk-ip': '  1.2.3.4  ' })) === '1.2.3.4');
ok('IPv6 도 그대로', G.ipOf(H({ 'x-mnk-ip': '2001:0db8:85a3:0000:0000:8a2e:0370:7334' })) === '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
ok('지나치게 길면 잘림', G.ipOf(H({ 'x-mnk-ip': 'x'.repeat(200) })).length === 45);

console.log('\n[4] 평범한 객체 헤더(구형 함수 형식)도 읽는다');
ok('객체 형식', G.ipOf({ 'x-mnk-ip': '118.235.73.191' }) === '118.235.73.191');

console.log('\n합계  통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
