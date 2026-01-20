import React, { useState, useEffect, useCallback } from 'react'
import { X, Settings, Trash2, HardDrive } from 'lucide-react'
import { sendToExtension, onMessage } from '../bridge'

// Settings stored in localStorage
export interface DictationSettings {
  chunkDuration: 3000 | 5000 | 10000
  vadEnabled: boolean
  noiseReductionEnabled: boolean
}

export const DICTATION_SETTINGS_KEY = 'ritemark:dictation-settings'

export const DEFAULT_DICTATION_SETTINGS: DictationSettings = {
  chunkDuration: 3000,
  vadEnabled: false,
  noiseReductionEnabled: false
}

// Get settings from localStorage
export function getDictationSettings(): DictationSettings {
  try {
    const stored = localStorage.getItem(DICTATION_SETTINGS_KEY)
    if (stored) {
      return { ...DEFAULT_DICTATION_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_DICTATION_SETTINGS
}

// Save settings to localStorage
function saveDictationSettings(settings: DictationSettings): void {
  try {
    localStorage.setItem(DICTATION_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore errors
  }
}

interface ModelStatus {
  downloaded: boolean
  sizeBytes: number
  path: string
  modelName: string
  modelSizeDisplay: string
  isDictationActive: boolean
}

interface DictationSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Dictation settings modal
 *
 * Settings:
 * - Chunk duration (3s/5s/10s)
 * - VAD toggle (coming soon)
 * - Noise Reduction toggle (coming soon)
 * - Model management (status + remove)
 */
export function DictationSettingsModal({ isOpen, onClose }: DictationSettingsModalProps) {
  const [settings, setSettings] = useState<DictationSettings>(getDictationSettings)
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showConfirmRemove, setShowConfirmRemove] = useState(false)

  // Request model status when modal opens
  useEffect(() => {
    if (isOpen) {
      sendToExtension('dictation:getModelStatus', {})
    }
  }, [isOpen])

  // Listen for model status response
  useEffect(() => {
    const handleMessage = (message: { type: string; [key: string]: unknown }) => {
      if (message.type === 'dictation:modelStatus') {
        setModelStatus(message.status as ModelStatus)
        setIsRemoving(false)
        setShowConfirmRemove(false)
      } else if (message.type === 'dictation:modelRemoved') {
        // Refresh status after removal
        sendToExtension('dictation:getModelStatus', {})
      }
    }

    const unsubscribe = onMessage(handleMessage)
    return unsubscribe
  }, [])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle click outside modal
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Update settings
  const updateSettings = (updates: Partial<DictationSettings>) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    saveDictationSettings(newSettings)
  }

  // Handle model removal - show confirmation first
  const handleRemoveClick = () => {
    if (!modelStatus?.downloaded) return
    // Block if dictation is active
    if (modelStatus.isDictationActive) return
    setShowConfirmRemove(true)
  }

  // Confirm and execute removal
  const handleConfirmRemove = () => {
    setIsRemoving(true)
    setShowConfirmRemove(false)
    sendToExtension('dictation:removeModel', {})
  }

  // Cancel removal
  const handleCancelRemove = () => {
    setShowConfirmRemove(false)
  }

  // Format bytes to human readable
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="dictation-settings-backdrop" onClick={handleBackdropClick}>
        {/* Modal container */}
        <div className="dictation-settings-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="dictation-settings-header">
            <div className="dictation-settings-header-left">
              <Settings size={18} />
              <h2 className="dictation-settings-title">Dictation Settings</h2>
            </div>
            <button
              className="dictation-settings-close"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="dictation-settings-content">
            {/* Model Section */}
            <div className="dictation-settings-section">
              <div className="dictation-settings-section-header">MODEL</div>
              <div className="dictation-settings-model">
                <div className="dictation-settings-model-info">
                  <div className="dictation-settings-model-name">
                    <HardDrive size={14} />
                    {modelStatus?.modelName || 'Loading...'}
                    {modelStatus?.modelSizeDisplay && (
                      <span className="model-size-label">({modelStatus.modelSizeDisplay})</span>
                    )}
                  </div>
                  <div className="dictation-settings-model-status">
                    {modelStatus === null ? (
                      'Checking...'
                    ) : modelStatus.downloaded ? (
                      <span className="model-downloaded">{formatSize(modelStatus.sizeBytes)}</span>
                    ) : (
                      <span className="model-not-downloaded">Not downloaded</span>
                    )}
                  </div>
                </div>
                {modelStatus?.downloaded && !showConfirmRemove && (
                  <button
                    className="dictation-settings-remove-btn"
                    onClick={handleRemoveClick}
                    disabled={isRemoving || modelStatus.isDictationActive}
                    title={modelStatus.isDictationActive ? 'Stop dictation first' : 'Remove model'}
                  >
                    <Trash2 size={14} />
                    {isRemoving ? 'Removing...' : modelStatus.isDictationActive ? 'In use' : 'Remove'}
                  </button>
                )}
                {showConfirmRemove && (
                  <div className="dictation-settings-confirm">
                    <span>Delete?</span>
                    <button className="confirm-yes" onClick={handleConfirmRemove}>Yes</button>
                    <button className="confirm-no" onClick={handleCancelRemove}>No</button>
                  </div>
                )}
              </div>
            </div>

            {/* Audio Processing Section */}
            <div className="dictation-settings-section">
              <div className="dictation-settings-section-header">AUDIO PROCESSING</div>

              {/* Chunk Duration */}
              <div className="dictation-settings-row">
                <div className="dictation-settings-label">
                  <span>Chunk duration</span>
                  <span className="dictation-settings-description">
                    How often audio is sent for transcription
                  </span>
                </div>
                <div className="dictation-settings-radio-group">
                  {([3000, 5000, 10000] as const).map((duration) => (
                    <label key={duration} className="dictation-settings-radio">
                      <input
                        type="radio"
                        name="chunkDuration"
                        checked={settings.chunkDuration === duration}
                        onChange={() => updateSettings({ chunkDuration: duration })}
                      />
                      <span className="radio-label">{duration / 1000}s</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* VAD Toggle */}
              <div className="dictation-settings-row disabled">
                <div className="dictation-settings-label">
                  <span>Voice Activity Detection</span>
                  <span className="dictation-settings-description">
                    Only transcribe when speech is detected
                  </span>
                </div>
                <div className="dictation-settings-toggle-group">
                  <span className="coming-soon">Coming soon</span>
                </div>
              </div>

              {/* Noise Reduction Toggle */}
              <div className="dictation-settings-row disabled">
                <div className="dictation-settings-label">
                  <span>Noise Reduction</span>
                  <span className="dictation-settings-description">
                    Filter background noise before transcription
                  </span>
                </div>
                <div className="dictation-settings-toggle-group">
                  <span className="coming-soon">Coming soon</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dictation-settings-footer">
            <button className="dictation-settings-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      <style>{`
        /* Backdrop */
        .dictation-settings-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: dictation-modal-fade-in 150ms ease-out;
        }

        @keyframes dictation-modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Modal */
        .dictation-settings-modal {
          position: relative;
          width: 400px;
          max-width: 90vw;
          max-height: 80vh;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          animation: dictation-modal-scale-in 150ms ease-out;
        }

        @keyframes dictation-modal-scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Header */
        .dictation-settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .dictation-settings-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--vscode-foreground);
        }

        .dictation-settings-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--vscode-foreground);
          margin: 0;
        }

        .dictation-settings-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--vscode-foreground);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .dictation-settings-close:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        /* Content */
        .dictation-settings-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        /* Section */
        .dictation-settings-section {
          margin-bottom: 24px;
        }

        .dictation-settings-section:last-child {
          margin-bottom: 0;
        }

        .dictation-settings-section-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--vscode-descriptionForeground);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        /* Model info */
        .dictation-settings-model {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 8px;
        }

        .dictation-settings-model-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dictation-settings-model-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--vscode-foreground);
        }

        .model-size-label {
          font-weight: 400;
          color: var(--vscode-descriptionForeground);
        }

        .dictation-settings-model-status {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }

        .model-downloaded {
          color: var(--vscode-charts-green, #4ade80);
        }

        .model-not-downloaded {
          color: var(--vscode-charts-yellow, #facc15);
        }

        .dictation-settings-remove-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: 1px solid var(--vscode-input-border);
          border-radius: 6px;
          color: var(--vscode-errorForeground, #ef4444);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dictation-settings-remove-btn:hover:not(:disabled) {
          background: var(--vscode-inputValidation-errorBackground, rgba(239, 68, 68, 0.1));
          border-color: var(--vscode-errorForeground, #ef4444);
        }

        .dictation-settings-remove-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Confirmation dialog */
        .dictation-settings-confirm {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--vscode-foreground);
        }

        .dictation-settings-confirm button {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .confirm-yes {
          background: var(--vscode-errorForeground, #ef4444);
          color: white;
          border: none;
        }

        .confirm-yes:hover {
          opacity: 0.9;
        }

        .confirm-no {
          background: transparent;
          color: var(--vscode-foreground);
          border: 1px solid var(--vscode-input-border);
        }

        .confirm-no:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        /* Settings rows */
        .dictation-settings-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .dictation-settings-row:last-child {
          border-bottom: none;
        }

        .dictation-settings-row.disabled {
          opacity: 0.6;
        }

        .dictation-settings-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dictation-settings-label > span:first-child {
          font-size: 13px;
          font-weight: 500;
          color: var(--vscode-foreground);
        }

        .dictation-settings-description {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
        }

        /* Radio group */
        .dictation-settings-radio-group {
          display: flex;
          gap: 8px;
        }

        .dictation-settings-radio {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .dictation-settings-radio input {
          margin: 0;
          cursor: pointer;
        }

        .dictation-settings-radio .radio-label {
          font-size: 13px;
          color: var(--vscode-foreground);
        }

        /* Toggle group */
        .dictation-settings-toggle-group {
          display: flex;
          align-items: center;
        }

        .coming-soon {
          font-size: 11px;
          padding: 4px 8px;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          border-radius: 4px;
        }

        /* Footer */
        .dictation-settings-footer {
          display: flex;
          justify-content: flex-end;
          padding: 16px;
          border-top: 1px solid var(--vscode-panel-border);
        }

        .dictation-settings-done-btn {
          padding: 8px 16px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .dictation-settings-done-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }
      `}</style>
    </>
  )
}
