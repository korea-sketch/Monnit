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

STYLE = rd("style.css") + rd("extra.css")
ARTICLES = rd("sla_articles.html")
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

ANNEX = """
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
        a += ANNEX
    return a

def modal(existing=False, foot=True):
    scope = "제1조 ~ 제18조 · 부칙" if existing else "제1조 ~ 제18조"
    agree_txt = ("위 서비스수준협약(SLA) 전문을 확인하였습니다." if existing else
                 "위 서비스수준협약(SLA) 전문을 확인하였으며, <b>제3조·제4조·제6조·제10조·제11조</b>를 포함한 그 내용에 동의합니다.")
    btn = "확인 완료" if existing else "동의하고 계속"
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
        <button type="button" class="btn" id="slaAgreeBtn" disabled>{btn}</button>
      </div>
    </div>""" if foot else ""
    return f"""
<div class="modal" id="slamodal" role="dialog" aria-modal="true" aria-labelledby="slatitle" hidden>
  <div class="backdrop" data-close></div>
  <div class="msheet">
    <div class="mhd">
      <div>
        <p class="kicker" style="margin:0 0 2px">부속문서 A · Rev. 2.2</p>
        <h2 id="slatitle">긴급 경보 알리미 서비스수준협약서(SLA)</h2>
      </div>
      <span class="spacer"></span>
      <a class="btn quiet" href="/alarm/sla.pdf" download="모넷코리아_긴급경보알리미_SLA_Rev2.2.pdf" style="text-decoration:none">PDF</a>
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
    page("contract.html", "구독 계약 체결", "긴급 경보 알리미 구독서비스 계약 체결", b, rd("contract.js"))

# ───────── 2. 관리자 화면 ─────────
def build_admin():
    page("contract-admin.html", "알리미 계약 관리", "모넷코리아 알리미 계약 관리(내부용)",
         rd("admin_body.html"), rd("admin.js"), extra_css=rd("admin.css"), with_modal=False)

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
  <p class="kicker" style="margin:0 0 2px">부속문서 A · Rev. 2.2 · 시행 2026년 10월</p>
  <h1 style="font-size:21px">긴급 경보 알리미 서비스수준협약서(SLA)</h1>
  <p class="hint" style="margin:0 0 10px">구독 계약의 부속문서입니다. 계약 체결 시 이 내용을 다시 안내하고 동의를 받습니다.</p>
  <p class="noprint" style="margin:0 0 16px"><a class="btn quiet" href="/alarm/sla.pdf" download="모넷코리아_긴급경보알리미_SLA_Rev2.2.pdf" style="text-decoration:none;padding:8px 13px;font-size:13px">PDF 내려받기</a></p>
  <div class="mbody compact" style="overflow:visible;padding:0">""" + articles(False) + """
  </div>
"""
    css = (".termspage .topbar{position:static} body.embed .topbar,body.embed footer,body.embed .noprint{display:none} body.embed .sheet{padding:16px 18px 30px}"
           "@media print{.noprint,.topbar{display:none!important} .termspage .sheet{padding:0} .article{break-inside:auto} .article h3{break-after:avoid}}"
           "body.pdf{background:#fff;color:#000} body.pdf .topbar,body.pdf footer,body.pdf .noprint{display:none} body.pdf .sheet{max-width:none;padding:0}"
           "body.pdf mark{background:#eef3ef} body.pdf .compact{font-size:11pt;line-height:1.65} body.pdf ol.cl>li{font-size:11pt} body.pdf .pdfhead{font-size:9.5pt;color:#555;border-bottom:1px solid #999;padding-bottom:6px;margin-bottom:14px;display:flex;justify-content:space-between}")
    js = ("if(/[?&]embed=1/.test(location.search))document.body.classList.add('embed');"
          "if(/[?&]pdf=1/.test(location.search)){document.body.classList.add('pdf');"
          "var h=document.createElement('div');h.className='pdfhead';h.innerHTML='<span>주식회사 모넷코리아 · 긴급 경보 알리미 서비스수준협약서(SLA) · 부속문서 A · Rev. 2.2</span><span>monnit.co.kr · 02-2088-1454</span>';"
          "document.querySelector('.sheet').prepend(h);}")
    page("alarm/terms.html", "알리미 서비스 이용약관(SLA)", "긴급 경보 알리미 서비스수준협약서(SLA) 전문", body, js,
         extra_css=css, with_modal=False)

if __name__ == "__main__":
    build_contract(); build_admin(); build_survey(); build_consent(); build_terms()
