
/** 알리미 계약 관리 (내부용, /contract-admin)
 *  모든 API 호출에 x-admin-key 헤더를 붙인다. 키는 이 탭(sessionStorage)에만 보관.
 */
(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var KEY = "";
  try{ KEY = sessionStorage.getItem("alarmAdminKey") || ""; }catch(e){}
  var DATA = {offers:[], contracts:[], clients:[], surveys:[]};
  var SITE = location.origin;

  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function won(n){ return "￦ " + Number(n||0).toLocaleString("ko-KR"); }
  function kdate(s){ if(!s) return "—"; var p = String(s).slice(0,10).split("-"); return p.length === 3 ? (p[0] + "." + p[1] + "." + p[2]) : s; }
  function kdt(s){ if(!s) return "—"; var d = new Date(s); return isNaN(d) ? s : d.toLocaleString("ko-KR", {year:"2-digit",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
  function ymd(d){ var p=function(n){return String(n).padStart(2,"0");}; return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
  function copy(text, btn){
    var done = function(){ if(!btn) return; var t = btn.textContent; btn.textContent = "복사됨 ✓"; setTimeout(function(){ btn.textContent = t; }, 1400); };
    if(navigator.clipboard) navigator.clipboard.writeText(text).then(done, function(){ window.prompt("복사해 주십시오", text); });
    else window.prompt("복사해 주십시오", text);
  }

  async function api(path, opt){
    opt = opt || {};
    var res = await fetch("/api/alarm/admin/" + path, {
      method: opt.body ? "POST" : "GET",
      headers: Object.assign({"x-admin-key": KEY}, opt.body ? {"content-type":"application/json"} : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
    var j = await res.json().catch(function(){ return {ok:false, error:"bad_response"}; });
    if(res.status === 401){ logout(); throw new Error("관리 키가 맞지 않습니다."); }
    if(!j.ok) throw new Error(j.error || "요청 실패");
    return j;
  }

  /* ── 로그인 ── */
  function enter(){
    $("t_login").classList.remove("on");
    $("tabs").hidden = false; $("logout").hidden = false;
    tab("new");
  }
  function logout(){
    KEY = ""; try{ sessionStorage.removeItem("alarmAdminKey"); }catch(e){}
    document.querySelectorAll(".pane").forEach(function(p){ p.classList.remove("on"); });
    $("t_login").classList.add("on"); $("tabs").hidden = true; $("logout").hidden = true;
  }
  async function tryLogin(k){
    KEY = k;
    try{ await api("ping"); try{ sessionStorage.setItem("alarmAdminKey", k); }catch(e){} enter(); }
    catch(e){ $("loginErr").hidden = false; $("loginErr").textContent = e.message; KEY = ""; }
  }
  $("loginBtn").addEventListener("click", function(){ tryLogin($("adminKey").value.trim()); });
  $("adminKey").addEventListener("keydown", function(e){ if(e.key === "Enter") tryLogin(this.value.trim()); });
  $("logout").addEventListener("click", logout);
  if(KEY) tryLogin(KEY);

  /* ── 탭 ── */
  function tab(name){
    document.querySelectorAll(".pane").forEach(function(p){ p.classList.remove("on"); });
    $("t_" + name).classList.add("on");
    document.querySelectorAll("[data-tab]").forEach(function(b){ b.setAttribute("aria-current", b.dataset.tab === name ? "true" : "false"); });
    if(name !== "new") load(name);
  }
  document.querySelectorAll("[data-tab]").forEach(function(b){ b.addEventListener("click", function(){ tab(b.dataset.tab); }); });
  document.querySelectorAll("[data-reload]").forEach(function(b){ b.addEventListener("click", function(){ load(b.dataset.reload); }); });

  /* ── 1. 계약 링크 만들기 ── */
  function calc(){
    var unit = Math.max(0, Math.round(Number($("n_unit").value) || 0));
    var qty = Math.max(1, Math.round(Number($("n_qty").value) || 1));
    var list = unit * qty, type = $("n_dtype").value, val = Math.max(0, Number($("n_dval").value) || 0), disc = 0;
    if(type === "percent"){ val = Math.min(100, val); disc = Math.round(list * val / 100); }
    if(type === "amount"){ val = Math.min(list, Math.round(val)); disc = val; }
    return {unit:unit, qty:qty, list:list, discountType:type, discountValue: type === "none" ? 0 : val, discount:disc, monthly:list - disc};
  }
  function renderPrice(){
    var t = calc(), note = $("n_dnote").value.trim();
    var rows = '<div class="row"><span>월 이용료 (1개소)</span><span class="money">' + won(t.unit) + '</span></div>' +
      '<div class="row"><span>설치 개소</span><span class="money">' + t.qty + '개소</span></div>';
    if(t.discount){
      rows += '<div class="row"><span>정가 합계</span><span class="money">' + won(t.list) + '</span></div>' +
        '<div class="row disc"><span>' + (t.discountType === "percent" ? "할인 " + t.discountValue + "%" : "할인") + (note ? " · " + esc(note) : "") +
        '</span><span class="money">− ' + won(t.discount) + '</span></div>';
    }
    rows += '<div class="row total"><span>월 청구액</span><span class="money">' + won(t.monthly) + '</span></div>';
    $("n_price").innerHTML = rows;
    $("n_vat").textContent = "부가세 별도 · 부가세 포함 " + won(Math.round(t.monthly * 1.1)) + " / 월";
  }
  function setDiscUi(){
    var t = $("n_dtype").value;
    $("n_dval").disabled = t === "none"; $("n_dnote").disabled = t === "none";
    $("n_dvalLab").textContent = t === "percent" ? "할인율 (%)" : t === "amount" ? "월 할인액 (원)" : "할인 값";
    if(t === "none") $("n_dval").value = 0;
    renderPrice();
  }
  document.querySelectorAll("[data-q]").forEach(function(b){
    b.addEventListener("click", function(){ $("n_qty").value = Math.max(1, (Number($("n_qty").value) || 1) + Number(b.dataset.q)); renderPrice(); });
  });
  ["n_unit","n_qty","n_dval","n_dnote"].forEach(function(id){ $(id).addEventListener("input", renderPrice); });
  $("n_dtype").addEventListener("change", setDiscUi);

  var etcEdited = false;
  function etcTemplate(){
    var y = Number($("n_years").value);
    var first = y ? "최초 계약은 의무계약으로 " + y + "년, 이후 1년 단위 갱신" : "의무 이용기간은 계약 기간과 같음, 이후 1년 단위 갱신";
    return [first,
      "사용자 과실로 인한 제품 분실 및 파손 시 사용자 부담",
      "매달 20일 세금계산서 발행",
      "계약 해지 시 하드웨어는 반납",
      "계약기간 만료 한 달 전까지 해지 의사를 표시하지 않으면 동일 조건으로 1년 자동 연장",
      "문자메시지·수신자 변경·문의 사항은 매뉴얼 참고 또는 02-2088-1454"].join("\n");
  }
  function setTo(){
    var y = Number($("n_years").value), f = $("n_from").value;
    if(y && f){ var d = new Date(f + "T00:00:00"); d.setFullYear(d.getFullYear() + y); d.setDate(d.getDate() - 1); $("n_to").value = ymd(d); }
    if(!etcEdited) $("n_etc").value = etcTemplate();
  }
  $("n_from").addEventListener("change", setTo);
  $("n_years").addEventListener("change", setTo);
  $("n_to").addEventListener("input", function(){ $("n_years").value = "0"; if(!etcEdited) $("n_etc").value = etcTemplate(); });
  $("n_etc").addEventListener("input", function(){ etcEdited = true; });
  function resetNew(){
    var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1);
    $("n_from").value = ymd(d); $("n_years").value = "3"; etcEdited = false; setTo();
    ["n_customer","n_contact","n_note","n_dnote","n_solnote"].forEach(function(id){ $(id).value = ""; });
    document.querySelectorAll("#n_prod input").forEach(function(c){ c.checked = false; });
    $("n_qty").value = 1; $("n_unit").value = 30000; $("n_dtype").value = "none"; setDiscUi();
    $("n_out").hidden = true; $("n_make").hidden = false; $("n_err").hidden = true;
  }
  resetNew();

  var PRODUCT_LABEL = {fire:"화재 알리미", water:"물감지 알리미", power:"정전 알리미", alarm:"경보 알리미", custom:"커스텀 알리미"};
  function prods(id){ return Array.prototype.map.call(document.querySelectorAll("#" + id + " input:checked"), function(c){ return c.value; }); }
  function solName(list, note){ var s = list.map(function(k){ return PRODUCT_LABEL[k]; }).join(" · ") || "긴급 경보 알리미 (고객이 계약 화면에서 선택)"; return note ? s + " — " + note : s; }
  var lastLink = "", lastOffer = null;
  function offerUrl(id){ return SITE + "/contract?id=" + id; }
  function offerMsg(o){
    var t = o.terms;
    return (o.memo.customer ? o.memo.customer + " 담당자님, 안녕하세요. 모넷코리아입니다.\n\n" : "안녕하세요. 모넷코리아입니다.\n\n") +
      "긴급 경보 알리미" + ((t.products || []).length ? "(" + t.products.map(function(k){ return PRODUCT_LABEL[k]; }).join(" · ") + (t.solNote ? " — " + t.solNote : "") + ")" : "") + " 구독 계약 링크를 보내 드립니다.\n" +
      "· " + t.qty + "개소 · 월 " + Number(t.monthly).toLocaleString("ko-KR") + "원 (부가세 별도)" + (t.discount ? " — 할인 적용" : "") + "\n" +
      "· 계약 기간 " + kdate(t.from) + " ~ " + kdate(t.to) + "\n\n" +
      "아래 링크에서 계약 조건과 서비스수준협약(SLA)을 확인하신 뒤 서명해 주시면 됩니다." + ((t.products || []).length ? "" : " 도입하실 알리미는 화면에서 직접 선택하시면 됩니다.") + "\n" + offerUrl(o.id) + "\n\n" +
      "궁금하신 점은 02-2088-1454로 연락 주세요. 감사합니다.";
  }
  $("n_make").addEventListener("click", async function(){
    var btn = this, t = calc();
    $("n_err").hidden = true;
    if(!t.unit){ $("n_err").hidden = false; $("n_err").textContent = "월 이용료를 입력해 주십시오."; return; }
    if(!$("n_from").value || !$("n_to").value){ $("n_err").hidden = false; $("n_err").textContent = "계약 기간을 입력해 주십시오."; return; }
    btn.disabled = true; btn.textContent = "만드는 중…";
    try{
      var j = await api("offer", {body: Object.assign({}, t, {
        products: prods("n_prod"), solNote: $("n_solnote").value.trim(), sol: solName(prods("n_prod"), $("n_solnote").value.trim()), discountNote:$("n_dnote").value.trim(),
        from:$("n_from").value, to:$("n_to").value, pay:$("n_pay").value.trim(), bank:$("n_bank").value.trim(), etc:$("n_etc").value,
        customer:$("n_customer").value.trim(), contact:$("n_contact").value.trim(), note:$("n_note").value.trim()
      })});
      lastOffer = j.offer; lastLink = offerUrl(j.offer.id);
      $("n_link").textContent = lastLink; $("n_open").href = lastLink;
      $("n_out").hidden = false; btn.hidden = true;
    }catch(e){ $("n_err").hidden = false; $("n_err").textContent = e.message; }
    btn.disabled = false; btn.textContent = "계약 링크 만들기";
  });
  $("n_copy").addEventListener("click", function(){ copy(lastLink, this); });
  $("n_copyMsg").addEventListener("click", function(){ if(lastOffer) copy(offerMsg(lastOffer), this); });
  $("n_reset").addEventListener("click", resetNew);

  /* ── 목록 불러오기 ── */
  async function load(name){
    try{
      if(name === "contracts"){
        var r = await Promise.all([api("list?type=offers"), api("list?type=contracts")]);
        DATA.offers = r[0].items; DATA.contracts = r[1].items; renderContracts();
      }else if(name === "clients"){
        DATA.clients = (await api("list?type=clients")).items; renderClients();
      }else if(name === "surveys"){
        DATA.surveys = (await api("list?type=surveys")).items; renderSurveys();
      }
    }catch(e){ alert(e.message); }
  }

  /* ── 2. 계약 현황 ── */
  var ST = {open:"서명 대기", signed:"체결 완료", void:"무효"};
  function renderContracts(){
    var f = $("c_filter").value, byRef = {};
    DATA.contracts.forEach(function(c){ byRef[c.ref] = c; });
    var rows = DATA.offers.filter(function(o){ return f === "all" || o.status === f; }).map(function(o){
      var c = o.contractRef ? byRef[o.contractRef] : null, t = o.terms;
      return '<tr data-oid="' + o.id + '"' + (c ? ' data-ref="' + c.ref + '"' : "") + '><td class="sel"><input type="checkbox" class="rowck" aria-label="선택"></td><td>' + kdt(o.createdAt) + "</td>" +
        '<td><span class="pill ' + o.status + '">' + ST[o.status] + "</span></td>" +
        "<td>" + esc(c ? c.customer.name : (o.memo.customer || "—")) + (c ? "" : '<div class="muted">' + esc(o.memo.contact || "") + "</div>") + "</td>" +
        "<td>" + esc(c ? c.customer.site : "—") + "</td>" +
        "<td>" + esc(c ? c.terms.solution : t.sol) + "</td>" +
        '<td class="num">' + t.qty + "</td>" +
        '<td class="num">' + won(t.monthly) + (t.discount ? '<div class="muted">할인 −' + Number(t.discount).toLocaleString("ko-KR") + "</div>" : "") + "</td>" +
        "<td>" + kdate(t.from) + " ~<br>" + kdate(t.to) + "</td>" +
        "<td>" + (c ? kdt(c.submittedAt) + '<div class="muted">' + esc(c.signature ? c.signature.name : "") + "</div>" : "—") + "</td>" +
        '<td style="white-space:nowrap">' +
          (c ? '<button class="btn quiet" data-c="' + c.ref + '">상세</button> <button class="btn quiet" data-pdf="' + c.ref + '">계약서 PDF</button> ' + (c.hasLicense ? '<button class="btn quiet" data-lic="' + c.ref + '">등록증</button> ' : "") : "") +
          (o.status === "open" ? '<button class="btn quiet" data-copy="' + o.id + '">링크</button> <button class="btn quiet" data-void="' + o.id + '">무효</button>' : "") +
        "</td></tr>";
    }).join("");
    $("c_table").innerHTML = "<thead><tr><th class=\"sel\"><input type=\"checkbox\" id=\"c_all\" aria-label=\"전체 선택\"></th><th>생성</th><th>상태</th><th>고객</th><th>설치 현장</th><th>솔루션</th><th>개소</th><th>월 청구액</th><th>계약 기간</th><th>체결</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="11" class="muted">항목이 없습니다.</td></tr>') + "</tbody>"; labelize("c_table"); selSync();
  }
  /* ── 선택 작업 (체크한 건 각각 내려받기 · 삭제) ── */
  function selected(){ return Array.prototype.slice.call(document.querySelectorAll("#c_table tbody .rowck:checked")).map(function(ck){ return ck.closest("tr"); }); }
  function selSync(){
    var rows = selected(), signed = rows.filter(function(tr){ return tr.dataset.ref; });
    $("c_selbar").hidden = !rows.length;
    $("c_selcount").textContent = rows.length + "건 선택" + (signed.length !== rows.length ? " (체결 " + signed.length + "건)" : "");
    $("c_selpdf").disabled = !signed.length; $("c_sellic").disabled = !signed.length;
    var all = $("c_all"); if(all){ var every = document.querySelectorAll("#c_table tbody .rowck"); all.checked = every.length > 0 && rows.length === every.length; }
  }
  $("c_table").addEventListener("change", function(e){
    if(e.target.id === "c_all"){ var v = e.target.checked; document.querySelectorAll("#c_table tbody .rowck").forEach(function(ck){ ck.checked = v; }); }
    if(e.target.classList.contains("rowck") || e.target.id === "c_all") selSync();
  });
  var pause = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  async function eachSelected(label, fn){
    var refs = selected().map(function(tr){ return tr.dataset.ref; }).filter(Boolean);
    if(!refs.length) return;
    var st = $("c_selstat"); st.hidden = false;
    for(var i = 0; i < refs.length; i++){
      st.textContent = label + " " + (i + 1) + " / " + refs.length + " — " + refs[i];
      try{ await fn(await fetchContract(refs[i])); }catch(err){ alert(refs[i] + ": " + (err.message || "실패")); }
      await pause(700);   /* 브라우저가 연속 다운로드를 막지 않도록 간격 */
    }
    st.textContent = label + " 완료 — " + refs.length + "건"; setTimeout(function(){ st.hidden = true; }, 4000);
  }
  $("c_selpdf").addEventListener("click", function(){ eachSelected("계약서 PDF", function(c){ return window.MKDoc.pdf(c); }); });
  $("c_sellic").addEventListener("click", function(){ eachSelected("사업자등록증", function(c){ return dlLicense(c.ref, c); }); });
  $("c_seldel").addEventListener("click", async function(){
    var rows = selected(); if(!rows.length) return;
    var names = rows.map(function(tr){ var td = tr.children[3]; return td ? td.textContent.trim().split("\n")[0] : tr.dataset.oid; });
    if(!confirm(rows.length + "건을 삭제할까요?\n\n" + names.slice(0, 8).join("\n") + (names.length > 8 ? "\n…" : "") + "\n\n체결된 계약은 계약서·서명·사업자등록증 기록이 함께 지워지며 되돌릴 수 없습니다. 먼데이 보드의 항목은 남습니다.")) return;
    var ids = rows.map(function(tr){ return tr.dataset.oid; });
    try{ await api("delete", {body:{type:"offers", ids: ids}}); }catch(err){ alert(err.message); }
    load("contracts");
  });
  $("c_filter").addEventListener("change", renderContracts);
  $("c_csv").addEventListener("click", function(){
    var H = ["접수번호","체결일시","고객사","사업자등록번호","대표자","주소","계약구분","담당자","연락처","이메일","설치현장","솔루션","개소","1개소 월이용료","할인","월청구액(VAT별도)","계약시작","계약종료","지급일","서명자","SLA동의","사업자등록증"];
    var q = function(v){ v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [H.join(",")].concat(DATA.contracts.map(function(c){ var t = c.terms, u = c.customer;
      return [c.ref, kdt(c.submittedAt), u.name, u.bizNo, u.ceo, u.address, u.contractType, u.manager, u.phone, u.email, u.site, t.solution, t.sites, t.unitPrice, t.discount || 0, t.monthly, t.from, t.to, t.payDay, c.signature ? c.signature.name : "", kdt(c.slaAgreedAt), c.hasLicense ? "첨부" : "없음"].map(q).join(","); }));
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "알리미_계약현황_" + ymd(new Date()) + ".csv"; a.click();
  });
  $("c_table").addEventListener("click", async function(e){
    var b = e.target.closest("button"); if(!b) return;
    if(b.dataset.copy) copy(offerUrl(b.dataset.copy), b);
    if(b.dataset.void){
      if(!confirm("이 계약 링크를 무효로 할까요? 고객이 더 이상 서명할 수 없습니다.")) return;
      try{ await api("offer/void", {body:{id:b.dataset.void}}); load("contracts"); }catch(err){ alert(err.message); }
    }
    if(b.dataset.c) showContract(b.dataset.c);
    if(b.dataset.lic){ b.disabled = true; try{ await dlLicense(b.dataset.lic); }catch(err){ alert(err.message); } b.disabled = false; }
    if(b.dataset.pdf){ await withBusy(b, async function(){ await window.MKDoc.pdf(await fetchContract(b.dataset.pdf)); }); }
  });
  async function withBusy(b, fn){ var t = b.textContent; b.disabled = true; b.textContent = "만드는 중…"; try{ await fn(); }catch(err){ alert(err.message || "실패했습니다."); } b.disabled = false; b.textContent = t; }

  /* ── 내려받기 도우미 ── */
  function safeName(v){ return String(v || "").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "고객"; }
  function saveDataUrl(dataUrl, filename){
    var a = document.createElement("a"); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }
  function extOf(dataUrl){ var m = /^data:image\/(\w+)/.exec(dataUrl || ""); return m ? (m[1] === "jpeg" ? "jpg" : m[1]) : "jpg"; }
  async function fetchContract(ref){ return (await api("item?type=contracts&id=" + encodeURIComponent(ref))).item; }
  async function dlLicense(ref, c){
    c = c || await fetchContract(ref);
    var lic = c.attachments && c.attachments.businessLicense;
    if(!lic || !lic.image){ alert("이 계약에는 사업자등록증이 첨부되지 않았습니다."); return; }
    saveDataUrl(lic.image, "사업자등록증_" + safeName(c.customer.name) + "_" + c.ref + "." + extOf(lic.image));
  }
  function contractText(c){
    var t = c.terms, u = c.customer;
    return ["[긴급 경보 알리미 구독계약] " + c.ref,
      "상호: " + u.name, "사업자등록번호: " + (u.bizNo || "-"), "대표자: " + u.ceo, "주소: " + u.address, "계약 구분: " + u.contractType,
      "담당자: " + u.manager + " / " + u.phone + " / " + u.email, "설치 현장: " + u.site,
      "납품 솔루션: " + t.solution, "개소: " + t.sites, "월 청구액: " + Number(t.monthly).toLocaleString("ko-KR") + "원 (부가세 별도)" + (t.discount ? " · 할인 " + Number(t.discount).toLocaleString("ko-KR") + "원" : ""),
      "계약 기간: " + t.from + " ~ " + t.to, "지급일: " + t.payDay, "입금 계좌: " + t.bank,
      "알림 수신자: " + (c.recipients || []).map(function(r){ return r.name + " " + r.phone; }).join(", "),
      "서명: " + c.signature.name + (c.signature.role ? " (" + c.signature.role + ")" : "") + " · " + c.signature.signedOn,
      "SLA 동의: " + kdt(c.slaAgreedAt), "접수: " + kdt(c.submittedAt),
      t.etc ? "기타: " + t.etc : ""].filter(Boolean).join("\n");
  }

  /* 모바일 카드 보기용: 머리글 텍스트를 각 칸의 data-l 로 */
  function labelize(id){
    var tb = $(id), hs = Array.prototype.map.call(tb.querySelectorAll("thead th"), function(th){ return th.textContent.trim(); });
    tb.querySelectorAll("tbody tr").forEach(function(tr){ Array.prototype.forEach.call(tr.children, function(td, i){ if(td.classList.contains("sel")) return; if(hs[i]) td.setAttribute("data-l", hs[i]); else td.classList.add("acts"); }); });
  }
  function dl(pairs){ return '<dl class="dgrid">' + pairs.map(function(p){ return "<dt>" + p[0] + "</dt><dd>" + p[1] + "</dd>"; }).join("") + "</dl>"; }
  function openD(kick, title, html){
    $("dkick").textContent = kick; $("dtitle").textContent = title; $("dbody").innerHTML = html;
    $("dmodal").hidden = false; document.body.style.overflow = "hidden"; $("dbody").scrollTop = 0;
  }
  function closeD(){ $("dmodal").hidden = true; document.body.style.overflow = ""; }
  document.querySelectorAll("[data-dclose]").forEach(function(b){ b.addEventListener("click", closeD); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && !$("dmodal").hidden) closeD(); });
  $("dprint").addEventListener("click", function(){ window.print(); });

  async function showContract(ref){
    try{
      var c = (await api("item?type=contracts&id=" + encodeURIComponent(ref))).item, t = c.terms, u = c.customer;
      var lic = c.attachments && c.attachments.businessLicense;
      CUR = c;
      openD("계약서 · " + c.ref, u.name + " · " + u.site,
        '<div class="dactions">' +
          '<button type="button" class="btn sm" data-act="pdf">계약서 PDF 내려받기</button>' +
          (lic ? '<button type="button" class="btn sm" data-act="lic">사업자등록증 내려받기</button>' : '<span class="pill void">사업자등록증 미첨부</span>') +
          '<button type="button" class="btn quiet sm" data-act="print">인쇄</button>' +
          '<button type="button" class="btn quiet sm" data-act="sig">서명 이미지</button>' +
          '<button type="button" class="btn quiet sm" data-act="copy">계약 정보 복사</button>' +
          '<a class="btn quiet sm" href="mailto:' + esc(u.email) + '" style="text-decoration:none">담당자 메일</a>' +
          (c.mondayItemId ? '<a class="btn quiet sm" target="_blank" rel="noopener" href="https://monnitk.monday.com/boards/' + esc(c.mondayBoardId || "18435756574") + '/pulses/' + esc(c.mondayItemId) + '" style="text-decoration:none">먼데이에서 열기</a>' : "") +
        '</div>' +
        "<h3>계약 조건</h3>" + dl([
          ["납품 솔루션", esc(t.solution)], ["월 이용료", won(t.unitPrice) + " × " + t.sites + "개소 = " + won(t.listPrice)],
          ["할인", t.discount ? "− " + won(t.discount) + (t.discountType === "percent" ? " (" + t.discountValue + "%)" : "") + (t.discountNote ? " · " + esc(t.discountNote) : "") : "없음"],
          ["월 청구액", "<b>" + won(t.monthly) + "</b> (부가세 별도)"], ["계약 기간", kdate(t.from) + " ~ " + kdate(t.to)],
          ["지급일", esc(t.payDay)], ["입금 계좌", esc(t.bank)], ["기타 사항", esc(t.etc).replace(/\n/g, "<br>")]]) +
        "<h3>고객</h3>" + dl([
          ["상호", esc(u.name)], ["사업자등록번호", esc(u.bizNo || "—")], ["주소", esc(u.address)], ["대표자", esc(u.ceo)],
          ["계약 구분", u.contractType], ["담당자", esc(u.manager) + " · " + esc(u.phone) + " · " + esc(u.email)], ["설치 현장", esc(u.site)]]) +
        "<h3>알림 수신자</h3>" + dl(c.recipients.map(function(r, i){ return ["수신자 " + (i+1), esc(r.name) + " · " + esc(r.phone) + (r.email ? " · " + esc(r.email) : "")]; })) +
        "<h3>SLA 동의 기록</h3>" + dl([
          ["SLA 버전", esc(c.slaVersion)], ["전문 열람", kdt(c.slaViewedAt) + " · " + c.slaReadPct + "% 읽음"], ["동의", kdt(c.slaAgreedAt)],
          ["확인 항목", esc((c.acknowledged || []).join(" / "))], ["접수", kdt(c.submittedAt) + " · IP " + esc(c.client && c.client.ip)]]) +
        "<h3>서명</h3>" + dl([["서명자", esc(c.signature.name) + (c.signature.role ? " · " + esc(c.signature.role) : "") + " · " + kdate(c.signature.signedOn)]]) +
        '<img class="dimg" alt="서명" src="' + c.signature.image + '" style="max-width:420px">' +
        (lic ? "<h3>사업자등록증</h3>" + '<img class="dimg" alt="사업자등록증" src="' + lic.image + '">' : ""));
    }catch(e){ alert(e.message); }
  }
  var CUR = null;
  $("dbody").addEventListener("click", function(e){
    var b = e.target.closest("[data-act]"); if(!b || !CUR) return;
    var c = CUR;
    if(b.dataset.act === "lic") dlLicense(c.ref, c);
    if(b.dataset.act === "sig") saveDataUrl(c.signature.image, "서명_" + safeName(c.customer.name) + "_" + c.ref + "." + extOf(c.signature.image));
    if(b.dataset.act === "copy") copy(contractText(c), b);
    if(b.dataset.act === "print") window.MKDoc.print(c);
    if(b.dataset.act === "pdf") withBusy(b, function(){ return window.MKDoc.pdf(c); });
  });

  /* ── 3. 기존 고객 ── */
  function clientLinks(c){ return {survey: SITE + "/survey?k=" + c.id, sla: SITE + "/sla-consent?k=" + c.id}; }
  function clientMail(c){
    var L = clientLinks(c), who = c.mgr ? c.mgr + "님" : c.name + " 담당자님";
    var months = "";
    if(c.since){ var s = new Date(c.since), n = new Date(); var m = (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth(); if(m > 0) months = " 설치한 지 어느덧 " + m + "개월이 됐습니다."; }
    return "제목: [모넷코리아] " + who + ", 긴급 경보 알리미 이용 의견과 SLA 확인 부탁드립니다\n\n" +
      who + ", 안녕하세요. 모넷코리아입니다.\n" +
      (c.site ? c.site + "에" : "") + " 긴급 경보 알리미를" + (months || " 이용해 주셔서 감사합니다.") + "\n" +
      "그동안 써 보시면서 느끼신 점을 듣고 싶어 연락드렸습니다.\n\n" +
      "1. 만족도 조사 (약 2분)\n   별점과 짧은 의견을 남겨 주시면 서비스 개선에 반영하겠습니다.\n   ▶ " + L.survey + "\n\n" +
      "2. 서비스수준협약(SLA) 확인 및 동의 요청\n   서비스 범위와 책임 기준을 정리한 SLA입니다.\n" +
      "   · 알림 발송까지가 서비스 범위이며, 상시 관제·현장 출동·기관 신고는 포함되지 않습니다.\n" +
      "   · 법정 안전설비를 대신하지 않으며, 센서 특성상 오탐·미탐이 생길 수 있습니다.\n" +
      "   · 회사 배상 한도는 직전 12개월간 지급한 이용료 총액입니다. (고의·중과실 제외)\n" +
      "   · 월 1회 테스트 알림 점검, 배터리 알림 후 14일 안에 교체, 수신자 정보 최신 유지를 부탁드립니다.\n" +
      "   동의해 주셔야 적용되며, 동의하지 않으셔도 서비스는 기존 계약 조건대로 제공됩니다." + ((c.products || []).length ? "" : " 이용 중인 알리미는 화면에서 선택하시면 됩니다.") + "\n   SLA 전문 PDF: " + SITE + ((c.products || []).length === 1 ? "/alarm/sla-" + c.products[0] + ".pdf" : "/alarm/sla.pdf") + "\n   ▶ " + L.sla + "\n\n" +
      "궁금하신 점은 이 메일에 회신하시거나 02-2088-1454로 연락 주세요.\n\n감사합니다.\n주식회사 모넷코리아\n02-2088-1454 · korea@monnit.com";
  }
  $("k_make").addEventListener("click", async function(){
    var btn = this; $("k_err").hidden = true;
    if(!$("k_name").value.trim()){ $("k_err").hidden = false; $("k_err").textContent = "고객사를 입력해 주십시오."; return; }
    btn.disabled = true;
    try{
      var j = await api("client", {body:{name:$("k_name").value, site:$("k_site").value, mgr:$("k_mgr").value, email:$("k_email").value,
        since:$("k_since").value, ref:$("k_ref").value, type:$("k_type").value, products: prods("k_prod")}});
      document.querySelectorAll("#k_prod input").forEach(function(c){ c.checked = false; });
      try{ var mv0 = (await api("client/mail?id=" + encodeURIComponent(j.client.id))).mail; $("k_mail").value = "제목: " + mv0.subject + "\n\n" + mv0.text; }catch(e2){ $("k_mail").value = clientMail(j.client); }
      $("k_out").hidden = false;
      ["k_name","k_site","k_mgr","k_email","k_since","k_ref"].forEach(function(id){ $(id).value = ""; });
      load("clients");
    }catch(e){ $("k_err").hidden = false; $("k_err").textContent = e.message; }
    btn.disabled = false;
  });
  $("k_copy").addEventListener("click", function(){ copy($("k_mail").value, this); });
  function renderClients(){
    var rows = DATA.clients.map(function(c){
      var sla = c.consentDecision === "agree" ? '<span class="pill agree">동의 ' + kdate(c.consentAt) + "</span>"
        : c.consentDecision === "not-now" ? '<span class="pill not-now">미동의</span>'
        : '<span class="muted">미응답</span>';
      var mail = c.mailedAt ? '<span class="pill agree">발송 ' + kdate(c.mailedAt) + (c.mailCount > 1 ? " ×" + c.mailCount : "") + "</span>" : '<span class="muted">미발송</span>';
      return "<tr><td>" + kdt(c.createdAt) + "</td><td>" + esc(c.name) + '<div class="muted">' + esc(c.mgr || "") + " " + esc(c.email || "") + (c.products && c.products.length ? " · " + c.products.map(function(k){ return PRODUCT_LABEL[k] || k; }).join("·") : "") + "</div></td>" +
        "<td>" + esc(c.site || "—") + "</td><td>" + kdate(c.since) + "</td>" +
        "<td>" + mail + "</td>" +
        "<td>" + (c.surveyAt ? '<span class="pill agree">완료 ' + kdate(c.surveyAt) + "</span>" : '<span class="muted">미응답</span>') + "</td>" +
        "<td>" + sla + "</td>" +
        '<td style="white-space:nowrap"><button class="btn quiet" data-send="' + c.id + '" data-kname="' + esc(c.name) + '" data-kmail="' + esc(c.email || "") + '">' + (c.mailedAt ? "다시 보내기" : "안내 메일 보내기") + '</button> ' +
        '<button class="btn quiet" data-prev="' + c.id + '">미리보기</button> <button class="btn quiet" data-mail="' + c.id + '">문구</button> ' +
        (c.consentRef ? '<button class="btn quiet" data-consent="' + c.consentRef + '">동의서</button> ' : "") +
        '<button class="btn quiet danger" data-kdel="' + c.id + '" data-kname="' + esc(c.name) + '">삭제</button></td></tr>';
    }).join("");
    $("k_table").innerHTML = "<thead><tr><th>등록</th><th>고객</th><th>설치 현장</th><th>이용 시작</th><th>안내 메일</th><th>설문</th><th>SLA</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="8" class="muted">등록된 고객이 없습니다.</td></tr>') + "</tbody>"; labelize("k_table");
    var unsent = DATA.clients.filter(function(c){ return !c.mailedAt && c.email; });
    $("k_sendall").hidden = !unsent.length; $("k_sendall").textContent = "미발송 " + unsent.length + "명에게 안내 메일 보내기";
  }
  async function sendMails(ids, btn){
    var t = btn.textContent; btn.disabled = true; btn.textContent = "보내는 중…";
    try{
      var r = await api("client/mail", {body:{ids: ids}});
      var bad = (r.results || []).filter(function(x){ return !x.ok; });
      if(bad.length) alert("보내지 못한 건:\n" + bad.map(function(x){ return (x.name || x.id) + " — " + x.error; }).join("\n"));
      else alert((r.results || []).length + "건 발송했습니다.");
    }catch(err){ alert(err.message); }
    btn.disabled = false; btn.textContent = t; load("clients");
  }
  $("k_sendall").addEventListener("click", function(){
    var ids = DATA.clients.filter(function(c){ return !c.mailedAt && c.email; }).map(function(c){ return c.id; });
    if(!ids.length) return;
    if(!confirm(ids.length + "명에게 SLA 안내 메일을 보낼까요? 각 고객의 동의 링크·설문 링크가 들어갑니다.")) return;
    sendMails(ids, this);
  });
  $("k_table").addEventListener("click", async function(e){
    var b = e.target.closest("button"); if(!b) return;
    if(b.dataset.send){
      if(!b.dataset.kmail){ alert("이 고객은 이메일이 등록되어 있지 않습니다. 「문구」를 복사해 직접 보내 주십시오."); return; }
      if(!confirm("「" + b.dataset.kname + "」 (" + b.dataset.kmail + ") 에게 SLA 안내 메일을 보낼까요?")) return;
      sendMails([b.dataset.send], b); return;
    }
    if(b.dataset.prev){
      try{
        var pv = (await api("client/mail?id=" + encodeURIComponent(b.dataset.prev))).mail;
        var w = window.open("", "_blank"); if(!w){ alert("팝업이 차단되었습니다."); return; }
        w.document.write("<!doctype html><title>" + esc(pv.subject) + "</title><div style='font:13px sans-serif;padding:10px 16px;background:#eee;border-bottom:1px solid #ccc'><b>제목:</b> " + esc(pv.subject) + "</div>" + pv.html); w.document.close();
      }catch(err){ alert(err.message); }
      return;
    }
    if(b.dataset.kdel){
      if(!confirm("「" + b.dataset.kname + "」 고객을 삭제할까요?\n설문 응답과 SLA 동의 기록도 함께 지워지며 되돌릴 수 없습니다.")) return;
      try{ await api("delete", {body:{type:"clients", ids:[b.dataset.kdel]}}); }catch(err){ alert(err.message); }
      load("clients"); load("surveys"); return;
    }
    if(b.dataset.mail){
      try{
        var mv = (await api("client/mail?id=" + encodeURIComponent(b.dataset.mail))).mail;
        $("k_mail").value = "제목: " + mv.subject + "\n\n" + mv.text; $("k_out").hidden = false; $("k_out").scrollIntoView({behavior:"smooth"});
      }catch(err){ alert(err.message); }
    }
    if(b.dataset.consent){
      try{
        var x = (await api("item?type=consents&id=" + encodeURIComponent(b.dataset.consent))).item;
        openD("SLA 동의서 · " + x.ref, x.company + (x.site ? " · " + x.site : ""),
          dl([["결정", x.decision === "agree" ? "동의" : "동의하지 않음 (기존 계약 유지)"], ["SLA 버전", esc(x.sla.version)],
              ["적용 시작일", kdate(x.sla.effectiveFrom)], ["전문 열람", kdt(x.sla.viewedAt) + " · " + x.sla.readPct + "% 읽음"],
              ["동의 시각", kdt(x.sla.agreedAt)], ["확인 항목", esc((x.sla.acknowledged || []).join(" / "))],
              ["접수", kdt(x.createdAt) + " · IP " + esc(x.client && x.client.ip)]]) +
          (x.signature ? "<h3>서명</h3>" + dl([["서명자", esc(x.signature.name) + (x.signature.role ? " · " + esc(x.signature.role) : "")]]) +
            '<img class="dimg" alt="서명" src="' + x.signature.image + '" style="max-width:420px">' : ""));
      }catch(err){ alert(err.message); }
    }
  });

  /* ── 4. 설문 응답 ── */
  var RK = [["overall","전반"],["accuracy","정확도"],["speed","속도"],["install","설치"],["support","응대"]];
  function stars(n){ return '<span class="stars-s">' + "★★★★★".slice(0, n) + '<span style="color:var(--rule-strong)">' + "★★★★★".slice(n) + "</span></span>"; }
  function renderSurveys(){
    var S = DATA.surveys, n = S.length;
    var avg = function(k){ return n ? (S.reduce(function(a, s){ return a + s.ratings[k]; }, 0) / n).toFixed(1) : "—"; };
    $("s_kpis").innerHTML = '<div class="kpi"><b>' + n + "</b><span>응답 수</span></div>" +
      '<div class="kpi"><b>' + (n ? (S.reduce(function(a, s){ return a + s.avg; }, 0) / n).toFixed(1) : "—") + "</b><span>평균 별점</span></div>" +
      RK.map(function(r){ return '<div class="kpi"><b>' + avg(r[0]) + "</b><span>" + r[1] + "</span></div>"; }).join("");
    var rows = S.map(function(s){
      return "<tr><td>" + kdt(s.createdAt) + "</td><td>" + esc(s.company) + '<div class="muted">' + esc(s.respondent || "") + "</div></td>" +
        '<td class="num">' + s.avg + "</td>" + RK.map(function(r){ return "<td>" + stars(s.ratings[r[0]]) + "</td>"; }).join("") +
        "<td>" + esc(s.opinion) + "</td><td>" + esc(s.improve || "") + "</td><td>" + esc(s.recipientChange || "") + "</td>" +
        '<td style="white-space:nowrap"><button class="btn quiet danger" data-sdel="' + s.id + '">삭제</button></td></tr>';
    }).join("");
    $("s_table").innerHTML = "<thead><tr><th>응답</th><th>고객</th><th>평균</th>" + RK.map(function(r){ return "<th>" + r[1] + "</th>"; }).join("") +
      "<th>의견</th><th>개선 요청</th><th>수신자 변경</th><th></th></tr></thead><tbody>" + (rows || '<tr><td colspan="12" class="muted">응답이 없습니다.</td></tr>') + "</tbody>"; labelize("s_table");
  }
  $("s_table").addEventListener("click", async function(e){
    var b = e.target.closest("button[data-sdel]"); if(!b) return;
    if(!confirm("이 설문 응답을 삭제할까요? 되돌릴 수 없습니다.")) return;
    try{ await api("delete", {body:{type:"surveys", ids:[b.dataset.sdel]}}); }catch(err){ alert(err.message); }
    load("surveys"); load("clients");
  });
  $("s_csv").addEventListener("click", function(){
    var head = ["응답일시","고객","현장","응답자","평균"].concat(RK.map(function(r){ return r[1]; })).concat(["실제 대응 경험","의견","개선 요청","수신자 변경"]);
    var q = function(v){ return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var lines = [head.map(q).join(",")].concat(DATA.surveys.map(function(s){
      return [s.createdAt, s.company, s.site, s.respondent, s.avg].concat(RK.map(function(r){ return s.ratings[r[0]]; }))
        .concat([s.used, s.opinion, s.improve, s.recipientChange]).map(q).join(",");
    }));
    var blob = new Blob(["﻿" + lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "알리미_만족도조사_" + ymd(new Date()) + ".csv"; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
})();
