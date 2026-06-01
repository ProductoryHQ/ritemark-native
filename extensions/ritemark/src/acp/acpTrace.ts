import { createRuntimeTrace } from '../utils/runtimeTrace';

const acpTrace = createRuntimeTrace('Ritemark ACP Trace', 'ritemark-acp-trace.log');

export const traceAcp = acpTrace.trace;
export const showAcpTrace = acpTrace.show;
export const getAcpTraceLogPath = acpTrace.getLogPath;
