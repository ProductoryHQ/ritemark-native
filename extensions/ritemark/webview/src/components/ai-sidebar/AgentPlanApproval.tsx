import { PlanReviewCard } from './PlanReviewCard';

interface AgentPlanApprovalProps {
  turnId: string;
  planText: string;
  onApprove: (turnId: string) => void;
  onReject: (turnId: string, feedback?: string) => void;
}

export function AgentPlanApproval({
  turnId,
  planText,
  onApprove,
  onReject,
}: AgentPlanApprovalProps) {
  return (
    <PlanReviewCard
      title="Claude is waiting for plan approval"
      planText={planText}
      approveLabel="Approve plan"
      rejectLabel="Reject"
      allowFeedback
      onApprove={() => onApprove(turnId)}
      onReject={(feedback) => onReject(turnId, feedback)}
    />
  );
}
