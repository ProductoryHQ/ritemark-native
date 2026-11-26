import { parsePluginkitState, type PluginkitState } from './pluginkitState';

const confirmedVersions: readonly number[] = require('./confirmedSettingsVersions.json');
export const settingsNote = "Finder can show your decks' first slides. Turn on Ritemark under General → Login Items & Extensions → Quick Look.";
export const settingsHelp = "To show your decks' first slides in Finder, turn on Ritemark's Quick Look extension in your Mac's settings, under Extensions.";
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
  private openOnRetire = false;

  constructor(
    private readonly platform: string,
    private readonly profile: ProfileState,
    private readonly query: (id: string) => Promise<string>,
    private readonly confirmedSettings: () => Promise<boolean>,
    private readonly changed: () => void,
    private readonly openSettings: () => PromiseLike<unknown>,
    private readonly available: () => Promise<boolean>,
  ) {}

  async refresh(): Promise<void> {
    if (!await this.canQuery()) {
      if (this.thumbnail === 'off') {
        this.thumbnail = 'unknown';
        this.changed();
      }
      return;
    }
    this.thumbnail = 'unknown';
    if (this.running) {
      this.refreshAgain = true;
      return this.running;
    }
    this.running = this.readElections().finally(() => { this.running = undefined; });
    return this.running;
  }

  private async canQuery(): Promise<boolean> {
    return this.platform === 'darwin' && !this.isRetired()
      && await this.available() && await this.confirmedSettings() && !this.isRetired();
  }

  private isRetired(): boolean {
    return this.retiring || !!this.profile.get<boolean>(retiredKey);
  }

  private async readElections(): Promise<void> {
    do {
      this.refreshAgain = false;
      const thumbnail = await this.query(thumbnailId)
        .then(output => parsePluginkitState(output, thumbnailId), () => 'unknown' as const);
      if (!this.refreshAgain) this.thumbnail = thumbnail;
    } while (this.refreshAgain && await this.canQuery());
    this.changed();
  }

  async deckSaved(): Promise<void> {
    if (this.platform !== 'darwin') return;
    if (!this.profile.get<boolean>(savedKey)) await this.profile.update(savedKey, true);
    await this.refresh();
  }

  async eligible(): Promise<boolean> {
    return this.thumbnail === 'off' && !!this.profile.get<boolean>(savedKey)
      && await this.canQuery() && this.thumbnail === 'off';
  }

  async retire(open: boolean): Promise<void> {
    // The visible note can outlive a refresh or a dismissal in another window.
    this.openOnRetire ||= open;
    if (this.retiring) {
      this.changed();
      return;
    }
    this.retiring = true;
    try {
      if (!this.profile.get<boolean>(retiredKey)) await this.profile.update(retiredKey, true);
    } finally {
      this.retiring = false;
      const openSettings = this.openOnRetire;
      this.openOnRetire = false;
      this.changed();
      if (openSettings) await this.openSettings();
    }
  }
}
