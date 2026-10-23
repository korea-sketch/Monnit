/** 긴급 경보 알리미 구독 계약 — 고객 화면 (/contract?id=…)   2026-10-21 개편
 *
 *  흐름: ① 계약 조건 확인(제품 선택) → ② 계약서·SLA 동의 → ③ 고객 정보 → ④ 계약서 내려받기·회신
 *  - 전자서명은 받지 않는다. ④에 들어갈 때 고객 정보를 서버에 보내 계약번호를 받고(계약서 발급),
 *    고객은 A4 양면 계약서(앞면 계약 · 뒷면 SLA)를 내려받거나 인쇄해 직인을 날인한다.
 *  - 회신: 날인 계약서 + 사업자등록증을 이 화면에서 올리거나(POST /api/alarm/contract/file) 1015@monnit.com 으로 메일.
 *  - 같은 링크를 다시 열면 발급된 계약서를 다시 내려받고 회신할 수 있다(조건은 언제나 서버 값).
 */
(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var RETURN_MAIL = "1015@monnit.com";
  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function kdate(s){ if(!s) return "—"; var p = String(s).split("-"); return p.length === 3 ? (p[0] + "년 " + Number(p[1]) + "월 " + Number(p[2]) + "일") : s; }
  function won(n){ return "￦ " + Number(n || 0).toLocaleString("ko-KR"); }
  function size(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(n / 1024)) + "KB"; }

  var T = null, OFFER_ID = "", FIXED = false, REC = null, STATUS = "open";
  var LABEL = window.MKPaper ? window.MKPaper.LABEL : {};
  function picked(){ return Array.prototype.map.call(document.querySelectorAll("#pick input:checked"), function(c){ return c.value; }); }
  function chosen(){ return FIXED ? (T.products || []) : picked(); }

  /* ── 수신자 칸 (10개) ── */
  (function(){
    var g = $("recvGrid"), h = "";
    for(var i = 1; i <= 10; i++){
      h += '<div class="f recv" data-i="' + i + '"><label for="r' + i + 'n">수신자 ' + i + ' 성명</label><input type="text" id="r' + i + 'n"></div>' +
           '<div class="f recv" data-i="' + i + '"><label for="r' + i + 'p">휴대전화</label><input type="tel" id="r' + i + 'p" placeholder="010-0000-0000"></div>' +
           '<div class="f recv" data-i="' + i + '"><label for="r' + i + 'e">이메일</label><input type="email" id="r' + i + 'e"></div>';
    }
    g.innerHTML = h;
  })();
  var recvShown = 3;
  function recvSync(){
    document.querySelectorAll("#recvGrid .recv").forEach(function(f){ f.hidden = Number(f.dataset.i) > recvShown; });
    $("recvCount").textContent = recvShown + " / 10";
    $("recvMore").hidden = recvShown >= 10;
  }
  $("recvMore").addEventListener("click", function(){ if(recvShown < 10){ recvShown++; recvSync(); $("r" + recvShown + "n").focus(); } });
  recvSync();
  function recvRows(){
    var out = [];
    for(var i = 1; i <= 10; i++) out.push({ i: i, name: $("r"+i+"n").value.trim(), phone: $("r"+i+"p").value.trim(), email: $("r"+i+"e").value.trim() });
    return out.filter(function(r){ return r.name || r.phone; });
  }

  /* ── 계약 조건 표시 ── */
  function etcHtml(){
    var lines = String(T.etc || "").split("\n").map(function(l){ return l.replace(/^[-·\s]+/, "").trim(); }).filter(Boolean);
    return lines.length ? lines.map(function(l){ return "<div>· " + esc(l) + "</div>"; }).join("") : "—";
  }
  function discLabel(){
    if(!T.discount) return "";
    return (T.discountType === "percent" ? "할인 " + T.discountValue + "%" : "할인") + (T.discountNote ? " · " + T.discountNote : "");
  }
  function solText(list){
    if(!list.length) return T.solNote ? T.solNote + " · 아래에서 알리미 선택" : "아래에서 알리미를 선택해 주십시오";
    return window.MKPaper.meta(list, T.solNote).solution;
  }
  /* 2026-10-23 지역 출장비 자동 — 링크가 region "auto" 면 3단계에서 입력한 설치 현장 주소로 판정해 금액을 바로 바꾼다.
     최종 금액은 계약서 발급 때 서버가 같은 규칙으로 다시 계산한다. */
  function siteAddrNow(){ var el = $("c_siteAddr"), el2 = $("c_addr"); return (el && el.value.trim()) || (el2 && el2.value.trim()) || ""; }
  function renderTerms(){
    var P = window.MKPaper || {}, R = P.REGION || {}, FEE = P.REGION_FEE || 10000;
    var E = P.settle ? P.settle(T, siteAddrNow()) : T;
    var pending = E.region === "auto";
    var rows = '<div class="row"><span>월 이용료 (1개소)</span><span class="money">' + won(E.unit) + "</span></div>" +
      '<div class="row"><span>설치 개소</span><span class="money">' + E.qty + "개소</span></div>";
    if(pending) rows += '<div class="row"><span>지역 출장비 <small style="color:var(--muted)">(개소 수와 무관 · 설치 주소로 자동 적용)</small></span><span class="money">' + esc(R.metro || "서울·경기·인천") + " 0 / 그 외 + " + won(FEE) + "</span></div>";
    else if(E.region === "other") rows += '<div class="row"><span>지역 출장비 (' + esc(R.other || "그 외 지역") + ' · 개소 수와 무관)</span><span class="money">+ ' + won(E.regionFee) + "</span></div>";
    if(E.region) rows += '<div class="row"><span>설치비 · 출장비</span><span class="money">' + (E.region === "metro" ? "무료 (" + esc(R.metro || "서울·경기·인천") + ")" : "별도 청구 없음") + "</span></div>";
    if(E.discount) rows += '<div class="row"><span>정가 합계</span><span class="money">' + won(E.list) + "</span></div>" +
      '<div class="row disc"><span>' + esc(discLabel()) + '</span><span class="money">− ' + won(E.discount) + "</span></div>";
    rows += '<div class="row total"><span>월 청구액 <small style="font-weight:400;color:var(--muted)">(부가세 별도' + (pending ? " · 서울·경기·인천 기준" : "") + ')</small></span><span class="money">' + won(E.monthly) + "</span></div>";
    $("priceBox").innerHTML = rows;
    $("o_sol").textContent = solText(T.products || []);
    $("o_term").textContent = kdate(T.from) + " ~ " + kdate(T.to);
    $("o_pay").textContent = T.pay || "—";
    $("o_bank").textContent = T.bank || "—";
    $("o_etc").innerHTML = etcHtml();
    $("v_price").textContent = "월 " + won(E.monthly);
    $("v_sites").textContent = E.qty + "개소 기준" + (pending ? " · 설치 현장이 서울·경기·인천 외 지역이면 지역 출장비 월 " + Number(FEE).toLocaleString("ko-KR") + "원 추가(개소 수와 무관)"
      : E.region === "other" ? " · 지역 출장비 월 " + Number(E.regionFee || 0).toLocaleString("ko-KR") + "원 포함(개소 수와 무관)" : E.region === "metro" ? " · 설치비 무료" : "");
    $("v_disc").textContent = E.discount ? " · 정가 " + won(E.list) + "에서 " + discLabel() + " 적용" : "";
    $("v_term").textContent = kdate(T.from) + " ~ " + kdate(T.to);
    $("v_pay").textContent = T.pay || "—";
    $("v_bank").textContent = T.bank || "—";
    $("v_etc").innerHTML = etcHtml();
  }
  /* 제품이 정해지면 계약서 명칭·솔루션·안내 문구와 SLA 부속서를 맞춘다 */
  function applyProducts(list){
    var want = list.length ? list : ["fire","water","power","alarm","custom"];
    Array.prototype.forEach.call(document.querySelectorAll("#slamodal [data-product]"), function(el){
      var on = want.indexOf(el.dataset.product) >= 0;
      el.hidden = !on;
      if(!on){ var c = el.querySelector("[data-ck]"); if(c) c.checked = false; }
    });
    if($("ckCount")) $("ckCount").textContent = activeCks().length;
    var pdf = want.length === 1 ? "/alarm/sla-" + want[0] + ".pdf" : "/alarm/sla.pdf";
    document.querySelectorAll("a.slapdf").forEach(function(a){ a.href = pdf; });
    var hd = document.querySelector("#slamodal .annex-head .sub");
    if(hd && list.length) hd.textContent = "이 계약에 적용되는 부속서: " + want.map(function(k){ return LABEL[k] || k; }).join(" · ") + ". 전체 부속서는 monnit.co.kr/alarm/terms 에서 볼 수 있습니다.";
    if(list.length){
      var m = window.MKPaper.meta(list, T.solNote);
      $("v_title").textContent = m.title + " 구독서비스 계약서";
      $("v_sol").textContent = m.solution;
      $("v_notice").textContent = m.notice;
      $("o_sol").textContent = m.solution;
      document.title = m.title + " 구독 계약 | 모넷코리아";
    }
  }

  function offerFail(t, d){
    $("loading").hidden = true; $("offerErr").hidden = false;
    $("offerErrT").textContent = t; $("offerErrD").textContent = d;
    $("stepnav").hidden = true;
  }

  /* ── 조건 받아오기 ── */
  OFFER_ID = new URLSearchParams(location.search).get("id") || "";
  if(!OFFER_ID){
    offerFail("전용 링크로 접속해 주십시오", "계약 조건은 담당자가 보내 드린 전용 링크에서만 확인하실 수 있습니다. 문의 02-2088-1454");
  }else{
    fetch("/api/alarm/offer?id=" + encodeURIComponent(OFFER_ID)).then(function(r){ return r.json(); }).then(function(o){
      if(!o || !o.ok) return offerFail("링크를 찾을 수 없습니다", "링크가 잘못되었거나 만료되었습니다. 담당자에게 다시 요청해 주십시오. 문의 02-2088-1454");
      if(o.status === "void") return offerFail("사용할 수 없는 링크입니다", "담당자에게 새 링크를 요청해 주십시오. 문의 02-2088-1454");
      T = o.terms; STATUS = o.status;
      FIXED = (T.products || []).length > 0;
      renderTerms();
      if(FIXED) applyProducts(T.products); else { $("pickBox").hidden = false; applyProducts([]); }
      $("loading").hidden = true; $("offerBox").hidden = false;
      /* 이미 계약서를 발급한 링크 → 4단계(내려받기·회신)로 바로 */
      if(o.contract){
        REC = o.contract;
        if(!FIXED) (REC.terms.products || []).forEach(function(k){ var c = document.querySelector('#pick input[value="' + k + '"]'); if(c) c.checked = true; });
        applyProducts(REC.terms.products || []);
        fillForm(REC);
        slaAgreedAt = REC.slaAgreedAt || "issued";
        maxSeen = 4; showIssued();
      }
    }).catch(function(){
      offerFail("계약 조건을 불러오지 못했습니다", "잠시 후 다시 시도해 주십시오. 계속 안 되면 02-2088-1454로 연락 주십시오.");
    });
  }

  $("go1").addEventListener("click", function(){
    if(!FIXED){
      if(!picked().length){ $("pickErr").hidden = false; $("pickErr").textContent = "알리미를 하나 이상 선택해 주십시오."; return; }
      $("pickErr").hidden = true;
      applyProducts(picked());
    }
    show(1);
  });
  document.querySelectorAll("#pick input").forEach(function(c){ c.addEventListener("change", function(){ $("pickErr").hidden = true; }); });

  /* ── 단계 이동 ── */
  var maxSeen = 0, PANES = ["p0","p1","p3","p4"];
  function show(n){
    if(n === 4 && !REC) n = 3;
    PANES.forEach(function(id){ $(id).classList.remove("on"); });
    $("p" + n).classList.add("on");
    if(n > maxSeen) maxSeen = n;
    document.querySelectorAll(".steptab").forEach(function(b){
      var i = Number(b.dataset.go);
      b.setAttribute("aria-current", i === n ? "true" : "false");
      b.classList.toggle("done", i < maxSeen && i !== n);
    });
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-next]").forEach(function(b){ b.addEventListener("click", function(){ show(Number(b.dataset.next)); }); });
  document.querySelectorAll(".steptab").forEach(function(b){
    b.addEventListener("click", function(){
      var n = Number(b.dataset.go);
      if(!T) return;
      if(n >= 1 && !FIXED && !picked().length){ show(0); $("pickErr").hidden = false; $("pickErr").textContent = "알리미를 하나 이상 선택해 주십시오."; return; }
      if(n >= 3 && !slaAgreedAt){ openSla(b, true); return; }
      if(n === 4 && !REC){ $("go4").click(); return; }
      show(n);
    });
  });

  /* ── SLA 팝업 (서명 전 확인 항목 포함) ── */
  var slaViewedAt = "", slaAgreedAt = "", slaReadPct = 0, slaGate = false, slaLastFocus = null, slaModal = $("slamodal");
  function openSla(from, gate){
    slaGate = !!gate; slaLastFocus = from || document.activeElement;
    slaModal.hidden = false;
    document.body.style.overflow = "hidden"; document.documentElement.style.overflow = "hidden";
    $("mbody").scrollTop = 0; $("mbody").focus();
    if(!slaViewedAt) slaViewedAt = new Date().toISOString();
    agreeGate();
  }
  function closeSla(){
    slaModal.hidden = true;
    document.body.style.overflow = ""; document.documentElement.style.overflow = "";
    if(slaLastFocus && slaLastFocus.focus) slaLastFocus.focus();
  }
  $("openSla").addEventListener("click", function(){ openSla(this, false); });
  $("go3").addEventListener("click", function(){ if(slaAgreedAt) show(3); else openSla(this, true); });
  function activeCks(){
    return Array.prototype.filter.call(document.querySelectorAll("#slamodal [data-ck]"), function(c){ var p = c.closest("[data-product]"); return !p || !p.hidden; });
  }
  function ackList(){ return activeCks().map(function(c){ var e = c.parentNode.querySelector("em"); return e ? e.textContent.trim() : ""; }).filter(Boolean); }
  function agreeGate(){
    var all = activeCks().every(function(c){ return c.checked; }) && $("slaAgree").checked;
    $("slaAgreeBtn").hidden = !all; $("slaAgreeBtn").textContent = slaGate ? "동의하고 계속" : "동의";
    $("agreeAllBtn").hidden = all; $("agreeAllBtn").textContent = slaGate ? "전체 동의하고 계속" : "전체 동의";
  }
  function syncChecks(){
    document.querySelectorAll("#slamodal [data-ck]").forEach(function(c){ c.parentNode.classList.toggle("on", c.checked); });
    if($("ckall")) $("ckall").checked = activeCks().every(function(c){ return c.checked; });
    agreeGate();
  }
  document.querySelectorAll("#slamodal [data-ck]").forEach(function(c){ c.addEventListener("change", syncChecks); });
  if($("ckall")) $("ckall").addEventListener("change", function(){ var v = this.checked; activeCks().forEach(function(c){ c.checked = v; }); syncChecks(); });
  $("slaAgree").addEventListener("change", agreeGate);
  function finishAgree(){
    if(!slaAgreedAt || slaAgreedAt === "issued"){
      slaAgreedAt = new Date().toISOString();
      $("slaseen").hidden = false; $("slaseenAt").textContent = new Date(slaAgreedAt).toLocaleString("ko-KR");
      $("openSla").textContent = "SLA 전문 다시 보기";
    }
    var go = slaGate; closeSla(); if(go) show(3);
  }
  $("slaAgreeBtn").addEventListener("click", function(){ if($("slaAgree").checked && activeCks().every(function(c){ return c.checked; })) finishAgree(); });
  $("agreeAllBtn").addEventListener("click", function(){ activeCks().forEach(function(c){ c.checked = true; }); $("slaAgree").checked = true; syncChecks(); finishAgree(); });
  slaModal.querySelectorAll("[data-close]").forEach(function(b){ b.addEventListener("click", closeSla); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && !slaModal.hidden) closeSla(); });
  $("mbody").addEventListener("scroll", function(){
    var p = (this.scrollTop + this.clientHeight) / this.scrollHeight;
    if(p > slaReadPct) slaReadPct = Math.min(1, p);
    $("slaprog").textContent = p > 0.98 ? "제1조 ~ 제18조 · 부속서 전문 · 끝까지 확인함" : "제1조 ~ 제18조 · 부속서 전문 · " + Math.round(p * 100) + "% 읽음";
  });

  /* ── 3 → 4: 고객 정보 검증 후 계약서 발급 ── */
  var REQ = [["c_name","상호/성명"],["c_addr","주소"],["c_ceo","대표자"],["c_mgr","담당자 성명"],["c_tel","담당자 연락처"],["c_mail","담당자 이메일"],["c_site","설치 현장명"],["c_siteAddr","설치 현장 주소"]];
  function fillForm(r){
    var u = r.customer || {};
    $("c_name").value = u.name || ""; $("c_biz").value = u.bizNo || ""; $("c_addr").value = u.address || ""; $("c_ceo").value = u.ceo || "";
    $("c_type").value = u.contractType === "B2C" ? "B2C" : "B2B"; $("c_mgr").value = u.manager || ""; $("c_tel").value = u.phone || "";
    $("c_mail").value = u.email || ""; $("c_site").value = u.site || ""; $("c_siteAddr").value = u.siteAddr || "";
    (r.recipients || []).forEach(function(x, i){ if(i < 10){ $("r"+(i+1)+"n").value = x.name || ""; $("r"+(i+1)+"p").value = x.phone || ""; $("r"+(i+1)+"e").value = x.email || ""; } });
    recvShown = Math.max(3, Math.min(10, (r.recipients || []).length)); recvSync();
  }
  $("go4").addEventListener("click", async function(){
    var e = $("err3");
    var miss = REQ.filter(function(p){ return !$(p[0]).value.trim(); });
    if(miss.length){ e.hidden = false; e.textContent = "다음 항목을 입력해 주십시오 — " + miss.map(function(p){ return p[1]; }).join(", "); $(miss[0][0]).focus(); return; }
    if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test($("c_mail").value.trim())){ e.hidden = false; e.textContent = "담당자 이메일 형식을 확인해 주십시오."; $("c_mail").focus(); return; }
    var half = recvRows().filter(function(r){ return (r.name && !r.phone) || (!r.name && r.phone); });
    if(half.length){ e.hidden = false; e.textContent = "수신자 " + half[0].i + "의 성명과 휴대전화를 함께 입력해 주십시오."; $("r" + half[0].i + (half[0].name ? "p" : "n")).focus(); return; }
    if(!slaAgreedAt){ openSla(this, true); return; }
    e.hidden = true;
    var btn = this, t = btn.textContent; btn.disabled = true; btn.textContent = "계약서 만드는 중…";
    var body = {
      offerId: OFFER_ID, products: chosen(),
      customer: { name: $("c_name").value.trim(), bizNo: $("c_biz").value.trim(), address: $("c_addr").value.trim(), ceo: $("c_ceo").value.trim(),
                  contractType: $("c_type").value, manager: $("c_mgr").value.trim(), phone: $("c_tel").value.trim(), email: $("c_mail").value.trim(), site: $("c_site").value.trim(), siteAddr: $("c_siteAddr").value.trim() },
      recipients: recvRows().map(function(r){ return { name: r.name, phone: r.phone, email: r.email }; }),
      slaViewedAt: slaViewedAt, slaAgreedAt: slaAgreedAt === "issued" ? (REC && REC.slaAgreedAt) || "" : slaAgreedAt,
      slaReadPct: Math.round(slaReadPct * 100), acknowledged: ackList()
    };
    var out = null;
    try{
      var res = await fetch("/api/alarm/contract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      out = await res.json();
    }catch(err){ out = null; }
    btn.disabled = false; btn.textContent = t;
    if(!out || !out.ok){
      var why = { offer_returned: "이미 날인본이 회신된 계약입니다. 변경은 02-2088-1454로 연락 주십시오.", offer_signed: "이미 체결이 완료된 계약입니다.", offer_void: "무효 처리된 링크입니다. 담당자에게 새 링크를 요청해 주십시오." };
      e.hidden = false; e.textContent = (out && why[out.error]) || "계약서를 만들지 못했습니다. 잠시 후 다시 시도해 주십시오. 계속 안 되면 02-2088-1454로 연락 주십시오.";
      return;
    }
    REC = out.contract; STATUS = "issued";
    showIssued();
  });

  /* ── 4. 내려받기 · 회신 ── */
  var STLABEL = { issued: "계약서 발급 · 회신 대기", returned: "회신 접수 · 확인 중", signed: "체결 완료" };
  function showIssued(){
    var t = REC.terms, u = REC.customer, m = window.MKPaper.meta(t.products, t.solNote);
    $("d_no").textContent = REC.ref;
    $("d_sol").textContent = t.products && t.products.length ? m.solution : t.solution;
    $("d_cust").textContent = u.name + " (대표 " + u.ceo + ")";
    $("d_site").textContent = u.site;
    $("d_siteAddr").textContent = u.siteAddr || "—";
    $("d_price").textContent = won(t.monthly) + " / 월 (부가세 별도)";
    $("d_term").textContent = kdate(t.from) + " ~ " + kdate(t.to);
    var st = REC.status || STATUS || "issued";
    $("d_state").textContent = STLABEL[st] || st; $("d_state").className = "pill " + st;
    $("mailLink").href = "mailto:" + RETURN_MAIL + "?subject=" + encodeURIComponent("[계약서 회신] " + u.name + " · " + REC.ref) +
      "&body=" + encodeURIComponent("계약번호: " + REC.ref + "\n상호: " + u.name + "\n\n직인 날인한 계약서와 사업자등록증 사본을 첨부합니다.\n");
    $("editBtn").hidden = st !== "issued";
    if(st === "signed"){ $("p4title").textContent = "계약 체결이 완료되었습니다"; $("p4lede").textContent = "모넷코리아가 날인본을 확인했습니다. 계약서는 아래에서 다시 내려받으실 수 있습니다."; $("upBox").hidden = true; $("procBox").hidden = true; }
    else if(st === "returned"){ $("p4title").textContent = "회신해 주셔서 감사합니다"; $("p4lede").textContent = "날인 계약서가 접수되어 모넷코리아가 확인 중입니다. 빠진 파일이 있으면 아래에서 더 올려 주시거나 1015@monnit.com 으로 보내 주십시오."; }
    renderSent();
    show(4);
  }
  $("editBtn").addEventListener("click", function(){ show(3); });
  async function busy(b, fn){
    var t = b.textContent; b.disabled = true; b.textContent = "준비 중…"; $("pdfMsg").classList.remove("err");
    try{ await fn(); }catch(err){ $("pdfMsg").textContent = err.message || "실패했습니다. 다시 시도해 주십시오."; $("pdfMsg").classList.add("err"); }
    b.disabled = false; b.textContent = t;
  }
  $("pdfBtn").addEventListener("click", function(){ var b = this; busy(b, function(){ return window.MKPaper.pdf(REC); }); });
  $("printBtn").addEventListener("click", function(){
    var b = this, p = window.MKPaper.print(REC);   /* 팝업은 클릭 안에서 바로 열어야 한다 */
    busy(b, function(){ return p; });
  });

  /* ── 회신 파일 ── */
  var PENDING = [];   /* {kind, file, name, type, blob} */
  var KIND = { contract: "날인 계약서", license: "사업자등록증" };
  function renderPending(){
    $("pending").innerHTML = PENDING.map(function(p, i){
      return '<li><span class="k">' + KIND[p.kind] + '</span><span class="n">' + esc(p.name) + '</span><span class="s">' + size(p.blob.size) + '</span><button type="button" class="btn quiet sm" data-rm="' + i + '">빼기</button></li>';
    }).join("");
    var hasC = PENDING.some(function(p){ return p.kind === "contract"; });
    var hasL = PENDING.some(function(p){ return p.kind === "license"; }) || sentHas("license");
    $("upBtn").disabled = !PENDING.length;
    $("upHint").textContent = !PENDING.length ? "파일을 끌어다 놓아도 됩니다." : (!hasC && !sentHas("contract") ? "날인한 계약서도 함께 올려 주십시오." : (!hasL ? "사업자등록증 사본도 함께 올려 주십시오. 나중에 메일로 보내셔도 됩니다." : "준비되었습니다."));
  }
  function sentHas(kind){ return (REC && REC.files || []).some(function(f){ return f.kind === kind; }); }
  $("pending").addEventListener("click", function(e){ var b = e.target.closest("[data-rm]"); if(!b) return; PENDING.splice(Number(b.dataset.rm), 1); renderPending(); });
  /* 사진은 글자가 읽히는 선에서 줄인다 (긴 변 2400px · JPEG) — 업로드 시간을 줄이기 위해 */
  function shrink(file){
    return new Promise(function(res){
      if(!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900 * 1024) return res(file);
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function(){
        var max = 2400, sc = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function(b){ res(b && b.size < file.size ? b : file); }, "image/jpeg", 0.86);
      };
      im.onerror = function(){ URL.revokeObjectURL(url); res(file); };
      im.src = url;
    });
  }
  async function take(kind, files){
    $("upErr").hidden = true;
    for(var i = 0; i < files.length; i++){
      var f = files[i];
      if(!/^image\//.test(f.type) && f.type !== "application/pdf"){ $("upErr").hidden = false; $("upErr").textContent = f.name + " — PDF 또는 이미지(JPG·PNG) 파일만 올릴 수 있습니다."; continue; }
      var b = await shrink(f);
      if(b.size > 10 * 1024 * 1024){ $("upErr").hidden = false; $("upErr").textContent = f.name + " — 10MB 이하로 올려 주십시오. 큰 파일은 " + RETURN_MAIL + " 으로 보내 주셔도 됩니다."; continue; }
      if(kind === "license") PENDING = PENDING.filter(function(p){ return p.kind !== "license"; });
      var nm = b === f ? f.name : f.name.replace(/\.\w+$/, "") + ".jpg";
      PENDING.push({ kind: kind, name: nm, type: b.type || f.type, blob: b });
    }
    renderPending();
  }
  document.querySelectorAll("#upBox .upload").forEach(function(box){
    var inp = box.querySelector("input"), kind = box.dataset.kind;
    box.querySelector("[data-pick]").addEventListener("click", function(){ inp.click(); });
    inp.addEventListener("change", function(){ take(kind, Array.prototype.slice.call(inp.files || [])); inp.value = ""; });
    ["dragenter","dragover"].forEach(function(ev){ box.addEventListener(ev, function(e){ e.preventDefault(); box.classList.add("drag"); }); });
    ["dragleave","drop"].forEach(function(ev){ box.addEventListener(ev, function(e){ e.preventDefault(); box.classList.remove("drag"); }); });
    box.addEventListener("drop", function(e){ take(kind, Array.prototype.slice.call(e.dataTransfer && e.dataTransfer.files || [])); });
  });
  $("upBtn").addEventListener("click", async function(){
    if(!PENDING.length || !REC) return;
    var btn = this; btn.disabled = true; $("upErr").hidden = true;
    var done = 0, total = PENDING.length;
    while(PENDING.length){
      var p = PENDING[0];
      btn.textContent = "올리는 중… " + (done + 1) + " / " + total;
      var out = null;
      try{
        var q = "?offer=" + encodeURIComponent(OFFER_ID) + "&ref=" + encodeURIComponent(REC.ref) + "&kind=" + p.kind + "&name=" + encodeURIComponent(p.name);
        var res = await fetch("/api/alarm/contract/file" + q, { method: "POST", headers: { "content-type": p.type || "application/octet-stream" }, body: p.blob });
        out = await res.json();
      }catch(err){ out = null; }
      if(!out || !out.ok){
        $("upErr").hidden = false;
        $("upErr").textContent = p.name + " — 올리지 못했습니다" + (out && out.error === "too_large" ? " (10MB 초과)" : "") + ". 다시 시도하시거나 " + RETURN_MAIL + " 으로 보내 주십시오.";
        break;
      }
      REC.files = out.files; REC.status = out.status; PENDING.shift(); done++;
    }
    btn.textContent = "회신 제출";
    renderPending(); renderSent();
    if(done && !PENDING.length){ $("d_state").textContent = STLABEL[REC.status] || REC.status; $("d_state").className = "pill " + REC.status; }
  });
  function renderSent(){
    var fs = REC && REC.files || [];
    $("sentBox").hidden = !fs.length;
    if(!fs.length) return;
    var hasC = sentHas("contract"), hasL = sentHas("license");
    $("sentTxt").textContent = "모넷코리아에 전달된 파일입니다." + (!hasC ? " 날인한 계약서를 아직 받지 못했습니다." : "") + (!hasL ? " 사업자등록증 사본을 함께 보내 주십시오." : "") + (hasC && hasL ? " 확인 후 연락드리겠습니다." : "");
    $("sentList").innerHTML = fs.map(function(f){ return '<li><span class="k">' + (KIND[f.kind] || "첨부") + '</span><span class="n">' + esc(f.name) + '</span><span class="s">' + new Date(f.uploadedAt).toLocaleString("ko-KR") + "</span></li>"; }).join("");
    renderPending();
  }
  /* 설치 현장 주소 = 발주처 주소 */
  function syncAddr(){ if($("c_sameAddr").checked){ $("c_siteAddr").value = $("c_addr").value; } $("c_siteAddr").readOnly = $("c_sameAddr").checked; }
  $("c_sameAddr").addEventListener("change", syncAddr);
  $("c_addr").addEventListener("input", function(){ if($("c_sameAddr").checked) $("c_siteAddr").value = this.value; });
  /* 설치 주소가 바뀌면 지역 출장비를 다시 계산해 보여 준다 */
  ["c_addr","c_siteAddr","c_sameAddr"].forEach(function(id){ var el = $(id); if(el){ el.addEventListener("input", function(){ if(T) renderTerms(); }); el.addEventListener("change", function(){ if(T) renderTerms(); }); } });
  /* 이 계약 화면 링크 — 맨 아래에서 복사 (execCommand → Clipboard API → 직접 선택 안내) */
  (function(){
    var url = location.origin + "/contract?id=" + encodeURIComponent(OFFER_ID);
    var inp = $("selfLink"); inp.value = url;
    inp.addEventListener("focus", function(){ var t = this; setTimeout(function(){ t.select(); }, 0); });
    $("selfCopy").addEventListener("click", function(){
      var b = this, ok = false;
      inp.focus(); inp.select(); inp.setSelectionRange(0, url.length);
      try{ ok = document.execCommand("copy"); }catch(e){ ok = false; }
      var done = function(){ b.textContent = "복사됨 ✓"; $("selfMsg").textContent = "링크를 복사했습니다. 메모나 메일에 붙여 넣어 보관해 주십시오."; setTimeout(function(){ b.textContent = "링크 복사"; }, 1600); };
      var fail = function(){ $("selfMsg").textContent = "자동 복사가 막힌 브라우저입니다. 위 칸의 링크가 선택되어 있으니 Ctrl+C(맥은 ⌘+C)로 복사해 주십시오."; inp.focus(); inp.select(); };
      if(ok) return done();
      if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fail); else fail();
    });
  })();
})();
