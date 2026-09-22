/**
 * Sprint 118 R4/R6/R7 — the WAV file on disk.
 *
 * What the user cannot check for themselves: chunks land in order even when
 * writes finish out of order, a failed write is never reported as saved, and
 * a `.part` torn by a crash is rebuilt into a valid file before it is used.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isValidWavHeader, wavHeader } from './recordingPaths';
import { MAX_DATA_BYTES, WAV_HEADER_BYTES } from './types';
import {
  RecordingSinkError,
  WavRecordingSink,
  nodeSinkFs,
  promoteFile,
  rebuildPartial,
  recoverableDataBytes,
  validateWavFile,
  type SinkFs,
} from './WavRecordingSink';

const pcm = (samples: number, value: number) => Buffer.alloc(samples * 2, value);

/** nodeSinkFs whose writes fail from the `failFrom`-th write on, and may be slowed. */
function flakyFs(opts: { failFrom?: number; delayFirstMs?: number }): SinkFs {
  let writes = 0;
  return {
    ...nodeSinkFs,
    async open(filePath, mode) {
      const file = await nodeSinkFs.open(filePath, mode);
      return {
        ...file,
        async write(buffer, position) {
          writes++;
          if (opts.failFrom !== undefined && writes >= opts.failFrom) throw new Error('ENOSPC: no space left on device');
          if (writes === 2 && opts.delayFirstMs) await new Promise((r) => setTimeout(r, opts.delayFirstMs));
          return file.write(buffer, position);
        },
      };
    },
  };
}

async function sinkCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof RecordingSinkError ? error.code : `other: ${String(error)}`;
  }
}

async function run(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-sink-'));
  try {
    // --- create: exclusive, with a placeholder header
    const a = path.join(dir, 'a.wav.part');
    const sink = await WavRecordingSink.create(nodeSinkFs, a);
    assert.deepEqual(fs.readFileSync(a), wavHeader(0));
    await assert.rejects(WavRecordingSink.create(nodeSinkFs, a), /EEXIST/, 'an existing file is never reused');

    // --- appends land in order, even when the first write is slow
    const slow = path.join(dir, 'slow.wav.part');
    const ordered = await WavRecordingSink.create(flakyFs({ delayFirstMs: 40 }), slow);
    const done = Promise.all([ordered.append(pcm(100, 1)), ordered.append(pcm(100, 2)), ordered.append(pcm(100, 3))]);
    assert.equal(ordered.dataBytes, 600, 'accepted bytes count immediately');
    assert.equal(ordered.durationSec, 0, 'duration counts only bytes on disk');
    await done;
    assert.equal(await ordered.finalize().then((r) => r.dataBytes), 600);
    const body = fs.readFileSync(slow).subarray(WAV_HEADER_BYTES);
    assert.deepEqual([body[0], body[200], body[400], body[599]], [1, 2, 3, 3], 'chunks written in accepted order');

    // --- finalize: header patched, validated, still a .part (the controller promotes)
    await sink.append(pcm(16_000, 7));
    assert.equal(sink.durationSec, 1);
    assert.deepEqual(await sink.finalize(), { dataBytes: 32_000 });
    assert.ok(fs.existsSync(a));
    assert.ok(isValidWavHeader(fs.readFileSync(a).subarray(0, WAV_HEADER_BYTES), 32_000));
    assert.equal(await sinkCode(sink.append(pcm(1, 1))), 'write-failed', 'a closed file takes no more audio');

    // --- rejected input
    const odd = await WavRecordingSink.create(nodeSinkFs, path.join(dir, 'odd.wav.part'));
    assert.equal(await sinkCode(odd.append(Buffer.alloc(3))), 'invalid', 'half a sample is rejected');
    (odd as unknown as { _dataBytes: number })._dataBytes = MAX_DATA_BYTES - 2;
    assert.equal(await sinkCode(odd.append(pcm(2, 0))), 'limit', 'nothing past four hours');
    await odd.discard();
    assert.ok(!fs.existsSync(path.join(dir, 'odd.wav.part')), 'discard removes the part');

    // --- nothing captured: no file is left behind
    const empty = path.join(dir, 'empty.wav.part');
    const none = await WavRecordingSink.create(nodeSinkFs, empty);
    assert.equal(await sinkCode(none.finalize()), 'no-audio');
    assert.ok(!fs.existsSync(empty));

    // --- a failed write is never counted as saved
    const failing = path.join(dir, 'failing.wav.part');
    const broken = await WavRecordingSink.create(flakyFs({ failFrom: 3 }), failing);
    await broken.append(pcm(100, 1));
    assert.equal(await sinkCode(broken.append(pcm(100, 2))), 'write-failed');
    assert.ok(broken.failed);
    assert.equal(await sinkCode(broken.append(pcm(100, 3))), 'write-failed', 'every later chunk fails too');
    assert.equal(broken.durationSec, 200 / 32_000, 'only the written chunk counts');
    assert.equal(await sinkCode(broken.finalize()), 'write-failed', 'a failed recording is never called complete');
    // What did reach the disk is still recoverable.
    assert.deepEqual(await rebuildPartial(nodeSinkFs, failing), { dataBytes: 200 });

    // --- checkpoint (shutdown/detach): valid header, file left as .part
    const cp = path.join(dir, 'cp.wav.part');
    const checkpointed = await WavRecordingSink.create(nodeSinkFs, cp);
    await checkpointed.append(pcm(500, 4));
    await checkpointed.checkpoint();
    await validateWavFile(nodeSinkFs, cp, 1000);

    // --- a crash-torn part: placeholder header and half a sample at the end
    const torn = path.join(dir, 'torn.wav.part');
    fs.writeFileSync(torn, Buffer.concat([wavHeader(0), pcm(300, 5), Buffer.from([9])]));
    assert.equal(recoverableDataBytes(fs.statSync(torn).size), 600);
    assert.deepEqual(await rebuildPartial(nodeSinkFs, torn), { dataBytes: 600 });
    assert.equal(fs.statSync(torn).size, WAV_HEADER_BYTES + 600, 'the torn byte is dropped');
    await validateWavFile(nodeSinkFs, torn, 600);

    const headerOnly = path.join(dir, 'header.wav.part');
    fs.writeFileSync(headerOnly, wavHeader(0));
    assert.equal(await sinkCode(rebuildPartial(nodeSinkFs, headerOnly)), 'no-audio');
    assert.equal(recoverableDataBytes(10), 0, 'shorter than a header');

    // --- validation catches a mismatched file
    assert.equal(await sinkCode(validateWavFile(nodeSinkFs, torn, 602)), 'invalid');
    const lying = path.join(dir, 'lying.wav');
    fs.writeFileSync(lying, Buffer.concat([wavHeader(10), pcm(300, 5)]));
    assert.equal(await sinkCode(validateWavFile(nodeSinkFs, lying, 600)), 'invalid');

    // --- promote never overwrites
    const final = path.join(dir, 'Recording.wav');
    assert.equal(await promoteFile(nodeSinkFs, cp, final), final);
    assert.ok(!fs.existsSync(cp));
    assert.equal(await promoteFile(nodeSinkFs, torn, final), path.join(dir, 'Recording (2).wav'));
    assert.equal(await promoteFile(nodeSinkFs, failing, final), path.join(dir, 'Recording (3).wav'));
    assert.equal(fs.statSync(final).size, WAV_HEADER_BYTES + 1000, 'the first file is untouched');

    console.log('WavRecordingSink.test.ts: all tests passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
