import {
  formatCardioShorthand,
  formatCardioTarget,
  formatDuration,
  lapDurationSeconds,
  parseMinutesDotSeconds,
  type CardioRound,
} from '../cardio';

describe('formatDuration', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(245)).toBe('4:05');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(59.6)).toBe('1:00');
  });
});

describe('parseMinutesDotSeconds', () => {
  it('reads minutes.seconds', () => {
    expect(parseMinutesDotSeconds('4.05')).toBe(245);
    expect(parseMinutesDotSeconds('4.5')).toBe(245);
    expect(parseMinutesDotSeconds('4.50')).toBe(290);
    expect(parseMinutesDotSeconds('4')).toBe(240);
    expect(parseMinutesDotSeconds('0.45')).toBe(45);
    expect(parseMinutesDotSeconds('12.')).toBe(720);
  });

  it('rejects seconds ≥ 60 and junk instead of guessing', () => {
    expect(parseMinutesDotSeconds('4.75')).toBeNull();
    expect(parseMinutesDotSeconds('')).toBeNull();
    expect(parseMinutesDotSeconds('4.055')).toBeNull();
    expect(parseMinutesDotSeconds('a')).toBeNull();
  });
});

describe('lapDurationSeconds', () => {
  it('rounds to whole seconds and never goes negative', () => {
    expect(lapDurationSeconds(1000, 246_400)).toBe(245);
    expect(lapDurationSeconds(5000, 1000)).toBe(0);
  });
});

describe('formatCardioTarget', () => {
  const base = { sets: 4, repsMin: 0, repsMax: 0, distanceM: null, timeSeconds: null, calories: null, loadKg: null };
  it('describes distance, reps, calories, time and load per round', () => {
    expect(formatCardioTarget({ ...base, distanceM: 1000 }, ['distance_m', 'time'])).toBe('4 × 1000 m');
    expect(formatCardioTarget({ ...base, repsMin: 20, repsMax: 20, loadKg: 6 }, ['reps', 'load_kg', 'time'])).toBe('4 × 20 reps @ 6 kg');
    expect(formatCardioTarget({ ...base, sets: 5, calories: 15 }, ['calories', 'time'])).toBe('5 × 15 cal');
    expect(formatCardioTarget({ ...base, distanceM: 500, timeSeconds: 100 }, ['distance_m', 'time'])).toBe('4 × 500 m in 1:40');
    expect(formatCardioTarget({ ...base, repsMin: 10, repsMax: 15 }, ['reps'])).toBe('4 × 10–15 reps');
  });

  it('ignores a target whose metric is not tracked, and falls back to rounds', () => {
    expect(formatCardioTarget({ ...base, distanceM: 1000 }, ['time'])).toBe('4 rounds');
  });
});

describe('formatCardioShorthand', () => {
  const round = (r: Partial<CardioRound>): CardioRound => ({ weightKg: 0, reps: 0, setType: 'working', ...r });

  it('groups by distance and lists times', () => {
    const rounds = [round({ distanceM: 1000, durationSeconds: 245 }), round({ distanceM: 1000, durationSeconds: 252 })];
    expect(formatCardioShorthand(rounds, ['distance_m', 'time'])).toBe('1000m 4:05 4:12');
  });

  it('shows reps and time together, grouped by load', () => {
    const rounds = [round({ weightKg: 6, reps: 20, durationSeconds: 70 }), round({ weightKg: 6, reps: 18, durationSeconds: 75 })];
    expect(formatCardioShorthand(rounds, ['reps', 'load_kg', 'time'])).toBe('6kg 20·1:10 18·1:15');
  });

  it('starts a new group when the label changes, and skips warm-ups', () => {
    const rounds = [
      round({ distanceM: 50, weightKg: 60, durationSeconds: 30, setType: 'warmup' }),
      round({ distanceM: 50, weightKg: 102, durationSeconds: 48 }),
      round({ distanceM: 50, weightKg: 112, durationSeconds: 55 }),
    ];
    expect(formatCardioShorthand(rounds, ['distance_m', 'load_kg', 'time'])).toBe('50m 102kg 0:48 50m 112kg 0:55');
  });

  it('handles calories-only and rounds with nothing timed', () => {
    expect(formatCardioShorthand([round({ calories: 15, durationSeconds: 60 })], ['calories', 'time'])).toBe('15cal 1:00');
    expect(formatCardioShorthand([round({ distanceM: 1000 })], ['distance_m', 'time'])).toBe('1000m ✓');
  });
});
