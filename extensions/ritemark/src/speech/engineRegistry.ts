/**
 * Sprint 108 R2/R13 — engine registry.
 *
 * Mirrors `runtime/RuntimeRegistry` in spirit: register concrete engines once,
 * then ask which are usable *here*. Platform filtering lives here so the UI
 * never has to special-case Windows — it renders whatever the registry reports,
 * including the honest "not available on Windows yet" state.
 */

import { getCurrentPlatform } from '../utils/platform';
import type { Platform } from '../utils/platform';
import type { EngineReadiness, TranscriptionEngine } from './TranscriptionEngine';
import { TranscriptionError } from './types';

export interface EngineStatus {
  id: string;
  label: string;
  isLocal: boolean;
  diarization: boolean;
  /** False when the engine cannot run on this OS at all. */
  supportedOnPlatform: boolean;
  readiness: EngineReadiness;
}

export class EngineRegistry {
  private readonly engines = new Map<string, TranscriptionEngine>();

  constructor(private readonly platform: Platform = getCurrentPlatform()) {}

  register(engine: TranscriptionEngine): void {
    this.engines.set(engine.id, engine);
  }

  /** Every registered engine, including ones this OS cannot run. */
  all(): TranscriptionEngine[] {
    return [...this.engines.values()];
  }

  /** Engines that could run here — readiness (key, model) is a separate question. */
  supported(): TranscriptionEngine[] {
    return this.all().filter((engine) => engine.platforms.includes(this.platform));
  }

  get(id: string): TranscriptionEngine {
    const engine = this.engines.get(id);
    if (!engine) {
      throw new TranscriptionError('engine-unavailable', 'That transcription engine is not available.');
    }
    if (!engine.platforms.includes(this.platform)) {
      throw new TranscriptionError(
        'engine-unavailable',
        `${engine.label} is not available on this platform yet.`,
      );
    }
    return engine;
  }

  /**
   * What the engine cards render. Unsupported engines are included rather than
   * hidden — on Windows the user should be told why on-device is missing (#133),
   * not left with a control that silently isn't there.
   */
  async statuses(): Promise<EngineStatus[]> {
    return Promise.all(
      this.all().map(async (engine) => {
        const supportedOnPlatform = engine.platforms.includes(this.platform);
        const readiness: EngineReadiness = supportedOnPlatform
          ? await engine.isReady()
          : {
              ready: false,
              reason: `Not available on ${this.platform === 'win32' ? 'Windows' : this.platform} yet.`,
              action: 'none',
            };

        return {
          id: engine.id,
          label: engine.label,
          isLocal: engine.isLocal,
          diarization: engine.capabilities.diarization,
          supportedOnPlatform,
          readiness,
        };
      }),
    );
  }

  /**
   * The engine to preselect: the last one the user chose if it is ready,
   * otherwise a ready local engine (privacy by default, D6), otherwise any
   * ready engine.
   */
  async preferred(lastUsedId?: string): Promise<TranscriptionEngine | null> {
    const candidates = this.supported();

    const readiness = new Map<string, EngineReadiness>();
    await Promise.all(
      candidates.map(async (engine) => {
        readiness.set(engine.id, await engine.isReady());
      }),
    );
    const isReady = (engine: TranscriptionEngine): boolean => readiness.get(engine.id)?.ready === true;

    const last = lastUsedId ? candidates.find((engine) => engine.id === lastUsedId) : undefined;
    if (last && isReady(last)) return last;

    return candidates.find((engine) => engine.isLocal && isReady(engine)) ?? candidates.find(isReady) ?? null;
  }
}
