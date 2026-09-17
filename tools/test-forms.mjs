/* 자료실(제안서)·상담 신청 폼의 「전 항목 필수」 검증 시험.
 *
 * 화면에 칸을 늘리는 것만으로는 아무것도 막지 못한다. 실제로 검증이
 * 도는지, 그리고 그 검증이 PDF 발급(sendpw) 「앞」에 있는지를 본다.
 * 2026-09-07 이전에는 이메일 한 칸이 전부라 신원 없는 리드가 21건 쌓였다.
 *
 *   node tools/test-forms.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP  = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  ' + d : '')); };
const is  = (a, b, m) => (a === b ? ok(m) : bad(m, `받음=${JSON.stringify(a)} 기대=${JSON.stringify(b)}`));

/* ── app.js 에서 함수 하나를 통째로 떼어낸다 (중괄호 짝 맞추기) ───────── */
function grab(sig) {
  const i = APP.indexOf(sig);
  if (i < 0) throw new Error('함수를 찾지 못했습니다: ' + sig);
  let d = 0, started = false;
  for (let j = i; j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return APP.slice(i, j + 1); }
  }
  throw new Error('닫는 중괄호를 찾지 못했습니다: ' + sig);
}

const SRC = [
  grab('function mkCheckEmail('),
  grab('function mkCheckPhone('),
  grab('function wpClear('),
  grab('async function wpRequest('),
  grab('async function contactSubmit(')
].join('\n\n');

/* ── 아주 얇은 DOM 흉내 ──────────────────────────────────────────────── */
function harness(values, opts = {}) {
  const log = { alerts: [], sendpw: 0, sentLead: null, tracked: null, opened: [] };
  const els = {};
  const el = (id) => (els[id] = els[id] || {
    id, value: values[id] === undefined ? '' : values[id],
    selectedIndex: 0, style: {}, focus() {}, parentElement: null
  });
  Object.keys(values).forEach(el);

  const doc = {
    getElementById: (id) => (Object.prototype.hasOwnProperty.call(values, id) ? el(id) : null),
    querySelector: () => null,
    createElement: () => ({ style: {}, click() { log.opened.push('download'); }, remove() {} }),
    body: { appendChild() {} }
  };

  const MonnitValid = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(v || '').trim())
      ? { ok: true } : { ok: false, message: '이메일 형식이 아닙니다' },
    phone: (v, o) => {
      const s = String(v || '').replace(/[^0-9]/g, '');
      if (!s) return (o && o.required) ? { ok: false, message: '연락처를 입력해 주세요' } : { ok: true, value: '' };
      return s.length >= 9 ? { ok: true, value: s } : { ok: false, message: '연락처를 확인해 주세요' };
    }
  };

  const win = {
    MonnitValid,
    MonnitLead: {
      build: (t, p, subj, payload) => Object.assign({}, payload, { _type: t, 접점: p, _subject: subj }),
      track: (t, meta) => { log.tracked = { t, meta }; }
    },
    open() {}
  };

  const ctx = {
    window: win, document: doc, location: { href: 'https://monnit.co.kr/whitepaper' },
    alert: (m) => log.alerts.push(String(m)),
    MonnitValid,
    WHITEPAPERS: [{ title: '공장 설비 예지보전', dlname: 'a.pdf' }],
    PW_MAIL_TOKEN: 't', PW_MAIL_URL: '/x',
    fetch: async () => { log.sendpw++; return { status: 200, json: async () => ({ ok: true, url: '/dl' }) }; },
    sendLead: async (p) => { log.sentLead = p; return opts.sendLead === undefined ? true : opts.sendLead; },
    setTimeout: () => {},
    console
  };

  const names = Object.keys(ctx);
  const fn = new Function(...names, SRC + '\n; return { wpRequest, contactSubmit };');
  return { api: fn(...names.map(n => ctx[n])), log };
}

const DOC_FULL = {
  wpSelect: '0', wpCompany: '(주)모넷', wpName: '홍길동',
  wpEmail: 'a@b.com', wpPhone: '010-1234-5678'
};

console.log('\n자료실(제안서) 신청 — 전 항목 필수');
{
  const cases = [
    ['제안서 미선택이면 막는다',  { ...DOC_FULL, wpSelect: '' },  '제안서'],
    ['회사명이 없으면 막는다',    { ...DOC_FULL, wpCompany: '' }, '회사명'],
    ['담당자명이 없으면 막는다',  { ...DOC_FULL, wpName: '' },    '담당자명'],
    ['이메일이 없으면 막는다',    { ...DOC_FULL, wpEmail: '' },   '이메일'],
    ['이메일 형식이 틀리면 막는다', { ...DOC_FULL, wpEmail: 'abc' }, '이메일'],
    ['연락처가 없으면 막는다',    { ...DOC_FULL, wpPhone: '' },   '연락처'],
    ['연락처가 짧으면 막는다',    { ...DOC_FULL, wpPhone: '010' }, '연락처']
  ];
  for (const [name, vals, word] of cases) {
    const h = harness(vals);
    await h.api.wpRequest();
    const said = h.log.alerts.join(' | ');
    if (h.log.sendpw === 0 && said.includes(word)) ok(name);
    else bad(name, `sendpw=${h.log.sendpw} 알림="${said}"`);
  }

  /* 핵심: 검증이 PDF 발급 「앞」에 있어야 한다. 뒤에 있으면 자료는 이미 나간 뒤다. */
  const h2 = harness({ ...DOC_FULL, wpCompany: '' });
  await h2.api.wpRequest();
  is(h2.log.opened.length, 0, '막힌 신청은 PDF 가 내려가지 않는다');
  is(h2.log.sentLead, null, '막힌 신청은 원장에도 남기지 않는다');
}

console.log('\n자료실 — 다 채우면 통과하고 값이 실린다');
{
  const h = harness(DOC_FULL);
  await h.api.wpRequest();
  is(h.log.sendpw > 0, true, 'PDF 발급을 요청한다');
  const p = h.log.sentLead || {};
  is(p['회사명'],   '(주)모넷',        '회사명이 원장 payload 에 실린다');
  is(p['담당자명'], '홍길동',          '담당자명이 실린다');
  is(p['이메일'],   'a@b.com',         '이메일이 실린다');
  is(p['연락처'],   '010-1234-5678',   '연락처가 실린다');
  is(p['관심분야'], '공장 설비 예지보전', '관심분야(제안서명)가 실린다');
  is(p['접점'],     'proposal',        '접점이 proposal 로 남는다');
}

console.log('\n상담 신청(/contact) — 회사명·담당자명·연락처 필수');
{
  const CT = {
    ctCompany: '(주)모넷', ctName: '홍길동', ctEmail: 'a@b.com',
    ctPhone: '010-1234-5678', ctIndustry: '제조', ctInquiry: '견적',
    ctIndustryOther: '', ctInquiryOther: '', ctMsg: '문의합니다'
  };
  const cases = [
    ['회사명이 없으면 막는다',   { ...CT, ctCompany: '' }, '회사명'],
    ['담당자명이 없으면 막는다', { ...CT, ctName: '' },    '담당자명'],
    ['전화번호가 없으면 막는다', { ...CT, ctPhone: '' },   '전화번호']
  ];
  for (const [name, vals, word] of cases) {
    const h = harness(vals);
    await h.api.contactSubmit();
    const said = h.log.alerts.join(' | ');
    if (h.log.sentLead === null && said.includes(word)) ok(name);
    else bad(name, `보냄=${!!h.log.sentLead} 알림="${said}"`);
  }
  const h = harness(CT);
  await h.api.contactSubmit();
  const p = h.log.sentLead || {};
  is(p['회사명'],   '(주)모넷', '회사명이 따로 실린다');
  is(p['담당자명'], '홍길동',   '담당자명이 따로 실린다');
  is(p['이름/회사명'], undefined, '두 값을 한 칸에 묶던 옛 키는 사라졌다');
}

console.log('\n화면(index.html) — 칸이 실제로 있는가');
{
  const band = HTML.slice(HTML.indexOf('inline-form--doc'), HTML.indexOf('inline-form--doc') + 1400);
  for (const id of ['wpSelect', 'wpCompany', 'wpName', 'wpEmail', 'wpPhone'])
    band.includes(`id="${id}"`) ? ok(`자료실에 ${id} 칸이 있다`) : bad(`자료실에 ${id} 칸이 있다`);
  HTML.includes('id="ctCompany"') ? ok('상담 폼에 회사명 칸이 있다') : bad('상담 폼에 회사명 칸이 있다');
  /^$/.test('') && 0;
  HTML.includes('id="ctName"') ? ok('상담 폼에 담당자명 칸이 있다') : bad('상담 폼에 담당자명 칸이 있다');
}

console.log(`\n합계  통과 ${pass} · 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);
