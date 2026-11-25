import assert from 'node:assert/strict';
import { toolStepResult, type ToolStep } from '../../../../src/runtime/toolStep';
import { readSummary, stepLabel, updateStep, visibleStepActivities } from './stepLabel';
import type { AgentProgress } from './types';

function progress(step: ToolStep, tool = 'read_document'): AgentProgress {
  return { type: 'tool_use', message: '', tool, step, timestamp: 0 };
}

// S17: complete four reads, including parallel starts and reversed finishes.
const paths = ['branch manager, Riverside', 'customer service lead', 'head of operations', 'two tellers']
  .map((name) => `02 Interviews/Interview – ${name}.docx`);
let activities = paths.map((path, index) => progress({ id: String(index), kind: 'read', path }));
assert.equal(stepLabel(activities[2])?.label, 'Reading Interview – head of operations');
assert.equal(readSummary(activities, 18000), undefined);
for (const activity of [...activities].reverse()) {
  const step = activity.step!;
  const result = toolStepResult(step, [{ type: 'text', text: 'Interview.docx · Word · 12 blocks · whole text\n\nBody' }], false, true);
  activities = updateStep(activities, progress(result));
}
assert.equal(activities.length, 4);
assert.equal(stepLabel(activities[0])?.label, 'Read Interview – branch manager, Riverside');
assert.equal(stepLabel(activities[0])?.icon, 'file-doc');
assert.equal(readSummary(activities, 18000), 'Read 4 Word documents · 18 s');
assert.equal(readSummary([...activities, activities[0]], 18000), 'Read 4 Word documents · 18 s');

// S18: only the detail contains the command. Exercise native Claude reads too.
const command = 'textutil -convert txt "Reference/Annual report.docx" -stdout';
assert.deepEqual(stepLabel(progress({ id: 'shell', kind: 'shell', command }, 'commandExecution')), {
  label: 'Reading documents', detail: command, warning: false, icon: 'terminal',
});
assert.equal(stepLabel(progress({ id: 'shell', kind: 'shell', command: 'git status' }, 'Bash'))?.label, 'Running a command');
assert.deepEqual(stepLabel(progress({ id: 'native', kind: 'read', path: 'C:\\Reference\\Annual report.PDF', status: 'completed', units: '1 page' }, 'Read')), {
  label: 'Read Annual report · 1 page', detail: 'C:\\Reference\\Annual report.PDF', warning: false, icon: 'file-pdf',
});
assert.equal(stepLabel(progress({ id: 'deck', kind: 'read', path: 'Brief.pptx' }))?.icon, 'file-ppt');

// S19: a deliberate refusal stays a plain tool answer and becomes a warning step.
const request: ToolStep = { id: 'locked', kind: 'read', path: 'Reference/Contract 2025, signed.docx' };
const locked = toolStepResult(request, "Couldn't read Contract 2025, signed.docx: it has a password. Open it in Word.", false, true);
assert.equal(stepLabel(progress(locked))?.label, "Couldn't open Contract 2025, signed · it has a password");
assert.equal(stepLabel(progress(locked))?.warning, true);
assert.equal(readSummary([progress(locked)], 1000), undefined);

// S20: use the returned files, with folder paths and glob patterns kept in the detail.
for (const tool of ['Glob', 'LS']) {
  const folder = toolStepResult(
    { id: tool, kind: 'folder', path: '/project/Reference/', command: '**/*.docx' },
    '/project/Reference/One.docx\n/project/Reference/Two.docx\n/project/Reference/Three.docx\nimage.png',
    false,
  );
  const row = stepLabel(progress(folder, tool));
  assert.equal(row?.label, 'Looked in Reference: 3 Word documents');
  assert.equal(row?.detail, '/project/Reference/\n**/*.docx');
}

// A deck search can make an empty folder lookup before retrying with a wider glob.
const emptyLookup: ToolStep = { id: 'deck-search', kind: 'folder', command: '**/*.deck' };
const wideLookup: ToolStep = { id: 'wide-search', kind: 'folder', path: '.', command: '**/*' };
const empty = progress(toolStepResult(emptyLookup, 'No files found', false), 'Glob');
const counting = progress(wideLookup, 'Glob');
const counted = progress(toolStepResult(wideLookup, 'Brief.docx\nDecision briefing.pptx', false), 'Glob');
const lookups = updateStep(updateStep([empty], counting), counted);
assert.equal(lookups.length, 2);
assert.equal(updateStep(lookups, counting), lookups);
for (const rows of [lookups, [...lookups].reverse()]) {
  assert.deepEqual(visibleStepActivities(rows).map((row) => stepLabel(row)?.label),
    ['Looked in the project folder: 1 Word document, 1 PowerPoint deck']);
}
const elsewhere = progress(toolStepResult({ ...wideLookup, id: 'other', path: 'Reference' }, 'Report.pdf', false), 'Glob');
assert.equal(visibleStepActivities([...lookups, elsewhere]).length, 2);

console.log('stepLabel: S17–S20 and folder retries passed');

for (const tool of ['ToolSearch', 'TodoWrite', 'Task', 'Agent', 'ExitPlanMode', 'EnterPlanMode', 'mcp__server__lookup']) {
  assert.equal(updateStep(activities, { type: 'tool_use', tool, message: `Using ${tool}`, timestamp: 0 }), activities);
}
assert.equal(stepLabel(progress(locked, 'mcp__ritemark_documents__read_document'))?.warning, true);
