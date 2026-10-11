// Voice dictation exports
export { DictationController } from './controller';
export { transcribeWav, getWhisperBinaryPath, getModelPath, probeWhisper, whisperProblemMessage } from './whisperCpp';
export { ensureModelDownloaded, isModelDownloaded } from './modelManager';
