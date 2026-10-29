#!/usr/bin/env node
/* ============================================================
   Cloudflare 배포 준비 — build.js 다음에 실행합니다.
     node scripts/proposal-sync.mjs && node build.js && node cloudflare/prepare.mjs
   ------------------------------------------------------------
   하는 일
   1) dist/            방문자에게 공개할 파일만 복사 (저장소 루트에서
                       함수·도구·문서·설정 파일을 뺀 것)
   2) dist/__private/  함수만 읽는 파일 (제안서 PDF·글꼴·메일 템플릿·편집기).
                       Worker 가 /__private/* 공개 요청은 항상 404 로 막습니다.
   3) cloudflare/generated/site.json
                       _redirects · _headers · cloudflare/site-rules.toml 규칙 + 공개 파일 목록.
                       Worker 가 이 순서대로 규칙을 적용하는 데 씁니다.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const GEN = path.join(ROOT, 'cloudflare', 'generated');

/* ── 공개하지 않는 것 ─────────────────────────────────────────── */
const DENY_DIRS = new Set(['.git', '.github', 'node_modules', 'dist', 'cloudflare', 'server', 'tools', 'scripts',
  'ui', 'source', 'functions', '.wrangler', 'Claude outputs', 'claude-outputs', 'outputs']);
const DENY_ROOT_FILES = new Set(['package.json', 'package-lock.json', 'wrangler.toml', 'wrangler.jsonc',
  'build.js', 'gitignore.txt', '.gitignore', '.DS_Store', '.dev.vars']);
const DENY_EXT_ROOT = ['.md', '.sh'];

/* ── 함수만 읽는 파일 (dist/__private 로) ─────────────────────── */
const PRIVATE = ['proposals', 'assets/fonts', 'email/template.html', 'email/products.json', 'editor.html'];

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyFile(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }

const publicFiles = [];
function walk(dir, rel = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + ent.name : ent.name;
    if (ent.name === '.DS_Store') continue;
    if (ent.isDirectory()) {
      if (!rel && DENY_DIRS.has(ent.name)) continue;
      if (DENY_DIRS.has(ent.name) && ent.name.startsWith('.')) continue;
      walk(path.join(dir, ent.name), r);
      continue;
    }
    if (!rel && (DENY_ROOT_FILES.has(ent.name) || DENY_EXT_ROOT.some(x => ent.name.toLowerCase().endsWith(x)))) continue;
    if (/#U[0-9a-fA-F]{4}/.test(ent.name)) continue;          /* 압축 해제로 깨진 이름 사본 */
    const st = fs.statSync(path.join(dir, ent.name));
    if (st.size > 25 * 1024 * 1024) { console.warn('[cf] 25MB 초과 — Cloudflare 정적 파일 한도로 제외:', r); continue; }
    copyFile(path.join(dir, ent.name), path.join(DIST, r));
    publicFiles.push('/' + r);
  }
}

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });
walk(ROOT);

/* 비공개 사본 */
let privCount = 0;
for (const p of PRIVATE) {
  const src = path.join(ROOT, p);
  if (!fs.existsSync(src)) { console.warn('[cf] 비공개 파일 없음(건너뜀):', p); continue; }
  const st = fs.statSync(src);
  const list = st.isDirectory()
    ? fs.readdirSync(src, { recursive: true }).filter(f => fs.statSync(path.join(src, f)).isFile()).map(f => path.join(p, f))
    : [p];
  for (const f of list) { copyFile(path.join(ROOT, f), path.join(DIST, '__private', f)); privCount++; }
}

/* ── 리다이렉트 규칙 ─────────────────────────────────────────────
   순서: _redirects 파일 → cloudflare/site-rules.toml [[redirects]] (위에서부터 첫 일치) */
function parseRedirectsFile(txt) {
  const out = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const tok = line.split(/\s+/);
    /* 주소에 공백이 들어간 규칙("/Claude outputs/*") — 두 번째 경로가 나올 때까지를 출발 주소로 */
    let ti = 1; while (ti < tok.length && !/^(\/|https?:)/.test(tok[ti])) ti++;
    if (ti >= tok.length) continue;
    const parts = [tok.slice(0, ti).join(' '), ...tok.slice(ti)];
    const [from, to] = parts;
    let status = 301, force = false;
    const conds = [];
    for (const p of parts.slice(2)) {
      const m = /^(\d{3})(!?)$/.exec(p);
      if (m) { status = Number(m[1]); force = m[2] === '!'; } else conds.push(p);
    }
    if (conds.length) { console.warn('[cf] 조건부 리다이렉트는 지원하지 않아 건너뜀:', line); continue; }
    out.push({ from, to, status, force });
  }
  return out;
}
const redirects = [];
const rf = path.join(ROOT, '_redirects');
if (fs.existsSync(rf)) redirects.push(...parseRedirectsFile(fs.readFileSync(rf, 'utf8')));
const toml = parseToml(fs.readFileSync(path.join(ROOT, 'cloudflare', 'site-rules.toml'), 'utf8'));
for (const r of toml.redirects || []) {
  if (r.conditions || r.query || r.signed) { console.warn('[cf] 조건부 리다이렉트 건너뜀:', r.from); continue; }
  redirects.push({ from: r.from, to: r.to, status: Number(r.status || 301), force: !!r.force });
}

/* ── 헤더 규칙 — _headers 파일 → site-rules.toml [[headers]] 순으로 누적 ── */
function parseHeadersFile(txt) {
  const out = []; let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { cur = { for: raw.trim(), values: {} }; out.push(cur); continue; }
    const m = /^\s+([^:]+):\s*(.*)$/.exec(raw);
    if (m && cur) cur.values[m[1].trim()] = m[2].trim();
  }
  return out;
}
const headers = [];
const hf = path.join(ROOT, '_headers');
if (fs.existsSync(hf)) headers.push(...parseHeadersFile(fs.readFileSync(hf, 'utf8')));
for (const h of toml.headers || []) {
  const values = {};
  for (const [k, v] of Object.entries(h.values || {})) values[k] = String(v).replace(/\s*\n\s*/g, ' ').trim();
  headers.push({ for: h.for, values });
}

/* 강제 404 로 막아 둔 주소의 파일은 공개 폴더에서 아예 뺀다 (규칙과 실제 파일을 일치시켜 이중 차단) */
const blockRes = redirects.filter(r => r.force && r.status === 404 && !/^https?:/.test(r.from)).map(r => {
  const src = r.from.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + src + '$');
});
const decode = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
let removed = 0;
for (let i = publicFiles.length - 1; i >= 0; i--) {
  const f = publicFiles[i];
  if (f === '/404.html') continue;
  if (blockRes.some(re => re.test(f) || re.test(encodeURI(f)) || re.test(decode(f)))) {
    rmrf(path.join(DIST, f)); publicFiles.splice(i, 1); removed++;
  }
}
if (removed) console.log(`[cf] 404 규칙으로 막힌 파일 ${removed}개는 공개 폴더에서 제외`);

fs.mkdirSync(GEN, { recursive: true });
fs.writeFileSync(path.join(GEN, 'site.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  files: publicFiles.filter(f => f !== '/_headers' && f !== '/_redirects').sort(),
  redirects,
  headers
}));
/* 리다이렉트는 Worker 가 처리한다. 다만 Worker 를 거치지 않는 정적 경로(wrangler.toml run_worker_first 의
   「!」 목록 — 이미지·JS·CSS 등)에 걸린 규칙은 Cloudflare 정적 파일 _redirects 로 따로 넣어 준다
   (예: 옛 /images/alarm/*.png → .webp) */
const wt = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
const negs = [...wt.matchAll(/"!(\/[^"]*)"/g)].map(m => new RegExp('^' + m[1].split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'));
const staticRules = redirects.filter(r => !/^https?:/.test(r.from) && negs.some(re => re.test(r.from.replace(/\*$/, 'x'))) && r.status !== 404);
fs.writeFileSync(path.join(DIST, '_redirects'), staticRules.map(r => `${r.from} ${r.to} ${r.status}${r.force ? '!' : ''}`).join('\n') + '\n');
if (staticRules.length) console.log(`[cf] 정적 경로 리다이렉트 ${staticRules.length}개 → dist/_redirects`);
/* 헤더 — Worker 를 거치지 않고 바로 나가는 정적 파일(이미지·JS·CSS 등)용 (Cloudflare _headers 형식) */
/* Cloudflare 는 같은 헤더를 쉼표로 이어 붙이므로, 앞 규칙이 이미 정한 헤더는 「! 이름」으로 떼고 다시 정한다
   (뒤에 오는 규칙이 이긴다) */
const seenH = new Set();
fs.writeFileSync(path.join(DIST, '_headers'), headers.map(h => {
  const lines = [h.for];
  for (const [k, v] of Object.entries(h.values)) {
    if (seenH.has(k.toLowerCase())) lines.push('  ! ' + k);
    lines.push('  ' + k + ': ' + v);
    seenH.add(k.toLowerCase());
  }
  return lines.join('\n');
}).join('\n') + '\n');
/* Cloudflare 정적 파일 업로드에서 제외할 목록 (없으면 생성) */
fs.writeFileSync(path.join(DIST, '.assetsignore'), '.assetsignore\n');

console.log(`[cf] 준비 완료 — 공개 파일 ${publicFiles.length}개 · 비공개 ${privCount}개 · 리다이렉트 ${redirects.length}개 · 헤더 규칙 ${headers.length}개`);
