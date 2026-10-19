/**
 * Ritemark Reactions — in-editor sentiment feedback.
 *
 * Registers a command (`ritemark.reactions`) shown as a $(thumbsup) icon
 * in the editor title bar. Clicking opens a QuickPick with four choices,
 * followed by an optional free-text message.
 */

import * as vscode from 'vscode';
import type { FeedbackEvent } from './consent';
import { sendFeedback, usageDataState } from './posthog';

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
      // Under the field, so the usage-data switch's "never your documents, chats or names" stays honest (Sprint 133).
      prompt: 'What you write here is sent with your feedback.',
    });

    // Feedback is the person's own choice to send, so it goes with usage data off too (Sprint 133, G3; Jarmo,
    // 19 October): Enter sends it. With usage data off, Escape sends nothing; with it on, the reaction still
    // counts when the message is dismissed, as before.
    if (message === undefined && !usageDataState().on) {
      return;
    }
    const events: FeedbackEvent[] = [{ name: 'reaction_submitted', properties: { reaction, message: message || undefined } }];
    if (message) {
      events.push({ name: 'feedback_sent', properties: { message, reaction } });
    }
    const reactionSent = await sendFeedback(events);

    if (reactionSent) {
      vscode.window.showInformationMessage('Thanks for your feedback!');
      return;
    }

    vscode.window.showWarningMessage('Feedback was not sent. Analytics is disabled or unavailable.');
  });

  context.subscriptions.push(disposable);
}
