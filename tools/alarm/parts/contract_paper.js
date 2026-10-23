/* 종이 계약서 (A4 한 장 양면) — 앞면 구독서비스 계약서 · 뒷면 서비스수준협약(SLA)   2026-10-21
   고객 화면(/contract 4단계)과 관리 화면(/contract-admin)이 같은 문서를 만든다.
     window.MKPaper.meta(products)        → 제품별 계약서 명칭·납품 솔루션·안내 문구
     window.MKPaper.pdf(rec [, filename]) → html2canvas + jsPDF 로 A4 PDF 저장 (cdnjs 지연 로드)
     window.MKPaper.print(rec)            → 새 창에 A4 문서만 띄워 인쇄 (벡터 인쇄 · 가장 선명)
   rec = 서버 계약 레코드(contracts/<ref>)와 같은 모양. 뒷면 SLA 본문은 페이지의 <template id="slaTpl"> 에서 가져온다.
   소방 형식승인 대상이 아니므로 화재 제품은 「화재경보 연동 알리미」 — 감지기·수신기·경보기로 읽히는 표현을 쓰지 않는다. */
(function(){
  "use strict";
  var ORIGIN = location.origin;
  var LOGO = ORIGIN + "/alarm/monnit-logo.png";
  var SEAL = ORIGIN + "/alarm/monnit-seal.png";   /* 납품처(모넷코리아) 법인 직인 — 발주처 직인란은 비워 둔다 */
  var SUPPLIER = { name: "주식회사 모넷코리아", biz: "242-88-01218", addr: "서울 서초구 효령로 380 세안빌딩 2F", ceo: "염 정 훈", tel: "02-2088-1454", mail: "korea@monnit.com" };
  var P = {
    fire:   { name: "무선 화재경보 연동 알리미", detail: "기존 소방수신기 화재경보 접점 신호 원격 알림", en: "FIRE ALARM LINK", annex: "B-1 화재경보 연동" },
    water:  { name: "무선 물감지 알리미",       detail: "누수·침수 감지 센서 신호 원격 알림",          en: "WATER LEAK",      annex: "B-2 물감지" },
    power:  { name: "무선 정전 알리미",         detail: "감시 회로 전원 차단(정전) 원격 알림",          en: "POWER OUTAGE",    annex: "B-3 정전" },
    alarm:  { name: "무선 경보 연동 알리미",     detail: "기존 설비 경보 접점 신호 원격 알림",          en: "EQUIPMENT ALARM LINK", annex: "B-4 경보 연동" },
    custom: { name: "무선 커스텀 알리미",       detail: "별도 사양서에 따른 원격 알림",                en: "CUSTOM",          annex: "B-5 커스텀(별도 사양서)" }
  };
  var ORDER = ["fire", "water", "power", "alarm", "custom"];
  /* 2026-10-23 설치 지역 요금 — 서울·경기·인천은 설치비 무료, 그 외 지역은 설치 출장비(1회 약 50만 원)를
     따로 청구하지 않고 계약당 월 1만 원 정액을 더한다(개소 수와 무관). 산정 근거(출장비 ÷ 36개월)는 내부 기준이라 고객 화면·계약서에 쓰지 않는다.
     고객 화면 · 관리 화면 · 종이 계약서가 같은 문구를 쓴다. region 이 없는 예전 계약은 아무것도 표시하지 않는다. */
  var REGION = { metro: "서울·경기·인천", other: "그 외 지역" };
  var REGION_FEE = 10000;
  /* 설치 주소 → 지역 (서버 regionOf 와 같은 규칙) */
  function regionOf(addr){
    var a = String(addr || "").replace(/^\s*\(?\d{5}\)?\s*/, "").trim();
    if(!a) return "";
    return /^(서울|경기|인천)/.test(a) ? "metro" : "other";
  }
  /* region "auto" 조건에 주소를 넣어 금액을 확정 (서버 settleTerms 와 같은 규칙). 주소가 없으면 그대로 */
  function settle(T, addr){
    if(!T || T.region !== "auto") return T;
    var r = regionOf(addr); if(!r) return T;
    var o = {}; for(var k in T) o[k] = T[k];
    o.region = r; o.regionFee = r === "other" ? REGION_FEE : 0;
    o.list = (Number(T.unit) || 0) * Math.max(1, Number(T.qty) || 1) + o.regionFee;
    o.discount = T.discountType === "percent" ? Math.round(o.list * Math.min(100, Number(T.discountValue) || 0) / 100) : T.discountType === "amount" ? Math.min(o.list, Math.round(Number(T.discountValue) || 0)) : 0;
    o.monthly = o.list - o.discount;
    return o;
  }
  function regionLine(t){
    if(!t || !t.region || t.region === "auto") return "";
    return t.region === "other"
      ? "1개소 월 이용료 " + num(t.unit) + "원 × " + num(t.qty) + "개소 + 지역 출장비 월 " + num(t.regionFee) + "원 (" + REGION.other + " · 개소 수와 무관 · 설치비·출장비 별도 청구 없음)"
      : "1개소 월 이용료 " + num(t.unit) + "원 × " + num(t.qty) + "개소 (" + REGION.metro + " · 설치비 무료)";
  }

  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function num(n){ return Number(n || 0).toLocaleString("ko-KR"); }
  function kd(s){ if(!s) return "　　년　　월　　일"; var p = String(s).slice(0,10).split("-"); return p.length === 3 ? p[0] + "년 " + Number(p[1]) + "월 " + Number(p[2]) + "일" : esc(s); }
  function period(from, to){
    if(!from || !to) return "";
    var a = new Date(from + "T00:00:00"), b = new Date(to + "T00:00:00"); if(isNaN(a) || isNaN(b)) return "";
    b.setDate(b.getDate() + 1);
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if(m <= 0) return "";
    return m % 12 === 0 ? (m / 12) + "년" : m + "개월";
  }
  /* 30000 → 삼만 */
  function hangul(n){
    n = Math.round(Number(n) || 0); if(!n) return "영";
    var D = ["","일","이","삼","사","오","육","칠","팔","구"], S = ["","십","백","천"], B = ["","만","억","조"], out = "", g = 0;
    while(n > 0){
      var part = n % 10000, s = "";
      for(var i = 0; i < 4 && part > 0; i++){ var d = part % 10; if(d) s = (d === 1 && i > 0 ? "" : D[d]) + S[i] + s; part = Math.floor(part / 10); }
      if(s) out = s + B[g] + out;
      n = Math.floor(n / 10000); g++;
    }
    return out;
  }
  function list(products){ return ORDER.filter(function(k){ return (products || []).indexOf(k) >= 0; }); }

  /* 제품 선택에 따른 계약서 명칭 */
  function meta(products, solNote){
    var ks = list(products), one = ks.length === 1 ? P[ks[0]] : null, note = String(solNote || "").trim();
    var title = one ? one.name : "무선 긴급 경보 알리미";
    var sol = one ? one.name + " (" + one.detail + ")" : (ks.length ? ks.map(function(k){ return P[k].name; }).join(" · ") : "긴급 경보 알리미");
    if(note) sol += " — " + note;
    var hasFire = ks.indexOf("fire") >= 0;
    return {
      products: ks, title: title, solution: sol,
      en: "WIRELESS " + (one ? one.en : "EMERGENCY ALERT") + " NOTIFIER",
      notice: hasFire ? (one ? "본 제품은 보조 알림 장치이며, 법정 소방시설을 대체하지 않습니다." : "본 서비스는 보조 알림 수단이며, 법정 소방시설 등 법정 안전설비를 대체하지 않습니다.")
                      : "본 서비스는 보조 알림 수단이며, 법정 안전설비를 대체하지 않습니다.",
      annex: ks.length ? ks.map(function(k){ return P[k].annex; }).join(" · ") : "B 전체"
    };
  }

  var CSS = [
    ".mkp{--navy:#1E3A52;--blue:#315C80;--gray:#5A6B7B;--red:#C82128;--line:#C9D3DD;--soft:#F4F7FA;font-family:'IBM Plex Sans KR','Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#1F2933;-webkit-font-smoothing:antialiased}",
    ".mkp *{box-sizing:border-box}",
    ".mkp .pg{position:relative;width:794px;height:1123px;background:#fff;overflow:hidden;margin:0 auto}",
    /* 앞면 */
    ".mkp .fr{padding:30px 60px 0}",
    ".mkp .fr .logo{height:24px;display:block;margin:6px 0 20px}",
    ".mkp .fr .rule{height:2px;background:var(--navy);margin:0 0 3px}.mkp .fr .rule2{height:1px;background:var(--red);margin:0 0 10px}",
    ".mkp .fr .en{font-size:8.5px;letter-spacing:.42em;word-spacing:.5em;color:var(--blue);font-weight:600;margin:0 0 4px}",
    ".mkp .fr h1{font-size:21px;line-height:1.3;color:var(--navy);margin:0 0 8px;font-weight:700}",
    ".mkp .fr .bar{display:flex;border-top:1px solid var(--navy);border-bottom:1px solid var(--navy);padding:5px 0;font-size:11px;color:var(--navy);margin:0 0 9px}",
    ".mkp .fr .bar span{flex:1;text-align:center;font-weight:600}.mkp .fr .bar span+span{border-left:1.5px solid var(--navy)}.mkp .fr .bar b{font-weight:700;color:#1F2933;margin-left:6px}",
    ".mkp .fr .intro{font-size:11.5px;line-height:1.65;margin:0 0 14px}",
    ".mkp .fr .intro u{text-decoration:none;border-bottom:1px solid var(--blue);padding:0 4px;font-weight:600}",
    ".mkp .fr h2{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--navy);margin:0 0 8px;letter-spacing:.18em}",
    ".mkp .fr h2:before{content:'';width:3px;height:15px;background:var(--red)}.mkp .fr h2 i{font-style:normal;color:var(--red);letter-spacing:0}",
    ".mkp .fr table{width:100%;border-collapse:collapse;font-size:11px}",
    ".mkp .fr .t1 th{background:var(--navy);color:#fff;font-weight:600;padding:6px 8px;text-align:left}",
    ".mkp .fr .t1 td{border-bottom:1px solid var(--line);padding:5.5px 8px;vertical-align:middle;line-height:1.45}",
    ".mkp .fr .t1 td.no{width:44px;text-align:center;font-weight:600}.mkp .fr .t1 td.k{width:120px;text-align:center;font-weight:700;color:var(--navy);letter-spacing:.12em}",
    ".mkp .fr .t1 tr:nth-child(even) td{background:var(--soft)}",
    ".mkp .fr .t1 .red{color:var(--red)}",
    ".mkp .fr .etc{background:var(--soft);border-left:3px solid var(--blue);padding:7px 12px;margin:0 0 12px}",
    ".mkp .fr .etc div{position:relative;padding:3px 0 3px 18px;font-size:10.5px;line-height:1.55}.mkp .fr .etc div:before{content:'·';position:absolute;left:4px;color:var(--red);font-weight:700}",
    ".mkp .fr .close{font-size:11px;line-height:1.65;margin:0 0 6px}",
    ".mkp .fr .date{text-align:center;font-size:13px;font-weight:700;color:var(--navy);margin:6px 0 10px;letter-spacing:.06em}",
    ".mkp .fr .t2 th{background:var(--navy);color:#fff;padding:6px;font-size:11.5px;letter-spacing:.3em}",
    ".mkp .fr .t2 td{border-bottom:1px solid var(--line);padding:7px 8px;height:31px;font-size:11px;vertical-align:middle}",
    ".mkp .fr .t2 td.k{width:74px;font-weight:700;color:var(--navy);letter-spacing:.2em;background:var(--soft)}",
    ".mkp .fr .t2 td.in{text-align:right;color:var(--gray);width:40px}",
    ".mkp .fr .t2 td.seal{position:relative}.mkp .fr .t2 td.seal img{position:absolute;right:2px;top:50%;width:70px;height:70px;transform:translateY(-50%);opacity:.92}",
    ".mkp .fr .t2 td.v{font-weight:600}",
    ".mkp .fr .foot{position:absolute;left:60px;right:60px;bottom:22px;border-top:1px solid var(--line);padding-top:7px;text-align:center;font-size:8.5px;color:var(--gray)}",
    ".mkp .fr .foot b{color:var(--navy)}.mkp .fr .ref{position:absolute;right:60px;top:40px;font-size:9px;color:var(--gray);text-align:right;line-height:1.5}.mkp .fr .ref b{color:var(--navy);font-family:'IBM Plex Mono',ui-monospace,monospace}",
    /* 뒷면 */
    ".mkp .bk{padding:22px 30px 34px}",
    ".mkp .bk .hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 5px}",
    ".mkp .bk .hd h1{font-size:15px;color:var(--navy);margin:0;font-weight:700}.mkp .bk .hd span{font-size:8px;color:var(--gray)}",
    ".mkp .bk .bn{background:#EEF3F8;border-left:3px solid var(--blue);padding:4px 8px;font-size:7.2px;line-height:1.5;margin:0 0 6px}.mkp .bk .bn .ref{display:none}",
    ".mkp .bk .cols{column-count:3;column-gap:11px;column-rule:1px solid #DDE3EA;font-size:6px;line-height:1.36;text-align:justify;word-break:keep-all;overflow-wrap:anywhere}",
    ".mkp .bk .article{break-inside:auto;margin:0 0 .45em;padding:.35em 0 0;border-top:1px solid #D7DEE6}",
    ".mkp .bk .cols>.article:first-child{border-top:0;padding-top:0}",
    ".mkp .bk .article h3{font-size:1.12em;color:var(--navy);margin:0 0 .2em;font-weight:700;break-after:avoid;display:block}",
    ".mkp .bk .article h3 .no{margin-right:.4em}",
    ".mkp .bk .article .sub,.mkp .bk .hint{color:var(--gray);margin:0 0 .2em;font-size:1em}",
    ".mkp .bk ol.cl{list-style:none;margin:0;padding:0;counter-reset:cl}",
    ".mkp .bk ol.cl>li{counter-increment:cl;position:relative;padding-left:2.05em;margin:0 0 .12em}",
    ".mkp .bk ol.cl>li:before{content:'(' counter(cl) ')';position:absolute;left:0;color:var(--blue);font-weight:700}",
    ".mkp .bk ul.plain{margin:.1em 0 .1em;padding-left:1.1em}.mkp .bk ul.plain li{margin:0}",
    ".mkp .bk mark,.mkp .bk b,.mkp .bk strong{background:none;color:var(--navy);font-weight:700}.mkp .bk .warn{color:var(--navy);font-weight:700}",
    ".mkp .bk .note{background:var(--soft);padding:.25em .5em;margin:.25em 0;color:var(--gray)}.mkp .bk .note .tag{color:#C82128;font-weight:700;margin-right:.4em}",
    ".mkp .bk .tablewrap{margin:.2em 0}.mkp .bk table{width:100%;border-collapse:collapse;font-size:.92em}",
    ".mkp .bk th{background:var(--navy);color:#fff;font-weight:600;padding:.15em .3em;text-align:left}.mkp .bk td{border-bottom:1px solid #D7DEE6;padding:.12em .3em;vertical-align:top}",
    ".mkp .bk .annex-head{border-top:1.5px solid var(--navy)}",
    ".mkp .bk .fineprint{text-align:right;color:var(--gray);margin:.4em 0 0}",
    ".mkp .bk .annex[hidden]{display:none}",
    ".mkp .bk .foot{position:absolute;left:30px;right:30px;bottom:14px;border-top:1px solid var(--line);padding-top:5px;display:flex;justify-content:space-between;font-size:7.5px;color:var(--gray)}",
    ".mkp .pg.grow{height:auto;min-height:1123px}"
  ].join("");

  function norm(rec){
    var t = rec.terms || {}, u = rec.customer || {};
    return {
      ref: rec.ref || "", t: {
        products: t.products || [], solNote: t.solNote || "", solution: t.solution || t.sol || "",
        unit: t.unitPrice != null ? t.unitPrice : t.unit, region: t.region || "", regionFee: Number(t.regionFee) || 0, qty: t.sites != null ? t.sites : t.qty, list: t.listPrice != null ? t.listPrice : t.list,
        discount: t.discount || 0, discountType: t.discountType, discountValue: t.discountValue, discountNote: t.discountNote || "",
        monthly: t.monthly, from: t.from, to: t.to, pay: t.payDay || t.pay || "", bank: t.bank || "", etc: t.etc || ""
      }, u: u
    };
  }

  function front(rec){
    var d = norm(rec), t = d.t, u = d.u, m = meta(t.products, t.solNote);
    var sol = t.products.length ? m.solution : (t.solution || m.solution);
    var per = period(t.from, t.to);
    var price = "월 " + num(t.monthly) + "원 (금 " + hangul(t.monthly) + "원, VAT 별도) — " + num(t.qty) + "개소 기준" +
      (t.region ? '<br><span style="color:#5A6B7B">' + esc(regionLine(t)) + "</span>" : "") +
      (t.discount ? '<br><span style="color:#5A6B7B">정가 월 ' + num(t.list) + "원에서 " + (t.discountType === "percent" ? t.discountValue + "% " : "") + "할인 " + num(t.discount) + "원" + (t.discountNote ? " · " + esc(t.discountNote) : "") + "</span>" : "");
    var etc = String(t.etc || "").split("\n").map(function(l){ return l.replace(/^[-·\s]+/, "").trim(); }).filter(Boolean);
    var rows = [
      ["납품 솔루션", esc(sol)],
      ["설치 현장", u.site ? esc(u.site) + (u.siteAddr ? '<br><span style="color:#5A6B7B">' + esc(u.siteAddr) + "</span>" : "") : "—"],
      ["사용 금액", price],
      ["안내 사항", esc(m.notice)],
      ["계약 기간", kd(t.from) + " ~ " + kd(t.to) + (per ? ' <span class="red">(' + per + ")</span>" : "")],
      ["지급 일자", esc(t.pay || "—")],
      ["입금 계좌", esc(t.bank || "—")]
    ];
    var blank = function(v){ return v ? esc(v) : ""; };
    return '<div class="pg fr">' +
      '<img class="logo" src="' + LOGO + '" alt="MONNIT" crossorigin="anonymous">' +
      (d.ref ? '<div class="ref">계약번호 <b>' + esc(d.ref) + "</b></div>" : "") +
      '<div class="rule"></div><div class="rule2"></div>' +
      '<p class="en">' + esc(m.en) + "</p>" +
      "<h1>" + esc(m.title) + "<br>구독서비스 계약서</h1>" +
      '<div class="bar"><span>발주처<b>' + blank(u.name) + '</b></span><span>납품처<b>㈜모넷코리아</b></span><span>대상<b>' + num(t.qty) + "개소</b></span></div>" +
      '<p class="intro">본 계약의 이행을 위하여 발주처인 <u>' + (u.name ? esc(u.name) : "　　　　　　") + '</u>(이하 "발주처")와 납품처인 주식회사 모넷코리아(이하 "납품처")는 ' + esc(m.title) + " 구독서비스에 관하여 다음과 같이 계약을 체결한다.</p>" +
      "<h2><i>01</i>계약내용</h2>" +
      '<table class="t1" style="margin:0 0 14px"><thead><tr><th style="text-align:center">No</th><th style="text-align:center">구　분</th><th>내　용</th></tr></thead><tbody>' +
        rows.map(function(r, i){ return '<tr><td class="no">' + (i + 1) + '</td><td class="k">' + r[0] + "</td><td>" + r[1] + "</td></tr>"; }).join("") +
      "</tbody></table>" +
      (etc.length ? "<h2><i>02</i>기타사항</h2>" + '<div class="etc">' + etc.map(function(l){ return "<div>" + esc(l) + "</div>"; }).join("") + "</div>" : "") +
      '<p class="close">발주처와 납품처는 상호 동등한 입장에서 위 계약조건과 뒷면의 서비스수준협약(SLA)에 따라 본 서비스 계약을 체결하고, 신의에 따라 성실히 그 의무를 이행할 것을 확약한다. 뒷면의 서비스수준협약(SLA)은 본 계약의 부속문서로서 계약과 일체를 이룬다.<br>이 계약의 증거로 계약서를 작성하여 당사자가 기명날인 후 각각 1부씩 보관한다.</p>' +
      '<p class="date">' + "20　　년　　　월　　　일" + "</p>" +
      '<table class="t2"><thead><tr><th colspan="3">발 주 처</th><th colspan="3">납 품 처</th></tr></thead><tbody>' +
        '<tr><td class="k">상　호</td><td class="v" colspan="2">' + blank(u.name) + '</td><td class="k">상　호</td><td class="v" colspan="2">' + SUPPLIER.name + "</td></tr>" +
        '<tr><td class="k">사업자<br>번　호</td><td class="v" colspan="2">' + blank(u.bizNo) + '</td><td class="k">사업자<br>번　호</td><td class="v" colspan="2">' + SUPPLIER.biz + "</td></tr>" +
        '<tr><td class="k">주　소</td><td class="v" colspan="2">' + blank(u.address) + '</td><td class="k">주　소</td><td class="v" colspan="2">' + SUPPLIER.addr + "</td></tr>" +
        '<tr><td class="k" style="height:46px">대표이사</td><td class="v">' + blank(u.ceo) + '</td><td class="in">(인)</td><td class="k">대표이사</td><td class="v">' + SUPPLIER.ceo + '</td><td class="in seal">(인)<img src="' + SEAL + '" alt="모넷코리아 직인" crossorigin="anonymous"></td></tr>' +
      "</tbody></table>" +
      '<div class="foot"><b>주식회사 모넷코리아</b>　|　서울시 서초구 효령로 380 세안빌딩 2F　|　T. 02-2088-1454　|　korea@monnit.com　|　회신 1015@monnit.com</div>' +
    "</div>";
  }

  function slaHtml(products){
    var tpl = document.getElementById("slaTpl");
    if(!tpl) return { banner: "", body: '<p>서비스수준협약(SLA) 전문: monnit.co.kr/alarm/terms</p>' };
    var box = document.createElement("div"); box.innerHTML = tpl.innerHTML;
    var ks = list(products);
    Array.prototype.forEach.call(box.querySelectorAll(".annex[data-product]"), function(el){ if(ks.length && ks.indexOf(el.dataset.product) < 0) el.remove(); });
    var sub = box.querySelector(".annex-head .sub");
    if(sub && ks.length) sub.textContent = "본 계약의 납품 솔루션에 해당하는 부속서만 적용됩니다(" + meta(ks).annex + "). 부속서는 공통 본문(특히 제3조·제4조·제7조·제11조)을 보충하며, 충돌하는 경우 해당 제품에 관하여는 부속서가 우선합니다.";
    var bn = box.querySelector(".banner"), banner = "";
    if(bn){ banner = bn.innerHTML; bn.remove(); }
    return { banner: banner, body: box.innerHTML };
  }

  function back(rec){
    var d = norm(rec), m = meta(d.t.products, d.t.solNote), s = slaHtml(d.t.products);
    return '<div class="pg bk">' +
      '<div class="hd"><h1>긴급 경보 알리미 서비스수준협약서(SLA)</h1><span>구독서비스 계약서 부속문서 · 공통 본문 + 부속서 ' + esc(m.annex) + " · 2026. 10. 16. 시행</span></div>" +
      (s.banner ? '<div class="bn">' + s.banner + "</div>" : "") +
      '<div class="cols">' + s.body + "</div>" +
      '<div class="foot"><span>주식회사 모넷코리아 · 긴급 경보 알리미 서비스수준협약서(SLA)</span><span>' + (d.ref ? "계약번호 " + esc(d.ref) + " · " : "") + "전문 monnit.co.kr/alarm/terms</span></div>" +
    "</div>";
  }

  function html(rec){ return '<div class="mkp">' + front(rec) + back(rec) + "</div>"; }

  /* 뒷면이 한 쪽에 들어가도록 글자 크기를 맞춘다 (6.4px → 최소 4.9px). 그래도 넘치면 쪽을 늘린다. */
  function fit(root){
    var pg = root.querySelector(".pg.bk"), cols = pg && pg.querySelector(".cols");
    if(!cols) return;
    var foot = pg.querySelector(".foot");
    var limit = function(){ return pg.clientHeight - 34 - cols.offsetTop; };
    cols.style.height = limit() + "px"; cols.style.columnFill = "auto";
    var fs = 6.4;
    for(; fs >= 4.9; fs -= 0.1){
      cols.style.fontSize = fs.toFixed(2) + "px";
      if(cols.scrollWidth <= cols.clientWidth + 1) break;
    }
    if(fs < 4.9){
      cols.style.fontSize = "4.9px"; cols.style.height = ""; cols.style.columnFill = "balance";
      pg.classList.add("grow"); if(foot) foot.style.position = "static";
    }
    root.dataset.fs = Math.max(fs, 4.9).toFixed(2);
  }

  /* 사이트 CSS 와 섞이지 않도록 보이지 않는 iframe 안에서 조판한다 */
  function fontLinks(){
    return Array.prototype.map.call(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]'), function(l){ return '<link rel="stylesheet" href="' + l.href + '">'; }).join("");
  }
  function docHtml(inner, extra){
    return "<!doctype html><html lang='ko'><head><meta charset='utf-8'>" + fontLinks() + "<style>html,body{margin:0;padding:0;background:#fff}" + CSS + (extra || "") + "</style></head><body>" + inner + "</body></html>";
  }
  function mount(rec){
    return new Promise(function(resolve){
      var fr = document.createElement("iframe");
      fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
      fr.style.cssText = "position:fixed;left:-12000px;top:0;width:794px;height:1200px;border:0;visibility:hidden";
      document.body.appendChild(fr);
      var d = fr.contentDocument; d.open(); d.write(docHtml(html(rec))); d.close();
      var root = d.querySelector(".mkp");
      var imgs = Array.prototype.map.call(d.querySelectorAll("img"), function(im){
        return im.complete && im.naturalWidth ? Promise.resolve() : new Promise(function(r){ im.onload = im.onerror = r; setTimeout(r, 5000); });
      });
      var fonts = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
      Promise.all(imgs.concat([fonts, new Promise(function(r){ setTimeout(r, 120); })])).then(function(){
        fit(root);
        resolve({ frame: fr, root: root });
      });
    });
  }

  /* ── PDF ── */
  var LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"];
  function loadScript(src){
    return new Promise(function(res, rej){
      if(document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement("script"); s.src = src; s.onload = res;
      s.onerror = function(){ rej(new Error("PDF 구성 요소를 불러오지 못했습니다. 「계약서 인쇄」에서 PDF로 저장해 주십시오.")); };
      document.head.appendChild(s);
    });
  }
  function libs(){ return window.html2canvas && window.jspdf ? Promise.resolve() : LIBS.reduce(function(p, u){ return p.then(function(){ return loadScript(u); }); }, Promise.resolve()); }
  function safe(v){ return String(v || "").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "고객"; }
  function fileName(rec){ var m = meta((rec.terms || {}).products); return "계약서_" + safe(m.title.replace(/^무선\s*/, "")) + "_" + safe((rec.customer || {}).name) + (rec.ref ? "_" + rec.ref : "") + ".pdf"; }

  async function pdf(rec, filename){
    await libs();
    var m = await mount(rec);
    try{
      var root = m.root;
      var J = window.jspdf.jsPDF, out = new J({ unit: "mm", format: "a4", compress: true });
      var pages = root.querySelectorAll(".pg");
      for(var i = 0; i < pages.length; i++){
        var pg = pages[i], scale = pg.classList.contains("bk") ? 3 : 2.2;
        var cv = await window.html2canvas(pg, { scale: scale, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794, windowWidth: 794 });
        var sliceH = Math.round(1123 * scale);
        for(var y = 0, first = true; y < cv.height - 4; y += sliceH, first = false){
          var h = Math.min(sliceH, cv.height - y), part = document.createElement("canvas");
          part.width = cv.width; part.height = sliceH;
          var x = part.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, part.width, part.height); x.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
          if(i > 0 || !first) out.addPage();
          out.addImage(part.toDataURL("image/jpeg", 0.86), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        }
      }
      out.setProperties({ title: meta((rec.terms || {}).products).title + " 구독서비스 계약서" + (rec.ref ? " " + rec.ref : ""), author: "주식회사 모넷코리아" });
      out.save(filename || fileName(rec));
    } finally { m.frame.remove(); }
  }

  /* ── 인쇄: 새 창에 A4 문서만 ── */
  async function print(rec){
    var w = window.open("", "_blank");
    if(!w){ throw new Error("팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주십시오."); }
    w.document.write("<!doctype html><html lang='ko'><head><meta charset='utf-8'><title>계약서 준비 중…</title></head><body style='font:14px sans-serif;padding:30px'>계약서를 준비하고 있습니다…</body></html>");
    var m = await mount(rec);
    try{
      var root = m.root;
      var title = meta((rec.terms || {}).products).title + " 구독서비스 계약서" + (rec.ref ? " " + rec.ref : "");
      var fonts = fontLinks();
      w.document.open();
      w.document.write("<!doctype html><html lang='ko'><head><meta charset='utf-8'><title>" + esc(title) + "</title>" + fonts +
        "<style>" + CSS + "@page{size:A4;margin:0}html,body{margin:0;background:#e9edf1}.mkp .pg{margin:0 auto 16px;box-shadow:0 2px 12px rgba(0,0,0,.12)}" +
        "@media print{html,body{background:#fff}.mkp .pg{margin:0;box-shadow:none;break-after:page;page-break-after:always}.mkp .pg:last-child{break-after:auto;page-break-after:auto}.tip{display:none}}" +
        ".tip{max-width:794px;margin:14px auto;font:13px/1.5 sans-serif;color:#333;background:#fff;border:1px solid #cfd6de;padding:9px 13px}</style></head><body>" +
        "<div class='tip'>인쇄 창에서 <b>용지 A4 · 양면 인쇄(긴 쪽 넘김) · 여백 없음 · 배율 100%</b>를 선택해 주십시오. PDF로 저장하려면 대상(프린터)을 「PDF로 저장」으로 바꾸면 됩니다.</div>" +
        root.outerHTML + "<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.focus();window.print()},350)})<\/script></body></html>");
      w.document.close();
    } finally { m.frame.remove(); }
  }

  window.MKPaper = { REGION: REGION, REGION_FEE: REGION_FEE, regionOf: regionOf, settle: settle, regionLine: function(t){ return regionLine(t); }, meta: meta, html: html, pdf: pdf, print: print, fileName: fileName, LABEL: (function(){ var o = {}; ORDER.forEach(function(k){ o[k] = P[k].name.replace(/^무선\s*/, ""); }); return o; })() };
})();
