
/** 긴급 경보 알리미 — 기존 고객 SLA 확인 및 동의 (/sla-consent?k=고객ID)
 *
 *  고객 정보는 관리 화면(/contract-admin)에서 등록한 고객 ID로 서버에서 받아 온다.
 *  제출은 POST /api/alarm/consent. "지금은 동의하지 않음"도 기록한다.
 *  SLA는 고객이 "동의합니다"를 고르고 체크·서명한 경우에만 적용 대상으로 기록된다.
 */
(function(){
  "use strict";
  var API = "/api/alarm/consent";
  var SLA_VERSION = "Rev. 3.0";
  var $ = function(id){ return document.getElementById(id); };

  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];
    });
  }
  function kdate(s){
    if(!s) return "—";
    var p = String(s).split("-");
    return p.length === 3 ? (p[0] + "년 " + Number(p[1]) + "월 " + Number(p[2]) + "일") : s;
  }
  /* ── 고객 정보 받아오기 ── */
  var C = null, K = new URLSearchParams(location.search).get("k") || "", FIXED = false;
  function picked(){ return Array.prototype.map.call(document.querySelectorAll("#pick input:checked"), function(c){ return c.value; }); }
  function chosenProducts(){ return FIXED ? (C && C.products || []) : picked(); }
  function nolink(bad){
    $("nolink").hidden = false; $("p1nav").hidden = true; $("stepnav").hidden = true;
    if(bad) $("nolinkMsg").innerHTML = '접속하신 링크가 만료되었거나 올바르지 않습니다. 메일에 있는 링크를 다시 눌러 주시거나 <a href="mailto:1015@monnit.com">1015@monnit.com</a> · 02-2088-1454로 연락 주십시오. SLA 전문은 아래에서 확인하실 수 있습니다.';
  }
  if(!K) nolink();
  else fetch("/api/alarm/client?id=" + encodeURIComponent(K)).then(function(r){ return r.json(); }).then(function(j){
    if(!j || !j.ok) return nolink(true);
    C = j.client;
    FIXED = (C.products || []).length > 0;
    if(FIXED) applyProducts(C.products); else { $("pickBox").hidden = false; applyProducts([]); }
    $("who").hidden = false;
    $("v_cust").textContent = C.name; $("v_site").textContent = C.site || "—"; $("v_since").textContent = kdate(C.since);
    $("hello").textContent = (C.mgr ? C.mgr + "님" : C.name + " 담당자님") + ", 안녕하세요. ";
    if(C.mgr) $("sg_name").value = C.mgr;
    if(C.consentDone){ $("done").hidden = false; $("p1nav").hidden = true; $("stepnav").hidden = true; }
  }).catch(function(){ nolink(true); });

  function radio(name){
    var el = document.querySelector('input[name="'+name+'"]:checked');
    return el ? el.value : "";
  }

  $("go2").addEventListener("click", function(){
    if(!FIXED){
      if(!picked().length){ $("pickErr").hidden = false; $("pickErr").textContent = "이용 중인 알리미를 하나 이상 선택해 주십시오."; return; }
      $("pickErr").hidden = true; applyProducts(picked());
    }
    show(2);
  });
  Array.prototype.forEach.call(document.querySelectorAll("#pick input"), function(c){ c.addEventListener("change", function(){ $("pickErr").hidden = true; }); });

  /* ── 단계 이동 ── */
  var PANES = ["p1","p2","p5"], maxSeen = 1;
  function show(n){
    PANES.forEach(function(id){ $(id).classList.remove("on"); });
    if(n === 5){ $("p5").classList.add("on"); $("stepnav").hidden = true; window.scrollTo(0,0); return; }
    $("stepnav").hidden = false;
    $("p"+n).classList.add("on");
    if(n > maxSeen) maxSeen = n;
    Array.prototype.forEach.call(document.querySelectorAll(".steptab"), function(b){
      var i = Number(b.dataset.go);
      b.setAttribute("aria-current", i === n ? "true" : "false");
      b.classList.toggle("done", i < maxSeen && i !== n);
    });
    if(n === 2) setTimeout(fit, 30);
    window.scrollTo(0,0);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-next]"), function(b){
    b.addEventListener("click", function(){ show(Number(b.dataset.next)); });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".steptab"), function(b){
    b.addEventListener("click", function(){
      if(!(C && !C.consentDone)) return;
      var n = Number(b.dataset.go);
      if(n >= 2 && !FIXED && !picked().length){ show(1); $("pickErr").hidden = false; $("pickErr").textContent = "이용 중인 알리미를 하나 이상 선택해 주십시오."; return; }
      show(n);
    });
  });

  /* ── SLA 팝업 ── */
  var slaViewedAt = "", slaAgreedAt = "", slaReadPct = 0, slaLastFocus = null;
  var slaModal = $("slamodal");
  function openSla(from){
    slaLastFocus = from || document.activeElement;
    slaModal.hidden = false;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    $("mbody").scrollTop = 0;
    $("mbody").focus();
    if(!slaViewedAt){
      slaViewedAt = new Date().toISOString();
      $("slaseen").hidden = false;
      $("slaseenAt").textContent = new Date(slaViewedAt).toLocaleString("ko-KR", {month:"long", day:"numeric", hour:"2-digit", minute:"2-digit"});
    }
  }
  function closeSla(){
    slaModal.hidden = true;
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    if(slaLastFocus && slaLastFocus.focus) slaLastFocus.focus();
  }
  $("openSla").addEventListener("click", function(){ openSla(this); });
  $("openSla2").addEventListener("click", function(){ openSla(this); });
  $("slaAgree").addEventListener("change", function(){ $("slaAgreeBtn").hidden = !this.checked; $("agreeAllBtn").hidden = this.checked; });
  function finishSla(){
    if(!slaAgreedAt) slaAgreedAt = new Date().toISOString();
    $("openSla2").textContent = "SLA 전문 다시 보기 ✓"; $("openSla").textContent = "전문 다시 읽기";
    closeSla();
    gate();
  }
  $("slaAgreeBtn").addEventListener("click", function(){ if($("slaAgree").checked) finishSla(); });
  /* 한 번에 확인 완료 */
  $("agreeAllBtn").addEventListener("click", function(){ $("slaAgree").checked = true; finishSla(); });
  Array.prototype.forEach.call(slaModal.querySelectorAll("[data-close]"), function(b){
    b.addEventListener("click", closeSla);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !slaModal.hidden) closeSla();
  });
  $("mbody").addEventListener("scroll", function(){
    var el = this, p = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    if(p > slaReadPct) slaReadPct = Math.min(1, p);
    $("slaprog").textContent = p > 0.98
      ? "제1조 ~ 제18조 · 부칙 전문 · 끝까지 확인함"
      : "제1조 ~ 제18조 · 부칙 전문 · " + Math.round(p * 100) + "% 읽음";
  });


  /* ── 제품별 부속서·확인 항목 표시 ── */
  var PRODUCT_LABEL = {fire:"화재경보 연동 알리미", water:"물감지 알리미", power:"정전 알리미", alarm:"경보 알리미", custom:"커스텀 알리미"};
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
  /* ── 동의 여부 ── */
  function decision(){ return radio("decision"); }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="decision"]'), function(r){
    r.addEventListener("change", function(){
      var d = decision();
      $("agreeBox").hidden = d !== "agree";
      $("submitBtn").textContent = d === "agree" ? "동의하고 제출" : "제출";
      if(d === "agree") setTimeout(fit, 30);
      gate();
    });
  });

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

  var today = new Date();
  $("sg_date").textContent = today.getFullYear() + "년 " + (today.getMonth()+1) + "월 " + today.getDate() + "일";
  $("sg_name").addEventListener("input", gate);

  function gate(){
    var d = decision(), ok = false, msg = "";
    if(d === "later") ok = true;
    else if(d === "agree"){
      if(!slaAgreedAt) msg = "SLA 전문을 열어 확인하고 동의 표시를 해 주십시오.";
      else if(!activeCks().every(function(c){ return c.checked; })) msg = "확인 항목을 모두 체크해 주십시오.";
      else if(!$("sg_name").value.trim()) msg = "서명자 성명을 입력해 주십시오.";
      else if(!hasInk) msg = "서명란에 서명해 주십시오.";
      else ok = true;
    }
    $("submitBtn").disabled = !ok;
    $("err2").hidden = !msg;
    $("err2").textContent = msg;
  }

  /* ── 제출 ── */
  function ymd(d){ var p=function(n){return String(n).padStart(2,"0");}; return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
  function refNo(){
    var d = new Date(), p = function(n){ return String(n).padStart(2,"0"); };
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = "";
    for(var i=0;i<4;i++) r += abc[Math.floor(Math.random()*abc.length)];
    return "MKS-" + d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + "-" + r;
  }

  $("submitBtn").addEventListener("click", async function(){
    var btn = this, d = decision(), agree = d === "agree";
    btn.disabled = true;
    btn.textContent = "제출 중…";
    var now = new Date();
    var body = {
      clientId: C ? C.id : "",
      decision: agree ? "agree" : "not-now",
      sla: {
        version: SLA_VERSION,
        viewedAt: slaViewedAt,
        agreedAt: agree ? slaAgreedAt : "",
        readPct: Math.round(slaReadPct * 100),
        effectiveFrom: agree ? ymd(now) : "",
        acknowledged: agree ? ackList() : [],
        products: chosenProducts()
      },
      signature: agree ? {name:$("sg_name").value.trim(), role:$("sg_role").value.trim(),
                          signedOn: ymd(now), image: cv.toDataURL("image/png")} : null
    };

    var out = null;
    try{
      var res = await fetch(API, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)});
      out = await res.json();
    }catch(err){ out = null; }
    var ok = !!(out && out.ok);

    $("d_title").textContent = agree ? "SLA 동의가 접수되었습니다" : "응답이 접수되었습니다";
    $("d_no").textContent = (ok && out.ref) ? out.ref : "미접수";
    $("d_cust").textContent = C ? C.name : "—";
    $("d_site").textContent = C && C.site || "—";
    $("d_sla").textContent = agree
      ? ("동의 · " + kdate(body.sla.effectiveFrom) + "부터 적용")
      : "동의하지 않음 · 기존 계약 조건 유지";
    $("d_signer").textContent = agree ? (body.signature.name + (body.signature.role ? " · " + body.signature.role : "")) : "—";
    $("d_when").textContent = now.toLocaleString("ko-KR");
    $("d_mail").textContent = ok ? "모넷코리아에 접수되었습니다" : "전송되지 않음";
    if(!ok){
      btn.disabled = false; btn.textContent = agree ? "동의하고 제출" : "제출";
      $("err2").hidden = false; $("err2").textContent = "전송하지 못했습니다. 잠시 후 다시 시도해 주시거나 02-2088-1454로 연락 주십시오.";
      return;
    }
    if(false){
      $("d_warn").textContent = "전송에 실패했습니다. 아래 버튼으로 이 화면을 PDF로 저장해 korea@monnit.com 으로 보내 주시거나 02-2088-1454로 연락 주십시오.";
    }
    show(5);
  });

  $("printBtn").addEventListener("click", function(){ window.print(); });
})();
