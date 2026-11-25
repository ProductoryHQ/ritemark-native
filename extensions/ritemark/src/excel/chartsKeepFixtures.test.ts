// Sprint 174 byte guards and seeded fuzz use this list. Pick an existing non-formula cell
// on a worksheet so the single numeric edit neither appends strings nor drops a calc chain.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const spike = resolve(here, '../../../../docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures');

export const chartsKeepFixtures = [
  { file: resolve(here, 'fixtures/rich-excelish.xlsx'), sheet: 'Budget', ref: 'B3', rows: 25, cols: 9, edits: 200 },
  { file: resolve(here, 'fixtures/rich.xlsx'), sheet: 'Budget', ref: 'B3', rows: 25, cols: 9, edits: 200 },
  { file: resolve(spike, 'sales-report.xlsx'), sheet: 'Sales 2026', ref: 'F5', rows: 34, cols: 7, edits: 200 },
  { file: resolve(here, 'fixtures/excel-174/charts-colours.xlsx'), sheet: 'Theme tints', ref: 'B2', rows: 9, cols: 4, edits: 200 },
  { file: resolve(here, 'fixtures/excel-174/charts-3d.xlsx'), sheet: '3-D column', ref: 'B2', rows: 7, cols: 4, edits: 200 },
  { file: resolve(here, 'fixtures/excel-174/rules-all-kinds.xlsx'), sheet: 'Cell value', ref: 'B2', rows: 9, cols: 6, edits: 200 },
  { file: resolve(here, 'fixtures/excel-174/rules-icons-unreadable.xlsx'), sheet: 'Icon sets', ref: 'B2', rows: 11, cols: 4, edits: 200 },
  { file: resolve(here, 'fixtures/excel-174/charts-all-kinds.xlsx'), sheet: 'Scatter', ref: 'B2', rows: 13, cols: 2, edits: 200 },
  { file: resolve(here, 'fixtures/excel-174/chart-sheet.xlsx'), sheet: 'Data', ref: 'B2', rows: 7, cols: 4, edits: 200 },
];
