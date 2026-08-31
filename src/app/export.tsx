import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDatabase } from '@/data/DatabaseProvider';
import { listFullExportData, listSetExportRows } from '@/data/repositories/exportRepository';
import { buildFullJsonExport, buildSetCsv } from '@/domain/exportFormat';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Format = 'csv' | 'json';

function timestampForFilename(d: Date): string {
  return d.toISOString().replace(/[:.]/g, '-');
}

export default function ExportScreen() {
  const { db, userId } = useDatabase();
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportCsv() {
    setError(null);
    setBusy('csv');
    try {
      const rows = await listSetExportRows(db, userId);
      if (rows.length === 0) {
        setError(strings.exportEmpty);
        return;
      }
      const csv = buildSetCsv(rows);
      const uri = `${FileSystem.cacheDirectory}rep-sets-${timestampForFilename(new Date())}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv);
      await shareFile(uri, 'text/csv');
    } catch {
      setError(strings.exportError);
    } finally {
      setBusy(null);
    }
  }

  async function exportJson() {
    setError(null);
    setBusy('json');
    try {
      const data = await listFullExportData(db, userId);
      if (data.sessions.length === 0) {
        setError(strings.exportEmpty);
        return;
      }
      const json = buildFullJsonExport({ ...data, exportedAt: new Date() });
      const uri = `${FileSystem.cacheDirectory}rep-export-${timestampForFilename(new Date())}.json`;
      await FileSystem.writeAsStringAsync(uri, json);
      await shareFile(uri, 'application/json');
    } catch {
      setError(strings.exportError);
    } finally {
      setBusy(null);
    }
  }

  async function shareFile(uri: string, mimeType: string) {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      setError(strings.exportShareUnavailable);
      return;
    }
    await Sharing.shareAsync(uri, { mimeType });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.subtitle}>{strings.exportIntro}</Text>

        <Pressable style={styles.button} disabled={busy !== null} onPress={exportCsv}>
          <Text style={styles.buttonLabel}>
            {busy === 'csv' ? strings.exportPreparing : strings.exportCsvButton}
          </Text>
        </Pressable>

        <Pressable style={styles.button} disabled={busy !== null} onPress={exportJson}>
          <Text style={styles.buttonLabel}>
            {busy === 'json' ? strings.exportPreparing : strings.exportJsonButton}
          </Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: theme.color.bg,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  errorText: {
    color: theme.color.accentPrimary,
    fontSize: 13,
  },
});
