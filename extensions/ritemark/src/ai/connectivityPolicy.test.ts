/**
 * GH #193 — offline verdict hysteresis + multi-probe race semantics.
 */
import assert from 'node:assert/strict';
import { anyProbeSucceeds, nextConnectivityState, FAILURES_TO_GO_OFFLINE } from './connectivityPolicy';

async function run(): Promise<void> {
  // ── nextConnectivityState: hysteresis ──

  // Online, one failed round: STAYS online, asks for a quick confirm round.
  // This is the flap killer — the old code flipped offline right here.
  assert.deepEqual(nextConnectivityState(true, 0, false), {
    isOnline: true, failStreak: 1, scheduleQuickRecheck: true,
  });

  // Second consecutive failed round: now genuinely offline.
  assert.deepEqual(nextConnectivityState(true, 1, false), {
    isOnline: false, failStreak: 2, scheduleQuickRecheck: false,
  });

  // Deep in an offline streak: stays offline without quick-recheck churn.
  assert.deepEqual(nextConnectivityState(false, 5, false), {
    isOnline: false, failStreak: 6, scheduleQuickRecheck: false,
  });

  // A single success recovers immediately from any streak depth.
  assert.deepEqual(nextConnectivityState(false, 7, true), {
    isOnline: true, failStreak: 0, scheduleQuickRecheck: false,
  });
  assert.deepEqual(nextConnectivityState(true, 1, true), {
    isOnline: true, failStreak: 0, scheduleQuickRecheck: false,
  });

  assert.equal(FAILURES_TO_GO_OFFLINE, 2, 'offline needs two consecutive failed rounds');

  // ── anyProbeSucceeds: race semantics ──

  const later = (ms: number, value: boolean) =>
    new Promise<boolean>((resolve) => setTimeout(() => resolve(value), ms));

  // First success wins without waiting for slower probes.
  const start = Date.now();
  assert.equal(await anyProbeSucceeds([later(5, true), later(200, false), later(300, true)]), true);
  assert.ok(Date.now() - start < 150, 'must not wait for the slow probes');

  // All fail → false.
  assert.equal(await anyProbeSucceeds([later(5, false), later(10, false)]), false);

  // A slow lone success among fast failures still means online.
  assert.equal(await anyProbeSucceeds([later(5, false), later(20, true)]), true);

  // Empty probe list → offline (defensive; never happens with the static endpoint list).
  assert.equal(await anyProbeSucceeds([]), false);

  console.log('connectivityPolicy.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
