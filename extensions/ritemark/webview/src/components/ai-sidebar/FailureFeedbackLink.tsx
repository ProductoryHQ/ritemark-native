import { isSafeFeedbackQuotePart } from '../../../../src/feedback/feedbackQuoteSafety';
import { vscode } from '../../lib/vscode';
import { ANSWER_FEEDBACK_COPY } from './answerFeedbackCopy';
import { FeedbackLink } from './FeedbackLink';

const diagnostic = /[\r\n]|^\s*[\[{]|\b(?:bearer\s+\S+|(?:api[_ -]?key|access[_ -]?token|password)\s*[:=]\s*\S+)/i;
const localPath = /(?:^|[\s"'“‘(])(?:\/[^/\s]|\.{1,2}[\\/]|(?:[\w.-]+[\\/])+[\w.-]+\.[a-z][a-z\d]{0,7}\b)/i;

export function FailureFeedbackLink({ title, line }: { title: string; line: string }) {
  return (
    <FeedbackLink onClick={() => {
      // Legacy failure lines may contain provider diagnostics. Keep those out of the bridge.
      const safe = [title, line].every(part => isSafeFeedbackQuotePart(part) && !diagnostic.test(part) && !localPath.test(part));
      vscode.postMessage({
        type: 'agent:openFeedback',
        options: { from: 'failure_card', ...(safe ? { quote: { title, line } } : {}) },
      });
    }}>
      {ANSWER_FEEDBACK_COPY.tellUsAboutThis}
    </FeedbackLink>
  );
}
