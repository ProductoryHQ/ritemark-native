# Bundle size (E4)

| When | `media/webview.js` bytes |
|---|---|
| Before the sprint (`origin/main` 13cc6fb0; PR 1 changes no webview code) | 8,818,051 |
| PR 3, before (`origin/main` bedd5f77) | 8,831,469 |
| PR 3, after (the Publish sheet, two icons) | 8,847,739 (+16,270) |
| PR 3, round 2 (left-out names, links, the default button's ring) | 8,849,074 (+1,335) |
| PR 4 (`sprint-149-publish-cloudflare`, round 1, on `origin/main` bedd5f77) | 8,831,469 / 8,835,635 (+4,166: the Web pages card) |
| PR 4, round 2 (on `origin/main` bd34fb58, after PR 3's 8,849,081 as built there) | 8,849,081 / 8,860,844 (+11,763: frame 2, the name row, the address field, the cloud icon) |
