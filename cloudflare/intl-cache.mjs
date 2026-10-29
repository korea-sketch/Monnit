/* ============================================================
   날짜 형식기 재사용 — 무료 플랜 CPU 10ms 대책 (2026-10-14)
   ------------------------------------------------------------
   함수 코드 곳곳이 날짜 하나를 바꿀 때마다 `new Intl.DateTimeFormat(…)` 을 새로 만든다
   (예: ops.mjs 의 kday). 형식기 하나를 만드는 데 약 0.1ms — 관제 집계처럼 접수 수십 건 ×
   날짜 30칸을 돌면 수천 번이 되어 그것만으로 수백 ms 가 든다.
   → Cloudflare 무료 플랜의 「요청당 CPU 10ms」를 넘겨 /ops/data · /ops/flow/data 가 실패했다.

   같은 언어·옵션의 형식기는 결과가 똑같으므로 한 번 만든 것을 재사용한다.
   Date#toLocaleString / toLocaleDateString / toLocaleTimeString 도 같은 형식기를 쓰게 한다.
   Worker 에서만 켠다. 결과(문자열)는 바뀌지 않는다.
   ============================================================ */
const MAX = 300;

export function installIntlCache() {
  if (globalThis.__MNK_INTL_CACHE) return;
  const Orig = Intl.DateTimeFormat;
  const cache = new Map();
  const keyOf = (loc, opt) => {
    try { return JSON.stringify([loc === undefined ? null : loc, opt === undefined ? null : opt]); } catch (e) { return null; }
  };
  const make = (loc, opt) => {
    const k = keyOf(loc, opt);
    if (k === null) return new Orig(loc, opt);
    let f = cache.get(k);
    if (!f) {
      f = new Orig(loc, opt);            /* 잘못된 옵션이면 원래처럼 여기서 예외 */
      if (cache.size >= MAX) cache.delete(cache.keys().next().value);
      cache.set(k, f);
    }
    return f;
  };
  function DateTimeFormat(loc, opt) { return make(loc, opt); }
  DateTimeFormat.prototype = Orig.prototype;
  DateTimeFormat.supportedLocalesOf = Orig.supportedLocalesOf.bind(Orig);
  try { Object.defineProperty(DateTimeFormat, 'name', { value: 'DateTimeFormat' }); } catch (e) { /* 무시 */ }
  Intl.DateTimeFormat = DateTimeFormat;

  /* toLocale*String — 명세의 기본값(날짜만·시간만)을 맞춰 같은 형식기로 */
  const DATE_F = ['weekday', 'era', 'year', 'month', 'day', 'dateStyle'];
  const TIME_F = ['dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits', 'timeStyle'];
  const has = (o, list) => !!o && list.some(k => o[k] !== undefined);
  const patch = (name, want) => {
    const orig = Date.prototype[name];
    Date.prototype[name] = function (loc, opt) {
      try {
        if (isNaN(this.getTime())) return orig.call(this, loc, opt);
        let o = opt;
        const d = has(opt, DATE_F), t = has(opt, TIME_F);
        if (want === 'any' && !d && !t) o = { ...(opt || {}), year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
        else if (want === 'date' && !d && !(opt && opt.timeStyle)) o = { ...(opt || {}), year: 'numeric', month: 'numeric', day: 'numeric' };
        else if (want === 'time' && !t && !(opt && opt.dateStyle)) o = { ...(opt || {}), hour: 'numeric', minute: 'numeric', second: 'numeric' };
        return make(loc, o).format(this);
      } catch (e) { return orig.call(this, loc, opt); }
    };
  };
  patch('toLocaleString', 'any');
  patch('toLocaleDateString', 'date');
  patch('toLocaleTimeString', 'time');
  /* 숫자도 같은 문제 — (12345).toLocaleString('ko-KR') 이 부를 때마다 형식기를 만든다 */
  const OrigNF = Intl.NumberFormat, nfCache = new Map();
  const nf = (loc, opt) => {
    const k = keyOf(loc, opt); if (k === null) return new OrigNF(loc, opt);
    let f = nfCache.get(k);
    if (!f) { f = new OrigNF(loc, opt); if (nfCache.size >= MAX) nfCache.delete(nfCache.keys().next().value); nfCache.set(k, f); }
    return f;
  };
  const numLocale = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (loc, opt) {
    try { return nf(loc, opt).format(this); } catch (e) { return numLocale.call(this, loc, opt); }
  };
  globalThis.__MNK_INTL_CACHE = true;
}
