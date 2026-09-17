/** 회사 인식 — 회사명·이메일 도메인·시설 설명으로 산업과 세부 업종을 추정한다.
 *
 *  순서: ① 알려진 기업 목록(이름·별칭·도메인)  ② 도메인 규칙(.go.kr 등)
 *        ③ 업종 키워드(회사명 → 시설 설명·문의 내용 순)  ④ 문의 폼 선택값
 *  결과는 「추정」이다. 제안서에는 확신도(confidence)가 높을 때만 회사 맞춤 문장을 넣고,
 *  낮으면 산업 일반 문장으로 쓴다. 담당자 알림 메일·관리 화면에 근거(reasons)를 그대로 보여준다.
 *  외부 조회는 하지 않는다 — 순수 함수, 같은 입력이면 같은 결과. */
import { industryByKey } from './kb.mjs';
import { segmentOf } from './match.mjs';

export function normCompany(s) {
  return String(s || '').toLowerCase()
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(재\)|재단법인|\(사\)|사단법인|농업회사법인|영농조합법인|\binc\b\.?|\bco\.?,?\s*ltd\b\.?|\bltd\b\.?|\bcorp(oration)?\b\.?|\bcompany\b|\bllc\b/g, '')
    .replace(/[\s()\[\]·.,\-_'"&/]/g, '');
}

/* 알려진 기업 — n: 이름·별칭(정규화 전), d: 이메일 도메인, i/s: 산업/세부, c: 모넷 사례 키(도입 사례가 있는 곳)
   짧은 영문 별칭(3자 이하)은 단어 경계가 맞을 때만 인정한다. */
export const DIRECTORY = [
  /* 바이오·제약 */
  { n: ['삼성바이오로직스', 'samsung biologics'], d: ['samsungbiologics.com'], i: 'bio_pharma', s: 'biologics', c: 'samsung-biologics' },
  { n: ['삼성바이오에피스', 'samsung bioepis'], i: 'bio_pharma', s: 'biologics' },
  { n: ['셀트리온', 'celltrion'], d: ['celltrion.com'], i: 'bio_pharma', s: 'biologics' },
  { n: ['롯데바이오로직스', 'lotte biologics'], i: 'bio_pharma', s: 'biologics' },
  { n: ['SK바이오사이언스', 'sk bioscience'], i: 'bio_pharma', s: 'biologics' },
  { n: ['GC녹십자', '녹십자', 'gc biopharma'], i: 'bio_pharma', s: 'biologics' },
  { n: ['한미약품', '유한양행', '대웅제약', '종근당', '동아에스티', '보령', 'JW중외제약', '일동제약', 'HK이노엔', '셀트리온제약', '광동제약', '제일약품'], i: 'bio_pharma', s: 'pharma' },
  { n: ['지오영', '백제약품', '쥴릭파마'], i: 'bio_pharma', s: 'gdp' },
  { n: ['한국생명공학연구원', '한국화학연구원', '한국과학기술연구원', 'KIST'], i: 'bio_pharma', s: 'lab' },
  /* 제조 */
  { n: ['삼성전자', 'samsung electronics'], i: 'manufacturing', s: 'semiconductor', c: 'samsung' },
  { n: ['SK하이닉스', 'sk hynix', '하이닉스'], d: ['skhynix.com'], i: 'manufacturing', s: 'semiconductor' },
  { n: ['DB하이텍', 'LG디스플레이', '삼성디스플레이', '앰코테크놀로지', 'SK실트론', '원익IPS', '주성엔지니어링'], i: 'manufacturing', s: 'semiconductor' },
  { n: ['LG에너지솔루션', 'lg energy solution'], d: ['lgensol.com'], i: 'manufacturing', s: 'battery' },
  { n: ['삼성SDI', 'SK온', '에코프로', '포스코퓨처엠', '엘앤에프', 'SK아이이테크놀로지'], i: 'manufacturing', s: 'battery' },
  { n: ['현대자동차', '현대차', 'hyundai motor'], d: ['hyundai.com'], i: 'manufacturing', s: 'automotive', c: 'hyundai-motors' },
  { n: ['기아', '기아자동차', 'kia'], d: ['kia.com'], i: 'manufacturing', s: 'automotive' },
  { n: ['현대모비스', '한온시스템', 'HL만도', '현대위아', '현대트랜시스', '만도'], i: 'manufacturing', s: 'automotive' },
  { n: ['LG화학', '롯데케미칼', '한화솔루션', '금호석유화학', '효성화학', 'SKC', 'OCI', '코오롱인더스트리', 'SK케미칼'], i: 'manufacturing', s: 'chemical' },
  { n: ['포스코', 'POSCO', '현대제철', '동국제강', 'HD현대중공업', '한화오션', '삼성중공업', 'LS일렉트릭', '두산에너빌리티', '두산밥캣', 'HD현대일렉트릭'], i: 'manufacturing', s: 'general_mfg' },
  /* 데이터센터·통신 */
  { n: ['한국마이크로소프트', 'microsoft', '마이크로소프트'], d: ['microsoft.com'], i: 'datacenter', s: 'colocation', c: 'microsoft' },
  { n: ['한화S&C', '한화에스앤씨', '한화 S&C솔루션', 'hanwha s&c'], i: 'datacenter', s: 'enterprise', c: 'hanwha-snc' },
  { n: ['네이버클라우드', 'NHN클라우드', '카카오엔터프라이즈', '삼성SDS', 'LG CNS', 'SK C&C', 'KT클라우드', '에퀴닉스', 'equinix', '디지털리얼티', 'digital realty'], i: 'datacenter', s: 'colocation' },
  { n: ['KT', 'SK텔레콤', 'SKT', 'LG유플러스', 'LGU+', 'SK브로드밴드', '세종텔레콤'], i: 'datacenter', s: 'telecom' },
  /* 에너지 */
  { n: ['한국전력공사', '한국전력', '한전', 'KEPCO'], d: ['kepco.co.kr'], i: 'energy', s: 'grid' },
  { n: ['한국수력원자력', '한수원'], d: ['khnp.co.kr'], i: 'energy', s: 'power' },
  { n: ['한국남동발전', '한국중부발전', '한국서부발전', '한국남부발전', '한국동서발전', 'SK E&S', '포스코에너지', '지역난방공사', '한국지역난방공사'], i: 'energy', s: 'power' },
  { n: ['GS EPS', 'GS이피에스', '지에스이피에스'], i: 'energy', s: 'power', c: 'gs-eps' },
  { n: ['한국수자원공사', 'K-water', '케이워터'], d: ['kwater.or.kr'], i: 'energy', s: 'water' },
  { n: ['베올리아', 'veolia'], d: ['veolia.com'], i: 'energy', s: 'water', c: 'veolia' },
  { n: ['한국환경공단', 'KECO'], d: ['keco.or.kr'], i: 'energy', s: 'water', c: 'keco' },
  { n: ['SK이노베이션', 'SK에너지', 'GS칼텍스', 'S-OIL', '에쓰오일', 'HD현대오일뱅크', '현대오일뱅크', '한국가스공사', 'KOGAS', '한국석유공사', 'SK가스', 'E1'], d: ['gscaltex.com', 's-oil.com'], i: 'energy', s: 'oil_gas' },
  { n: ['엑슨모빌', 'exxonmobil'], d: ['exxonmobil.com'], i: 'energy', s: 'oil_gas', c: 'exxonmobil' },
  { n: ['삼천리'], d: ['samchully.co.kr'], i: 'energy', s: 'oil_gas', c: 'samchully' },
  { n: ['한화큐셀', '한화신에너지'], i: 'energy', s: 'renewable' },
  { n: ['LX'], i: 'energy', c: 'lx' },
  /* 빌딩·FM */
  { n: ['CBRE', '씨비알이'], d: ['cbre.com'], i: 'building_fm', s: 'office', c: 'cbre' },
  { n: ['HDC랩스', '에이치디씨랩스', 'hdc labs'], i: 'building_fm', s: 'mixed', c: 'hdc-labs' },
  { n: ['젠스타메이트', '쿠시먼앤드웨이크필드', 'JLL', '에스원', '이지스자산운용', '마스턴투자운용'], i: 'building_fm', s: 'office' },
  { n: ['신세계프라퍼티', '스타필드', '롯데자산개발', '코엑스', '현대백화점', '신세계백화점', '롯데백화점'], i: 'building_fm', s: 'mall' },
  { n: ['세안텍스'], i: 'building_fm', c: 'seantex' },
  /* 콜드체인·유통 */
  { n: ['CJ대한통운', 'cj logistics'], d: ['cjlogistics.com'], i: 'cold_chain', s: 'warehouse' },
  { n: ['롯데글로벌로지스', '한진', '팀프레시', '동원로엑스', '로지스밸리'], i: 'cold_chain', s: 'warehouse' },
  { n: ['쿠팡', 'coupang'], d: ['coupang.com'], i: 'cold_chain', s: 'fulfillment' },
  { n: ['컬리', '마켓컬리', 'kurly'], d: ['kurlycorp.com'], i: 'cold_chain', s: 'fulfillment' },
  { n: ['SSG닷컴', '오아시스마켓'], i: 'cold_chain', s: 'fulfillment' },
  { n: ['이마트', 'emart'], i: 'cold_chain', s: 'store_chain', c: 'emart' },
  { n: ['홈플러스', '롯데마트', 'GS리테일', 'BGF리테일', '코리아세븐', '이마트24', '농협하나로유통'], i: 'cold_chain', s: 'store_chain' },
  { n: ['월마트', 'walmart'], i: 'cold_chain', s: 'store_chain', c: 'walmart' },
  /* 식품·농수산 */
  { n: ['CJ피드앤케어', 'cj feed&care'], i: 'food_agri', s: 'livestock', c: 'cj-feedncare' },
  { n: ['CJ제일제당', '오뚜기', '농심', '대상', '풀무원', '동원F&B', '롯데웰푸드', 'SPC삼립', '빙그레', '매일유업', '남양유업', '하림', '오리온', '삼양식품'], i: 'food_agri', s: 'food_factory' },
  { n: ['SPC', '파리크라상', '롯데GRS', '스타벅스', 'SCK컴퍼니', '맥도날드', 'CJ푸드빌', '본아이에프', '교촌에프앤비', '더본코리아'], i: 'food_agri', s: 'restaurant' },
  /* 주거·숙박 */
  { n: ['호텔신라', '롯데호텔', '조선호텔앤리조트', '파라다이스', '한화호텔앤드리조트', '워커힐', '소노인터내셔널', '대명소노', '켄싱턴호텔앤리조트'], i: 'residential', s: 'hotel' },
  { n: ['한국토지주택공사', 'LH', '서울주택도시공사', 'SH공사'], d: ['lh.or.kr'], i: 'residential', s: 'rental' },
  { n: ['우리관리', '신영에셋', '이지스엔터프라이즈'], i: 'residential', s: 'apartment' },
  /* 공공 */
  { n: ['주한미군', 'USFK', 'us army', '미 육군'], i: 'public', s: 'military', c: 'us-army' },
  { n: ['국방부', '방위사업청', '국군재정관리단', '국방시설본부'], i: 'public', s: 'military' },
  { n: ['강남구청', '강남구'], d: ['gangnam.go.kr'], i: 'public', s: 'government', c: 'gangnam' },
  { n: ['국립중앙박물관', '국립현대미술관', '예술의전당', '세종문화회관'], i: 'public', s: 'culture' },
  { n: ['서울교통공사', '한국철도공사', '코레일', '국가철도공단', '부산교통공사', '인천교통공사'], i: 'public', s: 'underground' },
  { n: ['한국도로공사', '인천국제공항공사', '한국공항공사'], i: 'public' },
  /* 병원·교육 */
  { n: ['한양대학교구리병원', '한양대구리병원'], i: 'edu_med', s: 'hospital', c: 'hyu-guri-hospital' },
  { n: ['서울대학교병원', '삼성서울병원', '서울아산병원', '세브란스', '가톨릭중앙의료원', '분당서울대병원'], i: 'edu_med', s: 'hospital' },
  { n: ['신한대학교', '신한대'], d: ['shinhan.ac.kr'], i: 'edu_med', s: 'university', c: 'shinhan-univ' },
  { n: ['송현초등학교'], i: 'edu_med', s: 'school', c: 'songhyun-elem' },
  /* 건설 */
  { n: ['현대건설', 'hyundai e&c'], d: ['hdec.co.kr'], i: 'construction', s: 'site', c: 'hyundai-enc' },
  { n: ['현대엔지니어링', 'hyundai engineering'], d: ['hec.co.kr'], i: 'construction', s: 'plant_epc', c: 'hyundai-engineering' },
  { n: ['SK에코플랜트', 'sk ecoplant'], i: 'construction', s: 'plant_epc', c: 'sk-ecoplant' },
  { n: ['호반건설', '호반'], i: 'construction', s: 'site', c: 'hoban' },
  { n: ['삼성물산', 'GS건설', '대우건설', 'DL이앤씨', '포스코이앤씨', '롯데건설', 'HDC현대산업개발', '두산건설', '계룡건설', '태영건설', '동부건설', 'SK에코엔지니어링', '한신공영', '코오롱글로벌'], i: 'construction', s: 'site' },
  { n: ['삼성E&A', '삼성엔지니어링', 'DL건설'], i: 'construction', s: 'plant_epc' }
];

/* 무료 메일 — 도메인으로 아무것도 추정하지 않는다 */
const FREE_MAIL = /^(gmail|naver|daum|hanmail|kakao|nate|outlook|hotmail|live|icloud|me|yahoo|korea|empas|paran|hanmir|proton|protonmail)\./;

/* 도메인 규칙 */
const DOMAIN_RULES = [
  [/\.mil\.kr$/, 'public', 'military', 0.8, '국방 도메인(.mil.kr)'],
  [/\.go\.kr$/, 'public', 'government', 0.6, '정부 도메인(.go.kr)'],
  [/\.(es|ms|hs|sc)\.kr$/, 'edu_med', 'school', 0.8, '학교 도메인'],
  [/\.ac\.kr$/, 'edu_med', 'university', 0.6, '대학 도메인(.ac.kr)'],
  [/(hospital|hosp|medical|clinic|cmc)\b/, 'edu_med', 'hospital', 0.6, '병원 도메인'],
  [/\.re\.kr$/, 'edu_med', 'university', 0.4, '연구기관 도메인(.re.kr)'],
  [/\.or\.kr$/, 'public', '', 0.25, '기관 도메인(.or.kr)']
];

/* 업종 키워드 — 산업을 정하는 강한 단어만. 세부 업종은 정해진 산업 안에서 플레이북 match 로 고른다 */
const IND_KW = [
  ['bio_pharma', ['바이오로직스', '바이오의약', '바이오팜', '제약', '약품', '파마', 'pharm', 'biologics', 'cdmo', '백신', '의약품', '신약']],
  ['construction', ['건설', '종합건설', '토목', '시공', '건축현장', '공사현장', '현장사무소', 'e&c', 'construction', '플랜트', 'epc']],
  ['edu_med', ['병원', '의료원', '의원', '메디컬', 'hospital', '대학교', '대학원', '초등학교', '중학교', '고등학교', '유치원', '교육청', 'university', 'college', '요양원', '요양병원', '복지관', '복지센터', '어린이집']],
  ['datacenter', ['데이터센터', 'idc', 'datacenter', '전산실', '서버실', '전산센터', '클라우드', '텔레콤', 'telecom', '기지국', '통신국사']],
  ['energy', ['발전', '발전소', '전력', '에너지', 'energy', 'power', '수자원', '상수도', '하수처리', '정수장', '수처리', '물재생', '변전소', 'ess', '정유', '석유', '도시가스', '가스공사', '태양광', '풍력', 'solar']],
  ['manufacturing', ['반도체', '디스플레이', '이차전지', '배터리', '자동차', '모비스', '화학', '케미칼', '케미컬', '제조', '공장', '공업', '산업', '정밀', '금속', '제철', '중공업', '기계', '전자', 'semiconductor', 'chemical', 'industrial', 'manufacturing', 'factory']],
  ['cold_chain', ['물류', '로지스', 'logistics', '콜드체인', '냉장', '냉동', '냉장창고', '냉동창고', '저온창고', '풀필먼트', 'fulfillment', '통운', '택배', '유통', '리테일', 'retail', '마트', '편의점']],
  ['food_agri', ['식품', '푸드', 'food', '제과', '제빵', '음료', '유업', '외식', '프랜차이즈', '레스토랑', '양식장', '수산', '축산', '양돈', '양계', '한우', '목장', '스마트팜', '온실', '농업', '농장', '영농', '농협', '수협', '사료']],
  ['residential', ['호텔', 'hotel', '리조트', 'resort', '콘도', '펜션', '아파트', '공동주택', '관리사무소', '주택관리', '기숙사', '임대주택', '레지던스']],
  ['public', ['시청', '구청', '군청', '도청', '청사', '주민센터', '행정복지센터', '공단', '공사', '국방', '부대', '사단', '육군', '해군', '공군', '박물관', '미술관', '문화회관', '공연장', '도서관', '지하철', '교통공사', '터널', '공동구', '지자체']],
  ['building_fm', ['빌딩', '타워', '오피스', '자산운용', '리츠', 'reit', '시설관리', '건물관리', 'fm', '쇼핑몰', '백화점', '아울렛', '복합시설', '주상복합', '부동산', 'building', 'tower', 'office']],
  ['general', ['교회', '성당', '사찰', '교구', '성전', '수도원', 'church', '셀프스토리지', '창고', '매장', '카페', '식당', '학원', '사무실']]
];

/* 문의 폼 「산업군」 선택값 → 산업 (약한 근거) */
export const CONTACT_INDUSTRY = {
  '부동산': 'building_fm', '공장': 'manufacturing', '건설': 'construction', '물류': 'cold_chain',
  '인프라': 'energy', '농축산': 'food_agri',
  /* 홈 상단 빠른 상담 폼 */
  '공장·제조': 'manufacturing', '병원·제약': 'bio_pharma', '교회·학교·시설': 'edu_med', '물류·콜드체인': 'cold_chain',
  '데이터센터': 'datacenter', '빌딩·부동산': 'building_fm'
};

const low = s => String(s || '').toLowerCase();
/* 흔한 낱말과 겹치는 이름 — 정확히 같을 때만 */
const EXACT_ONLY = new Set(['대상', '보령', '한진', '호반', '하림', '만도', '보람'].map(x => normCompany(x)));
function aliasHit(normName, rawLow, alias) {
  const a = normCompany(alias);
  if (!a) return 0;
  if (normName === a) return 1;
  if (/^[a-z0-9+&-]{1,3}$/.test(a)) {   /* 짧은 영문 — 띄어 쓴 단어로 나올 때만 (「LX판토스」는 LX 아님) */
    const re = new RegExp('(^|[\\s(])' + a.replace(/[+&-]/g, '\\$&') + '($|[\\s)])');
    return re.test(rawLow.trim()) ? 0.7 : 0;
  }
  if (EXACT_ONLY.has(a)) return 0;
  if (/^[가-힣]{2}$/.test(a)) return normName.startsWith(a) ? 0.8 : 0;
  if (normName.includes(a)) return 0.9;
  return 0;
}

function lookupDirectory(company) {
  const nn = normCompany(company), raw = low(company);
  if (!nn) return null;
  let best = null;
  for (const e of DIRECTORY) for (const al of e.n) {
    const h = aliasHit(nn, raw, al);
    if (!h) continue;
    const len = normCompany(al).length;
    if (!best || h > best.h || (h === best.h && len > best.len)) best = { e, h, len, al };
  }
  return best;
}

function kwIndustry(text) {
  const t = low(text).replace(/\s+/g, '');
  if (!t) return null;
  let best = null;
  for (const [ind, kws] of IND_KW) {
    const hit = kws.filter(k => {
      const kk = low(k).replace(/\s+/g, '');
      if (/^[a-z&]{1,3}$/.test(kk)) return new RegExp('(^|[^a-z])' + kk.replace('&', '\\&') + '([^a-z]|$)').test(low(text));
      return t.includes(kk);
    });
    if (!hit.length) continue;
    const sc = hit.reduce((n, k) => n + Math.min(k.length, 5), 0);
    if (!best || sc > best.sc) best = { ind, sc, hit };
  }
  return best;
}

/** detect({ company, email, facility, memo, industryText }) */
export function detect({ company = '', email = '', facility = '', memo = '', industryText = '' } = {}) {
  const reasons = [];
  const name = String(company || '').trim();
  const domain = low(String(email || '').split('@')[1] || '').trim();
  let r = null;

  /* ① 알려진 기업 */
  const dir = lookupDirectory(name);
  let byDomain = null;
  if (domain && !FREE_MAIL.test(domain)) byDomain = DIRECTORY.find(e => (e.d || []).some(d => domain === d || domain.endsWith('.' + d)));
  if (dir) {
    r = { industry: dir.e.i, segment: dir.e.s || '', customer: dir.h >= 0.8 ? (dir.e.c || '') : '', confidence: dir.h >= 1 ? 0.95 : dir.h >= 0.8 ? 0.85 : 0.7, source: 'directory' };
    if (dir.e.c && !r.customer) r.maybeCustomer = dir.e.c;
    reasons.push(`기업 목록 일치: ${dir.al}`);
    if (byDomain === dir.e) { r.confidence = 0.98; reasons.push('이메일 도메인도 일치'); }
  } else if (byDomain) {
    r = { industry: byDomain.i, segment: byDomain.s || '', customer: '', confidence: 0.8, source: 'domain' };
    reasons.push(`이메일 도메인 일치: ${domain}`);
    /* 도메인만 맞으면 사례 고객으로 단정하지 않는다(그룹 공용 도메인일 수 있음) — 담당자가 확인 */
    if (byDomain.c) r.maybeCustomer = byDomain.c;
  }

  /* ② 도메인 규칙 */
  if (!r && domain && !FREE_MAIL.test(domain)) {
    for (const [re, i, s, c, why] of DOMAIN_RULES) if (re.test(domain)) {
      r = { industry: i, segment: s, customer: '', confidence: c, source: 'domain_rule' }; reasons.push(why); break;
    }
  }

  /* ③ 키워드 — 회사명이 가장 강하고, 시설 설명·문의 내용은 보조 */
  const kName = kwIndustry(name);
  const kMore = kwIndustry([facility, industryText, memo].join(' '));
  if (kName && (!r || r.confidence < 0.6)) {
    if (!r || r.industry !== kName.ind) r = { industry: kName.ind, segment: '', customer: '', confidence: 0.65, source: 'name_keyword' };
    else r.confidence = Math.max(r.confidence, 0.7);
    reasons.push(`회사명 키워드: ${kName.hit.slice(0, 3).join(', ')}`);
  }
  if (kMore && (!r || r.confidence < 0.5)) {
    r = { industry: kMore.ind, segment: '', customer: '', confidence: 0.45, source: 'text_keyword' };
    reasons.push(`설명 키워드: ${kMore.hit.slice(0, 3).join(', ')}`);
  }

  /* ④ 문의 폼 선택값 */
  const sel = CONTACT_INDUSTRY[String(industryText || '').trim()];
  if (sel && (!r || r.confidence < 0.4)) {
    r = { industry: sel, segment: '', customer: '', confidence: 0.35, source: 'form_select' };
    reasons.push(`문의 폼 산업군: ${industryText}`);
  } else if (sel && r && sel !== r.industry) reasons.push(`참고: 폼 산업군은 「${industryText}」`);

  if (!r) return { industry: '', segment: '', segmentLabel: '', customer: '', confidence: 0, source: 'none', name, reasons: ['추정 근거 없음'] };

  /* 세부 업종 — 비어 있으면 회사명 → 설명 순으로 플레이북 키워드 매칭 */
  if (!r.segment) {
    const sg = segmentOf(r.industry, name) || segmentOf(r.industry, [facility, industryText, memo].join(' '));
    if (sg) { r.segment = sg.key; reasons.push(`세부 업종 키워드: ${sg.hit.slice(0, 2).join(', ')}`); }
  }
  const ind = industryByKey(r.industry);
  return {
    ...r, name,
    industryLabel: ind ? ind.label : '',
    segmentLabel: r.segment ? segLabel(r.industry, r.segment) : '',
    reasons
  };
}

import PLAYBOOKS from './playbooks.data.mjs';
function segLabel(i, s) { const p = PLAYBOOKS[i]; return p && p.segments[s] ? p.segments[s].label : ''; }
