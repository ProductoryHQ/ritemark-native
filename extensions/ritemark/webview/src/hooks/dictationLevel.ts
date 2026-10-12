/**
 * Sprint 129 (Windows test, bugs B and C): the live check that notices a muted
 * or blocked microphone while recording.
 *
 * A muted microphone is not exact zeros. Jarmo's hardware-muted Realtek mic gave
 * 99.2% non-zero samples, peak 2.6e-5 (about -92 dBFS). A live microphone always
 * reaches MUTED_PEAK within seconds: the quietest of 100 FLEURS Estonian clips
 * peaks at -42 dBFS in its first 3 s, about 40 dB above it.
 */

/** -80 dBFS. */
export const MUTED_PEAK = 1e-4

/** This long below MUTED_PEAK stops the recording ("Ritemark Heard Nothing"). */
export const MUTED_SECONDS = 3

/** Whether any sample reaches the level a microphone that is on always has. */
export function reachesLiveLevel(samples: ArrayLike<number>): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= MUTED_PEAK) return true
  }
  return false
}
