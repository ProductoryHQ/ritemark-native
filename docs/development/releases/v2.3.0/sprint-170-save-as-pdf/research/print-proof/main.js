// Throwaway proof (Sprint 170 PR 0, #884): print our own HTML to PDF with Electron, three ways.
// Run: <VS Code's Electron binary> --user-data-dir=<short tmp> <this folder> <outdir>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const out = process.argv[process.argv.length - 1];
  const w = new BrowserWindow({ show: false });
  await w.loadFile(path.join(__dirname, 'page.html'));
  await w.webContents.executeJavaScript('document.fonts.ready.then(() => document.fonts.size)');

  // A: Electron's own API (main process only; would need a patch).
  fs.writeFileSync(path.join(out, 'a-electron-printToPDF.pdf'),
    await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }));

  // B: CDP Page.printToPDF, the message the extension would send through
  // vscode.window.openBrowserTab(...).startCDPSession() (proposed API "browser").
  // Result on Electron 43.8.63: rejects with "'Page.printToPDF' wasn't found" (headful Chromium has no CDP print).
  w.webContents.debugger.attach('1.3');
  try {
    const b = await w.webContents.debugger.sendCommand('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
    fs.writeFileSync(path.join(out, 'b-cdp-printToPDF.pdf'), Buffer.from(b.data, 'base64'));
  } catch (err) {
    console.log('B (CDP Page.printToPDF) failed:', err.message);
  }
  app.quit();
});
