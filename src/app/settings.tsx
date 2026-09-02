import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ListRow } from '@/components/ui';
import { strings } from '@/strings';
import { color } from '@/theme';

// R2 stub — a list of navigation rows to the screens R5 builds (Import,
// Export, Archive, Debug). Rows are present and disabled, never hidden, per
// docs/REBUILD-SESSIONS.md R2.

export default function Settings() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.settingsTitle }} />
      <ListRow variant="navigation" label={strings.settingsRowImport} disabled onPress={() => {}} />
      <ListRow variant="navigation" label={strings.settingsRowExport} disabled onPress={() => {}} />
      <ListRow variant="navigation" label={strings.settingsRowArchive} disabled onPress={() => {}} />
      <ListRow variant="navigation" label={strings.settingsRowDebug} disabled onPress={() => {}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    flexGrow: 1,
  },
});
