import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readRitemarkSavedLogicalHash,
  ritemarkSavedLogicalHashSymbol,
} from './saveReceipt';

const VALID_HASH = 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9';

test('reads the shell-provided exact save receipt', () => {
  assert.equal(readRitemarkSavedLogicalHash({
    [ritemarkSavedLogicalHashSymbol]: VALID_HASH,
  }), VALID_HASH);
});

test('missing or malformed receipts stay conservative', () => {
  assert.equal(readRitemarkSavedLogicalHash({}), undefined);
  assert.equal(readRitemarkSavedLogicalHash({ [ritemarkSavedLogicalHashSymbol]: 'not-a-hash' }), undefined);
  assert.equal(readRitemarkSavedLogicalHash({ [ritemarkSavedLogicalHashSymbol]: undefined }), undefined);
});
