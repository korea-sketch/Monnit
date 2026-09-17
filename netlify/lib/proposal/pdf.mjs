/** 맞춤 제안서 — PDF 조판 (pdf-lib + Pretendard 서브셋)
 *
 *  외부 브라우저(크로미움) 없이 함수 안에서 바로 만든다 → 콜드스타트·용량 부담이 작다.
 *  글꼴: assets/fonts/Pretendard-*.ttf (한글 11,172자 + 라틴, OFL). 문서에는 실제 쓴 글자만 들어간다.
 *  구성 (v2, 약 10쪽): 표지 · 요약(+귀사 이해) · 산업 고질 문제 · 담당자별 어려움 · 공정·구역 모니터링 맵 ·
 *  선택 과제 진단 · 유사 사례 · 권장 구성 · 스마트 관리 로드맵 · 현장 진단 체크리스트·다음 단계.
 *  무료 제안서 범위(v3): 선택 과제 1개와 연결 구역·L1~L2만 자세히 쓰고, 나머지 구역·확장 단계·수량·견적은
 *  「전체 현장 견적 요청」에서 다룬다고 표시한다.
 *  내용이 길면 자동으로 쪽을 넘긴다. 플레이북이 없는 산업은 v1 구성(6쪽)으로 나간다. */
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import * as fontkitV2 from 'fontkit';

/* pdf-lib 은 fontkit 1.x 인터페이스(encodeStream)를 기대한다.
   @pdf-lib/fontkit(1.x)의 서브셋은 합성 글리프가 많은 한글 TTF 에서 글자가 빠지는 버그가 있어
   fontkit 2.x 를 쓰고 encodeStream 만 흉내 낸다. */
const fontkit = {
  create(bytes) {
    const f = fontkitV2.create(Buffer.from(bytes));
    const make = f.createSubset.bind(f);
    f.createSubset = () => {
      const sub = make();
      sub.encodeStream = () => {
        const h = {};
        const api = { on(ev, fn) { h[ev] = fn; return api; } };
        setTimeout(() => { try { const b = sub.encode(); h.data && h.data(b); h.end && h.end(); } catch (e) { h.error && h.error(e); } }, 0);
        return api;
      };
      return sub;
    };
    return f;
  }
};
import { CFG } from './config.mjs';
import { PROBLEMS, GOALS, SENSORS, AUTOMATION_KIT } from './kb.mjs';
import { fmtKST } from './schedule.mjs';
import { scopeOf } from './match.mjs';
import * as BRAND from './brand.data.mjs';

const A4 = [595.28, 841.89];
const M = 48;                       /* 좌우 여백 */
const hex = h => { const n = parseInt(h.replace('#', ''), 16); return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const C = {
  navy: hex('#0A1624'), navy2: hex('#12233A'), navy3: hex('#1B3150'), teal: hex('#2DD4BF'), blue: hex('#2B84F5'),
  amber: hex('#F59E0B'), ink: hex('#1B2433'), mute: hex('#6B778A'), soft: hex('#9FB0C8'), line: hex('#E3E8EF'),
  bg: hex('#F4F7FB'), white: rgb(1, 1, 1), tealBg: hex('#E6FBF7'), blueBg: hex('#EAF2FE'), amberBg: hex('#FEF4E2')
};

function fontDir() {
  const cands = [
    process.env.PROPOSAL_FONT_DIR,
    path.join(process.env.LAMBDA_TASK_ROOT || '', 'assets/fonts'),
    path.join(process.cwd(), 'assets/fonts'),
    (() => { try { return path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../assets/fonts'); } catch (e) { return ''; } })(),
    '/var/task/assets/fonts'
  ].filter(Boolean);
  for (const d of cands) { try { if (fs.existsSync(path.join(d, 'Pretendard-Regular.ttf'))) return d; } catch (e) { /* 다음 */ } }
  throw new Error('글꼴을 찾을 수 없습니다 (assets/fonts) — netlify.toml included_files 확인');
}
let _fontBytes = null;
function fontBytes() {
  if (!_fontBytes) {
    const d = fontDir();
    _fontBytes = { R: fs.readFileSync(path.join(d, 'Pretendard-Regular.ttf')), B: fs.readFileSync(path.join(d, 'Pretendard-Bold.ttf')), X: fs.readFileSync(path.join(d, 'Pretendard-ExtraBold.ttf')) };
  }
  return _fontBytes;
}

/* ── 조판 도구 ─────────────────────────────────────────────────── */
class Doc {
  constructor(pdf, F, job) { this.pdf = pdf; this.F = F; this.job = job; this.page = null; this.y = 0; this.n = 0; this.charset = null; }
  safe(s, font) {
    s = String(s == null ? '' : s).replace(/[\r\t]/g, ' ');
    if (!this.charset) this.charset = new Set(this.F.R.getCharacterSet());
    let out = '';
    for (const ch of s) { const cp = ch.codePointAt(0); out += (ch === '\n' || this.charset.has(cp)) ? ch : (cp > 0x2e80 && cp < 0xa000 ? '□' : ''); }
    return out;
  }
  w(s, size, font = this.F.R) { return font.widthOfTextAtSize(this.safe(s), size); }
  /* 한글은 어절 단위로 줄바꿈, 한 어절이 너무 길면 글자 단위 */
  lines(s, size, maxW, font = this.F.R) {
    const out = [];
    for (const para of this.safe(s).split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        if (!word) continue;
        const test = line + word;
        if (font.widthOfTextAtSize(test, size) <= maxW) { line = test; continue; }
        if (line.trim()) { out.push(line.trimEnd()); line = ''; }
        let chunk = word.trimStart();
        while (font.widthOfTextAtSize(chunk, size) > maxW) {
          let k = chunk.length;
          while (k > 1 && font.widthOfTextAtSize(chunk.slice(0, k), size) > maxW) k--;
          out.push(chunk.slice(0, k)); chunk = chunk.slice(k);
        }
        line = chunk;
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  text(s, x, y, { size = 10, font = this.F.R, color = C.ink, maxW = 0, lh = 1.55, align = 'left', maxLines = 0 } = {}) {
    let ls = maxW ? this.lines(s, size, maxW, font) : [this.safe(s)];
    if (maxLines && ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] = ls[maxLines - 1].replace(/.{0,2}$/, '…'); }
    ls.forEach((l, i) => {
      let xx = x;
      if (align !== 'left') { const lw = font.widthOfTextAtSize(l, size); xx = align === 'center' ? x - lw / 2 : x - lw; }
      this.page.drawText(l, { x: xx, y: y - size - i * size * lh + size * 0.12, size, font, color });
    });
    return ls.length * size * lh;
  }
  height(s, size, maxW, lh = 1.55, font = this.F.R) { return this.lines(s, size, maxW, font).length * size * lh; }
  rect(x, y, w, h, color, opt = {}) { this.page.drawRectangle({ x, y: y - h, width: w, height: h, color, borderColor: opt.border, borderWidth: opt.border ? (opt.bw || 0.8) : 0, opacity: opt.opacity, borderOpacity: opt.opacity }); }
  round(x, y, w, h, r, color, opt = {}) {
    const k = r;
    const d = `M ${k} 0 H ${w - k} Q ${w} 0 ${w} ${k} V ${h - k} Q ${w} ${h} ${w - k} ${h} H ${k} Q 0 ${h} 0 ${h - k} V ${k} Q 0 0 ${k} 0 Z`;
    /* y 는 아래쪽 기준으로 받는다. SVG 경로는 위쪽 기준·아래로 그려지므로 y + h 에서 시작 */
    this.page.drawSvgPath(d, { x, y: y + h, color, borderColor: opt.border, borderWidth: opt.border ? (opt.bw || 0.8) : undefined, opacity: opt.opacity });
  }
  line(x1, y1, x2, y2, color = C.line, t = 0.8, dash) { this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color, dashArray: dash }); }
  circle(x, y, r, color, opt = {}) { this.page.drawCircle({ x, y, size: r, color, borderColor: opt.border, borderWidth: opt.border ? 1 : 0, opacity: opt.opacity }); }

  /* 칩 한 줄(넘치면 다음 줄) — 쓴 높이를 돌려준다 */
  chips(list, x, y, maxW, { size = 7.6, bg = C.bg, color = C.ink, border, font = this.F.B, gap = 5, h = 15 } = {}) {
    let cx = x, cy = y;
    for (const lab of list) {
      const cw = this.w(lab, size, font) + 14;
      if (cx + cw > x + maxW && cx > x) { cx = x; cy -= h + 4; }
      this.round(cx, cy - h, cw, h, h / 2, bg, { border });
      this.text(lab, cx + 7, cy - (h - size) / 2 + 1.2, { size, font, color });
      cx += cw + gap;
    }
    return y - cy + h;
  }
  chipsHeight(list, maxW, { size = 7.6, font = this.F.B, gap = 5, h = 15 } = {}) {
    let cx = 0, rows = list.length ? 1 : 0;
    for (const lab of list) { const cw = this.w(lab, size, font) + 14; if (cx + cw > maxW && cx > 0) { cx = 0; rows++; } cx += cw + gap; }
    return rows ? rows * h + (rows - 1) * 4 : 0;
  }

  /* 본문 쪽 */
  newPage(title, eyebrow) {
    this.page = this.pdf.addPage(A4); this.n++;
    const [W, H] = A4;
    this.rect(0, H, W, 6, C.navy);
    this.rect(0, H - 6, 90, 3, C.teal);
    this.text(eyebrow || '', M, H - 34, { size: 8.5, font: this.F.B, color: C.blue });
    const lb = this.img.logoBlue, lw = 86;
    this.page.drawImage(lb, { x: W - M - lw, y: H - 38, width: lw, height: lw * lb.height / lb.width });
    this.text(title, M, H - 48, { size: 20, font: this.F.X, color: C.ink });
    this.line(M, H - 86, W - M, H - 86, C.line, 0.8);
    /* 바닥글 */
    const L = this.job.lead;
    this.text(`모넷코리아 맞춤 제안서 · ${this.job.no} · ${L.company} 전용`, M, 34, { size: 7.5, color: C.mute });
    this.text(String(this.n).padStart(2, '0'), W - M, 34, { size: 8, font: this.F.B, color: C.mute, align: 'right' });
    this.y = H - 104;
  }
  ensure(h, title, eyebrow) { if (this.y - h < 60) this.newPage(title + ' (계속)', eyebrow); }
  /* 각주 — 바닥글 바로 위(46pt)까지 쓴다. 그래도 안 들어가면 넘긴다 */
  note(s, title, eyebrow, { size = 7.8, gap = 8 } = {}) {
    const w = A4[0] - 2 * M, h = this.height(s, size, w, 1.5);
    if (this.y - h < 46) this.newPage((title || '') + ' (계속)', eyebrow);
    this.text(s, M, this.y, { size, color: C.mute, maxW: w, lh: 1.5 });
    this.y -= h + gap;
  }
  h2(s, eyebrow) {
    this.ensure(40, s, eyebrow);
    this.rect(M, this.y - 2, 3, 14, C.teal);
    this.text(s, M + 10, this.y, { size: 12.5, font: this.F.X });
    this.y -= 26;
  }
  para(s, { size = 10, color = C.ink, x = M, w = A4[0] - 2 * M, gap = 8, font } = {}) {
    const h = this.height(s, size, w, 1.6, font || this.F.R);
    this.ensure(h, '', '');
    this.text(s, x, this.y, { size, color, maxW: w, lh: 1.6, font: font || this.F.R });
    this.y -= h + gap;
  }
}

/* ── 표지 ──────────────────────────────────────────────────────── */
function cover(D, job, copy) {
  const [W, H] = A4; const L = job.lead, m = job.match;
  D.page = D.pdf.addPage(A4); D.n++;
  const BG = hex('#0C1220');
  D.rect(-1, H + 1, W + 2, H + 2, BG);   /* 가장자리 반 픽셀까지 덮는다(뷰어에 흰 줄 방지) */
  /* 표지 배너(한옥 지붕·봉황) — 시스템 기본값. 모든 제안서 첫 장 맨 위에 들어간다 */
  const ban = D.img.cover, bh = W * ban.height / ban.width;
  D.page.drawImage(ban, { x: -0.5, y: H - bh, width: W + 1, height: bh + 0.5 });
  const top = H - bh;
  /* 표지 기본값 — 배너 아래는 무늬 없는 단색 네이비(격자·패턴 넣지 않음) */
  D.text(`CUSTOM PROPOSAL · ${job.no}`, W - M, top - 14, { size: 8.5, font: D.F.B, color: C.soft, align: 'right' });

  let y = top - 46;
  const segLab = m.playbook && m.playbook.segment ? m.playbook.segment.label : '';
  const eyeTxt = `${m.industry.label}${segLab ? ' · ' + segLab : ''} · 맞춤 제안`;
  D.text(eyeTxt, M, y, { size: 11, font: D.F.B, color: C.teal });
  if (m.ownCase) {
    const bx = M + D.w(eyeTxt, 11, D.F.B) + 12, bt = '모넷 도입 고객 · 확장 제안', bw2 = D.w(bt, 8, D.F.B) + 16;
    D.round(bx, y - 15, bw2, 17, 8.5, C.navy2, { border: C.teal });
    D.text(bt, bx + 8, y - 3, { size: 8, font: D.F.B, color: C.teal });
  }
  y -= 30;
  y -= D.text(L.company, M, y, { size: 34, font: D.F.X, color: C.white, maxW: W - 2 * M, lh: 1.25, maxLines: 2 });
  y -= D.text(`${L.name}${L.title ? ' ' + L.title : ''}님을 위한 제안서`, M, y, { size: 26, font: D.F.X, color: C.white, maxW: W - 2 * M, lh: 1.3 });
  y -= 10;
  y -= D.text(m.industry.hero, M, y, { size: 12, color: C.soft, maxW: 380 });

  /* 일치도 타일 3개 (결과 카드 느낌) */
  y -= 36;
  const tw = (W - 2 * M - 24) / 3;
  m.top.slice(0, 3).forEach((t, i) => {
    const x = M + i * (tw + 12);
    D.round(x, y - 104, tw, 104, 12, C.navy2, { border: i === 0 ? C.teal : C.navy3, bw: 1 });
    D.text(`${i + 1}위 유사 사례`, x + 14, y - 14, { size: 8, font: D.F.B, color: i === 0 ? C.teal : C.soft });
    D.text(`${t.pct}%`, x + 14, y - 30, { size: 28, font: D.F.X, color: C.white });
    D.text(t.name, x + 14, y - 72, { size: 8.5, color: C.soft, maxW: tw - 28, maxLines: 2, lh: 1.35 });
  });
  y -= 128;
  D.text(`${CFG.brand.countries}개국 Monnit 글로벌 레퍼런스 · ${CFG.brand.publicRef} 국내 현장 데이터와 대조했습니다`, M, y, { size: 9.5, color: C.soft });
  /* 검토 과제 칩 */
  y -= 30; let cx = M;
  for (const k of m.input.problems) {
    const lab = PROBLEMS[k].label, cw = D.w(lab, 8.5, D.F.B) + 22;
    if (cx + cw > W - M) { cx = M; y -= 26; }
    if (y < 150) break;
    D.round(cx, y - 20, cw, 20, 10, C.navy2, { border: C.navy3 });
    D.text(lab, cx + 11, y - 5, { size: 8.5, font: D.F.B, color: C.white });
    cx += cw + 8;
  }

  /* 하단 */
  D.line(M, 118, W - M, 118, C.navy3, 0.8);
  const col = (lab, val, x) => { D.text(lab, x, 104, { size: 7.5, font: D.F.B, color: C.soft }); D.text(val, x, 90, { size: 10, font: D.F.B, color: C.white, maxW: 150, maxLines: 2, lh: 1.35 }); };
  col('발행일', fmtKST(Date.now(), false), M);
  col('제안사', CFG.company.legal, M + 130);
  col('문의', `${CFG.company.tel}\n${CFG.company.email}`, M + 290);
  D.text('본 문서는 입력하신 정보와 Monnit 글로벌 레퍼런스·국내 현장 데이터를 바탕으로 작성되었으며, 수신 기업 내부 검토용입니다.', M, 50, { size: 7.3, color: C.soft, maxW: W - 2 * M - 120, maxLines: 2 });
  const lw = 104, lg = D.img.logoWhite;
  D.page.drawImage(lg, { x: W - M - lw, y: 48, width: lw, height: lw * lg.height / lg.width });
}

/* ── 1. 요약 ───────────────────────────────────────────────────── */
function summaryPage(D, job, copy) {
  const [W] = A4; const L = job.lead, m = job.match;
  const EB = 'EXECUTIVE SUMMARY';
  D.newPage('제안 요약', EB);
  /* 요약 박스 */
  const sw = W - 2 * M - 36;
  const sh = D.height(copy.summary, 11, sw, 1.7) + 34;
  D.round(M, D.y - sh, W - 2 * M, sh, 12, C.bg);
  D.rect(M, D.y - 14, 3, sh - 28, C.teal);
  D.text(copy.summary, M + 20, D.y - 17, { size: 11, maxW: sw, lh: 1.7 });
  D.y -= sh + 16;

  /* 귀사 이해 — 회사·세부 업종을 인식했을 때 */
  if (copy.understanding) {
    const uw = W - 2 * M - 40;
    const uh = D.height(copy.understanding, 9.3, uw, 1.6) + 40;
    D.round(M, D.y - uh, W - 2 * M, uh, 12, C.blueBg);
    D.text(copy.understandingTitle || '귀사 현장 이해', M + 20, D.y - 13, { size: 9, font: D.F.B, color: C.blue });
    D.text(copy.understanding, M + 20, D.y - 29, { size: 9.3, maxW: uw, lh: 1.6 });
    D.y -= uh + 16;
  }

  /* 지표 타일 4개 */
  const kpi = [
    [String(m.input.problems.length), m.input.problems.length === 1 ? '집중 검토 과제' : '검토한 과제'],
    [CFG.brand.countries, '개국 Monnit 글로벌 네트워크'],
    [`${m.top[0] ? m.top[0].pct : 0}%`, '최고 일치도'],
    [`${m.sensors.length}종`, '권장 센서 구성']
  ];
  const kw = (W - 2 * M - 30) / 4;
  kpi.forEach(([n, l], i) => {
    const x = M + i * (kw + 10);
    D.round(x, D.y - 58, kw, 58, 10, i === 2 ? C.navy : C.white, { border: i === 2 ? undefined : C.line });
    D.text(n, x + kw / 2, D.y - 10, { size: 20, font: D.F.X, color: i === 2 ? C.teal : C.ink, align: 'center' });
    D.text(l, x + kw / 2, D.y - 38, { size: 8.3, color: i === 2 ? C.soft : C.mute, align: 'center' });
  });
  D.y -= 76;

  /* 입력 정보 */
  D.h2('요청하신 내용', EB);
  const rows = [
    ['회사 · 담당', `${L.company} · ${L.name}${L.title ? ' ' + L.title : ''}`],
    ['산업 · 시설', `${m.industry.label}${m.playbook && m.playbook.segment ? ' · ' + m.playbook.segment.label : ''}${L.facility ? ' · ' + L.facility : ''}${L.region ? ' (' + L.region + ')' : ''}`],
    ['규모 · 시점', `${L.scale || '미정'} · ${L.timeline || '미정'}`],
    ['가장 고민되는 문제', m.input.problems.map(k => PROBLEMS[k].label).join(', ')],
    ['원하는 효과', m.input.goals.map(k => GOALS[k].label).join(', ') + (m.defaulted ? ' (산업 대표 항목으로 보완)' : '')]
  ];
  if (L.memo) rows.push(['추가 메모', L.memo]);
  for (const [k, v] of rows) {
    const h = Math.max(20, D.height(v, 9.3, W - 2 * M - 120, 1.45) + 8);
    D.ensure(h, '제안 요약', EB);
    D.text(k, M + 4, D.y - 5, { size: 9, font: D.F.B, color: C.mute });
    D.text(v, M + 116, D.y - 5, { size: 9.3, maxW: W - 2 * M - 120, lh: 1.45 });
    D.y -= h; D.line(M, D.y + 2, W - M, D.y + 2);
  }
  D.y -= 18;

  /* 참고 수치 */
  if (m.evidence.length) {
    D.h2('유사 현장에서 공개된 수치', EB);
    const n = Math.min(4, m.evidence.length), ew = (W - 2 * M - (n - 1) * 10) / n;
    D.ensure(96, '제안 요약', EB);
    m.evidence.slice(0, n).forEach((e, i) => {
      const x = M + i * (ew + 10);
      D.round(x, D.y - 84, ew, 84, 10, e.goal ? C.tealBg : C.bg);
      D.text(e.n, x + 12, D.y - 12, { size: 18, font: D.F.X, color: C.navy, maxW: ew - 20, maxLines: 1 });
      D.text(e.l, x + 12, D.y - 38, { size: 8.5, font: D.F.B, maxW: ew - 24, maxLines: 2, lh: 1.35 });
      D.text(`${e.from}${e.global ? ' · 글로벌' : ''}`, x + 12, D.y - 66, { size: 7, color: C.mute, maxW: ew - 24, maxLines: 1 });
    });
    D.y -= 98;
    D.note('※ 공개된 사례의 결과이며, 설비 상태·운영 방식에 따라 실제 효과는 달라질 수 있습니다. 현장 진단 후 귀사 기준의 목표치를 함께 정합니다.', '제안 요약', EB);
  }
}

/* ── 2. 과제 진단 ──────────────────────────────────────────────── */
function diagnosisPage(D, job, copy) {
  const [W] = A4; const m = job.match;
  const EB = 'SITE DIAGNOSIS', T = `${m.industry.short} 현장 과제 진단`;
  D.newPage(T, EB);
  D.para(`${m.industry.label} 현장에서 공통적으로 반복되는 과제입니다. 체크된 항목이 ${job.lead.company}에서 가장 고민된다고 고르신 과제이며, 이 제안서는 이 과제를 기준으로 작성했습니다. 나머지 과제는 전체 현장 견적 요청 시 함께 진단합니다.`, { size: 9.5, color: C.mute, gap: 14 });

  /* 공통 과제 2열 */
  const cw = (W - 2 * M - 12) / 2;
  m.common.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    if (col === 0 && row > 0) D.y -= 58;
    if (col === 0) D.ensure(58, T, EB);
    const x = M + col * (cw + 12), y = D.y;
    D.round(x, y - 50, cw, 50, 9, c.picked ? C.blueBg : C.white, { border: c.picked ? C.blue : C.line });
    D.round(x + 12, y - 30, 16, 16, 4, c.picked ? C.blue : C.white, { border: c.picked ? undefined : C.line });
    if (c.picked) D.text('✓', x + 20, y - 15, { size: 10, font: D.F.X, color: C.white, align: 'center' });
    D.text(c.label, x + 36, y - 9, { size: 9.5, font: D.F.B, maxW: cw - 46, maxLines: 1 });
    D.text(PROBLEMS[c.key].desc, x + 36, y - 25, { size: 7.5, color: C.mute, maxW: cw - 46, maxLines: 2, lh: 1.35 });
  });
  D.y -= 76;

  D.h2(copy.diagnosis.length === 1 ? '선택하신 과제 진단' : '선택하신 과제별 진단', EB);
  copy.diagnosis.forEach((d, i) => {
    const tw = W - 2 * M - 64;
    const h = D.height(d.text, 9.5, tw) + 34;
    D.ensure(h + 10, T, EB);
    D.round(M, D.y - h, W - 2 * M, h, 10, C.white, { border: C.line });
    D.circle(M + 24, D.y - 22, 11, C.navy);
    D.text(String(i + 1), M + 24, D.y - 16, { size: 10, font: D.F.X, color: C.teal, align: 'center' });
    D.text(d.title, M + 46, D.y - 12, { size: 11, font: D.F.X });
    D.text(d.text, M + 46, D.y - 30, { size: 9.5, color: C.ink, maxW: tw, lh: 1.55 });
    D.y -= h + 10;
  });
}

/* ── 3. 유사 사례 ──────────────────────────────────────────────── */
function casesPage(D, job, copy) {
  const [W] = A4; const m = job.match;
  const EB = 'MATCHED REFERENCES', T = '가장 닮은 Monnit 레퍼런스';
  D.newPage(T, EB);
  D.para(`입력하신 산업·과제·목표를 Monnit 글로벌 레퍼런스와 ${CFG.brand.publicRef}을 포함한 국내 도입 현장 데이터에 대조해, 일치도가 높은 순으로 골랐습니다.`, { size: 9.5, color: C.mute, gap: 8 });
  if (m.ownCase) {
    const o = m.ownCase, iw = W - 2 * M - 32;
    const rs = o.results.slice(0, 3).map(r => `${r.n} ${r.l}`).join('  ·  ');
    const line = `사례집의 「${o.name}」는 ${job.lead.company} 관련 적용 사례라 아래 비교에서 제외했습니다.` + (rs ? `  공개 성과: ${rs}` : '');
    const oh = 22 + Math.min(2, D.lines(line, 8.2, iw).length) * 8.2 * 1.5;
    D.round(M, D.y - oh, W - 2 * M, oh, 10, C.tealBg, { border: C.teal });
    D.text('귀사 도입 사례', M + 16, D.y - 8, { size: 8, font: D.F.B, color: hex('#0F766E') });
    D.text(line, M + 16, D.y - 20, { size: 8.2, maxW: iw, maxLines: 2, lh: 1.5 });
    D.y -= oh + 8;
  }
  /* 3건 + 꼬리말이 한 쪽에 들어가도록 사례 코멘트 줄 수를 정한다 (2줄 → 1줄 → 생략) */
  const cardH = (t, lines) => {
    const iw = W - 2 * M - 32, note = (copy.caseNotes.find(c => c.key === t.key) || {}).text || '';
    const bodyH = Math.max(t.challenges.slice(0, 2).length, t.solutions.slice(0, 2).length) * 8.3 * 1.5;
    const noteH = note && lines ? Math.min(D.height(note, 8.2, iw - 20), 8.2 * 1.55 * lines) + 12 : 0;
    return 54 + 9 * 1.55 + 13 + bodyH + 8 + 46 + noteH + 12 + 8;
  };
  const tailH = (m.peers.length ? 13 : 0) + 13;
  let noteLines = m.ownCase ? 0 : 2;
  while (noteLines > 0 && D.y - m.top.reduce((n, t) => n + cardH(t, noteLines), 0) - tailH < 46) noteLines--;
  m.top.forEach((t, i) => {
    const note = (copy.caseNotes.find(c => c.key === t.key) || {}).text || '';
    const iw = W - 2 * M - 32;
    const colW = (iw - 16) / 2;
    /* 한 쪽에 3건이 들어가도록 항목마다 한 줄로 자른다 */
    const chal = t.challenges.slice(0, 2), sol = t.solutions.slice(0, 2).map(x => x.t);
    const bodyH = Math.max(chal.length, sol.length) * 8.3 * 1.5;
    const tagH = 9 * 1.55;
    const noteH = note && noteLines ? Math.min(D.height(note, 8.2, iw - 20), 8.2 * 1.55 * noteLines) + 12 : 0;
    const h = 54 + tagH + 13 + bodyH + 8 + 46 + noteH + 12;
    D.ensure(h + 8, T, EB);
    const top = D.y;
    D.round(M, top - h, W - 2 * M, h, 12, C.white, { border: i === 0 ? C.teal : C.line, bw: i === 0 ? 1.4 : 0.8 });
    /* 머리 */
    D.round(M + 16, top - 34, 44, 22, 6, i === 0 ? C.navy : C.bg);
    D.text(`${i + 1}위`, M + 38, top - 15, { size: 10, font: D.F.X, color: i === 0 ? C.teal : C.ink, align: 'center' });
    D.text(t.name, M + 70, top - 12, { size: 12.5, font: D.F.X, maxW: iw - 150, maxLines: 1 });
    D.text(`${t.industryText}${t.global ? ' · Monnit 글로벌 사례' : ' · 국내 사례'}`, M + 70, top - 30, { size: 8, color: C.mute });
    D.text(`${t.pct}%`, W - M - 16, top - 10, { size: 20, font: D.F.X, color: C.blue, align: 'right' });
    D.text('일치도', W - M - 16, top - 34, { size: 7.5, color: C.mute, align: 'right' });
    /* 일치도 막대 */
    D.round(M + 16, top - 48, iw, 5, 2.5, C.bg);
    D.round(M + 16, top - 48, Math.max(6, iw * t.pct / 100), 5, 2.5, i === 0 ? C.teal : C.blue);
    let y = top - 58;
    D.text(t.tagline, M + 16, y, { size: 9, color: C.ink, maxW: iw, maxLines: 1 });
    y -= tagH + 4;
    D.text('당시 과제', M + 16, y, { size: 8, font: D.F.B, color: C.mute });
    D.text('적용한 해결', M + 32 + colW, y, { size: 8, font: D.F.B, color: C.mute });
    y -= 13;
    chal.forEach((x, k) => D.text('· ' + x, M + 16, y - k * 8.3 * 1.5, { size: 8.3, maxW: colW, maxLines: 1 }));
    sol.forEach((x, k) => D.text('· ' + x, M + 32 + colW, y - k * 8.3 * 1.5, { size: 8.3, maxW: colW, maxLines: 1 }));
    y -= bodyH + 8;
    /* 성과 */
    const rs = t.results.slice(0, 3), rw = (iw - (rs.length - 1) * 8) / Math.max(1, rs.length);
    rs.forEach((r, k) => {
      const x = M + 16 + k * (rw + 8);
      D.round(x, y - 38, rw, 38, 8, C.bg);
      D.text(r.n, x + 10, y - 5, { size: 12.5, font: D.F.X, color: C.navy, maxW: rw - 16, maxLines: 1 });
      D.text(r.l, x + 10, y - 23, { size: 7.4, color: C.mute, maxW: rw - 16, maxLines: 1 });
    });
    y -= 46;
    if (noteH) {
      D.round(M + 16, y - noteH, iw, noteH, 8, C.amberBg);
      D.text(note, M + 26, y - 6, { size: 8.2, maxW: iw - 20, color: C.ink, maxLines: noteLines });
    }
    D.y = top - h - 8;
  });
  /* 꼬리말 두 줄 — 바닥글 바로 위까지 쓴다(빈 쪽이 생기지 않게) */
  const tail = [];
  if (m.peers.length) tail.push([`같은 업종 도입 고객: ${m.peers.map(p => p.name).join(', ')}`, D.F.B, C.ink]);
  tail.push(['※ 글로벌 사례는 Monnit 본사가 공개한 레퍼런스입니다. 사례 수치는 해당 현장의 공개 결과로, 귀사 적용 시 결과를 보장하지 않습니다.', D.F.R, C.mute]);
  if (D.y - tail.length * 13 < 44) D.newPage(T + ' (계속)', EB);
  for (const [txt, f, col] of tail) { D.text(txt, M, D.y - 2, { size: 7.8, font: f, color: col, maxW: W - 2 * M, maxLines: 1 }); D.y -= 13; }
}

/* ── 4. 제안 구성 ──────────────────────────────────────────────── */
function designPage(D, job, copy) {
  const [W] = A4; const m = job.match;
  const EB = 'PROPOSED CONFIGURATION', T = '권장 시스템 구성';
  D.newPage(T, EB);

  /* 구성도: 센서 → 게이트웨이 → iMonnit → 알림/연동 */
  const y0 = D.y, bh = 92;
  D.round(M, y0 - bh - 20, W - 2 * M, bh + 20, 12, C.navy);
  const boxes = [
    ['무선 센서', `${m.sensors.length}종 · 배선 없음`],
    ['ALTA 게이트웨이', '940MHz 수집'],
    ['iMonnit 관제', '대시보드 · 이력'],
    ['알림 · 연동', '문자·메일·앱 / BAS']
  ];
  const bw = (W - 2 * M - 40 - 3 * 22) / 4;
  boxes.forEach(([a, b], i) => {
    const x = M + 20 + i * (bw + 22), y = y0 - 20;
    D.round(x, y - 60, bw, 60, 9, C.navy2, { border: i === 2 ? C.teal : C.navy3 });
    D.text(a, x + bw / 2, y - 14, { size: 10, font: D.F.X, color: C.white, align: 'center' });
    D.text(b, x + bw / 2, y - 34, { size: 7.8, color: C.soft, align: 'center' });
    if (i < 3) { D.line(x + bw + 3, y - 30, x + bw + 19, y - 30, C.teal, 1.2); D.text('›', x + bw + 16, y - 24, { size: 11, font: D.F.X, color: C.teal }); }
  });
  D.y = y0 - bh - 40;

  D.h2('권장 센서', EB);
  const cols = [M, M + 150, M + 330];
  D.rect(M, D.y, W - 2 * M, 22, C.bg);
  ['센서 종류', '역할', '대응 과제'].forEach((h, i) => D.text(h, cols[i] + 8, D.y - 6, { size: 8.5, font: D.F.B, color: C.mute }));
  D.y -= 22;
  for (const s of m.sensors.slice(0, 6)) {
    const forTxt = s.for.join(', ');
    const h = Math.max(D.height(s.use, 8.8, 170), D.height(forTxt, 8.8, W - M - cols[2] - 12), D.height(s.name, 9.5, 136, 1.55, D.F.B)) + 12;
    D.ensure(h, T, EB);
    D.text(s.name, cols[0] + 8, D.y - 6, { size: 9.5, font: D.F.B, maxW: 136 });
    D.text(s.use, cols[1] + 8, D.y - 6, { size: 8.8, maxW: 170 });
    D.text(forTxt, cols[2] + 8, D.y - 6, { size: 8.8, color: C.blue, maxW: W - M - cols[2] - 12 });
    D.y -= h; D.line(M, D.y, W - M, D.y);
  }
  D.y -= 16;

  D.h2('플랫폼 · 연동', EB);
  for (const p of m.platform) {
    D.ensure(24, T, EB);
    D.text(p.name, M + 8, D.y, { size: 9.5, font: D.F.B });
    const h = D.text(p.use, M + 190, D.y, { size: 9, color: C.ink, maxW: W - 2 * M - 196 });
    D.y -= Math.max(18, h + 4);
  }
  D.y -= 8;

  D.h2('도입 단계', EB);
  const sw = (W - 2 * M - 20) / 3;
  const sh = Math.max(...copy.steps.map(s => D.height(s.text, 8.8, sw - 24))) + 46;
  D.ensure(sh, T, EB);
  copy.steps.forEach((s, i) => {
    const x = M + i * (sw + 10);
    D.round(x, D.y - sh, sw, sh, 10, i === 1 ? C.tealBg : C.bg);
    D.text(s.title, x + 12, D.y - 12, { size: 10, font: D.F.X, maxW: sw - 24, maxLines: 1 });
    D.text(s.text, x + 12, D.y - 32, { size: 8.8, maxW: sw - 24 });
  });
  D.y -= sh + 14;
  D.note('※ 센서 모델·수량·설치 위치와 비용은 현장 확인 후 확정합니다. 통신 거리는 건물 구조에 따라 달라 현장 테스트로 확인합니다.', T, EB);
}

/* ── 5. 다음 단계 ──────────────────────────────────────────────── */
function nextPage(D, job, copy) {
  const [W] = A4; const m = job.match;
  const EB = 'NEXT STEPS', T = '다음 단계';
  D.newPage(T, EB);
  if (m.playbook && !m.playbook.fallback) checklistBlock(D, job);
  if (m.playbook && !m.playbook.fallback) D.h2('진행 순서', EB);
  copy.next.forEach((s, i) => {
    D.ensure(40, T, EB);
    D.circle(M + 12, D.y - 10, 10, C.blue);
    D.text(String(i + 1), M + 12, D.y - 4, { size: 9.5, font: D.F.X, color: C.white, align: 'center' });
    const h = D.text(s, M + 32, D.y - 3, { size: 9.8, font: D.F.B, maxW: W - 2 * M - 40 });
    D.y -= Math.max(26, h + 10);
  });
  D.y -= 6;

  /* 범위 · CTA 박스 — 무료 제안서는 과제 하나 기준. 전체 현장은 견적 요청으로 */
  const v2 = m.playbook && !m.playbook.fallback;
  const sc = scopeOf(m);
  const iw = W - 2 * M - 48;
  const probTxt = sc.problems.map(x => `「${x}」`).join(', ');
  const body = `이 제안서는 ${probTxt} 기준으로 작성했습니다. 다른 과제${sc.others.length ? `(${sc.others.slice(0, 3).join(', ')} 등)` : ''}와 현장 전체의 구역별 센서 수량·설치 위치·시스템 연동·견적은 견적 요청을 남겨 주시면 담당 엔지니어가 설비 목록이나 도면을 받아 정리해 드립니다.`;
  const bh = 126 + D.height(body, 9.3, iw, 1.6);
  D.ensure(bh + 20, T, EB);
  D.round(M, D.y - bh, W - 2 * M, bh, 14, C.navy);
  D.text('전체 현장 견적 요청', M + 24, D.y - 22, { size: 9, font: D.F.B, color: C.teal });
  D.text('현장 전체 구성과 견적은 견적 요청으로 받아 보세요', M + 24, D.y - 40, { size: 15, font: D.F.X, color: C.white, maxW: iw, maxLines: 1 });
  D.text(body, M + 24, D.y - 66, { size: 9.3, color: C.soft, maxW: iw, lh: 1.6 });
  D.text(quoteLink(job), M + 24, D.y - bh + 44, { size: 12, font: D.F.X, color: C.white });
  D.text(`현장 진단 예약 ${CFG.site.replace(/^https?:\/\//, '')}/visit   ·   T. ${CFG.company.tel}   ·   ${CFG.company.email}`, M + 24, D.y - bh + 24, { size: 9, font: D.F.B, color: C.teal, maxW: iw, maxLines: 1 });
  D.y -= bh + 20;

  if (!v2) {
    D.h2('함께 보시면 좋은 자료', EB);
    D.para(`· ${m.industry.label} 분야 모넷 제안서 — 회신 주시면 PDF로 보내드립니다.`, { size: 9.5, gap: 4 });
    D.para('· 모넷 설치 사례 모음 — monnit.co.kr 고객 사례', { size: 9.5, gap: 4 });
    D.para('· iMonnit 관제 화면 체험 — 현장 진단 시 데모 계정을 드립니다.', { size: 9.5, gap: 18 });
  }

  D.note([
    (job.plan && job.plan.mode === 'instant'
      ? `본 제안서는 ${fmtKST(Date.parse(job.createdAt), false)}에 입력하신 정보를 Monnit 글로벌 레퍼런스·국내 현장 데이터·산업 플레이북과 자동 대조해 작성했으며, 담당 엔지니어가 내용을 확인한 뒤 연락드립니다.`
      : `본 제안서는 ${fmtKST(Date.parse(job.createdAt), false)}에 입력하신 정보를 Monnit 글로벌 레퍼런스·국내 현장 데이터와 자동 대조한 뒤 담당 엔지니어가 검수해 작성했습니다.`),
    '사례 수치는 각 현장의 공개 결과이며 귀사 적용 시 효과를 약속하지 않습니다. 정확한 구성·비용은 현장 확인 후 확정됩니다.',
    `모넷코리아 무선 센서는 국내 940MHz 대역을 사용합니다. 입력하신 개인정보는 제안서 발송과 상담 목적으로만 쓰이며, ${Math.round(CFG.retainDays / 30)}개월 후 파기됩니다.`
  ].join('\n'), T, EB, { size: 7.8 });
}

/* ── v2. 산업 고질 문제 ─────────────────────────────────────────── */
const segName = m => (m.playbook && m.playbook.segment ? m.playbook.segment.label : m.industry.label);
function insightPage(D, job, copy) {
  const [W] = A4; const m = job.match, pb = m.playbook;
  const EB = 'INDUSTRY INSIGHT', T = `${segName(m)} 현장의 고질적인 문제`;
  D.newPage(T, EB);
  /* 맥락 */
  const ctx = [pb.context, pb.segmentContext].filter(Boolean).join('\n');
  const cw = W - 2 * M - 36;
  const ch = D.height(ctx, 9.8, cw, 1.65) + 28;
  D.round(M, D.y - ch, W - 2 * M, ch, 12, C.navy);
  D.rect(M + 16, D.y - 14, 3, ch - 28, C.teal);
  D.text(ctx, M + 28, D.y - 14, { size: 9.8, color: C.white, maxW: cw - 10, lh: 1.65 });
  D.y -= ch + 16;
  D.para(`모넷이 이 산업 현장에서 반복해서 보는 문제입니다. 파란 테두리는 ${job.lead.company}에서 말씀하신 과제와 직접 연결되는 항목입니다.`, { size: 9, color: C.mute, gap: 10 });

  pb.chronic.forEach((c, i) => {
    const iw = W - 2 * M - 70;
    const labs = c.problems.map(k => PROBLEMS[k] && PROBLEMS[k].label).filter(Boolean).slice(0, 3);
    const h = 26 + D.height(c.detail, 9, iw, 1.55) + (c.impact ? 20 : 0) + D.chipsHeight(labs, iw) + 16;
    D.ensure(h + 10, T, EB);
    D.round(M, D.y - h, W - 2 * M, h, 12, c.focus ? C.blueBg : C.white, { border: c.focus ? C.blue : C.line, bw: c.focus ? 1.2 : 0.8 });
    D.text(String(i + 1).padStart(2, '0'), M + 18, D.y - 14, { size: 18, font: D.F.X, color: c.focus ? C.blue : C.soft });
    let y = D.y - 14;
    D.text(c.title, M + 58, y, { size: 12, font: D.F.X, maxW: iw - 110, maxLines: 1 });
    if (c.focus) D.text('선택 과제와 연결', W - M - 16, y + 1, { size: 7.5, font: D.F.B, color: C.blue, align: 'right' });
    if (c.seg) D.text('세부 업종', W - M - 16 - (c.focus ? 76 : 0), y + 1, { size: 7.5, font: D.F.B, color: C.mute, align: 'right' });
    y -= 22;
    y -= D.text(c.detail, M + 58, y, { size: 9, maxW: iw, lh: 1.55 });
    if (c.impact) { y -= 4; D.text('놓치면  ' + c.impact, M + 58, y, { size: 8.3, font: D.F.B, color: hex('#B45309'), maxW: iw, maxLines: 1 }); y -= 16; }
    y -= 4;
    D.chips(labs, M + 58, y, iw, { bg: c.focus ? C.white : C.bg, color: C.ink });
    D.y -= h + 10;
  });
}

/* ── v2. 담당자별 어려움 ─────────────────────────────────────────── */
function personaPage(D, job, copy) {
  const [W] = A4; const m = job.match, pb = m.playbook;
  if (!pb.personas.length) return;
  const EB = 'STAKEHOLDER PAIN POINTS', T = '담당자별 어려움';
  D.newPage('담당자들이 겪는 어려움', EB);
  D.para(`${segName(m)} 현장에서 조직별로 자주 듣는 어려움과, 그중 모넷 무선 센서·알림으로 줄일 수 있는 부분입니다. 사람의 판단이 필요한 일까지 대신한다는 뜻은 아닙니다.`, { size: 9, color: C.mute, gap: 12 });
  const gap = 12, cw = (W - 2 * M - gap) / 2, iw = cw - 28;
  const cardH = p => 34 + 14 + p.pains.reduce((n, x) => n + D.height('· ' + x, 8.6, iw, 1.5), 0) + 10 + 18 + D.height(p.monnit, 8.6, iw - 16, 1.5) + 20 + 10;
  for (let i = 0; i < pb.personas.length; i += 2) {
    const row = pb.personas.slice(i, i + 2);
    const h = Math.max(...row.map(cardH));
    D.ensure(h + 12, T, EB);
    const top = D.y;
    row.forEach((p, k) => {
      const x = M + k * (cw + gap);
      D.round(x, top - h, cw, h, 12, C.white, { border: p.focus ? C.blue : C.line, bw: p.focus ? 1.2 : 0.8 });
      D.round(x + 0.6, top - 30, cw - 1.2, 29.4, 11.4, p.focus ? C.blueBg : C.bg);
      D.rect(x + 0.6, top - 16, cw - 1.2, 14, p.focus ? C.blueBg : C.bg);
      D.text(p.role, x + 14, top - 9, { size: 10.2, font: D.F.X, maxW: cw - (p.focus ? 90 : 28), maxLines: 1 });
      if (p.focus) D.text('선택 과제 연결', x + cw - 12, top - 11, { size: 7, font: D.F.B, color: C.blue, align: 'right' });
      let y = top - 40;
      D.text('현장에서 겪는 어려움', x + 14, y, { size: 7.8, font: D.F.B, color: C.mute });
      y -= 14;
      for (const t of p.pains) y -= D.text('· ' + t, x + 14, y, { size: 8.6, maxW: iw, lh: 1.5 });
      y -= 10;
      const mh = D.height(p.monnit, 8.6, iw - 16, 1.5) + 30;
      D.round(x + 10, y - mh, cw - 20, mh, 9, C.tealBg);
      D.text('모넷으로 대처할 수 있는 부분', x + 20, y - 8, { size: 7.8, font: D.F.B, color: hex('#0F766E') });
      D.text(p.monnit, x + 20, y - 24, { size: 8.6, maxW: iw - 16, lh: 1.5 });
    });
    D.y = top - h - 12;
  }
}

/* ── v2. 공정·구역별 모니터링 맵 ─────────────────────────────────── */
function zonePage(D, job, copy) {
  const [W] = A4; const m = job.match, pb = m.playbook;
  if (!pb.zones.length) return;
  const EB = 'PROCESS & ZONE MAP', T = '공정·구역별 모니터링 맵';
  D.newPage(T, EB);
  if (copy.zoneFocus) D.para(copy.zoneFocus, { size: 9.5, gap: 12 });
  const cols = [M, M + 96, M + 262, M + 380];
  const cw = [92, 160, 112, W - M - cols[3] - 6];
  const head = () => {
    D.rect(M, D.y, W - 2 * M, 22, C.navy);
    ['공정·구역', '관리 포인트·위험', '모넷 센서', '있으면 좋은 것'].forEach((h, i) => D.text(h, cols[i] + 8, D.y - 6, { size: 8.3, font: D.F.B, color: C.white }));
    D.y -= 22;
  };
  head();
  const sc = scopeOf(m);
  const openZ = pb.zones.filter(z => sc.openZones.includes(z.zone));
  const lockedZ = pb.zones.filter(z => !sc.openZones.includes(z.zone));
  openZ.forEach((z, i) => {
    const sens = z.sensors.map(k => SENSORS[k] && SENSORS[k].name).filter(Boolean);
    const sensTxt = sens.join('\n');
    const h = Math.max(
      D.height(z.zone, 9, cw[0] - 10, 1.45, D.F.B),
      D.height(z.risk, 8.2, cw[1] - 10, 1.5),
      D.height(sensTxt, 7.8, cw[2] - 10, 1.5),
      D.height(z.nice, 8.2, cw[3] - 10, 1.5)
    ) + 16;
    if (D.y - h < 70) { D.newPage(T + ' (계속)', EB); head(); }
    if (z.focus) D.rect(M, D.y, W - 2 * M, h, C.blueBg);
    else if (i % 2) D.rect(M, D.y, W - 2 * M, h, hex('#FAFBFD'));
    if (z.focus) D.rect(M, D.y, 3, h, C.blue);
    D.text(z.zone, cols[0] + 8, D.y - 8, { size: 9, font: D.F.B, maxW: cw[0] - 10, lh: 1.45 });
    D.text(z.focus ? '선택 과제' : '먼저 살필 구역', cols[0] + 8, D.y - h + 14, { size: 6.8, font: D.F.B, color: z.focus ? C.blue : C.mute });
    D.text(z.risk, cols[1] + 8, D.y - 8, { size: 8.2, maxW: cw[1] - 10, lh: 1.5 });
    D.text(sensTxt, cols[2] + 8, D.y - 8, { size: 7.8, color: hex('#1D4ED8'), maxW: cw[2] - 10, lh: 1.5 });
    D.text(z.nice, cols[3] + 8, D.y - 8, { size: 8.2, color: C.mute, maxW: cw[3] - 10, lh: 1.5 });
    D.y -= h; D.line(M, D.y, W - M, D.y);
  });
  /* 나머지 구역 — 이름만 보여주고 전체 현장 견적에서 다룬다 */
  if (lockedZ.length) {
    const rh = 22;
    for (const z of lockedZ) {
      if (D.y - rh < 70) { D.newPage(T + ' (계속)', EB); head(); }
      D.rect(M, D.y, W - 2 * M, rh, C.bg);
      D.text(z.zone, cols[0] + 8, D.y - 6, { size: 8.6, font: D.F.B, color: C.mute, maxW: cw[0] + cw[1] - 10, maxLines: 1 });
      D.text('관리 포인트·센서 구성 — 전체 현장 견적 요청 시 정리', cols[1] + 8, D.y - 7, { size: 7.8, color: C.mute, maxW: W - M - cols[1] - 16, maxLines: 1 });
      D.y -= rh; D.line(M, D.y, W - M, D.y, hex('#FFFFFF'), 1.2);
    }
  }
  D.y -= 18;
  const lockLines = [];
  if (lockedZ.length) lockLines.push(`위 회색 ${lockedZ.length}개 구역의 관리 포인트·센서 구성`);
  if (pb.niceToHave.length) lockLines.push(`한 단계 더 나아간 모니터링 제안 ${pb.niceToHave.length}가지`);
  if (sc.others.length) lockLines.push(`다른 과제(${sc.others.slice(0, 4).join(', ')}${sc.others.length > 4 ? ' 등' : ''})에 대한 진단`);
  if (lockLines.length) scopeBox(D, job, '이 제안서는 선택하신 과제와 연결된 구역만 자세히 다룹니다', lockLines, T, EB);
  D.note('※ 구역 이름과 순서는 일반적인 공정 흐름 기준입니다. 실제 배치는 현장 진단에서 도면과 함께 확정합니다.', T, EB);
}

/* 범위 안내 상자 — 「전체 현장 견적 요청에서 함께 정리하는 것」 */
function scopeBox(D, job, title, lines, T, EB) {
  const [W] = A4;
  const iw = W - 2 * M - 40;
  const body = lines.map(x => '· ' + x);
  const h = 44 + body.reduce((n, x) => n + D.height(x, 8.8, iw) + 2, 0) + 26;
  D.ensure(h + 10, T, EB);
  D.round(M, D.y - h, W - 2 * M, h, 12, C.white, { border: C.blue, bw: 1 });
  D.text('전체 현장 견적 요청 시 함께 정리', M + 20, D.y - 13, { size: 8, font: D.F.B, color: C.blue });
  D.text(title, M + 20, D.y - 27, { size: 10.5, font: D.F.X, maxW: iw, maxLines: 1 });
  let y = D.y - 46;
  for (const x of body) y -= D.text(x, M + 20, y, { size: 8.8, maxW: iw }) + 2;
  D.text(`견적 요청  ${quoteLink(job)}   ·   T. ${CFG.company.tel}`, M + 20, D.y - h + 18, { size: 8.6, font: D.F.B, color: C.blue, maxW: iw, maxLines: 1 });
  D.y -= h + 12;
}
const quoteLink = job => `${CFG.site.replace(/^https?:\/\//, '')}/contact?quote=${job.no}`;

/* ── v2. 스마트 관리 로드맵 ─────────────────────────────────────── */
function roadmapPage(D, job, copy) {
  const [W] = A4; const m = job.match, pb = m.playbook;
  if (pb.automation.length !== 5) return;
  const EB = 'SMART OPERATIONS ROADMAP', T = '센서 이후 — 스마트 관리 로드맵';
  D.newPage(T, EB);
  if (copy.roadmapIntro) D.para(copy.roadmapIntro, { size: 9.5, gap: 14 });
  const iw = W - 2 * M - 128;
  pb.automation.forEach((a, i) => {
    if (i >= 2) {   /* 확장 단계 — 제목만. 구체적인 연동·자동화 설계는 전체 현장 견적에서 */
      const h = 34;
      D.ensure(h + 8, T, EB);
      const top = D.y, bw = 40 + i * 12;
      D.round(M, top - h, bw, h, 10, C.navy2, { opacity: 0.92 });
      D.text(`L${a.level}`, M + bw / 2, top - 10, { size: 13, font: D.F.X, color: C.white, align: 'center' });
      if (i < 4) D.line(M + bw / 2, top - h, M + bw / 2, top - h - 8, C.soft, 1, [2, 2]);
      const x = M + 108;
      D.round(x - 12, top - h, W - M - x + 12, h, 10, C.bg);
      D.text(a.title, x, top - 11, { size: 10.5, font: D.F.X, maxW: W - M - x - 170, maxLines: 1 });
      D.text('전체 현장 설계 시 구체화', W - M - 12, top - 12, { size: 7.6, font: D.F.B, color: C.mute, align: 'right' });
      D.y = top - h - 8;
      return;
    }
    const kits = a.kit.map(k => AUTOMATION_KIT[k] && AUTOMATION_KIT[k].name).filter(Boolean);
    const kitW = kits.reduce((n, k) => n + D.w(k, 7.2, D.F.B) + 19, 0);
    const h = 30 + D.height(a.what, 8.8, iw, 1.5) + D.height('예) ' + a.example, 8.4, iw - 16) + 18;
    D.ensure(h + 8, T, EB);
    const top = D.y;
    const start = i < 2;
    /* 왼쪽 계단 */
    const bw = 40 + i * 12;
    D.round(M, top - h, bw, h, 10, start ? C.navy : C.navy2, { opacity: start ? 1 : 0.92 });
    D.text(`L${a.level}`, M + bw / 2, top - 14, { size: 15, font: D.F.X, color: start ? C.teal : C.white, align: 'center' });
    D.text(start ? '우선 적용' : '확장', M + bw / 2, top - 36, { size: 6.8, font: D.F.B, color: start ? C.teal : C.soft, align: 'center' });
    if (i < 4) D.line(M + bw / 2, top - h, M + bw / 2, top - h - 8, C.soft, 1, [2, 2]);
    const x = M + 108;
    D.round(x - 12, top - h, W - M - x + 12, h, 12, start ? C.tealBg : C.white, { border: start ? C.teal : C.line });
    D.text(a.title, x, top - 12, { size: 12, font: D.F.X });
    D.chips(kits, W - M - 12 - kitW, top - 9, kitW + 10, { size: 7.2, h: 14, bg: C.blueBg, color: hex('#1D4ED8') });
    let y = top - 30;
    y -= D.text(a.what, x, y, { size: 8.8, maxW: iw, lh: 1.5 });
    y -= 4;
    const eh = D.height('예) ' + a.example, 8.4, iw - 16);
    D.round(x, y - eh - 6, iw, eh + 6, 6, start ? C.white : C.bg);
    D.text('예) ' + a.example, x + 8, y - 3, { size: 8.4, color: C.ink, maxW: iw - 16 });
    D.y = top - h - 8;
  });
  D.y -= 6;
  if (pb.kpis.length) {
    D.h2('함께 추적하면 좋은 운영 지표', EB);
    const kh = D.chipsHeight(pb.kpis, W - 2 * M, { size: 8.4, h: 20 });
    D.ensure(kh + 30, T, EB);
    D.chips(pb.kpis, M, D.y, W - 2 * M, { size: 8.4, h: 20, bg: C.bg, border: C.line, font: D.F.B });
    D.y -= kh + 10;
    D.note('목표 수치는 현장 진단 후 현재 기준값을 측정해 함께 정합니다.', T, EB);
  }
}

/* ── v2. 현장 진단 체크리스트 · 규정 대응 ────────────────────────── */
function checklistBlock(D, job) {
  const [W] = A4; const pb = job.match.playbook;
  const EB = 'NEXT STEPS', T = '다음 단계';
  if (pb.consult.length) {
    D.h2('현장 진단 때 함께 확인할 질문', EB);
    const qw = W - 2 * M - 36;
    for (const q of pb.consult) {
      const h = D.height(q, 9.3, qw) + 10;
      D.ensure(h, T, EB);
      D.round(M + 4, D.y - 13, 12, 12, 3, C.white, { border: C.soft });
      D.text(q, M + 26, D.y - 2, { size: 9.3, maxW: qw });
      D.y -= h;
    }
    D.y -= 10;
  }
  if (pb.compliance.length) {
    D.h2('규정·기준 대응 포인트', EB);
    const iw = W - 2 * M - 32;
    const h = pb.compliance.reduce((n, x) => n + D.height('· ' + x, 8.8, iw) + 2, 0) + 22;
    D.ensure(h + 8, T, EB);
    D.round(M, D.y - h, W - 2 * M, h, 10, C.amberBg);
    let y = D.y - 11;
    for (const x of pb.compliance) y -= D.text('· ' + x, M + 16, y, { size: 8.8, maxW: iw }) + 2;
    D.y -= h + 6;
    D.para('※ 규정 해석과 적용 범위는 귀사 품질·안전 담당 부서 기준을 따릅니다. 모넷은 기록·알림 자료를 제공합니다.', { size: 7.6, color: C.mute, gap: 14 });
  }
}

/** 메인 — Uint8Array 를 돌려준다 */
export async function renderPdf(job, copy) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const b = fontBytes();
  const F = {
    R: await pdf.embedFont(b.R, { subset: true }),
    B: await pdf.embedFont(b.B, { subset: true }),
    X: await pdf.embedFont(b.X, { subset: true })
  };
  const L = job.lead;
  pdf.setTitle(`${L.company} 맞춤 제안서 — 모넷코리아`);
  pdf.setAuthor(CFG.company.legal);
  pdf.setSubject(`${job.match.industry.label} 무선 IoT 모니터링 제안 (${job.no})`);
  pdf.setKeywords(['Monnit', '모넷코리아', '무선 센서', job.match.industry.label]);
  pdf.setCreator('Monnit Korea Proposal Engine');
  pdf.setProducer('monnit.co.kr');
  pdf.setLanguage('ko-KR');

  const D = new Doc(pdf, F, job);
  /* 브랜드 이미지 — 없거나 깨졌으면 여기서 오류가 나 제안서가 나가지 않는다(엔지니어 확인으로 전환) */
  D.img = {
    cover: await pdf.embedJpg(Buffer.from(BRAND.cover, 'base64')),
    logoWhite: await pdf.embedPng(Buffer.from(BRAND.logoWhite, 'base64')),
    logoBlue: await pdf.embedPng(Buffer.from(BRAND.logoBlue, 'base64'))
  };
  const v2 = job.match.playbook && !job.match.playbook.fallback;
  cover(D, job, copy);
  summaryPage(D, job, copy);
  if (v2) { insightPage(D, job, copy); personaPage(D, job, copy); zonePage(D, job, copy); }
  diagnosisPage(D, job, copy);
  casesPage(D, job, copy);
  designPage(D, job, copy);
  if (v2) roadmapPage(D, job, copy);
  nextPage(D, job, copy);
  return pdf.save({ useObjectStreams: true });
}
