import * as fsp from 'fs/promises';
import * as path from 'path';
import type { ConversationStore } from './ConversationStore';

export type ConversationRolloutMode = 'legacy' | 'host-canonical' | 'host-compat';

interface ConversationMigrationStateV1 {
  schemaVersion: 1;
  authority: 'legacy' | 'host';
  hostAuthorityEstablishedAt: string | null;
}

export interface ConversationCutoverDependencies {
  now?: () => Date;
  readFile?: (file: string) => Promise<string>;
  writeFile?: (file: string, contents: string) => Promise<void>;
  rename?: (from: string, to: string) => Promise<void>;
  mkdir?: (directory: string) => Promise<void>;
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}

export class ConversationCutoverState {
  private readonly file: string;
  private readonly now: () => Date;
  private readonly readFile: (file: string) => Promise<string>;
  private readonly writeFile: (file: string, contents: string) => Promise<void>;
  private readonly rename: (from: string, to: string) => Promise<void>;
  private readonly mkdir: (directory: string) => Promise<void>;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly store: ConversationStore, dependencies: ConversationCutoverDependencies = {}) {
    this.file = path.join(store.baseDir, 'migration.json');
    this.now = dependencies.now ?? (() => new Date());
    this.readFile = dependencies.readFile ?? (async (file) => fsp.readFile(file, 'utf8'));
    this.writeFile = dependencies.writeFile ?? (async (file, contents) => { await fsp.writeFile(file, contents, 'utf8'); });
    this.rename = dependencies.rename ?? fsp.rename;
    this.mkdir = dependencies.mkdir ?? (async (directory) => { await fsp.mkdir(directory, { recursive: true }); });
  }

  resolve(flagEnabled: boolean): Promise<ConversationRolloutMode> {
    return this.serialized(async () => {
      let state = await this.read();
      if (state.authority === 'legacy') {
        const diagnostics = await this.store.getDiagnostics();
        if (diagnostics.recordCount > 0) {
          try {
            state = await this.establishUnlocked(state);
          } catch {
            // The record directory is stronger evidence than the repairable
            // marker. Never expose legacy writes after a canonical record exists.
            return flagEnabled ? 'host-canonical' : 'host-compat';
          }
        }
      }
      if (state.authority === 'legacy') return 'legacy';
      return flagEnabled ? 'host-canonical' : 'host-compat';
    });
  }

  establishHostAuthority(): Promise<void> {
    return this.serialized(async () => {
      await this.establishUnlocked(await this.read());
    });
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private async read(): Promise<ConversationMigrationStateV1> {
    try {
      const value = JSON.parse(await this.readFile(this.file)) as Partial<ConversationMigrationStateV1>;
      if (value.schemaVersion !== 1 || (value.authority !== 'legacy' && value.authority !== 'host')) {
        throw new Error('invalid migration state');
      }
      return {
        schemaVersion: 1,
        authority: value.authority,
        hostAuthorityEstablishedAt: typeof value.hostAuthorityEstablishedAt === 'string' ? value.hostAuthorityEstablishedAt : null,
      };
    } catch (error) {
      if (!isMissing(error)) {
        // Host records are still authoritative even when the marker is damaged;
        // `resolve` repairs the marker from the canonical directory scan.
      }
      return { schemaVersion: 1, authority: 'legacy', hostAuthorityEstablishedAt: null };
    }
  }

  private async establishUnlocked(state: ConversationMigrationStateV1): Promise<ConversationMigrationStateV1> {
    if (state.authority === 'host') return state;
    const next: ConversationMigrationStateV1 = {
      schemaVersion: 1,
      authority: 'host',
      hostAuthorityEstablishedAt: this.now().toISOString(),
    };
    await this.mkdir(this.store.baseDir);
    const temp = `${this.file}.tmp-${process.pid}-${Date.now()}`;
    await this.writeFile(temp, JSON.stringify(next, null, 2));
    await this.rename(temp, this.file);
    return next;
  }
}
