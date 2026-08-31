export interface SetInstrumentationRecord {
  taps: number;
  seconds: number;
}

export interface InstrumentationSummary {
  avgTaps: number;
  avgSeconds: number;
}

export function summarizeInstrumentation(records: SetInstrumentationRecord[]): InstrumentationSummary {
  if (records.length === 0) return { avgTaps: 0, avgSeconds: 0 };
  const totalTaps = records.reduce((sum, r) => sum + r.taps, 0);
  const totalSeconds = records.reduce((sum, r) => sum + r.seconds, 0);
  return {
    avgTaps: Math.round((totalTaps / records.length) * 10) / 10,
    avgSeconds: Math.round((totalSeconds / records.length) * 10) / 10,
  };
}
