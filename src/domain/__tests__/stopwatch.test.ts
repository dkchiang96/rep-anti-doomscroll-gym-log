import { computeElapsedMs, didCrossInterval } from '../stopwatch';

describe('computeElapsedMs', () => {
  it('returns 0 when the clock has never been started', () => {
    expect(computeElapsedMs(null, 0, 1_000_000)).toBe(0);
  });

  it('returns time since start when there has been no pause', () => {
    expect(computeElapsedMs(1_000, 0, 5_000)).toBe(4_000);
  });

  it('subtracts accumulated pause time', () => {
    // Started at t=0, paused for 2s at some point, now t=10s: 8s of real elapsed time.
    expect(computeElapsedMs(0, 2_000, 10_000)).toBe(8_000);
  });

  it('is derived purely from timestamps, so a huge gap (e.g. the app was killed) is still correct', () => {
    const startedAt = 1_000;
    const accumulatedPauseMs = 5_000;
    const now = startedAt + 6 * 60 * 60 * 1000; // reopened 6 hours later
    expect(computeElapsedMs(startedAt, accumulatedPauseMs, now)).toBe(6 * 60 * 60 * 1000 - accumulatedPauseMs);
  });

  it('clamps to 0 rather than going negative', () => {
    // Accumulated pause somehow exceeds now - startedAt (shouldn't happen, but must not read as negative elapsed).
    expect(computeElapsedMs(10_000, 50_000, 20_000)).toBe(0);
  });
});

describe('didCrossInterval', () => {
  const THIRTY_S = 30_000;

  it('is false while elapsed stays within the same interval bucket', () => {
    expect(didCrossInterval(1_000, 29_999, THIRTY_S)).toBe(false);
  });

  it('is true the instant elapsed reaches the next multiple of the interval', () => {
    expect(didCrossInterval(29_999, 30_000, THIRTY_S)).toBe(true);
  });

  it('is true even when a single lagged reading jumps past more than one boundary', () => {
    // e.g. the app was backgrounded through two 30s crossings and the next
    // tick only fires once elapsed has reached 65s — still must fire, not skip.
    expect(didCrossInterval(20_000, 65_000, THIRTY_S)).toBe(true);
  });

  it('is false when elapsed does not change (the clock is paused)', () => {
    expect(didCrossInterval(30_000, 30_000, THIRTY_S)).toBe(false);
  });

  it('is false when elapsed goes backward (e.g. a reset)', () => {
    expect(didCrossInterval(45_000, 0, THIRTY_S)).toBe(false);
  });
});
