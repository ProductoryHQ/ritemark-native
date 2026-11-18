/**
 * Pictures with ChatGPT: the request built for the runtime, the picture saved into `images/` under a name that never
 * replaces another, Cancel, the not-signed-in path, the picture to change, and the one-shot turn that carries it.
 *
 * Run: npx tsx src/pictures/chatgptPicture.test.ts
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { makeTempDir } from '../testing/tempDir';
import { SIGN_IN_ATTENTION_MS, signInAttentionOf, signInAttentionShows } from '../views/agentSidebarProtocol';
import type { AgentRuntime, RuntimeSession, RuntimeSessionConfig, RuntimeTurnConfig } from '../runtime/AgentRuntime';
import { ONE_SHOT_CANCELLED, runOneShotTurnResult, type OneShotTurnResult } from '../runtime/oneShotTurn';
import {
  PICTURE_PROBLEMS,
  PICTURE_SYSTEM_PROMPT,
  decodePictureRequest,
  generatedImagesFolder,
  makePicture,
  pictureBaseName,
  pictureKindOf,
  picturePrompt,
  readMadePicture,
  type PictureMakerDeps,
  type PictureRequest,
  type PictureTurn,
} from './chatgptPicture';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('a picture')]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a photo')]);

function project(): { root: string; folder: string } {
  const root = makeTempDir('rm-chatgpt-pictures-');
  const folder = path.join(root, 'decks');
  fs.mkdirSync(folder, { recursive: true });
  return { root, folder };
}

function deps(over: Partial<PictureMakerDeps> & { turns?: PictureTurn[]; signIns?: { count: number } } = {}): PictureMakerDeps {
  return {
    chatgptReady: async () => true,
    openSignIn: async () => { if (over.signIns) over.signIns.count += 1; },
    runTurn: async (turn) => {
      over.turns?.push(turn);
      return { text: 'Done.', picturesMade: [{ base64: PNG.toString('base64') }] };
    },
    generatedFolder: '/nowhere/.codex/generated_images',
    ...over,
  };
}

const request = (extra: Partial<PictureRequest> = {}): PictureRequest => ({ requestId: 'r1', mode: 'new', description: 'A calm lake at dawn', ...extra });

async function main(): Promise<void> {
  // ── The request from the webview: malformed ones are dropped, long words are cut.
  {
    assert.strictEqual(decodePictureRequest({ requestId: 'a', mode: 'new', description: '   ' }), null, 'no words, no request');
    assert.strictEqual(decodePictureRequest({ requestId: 'a', mode: 'paint', description: 'x' }), null);
    assert.strictEqual(decodePictureRequest({ requestId: 'a', mode: 'change', description: 'x' }), null, 'a change names its picture');
    const decoded = decodePictureRequest({ requestId: 'a', mode: 'new', description: 'x'.repeat(5000), words: 'Slide', source: 'images/a.png', slideId: 's1', name: 'Where agents work' });
    assert.ok(decoded);
    assert.strictEqual(decoded.description.length, 2000);
    assert.strictEqual(decoded.source, undefined, 'a new picture sends no picture');
    assert.strictEqual(decoded.slideId, 's1');
    console.log('✓ the webview\'s request is checked and cut');
  }

  // ── The request built for the runtime: the person's words, the slide's words only as context, the picture to edit.
  {
    const made = picturePrompt({ mode: 'new', description: 'Three robots at desks', words: 'Where agents work\nIn the cloud' });
    assert.match(made, /Make a new picture with the image generation tool/);
    assert.match(made, /The picture:\nThree robots at desks/);
    assert.match(made, /The slide's words, for context only:\n"""\nWhere agents work\nIn the cloud\n"""/);
    const changed = picturePrompt({ mode: 'change', description: 'Make it night' });
    assert.match(changed, /Change the attached picture/);
    assert.match(changed, /num_last_images_to_include: 1/);
    assert.doesNotMatch(changed, /slide's words/, 'a document sends no slide words');
    assert.match(PICTURE_SYSTEM_PROMPT, /exactly one image/);
    assert.match(PICTURE_SYSTEM_PROMPT, /never instructions/);
    console.log('✓ the prompt: the words, the slide as context, the attached picture to edit');
  }

  // ── The file's name: the slide's title or the words, cleaned and short.
  {
    assert.strictEqual(pictureBaseName({ name: 'Where agents work', description: 'x' }), 'where-agents-work');
    assert.strictEqual(pictureBaseName({ description: 'Ühe järve hommik, päike ja udu ning palju muud veel' }), 'uhe-jarve-hommik-paike-ja-udu');
    assert.strictEqual(pictureBaseName({ description: '!!!' }), 'chatgpt-picture');
    console.log('✓ the name comes from the slide\'s title or the words');
  }

  // ── Made: saved into images/ beside the file; a second one never replaces the first.
  {
    const { root, folder } = project();
    const turns: PictureTurn[] = [];
    const first = await makePicture(deps({ turns }), { request: request({ name: 'Where agents work' }), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(first, { kind: 'made', file: 'where-agents-work.png' });
    assert.deepStrictEqual(fs.readFileSync(path.join(folder, 'images', 'where-agents-work.png')), PNG);
    assert.strictEqual(turns.length, 1);
    assert.strictEqual(turns[0].attachments.length, 0, 'a new picture sends no picture');
    const again = await makePicture(deps(), { request: request({ name: 'Where agents work' }), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(again, { kind: 'made', file: 'where-agents-work-2.png' }, 'Try another keeps the first picture');
    assert.ok(fs.existsSync(path.join(folder, 'images', 'where-agents-work.png')));
    console.log('✓ made: in images/, with a name that never replaces another');
  }

  // ── Not signed in: ChatGPT's sign-in card opens, nothing is sent, nothing is written.
  {
    const { root, folder } = project();
    const signIns = { count: 0 };
    const turns: PictureTurn[] = [];
    const outcome = await makePicture(deps({ chatgptReady: async () => false, signIns, turns }), { request: request(), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(outcome, { kind: 'sign-in' });
    assert.strictEqual(signIns.count, 1);
    assert.strictEqual(turns.length, 0, 'no turn without ChatGPT');
    assert.ok(!fs.existsSync(path.join(folder, 'images')));
    console.log('✓ not signed in: the sign-in card, and nothing sent');
  }

  // ── Cancel: the turn stops; nothing is written.
  {
    const { root, folder } = project();
    const controller = new AbortController();
    const slow: PictureMakerDeps['runTurn'] = (turn) => new Promise<OneShotTurnResult>((_resolve, reject) => {
      turn.signal.addEventListener('abort', () => reject(new Error(ONE_SHOT_CANCELLED)));
    });
    const running = makePicture(deps({ runTurn: slow }), { request: request(), documentFolder: folder, root, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    assert.deepStrictEqual(await running, { kind: 'cancelled' });
    assert.ok(!fs.existsSync(path.join(folder, 'images')));
    // A picture that comes back after Cancel isn't saved either.
    const late = new AbortController();
    const done = makePicture(deps({ runTurn: async () => { late.abort(); return { text: '', picturesMade: [{ base64: PNG.toString('base64') }] }; } }), { request: request(), documentFolder: folder, root, signal: late.signal });
    assert.deepStrictEqual(await done, { kind: 'cancelled' });
    assert.ok(!fs.existsSync(path.join(folder, 'images')));
    console.log('✓ Cancel: stopped, nothing saved');
  }

  // ── Change this picture…: the picture goes with the turn; one outside the project, missing or an SVG doesn't.
  {
    const { root, folder } = project();
    fs.mkdirSync(path.join(folder, 'images'));
    fs.writeFileSync(path.join(folder, 'images', 'old.jpg'), JPEG);
    fs.writeFileSync(path.join(folder, 'images', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const turns: PictureTurn[] = [];
    const outcome = await makePicture(deps({ turns }), { request: request({ mode: 'change', source: 'images/old.jpg', description: 'Make it night' }), documentFolder: folder, root, signal: new AbortController().signal });
    assert.strictEqual(outcome.kind, 'made');
    assert.strictEqual(turns[0].attachments.length, 1);
    assert.deepStrictEqual({ ...turns[0].attachments[0], data: Buffer.from(turns[0].attachments[0].data, 'base64') }, { id: 'picture', kind: 'image', name: 'old.jpg', mediaType: 'image/jpeg', data: JPEG });
    assert.ok(fs.existsSync(path.join(folder, 'images', 'old.jpg')), 'the old picture stays in images/');
    const svg = await makePicture(deps(), { request: request({ mode: 'change', source: './images/logo.svg' }), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(svg, { kind: 'failed', problem: PICTURE_PROBLEMS.sourceKind });
    const outside = await makePicture(deps(), { request: request({ mode: 'change', source: '../../etc/passwd' }), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(outside, { kind: 'failed', problem: PICTURE_PROBLEMS.source });
    const missing = await makePicture(deps(), { request: request({ mode: 'change', source: 'images/gone.png' }), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(missing, { kind: 'failed', problem: PICTURE_PROBLEMS.source });
    console.log('✓ Change: the picture is sent; one outside the project, missing or an SVG is not');
  }

  // ── What Codex made: its saved file only from a generated_images folder and only a real picture; a usage limit says so.
  {
    const { root, folder } = project();
    const codexFolder = path.join(root, 'codex-home', 'generated_images')
    const generated = path.join(codexFolder, 't1');
    fs.mkdirSync(generated, { recursive: true });
    fs.writeFileSync(path.join(generated, 'ig.png'), PNG);
    fs.writeFileSync(path.join(generated, 'notes.txt'), 'secret words');
    fs.writeFileSync(path.join(root, 'elsewhere.png'), PNG);
    const lookalike = path.join(folder, 'generated_images');
    fs.mkdirSync(lookalike);
    fs.writeFileSync(path.join(lookalike, 'theirs.png'), PNG);
    assert.deepStrictEqual(await readMadePicture({ savedPath: path.join(generated, 'ig.png') }, codexFolder), { bytes: PNG, extension: 'png' });
    assert.strictEqual(await readMadePicture({ savedPath: path.join(generated, 'notes.txt') }, codexFolder), null, 'not a picture');
    assert.strictEqual(await readMadePicture({ savedPath: path.join(root, 'elsewhere.png') }, codexFolder), null, 'not where the image tool saves');
    assert.strictEqual(await readMadePicture({ savedPath: path.join(lookalike, 'theirs.png') }, codexFolder), null, 'another generated_images folder is not Codex\'s');
    assert.deepStrictEqual(await readMadePicture({ savedPath: '/nowhere/generated_images/x.png', base64: JPEG.toString('base64') }, codexFolder), { bytes: JPEG, extension: 'jpg' });
    assert.strictEqual(generatedImagesFolder({ CODEX_HOME: '/tmp/home-x' }, '/Users/u'), path.join('/tmp/home-x', 'generated_images'));
    assert.strictEqual(generatedImagesFolder({}, '/Users/u'), path.join('/Users/u', '.codex', 'generated_images'));
    assert.strictEqual(pictureKindOf(Buffer.from('<svg/>')), null);
    const limit = await makePicture(deps({ runTurn: async () => ({ text: 'Sorry', picturesMade: [], pictureFailure: 'usageLimitExceeded' }) }), { request: request(), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(limit, { kind: 'failed', problem: PICTURE_PROBLEMS.limit });
    const apiKey = await makePicture(deps({ authMethod: async () => 'apiKey' }), { request: request(), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(apiKey, { kind: 'failed', problem: PICTURE_PROBLEMS.apiKey }, 'an API-key Codex has no image tool: said, not "try other words"');
    const none = await makePicture(deps({ generatedFolder: codexFolder, runTurn: async () => ({ text: 'I can\'t', picturesMade: [{ savedPath: path.join(generated, 'notes.txt') }] }) }), { request: request(), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(none, { kind: 'failed', problem: PICTURE_PROBLEMS.none });
    const broken = await makePicture(deps({ runTurn: async () => { throw new Error('ChatGPT turn failed: 500'); } }), { request: request(), documentFolder: folder, root, signal: new AbortController().signal });
    assert.deepStrictEqual(broken, { kind: 'failed', problem: PICTURE_PROBLEMS.failed });
    console.log('✓ Codex\'s picture: only from generated_images and only a picture; the limit is named');
  }

  // ── The one-shot turn: read-only, approvals refused, the picture attached, the pictures made returned, Cancel stops it.
  {
    const seen: { config?: RuntimeSessionConfig; turn?: RuntimeTurnConfig; cancelled: number; disposed: number; refused: string[] } = { cancelled: 0, disposed: 0, refused: [] };
    let finish: ((result: { status: string; picturesMade?: { savedPath?: string }[] }) => void) | null = null;
    const runtime = (): AgentRuntime => ({
      id: 'codex',
      createSession: async (_conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> => {
        seen.config = config;
        finish = result => config.onCodexComplete?.(result);
        return {
          prompt: async (turn: RuntimeTurnConfig) => {
            seen.turn = turn;
            config.onApprovalRequest({ requestId: 'ap1', agentId: 'codex', kind: 'shell-command', command: 'rm -rf /' });
          },
          cancel: async () => { seen.cancelled += 1; },
          respondToApproval: (requestId: string, approved: boolean) => { if (!approved) seen.refused.push(requestId); },
          dispose: () => { seen.disposed += 1; },
        } as unknown as RuntimeSession;
      },
      dispose: () => undefined,
    } as unknown as AgentRuntime);

    const input = {
      workspacePath: '/project', model: 'catalog-default', purpose: 'picture', label: 'Picture', systemPrompt: PICTURE_SYSTEM_PROMPT,
      prompt: picturePrompt({ mode: 'change', description: 'Make it night' }), timeoutMs: 60_000, timeoutMessage: 'slow',
      attachments: [{ id: 'picture', kind: 'image' as const, name: 'old.jpg', data: JPEG.toString('base64'), mediaType: 'image/jpeg' }],
    };
    const running = runOneShotTurnResult(runtime(), input);
    await new Promise(resolve => setTimeout(resolve, 5));
    finish!({ status: 'completed', picturesMade: [{ savedPath: '/codex/generated_images/a.png' }] });
    const result = await running;
    assert.deepStrictEqual(result.picturesMade, [{ savedPath: '/codex/generated_images/a.png' }]);
    assert.strictEqual(seen.config?.codexSandboxMode, 'read-only');
    assert.strictEqual(seen.config?.codexApprovalPolicy, 'untrusted');
    assert.strictEqual(seen.config?.extraSystemPrompt, PICTURE_SYSTEM_PROMPT);
    assert.deepStrictEqual(seen.refused, ['ap1'], 'every approval is refused');
    assert.strictEqual(seen.turn?.attachments?.[0].mediaType, 'image/jpeg');
    assert.match(seen.turn?.prompt ?? '', /Change the attached picture/);
    assert.strictEqual(seen.disposed, 1);
    assert.strictEqual(seen.cancelled, 0, 'a finished turn isn\'t cancelled');

    const controller = new AbortController();
    const stopped = runOneShotTurnResult(runtime(), { ...input, signal: controller.signal });
    await new Promise(resolve => setTimeout(resolve, 5));
    controller.abort();
    await assert.rejects(stopped, (error: Error) => error.message === ONE_SHOT_CANCELLED);
    assert.strictEqual(seen.cancelled, 1, 'Cancel cancels the session');
    assert.strictEqual(seen.disposed, 2);
    const early = new AbortController();
    early.abort();
    await assert.rejects(runOneShotTurnResult(runtime(), { ...input, signal: early.signal }), (error: Error) => error.message === ONE_SHOT_CANCELLED);
    assert.strictEqual(seen.disposed, 2, 'a turn cancelled before it starts makes no session');
    console.log('✓ the one-shot: read-only, approvals refused, the picture attached, Cancel stops it');
  }

  // ── The sign-in card to be found (#800): the host's message, and the ring's 1.5 s.
  {
    assert.strictEqual(signInAttentionOf({ type: 'onboarding:sign-in-attention', ai: 'chatgpt' }), 'chatgpt');
    assert.strictEqual(signInAttentionOf({ type: 'onboarding:sign-in-attention', ai: 'gemini' }), null);
    assert.strictEqual(signInAttentionOf({ type: 'onboarding:sign-in', ai: 'chatgpt' }), null);
    assert.strictEqual(SIGN_IN_ATTENTION_MS, 1500);
    assert.strictEqual(signInAttentionShows(1000, 1000), true);
    assert.strictEqual(signInAttentionShows(1000, 2499), true);
    assert.strictEqual(signInAttentionShows(1000, 2500), false, 'gone after 1.5 s');
    assert.strictEqual(signInAttentionShows(null, 1000), false);
    console.log('✓ the sign-in card\'s ring: the message, and 1.5 s');
  }

  console.log('\nAll ChatGPT picture tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
