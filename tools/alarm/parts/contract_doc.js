/* 계약서 문서 렌더 + PDF 내려받기 (관리 화면 · 고객 접수 완료 화면 공용) — 2026-10-16
   window.MKDoc.html(c)         → 계약서 HTML (A4 폭 기준)
   window.MKDoc.pdf(c, name)    → html2canvas + jsPDF 로 PDF 파일 저장 (cdnjs 에서 지연 로드)
   window.MKDoc.print(c)        → 새 창에 문서만 띄워 인쇄
   c = 서버에 저장된 계약 레코드(contracts/…) 와 같은 모양 */
(function(){
  var SUPPLIER = { name: "주식회사 모넷코리아", biz: "242-88-01218", addr: "서울특별시 서초구 효령로 380, 2층", ceo: "염정훈", tel: "02-2088-1454", mail: "korea@monnit.com" };
  var PRODUCT_LABEL = { fire:"화재 알리미", water:"물감지 알리미", power:"정전 알리미", alarm:"경보 알리미", custom:"커스텀 알리미" };
  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"]/g, function(ch){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]; }); }
  function won(n){ return "₩" + Number(n || 0).toLocaleString("ko-KR"); }
  function kd(s){ if(!s) return "—"; var p = String(s).slice(0,10).split("-"); return p.length === 3 ? p[0] + "년 " + Number(p[1]) + "월 " + Number(p[2]) + "일" : s; }
  function kdt(s){ if(!s) return "—"; var d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleString("ko-KR", {year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  function safe(v){ return String(v || "").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "고객"; }
  function row(k, v){ return "<tr><th>" + k + "</th><td>" + v + "</td></tr>"; }
  function months(from, to){
    if(!from || !to) return "";
    var a = new Date(from), b = new Date(to); if(isNaN(a) || isNaN(b)) return "";
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
    return m > 0 ? " (" + (m % 12 === 0 ? (m / 12) + "년" : m + "개월") + ")" : "";
  }

  var CSS = ".mkdoc{box-sizing:border-box;width:794px;padding:56px 60px 48px;background:#fff;color:#111;font:13px/1.65 Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;-webkit-font-smoothing:antialiased}" +
    ".mkdoc *{box-sizing:border-box}" +
    ".mkdoc .d-top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:22px}" +
    ".mkdoc .d-top .d-brand{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#555}" +
    ".mkdoc h1{font-size:22px;letter-spacing:-.01em;margin:8px 0 0;font-weight:700}" +
    ".mkdoc .d-meta{text-align:right;font-size:11.5px;color:#444;line-height:1.7}" +
    ".mkdoc .d-meta b{font-family:ui-monospace,Menlo,monospace;font-weight:600;color:#111}" +
    ".mkdoc .d-lede{margin:0 0 18px;color:#333}" +
    ".mkdoc .d-sec{margin:0 0 20px}" +
    ".mkdoc h2{font-size:13.5px;margin:0 0 7px;padding-left:9px;border-left:3px solid #0b6b4f}" +
    ".mkdoc table{width:100%;border-collapse:collapse;font-size:12.5px}" +
    ".mkdoc th,.mkdoc td{border:1px solid #cfd4d1;padding:7px 10px;text-align:left;vertical-align:top}" +
    ".mkdoc th{width:150px;background:#f3f5f4;font-weight:600;color:#333;white-space:nowrap}" +
    ".mkdoc td b.d-money{font-size:14px}" +
    ".mkdoc .d-note{font-size:11.5px;color:#555;margin:6px 0 0}" +
    ".mkdoc ul.d-ack{margin:4px 0 0;padding-left:18px;font-size:12px;color:#333}" +
    ".mkdoc ul.d-ack li{margin:2px 0}" +
    ".mkdoc .d-parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:6px}" +
    ".mkdoc .d-party{border:1px solid #cfd4d1;padding:12px 14px;font-size:12px;min-height:150px}" +
    ".mkdoc .d-party h3{margin:0 0 6px;font-size:12px;color:#555;font-weight:600}" +
    ".mkdoc .d-party .d-sig{height:64px;display:flex;align-items:center;gap:10px;margin-top:8px;border-top:1px dashed #cfd4d1;padding-top:8px}" +
    ".mkdoc .d-party .d-sig img{height:56px;max-width:220px;object-fit:contain}" +
    ".mkdoc .d-party .d-sig .d-st{color:#777;font-size:11px}" +
    ".mkdoc .d-seal{font-size:11px;color:#555}" +
    ".mkdoc .d-foot{margin-top:26px;padding-top:10px;border-top:1px solid #cfd4d1;font-size:10.5px;color:#777;display:flex;justify-content:space-between}" +
    ".mkdoc .d-attach{page-break-before:always;break-before:page}" +
    ".mkdoc .d-attach img{max-width:100%;max-height:980px;border:1px solid #cfd4d1;display:block}";

  function normalize(c){
    var t = c.terms || {}, u = c.customer || {};
    return {
      ref: c.ref || "", submittedAt: c.submittedAt || "",
      terms: {
        solution: t.solution || t.sol || ((t.products || []).map(function(k){ return PRODUCT_LABEL[k] || k; }).join(" · ")) || "긴급 경보 알리미",
        products: t.products || [], unitPrice: t.unitPrice != null ? t.unitPrice : t.unit, sites: t.sites != null ? t.sites : t.qty,
        listPrice: t.listPrice != null ? t.listPrice : t.list, discount: t.discount || 0, discountType: t.discountType, discountValue: t.discountValue, discountNote: t.discountNote || "",
        monthly: t.monthly, from: t.from, to: t.to, payDay: t.payDay || t.pay || "", bank: t.bank || "", etc: t.etc || ""
      },
      customer: u, recipients: c.recipients || [], acknowledged: c.acknowledged || [],
      slaAgreedAt: c.slaAgreedAt || "", slaViewedAt: c.slaViewedAt || "", slaReadPct: c.slaReadPct,
      signature: c.signature || {}, license: c.attachments && c.attachments.businessLicense || null
    };
  }

  function html(c0){
    var c = normalize(c0), t = c.terms, u = c.customer, s = c.signature;
    var disc = t.discount ? "월 " + won(t.listPrice) + " − 할인 " + won(t.discount) + (t.discountType === "percent" ? " (" + t.discountValue + "%)" : "") + (t.discountNote ? " · " + esc(t.discountNote) : "") : "";
    return '<div class="mkdoc">' +
      '<div class="d-top"><div><div class="d-brand">MONNIT KOREA</div><h1>긴급 경보 알리미 구독서비스 계약서</h1></div>' +
        '<div class="d-meta">계약번호 <b>' + esc(c.ref) + '</b><br>체결일 ' + esc(kd(s.signedOn || c.submittedAt)) + '</div></div>' +
      '<p class="d-lede">발주처(이하 "고객")와 납품처 주식회사 모넷코리아(이하 "회사")는 아래 조건으로 긴급 경보 알리미 구독서비스 이용계약을 체결합니다. 서비스수준협약서(SLA)는 본 계약의 부속문서로서 계약과 일체를 이룹니다.</p>' +
      '<div class="d-sec"><h2>1. 계약 조건</h2><table>' +
        row("납품 솔루션", esc(t.solution)) +
        row("설치 개소", esc(t.sites) + "개소") +
        row("월 이용료", won(t.unitPrice) + " × " + esc(t.sites) + "개소" + (disc ? "<br><span class='d-note'>" + disc + "</span>" : "")) +
        row("월 청구액", "<b class='d-money'>" + won(t.monthly) + "</b> (부가세 별도)") +
        row("계약 기간", esc(kd(t.from)) + " ~ " + esc(kd(t.to)) + esc(months(t.from, t.to))) +
        row("지급 조건", esc(t.payDay) + (t.bank ? " · " + esc(t.bank) : "")) +
        (t.etc ? row("기타 사항", esc(t.etc).replace(/\n/g, "<br>")) : "") +
      '</table></div>' +
      '<div class="d-sec"><h2>2. 고객 정보</h2><table>' +
        row("상호", esc(u.name)) + row("사업자등록번호", esc(u.bizNo || "—")) + row("대표자", esc(u.ceo)) + row("주소", esc(u.address)) +
        row("계약 구분", esc(u.contractType === "B2C" ? "소비자 (B2C)" : "사업자 (B2B)")) +
        row("담당자", esc(u.manager) + " · " + esc(u.phone) + (u.email ? " · " + esc(u.email) : "")) + row("설치 현장", esc(u.site)) +
      '</table></div>' +
      '<div class="d-sec"><h2>3. 알림 수신자</h2><table>' +
        (c.recipients.length ? c.recipients.map(function(r, i){ return row("수신자 " + (i + 1), esc(r.name) + " · " + esc(r.phone) + (r.email ? " · " + esc(r.email) : "")); }).join("") : row("수신자", "—")) +
      '</table><p class="d-note">수신자 정보가 바뀌면 고객이 회사에 알려 갱신하여야 하며, 갱신 전 발생한 미수신에 대해 회사는 책임지지 않습니다(SLA 제8조).</p></div>' +
      '<div class="d-sec"><h2>4. 서비스수준협약(SLA) 동의</h2><table>' +
        row("적용 문서", "긴급 경보 알리미 서비스수준협약서(SLA) · 2026년 10월 16일 시행 · 공통 본문 및 해당 제품 부속서 B") +
        row("동의 일시", esc(kdt(c.slaAgreedAt))) +
        (c.slaViewedAt ? row("전문 열람", esc(kdt(c.slaViewedAt)) + (c.slaReadPct != null ? " · " + esc(c.slaReadPct) + "% 열람" : "")) : "") +
        (c.acknowledged.length ? row("확인 항목", "<ul class='d-ack'>" + c.acknowledged.map(function(a){ return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>") : "") +
      '</table><p class="d-note">SLA 전문: monnit.co.kr/alarm/terms · 고객은 계약 체결 전에 SLA 전문을 제공받아 열람하고 그 내용에 동의하였습니다.</p></div>' +
      '<div class="d-sec"><h2>5. 계약 당사자</h2>' +
        '<p class="d-note" style="margin:0 0 8px">고객과 회사는 상호 동등한 입장에서 위 계약조건과 SLA에 따라 계약을 체결하고, 신의에 따라 성실히 의무를 이행할 것을 확약합니다. 본 계약은 전자서명으로 체결되었으며 「전자문서 및 전자거래 기본법」에 따라 서면과 동일한 효력을 가집니다.</p>' +
        '<div class="d-parties">' +
          '<div class="d-party"><h3>고객 (발주처)</h3>' + esc(u.name) + '<br>대표자 ' + esc(u.ceo) + '<br>' + esc(u.address) +
            '<div class="d-sig">' + (s.image ? '<img alt="고객 서명" src="' + s.image + '">' : "") + '<span class="d-st">' + esc(s.name) + (s.role ? " · " + esc(s.role) : "") + '<br>' + esc(kd(s.signedOn)) + '</span></div></div>' +
          '<div class="d-party"><h3>회사 (납품처)</h3>' + SUPPLIER.name + '<br>대표이사 ' + SUPPLIER.ceo + '<br>' + SUPPLIER.addr + '<br>사업자등록번호 ' + SUPPLIER.biz +
            '<div class="d-sig"><span class="d-seal">' + SUPPLIER.tel + ' · ' + SUPPLIER.mail + '<br>전자 접수번호 ' + esc(c.ref) + ' · ' + esc(kdt(c.submittedAt)) + '</span></div></div>' +
        '</div></div>' +
      '<div class="d-foot"><span>주식회사 모넷코리아 · 긴급 경보 알리미 구독서비스 계약서</span><span>' + esc(c.ref) + '</span></div>' +
      (c.license && c.license.image ? '<div class="d-sec d-attach"><h2>첨부. 사업자등록증</h2><img alt="사업자등록증" src="' + c.license.image + '"></div>' : "") +
    '</div>';
  }

  /* ── PDF ── */
  var LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"];
  function loadScript(src){
    return new Promise(function(res, rej){
      if(document.querySelector('script[src="' + src + '"]')){ return res(); }
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error("PDF 구성 요소를 불러오지 못했습니다. 인터넷 연결을 확인해 주십시오.")); };
      document.head.appendChild(s);
    });
  }
  function ensureLibs(){
    if(window.html2canvas && window.jspdf) return Promise.resolve();
    return LIBS.reduce(function(p, u){ return p.then(function(){ return loadScript(u); }); }, Promise.resolve());
  }
  function ensureStyle(){
    if(document.getElementById("mkdoc-css")) return;
    var st = document.createElement("style"); st.id = "mkdoc-css"; st.textContent = CSS; document.head.appendChild(st);
  }
  function waitImages(root){
    return Promise.all(Array.prototype.map.call(root.querySelectorAll("img"), function(im){
      return im.complete ? Promise.resolve() : new Promise(function(r){ im.onload = im.onerror = r; });
    }));
  }
  async function pdf(c, filename){
    await ensureLibs(); ensureStyle();
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1";
    host.innerHTML = html(c);
    document.body.appendChild(host);
    try{
      var doc = host.firstElementChild;
      await waitImages(doc);
      var PAGE_W = 794, PAGE_H = Math.round(794 * 285 / 210);  /* 쪽 윗여백 12mm 를 뺀 높이 */
      /* 자르는 위치: 섹션 경계 기준으로 */
      var blocks = Array.prototype.map.call(doc.querySelectorAll(".d-sec, .d-foot"), function(el){ return { top: el.offsetTop, h: el.offsetHeight, br: el.classList.contains("d-attach") }; });
      var cuts = [], start = 0;
      blocks.forEach(function(b){
        var bottom = b.top + b.h + 48;
        if(b.br || bottom - start > PAGE_H){ if(b.top > start){ cuts.push(b.top - 2); start = b.top - 2; } }
      });
      var total = doc.offsetHeight; cuts = cuts.filter(function(y){ return y > 0 && y < total; });
      /* 긴 섹션(첨부 이미지)이 한 페이지를 넘기면 고정 간격으로 추가 분할 */
      var bounds = [0].concat(cuts, [total]), pages = [];
      for(var i = 0; i < bounds.length - 1; i++){ var y = bounds[i], end = bounds[i + 1]; while(end - y > PAGE_H){ pages.push([y, y + PAGE_H]); y += PAGE_H; } pages.push([y, end]); }
      var scale = 2;
      var canvas = await window.html2canvas(doc, { scale: scale, useCORS: true, backgroundColor: "#ffffff", width: PAGE_W, windowWidth: PAGE_W, logging: false });
      var J = window.jspdf.jsPDF, out = new J({ unit: "mm", format: "a4", compress: true });
      pages.forEach(function(pg, idx){
        var y0 = Math.round(pg[0] * scale), y1 = Math.min(canvas.height, Math.round(pg[1] * scale)); if(y1 - y0 < 4) return;
        var cv = document.createElement("canvas"); cv.width = canvas.width; cv.height = y1 - y0;
        var x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(canvas, 0, y0, canvas.width, y1 - y0, 0, 0, cv.width, cv.height);
        if(idx > 0) out.addPage();
        out.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 0, idx > 0 ? 12 : 0, 210, 210 * cv.height / cv.width);
        out.setFontSize(8); out.setTextColor(140); out.text(String(idx + 1) + " / " + pages.length, 200, 292, { align: "right" });
      });
      var u = (c.customer || {});
      out.save(filename || ("계약서_" + safe(u.name) + "_" + (c.ref || "") + ".pdf"));
    } finally { host.remove(); }
  }
  function print(c){
    var w = window.open("", "_blank");
    if(!w){ alert("팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주십시오."); return; }
    w.document.write("<!doctype html><html lang='ko'><head><meta charset='utf-8'><title>계약서 " + esc(c.ref || "") + "</title><style>" + CSS + "body{margin:0;background:#fff}.mkdoc{width:auto;max-width:794px;margin:0 auto}@media print{@page{size:A4;margin:14mm}.mkdoc{padding:0}}</style></head><body>" + html(c) + "<script>setTimeout(function(){window.print()},400)<\/script></body></html>");
    w.document.close();
  }
  window.MKDoc = { html: html, pdf: pdf, print: print, normalize: normalize };
})();
