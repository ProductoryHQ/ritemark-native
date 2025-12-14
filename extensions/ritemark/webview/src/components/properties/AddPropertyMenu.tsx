import { useState, useEffect, useRef } from 'react'
import { COMMON_PROPERTIES, type PropertyType } from './PropertiesPanel'

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

  // Available common properties (not yet added)
  const availableProperties = COMMON_PROPERTIES.filter(
    p => !existingKeys.includes(p.key)
  )

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Focus custom input when shown
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

    // Validate key format (alphanumeric and underscores only)
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
      className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
    >
      {/* Common properties */}
      {availableProperties.length > 0 && (
        <div className="p-2">
          <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Common
          </div>
          {availableProperties.map(prop => (
            <button
              key={prop.key}
              onClick={() => onAdd(prop.key, prop.type)}
              className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              {prop.label}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      {availableProperties.length > 0 && (
        <div className="border-t border-gray-200" />
      )}

      {/* Custom property */}
      <div className="p-2">
        <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
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
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomKey('')
                  setError('')
                }}
                className="flex-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustom}
                className="flex-1 px-2 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            Custom field...
          </button>
        )}
      </div>
    </div>
  )
}
