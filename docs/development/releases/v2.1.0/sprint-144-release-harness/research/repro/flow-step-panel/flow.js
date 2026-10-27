// The flow the harness opens: Trigger -> LLM step -> Save file.
// A script rather than JSON so the harness also works opened as file://.
window.HARNESS_FLOW = {
  id: 'weekly-brief-p4h1',
  name: 'Weekly brief',
  description: "Drafts the week's brief from a topic",
  version: 1,
  created: '2026-10-27T08:00:00.000Z',
  modified: '2026-10-27T08:00:00.000Z',
  inputs: [{ id: 'input-topic', type: 'text', label: 'Topic', required: true }],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 120, y: 40 },
      data: {
        label: 'Trigger',
        inputs: [{ id: 'input-topic', type: 'text', label: 'Topic', required: true, defaultValue: '' }],
      },
    },
    {
      id: 'llm-1',
      type: 'llm-prompt',
      position: { x: 120, y: 200 },
      data: {
        label: 'Write the draft',
        provider: 'openai',
        model: 'sample-openai-default',
        systemPrompt: 'You write short, plain weekly briefs for a leadership team.',
        userPrompt: 'Write a one-page brief about {Topic}. Keep it under 300 words.',
        temperature: 0.7,
        maxTokens: 2000,
      },
    },
    {
      id: 'save-1',
      type: 'save-file',
      position: { x: 120, y: 360 },
      data: { label: 'Save the brief', format: 'markdown', outputFolder: 'Drafts', filename: 'weekly-brief.md' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'llm-1' },
    { id: 'e2', source: 'llm-1', target: 'save-1' },
  ],
};
