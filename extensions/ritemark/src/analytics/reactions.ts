/**
 * Ritemark Reactions — in-editor sentiment feedback.
 *
 * Registers a command (`ritemark.reactions`) shown as a $(thumbsup) icon
 * in the editor title bar. Clicking opens a QuickPick with four choices,
 * followed by an optional free-text message.
 */

import * as vscode from 'vscode';
import { trackEvent } from './posthog';

interface ReactionChoice {
  label: string;
  value: string;
}

const REACTION_CHOICES: ReactionChoice[] = [
  { label: '$(heart) Love it', value: 'love_it' },
  { label: '$(thumbsup) It\'s good', value: 'good' },
  { label: '$(dash) It\'s okay', value: 'okay' },
  { label: '$(thumbsdown) Needs work', value: 'needs_work' },
];

export function registerReactionCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('ritemark.reactions', async () => {
    const picked = await vscode.window.showQuickPick(
      REACTION_CHOICES.map((c) => ({ label: c.label, value: c.value })),
      {
        title: 'How\'s Ritemark working for you?',
        placeHolder: 'Pick a reaction',
      }
    );

    if (!picked) {
      return; // user dismissed
    }

    const reaction = REACTION_CHOICES.find((c) => c.label === picked.label)?.value ?? picked.label;

    // Optional follow-up message
    const message = await vscode.window.showInputBox({
      title: 'Want to tell us more?',
      placeHolder: 'Optional — type your feedback and press Enter',
      prompt: 'Your message is sent anonymously.',
    });

    // Track the reaction (even if message was dismissed)
    const reactionSent = await trackEvent('reaction_submitted', {
      reaction,
      message: message || undefined,
    });

    // If there's a message, also fire a dedicated feedback event
    if (message) {
      await trackEvent('feedback_sent', {
        message,
        reaction,
      });
    }

    if (reactionSent) {
      vscode.window.showInformationMessage('Thanks for your feedback!');
      return;
    }

    vscode.window.showWarningMessage('Feedback was not sent. Analytics is disabled or unavailable.');
  });

  context.subscriptions.push(disposable);
}
