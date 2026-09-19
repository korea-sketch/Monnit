/* 통합 관제(/ops) 「사이트 상태」의 대화 AI 항목 — 정지·연속 실패가 빨간 점으로 뜨는지 (2026-09-19) */
const M = {};
globalThis.__MNK_FAKE_BLOBS = { async get(s,k){ return M[s+'|'+k] ?? null; }, async set(s,k,t){ M[s+'|'+k]=String(t); return true; }, async del(s,k){ delete M[s+'|'+k]; return true; }, async list(){ return []; } };
const H = await import('../netlify/functions/health.mjs');
let fail=0; const ok=(n,c,g)=>{console.log((c?'ok   ':'FAIL ')+n+(c?'':'  '+JSON.stringify(g))); if(!c)fail++;};
let r = await H.checkChatAI(); ok('정지·실패 없음 → 정상 점', r.ok===true && r.name==='대화 AI(무료 Gemini)', r);
M['proposals|ai/gemini-model.json']=JSON.stringify({model:'gemini-3.5-flash-lite'});
r = await H.checkChatAI(); ok('  쓰는 모델이 이름에 붙는다', r.ok && /3\.5-flash-lite/.test(r.name), r);
M['proposals|ai/last-error.json']=JSON.stringify({at:new Date().toISOString(), n:3, status:500, message:'x'});
r = await H.checkChatAI(); ok('1시간 안 3회 연속 실패 → 빨간 점', r.ok===false && /연속 실패 3회/.test(r.name), r);
M['proposals|ai/halt.json']=JSON.stringify({at:new Date().toISOString(), reason:'quota-exceeded'});
r = await H.checkChatAI(); ok('정지 파일 → 빨간 점 + 사유 + 관제 안내', r.ok===false && /정지\(quota-exceeded\)/.test(r.name) && /AI 다시 시도/.test(r.error), r);
console.log(fail?'❌':'✅ 통합 관제 사이트 상태 항목 통과'); process.exit(fail?1:0);
