/** 기술지원 지식베이스 → 브라우저 사본 (js/support-kb.js)
 *
 *   node scripts/support-sync.mjs
 *
 *  server/lib/support/kb.data.mjs (문서) + engine.mjs (검색·감정 판별) 를 묶어
 *  window.MKSupportKB 하나로 내보낸다. 서버와 브라우저가 같은 문서·같은 검색을 쓰게 하기 위함.
 *  빌드(wrangler.toml)에서도 돌지만, 결과 파일을 저장소에 함께 올려 두면
 *  빌드 없이 열어도 동작한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kb = await import(path.join(root, 'server/lib/support/kb.data.mjs'));
const engineSrc = fs.readFileSync(path.join(root, 'server/lib/support/engine.mjs'), 'utf8')
  .replace(/^export\s+(const|function|async function)\s/gm, '$1 ');

/* 정규식(SYN)은 JSON 으로 못 옮기므로 소스 그대로 적는다 */
const syn = '[' + kb.SYN.map(([re, to]) => '[' + re.toString() + ',' + JSON.stringify(to) + ']').join(',') + ']';

const out = `/*! Monnit Korea — 기술지원 지식베이스 (자동 생성 · 직접 고치지 마세요)
 *  원본: server/lib/support/kb.data.mjs · engine.mjs  →  node scripts/support-sync.mjs
 *  생성: ${new Date().toISOString().slice(0, 10)} · 문서 ${kb.ARTICLES.length}개
 */
(function (w) {
  'use strict';
  if (w.MKSupportKB) return;
${engineSrc.replace(/^/gm, '  ')}
  var CATS = ${JSON.stringify(kb.CATS)};
  var ARTICLES = ${JSON.stringify(kb.ARTICLES)};
  var SYN = ${syn};
  var INDEX = buildIndex(ARTICLES, SYN);
  var BY = {}; ARTICLES.forEach(function (a) { BY[a.id] = a; });
  w.MKSupportKB = {
    CATS: CATS, ARTICLES: ARTICLES, get: function (id) { return BY[id] || null; },
    search: function (q, o) { o = o || {}; o.SYN = SYN; return search(INDEX, q, o); },
    confidence: confidence, mood: mood,
    byCat: function (c) { return ARTICLES.filter(function (a) { return a.cat === c; }); }
  };
})(window);
`;
fs.writeFileSync(path.join(root, 'js/support-kb.js'), out);
console.log('[support-sync] js/support-kb.js —', kb.ARTICLES.length, 'articles,', (out.length / 1024).toFixed(1), 'KB');
