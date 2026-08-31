import { formatElapsed } from '../duration';

describe('formatElapsed', () => {
  it('formats sub-minute durations as MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(7_000)).toBe('00:07');
  });

  it('formats durations under an hour as MM:SS', () => {
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('adds an unpadded hours prefix once an hour has passed', () => {
    expect(formatElapsed(60 * 60_000)).toBe('1:00:00');
    expect(formatElapsed(90 * 60_000 + 5_000)).toBe('1:30:05');
    expect(formatElapsed(25 * 60 * 60_000)).toBe('25:00:00');
  });

  it('clamps negative durations to zero', () => {
    expect(formatElapsed(-500)).toBe('00:00');
  });
});
