/* 리소스 센터 영어 보기 (2026-11-09)
   · ?lang=en 또는 상단 「EN」 → 영어, ?lang=ko 또는 「한국어」 → 한국어. 고른 언어는 브라우저에 기억한다.
   · 화면을 다시 그릴 때마다 한국어 문구를 js/mall-en.js 사전으로 바꾼다(숫자는 # 자리에 그대로 넣는다).
   · 견적·자료 신청으로 서버에 가는 값과 담당자 메일은 한국어 그대로다. */
(function () {
  var q = new URLSearchParams(location.search), L = q.get("lang");
  try { if (L) localStorage.setItem("mnkLang", L); else L = localStorage.getItem("mnkLang"); } catch (e) {}
  var EN = L === "en"; window.MALL_LANG = EN ? "en" : "ko";
  if (!EN) return;
  document.documentElement.lang = "en";
  if (!window.MALL_EN) document.write('<script src="/js/mall-en.js?v=3"><\/script>');
  var HAN = /[가-힣]/, NUM = /\d+(?:[.,]\d+)*/g, miss = (window.__mallMiss = {});
  function rx(t) { /* 틀 문구 — 「X에 대해 궁금한 점」 등. X 는 사전에서 다시 찾는다 */
    var RX = window.MALL_EN_RX || [];
    for (var r = 0; r < RX.length; r++) { var m = t.match(RX[r][0]); if (m) { var inner = look0(m[1].trim()); return RX[r][1].replace("$1", inner != null ? inner : m[1]); } }
    return null;
  }
  function look(t) { var v = look0(t); return v != null ? v : rx(t); }
  function look0(t) {
    var D = window.MALL_EN || {}, nums = [], key = t.replace(NUM, function (m) { nums.push(m); return "#"; }), v = D[key];
    if (v == null) return null; var j = 0; return v.replace(/#/g, function () { return nums[j++] || ""; });
  }
  function tr(s) {
    var t = s.replace(/\s+/g, " ").trim(); if (!HAN.test(t)) return null;
    var v = look(t);
    if (v == null) { /* 구분자로 나눠 각각 찾기 (예: "A | B", "A · B", "A — B") */
      var seps = [" | ", " — ", " · ", " / "];
      for (var i = 0; i < seps.length && v == null; i++) {
        if (t.indexOf(seps[i]) < 0) continue;
        var parts = t.split(seps[i]), ok = true, out = parts.map(function (p) { if (!HAN.test(p)) return p; var x = look(p.trim()); if (x == null) ok = false; return x; });
        if (ok) v = out.join(seps[i]);
      }
    }
    if (v == null) { miss[t] = 1; return null; }
    return (s.match(/^\s*/)[0]) + v + (s.match(/\s*$/)[0]);
  }
  var busy = false, ATTR = ["placeholder", "aria-label", "title", "alt"];
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { var v = tr(root.nodeValue); if (v != null && v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.nodeName) || root.hasAttribute("data-noi18n") || root.id === "ppChat" || root.id === "pcLauncher") return;
    for (var a = 0; a < ATTR.length; a++) { var x = root.getAttribute(ATTR[a]); if (x && HAN.test(x)) { var y = tr(x); if (y != null) root.setAttribute(ATTR[a], y); } }
    if (root.nodeName === "TEXTAREA") return;  /* 입력 내용은 건드리지 않는다 */
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function run(muts) {
    if (busy) return; busy = true;
    try {
      if (!muts) walk(document.body);
      else for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData") walk(m.target);
        else if (m.type === "attributes") walk(m.target);
        else for (var k = 0; k < m.addedNodes.length; k++) walk(m.addedNodes[k]);
      }
      var tt = tr(document.title); if (tt != null && tt !== document.title) document.title = tt;
    } finally { busy = false; }
  }
  function start() {
    var a = document.getElementById("langEn"), b = document.getElementById("langKo"); if (a) a.hidden = true; if (b) b.hidden = false;
    run();
    new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
