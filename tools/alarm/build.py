"""알리미 계약·설문·SLA 페이지 빌드.  python3 build.py  → site/ 아래 생성"""
import pathlib, re
R = pathlib.Path(__file__).parent
P = R / "parts"
OUT = R.parent.parent
rd = lambda n: (P / n).read_text(encoding="utf-8")

def rep(s, a, b, n=1):
    c = s.count(a)
    assert c == n, (a[:60], c)
    return s.replace(a, b)

STYLE = rd("style.css") + rd("extra.css") + ".annex-head{border-top:2px solid var(--rule-strong);margin-top:10px} .annex[hidden]{display:none} .chk[hidden]{display:none}"
ARTICLES = rd("sla_articles.html")
ANNEX_B = rd("sla_annex.html")
FOOTER = rd("footer.html")
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700'
         '&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Serif+KR:wght@500;600&display=swap">\n')

def head(title, desc, extra_css=""):
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="description" content="{desc}">
<title>{title} | 모넷코리아</title>
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#F4F7F4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#13171A" media="(prefers-color-scheme: dark)">
{FONTS}<style>{STYLE}{extra_css}</style>
</head>
"""

SUPPL = """
    <div class="article">
      <h3><span class="no">부 칙</span><span>기존 이용 고객에 대한 적용</span></h3>
      <ol class="cl">
        <li>본 SLA 시행 전에 이용계약을 체결한 고객에게는, 고객이 본 SLA에 <mark>동의한 날부터</mark> 본 SLA를 적용합니다.</li>
        <li>동의한 날 전에 발생한 사유에 대해서는 종전 이용계약의 조건을 적용합니다.</li>
        <li>본 SLA에 대한 동의로 계약 기간, 이용 요금, 지급 조건, 최소 이용기간 등 종전 이용계약의 다른 조건은 변경되지 않습니다.</li>
        <li>고객이 동의하지 않는 경우에도 서비스는 종전 이용계약의 조건에 따라 계속 제공됩니다.</li>
      </ol>
    </div>"""

def articles(existing=False):
    a = ARTICLES
    if existing:
        a = rep(a, "고객은 계약 체결 전에 본 SLA 전문을 제공받아 열람하였고",
                "고객은 본 SLA에 동의하기 전에 그 전문을 제공받아 열람하였고")
    a += ANNEX_B
    if existing:
        a += SUPPL
    # 시행일은 문서 맨 끝에 작은 글씨로만 (상단 큰 표기는 2026-10-16 요청으로 제거)
    a += '\n    <p class="fineprint">본 서비스수준협약은 2026년 10월 16일부터 시행합니다. · 주식회사 모넷코리아</p>'
    return a

def modal(existing=False, foot=True):
    scope = "제1조 ~ 제18조 · 부속서 B · 부칙" if existing else "제1조 ~ 제18조 · 부속서 B"
    agree_txt = ("위 서비스수준협약(SLA) 전문을 확인하였습니다." if existing else
                 "위 서비스수준협약(SLA) 전문을 확인하였으며, <b>제3조·제4조·제6조·제10조·제11조</b>를 포함한 그 내용에 동의합니다.")
    btn = "확인 완료" if existing else "동의하고 계속"
    allbtn = "확인 완료" if existing else "전체 동의하고 계속"
    footer = f"""
    <div class="mfoot">
      <label class="magree" for="slaAgree">
        <input type="checkbox" id="slaAgree">
        <span>{agree_txt}</span>
      </label>
      <div class="mfootbar">
        <span class="hint" id="slaprog">{scope} 전문 · 한 번에 스크롤해서 확인하실 수 있습니다</span>
        <span class="spacer"></span>
        <button type="button" class="btn quiet" data-close>닫기</button>
        <button type="button" class="btn" id="slaAgreeBtn" hidden>{btn}</button>
        <button type="button" class="btn" id="agreeAllBtn">{allbtn}</button>
      </div>
    </div>""" if foot else ""
    return f"""
<div class="modal" id="slamodal" role="dialog" aria-modal="true" aria-labelledby="slatitle" hidden>
  <div class="backdrop" data-close></div>
  <div class="msheet">
    <div class="mhd">
      <div>
        <h2 id="slatitle">긴급 경보 알리미 서비스수준협약서(SLA)</h2>
      </div>
      <span class="spacer"></span>
      <a class="btn quiet slapdf" href="/alarm/sla.pdf" download="모넷코리아_긴급경보알리미_SLA.pdf" style="text-decoration:none">PDF</a>
      <button type="button" class="btn quiet" data-close aria-label="닫기">닫기</button>
    </div>
    <div class="mbody compact" id="mbody" tabindex="0">{articles(existing)}
    </div>{footer}
  </div>
</div>
"""

def page(name, title, desc, body, js, extra_css="", existing=False, with_modal=True, foot=True):
    html = head(title, desc, extra_css) + body + (modal(existing, foot) if with_modal else "") + \
        "\n</main>\n\n" + FOOTER + "\n<script>" + js + "</script>\n</body>\n</html>\n"
    (OUT / name).parent.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(html, encoding="utf-8")
    print("built", name, len(html))

# ───────── 1. 고객용 계약 화면 ─────────
def build_contract():
    b = rd("contract_body_orig.html")
    p0a = b.find('<section class="pane on" id="p0"'); p0b = b.find('<section class="pane" id="p1"')
    b = b[:p0a] + rd("contract_p0.html") + "\n" + b[p0b:]
    b = rep(b, "<h1>무선 소방 알리미 구독서비스 계약서</h1>", "<h1>긴급 경보 알리미 구독서비스 계약서</h1>")
    b = rep(b, '<dt>사용 금액</dt><dd><b class="money" id="v_price">월 ￦20,000</b> (부가세 별도) · <span id="v_sites">1개소</span> 기준</dd>',
            '<dt>사용 금액</dt><dd><b class="money" id="v_price">—</b> (부가세 별도) · <span id="v_sites">—</span><span id="v_disc"></span></dd>')
    i = b.find('  <div class="note">\n    <span class="tag">계약 기간 안내</span>'); j = b.find("</div>", i) + 6
    b = b[:i] + b[j:]
    b = rep(b, "SLA 제6조 제2호에 따라", "SLA 제7조 제2호에 따라")
    b = rep(b, "소비자 (B2C) — SLA 제16조 특칙 적용", "소비자 (B2C) — SLA 소비자 특칙 적용")
    b = rep(b, "아울러 최초 <b>3년 의무계약</b>과 <b>1년 자동 연장</b>에 동의하며,",
            "아울러 계약 조건에 기재된 <b>계약 기간·최소 이용기간·자동 연장</b> 조건에 동의하며,")
    b = rep(b, '<dt>월 청구액</dt><dd class="money" id="s_price">—</dd>', '<dt>월 청구액</dt><dd class="money" id="s_price">—</dd>')
    b = rep(b, "모넷코리아 담당자가 내용을 확인한 뒤 설치 일정과 세금계산서 발행 절차를 안내드립니다.",
            "모넷코리아 담당자가 내용을 확인한 뒤 설치 일정과 세금계산서 발행 절차를 안내드립니다. 체결 내용은 이 화면을 인쇄하거나 PDF로 저장해 보관하실 수 있습니다.")
    # 단계 탭: 조건을 못 불러오면 이동 막기 (스크립트에서 처리)
    # 서명 전 확인 항목은 SLA 팝업 안에서 한 번만 보여 준다 (2026-10-16)
    i = b.find('  <label class="allcheck" for="ckall">'); j = b.find('  <fieldset style="margin-top:30px">')
    assert 0 < i < j
    checks = b[i:j]; b = b[:i] + b[j:]
    b = rep(b, '<p class="lede">아래 항목은 계약의 핵심 조건입니다. 각 항목을 읽고 확인한 뒤 서명해 주십시오.</p>',
            '<p class="lede">계약 내용을 확인하신 뒤 서명해 주십시오. 서비스수준협약(SLA)은 앞 단계에서 확인·동의하셨습니다.</p>')
    b = rep(b, '<p class="hint" style="margin:-14px 0 16px"><button type="button" class="btn quiet" id="openSla2" style="padding:7px 13px;font-size:13px">SLA 전문 다시 보기</button></p>',
            '<p class="hint" style="margin:-14px 0 16px"><button type="button" class="btn quiet" id="openSla2" style="padding:7px 13px;font-size:13px">SLA 전문 다시 보기</button> <span id="slaDoneTag"></span></p>')
    b = rep(b, '<button type="button" class="btn ghost" id="printBtn">이 화면 인쇄 / PDF 저장</button>',
            '<button type="button" class="btn" id="pdfBtn">계약서 PDF 내려받기</button> <button type="button" class="btn ghost" id="printBtn">이 화면 인쇄</button>')
    html_modal = modal(False, True)
    html_modal = rep(html_modal, '\n    </div>\n    <div class="mfoot">',
        '\n    <div class="article" id="ackBlock"><h3><span class="no">확인</span><span>서명 전 확인 항목</span></h3>'
        '<p class="sub">아래 항목은 본 SLA의 핵심 조건입니다. 하단의 「전체 동의하고 계속」 버튼을 누르면 모든 항목에 한 번에 동의할 수 있습니다.</p>\n' + checks + '    </div>\n    </div>\n    <div class="mfoot">')
    html = head("구독 계약 체결", "긴급 경보 알리미 구독서비스 계약 체결") + b + html_modal + "\n</main>\n\n" + FOOTER + "\n<script>" + rd("contract_doc.js") + "\n" + rd("contract.js") + "</script>\n</body>\n</html>\n"
    (OUT / "contract.html").write_text(html, encoding="utf-8"); print("built contract.html", len(html))

# ───────── 2. 관리자 화면 ─────────
def build_admin():
    page("contract-admin.html", "알리미 계약 관리", "모넷코리아 알리미 계약 관리(내부용)",
         rd("admin_body.html"), rd("contract_doc.js") + "\n" + rd("admin.js"), extra_css=rd("admin.css"), with_modal=False)

# ───────── 3. 만족도 조사 ─────────
def build_survey():
    page("survey.html", "알리미 만족도 조사", "긴급 경보 알리미 이용 고객 만족도 조사",
         rd("survey_body.html"), rd("survey.js"), with_modal=False)

# ───────── 4. 기존 고객 SLA 동의 ─────────
def build_consent():
    page("sla-consent.html", "SLA 확인 및 동의", "긴급 경보 알리미 기존 고객 서비스수준협약(SLA) 확인 및 동의",
         rd("consent_body.html"), rd("consent.js"), existing=True)

# ───────── 5. 약관 단독 페이지 (홈페이지 하단 링크용) ─────────
def build_terms():
    body = """<body class="termspage">
<div class="topbar"><div class="inner"><div class="brand">
  <a class="mk" href="/" style="text-decoration:none">MONNIT KOREA</a>
  <span class="nm">긴급 경보 알리미 · 서비스 이용약관(SLA)</span>
</div></div></div>
<main class="sheet" style="padding-top:22px">
  <h1 style="font-size:21px">긴급 경보 알리미 서비스수준협약서(SLA)</h1>
  <p class="hint" style="margin:0 0 10px">구독 계약의 부속문서입니다. 계약 체결 시 이 내용을 다시 안내하고 동의를 받습니다. (공통 본문 + 제품별 부속서)</p>
  <p class="noprint" style="margin:0 0 16px"><a class="btn quiet" href="/alarm/sla.pdf" download="모넷코리아_긴급경보알리미_SLA.pdf" style="text-decoration:none;padding:8px 13px;font-size:13px">PDF 내려받기</a></p>
  <div class="mbody compact" style="overflow:visible;padding:0">""" + articles(False) + """
  </div>
"""
    css = (".termspage .topbar{position:static} body.embed .topbar,body.embed footer,body.embed .noprint{display:none} body.embed .sheet{padding:16px 18px 30px}"
           "@media print{.noprint,.topbar{display:none!important} .termspage .sheet{padding:0} .article{break-inside:auto} .article h3{break-after:avoid}}"
           "body.pdf{background:#fff;color:#000} body.pdf .topbar,body.pdf footer,body.pdf .noprint{display:none} body.pdf .sheet{max-width:none;padding:0}"
           "body.pdf mark{background:#eef3ef} body.pdf .compact{font-size:11pt;line-height:1.65} body.pdf ol.cl>li{font-size:11pt} body.pdf .pdfhead{font-size:9.5pt;color:#555;border-bottom:1px solid #999;padding-bottom:6px;margin-bottom:14px;display:flex;justify-content:space-between}")
    js = ("(function(){var m=/[?&]p=([a-z,]+)/.exec(location.search);if(!m)return;var want=m[1].split(',');"
          "document.querySelectorAll('.annex[data-product]').forEach(function(el){el.hidden=want.indexOf(el.dataset.product)<0;});"
          "var h=document.querySelector('.annex-head .sub');if(h)h.textContent='이 계약의 납품 솔루션에 해당하는 부속서만 수록했습니다. 전체 부속서는 monnit.co.kr/alarm/terms 에서 볼 수 있습니다.';})();"
          "if(/[?&]embed=1/.test(location.search))document.body.classList.add('embed');"
          "if(/[?&]pdf=1/.test(location.search)){document.body.classList.add('pdf');"
          "var h=document.createElement('div');h.className='pdfhead';h.innerHTML='<span>주식회사 모넷코리아 · 긴급 경보 알리미 서비스수준협약서(SLA) · 2026년 10월 16일 시행</span><span>monnit.co.kr · 02-2088-1454</span>';"
          "document.querySelector('.sheet').prepend(h);}")
    page("alarm/terms.html", "알리미 서비스 이용약관(SLA)", "긴급 경보 알리미 서비스수준협약서(SLA) 전문", body, js,
         extra_css=css, with_modal=False)

# ───────── 6. 변경 안내 페이지 (안내 메일에서 링크) ─────────
def build_notice():
    body = """<body class="noticepage">
<div class="topbar"><div class="inner"><div class="brand">
  <a class="mk" href="/" style="text-decoration:none">MONNIT KOREA</a>
  <span class="nm">긴급 경보 알리미 · 서비스 이용약관 시행 안내</span>
</div></div></div>
<main class="sheet" style="padding-top:26px">
  <p class="kicker">2026년 10월 16일 시행</p>
  <h1 style="font-size:24px;line-height:1.35">긴급 경보 알리미 서비스 이용약관(SLA) 시행 및<br>개인정보처리방침 개정 안내</h1>
  <p class="lede">그동안 구두와 계약서로만 안내드리던 서비스 범위와 책임 기준을 서비스수준협약서(SLA)로 정리하여 2026년 10월 16일부터 시행합니다. 같은 날 개인정보처리방침도 알리미 서비스에 맞게 개정하였습니다. 기존 이용 고객께는 동의해 주신 날부터 SLA가 적용되며, 동의하지 않으셔도 서비스는 기존 계약 조건대로 계속 제공됩니다.</p>

  <div class="ntc-actions" id="ntcActions">
    <a class="btn" id="ntcConsent" href="/sla-consent">SLA 확인하고 동의하기</a>
    <a class="btn ghost" id="ntcSurvey" href="/survey">만족도 조사 참여 (약 2분)</a>
  </div>
  <p class="hint" id="ntcNoKey" hidden>동의와 설문은 고객별 링크로 진행됩니다. 안내 메일의 버튼으로 접속하시거나, 링크가 없으시면 <a href="mailto:1015@monnit.com">1015@monnit.com</a> 으로 요청해 주십시오.</p>

  <h2 class="ntc-h">무엇이 달라지나요</h2>
  <div class="ntc-grid">
    <div class="ntc-card"><b>서비스 범위</b><p>알림 발송까지가 서비스 범위입니다. 상시 관제·현장 출동·기관 신고는 포함되지 않습니다. <small>SLA 제3조</small></p></div>
    <div class="ntc-card"><b>보조 수단</b><p>법정 안전설비와 자체 안전관리 체계를 대체하지 않으며, 센서 특성상 오탐·미탐이 생길 수 있습니다. <small>SLA 제3·5조</small></p></div>
    <div class="ntc-card"><b>책임 한도</b><p>회사의 배상 한도는 직전 12개월간 지급한 이용료 총액입니다(고의·중과실 제외). <small>SLA 제10·11조</small></p></div>
    <div class="ntc-card"><b>고객이 하실 일</b><p>월 1회 테스트 알림 점검, 배터리 알림 후 14일 안에 교체, 수신자 정보 최신 유지. <small>SLA 제7조</small></p></div>
    <div class="ntc-card"><b>알림 수신자</b><p>최대 10명까지 등록할 수 있습니다. 추가·변경은 <a href="mailto:1015@monnit.com">1015@monnit.com</a> 으로 알려 주시면 반영해 드립니다. <small>SLA 제8조</small></p></div>
    <div class="ntc-card"><b>개인정보</b><p>알리미 서비스 관련 처리 항목·보관 기간(계약 종료 후 5년)·위탁 내용을 개인정보처리방침에 추가했습니다. <small>개인정보처리방침 2026-10-16 개정</small></p></div>
  </div>

  <h2 class="ntc-h">문서 전문</h2>
  <ul class="ntc-links">
    <li><a href="/alarm/terms" target="_blank" rel="noopener">서비스수준협약서(SLA) 전문 — 웹</a></li>
    <li><a href="/alarm/sla.pdf" download="모넷코리아_긴급경보알리미_SLA.pdf">SLA 전문 — PDF 내려받기</a> <small>(제품별 부속서: <a href="/alarm/sla-fire.pdf">화재</a> · <a href="/alarm/sla-water.pdf">물감지</a> · <a href="/alarm/sla-power.pdf">정전</a> · <a href="/alarm/sla-alarm.pdf">경보</a>)</small></li>
    <li><a href="/privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></li>
  </ul>

  <h2 class="ntc-h">기존 계약은 어떻게 되나요</h2>
  <p class="ntc-p">계약 기간, 이용 요금, 지급 조건, 최소 이용기간 등 종전 계약의 조건은 바뀌지 않습니다. SLA는 동의해 주신 날부터 적용되고, 그 전에 발생한 사유에는 종전 계약 조건이 적용됩니다. 동의하지 않으셔도 서비스는 종전 조건대로 계속 제공됩니다(SLA 부칙).</p>
  <p class="ntc-p">궁금하신 점은 <b>02-2088-1454</b> 또는 <a href="mailto:korea@monnit.com">korea@monnit.com</a> 으로 연락 주십시오.</p>
"""
    css = (".noticepage .topbar{position:static}"
           ".ntc-actions{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 10px}.ntc-actions .btn{text-decoration:none}"
           ".ntc-h{font-family:var(--serif);font-size:17px;margin:30px 0 12px}"
           ".ntc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}"
           ".ntc-card{border:1px solid var(--rule);background:var(--surface);padding:14px 16px}"
           ".ntc-card b{display:block;margin-bottom:4px;font-size:14.5px}.ntc-card p{margin:0;font-size:13.5px;line-height:1.65;color:var(--muted)}"
           ".ntc-card small{display:block;margin-top:4px;font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--faint)}"
           ".ntc-links{margin:0;padding-left:18px;line-height:2}.ntc-links small{color:var(--faint)}"
           ".ntc-p{font-size:14px;line-height:1.75;color:var(--muted);margin:0 0 10px}"
           "@media (max-width:640px){.ntc-grid{grid-template-columns:1fr}.ntc-actions .btn{width:100%;justify-content:center}}")
    js = ("(function(){var m=/[?&]k=([A-Za-z0-9_-]+)/.exec(location.search);var k=m?m[1]:'';"
          "var c=document.getElementById('ntcConsent'),s=document.getElementById('ntcSurvey');"
          "if(k){c.href='/sla-consent?k='+k;s.href='/survey?k='+k;}else{document.getElementById('ntcNoKey').hidden=false;c.href='/alarm/terms';c.textContent='SLA 전문 보기';s.hidden=true;}})();")
    page("alarm/notice.html", "알리미 서비스 이용약관 시행 안내", "긴급 경보 알리미 서비스수준협약서(SLA) 시행 및 개인정보처리방침 개정 안내", body, js, extra_css=css, with_modal=False)

if __name__ == "__main__":
    build_contract(); build_admin(); build_survey(); build_consent(); build_terms(); build_notice()
