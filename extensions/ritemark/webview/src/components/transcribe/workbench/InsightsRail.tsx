/**
 * Sprint 108 R10 — the insights rail.
 *
 * Summary, decisions, actions, open questions and quotes, generated from the
 * transcript. Two rules make this trustworthy rather than decorative:
 *
 *   1. Every item carries a timestamp that seeks the audio. An insight you can
 *      check in two seconds is worth having; one you cannot is a claim.
 *   2. The rail says out loud that a model wrote this, and which one.
 */

import { useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { vscode } from '../../../lib/vscode';
import { formatClock } from './playback';
import {
  INSIGHTS_LANGUAGE_OPTIONS,
  insightsLanguageLabel,
  insightsLanguageProvenance,
  type InsightsLanguageMetadata,
  type InsightsLanguageSelection,
  type InsightsOutputLanguage,
} from '../../../../../src/speech/insightsLanguage';

export interface InsightItem {
  kind: 'decision' | 'action' | 'quote' | 'question';
  text: string;
  at: number;
  owner?: string;
}

export interface Insights {
  generatedAt: string;
  model: string;
  language?: InsightsLanguageMetadata;
  summary?: string;
  items: InsightItem[];
}

export type InsightsState = 'idle' | 'generating' | 'failed';

const GROUPS: Array<{ kind: InsightItem['kind']; heading: string }> = [
  { kind: 'decision', heading: 'Decisions' },
  { kind: 'action', heading: 'Action items' },
  { kind: 'question', heading: 'Open questions' },
  { kind: 'quote', heading: 'Key quotes' },
];

export function InsightsRail({
  insights,
  state,
  error,
  runtimeReady,
  selectedLanguage,
  resolvedLanguage,
  documentResultSerial,
  onLanguageChange,
  onGenerate,
  onCreateDocument,
  onSeek,
}: {
  insights: Insights | null;
  state: InsightsState;
  error: string | null;
  runtimeReady: boolean;
  selectedLanguage: InsightsLanguageSelection;
  resolvedLanguage: InsightsOutputLanguage;
  documentResultSerial: number;
  onLanguageChange: (language: InsightsLanguageSelection) => void;
  onGenerate: () => void;
  onCreateDocument: () => void;
  onSeek: (seconds: number) => void;
}) {
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const provenance = insights ? insightsLanguageProvenance(insights.language) : null;

  useEffect(() => {
    if (documentResultSerial > 0) createButtonRef.current?.focus();
  }, [documentResultSerial]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-hairline bg-surface-muted">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <Icon name="sparkle" size={14} className="text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-body">Insights</span>
        {insights && state !== 'generating' && (
          <button
            type="button"
            className="ml-auto text-[10.5px] font-semibold text-accent hover:underline"
            onClick={onGenerate}
          >
            Regenerate
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-3">
          <label htmlFor="insights-language" className="mb-1.5 block text-[11px] font-medium text-ink-body">
            Insights language
          </label>
          <Select
            value={selectedLanguage}
            disabled={state === 'generating'}
            onValueChange={(value) => onLanguageChange(value as InsightsLanguageSelection)}
          >
            <SelectTrigger
              id="insights-language"
              aria-label="Insights language"
              className="h-8 rounded-md bg-surface px-2.5 text-xs focus:border-accent focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSIGHTS_LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
            {selectedLanguage === 'auto'
              ? `Auto · ${insightsLanguageLabel(resolvedLanguage)}`
              : `Output · ${insightsLanguageLabel(resolvedLanguage)}`}
          </p>
        </div>

        {state === 'generating' && (
          <div className="rounded-lg border border-hairline bg-surface p-3">
            <div className="flex items-center gap-2 text-xs text-ink-body">
              <Icon name="circle-notch" size={14} className="animate-spin text-accent" />
              Reading the transcript…
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2.5 w-full"
              onClick={() => vscode.postMessage({ type: 'workbench:cancelInsights' })}
            >
              Cancel
            </Button>
          </div>
        )}

        {state === 'failed' && (
          <div className="rounded-lg border border-ritemark-error/40 bg-ritemark-error-soft p-3">
            <p className="text-xs leading-relaxed text-ritemark-error">{error ?? 'Could not generate insights.'}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2.5 w-full"
              onClick={onGenerate}
            >
              Try again
            </Button>
          </div>
        )}

        {state === 'idle' && !insights && (
          <div className="rounded-lg border border-hairline bg-surface p-3">
            {runtimeReady ? (
              <>
                <p className="text-xs leading-relaxed text-ink-body">
                  Pull the summary, decisions, action items and key quotes out of this recording.
                </p>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  onClick={onGenerate}
                >
                  Generate insights
                </Button>
              </>
            ) : (
              <>
                {/* R10: explain what to configure instead of showing a button
                    that fails, or a spinner that never resolves. */}
                <p className="text-xs leading-relaxed text-ink-body">
                  Insights need an AI runtime. Sign in to Claude or add an API key to use them.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => vscode.postMessage({ type: 'workbench:openSettings' })}
                >
                  Open Settings
                </Button>
              </>
            )}
          </div>
        )}

        {insights && (
          <>
            {insights.summary && (
              <Card heading="Summary">
                <p className="text-xs leading-relaxed text-ink-body">{insights.summary}</p>
              </Card>
            )}

            {GROUPS.map((group) => {
              const items = insights.items.filter((item) => item.kind === group.kind);
              if (items.length === 0) return null;

              return (
                <Card key={group.kind} heading={group.heading} count={items.length}>
                  <ul className="space-y-2">
                    {items.map((item, index) => (
                      <li key={`${group.kind}-${index}`} className="text-xs leading-relaxed text-ink-body">
                        {group.kind === 'quote' ? (
                          <span className="block border-l-2 border-accent-fainter pl-2 italic text-ink-strong">
                            “{item.text}”
                          </span>
                        ) : (
                          <span>
                            {item.owner && <strong className="font-semibold text-ink-strong">{item.owner} — </strong>}
                            {item.text}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onSeek(item.at)}
                          className="ml-1.5 inline-block rounded bg-surface-soft px-1.5 py-px align-middle text-[10px] font-semibold tabular-nums text-ink-muted hover:bg-accent-soft hover:text-accent-deep"
                          title="Play from here"
                        >
                          {formatClock(item.at)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}

            {insights.items.length === 0 && !insights.summary && (
              <p className="px-1 text-xs leading-relaxed text-ink-muted">
                Nothing came back that could be tied to a moment in the recording. Try regenerating.
              </p>
            )}

            <Button
              ref={createButtonRef}
              variant="secondary"
              size="sm"
              className="mt-1 w-full"
              onClick={onCreateDocument}
            >
              Create insights document
            </Button>

            <p className="mt-2 px-1 text-[10px] leading-relaxed text-ink-muted">
              Creates a new Markdown file. Your transcript is not changed.
            </p>

            <p className="mt-2 px-1 text-[10px] leading-relaxed text-ink-faint">
              Generated by {insights.model} in {insightsLanguageLabel(provenance?.resolved ?? 'en')}
              {provenance?.legacy ? ' (legacy)' : ''} from the transcript. Click a timestamp to hear the moment it came from.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function Card({
  heading,
  count,
  children,
}: {
  heading: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 rounded-lg border border-hairline bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">{heading}</span>
        {count !== undefined && <span className="ml-auto text-[10px] font-bold text-ink-faint">{count}</span>}
      </div>
      {children}
    </div>
  );
}
