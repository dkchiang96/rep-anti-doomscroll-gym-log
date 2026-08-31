// Turns a keepParser ReviewItem into a human-readable suggestion for the
// import review screen. Most garbage in real exports is an accidental
// keypress from carrying a phone mid-workout, not hidden data to recover —
// suggestions reflect that rather than guessing at numbers.

import type { ReviewItem } from './keepParser';

export interface ReviewSuggestion {
  message: string;
  /** Whether editing the raw text and re-parsing it can plausibly recover real data. */
  editable: boolean;
}

const NO_WEIGHT_ACTIVITY_RE = /\b(min|mins|minute|minutes|walk|treadmill|threadmill|jog|run)\b/i;

function suggestLineFix(rawFragment: string): ReviewSuggestion {
  if (!/\s/.test(rawFragment.trim())) {
    return {
      message: 'Looks like an accidental keypress with no recognizable exercise — probably safe to ignore.',
      editable: true,
    };
  }
  if (NO_WEIGHT_ACTIVITY_RE.test(rawFragment)) {
    return {
      message: 'Reads like a timed activity with no weight or reps — nothing to import unless you edit it into a weight/rep line.',
      editable: true,
    };
  }
  return {
    message: 'No weight or "bw" token was found — edit the line to add one (e.g. "40kg 4") and it will be re-parsed.',
    editable: true,
  };
}

export function suggestReviewResolution(item: ReviewItem): ReviewSuggestion {
  if (item.reason.includes('separate session blocks')) {
    return {
      message: 'Probably two real sessions on the same day (e.g. AM/PM) — no action needed unless one is a mistake.',
      editable: false,
    };
  }

  switch (item.reason) {
    case 'unparseable token':
    case 'rep count out of plausible range':
      return {
        message: 'Likely an accidental keypress while carrying your phone — the rest of this exercise\'s sets were still imported. Safe to ignore.',
        editable: false,
      };
    case 'session had no parseable exercises':
      return {
        message: 'No sets were found for this date. If you trained that day, add the session later from the log screen.',
        editable: false,
      };
    case 'no sets could be parsed from this line':
      return suggestLineFix(item.rawFragment);
    default:
      return { message: 'Review and edit manually if needed.', editable: false };
  }
}
