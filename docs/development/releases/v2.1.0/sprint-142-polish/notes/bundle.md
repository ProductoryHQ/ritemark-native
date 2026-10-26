# Sprint 142: the bundle (E2)

| When | media/webview.js |
|---|---|
| Before (main at 84ea15db) | 8,712,915 bytes |
| After merge 1 | 8,720,135 bytes (+7,220) |
| After merge 1's QA follow-up (N1, N2, N3) | 8,720,526 bytes (+391); office-preview.js unchanged |
| After merge 2 (the path's folder alone, the cut button's tooltip, Open in Excel, the tooltip's width), on 72f509e8 | 8,721,072 bytes (+546); office-preview.js 2,613,124 → 2,613,241 (it shares `ui/tooltip.tsx`) |
| Merge 2 rebuilt on 5019e42b (Sprint 143 merged), from the merged sources | 8,725,004 bytes; office-preview.js 2,613,241 |

The shared split button, the note's timer, the measured path, the scroll mark and their CSS. office-preview.js changes too: it shares ViewerToolbar and ui/tooltip.
