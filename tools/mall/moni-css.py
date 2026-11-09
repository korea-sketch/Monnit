import re,sys
css=open('style.css').read()
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
PAT=re.compile(r'(\.(pc|sp|sf|mkp)-[\w-]*|#(pp|pc|sp)[A-Z][\w-]*|\.pc-chat-open|\.mkp-chat)')
def blocks(s):
    i=0;n=len(s);out=[]
    while i<n:
        j=s.find('{',i)
        if j<0: break
        sel=s[i:j].strip()
        depth=1;k=j+1
        while k<n and depth:
            if s[k]=='{':depth+=1
            elif s[k]=='}':depth-=1
            k+=1
        out.append((sel,s[j+1:k-1]));i=k
    return out
res=[];keys=set()
def walk(s,wrap=None):
    for sel,body in blocks(s):
        if sel.startswith('@media') or sel.startswith('@supports'):
            inner=[]
            for s2,b2 in blocks(body):
                if s2.startswith('@'): continue
                parts=[p for p in s2.split(',') if PAT.search(p)]
                if parts: inner.append(','.join(p.strip() for p in parts)+'{'+b2.strip()+'}')
            if inner: res.append(sel+'{'+''.join(inner)+'}')
        elif sel.startswith('@keyframes'):
            res.append(('KF',sel,body))
        elif sel.startswith('@'): continue
        else:
            parts=[p for p in sel.split(',') if PAT.search(p)]
            if parts: res.append(','.join(p.strip() for p in parts)+'{'+body.strip()+'}')
walk(css)
txt=''.join(r for r in res if isinstance(r,str))
used=set(re.findall(r'animation(?:-name)?\s*:\s*([\w-]+)',txt))
kf=[f"{sel}{{{body}}}" for _,sel,body in [r for r in res if not isinstance(r,str)] if sel.split()[-1] in used]
vars_used=set(re.findall(r'var\((--[\w-]+)',txt))
root=re.findall(r':root\s*\{([^}]*)\}',css)
decl=[]
for r in root:
    for d in r.split(';'):
        if ':' in d and d.split(':')[0].strip() in vars_used: decl.append(d.strip())
out='/* 모니 챗봇 스타일 — style.css 에서 자동 추출 (tools/mall/moni-css.py). 몰·리소스 센터처럼 style.css 를 쓰지 않는 페이지용\n   변수는 모니 안에서만 쓴다 — :root 에 두면 몰의 --bg·--ink·--accent 를 덮어써 화면이 깨진다 (2026-11-09) */\n#ppChat,#pcLauncher,.pc-launcher,.pc-panel,.mkp-chat{'+';'.join(dict.fromkeys(decl))+'}\n'+'\n'.join(kf)+'\n'+txt
open('css/moni.css','w').write(out)
print(len(out), 'vars',len(vars_used),'kf',len(kf),'used anim',used)
