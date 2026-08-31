// Pure parser for the Google Keep workout-log text format (FR-8.4). Text in,
// structured sessions out. Never throws on malformed input — anything it
// cannot confidently parse is reported in `needsReview` instead of being
// silently dropped or guessed at.

export type ParsedSetType = 'working' | 'dropset';

export interface ParsedSet {
  weightKg: number;
  isBodyweight: boolean;
  reps: number;
  setType: ParsedSetType;
  groupIndex: number;
}

export interface ParsedExerciseEntry {
  name: string;
  note: string | null;
  sets: ParsedSet[];
  rawLine: string;
}

export interface ParsedSession {
  year: number;
  month: number; // 0-11
  day: number;
  note: string | null;
  rawText: string;
  exercises: ParsedExerciseEntry[];
}

export interface ReviewItem {
  context: string;
  rawFragment: string;
  reason: string;
  /**
   * Index into the returned `sessions` array this item belongs to, when the
   * item represents a whole line that failed to parse (so a corrected line
   * can be re-parsed and spliced back into the right session). Undefined for
   * items that don't map to a single session (e.g. a duplicate-date flag).
   */
  sessionIndex?: number;
}

export interface ParseKeepExportOptions {
  /** Calendar year applied to every date header. Keep exports carry no year, so the caller must supply one. */
  year: number;
}

export interface ParseKeepExportResult {
  sessions: ParsedSession[];
  needsReview: ReviewItem[];
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MAX_PLAUSIBLE_REPS = 60;

interface DateHeader {
  day: number;
  month: number;
  note: string | null;
}

function matchDateHeader(trimmed: string): DateHeader | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s*(?:\(([^)]*)\))?\s*$/.exec(trimmed);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  if (day < 1 || day > 31) return null;
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  return { day, month, note: m[3]?.trim() || null };
}

// Handles dates fused onto the tail of the previous line, e.g.
// "bw 428 Jul" meaning "bw 4" (reps) followed by a new "28 Jul" session header.
// Splits such a line into two logical lines before the main pass runs.
function splitFusedDateLines(lines: string[]): string[] {
  const monthNames = Object.keys(MONTHS).join('|');
  const fusedRe = new RegExp(`(\\d+)(\\s+)([A-Za-z]*(?:${monthNames})[A-Za-z]*)\\b`, 'i');
  const result: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || matchDateHeader(trimmed)) {
      result.push(rawLine);
      continue;
    }

    const match = fusedRe.exec(rawLine);
    const before = match ? rawLine.slice(0, match.index) : '';
    if (!match || before.trim().length === 0) {
      result.push(rawLine);
      continue;
    }

    const digits = match[1];
    let split: { prefix: string; day: string } | null = null;
    for (const suffixLen of [2, 1]) {
      if (digits.length <= suffixLen) continue;
      const day = parseInt(digits.slice(-suffixLen), 10);
      const prefix = digits.slice(0, -suffixLen);
      if (day >= 1 && day <= 31 && parseInt(prefix, 10) <= MAX_PLAUSIBLE_REPS) {
        split = { prefix, day: digits.slice(-suffixLen) };
        break;
      }
    }

    if (!split) {
      result.push(rawLine);
      continue;
    }

    const restAfterMonth = rawLine.slice(match.index + match[0].length);
    result.push(before + split.prefix);
    result.push(`${split.day} ${match[3]}${restAfterMonth}`);
  }

  return result;
}

function stripStrayParens(token: string): string {
  return token.replace(/^\(+/, '').replace(/\)+$/, '');
}

interface GroupStart {
  weightKg: number;
  isBodyweight: boolean;
  consumed: 1 | 2;
}

function classifyGroupStart(word: string, nextWord?: string): GroupStart | null {
  const w = stripStrayParens(word);
  if (/^bw$/i.test(w)) return { weightKg: 0, isBodyweight: true, consumed: 1 };

  const kgMatch = /^(\d+(?:\.\d+)?)kg$/i.exec(w);
  if (kgMatch) return { weightKg: parseFloat(kgMatch[1]), isBodyweight: false, consumed: 1 };

  if (/^\d+(?:\.\d+)?$/.test(w) && nextWord && /^kg\.?$/i.test(stripStrayParens(nextWord))) {
    return { weightKg: parseFloat(w), isBodyweight: false, consumed: 2 };
  }

  return null;
}

interface ParsedLine {
  name: string;
  note: string | null;
  sets: ParsedSet[];
  reviewItems: ReviewItem[];
}

export function parseExerciseLine(rawLine: string, contextLabel: string): ParsedLine {
  const trimmed = rawLine.trim();
  const words = trimmed.split(/\s+/);

  const dashIdx = words.findIndex((w) => w === '-');
  // A dash sometimes gets typed with no space before the first weight/bw
  // token, e.g. "-12kg" or "-bw" — treat that as the separator too, with the
  // remainder becoming the first data word.
  const fusedDashIdx = words.findIndex(
    (w, i) => w.length > 1 && w.startsWith('-') && classifyGroupStart(w.slice(1), words[i + 1]) !== null,
  );
  let nameWords: string[];
  let dataWords: string[];

  if (dashIdx !== -1) {
    nameWords = words.slice(0, dashIdx);
    dataWords = words.slice(dashIdx + 1);
  } else if (fusedDashIdx !== -1) {
    nameWords = words.slice(0, fusedDashIdx);
    dataWords = [words[fusedDashIdx].slice(1), ...words.slice(fusedDashIdx + 1)];
  } else {
    const dataStartIdx = words.findIndex(
      (w, i) => classifyGroupStart(w, words[i + 1]) !== null || /^\d+(?:\.\d+)?$/.test(stripStrayParens(w)),
    );
    if (dataStartIdx === -1) {
      return { name: trimmed, note: null, sets: [], reviewItems: [] };
    }
    nameWords = words.slice(0, dataStartIdx);
    dataWords = words.slice(dataStartIdx);
  }

  const name = nameWords.join(' ').replace(/[-,]+$/, '').trim();

  let note: string | null = null;
  const parenIdx = dataWords.findIndex((w) => w.startsWith('('));
  if (parenIdx !== -1) {
    note = dataWords.slice(parenIdx).join(' ').replace(/^\(+/, '').replace(/\)+$/, '').trim() || null;
    dataWords = dataWords.slice(0, parenIdx);
  }

  const sets: ParsedSet[] = [];
  const reviewItems: ReviewItem[] = [];
  let groupIndex = -1;
  let currentWeight: { weightKg: number; isBodyweight: boolean } | null = null;
  let i = 0;

  while (i < dataWords.length) {
    const word = dataWords[i];
    const next = dataWords[i + 1];
    const groupStart = classifyGroupStart(word, next);
    if (groupStart) {
      groupIndex += 1;
      currentWeight = { weightKg: groupStart.weightKg, isBodyweight: groupStart.isBodyweight };
      i += groupStart.consumed;
      continue;
    }

    const plain = stripStrayParens(word);
    if (/^\d+(?:\.\d+)?$/.test(plain)) {
      if (currentWeight === null) {
        // A bare number before any weight/bw token means this line doesn't
        // follow the expected grammar at all — bail out entirely rather than
        // guess which token was meant to be the weight.
        return { name, note, sets: [], reviewItems: [] };
      }

      const reps = parseFloat(plain);
      if (!Number.isInteger(reps) || reps <= 0 || reps > MAX_PLAUSIBLE_REPS) {
        reviewItems.push({ context: `${contextLabel} — ${name}`, rawFragment: word, reason: 'rep count out of plausible range' });
        i += 1;
        continue;
      }

      sets.push({
        weightKg: currentWeight.weightKg,
        isBodyweight: currentWeight.isBodyweight,
        reps,
        setType: groupIndex === 0 ? 'working' : 'dropset',
        groupIndex,
      });
      i += 1;
      continue;
    }

    reviewItems.push({ context: `${contextLabel} — ${name}`, rawFragment: word, reason: 'unparseable token' });
    i += 1;
  }

  return { name, note, sets, reviewItems };
}

function dateLabel(day: number, month: number, year: number): string {
  const monthName = Object.keys(MONTHS).find((key) => MONTHS[key] === month) ?? '?';
  return `${day} ${monthName} ${year}`;
}

interface SessionDraft {
  year: number;
  month: number;
  day: number;
  note: string | null;
  rawLines: string[];
  exercises: ParsedExerciseEntry[];
}

export function parseKeepExport(text: string, options: ParseKeepExportOptions): ParseKeepExportResult {
  const rawLines = splitFusedDateLines(text.split(/\r?\n/));
  const sessions: ParsedSession[] = [];
  const needsReview: ReviewItem[] = [];

  let current: SessionDraft | null = null;

  const finalize = (draft: SessionDraft) => {
    const rawText = draft.rawLines.join('\n').trim();
    if (draft.exercises.length === 0) {
      needsReview.push({
        context: dateLabel(draft.day, draft.month, draft.year),
        rawFragment: rawText,
        reason: 'session had no parseable exercises',
        sessionIndex: sessions.length,
      });
    }
    sessions.push({
      year: draft.year,
      month: draft.month,
      day: draft.day,
      note: draft.note,
      rawText,
      exercises: draft.exercises,
    });
  };

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (trimmed === '') {
      current?.rawLines.push(rawLine);
      continue;
    }

    const header = matchDateHeader(trimmed);
    if (header) {
      const isRedundantBoundary =
        current &&
        current.exercises.length === 0 &&
        current.month === header.month &&
        current.day === header.day;
      if (isRedundantBoundary) {
        // The fused-date splitter can land an empty synthetic header right
        // next to the export's own header for the same date (seen after
        // "bw 428 Jul" — it splits into "...bw 4" + "28 Jul", right before a
        // real "28 Jul" header two lines later). Drop the empty shell rather
        // than emitting a phantom session and a bogus "duplicate date" flag.
        current = null;
      } else if (current) {
        finalize(current);
      }
      current = {
        year: options.year,
        month: header.month,
        day: header.day,
        note: header.note,
        rawLines: [rawLine],
        exercises: [],
      };
      continue;
    }

    if (!current) {
      needsReview.push({ context: '(before first date header)', rawFragment: trimmed, reason: 'content before first date header' });
      continue;
    }

    current.rawLines.push(rawLine);
    const label = dateLabel(current.day, current.month, current.year);
    const parsed = parseExerciseLine(trimmed, label);
    if (parsed.sets.length === 0) {
      needsReview.push({
        context: label,
        rawFragment: trimmed,
        reason: 'no sets could be parsed from this line',
        sessionIndex: sessions.length,
      });
      continue;
    }

    current.exercises.push({ name: parsed.name, note: parsed.note, sets: parsed.sets, rawLine: trimmed });
    needsReview.push(...parsed.reviewItems);
  }

  if (current) finalize(current);

  const dateCounts = new Map<string, number>();
  for (const s of sessions) {
    const key = `${s.year}-${s.month}-${s.day}`;
    dateCounts.set(key, (dateCounts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of dateCounts) {
    if (count > 1) {
      const [year, month, day] = key.split('-').map(Number);
      needsReview.push({
        context: dateLabel(day, month, year),
        rawFragment: dateLabel(day, month, year),
        reason: `date appears in ${count} separate session blocks — verify these are distinct sessions`,
      });
    }
  }

  return { sessions, needsReview };
}
