import { useState, useEffect, useRef } from 'react'
import { COMMON_PROPERTIES, type PropertyType } from './types'

interface AddPropertyMenuProps {
  existingKeys: string[]
  onAdd: (key: string, type: PropertyType) => void
  onClose: () => void
}

export function AddPropertyMenu({ existingKeys, onAdd, onClose }: AddPropertyMenuProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customKey, setCustomKey] = useState('')
  const [error, setError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  const availableProperties = COMMON_PROPERTIES.filter(
    p => !existingKeys.includes(p.key)
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus()
    }
  }, [showCustomInput])

  const handleAddCustom = () => {
    const trimmedKey = customKey.trim().toLowerCase()

    if (!trimmedKey) {
      setError('Please enter a property name')
      return
    }
    if (existingKeys.includes(trimmedKey)) {
      setError('This property already exists')
      return
    }
    if (!/^[a-z][a-z0-9_]*$/i.test(trimmedKey)) {
      setError('Use letters, numbers, and underscores only')
      return
    }

    onAdd(trimmedKey, 'text')
    setCustomKey('')
    setShowCustomInput(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCustom()
    } else if (e.key === 'Escape') {
      if (showCustomInput) {
        setShowCustomInput(false)
        setCustomKey('')
        setError('')
      } else {
        onClose()
      }
    }
  }

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-full mt-1 w-52 bg-surface border border-hairline rounded-xl shadow-lg z-50 overflow-hidden"
    >
      {availableProperties.length > 0 && (
        <div className="p-2">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">
            Common
          </div>
          {availableProperties.map(prop => (
            <button
              key={prop.key}
              onClick={() => onAdd(prop.key, prop.type)}
              className="w-full px-2 py-1.5 text-[13px] text-left text-ink-strong hover:bg-surface-soft rounded-lg transition-colors"
            >
              {prop.label}
            </button>
          ))}
        </div>
      )}

      {availableProperties.length > 0 && (
        <div className="border-t border-hairline mx-2" />
      )}

      <div className="p-2">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">
          Custom
        </div>
        {showCustomInput ? (
          <div className="px-2 py-1">
            <input
              ref={customInputRef}
              type="text"
              value={customKey}
              onChange={(e) => {
                setCustomKey(e.target.value)
                setError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="Property name"
              className="w-full h-9 px-3 text-[13px] border border-hairline-strong rounded-lg bg-surface-muted outline-none focus:ring-1 focus:ring-[--r-accent] text-ink-strong placeholder:text-ink-faint"
            />
            {error && (
              <p className="text-[11px] text-[var(--r-error)] mt-1">{error}</p>
            )}
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomKey('')
                  setError('')
                }}
                className="flex-1 px-2 py-1.5 text-[12px] text-ink-body border border-hairline rounded-lg hover:bg-surface-soft transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustom}
                className="flex-1 px-2 py-1.5 text-[12px] text-white bg-[var(--r-accent)] rounded-lg hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full px-2 py-1.5 text-[13px] text-left text-ink-strong hover:bg-surface-soft rounded-lg transition-colors"
          >
            Custom field...
          </button>
        )}
      </div>
    </div>
  )
}
