/**
 * Sprint 148 (R3): this project's tasks, as sources for the index, from the Task
 * board's snapshots (not from `.ritemark/tasks/` as documents). A task is found
 * by its title, its Done when and its description; archived cards too. Its
 * "where" is its state in words: "Waiting for you" while it waits on the person
 * (the Experience lead, question 4), else its column, or "Archived".
 */
import type { BoardCardView, BoardSnapshot } from '../../taskBoard/protocol';
import type { IndexSource } from '../protocol';

const COLUMNS: Record<BoardCardView['stage'], string> = { idea: 'Ideas', todo: 'To do', doing: 'Doing', done: 'Done' };

export function taskState(card: BoardCardView): string {
  if (card.archived !== null) return 'Archived';
  if (card.call !== null) return 'Waiting for you';
  return COLUMNS[card.stage] ?? card.stage;
}

export function taskSource(card: BoardCardView): IndexSource {
  const passages: IndexSource['passages'] = [];
  if (card.doneWhen?.trim()) passages.push({ text: card.doneWhen, at: { field: 'doneWhen' } });
  card.description
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((text, block) => passages.push({ text, at: { field: 'description', block } }));
  return {
    key: `task:${card.id}`,
    kind: 'task',
    name: card.title,
    where: taskState(card),
    changedAt: Date.parse(card.updated ?? card.created ?? '') || 0,
    passages,
  };
}

export function taskSources(snapshot: BoardSnapshot): IndexSource[] {
  return [...snapshot.cards, ...snapshot.archived].map(taskSource);
}
