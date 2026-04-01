import { CheckCircle2, Clock3, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
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
  hasUnsavedChanges: boolean;
  saveState: 'idle' | 'unsaved' | 'saving' | 'saved';
  lastSavedAt: Date | null;
  onSave: () => void;
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
  if (type === 'weekly') {
    return {
      ...schedule,
      type,
      time: schedule.time ?? '09:00',
      days: schedule.days && schedule.days.length > 0 ? schedule.days : [1],
      minuteOfHour: undefined,
      intervalMinutes: undefined,
    };
  }

  if (type === 'daily' || type === 'weekdays') {
    return {
      ...schedule,
      type,
      time: schedule.time ?? '09:00',
      days: undefined,
      minuteOfHour: undefined,
      intervalMinutes: undefined,
    };
  }

  if (type === 'hourly') {
    return {
      ...schedule,
      type,
      time: undefined,
      days: undefined,
      minuteOfHour: schedule.minuteOfHour ?? 0,
      intervalMinutes: undefined,
    };
  }

  return {
    ...schedule,
    type,
    time: undefined,
    days: undefined,
    minuteOfHour: undefined,
    intervalMinutes: schedule.intervalMinutes ?? 15,
  };
}

export function FlowSettingsPanel({
  featureEnabled,
  runtimeStatus,
  hasUnsavedChanges,
  saveState,
  lastSavedAt,
  onSave,
  onClose,
}: FlowSettingsPanelProps) {
  const flowSchedule = useFlowEditorStore((state) => state.flowSchedule);
  const setFlowSchedule = useFlowEditorStore((state) => state.setFlowSchedule);

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

  if (!flowSchedule) {
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

        <div className="flex-1 p-4 space-y-4">
          <div className="rounded-md border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 space-y-2">
            <div className="text-sm font-medium text-[var(--vscode-foreground)]">
              No schedule configured
            </div>
            <div className="text-sm text-[var(--vscode-descriptionForeground)]">
              Create a schedule to run this flow automatically while Ritemark is open.
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => setFlowSchedule(ensureSchedule(null))}
          >
            Add Schedule
          </Button>
        </div>
      </div>
    );
  }

  const schedule = flowSchedule;
  const nextRun = getNextScheduledRun(schedule);

  const saveLabel = hasUnsavedChanges
    ? saveState === 'saving'
      ? 'Saving...'
      : 'Save Schedule'
    : 'Saved';

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
          <Label className="text-xs">Active</Label>
          <div className="flex items-center justify-between rounded-md border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-3 py-3">
            <div>
              <div className="text-sm font-medium text-[var(--vscode-foreground)]">
                {schedule.enabled ? 'Active' : 'Paused'}
              </div>
              <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                {schedule.enabled
                  ? 'This flow can run automatically on its schedule.'
                  : 'The schedule is configured but will not trigger.'}
              </div>
            </div>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(checked) =>
                setFlowSchedule({
                  ...schedule,
                  enabled: checked,
                })
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Actions</Label>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[var(--vscode-errorForeground)]"
            onClick={() => setFlowSchedule(null)}
          >
            Remove Schedule
          </Button>
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
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="interval">Every N Minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(schedule.type === 'daily' ||
          schedule.type === 'weekdays' ||
          schedule.type === 'weekly') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Time</Label>
            <Input
              type="time"
              value={schedule.time ?? '09:00'}
              onChange={(event) =>
                setFlowSchedule({
                  ...schedule,
                  time: event.target.value,
                })
              }
            />
          </div>
        )}

        {schedule.type === 'hourly' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Minute Past Hour</Label>
            <Input
              type="number"
              min={0}
              max={59}
              value={schedule.minuteOfHour ?? 0}
              onChange={(event) =>
                setFlowSchedule({
                  ...schedule,
                  minuteOfHour: Math.max(
                    0,
                    Math.min(59, Number(event.target.value) || 0)
                  ),
                })
              }
            />
          </div>
        )}

        {schedule.type === 'interval' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Every N Minutes</Label>
            <Input
              type="number"
              min={1}
              max={59}
              value={schedule.intervalMinutes ?? 15}
              onChange={(event) =>
                setFlowSchedule({
                  ...schedule,
                  intervalMinutes: Math.max(
                    1,
                    Math.min(59, Number(event.target.value) || 1)
                  ),
                })
              }
            />
          </div>
        )}

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

      <div className="border-t border-[var(--vscode-panel-border)] p-4 space-y-2">
        <Button
          className="w-full"
          onClick={onSave}
          disabled={!hasUnsavedChanges || saveState === 'saving'}
        >
          {saveLabel}
        </Button>
        {saveState === 'unsaved' && (
          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            You have unsaved schedule changes.
          </div>
        )}
        {saveState === 'saving' && (
          <div className="flex items-center gap-2 text-xs text-[var(--vscode-descriptionForeground)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving schedule...
          </div>
        )}
        {saveState === 'saved' && (
          <div className="flex items-center gap-2 text-xs text-[var(--vscode-testing-iconPassed)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {lastSavedAt
              ? `Schedule saved at ${lastSavedAt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Schedule saved'}
          </div>
        )}
      </div>
    </div>
  );
}
