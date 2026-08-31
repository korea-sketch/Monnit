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
  '리테일 · 매장 · 외식 온도 관리' : ['retail-store-foodservice.pdf',         '모넷코리아_리테일_매장_외식_온도관리_제안서.pdf']
};

/* 제목 표기 흔들림(가운뎃점·공백·대소문자) 흡수 */
function norm(s) {
  return String(s || '').replace(/[·・･‧∙•]/g, '·').replace(/\s+/g, ' ').trim().toLowerCase();
}
const INDEX = {};
Object.keys(MAP).forEach(k => { INDEX[norm(k)] = MAP[k]; });

exports.norm = norm;
exports.lookup = (title) => INDEX[norm(title)] || null;
exports.SECRET = process.env.DL_SECRET || 'mnk-dl-2026-c4f81a97e2';
exports.TTL_MS = 10 * 60 * 1000;   /* 링크 유효시간 10분 */
