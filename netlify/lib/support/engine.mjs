/** 기술지원 검색·감정 판별 엔진 (2026-10-20)
 *
 *  서버(/api/support/chat)와 브라우저(js/support-kb.js)가 같은 코드를 쓴다.
 *  ※ 브라우저 사본은 scripts/support-sync.mjs 가 이 파일의 「export 」만 떼어 붙여 만든다.
 *     그래서 이 파일은 import 가 없어야 하고, 함수는 데이터를 인자로 받는다.
 *
 *  · AI 비용 0 — 고객 말 대부분은 여기서 바로 문서로 이어진다.
 *  · 한국어는 띄어쓰기·어미가 제각각이라 단어 일치 + 두 글자 조각(bigram) 일치를 함께 본다.
 */

/* 검색에 쓸모없는 말 — 「~요」「안녕하세요」 같은 것 */
const STOP = /^(이|가|은|는|을|를|에|의|도|좀|요|이요|해요|어요|아요|있어요|없어요|돼요|되요|되나요|하나요|인가요|나요|까요|어떻게|왜|그냥|진짜|정말|너무|계속|자꾸|저기|혹시|안녕하세요|문의|와요|와|언제|오늘|내일|질문|궁금|궁금해요|합니다|입니다|있습니다|싶어요|싶습니다|해주세요|알려|주세요)$/;

export function normalize(s, SYN) {
  let t = String(s == null ? '' : s).toLowerCase();
  (SYN || []).forEach(([re, to]) => { t = t.replace(re, to); });
  return t.replace(/[^\p{L}\p{N}.\-]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function words(t) {
  return t.split(' ').map(w => w.replace(/(은|는|이|가|을|를|에서|에|으로|로|도|만|요|이요|해요|어요|아요|나요|가요|까요|인데|는데|했는데|하는데)$/, ''))
    .filter(w => w.length >= 2 && !STOP.test(w));
}
function grams(t) {
  const out = new Set();
  t.split(' ').forEach(w => { for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2)); });
  return out;
}

export function buildIndex(ARTICLES, SYN) {
  return ARTICLES.map(a => {
    const head = normalize([a.title].concat(a.q || []).join(' '), SYN);
    const keys = normalize((a.kw || []).join(' '), SYN);
    const body = normalize([a.lead].concat(a.steps || [], a.note || []).join(' '), SYN);
    return { a, head, keys, body, hg: grams(head + ' ' + keys), bg: grams(body) };
  });
}

/** 질문 → 관련 문서 순위 [{ id, score, a }] */
export function search(index, query, opts) {
  opts = opts || {};
  const SYN = opts.SYN;
  const t = normalize(query, SYN);
  if (!t) return [];
  const ws = words(t), qg = grams(t);
  const res = index.map(x => {
    let s = 0, hits = 0;
    ws.forEach(w => {
      if (x.keys.indexOf(w) > -1) { s += 4; hits++; }
      else if (x.head.indexOf(w) > -1) { s += 3; hits++; }
      else if (x.body.indexOf(w) > -1) s += 1;
    });
    if (qg.size) {
      let h = 0, b = 0;
      qg.forEach(g => { if (x.hg.has(g)) h++; else if (x.bg.has(g)) b++; });
      s += (h / qg.size) * 6 + (b / qg.size) * 1.5;
    }
    if (x.a.need && !x.a.need.some(n => t.indexOf(n) > -1)) s *= 0.5;
    if (opts.cat && x.a.cat === opts.cat) s += 1.5;
    if (opts.exclude && opts.exclude.indexOf(x.a.id) > -1) s = -1;
    return { id: x.a.id, score: Math.round(s * 100) / 100, hits, a: x.a };
  }).filter(r => r.score > 0).sort((p, q) => q.score - p.score);
  return res.slice(0, opts.limit || 5);
}

/** 검색 결과를 믿을 만한가 — 높음이면 AI 없이 바로 문서를 보여 준다 */
export function confidence(results) {
  if (!results.length) return 'none';
  /* 단어가 하나도 안 맞고 글자 조각만 겹친 것은 우연이다 — 「배송 언제 와요」가 「알림이 안 와요」에 붙지 않게 */
  if (!results[0].hits) return results[0].score >= 3 ? 'low' : 'none';
  const top = results[0].score, second = results[1] ? results[1].score : 0;
  if (top >= 8 && top - second >= 1.5) return 'high';
  if (top >= 5) return 'mid';
  return 'low';
}

/* ── 고객 마음 읽기 ─────────────────────────────────────────────
   화가 난 고객에게 긴 점검표를 다시 내밀면 더 화가 난다.
   감정·긴급·사람 요청을 먼저 읽고, 그에 맞게 답의 순서를 바꾼다. */
const ANGRY = /(짜증|화나|화가|열받|빡치|빡쳐|어이(가)?\s*없|장난\s*해|장난하|몇\s*번(째|을|이나)?|몇번|계속\s*안|또\s*안|아직도|도대체|대체\s*왜|환불|최악|답답|미치겠|미쳤|돈\s*아까|사기|책임\s*져|왜\s*이래|안\s*되잖|안되잖|고객\s*센터.*(안|없)|연락이\s*안|말이\s*되|ㅡㅡ|-_-|;;|!!+|\?\?+)/;
/* 지금 일어나고 있는 사고 — 설치 설명 중이라도 무조건 긴급 */
const INCIDENT = /(불이\s*(났|나|붙)|화재가?\s*(났|발생|나서|중)|연기가?\s*(나|보)|타는\s*냄새|물이\s*(차|새|넘|샘)|침수\s*(됐|되고|돼서|중)|정전\s*(됐|되고|돼서|중)|냉동고?.*(온도가?\s*(올라|높)|녹)|백신|시약)/;
const FIRE = /(불이\s*(났|나|붙)|화재가?\s*(났|발생|나서|중)|연기가?\s*(나|보)|타는\s*냄새)/;
const URGENT = /(화재|침수|누수.*(지금|발생|났)|정전.*(지금|발생|됐)|긴급|급해|급합|당장|지금\s*바로|빨리\s*좀|생산\s*(중단|멈|스톱)|라인\s*(멈|정지)|감사\s*(전|앞))/;
/* 「화재 알리미 설치」처럼 설치·연결 이야기 속 「화재」는 긴급이 아니다 */
const INSTALL = /(알리미|설치|단자|연결\s*(방법|하는)|붙이|어디에|시험|테스트)/;
const HUMAN = /(사람|상담원|상담사|담당자|직원|엔지니어|기사님?)\s*(이랑|하고|과|와|한테|에게|좀|분)?\s*(연결|통화|얘기|이야기|바꿔|상담|불러)|(연결|통화)\s*(해|시켜)\s*(줘|주세요|주실|주시|달라)|사람\s*(없|있)|전화\s*(주|줘|번호|해\s*주)|직접\s*(와|방문|봐)|방문\s*(요청|해\s*주|가능)|출장/;
const THANKS = /(감사|고마|해결\s*(됐|되었|했)|됐어요|되네요|잘\s*돼|성공|okay|오케이|굿|좋아요)/;
/* 기술지원 밖 — 구매·견적·배송·계약은 영업 담당에게 바로 */
const SALES = /(가격|얼마|견적|단가|구매|구입|주문|배송|택배|납기|재고|계약|세금계산서|결제|입금|환불|대리점|총판|파트너\s*문의|데모|체험\s*신청|렌탈|구독\s*료)/;
const NOWORK = /(안\s*돼|안돼|안\s*됨|그래도|여전히|똑같|마찬가지|해\s*봤는데|해봤는데|다\s*했|소용\s*없|효과\s*없|변화\s*없)/;

export function mood(text) {
  const t = String(text || '');
  return {
    angry: ANGRY.test(t),
    urgent: INCIDENT.test(t) || (URGENT.test(t) && !INSTALL.test(t)),
    fire: FIRE.test(t),
    human: HUMAN.test(t),
    thanks: THANKS.test(t) && !NOWORK.test(t),
    nowork: NOWORK.test(t),
    sales: SALES.test(t)
  };
}
