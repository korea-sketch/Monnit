/** 받침에 맞는 조사 — 「누수 늦은 발견를」 같은 문장을 막는다 (2026-09-17)
 *  josa('발견', '을', '를') → '발견을'  ·  josa('정지', '을', '를') → '정지를'
 *  '으로/로' 는 ㄹ 받침이면 '로' (예: 설비 → 설비로, 공장 → 공장으로, 레일 → 레일로)
 *  한글이 아닌 끝 글자(영문·숫자·괄호)는 읽는 소리를 대략 따른다. */
const DIGIT_BATCHIM = { 0: 1, 1: 1, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 0 };
function lastSound(word) {
  const s = String(word || '').replace(/[\s)\]」』"'”’.,·…]+$/u, '');
  const ch = s.slice(-1);
  if (!ch) return { batchim: false, rieul: false };
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { batchim: jong !== 0, rieul: jong === 8 };
  }
  if (/[0-9]/.test(ch)) return { batchim: !!DIGIT_BATCHIM[ch], rieul: /[178]/.test(ch) };
  if (/[lL]/.test(ch)) return { batchim: true, rieul: true };
  if (/[mnMNkKpPtTbBgG]/.test(ch)) return { batchim: true, rieul: false };
  return { batchim: false, rieul: false };
}
export function josa(word, withB, withoutB) {
  const { batchim, rieul } = lastSound(word);
  if (withB === '으로') return word + (batchim && !rieul ? '으로' : '로');
  return word + (batchim ? withB : withoutB);
}
