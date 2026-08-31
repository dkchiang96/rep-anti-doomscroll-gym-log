export const strings = {
  defaultUserDisplayName: 'You',
  loading: 'Loading…',

  homeImportLink: 'Import Google Keep history',

  importTitle: 'Import Keep history',
  importPasteInstructions: 'Paste your Google Keep workout notes below.',
  importYearLabel: 'Year',
  importYearPlaceholder: 'e.g. 2025',
  importYearError: 'Enter a valid year before parsing.',
  importPastePlaceholder: 'Paste Keep text here…',
  importParseButton: 'Parse',
  importBackButton: 'Back',
  importConfirmButton: 'Confirm import',
  importParsedSummary: (sessions: number, exercises: number, sets: number) =>
    `Parsed ${sessions} sessions, ${exercises} exercise entries, ${sets} sets.`,
  importNeedsReviewEmpty: 'Nothing needs review — every line parsed cleanly.',
  importNeedsReviewHeading: (count: number) => `Needs review (${count})`,
  importReviewEditLabel: 'Edit line',
  importReviewApplyButton: 'Add',
  importReviewDiscardButton: 'Ignore',
  importReviewStillUnparsed: "Still couldn't find a weight/rep pattern — keep editing.",
  importConventionHeading: 'Dumbbell load convention',
  importConventionIntro:
    'These exercises are ambiguous between per-dumbbell and combined weight. Confirm the convention so history stays consistent.',
  importConventionBeforeLabel: 'Before',
  importConventionAfterLabel: 'After',
  importConventionSingleLabel: 'Convention',
  importConventionPerSide: 'Per dumbbell',
  importConventionTotal: 'Combined total',
  importConventionBreakpoint: (label: string) => `Change detected around ${label}`,
  importingLabel: 'Importing…',
  importDoneHeading: 'Import complete',
  importSummary: (sessions: number, exercises: number, sets: number) =>
    `${sessions} sessions, ${exercises} exercises, ${sets} sets imported.`,
  importDoneButton: 'Done',
} as const;
