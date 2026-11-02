# Measurements (E1)

PR 1's measurements: **M1** (the index's time and memory) and **M3** (the host during a cold index), on the Mac. M2, M4, M5 and M6 need the results view and are PR 2's. Windows (M1 with Defender) is the overlay session's.

## How they were made

- **The folders:** `scripts/qa/search-fixture.mjs` writes them under `/private/tmp`, from a seeded generator over a made-up vocabulary with Estonian letters, and Word and PDF files made by the extension's own `docx` and `pdfkit`. No client material. **The plan's folder** (`--scale 1`): 10,000 Markdown files in nested folders, 300 Word files, 300 PDFs (1–40 pages), 200 CSV files (50–2,000 rows), 20 scanned-style PDFs, and what search leaves out (`node_modules`, `.ritemark`, `.claude`, `.git`, an ignored `build/`, `.git/info/exclude`): 12,074 files, 43.2 MB, of which 10,821 are documents. **Twice the size** (`--scale 2`): 24,144 files, 86.4 MB, 21,641 documents, past the 20,000 documents limit.
- **The run:** `scripts/qa/search-measure.mjs` starts the built worker (`out/search/searchWorker.js`) in a worker thread with the host's heap cap (512 MB) and talks to it over the protocol, as `SearchHost` does. A cold start (decision 3's copies emptied), then a warm one that finds them. While the worker reads, this thread sends a query every 100 ms, as someone typing would; once it is ready, 200 queries of 1–3 word starts (2–7 letters) taken from the folder's own text.
- **The host's delay (M3):** `monitorEventLoopDelay` at 10 ms in the thread that talks to the worker, from the start to ready. It records whole intervals between its timer's ticks, so the 10 ms is taken off; an idle baseline of the same thread is beside it.
- **Where:** Node 22.22.1, darwin-arm64 (Apple silicon), 2 November 2026, on `sprint-148-search-words`. Once more inside a worker thread of an Electron utility process (the kind of process the extension host is), the main checkout's dev Electron 39.8.7, for the plan's folder.

## Results

Times are from the worker's start. "Searchable" means the words inside, not only the names.

### The plan's folder (10,821 documents, 37.4 MB of text, 146,220 terms)

The final runs are on the PR's head after its review round (2 November), whose fixes read two files ahead instead of eight and check a Word file without inflating its pictures.

| | Target (E1) | Cold | Warm (copies) | |
|---|---|---|---|---|
| Every name searchable | — | 0.36 s | 0.20 s | |
| Markdown and CSV searchable | cold ≤ 15 s | **3.5 s** | 3.1 s | met |
| Word and PDF read (620) | reported | 5.2 s | 3.4 s (620 copies used) | |
| Warm start searchable | ≤ 3 s | — | names 0.20 s; Markdown and CSV **3.06 s** (2.9–3.1 s over five runs) | **at the edge** |
| The worker's query, after reading | p95 ≤ 15 ms | p50 4.4, **p95 9.0**, max 10.4 ms | p50 3.8, p95 8.1 ms | met |
| A query while it reads (round trip) | — | p50 7.9, p95 20.5, max 97 ms | p50 8.2, p95 50, max 141 ms | reported |
| The worker's heap at its peak | cap 512 MB | 293 MB | 259 MB | |
| The host's delay while it reads (M3) | p95 ≤ 20 ms | p50 1.4, **p95 2.1**, max 7.0 ms | p95 2.0 ms | met; idle p95 2.1 ms |
| Decision 3's copies | ≤ 200 MB | 620 written, 4.3 MB | 620 used | |

In the Electron utility process (before the review round's fixes): ready in 4.7 s, Markdown and CSV at 2.6 s, heap 210 MB at the end, the utility thread's delay p95 5.1 ms (no idle baseline there).

### Twice the size (21,641 documents, 19,960 read inside, 71.8 MB of text)

| | Target | Cold | Warm |
|---|---|---|---|
| Every name searchable | — | 0.67 s | 0.39 s |
| Markdown and CSV searchable | ≤ 15 s | 5.9 s | 5.5 s |
| Word and PDF read (1,240) | reported | 10.1 s | 6.4 s |
| Warm start searchable | ≤ 3 s | — | names 0.39 s; text **5.5 s: missed** |
| The worker's query, after reading | p95 ≤ 15 ms | p95 **15.2 ms: missed** (max 16.7) | p95 14.0 ms |
| Heap at its peak | 512 MB | 438 MB | 406 MB |
| The host's delay (M3) | p95 ≤ 20 ms | p95 2.0 ms | p95 2.0 ms |

## What M1 changed

- **The text kept in all: 80 MB, not 200 MB** (spec R1 changed first). The heap grows about 3.2 MB for each MB of text above a base of ~175 MB (293–328 MB at 37 MB, 438–440 MB at 72 MB), so 200 MB of text would need about 815 MB against the 512 MB cap. At 80 MB the peak is about 430–460 MB. Chats' words share the 80 MB, at most a quarter of it (the review round: a project with many long chats would otherwise pass the cap). A worker that still stops at the cap starts once more with half the limits (R4).
- **The documents limit goes to the newest of every kind.** The first run at twice the size showed every Word file and PDF searched by name only: Markdown and CSV are read first, and spent the 20,000 before the Office files had their turn. The walk now shares the 20,000 out newest first across the four kinds before anything is read (`freshness.test.ts`).
- **Speed** (the first runs missed the query target: p95 42 ms): the passages' words are looked up in a byte per term rather than a `Set`; the order's keys are worked out once per result; a character loop replaced the Unicode regular expression for words (the same words, checked against it on 2,000 random strings: 304 → 71 ms for 2.5 million words); Markdown and CSV are read ahead of the file being parsed. That took the warm start from 5.0 to 2.9–3.1 s. The review round cut the read-ahead from eight files to two, since file reads run on the thread pool the extension host shares, and the warm start stayed at 3.06 s.

## For the Development manager

Two targets are missed past the plan's folder, and one is at its edge on it:

1. **A warm start in 3 s.** Met at the edge on the plan's folder (2.9–3.1 s), missed at twice the size (5.5 s). The cause is decision 3 as approved: only Word and PDF text is kept between starts, and Markdown and CSV are read again, which is 10,200 files on the plan's folder. Names are searchable within 0.4 s in every case, and the words inside follow as they are read. Choices: accept it (names at once, words in seconds); keep copies of Markdown and CSV text too, which changes decision 3 (their copies would cost about 40 MB on disk for the plan's folder); or later, an index kept on disk.
2. **The query's 95th percentile past 20,000 documents:** 15.2 ms cold (16.6 ms on the run before), 14.0 ms warm, against 15 ms. Within the target on the plan's folder (9.0 ms). The widest queries are two- and three-word starts of the commonest words, which match nearly every document; the slowest part left is ordering a few thousand candidates.

A query while the index is still reading waits for the file in hand: p95 20–50 ms, at worst 0.1–0.3 s (a large CSV, a garbage collection). E1's targets are for the index once read; PR 2's M2 measures the key-to-paint time.

## Not measured here

- Windows (M1 with Defender scanning; A4's OneDrive case): the overlay session.
- The extension host itself, in a dev instance: the harness talks to the worker over the same protocol as `SearchHost`, and the Electron probe ran the real worker in a utility process, but the host's other work (the AIs' turns) wasn't running beside it. PR 2's M4 checks the start with the index on and off.
