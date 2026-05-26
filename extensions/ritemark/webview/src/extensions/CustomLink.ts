/**
 * CustomLink Extension
 *
 * Extends TipTap's Link extension to provide:
 * - Click on link → opens edit dialog
 * - Cmd/Ctrl+click → opens link in browser
 *
 * @see Sprint 14: Block Interactions
 */

import Link, { type LinkOptions } from '@tiptap/extension-link'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { openExternalUrl, openInternalLink } from '../bridge'
import { canOpenExternally, classifyLinkTarget } from '../lib/linkTargets'

export interface CustomLinkOptions extends Partial<LinkOptions> {
  /**
   * Callback when a link is clicked (without modifier key)
   * Used to open the link edit dialog
   */
  onLinkClick?: (href: string) => void

  /**
   * Sprint 72 R7: callback when the user modifier-clicks an internal link.
   * Should hand off to the extension host so the target file is opened
   * (Ritemark for Markdown, VS Code default opener otherwise). When
   * undefined, the default `openInternalLink` bridge helper is used.
   */
  onInternalLinkActivate?: (href: string) => void
}

export const CustomLink = Link.extend<CustomLinkOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false, // We handle clicks ourselves
      onLinkClick: undefined,
      onInternalLinkActivate: undefined,
    }
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() || []
    const { onLinkClick, onInternalLinkActivate } = this.options

    const linkClickHandler = new Plugin({
      key: new PluginKey('customLinkClickHandler'),
      props: {
        // Use handleDOMEvents to intercept clicks BEFORE browser default behavior
        handleDOMEvents: {
          click(_view, event) {
            // Check if we clicked on a link
            const link = (event.target as HTMLElement)?.closest('a')
            if (!link) return false

            const href = link.getAttribute('href')
            if (!href) return false

            // Always prevent default browser navigation
            event.preventDefault()
            event.stopPropagation()

            // Cmd+click (Mac) or Ctrl+click (Windows/Linux):
            //   external → open in default browser
            //   internal → ask extension host to open the target file (R7)
            //   anchor   → fall through to the edit dialog for now
            //              (future: scroll to that heading within the doc)
            //   empty / dangerous → fall through to edit dialog so the
            //              user can see and fix the link.
            if (event.metaKey || event.ctrlKey) {
              if (canOpenExternally(href)) {
                openExternalUrl(href)
                return true
              }

              const target = classifyLinkTarget(href)
              if (target.kind === 'internal') {
                if (onInternalLinkActivate) {
                  onInternalLinkActivate(target.href)
                } else {
                  openInternalLink(target.href)
                }
                return true
              }

              // Anchor (`#section`), empty, or dangerous → don't dispatch a
              // navigation request, but still hand off to onLinkClick so the
              // user can edit/inspect the link.
              if (onLinkClick) {
                onLinkClick(href)
              }
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
