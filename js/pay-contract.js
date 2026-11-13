/* 알리미 계약 화면(/contract) 4단계 — 「결제 등록」 상자 (2026-11-03)
   계약서가 발급되면 4단계 내려받기 버튼 아래에 결제 등록(카드 자동결제 · 세금계산서) 바로가기를 붙인다.
   계약 화면 원본(tools/alarm/parts)을 건드리지 않도록 별도 파일로 둔다 — contract.html 맨 아래 <script> 한 줄로 불러옴. */
(function () {
  var id = new URLSearchParams(location.search).get("id");
  if (!id) return;
  var done = false;
  function won(n) { return Number(n || 0).toLocaleString("ko-KR") + "원"; }
  function mount() {
    if (done) return;
    var p4 = document.getElementById("p4"), row = p4 && p4.querySelector(".dlrow");
    if (!row || p4.offsetParent === null) return;
    done = true;
    fetch("/api/billing/quote?offer=" + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (q) {
      if (!q || !q.ok) { done = false; return; }
      var box = document.createElement("div");
      box.id = "payBox";
      box.style.cssText = "margin:26px 0 4px;padding:20px 22px;border-radius:16px;background:#f5f5f7;border:1px solid #e8e8ed;display:flex;gap:16px;align-items:center;flex-wrap:wrap";
      var reg = q.existing;
      box.innerHTML =
        '<div style="flex:1 1 280px;min-width:0">' +
        '<b style="display:block;font-size:17px;color:#1d1d1f">' + (reg ? "결제 등록이 완료되었습니다" : "결제도 미리 등록해 두세요") + "</b>" +
        '<span style="display:block;font-size:14px;color:#6e6e73;margin-top:4px;line-height:1.5">' +
        (reg ? "구독번호 " + reg.id + " · 결제 내역과 카드는 구독 관리에서 확인하실 수 있습니다."
             : "카드 자동결제(매월 " + won(q.plan.total) + ", 부가세 포함) 또는 세금계산서 방식을 선택할 수 있습니다. 설치가 끝나는 날 첫 결제가 진행됩니다.") +
        "</span></div>" +
        '<a href="' + (reg ? "/account?sub=" + encodeURIComponent(reg.id) : "/pay?offer=" + encodeURIComponent(id)) + '" style="display:inline-flex;align-items:center;height:46px;padding:0 24px;border-radius:980px;background:#1d1d1f;color:#fff;font-weight:600;font-size:15px;text-decoration:none;white-space:nowrap">' +
        (reg ? "구독 관리" : "결제 등록하기") + "</a>";
      var hint = document.getElementById("pdfMsg");
      (hint || row).insertAdjacentElement("afterend", box);
    }).catch(function () { done = false; });
  }
  var t = setInterval(function () { mount(); if (done) clearInterval(t); }, 700);
  document.addEventListener("click", function () { setTimeout(mount, 300); }, true);
})();
