/** 모넷코리아 — 이메일 · 전화번호 검사 (브라우저용)
 *
 *  왜 필요한가
 *    자료 다운로드 폼이 이메일을 `includes('@')` 하나로만 봤다.
 *    `a@a`, `test@test.com`, `1@1.1` 이 전부 통과했고, 전화번호는 검사가 없었다.
 *    받아 갈 자료는 그대로 나가는데 연락은 닿지 않는 접수가 쌓였다.
 *
 *  같은 규칙이 서버(netlify/functions/_valid.js)에도 있다.
 *  브라우저 검사는 안내용이고, 실제로 막는 곳은 서버다. 둘을 같이 고쳐야 한다.
 *
 *  쓰는 법
 *    var r = MonnitValid.email('a@a');
 *    r.ok        → false
 *    r.message   → '이메일 주소를 다시 확인해 주세요'
 *    r.suggest   → 오타로 보이면 고친 주소 (예: gmail.con → gmail.com)
 *    var p = MonnitValid.phone('01012345678');
 *    p.ok, p.value('010-1234-5678'), p.message
 */
(function (root) {
  "use strict";

  /* ── 일회용 메일 주소 ─────────────────────────────────────────
     받는 사람이 10분 뒤 사라지는 주소들. 자료만 받고 연락은 닿지 않는다. */
  var DISPOSABLE = [
    "mailinator.com", "10minutemail.com", "guerrillamail.com", "guerrillamail.net",
    "sharklasers.com", "grr.la", "yopmail.com", "yopmail.fr", "tempmail.com",
    "temp-mail.org", "tempmail.net", "throwawaymail.com", "trashmail.com",
    "trashmail.de", "maildrop.cc", "getnada.com", "nada.email", "moakt.com",
    "dispostable.com", "fakeinbox.com", "mailnesia.com", "emailondeck.com",
    "mytemp.email", "1secmail.com", "1secmail.org", "mohmal.com", "spambog.com",
    "mailcatch.com", "inboxbear.com", "tempr.email", "discard.email",
    "burnermail.io", "anonaddy.me", "mail-temporaire.fr", "dropmail.me",
    "minuteinbox.com", "tempmailo.com", "byom.de", "einrot.com", "cuvox.de",
    "armyspy.com", "dayrep.com", "jourrapide.com", "rhyta.com", "teleworm.us",
    "superrito.com", "gustr.com", "fleckens.hu"
  ];

  /* ── 예약된 예시 도메인 ─────────────────────────────────────── */
  var RESERVED = ["example.com", "example.net", "example.org", "example.edu",
                  "test.com", "test.net", "domain.com", "yourdomain.com",
                  "email.co", "mail.com.com", "localhost"];
  var BAD_TLD = ["test", "invalid", "example", "localhost", "local"];

  /* ── 장난으로 넣는 아이디 ───────────────────────────────────── */
  var JUNK_LOCAL = [
    "test", "tests", "testing", "test1", "test123", "tester",
    "asdf", "asd", "asdfasdf", "qwer", "qwert", "qwerty", "zxcv",
    "abc", "abcd", "abcde", "1234", "12345", "123456", "1234567", "111", "1111",
    "none", "null", "nul", "na", "n/a", "no", "nono", "nothing",
    "dummy", "sample", "example", "fake", "temp", "tmp", "trash",
    "aaa", "bbb", "ccc", "xxx", "yyy", "zzz", "ㅁㄴㅇㄹ", "ㅋㅋㅋ"
  ];

  /* ── 흔한 도메인 오타 ───────────────────────────────────────── */
  var TYPO = {
    "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com",
    "gmail.om": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com",
    "gmail.comm": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com",
    "naver.co": "naver.com", "naver.con": "naver.com", "naver.cm": "naver.com",
    "nave.com": "naver.com", "navr.com": "naver.com", "naver.som": "naver.com",
    "daum.ne": "daum.net", "daum.nat": "daum.net", "daun.net": "daum.net",
    "hanmail.ne": "hanmail.net", "hanmial.net": "hanmail.net",
    "nate.co": "nate.com", "nate.con": "nate.com",
    "hotmail.co": "hotmail.com", "hotmial.com": "hotmail.com",
    "outlook.co": "outlook.com", "outlok.com": "outlook.com",
    "yahoo.co": "yahoo.com", "yaho.com": "yahoo.com",
    "kakao.co": "kakao.com", "icloud.co": "icloud.com"
  };

  /* 같은 글자 반복 또는 연속된 숫자인지 — 1111, 123456, 987654 */
  function runOrSeq(s) {
    if (!s || s.length < 4) return false;
    if (/^(.)\1+$/.test(s)) return true;
    var up = true, down = true;
    for (var i = 1; i < s.length; i++) {
      var d = s.charCodeAt(i) - s.charCodeAt(i - 1);
      if (d !== 1) up = false;
      if (d !== -1) down = false;
    }
    return up || down;
  }

  /* ══════════════════ 이메일 ══════════════════ */
  function email(raw) {
    var v = String(raw == null ? "" : raw).trim();
    if (!v) return { ok: false, reason: "empty", message: "이메일을 입력해 주세요" };

    /* 공백이 섞여 들어오는 경우가 잦다 (복사·붙여넣기) */
    v = v.replace(/\s+/g, "");
    if (v.length > 254) return { ok: false, reason: "long", message: "이메일 주소가 너무 깁니다" };

    var at = v.lastIndexOf("@");
    if (at < 1 || at === v.length - 1) {
      return { ok: false, reason: "shape", message: "이메일 주소를 다시 확인해 주세요" };
    }
    var local = v.slice(0, at);
    var domain = v.slice(at + 1).toLowerCase();
    var value = local + "@" + domain;

    if (local.length > 64) return { ok: false, reason: "long", message: "이메일 주소가 너무 깁니다" };
    if (!/^[A-Za-z0-9._%+\-']+$/.test(local) || /^[.]|[.]$|\.\./.test(local)) {
      return { ok: false, reason: "shape", message: "이메일 주소를 다시 확인해 주세요" };
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      return { ok: false, reason: "shape", message: "이메일 주소를 다시 확인해 주세요" };
    }

    var labels = domain.split(".");
    var tld = labels[labels.length - 1];
    if (!/^[a-z]{2,24}$/.test(tld) || BAD_TLD.indexOf(tld) >= 0) {
      return { ok: false, reason: "tld", message: "이메일 주소를 다시 확인해 주세요" };
    }

    if (TYPO[domain]) {
      return {
        ok: false, reason: "typo", suggest: local + "@" + TYPO[domain],
        message: local + "@" + TYPO[domain] + " 을(를) 쓰신 것이 맞습니까?"
      };
    }
    if (RESERVED.indexOf(domain) >= 0) {
      return { ok: false, reason: "reserved", message: "실제로 쓰시는 이메일 주소를 입력해 주세요" };
    }
    if (DISPOSABLE.indexOf(domain) >= 0) {
      return { ok: false, reason: "disposable", message: "일회용 메일 주소로는 접수할 수 없습니다. 회사 메일을 입력해 주세요" };
    }

    var lo = local.toLowerCase();
    if (lo.length < 2 || JUNK_LOCAL.indexOf(lo) >= 0 || runOrSeq(lo)) {
      return { ok: false, reason: "junk", message: "실제로 쓰시는 이메일 주소를 입력해 주세요" };
    }

    return { ok: true, value: value };
  }

  /* ══════════════════ 전화번호 (대한민국) ══════════════════ */
  function phone(raw, opts) {
    var required = !opts || opts.required !== false;
    var s = String(raw == null ? "" : raw).trim();
    if (!s) {
      return required
        ? { ok: false, reason: "empty", message: "연락처를 입력해 주세요" }
        : { ok: true, value: "" };
    }

    var d = s.replace(/[^\d+]/g, "");
    d = d.replace(/^\+?82-?/, "0").replace(/\D/g, "");   /* +82 10 … → 010 … */
    if (d.length && d[0] !== "0" && /^1[0-9]{9}$/.test(d)) d = "0" + d;  /* 앞 0 빠뜨림 */

    if (/[A-Za-z가-힣]/.test(s) && d.length < 8) {
      return { ok: false, reason: "shape", message: "숫자로 입력해 주세요 (예: 010-1234-5678)" };
    }
    if (d.length < 8) return { ok: false, reason: "short", message: "연락처 자리수가 모자랍니다" };
    if (d.length > 12) return { ok: false, reason: "long", message: "연락처를 다시 확인해 주세요" };

    var mobile = /^01[016789](\d{3,4})(\d{4})$/.exec(d);
    var seoul  = /^02(\d{3,4})(\d{4})$/.exec(d);
    var area   = /^(0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4]))(\d{3,4})(\d{4})$/.exec(d);
    var net    = /^(070|080)(\d{3,4})(\d{4})$/.exec(d);
    var v050   = /^(050\d)(\d{3,4})(\d{4})$/.exec(d);
    var rep    = /^(1[5-9]\d{2})(\d{4})$/.exec(d);       /* 1588-1234 대표번호 */

    var parts = null;
    if (mobile) parts = [d.slice(0, 3), mobile[1], mobile[2]];
    else if (seoul) parts = ["02", seoul[1], seoul[2]];
    else if (area) parts = [area[1], area[2], area[3]];
    else if (net) parts = [net[1], net[2], net[3]];
    else if (v050) parts = [v050[1], v050[2], v050[3]];
    else if (rep) parts = [rep[1], rep[2]];
    if (!parts) {
      return { ok: false, reason: "shape", message: "연락처 형식을 확인해 주세요 (예: 010-1234-5678)" };
    }

    /* 자리만 채운 번호를 막는다.
       주의 — "연속된 숫자"를 통째로 막으면 031-123-4567 같은 실제 번호까지 걸린다.
       그래서 같은 숫자 반복과, 양식 예시로 굳어진 번호만 막는다. */
    var tail = parts.slice(1).join("");
    var FILLER = ["01012345678", "01000000000", "01011111111", "01099999999",
                  "01000000000", "0212345678", "0211112222"];
    if (/^(\d)\1+$/.test(tail) || /^(\d)\1+$/.test(d) || FILLER.indexOf(d) >= 0) {
      return { ok: false, reason: "junk", message: "연락 가능한 번호를 입력해 주세요" };
    }

    return { ok: true, value: parts.join("-"), digits: d };
  }

  /* 입력하는 동안 보기 좋게 — 검사는 하지 않는다 */
  function formatPhone(raw) {
    var d = String(raw == null ? "" : raw).replace(/\D/g, "").slice(0, 11);
    if (/^02/.test(d)) {
      if (d.length <= 2) return d;
      if (d.length <= 6) return d.slice(0, 2) + "-" + d.slice(2);
      if (d.length <= 9) return d.slice(0, 2) + "-" + d.slice(2, 5) + "-" + d.slice(5);
      return d.slice(0, 2) + "-" + d.slice(2, 6) + "-" + d.slice(6, 10);
    }
    if (d.length <= 3) return d;
    if (d.length <= 7) return d.slice(0, 3) + "-" + d.slice(3);
    if (d.length <= 10) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
    return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
  }

  root.MonnitValid = { email: email, phone: phone, formatPhone: formatPhone };
})(typeof window !== "undefined" ? window : this);
