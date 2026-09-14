import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {evidence,processList,writeEvidence} from './normal-speech-tools.mjs';
const recovery=JSON.parse(fs.readFileSync(path.join(evidence,'normal-speech-recovery-observed-probe.json'),'utf8'));
const cliPid=recovery.stages.find(s=>s.name==='second-window-requested').value.cliPid;
const now=processList();const present=now.find(p=>p.pid===cliPid);
const result={at:Date.now(),secondWindowCliPid:cliPid,present:!!present,auditCommandStillPresent:!!present?.command.includes('/private/tmp/ritemark-audit-normal-bg5jgmun/speech-profile')};
writeEvidence('normal-speech-cli-exit.json',result);assert.equal(result.auditCommandStillPresent,false);console.log(JSON.stringify(result));
