// Adversarial component experiments on actual source classes and synthetic data.
// Uses the installed tsx require hook; no agents, credentials, network or live documents.
require('../../../../../extensions/ritemark/node_modules/tsx/dist/cjs/index.cjs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { ConversationStore, nodeConversationStoreFileSystem } = require('../../../../../extensions/ritemark/src/conversations/ConversationStore.ts');
const { resolveProjectScope } = require('../../../../../extensions/ritemark/src/conversations/projectScope.ts');
const { SessionStore } = require('../../../../../extensions/ritemark/src/speech/SessionStore.ts');
const { FlowScheduler } = require('../../../../../extensions/ritemark/src/flows/FlowScheduler.ts');

function event(id, sequence) {
  return { kind:'user-message', eventId:id, turnId:`turn-${id}`, sequence, occurredAt:'2026-09-13T10:00:00.000Z', runtimeId:'codex', text:`Synthetic ${id}`, mode:'agent', attachments:[] };
}
async function conversationRace(baseDir) {
  const scope = resolveProjectScope({folderUris:['file:///synthetic/audit'],platform:'darwin'});
  const seed = new ConversationStore(baseDir);
  const record = await seed.create({conversationId:'00000000-0000-4000-8000-000000000001',scopeId:scope.scopeId,scope:scope.descriptor,title:'Synthetic',events:[event('seed',0)]});
  let arrivals = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const backend = {
    ...nodeConversationStoreFileSystem,
    async writeFile(file, contents) {
      if (file.includes('/records/') && file.includes('.tmp-') && JSON.parse(contents).revision === 2) {
        arrivals++;
        if (arrivals === 2) release();
        await barrier; // both writers have passed their expectedRevision=1 check
      }
      return nodeConversationStoreFileSystem.writeFile(file,contents);
    },
  };
  const a = new ConversationStore(baseDir,{fileSystem:backend});
  const b = new ConversationStore(baseDir,{fileSystem:backend});
  await Promise.all([a.list(),b.list()]);
  const outcome = await Promise.all([
    a.checkpoint({conversationId:record.conversationId,bindingGeneration:record.bindingGeneration,expectedRevision:record.revision,appendEvents:[event('actor-a',1)]}),
    b.checkpoint({conversationId:record.conversationId,bindingGeneration:record.bindingGeneration,expectedRevision:record.revision,appendEvents:[event('actor-b',1)]}),
  ]);
  const durable = await new ConversationStore(baseDir).get(record.conversationId);
  assert.equal(outcome.length,2);
  const retained = durable.events.filter(e=>e.eventId.startsWith('actor-')).map(e=>e.eventId);
  return {successfulWriters:2,returnedRevisions:outcome.map(r=>r.revision),durableRevision:durable.revision,retainedActorEvents:retained,lostAcknowledgedEvent:retained.length===1};
}
async function transcriptRaces(baseDir) {
  const store = new SessionStore(baseDir);
  const trials = [];
  for (let n=0;n<10;n++) {
    const common = {id:`session-${n}`,createdAt:'2026-09-13T10:00:00.000Z',audioPath:'/synthetic/audio.wav',segments:[]};
    const outcomes = await Promise.allSettled([store.save({...common,label:'actor-a'}),store.save({...common,label:'actor-b'})]);
    const durable = await store.get(common.id);
    trials.push({outcomes:outcomes.map(r=>r.status==='fulfilled'?'fulfilled':String(r.reason?.code??r.reason)),durableLabel:durable?.label??null});
  }
  return {trials,failedSaves:trials.reduce((n,t)=>n+t.outcomes.filter(o=>o!=='fulfilled').length,0)};
}
async function conversationSingleStoreControl(baseDir) {
  const scope = resolveProjectScope({folderUris:['file:///synthetic/audit'],platform:'darwin'});
  const store = new ConversationStore(baseDir);
  const record = await store.create({conversationId:'00000000-0000-4000-8000-000000000002',scopeId:scope.scopeId,scope:scope.descriptor,title:'Synthetic control',events:[event('seed',0)]});
  const actors = ['actor-a','actor-b'];
  const outcomes = await Promise.allSettled(actors.map(id => store.checkpoint({conversationId:record.conversationId,bindingGeneration:record.bindingGeneration,expectedRevision:record.revision,appendEvents:[event(id,1)]})));
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  const rejected = outcomes.findIndex(o=>o.status==='rejected');
  const latest = await store.get(record.conversationId);
  await store.checkpoint({conversationId:latest.conversationId,bindingGeneration:latest.bindingGeneration,expectedRevision:latest.revision,appendEvents:[event(actors[rejected],2)]});
  const durable = await store.get(record.conversationId);
  assert.equal(durable.events.filter(e=>e.eventId.startsWith('actor-')).length,2);
  return {firstAttemptOutcomes:outcomes.map(o=>o.status),durableRevisionAfterExplicitRetry:durable.revision,retainedActorEvents:durable.events.filter(e=>e.eventId.startsWith('actor-')).map(e=>e.eventId)};
}
async function schedulerRace() {
  const flow = {id:'synthetic-daily',name:'Synthetic',description:'',version:1,created:'2026-09-13',modified:'2026-09-13',inputs:[],schedule:{enabled:true,type:'daily',time:'09:00'},nodes:[{id:'trigger',type:'trigger',position:{x:0,y:0},data:{label:'Trigger',inputs:[]}}],edges:[]};
  let state = {lastRunAt:null,lastScheduledFor:null,lastStatus:'idle',lastError:null};
  let reads=0,release;
  const barrier = new Promise(resolve=>{release=resolve;});
  const sharedState = {
    async get() { const snapshot={...state}; if (++reads===2) release(); await barrier; return snapshot; },
    async update(_key,patch) { state={...state,...patch}; return state; },
  };
  const executions=[];
  const deps = {storage:{async listFlows(){return [flow];},getFlowPath(){return '/synthetic/daily.flow.json';}},scheduleState:sharedState,isFeatureEnabled:()=>true,executeFlowFn:async()=>{executions.push('run');return {success:true,outputs:{}};}};
  const a=new FlowScheduler('/synthetic',deps), b=new FlowScheduler('/synthetic',deps);
  await Promise.all([a.tick(new Date(2026,8,13,9,2)),b.tick(new Date(2026,8,13,9,2))]);
  await new Promise(resolve=>setImmediate(resolve));
  a.dispose();b.dispose();
  return {schedulerInstances:2,sharedScheduleState:true,executionsInSameSlot:executions.length};
}
async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(),'ritemark-audit-concurrency-'));
  const watchdog = setTimeout(()=>{console.error('Probe exceeded 30 seconds');process.exitCode=1;},30000);
  try {
    const report={method:'Actual source classes, injected filesystem barrier for conversation writes, actual local filesystem for transcript writes, shared synthetic schedule state for two scheduler instances. Component reproductions, not an Electron/Windows end-to-end claim.',node:process.version,platform:process.platform,conversation:await conversationRace(path.join(temp,'conversations')),singleStoreControl:await conversationSingleStoreControl(path.join(temp,'control')),transcript:await transcriptRaces(path.join(temp,'transcripts')),scheduler:await schedulerRace()};
    await fs.writeFile(path.join(__dirname,'concurrency-probes.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { clearTimeout(watchdog); await fs.rm(temp,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
