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
// share sheet. src/domain/exportFormat.ts and exportRepository.ts are
// unchanged, per the R5 brief.

type Status = { kind: 'idle' } | { kind: 'preparing' } | { kind: 'error'; message: string };

export default function Export() {
  const { db, userId } = useDatabase();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

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
    const rows = await listSetExportRows(db, userId);
    if (rows.length === 0) {
      setStatus({ kind: 'error', message: strings.exportEmpty });
      return;
    }
    await shareFile('rep-export.csv', buildSetCsv(rows));
  }

  async function handleExportJson() {
    const data = await listFullExportData(db, userId);
    await shareFile('rep-export.json', buildFullJsonExport({ ...data, exportedAt: new Date() }));
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: strings.exportTitle }} />
      <Text style={[type.body, styles.intro]}>{strings.exportIntro}</Text>

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
