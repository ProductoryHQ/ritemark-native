/**
 * Sprint 134 R16 — what the Transcribe panel draws around its content.
 *
 * With a folder open, the project's head (patch 018, `ritemarkProjectHead.ts`) draws Record and
 * Transcribe a file… above the panel, so the panel's own row of Add recording and Record goes. With no
 * folder open the head is not drawn, and the panel keeps its own two buttons. The library's group label
 * reads "Recordings" ("All projects" while the switch shows every project's), with the settings gear at
 * its right: the button the view's title row carried before the head took that row.
 *
 * Pure, so the rule is tested without React (`panelChrome.test.ts`).
 */

/** The panel's own actions, drawn on one row when the head does not draw them. */
export type PanelAction = 'add-recording' | 'record';

export const RECORDINGS_LABEL = 'Recordings';
export const ALL_PROJECTS_LABEL = 'All projects';

/** The gear at the right of the library's label: Settings at the transcription card (the host's `transcribe:openSettings`). */
export const SETTINGS_BUTTON = {
  label: 'Transcribe settings',
  icon: 'gear',
  message: { type: 'transcribe:openSettings' },
} as const;

/**
 * Sprint 143 (#509): the buttons of a card under Needs attention. Dismiss is on every failed or
 * interrupted card (`transcribe:dismissJob`); the audio file is never touched.
 */
export const ATTENTION_ACTIONS = {
  retry: { label: 'Try again', tooltip: 'Transcribe this recording again' },
  dismiss: { label: 'Dismiss', tooltip: 'Remove this from the list. The recording stays where it is.', message: 'transcribe:dismissJob' },
} as const;

/** The host asks the panel to start recording: `ritemark.transcribe.record`, the head's Record row. */
export const RECORD_REQUEST = 'transcribe:recordRequested';

export interface PanelChromeInput {
  /** A folder is open (the state's `hasProject`): the project's head is drawn, with Record and Transcribe a file…. */
  hasProject: boolean;
  /** Direct recording is on (`transcribe-direct-recording`, the state's `recording.enabled`). */
  recordingEnabled: boolean;
  /** The library shows every project's recordings, not just this one's. */
  showAllProjects: boolean;
}

export interface PanelChrome {
  /** The panel's own row; empty when the project's head carries the same two actions. */
  actions: PanelAction[];
  /** What the file picker is called where the person sees it, for text that sends them to it. */
  pickFileName: 'Add recording' | 'Transcribe a file…';
  /** The library's group label. */
  libraryLabel: string;
  /** The gear at the right of that label. */
  settings: typeof SETTINGS_BUTTON;
}

export function panelChrome({ hasProject, recordingEnabled, showAllProjects }: PanelChromeInput): PanelChrome {
  const actions: PanelAction[] = hasProject ? [] : recordingEnabled ? ['add-recording', 'record'] : ['add-recording'];
  return {
    actions,
    pickFileName: hasProject ? 'Transcribe a file…' : 'Add recording',
    libraryLabel: showAllProjects ? ALL_PROJECTS_LABEL : RECORDINGS_LABEL,
    settings: SETTINGS_BUTTON,
  };
}

/**
 * Whether Record may start: the panel's Record button is enabled, and the head's Record (which reaches
 * the panel as `RECORD_REQUEST`) starts a recording, only when this is true.
 */
export function canStartRecording({
  enabled,
  nothingReady,
  recordingBusy,
}: {
  enabled: boolean;
  nothingReady: boolean;
  recordingBusy: boolean;
}): boolean {
  return enabled && !nothingReady && !recordingBusy;
}

/**
 * How the head's Record starts a recording in the panel. VS Code runs webviews under the
 * `user-gesture-required` autoplay policy, so the panel's audio runs only when the panel itself has just been
 * clicked or typed in (`navigator.userActivation.isActive`; Phase 0 S1). A click on the head is in the
 * workbench, not in the panel: without a fresh gesture here, the panel asks for one click (RecordPromptCard)
 * rather than starting a capture that cannot run. Where the browser does not report it, it starts at once.
 */
export function requestedRecordingStart(userActivation: { isActive: boolean } | undefined): 'start' | 'ask' {
  return userActivation && !userActivation.isActive ? 'ask' : 'start';
}
