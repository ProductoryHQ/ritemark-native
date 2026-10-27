/**
 * An Image step's card names the model a run uses, the same way its panel does (Sprint 144, P4). The card used to
 * name one fixed model per provider ("GPT Image 1.5", "Nano Banana Pro") whatever the step had saved, so a step
 * saved on `dall-e-2` read "GPT Image 1.5" on the canvas and "Unavailable: dall-e-2" in its panel, while a run sends
 * `dall-e-2` as it is (`ImageNodeExecutor`), which OpenAI removed from its API on 12 May 2026.
 *
 * Renders the card to markup with the host's config and checks its Model row against the panel's picker label.
 *
 * Run: npx tsx webview/src/components/flows/nodes/ImageNode.test.ts
 */
import assert from 'node:assert/strict'

Object.assign(globalThis, {
  window: { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1440 },
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})

// React Flow's provider uses layout effects, which a server render only warns about; keep the output to failures.
const consoleError = console.error
console.error = (...args: unknown[]) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) consoleError(...args) }

const React = await import('react')
// tsx compiles the card's JSX to `React.createElement` here
;(globalThis as unknown as { React: unknown }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { ReactFlowProvider } = await import('@xyflow/react')
const config = await import('../../../config/modelConfig')
const { ImageNode } = await import('./ImageNode')

config.setModelConfig({
  ...config.getModelConfig(),
  openaiImage: [{ id: 'gpt-image-2', name: 'GPT Image 2' }],
  geminiImage: [{ id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image' }],
  defaults: { ...config.getModelConfig().defaults, flowImage: 'gpt-image-2', flowImageGemini: 'gemini-3.1-flash-image' },
})

type Provider = 'openai' | 'gemini'
function cardModel(provider: Provider, model: string): string {
  const data = { label: 'Picture', provider, model, prompt: 'A watercolour', inputImages: [], action: 'auto', inputFidelity: 'low', size: '1024x1024', quality: 'standard', style: 'natural' }
  const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ImageNode as never, { id: 'step-1', data })))
  const text = html.replace(/<[^>]+>/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean)
  const at = text.indexOf('Model')
  assert.ok(at >= 0, `the card has a Model row (got: ${text.join(' | ')})`)
  return text[at + 1]
}
function panelModel(provider: Provider, model: string): string {
  const options = config.modelOptionsWithPersistedSelection(config.offeredImageModels(provider), model || undefined)
  const shown = model || config.getDefaultImageModel(provider)
  return options.models.find((m) => m.id === shown)?.name ?? shown
}

// A step saved on a model the list no longer offers: the card says so, as the panel does.
assert.equal(cardModel('openai', 'dall-e-2'), 'Unavailable: dall-e-2')
assert.equal(cardModel('openai', 'dall-e-2'), panelModel('openai', 'dall-e-2'))

// No model saved: the provider's default, by its name, on both.
assert.equal(cardModel('openai', ''), 'GPT Image 2')
assert.equal(cardModel('openai', ''), panelModel('openai', ''))

// Gemini: the step's own model, not a fixed "Nano Banana Pro".
assert.equal(cardModel('gemini', 'gemini-3.1-flash-image'), 'Gemini 3.1 Flash Image')
assert.equal(cardModel('gemini', 'gemini-3.1-flash-image'), panelModel('gemini', 'gemini-3.1-flash-image'))

// Once the host answers with the provider's own list, the card follows it, as the panel's picker does.
assert.equal(cardModel('openai', 'gpt-image-1-mini'), 'Unavailable: gpt-image-1-mini')
config.setFetchedImageModels('openai', [{ id: 'gpt-image-2', name: 'GPT Image 2' }, { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini' }])
assert.equal(cardModel('openai', 'gpt-image-1-mini'), 'GPT Image 1 Mini')
assert.equal(cardModel('openai', 'gpt-image-1-mini'), panelModel('openai', 'gpt-image-1-mini'))
// An empty answer (an error) keeps the list there was.
config.setFetchedImageModels('openai', [])
assert.equal(cardModel('openai', 'gpt-image-1-mini'), 'GPT Image 1 Mini')

// The rule itself: unknown is not unavailable while there is no list yet.
assert.deepEqual(config.imageStepModel('dall-e-2', 'gpt-image-2', []), { id: 'dall-e-2', label: 'dall-e-2', unavailable: false })
assert.deepEqual(config.imageStepModel(undefined, 'gpt-image-2', [{ id: 'other', name: 'Other' }]), { id: 'gpt-image-2', label: 'gpt-image-2', unavailable: false })

console.log('ImageNode.test.ts passed')
