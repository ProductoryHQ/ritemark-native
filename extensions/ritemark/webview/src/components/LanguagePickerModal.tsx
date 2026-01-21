import React, { useState } from 'react'
import { X, Search } from 'lucide-react'

export interface Language {
  code: string
  name: string
  nativeName: string
}

// Whisper supported languages
// Source: https://github.com/openai/whisper#available-models-and-languages
export const WHISPER_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
]

interface LanguagePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (code: string) => void
  currentLanguage: string | null
}

/**
 * Full language picker modal with search
 */
export function LanguagePickerModal({ isOpen, onClose, onSelect, currentLanguage }: LanguagePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const filteredLanguages = WHISPER_LANGUAGES.filter(
    lang =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelect = (code: string) => {
    onSelect(code)
    onClose()
    setSearchQuery('')
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="language-picker-backdrop" onClick={handleBackdropClick}>
      <div className="language-picker-modal">
        {/* Header */}
        <div className="language-picker-header">
          <h3>Select Language</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="language-picker-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search languages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Language list */}
        <div className="language-picker-list">
          {filteredLanguages.length === 0 ? (
            <div className="no-results">No languages found</div>
          ) : (
            filteredLanguages.map(lang => (
              <button
                key={lang.code}
                className={`language-item ${lang.code === currentLanguage ? 'active' : ''}`}
                onClick={() => handleSelect(lang.code)}
              >
                <div className="language-name">{lang.name}</div>
                <div className="language-native">{lang.nativeName}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <style>{`
        /* Backdrop */
        .language-picker-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        /* Modal */
        .language-picker-modal {
          width: 400px;
          max-height: 600px;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        /* Header */
        .language-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .language-picker-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--vscode-foreground);
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--vscode-foreground);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        /* Search */
        .language-picker-search {
          position: relative;
          padding: 12px 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .search-icon {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--vscode-input-placeholderForeground);
          pointer-events: none;
        }

        .language-picker-search input {
          width: 100%;
          padding: 8px 12px 8px 32px;
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 4px;
          color: var(--vscode-input-foreground);
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .language-picker-search input:focus {
          outline: none;
          border-color: var(--vscode-focusBorder);
        }

        .language-picker-search input::placeholder {
          color: var(--vscode-input-placeholderForeground);
        }

        /* Language list */
        .language-picker-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .no-results {
          padding: 32px;
          text-align: center;
          color: var(--vscode-input-placeholderForeground);
          font-size: 13px;
        }

        .language-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: background-color 0.15s ease;
        }

        .language-item:hover {
          background: var(--vscode-list-hoverBackground);
        }

        .language-item.active {
          background: var(--vscode-list-activeSelectionBackground);
          color: var(--vscode-list-activeSelectionForeground);
        }

        .language-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--vscode-foreground);
        }

        .language-item.active .language-name {
          color: var(--vscode-list-activeSelectionForeground);
        }

        .language-native {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }

        .language-item.active .language-native {
          color: var(--vscode-list-activeSelectionForeground);
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}
