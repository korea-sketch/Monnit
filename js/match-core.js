/*! Monnit Korea — 맞견적(MatchQuote) 공통 엔진 v1 (2026-11-16)
 *
 *  다른 곳에서 받은 견적서를 붙여 넣으면 품목을 읽어(parse) 종류를 나누고(classify),
 *  같은 조건의 모넷 구성으로 바꿔(convert) 나란히 보여 주기 위한 계산 모듈입니다.
 *
 *  · 브라우저(/match)와 서버(server/functions/match.mjs)가 같은 파일을 씁니다 — valid.js 와 같은 방식.
 *  · 이 파일에는 단가가 없습니다. 단가·상한·프로모션은 서버 설정(server/functions/_match.mjs)에만 있고,
 *    convert() 는 설정(cfg)을 인자로 받습니다. 그래서 공개 스크립트만 보고는 단가표를 알 수 없습니다.
 *  · 결과를 꾸미지 않습니다. 모넷 쪽이 더 비싸게 나오면 그대로 'higher' 로 돌려줍니다.
 */
(function (root) {
  'use strict';

  /* ── 품목 종류 ───────────────────────────────────────────── */
  var KINDS = {
    sensor: '센서', gateway: '수집·통신 장비', platform: '플랫폼·소프트웨어',
    construction: '공사·설치', maintenance: '유지보수', comm: '통신비', etc: '기타'
  };
  var KIND_ORDER = ['sensor', 'gateway', 'platform', 'construction', 'maintenance', 'comm', 'etc'];

  /* 센서 분류 — 위에서부터 먼저 맞는 것. key 는 서버 단가표(cfg.catalog)의 키와 같습니다. */
  var SENSOR_RULES = [
    ['rope',     /로프|누수\s*케이블|리크\s*케이블|leak\s*cable|라인\s*형|필름\s*형|누액/i],
    ['temphum',  /온\s*[·\/,]?\s*습도|temp.*humid|humidity/i],
    ['thermo',   /열전대|thermo\s*couple|k[\s-]?type/i],
    ['dp',       /차압|differential/i],
    ['pressure', /압력|pressure/i],
    ['vib',      /진동|vibration|가속도/i],
    ['current',  /전류|전력량|전력|\bCT\b|current/i],
    ['volt',     /전압|정전|voltage|전원\s*감지|통전/i],
    ['water',    /누수|물\s*감지|침수|leak|water|플로트|오뚜기|수위/i],
    ['dry',      /접점|드라이|dry\s*contact|트립|경보\s*신호/i],
    ['button',   /비상\s*벨|버튼|호출/i],
    ['door',     /도어|개폐|문\s*열림|마그네틱|출입\s*감지/i],
    ['motion',   /동작|모션|재실|\bPIR\b|움직임/i],
    ['gas',      /가스|CO2|CO₂|이산화탄소|일산화탄소|산소/i],
    ['temp',     /온도|temperature|\btemp\b|냉장|냉동/i]
  ];
  var RE = {
    total:        /합\s*계|소\s*계|총\s*액|총\s*계|\btotal\b|부가\s*세|부가가치세|\bvat\b|공급\s*가액|견적\s*금액|견적\s*가|최종\s*금액/i,
    header:       /품\s*명|품\s*목|규\s*격|수\s*량|단\s*가|금\s*액|비\s*고/,
    month:        /월\s*(이용|사용|구독|관제|통신|렌탈|임대|정액|요금|비용)|\/\s*월|월\s*정|매\s*월|월\s*납|monthly|per\s*month/i,
    year:         /연\s*(간|구독|이용|사용|요금)|\/\s*년|년\s*간|yearly|annual|per\s*year|1\s*년\s*(이용|구독|사용)/i,
    comm:         /통신\s*(비|료|요금)|회선|유심|usim|\bsim\b|데이터\s*요금|LTE\s*요금/i,
    construction: /공사|배선|배관|전선|포설|트레이|노무|인건|시공|설치\s*비|설치\s*(공사|용역)|시운전|천공|코어|덕트|함체|분전|판넬|panel|결선|제\s*경비|일반\s*관리비|이윤|간접비|출장|운반|하역|자재비|부자재|전원\s*공사/i,
    platform:     /플랫폼|소프트웨어|software|s\/w|\bsw\b|서버|server|라이선스|라이센스|license|클라우드|cloud|대시보드|dashboard|관제\s*(시스템|프로그램|화면)|모니터링\s*(시스템|프로그램|솔루션)|프로그램|데이터베이스|\bdb\b|앱\s*개발|\bhmi\b|scada|커스터마이징|개발\s*비|구축\s*비|계정|이용권/i,
    maintenance:  /유지\s*보수|유지\s*관리|정기\s*점검|a\/s|하자\s*보수|maintenance|검\s*교정|교정\s*비/i,
    gateway:      /게이트\s*웨이|gateway|g\/w|\bgw\b|수신기|중계기|리피터|repeater|라우터|router|모뎀|modem|\bap\b|허브|\bhub\b|컨버터|converter|\brtu\b|\bddc\b|\bplc\b|로거|logger|통신\s*(모듈|장비|함)|집중기|컨트롤러|controller/i,
    sensor:       /센서|sensor|감지기|디텍터|detector|트랜스미터|transmitter|측정기|계측기|프로브|probe/i
  };

  function classify(name) {
    var s = String(name || '');
    var period = RE.month.test(s) ? 'month' : RE.year.test(s) ? 'year' : '';
    var i, cat = '';
    /* 「누수 케이블」처럼 공사 낱말(케이블)이 섞인 센서를 먼저 건진다 */
    if (SENSOR_RULES[0][1].test(s) && !/포설|공사|노무/.test(s)) return { kind: 'sensor', cat: 'rope', period: period };
    if (RE.comm.test(s)) return { kind: 'comm', cat: '', period: period || 'month' };
    if (RE.maintenance.test(s)) return { kind: 'maintenance', cat: '', period: period };
    if (RE.construction.test(s)) return { kind: 'construction', cat: '', period: period };
    if (RE.platform.test(s)) return { kind: 'platform', cat: '', period: period };
    if (RE.gateway.test(s)) return { kind: 'gateway', cat: '', period: period };
    for (i = 0; i < SENSOR_RULES.length; i++) if (SENSOR_RULES[i][1].test(s)) { cat = SENSOR_RULES[i][0]; break; }
    if (cat) return { kind: 'sensor', cat: cat, period: period };
    if (RE.sensor.test(s)) return { kind: 'sensor', cat: 'other', period: period };
    return { kind: 'etc', cat: '', period: period };
  }

  /* ── 숫자 읽기 ───────────────────────────────────────────── */
  var NUM = /([-△▲−]\s*)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(만\s*원|천\s*원|억\s*원|원|₩|ea|개소|개|대|식|set|세트|조|본|회선|포인트|point|pt|m|미터|개월|년|월|%)?/gi;
  function numbers(s) {
    var out = [], m; NUM.lastIndex = 0;
    while ((m = NUM.exec(s))) {
      var raw = m[2].replace(/,/g, '') + (m[3] || '');
      var v = parseFloat(raw); if (!isFinite(v)) continue;
      var u = String(m[4] || '').replace(/\s/g, '').toLowerCase();
      if (u === '%') continue;
      if (u === '만원') v *= 1e4; else if (u === '천원') v *= 1e3; else if (u === '억원') v *= 1e8;
      if (m[1]) v = -v;
      /* 모델명 속 숫자(LS-100, ALTA900, 940MHz, 24V …)는 버린다 */
      var before = s.charAt(m.index - 1), after = s.charAt(m.index + m[0].length);
      var glued = /[A-Za-z]/.test(before) || (/[A-Za-z]/.test(after) && !u) || (before === '-' && /[A-Za-z0-9]/.test(s.charAt(m.index - 2)));
      if (glued && !/원|₩/.test(u)) continue;
      out.push({ v: v, u: u, i: m.index, comma: m[2].indexOf(',') >= 0, money: /원|₩/.test(u) });
    }
    return out;
  }
  var near = function (a, b) { return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.011); };

  /** 한 줄 → { name, qty, unit, amount, guess } | null */
  function parseLine(line) {
    var s = String(line || '').replace(/ /g, ' ').replace(/[\t|]+/g, '  ').trim();
    if (!s) return null;
    var ns = numbers(s);
    if (!ns.length) return null;
    var qty = 1, unit = 0, amount = 0, cut = ns[0].i, guess = false, k, a, b, c;
    var tail = ns.slice(-4);
    /* ① 수량 × 단가 = 금액 이 맞는 조합을 뒤에서부터 찾는다 */
    var found = false;
    for (k = tail.length - 3; k >= 0 && !found; k--) {
      a = tail[k]; b = tail[k + 1]; c = tail[k + 2];
      if (a.v > 0 && near(a.v * b.v, c.v)) { qty = a.v; unit = b.v; amount = c.v; cut = a.i; found = true; }
    }
    if (!found && tail.length >= 2) {
      a = tail[tail.length - 2]; b = tail[tail.length - 1];
      /* ② 두 수 — 앞이 작은 정수면 「수량 · 금액」으로 본다(확인 표시) */
      if (a.v > 0 && a.v <= 9999 && !a.comma && !a.money && Math.abs(b.v) >= 1000) { qty = a.v; amount = b.v; unit = b.v / a.v; cut = a.i; guess = a.v > 1; found = true; }
      else if (near(a.v, b.v)) { qty = 1; unit = amount = b.v; cut = a.i; found = true; }   /* 단가 = 금액 (1식) */
    }
    if (!found) { b = tail[tail.length - 1]; qty = 1; unit = amount = b.v; cut = b.i; guess = ns.length > 1; }
    var name = s.slice(0, cut).replace(/^\s*(\d{1,2}[.)]|[-·*•▪■□○●])\s*/, '').replace(/\s+(ea|개|대|식|set|세트|조|본|lot|unit)\s*$/i, '').replace(/[\s:：·,\-–—]+$/, '').trim();
    if (!name) name = s.replace(NUM, ' ').replace(/\s+/g, ' ').trim();
    if (!name || Math.abs(amount) < 100) return null;
    return { name: name.slice(0, 80), qty: Math.round(qty * 100) / 100, unit: Math.round(unit), amount: Math.round(amount), guess: guess };
  }

  /** 붙여 넣은 견적서 글 → { lines, stated } */
  function parse(text) {
    var rows = String(text || '').replace(/\r/g, '').split('\n'), lines = [], stated = { total: 0, vat: 0 };
    for (var i = 0; i < rows.length && lines.length < 80; i++) {
      var r = rows[i]; if (!r || !r.trim()) continue;
      if (RE.total.test(r)) {
        var n = numbers(r); if (n.length) { var v = n[n.length - 1].v; if (/부가|vat/i.test(r)) stated.vat = v; else if (v > stated.total) stated.total = v; }
        continue;
      }
      var p = parseLine(r); if (!p) continue;
      var c = classify(p.name);
      /* 다채널 모듈(8CH 등)은 1대가 여러 감지 지점이다 — 수량을 지점 수로 맞추도록 화면에서 알린다 */
      var ch = c.kind === 'sensor' && /(\d+)\s*(ch|채널|점)\b/i.exec(r);
      lines.push({ name: p.name, qty: p.qty, unit: p.unit, amount: p.amount, guess: p.guess, kind: c.kind, cat: c.cat, period: c.period, multi: ch ? Number(ch[1]) : 0 });
    }
    return { lines: lines, stated: stated };
  }

  /** 입력 정리 — 서버가 받은 값을 그대로 믿지 않는다 */
  function cleanLines(arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).slice(0, 80).forEach(function (l) {
      if (!l) return;
      var amount = Math.round(Number(l.amount) || 0), qty = Number(l.qty) || 1;
      if (!isFinite(amount) || !amount || Math.abs(amount) > 5e10 || !(qty > 0) || qty > 1e6) return;
      var name = String(l.name || '').replace(/[<>]/g, '').slice(0, 80).trim(); if (!name) return;
      var c = classify(name);
      var kind = KINDS[l.kind] ? l.kind : c.kind;
      out.push({ name: name, qty: Math.round(qty * 100) / 100, unit: Math.round(Number(l.unit) || (amount / qty)), amount: amount,
        kind: kind, cat: kind === 'sensor' ? String(l.cat || c.cat || 'other').slice(0, 20) : '',
        period: l.period === 'month' || l.period === 'year' ? l.period : '' });
    });
    return out;
  }
  function cleanOpts(o) {
    o = o || {};
    var n = function (v, d, lo, hi) { v = Math.round(Number(v)); return isFinite(v) && v >= lo && v <= hi ? v : d; };
    return { sites: n(o.sites, 1, 1, 500), years: n(o.years, 3, 1, 10), net: o.net === 'lan' ? 'lan' : 'lte',
      platform: o.platform === 'scube' ? 'scube' : 'cloud', install: o.install === 'assist' ? 'assist' : 'self', vatIncluded: !!o.vatIncluded };
  }

  /* ── 치환 ────────────────────────────────────────────────── */
  /** lines · opts · cfg(서버 설정) → 비교 결과(상세) */
  function convert(lines, opts, cfg) {
    lines = cleanLines(lines); opts = cleanOpts(opts);
    var ex = opts.vatIncluded ? 1 / 1.1 : 1;
    var T = { init: 0, yearly: 0, byKind: {} }, O = { init: 0, yearly: 0, byKind: {}, lines: [] };
    KIND_ORDER.forEach(function (k) { T.byKind[k] = { init: 0, yearly: 0, n: 0 }; O.byKind[k] = { init: 0, yearly: 0 }; });
    var map = [], notes = [], unpriced = [], points = 0, theirGw = 0;

    lines.forEach(function (l) {
      var amt = Math.round(l.amount * ex), b = T.byKind[l.kind];
      b.n++;
      if (l.period === 'month') { b.yearly += amt * 12; T.yearly += amt * 12; }
      else if (l.period === 'year') { b.yearly += amt; T.yearly += amt; }
      else { b.init += amt; T.init += amt; }
      if (l.kind === 'gateway') theirGw += l.qty;
    });

    /* 센서 — 같은 종류끼리 묶어 한 줄로 */
    var groups = {};
    lines.forEach(function (l) { if (l.kind !== 'sensor') return; var g = groups[l.cat] || (groups[l.cat] = { cat: l.cat, qty: 0, their: 0, names: [] }); g.qty += l.qty; g.their += Math.round(l.amount * ex) * (l.period === 'month' ? 12 : 1); if (g.names.length < 3) g.names.push(l.name); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], c = (cfg.catalog || {})[k], q = Math.ceil(g.qty);
      points += q;
      if (c && c.price > 0) {
        var a = c.price * q; O.init += a; O.byKind.sensor.init += a;
        O.lines.push({ kind: 'sensor', name: c.name, qty: q, unit: c.price, amount: a });
        map.push({ kind: 'sensor', their: g.names.join(' · '), theirAmt: g.their, ours: c.name, qty: q, unit: c.price, amount: a, note: c.note || '' });
      } else {
        unpriced.push((c && c.name) || g.names[0]);
        O.lines.push({ kind: 'sensor', name: (c && c.name) || '대응 센서 확인', qty: q, unit: null, amount: null });
        map.push({ kind: 'sensor', their: g.names.join(' · '), theirAmt: g.their, ours: (c && c.name) || '대응 센서 확인', qty: q, unit: null, amount: null, note: '담당자가 대응 모델과 단가를 확인해 안내합니다' });
      }
    });

    /* 게이트웨이 — 현장 수와 센서 수로 계산 (1대당 수용 센서 수는 설정값) */
    var gwCfg = (cfg.gateway || {})[opts.net] || {}, cap = Math.max(1, Number((cfg.gateway || {}).capacity) || 250);
    var gwN = (points > 0 || theirGw > 0) ? Math.max(opts.sites, Math.ceil(points / cap)) : 0;
    if (gwN > 0) {
      var ga = (gwCfg.price || 0) * gwN; O.init += ga; O.byKind.gateway.init += ga;
      O.lines.push({ kind: 'gateway', name: gwCfg.name || '게이트웨이', qty: gwN, unit: gwCfg.price || null, amount: gwCfg.price ? ga : null });
      map.push({ kind: 'gateway', their: T.byKind.gateway.n ? '수집·통신 장비 ' + T.byKind.gateway.n + '개 항목' : '(견적서에 없음)', theirAmt: T.byKind.gateway.init + T.byKind.gateway.yearly,
        ours: gwCfg.name || '게이트웨이', qty: gwN, unit: gwCfg.price || null, amount: gwCfg.price ? ga : null,
        note: '현장 ' + opts.sites + '곳 · 센서 ' + points + '개 기준 (1대당 센서 ' + cap + '개 수용)' });
      if (!gwCfg.price) unpriced.push(gwCfg.name || '게이트웨이');
    }

    /* 플랫폼 — 연 구독. 상한(cfg.platform.cap)을 넘지 않는다 */
    var pf = (cfg.platform || {})[opts.platform] || {}, pcap = Number((cfg.platform || {}).cap) || 0;
    var pYear = Math.max(0, Number(pf.annual) || 0); if (pcap > 0) pYear = Math.min(pYear, pcap);
    var promo = cfg.promo || {}, pFree = promo.platformFirstYearFree ? 1 : 0;
    if (points > 0 || T.byKind.platform.n) {
      O.yearly += pYear; O.byKind.platform.yearly += pYear;
      O.lines.push({ kind: 'platform', name: pf.name || '플랫폼', qty: 1, unit: pYear, amount: pYear, period: 'year', promoFreeYears: pFree });
      map.push({ kind: 'platform', their: T.byKind.platform.n ? '플랫폼·소프트웨어 ' + T.byKind.platform.n + '개 항목' : '(견적서에 없음)', theirAmt: T.byKind.platform.init, theirYearly: T.byKind.platform.yearly,
        ours: pf.name || '플랫폼', qty: 1, unit: pYear, amount: pYear, period: 'year',
        note: (pf.note || '연 구독') + (pFree ? ' · 첫 해 프로모션 면제(' + (promo.label || '기간 한정') + ') — 2년차부터 과금' : '') });
    }

    /* 공사·설치 — 무선·자석 부착식이라 배선 공사 항목이 없다. 설치 대행은 설정된 요율이 있을 때만 금액으로 */
    var ins = cfg.install || {}, insAmt = 0, insKnown = true, insName = '직접 설치 (자석 부착 · 전원 연결)';
    if (opts.install === 'assist') {
      insName = '설치 대행';
      if (promo.installFree) { insAmt = 0; }
      else if (ins.assistBase > 0 || ins.assistPerPoint > 0) insAmt = Math.round((Number(ins.assistBase) || 0) * opts.sites + (Number(ins.assistPerPoint) || 0) * points);
      else insKnown = false;
    }
    if (points > 0 || T.byKind.construction.n) {
      if (insKnown) { O.init += insAmt; O.byKind.construction.init += insAmt; } else unpriced.push('설치 대행');
      O.lines.push({ kind: 'construction', name: insName, qty: 1, unit: insKnown ? insAmt : null, amount: insKnown ? insAmt : null });
      map.push({ kind: 'construction', their: T.byKind.construction.n ? '공사·설치 ' + T.byKind.construction.n + '개 항목' : '(견적서에 없음)', theirAmt: T.byKind.construction.init + T.byKind.construction.yearly,
        ours: insName, qty: 1, unit: insKnown ? insAmt : null, amount: insKnown ? insAmt : null,
        note: opts.install === 'assist' ? (promo.installFree ? '설치비 프로모션 면제(' + (promo.label || '기간 한정') + ')' : insKnown ? '현장 ' + opts.sites + '곳 · 센서 ' + points + '개 기준' : '현장 확인 뒤 금액을 안내합니다') : (ins.selfNote || '배선 공사가 없는 무선 방식입니다') });
    }
    if (T.byKind.maintenance.n) map.push({ kind: 'maintenance', their: '유지보수 ' + T.byKind.maintenance.n + '개 항목', theirAmt: T.byKind.maintenance.init, theirYearly: T.byKind.maintenance.yearly,
      ours: '기본 보증', qty: 1, unit: 0, amount: 0, note: (cfg.warrantyNote || '제품 기본 보증 1년') + ' — 보증 기간 이후 유상 수리·교체는 포함하지 않았습니다' });
    if (T.byKind.comm.n) {
      var cm = Math.max(0, Number((cfg.comm || {})[opts.net]) || 0);
      O.yearly += cm; O.byKind.comm.yearly += cm;
      if (cm) O.lines.push({ kind: 'comm', name: '통신', qty: 1, unit: cm, amount: cm, period: 'year' });
      map.push({ kind: 'comm', their: '통신비 ' + T.byKind.comm.n + '개 항목', theirAmt: T.byKind.comm.init, theirYearly: T.byKind.comm.yearly,
        ours: '통신', qty: 1, unit: cm, amount: cm, period: 'year', note: ((cfg.comm || {}).note || {})[opts.net] || '' });
    }
    if (T.byKind.etc.n) { map.push({ kind: 'etc', their: '기타 ' + T.byKind.etc.n + '개 항목', theirAmt: T.byKind.etc.init, theirYearly: T.byKind.etc.yearly, ours: '해당 항목 없음', qty: 0, unit: 0, amount: 0, note: '모넷 구성에 대응 항목이 없어 0원으로 두었습니다 — 필요 여부를 담당자가 확인합니다' }); notes.push('기타로 분류된 항목은 모넷 구성에 넣지 않았습니다.'); }

    var years = opts.years, freeY = Math.min(pFree, years);
    var tTco = T.init + T.yearly * years, oTco = O.init + O.yearly * years - pYear * freeY;
    var partial = unpriced.length > 0, diff = tTco - oTco, pct = tTco > 0 ? Math.round(diff / tTco * 1000) / 10 : 0;
    /* 한쪽에만 있는 비용(유지보수 · 기타) — 모넷 구성에 대응 항목이 없어 0원으로 둔 것. 이를 뺀 차이도 함께 돌려준다 */
    var oneSided = (T.byKind.maintenance.init + T.byKind.etc.init) + (T.byKind.maintenance.yearly + T.byKind.etc.yearly) * years;
    var tEx = tTco - oneSided, diffEx = tEx - oTco, pctEx = tEx > 0 ? Math.round(diffEx / tEx * 1000) / 10 : 0;
    /* 판정은 보수적인 쪽(한쪽에만 있는 비용을 뺀 차이)으로 한다 */
    var verdict = !lines.length ? 'empty' : partial ? 'partial' : (Math.abs(pctEx) < 3 ? 'similar' : diffEx > 0 ? 'lower' : 'higher');
    return {
      ok: true, opts: opts, points: points, gateways: gwN, years: years,
      theirs: { init: T.init, yearly: T.yearly, tco: tTco, byKind: T.byKind },
      ours: { init: O.init, yearly: O.yearly, tco: oTco, firstYearFree: freeY ? pYear : 0, byKind: O.byKind, lines: O.lines },
      map: map, diff: diff, pct: pct, oneSided: oneSided, diffEx: diffEx, pctEx: pctEx, verdict: verdict, unpriced: unpriced, notes: notes,
      platformCap: pcap, vat: 'VAT 별도 기준' + (opts.vatIncluded ? ' (입력하신 금액은 VAT 포함으로 보고 ÷1.1 했습니다)' : '')
    };
  }

  /** 연락처를 남기기 전에 보여 줄 요약 — 품목별 단가·줄 금액을 지운다 (묶음 소계·총액만) */
  function redact(r) {
    if (!r || !r.ok) return r;
    var c = JSON.parse(JSON.stringify(r));
    c.detail = false;
    c.ours.lines = c.ours.lines.map(function (l) { return { kind: l.kind, name: l.name, qty: l.qty, period: l.period || '' }; });
    c.map = c.map.map(function (m) { return { kind: m.kind, their: m.their, theirAmt: m.theirAmt, theirYearly: m.theirYearly || 0, ours: m.ours, qty: m.qty, period: m.period || '', note: m.note, priced: m.amount != null }; });
    return c;
  }

  /* ── 구간 표시 (7차 · 2026-11-16) ─────────────────────────────
     고객 화면에는 모넷 금액을 정확한 숫자가 아니라 구간으로만 내보낸다 — 단가·줄 금액·정확한 합계는 응답에 넣지 않는다.
     구간은 계산값을 반드시 포함한다: 아래로 down%, 위로 up% 벌린 뒤 보기 좋은 단위로 바깥쪽 반올림. */
  function rng(x, dn, up) {
    x = Number(x) || 0; if (!(x > 0)) return [0, 0];
    var st = x < 1e6 ? 1e5 : x < 1e7 ? 5e5 : x < 1e8 ? 1e6 : 5e6;
    var lo = Math.floor(x * (1 - dn / 100) / st) * st, hi = Math.ceil(x * (1 + up / 100) / st) * st;
    if (lo <= 0) lo = Math.min(st, Math.floor(x / 1e4) * 1e4) || x;
    if (hi <= lo) hi = lo + st;
    return [lo, hi];
  }
  function band(r, range) {
    if (!r || !r.ok) return r;
    var dn = Math.max(0, Number((range || {}).down)), up = Math.max(0, Number((range || {}).up));
    if (!isFinite(dn)) dn = 10; if (!isFinite(up)) up = 15;
    var y = r.years, O = r.ours, T = r.theirs, bk = {};
    KIND_ORDER.forEach(function (k) { var o = O.byKind[k]; bk[k] = rng(o.init + o.yearly * y - (k === 'platform' ? (O.firstYearFree || 0) : 0), dn, up); });
    var tco = rng(O.tco, dn, up), tEx = T.tco - (r.oneSided || 0);
    /* 차이도 구간으로 — 가장 적게 나는 경우(모넷 상단)와 가장 크게 나는 경우(모넷 하단) */
    var dLo = tEx - tco[1], dHi = tEx - tco[0];
    var pct = function (d) { return tEx > 0 ? Math.round(d / tEx * 100) : 0; };
    /* 판정은 불리한 쪽 기준: 모넷 상단으로도 낮아야 '낮음', 모넷 하단으로도 높아야 '높음' */
    var verdict = r.verdict === 'empty' || r.verdict === 'partial' ? r.verdict : (dLo > tEx * 0.03 ? 'lower' : dHi < -tEx * 0.03 ? 'higher' : 'similar');
    return { ok: true, banded: true, opts: r.opts, points: r.points, gateways: r.gateways, years: y, vat: r.vat, platformCap: r.platformCap,
      theirs: T, oneSided: r.oneSided || 0, theirsEx: tEx,
      ours: { tco: tco, init: rng(O.init, dn, up), yearly: rng(O.yearly, dn, up), firstYearFree: O.firstYearFree ? 1 : 0, byKind: bk },
      diff: [dLo, dHi], pct: [pct(dLo), pct(dHi)], verdict: verdict, unpriced: r.unpriced, notes: r.notes,
      map: r.map.map(function (m) { return { kind: m.kind, their: m.their, theirAmt: m.theirAmt, theirYearly: m.theirYearly || 0, ours: m.ours, qty: m.qty, period: m.period || '', note: m.note, priced: m.amount != null }; }) };
  }

  var won = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('ko-KR'); };

  root.MonnitMatch = { KINDS: KINDS, KIND_ORDER: KIND_ORDER, classify: classify, parseLine: parseLine, parse: parse,
    cleanLines: cleanLines, cleanOpts: cleanOpts, convert: convert, redact: redact, band: band, rng: rng, won: won };
})(typeof window !== 'undefined' ? window : this);
