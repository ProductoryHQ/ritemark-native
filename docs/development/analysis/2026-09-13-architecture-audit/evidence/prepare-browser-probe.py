"""Prepare local browser fixtures and a disposable profile; product is unchanged."""
from pathlib import Path
import hashlib
import json
evidence=Path(__file__).resolve().parent
old=json.loads((evidence/'normal-session.json').read_text())
run=Path(old['runDir'])
assert str(run)=='/private/tmp/ritemark-audit-normal-bg5jgmun'
profile=run/'browser-profile'
assert not profile.exists(), 'Do not overwrite a prepared/live profile'
(profile/'User').mkdir(parents=True)
(profile/'User/settings.json').write_text(json.dumps(old['settings'],indent=2)+'\n')
fixtures=run/'browser-fixtures';fixtures.mkdir(exist_ok=True)
for page in ['a','b']:
    html='''<!doctype html><meta charset="utf-8"><title>AUDIT PAGE LETTER</title>
<style>body{font:20px system-ui;margin:40px;background:COLOR;color:#172340}input,button{font:inherit;margin:8px;padding:12px}output{display:block;margin:16px}h1{font-size:32px}</style>
<h1>AUDIT PAGE LETTER</h1><p>Local synthetic browser target LETTER. No external requests or form submission.</p>
<label for="entry">Audit field LETTER</label><input id="entry" value="BASE LETTER">
<button id="mark" onclick="document.querySelector('#count').textContent=String(++window.auditClicks)">Mark LETTER</button>
<button id="arm" onclick="document.querySelector('#late')?.remove();document.querySelector('#delay').textContent='waiting';setTimeout(()=>{const b=document.createElement('button');b.id='late';b.textContent='Delayed mark LETTER';b.onclick=()=>{document.querySelector('#late-count').textContent=String(++window.auditLateClicks)};document.body.append(b);document.querySelector('#delay').textContent='ready'},2500)">Arm delayed action</button>
<output>Clicks: <span id="count">0</span></output><output>Delayed clicks: <span id="late-count">0</span></output><output id="delay">not armed</output>
<script>window.auditClicks=0;window.auditLateClicks=0;</script>'''.replace('LETTER',page.upper()).replace('COLOR','#e8f0ff' if page=='a' else '#fff0df')
    (fixtures/('page-'+page+'.html')).write_text(html)
session={k:v for k,v in old.items() if k not in ['pid','launchedAt','launches','args']}
session.update(profile=str(profile),preparedOnly=True,method='Unchanged staged product, fresh browser profile, local file pages, and actual AcpRuntime browser dispatcher called through a bounded observer. No native model/ACP manager startup.')
session['args']=[arg.replace(old['profile'],str(profile)).replace('9238','9241') for arg in old['args']]
for rel,item in session['files'].items():assert hashlib.sha256((Path(session['extensionPath'])/rel).read_bytes()).hexdigest()==item['sha256']
session['fixtureHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in fixtures.glob('*.html')}
(evidence/'normal-browser-session.json').write_text(json.dumps(session,indent=2)+'\n')
(evidence/'normal-browser-tools.mjs').write_text((evidence/'normal-tools.mjs').read_text().replace('normal-session.json','normal-browser-session.json').replace('9238','9241').replace("'app.log'","'browser-app.log'"))
(evidence/'normal-browser-client.mjs').write_text((evidence/'normal-client.mjs').read_text().replace("'./normal-tools.mjs'","'./normal-browser-tools.mjs'"))
source=(evidence/'normal-driver/index.cjs').read_text()
source=source.replace(' const server=http.createServer(async(req,res)=>{'," const browserAudit=require('./browser-audit-api.cjs')(context,runDir,log);\n const server=http.createServer(async(req,res)=>{")
source=source.replace("   if(req.url==='/open'){","   if(req.url==='/browser-audit')return reply(200,await browserAudit(q));\n   if(req.url==='/open'){")
staged=evidence/'normal-browser-driver';staged.mkdir(exist_ok=True)
(staged/'index.cjs').write_text(source)
(staged/'browser-audit-api.cjs').write_bytes((evidence/'browser-audit-api.cjs').read_bytes())
for name in ['index.cjs','browser-audit-api.cjs']:(Path(session['driverPath'])/name).write_bytes((staged/name).read_bytes())
print(json.dumps({'profile':str(profile),'fixtures':session['fixtureHashes'],'productArtifactsVerified':len(session['files'])}))
