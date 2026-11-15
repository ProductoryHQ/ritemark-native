/**
 * Decks (Sprint 157, experience 46), composed once at activation: the deck mode of the Ritemark editor. Later parts
 * of the sprint add the Slide library and the AI's deck tools here.
 */

import type * as vscode from 'vscode';
import { DeckPages } from './deckPages';

export interface DecksHost {
  pages: DeckPages;
}

export function registerDecks(_context: vscode.ExtensionContext): DecksHost {
  return { pages: new DeckPages() };
}
