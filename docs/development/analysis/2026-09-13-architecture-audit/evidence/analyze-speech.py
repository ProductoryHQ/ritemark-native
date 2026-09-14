"""Correlate actual speech host state/UI with controlled engine and store boundaries."""
from pathlib import Path
import ast
import hashlib
import json
import subprocess

e=Path(__file__).resolve().parent
root=e.parents[4]
read=lambda n:json.loads((e/n).read_text())
steps=lambda x:{s['name']:s['value'] for s in x['stages']}
initial=read('normal-speech-recovery-probe.json');resume=read('normal-speech-recovery-finish-probe.json')
recovery=read('normal-speech-recovery-observed-probe.json');store=read('normal-speech-store-probe.json')
cleanup=read('normal-speech-cleanup-probe.json');session=read('normal-speech-session.json')
a,b,c=steps(initial),steps(recovery),steps(store)
assert 'document.body.dataset.editorType' in initial['error']
assert "'failed'" in resume['error'] and not resume['stages']
assert recovery['completed'] and store['completed']
assert a['single-host-control-saved']['inspection']['jobs'][0]['state']=='done'
assert 'AUDIT SYNTHETIC TRANSCRIPT control.wav' in a['single-host-control-visible']['text']
assert a['single-host-control-visible']['audio']['paused'] is True
old=initial['pendingJobId'];pending=recovery['pendingJobId'];assert old!=pending
previous=b['previous-job-authoritatively-terminal']
assert next(j for j in previous['jobs'] if j['id']==old)['error']['message']=='Audit engine observer-timeout'
assert not previous['heldEngines']
parallel=b['b-recovered-live-a-job'];aa=parallel['a'];bb=parallel['b']
assert aa['hostPid']!=bb['hostPid'] and aa['baseDir']==bb['baseDir']
assert aa['workspaceFolders']==bb['workspaceFolders'] and aa['workspaceFile']!=bb['workspaceFile']
job_a=next(j for j in aa['jobs'] if j['id']==pending);job_b=next(j for j in bb['jobs'] if j['id']==pending)
assert job_a['state']=='transcribing' and job_b['state']=='interrupted'
assert any(h['sourcePath']==job_a['audioPath'] for h in aa['heldEngines'])
assert not bb['inflight'] and any(j['id']==pending for j in aa['inflight'])
ui=b['both-panels-disagree'];assert ui['a']['targetId']!=ui['b']['targetId']
assert 'Transcribing · 0%' in ui['a']['text']
assert 'Ritemark closed while this recording was being transcribed.' in ui['b']['text']
finished=b['a-completes-after-b-called-it-interrupted']
assert next(j for j in finished['a']['jobs'] if j['id']==pending)['state']=='done'
assert next(j for j in finished['b']['jobs'] if j['id']==pending)['state']=='interrupted'
assert 'AUDIT SYNTHETIC TRANSCRIPT pending.wav' in finished['savedViaB']['segments'][0]['text']
assert 'Ritemark closed while this recording was being transcribed.' in finished['bUi']
labels=lambda session:[s['label'] for s in session['speakers']]
assert labels(c['sequential-two-host-control'])==['AUDIT SEQUENTIAL ZERO','AUDIT SEQUENTIAL ONE']
held=c['both-stale-candidates-held'];assert labels(held['a']['storeGate']['candidate'])==['AUDIT CONCURRENT ZERO','AUDIT SEQUENTIAL ONE']
assert labels(held['b']['storeGate']['candidate'])==['AUDIT SEQUENTIAL ZERO','AUDIT CONCURRENT ONE']
assert c['a-acknowledged-and-saved']['aResult']['status']==c['b-acknowledged-overwrites-a']['bResult']['status']=='completed'
assert labels(c['a-acknowledged-and-saved']['afterA'])==['AUDIT CONCURRENT ZERO','AUDIT SEQUENTIAL ONE']
expected=['AUDIT SEQUENTIAL ZERO','AUDIT CONCURRENT ONE']
assert labels(c['b-acknowledged-overwrites-a']['afterB'])==expected
for host in ['a','b']:
 assert labels(c['both-hosts-read-lost-rename'][host])==expected
 text=c['both-real-views-show-lost-rename'][host]['text']
 assert 'AUDIT SEQUENTIAL ZERO' in text and 'AUDIT CONCURRENT ONE' in text and 'AUDIT CONCURRENT ZERO' not in text
 assert not c['observers-restored'][host]['engineBoundaryStubbed'] and c['observers-restored'][host]['storeGate'] is None
 assert c['observers-restored'][host]['runtimeSessionCount']==0
assert cleanup['completed'] and cleanup['cdpPortClosed'] and not cleanup['remaining']
assert cleanup['observerRestored']['temporaryHelperRemoved']
assert labels(cleanup['sessions']['shared.wav'])==expected
assert all(not t['exists'] for t in cleanup['tempFiles'])
assert not read('normal-speech-cli-exit.json')['present']
for rel,item in session['files'].items():assert cleanup['productHashes'][rel]==item['sha256']
events=[json.loads(line) for n in cleanup['eventFiles'] for line in (e/n).read_text().splitlines()]
engine_held=[x for x in events if x['event']=='speech-audit-engine-held']
engine_released=[x for x in events if x['event']=='speech-audit-engine-release']
assert len(engine_held)==len(engine_released)==3
assert [x['kind'] for x in engine_released]==['success','observer-timeout','success']
assert engine_released[1]['at']-engine_held[1]['at']>=120000
saved_holds=[x for x in events if x['event']=='speech-audit-save-held']
saved_releases=[x for x in events if x['event']=='speech-audit-save-release']
assert len(saved_holds)==len(saved_releases)==2
hold_durations=[]
for h in saved_holds:
 r=next(x for x in saved_releases if x['hostPid']==h['hostPid'])
 hold_durations.append({'hostPid':h['hostPid'],'heldMs':r['at']-h['at']})
 assert r['at']-h['at']<8000
sources={}
for rel,ranges in {
 'extensions/ritemark/src/speech/JobManager.ts':[(86,111),(114,146),(150,188),(215,248),(266,270)],
 'extensions/ritemark/src/speech/SessionStore.ts':[(58,73)],
 'extensions/ritemark/src/speech/index.ts':[(56,63)],
 'extensions/ritemark/src/extension.ts':[(405,443)],
 'extensions/ritemark/src/transcriptWorkbenchProvider.ts':[(153,174),(252,256),(399,443)],
 'extensions/ritemark/src/views/TranscribeViewProvider.ts':[(297,329)],
 'extensions/ritemark/webview/src/components/transcribe/TranscribePanel.tsx':[(60,67),(155,163),(479,499)],
}.items():
 raw=(root/rel).read_bytes();lines=raw.decode().splitlines();sources[rel]={'sha256':hashlib.sha256(raw).hexdigest(),'excerpts':[{'start':a,'end':b,'lines':lines[a-1:b]} for a,b in ranges]}
checks=[]
for f in sorted(e.glob('normal-speech-*.mjs'))+[e/'speech-audit-api.cjs',e/'normal-speech-driver/index.cjs',e/'normal-speech-driver/speech-audit-api.cjs']:
 r=subprocess.run(['/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node','--check',str(f)],capture_output=True,text=True);assert r.returncode==0,r.stderr;checks.append({'file':str(f.relative_to(e)),'nodeCheckExitCode':r.returncode})
for f in [e/'prepare-speech-probe.py',Path(__file__)]:ast.parse(f.read_text())
report={'method':'Correlate preserved actual provider/job/store state, real webviews and host events. Existing provider reference was found with local V8 scope inspection; no source re-evaluation or replacement product objects. Syntax checks do not rerun app behavior.',
 'baseline':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'singleHostPipelineAndViewPassed':True,'liveJobMisclassifiedBySecondHost':True,'originalHostCompletedSameJob':True,'sequentialRenameControlPassed':True,'twoAcknowledgedRenamesLostOneChange':True,'bothActualViewsReadLostChange':True,
 'limits':['Silent WAV fixture, held synthetic engine response; no Whisper inference, cloud transcription, native model dispatch or speech fidelity claim.','Store saves were paused before the original implementation; no tmp-file collision is claimed for this sequential-release app test.','Initial wrong body selector and terminal observer timeout are retained as harness failures. Fresh job started only after terminal state was confirmed.','A and B Memento snapshots differ; an intermediate on-disk SQLite record and crash after peer recovery were not measured.','No app restart or actual audio playback in this run.'],
 'initialProbeError':initial['error'],'resumePreconditionError':resume['error'],'engineReleases':[{'kind':x['kind'],'at':x['at']} for x in engine_released],
 'saveHoldDurations':hold_durations,'hostEventRecords':len(events),'sourceContext':sources,
 'history':subprocess.check_output(['git','log','-3','--format=%H %aI %s','--','extensions/ritemark/src/speech/JobManager.ts','extensions/ritemark/src/speech/SessionStore.ts','extensions/ritemark/src/transcriptWorkbenchProvider.ts'],cwd=root,text=True).splitlines(),
 'screenshot':{'file':'normal-speech-false-interrupted.png','inspected':'Actual second workspace window shows the Needs Attention message while A is held.','sha256':hashlib.sha256((e/'normal-speech-false-interrupted.png').read_bytes()).hexdigest()},
 'capturedOwnedProcessesStopped':len(cleanup['before']),'portClosed':cleanup['cdpPortClosed'],'temporaryPeakPathsAbsent':len({t['path'] for t in cleanup['tempFiles']}),'productArtifactsUnchanged':len(cleanup['productHashes']),'syntaxChecks':checks,'pythonAstChecks':2}
(e/'speech-analysis.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['singleHostPipelineAndViewPassed','liveJobMisclassifiedBySecondHost','twoAcknowledgedRenamesLostOneChange','bothActualViewsReadLostChange','saveHoldDurations','hostEventRecords','capturedOwnedProcessesStopped','temporaryPeakPathsAbsent']}))
