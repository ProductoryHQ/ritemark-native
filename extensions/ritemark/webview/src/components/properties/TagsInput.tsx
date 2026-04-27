import { useState, useRef } from 'react'
import { Icon } from '../ui/Icon'

interface TagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagsInput({ tags, onChange }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
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

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`flex flex-wrap items-center gap-1 rounded-lg border bg-surface-muted px-3 py-2 min-h-[40px] cursor-text transition-colors ${
        isFocused ? 'border-[var(--r-accent)] ring-1 ring-[--r-accent]' : 'border-hairline-strong hover:border-hairline-strong'
      }`}
    >
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--r-accent-soft)] text-[var(--r-accent-deep)] rounded"
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTag(index)
            }}
            className="hover:text-[var(--r-accent)]"
          >
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setIsFocused(false)
          if (inputValue.trim()) addTag()
        }}
        onFocus={() => setIsFocused(true)}
        placeholder={tags.length === 0 ? 'Add tags...' : ''}
        className="flex-1 min-w-[60px] text-[13px] font-medium bg-transparent border-none outline-none text-ink-strong placeholder:text-ink-faint"
      />
    </div>
  )
}
