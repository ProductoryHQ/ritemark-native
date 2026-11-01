/**
 * The control catalogue (Sprint 146, R2): one page of every shared control in every state, for the Experience lead to
 * approve each look once and for `scripts/qa/control-states.mjs` to test against those images.
 *
 * It opens only when Ritemark starts with `RITEMARK_CONTROL_CATALOGUE=1` (`src/views/ControlCataloguePanel.ts`):
 * no command, menu or palette entry shows it (decision 5). It needs no AI, folder or network, and sends the host
 * nothing beyond its ready message. Motion and the text caret are off on the page, so captures are stable.
 *
 * Each cell is a box with its own copy of the control, a focusable start mark at its corner (Tab reaches the control
 * from a known place) and room below for a menu or a tooltip. "Draw every cell again" mounts every cell afresh, so a
 * run starts from controls no one has touched.
 */

import { useEffect, useState } from 'react'
import { vscode } from '../../lib/vscode'
import { Button } from '../ui/button'
import { CATALOGUE, cellName, type CatalogueCell, type CatalogueRow, type CatalogueVariant } from './catalogueRows'
import './catalogue.css'

const BOX_WIDTH = 176
const BOX_HEIGHT = 72

function Cell({ row, variant, cell }: { row: CatalogueRow; variant: CatalogueVariant; cell: CatalogueCell }) {
  const name = cellName(row, variant, cell)
  return (
    <div className="rm-cat-cell">
      <div className="rm-cat-caption">{cell.label ?? cell.name ?? cell.state}</div>
      <div
        className="rm-cat-box"
        data-cell={name}
        data-state={cell.state}
        data-target-selector={cell.target ?? '[data-target]'}
        data-tabs={cell.tabs ?? 1}
        data-item={cell.item}
        data-capture={cell.capture}
        data-right-click={cell.rightClick ? '' : undefined}
        data-close-outside={cell.closeOutside ? '' : undefined}
        style={{ width: cell.width ?? BOX_WIDTH, height: cell.height ?? BOX_HEIGHT }}
      >
        <span className="rm-cat-start" tabIndex={0} data-start aria-label={`Start of ${name}`} />
        <div className="rm-cat-stage" style={cell.inset === undefined ? undefined : { left: cell.inset }}>{cell.render()}</div>
      </div>
    </div>
  )
}

export function ControlCatalogue() {
  const [round, setRound] = useState(0)

  useEffect(() => {
    document.body.classList.add('rm-catalogue-page')
    vscode.postMessage({ type: 'catalogue/ready' })
    return () => document.body.classList.remove('rm-catalogue-page')
  }, [])

  return (
    <main className="rm-catalogue" data-catalogue-round={round}>
      <header className="rm-cat-head">
        <div>
          <h1>Control catalogue</h1>
          <p>Every control in <code>components/ui/</code>, in every state it has. For the Experience lead's approval and <code>control-states.mjs</code>.</p>
        </div>
        <Button type="button" variant="outline" size="sm" data-redraw onClick={() => setRound((value) => value + 1)}>
          Draw every cell again
        </Button>
      </header>
      <div key={round}>
        {CATALOGUE.map((row) => (
          <section key={row.id} className="rm-cat-row" data-row={row.id}>
            <h2>{row.title}</h2>
            {row.variants.map((variant) => (
              <div key={variant.id} className="rm-cat-variant">
                <h3>{variant.label}</h3>
                <div className="rm-cat-cells">
                  {variant.cells.map((cell) => (
                    <Cell key={cellName(row, variant, cell)} row={row} variant={variant} cell={cell} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  )
}
