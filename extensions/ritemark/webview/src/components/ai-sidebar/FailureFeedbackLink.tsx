import { failureFeedbackOptions } from '../../../../src/feedback/feedbackQuoteSafety';
import { vscode } from '../../lib/vscode';
import { ANSWER_FEEDBACK_COPY } from './answerFeedbackCopy';
import { FeedbackLink } from './FeedbackLink';

export function FailureFeedbackLink({ title, line, messageType = 'agent:openFeedback' }: {
  title: string;
  line: string;
  messageType?: string;
}) {
  return (
    <FeedbackLink onClick={() => {
      vscode.postMessage({ type: messageType, options: failureFeedbackOptions(title, line) });
    }}>
      {ANSWER_FEEDBACK_COPY.tellUsAboutThis}
    </FeedbackLink>
  );
}
