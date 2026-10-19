/**
 * Platform-aware external app opening utilities
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as XLSX from 'xlsx';
import { getCurrentPlatform, type Platform } from './platform';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * What opening a file in another app needs from the system. Sprint 134 (W13,
 * confirmations §8): a file's name only ever travels as one item of an argument
 * list, or as a URI handed to the system, never inside a command string a shell
 * reads, so a name with `"`, `$(…)`, `;` or `%…%` stays a name. Injected in tests.
 */
export interface ExternalOpenDeps {
  platform: Platform;
  /** Runs a program with an argument list, without a shell (`child_process.execFile`). */
  execFile: (file: string, args: readonly string[]) => Promise<unknown>;
  /** Hands a file to the system's default app for its type, with no command line (Windows). */
  openWithSystem: (filePath: string) => Promise<void>;
}

/**
 * Windows: the default app for the file, through VS Code's opener (Electron's
 * `shell.openExternal`), which hands the file to the system without a command line.
 */
export async function openFileWithSystem(filePath: string): Promise<void> {
  const opened = await vscode.env.openExternal(vscode.Uri.file(filePath));
  if (!opened) {
    throw new Error('The system did not open the file');
  }
}

function systemDeps(): ExternalOpenDeps {
  return {
    platform: getCurrentPlatform(),
    execFile: (file, args) => execFileAsync(file, [...args]),
    openWithSystem: openFileWithSystem,
  };
}

/** Only an absolute path is passed on, so a file name can never be read as an option. */
function assertAbsolute(filePath: string, platform: Platform): void {
  const isAbsolute = platform === 'win32' ? path.win32.isAbsolute(filePath) : path.posix.isAbsolute(filePath);
  if (!isAbsolute) {
    throw new Error(`Not an absolute path: ${filePath}`);
  }
}

/**
 * Check if an application is installed
 * @param appName - Application name (e.g., 'Microsoft Excel', 'Microsoft Word')
 * @returns true if the app is found
 */
export async function isAppInstalled(appName: string): Promise<boolean> {
  const platform = getCurrentPlatform();

  try {
    if (platform === 'darwin') {
      // macOS: open -Ra checks if app exists without launching it
      await execFileAsync('open', ['-Ra', appName]);
      return true;
    } else if (platform === 'win32') {
      // Windows: check registry for Office installations
      if (appName === 'Microsoft Excel') {
        await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\excel.exe" /ve');
        return true;
      } else if (appName === 'Microsoft Word') {
        await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\winword.exe" /ve');
        return true;
      } else if (appName === 'Microsoft PowerPoint') {
        // Sprint 125: without this, "Open in PowerPoint" showed whether or not it is installed.
        await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\powerpnt.exe" /ve');
        return true;
      }
      // For unknown apps, assume file association will handle it
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Open a file in an external application
 * @param filePath - Absolute path to the file
 * @param appName - Application name (e.g., 'Microsoft Excel', 'Numbers', 'Preview');
 *   used on macOS only. Windows and Linux open the default app for the file's type.
 * @param deps - The system calls; tests inject their own.
 */
export async function openInExternalApp(
  filePath: string,
  appName: string,
  deps: ExternalOpenDeps = systemDeps(),
): Promise<void> {
  assertAbsolute(filePath, deps.platform);

  if (deps.platform === 'darwin') {
    // `open -a <App> <file>`: each an item of the argument list, no shell.
    await deps.execFile('open', ['-a', appName, filePath]);
  } else if (deps.platform === 'win32') {
    // Windows: the default app for this file type, without `cmd /c start`
    // (cmd reads `%name%` and `&` in a file name).
    await deps.openWithSystem(filePath);
  } else {
    // Linux: xdg-open, with the file as its one argument.
    await deps.execFile('xdg-open', [filePath]);
  }
}

/**
 * Open a file with the system's default app for its type (Sprint 124: the
 * Word preview's fallback when neither Word nor Pages is installed).
 */
export async function openWithDefaultApp(
  filePath: string,
  deps: ExternalOpenDeps = systemDeps(),
): Promise<void> {
  if (deps.platform === 'darwin') {
    assertAbsolute(filePath, deps.platform);
    await deps.execFile('open', [filePath]);
  } else {
    // Windows and Linux already open the default app.
    await openInExternalApp(filePath, '', deps);
  }
}

/**
 * Open a CSV file in Excel by converting it to a temporary .xlsx workbook.
 *
 * Why convert instead of opening the .csv directly:
 *   - Locale-dependent delimiter guessing: EU-locale CSVs (semicolon) open as
 *     one column in Excel unless given a `sep=` directive.
 *   - Encoding issues: Mac Excel is unreliable with UTF-8/UTF-16 BOM detection,
 *     producing mojibake like `K‰ive` instead of `Käive` for Estonian chars.
 *
 * Writing an .xlsx via SheetJS sidesteps both problems — .xlsx is a structured
 * binary format, no encoding ambiguity, no delimiter ambiguity. Excel always
 * opens it correctly on all platforms.
 *
 * The temp file is cleaned up after 5s (matches whisperCpp.ts pattern).
 */
export async function openCsvInExcelWithHints(filePath: string, appName: string): Promise<void> {
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  const firstNewline = content.indexOf('\n');
  const firstLine = firstNewline === -1 ? content : content.slice(0, firstNewline);
  if (/^sep=/i.test(firstLine)) {
    content = firstNewline === -1 ? '' : content.slice(firstNewline + 1);
  }

  const scanEnd = content.indexOf('\n');
  const scanLine = scanEnd === -1 ? content : content.slice(0, scanEnd);
  const counts = {
    ',': (scanLine.match(/,/g) || []).length,
    ';': (scanLine.match(/;/g) || []).length,
    '\t': (scanLine.match(/\t/g) || []).length,
  };
  let delimiter: ',' | ';' | '\t' = ',';
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) delimiter = ';';
  else if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) delimiter = '\t';

  // Parse with SheetJS using the detected delimiter, then write as .xlsx.
  const workbook = XLSX.read(content, { type: 'string', raw: true, FS: delimiter });

  const baseName = path.basename(filePath, path.extname(filePath));
  const tempPath = path.join(os.tmpdir(), `ritemark-csv-${Date.now()}-${baseName}.xlsx`);
  XLSX.writeFile(workbook, tempPath, { bookType: 'xlsx' });

  await openInExternalApp(tempPath, appName);

  setTimeout(() => {
    try { fs.unlinkSync(tempPath); } catch { /* best-effort */ }
  }, 5000);
}

/**
 * Get the platform-appropriate spreadsheet app name
 * @param preferExcel - true if Excel is installed
 * @returns Display name for the spreadsheet app
 */
export function getSpreadsheetAppName(preferExcel: boolean): string {
  const platform = getCurrentPlatform();

  if (preferExcel) {
    return 'Microsoft Excel';
  }

  if (platform === 'darwin') {
    return 'Numbers';
  }
  // Windows/Linux: no Numbers equivalent, use generic
  return 'default spreadsheet app';
}

/**
 * Open platform-specific microphone settings
 */
export function openMicrophoneSettings(): void {
  const platform = getCurrentPlatform();

  if (platform === 'darwin') {
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
  } else if (platform === 'win32') {
    exec('start ms-settings:privacy-microphone');
  }
}
