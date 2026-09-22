/**
 * Which Google Doc belongs to which Markdown file (Sprint 119, R6).
 *
 * The link lives here, in extension global storage, and deliberately not in
 * the Markdown file or its front matter: a copied file or a Save As would
 * otherwise inherit the link and start overwriting someone else's Doc. A
 * rename observed by Ritemark moves the link; a copy made outside Ritemark
 * starts unlinked, because identity is never guessed from a title or content.
 *
 * Storage follows the ConversationStore pattern: injected filesystem, one
 * serialized mutation tail, tmp-then-rename writes. The data is small (one
 * record per published document), so it is one versioned file plus a
 * last-known-good copy rather than a record directory.
 */

import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  nodeConversationStoreFileSystem,
  type ConversationStoreFileSystem,
} from '../conversations/ConversationStore';
import type { GoogleDocsBindingV1 } from './types';

interface StoredBindingsV1 {
  schemaVersion: 1;
  bindings: Record<string, GoogleDocsBindingV1>;
}

export function googleDocsStoreDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'google-docs', 'v1');
}

export type RenameOutcome = 'moved' | 'collision' | 'none';

function isBinding(value: unknown): value is GoogleDocsBindingV1 {
  const b = value as GoogleDocsBindingV1;
  return Boolean(b) && b.schemaVersion === 1
    && typeof b.documentUri === 'string' && typeof b.fileId === 'string' && b.fileId.length > 0
    && typeof b.accountId === 'string' && typeof b.lastRevisionId === 'string';
}

function decode(raw: string): StoredBindingsV1 | null {
  try {
    const value = JSON.parse(raw) as StoredBindingsV1;
    if (value.schemaVersion !== 1 || typeof value.bindings !== 'object' || value.bindings === null) return null;
    const bindings: Record<string, GoogleDocsBindingV1> = {};
    for (const [key, binding] of Object.entries(value.bindings)) {
      if (isBinding(binding) && binding.documentUri === key) bindings[key] = binding;
    }
    return { schemaVersion: 1, bindings };
  } catch {
    return null;
  }
}

export class GoogleDocsBindingStore {
  private readonly file: string;
  private readonly backup: string;
  private data: StoredBindingsV1 | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  /** Set when the stored file could not be read and was set aside. */
  degraded = false;

  constructor(
    readonly baseDir: string,
    private readonly fs: ConversationStoreFileSystem = nodeConversationStoreFileSystem,
    private readonly randomId: () => string = randomUUID,
  ) {
    this.file = path.join(baseDir, 'bindings.json');
    this.backup = path.join(baseDir, 'bindings.last-good.json');
  }

  get(documentUri: string): Promise<GoogleDocsBindingV1 | null> {
    return this.serialized(async () => (await this.load()).bindings[documentUri] ?? null);
  }

  put(binding: GoogleDocsBindingV1): Promise<void> {
    return this.serialized(async () => {
      const data = await this.load();
      await this.write({ ...data, bindings: { ...data.bindings, [binding.documentUri]: binding } });
    });
  }

  remove(documentUri: string): Promise<boolean> {
    return this.serialized(async () => {
      const data = await this.load();
      if (!data.bindings[documentUri]) return false;
      const bindings = { ...data.bindings };
      delete bindings[documentUri];
      await this.write({ ...data, bindings });
      return true;
    });
  }

  /**
   * Follow a rename observed inside Ritemark. If the destination already has a
   * link of its own, nothing moves: choosing between two Google Docs is the
   * user's decision, never ours (R6, fail closed).
   */
  rename(oldUri: string, newUri: string): Promise<RenameOutcome> {
    return this.serialized(async () => {
      const data = await this.load();
      const binding = data.bindings[oldUri];
      if (!binding) return 'none';
      if (data.bindings[newUri]) return 'collision';
      const bindings = { ...data.bindings };
      delete bindings[oldUri];
      bindings[newUri] = { ...binding, documentUri: newUri };
      await this.write({ ...data, bindings });
      return 'moved';
    });
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<StoredBindingsV1> {
    if (this.data) return this.data;
    await this.fs.mkdir(this.baseDir);
    const primary = await this.readDecoded(this.file);
    if (primary.value) {
      this.data = primary.value;
      return this.data;
    }
    const fallback = await this.readDecoded(this.backup);
    if (primary.present) {
      // Set the unreadable file aside instead of deleting it, so it can be
      // inspected; the last good copy (or an empty store) takes over.
      this.degraded = !fallback.value;
      try { await this.fs.rename(this.file, `${this.file}.corrupt-${this.randomId()}`); } catch { /* best effort */ }
    }
    this.data = fallback.value ?? { schemaVersion: 1, bindings: {} };
    return this.data;
  }

  private async readDecoded(file: string): Promise<{ present: boolean; value: StoredBindingsV1 | null }> {
    try {
      return { present: true, value: decode(await this.fs.readFile(file)) };
    } catch {
      return { present: false, value: null };
    }
  }

  private async write(next: StoredBindingsV1): Promise<void> {
    const temp = `${this.file}.tmp-${this.randomId()}`;
    await this.fs.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`);
    await this.fs.rename(temp, this.file);
    this.data = next;
    // The last-good copy trails the primary; losing it only costs a fallback.
    try {
      const backupTemp = `${this.backup}.tmp-${this.randomId()}`;
      await this.fs.writeFile(backupTemp, `${JSON.stringify(next, null, 2)}\n`);
      await this.fs.rename(backupTemp, this.backup);
    } catch { /* best effort */ }
  }
}
