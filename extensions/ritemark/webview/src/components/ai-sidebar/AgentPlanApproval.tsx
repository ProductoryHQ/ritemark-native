import { PlanReviewCard } from './PlanReviewCard';

interface AgentPlanApprovalProps {
  turnId: string;
  planText: string;
  /** Sprint 103 R4: attribution ("Requested by you · Plan" / "Claude chose to plan first"). */
  provenance?: string;
  /** Sprint 103 R2: verified no-write claim for the enforced plan phase. */
  enforcementNote?: string;
  onApprove: (turnId: string) => void;
  onReject: (turnId: string, feedback?: string) => void;
}

export function AgentPlanApproval({
  turnId,
  planText,
  provenance,
  enforcementNote,
  onApprove,
  onReject,
}: AgentPlanApprovalProps) {
  return (
    <PlanReviewCard
      title="Claude is waiting for plan review"
      planText={planText}
      approveLabel="Approve & continue"
      rejectLabel="Keep planning"
      rejectPlaceholder="What should change in the plan?"
      allowFeedback
      provenance={provenance}
      enforcementNote={enforcementNote}
      onApprove={() => onApprove(turnId)}
      onReject={(feedback) => onReject(turnId, feedback)}
    />
  );
}
