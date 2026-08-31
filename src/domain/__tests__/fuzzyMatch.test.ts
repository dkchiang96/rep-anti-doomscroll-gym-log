import { matchExercises, type MatchableExercise } from '../fuzzyMatch';

const LIBRARY: MatchableExercise[] = [
  { id: '1', name: 'pull back row machinr', aliases: [] },
  { id: '2', name: 'pull back row', aliases: [] },
  { id: '3', name: 'incline dumbbell press', aliases: [] },
  { id: '4', name: 'flat dumbbell press', aliases: [] },
  { id: '5', name: 'chest supported row', aliases: ['t bar row'] },
];

describe('matchExercises', () => {
  it('resolves the FR-2.2 example: "pull back row machinr" against the real (typo) stored name', () => {
    const results = matchExercises('pull back row machinr', LIBRARY);
    expect(results[0].exercise.id).toBe('1');
  });

  it('resolves a typo the user makes while typing, favoring the closer-spelled match', () => {
    const results = matchExercises('pull bak row machin', LIBRARY);
    const ids = results.map((r) => r.exercise.id);
    expect(ids).toContain('1');
    expect(ids.indexOf('1')).toBeLessThan(ids.indexOf('2'));
  });

  it('resolves a dropped-letter typo against a name with no exact substring match', () => {
    const results = matchExercises('incline dumbell press', LIBRARY);
    expect(results[0].exercise.id).toBe('3');
  });

  it('matches against a stored alias, not just the primary name', () => {
    const results = matchExercises('t bar row', LIBRARY);
    expect(results[0].exercise.id).toBe('5');
  });

  it('returns nothing for an empty query', () => {
    expect(matchExercises('', LIBRARY)).toEqual([]);
    expect(matchExercises('   ', LIBRARY)).toEqual([]);
  });

  it('returns nothing for unrelated gibberish', () => {
    expect(matchExercises('zzzqxv nonsense', LIBRARY)).toEqual([]);
  });
});
