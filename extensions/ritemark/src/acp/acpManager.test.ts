/**
 * Tests for AcpManager — Sprint 76 R1/R4/R5.
 *
 * Run: npx tsx src/acp/acpManager.test.ts
 *
 * Drives the manager through the real AcpClient + a scripted ACP agent child
 * process (same technique as acpClient.test.ts). Covers: session/update →
 * AgentProgress mapping, the OPENCODE_PERMISSION spawn-env lever, the 0-token
 * end_turn soft error, and cancel-kills-process.
 */

import assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { AgentProgress } from '../agent/types';
import { AcpManager, OPENCODE_PERMISSION } from './acpManager';
import type { AcpFsBackend } from './acpFsProxy';

// Scripted agent: streams thought + tool_call + plan + message, and varies the
// usage/content per env so we can exercise the soft-error path. It also echoes
// the OPENCODE_PERMISSION env it was spawned with, to prove injection.
const AGENT_SCRIPT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
let sessionSeq = 0;
function send(o){ process.stdout.write(JSON.stringify(o)+'\\n'); }
function result(id,res){ send({jsonrpc:'2.0',id,result:res}); }
function notify(m,p){ send({jsonrpc:'2.0',method:m,params:p}); }
rl.on('line',(line)=>{
  let msg; try{ msg=JSON.parse(line);}catch{return;}
  if(msg.method==='initialize'){
    result(msg.id,{protocolVersion:1,agentCapabilities:{},authMethods:[],agentInfo:{name:'Scripted',version:'0'}});
  } else if(msg.method==='session/new'){
    result(msg.id,{sessionId:'ses_'+(++sessionSeq),configOptions:[]});
  } else if(msg.method==='session/prompt'){
    const sid=msg.params.sessionId;
    if(process.env.AGENT_SLOW==='1'){
      // Stream one chunk, then settle late so a cancel can land mid-turn.
      notify('session/update',{sessionId:sid,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'partial-'+sid}}});
      setTimeout(()=>result(msg.id,{stopReason:'end_turn',usage:{inputTokens:1,outputTokens:1,totalTokens:2}}),300);
      return;
    }
    if(process.env.AGENT_EMPTY==='1'){
      // Bad-key style empty turn: no content, 0 tokens.
      result(msg.id,{stopReason:'end_turn',usage:{inputTokens:0,outputTokens:0,totalTokens:0}});
      return;
    }
    notify('session/update',{sessionId:sid,update:{sessionUpdate:'agent_thought_chunk',content:{type:'text',text:'mulling'}}});
    notify('session/update',{sessionId:sid,update:{sessionUpdate:'tool_call',update:undefined,toolCallId:'t1',title:'write',status:'pending',kind:'edit',locations:[{path:'/ws/demo.txt'}]}});
    notify('session/update',{sessionId:sid,update:{sessionUpdate:'plan',entries:[{content:'step one',priority:'high',status:'pending'}]}});
    notify('session/update',{sessionId:sid,update:{sessionUpdate:'available_commands_update',availableCommands:[]}});
    notify('session/update',{sessionId:sid,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Done'}}});
    result(msg.id,{stopReason:'end_turn',usage:{inputTokens:5,outputTokens:3,totalTokens:8}});
  } else if(msg.method==='session/cancel'){
    send({jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'Method not found'}});
  }
});
`;

function writeAgentScript(): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'acp-mgr-test-')), 'agent.cjs');
  fs.writeFileSync(file, AGENT_SCRIPT, 'utf8');
  return file;
}

const fakeBackend: AcpFsBackend = {
  readFile: async () => '',
  writeFile: async () => {},
};

function makeManager(events: AgentProgress[], extraEnv?: Record<string, string>) {
  const agentScript = writeAgentScript();
  return new AcpManager({
    binaryPath: process.execPath,
    args: [agentScript],
    workspaceRoot: os.tmpdir(),
    byokEnv: extraEnv,
    requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
    approveWrite: async () => true,
    onProgress: (p) => events.push(p),
    fsBackend: fakeBackend,
  });
}

/** Sprint 99: variant that records which ACP session each event came from. */
function makeTaggedManager(events: Array<{ sessionId: string; p: AgentProgress }>, extraEnv?: Record<string, string>) {
  const agentScript = writeAgentScript();
  return new AcpManager({
    binaryPath: process.execPath,
    args: [agentScript],
    workspaceRoot: os.tmpdir(),
    byokEnv: extraEnv,
    requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
    approveWrite: async () => true,
    onProgress: (p, sessionId) => events.push({ sessionId, p }),
    fsBackend: fakeBackend,
  });
}

async function run() {
  // ── env: OPENCODE_PERMISSION is the mandatory permission lever (R4) ──
  {
    assert.strictEqual(OPENCODE_PERMISSION, '{"edit":"ask","bash":"ask","webfetch":"ask"}',
      'OPENCODE_PERMISSION must be the exact audit-mandated value');
  }

  // ── session/update → AgentProgress mapping (R5) ──
  {
    const events: AgentProgress[] = [];
    const mgr = makeManager(events);
    const sid = await mgr.start();
    await mgr.prompt(sid, 'do it');

    const byType = (t: string) => events.filter((e) => e.type === t);
    assert.ok(byType('thinking').some((e) => e.message === 'mulling'), `thought→thinking, got ${JSON.stringify(events)}`);
    const tool = byType('tool_use').find((e) => e.tool === 'write');
    assert.ok(tool, 'tool_call→tool_use with tool title');
    assert.strictEqual(tool!.file, '/ws/demo.txt', 'tool_use carries first location path');
    assert.ok(byType('plan_text').some((e) => e.message.includes('step one')), 'plan→plan_text');
    assert.ok(byType('text').some((e) => e.message === 'Done'), 'message→text');
    assert.ok(byType('done').length === 1, 'a successful turn emits exactly one done event');
    assert.ok(byType('error').length === 0, 'no error on a normal turn');
    mgr.dispose();
  }

  // ── 0-token end_turn with empty content → soft error (audit R-1) ──
  {
    const events: AgentProgress[] = [];
    const mgr = makeManager(events, undefined);
    (mgr as unknown as { config: { byokEnv?: Record<string, string> } }).config.byokEnv = { AGENT_EMPTY: '1' };
    const sid = await mgr.start();
    await mgr.prompt(sid, 'use a model with no key');
    const errors = events.filter((e) => e.type === 'error');
    assert.strictEqual(errors.length, 1, `empty turn should emit one error, got ${JSON.stringify(events)}`);
    assert.ok(/API key/i.test(errors[0].message), 'soft error mentions API keys');
    assert.strictEqual(events.filter((e) => e.type === 'done').length, 0, 'no done on soft-error turn');
    mgr.dispose();
  }

  // ── cancel kills the process when it is the ONLY session (C3) ──
  {
    const events: AgentProgress[] = [];
    const mgr = makeManager(events);
    const sid = await mgr.start();
    assert.ok(mgr.isRunning(), 'running after start');
    await mgr.cancel(sid);
    assert.ok(!mgr.isRunning(), 'sole-session cancel still kills the process');
    assert.strictEqual(mgr.currentSessionId, null, 'session id cleared after cancel');
  }

  // ── Sprint 99 C2: two sessions on ONE process get their own streams ──
  // Previously `sessionId` was a manager scalar and handleSessionUpdate ignored
  // params.sessionId entirely, so B's stream landed in A's progress sink.
  {
    const tagged: Array<{ sessionId: string; p: AgentProgress }> = [];
    const mgr = makeTaggedManager(tagged);
    const a = await mgr.start();
    const b = await mgr.start();
    assert.notStrictEqual(a, b, 'each start() opens a distinct ACP session');
    assert.strictEqual(mgr.sessionCount, 2, 'both sessions live on one process');

    await Promise.all([mgr.prompt(a, 'for A'), mgr.prompt(b, 'for B')]);

    const textFor = (sid: string) =>
      tagged.filter((e) => e.sessionId === sid && e.p.type === 'text').map((e) => e.p.message);
    assert.ok(textFor(a).includes('Done'), 'session A received its own streamed text');
    assert.ok(textFor(b).includes('Done'), 'session B received its own streamed text');
    assert.strictEqual(
      tagged.filter((e) => e.p.type === 'done').length, 2,
      'each session completes its own turn exactly once',
    );
    mgr.dispose();
  }

  // ── Sprint 99 C2: an empty turn in A is not masked by B's streamed content ──
  // sawContentThisTurn used to be a manager scalar, so B streaming text
  // suppressed A's legitimate "no API key" soft error.
  {
    const tagged: Array<{ sessionId: string; p: AgentProgress }> = [];
    const mgr = makeTaggedManager(tagged);
    const a = await mgr.start();
    const b = await mgr.start();
    // Drive A through the empty-turn path by hand while B streams content.
    const bTurn = mgr.prompt(b, 'stream something');
    const stateA = (mgr as unknown as { sessions: Map<string, { sawContentThisTurn: boolean }> }).sessions.get(a)!;
    await bTurn;
    assert.strictEqual(stateA.sawContentThisTurn, false,
      "B's streamed content must not set A's sawContentThisTurn flag");
    mgr.dispose();
  }

  // ── Sprint 99 C3: cancel with siblings live does NOT kill the process ──
  {
    const tagged: Array<{ sessionId: string; p: AgentProgress }> = [];
    const mgr = makeTaggedManager(tagged, { AGENT_SLOW: '1' });
    const a = await mgr.start();
    const b = await mgr.start();
    const aTurn = mgr.prompt(a, 'slow work');
    await mgr.cancel(a);
    assert.ok(mgr.isRunning(), 'cancelling one of two sessions must not kill the shared process');
    assert.ok(mgr.hasSession(b), "sibling session B survives A's cancel");
    await aTurn; // settles late; its result is discarded
    assert.strictEqual(
      tagged.filter((e) => e.sessionId === a && e.p.type === 'done').length, 0,
      'a cancelled turn does not emit a late completion',
    );
    mgr.dispose();
  }

  console.log('acpManager.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
