import React from 'react';
import { Clock3, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useFlowEditorStore } from './stores/flowEditorStore';
import type {
  FlowSchedule,
  FlowScheduleType,
  IsoWeekday,
} from './stores/flowEditorStore';
import {
  formatScheduleDateTime,
  formatScheduleSummary,
  getNextScheduledRun,
} from './flowScheduleUi';

interface FlowScheduleStatus {
  lastRunAt: string | null;
  lastScheduledFor: string | null;
  lastStatus: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  lastError: string | null;
}

interface FlowSettingsPanelProps {
  featureEnabled: boolean;
  runtimeStatus: FlowScheduleStatus | null;
  onClose: () => void;
}

const ISO_DAYS: Array<{ value: IsoWeekday; label: string }> = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

function ensureSchedule(schedule: FlowSchedule | null): FlowSchedule {
  return schedule ?? {
    enabled: true,
    type: 'daily',
    time: '09:00',
  };
}

function setWeeklyDay(
  schedule: FlowSchedule,
  day: IsoWeekday,
  enabled: boolean
): FlowSchedule {
  const existing = new Set(schedule.days ?? []);
  if (enabled) {
    existing.add(day);
  } else {
    existing.delete(day);
  }

  return {
    ...schedule,
    days: Array.from(existing).sort((a, b) => a - b) as IsoWeekday[],
  };
}

function updateScheduleType(
  schedule: FlowSchedule,
  type: FlowScheduleType
): FlowSchedule {
  if (type !== 'weekly') {
    return {
      ...schedule,
      type,
      days: undefined,
    };
  }

  return {
    ...schedule,
    type,
    days: schedule.days && schedule.days.length > 0 ? schedule.days : [1],
  };
}

export function FlowSettingsPanel({
  featureEnabled,
  runtimeStatus,
  onClose,
}: FlowSettingsPanelProps) {
  const flowSchedule = useFlowEditorStore((state) => state.flowSchedule);
  const setFlowSchedule = useFlowEditorStore((state) => state.setFlowSchedule);

  const schedule = ensureSchedule(flowSchedule);
  const nextRun = getNextScheduledRun(schedule);

  if (!featureEnabled) {
    return (
      <div className="h-full flex flex-col bg-[var(--vscode-sideBar-background)] border-l border-[var(--vscode-panel-border)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--vscode-panel-border)]">
          <div className="text-sm font-semibold text-[var(--vscode-foreground)]">
            Flow Schedule
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="p-4 text-sm text-[var(--vscode-descriptionForeground)]">
          Scheduled flow runs are currently disabled by feature flag.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--vscode-sideBar-background)] border-l border-[var(--vscode-panel-border)]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--vscode-panel-border)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--vscode-foreground)]">
          <Clock3 size={16} />
          Flow Schedule
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-3 rounded-md border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] space-y-1">
          <div className="text-xs uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
            Summary
          </div>
          <div className="text-sm text-[var(--vscode-foreground)]">
            {formatScheduleSummary(schedule)}
          </div>
          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            Next run: {formatScheduleDateTime(nextRun)}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <div className="flex items-center justify-between rounded-md border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-3 py-2">
            <div className="text-sm text-[var(--vscode-foreground)]">
              {schedule.enabled ? 'Enabled' : 'Disabled'}
            </div>
            <Button
              variant={schedule.enabled ? 'secondary' : 'default'}
              size="sm"
              onClick={() =>
                setFlowSchedule({
                  ...schedule,
                  enabled: !schedule.enabled,
                })
              }
            >
              {schedule.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Recurrence</Label>
          <Select
            value={schedule.type}
            onValueChange={(value) =>
              setFlowSchedule(
                updateScheduleType(schedule, value as FlowScheduleType)
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekdays">Weekdays</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Time</Label>
          <Input
            type="time"
            value={schedule.time}
            onChange={(event) =>
              setFlowSchedule({
                ...schedule,
                time: event.target.value,
              })
            }
          />
        </div>

        {schedule.type === 'weekly' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Days</Label>
            <div className="grid grid-cols-4 gap-2">
              {ISO_DAYS.map((day) => {
                const isSelected = (schedule.days ?? []).includes(day.value);
                return (
                  <Button
                    key={day.value}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setFlowSchedule(
                        setWeeklyDay(schedule, day.value, !isSelected)
                      )
                    }
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 rounded-md border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] space-y-2">
          <div className="text-xs uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
            Last Scheduled Run
          </div>
          <div className="text-sm text-[var(--vscode-foreground)]">
            Status: {runtimeStatus?.lastStatus ?? 'idle'}
          </div>
          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            Last run: {formatScheduleDateTime(runtimeStatus?.lastRunAt ? new Date(runtimeStatus.lastRunAt) : null)}
          </div>
          {runtimeStatus?.lastError && (
            <div className="text-xs text-[var(--vscode-errorForeground)] whitespace-pre-wrap">
              {runtimeStatus.lastError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
