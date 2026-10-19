/**
 * Ritemark 2.0's themes are readable (Sprint 132, R13): in Ritemark Light and Ritemark Dark, text on each of the
 * three levels (the ground, the AI's sheet, the desk) and the fine print reach 4.5:1; the places' icons reach 3:1
 * (WCAG 1.4.3 and 1.4.11). The levels are the themes' own colours, which must match the `ritemark.*` surface colours
 * in package.json.
 *
 * Sprint 134 (R24): the eight agent colours (`ritemark.agentColor.*`, one per colour the agent's Color field offers)
 * reach 3:1 on the column's ground, and on the desk an open row lies on, in Light, Dark and high contrast.
 *
 * Run: npx tsx src/themeContrast.test.ts
 */

import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AGENT_COLORS } from './agent/iconPack';

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  contributes: { colors: Array<{ id: string; defaults: Record<string, string> }> };
};

type Rgb = [number, number, number];

/** A #RRGGBB or #RRGGBBAA colour over an opaque one. */
function over(colour: string, surface: Rgb): Rgb {
  const hex = colour.replace('#', '');
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return rgb.map((c, i) => c * alpha + surface[i] * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(text: string, surface: string): number {
  const back = over(surface, [255, 255, 255]);
  const [a, b] = [luminance(over(text, back)), luminance(back)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}

const themes = [
  { file: 'ritemark-light.json', kind: 'light' },
  { file: 'ritemark-dark.json', kind: 'dark' },
];

/** What each level carries, as theme keys; every one must read at 4.5:1 on its level. */
const TEXT_ON = {
  ground: ['foreground', 'sideBar.foreground', 'sideBarSectionHeader.foreground', 'sideBarTitle.foreground', 'tab.inactiveForeground', 'statusBar.foreground', 'descriptionForeground'],
  aiSheet: ['foreground', 'descriptionForeground'],
  desk: ['foreground', 'editor.foreground', 'tab.activeForeground', 'descriptionForeground'],
};

/** The places' icons, at 3:1 on the ground (and the chosen one on its fill). */
const ICONS_ON_GROUND = ['activityBar.foreground', 'activityBar.inactiveForeground'];

let failures = 0;
function test(name: string, run: () => void): void {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(error as Error).message.split('\n').join('\n    ')}`);
  }
}

for (const { file, kind } of themes) {
  const colors = (JSON.parse(fs.readFileSync(path.join(root, 'themes', file), 'utf8')) as { colors: Record<string, string> }).colors;
  const surface = (id: string) => pkg.contributes.colors.find(colour => colour.id === `ritemark.${id}`)!.defaults[kind];
  const levels = { ground: surface('ground'), aiSheet: surface('aiSheet'), desk: surface('desk') };

  console.log(file);

  test('the levels are the surface colours', () => {
    assert.deepEqual(
      { ground: colors['sideBar.background'].toUpperCase(), desk: colors['editor.background'].toUpperCase() },
      { ground: levels.ground.toUpperCase(), desk: levels.desk.toUpperCase() },
    );
  });

  test('text on each level, and the fine print, reach 4.5:1', () => {
    const low: string[] = [];
    for (const [level, keys] of Object.entries(TEXT_ON) as Array<[keyof typeof levels, string[]]>) {
      for (const key of keys) {
        if (!colors[key]) {
          low.push(`${key} is not set`);
          continue;
        }
        const ratio = contrast(colors[key], levels[level]);
        if (ratio < 4.5) {
          low.push(`${key} ${colors[key]} on the ${level} ${levels[level]}: ${ratio}`);
        }
      }
    }
    assert.deepEqual(low, []);
  });

  test('the places\' icons reach 3:1 on the ground, and the chosen one on its fill', () => {
    const low = ICONS_ON_GROUND
      .map(key => ({ key, ratio: contrast(colors[key], levels.ground) }))
      .filter(({ ratio }) => ratio < 3)
      .map(({ key, ratio }) => `${key}: ${ratio}`);
    const fill = over(surface('placeActiveBackground'), over(levels.ground, [255, 255, 255]));
    const chosen = contrast(surface('placeActiveForeground'), `#${fill.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`);
    assert.deepEqual({ low, chosenAtLeast3: chosen >= 3 }, { low: [], chosenAtLeast3: true }, `chosen place ${chosen}`);
  });

  test('the eight agent colours reach 3:1 on the ground, and on an open row\'s desk', () => {
    assert.deepEqual(agentColourLows(kind, { ground: levels.ground, desk: levels.desk }), []);
  });
}

console.log('the agent colours');

test('one agent colour per colour the Color field offers, each with light, dark and high-contrast values', () => {
  const ids = pkg.contributes.colors.map(colour => colour.id).filter(id => id.startsWith('ritemark.agentColor.'));
  assert.deepEqual([...ids].sort(), AGENT_COLORS.map(name => `ritemark.agentColor.${name}`).sort());
  for (const name of AGENT_COLORS) {
    for (const kind of ['light', 'dark', 'highContrast', 'highContrastLight']) {
      assert.match(colourDefault(`agentColor.${name}`, kind) ?? '', /^#[0-9A-Fa-f]{6}$/, `agentColor.${name} has no opaque ${kind} value`);
    }
  }
});

test('in high contrast, the eight agent colours reach 3:1 on the ground', () => {
  const low = ['highContrast', 'highContrastLight'].flatMap(kind => agentColourLows(kind, { ground: colourDefault('ground', kind)! }));
  assert.deepEqual(low, []);
});

/** A `ritemark.*` colour's default for a theme kind. */
function colourDefault(id: string, kind: string): string | undefined {
  return pkg.contributes.colors.find(colour => colour.id === `ritemark.${id}`)?.defaults[kind];
}

/** Each agent colour under 3:1 on one of the given levels, or missing, as a line. */
function agentColourLows(kind: string, on: Record<string, string>): string[] {
  const low: string[] = [];
  for (const name of AGENT_COLORS) {
    const value = colourDefault(`agentColor.${name}`, kind);
    if (!value) {
      low.push(`agentColor.${name} has no ${kind} value`);
      continue;
    }
    for (const [level, surface] of Object.entries(on)) {
      const ratio = contrast(value, surface);
      if (ratio < 3) {
        low.push(`agentColor.${name} ${value} on the ${kind} ${level} ${surface}: ${ratio}`);
      }
    }
  }
  return low;
}

if (failures) {
  console.error(`\n${failures} failing`);
  process.exit(1);
}
console.log('\nAll theme contrast tests passed');
