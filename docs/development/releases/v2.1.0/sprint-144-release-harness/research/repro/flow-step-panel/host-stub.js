// A stand-in for FlowEditorProvider (extensions/ritemark/src/flows/FlowEditorProvider.ts):
// acquireVsCodeApi, and the host's answers to the webview's messages, with delays you can set.
//
// Query parameters (all optional):
//   modelConfigDelay=ms  when flow:modelConfig is sent after 'ready' (host: at once, before flow:load)
//   loadDelay=ms         when flow:load is sent after 'ready' (host: at once)
//   selectAt=ms|none     click the step this long after flow:load (default 400)
//   node=<id>            the step to click (default llm-1)
//   modelsDelay=ms       how long the host takes to answer flow:getModels (default 150;
//                        the real host awaits modelCatalog.refresh() first)
//   replyFix=1           answer with the webview's own modelType. Without it the stub answers
//                        as the host does today: FlowEditorProvider.ts:164 passes
//                        `message.type || 'llm'`, i.e. 'flow:getModels', as the model type.
(function () {
  const params = new URLSearchParams(location.search);
  const num = (name, fallback) => {
    const value = params.get(name);
    return value === null || value === '' ? fallback : Number(value);
  };
  const t0 = (window.__harnessT0 = performance.now());
  const log = (window.__harnessLog = []);
  const note = (what, detail) => log.push({ t: Math.round(performance.now() - t0), what, detail });

  // The same lists the host builds in sendModelConfig(), with neutral sample IDs
  // (model IDs live only in src/ai/modelConfig.ts).
  const modelConfig = {
    openaiLLM: [
      { id: 'sample-openai-default', name: 'Sample OpenAI model' },
      { id: 'sample-openai-mini', name: 'Sample OpenAI mini' },
    ],
    openaiImage: [{ id: 'sample-openai-image', name: 'Sample OpenAI image' }],
    geminiLLM: [{ id: 'sample-gemini-default', name: 'Sample Gemini model' }],
    geminiImage: [{ id: 'sample-gemini-image', name: 'Sample Gemini image' }],
    defaults: {
      assistant: 'sample-openai-default',
      flowLLM: 'sample-openai-default',
      flowLLMGemini: 'sample-gemini-default',
      flowImage: 'sample-openai-image',
      flowImageGemini: 'sample-gemini-image',
    },
    byokProviderModels: {},
  };

  function toWebview(message, delay) {
    const send = () => {
      note('host→webview', message.type + (message.modelType ? ' modelType=' + message.modelType : ''));
      window.dispatchEvent(new MessageEvent('message', { data: message }));
    };
    if (delay > 0) setTimeout(send, delay);
    else send();
  }

  function selectStep() {
    const id = params.get('node') || 'llm-1';
    const el = document.querySelector('.react-flow__node[data-id="' + id + '"]');
    if (!el) {
      note('select', 'node ' + id + ' not found, retrying');
      setTimeout(selectStep, 100);
      return;
    }
    note('select', 'click ' + id);
    el.click();
  }

  function onWebviewMessage(message) {
    note('webview→host', message.type + (message.modelType ? ' modelType=' + message.modelType : ''));
    switch (message.type) {
      case 'ready': {
        toWebview({ type: 'flow:modelConfig', config: modelConfig }, num('modelConfigDelay', 0));
        toWebview({ type: 'flow:featureFlags', flags: { scheduledFlowRuns: false } }, 0);
        const loadDelay = num('loadDelay', 0);
        toWebview(
          { type: 'flow:load', flow: window.HARNESS_FLOW, workspacePath: '/tmp/harness', warnings: [], filename: 'weekly-brief-p4h1.flow.json' },
          loadDelay
        );
        toWebview({ type: 'flow:scheduleStatus', status: null }, loadDelay);
        const selectAt = params.get('selectAt');
        if (selectAt !== 'none') setTimeout(selectStep, loadDelay + num('selectAt', 400));
        return;
      }
      case 'flow:getModels': {
        // FlowEditorProvider.ts:164 — this.fetchModels(message.provider, message.type || 'llm', webview)
        const modelType = params.get('replyFix') === '1' ? message.modelType || 'llm' : message.type || 'llm';
        const isImage = modelType === 'image';
        const models = isImage
          ? message.provider === 'openai' ? modelConfig.openaiImage : modelConfig.geminiImage
          : message.provider === 'openai' ? modelConfig.openaiLLM : modelConfig.geminiLLM;
        toWebview({ type: 'flow:models', provider: message.provider, modelType, models }, num('modelsDelay', 150));
        return;
      }
      case 'flow:validate':
        toWebview({ type: 'flow:validation', warnings: [] }, 0);
        return;
      default:
        return;
    }
  }

  window.acquireVsCodeApi = function () {
    let state;
    return Object.freeze({
      postMessage: (message) => setTimeout(() => onWebviewMessage(message), 0),
      getState: () => state,
      setState: (next) => (state = next),
    });
  };
})();
