# Sprint 129 W11 — Speech engine candidates: Estonian accuracy

**Date:** 2026-10-12 · **Why:** Jarmo, 2026-10-12: "mõõda kõiki" (measure every candidate) · **Where:** Jarmo's Mac (Apple silicon). Accuracy depends on the model, not the computer; speed is measured on the Windows PC in bench round 2.

## Method

- **Test set:** FLEURS Estonian test split (Google, CC BY 4.0, revision `70bb2e84`). One recording per sentence, the first 100 sentences by id: 1,240 s of audio, 1,695 reference words. `scripts/qa/fleurs-clip-pack.mjs` converts them to the 16 kHz mono 16-bit WAV that Ritemark sends.
- **Scoring:** `scripts/qa/asr-wer.mjs`. Word error rate after lowercasing and removing punctuation, which are not errors here.
- **Whisper engines** run one `whisper-cli` process per clip with dictation's own flags (`dictationArgs()`), as dictation runs today. **sherpa-onnx engines** run one process for all clips (official v1.13.8 macOS build).
- **Checksums:** every download matched its published SHA-256. Our q8_0 quantization of large-v3-turbo is byte-identical to the official q8_0 file (`317eb69c…`), so quantizing TalTech's official GGML the same way is sound.

## Results

| Engine | Size | WER (100 clips) | Notes |
|---|---:|---:|---|
| **TalTech whisper-large-v3-turbo-et-verbatim-2604, q8_0** (our quantization of TalTech's official GGML, MIT) | 0.87 GB | **11.4%** | Needs timestamps on (below). Same speed as Whisper q8_0 |
| TalTech et-verbatim-2604, f16 (official GGML) | 1.62 GB | 11.4% | Needs timestamps on |
| **TalTech streaming Zipformer et-en, int8** (MIT) | 75 MB | **12.9%** | Estonian and English only. 100 clips in ~19 s including load on this Mac (8 threads) |
| TalTech streaming Zipformer *large* et-en, int8 (MIT) | 157 MB | 14.6% | Worse than the base model here; not measured on Windows |
| Whisper large-v3-turbo f16 (**what Ritemark ships**) | 1.62 GB | 19.2% | |
| Whisper large-v3-turbo q8_0 | 0.87 GB | 19.5% | 1.9× faster on a CPU (A2 Mac check) |
| NVIDIA Parakeet TDT 0.6B v3, int8 (CC BY 4.0) | 0.65 GB | 41.1% | Fast (RTF 0.05 on CPU), but Estonian is poor |

**TalTech's Whisper with timestamps off:** with dictation's `--no-timestamps`, the fine-tuned model writes the sentence correctly and then does not stop. It repeats phrases and emits stray tokens until the token limit, which scored 92.8% WER. With timestamps on, every output ends cleanly. Using this model would mean dictation runs with timestamps on and strips them from the text, which is a small flag change. Rows marked "needs timestamps on" were scored that way.

For a like-for-like comparison, the standard model was also scored with timestamps on: **19.9%** (f16) and **20.1%** (q8_0), against TalTech's 11.4% in the same mode. The gap does not come from the mode.

## What it means

- **Accuracy:** TalTech's Estonian-tuned Whisper roughly halves Ritemark's Estonian errors (19.2% → 11.4%). It runs in the same whisper.cpp and costs the same as Whisper q8_0 on a CPU. It is MIT-licensed, and TalTech publishes the GGML file itself.
- **Speed and accuracy together:** the small TalTech Zipformer is almost as accurate (12.9%) and an order of magnitude faster, because it streams. But it covers Estonian and English only, and it needs a new runtime (sherpa-onnx / ONNX Runtime).
- **Parakeet is out** for Estonian.
- **Decision (Jarmo, 2026-10-12):** Parakeet and the Zipformer are out (poor Estonian; Estonian and English only), so no sherpa-onnx runtime. The TalTech Estonian Whisper stays open as an accuracy option. Windows round 2 measures Whisper q8_0 against f16.
- **Open for the decision (Jarmo):**
  - Languages other than Estonian and English: the TalTech Whisper was fine-tuned on Estonian plus some English, and other languages were not checked.
  - A non-Whisper runtime is a separate decision (Development manager, 2026-10-12).
  - Windows speed for each candidate comes from bench round 2.

## Reproduce

```bash
node scripts/qa/fleurs-clip-pack.mjs --tsv test.tsv --audio-dir test/ --out clips100 --count 100
npx --yes tsx@4.21.0 scripts/qa/asr-wer.mjs --clips clips100 --label taltech-q8 --engine whisper \
  --binary <whisper-cli> --model taltech-2604-q8_0.bin --timestamps on
npx --yes tsx@4.21.0 scripts/qa/asr-wer.mjs --clips clips100 --label zipformer --engine sherpa \
  --binary <sherpa-onnx> -- --num-threads=8 --tokens=tokens.txt --encoder=encoder.int8.onnx \
  --decoder=decoder.int8.onnx --joiner=joiner.int8.onnx
```
