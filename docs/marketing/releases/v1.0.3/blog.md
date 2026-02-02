---
title: 'Ritemark 1.0.3: Voice Dictation That Never Leaves Your Machine'
slug: ritemark-1-0-3-voice-dictation
description: >-
  Ritemark now includes fully local speech-to-text powered by whisper.cpp.
  Dictate in Estonian or 50+ languages without any data leaving your computer.
date: '2026-01-23'
category: tooted
image: /images/blog/ritemark-1-0-3-voice-dictation.avif
author: jarmo-tuisk
featured: true
lang: en
tags:
  - ritemark
  - release
  - voice-dictation
  - privacy
  - local-first
---
# Voice Dictation That Never Leaves Your Machine

Ritemark v1.0.3 ships with a feature I have wanted to build for a long time: voice dictation that runs entirely on your computer.

No cloud. No API calls. No data sent anywhere. Just your voice, transcribed locally by whisper.cpp.

## Why Local Speech-to-Text?

Most writing tools with voice input do the same thing: record your audio, send it to a server, wait for the transcription to come back. It works, but it means your raw audio - every word you speak, every pause, every background sound - passes through someone else's infrastructure.

For private writing, that is a non-starter. Journal entries, client notes, sensitive drafts - these should not travel through the internet just to convert speech to text.

So we bundled whisper.cpp directly into Ritemark.

## How It Works

Click the mic button in the toolbar. Start speaking. Your words appear in real-time.

That is it. No setup wizards, no account creation, no API keys to manage.

Under the hood, Ritemark uses whisper.cpp - a C/C++ port of OpenAI's Whisper model - compiled natively for Apple Silicon. The first time you use voice dictation, it downloads a language model (~244MB). After that, everything works offline.

The transcription happens on your Mac's hardware. Your audio stays in memory, gets processed locally, and the text goes straight into your document.

## Estonian-First, 50+ Languages

Ritemark started as an Estonian writing tool, so Estonian language support was the priority. The Whisper model handles Estonian well - not perfectly, but remarkably well for a model that runs locally without internet.

Beyond Estonian, the same model supports 50+ languages. Switch between them as needed. The model handles multiple languages without downloading additional files.

## Real-Time Streaming

One detail that makes a big difference: text appears as you speak, not after you stop.

Many dictation tools wait for you to finish a sentence or pause, then dump a block of text. Ritemark streams the transcription in real-time, so you see words appearing as you say them. This makes it feel natural - more like typing than batch processing.

## Privacy by Design

This is not just about checking a privacy box. Local processing means:

-   **Works offline.** No internet? No problem. Dictate on a plane, in a cabin, anywhere.
    
-   **No audio leaves your machine.** Your voice data is processed in memory and never written to disk or transmitted.
    
-   **No account required.** No sign-up, no login, no terms of service to agree to.
    
-   **No usage limits.** Dictate as much as you want. There is no API quota, no per-minute billing.
    

## Getting Started

1.  Update to Ritemark v1.0.3 (download from ritemark.ee)
    
2.  Open Settings and enable Voice Dictation (it is experimental, so opt-in for now)
    
3.  Click the mic button in any markdown document
    
4.  On first use, the Whisper model downloads (~244MB)
    
5.  Start speaking
    

The feature is currently marked as experimental. We want feedback before making it a default. If something does not work as expected, let us know.

## Also in This Release

### Copy as Markdown

New Export menu option: copy your document (or selected text) as clean markdown. Useful for pasting into GitHub, emails, or any other tool that understands markdown.

### Properties Dialog Fix

Documents with many frontmatter properties (15+) no longer overflow the Properties dialog. The content scrolls properly now.

## What is Next

Voice dictation is the foundation for more local AI features in Ritemark. The same philosophy - powerful, private, no cloud required - will guide what we build next.

Download Ritemark v1.0.3: [ritemark.ee](https://ritemark.ee)
