/*! Monnit Korea — 긴급 경보 알리미 랜딩 (/promo/alarm) 동작 스크립트 · 2026-10-02
 *
 *  예전: promo-alarm.html 이 app.js · style.css 옛 사본(약 850KB)을 통째로 품고
 *        홈 화면을 먼저 그린 뒤 프로모션 화면으로 바꿔 끼웠다.
 *  지금: 본문 HTML 은 페이지에 바로 들어 있고, 이 파일은 동작만 맡는다.
 *        · initEmergencyHero  스크롤 등장 · 알리미 모달 · 구독료 빌더 · 설치 사진
 *        · submitPromoApply   가입 신청 폼 → MonnitSend.sendLead (app.js 와 같은 전송 경로)
 */
function initEmergencyHero(){
  if (window.__viaHeroCleanup) window.__viaHeroCleanup();
  const hero = document.getElementById('viaEmergencyHero');
  if (!hero) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controller = new AbortController();
  const opt = { signal: controller.signal };
  const security = document.getElementById('tiSecuritySection');
  const alerts = document.getElementById('taAlertsSection');
  const reasons = document.getElementById('taReasonsSection');
  const perks = document.getElementById('taPerksSection');
  const builder = document.getElementById('taBuilderSection');
  let securityObserver = null;
  let alertsObserver = null;
  let reasonsObserver = null;
  let perksObserver = null;
  let builderObserver = null;
  let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty, raf = 0;
  const scrollToEmergencyApply = () => {
    const applySection = document.getElementById('emergencyApply');
    if(!applySection) return;
    applySection.scrollIntoView({behavior:'smooth',block:'start'});
    try { history.replaceState(history.state,'',location.pathname+location.search+'#emergencyApply'); } catch(e) {}
  };
  document.querySelectorAll('.ti-security__apply, .ta-builder-result__action a[href="#emergencyApply"]').forEach(link=>{
    link.addEventListener('click',event=>{
      event.preventDefault();
      scrollToEmergencyApply();
    },opt);
  });
  requestAnimationFrame(()=>requestAnimationFrame(()=>hero.classList.add('is-ready')));
  if (security){
    securityObserver = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
    securityObserver.observe(security);
  }
  if (alerts){
    alertsObserver = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    },{threshold:.14,rootMargin:'0px 0px -8% 0px'});
    alertsObserver.observe(alerts);
    const setActiveAlert = key => {
      alerts.dataset.activeAlert = key || '';
      alerts.querySelectorAll('[data-alert-key]').forEach(item=>item.classList.toggle('is-active',item.dataset.alertKey===key));
      alerts.querySelectorAll('[data-alert-card]').forEach(item=>item.classList.toggle('is-active',item.dataset.alertCard===key));
    };
    alerts.querySelectorAll('[data-alert-card]').forEach(card=>{
      card.addEventListener('pointerenter',()=>setActiveAlert(card.dataset.alertCard),opt);
      card.addEventListener('pointerleave',()=>setActiveAlert(''),opt);
      card.addEventListener('focus',()=>setActiveAlert(card.dataset.alertCard),opt);
      card.addEventListener('blur',()=>setActiveAlert(''),opt);
    });
    const alertModal = document.getElementById('taAlertModal');
    const alertModalData = {
      fire:{eyebrow:'화재 알리미',introImage:'/images/alarm/ta-modal-intro-fire.webp',introAlt:'화재 현장에서 대응 중인 소방관들',image:'/images/alarm/ta-alert-fire.webp',alt:'연기를 감지하는 천장형 화재 감지기',title:'화재 경보, 관리실에서만 확인하고 있나요?',descriptionHtml:'<span class="ta-alert-modal__body-copy">건물에는 이미 화재를 감지하는 소방 설비가 설치되어 있어요.<br><br>하지만 자동제어나 BMS 연동 여부는 건물마다 다르고, 경보가 관리실이나 수신반에서만 울리는 경우도 있어요.</span><strong class="ta-alert-modal__highlight">특히 담당자가 자리를 비운 야간·주말에는 소방 경보를 바로 확인하기 어려울 수 있어요!</strong><span class="ta-alert-modal__risk-list"><span><i aria-hidden="true">⚠</i>야간·주말 무인 시간대에 수신기 경보가 울렸지만, 아무도 몰랐던 경우</span><span><i aria-hidden="true">⚠</i>관리자가 잠시 자리를 비운 사이 초기 대응의 골든타임을 놓친 경우</span><span><i aria-hidden="true">⚠</i>한 명이 여러 건물을 관리해 순찰 공백이 생기는 경우</span></span>',secondTitle:'화재 알리미를 더하면 달라져요!',secondDescriptionHtml:'기존 화재 경보 신호를 감지해 담당자 휴대폰으로 즉시 알려줘요.<strong class="ta-alert-modal__highlight">관리실에 사람이 없어도 빠르게 상황을 확인하고 대응할 수 있어요.</strong>',cta:'소방 알리미 구독하기',stepsHtml:'<span><i>1</i>건물의 화재 수신기에 무선 센서를 연결합니다 <small>(배선 공사 없음)</small></span><span><i>2</i>수신기의 경보 신호를 감지하는 즉시 이상을 포착합니다</span><span><i>3</i>등록된 담당자 여러 명에게 동시에 문자 알림이 발송됩니다</span>'},
      flood:{eyebrow:'물감지 알리미',introImage:'/images/alarm/ta-modal-intro-flood.webp',introAlt:'누수로 물이 고인 기계실 배관 현장',image:'/images/alarm/ta-alert-flood.webp',alt:'물이 새는 배관과 천장 누수 현장',title:'누수·침수·동파, 미리 발견할 수는 없을까요?',descriptionHtml:'BMS가 있어도 모든 공간의 누수나 수위를 감지하는 건 아니에요.<strong class="ta-alert-modal__highlight">기계실, 배관, 집수정처럼 별도 감지 설비가 없는 곳은 물이 새거나 수위가 높아진 뒤에야 발견하는 경우가 많아요.</strong><span class="ta-alert-modal__risk-list"><span><i aria-hidden="true">⚠</i>집수정 펌프 고장을 모른 채 지하 기계실·전기실이 침수된 경우</span><span><i aria-hidden="true">⚠</i>새벽 배관 파열·겨울 동파를 아침 출근 후에야 발견한 경우</span></span>',secondTitle:'물감지 알리미를 더하면 달라져요!',secondDescriptionHtml:'필요한 위치의 누수와 수위 상태를 24시간 확인해요.<br><br>이상이 생기면 담당자에게 바로 알려주고, 집수정은 위험 수위에 도달하기 전에 미리 확인할 수도 있어요.<strong class="ta-alert-modal__closing">물이 넘친 뒤가 아니라, 넘치기 전에 대응할 수 있어요.</strong>',cta:'물감지 알리미 구독하기',stepsHtml:'<span><i>1</i>집수정·배관·바닥 등 취약 구역에 감지 로프/스팟 센서를 설치합니다</span><span><i>2</i>물이 닿는 순간 감지합니다 (배선 공사 없음)</span><span><i>3</i>등록된 담당자 여러 명에게 동시에 문자 알림이 발송됩니다</span>'},
      outage:{eyebrow:'정전 알리미',introImage:'/images/alarm/ta-modal-intro-outage.webp',introAlt:'정전으로 어두워진 건물 내부 복도',image:'/images/alarm/ta-alert-outage.webp',alt:'트립 상태를 감지하는 산업용 차단기',title:'차단기가 내려가도 바로 알기 어려울 수 있어요.',descriptionHtml:'모든 설비가 별도의 경보를 보내주는 건 아니에요.<br><br><span class="ta-alert-modal__inline-highlight">비상발전기가 바로 작동하면 겉으로는 정상처럼 보여</span><br class="ta-alert-modal__desktop-break"> 정전이나 차단기 트립이 언제 발생했는지 뒤늦게 알 수도 있어요.<span class="ta-alert-modal__risk-list"><span><i aria-hidden="true">⚠</i>냉동·냉장창고 정전을 뒤늦게 발견해 보관 재고를 폐기한 경우</span><span><i aria-hidden="true">⚠</i>차단기 트립으로 서버·생산설비가 조용히 멈춰 있던 경우</span><span><i aria-hidden="true">⚠</i>주말 무인 시설의 정전을 월요일 출근 후에야 알게 된 경우</span></span>',secondTitle:'트립 알리미를 더하면 달라져요!',secondDescriptionHtml:'언제 문제가 생겼고, 언제 정상으로 돌아왔는지 빠르게 확인할 수 있어요.<br><br>전원 상태를 24시간 확인해 <span class="ta-alert-modal__inline-highlight">차단기 트립이나 정전 발생 시 바로 알려줘요.<br class="ta-alert-modal__desktop-break"> 전원이 다시 들어오면 복전 상태까지 확인할 수 있어요!</span>',cta:'트립 알리미 구독하기',stepsHtml:'<span><i>1</i>분전반에 무선 감지 센서를 설치합니다</span><span><i>2</i>정전·트립 발생 즉시 감지합니다 (배선 공사 없음)</span><span><i>3</i>등록된 담당자 여러 명에게 동시에 문자 알림이 발송됩니다</span>'},
      equipment:{eyebrow:'경보 알리미',introImage:'/images/alarm/ta-modal-intro-equipment.webp',introAlt:'산업 시설 복도에서 붉게 점등된 설비 경광등',image:'/images/alarm/ta-alert-equipment.webp',alt:'설비 이상을 알리는 적색 경광등',title:'설비 경고등, 현장에 가야만 볼 수 있나요?',descriptionHtml:'보일러·펌프·제어반 등은 자체 경보가 있어도 해당 기계실이나 제어반에서만 표시되는 경우가 많아요.<strong class="ta-alert-modal__highlight">BMS가 있어도 담당자 휴대폰으로 별도 알림을 보내지 않는 경우가 대부분이고요.</strong><span class="ta-alert-modal__risk-list"><span><i aria-hidden="true">⚠</i>보일러 이상 정지로 난방·급탕이 끊긴 걸 민원 전화로 알게 된 경우</span><span><i aria-hidden="true">⚠</i>설비 경보가 울렸지만 몇 시간 뒤에야 발견해 고장이 커진 경우</span><span><i aria-hidden="true">⚠</i>장비마다 제각각인 경보를 한 곳에서 관리하지 못하는 경우</span></span>',secondTitle:'경보 알리미를 더하면 달라져요!',secondDescriptionHtml:'기존 설비의 경보 신호를 감지해 담당자 휴대폰으로 즉시 알려줘요. 보일러·펌프부터 수위 이상까지 다양한 설비의 이상을 현장에 가지 않고도 확인할 수 있어요.<strong class="ta-alert-modal__highlight">경보가 발생한 순간 바로 확인하고, 빠르게 대응할 수 있어요.</strong>',cta:'경보 알리미 구독하기',stepsHtml:'<span><i>1</i>기존 설비의 경보 신호(경광등·접점 출력)에 무선 센서를 연결합니다 <small>(배선 공사 없음)</small></span><span><i>2</i>등록된 담당자 여러 명에게 동시에 문자 알림이 발송됩니다 <small>(이력 확인 가능)</small></span>'}
    };
    const closeAlertModal = () => {
      if(!alertModal) return;
      if(typeof alertModal.close==='function' && alertModal.open) alertModal.close(); else alertModal.removeAttribute('open');
      document.documentElement.classList.remove('has-alert-modal');
    };
    const alertModalPanel = alertModal?.querySelector('.ta-alert-modal__panel');
    const updateAlertModalScroll = () => {
      if(!alertModal||!alertModalPanel) return;
      const max=Math.max(1,alertModalPanel.scrollHeight-alertModalPanel.clientHeight);
      const progress=Math.max(0,Math.min(1,alertModalPanel.scrollTop/max));
      alertModal.style.setProperty('--modal-progress',progress.toFixed(4));
      const center=alertModalPanel.getBoundingClientRect().top+alertModalPanel.clientHeight*.5;
      alertModal.querySelectorAll('.ta-alert-modal__block').forEach(block=>{
        const rect=block.getBoundingClientRect();
        block.classList.toggle('is-current',Math.abs((rect.top+rect.height*.5)-center)<alertModalPanel.clientHeight*.43);
      });
    };
    alertModalPanel?.addEventListener('scroll',updateAlertModalScroll,{passive:true,signal:controller.signal});
    alerts.querySelectorAll('[data-alert-open]').forEach(link=>{
      link.addEventListener('click',event=>{
        event.preventDefault();
        const data=alertModalData[link.dataset.alertOpen];
        if(!alertModal||!data) return;
        alertModal.dataset.alertType=link.dataset.alertOpen;
        const put=(selector,value)=>{const el=alertModal.querySelector(selector);if(el)el.textContent=value;};
        const putHtml=(selector,value)=>{const el=alertModal.querySelector(selector);if(el)el.innerHTML=value;};
        put('[data-alert-modal-eyebrow]',data.eyebrow);
        put('[data-alert-modal-title]',data.title);
        putHtml('[data-alert-modal-description]',data.descriptionHtml||data.description);
        put('[data-alert-modal-second-title]',data.secondTitle);
        putHtml('[data-alert-modal-second-description]',data.secondDescriptionHtml||data.secondDescription);
        put('[data-alert-modal-cta]',data.cta||'알리미 구독하기');
        const steps=alertModal.querySelector('[data-alert-modal-steps]');
        if(steps){steps.innerHTML=data.stepsHtml||'';steps.hidden=!data.stepsHtml;}
        const introImage=alertModal.querySelector('[data-alert-modal-intro-image]');
        if(introImage){introImage.src=data.introImage||'/images/alarm/ta-modal-intro-fire.webp';introImage.alt=data.introAlt||data.alt;}
        const image=alertModal.querySelector('[data-alert-modal-image]');
        if(image){image.src=data.image;image.alt=data.alt;}
        if(alertModalPanel) alertModalPanel.scrollTo({top:0,left:0,behavior:'auto'});
        alertModal.style.setProperty('--modal-progress','0');
        document.documentElement.classList.add('has-alert-modal');
        if(typeof alertModal.showModal==='function') alertModal.showModal(); else alertModal.setAttribute('open','');
        requestAnimationFrame(()=>{
          if(alertModalPanel) alertModalPanel.scrollTo({top:0,left:0,behavior:'auto'});
          alertModal.style.setProperty('--modal-progress','0');
          updateAlertModalScroll();
        });
      },opt);
    });
    alertModal?.querySelector('.ta-alert-modal__close')?.addEventListener('click',closeAlertModal,opt);
    alertModal?.addEventListener('click',closeAlertModal,opt);
    alertModal?.addEventListener('close',()=>document.documentElement.classList.remove('has-alert-modal'),opt);
    alertModal?.querySelector('.ta-alert-modal__cta')?.addEventListener('click',event=>{
      event.preventDefault();
      closeAlertModal();
      requestAnimationFrame(()=>requestAnimationFrame(scrollToEmergencyApply));
    },opt);
  }
  if (reasons){
    reasonsObserver = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    },{threshold:.14,rootMargin:'0px 0px -8% 0px'});
    reasons.querySelectorAll('.ta-reasons__title,.ta-reason').forEach(item=>reasonsObserver.observe(item));
  }
  if (perks){
    perksObserver = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    },{threshold:.22,rootMargin:'0px 0px -7% 0px'});
    perksObserver.observe(perks);
  }
  if (builder){
    builder.classList.add('is-motion-ready');
    if(reduce){
      builder.classList.add('is-visible');
    }else{
      builderObserver = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            entry.target.classList.add('is-visible');
            builderObserver.unobserve(entry.target);
          }
        });
      },{threshold:.08,rootMargin:'0px 0px -10% 0px'});
      builderObserver.observe(builder);
    }
  }
  const builderForm = document.getElementById('taBuilderForm');
  if (builderForm){
    const railEndEl = document.querySelector('.ta-builder-addon');
    let railTicking = false, lastProgress = -1, lastExtend = -1;
    const paintBuilderRail = () => {
      railTicking = false;
      const rect = builderForm.getBoundingClientRect();
      const endRect = railEndEl?.getBoundingClientRect();
      const endBottom = endRect?.bottom ?? rect.bottom;
      const extend = Math.max(0,endBottom-rect.bottom);
      const railHeight = Math.max(1,endBottom-rect.top);
      const travel = Math.max(1,railHeight-window.innerHeight);
      const progress = Math.max(0,Math.min(1,-rect.top/travel));
      if(Math.abs(extend-lastExtend)>0.5){ builderForm.style.setProperty('--builder-rail-extend',`${extend}px`); lastExtend = extend; }
      if(Math.abs(progress-lastProgress)>0.001){ builderForm.style.setProperty('--builder-progress',progress.toFixed(4)); lastProgress = progress; }
    };
    const updateBuilderRail = () => { if(railTicking) return; railTicking = true; requestAnimationFrame(paintBuilderRail); };
    window.addEventListener('scroll',updateBuilderRail,{passive:true,signal:controller.signal});
    window.addEventListener('resize',updateBuilderRail,{passive:true,signal:controller.signal});
    updateBuilderRail();
    const builderPreviewEl = document.querySelector('.ta-builder__preview');
    const carouselEl = document.getElementById('taBuilderCarousel');
    const carouselControlsEl = document.getElementById('taBuilderCarouselControls');
    const carouselDotsEl = document.getElementById('taBuilderCarouselDots');
    const planImageEl = document.getElementById('taBuilderPlanImage');
    const siteBirdsEl = document.getElementById('taBuilderSiteBirds');
    const siteCountEl = document.getElementById('taBuilderSiteCount');
    const unitEl = document.getElementById('taBuilderUnit');
    const builderAddon = document.querySelector('.ta-builder-addon');
    const resultImageEl = document.getElementById('taBuilderResultImage');
    const resultModelEl = document.getElementById('taBuilderResultModel');
    const resultPriceEl = document.getElementById('taBuilderResultPrice');
    const resultSitesEl = document.getElementById('taBuilderResultSites');
    const resultRegionEl = document.getElementById('taBuilderResultRegion');
    const resultConsultingEl = document.getElementById('taBuilderResultConsulting');
    const mobileInstallPanelEl = document.getElementById('taBuilderMobileInstall');
    const mobileInstallImageEl = document.getElementById('taBuilderMobileInstallImage');
    const mobileInstallOpenEl = document.getElementById('taBuilderMobileInstallOpen');
    const installModalEl = document.getElementById('taBuilderInstallModal');
    const installTrackEl = document.getElementById('taBuilderInstallTrack');
    const installDotsEl = document.getElementById('taBuilderInstallDots');
    const slidesByPlan = {
      fire:[
        {src:'/images/alarm/fire-installation-03.webp',alt:'제어반 내부에 설치된 화재 알리미 센서'},
        {src:'/images/alarm/fire-installation-01.webp',alt:'화재 알리미 설치 현장 1'},
        {src:'/images/alarm/fire-installation-02.webp',alt:'화재 수신반 내부에 설치된 알리미 센서'},
        {src:'/images/alarm/fire-installation-04.webp',alt:'소방 시설 제어반에 설치된 화재 알리미 센서'}
      ],
      water:[
        {src:'/images/alarm/water-installation-03.webp',alt:'물감지 알리미 설치 현장 3'},
        {src:'/images/alarm/water-installation-01.webp',alt:'물감지 알리미 설치 현장 1'},
        {src:'/images/alarm/water-installation-02.webp',alt:'물감지 알리미 설치 현장 2'},
        {src:'/images/alarm/water-installation-04.webp',alt:'물감지 알리미 설치 현장 4'}
      ],
      outage:[
        {src:'/images/alarm/outage-installation-01.webp',alt:'정전 알리미 설치 현장 1'},
        {src:'/images/alarm/outage-installation-02.webp',alt:'정전 알리미 설치 현장 2'},
        {src:'/images/alarm/outage-installation-03.webp',alt:'정전 알리미 설치 현장 3'},
        {src:'/images/alarm/outage-installation-04.webp',alt:'정전 알리미 설치 현장 4'}
      ],
      alarm:[
        {src:'/images/alarm/alarm-installation-01.webp',alt:'경보 알리미 설치 현장 1'},
        {src:'/images/alarm/alarm-installation-02.webp',alt:'경보 알리미 설치 현장 2'},
        {src:'/images/alarm/alarm-installation-03.webp',alt:'경보 알리미 설치 현장 3'}
      ]
    };
    let currentSlides = slidesByPlan.fire;
    let slideIndex = 0;
    let lastPlanValue = '';
    let expandedPlanValue = null;
    let suppressInstallClick = false;
    const syncCurrentSlides = () => {
      const selectedPlan = builderForm.querySelector('input[name="plan"]:checked');
      if(selectedPlan) currentSlides = slidesByPlan[selectedPlan.value] || [{src:selectedPlan.dataset.image,alt:`선택한 ${selectedPlan.dataset.label} 모델`}];
    };
    const syncInstallModalDots = () => {
      if(!installTrackEl||!installDotsEl) return;
      const index = Math.round(installTrackEl.scrollLeft/Math.max(1,installTrackEl.clientWidth));
      installDotsEl.querySelectorAll('i').forEach((dot,dotIndex)=>dot.classList.toggle('is-active',dotIndex===index));
    };
    const openInstallModal = () => {
      if(!installModalEl||!installTrackEl||!installDotsEl) return;
      syncCurrentSlides();
      installTrackEl.innerHTML = currentSlides.map((slide,i)=>`<img src="${slide.src}" alt="${slide.alt}" decoding="async" loading="${i?'lazy':'eager'}">`).join('');
      installDotsEl.innerHTML = currentSlides.map((_,index)=>`<i class="${index===0?'is-active':''}"></i>`).join('');
      installTrackEl.scrollLeft = 0;
      installModalEl.showModal();
    };
    mobileInstallOpenEl?.addEventListener('click',openInstallModal,opt);
    const openMobileInstallFor = (input,allowToggle) => {
      if(allowToggle&&expandedPlanValue===input.value&&mobileInstallPanelEl?.classList.contains('is-visible')){
        mobileInstallPanelEl.classList.remove('is-visible');
        expandedPlanValue = null;
        return;
      }
      const option = input.closest('.ta-builder__option');
      if(option&&mobileInstallPanelEl) option.insertAdjacentElement('afterend',mobileInstallPanelEl);
      mobileInstallPanelEl?.classList.add('is-visible');
      expandedPlanValue = input.value;
    };
    builderForm.querySelectorAll('input[name="plan"]').forEach(input=>{
      input.addEventListener('click',()=>openMobileInstallFor(input,true),opt);
      // 키보드(방향키)로 라디오를 옮기면 click 이 아니라 change 만 발생한다.
      input.addEventListener('change',()=>{ if(input.checked&&expandedPlanValue!==input.value) openMobileInstallFor(input,false); },opt);
    });
    installModalEl?.querySelector('.ta-builder-install-modal__close')?.addEventListener('click',()=>installModalEl.close(),opt);
    installModalEl?.addEventListener('click',event=>{
      if(installModalEl.open&&!event.target.closest('.ta-builder-install-modal__track')) installModalEl.close();
    },opt);
    installTrackEl?.addEventListener('click',()=>{
      if(!suppressInstallClick) installModalEl?.close();
    },opt);
    installTrackEl?.addEventListener('scroll',syncInstallModalDots,{passive:true,signal:controller.signal});
    if(installTrackEl){
      let dragStartX = 0;
      let dragStartScroll = 0;
      let dragging = false;
      installTrackEl.addEventListener('pointerdown',event=>{
        if(event.pointerType==='touch') return;
        dragging = true;
        suppressInstallClick = false;
        dragStartX = event.clientX;
        dragStartScroll = installTrackEl.scrollLeft;
        installTrackEl.classList.add('is-dragging');
        installTrackEl.setPointerCapture(event.pointerId);
      },opt);
      installTrackEl.addEventListener('pointermove',event=>{
        if(!dragging) return;
        if(Math.abs(event.clientX-dragStartX)>8) suppressInstallClick = true;
        installTrackEl.scrollLeft = dragStartScroll-(event.clientX-dragStartX);
      },opt);
      const finishInstallDrag = event=>{
        if(!dragging) return;
        dragging = false;
        installTrackEl.classList.remove('is-dragging');
        if(installTrackEl.hasPointerCapture(event.pointerId)) installTrackEl.releasePointerCapture(event.pointerId);
        const page = Math.round(installTrackEl.scrollLeft/Math.max(1,installTrackEl.clientWidth));
        installTrackEl.scrollTo({left:page*installTrackEl.clientWidth,behavior:'smooth'});
        if(suppressInstallClick) setTimeout(()=>{suppressInstallClick=false;},0);
      };
      installTrackEl.addEventListener('pointerup',finishInstallDrag,opt);
      installTrackEl.addEventListener('pointercancel',finishInstallDrag,opt);
      // 터치는 네이티브 스크롤에 맡기되, 스와이프 후 따라오는 click 으로 모달이 닫히지 않게 한다.
      let touchStartX = 0;
      installTrackEl.addEventListener('touchstart',event=>{ touchStartX = event.touches[0]?.clientX||0; },{passive:true,signal:controller.signal});
      installTrackEl.addEventListener('touchend',event=>{
        const endX = event.changedTouches[0]?.clientX||0;
        if(Math.abs(endX-touchStartX)>8){ suppressInstallClick = true; setTimeout(()=>{suppressInstallClick=false;},350); }
      },{passive:true,signal:controller.signal});
    }
    const renderCarouselDots = () => {
      if(!carouselDotsEl) return;
      carouselDotsEl.innerHTML = currentSlides.map((_,index)=>`<button type="button" class="ta-builder__carousel-dot${index===slideIndex?' is-active':''}" data-builder-dot="${index}" aria-label="${index+1}번째 이미지" aria-current="${index===slideIndex?'true':'false'}"></button>`).join('');
    };
    const renderSlide = () => {
      const slide = currentSlides[slideIndex];
      if(!slide||!planImageEl) return;
      planImageEl.src = slide.src;
      planImageEl.alt = slide.alt;
      carouselDotsEl?.querySelectorAll('.ta-builder__carousel-dot').forEach((dot,index)=>{
        const active = index===slideIndex;
        dot.classList.toggle('is-active',active);
        dot.setAttribute('aria-current',active?'true':'false');
      });
    };
    if(carouselDotsEl){
      carouselDotsEl.addEventListener('click',event=>{
        const dot = event.target.closest('[data-builder-dot]');
        if(!dot) return;
        syncCurrentSlides();
        slideIndex = Number(dot.dataset.builderDot)||0;
        renderSlide();
      },opt);
    }
    carouselControlsEl?.querySelectorAll('[data-builder-slide]').forEach(button=>{
      button.addEventListener('click',()=>{
        syncCurrentSlides();
        slideIndex = (slideIndex+Number(button.dataset.builderSlide)+currentSlides.length)%currentSlides.length;
        renderSlide();
      },opt);
    });
    const updateBuilder = () => {
      const plan = builderForm.querySelector('input[name="plan"]:checked');
      const region = builderForm.querySelector('input[name="region"]:checked');
      const consulting = document.querySelector('input[name="consulting"]:checked');
      if(!plan||!region||!siteCountEl) return;
      const count = Math.max(1,Math.min(10,Math.round(Number(siteCountEl.value)||1)));
      siteCountEl.value = count;
      const isQuote = count>=10;
      const unit = count>=5 ? 25000 : 30000;
      unitEl.textContent = isQuote ? '10곳 이상 · 별도 견적' : `월 단가 ${unit.toLocaleString('ko-KR')}원`;
      if(planImageEl){
        const hasPhotoSlides = plan.value==='fire'||plan.value==='water'||plan.value==='outage'||plan.value==='alarm';
        carouselEl?.classList.toggle('is-product',!hasPhotoSlides);
        builderPreviewEl?.classList.toggle('has-fire-carousel',hasPhotoSlides);
        if(carouselControlsEl) carouselControlsEl.hidden = (slidesByPlan[plan.value]||[]).length < 2;
        if(lastPlanValue!==plan.value){
          currentSlides = slidesByPlan[plan.value] || [{src:plan.dataset.image,alt:`선택한 ${plan.dataset.label} 모델`}];
          slideIndex = 0;
          renderCarouselDots();
        }
        if(mobileInstallImageEl&&currentSlides[0]){
          mobileInstallImageEl.src = currentSlides[0].src;
          mobileInstallImageEl.alt = `${plan.dataset.label} 첫 번째 설치 현장`;
        }
        planImageEl.dataset.plan = plan.value;
        renderSlide();
        lastPlanValue = plan.value;
      }
      if(siteBirdsEl){
        siteBirdsEl.innerHTML = Array.from({length:count},()=>'<img src="/images/alarm/ta-site-birds.webp" alt="">').join('');
      }
      if(resultImageEl){
        resultImageEl.src = plan.dataset.image;
        resultImageEl.alt = `선택한 ${plan.dataset.label}`;
      }
      if(resultModelEl) resultModelEl.textContent = plan.dataset.label;
      if(resultPriceEl){
        const installation = region.value==='metro' ? '설치비 무료' : '설치비 별도 상담';
        resultPriceEl.textContent = isQuote ? `별도 견적 · ${installation}` : `월 ${(unit*count).toLocaleString('ko-KR')}원 · ${installation}`;
      }
      if(resultSitesEl) resultSitesEl.textContent = `${count}곳`;
      if(resultRegionEl) resultRegionEl.textContent = region.dataset.label;
      if(resultConsultingEl) resultConsultingEl.textContent = consulting?.value==='installation-only' ? '설치만 진행' : '무료 현장 컨설팅 요청';
    };
    builderForm.addEventListener('change',updateBuilder,opt);
    builderAddon?.addEventListener('change',updateBuilder,opt);
    siteCountEl.addEventListener('input',updateBuilder,opt);
    builderForm.querySelectorAll('[data-site-delta]').forEach(button=>{
      button.addEventListener('click',()=>{
        siteCountEl.value=Math.max(1,Math.min(10,(Number(siteCountEl.value)||1)+Number(button.dataset.siteDelta)));
        updateBuilder();
      },opt);
    });
    updateBuilder();
  }
  const render = () => {
    cx += (tx - cx) * .11; cy += (ty - cy) * .11;
    hero.style.setProperty('--mx', ((cx / Math.max(innerWidth,1)) * 2 - 1).toFixed(3));
    hero.style.setProperty('--my', ((cy / Math.max(innerHeight,1)) * 2 - 1).toFixed(3));
    raf = requestAnimationFrame(render);
  };
  if (!reduce && matchMedia('(pointer:fine)').matches){
    hero.addEventListener('pointermove', e => { tx=e.clientX; ty=e.clientY; hero.classList.add('has-pointer'); }, opt);
    hero.addEventListener('pointerleave', () => hero.classList.remove('has-pointer'), opt);
    render();
  }
  let ticking=false, snapTimer=0, lastHeroScrollY=scrollY;
  const onScroll=()=>{
    const currentScrollY=scrollY;
    if(currentScrollY>lastHeroScrollY+4 && currentScrollY>30) hero.classList.add('is-nav-hidden');
    else if(currentScrollY<lastHeroScrollY-4) hero.classList.remove('is-nav-hidden');
    lastHeroScrollY=currentScrollY;
    if(ticking||reduce)return; ticking=true;
    requestAnimationFrame(()=>{
      const r=hero.getBoundingClientRect();
      const progress=Math.max(0,Math.min(1,-r.top/Math.max(r.height,1)));
      hero.style.setProperty('--scroll',progress.toFixed(3));
      if(security){
        const sr=security.getBoundingClientRect();
        const sp=Math.max(0,Math.min(1,(innerHeight-sr.top)/Math.max(innerHeight+sr.height,1)));
        security.style.setProperty('--section-progress',sp.toFixed(3));
      }
      clearTimeout(snapTimer);
      const local=-r.top, vh=Math.max(innerHeight,1);
      if(local>vh*.12 && local<vh*.88){
        snapTimer=setTimeout(()=>{
          const now=hero.getBoundingClientRect();
          const base=scrollY+now.top;
          const current=-now.top;
          scrollTo({top:base+(current<vh*.5?0:vh),behavior:'smooth'});
        },170);
      }
      ticking=false;
    });
  };
  addEventListener('scroll',onScroll,{passive:true,signal:controller.signal}); onScroll();
  window.__viaHeroCleanup=()=>{controller.abort();cancelAnimationFrame(raf);clearTimeout(snapTimer);if(securityObserver)securityObserver.disconnect();if(alertsObserver)alertsObserver.disconnect();if(reasonsObserver)reasonsObserver.disconnect();if(perksObserver)perksObserver.disconnect();if(builderObserver)builderObserver.disconnect();window.__viaHeroCleanup=null;};
}

async function submitPromoApply(e){
  /* 전송은 공통 모듈(js/monnit-send.js) — 메인 사이트 app.js 와 같은 경로 */
  const sendLead = (window.MonnitSend && window.MonnitSend.sendLead) || (async () => false);
  e.preventDefault();
  const form = e.currentTarget || e.target;
  const field = (key, fallbackId) => ((form?.querySelector?.(`[data-paf="${key}"]`) || document.getElementById(fallbackId))?.value || '').trim();
  const promo = field('promo','pafPromo'), name = field('name','pafName'), company = field('company','pafCompany');
  const phone = field('phone','pafPhone'), email = field('email','pafEmail'), memo = field('memo','pafMemo');
  const models = Array.from(form?.querySelectorAll?.('input[name="alertModel"]:checked') || []).map(input=>input.value);
  const facility = field('facility'), region = field('region');
  const status = form?.querySelector?.('[data-paf-status]') || document.getElementById('pafStatus');
  const btn = form?.querySelector?.('[data-paf-submit]') || document.getElementById('pafSubmit');
  if (!promo || !name || !company || !phone || !models.length){
    if (status){ status.textContent = '필수 항목(*)을 모두 입력해 주세요.'; status.className = 'paf-status err'; }
    return false;
  }
  const payload = {
    _subject: '[프로모션 사전신청] ' + promo + ' — ' + company,
    '신청 프로모션': promo,
    '이름/직급': name,
    '회사명': company,
    '전화번호': phone,
    /* 이메일은 선택 항목 — 비워 두면 키를 넣지 않는다.
       '(미기재)' 를 넣으면 sendLead 의 형식 검사가 이메일 오류로 막는다. */
    ...(email ? { '이메일': email } : {}),
    '알리미 모델': models.join(', '),
    '시설 유형': facility || '(미기재)',
    '시설 지역': region || '(미기재)',
    [promo === '긴급 경보 알리미 상시 프로모션' ? '문의 사항 및 희망 수량' : '문의 사항']: memo || '(없음)',
    '접수 경로': '프로모션 사전신청'
  };
  if (status){ status.textContent = ''; status.className = 'paf-status'; }
  /* 연락처·이메일 형식은 보내기 전에 여기서 확인한다 (2026-10-02).
     sendLead 의 마지막 방어선에 맡기면 알림창 뒤에 「전송에 실패했습니다」가 함께 떠서
     입력 실수인데 서버 장애처럼 보였다. */
  try {
    const V = window.MonnitValid;
    if (V) {
      const bad = (key, r) => {
        if (status){ status.textContent = r.message || '입력 내용을 다시 확인해 주세요.'; status.className = 'paf-status err'; }
        const el = form?.querySelector?.(`[data-paf="${key}"]`); if (el) { try { el.focus(); } catch(e){} }
        return false;
      };
      const rp = V.phone(phone); if (!rp.ok) return bad('phone', rp);
      if (email) { const re = V.email(email); if (!re.ok) return bad('email', re); }
    }
  } catch(e){}
  const leadPayload = window.MonnitLead
    ? window.MonnitLead.build('contact', 'promo_apply', promo + ' 사전신청 — ' + company, payload)
    : Object.assign(payload, { _subject: '[모넷·접수] ' + promo + ' 사전신청 — ' + company });
  const result = await sendLead(leadPayload, btn);
  if (result === true && window.MonnitLead)
    window.MonnitLead.track('contact', { page:'promo_apply', interest:promo });
  if (result === true){
    if (status){ status.textContent = '✓ 신청이 접수되었습니다. 담당자가 곧 연락드립니다.'; status.className = 'paf-status ok'; }
    form?.reset?.();
  } else if (result === 'mailto'){
    if (status){ status.textContent = '메일 앱으로 신청 내용을 작성합니다. 전송 버튼을 눌러 완료해 주세요.'; status.className = 'paf-status'; }
  } else {
    if (status){ status.textContent = '전송에 실패했습니다. 잠시 후 다시 시도하거나 korea@monnit.com 으로 연락 주세요.'; status.className = 'paf-status err'; }
  }
  return false;
}

(function(){
  function boot(){ try { initEmergencyHero(); } catch(e){ console.warn('[alarm]', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  /* 주소에 #emergencyApply 가 붙어 들어오면 신청 폼으로 */
  window.addEventListener('load', function(){
    if (location.hash === '#emergencyApply') {
      var el = document.getElementById('emergencyApply');
      if (el) setTimeout(function(){ el.scrollIntoView({block:'start'}); }, 60);
    }
  });
})();
