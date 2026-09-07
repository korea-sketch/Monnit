/* 알림 메일이 어떤 경우에도 정확히 1통인가 — 브라우저와 서버를 이어서 센다 */
import fs from 'node:fs';
const F = process.cwd() + '/netlify/functions/';
const src = fs.readFileSync(process.cwd() + '/app.js', 'utf8');
const consts = src.slice(src.indexOf('const GOOGLE_FORM_URL'), src.indexOf('async function sendLead'));
const fn = src.slice(src.indexOf('async function sendLead'), src.indexOf('/* ========== DATA ========== */'));

let fail = 0;
const ok = (n, c, got) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  받음=' + JSON.stringify(got))); if (!c) fail++; };

/* 서버 쪽: _notify 만 세고 나머지는 통과시킨다 */
fs.writeFileSync(F + '_store_o.mjs', `
export async function get(s,k){return null;}
export async function set(){return true;}
export async function append(){return true;}
`);
fs.writeFileSync(F + '_reply_o.mjs',  `export async function reply(){ return {ok:true}; }`);
fs.writeFileSync(F + '_notify_o.mjs', `export async function notify(l,p,o){ globalThis.__MAILS.push({via:'server', to:(o&&o.to)||process.env.NOTIFY_TO||'0702yeom@gmail.com'}); return {ok:true}; }`);
fs.writeFileSync(F + '_monday_o.mjs', `export async function pushLead(){ return {ok:true}; }`);
fs.writeFileSync(F + '_lead_o.mjs', fs.readFileSync(F + 'lead.mjs', 'utf8')
  .replace("from './_store.mjs'", "from './_store_o.mjs'")
  .replace("from './_reply.mjs'", "from './_reply_o.mjs'")
  .replace("from './_notify.mjs'", "from './_notify_o.mjs'")
  .replace("from './_monday.mjs'", "from './_monday_o.mjs'"));
const SERVER = (await import(F + '_lead_o.mjs')).default;

/* 브라우저 쪽: MonnitLead 를 실제 파일에서 그대로 가져와 붙인다 */
const leadJs = fs.readFileSync(process.cwd() + '/js/monnit-lead.js', 'utf8');

async function scenario(name, { via, netFail, serverDown }) {
  globalThis.__MAILS = [];
  let posted = null;
  const pending = [];   /* record() 는 원장 요청을 기다리지 않는다 — 시험은 기다려야 한다 */

  const win = {
    location: { href: 'https://monnit.co.kr/promo/alarm', pathname: '/promo/alarm', search: '', hash: '' },
    document: { referrer: '' }, navigator: {}, dataLayer: []
  };
  const doc = { createElement: () => ({ style: {}, click() {} }), body: { appendChild() {} }, referrer: '' };

  /* 원장 요청은 실제 서버 함수로 넘긴다 */
  win.fetch = async (u, o) => {
    const url = String(u);
    if (url.indexOf('/api/lead') >= 0) {
      posted = JSON.parse(o.body);
      if (serverDown) throw new Error('서버 다운');
      const pr = SERVER(new Request('https://x/api/lead', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 't' }, body: o.body }));
      pending.push(pr);
      return pr;
    }
    if (netFail) throw new Error('발송처 다운');
    globalThis.__MAILS.push({ via: url.indexOf('staticforms') >= 0 ? 'staticforms' : 'web3forms', to: 'korea@monnit.com' });
    return { ok: true, json: async () => ({ success: true }) };
  };

  new Function('window', 'document', leadJs)(win, doc);

  const c = consts.replace(/const NOTIFY_VIA  = "[^"]*";/, `const NOTIFY_VIA  = "${via}";`);
  const send = new Function('fetch', 'window', 'document', 'URLSearchParams',
    'const CONTACT_EMAIL = "korea@monnit.com";\n' + c + fn + '\nreturn sendLead;')(win.fetch, win, doc, URLSearchParams);

  const payload = win.MonnitLead.build('contact', 'promo_apply', '알리미 신청 — 가나전자',
    { '회사명': '가나전자', '이름/직급': '홍길동', '전화번호': '010-1111-2222', '이메일': 'a@x.com' });
  const r = await send(payload, null);
  if (r === true) win.MonnitLead.track('contact', { page: 'promo_apply', interest: '알리미' });

  await Promise.allSettled(pending);
  await new Promise(res => setImmediate(res));

  return { name, result: r, mails: globalThis.__MAILS.slice(), notified: posted && posted.notified };
}

const a = await scenario('정상', { via: 'web3forms', netFail: false });
ok('정상 — 알림 정확히 1통', a.mails.length === 1, a.mails);
ok('  서버가 보냄', a.mails[0].via === 'server', a.mails);
ok('  받는 주소 = 0702yeom@gmail.com', a.mails[0].to === '0702yeom@gmail.com', a.mails);
ok('  브라우저는 발송처를 안 부름',
   !a.mails.some(m => m.via === 'web3forms' || m.via === 'staticforms'), a.mails);

const b = await scenario('서버 다운', { via: 'web3forms', serverDown: true });
ok('서버 다운 — 알림 정확히 1통', b.mails.length === 1, b.mails);
ok('  브라우저가 대신 보냄', b.mails[0].via === 'web3forms', b.mails);
ok('  이때는 korea@monnit.com', b.mails[0].to === 'korea@monnit.com', b.mails);

const c2 = await scenario('전부 다운', { via: 'web3forms', serverDown: true, netFail: true });
ok('전부 다운 — 0통, 화면은 mailto', c2.mails.length === 0 && c2.result === 'mailto', c2);

for (const f of ['_store_o.mjs', '_reply_o.mjs', '_notify_o.mjs', '_monday_o.mjs', '_lead_o.mjs']) fs.unlinkSync(F + f);
console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 — 정상·서버다운 모두 1통, 주소 지정됨');
process.exit(fail ? 1 : 0);
