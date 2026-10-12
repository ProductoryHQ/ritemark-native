import assert from 'node:assert/strict';
import { buildCardTurn, cardRequestText } from './boardPrompt';
import type { Card } from './cardTypes';

const card: Card = {
  id: 'k3f9x2',
  title: 'Rewrite the launch plan intro',
  doneWhen: 'One paragraph that names the three audiences',
  stage: 'todo',
  rank: 'i',
  files: ['docs/launch-plan.md', 'notes/audiences.md'],
  history: [],
  description: 'Make the intro shorter.\n\n- [ ] Keep the first sentence\n',
};

function main(): void {
  assert.equal(
    cardRequestText(card),
    'Rewrite the launch plan intro\n\nDone when: One paragraph that names the three audiences\n\nMake the intro shorter.\n\n- [ ] Keep the first sentence\n\nFiles: docs/launch-plan.md, notes/audiences.md',
    'the user’s own request: title, Done when, description, files',
  );
  assert.equal(cardRequestText({ ...card, doneWhen: undefined, files: [], description: '  ' }), 'Rewrite the launch plan intro');

  const give = buildCardTurn(card, { kind: 'give' }, { boardTools: true });
  assert.equal(give.displayText, cardRequestText(card), 'no machine instructions in what the conversation shows');
  assert.equal(give.prompt, `${give.displayText}\n\n(This is card k3f9x2 on the project's task board.)`);
  assert.equal(buildCardTurn(card, { kind: 'give' }, { boardTools: false }).prompt, give.displayText, 'without board tools the card line is left out');

  const followUp = buildCardTurn(card, { kind: 'follow-up', text: '  Shorter, please ' }, { boardTools: true });
  assert.equal(followUp.displayText, 'Shorter, please');
  assert.ok(followUp.prompt.endsWith('(This is card k3f9x2 on the project\'s task board.)'));
  assert.equal(buildCardTurn(card, { kind: 'answer', text: 'I choose: Trainers first' }, { boardTools: false }).displayText, 'I choose: Trainers first');
  assert.equal(buildCardTurn(card, { kind: 'retry' }, { boardTools: false }).displayText, cardRequestText(card), 'a retry without words asks for the card again');

  console.log('taskBoard/boardPrompt: all assertions passed');
}

main();
