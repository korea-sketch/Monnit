import re,json,sys
import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC=os.path.join(ROOT,'source','remote-monitoring','landing_template.html')
OUT=os.path.join(ROOT,'promo-remote.html')
t=open(SRC,encoding='utf-8').read()

# ---------- strip artifact-only head bits ----------
t=re.sub(r'^<title>.*?</title>\n<meta name="claude:viewport-fit-sides"[^\n]*\n<meta name="description"[^\n]*\n<link rel="preconnect"[^\n]*\n<link rel="stylesheet"[^\n]*\n','',t,flags=re.S)
t=re.sub(r'@font-face\{font-family:"Pretendard";src:url\(data:font/woff2;base64,\{\{FONT\}\}\)[^\n]*\n','',t)
t=t.replace('--sans:"Pretendard",-apple-system','--sans:"Pretendard Variable","Pretendard",-apple-system')

# ---------- assets ----------
t=t.replace('src="data:video/mp4;base64,{{VIDEO}}"','src="/videos/promo-remote.mp4" poster="/images/remote/poster.jpg"')
for k,v in {'bld':'zones','alert':'alert','worker':'worker','dash':'platform'}.items():
    W,H={'zones':(1000,950),'alert':(1000,950),'worker':(1000,1250),'platform':(1100,1273)}[v]
    t=t.replace('src="data:image/jpeg;base64,{{IMG_%s}}"'%k,'src="/images/remote/%s.jpg" width="%d" height="%d" decoding="async"'%(v,W,H))
t=t.replace("'refs/'+r.k","'/images/remote/refs/'+r.k")
assert '{{' not in t, re.findall(r'\{\{\w+\}\}',t)

# ---------- header: real logo + promotions link + phone ----------
t=t.replace('''    <a class="brand" href="#top" aria-label="모넷코리아">
      <span class="wordmark">MONNIT<sup>®</sup></span><small>모넷코리아</small>
    </a>''','''    <a class="brand" href="/" aria-label="Monnit Korea 홈">
      <picture><source srcset="/assets/brand/monnit-korea-white-480.webp" type="image/webp"><img class="brand-logo" src="/assets/brand/monnit-korea-white-480.png" alt="MONNIT KOREA" width="488" height="62"></picture>
    </a>''')
t=t.replace('.wordmark{font-weight:800;font-size:20px;letter-spacing:.08em;color:#fff}\n.wordmark sup{font-size:9px;font-weight:600;margin-left:1px}',
'.brand-logo{display:block;height:20px;width:auto}\n.nav-tel{font-family:var(--mono);font-size:13px;color:var(--muted);text-decoration:none;white-space:nowrap}\n.nav-tel:hover{color:var(--fg)}\n.nav-right{display:flex;align-items:center;gap:16px}\n.nav .btn{white-space:nowrap}\n.btn-home{height:40px;padding:0 14px;font-size:14px;border-radius:10px;gap:7px}\n.btn-home svg{width:17px;height:17px;flex:none}\n.btn-home .sm{display:none}\n.btn-home:hover svg{transform:none}\n@media (max-width:560px){.nav-tel{display:none}.brand-logo{height:17px}.nav-right{gap:8px}.btn-home{padding:0 12px;gap:5px}.btn-home .lg{display:none}.btn-home .sm{display:inline}}')
t=t.replace('<a href="#process">도입 절차</a>\n    </nav>\n    <a class="btn btn-primary" href="#contact">도입 문의</a>',
 '<a href="#refs">설치 사례</a><a href="#faq">FAQ</a><a href="/promotions">전체 프로모션</a>\n    </nav>\n    <div class="nav-right"><a class="btn btn-ghost btn-home" href="/" data-cta="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg><span class="lg">홈으로 가기</span><span class="sm">홈</span></a><a class="nav-tel" href="tel:+82220881454" data-cta="tel-nav">02-2088-1454</a><a class="btn btn-primary" href="#contact" data-cta="nav">도입 문의</a></div>')
t=t.replace('<a href="#zones">관제 대상</a><a href="#detect">위험 감지</a><a href="#alert">즉시 알림</a><a href="#platform">통합 관제</a>',
            '<a href="#zones">관제 대상</a><a href="#detect">위험 감지</a><a href="#alert">즉시 알림</a><a href="#platform">통합 관제</a>')

t=t.replace('html{scroll-behavior:smooth}','html{scroll-behavior:smooth}\nsection[id],#top{scroll-margin-top:72px}\n[tabindex="-1"]:focus{outline:none}',1)
# ---------- breadcrumb (SEO) ----------
t=t.replace('<main id="top">','<main id="top">\n  <nav class="crumb wrap" aria-label="현재 위치"><a href="/">홈</a><span aria-hidden="true">›</span><a href="/promotions">프로모션</a><span aria-hidden="true">›</span><span aria-current="page">건물 원격 통합 관제</span></nav>')
t=t.replace('/* hero */','.crumb{display:flex;gap:8px;align-items:center;padding-block:14px 0;font-size:12px;color:var(--dim)}\n.crumb a{text-decoration:none;color:var(--muted)}\n.crumb a:hover{color:var(--fg)}\n/* hero */',1)

# ---------- FAQ section ----------
FAQ=[
 ('배선 공사 없이 정말 설치되나요?','센서와 게이트웨이는 국내 전용 940MHz 무선으로 연결되고, 센서는 배터리로 동작합니다. 게이트웨이 전원만 확보되면 설비를 멈추거나 배선을 새로 깔지 않고 부착만으로 설치합니다.'),
 ('어떤 설비를 감시할 수 있나요?','제어반 차단기 트립과 전압 이상, 기계실 펌프·모터 진동, 배관 누수와 바닥 침수, EPS실·수변전실의 온도 상승, 소방수신기 주경종 작동 신호(DC24V) 등을 감시합니다. 현장 진단에서 설비별로 맞는 센서를 정합니다.'),
 ('알림은 어떻게 받나요?','이상이 감지되면 지정한 담당자에게 문자메시지(SMS)와 이메일로 알리고, 웹·모바일 대시보드에서 상태와 이력을 확인할 수 있습니다. 음성 전화 알림은 제공하지 않습니다.'),
 ('정전이 되면 감시가 멈추나요?','게이트웨이에 배터리가 내장되어 있어 정전 시에도 2~3일 동안 작동하며 수집과 알림을 이어갑니다.'),
 ('게이트웨이 1대로 센서를 몇 개까지 연결하나요?','게이트웨이 1대가 반경 내 센서 250개를 매핑할 수 있습니다. 대형 건물도 적은 장비로 구성되고, 건물이 늘어나면 게이트웨이를 추가해 확장합니다.'),
 ('여러 건물을 한 화면에서 볼 수 있나요?','iMonnit Scube 전용 플랫폼에서 건물·사업장별 센서 상태를 하나의 대시보드로 확인합니다. 정상·경고·알람 상태가 색으로 구분되고 측정 이력과 알람 기록이 남습니다.'),
 ('도입 비용은 어떻게 정해지나요?','건물 수, 감시할 설비 종류와 수량, 통신 환경에 따라 달라집니다. 문의를 남겨 주시면 현장 진단 후 센서 구성과 견적을 안내해 드립니다.'),
]
faq_html='\n'.join(f'        <details class="qa"{" open" if i==0 else ""}><summary>{q}</summary><p>{a}</p></details>' for i,(q,a) in enumerate(FAQ))
FAQ_SEC=f'''  <section class="faq" id="faq">
    <div class="wrap">
      <div class="sec-head">
        <span class="eyebrow">자주 묻는 질문</span>
        <h2>도입 전에 <b>많이 물어보시는 것</b></h2>
      </div>
      <div class="qa-list">
{faq_html}
      </div>
    </div>
  </section>

'''
t=t.replace('  <section class="contact" id="contact">',FAQ_SEC+'  <section class="contact" id="contact">',1)
t=t.replace('/* contact */','''/* faq */
.faq{padding-block:110px;border-top:1px solid var(--line)}
.qa-list{margin-top:40px;display:grid;gap:10px;max-width:880px}
.qa{border:1px solid var(--line);border-radius:14px;background:var(--bg-2);transition:border-color .2s}
.qa[open]{border-color:rgba(63,167,255,.4)}
.qa summary{list-style:none;cursor:pointer;padding:18px 52px 18px 20px;font-weight:700;font-size:16px;position:relative}
.qa summary::-webkit-details-marker{display:none}
.qa summary::after{content:"";position:absolute;right:22px;top:50%;width:10px;height:10px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:translateY(-70%) rotate(45deg);transition:transform .25s}
.qa[open] summary::after{transform:translateY(-30%) rotate(-135deg)}
.qa p{padding:0 20px 20px;color:var(--muted);font-size:15px;line-height:1.7}
@media (max-width:560px){.faq{padding-block:64px}.qa summary{font-size:15px;padding:16px 46px 16px 16px}.qa p{padding:0 16px 16px;font-size:14.5px}}
/* contact */''',1)

# ---------- form: marketing consent + privacy link + honest success panel ----------
t=t.replace('''<label class="agree" for="f-agree"><input type="checkbox" id="f-agree" name="agree"><span>문의 응대를 위한 개인정보(회사명, 담당자명, 연락처, 이메일) 수집·이용에 동의합니다. 수집한 정보는 상담 목적 달성 후 지체 없이 파기합니다.</span></label>''',
'''<label class="agree" for="f-agree"><input type="checkbox" id="f-agree" name="agree"><span><b>[필수]</b> 문의 응대를 위한 개인정보(회사명, 담당자명, 연락처, 이메일) 수집·이용에 동의합니다. 수집한 정보는 상담 목적 달성 후 지체 없이 파기합니다. <a href="/privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></span></label>
          <label class="agree" for="f-mkt"><input type="checkbox" id="f-mkt" name="mkt"><span>[선택] 신규 프로모션·기술 자료 등 마케팅 정보 수신에 동의합니다.</span></label>''')
t=re.sub(r'        <form class="done" id="done" hidden>.*?        </form>\n','''        <div class="done" id="done" hidden tabindex="-1">
          <div class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
          <h3>문의가 접수되었습니다</h3>
          <p id="doneMsg">담당자가 내용을 확인한 뒤 남겨 주신 연락처로 연락드립니다.</p>
          <p>급한 상황이라면 <a href="tel:+82220881454" data-cta="tel-done">02-2088-1454</a> 또는 <a href="mailto:korea@monnit.com">korea@monnit.com</a>으로 바로 연락 주세요.</p>
          <div class="acts"><a class="btn btn-ghost" href="/" data-cta="home-done">홈으로 가기</a><a class="btn btn-ghost" href="#refs">설치 사례 보기</a><a class="btn btn-ghost" href="/promotions">다른 프로모션 보기</a></div>
        </div>
''',t,flags=re.S)
t=t.replace('.done{text-align:left}','.done{text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:36px}\n.done .ok-ic{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:rgba(52,210,180,.14);color:var(--ok);margin-bottom:16px}\n.done .ok-ic svg{width:26px;height:26px}\n.done a{color:var(--accent)}')
t=t.replace('.agree input{margin-top:3px;accent-color:var(--accent-2)}','.agree input{margin-top:3px;accent-color:var(--accent-2);flex:none}\n.agree a{color:var(--accent)}')

# ---------- submit logic (site lead pipeline) ----------
old=t[t.index("  var f=document.getElementById('inq'),done="):t.index("  var reduce=window.matchMedia")]
NEW=r'''  /* ── 문의 접수 ─────────────────────────────────────────────
     /promo/residence 와 같은 경로입니다.
       1순위  MonnitLead.submit → /api/lead (원장·먼데이·담당자 메일·고객 접수확인 메일·메타 전환 API)
       2순위  StaticForms → Web3Forms (서버가 응답하지 않을 때만, 담당자 메일)
       3순위  메일 앱 (둘 다 실패했을 때) + 원장에만 기록
     접점 promo_remote · 관심분야 「건물 원격 통합 관제」 — 먼데이·ops·고객 메일이 이 값으로 갈립니다. */
  var PAGE='promo_remote', INTEREST='건물 원격 통합 관제';
  var CONTACT_EMAIL='korea@monnit.com';
  var LOCAL=(typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|.*\.local)$/.test(location.hostname));
  var STATICFORMS_URL='https://api.staticforms.dev/submit';
  var STATICFORMS_KEY=LOCAL?'':'sf_e026c9ef91b8eaeba9d1d472';
  var WEB3FORMS_KEY=LOCAL?'':'e4d5cb03-1b25-425c-a47d-f04e4a05e7e2';
  var f=document.getElementById('inq'),done=document.getElementById('done'),err=document.getElementById('err');
  var opened=false;
  f.addEventListener('focusin',function(){
    if(opened)return;opened=true;
    try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'monnit_form_open',form_name:PAGE});}catch(e){}
  });
  function v(id){return document.getElementById(id).value.trim()}
  function mark(id,bad){var el=document.getElementById(id);el.classList.toggle('bad',!!bad);el.setAttribute('aria-invalid',bad?'true':'false');}
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=f.querySelector('button[type=submit]');
    if(btn.disabled)return;
    var VAL=window.MonnitValid;
    var miss=[];
    var telR=VAL&&VAL.phone?VAL.phone(v('f-tel')):null, mailR=(v('f-mail')&&VAL&&VAL.email)?VAL.email(v('f-mail')):null;
    var telOk=telR?!!telR.ok:/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(v('f-tel').replace(/\s/g,''));
    var mailOk=!v('f-mail')||(mailR?!!mailR.ok:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('f-mail')));
    mark('f-co',!v('f-co'));mark('f-name',!v('f-name'));mark('f-tel',!telOk);mark('f-mail',!mailOk);
    if(!v('f-co'))miss.push('회사·기관명');
    if(!v('f-name'))miss.push('담당자명');
    if(!telOk)miss.push('연락처');
    if(!mailOk)miss.push('이메일 형식');
    if(miss.length){var hint=(!telOk&&v('f-tel')&&telR&&telR.message)?' ('+telR.message+')':(!mailOk&&mailR&&mailR.message)?' ('+mailR.message+')':'';err.textContent=miss.join(', ')+'을(를) 확인해 주세요.'+hint;var b=f.querySelector('.bad');if(b)b.focus();return}
    if(!document.getElementById('f-agree').checked){err.textContent='[필수] 개인정보 수집·이용에 동의해 주세요.';return}
    err.textContent='';
    var zones=[].slice.call(f.querySelectorAll('input[name=zone]:checked')).map(function(i){return i.value}).join(', ');
    var now=new Date().toLocaleString('ko-KR');
    var payload={
      _subject:'[원격 통합 관제 문의] '+v('f-co')+' / '+v('f-name'),
      '신청 프로모션':'건물 원격 통합 관제',
      '관심분야':INTEREST,
      '회사명':v('f-co'),'담당자명':v('f-name'),'전화번호':v('f-tel'),'이메일':(v('f-mail')||''),
      '관제 대상 건물 수':v('f-size'),
      '시설 유형':(zones||'(미선택)'),
      '문의 사항':(v('f-msg')||'(미기재)'),
      '개인정보 수집·이용 동의(필수)':'동의','마케팅 정보 수신(선택)':(document.getElementById('f-mkt').checked?'동의':'미동의'),'동의 일시':now,
      '접수 경로':'프로모션 랜딩(/promo/remote)'
    };
    var ML=window.MonnitLead;
    try{ if(ML) ML.build('contact',PAGE,'건물 원격 통합 관제 — '+v('f-co'),payload); else { payload['접점']=PAGE; payload['유입 페이지']=String(location.href).split('#')[0]; } }catch(x){}
    var label=btn.firstChild.nodeValue;
    btn.disabled=true;btn.firstChild.nodeValue='보내는 중… ';btn.style.opacity='.7';
    function unlock(){btn.disabled=false;btn.firstChild.nodeValue=label;btn.style.opacity='';}
    function success(via){
      unlock();
      try{ if(ML){ if(via==='browser')ML.setNotified(true); if(via==='mail')ML.recordPending(payload); else ML.track('contact',{page:PAGE,interest:INTEREST}); } }catch(x){}
      try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'lead_submit',form_name:PAGE,buildings:v('f-size'),zones:zones||''});}catch(x){}
      document.getElementById('doneMsg').textContent=v('f-co')+' · '+v('f-name')+' 님, 문의가 접수되었습니다. 담당자가 내용을 확인한 뒤 남겨 주신 연락처로 연락드립니다.';
      /* 주소(history)는 바꾸지 않습니다 — GTM 의 기록 변경 트리거·GA4 향상된 측정이 page_view 를 한 번 더 잡습니다 */
      f.hidden=true;done.hidden=false;done.focus({preventScroll:true});done.scrollIntoView({behavior:'smooth',block:'center'});
    }
    function mailApp(){
      var b='■ 건물 원격 통합 관제 문의\n\n회사·기관명: '+v('f-co')+'\n담당자: '+v('f-name')+'\n연락처: '+v('f-tel')+'\n이메일: '+(v('f-mail')||'-')+'\n건물 수: '+v('f-size')+'\n관제 설비: '+(zones||'-')+'\n문의 내용: '+(v('f-msg')||'-')+'\n신청 시각: '+now;
      window.location.href='mailto:'+CONTACT_EMAIL+'?subject='+encodeURIComponent(payload._subject)+'&body='+encodeURIComponent(b);
      success('mail');
    }
    function web3(){
      if(!WEB3FORMS_KEY)return mailApp();
      var fd={access_key:WEB3FORMS_KEY,subject:payload._subject,from_name:'Monnit Korea 웹사이트',email:(v('f-mail')||'no-reply@monnit.co.kr'),replyto:(v('f-mail')||''),botcheck:false};
      Object.keys(payload).forEach(function(k){if(k!=='_subject')fd[k]=payload[k];});
      fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(fd)})
        .then(function(r){return r.json();}).then(function(j){(j&&(j.success===true||j.success==='true'))?success('browser'):mailApp();})
        .catch(mailApp);
    }
    function viaBrowser(){
      if(!STATICFORMS_KEY)return web3();
      fetch(STATICFORMS_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify(Object.assign({apiKey:STATICFORMS_KEY,subject:payload._subject,email:(v('f-mail')||''),replyTo:'@',honeypot:''},payload))})
        .then(function(r){return r.json().then(function(j){return r.ok&&!!j.success;}).catch(function(){return r.ok;});})
        .then(function(ok){ok?success('browser'):web3();}).catch(web3);
    }
    (ML&&ML.submit?Promise.resolve().then(function(){ML.setNotified(false);return ML.submit(payload);}).catch(function(){return false;}):Promise.resolve(false))
      .then(function(served){ served?success('server'):viaBrowser(); });
  });
  f.querySelectorAll('input,textarea').forEach(function(el){el.addEventListener('input',function(){el.classList.remove('bad');el.removeAttribute('aria-invalid');});});
  try{ if(/[?&]submitted=1/.test(location.search)){ f.hidden=true; done.hidden=false; } }catch(x){}

  /* 페이지 안 이동(#zones 등)은 주소의 # 를 바꾸지 않고 스크롤만 합니다.
     # 가 바뀌면 GTM 기록 변경(gtm.historyChange)·GA4 향상된 측정이 그때마다 page_view 를 다시 보내
     페이지뷰가 부풀려집니다. */
  document.addEventListener('click',function(ev){
    var a=ev.target.closest&&ev.target.closest('a[href^="#"]');if(!a)return;
    var id=a.getAttribute('href');if(id.length<2)return;
    var el=document.getElementById(id.slice(1));if(!el)return;
    ev.preventDefault();
    el.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    if(el.tabIndex<0&&!/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName))el.setAttribute('tabindex','-1');
    try{el.focus({preventScroll:true});}catch(x){}
  });

  /* 전화·메일 클릭 — GTM 에서 보조 전환으로 씁니다 */
  document.querySelectorAll('a[href^="tel:"],a[href^="mailto:"]').forEach(function(a){
    a.addEventListener('click',function(){try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'monnit_contact',form_name:PAGE,method:a.href.indexOf('tel:')===0?'tel':'email',cta:a.getAttribute('data-cta')||''});}catch(x){}});
  });

'''
t=t.replace(old,NEW)
t=t.replace("input[type=text],input[type=tel],input[type=email],select,textarea{","input.bad,textarea.bad{border-color:var(--alert)!important}\ninput[type=text],input[type=tel],input[type=email],select,textarea{")
# remove copySum/edit leftovers
assert "copySum" not in t and "getElementById('edit')" not in t, 'leftover'

# ---------- footer links ----------
t=t.replace('<span>© 주식회사 모넷코리아</span>','<span>© 주식회사 모넷코리아</span>\n    <a href="/">홈으로 가기</a>').replace('<a href="#">서비스 이용약관(SLA)</a>','<a href="/sla-consent.html">서비스 이용약관(SLA)</a>').replace('<a href="#">개인정보처리방침</a>','<a href="/privacy.html">개인정보처리방침</a>')

# ---------- mobile cta tracking attr ----------
t=t.replace('<div class="mcta"><a class="btn btn-primary" href="#contact">','<div class="mcta"><a class="btn btn-primary" href="#contact" data-cta="mbar">')

# ---------- head ----------
TITLE='건물 원격 통합 관제 — 배선 공사 없는 무선 IoT 설비 감시 | Monnit Korea'
DESC='제어반·기계실·EPS실·수변전실에 무선 센서를 붙여 여러 건물의 과열·화재·누수·정전을 실시간 감지하고 담당자 휴대폰으로 즉시 알립니다. 배선 공사 없이 설치, 게이트웨이 1대당 센서 250개, 정전 시 2~3일 자립 운전.'
URL='https://monnit.co.kr/promo/remote/'
OG='https://monnit.co.kr/images/promo-remote-og.jpg'
graph={"@context":"https://schema.org","@graph":[
 {"@type":"WebPage","@id":URL+"#page","url":URL,"name":TITLE,"description":DESC,"inLanguage":"ko-KR",
  "isPartOf":{"@type":"WebSite","@id":"https://monnit.co.kr/#website","name":"Monnit Korea","url":"https://monnit.co.kr/"},
  "breadcrumb":{"@id":URL+"#crumb"},"primaryImageOfPage":OG,"about":{"@id":URL+"#service"},"publisher":{"@id":"https://monnit.co.kr/#org"},
  "datePublished":"2026-11-02","dateModified":"2026-11-02"},
 {"@type":"BreadcrumbList","@id":URL+"#crumb","itemListElement":[
  {"@type":"ListItem","position":1,"name":"홈","item":"https://monnit.co.kr/"},
  {"@type":"ListItem","position":2,"name":"프로모션","item":"https://monnit.co.kr/promotions"},
  {"@type":"ListItem","position":3,"name":"건물 원격 통합 관제","item":URL}]},
 {"@type":"Service","@id":URL+"#service","name":"건물 원격 통합 관제","serviceType":"무선 IoT 건물 설비 원격 모니터링",
  "description":"제어반·기계실·EPS실·수변전실에 배터리형 무선 센서를 설치해 과열·화재·누수·정전·진동 이상을 실시간 감지하고 문자메시지·이메일·대시보드로 담당자에게 알리는 원격 통합 관제 서비스",
  "provider":{"@id":"https://monnit.co.kr/#org"},"areaServed":{"@type":"Country","name":"대한민국"},
  "audience":{"@type":"BusinessAudience","audienceType":"건물 시설관리·FM·자산관리 담당자"},
  "availableChannel":{"@type":"ServiceChannel","serviceUrl":URL,"servicePhone":"+82-2-2088-1454"},
  "termsOfService":"https://monnit.co.kr/sla-consent.html"},
 {"@type":"Organization","@id":"https://monnit.co.kr/#org","name":"Monnit Korea","alternateName":"주식회사 모넷코리아","url":"https://monnit.co.kr/","logo":"https://monnit.co.kr/logo.png",
  "email":"korea@monnit.com","telephone":"+82-2-2088-1454",
  "address":{"@type":"PostalAddress","streetAddress":"효령로 380, 2층","addressLocality":"서초구","addressRegion":"서울특별시","addressCountry":"KR"},
  "contactPoint":{"@type":"ContactPoint","telephone":"+82-2-2088-1454","email":"korea@monnit.com","contactType":"sales","areaServed":"KR","availableLanguage":["ko","en"]}},
 {"@type":"VideoObject","name":"건물 원격 통합 관제 소개 영상","description":"여러 건물의 주요 설비를 무선 IoT로 원격 통합 관제하는 흐름 — 관제 대상, 실시간 위험 감지, 휴대폰 알림, 통합 관제 화면",
  "thumbnailUrl":"https://monnit.co.kr/images/remote/poster.jpg","contentUrl":"https://monnit.co.kr/videos/promo-remote.mp4","uploadDate":"2026-10-29T09:00:00+09:00","duration":"PT18S","inLanguage":"ko"},
 {"@type":"FAQPage","@id":URL+"#faq","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in FAQ]}
]}
HEAD=f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<script>/* 광고 테스트 쿠키 자동 청소 — 가짜 클릭ID(_gcl_*=...TEST...)가 남아 있으면
   구글 수집 요청이 전부 503으로 거절되며 콘솔에 오류가 쌓입니다. 발견 즉시 제거. */
(function(){{try{{document.cookie.split(';').forEach(function(c){{var i=c.indexOf('='),n=c.slice(0,i).trim(),v=c.slice(i+1);
if(/^_gcl_(aw|dc|gb|gs)$/.test(n)&&/TEST/i.test(v)){{['','; domain=.monnit.co.kr','; domain=monnit.co.kr'].forEach(function(d){{
document.cookie=n+'=; path=/'+d+'; expires=Thu, 01 Jan 1970 00:00:00 GMT';}});}}}});}}catch(e){{}}}})();
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#060A13">
<!-- 원본: source/remote-monitoring/ · 빌드 사본: promo/remote/index.html (build.js 가 생성) · 2026-11-02 -->
<!-- 측정: monnit-consent 가 GTM(GTM-T8H73VW)을 올리고 GA4·Clarity·메타 픽셀은 그 안에서 동의 후 발화합니다.
     이 페이지에 gtag('config')·fbq('init') 을 직접 넣지 마십시오 — 페이지뷰가 두 번 잡힙니다. -->
<script>window.MONNIT_CONSENT_CONFIG={{gtmId:'GTM-T8H73VW',ga4Id:'G-49THHRYKR4',clarityId:'xikw9t2skq',privacyUrl:'/privacy.html',mobileBanner:true}};</script>
<script src="/js/monnit-consent.js?v=112"></script>
<script src="/js/monnit-lead.js?v=6"></script>
<script src="/js/monnit-track.js?v=1" defer></script>
<script src="/valid.js?v=2" defer></script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<meta name="keywords" content="건물 원격 관제, 원격 통합 관제, 시설관리 IoT, 무선 센서, 기계실 모니터링, 수변전실 온도 감시, EPS실 과열, 제어반 차단기 트립, 누수 감지, 정전 알림, 소방수신기 연동, 모넷코리아">
<link rel="canonical" href="{URL}">
<meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Monnit Korea">
<meta property="og:title" content="여러 건물의 주요 설비를 원격으로 통합 관제 | Monnit Korea">
<meta property="og:description" content="배선 공사 없는 무선 IoT로 제어반·기계실·EPS실·수변전실의 과열·화재·누수·정전을 실시간 감지하고 휴대폰으로 즉시 알립니다.">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="{OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="여러 건물의 주요 설비를 원격으로 통합 관제">
<meta property="og:video" content="https://monnit.co.kr/videos/promo-remote.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="여러 건물의 주요 설비를 원격으로 통합 관제 | Monnit Korea">
<meta name="twitter:description" content="배선 공사 없이 설치하는 무선 IoT 원격 통합 관제 — 과열·화재·누수·정전 실시간 감지, 휴대폰 즉시 알림.">
<meta name="twitter:image" content="{OG}">
<script type="application/ld+json">{json.dumps(graph,ensure_ascii=False,separators=(',',':'))}</script>

<link rel="preload" as="image" href="/images/remote/poster.jpg">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<!-- Pretendard 지연 로드 — 첫 렌더를 막지 않습니다 (promo-proposal 과 같은 방식) -->
<link rel="stylesheet" media="print" onload="this.media='all'" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"></noscript>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" media="print" onload="this.media='all'" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap">
'''
t=HEAD+t
# body wrapper
t=t.replace('</style>\n\n<div class="progress"','</style>\n</head>\n<body>\n<div class="progress"',1)
t=t.rstrip()+'\n</body>\n</html>\n'
assert '</head>' in t and '<body>' in t
open(OUT,'w',encoding='utf-8').write(t)
print('written',len(t))
