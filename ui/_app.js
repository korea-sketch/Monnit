function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function W(v){return v==null?'–':'₩'+Math.round(v).toLocaleString();}
function N(v){return v==null?'–':Math.round(v).toLocaleString();}
function D(s){return new Date(String(s)+'T00:00:00+09:00').getTime();}
var DAY=864e5;
var PC={'메타':'#7AA8FF','구글':'#FFC65C','네이버':'#4FE39B','카카오':'#FFB0D0'};
function pcol(p){return PC[p]||'#B79CFF';}
var ENVS={meta:'META_TOKEN, META_AD_ACCOUNT',google:'GOOGLE_ADS_SHEET',
 naver:'NAVER_API_KEY, NAVER_SECRET, NAVER_CUSTOMER_ID',
 ga4:'GA4_SA_EMAIL, GA4_SA_KEY, GA4_PROPERTY_ID',clarity:'CLARITY_TOKEN'};
var ENAME={meta:'메타',google:'구글',naver:'네이버',ga4:'GA4',clarity:'Clarity'};
var EDESC={meta:'광고비·노출·클릭 · 소재별',google:'시트 경유 · 계정 합계만',
 naver:'캐페인별까지 수집',ga4:'채널별 세션·전환',clarity:'세션·헛클릭·스크롤'};

var PERIOD={p:'30d',from:null,to:null};
var charts=[];
function killCharts(){charts.forEach(function(c){try{c.destroy();}catch(e){}});charts=[];}

function load(){
  var q='/ops/data?p='+encodeURIComponent(PERIOD.p);
  if(PERIOD.from&&PERIOD.to)q+='&from='+PERIOD.from+'&to='+PERIOD.to;
  fetch(q,{cache:'no-store',credentials:'same-origin'})
    .then(function(r){if(r.status===401){location.href='/ops';throw new Error('auth');}
      if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(render)
    .catch(function(e){if(e.message!=='auth')document.getElementById('stamp').textContent='불러오지 못했습니다 ('+e.message+')';});
}

function render(j){
  killCharts();
  document.getElementById('main').style.display='block';
  var P=j.period||{}, S=j.summary||{}, A=j.ads||{}, cfg=(A.configured||{});
  document.getElementById('stamp').innerHTML='오늘 접수 <b>'+((S.today||{}).total||0)+'건</b> · '
    +esc(P.label||'')+' <b>'+((S.week||{}).total||0)+'건</b>';
  document.getElementById('kpiRange').textContent=P.label||'';
  document.getElementById('foot').textContent='갱신 '+new Date(j.generated).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  if(!PERIOD.from){document.getElementById('f').value=P.from||'';document.getElementById('t').value=P.to||'';}

  var keys=Object.keys(ENVS), nOk=keys.filter(function(k){return cfg[k];}).length;
  document.getElementById('connTag').textContent=nOk+' / '+keys.length+' 연결';
  document.getElementById('conn').innerHTML=keys.map(function(k){
    var ok=!!cfg[k];
    return '<div class="cn '+(ok?'ok':'wait')+'"><div class="h"><span class="n">'+ENAME[k]+'</span>'
      +'<span class="tag '+(ok?'t-ok':'t-wait')+'">'+(ok?'연결':'대기')+'</span></div>'
      +'<div class="d">'+EDESC[k]+'<br><code>'+ENVS[k]+'</code></div></div>';
  }).join('');

  var cur=A.cur||[], prev=A.prev||[];
  var sum=function(a,f){return a.reduce(function(s,x){return s+(x[f]||0);},0);};
  var spend=sum(cur,'spend'),imp=sum(cur,'impressions'),clk=sum(cur,'clicks');
  var pspend=sum(prev,'spend'),pclk=sum(prev,'clicks'),pimp=sum(prev,'impressions');
  var leads=((S.week||{}).contact||0)+((S.week||{}).doc||0);
  var pleads=((S.prev||{}).contact||0)+((S.prev||{}).doc||0);
  var ctr=imp?clk/imp*100:null, pctr=pimp?pclk/pimp*100:null;
  var cpc=clk?spend/clk:null, cpl=leads?spend/leads:null, pcpl=pleads?pspend/pleads:null;
  var dp=function(c,p,inv){if(p==null||!p)return['–','flat'];
    var d=Math.round((c-p)/p*1000)/10;
    return [(d>0?'+':'')+d+'%',(inv?(d>0?'dn':'up'):(d>0?'up':'dn'))];};
  var kv=[['노출수',N(imp),dp(imp,pimp)],['클릭수',N(clk),dp(clk,pclk)],
    ['클릭률',ctr==null?'–':ctr.toFixed(2)+'%',dp(ctr,pctr)],
    ['광고비',W(spend),dp(spend,pspend,1)],['클릭당',W(cpc),['','flat']],
    ['리드',N(leads),dp(leads,pleads)],['리드당',W(cpl),dp(cpl,pcpl,1)]];
  document.getElementById('kpi').innerHTML=kv.map(function(x){
    return '<div class="k"><div class="l">'+x[0]+'</div><div class="v">'+x[1]+'</div>'
      +'<div class="d '+x[2][1]+'">'+x[2][0]+'</div></div>';}).join('');

  var CR=j.creatives||[];
  var byP={};
  cur.forEach(function(a){byP[a.channel]=byP[a.channel]||{spend:0,imp:0,clk:0,leads:0,rows:[]};
    byP[a.channel].spend=a.spend;byP[a.channel].imp=a.impressions;byP[a.channel].clk=a.clicks;});
  CR.forEach(function(c){if(!c.channel||/^\(/.test(c.key))return;
    var b=byP[c.channel]=byP[c.channel]||{spend:0,imp:0,clk:0,leads:0,rows:[]};
    b.rows.push(c);b.leads+=c.leads||0;});
  var pmap={};prev.forEach(function(x){pmap[x.channel]=x.spend;});

  var ph='';
  Object.keys(byP).forEach(function(p){
    var a=byP[p],col=pcol(p),pv=pmap[p],dl=pv?Math.round((a.spend-pv)/pv*1000)/10:null;
    var pctr2=a.imp?a.clk/a.imp*100:null;
    ph+='<div class="g pl"><div class="top"><div><div class="name" style="color:'+col+'">'+esc(p)+'</div>'
      +'<div class="spend">'+W(a.spend)+'</div><div class="delta '+(dl===null?'flat':(dl>0?'dn':'up'))+'">'
      +(dl===null?'직전 없음':(dl>0?'▲ +':'▼ ')+Math.abs(dl)+'%')+'</div></div>'
      +'<div class="donut"><canvas id="dn'+esc(p)+'"></canvas><div class="mid"><b>'+a.leads+'</b><span>리드</span></div></div></div>'
      +'<div class="mini"><span>노출</span><b>'+N(a.imp)+'</b></div>'
      +'<div class="mini"><span>클릭 · CTR</span><b>'+N(a.clk)+(pctr2==null?'':' · '+pctr2.toFixed(2)+'%')+'</b></div>'
      +'<div class="mini"><span>리드당</span><b>'+(a.leads?W(a.spend/a.leads):'–')+'</b></div>'
      +'<div class="spark"><canvas id="sp'+esc(p)+'"></canvas></div>'
      +'<table><tr><th>소재</th><th>지출</th><th>클릭</th><th>리드</th></tr>'
      +(a.rows.length?a.rows.slice(0,8).map(function(c){
        return '<tr><td>'+esc(c.key)+'</td><td>'+W(c.spend)+'</td><td>'+N(c.clicks)+'</td><td>'+(c.leads||0)+'</td></tr>';}).join('')
        :'<tr><td colspan="4" class="empty">소재 데이터 없음</td></tr>')
      +'</table></div>';
  });
  document.getElementById('plats').innerHTML=ph||'<div class="g sec"><div class="empty">광고 데이터 없음</div></div>';

  Object.keys(byP).forEach(function(p){
    var a=byP[p],col=pcol(p);
    var real=a.rows.filter(function(c){return c.spend;});
    var dc=document.getElementById('dn'+p);
    if(dc)charts.push(new Chart(dc,{type:'doughnut',
      data:{labels:real.length?real.map(function(c){return c.key;}):['지출 미연동'],
        datasets:[{data:real.length?real.map(function(c){return c.spend;}):[1],
          backgroundColor:real.length?real.map(function(c,i){return col+(['','BB','88','55','33'][i%5]||'33');}):['#2A3550'],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'70%',
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(x){return x.label+' '+W(x.raw);}}}}}}));
    var dd=(S.daily||[]);
    var sc2=document.getElementById('sp'+p);
    if(sc2)charts.push(new Chart(sc2,{type:'line',
      data:{labels:dd.map(function(x){return x.d;}),
        datasets:[{data:dd.map(function(x){return x.c+x.r;}),borderColor:col,borderWidth:2,pointRadius:0,
          tension:.35,fill:true,backgroundColor:col+'1A'}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{display:false},y:{display:false,beginAtZero:true}}}}));
  });

  var AU=j.utmAudit||[];
  var nB=AU.filter(function(x){return x.status==='bad';}).length;
  var nO=AU.filter(function(x){return x.status==='ok';}).length;
  var tg=document.getElementById('utmTag');
  tg.className='tag '+(nB?'t-bad':(nO===AU.length&&AU.length?'t-ok':'t-wait'));
  tg.textContent=nO+' / '+AU.length+' 연결됨';
  document.getElementById('utm').innerHTML=AU.length
    ?('<tr><th>소재</th><th>채널</th><th>광고 utm</th><th>리드 utm</th><th>지출</th><th>상태</th><th>진단</th></tr>'
      +AU.map(function(x){
        var cls=x.status==='ok'?'t-ok':(x.status==='bad'?'t-bad':(x.status==='wait'?'t-wait':'t-off'));
        var lab=x.status==='ok'?'정상':(x.status==='bad'?'끕김':(x.status==='wait'?'확인':'대기'));
        return '<tr><td>'+esc(x.key)+'</td><td style="color:'+pcol(x.channel)+'">'+esc(x.channel||'–')+'</td>'
          +'<td class="mono'+(x.ad_utm?'':' none')+'">'+esc(x.ad_utm||'없음')+'</td>'
          +'<td class="mono'+(x.lead_utm?'':' none')+'">'+esc(x.lead_utm||'없음')+(x.lead_n?' ('+x.lead_n+')':'')+'</td>'
          +'<td>'+W(x.spend)+'</td><td><span class="tag '+cls+'">'+lab+'</span></td>'
          +'<td class="mini2">'+esc(x.msg)+'</td></tr>';}).join(''))
    :'<tr><td class="empty">소재 데이터가 쌀이면 여기에 검증 결과가 나옵니다</td></tr>';
  document.getElementById('utmSum').innerHTML=AU.length
    ?('<b style="color:var(--ink)">끕김 '+nB+'건</b> · 정상 '+nO+'건<br>'
      +'utm_content 가 없으면 그 소재의 지출과 리드는 <b style="color:var(--ink)">영원히 이어지지 않습니다</b>.'):'';

  var ACT=j.actions||[];
  document.getElementById('actN').textContent=ACT.length+'건';
  document.getElementById('acts').innerHTML=ACT.length?ACT.map(function(a){
    return '<div class="act p'+a.p+'"><div class="hd"><div class="t">'+esc(a.title)+'</div>'
      +'<span class="tag '+(a.p===1?'t-bad':(a.p===2?'t-wait':'t-off'))+'">'
      +(a.p===1?'급함':(a.p===2?'중요':'검토'))+'</span></div>'
      +'<div class="why">'+esc(a.why)+'</div><div class="do">'+esc(a.fix)+'</div>'
      +'<div class="gain">→ '+esc(a.gain)+'</div></div>';}).join('')
    :'<div class="empty">지금 급한 건 없습니다</div>';

  var F=j.funnel||{},E=j.economics||{};
  document.getElementById('fn').innerHTML=
    [['광고비',W(spend),''],['클릭',N(clk),cpc==null?'':W(cpc)],
     ['문의·자료',N(F.total||0),cpl==null?'':W(cpl)],
     ['견적',N((F.reached||{}).견적||0),(F.days_to_quote_median!=null?F.days_to_quote_median+'일':'')],
     ['수주',N((F.reached||{}).수주||0),(F.days_to_win_median!=null?F.days_to_win_median+'일':'')]]
    .map(function(x,i,arr){
      var cell='<div class="st"><div class="l">'+x[0]+'</div><div class="v">'+x[1]+'</div><div class="x">'+x[2]+'</div></div>';
      return i<arr.length-1?cell+'<div class="ar"><i>›</i></div>':cell;}).join('');
  var st=F.stale||[];
  document.getElementById('stale').innerHTML=st.length
    ?'<div class="note" style="margin:0 0 6px"><b style="color:var(--warn)">견적이 안 나간 채 묵은 건</b></div>'
      +st.map(function(x){return '<div class="hl"><span class="n2">'+esc(x.company||'-')+'</span><span class="ms">'+esc(x.stage)+' · '+x.days+'일</span></div>';}).join('')
    :'';

  document.getElementById('econNote').textContent=E.won?('수주 '+E.won+'건 기준'+(E.revenue_assumed?' · 유지개월 미입력분은 기본 가정':'')):'수주 딜에 금액을 넣으면 채워집니다';
  document.getElementById('econ').innerHTML=
    [['광고비',W(E.spend)],['문의',N(E.contacts)],['수주',N(E.won)],['CPL',W(E.cpl)],
     ['CAC',W(E.cac)],['평균 LTV',W(E.avg_ltv)],['LTV:CAC',E.ltv_cac==null?'–':E.ltv_cac+'x'],
     ['회수',E.payback_months==null?'–':E.payback_months+'개월']]
    .map(function(x){return '<div><div class="k2">'+x[0]+'</div><div class="v2">'+x[1]+'</div></div>';}).join('');

  var qd=CR.filter(function(c){return c.spend&&c.clicks&&!/^\(/.test(c.key);});
  var mC=qd.length?qd.reduce(function(s,c){return s+(c.clicks/c.impressions*100||0);},0)/qd.length:0;
  var cplOf=function(c){return c.leads?c.spend/c.leads:c.spend*1.6;};
  var mP=qd.length?qd.map(cplOf).reduce(function(s,v){return s+v;},0)/qd.length:0;
  var pts=qd.map(function(c){
    var y=c.impressions?c.clicks/c.impressions*100:0,x=cplOf(c);
    var good=y>=mC,cheap=x<=mP;
    return {x:x,y:y,r:Math.max(8,Math.min(28,Math.sqrt(c.spend)/5)),label:c.key,leads:c.leads,
      c:good&&cheap?'#4FE39B':(good?'#7AA8FF':(cheap?'#FFC65C':'#FF7A7A'))};});
  if(pts.length)charts.push(new Chart(document.getElementById('q'),{type:'bubble',
    data:{datasets:[{data:pts,backgroundColor:pts.map(function(p){return p.c+'44';}),
      borderColor:pts.map(function(p){return p.c;}),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,layout:{padding:14},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(x){var d=x.raw;
        return d.label+' · 리드당 '+W(d.x)+' · CTR '+d.y.toFixed(2)+'% · 리드 '+d.leads;}}}},
      scales:{x:{title:{display:true,text:'리드당 비용 (왼쪽이 좋음)',color:'#A6B3CC',font:{size:11}},
          ticks:{color:'#A6B3CC',font:{size:10},callback:function(v){return '₩'+(v/10000).toFixed(0)+'만';}},
          grid:{color:'rgba(255,255,255,.07)'},min:0},
        y:{title:{display:true,text:'클릭률 (위가 좋음)',color:'#A6B3CC',font:{size:11}},
          ticks:{color:'#A6B3CC',font:{size:10},callback:function(v){return v+'%';}},
          grid:{color:'rgba(255,255,255,.07)'},min:0}}}}));
  document.getElementById('qg').innerHTML=
    '<div style="margin-bottom:10px"><span class="qk qA">A</span><b>왼쪽 위 — 잘 됨</b><br><span style="margin-left:25px">예산을 여기로.</span></div>'
    +'<div style="margin-bottom:10px"><span class="qk qB">B</span><b>오른쪽 위 — 소재는 좋은데 비쌀</b><br><span style="margin-left:25px">랜딩·폼 점검.</span></div>'
    +'<div style="margin-bottom:10px"><span class="qk qD">D</span><b>왼쪽 아래 — 싸지만 안 눌림</b><br><span style="margin-left:25px">제목·이미지 교체.</span></div>'
    +'<div><span class="qk qC">C</span><b>오른쪽 아래 — 둘 다 나쁨</b><br><span style="margin-left:25px">끄거나 재작업.</span></div>'
    +'<div style="margin-top:14px;font-size:11px;color:var(--dim)">기준선은 이 기간 평균 · 리드 0인 소재는 지출×1.6으로 임시 배치</div>';

  var from=D(P.from),to=D(P.to),span=Math.max(DAY,to-from);
  var pct=function(t){return Math.max(0,Math.min(100,(t-from)/span*100));};
  var ticks=[];for(var i=0;i<4;i++){var td=new Date(from+span*(i/3));ticks.push((td.getMonth()+1)+'/'+td.getDate());}
  var th='<div class="ax"><div class="lab"></div><div class="sc">'+ticks.map(function(x){return '<span>'+x+'</span>';}).join('')
    +'</div><div class="rt">지출 · 리드</div></div>';
  var groups={};
  CR.forEach(function(c){if(/^\(/.test(c.key))return;(groups[c.channel||'기타']=groups[c.channel||'기타']||[]).push(c);});
  Object.keys(groups).forEach(function(p){
    var rows=groups[p],sp=rows.reduce(function(s,c){return s+(c.spend||0);},0),ld=rows.reduce(function(s,c){return s+(c.leads||0);},0);
    th+='<div class="grp">'+esc(p)+' <span class="tot">'+W(sp)+' · 리드 '+ld+'</span></div>';
    rows.forEach(function(c){
      var segs=(c.segments||[]).map(function(g){
        var a=pct(D(g.from)),b=pct(D(g.to)+DAY);
        return '<div class="bar" style="left:'+a+'%;width:'+Math.max(1.2,b-a)+'%;background:'+pcol(p)+'"></div>';}).join('');
      var dots=(c.lead_days||[]).map(function(d){var x=pct(D(d));
        return (x<0||x>100)?'':'<div class="dot" style="left:'+x+'%"></div>';}).join('');
      th+='<div class="r"><div class="lab'+(segs?'':' off')+'">'+esc(c.key)+'</div>'
        +'<div class="track">'+segs+dots+'</div>'
        +'<div class="rt"><b>'+W(c.spend)+'</b> · '+(c.leads||0)+'</div></div>';});
  });
  document.getElementById('tl').innerHTML=Object.keys(groups).length?th:'<div class="empty">소재 데이터 없음</div>';

  bars('chan',S.channel);bars('intr',S.interest);
  var C=j.clarity;
  document.getElementById('cl').innerHTML=C?
    [['세션',(C.sessions||0).toLocaleString(),0],['평균 체류',(C.engage||0)+'초',0],
     ['스크롤',(C.scroll||0)+'%',0],['분노',(C.rage||0)+'%',C.rage>=3],
     ['먹통',(C.dead||0)+'%',C.dead>=4],['즉시 뒤로',(C.quick||0)+'%',C.quick>=12],
     ['오류',(C.err||0)+'%',C.err>=2]]
    .map(function(x){return '<div><div class="k2">'+x[0]+'</div><div class="v2'+(x[2]?' warn':'')+'">'+x[1]+'</div></div>';}).join('')
    :'<div class="empty">Clarity 연동 대기</div>';

  var H=j.health;
  document.getElementById('health').innerHTML=(H&&H.results)?H.results.map(function(r){
    return '<div class="hl"><span class="s"><span class="dot2 '+(r.ok?'ok2':'bad2')+'"></span></span>'
      +'<span class="n2">'+esc(r.name)+'</span><span class="ms">'+(r.error?'응답없음':(r.ms?r.ms+'ms':''))+'</span></div>';}).join('')
    :'<div class="empty">점검 이력 없음</div>';

  renderLeads(j);
}

function bars(id,arr){
  var el=document.getElementById(id);
  if(!arr||!arr.length){el.innerHTML='<div class="empty">데이터 없음</div>';return;}
  var max=Math.max.apply(null,arr.map(function(x){return x[1];}));
  el.innerHTML=arr.slice(0,10).map(function(x){
    return '<div class="row"><span class="nm">'+esc(x[0])+'</span>'
      +'<span class="bar2"><i style="width:'+Math.round(x[1]/max*100)+'%"></i></span>'
      +'<span class="n">'+x[1]+'</span></div>';}).join('');
}

var STAGES=['접수','통화','견적','수주','실패'];
function toggleEd(id){var b=document.getElementById('ed-'+id);if(b)b.style.display=b.style.display==='none'?'block':'none';}
function editor(r){
  var d=r.deal||{},o=function(v){return v==null||v===0?'':v;};
  var f=function(l,n,v,ph){return '<div class="f"><label>'+l+'</label><input type="number" inputmode="numeric" data-k="'+n+'" value="'+o(v)+'" placeholder="'+(ph||'')+'"></div>';};
  return '<div class="ed" id="ed-'+esc(r.id)+'" style="display:none"><div class="fr">'
    +'<div class="f"><label>단계</label><select data-k="stage">'
    +STAGES.map(function(x){return '<option'+(d.stage===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></div>'
    +f('견적 금액','quote_amount',d.quote_amount)+'</div><div class="fr">'
    +f('월 구독료','mrr',d.mrr,'30000')+f('일시 매출','oneoff',d.oneoff)
    +f('유지 개월','term_months',d.term_months,'기본 24')+'</div>'
    +'<div class="fr"><div class="f" style="flex:1 1 100%"><label>메모 · 실패 사유</label>'
    +'<input type="text" data-k="lost_reason" value="'+esc(d.lost_reason||'')+'"></div></div>'
    +'<button class="save" onclick="saveDeal(this,\''+esc(r.id)+'\')">저장</button>'
    +'<span class="msg" id="msg-'+esc(r.id)+'"></span></div>';
}
function saveDeal(btn,id){
  var box=document.getElementById('ed-'+id),patch={};
  box.querySelectorAll('[data-k]').forEach(function(el){
    var k=el.getAttribute('data-k'),v=el.value;
    if(el.tagName==='SELECT'||k==='lost_reason')patch[k]=v;
    else patch[k]=v===''?(k==='term_months'?'':0):Number(v);});
  btn.disabled=true;
  var m=document.getElementById('msg-'+id);m.textContent='저장 중…';
  fetch('/ops/deal',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:id,patch:patch})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(){m.textContent='저장됨';setTimeout(load,400);})
    .catch(function(e){m.style.color='#FF7A7A';m.textContent='실패';btn.disabled=false;});
}
function when(ts){var d=new Date(ts),m=Math.floor((new Date()-d)/60000);
  if(m<1)return '방금';if(m<60)return m+'분 전';if(m<1440)return Math.floor(m/60)+'시간 전';
  return new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',timeZone:'Asia/Seoul'}).format(d);}

function renderLeads(j){
  var L=j.leads||[],el=document.getElementById('leads');
  document.getElementById('pend').textContent=j.pending?('미응대 '+j.pending+'건'):'';
  if(!L.length){el.innerHTML='<div class="empty">아직 접수가 없습니다</div>';return;}
  el.innerHTML='<table class="gr"><tr><th>회사·담당</th><th>소재</th><th>단계</th><th>금액</th><th>경과</th></tr>'
    +L.slice(0,40).map(function(r){
      var d=r.deal||{stage:'접수'};
      var utm=(String(r.source||'').match(/utm_content=([^·&\n]+)/)||[,''])[1].trim();
      var who=esc(r.company||r.name||r.email||'-');
      var sub=[r.name&&r.company?esc(r.name):'',esc(r.interest||''),esc(r.asset||'')].filter(Boolean).join(' · ');
      var ph=r.phone?'<a class="tel" href="tel:'+esc(r.phone).replace(/[^0-9+]/g,'')+'">'+esc(r.phone)+'</a>':'';
      var money=d.quote_amount?W(d.quote_amount):(r.ltv?W(r.ltv)+(r.ltv_assumed?'*':''):'–');
      var el2=[];
      if(r.days_to_quote!=null)el2.push('견적 '+r.days_to_quote+'일');
      if(r.days_to_win!=null)el2.push('수주 '+r.days_to_win+'일');
      return '<tr><td><div class="co">'+who+'</div>'+(sub?'<div class="mini2">'+sub+'</div>':'')
        +(ph?'<div class="mini2">'+ph+'</div>':'')
        +(r.type!=='subscribe'?editor(r):'')+'</td>'
        +'<td class="mono'+(utm?'':' none')+'">'+esc(utm||r.channel||'–')+'</td>'
        +'<td><span class="pill s-'+esc(d.stage)+'">'+esc(d.stage)+'</span>'
        +(r.type!=='subscribe'?'<div style="margin-top:5px"><button class="btn" style="padding:4px 9px;font-size:11px" onclick="toggleEd(\''+esc(r.id)+'\')">기록</button></div>':'')+'</td>'
        +'<td class="mini2">'+money+'</td><td class="mini2">'+(el2.join(' · ')||when(r.ts))+'</td></tr>';}).join('')
    +'</table>';
}

Array.prototype.forEach.call(document.querySelectorAll('#rb .btn[data-r]'),function(b){
  b.onclick=function(){
    Array.prototype.forEach.call(document.querySelectorAll('#rb .btn[data-r]'),function(x){x.classList.remove('on');});
    b.classList.add('on');PERIOD={p:b.getAttribute('data-r'),from:null,to:null};load();};
});
document.getElementById('apply').onclick=function(){
  var f=document.getElementById('f').value,t=document.getElementById('t').value;
  if(!f||!t||f>t){alert('시작일이 종료일보다 늦습니다');return;}
  Array.prototype.forEach.call(document.querySelectorAll('#rb .btn[data-r]'),function(x){x.classList.remove('on');});
  PERIOD={p:'30d',from:f,to:t};load();};
load();
setInterval(function(){if(document.visibilityState==='visible')load();},120000);
