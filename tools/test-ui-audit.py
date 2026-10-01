# 대화로 신청 + 관제 정지 화면 — 환경 교차 실측 (2026-09-19)
#   데스크톱 1440/1280 · 모바일 375 · 태블릿 768 × 한국어/영어 × 밝음/어두움
#   상태: 첫 인사 · 규칙 진행 · 점검 중(paused) · 서버 500 · 시간 초과 · 담당자 연결 · 키보드 · 관제 팝업(Esc·포커스)
# 실행: netlify dev 띄운 뒤  python3 tools/test-ui-audit.py
import asyncio, json, os, sys
from playwright.async_api import async_playwright

B = os.environ.get('SITE', 'http://localhost:8888')
NOTICE_KO = 'AI 상담은 잠시 점검 중입니다. 아래 단계별 신청으로 진행해 주시면 제안서는 평소대로 보내드립니다.'
NOTICE_EN = 'AI chat is under maintenance. Please use the step form below — proposals are sent as usual.'
HALT = {'at': '2026-09-19T01:20:00.000Z', 'reason': 'quota-exceeded', 'provider': 'gemini', 'model': 'gemini-3.5-flash-lite', 'status': 429, 'message': 'You exceeded your current quota', 'notified': True}

ENVS = [
    ('데스크톱 1440', (1440, 900), 1, False, 'dark', 'ko'),
    ('데스크톱 1280 밝음', (1280, 800), 1, False, 'light', 'ko'),
    ('데스크톱 영어', (1280, 800), 1, False, 'dark', 'en'),
    ('모바일 375', (375, 667), 2, True, 'dark', 'ko'),
    ('모바일 375 영어', (375, 812), 3, True, 'light', 'en'),
    ('태블릿 768', (768, 1024), 2, True, 'dark', 'ko'),
]

async def main():
    fails = 0
    def ok(n, c, g=''):
        nonlocal fails
        print(('ok   ' if c else 'FAIL ') + n + ('' if c else '  ' + str(g)[:220]))
        if not c: fails += 1
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for name, vp, scale, mobile, scheme, lang in ENVS:
            ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile, color_scheme=scheme, locale='en-US' if lang == 'en' else 'ko-KR')
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            if lang == 'en':
                await pg.add_init_script("try{localStorage.setItem('mlang','en')}catch(e){}")
            # 서버 응답에 상태를 덧씌우는 라우터 — mode 를 바꿔 가며 같은 화면을 검사
            state = {'mode': 'normal'}
            async def chat_route(route):
                m = state['mode']
                if m == '500': return await route.fulfill(status=500, content_type='application/json', body='{"ok":false}')
                if m == 'timeout': await asyncio.sleep(21); return await route.abort()
                r = await route.fetch(); j = await r.json()
                if m == 'paused': j['paused'] = True; j['notice'] = NOTICE_EN if lang == 'en' else NOTICE_KO
                await route.fulfill(response=r, body=json.dumps(j), headers={**r.headers, 'content-type': 'application/json'})
            await pg.route('**/api/proposal/chat', chat_route)
            await pg.goto(B + '/proposal', wait_until='load'); await pg.wait_for_timeout(1200)
            for t in ['text=쿠키 거부', 'text=Reject all', 'text=Decline']:
                try: await pg.click(t, timeout=800); break
                except Exception: pass
            tap = pg.tap if mobile else pg.click
            await tap('#ppModeChat'); await pg.wait_for_timeout(2000)
            r = await pg.evaluate("""()=>{const d=document.documentElement;const inp=document.getElementById('pcText');const cs=getComputedStyle(inp);const bar=document.getElementById('ppBar');
              const bot=document.querySelector('.pc-msg.bot span');const bc=bot&&getComputedStyle(bot);
              return {scrollW:d.scrollWidth,clientW:d.clientWidth,hello:bot&&bot.textContent.slice(0,40),font:parseFloat(cs.fontSize),barHidden:getComputedStyle(bar).display==='none',
                state:!!(document.getElementById('pcState')&&!document.getElementById('pcState').hidden),
                botColor:bc&&bc.color,botBg:bc&&bc.backgroundColor,placeholder:inp.placeholder}}""")
            ok(f'[{name}] 첫 인사 · 넘침 없음 · 정상 상태에선 띠 없음 · 하단 고정 버튼 숨김', r['hello'] and r['scrollW'] <= r['clientW'] + 1 and not r['state'] and r['barHidden'], r)
            ok(f'[{name}] 언어 — 첫 인사가 화면 언어', (('Hello' in r['hello'] or 'company' in r['hello'].lower()) if lang == 'en' else '안녕' in r['hello']), r['hello'])
            ok(f'[{name}] 입력창 16px(iOS 확대 방지)', r['font'] >= 16, r['font'])
            # 규칙 진행 — 회사 → 성함 → 이메일
            for txt in (['Nuri F&B', 'Kim Daehwa, manager', 'kim@nuri-fnb.co.kr'] if lang == 'en' else ['누리에프앤비', '김대화 팀장', 'kim@nuri-fnb.co.kr']):
                await pg.fill('#pcText', txt); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(1500)
            r2 = await pg.evaluate("()=>({bots:document.querySelectorAll('.pc-msg.bot').length, chips:document.querySelectorAll('.pc-chip').length, scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth})")
            ok(f'[{name}] 규칙 3턴 뒤 현장 선택 칩 · 넘침 없음', r2['bots'] >= 4 and r2['chips'] >= 10 and r2['scrollW'] <= r2['clientW'] + 1, r2)
            # 칩 터치 목표
            r3 = await pg.evaluate("()=>Math.min(...[...document.querySelectorAll('.pc-chip')].map(c=>c.getBoundingClientRect().height))")
            ok(f'[{name}] 칩 높이 36px 이상', r3 >= 36, r3)
            # 점검 중
            state['mode'] = 'paused'
            await pg.fill('#pcText', 'x'); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(1500)
            r4 = await pg.evaluate("""()=>{const st=document.getElementById('pcState');const n=document.getElementById('pcNotice');const em=document.querySelector('#ppModeChat em');const b=document.getElementById('pcToForm');
              return {state:st&&!st.hidden?st.textContent:'',notice:n&&!n.hidden?n.textContent:'',tab:em&&em.textContent,btn:!!b,inputOn:!document.getElementById('pcText').disabled,
                stateRole:st&&st.getAttribute('role'),stateW:st&&st.getBoundingClientRect().width,vw:innerWidth}}""")
            exp_state = 'maintenance' if lang == 'en' else '점검 중'
            ok(f'[{name}] 점검 중 — 띠(role=status)·안내·탭 표시·전환 버튼, 입력은 살아 있음, 언어 맞음', exp_state in r4['state'] and (('maintenance' in r4['notice']) if lang == 'en' else ('점검 중' in r4['notice'])) and r4['tab'] == ('Maintenance' if lang == 'en' else '점검 중') and r4['btn'] and r4['inputOn'] and r4['stateRole'] == 'status' and r4['stateW'] <= r4['vw'], r4)
            # 새로고침 유지 → 풀림
            await pg.reload(wait_until='load'); await pg.wait_for_timeout(1500)
            r5 = await pg.evaluate("()=>{const st=document.getElementById('pcState');return st&&!st.hidden}")
            state['mode'] = 'normal'
            await pg.fill('#pcText', 'x'); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(1500)
            r6 = await pg.evaluate("()=>{const st=document.getElementById('pcState');const em=document.querySelector('#ppModeChat em');return {state:st&&!st.hidden,tab:em&&em.textContent}}")
            ok(f'[{name}] 새로고침에도 점검 중 유지 → 풀리면 즉시 원래대로', r5 and not r6['state'] and r6['tab'] == 'AI', {'kept': r5, 'after': r6})
            # 서버 500
            state['mode'] = '500'
            await pg.fill('#pcText', 'x'); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(1500)
            r7 = await pg.evaluate("()=>({btn:!!document.getElementById('pcToForm'),sendOn:!document.getElementById('pcSend').disabled,last:[...document.querySelectorAll('.pc-msg.bot')].pop().textContent.slice(0,40)})")
            ok(f'[{name}] 서버 500 — 멈추지 않고 단계별 신청 버튼, 다시 보낼 수 있음', r7['btn'] and r7['sendOn'], r7)
            # 시간 초과(20초 abort) — 화면이 잠기지 않는다
            state['mode'] = 'timeout'
            await pg.fill('#pcText', 'x'); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(21500)
            r8 = await pg.evaluate("()=>({sendOn:!document.getElementById('pcSend').disabled,typing:!!document.getElementById('pcTyping'),btn:!!document.getElementById('pcToForm')})")
            ok(f'[{name}] 시간 초과 — 입력 잠금 해제 · 타이핑 표시 제거 · 안내', r8['sendOn'] and not r8['typing'] and r8['btn'], r8)
            state['mode'] = 'normal'
            # 키보드 — 입력 → Tab → 보내기
            await pg.focus('#pcText'); await pg.keyboard.press('Tab')
            r9 = await pg.evaluate("()=>document.activeElement&&document.activeElement.id")
            ok(f'[{name}] 키보드 — 입력창 다음 탭이 보내기', r9 == 'pcSend', r9)
            # 단계별 신청으로 전환 버튼
            state['mode'] = 'paused'
            await pg.fill('#pcText', 'x'); await pg.press('#pcText', 'Enter'); await pg.wait_for_timeout(1500)
            await tap('#pcToForm'); await pg.wait_for_timeout(400)
            r10 = await pg.evaluate("()=>({chatHidden:document.getElementById('ppChat').hidden,barShown:getComputedStyle(document.getElementById('ppBar')).display!=='none',formOn:document.getElementById('ppModeForm').classList.contains('on')})")
            ok(f'[{name}] 「단계별 신청으로」 버튼 — 폼 복귀 · 하단 버튼 복귀', r10['chatHidden'] and r10['barShown'] and r10['formOn'], r10)
            ok(f'[{name}] 페이지 JS 오류 없음', not errs, errs)

            # ── 관제 정지 팝업
            pg2 = await ctx.new_page(); errs2 = []
            pg2.on('pageerror', lambda e: errs2.append(str(e)))
            await pg2.goto(B + '/ops', wait_until='load'); await pg2.wait_for_timeout(400)
            try:
                await pg2.fill('input[name=u]', os.environ.get('OPS_USER', 'admin')); await pg2.fill('input[name=p]', os.environ.get('OPS_PASS', 'pass1234')); await pg2.click('button'); await pg2.wait_for_timeout(1200)
            except Exception as e: print('  (login)', str(e)[:60])
            resumed = {'n': 0}
            async def data_route(route):
                rr = await route.fetch(); j = await rr.json()
                if j.get('ok'): j['halt'] = None if resumed['n'] else HALT
                await route.fulfill(response=rr, body=json.dumps(j), headers={**rr.headers, 'content-type': 'application/json'})
            async def act_route(route):
                body = json.loads(route.request.post_data or '{}')
                if body.get('op') == 'ai_resume': resumed['n'] += 1; return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'prev': HALT}))
                await route.continue_()
            await pg2.route('**/ops/proposals/data*', data_route); await pg2.route('**/ops/proposals/action', act_route)
            await pg2.goto(B + '/ops/proposals', wait_until='load'); await pg2.wait_for_timeout(2200)
            r11 = await pg2.evaluate("""()=>{const p=document.getElementById('haltPop');const bx=p.querySelector('.box').getBoundingClientRect();const btn=document.getElementById('haltResume').getBoundingClientRect();
              return {shown:!p.hidden,fits:bx.width<=innerWidth&&btn.bottom<=innerHeight,focus:document.activeElement&&document.activeElement.id,role:p.getAttribute('role'),modal:p.getAttribute('aria-modal'),warn:/정지 중/.test(document.getElementById('warns').textContent)}}""")
            ok(f'[{name}] 관제 팝업 — 화면 안 · 포커스가 「AI 다시 시도」 · role=dialog · 경고 띠', r11['shown'] and r11['fits'] and r11['focus'] == 'haltResume' and r11['role'] == 'dialog' and r11['modal'] == 'true' and r11['warn'], r11)
            await pg2.keyboard.press('Escape'); await pg2.wait_for_timeout(200)
            r12 = await pg2.evaluate("()=>document.getElementById('haltPop').hidden")
            await pg2.reload(wait_until='load'); await pg2.wait_for_timeout(1800)
            r13 = await pg2.evaluate("()=>document.getElementById('haltPop').hidden")
            ok(f'[{name}] Esc 로 닫힘 · 같은 정지는 새로고침에 다시 안 뜸(띠는 남음)', r12 and r13)
            await pg2.click('#haltShow'); await pg2.wait_for_timeout(200)
            pg2.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg2.click('#haltResume'); await pg2.wait_for_timeout(1800)
            r14 = await pg2.evaluate("()=>({pop:document.getElementById('haltPop').hidden,warn:/정지 중/.test(document.getElementById('warns').textContent)})")
            ok(f'[{name}] 「AI 다시 시도」 → 해제 · 팝업·띠 사라짐', resumed['n'] == 1 and r14['pop'] and not r14['warn'], {'resumed': resumed['n'], **r14})
            # 관제 다른 탭들 — 모바일에서도 넘침 없음
            for tab in ['archive', 'insights', 'misses']:
                await pg2.goto(B + '/ops/proposals/' + tab, wait_until='load'); await pg2.wait_for_timeout(1500)
                r15 = await pg2.evaluate("()=>({h:document.getElementById('ttl').textContent, over:document.body.scrollWidth-document.documentElement.clientWidth})")
                ok(f'[{name}] 관제 {tab} 탭 — 열림 · 본문 넘침 없음', r15['h'] and r15['over'] <= 1, r15)
            ok(f'[{name}] 관제 JS 오류 없음', not errs2, errs2)
            await ctx.close()
        await b.close()
    print('\n' + ('❌ %d건 실패' % fails if fails else '✅ 환경 교차 실측 전부 통과'))
    sys.exit(1 if fails else 0)

asyncio.run(main())
