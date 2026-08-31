import { countFlashCrossings, resolveTargetRestSeconds } from '../restClock';

describe('resolveTargetRestSeconds', () => {
  it('falls back to 60s when unset', () => {
    expect(resolveTargetRestSeconds(null)).toBe(60);
  });

  it('uses the exercise value when set', () => {
    expect(resolveTargetRestSeconds(90)).toBe(90);
  });
});

describe('countFlashCrossings', () => {
  const interval = 30_000;

  it('fires nothing before the first boundary', () => {
    expect(countFlashCrossings(0, 29_999, interval)).toBe(0);
  });

  it('fires exactly once crossing a single boundary', () => {
    expect(countFlashCrossings(29_000, 30_500, interval)).toBe(1);
  });

  it('does not double-fire for readings within the same interval', () => {
    expect(countFlashCrossings(30_500, 31_000, interval)).toBe(0);
  });

  it('fires once more crossing the next boundary', () => {
    expect(countFlashCrossings(59_000, 60_200, interval)).toBe(1);
  });

  it('catches multiple crossings if a tick lags (e.g. backgrounded app)', () => {
    expect(countFlashCrossings(0, 95_000, interval)).toBe(3);
  });

  it('never fires backwards or for a zero/negative interval', () => {
    expect(countFlashCrossings(30_500, 29_000, interval)).toBe(0);
    expect(countFlashCrossings(0, 30_000, 0)).toBe(0);
  });
});
