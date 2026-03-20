import { createRuntimeTrace } from '../utils/runtimeTrace';

const codexTrace = createRuntimeTrace('Ritemark Codex Trace', 'ritemark-codex-trace.log');

export const traceCodex = codexTrace.trace;
export const showCodexTrace = codexTrace.show;
export const getCodexTraceLogPath = codexTrace.getLogPath;
