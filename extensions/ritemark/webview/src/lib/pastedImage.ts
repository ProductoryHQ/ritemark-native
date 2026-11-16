/**
 * A picture pasted or dropped from the computer: found in the clipboard or the drop, named, and read as a data URL.
 * The document editor and the deck's stage (Sprint 157) both save pictures this way.
 */

// Helper to read a File as base64 data URL
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Generate a unique filename for pasted/dropped images.
// macOS screenshots always have file.name = "image.png", so we must
// detect generic names and always generate a unique timestamp-based name.
export function getUniqueImageFilename(file: File): string {
  const extension = file.type.split('/')[1] || 'png'
  const baseName = file.name ? file.name.replace(/\.[^.]+$/, '') : ''
  const isGeneric = !baseName || /^image$/i.test(baseName)
  if (isGeneric) {
    return `image-${Date.now()}.${extension}`
  }
  return file.name
}

export function getClipboardImageFile(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) {
    return null
  }

  if (dataTransfer.items) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          return file
        }
      }
    }
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (const file of Array.from(dataTransfer.files)) {
      if (file.type.startsWith('image/')) {
        return file
      }
    }
  }

  return null
}

function extractPlainTextFromHtml(html: string): string {
  if (!html.trim()) {
    return ''
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent?.trim() ?? ''
  } catch {
    return ''
  }
}

export function shouldPreferTextPaste(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false
  }

  const types = Array.from(dataTransfer.types ?? [])
  const plainText = dataTransfer.getData('text/plain').trim()
  const html = dataTransfer.getData('text/html')
  const htmlText = extractPlainTextFromHtml(html)

  if (plainText.length > 0) {
    return true
  }

  if ((types.includes('text/html') || types.includes('text/rtf')) && htmlText.length > 0) {
    return true
  }

  return false
}

/**
 * A picture from the computer onto a slide (Sprint 157; Sprint 161 PR 2 shares it between both stages): pasted, unless
 * words are being pasted, or dropped. True when it was a picture, handed on as a data URL with a unique file name.
 */
export function takeImageFile(transfer: DataTransfer | null, pasted: boolean, onPicture: (dataUrl: string, filename: string) => void): boolean {
  const file = getClipboardImageFile(transfer)
  if (!file) return false
  if (pasted && shouldPreferTextPaste(transfer)) return false
  void readFileAsBase64(file).then(dataUrl => onPicture(dataUrl, getUniqueImageFilename(file)))
  return true
}
