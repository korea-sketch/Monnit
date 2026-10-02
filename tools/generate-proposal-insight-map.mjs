import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { insight } from '../netlify/lib/proposal/match.mjs';
import { INDUSTRIES } from '../netlify/lib/proposal/kb.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const goalSets = [
  ['downtime', 'labor'], ['safety', 'response'], ['loss', 'response'],
  ['loss', 'compliance'], ['energy'], ['safety'], ['integration', 'labor'],
  ['compliance'], []
];
const out = {};

for (const industry of INDUSTRIES) {
  for (const problem of industry.problems) {
    for (const goals of goalSets) {
      const result = insight({ industry: industry.key, problems: [problem], goals });
      const top = result.top[0];
      const signature = goals.length ? goals.slice().sort().join(',') : '_default';
      out[`${industry.key}|${problem}|${signature}`] = top && {
        key: top.key,
        pct: top.pct,
        why: top.why
      };
    }
  }
}

const target = resolve(here, '../js/proposal-insight-map.js');
await writeFile(target, `/*! 운영 인사이트 알고리즘으로 생성 — 직접 수정하지 마세요 */\nwindow.MK_INSIGHT_MAP=${JSON.stringify(out)};\n`, 'utf8');
console.log(JSON.stringify({ target, combinations: Object.keys(out).length }));
