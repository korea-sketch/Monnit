
/** 긴급 경보 알리미 만족도 조사 (/survey?k=고객ID)
 *  별점 5문항 필수, 의견 5자 이상 필수. 제출 POST /api/alarm/survey
 */
(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var Q = [["overall","전반적인 서비스 만족도"],["accuracy","알림의 정확도 (오탐·미탐)"],["speed","알림이 오는 속도"],
           ["install","설치 과정과 설치 품질"],["support","문의·장애 응대"]];
  var LABEL = ["", "매우 불만", "불만", "보통", "만족", "매우 만족"];
  var R = {}, CLIENT = null, MIN = 5;

  $("ratings").innerHTML = Q.map(function(q){
    var b = "";
    for(var i=1;i<=5;i++) b += '<button type="button" role="radio" aria-checked="false" aria-label="' + i + '점 ' + LABEL[i] + '" data-k="' + q[0] + '" data-v="' + i + '">★</button>';
    return '<div class="qrow" id="row_' + q[0] + '"><p class="qlab">' + q[1] + '</p><div class="stars" role="radiogroup" aria-label="' + q[1] + '">' + b + '<span class="sv" id="sv_' + q[0] + '"></span></div></div>';
  }).join("");
  function paint(k, v){
    document.querySelectorAll('[data-k="' + k + '"]').forEach(function(b){
      var n = Number(b.dataset.v); b.classList.toggle("on", n <= v); b.setAttribute("aria-checked", n === v ? "true" : "false");
    });
    $("sv_" + k).textContent = v ? LABEL[v] : "";
  }
  $("ratings").addEventListener("click", function(e){
    var b = e.target.closest("button[data-k]"); if(!b) return;
    R[b.dataset.k] = Number(b.dataset.v); paint(b.dataset.k, R[b.dataset.k]);
    $("row_" + b.dataset.k).classList.remove("miss");
  });
  $("ratings").addEventListener("mouseover", function(e){
    var b = e.target.closest("button[data-k]"); if(b) paint(b.dataset.k, Number(b.dataset.v));
  });
  $("ratings").addEventListener("mouseout", function(e){
    var b = e.target.closest("button[data-k]"); if(b) paint(b.dataset.k, R[b.dataset.k] || 0);
  });

  function len(s){ return s.replace(/\s/g, "").length; }
  $("s_opinion").addEventListener("input", function(){
    var n = len(this.value), c = $("c_opinion");
    c.textContent = n + "자" + (n < MIN ? " / 최소 " + MIN + "자" : " ✓");
    c.classList.toggle("bad", n > 0 && n < MIN);
  });

  /* ── 고객 정보 ── */
  var k = new URLSearchParams(location.search).get("k") || "";
  function anon(){ $("anon").hidden = false; }
  if(k){
    fetch("/api/alarm/client?id=" + encodeURIComponent(k)).then(function(r){ return r.json(); }).then(function(j){
      if(!j || !j.ok) return anon();
      CLIENT = j.client;
      $("who").hidden = false;
      $("v_cust").textContent = CLIENT.name; $("v_site").textContent = CLIENT.site || "—";
      $("hello").textContent = (CLIENT.mgr ? CLIENT.mgr + "님" : CLIENT.name + " 담당자님") + ", 안녕하세요.";
      if(CLIENT.mgr) $("s_name").value = CLIENT.mgr;
      if(CLIENT.surveyDone) $("again").hidden = false;
    }).catch(anon);
  }else anon();

  /* ── 제출 ── */
  function fail(msg, focus){ $("err").hidden = false; $("err").textContent = msg; if(focus) focus.scrollIntoView({behavior:"smooth", block:"center"}); }
  $("submitBtn").addEventListener("click", async function(){
    $("err").hidden = true;
    var miss = Q.filter(function(q){ return !R[q[0]]; });
    miss.forEach(function(q){ $("row_" + q[0]).classList.add("miss"); });
    if(miss.length) return fail("별점을 모두 선택해 주십시오 — " + miss.map(function(q){ return q[1]; }).join(", "), $("row_" + miss[0][0]));
    if(len($("s_opinion").value) < MIN) return fail("느끼신 점을 " + MIN + "자 이상 적어 주십시오.", $("s_opinion"));
    if(!CLIENT && !$("s_company").value.trim()) return fail("회사 / 시설명을 입력해 주십시오.", $("s_company"));

    var btn = this; btn.disabled = true; btn.textContent = "제출 중…";
    var used = document.querySelector('input[name="used"]:checked');
    var body = {
      clientId: CLIENT ? CLIENT.id : "", company: $("s_company").value.trim(), site: $("s_site").value.trim(),
      respondent: $("s_name").value.trim(), ratings: R, used: used ? used.value : "",
      opinion: $("s_opinion").value.trim(), improve: $("s_improve").value.trim(), recipientChange: $("s_recv").value.trim()
    };
    var out = null;
    try{
      var res = await fetch("/api/alarm/survey", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)});
      out = await res.json();
    }catch(e){ out = null; }
    if(!out || !out.ok){
      btn.disabled = false; btn.textContent = "제출하기";
      return fail("전송하지 못했습니다. 잠시 후 다시 시도해 주시거나 02-2088-1454로 연락 주십시오.");
    }
    $("d_no").textContent = out.ref;
    $("p0").classList.remove("on"); $("p5").classList.add("on"); window.scrollTo(0, 0);
  });
})();
