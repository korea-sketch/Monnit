/** 맞춤 제안서 — 산업·과제·센서 지식베이스 (2026-09-17)
 *
 *  서버(매칭·PDF)와 브라우저(신청 화면)가 같은 표를 쓴다.
 *  브라우저용 사본(js/proposal-data.js)은 scripts/proposal-sync.mjs 가 빌드 때 만든다.
 *  ※ 이 파일을 고친 뒤에는 `node scripts/proposal-sync.mjs` 를 한 번 돌리거나 배포하면 된다.
 *
 *  표기 원칙
 *   · 무선 주파수는 940MHz 로 적는다 (국내 사양).
 *   · 사례 수치는 「공개된 사례의 참고치」로만 쓴다. 고객사 효과를 약속하는 문장으로 바꾸지 않는다.
 *   · 제품은 센서 「종류」로만 말한다. 모델번호·단가는 견적 단계에서 담당자가 확정한다.
 */

/* ── 센서 종류 ───────────────────────────────────────────────────── */
export const SENSORS = {
  vib:     { name: '무선 진동·가속도 센서',      use: '모터·펌프·팬·컴프레서의 3축 진동 트렌드로 고장 징후 조기 감지', kw: ['진동', '회전', '예지보전', '가속도'] },
  temp:    { name: '무선 온도 센서',             use: '냉장·냉동·기계실·배관·설비 표면 온도 상시 기록', kw: ['온도'] },
  hum:     { name: '무선 온습도 센서',           use: '보관·공정·전산실 온습도 편차와 결로 위험 감시', kw: ['습도', '온습도', '결로'] },
  cold:    { name: '초저온 온도 센서(프로브형)', use: '-80℃급 딥프리저·LN2 보관설비 온도 이탈 감시', kw: ['초저온', '딥프리저', '냉동고', '백신'] },
  tc:      { name: '열전대(고온) 센서',          use: '오븐·보일러·배기 등 고온 공정 온도 측정', kw: ['오븐', '고온', '보일러', '열교환'] },
  rope:    { name: '물감지 로프 센서',           use: '배관·FCU·항온항습기 하부를 선(line) 단위로 누수 감지', kw: ['누수', 'leak', '배관', '워터'] },
  leak:    { name: '무선 누수 센서(스팟·퍽형)',  use: '바닥·피트·집수정 등 특정 지점의 물 고임 감지', kw: ['누수', '침수', '물'] },
  current: { name: 'AC·3상 전류 센서',           use: '설비 부하·과전류·상 불평형과 가동 상태 감시', kw: ['전류', '전력', '과부하', '부하'] },
  volt:    { name: '전압 감지 센서(정전 감지)',  use: '정전·차단기 트립·전원 이상 즉시 알림', kw: ['정전', '단전', '전압', '전원'] },
  dp:      { name: '차압 센서',                  use: '클린룸·음압실·필터 차압 관리', kw: ['차압', '클린룸', '필터'] },
  aq:      { name: '공기질(PM) 센서',            use: '실내 미세먼지(PM1·PM2.5·PM10) 관리', kw: ['공기질', '미세먼지', '흄'] },
  door:    { name: '개폐(도어) 센서',            use: '냉장고·출입문·랙 도어 열림 방치와 출입 이력', kw: ['도어', '개폐', '출입', '침입'] },
  motion:  { name: '모션·점유 센서',             use: '무인 시간대 침입·공간 점유율 파악', kw: ['점유', '모션', '침입'] },
  press:   { name: '압력 센서',                  use: '배관·유체 라인 압력 변화와 수격 감시', kw: ['압력', '수격'] },
  level:   { name: '초음파 거리(수위) 센서',     use: '탱크·집수정·침출수 레벨 원격 측정', kw: ['레벨', '수위', '탱크', '침출수'] },
  analog:  { name: '4~20mA 아날로그 입력',       use: '기존 계측기·가스검지기 출력을 무선으로 수집', kw: ['4~20mA', '계측', '가스'] },
  soil:    { name: '토양 수분 센서',             use: '토양 수분장력·온도로 관개 최적화', kw: ['토양', '관개'] },
  co2:     { name: '이산화탄소(CO2) 센서',       use: '재실 밀도·환기 상태와 사육·재배 환경 관리', kw: ['CO2', '이산화탄소', '환기'] },
  co:      { name: '일산화탄소(CO) 센서',        use: '주차장·보일러실·연소 설비 주변 CO 농도 감시', kw: ['일산화탄소', 'CO'] },
  h2s:     { name: '황화수소(H2S) 센서',         use: '하수·폐수·축산 시설의 유해가스 감시', kw: ['황화수소', 'H2S', '유해가스'] },
  dry:     { name: '드라이컨택 입력',            use: '기존 설비의 경보·가동 신호(접점)를 무선으로 수집', kw: ['접점', '경보 신호', '가동 신호'] },
  pulse:   { name: '펄스 카운터',                use: '전력·수도·가스 계량기 펄스로 사용량 자동 집계', kw: ['계량', '펄스', '사용량'] },
  airflow: { name: '풍속(기류) 센서',            use: '급배기·음압실·후드의 기류 확인', kw: ['기류', '풍속', '환기'] },
  light:   { name: '조도 센서',                  use: '조명 사용·광 민감 자산·작물 광량 관리', kw: ['조도', '조명', '광량'] },
  button:  { name: '호출 버튼',                  use: '응급 호출·점검 완료 확인을 버튼 한 번으로', kw: ['호출', '버튼'] }
};

export const PLATFORM = [
  { name: 'ALTA 무선 게이트웨이 (940MHz)', use: '센서 데이터를 모아 LTE·이더넷으로 전송. 배선 공사 없이 설치' },
  { name: 'iMonnit 관제 플랫폼',            use: '실시간 대시보드, 임계값 알림(문자·이메일·앱), 이력 보고서' },
  { name: 'Modbus·SCADA 연동 (선택)',       use: 'ALTA 시리얼 Modbus 게이트웨이(RS-485/RS-232, Modbus RTU)로 BAS·DDC·SCADA에 연결' }
];

/* 자동화 단계에서 쓰는 구성 요소 — 로드맵 표에 이름으로만 등장한다 */
export const AUTOMATION_KIT = {
  alert:   { name: 'iMonnit 알림 규칙',        use: '임계값·지속시간·에스컬레이션(1차 담당 → 2차 관리자)' },
  local:   { name: '로컬 경보기',              use: '인터넷이 끊겨도 현장에서 소리·빛으로 경보' },
  control: { name: '컨트롤 유닛',              use: '임계 조건에서 팬·펌프·밸브 등 장비 자동 On/Off' },
  webhook: { name: '웹훅·API 연동',            use: 'CMMS 작업지시·메신저·자체 시스템으로 이벤트 전달' },
  modbus:  { name: 'Modbus 게이트웨이',        use: 'BAS·DDC·SCADA·PLC에 센서값을 레지스터로 제공' },
  onprem:  { name: '온프레미스·Monnit Mine',   use: '폐쇄망·자체 서버에서 데이터 보관·연동' },
  report:  { name: '자동 보고서',              use: '일·주·월·분기 이력 보고서와 감사용 기록 자동 발행' }
};

/* ── 과제(문제) 사전 ─────────────────────────────────────────────── */
export const PROBLEMS = {
  downtime:     { label: '회전설비 돌발 고장·비계획 정지',   desc: '모터·펌프·팬이 멈춘 뒤에야 알게 되어 생산·운영 손실이 커집니다', sensors: ['vib', 'current', 'temp'], kw: ['비계획 정지', '다운타임', '고장', '예지보전', '회전'] },
  rounds:       { label: '수기 순회점검·기록 부담',          desc: '사람이 돌며 적는 점검은 야간·휴일에 공백이 생기고 기록이 누락됩니다', sensors: ['temp', 'vib', 'current'], kw: ['수기', '순회', '순찰', '인력', '점검'] },
  wiring:       { label: '유선 센서 배선 공사비·공기 부담',  desc: '배관·방폭·운영 중 구역은 배선 공사가 어렵고 비용이 급증합니다', sensors: [], kw: ['유선', '배선', '공사비', '방폭', '투자비'] },
  leak:         { label: '배관·설비 누수 늦은 발견',        desc: '누수가 아래층·장비로 번진 뒤에야 인지되어 2차 피해가 커집니다', sensors: ['rope', 'leak'], kw: ['누수', 'leak', '침수', '배관'] },
  flood:        { label: '집중호우·침수 대응',               desc: '지하 기계실·주차장·피트의 침수를 초기에 알기 어렵습니다', sensors: ['leak', 'level'], kw: ['침수', '수위', '집수정'] },
  freeze:       { label: '겨울철 동파',                      desc: '공실·외기 노출 배관이 얼어 터진 뒤에야 발견됩니다', sensors: ['temp', 'rope'], kw: ['동파', '동결', '한파'] },
  elec_fire:    { label: '전기화재·과부하 위험',             desc: '분전반·배전반 과열과 과부하를 사전에 파악하기 어렵습니다', sensors: ['temp', 'current'], kw: ['화재', '과부하', '배전반', '전력'] },
  power_out:    { label: '정전·전원 차단 인지 지연',         desc: '차단기 트립이나 정전을 늦게 알아 냉장·서버·설비가 멈춥니다', sensors: ['volt', 'current'], kw: ['정전', '단전', '전원'] },
  env_quality:  { label: '공정·보관 환경(온습도) 이탈',      desc: '온습도 편차가 품질 불량·자재 부식·결로로 이어집니다', sensors: ['hum', 'temp'], kw: ['온습도', '습도', '품질', '결로', '편차'] },
  cleanroom:    { label: '클린룸·실험실 차압 관리',          desc: '차압·온습도 기준 이탈을 실시간으로 확인하기 어렵습니다', sensors: ['dp', 'hum'], kw: ['차압', '클린룸', '연구실', '실험실'] },
  cold_storage: { label: '냉장·냉동 설비 온도 이탈',         desc: '야간·주말 냉동기 고장으로 재고·시료를 폐기하게 됩니다', sensors: ['temp', 'door', 'current'], kw: ['냉장', '냉동', '콜드체인', '폐기', '온도'] },
  ultracold:    { label: '초저온 보관설비(딥프리저) 이탈',   desc: '-80℃ 보관 시료·백신의 온도 이탈을 즉시 알기 어렵습니다', sensors: ['cold', 'volt'], kw: ['초저온', '백신', '시료', '바이오'] },
  record:       { label: '규정·감사용 온도 기록(HACCP·GMP)', desc: '수기 기록은 누락·위변조 우려가 있고 감사 대응에 시간이 듭니다', sensors: ['temp', 'hum'], kw: ['HACCP', 'GMP', '기록', '추적성', '규정'] },
  door_open:    { label: '문 열림 방치·출입 이력 부재',      desc: '냉장고·창고·전산실 문 열림을 늦게 알아 손실과 보안 공백이 생깁니다', sensors: ['door', 'motion'], kw: ['도어', '개폐', '출입', '접근'] },
  hotspot:      { label: '서버랙 핫스팟·냉방 불균형',        desc: '랙 단위 온도 편차가 장비 수명과 장애로 이어집니다', sensors: ['temp', 'hum', 'dp'], kw: ['랙', '핫스팟', '쿨링', '서버'] },
  energy:       { label: '냉난방·설비 에너지 과다',          desc: '어디서 전력이 새는지 모르니 절감 방안을 세우기 어렵습니다', sensors: ['current', 'temp'], kw: ['에너지', '전력', 'PUE', 'HVAC', '효율'] },
  multi_site:   { label: '다수 현장·점포 원격 통합 관리',    desc: '현장마다 따로 보는 방식이라 전체 상황을 한눈에 볼 수 없습니다', sensors: ['temp', 'volt'], kw: ['다점포', '매장', '분산', '통합', '원격'] },
  integration:  { label: '기존 BAS·SCADA와 따로 노는 데이터', desc: '시스템이 흩어져 있어 통합 관제와 분석이 되지 않습니다', sensors: ['analog'], kw: ['SCADA', '통합', '단일 플랫폼', '연동', 'BAS'] },
  gas:          { label: '가스·유체 누설 위험',              desc: '넓은 부지의 누설을 사람이 돌며 확인해 사고 위험이 남습니다', sensors: ['analog', 'press'], kw: ['가스', '누설', '유해'] },
  unmanned:     { label: '무인·야간 시간대 감시 공백',       desc: '사람이 없는 시간에 생긴 이상을 다음 날에야 발견합니다', sensors: ['temp', 'leak', 'door', 'volt'], kw: ['무인', '야간', '순찰', '24/7', '원격'] },
  iaq:          { label: '실내 공기질·재실 환경 민원',       desc: '공기질·온도 민원이 잦지만 근거 데이터가 없습니다', sensors: ['aq', 'hum'], kw: ['공기질', '임차인', '민원', '재실'] },
  tank_level:   { label: '탱크·집수정 레벨 수기 확인',       desc: '레벨을 직접 보러 가야 해 월류·고갈을 놓칩니다', sensors: ['level', 'press'], kw: ['탱크', '레벨', '침출수', '수위'] },
  structure:    { label: '구조물·건설 현장 안전 계측',       desc: '기울기·진동·환경 변화를 상시로 보기 어렵습니다', sensors: ['vib', 'temp'], kw: ['구조', '건설', '계측', '안전'] },
  water_temp:   { label: '수온·양식 환경 급변',              desc: '수온·정전 사고가 생물 폐사로 바로 이어집니다', sensors: ['temp', 'volt'], kw: ['수온', '양식', '폐사'] },
  curing:       { label: '콘크리트 양생·동절기 보온 관리',   desc: '양생 온도를 사람이 재러 다녀야 하고 기록이 남지 않습니다', sensors: ['temp', 'hum'], kw: ['양생', '콘크리트', '보온'] },
  toxic_gas:    { label: '유해가스(CO·H2S) 노출 위험',       desc: '밀폐 공간·지하 시설의 가스 농도를 상시로 모릅니다', sensors: ['co', 'h2s', 'co2'], kw: ['유해가스', '일산화탄소', '황화수소', '밀폐'] },
  emergency:    { label: '응급 호출·고립 사고 대응',         desc: '혼자 있는 공간에서 쓰러지거나 갇히면 알릴 방법이 없습니다', sensors: ['button', 'motion'], kw: ['호출', '응급', '고립', '낙상'] },
  occupancy:    { label: '공간 사용률·빈 공간 에너지 낭비',  desc: '사람이 없는데 냉난방·조명이 켜져 있습니다', sensors: ['motion', 'co2', 'current'], kw: ['점유', '재실', '공실', '사용률'] },
  meter:        { label: '전력·수도·가스 사용량 수기 검침',  desc: '검침표를 사람이 적어 월말에야 이상 사용을 압니다', sensors: ['pulse', 'current'], kw: ['검침', '계량', '사용량'] },
  legacy_alarm: { label: '기존 설비 경보가 현장에서만 울림', desc: '수신반·제어반 경보를 사람이 옆에 있어야 압니다', sensors: ['dry', 'analog'], kw: ['경보', '수신반', '제어반', '접점'] }
};

/* ── 원하는 도입 효과 ────────────────────────────────────────────── */
export const GOALS = {
  downtime:    { label: '비계획 정지 줄이기',        kw: ['비계획 정지', '다운타임', '가동률', 'MTBF', '고장', '사전 예측'] },
  labor:       { label: '점검 인력·시간 줄이기',      kw: ['점검', '순찰', '인력', '수동', '수기', '기록 시간'] },
  loss:        { label: '사고 피해·폐기 손실 줄이기', kw: ['손실', '폐기', '피해', '장비 손실', '누수', '사고'] },
  response:    { label: '이상 발생 시 대응 시간 단축', kw: ['대응 시간', '인지 시간', '감지 시간', '즉시', '분 단위'] },
  energy:      { label: '에너지·운영비 절감',         kw: ['에너지', '운영 비용', '쿨링 효율', 'HVAC 효율', 'PUE', 'ROI', '효율'] },
  compliance:  { label: '규정·감사 기록 자동화',      kw: ['HACCP', '추적성', 'GMP', '기록', '규정', 'ISO'] },
  integration: { label: '흩어진 시스템 통합 관제',    kw: ['통합', '단일 플랫폼', 'SCADA', '연동', '가시화'] },
  capex:       { label: '구축비 절감(무선 전환)',      kw: ['투자비', '유선', '구축 비용', '1/30'] },
  safety:      { label: '안전·화재 사고 예방',        kw: ['안전', '화재', '가스', '방폭', '중대재해'] }
};

/* ── 산업 ────────────────────────────────────────────────────────── */
export const INDUSTRIES = [
  { key: 'manufacturing', label: '제조·생산 공장', icon: '🏭', short: '제조',
    hero: '라인이 멈추기 전에, 설비가 먼저 말하게',
    problems: ['downtime', 'rounds', 'wiring', 'env_quality', 'elec_fire', 'leak', 'integration', 'energy', 'legacy_alarm', 'toxic_gas', 'meter'],
    goals: ['downtime', 'labor', 'response', 'integration'],
    adj: ['energy', 'bio_pharma'], doc: 'factory-predictive-maintenance' },
  { key: 'bio_pharma', label: '제약·바이오·연구소', icon: '🧬', short: '바이오',
    hero: '시료와 배치를 지키는 24시간 환경 기록',
    problems: ['ultracold', 'cold_storage', 'record', 'cleanroom', 'downtime', 'leak', 'unmanned', 'power_out', 'legacy_alarm', 'env_quality'],
    goals: ['loss', 'compliance', 'response', 'integration'],
    adj: ['manufacturing', 'edu_med'], doc: 'bio-pharma-utility-monitoring' },
  { key: 'datacenter', label: '데이터센터·전산실', icon: '🖥️', short: 'IDC',
    hero: '장애는 환경에서 시작됩니다',
    problems: ['hotspot', 'leak', 'power_out', 'energy', 'door_open', 'elec_fire', 'unmanned', 'integration', 'legacy_alarm'],
    goals: ['response', 'loss', 'energy', 'integration'],
    adj: ['building_fm'], doc: 'data-center-monitoring' },
  { key: 'building_fm', label: '빌딩·복합시설 FM', icon: '🏢', short: '빌딩',
    hero: '민원이 오기 전에 먼저 아는 시설관리',
    problems: ['leak', 'rounds', 'freeze', 'flood', 'elec_fire', 'energy', 'iaq', 'integration', 'legacy_alarm', 'occupancy', 'toxic_gas', 'meter'],
    goals: ['labor', 'loss', 'energy', 'capex'],
    adj: ['residential', 'datacenter', 'public'], doc: 'smart-facility-management' },
  { key: 'energy', label: '에너지·발전·수처리', icon: '⚡', short: '에너지',
    hero: '분산된 플랜트 자산을 한 화면으로',
    problems: ['downtime', 'gas', 'tank_level', 'rounds', 'wiring', 'integration', 'energy', 'unmanned', 'toxic_gas', 'legacy_alarm', 'meter'],
    goals: ['downtime', 'safety', 'labor', 'integration'],
    adj: ['manufacturing', 'public'], doc: 'energy-ups-ess' },
  { key: 'cold_chain', label: '유통·콜드체인·물류', icon: '🧊', short: '콜드체인',
    hero: '밤사이 꺼진 냉동기, 아침엔 늦습니다',
    problems: ['cold_storage', 'record', 'door_open', 'multi_site', 'downtime', 'power_out', 'leak', 'energy', 'elec_fire'],
    goals: ['loss', 'compliance', 'response', 'labor'],
    adj: ['food_agri', 'building_fm'], doc: 'cold-chain-logistics' },
  { key: 'public', label: '공공·국방·인프라', icon: '🛡️', short: '공공',
    hero: '순찰 대신 상시 감시로',
    problems: ['unmanned', 'rounds', 'flood', 'power_out', 'door_open', 'downtime', 'tank_level', 'elec_fire', 'iaq', 'toxic_gas'],
    goals: ['labor', 'response', 'safety', 'integration'],
    adj: ['building_fm', 'energy'], doc: 'public-defense-facility' },
  { key: 'edu_med', label: '병원·학교·복지시설', icon: '🏥', short: '병원·학교',
    hero: '사람을 돌보는 공간의 보이지 않는 안전망',
    problems: ['cold_storage', 'unmanned', 'leak', 'elec_fire', 'iaq', 'freeze', 'record', 'power_out', 'emergency', 'cleanroom'],
    goals: ['safety', 'loss', 'labor', 'compliance'],
    adj: ['bio_pharma', 'building_fm', 'public'], doc: 'school-church-public' },
  { key: 'food_agri', label: '식품·외식·농수산', icon: '🌾', short: '식품·농수산',
    hero: '온도 한 번의 이탈이 한 해 농사를 좌우합니다',
    problems: ['cold_storage', 'record', 'water_temp', 'power_out', 'env_quality', 'multi_site', 'downtime', 'door_open', 'toxic_gas', 'meter'],
    goals: ['loss', 'compliance', 'response', 'labor'],
    adj: ['cold_chain', 'manufacturing'], doc: 'retail-store-foodservice' },
  { key: 'construction', label: '건설·현장', icon: '🏗️', short: '건설',
    hero: '공정은 매일 바뀌어도 안전 기록은 끊기지 않게',
    problems: ['curing', 'elec_fire', 'structure', 'flood', 'door_open', 'toxic_gas', 'rounds', 'power_out'],
    goals: ['safety', 'labor', 'response', 'compliance'],
    adj: ['building_fm', 'energy'], doc: 'construction-shm' },
  { key: 'general', label: '그 외 시설', icon: '🧩', short: '시설',
    hero: '사람이 없는 시간에도 시설이 먼저 알려줍니다',
    problems: ['leak', 'elec_fire', 'unmanned', 'freeze', 'cold_storage', 'power_out', 'legacy_alarm', 'energy'],
    goals: ['loss', 'labor', 'safety', 'response'],
    adj: ['building_fm', 'residential'], doc: 'smart-facility-management' },
  { key: 'residential', label: '주거·호텔·숙박', icon: '🏨', short: '주거·숙박',
    hero: '객실 물넘침, 공실 동파를 먼저 알림으로',
    problems: ['leak', 'freeze', 'unmanned', 'elec_fire', 'flood', 'rounds', 'energy', 'iaq', 'toxic_gas', 'emergency', 'occupancy'],
    goals: ['loss', 'labor', 'response', 'safety'],
    adj: ['building_fm'], doc: 'hotel-resort-monitoring' }
];

/* 시트 Cases 의 key → 산업 (여러 개 가능). 새 사례가 여기에 없으면 industry 글자로 추정한다. */
export const CASE_INDUSTRY = {
  'samsung-biologics': ['bio_pharma', 'manufacturing'],
  'veolia': ['energy'],
  'samsung': ['manufacturing'],
  'microsoft': ['datacenter'],
  'hyundai-motors': ['manufacturing'],
  'hdc-labs': ['building_fm', 'residential'],
  'us-army': ['public'],
  'gs-eps': ['energy'],
  'walmart': ['cold_chain'],
  'cbre': ['building_fm'],
  'exxonmobil': ['energy', 'manufacturing'],
  'sk-ecoplant': ['construction', 'energy'],
  'hyundai-enc': ['construction', 'building_fm'],
  'hyundai-engineering': ['construction', 'energy'],
  'hoban': ['building_fm', 'residential'],
  'seantex': ['building_fm', 'cold_chain'],
  'emart': ['cold_chain'],
  'hanwha-snc': ['datacenter'],
  'samchully': ['energy'],
  'lx': ['energy'],
  'hyu-guri-hospital': ['edu_med'],
  'cj-feedncare': ['food_agri'],
  'aquafarm': ['food_agri'],
  'gangnam': ['public'],
  'keco': ['public', 'energy'],
  'shinhan-univ': ['edu_med'],
  'songhyun-elem': ['edu_med']
};

/* 모넷 글로벌 본사 레퍼런스 — 제안서에 「Monnit 글로벌 사례」로 구분해 적는다 */
export const GLOBAL_CASES = ['microsoft', 'walmart', 'us-army', 'exxonmobil', 'cbre'];

const INDUSTRY_TEXT = [
  [/바이오|제약|의약/, 'bio_pharma'], [/데이터|IT/, 'datacenter'], [/건설|부동산|빌딩/, 'building_fm'],
  [/에너지|발전|전력|수처리/, 'energy'], [/유통|리테일|물류|콜드/, 'cold_chain'], [/국방|공공|방위/, 'public'],
  [/의료|병원|교육|학교/, 'edu_med'], [/외식|식품|농|양식/, 'food_agri'], [/호텔|숙박|주거/, 'residential'],
  [/제조|반도체|자동차/, 'manufacturing']
];
export function industriesOfCase(key, industryText) {
  if (CASE_INDUSTRY[key]) return CASE_INDUSTRY[key];
  for (const [re, k] of INDUSTRY_TEXT) if (re.test(String(industryText || ''))) return [k];
  return [];
}

export const SCALES = ['1개소 · 감시 포인트 20개 이하', '1개소 · 20~100개', '2~5개소 · 100~300개', '6개소 이상 · 300개 이상', '아직 모름'];
export const TIMELINES = ['1개월 이내', '3개월 이내', '올해 안', '정보 수집 단계'];

export const industryByKey = k => INDUSTRIES.find(i => i.key === k) || null;

/* ── 홈 「솔루션 파인더」 선택값 → 제안서 입력 (2026-09-17) ───────────────
   index.html 의 finder.config (fac·con·scale) id 를 그대로 받는다. */
export const FINDER_FAC = {
  factory: 'manufacturing', logistics: 'cold_chain', food: 'food_agri', pharma: 'bio_pharma',
  datacenter: 'datacenter', commercial: 'building_fm', resident: 'residential', public: 'public',
  agri: 'food_agri', energy: 'energy', construction: 'construction', etc: 'general'
};
/* 파인더 시설이 곧 세부 업종 힌트가 되는 경우 */
export const FINDER_SEGMENT = { food: 'restaurant', agri: 'greenhouse', logistics: 'warehouse', commercial: 'office', resident: 'apartment' };
/* 고민 → 과제 후보(앞쪽 우선). 산업 과제 목록에 있는 것을 먼저 고른다 */
export const FINDER_CON = {
  fire:     { problems: ['elec_fire', 'legacy_alarm'], goals: ['safety', 'response'] },
  leak:     { problems: ['leak', 'flood', 'freeze'], goals: ['loss', 'response'] },
  temp:     { problems: ['env_quality', 'hotspot', 'cleanroom', 'curing', 'water_temp'], goals: ['loss', 'compliance'] },
  cold:     { problems: ['cold_storage', 'ultracold'], goals: ['loss', 'compliance'] },
  equip:    { problems: ['downtime', 'rounds'], goals: ['downtime', 'labor'] },
  power:    { problems: ['energy', 'meter', 'power_out'], goals: ['energy'] },
  air:      { problems: ['iaq', 'toxic_gas', 'cleanroom'], goals: ['safety'] },
  security: { problems: ['door_open', 'unmanned'], goals: ['safety', 'response'] },
  control:  { problems: ['integration', 'unmanned', 'multi_site'], goals: ['integration', 'labor'] },
  comply:   { problems: ['record'], goals: ['compliance'] }
};
export const FINDER_SCALE = { s: '1개소 · 감시 포인트 20개 이하', m: '1개소 · 20~100개', l: '2~5개소 · 100~300개' };

export function fromFinder({ fac, con, scale } = {}) {
  const industry = FINDER_FAC[fac] || '';
  const ind = industryByKey(industry);
  const c = FINDER_CON[con];
  let problems = [], goals = [];
  if (c) {
    const inList = c.problems.filter(p => ind && ind.problems.includes(p));
    problems = (inList.length ? inList : c.problems).slice(0, 2);
    goals = c.goals.slice();
  }
  return { industry, segment: FINDER_SEGMENT[fac] || '', problems, goals, scale: FINDER_SCALE[scale] || '' };
}

/* 사용자 입력 키로 찾는 사전 — Object 기본 속성(constructor·__proto__ 등)이 「있는 과제」로 잡히지 않게
   프로토타입을 끊는다. (예: problems=['constructor'] 가 들어오면 PROBLEMS.constructor.kw 에서 500 이 났다) */
for (const o of [SENSORS, AUTOMATION_KIT, PROBLEMS, GOALS, CASE_INDUSTRY, FINDER_FAC, FINDER_SEGMENT, FINDER_CON, FINDER_SCALE]) Object.setPrototypeOf(o, null);
