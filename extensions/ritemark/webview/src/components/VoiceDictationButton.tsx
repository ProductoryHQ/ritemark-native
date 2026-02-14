import React, { useState, useEffect, useRef } from 'react'
import { Mic, Mic2, Loader2, AlertTriangle, ChevronDown } from 'lucide-react'
import { useVoiceDictation, type DictationState } from '../hooks/useVoiceDictation'
import { LanguagePickerModal, WHISPER_LANGUAGES } from './LanguagePickerModal'
import { DictationSettingsModal } from './DictationSettingsModal'
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
  const { state, error, currentLanguage, startDictation, stopDictation } = useVoiceDictation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showFullPicker, setShowFullPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMicPermission, setShowMicPermission] = useState(false)
  const [recentLanguages, setRecentLanguages] = useState<string[]>(['et', 'en'])
  const [lastLanguage, setLastLanguage] = useState<string>('et')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load settings on mount
  useEffect(() => {
    setRecentLanguages(getRecentLanguages())
    setLastLanguage(getLastLanguage())
  }, [])

  // Show mic permission modal when mic access is denied
  useEffect(() => {
    if (error && error.includes('Microphone access denied')) {
      setShowMicPermission(true)
    }
  }, [error])

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
          icon: <Mic size={16} />,
          color: 'var(--vscode-foreground)',
          title: `Start dictation (${getLanguageName(lastLanguage)})`
        }
      case 'listening':
        return {
          icon: <Mic2 size={16} />,
          color: '#ef4444',
          title: `Dictating in ${getLanguageName(currentLanguage || lastLanguage)} - click to stop`
        }
      case 'processing':
        return {
          icon: <Loader2 size={16} className="dictation-spinner" />,
          color: '#3b82f6',
          title: 'Processing transcription...'
        }
      case 'error':
        return {
          icon: <AlertTriangle size={16} />,
          color: '#f59e0b',
          title: error || 'Dictation error - click to retry'
        }
    }
  }

  const { icon, color, title } = getStateStyles(state)
  const isActive = state === 'listening' || state === 'processing'

  return (
    <div className="dictation-split-btn" ref={dropdownRef}>
      {/* Primary button - start/stop dictation */}
      <button
        className="dictation-primary"
        onClick={handlePrimaryClick}
        title={title}
        style={{ color }}
      >
        {icon}
        <span className="dictation-label">
          {isActive ? getLanguageName(currentLanguage || lastLanguage) : lastLanguage.toUpperCase()}
        </span>
      </button>

      {/* Dropdown trigger */}
      <button
        className="dictation-dropdown-trigger"
        onClick={handleDropdownClick}
        title="Select language"
        disabled={isActive}
        style={{ color: isActive ? 'var(--vscode-disabledForeground)' : 'var(--vscode-foreground)' }}
      >
        <ChevronDown size={12} />
      </button>

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
          background: var(--vscode-toolbar-hoverBackground);
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
          border-left-color: var(--vscode-widget-border, rgba(128,128,128,0.3));
        }

        .dictation-dropdown-trigger:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .dictation-split-btn:active {
          background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
        }

        .dictation-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          min-width: 160px;
          background: var(--vscode-dropdown-background, var(--vscode-editor-background));
          border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border));
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          overflow: hidden;
        }

        .dictation-dropdown-header {
          padding: 8px 12px 4px;
          font-size: 11px;
          font-weight: 600;
          color: var(--vscode-descriptionForeground);
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
          color: var(--vscode-foreground);
          text-align: left;
          transition: background-color 0.1s ease;
        }

        .dictation-dropdown-item:hover {
          background: var(--vscode-list-hoverBackground);
        }

        .dictation-dropdown-item.active {
          background: var(--vscode-list-activeSelectionBackground);
          color: var(--vscode-list-activeSelectionForeground);
        }

        .dictation-dropdown-code {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          font-weight: 500;
        }

        .dictation-dropdown-item.active .dictation-dropdown-code {
          color: inherit;
          opacity: 0.7;
        }

        .dictation-dropdown-divider {
          height: 1px;
          background: var(--vscode-widget-border, rgba(128,128,128,0.3));
          margin: 4px 0;
        }

        .dictation-dropdown-more,
        .dictation-dropdown-settings {
          color: var(--vscode-textLink-foreground);
          font-size: 12px;
        }

        /* Pulsing animation for listening state */
        .dictation-primary:has(.lucide-mic-2) {
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
        recentLanguages={recentLanguages}
      />

      {/* Dictation settings modal */}
      <DictationSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Microphone permission modal */}
      {showMicPermission && (
        <>
          <div className="mic-permission-backdrop" onClick={() => setShowMicPermission(false)}>
            <div className="mic-permission-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mic-permission-icon">
                <Mic size={24} />
              </div>
              <h3 className="mic-permission-title">Microphone Access Required</h3>
              <p className="mic-permission-text">
                Ritemark needs microphone access for voice dictation.
              </p>
              <div className="mic-permission-steps">
                <p><strong>To enable:</strong></p>
                <p>System Settings → Privacy & Security → Microphone → Enable <strong>Ritemark</strong></p>
              </div>
              <div className="mic-permission-buttons">
                <button
                  className="mic-permission-btn-primary"
                  onClick={() => {
                    sendToExtension('system:openMicSettings', {})
                    setShowMicPermission(false)
                  }}
                >
                  Open System Settings
                </button>
                <button
                  className="mic-permission-btn-secondary"
                  onClick={() => setShowMicPermission(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          <style>{`
            .mic-permission-backdrop {
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.4);
              z-index: 9999;
              display: flex;
              align-items: center;
              justify-content: center;
              animation: modal-fade-in 150ms ease-out;
            }
            .mic-permission-modal {
              width: 340px;
              max-width: 90vw;
              background: var(--vscode-editor-background);
              border: 1px solid var(--vscode-panel-border);
              border-radius: 12px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
              padding: 24px;
              text-align: center;
            }
            .mic-permission-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: var(--vscode-toolbar-hoverBackground);
              color: var(--vscode-foreground);
              margin-bottom: 12px;
            }
            .mic-permission-title {
              font-size: 16px;
              font-weight: 600;
              color: var(--vscode-foreground);
              margin: 0 0 8px;
            }
            .mic-permission-text {
              font-size: 13px;
              color: var(--vscode-descriptionForeground);
              margin: 0 0 16px;
            }
            .mic-permission-steps {
              text-align: left;
              background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.1));
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 20px;
              font-size: 13px;
              color: var(--vscode-foreground);
            }
            .mic-permission-steps p {
              margin: 0 0 4px;
            }
            .mic-permission-steps p:last-child {
              margin: 0;
            }
            .mic-permission-buttons {
              display: flex;
              gap: 8px;
              justify-content: center;
            }
            .mic-permission-btn-primary {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: opacity 0.15s ease;
            }
            .mic-permission-btn-primary:hover {
              opacity: 0.9;
            }
            .mic-permission-btn-secondary {
              padding: 8px 16px;
              border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border));
              border-radius: 6px;
              background: transparent;
              color: var(--vscode-foreground);
              font-size: 13px;
              cursor: pointer;
              transition: background-color 0.15s ease;
            }
            .mic-permission-btn-secondary:hover {
              background: var(--vscode-toolbar-hoverBackground);
            }
          `}</style>
        </>
      )}
    </div>
  )
}
