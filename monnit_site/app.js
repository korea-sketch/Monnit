/* ============================================================
   ========== 상담/문의 폼 수신 설정 (FORM DELIVERY) ==========
   ▼ 여기 이메일 한 줄만 바꾸면, 모든 상담신청·구독·백서신청이
     해당 이메일로 실제 발송됩니다. (별도 서버/가입 불필요)

   처음 한 번만: 사이트에서 폼을 한 번 제출하면 FormSubmit이
   아래 주소로 "활성화 확인" 메일을 보냅니다. 그 메일의 링크를
   한 번 클릭하면 이후 모든 접수 메일이 정상 수신됩니다.
   (대안: Web3Forms 등으로 교체 가능)
   ============================================================ */
const CONTACT_EMAIL = "korea@monnit.com";   // ← 수신 이메일 주소

/* ★★ 무제한·무료 방식: Google Apps Script (문의가 구글 시트에 저장 + 메일 발송)
   설정: 가이드 참고 → 스크립트 배포 후 받은 /exec 주소를 아래에 붙여넣기 (이 한 줄만). */
const GAS_ENDPOINT = "";   // 예: "https://script.google.com/macros/s/AKfy.../exec"

/* ★ 추천 대안: 엔드포인트 방식 (Static Forms · Splitforms · Formspree · Basin · Getform 등)
   각 서비스 가입 후 발급받은 "폼 엔드포인트 URL" 을 아래에 붙여넣기 (이 한 줄만). 활성화 클릭·OAuth 불필요. */
const FORM_POST_URL = "";  // 예: "https://formspree.io/f/xxxx" / "https://api.staticforms.dev/submit/xxxx"

/* (대안) Web3Forms — 월 250건 무료. web3forms.com 에서 키 발급 후 붙여넣기 */
const WEB3FORMS_KEY = "e4d5cb03-1b25-425c-a47d-f04e4a05e7e2";

/* (대안) FormSubmit — 무제한 무료. 단, 최초 1회 활성화 메일 클릭 필요 */
const FORM_ENDPOINT = "https://formsubmit.co/ajax/" + encodeURIComponent(CONTACT_EMAIL);

/* 폼 데이터를 실제로 전송하는 공통 함수 (AJAX — 페이지 이동 없음)
   반환값: true(서버 전송 성공) / 'mailto'(메일 앱으로 작성) / false(실패) */
function buildMailto(payload){
  const subject = payload._subject || '모닛코리아 웹사이트 문의';
  const skip = ['_subject','_url','_captcha','_template'];
  const lines = Object.keys(payload).filter(k => skip.indexOf(k)<0).map(k => k + ': ' + payload[k]);
  const body = lines.join('\n');
  return 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}
async function sendLead(payload, btn){
  const prevText = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.dataset._t = prevText; btn.textContent = '전송 중…'; }
  const restore = () => { if (btn){ btn.disabled = false; btn.textContent = btn.dataset._t || prevText; } };
  const mailto = () => { restore(); try { window.location.href = buildMailto(payload); } catch(e){} return 'mailto'; };
  try {
    // 1) Google Apps Script (시트 저장 + 메일)
    if (GAS_ENDPOINT) {
      try {
        await fetch(GAS_ENDPOINT, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) });
        restore(); return true;
      } catch(e){ return mailto(); }
    }
    // 2) 범용 엔드포인트 (Static Forms · Splitforms · Formspree · Basin · Getform)
    if (FORM_POST_URL) {
      const res = await fetch(FORM_POST_URL, { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(Object.assign({ subject: payload._subject || '모닛코리아 웹사이트 접수' }, payload)) });
      let ok = res.ok; try { const j = await res.json(); if (j && (j.success===false || j.ok===false || j.error)) ok = false; } catch(e){}
      return ok ? (restore(), true) : mailto();
    }
    // 3) Web3Forms
    if (WEB3FORMS_KEY) {
      const res = await fetch("https://api.web3forms.com/submit", { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(Object.assign({ access_key: WEB3FORMS_KEY, subject: payload._subject || '모닛코리아 웹사이트 접수', from_name:'Monnit Korea 웹사이트', replyto: payload['이메일'] || payload.email || '', botcheck:false }, payload)) });
      let ok = res.ok; try { const j = await res.json(); ok = ok && (j.success===true || j.success==='true'); } catch(e){}
      return ok ? (restore(), true) : mailto();
    }
    // 4) 설정된 백엔드가 없으면 → 방문자 메일 앱으로 작성 (FormSubmit 다운 대비 안전장치)
    return mailto();
  } catch (err) {
    return mailto();
  }
}

/* ========== DATA ========== */
const INDUSTRIES = {
  mfg:    { label: '제조 · 산업',      tag: 'tag-mfg' },
  it:     { label: 'IT · 데이터센터',  tag: 'tag-it' },
  auto:   { label: '자동차 · 운송',    tag: 'tag-auto' },
  energy: { label: '에너지',          tag: 'tag-energy' },
  bio:    { label: '의료 · 바이오',    tag: 'tag-bio' },
  retail: { label: '유통 · 소비재',    tag: 'tag-retail' },
  food:   { label: '외식',            tag: 'tag-food' },
  bldg:   { label: '건설 · 부동산',    tag: 'tag-bldg' },
  edu:    { label: '교육',            tag: 'tag-edu' },
  hotel:  { label: '호텔 · 숙박',      tag: 'tag-hotel' },
  pub:    { label: '공공 · 비영리',    tag: 'tag-pub' },
  defense:{ label: '국방 · 방위',      tag: 'tag-defense' },
  power:  { label: '발전 · 전력',      tag: 'tag-power' }
};

/* NOTE: CUSTOMERS / AWARDS / PARTNERS 아래 데이터는 "기본값(fallback)"입니다.
   구글 시트가 연결되면(아래 CONTENT_SHEET 설정) 시트 내용으로 자동 교체됩니다.
   시트를 못 읽어도 사이트는 이 기본값으로 정상 동작합니다. */
let CUSTOMERS = [
  // === Defense / Power (대표 고객사) ===
  { n:"US Army", i:"defense", h:"군 부대 핵심 전략 자산 모니터링",
    a:["전략 자산 상태 모니터링","탄약·물자 보관 환경 관리","발전기·동력설비 예지보전","연료 저장 탱크 관리","시설 누수·침입 감지","원격 통합 관제"] },
  { n:"GS EPS", i:"power", h:"복합화력 발전 설비 통합 감시",
    a:["터빈·발전기 진동 예지보전","보일러·열교환기 상태 진단","변압기·배전반 모니터링","연료·윤활유 누설 감지","발전 효율·전력 분석","원격 SCADA 연동"] },

  // === Manufacturing ===
  { n:"3M", i:"mfg", h:"공장 설비 예지보전 솔루션",
    a:["공장 설비 예지보전","클린 생산환경 관리","자재 창고 온습도","에너지 소비 모니터링","누수 감지 알림","HVAC 효율 관리"] },
  { n:"Alcoa", i:"mfg", h:"제련 라인 통합 모니터링",
    a:["제련로 가동 모니터링","전력 부하 관리","설비 진동 예지보전","작업장 안전 환경","원자재 창고 관리","에너지 최적화"] },
  { n:"Siemens", i:"mfg", h:"산업 자동화 환경 관리",
    a:["산업 설비 가동 모니터링","생산라인 환경 관리","에너지 자산 관리","시설 누수 감지","접근 통제","사무실 IEQ"] },
  { n:"Square D", i:"mfg", h:"전력 인프라 상태 관리",
    a:["분전반 상태 모니터링","전력 부하 관리","시설 누수 감지","변압기 운영 관리","에너지 사용 분석","원격 알림"] },
  { n:"GE", i:"mfg", h:"발전·항공 설비 예지보전",
    a:["발전 설비 예지보전","항공 부품 공장 환경 관리","터빈 상태 모니터링","자산 추적","에너지 관리","안전 통합 모니터링"] },
  { n:"Eaton", i:"mfg", h:"전력 자산 관리 솔루션",
    a:["전력 자산 관리","UPS·배전반 모니터링","데이터센터 환경","시설 누수 감지","부하 분석","원격 진단"] },
  { n:"Parker", i:"mfg", h:"유공압 시스템 상태 모니터링",
    a:["유공압 시스템 상태 모니터링","제조 설비 예지보전","필터 교체 주기 관리","압축기 운영","누설 감지","에너지 효율"] },
  { n:"Tyco", i:"mfg", h:"시설 보안·환경 통합 관리",
    a:["시설 보안·환경 통합 관리","소방 시스템 연계","누수 감지","도어 접근 통제","자산 추적","원격 알림"] },
  { n:"AO Smith", i:"mfg", h:"생산라인 품질 환경 관리",
    a:["생산라인 품질 환경 관리","보일러 가동 모니터링","창고 온습도","에너지 사용량 분석","누수 감지","출하 환경 관리"] },
  { n:"Steelcase", i:"mfg", h:"공장·창고 환경 관리",
    a:["공장 환경 관리","자재 창고 운영","사무실 점유율 분석","에너지 효율","도어 모니터링","생산설비 가동률"] },
  { n:"Mitsubishi", i:"mfg", h:"산업 설비 가동 모니터링",
    a:["산업 설비 가동 모니터링","공장 환경 관리","자재 창고 운영","에너지 자산 관리","시설 누수 감지","안전 환경 통합"] },
  { n:"Lexmark", i:"mfg", h:"클린 생산환경 관리",
    a:["클린 생산환경 관리","부품 보관 환경","설비 예지보전","창고 자산 추적","에너지 모니터링","시설 누수 감지"] },
  { n:"Fender", i:"mfg", h:"악기 제작 자재 보관 관리",
    a:["목재 보관 창고 환경 관리","도장 부스 환경","완제품 보관","공장 IEQ","자재 추적","에너지 모니터링"] },
  { n:"Weider", i:"mfg", h:"생산·창고 환경 관리",
    a:["생산시설 환경 관리","원료 보관 온습도","창고 자산 관리","출하 콜드체인","에너지 모니터링","HACCP 자동 기록"] },
  { n:"Rocket Industrial", i:"mfg", h:"산업 포장재 창고 관리",
    a:["포장 자재 창고 환경 관리","출하 콜드체인","자산 추적","설비 모니터링","시설 누수 감지","에너지 효율"] },

  // === IT / Semiconductor / Telecom ===
  { n:"Intel", i:"it", h:"반도체 팹·서버 통합 모니터링",
    a:["클린룸 환경 관리","서버룸 모니터링","진동 기반 설비 보호","클린 가스 배관","누수 감지","에너지 최적화"] },
  { n:"Microsoft", i:"it", h:"데이터센터 통합 모니터링",
    a:["데이터센터 환경 관리","서버 랙 운영","누수 조기 감지","전력 사용 최적화","도어 접근 통제","HVAC 효율"] },
  { n:"Amazon", i:"it", h:"물류·데이터센터 환경 관리",
    a:["물류센터 콜드체인","데이터센터 환경 관리","창고 자산 추적","도어 모니터링","에너지 관리","안전 환경"] },
  { n:"AT&T", i:"it", h:"통신 인프라 원격 모니터링",
    a:["통신 기지국 원격 모니터링","서버실 환경 관리","백업 배터리 운영","도어 접근 통제","누수 감지","전력 부하 관리"] },
  { n:"Samsung Electronics", i:"it", h:"반도체 팹 환경 관리",
    a:["반도체 팹 환경 관리","클린룸 파티클 모니터링","클린 가스 시스템","진동 모니터링","누수 감지","에너지 최적화"] },
  { n:"Shutterstock", i:"it", h:"데이터센터 운영 모니터링",
    a:["데이터센터 서버실 환경 관리","백업 시스템 모니터링","전력 부하","누수 감지","도어 접근","HVAC 효율"] },

  // === Automotive / Logistics ===
  { n:"Hyundai Motors", i:"auto", h:"자동차 공장 설비 예지보전",
    a:["자동차 공장 설비 예지보전","도장 부스 환경 관리","자재 창고 운영","에너지 자산 관리","안전 환경 통합","도어 모니터링"] },
  { n:"Volvo", i:"auto", h:"공장·물류 환경 관리",
    a:["공장 설비 가동 모니터링","도장·용접 라인 환경 관리","부품 창고 운영","에너지 효율","누수 감지","출하 환경"] },
  { n:"FedEx", i:"auto", h:"콜드체인 물류 관리",
    a:["콜드체인 물류 추적","창고 환경 관리","차량 컨테이너 모니터링","자산 추적","도어 개폐 관리","안전 환경"] },

  // === Energy ===
  { n:"ExxonMobil", i:"energy", h:"정유 플랜트 통합 모니터링",
    a:["정유 설비 상태 모니터링","탱크 레벨·자산 관리","누설 조기 감지","펌프·압축기 예지보전","안전 환경 통합","자산 원격 관리"] },
  { n:"Shell", i:"energy", h:"석유 시설 자산 관리",
    a:["석유 시설 자산 관리","탱크 레벨 모니터링","가스 누설 감지","펌프 예지보전","안전 환경","원격 운영"] },
  { n:"Aramco", i:"energy", h:"플랜트 통합 모니터링",
    a:["플랜트 설비 모니터링","가스·유체 누설 감지","압력·온도 자산 관리","안전 환경 통합","원격 자산 운영","에너지 효율"] },
  { n:"PTT", i:"energy", h:"에너지 인프라 모니터링",
    a:["에너지 인프라 모니터링","가스 시설 자산 관리","누설 감지","안전 환경 통합","원격 시설 운영","에너지 효율"] },
  { n:"ENGIE", i:"energy", h:"발전·전력 자산 관리",
    a:["발전 자산 관리","전력 인프라 모니터링","부하 분석","시설 누수 감지","안전 환경","원격 운영"] },
  { n:"Tacoma Power", i:"energy", h:"전력 시설 운영 관리",
    a:["전력 시설 운영 관리","변전소 모니터링","부하 분석","시설 환경 관리","안전 통합","원격 알림"] },

  // === Bio / Medical / Pharma ===
  { n:"Bayer", i:"bio", h:"제약 GMP 환경 관리",
    a:["GMP 환경 관리","의약품 콜드체인","클린룸 모니터링","백신 냉장고 자동 기록","연구실 인큐베이터","원료 창고 관리"] },
  { n:"Merck & Co", i:"bio", h:"백신 콜드체인 솔루션",
    a:["백신 콜드체인","GMP 생산환경 관리","클린룸 모니터링","연구실 자산 관리","의약품 보관","안전 환경 통합"] },
  { n:"Samsung Biologics", i:"bio", h:"바이오의약품 GMP 통합 관리",
    a:["바이오 클린룸 환경 관리","의약품 보관 콜드체인","백신 냉장고 자동 기록","연구실 인큐베이터","원료 창고 관리","GMP 컴플라이언스"] },
  { n:"CDC", i:"bio", h:"백신·검체 보관 모니터링",
    a:["백신 보관 콜드체인","검체 저장 모니터링","연구실 환경 관리","클린룸 운영","자산 추적","비상 알림"] },
  { n:"Methodist Hospital", i:"bio", h:"의료 콜드스토리지 관리",
    a:["의료 콜드스토리지 자동 기록","약품·혈액 보관","검체 저장 관리","시설 누수 감지","도어 접근 통제","환자실 IEQ"] },
  { n:"UA Cancer Center", i:"bio", h:"항암제·검체 보관 관리",
    a:["항암제·검체 보관 관리","연구실 콜드체인","인큐베이터 모니터링","클린룸 환경","자산 추적","컴플라이언스 자동 기록"] },
  { n:"Intermountain Healthcare", i:"bio", h:"의료시설 통합 모니터링",
    a:["의료시설 통합 모니터링","약품 콜드스토리지","환자실 환경 관리","시설 누수 감지","도어 접근 통제","에너지 관리"] },
  { n:"Cal Biotech", i:"bio", h:"연구실 콜드스토리지 관리",
    a:["연구실 콜드스토리지","인큐베이터 모니터링","클린룸 환경","검체 보관","자산 추적","GLP 컴플라이언스"] },
  { n:"ANTHC", i:"bio", h:"원격지 의료 콜드체인",
    a:["원격지 의료 콜드체인","백신 냉장고 모니터링","의료시설 환경","시설 누수 감지","자산 추적","비상 원격 알림"] },

  // === Retail / Consumer Goods ===
  { n:"Walmart", i:"retail", h:"매장 콜드체인 자동화",
    a:["매장 콜드체인","HACCP 자동 기록","누수 감지","도어 개폐 모니터링","에너지 최적화","자산 추적"] },
  { n:"Costco", i:"retail", h:"대형 콜드체인 모니터링",
    a:["대형 콜드체인 모니터링","HACCP 컴플라이언스","매장 에너지 관리","시설 누수 감지","도어 모니터링","창고 환경 관리"] },
  { n:"NIKE", i:"retail", h:"매장·물류 시설 관리",
    a:["매장 환경 관리","물류센터 자산 추적","창고 운영 모니터링","에너지 효율","도어 접근 통제","시설 누수 감지"] },
  { n:"Nestlé", i:"retail", h:"식품 콜드체인 통합 관리",
    a:["식품 콜드체인","GMP 생산환경 관리","원료 보관","HACCP 자동 기록","시설 누수 감지","에너지 최적화"] },
  { n:"PepsiCo", i:"retail", h:"음료 생산·물류 모니터링",
    a:["음료 생산라인 환경 관리","창고 콜드체인","HACCP 컴플라이언스","설비 예지보전","에너지 효율","누수 감지"] },
  { n:"Unilever", i:"retail", h:"공장 설비·환경 통합 관리",
    a:["공장 설비·환경 관리","원료·완제품 창고 운영","에너지 자산 관리","시설 누수 감지","안전 환경","자산 추적"] },
  { n:"Keurig", i:"retail", h:"커피 생산·보관 환경 관리",
    a:["생산·보관 환경 관리","원두 창고 온습도","설비 예지보전","출하 콜드체인","에너지 효율","자산 추적"] },
  { n:"Gaia Herbs", i:"retail", h:"허브 원료 보관 관리",
    a:["허브 원료 보관 환경","GMP 컴플라이언스","발효·추출 공정 관리","창고 자산 관리","시설 누수 감지","HACCP 자동 기록"] },
  { n:"Stone Edge Farm", i:"retail", h:"와이너리·농장 운영 관리",
    a:["와이너리 발효 탱크 관리","저장고 환경 모니터링","농장 시설 운영","에너지 관리","자산 추적","환경 컴플라이언스"] },
  { n:"Wegmans", i:"retail", h:"매장 HACCP 자동 기록",
    a:["매장 HACCP 자동 기록","콜드체인 통합 관리","델리·베이커리 환경","누수 감지","도어 모니터링","에너지 최적화"] },
  { n:"Racetrac", i:"retail", h:"주유소 자산·재고 관리",
    a:["주유소 연료 탱크 레벨 관리","매장 콜드체인","시설 누수 감지","도어 접근 통제","에너지 모니터링","자산 추적"] },

  // === Food / Restaurant ===
  { n:"Dairy Queen", i:"food", h:"HACCP 자동 기록 솔루션",
    a:["HACCP 자동 기록","냉동고 콜드체인","매장 식품안전 관리","시설 누수 감지","도어 모니터링","에너지 효율"] },
  { n:"Chick-fil-A", i:"food", h:"매장 식품안전 관리",
    a:["매장 식품안전 관리","콜드체인 자동 기록","튀김기·냉장고 모니터링","HACCP 컴플라이언스","누수 감지","에너지 최적화"] },
  { n:"Subway", i:"food", h:"식자재 콜드체인 관리",
    a:["식자재 콜드체인","HACCP 자동 기록","매장 환경 관리","누수 감지","도어 모니터링","에너지 효율"] },
  { n:"Zaxby's", i:"food", h:"매장 콜드체인 모니터링",
    a:["매장 콜드체인 모니터링","HACCP 자동 기록","튀김기·냉장고 관리","시설 누수 감지","도어 접근","에너지 효율"] },

  // === Construction / Real Estate / Data Center ===
  { n:"Arup", i:"bldg", h:"스마트 빌딩 IEQ 솔루션",
    a:["스마트 빌딩 IEQ","점유율 분석","에너지 효율 관리","시설 누수 감지","자산 추적","환경 컴플라이언스"] },
  { n:"VINCI", i:"bldg", h:"건설 인프라 자산 관리",
    a:["건설 인프라 자산 관리","현장 환경 모니터링","자재 창고 운영","안전 환경 통합","에너지 효율","원격 자산 관리"] },
  { n:"JLL", i:"bldg", h:"스마트 빌딩 운영 관리",
    a:["스마트 빌딩 운영","점유율 분석","에너지 최적화","시설 누수 감지","HVAC 효율","자산 관리"] },
  { n:"CBRE", i:"bldg", h:"상업용 빌딩 통합 시설 관리",
    a:["상업용 빌딩 통합 시설 관리","점유율 분석","에너지·HVAC 효율","누수 감지","도어 접근 통제","자산 추적"] },
  { n:"C7 Data Centers", i:"bldg", h:"데이터센터 환경·자산 관리",
    a:["데이터센터 환경 관리","서버 랙 운영","누수 조기 감지","전력 부하 관리","도어 접근 통제","HVAC 효율"] },

  // === Education ===
  { n:"Fordham University", i:"edu", h:"캠퍼스 시설 관리",
    a:["캠퍼스 시설 관리","강의동 환경","기숙사 운영","에너지 효율","시설 누수 감지","도어 접근 통제"] },
  { n:"University of Maryland", i:"edu", h:"연구실 콜드스토리지 관리",
    a:["연구실 콜드스토리지","인큐베이터 모니터링","캠퍼스 시설 운영","에너지 관리","누수 감지","자산 추적"] },
  { n:"University of Miami", i:"edu", h:"캠퍼스·연구 환경 관리",
    a:["캠퍼스 시설·연구 환경 관리","의료 콜드체인","기숙사 운영","에너지 효율","누수 감지","도어 모니터링"] },
  { n:"SUNY", i:"edu", h:"캠퍼스 운영 통합 관리",
    a:["기숙사·강의동 운영","캠퍼스 에너지 관리","시설 누수 감지","도어 접근 통제","점유율 분석","환경 컴플라이언스"] },
  { n:"University of Michigan", i:"edu", h:"연구실 콜드스토리지 관리",
    a:["연구실 콜드스토리지","초저온 냉동고 관리","캠퍼스 에너지 효율","시설 누수 감지","자산 추적","IEQ 관리"] },
  { n:"University of Utah", i:"edu", h:"캠퍼스 에너지·시설 관리",
    a:["캠퍼스 에너지·시설 관리","연구실 환경","의료 콜드체인","기숙사 운영","누수 감지","도어 모니터링"] },

  // === Hospitality ===
  { n:"Wyndham", i:"hotel", h:"스마트 호텔 객실 운영",
    a:["스마트 호텔 객실 운영","미니바 자동 관리","시설 누수 감지","에너지 최적화","도어 접근 통제","자산 추적"] },
  { n:"Noralta Lodge", i:"hotel", h:"산업현장 캠프 시설 관리",
    a:["산업현장 캠프 시설 관리","객실 환경","식당 콜드체인","시설 누수 감지","안전 환경 통합","원격 자산 관리"] },
  { n:"Silverton", i:"hotel", h:"호텔 시설 통합 관리",
    a:["호텔 시설 통합 관리","객실 운영","F&B 콜드체인","시설 누수 감지","에너지 효율","도어 접근 통제"] },

  // === Public / Non-profit ===
  { n:"Salvation Army", i:"pub", h:"구호물품 보관 관리",
    a:["구호물품 보관 관리","시설 환경","식품 콜드체인","시설 누수 감지","도어 접근 통제","에너지 관리"] },
  { n:"BSA", i:"pub", h:"캠프시설 원격 운영 관리",
    a:["캠프시설 원격 관리","식당 콜드체인","시설 환경","안전 환경 통합","자산 추적","비상 알림"] }
];

const FEATURED_KEYS = ["Samsung Biologics", "ExxonMobil", "Walmart", "Microsoft", "Hyundai Motors", "CBRE", "US Army", "GS EPS"];

let AWARDS = [
  { y:2026, n:"IoT Sensor Company of the Year Award", c:"leadership", note:"연속 수상", url:"https://www.monnit.com/blog/monnit-wins-the-2026-iot-sensor-company-of-the-year-award/" },

  { y:2025, n:"IoT Sensor Company of the Year Award", c:"leadership", url:"https://www.monnit.com/blog/monnit-wins-2025-iot-sensor-company-of-the-year-award/" },
  { y:2025, n:"IoT Platforms Leadership Award", c:"platform", url:"https://www.monnit.com/blog/monnit-wins-back-to-back-iot-platforms-leadership-awards/" },
  { y:2025, n:"Industrial IoT Product of the Year", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-2025-industrial-iot-product-of-the-year/" },
  { y:2025, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-next-wi-fi-win-2025-product-of-the-year-award/" },
  { y:2025, n:"Cloud Computing Product of the Year", c:"platform", url:"https://www.monnit.com/blog/monnit-wins-2025-cloud-computing-award/" },
  { y:2025, n:"Smart City Product of the Year", c:"vertical", url:"https://www.monnit.com/blog/monnit-win-2025-smart-city-product-of-the-year-award/" },
  { y:2025, n:"AgTech Breakthrough Water Monitoring Solution", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2025-agtech-breakthrough-year-award/" },
  { y:2025, n:"IoT Evolution Asset Tracking Award", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2025-asset-tracking-award/" },
  { y:2025, n:"IoT Evolution Business Impact Award", c:"excellence", url:"https://www.monnit.com/blog/2025-iot-business-impact-award-winner/" },
  { y:2025, n:"INTERNET TELEPHONY Excellence Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-the-2025-internet-telephony-excellence-award/" },
  { y:2025, n:"Private Wireless Network Innovation Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-2025-private-wireless-network-innovation-award/" },
  { y:2025, n:"Best of State Awards", c:"state", note:"3건", url:"https://www.monnit.com/blog/monnit-wins-three-best-of-state-awards-again/" },

  { y:2024, n:"IoT Excellence Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-2024-iot-evolution-iot-excellence-award/" },
  { y:2024, n:"IoT Platforms Leadership Award", c:"platform", url:"https://www.monnit.com/blog/monnit-wins-the-2024-iot-evolution-iot-platforms-leadership-award/" },
  { y:2024, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-wins-the-2024-iot-evolution-iot-product-of-the-year-award/" },
  { y:2024, n:"Smart City Product of the Year", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-the-2024-smart-city-product-of-the-year-award/" },
  { y:2024, n:"AgTech Breakthrough Water Monitoring Solution", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-the-2024-agtech-breakthrough-water-monitoring-solution-of-the-year-award/" },
  { y:2024, n:"IoT Evolution Asset Tracking Award", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2024-asset-tracking-award/" },
  { y:2024, n:"IoT Evolution Business Impact Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-2024-iot-evolution-iot-business-impact-award/" },
  { y:2024, n:"INTERNET TELEPHONY Excellence Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-the-2024-internet-telephony-excellence-award/" },
  { y:2024, n:"Private Wireless Network Innovation Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-the-2024-iot-evolution-private-wireless-network-innovation-award/" },
  { y:2024, n:"Best of State Awards", c:"state", note:"3건", url:"https://www.monnit.com/blog/monnit-wins-three-2024-best-of-state-awards/" },

  { y:2023, n:"IoT Evolution Industrial IoT Product of the Year", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-evolution-industrial-iot-product-of-the-year-award/" },
  { y:2023, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-evolution-product-of-the-year-award/" },
  { y:2023, n:"IoT Evolution Asset Tracking Award", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-evolution-asset-tracking-award/" },
  { y:2023, n:"IoT Evolution Business Impact Award", c:"excellence", url:"https://www.monnit.com/blog/monnit-wins-2023-business-impact-award/" },
  { y:2023, n:"IoT Global Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-2023-iot-global-award-for-helping-save-babies-in-sub-sarahan-african-nicus/" },
  { y:2023, n:"Pandemic Tech Innovation Award", c:"innovation", url:"https://www.monnit.com/blog/monnit-wins-2023-pandemic-tech-innovation-award/" },
  { y:2023, n:"Best of State Awards", c:"state", note:"2건", url:"https://www.monnit.com/blog/monnit-wins-two-2023-best-of-state-awards/" },

  { y:2022, n:"IoT Innovator Gold — Best of IoT Industrial", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-two-2022-iot-innovator-awards/" },
  { y:2022, n:"IoT Innovator Silver — Connected Medical & Healthcare", c:"vertical", url:"https://www.monnit.com/blog/monnit-wins-two-2022-iot-innovator-awards/" },
  { y:2022, n:"Industrial IoT Product of the Year", c:"industrial", url:"https://www.monnit.com/blog/monnit-wins-2022-iot-evolution-industrial-iot-product-of-the-year-award/" },
  { y:2022, n:"IoT Evolution Product of the Year", c:"product", url:"https://www.monnit.com/blog/monnit-receives-2022-iot-evolution-product-of-the-year-award/" },
  { y:2022, n:"Pandemic Tech Innovation Award", c:"innovation" },
  { y:2022, n:"Best of State — Production & Manufacturing", c:"state" },

  { y:2021, n:"IoT Czar of the Year Award", c:"leadership", note:"CEO 리더십" },
  { y:2020, n:"LEAP Award", c:"engineering", note:"하드웨어" },
  { y:2019, n:"Manufacturer of the Year Award", c:"leadership" },
  { y:2019, n:"LEAP Award", c:"engineering" },
  { y:2019, n:"Best of State Award", c:"state" },

  { y:2015, n:"IoT Innovations Award", c:"innovation" },
  { y:2015, n:"Best of Sensors — Honorable Mention", c:"engineering" },
  { y:2015, n:"CRN Internet of Things 50 List", c:"leadership", note:"복수 연도" },

  { y:2012, n:"Entrepreneur Excellence — Greatest Potential", c:"innovation", note:"NorthFront" },
];

const CATEGORY_LABELS = {
  leadership:"Leadership", industrial:"Industrial IoT", vertical:"Vertical",
  product:"Product", excellence:"Excellence", innovation:"Innovation",
  engineering:"Engineering", platform:"Platform", state:"Best of State"
};

const REGION_LABELS = {
  na: "North America", sa: "South America", eu: "Europe",
  as: "Asia", af: "Africa", oc: "Oceania"
};

let PARTNERS = [
  // North America (30)
  { n:"ADSOL", r:"na", d:"LED · 농업 · 환경 IoT 솔루션", url:"http://www.adsol.ca/" },
  { n:"AIMNET", r:"na", d:"원격 모니터링 · 에너지 관리 기술", url:"https://www.mysmartbuilding.com" },
  { n:"AIR", r:"na", d:"EMEA · 공공 · 산업 IoT 통합", url:"http://www.airadio.com/" },
  { n:"ALM Systems", r:"na", d:"시스템 통합 및 엔지니어링", url:"http://www.almsystemscorp.com/" },
  { n:"Bestobell", r:"na", d:"산업 계측기 유통", url:"https://www.bestobell.com/" },
  { n:"BiPOM Electronics", r:"na", d:"마이크로컨트롤러 · 무선 시스템", url:"https://www.bipom.com/periph_cat/us/72/150.html" },
  { n:"BMIL Technologies", r:"na", d:"냉동 저장 · 설계 솔루션", url:"https://bmil.com" },
  { n:"Brainlike Inc.", r:"na", d:"엣지 데이터 처리" },
  { n:"ClearView Asset Protection", r:"na", d:"위협 탐지 솔루션", url:"http://www.clearviewassetprotection.com/" },
  { n:"Consolidated Solutions", r:"na", d:"전기 OEM · 대리점", url:"https://www.consolidatedsolns.com/" },
  { n:"Data Crunch Corp", r:"na", d:"예측 유지보수 · IoT 분석", url:"https://datacrunchcorp.com/" },
  { n:"ESBE Scientific", r:"na", d:"실험실 장비 · 공급", url:"https://en.esbe.com/" },
  { n:"EVO Integration", r:"na", d:"자동화 · 통합 솔루션", url:"https://www.evointegration.com/" },
  { n:"Grove Streams", r:"na", d:"클라우드 데이터 분석", url:"https://www.grovestreams.com" },
  { n:"JFC & Associates", r:"na", d:"엔터프라이즈 IoT 통합", url:"https://www.jfc-associates.com" },
  { n:"Lotus Pacific Technologies", r:"na", d:"IoT SI (NA · GCC · India)", url:"https://www.lotustek.com/" },
  { n:"Lynxspring, Inc.", r:"na", d:"엣지 · 엔터프라이즈 IoT 플랫폼", url:"https://www.lynxspring.com/" },
  { n:"M2M Data Corp.", r:"na", d:"원격 자산 모니터링" },
  { n:"MicroBMS", r:"na", d:"에너지 · 스마트 시티 IoT", url:"https://www.microbms.com/" },
  { n:"Nova Mobile Systems", r:"na", d:"GPS 추적 · 텔레매틱스" },
  { n:"Nexus Data Systems", r:"na", d:"환경 모니터링 · 규정 준수", url:"https://www.nxdatasystems.com/" },
  { n:"Power TakeOff", r:"na", d:"분석 · 리포팅 소프트웨어", url:"https://www.powertakeoff.com" },
  { n:"rams / American MTS", r:"na", d:"신뢰성 서비스 솔루션", url:"https://www.americanmts.com/copy-of-rams" },
  { n:"Registro y Monitoreo", r:"na", d:"센서 · 로그 유통 (중미)", url:"http://www.rm2.io/" },
  { n:"RevX Systems", r:"na", d:"셀룰러 IoT 리셀러" },
  { n:"Scigiene", r:"na", d:"온 · 습도 모니터링 및 인증", url:"http://www.scigiene.com/" },
  { n:"Sensorfi", r:"na", d:"무선 센서 기술 공급" },
  { n:"SensorGO", r:"na", d:"자산 모니터링 솔루션", url:"https://www.sensorgo.mx/" },
  { n:"SRT Labs", r:"na", d:"건물 · 캠퍼스 자동화", url:"https://srtlabs.com/" },
  { n:"Westell", r:"na", d:"원격 터미널 유닛 (RTU)", url:"https://www.westell.com/markets/intelligent-site-management" },

  // South America (6)
  { n:"AIWT&S", r:"sa", d:"자동화 · 클라우드 IoT 솔루션", url:"https://www.aiwts.net/" },
  { n:"ENECO", r:"sa", d:"에너지 제어 솔루션", url:"https://www.enecosolutions.com/" },
  { n:"Imagunet", r:"sa", d:"콜롬비아 IoT 시스템", url:"https://www.imagunet.com" },
  { n:"IoTMax", r:"sa", d:"칠레 IoT 운영 최적화", url:"http://www.iotmax.cl/" },
  { n:"New Access", r:"sa", d:"데이터센터 · IoT 모니터링", url:"http://www.new-access.net/" },
  { n:"Smart Box Panama", r:"sa", d:"파나마 스마트 기술 설계 · 지원", url:"https://smartboxpanama.com/en-us/soluciones/monitoreo/monnit/" },

  // Europe (14)
  { n:"Airicom", r:"eu", d:"IoT 통신 · 솔루션 공급", url:"https://airicom.com/blog/" },
  { n:"BitBlue Frost", r:"eu", d:"냉각 · 온도 기록 장비", url:"https://www.bitbluefrost.pl/" },
  { n:"Comgate", r:"eu", d:"IoT · 연결성 솔루션" },
  { n:"Connect Vision", r:"eu", d:"통신 · 자동화 솔루션", url:"https://www.connectvision.biz/" },
  { n:"E-Logger", r:"eu", d:"데이터 로깅 · 센서 유통" },
  { n:"Elkome Systems Oy", r:"eu", d:"핀란드 산업 IoT · 테스트", url:"https://www.elkome.com" },
  { n:"Fjarvöktun", r:"eu", d:"아이슬란드 IoT 모니터링", url:"https://fjarvoktun.is/" },
  { n:"GK", r:"eu", d:"북유럽 기술 컨트랙터", url:"https://www.gk.no/" },
  { n:"Intermarket", r:"eu", d:"전자 부품 · 시스템 유통", url:"https://www.abrosakis.com" },
  { n:"Master Chips", r:"eu", d:"IoT · 임베디드 유통", url:"https://masterchips.be/en/brand/monnit" },
  { n:"Matlog Data Corp.", r:"eu", d:"임베디드 · 산업 IT", url:"https://www.matlog.fr/collections/solutions-monnit" },
  { n:"Neodelis", r:"eu", d:"LED · 에너지 · 센서 솔루션", url:"https://www.neodelis.com" },
  { n:"RG2i", r:"eu", d:"프랑스 IoT · M2M 통신", url:"https://www.rg2i.fr" },
  { n:"SKADEteknik", r:"eu", d:"덴마크 누수 · 습도 솔루션", url:"https://www.skadeteknik.dk" },

  // Asia (16)
  { n:"Crownsys Consulting", r:"as", d:"필리핀 CMMS · IoT 통합", url:"https://crownsys.com/" },
  { n:"EBSL", r:"as", d:"디지털 · IoT 모바일 · RFID 솔루션", url:"https://www.ebsl.hk/" },
  { n:"eMeterEnergy", r:"as", d:"통합 모니터링 · 자동화", url:"https://www.monnit.ru/" },
  { n:"Enthu Technology Sdn Bhd", r:"as", d:"말레이시아 상업 · 산업 IoT", url:"https://www.enthu-tech.com" },
  { n:"Gemwel", r:"as", d:"데이터 자동화 · 원격 모니터링" },
  { n:"Heaven Homes Realty", r:"as", d:"인도 홈 자동화" },
  { n:"Huy Phuc", r:"as", d:"베트남 배포 · 설치 파트너", url:"https://huyphuc.vn" },
  { n:"Innovkez Pte Ltd", r:"as", d:"싱가포르 IoT 통합 솔루션", url:"https://www.innovkez.com" },
  { n:"Integra Data Digital", r:"as", d:"인도네시아 정보 솔루션", url:"http://www.integradatadigital.com/" },
  { n:"Power Technologies Pvt Ltd", r:"as", d:"싱가포르 에너지 효율 솔루션", url:"https://powertechnologies.com.sg/" },
  { n:"Qonda System Pte Ltd", r:"as", d:"Industrial 4.0 · 환경 IoT", url:"https://www.qondasystem.com/" },
  { n:"Smartec Scientific", r:"as", d:"대만 환경 · 물류 IoT", url:"https://sophicautomation.com/" },
  { n:"Vantage Power", r:"as", d:"태국 에너지 · 시설 솔루션", url:"http://www.vantagepower.co.th/" },
  { n:"Waterstone Electronics Tech", r:"as", d:"중국 전자 · 온라인 유통", url:"https://www.waterstone-tech.com" },
  { n:"Widetec", r:"as", d:"일본 IT · 인프라 솔루션", url:"https://www.widetec.com/" },
  { n:"WinSys Technology Pte Ltd", r:"as", d:"싱가포르 IT · IoT SI", url:"https://www.winsys.com.sg" },

  // Africa (1)
  { n:"Avtec", r:"af", d:"남아프리카 IoT 모니터링", url:"http://www.avtec.co.za/" },

  // Oceania (6)
  { n:"IoT Managed Sensor Systems", r:"oc", d:"무선 센서 제공", url:"https://www.iotmss.com.au" },
  { n:"mätt solutions", r:"oc", d:"뉴질랜드 프로세스 · 품질 솔루션", url:"https://www.ffi.nz" },
  { n:"OneTemp", r:"oc", d:"산업 · 환경 측정기기", url:"https://www.onetemp.com.au" },
  { n:"ProSense", r:"oc", d:"호주 모니터링 · 자동화", url:"https://www.prosense.com.au/" },
  { n:"Sense IoT", r:"oc", d:"예측 유지보수 IoT", url:"https://senseiot.com.au/" },
  { n:"WEB ID Systems", r:"oc", d:"냉장 · 자산 모니터링", url:"https://www.webidsystems.com.au" }
];

let CASE_DATA = {  /* 기본값 — 구글 시트(Cases 탭)가 있으면 덮어씀 */
'samsung-biologics': {
    num:'01', industry:'의료 · 바이오',
    accent:'#4D2C73', accentBg:'#E5DDEE', accentText:'#C4ABF2',
    name:'Samsung Biologics', title:'바이오의약품 GMP 환경<br><em>통합 관리 솔루션</em>',
    tagline:'송도 캠퍼스 바이오리액터 라인의 클린룸·콜드체인·연구실을 단일 플랫폼으로 통합 가시화',
    qs:[{n:'99.8%',l:'GMP 환경 준수율'},{n:'-90%',l:'수동 기록 시간'},{n:'24/7',l:'실시간 모니터링'}],
    about:'삼성바이오로직스는 송도에 4개 공장을 운영하며 60만 4천 리터 규모의 바이오리액터 생산 능력을 갖춘 세계 최대 CMO 중 하나입니다. mRNA 백신, 단클론 항체, 세포·유전자 치료제 등 바이오의약품 위탁생산을 담당하며 글로벌 제약사 60여 곳과 협력하고 있습니다.',
    challenges:['GMP 환경(클린룸, 콜드체인, 인큐베이터) 수십 곳의 24/7 데이터를 종이·엑셀로 관리 — FDA·EMA 감사 대응 시 추적성 부족','초저온 냉동고와 백신 보관고 이상 발생 시 알림이 늦어 수십억 원 규모 원료·완제품 폐기 리스크','신규 라인 증설마다 별도 모니터링 시스템을 구축 — 캠퍼스 통합 가시성 부재'],
    solutions:[{t:'바이오 클린룸 환경 관리',d:'ISO 7-8등급 클린룸의 차압·온습도·파티클을 통합 대시보드로 실시간 추적'},{t:'의약품 보관 콜드체인',d:'2-8℃ / -20℃ / -80℃ 보관고 상시 모니터링, 임계치 이탈 시 다중 채널 알림'},{t:'백신 냉장고 자동 기록',d:'감사 대응용 PDF 리포트 자동 생성, 5초 단위 데이터 5년 이상 보존'},{t:'연구실 인큐베이터 관리',d:'세포 배양 환경 안정성을 위한 CO₂·온도·습도 통합 모니터링'},{t:'원료 창고 온습도 관리',d:'원료 보관 구역별 적정 보관 조건 자동 검증 및 알림'},{t:'GMP 컴플라이언스 자동화',d:'FDA 21 CFR Part 11, EU GMP Annex 11 대응 데이터 무결성 확보'}],
    results:[{n:'99.8%',l:'GMP 환경 준수율'},{n:'-90%',l:'수동 기록 시간'},{n:'-65%',l:'이상 상황 대응 시간'},{n:'100%',l:'감사 데이터 추적성'}],
    quote:'단일 플랫폼으로 클린룸부터 콜드체인까지 통합 가시화되면서, 감사 대응과 폐기 손실 양쪽에서 성과가 나타났습니다.',
    cite:'공정 운영팀 리더, Samsung Biologics'
},
'exxonmobil': {
    num:'02', industry:'에너지',
    accent:'#7A5418', accentBg:'#F2E5D2', accentText:'#EBC062',
    name:'ExxonMobil', title:'정유 플랜트<br><em>통합 자산 모니터링</em>',
    tagline:'다수 정유 시설의 펌프·압축기·탱크·배관을 원격 통합 감시하는 산업용 IoT 인프라',
    qs:[{n:'-45%',l:'비계획 정지'},{n:'+28%',l:'설비 MTBF'},{n:'-75%',l:'누설 감지 시간'}],
    about:'ExxonMobil은 미국·아시아·중동 등 전세계 30개 이상의 정유·석유화학 시설을 운영하는 글로벌 에너지 메이저입니다. 노후화된 설비와 24/7 운영 환경에서 안전성과 생산성을 동시에 확보하기 위해 산업용 IoT 모니터링을 도입했습니다.',
    challenges:['노후 펌프·압축기의 비계획 정지가 라인 전체 생산 손실로 직결 — 진동·온도 데이터의 상시 수집 어려움','광활한 플랜트 부지의 가스 누설·유체 누설을 작업자 순회로만 감지 — 사고 리스크 상시 존재','탱크 레벨·배관 압력 수기 점검으로 운영 효율 한계, 자산 ROI 분석 불가'],
    solutions:[{t:'정유 설비 상태 모니터링',d:'회전 기기 진동·온도 데이터 기반 예지보전, 이상 패턴 자동 감지'},{t:'탱크 레벨·자산 관리',d:'원유·완제품 탱크 레벨 실시간 추적으로 출하·재고 최적화'},{t:'누설 조기 감지',d:'가스·유체 누설을 분 단위로 감지해 작업자 안전과 환경 사고 예방'},{t:'펌프·압축기 예지보전',d:'회전체 진동 트렌드 분석으로 고장 24~72시간 전 사전 대응'},{t:'안전 환경 통합 관리',d:'압력·온도·가스 농도 다중 안전 지표를 통합 대시보드로 관제'},{t:'자산 원격 운영',d:'분산된 플랜트 자산을 단일 SCADA·클라우드 환경에서 통합 운영'}],
    results:[{n:'-45%',l:'비계획 정지 시간'},{n:'+28%',l:'설비 평균 MTBF'},{n:'-75%',l:'누설 감지 시간'},{n:'+12%',l:'자산 ROI'}],
    quote:'예지보전 알림을 받기 시작한 이후 비계획 정지가 절반 가까이 줄었고, 안전 사고 리스크도 크게 낮아졌습니다.',
    cite:'플랜트 운영 매니저, ExxonMobil'
},
'walmart': {
    num:'03', industry:'유통 · 소비재',
    accent:'#3D5E2E', accentBg:'#DFEAD7', accentText:'#8FD98F',
    name:'Walmart', title:'매장 콜드체인<br><em>자동화 솔루션</em>',
    tagline:'4,600개 이상 매장의 냉장·냉동·HACCP·에너지·시설을 단일 플랫폼으로 자동화',
    qs:[{n:'-32%',l:'식품 폐기 손실'},{n:'100%',l:'HACCP 준수율'},{n:'-18%',l:'에너지 비용'}],
    about:'Walmart는 미국 4,600개 이상의 매장과 글로벌 10,500개 매장을 운영하는 세계 최대 유통 기업입니다. 매장당 수십 대의 냉장·냉동 설비를 24/7 운영하면서 식품 안전, 에너지 비용, 손실율을 동시에 관리해야 하는 과제를 안고 있습니다.',
    challenges:['매장별 냉장고·냉동고 수십 대의 온도 이상을 종이 점검표로 관리 — 야간·휴일 누락 빈발','한 매장당 연간 수백만 원의 식품 폐기 손실, 보험 청구 사례 증가','HACCP 종이 기록에 매장 직원이 하루 1~2시간 소요, 감사 시 추적 어려움'],
    solutions:[{t:'매장 콜드체인',d:'전 매장 냉장·냉동 설비의 온도를 클라우드로 통합, 이상 시 즉시 알림'},{t:'HACCP 자동 기록',d:'디지털 점검 리포트 자동 생성으로 직원 부담 제거, 감사 100% 대응'},{t:'누수 조기 감지',d:'냉장고 결로·배관 누수 조기 감지로 매장 손해 최소화'},{t:'도어 개폐 모니터링',d:'워크인 냉장고 도어 열림 시간 분석으로 에너지 손실 최소화'},{t:'에너지 사용 최적화',d:'매장별 전력 패턴 분석으로 비효율 설비 식별 및 교체 가이드'},{t:'자산 추적',d:'설비 점검 이력과 유지보수 일정을 통합 관리, 다운타임 최소화'}],
    results:[{n:'-32%',l:'식품 폐기 손실'},{n:'100%',l:'HACCP 준수율'},{n:'-18%',l:'매장 에너지 비용'},{n:'-41%',l:'보험 청구 건수'}],
    quote:'직원이 점검표를 들고 다닐 필요가 없어졌고, 야간 이상 상황도 즉시 알림으로 받게 되어 손실이 크게 줄었습니다.',
    cite:'매장 운영 총괄, Walmart'
},
'microsoft': {
    num:'04', industry:'IT · 데이터센터',
    accent:'#2E4A6B', accentBg:'#DDE6F0', accentText:'#8FBEFF',
    name:'Microsoft', title:'데이터센터<br><em>통합 모니터링 솔루션</em>',
    tagline:'글로벌 Azure 데이터센터의 랙·HVAC·누수·전력을 단일 가시성 플랫폼으로',
    qs:[{n:'-67%',l:'다운타임'},{n:'+15%',l:'쿨링 효율'},{n:'-75%',l:'장애 대응 시간'}],
    about:'Microsoft는 전세계 60개 이상 리전에서 200여 개의 데이터센터를 운영하며 Azure 클라우드 인프라를 제공합니다. 수백만 대 서버가 24/7 가동되는 환경에서 미세한 환경 이상도 대규모 서비스 장애로 이어질 수 있어, 정밀한 실시간 모니터링이 필수입니다.',
    challenges:['수천 개 서버 랙 단위의 미세한 온도·습도 편차가 장기적으로 하드웨어 수명에 영향','데이터센터 누수·결로 사고가 발생하면 수억 원 단위 장비 손실 직결','쿨링·전력 시스템의 비효율 운영이 PUE 악화로 이어져 운영비 압박'],
    solutions:[{t:'데이터센터 환경 관리',d:'랙·복도 단위 온습도·차압을 1분 단위로 추적, 핫스팟 즉시 식별'},{t:'서버 랙 운영 모니터링',d:'랙별 흡기·배기 온도 차이로 쿨링 효율 정밀 분석'},{t:'누수 조기 감지',d:'수냉식 시스템·배관·바닥 단위 누수를 분 단위로 감지'},{t:'전력 사용 최적화',d:'PDU·UPS 부하 데이터로 전력 분산 최적화, PUE 개선'},{t:'도어 접근 통제',d:'데이터센터 출입·랙 도어 개폐 이력 자동 기록으로 보안 강화'},{t:'HVAC 효율 관리',d:'CRAH·CRAC 운영 데이터와 환경 데이터 연계로 쿨링 자동 최적화'}],
    results:[{n:'-67%',l:'환경 원인 다운타임'},{n:'+15%',l:'쿨링 효율'},{n:'-75%',l:'장애 대응 시간'},{n:'+14%',l:'자산 활용률'}],
    quote:'환경 원인으로 발생하던 장애를 사전에 차단할 수 있게 되었고, 데이터센터당 운영 효율이 가시적으로 개선되었습니다.',
    cite:'데이터센터 인프라 운영팀, Microsoft'
},
'hyundai-motors': {
    num:'05', industry:'자동차 · 운송',
    accent:'#4A4541', accentBg:'#E8E5E2', accentText:'#CFCFDC',
    name:'Hyundai Motors', title:'자동차 공장<br><em>설비 예지보전 솔루션</em>',
    tagline:'울산·앨라배마·체코 글로벌 공장의 도장·용접·조립 라인을 통합 모니터링',
    qs:[{n:'+9%',l:'라인 가동률'},{n:'88%',l:'예지보전 정확도'},{n:'-14%',l:'에너지 사용량'}],
    about:'현대자동차는 전세계 9개국에서 13개 생산 거점을 운영하며 연간 400만 대 이상을 생산합니다. 도장·용접·조립 라인은 한 곳의 정지가 라인 전체에 영향을 주는 구조여서, 설비 가동률과 품질 안정성이 직접적인 수익으로 연결됩니다.',
    challenges:['도장 부스·용접 로봇의 비계획 정지가 라인 전체에 분 단위로 영향 — 사후 대응의 한계','도장 부스 온습도 편차가 도장 품질 불량으로 이어져 재작업 비용 증가','자재 창고의 부품 보관 환경이 부적정해 결로·부식으로 인한 자재 손실'],
    solutions:[{t:'공장 설비 예지보전',d:'용접 로봇·컨베이어·프레스 진동 데이터 기반 사전 정비 알림'},{t:'도장 부스 환경 관리',d:'도장 부스 온습도 정밀 제어로 도장 품질 안정화'},{t:'자재 창고 운영',d:'부품·자재 보관 구역별 환경 모니터링으로 결로·부식 예방'},{t:'에너지 자산 관리',d:'설비별 전력 사용 패턴 분석으로 비효율 설비 식별'},{t:'안전 환경 통합',d:'용접 흄·작업장 가스 농도·온도를 통합 관제'},{t:'도어·물류 모니터링',d:'셔터·도어 개폐 이력 추적으로 자재 흐름 최적화'}],
    results:[{n:'+9%',l:'라인 가동률'},{n:'88%',l:'예지보전 정확도'},{n:'-14%',l:'에너지 사용량'},{n:'-22%',l:'자재 손실 비용'}],
    quote:'공장 단위가 아니라 라인·설비 단위로 이상 신호를 미리 받게 되면서, 비계획 정지를 사전에 차단할 수 있게 됐습니다.',
    cite:'생산 운영 부문, Hyundai Motors'
},
'cbre': {
    num:'06', industry:'건설 · 부동산',
    accent:'#2E4651', accentBg:'#D9E2E6', accentText:'#7FCEE6',
    name:'CBRE', title:'상업용 빌딩<br><em>통합 시설 관리 솔루션</em>',
    tagline:'전세계 100,000+ 상업용 빌딩의 점유율·에너지·HVAC·시설을 단일 운영 플랫폼으로',
    qs:[{n:'-22%',l:'운영 비용'},{n:'+15%',l:'HVAC 효율'},{n:'+18%',l:'임차인 만족도'}],
    about:'CBRE는 100개국 530개 사무소에서 활동하는 세계 최대 상업용 부동산 서비스 기업입니다. 자산 관리 면적은 70억 평방피트를 상회하며, 임대·운영 자산의 효율성을 데이터 기반으로 끌어올리는 것이 핵심 경쟁력입니다.',
    challenges:['수많은 빌딩의 HVAC·조명·전력 운영이 빌딩별로 분산되어 통합 분석 불가','공간 점유율이 가시화되지 않아 임차 공간 최적화와 에너지 절감 기회 손실','시설 누수·이상 사고가 발생하면 사후 대응 — 임차인 클레임과 수리 비용 증가'],
    solutions:[{t:'상업용 빌딩 통합 시설 관리',d:'전 자산의 환경·에너지·점유 데이터를 단일 플랫폼으로 통합'},{t:'점유율 분석',d:'회의실·층별 공간 활용도 가시화로 임대 공간 최적화'},{t:'에너지·HVAC 효율',d:'환경 데이터 기반 HVAC 자동 최적화로 운영비 절감'},{t:'시설 누수 감지',d:'워터 디텍션으로 누수 사고 조기 감지, 손해 최소화'},{t:'도어 접근 통제',d:'공용·전용 공간 접근 이력 자동 기록'},{t:'자산 추적·유지보수',d:'설비별 점검·교체 이력 통합으로 예방 정비 효율화'}],
    results:[{n:'-22%',l:'운영 비용'},{n:'+15%',l:'HVAC 효율'},{n:'100%',l:'점유율 가시화'},{n:'+18%',l:'임차인 만족도'}],
    quote:'임차인에게 더 나은 환경을 제공하면서도 운영비를 줄일 수 있다는 사실을, 데이터를 통해 입증할 수 있게 되었습니다.',
    cite:'자산 운영 부문, CBRE'
},
'us-army': {
    num:'07', industry:'국방 · 방위',
    accent:'#3A4A33', accentBg:'#DEE6D9', accentText:'#9ECF9E',
    name:'US Army', title:'군 부대 핵심 전략 자산<br><em>통합 모니터링 솔루션</em>',
    tagline:'전방·후방 기지의 전략 자산·탄약고·동력설비·연료 저장 시설을 단일 보안 플랫폼으로 원격 감시',
    qs:[{n:'24/7',l:'무인 원격 감시'},{n:'-60%',l:'순찰 인력 부담'},{n:'99.9%',l:'자산 가용성'}],
    about:'미 육군(US Army)은 전 세계 다수의 기지와 전개 거점에서 전략 자산과 막대한 규모의 탄약·물자·연료를 운용합니다. 인력 순찰에 의존하던 기존 점검 체계를 무선 IoT 기반의 원격 상시 감시로 전환해, 보안성과 작전 가용성을 동시에 확보했습니다.',
    challenges:['탄약고·물자 창고 수십 곳의 온습도·침입 여부를 인력 순찰로만 점검 — 야간·악천후 시 사각지대 발생','비상 발전기·동력 설비의 비계획 정지가 작전 지속성에 직접적 위협','광활한 기지 내 연료 저장 탱크의 누설·레벨을 실시간으로 파악하기 어려움'],
    solutions:[{t:'전략 자산 상태 모니터링',d:'핵심 장비·자산의 온도·진동·위치를 24/7 원격 추적, 이상 시 즉시 보고'},{t:'탄약·물자 보관 환경 관리',d:'탄약고·창고 온습도·결로를 상시 감시해 저장 안정성 확보'},{t:'발전기·동력설비 예지보전',d:'비상 발전기·동력 설비 진동·온도 데이터로 고장 사전 차단'},{t:'연료 저장 탱크 관리',d:'연료 레벨·온도·누설을 실시간 추적해 손실과 안전 사고 예방'},{t:'시설 침입·누수 감지',d:'도어 개폐·침입·누수를 분 단위로 감지해 시설 보안 강화'},{t:'원격 통합 관제',d:'분산된 기지 자산을 단일 보안 대시보드에서 통합 운영 (암호화 전송)'}],
    results:[{n:'24/7',l:'무인 원격 감시'},{n:'-60%',l:'순찰 인력 부담'},{n:'-50%',l:'자산 이상 대응 시간'},{n:'99.9%',l:'전략 자산 가용성'}],
    quote:'사람이 직접 돌아보던 점검을 원격 상시 감시로 전환하면서, 인력 부담은 줄고 자산 가용성과 보안성은 오히려 높아졌습니다.',
    cite:'시설·자산 운영 부문, US Army'
},
'gs-eps': {
    num:'08', industry:'발전 · 전력',
    accent:'#8A4A18', accentBg:'#F2E2D2', accentText:'#F0B070',
    name:'GS EPS', title:'복합화력 발전 설비<br><em>통합 상태 감시 솔루션</em>',
    tagline:'복합화력 발전소의 가스·증기 터빈, 보일러, 변압기, 연료 설비를 단일 플랫폼으로 예지보전',
    qs:[{n:'-40%',l:'비계획 정지'},{n:'+10%',l:'설비 가동률'},{n:'-70%',l:'누설 감지 시간'}],
    about:'GS EPS는 충남 당진에 대규모 복합화력 발전 단지를 운영하는 국내 대표 민간 발전사입니다. 24시간 연속 운전이 필수인 발전 설비의 특성상, 터빈·보일러·변압기 등 핵심 회전·열 설비의 미세한 이상 신호를 조기에 포착하는 것이 안정적 전력 공급의 핵심입니다.',
    challenges:['가스·증기 터빈, 발전기 등 회전 기기의 비계획 정지가 발전 손실과 계통 영향으로 직결','보일러·열교환기·변압기의 온도·진동 이상을 주기 점검만으로는 조기 포착 어려움','연료·윤활유 누설과 배관 이상을 인력 순회로 감지 — 안전·환경 리스크 상존'],
    solutions:[{t:'터빈·발전기 진동 예지보전',d:'회전 기기의 진동·온도 트렌드 분석으로 고장 24~72시간 전 사전 정비'},{t:'보일러·열교환기 상태 진단',d:'열 설비의 온도·압력을 상시 추적해 효율 저하와 이상을 조기 식별'},{t:'변압기·배전반 모니터링',d:'변압기 온도·부하와 배전반 상태를 통합 감시해 정전 리스크 최소화'},{t:'연료·윤활유 누설 감지',d:'연료·윤활유 누설과 배관 이상을 분 단위로 감지해 안전·환경 사고 예방'},{t:'발전 효율·전력 분석',d:'설비별 전력·열 데이터를 분석해 발전 효율과 운영 비용 최적화'},{t:'원격 SCADA 연동',d:'기존 발전소 SCADA·DCS와 ALTA 데이터를 매끄럽게 연동, 단일 관제'}],
    results:[{n:'-40%',l:'비계획 정지 시간'},{n:'+10%',l:'설비 가동률'},{n:'-70%',l:'누설 감지 시간'},{n:'+8%',l:'발전 효율'}],
    quote:'핵심 설비의 이상 신호를 미리 받게 되면서 비계획 정지를 크게 줄였고, 안정적인 전력 공급과 안전 관리를 동시에 강화할 수 있었습니다.',
    cite:'발전 운영 부문, GS EPS'
}
};

/* ============================================================
   ========== 구글 시트 연결 (CONTENT SHEET) ==========
   고객사·수상·파트너 목록을 구글 시트에서 읽어옵니다.
   여기 sheetId 한 줄만 바꾸면 됩니다. (탭 이름은 그대로 두세요)
   ============================================================ */
const CONTENT_SHEET = {
  // 1) 구글 시트 주소에서 /d/ 와 /edit 사이의 긴 문자열을 붙여넣으세요.
  //    예) https://docs.google.com/spreadsheets/d/[이부분]/edit
  //    아직 비워두면(아래 기본값 그대로면) 사이트는 코드 내 기본 데이터로 동작합니다.
  sheetId: "1kA79KSGxf99vjZqpt6KuFCl96-Qno0E6cC43r6c2JjA",

  // 2) 시트 하단 탭 이름 (기본값 그대로 사용 권장)
  tabs: {
    customers: "Customers", awards: "Awards", partners: "Partners",
    cases: "Cases", appcategories: "AppCategories", applications: "Applications",
    appdetails: "AppDetails", blog: "Blog", whitepapers: "Whitepapers",
    news: "NewsHighlights", faqs: "FAQs", knowledgebase: "Knowledgebase",
    photos: "Photos"
  },

  // 3) (선택) 위 방식 대신 '웹에 게시 → CSV' 링크를 직접 쓰려면 여기에 전체 URL을 넣으세요.
  //    비워두면 자동으로 sheetId + 탭 이름으로 주소를 만듭니다.
  urls: {
    customers: "", awards: "", partners: "",
    cases: "", appcategories: "", applications: "",
    appdetails: "", blog: "", whitepapers: "",
    news: "", faqs: "", knowledgebase: "", photos: ""
  }
};

/* --- 가벼운 CSV 파서 (따옴표·줄바꿈·쉼표 처리) --- */
function parseCSV(text){
  const rows = []; let row = [], field = '', i = 0, inQ = false;
  text = text.replace(/^\uFEFF/, ''); // BOM 제거
  while (i < text.length){
    const ch = text[i];
    if (inQ){
      if (ch === '"'){ if (text[i+1] === '"'){ field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"'){ inQ = true; i++; continue; }
    if (ch === ','){ row.push(field); field = ''; i++; continue; }
    if (ch === '\r'){ i++; continue; }
    if (ch === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
/* CSV 행들을 헤더 기반 객체 배열로 변환 (열 순서 무관, 대소문자 무시) */
function csvToObjects(text){
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => {
    const o = {}; head.forEach((h, idx) => { o[h] = (r[idx] || '').trim(); }); return o;
  });
}
function sheetURL(key){
  if (CONTENT_SHEET.urls[key]) return CONTENT_SHEET.urls[key];
  const id = CONTENT_SHEET.sheetId, tab = CONTENT_SHEET.tabs[key];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}
async function fetchSheet(key){
  const res = await fetch(sheetURL(key), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return csvToObjects(await res.text());
}

/* --- 시트 → 사이트 데이터 형식으로 변환 (잘못된 값은 건너뜀) --- */
function mapCustomers(rows){
  const out = [];
  rows.forEach(o => {
    const n = o.name, i = (o.industry||'').toLowerCase();
    if (!n || !INDUSTRIES[i]) return;
    const a = (o.apps||'').split('|').map(s => s.trim()).filter(Boolean);
    out.push({ n, i, h: o.headline||'', a });
  });
  return out;
}
function mapAwards(rows){
  const out = [];
  rows.forEach(o => {
    const y = parseInt(o.year, 10), c = (o.category||'').toLowerCase();
    if (!o.name || !y || !CATEGORY_LABELS[c]) return;
    const a = { y, n: o.name, c }; if ((o.note||'').trim()) a.note = o.note.trim();
    if ((o.url||'').trim()) a.url = o.url.trim();
    out.push(a);
  });
  return out;
}
function mapPartners(rows){
  const out = [];
  rows.forEach(o => {
    const r = (o.region||'').toLowerCase();
    if (!o.name || !REGION_LABELS[r]) return;
    const p = { n: o.name, r, d: o.desc||'' };
    if ((o.url||'').trim()) p.url = o.url.trim();
    out.push(p);
  });
  return out;
}

/* --- 중첩 데이터용 구분자 ( ||  항목구분 ,  ::  항목 내 칸 구분) --- */
function splitItems(s){ return String(s||'').split('||').map(x => x.trim()).filter(Boolean); }
function splitFields(s){ return String(s||'').split('::').map(x => x.trim()); }

/* Cases (활용 사례 / Use case) — 한 행 = 한 사례 */
function mapCases(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    if (!key || !o.name) return;
    out[key] = {
      num: o.num||'', industry: o.industry||'',
      accent: o.accent||'#444', accentBg: o.accentbg||'#eee',
      name: o.name, title: o.title||'', tagline: o.tagline||'',
      qs: splitItems(o.qs).map(it => { const f = splitFields(it); return { n:f[0]||'', l:f[1]||'' }; }),
      about: o.about||'',
      challenges: splitItems(o.challenges),
      solutions: splitItems(o.solutions).map(it => { const f = splitFields(it); return { t:f[0]||'', d:f[1]||'' }; }),
      results: splitItems(o.results).map(it => { const f = splitFields(it); return { n:f[0]||'', l:f[1]||'' }; }),
      quote: o.quote||'', cite: o.cite||'',
      photos: parsePhotos(o.photos)
    };
  });
  return out;
}

/* AppCategories — 한 행 = 한 카테고리 */
function mapCategories(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    if (!key || !o.name) return;
    out[key] = { name: o.name, label: o.label||'' };
  });
  return out;
}

/* Applications — 한 행 = 한 어플리케이션 */
function mapApps(rows){
  const out = [];
  rows.forEach(o => {
    if (!o.id || !o.name) return;
    out.push({
      id: o.id.trim(), name: o.name, cat: (o.cat||'').trim(),
      desc: o.desc||'', sensors: o.sensors||'',
      popularity: parseInt(o.popularity,10) || 0,
      isNew: /^(true|1|y|yes|예|네|새|new)$/i.test((o.isnew||'').trim()),
      added: o.added||'',
      file: (o.file||o.pdf||o.download||o.attachment||'').trim(),
      photos: parsePhotos(o.photos)
    });
  });
  return out;
}

/* AppDetails — 한 행 = 어플리케이션 1개의 상세 페이지
   · 내용이 하나도 없는(키만 있는) 템플릿 행은 건너뜀 → 기존 기본 상세 유지
   · 일부 칸만 채운 행은 비어 있는 항목을 DEFAULT_APP_DETAIL 로 자동 보완 */
function mapAppDetails(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    if (!key) return;
    // 키 외에 내용이 전혀 없으면 템플릿 행으로 보고 건너뛴다
    const contentCols = [o.snapshot,o.customerlead,o.customerparagraphs,o.challengelead,o.pains,
      o.solutionlead,o.solutionparagraphs,o.sensors,o.proposallead,o.phases,o.roilead,o.metrics,o.before,o.after];
    if (!contentCols.some(v => (v==null?'':String(v)).trim())) return;

    const D = (typeof DEFAULT_APP_DETAIL !== 'undefined') ? DEFAULT_APP_DETAIL : {snapshot:[],customer:{lead:'',paragraphs:[]},challenge:{lead:'',pains:[]},solution:{lead:'',paragraphs:[],sensors:[]},proposal:{lead:'',phases:[]},roi:{lead:'',metrics:[],before:'',after:''}};
    const snapshot = splitItems(o.snapshot).map(it => { const f = splitFields(it); return { label:f[0]||'', value:f[1]||'', desc:f[2]||'' }; });
    const custParas = splitItems(o.customerparagraphs);
    const pains = splitItems(o.pains).map(it => { const f = splitFields(it); return { title:f[0]||'', desc:f[1]||'' }; });
    const solParas = splitItems(o.solutionparagraphs);
    const solSensors = splitItems(o.sensors);
    const phases = splitItems(o.phases).map(it => { const f = splitFields(it); return { tag:f[0]||'', title:f[1]||'', desc:f[2]||'', duration:f[3]||'' }; });
    const metrics = splitItems(o.metrics).map(it => { const f = splitFields(it); return { num:f[0]||'', desc:f[1]||'' }; });

    out[key] = {
      snapshot: snapshot.length ? snapshot : D.snapshot,
      customer: { lead: (o.customerlead||'').trim() || D.customer.lead, paragraphs: custParas.length ? custParas : D.customer.paragraphs },
      challenge: { lead: (o.challengelead||'').trim() || D.challenge.lead, pains: pains.length ? pains : D.challenge.pains },
      solution: { lead: (o.solutionlead||'').trim() || D.solution.lead, paragraphs: solParas.length ? solParas : D.solution.paragraphs, sensors: solSensors.length ? solSensors : D.solution.sensors },
      proposal: { lead: (o.proposallead||'').trim() || D.proposal.lead, phases: phases.length ? phases : D.proposal.phases },
      roi: { lead: (o.roilead||'').trim() || D.roi.lead, metrics: metrics.length ? metrics : D.roi.metrics, before: (o.before||'').trim() || D.roi.before, after: (o.after||'').trim() || D.roi.after }
    };
  });
  return out;
}

/* 자료실 & 지원 (단순 목록 탭) */
function mapBlog(rows){
  return rows.filter(o => o.title).map(o => ({ date:o.date||'', title:o.title, body:o.body||'', thumb:o.thumb||'◐', image:o.image||'', category:o.category||'', url:o.url||'' }));
}
function mapNews(rows){
  return rows.filter(o => o.title).map(o => ({ title:o.title, desc:o.desc||'', url:o.url||'' }));
}
/* 공유 링크(구글 드라이브·드롭박스)를 <img>에서 바로 보이는 직접 이미지 주소로 변환 */
function normalizeImageUrl(u){
  u = String(u==null?'':u).trim();
  if (!u) return '';
  if (u.indexOf('drive.google.com') !== -1){
    var m = u.match(/\/file\/d\/([^/]+)/) || u.match(/[?&]id=([^&]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  }
  if (u.indexOf('dropbox.com') !== -1){
    return u.replace('www.dropbox.com','dl.dropboxusercontent.com').replace(/[?&]dl=0/, '');
  }
  return u;
}
function mapWhitepapers(rows){
  return rows.filter(o => o.title).map(o => ({ icon:o.icon||'▤', title:o.title, desc:o.desc||'', category:o.category||'', url:o.url||'', photo:normalizeImageUrl((o.photo||'').split('||')[0].split('::')[0]) }));
}
function mapFaqs(rows){
  return rows.filter(o => o.question).map(o => ({ q:o.question, a:o.answer||'' }));
}
function mapKnowledgebase(rows){
  return rows.filter(o => o.title).map(o => ({ category:o.category||'', title:o.title, desc:o.desc||'' }));
}

/* Photos (현장 사진) — 한 행 = 사진 1장.  열: key, url, caption, order
   key 예: "case:us-army", "app:vaccine"  /  같은 key 끼리 묶어 본문에 표시 */
function mapPhotos(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    const src = (o.url||o.src||'').trim();
    if (!key || !src) return;
    (out[key] = out[key] || []).push({ src, caption: (o.caption||'').trim(), order: parseInt(o.order,10)||0 });
  });
  Object.keys(out).forEach(k => {
    out[k].sort((a,b)=>a.order-b.order);
    out[k] = out[k].map(({src,caption})=>({src,caption}));
  });
  return out;
}

/* --- 시트 로드: 성공한 데이터만 교체, 실패하면 기본값 유지 --- */
async function loadSheetData(){
  // 아직 ID를 안 넣었으면 기본 데이터로 동작 (콘솔에만 안내)
  if (!CONTENT_SHEET.urls.customers && (!CONTENT_SHEET.sheetId || CONTENT_SHEET.sheetId.includes('여기에'))){
    console.info('[CONTENT_SHEET] 구글 시트 미설정 — 코드 내 기본 데이터를 사용합니다.');
    return;
  }
  const hasKeys = o => o && Object.keys(o).length > 0;
  const labels = [];
  const jobs = [];
  const add = (key, fn) => { labels.push(key); jobs.push(fetchSheet(key).then(fn)); };

  add('customers',     r => { const m = mapCustomers(r);     if (m.length) CUSTOMERS = m; });
  add('awards',        r => { const m = mapAwards(r);        if (m.length) AWARDS = m; });
  add('partners',      r => { const m = mapPartners(r);      if (m.length) PARTNERS = m; });
  add('cases',         r => { const m = mapCases(r);         if (hasKeys(m)) CASE_DATA = m; });
  add('appcategories', r => { const m = mapCategories(r);    if (hasKeys(m)) CATEGORIES = m; });
  add('applications',  r => { const m = mapApps(r);          if (m.length) APPS = m; });
  add('appdetails',    r => { const m = mapAppDetails(r);    if (hasKeys(m)) APP_DETAILS = m; });
  add('blog',          r => { const m = mapBlog(r);          if (m.length) BLOG = m; });
  add('whitepapers',   r => { const m = mapWhitepapers(r);   if (m.length) WHITEPAPERS = m; });
  add('news',          r => { const m = mapNews(r);          if (m.length) NEWS_HIGHLIGHTS = m; });
  add('faqs',          r => { const m = mapFaqs(r);          if (m.length) FAQS = m; });
  add('knowledgebase', r => {
    const m = mapKnowledgebase(r);
    if (m.length){
      const byTitle = {}; KNOWLEDGEBASE.forEach(d => { byTitle[(d.title||'').trim()] = d; });
      KNOWLEDGEBASE = m.map((row,i) => {
        const match = byTitle[(row.title||'').trim()];
        return Object.assign({ id:'kb'+i, body: match ? match.body : '' }, row);
      });
    }
  });
  add('photos',        r => { const m = mapPhotos(r);        if (hasKeys(m)) PHOTOS = Object.assign({}, PHOTOS, m); });

  const results = await Promise.allSettled(jobs);
  results.forEach((res, idx) => {
    if (res.status === 'rejected'){
      console.warn('[CONTENT_SHEET] ' + labels[idx] + ' 탭 로드 실패 — 기본값 사용:', res.reason);
    }
  });
}

/* ========== NAVIGATION ========== */
function navigate(target) {
  // target: "stories", "applications", "awards", "partners", "case/{id}", or "app/{id}"
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (target.startsWith('case/')) {
    const caseId = target.slice(5);
    renderCaseDetail(caseId);
    document.getElementById('view-case').classList.add('active');
    document.querySelector('.nav-link[data-nav="stories"]').classList.add('active');
    window.location.hash = target;
  } else if (target.startsWith('app/')) {
    const appId = target.slice(4);
    renderAppDetail(appId);
    document.getElementById('view-app-detail').classList.add('active');
    document.querySelector('.nav-link[data-nav="applications"]').classList.add('active');
    window.location.hash = target;
  } else {
    document.getElementById('view-' + target).classList.add('active');
    const navBtn = document.querySelector(`.nav-link[data-nav="${target}"]`);
    if (navBtn) navBtn.classList.add('active');
    window.location.hash = target === 'home' ? '' : target;

    // 다른 메뉴를 거쳐 다시 들어왔을 때 기술지원/기술문서는 항상 초기 화면으로
    if (target === 'knowledgebase' && typeof kbState !== 'undefined') {
      kbState.view = 'home'; kbState.cat = null; kbState.search = '';
      kbState.page = 1; kbState.docId = null; kbState.ret = null;
      const ks = document.getElementById('kbSearch'); if (ks) ks.value = '';
      const kc = document.getElementById('kbSearchClear'); if (kc) kc.style.display = 'none';
      if (typeof renderKnowledgebase === 'function') renderKnowledgebase();
    }
    if (target === 'guides' && typeof guideModule !== 'undefined' && guideModule.reset) {
      guideModule.reset();
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.nav);
  });
});

/* ===== Business areas → Applications,  Services → Contact (prefilled) ===== */
function goToContactWith(topic) {
  navigate('contact');
  const msg = document.getElementById('ctMsg');
  if (msg) {
    msg.value = `[${topic}] 관련 문의드립니다.\n\n`;
    setTimeout(() => { msg.focus(); msg.setSelectionRange(msg.value.length, msg.value.length); }, 60);
  }
}
function goToAppsCat(catId) {
  if (catId && typeof appsState !== 'undefined') {
    appsState.category = catId; appsState.search = ''; appsState.sort = 'default'; appsState.page = 1;
    const s = document.getElementById('appsSearch'); if (s) s.value = '';
    const so = document.getElementById('appsSort'); if (so) so.value = 'default';
    renderAppsCategoryBar(); renderAppsGrid();
  }
  navigate('applications');
}
document.querySelectorAll('[data-go-contact]').forEach(el => {
  const fire = () => goToContactWith(el.dataset.goContact);
  el.addEventListener('click', fire);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
});
document.querySelectorAll('[data-go-apps]').forEach(el => {
  const fire = () => goToAppsCat(el.dataset.goApps);
  el.addEventListener('click', fire);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
});
/* Business-area photos → matched representative case study */
document.querySelectorAll('[data-go-case]').forEach(el => {
  const fire = () => { const id = el.dataset.goCase; if (CASE_DATA[id]) navigate('case/' + id); };
  el.addEventListener('click', fire);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
});

window.addEventListener('popstate', () => {
  const hash = window.location.hash.replace('#', '');
  if (!hash) navigate('home');
  else navigate(hash);
});

/* ========== STORIES / AWARDS / PARTNERS (시트 데이터로 렌더) ========== */
function renderData() {
/* ========== STORIES VIEW ========== */
const featuredGrid = document.getElementById('featuredGrid');
FEATURED_KEYS.forEach((key, idx) => {
  const c = CUSTOMERS.find(x => x.n === key);
  if (!c) return;
  const ind = INDUSTRIES[c.i];
  const num = String(idx + 1).padStart(2, '0');
  const caseId = key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const card = document.createElement('article');
  card.className = 'featured-card';
  card.dataset.caseId = caseId;
  card.dataset.industry = c.i;
  const _cardBg = CASE_HERO_BG[caseId];
  card.innerHTML = `
    <div class="fc-media">${_cardBg ? `<img class="fc-img" src="${_cardBg}" alt="${c.n}" loading="lazy" onerror="this.remove();">` : ''}</div>
    <div class="fc-body">
      <div class="num">CASE / ${num}</div>
      <div class="logo">${c.n}</div>
      <span class="tag ${ind.tag}">${ind.label}</span>
      <h3 class="headline">${c.h}</h3>
      <ul class="app-list">
        ${c.a.map(app => `<li>${app}</li>`).join('')}
      </ul>
      <a href="#" class="cta-link">자세히 보기</a>
    </div>
  `;
  card.addEventListener('click', e => {
    e.preventDefault();
    if (CASE_DATA[caseId]) navigate('case/' + caseId);
  });
  featuredGrid.appendChild(card);
});

const filterBar = document.getElementById('filterBar');
const counts = { all: CUSTOMERS.length };
CUSTOMERS.forEach(c => { counts[c.i] = (counts[c.i] || 0) + 1; });

filterBar.insertAdjacentHTML('beforeend',
  `<button class="filter-btn active" data-filter="all">전체 <span class="filter-count">${counts.all}</span></button>`
);
Object.entries(INDUSTRIES).forEach(([key, info]) => {
  if (!counts[key]) return;
  filterBar.insertAdjacentHTML('beforeend',
    `<button class="filter-btn" data-filter="${key}">${info.label} <span class="filter-count">${counts[key]}</span></button>`
  );
});

const cardsGrid = document.getElementById('cardsGrid');
CUSTOMERS.forEach(c => {
  const ind = INDUSTRIES[c.i];
  const caseId = c.n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isClickable = !!CASE_DATA[caseId];
  const card = document.createElement('article');
  card.className = 'case-card' + (isClickable ? ' clickable' : '');
  card.dataset.industry = c.i;
  card.innerHTML = `
    <div class="logo">${c.n}</div>
    <span class="tag ${ind.tag}">${ind.label}</span>
    <div class="headline">${c.h}</div>
    <ul class="apps">
      ${c.a.map(app => `<li>${app}</li>`).join('')}
    </ul>
  `;
  if (isClickable) {
    card.addEventListener('click', () => navigate('case/' + caseId));
  }
  cardsGrid.appendChild(card);
});

filterBar.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  document.querySelectorAll('.case-card').forEach(card => {
    const show = (filter === 'all') || card.dataset.industry === filter;
    card.classList.toggle('hidden', !show);
  });
});


/* ========== AWARDS VIEW ========== */
const byYear = {};
AWARDS.forEach(a => { (byYear[a.y] = byYear[a.y] || []).push(a); });
const yearsList = Object.keys(byYear).map(Number).sort((a,b) => b-a);
const maxCount = Math.max(...yearsList.map(y => byYear[y].length));
const awardCategories = Object.keys(CATEGORY_LABELS);

// ===== AWARD STATISTICS — category distribution =====
const awardCatBarsEl = document.getElementById('awardCatBars');
if (awardCatBarsEl) {
  const catCount = {};
  awardCategories.forEach(c => { catCount[c] = 0; });
  AWARDS.forEach(a => { catCount[a.c] = (catCount[a.c] || 0) + 1; });
  const ranked = awardCategories.slice().sort((a, b) => catCount[b] - catCount[a]);
  const maxCat = Math.max(...ranked.map(c => catCount[c])) || 1;
  ranked.forEach(c => {
    const n = catCount[c];
    const pct = Math.round((n / maxCat) * 100);
    awardCatBarsEl.insertAdjacentHTML('beforeend', `
      <div class="astat-bar" style="--cat-color: var(--tag-${c}-fg);">
        <span class="ab-label">${CATEGORY_LABELS[c]}</span>
        <span class="ab-track"><span class="ab-fill" style="width:${pct}%;"></span></span>
        <span class="ab-num">${n}</span>
      </div>
    `);
  });
}

const yearChips = document.getElementById('yearChips');
yearChips.insertAdjacentHTML('beforeend', `<button class="chip active" data-year="all">All</button>`);
yearsList.forEach(y => {
  yearChips.insertAdjacentHTML('beforeend', `<button class="chip" data-year="${y}">${y}</button>`);
});

const catChips = document.getElementById('catChips');
catChips.insertAdjacentHTML('beforeend', `<button class="chip active" data-cat="all">All</button>`);
awardCategories.forEach(c => {
  catChips.insertAdjacentHTML('beforeend', `<button class="chip" data-cat="${c}">${CATEGORY_LABELS[c]}</button>`);
});

const awardsList = document.getElementById('awardsList');
[...AWARDS].sort((a,b) => b.y - a.y).forEach(a => {
  const noteHtml = a.note ? `<span class="note">· ${a.note}</span>` : '';
  awardsList.insertAdjacentHTML('beforeend', `
    <li class="award" data-year="${a.y}" data-cat="${a.c}">
      <a class="award-link" href="${a.url || 'https://www.monnit.com/awards/'}" target="_blank" rel="noopener">
        <span class="award-year">${a.y}</span>
        <span class="award-dot dot-${a.c}"></span>
        <span class="award-name">${a.n}${noteHtml}<span class="award-more">자세히 보기 →</span></span>
        <span class="tag tag-${a.c}">${CATEGORY_LABELS[a.c]}</span>
      </a>
    </li>
  `);
});

let currentYear = 'all';
let currentCat = 'all';

function applyAwardsFilter() {
  let visible = 0;
  document.querySelectorAll('.award').forEach(el => {
    const matchYear = currentYear === 'all' || el.dataset.year === currentYear;
    const matchCat = currentCat === 'all' || el.dataset.cat === currentCat;
    const show = matchYear && matchCat;
    el.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('visibleCountAwards').textContent = `${visible} of ${AWARDS.length} awards`;
  document.getElementById('emptyAwards').style.display = visible === 0 ? 'block' : 'none';

  document.querySelectorAll('.dist-row').forEach(row => {
    row.classList.toggle('active', currentCat !== 'all' && row.dataset.cat === currentCat);
  });
}

yearChips.addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#yearChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentYear = btn.dataset.year;
  applyAwardsFilter();
});

catChips.addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentCat = btn.dataset.cat;
  applyAwardsFilter();
});

applyAwardsFilter();

/* ========== PARTNERS VIEW ========== */
const byRegion = {};
PARTNERS.forEach(p => { (byRegion[p.r] = byRegion[p.r] || []).push(p); });
const regions = ["na","as","eu","sa","oc","af"];

const regionChips = document.getElementById('regionChips');
regionChips.insertAdjacentHTML('beforeend', `<button class="chip active" data-region="all">All <span class="ct">${PARTNERS.length}</span></button>`);
regions.forEach(r => {
  const ct = (byRegion[r] || []).length;
  if (!ct) return;
  regionChips.insertAdjacentHTML('beforeend',
    `<button class="chip" data-region="${r}">${REGION_LABELS[r]} <span class="ct">${ct}</span></button>`
  );
});

const partnersList = document.getElementById('partnersList');
const orderedPartners = regions.flatMap(r => byRegion[r] || []);
orderedPartners.forEach(p => {
  partnersList.insertAdjacentHTML('beforeend', `
    <li class="partner" data-region="${p.r}">
      <a class="partner-link" href="${p.url || 'https://www.monnit.com/partner/current-partners/'}" target="_blank" rel="noopener">
        <span class="partner-dot dot-${p.r}"></span>
        <div class="partner-body">
          <span class="partner-name">${p.n}<span class="partner-more">사이트 방문 →</span></span>
          <span class="partner-desc">${p.d}</span>
        </div>
        <span class="tag tag-${p.r}">${REGION_LABELS[p.r]}</span>
      </a>
    </li>
  `);
});

let currentRegion = 'all';
const resetBtn = document.getElementById('resetBtn');

/* Build region cards (replaces the old world map) */
const REGION_COLORS = { na:'#85B6FF', sa:'#5FDDA0', eu:'#EBC062', as:'#FF9E78', af:'#CFBE9C', oc:'#F08FBE' };
const REGION_KO = { na:'북미', sa:'남미', eu:'유럽', as:'아시아', af:'아프리카', oc:'오세아니아' };
const regionGrid = document.getElementById('regionGrid');
const maxRegion = Math.max(...regions.map(r => (byRegion[r]||[]).length));
regions.forEach(r => {
  const ct = (byRegion[r] || []).length;
  if (!ct) return;
  const pct = Math.round(ct / PARTNERS.length * 100);
  const barW = Math.round(ct / maxRegion * 100);
  const card = document.createElement('button');
  card.className = 'region-card';
  card.dataset.region = r;
  card.style.setProperty('--rc-color', REGION_COLORS[r] || 'var(--accent)');
  card.innerHTML = `
    <div class="rc-top">
      <div>
        <div class="rc-name">${REGION_LABELS[r]}</div>
        <div class="rc-ko">${REGION_KO[r] || ''}</div>
      </div>
      <div class="rc-count">${ct}<span>곳</span></div>
    </div>
    <div class="rc-bar"><i style="width:${barW}%"></i></div>
    <div class="rc-share">전체 파트너의 ${pct}%</div>`;
  regionGrid.appendChild(card);
});
regionGrid.addEventListener('click', e => {
  const card = e.target.closest('.region-card');
  if (!card) return;
  const r = card.dataset.region;
  currentRegion = (currentRegion === r) ? 'all' : r;
  applyPartnersFilter();
});

function applyPartnersFilter() {
  let visible = 0;
  document.querySelectorAll('.partner').forEach(el => {
    const show = currentRegion === 'all' || el.dataset.region === currentRegion;
    el.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('visibleCountPartners').textContent = `${visible} of ${PARTNERS.length} partners`;
  document.getElementById('emptyPartners').style.display = visible === 0 ? 'block' : 'none';

  document.querySelectorAll('.region-card').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });

  document.querySelectorAll('#regionChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });

  resetBtn.classList.toggle('visible', currentRegion !== 'all');
}

regionChips.addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  currentRegion = btn.dataset.region;
  applyPartnersFilter();
});

resetBtn.addEventListener('click', () => {
  currentRegion = 'all';
  applyPartnersFilter();
});

applyPartnersFilter();
} /* ===== end renderData() ===== */

/* ========== CASE STUDY DETAIL RENDER ========== */
const CASE_HERO_BG = {
  'us-army': 'images/img-30.jpg',
  'exxonmobil': 'images/img-31.jpg',
  'gs-eps': 'images/img-32.jpg',
  'microsoft': 'images/img-33.jpg',
  'cbre': 'images/img-35.jpg',
  'walmart': 'images/img-36.jpg',
  'hyundai-motors': 'images/img-37.jpg',
  'samsung-biologics': 'images/img-45.jpg'
};
function renderCaseDetail(id) {
  const c = CASE_DATA[id];
  if (!c) { navigate('stories'); return; }

  const page = document.getElementById('casePage');
  page.style.setProperty('--accent', c.accent);
  page.style.setProperty('--accent-bg', c.accentBg);
  page.style.setProperty('--accent-text', c.accentText);

  const qsHtml = c.qs.map(q => `
    <div class="qs">
      <div class="qs-num" style="color:${c.accentText}">${q.n}</div>
      <div class="qs-lbl">${q.l}</div>
    </div>
  `).join('');

  const chHtml = c.challenges.map((t, i) => `
    <li>
      <span class="ch-num" style="color:${c.accentText}">${String(i+1).padStart(2,'0')}</span>
      <span class="ch-txt">${t}</span>
    </li>
  `).join('');

  const solHtml = c.solutions.map((s, i) => `
    <div class="sol-card" data-hover-bg="var(--surface-2)">
      <div class="sol-num">${String(i+1).padStart(2,'0')}</div>
      <h4>${s.t}</h4>
      <p>${s.d}</p>
    </div>
  `).join('');

  const resHtml = c.results.map(r => `
    <div class="res">
      <div class="res-num" style="color:${c.accentText}">${r.n}</div>
      <div class="res-lbl">${r.l}</div>
    </div>
  `).join('');

  page.innerHTML = `
    <div class="top-band" style="background:${c.accent}">
      <span class="label">Customer Success · Case Study ${c.num}</span>
      <span>${c.industry}</span>
    </div>

    <section class="hero">
      <div class="meta">Industry — ${c.industry}</div>
      <div class="case-logo" style="border-bottom:2px solid ${c.accentText}">${c.name}</div>
      <h1>${c.title.replace('<em>', `<em style="color:${c.accentText}">`)}</h1>
      <p class="tagline">${c.tagline}</p>
      <div class="qs-row">${qsHtml}</div>
    </section>

    <section class="sec">
      <div class="sec-label" style="color:${c.accentText}">About the Customer</div>
      <p class="body">${c.about}</p>
    </section>

    <section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Challenge</div>
      <h2>현장이 마주한 문제</h2>
      <ul class="ch-list">${chHtml}</ul>
    </section>

    <section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Solution</div>
      <h2>적용 어플리케이션</h2>
      <div class="sol-grid">${solHtml}</div>
    </section>

    <section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Architecture</div>
      <h2>솔루션 구성</h2>
      <div class="arch">
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}">◐</div>
          <div class="name">무선 센서 노드</div>
          <div class="desc">FIELD</div>
          <span class="arch-arrow" style="color:${c.accentText}">→</span>
        </div>
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}">◧</div>
          <div class="name">ALTA 게이트웨이</div>
          <div class="desc">AGGREGATE</div>
          <span class="arch-arrow" style="color:${c.accentText}">→</span>
        </div>
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}">◇</div>
          <div class="name">클라우드 플랫폼</div>
          <div class="desc">MQTTS / API</div>
          <span class="arch-arrow" style="color:${c.accentText}">→</span>
        </div>
        <div class="arch-node">
          <div class="ico" style="color:${c.accentText}">◉</div>
          <div class="name">통합 대시보드</div>
          <div class="desc">ANALYTICS</div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="sec-label" style="color:${c.accentText}">Results</div>
      <h2>도입 후 성과</h2>
      <div class="res-grid">${resHtml}</div>
    </section>

    <section class="quote-sec" style="background:${c.accentBg}">
      <blockquote style="--quote-color:${c.accent};color:#17213B">
        <span style="display:none">${c.quote}</span>
        ${c.quote}
      </blockquote>
      <cite style="color:${c.accent}">— ${c.cite}</cite>
    </section>

    <!-- INTEGRATION: related applications -->
    <section class="related-apps-section">
      <div class="related-apps-head">
        <div>
          <span class="kicker">Explore deeper</span>
          <h3 style="margin-top:8px;">관련 어플리케이션</h3>
        </div>
        <span class="meta">${c.name}가 활용하는 솔루션</span>
      </div>
      <div class="related-apps-grid" id="caseRelatedApps"></div>
    </section>

    <section class="sec photo-section">
      <div class="sec-label" style="color:${c.accentText}">Field Gallery</div>
      <h2>현장 · 설치 사진</h2>
      <div id="caseGallery" class="ph-wrap"></div>
    </section>
  `;

  // The blockquote::before quote mark needs accent color too — use a style block
  const styleId = 'case-quote-color';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `#casePage .quote-sec blockquote::before { color: ${c.accent}; }`;

  // Hover backgrounds for sol cards
  page.querySelectorAll('.sol-card').forEach(card => {
    const bg = card.dataset.hoverBg;
    card.addEventListener('mouseenter', () => card.style.background = bg);
    card.addEventListener('mouseleave', () => card.style.background = '');
  });

  // Render related applications (cross-link to Application library)
  const relatedAppIds = CUSTOMER_TO_APPS[c.name] || [];
  const raContainer = document.getElementById('caseRelatedApps');
  if (raContainer && relatedAppIds.length) {
    raContainer.innerHTML = relatedAppIds
      .map(aid => APPS.find(a => a.id === aid))
      .filter(Boolean)
      .map(app => `
        <button class="related-app-card" data-app-id="${app.id}">
          <span class="app-tag ${app.cat}">${CATEGORIES[app.cat].label}</span>
          <div class="ra-name">${app.name}</div>
          <div class="ra-desc">${app.desc}</div>
        </button>
      `).join('');
    raContainer.querySelectorAll('.related-app-card').forEach(card => {
      card.addEventListener('click', () => navigate('app/' + card.dataset.appId));
    });
  } else if (raContainer) {
    raContainer.parentElement.style.display = 'none';
  }

  document.getElementById('caseFooter').innerHTML = `
    <div class="ft-logo">Wireless IoT Monitoring</div>
    <div class="ft-meta">Case Study ${c.num} · ${c.name}</div>
  `;

  renderGalleryItems(document.getElementById('caseGallery'), (c.photos && c.photos.length) ? c.photos : getPhotos('case:' + id));
}

/* ========== APPLICATIONS DATA ========== */
let CATEGORIES = {  /* 기본값 — 구글 시트(AppCategories 탭)가 있으면 덮어씀 */
  env:    { name: "환경 모니터링",    label: "Environmental" },
  cold:   { name: "콜드체인 & 물류",  label: "Cold Chain" },
  health: { name: "의료 & 실험실",    label: "Healthcare" },
  indus:  { name: "산업 & 제조",      label: "Industrial" },
  fac:    { name: "시설 & 자산",      label: "Facility" },
  agri:   { name: "농업 & 야외",      label: "Agriculture" }
};

let APPS = [  /* 기본값 — 구글 시트(Applications 탭)가 있으면 덮어씀 */
  { id:"temp", name:"온도 모니터링", cat:"env", desc:"냉장·냉동·서버룸·실험실 등 전 산업의 핵심 측정 항목.", sensors:"TEMP", popularity:100, isNew:false, added:"2018-01" },
  { id:"leak", name:"누수 감지", cat:"env", desc:"서버룸·기계실·지하 공간의 물 접촉을 0.5초 이내 감지.", sensors:"WATER", popularity:88, isNew:false, added:"2018-03" },
  { id:"hvac", name:"HVAC 모니터링", cat:"env", desc:"공조 시스템의 효율·필터 상태·차압을 실시간 추적.", sensors:"DP · TEMP", popularity:72, isNew:false, added:"2018-06" },
  { id:"greenhouse", name:"그린하우스", cat:"env", desc:"온도·습도·CO₂·조도를 통합 관리해 작물 환경을 최적화.", sensors:"TEMP · CO₂", popularity:54, isNew:false, added:"2019-03" },
  { id:"refrig", name:"상업용 냉장", cat:"env", desc:"매장 냉장·냉동 진열대의 24/7 자동 추적.", sensors:"TEMP", popularity:84, isNew:false, added:"2018-09" },
  { id:"air", name:"공기질 모니터링", cat:"env", desc:"VOC·미세먼지·CO₂를 측정해 실내 환경 관리.", sensors:"AIR · VOC", popularity:60, isNew:true, added:"2025-09" },
  { id:"cold-chain", name:"콜드체인 모니터링", cat:"cold", desc:"매장에서 차량·창고까지 전 구간 온도 무결성 통합.", sensors:"TEMP · GPS", popularity:95, isNew:false, added:"2018-02" },
  { id:"logistics", name:"물류 & 창고", cat:"cold", desc:"대형 창고·물류센터의 다중 구역 환경 모니터링.", sensors:"TEMP · HUMID", popularity:78, isNew:false, added:"2018-05" },
  { id:"food", name:"식품 서비스", cat:"cold", desc:"레스토랑·급식 시설의 HACCP 준수 자동화.", sensors:"TEMP", popularity:70, isNew:false, added:"2018-08" },
  { id:"grocery", name:"그로서리 & 편의점", cat:"cold", desc:"다중 매장의 냉장 진열대와 백룸 통합 관리.", sensors:"TEMP", popularity:76, isNew:false, added:"2019-01" },
  { id:"transport", name:"수송 차량", cat:"cold", desc:"냉장 차량의 실시간 위치와 화물칸 온도 통합 추적.", sensors:"TEMP · GPS", popularity:58, isNew:true, added:"2025-11" },
  { id:"vaccine", name:"백신 모니터링", cat:"health", desc:"CDC VFC 프로그램 준수. −80°C 초저온 보관까지 자동 감사.", sensors:"ULT TEMP", popularity:92, isNew:false, added:"2020-04" },
  { id:"hospital", name:"병원 & 클리닉", cat:"health", desc:"혈액·조직·의약품 보관, 클린룸까지 의료 환경 전반.", sensors:"TEMP · DP", popularity:81, isNew:false, added:"2018-11" },
  { id:"lab", name:"실험실 & 제약", cat:"health", desc:"GxP·21 CFR Part 11 호환. 자동 감사 보고서 생성.", sensors:"TEMP · HUMID", popularity:74, isNew:false, added:"2019-05" },
  { id:"morgue", name:"영안실 & 조직", cat:"health", desc:"법의학·병리 시설의 시신·조직 보관 환경 24/7 추적.", sensors:"ULT TEMP", popularity:38, isNew:false, added:"2020-08" },
  { id:"pharma-cold", name:"제약 콜드체인", cat:"health", desc:"WHO PQS 준수 콜드체인. 백신 유통망 무손실 목표.", sensors:"TEMP · GPS", popularity:66, isNew:true, added:"2025-07" },
  { id:"manufact", name:"제조 라인", cat:"indus", desc:"베어링 진동·전류·온도로 라인 다운타임 사전 차단.", sensors:"VIB · CURRENT", popularity:86, isNew:false, added:"2018-04" },
  { id:"construct", name:"건설 현장", cat:"indus", desc:"장비 가동·환경 조건·자재 보관 통합 추적.", sensors:"MOTION · TEMP", popularity:52, isNew:false, added:"2019-08" },
  { id:"datacenter", name:"데이터센터 & 서버룸", cat:"indus", desc:"서버 입·출기 온도, 누수, 차압을 5분 알림으로.", sensors:"TEMP · WATER · DP", popularity:90, isNew:false, added:"2018-07" },
  { id:"energy", name:"에너지 탐사", cat:"indus", desc:"원격지 시추·정제 시설의 진동·압력·온도 추적.", sensors:"VIB · PRESSURE", popularity:44, isNew:false, added:"2020-02" },
  { id:"solar", name:"태양광 & 재생에너지", cat:"indus", desc:"패널 온도·전력·인버터 상태로 발전 효율 최적화.", sensors:"TEMP · CURRENT", popularity:56, isNew:true, added:"2025-10" },
  { id:"facility", name:"시설 모니터링", cat:"fac", desc:"사무 빌딩·공장 시설의 출입·환경·에너지 통합 관제.", sensors:"OCC · DOOR · TEMP", popularity:68, isNew:false, added:"2018-12" },
  { id:"hospitality", name:"호텔 & 숙박", cat:"fac", desc:"객실 점유·미니바·욕실 누수 통합 운영.", sensors:"OCC · WATER", popularity:50, isNew:false, added:"2019-11" },
  { id:"financial", name:"금융기관", cat:"fac", desc:"지점 보안실·서버룸·금고 환경 통합 모니터링.", sensors:"TEMP · WATER", popularity:46, isNew:false, added:"2020-05" },
  { id:"vacant", name:"공실 부동산", cat:"fac", desc:"장기 공실 부동산의 누수·동파·침입 원격 추적.", sensors:"WATER · TEMP", popularity:40, isNew:false, added:"2021-02" },
  { id:"smartcity", name:"스마트시티", cat:"fac", desc:"공공 시설·주차·환경을 대규모 IoT 메시로 운영.", sensors:"MULTI · LoRaWAN", popularity:36, isNew:true, added:"2025-12" },
  { id:"livestock", name:"축산 & 농업", cat:"agri", desc:"축사 환경·사료 보관·관개 시설 통합 관리.", sensors:"TEMP · HUMID", popularity:48, isNew:false, added:"2019-06" },
  { id:"marina", name:"마리나 & 보트", cat:"agri", desc:"정박지 빌지펌프·배터리·습도를 원격 추적.", sensors:"WATER · VOLTAGE", popularity:32, isNew:false, added:"2020-11" },
  { id:"pet", name:"반려동물 복지", cat:"agri", desc:"켄넬·축사·동물 의료 시설 환경 자동 관리.", sensors:"TEMP · HUMID", popularity:28, isNew:false, added:"2021-04" },
  { id:"pest", name:"해충 방역", cat:"agri", desc:"트랩 감지·환경 추적으로 PCO 운영을 데이터화.", sensors:"TRAP · MOTION", popularity:24, isNew:false, added:"2021-08" },
  { id:"grow", name:"그로하우스", cat:"agri", desc:"대마·약용 작물 시설의 조도·CO₂·온도 정밀 제어.", sensors:"LIGHT · CO₂", popularity:42, isNew:true, added:"2025-08" }
  /* ── Monnit 공식 Use Case 라이브러리(자료 다운로드 연결) ── */
  ,{ id:"uc-mold", name:"곰팡이 제거·예방", cat:"env", desc:"수해·누수 후 건조 현장의 온습도를 추적해 곰팡이 재발과 2차 피해를 방지.", sensors:"TEMP · HUMID", popularity:46, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-mold-remediation.pdf" }
  ,{ id:"uc-plant-maint", name:"플랜트 예지보전", cat:"indus", desc:"검사·시험 설비의 진동·온도를 상시 감시해 고장 전 이상을 포착.", sensors:"VIB · TEMP", popularity:55, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-magnetic-inspection-laboratory.pdf" }
  ,{ id:"uc-hot-yoga", name:"핫요가 스튜디오 공조", cat:"env", desc:"스튜디오의 온도·습도를 자동 제어해 수업 환경을 일정하게 유지.", sensors:"TEMP · HUMID", popularity:34, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-yoga-studio-climate-control.pdf" }
  ,{ id:"uc-smart-farm", name:"농장·온실 환기 자동화", cat:"agri", desc:"온실·축사의 온습도·환기를 자동화해 작물·가축 환경을 최적화.", sensors:"TEMP · HUMID · CO₂", popularity:48, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-smart-farms.pdf" }
  ,{ id:"uc-nicu", name:"신생아 집중치료실(NICU)", cat:"health", desc:"인큐베이터·보관고 등 핵심 의료 장비의 환경을 24/7 감시.", sensors:"TEMP · HUMID", popularity:52, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/iot-nicu-monitoring-use-case.pdf" }
  ,{ id:"uc-hvac", name:"상업용 냉난방(HVAC)", cat:"env", desc:"공조 설비의 차압·온도를 추적해 효율과 필터 교체 시점을 관리.", sensors:"DP · TEMP", popularity:60, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-HVAC.pdf" }
  ,{ id:"uc-restaurant", name:"레스토랑·외식 서비스", cat:"cold", desc:"주방 냉장·냉동 설비의 온도를 자동 기록해 HACCP 준수를 지원.", sensors:"TEMP", popularity:58, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-restaurant-and-food-services.pdf" }
  ,{ id:"uc-convenience", name:"편의점", cat:"cold", desc:"다중 점포의 냉장 진열대·워크인을 통합 온도 관리.", sensors:"TEMP", popularity:50, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-convenience-store.pdf" }
  ,{ id:"uc-school-cafeteria", name:"학교 급식실 냉장·냉동고", cat:"cold", desc:"급식 워크인 쿨러·프리저의 온도를 상시 추적해 식품 안전 확보.", sensors:"TEMP", popularity:44, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-school-cafeteria.pdf" }
  ,{ id:"uc-datacenter", name:"서버룸·데이터센터", cat:"indus", desc:"랙 온도·누수·차압을 정밀 추적해 다운타임과 장비 손상을 예방.", sensors:"TEMP · WATER · DP", popularity:62, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-data-center-management.pdf" }
  ,{ id:"uc-pharma-refrig", name:"의약품 냉장 보관", cat:"health", desc:"의약품·백신 보관고의 온도를 규정에 맞게 자동 감사·기록.", sensors:"TEMP", popularity:54, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-pharmaceutical-refrigeration.pdf" }
  ,{ id:"uc-perishable-food", name:"신선식품 제조", cat:"cold", desc:"가공·보관 전 구간의 온습도를 통합 관리해 품질과 폐기 손실 관리.", sensors:"TEMP · HUMID", popularity:47, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-perishable-food-manufacturing.pdf" }
  ,{ id:"uc-commercial-building", name:"상업용 빌딩 관리", cat:"fac", desc:"빌딩의 환경·에너지·점유·누수를 단일 플랫폼으로 통합 관제.", sensors:"OCC · TEMP · WATER", popularity:57, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-commercial-building-management.pdf" }
  ,{ id:"uc-retail", name:"리테일 매장 관리", cat:"fac", desc:"매장의 냉장·환경·출입을 통합 모니터링해 운영을 자동화.", sensors:"TEMP · OCC", popularity:49, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-retail-store-management.pdf" }
  ,{ id:"uc-hotels", name:"호텔·숙박", cat:"fac", desc:"객실 점유·욕실 누수·공용 시설 환경을 통합 운영.", sensors:"OCC · WATER", popularity:45, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-hotels-and-hospitality.pdf" }
  ,{ id:"uc-apartment", name:"아파트·임대 부동산 관리", cat:"fac", desc:"세대·공용부의 누수·동파·환경을 원격 감시해 피해를 예방.", sensors:"WATER · TEMP", popularity:43, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-apartment-property-management.pdf" }
  ,{ id:"uc-manufacturing", name:"제조·생산", cat:"indus", desc:"설비 진동·전류·온도로 라인 다운타임을 사전에 차단.", sensors:"VIB · CURRENT", popularity:59, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-manufacturing-and-production.pdf" }
  ,{ id:"uc-greenhouse", name:"온실 모니터링", cat:"agri", desc:"온도·습도·CO₂·조도를 통합 관리해 작물 생육 환경을 최적화.", sensors:"TEMP · CO₂", popularity:46, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/iot-greenhouse-use-case.pdf" }
  ,{ id:"uc-second-home", name:"별장·세컨드하우스", cat:"fac", desc:"비어 있는 별장의 누수·동파·침입을 원격으로 상시 감시.", sensors:"WATER · TEMP", popularity:30, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-second-and-vacation-homes.pdf" }
  ,{ id:"uc-schools-churches", name:"학교·교회", cat:"fac", desc:"공간 점유·온도·누수를 모니터링해 시설 운영과 에너지를 관리.", sensors:"TEMP · OCC", popularity:33, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-schools-and-churches.pdf" }
  ,{ id:"uc-foreclosed", name:"압류 부동산 관리", cat:"fac", desc:"관리 인력이 없는 공실 부동산의 누수·동파를 원격 추적.", sensors:"WATER · TEMP", popularity:28, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-foreclosed-property-management.pdf" }
  ,{ id:"uc-pest-control", name:"해충 방역·열처리", cat:"agri", desc:"트랩 감지와 열처리 온도 추적으로 방역 작업을 데이터화.", sensors:"TRAP · TEMP", popularity:35, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/iot-for-pest-control-use-case.pdf" }
  ,{ id:"uc-elderly", name:"노인 케어 모니터링", cat:"health", desc:"움직임·환경을 감지해 독거·요양 환경의 안전을 원격 확인.", sensors:"MOTION · TEMP", popularity:40, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-adult-and-elderly-care.pdf" }
  ,{ id:"uc-dormitory", name:"대학 기숙사", cat:"fac", desc:"기숙사의 점유·온도·누수를 모니터링해 시설을 효율 운영.", sensors:"OCC · TEMP", popularity:31, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-college-and-university-housing.pdf" }
  ,{ id:"uc-storage", name:"보관·창고 시설", cat:"fac", desc:"셀프스토리지·창고의 온습도·침입·누수를 원격 통합 관리.", sensors:"TEMP · HUMID", popularity:37, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-storage-facilities.pdf" }
  ,{ id:"uc-financial", name:"금융 서비스", cat:"fac", desc:"지점 서버실·금고·보관실의 환경과 누수를 통합 감시.", sensors:"TEMP · WATER", popularity:39, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/financial-services-use-case.pdf" }
  ,{ id:"uc-pet-welfare", name:"K9·반려동물 복지", cat:"agri", desc:"켄넬·동물 시설의 온습도를 관리해 동물 복지와 안전을 확보.", sensors:"TEMP · HUMID", popularity:29, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/use-case-pet-animal-welfare.pdf" }
  ,{ id:"uc-solar", name:"태양광 발전 모니터링", cat:"indus", desc:"패널 온도·전류·인버터 상태를 추적해 발전 효율을 최적화.", sensors:"TEMP · CURRENT", popularity:41, isNew:false, added:"2024-06", file:"https://cdn.monnit.com/content/documents/applications/UCM-030-Solar-Energy-Monitoring.pdf" }
  ,{ id:"uc-aquaculture", name:"양식장·아쿠아컬처", cat:"agri", desc:"수온·수위·환경을 상시 추적해 양식 생산성과 폐사 리스크를 관리.", sensors:"TEMP · WATER", popularity:36, isNew:false, added:"2024-06", file:"https://monnit.blob.core.windows.net/site/documents/use-case/case-study-fish-farms-aquaculture.pdf" }
];

/* ========== APP → CUSTOMERS MAPPING ========== */
/* Manual curation: link applications to actual customers from CUSTOMERS array */
const APP_TO_CUSTOMERS = {
  manufact:    ["Hyundai Motors", "3M", "GE", "Siemens", "Volvo"],
  datacenter:  ["Microsoft", "Intel", "C7 Data Centers", "Amazon", "Shutterstock"],
  "cold-chain":["Walmart", "Costco", "Wegmans", "Nestlé", "FedEx"],
  vaccine:     ["Samsung Biologics", "Merck & Co", "CDC", "Bayer", "ANTHC"],
  hvac:        ["CBRE", "JLL", "Arup", "Microsoft", "Intermountain Healthcare"],
  leak:        ["Microsoft", "Walmart", "C7 Data Centers", "Arup", "Methodist Hospital"],
  facility:    ["CBRE", "JLL", "Arup", "Fordham University", "Wyndham"],
  food:        ["Dairy Queen", "Chick-fil-A", "Subway", "Zaxby's", "Walmart"],
  grocery:     ["Walmart", "Costco", "Wegmans", "Racetrac"],
  hospital:    ["Methodist Hospital", "UA Cancer Center", "Intermountain Healthcare"],
  lab:         ["Samsung Biologics", "Bayer", "Merck & Co", "Cal Biotech", "UA Cancer Center"],
  "pharma-cold":["Samsung Biologics", "Merck & Co", "Bayer", "ANTHC"],
  energy:      ["ExxonMobil", "Shell", "Aramco", "PTT", "ENGIE"],
  refrig:      ["Walmart", "Costco", "Wegmans", "Dairy Queen"],
  temp:        ["Samsung Biologics", "ExxonMobil", "Walmart", "Microsoft", "Hyundai Motors", "CBRE"],
  logistics:   ["Amazon", "FedEx", "Walmart", "Nestlé"],
  transport:   ["FedEx", "Walmart", "Nestlé"],
  construct:   ["VINCI", "Arup"],
  solar:       ["ENGIE", "Tacoma Power", "PTT"],
  hospitality: ["Wyndham", "Noralta Lodge", "Silverton"],
  livestock:   ["Gaia Herbs", "Stone Edge Farm"],
  greenhouse:  ["Stone Edge Farm", "Gaia Herbs"]
};

/* Customer → app IDs (reverse mapping used by case study detail's related apps) */
const CUSTOMER_TO_APPS = {
  "Samsung Biologics": ["vaccine", "lab", "pharma-cold", "hospital"],
  "ExxonMobil":        ["manufact", "energy", "leak", "facility"],
  "Walmart":           ["cold-chain", "food", "refrig", "leak"],
  "Microsoft":         ["datacenter", "hvac", "leak", "facility"],
  "Hyundai Motors":    ["manufact", "facility", "logistics"],
  "CBRE":              ["facility", "hvac", "leak", "hospitality"],
  "US Army":           ["manufact", "facility", "leak", "energy"],
  "GS EPS":            ["energy", "manufact", "leak", "facility"]
};

/* ========== APPLICATION DETAILS (rich content for 6 priority apps) ========== */
let APP_DETAILS = {  /* 기본값 — 구글 시트(AppDetails 탭)가 있으면 덮어씀 */
  vaccine: {
    snapshot: [
      {label:"주요 고객", value:"병원·클리닉·약국", desc:"CDC VFC 등록 시설"},
      {label:"ROI 회수", value:"<6개월", desc:"단일 사고 회피만으로 회수"},
      {label:"컴플라이언스", value:"100%", desc:"CDC·21 CFR Part 11"}
    ],
    customer: {
      lead: "CDC VFC 프로그램에 등록된 의료 시설부터 대학병원 약국까지 — 백신을 보관·관리하는 모든 조직이 대상입니다.",
      paragraphs: [
        "단일 클리닉 기준으로 평균 5–10대의 의료용 냉동·냉장 보관고를 운영하며, 보관 가치가 수십만 달러에 달하는 백신을 다룹니다. 의료 시설 특성상 24/7 누군가가 모니터링할 수 없는 구조이며, 야간·주말에도 보관 환경이 유지되어야 합니다.",
        "지역 약국 체인부터 대학병원 약국, 보건소까지 — 규모와 무관하게 같은 규제와 동일한 비즈니스 리스크에 노출되어 있습니다."
      ]
    },
    challenge: {
      lead: "백신 보관 사고는 자산 손실이 아니라 환자 안전과 직결됩니다. 그러나 대부분의 시설은 여전히 수동 기록에 의존합니다.",
      pains: [
        {title:"야간·주말 사고 인지 지연", desc:"정전이나 보관고 고장이 발생해도 다음 영업일에야 발견되는 경우가 흔합니다."},
        {title:"수기 기록의 무결성 문제", desc:"21 CFR Part 11 감사 시 데이터 위·변조 가능성을 입증하기 어렵습니다."},
        {title:"VFC 위반 시 직접 제재", desc:"CDC VFC 프로그램 위반 시 백신 폐기 보고와 함께 재공급 자격이 정지될 수 있습니다."},
        {title:"단일 사고당 평균 $11K–$40K 손실", desc:"보관고 한 대의 사고로도 수만 달러 규모의 백신이 폐기됩니다."}
      ]
    },
    solution: {
      lead: "Monnit ALTA 초저온 센서가 보관고 내부 온도를 1분 단위로 측정하고, ALTA Advanced Edge Gateway가 cryptographic 서명으로 데이터 무결성을 보장합니다.",
      paragraphs: [
        "센서는 −200°C까지 측정 가능한 의료용 등급으로, 백신 보관고 어디서나 즉시 설치할 수 있습니다. Gateway는 100대 센서까지 동시에 통합하며, AWS·Azure·GCP 어디로든 MQTTS로 데이터를 송출합니다.",
        "iMonnit Express V4는 CDC VFC 프로그램이 요구하는 보고서 양식을 자동으로 생성합니다. 감사 대비를 별도 작업 없이 끝낼 수 있습니다."
      ],
      sensors: ["ALTA Ultra-Low Temp", "ALTA Open/Closed", "ALTA Advanced Edge Gateway", "iMonnit Express V4"]
    },
    proposal: {
      lead: "1–2일 내 설치 완료. 운영 중단 없이 단계별로 도입 가능합니다.",
      phases: [
        {tag:"PHASE 1", title:"현장 평가", desc:"보관고 위치·기존 환경·통신 가용성 확인.", duration:"반나절"},
        {tag:"PHASE 2", title:"설치 & 페어링", desc:"센서 설치, 게이트웨이 페어링, 클라우드 연결.", duration:"1일"},
        {tag:"PHASE 3", title:"iMonnit 설정", desc:"알림 임계값·담당자 라우팅·테스트 가동.", duration:"반나절"},
        {tag:"PHASE 4", title:"교육 & 인계", desc:"운영팀 사용 교육, 감사 보고서 생성 절차 인계.", duration:"반나절"}
      ]
    },
    roi: {
      lead: "보관고 1대당 평균 $11,000+의 사고를 방지하면 초기 투자는 단일 사고 회피만으로 회수됩니다.",
      metrics: [
        {num:"$11K+", desc:"사고당 평균 백신 폐기 비용 방지"},
        {num:"100%",  desc:"CDC VFC 컴플라이언스 자동 준수"},
        {num:"<6개월", desc:"평균 ROI 회수 기간"}
      ],
      before: "야간·주말 사고 인지 지연. 수기 온도 기록. 감사 시 매번 수동으로 데이터 정리.",
      after:  "5분 이내 SMS·전화 알림. cryptographic 서명 자동 로그. 감사 보고서 클릭 한 번에 생성."
    }
  },
  datacenter: {
    snapshot: [
      {label:"주요 고객", value:"엔터프라이즈 IT", desc:"데이터센터·서버룸 운영팀"},
      {label:"사고 대응", value:"5분", desc:"평균 알림 도달 시간"},
      {label:"방지 비용", value:"$260K/h", desc:"다운타임 시간당 평균 비용"}
    ],
    customer: {
      lead: "사내 데이터센터를 운영하는 엔터프라이즈 IT 조직, 코로케이션 사업자, MSP가 주요 대상입니다.",
      paragraphs: [
        "수십에서 수백 개의 서버 랙을 운영하며, 24/7 무중단 가용성이 핵심 KPI입니다. ASHRAE 권장 온도 범위(18–27°C)를 벗어나면 장비 수명 단축과 다운타임 리스크가 급증합니다.",
        "특히 수냉식 시스템과 CRAH 유닛 주변의 누수 사고는 짧은 시간에 수백만 달러의 자산 손실로 이어질 수 있어, 사고 발생 즉시 인지가 비즈니스 연속성을 결정합니다."
      ]
    },
    challenge: {
      lead: "기존 BMS는 랙 단위 정밀 측정이 어렵고, 누수 사고 시 첫 발견까지 평균 2–4시간이 걸립니다.",
      pains: [
        {title:"랙 단위 온도 모니터링 부재", desc:"Hot spot이 발생해도 BMS 평균 데이터로는 잡히지 않습니다."},
        {title:"누수 사고 발견 지연", desc:"야간·주말 누수는 첫 발견까지 수 시간이 소요됩니다."},
        {title:"다운타임 1시간당 평균 $260K 손실", desc:"Ponemon 연구 기준, 엔터프라이즈 데이터센터의 시간당 다운타임 비용입니다."},
        {title:"기존 BMS와의 통합 한계", desc:"고가의 신규 시스템 구축 없이는 정밀 모니터링이 어렵습니다."}
      ]
    },
    solution: {
      lead: "ALTA 무선 센서를 랙·CRAH·서버룸 곳곳에 배치해 기존 BMS를 보완·확장합니다. 5분 이내 다중 채널 알림으로 사고 대응 시간을 단축합니다.",
      paragraphs: [
        "Temperature·Differential Pressure·Water Detection 센서를 랙 입출구, 통로, 수냉 시스템 주변에 배치합니다. ALTA Advanced Edge Gateway가 통합 후 AWS로 직접 송출해 기존 모니터링 스택과 자연스럽게 통합됩니다.",
        "누수 사고 발생 시 SMS·전화·푸시·이메일이 동시에 발송되며, iMonnit Express V4의 자동 보고서로 사고 원인 분석을 지원합니다."
      ],
      sensors: ["ALTA Temperature", "ALTA Water Detection Plus", "ALTA Differential Pressure", "ALTA Advanced Edge Gateway"]
    },
    proposal: {
      lead: "랙 수에 따라 1–4주 단계 배포. 운영 중인 데이터센터의 가동 중단 없이 점진적으로 확장 가능합니다.",
      phases: [
        {tag:"PHASE 1", title:"Critical Zone 파일럿", desc:"Mission-critical 랙 10–20개에 우선 배치.", duration:"1주"},
        {tag:"PHASE 2", title:"전체 랙 확장", desc:"남은 랙·통로·CRAH 주변 일괄 배치.", duration:"2–3주"},
        {tag:"PHASE 3", title:"AWS 통합", desc:"기존 CloudWatch·PagerDuty 알림 채널과 통합.", duration:"3–5일"},
        {tag:"PHASE 4", title:"Runbook 통합", desc:"온콜 대응 절차서에 IoT 알림 워크플로 추가.", duration:"2–3일"}
      ]
    },
    roi: {
      lead: "단 한 번의 누수 사고나 다운타임 회피만으로도 5년 TCO를 초과하는 가치를 회복합니다.",
      metrics: [
        {num:"$260K/h", desc:"방지된 다운타임 시간당 비용"},
        {num:"5분",     desc:"사고 대응 시간 (이전: 평균 2-4시간)"},
        {num:"<3개월",  desc:"Critical Zone 파일럿 ROI 회수"}
      ],
      before: "BMS 평균 데이터로 hot spot 미감지. 누수 사고 평균 2–4시간 후 발견. 사고 시 원인 분석 수동.",
      after:  "랙 단위 정밀 온도 추적. 누수 5분 이내 다중 채널 알림. 자동 사고 보고서로 root cause 즉시 파악."
    }
  },
  "cold-chain": {
    snapshot: [
      {label:"주요 고객", value:"식품 유통·물류", desc:"다중 매장·차량 보유 기업"},
      {label:"손실 감축", value:"70%↓", desc:"콜드체인 손실률"},
      {label:"ROI 회수", value:"<12개월", desc:"200대 센서 배포 기준"}
    ],
    customer: {
      lead: "다중 매장을 운영하는 식품 유통사, 물류센터, 콜드체인 수송 사업자가 주요 대상입니다.",
      paragraphs: [
        "수십에서 수백 개 매장의 냉장·냉동 설비를 운영하며, 동시에 수송 차량 플릿을 관리합니다. 콜드체인 평균 손실률은 업계 평균 7%로, 연 매출 1억 달러 규모 유통사 기준 연간 700만 달러 이상의 손실이 발생합니다.",
        "HACCP, FSMA 등 식품 안전 규제 준수와 함께 식품 폐기를 줄이는 ESG 목표까지 동시에 달성해야 하는 압박이 큽니다."
      ]
    },
    challenge: {
      lead: "매장·차량·창고가 각각 다른 시스템으로 모니터링되어, 전 구간 무결성을 보장하기 어렵습니다.",
      pains: [
        {title:"매장·차량 모니터링 분리", desc:"각 구간이 개별 시스템으로 운영돼 전체 추적이 불가능합니다."},
        {title:"야간·주말 사고 대응 지연", desc:"정전이나 냉장 장비 고장 시 인지가 늦어집니다."},
        {title:"HACCP 감사 시 수동 보고서", desc:"각 매장 데이터를 모아 보고서를 만드는 데 수십 시간이 소요됩니다."},
        {title:"콜드체인 사고당 평균 $5K–$25K 손실", desc:"단일 진열대 사고만으로도 상당한 손실이 발생합니다."}
      ]
    },
    solution: {
      lead: "ALTA 센서 200대 이상을 매장·차량·창고에 분산 배치하고, ALTA Edge Gateway가 모두 통합해 단일 클라우드 대시보드로 운영합니다.",
      paragraphs: [
        "매장의 냉장·냉동 진열대에는 Low Temperature Sensor와 Open/Closed Sensor를, 수송 차량에는 Asset GPS Tracker와 결합된 Temperature Sensor를 배치합니다. 다중 매장 환경에서는 ALTA Cellular Gateway가 셀룰러 백홀로 안정적인 송출을 보장합니다.",
        "iMonnit Multi-site 대시보드가 모든 매장·차량·창고의 실시간 상태를 보여주며, HACCP 보고서를 매월 자동 생성합니다."
      ],
      sensors: ["ALTA Low Temperature", "ALTA Asset GPS Tracker", "ALTA Open/Closed", "ALTA Cellular Gateway", "iMonnit Multi-site"]
    },
    proposal: {
      lead: "10개 매장 파일럿부터 시작해 전 매장으로 확장하는 단계적 접근이 표준입니다.",
      phases: [
        {tag:"PHASE 1", title:"10개 매장 파일럿", desc:"Critical 매장 선별, 센서·게이트웨이 배치, 데이터 검증.", duration:"3주"},
        {tag:"PHASE 2", title:"데이터 패턴 분석", desc:"파일럿 데이터로 알림 임계값 최적화·ROI 검증.", duration:"1개월"},
        {tag:"PHASE 3", title:"전 매장 확장", desc:"동일 구성으로 전체 매장 일괄 배포.", duration:"2–3개월"},
        {tag:"PHASE 4", title:"차량 플릿 통합", desc:"수송 차량까지 GPS+Temp 통합 운영.", duration:"1개월"}
      ]
    },
    roi: {
      lead: "200대 센서 배포 기준 12개월 내 ROI 회수, 이후 연 5–10%의 콜드체인 손실 감축이 지속됩니다.",
      metrics: [
        {num:"70%↓",    desc:"콜드체인 손실률 감축"},
        {num:"$5–25K",  desc:"방지된 사고당 평균 비용"},
        {num:"100시간↓", desc:"연간 HACCP 보고서 작성 시간"}
      ],
      before: "매장별 수동 온도 점검. 차량 환경 추적 부재. HACCP 감사 시 데이터 취합에 수십 시간.",
      after:  "다중 매장·차량 통합 대시보드. 사고 5분 이내 알림. HACCP 보고서 매월 자동 생성."
    }
  },
  manufact: {
    snapshot: [
      {label:"주요 고객", value:"제조업·라인 운영", desc:"Discrete·process 제조"},
      {label:"다운타임 방지", value:"$260K/h", desc:"시간당 평균 손실 방지"},
      {label:"정비 전환", value:"예측", desc:"사후→예측 정비 전환"}
    ],
    customer: {
      lead: "자동차 부품, 항공·국방, 식음료, 화학 등 생산 라인을 가진 모든 제조업이 대상입니다.",
      paragraphs: [
        "수십에서 수백 대의 모터·펌프·컴프레서·컨베이어를 운영하며, 라인 다운타임 1시간당 평균 $260,000의 손실이 발생합니다 (Aberdeen Group 기준).",
        "기존 정비 방식은 사후 대응형(BD) 또는 시간 기반 예방 정비(PM)인데, 두 방식 모두 비용 효율이 낮고 예측 정확도가 떨어집니다."
      ]
    },
    challenge: {
      lead: "장비 이상은 발생 수 시간 전부터 진동·전류·온도에서 신호를 보내지만, 이를 감지하지 못합니다.",
      pains: [
        {title:"사후 대응 정비의 한계", desc:"장비가 고장난 후에야 인지하므로 라인 전체가 멈춥니다."},
        {title:"시간 기반 PM의 비효율", desc:"고장 위험과 무관하게 정해진 주기로 정비해 비용이 낭비됩니다."},
        {title:"진동·전류 데이터 부재", desc:"ISO 10816 기준의 정밀 진동 측정이 라인에 적용되지 않습니다."},
        {title:"라인 다운타임 시간당 $260K", desc:"단일 핵심 장비 고장이 라인 전체를 정지시킵니다."}
      ]
    },
    solution: {
      lead: "ALTA Vibration Sensor가 ISO 10816 기준 3축 진동을 측정하고, Current Sensor가 부하 패턴을 추적해 장비 이상을 사전 감지합니다.",
      paragraphs: [
        "Vibration Sensor는 베어링·모터·펌프 표면에 자석 또는 볼트로 부착되어, 진동 RMS 값이 ISO 기준을 초과하면 즉시 알림을 발송합니다. Current Sensor는 패널 박스의 전류를 측정해 부하 변화·기동 패턴 이상을 감지합니다.",
        "ALTA Advanced Edge Gateway는 산업 환경 IP65 등급으로, 매크로 기능으로 JSON·XML 출력을 지원해 기존 MES·SCADA 시스템과 통합됩니다."
      ],
      sensors: ["ALTA Vibration", "ALTA Current", "ALTA Temperature", "ALTA Advanced Edge Gateway"]
    },
    proposal: {
      lead: "Critical 장비 10–20대 파일럿으로 시작해 라인 전체로 확장합니다.",
      phases: [
        {tag:"PHASE 1", title:"Critical 장비 식별", desc:"다운타임 영향이 큰 장비 우선 선정.", duration:"1주"},
        {tag:"PHASE 2", title:"센서 배치 & 베이스라인", desc:"센서 설치 후 1개월간 정상 운영 패턴 수집.", duration:"1개월"},
        {tag:"PHASE 3", title:"알림 임계값 튜닝", desc:"ISO 10816 기준 + 장비별 특성 반영해 임계값 설정.", duration:"2주"},
        {tag:"PHASE 4", title:"라인 전체 확장", desc:"검증된 구성으로 라인 전체 일괄 배포.", duration:"2–3개월"}
      ]
    },
    roi: {
      lead: "단일 라인 다운타임 회피만으로도 전체 투자 회수 가능. 이후 PM 비용 30–50% 추가 절감.",
      metrics: [
        {num:"$260K/h", desc:"방지된 라인 다운타임 비용"},
        {num:"40%↓",    desc:"예방 정비 작업 시간 감축"},
        {num:"<6개월",  desc:"파일럿 ROI 회수 기간"}
      ],
      before: "사후 대응 정비. 정해진 주기로 PM 수행. 장비 이상을 청각·경험에 의존.",
      after:  "ISO 10816 기준 정밀 진동 추적. 이상 신호 자동 감지·정비팀 자동 호출. PM 주기를 데이터 기반으로 최적화."
    }
  },
  hvac: {
    snapshot: [
      {label:"주요 고객", value:"시설 운영팀", desc:"상업 빌딩·캠퍼스"},
      {label:"에너지 절감", value:"15–25%", desc:"공조 운영비 절감"},
      {label:"ROI 회수", value:"<18개월", desc:"표준 빌딩 기준"}
    ],
    customer: {
      lead: "상업 빌딩 운영팀, 캠퍼스 시설관리, 의료기관, 데이터센터 등 대규모 HVAC 시스템을 운영하는 조직.",
      paragraphs: [
        "HVAC는 평균 상업 빌딩 에너지의 40%를 차지하며, 부적절한 운영은 곧바로 비용 증가로 이어집니다. 그러나 대부분의 시설은 BMS의 평균 데이터에만 의존하고 있어 세부 비효율을 잡아내지 못합니다.",
        "필터 막힘, 덕트 누설, 펌프 부하 이상 등은 BMS만으로는 잘 보이지 않지만, 누적되면 막대한 에너지 낭비가 됩니다."
      ]
    },
    challenge: {
      lead: "BMS만으로는 필터 상태·덕트 누설·국부적 차압 문제를 진단하기 어렵습니다.",
      pains: [
        {title:"필터 막힘 사후 대응", desc:"정해진 교체 주기로만 관리해 막혀도 모르고 운영합니다."},
        {title:"구역별 차압 모니터링 부재", desc:"Zone별 정밀 차압이 없어 균형 손실이 누적됩니다."},
        {title:"펌프·팬 부하 변화 미감지", desc:"전류 이상이 정비 시점을 알려주지만, 측정 자체가 없습니다."},
        {title:"HVAC가 에너지 비용의 40%", desc:"비효율 누적이 곧 운영비 증가로 직결됩니다."}
      ]
    },
    solution: {
      lead: "기존 BMS를 대체하지 않고 보완합니다. ALTA 센서를 필터 전·후, 덕트, 펌프 패널 등 진단 포인트에 배치합니다.",
      paragraphs: [
        "Differential Pressure Sensor가 필터 차압을 추적해 정확한 교체 시점을 알려주고, Pipe Temperature Sensor가 냉·온수 배관 효율을 진단합니다. Current Sensor는 팬·펌프의 부하 변화를 감지해 정비 시점을 예측합니다.",
        "ALTA Edge Gateway는 BACnet 통합 옵션을 제공해 기존 BMS와 자연스럽게 데이터를 교환합니다."
      ],
      sensors: ["ALTA Differential Pressure", "ALTA Pipe Temperature", "ALTA Current", "ALTA Edge Gateway"]
    },
    proposal: {
      lead: "단일 빌딩 파일럿으로 절감 효과를 검증한 후 캠퍼스 전체로 확장합니다.",
      phases: [
        {tag:"PHASE 1", title:"기준 빌딩 선정", desc:"에너지 효율 진단 가능한 대표 빌딩 선정.", duration:"1주"},
        {tag:"PHASE 2", title:"센서 배치", desc:"필터·덕트·펌프 등 진단 포인트 12–20개 배치.", duration:"1주"},
        {tag:"PHASE 3", title:"3개월 데이터 분석", desc:"이전 BMS 데이터와 비교해 비효율 진단.", duration:"3개월"},
        {tag:"PHASE 4", title:"캠퍼스 확장", desc:"검증된 구성으로 다른 빌딩 일괄 배포.", duration:"2–4개월"}
      ]
    },
    roi: {
      lead: "표준 상업 빌딩 기준 18개월 내 ROI 회수, 이후 연 15–25% HVAC 운영비 절감이 지속됩니다.",
      metrics: [
        {num:"15–25%", desc:"HVAC 운영비 절감"},
        {num:"30%↓",   desc:"필터 교체 비용 감축"},
        {num:"<18개월", desc:"평균 ROI 회수 기간"}
      ],
      before: "BMS 평균 데이터만 보유. 필터 교체는 시간 기반. 펌프 이상은 고장 후 인지.",
      after:  "필터 차압 정밀 추적. 데이터 기반 교체 주기. 펌프·팬 부하 패턴으로 정비 시점 예측."
    }
  },
  leak: {
    snapshot: [
      {label:"주요 고객", value:"시설·IT·부동산", desc:"물 손실 리스크 보유 시설"},
      {label:"감지 시간", value:"0.5초", desc:"물 접촉 인지"},
      {label:"방지 비용", value:"$25K+", desc:"사고당 평균 자산 손실"}
    ],
    customer: {
      lead: "데이터센터·서버룸·기계실·지하 공간·공실 부동산 등 누수 사고 리스크가 있는 모든 시설.",
      paragraphs: [
        "단일 누수 사고로 평균 $25,000 이상의 자산 손실과 운영 중단이 발생합니다. 특히 서버룸이나 의료 시설의 누수는 수십만 달러 규모의 장비를 손상시킬 수 있습니다.",
        "야간·주말 누수는 다음 영업일에야 발견되는 경우가 많아, 피해 규모가 기하급수로 늘어납니다."
      ]
    },
    challenge: {
      lead: "누수는 발생 즉시 인지해야 피해를 최소화할 수 있지만, 대부분 시설은 시각적 점검에 의존합니다.",
      pains: [
        {title:"야간·주말 인지 불가", desc:"사람이 없는 시간대의 누수는 수 시간 후 발견됩니다."},
        {title:"감지 케이블 미설치", desc:"범위형 누수 감지가 가능한 시설이 드뭅니다."},
        {title:"동파 사고 사전 인지 부재", desc:"온도가 동결점 근처에 도달해도 감지하지 못합니다."},
        {title:"단일 사고당 $25K+ 손실", desc:"장비 피해와 운영 중단이 동시에 발생합니다."}
      ]
    },
    solution: {
      lead: "ALTA Water Detection 센서를 누수 가능성이 높은 위치에 배치해 0.5초 이내 즉시 알림을 발송합니다.",
      paragraphs: [
        "스팟형 센서는 단일 지점 감지에 사용하고, ALTA Water Detection Plus의 감지 케이블은 광범위한 누수 가능 구역을 단일 센서로 커버합니다. Temperature Sensor와 결합하면 동파 임계점을 사전에 알려줍니다.",
        "다중 채널 알림으로 SMS·전화·푸시·이메일이 동시 발송되어, 야간·주말에도 즉시 대응이 가능합니다."
      ],
      sensors: ["ALTA Water Detection", "ALTA Water Detection Plus", "ALTA Temperature", "ALTA Edge Gateway"]
    },
    proposal: {
      lead: "Critical 구역 우선 배치 후 전체 시설로 확장하는 3단계 접근.",
      phases: [
        {tag:"PHASE 1", title:"리스크 매핑", desc:"시설 도면에 누수 가능 지점·자산 가치 매핑.", duration:"2–3일"},
        {tag:"PHASE 2", title:"Critical 배치", desc:"고가 자산 주변·기계실 우선 센서 배치.", duration:"1주"},
        {tag:"PHASE 3", title:"전체 확장", desc:"지하·공실·외곽 구역까지 단계적 확장.", duration:"2–4주"}
      ]
    },
    roi: {
      lead: "단 한 번의 사고 회피만으로 전체 투자 회수. 보험료 인하 혜택까지 가능합니다.",
      metrics: [
        {num:"$25K+",  desc:"사고당 평균 방지 자산 손실"},
        {num:"0.5초",  desc:"물 접촉 감지 시간"},
        {num:"<3개월", desc:"Critical 구역 ROI 회수"}
      ],
      before: "시각적 점검에 의존. 야간·주말 누수 다음 영업일에 발견. 동파 사고 사전 인지 불가.",
      after:  "0.5초 이내 누수 감지. 다중 채널 즉시 알림. 동파 임계점 사전 경고로 사고 회피."
    }
  }
};

const DEFAULT_APP_DETAIL = {
  snapshot: [
    {label:"운영 방식", value:"24/7", desc:"무인 자동 모니터링"},
    {label:"알림 응답", value:"5분", desc:"평균 알림 도달 시간"},
    {label:"ROI 회수", value:"<12개월", desc:"평균 회수 기간"}
  ],
  customer: {
    lead: "산업·환경 모니터링이 필요한 다양한 규모의 조직이 이 솔루션을 도입합니다.",
    paragraphs: [
      "이 어플리케이션은 24/7 자동화된 환경 추적이 비즈니스 가치를 만들어내는 환경에 적합합니다. 작은 단위 매장부터 대규모 시설·캠퍼스까지 확장 가능합니다.",
      "기존 운영 방식이 사후 대응·수동 점검에 의존하고 있다면, IoT 기반 자동화가 가장 큰 효과를 만들어내는 영역입니다."
    ]
  },
  challenge: {
    lead: "이 영역의 공통 과제는 데이터 부재로 인한 사후 대응과 비효율 누적입니다.",
    pains: [
      {title:"수동 점검의 한계", desc:"사람이 없는 시간대의 사고를 인지할 수 없습니다."},
      {title:"데이터 기반 의사결정 부재", desc:"근거 데이터 없이 정비·운영 의사결정이 이루어집니다."},
      {title:"사고 발생 후 대응", desc:"예방이 아닌 사후 대응 비용이 누적됩니다."},
      {title:"규제·감사 대응 어려움", desc:"수동 기록만으로는 무결성 입증이 어렵습니다."}
    ]
  },
  solution: {
    lead: "Monnit ALTA 무선 센서가 1초 단위 데이터를 수집하고, ALTA Edge Gateway가 통합해 클라우드로 송출합니다.",
    paragraphs: [
      "센서는 10년 배터리 수명과 2,000ft 무선 범위로 설치 부담을 최소화합니다. Gateway는 100대 센서까지 통합하며, AWS·Azure·GCP 어디로든 MQTTS로 송출됩니다.",
      "iMonnit Express V4가 즉시 사용 가능한 대시보드와 자동 알림을 제공하며, 추가 개발 없이 운영을 시작할 수 있습니다."
    ],
    sensors: ["ALTA Wireless Sensor", "ALTA Edge Gateway", "iMonnit Express V4"]
  },
  proposal: {
    lead: "표준 도입 절차는 2–4주 내 완료됩니다.",
    phases: [
      {tag:"PHASE 1", title:"현장 평가", desc:"센서 위치·통신 환경·기존 시스템 검토.", duration:"1주"},
      {tag:"PHASE 2", title:"설치 & 페어링", desc:"센서·게이트웨이 배치 및 클라우드 연결.", duration:"1–2주"},
      {tag:"PHASE 3", title:"운영 시작", desc:"임계값 설정·담당자 라우팅·교육.", duration:"1주"}
    ]
  },
  roi: {
    lead: "사고 1건 회피만으로도 초기 투자가 회수되는 경우가 많습니다.",
    metrics: [
      {num:"24/7",    desc:"무인 자동 모니터링"},
      {num:"5분",     desc:"평균 알림 도달 시간"},
      {num:"<12개월", desc:"평균 ROI 회수 기간"}
    ],
    before: "수동 점검에 의존. 사후 대응 운영. 감사 시 수동 보고서 작성.",
    after:  "1초 단위 자동 측정. 5분 이내 알림. 자동 보고서로 감사 대응 단순화."
  }
};

/* ========== APPLICATIONS RENDERING ========== */
const APP_SORTERS = {
  default:  (a, b) => 0,
  name:     (a, b) => a.name.localeCompare(b.name, "ko"),
  category: (a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name, "ko"),
  new:      (a, b) => b.added.localeCompare(a.added),
  popular:  (a, b) => b.popularity - a.popularity
};

let appsState = { category: "all", sort: "default", search: "", page: 1 };

function renderAppsCategoryBar() {
  const bar = document.getElementById('appsCategoryBar');
  const catCounts = { all: APPS.length };
  Object.keys(CATEGORIES).forEach(k => catCounts[k] = APPS.filter(a => a.cat === k).length);
  const items = [
    {id: "all", name: "전체", count: catCounts.all},
    ...Object.entries(CATEGORIES).map(([k, v]) => ({id: k, name: v.name, count: catCounts[k]}))
  ];
  bar.innerHTML = items.map(i => `
    <button class="cat-pill ${appsState.category === i.id ? 'active' : ''}" data-cat="${i.id}">
      ${i.name}<span class="count">${i.count}</span>
    </button>
  `).join('');
  bar.querySelectorAll('.cat-pill').forEach(btn => {
    btn.onclick = () => {
      appsState.category = btn.dataset.cat; appsState.page = 1;
      renderAppsCategoryBar();
      renderAppsGrid();
    };
  });
}

function renderAppsGrid() {
  const grid = document.getElementById('appsGrid');
  const title = document.getElementById('appsResultsTitle');
  const count = document.getElementById('appsResultsCount');
  let filtered = APPS.slice();
  if (appsState.category !== 'all') filtered = filtered.filter(a => a.cat === appsState.category);
  if (appsState.search) {
    const q = appsState.search.toLowerCase();
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q) ||
      (CATEGORIES[a.cat] || {}).name?.toLowerCase().includes(q)
    );
  }
  filtered.sort(APP_SORTERS[appsState.sort] || APP_SORTERS.default);
  title.textContent = appsState.category === 'all'
    ? '전체 어플리케이션'
    : CATEGORIES[appsState.category].name + ' 어플리케이션';
  count.textContent = `${filtered.length} ${appsState.search ? 'matching ' : ''}items`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="apps-empty">
        <h3>일치하는 어플리케이션이 없습니다</h3>
        <p>필터를 조정하거나 검색어를 변경해보세요.</p>
        <button onclick="resetAppsFilters()">필터 초기화</button>
      </div>
    `;
    const ep = document.getElementById('appsPager'); if (ep) ep.innerHTML = '';
    return;
  }
  const per = 12, total = filtered.length, pages = Math.ceil(total/per) || 1;
  appsState.page = Math.min(Math.max(1, appsState.page || 1), pages);
  const start = (appsState.page - 1) * per;
  grid.innerHTML = filtered.slice(start, start + per).map(a => `
    <button class="app-card ${a.cat}" data-id="${a.id}" data-file="${a.file||''}">
      <div class="app-card-top">
        <span class="app-tag ${a.cat}">${CATEGORIES[a.cat].label}</span>
        ${a.isNew ? '<span class="new-badge">● New</span>' : (a.file ? '<span class="doc-badge">↓ 자료</span>' : '')}
      </div>
      <div class="app-name">${a.name}</div>
      <div class="app-desc">${a.desc}</div>
      <div class="app-card-footer">
        <span class="app-sensors">${a.sensors}</span>
        <span class="arrow">${a.file ? '자료 ↓' : '→'}</span>
      </div>
    </button>
  `).join('');
  grid.querySelectorAll('.app-card').forEach(card => {
    card.onclick = () => {
      const f = card.dataset.file;
      if (f) { window.open(f, '_blank', 'noopener'); }
      else { navigate('app/' + card.dataset.id); }
    };
  });
  renderPager(grid, 'appsPager', total, per, appsState.page, g=>{ appsState.page=g; renderAppsGrid(); grid.scrollIntoView({behavior:'smooth',block:'start'}); });
}

function resetAppsFilters() {
  appsState = { category: 'all', sort: 'default', search: '', page: 1 };
  document.getElementById('appsSearch').value = '';
  document.getElementById('appsSort').value = 'default';
  renderAppsCategoryBar();
  renderAppsGrid();
}

document.getElementById('appsSearch').addEventListener('input', e => {
  appsState.search = e.target.value.trim(); appsState.page = 1;
  renderAppsGrid();
});
document.getElementById('appsSort').addEventListener('change', e => {
  appsState.sort = e.target.value; appsState.page = 1;
  renderAppsGrid();
});

renderAppsCategoryBar();
renderAppsGrid();

/* ========== HOME PAGE RENDERING ========== */

// Map app categories to industry-style tag classes used elsewhere
const CAT_TO_HOMETAG = {
  env:    'tag-bldg',
  cold:   'tag-food',
  health: 'tag-bio',
  indus:  'tag-mfg',
  fac:    'tag-bldg',
  agri:   'tag-edu'
};

const CAT_DESCRIPTIONS = {
  env:    "온도·습도·누수·공기질 등 실내외 환경의 모든 변수를 통합 추적.",
  cold:   "매장·차량·창고 전 구간 콜드체인 무결성을 단일 플랫폼으로.",
  health: "GMP·VFC·21 CFR Part 11 컴플라이언스를 자동화.",
  indus:  "진동·전류·온도로 라인 다운타임을 사전 차단하는 예지보전.",
  fac:    "빌딩·캠퍼스·자산의 점유·에너지·시설 통합 운영.",
  agri:   "축산·작물·아쿠아·야외 환경의 24/7 자동 모니터링."
};

function renderHomeCatCards() {
const homeCatCards = document.getElementById('homeCatCards');
homeCatCards.innerHTML = '';
Object.entries(CATEGORIES).forEach(([key, info]) => {
  const count = APPS.filter(a => a.cat === key).length;
  const tagClass = CAT_TO_HOMETAG[key] || 'tag-pub';
  homeCatCards.insertAdjacentHTML('beforeend', `
    <button class="cat-card" data-cat="${key}">
      <div class="cc-head">
        <span class="cc-tag ${tagClass}">${info.label}</span>
        <span class="cc-count">${count} apps</span>
      </div>
      <div class="cc-name">${info.name}</div>
      <div class="cc-desc">${CAT_DESCRIPTIONS[key] || ''}</div>
      <div class="cc-foot">
        <span class="cc-foot-label">카테고리 살펴보기</span>
        <span class="cc-arrow">→</span>
      </div>
    </button>
  `);
});
homeCatCards.querySelectorAll('.cat-card').forEach(card => {
  card.addEventListener('click', () => {
    appsState.category = card.dataset.cat; appsState.page = 1;
    appsState.search = '';
    appsState.sort = 'default';
    const searchEl = document.getElementById('appsSearch');
    if (searchEl) searchEl.value = '';
    const sortEl = document.getElementById('appsSort');
    if (sortEl) sortEl.value = 'default';
    renderAppsCategoryBar();
    renderAppsGrid();
    navigate('applications');
  });
});
}
renderHomeCatCards();

// Featured customer cases on home — pick 3 of the 6 featured with highlight results
const HOME_CASE_HIGHLIGHTS = {
  "samsung-biologics": { num: "99.8%", lbl: "GMP 환경 준수율" },
  "microsoft":          { num: "-67%",  lbl: "환경 원인 다운타임" },
  "walmart":            { num: "-32%",  lbl: "식품 폐기 손실" },
  "exxonmobil":         { num: "-45%",  lbl: "비계획 정지 시간" },
  "hyundai-motors":     { num: "+9%",   lbl: "라인 가동률" },
  "cbre":               { num: "-22%",  lbl: "운영 비용" }
};

const HOME_CASE_PICKS = ["samsung-biologics", "microsoft", "walmart"];

function renderHomeCases() {
const homeCases = document.getElementById('homeCases');
homeCases.innerHTML = '';
HOME_CASE_PICKS.forEach((caseId, idx) => {
  const c = CASE_DATA[caseId];
  if (!c) return;
  // Find the matching CUSTOMERS entry to get tag class
  const cust = CUSTOMERS.find(x => x.n === c.name);
  const tagInfo = cust ? INDUSTRIES[cust.i] : null;
  const tagClass = tagInfo ? tagInfo.tag : 'tag-pub';
  const tagLabel = tagInfo ? tagInfo.label : c.industry;
  const highlight = HOME_CASE_HIGHLIGHTS[caseId] || c.qs[0];
  const num = String(idx + 1).padStart(2, '0');
  const bg = (typeof CASE_HERO_BG !== 'undefined') ? CASE_HERO_BG[caseId] : '';
  const media = `<div class="hcc-media">${bg ? `<img class="hcc-img" src="${bg}" alt="${c.name}" loading="lazy" onerror="this.parentElement.style.display='none';">` : ''}</div>`;
  homeCases.insertAdjacentHTML('beforeend', `
    <article class="home-case-card" data-case="${caseId}">
      ${media}
      <div class="hcc-body">
        <div class="hcc-num">CASE / ${num}</div>
        <div class="hcc-logo">${c.name}</div>
        <span class="hcc-tag ${tagClass}">${tagLabel}</span>
        <div class="hcc-headline">${c.tagline}</div>
        <div class="hcc-result">
          <div class="hcc-result-num">${highlight.n || highlight.num}</div>
          <div class="hcc-result-lbl">${highlight.l || highlight.lbl}</div>
        </div>
        <div class="hcc-cta">케이스스터디 보기</div>
      </div>
    </article>
  `);
});
homeCases.querySelectorAll('.home-case-card').forEach(card => {
  card.addEventListener('click', () => navigate('case/' + card.dataset.case));
});
}
renderHomeCases();

/* ========== APP DETAIL RENDERING ========== */
function renderAppDetail(id) {
  const app = APPS.find(a => a.id === id);
  if (!app) { navigate('applications'); return; }
  // Use Case 라이브러리(자료 다운로드형) — 상세 페이지 대신 첨부 자료를 새 탭으로 연다
  if (app.file) { window.open(app.file, '_blank', 'noopener'); navigate('applications'); return; }
  const det = APP_DETAILS[id] || DEFAULT_APP_DETAIL;

  document.getElementById('appd-cat-tag').innerHTML =
    `<span class="app-tag ${app.cat}">${CATEGORIES[app.cat].label}</span>`;
  document.getElementById('appd-name').textContent = app.name;
  document.getElementById('appd-desc').textContent = app.desc;

  document.getElementById('appd-snapshot').innerHTML = (det.snapshot || []).map(s => `
    <div class="snap">
      <div class="snap-label">${s.label}</div>
      <div class="snap-value">${s.value}</div>
      <div class="snap-desc">${s.desc}</div>
    </div>
  `).join('');

  document.getElementById('appd-customer').innerHTML = `
    <p class="case-lead">${det.customer.lead}</p>
    ${det.customer.paragraphs.map(p => `<p class="muted">${p}</p>`).join('')}
  `;

  document.getElementById('appd-challenge').innerHTML = `
    <p class="case-lead">${det.challenge.lead}</p>
    <ul class="pain-list">
      ${det.challenge.pains.map(p => `<li><strong>${p.title}</strong><span>${p.desc}</span></li>`).join('')}
    </ul>
  `;

  document.getElementById('appd-solution').innerHTML = `
    <p class="case-lead">${det.solution.lead}</p>
    ${det.solution.paragraphs.map(p => `<p class="muted">${p}</p>`).join('')}
    <div class="sensor-tags">
      <div class="sensor-tags-label">함께 사용되는 Monnit 제품</div>
      ${det.solution.sensors.map(s => `<span class="sensor-tag">${s}</span>`).join('')}
    </div>
  `;

  document.getElementById('appd-proposal').innerHTML = `
    <p class="case-lead">${det.proposal.lead}</p>
    <div class="phases">
      ${det.proposal.phases.map(ph => `
        <div class="phase">
          <div class="phase-tag">${ph.tag}</div>
          <div>
            <div class="phase-title">${ph.title}</div>
            <div class="phase-desc">${ph.desc}</div>
            <div class="phase-duration">소요: ${ph.duration}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('appd-roi').innerHTML = `
    <p class="case-lead">${det.roi.lead}</p>
    <div class="roi-metrics">
      ${det.roi.metrics.map(m => `
        <div class="roi-card">
          <div class="roi-num">${m.num}</div>
          <div class="roi-desc">${m.desc}</div>
        </div>
      `).join('')}
    </div>
    <div class="comparison">
      <div class="compare-row">
        <div class="compare-side before">
          <h5>Before</h5>
          <p>${det.roi.before}</p>
        </div>
        <div class="compare-side after">
          <h5>After Monnit</h5>
          <p>${det.roi.after}</p>
        </div>
      </div>
    </div>
  `;

  // INTEGRATION: render customer cards from APP_TO_CUSTOMERS
  const customerNames = APP_TO_CUSTOMERS[id] || [];
  const customerContainer = document.getElementById('appd-customers');
  const customerSection = customerContainer.closest('.app-customers-section');
  if (customerNames.length === 0) {
    customerSection.style.display = 'none';
  } else {
    customerSection.style.display = '';
    const featuredCustomerIds = ['Samsung Biologics','ExxonMobil','Walmart','Microsoft','Hyundai Motors','CBRE'];
    const cards = customerNames.map(name => {
      const cust = CUSTOMERS.find(c => c.n === name);
      if (!cust) return '';
      const isClickable = featuredCustomerIds.includes(name);
      const caseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `
        <div class="app-customer-card ${isClickable ? 'clickable' : ''}" data-case="${isClickable ? caseId : ''}">
          <div class="ac-name">${cust.n}</div>
          <div class="ac-headline">${cust.h}</div>
          ${isClickable ? '<div class="ac-link">케이스스터디 보기</div>' : ''}
        </div>
      `;
    }).join('');
    customerContainer.innerHTML = cards;
    customerContainer.querySelectorAll('.app-customer-card.clickable').forEach(card => {
      card.addEventListener('click', () => navigate('case/' + card.dataset.case));
    });
    document.getElementById('appd-customers-count').textContent =
      `${customerNames.length} customers · 1 featured case study`;
  }

  document.getElementById('appd-cta-title').innerHTML =
    `${app.name}, <em style="font-style:italic;color:var(--accent);font-weight:500;">우리 환경</em>에서 어떻게 작동할까요?`;

  renderGalleryItems(document.getElementById('appd-gallery'), (app.photos && app.photos.length) ? app.photos : getPhotos('app:' + id));
}

/* ========== FAQ ACCORDION (이벤트 위임 — 다시 그려도 동작) ========== */
const faqListEl = document.getElementById('faqList');
if (faqListEl) {
  faqListEl.addEventListener('click', e => {
    const q = e.target.closest('.faq-q');
    if (q) q.closest('.faq-item').classList.toggle('open');
  });
}

/* ========== MOBILE NAV ========== */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
}
// On mobile, tapping a dropdown parent opens its submenu instead of navigating
document.querySelectorAll('.nav-link.has-caret').forEach(btn => {
  btn.addEventListener('click', e => {
    if (window.innerWidth <= 920) {
      e.preventDefault();
      btn.closest('.nav-item').classList.toggle('m-open');
    }
  });
});
// Close mobile menu after choosing any nav target
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => {
    if (navLinks) navLinks.classList.remove('open');
    document.querySelectorAll('.nav-item.m-open').forEach(i => i.classList.remove('m-open'));
  });
});

/* ========== 현장 사진 갤러리 (브라우저 저장) ========== */
/* ============================================================
   현장 사진 (Field Photos) — 본문 직접 삽입 방식
   ------------------------------------------------------------
   · 브라우저에 업로드/저장하지 않습니다. 사진은 본문 콘텐츠로 직접 들어갑니다.
   · 아래 PHOTOS 기본값에 넣거나, 구글 시트(Photos 탭)에서 추가·수정할 수 있습니다.
   · key 형식:  케이스스터디 → "case:<케이스 id>"  /  어플리케이션 → "app:<앱 id>"
   · 각 사진은 { src, caption } 형태 (src 는 이미지 URL 또는 data URL)
   ============================================================ */
let PHOTOS = {  /* 기본값 — 구글 시트(Photos 탭)가 있으면 해당 key 를 덮어씀 */
  // 예시) 'case:us-army': [
  //   { src:'https://.../army-1.jpg', caption:'기지 내 전략 자산 모니터링 노드 설치' },
  // ],
  // 예시) 'app:vaccine': [ { src:'https://.../vaccine-1.jpg', caption:'백신 보관고 센서 설치' } ],
};

function getPhotos(key){ return PHOTOS[key] || []; }

/* "url::caption||url2::caption2" 또는 "url||url2" → [{src,caption}] */
function parsePhotos(str){
  if (!str) return [];
  return String(str).split('||').map(s => s.trim()).filter(Boolean).map(s => {
    const idx = s.indexOf('::');
    return idx >= 0 ? { src: s.slice(0, idx).trim(), caption: s.slice(idx + 2).trim() }
                    : { src: s, caption: '' };
  }).filter(p => p.src);
}

/* 사진 배열을 본문에 렌더링. 없으면 섹션을 숨김. */
function renderGalleryItems(container, photos){
  if (!container) return;
  const section = container.closest('.photo-section');
  if (!photos || !photos.length){
    if (section) section.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  if (section) section.style.display = '';
  container.innerHTML = `
    <div class="ph-grid">
      ${photos.map((ph,i)=>`
        <figure class="ph-item">
          <img src="${ph.src}" alt="${(ph.caption||('현장 사진 '+(i+1)))}" loading="lazy">
          ${ph.caption ? `<figcaption class="ph-cap">${ph.caption}</figcaption>` : ''}
        </figure>`).join('')}
    </div>`;
}
function renderPhotoGallery(container, key){ renderGalleryItems(container, getPhotos(key)); }

/* ========== FORM HANDLERS (실제 발송) ========== */
async function subscribeMsg(id) {
  const el = document.getElementById(id);
  const v = el ? el.value.trim() : '';
  if (!v || !v.includes('@')) { alert('올바른 이메일 주소를 입력해 주세요.'); return; }
  const kind = (id === 'wpEmail') ? '백서 신청' : '뉴스레터 구독';
  const btn = el.parentElement ? el.parentElement.querySelector('button') : null;
  const ok = await sendLead({
    _subject: '[모닛코리아 웹사이트] ' + kind,
    구분: kind, 이메일: v,
    출처: location.href
  }, btn);
  if (ok === true) {
    alert(kind + '이 접수되었습니다. 감사합니다!\n(' + v + ')');
    el.value = '';
  } else if (ok === 'mailto') {
    alert('메일 앱이 열립니다. 내용이 자동 입력되어 있으니 [보내기]를 누르면 완료됩니다.');
    el.value = '';
  } else {
    alert('전송에 실패했습니다. 잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }
}
/* ===== 백서 신청: 드롭다운에서 백서 선택 → 이메일 입력 시 다운로드 제공 ===== */
function populateWpSelect(){
  const sel = document.getElementById('wpSelect'); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">받아보실 백서를 선택하세요</option>' +
    WHITEPAPERS.map((w,i) => `<option value="${i}">${esc(w.title)}</option>`).join('');
  if (cur !== '' && WHITEPAPERS[cur]) sel.value = cur;
}
function pickWhitepaper(i){
  const sel = document.getElementById('wpSelect');
  if (sel) sel.value = String(i);
  const band = document.querySelector('#view-whitepaper .band');
  if (band){
    band.scrollIntoView({ behavior:'smooth', block:'center' });
    band.classList.add('band-flash');
    setTimeout(() => band.classList.remove('band-flash'), 1300);
  }
  const em = document.getElementById('wpEmail');
  if (em) setTimeout(() => em.focus({ preventScroll:true }), 450);
}
async function wpRequest(){
  const sel = document.getElementById('wpSelect');
  const em  = document.getElementById('wpEmail');
  const idx = sel ? sel.value : '';
  const v   = em ? em.value.trim() : '';
  if (idx === '' || !WHITEPAPERS[idx]) { alert('받아보실 백서를 먼저 선택해 주세요.'); if (sel) sel.focus(); return; }
  if (!v || !v.includes('@')) { alert('올바른 이메일 주소를 입력해 주세요.'); if (em) em.focus(); return; }
  const wp = WHITEPAPERS[idx];
  const dl = (wp.url || '').trim();
  // 백서 선택 + 이메일 입력을 마친 시점에 다운로드 제공
  // (클릭 제스처 안에서 즉시 열어 팝업 차단을 방지)
  if (dl) { try { window.open(dl, '_blank', 'noopener'); } catch(e){} }
  const btn = (sel && sel.parentElement) ? sel.parentElement.querySelector('button') : null;
  const ok = await sendLead({
    _subject: '[모닛코리아 웹사이트] 백서 신청 — ' + wp.title,
    구분: '백서 신청',
    백서명: wp.title,
    이메일: v,
    출처: location.href
  }, btn);
  if (ok === true) {
    alert('「' + wp.title + '」 신청이 접수되었습니다.\n' + (dl ? '다운로드가 새 창에서 시작됩니다. ' : '') + '입력하신 이메일(' + v + ')로도 자료를 보내드립니다.');
    if (em) em.value = ''; if (sel) sel.value = '';
  } else if (ok === 'mailto') {
    alert((dl ? '다운로드가 시작되었습니다.\n' : '') + '메일 앱이 열리면 [보내기]를 눌러 신청을 완료해 주세요.');
    if (em) em.value = ''; if (sel) sel.value = '';
  } else {
    alert((dl ? '다운로드는 시작되었습니다. ' : '') + '신청 접수 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }
}
function toggleOtherField(selectId, otherId){
  const sel = document.getElementById(selectId);
  const other = document.getElementById(otherId);
  if (!sel || !other) return;
  const show = sel.value === '기타';
  other.style.display = show ? 'block' : 'none';
  if (show) other.focus(); else other.value = '';
}
async function contactSubmit() {
  const name = (document.getElementById('ctName')||{}).value || '';
  const email = (document.getElementById('ctEmail')||{}).value || '';
  const phone = (document.getElementById('ctPhone')||{}).value || '';
  let industry = (document.getElementById('ctIndustry')||{}).value || '';
  let inquiry = (document.getElementById('ctInquiry')||{}).value || '';
  const industryOther = (document.getElementById('ctIndustryOther')||{}).value || '';
  const inquiryOther = (document.getElementById('ctInquiryOther')||{}).value || '';
  if (industry === '기타' && industryOther.trim()) industry = '기타: ' + industryOther.trim();
  if (inquiry === '기타' && inquiryOther.trim()) inquiry = '기타: ' + inquiryOther.trim();
  const msg = (document.getElementById('ctMsg')||{}).value || '';
  if (!name.trim() || !email.includes('@')) { alert('이름과 올바른 이메일을 입력해 주세요.'); return; }
  if (industry === '기타' && !industryOther.trim()) { alert('산업군을 직접 입력해 주세요.'); return; }
  if (inquiry === '기타' && !inquiryOther.trim()) { alert('문의 항목을 직접 입력해 주세요.'); return; }
  const btn = document.querySelector('#view-contact .form-btn');
  const ok = await sendLead({
    _subject: '[모닛코리아 웹사이트] 상담 신청 — ' + name.trim() + (inquiry ? ' / ' + inquiry : ''),
    구분: '상담 신청',
    '이름/회사명': name.trim(),
    이메일: email.trim(),
    전화번호: phone.trim(),
    산업군: industry,
    문의항목: inquiry,
    문의내용: msg.trim(),
    출처: location.href
  }, btn);
  if (ok === true) {
    alert('상담 신청이 접수되었습니다. 빠르게 연락드리겠습니다!');
    ['ctName','ctEmail','ctPhone','ctMsg','ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.value=''; });
    ['ctIndustry','ctInquiry'].forEach(i => { const e=document.getElementById(i); if(e) e.selectedIndex=0; });
    ['ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.style.display='none'; });
  } else if (ok === 'mailto') {
    alert('메일 앱이 열립니다. 내용이 자동 입력되어 있으니 [보내기]를 누르면 상담 신청이 완료됩니다.');
    ['ctName','ctEmail','ctPhone','ctMsg','ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.value=''; });
    ['ctIndustry','ctInquiry'].forEach(i => { const e=document.getElementById(i); if(e) e.selectedIndex=0; });
    ['ctIndustryOther','ctInquiryOther'].forEach(i => { const e=document.getElementById(i); if(e) e.style.display='none'; });
  } else {
    alert('전송에 실패했습니다. 잠시 후 다시 시도하시거나 korea@monnit.com 으로 연락 주세요.');
  }
}

/* ============================================================
   ========== 자료실 & 지원 (RESOURCES / SUPPORT) 데이터 ==========
   아래 기본값은 구글 시트의 해당 탭이 있으면 덮어써집니다.
   ============================================================ */
let BLOG = [
  { date:'2026.01.08', title:'신형 ALTA Ethernet Gateway 4K 출시', body:'게이트웨이 1대로 최대 4,000개 센서를 통합 관리하는 차세대 이더넷 게이트웨이가 공개되었습니다. 캠퍼스·대규모 공장 배포가 단일 인프라로 가능해집니다.', thumb:'◐', url:'https://blog.naver.com/monnitkorea' },
  { date:'2026.05.31', title:'진동 센서로 설비 고장 예측하기', body:'Velocity RMS와 Acceleration RMS의 관계를 활용해, 축별 주파수만으로도 다른 측정값을 추론하는 예지보전 실무 노하우를 정리했습니다.', thumb:'〜', url:'https://blog.naver.com/monnitkorea' },
  { date:'2025.10.24', title:'겨울철 설비 동파, 스마트하게 막는 법', body:'온도·누수 센서를 결합한 조기 경보로 한파 시즌의 배관 동파와 누수 피해를 예방하는 방법을 소개합니다.', thumb:'◇', url:'https://blog.naver.com/monnitkorea' }
];
let NEWS_HIGHLIGHTS = [
  { title:'2026 IoT Sensor Company of the Year 수상', desc:'Monnit이 2년 연속 올해의 IoT 센서 기업으로 선정되었습니다.', url:'https://blog.naver.com/monnitkorea' },
  { title:'IoT Platforms Leadership Award 연속 수상', desc:'플랫폼 리더십 부문에서 백투백 수상을 기록했습니다.', url:'https://blog.naver.com/monnitkorea' },
  { title:'신형 ALTA / ALTA XL Ethernet Gateway 4K 발표', desc:'대규모 센서 네트워크를 위한 차세대 게이트웨이를 출시했습니다.', url:'https://blog.naver.com/monnitkorea' }
];
let WHITEPAPERS = [
  { icon:'▤', title:'시설 관리 IoT 도입 가이드', desc:'HVAC·보일러·전력 등 설비 모니터링으로 운영비를 절감하는 방법.', url:'https://blog.naver.com/monnitkorea' },
  { icon:'◷', title:'식품 서비스 콜드체인 백서', desc:'온도 규정 준수와 식품 안전을 위한 무선 온도 모니터링 전략.', url:'https://blog.naver.com/monnitkorea' },
  { icon:'⛏', title:'예지보전 ROI 백서', desc:'진동·전류 데이터 기반 예지보전이 만들어내는 투자 수익.', url:'https://blog.naver.com/monnitkorea' },
  { icon:'⌖', title:'산업 IoT 보안 백서', desc:'Encrypt-RF® 기반 엔드투엔드 데이터 보안 아키텍처.', url:'https://blog.naver.com/monnitkorea' }
];
let FAQS = [
  { q:'센서 무선 통신 거리는 얼마나 되나요?', a:'ALTA 무선 센서는 비가시선 기준 벽 12장을 관통해 1,200ft 이상, ALTA XL 게이트웨이 사용 시 벽 18장 관통 2,000ft 이상까지 통신합니다. 안테나 방향과 설치 환경에 따라 최적 성능이 달라집니다.' },
  { q:'센서 배터리는 얼마나 가나요?', a:'사용 환경에 따라 다르지만, 단일 AA 배터리로 최대 10년 이상 사용 가능합니다. 데이터 전송 주기(하트비트), 통신 거리, 장애물 수가 수명에 영향을 줍니다. 배터리 잔량은 iMonnit에서 백분율로 확인할 수 있고, 설정 임계값 이하가 되면 알림을 받을 수 있습니다.' },
  { q:'인터넷이 끊기면 데이터가 사라지나요?', a:'아닙니다. 게이트웨이 연결이 끊겨도 센서가 자체적으로 최대 4,000건의 측정값을 저장하며, 연결이 복구되면 누락 없이 전송합니다. 게이트웨이 역시 내부 메모리에 다수의 메시지를 저장합니다.' },
  { q:'데이터 보안은 어떻게 보장되나요?', a:'Encrypt-RF® 기술로 256-bit ECDH 키 교환과 AES-128 암호화를 적용해 센서~게이트웨이 구간을 보안 터널로 보호합니다. 또한 패킷 변조 검증 루틴으로 위·변조 및 재전송 공격을 차단합니다.' },
  { q:'알림은 어떤 방식으로 받나요?', a:'사용자가 설정한 조건을 초과하면 iMonnit이 SMS 문자, 이메일, 전화로 즉시 알림을 보냅니다. 임계값과 수신자는 자유롭게 설정할 수 있습니다.' },
  { q:'설치와 설정은 어렵지 않나요?', a:'대부분의 ALTA 센서는 전원을 켜는 즉시 게이트웨이에 연결되는 플러그앤플레이 방식으로, 시스템 구성에 보통 15분이면 충분합니다. Monnit Korea가 현장 설치와 초기 설정을 지원합니다.' }
];
// KNOWLEDGEBASE 데이터는 data.js 로 분리됨 (index.html 에서 app.js 보다 먼저 로드)

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const pageState = { blog: 1, wp: 1, blogCat: 'all', wpCat: 'all', kb: 1, kbCat: 'all' };
function renderPager(afterEl, id, total, per, page, go){
  let pager = document.getElementById(id);
  if (!pager){ pager = document.createElement('div'); pager.id = id; pager.className = 'pager'; afterEl.insertAdjacentElement('afterend', pager); }
  const pages = Math.ceil(total / per) || 1;
  if (pages <= 1){ pager.innerHTML = ''; return; }
  let h = `<button class="pg-btn" data-go="${page-1}" ${page<=1?'disabled':''}>‹</button>`;
  for (let i=1;i<=pages;i++) h += `<button class="pg-btn ${i===page?'active':''}" data-go="${i}">${i}</button>`;
  h += `<button class="pg-btn" data-go="${page+1}" ${page>=pages?'disabled':''}>›</button>`;
  pager.innerHTML = h;
  pager.querySelectorAll('.pg-btn[data-go]').forEach(b=>{
    b.onclick = ()=>{ const g=parseInt(b.dataset.go,10); if(g>=1 && g<=pages) go(g); };
  });
}
function renderCatBar(barId, allCount, cats, current, onPick){
  const bar = document.getElementById(barId); if (!bar) return;
  if (!cats.length){ bar.innerHTML = ''; bar.style.display = 'none'; return; }
  bar.style.display = '';
  const items = [{id:'all', name:'전체', count:allCount}, ...cats];
  bar.innerHTML = items.map(i =>
    `<button class="cat-pill ${current===i.id?'active':''}" data-cat="${esc(i.id)}">${esc(i.name)}<span class="count">${i.count}</span></button>`
  ).join('');
  bar.querySelectorAll('.cat-pill').forEach(b => { b.onclick = () => onPick(b.dataset.cat); });
}
function uniqCats(arr){
  const seen = {}; arr.forEach(o => { const c=(o.category||'').trim(); if(c) seen[c]=(seen[c]||0)+1; });
  return Object.keys(seen).map(c => ({ id:c, name:c, count:seen[c] }));
}
function renderBlog(){
  const el = document.getElementById('blogGrid'); if (!el) return;
  const cats = uniqCats(BLOG);
  renderCatBar('blogCatBar', BLOG.length, cats, pageState.blogCat, c => { pageState.blogCat=c; pageState.blog=1; renderBlog(); });
  let list = (pageState.blogCat==='all') ? BLOG.slice() : BLOG.filter(p => (p.category||'')===pageState.blogCat);
  const per = 6, total = list.length, pages = Math.ceil(total/per) || 1;
  pageState.blog = Math.min(Math.max(1, pageState.blog), pages);
  const start = (pageState.blog - 1) * per;
  el.innerHTML = list.slice(start, start + per).map(p => {
    const thumb = p.image
      ? `<div class="blog-thumb has-img"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy"></div>`
      : `<div class="blog-thumb">${esc(p.thumb||'◐')}</div>`;
    const inner = `
      ${thumb}
      <div class="blog-body">
        <div class="blog-date">${esc(p.date)}</div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.body)}</p>
        <span class="b-link">자세히 보기 →</span>
      </div>`;
    return p.url
      ? `<a class="blog-card res-link" href="${esc(p.url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<article class="blog-card">${inner}</article>`;
  }).join('');
  renderPager(el, 'blogPager', total, per, pageState.blog, g=>{ pageState.blog=g; renderBlog(); el.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function renderNewsHighlights(){
  const el = document.getElementById('newsHighlights'); if (!el) return;
  el.innerHTML = NEWS_HIGHLIGHTS.map(h => {
    const inner = `<div class="svc-n">▸</div><div><h4>${esc(h.title)}</h4><p>${esc(h.desc)}</p></div>`;
    return h.url
      ? `<a class="svc-row res-link" href="${esc(h.url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="svc-row">${inner}</div>`;
  }).join('');
}
function renderWhitepapers(){
  const el = document.getElementById('wpList'); if (!el) return;
  const cats = uniqCats(WHITEPAPERS);
  renderCatBar('wpCatBar', WHITEPAPERS.length, cats, pageState.wpCat, c => { pageState.wpCat=c; pageState.wp=1; renderWhitepapers(); });
  let list = (pageState.wpCat==='all') ? WHITEPAPERS.slice() : WHITEPAPERS.filter(w => (w.category||'')===pageState.wpCat);
  const per = 6, total = list.length, pages = Math.ceil(total/per) || 1;
  pageState.wp = Math.min(Math.max(1, pageState.wp), pages);
  const start = (pageState.wp - 1) * per;
  el.innerHTML = list.slice(start, start + per).map(w => {
    const gi = WHITEPAPERS.indexOf(w);
    const glyph = `<span class="wp-glyph">${esc(w.icon||'▤')}</span>`;
    const img = w.photo ? `<img class="wp-img" src="${esc(w.photo)}" alt="${esc(w.title)}" loading="lazy" onerror="this.remove();">` : '';
    const media = `<div class="wp-media">${glyph}${img}</div>`;
    const body = `<div class="wp-body"><h4>${esc(w.title)}</h4><p>${esc(w.desc)}</p><span class="b-link wp-dl-hint" style="margin-top:8px;display:inline-block;">이메일 입력 후 다운로드 →</span></div>`;
    const cls = 'wp-card wp-pick' + (w.photo ? ' has-photo' : '');
    return `<button type="button" class="${cls}" data-wpi="${gi}" onclick="pickWhitepaper(${gi})">${media}${body}</button>`;
  }).join('');
  populateWpSelect();
  renderPager(el, 'wpPager', total, per, pageState.wp, g=>{ pageState.wp=g; renderWhitepapers(); el.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function renderFaqs(){
  const el = document.getElementById('faqList'); if (!el) return;
  el.innerHTML = FAQS.map(f => `
    <div class="faq-item">
      <button class="faq-q">${esc(f.q)}</button>
      <div class="faq-a"><div class="faq-a-inner">${esc(f.a)}</div></div>
    </div>`).join('');
}
let kbState = { view:'home', cat:null, search:'', page:1, docId:null, ret:null };
let kbWired = false;
const KB_CATS = [
  { name:'센서', ico:'◎' },
  { name:'게이트웨이', ico:'⬡' },
  { name:'iMonnit Online', ico:'☁' },
  { name:'온프레미스 소프트웨어', ico:'▣' },
  { name:'애드온 기기', ico:'⊕' },
  { name:'지원 동영상', ico:'▷' },
  { name:'기기 손상', ico:'⚠' }
];
function kbWire(){
  if (kbWired) return; kbWired = true;
  const s = document.getElementById('kbSearch');
  const clr = document.getElementById('kbSearchClear');
  if (s) s.addEventListener('input', e => {
    kbState.search = e.target.value.trim(); kbState.page = 1;
    if (clr) clr.style.display = e.target.value ? 'block' : 'none';
    renderKnowledgebase();
  });
  if (clr) clr.addEventListener('click', () => {
    const i = document.getElementById('kbSearch'); if (i) i.value = '';
    kbState.search = ''; clr.style.display = 'none'; renderKnowledgebase();
  });
}
function kbHome(){ kbState.view='home'; kbState.cat=null; kbState.page=1; renderKnowledgebase(); }
function kbBack(){
  const r = kbState.ret || { view:'home' };
  kbState.view = r.view || 'home'; kbState.cat = r.cat || null;
  kbState.search = r.search || ''; kbState.page = r.page || 1;
  const s = document.getElementById('kbSearch'); if (s) s.value = kbState.search;
  const clr = document.getElementById('kbSearchClear'); if (clr) clr.style.display = kbState.search ? 'block' : 'none';
  renderKnowledgebase();
  document.getElementById('view-knowledgebase').scrollIntoView({behavior:'smooth',block:'start'});
}
function kbRenderList(grid, list){
  const per = 12, total = list.length, pages = Math.ceil(total/per) || 1;
  kbState.page = Math.min(Math.max(1, kbState.page), pages);
  const start = (kbState.page - 1) * per;
  grid.innerHTML = list.slice(start, start + per).map(k => `
    <button class="kb-card" data-id="${esc(k.id||'')}"><div class="kb-cat">${esc(k.category)}</div><h3>${esc(k.title)}</h3><p>${esc(k.desc)}</p><span class="kb-more">전체 보기 →</span></button>`).join('')
    || '<p style="color:var(--ink-soft);padding:24px 0;">일치하는 문서가 없습니다.</p>';
  grid.querySelectorAll('.kb-card[data-id]').forEach(c => {
    c.onclick = () => {
      kbState.ret = { view: kbState.view, cat: kbState.cat, search: kbState.search, page: kbState.page };
      kbState.view = 'doc'; kbState.docId = c.dataset.id;
      renderKnowledgebase();
      document.getElementById('view-knowledgebase').scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
  renderPager(grid, 'kbPager', total, per, kbState.page, g => { kbState.page=g; renderKnowledgebase(); grid.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function renderKnowledgebase(){
  const grid = document.getElementById('kbGrid'); if (!grid) return;
  kbWire();
  const catGrid = document.getElementById('kbCatGrid');
  const listHead = document.getElementById('kbListHead');
  const pager = document.getElementById('kbPager');
  const counts = {};
  KNOWLEDGEBASE.forEach(k => { const c=(k.category||'').trim(); if(c) counts[c]=(counts[c]||0)+1; });
  grid.style.display = '';

  // 0) 문서 상세 (전체 본문)
  if (kbState.view === 'doc'){
    const d = KNOWLEDGEBASE.find(x => x.id === kbState.docId);
    if (catGrid) catGrid.style.display='none';
    if (listHead) listHead.style.display='none';
    if (pager) pager.innerHTML='';
    grid.style.display='block';
    grid.innerHTML = d ? `
      <article class="kb-article">
        <button class="kb-back" onclick="kbBack()">← 목록</button>
        <div class="kb-cat">${esc(d.category)}</div>
        <h2 class="kb-art-title">${esc(d.title)}</h2>
        <div class="kb-art-body">${d.body || ('<p>'+esc(d.desc)+'</p>')}</div>
      </article>` : '<p style="color:var(--ink-soft);padding:24px 0;">문서를 찾을 수 없습니다.</p>';
    return;
  }

  // 1) 검색 모드
  if (kbState.search){
    const q = kbState.search.toLowerCase();
    const list = KNOWLEDGEBASE.filter(k =>
      (k.title||'').toLowerCase().includes(q) ||
      (k.desc||'').toLowerCase().includes(q) ||
      (k.category||'').toLowerCase().includes(q));
    if (catGrid) catGrid.style.display='none';
    if (listHead){ listHead.style.display='flex';
      listHead.innerHTML = `<button class="kb-back" onclick="kbHome()">← 전체</button><span class="kb-title">검색 결과</span><span class="kb-count">"${esc(kbState.search)}" — ${list.length}건</span>`; }
    kbRenderList(grid, list);
    return;
  }
  // 2) 홈 — 카테고리 타일
  if (kbState.view === 'home'){
    if (catGrid) catGrid.style.display='grid';
    if (listHead) listHead.style.display='none';
    grid.innerHTML=''; if (pager) pager.innerHTML='';
    const known = KB_CATS.map(c=>c.name);
    const extras = Object.keys(counts).filter(c=>!known.includes(c)).map(c=>({name:c, ico:'▤'}));
    const tiles = [...KB_CATS, ...extras].filter(c=>counts[c.name]);
    if (catGrid) catGrid.innerHTML = tiles.map(c=>`
      <button class="kb-cat-tile" data-cat="${esc(c.name)}">
        <span class="ico">${c.ico}</span>
        <span class="nm">${esc(c.name)}</span>
        <span class="ct">${counts[c.name]||0}개 문서</span>
        <span class="arr">보기 →</span>
      </button>`).join('');
    if (catGrid) catGrid.querySelectorAll('.kb-cat-tile').forEach(t=>{
      t.onclick = () => { kbState.view='list'; kbState.cat=t.dataset.cat; kbState.page=1; renderKnowledgebase();
        document.getElementById('view-knowledgebase').scrollIntoView({behavior:'smooth',block:'start'}); };
    });
    return;
  }
  // 3) 리스트 — 선택 카테고리 문서
  if (catGrid) catGrid.style.display='none';
  const list = KNOWLEDGEBASE.filter(k => (k.category||'')===kbState.cat);
  if (listHead){ listHead.style.display='flex';
    listHead.innerHTML = `<button class="kb-back" onclick="kbHome()">← 카테고리</button><span class="kb-title">${esc(kbState.cat)}</span><span class="kb-count">${list.length}개 문서</span>`; }
  kbRenderList(grid, list);
}
function renderResources(){
  renderBlog(); renderNewsHighlights(); renderWhitepapers(); renderFaqs(); renderKnowledgebase();
  renderGuides();
}

/* ========== 범용 지식베이스형 엔진 (카테고리 타일 → 목록 → 전체 본문 + 검색/필터) ========== */
function makeKBModule(cfg){
  const st = cfg.state; let wired = false;
  const $ = id => document.getElementById(id);
  function wire(){
    if (wired) return; wired = true;
    const s = $(cfg.ids.search), clr = $(cfg.ids.clear);
    if (s) s.addEventListener('input', e => { st.search = e.target.value.trim(); st.page = 1; if (clr) clr.style.display = e.target.value ? 'block' : 'none'; render(); });
    if (clr) clr.addEventListener('click', () => { const i = $(cfg.ids.search); if (i) i.value = ''; st.search = ''; clr.style.display = 'none'; render(); });
  }
  function toView(){ const v = $(cfg.ids.view); if (v) v.scrollIntoView({behavior:'smooth',block:'start'}); }
  function home(){ st.view='home'; st.cat=null; st.page=1; render(); }
  function back(){
    const r = st.ret || { view:'home' };
    st.view = r.view||'home'; st.cat = r.cat||null; st.search = r.search||''; st.page = r.page||1;
    const s = $(cfg.ids.search); if (s) s.value = st.search;
    const clr = $(cfg.ids.clear); if (clr) clr.style.display = st.search ? 'block' : 'none';
    render(); toView();
  }
  function renderList(grid, list){
    const per = 12, total = list.length, pages = Math.ceil(total/per) || 1;
    st.page = Math.min(Math.max(1, st.page), pages);
    const start = (st.page-1)*per;
    grid.innerHTML = list.slice(start, start+per).map(k => `<button class="kb-card" data-id="${esc(k.id||'')}"><div class="kb-cat">${esc(k.category)}</div><h3>${esc(k.title)}</h3><p>${esc(k.desc)}</p><span class="kb-more">전체 보기 →</span></button>`).join('')
      || '<p style="color:var(--ink-soft);padding:24px 0;">일치하는 문서가 없습니다.</p>';
    grid.querySelectorAll('.kb-card[data-id]').forEach(c => { c.onclick = () => { st.ret={view:st.view,cat:st.cat,search:st.search,page:st.page}; st.view='doc'; st.docId=c.dataset.id; render(); toView(); }; });
    renderPager(grid, cfg.ids.pager, total, per, st.page, g => { st.page=g; render(); grid.scrollIntoView({behavior:'smooth',block:'start'}); });
  }
  function render(){
    const grid = $(cfg.ids.grid); if (!grid) return; wire();
    const catGrid = $(cfg.ids.catGrid), listHead = $(cfg.ids.listHead), pager = $(cfg.ids.pager);
    const DATA = cfg.data(); const counts = {}; DATA.forEach(k => { const c=(k.category||'').trim(); if(c) counts[c]=(counts[c]||0)+1; });
    grid.style.display = '';
    if (st.view === 'doc'){
      const d = DATA.find(x => x.id === st.docId);
      if (catGrid) catGrid.style.display='none'; if (listHead) listHead.style.display='none'; if (pager) pager.innerHTML='';
      grid.style.display='block';
      grid.innerHTML = d ? `<article class="kb-article"><button class="kb-back" data-act="back">← 목록</button><div class="kb-cat">${esc(d.category)}</div><h2 class="kb-art-title">${esc(d.title)}</h2><div class="kb-art-body">${d.body || ('<p>'+esc(d.desc)+'</p>')}</div></article>` : '<p style="color:var(--ink-soft);padding:24px 0;">문서를 찾을 수 없습니다.</p>';
      const bk = grid.querySelector('[data-act="back"]'); if (bk) bk.onclick = back;
      return;
    }
    if (st.search){
      const q = st.search.toLowerCase();
      const list = DATA.filter(k => (k.title||'').toLowerCase().includes(q) || (k.desc||'').toLowerCase().includes(q) || (k.category||'').toLowerCase().includes(q));
      if (catGrid) catGrid.style.display='none';
      if (listHead){ listHead.style.display='flex'; listHead.innerHTML = `<button class="kb-back" data-act="home">← 전체</button><span class="kb-title">검색 결과</span><span class="kb-count">"${esc(st.search)}" — ${list.length}건</span>`; const hb=listHead.querySelector('[data-act="home"]'); if(hb) hb.onclick=home; }
      renderList(grid, list); return;
    }
    if (st.view === 'home'){
      if (catGrid) catGrid.style.display='grid'; if (listHead) listHead.style.display='none'; grid.innerHTML=''; if (pager) pager.innerHTML='';
      const known = cfg.cats.map(c=>c.name);
      const extras = Object.keys(counts).filter(c=>!known.includes(c)).map(c=>({name:c, ico:'▤'}));
      const tiles = [...cfg.cats, ...extras].filter(c=>counts[c.name]);
      if (catGrid){
        catGrid.innerHTML = tiles.map(c=>`<button class="kb-cat-tile" data-cat="${esc(c.name)}"><span class="ico">${c.ico}</span><span class="nm">${esc(c.name)}</span><span class="ct">${counts[c.name]||0}개 문서</span><span class="arr">보기 →</span></button>`).join('');
        catGrid.querySelectorAll('.kb-cat-tile').forEach(t=>{ t.onclick=()=>{ st.view='list'; st.cat=t.dataset.cat; st.page=1; render(); toView(); }; });
      }
      return;
    }
    if (catGrid) catGrid.style.display='none';
    const list = DATA.filter(k => (k.category||'')===st.cat);
    if (listHead){ listHead.style.display='flex'; listHead.innerHTML = `<button class="kb-back" data-act="home">← 카테고리</button><span class="kb-title">${esc(st.cat)}</span><span class="kb-count">${list.length}개 문서</span>`; const hb=listHead.querySelector('[data-act="home"]'); if(hb) hb.onclick=home; }
    renderList(grid, list);
  }
  function reset(){
    st.view='home'; st.cat=null; st.search=''; st.page=1; st.docId=null; st.ret=null;
    const s=$(cfg.ids.search); if(s) s.value='';
    const clr=$(cfg.ids.clear); if(clr) clr.style.display='none';
    render();
  }
  return { render, home, back, reset };
}

/* ===== 제품 가이드 (6개 주제) — 본문에 이미지 포함 가능 =====
   GUIDES 의 body 에 <img src="이미지주소"> 를 넣으면 본문에 사진이 표시됩니다.
   (아래는 구조 확인용 샘플 — 실제 자료로 교체) */
const GUIDE_CATS = [
  { name:'센서', ico:'◎' },
  { name:'게이트웨이', ico:'⬡' },
  { name:'소프트웨어', ico:'☁' },
  { name:'액세서리', ico:'⊕' },
  { name:'문서/가이드', ico:'▤' },
  { name:'온프라미스', ico:'▣' }
];
// GUIDES 데이터는 data.js 로 분리됨 (index.html 에서 app.js 보다 먼저 로드)
const guideModule = makeKBModule({
  data: () => GUIDES, cats: GUIDE_CATS, state: { view:'home', cat:null, search:'', page:1, docId:null, ret:null },
  ids: { search:'gSearch', clear:'gSearchClear', catGrid:'gCatGrid', listHead:'gListHead', grid:'gGrid', pager:'gPager', view:'view-guides' }
});
function renderGuides(){ guideModule.render(); }

/* ========== BOOT: 시트 로드 → 렌더 → 초기 라우팅 ========== */
async function boot() {
  try { await loadSheetData(); }
  catch (e) { console.warn('[CONTENT_SHEET] 로드 중 오류 — 기본값 사용:', e); }
  renderData();
  renderHomeCatCards();
  renderHomeCases();
  renderAppsCategoryBar();
  renderAppsGrid();
  renderResources();
  const initHash = window.location.hash.replace('#', '');
  if (initHash) navigate(initHash);
}
boot();

/* ===== scroll reveal (fade-up) — fails open (all visible) on any error ===== */
(function(){
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var home = document.getElementById('view-home');
    if (!home) return;
    var sel = '.section-head, .strength-card, .fac-cell, .why-card, .cat-cards > *, .home-cases > *, .awards-strip-inner > *';
    var els = Array.prototype.slice.call(home.querySelectorAll(sel));
    if (!els.length) return;
    home.classList.add('reveal-on');
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    els.forEach(function(el){
      el.classList.add('reveal');
      var idx = 0, p = el.previousElementSibling;
      while (p) { idx++; p = p.previousElementSibling; }
      el.style.transitionDelay = (Math.min(idx, 5) * 70) + 'ms';
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.95) el.classList.add('in');
    });
    if (!('IntersectionObserver' in window)) {
      els.forEach(function(el){ el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function(el){ if (!el.classList.contains('in')) io.observe(el); });

    /* count-up for stat numbers */
    var cuEls = Array.prototype.slice.call(home.querySelectorAll('.cu[data-to]'));
    if (cuEls.length) {
      var fmt = function(n){ return Math.round(n).toLocaleString('en-US'); };
      var cuIO = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (!e.isIntersecting) return;
          var el = e.target; cuIO.unobserve(el);
          var to = parseFloat(el.getAttribute('data-to')) || 0;
          var dur = 1400, t0 = null;
          var loop = function(ts){
            if (t0 === null) t0 = ts;
            var p = Math.min((ts - t0) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(to * eased);
            if (p < 1) requestAnimationFrame(loop); else el.textContent = fmt(to);
          };
          requestAnimationFrame(loop);
        });
      }, { threshold: 0.5 });
      cuEls.forEach(function(el){ cuIO.observe(el); });
    }
  } catch (err) {
    var h = document.getElementById('view-home');
    if (h) h.classList.remove('reveal-on');
  }
})();
