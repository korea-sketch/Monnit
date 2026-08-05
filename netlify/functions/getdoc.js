/** 제안서 파일 전송 — sendpw 가 발급한 서명 토큰이 있어야만 응답한다.
 *  · 토큰은 10분 뒤 만료되므로 링크를 퍼뜨려도 오래 못 쓴다.
 *  · /proposals/* 직접 접근은 _redirects 에서 404 로 막혀 있다. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { lookup, SECRET } = require('./_docmap');

function sign(file, exp) {
  return crypto.createHmac('sha256', SECRET).update(file + '|' + exp).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const file = String(q.f || '');
  const exp = parseInt(q.e || '0', 10);
  const sig = String(q.s || '');

  if (!file || !exp || !sig) return { statusCode: 400, body: '잘못된 요청입니다.' };
  if (!/^[a-z0-9-]+\.pdf$/.test(file)) return { statusCode: 400, body: '잘못된 요청입니다.' };
  if (Date.now() > exp) return { statusCode: 410, body: '다운로드 링크가 만료되었습니다. 다시 신청해 주세요.' };
  if (sign(file, exp) !== sig) return { statusCode: 403, body: '유효하지 않은 링크입니다.' };

  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  let buf = null;
  for (const p of [path.join(root, 'proposals', file), path.join(process.cwd(), 'proposals', file)]) {
    try { buf = fs.readFileSync(p); break; } catch (e) { /* 다음 후보 */ }
  }
  if (!buf) return { statusCode: 404, body: '파일을 찾을 수 없습니다.' };

  const dl = String(q.n || file);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': "attachment; filename=\"" + file + "\"; filename*=UTF-8''" + encodeURIComponent(dl),
      'Cache-Control': 'no-store'
    },
    body: buf.toString('base64'),
    isBase64Encoded: true
  };
};
exports.sign = sign;
