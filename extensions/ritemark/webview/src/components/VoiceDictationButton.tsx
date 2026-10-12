import React, { useState, useEffect, useRef } from 'react'
import { Icon } from './ui/Icon'
import { useVoiceDictation, type DictationState } from '../hooks/useVoiceDictation'
import { LanguagePickerModal, WHISPER_LANGUAGES } from './LanguagePickerModal'
import { DictationSettingsModal } from './DictationSettingsModal'
import { DictationProblemDialog } from './DictationProblemDialog'
import { dictationProblemCopy, type DictationAction } from './dictationProblems'
import { Tooltip } from './ui/tooltip'
import { webviewPlatform } from '../hooks/usePlatform'
import { sendToExtension } from '../bridge'

// Local storage keys
const RECENT_LANGUAGES_KEY = 'ritemark-dictation-recent-languages'
const LAST_LANGUAGE_KEY = 'ritemark-dictation-last-language'

// Get recent languages from local storage
function getRecentLanguages(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_LANGUAGES_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore errors
  }
  return ['et', 'en'] // Default: Estonian and English
}

// Get last used language
function getLastLanguage(): string {
  try {
    const stored = localStorage.getItem(LAST_LANGUAGE_KEY)
    if (stored) {
      return stored
    }
  } catch {
    // Ignore errors
  }
  return 'et' // Default: Estonian
}

// Save recent language to local storage
function saveRecentLanguage(code: string): void {
  try {
    // Save as last used
    localStorage.setItem(LAST_LANGUAGE_KEY, code)

    // Update recent list
    const recent = getRecentLanguages()
    const filtered = recent.filter(c => c !== code)
    const updated = [code, ...filtered].slice(0, 5) // Keep last 5
    localStorage.setItem(RECENT_LANGUAGES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore errors
  }
}

/**
 * Voice dictation split button
 *
 * Design:
 * - Primary (left): Start/stop dictation with last used language
 * - Secondary (right dropdown): Select language
 */
export function VoiceDictationButton() {
  const { state, problem, dismissProblem, currentLanguage, startDictation, stopDictation } = useVoiceDictation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showFullPicker, setShowFullPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [recentLanguages, setRecentLanguages] = useState<string[]>(['et', 'en'])
  const [lastLanguage, setLastLanguage] = useState<string>('et')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load settings on mount
  useEffect(() => {
    setRecentLanguages(getRecentLanguages())
    setLastLanguage(getLastLanguage())
  }, [])

  // Sprint 129 R5/R6: the problem dialog's buttons. Opening Settings keeps the
  // dialog open, so the user can come back and press Try Again.
  const handleProblemAction = (action: DictationAction) => {
    if (action === 'open-mic-settings') {
      sendToExtension('system:openMicSettings', {})
    } else if (action === 'retry') {
      dismissProblem()
      startDictation(lastLanguage)
    } else {
      dismissProblem()
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Handle primary button click - start/stop with last language
  const handlePrimaryClick = () => {
    if (state === 'listening' || state === 'processing') {
      stopDictation()
    } else {
      // Start with last used language
      startDictation(lastLanguage)
    }
  }

  // Handle dropdown toggle
  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (state !== 'listening' && state !== 'processing') {
      setShowDropdown(!showDropdown)
    }
  }

  // Handle language selection from dropdown
  const handleLanguageSelect = (code: string) => {
    saveRecentLanguage(code)
    setLastLanguage(code)
    setRecentLanguages(getRecentLanguages())
    setShowDropdown(false)
    startDictation(code)
  }

  // Get language name by code
  const getLanguageName = (code: string): string => {
    const lang = WHISPER_LANGUAGES.find(l => l.code === code)
    return lang?.name || code.toUpperCase()
  }

  // Get icon and styling based on state
  const getStateStyles = (state: DictationState) => {
    switch (state) {
      case 'idle':
        return {
          icon: <Icon name="microphone" size={16} />,
          color: 'var(--r-ink-strong)',
          title: `Start dictation (${getLanguageName(lastLanguage)})`
        }
      case 'listening':
        return {
          icon: <Icon name="microphone" size={16} />,
          color: 'var(--r-error)',
          title: `Dictating in ${getLanguageName(currentLanguage || lastLanguage)} - click to stop`
        }
      case 'processing':
        return {
          icon: <Icon name="circle-notch" size={16} className="dictation-spinner" />,
          color: 'var(--r-accent)',
          title: 'Processing transcription...'
        }
      case 'error':
        return {
          icon: <Icon name="warning" size={16} />,
          color: 'var(--r-warning)',
          title: problem
            ? `${dictationProblemCopy(problem.code, webviewPlatform, problem.detail).title}. Click to try again.`
            : 'Dictation stopped. Click to try again.'
        }
    }
  }

  const { icon, color, title } = getStateStyles(state)
  const isActive = state === 'listening' || state === 'processing'

  return (
    <div className="dictation-split-btn" ref={dropdownRef}>
      {/* Primary button - start/stop dictation */}
      <Tooltip label={title}>
        <button
          className={`dictation-primary ${state === 'listening' ? 'dictation-primary-listening' : ''}`}
          onClick={handlePrimaryClick}
          style={{ color }}
        >
          {icon}
          <span className="dictation-label">
            {isActive ? getLanguageName(currentLanguage || lastLanguage) : lastLanguage.toUpperCase()}
          </span>
        </button>
      </Tooltip>

      {/* Dropdown trigger */}
      <Tooltip label={isActive ? 'Stop dictation to change the language' : 'Select language'}>
        <button
          className="dictation-dropdown-trigger"
          onClick={handleDropdownClick}
          disabled={isActive}
          style={{ color: isActive ? 'var(--r-ink-disabled)' : 'var(--r-ink-strong)' }}
        >
          <Icon name="caret-down" size={12} />
        </button>
      </Tooltip>

      {/* Language dropdown */}
      {showDropdown && (
        <div className="dictation-dropdown">
          <div className="dictation-dropdown-header">Language</div>
          {recentLanguages.map(code => (
            <button
              key={code}
              className={`dictation-dropdown-item ${code === lastLanguage ? 'active' : ''}`}
              onClick={() => handleLanguageSelect(code)}
            >
              {getLanguageName(code)}
              <span className="dictation-dropdown-code">{code.toUpperCase()}</span>
            </button>
          ))}
          <div className="dictation-dropdown-divider" />
          <button
            className="dictation-dropdown-item dictation-dropdown-more"
            onClick={() => {
              setShowDropdown(false)
              setShowFullPicker(true)
            }}
          >
            More languages...
          </button>
          <button
            className="dictation-dropdown-item dictation-dropdown-settings"
            onClick={() => {
              setShowDropdown(false)
              setShowSettings(true)
            }}
          >
            Settings...
          </button>
        </div>
      )}

      <style>{`
        .dictation-split-btn {
          display: flex;
          align-items: center;
          position: relative;
          border-radius: 6px;
          background: transparent;
        }

        .dictation-split-btn:hover {
          background: var(--r-surface-soft);
        }

        .dictation-primary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: transparent;
          border: none;
          border-radius: 6px 0 0 6px;
          cursor: pointer;
          font-size: 13px;
          font-family: var(--ritemark-ui-font-family);
          transition: background-color 0.15s ease;
        }

        .dictation-label {
          font-weight: 400;
        }

        .dictation-dropdown-trigger {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 6px;
          background: transparent;
          border: none;
          border-left: 1px solid transparent;
          border-radius: 0 6px 6px 0;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .dictation-split-btn:hover .dictation-dropdown-trigger {
          border-left-color: var(--r-hairline, rgba(128,128,128,0.3));
        }

        .dictation-dropdown-trigger:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .dictation-split-btn:active {
          background: var(--r-surface-muted, var(--r-surface-soft));
        }

        .dictation-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          min-width: 160px;
          background: var(--r-surface, var(--vscode-editor-background));
          border: 1px solid var(--r-hairline);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          overflow: hidden;
        }

        .dictation-dropdown-header {
          padding: 8px 12px 4px;
          font-size: 11px;
          font-weight: 600;
          color: var(--r-ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dictation-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-family: inherit;
          color: var(--r-ink-strong);
          text-align: left;
          transition: background-color 0.1s ease;
        }

        .dictation-dropdown-item:hover {
          background: var(--r-surface-soft);
        }

        .dictation-dropdown-item.active {
          background: var(--r-accent-soft);
          color: var(--r-accent-deep);
        }

        .dictation-dropdown-code {
          font-size: 11px;
          color: var(--r-ink-muted);
          font-weight: 500;
        }

        .dictation-dropdown-item.active .dictation-dropdown-code {
          color: inherit;
          opacity: 0.7;
        }

        .dictation-dropdown-divider {
          height: 1px;
          background: var(--r-hairline, rgba(128,128,128,0.3));
          margin: 4px 0;
        }

        .dictation-dropdown-more,
        .dictation-dropdown-settings {
          color: var(--r-accent);
          font-size: 12px;
        }

        /* Pulsing animation for listening state */
        .dictation-primary-listening {
          animation: pulse-dictation 2s ease-in-out infinite;
        }

        @keyframes pulse-dictation {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* Spinning animation for processing state */
        .dictation-spinner {
          animation: spin-dictation 1s linear infinite;
        }

        @keyframes spin-dictation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Full language picker modal */}
      <LanguagePickerModal
        isOpen={showFullPicker}
        onClose={() => setShowFullPicker(false)}
        onSelect={(code: string) => {
          saveRecentLanguage(code)
          setLastLanguage(code)
          setRecentLanguages(getRecentLanguages())
          setShowFullPicker(false)
          startDictation(code)
        }}
        currentLanguage={recentLanguages[0] || null}
      />

      {/* Dictation settings modal */}
      <DictationSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Sprint 129: why dictation cannot start or stopped (microphone, engine, model) */}
      <DictationProblemDialog
        problem={problem?.code ?? null}
        detail={problem?.detail}
        platform={webviewPlatform}
        onAction={handleProblemAction}
      />
    </div>
  )
}
