/**
 * The presenter view's time of day (decks README, small details item 2): the system's region and 12- or 24-hour
 * choice, as macOS's `defaults` say them. Run: npx tsx src/decks/present/systemClock.test.ts
 */
import { strict as assert } from 'node:assert';
import { clockLocaleOf, localeTagOf, readSystemClock } from './systemClock';

assert.equal(localeTagOf('et_EE'), 'et-EE');
assert.equal(localeTagOf('en_US\n'), 'en-US', "defaults' newline");
assert.equal(localeTagOf('en_US@rg=eezzzz'), 'en-EE', 'English with the region set to Estonia');
assert.equal(localeTagOf('zh-Hans_CN'), 'zh-Hans-CN');
assert.equal(localeTagOf('en'), 'en');
assert.equal(localeTagOf(''), null);
assert.equal(localeTagOf(null), null);
assert.equal(localeTagOf('not a locale!'), null);

assert.deepEqual(clockLocaleOf({ appleLocale: 'en_US', force24: '1\n' }), { locale: 'en-US', hourCycle: 'h23' }, '24-hour time switched on');
assert.deepEqual(clockLocaleOf({ appleLocale: 'et_EE', force12: '1' }), { locale: 'et-EE', hourCycle: 'h12' }, '12-hour time on a 24-hour region');
assert.deepEqual(clockLocaleOf({ appleLocale: 'et_EE', force24: '0', force12: null }), { locale: 'et-EE', hourCycle: null }, "the region's own");
assert.deepEqual(clockLocaleOf({}), { locale: null, hourCycle: null });

async function main(): Promise<void> {
  // Off macOS, the host's own locale; never a failure.
  const other = await readSystemClock('linux');
  assert.equal(other.hourCycle, null);
  assert.equal(typeof other.locale, 'string');
  // On macOS, whatever this Mac says, in the same shape.
  if (process.platform === 'darwin') {
    const mac = await readSystemClock('darwin');
    assert.ok(mac.locale === null || typeof mac.locale === 'string');
    assert.ok(mac.hourCycle === null || mac.hourCycle === 'h12' || mac.hourCycle === 'h23');
  }
  console.log('systemClock: all tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
