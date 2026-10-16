
/** 무선 알리미 구독 계약 체결 — 고객 화면 (/contract)
 *
 *  조건은 담당자가 관리 화면(/contract-admin)에서 만든 링크(?id=…)로 서버에서 받아 온다.
 *  고객 화면에서는 고칠 수 없고, 제출 시에도 서버는 저장된 조건만 쓴다.
 *  제출은 POST /api/alarm/contract 한 번. 서버가 기록 후 기존 /api/contract 로 전달해
 *  기존 알림 메일도 그대로 나간다.
 *
 *  메일이 안 나가도 접수는 살아 있다. 그래도 화면에는 전송 상태를 그대로
 *  보여 준다 — 고객이 "보냈는데 연락이 없다"고 하는 상황을 막기 위해서다.
 */
(function(){
  "use strict";
  var API = "/api/alarm/contract";
  var $ = function(id){ return document.getElementById(id); };
  function kdate(s){
    if(!s) return "—";
    var p = String(s).split("-");
    return p.length === 3 ? (p[0] + "년 " + Number(p[1]) + "월 " + Number(p[2]) + "일") : s;
  }
  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];
    });
  }
  var T = null, OFFER_ID = "", FIXED = false;
  function picked(){ return Array.prototype.map.call(document.querySelectorAll("#pick input:checked"), function(c){ return c.value; }); }
  function chosenProducts(){ return FIXED ? (T.products || []) : picked(); }
  function won(n){ return "￦ " + Number(n||0).toLocaleString("ko-KR"); }

  function etcHtml(){
    var lines = String(T.etc||"").split("\n")
      .map(function(l){ return l.replace(/^[-·\s]+/,"").trim(); })
      .filter(function(l){ return l; });
    if(!lines.length) return "—";
    return lines.map(function(l){ return "<div>· " + esc(l) + "</div>"; }).join("");
  }
  function discLabel(){
    if(!T.discount) return "";
    var k = T.discountType === "percent" ? ("할인 " + T.discountValue + "%") : "할인";
    return k + (T.discountNote ? " · " + T.discountNote : "");
  }
  function renderTerms(){
    var rows = '<div class="row"><span>월 이용료 (1개소)</span><span class="money">' + won(T.unit) + '</span></div>' +
      '<div class="row"><span>설치 개소</span><span class="money">' + T.qty + '개소</span></div>';
    if(T.discount){
      rows += '<div class="row"><span>정가 합계</span><span class="money">' + won(T.list) + '</span></div>' +
        '<div class="row disc"><span>' + esc(discLabel()) + '</span><span class="money">− ' + won(T.discount) + '</span></div>';
    }
    rows += '<div class="row total"><span>월 청구액 <small style="font-weight:400;color:var(--muted)">(부가세 별도)</small></span><span class="money">' + won(T.monthly) + '</span></div>';
    $("priceBox").innerHTML = rows;
    $("o_sol").textContent = (T.products && T.products.length) ? T.sol : (T.solNote ? T.solNote + " · 아래에서 알리미 선택" : "아래에서 알리미를 선택해 주십시오");
    $("o_term").textContent = kdate(T.from) + " ~ " + kdate(T.to);
    $("o_pay").textContent = T.pay || "—";
    $("o_bank").textContent = T.bank || "—";
    $("o_etc").innerHTML = etcHtml();

    $("v_sol").textContent = T.sol;
    $("v_price").textContent = "월 " + won(T.monthly);
    $("v_sites").textContent = T.qty + "개소 기준";
    $("v_disc").textContent = T.discount ? " · 정가 " + won(T.list) + "에서 " + discLabel() + " 적용" : "";
    $("v_notice").textContent = "매월 " + won(T.monthly) + " 청구 (부가세 별도) / 계약 해지 시 하드웨어는 반납";
    $("v_term").textContent = kdate(T.from) + " ~ " + kdate(T.to);
    $("v_pay").textContent = T.pay || "—";
    $("v_bank").textContent = T.bank || "—";
    $("v_etc").innerHTML = etcHtml();
    $("s_price").textContent = won(T.monthly) + " / 월 (부가세 별도)";
    $("s_term").textContent = kdate(T.from) + " ~ " + kdate(T.to);
  }
  function offerFail(t, d){
    $("loading").hidden = true;
    $("offerErr").hidden = false;
    $("offerErrT").textContent = t;
    $("offerErrD").textContent = d;
    $("stepnav").hidden = true;
  }

  /* ── 조건 받아오기 (서버에 저장된 조건만 사용) ── */
  OFFER_ID = new URLSearchParams(location.search).get("id") || "";
  if(!OFFER_ID){
    offerFail("전용 링크로 접속해 주십시오", "계약 조건은 담당자가 보내 드린 전용 링크에서만 확인하실 수 있습니다. 문의 02-2088-1454");
  }else{
    fetch("/api/alarm/offer?id=" + encodeURIComponent(OFFER_ID)).then(function(r){ return r.json(); }).then(function(o){
      if(!o || !o.ok) return offerFail("링크를 찾을 수 없습니다", "링크가 잘못되었거나 만료되었습니다. 담당자에게 다시 요청해 주십시오. 문의 02-2088-1454");
      if(o.status === "signed") return offerFail("이미 체결된 계약입니다", "이 링크로 계약이 이미 체결되었습니다. 변경이 필요하시면 02-2088-1454로 연락 주십시오.");
      if(o.status !== "open") return offerFail("사용할 수 없는 링크입니다", "담당자에게 새 링크를 요청해 주십시오. 문의 02-2088-1454");
      T = o.terms;
      renderTerms();
      FIXED = (T.products || []).length > 0;
      if(FIXED) applyProducts(T.products); else { $("pickBox").hidden = false; applyProducts([]); }
      $("loading").hidden = true;
      $("offerBox").hidden = false;
    }).catch(function(){
      offerFail("계약 조건을 불러오지 못했습니다", "잠시 후 다시 시도해 주십시오. 계속 안 되면 02-2088-1454로 연락 주십시오.");
    });
  }

  /* 1단계 → 2단계: 고객이 직접 고르는 경우 최소 1개 */
  $("go1").addEventListener("click", function(){
    if(!FIXED){
      if(!picked().length){ $("pickErr").hidden = false; $("pickErr").textContent = "알리미를 하나 이상 선택해 주십시오."; return; }
      $("pickErr").hidden = true;
      applyProducts(picked());
      $("v_sol").textContent = picked().map(function(k){ return PRODUCT_LABEL[k]; }).join(" · ") + (T.solNote ? " — " + T.solNote : "");
      $("o_sol").textContent = $("v_sol").textContent;
    }
    show(1);
  });
  Array.prototype.forEach.call(document.querySelectorAll("#pick input"), function(c){ c.addEventListener("change", function(){ $("pickErr").hidden = true; }); });

  /* ── 단계 이동 ── */
  var cur = 0, maxSeen = 0, PANES = ["p0","p1","p3","p4","p5"];
  function show(n){
    PANES.forEach(function(id){ $(id).classList.remove("on"); });
    if(n === 5){ $("p5").classList.add("on"); $("stepnav").hidden = true; window.scrollTo(0,0); return; }
    $("stepnav").hidden = false;
    $("p"+n).classList.add("on");
    cur = n;
    if(n > maxSeen) maxSeen = n;
    Array.prototype.forEach.call(document.querySelectorAll(".steptab"), function(b){
      var i = Number(b.dataset.go);
      b.setAttribute("aria-current", i === n ? "true" : "false");
      b.classList.toggle("done", i < maxSeen && i !== n);
    });
    window.scrollTo(0,0);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-next]"), function(b){
    b.addEventListener("click", function(){ show(Number(b.dataset.next)); });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".steptab"), function(b){
    b.addEventListener("click", function(){
      var n = Number(b.dataset.go);
      if(!T) return;
      if(n >= 1 && !FIXED && !picked().length){ show(0); $("pickErr").hidden = false; $("pickErr").textContent = "알리미를 하나 이상 선택해 주십시오."; return; }
      if(n >= 3 && !slaAgreedAt){ openSla(b, true); return; }
      show(n);
    });
  });

  /* ── SLA 팝업 ── */
  var slaViewedAt = "", slaAgreedAt = "", slaReadPct = 0, slaGate = false;
  var slaLastFocus = null;
  var slaModal = $("slamodal");

  function openSla(from, gate){
    slaGate = !!gate;
    slaLastFocus = from || document.activeElement;
    slaModal.hidden = false;
    /* iOS Safari 는 body 만 잠가서는 뒤 페이지가 같이 밀린다 */
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    $("mbody").scrollTop = 0;
    $("mbody").focus();
    if(!slaViewedAt) slaViewedAt = new Date().toISOString();
    $("slaAgreeBtn").textContent = slaGate ? "동의하고 계속" : "동의";
  }
  function closeSla(){
    slaModal.hidden = true;
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    if(slaLastFocus && slaLastFocus.focus) slaLastFocus.focus();
  }
  $("openSla").addEventListener("click", function(){ openSla(this, false); });
  $("openSla2").addEventListener("click", function(){ openSla(this, false); });

  /* 「고객 정보 입력 →」 — 동의 전이면 먼저 SLA 창을 띄우고, 동의해야 넘어간다 */
  $("go3").addEventListener("click", function(){
    if(slaAgreedAt) show(3);
    else openSla(this, true);
  });

  $("slaAgree").addEventListener("change", function(){
    $("slaAgreeBtn").disabled = !this.checked;
  });

  $("slaAgreeBtn").addEventListener("click", function(){
    if(!$("slaAgree").checked) return;
    if(!slaAgreedAt){
      slaAgreedAt = new Date().toISOString();
      var d = new Date(slaAgreedAt);
      $("slaseen").hidden = false;
      $("slaseenAt").textContent = d.toLocaleString("ko-KR");
      $("openSla").textContent = "SLA 전문 다시 보기";
    }
    var go = slaGate;
    closeSla();
    if(go) show(3);
  });
  Array.prototype.forEach.call(slaModal.querySelectorAll("[data-close]"), function(b){
    b.addEventListener("click", closeSla);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !slaModal.hidden) closeSla();
  });

  /* 어디까지 읽었는지 표시 — 부담 주지 않되 기록은 남긴다 */
  $("mbody").addEventListener("scroll", function(){
    var el = this, p = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    if(p > slaReadPct) slaReadPct = Math.min(1, p);
    $("slaprog").textContent = p > 0.98
      ? "제1조 ~ 제18조 전문 · 끝까지 확인함"
      : "제1조 ~ 제18조 전문 · " + Math.round(p * 100) + "% 읽음";
  });

  /* ── 사업자등록증 첨부 ── */
  var LIC = null;
  function setLicRequired(){
    var b2b = $("c_type").value === "B2B";
    $("licreq").hidden = !b2b;
    if(!LIC){
      $("licmsg").textContent = b2b
        ? "JPG·PNG 이미지 (최대 10MB). 스마트폰 촬영본도 괜찮습니다."
        : "소비자(B2C) 계약은 첨부하지 않아도 됩니다.";
    }
  }
  $("c_type").addEventListener("change", setLicRequired);
  setLicRequired();

  function takeFile(file){
    var msg = $("licmsg");
    if(!file) return;
    if(!/^image\//.test(file.type)){ msg.textContent = "이미지 파일만 첨부할 수 있습니다."; return; }
    if(file.size > 10 * 1024 * 1024){ msg.textContent = "10MB 이하 이미지를 첨부해 주십시오."; return; }
    msg.textContent = "불러오는 중…";
    var fr = new FileReader();
    fr.onerror = function(){ msg.textContent = "파일을 읽지 못했습니다. 다시 시도해 주십시오."; };
    fr.onload = function(){
      var im = new Image();
      im.onerror = function(){ msg.textContent = "이 형식은 브라우저에서 열 수 없습니다. JPG 또는 PNG로 변환해 첨부해 주십시오."; };
      im.onload = function(){
        var max = 1600, sc = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * sc));
        c.height = Math.max(1, Math.round(im.height * sc));
        var x = c.getContext("2d");
        x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL("image/jpeg", 0.82);
        LIC = {name:file.name, dataUrl:url};
        $("licimg").src = url;
        $("licname").textContent = file.name + " · " + Math.round(url.length / 1400) + "KB";
        $("licprev").hidden = false;
        msg.textContent = "첨부되었습니다. 다른 파일을 고르면 교체됩니다.";
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  $("licpick").addEventListener("click", function(){ $("c_lic").click(); });
  $("c_lic").addEventListener("change", function(){ takeFile(this.files && this.files[0]); });
  $("licdel").addEventListener("click", function(){
    LIC = null; $("c_lic").value = ""; $("licprev").hidden = true; setLicRequired();
  });
  ["dragenter","dragover"].forEach(function(ev){
    $("licdrop").addEventListener(ev, function(e){ e.preventDefault(); this.classList.add("drag"); });
  });
  ["dragleave","drop"].forEach(function(ev){
    $("licdrop").addEventListener(ev, function(e){ e.preventDefault(); this.classList.remove("drag"); });
  });
  $("licdrop").addEventListener("drop", function(e){
    takeFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  /* ── 고객 정보 검증 ── */
  var REQ = [["c_name","상호/성명"],["c_addr","주소"],["c_ceo","대표자"],
             ["c_mgr","담당자 성명"],["c_tel","담당자 연락처"],["c_mail","담당자 이메일"],
             ["c_site","설치 현장"],["r1n","수신자 1 성명"],["r1p","수신자 1 휴대전화"]];
  $("go4").addEventListener("click", function(){
    var miss = REQ.filter(function(p){ return !$(p[0]).value.trim(); });
    var e = $("err3");
    if(miss.length){
      e.hidden = false;
      e.textContent = "다음 항목을 입력해 주십시오 — " + miss.map(function(p){ return p[1]; }).join(", ");
      $(miss[0][0]).focus();
      return;
    }
    if($("c_type").value === "B2B" && !LIC){
      e.hidden = false;
      e.textContent = "사업자등록증 사본을 첨부해 주십시오.";
      $("licpick").focus();
      return;
    }
    e.hidden = true;
    $("s_lic").textContent = LIC ? ("첨부됨 · " + LIC.name) : "첨부 없음";
    $("s_cust").textContent = $("c_name").value.trim() + " (대표 " + $("c_ceo").value.trim() + ") · " + $("c_type").value;
    $("s_site").textContent = $("c_site").value.trim();
    if(!$("sg_name").value.trim()) $("sg_name").value = $("c_ceo").value.trim();
    gate();
    show(4);
  });


  /* ── 제품별 부속서·확인 항목 표시 ── */
  var PRODUCT_LABEL = {fire:"화재 알리미", water:"물감지 알리미", power:"정전 알리미", alarm:"경보 알리미", custom:"커스텀 알리미"};
  function applyProducts(list){
    var want = (list && list.length) ? list : ["fire","water","power","alarm","custom"];
    Array.prototype.forEach.call(document.querySelectorAll("[data-product]"), function(el){
      var on = want.indexOf(el.dataset.product) >= 0;
      el.hidden = !on;
      if(!on){ var c = el.querySelector("[data-ck]"); if(c) c.checked = false; }
    });
    var n = activeCks().length; if($("ckCount")) $("ckCount").textContent = n;
    var pdf = (want.length === 1) ? "/alarm/sla-" + want[0] + ".pdf" : "/alarm/sla.pdf";
    Array.prototype.forEach.call(document.querySelectorAll("a.slapdf"), function(a){ a.href = pdf; });
    var hd = document.querySelector(".annex-head .sub");
    if(hd && list && list.length) hd.textContent = "이 계약에 적용되는 부속서: " + want.map(function(k){ return PRODUCT_LABEL[k] || k; }).join(" · ") + ". 전체 부속서는 monnit.co.kr/alarm/terms 에서 볼 수 있습니다.";
  }
  function activeCks(){
    return Array.prototype.filter.call(document.querySelectorAll("[data-ck]"), function(c){
      var p = c.closest("[data-product]"); return !p || !p.hidden;
    });
  }
  function ackList(){
    return activeCks().map(function(c){ var e = c.parentNode.querySelector("em"); return e ? e.textContent.trim() : ""; }).filter(Boolean);
  }
  /* ── 확인 체크 ── */
  var cks = Array.prototype.slice.call(document.querySelectorAll("[data-ck]"));  /* 전체 — 표시 여부는 activeCks() 로 */
  function syncChecks(){
    cks.forEach(function(c){ c.parentNode.classList.toggle("on", c.checked); });
    $("ckall").checked = activeCks().every(function(c){ return c.checked; });
    gate();
  }
  cks.forEach(function(c){ c.addEventListener("change", syncChecks); });
  $("ckall").addEventListener("change", function(){
    var v = this.checked;
    activeCks().forEach(function(c){ c.checked = v; });
    syncChecks();
  });

  /* ── 서명 패드 ── */
  var cv = $("sigpad"), ctx = cv.getContext("2d"), drawing = false, hasInk = false, last = null;
  function fit(){
    var r = cv.getBoundingClientRect();
    if(!r.width) return;
    var dpr = window.devicePixelRatio || 1;
    var data = hasInk ? cv.toDataURL() : null;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F1A16";
    if(data){
      var im = new Image();
      im.onload = function(){ ctx.drawImage(im, 0, 0, r.width, r.height); };
      im.src = data;
    }
  }
  function pos(ev){
    var r = cv.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    return {x: t.clientX - r.left, y: t.clientY - r.top};
  }
  function start(ev){ ev.preventDefault(); drawing = true; last = pos(ev); }
  function move(ev){
    if(!drawing) return;
    ev.preventDefault();
    var p = pos(ev);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
    if(!hasInk){ hasInk = true; $("sigph").style.display = "none"; gate(); }
  }
  function end(){ drawing = false; }
  cv.addEventListener("mousedown", start);
  cv.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  cv.addEventListener("touchstart", start, {passive:false});
  cv.addEventListener("touchmove", move, {passive:false});
  cv.addEventListener("touchend", end);
  $("sigclear").addEventListener("click", function(){
    ctx.clearRect(0, 0, cv.width, cv.height);
    hasInk = false;
    $("sigph").style.display = "grid";
    gate();
  });
  window.addEventListener("resize", fit);
  setTimeout(fit, 60);

  var today = new Date();
  $("sg_date").textContent = today.getFullYear() + "년 " + (today.getMonth()+1) + "월 " + today.getDate() + "일";

  function gate(){
    var ok = !!slaAgreedAt && activeCks().every(function(c){ return c.checked; })
             && hasInk && !!$("sg_name").value.trim();
    $("submitBtn").disabled = !ok;
  }
  $("sg_name").addEventListener("input", gate);

  /* ── 제출 ── */
  function recvs(){
    return [1,2,3].map(function(i){
      return {name:$("r"+i+"n").value.trim(), phone:$("r"+i+"p").value.trim(), email:$("r"+i+"e").value.trim()};
    }).filter(function(r){ return r.name || r.phone; });
  }
  function ymd(d){ var p=function(n){return String(n).padStart(2,"0");}; return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
  function refNo(){
    var d = new Date(), p = function(n){ return String(n).padStart(2,"0"); };
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = "";
    for(var i=0;i<4;i++) r += abc[Math.floor(Math.random()*abc.length)];
    return "MK-" + d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + "-" + r;
  }

  $("submitBtn").addEventListener("click", async function(){
    var btn = this;
    btn.disabled = true;
    btn.textContent = "제출 중…";
    $("err4").hidden = true;

    var now = new Date();
    var body = {
      offerId: OFFER_ID,
      customer: {name:$("c_name").value.trim(), bizNo:$("c_biz").value.trim(), address:$("c_addr").value.trim(),
                 ceo:$("c_ceo").value.trim(), contractType:$("c_type").value,
                 manager:$("c_mgr").value.trim(), phone:$("c_tel").value.trim(),
                 email:$("c_mail").value.trim(), site:$("c_site").value.trim()},
      recipients: recvs(),
      slaViewedAt: slaViewedAt,
      slaAgreedAt: slaAgreedAt,
      slaReadPct: Math.round(slaReadPct * 100),
      acknowledged: ackList(),
      products: chosenProducts(),
      signature: {name:$("sg_name").value.trim(), role:$("sg_role").value.trim(),
                  signedOn: ymd(now), image: cv.toDataURL("image/png")},
      attachments: {businessLicense: LIC ? {filename:LIC.name, mimeType:"image/jpeg", image:LIC.dataUrl} : null}
    };

    var out = null;
    try{
      var res = await fetch(API, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(body)
      });
      out = await res.json();
    }catch(err){ out = null; }

    var ok = !!(out && out.ok);
    var no = (ok && out.ref) ? out.ref : "미접수";

    $("d_no").textContent = no;
    $("d_cust").textContent = body.customer.name + " (대표 " + body.customer.ceo + ")";
    $("d_site").textContent = body.customer.site;
    $("d_price").textContent = won(T.monthly) + " / 월 (부가세 별도)";
    $("d_term").textContent = kdate(T.from) + " ~ " + kdate(T.to);
    $("d_signer").textContent = body.signature.name + (body.signature.role ? " · " + body.signature.role : "");
    $("d_when").textContent = now.toLocaleString("ko-KR");
    $("d_mail").textContent = ok ? "모넷코리아에 접수되었습니다"
      : (out && out.error === "offer_signed" ? "이미 체결된 링크입니다" : "전송되지 않음");

    if(!ok){
      $("d_warn").hidden = false;
      $("d_warn").textContent = "계약서를 보내지 못했습니다. 아래 인쇄 버튼으로 PDF를 저장해 korea@monnit.com 으로 보내 주시면 동일하게 처리됩니다. 또는 02-2088-1454로 연락 주십시오.";
    }
    show(5);
  });

  $("printBtn").addEventListener("click", function(){ window.print(); });
})();
