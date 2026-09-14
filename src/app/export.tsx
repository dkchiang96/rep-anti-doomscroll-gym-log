import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDatabase } from '@/data/DatabaseProvider';
import { listFullExportData, listSetExportRows } from '@/data/repositories/exportRepository';
import { buildFullJsonExport, buildSetCsv } from '@/domain/exportFormat';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 7's Export destination (FR-8) — CSV/JSON via the
// share sheet. src/domain/exportFormat.ts is unchanged; exportRepository.ts
// gained an optional `since` (item 2).

type Status = { kind: 'idle' } | { kind: 'preparing' } | { kind: 'error'; message: string };

// Item 2: pick a duration before exporting. `since: null` means "all time" —
// the pre-existing behaviour, kept as the default so nothing changes for an
// export unless a range is explicitly picked.
type RangeOption = { key: string; label: string; fileSuffix: string; since: (() => Date) | null };
const RANGE_OPTIONS: RangeOption[] = [
  { key: '30d', label: strings.exportRange30d, fileSuffix: '30d', since: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  { key: '90d', label: strings.exportRange90d, fileSuffix: '90d', since: () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  { key: '1y', label: strings.exportRange1y, fileSuffix: '1y', since: () => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
  { key: 'all', label: strings.exportRangeAll, fileSuffix: 'all', since: null },
];

export default function Export() {
  const { db, userId } = useDatabase();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [range, setRange] = useState<RangeOption>(RANGE_OPTIONS[RANGE_OPTIONS.length - 1]);

  async function shareFile(filename: string, contents: string) {
    setStatus({ kind: 'preparing' });
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus({ kind: 'error', message: strings.exportShareUnavailable });
        return;
      }
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, contents);
      await Sharing.shareAsync(path);
      setStatus({ kind: 'idle' });
    } catch {
      setStatus({ kind: 'error', message: strings.exportError });
    }
  }

  async function handleExportCsv() {
    const since = range.since?.();
    const rows = await listSetExportRows(db, userId, since);
    if (rows.length === 0) {
      setStatus({ kind: 'error', message: strings.exportEmpty });
      return;
    }
    await shareFile(`rep-export-${range.fileSuffix}.csv`, buildSetCsv(rows));
  }

  async function handleExportJson() {
    const since = range.since?.();
    const data = await listFullExportData(db, userId, since);
    await shareFile(`rep-export-${range.fileSuffix}.json`, buildFullJsonExport({ ...data, exportedAt: new Date() }));
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: strings.exportTitle }} />
      <Text style={[type.body, styles.intro]}>{strings.exportIntro}</Text>

      <Text style={[type.caption, styles.rangeHeading]}>{strings.exportRangeHeading}</Text>
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setRange(option)}
            style={[styles.rangeTouch, range.key === option.key ? styles.rangeActive : styles.rangeInactive]}
          >
            <Text style={[type.caption, range.key === option.key ? styles.rangeLabelActive : styles.rangeLabelInactive]}>
              {option.label.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.actionTouch} onPress={() => void handleExportCsv()} disabled={status.kind === 'preparing'}>
        <Text style={[type.label, styles.actionLabel]}>{strings.exportCsvButton}</Text>
      </Pressable>
      <Pressable style={styles.actionTouch} onPress={() => void handleExportJson()} disabled={status.kind === 'preparing'}>
        <Text style={[type.label, styles.actionLabel]}>{strings.exportJsonButton}</Text>
      </Pressable>

      {status.kind === 'preparing' ? <Text style={[type.caption, styles.statusText]}>{strings.exportPreparing}</Text> : null}
      {status.kind === 'error' ? <Text style={[type.caption, styles.errorText]}>{status.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: size.listRowPadding,
    paddingTop: 16,
    gap: 16,
  },
  intro: {
    color: color.textMuted,
  },
  rangeHeading: {
    color: color.textMuted,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeTouch: {
    minHeight: size.minTouchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.divider,
  },
  rangeActive: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  rangeInactive: {
    backgroundColor: 'transparent',
  },
  rangeLabelActive: {
    color: color.onSlab,
  },
  rangeLabelInactive: {
    color: color.textPrimary,
  },
  actionTouch: {
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  actionLabel: {
    color: color.onSlab,
  },
  statusText: {
    color: color.textMuted,
  },
  errorText: {
    color: color.danger,
  },
});
