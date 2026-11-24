import { realpathSync } from 'node:fs';
import type { DeckPublisher } from '../decks/deckPublish';
import type { LiveSaveReceipt } from '../decks/deckLive';
import type { LiveResult } from '../publish/liveUpdate';
import { normalizeForCompare } from '../utils/pathIdentity';
import type { LiveDeckStep } from '../conversations/types';

type Source = Pick<DeckPublisher, 'onDidSaveLive' | 'onDidUpdateLive'>;

function fileKey(file: string): string {
  try {
    return normalizeForCompare(realpathSync(file));
  } catch {
    return normalizeForCompare(file);
  }
}

export function trackLiveDeckTurn(source: Source, timeoutMs = 30_000) {
  const saves = new Map<LiveSaveReceipt, LiveResult | undefined>();
  let accepting = true;
  let cancelWait: (() => void) | undefined;
  const saved = source.onDidSaveLive(receipt => {
    if (accepting) saves.set(receipt, undefined);
  });
  const updated = source.onDidUpdateLive(({ receipt, result }) => {
    if (receipt && saves.has(receipt)) saves.set(receipt, result);
  });
  const dispose = () => {
    accepting = false;
    cancelWait?.();
    saved.dispose();
    updated.dispose();
    saves.clear();
  };

  return {
    dispose,
    finish(files: string[]): Promise<LiveDeckStep[]> | undefined {
      accepting = false;
      if (!files.length || !saves.size) {
        dispose();
        return;
      }
      const touched = new Set(files.map(fileKey));
      const matching = [...saves.keys()]
        .map(receipt => ({ receipt, key: fileKey(receipt.file) }))
        .filter(({ key }) => touched.has(key));
      if (!matching.length) {
        dispose();
        return;
      }
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<false>(resolve => {
        cancelWait = () => resolve(false);
        timer = setTimeout(cancelWait, timeoutMs);
      });
      const settled = Promise.all(matching.map(({ receipt }) => receipt.settled)).then(() => true);
      return Promise.race([settled, timeout]).then(ready => {
        if (!ready) return [];
        const steps = new Map<string, LiveDeckStep>();
        for (const { receipt, key } of matching) {
          const result = saves.get(receipt);
          if (result?.kind === 'updated') {
            steps.set(key, { type: 'live_deck_updated', message: 'Updated the page' });
          } else if (result?.kind === 'paused') {
            // File-led details quote the file name, so initial-letter casing leaves it intact.
            const detail = result.pause.detail
              .replace(/^Slide (\d+)'s text (?=has what looks like a key\.$)/, 'Slide $1 ')
              .replace(/^\p{Lu}/u, letter => letter.toLowerCase()).replace(/\.$/, '');
            steps.set(key, { type: 'live_deck_paused', message: `The page waits: ${detail}` });
          }
        }
        return [...steps.values()];
      }).finally(() => {
        clearTimeout(timer);
        cancelWait = undefined;
        dispose();
      });
    },
  };
}
