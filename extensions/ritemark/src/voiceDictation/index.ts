// Voice dictation exports
export { DictationController } from './controller';
export { transcribeWav, getWhisperBinaryPath, getModelPath, probeWhisper } from './whisperCpp';
export { dictationProblemFor } from './controller';
export type { DictationEngineProblem } from './controller';
export { ensureModelDownloaded, isModelDownloaded } from './modelManager';
