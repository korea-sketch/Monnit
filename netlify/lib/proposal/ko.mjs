/** 한국어 이해 계층 — AI 없이 사람 말을 알아듣기 위한 공용 엔진 (2026-09-18)
 *
 *  「대화로 신청」이 AI 를 부르는 유일한 이유는 규칙이 못 알아들었을 때다.
 *  그래서 못 알아듣는 경우를 한국어의 생긴 모양 자체로 줄인다.
 *
 *    L0 정규화    NFC · 전각→반각 · 제어문자 · 반복 문자 축약
 *    L1 자판 오타 rla → 김   (영문 자판인 채로 친 한글)
 *    L2 자모      초·중·종성으로 쪼개 오타 거리를 음절이 아닌 자모로 잰다
 *    L3 형태소    조사(은·는·이·가·에서·으로…) · 어미(입니다·인데요·라서…) 떼기
 *    L4 띄어쓰기  양쪽 공백을 지우고 대조 — 「냉동 창고」 = 「냉동창고」
 *    L5 표기 흔들 컴프레서/콤프레샤, 센타/센터, 모타/모터 …
 *    L6 숫자·단위 영하 20도 / -20도 / 마이너스 20
 *    L7 의도      긍정·부정·수정·모름·거부
 *
 *  여기에는 업무 지식(현장 종류·고민 주제)을 넣지 않는다. 그건 chat.mjs 가 갖는다.
 *  이 파일은 「한국어를 다루는 법」만 갖는다. 그래야 다른 화면에서도 쓸 수 있다. */

/* ── L2 자모 ─────────────────────────────────────────────────────────── */
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const BASE = 0xac00, LAST = 0xd7a3;

export const isHangul = ch => { const c = String(ch).codePointAt(0); return c >= BASE && c <= LAST; };

/** 한 글자를 초·중·종성으로 — 한글이 아니면 글자 그대로 */
export function decompose(ch) {
  const c = String(ch).codePointAt(0);
  if (c < BASE || c > LAST) return [ch];
  const n = c - BASE;
  return [CHO[Math.floor(n / 588)], JUNG[Math.floor((n % 588) / 28)], JONG[n % 28]].filter(Boolean);
}
/** 문자열 전체를 자모 배열로 — 오타 거리를 이 위에서 잰다 */
export function jamo(s) {
  const out = [];
  for (const ch of String(s || '')) out.push(...decompose(ch));
  return out;
}
/** 초성만 — 「ㄱㅈ」으로 「공장」을 찾는 사람이 있다 */
export function chosung(s) {
  let out = '';
  for (const ch of String(s || '')) {
    const c = ch.codePointAt(0);
    out += (c >= BASE && c <= LAST) ? CHO[Math.floor((c - BASE) / 588)] : ch;
  }
  return out;
}
export const isChosungOnly = s => /^[ㄱ-ㅎ]{2,}$/.test(String(s || '').trim());

/* ── L1 영문 자판으로 친 한글 ────────────────────────────────────────── */
/*  「김현장」을 치려다 IME 를 안 바꿔 「rlaguswkd」 가 들어온다. 드물지 않다. */
const KEY2JAMO = {
  q:'ㅂ', w:'ㅈ', e:'ㄷ', r:'ㄱ', t:'ㅅ', y:'ㅛ', u:'ㅕ', i:'ㅑ', o:'ㅐ', p:'ㅔ',
  a:'ㅁ', s:'ㄴ', d:'ㅇ', f:'ㄹ', g:'ㅎ', h:'ㅗ', j:'ㅓ', k:'ㅏ', l:'ㅣ',
  z:'ㅋ', x:'ㅌ', c:'ㅊ', v:'ㅍ', b:'ㅠ', n:'ㅜ', m:'ㅡ',
  Q:'ㅃ', W:'ㅉ', E:'ㄸ', R:'ㄲ', T:'ㅆ', O:'ㅒ', P:'ㅖ'
};
const JUNG2 = { 'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ' };
const JONG2 = { 'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ' };

/** 자모 배열을 한글 음절로 조립 — 두벌식 오토마타 */
export function assemble(list) {
  let out = '', cho = '', jung = '', jong = '';
  const flush = () => {
    if (cho && jung) {
      out += String.fromCodePoint(BASE + CHO.indexOf(cho) * 588 + JUNG.indexOf(jung) * 28 + Math.max(0, JONG.indexOf(jong)));
    } else { out += cho + jung + jong; }
    cho = jung = jong = '';
  };
  for (const j of list) {
    const isV = JUNG.includes(j), isC = CHO.includes(j) || JONG.includes(j);
    if (!isV && !isC) { flush(); out += j; continue; }
    if (isV) {
      if (!cho) { flush(); out += j; continue; }            /* 홀로 선 모음 */
      if (!jung) { jung = j; continue; }
      if (JUNG2[jung + j]) { jung = JUNG2[jung + j]; continue; }
      if (jong) {                                          /* 받침이 다음 글자 초성으로 넘어간다 */
        let move = jong, keep = '';
        for (const [pair, made] of Object.entries(JONG2)) if (made === jong) { keep = pair[0]; move = pair[1]; }
        jong = keep;
        const c2 = move; flush(); cho = c2; jung = j; continue;
      }
      flush(); out += j; continue;
    }
    /* 자음 */
    if (!cho) { cho = j; continue; }
    if (!jung) { flush(); cho = j; continue; }
    if (!jong) { if (JONG.includes(j)) { jong = j; continue; } flush(); cho = j; continue; }
    if (JONG2[jong + j]) { jong = JONG2[jong + j]; continue; }
    flush(); cho = j; continue;
  }
  flush();
  return out;
}

/** 영문 자판으로 친 한글을 되돌린다. 한글이 만들어지지 않으면 빈 문자열 */
export function fromEnKeys(s) {
  const t = String(s || '');
  if (!/[a-zA-Z]/.test(t)) return '';
  const list = [];
  for (const ch of t) list.push(KEY2JAMO[ch] || ch);
  const made = assemble(list);
  return /[가-힣]/.test(made) ? made : '';
}

/* ── L0 정규화 ───────────────────────────────────────────────────────── */
/** 눈에 보이는 모양을 하나로 — 이후 모든 비교의 출발점 */
export function normalize(s) {
  let t = String(s == null ? '' : s).normalize('NFC');
  t = t.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));   /* 전각 → 반각 */
  t = t.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\ufeff]/g, ' ');
  t = t.replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—―]/g, '-');
  return t.replace(/\s+/g, ' ').trim();
}
/** 늘여 쓴 글자를 줄인다 — 「아니이이이」 「좋아요오오」 「ㅋㅋㅋㅋ」 */
export function deRepeat(s) {
  return normalize(s)
    .replace(/([가-힣a-zA-Z])\1{2,}/g, '$1$1')
    .replace(/([ㄱ-ㅣ])\1{1,}/g, '$1');
}
/** 대조용 형태 — 공백·기호를 지우고 소문자로. 사전과 입력 양쪽에 똑같이 쓴다 */
export const squash = s => normalize(s).toLowerCase().replace(/[\s\-_.·・/]/g, '');

/* ── L3 조사·어미 ────────────────────────────────────────────────────── */
/*  긴 것부터 떼야 한다(「에서는」을 「는」으로 먼저 떼면 「에서」가 남는다) */
const JOSA = ['이라고','라고는','에서는','에서도','으로는','으로도','한테는','에게는','께서는','라고','이라','에서','으로','한테','에게','에다','보다','처럼','같이','마다','조차','밖에','까지','부터','이랑','이나','이며','께서','에는','에도','만큼','이란','은','는','이','가','을','를','에','로','와','과','도','만','의','께','랑'];
const EOMI = ['이라고 합니다','이라고합니다','라고 합니다','라고합니다','이라서요','거든요','인데요','는데요','습니다','ㅂ니다','입니다','이에요','였어요','했어요','같아요','인가요','일까요','이고요','하구요','하고요','이예요','해서요','예요','네요','어요','아요','지요','구요','고요','인데','라서','여서','해서','이요','에요','임','요'];

/*  「무엇을 한다」는 서술 — 이름의 일부가 아니다.
    「물류창고 운영합니다」 「식품공장 하고 있어요」 → 앞의 이름만 남긴다. */
const TAIL = ['운영하고 있습니다','운영하고있습니다','운영하고 있어요','운영하고있어요','운영합니다','운영해요','운영중입니다','운영중','운영',
  '하고 있습니다','하고있습니다','하고 있어요','하고있어요','하고 있','하고있','하는 중','하는중','하고',
  '근무합니다','근무하고 있어요','근무중','근무','다니고 있어요','다니고있어요','다니고','다닙니다',
  '일하고 있어요','일하고있어요','일합니다','합니다','했습니다','해요','입니다'];

const stripFrom = (v, list, min) => {
  let s = v, changed = true, guard = 0;
  while (changed && guard++ < 8) {
    changed = false;
    for (const w of list) {
      if (s.length > w.length + min - 1 && s.endsWith(w)) { s = s.slice(0, -w.length).trim(); changed = true; break; }
    }
  }
  return s;
};
/** 끝에 붙은 말투를 떼어 낸다 — 「대한정밀입니다」 → 「대한정밀」
 *  줄기가 2글자 밑으로 줄어들 만큼은 떼지 않는다(「대한」에서 「한」을 떼면 안 된다) */
export function stripEomi(s) { return stripFrom(normalize(s), EOMI, 2); }
export function stripJosa(s) { return stripFrom(normalize(s), JOSA, 2); }
/** 말투·조사·웃음·말줄임까지 한 번에 — 값으로 받기 직전에 쓴다 */
export function stem(s) {
  let v = deRepeat(s)
    .replace(/\s*[ㅎㅋㅠㅜ~!^]+\s*$/g, '')
    .replace(/\s*[.…]{2,}\s*$/g, '')
    .replace(/\s*[,.!?]+$/g, '')
    .trim();
  v = stripEomi(v);
  v = stripFrom(v, TAIL, 2);      /* 「… 운영합니다」 같은 서술 떼기 */
  v = stripJosa(v);
  v = v.trim();
  /* 말투를 떼고 나면 한 글자짜리 찌꺼기가 남을 때가 있다 —
     「양계장 하는데요」 → 「양계장 하」. 그 한 글자는 이름의 일부가 아니다. */
  const parts = v.split(' ').filter(Boolean);
  if (parts.length > 1 && parts[parts.length - 1].length === 1 && /[가-힣]/.test(parts[parts.length - 1])) {
    v = parts.slice(0, -1).join(' ');
  }
  return v.trim();
}

/* ── L2 오타 거리 ────────────────────────────────────────────────────── */
function lev(a, b) {
  const n = a.length, m = b.length;
  if (!n) return m; if (!m) return n;
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[m];
}
/** 두 말이 얼마나 닮았는가 (0~1) — 음절이 아니라 자모로 잰다.
 *  「컴프레서」와 「콤프레샤」는 음절로 보면 5 중 2 가 다르지만 자모로는 12 중 2 다. */
export function similar(a, b) {
  const x = jamo(squash(a)), y = jamo(squash(b));
  if (!x.length || !y.length) return 0;
  return 1 - lev(x, y) / Math.max(x.length, y.length);
}
/** 사전에서 가장 닮은 말 — 기준치를 넘을 때만 돌려준다 */
export function nearest(word, words, min = 0.78) {
  const w = squash(word);
  if (!w) return null;
  let best = null, score = 0;
  for (const cand of words) {
    const s = similar(w, cand);
    if (s > score) { score = s; best = cand; }
  }
  return score >= min ? { word: best, score } : null;
}

/* ── L4+L5 사전 대조 ─────────────────────────────────────────────────── */
/** 표기가 흔들리는 말을 하나로 — 사전에 전부 적는 대신 여기서 편다 */
const VARIANT = [
  [/콤프레[서샤사]|컴프레[샤사]|콤푸레[서샤사]|compressor/gi, '컴프레서'],
  [/모우터|모타/g, '모터'],
  [/센타/g, '센터'], [/써어버|써버/g, '서버'], [/뻬어링|베아링/g, '베어링'],
  [/냉창/g, '냉동창고'], [/물센/g, '물류센터'], [/데센|dc룸/gi, '데이터센터'],
  [/분전함/g, '분전반'], [/배전함/g, '배전반'], [/수배전/g, '배전반'],
  [/해쌉|햇썹|해섭|핫셉|하셉/g, '해썹'],
  [/항온항습기/g, '항온항습'], [/칠러|치라/g, '냉동기'],
  [/판넬/g, '패널'], [/샷시|샤시/g, '새시'],
  [/에어콘|에어컨디셔너/g, '에어컨'], [/후렉시블|플렉시블/g, '플렉시블'],
  [/피시방|pc방/gi, 'PC방'], [/아이디씨|idc/gi, '데이터센터']
];
export function unifyVariants(s) {
  let t = normalize(s);
  for (const [re, to] of VARIANT) t = t.replace(re, to);
  return t;
}

/** 사전에서 찾기 — 띄어쓰기·표기 흔들림·조사·자판 오타·초성까지 견딘다.
 *  table: { key: [말, 말, …] }
 *  돌려주는 값: { key, word, how } — how 는 어떻게 찾았는지(기록용) */
/* 사전은 바뀌지 않으므로 한 번만 펴 둔다 — 매 호출마다 350낱말을 다시 정규화하던 것을 없앴다. (2026-09-19)
   표 객체를 키로 삼아 기억하므로, 표가 바뀌면(다른 객체) 자연히 다시 편다. */
const PREPARED = new WeakMap();
function prepare(table) {
  let p = PREPARED.get(table);
  if (p) return p;
  p = [];
  for (const [key, words] of Object.entries(table)) {
    for (const w of words) {
      const sw = squash(w);
      if (!sw) continue;
      p.push({ key, word: w, sw, cho: chosung(sw), jamo: jamo(sw) });
    }
  }
  PREPARED.set(table, p);
  return p;
}
function levArr(a, b) { return lev(a, b); }

export function lookup(text, table, { fuzzy = true, min = 0.82 } = {}) {
  const uni = unifyVariants(text);
  const flat = squash(uni);
  if (!flat) return null;
  const dict = prepare(table);

  /* ① 있는 그대로 (공백·기호를 지운 상태에서) — 가장 흔하고 가장 싸다.
     먼저 나온 낱말이 이기되, 같은 자리에서는 긴 낱말이 이긴다.
     「오피스텔」이 「오피스」(빌딩)로 잡히던 문제. */
  let best = null, at = Infinity, len = 0;
  for (const d of dict) {
    const i = flat.indexOf(d.sw);
    if (i < 0) continue;
    if (i < at || (i === at && d.sw.length > len)) { best = { key: d.key, word: d.word, how: 'exact' }; at = i; len = d.sw.length; }
  }
  if (best) return best;

  /* ② 영문 자판으로 친 한글 */
  const back = fromEnKeys(uni);
  if (back) {
    const f2 = squash(back);
    for (const d of dict) if (f2.includes(d.sw)) return { key: d.key, word: d.word, how: 'keyboard' };
  }

  /* ③ 초성만 친 경우 (ㄱㅈ → 공장) */
  if (isChosungOnly(flat)) {
    for (const d of dict) if (d.cho.startsWith(flat)) return { key: d.key, word: d.word, how: 'chosung' };
  }

  /* ④ 오타 — 짧은 답일 때만. 긴 문장에 함부로 쓰면 엉뚱한 곳에 걸린다 */
  if (fuzzy && flat.length <= 12) {
    const fj = jamo(flat);
    let bk = null, bs = 0, bw = '';
    for (const d of dict) {
      if (d.sw.length < 2) continue;
      /* 길이가 너무 다르면 닮았을 수 없다 — 거리 계산을 건너뛴다 */
      if (Math.abs(d.jamo.length - fj.length) > Math.max(fj.length, d.jamo.length) * (1 - min)) continue;
      const s = 1 - levArr(fj, d.jamo) / Math.max(fj.length, d.jamo.length);
      if (s > bs) { bs = s; bk = d.key; bw = d.word; }
    }
    if (bs >= min) return { key: bk, word: bw, how: 'typo', score: Math.round(bs * 100) / 100 };
  }
  return null;
}

/* ── L6 숫자·단위 ────────────────────────────────────────────────────── */
const NUMWORD = { '영':0, '공':0, '일':1, '이':2, '삼':3, '사':4, '오':5, '육':6, '칠':7, '팔':8, '구':9, '십':10, '백':100, '천':1000, '만':10000 };
/** 한글 수 — 「이십」 「삼백」 정도만. 그 이상은 사람이 숫자로 쓴다 */
export function hanNum(s) {
  const t = String(s || '');
  if (!t) return null;
  let total = 0, cur = 0;
  for (const ch of t) {
    const v = NUMWORD[ch];
    if (v == null) return null;
    if (v >= 10) { cur = (cur || 1) * v; if (v >= 10000) { total += cur; cur = 0; } }
    else cur = cur ? cur * 10 + v : v;
  }
  return total + cur;
}
/** 「영하 20도」 「-20도」 「마이너스 20」 「영하 이십도」 → -20 */
export function parseTemp(s) {
  const t = normalize(s).toLowerCase();
  const minus = /영하|마이너스|minus|-\s*\d/.test(t);
  let n = (t.match(/-?\s*(\d{1,3})\s*(도|°|℃|c\b)/) || [])[1];
  if (n == null) {
    const k = t.match(/([영공일이삼사오육칠팔구십백]{1,6})\s*도/);
    if (k) { const v = hanNum(k[1]); if (v != null) n = String(v); }
  }
  if (n == null || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return minus ? -Math.abs(v) : v;
}
/** 「센서 30개」 「20대」 「50포인트」 → 30 */
export function parseCount(s) {
  const m = normalize(s).match(/(\d{1,5})\s*(개|대|포인트|지점|ea|pcs|point)/i);
  return m ? Number(m[1]) : null;
}

/* ── L7 의도 ─────────────────────────────────────────────────────────── */
const INTENT = [
  ['yes',    /^(네+|넵+|넹+|예+|옙+|응+|웅+|어+$|그래|맞아|맞습니다|맞어|좋아|좋습니다|그렇게|그럼요|부탁|보내|진행|해주|오케이|콜|ㅇㅇ+|ㅇㅋ|ㄱㄱ|yes|yep|yeah|ok|okay|sure|go|please)/i],
  ['no',     /^(아니+|아뇨+|아니요|노+$|싫|괜찮아|괜찮습니다|됐어|됐습니다|안\s*할|취소|그만|ㄴㄴ|nope|no\b|cancel)/i],
  ['edit',   /(고칠|고쳐|고치|바꿔|바꾸|수정|틀렸|잘못|다시\s*(쓸|적|할|입력)|잠깐|잠시|아까|변경)/i],
  ['unknown',/(잘\s*모르|모르겠|모름|몰라|아직\s*(안|못)|아직이|정하지\s*않|안\s*정했|미정|아무거나|상관없|글쎄|패스|스킵|건너뛰|넘어가|skip|dunno|not sure)/i],
  ['all',    /(다\s*(걱정|중요|해당|필요|문제)|전부\s*다|모두\s*다|둘\s*다|전부요|모두요|다요|all)/i],
  ['hello',  /^(안녕|하이|반갑|헬로|hi\b|hello\b)/i],
  ['thanks', /(감사|고마워|고맙|땡큐|thank)/i],
  ['angry',  /(씨발|시발|ㅅㅂ|개새|병신|짜증|화나|어이없|답답)/i]
];
/** 이 말이 무엇을 하려는 말인가 — 값이 아니라 뜻을 읽는다 */
export function intentOf(s) {
  /* 늘여 쓴 것을 줄인 형태와 원래 형태를 둘 다 본다.
     「ㅇㅇ」는 줄이면 「ㅇ」이 되어 버리므로 원형도 함께 봐야 한다. */
  const a = deRepeat(s), b = normalize(s);
  const out = [];
  for (const [name, re] of INTENT) if (re.test(a) || re.test(b)) out.push(name);
  return out;
}
export const hasIntent = (s, name) => intentOf(s).includes(name);

/* ── 기록용 ──────────────────────────────────────────────────────────── */
/** 개인정보를 지운 모양 — 못 알아들은 말을 남길 때 이 형태로만 남긴다 */
export function redact(s) {
  return normalize(s)
    .replace(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '(메일)')
    .replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '(전화)')
    .replace(/\d{6}[-\s]?\d{7}/g, '(주민)')
    .slice(0, 200);
}

export default {
  isHangul, decompose, jamo, chosung, isChosungOnly, assemble, fromEnKeys,
  normalize, deRepeat, squash, stripEomi, stripJosa, stem,
  similar, nearest, unifyVariants, lookup,
  parseTemp, hanNum, parseCount, intentOf, hasIntent, redact
};
