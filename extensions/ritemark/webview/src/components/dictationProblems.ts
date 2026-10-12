/**
 * Sprint 129 R5/R6: every reason dictation cannot start or had to stop, and what
 * the user is told about it, per platform.
 *
 * The extension host sends a problem code (`dictation:problem`); microphone
 * failures are classified here from getUserMedia with the classifier Transcribe
 * Record uses. Wording reviewed with ux-expert on 2026-10-12: plain words, the
 * Windows switches named rather than a menu path (the button opens the page),
 * and "Try Again" wherever the user can fix it.
 */

import type { CaptureFailureCode } from './transcribe/recording/capture'
import type { WebviewPlatform } from '../hooks/usePlatform'

export type DictationProblem =
  | 'mic-blocked'
  | 'mic-missing'
  | 'mic-busy'
  | 'mic-internal'
  | 'mic-unexpected'
  | 'engine-missing'
  | 'engine-blocked'
  | 'engine-cpu'
  | 'engine-failed'
  | 'engine-unavailable'
  | 'model-missing'
  | 'generic'

/** What a dialog button does. "retry" runs the normal mic-button start, which also offers the model download. */
export type DictationAction = 'open-mic-settings' | 'retry' | 'close'

export interface ProblemButton {
  label: string
  tooltip: string
  action: DictationAction
}

export interface ProblemCopy {
  title: string
  /** Body text; `strong` marks the names of settings the user has to find. */
  body: Array<{ text: string; strong?: boolean }>
  icon: 'microphone' | 'warning'
  primary: ProblemButton
  secondary?: ProblemButton
}

/** Problem codes the extension host may send; anything else is shown as "generic". */
export const HOST_PROBLEMS: readonly DictationProblem[] = [
  'engine-missing', 'engine-blocked', 'engine-cpu', 'engine-failed', 'engine-unavailable', 'model-missing',
]

export function problemFromCapture(code: CaptureFailureCode): DictationProblem {
  switch (code) {
    case 'os-denied': return 'mic-blocked'
    case 'no-device': return 'mic-missing'
    case 'device-busy': return 'mic-busy'
    case 'internal-config': return 'mic-internal'
    case 'unexpected': return 'mic-unexpected'
  }
}

function openSettings(platform: WebviewPlatform): ProblemButton {
  return {
    label: 'Open Microphone Settings',
    tooltip: platform === 'win32'
      ? 'Opens Windows Settings at the microphone page'
      : 'Opens System Settings at the microphone page',
    action: 'open-mic-settings',
  }
}

const close: ProblemButton = { label: 'Close', tooltip: 'Close this message', action: 'close' }

function retry(tooltip: string): ProblemButton {
  return { label: 'Try Again', tooltip, action: 'retry' }
}

export function dictationProblemCopy(problem: DictationProblem, platform: WebviewPlatform, detail?: string): ProblemCopy {
  const windows = platform === 'win32'
  switch (problem) {
    case 'mic-blocked':
      return windows
        ? {
            title: 'Microphone Access Is Off',
            body: [
              { text: 'Windows is blocking your microphone. Open Microphone Settings and turn on ' },
              { text: 'Microphone access', strong: true },
              { text: ' and ' },
              { text: 'Let desktop apps access your microphone', strong: true },
              { text: '. Ritemark is a desktop app.' },
            ],
            icon: 'microphone',
            primary: openSettings(platform),
            secondary: retry('Check again after changing the setting'),
          }
        : {
            title: 'Microphone Access Is Off',
            body: [
              { text: 'macOS is blocking your microphone. Open Microphone Settings and turn on ' },
              { text: 'Ritemark', strong: true },
              { text: ' in the list.' },
            ],
            icon: 'microphone',
            primary: openSettings(platform),
            secondary: retry('Check again after changing the setting'),
          }
    case 'mic-missing':
      return {
        title: 'No Microphone Found',
        body: [{ text: "Ritemark can't find a microphone. Connect one, then try again." }],
        icon: 'microphone',
        primary: retry('Look for a microphone again and start dictating'),
      }
    case 'mic-busy':
      return windows
        ? {
            title: "Microphone Couldn't Start",
            body: [{ text: 'Another app may be using your microphone, or Windows may be blocking it. Close other apps that use it, or check the settings.' }],
            icon: 'microphone',
            primary: openSettings(platform),
            secondary: retry('Try the microphone again'),
          }
        : {
            title: "Microphone Couldn't Start",
            body: [{ text: 'Another app may be using your microphone. Close other apps that use it, then try again.' }],
            icon: 'microphone',
            primary: retry('Try the microphone again'),
          }
    case 'mic-unexpected':
      return {
        title: "Microphone Couldn't Start",
        body: [{ text: "Ritemark couldn't start the microphone. Please try again." }],
        icon: 'microphone',
        primary: retry('Try the microphone again'),
        secondary: close,
      }
    case 'mic-internal':
      return {
        title: "Dictation Isn't Working",
        body: [{ text: 'This version of Ritemark has a setup problem that stops dictation. Please update Ritemark.' }],
        icon: 'warning',
        primary: close,
      }
    case 'engine-missing':
      return {
        title: "Dictation Can't Start",
        body: [{ text: 'A part of Ritemark that dictation needs is missing. Reinstalling Ritemark will restore it.' }],
        icon: 'warning',
        primary: close,
      }
    case 'engine-blocked':
      return {
        title: "Dictation Can't Start",
        body: [{
          text: windows
            ? 'Windows Security or your antivirus stopped dictation from starting. Allow Ritemark in it, then try again.'
            : "Your Mac's security settings stopped dictation from starting.",
        }],
        icon: 'warning',
        primary: retry('Try starting dictation again'),
        secondary: close,
      }
    case 'engine-cpu':
      return {
        title: "Dictation Can't Start",
        body: [{ text: 'Dictation needs a newer processor than this computer has.' }],
        icon: 'warning',
        primary: close,
      }
    case 'engine-unavailable':
      return {
        title: "Dictation Can't Start",
        body: [{ text: "Dictation isn't available on this computer." }],
        icon: 'warning',
        primary: close,
      }
    case 'engine-failed':
      return {
        title: 'Dictation Stopped',
        body: [{ text: 'Dictation stopped unexpectedly. Please try again.' }],
        icon: 'warning',
        primary: retry('Start dictation again'),
        secondary: close,
      }
    case 'model-missing':
      return {
        title: 'Speech Model Needed',
        body: [{ text: "Dictation needs its speech model, a one-time download of about 1.5 GB. It isn't on this computer right now." }],
        icon: 'warning',
        primary: { label: 'Download Speech Model', tooltip: 'Download once. Dictation works offline afterwards.', action: 'retry' },
        secondary: close,
      }
    case 'generic':
      return {
        title: 'Dictation Stopped',
        body: [{ text: detail || 'Dictation stopped unexpectedly. Please try again.' }],
        icon: 'warning',
        primary: close,
      }
  }
}
