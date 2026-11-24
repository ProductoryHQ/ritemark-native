import type { LivePause, LivePreference } from '../publish/publishRecords';
import type { LiveResult } from '../publish/liveUpdate';

export type DeckLiveState = {
  on: true;
  state: 'live' | 'updating' | 'paused' | 'offline';
  tooltip: string;
  pause?: LivePause;
  resumeBlocked?: string;
};

interface Update {
  run: (resume: boolean, sending: () => void) => Promise<LiveResult>;
  resume: boolean;
}

interface Activity {
  generation: number;
  updating?: boolean;
  pending?: Update;
  running?: Promise<void>;
  retry?: ReturnType<typeof setTimeout>;
  offline?: string;
  pictures?: string[];
}

const OFFLINE_RETRY_MS = 30_000;
const OFFLINE = 'The page is offline. Your changes are saved on this computer.';

/** One queue per page, activated only by a save or a person's press in an open deck view. */
export class DeckLive {
  private readonly pages = new Map<string, Activity>();

  constructor(private readonly changed: (page: string, result?: LiveResult) => void) {}

  state(page: string, preference: LivePreference): DeckLiveState {
    const activity = this.pages.get(page);
    if (activity?.updating) return { on: true, state: 'updating', tooltip: 'Updating the published page…' };
    if (preference.pause) {
      return {
        on: true, state: 'paused', pause: preference.pause,
        tooltip: `${preference.pause.detail} Open pages keep what they had.`,
      };
    }
    if (activity?.offline) return { on: true, state: 'offline', tooltip: `${OFFLINE} ${activity.offline}` };
    const pictures = activity?.pictures?.length ? ` Sent with new pictures: ${activity.pictures.join(', ')}.` : '';
    return { on: true, state: 'live', tooltip: `Open pages catch up within about 15 seconds.${pictures}` };
  }

  request(page: string, run: Update['run'], resume = false): Promise<void> {
    const activity = this.pages.get(page) ?? { generation: 0 };
    this.pages.set(page, activity);
    activity.pending = { run, resume: resume || activity.pending?.resume === true };
    if (activity.retry && !resume) return Promise.resolve();
    if (activity.retry) clearTimeout(activity.retry);
    activity.retry = undefined;
    return this.start(page, activity);
  }

  private start(page: string, activity: Activity): Promise<void> {
    if (activity.running) return activity.running;
    const drain = async () => {
      while (activity.pending) {
        const update = activity.pending;
        const generation = activity.generation;
        activity.pending = undefined;
        const sending = () => {
          if (activity.generation !== generation || activity.updating) return;
          activity.updating = true;
          this.changed(page);
        };
        const result = await update.run(update.resume, sending).catch((): LiveResult => ({
          kind: 'offline', detail: "Ritemark couldn't prepare the page for an update.",
        }));
        if (this.pages.get(page) !== activity) return;
        if (activity.generation !== generation) continue;
        if (result.kind === 'paused') this.dropPendingSave(activity);
        if (result.kind === 'offline') {
          activity.offline = result.detail;
          // A failed Go on leaves the pause in place and needs another press.
          if (!update.resume) {
            activity.pending ??= update;
            activity.retry = setTimeout(() => {
              activity.retry = undefined;
              void this.start(page, activity);
            }, OFFLINE_RETRY_MS);
          }
        } else {
          activity.offline = undefined;
          if (result.kind === 'updated') activity.pictures = result.pictures;
        }
        this.changed(page, result);
        if (activity.retry || result.kind === 'offline') break;
      }
    };
    activity.running = Promise.resolve().then(drain).finally(() => {
      activity.running = undefined;
      activity.updating = false;
      if (this.pages.get(page) === activity) {
        this.changed(page);
        if (activity.pending && !activity.retry) void this.start(page, activity);
      }
    });
    this.changed(page);
    return activity.running;
  }

  private dropPendingSave(activity: Activity): void {
    if (!activity.pending?.resume) activity.pending = undefined;
  }

  /** In-flight work still owns the page until it settles. Each attempt checks consent again before sending. */
  stop(page: string): void {
    const activity = this.pages.get(page);
    if (!activity) return;
    activity.generation++;
    activity.updating = false;
    clearTimeout(activity.retry);
    activity.pending = undefined;
    activity.retry = undefined;
    activity.offline = undefined;
    activity.pictures = undefined;
    if (!activity.running) this.pages.delete(page);
  }

  dispose(): void {
    for (const page of this.pages.keys()) this.stop(page);
    this.pages.clear();
  }
}
