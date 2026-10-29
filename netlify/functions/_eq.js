/** 비밀값 비교 — 길이·내용이 얼마나 맞는지 시간으로 새 나가지 않게 (2026-09-18)
 *
 *  `a !== b` 는 첫 글자가 다르면 바로 끝나고, 앞이 같을수록 오래 걸린다.
 *  그 미세한 차이를 수만 번 재면 서명을 한 글자씩 맞춰 갈 수 있다.
 *  실제로 성공시키기는 매우 어렵지만, 맞는 방법이 한 줄이라 굳이 열어 둘 이유가 없다.
 *
 *  timingSafeEqual 은 길이가 다르면 예외를 내므로, 길이부터 상수시간으로 맞춰 준다.
 */
const crypto = require('crypto');

function eq(a, b) {
  const x = Buffer.from(String(a == null ? '' : a), 'utf8');
  const y = Buffer.from(String(b == null ? '' : b), 'utf8');
  /* 길이가 다르면 내용은 볼 것도 없지만, 그래도 한 번은 비교해 시간을 맞춘다 */
  if (x.length !== y.length) { crypto.timingSafeEqual(x, x); return false; }
  return crypto.timingSafeEqual(x, y);
}

module.exports = { eq };
module.exports.eq = eq;
