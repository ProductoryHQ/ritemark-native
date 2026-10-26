/**
 * Sprint 134 R16 — what the Transcribe panel draws around its content, with and without a folder open.
 *
 * Run: npx tsx webview/src/components/transcribe/panelChrome.test.ts (from extensions/ritemark)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ALL_PROJECTS_LABEL,
  ATTENTION_ACTIONS,
  RECORDINGS_LABEL,
  RECORD_REQUEST,
  SETTINGS_BUTTON,
  canStartRecording,
  panelChrome,
  requestedRecordingStart,
} from './panelChrome';

// A folder is open: the project's head draws Record and Transcribe a file…, so the panel draws neither.
{
  const chrome = panelChrome({ hasProject: true, recordingEnabled: true, showAllProjects: false });
  assert.deepEqual(chrome.actions, [], 'the head carries Record and Transcribe a file…');
  assert.equal(chrome.pickFileName, 'Transcribe a file…', 'text sends the person to the row they can see');
  assert.deepEqual(panelChrome({ hasProject: true, recordingEnabled: false, showAllProjects: false }).actions, []);
}

// No folder open: no head, so the panel keeps its own Add recording and Record (Record only while recording is on).
{
  const chrome = panelChrome({ hasProject: false, recordingEnabled: true, showAllProjects: false });
  assert.deepEqual(chrome.actions, ['add-recording', 'record']);
  assert.equal(chrome.pickFileName, 'Add recording');
  assert.deepEqual(panelChrome({ hasProject: false, recordingEnabled: false, showAllProjects: false }).actions, ['add-recording']);
}

// The library's label reads "Recordings"; "All projects" stays as the switch's other state. The gear sits at
// its right in both, with or without a folder.
for (const hasProject of [true, false]) {
  const mine = panelChrome({ hasProject, recordingEnabled: true, showAllProjects: false });
  const all = panelChrome({ hasProject, recordingEnabled: true, showAllProjects: true });
  assert.equal(mine.libraryLabel, 'Recordings');
  assert.equal(RECORDINGS_LABEL, 'Recordings');
  assert.equal(all.libraryLabel, ALL_PROJECTS_LABEL);
  assert.equal(all.libraryLabel, 'All projects');
  for (const chrome of [mine, all]) {
    assert.deepEqual(chrome.settings, {
      label: 'Transcribe settings',
      icon: 'gear',
      message: { type: 'transcribe:openSettings' },
    });
  }
}
assert.equal(SETTINGS_BUTTON.message.type, 'transcribe:openSettings');

// Record starts only when the panel's Record button is enabled: recording on, an engine ready, nothing recording.
assert.equal(canStartRecording({ enabled: true, nothingReady: false, recordingBusy: false }), true);
assert.equal(canStartRecording({ enabled: false, nothingReady: false, recordingBusy: false }), false);
assert.equal(canStartRecording({ enabled: true, nothingReady: true, recordingBusy: false }), false);
assert.equal(canStartRecording({ enabled: true, nothingReady: false, recordingBusy: true }), false);

// The head's Record is a click in the workbench, not in the panel: the panel's audio cannot run without a
// fresh gesture of its own, so it asks for one click; with one (or where the browser does not say), it starts.
assert.equal(requestedRecordingStart({ isActive: false }), 'ask');
assert.equal(requestedRecordingStart({ isActive: true }), 'start');
assert.equal(requestedRecordingStart(undefined), 'start');

// The panel draws what panelChrome says, and the host's command speaks the panel's message.
const panelSource = readFileSync(fileURLToPath(new URL('./TranscribePanel.tsx', import.meta.url)), 'utf-8');
assert.ok(panelSource.includes('chrome.actions.length > 0 && ('), 'the own row is drawn only from chrome.actions');
assert.ok(panelSource.includes("chrome.actions.includes('record')"), 'Record follows chrome.actions');
assert.ok(panelSource.includes('title={chrome.libraryLabel}'), 'the library label comes from chrome');
assert.ok(!/['"]Library['"]/.test(panelSource), '"Library" is gone');
assert.ok(panelSource.includes('label={chrome.settings.label}') && panelSource.includes('aria-label={chrome.settings.label}'));
assert.ok(panelSource.includes('vscode.postMessage(chrome.settings.message)'), 'the gear posts transcribe:openSettings');
assert.ok(panelSource.includes('message?.type === RECORD_REQUEST'), 'the panel hears the head\'s Record');
assert.ok(panelSource.includes("requestedRecordingStart(activation) === 'start'"), 'the request starts or asks by the rule above');
assert.ok(panelSource.includes('<RecordPromptCard'), 'asking is the one-click card');

const hostSource = readFileSync(
  fileURLToPath(new URL('../../../../src/views/TranscribeViewProvider.ts', import.meta.url)),
  'utf-8',
);
assert.ok(hostSource.includes(`type: '${RECORD_REQUEST}'`), 'the host posts the request the panel listens for');
assert.ok(hostSource.includes("registerCommand('ritemark.transcribe.record'"));
assert.ok(hostSource.includes("registerCommand('ritemark.transcribe.addFile'"));
assert.ok(hostSource.includes("case 'transcribe:openSettings':"), 'the host still answers the gear');

// Sprint 143 (#509, R8, S37): every card under Needs attention has Dismiss, with its tooltip, and the host answers it.
assert.equal(ATTENTION_ACTIONS.dismiss.tooltip, 'Remove this from the list. The recording stays where it is.');
const attentionRow = panelSource.slice(panelSource.indexOf('function AttentionRow'), panelSource.indexOf('type RecordingAction'));
assert.ok(attentionRow.includes('ATTENTION_ACTIONS.dismiss.tooltip') && attentionRow.includes('ATTENTION_ACTIONS.retry.tooltip'), 'both buttons have tooltips');
assert.doesNotMatch(attentionRow.slice(attentionRow.indexOf('ATTENTION_ACTIONS.dismiss.tooltip') - 200, attentionRow.indexOf('ATTENTION_ACTIONS.dismiss.tooltip')), /retryable/, 'Dismiss shows whatever the error');
assert.ok(hostSource.includes(`case '${ATTENTION_ACTIONS.dismiss.message}':`), 'the host takes the card off the list');
// The pending card shows an engine that can't take the file with why, and never selects it.
assert.ok(panelSource.includes('refusal={refusalOf(engine.id)}'));
assert.ok(hostSource.includes('cannotTakeOnDevice(path.extname(audioPath)'), 'the host decides it before anything starts');

console.log('panelChrome tests passed');
