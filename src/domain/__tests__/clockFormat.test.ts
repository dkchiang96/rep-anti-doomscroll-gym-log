import { formatClock } from '../clockFormat';

describe('formatClock', () => {
  it('pads seconds and minutes under 10', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(7_000)).toBe('00:07');
  });

  it('formats minutes and seconds normally', () => {
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('runs minutes past 60 instead of rolling into an hour digit', () => {
    expect(formatClock(60 * 60_000)).toBe('60:00');
    expect(formatClock(90 * 60_000 + 5_000)).toBe('90:05');
    expect(formatClock(127 * 60_000 + 43_000)).toBe('127:43');
  });

  it('clamps negative elapsed time to zero', () => {
    expect(formatClock(-500)).toBe('00:00');
  });
});
