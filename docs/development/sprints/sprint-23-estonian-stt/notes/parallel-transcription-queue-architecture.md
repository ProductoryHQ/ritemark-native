# Parallel Audio Transcription Queue Architecture

**Date:** 2025-01-20
**Status:** Research Complete - Design Document
**Sprint:** 23 - Estonian STT

---

## Problem Statement

Current pseudo-streaming implementation processes audio chunks sequentially:

```
Time:    0s      3s      6s      9s
Audio:   [chunk1][chunk2][chunk3][chunk4]
               |       |       |
               v       v       v
Process:    [~2s]   [~2s]   [~2s]   <- Sequential, each waits for previous
               |       |       |
               v       v       v
Output:  "Hello" "my name" "is Jarmo"
```

**Problem**: If transcription takes 2s and chunks arrive every 3s, we're always 2s behind. With longer audio or slower processing, the lag compounds.

**Question**: Can we parallelize transcription to reduce latency?

---

## Research Summary

### Current Whisper Approaches

| Approach | Latency | Accuracy | Complexity |
|----------|---------|----------|------------|
| **Sequential chunks** (current) | 2-3s per chunk | Good | Low |
| **Parallel workers** | ~1s per chunk | Good | Medium |
| **WhisperStreaming** | 200-500ms | Lower | High |
| **Batched parallel** | Best for bulk | Best | Medium |

### Key Findings

1. **Whisper pads all audio to 30 seconds internally** - short chunks cause hallucinations due to padding
2. **GPU memory is the limiting factor** - can't run unlimited parallel transcriptions
3. **VAD (Voice Activity Detection)** - smarter chunking at sentence boundaries improves accuracy
4. **faster-whisper** - CTranslate2 implementation is 4x faster than original
5. **Speculative decoding** - WhisperKit achieves real-time on Apple Silicon

---

## Architecture Options

### Option 1: Worker Pool (Recommended for Ritemark)

```
           +-----------------+
           |  Audio Stream   |
           +-----------------+
                   |
                   v
           +-----------------+
           |  Chunk Buffer   |  <- Accumulates 3-second chunks
           |  (In-Memory)    |
           +-----------------+
                   |
        +----------+----------+
        |          |          |
        v          v          v
   [Worker 1] [Worker 2] [Worker 3]   <- Parallel whisper processes
        |          |          |
        v          v          v
   "Hello"    "my name"  "is Jarmo"
        |          |          |
        +----------+----------+
                   |
                   v
           +-----------------+
           |  Result Queue   |  <- Reorders by chunk sequence number
           +-----------------+
                   |
                   v
           +-----------------+
           |  Text Output    |  <- Ordered transcription
           +-----------------+
```

**How it works:**
1. Audio chunks arrive every 3 seconds, tagged with sequence number
2. Worker pool (2-3 workers) processes chunks in parallel
3. Results are reordered by sequence number before output
4. Text appears faster because multiple chunks process simultaneously

**Pros:**
- Reduces effective latency by parallelism factor
- Simple to implement with Node.js worker threads or process pool
- Works with existing whisper.cpp binary
- GPU can handle 2-3 parallel small model instances

**Cons:**
- Higher memory usage (multiple model instances)
- Need to handle out-of-order results
- Diminishing returns beyond 2-3 workers (GPU contention)

**Implementation complexity:** Medium

---

### Option 2: Redis Queue + Workers

```
+-----------+     +-----------+     +-----------+
|  Webview  | --> |   Redis   | <-- |  Workers  |
|  (audio)  |     |  (queue)  |     |  (N procs)|
+-----------+     +-----------+     +-----------+
                        |
                        v
                  +-----------+
                  |  Results  |
                  |  Channel  |
                  +-----------+
                        |
                        v
                  +-----------+
                  |  VS Code  |
                  |  Webview  |
                  +-----------+
```

**Pros:**
- Scales to multiple machines
- Persistent queue survives crashes
- Standard pattern, well-documented

**Cons:**
- Overkill for local desktop app
- Adds Redis dependency
- Network latency between components

**Verdict:** Too heavy for Ritemark's use case.

---

### Option 3: WhisperStreaming (Local Segmentation)

```
Audio Stream --> VAD --> [segment1] --> Whisper --> "Hello"
                    --> [segment2] --> Whisper --> "my name"
                    --> [segment3] --> Whisper --> "is Jarmo"
```

Uses Voice Activity Detection to segment at natural pauses:
- Silero VAD detects speech boundaries
- Segments are complete sentences/phrases
- Better accuracy than fixed-time chunks

**Pros:**
- Better transcription accuracy (complete sentences)
- More natural text output
- Can be combined with parallel processing

**Cons:**
- Requires VAD model (additional dependency)
- Variable latency (waits for speech pause)
- More complex audio pipeline

**Implementation complexity:** High

---

### Option 4: Speculative/Streaming Decoding

Approaches like **WhisperKit** or **whisper.cpp streaming mode** that produce tokens as they're decoded.

**Pros:**
- True real-time experience (200-500ms latency)
- No chunking artifacts

**Cons:**
- whisper.cpp streaming is experimental and unstable
- WhisperKit is Swift-only (not usable from Node.js easily)
- Lower accuracy than batch processing
- Requires model fine-tuning for best results

**Verdict:** Not mature enough for production use.

---

## Recommended Design for Ritemark

### Phase 1: Simple Parallel Workers (Low Effort, High Impact)

Implement a worker pool with 2 whisper processes:

```typescript
// Simplified architecture
class TranscriptionPool {
  private workers: WhisperWorker[] = [new WhisperWorker(), new WhisperWorker()]
  private queue: AudioChunk[] = []
  private results: Map<number, string> = new Map()
  private nextToOutput: number = 0

  async processChunk(chunk: AudioChunk): Promise<void> {
    const worker = await this.getAvailableWorker()
    const text = await worker.transcribe(chunk.audio, chunk.language)
    this.results.set(chunk.sequence, text)
    this.flushOrderedResults()
  }

  private flushOrderedResults(): void {
    while (this.results.has(this.nextToOutput)) {
      const text = this.results.get(this.nextToOutput)!
      this.emit('transcription', text)
      this.results.delete(this.nextToOutput)
      this.nextToOutput++
    }
  }
}
```

**Expected improvement:**
- Current: 2s transcription per 3s chunk = ~66% real-time
- With 2 workers: 2s transcription / 2 workers = ~1s effective latency
- Result: Text appears ~1 second faster

### Phase 2: VAD-Based Chunking (Future Enhancement)

Add Silero VAD to detect speech boundaries:

1. Continue collecting audio samples
2. Run VAD to detect end of speech
3. When pause detected, send complete utterance for transcription
4. Results are natural sentences instead of cut-off phrases

**Benefits:**
- "Hello my name is" instead of "Hello my na" | "me is"
- Better accuracy (complete context)
- More natural reading experience

### Phase 3: faster-whisper Integration (Future)

Replace whisper.cpp with faster-whisper (Python CTranslate2):

- 4x faster inference
- Lower memory usage
- Same accuracy
- Better GPU utilization

**Consideration:** Requires Python runtime, adds deployment complexity.

---

## Implementation Considerations

### Memory Management

Each whisper.cpp process with large-v3-turbo model uses:
- ~1.5GB model loading
- ~500MB runtime memory
- Total: ~2GB per worker

**Recommendation:** Limit to 2 workers on 16GB machines, 3 workers on 32GB+

### GPU Contention

Apple Metal can handle 2-3 concurrent whisper processes:
- Beyond 3, processes compete for GPU memory
- Performance degrades instead of improving
- Monitor GPU utilization to find optimal worker count

### Error Handling

```typescript
// Retry logic for failed chunks
async processWithRetry(chunk: AudioChunk, maxRetries = 2): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await this.transcribe(chunk)
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed, retrying...`)
      if (attempt === maxRetries - 1) {
        return '' // Skip chunk rather than fail entire recording
      }
    }
  }
  return ''
}
```

### Ordering Guarantees

Results must be output in order even if processed out of order:

```typescript
// Simple ordering with sequence numbers
const pendingResults: Map<number, string> = new Map()
let nextSequence = 0

function onTranscriptionComplete(sequence: number, text: string) {
  pendingResults.set(sequence, text)

  // Flush all consecutive results
  while (pendingResults.has(nextSequence)) {
    output(pendingResults.get(nextSequence)!)
    pendingResults.delete(nextSequence)
    nextSequence++
  }
}
```

---

## Cost-Benefit Analysis

| Approach | Dev Effort | Latency Reduction | Risk |
|----------|------------|-------------------|------|
| **2-Worker Pool** | 2-3 days | ~50% | Low |
| VAD Chunking | 1 week | Variable (better UX) | Medium |
| faster-whisper | 1 week | ~75% | Medium |
| Full streaming | 2+ weeks | ~90% | High |

**Recommendation:** Start with 2-Worker Pool for immediate gains, evaluate VAD for v2.

---

## Decision Points for Jarmo

1. **Parallel workers - proceed?**
   - Yes: Implement 2-worker pool
   - No: Keep sequential (current implementation)

2. **Priority vs other sprint work?**
   - High: Implement in Sprint 23
   - Medium: Plan for Sprint 24
   - Low: Add to wishlist

3. **Memory trade-off acceptable?**
   - 2 workers = ~4GB RAM for transcription
   - 3 workers = ~6GB RAM for transcription
   - Current = ~2GB RAM

---

## References

- [whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - CTranslate2 implementation
- [WhisperStreaming](https://github.com/ufal/whisper_streaming) - Local agreement streaming
- [Silero VAD](https://github.com/snakers4/silero-vad) - Voice Activity Detection
- [Modal parallel processing](https://modal.com/docs/examples/whisper-transcriber) - Cloud parallel example
- [WhisperKit](https://github.com/argmaxinc/WhisperKit) - Apple Silicon optimized

---

## Appendix: Current vs Proposed Flow

### Current (Sequential)

```
t=0s   [Record chunk 1]
t=3s   [Record chunk 2] | [Transcribe chunk 1: 2s]
t=5s   Output: "Hello"  | [Record chunk 2 continues]
t=6s   [Record chunk 3] | [Transcribe chunk 2: 2s]
t=8s   Output: "my name" | [Record chunk 3 continues]
...
```

Total latency per chunk: 3s (recording) + 2s (transcription) = 5s

### Proposed (2-Worker Parallel)

```
t=0s   [Record chunk 1]
t=3s   [Record chunk 2] | [Worker 1: chunk 1]
t=5s   Output: "Hello"  | [Record chunk 2]
t=6s   [Record chunk 3] | [Worker 2: chunk 2] | [Worker 1: idle]
t=8s   Output: "my name" | [Worker 1: chunk 3] | [Worker 2: idle]
...
```

With overlap, effective latency: 3s (recording) + 1s (parallel processing) = 4s

**Improvement:** 1 second faster per chunk (20% reduction)
