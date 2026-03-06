# **Fastest & Most Accurate Estonian Speech-to-Text Models**

## **Open-Source Models Supporting Estonian**

### **OpenAI Whisper (Tiny, Base, Small, Medium, Large)**

**Accuracy:** Whisper is a state-of-the-art multilingual ASR model supporting 99 languages (including Estonian). The largest Whisper (Large-v2/v3, ~1.5B params) achieves strong accuracy on Estonian, but out-of-the-box WER is still in the ~15–22% range for Estonian speech (one vendor reported ~22% WER for Whisper-large-v3 on Estonian). Fine-tuning on Estonian data can dramatically improve this – e.g. a Whisper-large model finetuned on ~1200h of Estonian data reached ~11–12% WER on Estonian test sets. Smaller Whisper variants (Tiny/Base/Small/Medium) have higher WER on Estonian (e.g. a finetuned Whisper-medium got ~14–15% WER), but can still outperform older Kaldi/Vosk models (which are often only “moderately” accurate in Estonian). In short, Whisper-large offers the best accuracy (approaching ~90% accuracy in Estonian with finetuning), while Tiny/Base models trade accuracy for speed.

**Speed:** Whisper’s inference speed scales with model size. On CPU, the largest model is **much slower than real-time** (e.g. Whisper-large in PyTorch might transcribe ~0.5× real-time or slower on a CPU). On GPU or optimized runtimes, speed improves. For example, an Apple M1 Pro can run Whisper-large-v3-Turbo ~5× faster than the original large (achieving ~2.7× real-time) according to community tests. The smaller models (Tiny/Base) can approach real-time on a modern CPU. Whisper processes audio in ~30s chunks, so it’s not inherently streaming, but it can be run on rolling segments for “near-real-time” transcription.

**Model Size:** Whisper’s downloadable model files range from ~75 MB (Tiny) to ~2.9 GB (Large). At runtime, they require roughly 0.3 GB (Tiny) up to ~3.9 GB (Large) RAM. These sizes are significant if bundling into an Electron app. Quantized versions (int8/int4) can reduce size by 50–75% with minimal accuracy loss.

**Integration:** Whisper can run locally via multiple routes. The official OpenAI Whisper code (Python) isn’t ideal for Electron, but **C/C++ ports like** `whisper.cpp` make it easy to integrate without dependencies. Whisper supports **WebAssembly** via Transformer.js or `whisper.cpp`’s WASM build, enabling in-browser or Node execution (with performance ~**slower than native** due to lack of GPU). For an Electron/VSCode extension on macOS, a common approach is to bundle a pre-compiled `whisper.cpp` **library** or binary. This has **zero external dependencies** (just the model file) and can run on Apple Silicon **fully on the GPU via Metal** for speed. In fact, `whisper.cpp` treats Apple Silicon as a “first-class citizen” with NEON and Metal optimizations, achieving significant speed-ups. Developers have demonstrated real-time offline transcription on an M1 using `whisper.cpp` with GPU acceleration. In summary, Whisper models can be bundled and run offline in an Electron app, with smaller models or GPU acceleration needed for real-time performance. (OpenAI also offers a **Whisper API** in the cloud, but that requires internet access – see Cloud section below.)

### **Whisper.cpp and Faster Whisper**

**Whisper.cpp:** This is a highly optimized C/C++ implementation of Whisper for local deployment. It yields **identical accuracy** to the original Whisper (uses the same model weights), but with heavy optimizations: ARM NEON, Intel AVX, multi-threading, and GPU backends (Metal on Mac, CUDA on Nvidia, etc.). It supports **int8/int4 quantization** to shrink model size and speed up inference. On Apple M1/M2, whisper.cpp can run inference entirely on the **Apple Neural Engine/GPU (via Metal)**, enabling near real-time transcription even with medium or large models. Integration is straightforward: you can include the lightweight `whisper.cpp` library or use its Node.js bindings (there are community NPM packages) – no Homebrew or system installs needed. For example, an iPhone 13 (A15 chip) can run whisper.cpp large-v2 fully offline with acceptable speed, so an M1 Pro can certainly handle smaller models in real-time. Whisper.cpp is ideal for Electron since you can ship a single binary and model file. Memory-wise, note the runtime RAM usage (e.g. ~4GB for large) – on 16GB Apple Silicon that is manageable, but for better speed you might use a smaller model or quantization.

**Faster-Whisper:** This refers to running Whisper with the CTranslate2 inference engine (and optionally quantization). It maintains Whisper’s accuracy but is **~4× faster** than OpenAI’s reference implementation. Faster-whisper achieves speedups by using an optimized C++ backend and supporting int8/fp16 models. In practice, Faster-Whisper can do near real-time transcription on CPU for small/medium models, and significantly improve throughput for large models (often used server-side). For integration, one could bundle the CTranslate2 library or use a Node addon. Another approach is to convert Whisper models to an ONNX or CTranslate2 format and call a local binary from the Electron app. (For example, the TalTech team that fine-tuned Whisper for Estonian specifically recommends using faster-whisper for inference.) This still counts as “zero install” since the required binaries and model can be packaged with the app. If targeting Apple Silicon, faster-whisper can leverage all CPU cores (and Apple’s Accelerate/NEON) but does **not** yet use the GPU – so whisper.cpp might actually outperform it on Mac due to Metal support. In summary, faster-whisper is a good choice for maximizing Whisper’s speed offline, especially on CPU-only environments, and it can be integrated by shipping the necessary library or compiled binary with your app.

**Distil-Whisper:** This is a **distilled** version of Whisper-large that runs ~**6× faster** than Whisper-large-v3 while preserving **within ~1% WER** of its accuracy. Distil-Whisper achieves its speed by using a smaller decoder (fewer transformer layers) but was trained to mimic the full model’s outputs. **Important:** The publicly released Distil-Whisper models are primarily optimized for English – they were distilled on English data. This means Estonian support may be limited or less accurate (the model likely was not explicitly trained on Estonian transcripts). If multilingual support is needed, Distil-Whisper might not match the original Whisper for Estonian. That said, the idea of distillation could be applied to Whisper’s multilingual model – Naver Labs, for example, explored *Multilingual* DistilWhisper to compress the model while keeping its 99-language capabilities (research ongoing). In practice, unless an open multilingual distilled model emerges, you might not use Distil-Whisper for Estonian. However, if it did support Estonian, it would offer near-whisper accuracy at a fraction of the runtime (6× speedup). Integration of Distil-Whisper would be similar to original Whisper (it’s the same architecture, just smaller) – it can run via Transformers.js in-browser (there’s even a web demo using WASM) or via the Rust-based **Candle** library which supports Metal GPU and WASM execution. In summary, Distil-Whisper is a promising approach for speed, but current checkpoints may not be tuned for Estonian – so use with caution for that language.

### **NVIDIA Models (Canary & Parakeet)**

NVIDIA has open-sourced high-performance ASR models targeting European languages (including Estonian). Two notable ones are **Canary** and **Parakeet-TDT**:

-   **Canary-1B-v2:** a ~1 billion-parameter multilingual model with a Conformer encoder + Transformer (or LLM) decoder. It was trained on *1.7 million hours* of audio across 25 European languages (Estonian included). Canary’s goal is to rival Whisper’s accuracy but with higher efficiency. Indeed, Canary-1B-v2 slightly *outperforms* Whisper-large-v3 on average multilingual WER (8.1% vs 9.9% across a 24-language test set), while running **~7–10× faster** than Whisper. It also supports speech translation tasks. For Estonian specifically, Canary’s WER is likely among the lowest of any open model (the training corpus “Granary” included substantial Estonian data). This comes at the cost of model size – ~1B params (probably 2+ GB model file). And Canary’s decoder uses an LLM-like component for extra accuracy, which makes it **slower** than simpler decoders (it’s optimized but still not real-time on CPU). In the HuggingFace ASR leaderboard, a variant *Canary-Qwen-2.5B* (with a larger LLM decoder) achieved *state-of-the-art* English WER (~5.8%) but is obviously huge. The takeaway: Canary-1B is one of the **most accurate** models for Estonian, rivaling Whisper-large, but it’s heavy to deploy offline.
    
-   **Parakeet-TDT-0.6B-v3:** a ~600M parameter model that prioritizes **throughput** and streaming. This model uses a *Transducer/TDT decoder* (TDT = time-depth tradeoff, an efficient streaming architecture) with a Fast-Conformer encoder. Parakeet is **extremely fast** – on the HF leaderboard it clocked an *RTFx (Real-Time Factor)* of ~3330, meaning it can process audio thousands of times faster than real-time on high-end hardware. Even on modest hardware, Parakeet can easily do real-time transcription (it was explicitly designed for low-latency). In accuracy, Parakeet 0.6B is slightly better than Whisper-large: ~9.7% avg WER vs Whisper’s 9.9% across 24 languages. That suggests its Estonian performance is on par with Whisper-large (and likely better than Whisper-medium). Essentially, Parakeet aims to be the **fastest offline model** while retaining high accuracy. It’s well-suited for **streaming transcription**, thanks to the transducer-style decoder (you get word-by-word output with milliseconds latency). **Integration:** Both Canary and Parakeet are available on Hugging Face Hub (NVIDIA’s NeMo toolkit). You can use them via the NeMo Python library or export to ONNX. However, bundling a 600M–1B param model in an Electron app is challenging. There is no simple WASM port yet for these. One approach is to use NVIDIA’s TensorRT or ONNX Runtime with the model – but that would require shipping some heavy runtime libraries (which might violate “zero install” unless you package them inside the app). On Apple Silicon, there’s currently no Metal-optimized engine for these models, so you’d be running on CPU – which could still be fine for Parakeet since it’s so efficient. *Bottom line:* If maximum speed **and** solid accuracy are needed offline, NVIDIA’s Parakeet is a top contender (Estonian is one of its target languages). It will transcribe in real-time (or faster) on most machines. The integration effort is higher (you may need to bundle NVIDIA’s runtime or convert the model), but it’s open source (MIT license) and **no user installation** is required if you include the necessary binaries.
    

### **Meta Massively Multilingual Speech (MMS)**

Meta’s **MMS** project released models covering an unprecedented **1,100+ languages** – definitely including Estonian. The MMS ASR model is based on a wav2vec2 encoder with a CTC decoder for transcription. Its strength is broad language coverage, especially for low-resource languages. **Accuracy:** For languages like Estonian (which has a few million speakers), MMS is decent but not state-of-the-art. Meta’s paper reported that MMS slightly *outperformed Whisper* on a benchmark of 54 languages on average, but these comparisons were tricky. In general, community evaluations found that **Whisper tends to be more accurate** than MMS on many medium-resource languages. The HF leaderboard also notes that self-supervised models like MMS “trail behind language-specific encoders in accuracy”. So, MMS likely has higher WER (maybe in the 20%+ range for Estonian). On the plus side, MMS can transcribe languages that Whisper might completely miss – but Estonian is not in that category (Whisper handles Estonian fine). **Speed & Size:** MMS’s largest model is ~1B params (comparable to Whisper-large). Being CTC-based, it can be faster and streaming-friendly. It’s open source (MIT license). **Integration:** MMS models are available via fairseq and on Hugging Face. To use in Electron, one could convert the MMS model to ONNX or use a Javascript CTC decoder. This is non-trivial – there isn’t an off-the-shelf WASM for MMS yet. Another option is to call an intermediate **service/worker** that runs MMS in a Python or C++ process (but that introduces some complexity). Given the superior accuracy of Whisper and others, MMS might not be the top choice unless you need its extreme multilingual range. Still, it’s an OSS model supporting Estonian with no usage cost. If integrated, no user installation is needed beyond bundling the model and whatever inference engine you choose.

### **Other Open ASR Options**

-   **VOSK/Kaldi Models:** There exist Kaldi-based Estonian models (e.g. in the TalTech “Kiirkirjutaja” project). They can run offline and even via WebAssembly (Vosk-WASM). However, their accuracy is significantly lower than the modern transformer models. A TalTech study noted Vosk’s Estonian model had **“only moderate” accuracy** – likely far worse WER than Whisper or Parakeet. Speed is real-time even on CPU, and integration is easy (Vosk has a Node API), but given the quality concerns, these are usually ruled out if accuracy is a priority.
    
-   **Coqui STT (DeepSpeech):** An open-source STT engine; Estonian models can be trained (Common Voice data). Accuracy, however, is again not on par with Whisper – WERs are usually high. Unless you have a custom model, this may not satisfy the “most accurate” requirement.
    
-   **IBM Watson/STT (Granite model):** IBM’s Granite 8B model achieved SOTA English results, but it’s English-focused and 8B params (not feasible offline in Electron). IBM hasn’t released Estonian models.
    
-   **ElevenLabs Scribe:** ElevenLabs (proprietary) claims to have a top-notch model (they report ~6.9% WER on English) and it does support Estonian (as per their UI). But it’s a cloud API service, not a local model – similar category to Azure/Google (discussed next).
    

Overall, **Whisper-large**, **NVIDIA Parakeet**, and possibly **finetuned Whisper variants** are the best open models for Estonian. Whisper offers excellent accuracy (especially if finetuned), while Parakeet offers extreme speed with accuracy close to Whisper. Whisper-small or medium models can be a sweet spot if you need offline real-time on CPU but can tolerate a bit lower accuracy (e.g. WER ~15–20%).

## **Cloud Speech-to-Text Services (Estonian)**

If local deployment proves too slow or heavy, several cloud-based ASR APIs support Estonian with high quality:

-   **Microsoft Azure Speech Services:** Azure’s cloud STT supports **Estonian** (locale “et-EE”) and is known for high accuracy in many languages. Microsoft continually improves their multilingual models; quality is considered enterprise-grade (likely around ~10% WER or better in many scenarios). Azure allows real-time streaming transcription with minimal latency. In fact, Speechmatics (a third-party) claims their product is 60% faster than the “nearest competitor” with <1s latency – that competitor could be Azure, indicating Azure’s latency is low (just slightly higher than Speechmatics). Azure’s pricing is about **$1 per hour** of audio for real-time transcription, making it quite affordable. Integration in Electron is straightforward via the Azure Cognitive Services SDK or REST API – just bundle your subscription key in the app. No local installation required (just an internet connection). Azure also offers **Customization** (you can adapt the model with your data) for supported languages – as of now, custom models aren’t available for Estonian (according to MS docs), but the base model is quite strong out-of-the-box.
    
-   **Google Cloud Speech-to-Text:** Google’s STT API supports Estonian as well. Google has long experience in ASR, and their models for languages like Estonian are high quality. (While Google doesn’t publish WERs per language publicly, anecdotal evidence suggests it’s comparable to Azure – likely around ~10-15% WER on diverse Estonian speech). Google offers both synchronous recognition (for short files) and streaming APIs. The **latency** for streaming is low (partial results within a few hundred milliseconds). Pricing is in the same ballpark as Azure – around $0.024 per minute (~$1.44/hour) for standard models. Integration is via Google’s cloud SDK or direct REST calls. Again, nothing for the user to install; the Electron app just communicates with the cloud. One consideration is that Google (and Azure) require internet and sending audio to third-party servers – if your use-case values privacy/offline, that may be a drawback relative to local models.
    
-   **AWS Transcribe:** Amazon Transcribe supports Estonian for both batch and streaming transcription. AWS had a bit more limited language support historically, but as of recent updates it lists Estonian in its supported languages. The accuracy is good, though some users report Azure/Google slightly outperform AWS in many languages. AWS is continuously improving – they even announced support for **100 languages** with a new model recently. WER specifics for Estonian aren’t published, but likely within a similar range (perhaps ~15% in real-world scenarios). AWS Transcribe streaming can be integrated using the AWS SDK; it opens a persistent WebSocket for real-time results. Pricing is ~$0.0004 per second ($1.44/hour) for streaming. No user installation needed – just AWS credentials configured in the app.
    
-   **Speechmatics (Private API):** Speechmatics is a specialized speech tech company that offers an **Estonian ASR API**. They explicitly market their Estonian model as **“90% accuracy”** (which implies ~10% WER) with **<1s latency** in real-time. They claim to be “the fastest, most accurate on the market” for Estonian. This suggests Speechmatics has highly optimized models for Estonian (possibly they fine-tuned on Estonian data, similar to how TalTech did). However, this is a paid service (not open source). Integration would be via their API (REST/SDK). It’s an option if accuracy and speed trump all and you don’t mind a third-party service. Cost is not publicly listed on their site; it’s usually volume-based pricing. Since the question focus is on models, the key point is that top cloud vendors are in the same accuracy ballpark (and Speechmatics uses proprietary models to edge ahead slightly).
    
-   **OpenAI Whisper API:** OpenAI provides a hosted Whisper model (called `whisper-1`) accessible via API. This uses the large-v2 Whisper model under the hood. It **supports Estonian** and all the languages Whisper covers. Accuracy will be equivalent to open-source Whisper-large (so good, but not specialized for Estonian domain). Because OpenAI has massive compute, the API is quite fast – you send an audio file and get the transcription, though it’s not a streaming API (it’s an async request for now). The pricing is **$0.006 per minute** ($0.36/hour), which is very cheap. If you don’t require true streaming but just quick turnaround on audio, this is a cost-effective cloud option. Integration in Electron is simply an HTTP request to OpenAI’s endpoint. No installation for users, just an API key needed. The downside is reliance on internet and sending data to OpenAI’s servers (which might be a privacy concern for some applications).
    

**Comparison:** Cloud services relieve you from heavy models on the client and are easy to integrate (just JS HTTP calls or SDKs). They all support real-time in some form, except OpenAI’s is non-streaming. In terms of accuracy for Estonian: Azure, Google, and Speechmatics are likely at the top (around 10% WER or better on clean speech). OpenAI Whisper API might be slightly behind (since it’s not fine-tuned on Estonian specifically, perhaps ~15% WER). AWS is probably slightly behind the other big ones or on par, but without specific benchmarks it’s hard to rank – let’s assume it’s competent. If **“fastest**” is the priority in an absolute sense, a tuned service like Speechmatics or Azure streaming will deliver results with under 1 second latency, using powerful servers. If **“most accurate**,” those same services or possibly a specialized model (Speechmatics or a hypothetical custom-trained model) would win. For an Electron app, using a cloud API means the user installs nothing – but they do need connectivity and you incur usage costs.

## **Integration into an Electron App (Zero Install)**

Given the above options, here’s how you can integrate them into an Electron (or VS Code extension) environment **without any user installation steps**:

-   **Bundling Local Models in Electron:** You can include the model files and a native inference engine within the app package. For example, if using `whisper.cpp`, you’d compile it for Apple Silicon and include the binary (`whisper.cpp.dylib` or a Node addon) plus the `.ggml` model file (e.g. `ggml-large.bin`). The Electron main or renderer process can call the Whisper functions directly (or spawn a process that runs the CLI). Everything runs offline inside the app; the user just downloads the Electron app and it works. This meets the “zero install” requirement – no Homebrew, no compiling on the user side. Whisper.cpp is ideal here because it has **no external dependencies**. It’s essentially plug-and-play on Mac, leveraging Apple’s Accelerate/Metal frameworks which are part of macOS. Hardware-wise, on Apple M1/M2, you get acceleration automatically. Do note the app size will grow significantly if you include a large model (a 1.5GB model will make your app at least that much larger). If that’s an issue, consider smaller models or quantization. Also ensure you handle threading/worker processes so the UI remains responsive during transcription (Whisper can use multiple cores – e.g. transcribing on a background thread).
    
-   **WASM/WebAssembly Approach:** If you prefer a pure JS/TS solution, you can use Transformers.js or similar which loads the model in WASM. The advantage is portability – it runs wherever Electron runs (browser context or Node). The disadvantage is performance: WASM on Apple Silicon cannot yet use the GPU (WebGPU is still experimental in Electron). So you’re effectively running on CPU in a sandbox, which is ~2–5× slower than native C++ code. Still, for smaller models like Whisper-tiny or base, this might achieve near real-time. One example is the Hugging Face `@xenova/transformers` library, which can load Whisper models and transcribe audio entirely in-browser. Integration would involve copying the model weights (or having the library download them at first run) and then using the JS API to pass audio data. This requires no installs, but consider that a Whisper-large model in WASM will likely **not** run in real-time on a laptop CPU – you would use at most Whisper-small or medium in WASM for speed. Also, WASM threads (if using Worker threads) should be enabled to utilize multiple cores.
    
-   **Pre-compiled Binaries for Models:** Some optimized pipelines (faster-whisper, NVIDIA NeMo models) might not have a neat Node integration. In those cases, you can take a pragmatic approach: ship a compiled binary or use an existing CLI tool, and spawn it from your Electron app. For example, you could include a small Python runtime or a compiled C++ CLI for Parakeet. The Electron app, on start, could spawn a background process that listens for audio (maybe via STDIN or a socket) and returns transcripts. The user doesn’t install anything – all binaries are packaged. The downside is the complexity of managing that process and the cross-platform builds (here target is Mac ARM64 specifically, which simplifies it). This approach is commonly used for VS Code extensions that rely on native executables (they bundle the executables for each platform within the extension).
    
-   **Cloud API Integration:** If you go the cloud route, integration is simply making network calls. In an Electron main process you can use Node `https` or in a renderer you can use fetch/XHR (mind CORS if calling directly from renderer). For streaming (Azure, Google, AWS), you’ll likely use WebSockets or the provided SDK. For example, Azure’s npm package can be included; you then call the `SpeechRecognizer` with your key and get events for interim results. This doesn’t require the user to install anything – just your app. You would need to bundle the SDK (which is just an npm dependency). The user *will* need internet, and you must securely store API keys (possibly requiring the user to provide a key or using your own with caution). Cloud integration keeps the app size small and offloads processing, but introduces dependency on connectivity and ongoing costs.
    

**Zero Installation:** All the above methods comply with “zero user installation” because everything is packaged within the Electron application or delivered via cloud. You explicitly mentioned Homebrew/command-line should be avoided – our solutions do that. For local models, we avoid asking the user to install brew or compile anything; we deliver a ready-to-run library. For cloud, the user only needs network access.

**Real-Time Considerations:** Since you emphasized *“only real-time”*, it’s worth noting which setups truly support streaming vs batch. For offline models like Whisper, achieving real-time means processing audio in small increments continuously. Whisper (and MMS, and Canary to an extent) are not streaming by design, but you can simulate it: e.g. record audio in 5-second chunks and run transcription on each chunk with some overlap. There may be slight delays (e.g. you might output text every few seconds) and a small accuracy hit vs full utterance transcription. NVIDIA Parakeet and Vosk are naturally streaming-capable (they produce word results as audio arrives). If real-time, low-latency transcription is critical (like live captions), a model with a streaming decoder (Parakeet or a cloud streaming API) is preferable. Azure, Google, AWS all provide truly streaming transcripts (word-by-word with <1s delay). Speechmatics too is built for real-time. So, for **live transcription** in a VS Code extension, an ideal combo might be: use an offline streaming-capable model (Parakeet via a bundled binary) or call a streaming cloud API, to get instant results. Whisper can be made to work in near-real-time but will output in phrase chunks rather than truly word-by-word live.

**Open-Source Preference:** You indicated a preference for OSS. Among the solutions, Whisper (and its variants), NVIDIA’s models, and MMS are open-source and can run fully offline – aligning with OSS and privacy. Azure/Google/AWS are closed cloud services. If sticking to OSS, I’d recommend **Whisper.cpp** for ease of integration plus either **Whisper-medium** (if you need to fit in CPU real-time) or **Whisper-large** (if maximum accuracy is needed and you can leverage the Apple GPU to accelerate it). If you’re adventurous, **Parakeet 0.6B** is OSS and would give you streaming real-time and great accuracy – but integration will be more work than Whisper.

* * *

**Sources:**

-   OpenAI Whisper paper & HF blog (multilingual baseline, 99 languages).
    
-   HuggingFace Estonian Whisper finetune (WER ~12% on Common Voice Estonian).
    
-   TalTech Whisper-medium-et (WER ~14.7% CV11).
    
-   Speechmatics (Estonian model ~90% accuracy, <1s latency claim).
    
-   HuggingFace Open-ASR Leaderboard insights (Whisper vs distilled vs MMS).
    
-   Distil-Whisper documentation (6.3× faster, ~1% of Whisper WER).
    
-   Faster-Whisper info (~4× faster than original Whisper).
    
-   NVIDIA Granary models paper (Canary & Parakeet performance).
    
-   NVIDIA models on HF (Canary 1B and Parakeet 0.6B support 25 European languages).
    
-   IBM blog on HF leaderboard (Parakeet-TDT 0.6B: WER ~6.05%, extremely high RTFx).
    
-   Whisper.cpp README (Apple Silicon GPU support, no deps, model sizes).
    
-   Vosk Estonian reference (moderate accuracy in browser).
    
-   Azure pricing info (~$1/hr for STT).
    
-   AWS language support (added Estonian, now ~54+ streaming languages).
    

**Citations**

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/blog/open-asr-leaderboard#:~:text=Image%3A%20thumbnail)

[**Open ASR Leaderboard: Trends and Insights with New Multilingual & Long-Form Tracks**](https://huggingface.co/blog/open-asr-leaderboard#:~:text=Image%3A%20thumbnail)

[https://huggingface.co/blog/open-asr-leaderboard](https://huggingface.co/blog/open-asr-leaderboard)

[![](https://www.google.com/s2/favicons?domain=https://www.speechmatics.com&sz=32)](https://www.speechmatics.com/speech-to-text/estonian#:~:text=Image%3A%20estonian%20flagEstonian)

[**Free Estonian Speech to Text | Transcribe Estonian Voice and Audio to Text | Speechmatics**](https://www.speechmatics.com/speech-to-text/estonian#:~:text=Image%3A%20estonian%20flagEstonian)

[https://www.speechmatics.com/speech-to-text/estonian](https://www.speechmatics.com/speech-to-text/estonian)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/TalTechNLP/whisper-large-et#:~:text=Dataset%20WER%20Common%20Voice%208,0)

[**TalTechNLP/whisper-large-et · Hugging Face**](https://huggingface.co/TalTechNLP/whisper-large-et#:~:text=Dataset%20WER%20Common%20Voice%208,0)

[https://huggingface.co/TalTechNLP/whisper-large-et](https://huggingface.co/TalTechNLP/whisper-large-et)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/TalTechNLP/whisper-medium-et#:~:text=WER%20results%20below%20are%20obtained,beam%20size%201)

[**TalTechNLP/whisper-medium-et · Hugging Face**](https://huggingface.co/TalTechNLP/whisper-medium-et#:~:text=WER%20results%20below%20are%20obtained,beam%20size%201)

[https://huggingface.co/TalTechNLP/whisper-medium-et](https://huggingface.co/TalTechNLP/whisper-medium-et)

[![](https://www.google.com/s2/favicons?domain=https://digikogu.taltech.ee&sz=32)](https://digikogu.taltech.ee/et/Download/c11c943b-90e3-4e8e-9852-5d15f23610f9#:~:text=,Extension%20combines%20native%20Estonian)

[**\[PDF\] A Chrome Extension for Real-Time Estonian Speech-to-Text**](https://digikogu.taltech.ee/et/Download/c11c943b-90e3-4e8e-9852-5d15f23610f9#:~:text=,Extension%20combines%20native%20Estonian)

[https://digikogu.taltech.ee/et/Download/c11c943b-90e3-4e8e-9852-5d15f23610f9](https://digikogu.taltech.ee/et/Download/c11c943b-90e3-4e8e-9852-5d15f23610f9)

[![](https://www.google.com/s2/favicons?domain=https://www.reddit.com&sz=32)](https://www.reddit.com/r/LocalLLaMA/comments/1fvb83n/open_ais_new_whisper_turbo_model_runs_54_times/#:~:text=Open%20AI%27s%20new%20Whisper%20Turbo,24s%20Whisper%20Large%20V3%3A)

[**Open AI's new Whisper Turbo model runs 5.4 times faster LOCALLY ...**](https://www.reddit.com/r/LocalLLaMA/comments/1fvb83n/open_ais_new_whisper_turbo_model_runs_54_times/#:~:text=Open%20AI%27s%20new%20Whisper%20Turbo,24s%20Whisper%20Large%20V3%3A)

[https://www.reddit.com/r/LocalLLaMA/comments/1fvb83n/open\_ais\_new\_whisper\_turbo\_model\_runs\_54\_times/](https://www.reddit.com/r/LocalLLaMA/comments/1fvb83n/open_ais_new_whisper_turbo_model_runs_54_times/)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/ggml-org/whisper.cpp#:~:text=Model%20Disk%20Mem%20tiny%2075,3.9%20GB)

[**GitHub - ggml-org/whisper.cpp: Port of OpenAI's Whisper model in C/C++**](https://github.com/ggml-org/whisper.cpp#:~:text=Model%20Disk%20Mem%20tiny%2075,3.9%20GB)

[https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/ggml-org/whisper.cpp#:~:text=Quantization)

[**GitHub - ggml-org/whisper.cpp: Port of OpenAI's Whisper model in C/C++**](https://github.com/ggml-org/whisper.cpp#:~:text=Quantization)

[https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

[![](https://www.google.com/s2/favicons?domain=https://www.assemblyai.com&sz=32)](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js#:~:text=Browser,accelerated%20server%20environments)

[**Offline speech recognition with Whisper: Browser + Node.js implementations**](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js#:~:text=Browser,accelerated%20server%20environments)

[https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js)

[![](https://www.google.com/s2/favicons?domain=https://www.assemblyai.com&sz=32)](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js#:~:text=Create%20a%20new%20file%20src%2Fclient%2FwhisperClient,based%20Whisper%20functionality)

[**Offline speech recognition with Whisper: Browser + Node.js implementations**](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js#:~:text=Create%20a%20new%20file%20src%2Fclient%2FwhisperClient,based%20Whisper%20functionality)

[https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/ggml-org/whisper.cpp#:~:text=recognition%20)

[**GitHub - ggml-org/whisper.cpp: Port of OpenAI's Whisper model in C/C++**](https://github.com/ggml-org/whisper.cpp#:~:text=recognition%20)

[https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/ggml-org/whisper.cpp#:~:text=On%20Apple%20Silicon%2C%20the%20inference,on%20the%20GPU%20via%20Metal)

[**GitHub - ggml-org/whisper.cpp: Port of OpenAI's Whisper model in C/C++**](https://github.com/ggml-org/whisper.cpp#:~:text=On%20Apple%20Silicon%2C%20the%20inference,on%20the%20GPU%20via%20Metal)

[https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

[![](https://www.google.com/s2/favicons?domain=https://sotto.to&sz=32)](https://sotto.to/blog/whisper-cpp-apple-silicon#:~:text=Why%20Whisper,ARM%20NEON)

[**Why Whisper.cpp on Apple Silicon Changes Everything for Voice-to ...**](https://sotto.to/blog/whisper-cpp-apple-silicon#:~:text=Why%20Whisper,ARM%20NEON)

[https://sotto.to/blog/whisper-cpp-apple-silicon](https://sotto.to/blog/whisper-cpp-apple-silicon)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/ggml-org/whisper.cpp#:~:text=,Vulkan%20support)

[**GitHub - ggml-org/whisper.cpp: Port of OpenAI's Whisper model in C/C++**](https://github.com/ggml-org/whisper.cpp#:~:text=,Vulkan%20support)

[https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/ggml-org/whisper.cpp#:~:text=Having%20such%20a%20lightweight%20implementation,device%3A%20whisper.objc)

[**GitHub - ggml-org/whisper.cpp: Port of OpenAI's Whisper model in C/C++**](https://github.com/ggml-org/whisper.cpp#:~:text=Having%20such%20a%20lightweight%20implementation,device%3A%20whisper.objc)

[https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

[![](https://www.google.com/s2/favicons?domain=https://tessl.io&sz=32)](https://tessl.io/registry/tessl/pypi-faster-whisper#:~:text=tessl%2Fpypi,the%20same%20accuracy%20and)

[**tessl/pypi-faster-whisper@1.2.x - Registry**](https://tessl.io/registry/tessl/pypi-faster-whisper#:~:text=tessl%2Fpypi,the%20same%20accuracy%20and)

[https://tessl.io/registry/tessl/pypi-faster-whisper](https://tessl.io/registry/tessl/pypi-faster-whisper)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/TalTechNLP/whisper-large-et#:~:text=Recommended%3A%20use%20faster)

[**TalTechNLP/whisper-large-et · Hugging Face**](https://huggingface.co/TalTechNLP/whisper-large-et#:~:text=Recommended%3A%20use%20faster)

[https://huggingface.co/TalTechNLP/whisper-large-et](https://huggingface.co/TalTechNLP/whisper-large-et)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=The%20result%20is%20a%20distilled,v3%2C%20and)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=The%20result%20is%20a%20distilled,v3%2C%20and)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=The%20distilled%20model%20performs%20to,is%20attributed%20to%20lower%20hallucinations)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=The%20distilled%20model%20performs%20to,is%20attributed%20to%20lower%20hallucinations)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=WER%20between%20these%20labels,we%20keep%20it%20for%20training)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=WER%20between%20these%20labels,we%20keep%20it%20for%20training)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)](https://github.com/huggingface/distil-whisper#:~:text=Distil,)

[**huggingface/distil-whisper - GitHub**](https://github.com/huggingface/distil-whisper#:~:text=Distil,)

[https://github.com/huggingface/distil-whisper](https://github.com/huggingface/distil-whisper)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=%2F%2F%20%7B%20text%3A%20,)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=%2F%2F%20%7B%20text%3A%20,)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=,Whisper%20in%20a%20browser)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=,Whisper%20in%20a%20browser)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=Through%20an%20integration%20with%20Hugging,available%20in%20the%20Rust%20library)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=Through%20an%20integration%20with%20Hugging,available%20in%20the%20Rust%20library)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=%2A%20WASM%20support%3A%20run%20Distil,in%20a%20browser)

[**distil-whisper/distil-large-v3 · Hugging Face**](https://huggingface.co/distil-whisper/distil-large-v3#:~:text=%2A%20WASM%20support%3A%20run%20Distil,in%20a%20browser)

[https://huggingface.co/distil-whisper/distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=This%20report%20introduces%20Canary,tuning.%20For%20timestamps)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=This%20report%20introduces%20Canary,tuning.%20For%20timestamps)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=fast%2C%20robust%20multilingual%20model%20for,with%20an%20auxiliary%20CTC%20model)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=fast%2C%20robust%20multilingual%20model%20for,with%20an%20auxiliary%20CTC%20model)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=As%20is%20seen%20in%20Figure%C2%A010%2C,medium%2C%20and%20in%20fact%20slightly)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=As%20is%20seen%20in%20Figure%C2%A010%2C,medium%2C%20and%20in%20fact%20slightly)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=outperforms%20seamless,powered%20baselines)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=outperforms%20seamless,powered%20baselines)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=Canary,based%20systems)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=Canary,based%20systems)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/blog/open-asr-leaderboard#:~:text=https%3A%2F%2Fhf.co%2Fpapers%2F2510.06961%20,to%20continue%20pushing%20performance)

[**Open ASR Leaderboard: Trends and Insights with New Multilingual & Long-Form Tracks**](https://huggingface.co/blog/open-asr-leaderboard#:~:text=https%3A%2F%2Fhf.co%2Fpapers%2F2510.06961%20,to%20continue%20pushing%20performance)

[https://huggingface.co/blog/open-asr-leaderboard](https://huggingface.co/blog/open-asr-leaderboard)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/blog/open-asr-leaderboard#:~:text=Models%20combining%20Conformer%20encoders%20,can%20significantly%20boost%20ASR%20accuracy)

[**Open ASR Leaderboard: Trends and Insights with New Multilingual & Long-Form Tracks**](https://huggingface.co/blog/open-asr-leaderboard#:~:text=Models%20combining%20Conformer%20encoders%20,can%20significantly%20boost%20ASR%20accuracy)

[https://huggingface.co/blog/open-asr-leaderboard](https://huggingface.co/blog/open-asr-leaderboard)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=We%20also%20release%20Parakeet,languages%20with%20just%20600M%20parameters)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=We%20also%20release%20Parakeet,languages%20with%20just%20600M%20parameters)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=Voxtral,25)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=Voxtral,25)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=Additionally%2C%20the%20companion%200,v3%20%285.8)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=Additionally%2C%20the%20companion%200,v3%20%285.8)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/nvidia/canary-1b-v2#:~:text=nvidia%2Fcanary,translation%20across%2025%20European%20languages)

[**nvidia/canary-1b-v2 - Hugging Face**](https://huggingface.co/nvidia/canary-1b-v2#:~:text=nvidia%2Fcanary,translation%20across%2025%20European%20languages)

[https://huggingface.co/nvidia/canary-1b-v2](https://huggingface.co/nvidia/canary-1b-v2)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3#:~:text=nvidia%2Fparakeet,)

[**nvidia/parakeet-tdt-0.6b-v3 - Hugging Face**](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3#:~:text=nvidia%2Fparakeet,)

[https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)

[![](https://www.google.com/s2/favicons?domain=https://research.ibm.com&sz=32)](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=Model%20Average%20WER%20RTFx%20License,88%20NA%20Proprietary)

[**IBM Granite tops Hugging Face leaderboard - IBM Research**](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=Model%20Average%20WER%20RTFx%20License,88%20NA%20Proprietary)

[https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart)

[![](https://www.google.com/s2/favicons?domain=https://research.ibm.com&sz=32)](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=nvidia%2Fparakeet,2b%206.86%2052.47%20Open)

[**IBM Granite tops Hugging Face leaderboard - IBM Research**](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=nvidia%2Fparakeet,2b%206.86%2052.47%20Open)

[https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart)

[![](https://www.google.com/s2/favicons?domain=https://ai.meta.com&sz=32)](https://ai.meta.com/blog/multilingual-model-speech-recognition/#:~:text=Introducing%20speech,Whisper%20compared%20to%20Massively)

[**Introducing speech-to-text, text-to-speech, and more for ... - AI at Meta**](https://ai.meta.com/blog/multilingual-model-speech-recognition/#:~:text=Introducing%20speech,Whisper%20compared%20to%20Massively)

[https://ai.meta.com/blog/multilingual-model-speech-recognition/](https://ai.meta.com/blog/multilingual-model-speech-recognition/)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/pdf/2305.13516#:~:text=,based%20model%20and%20to)

[**\[PDF\] Scaling speech technology to 1000+ languages - arXiv**](https://arxiv.org/pdf/2305.13516#:~:text=,based%20model%20and%20to)

[https://arxiv.org/pdf/2305.13516](https://arxiv.org/pdf/2305.13516)

[![](https://www.google.com/s2/favicons?domain=https://medium.com&sz=32)](https://medium.com/@bnjmn_marie/metas-mms-better-than-whisper-not-so-sure-484f5159a076#:~:text=1)

[**Meta MMS Better than OpenAI Whisper? Not So Sure… | by Benjamin Marie | Medium**](https://medium.com/@bnjmn_marie/metas-mms-better-than-whisper-not-so-sure-484f5159a076#:~:text=1)

[https://medium.com/@bnjmn\_marie/metas-mms-better-than-whisper-not-so-sure-484f5159a076](https://medium.com/@bnjmn_marie/metas-mms-better-than-whisper-not-so-sure-484f5159a076)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/blog/open-asr-leaderboard#:~:text=That%20said%2C%20focusing%20on%20English,specific%20encoders%20in%20accuracy)

[**Open ASR Leaderboard: Trends and Insights with New Multilingual & Long-Form Tracks**](https://huggingface.co/blog/open-asr-leaderboard#:~:text=That%20said%2C%20focusing%20on%20English,specific%20encoders%20in%20accuracy)

[https://huggingface.co/blog/open-asr-leaderboard](https://huggingface.co/blog/open-asr-leaderboard)

[![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)](https://huggingface.co/blog/open-asr-leaderboard#:~:text=That%20said%2C%20focusing%20on%20English,specific%20encoders%20in%20accuracy)

[**Open ASR Leaderboard: Trends and Insights with New Multilingual & Long-Form Tracks**](https://huggingface.co/blog/open-asr-leaderboard#:~:text=That%20said%2C%20focusing%20on%20English,specific%20encoders%20in%20accuracy)

[https://huggingface.co/blog/open-asr-leaderboard](https://huggingface.co/blog/open-asr-leaderboard)

[**VOSK Models**](https://alphacephei.com/vosk/models#:~:text=%2A%20https%3A%2F%2Fgithub.com%2Falumae%2Fkiirkirjutaja%20,Portuguese%20models%20from%20FalaBrasil%20project)

[https://alphacephei.com/vosk/models](https://alphacephei.com/vosk/models)

[![](https://www.google.com/s2/favicons?domain=https://research.ibm.com&sz=32)](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=And%20now%2C%20at%20the%20time,is%20referred%20to%20as%20RTFx)

[**IBM Granite tops Hugging Face leaderboard - IBM Research**](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=And%20now%2C%20at%20the%20time,is%20referred%20to%20as%20RTFx)

[https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart)

[![](https://www.google.com/s2/favicons?domain=https://research.ibm.com&sz=32)](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=nyrahealth%2FCrisperWhisper%206.67%2084.05%20Open%20ibm,12%20NA%20Proprietary)

[**IBM Granite tops Hugging Face leaderboard - IBM Research**](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart#:~:text=nyrahealth%2FCrisperWhisper%206.67%2084.05%20Open%20ibm,12%20NA%20Proprietary)

[https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart](https://research.ibm.com/blog/granite-speech-recognition-hugging-face-chart)

[![](https://www.google.com/s2/favicons?domain=https://soniox.com&sz=32)](https://soniox.com/compare/soniox-vs-azure#:~:text=Text%2C%20)

[**Soniox vs Azure Speech-to-Text | Accuracy, Features, Pricing (2025)**](https://soniox.com/compare/soniox-vs-azure#:~:text=Text%2C%20)

[https://soniox.com/compare/soniox-vs-azure](https://soniox.com/compare/soniox-vs-azure)

[![](https://www.google.com/s2/favicons?domain=https://learn.microsoft.com&sz=32)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support#:~:text=Learn%20learn,you%20can%20upload%20audio)

[**Language Support - Speech Service - Foundry Tools - Microsoft Learn**](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support#:~:text=Learn%20learn,you%20can%20upload%20audio)

[https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)

[![](https://www.google.com/s2/favicons?domain=https://www.trustradius.com&sz=32)](https://www.trustradius.com/products/azure-ai-speech/pricing#:~:text=Azure%20AI%20Speech%20Pricing%202025,France%2C%20Gabon%2C%20Gambia%2C%20Georgia)

[**Azure AI Speech Pricing 2025 - TrustRadius**](https://www.trustradius.com/products/azure-ai-speech/pricing#:~:text=Azure%20AI%20Speech%20Pricing%202025,France%2C%20Gabon%2C%20Gambia%2C%20Georgia)

[https://www.trustradius.com/products/azure-ai-speech/pricing](https://www.trustradius.com/products/azure-ai-speech/pricing)

[![](https://www.google.com/s2/favicons?domain=https://aws.amazon.com&sz=32)](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/#:~:text=Amazon%20Transcribe%20now%20supports%20streaming,of%20supported%20languages%20to%2054)

[**Amazon Transcribe now supports streaming transcription in 30 ...**](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/#:~:text=Amazon%20Transcribe%20now%20supports%20streaming,of%20supported%20languages%20to%2054)

[https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/)

[![](https://www.google.com/s2/favicons?domain=https://hyscaler.com&sz=32)](https://hyscaler.com/insights/amazon-transcribe-new-ai/#:~:text=Amazon%20Transcribe%20Unleashes%20Its%20Generative,new%20AI%20capabilities%20for%20customers)

[**Amazon Transcribe Unleashes Its Generative AI to Support 100 ...**](https://hyscaler.com/insights/amazon-transcribe-new-ai/#:~:text=Amazon%20Transcribe%20Unleashes%20Its%20Generative,new%20AI%20capabilities%20for%20customers)

[https://hyscaler.com/insights/amazon-transcribe-new-ai/](https://hyscaler.com/insights/amazon-transcribe-new-ai/)

[![](https://www.google.com/s2/favicons?domain=https://brasstranscripts.com&sz=32)](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs#:~:text=Azure%20Speech%20to%20Text%20Pricing,006%2Fmin%29%20for%20batch%20processing)

[**Azure Speech to Text Pricing 2026: $1/Hour Breakdown**](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs#:~:text=Azure%20Speech%20to%20Text%20Pricing,006%2Fmin%29%20for%20batch%20processing)

[https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs)

[![](https://www.google.com/s2/favicons?domain=https://arxiv.org&sz=32)](https://arxiv.org/html/2509.14128v1#:~:text=Voxtral,25)

[**Canary-1B-v2 & Parakeet-TDT-0.6B-v3: Efficient and High-Performance Models for Multilingual ASR and AST**](https://arxiv.org/html/2509.14128v1#:~:text=Voxtral,25)

[https://arxiv.org/html/2509.14128v1](https://arxiv.org/html/2509.14128v1)

[![](https://www.google.com/s2/favicons?domain=https://aws.amazon.com&sz=32)](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/#:~:text=Amazon%20Transcribe%20now%20supports%20streaming,of%20supported%20languages%20to%2054)

[**Amazon Transcribe now supports streaming transcription in 30 ...**](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/#:~:text=Amazon%20Transcribe%20now%20supports%20streaming,of%20supported%20languages%20to%2054)

[https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-transcribe-streaming-transcription-additional-languages/)