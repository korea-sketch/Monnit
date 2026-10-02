/** ops 화면 빌더.
 *  _ops_ui.mjs 는 거대한 이스케이프 문자열이라 직접 고치기 어렵다.
 *  ui/ops-app.html, ui/ops-login.html 을 원본으로 두고 여기서 생성한다.
 *
 *  실행:  node tools/build-ops-ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const out =
  'export const LOGIN = ' + JSON.stringify(read('ui/ops-login.html')) + ';\n\n' +
  'export const APP = ' + JSON.stringify(read('ui/ops-app.html')) + ';\n';

fs.writeFileSync(path.join(root, 'netlify/functions/_ops_ui.mjs'), out);
console.log('_ops_ui.mjs 생성 완료 —', out.length, 'bytes');
