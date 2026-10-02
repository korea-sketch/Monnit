#!/usr/bin/env node
/* 맞춤 제안서 — 배포 전 연동 점검 (관리 화면 「연동 점검」과 같은 항목)
   실행:  node tools/check-proposal.mjs            기본 점검(외부 호출 없음)
          node tools/check-proposal.mjs --deep     Brevo·Claude·먼데이·사이트에 읽기 전용 호출까지
   환경변수는 Netlify 와 같은 이름으로 넣고 실행합니다(예: netlify env:list 로 확인).
   Netlify Blobs 는 로컬에서 쓸 수 없어 저장소 항목은 메모리로 대신 확인합니다. */
if (!process.env.NETLIFY_BLOBS_CONTEXT) globalThis.__PROPOSAL_MEM = {};
const deep = process.argv.includes('--deep');
const { runHealth } = await import('../netlify/lib/proposal/health.mjs');
const r = await runHealth({ deep });
for (const i of r.items) console.log(`${i.ok ? 'OK  ' : i.warn ? 'WARN' : 'FAIL'}  ${i.label.padEnd(26)} ${i.detail}`);
console.log(r.ok ? '\n연동 점검 통과' + (r.warn ? ` (참고 ${r.warn}건)` : '') : `\n확인 필요 ${r.bad}건`);
process.exit(r.ok ? 0 : 1);
