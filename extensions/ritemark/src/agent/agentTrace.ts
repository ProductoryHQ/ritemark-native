import { createRuntimeTrace } from '../utils/runtimeTrace';

const agentTrace = createRuntimeTrace('Ritemark Claude Trace', 'ritemark-claude-trace.log');

export const traceClaude = agentTrace.trace;
export const showClaudeTrace = agentTrace.show;
export const getClaudeTraceLogPath = agentTrace.getLogPath;
