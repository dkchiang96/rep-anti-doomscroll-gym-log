import { summarizeInstrumentation } from '../instrumentationSummary';

describe('summarizeInstrumentation', () => {
  it('returns zeros for no records', () => {
    expect(summarizeInstrumentation([])).toEqual({ avgTaps: 0, avgSeconds: 0 });
  });

  it('averages taps and seconds across records, rounded to one decimal', () => {
    const result = summarizeInstrumentation([
      { taps: 3, seconds: 10 },
      { taps: 4, seconds: 11 },
      { taps: 5, seconds: 12 },
    ]);
    expect(result).toEqual({ avgTaps: 4, avgSeconds: 11 });
  });

  it('rounds to one decimal rather than truncating', () => {
    const result = summarizeInstrumentation([{ taps: 1, seconds: 1 }, { taps: 2, seconds: 2 }]);
    expect(result).toEqual({ avgTaps: 1.5, avgSeconds: 1.5 });
  });
});
