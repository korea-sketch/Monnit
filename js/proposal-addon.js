/* 맞춤 제안서 애드온 — 백서·제안 자료 다운로드 폼에 「우리 현장 맞춤 제안서도 받기」를 붙인다.
 *
 * 쓰는 곳: /promo/modbus · /promo/proposal · /promo/temperature (프로모션 랜딩) · /whitepaper (사이트)
 * 자료 받기는 지금과 똑같이 그대로 진행하고, 고객이 선택한 경우에만 같은 입력값으로
 * /api/proposal (entry: whitepaper) 에 한 번 더 접수한다. 자료 전달은 이 접수의 성패와 무관하다.
 *
 *   var pa = MKPropAddon.mount(document.getElementById('slot'), {
 *     theme: 'light' | 'dark' | 'site',      // 페이지 색에 맞춤
 *     doc:   '무선센서 Modbus 연동 백서',       // 담당자 화면 「함께 받은 자료」
 *     fac:   'factory',                        // 기본 시설 유형 (홈 파인더 코드)
 *     con:   'control',                        // 기본 고민 (고객이 고르면 그쪽)
 *     page:  'promo_modbus'
 *   });
 *   if (!pa.check()) return;                   // 선택했는데 동의가 빠졌으면 false
 *   ... 자료 받기 ...
 *   pa.send({ company, name, email, phone }).then(function (x) { pa.result(x, box) });
 *
 * 애드온 입력칸은 form="mkpa-off" 로 바깥 폼에서 떼어 둔다 — 호스트 폼의 FormData·검증에 섞이지 않는다.
 * 보안: 진행 화면 토큰은 주소에 싣지 않고 이 탭 저장소(sessionStorage)에만 둔다(사이트 진행 화면과 같은 방식).
 */
(function (w, d) {
  'use strict';
  if (w.MKPropAddon) return;

  var en = function () { return (d.documentElement.getAttribute('lang') || '').toLowerCase() === 'en'; };
  var L = function (ko, e) { return en() ? e : ko; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ss = {
    get: function (k) { try { return w.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { w.sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { w.sessionStorage.removeItem(k); } catch (e) {} }
  };
  var push = function (ev, o) { try { (w.dataLayer = w.dataLayer || []).push(Object.assign({ event: ev }, o || {})); } catch (e) {} };

  /* 홈 솔루션 파인더와 같은 코드 — 서버(kb.mjs FINDER_FAC · FINDER_CON)가 해석한다 */
  var FAC = [
    ['factory', '공장·제조', 'Factory'], ['datacenter', '데이터센터·전산실', 'Data center'], ['commercial', '빌딩·상업시설', 'Commercial building'],
    ['logistics', '물류·창고', 'Logistics'], ['pharma', '병원·제약·바이오', 'Hospital / pharma'], ['food', '식품·외식', 'Food service'],
    ['energy', '에너지·발전', 'Energy'], ['public', '공공·교육', 'Public / education'], ['resident', '주거·아파트', 'Residential'],
    ['construction', '건설 현장', 'Construction'], ['agri', '농업·스마트팜', 'Agriculture'], ['etc', '그 외', 'Other']
  ];
  var CON = [
    ['fire', '화재·과열', 'Fire / overheating'], ['leak', '누수·침수·동파', 'Leaks / flooding'], ['temp', '온도·습도', 'Temperature / humidity'],
    ['cold', '냉장·콜드체인', 'Cold chain'], ['equip', '설비 고장·진동', 'Equipment failure'], ['power', '전력·에너지', 'Power / energy'],
    ['air', '공기질·가스', 'Air quality / gas'], ['security', '보안·출입', 'Security / access'], ['control', '통합관제·연동', 'Integration'],
    ['comply', '규정·온도기록', 'Compliance records']
  ];

  var CSS = '' +
    '.mkpa{--pa-ink:#16222E;--pa-mut:#5B6B7D;--pa-line:rgba(22,34,46,.16);--pa-bg:#fff;--pa-soft:rgba(17,104,173,.07);--pa-acc:#1168AD;--pa-on:#fff;--pa-ok:#0E7A55;--pa-warn:#9A5B0B;' +
    'margin:18px 0 0;font:inherit;color:var(--pa-ink);text-align:left}' +
    '.mkpa[data-theme=dark]{--pa-ink:#EEF3FA;--pa-mut:#9AA9BD;--pa-line:rgba(255,255,255,.16);--pa-bg:rgba(255,255,255,.03);--pa-soft:rgba(51,143,255,.12);--pa-acc:#4A9BFF;--pa-on:#fff;--pa-ok:#5FDDA0;--pa-warn:#EBC062}' +
    '.mkpa[data-theme=site]{--pa-ink:var(--ink,#EEF3FA);--pa-mut:var(--ink-soft,#9AA9BD);--pa-line:var(--line-strong,rgba(255,255,255,.16));--pa-bg:var(--bg,transparent);--pa-soft:var(--accent-soft,rgba(51,143,255,.12));--pa-acc:var(--accent,#4A9BFF);--pa-ok:#5FDDA0;--pa-warn:#EBC062}' +
    '.mkpa *{box-sizing:border-box}' +
    '.mkpa .mkpa-h{display:block;font-size:13px;font-weight:600;color:var(--pa-mut);margin:0 0 8px;letter-spacing:.01em}' +
    '.mkpa .mkpa-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0;padding:0;border:0}' +
    '.mkpa .mkpa-opt{position:relative;display:flex;gap:10px;align-items:center;min-height:62px;padding:11px 13px;border:1px solid var(--pa-line);border-radius:11px;background:var(--pa-bg);cursor:pointer;transition:border-color .15s,background-color .15s,box-shadow .15s,transform .12s;-webkit-tap-highlight-color:transparent}' +
    '.mkpa .mkpa-opt:hover{border-color:var(--pa-acc)}.mkpa .mkpa-opt:active{transform:scale(.985)}' +
    '.mkpa .mkpa-opt input{-webkit-appearance:none;appearance:none;flex:none;width:19px;height:19px;min-width:19px;margin:0;padding:0;border-radius:50%;border:1.5px solid var(--pa-line);background:transparent;cursor:pointer;box-shadow:none}' +
    '.mkpa .mkpa-opt input:checked{border-color:var(--pa-acc);box-shadow:inset 0 0 0 5px var(--pa-acc);background:#fff}' +
    '.mkpa .mkpa-opt:focus-within{box-shadow:0 0 0 3px var(--pa-soft)}' +
    '.mkpa .mkpa-opt.on{border-color:var(--pa-acc);background:var(--pa-soft);box-shadow:inset 0 0 0 1px var(--pa-acc)}' +
    '.mkpa .mkpa-opt b{display:block;font-size:14.5px;font-weight:700;color:var(--pa-ink);line-height:1.35}' +
    '.mkpa .mkpa-opt small{display:block;font-size:12px;color:var(--pa-mut);margin-top:2px;line-height:1.4}' +
    '.mkpa .mkpa-opt em{font-style:normal;display:inline-block;margin-left:4px;padding:1px 6px;border-radius:5px;font-size:10.5px;font-weight:700;letter-spacing:.02em;background:var(--pa-acc);color:var(--pa-on);vertical-align:1px}' +
    '.mkpa .mkpa-more{margin-top:12px;padding:14px;border:1px solid var(--pa-line);border-radius:11px;background:var(--pa-soft);animation:mkpaIn .28s ease both}' +
    '.mkpa .mkpa-more[hidden]{display:none}' +
    '.mkpa .mkpa-more p{margin:0 0 10px;font-size:12.5px;line-height:1.6;color:var(--pa-mut)}.mkpa .mkpa-more p b{color:var(--pa-ink)}' +
    '.mkpa .mkpa-lab{display:block;font-size:12.5px;font-weight:600;color:var(--pa-ink);margin:10px 0 6px}' +
    '.mkpa .mkpa-lab i{font-style:normal;font-weight:400;color:var(--pa-mut)}' +
    '.mkpa .mkpa-chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.mkpa .mkpa-chips button{font:inherit;font-size:12.5px;min-height:34px;padding:6px 11px;border-radius:100px;border:1px solid var(--pa-line);background:var(--pa-bg);color:var(--pa-ink);cursor:pointer;transition:border-color .15s,background-color .15s,transform .12s}' +
    '.mkpa .mkpa-chips button:hover{border-color:var(--pa-acc)}.mkpa .mkpa-chips button:active{transform:scale(.97)}' +
    '.mkpa .mkpa-chips button[aria-pressed=true]{border-color:var(--pa-acc);background:var(--pa-acc);color:var(--pa-on)}' +
    '.mkpa select.mkpa-in,.mkpa input.mkpa-in{width:100%;min-height:42px;padding:9px 12px;border:1px solid var(--pa-line);border-radius:9px;background:var(--pa-bg);color:var(--pa-ink);font:inherit;font-size:15px}' +
    '.mkpa select.mkpa-in:focus,.mkpa input.mkpa-in:focus{outline:none;border-color:var(--pa-acc);box-shadow:0 0 0 3px var(--pa-soft)}' +
    '.mkpa .mkpa-agree{display:flex;gap:9px;align-items:flex-start;margin:12px 0 0;font-size:12.5px;line-height:1.55;color:var(--pa-mut);cursor:pointer}' +
    '.mkpa .mkpa-agree input{flex:none;width:17px;height:17px;margin:2px 0 0;padding:0;accent-color:var(--pa-acc)}' +
    '.mkpa .mkpa-agree b{color:var(--pa-ink)}.mkpa .mkpa-agree a{color:var(--pa-acc);text-decoration:underline}' +
    '.mkpa .mkpa-agree.err{color:#C0392B}.mkpa .mkpa-agree.err b{color:#C0392B}' +
    '.mkpa .mkpa-chips button:focus-visible,.mkpa .mkpa-agree input:focus-visible,.mkpa.mkpa-res a:focus-visible{outline:2px solid var(--pa-acc);outline-offset:2px}' +
    '.mkpa.mkpa-res{margin-top:14px;padding:16px;border-radius:12px;border:1px solid var(--pa-acc);background:var(--pa-soft);text-align:left;animation:mkpaIn .3s ease both}' +
    '.mkpa.mkpa-res.is-warn{border-color:var(--pa-warn)}' +
    '.mkpa.mkpa-res .k{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:.08em;color:var(--pa-acc)}' +
    '.mkpa.mkpa-res.is-warn .k{color:var(--pa-warn)}' +
    '.mkpa.mkpa-res .k i{width:8px;height:8px;border-radius:50%;background:currentColor;animation:mkpaDot 1.8s ease-out infinite}' +
    '.mkpa.mkpa-res b.t{display:block;margin-top:6px;font-size:16px;color:var(--pa-ink);line-height:1.45}' +
    '.mkpa.mkpa-res p{margin:6px 0 0;font-size:13px;line-height:1.6;color:var(--pa-mut)}' +
    '.mkpa.mkpa-res .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
    '.mkpa.mkpa-res .acts a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:9px;font-size:14px;font-weight:700;text-decoration:none;transition:transform .12s,filter .15s}' +
    '.mkpa.mkpa-res .acts a:active{transform:scale(.98)}' +
    '.mkpa.mkpa-res .acts a.pri{background:var(--pa-acc);color:var(--pa-on)}.mkpa.mkpa-res .acts a.pri:hover{filter:brightness(1.08)}' +
    '.mkpa.mkpa-res .acts a.gho{border:1px solid var(--pa-line);color:var(--pa-ink);background:var(--pa-bg)}' +
    '@keyframes mkpaIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '@keyframes mkpaDot{0%{box-shadow:0 0 0 0 currentColor}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}' +
    '@media (max-width:560px){.mkpa .mkpa-seg{grid-template-columns:1fr}.mkpa.mkpa-res .acts a{flex:1 1 100%}}' +
    '@media (hover:none){.mkpa .mkpa-chips button{min-height:40px}}' +
    '@media (prefers-reduced-motion:reduce){.mkpa .mkpa-more,.mkpa.mkpa-res,.mkpa.mkpa-res .k i{animation:none}.mkpa .mkpa-opt,.mkpa .mkpa-chips button{transition:none}}';

  function style() {
    if (d.getElementById('mkpa-css')) return;
    var s = d.createElement('style'); s.id = 'mkpa-css'; s.textContent = CSS; d.head.appendChild(s);
  }

  var seq = 0;
  var val = function (v) { try { return String((typeof v === 'function' ? v() : v) || ''); } catch (e) { return ''; } };
  function mount(host, o) {
    if (!host) return null;
    o = o || {};
    style();
    var id = 'mkpa' + (++seq), T0 = Date.now();
    var root = d.createElement('div');
    root.className = 'mkpa'; root.setAttribute('data-theme', o.theme || 'light');
    var st = { con: '' };
    function render(keep) {
    var facOpts = FAC.map(function (f) { return '<option value="' + f[0] + '"' + (f[0] === (keep ? keep.fac : (typeof o.fac === 'string' ? o.fac : '')) ? ' selected' : '') + '>' + esc(L(f[1], f[2])) + '</option>'; }).join('');
    root.innerHTML =
      '<span class="mkpa-h" id="' + id + 'h">' + L('받으실 내용', 'What you’ll receive') + '</span>' +
      '<div class="mkpa-seg" role="radiogroup" aria-labelledby="' + id + 'h">' +
        '<label class="mkpa-opt on"><input type="radio" form="mkpa-off" name="' + id + '" value="doc" checked><span><b>' + L('자료만 받기', 'Just the document') + '</b><small>' + L('바로 다운로드 · 메일로도 링크', 'Instant download · link by email') + '</small></span></label>' +
        '<label class="mkpa-opt"><input type="radio" form="mkpa-off" name="' + id + '" value="prop"><span><b>' + L('우리 현장 맞춤 제안서도', 'Plus a proposal for my site') + '<em>' + L('무료', 'FREE') + '</em></b><small>' + L('몇 시간 이내 · 접수 순서대로 발송', 'Sent within hours, in order received') + '</small></span></label>' +
      '</div>' +
      '<div class="mkpa-more" hidden>' +
        '<p>' + L('입력하신 회사·현장에 맞춰 <b>Monnit 글로벌 레퍼런스와 산업별 플레이북</b>으로 만든 PDF 제안서를 따로 보내드립니다. 제안서는 <b>가장 고민되는 주제 하나</b>를 기준으로 깊게 정리합니다.',
                 'We’ll send a separate PDF proposal built for your company and site from <b>Monnit global references and industry playbooks</b>, focused on <b>your top concern</b>.') + '</p>' +
        '<label class="mkpa-lab" for="' + id + 'f">' + L('어떤 현장인가요?', 'What kind of site?') + ' <i>' + L('(선택)', '(optional)') + '</i></label>' +
        '<select class="mkpa-in" form="mkpa-off" id="' + id + 'f"><option value="">' + L('회사명으로 자동 판단', 'Detect from company name') + '</option>' + facOpts + '</select>' +
        '<span class="mkpa-lab" id="' + id + 'c">' + L('가장 고민되는 주제 하나', 'Your top concern') + ' <i>' + L('(선택)', '(optional)') + '</i></span>' +
        '<div class="mkpa-chips" role="radiogroup" aria-labelledby="' + id + 'c">' +
          CON.map(function (c) { return '<button type="button" data-c="' + c[0] + '" role="radio" aria-checked="false" aria-pressed="false">' + esc(L(c[1], c[2])) + '</button>'; }).join('') +
        '</div>' +
        '<label class="mkpa-lab" for="' + id + 's">' + L('시설 이름·유형', 'Site name / type') + ' <i>' + L('(선택)', '(optional)') + '</i></label>' +
        '<input class="mkpa-in" form="mkpa-off" id="' + id + 's" maxlength="60" placeholder="' + esc(L('예: 평택 2공장, 가산 IDC 3층', 'e.g. Plant 2, IDC 3F')) + '">' +
        '<label class="mkpa-agree"><input type="checkbox" form="mkpa-off"><span><b>' + L('[필수]', '[Required]') + '</b> ' +
          L('맞춤 제안서 발송을 위해 회사명·성함·이메일·연락처를 이용하고 1년 뒤 파기하는 데 동의합니다.', 'I agree to the use of my company, name, email and phone to send the proposal; deleted after one year.') +
          ' <a href="/privacy.html" target="_blank" rel="noopener">' + L('개인정보처리방침 보기', 'Privacy policy') + '</a></span></label>' +
      '</div>';
    if (keep) {
      if (keep.prop) { root.querySelector('input[value="prop"]').checked = true; root.querySelectorAll('.mkpa-opt')[0].classList.remove('on'); root.querySelectorAll('.mkpa-opt')[1].classList.add('on'); root.querySelector('.mkpa-more').hidden = false; }
      if (st.con) { var cb = root.querySelector('.mkpa-chips [data-c="' + st.con + '"]'); if (cb) { cb.setAttribute('aria-pressed', 'true'); cb.setAttribute('aria-checked', 'true'); } }
      root.querySelector('#' + id + 's').value = keep.site || '';
      root.querySelector('.mkpa-agree input').checked = !!keep.agree;
    }
    more = root.querySelector('.mkpa-more'); agree = root.querySelector('.mkpa-agree');
    }
    var more, agree;
    render(null);
    host.appendChild(root);
    /* 사이트 언어를 바꾸면 입력값은 두고 문구만 다시 그린다 */
    w.addEventListener('monnit:langchange', function () {
      if (!root.isConnected) return;
      render({ prop: wanted(), fac: root.querySelector('#' + id + 'f').value, site: root.querySelector('#' + id + 's').value, agree: agree.querySelector('input').checked });
    });
    root.addEventListener('change', function (e) {
      if (e.target.name === id) {
        [].forEach.call(root.querySelectorAll('.mkpa-opt'), function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
        more.hidden = !wanted();
        push('proposal_addon_toggle', { page: o.page || '', mode: wanted() ? 'proposal' : 'doc' });
        if (typeof o.onChange === 'function') o.onChange(wanted());
      }
      if (e.target === agree.querySelector('input')) agree.classList.remove('err');
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.mkpa-chips button'); if (!b) return;
      var on = b.getAttribute('aria-pressed') !== 'true';
      [].forEach.call(root.querySelectorAll('.mkpa-chips button'), function (x) { x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-checked', 'false'); });
      if (on) { b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-checked', 'true'); }
      st.con = on ? b.getAttribute('data-c') : '';
    });

    function wanted() { var r = root.querySelector('input[name="' + id + '"]:checked'); return !!r && r.value === 'prop'; }
    function check() {
      if (!wanted()) return true;
      var ok = agree.querySelector('input').checked;
      agree.classList.toggle('err', !ok);
      if (!ok) { try { agree.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} agree.querySelector('input').focus({ preventScroll: true }); }
      return ok;
    }

    function send(lead) {
      if (!wanted()) return Promise.resolve(null);
      var fac = root.querySelector('#' + id + 'f').value || val(o.fac);
      var doc = val(o.doc).slice(0, 60);
      var body = {
        entry: 'whitepaper', auto: true,
        company: lead.company || '', name: lead.name || '', title: lead.title || '', email: lead.email || '', phone: lead.phone || '',
        fac: fac, con: st.con || val(o.con),
        facility: root.querySelector('#' + id + 's').value.trim(),
        industryText: (val(o.industryText) || doc).slice(0, 40),
        memo: String([doc ? '[자료] ' + doc : '', lead.memo || ''].filter(Boolean).join(' · ')).slice(0, 600),
        doc: doc, consent: true, consentMkt: false,
        elapsed: (w.performance && performance.now) ? Math.round(performance.now()) : Date.now() - T0,   /* 페이지를 연 뒤 걸린 시간 — 3초 미만은 서버가 봇으로 본다 */
        source: (w.MonnitLead && w.MonnitLead.source) ? w.MonnitLead.source() : '',
        landing: String(w.location.href).split('#')[0], referrer: d.referrer || ''
      };
      var ctrl = w.AbortController ? new AbortController() : null;
      var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
      return fetch('/api/proposal', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (x) { x.status = r.status; return x; }); })
        .catch(function () { return { ok: false, status: 0 }; })
        .then(function (x) {
          clearTimeout(tm);
          if (x.ok && x.token) {
            ss.set('mk_prop_t', x.token); ss.set('mk_prop_new', x.token); ss.del('mk_prop_pill_off'); ss.del('mk_prop_back');
            try { if (typeof w.proposalPill === 'function') w.proposalPill(''); } catch (e) {}
          }
          if (x.ok) push('proposal_submit', { lead_type: 'custom_proposal', proposal_entry: 'whitepaper', proposal_page: o.page || '', proposal_mode: x.mode || '', proposal_dup: x.dup ? 1 : 0 });
          else push('proposal_submit_fail', { proposal_entry: 'whitepaper', proposal_page: o.page || '', status: x.status || 0 });
          x.company = lead.company; x.email = lead.email;
          return x;
        });
    }

    /* 결과 카드 — box 에 그린다(없으면 애드온 자리에) */
    function result(x, box) {
      if (!x) return;
      box = box || host;
      var old = box.querySelector('.mkpa-res'); if (old) old.remove();
      var el = d.createElement('div');
      el.setAttribute('role', 'status');
      el.setAttribute('data-theme', o.theme || 'light');
      var status = '/proposal/status', quote = '/contact?quote=scope';
      var html;
      if (x.ok && x.token) {
        el.className = 'mkpa mkpa-res';
        html = '<span class="k"><i aria-hidden="true"></i>' + L('맞춤 제안서 접수 · 순차 처리 중', 'CUSTOM PROPOSAL · IN PROGRESS') + '</span>' +
          '<b class="t">' + L(esc(x.company) + ' 현장 기준으로 제안서를 만들고 있습니다', 'We’re building a proposal for ' + esc(x.company)) + '</b>' +
          '<p>' + L('몇 시간 이내, 접수 순서대로 입력하신 메일로 보내드립니다. 진행 단계는 아래에서 바로 보실 수 있습니다.', 'It will arrive by email within a few hours, in the order received. You can follow each step below.') + '</p>' +
          '<div class="acts"><a class="pri" href="' + status + '" data-mkpa-go="proposal/status">' + L('진행 현황 보기 →', 'View progress →') + '</a></div>';
      } else if (x.ok && x.dup) {
        el.className = 'mkpa mkpa-res is-warn';
        html = '<span class="k"><i aria-hidden="true"></i>' + L('이미 신청하신 제안서가 있습니다', 'You already have a proposal') + '</span>' +
          '<b class="t">' + L('진행 화면 링크를 신청하신 메일로 다시 보냈습니다', 'We’ve re-sent the status link to your email') + '</b>' +
          '<p>' + L('무료 맞춤 제안서는 회사·이메일당 ' + (x.days || 30) + '일에 한 번입니다. 다른 과제나 현장 전체 구성·견적은 견적 요청으로 받아 보세요.', 'The free proposal is once every ' + (x.days || 30) + ' days per company. For other challenges or a full-site quote, send a quote request.') + '</p>' +
          '<div class="acts"><a class="gho" href="' + quote + '" data-mkpa-go="contact">' + L('견적 요청하기 →', 'Request a quote →') + '</a></div>';
      } else if (x.ok) {
        el.className = 'mkpa mkpa-res';
        html = '<span class="k"><i aria-hidden="true"></i>' + L('맞춤 제안서 접수', 'PROPOSAL RECEIVED') + '</span>' +
          '<b class="t">' + L('담당 엔지니어에게 전달했습니다', 'We’ve passed it to our engineer') + '</b>' +
          '<p>' + L('확인한 뒤 입력하신 메일로 보내드립니다.', 'We’ll email it after review.') + '</p>';
      } else if (x.cta) {
        el.className = 'mkpa mkpa-res';
        html = '<span class="k"><i aria-hidden="true"></i>' + L('무료 · 몇 시간 이내 발송', 'FREE · WITHIN HOURS') + '</span>' +
          '<b class="t">' + L('우리 현장에 맞춘 제안서도 받아 보세요', 'Get a proposal built for your site') + '</b>' +
          '<p>' + L('공통 자료 대신, 회사·현장과 가장 고민되는 주제 하나를 기준으로 Monnit 글로벌 레퍼런스와 산업별 플레이북을 대조해 PDF로 보내드립니다.', 'We match your site and top concern against Monnit global references and industry playbooks and email you a PDF.') + '</p>' +
          '<div class="acts"><a class="pri" href="/proposal" data-mkpa-go="proposal">' + L('맞춤 제안서 받기 →', 'Get my proposal →') + '</a></div>';
      } else {
        el.className = 'mkpa mkpa-res is-warn';
        /* 입력 오류면 칸별 안내, 접수 제한(429)·서버 오류면 서버가 준 안내문을 그대로 보여 준다 */
        var why = x.fields ? Object.keys(x.fields).map(function (k) { return x.fields[k]; }).join(' · ') : (!en() && x.message ? String(x.message) : '');
        html = '<span class="k"><i aria-hidden="true"></i>' + L('맞춤 제안서는 접수되지 않았습니다', 'Proposal not submitted') + '</span>' +
          '<b class="t">' + L('자료는 정상적으로 보내드렸습니다', 'Your document was delivered') + '</b>' +
          '<p>' + (why ? esc(why) + ' — ' : '') + L('맞춤 제안서 신청 화면에서 다시 신청하실 수 있습니다.', 'You can request the proposal again on the proposal page.') + '</p>' +
          '<div class="acts"><a class="gho" href="/proposal" data-mkpa-go="proposal">' + L('맞춤 제안서 신청하기 →', 'Request a proposal →') + '</a></div>';
      }
      el.innerHTML = html;
      box.appendChild(el);
      /* 사이트(SPA) 안이면 화면만 바꾼다 */
      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-mkpa-go]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
        push('proposal_addon_go', { to: a.getAttribute('data-mkpa-go'), page: o.page || '' });
        if (typeof w.navigate !== 'function' || !d.getElementById('view-proposal-status')) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        try { w.history.pushState({ route: a.getAttribute('data-mkpa-go') }, '', href); } catch (er) {}
        w.navigate(a.getAttribute('data-mkpa-go'));
      });
      return el;
    }

    function reset() {
      var r = root.querySelector('input[value="doc"]'); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      [].forEach.call(root.querySelectorAll('.mkpa-chips button'), function (x) { x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-checked', 'false'); });
      st.con = ''; root.querySelector('#' + id + 's').value = ''; agree.querySelector('input').checked = false;
    }

    /* 이미 정보를 남긴 방문자(폼 없이 자료만 다시 받는 경우) — 신청 화면으로 안내 */
    function cta(box) {
      box = box || host;
      if (!box || box.querySelector('.mkpa-res')) return;
      result({ ok: false, cta: true }, box);
    }

    return { el: root, wanted: wanted, check: check, send: send, result: result, reset: reset, cta: cta };
  }

  w.MKPropAddon = { mount: mount };
})(window, document);
