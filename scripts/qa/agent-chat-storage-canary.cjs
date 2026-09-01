#!/usr/bin/env node

/**
 * Destructive Agent Chat storage canary for an isolated RunDev profile.
 *
 * The target workbench title must contain "quota-canary". This guard prevents
 * the script from clearing localStorage in a developer or customer profile.
 */

const { chromium } = require('../../vscode/node_modules/playwright');

const port = Number(process.argv[2] || '9224');
const screenshotPath = process.argv[3] || '/tmp/ritemark-agent-chat-storage-canary.png';

function getOuterWebviewFrame(page) {
  return page.frames().find((frame) => frame !== page.mainFrame());
}

async function waitForAgentChat(page) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const outer = getOuterWebviewFrame(page);
    if (outer) {
      const ready = await outer.evaluate(() => {
        const activeFrame = document.querySelector('#active-frame');
        const body = activeFrame?.contentWindow?.document.body;
        return Boolean(body?.innerText);
      }).catch(() => false);
      if (ready) return outer;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('Agent Chat webview did not become ready within 30 seconds');
}

async function main() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  try {
    const page = browser.contexts()[0]?.pages()[0];
    if (!page) throw new Error(`No workbench page found on CDP port ${port}`);

    const title = await page.title();
    if (!title.includes('quota-canary')) {
      throw new Error(`Refusing destructive storage canary for non-isolated profile: ${title}`);
    }

    const logs = [];
    page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));

    const outer = await waitForAgentChat(page);
    const seeded = await outer.evaluate(() => {
      const activeFrame = document.querySelector('#active-frame');
      const storage = activeFrame.contentWindow.localStorage;
      storage.clear();

      const now = Date.now();
      const metadata = [{
        id: 'legacy-large',
        title: 'Quota canary',
        agentId: 'claude-code',
        createdAt: now,
        updatedAt: now,
      }];
      const record = {
        id: 'legacy-large',
        title: 'Quota canary',
        agentId: 'claude-code',
        createdAt: now,
        updatedAt: now,
        messages: [],
        padding: 'x'.repeat(2_000_000),
      };
      storage.setItem('ritemark-chat-metadata', JSON.stringify(metadata));
      storage.setItem('ritemark-chat-legacy-large', JSON.stringify(record));

      let fillerChunks = 0;
      let quotaError = '';
      for (;;) {
        try {
          storage.setItem(`ritemark-quota-filler-${fillerChunks}`, 'f'.repeat(250_000));
          fillerChunks += 1;
        } catch (error) {
          quotaError = error && typeof error === 'object' && 'name' in error
            ? String(error.name)
            : String(error);
          break;
        }
      }

      return {
        fillerChunks,
        quotaError,
        storageLength: storage.length,
        legacyBytes: storage.getItem('ritemark-chat-legacy-large')?.length || 0,
      };
    });

    if (seeded.quotaError !== 'QuotaExceededError') {
      throw new Error(`Canary did not fill storage to quota: ${JSON.stringify(seeded)}`);
    }

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForAgentChat(page);
    await page.waitForTimeout(4_000);

    const reloadedOuter = await waitForAgentChat(page);
    const state = await reloadedOuter.evaluate(() => {
      const activeFrame = document.querySelector('#active-frame');
      const window = activeFrame.contentWindow;
      const storage = window.localStorage;
      const text = window.document.body.innerText || '';
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index) || '');
      return {
        text: text.slice(0, 1_600),
        fatal: text.includes('Agent Chat could not start'),
        modelVisible: /Sonnet 5|Opus 5|Haiku 4\.5|Fable 5|GPT-5/.test(text),
        storageLength: storage.length,
        legacyBytes: storage.getItem('ritemark-chat-legacy-large')?.length || 0,
        scopedCopies: keys.filter((key) => (
          key.startsWith('ritemark-chat-')
          && key.endsWith('-legacy-large')
          && key !== 'ritemark-chat-legacy-large'
        )),
        migrationMarkers: keys.filter((key) => key.startsWith('ritemark-chat-migrated')),
      };
    });

    const relevantLogs = logs.filter((line) => (
      /QuotaExceeded|chatHistoryStorage|Agent Chat conversations|could not start/i.test(line)
    ));

    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log('SEEDED', JSON.stringify(seeded));
    console.log('STATE', JSON.stringify(state));
    console.log('RELEVANT_LOGS', JSON.stringify(relevantLogs));
    console.log('SCREENSHOT', screenshotPath);

    const failed = (
      state.fatal
      || !state.modelVisible
      || state.legacyBytes !== seeded.legacyBytes
      || state.scopedCopies.length > 0
      || state.migrationMarkers.length > 0
      || relevantLogs.some((line) => /QuotaExceeded/i.test(line))
    );
    if (failed) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
