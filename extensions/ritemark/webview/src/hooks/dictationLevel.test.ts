/**
 * Sprint 129 (Windows test, bugs B and C) — the live muted-microphone check.
 * Run: npx tsx webview/src/hooks/dictationLevel.test.ts
 */
import assert from 'node:assert/strict'
import { MUTED_PEAK, MUTED_SECONDS, reachesLiveLevel } from './dictationLevel'

const RATE = 48000

/** The measured noise floor of Jarmo's hardware-muted Realtek mic (Windows re-test 1). */
function mutedRealtek(seconds: number): Float32Array {
  const samples = new Float32Array(RATE * seconds)
  for (let i = 0; i < samples.length; i++) {
    if (i % 125 === 0) continue // 0.8% exact zeros: 99.2% of samples are non-zero
    const magnitude = 3.9e-11 + Math.random() * (2.6e-5 - 3.9e-11)
    samples[i] = Math.random() < 0.5 ? -magnitude : magnitude
  }
  samples[1] = 2.6e-5 // its measured maximum |x|
  samples[2] = 3.9e-11 // and minimum non-zero
  return samples
}

function tone(seconds: number, peak: number): Float32Array {
  const samples = new Float32Array(RATE * seconds)
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 20) * peak
  return samples
}

const muted = mutedRealtek(MUTED_SECONDS)
assert.ok(muted.filter(s => s !== 0).length / muted.length > 0.99, 'the test signal is 99% non-zero, like the real one')
assert.equal(reachesLiveLevel(muted), false, 'a hardware-muted mic stops dictation (an exact-zero check never did)')
assert.equal(reachesLiveLevel(new Float32Array(RATE * MUTED_SECONDS)), false, 'digital zeros')

// Quiet real speech is far above the threshold.
assert.equal(reachesLiveLevel(tone(MUTED_SECONDS, 10 ** (-42 / 20))), true, 'the quietest FLEURS first 3 s (-42 dBFS peak)')
assert.equal(reachesLiveLevel(tone(MUTED_SECONDS, 10 ** (-60 / 20))), true, 'room noise at -60 dBFS keeps recording')
assert.equal(reachesLiveLevel(tone(MUTED_SECONDS, MUTED_PEAK * 0.99)), false, 'just under -80 dBFS')

console.log('dictationLevel.test.ts: all tests passed')
