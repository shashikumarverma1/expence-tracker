// Example test cases for the ledger reducer, written in Jest style.
// No test runner is currently configured in this project — to actually run
// this file, add Jest (`npx expo install jest jest-expo @types/jest` and a
// `"test": "jest"` script per Expo's testing guide) or wire it into your
// preferred runner. Until then, treat this file as executable documentation
// of the invariants handleTransaction must uphold.
import { getNetWorth, handleTransaction } from './ledger';
import { EMPTY_LEDGER_STATE, LedgerState } from './types';

// Minimal describe/it/expect shim so this file can also be sanity-checked
// with plain `node` (after compiling) when Jest isn't set up yet — Jest's
// own globals take over transparently once the project has Jest installed.
declare const describe: any, it: any, expect: any;

const seedState: LedgerState = { ...EMPTY_LEDGER_STATE, cash: 10000 };

describe('ledger', () => {
  it('BUY_ASSET: net worth is unchanged (cash -> asset reallocation)', () => {
    const before = getNetWorth(seedState);
    const after = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    expect(getNetWorth(after)).toBe(before);
    expect(after.cash).toBe(seedState.cash - 3000);
    expect(after.assets.find((a) => a.name === 'HDFC Bond')?.value).toBe(3000);
  });

  it('BUY_ASSET: buying the same asset twice adds to one entry, not two', () => {
    let state = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    state = handleTransaction(state, 'BUY_ASSET', {
      assetName: 'hdfc bond', assetType: 'bond', amount: 2000, // case-insensitive match
    });
    const bonds = state.assets.filter((a) => a.name.toLowerCase() === 'hdfc bond');
    expect(bonds.length).toBe(1);
    expect(bonds[0].value).toBe(5000);
  });

  it('SELL_ASSET: net worth is unchanged (asset -> cash reallocation)', () => {
    const withBond = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    const before = getNetWorth(withBond);
    const after = handleTransaction(withBond, 'SELL_ASSET', { assetName: 'HDFC Bond', amount: 1000 });
    expect(getNetWorth(after)).toBe(before);
    expect(after.cash).toBe(withBond.cash + 1000);
    expect(after.assets.find((a) => a.name === 'HDFC Bond')?.value).toBe(2000);
  });

  it('SELL_ASSET: selling everything marks the holding inactive, not deleted', () => {
    const withBond = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    const after = handleTransaction(withBond, 'SELL_ASSET', { assetName: 'HDFC Bond', amount: 3000 });
    const bond = after.assets.find((a) => a.name === 'HDFC Bond');
    expect(bond?.value).toBe(0);
    expect(bond?.isActive).toBe(false);
    expect(getNetWorth(after)).toBe(seedState.cash); // inactive asset excluded from net worth
  });

  it('SELL_ASSET: rejects selling more than is held', () => {
    const withBond = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    expect(() => handleTransaction(withBond, 'SELL_ASSET', { assetName: 'HDFC Bond', amount: 5000 }))
      .toThrow();
  });

  it('INCOME: net worth increases by exactly the amount', () => {
    const before = getNetWorth(seedState);
    const after = handleTransaction(seedState, 'INCOME', { amount: 5000, category: 'Salary' });
    expect(getNetWorth(after)).toBe(before + 5000);
  });

  it('EXPENSE: net worth decreases by exactly the amount', () => {
    const before = getNetWorth(seedState);
    const after = handleTransaction(seedState, 'EXPENSE', { amount: 1200, category: 'Grocery' });
    expect(getNetWorth(after)).toBe(before - 1200);
  });

  it('EXPENSE: rejects spending more cash than is held by default', () => {
    expect(() => handleTransaction(seedState, 'EXPENSE', { amount: 999999, category: 'Rent' }))
      .toThrow();
  });

  it('EXPENSE: allowNegativeCash lets cash go negative when opted in', () => {
    const after = handleTransaction(
      seedState, 'EXPENSE', { amount: 999999, category: 'Rent' }, { allowNegativeCash: true },
    );
    expect(after.cash).toBe(seedState.cash - 999999);
  });

  it('REVALUE_ASSET: net worth moves by exactly the delta, cash untouched', () => {
    const withBond = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    const before = getNetWorth(withBond);
    const cashBefore = withBond.cash;
    const after = handleTransaction(withBond, 'REVALUE_ASSET', { assetName: 'HDFC Bond', delta: 250 });
    expect(getNetWorth(after)).toBe(before + 250);
    expect(after.cash).toBe(cashBefore);
  });

  it('REVALUE_ASSET: newValue form computes the same delta as an explicit delta', () => {
    const withBond = handleTransaction(seedState, 'BUY_ASSET', {
      assetName: 'HDFC Bond', assetType: 'bond', amount: 3000,
    });
    const after = handleTransaction(withBond, 'REVALUE_ASSET', { assetName: 'HDFC Bond', newValue: 3250 });
    expect(after.assets.find((a) => a.name === 'HDFC Bond')?.value).toBe(3250);
  });
});
