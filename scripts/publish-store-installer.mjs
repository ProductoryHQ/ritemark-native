#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const DEFAULT_BUCKET = 'ritemark-downloads-prod';
const DEFAULT_BASE_URL = 'https://getritemark.com';
const INSTALLER_NAME = 'Ritemark-Setup.exe';
const INSTALLER_CONTENT_TYPE = 'application/vnd.microsoft.portable-executable';

class UsageError extends Error {}

function usage() {
  return `Usage:
  npm run store-hosting -- plan --version X.Y.Z --file PATH --size BYTES --sha256 HEX
  npm run store-hosting -- publish --version X.Y.Z --file PATH --size BYTES --sha256 HEX --confirm-key KEY
  npm run store-hosting -- verify --version X.Y.Z --size BYTES --sha256 HEX

Commands:
  plan       Verify the local file and confirm the public destination is unused.
  publish    Repeat all checks, atomically upload only if the R2 key does not exist,
             then stream a fresh anonymous download and verify its headers and SHA-256.
  verify     Verify the already-published public object without credentials or temp files.

Required environment for publish only:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY

Optional:
  --bucket NAME       Default: ${DEFAULT_BUCKET}
  --base-url URL      Default: ${DEFAULT_BASE_URL}

Secrets must be supplied through the environment. Never put them in arguments, source,
logs, evidence files, or Git.`;
}

function takeValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new UsageError(`${option} requires a value`);
  }
  return value;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    return { help: true };
  }
  if (!['plan', 'publish', 'verify'].includes(command)) {
    throw new UsageError(`unknown command: ${command}`);
  }

  const options = {
    command,
    bucket: DEFAULT_BUCKET,
    baseUrl: DEFAULT_BASE_URL,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (!['--version', '--file', '--size', '--sha256', '--confirm-key', '--bucket', '--base-url'].includes(option)) {
      throw new UsageError(`unknown option: ${option}`);
    }
    const value = takeValue(rest, index, option);
    index += 1;
    if (option === '--version') options.version = value;
    else if (option === '--file') options.file = value;
    else if (option === '--size') options.size = Number(value);
    else if (option === '--sha256') options.sha256 = value.toLowerCase();
    else if (option === '--confirm-key') options.confirmKey = value;
    else if (option === '--bucket') options.bucket = value;
    else if (option === '--base-url') options.baseUrl = value;
  }

  if (!options.version) throw new UsageError('--version is required');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.version)) {
    throw new UsageError('--version must be a release version such as 1.10.0 or 1.10.0-candidate-2');
  }
  if (!Number.isSafeInteger(options.size) || options.size <= 0) {
    throw new UsageError('--size must be a positive integer');
  }
  if (!/^[0-9a-f]{64}$/.test(options.sha256 ?? '')) {
    throw new UsageError('--sha256 must be exactly 64 hexadecimal characters');
  }
  if (command !== 'verify' && !options.file) {
    throw new UsageError('--file is required for plan and publish');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(options.bucket)) {
    throw new UsageError('--bucket is not a valid bucket name');
  }

  const parsedBaseUrl = new URL(options.baseUrl);
  const localTestHost = ['127.0.0.1', 'localhost'].includes(parsedBaseUrl.hostname);
  if (parsedBaseUrl.protocol !== 'https:' && !localTestHost) {
    throw new UsageError('--base-url must use HTTPS');
  }
  options.baseUrl = parsedBaseUrl.origin;
  options.key = installerKey(options.version);
  options.publicUrl = new URL(options.key, `${options.baseUrl}/`).href;

  if (command === 'publish' && options.confirmKey !== options.key) {
    throw new UsageError(`publish requires --confirm-key ${options.key}`);
  }
  return options;
}

export function installerKey(version) {
  return `windows/v${version}/${INSTALLER_NAME}`;
}

export async function fileIdentity(filePath) {
  const details = await stat(filePath);
  if (!details.isFile()) throw new Error(`not a regular file: ${filePath}`);

  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return { size: details.size, sha256: hash.digest('hex') };
}

export async function assertLocalIdentity(options) {
  const actual = await fileIdentity(options.file);
  if (actual.size !== options.size) {
    throw new Error(`local size mismatch: expected ${options.size}, got ${actual.size}`);
  }
  if (actual.sha256 !== options.sha256) {
    throw new Error(`local SHA-256 mismatch: expected ${options.sha256}, got ${actual.sha256}`);
  }
  return actual;
}

export async function assertPublicKeyUnused(publicUrl, fetchImpl = fetch) {
  const checkUrl = new URL(publicUrl);
  checkUrl.searchParams.set('preflight', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetchImpl(checkUrl, {
    method: 'HEAD',
    redirect: 'manual',
    headers: { 'cache-control': 'no-cache' },
  });
  if (response.status !== 404) {
    throw new Error(`public destination must return 404 before upload; got HTTP ${response.status}`);
  }
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for publish`);
  return value;
}

export function createR2Client() {
  const accountId = requiredEnvironment('R2_ACCOUNT_ID');
  if (!/^[0-9a-f]{32}$/i.test(accountId)) {
    throw new Error('R2_ACCOUNT_ID must be the 32-character Cloudflare account ID');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnvironment('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnvironment('R2_SECRET_ACCESS_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 3,
  });
}

function isMissingObject(error) {
  return error?.$metadata?.httpStatusCode === 404 ||
    error?.name === 'NotFound' ||
    error?.name === 'NoSuchKey';
}

export async function assertR2KeyUnused(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isMissingObject(error)) return;
    throw error;
  }
  throw new Error(`R2 key already exists and will not be overwritten: s3://${bucket}/${key}`);
}

export async function putNewObject(client, options) {
  try {
    return await client.send(new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: createReadStream(options.file),
      ContentLength: options.size,
      ContentType: INSTALLER_CONTENT_TYPE,
      ContentDisposition: `attachment; filename="${INSTALLER_NAME}"`,
      CacheControl: 'public, max-age=31536000, immutable',
      IfNoneMatch: '*',
      Metadata: {
        sha256: options.sha256,
        version: options.version,
      },
    }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 412 || error?.name === 'PreconditionFailed') {
      throw new Error(`atomic no-overwrite check rejected the upload because ${options.key} already exists`);
    }
    throw error;
  }
}

export async function verifyPublicObject(options, fetchImpl = fetch) {
  const response = await fetchImpl(options.publicUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      accept: INSTALLER_CONTENT_TYPE,
      'cache-control': 'no-cache',
    },
  });
  if (response.status !== 200) throw new Error(`expected HTTP 200, got ${response.status}`);
  if (response.headers.has('location')) throw new Error('public response contains a Location header');
  if (response.headers.has('set-cookie')) throw new Error('public response contains a Set-Cookie header');

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== INSTALLER_CONTENT_TYPE) {
    throw new Error(`unexpected Content-Type: ${contentType ?? '(missing)'}`);
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength !== options.size) {
    throw new Error(`Content-Length mismatch: expected ${options.size}, got ${response.headers.get('content-length') ?? '(missing)'}`);
  }
  if (!response.body) throw new Error('public response body is missing');

  const hash = createHash('sha256');
  let downloaded = 0;
  for await (const chunk of response.body) {
    downloaded += chunk.byteLength;
    hash.update(chunk);
  }
  const sha256 = hash.digest('hex');
  if (downloaded !== options.size) {
    throw new Error(`downloaded size mismatch: expected ${options.size}, got ${downloaded}`);
  }
  if (sha256 !== options.sha256) {
    throw new Error(`fresh-download SHA-256 mismatch: expected ${options.sha256}, got ${sha256}`);
  }

  return {
    checkedAt: new Date().toISOString(),
    url: options.publicUrl,
    status: response.status,
    redirects: 0,
    contentType,
    contentLength,
    cacheControl: response.headers.get('cache-control'),
    contentDisposition: response.headers.get('content-disposition'),
    acceptRanges: response.headers.get('accept-ranges'),
    location: null,
    setCookie: null,
    sha256,
  };
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function plan(options) {
  console.log(`Hashing local installer (${options.size} bytes)...`);
  const identity = await assertLocalIdentity(options);
  console.log(`Checking that ${options.publicUrl} is unused...`);
  await assertPublicKeyUnused(options.publicUrl);
  print({
    action: 'plan',
    bucket: options.bucket,
    key: options.key,
    publicUrl: options.publicUrl,
    localFile: options.file,
    ...identity,
    destinationStatus: 404,
    safeToAttemptConditionalUpload: true,
  });
}

async function publish(options) {
  console.log(`Rechecking local installer (${options.size} bytes)...`);
  await assertLocalIdentity(options);
  console.log(`Checking public destination: ${options.publicUrl}`);
  await assertPublicKeyUnused(options.publicUrl);
  const client = createR2Client();
  console.log(`Checking authenticated R2 key: s3://${options.bucket}/${options.key}`);
  await assertR2KeyUnused(client, options.bucket, options.key);
  console.log(`Uploading ${options.size} bytes; this can take several minutes...`);
  const result = await putNewObject(client, options);
  console.log(`Uploaded new immutable candidate key: s3://${options.bucket}/${options.key}`);
  console.log(`R2 ETag: ${result.ETag ?? '(not returned)'}`);
  console.log('The key now exists. Never retry with different bytes or overwrite it.');
  console.log('Streaming a fresh anonymous download for header, size, and SHA-256 verification...');
  const evidence = await verifyPublicObject(options);
  print(evidence);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.command === 'plan') await plan(options);
  else if (options.command === 'publish') await publish(options);
  else print(await verifyPublicObject(options));
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  main().catch(error => {
    const prefix = error instanceof UsageError ? 'USAGE' : 'ERROR';
    console.error(`${prefix}: ${error.message}`);
    if (error instanceof UsageError) console.error(`\n${usage()}`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  });
}
