# Sprint 129 A2 — Windows performance audit

**Date:** 2026-10-11 · **Machine:** Jarmo's Windows PC: AMD Ryzen 7 5825U (Zen 3, 8 cores / 16 threads), 15.3 GB RAM, integrated Radeon GPU (unused, CPU only), Windows 11 Pro 26200, mains power, Smart App Control **Off** · **Engine:** config V from run 38131848536 (head `0b56d656`); CPU backend chosen at run time: `ggml-cpu-haswell.dll` · **Model:** `ggml-large-v3-turbo.bin`, SHA-256 verified · Run by the "Ritemark on Windows" session; relayed by the Development manager.

## Round 1 (dictation flags, wall / load / encode / decode ms, all exit 0)

| Case | Wall | Load | Encode | Decode |
|---|---:|---:|---:|---:|
| 4 threads, beam 8 | 46,279 | 2,618 | 41,894 | 1,269 |
| 8 threads, beam 8 | 28,584 | 2,428 | 24,808 | 905 |
| **16 threads**, beam 8 | 23,102 | 2,427 | 19,005 | 1,224 |
| 16 threads, beam 8 / 5 / 1 ("5 s" and "10 s") | 21,899–22,242 | ~2,430 | ~18,300 | 799–1,074 |
| 16 threads, beam 8, `--audio-ctx 576` ("10 s") | 9,002 | 2,436 | 5,300 | 837 |
| 16 threads, beam 8, `--audio-ctx 320` ("5 s") | 12,270 | 2,433 | 2,605 | 6,029 (repetition loop) |
| Transcribe, 10 min of audio, 16 threads | 567,643 (0.95× real time) | 2,429 | 480,428 | 64,001 |

The 48 s warm-up included the first read of the model and the antivirus scan.

**Caveat (Windows session, confirmed):** `--duration` does not shorten what the encoder sees. The "5 s" and "10 s" rows ran the whole 11 s sample, so they time a call correctly but say nothing about accuracy on short chunks. That includes the two `--audio-ctx` rows.

## What it means

- **Encode is the whole cost:** about 18.3 s per call with the default 30 s window, whatever the chunk length or beam. Beam size moves decode by under 0.5 s.
- **Threads:** all logical threads are fastest (46 → 29 → 23 s). This is adopted as W6 lever 1: `whisperThreads()` gives all logical threads on Windows and Intel Macs, and Apple silicon keeps 4.
- **Levers 2 and 3 (beam, chunk length) do nothing for speed** and are not adopted. Beam stays at 8.
- **W6 target missed:** a 5 s call takes ~22 s against a 5 s target. Per the rule, work stops for Jarmo's decision before anything bigger. R8 means no words are lost, but text would arrive ~25–45 s after speech on this laptop.
- **Transcribe on-device is usable:** an hour of audio in about an hour, with progress shown.
- **Model download:** the Hugging Face CDN dropped the 1.6 GB transfer twice on that network (`schannel: server closed abruptly`). R7 now resumes automatically (see spec R7 revision).

## The shorter audio window is not shippable (Mac check, 2026-10-11)

Accuracy with a shorter window depends on the model, not the CPU, so it was checked on Apple silicon with real clips cut from `jfk.wav`, dictation's exact flags, and large-v3-turbo:

| Clip | Default window | Window = clip + 32 / 64 / 128 frames |
|---|---|---|
| 3 s | correct | loops ("Ask not. Ask not. …") at every margin |
| 5 s | correct | loops at +32; correct at +64 and +128 |
| 7 s (cut mid-word) | correct | repeats the last sentence at every margin |
| 10 s | correct | correct |
| 20 s | correct | correct (+64) |

Real dictation calls vary in length, so this lever would put repeated or looping text into documents. It is rejected.

## The 8-bit model is (Mac CPU check, 2026-10-11)

Apple silicon CPU with the GPU off (`-ng`, 10 threads), dictation flags, two runs each:

| Model | File | 10 s clip encode | 20 s clip encode / total | Text |
|---|---:|---:|---:|---|
| `large-v3-turbo` (f16) | 1.62 GB | 4.60 s | 4.82 / 6.05 s · 4.69 / 5.58 s | correct |
| `large-v3-turbo-q8_0` | 0.87 GB | 2.71 s | 2.42 / 3.25 s · 2.44 / 3.24 s | identical to f16 |
| `large-v3-turbo-q5_0` | 0.57 GB | 4.99 s | 5.16 / 5.64 s | correct, no faster |

q8_0 is about 1.9× faster on a CPU with the same text, and half the download. If x86 gains as much, a call on the 5825U falls from ~22 s to ~12 s. R8 then keeps up comfortably, with text arriving ~15–25 s after speech, and Transcribe takes about half an hour per hour of audio. This needs confirming on Windows (bench round 2), and Estonian accuracy needs checking.

## Options put to Jarmo

1. **q8_0 model on computers without Apple's GPU (Windows, Intel Macs).** Measure first with bench round 2 on the same PC, including an Estonian recording. Apple silicon keeps the full model it already has.
2. **GPU acceleration on Windows (Vulkan).** Potentially real-time, but a new build dependency, a larger download and driver variability. Measure first; a natural follow-up sprint.
3. **Ship CPU dictation as it is,** with honest wording about the delay.
4. **Hold dictation on Windows** (drop `win32` from the flag) and ship on-device Transcribe only.

Recommendation: 1 now, 2 as a follow-up issue for real-time dictation.

## Round 2 on Windows (2026-10-12): q8_0 against f16, Whisper only

Run by the "Ritemark on Windows" session (relayed by the Development manager) on the same PC. Inputs:
- artifacts from run 38225663013 (SHA256SUMS verified);
- 20 FLEURS Estonian clips (247 s);
- both models SHA-256 verified.

Dictation's flags, 16 threads, one process per clip.

| Model | WER | Per clip | Load (sum of 20) | Encode (sum of 20) | RTF |
|---|---:|---:|---:|---:|---:|
| large-v3-turbo q8_0 | 14.8% | 22,038 ms | 26,882 ms | 367,420 ms | 1.78 |
| large-v3-turbo f16 | 14.2% | 24,937 ms | 48,186 ms | 387,780 ms | 2.02 |

- **Accuracy:** the same. The text is identical in 19 of 20 clips; the one difference is "looduskaitse ala" against "looduskaitseala".
- **Speed:** q8_0 is only **1.13×** faster on this Zen 3 CPU, against 1.9× on the Mac CPU. Loading halves (1.3 s against 2.4 s), but encoding takes ~18 s per call for both and dominates.
- **Per call, flat:** 20–25 s for 8.6–16.6 s of audio, because every call encodes a padded 30 s window. With R8 joining waiting audio (up to 28 s per call), dictation keeps up on this PC, but text arrives ~25–50 s after the speech. A slower PC falls behind and stops with the "can't keep up" notice after a minute of backlog.

## The shorter window, on real speech (Mac, 2026-10-12)

The Windows session pointed back to round 1's `--audio-ctx 576` (9.0 s per 10 s chunk). It was scored on the 100 FLEURS Estonian clips, with the window sized to each clip plus a margin (`asr-wer.mjs --audio-ctx-margin`):

| Window | WER |
|---|---:|
| Full 30 s (as shipped) | 19.2% |
| Clip + 64 frames | 65.6% |
| Clip + 128 frames | 72.9% |
| Clip + 256 frames | 59.2% |

At +128, 33 of 100 clips ran away (more than 1.5× the reference words: whole sentences repeated), and 52 were worse than with the full window. The setting itself works (clips it does not upset come out correct). It stays rejected; this is not a speed lever for Estonian.

## Where this leaves W6

The pre-approved levers are used up (threads) or do nothing (beam, chunk length). The two candidate levers outside the plan fail on quality: the shorter window here, and Parakeet/Zipformer by Jarmo's decision. What remains:
- **GPU (Vulkan):** unmeasured, a new build dependency.
- **A resident whisper process:** saves the 1.3–2.4 s load per call, about 10%.

This is a decision for Jarmo (sprint-plan.md, open decisions).

## Round 3 accuracy, cross-checked on the Mac (2026-10-12)

Jarmo asked for the shorter window to be measured with the model kept in memory (round 3, on the Windows PC, speed still to come). Accuracy does not depend on the computer, so the same method was repeated on the Mac: the same 20 FLEURS clips, cut into fixed chunks the way dictation's timer cuts them, all through one whisper-cli process (`asr-wer.mjs --chunk-seconds N --resident on [--audio-ctx N]`).

| Configuration | WER |
|---|---:|
| Whole clip, full window (Windows round 2 measured 14.2% too) | 14.2% |
| 10 s chunks, full window | 22.5% |
| 10 s chunks, `--audio-ctx 576` — f16 / q8_0 | 42.3% / 42.6% |
| 5 s chunks, full window (**dictation's default today**) | 35.8% |
| 5 s chunks, `--audio-ctx 320` — f16 / q8_0 | 85.5% / 89.6% |

- **The shorter window** costs about 20 points even at 10 s, and makes 5 s unusable. This agrees with the whole-clip test (59–73%). Chunking, flags and the resident process do not change the conclusion.
- **q8_0 ≈ f16** in every configuration, so on quality q8_0 passes Jarmo's condition.
- **New finding: fixed chunks cost accuracy by themselves.** Cutting at 5 s takes Estonian from 14% to 36% WER, because words are split at the chunk boundaries. 10 s chunks halve that loss. R8's joining of waiting audio lengthens calls on slow computers, which helps accuracy too. Chunking at pauses (voice activity detection, a #117 item) is the real fix and is not in this sprint.
