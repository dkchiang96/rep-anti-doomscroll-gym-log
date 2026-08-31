import { suggestReviewResolution } from '../reviewSuggestions';

describe('suggestReviewResolution', () => {
  it('treats garbage tokens as likely accidental and non-editable', () => {
    const s = suggestReviewResolution({ context: 'ctx', rawFragment: '153³Ẁ', reason: 'unparseable token' });
    expect(s.editable).toBe(false);
    expect(s.message).toMatch(/accidental/i);
  });

  it('flags a single-word garbage line as safe to ignore but still editable', () => {
    const s = suggestReviewResolution({
      context: 'ctx',
      rawFragment: 'AWW3W4',
      reason: 'no sets could be parsed from this line',
    });
    expect(s.editable).toBe(true);
    expect(s.message).toMatch(/accidental/i);
  });

  it('identifies a timed activity with no weight token', () => {
    const s = suggestReviewResolution({
      context: 'ctx',
      rawFragment: 'inclined walk - 30 mins',
      reason: 'no sets could be parsed from this line',
    });
    expect(s.editable).toBe(true);
    expect(s.message).toMatch(/timed activity/i);
  });

  it('suggests adding a weight token for an ambiguous exercise line', () => {
    const s = suggestReviewResolution({
      context: 'ctx',
      rawFragment: 'incline smith - 4',
      reason: 'no sets could be parsed from this line',
    });
    expect(s.editable).toBe(true);
    expect(s.message).toMatch(/no weight/i);
  });

  it('explains duplicate-date flags as probably two real sessions', () => {
    const s = suggestReviewResolution({
      context: 'ctx',
      rawFragment: '27 aug 2025',
      reason: 'date appears in 2 separate session blocks — verify these are distinct sessions',
    });
    expect(s.editable).toBe(false);
    expect(s.message).toMatch(/two real sessions/i);
  });
});
