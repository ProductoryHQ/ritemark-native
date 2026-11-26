/** Keep a handled link click from reaching VS Code's webview window listener. */
export function consumeLinkClick(event: Pick<Event, 'preventDefault' | 'stopPropagation'>): void {
  event.preventDefault()
  event.stopPropagation()
}
