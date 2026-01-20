// Voice dictation exports
export { DictationController } from './controller';
export { transcribeAudio, getWhisperBinaryPath, getModelPath } from './whisperCpp';
export { ensureModelDownloaded, isModelDownloaded } from './modelManager';
