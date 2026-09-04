/** 현장 진단 예약 — 공용 엔진
 *  예약 화면(/visit)과 스케줄 관리 화면(/visit/admin)이 같은 규칙을 쓰도록
 *  공휴일·슬롯 계산·설정 인코딩을 한 곳에 모았습니다.
 *  비밀값은 들어 있지 않습니다. 순수 계산 코드입니다.
 */
window.VisitCore = (function () {
  "use strict";

  var TZ = "Asia/Seoul";
  var DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

  /* 대한민국 관공서 공휴일 · 대체공휴일 (2026–2028) */
  var HOLIDAYS = {
    "2026-01-01":"새해","2026-02-16":"설날","2026-02-17":"설날","2026-02-18":"설날",
    "2026-03-01":"삼일절","2026-03-02":"대체휴일","2026-05-05":"어린이날",
    "2026-05-24":"석가탄신","2026-05-25":"대체휴일","2026-06-06":"현충일",
    "2026-07-17":"제헌절","2026-08-15":"광복절","2026-08-17":"대체휴일",
    "2026-09-24":"추석","2026-09-25":"추석","2026-09-26":"추석",
    "2026-10-03":"개천절","2026-10-05":"대체휴일","2026-10-09":"한글날","2026-12-25":"성탄절",
    "2027-01-01":"새해","2027-02-06":"설날","2027-02-07":"설날","2027-02-08":"설날",
    "2027-02-09":"대체휴일","2027-03-01":"삼일절","2027-05-05":"어린이날",
    "2027-05-13":"석가탄신","2027-06-06":"현충일","2027-06-07":"대체휴일",
    "2027-07-17":"제헌절","2027-08-15":"광복절","2027-08-16":"대체휴일",
    "2027-09-14":"추석","2027-09-15":"추석","2027-09-16":"추석",
    "2027-10-03":"개천절","2027-10-04":"대체휴일","2027-10-09":"한글날","2027-10-11":"대체휴일",
    "2027-12-25":"성탄절","2027-12-27":"대체휴일",
    "2028-01-01":"새해","2028-01-26":"설날","2028-01-27":"설날","2028-03-01":"삼일절",
    "2028-05-05":"어린이날","2028-06-06":"현충일","2028-07-17":"제헌절",
    "2028-08-15":"광복절","2028-10-02":"추석","2028-10-03":"추석","2028-10-04":"추석",
    "2028-10-09":"한글날","2028-12-25":"성탄절"
  };

  var DEFAULT_CFG = {
    v: 1,
    workdays: [1, 2, 3, 4, 5],
    dayStart: "09:30", dayEnd: "16:00",
    lunchStart: "12:00", lunchEnd: "13:00",
    mins: 60, buffer: 60, granularity: 30,
    leadHours: 72, horizonDays: 28, maxPerDay: 2,
    closed: [],   /* [{d:"YYYY-MM-DD", memo:""}] */
    blocks: []    /* [{d:"YYYY-MM-DD", s:"HH:MM", e:"HH:MM", memo:""}] */
  };

  var STORE_KEY = "monnit_visit_cfg_v1";

  /* ---------- 시간 유틸 (KST 고정) ---------- */
  var dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  var hmFmt  = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

  function keyOf(d) { return dayFmt.format(d); }
  function hmOf(d) { return hmFmt.format(d); }
  function addDays(k, n) { var d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dowOf(k) { return new Date(k + "T12:00:00Z").getUTCDay(); }
  function inst(k, hm) { return new Date(k + "T" + hm + ":00+09:00"); }
  function toMin(hm) { var p = String(hm || "0:0").split(":"); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
  function toHM(m) { var h = Math.floor(m / 60), n = m % 60; return (h < 10 ? "0" : "") + h + ":" + (n < 10 ? "0" : "") + n; }
  function labelDate(k) { var p = k.split("-"); return p[1].replace(/^0/, "") + "월 " + p[2].replace(/^0/, "") + "일 (" + DOW_KO[dowOf(k)] + ")"; }
  function ov(aS, aE, bS, bE) { return aS < bE && bS < aE; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function monthOf(k) { return k.slice(0, 7); }
  function monthShift(m, n) {
    var y = parseInt(m.slice(0, 4), 10), mo = parseInt(m.slice(5, 7), 10) - 1 + n;
    y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    var mm = mo + 1;
    return y + "-" + (mm < 10 ? "0" + mm : "" + mm);
  }
  function today() { return keyOf(new Date()); }

  /* ---------- 슬롯 엔진 ---------- */
  function closedMemo(cfg, k) {
    var f = cfg.closed.filter(function (x) { return x.d === k; })[0];
    return f ? (f.memo || "휴무") : null;
  }
  function dayStatus(cfg, k) {
    if (HOLIDAYS[k]) return { open: false, why: HOLIDAYS[k], hol: true };
    var m = closedMemo(cfg, k);
    if (m !== null) return { open: false, why: m, hol: false };
    if (cfg.workdays.indexOf(dowOf(k)) === -1) return { open: false, why: "휴무", hol: false };
    return { open: true, why: "", hol: false };
  }
  function slotsFor(cfg, k) {
    if (!dayStatus(cfg, k).open) return [];
    var out = [], open = toMin(cfg.dayStart), close = toMin(cfg.dayEnd);
    var lS = toMin(cfg.lunchStart), lE = toMin(cfg.lunchEnd);
    var step = cfg.granularity || 30, mins = cfg.mins || 60, buf = cfg.buffer || 0;
    var earliest = new Date(Date.now() + (cfg.leadHours || 0) * 3600000);
    var blocks = cfg.blocks.filter(function (b) { return b.d === k; });
    for (var m = open; m + mins <= close; m += step) {
      var s = inst(k, toHM(m));
      if (s < earliest) continue;
      if (lE > lS && ov(m, m + mins, lS, lE)) continue;
      var hit = false;
      for (var i = 0; i < blocks.length; i++) {
        if (ov(m - buf, m + mins + buf, toMin(blocks[i].s), toMin(blocks[i].e))) { hit = true; break; }
      }
      if (hit) continue;
      out.push({ iso: s.toISOString(), hm: toHM(m), end: toHM(m + mins) });
    }
    return out;
  }
  function horizonKeys(cfg) {
    var keys = [], t = today();
    for (var i = 0; i < (cfg.horizonDays || 28); i++) keys.push(addDays(t, i));
    return keys;
  }
  function inHorizon(cfg, k) {
    var t = today();
    return k >= t && k <= addDays(t, (cfg.horizonDays || 28) - 1);
  }

  /* ---------- 설정 직렬화 ---------- */
  function normalize(c) {
    var out = JSON.parse(JSON.stringify(DEFAULT_CFG));
    Object.keys(DEFAULT_CFG).forEach(function (k) { if (c[k] !== undefined) out[k] = c[k]; });
    if (!Array.isArray(out.closed)) out.closed = [];
    if (!Array.isArray(out.blocks)) out.blocks = [];
    return out;
  }
  function encodeCfg(c) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(c))))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeCfg(s) {
    try {
      var b = String(s).replace(/-/g, "+").replace(/_/g, "/");
      while (b.length % 4) b += "=";
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { return null; }
  }
  /* URL(?s=) → localStorage → 기본값 순으로 설정을 찾습니다. */
  function loadCfg() {
    try {
      var q = new URLSearchParams(location.search).get("s");
      if (q) { var c = decodeCfg(q); if (c && c.workdays) return { cfg: normalize(c), src: "link" }; }
    } catch (e) {}
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var l = JSON.parse(raw); if (l && l.workdays) return { cfg: normalize(l), src: "local" }; }
    } catch (e) {}
    return { cfg: JSON.parse(JSON.stringify(DEFAULT_CFG)), src: "default" };
  }
  function saveCfg(c) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); return true; }
    catch (e) { return false; }
  }
  function clearCfg() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  return {
    TZ: TZ, DOW_KO: DOW_KO, HOLIDAYS: HOLIDAYS, DEFAULT_CFG: DEFAULT_CFG, STORE_KEY: STORE_KEY,
    keyOf: keyOf, hmOf: hmOf, addDays: addDays, dowOf: dowOf, inst: inst,
    toMin: toMin, toHM: toHM, labelDate: labelDate, ov: ov, esc: esc,
    monthOf: monthOf, monthShift: monthShift, today: today,
    closedMemo: closedMemo, dayStatus: dayStatus, slotsFor: slotsFor,
    horizonKeys: horizonKeys, inHorizon: inHorizon,
    normalize: normalize, encodeCfg: encodeCfg, decodeCfg: decodeCfg,
    loadCfg: loadCfg, saveCfg: saveCfg, clearCfg: clearCfg
  };
})();
