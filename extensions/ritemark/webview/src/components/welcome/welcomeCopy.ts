/**
 * The welcome's words (Sprint 133; experience 2 and experience 32). People's
 * names for things: ChatGPT and Claude, never Codex; no "authenticated",
 * "runtime" or "workspace" in the main path.
 */

import type { MissingTool, ProviderView, WelcomeProviderId } from '../../../../src/welcome/protocol'

export const PROVIDER_NAMES: Record<WelcomeProviderId, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  opencode: 'OpenCode',
}

export const COPY = {
  freshTitle: 'Welcome to Ritemark',
  freshLine: 'Ritemark turns a folder on your computer into a workspace where ChatGPT, Claude or open models work with you.',
  updateTitle: 'Welcome to Ritemark 2.0',
  updateLine: 'Everything you had is here: your projects, documents, task boards and chats. Ritemark now opens on a project, with your AI beside it.',
  startTitle: 'Where do you want to start?',
  stepOne: '1 · Your AI',
  stepTwo: '2 · Set up project',
  whichAi: 'Which AI do you use?',
  accountLine: 'Sign in with the account you already use.',
  openCodeLine: 'Open models, with an API key of your own.',
  moreThanOne: 'You can use more than one.',
  apiKeys: 'API keys',
  skip: 'Skip for now',
  reopen: 'Did nothing open? Open the page again',
  privacyLine: 'Your documents stay on this computer. An AI reads only what you work on with it.',
  whereIsWork: 'Where is your work?',
  whereToStart: 'Where do you want to start?',
  yourAi: 'Your AI',
  addAnother: 'Add another',
  openFolder: 'Open a folder…',
  openFolderLine: 'Pick the folder that holds a project’s documents.',
  openAnotherFolder: 'Open another folder…',
  newProject: 'Start a new project',
  newProjectLine: 'Ritemark makes a folder for it in Documents.',
  sample: 'Try the sample project',
  sampleLine: 'A small leadership programme, with documents to work on.',
  projectName: 'Project name',
  create: 'Create',
  change: 'Change…',
  usageTitle: 'Share anonymous usage data to improve Ritemark',
  usageOff: 'Off until you turn it on. Never your documents, chats or names.',
  usageOn: 'On, as you chose in Ritemark 1. Never your documents, chats or names.',
  usageOnHere: 'On. Never your documents, chats or names.',
  privacyPolicy: 'Privacy Policy',
  termsOfUse: 'Terms of Use',
  offline: 'You are offline. Your sign-ins are checked when you are back online.',
  checking: 'Checking…',
  signedIn: 'Signed in',
  setUpDone: 'Set up',
  notChecked: 'Not checked yet',
  signIn: 'Sign in',
  setUp: 'Set up',
  continue: 'Continue',
  cancel: 'Cancel',
  finishThere: 'Finish there',
  tryAgain: 'Try again',
  openSettings: 'Open Settings',
  opening: 'Opening…',
} as const

/** "Your browser opened Claude's sign-in page." (experience 2, frame 2). */
export function browserOpened(id: WelcomeProviderId): string {
  return id === 'opencode' ? 'Checking your keys…' : `Your browser opened ${PROVIDER_NAMES[id]}’s sign-in page.`
}

/** The line above step 2's question. */
export function readyLine(id: WelcomeProviderId): string {
  return id === 'opencode' ? 'OpenCode is set up' : `Signed in to ${PROVIDER_NAMES[id]}`
}

/** The missing Git or Node.js line (R5; the Experience lead, 18 October). */
export function missingToolLine(tool: MissingTool): string {
  if (tool === 'restart') return 'Restart Ritemark to finish setting up Claude.'
  const name = tool === 'git' ? 'Git' : 'Node.js'
  return `Claude from this computer needs ${name}, and ${name} isn’t installed. Use Ritemark’s own Claude instead, or install ${name} and restart Ritemark.`
}

/** A provider's state for screen readers, in one sentence. */
export function spokenState(view: ProviderView): string {
  const name = PROVIDER_NAMES[view.id]
  switch (view.phase) {
    case 'checking': return `${name}: checking.`
    case 'ready': return view.id === 'opencode' ? `${name}: set up.` : `${name}: signed in.`
    case 'signing-in': return `${name}: ${browserOpened(view.id)}`
    case 'not-checked': return `${name}: not checked yet.`
    case 'unavailable':
    case 'sign-in': return `${name}: ${view.reason ?? (view.id === 'opencode' ? 'not set up.' : 'not signed in.')}`
  }
}
