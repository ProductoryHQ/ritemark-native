/**
 * Sprint 118 R4 — a crash-safe WAV file on disk.
 *
 * The file is created exclusively as `<name>.wav.part` with a placeholder
 * header, PCM is appended in order by one serialized writer, and only a
 * validated file is renamed to `<name>.wav`. Memory stays bounded: nothing but
 * the chunk being written is held (R7). A `.part` left by a crash is rebuilt
 * from its size and validated before it is ever called complete (R6).
 */

import * as fsp from 'fs/promises';
import { durationFromDataBytes, isValidWavHeader, wavHeader } from './recordingPaths';
import { BYTES_PER_SAMPLE, MAX_DATA_BYTES, WAV_HEADER_BYTES } from './types';

export interface SinkFile {
  write(buffer: Buffer, position: number): Promise<void>;
  read(buffer: Buffer, position: number): Promise<number>;
  truncate(length: number): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

export interface SinkFs {
  /** `create` fails if the file exists; `update` opens an existing file. */
  open(filePath: string, mode: 'create' | 'update'): Promise<SinkFile>;
  size(filePath: string): Promise<number>;
  exists(filePath: string): Promise<boolean>;
  /**
   * Move `from` to `to` only if `to` does not exist; otherwise reject with an
   * `EEXIST` error. Never replaces a file (R4) — unlike a plain rename, which
   * silently overwrites on every platform.
   */
  renameNoReplace(from: string, to: string): Promise<void>;
  remove(filePath: string): Promise<void>;
  mkdirp(dirPath: string): Promise<void>;
}

const errorCode = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | null)?.code;

export const isNameTaken = (error: unknown): boolean => errorCode(error) === 'EEXIST';
export const isMissing = (error: unknown): boolean => errorCode(error) === 'ENOENT';

const nameTaken = (target: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`EEXIST: ${target} already exists`), { code: 'EEXIST' });

export const nodeSinkFs: SinkFs = {
  async open(filePath, mode) {
    const handle = await fsp.open(filePath, mode === 'create' ? 'wx' : 'r+');
    return {
      async write(buffer, position) {
        let offset = 0;
        while (offset < buffer.length) {
          const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset, position + offset);
          offset += bytesWritten;
        }
      },
      async read(buffer, position) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
        return bytesRead;
      },
      truncate: (length) => handle.truncate(length),
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  },
  size: async (filePath) => (await fsp.stat(filePath)).size,
  exists: async (filePath) => fsp.access(filePath).then(() => true, () => false),
  async renameNoReplace(from, to) {
    // A hard link is created atomically and fails with EEXIST if the name is
    // taken, so no file can appear between the check and the move.
    try {
      await fsp.link(from, to);
    } catch (error) {
      if (isNameTaken(error)) throw error;
      // No hard links on this volume (FAT/exFAT, some network shares): the
      // best available is a checked rename.
      if (await fsp.access(to).then(() => true, () => false)) throw nameTaken(to);
      await fsp.rename(from, to);
      return;
    }
    await fsp.unlink(from);
  },
  remove: (filePath) => fsp.rm(filePath, { force: true }),
  mkdirp: async (dirPath) => { await fsp.mkdir(dirPath, { recursive: true }); },
};

export class RecordingSinkError extends Error {
  constructor(readonly code: 'write-failed' | 'no-audio' | 'limit' | 'invalid' | 'name-taken', message: string) {
    super(message);
  }
}

export class WavRecordingSink {
  /** Bytes accepted into the write queue. */
  private _dataBytes = 0;
  /** Bytes confirmed on disk — what the user is told was recorded (R7). */
  private _writtenBytes = 0;
  private _queue: Promise<void> = Promise.resolve();
  private _failure: RecordingSinkError | null = null;
  private _closed = false;

  private constructor(
    private readonly fs: SinkFs,
    private readonly file: SinkFile,
    readonly partPath: string,
  ) {}

  /** Create `<partPath>` exclusively with a placeholder header. */
  static async create(fs: SinkFs, partPath: string): Promise<WavRecordingSink> {
    const file = await fs.open(partPath, 'create');
    try {
      await file.write(wavHeader(0), 0);
    } catch (error) {
      await file.close().catch(() => {});
      await fs.remove(partPath).catch(() => {});
      throw new RecordingSinkError('write-failed', `Could not start the recording file: ${String(error)}`);
    }
    return new WavRecordingSink(fs, file, partPath);
  }

  get dataBytes(): number {
    return this._dataBytes;
  }

  /** Seconds of audio confirmed on disk. */
  get durationSec(): number {
    return durationFromDataBytes(this._writtenBytes);
  }

  get failed(): boolean {
    return this._failure !== null;
  }

  /**
   * Append PCM. Writes are serialized, so chunks land in exactly the order the
   * controller accepted them. Resolves once this chunk is on disk.
   */
  append(pcm: Buffer): Promise<void> {
    if (this._closed) return Promise.reject(new RecordingSinkError('write-failed', 'The recording is closed'));
    if (pcm.length % BYTES_PER_SAMPLE !== 0) return Promise.reject(new RecordingSinkError('invalid', 'Odd PCM length'));
    if (this._dataBytes + pcm.length > MAX_DATA_BYTES) return Promise.reject(new RecordingSinkError('limit', 'Maximum recording length reached'));
    const position = WAV_HEADER_BYTES + this._dataBytes;
    // Reserve the bytes now so the next chunk queues behind this one.
    this._dataBytes += pcm.length;
    const task = this._queue.then(async () => {
      if (this._failure) throw this._failure;
      try {
        await this.file.write(pcm, position);
        this._writtenBytes += pcm.length;
      } catch (error) {
        this._failure = new RecordingSinkError('write-failed', String(error));
        throw this._failure;
      }
    });
    this._queue = task.catch(() => {});
    return task;
  }

  /** Wait for every accepted chunk, patch the header, and close (shutdown/detach). */
  async checkpoint(): Promise<void> {
    if (this._closed) return;
    await this._queue;
    this._closed = true;
    try {
      if (!this._failure) {
        await this.file.write(wavHeader(this._dataBytes), 0);
        await this.file.sync();
      }
    } finally {
      await this.file.close().catch(() => {});
    }
  }

  /**
   * Finish writing: every accepted chunk durably on disk, header patched, and
   * the file read back and validated. The `.part` is then a complete WAV that
   * the controller promotes with `promoteFile` (never overwriting).
   */
  async finalize(): Promise<{ dataBytes: number }> {
    await this.checkpoint();
    if (this._failure) throw this._failure;
    if (this._dataBytes === 0) {
      await this.fs.remove(this.partPath).catch(() => {});
      throw new RecordingSinkError('no-audio', 'No audio was captured');
    }
    await validateWavFile(this.fs, this.partPath, this._dataBytes);
    return { dataBytes: this._dataBytes };
  }

  /** Close and delete the `.part` (Cancel, or nothing was captured). */
  async discard(): Promise<void> {
    await this._queue;
    if (!this._closed) {
      this._closed = true;
      await this.file.close().catch(() => {});
    }
    await this.fs.remove(this.partPath);
  }
}

/** Read the header and size back; a promoted file is always this exact shape. */
export async function validateWavFile(fs: SinkFs, filePath: string, dataBytes: number): Promise<void> {
  const size = await fs.size(filePath);
  if (size !== WAV_HEADER_BYTES + dataBytes) {
    throw new RecordingSinkError('invalid', `Size ${size} does not match ${WAV_HEADER_BYTES + dataBytes}`);
  }
  const file = await fs.open(filePath, 'update');
  try {
    const header = Buffer.alloc(WAV_HEADER_BYTES);
    await file.read(header, 0);
    if (!isValidWavHeader(header, dataBytes)) throw new RecordingSinkError('invalid', 'The WAV header does not match the audio');
  } finally {
    await file.close().catch(() => {});
  }
}

/** How much whole-sample audio a `.part` of this size holds. */
export function recoverableDataBytes(size: number): number {
  const raw = size - WAV_HEADER_BYTES;
  return raw > 0 ? raw - (raw % BYTES_PER_SAMPLE) : 0;
}

/**
 * Rebuild an interrupted `.part` into a valid WAV in place (R6): the header is
 * recomputed from the size, a torn trailing byte is dropped, and the result is
 * validated. Throws `no-audio` for an empty part. The caller promotes it.
 */
export async function rebuildPartial(fs: SinkFs, partPath: string): Promise<{ dataBytes: number }> {
  const dataBytes = recoverableDataBytes(await fs.size(partPath));
  if (dataBytes === 0) throw new RecordingSinkError('no-audio', 'The interrupted recording holds no audio');
  const file = await fs.open(partPath, 'update');
  try {
    await file.truncate(WAV_HEADER_BYTES + dataBytes);
    await file.write(wavHeader(dataBytes), 0);
    await file.sync();
  } finally {
    await file.close().catch(() => {});
  }
  await validateWavFile(fs, partPath, dataBytes);
  return { dataBytes };
}

/**
 * Rename a validated `.part` to its final `.wav`. If that name was taken in
 * the meantime, the next free ` (n)` name is used — an existing file is never
 * overwritten (R4).
 */
export async function promoteFile(fs: SinkFs, partPath: string, preferredFinalPath: string): Promise<string> {
  for (let n = 1; n <= 999; n++) {
    const target = n === 1 ? preferredFinalPath : preferredFinalPath.replace(/( \(\d+\))?\.wav$/, ` (${n}).wav`);
    try {
      await fs.renameNoReplace(partPath, target);
      return target;
    } catch (error) {
      if (!isNameTaken(error)) throw error;
    }
  }
  throw new RecordingSinkError('name-taken', 'No free name for the recording');
}
