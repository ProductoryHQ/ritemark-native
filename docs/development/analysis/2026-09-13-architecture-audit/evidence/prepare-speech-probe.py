"""New synthetic speech profile and tiny silent WAVs; reuse unchanged product."""
from pathlib import Path
import hashlib
import json
import wave

evidence=Path(__file__).resolve().parent
original=json.loads((evidence/'normal-session.json').read_text())
run=Path(original['runDir']);assert str(run)=='/private/tmp/ritemark-audit-normal-bg5jgmun'
profile=run/'speech-profile';assert not profile.exists()
(profile/'User').mkdir(parents=True)
(profile/'User/settings.json').write_text(json.dumps(original['settings'],indent=2)+'\n')
fixtures=run/'workspace/speech-audit';fixtures.mkdir(exist_ok=False)
for name in ['control.wav','pending.wav','shared.wav']:
 with wave.open(str(fixtures/name),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(bytes(32000))
session={k:v for k,v in original.items() if k not in ['pid','launchedAt','launches','args']}
session.update(profile=str(profile),preparedOnly=True,method='Actual existing transcript provider/job/store in disposable normal-mode hosts. Existing lexical provider reference observed with local inspector; bounded synthetic transcription boundary and optional fixture save hold. No native whisper/model/cloud call.')
session['args']=[s.replace(original['profile'],str(profile)).replace('9238','9242') for s in original['args']]
session['fixtureHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in fixtures.glob('*.wav')}
for rel,item in session['files'].items():assert hashlib.sha256((Path(session['extensionPath'])/rel).read_bytes()).hexdigest()==item['sha256']
(evidence/'normal-speech-session.json').write_text(json.dumps(session,indent=2)+'\n')
(evidence/'normal-speech-tools.mjs').write_text((evidence/'normal-tools.mjs').read_text().replace('normal-session.json','normal-speech-session.json').replace('9238','9242').replace("'app.log'","'speech-app.log'"))
(evidence/'normal-speech-client.mjs').write_text((evidence/'normal-client.mjs').read_text().replace('./normal-tools.mjs','./normal-speech-tools.mjs'))
driver=(evidence/'normal-driver/index.cjs').read_text()
driver=driver.replace(' const server=http.createServer(async(req,res)=>{'," const speechAudit=require('./speech-audit-api.cjs')(context,runDir,log);\n const server=http.createServer(async(req,res)=>{")
driver=driver.replace("   if(req.url==='/open'){","   if(req.url==='/speech-audit')return reply(200,await speechAudit(q));\n   if(req.url==='/open'){")
staged=evidence/'normal-speech-driver';staged.mkdir(exist_ok=True)
(staged/'index.cjs').write_text(driver)
(staged/'speech-audit-api.cjs').write_bytes((evidence/'speech-audit-api.cjs').read_bytes())
for name in ['index.cjs','speech-audit-api.cjs']:(Path(session['driverPath'])/name).write_bytes((staged/name).read_bytes())
print(json.dumps({'profile':str(profile),'fixtures':session['fixtureHashes'],'productArtifactsVerified':len(session['files'])}))
