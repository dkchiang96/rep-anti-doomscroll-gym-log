import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { theme } from '@/theme';

export default function Placeholder() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{strings.appPlaceholder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
  },
  label: {
    color: theme.color.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
  },
});
