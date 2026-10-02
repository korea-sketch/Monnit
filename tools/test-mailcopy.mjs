/* 보낸 메일 사본 — 발송할 때마다 저장되고, 관리 화면에서 열리고, 지울 때 같이 지워지는가 (2026-09-29)
   실행: node tools/test-mailcopy.mjs */
import fs from 'node:fs';
globalThis.__PROPOSAL_MEM = {};
Object.assign(process.env, { BREVO_API_KEY:'t', ANTHROPIC_API_KEY:'', PROPOSAL_SECRET:'s', PROPOSAL_ADMIN_KEY:'admin-key-1234', PROPOSAL_BCC:'boss@monnit.co.kr',
  PROPOSAL_SITE:'https://monnit.co.kr', PROPOSAL_MODE:'instant', PROPOSAL_INSTANT_SECONDS:'0', PROPOSAL_RATE_IP_HOUR:'1000', PROPOSAL_RATE_DAY:'1000' });
let FAILNEXT=false;
globalThis.fetch = async (url,opt={})=>{ url=String(url);
  if(url.includes('api.brevo.com')){ if(FAILNEXT){FAILNEXT=false;return new Response(JSON.stringify({message:'down'}),{status:500});} return new Response(JSON.stringify({messageId:'<m@x>'}),{status:201}); }
  if(url.includes('proposal-build-background')){ const B=await import('../netlify/functions/proposal-build-background.mjs'); await B.default(new Request(url,{method:'POST',headers:opt.headers,body:opt.body})); return new Response(null,{status:202}); }
  return new Response('{}',{status:200}); };
const API=(await import('../netlify/functions/proposal-api.mjs')).default;
const ADMIN=(await import('../netlify/functions/proposal-admin.mjs')).default;
const P=await import('../netlify/lib/proposal/pipeline.mjs'); const S=await import('../netlify/lib/proposal/store.mjs');
let fail=0; const ok=(n,c,g)=>{console.log((c?'ok   ':'FAIL ')+n+(c?'':'  '+JSON.stringify(g).slice(0,300))); if(!c)fail++;};
await API(new Request('https://monnit.co.kr/api/proposal',{method:'POST',headers:{'content-type':'application/json',origin:'https://monnit.co.kr','x-nf-client-connection-ip':'8.8.8.8','user-agent':'Mozilla/5.0'},
  body:JSON.stringify({test:false,consent:true,elapsed:60000,entry:'contact',auto:true,company:'한빛초등학교',name:'이행정',title:'행정실장',email:'admin@hanbit.es.kr',phone:'010-2222-3333',industryText:'학교·교육기관',memo:'급식실 냉장고 온도 기록이 필요합니다',concerns:['cold']})}),{});
await P.tick({ now: Date.now()+3600e3, origin:'https://monnit.co.kr' });
const id=Object.keys(globalThis.__PROPOSAL_MEM).find(k=>k.startsWith('job/')).slice(4,-5);
const lr=await ADMIN(new Request('https://monnit.co.kr/ops/proposals/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://monnit.co.kr'},body:JSON.stringify({key:'admin-key-1234'})}),{});
const cookie=(lr.headers.get('set-cookie')||'').split(';')[0];
const get=u=>ADMIN(new Request('https://monnit.co.kr'+u,{headers:{cookie}}),{});
const one=await (await get('/ops/proposals/job?id='+id)).json();
ok('건 상세에 보낸 메일 목록', one.mails && one.mails.length>=2, one.mails);
console.log(one.mails.map(m=>`  ${m.at} ${m.audience} ${m.label} → ${m.to} ${m.ok?'':'실패'} | ${m.subject}`).join('\n'));
const prop=one.mails.find(m=>m.kind==='proposal');
ok('고객 제안서 메일 사본', prop && prop.attachment, prop);
ok('발송 이력 ↔ 메일 연결', one.sends[0] && one.sends[0].mail===prop.key, one.sends);
const page=await get('/ops/proposals/mail?key='+encodeURIComponent(prop.key)); const html=await page.text();
ok('메일 보기 200 + 제목·받는 사람·본문', page.status===200 && html.includes('한빛초등학교 맞춤 제안서') && html.includes('admin@hanbit.es.kr') && html.includes('srcdoc=') && html.includes('boss@monnit.co.kr'), page.status);
ok('첨부 PDF 링크', html.includes('/ops/proposals/archive/pdf?key='), '');
ok('CSP 적용', /frame-ancestors 'none'/.test(page.headers.get('content-security-policy')||''), '');
const staff=one.mails.find(m=>m.audience==='staff'); const sp=await (await get('/ops/proposals/mail?key='+encodeURIComponent(staff.key))).text();
ok('담당자 알림 사본도 열림', sp.includes('업종 판단'), '');
ok('로그인 없이 차단', (await ADMIN(new Request('https://monnit.co.kr/ops/proposals/mail?key='+encodeURIComponent(prop.key)),{})).status!==200, '');
ok('잘못된 키 404', (await get('/ops/proposals/mail?key=job/'+id+'.json')).status===404, '');
const arch=await (await get('/ops/proposals/archive/data')).json();
ok('발송 대장에 메일 키', arch.rows[0] && arch.rows[0].mail===prop.key, arch.rows[0]);
/* 실패한 메일도 사본 */
const job=await S.getJob(id); FAILNEXT=true; const Mail=await import('../netlify/lib/proposal/mail.mjs'); const r=await Mail.sendFollowup(job);
const one2=await (await get('/ops/proposals/job?id='+id)).json(); const fm=one2.mails.find(m=>m.kind==='followup');
ok('발송 실패 메일도 기록(실패 표시)', fm && fm.ok===false && fm.error, fm);
/* 삭제 시 사본도 삭제 */
await ADMIN(new Request('https://monnit.co.kr/ops/proposals/action',{method:'POST',headers:{cookie,'content-type':'application/json',origin:'https://monnit.co.kr','x-requested-with':'mk'},body:JSON.stringify({id,op:'delete',force:true})}),{});
ok('건 삭제 → 메일 사본 삭제', !Object.keys(globalThis.__PROPOSAL_MEM).some(k=>k.startsWith('mail/'+id+'/')), Object.keys(globalThis.__PROPOSAL_MEM).filter(k=>k.startsWith('mail/')));
console.log(fail?'실패 '+fail+'건':'모두 통과'); process.exit(fail?1:0);
