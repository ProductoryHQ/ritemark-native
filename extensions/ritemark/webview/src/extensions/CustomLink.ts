/**
 * CustomLink Extension
 *
 * Extends TipTap's Link extension to provide:
 * - Click on link → opens edit dialog
 * - Cmd/Ctrl+click → opens link in browser
 *
 * @see Sprint 14: Block Interactions
 */

import Link from '@tiptap/extension-link'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { openExternalUrl } from '../bridge'

export interface CustomLinkOptions {
  /**
   * Callback when a link is clicked (without modifier key)
   * Used to open the link edit dialog
   */
  onLinkClick?: (href: string) => void
}

export const CustomLink = Link.extend<CustomLinkOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false, // We handle clicks ourselves
      onLinkClick: undefined,
    }
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() || []
    const { onLinkClick } = this.options

    const linkClickHandler = new Plugin({
      key: new PluginKey('customLinkClickHandler'),
      props: {
        // Use handleDOMEvents to intercept clicks BEFORE browser default behavior
        handleDOMEvents: {
          click(view, event) {
            // Check if we clicked on a link
            const link = (event.target as HTMLElement)?.closest('a')
            if (!link) return false

            const href = link.getAttribute('href')
            if (!href) return false

            // Always prevent default browser navigation
            event.preventDefault()
            event.stopPropagation()

            // Cmd+click (Mac) or Ctrl+click (Windows/Linux) opens in browser
            if (event.metaKey || event.ctrlKey) {
              openExternalUrl(href)
              return true
            }

            // Regular click opens edit dialog
            if (onLinkClick) {
              onLinkClick(href)
            }
            return true
          },
        },
      },
    })

    plugins.push(linkClickHandler)
    return plugins
  },
})

export default CustomLink
