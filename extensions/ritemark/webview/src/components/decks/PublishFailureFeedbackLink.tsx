import { DECK_FAILURE_FEEDBACK_MESSAGE, PUBLISH_FAILURE_TITLE } from '../../../../src/feedback/feedbackQuoteSafety'
import { FailureFeedbackLink } from '../ai-sidebar/FailureFeedbackLink'

export function PublishFailureFeedbackLink({ operation, line }: { operation: string; line: string }) {
  if (operation !== 'publish') return null
  return (
    <span className="deck-publish-feedback">
      <FailureFeedbackLink title={PUBLISH_FAILURE_TITLE} line={line} messageType={DECK_FAILURE_FEEDBACK_MESSAGE} />
    </span>
  )
}
