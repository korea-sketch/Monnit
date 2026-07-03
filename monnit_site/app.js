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

/* ★★★ Google Forms 방식 (구글 인증·차단 없음 / 응답이 구글시트에 자동 저장) ★★★
   설정: 구글폼을 만들고(질문: 이름/회사명·이메일·전화번호·산업군·문의항목·문의내용),
        '미리 채워진 링크 받기'로 각 칸의 entry.번호 를 알아내 아래에 넣으세요.
        제출 주소는 .../viewform 대신 .../formResponse 입니다. */
const GOOGLE_FORM_URL = "";   // 예: "https://docs.google.com/forms/d/e/1FAIpQLS.../formResponse"
const GOOGLE_FORM_FIELDS = {  // 사이트 폼 필드 → 구글폼 entry 번호
  '구분':        "",   // 예: "entry.111111111"
  '이름/회사명': "",   // 예: "entry.222222222"
  '이메일':      "",
  '전화번호':    "",
  '산업군':      "",
  '문의항목':    "",
  '문의내용':    "",
  '출처':        ""
};

/* ★★ 무제한·무료 방식: Google Apps Script (문의가 구글 시트에 저장 + 메일 발송)
   설정: 가이드 참고 → 스크립트 배포 후 받은 /exec 주소를 아래에 붙여넣기 (이 한 줄만). */
const GAS_ENDPOINT = "";   // 예: "https://script.google.com/macros/s/AKfy.../exec"

/* ★ 추천 대안: 엔드포인트 방식 (Static Forms · Splitforms · Formspree · Basin · Getform 등)
   각 서비스 가입 후 발급받은 "폼 엔드포인트 URL" 을 아래에 붙여넣기 (이 한 줄만). 활성화 클릭·OAuth 불필요. */
const FORM_POST_URL = "";  // 예: "https://formspree.io/f/xxxx" / "https://api.staticforms.dev/submit/xxxx"

/* ★★ StaticForms (현재 활성 백엔드) — staticforms.dev 가입 후 발급받은 apiKey.
   서버·활성화 클릭·OAuth 불필요. 키만 바꾸면 됩니다. */
const STATICFORMS_URL = "https://api.staticforms.dev/submit";
const STATICFORMS_KEY = "sf_e026c9ef91b8eaeba9d1d472";

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
    // 0) Google Forms (구글 인증 없음 · 응답이 구글시트에 자동 저장) — 최우선
    if (GOOGLE_FORM_URL) {
      try {
        const fd = new URLSearchParams();
        Object.keys(GOOGLE_FORM_FIELDS).forEach(function(k){
          const id = GOOGLE_FORM_FIELDS[k];
          if (id && payload[k] != null && payload[k] !== '') fd.append(id, payload[k]);
        });
        await fetch(GOOGLE_FORM_URL, { method:'POST', mode:'no-cors',
          headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: fd.toString() });
        restore(); return true;
      } catch(e){ return mailto(); }
    }
    // 0b) StaticForms (현재 활성 백엔드)
    if (STATICFORMS_KEY) {
      const res = await fetch(STATICFORMS_URL, { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(Object.assign({
          apiKey: STATICFORMS_KEY,
          subject: payload._subject || '모닛코리아 웹사이트 접수',
          email: payload['이메일'] || payload.email || '',
          replyTo: '@',
          honeypot: ''
        }, payload)) });
      let ok = res.ok; try { const j = await res.json(); ok = ok && !!j.success; } catch(e){}
      return ok ? (restore(), true) : mailto();
    }
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
  leadership:"리더십", industrial:"산업용 IoT", vertical:"산업별 솔루션",
  product:"제품", excellence:"우수성", innovation:"혁신",
  engineering:"엔지니어링", platform:"플랫폼", state:"최우수 기업상"
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
  sheetId: "1CoU6Mm3heJHCLnWGqKthP015CADdc-J73YMb_Bf8qsc",

  // 2) 시트 하단 탭 이름 (기본값 그대로 사용 권장)
  tabs: {
    customers: "Customers", awards: "Awards", partners: "Partners",
    cases: "Cases", appcategories: "AppCategories", applications: "Applications",
    appdetails: "AppDetails", blog: "Blog", whitepapers: "Whitepapers",
    news: "NewsHighlights", faqs: "FAQs", knowledgebase: "Knowledgebase",
    photos: "Photos", products: "Products", homecases: "homecases", sitecontent: "SiteContent",
    logos: "Logos"
  },

  // 3) (선택) 위 방식 대신 '웹에 게시 → CSV' 링크를 직접 쓰려면 여기에 전체 URL을 넣으세요.
  //    비워두면 자동으로 sheetId + 탭 이름으로 주소를 만듭니다.
  urls: {
    customers: "", awards: "", partners: "",
    cases: "", appcategories: "", applications: "",
    appdetails: "", blog: "", whitepapers: "",
    news: "", faqs: "", knowledgebase: "", photos: "", products: "", homecases: "", sitecontent: "", logos: ""
  }
};

/* 재배포 없이 시트 바꾸기:
   - 주소 뒤에 ?sheetId=새ID 를 붙이면 그 방문에 한해 해당 시트를 읽습니다.
   - ?sheetId=새ID&remember=1 로 열면 이 브라우저에 저장돼 다음에도 그 시트를 씁니다.
   - 저장 해제: 주소 뒤에 ?sheetId=clear */
try {
  var _q = new URLSearchParams(location.search);
  var _sid = _q.get('sheetId');
  if (_sid === 'clear') { try { localStorage.removeItem('monnit_sheetid'); } catch(e){} }
  else if (_sid) { CONTENT_SHEET.sheetId = _sid.trim(); if (_q.get('remember')) { try { localStorage.setItem('monnit_sheetid', _sid.trim()); } catch(e){} } }
  else { var _saved = (function(){ try { return localStorage.getItem('monnit_sheetid'); } catch(e){ return null; } })(); if (_saved) CONTENT_SHEET.sheetId = _saved.trim(); }
} catch(e){}

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
  const bust = '_cb=' + Date.now();   // 캐시 무력화: 시트 편집이 즉시 반영되도록
  if (CONTENT_SHEET.urls[key]) return CONTENT_SHEET.urls[key] + (CONTENT_SHEET.urls[key].includes('?') ? '&' : '?') + bust;
  const id = CONTENT_SHEET.sheetId, tab = CONTENT_SHEET.tabs[key];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&${bust}`;
}
async function fetchSheet(key){
  const res = await fetch(sheetURL(key), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return csvToObjects(await res.text());
}

/* --- 시트 → 사이트 데이터 형식으로 변환 (잘못된 값은 건너뜀) --- */
// 영문(EN) 전환 시 번역 등록 — 어느 매퍼에서나 사용 (한글·영문 둘 다 값이 있을 때만)
function regI18N(ko, en){
  if (typeof window !== 'undefined' && window.MonnitI18N && ko != null && en != null
      && String(ko).trim() && String(en).trim()) window.MonnitI18N.add(String(ko).trim(), String(en).trim());
}
function mapCustomers(rows){
  const out = [];
  rows.forEach(o => {
    const n = o.name, i = (o.industry||'').toLowerCase();
    if (!n || !INDUSTRIES[i]) return;
    const a = (o.apps||'').split('|').map(s => s.trim()).filter(Boolean);
    regI18N(o.headline, o.headline_en);
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
    regI18N(o.name, o.name_en); regI18N(o.note, o.note_en);
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
    regI18N(o.desc, o.desc_en);
    out.push(p);
  });
  return out;
}

/* --- 중첩 데이터용 구분자 ( ||  항목구분 ,  ::  항목 내 칸 구분) --- */
function splitItems(s){ return String(s||'').split(/\s*\|\|\s*|\r?\n/).map(x => x.trim()).filter(Boolean); }
function splitFields(s){ return String(s||'').split('::').map(x => x.trim()); }

/* Cases (활용 사례 / Use case) — 한 행 = 한 사례
   *_en 열(title_en, tagline_en, about_en, quote_en, cite_en, challenges_en,
   solutions_en, results_en, qs_en)이 있으면 영문(EN) 전환 시 자동 번역되도록 등록한다. */
function mapCases(rows){
  const out = {};
  const I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
  const reg = (ko, en) => { if (I18N && ko != null && en != null && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
  const regTitle = (ko, en) => {
    if (!ko || !en) return;
    const kf = String(ko).split(/<[^>]*>/).map(s => s.trim()).filter(Boolean);
    const ef = String(en).split(/<[^>]*>/).map(s => s.trim()).filter(Boolean);
    if (kf.length === ef.length) kf.forEach((k, i) => reg(k, ef[i]));
    else { reg(String(ko).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(), String(en).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()); }
  };
  const regList = (ko, en) => { const k = splitItems(ko), e = splitItems(en); const m = Math.min(k.length, e.length); for (let i=0;i<m;i++) reg(k[i], e[i]); };
  const regPairList = (ko, en, n) => { // t::d 또는 n::l 형태에서 n번째 칸끼리 매칭 (개수 달라도 가능한 만큼)
    const k = splitItems(ko), e = splitItems(en);
    const m = Math.min(k.length, e.length);
    for (let i=0;i<m;i++){ const kf = splitFields(k[i]), ef = splitFields(e[i]); reg(kf[n], ef[n]); }
  };
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
    // 영문(EN) 등록 — *_en 열이 있을 때만
    regTitle(o.title, o.title_en || o.titleen);
    reg(o.tagline, o.tagline_en || o.taglineen);
    reg(o.about,   o.about_en   || o.abouten);
    reg(o.quote,   o.quote_en   || o.quoteen);
    reg(o.cite,    o.cite_en    || o.citeen);
    regList(o.challenges, o.challenges_en || o.challengesen);
    regPairList(o.solutions, o.solutions_en || o.solutionsen, 0); // 솔루션 제목
    regPairList(o.solutions, o.solutions_en || o.solutionsen, 1); // 솔루션 설명
    regPairList(o.results, o.results_en || o.resultsen, 1);       // 결과 라벨
    regPairList(o.qs,      o.qs_en      || o.qsen,      1);       // 핵심지표 라벨
    // 합성 문구(회사명·업종·인용·헤딩)도 화면에 나타나는 그대로 등록
    var _nmEn  = (o.name_en || o.nameen || '').trim();
    var _indEn = (o.industry_en || o.industryen || '').trim();
    var _ciEn  = (o.cite_en || o.citeen || '').trim();
    var _shown = _nmEn || o.name;
    reg(o.name, _nmEn);
    reg(o.industry, _indEn);
    if (_indEn) reg('Industry — ' + o.industry, 'Industry — ' + _indEn);
    if (_ciEn)  reg('— ' + o.cite, '— ' + _ciEn);
    if (o.name) reg(o.name + '가 활용하는 솔루션', 'Solutions used by ' + _shown);
    if (o.num && o.name) reg('Case Study ' + o.num + ' · ' + o.name, 'Case Study ' + o.num + ' · ' + _shown);
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
  const I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
  const reg = (ko, en) => { if (I18N && ko != null && en != null && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
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
    reg(o.name, o.name_en || o.nameen);   // 영문(EN) 전환 시 앱 이름/설명 번역
    reg(o.desc, o.desc_en || o.descen);
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
      datasheet: (o.datasheet || o.file || o.pdf || o.attachment || o.download || '').trim(),
      customer: { lead: (o.customerlead||'').trim() || D.customer.lead, paragraphs: custParas.length ? custParas : D.customer.paragraphs },
      challenge: { lead: (o.challengelead||'').trim() || D.challenge.lead, pains: pains.length ? pains : D.challenge.pains },
      solution: { lead: (o.solutionlead||'').trim() || D.solution.lead, paragraphs: solParas.length ? solParas : D.solution.paragraphs, sensors: solSensors.length ? solSensors : D.solution.sensors },
      proposal: { lead: (o.proposallead||'').trim() || D.proposal.lead, phases: phases.length ? phases : D.proposal.phases },
      roi: { lead: (o.roilead||'').trim() || D.roi.lead, metrics: metrics.length ? metrics : D.roi.metrics, before: (o.before||'').trim() || D.roi.before, after: (o.after||'').trim() || D.roi.after }
    };

    // 영문(EN) 등록 — *_en 열이 있을 때만 (한글 칸과 항목 개수·구분자가 같아야 매칭)
    const I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
    if (I18N) {
      const reg = (ko, en) => { if (ko != null && en != null && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
      const regList = (ko, en) => { const k = splitItems(ko), e = splitItems(en); const m = Math.min(k.length, e.length); for (let i=0;i<m;i++) reg(k[i], e[i]); };
      const regPair = (ko, en, n) => { const k = splitItems(ko), e = splitItems(en); const m = Math.min(k.length, e.length); for (let i=0;i<m;i++){ reg(splitFields(k[i])[n], splitFields(e[i])[n]); } };
      reg(o.customerlead,  o.customerlead_en  || o.customerleaden);
      reg(o.challengelead, o.challengelead_en || o.challengeleaden);
      reg(o.solutionlead,  o.solutionlead_en  || o.solutionleaden);
      reg(o.proposallead,  o.proposallead_en  || o.proposalleaden);
      reg(o.roilead,       o.roilead_en       || o.roileaden);
      reg(o.before,        o.before_en        || o.beforeen);
      reg(o.after,         o.after_en         || o.afteren);
      regList(o.customerparagraphs, o.customerparagraphs_en || o.customerparagraphsen);
      regList(o.solutionparagraphs, o.solutionparagraphs_en || o.solutionparagraphsen);
      regList(o.sensors,            o.sensors_en            || o.sensorsen);
      const snapEn = o.snapshot_en || o.snapshoten;
      regPair(o.snapshot, snapEn, 0); regPair(o.snapshot, snapEn, 1); regPair(o.snapshot, snapEn, 2);
      const painsEn = o.pains_en || o.painsen;
      regPair(o.pains, painsEn, 0); regPair(o.pains, painsEn, 1);
      const phEn = o.phases_en || o.phasesen;
      regPair(o.phases, phEn, 0); regPair(o.phases, phEn, 1); regPair(o.phases, phEn, 2); regPair(o.phases, phEn, 3);
      regPair(o.metrics, o.metrics_en || o.metricsen, 1); // 지표 설명(숫자는 공용)
    }
  });
  return out;
}

/* 자료실 & 지원 (단순 목록 탭) */
function mapBlog(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.body,o.body_en);
    return ({ date:o.date||'', title:o.title, body:o.body||'', thumb:o.thumb||'◐', image:normalizeImageUrl(o.image||''), category:o.category||'', url:o.url||'' }); });
}
function mapNews(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.desc,o.desc_en);
    return ({ title:o.title, desc:o.desc||'', url:o.url||'' }); });
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
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.desc,o.desc_en);
    return ({ icon:o.icon||'▤', title:o.title, desc:o.desc||'', category:o.category||'', url:o.url||'', photo:normalizeImageUrl((o.photo||'').split('||')[0].split('::')[0]) }); });
}
function mapFaqs(rows){
  return rows.filter(o => o.question).map(o => { regI18N(o.question,o.question_en); regI18N(o.answer,o.answer_en);
    return ({ q:o.question, a:o.answer||'' }); });
}
function mapKnowledgebase(rows){
  return rows.filter(o => o.title).map(o => { regI18N(o.title,o.title_en); regI18N(o.desc,o.desc_en);
    return ({ category:o.category||'', title:o.title, desc:o.desc||'' }); });
}

/* ====== 메인/About us 본문 슬롯 주입 ======
   index.html 을 건드리지 않고, 각 뷰의 제목·문단·이미지에 런타임 키를 부여하여
   SiteContent 탭(열: key, ko, en, image)의 값으로 덮어쓴다. 값이 비어 있으면 기존 기본값 유지. */
let SITE_CONTENT = {};
const SITE_VIEWS = ['view-home','view-who-we-are','view-what-we-do','view-our-solution','view-stories','view-applications','view-blog','view-products','view-partners','view-awards','view-knowledgebase','view-faqs','view-guides','view-whitepaper'];
const SLOT_TEXT_SEL = 'h1,h2,h3,h4,h5,p,figcaption,.sp-k,.sp-v,.sp-d,.hs-t,.hs-d,.step-title,.step-desc';
let _siteToggleHooked = false;
function eachSlot(cb){
  let homeCount=0;
  SITE_VIEWS.forEach(function(vid){
    const root = document.getElementById(vid); if(!root) return;
    const base = vid.replace('view-','');
    if (vid === 'view-home'){
      const slots = root.querySelectorAll('[data-sc]');
      console.log('[eachSlot] view-home: data-sc 슬롯', slots.length, '개 찾음');
      slots.forEach(function(el){
        const key = el.getAttribute('data-sc');
        console.log('[eachSlot-home]', key, '→', el.tagName);
        homeCount++;
        cb(key, el, el.tagName === 'IMG' ? 'img' : 'text');
      });
    } else {
      let ti=0; root.querySelectorAll(SLOT_TEXT_SEL).forEach(function(el){ cb(base+'#t'+(ti++), el, 'text'); });
      let ii=0; root.querySelectorAll('img').forEach(function(el){ cb(base+'#i'+(ii++), el, 'img'); });
    }
  });
  console.log('[eachSlot] 총', homeCount, '개 홈 슬롯 처리됨');
}
function mapSiteContent(rows){
  const out = {};
  console.log('[mapSC] rows 개수:', rows?.length || 0);
  rows.forEach(function(o){ 
    const k=(o.key||'').trim(); 
    if(!k) { console.log('[mapSC] row key 비움:', o); return; }
    out[k]={ ko:o.ko||'', en:o.en||'', image:o.image||'' };
    console.log('[mapSC] ✓', k, '→', (o.ko||'').slice(0,30));
  });
  console.log('[mapSC] 완료:', Object.keys(out).length, '개 key');
  return out;
}
function applySiteContent(){
  console.log('[ASC] 시작 — SITE_CONTENT:', Object.keys(SITE_CONTENT||{}).length, '개');
  if(!SITE_CONTENT || !Object.keys(SITE_CONTENT).length){ console.warn('[ASC] ❌ SITE_CONTENT 비어있음'); return; }
  console.log('[ASC] SITE_CONTENT keys:', Object.keys(SITE_CONTENT).slice(0,10).join(', '), '...');
  let lang='ko'; try{ lang=localStorage.getItem('mlang')||'ko'; }catch(e){}
  console.log('[ASC] 언어:', lang);
  let applied=0, skipped=0, slotCount=0;
  eachSlot(function(key, el, kind){
    slotCount++;
    const row = SITE_CONTENT[key];
    if(!row){ console.log('[ASC-skip]', key); skipped++; return; }
    if(kind==='img'){
      if(row.image && row.image.trim()){ const u=normalizeImageUrl(row.image.trim()); if(el.getAttribute('src')!==u){ el.setAttribute('src',u); applied++; } }
    } else {
      const val = (lang==='en' && row.en && row.en.trim()) ? row.en : row.ko;
      if(val!=null && String(val).trim()!==''){ 
        console.log('[ASC✓]', key, '→', val.slice(0,40)); 
        el.innerHTML=val; 
        applied++; 
      }
    }
  });
  console.log('[ASC] 완료: 총슬롯', slotCount, '| 적용', applied, '| 스킵', skipped);
  (function(){
    const st=SITE_CONTENT['seo#title']; if(st){ const v=(lang==='en'&&st.en&&st.en.trim())?st.en:st.ko; if(v&&v.trim()) document.title=v.trim(); }
    const sd=SITE_CONTENT['seo#description']; if(sd){ const v=(lang==='en'&&sd.en&&sd.en.trim())?sd.en:sd.ko; if(v&&v.trim()){ let m=document.querySelector('meta[name="description"]'); if(!m){ m=document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); } m.setAttribute('content', v.trim()); } }
  })();
  (function(){
    const c=SITE_CONTENT['product#catalog'];
    const url = c ? ((lang==='en'&&c.en&&c.en.trim())?c.en.trim():(c.ko||'').trim()) : '';
    // 시트(product#catalog)에 주소가 있으면 그 값으로 교체.
    // 없으면 HTML 기본 링크(linktr.ee)를 그대로 유지.
    if(url){ document.querySelectorAll('.cta-download').forEach(a=>{ a.setAttribute('href',url); }); }
  })();
  if(!_siteToggleHooked){
    const lt=document.getElementById('langToggle');
    if(lt){ lt.addEventListener('click', function(){ setTimeout(applySiteContent, 90); }); _siteToggleHooked=true; }
  }
}

/* Photos (현장 사진) — 한 행 = 사진 1장.  열: key, url, caption, order
   key 예: "case:us-army", "app:vaccine"  /  같은 key 끼리 묶어 본문에 표시 */
function mapPhotos(rows){
  const out = {};
  rows.forEach(o => {
    const key = (o.key||'').trim();
    const src = normalizeImageUrl((o.url||o.src||'').trim());
    if (!key || !src) return;
    (out[key] = out[key] || []).push({ src, caption: (o.caption||'').trim(), order: parseInt(o.order,10)||0 });
  });
  Object.keys(out).forEach(k => {
    out[k].sort((a,b)=>a.order-b.order);
    out[k] = out[k].map(({src,caption})=>({src,caption}));
  });
  return out;
}

/* 시트 행 → 제품 객체. 카테고리/그룹은 한글 라벨 또는 영문 id 모두 허용.
   url이 .pdf로 끝나면 '데이터시트', 아니면 '제품 페이지'로 자동 표시.
   name_en / desc_en 열이 있으면 영문 모드 번역에 자동 등록. */
function mapProducts(rows){
  var catById = {}; PRODUCT_CATS.forEach(function(c){ catById[c.id]=c.id; catById[c.ko]=c.id; });
  var grpById = {}; SENSOR_GROUPS.forEach(function(g){ grpById[g.id]=g.id; grpById[g.ko]=g.id; });
  var pick = function(o, keys){ for (var i=0;i<keys.length;i++){ if (o[keys[i]] != null && String(o[keys[i]]).trim() !== '') return String(o[keys[i]]).trim(); } return ''; };
  var out = [];
  rows.forEach(function(o){
    var name = pick(o, ['name','이름','제품명','name_ko']);
    var rawCat = pick(o, ['category','cat','카테고리','분류']);
    var c = catById[rawCat] || catById[rawCat.toLowerCase()];
    if (!name || !c) return;
    var rawGrp = pick(o, ['group','grp','그룹','센서군']);
    var g = (c === 'sensors') ? (grpById[rawGrp] || grpById[rawGrp.toLowerCase()] || '') : '';
    var u = pick(o, ['url','link','링크','데이터시트','datasheet']);
    var d = pick(o, ['desc','description','설명','desc_ko']);
    var pdfRaw = pick(o, ['pdf','ispdf']).toLowerCase();
    var p = pdfRaw ? (['y','yes','true','1','pdf','o','예'].indexOf(pdfRaw) >= 0) : /\.pdf($|\?)/i.test(u);
    var ne = pick(o, ['name_en','nameen','영문명','name(en)']);
    var de = pick(o, ['desc_en','descen','영문설명','desc(en)']);
    if (window.MonnitI18N){ if (ne) window.MonnitI18N.add(name, ne); if (de && d) window.MonnitI18N.add(d, de); }
    out.push({ c: c, g: g, n: name, d: d, u: u, p: p });
  });
  return out;
}

/* homecases 탭 → 메인 페이지 대표 유즈케이스 3선.
   resultnum(소수)을 % 문자열로 변환. order로 정렬. caseid 없으면(안내행 등) 건너뜀. */
function fmtResult(v){
  var s = String(v==null?'':v).trim();
  if (s === '') return '';
  if (/[%/A-Za-z가-힣]/.test(s)) return s;          // 이미 형식 있음(예: 24/7, "99%")
  var n = parseFloat(s);
  if (isNaN(n)) return s;
  var r = Math.round(n * 1000) / 10;                // 소수→백분율, 소수 1자리
  var str = (r % 1 === 0) ? String(r) : String(r);
  return str + '%';
}
function mapHomeCases(rows){
  var out = [];
  var I18N = (typeof window !== 'undefined') ? window.MonnitI18N : null;
  var reg = function(ko,en){ if (I18N && ko && en && String(ko).trim() && String(en).trim()) I18N.add(String(ko).trim(), String(en).trim()); };
  rows.forEach(function(o){
    var caseid = (o.caseid||'').trim();
    if (!caseid) return;                              // 안내/빈 행 제외
    out.push({
      order: parseInt(o.order,10) || 999,
      caseid: caseid,
      name: (o.name||'').trim(),
      industry: (o.industry||'').trim(),
      tagline: (o.tagline||'').trim(),
      resultNum: fmtResult(o.resultnum),
      resultLabel: (o.resultlabel||'').trim(),
      photo: normalizeImageUrl((o.photo||'').trim()),
      link: (o.link||'').trim()
    });
    reg(o.tagline, o.tagline_en || o.taglineen);
    reg(o.resultlabel, o.resultlabel_en || o.resultlabelen);
  });
  out.sort(function(a,b){ return a.order - b.order; });
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
  // 앱 상세의 고정 한글 라벨도 영문 전환되도록 등록
  if (window.MonnitI18N) {
    window.MonnitI18N.add('함께 사용되는 Monnit 제품', 'Monnit products used together');
    window.MonnitI18N.add('소요', 'Duration');
  }
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
  add('products',      r => { const m = mapProducts(r);      if (m.length) PRODUCTS = m; });
  add('homecases',     r => { const m = mapHomeCases(r);     if (m.length) HOME_CASES = m; });
  add('logos',         r => { const m = mapLogos(r);         console.log('[add-logos]',m?.length); if(m&&m.length) renderLogos(m); else console.log('[Logos] 데이터 없음'); });
  add('sitecontent',   r => { console.log('[add-sitecontent] 로드 시작, rows:', r?.length); const sc = mapSiteContent(r); SITE_CONTENT = sc; console.log('[add-sitecontent] 맵핑 완료, 100ms 후 apply'); setTimeout(applySiteContent, 100); });

  const results = await Promise.allSettled(jobs);
  results.forEach((res, idx) => {
    if (res.status === 'rejected'){
      console.warn('[CONTENT_SHEET] ' + labels[idx] + ' 탭 로드 실패 — 기본값 사용:', res.reason);
    }
  });
  // 연결 상태 진단: 콘솔에서 시트가 실제로 반영됐는지 바로 확인 가능
  console.info('[CONTENT_SHEET] 로드 요약 — homecases:' + (HOME_CASES ? HOME_CASES.length : 0)
    + '행, cases:' + Object.keys(CASE_DATA).length + '개, products:' + PRODUCTS.length
    + '개, customers:' + CUSTOMERS.length + '개  (sheetId=' + CONTENT_SHEET.sheetId + ')');
  if (!HOME_CASES || !HOME_CASES.length){
    console.warn('[CONTENT_SHEET] homecases 탭을 읽지 못했습니다 — 연결된 시트에 "homecases" 탭이 있는지, sheetId가 올바른지, 공유가 "링크가 있는 모든 사용자-뷰어"인지 확인하세요.');
  }
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
const _labelToKey = {}; Object.entries(INDUSTRIES).forEach(([k,v]) => { _labelToKey[v.label] = k; });
const _stripTags = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const featuredCases = Object.entries(CASE_DATA)
  .filter(([id,c]) => c && c.name)
  .sort((a,b) => String(a[1].num||'').localeCompare(String(b[1].num||'')));
featuredGrid.innerHTML = '';
featuredCases.forEach(([caseId, c], idx) => {
  const num = String(idx + 1).padStart(2, '0');
  const indKey = _labelToKey[(c.industry||'').trim()];
  const tagClass = indKey ? INDUSTRIES[indKey].tag : '';
  const tagStyle = indKey ? '' : ` style="background:${c.accentBg||'#1d2942'};color:${c.accentText||c.accent||'#cfe0ff'}"`;
  const tagLabel = c.industry || '';
  const headline = c.title || c.tagline || '';
  let apps = [];
  if (c.solutions && c.solutions.length) apps = c.solutions.map(s => s.t);
  else if (c.qs && c.qs.length) apps = c.qs.map(q => q.l);
  else if (c.results && c.results.length) apps = c.results.map(r => r.l);
  apps = apps.filter(Boolean).slice(0, 4);
  const _cardBg = CASE_HERO_BG[caseId] || ((c.photos && c.photos[0]) ? (c.photos[0].src || c.photos[0].url) : '');
  const card = document.createElement('article');
  card.className = 'featured-card';
  card.dataset.caseId = caseId;
  if (indKey) card.dataset.industry = indKey;
  card.innerHTML = `
    <div class="fc-media">${_cardBg ? `<img class="fc-img" src="${_cardBg}" alt="${c.name}" loading="lazy" style="object-position:${CASE_HERO_POS[caseId]||'center'}" onerror="this.remove();">` : ''}</div>
    <div class="fc-body">
      <div class="num">CASE / ${num}</div>
      <div class="logo">${c.name}</div>
      <span class="tag ${tagClass}"${tagStyle}>${tagLabel}</span>
      <h3 class="headline">${headline}</h3>
      <ul class="app-list">
        ${apps.map(a => `<li>${a}</li>`).join('')}
      </ul>
      <a href="#" class="cta-link">자세히 보기</a>
    </div>
  `;
  card.addEventListener('click', e => { e.preventDefault(); if (CASE_DATA[caseId]) navigate('case/' + caseId); });
  featuredGrid.appendChild(card);
});
const _fm = document.getElementById('featuredMeta');
if (_fm) _fm.textContent = 'Featured Case Studies — ' + String(featuredCases.length).padStart(2,'0');

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
const regionGrid = document.getElementById('worldMap');
const REGION_PATHS = {"na": "M158.8 97.2L153.0 94.5L146.0 92.1L144.9 88.0L140.8 84.6L137.4 81.1L138.9 79.8L134.1 76.2L129.6 71.1L125.2 68.7L120.9 68.2L115.7 67.9L111.1 65.9L108.4 50.0L108.4 39.7L117.9 41.7L123.3 40.8L130.8 40.3L139.5 38.4L143.4 38.9L146.0 37.8L154.4 38.4L158.2 40.1L162.6 39.5L173.3 41.6L179.9 41.9L179.7 44.7L192.2 45.0L197.6 46.2L197.7 43.6L202.9 42.5L207.4 42.9L213.3 44.2L222.5 45.0L226.2 43.3L233.0 43.8L234.8 44.2L238.2 41.5L232.0 38.6L235.5 33.6L242.0 35.2L243.3 39.7L248.5 43.1L255.5 42.7L257.4 46.7L262.3 42.3L266.4 39.4L274.2 41.2L272.3 44.1L273.9 46.9L264.6 49.3L260.9 49.8L257.4 53.4L250.2 55.5L247.9 58.4L241.2 61.0L237.1 66.4L241.1 70.0L243.6 74.8L252.7 75.4L257.4 77.8L263.9 79.7L271.5 80.1L271.9 85.3L278.0 91.1L281.7 87.3L278.3 81.5L285.8 78.2L287.2 74.4L281.9 70.0L284.0 64.6L285.0 59.6L292.6 60.6L297.5 60.8L301.7 63.5L306.6 66.1L310.1 70.0L316.1 70.1L320.6 65.7L326.4 71.8L328.3 76.8L334.5 80.0L340.7 81.6L344.0 84.3L345.3 88.5L341.3 90.5L333.2 93.8L322.6 93.6L315.6 93.8L309.7 97.0L302.5 103.3L309.3 99.2L319.3 96.6L319.1 99.8L320.9 104.9L329.1 105.9L332.1 104.8L330.4 107.6L321.5 110.4L316.3 112.2L321.0 107.5L313.5 108.0L311.7 102.6L308.6 102.3L305.6 103.6L303.7 107.1L301.7 107.6L296.3 108.3L290.8 108.8L287.5 111.1L284.1 112.1L280.1 112.6L280.8 114.0L277.1 115.6L271.0 117.6L269.4 117.1L269.1 116.4L271.0 113.9L271.3 109.9L267.8 106.1L267.7 105.2L266.4 104.8L265.7 104.4L265.2 104.1L264.2 103.1L259.8 101.2L254.5 99.2L251.1 100.0L245.4 99.6L239.9 98.3L237.1 97.7L235.7 96.2L229.9 97.2L211.0 97.2L194.3 97.2L177.6 97.2L166.7 97.2Z M266.7 59.9L268.7 58.6L272.6 58.6L272.5 59.1L269.3 60.7L267.3 60.6L266.7 59.9Z M278.4 31.1L275.3 29.6L275.5 28.6L276.8 28.4L283.2 28.7L287.9 30.3L288.2 31.0L285.2 31.0L282.2 30.9L279.2 31.3L278.4 31.1Z M276.9 60.9L278.0 60.0L279.1 60.1L279.8 60.7L278.7 62.1L277.5 61.9L276.8 61.1L276.9 60.9Z M240.0 25.1L238.5 26.1L234.4 25.9L231.1 25.2L232.5 24.0L236.5 23.2L239.0 24.2L240.0 25.1Z M239.3 18.0L238.1 18.1L232.9 17.9L232.1 17.1L237.7 17.2L239.7 17.7L239.3 18.0Z M231.2 14.5L234.6 15.5L233.8 16.5L229.7 17.1L227.4 16.4L226.2 15.4L226.0 14.2L229.6 14.4L231.2 14.5Z M255.1 26.7L250.7 26.3L243.3 25.5L242.3 23.9L242.0 22.5L239.2 21.3L233.4 21.0L230.2 20.1L231.3 19.0L237.0 19.2L240.1 20.1L245.5 20.1L247.9 21.0L247.3 22.0L250.5 22.6L252.3 23.3L256.0 23.4L260.1 23.7L264.5 23.1L270.1 22.8L274.6 23.0L277.6 24.1L278.2 25.2L276.5 26.0L272.4 26.5L268.8 26.2L260.8 26.6L255.1 26.7Z M190.9 16.2L194.8 16.7L193.9 17.5L188.7 18.3L184.6 17.4L186.9 16.5L190.9 16.2Z M191.8 14.4L195.4 15.0L192.0 15.5L187.4 15.5L187.4 15.1L190.3 14.3L191.8 14.4Z M345.6 90.8L344.1 92.5L342.2 95.0L344.0 94.0L345.9 94.6L344.9 95.6L347.4 96.4L348.7 95.7L351.5 96.5L350.6 98.6L352.5 98.1L352.9 99.6L353.8 101.3L352.6 103.7L351.3 103.8L349.5 103.3L350.1 101.0L349.3 100.7L346.1 103.1L344.5 103.0L346.4 101.7L343.7 101.0L340.8 101.2L335.4 101.1L334.9 100.3L336.7 99.3L335.5 98.5L337.8 96.9L340.7 92.4L342.4 90.9L344.8 89.9L346.1 90.0L345.6 90.8Z M267.0 52.5L270.0 53.4L273.2 54.3L273.5 55.6L275.5 55.4L277.5 56.3L275.0 57.2L270.7 56.5L269.1 55.3L266.4 56.8L262.4 58.2L261.5 56.6L257.7 56.8L260.1 55.5L260.5 53.3L261.4 50.7L263.4 51.0L264.0 52.2L265.4 51.7L267.0 52.5Z M281.2 32.4L283.8 31.3L290.0 32.7L293.8 34.0L294.2 35.2L299.3 34.6L302.2 36.3L308.9 37.4L311.3 38.6L314.0 41.1L308.9 42.4L315.4 44.3L319.8 44.9L323.8 47.4L328.2 47.6L327.3 49.6L322.4 52.8L319.0 51.6L314.7 48.9L311.1 49.3L310.7 50.9L313.6 52.5L317.4 53.8L318.6 54.5L320.4 57.2L319.4 59.2L315.9 58.5L308.9 56.3L312.9 58.7L315.8 60.3L316.2 61.3L308.7 60.2L302.7 58.6L299.3 57.2L300.3 56.4L296.2 55.0L292.1 53.7L292.2 54.5L284.1 54.9L281.8 54.0L283.6 51.9L288.8 51.9L294.6 51.5L293.6 50.5L294.6 49.1L298.2 46.4L297.4 45.2L296.4 44.3L292.1 42.9L286.5 42.0L288.3 41.3L285.3 39.5L282.9 39.4L280.7 38.4L279.2 39.2L274.2 39.6L264.0 39.0L258.2 38.2L253.7 37.7L251.4 36.8L254.3 35.5L250.3 35.5L249.4 32.7L251.6 30.2L254.4 29.1L261.6 28.3L259.5 30.1L261.7 31.8L264.3 29.6L271.3 28.5L276.1 31.3L275.7 33.2L281.2 32.4Z M237.5 27.4L243.3 27.5L248.6 28.2L244.4 30.6L241.1 31.2L238.1 33.3L235.0 33.2L233.2 30.7L233.3 29.3L234.7 28.2L237.5 27.4Z M158.7 21.9L158.7 21.9L163.5 19.8L169.2 18.0L173.4 18.1L177.2 17.7L176.8 19.8L174.7 20.7L172.1 20.9L166.9 22.1L162.5 22.5L158.7 21.9Z M131.4 83.2L134.0 83.0L133.2 86.2L135.6 88.4L134.5 88.4L132.8 87.1L131.8 85.8L130.4 85.0L129.9 83.7L130.1 82.9L131.4 83.2Z M207.0 13.1L212.4 13.4L219.9 14.4L222.1 15.8L223.1 16.9L218.6 16.6L214.0 15.7L207.8 15.6L210.5 14.8L207.2 14.1L207.0 13.1Z M156.9 98.6L155.5 99.0L151.0 97.7L150.1 96.7L147.6 95.8L147.1 95.0L144.3 94.5L143.2 92.9L143.4 92.3L146.4 92.9L148.1 93.3L150.7 93.6L151.6 94.6L153.0 95.9L155.8 97.0L156.9 98.6Z M162.4 26.5L166.4 27.1L173.5 27.3L176.2 28.1L179.1 29.2L175.6 29.9L168.8 31.9L165.4 33.8L165.4 35.0L158.1 36.4L156.6 35.2L150.2 33.7L151.4 32.5L153.3 30.5L155.7 28.7L153.0 27.0L162.4 26.5Z M200.5 22.7L203.0 22.2L205.9 22.3L206.4 23.7L204.7 25.0L195.3 25.4L188.3 26.6L184.0 26.7L183.7 25.8L189.5 24.5L176.9 24.9L173.0 24.4L176.8 21.7L179.4 20.9L187.2 21.8L192.2 23.5L197.0 23.7L193.1 21.0L195.6 20.0L198.5 20.3L199.4 21.7L200.5 22.7Z M204.1 30.3L207.2 31.5L209.0 34.2L209.8 36.1L214.5 37.5L219.5 38.8L219.2 40.0L214.6 40.3L216.4 41.3L215.5 42.4L210.4 41.9L205.7 41.2L202.4 41.3L197.2 42.3L190.2 42.7L185.2 43.0L183.7 41.6L179.9 40.9L177.5 41.2L174.1 39.0L175.9 38.7L180.2 38.2L184.1 38.4L187.7 37.9L182.4 37.2L176.4 37.4L172.5 37.4L171.0 36.4L177.5 35.3L173.2 35.3L168.3 34.6L170.7 32.5L172.6 31.4L180.0 29.7L182.9 30.2L181.5 31.5L187.7 30.7L191.5 32.1L194.7 30.7L197.2 31.6L199.5 34.3L200.9 33.2L198.9 30.3L201.3 29.9L204.1 30.3Z M221.0 31.4L217.9 29.6L221.2 28.2L224.5 28.8L229.5 28.4L230.2 29.3L227.6 30.6L231.8 31.8L231.3 34.3L226.8 35.4L224.1 35.1L222.2 34.1L215.3 31.9L215.3 31.0L221.0 31.4Z M203.9 28.9L207.6 28.8L209.7 29.4L207.3 31.2L202.9 29.3L203.9 28.9Z M226.4 20.2L228.5 21.5L228.6 22.9L227.3 25.0L222.8 25.3L219.8 24.8L219.8 23.2L215.3 23.4L215.1 21.3L218.1 21.4L222.3 20.4L226.2 20.6L226.4 20.2Z M233.3 9.4L235.2 8.6L238.1 8.4L236.8 7.8L243.3 7.6L246.9 9.1L251.5 9.7L256.1 10.2L258.3 12.1L261.6 13.0L257.8 13.8L252.7 15.9L247.8 16.1L242.0 15.7L239.0 14.6L239.1 13.6L241.3 12.8L236.2 12.9L233.1 11.9L231.4 10.7L233.3 9.4Z M245.6 5.8L249.7 5.3L253.0 5.2L258.4 4.8L262.5 3.7L265.9 3.9L268.9 4.7L271.1 3.2L274.7 2.7L279.7 2.4L288.2 2.3L289.7 2.6L297.7 2.1L303.7 2.3L309.7 2.5L317.1 2.7L323.1 3.1L328.2 3.8L328.1 4.6L321.3 5.8L314.6 6.3L312.1 6.9L318.1 6.9L311.6 8.6L307.0 9.4L302.3 11.7L296.5 12.1L294.8 12.7L286.4 13.0L290.2 13.3L288.3 13.8L290.6 15.2L287.9 16.2L283.6 16.9L282.3 18.0L278.4 18.9L278.8 19.5L283.6 19.4L283.6 20.1L276.2 21.7L269.0 21.0L260.8 21.4L256.7 21.1L251.4 20.9L251.1 19.6L256.2 18.9L254.8 16.9L256.5 16.7L264.0 17.9L260.2 16.2L255.7 15.6L257.9 14.6L262.8 13.9L263.6 12.9L259.7 11.8L258.5 10.4L266.1 10.5L268.3 10.8L272.6 9.8L266.4 9.5L256.7 9.7L251.8 8.7L249.4 7.6L246.2 6.8L245.6 5.8Z M291.1 46.0L289.3 46.8L286.1 46.9L285.5 45.6L286.6 44.0L289.2 43.6L291.3 44.4L291.4 45.6L291.1 46.0Z M232.6 40.3L234.3 41.4L232.6 42.3L228.8 41.5L226.6 41.8L222.8 40.6L225.2 39.7L227.2 38.5L230.1 39.3L231.8 39.8L232.6 40.3Z M320.8 94.8L321.7 94.6L325.4 95.3L328.2 96.4L328.3 96.9L327.0 97.0L323.4 96.1L320.8 94.8Z M322.2 102.7L323.2 104.0L325.2 104.4L327.7 104.3L326.4 105.5L325.3 105.6L321.8 104.5L321.1 103.5L322.2 102.7Z M158.8 97.2L174.9 97.2L186.1 97.2L202.6 97.2L220.4 97.2L235.7 97.2L236.6 96.1L238.0 98.1L242.8 98.7L247.7 99.2L252.0 99.9L257.1 100.2L262.1 102.2L264.5 103.8L265.0 104.3L266.3 104.1L267.0 105.2L268.1 105.6L270.7 107.4L271.8 112.3L269.7 115.5L269.1 116.7L270.3 117.6L274.2 116.1L280.7 114.3L280.5 113.1L281.3 112.2L286.6 112.1L287.8 110.8L292.0 108.3L301.4 108.3L302.5 107.5L304.7 105.8L307.7 101.5L310.5 101.8L311.7 106.4L314.0 108.9L308.2 111.2L303.8 113.6L303.3 115.7L305.3 117.3L305.9 116.9L303.8 118.1L300.4 118.6L297.6 118.8L299.3 119.1L296.3 120.5L294.6 120.1L294.5 121.0L291.9 125.2L291.1 124.3L290.8 125.1L291.5 126.7L289.1 130.0L289.7 128.0L287.9 124.6L288.0 127.5L288.1 128.0L289.0 130.8L289.6 134.6L285.0 137.5L281.8 139.3L280.0 141.2L275.4 144.4L273.6 148.0L275.1 152.3L276.3 155.4L277.5 160.5L276.7 163.3L274.5 163.3L273.0 161.5L270.3 157.0L270.4 154.0L267.5 150.2L263.6 151.0L261.7 149.6L256.9 149.2L252.3 149.1L251.6 150.3L252.2 152.0L250.6 151.9L247.6 152.4L243.1 151.2L239.3 150.8L234.4 153.5L230.2 156.0L229.5 159.2L230.2 161.5L227.1 160.9L224.2 158.8L221.9 155.3L219.6 151.7L215.3 150.7L211.3 152.0L209.2 149.7L206.6 147.0L204.1 145.1L199.3 146.3L191.6 146.3L181.1 143.0L177.8 142.7L174.2 141.5L171.1 139.6L169.2 138.7L165.6 137.6L164.6 135.7L159.6 129.0L158.5 127.5L155.9 122.9L155.1 119.0L154.1 114.5L155.5 109.4L155.3 103.2L153.6 99.5L158.0 99.9L160.2 101.8L158.8 97.2Z M68.3 177.6L68.8 177.8L69.3 178.2L70.0 179.1L69.9 179.3L68.8 179.9L67.9 180.3L67.5 180.8L66.8 180.4L66.9 179.6L66.5 178.6L66.6 178.3L67.1 177.8L66.9 177.3L67.1 177.0L67.3 177.1L68.3 177.6Z M66.7 175.7L66.4 176.0L65.5 176.2L65.0 175.6L64.7 175.4L64.7 175.2L65.0 175.0L66.0 175.2L66.7 175.7Z M61.0 173.0L61.3 173.2L62.1 174.1L61.9 174.3L61.7 174.2L60.8 174.1L60.4 173.5L60.3 173.4L61.0 173.0Z M57.3 171.6L57.4 172.3L57.0 172.5L56.1 172.0L56.3 171.8L56.7 171.6L57.3 171.6Z M37.6 65.6L39.8 65.9L40.1 66.9L38.4 67.3L36.5 66.8L34.8 66.1L37.6 65.6Z M74.4 72.3L76.2 72.5L77.4 73.4L75.0 74.7L72.2 75.7L70.8 75.0L70.4 73.7L72.9 72.7L74.4 72.3Z M108.4 39.7L108.4 50.0L111.1 65.9L115.7 67.9L120.9 68.2L125.2 68.7L129.6 71.1L134.1 76.2L138.9 79.8L137.4 81.1L135.9 80.1L132.6 76.8L127.6 71.9L120.5 71.6L111.5 68.0L104.0 66.4L94.7 65.4L88.3 64.8L87.3 66.9L81.6 68.4L78.2 67.4L82.4 63.8L78.1 64.6L72.2 68.5L71.6 71.8L65.8 73.8L60.8 76.5L56.7 79.0L52.2 79.5L47.0 81.4L41.8 81.7L47.6 79.6L54.0 77.8L59.2 75.0L61.9 73.4L63.8 69.7L59.7 70.0L56.4 69.6L54.6 69.2L50.1 70.4L50.3 67.7L44.9 67.2L40.7 65.3L38.6 62.5L41.9 59.4L45.1 57.7L49.3 56.8L53.4 56.2L51.3 54.4L51.7 53.4L47.9 54.6L41.8 54.3L36.5 52.5L36.9 49.8L45.4 48.4L50.9 49.7L45.2 46.9L40.6 44.3L38.3 42.0L46.8 40.6L50.3 38.0L58.2 36.4L65.1 35.1L71.3 37.0L77.2 36.6L81.3 37.7L90.0 38.3L97.4 38.9L105.4 39.3L108.4 39.7Z M23.0 56.2L24.7 56.7L26.4 56.4L28.7 57.1L31.4 57.5L31.2 57.8L29.1 58.4L27.0 57.8L25.9 57.3L23.5 57.5L22.8 57.2L23.0 56.2Z M300.8 178.6L301.0 180.1L300.8 181.2L300.2 181.6L300.9 182.5L300.8 183.2L299.0 182.7L297.7 182.9L296.0 182.7L294.7 183.2L293.2 182.4L293.4 181.5L296.0 181.9L298.1 182.1L299.1 181.5L297.8 180.3L297.8 179.2L296.1 178.8L296.7 178.0L298.4 178.1L300.8 178.6Z M300.8 183.2L300.9 182.5L300.2 181.6L300.8 181.2L301.0 180.1L300.8 178.6L301.1 178.1L303.3 178.1L305.0 178.8L305.7 178.8L306.2 179.7L307.7 179.7L307.6 180.5L308.9 180.6L310.2 181.6L309.2 182.8L307.9 182.2L306.6 182.3L305.7 182.1L305.2 182.7L304.1 182.8L303.7 182.1L302.8 182.5L301.7 184.4L301.0 184.0L300.8 183.2Z M280.6 158.9L281.9 158.7L283.8 158.8L283.8 159.5L280.8 159.9L280.6 158.9Z M283.9 158.2L286.1 159.5L285.6 161.4L285.1 161.1L285.2 159.6L283.9 158.5L283.9 158.2Z M282.8 163.3L283.6 163.4L284.6 165.7L284.6 167.3L283.9 167.5L283.2 165.9L282.2 165.1L282.8 163.3Z M370.1 3.8L389.2 2.3L402.5 1.0L442.1 3.5L426.3 4.7L412.8 5.5L431.0 6.1L438.7 6.3L442.7 6.9L464.5 6.3L454.8 9.5L444.3 10.6L447.5 12.8L445.4 17.7L444.3 19.6L444.9 21.9L442.6 24.6L440.0 27.2L442.3 29.3L434.5 29.7L438.1 32.8L431.1 32.4L438.5 34.8L434.6 37.6L429.0 34.9L426.8 38.3L437.9 38.5L422.9 43.1L411.7 44.1L405.0 48.1L397.1 50.2L389.4 51.5L387.0 55.2L381.1 59.2L380.9 63.7L375.6 66.6L365.9 64.3L361.4 60.0L355.2 54.8L350.9 49.7L350.1 46.7L357.0 42.4L358.7 39.1L354.0 40.5L348.1 40.0L349.0 36.6L357.2 37.3L350.0 34.6L344.9 34.3L346.3 30.7L340.8 25.8L337.3 23.6L323.9 21.7L309.7 22.1L301.7 19.4L314.5 18.4L296.4 16.5L307.3 14.1L318.5 11.8L313.5 9.7L327.1 7.4L332.5 5.5L349.6 5.0L360.0 4.3L370.6 5.6L369.7 5.0Z M174.6 143.0L181.3 142.4L185.3 144.3L197.1 146.3L199.3 145.1L205.2 146.1L208.2 148.2L209.8 151.2L213.6 152.9L217.6 150.6L221.0 153.6L223.6 156.8L224.9 160.1L229.1 161.6L229.1 163.9L228.4 169.6L228.6 172.5L230.0 176.0L232.5 179.7L236.6 181.8L240.1 182.2L244.3 181.4L247.9 179.8L248.7 175.8L251.1 174.3L256.5 173.7L258.9 174.1L257.3 177.1L257.1 179.2L256.0 182.6L254.7 181.9L253.2 183.7L252.4 183.5L249.8 183.8L247.2 185.4L247.0 186.3L248.3 187.6L248.7 188.7L243.8 191.0L243.9 192.1L240.7 190.0L237.0 188.3L233.2 189.6L229.8 189.1L225.1 187.3L219.9 185.6L216.9 183.6L212.5 182.5L208.4 179.7L206.3 176.6L206.9 175.5L207.6 173.8L206.4 171.5L203.0 167.3L198.9 163.4L196.0 161.6L195.0 159.2L192.7 155.9L189.6 154.3L188.1 152.0L185.7 147.8L183.7 145.6L181.2 145.0L181.2 147.5L182.4 150.7L184.9 153.3L185.7 154.4L186.8 156.2L188.2 157.9L190.9 161.9L192.5 164.4L194.0 165.9L196.1 168.4L194.8 169.9L193.6 168.2L189.8 165.3L188.5 162.6L186.7 160.2L184.5 159.3L182.0 157.9L180.6 156.1L182.8 155.2L180.7 152.0L178.1 149.5L175.8 145.5Z M285.1 209.2L284.8 209.7L285.4 211.3L284.9 212.1L284.0 211.9L283.7 213.3L282.7 212.5L282.1 211.0L282.8 210.2L282.1 210.0L281.6 209.1L280.2 208.3L279.0 208.5L278.4 209.5L277.3 210.2L276.7 210.3L276.4 210.9L277.8 212.4L277.0 212.7L276.6 213.1L275.3 213.3L274.8 211.6L274.5 212.1L273.6 211.9L273.0 210.8L271.9 210.6L271.1 210.3L269.9 210.3L269.9 210.9L269.5 210.5L269.7 209.9L269.9 209.4L269.8 208.9L270.2 208.5L269.6 208.1L269.6 207.0L270.7 206.8L271.7 207.8L271.6 208.3L272.8 208.5L273.0 208.2L273.8 208.9L275.1 208.7L276.3 208.0L278.0 207.5L279.0 206.6L280.5 206.8L280.4 207.1L281.9 207.2L283.2 207.6L284.1 208.5L285.1 209.2Z M270.7 206.8L269.6 207.0L269.6 208.1L270.2 208.5L269.8 208.9L269.9 209.4L269.7 209.9L269.5 210.5L268.0 209.9L267.5 209.3L267.8 208.8L267.7 208.2L266.9 207.5L265.8 207.0L264.9 206.6L264.7 205.8L264.0 205.3L264.1 206.1L263.6 206.8L262.9 206.0L262.1 205.7L261.7 205.2L261.7 204.3L262.1 203.5L261.3 203.1L261.9 202.5L262.3 202.2L264.2 202.9L264.8 202.5L265.7 202.8L266.1 203.4L267.0 203.5L267.6 202.9L268.3 204.5L269.4 205.6L270.7 206.8Z M267.6 202.9L267.0 203.5L266.1 203.4L265.7 202.8L264.8 202.5L264.2 202.9L262.3 202.2L261.9 202.5L260.9 201.7L259.7 200.5L259.0 199.6L257.9 198.7L256.5 197.5L256.8 197.0L257.2 197.5L257.5 197.3L258.3 197.2L258.7 196.5L259.1 196.5L259.0 195.1L259.7 195.1L260.2 195.1L260.8 194.3L261.7 194.9L261.9 194.6L262.5 194.2L263.4 193.5L263.5 192.9L263.7 192.9L264.1 192.2L264.4 192.2L264.9 192.6L265.4 192.7L266.0 192.4L266.7 192.4L267.7 192.0L268.1 191.6L269.0 191.7L268.8 191.9L268.7 192.6L268.9 193.6L268.3 194.5L268.0 195.6L267.9 196.9L268.1 197.6L268.1 198.8L267.7 199.1L267.4 200.3L267.6 201.0L267.1 201.7L267.2 202.5L267.6 202.9Z M269.0 191.7L268.1 191.6L267.7 192.0L266.7 192.4L266.0 192.4L265.4 192.7L264.9 192.6L264.4 192.2L264.1 192.2L263.7 192.9L263.5 192.9L263.4 193.5L262.5 194.2L261.9 194.6L261.7 194.9L260.8 194.3L260.2 195.1L259.7 195.1L259.0 195.1L259.1 196.5L258.7 196.5L258.3 197.2L257.5 197.3L257.0 196.4L256.1 196.2L256.3 195.0L255.9 194.7L255.4 194.5L254.2 194.9L254.1 194.5L253.2 194.1L252.6 193.5L251.8 193.3L252.4 192.6L252.2 192.0L252.3 191.5L253.7 190.7L254.9 189.6L255.2 189.8L255.8 189.3L256.6 189.2L256.9 189.5L257.3 189.3L258.6 189.6L259.9 189.5L260.8 189.2L261.1 188.9L262.0 189.0L262.7 189.2L263.4 189.1L263.9 188.9L265.2 189.3L265.6 189.3L266.5 189.9L267.3 190.5L268.3 190.9L269.0 191.7Z M251.8 193.3L252.6 193.5L253.2 194.1L254.1 194.5L254.2 194.9L255.4 194.5L255.9 194.7L256.3 195.0L256.1 196.2L255.8 196.8L254.2 196.8L253.2 196.5L252.1 195.9L250.5 195.8L249.7 195.2L249.8 194.8L250.8 194.1L251.3 193.8L251.1 193.4L251.8 193.3Z M243.8 192.9L243.9 192.1L244.2 191.5L243.8 191.0L245.1 188.7L248.7 188.7L248.8 187.7L248.3 187.6L248.0 187.0L247.0 186.3L246.0 185.4L247.2 185.4L247.2 183.8L249.8 183.8L252.4 183.9L252.4 186.1L252.1 189.2L253.0 189.2L253.9 189.7L254.1 189.3L254.9 189.6L253.7 190.7L252.3 191.5L252.2 192.0L252.4 192.6L251.8 193.3L251.1 193.4L251.3 193.8L250.8 194.1L249.8 194.8L249.7 195.2L248.3 194.7L246.6 194.6L245.3 194.1L243.8 192.9Z M252.4 183.9L252.4 183.5L252.7 183.3L253.2 183.7L254.2 182.0L254.7 181.9L254.7 182.4L255.3 182.4L255.2 183.1L254.8 184.3L255.0 184.8L254.7 185.7L254.9 186.0L254.6 187.4L254.0 188.2L253.5 188.2L253.0 189.2L252.1 189.2L252.4 186.1L252.4 183.9Z M315.9 181.9L317.3 182.1L317.8 182.7L317.1 183.4L315.0 183.4L313.4 183.5L313.2 182.3L313.6 181.9L315.9 181.9Z M284.5 182.0L286.4 182.2L287.9 182.9L288.3 183.6L286.4 183.7L285.5 184.2L284.0 183.7L282.4 182.7L282.7 182.1L283.9 181.9L284.5 182.0Z M271.5 168.9L273.9 169.1L276.1 169.2L278.7 170.1L279.8 171.1L282.4 170.8L283.4 171.5L285.7 173.2L287.4 174.4L288.3 174.4L290.0 175.0L289.8 175.7L291.9 175.9L293.9 177.0L293.6 177.6L291.8 178.0L289.9 178.1L288.0 177.9L284.0 178.2L285.9 176.6L284.7 175.9L283.0 175.7L282.0 174.9L281.3 173.3L279.8 173.4L277.2 172.7L276.3 172.1L272.7 171.7L271.8 171.1L272.8 170.5L270.1 170.3L268.1 171.8L266.9 171.8L266.5 172.5L265.1 172.8L264.0 172.5L265.4 171.7L266.0 170.7L267.3 170.0L268.7 169.5L270.8 169.2L271.5 168.9Z M328.7 203.4L330.3 203.1L330.8 203.2L330.7 205.3L328.4 205.6L327.9 205.3L328.7 204.5L328.7 203.4Z", "sa": "M309.3 379.5L310.4 380.8L311.8 382.9L315.4 384.6L319.3 385.3L318.1 386.7L315.4 386.8L314.0 385.8L312.3 385.8L309.4 385.7L309.3 379.5Z M339.9 317.3L338.5 322.3L337.9 325.7L337.5 329.0L340.7 333.3L342.3 335.8L335.5 340.9L326.8 341.2L326.9 344.9L325.7 347.3L320.2 346.7L319.5 350.2L322.9 350.1L321.2 352.4L318.5 356.9L315.3 358.4L312.3 361.9L317.7 364.5L313.4 368.6L309.1 373.0L308.8 377.1L309.5 378.6L300.2 377.8L299.1 374.1L296.3 373.3L298.2 369.1L298.8 365.9L301.2 359.9L302.2 357.7L300.6 356.1L300.2 353.9L300.7 350.1L300.9 343.9L303.3 340.4L302.4 335.2L304.5 331.0L306.1 325.8L304.1 320.5L305.5 314.9L308.3 309.8L309.5 307.0L310.0 301.4L313.9 297.2L315.9 294.0L321.2 296.7L325.4 294.5L331.0 299.7L336.6 302.1L339.9 304.5L340.0 309.4L345.3 309.4L348.3 304.8L351.0 305.9L348.6 309.7L343.6 313.5Z M309.3 379.5L309.4 385.7L312.3 385.8L314.0 385.8L313.1 386.9L310.7 387.8L309.3 387.7L307.7 387.5L305.7 386.7L302.8 386.3L299.3 384.7L296.4 383.2L292.6 380.1L294.9 380.7L298.8 382.5L302.5 383.5L303.9 382.3L304.8 380.4L307.4 379.2L309.3 379.5Z M306.7 282.2L308.4 286.1L309.0 289.9L311.6 296.9L313.9 297.2L310.0 301.4L309.5 307.0L308.3 309.8L305.5 314.9L304.1 320.5L306.1 325.8L304.5 331.0L302.4 335.2L303.3 340.4L300.9 343.9L300.7 350.1L300.2 353.9L300.6 356.1L302.2 357.7L301.2 359.9L298.8 365.9L298.2 369.1L296.3 373.3L299.1 374.1L300.2 377.8L309.5 378.6L305.7 379.3L302.8 382.9L298.5 382.0L295.3 380.1L290.9 376.7L290.3 373.3L291.2 365.9L289.9 362.9L293.5 355.8L298.0 351.1L295.3 353.8L294.4 349.4L296.6 342.4L295.6 336.5L298.5 332.0L301.6 323.4L301.7 316.9L303.0 310.1L304.4 299.0L305.1 288.2L305.9 283.6Z M330.0 377.4L333.3 375.7L335.7 376.4L337.4 375.3L339.6 376.5L338.8 377.5L335.0 378.3L333.8 377.4L331.4 378.6L330.0 377.4Z M339.9 317.3L341.7 317.0L344.5 319.1L345.6 319.0L348.4 320.8L350.6 322.4L352.2 324.2L351.0 325.6L351.7 327.1L350.5 328.9L347.4 330.4L345.3 329.9L343.8 330.2L341.3 329.0L339.4 329.1L337.7 327.5L337.9 325.7L338.5 325.1L338.5 322.3L339.2 319.5L339.9 317.3Z M351.7 327.1L352.2 324.2L348.4 320.8L344.5 319.1L339.9 317.3L346.8 310.8L351.0 308.1L349.6 304.3L348.8 303.2L349.2 300.1L347.1 300.0L345.8 298.8L345.0 295.4L342.0 295.2L339.2 290.9L339.3 288.8L339.8 286.0L339.6 282.1L337.8 280.2L332.9 278.5L332.6 275.2L332.1 273.2L330.3 270.8L327.4 270.0L324.5 268.4L318.3 265.5L318.2 262.5L314.9 260.9L311.0 263.1L308.9 264.0L305.3 264.2L304.2 259.7L299.5 261.3L296.6 259.6L295.6 256.7L295.2 253.7L296.9 251.7L297.3 249.3L300.7 246.1L303.3 245.1L307.1 237.7L306.7 234.9L305.5 231.8L307.6 231.7L306.1 230.3L311.5 228.6L313.2 228.6L314.2 229.9L317.9 231.1L320.5 229.6L322.0 228.0L323.8 226.6L321.1 224.6L320.0 222.1L322.5 222.2L325.5 222.2L330.6 220.7L331.3 218.9L333.4 219.4L334.0 221.0L333.8 223.3L334.1 227.1L336.0 229.7L337.7 229.3L339.8 228.7L342.3 228.2L344.5 228.3L344.2 227.2L345.6 226.6L348.5 226.9L350.6 226.7L351.6 227.6L354.0 226.4L356.5 221.8L358.1 223.2L361.2 228.5L359.2 232.7L364.9 234.0L367.2 234.9L375.3 237.6L376.2 240.8L384.8 241.4L393.1 243.6L398.7 247.5L402.1 248.5L403.5 253.7L401.0 260.1L395.3 267.1L392.6 269.6L392.0 276.9L390.9 283.0L389.6 287.8L386.3 294.3L383.4 297.1L376.0 298.2L370.9 300.2L365.3 305.2L365.3 308.8L364.2 313.0L359.2 319.4L354.8 322.9L351.7 327.1Z M306.9 263.8L308.9 264.0L310.4 263.9L311.0 263.1L313.4 262.0L314.9 260.9L318.5 260.4L318.2 262.5L318.6 263.6L318.3 265.5L321.3 267.9L324.5 268.4L325.5 269.4L327.4 270.0L328.6 270.8L330.3 270.8L331.9 271.6L332.1 273.2L332.6 274.0L332.6 275.2L331.8 275.3L332.9 278.5L338.2 278.6L337.8 280.2L338.1 281.3L339.6 282.1L340.3 283.8L339.8 286.0L339.0 287.2L339.3 288.8L338.4 289.4L338.4 288.5L335.8 287.1L333.2 287.1L328.4 287.9L327.0 290.3L327.0 291.8L325.9 295.1L325.4 294.5L322.3 294.4L321.2 296.7L319.5 294.7L315.9 294.0L313.6 296.5L311.6 296.9L310.5 293.0L309.0 289.9L309.9 287.2L308.4 286.1L308.1 284.1L306.7 282.2L308.4 279.2L307.3 276.8L307.9 275.9L307.4 274.9L308.5 273.5L308.5 271.1L308.7 269.2L309.3 268.2L306.9 263.8Z M305.9 245.3L303.3 245.1L303.0 245.6L300.7 246.1L297.5 248.0L297.3 249.3L296.6 250.2L296.9 251.7L295.2 252.6L295.2 253.7L294.5 254.2L295.6 256.7L297.2 258.4L296.6 259.6L298.4 259.8L299.5 261.3L301.9 261.3L304.2 259.7L304.0 263.9L305.3 264.2L306.9 263.8L309.3 268.2L308.7 269.2L308.5 271.1L308.5 273.5L307.4 274.9L307.9 275.9L307.3 276.8L308.4 279.2L306.7 282.2L305.9 283.6L304.5 284.3L301.7 282.7L301.5 281.6L296.0 278.8L291.0 275.7L288.9 274.0L287.7 271.7L288.2 270.9L285.8 267.3L283.1 262.2L280.5 256.6L279.3 255.4L278.4 253.3L276.3 251.5L274.3 250.4L275.2 249.1L273.9 246.5L274.7 244.5L276.9 242.8L277.3 243.9L276.5 244.6L276.5 245.6L277.7 245.4L278.8 245.7L280.0 247.1L281.6 246.0L282.1 244.1L283.8 241.7L287.1 240.6L290.2 237.7L291.0 235.9L290.6 233.8L291.4 233.5L293.2 234.8L294.1 236.1L295.4 236.8L297.0 239.7L299.1 240.1L300.6 239.4L301.6 239.8L303.3 239.6L305.4 240.9L303.6 243.7L304.5 243.8L305.9 245.3Z M314.2 229.9L313.2 228.6L311.5 228.6L306.1 230.3L307.6 231.7L305.5 231.8L306.7 234.9L307.1 237.7L304.5 243.8L305.4 240.9L301.6 239.8L299.1 240.1L295.4 236.8L293.2 234.8L290.6 233.8L288.1 232.2L284.9 232.2L283.7 231.1L280.6 228.6L281.5 227.0L283.5 225.8L285.8 222.6L285.3 220.4L285.2 217.1L283.7 213.3L284.9 212.1L284.8 209.7L286.6 209.3L289.8 207.1L290.3 203.8L293.7 202.5L296.1 202.1L299.3 200.1L301.7 199.0L301.9 200.6L299.4 202.5L297.5 204.3L296.4 207.9L298.2 209.4L299.0 211.1L298.8 212.7L300.1 213.9L305.3 214.0L308.4 216.1L312.0 215.9L312.4 217.9L311.6 220.8L313.0 223.5L311.6 225.5L313.4 227.1Z M331.3 218.9L330.6 220.7L325.5 222.2L322.5 222.2L320.0 222.1L321.1 224.6L323.8 226.6L322.0 228.0L320.5 229.6L317.9 231.1L314.2 229.9L312.6 226.1L313.0 224.1L312.2 222.7L311.8 218.8L312.9 216.4L310.4 216.2L307.3 216.4L303.7 213.6L299.4 212.9L298.7 212.1L298.8 210.0L297.8 208.1L297.1 206.3L298.3 203.3L300.1 201.1L301.8 201.3L301.1 202.9L299.8 205.9L302.0 208.0L301.8 205.0L305.1 201.7L305.7 199.5L308.7 201.5L310.6 204.0L316.0 203.8L319.7 205.3L321.3 203.8L328.1 203.6L326.7 205.7L331.0 207.3L332.9 209.4L331.8 211.7L332.5 213.8L330.1 214.7L329.4 216.8Z M342.9 228.1L342.3 228.2L340.7 227.9L339.8 228.7L338.6 229.1L337.7 229.3L337.4 229.8L336.0 229.7L334.3 228.4L334.1 227.1L333.4 225.7L333.8 223.3L334.6 222.3L334.0 221.0L333.0 220.6L333.4 219.4L332.7 218.8L331.3 218.9L329.4 216.8L330.2 216.0L330.1 214.7L331.8 214.3L332.5 213.8L331.6 212.7L331.8 211.7L334.0 210.1L335.8 211.1L337.5 212.9L337.6 214.4L338.7 214.4L340.2 215.8L341.3 216.7L340.8 219.2L339.1 220.0L339.3 220.6L338.8 222.1L340.0 224.1L340.9 224.1L341.2 225.6L342.9 228.1Z M348.5 226.9L347.0 226.3L345.6 226.6L344.5 226.4L344.2 227.2L344.7 227.7L344.5 228.3L342.9 228.1L341.2 225.6L340.9 224.1L340.0 224.1L338.8 222.1L339.3 220.6L339.1 220.0L340.8 219.2L341.3 216.7L344.6 217.3L344.9 216.8L347.1 216.6L350.1 217.3L348.7 219.7L348.9 221.6L350.0 223.3L349.5 224.5L349.3 225.7L348.5 226.9Z M290.6 233.8L291.0 235.9L290.2 237.7L287.1 240.6L283.8 241.7L282.1 244.1L281.6 246.0L280.0 247.1L278.8 245.7L277.7 245.4L276.5 245.6L276.5 244.6L277.3 243.9L276.9 242.8L278.4 240.7L277.8 239.5L276.8 240.8L275.1 239.6L275.7 238.8L275.2 236.3L276.2 235.9L276.7 234.1L277.7 232.3L277.5 231.2L279.0 230.6L281.0 229.5L283.7 231.1L284.3 231.0L284.9 232.2L287.3 232.6L288.1 232.2L289.4 233.1L290.6 233.8Z M338.4 289.4L339.2 290.9L339.1 294.7L342.0 295.2L343.1 294.7L345.0 295.4L345.5 296.3L345.8 298.8L346.1 299.9L347.1 300.0L348.2 299.6L349.2 300.1L349.2 301.6L348.8 303.2L348.3 304.8L347.8 307.3L345.3 309.4L343.1 309.9L340.0 309.4L337.2 308.7L339.9 304.5L339.5 303.2L336.6 302.1L333.3 300.1L331.0 299.7L325.9 295.1L327.0 291.8L327.0 290.3L328.4 287.9L333.2 287.1L335.8 287.1L338.4 288.5L338.4 289.4Z", "eu": "M636.4 104.4L632.4 106.6L632.2 112.1L635.0 117.2L633.3 118.3L631.6 118.8L628.9 117.1L626.3 115.3L622.0 115.1L617.8 113.3L611.3 112.4L607.4 110.3L601.9 107.7L606.2 104.9L608.7 102.7L606.2 102.5L607.7 100.5L610.8 99.4L611.3 96.4L607.2 94.6L603.9 93.4L598.2 92.8L597.3 91.1L594.8 90.1L593.8 88.0L590.0 88.1L588.3 88.6L587.6 86.8L587.5 85.6L590.8 85.1L588.1 83.9L587.2 82.9L586.0 80.3L583.0 78.4L581.2 78.0L577.4 75.7L575.8 73.7L576.2 70.2L577.7 68.1L580.9 66.6L578.0 65.3L586.5 60.1L583.4 56.8L582.1 52.9L580.7 47.4L579.0 43.4L581.7 41.2L586.4 40.1L593.8 40.8L611.9 44.6L614.2 47.8L606.6 50.0L592.2 48.2L596.9 51.6L600.6 55.3L603.2 54.6L603.3 52.4L612.3 53.4L616.9 48.7L622.1 49.8L621.4 46.2L620.7 42.9L630.1 45.3L626.6 47.2L633.0 47.5L639.5 44.4L651.3 42.2L652.0 44.2L659.2 43.1L666.5 43.7L666.8 40.2L676.4 40.1L690.3 44.2L689.3 41.3L685.9 40.4L685.3 36.9L690.4 33.5L694.3 30.4L702.2 32.7L701.3 35.9L701.6 41.6L703.4 45.2L701.2 49.5L705.3 47.8L708.5 45.1L708.2 41.7L704.4 39.9L703.1 34.9L707.4 31.0L710.2 32.5L712.1 35.7L715.5 32.6L726.4 34.0L723.6 28.8L735.2 28.3L738.9 26.5L745.3 24.6L758.1 22.9L766.3 21.8L774.8 21.0L780.7 19.8L789.9 17.5L790.8 19.1L797.9 20.9L808.5 20.3L817.0 22.6L813.3 24.9L803.9 27.3L811.4 28.4L815.4 29.6L821.0 28.5L830.6 30.2L842.4 28.5L852.7 29.0L858.5 32.2L860.3 35.6L867.4 33.8L876.6 34.3L884.0 34.4L886.5 32.2L915.3 32.8L924.9 36.5L941.7 36.5L943.6 39.7L950.8 39.9L960.9 40.4L971.0 42.5L972.2 39.9L982.3 39.4L996.1 40.6L1000.0 52.8L996.4 54.1L995.3 55.3L998.3 58.4L997.9 60.3L984.9 61.8L978.2 64.0L973.1 67.0L961.9 67.3L958.0 67.4L953.4 68.9L950.1 72.7L952.9 77.3L949.2 79.8L945.5 82.4L940.4 86.2L935.5 91.6L933.3 85.7L933.1 75.6L935.6 72.7L944.9 68.6L954.6 63.5L953.5 59.8L944.8 65.2L935.3 62.7L930.7 69.0L920.2 70.1L916.1 67.6L904.1 68.5L886.0 74.8L879.7 81.7L883.8 84.0L888.6 82.8L892.7 88.2L890.3 94.3L884.9 102.8L880.2 107.9L874.6 112.8L869.2 114.4L863.7 115.1L863.3 116.1L863.3 116.1L862.9 115.6L864.3 114.1L864.0 108.4L869.7 107.9L872.5 102.2L875.1 98.7L868.1 100.6L862.7 98.0L854.6 95.1L852.6 90.7L849.9 86.7L843.3 84.8L836.1 85.4L835.3 87.5L833.8 89.9L831.4 94.0L824.1 94.8L819.3 94.1L813.6 95.7L807.4 96.9L801.3 96.4L796.9 93.7L790.6 93.7L784.0 93.0L780.2 90.2L774.6 88.8L772.9 93.3L766.2 94.5L761.5 93.1L756.2 92.2L746.7 95.9L742.7 96.6L737.6 95.3L734.5 93.6L731.6 91.5L723.8 90.6L716.1 85.0L713.6 82.0L704.0 84.8L700.6 82.3L696.8 80.1L689.4 80.6L681.1 82.3L669.4 84.3L668.7 86.9L666.6 89.0L670.4 92.2L665.7 92.9L657.7 91.5L651.5 91.6L641.0 89.7L634.9 94.8L629.9 96.2L629.1 98.9L633.5 100.7L635.0 104.0Z M760.5 8.3L766.5 7.6L771.9 9.0L778.3 11.7L777.6 14.2L771.5 14.6L763.8 13.8L759.2 12.7L757.1 10.7L753.3 10.2L760.5 8.3Z M785.7 13.1L792.7 14.7L791.9 15.8L776.2 16.9L781.3 13.2L783.6 12.9L785.7 13.1Z M885.6 21.8L893.0 22.0L903.0 23.4L900.8 25.5L890.6 25.4L886.0 26.1L880.5 24.3L882.0 22.4L885.6 21.8Z M911.7 24.0L918.7 24.8L915.5 25.9L911.0 25.6L905.9 24.5L906.6 23.6L911.7 24.0Z M888.5 29.5L891.1 28.4L894.6 28.2L898.6 29.2L898.9 30.0L894.7 30.0L889.0 29.7L888.5 29.5Z M624.6 9.5L630.0 9.0L634.2 8.9L634.8 9.7L636.4 9.0L639.0 8.6L643.1 9.2L642.0 9.6L638.3 10.0L635.8 10.2L635.4 10.6L632.2 11.1L629.2 10.4L630.8 9.6L624.6 9.5Z M563.1 82.4L558.0 82.5L554.6 82.1L555.2 80.9L559.1 80.0L562.0 80.5L563.2 81.0L562.9 81.7L563.1 82.4Z M648.6 28.5L655.3 26.0L654.5 24.8L660.7 23.3L669.9 21.5L679.2 21.0L683.9 20.0L689.3 19.6L691.3 20.7L689.4 21.6L679.5 23.0L671.1 24.3L662.4 26.9L658.3 29.6L653.9 32.3L654.5 34.6L659.8 36.9L658.2 37.1L649.1 36.8L648.4 35.5L643.3 34.8L642.9 33.3L645.8 32.7L645.7 31.2L651.2 28.8L648.6 28.5Z M897.0 84.2L897.9 86.8L897.9 89.6L899.0 92.4L901.8 97.3L897.7 96.4L896.0 100.4L898.7 103.2L898.6 105.2L896.5 103.5L894.7 105.6L894.2 103.3L894.5 100.6L894.2 97.6L894.8 95.5L894.9 91.8L893.3 89.1L893.6 85.3L896.1 84.0L895.0 82.7L896.3 82.3L897.0 84.2Z M14.1 46.7L13.8 48.4L15.7 49.1L15.1 47.0L22.6 47.5L28.1 50.1L25.3 51.3L20.7 51.6L20.7 54.3L19.6 54.9L17.0 54.8L14.9 53.8L11.2 53.0L10.5 51.8L7.7 51.3L4.6 51.7L3.0 50.7L3.6 49.7L0.3 50.3L1.6 51.7L0.0 52.8L0.0 41.8L6.8 43.9L14.1 46.7Z M3.6 36.4L0.0 36.6L0.0 34.7L0.4 34.6L2.7 34.6L6.7 35.4L6.5 35.7L3.6 36.4Z M592.9 105.6L593.6 104.9L595.6 105.5L596.5 105.7L596.8 106.2L597.3 106.3L597.3 106.5L598.6 107.2L601.5 107.0L600.9 108.0L597.9 108.5L594.1 110.1L592.6 109.5L593.2 108.2L590.2 107.4L590.6 106.9L593.3 106.0L592.9 105.6Z M542.1 12.0L543.1 11.1L547.2 11.0L550.7 11.9L559.8 14.0L552.9 15.1L551.3 17.1L548.9 17.7L547.6 20.0L544.2 20.1L538.2 18.4L540.7 17.4L536.6 16.6L531.2 14.3L529.0 12.1L536.6 11.1L538.1 12.1L542.1 12.0Z M586.4 40.1L581.7 41.2L579.4 41.5L580.6 39.5L577.0 38.4L572.7 39.4L571.4 41.4L568.7 42.6L565.7 42.0L562.1 42.1L559.0 40.6L557.3 41.4L555.6 41.5L555.2 43.3L550.0 42.9L549.2 44.4L546.6 44.4L544.7 46.4L542.0 49.5L537.7 53.4L538.7 54.3L537.7 55.4L534.9 55.4L533.1 58.0L533.3 61.7L535.1 63.1L534.2 66.3L531.9 68.2L530.6 69.8L528.8 68.1L523.3 71.4L519.6 72.0L515.7 70.6L514.7 67.6L513.9 61.2L516.4 59.4L523.8 57.1L529.2 54.2L534.3 50.3L541.0 45.0L545.7 42.9L553.3 39.4L559.4 38.2L564.0 38.3L568.2 36.0L573.3 36.1L578.2 35.6L586.9 37.6L583.3 38.4L586.4 40.1Z M576.1 11.0L572.0 12.5L564.0 12.8L555.8 12.3L555.3 11.5L551.3 11.5L548.2 10.2L556.8 9.4L560.9 10.1L563.7 9.3L570.7 10.0L576.1 11.0Z M568.7 17.1L562.5 18.2L557.6 17.6L559.5 16.8L557.8 16.0L563.6 15.4L564.7 16.4L568.7 17.1Z M356.5 221.8L354.9 224.3L354.0 226.4L352.9 227.4L351.6 227.6L351.2 226.8L350.6 226.7L349.8 227.5L348.5 226.9L349.3 225.7L349.5 224.5L350.0 223.3L348.9 221.6L348.7 219.7L350.1 217.3L351.1 217.6L353.1 218.3L356.0 220.7L356.5 221.8Z M517.2 95.9L518.5 96.7L522.5 97.2L521.1 99.1L520.7 101.1L520.0 101.5L518.7 101.3L518.8 102.0L516.8 103.5L516.7 104.8L518.1 104.4L519.0 105.6L518.9 106.4L519.7 107.4L518.7 108.3L519.5 110.4L521.0 110.8L520.7 112.0L518.1 113.5L512.7 112.8L508.6 113.7L508.3 115.4L505.1 115.7L501.9 114.5L500.9 115.1L495.8 113.8L494.7 112.7L496.2 111.0L496.7 105.5L493.8 102.6L491.8 101.2L487.5 100.1L487.2 98.1L490.8 97.5L495.5 98.2L494.6 95.1L497.3 96.3L503.7 94.1L504.6 91.8L507.0 91.3L507.4 92.2L508.7 92.3L510.0 93.4L511.9 94.7L513.3 94.5L515.8 95.8L516.4 96.0L517.2 95.9Z M524.3 114.9L526.1 113.9L526.6 116.2L525.6 118.4L524.4 117.8L523.7 116.0L524.3 114.9Z M530.6 69.8L531.9 68.2L534.2 66.3L535.1 63.1L533.3 61.7L533.1 58.0L534.9 55.4L537.7 55.4L538.7 54.3L537.7 53.4L542.0 49.5L544.7 46.4L546.6 44.4L549.2 44.4L550.0 42.9L555.2 43.3L555.6 41.5L557.3 41.4L561.1 42.7L565.4 44.6L565.5 48.9L566.4 50.0L561.6 50.8L558.9 52.7L559.4 54.4L554.9 56.6L549.6 59.0L547.6 62.9L549.5 64.9L552.2 66.4L549.6 69.6L546.7 70.2L545.7 74.9L544.1 77.5L540.7 77.2L539.2 79.4L536.0 79.6L535.1 76.9L532.7 73.8L530.6 69.8Z M578.3 77.3L581.2 78.0L581.6 78.7L583.0 78.4L585.8 79.0L586.0 80.3L585.4 81.1L587.2 82.9L588.3 83.4L588.1 83.9L590.0 84.4L590.8 85.1L589.7 85.7L587.5 85.6L587.0 85.9L587.6 86.8L588.3 88.6L588.3 88.6L585.9 88.8L585.1 89.4L584.9 90.8L583.8 90.5L581.3 90.6L580.5 90.0L579.5 90.5L578.4 90.1L576.3 90.0L573.2 89.4L570.4 89.1L568.2 89.2L566.7 90.0L565.4 90.1L565.3 88.8L564.4 87.5L566.1 87.0L566.1 85.9L565.4 84.8L565.2 83.6L567.9 83.6L570.9 82.5L571.6 81.0L573.9 80.1L573.6 78.8L575.3 78.4L578.3 77.3Z M588.3 88.6L590.0 88.1L593.8 88.0L594.8 90.1L597.3 91.1L598.2 92.8L603.9 93.4L607.2 94.6L611.3 96.4L610.8 99.4L607.7 100.5L606.2 102.5L602.1 103.6L597.1 104.8L596.8 106.2L595.6 105.5L592.9 105.6L588.2 104.6L585.4 103.9L582.2 107.5L579.7 107.5L579.1 106.7L580.4 104.8L580.8 104.1L582.7 104.6L582.9 104.1L582.1 103.0L580.7 101.4L579.6 99.7L576.5 98.7L573.9 99.4L572.1 100.0L569.1 100.7L566.0 100.0L563.1 100.3L561.3 98.8L562.7 97.0L562.6 95.9L566.5 93.3L565.4 90.1L568.2 89.2L573.2 89.4L578.4 90.1L580.5 90.0L583.8 90.5L585.1 89.4L588.3 88.6Z M565.2 83.6L565.4 84.8L566.1 85.9L566.1 87.0L564.4 87.5L565.3 88.8L565.4 90.1L566.7 92.5L566.5 93.3L565.1 93.6L562.6 95.9L563.3 97.1L562.7 97.0L560.0 95.9L558.0 96.3L556.7 96.0L555.1 96.6L553.7 95.6L552.5 96.0L552.4 95.8L551.1 94.5L549.0 94.3L548.8 93.4L546.9 93.1L546.4 93.8L544.9 93.3L545.1 92.5L543.0 92.3L541.7 91.4L540.6 89.6L540.8 88.6L540.1 87.2L539.1 86.2L539.9 85.4L539.2 84.0L541.1 83.2L545.5 81.9L549.0 81.0L551.7 81.4L551.9 82.1L554.6 82.1L558.0 82.5L563.1 82.4L564.6 82.7L565.2 83.6Z M547.2 99.7L547.0 100.8L545.4 100.8L545.9 101.4L545.0 103.2L544.5 103.7L542.0 103.7L540.6 104.4L538.4 104.1L534.4 103.4L533.8 102.5L531.0 102.9L530.7 103.5L529.0 103.1L527.6 103.0L526.3 102.5L526.8 101.8L526.7 101.3L527.5 101.2L528.9 101.9L529.3 101.2L531.7 101.3L533.7 100.8L535.1 100.9L535.9 101.5L536.2 101.0L535.8 99.2L536.8 98.8L537.8 97.6L539.8 98.5L541.4 97.3L542.4 97.1L544.5 98.0L545.8 97.8L547.1 98.3L546.9 98.7L547.2 99.7Z M561.3 98.8L562.9 99.6L563.1 100.3L561.4 100.9L560.1 102.8L558.4 104.7L556.2 105.2L554.4 105.1L552.3 105.8L552.3 105.8L551.3 106.2L549.0 105.7L546.9 104.5L546.0 104.2L545.5 103.2L545.0 103.2L545.9 101.4L545.4 100.8L547.0 100.8L547.2 99.7L548.6 100.4L549.6 100.7L551.9 100.3L552.2 99.8L553.3 99.7L554.6 99.3L554.9 99.4L556.2 99.1L556.9 98.4L557.8 98.3L560.8 99.1L561.3 98.8Z M573.9 99.4L574.6 99.0L576.5 98.7L578.5 99.6L579.6 99.7L580.9 100.4L580.7 101.4L581.7 101.8L582.1 103.0L583.1 103.7L582.9 104.1L583.4 104.4L582.7 104.6L581.0 104.5L580.8 104.1L580.2 104.3L580.4 104.8L579.6 105.7L579.1 106.7L578.4 107.0L577.9 105.7L578.2 104.5L578.1 103.3L576.5 101.7L575.6 100.5L574.8 99.7L573.9 99.4Z M578.4 107.0L579.7 107.5L581.0 107.0L582.2 107.5L582.3 108.2L580.9 108.8L580.1 108.6L579.3 111.9L577.7 111.6L575.7 110.6L572.4 111.3L571.0 112.0L566.9 111.8L564.8 111.4L563.7 111.6L562.9 110.5L562.4 110.0L563.1 109.5L562.4 109.2L561.5 109.8L559.9 109.0L559.7 107.8L558.0 107.2L557.7 106.3L556.2 105.2L558.4 104.7L560.1 102.8L561.4 100.9L563.1 100.3L564.3 99.7L566.0 100.0L567.8 100.1L569.1 100.7L570.0 100.3L572.1 100.0L572.8 99.4L573.9 99.4L574.8 99.7L575.6 100.5L576.5 101.7L578.1 103.3L578.2 104.5L577.9 105.7L578.4 107.0Z M573.6 78.8L573.9 80.1L571.6 81.0L570.9 82.5L567.9 83.6L565.2 83.6L564.6 82.7L563.1 82.4L562.9 81.7L563.2 81.0L562.0 80.5L559.1 80.0L558.5 77.7L561.7 76.8L566.3 77.0L569.1 76.7L569.4 77.3L570.9 77.5L573.6 78.8Z M575.8 73.7L577.1 74.3L577.4 75.7L578.3 77.3L575.3 78.4L573.6 78.8L570.9 77.5L569.4 77.3L569.1 76.7L566.3 77.0L561.7 76.8L558.5 77.7L558.6 75.6L559.9 73.9L562.6 72.9L564.8 75.0L567.0 74.9L567.5 72.8L569.9 72.3L571.1 72.6L573.5 73.7L575.8 73.7Z M577.7 68.1L577.7 68.1L578.1 68.6L576.2 70.2L577.0 72.8L575.8 73.7L573.5 73.7L571.1 72.6L569.9 72.3L567.5 72.8L567.9 71.2L566.8 71.5L565.1 70.5L564.8 68.9L568.3 68.2L571.8 67.7L574.9 68.2L577.7 68.1L577.7 68.1Z M539.2 84.0L539.9 85.4L539.1 86.2L540.1 87.2L540.8 88.6L540.6 89.6L541.7 91.4L540.5 91.7L539.7 91.3L539.0 91.9L537.1 92.4L536.0 93.1L534.0 93.7L534.5 94.5L534.8 95.7L536.2 96.4L537.8 97.6L536.8 98.8L535.8 99.2L536.2 101.0L535.9 101.5L535.1 100.9L533.7 100.8L531.7 101.3L529.3 101.2L528.9 101.9L527.5 101.2L526.7 101.3L523.7 100.5L523.1 101.1L520.7 101.1L521.1 99.1L522.5 97.2L518.5 96.7L517.2 95.9L517.3 94.7L516.8 94.1L517.1 92.2L516.6 89.3L518.3 89.3L519.0 88.3L519.7 85.7L519.2 84.8L519.7 84.2L522.0 84.0L522.6 84.6L524.4 83.3L523.8 82.2L523.7 80.7L525.8 81.0L527.6 80.6L527.6 81.7L530.4 82.3L530.4 83.3L533.2 82.8L534.8 82.0L537.9 83.1L539.2 84.0Z M562.9 110.5L563.7 111.6L564.8 111.4L566.9 111.8L571.0 112.0L572.4 111.3L575.7 110.6L577.7 111.6L579.3 111.9L577.9 113.1L576.9 115.1L577.8 116.6L575.4 116.3L572.5 117.1L572.5 118.5L570.0 118.8L568.0 117.8L565.8 118.6L563.8 118.5L563.6 116.7L562.2 115.8L562.6 115.4L562.3 115.1L562.8 114.2L563.9 113.3L562.5 112.1L562.3 111.1L562.9 110.5Z M573.0 135.3L572.7 136.1L568.7 136.3L568.7 135.9L565.3 135.3L565.8 134.2L567.4 135.1L569.5 134.9L571.6 135.1L571.5 135.6L573.0 135.3Z M563.8 118.5L565.8 118.6L568.0 117.8L570.0 118.8L572.5 118.5L572.5 117.1L573.9 117.9L573.0 119.6L572.4 119.9L570.7 119.9L569.2 119.6L565.9 120.3L567.8 121.9L566.4 122.3L564.8 122.3L563.4 120.9L562.9 121.5L563.5 123.2L564.9 124.5L563.8 125.1L565.4 126.4L566.7 127.2L566.8 128.7L564.2 128.0L565.0 129.4L563.3 129.7L564.3 132.2L562.5 132.2L560.2 131.0L559.2 128.8L558.7 126.9L557.6 125.6L556.2 124.1L556.0 123.3L557.3 121.9L557.4 121.0L558.3 120.6L558.4 119.9L560.2 119.6L561.3 119.0L562.8 119.1L563.2 118.6L563.8 118.5Z M558.4 119.9L558.3 120.6L557.4 121.0L557.3 121.9L556.0 123.3L555.5 123.1L555.4 122.5L553.9 121.5L553.7 120.2L553.9 118.3L554.3 117.4L553.8 117.0L553.8 117.0L553.6 116.1L554.8 114.8L555.0 115.3L555.8 115.0L556.3 115.8L557.0 116.1L557.2 117.1L557.2 117.1L556.8 118.0L557.2 119.2L558.4 119.9Z M546.0 104.2L546.9 104.5L549.0 105.7L551.3 106.2L552.3 105.8L553.0 106.9L553.9 107.7L552.8 108.7L551.5 108.1L549.6 108.1L547.2 107.7L545.9 107.7L545.3 108.3L544.3 107.7L543.8 108.8L545.1 110.1L545.7 111.0L547.0 112.0L548.0 112.6L549.1 113.8L551.6 114.9L551.3 115.3L551.3 115.3L548.6 114.3L547.0 113.3L544.5 112.5L542.2 110.4L542.7 110.2L541.4 109.1L541.4 108.1L539.6 107.7L538.8 108.9L537.9 108.0L538.0 107.0L538.1 106.9L540.0 107.0L540.5 106.6L541.5 107.0L542.6 107.1L542.6 106.3L543.5 106.0L543.8 104.9L546.0 104.2Z M526.7 101.3L526.8 101.8L526.3 102.5L527.6 103.0L529.0 103.1L528.8 104.2L527.6 104.7L525.5 104.3L524.9 105.5L523.6 105.5L523.1 105.1L521.5 106.0L520.2 106.2L519.0 105.6L518.1 104.4L516.7 104.8L516.8 103.5L518.8 102.0L518.7 101.3L520.0 101.5L520.7 101.1L523.1 101.1L523.7 100.5L526.7 101.3Z M516.8 94.1L517.3 94.7L517.2 95.9L516.4 96.0L515.8 95.8L516.1 94.2L516.8 94.1Z M517.1 92.2L516.8 94.1L516.1 94.2L515.8 95.8L513.3 94.5L511.9 94.7L510.0 93.4L508.7 92.3L507.4 92.2L507.0 91.3L509.2 90.7L509.2 90.7L509.2 90.7L511.2 90.9L513.8 90.3L515.6 91.6L517.1 92.2Z M519.2 84.8L519.7 85.7L519.0 88.3L518.3 89.3L516.6 89.3L517.1 92.2L515.6 91.6L513.8 90.3L511.2 90.9L509.2 90.7L509.2 90.7L510.6 89.9L513.1 85.9L516.9 84.7L519.2 84.8Z M474.9 117.0L475.9 116.3L477.0 115.9L477.7 117.2L479.4 117.2L479.9 116.9L481.5 117.0L482.3 118.4L481.0 119.1L480.9 121.3L480.5 121.7L480.4 123.0L479.2 123.3L480.3 124.9L479.5 126.7L480.5 127.6L480.1 128.3L479.1 129.4L479.3 130.3L478.2 131.0L476.7 130.6L475.3 130.9L475.7 128.7L475.4 127.0L474.2 126.8L473.5 125.7L473.8 123.9L474.9 122.9L475.1 121.8L475.6 120.1L475.6 118.9L475.0 117.9L474.9 117.0Z M479.3 130.3L479.1 129.4L480.1 128.3L480.5 127.6L479.5 126.7L480.3 124.9L479.2 123.3L480.4 123.0L480.5 121.7L480.9 121.3L481.0 119.1L482.3 118.4L481.5 117.0L479.9 116.9L479.4 117.2L477.7 117.2L477.0 115.9L475.9 116.3L474.9 117.0L475.0 115.0L473.9 113.8L477.8 111.8L481.2 112.3L485.0 112.3L487.9 112.8L490.2 112.6L494.7 112.7L495.8 113.8L500.9 115.1L501.9 114.5L505.1 115.7L508.3 115.4L508.4 117.0L505.8 118.8L502.3 119.4L502.0 120.3L500.3 121.9L499.2 124.1L500.3 125.7L498.7 127.0L498.1 128.8L496.0 129.3L494.0 131.5L490.5 131.5L487.9 131.5L486.1 132.4L485.1 133.5L483.7 133.3L482.7 132.3L481.9 130.7L479.3 130.3Z M482.8 83.7L483.2 85.7L481.1 88.2L476.2 89.8L472.3 89.4L474.5 86.5L473.1 83.7L476.9 81.5L479.0 80.2L479.5 81.7L479.0 83.2L480.7 83.1L482.8 83.7Z M529.0 103.1L530.7 103.5L531.0 102.9L533.8 102.5L534.4 103.4L538.4 104.1L538.1 105.5L538.7 106.7L536.5 106.3L534.2 107.3L534.4 108.7L534.1 109.4L535.0 110.9L537.6 112.3L539.0 114.6L542.1 116.8L544.2 116.8L544.9 117.4L544.1 117.9L546.6 118.9L548.7 119.8L551.0 121.2L551.3 121.8L550.8 122.7L549.3 121.5L546.9 121.0L545.7 122.8L547.7 123.8L547.4 125.3L546.2 125.4L544.7 127.8L543.6 128.0L543.6 127.2L544.1 125.7L544.7 125.1L543.7 123.5L542.8 122.1L541.7 121.7L540.8 120.5L539.1 120.0L537.9 118.9L535.8 118.7L533.6 117.5L531.1 115.7L529.2 114.1L528.3 111.3L527.0 111.0L524.7 110.1L523.4 110.5L521.8 111.8L520.7 112.0L521.0 110.8L519.5 110.4L518.7 108.3L519.7 107.4L518.9 106.4L519.0 105.6L520.2 106.2L521.5 106.0L523.1 105.1L523.6 105.5L524.9 105.5L525.5 104.3L527.6 104.7L528.8 104.2L529.0 103.1Z M541.0 127.4L543.1 127.1L542.1 129.3L542.5 130.2L541.9 131.6L539.8 130.6L538.4 130.3L534.5 128.9L534.9 127.4L538.2 127.7L541.0 127.4Z M524.2 119.7L525.6 118.9L527.2 120.8L526.9 124.5L525.6 124.3L524.5 125.3L523.4 124.5L523.3 121.2L522.7 119.6L524.2 119.7Z M527.6 80.6L525.8 81.0L523.7 80.7L522.6 79.1L522.5 76.3L522.9 75.5L523.7 74.7L526.2 74.5L527.2 73.8L529.4 73.0L529.3 74.4L528.5 75.3L528.8 76.1L530.3 76.5L529.6 77.6L528.8 77.2L526.8 79.3L527.6 80.6Z M534.4 77.5L535.3 78.9L533.6 81.1L530.7 79.5L530.3 78.4L534.4 77.5Z M482.8 83.7L480.7 83.1L479.0 83.2L479.5 81.7L479.0 80.2L481.3 80.1L484.3 81.8L482.8 83.7Z M491.4 85.0L491.4 85.0L491.8 83.4L490.0 81.7L489.9 81.6L486.5 81.1L485.9 80.4L486.9 79.1L486.0 78.4L484.5 79.7L484.3 77.0L482.9 75.6L483.9 72.7L486.1 70.5L488.3 70.7L491.7 70.5L488.7 73.5L491.5 73.1L494.6 73.1L493.8 75.4L491.3 77.9L494.2 78.0L494.4 78.3L496.9 81.6L498.8 82.0L500.5 85.2L501.3 86.3L504.7 86.8L504.3 88.6L502.9 89.4L504.0 90.9L501.5 92.3L497.8 92.3L493.1 93.1L491.8 92.5L490.0 93.8L487.4 93.5L485.4 94.6L484.0 94.0L488.0 91.1L490.5 90.5L490.5 90.5L486.2 90.0L485.4 88.9L488.3 88.1L486.7 86.6L487.3 84.7L491.4 85.0Z M459.7 48.7L459.1 50.5L462.2 52.4L458.6 54.5L450.6 56.4L448.2 57.0L444.5 56.5L436.8 55.7L439.5 54.4L433.5 53.1L438.4 52.5L438.3 51.7L432.4 51.1L434.3 49.3L438.5 48.9L442.8 50.7L447.1 49.2L450.6 50.0L455.1 48.5L459.7 48.7Z M538.4 104.1L540.6 104.4L542.0 103.7L544.5 103.7L545.0 103.2L545.5 103.2L546.0 104.2L543.8 104.9L543.5 106.0L542.6 106.3L542.6 107.1L541.5 107.0L540.5 106.6L540.0 107.0L538.1 106.9L538.7 106.7L538.1 105.5L538.4 104.1Z M579.4 41.5L579.0 43.4L583.3 45.3L580.7 47.4L583.9 50.5L582.1 52.9L584.6 55.0L583.4 56.8L587.5 58.7L586.5 60.1L583.9 61.7L578.0 65.3L578.0 65.3L578.0 65.3L572.9 65.5L568.0 66.5L563.5 67.1L561.9 65.6L559.2 64.7L559.8 61.9L558.5 59.4L559.8 57.8L562.3 56.1L568.7 53.0L570.6 52.5L570.3 51.3L566.4 50.0L565.5 48.9L565.4 44.6L561.1 42.7L557.3 41.4L559.0 40.6L562.1 42.1L565.7 42.0L568.7 42.6L571.4 41.4L572.7 39.4L577.0 38.4L580.6 39.5L579.4 41.5Z M562.7 97.0L561.9 97.7L561.3 98.8L560.8 99.1L557.8 98.3L556.9 98.4L556.2 99.1L554.9 99.4L554.6 99.3L553.3 99.7L552.2 99.8L551.9 100.3L549.6 100.7L548.6 100.4L547.2 99.7L546.9 98.7L547.1 98.3L547.5 97.7L548.7 97.8L549.7 97.5L549.8 97.2L550.3 97.1L550.5 96.5L551.1 96.3L551.5 95.8L552.4 95.8L552.5 96.0L553.7 95.6L555.1 96.6L556.7 96.0L558.0 96.3L560.0 95.9L562.7 97.0Z M541.7 91.4L543.0 92.3L545.1 92.5L544.9 93.3L546.4 93.8L546.9 93.1L548.8 93.4L549.0 94.3L551.1 94.5L552.4 95.8L551.5 95.8L551.1 96.3L550.5 96.5L550.3 97.1L549.8 97.2L549.7 97.5L548.7 97.8L547.5 97.7L547.1 98.3L545.8 97.8L544.5 98.0L542.4 97.1L541.4 97.3L539.8 98.5L537.8 97.6L536.2 96.4L534.8 95.7L534.5 94.5L534.0 93.7L536.0 93.1L537.1 92.4L539.0 91.9L539.7 91.3L540.5 91.7L541.7 91.4Z M551.6 114.9L549.1 113.8L548.0 112.6L547.0 112.0L545.7 111.0L545.1 110.1L543.8 108.8L544.3 107.7L545.3 108.3L545.9 107.7L547.2 107.7L549.6 108.1L551.5 108.1L552.8 108.7L552.8 108.7L553.8 108.7L553.1 109.9L554.4 111.0L554.0 112.3L553.4 112.4L552.9 112.7L552.0 113.3L551.6 114.9Z M562.2 115.8L563.6 116.7L563.8 118.5L563.2 118.6L562.8 119.1L561.3 119.0L560.2 119.6L558.4 119.9L557.2 119.2L556.8 118.0L557.2 117.1L557.2 117.1L557.5 117.1L557.7 116.5L559.3 116.1L559.9 116.0L560.9 115.8L562.2 115.8Z M552.3 105.8L552.3 105.8L554.4 105.1L556.2 105.2L557.7 106.3L558.0 107.2L559.7 107.8L559.9 109.0L561.5 109.8L562.4 109.2L563.1 109.5L562.4 110.0L562.9 110.5L562.3 111.1L562.5 112.1L563.9 113.3L562.8 114.2L562.3 115.1L562.6 115.4L562.2 115.8L560.9 115.8L559.9 116.0L559.8 115.8L560.2 115.4L560.5 114.8L560.1 114.8L559.6 114.3L559.1 114.1L558.7 113.7L558.2 113.5L557.8 113.1L557.3 113.3L556.9 114.2L556.3 114.4L556.5 114.2L555.4 113.6L554.5 113.3L554.1 112.9L553.4 112.4L554.0 112.3L554.4 111.0L553.1 109.9L553.8 108.7L552.8 108.7L552.8 108.7L553.9 107.7L553.0 106.9L552.3 105.8Z M555.8 115.0L555.0 115.3L554.8 114.8L553.6 116.1L553.8 117.0L553.2 116.8L552.5 115.9L551.3 115.3L551.6 114.9L552.0 113.3L552.9 112.7L553.4 112.4L554.1 112.9L554.5 113.3L555.4 113.6L556.5 114.2L556.3 114.4L555.8 115.0Z M557.2 117.1L557.0 116.1L556.3 115.8L555.8 115.0L556.3 114.4L556.9 114.2L557.3 113.3L557.8 113.1L558.2 113.5L558.7 113.7L559.1 114.1L559.6 114.3L560.1 114.8L560.5 114.8L560.2 115.4L559.8 115.8L559.9 116.0L559.3 116.1L557.7 116.5L557.5 117.1L557.2 117.1Z", "as": "M742.7 96.6L738.2 98.7L736.6 102.8L729.1 106.8L722.1 108.6L722.7 114.1L721.2 115.3L715.7 114.0L710.1 114.2L704.6 113.6L699.6 114.3L697.1 115.9L691.9 118.4L689.6 120.4L685.3 119.0L683.4 116.7L680.3 111.9L672.3 112.5L667.3 108.9L662.5 106.7L655.5 118.6L652.1 116.5L647.1 116.3L645.7 116.6L645.8 114.5L641.4 111.0L639.7 109.4L642.5 107.7L647.3 107.6L647.3 103.2L642.2 102.6L636.4 104.4L635.3 102.6L631.4 100.8L630.7 96.8L632.1 93.2L635.3 92.8L645.4 89.7L654.8 92.7L662.1 91.5L666.5 92.1L671.1 90.9L669.2 87.6L671.4 86.2L670.7 83.3L682.4 81.7L691.9 79.5L697.7 83.0L704.2 83.2L706.6 84.6L712.6 82.8L722.3 92.0L727.6 92.2L733.2 92.0L736.4 94.1L741.2 94.9Z M655.5 118.6L655.4 108.3L662.5 106.7L663.0 106.9L667.3 108.9L669.6 110.0L672.3 112.5L675.5 112.1L680.3 111.9L683.6 113.9L683.4 116.7L684.8 116.7L685.3 119.0L688.8 119.1L689.6 120.4L690.6 120.4L691.9 118.4L695.5 116.4L697.1 115.9L697.9 116.2L695.6 118.0L697.7 119.0L699.6 118.4L702.9 119.8L699.4 121.8L697.3 121.5L696.1 121.6L695.7 120.8L696.3 119.6L692.6 120.2L691.7 122.0L690.4 123.5L688.1 123.4L687.3 124.6L689.4 125.3L690.0 127.3L688.4 130.2L686.3 129.6L684.8 129.5L684.9 127.8L681.2 126.7L678.3 125.3L676.4 124.0L673.3 122.1L671.9 119.2L671.0 118.7L668.0 118.8L666.9 118.3L666.6 116.0L662.9 114.6L660.5 116.2L658.1 117.1L658.6 118.5L655.5 118.6Z M891.7 240.6L891.7 249.6L891.8 258.7L889.3 256.4L886.5 255.8L885.8 256.6L882.3 256.7L883.4 254.4L885.2 253.7L884.5 250.6L883.1 248.3L877.7 246.0L875.5 245.7L871.3 243.2L870.5 244.5L869.4 244.8L868.8 243.7L868.8 242.5L866.6 241.2L869.6 240.2L871.6 240.2L871.4 239.5L867.3 239.5L866.2 237.8L863.7 237.3L862.6 235.9L866.3 235.3L867.7 234.4L872.2 235.5L872.6 236.5L873.4 241.0L876.3 242.7L878.6 239.7L881.8 238.1L884.2 238.1L886.6 239.0L888.7 240.0L891.7 240.6Z M847.1 258.0L847.4 258.6L847.5 259.4L845.7 261.5L843.3 262.1L842.9 261.8L843.2 260.8L844.4 259.1L847.1 258.0Z M872.8 252.5L872.5 250.4L873.0 249.4L873.6 248.5L874.2 249.3L874.2 250.6L872.8 252.5Z M827.5 221.8L825.9 224.3L827.9 227.0L827.4 228.3L830.5 230.8L827.3 231.2L826.3 233.0L826.4 235.6L823.8 237.5L823.7 240.2L822.6 244.5L822.2 243.5L819.1 244.7L818.0 243.0L816.0 242.9L814.6 242.0L811.3 243.0L810.3 241.7L808.5 241.8L806.2 241.5L805.8 237.8L804.4 237.0L803.0 234.6L802.6 232.2L803.0 229.6L804.6 227.8L805.1 229.6L807.0 231.2L808.8 230.6L810.5 230.8L812.2 229.4L813.5 229.2L816.1 230.0L818.4 229.4L819.8 225.5L820.9 224.5L821.8 221.4L825.0 221.4L827.5 221.8Z M859.4 241.1L862.4 241.9L863.4 244.1L861.1 242.9L858.8 242.7L857.2 242.9L855.3 242.8L855.9 241.2L859.4 241.1Z M852.4 243.9L850.5 243.4L850.0 242.2L852.8 242.0L853.5 242.9L852.4 243.9Z M855.4 227.3L855.6 228.8L857.2 229.1L857.5 230.2L857.3 232.6L855.9 232.3L855.5 234.0L856.6 235.5L855.8 235.8L854.7 234.1L853.9 230.5L854.4 228.3L855.4 227.3Z M841.5 230.9L844.7 230.8L847.4 228.8L847.9 229.4L845.7 232.1L843.6 232.7L840.9 232.1L836.3 232.3L833.8 232.7L833.4 234.8L835.9 237.2L837.4 236.0L842.6 235.0L842.4 236.3L841.2 235.9L840.0 237.5L837.5 238.6L840.2 242.2L839.6 243.1L842.1 246.3L842.1 248.2L840.6 249.0L839.5 248.0L840.9 245.7L838.2 246.8L837.5 246.0L837.8 245.0L835.8 243.3L836.0 240.6L834.2 241.5L834.4 244.7L834.5 248.7L832.8 249.1L831.6 248.3L832.4 245.7L831.9 243.0L830.8 243.0L829.9 241.1L831.1 239.3L831.5 237.1L832.8 232.9L833.4 231.8L835.8 229.7L838.0 230.5L841.5 230.9Z M834.2 261.8L830.5 259.9L833.1 259.3L834.5 260.2L835.5 261.0L835.3 261.8L834.2 261.8Z M837.1 257.0L838.9 256.8L841.4 255.8L841.0 257.4L836.8 258.1L833.1 257.8L833.1 256.8L835.3 256.2L837.1 257.0Z M828.5 256.6L830.2 256.3L830.9 257.5L827.7 258.1L825.8 258.4L824.3 258.4L825.2 256.8L826.8 256.8L827.5 255.8L828.5 256.6Z M801.4 251.2L801.7 252.2L807.1 252.4L807.7 251.3L812.8 252.6L813.8 254.4L818.0 254.9L821.4 256.6L818.2 257.6L815.2 256.5L812.7 256.6L809.8 256.4L807.2 255.9L804.0 254.8L801.9 254.6L800.8 254.9L795.7 253.8L795.2 252.6L792.7 252.4L794.6 249.7L798.0 249.9L800.2 251.0L801.4 251.2Z M789.9 236.3L790.4 238.3L791.4 239.8L793.4 240.1L794.7 241.8L794.0 245.3L793.9 249.6L790.9 249.6L788.5 247.3L785.0 245.1L783.8 243.4L781.7 241.1L780.3 239.0L778.2 235.1L775.7 232.8L774.9 230.4L773.9 228.3L771.4 226.5L769.9 224.1L767.8 222.6L764.9 219.5L764.7 218.1L766.5 218.2L770.8 218.8L773.2 221.5L775.4 223.4L776.9 224.5L779.6 227.5L782.4 227.5L784.7 229.4L786.3 231.8L788.4 233.0L787.3 235.3L788.9 236.3L789.9 236.3Z M847.1 258.0L847.5 257.4L849.9 256.8L851.8 256.7L852.7 256.3L853.7 256.7L852.7 257.4L849.8 258.6L847.5 259.4L847.4 258.6L847.1 258.0Z M599.2 142.5L598.7 143.4L597.7 143.0L597.2 144.8L597.8 145.1L597.1 145.5L597.0 146.2L598.3 145.9L598.4 146.9L597.0 151.4L596.7 150.7L595.2 146.6L595.2 146.6L595.2 146.6L596.0 145.7L595.8 145.5L596.5 144.2L597.1 142.1L597.5 141.4L597.6 141.4L598.5 141.4L598.8 140.9L599.5 140.9L599.5 142.0L599.2 142.5L599.2 142.5Z M599.5 140.9L598.8 140.9L598.5 141.4L597.6 141.4L598.6 139.2L599.9 137.2L600.0 137.1L601.2 137.2L601.7 138.3L600.2 139.4L599.5 140.9Z M598.3 145.9L597.0 146.2L597.1 145.5L597.8 145.1L597.2 144.8L597.7 143.0L598.7 143.4L598.7 145.0L598.3 145.9Z M598.7 143.4L599.2 142.5L602.3 143.6L607.8 140.6L608.9 144.0L608.3 144.4L602.8 145.8L605.6 148.6L604.6 149.1L604.2 150.0L602.1 150.4L601.4 151.4L600.2 152.2L597.1 151.8L597.0 151.4L598.4 146.9L598.3 145.9L598.7 145.0L598.7 143.4Z M643.3 166.0L643.8 165.8L643.9 166.6L646.0 166.2L648.3 166.2L650.0 166.3L651.9 164.5L654.0 162.7L655.8 161.0L656.3 161.9L656.7 164.1L655.2 164.1L655.0 165.9L655.5 166.3L654.2 166.9L654.2 168.0L653.4 169.1L653.4 170.3L652.8 170.8L644.4 169.4L643.4 166.6L643.3 166.0Z M641.1 164.6L641.0 162.5L641.7 161.1L642.5 160.8L643.3 161.7L643.4 163.3L642.7 164.9L642.0 165.1L641.1 164.6Z M633.3 150.1L633.8 151.3L633.6 151.9L634.5 154.0L632.5 154.1L631.8 152.8L629.4 152.5L631.4 149.8L633.3 150.1Z M608.9 144.0L607.8 140.6L613.9 137.7L615.0 134.4L614.7 132.3L616.2 131.7L617.6 129.9L618.8 129.5L622.1 129.8L623.0 130.6L624.4 130.1L626.2 133.4L628.0 134.2L628.2 135.9L626.8 136.8L626.2 139.0L628.1 141.6L631.5 143.1L632.9 145.3L632.5 147.3L633.3 147.3L633.4 148.7L634.9 150.2L633.3 150.1L631.4 149.8L629.4 152.5L624.2 152.3L616.4 146.7L612.2 144.8L608.9 144.0Z M653.4 170.3L653.4 169.1L654.2 168.0L654.2 166.9L655.5 166.3L655.0 165.9L655.2 164.1L656.7 164.1L657.9 166.0L659.5 167.0L661.5 167.4L663.1 167.9L664.4 169.5L665.1 170.4L666.1 170.7L666.1 171.4L665.1 173.0L664.7 173.8L663.5 174.7L662.5 176.6L661.2 176.4L660.6 177.1L660.2 178.5L660.5 180.4L660.3 180.7L659.0 180.7L657.2 181.7L657.0 183.1L656.3 183.7L654.6 183.7L653.5 184.4L653.5 185.5L652.2 186.2L650.7 186.0L648.8 186.9L647.5 187.1L646.6 185.1L644.4 180.6L652.8 177.8L654.6 172.2L653.4 170.3Z M656.3 161.9L655.8 161.0L656.6 160.0L656.9 160.3L656.6 161.4L656.3 161.9Z M785.0 199.5L784.3 196.1L786.1 193.8L789.7 193.3L792.3 193.7L794.6 194.8L795.8 192.9L798.3 193.9L798.9 195.7L798.6 199.1L793.9 201.2L795.1 202.9L792.2 203.1L789.8 204.2L787.5 203.8L786.4 202.4L785.0 199.5Z M792.3 193.7L789.7 193.3L786.1 193.8L784.3 196.1L785.0 199.5L782.5 198.2L780.1 198.3L780.5 196.1L778.0 196.1L777.8 199.1L776.3 203.2L775.4 205.7L775.6 207.7L777.4 207.8L778.6 210.3L779.1 212.7L780.6 214.3L782.3 214.6L783.7 216.1L782.8 217.2L781.0 217.5L780.8 216.1L778.5 214.9L778.0 215.4L776.9 214.3L776.4 212.9L775.0 211.4L773.6 210.0L773.2 211.7L772.6 210.1L772.9 208.4L773.8 205.7L775.1 202.9L776.6 200.3L775.5 197.8L775.6 196.5L775.3 194.9L773.4 192.7L772.8 191.3L773.7 190.8L774.7 188.4L773.6 186.6L771.8 184.5L770.5 182.1L771.7 181.6L772.9 178.6L774.9 178.5L776.5 177.3L778.1 176.6L779.3 177.5L779.5 179.1L781.3 179.3L780.7 182.2L780.7 184.7L783.6 183.0L784.5 183.5L786.1 183.4L786.7 182.5L788.8 182.7L790.9 184.9L791.1 187.7L793.3 190.1L793.2 192.4L792.3 193.7Z M798.3 193.9L795.8 192.9L794.6 194.8L792.3 193.7L793.2 192.4L793.3 190.1L791.1 187.7L790.9 184.9L788.8 182.7L786.7 182.5L786.1 183.4L784.5 183.5L783.6 183.0L780.7 184.7L780.7 182.2L781.3 179.3L779.5 179.1L779.3 177.5L778.1 176.6L778.7 175.6L781.1 173.8L781.3 174.4L782.8 174.5L782.4 171.3L783.8 170.9L785.4 173.1L786.7 175.6L790.1 175.7L791.2 178.1L789.4 178.8L788.6 179.8L791.9 181.5L794.2 184.8L796.0 187.2L798.1 189.1L798.8 191.1L798.3 193.9Z M778.1 176.6L776.5 177.3L774.9 178.5L772.9 178.6L771.7 181.6L770.5 182.1L771.8 184.5L773.6 186.6L774.7 188.4L773.7 190.8L772.8 191.3L773.4 192.7L775.3 194.9L775.6 196.5L775.5 197.8L776.6 200.3L775.1 202.9L773.8 205.7L773.5 203.7L774.3 201.6L773.4 199.9L773.6 196.9L772.5 195.4L771.6 192.1L771.1 188.6L769.9 186.3L768.1 187.7L764.9 189.7L763.4 189.4L761.6 188.8L762.6 185.3L762.0 182.7L759.8 179.5L760.2 178.5L758.6 178.2L756.6 175.9L756.4 173.7L757.4 174.1L757.4 172.1L758.8 171.4L758.5 170.3L759.1 169.3L759.2 166.4L761.4 167.1L762.6 164.8L762.8 163.4L764.3 161.1L764.2 159.5L767.8 157.6L769.8 158.1L769.6 156.4L770.6 155.9L770.4 154.8L772.0 154.6L772.9 156.3L774.1 156.9L774.2 159.0L774.1 161.3L771.5 163.7L771.1 167.0L774.1 166.5L774.7 169.0L776.5 169.6L775.7 171.9L777.7 172.9L778.9 173.4L781.0 172.6L781.1 173.8L778.7 175.6L778.1 176.6Z M789.8 204.2L792.2 203.1L795.1 202.9L793.9 201.2L798.6 199.1L798.9 195.7L798.3 193.9L798.8 191.1L798.1 189.1L796.0 187.2L794.2 184.8L791.9 181.5L788.6 179.8L789.4 178.8L791.2 178.1L790.1 175.7L786.7 175.6L785.4 173.1L783.8 170.9L785.3 170.3L787.5 170.3L790.2 169.9L792.6 168.5L793.9 169.5L796.5 170.0L796.0 171.6L797.3 172.7L800.1 173.5L796.4 175.8L794.1 178.5L793.5 180.4L795.6 183.3L798.2 187.0L800.7 188.7L802.4 190.9L803.7 196.0L803.3 200.9L801.0 202.8L797.8 204.5L795.6 206.9L792.1 209.4L791.1 207.7L791.9 205.8L789.8 204.2Z M862.9 115.6L862.9 115.6L863.3 116.1L862.2 115.9L861.0 116.8L860.2 117.8L860.3 119.8L858.9 120.4L858.4 120.9L857.3 121.7L855.5 122.2L854.3 122.9L854.2 124.1L853.8 124.4L855.0 124.9L856.5 126.1L856.1 126.7L854.9 126.9L853.0 127.1L851.9 128.3L850.7 128.2L850.5 128.5L849.1 127.9L848.8 128.5L848.0 128.7L847.9 128.2L847.2 127.9L846.4 127.5L847.2 126.3L847.8 125.9L847.6 125.4L848.3 123.9L848.1 123.5L846.5 123.2L845.2 122.4L847.4 120.6L850.5 119.1L852.4 117.2L853.7 118.0L856.1 118.1L855.7 116.7L860.0 115.5L861.1 113.9L862.9 115.6Z M850.5 128.5L850.7 128.2L851.9 128.3L853.0 127.1L854.9 126.9L856.1 126.7L856.5 126.1L858.9 129.4L859.6 131.2L859.6 134.4L858.6 135.9L856.1 136.4L853.9 137.6L851.3 137.8L851.0 136.3L851.6 134.2L850.3 131.3L852.4 130.9L850.5 128.5Z M743.8 96.4L746.7 95.9L752.0 93.5L756.2 92.2L758.6 93.1L761.5 93.1L763.4 94.4L766.2 94.5L770.2 95.2L772.9 93.3L771.7 91.6L774.6 88.8L777.7 89.9L780.2 90.2L783.5 90.9L784.0 93.0L788.0 94.2L790.6 93.7L794.1 93.3L796.9 93.7L799.6 95.0L801.3 96.4L803.9 96.4L807.4 96.9L809.9 96.2L813.6 95.7L817.7 93.8L819.3 94.1L820.8 95.0L824.1 94.8L822.8 96.8L820.8 99.6L821.5 100.8L823.1 100.4L825.8 100.8L828.0 99.8L830.2 100.7L832.7 102.6L832.4 103.6L830.2 103.3L826.2 103.7L824.2 104.5L822.2 106.3L817.9 107.4L815.2 108.9L812.3 108.3L810.8 108.0L809.3 109.8L810.2 110.9L810.6 111.8L808.7 112.8L806.7 114.2L803.5 115.2L799.3 115.3L794.8 116.3L791.6 117.8L790.3 116.9L787.0 116.9L782.9 115.2L780.1 114.8L776.4 115.2L770.7 114.6L767.6 114.7L766.0 113.0L764.7 110.4L763.0 110.1L759.7 108.4L755.9 108.0L752.6 107.5L751.6 106.3L752.7 103.1L750.8 100.9L746.8 99.8L744.5 98.3L743.8 96.4Z M770.4 154.8L769.6 156.4L767.8 157.6L764.3 161.1L762.6 164.8L759.2 166.4L758.5 170.3L757.4 172.1L755.2 167.7L753.2 168.0L755.3 166.3L755.0 163.5L749.8 163.1L748.2 161.1L745.0 161.8L745.3 164.3L746.4 166.0L746.9 169.8L746.9 173.1L741.6 173.6L740.3 177.4L733.2 182.5L728.3 186.1L726.9 188.0L723.1 189.2L722.9 194.9L721.8 199.8L720.4 204.7L720.0 207.7L716.5 210.4L712.8 208.6L710.4 201.9L708.0 197.9L706.8 192.7L703.1 183.5L702.3 176.6L697.7 175.7L692.1 172.0L692.6 169.9L691.2 165.7L696.8 163.3L694.9 159.7L696.2 155.6L702.3 152.9L706.7 147.3L709.1 143.7L705.8 140.4L706.2 136.8L713.5 137.1L719.2 138.0L720.0 141.7L717.9 142.7L721.4 147.5L723.5 150.8L725.2 154.4L731.4 157.3L736.8 159.1L742.3 160.0L744.9 158.9L744.8 155.9L746.7 157.5L749.3 159.1L753.4 158.9L755.8 157.1L757.0 155.8L762.7 152.0L767.0 151.5L767.4 154.4Z M757.4 172.1L757.4 174.1L756.4 173.7L756.6 175.9L755.8 174.5L755.6 173.1L755.1 171.7L753.9 170.1L751.4 170.0L751.6 171.1L750.8 172.7L749.6 172.1L749.2 172.6L748.4 172.3L747.3 172.1L746.9 169.8L745.9 167.7L746.4 166.0L744.7 165.3L745.3 164.3L747.0 163.2L745.0 161.8L746.0 159.9L748.2 161.1L749.5 161.2L749.8 163.1L752.4 163.5L755.0 163.5L756.6 164.0L755.3 166.3L754.1 166.5L753.2 168.0L754.7 169.5L755.2 167.7L756.0 167.7L757.4 172.1Z M754.7 156.2L755.8 157.1L755.6 158.8L753.4 158.9L751.0 158.7L749.3 159.1L746.8 158.1L746.7 157.5L748.5 155.4L750.0 154.7L752.0 155.4L753.5 155.4L754.7 156.2Z M744.8 155.9L744.6 157.1L744.9 158.9L744.6 160.0L742.3 160.0L739.0 159.4L736.8 159.1L735.2 157.7L731.4 157.3L727.8 155.8L725.2 154.4L722.5 153.3L723.5 150.8L725.3 149.5L726.5 148.8L728.7 149.7L731.5 151.5L733.1 151.9L734.0 153.2L736.1 153.8L738.4 155.0L741.5 155.6L744.8 155.9Z M716.2 134.7L713.5 137.1L710.4 137.5L706.2 136.8L704.9 138.0L705.8 140.4L706.8 142.3L709.1 143.7L706.7 145.3L706.7 147.3L704.0 150.1L702.3 152.9L699.4 155.8L696.2 155.6L693.1 158.5L694.9 159.7L695.2 161.9L696.8 163.3L697.3 165.7L691.2 165.7L689.4 167.5L687.3 166.8L686.5 164.8L684.4 162.7L679.3 163.2L674.7 163.3L670.8 163.7L671.9 160.4L675.9 159.0L675.6 157.7L674.3 157.3L674.2 154.8L671.6 153.6L670.5 151.9L669.1 150.5L673.7 151.9L676.5 151.5L678.2 151.8L678.8 151.2L680.7 151.5L684.3 150.3L684.4 147.9L685.9 146.4L688.0 146.4L688.3 145.6L690.4 145.2L691.5 145.5L692.5 144.7L692.4 143.1L693.6 141.4L695.3 140.7L694.3 138.8L696.9 138.9L697.7 137.9L697.5 136.9L698.9 135.7L698.6 134.3L698.0 133.1L699.6 131.9L702.6 131.3L705.7 131.0L707.2 130.5L708.8 130.2L710.8 131.5L711.6 133.6L716.2 134.7Z M684.8 129.5L686.3 129.6L688.4 130.2L689.3 130.5L691.3 129.6L692.2 130.1L693.1 128.9L694.8 128.9L695.2 128.5L695.5 127.4L696.7 126.4L698.2 127.1L697.9 127.9L698.7 128.0L698.5 130.4L699.6 131.3L700.5 130.7L701.8 130.4L703.5 129.2L705.4 129.4L708.3 129.4L708.8 130.2L707.2 130.5L705.7 131.0L702.6 131.3L699.6 131.9L698.0 133.1L698.6 134.3L698.9 135.7L697.5 136.9L697.7 137.9L696.9 138.9L694.3 138.8L695.3 140.7L693.6 141.4L692.4 143.1L692.5 144.7L691.5 145.5L690.4 145.2L688.3 145.6L688.0 146.4L685.9 146.4L684.4 147.9L684.3 150.3L680.7 151.5L678.8 151.2L678.2 151.8L676.5 151.5L673.7 151.9L669.1 150.5L671.6 148.0L671.4 146.2L669.3 145.7L669.1 143.9L668.2 141.7L669.3 140.2L668.1 139.8L668.9 137.8L670.0 134.3L672.9 135.4L675.0 135.0L675.5 133.7L677.7 133.3L679.3 132.5L679.9 130.2L682.2 129.7L682.6 128.7L683.9 129.5L684.8 129.5Z M688.4 130.2L690.0 127.3L689.4 125.3L687.3 124.6L688.1 123.4L690.4 123.5L691.7 122.0L692.6 120.2L696.3 119.6L695.7 120.8L696.1 121.6L697.3 121.5L696.2 122.4L693.2 121.9L693.0 123.5L696.0 123.3L699.4 124.2L704.7 123.8L705.4 126.4L706.3 126.1L708.0 126.7L707.9 127.8L708.3 129.4L705.4 129.4L703.5 129.2L701.8 130.4L700.5 130.7L699.6 131.3L698.5 130.4L698.7 128.0L697.9 127.9L698.2 127.1L696.7 126.4L695.5 127.4L695.2 128.5L694.8 128.9L693.1 128.9L692.2 130.1L691.3 129.6L689.3 130.5L688.4 130.2Z M697.1 115.9L697.7 114.7L699.6 114.3L704.1 115.3L704.6 113.6L706.1 113.1L710.1 114.2L711.1 113.9L715.7 114.0L719.8 114.3L721.2 115.3L722.9 115.7L722.6 116.3L718.2 117.8L717.2 118.9L713.6 119.3L712.6 121.0L709.6 120.7L707.7 121.2L705.1 122.5L705.4 123.2L704.7 123.8L699.4 124.2L696.0 123.3L693.0 123.5L693.2 121.9L696.2 122.4L697.3 121.5L699.4 121.8L702.9 119.8L699.6 118.4L697.7 119.0L695.6 118.0L697.9 116.2L697.1 115.9Z M645.8 117.3L647.1 116.3L650.2 115.8L652.1 116.5L654.0 118.7L655.5 118.6L658.6 118.5L658.1 117.1L660.5 116.2L662.9 114.6L666.6 116.0L666.9 118.3L668.0 118.8L671.0 118.7L671.9 119.2L673.3 122.1L676.4 124.0L678.3 125.3L681.2 126.7L684.9 127.8L684.8 129.5L683.9 129.5L682.6 128.7L682.2 129.7L679.9 130.2L679.3 132.5L677.7 133.3L675.5 133.7L675.0 135.0L672.9 135.4L670.0 134.3L669.8 132.0L667.7 131.9L664.5 129.4L662.3 129.1L659.3 127.7L657.3 127.4L656.1 128.0L654.2 127.9L652.2 129.5L649.8 130.0L649.3 128.0L649.7 125.1L647.5 124.2L648.2 122.3L646.4 122.1L647.0 119.8L649.6 120.5L652.0 119.6L650.0 117.9L649.2 116.3L647.0 117.0L646.7 119.1L645.8 117.3Z M634.9 150.2L633.4 148.7L633.3 147.3L632.5 147.3L632.9 145.3L631.5 143.1L628.1 141.6L626.2 139.0L626.8 136.8L628.2 135.9L628.0 134.2L626.2 133.4L624.4 130.1L624.4 130.1L622.8 127.9L623.4 127.0L622.5 123.8L624.4 123.0L624.9 124.1L626.3 125.3L628.2 125.7L629.2 125.6L632.5 123.6L633.5 123.4L634.3 124.2L633.4 125.6L635.1 127.0L635.8 126.9L636.7 128.9L639.3 129.5L641.2 130.9L645.2 131.4L649.5 130.7L649.8 130.0L652.2 129.5L654.2 127.9L656.1 128.0L657.3 127.4L659.3 127.7L662.3 129.1L664.5 129.4L667.7 131.9L669.8 132.0L670.0 134.3L668.9 137.8L668.1 139.8L669.3 140.2L668.2 141.7L669.1 143.9L669.3 145.7L671.4 146.2L671.6 148.0L669.1 150.5L670.5 151.9L671.6 153.6L674.2 154.8L674.3 157.3L675.6 157.7L675.9 159.0L671.9 160.4L670.8 163.7L665.6 162.8L662.6 162.2L659.4 161.8L658.3 158.4L656.9 157.9L654.8 158.4L652.0 159.8L648.6 158.9L645.8 156.7L643.1 155.9L641.3 153.3L639.2 149.6L637.7 150.0L635.9 149.1L634.9 150.2Z M599.2 142.5L599.2 142.5L599.5 142.0L599.5 140.9L600.2 139.4L601.7 138.3L601.2 137.2L600.0 137.1L599.7 135.0L600.4 133.8L601.2 133.2L601.9 132.6L602.1 131.1L603.0 131.6L606.0 130.8L607.5 131.4L609.8 131.3L613.0 130.3L614.5 130.3L617.6 129.9L616.2 131.7L614.7 132.3L615.0 134.4L613.9 137.7L607.8 140.6L602.3 143.6L599.2 142.5Z M629.2 125.6L628.2 125.7L627.0 124.1L627.1 123.7L625.8 123.7L625.0 122.9L624.4 123.0L623.3 122.2L621.3 121.5L621.5 120.2L621.1 119.2L624.9 118.8L625.5 119.5L626.6 120.0L626.0 120.7L627.5 121.6L626.7 122.5L627.9 123.3L629.1 123.7L629.2 125.6Z M624.4 130.1L623.0 130.6L622.1 129.8L618.8 129.5L617.6 129.9L614.5 130.3L613.0 130.3L609.8 131.3L607.5 131.4L606.0 130.8L603.0 131.6L602.1 131.1L601.9 132.6L601.2 133.2L600.4 133.8L599.4 132.6L600.4 131.5L598.8 131.8L596.4 131.1L594.5 132.7L590.3 133.0L588.1 131.5L585.1 131.5L584.4 132.6L582.5 132.9L579.8 131.5L576.8 131.5L575.1 128.7L573.1 127.2L574.5 125.0L572.7 123.7L575.8 121.1L580.1 120.9L581.2 118.8L586.5 119.2L589.9 117.4L593.1 116.6L597.7 116.6L602.5 118.5L606.5 119.6L609.8 119.2L612.1 119.4L615.4 118.0L618.4 117.8L621.1 119.2L621.5 120.2L621.3 121.5L623.3 122.2L624.4 123.0L622.5 123.8L623.4 127.0L622.8 127.9L624.4 130.1L624.4 130.1Z M572.5 117.1L575.4 116.3L577.8 116.6L578.1 117.7L580.5 118.6L580.0 119.3L576.7 119.4L575.5 120.3L573.2 121.8L572.3 120.5L572.4 119.9L573.0 119.6L573.9 117.9L572.5 117.1Z M727.2 212.4L726.8 215.3L725.6 216.1L723.2 216.8L721.9 214.5L721.4 210.6L722.6 206.0L724.6 207.6L725.8 209.5L727.2 212.4Z M804.1 182.8L801.8 181.9L801.7 179.5L803.1 178.3L806.1 177.5L807.7 177.6L808.4 178.6L807.1 179.8L806.5 181.4L804.1 182.8Z M722.9 115.7L724.6 113.4L727.6 107.5L731.1 101.9L738.1 101.5L740.6 98.5L743.8 96.4L746.8 99.8L752.7 103.1L752.6 107.5L759.7 108.4L764.7 110.4L767.6 114.7L776.4 115.2L782.9 115.2L790.3 116.9L794.8 116.3L803.5 115.2L808.7 112.8L810.2 110.9L810.8 108.0L815.2 108.9L822.2 106.3L826.2 103.7L832.4 103.6L830.2 100.7L825.8 100.8L821.5 100.8L822.8 96.8L827.4 95.8L831.3 92.8L835.4 89.0L833.8 86.8L839.6 84.9L847.4 85.7L851.6 89.5L853.6 92.4L859.4 96.0L863.9 100.6L870.5 99.5L873.6 101.2L871.6 105.2L866.3 107.4L864.7 110.8L862.9 114.2L861.1 113.9L855.7 116.7L853.7 118.0L850.5 119.1L845.2 122.4L839.3 124.5L837.7 124.0L839.4 121.0L835.5 120.6L830.6 124.3L826.5 125.7L830.2 128.1L832.5 130.1L838.1 129.2L840.3 130.7L835.1 133.0L831.0 136.4L835.1 140.6L838.6 145.3L836.8 148.1L839.1 150.5L838.0 154.9L834.4 158.2L829.6 165.1L821.9 170.0L817.1 171.6L814.6 172.1L807.7 173.9L805.2 177.0L805.2 173.9L800.1 173.5L796.0 171.6L793.9 169.5L790.2 169.9L785.3 170.3L782.4 171.3L781.3 174.4L781.0 172.6L777.7 172.9L776.5 169.6L774.1 166.5L771.5 163.7L774.2 159.0L772.9 156.3L770.4 154.8L768.3 153.2L765.0 152.7L759.5 153.8L754.7 156.2L752.0 155.4L748.5 155.4L746.5 155.3L741.5 155.6L736.1 153.8L733.1 151.9L728.7 149.7L725.3 149.5L718.7 145.8L719.9 143.1L718.9 140.3L716.2 134.7L710.8 131.5L708.3 129.4L708.0 126.7L705.4 126.4L705.4 123.2L707.7 121.2L712.6 121.0L717.2 118.9L722.6 116.3Z M838.3 165.6L836.6 170.0L835.4 172.3L833.9 170.0L833.6 167.9L835.3 165.2L837.5 163.1L838.8 163.9L838.3 165.6Z M628.9 117.1L629.7 117.1L631.6 118.8L632.8 119.0L633.3 118.3L635.0 117.2L636.4 118.7L637.8 120.6L639.1 120.8L640.0 121.5L637.7 121.7L637.2 123.9L636.7 124.9L635.7 125.5L635.8 126.9L635.1 127.0L633.4 125.6L634.3 124.2L633.5 123.4L632.5 123.6L629.2 125.6L629.1 123.7L627.9 123.3L626.7 122.5L627.5 121.6L626.0 120.7L626.6 120.0L625.5 119.5L624.9 118.8L625.6 118.3L627.7 119.1L629.2 119.3L629.5 118.9L628.2 117.4L628.9 117.1Z M628.2 125.7L626.3 125.3L624.9 124.1L624.4 123.0L625.0 122.9L625.8 123.7L627.1 123.7L627.0 124.1L628.2 125.7Z M611.0 112.7L611.3 112.4L613.7 112.8L617.8 113.3L621.5 114.6L622.0 115.1L623.7 114.7L626.3 115.3L627.2 116.4L628.9 117.1L628.2 117.4L629.5 118.9L629.2 119.3L627.7 119.1L625.6 118.3L624.9 118.8L621.1 119.2L618.4 117.8L615.4 118.0L615.8 116.8L615.1 114.9L613.5 113.9L612.0 113.5L611.0 112.7Z M835.6 198.0L834.2 195.9L836.6 196.0L837.6 197.0L836.8 199.4L835.6 198.0Z M840.5 205.6L841.2 204.8L841.5 203.1L843.1 202.9L842.6 204.8L844.7 202.1L844.4 204.8L843.4 205.7L842.5 207.4L841.7 208.3L839.9 206.4L840.5 205.6Z M851.0 210.0L851.3 211.8L851.5 213.4L850.5 215.9L849.5 213.1L848.2 214.5L849.1 216.5L848.3 217.8L845.1 216.2L844.3 214.2L845.1 212.9L843.4 211.6L842.5 212.7L841.2 212.6L839.1 214.2L838.7 213.4L839.8 211.0L841.5 210.2L843.0 209.2L844.0 210.4L846.1 209.7L846.6 208.4L848.5 208.4L848.4 206.2L850.6 207.5L850.9 208.9L851.0 210.0Z M829.2 207.5L825.5 210.1L826.8 208.1L828.9 206.4L830.5 204.5L832.0 201.8L832.5 204.0L830.6 205.5L829.2 207.5Z M839.8 182.7L839.4 183.9L840.3 185.9L839.6 188.2L838.0 189.1L837.5 191.3L838.1 193.5L839.6 193.8L840.8 193.5L844.3 195.0L844.0 196.6L844.9 197.2L844.7 198.5L842.5 197.1L841.5 195.7L840.8 196.7L839.0 195.0L836.5 195.5L835.1 194.8L835.2 193.7L836.1 193.0L835.3 192.3L834.9 193.3L833.5 191.7L833.1 190.5L833.0 187.9L834.1 188.8L834.4 184.4L835.3 181.9L837.0 181.9L838.7 182.7L839.6 182.0L839.8 182.7Z M839.0 201.6L838.6 200.3L840.2 201.2L842.0 201.2L841.9 202.3L840.7 203.5L838.9 204.3L838.8 203.0L839.0 201.6Z M848.6 199.5L849.4 202.6L847.3 201.9L847.3 202.8L848.0 204.6L846.7 205.2L846.6 203.2L845.7 203.1L845.3 201.4L846.9 201.6L846.9 200.6L845.2 198.5L847.9 198.5L848.6 199.5Z M778.0 215.4L778.5 214.9L780.8 216.1L781.0 217.5L782.8 217.2L783.7 216.1L784.4 216.3L786.0 218.0L787.2 219.8L787.3 221.7L787.0 223.0L787.3 223.9L787.5 225.6L788.5 226.3L789.6 228.8L789.5 229.7L787.6 229.9L784.9 227.9L781.6 225.7L781.3 224.2L779.7 222.4L779.3 220.1L778.3 218.6L778.6 216.6L778.0 215.4Z M827.5 221.8L825.0 221.4L821.8 221.4L820.9 224.5L819.8 225.5L818.4 229.4L816.1 230.0L813.5 229.2L812.2 229.4L810.5 230.8L808.8 230.6L807.0 231.2L805.1 229.6L804.6 227.8L806.7 228.7L808.8 228.2L809.4 225.8L810.5 225.3L813.9 224.7L815.9 222.5L817.2 220.8L818.5 222.2L819.1 221.3L820.4 221.3L820.6 219.6L820.7 218.2L822.8 216.3L824.2 214.1L825.4 214.1L826.8 215.5L826.9 216.7L828.7 217.5L831.1 218.3L830.9 219.4L829.0 219.5L829.5 220.9L827.5 221.8Z M820.7 218.2L820.6 219.6L820.4 221.3L819.1 221.3L818.5 222.2L817.2 220.8L818.3 219.7L820.7 218.2Z M894.1 124.5L891.6 127.3L891.6 130.2L890.6 132.4L891.0 133.8L889.6 135.7L886.0 137.0L881.2 137.2L877.2 140.4L875.3 139.3L875.2 137.2L870.4 137.8L867.1 139.2L863.9 139.2L866.7 141.3L864.8 146.0L863.0 147.1L861.7 146.1L862.4 143.6L860.6 142.7L859.5 140.8L862.1 140.0L863.6 138.2L866.3 136.8L868.4 134.9L873.9 134.1L876.9 134.6L879.8 129.7L881.6 131.0L885.7 128.3L887.3 127.2L889.0 123.8L888.6 120.7L889.7 118.9L892.7 118.4L894.2 122.2L894.1 124.5Z M901.7 111.2L903.7 110.0L904.3 113.2L900.2 113.9L897.7 116.7L893.4 114.8L891.9 117.8L888.8 117.9L888.4 115.1L889.8 113.0L892.7 112.8L893.5 109.0L894.4 106.8L897.6 109.7L899.8 110.6L901.7 111.2Z M867.7 140.4L869.2 138.7L870.8 139.0L872.0 137.9L874.0 138.5L874.4 139.4L872.8 141.1L871.6 140.2L870.2 140.9L869.5 142.5L867.7 141.7L867.7 140.4Z M644.4 180.6L646.6 185.1L647.5 187.1L645.5 187.8L645.0 189.1L644.9 190.0L642.1 191.2L637.7 192.5L635.2 194.4L634.0 194.6L633.2 194.4L631.5 195.6L629.8 196.1L627.4 196.3L626.7 196.4L626.1 197.1L625.4 197.4L625.0 198.1L623.6 198.0L622.7 198.4L620.8 198.2L620.1 196.6L620.1 195.1L619.7 194.3L619.1 192.2L618.3 191.1L618.9 190.9L618.6 189.7L619.0 189.1L618.8 187.9L620.1 187.0L619.8 185.9L620.5 184.5L621.6 185.2L622.4 185.0L625.6 184.9L626.1 185.2L628.8 185.5L629.9 185.3L630.6 186.3L631.9 185.8L633.8 182.9L636.4 181.6L644.4 180.6Z M597.1 151.8L600.2 152.2L601.4 151.4L602.1 150.4L604.2 150.0L604.6 149.1L605.6 148.6L602.8 145.8L608.3 144.4L608.9 144.0L612.2 144.8L616.4 146.7L624.2 152.3L629.4 152.5L631.8 152.8L632.5 154.1L634.5 154.0L635.6 156.4L636.9 157.1L637.4 158.0L639.3 159.2L639.5 160.3L639.2 161.3L639.6 162.2L640.4 163.0L640.7 163.9L641.1 164.6L642.0 165.1L642.7 164.9L643.3 166.0L643.4 166.6L644.4 169.4L652.8 170.8L653.4 170.3L654.6 172.2L652.8 177.8L644.4 180.6L636.4 181.6L633.8 182.9L631.9 185.8L630.6 186.3L629.9 185.3L628.8 185.5L626.1 185.2L625.6 184.9L622.4 185.0L621.6 185.2L620.5 184.5L619.8 185.9L620.1 187.0L618.8 187.9L618.5 186.7L617.6 185.9L617.4 184.8L616.0 183.8L614.5 181.5L613.7 179.2L611.8 177.3L610.6 176.8L608.7 174.2L608.4 172.3L608.5 170.6L606.9 167.5L605.6 166.4L604.1 165.9L603.2 164.3L603.4 163.7L602.6 162.2L601.8 161.6L600.7 159.5L599.0 157.3L597.6 155.4L596.2 155.4L596.6 153.9L596.8 152.9L597.1 151.8Z M590.9 135.7L591.1 135.7L591.5 135.0L593.5 135.1L596.0 134.2L594.2 135.4L594.4 135.9L594.1 135.9L593.5 136.1L593.1 136.0L593.0 136.1L592.9 135.8L592.7 135.7L592.2 135.6L591.4 135.9L590.9 135.7Z M590.9 135.7L591.4 135.9L592.2 135.6L592.7 135.7L592.9 135.8L593.0 136.1L593.1 136.0L593.5 136.1L594.1 135.9L594.4 135.9L594.5 136.2L591.6 137.3L590.3 136.9L589.6 135.8L590.9 135.7Z", "af": "M594.2 236.0L594.6 236.3L604.7 241.9L604.9 243.5L608.9 246.3L607.6 249.7L607.8 251.3L609.6 252.3L609.6 253.1L608.9 254.7L609.0 255.6L608.9 256.9L609.8 258.6L611.0 261.4L612.0 262.0L612.0 262.0L609.8 263.6L606.7 264.7L605.1 264.6L604.1 265.5L602.2 265.5L601.4 265.9L598.1 265.1L596.0 265.3L595.2 261.6L594.3 260.3L593.7 259.5L591.0 259.0L589.4 258.1L587.7 257.7L586.5 257.2L585.4 256.5L585.4 256.5L583.9 253.0L582.3 251.4L581.7 249.8L582.0 248.4L581.5 245.8L582.6 245.7L583.7 244.7L584.7 243.2L585.4 242.7L585.4 241.8L584.8 241.1L584.6 240.0L584.6 240.0L585.4 239.7L585.6 238.1L584.5 236.5L585.5 236.2L588.5 236.2L594.2 236.0Z M475.9 156.5L475.9 156.7L475.9 157.2L475.9 161.4L466.8 161.3L466.8 168.4L464.2 168.7L463.6 170.1L464.1 174.1L453.2 174.1L452.6 175.0L452.7 173.8L452.8 173.8L459.0 173.6L459.4 172.6L460.5 171.4L461.4 167.5L465.3 164.5L466.6 161.0L467.4 160.8L468.4 158.7L470.7 158.4L471.7 158.7L473.0 158.7L473.9 158.1L475.6 158.0L475.5 156.5L475.9 156.5Z M581.5 245.8L581.7 249.8L583.9 253.0L585.4 256.5L580.6 256.7L579.0 258.8L579.2 263.3L579.6 266.6L582.3 267.2L580.4 270.1L578.2 267.4L575.5 265.6L571.5 266.1L568.8 264.6L567.4 263.8L565.2 263.5L562.2 263.9L561.7 260.8L560.6 258.1L560.4 255.3L557.0 253.6L555.8 252.6L553.9 253.2L552.8 255.5L550.4 255.5L547.5 254.3L546.0 251.7L537.2 249.6L535.4 249.9L533.8 249.4L534.6 247.9L536.1 246.6L537.8 245.8L539.5 246.6L542.1 245.4L544.5 243.2L545.6 238.2L548.7 235.4L549.1 233.5L549.4 231.0L550.3 226.8L551.3 223.6L552.6 220.3L556.4 220.3L560.2 221.6L563.1 220.5L564.7 220.5L568.9 219.7L570.2 219.0L573.3 219.0L576.0 218.8L579.0 221.4L581.0 221.1L583.2 221.7L585.6 223.6L586.6 227.2L584.6 228.9L583.0 231.7L582.2 235.0L581.4 237.8L580.9 239.7L581.3 242.5Z M615.5 238.0L613.9 235.7L613.8 225.6L616.3 222.4L617.0 221.6L618.8 221.5L621.3 219.6L624.9 219.4L632.7 211.1L634.7 208.8L635.9 207.1L635.9 205.6L635.9 202.8L636.0 201.7L636.0 201.6L636.0 201.6L636.9 201.6L638.1 201.2L639.6 200.9L640.9 199.9L642.0 199.9L642.0 200.7L641.8 202.3L641.8 203.8L641.2 204.8L640.4 207.8L639.1 210.9L637.4 214.4L635.0 218.5L632.6 221.6L629.3 225.4L626.6 227.7L622.4 230.4L619.8 232.5L616.8 235.9L616.1 237.4L615.5 238.0Z M608.9 246.3L604.9 243.5L604.7 241.9L594.6 236.3L594.2 236.0L594.1 233.0L594.9 231.9L596.3 230.1L597.3 228.0L596.1 224.9L595.8 223.5L594.5 221.5L596.2 219.9L598.1 218.0L599.5 218.5L599.5 220.1L600.4 221.0L602.4 221.0L605.9 223.3L606.8 223.4L607.4 223.3L608.0 223.6L609.9 223.8L610.7 222.7L613.2 221.5L614.4 222.4L616.3 222.4L613.8 225.6L613.9 235.7L615.5 238.0L613.6 239.1L612.9 240.3L611.8 240.5L611.4 242.4L610.6 243.6L610.0 245.4L608.9 246.3Z M568.2 210.5L565.2 208.5L565.4 206.4L563.8 203.6L563.5 201.7L562.5 199.3L560.9 198.4L561.9 196.2L562.5 194.2L562.7 191.8L566.4 190.0L566.2 177.8L569.4 172.2L591.4 172.2L603.3 174.9L603.1 178.3L605.2 182.3L605.3 184.9L602.4 186.2L600.9 192.2L600.8 195.7L597.9 199.8L596.5 203.0L594.3 206.7L594.3 207.0L594.0 205.6L592.2 203.6L592.2 199.5L590.8 199.9L589.8 200.9L588.5 204.1L585.7 206.4L582.3 205.3L580.6 206.7L577.7 207.2L575.3 206.6L573.5 206.8L571.6 204.4L568.9 206.1L567.2 209.1L568.2 210.5Z M566.2 178.9L566.4 190.0L564.0 189.8L562.7 191.8L562.0 193.5L562.5 194.2L561.6 195.0L561.9 196.2L561.2 197.3L560.9 198.4L561.9 198.2L562.5 199.3L562.5 200.9L563.5 201.7L563.5 202.4L561.8 202.9L560.3 204.0L558.3 207.0L555.7 208.3L553.0 208.1L552.3 208.4L552.5 209.4L551.1 210.3L549.9 211.4L546.4 212.5L545.7 211.8L545.3 211.8L544.7 212.5L542.4 212.7L542.9 212.0L542.0 210.0L541.6 208.9L540.4 208.4L538.8 206.8L539.4 205.5L540.6 205.8L541.4 205.6L543.0 205.6L541.5 203.1L541.6 201.2L541.4 199.4L540.3 197.6L540.5 196.3L538.8 196.2L538.8 194.5L537.6 193.4L538.8 189.8L542.4 187.1L542.5 183.5L543.6 177.9L544.2 176.7L543.0 175.7L543.0 174.9L541.9 174.1L541.3 169.8L544.1 168.3L555.1 173.6L566.2 178.9Z M545.4 312.7L547.8 312.1L549.5 313.5L552.8 313.8L555.3 302.1L557.7 305.2L558.0 307.9L561.4 306.3L563.4 304.2L565.9 303.9L569.5 304.8L571.6 303.3L573.6 301.7L575.3 298.8L581.8 294.7L584.2 295.2L586.6 295.1L588.7 301.0L588.4 305.1L586.2 304.8L585.2 306.7L586.9 309.1L589.1 307.6L590.5 309.6L589.5 313.2L587.0 315.0L585.1 317.8L580.3 322.7L576.3 325.6L572.0 326.9L569.9 327.2L565.5 327.2L562.7 327.4L557.5 328.9L554.5 330.1L552.4 329.0L551.0 328.2L550.7 325.8L550.7 323.4L548.8 318.7L547.4 316.3Z M580.5 313.8L581.5 314.6L580.6 316.0L580.1 316.9L578.6 317.3L578.1 318.2L577.1 318.5L575.0 316.3L576.5 314.6L578.0 313.5L579.3 312.9L580.5 313.8Z M586.6 295.1L585.2 294.9L584.2 295.2L582.9 294.7L581.8 294.7L580.0 293.4L577.8 293.0L577.0 291.3L577.0 290.3L575.8 290.0L572.7 286.9L571.8 285.3L571.2 284.8L570.2 282.6L573.3 282.9L574.2 283.2L575.1 283.2L576.7 281.4L579.1 279.1L580.1 278.9L580.4 277.9L582.0 276.8L584.1 276.4L584.3 277.4L586.6 277.4L587.9 278.0L588.5 278.7L589.8 278.9L591.2 279.8L591.2 283.3L590.7 285.2L590.6 287.3L591.0 288.1L590.7 289.7L590.3 290.0L589.6 292.0L586.6 295.1Z M581.8 294.7L577.8 296.7L575.3 298.8L574.4 300.7L573.6 301.7L572.1 301.9L571.6 303.3L571.3 304.1L569.5 304.8L567.3 304.6L565.9 303.9L564.8 303.5L563.4 304.2L562.7 305.5L561.4 306.3L560.0 307.6L558.0 307.9L557.4 306.9L557.7 305.2L556.0 302.5L555.3 302.1L555.3 294.0L558.0 293.9L558.1 284.0L560.2 283.9L564.4 283.0L565.5 284.1L567.3 283.0L568.1 283.0L569.7 282.4L570.2 282.6L571.2 284.8L571.8 285.3L572.7 286.9L575.8 290.0L577.0 290.3L577.0 291.3L577.8 293.0L580.0 293.4L581.8 294.7Z M555.3 302.1L555.3 312.4L552.8 313.8L551.3 314.0L549.5 313.5L548.3 313.3L547.8 312.1L546.7 311.3L545.4 312.7L543.3 310.6L542.3 308.6L541.6 305.9L541.0 303.9L540.0 299.6L540.0 296.3L539.6 294.8L538.5 293.6L537.1 291.3L535.6 288.0L535.0 286.2L532.8 283.5L532.6 281.4L533.9 280.9L535.6 280.4L537.4 280.5L539.1 281.7L539.5 281.5L550.7 281.4L552.7 282.7L559.4 283.1L564.5 282.0L566.8 281.4L568.6 281.5L569.7 282.2L569.7 282.4L568.1 283.0L567.3 283.0L565.5 284.1L564.4 283.0L560.2 283.9L558.1 284.0L558.0 293.9L555.3 294.0L555.3 302.1Z M453.6 195.6L452.4 193.4L451.0 192.4L452.3 191.9L453.6 189.9L454.3 188.5L455.2 187.6L456.6 187.9L458.0 187.3L459.5 187.2L460.8 188.0L462.7 188.8L464.4 190.8L466.2 192.7L466.3 194.5L466.9 196.0L467.9 196.8L468.1 197.9L468.0 198.8L467.6 198.9L466.1 198.7L465.9 199.0L465.3 199.1L463.3 198.4L461.9 198.4L456.8 198.3L456.1 198.6L455.1 198.5L453.7 198.9L453.2 196.8L455.7 196.9L456.4 196.5L456.9 196.4L457.9 195.8L459.1 196.4L460.3 196.4L461.5 195.8L461.0 195.0L460.1 195.5L459.2 195.5L458.1 194.8L457.2 194.8L456.6 195.5L453.6 195.6Z M468.0 198.8L468.1 197.9L467.9 196.8L466.9 196.0L466.3 194.5L466.2 192.7L467.1 192.2L467.6 190.6L468.5 190.5L470.4 191.3L472.0 190.7L473.1 190.9L473.5 190.3L484.6 190.3L485.2 188.3L484.8 188.0L483.4 176.0L482.1 164.0L486.3 164.0L495.7 170.0L505.1 176.1L505.7 177.4L507.5 178.2L508.7 178.6L508.8 180.4L511.9 180.1L511.9 186.5L510.3 188.4L510.1 190.1L507.6 190.5L503.8 190.8L502.8 191.8L501.0 191.9L499.3 191.9L498.6 191.3L497.0 191.7L494.4 192.9L493.9 193.8L491.8 195.0L491.4 195.7L490.2 196.3L488.9 195.9L488.1 196.6L487.7 198.5L485.5 200.8L485.6 201.7L484.8 202.9L485.0 204.5L483.8 204.9L483.2 205.3L482.8 204.1L482.0 204.4L481.5 204.4L481.0 205.2L478.8 205.1L478.1 204.7L477.7 205.0L476.8 204.2L477.0 203.4L476.6 203.0L476.1 203.3L476.2 202.4L476.7 201.7L475.6 200.5L475.3 199.8L474.6 199.1L474.1 199.1L473.4 199.5L472.5 199.8L471.8 200.4L470.6 200.2L469.8 199.5L469.3 199.4L468.6 199.8L468.2 199.8L468.0 198.8Z M452.6 175.0L453.2 174.1L464.1 174.1L463.6 170.1L464.2 168.7L466.8 168.4L466.8 161.3L475.9 161.4L475.9 157.2L486.3 164.0L482.1 164.0L483.4 176.0L484.8 188.0L485.2 188.3L484.6 190.3L473.5 190.3L473.1 190.9L472.0 190.7L470.4 191.3L468.5 190.5L467.6 190.6L467.1 192.2L466.2 192.7L464.4 190.8L462.7 188.8L460.8 188.0L459.5 187.2L458.0 187.3L456.6 187.9L455.2 187.6L454.3 188.5L454.0 187.0L454.8 185.6L455.1 183.0L454.8 180.3L454.5 178.9L454.8 177.5L454.1 176.2L452.6 175.0Z M507.5 215.9L505.2 216.3L504.5 214.4L504.6 208.0L504.1 207.4L504.0 206.0L503.0 205.1L502.1 204.2L502.5 202.8L503.5 202.5L504.0 201.3L505.4 201.0L506.0 200.2L506.9 199.4L507.9 199.3L510.0 200.9L509.9 201.9L510.5 203.5L510.0 204.6L510.3 205.4L508.9 207.1L508.1 208.0L507.6 209.7L507.6 211.5L507.5 215.9Z M541.3 169.8L541.9 174.1L543.0 174.9L543.0 175.7L544.2 176.7L543.6 177.9L542.5 183.5L542.4 187.1L538.8 189.8L537.6 193.4L538.8 194.5L538.8 196.2L540.5 196.3L540.3 197.6L539.5 197.8L539.4 198.7L538.9 198.7L537.0 195.7L536.3 195.6L534.2 197.1L532.0 196.3L530.5 196.1L529.7 196.5L528.1 196.5L526.5 197.6L525.0 197.7L521.7 196.3L520.4 196.9L518.9 196.9L517.9 195.9L515.1 194.8L512.1 195.1L511.4 195.7L511.0 197.3L510.2 198.5L510.0 200.9L507.9 199.3L506.9 199.4L506.0 200.2L506.0 198.3L502.8 197.6L502.8 196.3L501.2 194.5L500.8 193.2L501.0 191.9L502.8 191.8L503.8 190.8L507.6 190.5L510.1 190.1L510.3 188.4L511.9 186.5L511.9 180.1L515.8 178.9L523.8 173.4L533.3 168.1L537.7 169.3L539.3 170.9L541.3 169.8Z M507.5 215.9L507.6 211.5L507.6 209.7L508.1 208.0L508.9 207.1L510.3 205.4L510.0 204.6L510.5 203.5L509.9 201.9L510.0 200.9L510.2 198.5L511.0 197.3L511.4 195.7L512.1 195.1L515.1 194.8L517.9 195.9L518.9 196.9L520.4 196.9L521.7 196.3L525.0 197.7L526.5 197.6L528.1 196.5L529.7 196.5L530.5 196.1L532.0 196.3L534.2 197.1L536.3 195.6L537.0 195.7L538.9 198.7L539.4 198.7L540.5 199.8L540.2 200.3L540.0 201.2L537.7 203.3L537.0 205.1L536.6 206.6L536.0 207.2L535.4 209.1L533.9 210.3L533.5 211.7L532.9 212.8L532.6 213.9L530.7 214.9L529.2 213.7L528.1 213.8L526.5 215.4L525.6 215.4L524.3 218.1L523.6 220.1L520.7 221.1L519.7 220.9L518.6 221.6L516.4 221.5L514.9 219.8L514.0 217.7L512.0 215.9L509.9 215.9L507.5 215.9Z M540.3 197.6L541.4 199.4L541.6 201.2L541.5 203.1L543.0 205.6L541.4 205.6L540.6 205.8L539.4 205.5L538.8 206.8L540.4 208.4L541.6 208.9L542.0 210.0L542.9 212.0L542.4 212.7L541.0 215.5L540.4 216.0L540.2 218.2L540.4 219.4L540.2 220.2L541.5 221.6L541.8 222.6L542.8 224.1L544.1 225.0L544.2 226.2L544.5 227.0L544.3 228.5L542.1 227.9L539.8 227.1L536.3 227.0L536.0 226.9L534.3 227.2L532.6 226.9L531.3 227.1L526.8 227.0L527.2 224.8L526.1 223.0L524.9 222.5L524.3 221.2L523.6 220.8L523.6 220.1L524.3 218.1L525.6 215.4L526.5 215.4L528.1 213.8L529.2 213.7L530.7 214.9L532.6 213.9L532.9 212.8L533.5 211.7L533.9 210.3L535.4 209.1L536.0 207.2L536.6 206.6L537.0 205.1L537.7 203.3L540.0 201.2L540.2 200.3L540.5 199.8L539.4 198.7L539.5 197.8L540.3 197.6Z M502.5 202.8L502.1 204.2L503.0 205.1L504.0 206.0L504.1 207.4L504.6 208.0L504.5 214.4L505.2 216.3L502.9 216.9L502.3 215.9L501.6 214.1L501.4 212.7L502.0 210.2L501.3 209.2L501.0 207.0L501.0 205.0L499.9 203.6L500.1 202.7L502.5 202.8Z M500.1 202.7L499.9 203.6L501.0 205.0L501.0 207.0L501.3 209.2L502.0 210.2L501.4 212.7L501.6 214.1L502.3 215.9L502.9 216.9L498.6 218.5L497.0 219.4L494.5 220.2L492.1 219.5L492.2 218.4L491.0 216.0L491.7 212.8L492.9 210.5L492.1 206.5L491.8 204.5L491.8 202.9L496.7 202.8L497.9 203.0L498.8 202.5L500.1 202.7Z M477.7 205.0L478.1 204.7L478.8 205.1L481.0 205.2L481.5 204.4L482.0 204.4L482.8 204.1L483.2 205.3L483.8 204.9L485.0 204.5L486.2 205.1L486.7 206.1L488.0 206.6L488.9 205.9L490.2 205.8L492.1 206.5L492.9 210.5L491.7 212.8L491.0 216.0L492.2 218.4L492.1 219.5L490.8 219.5L488.9 218.9L487.1 219.0L483.8 219.5L481.9 220.3L479.1 221.3L478.6 221.2L478.8 218.9L479.1 218.6L479.0 217.5L477.8 216.3L476.9 216.1L476.1 215.4L476.7 214.1L476.4 212.8L476.6 212.0L477.0 212.0L477.2 210.8L476.9 210.2L477.2 209.8L478.2 209.5L477.6 207.3L476.9 206.1L477.1 205.2L477.7 205.0Z M461.9 198.4L463.3 198.4L465.3 199.1L465.9 199.0L466.1 198.7L467.6 198.9L468.0 198.8L468.2 199.8L468.6 199.8L469.3 199.4L469.8 199.5L470.6 200.2L471.8 200.4L472.5 199.8L473.4 199.5L474.1 199.1L474.6 199.1L475.3 199.8L475.6 200.5L476.7 201.7L476.2 202.4L476.1 203.3L476.6 203.0L477.0 203.4L476.8 204.2L477.7 205.0L477.1 205.2L476.9 206.1L477.6 207.3L478.2 209.5L477.2 209.8L476.9 210.2L477.2 210.8L477.0 212.0L476.6 212.0L475.8 211.9L475.2 213.0L474.4 213.0L473.9 212.4L474.1 211.3L472.9 209.6L472.2 209.9L471.6 210.0L470.8 210.1L470.8 209.1L470.4 208.4L470.5 207.6L469.9 206.4L469.1 205.4L466.9 205.4L466.2 205.9L465.5 206.0L465.0 206.6L464.7 207.4L463.2 208.6L462.0 207.0L460.9 205.9L460.2 205.5L459.5 205.0L459.2 203.7L458.8 203.1L458.0 202.7L459.2 201.3L460.0 201.4L460.8 200.9L461.4 200.9L461.8 200.5L461.6 199.6L461.9 199.3L461.9 198.4Z M453.7 198.9L455.1 198.5L456.1 198.6L456.8 198.3L461.9 198.4L461.9 199.3L461.6 199.6L461.8 200.5L461.4 200.9L460.8 200.9L460.0 201.4L459.2 201.3L458.0 202.7L456.5 201.5L455.3 201.3L454.7 200.5L454.7 200.1L453.9 199.5L453.7 198.9Z M476.6 212.0L476.4 212.8L476.7 214.1L476.1 215.4L476.9 216.1L477.8 216.3L479.0 217.5L479.1 218.6L478.8 218.9L478.6 221.2L477.8 221.2L475.0 219.9L472.5 217.8L470.1 216.3L468.2 214.5L468.9 213.6L469.0 212.8L470.3 211.3L471.6 210.0L472.2 209.9L472.9 209.6L474.1 211.3L473.9 212.4L474.4 213.0L475.2 213.0L475.8 211.9L476.6 212.0Z M463.2 208.6L464.7 207.4L465.0 206.6L465.5 206.0L466.2 205.9L466.9 205.4L469.1 205.4L469.9 206.4L470.5 207.6L470.4 208.4L470.8 209.1L470.8 210.1L471.6 210.0L470.3 211.3L469.0 212.8L468.9 213.6L468.2 214.5L467.5 214.3L465.5 213.2L464.0 211.7L463.5 210.7L463.2 208.6Z M485.0 204.5L484.8 202.9L485.6 201.7L485.5 200.8L487.7 198.5L488.1 196.6L488.9 195.9L490.2 196.3L491.4 195.7L491.8 195.0L493.9 193.8L494.4 192.9L497.0 191.7L498.6 191.3L499.3 191.9L501.0 191.9L500.8 193.2L501.2 194.5L502.8 196.3L502.8 197.6L506.0 198.3L506.0 200.2L505.4 201.0L504.0 201.3L503.5 202.5L502.5 202.8L500.1 202.7L498.8 202.5L497.9 203.0L496.7 202.8L491.8 202.9L491.8 204.5L492.1 206.5L490.2 205.8L488.9 205.9L488.0 206.6L486.7 206.1L486.2 205.1L485.0 204.5Z M576.0 218.8L575.1 219.1L573.3 219.0L571.3 218.7L570.2 219.0L569.8 219.6L568.9 219.7L567.8 219.1L564.7 220.5L563.4 220.2L563.1 220.5L562.2 222.1L560.2 221.6L558.1 221.3L556.4 220.3L554.1 219.4L552.6 220.3L551.5 221.7L551.3 223.6L549.5 223.4L547.6 223.0L545.9 224.4L544.5 227.0L544.2 226.2L544.1 225.0L542.8 224.1L541.8 222.6L541.5 221.6L540.2 220.2L540.4 219.4L540.2 218.2L540.4 216.0L541.0 215.5L542.4 212.7L544.7 212.5L545.3 211.8L545.7 211.8L546.4 212.5L549.9 211.4L551.1 210.3L552.5 209.4L552.3 208.4L553.0 208.1L555.7 208.3L558.3 207.0L560.3 204.0L561.8 202.9L563.5 202.4L563.8 203.6L565.4 205.3L565.4 206.4L565.0 207.6L565.2 208.5L566.1 209.3L568.2 210.5L569.8 211.6L569.8 212.5L571.7 213.9L572.8 215.1L573.5 216.8L575.6 217.9L576.0 218.8Z M551.3 223.6L551.1 225.3L550.3 226.8L549.7 228.5L549.4 231.0L549.5 232.5L549.1 233.5L549.0 234.5L548.7 235.4L546.8 236.7L545.6 238.2L544.4 240.9L544.5 243.2L543.8 244.0L542.1 245.4L540.5 247.1L539.5 246.6L539.3 245.9L537.8 245.8L536.8 246.9L536.1 246.6L535.1 245.7L534.2 246.1L533.1 247.3L530.8 244.4L532.9 242.9L531.9 241.0L532.8 240.3L534.7 240.0L534.9 238.7L536.4 240.1L538.9 240.2L539.7 238.9L540.1 237.0L539.8 234.9L538.5 233.2L539.7 230.0L539.0 229.5L536.9 229.7L536.1 228.2L536.3 227.0L539.8 227.1L542.1 227.9L544.3 228.5L544.5 227.0L545.9 224.4L547.6 223.0L549.5 223.4L551.3 223.6Z M531.3 227.1L532.6 226.9L534.3 227.2L536.0 226.9L536.3 227.0L536.1 228.2L536.9 229.7L539.0 229.5L539.7 230.0L538.5 233.2L539.8 234.9L540.1 237.0L539.7 238.9L538.9 240.2L536.4 240.1L534.9 238.7L534.7 240.0L532.8 240.3L531.9 241.0L532.9 242.9L530.8 244.4L528.0 241.6L526.1 239.3L524.4 236.4L524.5 235.5L525.1 234.6L525.8 232.6L526.4 230.5L527.3 230.4L531.3 230.4L531.3 227.1Z M526.8 227.0L531.3 227.1L531.3 230.4L527.3 230.4L526.4 230.5L525.8 230.1L526.8 227.0Z M585.4 256.5L586.5 257.2L587.7 257.7L589.4 258.1L591.0 259.0L592.3 260.2L593.0 262.6L592.5 263.3L592.0 265.6L592.5 267.9L591.6 268.8L590.8 271.4L592.3 272.1L583.8 274.4L584.1 276.4L582.0 276.8L580.4 277.9L580.1 278.9L579.1 279.1L576.7 281.4L575.1 283.2L574.2 283.2L573.3 282.9L570.2 282.6L569.7 282.4L569.7 282.2L568.6 281.5L566.8 281.4L564.5 282.0L562.7 280.3L560.8 278.0L560.9 269.2L566.7 269.2L566.5 268.2L566.9 267.2L566.4 265.9L566.7 264.5L566.4 263.7L567.4 263.8L567.5 264.6L568.8 264.6L570.6 264.8L571.5 266.1L573.8 266.5L575.5 265.6L576.1 267.0L578.2 267.4L579.2 268.6L580.4 270.1L582.5 270.2L582.3 267.2L581.5 267.7L579.6 266.6L578.8 266.1L579.2 263.3L579.6 260.0L579.0 258.8L579.8 257.0L580.6 256.7L584.3 256.2L585.4 256.5Z M591.0 259.0L593.7 259.5L594.3 260.3L595.2 261.6L596.0 265.3L595.2 267.4L596.0 271.1L597.0 271.0L598.0 271.9L599.1 273.9L599.4 277.5L598.2 278.1L597.3 280.0L595.5 278.3L595.3 276.3L595.9 275.0L595.7 273.9L594.6 273.2L593.9 273.5L592.3 272.1L590.8 271.4L591.6 268.8L592.5 267.9L592.0 265.6L592.5 263.3L593.0 262.6L592.3 260.2L591.0 259.0Z M596.0 265.3L598.1 265.1L601.4 265.9L602.2 265.5L604.1 265.5L605.1 264.6L606.7 264.7L609.8 263.6L612.0 262.0L612.0 262.0L612.0 262.0L612.4 263.2L612.3 266.0L612.7 268.4L612.8 272.8L613.3 274.1L612.4 276.1L611.4 278.1L609.6 279.8L607.1 280.8L603.9 282.2L600.8 285.2L599.7 285.7L597.8 287.6L596.6 288.3L596.4 290.3L597.7 292.4L598.3 294.0L598.3 294.8L598.8 294.7L598.7 297.4L598.3 298.7L598.9 299.2L598.5 300.3L597.3 301.3L595.0 302.3L591.7 303.8L590.5 304.8L590.7 306.0L591.4 306.2L591.2 307.6L589.1 307.6L588.8 306.4L588.4 305.1L588.2 304.1L588.7 301.0L588.0 299.1L586.6 295.1L589.6 292.0L590.3 290.0L590.7 289.7L591.0 288.1L590.6 287.3L590.7 285.2L591.2 283.3L591.2 279.8L589.8 278.9L588.5 278.7L587.9 278.0L586.6 277.4L584.3 277.4L584.1 276.4L583.8 274.4L592.3 272.1L593.9 273.5L594.6 273.2L595.7 273.9L595.9 275.0L595.3 276.3L595.5 278.3L597.3 280.0L598.2 278.1L599.4 277.5L599.1 273.9L598.0 271.9L597.0 271.0L596.0 271.1L595.2 267.4L596.0 265.3Z M589.1 307.6L588.5 308.8L586.9 309.1L585.2 307.6L585.2 306.7L586.0 305.6L586.2 304.8L587.0 304.6L588.4 305.1L588.8 306.4L589.1 307.6Z M536.1 246.6L535.1 247.2L534.6 247.9L534.5 249.1L533.8 249.4L533.1 247.3L534.2 246.1L535.1 245.7L536.1 246.6Z M534.2 250.3L535.4 249.9L536.2 250.0L537.2 249.6L545.4 249.7L546.0 251.7L546.8 253.4L547.5 254.3L548.5 255.7L550.4 255.5L551.3 255.1L552.8 255.5L553.2 254.8L553.9 253.2L555.7 253.1L555.8 252.6L557.2 252.6L557.0 253.6L560.4 253.6L560.4 255.3L561.0 256.4L560.6 258.1L560.8 259.8L561.7 260.8L561.5 264.1L562.2 263.9L563.4 263.9L565.2 263.5L566.4 263.7L566.7 264.5L566.4 265.9L566.9 267.2L566.5 268.2L566.7 269.2L560.9 269.2L560.8 278.0L562.7 280.3L564.5 282.0L559.4 283.1L552.7 282.7L550.7 281.4L539.5 281.5L539.1 281.7L537.4 280.5L535.6 280.4L533.9 280.9L532.6 281.4L532.3 279.6L532.7 277.2L533.7 274.7L533.8 273.5L534.7 271.0L535.4 269.8L537.0 268.0L537.9 266.8L538.2 264.7L538.0 263.1L537.2 262.1L536.4 260.5L535.8 258.8L535.9 258.2L536.8 257.1L535.9 254.4L535.4 252.6L534.0 250.8L534.2 250.3Z M584.6 240.0L584.8 241.1L585.4 241.8L585.4 242.7L584.7 243.2L583.7 244.7L582.6 245.7L581.5 245.8L581.3 242.5L580.6 241.2L582.3 241.4L583.2 239.9L584.6 240.0Z M637.6 268.0L638.4 269.2L639.0 271.0L639.5 274.3L640.2 275.6L639.9 277.0L639.4 277.8L638.5 276.2L638.0 277.0L638.5 279.0L638.3 280.2L637.5 280.9L637.3 283.2L636.2 286.4L634.9 290.3L633.1 295.5L632.1 299.4L630.8 302.6L628.6 303.3L626.1 304.4L624.5 303.7L622.3 302.7L621.6 301.3L621.4 298.8L620.4 296.6L620.2 294.6L620.6 292.6L621.9 292.1L621.9 291.2L623.3 289.1L623.5 287.3L622.9 286.0L622.3 284.3L622.1 281.7L623.1 280.1L623.5 278.4L624.8 278.3L626.4 277.7L627.4 277.2L628.6 277.2L630.2 275.6L632.5 273.9L633.3 272.5L633.0 271.3L634.1 271.6L635.7 269.7L635.7 268.0L636.7 266.8L637.6 268.0Z M453.6 195.6L456.6 195.5L457.2 194.8L458.1 194.8L459.2 195.5L460.1 195.5L461.0 195.0L461.5 195.8L460.3 196.4L459.1 196.4L457.9 195.8L456.9 196.4L456.4 196.5L455.7 196.9L453.2 196.8L453.6 195.6Z M526.3 149.1L525.2 144.2L523.4 143.0L523.4 142.4L521.1 140.7L520.9 138.6L522.6 137.1L523.3 134.8L522.8 132.1L523.4 130.7L526.4 129.6L528.4 129.9L528.3 131.3L530.6 130.3L530.8 130.8L529.4 132.2L529.4 133.5L530.4 134.2L530.0 136.6L528.2 138.0L528.7 139.5L530.2 139.5L530.9 140.9L531.9 141.3L531.8 143.4L530.4 144.2L529.5 145.1L527.6 146.2L527.9 147.3L527.7 148.5L526.3 149.1Z M475.9 157.2L475.9 156.7L475.9 156.5L475.9 153.2L480.4 151.2L483.2 150.7L485.4 150.0L486.5 148.6L489.7 147.5L489.9 145.5L491.5 145.2L492.7 144.2L496.4 143.7L496.9 142.6L496.1 142.0L495.2 139.1L495.0 137.4L494.0 135.6L496.6 134.1L499.6 133.6L501.4 132.5L504.1 131.7L508.8 131.2L513.4 130.9L514.8 131.3L517.4 130.2L520.4 130.2L521.5 130.9L523.4 130.7L522.8 132.1L523.3 134.8L522.6 137.1L520.9 138.6L521.1 140.7L523.4 142.4L523.4 143.0L525.2 144.2L526.3 149.1L527.2 151.6L527.4 152.9L526.9 155.2L527.1 156.4L526.7 157.9L527.0 159.7L525.9 160.8L527.5 162.9L527.6 164.1L528.6 165.6L529.9 165.1L532.1 166.4L533.3 168.1L523.8 173.4L515.8 178.9L511.9 180.1L508.8 180.4L508.7 178.6L507.5 178.2L505.7 177.4L505.1 176.1L495.7 170.0L486.3 164.0L475.9 157.2Z M601.2 193.3L600.9 192.2L602.1 188.1L602.4 186.2L603.2 185.4L605.3 184.9L606.7 183.3L608.3 186.6L609.1 189.1L610.6 190.5L614.4 193.1L615.9 194.7L617.4 196.3L618.3 197.2L619.7 198.1L618.8 198.7L617.6 198.5L616.7 197.6L615.6 196.0L614.3 195.1L613.6 194.1L611.2 193.0L609.3 193.0L608.6 192.4L607.0 193.0L605.3 191.8L604.4 193.9L601.2 193.3Z M494.0 135.6L495.0 137.4L495.2 139.1L496.1 142.0L496.9 142.6L496.4 143.7L492.7 144.2L491.5 145.2L489.9 145.5L489.7 147.5L486.5 148.6L485.4 150.0L483.2 150.7L480.4 151.2L475.9 153.2L475.9 156.5L475.5 156.5L475.6 158.0L473.9 158.1L473.0 158.7L471.7 158.7L470.7 158.4L468.4 158.7L467.4 160.8L466.6 161.0L465.3 164.5L461.4 167.5L460.5 171.4L459.4 172.6L459.0 173.6L452.8 173.8L452.7 173.8L452.9 172.5L453.9 171.8L454.8 170.3L454.6 169.4L455.6 167.4L457.1 165.7L458.1 165.2L458.8 163.6L458.9 162.1L459.9 160.4L461.7 159.4L463.5 156.6L463.6 156.5L464.9 155.4L467.5 155.1L469.7 153.2L471.1 152.5L473.4 150.2L472.7 146.7L473.8 144.3L474.2 142.9L476.0 141.0L478.7 139.7L480.8 138.6L482.7 135.7L483.5 134.0L485.6 134.0L487.2 135.2L489.9 135.0L492.8 135.6L494.0 135.6Z M602.4 172.2L591.4 172.2L580.6 172.2L569.4 172.2L569.4 162.0L569.4 152.1L568.6 149.9L569.3 148.2L568.9 147.0L569.9 145.6L573.6 145.6L576.3 146.3L579.0 147.2L580.3 147.6L582.5 146.7L583.6 145.9L586.0 145.7L588.0 146.0L588.8 147.4L589.4 146.5L591.6 147.2L593.8 147.3L595.2 146.6L595.2 146.6L596.7 150.7L597.0 151.4L596.2 152.5L595.6 154.6L594.9 156.0L594.2 156.5L593.3 155.6L592.0 154.4L590.1 150.4L589.8 150.7L590.9 153.6L592.6 156.4L594.7 160.7L595.8 162.2L596.7 163.8L599.1 166.9L598.6 167.4L598.7 169.2L601.9 171.7L602.4 172.2Z M569.4 172.2L569.4 177.8L566.2 177.8L566.2 178.9L555.1 173.6L544.1 168.3L541.3 169.8L539.3 170.9L537.7 169.3L533.3 168.1L532.1 166.4L529.9 165.1L528.6 165.6L527.6 164.1L527.5 162.9L525.9 160.8L527.0 159.7L526.7 157.9L527.1 156.4L526.9 155.2L527.4 152.9L527.2 151.6L526.3 149.1L527.7 148.5L527.9 147.3L527.6 146.2L529.5 145.1L530.4 144.2L531.8 143.4L531.9 141.3L535.2 142.2L536.3 142.0L538.7 142.5L542.3 143.7L543.6 146.2L546.1 146.7L550.1 147.9L553.0 149.3L554.4 148.5L555.7 147.3L555.1 145.1L555.9 143.8L557.9 142.5L559.8 142.1L563.6 142.7L564.5 143.9L565.6 143.9L566.5 144.4L569.2 144.7L569.9 145.6L568.9 147.0L569.3 148.2L568.6 149.9L569.4 152.1L569.4 162.0L569.4 172.2Z M632.7 211.1L624.9 219.4L621.3 219.6L618.8 221.5L617.0 221.6L616.3 222.4L614.4 222.4L613.2 221.5L610.7 222.7L609.9 223.8L608.0 223.6L607.4 223.3L606.8 223.4L605.9 223.3L602.4 221.0L600.4 221.0L599.5 220.1L599.5 218.5L598.1 218.0L596.4 215.0L595.1 214.4L594.7 213.3L593.2 211.9L591.5 211.7L592.5 210.1L594.0 210.1L594.4 209.2L594.3 206.7L595.2 203.8L596.5 203.0L596.8 201.9L597.9 199.8L599.6 198.4L600.8 195.7L601.2 193.3L604.4 193.9L605.3 191.8L607.0 193.0L608.6 192.4L609.3 193.0L611.2 193.0L613.6 194.1L614.3 195.1L615.6 196.0L616.7 197.6L617.6 198.5L616.7 199.7L615.7 201.0L615.9 201.8L616.0 202.6L617.5 202.7L618.2 202.5L618.8 203.0L618.2 204.0L619.2 205.5L620.3 206.8L621.3 207.8L630.4 211.1L632.7 211.1Z M617.6 198.5L618.8 198.7L619.7 198.1L620.3 198.9L620.2 200.1L618.7 200.7L619.8 201.5L618.8 203.0L618.2 202.5L617.5 202.7L616.0 202.6L615.9 201.8L615.7 201.0L616.7 199.7L617.6 198.5Z M636.0 201.6L636.0 201.6L636.0 201.7L635.9 202.8L635.9 205.6L635.9 207.1L634.7 208.8L632.7 211.1L630.4 211.1L621.3 207.8L620.3 206.8L619.2 205.5L618.2 204.0L618.8 203.0L619.8 201.5L620.8 202.0L621.3 203.2L622.5 204.3L623.9 204.3L626.5 203.6L629.6 203.3L632.0 202.4L633.4 202.2L634.4 201.7L636.0 201.6L636.0 201.6Z M594.2 236.0L588.5 236.2L585.5 236.2L584.5 236.5L582.8 237.3L582.2 237.1L582.2 235.0L582.8 233.9L583.0 231.7L583.6 230.4L584.6 228.9L585.7 228.2L586.6 227.2L585.5 226.8L585.6 223.6L585.6 223.6L586.8 222.8L588.6 223.4L590.8 222.8L592.8 222.8L594.5 221.5L595.8 223.5L596.1 224.9L597.3 228.0L596.3 230.1L594.9 231.9L594.1 233.0L594.2 236.0Z M584.5 236.5L585.6 238.1L585.4 239.7L584.6 240.0L584.6 240.0L583.2 239.9L582.3 241.4L580.6 241.2L580.9 239.7L581.3 239.5L581.4 237.8L582.2 237.1L582.8 237.3L584.5 236.5Z M585.6 223.6L583.2 221.7L582.5 220.6L581.0 221.1L579.7 221.0L579.0 221.4L577.7 221.1L576.0 218.8L575.6 217.9L573.5 216.8L572.8 215.1L571.7 213.9L569.8 212.5L569.8 211.6L568.2 210.5L566.4 209.4L567.2 209.1L568.2 208.6L568.9 206.1L569.6 204.8L571.6 204.4L572.1 205.2L573.5 206.8L574.3 207.0L575.3 206.6L577.3 206.7L577.7 207.2L580.5 207.2L580.6 206.7L582.0 206.1L582.3 205.3L583.3 204.7L585.7 206.4L587.1 206.1L588.5 204.1L590.0 202.6L589.8 200.9L589.1 200.1L590.8 199.9L591.0 199.3L592.2 199.5L591.9 201.6L592.2 203.6L593.7 204.7L594.0 205.6L594.0 207.0L594.3 207.0L594.4 209.2L594.0 210.1L592.5 210.1L591.5 211.7L593.2 211.9L594.7 213.3L595.1 214.4L596.4 215.0L598.1 218.0L596.2 219.9L594.5 221.5L592.8 222.8L590.8 222.8L588.6 223.4L586.8 222.8L585.6 223.6Z", "oc": "M1000.0 278.0L1000.0 279.3L998.2 280.0L996.5 280.6L996.1 279.6L997.5 279.0L998.4 278.8L1000.0 278.0Z M994.8 282.0L995.5 281.5L996.4 282.3L996.0 283.8L994.3 284.1L992.7 283.8L992.5 282.6L993.5 281.6L994.8 282.0Z M891.7 240.6L896.5 242.5L901.6 244.1L903.5 245.5L905.1 246.9L905.5 248.5L910.1 250.2L910.8 251.7L908.3 252.0L908.9 253.9L911.3 255.7L913.2 258.6L914.7 258.5L914.6 259.8L916.8 260.2L915.9 260.8L918.9 261.9L918.6 262.7L916.7 262.9L916.1 262.2L913.7 261.9L910.9 261.5L908.7 259.7L907.1 258.2L905.7 255.7L902.1 254.5L899.7 255.3L898.0 256.2L898.4 258.3L896.2 259.2L894.6 258.8L891.8 258.7L891.7 249.6L891.7 240.6Z M924.0 243.5L925.1 244.4L925.4 245.8L924.5 246.6L924.0 244.9L923.4 243.9L922.1 243.0L920.5 241.8L918.5 240.9L919.3 240.3L920.8 241.1L921.7 241.7L922.9 242.3L924.0 243.5Z M920.3 249.6L918.8 250.2L917.3 250.9L915.9 250.9L913.6 250.1L912.0 249.3L912.2 248.4L914.7 248.8L916.2 248.6L916.7 247.3L917.1 247.2L917.3 248.7L918.9 248.5L919.7 247.5L921.2 246.5L920.9 244.9L922.6 244.9L923.2 245.3L923.1 246.9L922.2 248.6L920.7 248.8L920.3 249.6Z M929.9 248.2L930.7 248.8L932.1 250.6L933.4 251.5L933.0 252.3L932.2 252.6L931.0 251.5L929.8 249.7L929.2 247.6L929.6 247.3L929.9 248.2Z M963.3 276.9L962.9 276.1L962.9 274.0L964.2 274.8L964.6 277.1L963.9 276.7L963.3 276.9Z M960.5 291.9L962.8 293.6L964.2 294.9L963.2 295.6L961.6 294.8L959.7 293.6L957.9 292.1L956.0 290.1L955.6 289.2L956.8 289.2L958.4 290.2L959.6 291.1L960.5 291.9Z M950.3 262.5L951.1 263.4L949.2 263.4L948.1 261.7L949.8 262.4L950.3 262.5Z M949.1 260.0L948.7 260.5L946.6 258.1L946.1 256.4L947.0 256.4L948.0 258.7L949.1 260.0Z M946.8 260.8L945.7 260.8L944.0 260.5L943.4 260.1L943.6 259.0L945.5 259.4L946.4 260.0L946.8 260.8Z M943.4 255.6L944.1 256.5L944.2 257.1L942.0 255.9L940.5 254.9L939.5 253.9L939.9 253.7L941.2 254.3L943.4 255.6Z M936.5 252.8L937.6 253.7L937.1 253.9L935.8 253.3L934.7 252.1L934.8 251.7L936.5 252.8Z M991.3 344.6L990.3 346.1L988.9 348.0L986.8 349.1L986.3 348.4L985.1 348.0L986.7 345.7L985.8 344.2L982.8 343.1L982.9 342.1L984.9 341.1L985.4 339.0L985.3 337.2L984.1 335.3L984.2 334.8L982.9 333.7L980.7 331.2L979.5 329.2L980.6 329.0L982.1 330.6L984.2 331.3L985.0 333.8L987.0 336.7L987.1 334.8L988.4 335.6L988.8 337.7L991.0 338.6L992.9 338.8L994.5 337.7L995.9 338.0L995.2 340.5L994.4 342.1L992.2 342.1L991.5 342.9L991.8 344.1L991.3 344.6Z M971.3 354.3L973.7 352.9L975.3 351.4L976.6 349.4L977.6 348.7L978.0 347.1L980.0 345.8L980.6 347.0L981.2 348.1L983.2 347.0L984.0 348.2L984.0 349.4L983.0 350.6L981.2 352.7L979.8 353.8L980.8 355.1L978.6 355.2L976.3 356.2L975.5 358.0L973.9 360.9L971.8 362.1L970.4 362.9L967.8 362.8L966.0 361.9L963.0 361.7L962.5 360.7L964.0 358.6L967.5 355.9L969.3 355.4L971.3 354.3Z M910.2 346.7L911.9 346.9L912.1 350.2L911.2 351.1L910.9 353.4L909.9 352.6L908.0 354.5L907.4 354.4L905.7 354.3L904.0 351.9L903.6 350.1L902.0 347.7L902.1 346.4L903.9 346.6L906.6 347.6L908.1 347.2L910.2 346.7Z M850.4 322.8L845.1 324.9L843.5 327.5L839.4 327.8L834.9 327.6L831.4 329.2L829.2 329.9L825.8 330.6L821.0 328.9L819.6 326.7L821.4 325.7L821.7 322.8L819.9 318.3L819.6 315.2L818.4 312.5L816.8 309.3L814.8 305.9L815.1 304.5L817.3 306.4L815.9 302.8L815.0 301.1L815.9 298.8L815.9 295.8L817.3 295.9L820.7 293.0L824.2 290.8L826.2 291.0L830.1 289.6L831.3 288.8L835.7 288.0L837.9 285.3L839.7 282.8L841.7 278.9L844.1 280.7L843.9 278.1L845.5 276.6L847.7 274.1L849.1 272.9L850.4 272.5L853.0 271.7L856.6 274.6L860.1 274.9L860.8 271.2L861.6 269.7L864.5 267.2L868.3 267.0L866.2 264.6L869.5 264.9L873.3 266.8L875.8 267.4L878.5 266.8L880.4 267.6L878.6 270.3L878.0 271.5L876.2 274.2L878.6 276.5L882.2 278.4L885.0 280.0L886.8 281.6L891.3 281.6L892.4 278.9L893.6 275.1L893.4 273.0L893.5 269.3L893.6 267.8L894.8 264.8L895.9 263.0L896.9 266.1L897.7 267.6L898.9 270.6L899.8 273.7L902.5 273.9L903.5 276.2L904.5 280.0L906.0 282.7L906.6 286.0L911.6 288.8L913.1 290.6L915.8 295.4L918.0 296.0L919.2 298.5L922.4 301.3L925.4 305.8L925.3 309.1L926.4 313.9L925.2 317.6L924.7 321.2L921.4 325.1L919.5 328.6L917.6 332.4L916.5 336.4L915.1 338.3L909.4 339.5L906.4 341.8L902.4 340.0L901.3 339.1L896.5 340.4L893.4 339.7L888.9 337.2L887.7 333.7L883.7 332.3L883.9 328.8L880.1 331.3L882.0 328.1L882.8 324.7L878.8 328.0L875.6 329.1L873.9 325.6L873.0 323.9L867.5 322.2L859.8 321.1L853.1 323.0Z"};
const WM_W=1000, WM_H=388.9;
const maxRegion = Math.max(...regions.map(r => (byRegion[r]||[]).length)) || 1;
const REGION_GEO = { na:[-100,48], sa:[-58,-15], eu:[15,52], as:[95,45], af:[20,2], oc:[134,-25] };
function geoXY(lon,lat){ return [ (lon+180)/360*WM_W, (84-lat)/140*WM_H ]; }
let _svg = '<svg class="wm-svg" viewBox="0 0 '+WM_W+' '+WM_H+'" preserveAspectRatio="xMidYMid meet">';
['af','sa','na','as','eu','oc'].forEach(function(r){ if(REGION_PATHS[r]) _svg += '<path class="wm-region" data-region="'+r+'" style="--c:'+(REGION_COLORS[r]||'#cbd5e1')+'" d="'+REGION_PATHS[r]+'"/>'; });
_svg += '</svg>';
regionGrid.innerHTML = '<div class="wm-inner">' + _svg + '<div class="wm-pins" id="wmPins"></div></div>';
const wmPins = document.getElementById('wmPins');
regions.forEach(r => {
  const ct = (byRegion[r] || []).length; if (!ct || !REGION_GEO[r]) return;
  const xy = geoXY(REGION_GEO[r][0], REGION_GEO[r][1]);
  const left = (xy[0]/WM_W*100).toFixed(2), top = (xy[1]/WM_H*100).toFixed(2);
  const size = Math.round(22 + (ct/maxRegion)*26);
  const btn = document.createElement('button');
  btn.className='wm-pin'; btn.dataset.region=r;
  btn.style.left=left+'%'; btn.style.top=top+'%';
  btn.style.setProperty('--c', REGION_COLORS[r] || 'var(--accent)');
  btn.style.setProperty('--sz', size+'px');
  btn.setAttribute('aria-label', (REGION_KO[r]||REGION_LABELS[r])+' 파트너 '+ct+'곳');
  btn.innerHTML = '<span class="wm-ring"></span><span class="wm-dot">'+ct+'</span>'
    + '<span class="wm-tip">'+(REGION_KO[r]||'')+' <b>'+REGION_LABELS[r]+'</b> · '+ct+'곳</span>';
  wmPins.appendChild(btn);
});
regionGrid.addEventListener('click', e => {
  const hit = e.target.closest('.wm-pin, .wm-region');
  if (!hit) return;
  const r = hit.dataset.region;
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

  document.querySelectorAll('.wm-pin').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });
  document.querySelectorAll('.wm-region').forEach(c => {
    c.classList.toggle('active', c.dataset.region === currentRegion);
  });
  const wm = document.getElementById('worldMap');
  if (wm) wm.classList.toggle('has-active', currentRegion !== 'all');

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
/* 카드 배너(가로형)에서 정사각형 사진의 핵심 피사체가 보이도록 표시 위치 보정 */
const CASE_HERO_POS = {
  'us-army': 'center 60%',
  'exxonmobil': 'center 42%',
  'gs-eps': 'center 82%',
  'cbre': 'center 38%',
  'hyundai-motors': 'center 72%'
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
        <span class="arrow">→</span>
      </div>
    </button>
  `).join('');
  grid.querySelectorAll('.app-card').forEach(card => {
    card.onclick = () => { navigate('app/' + card.dataset.id); };
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
let HOME_CASES = [];  /* homecases 시트가 채우면 이것을 우선 사용 */

/* 고객사 로고 (메인 하단 띠) — Logos 시트 탭으로 추가/수정. 비어있으면 기존 기본 로고 유지 */
function mapLogos(rows){
  return (rows||[]).map(function(o){ return { name:(o.name||'').trim(), image:(o.image||'').trim() }; })
                   .filter(function(x){ return x.name || x.image; });
}
let _logosRendered = false;
function renderLogos(list){
  if(!list || !list.length){ console.log('[Logos] 데이터 없음'); return; }
  if(_logosRendered){ console.log('[Logos] 이미 렌더링됨 (중복 호출 방지)'); return; }
  const track = document.querySelector('.logo-marquee .logo-track');
  if(!track){ console.warn('[Logos] DOM 요소 없음'); return; }
  console.log('[Logos] 렌더링:', list.length, '개');
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const slide = it => {
    const src = it.image ? (typeof normalizeImageUrl==='function'? normalizeImageUrl(it.image) : it.image) : '';
    // 이미지 로드 실패 시 회사명을 카드 안에 표시(슬롯 폭 유지 → 마퀴 어긋남 방지)
    const onerr = "this.onerror=null;this.style.display='none';this.parentNode.classList.add('logo-fallback');this.parentNode.setAttribute('data-name',this.alt||'');";
    const img = src ? '<img src="'+esc(src)+'" alt="'+esc(it.name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="'+onerr+'">' : '';
    return '<div class="logo-slide">'+img+'<span>'+esc(it.name)+'</span></div>';
  };
  const html = list.map(slide).join('');
  track.innerHTML = html + html;
  _logosRendered = true;
  console.log('[Logos] 완료');
}

function renderHomeCases() {
const homeCases = document.getElementById('homeCases');
if (!homeCases) return;
homeCases.innerHTML = '';
let picks;
if (HOME_CASES && HOME_CASES.length) {
  picks = HOME_CASES;
} else {
  // homecases 탭이 없으면 Cases(시트) 앞 3개로 자동 구성 — 코드 하드코딩 잔재가 노출되지 않도록
  const ck = Object.keys(CASE_DATA);
  picks = (ck.length ? ck.slice(0, 3) : HOME_CASE_PICKS).map(id => ({ caseid:id }));
}
picks.forEach((p, idx) => {
  const caseId = p.caseid;
  const c = CASE_DATA[caseId] || {};
  const name = p.name || c.name || caseId;
  // 태그: 시트 industry(키 또는 라벨) → CASE_DATA → 고객사 매칭 순으로 보완
  let tagInfo = INDUSTRIES[p.industry];
  if (!tagInfo && p.industry){ const k = Object.keys(INDUSTRIES).find(k => INDUSTRIES[k].label === p.industry); if (k) tagInfo = INDUSTRIES[k]; }
  if (!tagInfo){ const cust = CUSTOMERS.find(x => x.n === name); tagInfo = cust ? INDUSTRIES[cust.i] : null; }
  const tagClass = tagInfo ? tagInfo.tag : 'tag-pub';
  const tagLabel = tagInfo ? tagInfo.label : (c.industry || '');
  const tagline = p.tagline || c.tagline || '';
  let rNum = p.resultNum, rLbl = p.resultLabel;
  if (!rNum){ const hl = HOME_CASE_HIGHLIGHTS[caseId] || (c.qs && c.qs[0]) || {}; rNum = hl.n || hl.num || ''; rLbl = hl.l || hl.lbl || ''; }
  const num = String(idx + 1).padStart(2, '0');
  const bg = p.photo || ((typeof CASE_HERO_BG !== 'undefined') ? CASE_HERO_BG[caseId] : '') || '';
  const media = `<div class="hcc-media">${bg ? `<img class="hcc-img" src="${bg}" alt="${name}" loading="lazy" onerror="this.parentElement.style.display='none';">` : ''}</div>`;
  const hasDetail = !!CASE_DATA[caseId] || !!p.link;
  homeCases.insertAdjacentHTML('beforeend', `
    <article class="home-case-card${hasDetail?'':' no-link'}" data-case="${caseId}" data-link="${p.link||''}" style="cursor:${hasDetail?'pointer':'default'}">
      ${media}
      <div class="hcc-body">
        <div class="hcc-num">CASE / ${num}</div>
        <div class="hcc-logo">${name}</div>
        <span class="hcc-tag ${tagClass}">${tagLabel}</span>
        <div class="hcc-headline">${tagline}</div>
        <div class="hcc-result">
          <div class="hcc-result-num">${rNum}</div>
          <div class="hcc-result-lbl">${rLbl}</div>
        </div>
        ${hasDetail ? '<div class="hcc-cta">케이스스터디 보기</div>' : ''}
      </div>
    </article>
  `);
});
homeCases.querySelectorAll('.home-case-card').forEach(card => {
  card.addEventListener('click', () => {
    const link = card.dataset.link;
    if (link) { window.open(link, '_blank', 'noopener'); return; }
    if (CASE_DATA[card.dataset.case]) navigate('case/' + card.dataset.case);
  });
});
}
renderHomeCases();

/* ========== APP DETAIL RENDERING ========== */
function renderAppDetail(id) {
  const app = APPS.find(a => a.id === id);
  if (!app) { navigate('applications'); return; }
  const det = APP_DETAILS[id] || DEFAULT_APP_DETAIL;

  document.getElementById('appd-cat-tag').innerHTML =
    `<span class="app-tag ${app.cat}">${CATEGORIES[app.cat].label}</span>`;
  document.getElementById('appd-name').textContent = app.name;
  const _descEl = document.getElementById('appd-desc');
  _descEl.textContent = app.desc;
  // 데이터시트(첨부 PDF): AppDetails 탭의 datasheet 열이 단일 출처
  const _ds = (det && det.datasheet) ? det.datasheet : '';
  const _host = _descEl.parentElement;
  const _old = _host.querySelector('.appd-datasheet'); if (_old) _old.remove();
  if (_ds) {
    _descEl.insertAdjacentHTML('afterend',
      `<a class="appd-datasheet" href="${_ds}" target="_blank" rel="noopener"
          style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:9px 16px;border-radius:8px;background:#003087;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">적용사례 다운로드 <span style="font-size:15px;">↓</span></a>`);
  }

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
            <div class="phase-duration"><span class="dur-k">소요</span>: <span class="dur-v">${ph.duration}</span></div>
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
    return idx >= 0 ? { src: normalizeImageUrl(s.slice(0, idx).trim()), caption: s.slice(idx + 2).trim() }
                    : { src: normalizeImageUrl(s), caption: '' };
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
const ICO = {
  waves:   '<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7.5 12a4.5 4.5 0 0 1 9 0"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  gateway: '<rect x="3" y="13" width="18" height="7" rx="1.6"/><circle cx="7" cy="16.5" r="1" fill="currentColor" stroke="none"/><path d="M12 13V7.5"/><path d="M8.5 7.5a3.5 3.5 0 0 1 7 0"/><path d="M6 5a6 6 0 0 1 12 0"/>',
  cloud:   '<path d="M7.5 18.5A4.25 4.25 0 0 1 7 10.05a5 5 0 0 1 9.62 1.3A3.6 3.6 0 0 1 16.5 18.5H7.5z"/>',
  server:  '<rect x="3.5" y="4.5" width="17" height="6" rx="1.6"/><rect x="3.5" y="13.5" width="17" height="6" rx="1.6"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="7.5" cy="16.5" r="1" fill="currentColor" stroke="none"/><path d="M14.5 7.5h3M14.5 16.5h3"/>',
  win:     '<rect x="3" y="4.5" width="18" height="13" rx="1.6"/><path d="M3 9h18"/><path d="M9 20.5h6"/><path d="M12 17.5v3"/>',
  addon:   '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  video:   '<rect x="3" y="6" width="18" height="12" rx="2.4"/><path d="M10.3 9.4l4.6 2.6-4.6 2.6z" fill="currentColor" stroke="none"/>',
  alert:   '<path d="M12 3.4l8.5 15.1H3.5z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r="1.05" fill="currentColor" stroke="none"/>',
  doc:     '<path d="M7 3.2h6.5L18 7.7V20.8H7z"/><path d="M13.5 3.2v4.5H18"/><path d="M9.6 12.5h6M9.6 15.8h6"/>'
};
const KB_CATS = [
  { name:'센서',                ico:ICO.waves,   color:'#18D0E6' },
  { name:'게이트웨이',           ico:ICO.gateway, color:'#3B82F6' },
  { name:'iMonnit Online',      ico:ICO.cloud,   color:'#0EA5E9' },
  { name:'온프레미스 소프트웨어',  ico:ICO.server,  color:'#8B5CF6' },
  { name:'애드온 기기',          ico:ICO.addon,   color:'#F59E0B' },
  { name:'지원 동영상',          ico:ICO.video,   color:'#EF4444' },
  { name:'기기 손상',            ico:ICO.alert,   color:'#F43F5E' }
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
    const extras = Object.keys(counts).filter(c=>!known.includes(c)).map(c=>({name:c, ico:ICO.doc, color:'#94A3B8'}));
    const tiles = [...KB_CATS, ...extras].filter(c=>counts[c.name]);
    if (catGrid) catGrid.innerHTML = tiles.map(c=>`
      <button class="kb-cat-tile" data-cat="${esc(c.name)}" style="--ic:${c.color||'#64748B'}">
        <span class="kb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${c.ico}</svg></span>
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
      const extras = Object.keys(counts).filter(c=>!known.includes(c)).map(c=>({name:c, ico:ICO.doc, color:'#94A3B8'}));
      const tiles = [...cfg.cats, ...extras].filter(c=>counts[c.name]);
      if (catGrid){
        catGrid.innerHTML = tiles.map(c=>`<button class="kb-cat-tile" data-cat="${esc(c.name)}" style="--ic:${c.color||'#64748B'}"><span class="kb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${c.ico}</svg></span><span class="nm">${esc(c.name)}</span><span class="ct">${counts[c.name]||0}개 문서</span><span class="arr">보기 →</span></button>`).join('');
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
  { name:'센서',       ico:ICO.waves,   color:'#18D0E6' },
  { name:'게이트웨이',  ico:ICO.gateway, color:'#3B82F6' },
  { name:'소프트웨어',  ico:ICO.win,     color:'#8B5CF6' },
  { name:'액세서리',    ico:ICO.addon,   color:'#F59E0B' },
  { name:'문서/가이드', ico:ICO.doc,     color:'#14B8A6' },
  { name:'온프라미스',  ico:ICO.server,  color:'#6366F1' }
];
// GUIDES 데이터는 data.js 로 분리됨 (index.html 에서 app.js 보다 먼저 로드)
const guideModule = makeKBModule({
  data: () => GUIDES, cats: GUIDE_CATS, state: { view:'home', cat:null, search:'', page:1, docId:null, ret:null },
  ids: { search:'gSearch', clear:'gSearchClear', catGrid:'gCatGrid', listHead:'gListHead', grid:'gGrid', pager:'gPager', view:'view-guides' }
});
function renderGuides(){ guideModule.render(); }

var PRODUCTS = [
  {c:"sensors",g:"env",n:"온도",d:"-200~+370°C 범위, 식품·백신·HVAC·데이터센터 등 온도 모니터링. NIST 인증 옵션.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/temperature/standard/TS-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"습도",d:"시설·전시·데이터센터의 상대습도(RH) 원격 모니터링. NIST 인증 옵션.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/humidity/HU-RH-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"공기질",d:"PM1·PM2.5·PM10 농도 측정으로 실내 공기질 관리.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/air-quality/AQ-P25A-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"풍속",d:"기류 속도·온도·고도 측정(병원·클린룸 등).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/air-velocity/PS-AV-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"차압",d:"두 지점의 압력차 측정(클린룸·제약·주방·HVAC).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/differential-air-pressure/PS-DP-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"토양 수분",d:"토양 수분장력·온도 측정으로 관개 최적화.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/soil-moisture/WS-WM-ADS.pdf",p:true},
  {c:"sensors",g:"env",n:"조도 (Lux)",d:"조도(Lux) 측정 — 박물관·약품·식품 등 빛에 민감한 자산 관리(0~83,000 lux).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/light-meter/LS-LM-ADS-01.pdf",p:true},
  {c:"sensors",g:"env",n:"조도 (PAR·광합성)",d:"PAR(광합성유효광) 측정 — 작물·재배 조명의 광량 관리(389~692nm).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/light-meter/par/LS-PAR-ADS.pdf",p:true},
  {c:"sensors",g:"power",n:"AC 전류계",d:"전류·전력 소비를 원격 측정해 설비 상태·HVAC 성능 진단.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/current-meters/CM-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"3상 전류계",d:"산업용 3상 전력 소비 모니터링. 20/150/500A 모델 제공(데이터시트 공통).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/three-phase-current-meters/3P-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"200VDC 미터",d:"0~200VDC 직류 전압을 정밀 측정(미터형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/200-VDC-meter/VM-200-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"200VDC 감지",d:"200VDC 전원의 On/Off 상태 감지(감지형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/200-volt-detection/VD-200-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"500VAC 미터",d:"0~500VAC 교류 전압을 정밀 측정(미터형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/500-VAC-meter/VM-500-ADS-01.pdf",p:true},
  {c:"sensors",g:"power",n:"500VAC 감지",d:"500VAC 전원의 On/Off 상태 감지(감지형).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/voltage-detection/500-volt-detection/VD-AC-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"모션·점유",d:"PIR 기반 사람·동물 움직임 및 공간 점유 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pir-motion/MS-IR-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"개폐(도어)",d:"문·창·캐비닛의 개폐 및 비인가 출입을 즉시 알림.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/open-closed/OC-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"버튼",d:"버튼을 누르면 즉시 알림(호출·점검 확인용).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/button-press/PB-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"motion",n:"차량 감지",d:"차량 진출입·대기시간 감지 및 카운트.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/vehicle-detection/VS-TT-ADS-01.pdf",p:true},
  {c:"sensors",g:"mech",n:"가속도·진동계",d:"3축 진동·주파수·속도·변위·가속도 측정으로 설비 예지보전.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/accelerometers/advanced-vibration/AC-ADV-ADS-01.pdf",p:true},
  {c:"sensors",g:"mech",n:"열전대",d:"K타입 등 고온 공정을 최대 400°C까지 측정.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/thermocouple/TS-TC-ADS-01.pdf",p:true},
  {c:"sensors",g:"mech",n:"저항",d:"최대 250kΩ 저항 측정, 산업·과학 장비용.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/resistance/RS-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 로프형",d:"워터 로프로 라인 전체의 누수를 감지(연장 가능).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/rope/WS-WR-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 프로브형(Detect+)",d:"프로브형 — 누수 유무에 더해 수위 단계까지 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/detect-plus/WS-WP-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 퍽형(디스크)",d:"디스크(퍽)형 — 바닥에 놓아 물 고임을 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/disc/WS-PS-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"누수 — 전선형(Detect)",d:"전선(스팟)형 — 특정 지점의 누수 유무를 감지.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/water-detection/detect/WS-WD-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"압력계",d:"기체·액체·증기 라인 압력 측정. 50/300/750/3000 PSIG 모델(데이터시트 공통).",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pressure-meters/PS-000-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"초음파 거리",d:"액위·재고·통행 감지를 위한 거리 측정.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/ultrasonic-ranging/US-ST-ADS-01.pdf",p:true},
  {c:"sensors",g:"level",n:"프로판 탱크",d:"R3D 게이지 연동으로 프로판 잔량을 원격 모니터링.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/propane-tank-level/HE-MG-ADS-01.pdf",p:true},
  {c:"sensors",g:"gas",n:"일산화탄소(CO)",d:"일산화탄소(CO) 농도 감지 및 임계 초과 시 알림.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/gas-detection/CO/GS-C1-ADS-01.pdf",p:true},
  {c:"sensors",g:"gas",n:"이산화탄소(CO2)",d:"이산화탄소(CO2) 농도 감지 — 실내 공기질·환기 관리.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/gas-detection/CO2/GS-C2-ADS-01.pdf",p:true},
  {c:"sensors",g:"gas",n:"황화수소(H2S)",d:"황화수소(H2S) 농도 감지 — 작업장 안전·규정 준수.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/gas-detection/H2S/GS-H2S-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"드라이컨택",d:"건접점(Dry Contact) 개폐 상태 모니터링.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/dry-contact/DC-CF-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"5채널 드라이컨택",d:"건접점 5채널 입력 — 여러 접점을 한 센서로 모니터링.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/5-input/DC-05-ADS.pdf",p:true},
  {c:"sensors",g:"iface",n:"0-5VDC",d:"0~5VDC 아날로그 전압 입력 계측.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/5-VDC/VM-005-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"0-10VDC",d:"0~10VDC 아날로그 전압 입력 계측.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/5-VDC/VM-005-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"0-20mA",d:"0~20mA 아날로그 전류 루프 입력 계측.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/20mA/MA-020-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"저항 브리지",d:"저항 브리지 입력 — 로드셀·스트레인게이지 등 아날로그 계측기 연결.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/interface-meters/resistive-bridge/RS-BR-ADS.pdf",p:true},
  {c:"sensors",g:"iface",n:"펄스 카운터 — 싱글",d:"단일 펄스 입력 카운트 — 미터·스위치·릴레이.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pulse-counter/PC-01-ADS-01.pdf",p:true},
  {c:"sensors",g:"iface",n:"펄스 카운터 — 듀얼",d:"2채널 펄스 카운트 — 한전 전력량계 등 연결.",u:"https://monnit.blob.core.windows.net/site/documents/sensors/pulse-counter/PC-02-ADS.pdf",p:true},
  {c:"gateways",g:"",n:"북미 IoT 셀룰러 게이트웨이",d:"4G LTE CAT-M1/NB2 기반 원거리 셀룰러 IoT 연결.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/4G-LTE/LTE-CCE-ND-ADS-01.pdf",p:true},
  {c:"gateways",g:"",n:"인터내셔널 셀룰러 게이트웨이",d:"약 90개국 지원 ALTA IoT 셀룰러 게이트웨이(SIM 카드 정보 별도 안내).",u:"https://monnit.blob.core.windows.net/site/documents/gateways/IoT/CME-CCE-ADS.pdf",p:true},
  {c:"gateways",g:"",n:"이더넷 게이트웨이",d:"최대 100~4,000개 센서 수용, PC 없이 iMonnit 연동.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/EGW4/EGW-CCE-EGW4-ADS-01.pdf",p:true},
  {c:"gateways",g:"",n:"시리얼 Modbus 게이트웨이",d:"RS-232C·RS-485 Modbus 인프라에 센서 최대 50개 연동.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/serial-modbus/SG-SMG-ADS-01.pdf",p:true},
  {c:"gateways",g:"",n:"센서 어댑터 (USB)",d:"USB로 PC·서드파티 게이트웨이에 무선 센서 연동.",u:"https://monnit.blob.core.windows.net/site/documents/gateways/sensor-adapter/WSA-USB-ADS-01.pdf",p:true},
  {c:"software",g:"",n:"iMonnit 클라우드 관리 SW",d:"클라우드 기반 센서 구성·관리·알림(소프트웨어 비교표 제공).",u:"https://monnit.blob.core.windows.net/site/documents/global/IM-SCS-01-iMonnit-Software-Comparison.pdf",p:true},
  {c:"software",g:"",n:"iMonnit Express 독립형 SW",d:"오프라인 PC 단독 실행(10~100개 규모).",u:"https://monnit.blob.core.windows.net/site/documents/software/Express/IM-EX-MDS-01.pdf",p:true},
  {c:"software",g:"",n:"온프레미스 엔터프라이즈",d:"대규모 센서망용 온프레미스 데이터 호스팅·관리.",u:"https://monnit.blob.core.windows.net/site/documents/software/Enterprise/IM-E-MUG-01-User.pdf",p:true},
  {c:"software",g:"",n:"Monnit Mine",d:"오픈 플랫폼 — 디바이스를 커스텀 호스트/IP로 연동.",u:"https://monnit.blob.core.windows.net/site/documents/software/Mine/IM-M-GSGJ-01.pdf",p:true},
  {c:"accessories",g:"",n:"사이트 서베이 툴",d:"설치 전 ALTA 신호 신뢰도를 사전 진단.",u:"https://monnit.blob.core.windows.net/site/documents/accessories/site-survey/SS-ST-ADS.pdf",p:true},
  {c:"accessories",g:"",n:"컨트롤 유닛",d:"원격 제어용 컨트롤 유닛 — 임계 조건에서 장비를 자동 제어.",u:"https://monnit.blob.core.windows.net/site/documents/accessories/facility-accessories/CTL-00-ADS.pdf",p:true},
  {c:"accessories",g:"",n:"로컬 경보기",d:"현장 로컬 경보기 — 임계 초과 시 현장에서 소리·시각 경보.",u:"https://monnit.blob.core.windows.net/site/documents/accessories/local-alert/AV-LA-ADS.pdf",p:true}
];

var PRODUCT_CATS = [
  {id:'sensors',     ko:'센서',     color:'#18D0E6', icon:'<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7 12a5 5 0 0 1 10 0"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'},
  {id:'gateways',    ko:'게이트웨이', color:'#3B82F6', icon:'<rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="16.5" r="1" fill="currentColor" stroke="none"/><path d="M12 13V7"/><path d="M8.5 7a3.5 3.5 0 0 1 7 0"/><path d="M6 4.5a6 6 0 0 1 12 0"/>'},
  {id:'software',    ko:'소프트웨어', color:'#8B5CF6', icon:'<rect x="3" y="4" width="18" height="14" rx="1.5"/><path d="M3 9h18"/><path d="M9 21h6"/><path d="M12 18v3"/>'},
  {id:'accessories', ko:'액세서리',  color:'#F59E0B', icon:'<path d="M14.5 5.5a3.5 3.5 0 0 1-4.9 4.9L4 16l-1 4 4-1 5.6-5.6a3.5 3.5 0 0 1 4.9-4.9l-2.5 2.5-2-2 1.0-3z"/>'}
];
var SENSOR_GROUPS = [
  {id:'env',    ko:'환경',          color:'#2BB673'},
  {id:'power',  ko:'전력',          color:'#F2A900'},
  {id:'motion', ko:'모션·보안',      color:'#A855F7'},
  {id:'mech',   ko:'기계·진동',      color:'#EF4444'},
  {id:'level',  ko:'레벨·누수',      color:'#3B82F6'},
  {id:'gas',    ko:'가스·안전',      color:'#14B8A6'},
  {id:'iface',  ko:'인터페이스·계측', color:'#EC4899'}
];
/* 제품 아이콘 — 사이트 라인 스타일에 맞춘 인라인 SVG (또렷·일관) */
var PROD_SVG = {
  temperature:'<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v6"/>',
  humidity:'<path d="M12 3.5s5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 5-9 5-9z"/><path d="M14.5 11l-4 4"/><circle cx="10.6" cy="11.2" r="0.6"/><circle cx="14.4" cy="14.6" r="0.6"/>',
  water:'<path d="M12 3.5s5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 5-9 5-9z"/>',
  vibration:'<path d="M3 12h2.2l1.8-5 3 11 3-15 2.8 13 1.6-4H21"/>',
  electrical:'<path d="M13 2.5 5 13.5h5.2L9 21.5l8-11.5h-5.4z"/>',
  motion:'<circle cx="12" cy="12" r="2"/><path d="M8.4 8.4a5 5 0 0 0 0 7.2M5.6 5.6a9 9 0 0 0 0 12.8M15.6 8.4a5 5 0 0 1 0 7.2M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  door:'<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="14.5" cy="12" r="1"/>',
  contact:'<path d="M3 12h5M16 12h5"/><circle cx="16" cy="12" r="0.6"/><path d="M8 12l6-4"/><circle cx="8" cy="12" r="1.4"/>',
  gas:'<path d="M7.5 17.5a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.4A3.6 3.6 0 0 1 16.6 17.5z"/>',
  air:'<path d="M3 8h10.5a2.8 2.8 0 1 0-2.8-2.8M3 12h13a2.8 2.8 0 1 1-2.8 2.8M3 16h8.5a2.4 2.4 0 1 1-2.4 2.4"/>',
  pressure:'<circle cx="12" cy="13" r="7"/><path d="M12 13l3.2-3.2"/><path d="M12 6V4.5"/><path d="M5.5 13H4M20 13h-1.5"/>',
  soil:'<path d="M12 12.5c.2-3 2-4.8 4.2-4.8-.8 3-2 4.2-4.2 4.8zM12 12.5c-.2-3-2-4.8-4.2-4.8.8 3 2 4.2 4.2 4.8zM12 12.5V17"/><path d="M4 20h16"/>',
  vehicle:'<path d="M5 11.5 6.5 7h11L19 11.5M4 16.5h16v-3l-1.2-2H5.2L4 13.5z"/><circle cx="7.8" cy="16.8" r="1.4"/><circle cx="16.2" cy="16.8" r="1.4"/>',
  control:'<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.6"/>',
  button:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  battery:'<rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2"/><path d="M7 12h5"/>',
  power:'<path d="M9 3v5M15 3v5M6.5 8h11v2.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v5"/>',
  gateway:'<rect x="4" y="13.5" width="16" height="6" rx="1.5"/><circle cx="8" cy="16.5" r="0.7"/><path d="M12 13.5V8M9.4 9.6a3.6 3.6 0 0 1 5.2 0M7.4 7.4a6.4 6.4 0 0 1 9.2 0"/>',
  edge:'<rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.6"/><path d="M10 7V4.5M14 7V4.5M10 19.5V17M14 19.5V17M7 10H4.5M7 14H4.5M19.5 10H17M19.5 14H17"/>',
  light:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>',
  tilt:'<path d="M4 18h13L8 6z"/><path d="M14.5 13.5a5.5 5.5 0 0 0 5.5 0"/>',
  resistance:'<path d="M4.5 17.5h3.4v-1.1a5 5 0 1 1 8.2 0v1.1h3.4"/>',
  pulse:'<rect x="3" y="4" width="18" height="6" rx="1"/><path d="M6 7h1.6M9.2 7h1.6M12.4 7h1.6M15.6 7h1.6"/><path d="M3 15h3.2l2-4 3 8 2-4H21"/>',
  software:'<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M3 8.2h18"/><path d="M8.5 21h7M12 17v4"/><circle cx="5.5" cy="6.1" r="0.5"/><path d="M6.5 12h4M6.5 14.4h7"/>',
  cloud:'<path d="M7.5 17.5a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.4A3.6 3.6 0 0 1 16.6 17.5z"/><path d="M9.6 13.2l1.9 1.9 3-3.4"/>',
  server:'<rect x="4" y="3.5" width="16" height="7" rx="1.3"/><rect x="4" y="13.5" width="16" height="7" rx="1.3"/><path d="M7.5 7h.01M7.5 17h.01M11 7h.01M11 17h.01"/><path d="M16.5 7h1.2M16.5 17h1.2"/>',
  signal:'<path d="M5 20v-3.5M10 20v-7.5M15 20v-11.5M20 20v-15.5"/>',
  alarm:'<path d="M6 16.5h12l-1.6-2.6V10a4.4 4.4 0 0 0-8.8 0v3.9L6 16.5z"/><path d="M10 19.5a2 2 0 0 0 4 0"/><path d="M3.5 7A6 6 0 0 1 6 3.5M20.5 7A6 6 0 0 0 18 3.5"/>',
  sensor:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
};
var PROD_ICON_RULES = [
  [/온프레미스|엔터프라이즈|enterprise|on-?prem|서버|server/i,'server'],
  [/클라우드|cloud/i,'cloud'],
  [/소프트|\bsw\b|imonnit|express|\bmine\b|플랫폼|platform|대시보드|dashboard/i,'software'],
  [/서베이|survey|신호.?세기|signal|레인지|range.?test/i,'signal'],
  [/경보|경보기|알람|alarm|사이렌|siren|부저|buzzer|beacon/i,'alarm'],
  [/저항|resistance|브리지|bridge|\brtd\b/i,'resistance'],
  [/펄스|pulse|카운터|counter/i,'pulse'],
  [/드라이.?컨택|건접점|dry.?contact|채널.?드라이/i,'contact'],
  [/프로판|propane|lpg|lng/i,'gas'],
  [/co2|이산화/i,'gas'],
  [/가스|\bgas\b|일산화|황화|h2s|\bco\b/i,'gas'],
  [/도어|문열|출입|개폐|open|closed/i,'door'],
  [/버튼|button|호출/i,'button'],
  [/차량|vehicle|\bcar\b|주차/i,'vehicle'],
  [/모션|motion|움직임|점유|occupancy|pir/i,'motion'],
  [/열전대|thermocouple|온도|temp|thermo|써미스/i,'temperature'],
  [/습도|humid/i,'humidity'],
  [/압력|pressure|psi|차압|differential/i,'pressure'],
  [/누수|물.?감지|water|leak|액위|레벨|침수|로프|퍽|디스크|전선형|초음파|ultrason|거리/i,'water'],
  [/진동|vibrat|가속|accel|g-?force|충격/i,'vibration'],
  [/공기|air|pm2|먼지|풍속|기류/i,'air'],
  [/토양|soil|수분/i,'soil'],
  [/제어|컨트롤|control|relay|릴레이|액추|automation|\b10\s?amp\b|\b30\s?amp\b/i,'control'],
  [/조도|light|밝기|일사|lux|par/i,'light'],
  [/기울|tilt|각도/i,'tilt'],
  [/배터리|battery|coin|코인|건전지|\baa\b|lithium|리튬/i,'battery'],
  [/전압|전류|voltage|current|vdc|vac|0-5|0-10|0-20|\dma\b|밀리암|계측|아날로그|analog/i,'electrical'],
  [/엣지|에지|\bedge\b/i,'edge'],
  [/모드버스|modbus|시리얼|serial/i,'gateway'],
  [/어댑터|adapter|전원|power|케이블|cable|프로그래밍|programmer/i,'power'],
  [/게이트웨이|gateway|\bgw\b|셀룰러|cellular|\blte\b|\b3g\b|\b4g\b|이더넷|ethernet|elte/i,'gateway'],
];
function prodIconKey(p, catId){
  var hay = (p.n||'') + ' ' + (p.g||'') + ' ' + (catId||'');
  for (var i=0;i<PROD_ICON_RULES.length;i++){ if (PROD_ICON_RULES[i][0].test(hay)) return PROD_ICON_RULES[i][1]; }
  if (catId==='software') return 'software';
  if (catId==='gateways') return 'gateway';
  if (catId==='accessories') return 'control';
  return 'sensor';
}
function _prodCard(p, catId){
  var label = p.p ? '데이터시트 →' : '제품 페이지 →';
  var svg = PROD_SVG[prodIconKey(p, catId)] || PROD_SVG.sensor;
  var _k = prodIconKey(p, catId);
  var _PHUE = {temperature:'red',humid:'blue',humidity:'blue',water:'blue',vibration:'violet',electrical:'amber',power:'amber',motion:'cyan',door:'green',contact:'green',gas:'teal',air:'teal',pressure:'violet',soil:'green',vehicle:'blue',control:'cyan',button:'pink',light:'amber',tilt:'violet',resistance:'amber',pulse:'cyan',software:'violet',cloud:'cyan',server:'blue',signal:'cyan',alarm:'pink',battery:'green',gateway:'blue',edge:'violet',sensor:'cyan'};
  var _hue = _PHUE[_k] || 'cyan';
  var ico = '<span class="prod-ico ic-'+_hue+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+svg+'</svg></span>';
  return '<a class="prod-card'+(p.p?' has-ds':'')+'" href="'+esc(p.u)+'" target="_blank" rel="noopener">'
    +   ico
    +   '<span class="prod-card-body"><h3>'+esc(p.n)+'</h3>'
    +   '<p>'+esc(p.d)+'</p>'
    +   '<span class="prod-ds">'+label+'</span></span>'
    + '</a>';
}
function renderProducts(){
  var root = document.getElementById('productsRoot');
  if (!root) return;
  var html = '';
  PRODUCT_CATS.forEach(function(cat){
    var items = PRODUCTS.filter(function(p){ return p.c === cat.id; });
    if (!items.length) return;
    html += '<section class="prod-cat" id="prodcat-'+cat.id+'" style="--cat:'+cat.color+'">';
    html += '<div class="prod-cat-head">'
          +   '<span class="prod-cat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+cat.icon+'</svg></span>'
          +   '<h2>'+esc(cat.ko)+'</h2><span class="prod-count">'+items.length+'</span>'
          + '</div>';
    if (cat.id === 'sensors'){
      SENSOR_GROUPS.forEach(function(g){
        var gi = items.filter(function(p){ return p.g === g.id; });
        if (!gi.length) return;
        html += '<div class="prod-group" style="--grp:'+g.color+'">';
        html += '<div class="prod-group-head"><span class="prod-grp-dot"></span>'+esc(g.ko)+'<span class="prod-grp-n">'+gi.length+'</span></div>';
        html += '<div class="prod-grid">'+gi.map(function(p){return _prodCard(p,cat.id);}).join('')+'</div>';
        html += '</div>';
      });
      var known = SENSOR_GROUPS.map(function(g){ return g.id; });
      var rest = items.filter(function(p){ return known.indexOf(p.g) < 0; });
      if (rest.length){
        html += '<div class="prod-group" style="--grp:#94A3B8">';
        html += '<div class="prod-group-head"><span class="prod-grp-dot"></span>기타<span class="prod-grp-n">'+rest.length+'</span></div>';
        html += '<div class="prod-grid">'+rest.map(function(p){return _prodCard(p,cat.id);}).join('')+'</div>';
        html += '</div>';
      }
    } else {
      html += '<div class="prod-grid">'+items.map(function(p){return _prodCard(p,cat.id);}).join('')+'</div>';
    }
    html += '</section>';
  });
  root.innerHTML = html;
}
function goToProductCat(catId){
  navigate('products');
  setTimeout(function(){ var el=document.getElementById('prodcat-'+catId); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 60);
}
document.querySelectorAll('[data-product-cat]').forEach(function(el){
  el.addEventListener('click', function(e){ e.preventDefault(); goToProductCat(el.dataset.productCat); });
});

/* ========== BOOT: 시트 로드 → 렌더 → 초기 라우팅 ========== */
/* 저장(편집기)과 사이트가 항상 같은 시트를 보도록, 저장 스크립트가 연결된 시트를 자동 감지.
   ?sheetId= 로 직접 지정했거나 저장 URL이 없으면 건너뜀. 한 번 확인되면 브라우저에 캐시. */
const SITE_GAS_URL = 'https://script.google.com/macros/s/AKfycbzkEN3DSGuoaZeQwgG0V7BgUe1a_UFIzAQWTCGGcI5SuxQXCQ2u6mBTg9Ed4axIa4jJLw/exec';
async function alignSheetToWriter(){
  try{
    const params = new URLSearchParams(location.search);
    if (params.get('sheetId')) return;                 // URL로 직접 지정 시 존중
    if (!SITE_GAS_URL) return;
    const ask = () => fetch(SITE_GAS_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'whoami'}) })
      .then(r=>r.json()).then(j=>{ if(j&&j.boundSheetId){ try{localStorage.setItem('monnit_writer_sheet', j.boundSheetId);}catch(e){} return j.boundSheetId; } return null; });
    let cached=null; try{ cached=localStorage.getItem('monnit_writer_sheet'); }catch(e){}
    if (cached){ CONTENT_SHEET.sheetId = cached; ask().catch(()=>{}); return; }  // 캐시 있으면 즉시 사용 + 백그라운드 갱신
    // 첫 방문만 잠깐 대기 (최대 3초, 실패/지연 시 기본 시트 사용)
    const sid = await Promise.race([ ask().catch(()=>null), new Promise(r=>setTimeout(()=>r(null),3000)) ]);
    if (sid) CONTENT_SHEET.sheetId = sid;
  }catch(e){ /* 실패 시 기본 sheetId 사용 */ }
}

async function boot() {
  await alignSheetToWriter();
  try { await loadSheetData(); }
  catch (e) { console.warn('[CONTENT_SHEET] 로드 중 오류 — 기본값 사용:', e); }
  renderData();
  renderHomeCatCards();
  renderHomeCases();
  renderAppsCategoryBar();
  renderAppsGrid();
  renderResources();
  renderProducts();
  if (window.MonnitI18N) window.MonnitI18N.refresh();
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

/* ===== Our Solution — interactive (calculator · dashboards · AI log) ===== */
(function(){
  function clk(){ var _lc=(document.documentElement.getAttribute('lang')==='en')?'en-US':'ko-KR'; var t=new Date().toLocaleTimeString(_lc,{hour12:false}); document.querySelectorAll('.dash-clock').forEach(function(e){e.textContent=t;}); }
  setInterval(clk,1000); clk();

  // tabs
  document.addEventListener('click', function(e){
    var b=e.target.closest('.soldash-tab'); if(!b) return;
    document.querySelectorAll('.soldash-tab').forEach(function(x){ x.classList.toggle('active', x===b); });
    var id=b.getAttribute('data-tab');
    document.querySelectorAll('.soldash-panel').forEach(function(p){ p.classList.toggle('active', p.id==='soldash-'+id); });
  });

  // SCUBE facility grid
  var grid=document.getElementById('facilityGrid');
  if(grid && !grid.children.length){
    var st=['normal','normal','normal','normal','normal','normal','normal','normal','normal','normal','warning','normal','normal','normal','normal','normal','normal','alert','normal','normal','normal','warning','normal','normal','offline','normal','normal','normal','normal','normal','normal','normal','warning','normal','normal','normal','normal','normal','alert','normal','normal','warning','normal','normal','normal','warning','normal','normal','offline','alert'];
    var lb=['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','V01','V02','V03','V04','V05','H01','H02','H03','H04','H05','C01','C02','C03','C04','C05','P01','P02','P03','P04','P05','E01','E02','E03','E04','E05','L01','L02','L03','L04','L05','W01','W02','W03','W04','W05','G01','G02','G03','G04','G05'];
    var tip={normal:'정상',warning:'주의',alert:'알림',offline:'오프라인'};
    st.forEach(function(s,i){ var c=document.createElement('div'); c.className='facility-cell '+s; c.textContent=lb[i]||'--'; c.title=tip[s]; grid.appendChild(c); });
  }

  // HVAC zones (16)
  var hz=document.getElementById('hvacZones');
  if(hz && !hz.children.length){
    var zt=[23.1,22.8,25.4,23.9,23.3,22.1,24.7,23.0,22.6,23.8,24.2,21.9,23.5,25.1,22.4,23.2];
    zt.forEach(function(v,i){ var d=document.createElement('div'); d.className='zone'+(v>=25?' hot':v<=22?' cool':''); d.innerHTML='<b>'+v.toFixed(1)+'</b><small>존 '+(i+1)+'</small>'; hz.appendChild(d); });
  }

  // === 진동 대시보드 실시간 스트리밍 (live status) ===
  (function(){
    var panel=document.getElementById('soldash-vib'); if(!panel) return;
    function on(){ return panel.classList.contains('active'); }
    function rnd(a,b){ return a+Math.random()*(b-a); }
    var lv=document.getElementById('vxLiveVal');
    var volt=document.getElementById('vxVolt'), amp=document.getElementById('vxAmp'), rpm=document.getElementById('vxRpm');
    var fleetBase=[4.12,2.84,2.10,1.33,0.91,0.67], fEl=[];
    for(var i=0;i<6;i++) fEl.push(document.getElementById('vxF'+(i+1)));
    var svg=panel.querySelector('.vx-chart svg'); if(!svg) return;
    var paths=[svg.querySelector('.vx-sp.s1'),svg.querySelector('.vx-sp.s2'),svg.querySelector('.vx-sp.s3'),svg.querySelector('.vx-sp.s4')];
    var N=130, base=288, L=18, R=982, xs=[];
    for(var i=0;i<N;i++) xs.push(+(L+(R-L)*i/(N-1)).toFixed(1));
    function envAmp(t){ if(t<0.16) return rnd(0.02,0.06); if(t<0.6) return rnd(0.05,0.16); if(t<0.82) return rnd(0.2,0.42); return rnd(0.55,0.98); }
    var buf=[[],[],[],[]];
    for(var i=0;i<N;i++){ var t=i/(N-1); for(var k=0;k<4;k++) buf[k].push(Math.min(envAmp(t)*(1-0.1*k)*rnd(0.7,1.15),1)); }
    function path(arr){ var d=''; for(var i=0;i<N;i++){ var y=base-arr[i]*(base-22); d+='M'+xs[i]+' '+base+'L'+xs[i]+' '+y.toFixed(1); } return d; }
    function draw(){ for(var k=0;k<4;k++) if(paths[k]) paths[k].setAttribute('d', path(buf[k])); }
    function nextCrit(k){ return Math.min(rnd(0.5,1.0)*(1-0.1*k)*rnd(0.7,1.2),1); }
    draw();
    function tick(){
      if(!on()) return;
      for(var k=0;k<4;k++){ buf[k].shift(); buf[k].push(nextCrit(k)); }
      draw();
      if(lv){ var v=rnd(0.66,1.05); if(Math.random()<0.15) v=rnd(1.1,1.55); lv.textContent=v.toFixed(2); lv.style.color = v>1.1 ? '#FF8190' : '#fff'; }
      if(volt) volt.textContent=rnd(381.2,384.4).toFixed(2);
      if(amp) amp.textContent=rnd(12.2,12.9).toFixed(2);
      if(rpm) rpm.textContent=(2950+Math.round(rnd(-14,14))).toLocaleString();
      for(var i=0;i<6;i++){ if(fEl[i]){ var jb=Math.max(0,fleetBase[i]+rnd(-0.04,0.05)); fEl[i].firstChild.nodeValue=jb.toFixed(2); } }
    }
    setInterval(tick, 850);
  })();

  // AI decision log (typing feed)
  var logEl=document.getElementById('aiLog');
  if(logEl){
    var lines=[
      ['AI_PRED','펌프 B-02 베어링 이상 패턴 → 점검 권고 D+7'],
      ['EDGE_CTL','3F-B04 댐퍼 +15% 명령 → BMS ACK'],
      ['ENERGY_OPT','야간 부하 예측 → AHU 78%→62% 조정'],
      ['ALERT_SEND','전기실 A 79.3°C → SMS 담당자 3명 발송'],
      ['PATROL_REQ','진동 이상 확정 → 패트롤 출동 등록']
    ], li=0;
    function pushLog(){
      var t=new Date().toLocaleTimeString((document.documentElement.getAttribute('lang')==='en')?'en-US':'ko-KR',{hour12:false});
      var l=lines[li%lines.length]; li++;
      var row=document.createElement('div'); row.className='ai-log-row';
      row.innerHTML='<span class="t">['+t+']</span> <span class="k">'+l[0]+'</span> '+l[1];
      logEl.appendChild(row);
      var rows=logEl.querySelectorAll('.ai-log-row'); if(rows.length>5) rows[0].remove();
    }
    for(var k=0;k<4;k++) pushLog();
    setInterval(pushLog, 3200);
  }

  // 언어 토글 시 라이브 시계·로그 타임스탬프를 즉시 해당 언어 형식으로 갱신
  window.addEventListener('monnit:langchange', function(){
    try { clk(); } catch(e){}
    try {
      if (logEl){
        var _lc=(document.documentElement.getAttribute('lang')==='en')?'en-US':'ko-KR';
        var _t=new Date().toLocaleTimeString(_lc,{hour12:false});
        logEl.querySelectorAll('.ai-log-row .t').forEach(function(s){ s.textContent='['+_t+']'; });
      }
    } catch(e){}
  });

  // Battery calculator
  var hb=5, rpb=1;
  var SENSOR_PROFILES={temp:{sleepuA:1.5,assessuA:180,txuA:14000,txMs:8,name:'온도 센서'},humid:{sleepuA:1.8,assessuA:210,txuA:14000,txMs:8,name:'온습도 센서'},open_close:{sleepuA:1.2,assessuA:160,txuA:14000,txMs:8,name:'도어/개폐'},motion:{sleepuA:3.5,assessuA:400,txuA:14000,txMs:8,name:'모션 감지'},water:{sleepuA:2.0,assessuA:200,txuA:14000,txMs:8,name:'누수 감지'},vib:{sleepuA:2.5,assessuA:800,txuA:15000,txMs:10,name:'진동 센서'},vib_adv:{sleepuA:2.8,assessuA:1200,txuA:15000,txMs:12,name:'진동 ADV'},current_20:{sleepuA:3.0,assessuA:600,txuA:14500,txMs:9,name:'전류계 20A'},current_150:{sleepuA:3.0,assessuA:620,txuA:14500,txMs:9,name:'전류계 150A'},current_500:{sleepuA:3.2,assessuA:650,txuA:14500,txMs:9,name:'전류계 500A'},accel:{sleepuA:2.2,assessuA:700,txuA:14000,txMs:8,name:'가속도계'},pressure_50:{sleepuA:2.5,assessuA:500,txuA:14000,txMs:8,name:'압력 50PSI'},pressure_300:{sleepuA:2.5,assessuA:520,txuA:14000,txMs:8,name:'압력 300PSI'},gas_co2:{sleepuA:8.0,assessuA:2500,txuA:15000,txMs:10,name:'가스 CO2'},gas_co:{sleepuA:7.5,assessuA:2200,txuA:15000,txMs:10,name:'가스 CO'},airvel:{sleepuA:3.0,assessuA:600,txuA:14000,txMs:8,name:'풍속'},ultrasonic:{sleepuA:4.0,assessuA:900,txuA:14500,txMs:9,name:'초음파'},volt_200:{sleepuA:2.8,assessuA:480,txuA:14000,txMs:8,name:'전압 200V'},volt_500:{sleepuA:3.0,assessuA:500,txuA:14000,txMs:8,name:'전압 500V'},pulse:{sleepuA:2.0,assessuA:300,txuA:14000,txMs:8,name:'펄스카운터'},dry_contact:{sleepuA:1.5,assessuA:180,txuA:14000,txMs:8,name:'Dry Contact'}};
  var BATTERY_MAH={'2AA_alk':3000,'2AA_li':3500,'coin':240,'industrial':5500,'2AAA':1200};
  var SIGNAL_MULT={good:1.0,medium:1.3,low:1.8};
  function gid(x){return document.getElementById(x);}
  document.addEventListener('click', function(e){
    var s=e.target.closest('[data-step]'); if(!s) return;
    var f=s.getAttribute('data-step'), d=+s.getAttribute('data-d');
    if(f==='hb'){ hb=Math.max(1,Math.min(120,hb+d)); if(gid('hbVal'))gid('hbVal').textContent=hb; }
    else { rpb=Math.max(1,Math.min(10,rpb+d)); if(gid('rpbVal'))gid('rpbVal').textContent=rpb; }
  });
  function calculate(){
    if(!gid('batteryType')) return;
    var p=SENSOR_PROFILES[gid('sensorType').value]||SENSOR_PROFILES.temp;
    var batmAh=BATTERY_MAH[gid('batteryType').value], sig=gid('signalCond').value, sigMult=SIGNAL_MULT[sig];
    var hbsPerDay=86400/(hb*60), txPerDay=hbsPerDay*rpb;
    var txSecs=(p.txMs/1000)*txPerDay*sigMult, assessSecs=0.05*hbsPerDay*rpb, sleepSecs=86400-txSecs-assessSecs;
    var sleepD=(p.sleepuA*Math.max(sleepSecs,0))/3.6e6, assessD=(p.assessuA*assessSecs)/3.6e6, agingD=batmAh*0.000005, txD=(p.txuA*(p.txMs/1000)*txPerDay*sigMult)/3.6e6;
    var K=15; sleepD*=K; assessD*=K; agingD*=K; txD*=K; /* 현실 보정: 온도~10년·진동~수년·CO2~1-2년 */
    var totD=sleepD+assessD+agingD+txD, days=Math.round(batmAh/(totD||0.01)), years=(days/365).toFixed(1), msgs=Math.round(txPerDay*days);
    gid('resYears').textContent=years; gid('resDays').textContent=days.toLocaleString();
    gid('resMsgs').textContent=msgs>1e6?(msgs/1e6).toFixed(1)+'M':msgs.toLocaleString();
    var tot=totD||1, segs=document.querySelectorAll('.power-seg');
    if(segs.length>=4){ segs[0].style.flex=(sleepD/tot*100).toFixed(1); segs[1].style.flex=(assessD/tot*100).toFixed(1); segs[2].style.flex=(agingD/tot*100).toFixed(1); segs[3].style.flex=(txD/tot*100).toFixed(1); }
    gid('legSleep').textContent=(sleepD*1000).toFixed(2)+'μAh/d'; gid('legAssess').textContent=(assessD*1000).toFixed(2)+'μAh/d';
    gid('legAging').textContent=(agingD*1000).toFixed(2)+'μAh/d'; gid('legTx').textContent=(txD*1000).toFixed(2)+'μAh/d';
    var sl={good:'양호',medium:'보통',low:'불량'}[sig];
    gid('calcNotes').innerHTML='▸ <b>'+p.name+'</b> · '+batmAh+'mAh · HB '+hb+'분 · '+rpb+'회/HB · 신호 '+sl+' (TX×'+sigMult+')<br>▸ 일 소비량 '+totD.toFixed(4)+' mAh → 예상 <b>'+years+'년</b> · 총 '+msgs.toLocaleString()+'회 전송<br>▸ 실제 수명은 온도·장애물·신호 환경에 따라 ±30% 변동 가능';
  }
  var go=gid('calcGo'); if(go){ go.addEventListener('click', calculate); calculate(); }
})();
