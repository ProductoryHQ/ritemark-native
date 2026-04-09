import { useState, useRef } from 'react'
import { X } from 'lucide-react'

interface TagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagsInput({ tags, onChange }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Add tag on Enter or comma
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTag(tags.length - 1)
    }
  }

  const addTag = () => {
    const trimmed = inputValue.trim().replace(/,/g, '')
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue('')
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  // Focus input when clicking container
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div
      onClick={handleContainerClick}
      className={`flex-1 flex flex-wrap items-center gap-1 px-2 py-1 min-h-[32px] bg-white border rounded cursor-text transition-colors ${
        isFocused ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Tag chips */}
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTag(index)
            }}
            className="hover:text-blue-600"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Input for new tags */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setIsFocused(false)
          // Add tag on blur if there's content
          if (inputValue.trim()) {
            addTag()
          }
        }}
        onFocus={() => setIsFocused(true)}
        placeholder={tags.length === 0 ? 'Add tags...' : ''}
        className="flex-1 min-w-[80px] text-sm bg-transparent border-none outline-none placeholder-gray-400"
      />
    </div>
  )
}
