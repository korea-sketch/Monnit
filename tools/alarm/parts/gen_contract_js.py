js=open('contract_orig.js',encoding='utf-8').read()
def rep(s,a,b):
    assert s.count(a)==1,(a[:50],s.count(a)); return s.replace(a,b)
a=js.find('  var TERMFIELDS'); b=js.find('  /* ── 단계 이동 ── */')
seg=js[a:b]
def grab(name):
    i=seg.find('  function '+name); j=seg.find('\n  }\n',i)+5; return seg[i:j]
helpers = grab('kdate') + grab('esc')
new_terms = open('contract_terms.js',encoding='utf-8').read()
js = js[:a] + helpers + new_terms + js[b:]
js = rep(js, '  var API = "/api/contract";', '  var API = "/api/alarm/contract";')
js = rep(js, '''      var n = Number(b.dataset.go);
      if(n >= 3 && !slaAgreedAt){ openSla(b, true); return; }''', '''      var n = Number(b.dataset.go);
      if(!T) return;
      if(n >= 3 && !slaAgreedAt){ openSla(b, true); return; }''')
a=js.find('    var now = new Date();\n    var body = {'); assert a>0; b=js.find('    var out = null;')
js = js[:a] + open('contract_body.js',encoding='utf-8').read() + js[b:]
js = rep(js, 'var no = (ok && out.ref) ? out.ref : body.ref;', 'var no = (ok && out.ref) ? out.ref : "미접수";')
js = rep(js, '$("d_price").textContent = won(body.terms.monthly) + " / 월 (부가세 별도)";', '$("d_price").textContent = won(T.monthly) + " / 월 (부가세 별도)";')
js = rep(js, '''$("d_mail").textContent = !ok ? "전송되지 않음"
      : (out.mailed ? "모넷코리아로 계약서가 전송되었습니다"
                    : "접수되었습니다 (메일 알림은 지연될 수 있습니다)");''', '''$("d_mail").textContent = ok ? "모넷코리아에 접수되었습니다"
      : (out && out.error === "offer_signed" ? "이미 체결된 링크입니다" : "전송되지 않음");''')
js = rep(js, '  function refNo(){', '  function ymd(d){ var p=function(n){return String(n).padStart(2,"0");}; return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }\n  function refNo(){')
js = rep(js, ' *  조건은 담당자가 만든 링크(#c=…)에 담겨 온다. 이 화면에서는 고칠 수 없다.\n *  제출은 POST /api/contract 한 번. 서버가 원장에 기록하고\n *  0702yeom@gmail.com 으로 알림 메일을 보낸다.',
         ' *  조건은 담당자가 관리 화면(/contract-admin)에서 만든 링크(?id=…)로 서버에서 받아 온다.\n *  고객 화면에서는 고칠 수 없고, 제출 시에도 서버는 저장된 조건만 쓴다.\n *  제출은 POST /api/alarm/contract 한 번. 서버가 기록 후 기존 /api/contract 로 전달해\n *  기존 알림 메일도 그대로 나간다.')
open('contract.js','w',encoding='utf-8').write(js)
