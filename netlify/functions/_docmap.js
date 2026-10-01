/** 제안서 제목 → 파일명 매핑 (서버 전용)
 *  이 표는 브라우저로 나가지 않는다. 파일 자체도 /proposals/* 직접 접근이 막혀 있다. */
const MAP = {
  '데이터센터 · IDC 모니터링'      : ['data-center-monitoring.pdf',          '모넷코리아_데이터센터_IDC_모니터링_제안서.pdf'],
  '무선 IoT 설비 예지보전 제안 가이드': ['predictive-maintenance-guide.pdf',     '모넷코리아_무선IoT_설비예지보전_제안가이드.pdf'],   /* 광고 랜딩 /promo/proposal 전용 */
  '공장 설비 예지보전'             : ['factory-predictive-maintenance.pdf',   '모넷코리아_공장설비_예지보전_제안서.pdf'],
  '진동 · 구조안전 계측'           : ['vibration-structural-safety.pdf',      '모넷코리아_진동_구조안전_계측_제안서.pdf'],
  '건설 · 토목 구조물 모니터링'    : ['construction-shm.pdf',                 '모넷코리아_건설_토목_구조물모니터링_제안서.pdf'],
  'UPS · ESS · 전력 설비 모니터링' : ['energy-ups-ess.pdf',                   '모넷코리아_UPS_ESS_전력설비_모니터링_제안서.pdf'],
  '무선 화재경보 · 소방 안전'      : ['fire-safety-wireless-alarm.pdf',       '모넷코리아_무선화재경보_소방안전_제안서.pdf'],
  '스마트 FM · 시설관리'           : ['smart-facility-management.pdf',        '모넷코리아_스마트FM_시설관리_플랫폼_제안서.pdf'],
  '공공 · 국방 시설 안전관리'      : ['public-defense-facility.pdf',          '모넷코리아_공공_국방_시설안전관리_제안서.pdf'],
  '호텔 · 리조트 시설 모니터링'    : ['hotel-resort-monitoring.pdf',          '모넷코리아_호텔_리조트_시설모니터링_제안서.pdf'],
  '학교 · 교회 · 공공시설 모니터링': ['school-church-public.pdf',             '모넷코리아_학교_교회_공공시설_모니터링_제안서.pdf'],
  '온도 · 누수 · 동파 · HVAC 통합' : ['hvac-leak-freeze-monitoring.pdf',      '모넷코리아_온도_누수_동파_HVAC_통합모니터링_제안서.pdf'],
  '농업 · 골프장 토양 수분'        : ['agriculture-golf-soil.pdf',            '모넷코리아_농업_골프장_토양수분_모니터링_제안서.pdf'],
  '바이오 · 제약 유틸리티 모니터링': ['bio-pharma-utility-monitoring.pdf',    '모넷코리아_바이오_제약_유틸리티_모니터링_제안서.pdf'],
  '실버타운 · 시니어 안전'         : ['senior-care-monitoring.pdf',           '모넷코리아_실버타운_시니어안전_모니터링_제안서.pdf'],
  '콜드체인 · 물류 온도 관리'      : ['cold-chain-logistics.pdf',             '모넷코리아_콜드체인_물류_온도모니터링_제안서.pdf'],
  '리테일 · 매장 · 외식 온도 관리' : ['retail-store-foodservice.pdf',         '모넷코리아_리테일_매장_외식_온도관리_제안서.pdf'],

  /* ── 무선 온도 감시 랜딩(/promo/temperature) 전용 3종 · 2026-09-08 ──
     왼쪽 제목은 랜딩 페이지 DOCS[*].title 과 한 글자도 달라선 안 된다.
     가운뎃점 표기 흔들림은 아래 norm() 이 흡수하지만 띄어쓰기는 흡수하지 못한다.

     값은 반드시 [저장소 파일명, 내려받을 때 보일 이름] 두 칸이다.
     첫 칸은 getdoc.js 의 /^[a-z0-9-]+\.pdf$/ 검사를 통과해야 하므로
     한글·공백·대문자를 쓸 수 없다. 한글 이름은 두 번째 칸에 둔다.
     배포된 안내문(_docmap-추가분.js)은 한 칸짜리 문자열이었는데, 그대로 붙이면
     sendpw 가 [file, dlname] 로 분해하면서 file 에 글자 하나만 들어가
     다운로드가 통째로 실패한다. */
  '의약품·백신 냉장 및 초저온 보관 온도 감시 제안서'
      : ['temp-pharma-ultracold.pdf',    '모넷코리아_의약품·백신_냉장·초저온_온도감시_제안서.pdf'],
  '방폭 구역 온도 감시 IECEx Zone 1 제안서'
      : ['temp-hazardous-iecex.pdf',     '모넷코리아_방폭구역_온도감시_IECEx_제안서.pdf'],
  '콜드체인·냉동물류창고 온도 감시 제안서'
      : ['temp-coldchain-warehouse.pdf', '모넷코리아_콜드체인·냉동물류창고_온도감시_제안서.pdf'],

  /* ── 무선센서 Modbus 연동 백서 (/promo/modbus) · 2026-09-09 ──
     32페이지 기술 백서. 원래는 공개 링크로 그냥 받아 갈 수 있었는데,
     광고로 데려온 방문자가 익명으로 가져가고 아무 기록도 남지 않았다.
     다른 제안서 20종과 같은 게이트(sendpw → getdoc)로 통일한다. */
  '무선센서 Modbus 연동 백서'
      : ['modbus-integration-whitepaper.pdf', '무선센서_Modbus_연동_백서_MonnitKorea.pdf']
};

/* 제목 표기 흔들림(가운뎃점·공백·대소문자) 흡수 */
function norm(s) {
  return String(s || '').replace(/[·・･‧∙•]/g, '·').replace(/\s+/g, ' ').trim().toLowerCase();
}
const INDEX = {};
Object.keys(MAP).forEach(k => { INDEX[norm(k)] = MAP[k]; });

exports.norm = norm;
exports.lookup = (title) => INDEX[norm(title)] || null;
/* ── 링크 서명 키 (2026-09-18) ────────────────────────────────────────
   예전에는 여기에 실제 키 문자열이 적혀 있었다. 자료 파일명 21종도 바로 위에
   목록으로 있으므로, 저장소를 본 사람은 누구나 유효한 다운로드 링크를 직접
   만들 수 있었다 — 폼을 거치지 않고 백서를 전부 받아갈 수 있었다는 뜻이다.
   이제 DL_SECRET 을 쓰고, 없으면 공개되지 않은 값(SITE_ID)에서 만들어 쓴다.
   SITE_ID 는 배포마다 바뀌지 않으므로 이미 나간 링크도 그대로 살아 있다.
   ※ 운영에서는 DL_SECRET 을 반드시 설정하십시오 — /ops 연동 점검에 표시됩니다. */
exports.SECRET = process.env.DL_SECRET ||
  require('crypto').createHmac('sha256', String(process.env.SITE_ID || 'monnit-local'))
    .update('monnit-dl-link').digest('hex');
exports.TTL_MS = 10 * 60 * 1000;   /* 링크 유효시간 10분 */

/* 메일에 넣을 사이트 주소 — 요청 머리글(Origin·Referer)을 그대로 믿지 않는다 (2026-09-17)
   예전에는 Origin 을 그대로 썼다. 페이지에 박힌 토큰으로 누구나 함수를 부를 수 있으므로,
   Origin 을 남의 주소로 바꿔 보내면 「모넷코리아 발신 메일」 안에 남의 사이트 링크가 들어갈 수 있었다.
   이 사이트(monnit.co.kr)와 이 사이트의 Netlify 배포 주소·로컬만 허용하고, 나머지는 monnit.co.kr 로 쓴다. */
exports.siteBase = function siteBase(origin) {
  const def = 'https://monnit.co.kr';
  const m = String(origin || '').match(/^https?:\/\/[^/]+/i);
  if (!m) return def;
  const b = m[0].toLowerCase();
  let host = '';
  try { host = new URL(b).hostname; } catch (e) { return def; }
  if (/^(www\.)?monnit\.co\.kr$/.test(host) && b.startsWith('https://')) return b;
  if (/^(localhost|127\.0\.0\.1)$/.test(host)) return b;
  for (const k of ['URL', 'DEPLOY_URL', 'DEPLOY_PRIME_URL']) {
    try { if (process.env[k] && new URL(process.env[k]).hostname === host) return b; } catch (e) { /* 무시 */ }
  }
  return def;
};
