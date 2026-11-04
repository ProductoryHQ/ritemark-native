#!/usr/bin/env node
/**
 * settings-timing.mjs - Sprint 147, A1 (#593): each step's median and p90 over the runs in a timing log.
 *
 * Usage: node scripts/qa/settings-timing.mjs [log] [--json <file>]
 *
 * The log is what Ritemark writes when started with RITEMARK_SETTINGS_TIMING=1 (src/settings/settingsTiming.ts):
 * by default `ritemark-settings-timing.log` in the system temp folder, or RITEMARK_SETTINGS_TIMING_FILE.
 * Any file holding the lines works too (an exthost log, a console copy): only `[settings-timing]` lines are read.
 *
 * A run is one Settings panel (created or restored). Each step's ms is since that panel's creation; `page=` on the
 * page's lines is the page's own ms since its navigation started (the script's own load shows there).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const positional = jsonAt >= 0 ? args.filter((_, i) => i !== jsonAt && i !== jsonAt + 1) : args;
const logPath = positional[0]
  ?? process.env.RITEMARK_SETTINGS_TIMING_FILE
  ?? path.join(os.tmpdir(), 'ritemark-settings-timing.log');

if (!fs.existsSync(logPath)) {
  console.error(`No timing log at ${logPath}. Start Ritemark with RITEMARK_SETTINGS_TIMING=1 and open Settings first.`);
  process.exit(2);
}

const LINE = /\[settings-timing\] run=(\d+) step=(\S+) ms=(-?[\d.]+)(?: page=(-?[\d.]+))?/;
const runs = new Map(); // run -> { kind, steps: Map(step -> { ms, page }) }
for (const raw of fs.readFileSync(logPath, 'utf8').split(/\r?\n/)) {
  const m = LINE.exec(raw);
  if (!m) continue;
  const [, run, step, ms, page] = m;
  if (!runs.has(run)) runs.set(run, { kind: 'unknown', steps: new Map() });
  const entry = runs.get(run);
  if (step === 'panel-created' || step === 'panel-restored') entry.kind = step.slice('panel-'.length);
  if (!entry.steps.has(step)) entry.steps.set(step, { ms: Number(ms), page: page === undefined ? null : Number(page) });
}

if (runs.size === 0) {
  console.error(`No [settings-timing] lines in ${logPath}.`);
  process.exit(1);
}

function quantile(sorted, q) {
  if (sorted.length === 0) return NaN;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

function summarize(list) {
  const steps = new Map(); // step -> { ms: [], page: [], firstSeen }
  let order = 0;
  for (const { steps: runSteps } of list) {
    for (const [step, value] of runSteps) {
      if (!steps.has(step)) steps.set(step, { ms: [], page: [], order: order++ });
      steps.get(step).ms.push(value.ms);
      if (value.page !== null) steps.get(step).page.push(value.page);
    }
  }
  return [...steps.entries()]
    .map(([step, v]) => {
      const ms = [...v.ms].sort((a, b) => a - b);
      const page = [...v.page].sort((a, b) => a - b);
      return {
        step,
        runs: ms.length,
        median: quantile(ms, 0.5),
        p90: quantile(ms, 0.9),
        min: ms[0],
        max: ms[ms.length - 1],
        pageMedian: page.length ? quantile(page, 0.5) : null,
      };
    })
    .sort((a, b) => a.median - b.median || a.step.localeCompare(b.step));
}

const fmt = (n) => (n === null || Number.isNaN(n) ? '' : n.toFixed(0));
const groups = { all: [...runs.values()] };
for (const kind of ['created', 'restored']) {
  const list = groups.all.filter((r) => r.kind === kind);
  if (list.length && list.length !== groups.all.length) groups[kind] = list;
}

const report = {};
console.log(`${logPath}: ${runs.size} run(s)`);
for (const [name, list] of Object.entries(groups)) {
  const rows = summarize(list);
  report[name] = { runs: list.length, steps: rows };
  console.log(`\n${name} (${list.length} run${list.length === 1 ? '' : 's'}), ms since the panel's creation`);
  console.log(['step'.padEnd(44), 'n'.padStart(3), 'median'.padStart(8), 'p90'.padStart(8), 'min'.padStart(8), 'max'.padStart(8), 'page med'.padStart(9)].join(' '));
  for (const r of rows) {
    console.log([r.step.padEnd(44), String(r.runs).padStart(3), fmt(r.median).padStart(8), fmt(r.p90).padStart(8), fmt(r.min).padStart(8), fmt(r.max).padStart(8), fmt(r.pageMedian).padStart(9)].join(' '));
  }
}

if (jsonOut) fs.writeFileSync(jsonOut, `${JSON.stringify({ log: logPath, ...report }, null, 2)}\n`);
