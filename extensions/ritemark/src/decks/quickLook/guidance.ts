import { parsePluginkitState, type PluginkitState } from './pluginkitState';

const confirmedVersions: readonly number[] = require('./confirmedSettingsVersions.json');
export const settingsNote = "Finder can show your decks' first slides. Turn on Ritemark under General → Login Items & Extensions → Quick Look.";
export const settingsHelp = 'Turn on Ritemark in System Settings under Quick Look extensions.';
export const openSettingsLabel = 'Open System Settings';

// CFBundleIdentifier in macos/quicklook/{Thumbnail,Preview}/Info.plist.
export const thumbnailId = 'ai.productory.ritemark.deck-thumbnail';
export const previewId = 'ai.productory.ritemark.deck-preview';
const savedKey = 'ritemark.quickLook.deckSaved';
const retiredKey = 'ritemark.quickLook.guidanceRetired';

export function settingsConfirmed(platform: string, productVersion: string, versions = confirmedVersions): boolean {
  return platform === 'darwin' && /^\d+(?:\.\d+)*$/.test(productVersion) && versions.includes(Number(productVersion.split('.')[0]));
}

interface ProfileState {
  get<T>(key: string): T | undefined;
  update(key: string, value: boolean): Thenable<void>;
}

export class QuickLookGuidance {
  private thumbnail: PluginkitState = 'unknown';
  private running: Promise<void> | undefined;
  private refreshAgain = false;
  private retiring = false;

  constructor(
    private readonly platform: string,
    private readonly profile: ProfileState,
    private readonly query: (id: string) => Promise<string>,
    readonly confirmedSettings: Promise<boolean>,
    private readonly changed: () => void,
    private readonly openSettings: () => PromiseLike<unknown>,
  ) {}

  refresh(): Promise<void> {
    if (this.platform !== 'darwin') return Promise.resolve();
    this.thumbnail = 'unknown';
    if (this.running) {
      this.refreshAgain = true;
      return this.running;
    }
    this.running = this.readElections().finally(() => { this.running = undefined; });
    return this.running;
  }

  private async readElections(): Promise<void> {
    do {
      this.refreshAgain = false;
      const [thumbnail] = await Promise.all([thumbnailId, previewId].map(async id => {
        try {
          return parsePluginkitState(await this.query(id), id);
        } catch {
          return 'unknown';
        }
      }));
      if (!this.refreshAgain) this.thumbnail = thumbnail;
    } while (this.refreshAgain);
    this.changed();
  }

  async deckSaved(): Promise<void> {
    if (this.platform !== 'darwin') return;
    if (!this.profile.get<boolean>(savedKey)) await this.profile.update(savedKey, true);
    await this.refresh();
  }

  async eligible(): Promise<boolean> {
    return await this.confirmedSettings && this.platform === 'darwin' && this.thumbnail === 'off'
      && !!this.profile.get<boolean>(savedKey) && !this.retiring && !this.profile.get<boolean>(retiredKey);
  }

  async retire(open: boolean): Promise<void> {
    if (!(await this.eligible())) return;
    if (this.retiring) return;
    this.retiring = true;
    try {
      await this.profile.update(retiredKey, true);
      if (open) await this.openSettings();
    } finally {
      this.retiring = false;
      this.changed();
    }
  }
}
