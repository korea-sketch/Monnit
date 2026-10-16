  var T = null, OFFER_ID = "";
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
    $("o_sol").textContent = T.sol;
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
      $("loading").hidden = true;
      $("offerBox").hidden = false;
    }).catch(function(){
      offerFail("계약 조건을 불러오지 못했습니다", "잠시 후 다시 시도해 주십시오. 계속 안 되면 02-2088-1454로 연락 주십시오.");
    });
  }

