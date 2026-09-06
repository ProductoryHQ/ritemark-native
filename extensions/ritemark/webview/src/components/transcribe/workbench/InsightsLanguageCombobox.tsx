/** Sprint 113 R6 — editable, any-language Insights combobox. */

import * as Popover from '@radix-ui/react-popover';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import {
  getInsightsLanguageSuggestions,
  insightsLanguageSelectionLabel,
  isInsightsLanguageQueryInvalid,
  normalizeCustomInsightsLanguage,
  type InsightsLanguageOption,
  type InsightsLanguageSelection,
  type InsightsOutputLanguage,
} from '../../../../../src/speech/insightsLanguage';

type LanguageRow =
  | { id: 'auto'; kind: 'auto'; label: 'Auto'; detail: string; selection: InsightsLanguageSelection }
  | { id: string; kind: 'known'; label: string; detail?: string; code: string; selection: InsightsLanguageSelection }
  | { id: 'custom'; kind: 'custom'; label: string; detail: 'Custom language'; selection: InsightsLanguageSelection };

function selectionKey(selection: InsightsLanguageSelection): string {
  if (selection.kind === 'auto') return 'auto';
  return selection.kind === 'known' ? `known:${selection.code}` : `custom:${selection.name}`;
}

function knownRow(option: InsightsLanguageOption): LanguageRow {
  return {
    id: `known-${option.code}`,
    kind: 'known',
    code: option.code,
    label: option.label,
    detail: option.nativeLabel && option.nativeLabel !== option.label ? option.nativeLabel : undefined,
    selection: { kind: 'known', code: option.code },
  };
}

export function InsightsLanguageCombobox({
  value,
  resolvedLanguage,
  disabled = false,
  onChange,
}: {
  value: InsightsLanguageSelection;
  resolvedLanguage: InsightsOutputLanguage;
  disabled?: boolean;
  onChange: (value: InsightsLanguageSelection) => void;
}) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const committedLabel = insightsLanguageSelectionLabel(value);
  const resolvedLabel = insightsLanguageSelectionLabel(resolvedLanguage);
  const normalizedQuery = query.trim();

  const rows = useMemo<LanguageRow[]>(() => {
    const auto: LanguageRow = {
      id: 'auto',
      kind: 'auto',
      label: 'Auto',
      detail: `Same as transcript · ${resolvedLabel}`,
      selection: { kind: 'auto' },
    };
    const known = getInsightsLanguageSuggestions(normalizedQuery, normalizedQuery ? 10 : 7)
      .map(knownRow);
    const normalizedCustom = normalizedQuery
      ? normalizeCustomInsightsLanguage(normalizedQuery)
      : null;
    const custom: LanguageRow[] = normalizedCustom?.kind === 'custom'
      ? [{
          id: 'custom',
          kind: 'custom',
          label: `Use “${normalizedCustom.name}”`,
          detail: 'Custom language',
          selection: normalizedCustom,
        }]
      : [];
    return [auto, ...known, ...custom];
  }, [normalizedQuery, resolvedLabel]);

  useEffect(() => {
    const firstResult = normalizedQuery ? Math.min(1, Math.max(0, rows.length - 1)) : 0;
    setActiveIndex(firstResult);
  }, [normalizedQuery, rows.length]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const closeWithoutCommit = () => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  const commit = (row: LanguageRow) => {
    onChange(row.selection);
    closeWithoutCommit();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const openForSearch = () => {
    if (disabled) return;
    if (!open) {
      setOpen(true);
      setQuery('');
      setActiveIndex(0);
    }
  };

  const moveActive = (direction: 1 | -1) => {
    setActiveIndex((current) => {
      if (rows.length === 0) return 0;
      return (current + direction + rows.length) % rows.length;
    });
  };

  const customInputInvalid = isInsightsLanguageQueryInvalid(normalizedQuery);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) openForSearch();
        else closeWithoutCommit();
      }}
    >
      <Popover.Anchor asChild>
        <div className="relative">
          <input
            ref={inputRef}
            id="insights-language"
            type="text"
            role="combobox"
            aria-label="Insights language"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={open && rows[activeIndex] ? `${listboxId}-${rows[activeIndex].id}` : undefined}
            aria-invalid={customInputInvalid || undefined}
            aria-describedby={customInputInvalid ? 'insights-language-error' : undefined}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={open ? query : committedLabel}
            placeholder="Search or enter a language"
            onFocus={openForSearch}
            onClick={openForSearch}
            onChange={(event) => {
              setOpen(true);
              setQuery(event.currentTarget.value);
            }}
            onBlur={() => {
              requestAnimationFrame(() => {
                if (document.activeElement !== inputRef.current) closeWithoutCommit();
              });
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!open) openForSearch();
                else moveActive(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (!open) openForSearch();
                else moveActive(-1);
              } else if (event.key === 'Home' && open) {
                event.preventDefault();
                setActiveIndex(0);
              } else if (event.key === 'End' && open) {
                event.preventDefault();
                setActiveIndex(Math.max(0, rows.length - 1));
              } else if (event.key === 'Enter' && open) {
                event.preventDefault();
                if (!customInputInvalid && rows[activeIndex]) commit(rows[activeIndex]);
              } else if (event.key === 'Escape' && open) {
                event.preventDefault();
                event.stopPropagation();
                closeWithoutCommit();
              } else if (event.key === 'Tab' && open) {
                closeWithoutCommit();
              }
            }}
            className="h-8 w-full rounded-md border border-hairline-strong bg-surface py-1 pl-8 pr-8 text-xs text-ink-strong placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Icon
            name="magnifying-glass"
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Icon
            name={open ? 'caret-up' : 'caret-down'}
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          avoidCollisions
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Node && inputRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          className="z-[100] max-h-[min(280px,40vh)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-[10px] border border-hairline bg-surface p-1 shadow-[var(--ritemark-shadow-lg)] focus:outline-none"
        >
          <div id={listboxId} role="listbox" aria-label="Insights languages">
            {rows.map((row, index) => {
              const selected = selectionKey(row.selection) === selectionKey(value);
              const active = index === activeIndex;
              return (
                <div
                  key={row.id}
                  ref={(node) => { optionRefs.current[index] = node; }}
                  id={`${listboxId}-${row.id}`}
                  role="option"
                  aria-selected={selected}
                  className={[
                    'flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-strong',
                    active ? 'bg-accent-soft text-accent-deep' : 'hover:bg-surface-soft',
                  ].join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(row)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium">{row.label}</span>
                    {row.detail ? (
                      <span className="mt-0.5 block break-words text-[10px] text-ink-muted">{row.detail}</span>
                    ) : null}
                  </span>
                  {row.kind === 'known' ? (
                    <span className="shrink-0 text-[10px] uppercase text-ink-faint">{row.code}</span>
                  ) : null}
                  {selected ? <Icon name="check" size={14} className="shrink-0 text-accent" /> : null}
                </div>
              );
            })}
          </div>

          {customInputInvalid ? (
            <p id="insights-language-error" className="px-2.5 py-2 text-[10px] leading-relaxed text-ink-muted">
              Enter a language name, for example “Welsh”.
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {customInputInvalid
          ? 'Enter a valid language name.'
          : open
            ? `${rows.length} language choices available.`
            : `${committedLabel} selected.`}
      </p>
    </Popover.Root>
  );
}
