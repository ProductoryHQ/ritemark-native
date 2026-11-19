/**
 * Sprint 157 (prototype frame 4): a box's icon chosen from the grid of 24, with No icon under it. The menu's items,
 * shared by the old layout's picker (`SlideCanvas`) and, since Sprint 161's PR 3, the block slide's (`SlideIconPicker`).
 * Sprint 169 PR 2 (#867): each choice is drawn as the slide draws it (`SlideIconGlyph`, the full set), not by the
 * chrome's `Icon`; No icon's cross is the menu's own, so it stays the chrome's.
 */
import { DropdownMenuItem, DropdownMenuSeparator } from '../../ui/dropdown-menu'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { SLIDE_ICONS } from './iconSet'
import { SlideIconGlyph } from './SlideIconGlyph'

export function IconGridItems({ current, onPick }: { current: string | null; onPick: (name: string | null) => void }) {
  return (
    <>
      <div className="deck-icon-grid" role="group" aria-label="Icons">
        {SLIDE_ICONS.map(icon => (
          <Tooltip key={icon.name} label={icon.label}>
            <DropdownMenuItem
              aria-label={icon.label}
              data-state={icon.name === current ? 'on' : undefined}
              className="deck-icon-choice"
              onSelect={() => onPick(icon.name)}
            >
              <SlideIconGlyph name={icon.phosphor} size={16} />
            </DropdownMenuItem>
          </Tooltip>
        ))}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!current} onSelect={() => onPick(null)}>
        <Icon name="x" size={14} tone="inherit" />
        No icon
      </DropdownMenuItem>
    </>
  )
}
