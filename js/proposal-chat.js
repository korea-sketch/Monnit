/* 맞춤 제안서 — 「대화로 신청」 탭 (2026-09-18)
 *
 * 화면은 대화만 맡고, 접수는 단계별 신청과 똑같이 /api/proposal 로 보냅니다.
 * 서버(/api/proposal/chat)가 기본 질문·답을 규칙으로 처리하고, 못 알아들을 때만 AI 를 씁니다.
 * 이 탭이 막혀도(점검 중·오류) 옆의 단계별 신청으로 바로 넘어갈 수 있습니다.
 */
(function (w, d) {
  'use strict';
  if (w.MKPropChat) return;

  var $ = function (id) { return d.getElementById(id); };
  var en = function () { try { return d.documentElement.getAttribute('lang') === 'en' || w.localStorage.getItem('mlang') === 'en'; } catch (e) { return d.documentElement.getAttribute('lang') === 'en'; } };
  var L = function (ko, e) { return en() ? e : ko; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ss = {
    get: function (k) { try { return w.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { w.sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { w.sessionStorage.removeItem(k); } catch (e) {} }
  };
  var push = function (ev, o) { try { (w.dataLayer = w.dataLayer || []).push(Object.assign({ event: ev }, o || {})); } catch (e) {} };

  var KEY = 'mk_prop_chat_v1';
  var FAC = [['factory', '공장·제조', 'Factory'], ['logistics', '물류·창고', 'Warehouse'], ['datacenter', '데이터센터', 'Data center'],
    ['commercial', '빌딩·상업시설', 'Building'], ['pharma', '병원·제약', 'Hospital / pharma'], ['food', '식품·외식', 'Food service'],
    ['agri', '농업·스마트팜', 'Farm'], ['energy', '에너지·발전', 'Energy'], ['construction', '건설 현장', 'Construction'],
    ['resident', '주거·숙박', 'Residential'], ['public', '공공·교육', 'Public'], ['etc', '그 외', 'Other']];
  var CON = [['fire', '화재·과열', 'Fire'], ['leak', '누수·침수·동파', 'Leaks'], ['temp', '온도·습도', 'Temperature'],
    ['cold', '냉장·콜드체인', 'Cold chain'], ['equip', '설비 고장·진동', 'Equipment'], ['power', '전력·에너지', 'Power'],
    ['air', '공기질·가스', 'Air quality'], ['security', '보안·출입', 'Security'], ['control', '통합관제·연동', 'Integration'],
    ['comply', '규정·기록', 'Compliance']];

  var S = { messages: [], fields: {}, ask: 'company', busy: false, T0: Date.now(), sent: false, retry: 0 };

  function save() { ss.set(KEY, JSON.stringify({ messages: S.messages.slice(-24), fields: S.fields, ask: S.ask })); }
  function load() {
    try {
      var o = JSON.parse(ss.get(KEY) || 'null');
      if (o && Array.isArray(o.messages)) { S.messages = o.messages; S.fields = o.fields || {}; S.ask = o.ask || 'company'; return true; }
    } catch (e) {}
    return false;
  }

  function bubble(role, text) {
    var el = d.createElement('div');
    el.className = 'pc-msg ' + (role === 'user' ? 'me' : 'bot');
    el.innerHTML = '<span>' + esc(text).replace(/\n/g, '<br>') + '</span>';
    $('pcLog').appendChild(el);
    $('pcLog').scrollTop = $('pcLog').scrollHeight;
    return el;
  }
  function typing(on) {
    var t = $('pcTyping');
    if (on && !t) {
      t = d.createElement('div'); t.id = 'pcTyping'; t.className = 'pc-msg bot pc-typing';
      t.innerHTML = '<span><i></i><i></i><i></i></span>';
      $('pcLog').appendChild(t); $('pcLog').scrollTop = $('pcLog').scrollHeight;
    } else if (!on && t) t.remove();
  }
  function note(text, action) {
    var n = $('pcNotice');
    n.hidden = !text;
    if (!text) { n.innerHTML = ''; return; }
    n.innerHTML = '<span>' + esc(text) + '</span>' + (action ? ' <button type="button" class="pc-link" id="pcToForm">' + L('단계별 신청으로 →', 'Use the step form →') + '</button>' : '');
    var b = $('pcToForm');
    if (b) b.addEventListener('click', function () { mode('form'); });
  }

  function chips(list) {
    var box = $('pcChips');
    box.innerHTML = '';
    if (!list || !list.length) { box.hidden = true; return; }
    box.hidden = false;
    list.forEach(function (c) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'pc-chip'; b.textContent = L(c[1], c[2]);
      b.addEventListener('click', function () { send(L(c[1], c[2])); });
      box.appendChild(b);
    });
  }

  /* 확인 카드 — 접수 직전에 무엇이 들어가는지 그대로 보여 준다 */
  function card(show) {
    var box = $('pcCard');
    if (!show) { box.hidden = true; box.innerHTML = ''; return; }
    var f = S.fields;
    var lab = function (list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return L(list[i][1], list[i][2]); return ''; };
    var row = function (k, v) { return v ? '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>' : ''; };
    box.hidden = false;
    box.innerHTML =
      '<p class="pc-card-h">' + L('이 내용으로 보내드릴까요?', 'Shall we send it with these details?') + '</p>' +
      '<dl class="pc-card-l">' +
        row(L('회사·시설', 'Company'), f.company) + row(L('받으실 분', 'Contact'), (f.name || '') + (f.title ? ' ' + f.title : '')) +
        row(L('이메일', 'Email'), f.email) + row(L('연락처', 'Phone'), f.phone) +
        row(L('현장', 'Site'), lab(FAC, f.fac)) + row(L('가장 고민되는 주제', 'Top concern'), lab(CON, f.con)) +
        row(L('시설 메모', 'Site note'), f.facility) +
      '</dl>' +
      '<label class="pc-agree"><input type="checkbox" id="pcAgree"><span><b>' + L('[필수]', '[Required]') + '</b> ' +
        L('맞춤 제안서 발송을 위해 회사명·성함·이메일·연락처를 이용하고 1년 뒤 파기하는 데 동의합니다.',
          'I agree to the use of my company, name, email and phone to send the proposal; deleted after one year.') +
        ' <a href="/privacy.html" target="_blank" rel="noopener">' + L('개인정보처리방침 보기', 'Privacy policy') + '</a></span></label>' +
      '<div class="pc-card-a"><button type="button" class="pc-go" id="pcSubmit">' + L('맞춤 제안서 받기 →', 'Get my proposal →') + '</button>' +
      '<button type="button" class="pc-link" id="pcEdit">' + L('고칠 게 있어요', 'I want to change something') + '</button></div>' +
      '<p class="pc-card-f" id="pcCardMsg" hidden></p>';
    $('pcSubmit').addEventListener('click', submit);
    $('pcEdit').addEventListener('click', function () {
      card(false);
      bubble('bot', L('어느 항목을 고칠까요? 바꾸실 내용을 적어 주세요.', 'Which detail should we change? Just type it.'));
      $('pcText').focus();
    });
  }

  function cardMsg(t) { var e = $('pcCardMsg'); if (!e) return; e.hidden = !t; e.textContent = t || ''; }

  function post(url, body, ms) {
    var ctrl = w.AbortController ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 20000);
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (x) { x.status = r.status; return x; }); })
      .then(function (x) { clearTimeout(tm); return x; }, function (e) { clearTimeout(tm); return { ok: false, status: 0 }; });
  }

  function send(text) {
    if (S.busy) return;
    text = String(text == null ? $('pcText').value : text).trim();
    if (!text) return;
    $('pcText').value = '';
    S.busy = true; $('pcSend').disabled = true;
    bubble('user', text);
    S.messages.push({ role: 'user', text: text.slice(0, 600) });
    chips(null); card(false); typing(true);
    push('proposal_chat_msg', { proposal_chat_turn: S.messages.filter(function (m) { return m.role === 'user'; }).length });
    post('/api/proposal/chat', {
      messages: S.messages.slice(-24), fields: S.fields, lang: en() ? 'en' : 'ko',
      elapsed: Date.now() - S.T0, website: $('pcWeb') ? $('pcWeb').value : '',
      /* 같은 항목을 몇 번 되물었는지 — 서버가 세어 돌려준다.
         규칙으로 알아들으면 서버가 이 값을 빼고 답하므로 여기서 0 으로 돌아간다. */
      retry: S.retry || 0
    }).then(function (x) {
      typing(false); S.busy = false; $('pcSend').disabled = false;
      if (!x || !x.ok) {
        bubble('bot', L('연결이 잠시 불안정합니다. 다시 한 번 보내 주시거나 옆의 단계별 신청으로 진행해 주세요.',
          'The connection is unstable. Please try again or use the step form.'));
        note(L('대화가 이어지지 않으면 단계별 신청으로 바꿔 주세요.', 'If the chat stalls, switch to the step form.'), true);
        return;
      }
      S.fields = x.fields || S.fields;
      S.ask = x.ask || S.ask;
      S.retry = Number(x.retry) || 0;
      if (x.reply) { bubble('bot', x.reply); S.messages.push({ role: 'assistant', text: x.reply }); }
      note(x.notice || (x.tooLong ? L('대화가 길어졌습니다. 단계별 신청이 더 빠릅니다.', 'This chat is long — the step form is quicker.') : ''), !!(x.notice || x.tooLong));
      if (x.ask === 'fac') chips(FAC);
      else if (x.ask === 'con') chips(CON);
      else chips(null);
      if (x.handoff) handoff();
      if (x.ask === 'done') card(true);
      if (x.confirmed && x.ask === 'done') { var a = $('pcAgree'); if (a) a.focus(); }
      save();
    });
  }

  /* 제안서 밖 요청 — 담당자에게 남긴다(원장·알림 메일은 사이트 공통 경로) */
  function handoff() {
    var f = S.fields;
    if (!f.email || S.handoffSent) return;
    S.handoffSent = true;
    try {
      if (!w.MonnitLead) return;
      w.MonnitLead.build('contact', 'proposal_chat', '대화 상담 요청 — ' + (f.company || ''), {
        '회사명': f.company || '', '담당자명': (f.name || '') + (f.title ? ' ' + f.title : ''), '이메일': f.email, '전화번호': f.phone || '',
        '관심분야': '맞춤 제안서 대화 상담', '접점': '대화로 신청',
        '문의 사항': S.messages.filter(function (m) { return m.role === 'user'; }).slice(-4).map(function (m) { return m.text; }).join(' / ').slice(0, 500)
      });
      w.MonnitLead.track('contact', { page: 'proposal_chat', interest: '맞춤 제안서 대화 상담' });
      push('proposal_chat_handoff');
    } catch (e) {}
  }

  function submit() {
    var a = $('pcAgree');
    if (!a || !a.checked) { cardMsg(L('개인정보 수집·이용에 동의해 주세요.', 'Please agree to the use of your information.')); if (a) a.focus(); return; }
    if (S.busy) return;
    S.busy = true;
    var btn = $('pcSubmit'); btn.disabled = true; btn.textContent = L('접수하는 중…', 'Submitting…');
    var f = S.fields;
    var body = {
      entry: 'chat', auto: true, company: f.company || '', name: f.name || '', title: f.title || '',
      email: f.email || '', phone: f.phone || '', fac: f.fac || '', con: f.con || '',
      facility: f.facility || '', industryText: f.industryText || '',
      memo: '[대화 신청] ' + S.messages.filter(function (m) { return m.role === 'user'; }).slice(-4).map(function (m) { return m.text; }).join(' / ').slice(0, 500),
      consent: true, consentMkt: false, elapsed: Date.now() - S.T0,
      source: w.MonnitLead ? w.MonnitLead.source() : '', landing: String(w.location.href).split('#')[0], referrer: d.referrer || ''
    };
    post('/api/proposal', body, 25000).then(function (x) {
      S.busy = false; btn.disabled = false; btn.textContent = L('맞춤 제안서 받기 →', 'Get my proposal →');
      if (x.status === 400 && x.fields) {
        var why = Object.keys(x.fields).map(function (k) { return x.fields[k]; }).join(' · ');
        cardMsg(why);
        card(false);
        bubble('bot', why + ' ' + L('다시 알려주시면 이어서 접수하겠습니다.', 'Please tell us again and we will continue.'));
        return;
      }
      if (!x.ok) { cardMsg(x.message || L('접수하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'We could not submit. Please try again shortly.')); return; }
      push('proposal_submit', { lead_type: 'custom_proposal', proposal_entry: 'chat', proposal_mode: x.mode || '', proposal_dup: x.dup ? 1 : 0 });
      S.sent = true; ss.del(KEY);
      card(false);
      bubble('bot', x.dup
        ? L('이미 신청하신 제안서가 있어 진행 화면 링크를 메일로 다시 보내드렸습니다.', 'You already have a proposal — we re-sent the status link by email.')
        : L('접수했습니다. 진행 화면으로 옮겨 드릴게요.', 'Received — taking you to the progress screen.'));
      setTimeout(function () {
        if (w.MKProposal && (x.token || x.dup)) w.MKProposal.goStatus(x);
        else bubble('bot', L('메일로 보내드리겠습니다. 감사합니다.', 'We will email it to you. Thank you.'));
      }, 700);
    });
  }

  /* 탭 전환 */
  function mode(which) {
    var chat = which === 'chat';
    var box = $('ppChat'), grid = d.querySelector('#ppRoot .mkp-grid');
    if (!box || !grid) return;
    box.hidden = !chat; grid.hidden = chat;
    var bf = $('ppModeForm'), bc = $('ppModeChat');
    if (bf) { bf.classList.toggle('on', !chat); bf.setAttribute('aria-selected', String(!chat)); }
    if (bc) { bc.classList.toggle('on', chat); bc.setAttribute('aria-selected', String(chat)); }
    ss.set('mk_prop_mode', which);
    if (chat) { start(); setTimeout(function () { var t = $('pcText'); if (t) t.focus({ preventScroll: true }); }, 120); }
    push('proposal_mode', { mode: which });
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    $('pcForm').addEventListener('submit', function (e) { e.preventDefault(); send(); });
    var had = load();
    if (had && S.messages.length) {
      S.messages.forEach(function (m) { bubble(m.role, m.text); });
      if (S.ask === 'fac') chips(FAC); else if (S.ask === 'con') chips(CON);
      if (S.ask === 'done') card(true);
      return;
    }
    typing(true);
    post('/api/proposal/chat', { messages: [], fields: {}, lang: en() ? 'en' : 'ko', elapsed: Date.now() - S.T0 }).then(function (x) {
      typing(false);
      var hello = (x && x.reply) || L('안녕하세요. 어느 회사(또는 시설) 현장이신가요?', 'Hello — which company or site is this for?');
      bubble('bot', hello);
      S.messages.push({ role: 'assistant', text: hello });
      if (x && x.notice) note(x.notice, true);
      save();
    });
  }

  function bind() {
    var bf = $('ppModeForm'), bc = $('ppModeChat');
    if (!bf || !bc || bf.dataset.bound) return;
    bf.dataset.bound = '1';
    bf.addEventListener('click', function () { mode('form'); });
    bc.addEventListener('click', function () { mode('chat'); });
    if (ss.get('mk_prop_mode') === 'chat') mode('chat');
  }

  w.MKPropChat = { bind: bind, mode: mode };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bind); else bind();
  w.addEventListener('monnit:view', bind);
})(window, document);
