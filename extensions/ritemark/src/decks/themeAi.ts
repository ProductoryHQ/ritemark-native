/**
 * Sprint 162 PR 5 (step-3-themes.md, "Making a theme", "The AI and themes"; frame 13): what the AI's theme tools do in
 * the project, and the change record behind the chat's See what changed and Undo.
 *
 * Every runtime reaches this through the shared deck tools (`ritemarkTools.ts`), never a runtime of its own:
 *   - `read_pptx_theme`: a `.pptx` file's theme colours and fonts (`pptxTheme.ts`);
 *   - `set_deck_theme`: a theme file written in `Slide library/Themes`, and decks pointed at it by their `theme:` line;
 *   - `check_theme_colours`: the five pairs measured, with the nearest colour that passes for each that fails;
 *   - `set_theme_draft_colours`: colours moved in an open theme tab's draft, never saved (the person presses Save).
 *
 * Each write is recorded (`ThemeChangeLedger`) under the chat it came from, and the chat shows See what changed, Undo
 * and Open the theme under the reply. See what changed opens a sheet over the deck's stage (or the theme tab's preview):
 * two slides, each Before in the old theme and After in the new, drawn by the strip's renderer. Undo puts back each
 * deck's `theme:` line and removes a theme the change made only if no deck uses it and nobody changed it since.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { deckName } from './DeckLibrary';
import { frontMatterField, frontMatterLook } from './deckFormat';
import { projectRelative, projectRoot } from './deckDocuments';
import { projectThemeFiles, readProjectTheme, readThemeOrEvening, resolveAssetsIn, type DeckPages } from './deckPages';
import { BUILT_IN_THEME, BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT, parseTheme, pathKey, themeEntries, themeKeyOf, themeOfEntry, THEMES_FOLDER } from './deckTheme';
import { presentSlidesOf } from './present/presentSession';
import { wallSlideOf } from './present/presentProtocol';
import { agendaOf, slidePicturePaths } from './blocks/slideRenderer';
import { readPptxTheme } from './pptxTheme';
import {
  aiThemeText, changeSlideIndexes, checkWords, colourFixes, colourPairs, PAIR_FIELD_NAMES, pairsReport, suggestedFixes, ThemeChangeLedger, themeChangesOf, themeLineFor,
  hasFrontMatter, themeLineOf, undoPlan, undoWords, withThemeLine, type AiThemeFields, type PairField, type ThemeChangeRecord, type ThemeChangeView,
} from './themeChange';
import { newThemeNameProblem, themeNameProblem, themePathFor, themeTextWith } from './themeFile';
import { ensureProjectSubfolder } from '../projects/projectFolderGuard';
import type { DeckLibrary } from './DeckLibrary';
import { replaceText, type ThemePages } from './themePages';

/** What the chat shows under a reply for one change. */
export interface ThemeChangeChip {
  id: string;
  kind: 'theme' | 'draft';
  themeName: string;
  /** Undone already, with what Undo said. */
  undone?: string;
}

const RITEMARK_EDITOR = 'ritemark.editor';
/** A `.pptx` larger than this is not read for its theme. */
const MAX_PPTX_BYTES = 50 * 1024 * 1024;
/** Stands for a theme whose tab holds a draft: never the text a change wrote, so Undo keeps the file. */
const DRAFTED = '\u0000a draft in its tab';

function openDocument(absolute: string): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find(document => document.uri.scheme === 'file' && path.normalize(document.uri.fsPath).toLowerCase() === path.normalize(absolute).toLowerCase());
}

/** A path from the tool, inside the project, with `/`; or an error the AI can act on. */
function projectPath(root: string, value: string): { relative: string; absolute: string } {
  const absolute = path.resolve(root, ...value.replace(/\\/g, '/').split('/'));
  const relative = projectRelative(root, absolute);
  if (!relative) throw new Error(`${value} is not inside this project.`);
  return { relative, absolute };
}

/** The document's text becomes `text` (the theme tab's own minimal edit), saved when it was clean before. */
async function writeOpen(document: vscode.TextDocument, text: string): Promise<boolean> {
  if (document.getText() === text) return true;
  const wasDirty = document.isDirty;
  if (!(await replaceText(document, text))) return false;
  if (!wasDirty) await document.save();
  return true;
}

/** A file written whole: beside it, then moved over it. */
async function writeWhole(absolute: string, text: string): Promise<void> {
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporary, text, 'utf8');
  await fs.promises.rename(temporary, absolute);
}

/** A deck's text: its open document's (unsaved words with it), else the file's; null when there is none. */
async function deckText(absolute: string): Promise<string | null> {
  const open = openDocument(absolute);
  if (open) return open.getText();
  try {
    return await fs.promises.readFile(absolute, 'utf8');
  } catch {
    return null;
  }
}

async function writeDeck(absolute: string, text: string): Promise<void> {
  const open = openDocument(absolute);
  if (open) {
    if (!(await writeOpen(open, text))) throw new Error(`${path.basename(absolute)} could not be changed.`);
    return;
  }
  await writeWhole(absolute, text);
}

export class ThemeAi implements vscode.Disposable {
  readonly ledger = new ThemeChangeLedger();
  private readonly added = new vscode.EventEmitter<{ conversationId: string; chip: ThemeChangeChip }>();
  /** A change was recorded for this chat: the chat shows its See what changed, Undo and Open the theme. */
  readonly onDidAdd = this.added.event;
  private readonly undone = new vscode.EventEmitter<{ id: string; words: string }>();
  /** A change was undone (from the chat or a sheet): the chat says what Undo did. */
  readonly onDidUndo = this.undone.event;

  constructor(private readonly library: () => DeckLibrary | null, private readonly decks: DeckPages, private readonly themes: ThemePages) {}

  private rootOrThrow(): string {
    const root = projectRoot();
    if (!root || !this.library()) throw new Error('Themes need a project folder in this window (and decks turned on).');
    return root;
  }

  // ── read_pptx_theme ──────────────────────────────────────────────────────

  async readPptx(file: string): Promise<{ text: string; isError?: boolean }> {
    const root = this.rootOrThrow();
    const { relative, absolute } = projectPath(root, file);
    if (!/\.pptx$/i.test(relative)) return { text: `${relative} is not a .pptx file.`, isError: true };
    let bytes: Buffer;
    try {
      const real = await fs.promises.realpath(absolute);
      if (!projectRelative(await fs.promises.realpath(root), real)) return { text: `${relative} is outside this project.`, isError: true };
      const stat = await fs.promises.stat(real);
      if (!stat.isFile()) return { text: `${relative} is not a file.`, isError: true };
      if (stat.size > MAX_PPTX_BYTES) return { text: `${relative} is too large to read.`, isError: true };
      bytes = await fs.promises.readFile(real);
    } catch {
      return { text: `There is no file at ${relative}.`, isError: true };
    }
    const result = await readPptxTheme(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    if (!result.ok) return { text: `${relative}: ${result.problem}`, isError: true };
    return { text: JSON.stringify(result.theme) };
  }

  // ── set_deck_theme ───────────────────────────────────────────────────────

  async setDeckTheme(
    conversationId: string | null,
    input: { name: string; fields: AiThemeFields; decks: string[] },
    approve?: (request: { filePath: string; diff?: string }) => Promise<boolean>,
  ): Promise<{ text: string; isError?: boolean }> {
    const root = this.rootOrThrow();
    const name = input.name.trim();
    const problem = themeNameProblem(name);
    if (problem) return { text: problem, isError: true };
    const parsed = themeChangesOf(input.fields);
    if (!parsed.ok) return { text: parsed.problem, isError: true };
    // The theme by this name, whatever its case: its file's name or the name it holds. A theme the project has is changed
    // in place; a new one follows the tab's naming rule (one name is one look in a project, Evening included).
    const files = await projectThemeFiles(root);
    const lower = name.toLowerCase();
    const existing = files.find(file => pathKey(file.path) === pathKey(themePathFor(name)))
      ?? files.find(file => parseTheme(file.text).name.trim().toLowerCase() === lower)
      ?? null;
    if (!existing) {
      if (lower === BUILT_IN_THEME.name.toLowerCase()) {
        return { text: `${BUILT_IN_THEME.name} is Ritemark's built-in theme, which every deck without a theme draws. Make a new theme with a name of its own.`, isError: true };
      }
      const folderFiles = await fs.promises.readdir(path.join(root, THEMES_FOLDER)).catch(() => [] as string[]);
      const taken = newThemeNameProblem(name, { names: themeEntries(files, []).map(entry => themeOfEntry(entry).name), files: folderFiles });
      if (taken) return { text: taken, isError: true };
    }
    const themePath = existing?.path ?? themePathFor(name);
    const themeAbsolute = path.join(root, ...themePath.split('/'));
    const openTheme = openDocument(themeAbsolute);
    if (openTheme?.isDirty) {
      return { text: `${name}'s tab has changes that aren't saved. Ask the user to save or discard them first, then try again.`, isError: true };
    }
    if (!existing) {
      const missing = (['background', 'headings', 'text', 'accent'] as const).filter(key => input.fields[key] === undefined);
      if (missing.length) return { text: `A new theme needs all four colours. Missing: ${missing.join(', ')}.`, isError: true };
    }
    const themeBefore = existing?.text ?? null;
    const themeAfter = aiThemeText(themeBefore, name, parsed.changes);

    // The decks: each a `.deck.md` in the project, by its path as the project writes it (the case the AI typed may
    // differ); its line before and after.
    const deckChanges: ThemeChangeRecord['decks'] = [];
    const deckTexts = new Map<string, { absolute: string; text: string }>();
    const known = input.decks.length ? (await this.library()?.deckThemeList().catch(() => []) ?? []).map(deck => deck.path) : [];
    for (const value of input.decks) {
      const given = projectPath(root, value);
      const relative = known.find(entry => entry.toLowerCase() === given.relative.toLowerCase()) ?? given.relative;
      const absolute = path.join(root, ...relative.split('/'));
      if (!/\.deck\.md$/i.test(relative)) return { text: `${value} is not a deck. Use list_decks to find one.`, isError: true };
      const text = await deckText(absolute);
      if (text === null) return { text: `There is no deck at ${relative}. Use list_decks to find one.`, isError: true };
      const before = themeLineOf(text);
      const after = themeLineFor(themePath);
      if (before === after || deckChanges.some(deck => deck.path === relative)) continue;
      const named = frontMatterField(text.replace(/^﻿/, ''), 'theme');
      const drew = pathKey(named ?? '') === pathKey(themePath) ? themeBefore : await readThemeOrEvening(root, named);
      deckChanges.push({ path: relative, before, after, themeBefore: drew ?? BUILT_IN_THEME_TEXT, ...(hasFrontMatter(text) ? {} : { madeFrontMatter: true }) });
      deckTexts.set(relative, { absolute, text });
    }
    if (themeBefore === themeAfter && deckChanges.length === 0) {
      return { text: `${name} already has these settings${input.decks.length ? ' and the decks already use it' : ''}. Nothing changed.` };
    }

    // Ask mode: the person approves the whole change first, on the unified approval card (what the theme file will hold,
    // and each deck's line before and after); a no writes nothing.
    if (approve) {
      const diff = [
        themeBefore === themeAfter ? `${themePath}: unchanged` : `${themePath}${existing ? '' : ' (new)'}:\n${themeAfter.trimEnd()}`,
        ...deckChanges.map(deck => `${deck.path}:\n- ${deck.before ?? '(no theme line)'}\n+ ${deck.after}`),
      ].join('\n\n');
      const files = [themePath, ...deckChanges.map(deck => deck.path)];
      const approved = await approve({ filePath: files.length > 1 ? `${themePath} and ${deckChanges.length} deck${deckChanges.length === 1 ? '' : 's'}` : themePath, diff });
      if (!approved) return { text: 'The user declined the theme change, so nothing was written. Ask what they would like instead.' };
      // The card may have waited a while: the theme as approved, and each deck as it is now (its own words since kept)
      const themeNow = existing ? await readProjectTheme(root, themePath) : (fs.existsSync(themeAbsolute) ? '' : null);
      if (themeNow !== themeBefore || openDocument(themeAbsolute)?.isDirty) {
        return { text: `${name} changed while the user was asked, so nothing was written. Read it again and ask once more.`, isError: true };
      }
      for (const deck of deckChanges) {
        const entry = deckTexts.get(deck.path)!;
        const fresh = await deckText(entry.absolute);
        if (fresh === null) return { text: `${deck.path} is gone, so nothing was written.`, isError: true };
        entry.text = fresh;
        deck.before = themeLineOf(fresh);
        deck.madeFrontMatter = !hasFrontMatter(fresh);
      }
    }

    // The theme file first: a deck never names a file that isn't there.
    if (themeBefore !== themeAfter) {
      try {
        if (existing) {
          await writeWhole(themeAbsolute, themeAfter);
        } else {
          const folder = await ensureProjectSubfolder(root, THEMES_FOLDER);
          const [realRoot, realFolder] = await Promise.all([fs.promises.realpath(root), fs.promises.realpath(folder)]);
          if (!projectRelative(realRoot, realFolder)) return { text: 'The Themes folder is outside the project, so the theme was not written.', isError: true };
          await fs.promises.writeFile(themeAbsolute, themeAfter, { encoding: 'utf8', flag: 'wx' });
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | null)?.code;
        return { text: code === 'EEXIST' ? `There's a file called ${path.basename(themeAbsolute)} already.` : `The theme file could not be written: ${String(error)}`, isError: true };
      }
    }
    const written: string[] = [];
    let failed: string | null = null;
    for (const deck of deckChanges) {
      const entry = deckTexts.get(deck.path)!;
      try {
        await writeDeck(entry.absolute, withThemeLine(entry.text, deck.after));
        written.push(deck.path);
      } catch (error) {
        // What was written stays recorded below, so its Undo is there; the decks after this one are left alone.
        failed = `${deck.path} could not be changed: ${error instanceof Error ? error.message : String(error)}`;
        break;
      }
    }
    void this.decks.themeFilesChanged(themePath);
    const changedDecks = deckChanges.filter(deck => written.includes(deck.path));

    // The record: joined to this chat's last one for the same theme, so one Undo takes the whole change back.
    const joined = this.ledger.joinable(conversationId, 'theme', themePath, themeBefore);
    let record: ThemeChangeRecord;
    if (joined) {
      joined.themeAfter = themeAfter;
      joined.themeName = name;
      for (const deck of changedDecks) {
        const at = joined.decks.findIndex(entry => entry.path === deck.path);
        // A deck that was only shown is a change of its own now: its line before this write is the one Undo puts back.
        if (at >= 0 && joined.decks[at].shownOnly) joined.decks[at] = deck;
        else if (at >= 0) joined.decks[at].after = deck.after;
        else joined.decks.push(deck);
      }
      record = joined;
    } else {
      const shown = changedDecks[0]?.path ?? (await this.firstDeckUsing(root, themePath));
      record = this.ledger.add({
        conversationId, kind: 'theme', themePath, themeName: name, themeBefore, themeAfter,
        decks: changedDecks.length ? changedDecks : shown ? [{ path: shown, before: null, after: '', themeBefore: themeBefore ?? BUILT_IN_THEME_TEXT, shownOnly: true }] : [],
        moved: [],
      });
      if (conversationId) this.added.fire({ conversationId, chip: { id: record.id, kind: 'theme', themeName: name } });
    }

    const pairs = colourPairs(parseTheme(themeAfter));
    const failing = pairs.filter(pair => !pair.ok);
    const others = await this.otherDecks(new Set(written));
    if (failed) {
      return {
        text: `${existing ? 'Changed' : 'Made'} ${themePath}${written.length ? ` and pointed ${written.map(deckName).join(', ')} at it` : ''}, but ${failed}. Tell the user; Undo under your reply takes back what was written.`,
        isError: true,
      };
    }
    return {
      text: [
        `${existing ? 'Changed' : 'Made'} ${themePath}.`,
        written.length ? `${written.map(deckName).join(', ')} ${written.length === 1 ? 'uses' : 'use'} it now.` : 'No deck was pointed at it.',
        others.length ? `Other decks in the project keep their themes: ${others.slice(0, 8).map(deckName).join(', ')}${others.length > 8 ? '…' : ''}.` : '',
        'The colours, measured:',
        pairsReport(parseTheme(themeAfter)),
        failing.length ? 'Some pairs fail: call set_deck_theme again with colours that pass (check_theme_colours suggests the nearest ones), or tell the user why you kept them.' : 'All five pairs pass.',
        'Ritemark shows See what changed, Undo and Open the theme under your reply: say in one or two sentences what you took from where, and do not repeat the file.',
      ].filter(Boolean).join('\n'),
    };
  }

  /** The first deck (by name) that draws this theme, for See what changed when no deck's line changed. */
  private async firstDeckUsing(root: string, themePath: string): Promise<string | null> {
    const library = this.library();
    if (!library) return null;
    const entries = themeEntries(await projectThemeFiles(root), []);
    const list = await library.deckThemeList().catch(() => []);
    const using = list.filter(deck => themeKeyOf(deck.theme, entries) === themeKeyOf(themePath, entries)).map(deck => deck.path).sort();
    return using[0] ?? null;
  }

  private async otherDecks(changed: ReadonlySet<string>): Promise<string[]> {
    const library = this.library();
    if (!library) return [];
    return (await library.deckThemeList().catch(() => [])).map(deck => deck.path).filter(deckPath => !changed.has(deckPath) && !deckPath.startsWith('Slide library/')).sort();
  }

  // ── check_theme_colours and set_theme_draft_colours ──────────────────────

  /** The theme's text as the person sees it: its open tab's draft, else its file, else the built-in theme. */
  private async themeTextNow(root: string, themePath: string): Promise<{ text: string; draft: vscode.TextDocument | null }> {
    const absolute = path.join(root, ...themePath.split('/'));
    const open = openDocument(absolute);
    if (open) return { text: open.getText(), draft: this.themes.hasView(open) ? open : null };
    // Only Evening's own path falls back to the built-in theme: a theme that isn't there is said so (Codex on #783)
    const text = await readProjectTheme(root, themePath);
    if (text === null && pathKey(themePath) !== pathKey(BUILT_IN_THEME_PATH)) throw new Error(`There is no theme at ${themePath}. Use list_decks to see each deck's theme.`);
    return { text: text ?? BUILT_IN_THEME_TEXT, draft: null };
  }

  private themePathOf(root: string, value: string): string {
    const { relative } = projectPath(root, value);
    if (!/\.theme\.md$/i.test(relative)) throw new Error(`${value} is not a theme file (Slide library/Themes/<Name>.theme.md).`);
    return relative;
  }

  async checkColours(themeValue: string): Promise<{ text: string; isError?: boolean }> {
    const root = this.rootOrThrow();
    const themePath = this.themePathOf(root, themeValue);
    const { text } = await this.themeTextNow(root, themePath);
    const theme = parseTheme(text);
    const fixes = suggestedFixes(theme);
    return {
      text: [
        `${theme.name}: five pairs, on the card and borderless, against 4.5 to 1 for text and 3 to 1 for accents.`,
        pairsReport(theme),
        fixes.length
          ? `The nearest colours that pass: ${fixes.map(fix => `${PAIR_FIELD_NAMES[fix.field]} ${fix.from} → ${fix.to}`).join('; ')}.`
          : colourPairs(theme).every(pair => pair.ok) ? 'All pass: change nothing.' : 'A borderless pair fails because of the theme\'s hand-picked borderless shades; changing any colour lets Ritemark work them out again.',
      ].join('\n'),
    };
  }

  async setDraftColours(conversationId: string | null, themeValue: string, colours: Partial<Record<'text' | 'headings' | 'accent', string>>): Promise<{ text: string; isError?: boolean }> {
    const root = this.rootOrThrow();
    const themePath = this.themePathOf(root, themeValue);
    const { text: before, draft } = await this.themeTextNow(root, themePath);
    if (!draft) return { text: `${themePath} isn't open in its tab, so there is no draft to change. Ask the user to open the theme (Edit in the deck's Theme menu) and run the check again.`, isError: true };
    const fields: AiThemeFields = { ...(colours.text ? { text: colours.text } : {}), ...(colours.headings ? { headings: colours.headings } : {}), ...(colours.accent ? { accent: colours.accent } : {}) };
    const parsed = themeChangesOf(fields);
    if (!parsed.ok) return { text: parsed.problem, isError: true };
    const theme = parseTheme(before);
    const after = themeTextWith(before, parsed.changes);
    if (after === before) return { text: 'Those are the colours the draft has already. Nothing changed.' };
    if (!(await this.themes.draftChange(draft, after))) return { text: 'The draft could not be changed.', isError: true };
    const now = parseTheme(after);
    const moved = (['text', 'head', 'accent'] as PairField[])
      .filter(field => theme[field] !== now[field])
      .map(field => ({ field, from: theme[field], to: now[field] }));
    const joined = this.ledger.joinable(conversationId, 'draft', themePath, before);
    if (joined) {
      joined.themeAfter = after;
      for (const move of moved) {
        const earlier = joined.moved.find(entry => entry.field === move.field);
        if (earlier) earlier.to = move.to;
        else joined.moved.push(move);
      }
    } else {
      const record = this.ledger.add({ conversationId, kind: 'draft', themePath, themeName: theme.name, themeBefore: before, themeAfter: after, decks: [], moved });
      if (conversationId) this.added.fire({ conversationId, chip: { id: record.id, kind: 'draft', themeName: theme.name } });
    }
    return {
      text: [
        `Moved in ${theme.name}'s draft (not saved): ${moved.map(move => `${PAIR_FIELD_NAMES[move.field]} ${move.from} → ${move.to}`).join('; ')}.`,
        pairsReport(now),
        'The decks get it when the user presses Save in the theme\'s tab. Name each pair you moved, from what to what, in your reply; Ritemark shows See what changed and Undo under it.',
      ].join('\n'),
    };
  }

  // ── Undo, See what changed, Open the theme ───────────────────────────────

  /** Undos running, by change: a second press while one runs gets the same answer, never a second Undo. */
  private readonly undoing = new Map<string, Promise<string>>();

  undo(id: string): Promise<string> {
    const running = this.undoing.get(id);
    if (running) return running;
    const run = this.runUndo(id).finally(() => this.undoing.delete(id));
    this.undoing.set(id, run);
    return run;
  }

  private async runUndo(id: string): Promise<string> {
    const record = this.ledger.get(id);
    const root = projectRoot();
    if (!record || !root) {
      // A change from before a window reload (the record is in memory only): said where the press was, nothing touched
      const words = 'This change can no longer be undone here: the window was reloaded since.';
      this.undone.fire({ id, words });
      return words;
    }
    if (record.undone) return 'Already undone.';
    const result = record.kind === 'draft' ? await this.undoDraft(root, record) : await this.undoTheme(root, record);
    if (result.done) {
      record.undone = true;
      this.undone.fire({ id, words: result.words });
    } else {
      void vscode.window.showInformationMessage(result.words);
    }
    return result.words;
  }

  private async undoDraft(root: string, record: ThemeChangeRecord): Promise<{ words: string; done: boolean }> {
    const { text, draft } = await this.themeTextNow(root, record.themePath);
    // Its tab is closed: the draft is gone (discarded or saved), so there is nothing here to put back yet
    if (!draft) return { words: `Open ${record.themeName}'s tab to undo the colour check: its draft isn't open.`, done: false };
    const theme = parseTheme(text);
    const back: Partial<Record<'bg' | 'head' | 'text' | 'accent', string>> = {};
    for (const move of record.moved) if (theme[move.field] === move.to) back[move.field] = move.from;
    const keep = Object.keys(back).length === 0;
    if (!keep && !(await this.themes.draftChange(draft, themeTextWith(text, back)))) {
      return { words: `Couldn't put ${record.themeName}'s colours back: its tab closed. Open it and try Undo again.`, done: false };
    }
    return { words: undoWords(record, { decks: [], keptDecks: [], theme: keep ? { action: 'keep', reason: 'changed' } : { action: 'none' } }, deckName), done: true };
  }

  private async undoTheme(root: string, record: ThemeChangeRecord): Promise<{ words: string; done: boolean }> {
    const changed = record.decks.filter(deck => !deck.shownOnly);
    const deckLines: Record<string, string | null | undefined> = {};
    const texts = new Map<string, string>();
    for (const deck of changed) {
      const text = await deckText(path.join(root, ...deck.path.split('/')));
      deckLines[deck.path] = text === null ? undefined : themeLineOf(text);
      if (text !== null) texts.set(deck.path, text);
    }
    const themeAbsolute = path.join(root, ...record.themePath.split('/'));
    const openTheme = openDocument(themeAbsolute);
    // A theme with a draft in its tab is the person's now: its file is kept whatever it holds.
    const themeText = openTheme?.isDirty ? DRAFTED : await readProjectTheme(root, record.themePath);
    const library = this.library();
    const list = library ? await library.deckThemeList().catch(() => []) : [];
    const entries = themeEntries(await projectThemeFiles(root), []);
    const key = themeKeyOf(record.themePath, entries);
    const plan = undoPlan({ ...record, decks: changed }, {
      deckLines,
      themeText,
      decksUsingAfter: reverted => list.filter(deck => !reverted.has(deck.path) && themeKeyOf(deck.theme, entries) === key).length,
    });
    const stuck: string[] = [];
    for (const deck of plan.decks) {
      const text = texts.get(deck.path);
      if (text === undefined) continue;
      try {
        await writeDeck(path.join(root, ...deck.path.split('/')), withThemeLine(text, deck.line, { dropEmpty: deck.dropEmpty }));
        // Put back: a second Undo after a failure leaves it out, never "changed since"
        record.decks = record.decks.filter(entry => entry.path !== deck.path);
      } catch (error) {
        console.warn('[Themes] Undo could not change a deck:', error);
        stuck.push(deck.path);
      }
    }
    if (stuck.length) {
      // A deck still names the theme: it stays, and the change can be undone again once the deck can be written
      void this.decks.themeFilesChanged(record.themePath);
      return { words: `Couldn't put ${stuck.map(deckName).join(', ')} back, so ${record.themeName} stays. Try Undo again.`, done: false };
    }
    if (plan.theme.action === 'remove') {
      if (openTheme) {
        // Its tab closes with the file: nothing of it is the person's.
        for (const group of vscode.window.tabGroups.all) {
          for (const tab of group.tabs) {
            const input = tab.input as { uri?: vscode.Uri } | undefined;
            if (input?.uri && path.normalize(input.uri.fsPath).toLowerCase() === path.normalize(themeAbsolute).toLowerCase()) await vscode.window.tabGroups.close(tab).then(undefined, () => undefined);
          }
        }
      }
      await vscode.workspace.fs.delete(vscode.Uri.file(themeAbsolute), { useTrash: true }).then(undefined, async () => fs.promises.unlink(themeAbsolute).catch(() => undefined));
    } else if (plan.theme.action === 'restore') {
      await writeWhole(themeAbsolute, plan.theme.text);
    }
    void this.decks.themeFilesChanged(record.themePath);
    return { words: undoWords({ ...record, decks: changed }, plan, deckName), done: true };
  }

  /** See what changed: the sheet over the deck's stage (a theme) or the theme tab's preview (a draft). */
  async show(id: string): Promise<string | null> {
    const record = this.ledger.get(id);
    const root = projectRoot();
    if (!record || !root) return 'This change can no longer be shown here (the window was reloaded since).';
    if (record.kind === 'draft') {
      const absolute = path.join(root, ...record.themePath.split('/'));
      const shown = await this.themes.showChange(absolute, webview => this.viewOf(record, null, webview));
      return shown ? null : `Open ${record.themeName}'s tab to see what changed.`;
    }
    const deck = record.decks[0];
    if (!deck) return 'No deck uses this theme, so there is nothing to show it on.';
    const absolute = path.join(root, ...deck.path.split('/'));
    if (!fs.existsSync(absolute)) return `${deckName(deck.path)} is gone.`;
    this.decks.themeChangeWhenShown(absolute, async webview => this.viewOf(record, (await deckText(absolute)) ?? '', webview, path.dirname(absolute)));
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(absolute), RITEMARK_EDITOR, { preview: false });
    return null;
  }

  /** The sheet's content: the two slides, the themes before and after, and the pictures they name. */
  private viewOf(record: ThemeChangeRecord, text: string | null, webview: vscode.Webview, folder?: string): ThemeChangeView {
    const deck = record.decks[0];
    const beforeText = record.kind === 'draft' ? record.themeBefore ?? BUILT_IN_THEME_TEXT : deck?.themeBefore ?? record.themeBefore ?? BUILT_IN_THEME_TEXT;
    let slides: ThemeChangeView['slides'] = [];
    let agenda: ThemeChangeView['agenda'];
    let assets: Record<string, string> = {};
    let borderless = false;
    if (text !== null) {
      const shown = presentSlidesOf(text).filter(slide => !slide.skip).map(wallSlideOf);
      slides = changeSlideIndexes(shown).map(index => shown[index]);
      agenda = agendaOf(shown);
      borderless = frontMatterLook(text) === 'borderless';
      const pictures = [...new Set(slides.flatMap(slide => slidePicturePaths(slide.data)))];
      if (folder && pictures.length) assets = resolveAssetsIn(folder, webview, pictures);
    }
    // A draft's before and after are the same theme: the after is named as the tab shows it, not saved
    const afterName = record.kind === 'draft' ? `${parseTheme(record.themeAfter).name}, not saved` : parseTheme(record.themeAfter).name;
    // A colour change names each pair it moved, with its ratios before and after, in the sheet's header
    const pairsBefore = colourPairs(parseTheme(beforeText));
    const pairsAfter = colourPairs(parseTheme(record.themeAfter));
    const moved = record.moved.flatMap(move => {
      const at = pairsBefore.findIndex(pair => pair.field === move.field);
      return at < 0 ? [] : [{ label: pairsBefore[at].label, from: move.from, to: move.to, fromRatio: pairsBefore[at].ratio, toRatio: pairsAfter[at].ratio }];
    });
    return {
      id: record.id,
      before: { name: parseTheme(beforeText).name, text: beforeText },
      after: { name: afterName, text: record.themeAfter },
      slides,
      ...(agenda ? { agenda } : {}),
      borderless,
      assets,
      undone: record.undone,
      ...(moved.length ? { moved } : {}),
    };
  }

  /** Open the theme: its tab, previewing the deck the change was made for. */
  async openTheme(id: string): Promise<void> {
    const record = this.ledger.get(id);
    const root = projectRoot();
    if (!record || !root) return;
    const absolute = path.join(root, ...record.themePath.split('/'));
    if (!fs.existsSync(absolute)) {
      void vscode.window.showInformationMessage(`${record.themeName} is no longer in Slide library › Themes.`);
      return;
    }
    const deck = record.decks[0] ? openDocument(path.join(root, ...record.decks[0].path.split('/'))) : undefined;
    if (deck) await this.themes.open(deck, record.themePath);
    else await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(absolute), RITEMARK_EDITOR, { preview: false });
  }

  /**
   * The theme tab's contrast line (the Experience lead, 17 November): Check all colours measures the five pairs; Fix the
   * colours moves each failing colour's lightness by the least amount that passes, its hue kept, into the draft (never
   * saved), with See what changed over the preview and Undo. Ritemark's own: no AI. Answers the line's words.
   */
  async checkColoursInTab(document: vscode.TextDocument, fix: boolean): Promise<string> {
    const root = projectRoot();
    const themePath = root ? projectRelative(root, document.uri.fsPath) : null;
    const before = document.getText();
    const theme = parseTheme(before);
    if (!fix || !themePath) return checkWords(theme, null);
    const fixes = colourFixes(theme);
    if (!fixes.moved.length) return checkWords(theme, fixes);
    const after = themeTextWith(before, fixes.changes);
    if (!(await this.themes.draftChange(document, after))) return 'The draft could not be changed.';
    const record = this.ledger.add({
      conversationId: null, kind: 'draft', themePath, themeName: theme.name, themeBefore: before, themeAfter: after, decks: [],
      moved: fixes.moved.map(entry => ({ field: entry.field, from: entry.from, to: entry.to })),
    });
    await this.show(record.id);
    return checkWords(parseTheme(after), fixes);
  }

  dispose(): void {
    this.added.dispose();
    this.undone.dispose();
  }
}

