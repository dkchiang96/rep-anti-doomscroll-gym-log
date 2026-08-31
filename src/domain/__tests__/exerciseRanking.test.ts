import { rankExercises, type RankableExercise } from '../exerciseRanking';

const NOW = new Date('2026-08-31T12:00:00Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

describe('rankExercises', () => {
  it('ranks a well-established exercise above a single recent tap', () => {
    const frequent: RankableExercise = { name: 'Squat', useCount: 5, lastUsedAt: null };
    const recent: RankableExercise = { name: 'Leg Extension', useCount: 1, lastUsedAt: NOW };
    expect(rankExercises([recent, frequent], NOW).map((e) => e.name)).toEqual(['Squat', 'Leg Extension']);
  });

  it('ranks equally-infrequent exercises by recency', () => {
    const stale: RankableExercise = { name: 'Old Move', useCount: 1, lastUsedAt: daysAgo(60) };
    const fresh: RankableExercise = { name: 'New Move', useCount: 1, lastUsedAt: daysAgo(1) };
    expect(rankExercises([stale, fresh], NOW).map((e) => e.name)).toEqual(['New Move', 'Old Move']);
  });

  it('breaks ties between never-used exercises alphabetically', () => {
    const a: RankableExercise = { name: 'Zebra Curl', useCount: 0, lastUsedAt: null };
    const b: RankableExercise = { name: 'Ab Wheel', useCount: 0, lastUsedAt: null };
    expect(rankExercises([a, b], NOW).map((e) => e.name)).toEqual(['Ab Wheel', 'Zebra Curl']);
  });

  it('does not mutate the input array', () => {
    const list: RankableExercise[] = [
      { name: 'B', useCount: 0, lastUsedAt: null },
      { name: 'A', useCount: 0, lastUsedAt: null },
    ];
    const original = [...list];
    rankExercises(list, NOW);
    expect(list).toEqual(original);
  });
});
