/* monnit-lead.js — 메타 픽셀 설치 + Lead 전환 패치 테스트 */
import fs from 'fs';
const SRC = fs.readFileSync(new URL('../js/monnit-lead.js', import.meta.url), 'utf8');
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok  '+m);} else {fail++;console.log('  FAIL '+m);} };

function makeFbq(win){
  let n; n = win.fbq = function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments); };
  n.push=n; n.loaded=true; n.version='2.0'; n.queue=[]; win._fbq=n; return n;
}
function boot({marketing=true, preFbq=false, noConsentLib=false}={}){
  const sink=[], injected=[], listeners={}, timers=[];
  const head={ appendChild(el){ if(el.src) injected.push(el.src); } };
  const doc={ referrer:'', head,
    createElement:()=>({ setAttribute(){}, _s:'', get src(){return this._s;}, set src(v){this._s=v;} }),
    getElementsByTagName:()=>[{parentNode:head}] };
  const win={
    location:{search:'',href:'https://monnit.co.kr/whitepaper',hostname:'monnit.co.kr',pathname:'/whitepaper'},
    sessionStorage:{_d:{},getItem(k){return this._d[k]??null;},setItem(k,v){this._d[k]=v;}},
    dataLayer:[], navigator:{}, crypto:{randomUUID:()=> 'uuid-'+Math.random().toString(36).slice(2)},
    setInterval:(fn)=>{ timers.push(fn); return timers.length; }, clearInterval:(id)=>{ timers[id-1]=null; },
    addEventListener(ev,fn){ (listeners[ev]=listeners[ev]||[]).push(fn); },
  };
  if(!noConsentLib) win.MonnitConsent={ state:{analytics:true, marketing} };
  if(preFbq) makeFbq(win);
  new Function('window','document',SRC)(win,doc);
  const tick=()=>timers.forEach(f=>f&&f());
  const loadEvents=()=>{ win.fbq.callMethod=function(){ sink.push([...arguments]); };
    win.fbq.queue.splice(0).forEach(a=>win.fbq.callMethod.apply(win.fbq,a)); tick(); };
  return {win,doc,sink,injected,listeners,loadEvents,tick, ML:win.MonnitLead};
}
const leads = s => s.filter(a=>a[0]==='track'&&(a[1]==='Lead'||a[1]==='CompleteRegistration'));
const hasFb = a => a.some(u=>/connect\.facebook\.net/.test(u));

console.log('\n[A] 주 사이트 — 픽셀이 새로 설치되는가 (이번 핵심)');
{ const t=boot({marketing:true});
  ok(hasFb(t.injected),'fbevents.js 주입');
  ok(typeof t.win.fbq==='function','fbq 생성');
  ok(Array.isArray(t.win.fbq.queue),'queue 유지 (스니펫 원형)');
  t.loadEvents();
  ok(t.sink.some(a=>a[0]==='init'&&a[1]==='1375041798098647'),'init 픽셀ID');
  ok(t.sink.some(a=>a[1]==='PageView'),'PageView 전송');
}
console.log('\n[B] 마케팅 동의 없음 → 설치 안 함 (PIPA)');
{ const t=boot({marketing:false});
  ok(!hasFb(t.injected),'미설치');
  ok(typeof t.win.fbq==='undefined','fbq 없음');
  t.ML.track('doc_request',{page:'whitepaper'});
  ok(t.win.dataLayer.some(e=>e.event==='lead_doc_request'),'기존 신호는 정상');
}
console.log('\n[C] 배너에서 나중에 동의 → 그때 설치');
{ const t=boot({marketing:false});
  ok(!hasFb(t.injected),'처음엔 미설치');
  t.win.MonnitConsent.state.marketing=true;
  (t.listeners['monnit:consent']||[]).forEach(f=>f());
  ok(hasFb(t.injected),'동의 이벤트 후 설치');
}
console.log('\n[D] 접수하면 Lead 가 나가는가');
{ const t=boot({marketing:true}); t.loadEvents();
  const p=t.ML.build('doc_request','promo_temperature','온도',{회사명:'(주)테스트'});
  t.ML.track('doc_request',{page:'promo_temperature',interest:'콜드체인'});
  const L=leads(t.sink);
  ok(L.length===1,'Lead 1건 ('+L.length+')');
  ok(L[0]&&L[0][2].content_name==='콜드체인','content_name');
  ok(L[0]&&L[0][3]&&L[0][3].eventID,'eventID (CAPI 대비)');
  ok(typeof p['메타 이벤트ID']==='string','원장 payload 에 eventID');
}
console.log('\n[E] /promo/* — 인라인 픽셀 중복 설치 방지');
{ const t=boot({marketing:true, preFbq:true});
  ok(!hasFb(t.injected),'두 번 올리지 않음 (PageView 이중집계 방지)');
}
console.log('\n[F] /promo/proposal — Lead 이중 발사 방지');
{ const t=boot({marketing:true, preFbq:true}); t.loadEvents();
  t.win.fbq('track','Lead',{content_name:'예지보전 제안 가이드'});   /* 페이지 자체 호출 */
  t.ML.track('doc_request',{page:'promo_proposal'});
  ok(leads(t.sink).length===1,'합계 1건 ('+leads(t.sink).length+')');
}
console.log('\n[G] PageView · Contact 는 차단 신호가 아니다');
{ const t=boot({marketing:true, preFbq:true}); t.loadEvents();
  t.win.fbq('track','PageView'); t.win.fbq('track','Contact',{});
  t.ML.track('doc_request',{page:'x'});
  ok(leads(t.sink).length===1,'Lead 정상 ('+leads(t.sink).length+')');
}
console.log('\n[H] 픽셀이 죽지 않는가 — 큐 → callMethod 전환');
{ const t=boot({marketing:true});
  ok(t.win.fbq.queue.length>=2,'로드 전 호출이 큐에 쌓임 ('+t.win.fbq.queue.length+')');
  t.loadEvents();
  ok(t.win.fbq.queue.length===0,'큐가 비워짐');
  ok(t.sink.some(a=>a[1]==='PageView'),'밀린 PageView 전송됨');
  t.ML.track('contact',{page:'x'});
  ok(leads(t.sink).length===1,'그 뒤 Lead 도 정상');
}
console.log('\n[I] 구독 → CompleteRegistration');
{ const t=boot({marketing:true}); t.loadEvents();
  t.ML.track('subscribe',{page:'newsletter'});
  ok(t.sink.some(a=>a[1]==='CompleteRegistration'),'CompleteRegistration');
}
console.log('\n[J] MK_META_SELF 로 페이지가 끌 수 있다');
{ const t=boot({marketing:true, preFbq:true}); t.loadEvents();
  t.win.MK_META_SELF=true;
  t.ML.track('doc_request',{page:'x'});
  ok(leads(t.sink).length===0,'발사 안 함');
}
console.log('\n[K] 동의 라이브러리가 없어도 터지지 않는다');
{ const t=boot({noConsentLib:true});
  ok(!hasFb(t.injected),'보수적으로 미설치');
  t.ML.track('contact',{page:'x'});
  ok(t.win.dataLayer.some(e=>e.event==='lead_contact'),'기존 신호 정상');
}
console.log('\n[L] 기존 기능 회귀 — source · build · 제목규격');
{ const t=boot({marketing:true});
  const p=t.ML.build('doc_request','whitepaper','콜드체인 백서',{회사명:'(주)가나'});
  ok(p['_subject']==='[모넷·자료] 콜드체인 백서','제목 규격 유지');
  ok(p['접수 유형']==='자료','접수 유형 유지');
  ok(p['출처']==='direct','출처 기록 유지');
}
console.log('\n'+(fail?'✗ ':'✓ ')+pass+' pass / '+fail+' fail');
process.exit(fail?1:0);
