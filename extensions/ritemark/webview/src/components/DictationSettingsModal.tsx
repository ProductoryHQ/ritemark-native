import { useState, useEffect } from 'react'
import { Settings, Trash2, HardDrive } from 'lucide-react'
import { sendToExtension, onMessage } from '../bridge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogButton,
} from './ui/dialog'

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader icon={<Settings size={18} />} onClose={onClose}>
          <DialogTitle>Dictation Settings</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {/* Model Section */}
          <div className="mb-6">
            <div className="text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider mb-3">MODEL</div>
            <div className="flex items-center justify-between p-3 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-lg">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--vscode-foreground)]">
                  <HardDrive size={14} />
                  {modelStatus?.modelName || 'Loading...'}
                  {modelStatus?.modelSizeDisplay && (
                    <span className="font-normal text-[var(--vscode-descriptionForeground)]">({modelStatus.modelSizeDisplay})</span>
                  )}
                </div>
                <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                  {modelStatus === null ? (
                    'Checking...'
                  ) : modelStatus.downloaded ? (
                    <span className="text-[var(--vscode-charts-green,#4ade80)]">{formatSize(modelStatus.sizeBytes)}</span>
                  ) : (
                    <span className="text-[var(--vscode-charts-yellow,#facc15)]">Not downloaded</span>
                  )}
                </div>
              </div>
              {modelStatus?.downloaded && !showConfirmRemove && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--vscode-input-border)] rounded-md text-xs text-[var(--vscode-errorForeground,#ef4444)] cursor-pointer transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:border-[var(--vscode-errorForeground,#ef4444)] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleRemoveClick}
                  disabled={isRemoving || modelStatus.isDictationActive}
                  title={modelStatus.isDictationActive ? 'Stop dictation first' : 'Remove model'}
                >
                  <Trash2 size={14} />
                  {isRemoving ? 'Removing...' : modelStatus.isDictationActive ? 'In use' : 'Remove'}
                </button>
              )}
              {showConfirmRemove && (
                <div className="flex items-center gap-2 text-xs text-[var(--vscode-foreground)]">
                  <span>Delete?</span>
                  <button className="px-2.5 py-1 rounded bg-[var(--vscode-errorForeground,#ef4444)] text-white text-xs border-none cursor-pointer hover:opacity-90" onClick={handleConfirmRemove}>Yes</button>
                  <button className="px-2.5 py-1 rounded bg-transparent text-[var(--vscode-foreground)] text-xs border border-[var(--vscode-input-border)] cursor-pointer hover:bg-[var(--vscode-toolbar-hoverBackground)]" onClick={handleCancelRemove}>No</button>
                </div>
              )}
            </div>
          </div>

          {/* Audio Processing Section */}
          <div>
            <div className="text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider mb-3">AUDIO PROCESSING</div>

            {/* Chunk Duration */}
            <div className="flex items-start justify-between py-3 border-b border-[var(--vscode-panel-border)]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-[var(--vscode-foreground)]">Chunk duration</span>
                <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">How often audio is sent for transcription</span>
              </div>
              <div className="flex gap-2">
                {([3000, 5000, 10000] as const).map((duration) => (
                  <label key={duration} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="chunkDuration"
                      className="m-0 cursor-pointer"
                      checked={settings.chunkDuration === duration}
                      onChange={() => updateSettings({ chunkDuration: duration })}
                    />
                    <span className="text-[13px] text-[var(--vscode-foreground)]">{duration / 1000}s</span>
                  </label>
                ))}
              </div>
            </div>

            {/* VAD Toggle */}
            <div className="flex items-start justify-between py-3 border-b border-[var(--vscode-panel-border)] opacity-60">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-[var(--vscode-foreground)]">Voice Activity Detection</span>
                <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">Only transcribe when speech is detected</span>
              </div>
              <span className="text-[11px] px-2 py-1 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] rounded">Coming soon</span>
            </div>

            {/* Noise Reduction Toggle */}
            <div className="flex items-start justify-between py-3 opacity-60">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-[var(--vscode-foreground)]">Noise Reduction</span>
                <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">Filter background noise before transcription</span>
              </div>
              <span className="text-[11px] px-2 py-1 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] rounded">Coming soon</span>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogButton onClick={onClose}>Done</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
